import { midiOf, stringNumber, PPQ } from './model.js';
import { spellPitch, pretty, intervalBetween } from './theory.js';
import { intervalWords } from './learning.js';
import { installWindowTracks, windowTrack } from './range-controls.js';

const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export const wholePassage = length => ({min:1,max:Math.max(1,length)});
export function validatePassage(range,length) {
  if (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min < 1 || range.max > Math.max(1,length) || range.min > range.max)
    throw Error(`Choose whole step numbers from 1 to ${Math.max(1,length)}. First cannot follow last.`);
  return {...range};
}
// Event identity includes order and physical music, but not selection, locks or tempo.
export const passageIdentity = project => JSON.stringify(project.events.map(e => [e.id,e.kind,e.duration,e.picking,e.fingers,e.notes]));
export const passageEvents = (project,range) => project.events.slice(range.min-1,range.max);
export const passageLabel = (range,length) => range.min===1 && range.max===length ? 'Whole pattern' : range.min===range.max ? `Step ${range.min}` : `Steps ${range.min}–${range.max}`;

export function stepInsight(project,index) {
  const event=project.events[index],s=project.settings;
  if (!event) return null;
  const names=event.notes.map(n=>spellPitch(midiOf(n,s),s,n.spelling));
  const previous=project.events[index-1];
  let movement='';
  if (previous?.notes.length && event.notes.length) {
    const single=previous.notes.length===1 && event.notes.length===1;
    const lowest=e=>e.notes.reduce((a,b)=>midiOf(a,s)<=midiOf(b,s)?a:b);
    const before=lowest(previous),after=lowest(event);
    const from=spellPitch(midiOf(before,s),s,before.spelling),to=spellPitch(midiOf(after,s),s,after.spelling);
    const interval=intervalBetween(from,to),distance=Math.abs(interval.semitones);
    movement=`${single?'From '+pretty(from):'Lowest note '+pretty(from)+' → '+pretty(to)}: ${intervalWords(interval).toLowerCase()}, ${distance ? `${interval.direction} ${distance} half ${distance===1?'step':'steps'}` : 'same pitch'}.`;
    if (!single) movement+=' Compare other pitch ranks in Studio → Motion.';
  } else if (!event.notes.length) movement='Leave this space silent; keep the pulse moving.';
  else if (previous && !previous.notes.length) movement='Enter after the rest. Keep counting through the silence.';
  else movement='Start here. Play it slowly and evenly before adding speed.';
  const beats=event.duration/PPQ;
  const beatText=({[1/3]:'⅓',[2/3]:'⅔'})[beats] ?? String(Number(beats.toFixed(3)));
  const picking=event.picking==='alternate' ? index%2?'↑ Upstroke':'↓ Downstroke'
    : ({up:'↑ Upstroke',down:'↓ Downstroke',fingers:'Fingers '+event.fingers,free:'Free picking'})[event.picking];
  return {names:names.map(pretty),movement,
    position:event.notes.length===1 ? `String ${stringNumber(s,event.notes[0].stringId)} · fret ${event.notes[0].fret}` : names.map(pretty).join(' · '),
    timing:`${beatText} quarter-note ${beats===1?'beat':'beats'}`,
    picking:event.notes.length?picking:''};
}

export function stepGuide(project,index,label) {
  const info=stepInsight(project,index);
  if (!info) return '<div id="step-guide" class="step-guide"><p>Choose a goal and make a pattern to begin.</p></div>';
  return `<div id="step-guide" class="step-guide"><div class="step-guide-heading"><strong>Step ${index+1} · ${esc(label)}</strong><div class="step-navigation"><button id="step-previous" data-step-jump="${index-1}" aria-label="Previous pattern step" ${index===0?'disabled':''}>←</button><button id="step-hear" data-action="audition" aria-label="Hear selected step">Hear</button><button id="step-next" data-step-jump="${index+1}" aria-label="Next pattern step" ${index===project.events.length-1?'disabled':''}>→</button></div></div><p>${esc([info.position,info.timing,info.picking].filter(Boolean).join(' · '))}</p><p class="step-movement">${esc(info.movement)}</p></div>`;
}

