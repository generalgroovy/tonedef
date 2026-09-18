import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceData, pitchGeometry, intervalWorkspace } from '../src/interval-view.js';
import { defaultSettings } from '../src/model.js';

test('Half-step data retains signed register, octaves and reciprocal ratios', () => {
  const up = distanceData(48, 64), down = distanceData(64, 48);
  assert.equal(up.steps, 16); assert.equal(down.steps, -16);
  assert.equal(up.pitchClass, 4); assert.equal(down.pitchClass, 8);
  assert.equal(up.cents, 1600); assert.equal(down.cents, -1600);
  assert.ok(Math.abs(up.ratio * down.ratio - 1) < 1e-12);
  assert.equal(distanceData(60, 72).ratio, 2);
  assert.equal(distanceData(72, 60).ratio, .5);
  assert.equal(distanceData(69, 69).fromHz, 440);
  assert.equal(distanceData(69, 69).ratio, 1);
});
test('All MIDI-pitch pairs agree with equal-temperament frequencies', () => {
  for (let a = 0; a <= 127; a++) for (let b = 0; b <= 127; b++) {
    const d = distanceData(a, b);
    assert.equal(d.steps, b - a);
    assert.ok(d.pitchClass >= 0 && d.pitchClass < 12);
    assert.ok(Math.abs(d.toHz / d.fromHz - d.ratio) < 1e-8);
  }
});
test('Invalid pitches are rejected rather than rendered as NaN', () => {
  for (const value of [-1, 128, NaN, Infinity, 60.5, '60', null]) {
    assert.throws(() => distanceData(value, 60), RangeError);
    assert.throws(() => pitchGeometry([60, value]), RangeError);
  }
});
test('Pitch axis uses actual distances and groups unisons without losing occurrences', () => {
  const g = pitchGeometry([60, 64, 67, 72, 60]);
  assert.equal(g.groups.length, 4);
  assert.deepEqual(g.groups[0].indices, [0, 4]);
  assert.equal(g.groups[1].x - g.groups[0].x, 144);
  assert.equal(g.groups[3].x - g.groups[0].x, 432);
  assert.equal(pitchGeometry([127]).groups[0].x, 24);
  assert.deepEqual(pitchGeometry([]).groups, []);
});
test('Matrix spells compound intervals but shows signed half-step distances first', () => {
  const notes = [{name:'C3',midi:48}, {name:'E4',midi:64}];
  const html = intervalWorkspace(notes, defaultSettings(), [0,1]);
  assert.match(html, /\+16/); assert.match(html, /M10/);
  assert.match(html, /-16/); assert.match(html, /2\.5198/);
  assert.match(html, /data-interval-from="0" data-interval-to="1" tabindex="0"/);
  assert.match(intervalWorkspace([], defaultSettings()), /Select notes/);
});
test('Matrix selection is clamped and does not mutate notes or settings', () => {
  const notes = [{name:'A4',midi:69}], settings = defaultSettings();
  const before = JSON.stringify({notes,settings});
  const html = intervalWorkspace(notes, settings, [-2,99]);
  assert.match(html, /1\.0000/); assert.doesNotMatch(html, /NaN|undefined/);
  assert.equal(JSON.stringify({notes,settings}), before);
});

