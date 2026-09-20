import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, playbackPlan } from '../src/audio.js';
import { example } from '../src/model.js';

test('Strum follows physical strings for reentrant tuning, reverses upstrokes and fits short events', () => {
  const p = example(); p.events = p.events.slice(0, 1);
  p.settings.open1 = 76; p.settings.tempo = 280; p.events[0].duration = 24;
  const e = p.events[0]; e.picking = 'down';
  const down = playbackPlan(p).events[0];
  assert.ok(down.notes[0].midi > down.notes[1].midi);
  assert.ok(down.notes.every((n,i) => i === 0 || n.offset > down.notes[i-1].offset));
  assert.ok(down.notes.at(-1).offset < down.duration);
  e.picking = 'up';
  assert.deepEqual(playbackPlan(p).events[0].notes.map(n=>n.midi), down.notes.map(n=>n.midi).reverse());
  e.picking = 'fingers'; assert.ok(playbackPlan(p).events[0].notes.every(n=>n.offset === 0));
  e.picking = 'free'; assert.ok(playbackPlan(p).events[0].notes[1].offset > 0);
});

test('Guitar voice has harmonic excitation, decaying brightness and gain, and releases its nodes', () => {
  const param = () => ({value:0, calls:[], setValueAtTime(...a){this.calls.push(['set',...a]);},linearRampToValueAtTime(...a){this.calls.push(['linear',...a]);}, exponentialRampToValueAtTime(...a){this.calls.push(['exp',...a]);},cancelScheduledValues(){}});
  const node = () => ({connections:[],connect(n){this.connections.push(n);return n;},disconnect(){this.disconnected=true;}});
  const osc = {...node(),frequency:param(),setPeriodicWave(w){this.wave=w;},start(t){this.started=t;},stop(t){this.stopped=t;}};
  const filter = {...node(),frequency:param(),Q:param()};
  const gain = {...node(),gain:param()};
  const p = new Player(); p.context = {sampleRate:48000,currentTime:0,destination:node(),createOscillator:()=>osc,createGain:()=>gain,createBiquadFilter:()=>filter,createPeriodicWave:(real,imag)=>({real,imag})};
  p.voice(40,1,1,0.1,'guitar');
  assert.equal(osc.frequency.value,82.4068892282175);
  assert.ok(osc.wave.imag.slice(2).some(v=>v!==0));
  assert.equal(osc.connections[0],filter); assert.equal(filter.connections[0],gain);
  assert.ok(filter.frequency.calls[1][1]<filter.frequency.calls[0][1]);
  assert.equal(gain.gain.calls[2][0],'exp');
  assert.ok(gain.gain.calls[2][1]<gain.gain.calls[1][1]);
  assert.equal(p.voices.size,1); p.stop(); assert.equal(p.voices.size,0);
  osc.onended(); assert.ok(osc.disconnected && filter.disconnected && gain.disconnected);
});

test('Playback notifications follow audio time through chords, rests, loop and Stop', async () => {
  const originalSet = globalThis.setInterval, originalClear = globalThis.clearInterval;
  let pump; globalThis.setInterval = fn => {pump=fn;return 1;}; globalThis.clearInterval=()=>{};
  const seen=[]; const player=new Player(id=>seen.push(id));
  player.context={state:'running',currentTime:0}; player.voice=()=>{};
  try {
    const p=example(); p.events=p.events.slice(0,2); p.settings.tempo=120;p.settings.loop=true;
    p.events.forEach(e=>e.duration=96);
    p.events[1].kind='rest';p.events[1].notes=[];
    await player.play(p);
    assert.equal(seen.at(-1),null);
    player.context.currentTime=0.08;pump();assert.equal(seen.at(-1),p.events[0].id);
    player.context.currentTime=0.58;pump();assert.equal(seen.at(-1),p.events[1].id);
    player.context.currentTime=1.08;pump();assert.equal(seen.at(-1),p.events[0].id);
    player.stop();assert.equal(seen.at(-1),null);
  } finally { player.stop();globalThis.setInterval=originalSet;globalThis.clearInterval=originalClear; }
});

