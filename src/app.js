import {
  COLORS,
  INTERVALS,
  DEGREES,
  SCALE_DEFS,
  FIFTHS,
  TONICS,
  mod,
  pretty,
  pcsFor,
  maskFor,
  currentScale,
  tonicName,
  spellPitch,
  parseNote,
  intervalBetween,
  recognize,
  chordLabel,
  roman,
  compatibleCollections,
  compareRanks,
} from "./theory.js";
import {
  SCHEMA,
  PRESETS,
  PPQ,
  MAX_EVENTS,
  clone,
  uid,
  defaultProject,
  example,
  History,
  validateProject,
  importProject,
  stringsOf,
  namedNotes,
  midiOf,
  emptyEvent,
  editPosition,
  reconcileInstrument,
  instrumentImpact,
  tabExport,
} from "./model.js";
import { Player, playbackPlan } from "./audio.js";
import { mountWorkspace, revealPanel } from "./workspace.js";
import { chordSegments } from "./layout.js";
import { intervalWorkspace, signed } from "./interval-view.js";
import { hideHelp, prepareHelp } from "./help.js";
const $ = (selector) => document.querySelector(selector),
  esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
const STORE = "tonedef.current.v2",
  BACKUP = "tonedef.backup.v2",
  LIBRARY = "tonedef.library.v2";
let bootNotice = "";
let initial;
try {
  const saved = localStorage.getItem(STORE);
  initial = saved ? importProject(saved) : example();
} catch {
  try {
    initial = importProject(localStorage.getItem(BACKUP));
    bootNotice =
      "Recovered your last good save. The damaged save is still available in browser storage.";
  } catch {
    initial = example();
    bootNotice =
      "Could not read the saved project. An example is open; your original storage has not been overwritten.";
  }
}
const history = new History(initial);
let tool = "notes",
  showRandom = false,
  toolsTab = "fifths",
  focusPos = null,
  hoverPc = null,
  worker = null,
  pendingInstrument = null,
  playingId = null;
let saveAllowed = !bootNotice;
let compareEventId = null;
let halfStepLabels = true;
let intervalPair = [0, 1];
const hint = (text) => `data-help="${esc(text)}"`;
const help = (label, text) => `<button class="help-trigger" aria-label="${esc(label)} help" ${hint(text)}>?</button>`;
const FIELD_LABELS = {
  stringCount: "Strings", fretCount: "Frets", capo: "Capo", fretMin: "First fret", fretMax: "Last fret",
  generationType: "Pattern", eventCount: "Events", maxSpan: "Fret span", maxLeap: "Leap · ½ steps",
  lowPitch: "Low · MIDI", highPitch: "High · MIDI", restRate: "Rests · %", tempo: "Tempo · BPM",
  duration: "Duration · ticks", colorReference: "Reference", pinnedMidi: "Pinned · MIDI"
};
let transitionIndex = 0;
let colorAnalysis = null;
let analysisCache = new Map();
let analysisSettings = null;
let analysisProject = null;
const player = new Player(
  (id) => {
    playingId = id;
    const readout = $("#play-status");
    if (readout)
      readout.textContent = id
        ? `Playing event ${project().events.findIndex((e) => e.id === id) + 1} of ${project().events.length}`
        : "";
    document
      .querySelectorAll("[data-event]")
      .forEach((el) => el.classList.toggle("playing", el.dataset.event === id));
    $("#playButton")?.setAttribute("aria-pressed", String(player.running));
  },
  () => {
    $("#playButton")?.setAttribute("aria-pressed", "false");
  },
);
const project = () => history.project;
const formatBeats = (ticks) =>
  ({ 32: "⅓", 64: "⅔" })[ticks] ?? String(ticks / 96);
