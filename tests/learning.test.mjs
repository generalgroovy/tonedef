import test from "node:test";
import assert from "node:assert/strict";
import { LEARNING_TOPICS, learningView, learningPitches } from "../src/learning.js";
import { SCALE_DEFS, maskFor, parseNote } from "../src/theory.js";

const settings = (tonic = 0, mode = 0) => ({
  tonic,
  keyMask: maskFor(tonic, SCALE_DEFS[mode].intervals),
  accidentals: "auto",
  tonicSpelling: "auto",
});
const pitches = (html) => [...html.matchAll(/data-learn-pitch="(\d+)"/g)].map((match) => Number(match[1]));
const degrees = (html) => [...html.matchAll(/data-learn-degree="([^"]+)"/g)].map((match) => match[1]);
const steps = (html) => [...html.matchAll(/data-half-steps="(\d+)"/g)].map((match) => Number(match[1]));

test("Four brief lessons provide semantic navigation and a playable task", () => {
  assert.deepEqual(LEARNING_TOPICS.map((topic) => topic.id), ["notes", "steps", "scales", "modes"]);
  for (const topic of LEARNING_TOPICS) {
    assert.ok(topic.prompt.length < 70);
    assert.ok(topic.explanation.length < 95);
    const html = learningView(settings(), topic.id);
    assert.match(html, new RegExp(`data-learn-topic="${topic.id}" aria-pressed="true"`));
    assert.equal([...html.matchAll(/data-learn-topic="[a-z]+" aria-pressed="true"/g)].length, 1);
    assert.match(html, /<summary>Info<\/summary>/);
    assert.match(html, /class="learning-task"/);
    assert.ok(!html.includes("MIDI"));
    assert.ok(pitches(html).length > 0);
  }
});

test("All seven modes use correct degree and half-step recipes including the final home", () => {
  const recipes = [
    ["1", "2", "3", "4", "5", "6", "7", "8"],
    ["1", "2", "♭3", "4", "5", "6", "♭7", "8"],
    ["1", "♭2", "♭3", "4", "5", "♭6", "♭7", "8"],
    ["1", "2", "3", "♯4", "5", "6", "7", "8"],
    ["1", "2", "3", "4", "5", "6", "♭7", "8"],
    ["1", "2", "♭3", "4", "5", "♭6", "♭7", "8"],
    ["1", "♭2", "♭3", "4", "♭5", "♭6", "♭7", "8"],
  ];
  const stepRecipes = [
    [2, 2, 1, 2, 2, 2, 1],
    [2, 1, 2, 2, 2, 1, 2],
    [1, 2, 2, 2, 1, 2, 2],
    [2, 2, 2, 1, 2, 2, 1],
    [2, 2, 1, 2, 2, 1, 2],
    [2, 1, 2, 2, 1, 2, 2],
    [1, 2, 2, 1, 2, 2, 2],
  ];
  for (let mode = 0; mode < 7; mode++) {
    const html = learningView(settings(0, mode), "modes");
    assert.deepEqual(degrees(html), recipes[mode]);
    assert.deepEqual(steps(html), stepRecipes[mode]);
    assert.deepEqual(pitches(html), [...SCALE_DEFS[mode].intervals, 12].map((interval) => 60 + interval));
    assert.match(html, new RegExp(`data-learn-scale="${mode}" aria-label="[^"]+" aria-pressed="true"`));
    assert.equal([...html.matchAll(/data-learn-scale="\d" aria-label="[^"]+" aria-pressed="true"/g)].length, 1);
    assert.match(html, />Home<\/small>/);
    assert.match(html, />Home ↑<\/small>/);
  }
});

test("Mode transposition keeps home fixed and spells each heard pitch coherently", () => {
  for (let tonic = 0; tonic < 12; tonic++) {
    for (let mode = 0; mode < 7; mode++) {
      const html = learningView(settings(tonic, mode), "modes");
      assert.deepEqual(pitches(html), [...SCALE_DEFS[mode].intervals, 12].map((interval) => 60 + tonic + interval));
      const names = [...html.matchAll(/aria-label="Play ([^"]+)"/g)].map((match) => {
        const [note, octave] = match[1].split(", octave ");
        return note.replaceAll(" sharp", "#").replaceAll(" flat", "b") + octave.split(",")[0];
      });
      assert.deepEqual(names.map((name) => parseNote(name).midi), pitches(html));
    }
  }
  const db = learningView(settings(1), "scales");
  assert.match(db, /D♭ · Home/);
  assert.match(db, /aria-label="Play D flat, octave 4, home"/);
  assert.match(db, /<strong>F<\/strong>/);
  const lowercase = learningView({ ...settings(1), tonicSpelling: "db" }, "scales");
  const unicode = learningView({ ...settings(1), tonicSpelling: "D♭" }, "scales");
  assert.equal(lowercase, db);
  assert.equal(unicode, db);
});

