import {PANELS, normalizeLayout, movePanel} from './layout.js';
const KEY = 'tonedef.workspace.v1';
let layout;
try { layout = normalizeLayout(JSON.parse(localStorage.getItem(KEY))); } catch { layout = normalizeLayout(); }
let editing = false, rerender = () => {}, notice = () => {};
let mode = 'learn', focused = null;
let configuring = false, configurationSection = 'instrument';
try { const saved = localStorage.getItem('tonedef.workspace.mode.v3'); if (['learn','practice','overview','custom'].includes(saved)) mode = saved; } catch {}
export const workspaceMode = () => mode;
export const simpleWorkspace = () => ['learn','practice'].includes(mode);
export const instrumentOpen = () => simpleWorkspace() && configuring;
export const instrumentSection = () => configurationSection;
export const workspaceSurface = () => mode + (instrumentOpen() ? ':configuration:'+configurationSection : '');
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function openInstrument(toggle = false) {
  if (toggle && configuring) { closeInstrument(); return; }
  configuring = true; rerender();
  document.getElementById('config-tab-'+configurationSection)?.focus({preventScroll:true});
  if (stackedLearning.matches) jumpToPanel('exercise');
}
function closeInstrument() {
  configuring = false; rerender();
  document.getElementById('quick-instrument')?.focus({preventScroll:true});
}
function jumpToPanel(id) {
  const panel = document.getElementById('simple-'+id); if (!panel) return;
  const header = document.querySelector('.topbar').getBoundingClientRect().height;
  window.scrollTo({top:Math.max(0,panel.getBoundingClientRect().top+window.scrollY-header-12),behavior:reducedMotion()?'instant':'smooth'});
  panel.focus({preventScroll:true});
}
const stackedLearning = window.matchMedia('(max-width: 1099px), (max-height: 699px)');
function placeLearningFeedback() {
  const feedback = document.getElementById('learning-feedback');
  const board = document.querySelector('.fretboard-panel'), exercise = document.querySelector('.exercise-panel');
  if (!feedback || !board || !exercise) return;
  if (stackedLearning.matches) board.insertBefore(feedback, board.querySelector('.learning-strip') ?? board.querySelector('.board-scroll'));
  else exercise.insertBefore(feedback, exercise.querySelector('#learning-info'));
}
stackedLearning.addEventListener('change',placeLearningFeedback);
let gesture = null;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); }
  catch { notice('Layout changed for this session; browser storage is unavailable.', true); }
}
function refresh(focus) {
  save(); rerender();
  if (focus) document.getElementById(focus)?.focus({preventScroll: true});
}
function button(text, action, id, label) {
  const b = document.createElement('button');
  b.textContent = text; b.dataset.layoutAction = action; b.dataset.panelId = id;
  b.id = `layout-${action}-${id}`; b.setAttribute('aria-label', label); b.title = label;
  return b;
}
export function mountWorkspace(render, notify, configuration = '') {
  rerender = render; notice = notify;
  const grid = document.querySelector('.workspace');
  document.body.dataset.workspace = mode;
  const switcher = document.createElement('div'); switcher.className = 'workspace-switch';
  switcher.setAttribute('aria-label', 'Workspace view');
  switcher.innerHTML = [['learn','Learn'],['practice','Practice'],['overview','Studio'], ...(!simpleWorkspace() ? [['custom','Arrange']] : [])].map(([value,label]) => `<button id="workspace-${value}" data-workspace-mode="${value}" aria-pressed="${mode === value}">${label}</button>`).join('');
  document.querySelector('.header-actions').prepend(switcher);
  if (simpleWorkspace()) { mountSimple(grid, configuration); return; }
  if (mode === 'overview') { mountOverview(grid); return; }
  grid.classList.add('dock-grid'); grid.classList.toggle('layout-editing', editing);
  const controls = document.createElement('details'); controls.className = 'workspace-controls'; controls.id = 'workspace-controls';
  controls.innerHTML = '<summary>Workspace <span>Show, move & resize panels</span></summary><div class="workspace-options"></div>';
  const options = controls.lastElementChild;
  const edit = button(editing ? 'Done arranging' : 'Arrange panels', 'edit', '', 'Arrange panels');
  edit.setAttribute('aria-pressed', String(editing)); options.append(edit);
  options.append(button('Reset layout', 'reset', '', 'Reset panel layout'));
  const hint = document.createElement('p'); hint.textContent = 'Drag panel titles to reorder; drag a bottom corner to resize. Move buttons and arrow keys on resize handles work with a keyboard. Layout saves automatically.';
  options.append(hint);
  const nodes = new Map(PANELS.map(([id, , selector]) => [id, document.querySelector(selector)]));
  for (const [id, label] of PANELS) {
    const toggle = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.checked = !layout.panels[id].hidden; input.dataset.layoutShow = id; input.id = `layout-show-${id}`;
    toggle.append(input, document.createTextNode(label)); options.append(toggle);
  }
  grid.before(controls);
  for (const id of layout.order) {
    let content = nodes.get(id); if (!content) continue;
    const [, label] = PANELS.find(p => p[0] === id), pref = layout.panels[id];
    const outer = document.createElement('section'); outer.className = 'dock-panel'; outer.dataset.panel = id;
    outer.hidden = pref.hidden; outer.style.setProperty('--panel-span', pref.span);
    outer.setAttribute('aria-labelledby', `panel-title-${id}`);
    const header = document.createElement('div'); header.className = 'dock-heading';
    const title = document.createElement(id === 'fretboard' ? 'h1' : 'h2'); title.id = `panel-title-${id}`;
    title.textContent = label; header.append(title);
    if (editing) {
      title.className = 'dock-drag'; title.title = 'Drag to reorder panel';
      header.append(button('↑', 'earlier', id, `Move ${label} earlier`), button('↓', 'later', id, `Move ${label} later`));
    }
    const fold = button(pref.collapsed ? '+' : '−', 'collapse', id, `${pref.collapsed ? 'Expand' : 'Collapse'} ${label}`);
    fold.setAttribute('aria-expanded', String(!pref.collapsed)); fold.setAttribute('aria-controls', `panel-body-${id}`); header.append(fold);
    if (editing) header.append(button('Hide', 'hide', id, `Hide ${label}`));
    outer.append(header);
    const body = document.createElement('div'); body.className = 'dock-body'; body.id = `panel-body-${id}`;
    body.hidden = pref.collapsed; if (pref.height) body.style.height = `${pref.height}px`;
    // Each panel has one heading. Keep its functional controls, remove duplicate titles.
    content.querySelector(':scope > h1.sr-only')?.remove();
    content.querySelectorAll(':scope > .section-title > div:first-child > .eyebrow, :scope > .section-title h1, :scope > .section-title h2').forEach(n => n.remove());
    const emptyTitle = content.querySelector(':scope > .section-title > div:first-child');
    if (emptyTitle && !emptyTitle.children.length) emptyTitle.remove();
    const oldHeader = content.querySelector(':scope > .section-title');
    if (oldHeader) {
      const actions = document.createElement('div'); actions.className = 'dock-actions';
      actions.append(...oldHeader.childNodes); header.insertBefore(actions, fold); oldHeader.remove();
    }
    if (id === 'examples') content.querySelector(':scope > h3')?.remove();
    if (id === 'generate') content.querySelector(':scope > div:first-child')?.remove();
    if (id === 'settings') {
      const holder = document.createElement('div'); holder.className = 'settings-panel';
      holder.append(content.querySelector('.settings-content')); content.remove(); content = holder;
    }
    body.append(content); outer.append(body);
    if (editing && !pref.collapsed) {
      const sizing = document.createElement('div'); sizing.className = 'dock-sizing';
      sizing.append(button('Fit height', 'auto', id, `Fit ${label} height to content`));
      const handle = button('↘', 'resize', id, `Resize ${label}; arrow keys change width and height`);
      handle.className = 'dock-resize'; sizing.append(handle); outer.append(sizing);
    }
    grid.append(outer);
  }
  grid.querySelector('.main-column')?.remove(); grid.querySelector('.side-column')?.remove();
  grid.querySelector('.theory-row')?.remove();
}
export function revealPanel(id) {
  if (simpleWorkspace() && id === 'fretboard') return;
  if (simpleWorkspace()) { mode = 'overview'; focused = null; rerender(); return; }
  if (mode === 'overview') { focused = null; rerender(); return; }
  layout.panels[id].hidden = false; layout.panels[id].collapsed = false; save(); rerender();
}
document.addEventListener('change', e => {
  const id = e.target.dataset.layoutShow;
  if (!id) return;
  layout.panels[id].hidden = !e.target.checked; refresh(e.target.id);
});
document.addEventListener('click', e => {
  const view = e.target.closest('[data-workspace-mode]');
  if (view) {
    mode = view.dataset.workspaceMode; focused = null; configuring = false;
    try { localStorage.setItem('tonedef.workspace.mode.v3', mode); } catch { notice('View changed for this session; browser storage is unavailable.', true); }
    rerender(); (document.getElementById(view.id) ?? document.getElementById(`workspace-${mode}`))?.focus({preventScroll:true}); return;
  }
  const section = e.target.closest('[data-config-section]');
  if (section) { configurationSection = section.dataset.configSection; rerender(); document.getElementById(section.id)?.focus({preventScroll:true}); return; }
  if (e.target.closest('#config-back')) { closeInstrument(); return; }
  const jump = e.target.closest('[data-workspace-jump]');
  if (jump) { jumpToPanel(jump.dataset.workspaceJump); return; }
  const expand = e.target.closest('[data-overview-expand]');
  if (expand) { focused = focused === expand.dataset.overviewExpand ? null : expand.dataset.overviewExpand; rerender(); document.getElementById(expand.id)?.focus({preventScroll:true}); return; }
  if (e.target.closest('a[href="#fretboard"]')) revealPanel('fretboard');
  const b = e.target.closest('[data-layout-action]'); if (!b) return;
  const id = b.dataset.panelId, p = layout.panels[id], action = b.dataset.layoutAction;
  if (action === 'resize') return;
  if (action === 'edit') editing = !editing;
  if (action === 'reset') layout = normalizeLayout();
  if (action === 'hide') p.hidden = true;
  if (action === 'collapse') p.collapsed = !p.collapsed;
  if (action === 'auto') p.height = null;
  if (action === 'earlier' || action === 'later') {
    const visible = layout.order.filter(x => !layout.panels[x].hidden && document.querySelector(`[data-panel="${x}"]`));
    const target = visible[visible.indexOf(id) + (action === 'earlier' ? -1 : 1)];
    if (target) layout.order = movePanel(layout.order, id, target, action === 'later');
  }
  refresh(action === 'hide' ? 'layout-edit-' : b.id);
});
document.addEventListener('pointerdown', e => {
  const handle = e.target.closest('.dock-drag, .dock-resize');
  if (!handle || e.button !== 0) return;
  const panel = handle.closest('[data-panel]'), id = panel.dataset.panel;
  gesture = {id, handle, panel, resizing: handle.classList.contains('dock-resize'), x:e.clientX, y:e.clientY, span:layout.panels[id].span, originalHeight:layout.panels[id].height, height:panel.querySelector('.dock-body').getBoundingClientRect().height};
  handle.setPointerCapture(e.pointerId); panel.classList.add('is-moving'); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!gesture) return;
  const g = gesture;
  if (g.resizing) {
    const p = layout.panels[g.id], width = document.querySelector('.dock-grid').clientWidth;
    if (window.innerWidth > 900) p.span = Math.max(4, Math.min(12, g.span + Math.round((e.clientX-g.x)/(width/12))));
    p.height = Math.max(240, Math.min(1200, g.height + e.clientY-g.y));
    g.panel.style.setProperty('--panel-span', p.span); g.panel.querySelector('.dock-body').style.height = `${p.height}px`;
  } else {
    document.querySelectorAll('.drop-target').forEach(n => n.classList.remove('drop-target'));
    document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-panel]')?.classList.add('drop-target');
  }
});
function finish(e) {
  if (!gesture) return;
  const g = gesture; gesture = null;
  if (e.type === 'pointercancel') {
    layout.panels[g.id].span = g.span; layout.panels[g.id].height = g.originalHeight;
  } else if (!g.resizing) {
    const target = document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-panel]');
    if (target) layout.order = movePanel(layout.order, g.id, target.dataset.panel, e.clientY > target.getBoundingClientRect().top + target.clientHeight/2);
  }
  refresh(`layout-${g.resizing ? 'resize' : 'earlier'}-${g.id}`);
}
document.addEventListener('pointerup', finish);
document.addEventListener('pointercancel', finish);
document.addEventListener('keydown', e => {
  const section = e.target.closest('[data-config-section]');
  if (section && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
    e.preventDefault();
    const ids = ['instrument','sound','display'], index = ids.indexOf(configurationSection);
    configurationSection = ids[e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3];
    rerender(); document.getElementById('config-tab-'+configurationSection)?.focus({preventScroll:true}); return;
  }
  if (instrumentOpen() && e.key === 'Escape' && !document.querySelector('dialog[open]') && !document.getElementById('simple-menu')?.open) {
    e.preventDefault(); closeInstrument(); return;
  }
  if (mode === 'overview' && focused && e.key === 'Escape' && !document.querySelector('dialog[open]')) {
    e.preventDefault(); const id = focused; focused = null; rerender(); document.getElementById(`overview-expand-${id}`)?.focus({preventScroll:true}); return;
  }
  if (gesture && e.key === 'Escape') { e.preventDefault(); finish({type:'pointercancel'}); return; }
  const b = e.target.closest('.dock-resize'); if (!b || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const p = layout.panels[b.dataset.panelId];
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') p.span = Math.max(4, Math.min(12, p.span + (e.key === 'ArrowRight' ? 1 : -1)));
  else p.height = Math.max(240, Math.min(1200, (p.height ?? b.closest('[data-panel]').querySelector('.dock-body').clientHeight) + (e.key === 'ArrowDown' ? 40 : -40)));
  refresh(b.id);
}, true);

function mountOverview(grid) {
  grid.className = 'workspace dock-grid overview-grid';
  if (focused) grid.dataset.focused = focused;
  const nodes = new Map(PANELS.map(([id, , selector]) => [id, document.querySelector(selector)]));
  for (const [id, label] of PANELS) {
    let content = nodes.get(id); if (!content) continue;
    const outer = document.createElement('section'); outer.className = 'dock-panel'; outer.dataset.panel = id;
    outer.setAttribute('aria-labelledby', `panel-title-${id}`);
    const header = document.createElement('div'); header.className = 'dock-heading';
    const heading = document.createElement(id === 'fretboard' ? 'h1' : 'h2'); heading.id = `panel-title-${id}`; heading.textContent = label; header.append(heading);
    const expand = document.createElement('button'); expand.id = `overview-expand-${id}`; expand.dataset.overviewExpand = id;
    expand.textContent = focused === id ? '↙' : '↗'; expand.setAttribute('aria-label', `${focused === id ? 'Return from' : 'Expand'} ${label}`);
    expand.setAttribute('aria-expanded', String(focused === id)); header.append(expand);
    content.querySelector(':scope > h1.sr-only')?.remove();
    content.querySelectorAll(':scope > .section-title h1,:scope > .section-title h2,:scope > .section-title .eyebrow').forEach(n => n.remove());
    const previous = content.querySelector(':scope > .section-title');
    if (previous) { previous.classList.add('overview-panel-actions'); }
    if (id === 'fretboard') {
      const guide = content.querySelector('.fretboard-guide'); if (guide) header.insertBefore(guide, expand);
      const toolbar = content.querySelector('.board-bar'); if (toolbar) header.insertBefore(toolbar, guide ?? expand);
    }
    if (id === 'timeline') {
      const toolbar = content.querySelector('.pattern-toolbar'); if (toolbar) header.insertBefore(toolbar, expand);
    }
    if (id === 'math') {
      const matrix = content.querySelector('.matrix-scroll');
      if (matrix) for (const selector of ['.math-readout', '.equation']) { const node = content.querySelector(selector); if (node) content.insertBefore(node, matrix); }
    }
    if (id === 'settings') {
      const holder = document.createElement('div'); holder.className = 'settings-panel';
      holder.append(content.querySelector('.settings-content')); content.remove(); content = holder;
    }
    const body = document.createElement('div'); body.className = 'dock-body'; body.id = `panel-body-${id}`;
    body.tabIndex = 0; body.setAttribute('role', 'region'); body.setAttribute('aria-label', `${label} contents`);
    body.append(content); outer.append(header, body); grid.append(outer);
  }
  grid.querySelector('.theory-row')?.remove();
}

function mountSimple(grid, configuration) {
  grid.className = 'workspace simple-grid';
  document.querySelector('.context-bar')?.remove();
  document.querySelector('.project-title')?.remove();
  const actions = document.querySelector('.header-actions');
  actions.querySelector('[data-action="stop"]')?.remove();
  const more = document.createElement('details'); more.className = 'simple-menu'; more.id = 'simple-menu';
  const summary = document.createElement('summary'); summary.textContent = 'More'; more.append(summary);
  for (const action of ['redo','projects','settings','help']) {
    const node = actions.querySelector(`[data-action="${action}"]`); if (node) more.append(node);
    if (node && action === 'settings') node.textContent = 'Instrument setup';
    if (node && action === 'help') node.textContent = 'Help & shortcuts';
  }
  actions.append(more);
  const backup = document.querySelector('footer [data-action="export-json"]'); if (backup) more.append(backup);
  document.querySelector('footer')?.remove();
  const board = document.querySelector('.fretboard-panel');
  board.querySelector('#fretboard')?.setAttribute('aria-label','Guitar neck. Arrow keys move; hold Enter or Space to hear a note.');
  const toolbar = board.querySelector('.board-bar');
  toolbar.replaceChildren();
  const instruction = document.createElement('span'); instruction.textContent = 'Tap or hold a note'; toolbar.append(instruction);
  const setup = document.createElement('button'); setup.id = 'quick-instrument'; setup.dataset.action = 'settings';
  setup.textContent = 'Instrument'; setup.setAttribute('aria-expanded',String(configuring));
  setup.setAttribute('aria-controls','simple-exercise'); toolbar.append(setup);
  if (document.querySelector('#setting-volume')?.value === '0') {
    const sound = document.createElement('button'); sound.dataset.action = 'unmute'; sound.textContent = 'Turn sound on'; toolbar.append(sound);
  }
  board.querySelector('.interval-legend')?.remove();
  board.querySelector('.gesture-help')?.remove();
  board.querySelectorAll('[data-help]').forEach(node => node.removeAttribute('data-help'));
  board.querySelectorAll('.note-disc small').forEach(node=>node.remove());
  if (mode === 'learn') { const strip = document.querySelector('.learning-strip'); if (strip) board.insertBefore(strip,board.querySelector('.board-scroll')); }
  placeLearningFeedback();
  if (configuring) {
    const original = document.querySelector('.exercise-panel');
    const replacement = document.createElement('section'); replacement.className = 'panel exercise-panel configuration-panel';
    replacement.setAttribute('aria-label','Instrument setup'); replacement.innerHTML = configuration;
    original.replaceWith(replacement);
    board.querySelectorAll('.learning-strip,.learning-feedback').forEach(node=>node.remove());
  }
  document.querySelectorAll('.learning-jump,.practice-jump').forEach(node => node.remove());
  const legend = board.querySelector('.note-state-legend');
  if (legend) board.insertBefore(legend,board.querySelector('.board-scroll'));
  const recall = board.querySelector('.recall'), exercise = document.querySelector('.exercise-panel');
  if (recall && !configuring) exercise.insertBefore(recall,mode === 'learn' ? exercise.querySelector('#learn-practice') : exercise.querySelector('#practice-info'));
  else recall?.remove();
  const output = board.querySelector('#expression-readout');
  if (output) { output.setAttribute('aria-live','polite'); toolbar.append(output); }
  board.querySelector('.fretboard-guide')?.remove();
  const keep = [
    ['exercise', configuring ? 'Instrument setup' : mode === 'learn' ? 'Try it' : 'Make a pattern', '.exercise-panel'],
    ['fretboard','Play the guitar','.fretboard-panel'],
    ['timeline','Your pattern','.timeline-panel'],
  ];
  const nodes = keep.map(([id,label,selector]) => [id,label,document.querySelector(selector)]);
  grid.replaceChildren();
  document.querySelector('#settings-panel')?.remove();
  for (const [id,label,content] of nodes) {
    const panel = document.createElement('section'); panel.className = 'simple-panel'; panel.dataset.panel = id;
    panel.id = 'simple-'+id; panel.tabIndex = id==='exercise'?0:-1;
    panel.setAttribute('aria-labelledby',`panel-title-${id}`);
    const heading = document.createElement(id === 'fretboard' ? 'h1' : 'h2'); heading.id = `panel-title-${id}`; heading.textContent = label;
    content.querySelector(':scope > h1.sr-only')?.remove();
    panel.append(heading,content); grid.append(panel);
  }
  const jumps = document.createElement('nav'); jumps.className = 'workspace-jumps'; jumps.setAttribute('aria-label','Workspace sections');
  jumps.innerHTML = [['exercise',configuring?'Setup':mode==='learn'?'Lesson':'Choices'],['fretboard','Fretboard'],['timeline','Pattern']].map(([id,label])=>`<button id="jump-${id}" data-workspace-jump="${id}" aria-controls="simple-${id}">${label}</button>`).join('');
  grid.after(jumps); updateJumpState();
}

let jumpFrame = 0;
function updateJumpState() {
  jumpFrame = 0;
  if (!simpleWorkspace()) return;
  const panels = [...document.querySelectorAll('.simple-panel')], offset = (document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0)+24;
  const atEnd = window.scrollY>0 && window.scrollY+innerHeight>=document.documentElement.scrollHeight-2;
  const current = atEnd ? panels.at(-1) : panels.findLast(panel=>panel.getBoundingClientRect().top<=offset) ?? panels[0];
  for (const button of document.querySelectorAll('[data-workspace-jump]')) {
    if (button.dataset.workspaceJump === current?.dataset.panel) button.setAttribute('aria-current','true');
    else button.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll',()=>{ if (!jumpFrame) jumpFrame=requestAnimationFrame(updateJumpState); },{passive:true});
window.addEventListener('resize',updateJumpState);
document.addEventListener('click',e=>{
  const menu = document.getElementById('simple-menu');
  if (menu?.open && (!menu.contains(e.target) || e.target.closest('button'))) menu.open = false;
});
document.addEventListener('keydown',e=>{
  const menu = document.getElementById('simple-menu');
  if (e.key==='Escape' && menu?.open) { menu.open=false; menu.querySelector('summary').focus(); }
});
