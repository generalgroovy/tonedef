import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, clone, importProject, positionChoices, emptyEvent, createNote, History, reconcileInstrument } from '../src/model.js';
import { generate, randomize } from '../src/generator.js';
import { changedRange, pointerFret, practiceRangesView } from '../src/practice-ranges.js';

test('every generation path and randomized variant respects per-string ranges without changing bounds', () => {
  const p = defaultProject();
  Object.assign(p.settings, { fretMax: 20, maxLeap: 36, eventCount: 12, restRate: 0 });
  p.settings.practiceRanges = p.settings.practiceRanges.map((r, i) => ({ min: 4 + i % 2, max: 10 + i % 2 }));
  for (const type of ['melody', 'arpeggio', 'chord', 'progression']) {
    p.settings.generationType = type;
    for (const contour of type === 'melody' ? ['random', 'ascending', 'descending', 'arch'] : ['random']) {
      p.settings.melodicContour = contour;
      for (let seed = 1; seed <= 30; seed++) {
        p.settings.seed = seed;
        for (const result of [generate(p), randomize(p).project]) {
          assert.deepEqual(result.settings.practiceRanges, p.settings.practiceRanges);
          for (const n of result.events.flatMap(e => e.notes)) {
            const r = p.settings.practiceRanges[Number(n.stringId.slice(1))];
            assert.ok(n.fret >= r.min && n.fret <= r.max, `${type} ${contour} seed ${seed}`);
          }
        }
      }
    }
  }
});
test('capo and open-string exception cannot bypass a range; pitch, key, disabled strings and physical frets still constrain it', () => {
  const p = defaultProject(), s = p.settings;
  Object.assign(s, { capo: 2, fretMin: 5, fretMax: 8, inKey: false, lowPitch: 0, highPitch: 127 });
  s.practiceRanges[0] = { min: 3, max: 7 };
  assert.deepEqual(positionChoices(s).filter(n => n.stringId === 's0').map(n => n.fret), [5, 6, 7]);
  s.practiceRanges[0].min = 2;
  assert.deepEqual(positionChoices(s).filter(n => n.stringId === 's0').map(n => n.fret), [2, 5, 6, 7]);
  s.enabled0 = false;
  assert.ok(!positionChoices(s).some(n => n.stringId === 's0'));
  // Instrument reconciliation remains able to find pitches outside generation bounds.
  assert.ok(positionChoices(s, true).some(n => n.stringId === 's0' && n.fret === 24));
  s.stringCount = 12; s.fretCount = 36; s.fretMax = 36;
  s.practiceRanges[11] = { min: 35, max: 36 };
  assert.deepEqual(positionChoices(s).filter(n => n.stringId === 's11').map(n => n.fret), [35, 36]);
});
test('old v1/v2 projects migrate only missing ranges; malformed explicit ranges fail without changing the current project', () => {
  const p = defaultProject(); delete p.settings.practiceRanges;
  for (const version of [1, 2]) {
    const result = importProject(JSON.stringify({ ...p, version }));
    assert.equal(result.settings.practiceRanges.length, 12);
    assert.deepEqual(result.settings.practiceRanges[0], { min: 0, max: 36 });
  }
  for (const invalid of [null, [], Array(12).fill({ min: 7, max: 2 }), Array(12).fill({ min: -1, max: 36 }), Array(12).fill({ min: 0, max: 37 }), Array(12).fill({ min: 0.5, max: 8 })]) {
    p.settings.practiceRanges = invalid;
    assert.throws(() => importProject(JSON.stringify(p)), /practice range/);
  }
});
test('impossible ranges fail atomically; manual and locked notes stay intact; physical ranges survive tuning/count changes', () => {
  const p = defaultProject(); p.settings.generationType = 'melody';
  const e = emptyEvent('melody'); e.notes = [createNote('s0', 1)]; e.locked = true;
  p.events = [e]; p.selectedId = e.id;
  p.settings.practiceRanges[0] = { min: 5, max: 8 };
  assert.deepEqual(generate(p).events[0], e);
  const next = clone(p); next.events = []; next.selectedId = null;
  next.settings.practiceRanges.forEach(r => { r.min = 35; r.max = 36; });
  const before = clone(next);
  assert.throws(() => generate(next), /No available notes/);
  assert.deepEqual(next, before);
  const s = clone(next.settings); s.stringCount = 4; s.open0 = 28;
  assert.deepEqual(reconcileInstrument(next, s).settings.practiceRanges, before.settings.practiceRanges);
  const history = new History(p); history.commit(next); history.undo(); assert.deepEqual(history.project, p);
  assert.deepEqual(importProject(JSON.stringify(p)), p);
});
test('direct manipulation clamps physical coordinates and preserves handedness, keyboard limits and ordered ranges', () => {
  const rect = { left: 100, width: 360 };
  assert.equal(pointerFret(150, rect, false), 5); assert.equal(pointerFret(150, rect, true), 31);
  assert.equal(pointerFret(-50, rect, false), 0); assert.equal(pointerFret(900, rect, false), 36);
  assert.deepEqual(changedRange({ min: 2, max: 8 }, 'min', 8), { min: 8, max: 8 });
  for (const value of [-1, 37, NaN, 2.5, 9]) assert.throws(() => changedRange({ min: 2, max: 8 }, 'min', value));
  const html = practiceRangesView(defaultProject().settings);
  assert.equal((html.match(/role="slider"/g) || []).length, 18); // Two ends plus a movable window per string.
  assert.equal((html.match(/type="number"/g) || []).length, 12);
});