test("Steps teaches adjacent frets and the two-fret whole step without altering a scale", () => {
  const input = settings(4, 2);
  const before = structuredClone(input);
  const html = learningView(input, "steps");
  assert.deepEqual(input, before);
  assert.deepEqual(pitches(html), [64, 65, 66]);
  assert.deepEqual(steps(html), [1, 1]);
  assert.match(html, /2 frets are a whole step/);
  assert.match(html, /On one string: 1 fret is a half step/);
});

test("Topic controls appear once, with collection choice only where it helps", () => {
  const controls = {
    keyFields: '<label for="lesson-home">Home note</label><select id="lesson-home"></select>',
    collectionControl: '<label for="lesson-collection">Scale / mode</label><select id="lesson-collection"></select>',
  };
  const input = settings(0, 1), before = structuredClone(input);
  for (const topic of LEARNING_TOPICS.map((entry) => entry.id)) {
    const html = learningView(input, topic, controls);
    assert.ok(html.indexOf('class="learning-topics"') < html.indexOf('id="lesson-home"'), "Choose a topic before its settings");
    assert.equal([...html.matchAll(/id="lesson-home"/g)].length, 1);
    assert.equal([...html.matchAll(/id="lesson-collection"/g)].length, topic === "modes" ? 0 : 1);
    assert.ok(!html.includes('class="learning-context"'), "Controls do not repeat the same home or collection in a second row");
    if (topic === "notes" || topic === "steps") {
      assert.ok(html.indexOf('id="learning-info"') < html.indexOf('id="lesson-collection"'));
      assert.ok(!html.includes('id="learn-listen"'));
    } else {
      if (topic === "scales") assert.ok(html.indexOf('id="lesson-collection"') < html.indexOf('id="learning-info"'));
      assert.match(html, /id="learn-listen" data-action="learn-listen">Hear scale<\/button>/);
    }
    assert.deepEqual(input, before, "Changing lesson presentation never selects a different collection");
  }
  const custom = learningView({ ...input, keyMask: maskFor(0, [0, 1, 7]) }, "modes", controls);
  assert.match(custom, /class="learning-context"><span>Custom scale<\/span>/);
  assert.match(custom, /Choose a mode to compare/);
  assert.ok(!custom.includes('aria-pressed="true">Dorian'));
});

test("Mode comparisons name the changed notes and mark their exact degrees across roots", () => {
  const changedIndices = [[], [2, 6], [1, 2, 5, 6], [3], [6], [2, 5, 6], [1, 2, 4, 5, 6]];
  const cChanges = [
    "C major is the starting point.",
    "Compared with C major: E becomes E♭; B becomes B♭.",
    "Compared with C major: D becomes D♭; E becomes E♭; A becomes A♭; B becomes B♭.",
    "Compared with C major: F becomes F♯.",
    "Compared with C major: B becomes B♭.",
    "Compared with C major: E becomes E♭; A becomes A♭; B becomes B♭.",
    "Compared with C major: D becomes D♭; E becomes E♭; G becomes G♭; A becomes A♭; B becomes B♭.",
  ];
  for (let mode = 0; mode < 7; mode++) {
    assert.ok(learningView(settings(0, mode), "modes").includes(cChanges[mode]));
    for (let tonic = 0; tonic < 12; tonic++) {
      const input = settings(tonic, mode), before = structuredClone(input);
      const html = learningView(input, "modes");
      const marked = [...html.matchAll(/class="learning-pitch[^\"]* is-changed" id="learn-pitch-(\d+)"[^>]*aria-label="([^\"]+)"/g)];
      assert.deepEqual(marked.map((match) => Number(match[1])), changedIndices[mode]);
      for (const match of marked) assert.ok(match[2].endsWith(", changed from major"));
      assert.equal([...html.matchAll(/class="learning-explanation"/g)].length, 1);
      assert.deepEqual(input, before);
    }
  }
  assert.match(learningView(settings(1, 1), "modes"), /Compared with D♭ major: F becomes F♭; C becomes C♭\./);
  assert.match(learningView({ ...settings(6, 3), tonicSpelling: "F#" }, "modes"), /Compared with F♯ major: B becomes B♯\./);
  assert.match(learningView(settings(10, 1), "modes"), /Compared with B♭ major: D becomes D♭; A becomes A♭\./);
  assert.ok(!learningView(settings(0, 1), "scales").includes("is-changed"), "Comparison markers belong to the Modes task");
  assert.ok(!learningView(settings(0, 7), "modes").includes("is-changed"), "A pentatonic collection is not presented as one of the seven modes");
});