function notify(message, error = false) {
  let node = $("#toast");
  if (!node) {
    node = document.createElement("div");
    node.id = "toast";
    node.setAttribute("role", "status");
    document.body.append(node);
  }
  node.className = error ? "toast error" : "toast";
  node.textContent = message;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => node.remove(), error ? 10000 : 4500);
}
function persist() {
  if (!saveAllowed) return;
  try {
    const previous = localStorage.getItem(STORE);
    if (previous) {
      try {
        importProject(previous);
        localStorage.setItem(BACKUP, previous);
      } catch {}
    }
    localStorage.setItem(STORE, JSON.stringify(project()));
  } catch {
    notify(
      "Browser storage is full or unavailable. Export JSON to keep your work.",
      true,
    );
  }
}
function commit(next, message) {
  const started = performance.now();
  player.stop();
  history.commit(next);
  saveAllowed = true;
  persist();
  render();
  $("#app").dataset.editMs = (performance.now() - started).toFixed(2);
  if (message) notify(message);
}
function attempt(fn) {
  try {
    fn();
  } catch (error) {
    notify(error.message, true);
    render();
  }
}
function mutate(fn, message) {
  const next = clone(project());
  fn(next);
  commit(next, message);
}
function current() {
  return project().events.find((e) => e.id === project().selectedId);
}
function analysis(event = current()) {
  const s = project().settings;
  if (analysisProject !== project()) {
    const signature = JSON.stringify(s);
    if (analysisSettings !== signature) {
      analysisSettings = signature;
      analysisCache.clear();
    }
    analysisProject = project();
  }
  const cacheKey = event ? JSON.stringify(event) : null;
  if (cacheKey && analysisCache.has(cacheKey))
    return analysisCache.get(cacheKey);
  const candidates =
    event?.kind === "chord"
      ? recognize(event.notes.map((n) => midiOf(n, s)))
      : [];
  const notes = namedNotes(event, s, candidates),
    exact = candidates.filter((c) => c.exact);
  const selected =
    exact.find((c) => `${c.root}:${c.suffix}` === event?.interpretation) ??
    exact[0];
  const result = { notes, candidates, exact, selected };
  if (cacheKey) {
    if (analysisCache.size > 512) analysisCache.clear();
    analysisCache.set(cacheKey, result);
  }
  return result;
}
function nameOf(event) {
  if (event.kind === "rest" || !event.notes.length)
    return event.kind === "rest" ? "Rest" : "Empty " + event.kind;
  if (event.kind === "melody") return pretty(analysis(event).notes[0].name);
  const result = analysis(event);
  return result.selected
    ? pretty(chordLabel(result.selected, project().settings))
    : `${event.notes.length} notes`;
}
function colorFor(midi) {
  const s = project().settings,
    a = colorAnalysis ?? analysis();
  let index;
  if (s.colorReference === "pinned") index = mod(Math.abs(midi - s.pinnedMidi));
  else
    index = mod(
      midi -
        (s.colorReference === "chord" && a.selected
          ? a.selected.root
          : s.tonic),
    );
  return s[`color${index}`];
}
function randomBox(id) {
  return showRandom
    ? `<label class="random-flag" title="Checked: Randomize may change ${esc(SCHEMA[id].label)}"><input type="checkbox" data-random="${id}" aria-label="Randomize ${esc(SCHEMA[id].label)}" ${project().randomize[id] ? "checked" : ""}><span aria-hidden="true">↝</span></label>`
    : "";
}
function field(id, customLabel) {
  const def = SCHEMA[id],
    value = project().settings[id],
    label = customLabel ?? FIELD_LABELS[id] ?? def.label;
  let input;
  if (def.type === "select")
    input = `<select id="setting-${id}" data-setting="${id}">${def.options.map((v) => `<option value="${v}" ${v === value ? "selected" : ""}>${esc(optionLabel(id, v))}</option>`).join("")}</select>`;
  else if (def.type === "checkbox")
    input = `<input id="setting-${id}" type="checkbox" data-setting="${id}" ${value ? "checked" : ""}>`;
  else
    input = `<input id="setting-${id}" type="${def.type}" data-setting="${id}" value="${esc(value)}" ${def.type === "number" ? `min="${def.min}" max="${def.max}" step="${def.step ?? 1}"` : ""}>`;
  input = input.replace(/<(input|select) /, `<$1 ${hint(def.label)} `);
  return `<div class="setting ${def.type === "checkbox" ? "boolean" : ""}"><label for="setting-${id}">${esc(label)}</label><div class="setting-input">${input}${randomBox(id)}</div></div>`;
}
function optionLabel(id, v) {
  if (id === "tonic") return pretty(TONICS[v]);
  if (id === "duration")
    return {
      24: "Sixteenth · 24",
      32: "Eighth triplet · 32",
      48: "Eighth · 48",
      64: "Quarter triplet · 64",
      96: "Quarter · 96",
      144: "Dotted quarter · 144",
      192: "Half · 192",
      288: "Dotted half · 288",
      384: "Whole · 384",
    }[v];
  if (id === "colorReference")
    return { tonic: "Key tonic", chord: "Chord root", pinned: "Pinned note" }[
      v
    ];
  return String(v).replace(/^./, (c) => c.toUpperCase());
}
function collectionControl() {
  const s = project().settings,
    scale = currentScale(s.tonic, s.keyMask);
  return `<div class="setting"><label for="collection">Collection</label><div class="setting-input"><select id="collection" data-collection><option value="custom" ${!scale ? "selected" : ""}>Custom · ${pcsFor(s.keyMask).length} tones</option>${SCALE_DEFS.map((d, i) => `<option value="${i}" ${scale === d ? "selected" : ""}>${d.name}</option>`).join("")}</select>${randomBox("keyMask")}</div></div>`;
}
function boardStep(midi) {
  const s = project().settings;
  if (s.colorReference === "pinned") return midi - s.pinnedMidi;
  const root = s.colorReference === "chord" ? analysis().selected?.root : undefined;
  return mod(midi - (root ?? s.tonic));
}
function board() {
  const p = project(),
    s = p.settings,
    event = current(),
    notes = event?.notes ?? [];
  const named = analysis(event).notes;
  const strings = stringsOf(s).reverse();
  let frets = Array.from(
    { length: Math.max(0, s.fretMax - Math.max(s.capo, s.fretMin) + 1) },
    (_, i) => Math.max(s.capo, s.fretMin) + i,
  );
  if (!frets.includes(s.capo)) frets.unshift(s.capo);
  if (s.leftHanded) frets.reverse();
  const visiblePositions = strings.flatMap((string) =>
    frets.map((f) => `${string.id}:${f}`),
  );
  if (!visiblePositions.includes(focusPos)) focusPos = visiblePositions[0];
  return `<div class="board-scroll" tabindex="-1"><div id="fretboard" class="fretboard" role="group" aria-label="Interactive fretboard. Arrow keys move; Enter toggles a note; Shift F10 toggles key membership." style="--columns:${frets.length}"><div class="fret-header"><span>STRING</span>${frets.map((f) => `<span class="fret-number">${f === s.capo ? `<b>${s.capo ? "CAPO " + f : "OPEN"}</b>` : f}<i>${[3, 5, 7, 9, 15, 17, 19, 21, 27, 29, 31, 33].includes(f) ? "•" : f % 12 === 0 ? "••" : ""}</i></span>`).join("")}</div>${strings
    .map(
      (string) =>
        `<div class="string-row" style="--string-weight:${Math.min(2.8, 0.65 + (s.stringCount - 1 - string.index) * 0.28)}px"><span class="string-label"><strong>${pretty(spellPitch(string.open, s))}</strong><small>${string.index + 1}${notes.some((n) => n.stringId === string.id) ? "" : event?.kind === "chord" ? " · ×" : ""}${!string.enabled ? " · off" : ""}</small></span>${frets
          .map((fret) => {
            const midi = string.open + fret,
              pc = mod(midi),
              inKey = !!(s.keyMask & (1 << pc)),
              note = notes.find(
                (n) => n.stringId === string.id && n.fret === fret,
              ),
              name =
                named.find((n) => n.id === note?.id)?.name ??
                spellPitch(midi, s, note?.spelling);
            const degree = DEGREES[mod(pc - s.tonic)],
              label =
                s.labels === "degrees"
                  ? degree
                  : pretty(name.replace(s.showOctaves ? /$^/ : /-?\d+$/, ""));
            return `<button class="fret ${inKey ? "in-key" : ""} ${note ? "selected" : ""} ${pc === s.tonic ? "tonic" : ""} ${fret === s.capo ? "open-fret" : ""}" data-pos="${string.id}:${fret}" data-pc="${pc}" ${hint(`${pretty(name)} · ${midi} MIDI · ${(440 * 2 ** ((midi - 69) / 12)).toFixed(2)} Hz. ${signed(boardStep(midi))} half steps from the interval reference${s.colorReference === "pinned" ? " (actual register)" : " (mod 12)"}. Click to edit; right-click or Shift+F10 to change key membership.`)} aria-label="${esc(pretty(name))}, string ${string.index + 1}, fret ${fret}${note ? ", selected" : ""}${inKey ? ", in key" : ", outside key"}" aria-pressed="${!!note}" tabindex="${focusPos === `${string.id}:${fret}` ? "0" : "-1"}" style="--note-color:${colorFor(midi)}"><span class="note-disc">${esc(label)}${halfStepLabels ? `<small class="half-step-label">${boardStep(midi)}</small>` : s.labels === "both" ? `<small>${degree}</small>` : ""}</span></button>`;
          })
          .join("")}</div>`,
    )
    .join("")}</div></div>`;
}

