import { mod, intervalBetween, pretty } from './theory.js';

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const signed = (n) => n > 0 ? `+${n}` : String(n);

/** Actual register is retained. Modulo 12 is a separate, labelled result. */
export function distanceData(from, to) {
  if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n <= 127))
    throw new RangeError('Expected MIDI pitches from 0 to 127.');
  const steps = to - from;
  return { steps, pitchClass: mod(steps), cents: steps * 100,
    ratio: 2 ** (steps / 12), fromHz: 440 * 2 ** ((from - 69) / 12),
    toHz: 440 * 2 ** ((to - 69) / 12) };
}

/** Equal horizontal distances mean equal half-step distances, not equal Hz. */
export function pitchGeometry(midis) {
  if (!midis.length) return { min: 0, max: 12, groups: [] };
  if (!midis.every((n) => Number.isInteger(n) && n >= 0 && n <= 127))
    throw new RangeError('Expected MIDI pitches from 0 to 127.');
  const min = Math.min(...midis), max = Math.max(min + 12, ...midis);
  const unique = [...new Set(midis)].sort((a, b) => a - b);
  return { min, max, groups: unique.map((midi) => ({ midi,
    x: 24 + (midi - min) / (max - min) * 432,
    indices: midis.flatMap((n, i) => n === midi ? [i] : []) })) };
}

export function intervalWorkspace(notes, settings, pair = [0, 1]) {
  const heading = '<div class="section-title"><h2>Compare two notes</h2></div>';
  if (!notes.length) return `<section class="panel math-panel" aria-label="Compare two notes">${heading}<p class="empty">Select notes on the fretboard to compare their interval.</p></section>`;
  const clamp = n => Number.isInteger(n) ? Math.max(0, Math.min(n, notes.length - 1)) : 0;
  const from = clamp(pair[0]), to = clamp(pair[1]);
  const a = notes[from], b = notes[to], data = distanceData(a.midi, b.midi);
  const interval = intervalBetween(a.name, b.name);
  const quality = {P:'Perfect', M:'Major', m:'Minor', A:'Augmented', d:'Diminished'}[interval.quality] ?? interval.quality;
  const number = ['','unison','second','third','fourth','fifth','sixth','seventh','octave','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth'][interval.number] ?? `${interval.number}th`;
  const select = (end, selected) => `<label>${end ? 'To' : 'From'}<select id="interval-${end ? 'to' : 'from'}" data-interval-end="${end}">${notes.map((n, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${esc(pretty(n.name))}${n.eventIndex ? ` · Event ${n.eventIndex}` : n.context ? ` · ${esc(n.context)}` : n.stringId ? ` · String ${Number(n.stringId.slice(1))+1}` : ''}</option>`).join('')}</select></label>`;
  const geometry = pitchGeometry([a.midi, b.midi]);
  const ticks = Array.from({length: geometry.max - geometry.min + 1}, (_, i) => {
    const x = 24 + i / (geometry.max - geometry.min) * 432;
    return `<line x1="${x}" x2="${x}" y1="35" y2="${i % 12 === 0 ? 46 : 41}"/><text x="${x}" y="60">${i % 12 === 0 || i === geometry.max - geometry.min ? i : ''}</text>`;
  }).join('');
  const diagram = `<svg class="pitch-axis" viewBox="0 0 480 68" role="img" aria-label="Compared pitches spaced by semitones from the lower pitch"><line x1="24" x2="456" y1="35" y2="35"/>${ticks}${geometry.groups.map(g => `<g><circle cx="${g.x}" cy="35" r="5" class="axis-active"/><text x="${g.x}" y="20">${esc(pretty(g.midi === a.midi ? a.name : b.name))}</text></g>`).join('')}</svg>`;
  return `<section class="panel math-panel" aria-label="Compare two notes">${heading}<div class="interval-picker">${select(0,from)}<button id="interval-swap" data-interval-swap aria-label="Swap interval direction" title="Swap direction">⇄</button>${select(1,to)}</div><div class="math-readout" aria-live="polite" style="--interval-color:${settings[`color${interval.colorIndex}`]}"><strong>${esc(quality)} ${esc(number)}</strong><span>${interval.direction === 'same pitch' ? 'Same pitch' : interval.direction === 'down' ? '↓ Descending' : '↑ Ascending'} · ${signed(data.steps)} semitones <small>(${esc(interval.label)})</small></span></div><details id="pitch-detail"><summary>Frequency & pitch distance</summary><p>One semitone is one half step. Distances include octaves; frequencies use twelve-tone equal temperament.</p><div class="equation"><span>f₂ / f₁ = 2<sup>${data.steps}/12</sup></span><b>× ${data.ratio.toFixed(4)}</b></div><div class="math-values"><span>${data.fromHz.toFixed(2)} → ${data.toHz.toFixed(2)} Hz</span><span>${signed(data.cents)} cents</span><span>Pitch-class distance: ${data.pitchClass} (mod 12)</span></div>${diagram}<div class="axis-caption">Semitones from the lower pitch</div></details></section>`;
}
