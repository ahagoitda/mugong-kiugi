import Phaser from 'phaser';
import { CHARACTER_LIST } from '../data/characters';

/**
 * BootScene - 게임 부팅 및 에셋 로딩 씬
 *
 * 모든 캐릭터(8종), 적(3종+보스), 배경(5종), 이펙트를 로드합니다.
 * 로드 완료 후 CharacterSelectScene으로 전환합니다.
 *
 * 에셋 로딩 전략:
 * - 캐릭터 스프라이트는 CHARACTER_LIST에서 동적으로 생성
 *   → 캐릭터 추가 시 데이터만 추가하면 자동 로드
 * - 128x128 프레임 (캐릭터), 160x160 프레임 (보스)
 * - 시트 레이아웃: margin=2, spacing=4 (텍스처 블리딩 방지)
 *
 * 안정성 강화:
 * - loaderror 핸들러: 개별 파일 로드 실패 시 건너뛰고 계속 진행
 * - 타임아웃 안전장치: 로딩이 멈춰도 10초 후 강제 씬 전환
 *   (모바일 WebGL에서 대용량 텍스처 처리 중 complete 이벤트 미발화 방지)
 */
export class BootScene extends Phaser.Scene {
  // 정체 감시자(벽시계 setInterval): 진행률이 일정 시간 멈추면 강제 전환.
  // Phaser 게임 루프/타이머와 무관하게 동작.
  private stallWatchdog: number | null = null;
  private lastProgressAt = 0;
  private loadStartedAt = 0;
  // 중복 전환 방지
  private transitioned = false;

  // 진행이 이만큼(ms) 멈추면 정체로 간주하고 강제 전환
  private static readonly STALL_MS = 5000;
  // 진행 여부와 무관하게 이 시간(ms)을 넘기면 강제 전환 (절대 상한)
  private static readonly MAX_LOAD_MS = 20000;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 모바일에서 동시에 너무 많은 이미지를 디코딩하면 일부 onload 이벤트가
    // 누락되어 complete 가 영영 발화되지 않는 사례가 있다. 동시 다운로드 수를
    // 제한해 이 현상을 완화한다. (기본값 32 → 4)
    this.load.maxParallelDownloads = 4;

    // 로딩 바 UI
    const { width, height } = this.scale;
    const barW = width * 0.6;
    const barH = 12;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(barX + barW / 2, barY, barW, barH, 0x333333);
    const fill = this.add.rectangle(barX + 1, barY, 0, barH - 2, 0x4fc3f7);
    fill.setOrigin(0, 0.5);

    const label = this.add.text(width / 2, barY - 24, '무공키우기', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, barY + 20, '0%', {
      fontSize: '10px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = (barW - 2) * value;
      percentText.setText(`${Math.round(value * 100)}%`);
      // 진행이 있을 때마다 시각 갱신 (정체 감시 기준)
      this.lastProgressAt = Date.now();
    });

    this.load.on('complete', () => {
      bg.destroy();
      fill.destroy();
      label.destroy();
      percentText.destroy();
      this.clearSafetyTimers();
    });

