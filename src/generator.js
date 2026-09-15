import {
  mod,
  pcsFor,
  CHORD_DEFS,
  COLORS,
  parseNote,
  maskFor,
  SCALE_DEFS,
} from "./theory.js";
import {
  SCHEMA,
  clone,
  positionChoices,
  validateProject,
  midiOf,
  settingsProblem,
} from "./model.js";
/** Mulberry32. Explicit uint32 operations make the saved seed portable. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (values, rand) => values[Math.floor(rand() * values.length)];
const shuffle = (values, rand) => {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function findVoicing(pitches, settings, rand = seededRandom(1)) {
  const pcs = [...new Set(pitches.map((p) => mod(p)))];
  const pool = positionChoices(settings).filter((n) =>
    pcs.includes(mod(n.midi)),
  );
  const stringIds = shuffle([...new Set(pool.map((n) => n.stringId))], rand);
  let visits = 0;
  let result = null;
  function search(index, notes, covered) {
    if (++visits > 25000 || result) return;
    if (covered.size === pcs.length) {
      result = notes;
      return;
    }
    if (
      index >= stringIds.length ||
      notes.length >= 6 ||
      stringIds.length - index < pcs.length - covered.size
    )
      return;
    const choices = shuffle(
      pool.filter((n) => n.stringId === stringIds[index]),
      rand,
    );
    choices.sort(
      (a, b) =>
        Number(covered.has(mod(a.midi))) - Number(covered.has(mod(b.midi))),
    );
    for (const note of choices) {
      const fretted = [...notes, note]
        .filter((n) => n.fret !== settings.capo)
        .map((n) => n.fret);
      if (
        fretted.length &&
        Math.max(...fretted) - Math.min(...fretted) > settings.maxSpan
      )
        continue;
      search(
        index + 1,
        [...notes, note],
        new Set([...covered, mod(note.midi)]),
      );
      if (result) return;
    }
    search(index + 1, notes, covered);
  }
  search(0, [], new Set());
  return result;
}
function chordTargets(settings) {
  const key = pcsFor(settings.keyMask).sort(
    (a, b) => mod(a - settings.tonic) - mod(b - settings.tonic),
  );
  const defs = CHORD_DEFS.filter((d) =>
    settings.chordVocabulary === "power"
      ? d.suffix === "5"
      : settings.chordVocabulary === "sus"
        ? ["sus2", "sus4"].includes(d.suffix)
        : settings.chordVocabulary === "sevenths"
          ? ["7", "maj7", "m7", "m7b5", "dim7", "m(maj7)"].includes(d.suffix)
          : ["", "m", "dim", "aug"].includes(d.suffix),
  );
  const roots = settings.inKey
    ? key
    : Array.from({ length: 12 }, (_, i) => mod(i + settings.tonic));
  return roots.flatMap((root) =>
    defs
      .filter(
        (d) =>
          !settings.inKey ||
          d.required.every((i) => key.includes(mod(root + i))),
      )
      .map((def) => ({
        root,
        pitches: def.required.map((i) => mod(root + i)),
        def,
      })),
  );
}
export function generate(p) {
  validateProject(p);
  const next = clone(p),
    s = next.settings,
    rand = seededRandom(s.seed);
  const pool = positionChoices(s);
  if (!pool.length)
    throw Error(
      "No available notes. Widen the fret or pitch range, enable a string, or add key tones.",
    );
  if (p.events.slice(s.eventCount).some((e) => e.locked))
    throw Error(
      "The requested length would remove a locked event. Increase pattern events or unlock it.",
    );
  const type = s.generationType;
  const targets = chordTargets(s);
  const progressionRoots = [0, 9, 5, 7].map((i) => mod(s.tonic + i));
  let previous = null;
  let arpeggio = null;
  if (type === "arpeggio") {
    const viable = targets.filter((t) => t.root === s.tonic);
    const target = viable[0] ?? targets[0];
    if (!target) throw Error("No supported arpeggio fits these key tones.");
    arpeggio = target.pitches;
  }
  const events = [];
  for (let i = 0; i < s.eventCount; i++) {
    const protectedEvent = p.events[i];
    if (protectedEvent?.locked) {
      events.push(clone(protectedEvent));
      previous = protectedEvent.notes[0]
        ? midiOf(protectedEvent.notes[0], s)
        : previous;
      continue;
    }
    const event = {
      id: `g-${s.seed}-${i}`,
      kind: ["chord", "progression"].includes(type) ? "chord" : "melody",
      duration: s.duration,
      notes: [],
      locked: false,
      picking: s.picking,
      fingers: s.fingerPattern,
      interpretation: null,
    };
    if (rand() < s.restRate / 100) {
      event.kind = "rest";
      events.push(event);
      continue;
    }
    if (event.kind === "chord") {
      const ordered = shuffle(targets, rand);
      if (type === "progression")
        ordered.sort(
          (a, b) =>
            Number(b.root === progressionRoots[i % 4]) -
            Number(a.root === progressionRoots[i % 4]),
        );
      else
        ordered.sort(
          (a, b) => Number(b.root === s.tonic) - Number(a.root === s.tonic),
        );
      let voicing = null;
      for (const target of ordered) {
        voicing = findVoicing(target.pitches, s, rand);
        if (voicing) break;
      }
      if (!voicing)
        throw Error(
          "No complete chord fits these strings, key tones and fret span. Widen the range or choose melody.",
        );
      event.notes = voicing.map((n, j) => ({
        id: `gn-${s.seed}-${i}-${j}`,
        stringId: n.stringId,
        fret: n.fret,
      }));
    } else {
      let candidates = pool.filter(
        (n) =>
          (previous === null || Math.abs(n.midi - previous) <= s.maxLeap) &&
          (previous === null || s.repeatNotes || n.midi !== previous),
      );
      if (arpeggio) {
        const desired = arpeggio[i % arpeggio.length];
        candidates = candidates.filter((n) => mod(n.midi) === desired);
      }
      if (!candidates.length)
        throw Error(
          `No next note meets the leap/repetition constraints at event ${i + 1}. Try a larger leap or enable repeats.`,
        );
      const note = pick(candidates, rand);
      event.notes = [
        { id: `gn-${s.seed}-${i}-0`, stringId: note.stringId, fret: note.fret },
      ];
      previous = note.midi;
    }
    events.push(event);
  }
  // Generated IDs cannot collide with surviving protected events/notes.
  const all = new Set(
    events
      .filter((e) => e.locked)
      .flatMap((e) => [e.id, ...e.notes.map((n) => n.id)]),
  );
  for (const e of events) {
    if (e.locked) continue;
    while (all.has(e.id)) e.id += "-copy";
    all.add(e.id);
    for (const n of e.notes) {
      while (all.has(n.id)) n.id += "-copy";
      all.add(n.id);
    }
  }
  next.events = events;
  next.selectedId = events[0]?.id ?? null;
  return validateProject(next);
}
export function randomize(p) {
  validateProject(p);
  if (!Object.values(p.randomize).some(Boolean) && !p.randomPattern)
    return { project: clone(p), changed: [] };
  const rand = seededRandom(p.settings.seed);
  let lastIssue = "";
  for (let attempt = 0; attempt < 32; attempt++) {
    const next = clone(p),
      s = next.settings;
    for (const [id, def] of Object.entries(SCHEMA)) {
      if (!p.randomize[id] || id === "tonicSpelling") continue;
      if (def.type === "select") s[id] = pick(def.options, rand);
      else if (def.type === "checkbox") s[id] = rand() >= 0.5;
      else if (def.type === "color") s[id] = pick(COLORS, rand);
      else if (id === "keyMask")
        s[id] = maskFor(s.tonic, pick(SCALE_DEFS, rand).intervals);
      else {
        const step = def.step ?? 1;
        let min = def.min,
          max = def.max;
        if (id === "restRate") max = 35;
        if (id === "eventCount") max = 16;
        if (/^open\d+$/.test(id)) {
          min = Math.max(min, p.settings[id] - 12);
          max = Math.min(max, p.settings[id] + 12);
        }
        s[id] =
          min +
          Math.floor(rand() * (Math.floor((max - min) / step) + 1)) * step;
      }
    }
    if (p.randomize.tonicSpelling)
      s.tonicSpelling = pick(
        SCHEMA.tonicSpelling.options.filter(
          (v) => v === "auto" || parseNote(v).pc === s.tonic,
        ),
        rand,
      );
    // Only eligible values are conditioned on dependencies. Fixed values are never normalized.
    if (p.randomize.fretCount)
      s.fretCount = Math.max(
        s.fretCount,
        p.randomize.fretMax ? 1 : s.fretMax,
        p.randomize.capo ? 0 : s.capo,
      );
    if (p.randomize.capo) s.capo = Math.min(s.capo, s.fretCount);
    if (p.randomize.fretMax)
      s.fretMax = Math.min(
        s.fretCount,
        Math.max(s.fretMax, p.randomize.fretMin ? 0 : s.fretMin),
      );
    if (p.randomize.fretMin) s.fretMin = Math.min(s.fretMin, s.fretMax);
    if (p.randomize.lowPitch) s.lowPitch = Math.min(s.lowPitch, s.highPitch);
    try {
      const issue = settingsProblem(s);
      if (issue) throw Error(issue);
      for (const e of p.events)
        if (e.locked || !p.randomPattern)
          for (const n of e.notes)
            if (
              midiOf(n, p.settings) !== midiOf(n, s) ||
              Number(n.stringId.slice(1)) >= s.stringCount ||
              n.fret < s.capo ||
              n.fret > s.fretCount
            )
              throw Error(
                "A protected note conflicts with tuning or instrument changes.",
              );
      for (const key of Object.keys(SCHEMA))
        if (!p.randomize[key] && s[key] !== p.settings[key])
          throw Error("Internal fixed-setting violation.");
      const result = p.randomPattern ? generate(next) : validateProject(next);
      return {
        project: result,
        changed: Object.keys(SCHEMA).filter(
          (key) => s[key] !== p.settings[key],
        ),
      };
    } catch (error) {
      lastIssue = error.message;
    }
  }
  throw Error(
    "No valid variant found in 32 bounded attempts. " +
      lastIssue +
      " Keep more settings fixed or relax these constraints. Nothing changed.",
  );
}
