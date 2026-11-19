// Synthesised sound for Solmar Bay: no audio files, everything is WebAudio
// oscillators and noise, so the game loads nothing over the network.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicStep = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.15, slideTo = null) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, vol = 0.2, low = 400) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  // A laid-back bassline + pluck melody loop, in the spirit of a coastal drive.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  const PLUCK = [220, 0, 261.63, 329.63, 0, 261.63, 0, 196, 220, 0, 246.94, 293.66, 0, 329.63, 0, 0];

  function startMusic() {
    if (musicTimer || muted) return;
    const c = ensure(); if (!c) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const b = BASS[musicStep % BASS.length];
      const p = PLUCK[musicStep % PLUCK.length];
      if (b) tone(b, 0.22, 'triangle', 0.10);
      if (p) tone(p, 0.16, 'square', 0.035);
      musicStep += 1;
    }, 170);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  return {
    unlock() { ensure(); startMusic(); },
    toggleMute() {
      muted = !muted;
      if (muted) { stopMusic(); this.stopEngine(); this.stopSiren(); } else startMusic();
      return muted;
    },
    isMuted() { return muted; },
    punch() { noise(0.12, 0.25, 900); tone(120, 0.1, 'square', 0.12, 60); },
    coin() { tone(880, 0.12, 'sine', 0.12); setTimeout(() => tone(1318, 0.18, 'sine', 0.12), 90); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.14), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.08), i * 130)); },
    crash() { noise(0.3, 0.3, 500); },
    door() { tone(180, 0.08, 'square', 0.08, 120); },
    pickup() { tone(660, 0.1, 'sine', 0.12, 990); },
    busted() { [440, 415, 392].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.1), i * 160)); },
    setEngine(speed01) {
      if (muted) return;
      const c = ensure(); if (!c) return;
      if (!engineOsc) {
        engineOsc = c.createOscillator(); engineOsc.type = 'sawtooth';
        engineGain = c.createGain(); engineGain.gain.value = 0;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        engineOsc.connect(f).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, c.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.03 + speed01 * 0.04 : 0, c.currentTime, 0.1);
    },
    stopEngine() {
      if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    setSiren(on) {
      if (muted || !on) { this.stopSiren(); return; }
      const c = ensure(); if (!c) return;
      if (!sirenOsc) {
        sirenOsc = c.createOscillator(); sirenOsc.type = 'sine';
        sirenGain = c.createGain(); sirenGain.gain.value = 0.035;
        const lfo = c.createOscillator(); lfo.frequency.value = 0.8;
        const lfoGain = c.createGain(); lfoGain.gain.value = 260;
        lfo.connect(lfoGain).connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 850;
        sirenOsc.connect(sirenGain).connect(c.destination);
        sirenOsc.start(); lfo.start();
        this._sirenLfo = lfo;
      }
    },
    stopSiren() {
      if (sirenOsc) {
        try { sirenOsc.stop(); this._sirenLfo?.stop(); } catch { /* already stopped */ }
        sirenOsc = null; sirenGain = null;
      }
    },
  };
}
