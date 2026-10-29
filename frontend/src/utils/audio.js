/**
 * Web Audio API synthesizer for Finding Nemo Quiz Adventure.
 * Generates custom underwater sound effects dynamically with zero external audio assets.
 */

class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('nemo_sound_muted') === 'true';
    this.listenerAttached = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('nemo_sound_muted', String(this.muted));
    return this.muted;
  }

  setMuted(val) {
    this.muted = Boolean(val);
    localStorage.setItem('nemo_sound_muted', String(this.muted));
  }

  /** Subtle, classy water droplet / bubble pop for clicks with organic pitch variance */
  playClick(pitchMod = 1) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      // Organic randomized pitch variance around 450-620Hz
      const randomShift = (Math.random() - 0.5) * 60;
      const baseFreq = (520 + randomShift) * pitchMod;
      const endFreq = baseFreq * 1.8;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.06);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      /* AudioContext might require user gesture first */
    }
  }

  /** Alias for playClick */
  playBubble() {
    this.playClick(1.0);
  }

  /** Soft deep water pop for toggle / secondary actions */
  playDeepPop() {
    this.playClick(0.75);
  }

  /** Joyful crystal chime for correct answers */
  playCorrect() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.24, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch { /* ignore */ }
  }

  /** Low ocean thud / wobble for wrong answers */
  playWrong() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.3);

      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch { /* ignore */ }
  }

  /** Ocean splash / whoosh when launching a quiz */
  playSplash() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      // Filtered noise for water splash
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.35);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.35);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch { /* ignore */ }
  }

  /** Grand victory coral reef fanfare */
  playVictory() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const chord = [392.00, 523.25, 659.25, 783.99, 1046.50];
      const now = this.ctx.currentTime;

      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.09;

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.28, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });
    } catch { /* ignore */ }
  }

  /**
   * Attaches a global listener that automatically triggers an aquatic click
   * sound whenever any clickable / interactive element is clicked anywhere in the app.
   */
  attachGlobalClickListener() {
    if (typeof window === 'undefined' || this.listenerAttached) return;
    this.listenerAttached = true;

    const interactiveSelector = [
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="tab"]',
      '.opt-btn',
      '.option-btn',
      '.cat-card',
      '.cat-opt-btn',
      '.count-opt-btn',
      '.hub-tab',
      '.lb-tab',
      '.team-choice-btn',
      '.player-card',
      '.btn-return',
      '.btn-replay',
      '.back-btn',
      '.sound-toggle-btn',
      '.room-code-badge',
      '[tabindex="0"]',
    ].join(',');

    window.addEventListener(
      'click',
      (e) => {
        const target = e.target;
        if (!target) return;
        const clickable = target.closest(interactiveSelector);
        if (clickable) {
          this.playClick();
        }
      },
      { capture: true, passive: true }
    );
  }
}

export const sounds = new SoundController();
