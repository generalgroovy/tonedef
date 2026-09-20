// Presentation preferences are deliberately separate from the musical project.
export const PANELS = [
  ['fretboard', 'Fretboard', '.fretboard-panel', 12],
  ['timeline', 'Pattern', '.timeline-panel', 12],
  ['inspector', 'Notes & intervals', '.inspector', 4],
  ['math', 'Interval mathematics', '.math-panel', 4],
  ['tools', 'Theory tools', '.music-tools', 4],
  ['transitions', 'Between chords', '.transition-panel', 12],
  ['settings', 'Instrument & practice settings', '#settings-panel', 12],
];
export function normalizeLayout(input = {}) {
  const ids = PANELS.map(p => p[0]);
  const order = [...new Set((Array.isArray(input?.order) ? input.order : []).filter(id => ids.includes(id)))];
  const panels = {};
  for (const [id, , , span] of PANELS) {
    if (!order.includes(id)) order.push(id);
    const p = input?.panels?.[id] ?? {};
    panels[id] = {
      span: Number.isFinite(p.span) ? Math.max(4, Math.min(12, Math.round(p.span))) : span,
      height: Number.isFinite(p.height) ? Math.max(240, Math.min(1200, p.height)) : null,
      hidden: p.hidden === true,
      collapsed: typeof p.collapsed === 'boolean' ? p.collapsed : id === 'settings' || id === 'examples',
    };
  }
  return {version: 1, order, panels};
}
export function movePanel(order, id, target, after = false) {
  if (id === target || !order.includes(id) || !order.includes(target)) return [...order];
  const next = order.filter(x => x !== id);
  next.splice(next.indexOf(target) + Number(after), 0, id);
  return next;
}
export function chordSegments(event, strings) {
  if (event?.kind !== 'chord') return [];
  const positions = strings.map((s, rank) => ({rank, note: event.notes.find(n => n.stringId === s.id)})).filter(p => p.note);
  return positions.slice(1).map((p, i) => ({from: positions[i].note, to: p.note, skipped: p.rank - positions[i].rank > 1}));
}

// Match the selected disc's 70% interval color / 30% white background.
export function selectedInk(color) {
  const channels = [1, 3, 5].map(i => (parseInt(color.slice(i, i + 2), 16) * 0.7 + 255 * 0.3) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.20 ? '#10151b' : '#ffffff';
}
