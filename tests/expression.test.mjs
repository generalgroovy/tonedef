import test from 'node:test';
import assert from 'node:assert/strict';
import { bendAmount, slidePitch } from '../src/expression.js';
import { Player } from '../src/audio.js';
import { defaultProject, validateProject, importProject } from '../src/model.js';

test('Bends rise continuously up to two semitones and return to the original pitch', () => {
  assert.equal(bendAmount(0), 0);
  assert.equal(bendAmount(10), .25);
  assert.equal(bendAmount(-40), 1);
  assert.equal(bendAmount(80), 2);
  assert.equal(bendAmount(-500), 2);
});

test('Slides interpolate physical fret centers in either handedness and clamp to the neck', () => {
  const points = [{ x: 30, midi: 40 }, { x: 90, midi: 45 }, { x: 140, midi: 46 }];
  assert.equal(slidePitch(points, 60), 42.5);
  assert.equal(slidePitch(points, 115), 45.5);
  assert.equal(slidePitch(points, -500), 40);
  assert.equal(slidePitch(points, 500), 46);
  assert.equal(slidePitch(points.map(p => ({ ...p, x: 170 - p.x })), 55), 45.5);
  assert.equal(slidePitch([], 10), null);
});

test('Click sound defaults on while explicit saved mute preferences survive import', () => {
  const p = defaultProject();
  assert.equal(p.settings.audition, true);
  p.settings.audition = false;
  validateProject(p);
  assert.equal(importProject(JSON.stringify(p)).settings.audition, false);
});

test('Held note changes continuous frequency, releases once, and cannot restart after Stop', async () => {
  const calls = [];
  const param = () => ({ value: 0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){},
    setTargetAtTime(hz, at, ramp){calls.push(['pitch',hz,at,ramp]);},
    cancelAndHoldAtTime(at){calls.push(['release',at]);},cancelScheduledValues(){} });
  const node = () => ({connect(n){return n;},disconnect(){}});
  const osc = {...node(),frequency:param(),start(){},stop(t){calls.push(['stop',t]);}};
  const player = new Player();
  player.context = {state:'running',currentTime:1,destination:node(),createOscillator:()=>osc,
    createGain:()=>({...node(),gain:param()})};
  const settings = {...defaultProject().settings,waveform:'triangle'};
  const held = await player.hold(69, settings);
  held.pitch(69.5);
  assert.ok(Math.abs(calls.find(c=>c[0]==='pitch')[1] - 440 * 2 ** (.5/12)) < .00001);
  held.release(); held.release(); held.pitch(72);
  assert.equal(calls.filter(c=>c[0]==='release').length,1);
  assert.equal(calls.filter(c=>c[0]==='pitch').length,1);
  player.stop(); assert.equal(player.voices.size,0);
  player.context.state='suspended';
  let resume; player.context.resume=()=>new Promise(resolve=>{resume=resolve;});
  const pending=player.hold(60,settings); player.stop();resume();
  assert.equal(await pending,undefined);
  assert.equal(player.voices.size,0);
});
