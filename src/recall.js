import {stringsOf, midiOf} from './model.js';
import {mod, spellPitch, pretty} from './theory.js';
export const RECALL_INTERVALS = ['a unison','a minor second','a major second','a minor third','a major third','a perfect fourth','a tritone','a perfect fifth','a minor sixth','a major sixth','a minor seventh','a major seventh'];
const esc = v => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const name = (midi,s,octave=false) => pretty(spellPitch(midi,s)).replace(octave ? /$^/ : /-?\d+$/,'');

// Recall uses the displayed instrument. It does not generate or rewrite music.
export function recallTargets(project, kind) {
  const s=project.settings, visible=[];
  for (const string of stringsOf(s).filter(string=>string.enabled)) {
    const frets=new Set([s.capo,...Array.from({length:Math.max(0,s.fretMax-Math.max(s.capo,s.fretMin)+1)},(_,i)=>Math.max(s.capo,s.fretMin)+i)]);
    for (const fret of frets) visible.push(string.open+fret);
  }
  if (kind==='melody') {
    const sounded=project.events.filter(event=>event.notes.length);
    if (!sounded.length || sounded.some(event=>event.notes.length!==1)) return {targets:[],reason:'Choose a single-note pattern to recall a melody. Chords can be explored in Studio.'};
    const targets=sounded.map(event=>({midi:midiOf(event.notes[0],s),exact:true}));
    if (targets.some(target=>!visible.includes(target.midi))) return {targets:[],reason:'Some melody pitches are outside the visible, enabled strings. Widen the fret window in Settings, then try again.'};
    return {targets,reason:''};
  }
  const pcs=[...new Set(visible.map(midi=>mod(midi)))].filter(pc=>s.keyMask&(1<<pc)).sort((a,b)=>mod(a-s.tonic)-mod(b-s.tonic));
  return {targets:pcs.map(pc=>({midi:kind==='intervals'?60+s.tonic+mod(pc-s.tonic):visible.find(midi=>mod(midi)===pc),exact:false,interval:mod(pc-s.tonic)})),reason:'No key tones are visible on enabled strings. Choose a scale or widen the fret window.'};
}
export function judgeRecall(target, midi) {
  return Number.isInteger(midi) && (target.exact ? target.midi===midi : mod(target.midi)===mod(midi));
}