/** A passage is an ephemeral playback choice. It never truncates saved music. */
export function createFocusedPractice({project,changed,error}) {
  let range=wholePassage(project().events.length),signature=passageIdentity(project()),countIn=true,response=false;
  function sync() {
    const next=passageIdentity(project());
    if (next!==signature) { signature=next;range=wholePassage(project().events.length); }
    return range;
  }
  function update(next) { range=validatePassage(next,project().events.length);changed(); }
  const tracks=installWindowTracks({accepts:key=>key==='passage',read:()=>({...sync()}),change:(_,next)=>update(next)});
  document.addEventListener('change',event=>{
    const el=event.target;
    if (el.dataset.passageEdge) {
      try { update({...sync(),[el.dataset.passageEdge]:el.value===''?NaN:Number(el.value)}); }
      catch(e) {el.value=range[el.dataset.passageEdge];error(e.message);}
    }
    if(el.id==='practice-count-in') {countIn=el.checked;changed();}
  });
  document.addEventListener('click',event=>{
    const node=event.target.closest?.('[data-passage-action]');if(!node)return;
    const action=node.dataset.passageAction;
    if(action==='whole')update(wholePassage(project().events.length));
    if(action==='selected') {const n=project().events.findIndex(e=>e.id===project().selectedId)+1;if(n)update({min:n,max:n});}
    if(action==='along'||action==='response') {response=action==='response';changed();}
  });
  return {
    cancel:tracks.cancel, range:()=>({...sync()}),
    events:()=>passageEvents(project(),sync()),
    options:()=>({from:sync().min-1,to:range.max-1,countIn,response}),
    label:()=>passageLabel(sync(),project().events.length),
    view:()=>{
      sync();const p=project(),count=p.events.length,label=passageLabel(range,count),whole=range.min===1&&range.max===count;
      return `<section class="practice-playback" aria-label="Practise current pattern"><div class="practice-play-modes" aria-label="Playback approach"><button id="practice-along" data-passage-action="along" aria-pressed="${!response}">Play along</button><button id="practice-response" data-passage-action="response" aria-pressed="${response}">Listen → play</button></div><p class="practice-play-hint">${response?'Listen, then play on your instrument with the click. The neck follows both turns.':'Play with the guide. Use a short passage to work on a difficult move.'}</p><label class="practice-count-in"><input id="practice-count-in" type="checkbox" ${countIn?'checked':''}> Count in one bar <small>${esc(p.settings.meter)}</small></label><details id="practice-passage"><summary>${esc(count?label:'No pattern')} · choose passage</summary>${count?`<p>Drag the ends to isolate steps. Move the middle grip to practise the next group.</p><div class="passage-numbers">${['min','max'].map(edge=>`<label>${edge==='min'?'First':'Last'} step<input id="passage-${edge}" type="number" min="${edge==='min'?1:range.min}" max="${edge==='min'?range.max:count}" value="${range[edge]}" data-passage-edge="${edge}" data-window-number="passage:${edge}"></label>`).join('')}</div>${windowTrack({key:'passage',id:'passage-range',range,min:1,max:count,label:'Passage step'})}<div class="passage-actions"><button id="passage-selected" data-passage-action="selected">Just selected step</button><button id="passage-whole" data-passage-action="whole" ${whole?'disabled':''}>Whole pattern</button></div><p class="passage-info">Playback only; your music stays intact. Each turn starts a new pulse from its first step. The count-in runs once when you press Play.</p>`:'<p>Make a pattern first.</p>'}</details><a class="practice-jump" href="#practice-stage">Go to the neck & pattern ↓</a></section>`;
    },
  };
}
