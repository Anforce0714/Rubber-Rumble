// Synthesized sound effects (Web Audio API). No audio files, works on GitHub Pages.
// Browsers only allow audio after a user gesture, so the context is created lazily
// by unlockAudio() on the first tap/click.

let ctx = null;
let master = null;
let enabled = true;
let noiseBuffer = null;
let charge = null;      // { osc, gain } while the charge tone plays

export function setSoundEnabled(on) {
  enabled = !!on;
  if (!enabled) stopCharge();
}

export function unlockAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      return;
    }
  }
  if (ctx.state === "suspended") ctx.resume();
}

function ready() {
  return enabled && ctx && master;
}

function tone(freq, duration, { type = "sine", vol = 0.3, slideTo = null, delay = 0 } = {}) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function noise(duration, { vol = 0.3, filter = "lowpass", from = 1200, to = null, delay = 0 } = {}) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;

  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  const src = ctx.createBufferSource();
  const biquad = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  src.buffer = noiseBuffer;
  biquad.type = filter;
  biquad.frequency.setValueAtTime(from, t);
  if (to) biquad.frequency.exponentialRampToValueAtTime(to, t + duration);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  src.connect(biquad);
  biquad.connect(gain);
  gain.connect(master);
  src.start(t);
  src.stop(t + duration + 0.05);
}

// ----- charge tone: pitch rises with power while the button is held -----

export function startCharge() {
  if (!ready() || charge) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 180;
  gain.gain.value = 0.12;
  osc.connect(gain);
  gain.connect(master);
  osc.start();
  charge = { osc, gain };
}

export function updateCharge(power) {
  if (!charge) return;
  charge.osc.frequency.setValueAtTime(180 + power * 5.5, ctx.currentTime);
}

export function stopCharge() {
  if (!charge) return;
  try { charge.osc.stop(); } catch (e) { /* already stopped */ }
  charge = null;
}

// ----- one-shot effects -----

export const sfx = {
  click() { tone(660, 0.07, { type: "square", vol: 0.1 }); },

  launch(strength = 50) {
    noise(0.35, { vol: 0.25 + strength / 400, filter: "bandpass", from: 400, to: 2400 });
    tone(320, 0.25, { type: "triangle", vol: 0.18, slideTo: 110 });
  },

  land() {
    tone(130, 0.2, { vol: 0.5, slideTo: 45 });
    noise(0.12, { vol: 0.25, filter: "lowpass", from: 900 });
  },

  miss() { tone(230, 0.22, { type: "triangle", vol: 0.16, slideTo: 140, delay: 0.12 }); },

  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: "triangle", vol: 0.28, delay: i * 0.11 }));
    tone(1047, 0.6, { type: "sine", vol: 0.22, delay: 0.5 });
  },

  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: "sawtooth", vol: 0.14, delay: i * 0.15 }));
  },

  coin() {
    tone(988, 0.08, { type: "square", vol: 0.12 });
    tone(1319, 0.2, { type: "square", vol: 0.12, delay: 0.08 });
  },

  error() { tone(150, 0.2, { type: "sawtooth", vol: 0.18, slideTo: 100 }); }
};