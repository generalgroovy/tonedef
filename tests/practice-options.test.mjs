import test from "node:test";
import assert from "node:assert/strict";
import {
  clone, createNote, defaultProject, emptyEvent, History, importProject,
  midiOf, positionChoices, validateProject,
} from "../src/model.js";
import { defaultPracticeOptions, practiceGenerate, practiceOptionsProblem } from "../src/practice-options.js";
import { maskFor, mod, pcsFor, SCALE_DEFS } from "../src/theory.js";

const practice = () => {
  const project = defaultProject();
  Object.assign(project.settings, { generationType: "melody", editorMode: "melody", eventCount: 12, duration: 48 });
  return project;
};
const sounding = project => project.events.filter(event => event.notes.length);
const lock = (project, index, stringId, fret) => {
  while (project.events.length <= index) project.events.push(emptyEvent("rest"));
  const event = emptyEvent("melody", 173);
  event.notes = [createNote(stringId, fret)]; event.locked = true;
  project.events[index] = event; project.selectedId = event.id;
  return event;
};

test("practice options migrate only when absent and reject malformed explicit choices", () => {
  const legacy = practice(); delete legacy.practice;
  const before = clone(legacy);
  assert.equal(validateProject(legacy), legacy);
  assert.deepEqual(legacy, before);
  assert.deepEqual(importProject(JSON.stringify(legacy)).practice, defaultPracticeOptions());
  for (const options of [null, [], {}, { ...defaultPracticeOptions(), keyRandom: "yes" },
    { ...defaultPracticeOptions(), stringIds: [] }, { ...defaultPracticeOptions(), stringIds: ["s0", "s0"] },
    { ...defaultPracticeOptions(), stringIds: ["s12"] }, { ...defaultPracticeOptions(), notesPerString: 1.5 },
    { ...defaultPracticeOptions(), countMin: 10, countMax: 4 }]) {
    assert.ok(practiceOptionsProblem(options));
    assert.throws(() => importProject(JSON.stringify({ ...legacy, practice: options })));
  }
  assert.equal(practiceOptionsProblem(defaultPracticeOptions()), null);
});

test("fixed practice changes only the seed and notes, preserving tuning and old advanced randomization flags", () => {
  const project = practice();
  for (const key of Object.keys(project.randomize)) project.randomize[key] = true;
  Object.assign(project.settings, { capo: 2, fretMin: 2, fretMax: 9, leftHanded: true });
  project.practice.stringIds = ["s1", "s3"];
  const before = clone(project), result = practiceGenerate(project);
  assert.deepEqual(project, before);
  assert.deepEqual(result, practiceGenerate(project));
  assert.deepEqual(result.project.settings, { ...before.settings, seed: before.settings.seed + 1 });
  assert.deepEqual(result.project.randomize, before.randomize);
  assert.deepEqual(result.project.practice, before.practice);
  assert.deepEqual(result.changed, ["seed"]);
  assert.deepEqual(result.choices.stringIds, ["s1", "s3"]);
  const legal = new Set(positionChoices(result.project.settings).map(note => `${note.stringId}:${note.fret}`));
  assert.ok(sounding(result.project).every(event => event.notes.every(note =>
    result.choices.stringIds.includes(note.stringId) && legal.has(`${note.stringId}:${note.fret}`))));
  assert.deepEqual(practiceGenerate(result.project, { advanceSeed: false }).project, result.project);
  const history = new History(project); history.commit(result.project); history.undo();
  assert.deepEqual(history.project, before);
  project.settings.seed = 2147483646;
  assert.equal(practiceGenerate(project).project.settings.seed, 1);
});

test("notes per string counts sounding events, cycles physical order and preserves exact locked rests", () => {
  const project = practice();
  project.settings.maxLeap = 36;
  project.practice.stringIds = ["s3", "s1"];
  project.practice.notesPerString = 2;
  const rest = emptyEvent("rest", 77); rest.locked = true;
  project.events = [rest]; project.selectedId = rest.id;
  const result = practiceGenerate(project).project;
  assert.deepEqual(result.events[0], rest);
  assert.deepEqual(sounding(result).map(event => event.notes[0].stringId),
    ["s1", "s1", "s3", "s3", "s1", "s1", "s3", "s3", "s1", "s1", "s3"]);
  project.settings.restRate = 50;
  const sparse = practiceGenerate(project).project;
  assert.ok(sparse.events.some(event => event.kind === "rest"));
  sounding(sparse).forEach((event, index) => assert.equal(event.notes[0].stringId, ["s1", "s3"][Math.floor(index / 2) % 2]));
});

