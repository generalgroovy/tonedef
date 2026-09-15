import { midiOf, PPQ } from "./model.js";
import { frequency } from "./theory.js";
export function playbackPlan(project) {
  const s = project.settings,
    secondsPerTick = 60 / s.tempo / PPQ;
  let tick = 0;
  const events = project.events.map((event, index) => {
    const start = tick * secondsPerTick;
    const duration = event.duration * secondsPerTick;
    tick += event.duration;
    let notes = [...event.notes].sort(
      (a, b) => Number(a.stringId.slice(1)) - Number(b.stringId.slice(1)),
    );
    const stroke =
      event.picking === "alternate"
        ? index % 2
          ? "up"
          : "down"
        : event.picking;
    if (stroke === "up") notes.reverse();
    return {
      id: event.id,
      index,
      start,
      duration,
      notes: notes.map((n, i) => ({
        midi: midiOf(n, s),
        offset: ["up", "down"].includes(stroke)
          ? Math.min(0.025, duration / (notes.length + 1)) * i
          : 0,
      })),
    };
  });
  const [beats, unit] = s.meter.split("/").map(Number),
    barTicks = (beats * PPQ * 4) / unit,
    beatTicks = unit === 8 && beats % 3 === 0 ? PPQ * 1.5 : (PPQ * 4) / unit;
  return {
    events,
    duration: tick * secondsPerTick,
    barTicks,
    beatUnitTicks: (PPQ * 4) / unit,
    beatTicks,
    secondsPerTick,
  };
}
export class Player {
  constructor(onStep = () => {}, onStop = () => {}) {
    this.onStep = onStep;
    this.onStop = onStop;
    this.context = null;
    this.voices = new Set();
    this.timer = null;
    this.running = false;
    this.revision = 0;
  }
  async ready() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
  }
  voice(midi, start, duration, volume, wave = "triangle") {
    if (volume <= 0) return;
    const ctx = this.context,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = frequency(midi);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(
      volume,
      start + Math.min(0.012, duration / 4),
    );
    gain.gain.setValueAtTime(volume, start + duration * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
    const node = { osc, gain };
    this.voices.add(node);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.voices.delete(node);
    };
  }
  async audition(midis, settings) {
    const revision = this.revision;
    await this.ready();
    if (revision !== this.revision) return;
    const start = this.context.currentTime + 0.02;
    for (const midi of midis)
      this.voice(
        midi,
        start,
        0.45,
        ((settings.volume / 100) * 0.22) / Math.sqrt(Math.max(1, midis.length)),
        settings.waveform,
      );
  }
  async play(project) {
    this.stop();
    const revision = this.revision;
    await this.ready();
    if (revision !== this.revision) return;
    const plan = playbackPlan(project);
    if (!plan.events.length || !plan.duration) return;
    this.running = true;
    const s = project.settings;
    this.origin = this.context.currentTime + 0.07;
    let cursor = 0,
      cycle = 0,
      nextClick = 0,
      clickCycle = 0,
      lastPosition = "";
    const clickSeconds = plan.beatTicks * plan.secondsPerTick;
    const pump = () => {
      if (!this.running || revision !== this.revision) return;
      const now = this.context.currentTime,
        horizon = now + 0.12;
      // Schedule across loop boundaries ahead of the audio clock, never after a loop ends.
      while (s.loop || cycle === 0) {
        const e = plan.events[cursor],
          start = this.origin + cycle * plan.duration + e.start;
        if (start >= horizon) break;
        for (const note of e.notes)
          this.voice(
            note.midi,
            start + note.offset,
            Math.max(0.04, e.duration * 0.82 - note.offset),
            ((s.volume / 100) * 0.22) / Math.sqrt(e.notes.length || 1),
            s.waveform,
          );
        if (++cursor === plan.events.length) {
          cursor = 0;
          cycle++;
        }
      }
      if (s.metronome)
        while (s.loop || clickCycle === 0) {
          const start = this.origin + clickCycle * plan.duration + nextClick;
          if (start >= horizon) break;
          const barSeconds = plan.barTicks * plan.secondsPerTick,
            accent =
              Math.abs(
                nextClick / barSeconds - Math.round(nextClick / barSeconds),
              ) < 0.001;
          this.voice(
            accent ? 96 : 89,
            start,
            0.035,
            (s.volume / 100) * 0.1,
            "sine",
          );
          nextClick += clickSeconds;
          if (nextClick >= plan.duration) {
            nextClick = 0;
            clickCycle++;
          }
        }
      const elapsed = now - this.origin;
      if (!s.loop && elapsed >= plan.duration) {
        this.stop();
        return;
      }
      const position =
        s.loop && elapsed >= 0 ? elapsed % plan.duration : elapsed;
      const index = plan.events.findLastIndex((e) => e.start <= position),
        key = Math.floor(Math.max(0, elapsed) / plan.duration) + ":" + index;
      if (key !== lastPosition) {
        lastPosition = key;
        this.onStep(
          plan.events[index]?.id ?? null,
          Math.max(0, position) / plan.duration,
        );
      }
    };
    pump();
    this.timer = setInterval(pump, 20);
  }
  stop() {
    this.revision++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    for (const { osc, gain } of this.voices) {
      try {
        gain.gain.cancelScheduledValues(this.context.currentTime);
        gain.gain.setValueAtTime(0, this.context.currentTime);
        osc.stop();
      } catch {}
    }
    this.voices.clear();
    this.onStep(null, 0);
    this.onStop();
  }
}
