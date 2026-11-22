/**
 * Professional Web Audio Procedural Sound Engine for Downhill Rush.
 * Features:
 * - Master DynamicsCompressor to eliminate clipping and maximize punch
 * - Realistic freewheel hub clicking when coasting
 * - Pedal drivetrain chain hum
 * - Aerodynamic speed wind noise filter
 * - Dynamic tire drift and suspension landing impacts
 * - Arcade trick and finish fanfares
 */
export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterCompressor = null;
    this.masterGain = null;
    this.initialized = false;

    // Continuous sound nodes
    this.windNode = null;
    this.windGain = null;
    this.windFilter = null;
    this.chainOsc = null;
    this.chainGain = null;
    this.hubOsc = null;
    this.hubGain = null;

    this.isMuted = false;
  }

  init() {
    if (this.initialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.initialized = true;

    // Master Compressor & Gain
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this.masterCompressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.masterCompressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this._setupWind();
    this._setupChainAndHub();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _setupWind() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterCompressor);
    whiteNoise.start();
  }

  _setupChainAndHub() {
    if (!this.ctx) return;

    // Chain pedaling sound
    this.chainOsc = this.ctx.createOscillator();
    this.chainOsc.type = 'triangle';
    this.chainOsc.frequency.setValueAtTime(70, this.ctx.currentTime);
    this.chainGain = this.ctx.createGain();
    this.chainGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.chainOsc.connect(this.chainGain);
    this.chainGain.connect(this.masterCompressor);
    this.chainOsc.start();

    // Freewheel rapid hub ratchet clicking when coasting
    this.hubOsc = this.ctx.createOscillator();
    this.hubOsc.type = 'square';
    this.hubOsc.frequency.setValueAtTime(90, this.ctx.currentTime);
    this.hubGain = this.ctx.createGain();
    this.hubGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.hubOsc.connect(this.hubGain);
    this.hubGain.connect(this.masterCompressor);
    this.hubOsc.start();
  }

  updateContinuous(speedRatio, isGrounded, isPedaling) {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Wind rush volume and frequency
    const targetWindGain = Math.min(0.42, Math.pow(speedRatio, 1.6) * 0.38);
    const targetCutoff = 240 + speedRatio * 2400;
    this.windGain.gain.setTargetAtTime(targetWindGain, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);

    // Drivetrain & Hub sounds
    if (isGrounded && speedRatio > 0.05) {
      if (isPedaling) {
        // Pedaling active
        const chainVol = Math.min(0.12, speedRatio * 0.1);
        this.chainGain.gain.setTargetAtTime(chainVol, now, 0.05);
        this.chainOsc.frequency.setTargetAtTime(50 + speedRatio * 200, now, 0.05);
        this.hubGain.gain.setTargetAtTime(0, now, 0.05);
      } else {
        // Coasting: Rapid freewheel hub clicking
        const hubVol = Math.min(0.06, speedRatio * 0.07);
        this.hubGain.gain.setTargetAtTime(hubVol, now, 0.05);
        this.hubOsc.frequency.setTargetAtTime(80 + speedRatio * 320, now, 0.05);
        this.chainGain.gain.setTargetAtTime(0, now, 0.05);
      }
    } else {
      this.chainGain.gain.setTargetAtTime(0, now, 0.08);
      this.hubGain.gain.setTargetAtTime(0, now, 0.08);
    }
  }

  playJump() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.22);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterCompressor);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playLand(intensity = 0.5) {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.2);

    const vol = Math.min(0.48, 0.18 + intensity * 0.3);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterCompressor);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  playSkid() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.16);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterCompressor);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  playBoost() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(240, now);
    osc1.frequency.exponentialRampToValueAtTime(850, now + 0.45);

    osc2.frequency.setValueAtTime(480, now);
    osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.45);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterCompressor);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.52);
    osc2.stop(now + 0.52);
  }

  playCoin() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterCompressor);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  playTrickBonus() {
    if (!this.initialized || this.isMuted) return;
    const notes = [659.25, 830.61, 987.77, 1318.51]; // E Major chord arpeggio
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.masterCompressor);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  playCrash() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterCompressor);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  playFinish() {
    if (!this.initialized || this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.masterCompressor);
      osc.start(now);
      osc.stop(now + 0.45);
    });
  }
}
