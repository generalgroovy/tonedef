import { clone, validateProject } from "./model.js";

// Rhythms are explicit ticks at 96 PPQ, independent of the editor's note length.
// Frozen catalogue objects cannot be changed by a control renderer or a caller.
const catalogue = rows => Object.freeze(rows.map(row => Object.freeze({
  ...row,
  ...(row.durations ? { durations: Object.freeze(row.durations) } : {}),
  ...(row.settings ? { settings: Object.freeze(row.settings) } : {}),
})));

export const SEQUENCE_PATTERNS = catalogue([
  { id: "free", label: "Free melody", description: "Choose any legal pitches within the contour and leap limits." },
  { id: "steps", label: "Scale steps", description: "1–2–3–4… through the key collection; chromatic steps when key tones are off." },
  { id: "thirds", label: "Thirds / skip-one pairs", description: "1–3, 2–4, 3–5… through the collection. A custom collection can produce other interval sizes." },
  { id: "groups3", label: "Groups of 3", description: "1–2–3, 2–3–4, 3–4–5… through the collection." },
  { id: "groups4", label: "Groups of 4", description: "1–2–3–4, 2–3–4–5… through the collection." },
]);

export const RHYTHM_PATTERNS = catalogue([
  { id: "steady", label: "Even notes", description: "Every new event uses the selected note length.", durations: null },
  { id: "eighth-quarter", label: "Eighth + quarter", description: "Alternate an eighth and a quarter note: 48, 96 ticks.", durations: [48, 96] },
  { id: "triplets", label: "Eighth-note triplets", description: "Three equal notes per quarter-note beat: 32, 32, 32 ticks.", durations: [32, 32, 32] },
  { id: "syncopated", label: "Dotted pulse", description: "Dotted eighth, sixteenth, eighth, eighth: 72, 24, 48, 48 ticks. Locks or rests can change the resulting accents.", durations: [72, 24, 48, 48] },
]);

export function generatedDuration(settings, eventIndex) {
  const rhythm = RHYTHM_PATTERNS.find(pattern => pattern.id === settings.rhythmPattern);
  if (!rhythm) throw Error("Generated rhythm is not a supported value.");
  return rhythm.durations ? rhythm.durations[eventIndex % rhythm.durations.length] : settings.duration;
}

const melodic = {
  generationType: "melody", editorMode: "melody", append: false,
  inKey: true, repeatNotes: false, restRate: 0, picking: "alternate",
  maxLeap: 12, tempo: 80, duration: 48,
};

export const EXERCISE_RECIPES = catalogue([
  { id: "scale-walk", label: "Scale walk", description: "Eight ascending collection steps with even eighth notes.",
    settings: { ...melodic, eventCount: 8, sequencePattern: "steps", melodicContour: "ascending", rhythmPattern: "steady" } },
  { id: "thirds", label: "Thirds study", description: "Overlapping skip-one pairs, then vary the key or direction.",
    settings: { ...melodic, eventCount: 12, sequencePattern: "thirds", melodicContour: "ascending", rhythmPattern: "steady" } },
  { id: "triplet-groups", label: "Triplet groups", description: "Three-note melodic groups over three equal notes per beat.",
    settings: { ...melodic, eventCount: 12, sequencePattern: "groups3", melodicContour: "ascending", rhythmPattern: "triplets" } },
  { id: "four-note-groups", label: "Four-note groups", description: "Overlapping four-note groups in even sixteenth notes.",
    settings: { ...melodic, eventCount: 16, sequencePattern: "groups4", melodicContour: "ascending", rhythmPattern: "steady", duration: 24 } },
  { id: "chord-pulse", label: "Chord pulse", description: "Four triad voicings, one quarter note each, for chord changes.",
    settings: { generationType: "progression", editorMode: "chord", append: false, eventCount: 4,
      sequencePattern: "free", melodicContour: "random", rhythmPattern: "steady", duration: 96,
      chordVocabulary: "triads", inKey: true, restRate: 0, picking: "down", tempo: 72 } },
  { id: "syncopated-line", label: "Dotted line", description: "A free melody over a dotted-eighth/sixteenth pulse.",
    settings: { ...melodic, eventCount: 16, sequencePattern: "free", melodicContour: "random", rhythmPattern: "syncopated", maxLeap: 5 } },
]);

/** Configure an exercise without generating, replacing music, or changing the instrument. */
export function applyExerciseRecipe(project, id) {
  validateProject(project);
  const recipe = EXERCISE_RECIPES.find(candidate => candidate.id === id);
  if (!recipe) throw Error("Choose a supported exercise recipe. Nothing changed.");
  const next = clone(project);
  Object.assign(next.settings, recipe.settings);
  return validateProject(next);
}
