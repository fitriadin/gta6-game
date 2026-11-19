// Synthesized sound, no audio files anywhere: a WebAudio engine hum whose pitch
// follows the car's speed, a soft city ambience (filtered noise, like distant
// surf and traffic), and one-shot blips for the UI, the car door, a theft and a
// crash. Nothing starts before a user gesture — the start button wakes the audio
// context — and M toggles the master gain. Every call is guarded: a browser with
// no audio device must never break the game.

import { AUDIO } from './config.js';

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    engineFilter: null,
    ambientGain: null,
    sirenOsc: null,
    sirenGain: null,
    muted: false,
    started: false,
  };

  function ensureContext() {
    if (audio.context) return audio.context;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audio.context = new Ctor();
      audio.master = audio.context.createGain();
      audio.master.gain.value = audio.muted ? 0 : AUDIO.masterGain;
      audio.master.connect(audio.context.destination);
    } catch {
      audio.context = null;
    }
    return audio.context;
  }

  /** Start the audio graph. Call only from a user gesture (button click, key press). */
  function start() {
    const ctx = ensureContext();
    if (!ctx || audio.started) {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    audio.started = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      startEngine(ctx);
      startAmbient(ctx);
    } catch {
      // Sound is garnish: a failure here must not stop the game.
    }
  }

  function startEngine(ctx) {
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = AUDIO.engineBaseHz;
    audio.engineOsc2 = ctx.createOscillator();
    audio.engineOsc2.type = 'square';
    audio.engineOsc2.frequency.value = AUDIO.engineBaseHz / 2;
    audio.engineFilter = ctx.createBiquadFilter();
    audio.engineFilter.type = 'lowpass';
    audio.engineFilter.frequency.value = 420;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineFilter);
    audio.engineOsc2.connect(audio.engineFilter);
    audio.engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.engineOsc2.start();
  }

  function startAmbient(ctx) {
    // Looping filtered noise: distant surf and city hum, kept quiet.
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    audio.ambientGain = ctx.createGain();
    audio.ambientGain.gain.value = AUDIO.ambientGain;
    // A slow swell, like waves, so the loop never sounds flat.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = AUDIO.ambientGain * 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(audio.ambientGain.gain);
    source.connect(filter);
    filter.connect(audio.ambientGain);
    audio.ambientGain.connect(audio.master);
    source.start();
    lfo.start();
  }

  /** Engine note: `speed01` is 0 (idle) to 1 (flat out); `driving` silences it on foot. */
  function setEngine(speed01, driving) {
    if (!audio.context || !audio.engineGain) return;
    try {
      const now = audio.context.currentTime;
      const freq = AUDIO.engineBaseHz + speed01 * (AUDIO.engineTopHz - AUDIO.engineBaseHz);
      audio.engineOsc.frequency.setTargetAtTime(freq, now, 0.08);
      audio.engineOsc2.frequency.setTargetAtTime(freq / 2, now, 0.08);
      audio.engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, now, 0.1);
      const gain = driving ? AUDIO.engineGain * (0.5 + speed01 * 0.9) : 0;
      audio.engineGain.gain.setTargetAtTime(gain, now, 0.1);
    } catch { /* ignore */ }
  }

  function setMuted(muted) {
    audio.muted = muted;
    if (audio.master && audio.context) {
      audio.master.gain.setTargetAtTime(muted ? 0 : AUDIO.masterGain, audio.context.currentTime, 0.02);
    }
  }

  /** A short tone blip (UI clicks, pickups). */
  function blip(freq = 660, duration = 0.09, gainValue = 0.12) {
    if (!audio.context || !audio.started) return;
    try {
      const ctx = audio.context;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  }

  /** A burst of noise (door slam, crash thud): lower pitch = heavier. */
  function noiseBurst(duration, filterFreq, gainValue) {
    if (!audio.context || !audio.started) return;
    try {
      const ctx = audio.context;
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      source.start();
    } catch { /* ignore */ }
  }

  function door() {
    noiseBurst(0.14, 900, 0.25);
    blip(180, 0.07, 0.1);
  }

  /** The steal sting: two quick notes, a little mischievous. */
  function steal() {
    blip(520, 0.1, 0.14);
    setTimeout(() => blip(780, 0.14, 0.14), 90);
  }

  function crash(strength01) {
    noiseBurst(0.25, 300 + strength01 * 500, 0.2 + strength01 * 0.3);
  }

  /** A gunshot: a sharp crack of noise plus a low thump. */
  function gunshot() {
    noiseBurst(0.09, 3200, 0.32);
    blip(130, 0.07, 0.16);
  }

  /** An explosion: a long low rumble with a deep falling note under it. */
  function explosion() {
    noiseBurst(0.7, 220, 0.5);
    blip(55, 0.5, 0.3);
  }

  /** A punch: a short low thud. */
  function punch() {
    noiseBurst(0.07, 480, 0.22);
    blip(95, 0.09, 0.22);
  }

  /** The busted sting: three descending notes, the sound of a bad day. */
  function busted() {
    blip(392, 0.16, 0.16);
    setTimeout(() => blip(330, 0.16, 0.16), 150);
    setTimeout(() => blip(262, 0.28, 0.16), 300);
  }

  /**
   * The police siren: a two-tone wail whose volume follows `level` (0 = silent,
   * 1 = right on top of the player). The oscillator is built lazily on the first
   * call after start(), and idles at zero gain when no police car is near.
   */
  function setSiren(level) {
    if (!audio.context || !audio.started) return;
    try {
      const ctx = audio.context;
      if (!audio.sirenOsc) {
        audio.sirenOsc = ctx.createOscillator();
        audio.sirenOsc.type = 'triangle';
        audio.sirenOsc.frequency.value = 820;
        // A slow square wave swings the note between its two tones.
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 0.8;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 140;
        lfo.connect(lfoGain);
        lfoGain.connect(audio.sirenOsc.frequency);
        audio.sirenGain = ctx.createGain();
        audio.sirenGain.gain.value = 0;
        audio.sirenOsc.connect(audio.sirenGain);
        audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
        lfo.start();
      }
      const clamped = Math.max(0, Math.min(1, level));
      audio.sirenGain.gain.setTargetAtTime(clamped * 0.045, ctx.currentTime, 0.15);
    } catch { /* ignore */ }
  }

  return { start, setEngine, setMuted, blip, door, steal, crash, gunshot, explosion, punch, busted, setSiren };
}
