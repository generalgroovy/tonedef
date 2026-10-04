import test from 'node:test';
import assert from 'node:assert/strict';
import { intervalContext } from '../src/analysis-context.js';
import { defaultProject, emptyEvent, createNote } from '../src/model.js';

test('melody interval context follows selection, skips rests and preserves the musical project', () => {
  const p = defaultProject();
  p.events = Array.from({length: 8}, (_, i) => ({...emptyEvent('melody'), notes: [createNote('s0', i)]}));
  p.events.splice(3, 0, emptyEvent('rest'));
  p.selectedId = p.events[5].id;
  const before = structuredClone(p);
  assert.deepEqual(intervalContext(p).map(n => [n.eventIndex, n.midi]), [[5,43],[6,44],[7,45],[8,46]]);
  p.selectedId = p.events.at(-1).id;
  assert.deepEqual(intervalContext(p).map(n => n.eventIndex), [6,7,8,9]);
  p.selectedId = before.selectedId;
  assert.deepEqual(p, before);
});

test('chords retain their actual selected notes and an empty selection has no invented pitches', () => {
  const p = defaultProject(), e = emptyEvent('chord');
  e.notes = [createNote('s0',0), createNote('s1',2)]; p.events = [e]; p.selectedId = e.id;
  assert.deepEqual(intervalContext(p).map(n => n.midi), [40,47]);
  assert.ok(intervalContext(p).every(n => n.eventIndex === undefined));
  p.selectedId = null;
  assert.deepEqual(intervalContext(p), []);
});
