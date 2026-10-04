import test from "node:test";
import assert from "node:assert/strict";
import {
  clone, createNote, defaultProject, emptyEvent, example, importProject,
  midiOf, positionChoices, validateProject,
} from "../src/model.js";
import { generate, randomize } from "../src/generator.js";
import {
  applyExerciseRecipe, EXERCISE_RECIPES, generatedDuration,
  RHYTHM_PATTERNS, SEQUENCE_PATTERNS,
} from "../src/exercises.js";
import { playbackPlan } from "../src/audio.js";
import { practiceCard } from "../src/practice.js";

const pitchesOf = project => project.events.flatMap(event => event.notes.slice(0, 1)
  .map(note => midiOf(note, project.settings)));
const study = (sequencePattern = "steps", eventCount = 8) => {
  const p = defaultProject();
  Object.assign(p.settings, {
    generationType: "melody", stringCount: 1, open0: 60, fretCount: 24,
    fretMax: 24, lowPitch: 60, highPitch: 84, duration: 48,
    maxLeap: 12, repeatNotes: false, sequencePattern, melodicContour: "ascending", eventCount,
  });
  return p;
};
const anchor = (project, index, fret, duration = 96) => {
  while (project.events.length <= index) project.events.push(emptyEvent("rest"));
  const event = emptyEvent("melody", duration);
  event.notes = [createNote("s0", fret)]; event.locked = true;
  project.events[index] = event; project.selectedId = event.id;
  return event;
};

test("sequence motifs use musical collection positions and preserve deterministic locked anchors", () => {
  const fixtures = [
    ["steps", [60, 62, 64, 65, 67, 69, 71, 72]],
    ["thirds", [60, 64, 62, 65, 64, 67, 65, 69]],
    ["groups3", [60, 62, 64, 62, 64, 65, 64, 65]],
    ["groups4", [60, 62, 64, 65, 62, 64, 65, 67]],
  ];
  for (const [sequence, expected] of fixtures) {
    const p = study(sequence), locked = anchor(p, 0, 0, 144), before = clone(p);
    const result = generate(p);
    assert.deepEqual(pitchesOf(result), expected, sequence);
    assert.deepEqual(result.events[0], locked);
    assert.deepEqual(generate(p), result);
    assert.deepEqual(p, before);
    assert.deepEqual(result.settings, p.settings);
  }
});

test("descending and arch contours orient structured motifs, including chromatic collections", () => {
  const descending = study("thirds", 6);
  descending.settings.melodicContour = "descending";
  anchor(descending, 0, 12);
  assert.deepEqual(pitchesOf(generate(descending)), [72, 69, 71, 67, 69, 65]);
  const arch = study("steps", 8);
  arch.settings.melodicContour = "arch";
  anchor(arch, 0, 0);
  assert.deepEqual(pitchesOf(generate(arch)), [60, 62, 64, 65, 67, 65, 64, 62]);
  arch.settings.eventCount = 7;
  assert.deepEqual(pitchesOf(generate(arch)), [60, 62, 64, 65, 64, 62, 60]);
  const chromatic = study("groups3", 6);
  chromatic.settings.inKey = false;
  anchor(chromatic, 0, 0);
  assert.deepEqual(pitchesOf(generate(chromatic)), [60, 61, 62, 61, 62, 63]);
});

test("whole-phrase search finds the only viable future anchor across seeds and directions", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const p = study("steps", 8);
    Object.assign(p.settings, { melodicContour: "random", lowPitch: 60, highPitch: 72, seed });
    const locked = anchor(p, 7, 12);
    const result = generate(p);
    assert.deepEqual(pitchesOf(result), [60, 62, 64, 65, 67, 69, 71, 72]);
    assert.deepEqual(result.events[7], locked);
  }
});

