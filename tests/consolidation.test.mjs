import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, example, createNote, emptyEvent, importProject, midiOf, clone, editPosition, History } from '../src/model.js';
import { generate, randomize } from '../src/generator.js';
import { practiceCard } from '../src/practice.js';

const melody = () => {
  const p = defaultProject();
  Object.assign(p.settings, { generationType: 'melody', eventCount: 8, repeatNotes: false });
  return p;
};

test('Contour search finds complete deterministic paths across seeds without changing settings', () => {
  for (const contour of ['ascending', 'descending', 'arch']) {
    for (let seed = 1; seed <= 100; seed++) {
      const p = melody();
      Object.assign(p.settings, { melodicContour: contour, seed, restRate: seed % 40 });
      const before = clone(p), result = generate(p);
      assert.deepEqual(p, before);
      assert.deepEqual(result, generate(p));
      assert.deepEqual(result.settings, p.settings);
      const notes = result.events.flatMap(e => e.notes.map(n => midiOf(n, p.settings)));
      const pivot = Math.floor(notes.length / 2);
      for (let i = 1; i < notes.length; i++) {
        const delta = notes[i] - notes[i - 1];
        const down = contour === 'descending' || (contour === 'arch' && i > pivot);
        assert.ok(down ? delta < 0 : delta > 0);
        assert.ok(Math.abs(delta) <= p.settings.maxLeap);
      }
    }
  }
});

test('Contour respects locked anchors and fails atomically for an impossible path', () => {
  const p = melody();
  Object.assign(p.settings, { melodicContour: 'ascending', eventCount: 5 });
  const locked = emptyEvent('melody', 96);
  locked.notes = [createNote('s5', 8)]; locked.locked = true;
  p.events = [emptyEvent('rest'), emptyEvent('rest'), locked];
  p.selectedId = locked.id;
  assert.deepEqual(generate(p).events[2], locked);
  Object.assign(p.settings, { lowPitch: 72, highPitch: 72, eventCount: 3 });
  const before = clone(p);
  assert.throws(() => generate(p), /No complete melody/);
  assert.deepEqual(p, before);
  p.settings.repeatNotes = true;
  assert.ok(generate(p).events.every(e => midiOf(e.notes[0], p.settings) === 72));
});

test('Contour permits an empty rest path, preserves locked rests, and uses sounding pitch with reentrant tuning', () => {
  const p = melody();
  Object.assign(p.settings, { melodicContour: 'descending', open0: 80, inKey: false, highPitch: 100 });
  const rest = emptyEvent('rest'); rest.locked = true;
  p.events = [rest]; p.selectedId = rest.id;
  const result = generate(p);
  assert.deepEqual(result.events[0], rest);
  const midis = result.events.flatMap(e => e.notes.map(n => midiOf(n, p.settings)));
  assert.ok(midis.every((m, i) => !i || m < midis[i - 1]));
  p.settings.eventCount = 1;
  assert.deepEqual(generate(p).events, [rest]);
});

test('Legacy v2 saves gain a fixed random contour while explicit invalid values still fail', () => {
  const p = example();
  delete p.settings.melodicContour; delete p.randomize.melodicContour;
  const migrated = importProject(JSON.stringify(p));
  assert.equal(migrated.settings.melodicContour, 'random');
  assert.equal(migrated.randomize.melodicContour, false);
  assert.deepEqual(migrated.events, p.events);
  p.settings.melodicContour = null;
  assert.throws(() => importProject(JSON.stringify(p)), /contour/i);
  p.settings.melodicContour = 'ascending'; p.randomize.melodicContour = 'false';
  assert.throws(() => importProject(JSON.stringify(p)), /randomization flag/);
});

test('Maximum-size contours stay playable and randomization keeps an unchecked contour fixed', () => {
  const p = melody();
  Object.assign(p.settings, { melodicContour: 'arch', eventCount: 64, stringCount: 12,
    fretCount: 36, fretMax: 36, inKey: false, lowPitch: 0, highPitch: 127, repeatNotes: true });
  for (let i = 0; i < 12; i++) p.settings[`open${i}`] = Math.min(91, i * 8);
  const result = generate(p);
  assert.equal(result.events.length, 64);
  assert.ok(result.events.every(e => e.notes[0].fret <= 36));
  const variant = randomize(p).project;
  assert.equal(variant.settings.melodicContour, 'arch');
  assert.equal(variant.randomize.melodicContour, false);
});

test('Editing generated music follows the selected event kind and undo restores the exact generated project', () => {
  const p = melody();
  const generated = generate(p);
  assert.equal(generated.settings.editorMode, 'chord'); // Fixed during generation.
  const history = new History(generated);
  history.commit(editPosition(generated, 's5', 12));
  assert.equal(history.project.settings.editorMode, 'melody');
  assert.equal(history.project.events.length, generated.events.length);
  assert.equal(history.project.events[0].notes.length, 1);
  assert.equal(history.project.events[0].notes[0].fret, 12);
  history.undo();
  assert.deepEqual(history.project, generated);
  const chord = example(); chord.settings.editorMode = 'melody'; chord.settings.append = false;
  const edited = editPosition(chord, 's5', 7);
  assert.equal(edited.settings.editorMode, 'chord');
  assert.equal(edited.events.length, chord.events.length);
  assert.equal(edited.events[0].notes.find(n => n.stringId === 's5').fret, 7);
});

test('Contour has no effect on arpeggio or chord generation and random retains the pre-consolidation fixture', () => {
  for (const type of ['chord', 'progression', 'arpeggio']) {
    const p = example(); p.settings.generationType = type;
    const expected = generate(p).events;
    p.settings.melodicContour = 'descending';
    assert.deepEqual(generate(p).events, expected);
  }
  const p = melody();
  const result = generate(p);
  assert.deepEqual(result.events.map(e => e.notes.map(n => [n.stringId, n.fret])),
    [[["s3", 2]], [["s3", 7]], [["s5", 1]], [["s3", 7]], [["s2", 7]], [["s1", 8]], [["s2", 2]], [["s4", 0]]]);
});

test('Practice card exports actual edited notes, rhythm, locks and tuning without mutating data or injecting Markdown', () => {
  const p = example('melody'); p.title = '# [unsafe](https://invalid)\n```\n<img src=x>';
  p.events[0].locked = true;
  p.events[1].kind = 'rest'; p.events[1].notes = [];
  const before = clone(p), card = practiceCard(p);
  assert.deepEqual(p, before);
  assert.ok(card.includes('One pass: 2.61 seconds; 8 events'));
  assert.ok(card.includes('| 1 | melody | A4 | 48 | free | yes |'));
  assert.ok(card.includes('| 2 | rest | — | 48 | free | no |'));
  assert.equal(card.split('\n').filter(line => line.startsWith('```')).length, 2);
  assert.ok(!card.includes('<img'));
  assert.ok(card.includes('JSON backup for re-import'));
});
