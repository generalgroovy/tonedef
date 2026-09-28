import { stringsOf, positionChoices } from './model.js';
import { spellPitch } from './theory.js';

export function changedRange(range, edge, value) {
  if (!['min', 'max'].includes(edge) || !Number.isInteger(value) || value < 0 || value > 36)
    throw Error('Use a whole physical fret number from 0 to 36.');
  if (edge === 'min' ? value > range.max : value < range.min)
    throw Error('The first fret cannot exceed the last fret.');
  return { ...range, [edge]: value };
}
export function pointerFret(x, rect, leftHanded) {
  const fraction = Math.max(0, Math.min(1, (x - rect.left) / Math.max(1, rect.width)));
  return Math.round((leftHanded ? 1 - fraction : fraction) * 36);
}
export function practiceRangesView(s) {
  const pool = positionChoices(s);
  return `<details id="practice-ranges" class="practice-ranges"><summary>Practice range <span>${pool.length} available positions</span></summary><div class="range-toolbar"><button data-action="ranges-visible">Use visible frets</button><button data-action="ranges-reset">Reset ranges</button><details id="range-info"><summary>Info</summary><p>Drag an end handle, tap the track, use arrow keys (Shift: five frets; Home/End: limit), or enter fret numbers. First and last are inclusive physical frets. Ranges combine with the visible fret window, capo, open-string option, key and pitch limits. A capo/open note must also fit its string range. Existing notes and locked events stay unchanged. Bounds remain attached to physical string numbers when tuning or string count changes; frets beyond the instrument are unavailable.</p></details></div><div class="practice-range-row range-axis" aria-hidden="true"><span>Fret</span><div class="range-ticks">${(s.leftHanded ? [36, 24, 12, 0] : [0, 12, 24, 36]).map(n => `<span>${n}</span>`).join('')}</div></div>${stringsOf(s).reverse().map(string => {
    const i = string.index, r = s.practiceRanges[i], count = pool.filter(n => n.stringId === string.id).length;
    const percent = v => (s.leftHanded ? 36 - v : v) / 36 * 100;
    return `<div class="practice-range-row ${string.enabled ? '' : 'range-disabled'}" data-range-row="${i}"><span class="range-string">S${i + 1}<small>${spellPitch(string.open, s)}</small></span><div class="range-track" data-range-track="${i}" aria-label="String ${i + 1} fret range" style="--range-start:${Math.min(percent(r.min), percent(r.max))}%;--range-end:${Math.max(percent(r.min), percent(r.max))}%"><span class="range-band"></span>${['min', 'max'].map(edge => `<button id="range-${i}-${edge}" class="range-handle range-${edge}" role="slider" data-range-edge="${edge}" data-range-string="${i}" aria-label="String ${i + 1} ${edge === 'min' ? 'first' : 'last'} practice fret" aria-valuemin="${edge === 'min' ? 0 : r.min}" aria-valuemax="${edge === 'min' ? r.max : 36}" aria-valuenow="${r[edge]}" aria-valuetext="Fret ${r[edge]}" style="left:${percent(r[edge])}%">${edge === 'min' ? '◀' : '▶'}</button>`).join('')}</div><div class="range-numbers">${['min', 'max'].map(edge => `<label>${edge === 'min' ? 'First' : 'Last'}<input id="range-value-${i}-${edge}" type="number" min="${edge === 'min' ? 0 : r.min}" max="${edge === 'min' ? r.max : 36}" step="1" data-range-number="${edge}" data-range-string="${i}" aria-label="String ${i + 1} ${edge === 'min' ? 'first' : 'last'} fret number" value="${r[edge]}"></label>`).join('')}</div><span class="range-count" aria-label="String ${i + 1}: ${string.enabled ? count + ' available positions' : 'disabled'}">${string.enabled ? count : 'off'}</span></div>`;
  }).join('')}</details>`;
}