test("Lesson playback pitches match the displayed collection without changing the input", () => {
  const examples = [
    ...Array.from({ length: 12 }, (_, tonic) => Array.from({ length: 7 }, (_, mode) => settings(tonic, mode))).flat(),
    settings(0, 7),
    { ...settings(), keyMask: maskFor(0, [2, 7]) },
    { ...settings(), keyMask: 0 },
  ];
  for (const input of examples) {
    const before = structuredClone(input);
    for (const topic of LEARNING_TOPICS.map((entry) => entry.id)) {
      const expected = pitches(learningView(input, topic));
      assert.deepEqual(learningPitches(input, topic), expected);
      const altered = learningPitches(input, topic);
      altered.push(999);
      assert.deepEqual(learningPitches(input, topic), expected, "Each request returns independent playback data");
    }
    assert.deepEqual(input, before);
  }
  for (const topic of ["scales", "modes"]) {
    const empty = { ...settings(), keyMask: 0 };
    assert.deepEqual(learningPitches(empty, topic), []);
    assert.match(learningView(empty, topic), /id="learn-listen" data-action="learn-listen" disabled/);
  }
  assert.deepEqual(learningPitches(null), learningPitches(settings()));
  assert.deepEqual(learningPitches(settings(), "unknown"), learningPitches(settings(), "notes"));
});

test("Custom and non-modal collections are shown honestly rather than replaced by major", () => {
  const pentatonic = learningView(settings(0, 7), "modes");
  assert.equal([...pentatonic.matchAll(/data-learn-scale="\d" aria-label="[^"]+" aria-pressed="true"/g)].length, 0);
  assert.deepEqual(pitches(pentatonic), [60, 62, 64, 67, 69, 72]);
  assert.match(pentatonic, /Choose a mode to compare/);
  assert.deepEqual(degrees(pentatonic), ["1", "2", "3", "5", "6", "8"]);
  const noHome = learningView({ ...settings(), keyMask: maskFor(0, [2, 7]) }, "scales");
  assert.deepEqual(pitches(noHome), [62, 67]);
  assert.match(noHome, /Custom scale/);
  assert.match(noHome, /Play these notes, then try them in reverse/);
  const empty = learningView({ ...settings(), keyMask: 0 }, "scales");
  assert.deepEqual(pitches(empty), []);
  assert.match(empty, /Choose a scale to hear its notes/);
});

test("Malformed settings and topic text cannot inject HTML or attributes", () => {
  const hostile = '"><img src=x onerror="alert(1)">';
  const input = { tonic: hostile, tonicSpelling: hostile, accidentals: hostile, keyMask: hostile };
  const before = structuredClone(input);
  const html = learningView(input, hostile);
  assert.deepEqual(input, before);
  assert.equal(html, learningView(settings(), "notes"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("onerror"));
  assert.doesNotThrow(() => learningView(null));
  assert.doesNotThrow(() => learningView({ tonic: -1, tonicSpelling: "B#" }));
  // Content supplied by theory is escaped too, even if a later data source is unsafe.
  const original = SCALE_DEFS[0].name;
  try {
    SCALE_DEFS[0].name = 'Major <script> & "test"';
    const escaped = learningView(settings(), "modes");
    assert.ok(escaped.includes("Major &lt;script&gt; &amp; &quot;test&quot;"));
    assert.ok(!escaped.includes("<script>"));
  } finally {
    SCALE_DEFS[0].name = original;
  }
});
