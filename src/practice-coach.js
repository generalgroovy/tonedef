import { midiOf, stringsOf } from './model.js';
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

// These are self-reported passes, not a measurement of performance or skill.
export const freshPracticeSession = () => ({ active:false, streak:0, passes:0, best:null, tempo:null, message:'' });
export function practiceIdentity(project) {
  const s = project.settings;
  return JSON.stringify([s.tonic,s.keyMask,s.capo,stringsOf(s),s.meter,
    project.events.map(e => [e.kind,e.duration,e.picking,e.fingers,e.notes.map(n => [n.stringId,n.fret,midiOf(n,s)])])]);
}
export function practiceSessionStep(state, action, tempo) {
  if (!Number.isInteger(tempo) || tempo < 30 || tempo > 240) throw Error('Practice tempo must be 30–240 bpm.');
  const next = { ...state };
  if (action === 'start') return { ...freshPracticeSession(), active:true, tempo, message:'Listen once, play a full pass on your instrument, then check yourself.' };
  if (action === 'end') return { ...next, active:false, message:'' };
  if (!next.active) return next;
  if (tempo !== next.tempo) {
    next.tempo = tempo; next.streak = 0;
    next.message = 'Tempo changed. Build three clean passes at this speed.';
  }
  if (action === 'clean') {
    next.passes++; next.streak = Math.min(3,next.streak + 1);
    if (next.streak === 3) { next.best = Math.max(next.best ?? 0,tempo); next.message = 'Three clean passes. Stay here, or try a small speed increase.'; }
    else next.message = `${next.streak} of 3 clean passes at this speed. Keep the timing even and your movement relaxed.`;
  }
  if (action === 'retry') { next.streak=0; next.message='Slow down if needed. Repeat a full pass with clear notes and even timing.'; }
  return next;
}

export function practiceTiming(project) {
  const sounded = project.events.filter(e => e.notes.length);
  if (!sounded.length) return 'Make a pattern before starting a practice loop.';
  const durations = new Set(project.events.map(e => e.duration));
  const duration = durations.size === 1 ? [...durations][0] : null;
  const density = {24:'4 steps',32:'3 steps',48:'2 steps',96:'1 step',192:'1 step every 2 quarter-note beats'}[duration];
  const pace = density ? duration === 192 ? density : `${density} per quarter-note beat` : 'Mixed note lengths';
  const seconds = project.events.reduce((sum,e) => sum + e.duration,0) / 96 * 60 / project.settings.tempo;
  return `${pace} · ${Number(seconds.toFixed(1))} seconds per pass. A step can be a note, chord or rest.`;
}

export function createPracticeCoach({project,changeTempo}) {
  let session=freshPracticeSession(), signature='';
  function sync() {
    const p=project(), identity=practiceIdentity(p);
    if(signature && signature!==identity) session=freshPracticeSession();
    signature=identity;
    session=practiceSessionStep(session,'sync',p.settings.tempo);
  }
  function content() {
    sync(); const p=project(),tempo=p.settings.tempo;
    return `<p class="practice-timing">${esc(practiceTiming(p))}</p>${session.active ? `
      <p class="coach-check">Even timing · clear notes · relaxed movement</p>
      <div class="coach-progress" aria-label="${session.streak} of 3 clean passes">${[1,2,3].map(n=>`<span class="${n<=session.streak?'complete':''}" aria-hidden="true">${n<=session.streak?'✓':n}</span>`).join('')}<span>at ${tempo} bpm</span></div>
      <p class="coach-status" role="status">${esc(session.message)}</p>
      <div class="coach-actions"><button id="coach-clean" data-coach="clean">Clean pass</button><button id="coach-retry" data-coach="retry">Needs work</button>${session.streak>=3&&tempo<240?`<button id="coach-faster" data-coach="faster">Try ${Math.min(240,tempo+5)} bpm →</button>`:''}${tempo>30?`<button id="coach-slower" data-coach="slower">Slower −5 bpm</button>`:''}<button id="coach-end" data-coach="end">End session</button></div>
      <small>${session.passes} self-reported clean ${session.passes===1?'pass':'passes'}${session.best?` · three-pass best ${session.best} bpm`:''}. This session only.</small>` : `<p>Listen to your pattern, play it on your instrument, then mark how it went. Build three clean passes before trying a faster tempo.</p><button id="coach-start" data-coach="start" ${p.events.some(e=>e.notes.length)?'':'disabled'}>Start practice loop</button>`}
      <p class="coach-disclaimer">You judge timing, tone and technique. ToneDef does not listen to your instrument.</p>`;
  }
  function update(previousFocus) {
    const node=document.getElementById('practice-coach-body'); if(!node)return;
    const focus=previousFocus ?? document.activeElement?.id; node.innerHTML=content();
    document.querySelector('#practice-coach > summary').textContent='Practise this pattern'+(session.active?' · session active':'');
    if(focus?.startsWith('coach-')) (document.getElementById(focus)??document.getElementById(session.active?'coach-clean':'coach-start'))?.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{
    const action=event.target.closest?.('[data-coach]')?.dataset.coach; if(!action)return;
    const focus=document.activeElement?.id;
    sync();
    const tempo=project().settings.tempo;
    if(action==='faster'&&session.active&&session.streak>=3) changeTempo(Math.min(240,tempo+5));
    else if(action==='slower'&&session.active) changeTempo(Math.max(30,tempo-5));
    else session=practiceSessionStep(session,action,tempo);
    update(focus);
  });
  return { view:()=>{ sync(); return `<details id="practice-coach" class="practice-coach"><summary>Practise this pattern${session.active?' · session active':''}</summary><div id="practice-coach-body">${content()}</div></details>`; } };
}
