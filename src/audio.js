import { midiOf, PPQ } from "./model.js";
import { frequency } from "./theory.js";
export function playbackPlan(project, {from = 0, to = project.events.length - 1, countIn = false, response = false} = {}) {
  const s = project.settings,
    secondsPerTick = 60 / s.tempo / PPQ;
  if (project.events.length && (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > to || to >= project.events.length))
    throw Error('Choose a passage inside the pattern.');
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
        offset: event.kind === "chord" && stroke !== "fingers"
          ? Math.min(0.025, duration / (notes.length + 1)) * i
          : 0,
      })),
    };
  });
  const selected = events.slice(from,to + 1);
  let passageTicks = 0;
  const passage = selected.map((event,i) => {
    const start=passageTicks * secondsPerTick;
    passageTicks += project.events[from+i].duration;
    return {...event,start,phase:response?'listen':'play'};
  });
  const passDuration = passageTicks * secondsPerTick;
  const [beats, unit] = s.meter.split("/").map(Number),
    barTicks = (beats * PPQ * 4) / unit,
    beatTicks = unit === 8 && beats % 3 === 0 ? PPQ * 1.5 : (PPQ * 4) / unit;
  return {
    events: response ? [...passage,...passage.map(event => ({...event,start:event.start+passDuration,notes:[],phase:'answer'}))] : passage,
    duration: passDuration * (response ? 2 : 1),
    passDuration,
    countIn: countIn && passage.length ? barTicks * secondsPerTick : 0,
    response,
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
  voice(midi, start, duration, volume, wave = "guitar", held = false) {
    if (volume <= 0) return;
    const ctx = this.context,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    let filter = null;
    if (wave === "guitar") {
      // A picked string has a rich attack whose upper partials decay first.
      const real = new Float32Array(17), imag = new Float32Array(17);
      for (let h = 1; h < imag.length; h++)
        imag[h] = Math.sin(Math.PI * h * 0.19) / (h * h * 0.19);
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.35;
      const fundamental = frequency(midi);
      filter.frequency.setValueAtTime(Math.min(ctx.sampleRate * 0.45, fundamental * 16), start);
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(ctx.sampleRate * 0.45, Math.max(180, fundamental * 2.2)),
        start + Math.min(0.3, duration * 0.8));
    } else osc.type = wave;
    osc.frequency.value = frequency(midi);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(
      volume,
      start + Math.min(wave === "guitar" ? 0.003 : 0.012, duration / 4),
    );
    if (wave === "guitar")
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.16), start + (held ? 0.8 : duration * 0.85));
    else gain.gain.setValueAtTime(volume, start + duration * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    if (filter) osc.connect(filter).connect(gain).connect(ctx.destination);
    else osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
    const node = { osc, gain };
    this.voices.add(node);
    osc.onended = () => {
      osc.disconnect();
      filter?.disconnect();
      gain.disconnect();
      this.voices.delete(node);
    };
    let released = false;
    return {
      pitch: (nextMidi) => {
        if (released || !this.voices.has(node) || !Number.isFinite(nextMidi)) return;
        const hz = 440 * 2 ** ((Math.max(0, Math.min(129, nextMidi)) - 69) / 12);
        osc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.008);
      },
      release: () => {
        if (released || !this.voices.has(node)) return;
        released = true;
        const at = Math.max(ctx.currentTime, start + 0.16);
        gain.gain.cancelAndHoldAtTime(at);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
        osc.stop(at + 0.16);
      },
    };
  }
  async hold(midi, settings) {
    this.stop();
    const revision = this.revision;
    await this.ready();
    if (revision !== this.revision) return;
    return this.voice(midi, this.context.currentTime + 0.005, 20,
      settings.volume / 100 * 0.22, settings.waveform, true);
  }
  async audition(midis, settings) {
    const revision = this.revision;
    await this.ready();
    if (revision !== this.revision) return;
    const start = this.context.currentTime + 0.02;
    for (const [index, midi] of midis.entries())
      this.voice(
        midi,
        start + index * 0.025,
        0.65,
        ((settings.volume / 100) * 0.22) / Math.sqrt(Math.max(1, midis.length)),
        settings.waveform,
      );
  }
  async play(project, options) {
    return this.playPlan(playbackPlan(project, options), project.settings);
  }
  async playSequence(midis, settings) {
    const duration = 60 / 90;
    const pitches = midis.filter(midi => Number.isFinite(midi) && midi >= 0 && midi <= 127);
    const plan = {
      events: pitches.map((midi, index) => ({ id: `learn-${index}`, start: index * duration, duration, notes: [{midi, offset: 0}] })),
      duration: pitches.length * duration, beatTicks: PPQ, barTicks: PPQ * 4, secondsPerTick: duration / PPQ,
    };
    return this.playPlan(plan, {...settings, loop: false, metronome: false});
  }
  async playPlan(plan, s) {
    this.stop();
    const revision = this.revision;
    await this.ready();
    if (revision !== this.revision) return;
    if (!plan.events.length || !plan.duration) return;
    this.running = true;
    const countIn = plan.countIn || 0;
    const countStart = this.context.currentTime + 0.07;
    this.origin = countStart + countIn;
    let cursor = 0,
      cycle = 0,
      nextClick = 0,
      clickCycle = 0,
      countClick = 0,
      lastPosition = "";
    const clickSeconds = plan.beatTicks * plan.secondsPerTick;
    const pump = () => {
      if (!this.running || revision !== this.revision) return;
      const now = this.context.currentTime,
        horizon = now + 0.12;
      while (countClick < countIn && countStart + countClick < horizon) {
        this.voice(countClick === 0 ? 96 : 89,countStart+countClick,0.035,(s.volume/100)*0.1,'sine');
        countClick += clickSeconds;
      }
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
      if (s.metronome || plan.response)
        while (s.loop || clickCycle === 0) {
          const start = this.origin + clickCycle * plan.duration + nextClick;
          if (start >= horizon) break;
          const barSeconds = plan.barTicks * plan.secondsPerTick,
            phasePosition = nextClick >= (plan.passDuration ?? plan.duration) ? nextClick-plan.passDuration : nextClick,
            accent =
              Math.abs(
                phasePosition / barSeconds - Math.round(phasePosition / barSeconds),
              ) < 0.001;
          if (s.metronome || (plan.response && nextClick >= plan.passDuration)) this.voice(
            accent ? 96 : 89,
            start,
            0.035,
            (s.volume / 100) * 0.1,
            "sine",
          );
          // Each answer starts at its own beat 1, even for an off-beat passage.
          nextClick = plan.response && nextClick < plan.passDuration
            ? Math.min(plan.passDuration,nextClick + clickSeconds) : nextClick + clickSeconds;
          if (nextClick >= plan.duration - 1e-9) {
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
      const beat = elapsed < 0 ? Math.max(0,Math.floor((now-countStart)/clickSeconds)) + 1
        : Math.floor(((position >= (plan.passDuration ?? plan.duration) ? position-plan.passDuration : position) + 1e-9)/clickSeconds) + 1;
      const index = plan.events.findLastIndex((e) => e.start <= position),
        cycleIndex = Math.floor(Math.max(0, elapsed) / plan.duration),
        key = cycleIndex + ":" + index + ':' + beat;
      if (key !== lastPosition) {
        lastPosition = key;
        this.onStep(
          plan.events[index]?.id ?? null,
          Math.max(0, position) / plan.duration,
          {phase:elapsed < 0 && countIn ? 'count-in' : plan.events[index]?.phase ?? 'play',beat,beats:Math.round(plan.barTicks/plan.beatTicks),cycle:cycleIndex + 1},
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
