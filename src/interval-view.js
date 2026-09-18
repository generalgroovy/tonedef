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
  const clamp = (n) => Number.isInteger(n) ? Math.max(0, Math.min(n, notes.length - 1)) : 0;
  const from = clamp(pair[0]), to = clamp(pair[1]);
  const help = (text) => `data-help="${esc(text)}"`;
  const heading = `<div class="section-title"><h2>Intervals <span class="unit">½ steps</span></h2><button class="help-trigger" ${help('Signed distance from row note to column note, including octaves. Select a cell for its frequency ratio. One half step is one semitone. Arrow keys move within the matrix.')} aria-label="Interval matrix help">?</button></div>`;
  if (!notes.length) return `<section class="panel math-panel" aria-label="Intervals and pitch mathematics">${heading}<div class="empty">Select notes on the fretboard.</div></section>`;
  const a = notes[from], b = notes[to], data = distanceData(a.midi, b.midi);
  const geometry = pitchGeometry(notes.map((n) => n.midi));
  const ticks = Array.from({ length: geometry.max - geometry.min + 1 }, (_, i) => {
    const x = 24 + i / (geometry.max - geometry.min) * 432;
    return `<line x1="${x}" x2="${x}" y1="35" y2="${i % 12 === 0 ? 46 : 41}"/><text x="${x}" y="60">${i % 12 === 0 || i === geometry.max - geometry.min ? i : ''}</text>`;
  }).join('');
  const cells = notes.map((row, i) => `<tr><th scope="row">${esc(pretty(row.name))}</th>${notes.map((col, j) => {
    const d = distanceData(row.midi, col.midi), interval = intervalBetween(row.name, col.name);
    return `<td><button id="interval-cell-${i}-${j}" data-interval-from="${i}" data-interval-to="${j}" tabindex="${i === from && j === to ? 0 : -1}" aria-pressed="${i === from && j === to}" aria-label="${esc(`${pretty(row.name)} to ${pretty(col.name)}: ${signed(d.steps)} half steps, ${interval.label}`)}" ${help(`${pretty(row.name)} → ${pretty(col.name)}: ${signed(d.steps)} half steps · ${interval.label} · frequency ×${d.ratio.toFixed(4)}`)} style="--note-color:${settings[`color${interval.colorIndex}`]}"><b>${signed(d.steps)}</b><small>${esc(interval.label)}</small></button></td>`;
  }).join('')}</tr>`).join('');
  const diagram = `<svg class="pitch-axis" viewBox="0 0 480 68" role="img" aria-label="Selected pitches positioned by half-step distance from the lowest pitch"><line x1="24" x2="456" y1="35" y2="35"/>${ticks}<line class="axis-interval" x1="${geometry.groups.find((g) => g.midi === a.midi).x}" x2="${geometry.groups.find((g) => g.midi === b.midi).x}" y1="35" y2="35"/>${geometry.groups.map((g, i) => `<g><circle cx="${g.x}" cy="35" r="5" class="${g.midi === a.midi || g.midi === b.midi ? 'axis-active' : ''}"/><text x="${g.x}" y="${i % 2 === 0 ? 14 : 25}">${esc(pretty(notes[g.indices[0]].name))}${g.indices.length > 1 ? ` ×${g.indices.length}` : ''}</text></g>`).join('')}</svg>`;
  return `<section class="panel math-panel" aria-label="Intervals and pitch mathematics">${heading}<div class="matrix-scroll"><table class="matrix distance-matrix"><caption class="sr-only">Row to column, signed half steps and spelled intervals</caption><thead><tr><th scope="col">→</th>${notes.map((n) => `<th scope="col">${esc(pretty(n.name))}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table></div><div class="math-readout" aria-live="polite"><span>${esc(pretty(a.name))} → ${esc(pretty(b.name))}</span><strong>${signed(data.steps)} <small>½ steps</small></strong><span>${esc(intervalBetween(a.name, b.name).label)}</span></div><div class="equation" ${help('Twelve-tone equal temperament: frequency ratio = 2 raised to (signed half steps / 12). Negative distances give ratios below 1. Ratios are not just-intonation approximations.')} tabindex="0"><span>f₂ / f₁ = 2<sup>${data.steps}/12</sup></span><b>× ${data.ratio.toFixed(4)}</b></div><div class="math-values"><span>${data.fromHz.toFixed(2)} → ${data.toHz.toFixed(2)} Hz</span><span>${signed(data.cents)} cents</span><span ${help('Pitch-class distance folds octaves into 0–11. The matrix and frequency calculation above do not fold octaves.')} tabindex="0">Δ mod 12 = ${data.pitchClass}</span></div>${diagram}<div class="axis-caption">½ steps from lowest pitch · ${esc(pretty(notes.find((n) => n.midi === geometry.min).name))}</div></section>`;
}

