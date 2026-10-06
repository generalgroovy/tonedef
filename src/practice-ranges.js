import { stringsOf, positionChoices, stringNumber } from './model.js';
import { windowTrack, installWindowTracks } from './range-controls.js';
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
  return `<details id="practice-ranges" class="practice-ranges"><summary>Practice range <span>${pool.length} available positions</span></summary><p class="range-instruction">Drag the middle to move · ends to resize</p><div class="range-toolbar"><button data-action="ranges-visible">Use visible frets</button><button data-action="ranges-reset">Reset ranges</button><details id="range-info"><summary>Info</summary><p>Drag the middle grip to move a whole range; drag either numbered end to resize. Tap the track, use arrow keys (Shift: five frets; Home/End: limit), or enter fret numbers. First and last are inclusive physical frets. Ranges combine with the visible fret window, capo, open-string option, key and pitch limits. A capo/open note must also fit its string range. Existing notes and locked events stay unchanged. Bounds remain attached to the same physical string IDs when tuning or string count changes; frets beyond the instrument are unavailable.</p></details></div><div class="practice-range-row range-axis" aria-hidden="true"><span>Fret</span><div class="range-ticks">${(s.leftHanded ? [36, 24, 12, 0] : [0, 12, 24, 36]).map(n => `<span>${n}</span>`).join('')}</div></div>${stringsOf(s).reverse().map(string => {
    const i = string.index, r = s.practiceRanges[i], count = pool.filter(n => n.stringId === string.id).length;
    return `<div class="practice-range-row ${string.enabled ? '' : 'range-disabled'}" data-range-row="${i}"><span class="range-string">S${stringNumber(s,i)}<small>${spellPitch(string.open, s)}</small></span>${windowTrack({key:'frets:'+i,id:'range-'+i,range:r,min:0,max:36,label:'String '+stringNumber(s,i),reversed:s.leftHanded,fretIndex:i})}<div class="range-numbers">${['min', 'max'].map(edge => `<label>${edge === 'min' ? 'First' : 'Last'}<input id="range-value-${i}-${edge}" type="number" min="${edge === 'min' ? 0 : r.min}" max="${edge === 'min' ? r.max : 36}" step="1" data-window-number="frets:${i}:${edge}" data-range-number="${edge}" data-range-string="${i}" aria-label="String ${stringNumber(s,i)} ${edge === 'min' ? 'first' : 'last'} fret number" value="${r[edge]}"></label>`).join('')}</div><span class="range-count" aria-label="String ${stringNumber(s,i)}: ${string.enabled ? count + ' available positions' : 'disabled'}">${string.enabled ? count : 'off'}</span></div>`;
  }).join('')}</details>`;
}

// Range gestures and numeric entry share the same validated project transaction.
export function installPracticeRanges({ settings, change, changeWindow, practice, changePractice, error }) {
  const tracks = installWindowTracks({
    read: key => key.startsWith('frets:') ? settings().practiceRanges[Number(key.split(':')[1])] : {min:practice()[key+'Min'],max:practice()[key+'Max']},
    change: (key, range) => key.startsWith('frets:') ? changeWindow(Number(key.split(':')[1]),range) : changePractice(key,range),
  });
  document.addEventListener('change', e => {
    if (!e.target.dataset.rangeNumber) return;
    const el = e.target;
    try { change(Number(el.dataset.rangeString), el.dataset.rangeNumber, el.value === '' ? NaN : Number(el.value)); }
    catch (err) { el.value = settings().practiceRanges[Number(el.dataset.rangeString)][el.dataset.rangeNumber]; error(err.message); }
  });
  return tracks;
}