export function createRecall({project,audition,beforeListen}) {
  let kind='notes',hidden=false,active=false,complete=false,targets=[],index=0,tries=0,solved=0,firstTry=0,feedback='',correct=false,signature='';
  const current=()=>targets[index];
  function context() {
    const p=project(),s=p.settings;
    return JSON.stringify([kind,s.tonic,s.keyMask,s.capo,s.fretMin,s.fretMax,stringsOf(s),kind==='melody'?p.events.map(event=>event.notes.map(note=>[note.stringId,note.fret])):null]);
  }
  function reset() {active=false;complete=false;targets=[];index=0;tries=0;solved=0;firstTry=0;feedback='';correct=false;signature=context();}
  function start() {
    reset(); const result=recallTargets(project(),kind); targets=result.targets;
    if(!targets.length){feedback=result.reason;return;}
    if(kind!=='melody') for(let i=targets.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[targets[i],targets[j]]=[targets[j],targets[i]];}
    active=true;
  }
  function prompt() {
    const target=current(),s=project().settings;
    if(kind==='melody') return `Recall note ${index+1} of ${targets.length}`;
    if(kind==='intervals') return `Find ${RECALL_INTERVALS[target.interval]} above ${name(60+s.tonic,s)} · ${target.interval} half steps`;
    return `Find ${name(target.midi,s)} · any octave`;
  }
  function content() {
    return `<div class="recall-options"><label for="recall-kind">Exercise<select id="recall-kind"><option value="notes" ${kind==='notes'?'selected':''}>Find notes</option><option value="intervals" ${kind==='intervals'?'selected':''}>Find intervals</option><option value="melody" ${kind==='melody'?'selected':''}>Recall melody</option></select></label><label class="recall-hide"><input id="recall-hidden" type="checkbox" ${hidden?'checked':''}>Hide hints</label></div>
      ${active?`<p class="recall-prompt">${esc(prompt())}</p><p class="recall-instruction">${kind==='melody'?'Match the exact pitch on any string. Rests are skipped; timing is not scored.':kind==='intervals'?'Tap the neck. Octave-equivalent answers count; the interval is measured from home.':'Tap a matching note on the neck.'}</p>`:complete?`<p class="recall-prompt">Round complete · ${firstTry} / ${solved} first try</p>`:'<p class="recall-instruction">Find a note, work out an interval, or recall your melody. Hide hints when you are ready.</p>'}
      <p id="recall-feedback" class="recall-feedback" role="status" aria-live="polite">${esc(feedback)}</p>
      <div class="recall-actions">${active?`<button id="recall-hear" data-recall-action="hear">Hear target</button><button id="recall-next" data-recall-action="next" ${correct?'':'disabled'}>${index===targets.length-1?'Finish round':'Next →'}</button><button data-recall-action="stop">End</button>`:`<button id="recall-start" data-recall-action="start">${complete?'Try again':'Start challenge'}</button>`}</div>${active?`<small class="recall-score">${solved} solved · ${firstTry} first try · this session</small>`:''}`;
  }
  function update() {
    const body=document.getElementById('recall-body'); if(!body)return;
    const focus=document.activeElement?.id;
    body.innerHTML=content();
    if(focus?.startsWith('recall-'))document.getElementById(focus)?.focus({preventScroll:true});
    mount(true);
  }
  function mount(enabled) {
    const mask=!!(enabled&&active&&hidden&&document.getElementById('recall')?.open);
    document.body.classList.toggle('recalling-hidden',mask);
    for(const node of document.querySelectorAll('.fret')) {
      node.dataset.recallLabel ||= node.getAttribute('aria-label');
      node.setAttribute('aria-label',mask?node.dataset.recallLabel.match(/string \d+, fret \d+/)?.[0]??'Fret position':node.dataset.recallLabel);
      if(mask)node.setAttribute('aria-pressed','false');
      else node.setAttribute('aria-pressed',String(node.classList.contains('selected')));
    }
    for(const node of document.querySelectorAll('.learning-strip,.note-state-legend,.simple-panel .timeline,.simple-pattern-actions,#pattern-info')) {
      node.hidden=mask;
    }
    let hint=document.getElementById('recall-pattern-hidden');
    if(!hint && document.querySelector('.simple-panel .timeline-panel')) {
      hint=document.createElement('p');hint.id='recall-pattern-hidden';hint.className='recall-instruction';
      hint.textContent='Pattern hidden for this challenge. Turn off Hide hints to see it again.';
      document.querySelector('.simple-panel .timeline-panel').append(hint);
    }
    if(hint)hint.hidden=!mask;
  }
  document.addEventListener('toggle',e=>{if(e.target.id==='recall'){if(!e.target.open)reset();update();}},true);
  document.addEventListener('change',e=>{
    if(e.target.id==='recall-kind'){kind=e.target.value;reset();update();}
    if(e.target.id==='recall-hidden'){hidden=e.target.checked;mount(true);}
  });
  document.addEventListener('click',e=>{
    const action=e.target.closest?.('[data-recall-action]')?.dataset.recallAction;
    if(!action)return;
    if(action==='start'){start();update();}
    if(action==='stop'){reset();update();}
    if(action==='hear'&&active){beforeListen();audition(current().midi);}
    if(action==='next'&&active&&correct){
      if(index===targets.length-1){active=false;complete=true;feedback='Try the same ideas on your instrument, in a new key or higher on the neck.';}
      else {index++;tries=0;correct=false;feedback='';}
      update();
    }
  });
  return {
    view:()=>{
      if(signature!==context())reset();
      return `<details id="recall" class="recall"><summary>Challenge yourself${active?' · in progress':''}</summary><div id="recall-body">${content()}</div></details>`;
    },
    mount,
    answer:midi=>{
      if(!active||correct||!document.getElementById('recall')?.open)return;
      tries++;
      if(judgeRecall(current(),midi)){correct=true;solved++;if(tries===1)firstTry++;feedback=`Yes · ${name(midi,project().settings,true)}. ${index===targets.length-1?'Finish to see your round.':'Continue when you are ready.'}`;}
      else feedback=`You played ${name(midi,project().settings,true)}. Try again, or hear the target.`;
      update();
    },
  };
}
