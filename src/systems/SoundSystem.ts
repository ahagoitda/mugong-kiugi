/**
 * SoundSystem - Web Audio API 기반 프로시저럴 사운드 시스템
 *
 * 왜 Web Audio API인가?
 * - 별도 오디오 파일 없이 수학적으로 사운드를 생성합니다.
 * - 크레딧(AI 생성) 없이 타격감 있는 SFX를 구현할 수 있습니다.
 * - 파일 크기 0바이트로 번들 크기에 영향을 주지 않습니다.
 * - 모바일 브라우저의 오디오 정책(사용자 인터랙션 후 재생)을 준수합니다.
 *
 * 사운드 생성 원리:
 * - OscillatorNode: 주파수(Hz)로 음높이를 결정합니다.
 * - GainNode: 볼륨 엔벨로프(ADSR)를 적용합니다.
 * - BiquadFilterNode: 고역/저역 필터로 음색을 조절합니다.
 *
 * 메모리 안전성:
 * - 각 사운드는 재생 후 자동으로 disconnect()됩니다.
 * - AudioContext는 싱글톤으로 관리하여 중복 생성을 방지합니다.
 */

type SoundId =
  | 'hit_light'    // 가벼운 타격
  | 'hit_heavy'    // 강한 타격
  | 'hit_boss'     // 보스 타격
  | 'player_hurt'  // 플레이어 피격
  | 'dash'         // 회피
  | 'enemy_die'    // 적 사망
  | 'boss_die'     // 보스 사망
  | 'level_up'     // 웨이브 클리어
  | 'synth_ok'     // 합성 성공
  | 'equip'        // 무공 장착
  | 'game_over'    // 게임 오버
  | 'revive'       // 부활
  | 'skill_cast'    // 무공 시전
  | 'boss_appear'; // 보스 등장

class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;
  private lastPlayed: Map<SoundId, number> = new Map();

  /** AudioContext를 지연 초기화합니다 (브라우저 정책: 사용자 인터랙션 후) */
  private getCtx(): AudioContext | null {
    if (this._muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    // suspended 상태면 resume 시도
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  get muted(): boolean { return this._muted; }

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : 0.4;
    }
  }

  setVolume(v: number): void {
    this._muted = v <= 0;
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, v)) * 0.4;
    }
  }
  get volume(): number {
    return this._muted ? 0 : (this.masterGain?.gain.value ?? 0.4) / 0.4;
  }

  play(id: SoundId): void {
    const now = Date.now();
    const last = this.lastPlayed.get(id) ?? 0;
    // 잦은 타격음 귀 테러 방지용 50ms 스로틀링
    if (id.startsWith('hit_') || id === 'player_hurt' || id === 'skill_cast') {
      if (now - last < 50) return;
    }
    this.lastPlayed.set(id, now);

    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;

    switch (id) {
      case 'hit_light':    this.playHit(ctx, 440, 0.08, 'sawtooth'); break;
      case 'hit_heavy':    this.playHit(ctx, 220, 0.15, 'square');   break;
      case 'hit_boss':     this.playHit(ctx, 110, 0.2,  'square');   break;
      case 'player_hurt':  this.playHurt(ctx);                        break;
      case 'dash':         this.playDash(ctx);                        break;
      case 'enemy_die':    this.playDie(ctx, 300, 0.12);              break;
      case 'boss_die':     this.playBossDie(ctx);                     break;
      case 'level_up':     this.playLevelUp(ctx);                     break;
      case 'synth_ok':     this.playSynthOk(ctx);                     break;
      case 'equip':        this.playEquip(ctx);                       break;
      case 'game_over':    this.playGameOver(ctx);                    break;
      case 'revive':       this.playRevive(ctx);                      break;
      case 'boss_appear':  this.playBossAppear(ctx);                  break;
      case 'skill_cast':   this.playSkillCast(ctx);                   break;
    }
  }

  // ─── 사운드 생성 헬퍼 ───

  /**
   * 짧은 타격음 생성
   * @param freq - 기본 주파수 (낮을수록 묵직한 소리)
   * @param duration - 지속 시간 (초)
   * @param type - 파형 (sawtooth=날카로움, square=묵직함)
   */
  private playHit(ctx: AudioContext, freq: number, duration: number, type: OscillatorType): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + duration);

    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  private playHurt(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playDash(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playSkillCast(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.09);
    osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.18);

    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  private playDie(ctx: AudioContext, freq: number, duration: number): void {
    // 노이즈 + 피치 다운으로 사망 효과
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playBossDie(ctx: AudioContext): void {
    // 3단 폭발음
    [0, 0.1, 0.25].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = 200 - i * 50;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + delay + 0.3);

      gain.gain.setValueAtTime(0.5, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.3);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }

  private playLevelUp(ctx: AudioContext): void {
    // 상승 아르페지오: C-E-G-C'
    const notes = [261, 329, 392, 523];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.1;

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.2);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }

  private playSynthOk(ctx: AudioContext): void {
    // 합성 성공: 밝은 2음
    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.12;

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.18);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }

  private playEquip(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playGameOver(ctx: AudioContext): void {
    // 하강 3음 + 낮은 드럼
    [400, 300, 200].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.25;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.2);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.25);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }

  private playRevive(ctx: AudioContext): void {
    // 부활: 상승 글리산도
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playBossAppear(ctx: AudioContext): void {
    // 보스 등장: 낮고 위협적인 3음
    [80, 100, 60].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.15;

      osc.type = 'square';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.4);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }
}

/** 싱글톤 인스턴스 */
export const soundSystem = new SoundSystem();
