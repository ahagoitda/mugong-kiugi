/**
 * BgmSystem - Web Audio API 기반 프로시저럴 BGM 시스템
 *
 * 파일 크기 0바이트로 무협 분위기의 배경음악을 생성합니다.
 *
 * 설계 원칙:
 * - 동양적 5음 음계(궁상각치우)를 사용하여 무협 분위기 연출
 * - 일반 전투 / 보스 전투 / 평화 상태 3가지 BGM 모드
 * - 부드러운 크로스페이드로 모드 전환
 * - SoundSystem과 독립적으로 동작 (BGM은 루프, SFX는 원샷)
 *
 * 메모리 안전성:
 * - 각 BGM 모드는 단일 AudioContext를 공유
 * - stop() 호출 시 모든 노드를 정리하여 메모리 누수 방지
 */

type BgmMode = 'battle' | 'boss' | 'peace';

class BgmSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentMode: BgmMode | null = null;
  private loopTimer: number | null = null;
  private _muted = false;
  private _volume = 0.15;

  /** 동양 5음 음계 (궁상각치우) - C 기준 */
  private readonly pentatonic = [261.6, 293.7, 329.6, 392.0, 440.0];

  /** 보스전 음계 (어둡고 위협적인 단조 느낌) */
  private readonly bossPentatonic = [130.8, 146.8, 164.8, 196.0, 220.0];

  private getCtx(): AudioContext | null {
    if (this._muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._volume;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  get muted(): boolean { return this._muted; }

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
    }
    if (this._muted) {
      this.stop();
    }
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v)) * 0.15;
    this._muted = v <= 0;
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
    }
  }
  get volume(): number { return this._muted ? 0 : this._volume / 0.15; }

  /**
   * BGM 모드를 전환합니다.
   * 같은 모드면 무시, 다른 모드면 크로스페이드합니다.
   */
  play(mode: BgmMode): void {
    if (this.currentMode === mode) return;
    this.stop();
    this.currentMode = mode;
    this.startLoop(mode);
  }

  stop(): void {
    if (this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.currentMode = null;
  }

  private startLoop(mode: BgmMode): void {
    const ctx = this.getCtx();
    if (!ctx) return;

    // 즉시 첫 패턴 재생
    this.playPattern(ctx, mode);

    // 패턴 반복 간격 (ms)
    const interval = mode === 'boss' ? 3200 : 4000;
    this.loopTimer = window.setInterval(() => {
      const c = this.getCtx();
      if (c && this.currentMode === mode) {
        this.playPattern(c, mode);
      }
    }, interval);
  }

  /**
   * 모드별 BGM 패턴을 생성합니다.
   *
   * battle: 5음 음계의 랜덤 멜로디 + 저음 드론
   * boss: 어두운 단조 + 빠른 리듬 + 긴장감 있는 드론
   * peace: 느린 아르페지오 + 부드러운 패드
   */
  private playPattern(ctx: AudioContext, mode: BgmMode): void {
    switch (mode) {
      case 'battle':
        this.playBattleBgm(ctx);
        break;
      case 'boss':
        this.playBossBgm(ctx);
        break;
      case 'peace':
        this.playPeaceBgm(ctx);
        break;
    }
  }

  private playBattleBgm(ctx: AudioContext): void {
    // 저음 드론 (지속음)
    this.playDrone(ctx, 130.8, 3.5, 'sine', 0.06);

    // 5음 음계 멜로디 (8음)
    const scale = this.pentatonic;
    for (let i = 0; i < 8; i++) {
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const octave = Math.random() > 0.3 ? 1 : 2;
      this.playNote(ctx, freq * octave, i * 0.45, 0.35, 'triangle', 0.08);
    }

    // 리듬 퍼커션 (가벼운 틱)
    for (let i = 0; i < 4; i++) {
      this.playPercussion(ctx, i * 0.9, 200 + Math.random() * 100);
    }
  }

  private playBossBgm(ctx: AudioContext): void {
    // 위협적인 저음 드론
    this.playDrone(ctx, 65.4, 3.0, 'sawtooth', 0.04);
    this.playDrone(ctx, 98.0, 3.0, 'square', 0.02);

    // 어두운 멜로디 (빠른 템포)
    const scale = this.bossPentatonic;
    for (let i = 0; i < 12; i++) {
      const freq = scale[Math.floor(Math.random() * scale.length)];
      this.playNote(ctx, freq, i * 0.25, 0.2, 'sawtooth', 0.06);
    }

    // 강한 퍼커션
    for (let i = 0; i < 6; i++) {
      this.playPercussion(ctx, i * 0.5, 100 + Math.random() * 60);
    }
  }

  private playPeaceBgm(ctx: AudioContext): void {
    // 부드러운 패드
    this.playDrone(ctx, 261.6, 3.5, 'sine', 0.04);

    // 느린 아르페지오
    const scale = this.pentatonic;
    const pattern = [0, 2, 4, 2, 0, 3, 4, 3];
    for (let i = 0; i < pattern.length; i++) {
      const freq = scale[pattern[i]];
      this.playNote(ctx, freq, i * 0.5, 0.45, 'sine', 0.06);
    }
  }

  // ─── 사운드 생성 헬퍼 ───

  private playNote(
    ctx: AudioContext,
    freq: number,
    delay: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 1500;

    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.setValueAtTime(volume, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  private playDrone(
    ctx: AudioContext,
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.5);
    gain.gain.setValueAtTime(volume, t + duration - 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  private playPercussion(ctx: AudioContext, delay: number, freq: number): void {
    if (!this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    const t = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.08);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}

/** 싱글톤 인스턴스 */
export const bgmSystem = new BgmSystem();