// Preview lives only in the DOM. A completed gesture creates one undo entry;
// cancelled gestures never change saved settings or expressive fretboard notes.
export function installPracticeRanges({ settings, change, error }) {
  let drag = null;
  function preview(g, value) {
    const old = settings().practiceRanges[g.index];
    g.value = Math.max(g.edge === 'min' ? 0 : old.min, Math.min(g.edge === 'min' ? old.max : 36, value));
    const range = { ...old, [g.edge]: g.value };
    const percent = v => (settings().leftHanded ? 36 - v : v) / 36 * 100;
    g.handle.style.left = `${percent(g.value)}%`;
    g.handle.setAttribute('aria-valuenow', g.value);
    g.handle.setAttribute('aria-valuetext', `Fret ${g.value}`);
    g.track.style.setProperty('--range-start', `${Math.min(percent(range.min), percent(range.max))}%`);
    g.track.style.setProperty('--range-end', `${Math.max(percent(range.min), percent(range.max))}%`);
    document.getElementById(`range-value-${g.index}-${g.edge}`).value = g.value;
  }
  function finish(cancel = false) {
    if (!drag) return;
    const g = drag; drag = null;
    if (g.handle.hasPointerCapture(g.pointer)) g.handle.releasePointerCapture(g.pointer);
    const before = settings().practiceRanges[g.index][g.edge];
    if (cancel) preview(g, before);
    else if (g.value !== before) change(g.index, g.edge, g.value);
  }
  document.addEventListener('pointerdown', e => {
    const track = e.target.closest?.('[data-range-track]');
    if (!track || e.button !== 0 || !e.isPrimary) return;
    finish(true);
    const index = Number(track.dataset.rangeTrack), r = settings().practiceRanges[index];
    const value = pointerFret(e.clientX, track.getBoundingClientRect(), settings().leftHanded);
    const grabbed = e.target.closest('[data-range-edge]');
    const edge = grabbed?.dataset.rangeEdge || (Math.abs(value - r.min) <= Math.abs(value - r.max) ? 'min' : 'max');
    const handle = track.querySelector(`[data-range-edge="${edge}"]`);
    e.preventDefault(); handle.focus(); handle.setPointerCapture(e.pointerId);
    const box = handle.getBoundingClientRect();
    drag = { index, edge, track, handle, pointer: e.pointerId, value: r[edge], offset: grabbed ? e.clientX - box.left - box.width / 2 : 0 };
    preview(drag, grabbed ? r[edge] : value);
  });
  document.addEventListener('pointermove', e => {
    if (drag?.pointer !== e.pointerId) return;
    e.preventDefault();
    preview(drag, pointerFret(e.clientX - drag.offset, drag.track.getBoundingClientRect(), settings().leftHanded));
  }, { passive: false });
  document.addEventListener('pointerup', e => { if (drag?.pointer === e.pointerId) finish(); });
  for (const type of ['pointercancel', 'lostpointercapture'])
    document.addEventListener(type, e => { if (drag?.pointer === e.pointerId) finish(true); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drag) { e.preventDefault(); e.stopImmediatePropagation(); finish(true); return; }
    const handle = e.target.closest?.('[data-range-edge]');
    if (!handle || e.altKey || e.ctrlKey || e.metaKey) return;
    const index = Number(handle.dataset.rangeString), edge = handle.dataset.rangeEdge;
    const range = settings().practiceRanges[index], step = e.shiftKey ? 5 : 1;
    const direction = settings().leftHanded ? -1 : 1;
    const delta = { ArrowLeft: -step * direction, ArrowRight: step * direction, ArrowDown: -step, ArrowUp: step }[e.key];
    const min = edge === 'min' ? 0 : range.min, max = edge === 'min' ? range.max : 36;
    const value = e.key === 'Home' ? min : e.key === 'End' ? max : delta === undefined ? null : Math.max(min, Math.min(max, range[edge] + delta));
    if (value === null) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (value !== range[edge]) change(index, edge, value);
  }, true);
  document.addEventListener('change', e => {
    if (!e.target.dataset.rangeNumber) return;
    const el = e.target;
    try { change(Number(el.dataset.rangeString), el.dataset.rangeNumber, el.value === '' ? NaN : Number(el.value)); }
    catch (err) { el.value = settings().practiceRanges[Number(el.dataset.rangeString)][el.dataset.rangeNumber]; error(err.message); }
  });
  return { cancel: () => finish(true) };
}
