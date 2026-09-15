import {
  COLORS,
  maskFor,
  SCALE_DEFS,
  spellPitch,
  spellChordPitch,
  recognize,
  parseNote,
  mod,
} from "./theory.js";
export const PPQ = 96,
  MAX_EVENTS = 128,
  GENERATOR_VERSION = 1;
const number = (label, group, value, min, max, step = 1) => ({
  label,
  group,
  value,
  type: "number",
  min,
  max,
  step,
});
const choice = (label, group, value, options) => ({
  label,
  group,
  value,
  type: "select",
  options,
});
const bool = (label, group, value) => ({
  label,
  group,
  value,
  type: "checkbox",
});
export const SCHEMA = {
  tonicSpelling: choice("Tonic spelling", "Display", "auto", [
    "auto",
    "C",
    "C#",
    "Db",
    "D",
    "D#",
    "Eb",
    "E",
    "Fb",
    "E#",
    "F",
    "F#",
    "Gb",
    "G",
    "G#",
    "Ab",
    "A",
    "A#",
    "Bb",
    "B",
    "Cb",
    "B#",
  ]),
  tonic: choice(
    "Tonic",
    "Key",
    0,
    Array.from({ length: 12 }, (_, i) => i),
  ),
  keyMask: number(
    "Key collection",
    "Key",
    maskFor(0, SCALE_DEFS[0].intervals),
    0,
    4095,
  ),
  accidentals: choice("Spelling preference", "Display", "auto", [
    "auto",
    "sharps",
    "flats",
  ]),
  stringCount: number("Number of strings", "Instrument", 6, 1, 12),
  fretCount: number("Last physical fret", "Instrument", 24, 1, 36),
  capo: number("Capo fret", "Instrument", 0, 0, 36),
  leftHanded: bool("Left-handed neck", "Display", false),
  fretMin: number("First visible fret", "Instrument", 0, 0, 36),
  fretMax: number("Last visible fret", "Instrument", 12, 1, 36),
  allowOpen: bool("Use effective open strings", "Generation", true),
  editorMode: choice("Editor mode", "Editor", "chord", ["chord", "melody"]),
  append: bool("Append / record notes", "Editor", false),
  generationType: choice("Pattern type", "Generation", "progression", [
    "melody",
    "arpeggio",
    "chord",
    "progression",
  ]),
  eventCount: number("Pattern events", "Generation", 4, 1, 64),
  inKey: bool("Generate only key tones", "Generation", true),
  maxSpan: number("Maximum fretted span", "Generation", 4, 0, 12),
  maxLeap: number("Maximum melodic leap", "Generation", 7, 0, 36),
  repeatNotes: bool("Allow consecutive repeated pitches", "Generation", true),
  lowPitch: number("Lowest MIDI pitch", "Generation", 24, 0, 127),
  highPitch: number("Highest MIDI pitch", "Generation", 88, 0, 127),
  chordVocabulary: choice("Chord vocabulary", "Generation", "triads", [
    "triads",
    "sevenths",
    "sus",
    "power",
  ]),
  restRate: number("Rest probability (%)", "Generation", 0, 0, 75, 5),
  seed: number("Seed", "Generation", 1731, 1, 2147483646),
  tempo: number("Tempo · quarter notes / min", "Rhythm", 92, 30, 240),
  meter: choice("Meter", "Rhythm", "4/4", [
    "2/4",
    "3/4",
    "4/4",
    "5/4",
    "6/8",
    "7/8",
    "9/8",
    "12/8",
  ]),
  duration: choice(
    "New event duration (ticks)",
    "Rhythm",
    384,
    [24, 32, 48, 64, 96, 144, 192, 288, 384],
  ),
  picking: choice("Picking", "Technique", "free", [
    "free",
    "up",
    "down",
    "fingers",
    "alternate",
  ]),
  fingerPattern: choice("Finger sequence", "Technique", "p i m a", [
    "p i m a",
    "i m",
    "p i m",
    "i m a",
  ]),
  volume: number("Volume (%)", "Playback", 25, 0, 60, 5),
  waveform: choice("Sound", "Playback", "triangle", ["sine", "triangle"]),
  loop: bool("Loop pattern", "Playback", false),
  metronome: bool("Metronome", "Playback", false),
  audition: bool("Hear note on selection", "Playback", false),
  labels: choice("Fretboard labels", "Display", "notes", [
    "notes",
    "degrees",
    "both",
  ]),
  showOctaves: bool("Show octaves", "Display", false),
  colorReference: choice("Interval color reference", "Display", "tonic", [
    "tonic",
    "chord",
    "pinned",
  ]),
  pinnedMidi: number("Pinned reference MIDI pitch", "Display", 60, 0, 127),
};
const standard = [40, 45, 50, 55, 59, 64];
for (let i = 0; i < 12; i++) {
  SCHEMA[`open${i}`] = number(
    `String ${i + 1} open MIDI pitch`,
    "Tuning",
    standard[i] ?? Math.min(88, 64 + (i - 5) * 5),
    0,
    91,
  );
  SCHEMA[`enabled${i}`] = bool(`Use string ${i + 1}`, "Tuning", true);
}
for (let i = 0; i < 12; i++)
  SCHEMA[`color${i}`] = {
    label: `Interval ${i} color`,
    group: "Colors",
    value: COLORS[i],
    type: "color",
    options: COLORS,
  };