test("unavailable collection degrees and incompatible anchors fail atomically instead of skipping notes", () => {
  const p = study("steps", 4);
  Object.assign(p.settings, { stringCount: 2, open1: 67, lowPitch: 60, highPitch: 72 });
  p.settings.practiceRanges[0] = { min: 0, max: 3 };
  p.settings.practiceRanges[1] = { min: 0, max: 5 };
  anchor(p, 0, 0);
  const before = clone(p);
  assert.throws(() => generate(p), /No complete melody.*sequence.*Nothing changed/);
  assert.deepEqual(p, before);
  const incompatible = study("steps", 5);
  anchor(incompatible, 0, 0); anchor(incompatible, 4, 12);
  assert.throws(() => generate(incompatible), /locked notes/);
  const leap = study("thirds", 4);
  leap.settings.maxLeap = 2;
  assert.throws(() => generate(leap), /leap\/range/);
});

test("rests retain the rhythm's event phase but do not consume a melodic collection step", () => {
  const p = study("steps", 5);
  p.settings.rhythmPattern = "eighth-quarter";
  anchor(p, 0, 0);
  const rest = emptyEvent("rest", 144); rest.locked = true;
  p.events.push(rest);
  const result = generate(p);
  assert.deepEqual(result.events[1], rest);
  assert.deepEqual(pitchesOf(result), [60, 62, 64, 65]);
  assert.deepEqual(result.events.map(event => event.duration), [96, 144, 48, 96, 48]);
  p.settings.eventCount = 1; p.events = [rest]; p.selectedId = rest.id;
  assert.deepEqual(generate(p).events, [rest]);
});

test("locked notes outside generation bounds remain exact anchors and locked boundary rests remain intact", () => {
  const p = study("steps", 5);
  Object.assign(p.settings, { lowPitch: 62, highPitch: 65 });
  p.settings.practiceRanges[0] = { min: 2, max: 5 };
  const first = emptyEvent("rest", 288); first.locked = true;
  const last = emptyEvent("rest", 24); last.locked = true;
  p.events = [first];
  const locked = anchor(p, 1, 0, 144);
  while (p.events.length < 4) p.events.push(emptyEvent("rest"));
  p.events.push(last);
  const result = generate(p);
  assert.deepEqual(pitchesOf(result), [60, 62, 64]);
  assert.deepEqual(result.events[0], first);
  assert.deepEqual(result.events[1], locked);
  assert.deepEqual(result.events[4], last);
  assert.deepEqual(result.settings.practiceRanges, p.settings.practiceRanges);
});

test("new rhythms use exact ticks for all generation types and preserve locked durations", () => {
  const fixtures = [
    ["steady", [144, 144, 144, 144, 144, 144]],
    ["eighth-quarter", [48, 96, 48, 96, 48, 96]],
    ["triplets", [32, 32, 32, 32, 32, 32]],
    ["syncopated", [72, 24, 48, 48, 72, 24]],
  ];
  for (const type of ["melody", "arpeggio", "chord", "progression"]) {
    for (const [rhythmPattern, durations] of fixtures) {
      const p = defaultProject();
      Object.assign(p.settings, { generationType: type, rhythmPattern, duration: 144, eventCount: 6, tempo: 120 });
      const result = generate(p);
      assert.deepEqual(result.events.map(event => event.duration), durations, `${type} ${rhythmPattern}`);
      assert.equal(playbackPlan(result).duration, durations.reduce((sum, ticks) => sum + ticks, 0) / 192);
      result.events[2].locked = true; result.events[2].duration = 173;
      assert.deepEqual(generate(result).events[2], result.events[2]);
    }
  }
  assert.throws(() => generatedDuration({ rhythmPattern: "unknown" }, 0), /not a supported/);
});

