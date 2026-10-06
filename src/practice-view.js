import { windowTrack, valueSlider } from './range-controls.js';
import { defaultPracticeOptions } from './practice-options.js';
import { stringNumber, stringsOf } from './model.js';
import { spellPitch, pretty } from './theory.js';
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const disabledControl = (html, id, disabled) => disabled
  ? html.replace(new RegExp(`(<(?:input|select)\\b[^>]*\\bid="${id}"[^>]*)(>)`), '$1 disabled$2')
  : html;

export function practiceControls(project, {field, keyFields, recipes, ranges, busy, resultText = '', errorText = ''}) {
  const p = project.practice ?? defaultPracticeOptions(), s = project.settings;
  const singleNotes = ['melody', 'arpeggio'].includes(s.generationType);
  const unit = singleNotes ? 'notes' : 'chords';
  const random = (id,label) => `<label class="practice-random"><input id="practice-${id}" type="checkbox" data-practice="${id}" ${p[id] ? 'checked' : ''}>Random ${label}</label>`;
  const number = (id,label,min,max) => `<label for="practice-${id}">${label}<input id="practice-${id}" type="number" data-practice="${id}" data-window-number="${id.replace(/(Min|Max)$/,'')}:${id.endsWith('Min')?'min':'max'}" min="${min}" max="${max}" value="${p[id]}"></label>`;
  const bounds = (kind, minLabel, maxLabel, max) => `<div id="practice-${kind}-bounds" class="practice-bounds">${number(kind+'Min',minLabel,1,max)}${number(kind+'Max',maxLabel,1,max)}${windowTrack({key:kind,id:'bounds-'+kind,range:{min:p[kind+'Min'],max:p[kind+'Max']},min:1,max,label:kind==='count'?'Pattern length':kind==='strings'?'String count':'Group size'})}</div>`;
  const count = disabledControl(field('eventCount',singleNotes?'Notes':'Chords'),'setting-eventCount',p.countRandom);
  const keys = disabledControl(disabledControl(keyFields, 'setting-tonic', p.keyRandom), 'collection', p.modeRandom);
  const groupingConflict = !singleNotes && (p.notesPerString !== 0 || p.notesPerStringRandom);
  const rules = [];
  if (s.generationType === 'melody') {
    if (s.sequencePattern !== 'free') rules.push({ steps:'Scale steps', thirds:'Thirds', groups3:'Groups of 3', groups4:'Groups of 4' }[s.sequencePattern]);
    if (s.melodicContour !== 'random') rules.push({ ascending:'Ascending', descending:'Descending', arch:'Up & down' }[s.melodicContour]);
  }
  if (s.rhythmPattern !== 'steady') rules.push({ 'eighth-quarter':'Long & short', triplets:'Triplets', syncopated:'Dotted rhythm' }[s.rhythmPattern]);
  if (s.practiceRanges.some(range => range.min !== 0 || range.max !== 36)) rules.push('Custom frets');
  if (!s.inKey) rules.push('Outside scale allowed');
  if (s.restRate) rules.push('Rests');
  const activeRules = rules.filter(Boolean);
  const summary = activeRules.length ? ` · ${activeRules.slice(0,2).join(' · ')}${activeRules.length > 2 ? ` · +${activeRules.length-2}` : ''}` : '';
  const reach = ['allowOpen', ...(singleNotes ? ['maxLeap','repeatNotes'] : ['maxSpan']), 'restRate','inKey','lowPitch','highPitch', ...(!singleNotes || s.generationType === 'arpeggio' ? ['chordVocabulary'] : [])];
  return `${field('generationType','Pattern type')}<div class="practice-key">${keys}${random('keyRandom','key')}${random('modeRandom','scale')}</div>
    <div class="practice-row"><div class="practice-value">${count}${valueSlider('setting-eventCount','pattern length',s.eventCount,1,64,1,p.countRandom)}</div>${random('countRandom','count')}</div>
    ${p.countRandom ? bounds('count',`Fewest ${unit}`,`Most ${unit}`,64) : ''}
    <fieldset class="practice-strings"><legend>${p.stringsRandom ? 'Choose from these strings' : 'Strings'} <small>low → high</small></legend><div class="string-choices">${stringsOf(s).map(string => `<button id="practice-string-${string.id}" data-practice-string="${string.id}" aria-pressed="${p.stringIds.includes(string.id)}" ${string.enabled ? '' : 'disabled'} aria-label="Use string ${stringNumber(s,string.id)}, ${escape(pretty(spellPitch(string.open,s)))}"><strong>${escape(pretty(spellPitch(string.open,s)).replace(/-?\d+$/,''))}</strong><small>${stringNumber(s,string.id)}</small></button>`).join('')}</div>${random('stringsRandom','strings')}${p.stringsRandom ? bounds('strings','Fewest strings','Most strings',12) : ''}</fieldset>
    ${singleNotes ? `<div class="practice-row"><label for="practice-notesPerString">Notes per string<select id="practice-notesPerString" data-practice="notesPerString" ${p.notesPerStringRandom?'disabled':''}>${Array.from({length:17},(_,n) => `<option value="${n}" ${p.notesPerString===n?'selected':''}>${n || 'Any'}</option>`).join('')}</select></label>${random('notesPerStringRandom','group size')}</div>${p.notesPerStringRandom ? bounds('notesPerString','Fewest per string','Most per string',16) : ''}` : ''}
    ${groupingConflict ? '<div id="practice-grouping-conflict" class="practice-conflict"><p>Chords play strings together. Notes per string needs a single-note pattern.</p><button id="practice-free-strings" data-action="practice-free-strings">Use free string choice</button></div>' : ''}
    <button id="practice-new" class="primary practice-new" data-action="practice" ${busy?'disabled':''}>New pattern</button>${busy?'<button data-action="cancel-generation">Cancel</button>':''}${errorText?`<p id="practice-error" class="practice-error" role="alert">${escape(errorText)}</p>`:''}${resultText?`<p class="practice-result" role="status">${escape(resultText)}</p>`:''}
    <div class="practice-row"><div class="practice-value">${field('tempo','Speed · bpm')}${valueSlider('setting-tempo','speed',s.tempo,30,240)}</div>${field('loop','Repeat')}</div>
    <details id="practice-more"><summary>More choices${escape(summary)}</summary>${recipes}${s.generationType==='melody'?`${field('sequencePattern','Note order')}${field('melodicContour','Direction')}`:''}${field('rhythmPattern','Rhythm')}${s.rhythmPattern==='steady'?field('duration','Note length'):''}${field('metronome')}
      ${ranges}<details id="practice-reach"><summary>Reach & rests</summary>${reach.map(id=>field(id)).join('')}</details>
    </details>
    <details id="practice-info"><summary>Info</summary><p>Drag a slider for a value. Drag either numbered end of a range, or its middle grip to move both ends. Type an exact number at any time. Arrows adjust by one; Shift + arrows on a range adjusts by five. Escape cancels a drag; Undo reverses a finished change.</p><p>Random changes only the checked choices. Selected strings are the available pool; disabled strings can be enabled in Studio → Settings. Notes or chords sets the number of pattern steps; a rest replaces one step.</p><p>Notes per string plays that many notes on each chosen string, from low to high, then starts again. The last group may be shorter. Rests do not count toward a string group. Choose Any for free string changes. This applies to single-note patterns.</p><p>Keep a pattern card to preserve it. If your choices cannot fit a kept card, adjust the choices or release it. Undo brings back your previous pattern.</p><p>The fretboard plays when you tap it. Use Studio to edit notes, change your instrument, or explore the full theory tools.</p></details>`;
}
