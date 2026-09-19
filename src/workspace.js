import {PANELS, normalizeLayout, movePanel} from './layout.js';
const KEY = 'tonedef.workspace.v1';
let layout;
try { layout = normalizeLayout(JSON.parse(localStorage.getItem(KEY))); } catch { layout = normalizeLayout(); }
let editing = false, rerender = () => {}, notice = () => {};
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
export function mountWorkspace(render, notify) {
  rerender = render; notice = notify;
  const grid = document.querySelector('.workspace');
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
  layout.panels[id].hidden = false; layout.panels[id].collapsed = false; save(); rerender();
}
document.addEventListener('change', e => {
  const id = e.target.dataset.layoutShow;
  if (!id) return;
  layout.panels[id].hidden = !e.target.checked; refresh(e.target.id);
});
document.addEventListener('click', e => {
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
  if (gesture && e.key === 'Escape') { e.preventDefault(); finish({type:'pointercancel'}); return; }
  const b = e.target.closest('.dock-resize'); if (!b || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const p = layout.panels[b.dataset.panelId];
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') p.span = Math.max(4, Math.min(12, p.span + (e.key === 'ArrowRight' ? 1 : -1)));
  else p.height = Math.max(240, Math.min(1200, (p.height ?? b.closest('[data-panel]').querySelector('.dock-body').clientHeight) + (e.key === 'ArrowDown' ? 40 : -40)));
  refresh(b.id);
}, true);
