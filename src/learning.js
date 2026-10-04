import {
  SCALE_DEFS,
  currentScale,
  maskFor,
  mod,
  parseNote,
  pretty,
  spellPitch,
} from "./theory.js";

/** Short, playable lessons. Navigation and sound belong to the application. */
export const LEARNING_TOPICS = Object.freeze([
  {
    id: "notes",
    label: "Notes",
    prompt: "Tap a note. Find its name on the neck.",
    explanation: "Notes have names. The same name can sound higher or lower.",
  },
  {
    id: "steps",
    label: "Steps",
    prompt: "Tap home, then move one fret at a time.",
    explanation: "On one string: 1 fret is a half step. 2 frets are a whole step.",
  },
  {
    id: "scales",
    label: "Scales",
    prompt: "Play from home to the higher home, then back.",
    explanation: "A scale is a set of notes around a home note.",
  },
  {
    id: "modes",
    label: "Modes",
    prompt: "Keep home. Choose a mode. Listen for what changes.",
    explanation: "Each mode uses a different step recipe around the same home note.",
  },
].map(Object.freeze));

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const majorIntervals = SCALE_DEFS[0].intervals;
const chromaticDegrees = [
  "1", "♭2", "2", "♭3", "3", "4", "♯4 / ♭5", "5", "♭6", "6", "♭7", "7",
];
const modeNames = ["Major", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Minor", "Locrian"];

function safeSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  const tonic = Number.isInteger(source.tonic) ? mod(source.tonic) : 0;
  const spelling = typeof source.tonicSpelling === "string"
    ? parseNote(source.tonicSpelling)
    : null;
  return {
    tonic,
    tonicSpelling: spelling?.octave === null && spelling.pc === tonic
      ? source.tonicSpelling[0].toUpperCase() + source.tonicSpelling.slice(1).replaceAll("♯", "#").replaceAll("♭", "b")
      : "auto",
    keyMask: Number.isInteger(source.keyMask) && source.keyMask >= 0 && source.keyMask <= 4095
      ? source.keyMask
      : maskFor(tonic, majorIntervals),
    accidentals: ["auto", "sharps", "flats"].includes(source.accidentals)
      ? source.accidentals
      : "auto",
  };
}

function degreeLabel(interval, diatonic) {
  if (interval === 12) return "8";
  if (diatonic === undefined) return chromaticDegrees[interval];
  const alteration = interval - majorIntervals[diatonic];
  return `${alteration < 0 ? "♭".repeat(-alteration) : "♯".repeat(alteration)}${diatonic + 1}`;
}

function spokenName(name) {
  return name.replaceAll("#", " sharp").replaceAll("b", " flat")
    .replace(/(-?\d+)$/, ", octave $1");
}

function stepLabel(distance) {
  return distance === 1 ? "half step" : distance === 2 ? "whole step" : `${distance} half steps`;
}

function pitchStrip(intervals, scale, settings, topic) {
  const home = 60 + settings.tonic;
  return `<div class="learning-strip" role="group" aria-label="Tap notes to hear them">${intervals.map((interval, index) => {
    const midi = home + interval;
    const name = spellPitch(midi, settings);
    const isHome = interval === 0 || interval === 12;
    const degree = degreeLabel(interval, topic === "steps" ? undefined : scale?.degrees?.[index]);
    const caption = isHome
      ? interval === 0 ? "Home" : "Home ↑"
      : topic === "notes" ? "" : topic === "steps" ? `+${interval} ${interval === 1 ? "fret" : "frets"}` : degree;
    const accessible = `Play ${spokenName(name)}${isHome ? interval === 0 ? ", home" : ", higher home" : topic === "scales" || topic === "modes" ? `, degree ${degree.replaceAll("♭", "flat ").replaceAll("♯", "sharp ")}` : ""}`;
    const distance = index > 0 ? interval - intervals[index - 1] : 0;
    const bridge = index > 0 && topic !== "notes"
      ? `<span class="learning-step" data-half-steps="${distance}">${esc(stepLabel(distance))}</span>`
      : "";
    return `${bridge}<button type="button" class="learning-pitch${isHome ? " is-home" : ""}" id="learn-pitch-${index}" data-learn-pitch="${midi}" data-learn-degree="${esc(degree)}" aria-label="${esc(accessible)}"><strong>${esc(pretty(name.replace(/-?\d+$/, "")))}</strong>${caption ? `<small>${esc(caption)}</small>` : ""}</button>`;
  }).join("")}</div>`;
}

