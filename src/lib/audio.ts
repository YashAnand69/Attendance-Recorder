// Web Audio API harmonic sound synthesizer for Attendance Kiosk feedback

class AudioFeedbackService {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Lazy initialized on first user interaction
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  // Pleasant success chime: E5 (659.25Hz) -> G#5 (830.61Hz) -> B5 (987.77Hz)
  public playSuccessChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [659.25, 830.61, 987.77];

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.15, now + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.3);
      });
    } catch (e) {
      console.warn("Audio chime playback suppressed:", e);
    }
  }

  // Warning / Mismatch tone: C4 (261.63Hz) -> G3 (196.00Hz)
  public playWarningTone() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [261.63, 196.0];

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + index * 0.12);

        gain.gain.setValueAtTime(0, now + index * 0.12);
        gain.gain.linearRampToValueAtTime(0.12, now + index * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.12);
        osc.stop(now + index * 0.12 + 0.25);
      });
    } catch (e) {
      console.warn("Audio warning playback suppressed:", e);
    }
  }
}

export const audioFeedback = new AudioFeedbackService();
