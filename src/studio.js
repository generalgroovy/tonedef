// Presentation state is independent of projects and of the optional saved panel layout.
const KEY = 'tonedef.studio.v1';
const SECTIONS = [['notes', 'Notes & intervals'], ['key', 'Key map'], ['practice', 'Practice'], ['instrument', 'Instrument']];
let custom = false, active = '', render = () => {};
try { custom = JSON.parse(localStorage.getItem(KEY))?.custom === true; } catch {}
export const studioCustom = () => custom;
export function studioPanel(id) { active = SECTIONS.some(([key]) => key === id) ? id : ''; }
const $ = selector => document.querySelector(selector);
function element(tag, className, html = '') {
  const node = document.createElement(tag); node.className = className; node.innerHTML = html; return node;
}
function unfold(panel) {
  if (!panel) return;
  panel.hidden = false;
  const body = panel.querySelector('.dock-body');
  body.hidden = false; body.style.height = '';
}
export function mountStudio(rerender) {
  render = rerender;
  const grid = $('.workspace');
  document.body.classList.toggle('focused-studio', !custom);
  document.body.classList.toggle('custom-studio', custom);

  // One key selector and one color reference for the entire app.
  const boardBar = $('.board-bar');
  const key = $('.context-fields');
  const warning = $('.key-tones .warning-text');
  boardBar.insertBefore(key, boardBar.querySelector('.hear-toggle'));
  if (warning) key.append(warning);
  const colors = element('details', 'board-display', '<summary>Colors & labels</summary>');
  colors.firstElementChild.textContent = `Colors · ${$('.reference-readout').textContent}`;
  colors.firstElementChild.setAttribute('aria-label', 'Colors and labels');
  colors.id = 'board-display';
  const colorBody = element('div', 'board-display-content');
  colorBody.append($('.reference-row'), $('#half-step-labels'), $('.interval-legend'));
  colors.append(colorBody);
  const display = $('[data-studio-section="display"]');
  display.querySelector('h3').remove();
  colorBody.append(display);
  boardBar.append(colors);
  $('.context-bar').remove();
  $('.board-context').classList.add('sr-only');
  boardBar.querySelector('.help-trigger')?.remove();
  const guide = $('.fretboard-guide');
  const mode = $('#fret-action').value;
  const instructions = {
    chord: 'Click to build a chord · one note per string. Hold & drag to slide or bend.',
    melody: $('#setting-append')?.checked ? 'Click to append notes in order. Hold & drag to slide or bend.' : 'Click to replace the selected note. Turn on Append to record a sequence.',
    explore: 'Click to hear a note. Hold & drag sideways to slide, vertically to bend.',
    key: 'Click a note to include or remove its pitch from the key.'
  };
  guide.prepend(element('span', 'action-hint', instructions[mode]));
  $('.fretboard-panel').append(guide);

  // Event properties belong to the selected card; transport settings apply to the pattern.
  const edit = $('.event-editor');
  if (edit) {
    const properties = element('details', 'event-properties', '<summary>Edit selected event</summary>');
    properties.id = 'event-properties';
    edit.before(properties); properties.append(edit);
    const actions = $('#event-actions');
    edit.append(actions.querySelector('.button-row')); actions.remove();
  }
  $('.pattern-toolbar').prepend(element('h2', 'pattern-heading', 'Pattern'));
  if (custom) return;

  $('#workspace-controls').hidden = true;
  const panels = new Map([...grid.querySelectorAll('.dock-panel')].map(p => [p.dataset.panel, p]));
  for (const p of panels.values()) unfold(p);
  panels.get('fretboard').querySelector('.dock-heading').replaceChildren($('#panel-title-fretboard'));
  grid.replaceChildren(panels.get('fretboard'), panels.get('timeline'));
  const nav = element('nav', 'studio-nav');
  nav.setAttribute('aria-label', 'Explore and configure');
  nav.innerHTML = SECTIONS.map(([id, title]) => `<button id="studio-${id}" data-studio-panel="${id}" aria-expanded="${active === id}" aria-controls="studio-content-${id}">${title}<span aria-hidden="true">${active === id ? '−' : '+'}</span></button>`).join('');
  grid.append(nav);
  const sections = new Map(SECTIONS.map(([id, title]) => {
    const section = element('section', `studio-section studio-${id}`);
    section.id = `studio-content-${id}`; section.hidden = active !== id;
    section.setAttribute('aria-labelledby', `studio-${id}`);
    section.innerHTML = `<div class="studio-section-heading"><h2>${title}</h2><button data-studio-close aria-label="Close ${title}">Close ×</button></div><div class="studio-section-body"></div>`;
    grid.append(section); return [id, section.lastElementChild];
  }));
  for (const id of ['inspector', 'math']) sections.get('notes').append(panels.get(id));
  if (panels.has('transitions')) sections.get('notes').append(panels.get('transitions'));
  sections.get('key').append(panels.get('tools'));
  sections.get('practice').append(panels.get('settings').querySelector('[data-studio-section="practice"]'));
  const ranges = $('#practice-ranges');
  $('[data-studio-section="practice"] .generation-actions').before(ranges);
  for (const id of ['instrument', 'sound']) sections.get('instrument').append(panels.get('settings').querySelector(`[data-studio-section="${id}"]`));
  sections.get('instrument').querySelector('[data-studio-section="instrument"] > h3').remove();
  // Detached obsolete settings shell contains no controls after reparenting.
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-studio-panel], [data-studio-layout], [data-studio-close]');
  if (!button) return;
  if (button.hasAttribute('data-studio-layout')) {
    custom = !custom;
    try { localStorage.setItem(KEY, JSON.stringify({custom})); } catch {}
    render();
    $('#app-options').open = false;
    (custom ? $('#workspace-controls > summary') : $('#fret-action'))?.focus({preventScroll: true});
    return;
  }
  const previous = active;
  active = button.hasAttribute('data-studio-close') || active === button.dataset.studioPanel ? '' : button.dataset.studioPanel;
  render();
  $(`#studio-${active || previous}`)?.focus({preventScroll: true});
  if (active) $(`#studio-content-${active}`)?.scrollIntoView({block: 'nearest', behavior: 'instant'});
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !active || custom || $('dialog[open]') || document.querySelector('.expressing')) return;
  // Do not interrupt a native select or an expression/range cancellation.
  if (!event.target.closest('.studio-section') || event.target.matches('select,[role="slider"]')) return;
  const previous = active; active = ''; render(); $(`#studio-${previous}`)?.focus({preventScroll: true});
});
