// Inclusive integer windows. Translating preserves width, even at a boundary.
export function moveWindow(range, delta, min, max) {
  const shift = Math.max(min - range.min, Math.min(max - range.max, Math.round(delta)));
  return {min: range.min + shift, max: range.max + shift};
}
export function resizeWindow(range, edge, value, min, max) {
  return {...range, [edge]: Math.max(edge === 'min' ? min : range.min, Math.min(edge === 'min' ? range.max : max, Math.round(value)))};
}
export function pointerValue(x, rect, min, max, reversed = false) {
  const fraction = Math.max(0, Math.min(1, (x - rect.left) / Math.max(1, rect.width)));
  return Math.round(min + (reversed ? 1 - fraction : fraction) * (max - min));
}
const esc = v => String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
export function windowTrack({key, id, range, min, max, label, reversed = false, fretIndex}) {
  const pct = value => (reversed ? max - value : value - min) / Math.max(1,max - min) * 100;
  const start = Math.min(pct(range.min),pct(range.max)), end = Math.max(pct(range.min),pct(range.max));
  return `<div class="range-track" data-window="${key}" data-window-min="${min}" data-window-max="${max}" ${reversed ? 'data-window-reversed' : ''} ${fretIndex === undefined ? '' : `data-range-track="${fretIndex}"`} style="--range-start:${start}%;--range-end:${end}%">
    <span class="range-band" aria-hidden="true"></span><button id="${id}-band" class="range-move" role="slider" data-window-edge="band" title="Drag to move both ends" aria-label="${esc(label)}: move whole range" aria-valuemin="${min}" aria-valuemax="${max-(range.max-range.min)}" aria-valuenow="${range.min}" aria-valuetext="${range.min} to ${range.max}"><span aria-hidden="true">↔</span></button>
    ${['min','max'].map(edge=>`<button id="${id}-${edge}" class="range-handle range-${edge}" role="slider" data-window-edge="${edge}" ${fretIndex === undefined ? '' : `data-range-edge="${edge}" data-range-string="${fretIndex}"`} aria-label="${esc(label)} ${edge==='min'?'first':'last'}${fretIndex === undefined ? '' : ' practice fret'}" aria-valuemin="${edge==='min'?min:range.min}" aria-valuemax="${edge==='min'?range.max:max}" aria-valuenow="${range[edge]}" aria-valuetext="${range[edge]}" style="left:${pct(range[edge])}%">${range[edge]}</button>`).join('')}</div>`;
}

