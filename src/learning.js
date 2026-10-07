import {
  SCALE_DEFS,
  currentScale,
  maskFor,
  mod,
  parseNote,
  pretty,
  spellPitch,
  intervalBetween,
  recognize,
  chordLabel,
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
    id: "intervals",
    label: "Intervals",
    prompt: "Tap two notes. Listen to the distance between them.",
    explanation: "An interval names the distance from one note to another.",
  },
  {
    id: "chords",
    label: "Chords",
    prompt: "Choose a root. Hear its root, third and fifth.",
    explanation: "A triad stacks every other note of a seven-note scale.",
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

function lessonIntervals(settings, topic) {
  if (topic === "steps") return [0, 1, 2];
  const scale = currentScale(settings.tonic, settings.keyMask);
  const collection = scale?.intervals ?? Array.from({ length: 12 }, (_, interval) => interval)
    .filter((interval) => settings.keyMask & (1 << mod(settings.tonic + interval)));
  return [...collection, ...(collection.includes(0) ? [12] : [])];
}

/** The displayed pitches, in order. Audition callers must not replace project notes. */
export function learningPitches(input, topic = "notes", degree = 0) {
  const settings = safeSettings(input);
  if (topic === "chords") return learningTriad(settings, degree)?.pitches ?? [];
  return lessonIntervals(settings, topic).map((interval) => 60 + settings.tonic + interval);
}

/** Diatonic root-position triads, with the octave carried across the scale boundary. */
export function learningTriad(input, degree = 0) {
  const settings = safeSettings(input), scale = currentScale(settings.tonic, settings.keyMask);
  if (scale?.intervals.length !== 7 || scale.degrees?.some((d, i) => d !== i)) return null;
  const root = Number.isInteger(degree) && degree >= 0 && degree < 7 ? degree : 0;
  const pitches = [0, 2, 4].map(offset => {
    const index = root + offset;
    return 60 + settings.tonic + scale.intervals[index % 7] + 12 * Math.floor(index / 7);
  });
  const names = pitches.map(midi => spellPitch(midi, settings));
  const chord = recognize(pitches).find(c => c.exact && c.root === mod(pitches[0]));
  return { pitches, names, root, quality: chord?.name ?? 'triad',
    label: chord ? pretty(chordLabel(chord, settings)) : names.map(pretty).join(' · '),
    intervals: names.map(name => intervalBetween(names[0], name)),
  };
}

export function intervalWords(interval) {
  const quality = { P: 'Perfect', M: 'Major', m: 'Minor', A: 'Augmented', d: 'Diminished' }[interval.quality]
    ?? `${interval.quality.length}× ${interval.quality[0] === 'A' ? 'augmented' : 'diminished'}`;
  const ordinal = ['unison', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'octave', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth'][interval.number - 1]
    ?? `${interval.number}${[11,12,13].includes(interval.number % 100) ? 'th' : ({1:'st',2:'nd',3:'rd'}[interval.number % 10] ?? 'th')}`;
  return `${quality} ${ordinal}`;
}

/** Explain an actual attack, never a guessed scale or a rounded continuous bend. */
export function playedExplanation(input, topic, first, last) {
  const settings = safeSettings(input);
  const home = pretty(spellPitch(60 + settings.tonic, settings).replace(/-?\d+$/, ''));
  if (!Number.isInteger(first)) return { title: 'Your turn', text: topic === 'steps' || topic === 'intervals'
    ? 'Tap a starting note, then a second note. The first stays as your starting point.'
    : 'Tap a note on the neck or above it. Its name and place in the scale will appear here.' };
  const midi = Number.isInteger(last) ? last : first;
  const name = spellPitch(midi, settings), short = pretty(name.replace(/-?\d+$/, ''));
  if (['steps', 'intervals'].includes(topic)) {
    if (!Number.isInteger(last)) return { title: `${pretty(name)} · starting note`, text: 'Now tap another note. Try the next fret on the same string.' };
    const start = spellPitch(first, settings), interval = intervalBetween(start, name), distance = Math.abs(interval.semitones);
    return { title: `${pretty(start)} → ${pretty(name)}`, text: `${intervalWords(interval)} · ${distance === 0 ? 'same pitch' : `${interval.direction} ${distance} half ${distance === 1 ? 'step' : 'steps'}`}.${interval.number > 8 ? ' This includes more than an octave.' : ''} One fret on the same string is one half step.`, interval };
  }
  const scale = currentScale(settings.tonic, settings.keyMask), offset = mod(midi - settings.tonic);
  const index = scale?.intervals.indexOf(offset) ?? -1;
  const inKey = Boolean(settings.keyMask & (1 << mod(midi)));
  const degree = index >= 0 && scale.degrees ? degreeLabel(offset, scale.degrees[index]) : null;
  const relation = offset === 0 ? `${short} is home${inKey ? '' : ', currently outside your collection'}.`
    : inKey ? `${short} is ${degree ? `degree ${degree}` : 'a note'} in ${home} ${scale?.name ?? 'your custom scale'}.`
    : `${short} is outside this scale. It can add tension; try a nearby scale note and listen.`;
  return { title: pretty(name), text: `${relation}${topic === 'notes' ? ' The number after a note name tells you its octave.' : ''}` };
}

export function learningFeedback(input, topic, first = null, last = null) {
  const result = playedExplanation(input, topic, first, last), pair = ['steps', 'intervals'].includes(topic);
  return `<div class="learning-feedback" id="learning-feedback"><div role="status" aria-live="polite" aria-atomic="true"><strong>${esc(result.title)}</strong><p>${esc(result.text)}</p></div>${pair ? `<div class="learning-pair-actions"><button id="learn-pair-play" data-action="learn-pair-play" ${Number.isInteger(last) ? '' : 'disabled'}>Hear pair</button><button id="learn-pair-reset" data-action="learn-pair-reset" ${Number.isInteger(first) ? '' : 'disabled'}>New pair</button></div>` : ''}</div>`;
}

function modeChanges(scale, settings) {
  if (!SCALE_DEFS.slice(0, 7).includes(scale)) return [];
  const majorSettings = { ...settings, keyMask: maskFor(settings.tonic, majorIntervals) };
  return scale.intervals.flatMap((interval, index) => {
    const degree = scale.degrees[index];
    if (interval === majorIntervals[degree]) return [];
    const before = spellPitch(60 + settings.tonic + majorIntervals[degree], majorSettings);
    const after = spellPitch(60 + settings.tonic + interval, settings);
    return [{ index, before: pretty(before.replace(/-?\d+$/, "")), after: pretty(after.replace(/-?\d+$/, "")) }];
  });
}

function pitchStrip(intervals, scale, settings, topic) {
  const home = 60 + settings.tonic;
  const changed = new Set(topic === "modes" ? modeChanges(scale, settings).map((entry) => entry.index) : []);
  return `<div class="learning-strip" role="group" aria-label="Tap notes to hear them">${intervals.map((interval, index) => {
    const midi = home + interval;
    const name = spellPitch(midi, settings);
    const isHome = interval === 0 || interval === 12;
    const degree = degreeLabel(interval, topic === "steps" ? undefined : scale?.degrees?.[index]);
    const caption = isHome
      ? interval === 0 ? "Home" : "Home ↑"
      : topic === "notes" ? "" : topic === "steps" ? `+${interval} ${interval === 1 ? "fret" : "frets"}` : degree;
    const accessible = `Play ${spokenName(name)}${isHome ? interval === 0 ? ", home" : ", higher home" : topic === "scales" || topic === "modes" ? `, degree ${degree.replaceAll("♭", "flat ").replaceAll("♯", "sharp ")}` : ""}${changed.has(index) ? ", changed from major" : ""}`;
    const distance = index > 0 ? interval - intervals[index - 1] : 0;
    const bridge = index > 0 && topic !== "notes"
      ? `<span class="learning-step" data-half-steps="${distance}">${esc(stepLabel(distance))}</span>`
      : "";
    return `${bridge}<button type="button" class="learning-pitch${isHome ? " is-home" : ""}${changed.has(index) ? " is-changed" : ""}" id="learn-pitch-${index}" data-learn-pitch="${midi}" data-learn-degree="${esc(degree)}" aria-label="${esc(accessible)}"><strong>${esc(pretty(name.replace(/-?\d+$/, "")))}</strong>${caption ? `<small>${esc(caption)}</small>` : ""}</button>`;
  }).join("")}</div>`;
}

function info(topic, scale, collectionControl = "") {
  const definitions = {
    notes: "Each horizontal line is a string; string 1 is at the top. OPEN means no finger on a fret; with a capo, the capo acts as the open end. Moving one fret higher raises the sound one half step. A sharp (♯) raises a note by one half step; a flat (♭) lowers it. An octave repeats a note name at a higher or lower pitch.",
    steps: "A half step is also called a semitone. A whole step is two half steps. Count frets along one string; changing strings also changes the open note.",
    scales: "Home is also called the tonic. A degree is a note’s place in a scale, counted from home. The step labels show distances between neighbouring notes.",
    intervals: "Count letter names, including both ends, for the interval number: C–D–E is a third. Count half steps for its quality: C–E is a major third (4); C–E♭ is a minor third (3). The spelling matters: C–F♯ is an augmented fourth, C–G♭ a diminished fifth, both 6 half steps. Intervals beyond an octave are compound intervals. Studio → Intervals compares the exact written notes in your pattern.",
    chords: "The root names the chord; the third and fifth describe its sound. Major uses 0–4–7 half steps from the root, minor 0–3–7, diminished 0–3–6 and augmented 0–4–8. A chord’s root is not always the key’s home note. On a real guitar these notes may sit in different octaves or repeat. Studio recognises your actual voicing and compares chord motion.",
    modes: "These are the seven modes of the major scale. Here they share a home note, so their note collections differ. Major is also called Ionian; natural minor is also called Aeolian. Sharing one collection with different home notes is another way to relate them.",
  };
  const modeRecipes = topic === "modes"
    ? `<dl class="learning-mode-recipes">${SCALE_DEFS.slice(0, 7).map((mode) => `<div><dt>${esc(mode.name)}</dt><dd>${mode.intervals.map((interval, index) => esc(degreeLabel(interval, mode.degrees[index]))).join(" · ")}</dd></div>`).join("")}</dl><p>In these recipes, ♭ lowers a major-scale degree by a half step; ♯ raises it by a half step.</p>`
    : "";
  const specialScale = topic === "scales" && scale?.name === "Melodic minor (ascending)"
    ? "<p>This view keeps the ascending melodic-minor collection in both directions. Classical melodic minor commonly uses natural minor when descending.</p>"
    : "";
  return `<details class="learning-info" id="learning-info"><summary>Info</summary><p>${esc(definitions[topic])}</p>${collectionControl}${specialScale}${modeRecipes}</details>`;
}

/** Returns escaped lesson HTML. Optional controls are trusted application markup. */
export function learningView(input, topic = "notes", { keyFields = "", collectionControl = "", degree = 0, first = null, last = null } = {}) {
  const lesson = LEARNING_TOPICS.find((entry) => entry.id === topic) || LEARNING_TOPICS[0];
  const settings = safeSettings(input);
  const scale = currentScale(settings.tonic, settings.keyMask);
  const modeIndex = SCALE_DEFS.slice(0, 7).indexOf(scale);
  const homeName = pretty(spellPitch(60 + settings.tonic, settings).replace(/-?\d+$/, ""));
  const intervals = learningPitches(settings, lesson.id, degree).map((midi) => midi - 60 - settings.tonic);
  const topics = `<p class="learning-route">Start with Notes. Follow the path, or jump in.</p><div class="learning-topics" role="group" aria-label="Learn guitar theory">${LEARNING_TOPICS.map((entry, i) => `<button type="button" id="learn-topic-${entry.id}" data-learn-topic="${entry.id}" aria-pressed="${lesson.id === entry.id}"><span aria-hidden="true">${i + 1}</span>${esc(entry.label)}</button>`).join("")}</div>`;
  const modes = lesson.id === "modes"
    ? `<div class="learning-modes" role="group" aria-label="Compare modes with the same home note">${SCALE_DEFS.slice(0, 7).map((mode, index) => `<button type="button" id="learn-scale-${index}" data-learn-scale="${index}" aria-label="${esc(mode.name)}" aria-pressed="${modeIndex === index}">${esc(modeNames[index])}</button>`).join("")}</div>`
    : "";
  const visibleControls = keyFields + (["scales", "chords"].includes(lesson.id) ? collectionControl : "");
  const controls = visibleControls ? `<div class="simple-key-fields learning-controls">${visibleControls}</div>` : "";
  const context = [
    ...(!keyFields ? [`<strong>${esc(homeName)} · Home</strong>`] : []),
    ...(lesson.id !== "steps" && (lesson.id === "modes" ? modeIndex < 0 || !keyFields : !collectionControl)
      ? [`<span>${esc(scale?.name ?? "Custom scale")}</span>`] : []),
  ];
  const changes = modeChanges(scale, settings);
  const explanation = lesson.id !== "modes" ? lesson.explanation : modeIndex < 0
    ? "Choose a mode to compare it with this scale. Your pattern stays the same."
    : modeIndex === 0 ? `${homeName} major is the starting point. Other modes change some of its notes.`
    : `Compared with ${homeName} major: ${changes.map(({ before, after }) => `${before} becomes ${after}`).join("; ")}.`;
  const prompt = lesson.id === "scales" && intervals.length && !intervals.includes(0)
    ? "Play these notes, then try them in reverse."
    : lesson.prompt;
  const listen = ["scales", "modes", "chords"].includes(lesson.id)
    ? `<button type="button" id="learn-listen" data-action="learn-listen"${intervals.length ? "" : " disabled"}>${lesson.id === 'chords' ? 'Hear chord tones' : 'Hear scale'}</button>`
    : "";
  let strip = intervals.length
    ? pitchStrip(intervals, scale, settings, lesson.id)
    : '<p class="learning-empty">Choose a scale to hear its notes.</p>';
  let chord = '';
  if (lesson.id === 'chords') {
    const triad = learningTriad(settings, degree);
    if (triad) {
      chord = `<label class="learning-chord-root" for="learn-chord-root">Build on scale degree<select id="learn-chord-root">${scale.intervals.map((n, i) => `<option value="${i}" ${triad.root === i ? 'selected' : ''}>${i + 1} · ${esc(pretty(spellPitch(60 + settings.tonic + n, settings).replace(/-?\d+$/, '')))}</option>`).join('')}</select></label><p class="learning-chord"><strong>${esc(triad.label)}</strong> · ${esc(triad.quality)}<br><span>Root → third → fifth · ${triad.intervals.map(i => i.semitones).join('–')} half steps from its root</span></p>`;
      strip = `<div class="learning-strip" role="group" aria-label="Tap chord tones to hear them">${triad.names.map((name, i) => `<button type="button" class="learning-pitch${i === 0 ? ' is-home' : ''}" id="learn-pitch-${i}" data-learn-pitch="${triad.pitches[i]}" data-learn-degree="${[1,3,5][i]}" aria-label="Play ${esc(spokenName(name))}, ${['root','third','fifth'][i]}"><strong>${esc(pretty(name.replace(/-?\d+$/, '')))}</strong><small>${['Root','Third','Fifth'][i]}</small></button>`).join('')}</div>`;
    } else strip = '<p class="learning-empty">Choose a seven-note scale above to build triads. Your pattern stays the same.</p>';
  }
  const next = LEARNING_TOPICS[LEARNING_TOPICS.indexOf(lesson) + 1];
  return `${topics}${controls}<p class="learning-task">${esc(prompt)}</p><p class="learning-explanation">${esc(explanation)}</p>${modes}${context.length ? `<p class="learning-context">${context.join(" ")}</p>` : ""}${chord}${listen}${strip}${learningFeedback(settings, lesson.id, first, last)}${info(lesson.id, scale, ["notes", "steps", "intervals"].includes(lesson.id) ? collectionControl : "")}<div class="learning-next">${next ? `<button id="learn-next" data-learn-topic="${next.id}">Next: ${esc(next.label)} →</button>` : '<button data-workspace-mode="overview">Explore harmony in Studio →</button>'}</div>`;
}