function info(topic, scale) {
  const definitions = {
    notes: "A sharp (♯) raises a note by one half step. A flat (♭) lowers it by one half step. An octave repeats a note name at a higher or lower pitch.",
    steps: "A half step is also called a semitone. A whole step is two half steps. Count frets along one string; changing strings also changes the open note.",
    scales: "Home is also called the tonic. A degree is a note’s place in a scale, counted from home. The step labels show distances between neighbouring notes.",
    modes: "These are the seven modes of the major scale. Here they share a home note, so their note collections differ. Major is also called Ionian; natural minor is also called Aeolian. Sharing one collection with different home notes is another way to relate them.",
  };
  const modeRecipes = topic === "modes"
    ? `<dl class="learning-mode-recipes">${SCALE_DEFS.slice(0, 7).map((mode) => `<div><dt>${esc(mode.name)}</dt><dd>${mode.intervals.map((interval, index) => esc(degreeLabel(interval, mode.degrees[index]))).join(" · ")}</dd></div>`).join("")}</dl><p>In these recipes, ♭ lowers a major-scale degree by a half step; ♯ raises it by a half step.</p>`
    : "";
  const specialScale = topic === "scales" && scale?.name === "Melodic minor (ascending)"
    ? "<p>This view keeps the ascending melodic-minor collection in both directions. Classical melodic minor commonly uses natural minor when descending.</p>"
    : "";
  return `<details class="learning-info" id="learning-info"><summary>Info</summary><p>${esc(definitions[topic])}</p>${specialScale}${modeRecipes}</details>`;
}

/** Returns escaped lesson HTML; no mutation, playback or project edits. */
export function learningView(input, topic = "notes") {
  const lesson = LEARNING_TOPICS.find((entry) => entry.id === topic) || LEARNING_TOPICS[0];
  const settings = safeSettings(input);
  const scale = currentScale(settings.tonic, settings.keyMask);
  const modeIndex = SCALE_DEFS.slice(0, 7).indexOf(scale);
  const homeName = pretty(spellPitch(60 + settings.tonic, settings).replace(/-?\d+$/, ""));
  const collection = scale?.intervals ?? Array.from({ length: 12 }, (_, interval) => interval)
    .filter((interval) => settings.keyMask & (1 << mod(settings.tonic + interval)));
  const intervals = lesson.id === "steps" ? [0, 1, 2] : [...collection, ...(collection.includes(0) ? [12] : [])];
  const topics = `<div class="learning-topics" role="group" aria-label="Learn guitar theory">${LEARNING_TOPICS.map((entry) => `<button type="button" id="learn-topic-${entry.id}" data-learn-topic="${entry.id}" aria-pressed="${lesson.id === entry.id}">${esc(entry.label)}</button>`).join("")}</div>`;
  const modes = lesson.id === "modes"
    ? `<div class="learning-modes" role="group" aria-label="Compare modes with the same home note">${SCALE_DEFS.slice(0, 7).map((mode, index) => `<button type="button" id="learn-scale-${index}" data-learn-scale="${index}" aria-label="${esc(mode.name)}" aria-pressed="${modeIndex === index}">${esc(modeNames[index])}</button>`).join("")}</div>${modeIndex < 0 ? '<p class="learning-hint">Choose a mode to compare it with this scale.</p>' : ""}`
    : "";
  const strip = intervals.length
    ? pitchStrip(intervals, scale, settings, lesson.id)
    : '<p class="learning-empty">Choose a scale to hear its notes.</p>';
  return `${topics}<p class="learning-task">${esc(lesson.prompt)}</p><p class="learning-explanation">${esc(lesson.explanation)}</p>${modes}<p class="learning-context"><strong>${esc(homeName)} · Home</strong>${lesson.id !== "steps" ? ` <span>${esc(scale?.name ?? "Custom scale")}</span>` : ""}</p>${strip}${lesson.id === "steps" ? '<p class="learning-hint">Home → last note: 2 frets · whole step.</p>' : ""}${info(lesson.id, scale)}`;
}
