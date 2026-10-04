import { namedNotes } from './model.js';

// A melody needs neighboring sounding events to explain its intervals. The
// fretboard still edits only the selected event; this is a read-only view.
export function intervalContext(project) {
  const selected = project.events.find(e => e.id === project.selectedId);
  if (selected?.kind !== 'melody') return namedNotes(selected, project.settings);
  const melody = project.events.flatMap((event, index) => event.kind === 'melody' && event.notes.length
    ? [{ event, index }] : []);
  const position = melody.findIndex(({ event }) => event.id === selected.id);
  if (position < 0) return [];
  const start = Math.max(0, Math.min(position - 1, melody.length - 4));
  return melody.slice(start, start + 4).flatMap(({ event, index }) =>
    namedNotes(event, project.settings).map(note => ({ ...note, eventIndex: index + 1 })));
}