    /**
     * loaderror 핸들러: 개별 파일 로드 실패 시 경고만 출력하고 계속 진행.
     *
     * 왜 필요한가?
     * Phaser 3 기본 동작: 파일 하나가 실패하면 로더가 멈춤.
     * 모바일 환경에서 네트워크 불안정 또는 WebGL 텍스처 한계로
     * 특정 파일이 실패할 경우 complete 이벤트가 발화되지 않아 프리즈 발생.
     * 이 핸들러로 실패를 무시하면 나머지 파일을 계속 로드함.
     */
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[BootScene] 에셋 로드 실패 (무시하고 계속): ${file.key} (${file.url})`);
    });

    /**
     * 정체 감시자 (벽시계 기반 setInterval).
     *
     * 왜 고정 타임아웃이 아니라 정체 감시인가?
     * - 고정 타임아웃은 "느리지만 진행 중인" 로딩을 잘라버리거나(너무 짧으면),
     *   "이미 멈춘" 로딩을 너무 오래 기다린다(너무 길면).
     * - 정체 감시는 진행률이 STALL_MS 동안 변하지 않을 때만 전환하므로,
     *   느린 연결은 끝까지 기다리고 진짜 멈춤만 빠르게(5초) 잡는다.
     * - setInterval 은 매크로태스크 큐에서 도므로 Phaser 게임 루프가
     *   막혀도(모바일 WebGL) 메인스레드가 풀리는 즉시 동작한다.
     *
     * MAX_LOAD_MS 는 진행 여부와 무관한 절대 상한(20초).
     */
    const now0 = Date.now();
    this.loadStartedAt = now0;
    this.lastProgressAt = now0;
    this.stallWatchdog = window.setInterval(() => {
      const now = Date.now();
      const stalled = now - this.lastProgressAt > BootScene.STALL_MS;
      const overMax = now - this.loadStartedAt > BootScene.MAX_LOAD_MS;
      if (stalled || overMax) {
        console.warn(`[BootScene] 로딩 ${overMax ? '상한 초과' : '정체'} 감지 - 강제 전환`);
        this.goToSelect();
      }
    }, 1000);

    const P = 'sprites/processed';

    // ─── 8캐릭터 스프라이트 동적 로드 ───
    // margin=2, spacing=4: scripts/repack-sprites.py 가 만든 레이아웃.
    // 프레임 사이에 4px 빈틈을 두어 WebGL 텍스처 필터링으로 인한
    // 인접 프레임 픽셀 누출(texture bleeding)을 방지한다.
    const CHAR_FRAME = { frameWidth: 128, frameHeight: 128, margin: 2, spacing: 4 };
    const BOSS_FRAME = { frameWidth: 160, frameHeight: 160, margin: 2, spacing: 4 };

    for (const char of CHARACTER_LIST) {
      const prefix = char.spritePrefix;
      this.load.spritesheet(`${prefix}_idle`, `${P}/${prefix}_idle.png`, CHAR_FRAME);
      this.load.spritesheet(`${prefix}_run`, `${P}/${prefix}_run.png`, CHAR_FRAME);
      this.load.spritesheet(`${prefix}_attack`, `${P}/${prefix}_attack.png`, CHAR_FRAME);
    }

    // ─── 기존 플레이어 (하위 호환, 필요 시 제거 가능) ───
    this.load.spritesheet('player_idle', `${P}/player_idle.png`, CHAR_FRAME);
    this.load.spritesheet('player_run', `${P}/player_run.png`, CHAR_FRAME);
    this.load.spritesheet('player_attack', `${P}/player_attack.png`, CHAR_FRAME);

    // ─── 적 스프라이트시트 ───
    this.load.spritesheet('enemy_bandit', `${P}/enemy_bandit.png`, CHAR_FRAME);
    this.load.spritesheet('enemy_swordsman', `${P}/enemy_swordsman.png`, CHAR_FRAME);
    this.load.spritesheet('enemy_assassin', `${P}/enemy_assassin.png`, CHAR_FRAME);

    // ─── 적 공격 스프라이트시트 (idle 변형으로 생성) ───
    this.load.spritesheet('enemy_bandit_attack', `${P}/enemy_bandit_attack.png`, CHAR_FRAME);
    this.load.spritesheet('enemy_swordsman_attack', `${P}/enemy_swordsman_attack.png`, CHAR_FRAME);
    this.load.spritesheet('enemy_assassin_attack', `${P}/enemy_assassin_attack.png`, CHAR_FRAME);

    // ─── 보스 스프라이트시트 ───
    this.load.spritesheet('boss_beopwang', `${P}/boss_beopwang.png`, BOSS_FRAME);
    this.load.spritesheet('boss_beopwang_attack', `${P}/boss_beopwang_attack.png`, BOSS_FRAME);

    // ─── 배경 이미지 (5종, 360px 너비로 최적화됨) ───
    // 산림 (기본)
    this.load.image('bg_mountains', `${P}/bg_mountains.png`);
    this.load.image('bg_ground', `${P}/bg_ground.png`);
    // 대나무숲
    this.load.image('bg_bamboo_mountains', `${P}/bg_bamboo_mountains.png`);
    this.load.image('bg_bamboo_ground', `${P}/bg_bamboo_ground.png`);
    // 설산
    this.load.image('bg_snow_mountains', `${P}/bg_snow_mountains.png`);
    this.load.image('bg_snow_ground', `${P}/bg_snow_ground.png`);
    // 사막
    this.load.image('bg_desert_mountains', `${P}/bg_desert_mountains.png`);
    this.load.image('bg_desert_ground', `${P}/bg_desert_ground.png`);
    // 화산
    this.load.image('bg_volcano_mountains', `${P}/bg_volcano_mountains.png`);
    this.load.image('bg_volcano_ground', `${P}/bg_volcano_ground.png`);

    // ─── 이펙트 (단일 이미지) ───
    this.load.image('fx_slash_white', `${P}/fx_slash_white.png`);
    this.load.image('fx_slash_pink', `${P}/fx_slash_pink.png`);
    this.load.image('fx_slash_blue', `${P}/fx_slash_blue.png`);
    this.load.image('fx_slash_gold', `${P}/fx_slash_gold.png`);

    // ─── NPC ───
    this.load.image('npc_jeomsoyi', `${P}/npc_jeomsoyi.png`);
  }

  create(): void {
    // 정상 로딩 완료 경로
    this.goToSelect();
  }

  /** 정체 감시자 해제 */
  private clearSafetyTimers(): void {
    if (this.stallWatchdog !== null) {
      window.clearInterval(this.stallWatchdog);
      this.stallWatchdog = null;
    }
  }

  /**
   * 애니메이션을 등록하고 CharacterSelectScene 으로 전환.
   * 정상 완료(create)·타임아웃(둘 중 하나) 모두 이 메서드로 수렴하며,
   * transitioned 플래그로 단 한 번만 실행된다.
   *
   * 타임아웃 경로에서는 create() 가 호출되지 않으므로 여기서 직접
   * 애니메이션을 생성한다. (로드된 텍스처에 대해서만 — 방어적)
   */
  private goToSelect(): void {
    if (this.transitioned) return;
    this.transitioned = true;
    this.clearSafetyTimers();
    try {
      this.createAnimations();
    } catch (e) {
      console.warn('[BootScene] 애니메이션 생성 중 오류 (무시하고 진행):', e);
    }
    this.scene.start('CharacterSelectScene');
  }

  /**
   * 모든 캐릭터 + 적 + 보스 애니메이션을 등록합니다.
   *
   * 캐릭터 애니메이션은 CHARACTER_LIST에서 동적으로 생성됩니다.
   * 키 네이밍 규칙: '{spritePrefix}-{action}'
   *   예: 'sword_male-idle', 'fist_female-attack'
   */
  private createAnimations(): void {
    // ─── 8캐릭터 애니메이션 동적 등록 ───
    for (const char of CHARACTER_LIST) {
      const prefix = char.spritePrefix;
      this.makeAnim(`${prefix}-idle`, `${prefix}_idle`, 0, 3, 6, -1);
      this.makeAnim(`${prefix}-run`, `${prefix}_run`, 0, 5, 10, -1);
      this.makeAnim(`${prefix}-attack`, `${prefix}_attack`, 0, 3, 12, 0);
    }

    // ─── 기존 플레이어 애니메이션 (하위 호환) ───
    this.makeAnim('player-idle', 'player_idle', 0, 3, 6, -1);
    this.makeAnim('player-run', 'player_run', 0, 5, 10, -1);
    this.makeAnim('player-attack', 'player_attack', 0, 3, 12, 0);

    // ─── 적 애니메이션 (idle + attack) ───
    const enemies = ['bandit', 'swordsman', 'assassin'] as const;
    for (const name of enemies) {
      this.makeAnim(`enemy-${name}-idle`, `enemy_${name}`, 0, 3, 6, -1);
      this.makeAnim(`enemy-${name}-attack`, `enemy_${name}_attack`, 0, 3, 14, 0);
    }

    // ─── 보스 애니메이션 (idle + attack) ───
    this.makeAnim('boss-beopwang-idle', 'boss_beopwang', 0, 3, 5, -1);
    this.makeAnim('boss-beopwang-attack', 'boss_beopwang_attack', 0, 3, 10, 0);
  }

  /**
   * 애니메이션 생성 헬퍼 (방어적).
   * - 텍스처가 로드되지 않았으면(타임아웃 등) 건너뜀
   * - 이미 같은 키가 있으면 중복 생성 방지
   */
  private makeAnim(
    key: string, textureKey: string,
    start: number, end: number, frameRate: number, repeat: number,
  ): void {
    if (this.anims.exists(key)) return;
    if (!this.textures.exists(textureKey)) {
      console.warn(`[BootScene] 텍스처 없음, 애니메이션 생략: ${textureKey}`);
      return;
    }
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(textureKey, { start, end }),
      frameRate,
      repeat,
    });
    this.anims.create({
      key: 'boss-beopwang-attack',
      frames: this.anims.generateFrameNumbers('boss_beopwang_attack', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0,
    });
  }
}
