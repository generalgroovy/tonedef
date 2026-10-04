import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLayout, movePanel, chordSegments, PANELS} from '../src/layout.js';
test('stored layout rejects invalid IDs and bounds dimensions without losing panels', () => {
  const p = normalizeLayout({order:['timeline','bogus','timeline'],panels:{timeline:{span:100,height:-4},fretboard:{span:'8',hidden:'false'}}});
  assert.equal(p.order[0],'timeline'); assert.equal(new Set(p.order).size,PANELS.length);
  assert.equal(p.panels.timeline.span,12); assert.equal(p.panels.timeline.height,240);
  assert.equal(p.panels.fretboard.span,12); assert.equal(p.panels.fretboard.hidden,false);
  assert.deepEqual(normalizeLayout(null),normalizeLayout());
});
test('panel reordering retains each panel and has deterministic before/after semantics', () => {
  assert.deepEqual(movePanel(['a','b','c'],'a','c',true),['b','c','a']);
  assert.deepEqual(movePanel(['a','b','c'],'c','a'),['c','a','b']);
  assert.deepEqual(movePanel(['a','b'],'a','missing'),['a','b']);
});
test('seven-panel saved workspaces retain their arrangement when Exercise is introduced', () => {
  const oldOrder = ['timeline', 'fretboard', 'math', 'tools', 'inspector', 'transitions', 'settings'];
  const stored = {version: 1, order: oldOrder, panels: {
    fretboard: {span: 8, height: 480, hidden: false, collapsed: true},
    math: {span: 4, height: 320, hidden: true, collapsed: false},
  }};
  const before = structuredClone(stored);
  const migrated = normalizeLayout(stored);
  assert.equal(PANELS.length, 8);
  assert.deepEqual(migrated.order, [...oldOrder, 'exercise']);
  assert.deepEqual(migrated.panels.fretboard, stored.panels.fretboard);
  assert.deepEqual(migrated.panels.math, stored.panels.math);
  assert.equal(migrated.panels.exercise.hidden, false);
  assert.equal(migrated.panels.exercise.collapsed, false);
  assert.deepEqual(stored, before, 'migration does not mutate the stored arrangement');
  assert.deepEqual(normalizeLayout(migrated), migrated, 'repeated loading is stable');
});
test('saved layout contains every known panel exactly once and ignores obsolete panel preferences', () => {
  const migrated = normalizeLayout({order: ['exercise', 'exercise', 'removed-panel'], panels: {
    exercise: {span: 9, height: 410, hidden: true, collapsed: true},
    'removed-panel': {span: 8, hidden: true},
  }});
  assert.equal(migrated.order[0], 'exercise');
  assert.deepEqual(new Set(migrated.order), new Set(PANELS.map(([id]) => id)));
  assert.deepEqual(Object.keys(migrated.panels).sort(), PANELS.map(([id]) => id).sort());
  assert.deepEqual(migrated.panels.exercise, {span: 9, height: 410, hidden: true, collapsed: true});
});
test('chord connection follows physical order, marks skipped strings, never joins melody', () => {
  const strings = [{id:'high'},{id:'middle'},{id:'low'}];
  const event = {kind:'chord',notes:[{stringId:'low',fret:0},{stringId:'high',fret:3}]};
  const segments = chordSegments(event,strings);
  assert.equal(segments.length,1); assert.equal(segments[0].from.stringId,'high'); assert.equal(segments[0].skipped,true);
  event.notes.push({stringId:'middle',fret:7});
  assert.deepEqual(chordSegments(event,strings).map(s=>s.skipped),[false,false]);
  assert.deepEqual(chordSegments({...event,kind:'melody'},strings),[]);
});

test('Selected note ink remains readable for dark and light custom interval colors', async () => {
  const { selectedInk } = await import('../src/layout.js');
  assert.equal(selectedInk('#000000'),'#ffffff');
  assert.equal(selectedInk('#ffffff'),'#10151b');
});