test("structured scale motifs use per-string domains without skipping unavailable collection degrees", () => {
  const project = practice();
  Object.assign(project.settings, { stringCount: 2, open0: 60, open1: 65, eventCount: 6,
    sequencePattern: "steps", melodicContour: "ascending", repeatNotes: false, maxLeap: 2 });
  project.settings.practiceRanges[0] = { min: 0, max: 4 };
  project.settings.practiceRanges[1] = { min: 0, max: 4 };
  Object.assign(project.practice, { stringIds: ["s0", "s1"], notesPerString: 3 });
  const anchor = lock(project, 0, "s0", 0);
  const result = practiceGenerate(project).project;
  assert.deepEqual(result.events[0], anchor);
  assert.deepEqual(sounding(result).map(event => midiOf(event.notes[0], result.settings)), [60, 62, 64, 65, 67, 69]);
  assert.deepEqual(sounding(result).map(event => event.notes[0].stringId), ["s0", "s0", "s0", "s1", "s1", "s1"]);
  project.settings.practiceRanges[0].max = 3;
  const before = clone(project);
  assert.throws(() => practiceGenerate(project), /No complete melody.*sequence/);
  assert.deepEqual(project, before);
});

test("complete-path solving finds future locked anchors across string changes for free and contour melodies", () => {
  for (const melodicContour of ["random", "ascending"]) for (let seed = 1; seed <= 30; seed++) {
    const project = practice();
    Object.assign(project.settings, { stringCount: 2, open0: 60, open1: 64, eventCount: 2,
      melodicContour, maxLeap: 2, seed });
    project.settings.practiceRanges[0] = { min: 0, max: 3 };
    project.settings.practiceRanges[1] = { min: 0, max: 0 };
    Object.assign(project.practice, { stringIds: ["s0", "s1"], notesPerString: 1 });
    const anchor = lock(project, 1, "s1", 0);
    const result = practiceGenerate(project).project;
    assert.deepEqual(result.events[1], anchor);
    assert.deepEqual(result.events.map(event => midiOf(event.notes[0], result.settings)), [62, 64]);
  }
});

test("locked notes outside pitch ranges remain exact but incompatible string order and lengths reject atomically", () => {
  const project = practice();
  Object.assign(project.settings, { eventCount: 3, lowPitch: 62, highPitch: 64, maxLeap: 2 });
  project.practice.stringIds = ["s4"];
  const anchor = lock(project, 0, "s4", 1);
  assert.deepEqual(practiceGenerate(project).project.events[0], anchor);
  project.practice.stringIds = ["s0", "s4"]; project.practice.notesPerString = 1;
  let before = clone(project);
  assert.throws(() => practiceGenerate(project), /Locked event 1.*notes-per-string/);
  assert.deepEqual(project, before);
  project.practice.notesPerString = 0; project.practice.stringIds = ["s0"];
  before = clone(project);
  assert.throws(() => practiceGenerate(project), /locked note.*unselected practice string/i);
  assert.deepEqual(project, before);
  project.practice.stringIds = ["s4"];
  lock(project, 4, "s4", 3);
  assert.throws(() => practiceGenerate(project), /remove a locked event/);
});

test("randomizing key keeps the collection shape; randomizing mode keeps a fixed tonic", () => {
  const project = practice();
  project.settings.tonic = 2;
  project.settings.tonicSpelling = "D";
  project.settings.keyMask = maskFor(2, SCALE_DEFS[1].intervals);
  project.practice.keyRandom = true;
  const keys = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    project.settings.seed = seed;
    const result = practiceGenerate(project).project;
    keys.add(result.settings.tonic);
    assert.deepEqual(pcsFor(result.settings.keyMask).map(pitch => mod(pitch - result.settings.tonic)).sort((a, b) => a - b), SCALE_DEFS[1].intervals);
    assert.equal(result.settings.eventCount, project.settings.eventCount);
    assert.equal(result.settings.tonicSpelling, result.settings.tonic === 2 ? "D" : "auto");
    assert.deepEqual(practiceGenerate(result, { advanceSeed: false }).project, result);
  }
  assert.ok(keys.size > 5);
  project.practice.keyRandom = false; project.practice.modeRandom = true;
  const modes = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    project.settings.seed = seed;
    const result = practiceGenerate(project).project;
    assert.equal(result.settings.tonic, 2); assert.equal(result.settings.tonicSpelling, "D");
    assert.ok(SCALE_DEFS.some(scale => maskFor(2, scale.intervals) === result.settings.keyMask));
    modes.add(result.settings.keyMask);
  }
  assert.ok(modes.size > 5);
});