test("arpeggio regeneration recovers a feasible complete path instead of a greedy dead end", () => {
  const p = defaultProject();
  Object.assign(p.settings, { generationType: "arpeggio", eventCount: 6, duration: 144, tempo: 120 });
  const initial = generate(p);
  // Established seed output remains unchanged before introducing the anchor.
  assert.deepEqual(pitchesOf(initial), [60, 64, 67, 60, 64, 67]);
  initial.events[2].locked = true; initial.events[2].duration = 173;
  const before = clone(initial), result = generate(initial), pitches = pitchesOf(result);
  assert.deepEqual(result, generate(initial));
  assert.deepEqual(result.events[2], initial.events[2]);
  assert.deepEqual(initial, before);
  assert.deepEqual(pitches.map(pitch => pitch % 12), [0, 4, 7, 0, 4, 7]);
  assert.ok(pitches.every((pitch, index) => !index || Math.abs(pitch - pitches[index - 1]) <= 7));
});

test("free melodies honor future locked leaps and reject incompatible locked neighbors atomically", () => {
  const p = study("free", 2);
  Object.assign(p.settings, { melodicContour: "random", lowPitch: 60, highPitch: 72, maxLeap: 2, seed: 1731 });
  const locked = anchor(p, 1, 12);
  const result = generate(p);
  assert.deepEqual(pitchesOf(result), [71, 72]);
  assert.deepEqual(result.events[1], locked);
  anchor(p, 0, 0);
  const before = clone(p);
  assert.throws(() => generate(p), /No complete melody.*Nothing changed/);
  assert.deepEqual(p, before);
  const repeated = study("free", 2);
  repeated.settings.melodicContour = "random";
  anchor(repeated, 0, 0); anchor(repeated, 1, 0);
  assert.throws(() => generate(repeated), /repetition constraints/);
  repeated.settings.repeatNotes = true;
  assert.deepEqual(generate(repeated).events, repeated.events);
});

test("sequence mode affects melodies only and free/even defaults retain the saved seed fixture", () => {
  for (const generationType of ["arpeggio", "chord", "progression"]) {
    const p = defaultProject(); p.settings.generationType = generationType;
    const expected = generate(p).events;
    p.settings.sequencePattern = "thirds";
    assert.deepEqual(generate(p).events, expected);
  }
  const p = defaultProject();
  Object.assign(p.settings, { generationType: "melody", eventCount: 8, repeatNotes: false });
  assert.deepEqual(generate(p).events.map(event => event.notes.map(note => [note.stringId, note.fret])),
    [[["s3", 2]], [["s3", 7]], [["s5", 1]], [["s3", 7]], [["s2", 7]], [["s1", 8]], [["s2", 2]], [["s4", 0]]]);
});

test("structured generation intersects physical ranges, disabled strings, capo, key, pitch and leap bounds", () => {
  for (const sequencePattern of ["steps", "thirds", "groups3", "groups4"]) {
    for (let seed = 1; seed <= 20; seed++) {
      const p = defaultProject();
      Object.assign(p.settings, { generationType: "melody", sequencePattern, melodicContour: "random",
        eventCount: 8, seed, capo: 2, fretMin: 4, fretMax: 12, lowPitch: 48, highPitch: 76,
        maxLeap: 7, repeatNotes: false, enabled1: false, enabled4: false, open0: 64, open5: 40 });
      p.settings.practiceRanges = p.settings.practiceRanges.map((_, i) => ({ min: 3 + i % 2, max: 12 }));
      const pool = positionChoices(p.settings), before = clone(p), result = generate(p);
      assert.deepEqual(p, before);
      assert.deepEqual(result, generate(p));
      assert.deepEqual(result.settings.practiceRanges, p.settings.practiceRanges);
      result.events.forEach(event => event.notes.forEach(note => {
        assert.ok(pool.some(candidate => candidate.stringId === note.stringId && candidate.fret === note.fret));
      }));
      const pitches = pitchesOf(result);
      assert.ok(pitches.every((pitch, index) => !index || (Math.abs(pitch - pitches[index - 1]) <= 7 && pitch !== pitches[index - 1])));
    }
  }
});

