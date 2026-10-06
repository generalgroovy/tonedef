export function patternPositions(events) {
  return new Set(events.flatMap(event => event.notes.map(note => `${note.stringId}:${note.fret}`)));
}
export function noteState(inKey, inPattern, current) {
  const kind = inPattern ? (inKey ? 'pattern' : 'pattern-outside') : inKey ? 'key' : 'outside';
  return {kind, classes: `${inPattern ? 'in-pattern' : ''} ${inPattern && !inKey ? 'pattern-outside' : ''} ${current ? 'current-note' : ''}`};
}
export function noteLegend(project) {
  const outside = project.events.some(event => event.notes.some(note => {
    const midi = project.settings['open'+note.stringId.slice(1)] + note.fret;
    return !(project.settings.keyMask & (1 << (midi % 12)));
  }));
  return `<div class="note-state-legend" aria-label="Fretboard symbols"><span><i class="state-outside"></i>Outside key</span><span><i class="state-key"></i>In key</span><span><i class="state-pattern"></i>In pattern</span><span><i class="state-current"></i>Current step</span>${outside?'<span><i class="state-borrowed"></i>Pattern · outside key</span>':''}</div>`;
}
