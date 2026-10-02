import { GameEvent } from './constants.js';

// Frequency sweeps and short chords are original synthesized sounds; no asset downloads.
const SOUNDS = Object.freeze({
  [GameEvent.PLAYER_FIRED]: [740, 220, 0.07, 'triangle'],
  [GameEvent.ENEMY_DAMAGED]: [260, 120, 0.09, 'square'],
  [GameEvent.ENEMY_DESTROYED]: [150, 35, 0.22, 'sawtooth'],
  [GameEvent.PLAYER_CONTACTED]: [150, 35, 0.22, 'sawtooth'],
  [GameEvent.PLAYER_DAMAGED]: [100, 30, 0.3, 'sawtooth'],
  [GameEvent.ENEMY_DIVE_TELEGRAPHED]: [360, 720, 0.2, 'sine'],
  [GameEvent.POWERUP_COLLECTED]: [520, 1040, 0.24, 'sine'],
  [GameEvent.WAVE_CLEARED]: [523, 1046, 0.5, 'triangle'],
  [GameEvent.GAME_OVER]: [330, 65, 0.65, 'triangle'],
});

/** Browser-owned audio: construction is silent; unlock must come from a user gesture. */
export class GameAudio {
  constructor(createContext = () => {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    return AudioContext ? new AudioContext() : null;
  }) {
    this.createContext = createContext;
    this.context = null;
    this.master = null;
    this.muted = false;
    this.voices = new Set();
  }

  unlock() {
    try {
      if (!this.context) {
        this.context = this.createContext();
        if (!this.context) return;
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.16;
        this.master.connect(this.context.destination);
      }

      // Resume rejection is harmless when a browser denies audio output.
      this.context.resume()?.catch(() => {});
    } catch {
      this.context = null;
      this.master = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.16;
    if (muted) this.stop();
  }

  stop() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  handleEvent(event) {
    if (event.type === GameEvent.GAME_STARTED || event.type === GameEvent.GAME_PAUSED) {
      this.stop();
    }

    const sound = SOUNDS[event.type];
    if (!sound || !this.context || this.context.state !== 'running' || this.muted) return;
    if (this.voices.size >= 12) return;

    const [frequency, endFrequency, duration, waveform] = sound;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();

    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.exponentialRampToValueAtTime(0.5, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