// One pointer gesture = one commit. Only temporary DOM values change on move.
export function installWindowTracks({read, change, accepts = () => true}) {
  let drag;
  function paint(g, range) {
    g.value = range;
    const pct = v => (g.reversed ? g.max-v : v-g.min) / Math.max(1,g.max-g.min)*100;
    g.track.style.setProperty('--range-start',Math.min(pct(range.min),pct(range.max))+'%');
    g.track.style.setProperty('--range-end',Math.max(pct(range.min),pct(range.max))+'%');
    for (const edge of ['min','max','band']) {
      const handle = g.track.querySelector(`[data-window-edge="${edge}"]`);
      handle.setAttribute('aria-valuenow',edge==='band'?range.min:range[edge]);
      handle.setAttribute('aria-valuemin',edge==='max'?range.min:g.min);
      handle.setAttribute('aria-valuemax',edge==='min'?range.max:edge==='band'?g.max-range.max+range.min:g.max);
      handle.setAttribute('aria-valuetext',edge==='band'?`${range.min} to ${range.max}`:range[edge]);
      if (edge!=='band') {
        handle.textContent = range[edge]; handle.style.left = pct(range[edge])+'%';
        const number = document.querySelector(`[data-window-number="${g.key}:${edge}"]`);
        if (number) number.value = range[edge];
      }
    }
  }
  function finish(cancel = false) {
    if (!drag) return;
    const g = drag; drag = null;
    if (g.handle.hasPointerCapture(g.pointer)) g.handle.releasePointerCapture(g.pointer);
    g.track.classList.remove('is-dragging');
    if (cancel) paint(g,g.before);
    else if (g.value.min!==g.before.min || g.value.max!==g.before.max) change(g.key,g.value);
  }
  function context(track) {
    return {track,key:track.dataset.window,min:Number(track.dataset.windowMin),max:Number(track.dataset.windowMax),reversed:track.hasAttribute('data-window-reversed')};
  }
  document.addEventListener('pointerdown', e=>{
    const track = e.target.closest?.('[data-window]');
    if (!track || !accepts(track.dataset.window) || e.button!==0 || !e.isPrimary) return;
    finish(true);
    const g = context(track), before = {...read(g.key)}, rect = track.getBoundingClientRect();
    const value = pointerValue(e.clientX,rect,g.min,g.max,g.reversed);
    const grabbed = e.target.closest('[data-window-edge]');
    const edge = grabbed?.dataset.windowEdge ?? (Math.abs(value-before.min)<=Math.abs(value-before.max)?'min':'max');
    const handle = grabbed ?? track.querySelector(`[data-window-edge="${edge}"]`);
    e.preventDefault(); handle.focus({preventScroll:true});
    // Focusing may commit an edited number and rebuild the controls.
    if(!handle.isConnected)return;
    handle.setPointerCapture(e.pointerId);
    drag = {...g,before,edge,handle,rect,pointer:e.pointerId,origin:e.clientX,value:before};
    track.classList.add('is-dragging');
    paint(drag,grabbed ? before : resizeWindow(before,edge,value,g.min,g.max));
    drag.start = {...drag.value};
  });
  document.addEventListener('pointermove', e=>{
    if (drag?.pointer!==e.pointerId) return;
    e.preventDefault();
    const g=drag, delta=(e.clientX-g.origin)/Math.max(1,g.rect.width)*(g.max-g.min)*(g.reversed?-1:1);
    paint(g,g.edge==='band'?moveWindow(g.start,delta,g.min,g.max):resizeWindow(g.start,g.edge,g.start[g.edge]+delta,g.min,g.max));
  },{passive:false});
  document.addEventListener('pointerup',e=>{if(drag?.pointer===e.pointerId)finish();});
  for (const type of ['pointercancel','lostpointercapture']) document.addEventListener(type,e=>{if(drag?.pointer===e.pointerId)finish(true);});
  window.addEventListener('blur',()=>finish(true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true);});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&drag){e.preventDefault();e.stopImmediatePropagation();finish(true);return;}
    const handle=e.target.closest?.('[data-window-edge]');
    if(!handle||!accepts(handle.closest('[data-window]')?.dataset.window)||e.altKey||e.ctrlKey||e.metaKey)return;
    const g=context(handle.closest('[data-window]')),range=read(g.key),edge=handle.dataset.windowEdge,step=e.shiftKey?5:1;
    const delta={ArrowLeft:-step*(g.reversed?-1:1),ArrowRight:step*(g.reversed?-1:1),ArrowDown:-step,ArrowUp:step}[e.key];
    if(delta===undefined&&!['Home','End'].includes(e.key))return;
    e.preventDefault();e.stopImmediatePropagation();
    const value=e.key==='Home'?g.min:e.key==='End'?g.max:range[edge==='band'?'min':edge]+delta;
    const next=edge==='band'?moveWindow(range,value-range.min,g.min,g.max):resizeWindow(range,edge,value,g.min,g.max);
    if(next.min!==range.min||next.max!==range.max)change(g.key,next);
  },true);
  return {cancel:()=>finish(true)};
}

export function valueSlider(id, label, value, min, max, step = 1, disabled = false) {
  return `<input id="drag-${id}" class="value-slider" type="range" data-value-for="${id}" aria-label="Drag ${esc(label)}" min="${min}" max="${max}" step="${step}" value="${value}" ${disabled?'disabled':''}>`;
}
export function installValueSliders() {
  let active, ignored;
  function cancel() {
    if (!active) return;
    active.slider.value=active.before; active.number.value=active.before; ignored=active; active=null;
  }
  function begin(slider) {
    if (active?.slider===slider) return;
    cancel(); const number=document.getElementById(slider.dataset.valueFor);
    active={slider,number,before:number.value};
  }
  document.addEventListener('pointerdown',e=>{if(e.target.matches?.('[data-value-for]')&&!e.target.disabled){ignored=null;begin(e.target);}});
  document.addEventListener('input',e=>{if(!e.target.matches?.('[data-value-for]'))return;if(ignored?.slider===e.target){e.target.value=ignored.before;return;}begin(e.target);active.number.value=e.target.value;});
  document.addEventListener('change',e=>{
    if(!e.target.matches?.('[data-value-for]')||!active)return;
    const g=active;active=null;
    if(g.number.value!==g.before)g.number.dispatchEvent(new Event('change',{bubbles:true}));
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();cancel();}
    else if(e.target.matches?.('[data-value-for]'))ignored=null;
  },true);
  document.addEventListener('pointercancel',cancel);
  window.addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  return {cancel};
}
