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
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
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
    });

    this.load.on('complete', () => {
      bg.destroy();
      fill.destroy();
      label.destroy();
      percentText.destroy();
    });

    const P = 'sprites/processed';

    // ─── 8캐릭터 스프라이트 동적 로드 ───
    for (const char of CHARACTER_LIST) {
      const prefix = char.spritePrefix;
      this.load.spritesheet(`${prefix}_idle`, `${P}/${prefix}_idle.png`, {
        frameWidth: 128, frameHeight: 128,
      });
      this.load.spritesheet(`${prefix}_run`, `${P}/${prefix}_run.png`, {
        frameWidth: 128, frameHeight: 128,
      });
      this.load.spritesheet(`${prefix}_attack`, `${P}/${prefix}_attack.png`, {
        frameWidth: 128, frameHeight: 128,
      });
    }

    // ─── 기존 플레이어 (하위 호환, 필요 시 제거 가능) ───
    this.load.spritesheet('player_idle', `${P}/player_idle.png`, {
      frameWidth: 128, frameHeight: 128,
    });
    this.load.spritesheet('player_run', `${P}/player_run.png`, {
      frameWidth: 128, frameHeight: 128,
    });
    this.load.spritesheet('player_attack', `${P}/player_attack.png`, {
      frameWidth: 128, frameHeight: 128,
    });

    // ─── 적 스프라이트시트 (128x128 프레임) ───
    this.load.spritesheet('enemy_bandit', `${P}/enemy_bandit.png`, {
      frameWidth: 128, frameHeight: 128,
    });
    this.load.spritesheet('enemy_swordsman', `${P}/enemy_swordsman.png`, {
      frameWidth: 128, frameHeight: 128,
    });
    this.load.spritesheet('enemy_assassin', `${P}/enemy_assassin.png`, {
      frameWidth: 128, frameHeight: 128,
    });

    // ─── 보스 스프라이트시트 (160x160 프레임) ───
    this.load.spritesheet('boss_beopwang', `${P}/boss_beopwang.png`, {
      frameWidth: 160, frameHeight: 160,
    });

    // ─── 배경 이미지 (5종) ───
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
    // ─── 애니메이션 등록 ───
    this.createAnimations();

    // CharacterSelectScene으로 전환
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

      this.anims.create({
        key: `${prefix}-idle`,
        frames: this.anims.generateFrameNumbers(`${prefix}_idle`, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });

      this.anims.create({
        key: `${prefix}-run`,
        frames: this.anims.generateFrameNumbers(`${prefix}_run`, { start: 0, end: 5 }),
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: `${prefix}-attack`,
        frames: this.anims.generateFrameNumbers(`${prefix}_attack`, { start: 0, end: 3 }),
        frameRate: 12,
        repeat: 0,
      });
    }

    // ─── 기존 플레이어 애니메이션 (하위 호환) ───
    this.anims.create({
      key: 'player-idle',
      frames: this.anims.generateFrameNumbers('player_idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: 'player-run',
      frames: this.anims.generateFrameNumbers('player_run', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'player-attack',
      frames: this.anims.generateFrameNumbers('player_attack', { start: 0, end: 3 }),
      frameRate: 12,
      repeat: 0,
    });

    // ─── 적 애니메이션 ───
    const enemies = ['bandit', 'swordsman', 'assassin'] as const;
    for (const name of enemies) {
      this.anims.create({
        key: `enemy-${name}-idle`,
        frames: this.anims.generateFrameNumbers(`enemy_${name}`, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }

    // ─── 보스 애니메이션 ───
    this.anims.create({
      key: 'boss-beopwang-idle',
      frames: this.anims.generateFrameNumbers('boss_beopwang', { start: 0, end: 3 }),
      frameRate: 5,
      repeat: -1,
    });
  }
}