test("legacy v1 and v2 projects migrate missing fields only and reject malformed explicit values", () => {
  const p = example("melody");
  delete p.settings.sequencePattern; delete p.settings.rhythmPattern;
  delete p.randomize.sequencePattern; delete p.randomize.rhythmPattern;
  for (const version of [1, 2]) {
    const loaded = importProject(JSON.stringify({ ...p, version }));
    assert.equal(loaded.settings.sequencePattern, "free");
    assert.equal(loaded.settings.rhythmPattern, "steady");
    assert.equal(loaded.randomize.sequencePattern, false);
    assert.equal(loaded.randomize.rhythmPattern, false);
    assert.deepEqual(loaded.events, p.events);
    assert.deepEqual(importProject(JSON.stringify(loaded)), loaded);
  }
  for (const id of ["sequencePattern", "rhythmPattern"]) {
    for (const invalid of [null, 1, "unsupported", {}]) {
      const bad = defaultProject(); bad.settings[id] = invalid;
      assert.throws(() => importProject(JSON.stringify(bad)), /not a supported value/);
    }
    const badFlag = defaultProject(); badFlag.randomize[id] = null;
    assert.throws(() => importProject(JSON.stringify(badFlag)), /randomization flag/);
  }
});

test("every recipe configures settings only, preserves exact existing work and can generate on the default instrument", () => {
  assert.equal(EXERCISE_RECIPES.length, 6);
  for (const recipe of EXERCISE_RECIPES) {
    const p = example("bass");
    p.events[0].locked = true; p.settings.practiceRanges[0] = { min: 3, max: 11 };
    p.settings.seed = 801; p.settings.tonic = 9; p.settings.keyMask = 1453;
    const before = clone(p), result = applyExerciseRecipe(p, recipe.id);
    assert.deepEqual(p, before);
    const expected = clone(p); Object.assign(expected.settings, recipe.settings);
    assert.deepEqual(result, expected);
    assert.deepEqual(result.events, p.events);
    assert.notEqual(result.events, p.events);
    assert.deepEqual(result.randomize, p.randomize);
    assert.equal(result.settings.seed, 801);
    assert.deepEqual(result.settings.practiceRanges, p.settings.practiceRanges);
    assert.equal(result.settings.stringCount, 4);
    assert.equal(result.settings.open0, 28);
    assert.equal(result.settings.tonic, 9);
    assert.equal(result.settings.keyMask, 1453);
    assert.ok(validateProject(generate(applyExerciseRecipe(defaultProject(), recipe.id))));
  }
  const p = example(), before = clone(p);
  assert.throws(() => applyExerciseRecipe(p, "invalid"), /Nothing changed/);
  assert.deepEqual(p, before);
});

test("randomized variants preserve fixed sequence and rhythm while changing only enabled values", () => {
  const p = applyExerciseRecipe(defaultProject(), "triplet-groups");
  for (let seed = 1; seed <= 30; seed++) {
    p.settings.seed = seed;
    const before = clone(p), result = randomize(p).project;
    assert.equal(result.settings.sequencePattern, "groups3");
    assert.equal(result.settings.rhythmPattern, "triplets");
    for (const id of Object.keys(p.settings)) {
      if (!p.randomize[id]) assert.deepEqual(result.settings[id], p.settings[id]);
    }
    assert.deepEqual(p, before);
  }
});

test("catalogues are immutable and practice cards record sequence, rhythm and exact event timing", () => {
  assert.throws(() => RHYTHM_PATTERNS.find(rhythm => rhythm.id === "triplets").durations.push(96), TypeError);
  assert.throws(() => { EXERCISE_RECIPES[0].settings.tempo = 240; }, TypeError);
  assert.deepEqual(SEQUENCE_PATTERNS.map(pattern => pattern.id), ["free", "steps", "thirds", "groups3", "groups4"]);
  const p = generate(applyExerciseRecipe(defaultProject(), "triplet-groups"));
  const card = practiceCard(p);
  assert.match(card, /sequence groups3; rhythm triplets/);
  assert.match(card, /\| 32 \| alternate \| no \|/);
});
