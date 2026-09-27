// Sound effects, synthesised with WebAudio so there are no assets to load.
// Every sound is a burst of filtered noise and/or a short tone, shaped per
// material: stone clicks, wood knocks, dirt thuds, glass pings.
//
// Browsers only allow audio after a user gesture, so nothing is created until
// unlock() is called from one (the Play button).

// Per material: [filter type, centre Hz, Q, strike length s, tone Hz or 0, gain].
const MATERIAL = {
  stone: ['bandpass', 2300, 1.4, 0.07, 190, 0.55],
  wood:  ['bandpass', 850, 2.2, 0.09, 300, 0.6],
  dirt:  ['lowpass', 650, 0.8, 0.10, 0, 0.7],
  sand:  ['highpass', 2600, 0.7, 0.11, 0, 0.35],
  snow:  ['lowpass', 1500, 0.6, 0.12, 0, 0.4],
  plant: ['bandpass', 3800, 0.6, 0.07, 0, 0.3],
  glass: ['highpass', 3200, 1, 0.05, 2400, 0.4],
  cloth: ['lowpass', 420, 0.7, 0.09, 0, 0.5],
};

const MUTE_KEY = 'flatcraft.muted';

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.last = new Map();     // sound name -> time last played, for throttling
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  /** Create the audio graph. Must run inside a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      // One second of white noise, reused by every sound.
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch { /* storage blocked: the toggle still works for this session */ }
    return this.muted;
  }

  get ready() {
    return this.ctx && !this.muted && this.ctx.state === 'running';
  }

  /** False if `name` played less than `gap` seconds ago. */
  throttle(name, gap) {
    const now = this.ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < gap) return false;
    this.last.set(name, now);
    return true;
  }

  /** A filtered noise burst with a fast attack and exponential tail. */
  burst({ type, freq, q = 1, length, gain, sweepTo = null, delay = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    // Start somewhere random in the buffer so repeats don't sound identical.
    const offset = Math.random() * 0.8;

    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + length);
    filter.Q.value = q;

    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);

    src.connect(filter).connect(env).connect(this.master);
    src.start(t, offset, length + 0.02);
  }

  /** A short pitched blip, dropping in pitch as it decays. */
  tone({ freq, length, gain, wave = 'triangle', drop = 0.6, delay = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * drop, t + length);

    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);

    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  /** The arm cutting air. Weapons and tools whoosh harder than a fist. */
  swing(heavy = false) {
    if (!this.ready || !this.throttle('swing', 0.08)) return;
    const j = 0.9 + Math.random() * 0.2;
    this.burst({
      type: 'bandpass', freq: 500 * j, sweepTo: (heavy ? 2200 : 1400) * j, q: 1.6,
      length: heavy ? 0.16 : 0.12, gain: heavy ? 0.22 : 0.12,
    });
  }

  /** One strike landing on a block while it's being dug. */
  hit(material) {
    if (!this.ready || !this.throttle('hit', 0.05)) return;
    const [type, freq, q, length, tone, gain] = MATERIAL[material] ?? MATERIAL.stone;
    const j = 0.88 + Math.random() * 0.24;       // no two strikes quite alike
    this.burst({ type, freq: freq * j, q, length, gain });
    if (tone) this.tone({ freq: tone * j, length: length * 0.8, gain: gain * 0.5 });
  }

  /** The block giving way: a longer, lower, louder version of its hit. */
  break(material) {
    // Creative breaks a block a frame while you sweep, so cap the rate.
    if (!this.ready || !this.throttle('break', 0.045)) return;
    const [type, freq, q, length, tone, gain] = MATERIAL[material] ?? MATERIAL.stone;
    const j = 0.9 + Math.random() * 0.2;
    this.burst({ type, freq: freq * 0.7 * j, q: q * 0.7, length: length * 2.6, gain: gain * 1.3 });
    this.burst({ type: 'lowpass', freq: 300, length: 0.12, gain: 0.35 });
    if (material === 'glass') {
      // Shatter: a scatter of tiny high pings.
      for (let i = 0; i < 5; i++) {
        this.tone({
          freq: 2600 + Math.random() * 2400, length: 0.06, gain: 0.12,
          wave: 'sine', drop: 0.9, delay: i * 0.018 + Math.random() * 0.01,
        });
      }
    } else if (tone) {
      this.tone({ freq: tone * 0.8 * j, length: length * 1.6, gain: gain * 0.6 });
    }
  }

  /** Something alive taking a hit. */
  mobHit() {
    if (!this.ready || !this.throttle('mob', 0.06)) return;
    this.burst({ type: 'lowpass', freq: 900, length: 0.09, gain: 0.55 });
    this.tone({ freq: 150, length: 0.12, gain: 0.5, wave: 'sine', drop: 0.5 });
  }
}

export const sfx = new Sfx();