export const PRESETS = {
  "Guitar · standard": [40, 45, 50, 55, 59, 64],
  "Guitar · Drop D": [38, 45, 50, 55, 59, 64],
  "Guitar · DADGAD": [38, 45, 50, 55, 57, 62],
  "Guitar · 7 strings": [35, 40, 45, 50, 55, 59, 64],
  "Guitar · 8 strings": [30, 35, 40, 45, 50, 55, 59, 64],
  "Bass · 4 strings": [28, 33, 38, 43],
  "Bass · 5 strings": [23, 28, 33, 38, 43],
  "Bass · 6 strings": [23, 28, 33, 38, 43, 48],
};
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.random()}`;
export const clone = (value) => structuredClone(value);
export function defaultSettings() {
  return Object.fromEntries(
    Object.entries(SCHEMA).map(([id, def]) => [id, def.value]),
  );
}
export function emptyEvent(kind = "chord", duration = 384) {
  return {
    id: uid(),
    kind,
    duration,
    notes: [],
    locked: false,
    picking: "free",
    fingers: "p i m a",
    interpretation: null,
  };
}
export function defaultProject() {
  return {
    version: 2,
    generatorVersion: GENERATOR_VERSION,
    title: "A little movement",
    settings: defaultSettings(),
    randomize: Object.fromEntries(
      Object.keys(SCHEMA).map((id) => [id, ["seed", "restRate"].includes(id)]),
    ),
    randomPattern: true,
    events: [],
    selectedId: null,
  };
}
export function stringsOf(s) {
  return Array.from({ length: s.stringCount }, (_, i) => ({
    id: `s${i}`,
    index: i,
    open: s[`open${i}`],
    enabled: s[`enabled${i}`],
  }));
}
export function midiOf(note, s) {
  const index = Number(note.stringId.slice(1));
  return s[`open${index}`] + note.fret;
}
export function namedNotes(event, s, candidates) {
  const exact =
    event?.kind === "chord"
      ? (candidates ?? recognize(event.notes.map((n) => midiOf(n, s)))).filter(
          (c) => c.exact,
        )
      : [];
  const chord =
    exact.find((c) => `${c.root}:${c.suffix}` === event.interpretation) ??
    exact[0];
  return (event?.notes ?? []).map((n) => ({
    ...n,
    midi: midiOf(n, s),
    name: spellChordPitch(midiOf(n, s), chord, s, n.spelling),
  }));
}
export function createNote(stringId, fret) {
  return { id: uid(), stringId, fret };
}
export function settingsProblem(s) {
  for (const [key, def] of Object.entries(SCHEMA)) {
    const value = s[key];
    if (
      def.type === "number" &&
      (!Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < def.min ||
        value > def.max)
    )
      return `${def.label} must be an integer between ${def.min} and ${def.max}.`;
    if (def.type === "checkbox" && typeof value !== "boolean")
      return `${def.label} must be on or off.`;
    if (def.type === "select" && !def.options.includes(value))
      return `${def.label} is not a supported value.`;
    if (def.type === "color" && !/^#[0-9a-f]{6}$/i.test(value))
      return `${def.label} needs a six-digit hex color.`;
  }
  if (s.tonicSpelling !== "auto" && parseNote(s.tonicSpelling)?.pc !== s.tonic)
    return "Tonic spelling must name the chosen tonic pitch.";
  if (s.capo > s.fretCount) return "Capo cannot be beyond the last fret.";
  if (s.fretMin > s.fretMax || s.fretMax > s.fretCount)
    return "Visible fret window must fit the instrument.";
  if (s.lowPitch > s.highPitch)
    return "Lowest pitch cannot exceed highest pitch.";
  return null;
}
export function validateProject(p) {
  if (!p || p.version !== 2 || p.generatorVersion !== GENERATOR_VERSION)
    throw Error(
      "Unsupported project version. Export from a supported ToneDef version.",
    );
  if (typeof p.title !== "string" || p.title.length > 120)
    throw Error("Project title must contain at most 120 characters.");
  const problem = settingsProblem(p.settings ?? {});
  if (problem) throw Error(problem);
  if (!Array.isArray(p.events) || p.events.length > MAX_EVENTS)
    throw Error(`A project can contain at most ${MAX_EVENTS} events.`);
  if (typeof p.randomPattern !== "boolean")
    throw Error("Invalid pattern randomization flag.");
  for (const id of Object.keys(SCHEMA))
    if (typeof p.randomize?.[id] !== "boolean")
      throw Error(`Missing randomization flag: ${id}`);
  const ids = new Set();
  const noteIds = new Set();
  for (const e of p.events) {
    if (
      typeof e.id !== "string" ||
      !/^[A-Za-z0-9_.:-]{1,120}$/.test(e.id) ||
      ids.has(e.id)
    )
      throw Error("Events need unique IDs.");
    ids.add(e.id);
    if (
      !["chord", "melody", "rest"].includes(e.kind) ||
      !Number.isInteger(e.duration) ||
      e.duration < 1 ||
      e.duration > 1536
    )
      throw Error("Invalid event type or duration.");
    if (
      typeof e.locked !== "boolean" ||
      !["free", "up", "down", "fingers", "alternate"].includes(e.picking) ||
      typeof e.fingers !== "string" ||
      !/^[pima ]{1,20}$/.test(e.fingers)
    )
      throw Error("Invalid picking or event lock.");
    if (
      e.interpretation !== null &&
      (typeof e.interpretation !== "string" || e.interpretation.length > 80)
    )
      throw Error("Invalid chord interpretation.");
    if (
      !Array.isArray(e.notes) ||
      e.notes.length > 12 ||
      (e.kind === "melody" && e.notes.length > 1) ||
      (e.kind === "rest" && e.notes.length)
    )
      throw Error("Too many notes for this event.");
    const used = new Set();
    for (const n of e.notes) {
      if (
        typeof n.id !== "string" ||
        !/^[A-Za-z0-9_.:-]{1,120}$/.test(n.id) ||
        noteIds.has(n.id)
      )
        throw Error("Notes need unique IDs.");
      noteIds.add(n.id);
      if (
        !/^s(?:[0-9]|1[01])$/.test(n.stringId) ||
        Number(n.stringId.slice(1)) >= p.settings.stringCount ||
        !Number.isInteger(n.fret) ||
        n.fret < p.settings.capo ||
        n.fret > p.settings.fretCount
      )
        throw Error("A note lies outside the instrument.");
      if (used.has(n.stringId))
        throw Error("A chord can sound only one fret on each string.");
      used.add(n.stringId);
      if (
        n.spelling !== undefined &&
        parseNote(n.spelling)?.midi !== midiOf(n, p.settings)
      )
        throw Error("Note spelling must match its sounding pitch.");
    }
  }
  if (p.selectedId !== null && !ids.has(p.selectedId))
    throw Error("Selected event does not exist.");
  return p;
}
export function importProject(text) {
  if (text.length > 500000) throw Error("Project file exceeds 500 KB.");
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Project JSON must contain a project object.");
  if (raw.version === 1) {
    raw.version = 2;
    raw.generatorVersion = 1;
    raw.settings = { ...defaultSettings(), ...raw.settings };
    raw.randomize = { ...defaultProject().randomize, ...raw.randomize };
    raw.randomPattern ??= true;
    raw.events = raw.events.map((e) => ({
      ...e,
      locked: e.locked ?? false,
      picking: e.picking ?? "free",
      fingers: e.fingers ?? "p i m a",
      interpretation: e.interpretation ?? null,
    }));
    raw.selectedId ??= raw.events[0]?.id ?? null;
  }
  return validateProject(raw);
}
export function positionChoices(s, all = false) {
  return stringsOf(s).flatMap((string) => {
    if (!all && !string.enabled) return [];
    const result = [];
    for (let fret = s.capo; fret <= s.fretCount; fret++) {
      const open = fret === s.capo;
      if (
        !all &&
        (fret < s.fretMin || fret > s.fretMax) &&
        !(open && s.allowOpen)
      )
        continue;
      if (!all && open && !s.allowOpen) continue;
      const midi = string.open + fret;
      if (
        !all &&
        (midi < s.lowPitch ||
          midi > s.highPitch ||
          (s.inKey && !(s.keyMask & (1 << mod(midi)))))
      )
        continue;
      result.push({ stringId: string.id, fret, midi });
    }
    return result;
  });
}
export function editPosition(p, stringId, fret, keyTool = false) {
  const next = clone(p),
    s = next.settings;
  const pc = mod(s[`open${Number(stringId.slice(1))}`] + fret);
  if (keyTool) {
    s.keyMask ^= 1 << pc;
    return next;
  }
  let event = next.events.find((e) => e.id === next.selectedId);
  if (s.editorMode === "melody" && s.append) {
    if (next.events.length >= MAX_EVENTS)
      throw Error(`Maximum ${MAX_EVENTS} events reached.`);
    event = emptyEvent("melody", s.duration);
    next.events.push(event);
    next.selectedId = event.id;
  } else if (!event) {
    event = emptyEvent(s.editorMode, s.duration);
    next.events.push(event);
    next.selectedId = event.id;
  }
  if (event.locked) throw Error("Unlock this event before editing its notes.");
  if (event.kind === "rest") event.kind = s.editorMode;
  if (event.kind !== s.editorMode)
    throw Error(
      `This is a ${event.kind} event. Select its editor mode or add a new event.`,
    );
  const existing = event.notes.find(
    (n) => n.stringId === stringId && n.fret === fret,
  );
  if (existing) event.notes = event.notes.filter((n) => n.id !== existing.id);
  else if (event.kind === "chord")
    event.notes = [
      ...event.notes.filter((n) => n.stringId !== stringId),
      createNote(stringId, fret),
    ];
  else event.notes = [createNote(stringId, fret)];
  event.interpretation = null;
  event.picking = s.picking;
  event.fingers = s.fingerPattern;
  return validateProject(next);
}
export function reconcileInstrument(p, settings, policy = "positions") {
  const next = clone(p);
  next.settings = settings;
  const error = settingsProblem(settings);
  if (error) throw Error(error);
  for (const e of next.events) {
    const used = new Set();
    for (const note of e.notes) {
      const old = p.events
          .find((x) => x.id === e.id)
          .notes.find((x) => x.id === note.id),
        midi = midiOf(old, p.settings);
      if (policy === "pitches") {
        const options = positionChoices(settings, true).filter(
          (n) => n.midi === midi && !used.has(n.stringId),
        );
        options.sort(
          (a, b) =>
            Math.abs(a.fret - old.fret) - Math.abs(b.fret - old.fret) ||
            (a.stringId === old.stringId ? -1 : 1),
        );
        if (!options.length)
          throw Error(
            `Cannot preserve pitch ${spellPitch(midi, p.settings)} on the new instrument. The project is unchanged.`,
          );
        note.stringId = options[0].stringId;
        note.fret = options[0].fret;
      } else if (midiOf(note, settings) !== midi) delete note.spelling;
      used.add(note.stringId);
      if (
        e.locked &&
        (midiOf(note, settings) !== midi ||
          note.stringId !== old.stringId ||
          note.fret !== old.fret)
      )
        throw Error(
          "An instrument change would alter a locked event. Unlock it first.",
        );
    }
    e.interpretation = null;
  }
  return validateProject(next);
}
export function instrumentImpact(p, s) {
  return p.events
    .flatMap((e) =>
      e.notes.map((n) => ({
        old: midiOf(n, p.settings),
        new: midiOf(n, s),
        invalid:
          Number(n.stringId.slice(1)) >= s.stringCount ||
          n.fret < s.capo ||
          n.fret > s.fretCount,
      })),
    )
    .filter((n) => n.old !== n.new || n.invalid);
}
function eventFromFrets(p, frets, duration = 384) {
  const event = emptyEvent("chord", duration);
  event.notes = frets.flatMap((fret, i) =>
    fret === null ? [] : [createNote(`s${i}`, fret)],
  );
  return event;
}
export function example(name = "progression") {
  const p = defaultProject();
  if (name === "compare") {
    p.title = "One fret. A different feeling.";
    p.events = [
      eventFromFrets(p, [null, 3, 2, 0, 1, 0]),
      eventFromFrets(p, [null, 3, 1, 0, 1, null]),
    ];
  } else if (name === "melody") {
    p.title = "A minor · a small conversation";
    p.settings.tonic = 9;
    p.settings.keyMask = maskFor(9, SCALE_DEFS[5].intervals);
    p.settings.editorMode = "melody";
    p.settings.generationType = "melody";
    p.settings.duration = 48;
    p.settings.eventCount = 8;
    p.events = [5, 8, 7, 5, 5, 7, 8, 5].map((fret) => {
      const e = emptyEvent("melody", 48);
      e.notes = [createNote("s5", fret)];
      return e;
    });
  } else if (name === "bass") {
    p.title = "Bass · root, third, fifth";
    Object.assign(p.settings, {
      stringCount: 4,
      open0: 28,
      open1: 33,
      open2: 38,
      open3: 43,
      tonic: 0,
      editorMode: "melody",
      generationType: "arpeggio",
      duration: 96,
      eventCount: 8,
      fingerPattern: "i m",
      picking: "fingers",
    });
    p.events = [
      [1, 3],
      [2, 2],
      [3, 0],
      [3, 5],
      [3, 0],
      [2, 2],
      [1, 3],
      [1, 3],
    ].map(([string, fret]) => {
      const e = emptyEvent("melody", 96);
      e.notes = [createNote(`s${string}`, fret)];
      e.picking = "fingers";
      e.fingers = "i m";
      return e;
    });
  } else {
    p.events = [
      eventFromFrets(p, [null, 3, 2, 0, 1, 0]),
      eventFromFrets(p, [null, 0, 2, 2, 1, 0]),
      eventFromFrets(p, [1, 3, 3, 2, 1, 1]),
      eventFromFrets(p, [3, 2, 0, 0, 0, 3]),
    ];
  }
  p.selectedId = p.events[0].id;
  return validateProject(p);
}
export function tabExport(p) {
  const s = p.settings,
    lines = [
      `ToneDef — ${p.title}`,
      `Quarter-note tempo: ${s.tempo}; meter: ${s.meter}; absolute physical frets; capo ${s.capo}`,
      `Time unit: ${PPQ} ticks / quarter; each column is one event.`,
      ...stringsOf(s)
        .reverse()
        .map(
          (string) =>
            `${spellPitch(string.open, s).padEnd(5)} |` +
            p.events
              .map((e) => {
                const note = e.notes.find((n) => n.stringId === string.id);
                return String(note ? note.fret : "–").padStart(4);
              })
              .join("|") +
            "|",
        ),
      `ticks |${p.events.map((e) => String(e.duration).padStart(4)).join("|")}|`,
      `pick  |${p.events.map((e) => e.picking.slice(0, 4).padStart(4)).join("|")}|`,
    ];
  return lines.join("\n");
}
export class History {
  constructor(p) {
    this.project = p;
    this.past = [];
    this.future = [];
  }
  commit(next) {
    validateProject(next);
    this.past.push(clone(this.project));
    if (this.past.length > 80) this.past.shift();
    this.project = clone(next);
    this.future = [];
  }
  undo() {
    if (!this.past.length) return;
    this.future.push(this.project);
    this.project = this.past.pop();
  }
  redo() {
    if (!this.future.length) return;
    this.past.push(this.project);
    this.project = this.future.pop();
  }
}
