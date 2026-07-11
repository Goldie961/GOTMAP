export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = true; // Off by default (Faza 5.3 spec constraint)
  }

  init() {
    // Lazy initialize AudioContext on user interaction
    const initCtx = () => {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    };
    window.addEventListener('click', initCtx, { once: true });
    window.addEventListener('keydown', initCtx, { once: true });
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (!muted && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /* ─────────────────────────────────────────────
     Audio synthesizers using HTML5 Web Audio API
     ───────────────────────────────────────────── */

  // Click on location -> short paper rustle sound
  playPaper() {
    if (this.isMuted) return;
    this._ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Bandpass filter to isolate paper rustle frequencies
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    filter.Q.setValueAtTime(3, this.ctx.currentTime);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // Sidebar open -> short wood sound
  playWood() {
    if (this.isMuted) return;
    this._ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Double oscillator for a hollow wooden knock tone
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(75, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Timeline year click -> metallic ring sound
  playTimeline() {
    if (this.isMuted) return;
    this._ensureContext();
    if (!this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(950, this.ctx.currentTime);
    
    // Ring modulator-like harmonic
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1450, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.26);
    osc2.stop(this.ctx.currentTime + 0.26);
  }

  // Timeline slide/tick -> short metallic click
  playTick() {
    if (this.isMuted) return;
    this._ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.02);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
}