test("bounded random count, string subsets and grouping preserve all other constraints and repeat by seed", () => {
  const project = practice();
  Object.assign(project.settings, { maxLeap: 36, enabled2: false });
  Object.assign(project.practice, { countRandom: true, countMin: 16, countMax: 24,
    stringIds: ["s0", "s1", "s2", "s4"], stringsRandom: true, stringsMin: 1, stringsMax: 3,
    notesPerStringRandom: true, notesPerStringMin: 1, notesPerStringMax: 3 });
  const counts = new Set(), groups = new Set(), subsets = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    project.settings.seed = seed;
    const before = clone(project), result = practiceGenerate(project);
    assert.deepEqual(result, practiceGenerate(project)); assert.deepEqual(project, before);
    const { eventCount, stringIds, notesPerString } = result.choices;
    assert.ok(eventCount >= 16 && eventCount <= 24);
    assert.ok(stringIds.length >= 1 && stringIds.length <= 3);
    assert.ok(!stringIds.includes("s2"));
    assert.ok(notesPerString >= 1 && notesPerString <= 3);
    assert.deepEqual(result.project.settings, { ...project.settings, seed: seed + 1, eventCount });
    assert.deepEqual(result.project.practice, project.practice);
    sounding(result.project).forEach((event, index) => assert.equal(event.notes[0].stringId,
      stringIds[Math.floor(index / notesPerString) % stringIds.length]));
    assert.deepEqual(practiceGenerate(result.project, { advanceSeed: false }), { ...result, changed: [] });
    counts.add(eventCount); groups.add(notesPerString); subsets.add(stringIds.join(","));
  }
  assert.ok(counts.size > 4); assert.equal(groups.size, 3); assert.ok(subsets.size > 3);
});

test("arpeggio grouping respects per-string domains and chord grouping rejects without altering music", () => {
  const project = practice();
  project.settings.generationType = "arpeggio"; project.settings.maxLeap = 36;
  Object.assign(project.practice, { stringIds: ["s0", "s1"], notesPerString: 3 });
  const result = practiceGenerate(project).project;
  assert.deepEqual(result.events.map(event => mod(midiOf(event.notes[0], result.settings))), [0, 4, 7, 0, 4, 7, 0, 4, 7, 0, 4, 7]);
  result.events.forEach((event, index) => assert.equal(event.notes[0].stringId, ["s0", "s1"][Math.floor(index / 3) % 2]));
  project.settings.generationType = "chord";
  const before = clone(project);
  assert.throws(() => practiceGenerate(project), /needs a melody or arpeggio/);
  assert.deepEqual(project, before);
  project.practice.notesPerString = 0; project.practice.stringIds = ["s0", "s1", "s2", "s3"];
  const chords = practiceGenerate(project).project;
  assert.ok(chords.events.every(event => event.notes.every(note => project.practice.stringIds.includes(note.stringId))));
});

test("impossible selections report bounded failures and do not mutate seed, flags, settings or events", () => {
  const project = practice();
  project.practice.stringIds = ["s11"];
  assert.throws(() => practiceGenerate(project), /enabled practice string/);
  project.practice.stringIds = ["s0"];
  Object.assign(project.practice, { stringsRandom: true, stringsMin: 2 });
  assert.throws(() => practiceGenerate(project), /random string minimum/);
  Object.assign(project.practice, { stringsRandom: false, countRandom: true, countMin: 2, countMax: 3 });
  Object.assign(project.settings, { repeatNotes: false, maxLeap: 0 });
  const before = clone(project);
  assert.throws(() => practiceGenerate(project), /32 bounded random choices.*Nothing changed/);
  assert.deepEqual(project, before);
});
