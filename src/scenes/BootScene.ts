import Phaser from 'phaser';

/**
 * BootScene - 게임 부팅 및 에셋 로딩 씬
 *
 * AI로 생성된 도트 스프라이트를 로드합니다.
 * 스프라이트시트는 수평으로 프레임이 나열된 형태입니다.
 *
 * 에셋 목록:
 * - 플레이어: idle(4f, 64x64), run(6f, 64x64), attack(4f, 80x64)
 * - 적: bandit(4f), swordsman(4f), assassin(4f) - 각 64x64
 * - 보스: beopwang(4f, 96x96)
 * - 배경: mountains(720x384), ground(720x96)
 * - 이펙트: slash 4종 (48x48 단일)
 * - NPC: jeomsoyi (64x64 단일)
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

    this.load.on('progress', (value: number) => {
      fill.width = (barW - 2) * value;
    });

    this.load.on('complete', () => {
      bg.destroy();
      fill.destroy();
      label.destroy();
    });

    const P = 'sprites/processed';

    // ─── 플레이어 스프라이트시트 (128x128 프레임) ───
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

    // ─── 배경 이미지 ───
    this.load.image('bg_mountains', `${P}/bg_mountains.png`);
    this.load.image('bg_ground', `${P}/bg_ground.png`);

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

    // BattleScene과 UIScene을 동시에 실행 (UIScene은 오버레이)
    this.scene.start('BattleScene');
    this.scene.start('UIScene');
  }

  /**
   * 스프라이트시트 기반 애니메이션을 등록합니다.
   *
   * Phaser의 AnimationManager는 글로벌이므로
   * 한 번만 등록하면 모든 씬에서 사용 가능합니다.
   */
  private createAnimations(): void {
    // 플레이어 애니메이션
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

    // 적 애니메이션 (각 적마다 idle 애니메이션)
    const enemies = ['bandit', 'swordsman', 'assassin'] as const;
    for (const name of enemies) {
      this.anims.create({
        key: `enemy-${name}-idle`,
        frames: this.anims.generateFrameNumbers(`enemy_${name}`, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }

    // 보스 애니메이션
    this.anims.create({
      key: 'boss-beopwang-idle',
      frames: this.anims.generateFrameNumbers('boss_beopwang', { start: 0, end: 3 }),
      frameRate: 5,
      repeat: -1,
    });
  }
}
