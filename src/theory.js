/** Pure twelve-tone theory. Absolute pitches use MIDI; middle C is C4 = 60. */
export const mod = (n, m = 12) => ((n % m) + m) % m;
export const SHARPS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export const FLATS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];
export const TONICS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
export const COLORS = [
  "#e9e6dc",
  "#be98ed",
  "#70d4e4",
  "#5b9dff",
  "#f17668",
  "#69c8b0",
  "#de8fcf",
  "#e5c06c",
  "#a7a5f4",
  "#eca868",
  "#95b9dd",
  "#ee9fae",
];
export const INTERVALS = [
  "P1",
  "m2",
  "M2",
  "m3",
  "M3",
  "P4",
  "A4 / d5",
  "P5",
  "m6",
  "M6",
  "m7",
  "M7",
];
export const DEGREES = [
  "1",
  "♭2",
  "2",
  "♭3",
  "3",
  "4",
  "♯4 / ♭5",
  "5",
  "♭6",
  "6",
  "♭7",
  "7",
];
export const SCALE_DEFS = [
  ["Major / Ionian", [0, 2, 4, 5, 7, 9, 11], [0, 1, 2, 3, 4, 5, 6]],
  ["Dorian", [0, 2, 3, 5, 7, 9, 10], [0, 1, 2, 3, 4, 5, 6]],
  ["Phrygian", [0, 1, 3, 5, 7, 8, 10], [0, 1, 2, 3, 4, 5, 6]],
  ["Lydian", [0, 2, 4, 6, 7, 9, 11], [0, 1, 2, 3, 4, 5, 6]],
  ["Mixolydian", [0, 2, 4, 5, 7, 9, 10], [0, 1, 2, 3, 4, 5, 6]],
  ["Natural minor / Aeolian", [0, 2, 3, 5, 7, 8, 10], [0, 1, 2, 3, 4, 5, 6]],
  ["Locrian", [0, 1, 3, 5, 6, 8, 10], [0, 1, 2, 3, 4, 5, 6]],
  ["Major pentatonic", [0, 2, 4, 7, 9], [0, 1, 2, 4, 5]],
  ["Minor pentatonic", [0, 3, 5, 7, 10], [0, 2, 3, 4, 6]],
  ["Blues", [0, 3, 5, 6, 7, 10], [0, 2, 3, 4, 4, 6]],
  ["Harmonic minor", [0, 2, 3, 5, 7, 8, 11], [0, 1, 2, 3, 4, 5, 6]],
  ["Melodic minor (ascending)", [0, 2, 3, 5, 7, 9, 11], [0, 1, 2, 3, 4, 5, 6]],
  ["Chromatic", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], null],
].map(([name, intervals, degrees]) => ({ name, intervals, degrees }));
export const CHORD_DEFS = [
  ["", "major", [0, 4, 7]],
  ["m", "minor", [0, 3, 7]],
  ["dim", "diminished", [0, 3, 6]],
  ["aug", "augmented", [0, 4, 8]],
  ["sus2", "suspended second", [0, 2, 7]],
  ["sus4", "suspended fourth", [0, 5, 7]],
  ["5", "power chord", [0, 7]],
  ["6", "major sixth", [0, 4, 7, 9]],
  ["m6", "minor sixth", [0, 3, 7, 9]],
  ["7", "dominant seventh", [0, 4, 7, 10]],
  ["maj7", "major seventh", [0, 4, 7, 11]],
  ["m7", "minor seventh", [0, 3, 7, 10]],
  ["m(maj7)", "minor major seventh", [0, 3, 7, 11]],
  ["m7b5", "half-diminished seventh", [0, 3, 6, 10]],
  ["dim7", "diminished seventh", [0, 3, 6, 9]],
  ["add9", "added ninth", [0, 2, 4, 7]],
  ["9", "dominant ninth", [0, 2, 4, 10], [7]],
  ["maj9", "major ninth", [0, 2, 4, 11], [7]],
  ["m9", "minor ninth", [0, 2, 3, 10], [7]],
  ["11", "dominant eleventh", [0, 2, 4, 5, 10], [7]],
  ["m11", "minor eleventh", [0, 2, 3, 5, 10], [7]],
  ["13", "dominant thirteenth", [0, 4, 9, 10], [2, 5, 7]],
  ["maj13", "major thirteenth", [0, 4, 9, 11], [2, 5, 7]],
  ["m13", "minor thirteenth", [0, 3, 9, 10], [2, 5, 7]],
].map(([suffix, name, required, optional = []]) => ({
  suffix,
  name,
  required,
  optional,
}));
export function parseNote(text) {
  const match = /^([A-Ga-g])([#b]{0,2})(-?\d+)?$/.exec(
    String(text).replaceAll("♯", "#").replaceAll("♭", "b"),
  );
  if (!match) return null;
  const letter = LETTERS.indexOf(match[1].toUpperCase());
  const alteration = [...match[2]].reduce(
    (n, c) => n + (c === "#" ? 1 : -1),
    0,
  );
  const octave = match[3] === undefined ? null : Number(match[3]);
  return {
    letter,
    alteration,
    octave,
    pc: mod(NATURALS[letter] + alteration),
    midi:
      octave === null
        ? null
        : 12 * (octave + 1) + NATURALS[letter] + alteration,
  };
}
export function pitchName(midi, flats = false) {
  return (flats ? FLATS : SHARPS)[mod(midi)] + (Math.floor(midi / 12) - 1);
}
export const pretty = (text) =>
  String(text).replaceAll("#", "♯").replaceAll("b", "♭");
export const maskFor = (tonic, intervals) =>
  intervals.reduce((mask, i) => mask | (1 << mod(tonic + i)), 0);
export const pcsFor = (mask) =>
  Array.from({ length: 12 }, (_, pc) => pc).filter((pc) => mask & (1 << pc));
export function currentScale(tonic, mask) {
  return SCALE_DEFS.find((s) => maskFor(tonic, s.intervals) === mask);
}
export function tonicName(settings) {
  if (settings.tonicSpelling && settings.tonicSpelling !== "auto")
    return settings.tonicSpelling;
  return (
    settings.accidentals === "sharps"
      ? SHARPS
      : settings.accidentals === "flats"
        ? FLATS
        : TONICS
  )[settings.tonic];
}
export function spellPitch(midi, settings, override) {
  if (override && parseNote(override)?.midi === midi) return override;
  const tonic = tonicName(settings),
    scale = currentScale(settings.tonic, settings.keyMask);
  const interval = mod(midi - settings.tonic);
  const index = scale?.intervals.indexOf(interval) ?? -1;
  if (index >= 0 && scale.degrees) {
    const letter = mod(LETTERS.indexOf(tonic[0]) + scale.degrees[index], 7);
    let alteration = mod(mod(midi) - NATURALS[letter] + 6) - 6;
    const name =
      LETTERS[letter] +
      (alteration < 0 ? "b".repeat(-alteration) : "#".repeat(alteration));
    const octave = (midi - NATURALS[letter] - alteration) / 12 - 1;
    return name + octave;
  }
  return pitchName(
    midi,
    settings.accidentals === "flats" ||
      (settings.accidentals === "auto" && tonic.includes("b")),
  );
}
export function intervalBetween(a, b) {
  const pa = typeof a === "number" ? parseNote(pitchName(a)) : parseNote(a),
    pb = typeof b === "number" ? parseNote(pitchName(b)) : parseNote(b);
  if (pa?.midi === null || pb?.midi === null || !pa || !pb)
    throw Error("Intervals need notes with octaves.");
  const semitones = pb.midi - pa.midi;
  const diatonic = (pb.octave - pa.octave) * 7 + pb.letter - pa.letter;
  const direction =
    semitones < 0 ? -1 : semitones > 0 ? 1 : diatonic < 0 ? -1 : 1;
  const steps = Math.abs(diatonic);
  const number = steps + 1;
  const base = NATURALS[steps % 7] + 12 * Math.floor(steps / 7);
  const distance =
    diatonic === 0 ? Math.abs(semitones) : semitones * (diatonic < 0 ? -1 : 1);
  const delta = distance - base;
  const perfect = [0, 3, 4].includes(steps % 7);
  let quality;
  if (perfect)
    quality =
      delta === 0 ? "P" : delta > 0 ? "A".repeat(delta) : "d".repeat(-delta);
  else
    quality =
      delta === 0
        ? "M"
        : delta === -1
          ? "m"
          : delta > 0
            ? "A".repeat(delta)
            : "d".repeat(-delta - 1);
  return {
    semitones,
    number,
    quality,
    label: quality + number,
    simple: quality + ((steps % 7) + 1),
    direction: semitones === 0 ? "same pitch" : direction < 0 ? "down" : "up",
    colorIndex: mod(Math.abs(semitones)),
  };
}
export const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
export function recognize(midis) {
  if (!midis.length) return [];
  const pitches = [...new Set(midis.map((m) => mod(m)))],
    bass = mod(Math.min(...midis));
  const results = [];
  for (const root of pitches)
    for (const def of CHORD_DEFS) {
      const rel = pitches.map((p) => mod(p - root));
      if (
        rel.some((p) => !def.required.includes(p) && !def.optional.includes(p))
      )
        continue;
      const missing = def.required.filter((p) => !rel.includes(p));
      if (missing.length > 1 || rel.length < 2) continue;
      results.push({
        root,
        bass,
        ...def,
        missing,
        exact: missing.length === 0,
        score:
          missing.length * 100 +
          (root === bass ? 0 : 2) +
          def.optional.length +
          Math.max(0, def.required.length - 4),
      });
    }
  return results.sort((a, b) => a.score - b.score || a.root - b.root);
}
export function chordLabel(candidate, settings) {
  if (!candidate) return "Unclassified collection";
  const root = spellPitch(60 + candidate.root, settings).replace(/-?\d+$/, "");
  const bass = spellChordPitch(
    60 + candidate.bass,
    candidate,
    settings,
  ).replace(/-?\d+$/, "");
  return (
    root +
    candidate.suffix +
    (candidate.bass === candidate.root ? "" : "/" + bass)
  );
}
export function spellChordPitch(midi, candidate, settings, override) {
  if (override && parseNote(override)?.midi === midi) return override;
  if (!candidate?.exact) return spellPitch(midi, settings);
  const rootName = spellPitch(60 + candidate.root, settings).replace(
    /-?\d+$/,
    "",
  );
  const distance = mod(midi - candidate.root);
  const generic = {
    0: 0,
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 3,
    6: 4,
    7: 4,
    8: candidate.suffix === "aug" ? 4 : 5,
    9: candidate.suffix === "dim7" ? 6 : 5,
    10: 6,
    11: 6,
  }[distance];
  const letter = mod(LETTERS.indexOf(rootName[0]) + generic, 7);
  const alteration = mod(mod(midi) - NATURALS[letter] + 6) - 6;
  return (
    LETTERS[letter] +
    (alteration < 0 ? "b".repeat(-alteration) : "#".repeat(alteration)) +
    ((midi - NATURALS[letter] - alteration) / 12 - 1)
  );
}
export function roman(candidate, settings) {
  if (!candidate?.exact) return "—";
  const degrees = [
    "I",
    "♭II",
    "II",
    "♭III",
    "III",
    "IV",
    "♯IV",
    "V",
    "♭VI",
    "VI",
    "♭VII",
    "VII",
  ];
  let degree = degrees[mod(candidate.root - settings.tonic)];
  if (candidate.required.includes(3)) degree = degree.toLowerCase();
  if (candidate.suffix === "dim") degree += "°";
  if (candidate.suffix === "m7b5") degree += "ø7";
  else if (candidate.suffix === "dim7") degree += "°7";
  else if (candidate.suffix.includes("7"))
    degree += candidate.suffix.includes("maj") ? "maj7" : "7";
  else if (candidate.suffix === "aug") degree += "+";
  else if (candidate.suffix.startsWith("sus")) degree += candidate.suffix;
  return degree;
}
export function compatibleCollections(midis, tonic) {
  const pcs = [...new Set(midis.map((m) => mod(m)))];
  if (!pcs.length) return [];
  return Array.from({ length: 12 }, (_, root) =>
    SCALE_DEFS.filter((s) => s.name !== "Chromatic").map((scale) => {
      const collection = scale.intervals.map((i) => mod(root + i));
      return {
        root,
        name: scale.name,
        contained: pcs.filter((p) => collection.includes(p)),
        outside: pcs.filter((p) => !collection.includes(p)),
        missing: collection.filter((p) => !pcs.includes(p)),
      };
    }),
  )
    .flat()
    .sort(
      (a, b) =>
        a.outside.length - b.outside.length ||
        (a.root === tonic ? -1 : 0) - (b.root === tonic ? -1 : 0) ||
        a.missing.length - b.missing.length ||
        a.root - b.root,
    );
}
export function compareRanks(a, b) {
  const sort = (notes) =>
    [...notes].sort((x, y) => x.midi - y.midi || x.id.localeCompare(y.id));
  const left = sort(a),
    right = sort(b);
  return Array.from(
    { length: Math.max(left.length, right.length) },
    (_, i) => ({
      from: left[i] ?? null,
      to: right[i] ?? null,
      interval:
        left[i] && right[i]
          ? intervalBetween(left[i].name, right[i].name)
          : null,
    }),
  );
}
export const FIFTHS = Array.from({ length: 12 }, (_, i) => mod(i * 7));
