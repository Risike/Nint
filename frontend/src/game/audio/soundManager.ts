export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxVolume: number = 0.7;
  private musicVolume: number = 0.5;
  private isMuted: boolean = false;
  private bgmAudio: HTMLAudioElement | null = null;

  constructor() {
    // AudioContext and BGM will be initialized upon first user interaction
  }

  private initBgm() {
    if (!this.bgmAudio && typeof Audio !== 'undefined') {
      try {
        this.bgmAudio = new Audio('/audio/bgm.mp3');
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = this.isMuted ? 0 : this.musicVolume;
      } catch (e) {
        console.warn('Failed to initialize BGM audio element:', e);
      }
    }
  }

  public startBgm() {
    this.initBgm();
    if (!this.bgmAudio) return;
    this.bgmAudio.volume = this.isMuted ? 0 : this.musicVolume;
    this.bgmAudio.currentTime = 0;
    const playPromise = this.bgmAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('BGM autoplay prevented or interrupted:', err);
      });
    }
  }

  public pauseBgm() {
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.pause();
    }
  }

  public resumeBgm() {
    if (this.bgmAudio && this.bgmAudio.paused) {
      this.bgmAudio.volume = this.isMuted ? 0 : this.musicVolume;
      const playPromise = this.bgmAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('BGM resume prevented:', err);
        });
      }
    }
  }

  public stopBgm() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    }
  }

  public setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.isMuted ? 0 : this.musicVolume;
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.sfxVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.sfxVolume, this.ctx.currentTime);
    }
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.isMuted ? 0 : this.musicVolume;
    }
  }

  public playCountdown(_num: number) {
    this.playTone(440, 'triangle', 0.1, 0.3);
  }

  public playCountdownGo() {
    this.playTone(880, 'triangle', 0.25, 0.4);
  }

  public playMove() {
    this.playTone(260, 'sine', 0.03, 0.15);
  }

  public playRotate() {
    this.playTone(440, 'triangle', 0.05, 0.25);
  }

  public playSoftDrop() {
    this.playTone(180, 'sine', 0.02, 0.1);
  }

  public playHardDrop() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playLock() {
    this.playTone(320, 'square', 0.06, 0.2);
  }

  public playClear(lines: number) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const frequencies = lines === 4 
      ? [523.25, 659.25, 783.99, 1046.50] // C-E-G-C high (Tetris chime)
      : lines === 3
      ? [440, 554.37, 659.25] // A-C#-E
      : lines === 2
      ? [392, 523.25] // G-C
      : [440]; // Single

    const now = this.ctx.currentTime;
    frequencies.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.06;

      osc.type = lines === 4 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playTSpin() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.2);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  public playCombo(combo: number) {
    // Ascending pentatonic scale
    const baseFreq = 300;
    const freq = baseFreq * Math.pow(1.08, Math.min(combo, 15));
    this.playTone(freq, 'sine', 0.1, 0.3);
  }

  public playGarbageWarning() {
    this.playTone(150, 'sawtooth', 0.15, 0.4);
  }

  public playGarbageSent() {
    this.playTone(600, 'triangle', 0.1, 0.35);
  }

  public playBossAttack(attack: string) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const profiles: Record<string, {
      start: number;
      end: number;
      type: OscillatorType;
      duration: number;
      volume: number;
    }> = {
      rotation: { start: 300, end: 90, type: 'sawtooth', duration: 0.28, volume: 0.3 },
      invert: { start: 340, end: 150, type: 'triangle', duration: 0.3, volume: 0.28 },
      garbage: { start: 120, end: 42, type: 'square', duration: 0.34, volume: 0.32 },
      blind: { start: 250, end: 70, type: 'sine', duration: 0.38, volume: 0.3 },
      speed: { start: 160, end: 760, type: 'sawtooth', duration: 0.26, volume: 0.26 },
      ghostless: { start: 700, end: 240, type: 'triangle', duration: 0.22, volume: 0.22 }
    };
    const profile = profiles[attack] ?? profiles.garbage;
    const now = this.ctx.currentTime;

    const sweep = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();
    sweep.type = profile.type;
    sweep.frequency.setValueAtTime(profile.start, now);
    sweep.frequency.exponentialRampToValueAtTime(profile.end, now + profile.duration);
    sweepGain.gain.setValueAtTime(profile.volume, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration);
    sweep.connect(sweepGain);
    sweepGain.connect(this.masterGain);
    sweep.start(now);
    sweep.stop(now + profile.duration + 0.02);

    // Low thud under the sweep so every boss action feels like an impact.
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(92, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.18);
    thudGain.gain.setValueAtTime(0.38, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.21);
  }

  public playBossDamage(linesCleared: number) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const hitStrength = Math.min(4, Math.max(1, linesCleared));
    const now = this.ctx.currentTime;

    // Punchy descending hit.
    const hit = this.ctx.createOscillator();
    const hitGain = this.ctx.createGain();
    hit.type = hitStrength === 4 ? 'sawtooth' : 'square';
    hit.frequency.setValueAtTime(190 + hitStrength * 45, now);
    hit.frequency.exponentialRampToValueAtTime(55, now + 0.16);
    hitGain.gain.setValueAtTime(0.22 + hitStrength * 0.035, now);
    hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    hit.connect(hitGain);
    hitGain.connect(this.masterGain);
    hit.start(now);
    hit.stop(now + 0.19);

    // Bright crack on top, higher for stronger clears.
    const crack = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crack.type = 'triangle';
    crack.frequency.setValueAtTime(900 + hitStrength * 120, now);
    crack.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    crackGain.gain.setValueAtTime(0.16 + hitStrength * 0.025, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    crack.connect(crackGain);
    crackGain.connect(this.masterGain);
    crack.start(now);
    crack.stop(now + 0.13);
  }

  public playBossCounter() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    [523.25, 783.99, 1046.5].forEach((frequency, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = now + index * 0.055;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.21);
    });
  }

  public playGameOver() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const notes = [300, 260, 220, 180];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.15;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  private playTone(frequency: number, type: OscillatorType, duration: number, volume: number) {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }
}

export const soundManager = new SoundManager();
