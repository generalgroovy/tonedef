import { defaultPracticeOptions } from './practice-options.js';
import { stringsOf } from './model.js';
import { spellPitch, pretty } from './theory.js';
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

export function practiceControls(project, {field, keyFields, recipes, ranges, busy, resultText = ''}) {
  const p = project.practice ?? defaultPracticeOptions(), s = project.settings;
  const random = (id,label) => `<label class="practice-random"><input id="practice-${id}" type="checkbox" data-practice="${id}" ${p[id] ? 'checked' : ''}>Random ${label}</label>`;
  const number = (id,label,min,max) => `<label for="practice-${id}">${label}<input id="practice-${id}" type="number" data-practice="${id}" min="${min}" max="${max}" value="${p[id]}"></label>`;
  return `<div class="practice-key">${keyFields}${random('keyRandom','key')}${random('modeRandom','scale')}</div>
    <div class="practice-row">${field('eventCount','Notes')}${random('countRandom','count')}</div>
    <fieldset class="practice-strings"><legend>Strings <small>low → high</small></legend><div class="string-choices">${stringsOf(s).map(string => `<button id="practice-string-${string.id}" data-practice-string="${string.id}" aria-pressed="${p.stringIds.includes(string.id)}" ${string.enabled ? '' : 'disabled'} aria-label="Use string ${string.index+1}, ${escape(pretty(spellPitch(string.open,s)))}"><strong>${escape(pretty(spellPitch(string.open,s)).replace(/-?\d+$/,''))}</strong><small>${string.index+1}</small></button>`).join('')}</div>${random('stringsRandom','strings')}</fieldset>
    <div class="practice-row"><label for="practice-notesPerString">Notes per string<select id="practice-notesPerString" data-practice="notesPerString">${[0,1,2,3,4,5,6,7,8].map(n => `<option value="${n}" ${p.notesPerString===n?'selected':''}>${n || 'Any'}</option>`).join('')}</select></label>${random('notesPerStringRandom','group size')}</div>
    <button id="practice-new" class="primary practice-new" data-action="practice" ${busy?'disabled':''}>New pattern</button>${busy?'<button data-action="cancel-generation">Cancel</button>':''}${resultText?`<p class="practice-result" role="status">${escape(resultText)}</p>`:''}
    <div class="practice-row">${field('tempo','Speed')}${field('loop','Repeat')}</div>
    <details id="practice-more"><summary>More choices</summary>${recipes}${field('generationType','Pattern type')}${field('sequencePattern','Note order')}${field('melodicContour','Direction')}${field('rhythmPattern','Rhythm')}${field('duration','Note length')}${field('metronome')}
      ${ranges}<details id="practice-random-bounds"><summary>Random limits</summary><div class="practice-bounds">${number('countMin','Fewest notes',1,64)}${number('countMax','Most notes',1,64)}${number('stringsMin','Fewest strings',1,12)}${number('stringsMax','Most strings',1,12)}${number('notesPerStringMin','Smallest group',1,8)}${number('notesPerStringMax','Largest group',1,8)}</div></details>
      <details id="practice-reach"><summary>Reach & rests</summary>${['allowOpen','maxLeap','repeatNotes','restRate','inKey','lowPitch','highPitch','maxSpan','chordVocabulary'].map(id=>field(id)).join('')}</details>
    </details>
    <details id="practice-info"><summary>Info</summary><p>Choose your notes, then make a pattern. Random changes only the checked choices. Selected strings are the available pool; disabled strings can be enabled in Studio → Settings.</p><p>Notes per string plays that many notes on each chosen string, from low to high, then starts again. The last group may be shorter. Rests do not count. Choose Any for free string changes. This applies to single-note patterns.</p><p>Tap a pattern card, then Keep note to preserve it. If your choices cannot fit a kept note, adjust the choices or release the note. Undo brings back your previous pattern.</p><p>The fretboard always plays when you tap it. Use Studio to write or edit notes, change your instrument, or explore the full theory tools.</p></details>`;
}
