import test from "node:test";
import assert from "node:assert/strict";
import {
  intervalBetween,
  recognize,
  maskFor,
  SCALE_DEFS,
  FIFTHS,
  frequency,
  compareRanks,
  spellPitch,
  parseNote,
} from "../src/theory.js";
import {
  example,
  editPosition,
  midiOf,
  clone,
  validateProject,
  importProject,
  defaultProject,
  createNote,
  emptyEvent,
  History,
  reconcileInstrument,
} from "../src/model.js";
import {
  generate,
  randomize,
  findVoicing,
  seededRandom,
} from "../src/generator.js";
import { playbackPlan } from "../src/audio.js";
test("Golden intervals retain spelling, direction and octaves", () => {
  for (const [a, b, label, semitones] of [
    ["C4", "E4", "M3", 4],
    ["C4", "Eb4", "m3", 3],
    ["E4", "C4", "M3", -4],
    ["B3", "C4", "m2", 1],
    ["C4", "C5", "P8", 12],
    ["C4", "E5", "M10", 16],
    ["C4", "Fb4", "d4", 4],
    ["C4", "F#4", "A4", 6],
    ["C4", "Gb4", "d5", 6],
    ["B#4", "C5", "d2", 0],
  ]) {
    assert.equal(intervalBetween(a, b).label, label);
    assert.equal(intervalBetween(a, b).semitones, semitones);
  }
});
test("Pitch and tuning fixtures; capo never counted twice", () => {
  const p = defaultProject();
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) =>
      midiOf(createNote(`s${i}`, 0), p.settings),
    ),
    [40, 45, 50, 55, 59, 64],
  );
  assert.equal(midiOf(createNote("s0", 12), p.settings), 52);
  p.settings.capo = 2;
  assert.equal(midiOf(createNote("s0", 2), p.settings), 42);
  assert.equal(midiOf(createNote("s0", 5), p.settings), 45);
  assert.equal(frequency(69), 440);
  const bass = example("bass");
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => bass.settings[`open${i}`]),
    [28, 33, 38, 43],
  );
});
test("Chord identity, inversion and ambiguity come from actual pitches", () => {
  for (const [midis, suffix, bass] of [
    [[60, 64, 67], "", 0],
    [[52, 55, 60], "", 4],
    [[60, 63, 67], "m", 0],
    [[60, 64, 67, 71], "maj7", 0],
    [[60, 64, 67, 70], "7", 0],
  ]) {
    const candidate = recognize(midis).find(
      (c) => c.root === 0 && c.suffix === suffix,
    );
    assert.ok(candidate?.exact);
    assert.equal(candidate.bass, bass);
  }
  assert.ok(recognize([60, 64, 67, 69]).filter((c) => c.exact).length >= 2);
  assert.ok(!recognize([60]).some((c) => c.exact));
});
test("Scale spelling is coherent, including leading tones and octaves", () => {
  const s = defaultProject().settings;
  s.tonic = 1;
  s.keyMask = maskFor(1, SCALE_DEFS[0].intervals);
  assert.equal(spellPitch(65, s), "F4");
  assert.equal(spellPitch(60, s), "C4");
  s.accidentals = "sharps";
  assert.equal(spellPitch(65, s), "E#4");
  assert.equal(spellPitch(60, s), "B#3");
  for (let tonic = 0; tonic < 12; tonic++)
    for (const scale of SCALE_DEFS) {
      s.tonic = tonic;
      s.keyMask = maskFor(tonic, scale.intervals);
      for (let midi = 24; midi <= 100; midi++)
        assert.equal(parseNote(spellPitch(midi, s)).midi, midi);
    }
});
test("Rank transitions compare real sounding pitch and retain extra notes", () => {
  const notes = (names) =>
    names.map((name, i) => ({
      name,
      midi: parseNote(name).midi,
      id: String(i),
    }));
  const result = compareRanks(
    notes(["G3", "C3", "E3"]),
    notes(["F3", "A3", "D3", "C4"]),
  );
  assert.deepEqual(
    result.map((r) => r.interval?.semitones),
    [2, 1, 2, undefined],
  );
  assert.equal(result[3].from, null);
  assert.equal(result[3].to.name, "C4");
  assert.equal(new Set(FIFTHS).size, 12);
  for (let i = 1; i < 12; i++)
    assert.equal((FIFTHS[i] - FIFTHS[i - 1] + 12) % 12, 7);
});
test("Editor toggles, one-string replacement, repeats and key isolation", () => {
  let p = defaultProject();
  p = editPosition(p, "s1", 3);
  p = editPosition(p, "s1", 5);
  assert.equal(p.events[0].notes.length, 1);
  assert.equal(p.events[0].notes[0].fret, 5);
  p = editPosition(p, "s1", 5);
  assert.equal(p.events[0].notes.length, 0);
  p.settings.editorMode = "melody";
  p.settings.append = true;
  p = editPosition(p, "s5", 5);
  p = editPosition(p, "s5", 5);
  assert.equal(p.events.filter((e) => e.kind === "melody").length, 2);
  const events = clone(p.events);
  const mask = p.settings.keyMask;
  p = editPosition(p, "s5", 5, true);
  assert.deepEqual(p.events, events);
  assert.equal(p.settings.keyMask, mask ^ (1 << 9));
});
test("All examples are valid and JSON round-trips preserve exact events and flags", () => {
  for (const name of ["progression", "compare", "melody", "bass"]) {
    const p = example(name);
    assert.deepEqual(importProject(JSON.stringify(p)), p);
    const plan = playbackPlan(p);
    assert.ok(plan.duration > 0);
  }
  const p = example();
  p.events[0].notes.push(clone(p.events[0].notes[0]));
  assert.throws(() => validateProject(p));
  assert.throws(() => importProject("{bad"));
});
test("Timing uses quarter-note tempo even in compound meter; chords are polyphonic", () => {
  const p = example();
  p.settings.tempo = 120;
  p.settings.meter = "6/8";
  p.events = p.events.slice(0, 1);
  p.events[0].duration = 288;
  const plan = playbackPlan(p);
  assert.equal(plan.duration, 1.5);
  assert.equal(plan.beatTicks, 144);
  assert.equal(plan.barTicks, 288);
  assert.equal(plan.events[0].notes.length, 5);
  assert.ok(plan.events[0].notes.every((n) => n.offset === 0));
  p.events[0].picking = "up";
  assert.deepEqual(
    playbackPlan(p).events[0].notes.map((n) => n.midi),
    [64, 60, 55, 52, 48],
  );
});
test("Generator property suite: 250 deterministic cases preserve fixed settings and playable chords", () => {
  for (let seed = 1; seed <= 250; seed++) {
    let p = example(seed % 3 === 0 ? "bass" : "progression");
    p.settings.seed = seed;
    p.settings.generationType =
      seed % 3 === 0 ? "melody" : seed % 2 ? "chord" : "progression";
    p.settings.eventCount = 4;
    p.settings.maxLeap = 24;
    const before = clone(p.settings);
    const out = generate(p);
    assert.deepEqual(out, generate(p));
    assert.deepEqual(out.settings, before);
    for (const event of out.events) {
      assert.equal(
        new Set(event.notes.map((n) => n.stringId)).size,
        event.notes.length,
      );
      if (event.kind === "chord")
        assert.ok(
          recognize(event.notes.map((n) => midiOf(n, out.settings))).some(
            (c) => c.exact,
          ),
        );
      for (const note of event.notes) {
        assert.ok(
          out.settings.keyMask & (1 << (midiOf(note, out.settings) % 12)),
        );
        assert.ok(note.fret <= out.settings.fretCount);
      }
    }
  }
});
test("Randomization is atomic, exact for unchecked settings, and rejects impossible protected dependencies", () => {
  const p = example();
  p.settings.enabled0 = false;
  for (let seed = 1; seed <= 100; seed++) {
    p.settings.seed = seed;
    const before = clone(p);
    try {
      const out = randomize(p).project;
      for (const key of Object.keys(p.settings))
        if (!p.randomize[key])
          assert.deepEqual(out.settings[key], p.settings[key]);
      assert.equal(out.settings.enabled0, false);
    } catch (e) {
      assert.match(e.message, /constraint|conflict|fits|next note|available/i);
    }
    assert.deepEqual(p, before);
  }
  const q = example();
  q.randomPattern = false;
  Object.keys(q.randomize).forEach((k) => (q.randomize[k] = false));
  q.randomize.open1 = true;
  assert.throws(() => randomize(q), /protected/);
  assert.equal(q.settings.open1, 45);
  const r = example();
  r.settings.keyMask = 0;
  assert.throws(() => generate(r), /No available/);
});
test("Instrument reconciliation and undo preserve previous data", () => {
  const p = example();
  const s = { ...p.settings, open1: 46 };
  const mapped = reconcileInstrument(p, s, "pitches");
  assert.deepEqual(
    mapped.events.flatMap((e) =>
      e.notes.map((n) => midiOf(n, mapped.settings)),
    ),
    p.events.flatMap((e) => e.notes.map((n) => midiOf(n, p.settings))),
  );
  const history = new History(p);
  history.commit(mapped);
  history.undo();
  assert.deepEqual(history.project, p);
  history.redo();
  assert.deepEqual(history.project, mapped);
  p.events[0].locked = true;
  assert.throws(() => reconcileInstrument(p, s, "positions"), /locked/);
});
test("Re-entrant tuning and generated fingerings use physical string identity", () => {
  const p = example();
  p.settings.open0 = 64;
  p.settings.open5 = 40;
  const shape = findVoicing([0, 4, 7], p.settings, seededRandom(22));
  assert.ok(shape);
  assert.equal(new Set(shape.map((n) => n.stringId)).size, shape.length);
});
