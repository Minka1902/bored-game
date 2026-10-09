// Every sound is synthesized with WebAudio from a few numbers: no audio files ship with the app.
import type { Sfx, SfxName } from './types';

interface Voice {
  /** oscillator wave, or filtered white noise */
  type: OscillatorType | 'noise';
  /** start and end frequency (for noise: the filter frequency) */
  f0: number;
  f1?: number;
  dur: number;
  vol: number;
  delay?: number;
  /** filter used for noise voices */
  filter?: BiquadFilterType;
}

const PRESETS: Record<SfxName, Voice[]> = {
  pop: [
    { type: 'sine', f0: 700, f1: 160, dur: 0.07, vol: 0.5 },
    { type: 'noise', f0: 2400, dur: 0.03, vol: 0.25, filter: 'bandpass' },
  ],
  click: [{ type: 'square', f0: 1900, f1: 1300, dur: 0.025, vol: 0.12 }],
  tick: [{ type: 'triangle', f0: 2600, dur: 0.018, vol: 0.18 }],
  whoosh: [{ type: 'noise', f0: 600, f1: 3200, dur: 0.22, vol: 0.28, filter: 'bandpass' }],
  hit: [
    { type: 'square', f0: 240, f1: 80, dur: 0.12, vol: 0.2 },
    { type: 'noise', f0: 1200, dur: 0.06, vol: 0.2, filter: 'lowpass' },
  ],
  score: [
    { type: 'triangle', f0: 880, dur: 0.07, vol: 0.28 },
    { type: 'triangle', f0: 1320, dur: 0.1, vol: 0.28, delay: 0.06 },
  ],
  fail: [{ type: 'sawtooth', f0: 320, f1: 55, dur: 0.5, vol: 0.2 }],
  win: [523, 659, 784, 1047].map((f, i) => ({ type: 'triangle' as const, f0: f, dur: 0.14, vol: 0.25, delay: i * 0.08 })),
  thud: [
    { type: 'sine', f0: 150, f1: 45, dur: 0.16, vol: 0.6 },
    { type: 'noise', f0: 500, dur: 0.08, vol: 0.25, filter: 'lowpass' },
  ],
  blip: [{ type: 'square', f0: 660, dur: 0.05, vol: 0.12 }],
  kick: [{ type: 'sine', f0: 160, f1: 40, dur: 0.22, vol: 0.9 }],
  snare: [
    { type: 'noise', f0: 1800, dur: 0.16, vol: 0.45, filter: 'bandpass' },
    { type: 'triangle', f0: 220, f1: 160, dur: 0.08, vol: 0.3 },
  ],
  hat: [{ type: 'noise', f0: 7500, dur: 0.05, vol: 0.3, filter: 'highpass' }],
  clap: [0, 0.012, 0.024].map((d) => ({ type: 'noise' as const, f0: 1300, dur: 0.06, vol: 0.4, delay: d, filter: 'bandpass' as const })),
};

const MAX_VOICES = 24;

export function createSfx(): Sfx {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let active = 0;

  const ensure = (): AudioContext | null => {
    if (ac) return ac;
    try {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ac = new Ctor() as AudioContext;
      master = ac.createGain();
      master.gain.value = 0.55;
      master.connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      ac = null;
    }
    return ac;
  };

  const voice = (v: Voice, pitch: number, vol: number) => {
    const a = ensure();
    if (!a || !master || active >= MAX_VOICES || a.state !== 'running') return;
    const t = a.currentTime + (v.delay ?? 0);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.vol * vol), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
    g.connect(master);
    let src: AudioScheduledSourceNode;
    if (v.type === 'noise') {
      const n = a.createBufferSource();
      n.buffer = noise;
      const f = a.createBiquadFilter();
      f.type = v.filter ?? 'bandpass';
      f.frequency.setValueAtTime(v.f0 * pitch, t);
      if (v.f1) f.frequency.exponentialRampToValueAtTime(v.f1 * pitch, t + v.dur);
      n.connect(f).connect(g);
      src = n;
    } else {
      const o = a.createOscillator();
      o.type = v.type;
      o.frequency.setValueAtTime(v.f0 * pitch, t);
      if (v.f1) o.frequency.exponentialRampToValueAtTime(v.f1 * pitch, t + v.dur);
      o.connect(g);
      src = o;
    }
    active++;
    src.onended = () => {
      active--;
      g.disconnect();
    };
    src.start(t);
    src.stop(t + v.dur + 0.02);
  };

  const sfx: Sfx = {
    enabled: true,
    unlock() {
      const a = ensure();
      if (a && a.state === 'suspended') void a.resume().catch(() => {});
    },
    play(name, pitch = 1, vol = 1) {
      if (!sfx.enabled) return;
      for (const v of PRESETS[name]) voice(v, pitch, vol);
    },
    tone(freq, dur = 0.25, type = 'triangle', vol = 0.3) {
      if (!sfx.enabled) return;
      voice({ type, f0: freq, dur, vol }, 1, 1);
    },
  };
  return sfx;
}
