/* One delegated, non-modal tooltip. Focus, hover and explicit help taps work.
   No musical action is intercepted or turned into a help-only first tap. */
let trigger = null, timer = null, showTimer = null, popup = null;
function ensurePopup() {
  if (popup) return popup;
  popup = document.createElement('div');
  popup.id = 'ui-tooltip';
  popup.className = 'ui-tooltip';
  popup.setAttribute('role', 'tooltip');
  popup.hidden = true;
  document.body.append(popup);
  popup.addEventListener('pointerenter', () => clearTimeout(timer));
  popup.addEventListener('pointerleave', () => scheduleHide());
  return popup;
}
export function hideHelp() {
  clearTimeout(timer); clearTimeout(showTimer);
  if (popup) popup.hidden = true;
  trigger = null;
}
function showHelp(node) {
  clearTimeout(timer); clearTimeout(showTimer);
  if (!node?.isConnected || !node.dataset.help) return;
  const box = ensurePopup();
  trigger = node;
  box.textContent = node.dataset.help;
  box.hidden = false;
  const rect = node.getBoundingClientRect();
  const width = box.offsetWidth, height = box.offsetHeight;
  box.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  const below = rect.bottom + 6;
  box.style.top = `${Math.max(8, below + height < window.innerHeight - 8 ? below : rect.top - height - 6)}px`;
}
function scheduleHide() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (trigger?.matches(':hover') || popup?.matches(':hover') || document.activeElement === trigger) return;
    hideHelp();
  }, 180);
}
export function prepareHelp(root = document) {
  ensurePopup();
  root.querySelectorAll('[title]').forEach((node) => {
    if (!node.matches('button, input, select, summary, [tabindex]')) return;
    node.dataset.help ||= node.title;
    node.removeAttribute('title');
  });
  root.querySelectorAll('[data-help]').forEach((node) => {
    node.setAttribute('aria-description', node.dataset.help);
    // Accessible names remain independent of explanatory help.
    node.setAttribute('aria-describedby', 'ui-tooltip');
  });
}
document.addEventListener('pointerover', (event) => {
  if (event.pointerType === 'touch') return;
  const node = event.target.closest?.('[data-help]');
  if (!node || node === trigger) return;
  // A pointerout from the previous control must not cancel this new hover.
  clearTimeout(timer); clearTimeout(showTimer);
  showTimer = setTimeout(() => showHelp(node), 260);
});
document.addEventListener('pointerout', (event) => {
  const node = event.target.closest?.('[data-help]');
  if (!node || node.contains(event.relatedTarget)) return;
  clearTimeout(showTimer); scheduleHide();
});
document.addEventListener('focusin', (event) => {
  const node = event.target.closest?.('[data-help]');
  if (node && (node.matches(':focus-visible') || node.classList.contains('help-trigger'))) showHelp(node); else hideHelp();
});
document.addEventListener('focusout', () => scheduleHide());
document.addEventListener('click', (event) => {
  const node = event.target.closest?.('.help-trigger');
  if (node) showHelp(node);
  else if (!popup?.contains(event.target)) hideHelp();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && popup && !popup.hidden) { hideHelp(); event.preventDefault(); event.stopPropagation(); }
}, true);
window.addEventListener('resize', hideHelp);
window.addEventListener('scroll', () => {
  // Scroll-into-view can finish just after pointerover; keep its pending help.
  if (popup && !popup.hidden) hideHelp();
}, true);