let boardObserver;
function drawChordShape() {
  const neck = document.getElementById('fretboard');
  if (!neck) return;
  neck.classList.toggle('left-handed', project().settings.leftHanded);
  neck.querySelector('.chord-shape')?.remove();
  const segments = chordSegments(current(), stringsOf(project().settings).reverse());
  if (!segments.length) return;
  const box = neck.getBoundingClientRect(), ns = 'http://www.w3.org/2000/svg';
  if (!box.width || !box.height) return;
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('chord-shape'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  for (const segment of segments) {
    const endpoints = [segment.from, segment.to].map(n => neck.querySelector(`[data-pos="${n.stringId}:${n.fret}"] .note-disc`));
    if (endpoints.some(n => !n)) continue;
    const points = endpoints.map(n => { const r = n.getBoundingClientRect(); return [r.x-box.x+r.width/2, r.y-box.y+r.height/2]; });
    for (const underlay of [true, false]) {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', points[0][0]); line.setAttribute('y1', points[0][1]);
      line.setAttribute('x2', points[1][0]); line.setAttribute('y2', points[1][1]);
      line.setAttribute('class', `${underlay ? 'shape-outline' : 'shape-line'}${segment.skipped ? ' muted-span' : ''}`);
      svg.append(line);
    }
  }
  neck.append(svg);
}
function timeline() {
  const p = project(), s = p.settings, plan = playbackPlan(p);
  const pageStart = Math.floor(Math.max(0, p.events.findIndex((e) => e.id === p.selectedId)) / 16) * 16;
  let tick = p.events.slice(0, pageStart).reduce((sum, e) => sum + e.duration, 0);
  return `<section class="panel timeline-panel" aria-label="Pattern"><div class="pattern-toolbar"><div class="button-row"><span class="count" aria-label="${p.events.length} events">${p.events.length}</span><button data-action="add" data-kind="chord">+ Chord</button><button data-action="add" data-kind="melody">+ Note</button><button data-action="add" data-kind="rest">+ Rest</button>${help("Pattern", "Select a card to edit its notes. Drag cards or use arrows to reorder. Duration is in quarter-note beats; picking affects playback. Locked events survive generation.")}</div><div class="generation-actions"><label ${hint("Allow Randomize to regenerate unlocked pattern content. Setting eligibility is controlled separately in Settings.")}><input id="random-pattern" type="checkbox" ${p.randomPattern ? "checked" : ""}> Pattern</label><button data-action="generate" ${worker ? "disabled" : ""} ${hint("Generate a pattern using the current settings and seed.")}>Generate</button><button data-action="randomize" class="primary" ${worker ? "disabled" : ""} ${hint("Change only eligible settings and, when Pattern is checked, unlocked events.")}>↝ Randomize</button>${worker ? '<button data-action="cancel-generation">Cancel</button>' : ""}</div></div>${p.events.length > 16 ? `<div class="timeline-pages"><button data-event-index="${pageStart - 16}" ${pageStart === 0 ? "disabled" : ""}>← 16</button><span>${pageStart + 1}–${Math.min(pageStart + 16, p.events.length)} / ${p.events.length}</span><button data-event-index="${pageStart + 16}" ${pageStart + 16 >= p.events.length ? "disabled" : ""}>16 →</button></div>` : ""}<div class="pattern-content"><div class="timeline" aria-label="Pattern timeline">${p.events.length ? p.events.slice(pageStart, pageStart + 16).map((e, i) => {
    i += pageStart;
    const start = tick; tick += e.duration;
    const names = analysis(e).notes.map((n) => pretty(n.name)).join(" · ") || "Silence";
    return `<button class="event-card ${p.selectedId === e.id ? "active" : ""} ${playingId === e.id ? "playing" : ""}" data-event="${e.id}" aria-pressed="${p.selectedId === e.id}" draggable="true" ${hint(`${names}. Bar ${Math.floor(start / plan.barTicks) + 1}, beat ${Number((mod(start, plan.barTicks) / plan.beatUnitTicks + 1).toFixed(2))}. ${formatBeats(e.duration)} quarter-note beats. ${pickingLabel(e, i)}.${e.locked ? " Locked." : ""}`)}><span class="event-time">${i + 1}${e.locked ? " ▣" : ""}</span><strong>${esc(nameOf(e))}</strong><span class="event-foot">${formatBeats(e.duration)} ♩</span></button>`;
  }).join("") : '<div class="empty">+ Chord or + Note</div>'}</div><div class="pattern-edit">${eventEditor()}<div class="timeline-caption"><span id="play-status" aria-live="off"></span><span>${plan.duration.toFixed(1)} s · ${s.meter} · ${s.tempo} BPM</span></div></div></div></section>`;
}
function pickingLabel(e, i) {
  return e.picking === "up"
    ? "↑ up"
    : e.picking === "down"
      ? "↓ down"
      : e.picking === "alternate"
        ? i % 2
          ? "↑ up"
          : "↓ down"
        : e.picking === "fingers"
          ? e.fingers
          : "free";
}
function eventEditor() {
  const e = current();
  if (!e) return "";
  return `<div class="event-editor"><label>Duration <select data-event-field="duration" aria-label="Selected event duration" ${e.locked ? "disabled" : ""}>${[24, 32, 48, 64, 96, 144, 192, 288, 384, 576, 768, 1536].map((v) => `<option value="${v}" ${e.duration === v ? "selected" : ""}>${formatBeats(v)} ♩</option>`).join("")}${![24, 32, 48, 64, 96, 144, 192, 288, 384, 576, 768, 1536].includes(e.duration) ? `<option selected value="${e.duration}">${e.duration} ticks</option>` : ""}</select></label><label>Picking <select data-event-field="picking" aria-label="Selected event picking" ${e.locked ? "disabled" : ""}>${["free", "up", "down", "fingers", "alternate"].map((v) => `<option ${e.picking === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>${e.picking === "fingers" ? `<label>Fingers <input data-event-field="fingers" value="${esc(e.fingers)}" aria-label="Selected event fingers" ${e.locked ? "disabled" : ""}></label>` : ""}<div class="button-row"><button data-action="move" data-delta="-1" aria-label="Move event earlier">← Earlier</button><button data-action="move" data-delta="1" aria-label="Move event later">Later →</button><button data-action="duplicate" aria-label="Duplicate event" data-help="Duplicate the selected event.">Duplicate</button><button data-action="lock-event" aria-pressed="${e.locked}">${e.locked ? "▣ Locked" : "□ Lock"}</button><button data-action="delete-event" ${e.locked ? "disabled" : ""}>Delete</button></div></div>`;
}

function inspector() {
  const s = project().settings, e = current(), a = analysis(), root = a.selected;
  return `<section class="panel inspector" aria-label="Selected event"><div class="section-title"><div class="chord-identity"><strong>${esc(e ? nameOf(e) : "—")}</strong><span>${root ? `${esc(root.name)} · ${roman(root, s)}` : e?.kind === "rest" ? "Rest" : e?.kind === "melody" ? "Melody" : ""}</span></div><div class="button-row"><button data-action="audition" ${!a.notes.length ? "disabled" : ""} aria-label="Hear selected event">Hear</button>${help("Selected event", "Names are interpretations of actual sounding pitches, including inversions. S is physical string; f is absolute fret. Pin a note with ◎ to use it as the interval reference. Colors do not prove a key.")}</div></div>${root ? `<div class="chord-meta">Root ${pretty(spellPitch(60 + root.root, s).replace(/-?\d+$/, ""))} · bass ${pretty(a.notes.toSorted((a, b) => a.midi - b.midi)[0].name)}${root.bass !== root.root ? " · inversion" : ""}</div>` : ""}${a.exact.length > 1 ? `<label class="candidate-label">Interpretation <select id="interpretation" ${e.locked ? "disabled" : ""} ${hint("More than one name fits these pitches; musical context decides.")}><option value="auto">Automatic</option>${a.exact.slice(0, 10).map((c) => `<option value="${c.root}:${c.suffix}" ${e.interpretation === `${c.root}:${c.suffix}` ? "selected" : ""}>${esc(pretty(chordLabel(c, s)))}</option>`).join("")}</select></label>` : !root && a.candidates.length ? `<p class="warning-text">Incomplete: ${a.candidates.slice(0, 3).map((c) => `${esc(pretty(chordLabel(c, s)))} (missing ${c.missing.map((i) => INTERVALS[i]).join(", ")})`).join("; ")}</p>` : ""}<div class="note-list" aria-label="Note positions and half-step distances from the chosen reference"><div class="note-table-header"><span>Pitch</span><span>String · fret</span><span>½ steps</span></div>${a.notes.map((n) => `<div class="note-detail"><span class="note-swatch" style="--note-color:${colorFor(n.midi)}"></span><strong>${esc(pretty(n.name))}</strong><span>S${Number(n.stringId.slice(1)) + 1} · f${n.fret}</span><span ${hint(s.colorReference === "pinned" ? "Signed half steps from the pinned MIDI note, including octaves." : "Half steps from the chosen tonic or chord-root reference, modulo 12.")} tabindex="0">${boardStep(n.midi)}${!(s.keyMask & (1 << mod(n.midi))) ? " · outside" : ""}</span><button data-pin="${n.midi}" title="Pin ${esc(pretty(n.name))} as interval reference" aria-label="Pin ${esc(pretty(n.name))}">Pin</button></div>`).join("")}</div>${s.colorReference === "pinned" ? field("pinnedMidi") : ""}<details id="note-pairs"><summary>Pairs · ½ steps</summary>${intervalDetail(a.notes, e)}</details><details id="spelling"><summary>Spelling & octave</summary>${a.notes.map((n) => `<label class="spelling-row">S${Number(n.stringId.slice(1)) + 1} · f${n.fret}<input data-spelling="${n.id}" value="${esc(n.name)}" aria-label="Spelling for string ${Number(n.stringId.slice(1)) + 1}" ${hint("Enharmonic names share a pitch, but change the spelled interval. Include the octave.")} ${e.locked ? "disabled" : ""}></label>`).join("")}</details></section>`;
}
function intervalDetail(notes, e) {
  const p = project(),
    s = p.settings;
  let pairs = [];
  if (e?.kind === "chord")
    for (let i = 0; i < notes.length; i++)
      for (let j = i + 1; j < notes.length; j++) {
        let a = notes[i],
          b = notes[j];
        if (a.midi > b.midi) [a, b] = [b, a];
        pairs.push([a, b]);
      }
  else if (e?.kind === "melody") {
    const index = p.events.findIndex((x) => x.id === e.id),
      prev = p.events
        .slice(0, index)
        .findLast((x) => x.kind === "melody" && x.notes.length);
    if (prev) pairs.push([namedNotes(prev, s)[0], notes[0]]);
    const other = p.events.find((x) => x.id === compareEventId);
    if (other?.notes.length && notes.length && other.id !== e.id)
      pairs.push([notes[0], namedNotes(other, s)[0]]);
  }
  return `<div class="interval-section"><h3>${e?.kind === "melody" ? "Melodic distance" : "Note distances"}</h3>${
    e?.kind === "melody"
      ? `<label>Compare with <select id="compare-event"><option value="">Previous melody note</option>${p.events
          .filter(
            (ev) => ev.kind === "melody" && ev.notes.length && ev.id !== e.id,
          )
          .map(
            (ev) =>
              `<option value="${ev.id}" ${compareEventId === ev.id ? "selected" : ""}>${p.events.indexOf(ev) + 1} · ${esc(nameOf(ev))}</option>`,
          )
          .join("")}</select></label>`
      : ""
  }${
    pairs.filter((pair) => pair.every(Boolean)).length
      ? `<div class="interval-pairs">${pairs
          .filter((pair) => pair.every(Boolean))
          .map(([a, b]) => {
            const interval = intervalBetween(a.name, b.name);
            return `<div><span>${pretty(a.name)} → ${pretty(b.name)}</span><strong style="color:${s[`color${interval.colorIndex}`]}">${interval.label}</strong><small>${interval.semitones > 0 ? "+" : ""}${interval.semitones}</small></div>`;
          })
          .join("")}</div>`
      : '<p class="subtle">Choose two notes to see the distance between them.</p>'
  }</div>`;
}
function transition() {
  const p = project(),
    s = p.settings;
  const pairs = [];
  for (let i = 0; i < p.events.length - 1; i++)
    if (p.events[i].kind === "chord" && p.events[i + 1].kind === "chord")
      pairs.push([p.events[i], p.events[i + 1]]);
  if (!pairs.length) return "";
  transitionIndex = Math.min(transitionIndex, pairs.length - 1);
  const [a, b] = pairs[transitionIndex],
    an = analysis(a).notes,
    bn = analysis(b).notes,
    ar = analysis(a).selected,
    br = analysis(b).selected,
    common = [...new Set(an.map((n) => mod(n.midi)))].filter((pc) =>
      bn.some((n) => mod(n.midi) === pc),
    );
  let rootMovement = "";
  if (ar && br) {
    const ra = spellPitch(48 + ar.root, s),
      rb = spellPitch(48 + br.root, s),
      int = intervalBetween(ra, rb);
    rootMovement = `${pretty(ra.replace(/\d+$/, ""))} → ${pretty(rb.replace(/\d+$/, ""))}: ${int.label}, ${int.semitones > 0 ? "+" : ""}${int.semitones} st (same-octave representatives)`;
  }
  return `<section class="panel transition-panel"><div class="section-title"><div><h2>Motion <span class="unit">½ steps</span></h2></div><select id="transition-pair" aria-label="Chord transition">${pairs.map(([a, b], i) => `<option value="${i}" ${i === transitionIndex ? "selected" : ""}>${esc(nameOf(a))} → ${esc(nameOf(b))}</option>`).join("")}</select></div>${help("Chord motion", "Sorted sounding pitches are paired by rank, lowest to lowest. These are not inferred independent voices or optimized voice leading. Signed distances include octaves. Extra notes enter or leave explicitly.")}<div class="transition-grid">${compareRanks(
    an,
    bn,
  )
    .map(
      (row, i) =>
        `<div class="transition-row"><span>${i === 0 ? "Bass" : `L${i + 1}`}</span><strong>${row.from ? pretty(row.from.name) : "enters"}</strong><span class="transition-line" style="--note-color:${row.interval ? s[`color${row.interval.colorIndex}`] : "#959da8"}"></span><strong>${row.to ? pretty(row.to.name) : "leaves"}</strong><b style="color:${row.interval ? s[`color${row.interval.colorIndex}`] : "inherit"}">${row.interval ? `${row.interval.semitones > 0 ? "+" : ""}${row.interval.semitones} · ${row.interval.label}` : "—"}</b></div>`,
    )
    .join(
      "",
    )}</div><div class="transition-summary" ${hint(rootMovement || "Chord roots could not be recognized.")} tabindex="0">Common: ${common.length ? common.map((pc) => pretty(spellPitch(60 + pc, s).replace(/\d+$/, ""))).join(", ") : "none"}</div></section>`;
}
function wheel(chromatic = false) {
  const s = project().settings,
    isMinor = [5, 10, 11].some(
      (i) => maskFor(s.tonic, SCALE_DEFS[i].intervals) === s.keyMask,
    ),
    order = chromatic ? Array.from({ length: 12 }, (_, i) => i) : FIFTHS;
  return `<div class="wheel" aria-label="${chromatic ? "Chromatic pitch wheel" : "Circle of fifths"}"><div class="wheel-ring"></div><div class="wheel-center"><small>${chromatic ? "COLLECTION" : "TONIC"}</small><strong>${pretty(tonicName(s))}</strong><span>${currentScale(s.tonic, s.keyMask)?.name.split(" / ")[0] ?? "Custom"}</span></div>${order
    .map((pc, i) => {
      const angle = ((i * 30 - 90) * Math.PI) / 180,
        x = 50 + 42 * Math.cos(angle),
        y = 50 + 42 * Math.sin(angle),
        minor = mod(pc - 3),
        minorName = spellPitch(60 + minor, {
          ...s,
          tonic: pc,
          tonicSpelling: TONICS[pc],
          keyMask: maskFor(pc, SCALE_DEFS[0].intervals),
        }).replace(/-?\d+$/, "");
      return `<button class="wheel-note ${!isMinor && pc === s.tonic ? "current" : ""} ${s.keyMask & (1 << pc) ? "member" : ""}" data-wheel="${pc}" data-wheel-mode="${chromatic ? "mask" : "major"}" data-pc="${pc}" style="left:${x}%;top:${y}%;--note-color:${s[`color${mod(pc - s.tonic)}`]}" aria-label="${chromatic ? "Toggle key tone" : "Choose major key"} ${esc(pretty(TONICS[pc]))}" aria-pressed="${chromatic ? !!(s.keyMask & (1 << pc)) : !isMinor && pc === s.tonic}">${pretty(TONICS[pc])}</button>${chromatic ? "" : `<button class="relative-minor ${isMinor && minor === s.tonic ? "current" : ""}" data-wheel="${minor}" data-wheel-mode="minor" data-tonic-name="${minorName}" style="left:${50 + 29 * Math.cos(angle)}%;top:${50 + 29 * Math.sin(angle)}%" aria-label="Choose relative minor key ${esc(pretty(minorName))}">${pretty(minorName)}m</button>`}`;
    })
    .join(
      "",
    )}</div><div class="wheel-math">${chromatic ? "n → (n + 1) mod 12" : "n → (n + 7) mod 12"}${help("Pitch wheel", chromatic ? "Adjacent pitch classes differ by one half step. Click to toggle a pitch class in the collection." : "Clockwise steps add 7 half steps modulo 12: perfect fifths. The inner ring selects relative minor keys. Outer-ring buttons select major keys.")}</div>`;
}
function scaleSteps() {
  const s = project().settings;
  const offsets = pcsFor(s.keyMask).map((pc) => mod(pc - s.tonic)).sort((a, b) => a - b);
  if (!offsets.length) return "";
  return `<div class="scale-steps"><span class="unit">Scale · ½ steps · Σ = 12</span><div>${offsets.map((n, i) => {
    const next = offsets[(i + 1) % offsets.length] + (i + 1 === offsets.length ? 12 : 0);
    return `<span class="scale-node"><b>${pretty(spellPitch(60 + mod(s.tonic + n), s).replace(/-?\d+$/, ""))}</b><small>+${next - n} →</small></span>`;
  }).join("")}</div></div>`;
}
function toolsPanel() {
  const p = project(),
    s = p.settings;
  const selected = current();
  const passage =
    selected?.kind === "melody"
      ? p.events.filter((e) => e.kind === "melody")
      : selected
        ? [selected]
        : [];
  const midis = passage.flatMap((e) => e.notes.map((n) => midiOf(n, s)));
  const candidates = compatibleCollections(midis, s.tonic).slice(0, 5);
  return `<section class="panel music-tools"><div class="tool-tabs" aria-label="Theory tools">${[
    ["fifths", "Fifths"],
    ["chromatic", "Pitch wheel"],
    
  ]
    .map(
      ([id, label]) =>
        `<button data-tools-tab="${id}" aria-pressed="${toolsTab === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div>${wheel(toolsTab === "chromatic")}${scaleSteps()}<details id="mode-analysis"><summary>Compatible scales & modes</summary>${help("Compatible scales", "Pitch compatibility is not proof of a tonal center. Melody comparison uses all melody events; chords use only the selected event. Missing pitches in a short phrase do not rule out a scale.")}${candidates.map((c) => `<div class="mode-candidate"><strong>${pretty(TONICS[c.root])} ${c.name}</strong><small>${c.contained.length} present · ${c.missing.length} absent · ${c.outside.length} outside</small></div>`).join("") || "<p>Choose some notes first.</p>"}</details></section>`;
}

function settings() {
  const s = project().settings;
  const group = (title, text) => `<h3>${title}${help(title, text)}</h3>`;
  return `<details id="settings-panel" class="panel settings-panel"><summary>Settings</summary><div class="settings-content"><div class="settings-top"><label><input type="checkbox" id="show-random" ${showRandom ? "checked" : ""}> Randomization flags</label>${help("Randomization", "Checked ↝ settings may change during Randomize; unchecked values stay fixed. Locks protect individual events.")}<div class="button-row"><button data-action="keep-fixed">Fix all</button><button data-action="enable-random">Enable all</button></div></div><div class="settings-grid"><section>${group("Instrument", "Fret numbers are physical and absolute, not relative to the capo. Instrument changes ask how to preserve the music.")}<label class="preset-field">Tuning<select id="instrument-preset"><option value="">Choose…</option>${Object.keys(PRESETS).map((name) => `<option>${name}</option>`).join("")}</select></label>${["stringCount", "fretCount", "capo", "fretMin", "fretMax"].map((id) => field(id)).join("")}<details id="individual-tuning"><summary>Strings & octaves</summary>${help("Tuning", "String 1 is the first physical string, initially the lowest. Re-entrant tuning preserves string identity. Enter a note and octave, such as E2.")}${stringsOf(s).map((string) => `<div class="tuning-row"><label>S${string.index + 1}<input data-tuning="${string.index}" aria-label="String ${string.index + 1} open pitch" value="${pretty(spellPitch(string.open, s))}"></label>${randomBox(`open${string.index}`)}${field(`enabled${string.index}`, "Use")}</div>`).join("")}</details></section><section>${group("Pattern", "The same seed and settings generate the same notes. Fret span constrains reach but does not guarantee ergonomic fingering. MIDI numbers specify absolute pitch; leap limits are half steps.")}${["generationType", "eventCount", "inKey", "allowOpen", "maxSpan", "maxLeap", "repeatNotes", "lowPitch", "highPitch", "chordVocabulary", "restRate", "seed"].map((id) => field(id)).join("")}<button data-action="new-seed">New seed</button></section><section>${group("Rhythm", "Tempo counts quarter notes. In 6/8, 9/8 and 12/8 the metronome groups eighths in threes. Duration and picking are defaults for new events; existing events are edited in the timeline. Finger letters: p thumb, i index, m middle, a ring.")}${["tempo", "meter", "duration", "picking", "fingerPattern"].map((id) => field(id)).join("")}${group("Sound", "Volume zero mutes playback. Audition plays notes while editing. Stop cancels scheduled sound.")}${["volume", "waveform", "loop", "metronome", "audition"].map((id) => field(id)).join("")}</section><section>${group("Display", "The ½ steps switch adds numerical distances on the fretboard. Tonic and chord-root distances are modulo 12; a pinned MIDI note retains signed register distance. Turn it off to see the selected Notes / Degrees label mode without added half-step numbers.")}${["labels", "showOctaves", "accidentals", "tonicSpelling", "leftHanded", "editorMode", "append"].map((id) => field(id)).join("")}<details id="color-settings"><summary>Interval colors</summary>${COLORS.map((_, i) => field(`color${i}`, `${i} · ${INTERVALS[i]}`)).join("")}</details><details id="examples"><summary>Examples</summary><div class="button-row"><button data-example="compare">C → Cm</button><button data-example="progression">I · vi · IV · V</button><button data-example="melody">A minor</button><button data-example="bass">Bass</button></div></details></section></div></div></details>`;
}

function render() {
  hideHelp();
  colorAnalysis = analysis();
  const panelScroll = [...document.querySelectorAll("[data-panel]")].map(n => [n.dataset.panel, n.querySelector(".dock-body")?.scrollTop ?? 0]);
  const open = [...document.querySelectorAll("details[open]")].map((e) => e.id);
  const active = document.activeElement, activeId = active?.id, activePos = active?.dataset?.pos;
  const scrolls = [...document.querySelectorAll('.board-scroll,.matrix-scroll,.timeline')].map((el) => [el.className, el.scrollLeft, el.scrollTop]);
  const p = project(), s = p.settings, e = current();
  const reference = s.colorReference === "pinned" ? pretty(spellPitch(s.pinnedMidi, s)) : s.colorReference === "chord" && colorAnalysis.selected ? pretty(chordLabel({...colorAnalysis.selected, bass: colorAnalysis.selected.root}, s)) + " root" : pretty(tonicName(s)) + " tonic";
  $("#app").innerHTML = `<header class="topbar"><a class="brand" href="./" aria-label="ToneDef home" ${hint("ToneDef · guitar and bass workspace by GeneralGroovy")}><span class="brand-icon">t<span>d</span></span></a><div class="project-title"><input id="project-title" aria-label="Project name" maxlength="120" value="${esc(p.title)}"></div><div class="header-actions"><button data-action="undo" ${!history.past.length ? "disabled" : ""} aria-label="Undo" ${hint("Undo · Ctrl/Command+Z")}>Undo</button><button data-action="redo" ${!history.future.length ? "disabled" : ""} aria-label="Redo" ${hint("Redo · Ctrl/Command+Shift+Z")}>Redo</button><button id="playButton" class="primary" data-action="play" aria-pressed="${player.running}">▶ Play</button><button data-action="stop" aria-label="Stop playback">■ Stop</button><button data-action="projects">Projects</button><button data-action="settings" ${hint("Instrument, generation, rhythm, sound and display settings.")}>Settings</button><button class="help-trigger" data-action="help" aria-label="Help and keyboard shortcuts">?</button></div></header><main><section class="context-bar" aria-label="Key and interval reference"><div class="context-fields">${field("tonic")}${collectionControl()}</div><div class="key-tones" aria-label="Current key tones">${pcsFor(s.keyMask).map((pc) => `<button data-key-pc="${pc}" data-pc="${pc}" title="Remove ${pretty(TONICS[pc])} from key" style="--note-color:${s[`color${mod(pc - s.tonic)}`]}">${pretty(spellPitch(60 + pc, s).replace(/\d+$/, ""))}</button>`).join("") || "<span>No key tones</span>"}${!(s.keyMask & (1 << s.tonic)) ? '<span class="warning-text">Tonic outside collection</span>' : ""}</div><div class="reference-row">${field("colorReference")}<span class="reference-readout">${esc(reference)}</span></div></section><div class="workspace"><section class="panel fretboard-panel"><h1 class="sr-only">Fretboard</h1><div class="board-bar"><div class="segmented" aria-label="Editor mode"><button data-mode="chord" aria-pressed="${s.editorMode === "chord"}">Chord</button><button data-mode="melody" aria-pressed="${s.editorMode === "melody"}">Melody</button></div><div class="segmented small" aria-label="Fretboard tool"><button data-tool="notes" aria-pressed="${tool === "notes"}" ${hint("Click a fret to edit a note. Chord mode keeps one note per string; another click removes it.")}>Edit notes</button><button data-tool="key" aria-pressed="${tool === "key"}" ${hint("Edit the pitch-class collection without changing notes. Right-click / Shift+F10 also edits the key.")}>Edit key</button></div>${s.editorMode === "melody" ? field("append", "Append") : ""}<button id="half-step-labels" data-action="half-step-labels" aria-pressed="${halfStepLabels}" ${hint("Show numeric half-step distances on the fretboard, relative to the selected Reference. Tonic and chord-root values are modulo 12; a pinned MIDI reference gives signed distances including octaves.")}>½ steps</button><span class="board-context">${e?.locked ? "▣ Locked · " : ""}${esc(e ? nameOf(e) : "—")}${halfStepLabels ? s.colorReference === "pinned" ? " · signed ½ steps" : " · mod 12" : ""}</span>${help("Fretboard", "Arrow keys move; Enter or Space toggles a note; Shift+F10 changes key membership. Filled discs are selected notes; outlined discs are key tones; double outlines are tonics. × marks a muted string. The chosen reference determines interval colors. Lines connect chord positions across physical strings; dashed spans cross muted strings. They do not indicate barres or voice leading.")}</div>${board()}<div class="interval-legend" aria-label="Interval color key in half steps"><span class="unit">½ steps</span>${INTERVALS.map((name, i) => `<span class="interval-key" style="--note-color:${s[`color${i}`]}" ${hint(`${i} half steps · ${name}. Interval color is repeated each octave.`)} tabindex="0"><i></i><b>${i}</b><small>${name}</small></span>`).join("")}</div></section>${timeline()}<div class="theory-row">${inspector()}${toolsPanel()}${intervalWorkspace(colorAnalysis.notes, s, intervalPair)}${transition()}</div></div>${settings()}<footer><span ${hint("Twelve-tone equal temperament; A4 = 440 Hz. Frequency ratio for n half steps is 2^(n/12).")} tabindex="0">12-TET · A4 440 Hz</span><button data-action="export-json" ${hint("Export your project as JSON. Projects otherwise stay in this browser.")}>Backup ↗</button></footer></main><dialog id="modal"></dialog>`;
  mountWorkspace(render, notify);
  for (const [id, top] of panelScroll) {
    const body = document.querySelector('[data-panel="'+id+'"] .dock-body');
    if (body) body.scrollTop = top;
  }
  boardObserver?.disconnect();
  boardObserver = new ResizeObserver(drawChordShape);
  boardObserver.observe(document.getElementById('fretboard'));
  drawChordShape();
  for (const id of open) { const detail = document.getElementById(id); if (detail) detail.open = true; }
  prepareHelp($("#app"));
  if (activePos) document.querySelector(`[data-pos="${activePos}"]`)?.focus({preventScroll: true});
  else if (activeId) document.getElementById(activeId)?.focus({preventScroll: true});
  for (const [className, left, top] of scrolls) {
    const node = document.getElementsByClassName(className)[0];
    if (node) { node.scrollLeft = left; node.scrollTop = top; }
  }
}
function openModal(html) {
  const modal = $("#modal");
  modal.innerHTML = `<div class="modal-content"><button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>${html}</div>`;
  hideHelp();
  prepareHelp(modal);
  modal.showModal();
}
function instrumentChange(s) {
  const impact = instrumentImpact(project(), s);
  if (!impact.length) {
    commit(reconcileInstrument(project(), s));
    return;
  }
  pendingInstrument = s;
  openModal(
    `<h2>Keep the music intentional</h2><p>${impact.length} note positions would change pitch or no longer fit this instrument.</p><p>Choose how to reconcile them. If a note cannot be preserved, the change is rejected. Your previous instrument remains available with Undo.</p><div class="button-stack"><button data-action="apply-instrument" data-policy="pitches">Keep sounding pitches · find new positions</button><button data-action="apply-instrument" data-policy="positions">Keep physical positions · retune notes</button><button data-action="close-modal">Cancel change</button></div>`,
  );
}
function setSetting(id, value) {
  const next = clone(project());
  if (
    ["stringCount", "fretCount", "capo"].includes(id) ||
    /^open\d+$/.test(id)
  ) {
    next.settings[id] = value;
    instrumentChange(next.settings);
    return;
  }
  if (id === "tonic") {
    next.settings.tonicSpelling = "auto";
    const scale = currentScale(next.settings.tonic, next.settings.keyMask);
    if (scale) next.settings.keyMask = maskFor(value, scale.intervals);
  }
  next.settings[id] = value;
  commit(next);
}
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function runGeneration(mode) {
  player.stop();
  if (worker) worker.terminate();
  const baseline = JSON.stringify(project());
  worker = new Worker(new URL("./generation-worker.js", import.meta.url), {
    type: "module",
  });
  worker.onmessage = ({ data }) => {
    worker.terminate();
    worker = null;
    if (JSON.stringify(project()) !== baseline) {
      render();
      notify(
        "Project changed while generating. The generated result was discarded.",
      );
      return;
    }
    if (!data.ok) {
      render();
      notify(data.error, true);
      return;
    }
    if (mode === "randomize" && JSON.stringify(data.project) === baseline) {
      render();
      notify(
        "Nothing changed. Enable a randomization checkbox or pattern content to explore a variation.",
      );
      return;
    }
    attempt(() =>
      commit(
        data.project,
        mode === "randomize"
          ? `Changed ${data.changed.length} setting${data.changed.length === 1 ? "" : "s"}${project().randomPattern ? " and regenerated the pattern" : ""}.`
          : "Pattern generated from the saved seed.",
      ),
    );
  };
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    render();
    notify("Generation failed. The project is unchanged.", true);
  };
  worker.postMessage({ mode, project: clone(project()) });
  render();
}
function library() {
  try {
    const data = JSON.parse(localStorage.getItem(LIBRARY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function projectsModal() {
  openModal(
    `<h2>Your projects</h2><label class="preset-field">Name for saved copy<input id="save-name" maxlength="120" value="${esc(project().title)}"></label><p>Saved on this device. Export JSON to move a project or keep a separate backup.</p><div class="button-row"><button data-action="save-library">Save named copy</button><button data-action="new-project">New blank project</button><button data-action="export-json">Export JSON</button><button data-action="export-tab">Export tab</button><label class="button file-button">Import JSON<input id="import-file" type="file" accept=".json,application/json"></label></div><div class="saved-projects">${
      library()
        .map(
          (p, i) =>
            `<button data-load-project="${i}">${esc(p.title)} <small>${p.events?.length ?? 0} events</small></button>`,
        )
        .join("") || "<p>No named copies saved yet.</p>"
    }</div>`,
  );
}
document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  attempt(() => {
    if (target.dataset.intervalFrom !== undefined) {
      intervalPair = [Number(target.dataset.intervalFrom), Number(target.dataset.intervalTo)];
      render();
      return;
    }
    if (target.dataset.pos) {
      const [stringId, fret] = target.dataset.pos.split(":");
      commit(editPosition(project(), stringId, Number(fret), tool === "key"));
      if (project().settings.audition && tool === "notes")
        player
          .audition(
            [midiOf({ stringId, fret: Number(fret) }, project().settings)],
            project().settings,
          )
          .catch((e) => notify(e.message, true));
      return;
    }
    if (target.dataset.mode) {
      mutate((p) => {
        p.settings.editorMode = target.dataset.mode;
        p.settings.append = false;
        const e = p.events.find((x) => x.kind === target.dataset.mode);
        if (e) p.selectedId = e.id;
        else {
          const added = emptyEvent(target.dataset.mode, p.settings.duration);
          p.events.push(added);
          p.selectedId = added.id;
        }
      });
      return;
    }
    if (target.dataset.tool) {
      tool = target.dataset.tool;
      render();
      return;
    }
    if (target.dataset.eventIndex !== undefined) {
      mutate((p) => {
        const e = p.events[Number(target.dataset.eventIndex)];
        if (!e) return;
        p.selectedId = e.id;
        if (e.kind !== "rest") p.settings.editorMode = e.kind;
        p.settings.append = false;
      });
      return;
    }
    if (target.dataset.event) {
      mutate((p) => {
        p.selectedId = target.dataset.event;
        const e = p.events.find((e) => e.id === p.selectedId);
        if (e.kind !== "rest") p.settings.editorMode = e.kind;
        p.settings.append = false;
      });
      return;
    }
    if (target.dataset.pin) {
      mutate((p) => {
        p.settings.pinnedMidi = Number(target.dataset.pin);
        p.settings.colorReference = "pinned";
      });
      return;
    }
    if (target.dataset.toolsTab) {
      toolsTab = target.dataset.toolsTab;
      render();
      return;
    }
    if (target.dataset.keyPc !== undefined) {
      mutate((p) => (p.settings.keyMask ^= 1 << Number(target.dataset.keyPc)));
      return;
    }
    if (target.dataset.wheel !== undefined) {
      const pc = Number(target.dataset.wheel);
      mutate((p) => {
        if (target.dataset.wheelMode === "mask") p.settings.keyMask ^= 1 << pc;
        else {
          p.settings.tonic = pc;
          p.settings.tonicSpelling = target.dataset.tonicName ?? TONICS[pc];
          p.settings.keyMask = maskFor(
            pc,
            SCALE_DEFS[target.dataset.wheelMode === "minor" ? 5 : 0].intervals,
          );
        }
      });
      return;
    }
    if (target.dataset.example) {
      commit(
        example(target.dataset.example),
        "Example loaded. Undo returns to your previous project.",
      );
      return;
    }
    if (target.dataset.loadProject) {
      commit(
        importProject(
          JSON.stringify(library()[Number(target.dataset.loadProject)]),
        ),
        "Project loaded.",
      );
      return;
    }
    const action = target.dataset.action;
    if (action === "half-step-labels") {
      halfStepLabels = !halfStepLabels;
      render();
    } else if (action === "settings") {
      revealPanel("settings");
      const panel = document.querySelector("[data-panel=settings]");
      panel.scrollIntoView({behavior: "instant", block: "start"});
      document.getElementById("layout-collapse-settings").focus({preventScroll:true});
    } else if (action === "undo" || action === "redo") {
      player.stop();
      history[action]();
      persist();
      render();
    } else if (action === "play")
      player
        .play(clone(project()))
        .catch((e) => notify("Audio could not start: " + e.message, true));
    else if (action === "stop") player.stop();
    else if (action === "audition")
      player
        .audition(
          analysis().notes.map((n) => n.midi),
          project().settings,
        )
        .catch((e) => notify(e.message, true));
    else if (action === "inspect") {
      revealPanel("inspector");
      $(".inspector").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    else if (action === "projects") projectsModal();
    else if (action === "close-modal") {
      $("#modal").close();
      if (pendingInstrument) {
        pendingInstrument = null;
        render();
      }
    } else if (action === "help")
      openModal(
        `<h2>Controls & shortcuts</h2><ol><li>Choose a tonic and collection. The rings on the neck show its tones.</li><li>In Chord mode, click a position on each string. A second click removes it; another fret on that string replaces it.</li><li>In Melody mode, edit the selected event or turn on Append / record to play in a sequence.</li><li>Right-click a note to change the key collection. On touch, select Edit key. Keyboard: arrows move, Enter/Space edits, Shift F10 edits the key.</li><li>Select timeline cards to inspect notes, intervals and chord transitions. Play hears exactly those events.</li><li>Generate respects the current settings. Randomize changes only checked settings and, if enabled, unlocked pattern events.</li></ol><p>Scale compatibility is not a diagnosis of key. Chord names can be ambiguous. Colored intervals always have a labeled reference.</p><p>Undo/redo: Ctrl or Command + Z / Shift Z. Space on the page toggles playback; inside the fretboard it edits the focused position.</p>`,
      );
    else if (action === "apply-instrument") {
      commit(
        reconcileInstrument(
          project(),
          pendingInstrument,
          target.dataset.policy,
        ),
        "Instrument updated.",
      );
      pendingInstrument = null;
    } else if (action === "generate" || action === "randomize")
      runGeneration(action);
    else if (action === "cancel-generation") {
      worker?.terminate();
      worker = null;
      render();
      notify("Generation cancelled.");
    } else if (action === "new-seed")
      mutate(
        (p) =>
          (p.settings.seed =
            (crypto.getRandomValues(new Uint32Array(1))[0] % 2147483645) + 1),
      );
    else if (action === "keep-fixed" || action === "enable-random")
      mutate((p) =>
        Object.keys(p.randomize).forEach(
          (k) => (p.randomize[k] = action === "enable-random"),
        ),
      );
    else if (action === "add")
      mutate((p) => {
        if (p.events.length >= MAX_EVENTS)
          throw Error("Project event limit reached.");
        const e = emptyEvent(target.dataset.kind, p.settings.duration);
        e.picking = p.settings.picking;
        e.fingers = p.settings.fingerPattern;
        p.events.push(e);
        p.selectedId = e.id;
        if (e.kind !== "rest") p.settings.editorMode = e.kind;
        p.settings.append = false;
      });
    else if (action === "lock-event")
      mutate((p) => {
        const e = p.events.find((e) => e.id === p.selectedId);
        e.locked = !e.locked;
      });
    else if (action === "delete-event")
      mutate((p) => {
        const i = p.events.findIndex((e) => e.id === p.selectedId);
        if (p.events[i]?.locked)
          throw Error("Unlock the event before deleting it.");
        p.events.splice(i, 1);
        p.selectedId = p.events[Math.min(i, p.events.length - 1)]?.id ?? null;
      });
    else if (action === "duplicate")
      mutate((p) => {
        if (p.events.length >= MAX_EVENTS)
          throw Error("Project event limit reached.");
        const i = p.events.findIndex((e) => e.id === p.selectedId);
        if (i < 0) return;
        const e = clone(p.events[i]);
        e.id = uid();
        e.notes.forEach((n) => (n.id = uid()));
        e.locked = false;
        p.events.splice(i + 1, 0, e);
        p.selectedId = e.id;
      });
    else if (action === "move")
      mutate((p) => {
        const i = p.events.findIndex((e) => e.id === p.selectedId),
          j = i + Number(target.dataset.delta);
        if (j < 0 || j >= p.events.length) return;
        if (p.events[i].locked || p.events[j].locked)
          throw Error("Unlock these events before reordering them.");
        [p.events[i], p.events[j]] = [p.events[j], p.events[i]];
      });
    else if (action === "new-project")
      commit(
        defaultProject(),
        "New blank project. Undo returns to your previous work.",
      );
    else if (action === "save-library") {
      const saved = library();
      const named = clone(project());
      named.title = $("#save-name").value;
      validateProject(named);
      saved.unshift(named);
      localStorage.setItem(LIBRARY, JSON.stringify(saved.slice(0, 20)));
      projectsModal();
      notify("Named copy saved on this device.");
    } else if (action === "export-json")
      download(
        "tonedef-project.json",
        JSON.stringify(project(), null, 2),
        "application/json",
      );
    else if (action === "export-tab")
      download("tonedef-pattern.txt", tabExport(project()), "text/plain");
  });
});
document.addEventListener("contextmenu", (event) => {
  const target = event.target.closest("[data-pos]");
  if (!target) return;
  event.preventDefault();
  attempt(() => {
    const [stringId, fret] = target.dataset.pos.split(":");
    commit(editPosition(project(), stringId, Number(fret), true));
  });
});
document.addEventListener("change", (event) => {
  const el = event.target;
  attempt(() => {
    if (el.dataset.setting) {
      const id = el.dataset.setting,
        def = SCHEMA[id];
      setSetting(
        id,
        def.type === "checkbox"
          ? el.checked
          : typeof def.value === "number"
            ? Number(el.value)
            : el.value,
      );
    } else if (el.dataset.random)
      mutate((p) => (p.randomize[el.dataset.random] = el.checked));
    else if (el.dataset.collection !== undefined) {
      if (el.value === "custom") return;
      mutate(
        (p) =>
          (p.settings.keyMask = maskFor(
            p.settings.tonic,
            SCALE_DEFS[Number(el.value)].intervals,
          )),
      );
    } else if (el.id === "show-random") {
      showRandom = el.checked;
      render();
    } else if (el.id === "random-pattern")
      mutate((p) => (p.randomPattern = el.checked));
    else if (el.id === "project-title") mutate((p) => (p.title = el.value));
    else if (el.id === "instrument-preset" && el.value) {
      const next = { ...project().settings },
        tuning = PRESETS[el.value];
      next.stringCount = tuning.length;
      tuning.forEach((pitch, i) => (next[`open${i}`] = pitch));
      instrumentChange(next);
    } else if (el.dataset.tuning !== undefined) {
      const note = parseNote(el.value);
      if (note?.midi === null || !note)
        throw Error("Enter a pitch with octave, such as E2 or B♭1.");
      setSetting(`open${el.dataset.tuning}`, note.midi);
    } else if (el.dataset.eventField)
      mutate((p) => {
        const e = p.events.find((e) => e.id === p.selectedId);
        if (e.locked) throw Error("Unlock this event first.");
        e[el.dataset.eventField] =
          el.dataset.eventField === "duration" ? Number(el.value) : el.value;
      });
    else if (el.dataset.spelling)
      mutate((p) => {
        const e = p.events.find((e) => e.id === p.selectedId);
        if (e.locked) throw Error("Unlock this event first.");
        const n = e.notes.find((n) => n.id === el.dataset.spelling);
        const parsed = parseNote(el.value);
        if (parsed?.midi !== midiOf(n, p.settings))
          throw Error(
            "That spelling changes the pitch. Use an enharmonic name with the same octave-aware pitch.",
          );
        n.spelling = el.value.replaceAll("♭", "b").replaceAll("♯", "#");
      });
    else if (el.id === "interpretation")
      mutate(
        (p) =>
          (p.events.find((e) => e.id === p.selectedId).interpretation =
            el.value === "auto" ? null : el.value),
      );
    else if (el.id === "compare-event") {
      compareEventId = el.value;
      render();
    } else if (el.id === "transition-pair") {
      transitionIndex = Number(el.value);
      render();
    } else if (el.id === "import-file" && el.files[0]) {
      if (el.files[0].size > 500000)
        throw Error("Project file exceeds 500 KB.");
      el.files[0]
        .text()
        .then((text) =>
          attempt(() => commit(importProject(text), "Project imported.")),
        );
    }
  });
});
document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target.matches("input,textarea,select")) return;
  if (target.dataset.intervalFrom !== undefined && !event.ctrlKey && !event.metaKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    let i = Number(target.dataset.intervalFrom), j = Number(target.dataset.intervalTo);
    const n = analysis().notes.length;
    if (event.key === "ArrowUp") i--;
    else if (event.key === "ArrowDown") i++;
    else if (event.key === "ArrowLeft") j--;
    else if (event.key === "ArrowRight") j++;
    else if (event.key === "Home") j = 0;
    else if (event.key === "End") j = n - 1;
    else return;
    event.preventDefault();
    const next = document.getElementById(`interval-cell-${Math.max(0, Math.min(n-1,i))}-${Math.max(0, Math.min(n-1,j))}`);
    if (next) { target.tabIndex = -1; next.tabIndex = 0; next.focus(); }
    return;
  }
  if (target.dataset.pos) {
    const [stringId, fretText] = target.dataset.pos.split(":"),
      fret = Number(fretText),
      index = Number(stringId.slice(1)),
      s = project().settings;
    let next = null;
    if (event.key === "ArrowUp") next = `s${index + 1}:${fret}`;
    if (event.key === "ArrowDown") next = `s${index - 1}:${fret}`;
    if (event.key === "ArrowLeft")
      next = `${stringId}:${fret + (s.leftHanded ? 1 : -1)}`;
    if (event.key === "ArrowRight")
      next = `${stringId}:${fret + (s.leftHanded ? -1 : 1)}`;
    if (event.key === "Home") next = `${stringId}:${s.capo}`;
    if (next) {
      event.preventDefault();
      const button = document.querySelector(`[data-pos="${next}"]`);
      if (button) {
        target.tabIndex = -1;
        button.tabIndex = 0;
        button.focus();
        focusPos = next;
      }
      return;
    }
    if (event.key === "F10" && event.shiftKey) {
      event.preventDefault();
      attempt(() => commit(editPosition(project(), stringId, fret, true)));
      return;
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    player.stop();
    history[event.shiftKey ? "redo" : "undo"]();
    persist();
    render();
  } else if (
    event.code === "Space" &&
    !target.closest("button,dialog,summary")
  ) {
    event.preventDefault();
    if (player.running) player.stop();
    else player.play(clone(project())).catch((e) => notify(e.message, true));
  }
});
document.addEventListener("focusin", (event) => {
  if (event.target.dataset.pos) focusPos = event.target.dataset.pos;
});
let dragged = null;
document.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-event]");
  if (card) {
    dragged = card.dataset.event;
    event.dataTransfer.setData("text/plain", dragged);
  }
});
document.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-event]")) event.preventDefault();
});
document.addEventListener("drop", (event) => {
  const card = event.target.closest("[data-event]");
  if (!card || !dragged) return;
  event.preventDefault();
  attempt(() =>
    mutate((p) => {
      const from = p.events.findIndex((e) => e.id === dragged),
        to = p.events.findIndex((e) => e.id === card.dataset.event);
      if (from < 0 || to < 0) return;
      if (
        p.events
          .slice(Math.min(from, to), Math.max(from, to) + 1)
          .some((e) => e.locked)
      )
        throw Error("Unlock these events before reordering.");
      const [e] = p.events.splice(from, 1);
      p.events.splice(to, 0, e);
    }),
  );
  dragged = null;
});
document.addEventListener("pointerover", (event) => {
  const pc = event.target.closest("[data-pc]")?.dataset.pc;
  if (pc === undefined) return;
  hoverPc = pc;
  document
    .querySelectorAll("[data-pc]")
    .forEach((el) => el.classList.toggle("linked", el.dataset.pc === pc));
});
document.addEventListener("pointerout", (event) => {
  if (event.relatedTarget?.closest?.("[data-pc]")) return;
  hoverPc = null;
  document
    .querySelectorAll(".linked")
    .forEach((el) => el.classList.remove("linked"));
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && player.running) {
    player.stop();
    notify("Playback stopped while the app was in the background.");
  }
});
render();
if (bootNotice) notify(bootNotice, true);

document.addEventListener(
  "cancel",
  (event) => {
    if (event.target.id === "modal" && pendingInstrument) {
      event.preventDefault();
      pendingInstrument = null;
      render();
    }
  },
  true,
);
