import { PPQ, midiOf, stringsOf, tabExport, validateProject } from "./model.js";
import { spellPitch } from "./theory.js";

const markdown = value => String(value).replace(/[\r\n\t]/g, " ")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/[\\`*_{}\[\]()#+.!|~-]/g, "\\$&");

/** Portable practice-journal snapshot of the actual edited pattern. */
export function practiceCard(project) {
  validateProject(project);
  const s = project.settings;
  const ticks = project.events.reduce((sum, event) => sum + event.duration, 0);
  const rows = project.events.map((event, index) => {
    const notes = event.notes.map(note => spellPitch(midiOf(note, s), s)).join(", ");
    return `| ${index + 1} | ${event.kind} | ${markdown(notes || "—")} | ${event.duration} | ${event.picking} | ${event.locked ? "yes" : "no"} |`;
  });
  return [
    `# ${markdown(project.title || "Untitled pattern")}`,
    "", "ToneDef practice card", "",
    `- Tempo: ${s.tempo} quarter notes / minute; meter: ${s.meter}`,
    `- One pass: ${(ticks / PPQ * 60 / s.tempo).toFixed(2)} seconds; ${project.events.length} events`,
    `- Tuning (physical string 1 first): ${stringsOf(s).map(string => spellPitch(string.open, s)).join(", ")}`,
    `- Capo: physical fret ${s.capo}; tab uses absolute physical fret numbers`,
    `- String practice ranges (physical frets): ${stringsOf(s).map(string => `S${string.index + 1}: ${s.practiceRanges[string.index].min}–${s.practiceRanges[string.index].max}${string.enabled ? "" : " (off)"}`).join(", ")}`,
    `- Generator settings: ${s.generationType}; seed ${s.seed}; melody contour ${s.melodicContour}`,
    "", "## Practice notes", "",
    "- Date: ", "- Focus: ", "- Comfortable tempo: ", "- Next session: ", "",
    "- [ ] Play slowly enough to keep the rhythm even.",
    "- [ ] Check notes and rests against the event table.",
    "- [ ] Record what to repeat or change next time.", "",
    "## Pattern", "",
    "| Event | Kind | Sounding pitches | Ticks | Picking | Locked |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows, "", `${PPQ} ticks = one quarter note.`, "",
    "```text", tabExport({ ...project, title: "Pattern" }), "```", "",
    "This card records the current edited pattern. Generator settings alone do not reproduce manual edits or locked events; keep the JSON backup for re-import.", "",
  ].join("\n");
}
