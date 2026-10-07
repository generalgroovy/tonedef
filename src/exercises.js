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
  { id: "first-notes", label: "First notes & pulse", description: "Four scale steps, one note per quarter-note beat, at 60 bpm.",
    settings: { ...melodic, eventCount: 4, sequencePattern: "steps", melodicContour: "ascending", rhythmPattern: "steady", tempo: 60, duration: 96 } },
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
  { id: "seventh-changes", label: "Seventh-chord changes", description: "Four seventh-chord voicings for harmony and economical movement.",
    settings: { generationType: "progression", editorMode: "chord", append: false, eventCount: 4,
      sequencePattern: "free", melodicContour: "random", rhythmPattern: "steady", duration: 192,
      chordVocabulary: "sevenths", inKey: true, restRate: 0, picking: "down", tempo: 60 } },
]);

export const PRACTICE_GOALS = Object.freeze({
  'first-notes': { group: 'Start here', aim: 'Find notes and keep a steady pulse.', cue: 'Say each note name, then play it. Leave the same space between notes.', stretch: 'Find the same pitches on another string. Can you do it without the labels?' },
  'scale-walk': { group: 'Start here', aim: 'Connect scale sounds to fretboard positions.', cue: 'Name the notes or degrees as you play. Hear where each half step falls.', stretch: 'Reverse the direction, then change home note. A scale walk can start on any degree.' },
  thirds: { group: 'Build fluency', aim: 'Hear and play the intervals inside a scale.', cue: 'Play each skip-one pair evenly. In a seven-note scale, compare its major and minor thirds.', stretch: 'Use Intervals in Learn to name each jump. Pentatonic skip-one pairs are not all thirds.' },
  'chord-pulse': { group: 'Build fluency', aim: 'Change chords cleanly while hearing each voice.', cue: 'Prepare the next shape before the change. Listen to the lowest note separately.', stretch: 'Open Studio → Motion. Compare lowest to lowest, then the higher pitch ranks; these are not inferred independent voices.' },
  'triplet-groups': { group: 'Stretch your control', aim: 'Separate melodic groups from the beat.', cue: 'Count three equal notes per quarter-note beat: 1-trip-let, 2-trip-let.', stretch: 'Keep the pulse while changing the sequence to groups of four. Melody grouping and rhythm are independent.' },
  'four-note-groups': { group: 'Stretch your control', aim: 'Keep small groups even across string changes.', cue: 'Count 1-e-and-a. Practise even volume and clear string changes before increasing speed.', stretch: 'Change direction or use a narrow fret range. Vary picking in More choices.' },
  'syncopated-line': { group: 'Stretch your control', aim: 'Hold a steady pulse through unequal note lengths.', cue: 'Count sixteenths: attacks fall on 1, a, 2, and. Let the long notes last.', stretch: 'Add rests or change meter. Kept steps retain their original rhythm.' },
  'seventh-changes': { group: 'Stretch your control', aim: 'Hear chord quality and economical movement.', cue: 'Identify root, third and seventh. Listen for common tones between shapes.', stretch: 'In Studio, compare chord interpretations, inversions and ranked motion. Generated chords are a study, not a prescribed functional progression.' },
});

/** A goal survives tempo, length and direction changes, but never mislabels a different motif. */
export function matchingExercise(settings) {
  const keys = ['generationType', 'sequencePattern', 'rhythmPattern', 'inKey', 'restRate'];
  return EXERCISE_RECIPES.find(recipe => [...keys,
    ...(settings.rhythmPattern === 'steady' ? ['duration'] : []),
    ...(settings.generationType === 'progression' ? ['chordVocabulary'] : []),
  ].every(key => settings[key] === recipe.settings[key]));
}

/** Configure an exercise without generating, replacing music, or changing the instrument. */
export function applyExerciseRecipe(project, id) {
  validateProject(project);
  const recipe = EXERCISE_RECIPES.find(candidate => candidate.id === id);
  if (!recipe) throw Error("Choose a supported exercise recipe. Nothing changed.");
  const next = clone(project);
  Object.assign(next.settings, recipe.settings);
  return validateProject(next);
}
