import { Player } from './audio.js';
import { midiOf } from './model.js';

export function bendAmount(distance) {
  return Math.min(2, Math.abs(distance) / 40);
}

// Interpolate actual fret centers, including a capo or a gap in the visible range.
export function slidePitch(points, x) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (!sorted.length) return null;
  if (x <= sorted[0].x) return sorted[0].midi;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    if (x <= b.x) return a.midi + (b.midi - a.midi) * (x - a.x) / Math.max(1, b.x - a.x);
  }
  return sorted.at(-1).midi;
}

export function installExpression({ settings, tool, blocked, describe, error, hideHelp }) {
  const player = new Player();
  let active = null, suppressed = null, limitTimer;
  const output = () => document.querySelector('#expression-readout');
  function show(g) {
    document.querySelectorAll('.fret.sounding').forEach(n => n.classList.remove('sounding'));
    const closest = g.points.reduce((best, p) => Math.abs(p.midi - g.pitch) < Math.abs(best.midi - g.pitch) ? p : best);
    (g.mode === 'bend' ? g.button : closest.button).classList.add('sounding');
    if (output()) {
      const cents = Math.round((g.pitch - g.base) * 100);
      output().textContent = `${describe(Math.round(g.pitch))} · ${g.mode || 'Pluck'}${g.mode ? ` ${cents >= 0 ? '+' : ''}${cents} cents` : ''}${settings().volume === 0 ? ' · muted' : ''}`;
    }
    g.voice?.pitch(g.pitch);
  }
  function finish(cancel = false) {
    const g = active;
    if (!g) return;
    active = null;
    clearTimeout(limitTimer);
    g.voice?.release();
    if (cancel || !g.voice) player.stop();
    if (g.mode || cancel || g.keyboard) suppressed = { button: g.button, until: performance.now() + 700 };
    if (g.pointer !== undefined && g.button.hasPointerCapture(g.pointer)) g.button.releasePointerCapture(g.pointer);
    document.querySelectorAll('.fret.sounding').forEach(n => n.classList.remove('sounding'));
    document.querySelector('#fretboard')?.classList.remove('expressing');
    if (output()) output().textContent += cancel ? ' · cancelled' : ' · released';
  }
  function start(button, pointer, x, y, keyboard = false) {
    finish(true);
    const s = settings(), [stringId, fret] = button.dataset.pos.split(':');
    const points = [...button.closest('.string-row').querySelectorAll('[data-pos]')].map(n => {
      const r = n.getBoundingClientRect(), f = Number(n.dataset.pos.split(':')[1]);
      return { x: r.x + r.width / 2, midi: midiOf({ stringId, fret: f }, s), button: n };
    });
    const base = midiOf({ stringId, fret: Number(fret) }, s);
    const g = active = { button, pointer, x, y, points, base, pitch: base, mode: '', keyboard, voice: null };
    hideHelp();
    document.querySelector('#fretboard')?.classList.add('expressing');
    show(g);
    player.hold(base, s).then(voice => {
      if (active !== g) { voice?.release(); return; }
      g.voice = voice;
      voice?.pitch(g.pitch);
    }).catch(e => { finish(true); error(e.message); });
    limitTimer = setTimeout(() => finish(true), 20000);
    return g;
  }
  document.addEventListener('pointerdown', e => {
    const button = e.target.closest?.('.fret');
    if (!button || button.disabled || e.button !== 0 || !e.isPrimary || blocked() || tool() === 'key' || !settings().audition) return;
    suppressed = null;
    start(button, e.pointerId, e.clientX, e.clientY);
    button.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', e => {
    const g = active;
    if (!g || g.keyboard || e.pointerId !== g.pointer) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.mode && Math.hypot(dx, dy) < 8) return;
    g.mode ||= Math.abs(dy) > Math.abs(dx) * 1.3 ? 'bend' : 'slide';
    e.preventDefault(); hideHelp();
    const origin = g.points.find(p => p.button === g.button).x;
    g.pitch = g.mode === 'bend' ? g.base + bendAmount(dy) : slidePitch(g.points, origin + dx);
    show(g);
  }, { passive: false });
  document.addEventListener('pointerup', e => { if (active?.pointer === e.pointerId) finish(); });
  for (const type of ['pointercancel', 'lostpointercapture']) document.addEventListener(type, e => {
    if (active?.pointer === e.pointerId) finish(true);
  });
  document.addEventListener('click', e => {
    if (suppressed && performance.now() < suppressed.until && e.target.closest?.('.fret') === suppressed.button) {
      e.preventDefault(); e.stopImmediatePropagation(); suppressed = null;
    }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { finish(true); player.stop(); return; }
    const button = e.target.closest?.('.fret');
    if (!button || button.disabled || blocked() || tool() !== 'explore' || !settings().audition) return;
    if (['Space', 'Enter'].includes(e.code)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) start(button, undefined, 0, 0, true);
    } else if (active?.keyboard && e.key.startsWith('Arrow')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
        active.mode = 'bend';
        active.pitch = Math.max(active.base, Math.min(active.base + 2, active.pitch + (e.key === 'ArrowUp' ? 0.25 : -0.25)));
      } else {
        active.mode = 'slide';
        const direction = (e.key === 'ArrowRight' ? 1 : -1) * (settings().leftHanded ? -1 : 1);
        active.pitch = Math.max(Math.min(...active.points.map(p => p.midi)), Math.min(Math.max(...active.points.map(p => p.midi)), active.pitch + direction));
      }
      show(active);
    }
  }, true);
  document.addEventListener('keyup', e => {
    if (active?.keyboard && ['Space', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); finish(); }
  }, true);
  const stop = () => { finish(true); player.stop(); };
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return { cancel: () => finish(true), stop, audition: (midi) => player.audition([midi], settings()) };
}
