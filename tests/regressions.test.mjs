import test from "node:test";
import assert from "node:assert/strict";
import { Player, playbackPlan } from "../src/audio.js";
import { example, clone, namedNotes, validateProject } from "../src/model.js";
import {
  spellChordPitch,
  recognize,
  intervalBetween,
  chordLabel,
  parseNote,
} from "../src/theory.js";
import { generate } from "../src/generator.js";
test("Borrowed minor chord spelling, inversion and intervals agree", () => {
  const p = example("compare"),
    notes = namedNotes(p.events[1], p.settings);
  assert.equal(notes[1].name, "Eb3");
  assert.equal(intervalBetween(notes[0].name, notes[1].name).label, "m3");
  const c = recognize([51, 55, 60]).find(
    (c) => c.root === 0 && c.suffix === "m",
  );
  assert.equal(chordLabel(c, p.settings), "Cm/Eb");
  for (const candidate of recognize([60, 63, 66, 69]).filter((c) => c.exact))
    for (const midi of [60, 63, 66, 69])
      assert.equal(
        parseNote(spellChordPitch(midi, candidate, p.settings)).midi,
        midi,
      );
});
test("Generated event IDs stay unique when protected events retain generated IDs", () => {
  let p = generate(example());
  p.events[1].locked = true;
  const event = clone(p.events[1]);
  p.events.reverse();
  p.selectedId = p.events[0].id;
  const result = generate(p);
  assert.deepEqual(
    result.events.find((e) => e.locked),
    event,
  );
  validateProject(result);
});
test("Malformed imported position identity and payloads are rejected", () => {
  for (const value of ["s01", "s-1", "s12", "hello", null, {}]) {
    const p = example();
    p.events[0].notes[0].stringId = value;
    assert.throws(() => validateProject(p));
  }
  for (const value of [null, {}, [], 1]) {
    const p = example();
    p.events[0].notes = [value];
    assert.throws(() => validateProject(p));
  }
});
class Context {
  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.destination = {};
    this.oscillators = [];
  }
  createOscillator() {
    const o = {
      frequency: {},
      connect() {
        return this;
      },
      disconnect() {},
      starts: [],
      stops: [],
      start(t) {
        this.starts.push(t);
      },
      stop(t) {
        this.stops.push(t);
      },
    };
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
      },
      connect() {
        return this;
      },
      disconnect() {},
    };
  }
}
test("Stop cancels a pending AudioContext resume and audition", async () => {
  const player = new Player();
  player.context = new Context();
  player.context.state = "suspended";
  let resolve;
  player.context.resume = () => new Promise((r) => (resolve = r));
  const pending = player.play(example());
  player.stop();
  resolve();
  await pending;
  assert.equal(player.running, false);
  assert.equal(player.timer, null);
  assert.equal(player.voices.size, 0);
  const audition = player.audition([60], example().settings);
  player.stop();
  resolve();
  await audition;
  assert.equal(player.voices.size, 0);
});
test("Audio scheduler schedules loop boundary in advance and Stop cancels every voice", async () => {
  const originalSet = globalThis.setInterval,
    originalClear = globalThis.clearInterval;
  let pump;
  globalThis.setInterval = (fn) => {
    pump = fn;
    return 7;
  };
  globalThis.clearInterval = () => {};
  try {
    const player = new Player();
    player.context = new Context();
    const p = example("melody");
    p.events = p.events.slice(0, 1);
    p.events[0].duration = 24;
    p.settings.tempo = 120;
    p.settings.waveform = "triangle";
    p.settings.loop = true;
    const length = playbackPlan(p).duration;
    await player.play(p);
    assert.equal(player.context.oscillators.length, 1);
    player.context.currentTime = 0.1;
    pump();
    assert.equal(player.context.oscillators.length, 2);
    assert.equal(player.context.oscillators[1].starts[0], 0.07 + length);
    assert.ok(
      player.context.oscillators[1].starts[0] > player.context.currentTime,
    );
    player.stop();
    assert.equal(player.running, false);
    assert.equal(player.voices.size, 0);
    assert.ok(
      player.context.oscillators.every((o) => o.stops.includes(undefined)),
    );
  } finally {
    globalThis.setInterval = originalSet;
    globalThis.clearInterval = originalClear;
  }
});
test("Zero-volume playback creates no oscillator", () => {
  const player = new Player();
  player.context = new Context();
  player.voice(60, 0, 0.5, 0);
  assert.equal(player.context.oscillators.length, 0);
});

test("Imported IDs cannot inject markup and compound beat numbering uses eighths", () => {
  const p = example();
  p.events[0].id = 'x" onclick="alert(1)';
  p.selectedId = p.events[0].id;
  assert.throws(() => validateProject(p));
  const q = example();
  q.settings.meter = "6/8";
  const plan = playbackPlan(q);
  assert.equal(plan.beatUnitTicks, 48);
  assert.equal(240 / plan.beatUnitTicks + 1, 6);
});
