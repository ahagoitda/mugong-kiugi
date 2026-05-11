import Phaser from 'phaser';

/**
 * spriteGenerator - 프로그래밍 방식으로 도트 스프라이트를 생성합니다.
 *
 * 왜 이 방식을 사용하는가?
 * - MVP 단계에서 외부 에셋 파일 없이 즉시 게임을 실행할 수 있습니다.
 * - 추후 실제 도트 에셋(PNG 스프라이트시트)으로 교체하기 쉽습니다.
 * - 모든 스프라이트는 텍스처 매니저에 등록되어 Phaser의 배칭 최적화를 받습니다.
 *
 * 각 스프라이트는 32x32 픽셀 기준으로 생성됩니다.
 */

const TILE = 32;

/**
 * 단색 사각형 텍스처를 생성하여 텍스처 매니저에 등록합니다.
 */
function makeRect(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  color: number,
): void {
  const gfx = scene.add.graphics();
  gfx.fillStyle(color, 1);
  gfx.fillRect(0, 0, w, h);
  gfx.generateTexture(key, w, h);
  gfx.destroy(); // 즉시 파괴하여 메모리 누수 방지
}

/**
 * 간단한 캐릭터 형태의 도트 텍스처를 생성합니다.
 * 머리(원) + 몸통(사각형) + 검(선)으로 구성됩니다.
 */
function makeCharacter(
  scene: Phaser.Scene,
  key: string,
  bodyColor: number,
  swordColor: number,
): void {
  const gfx = scene.add.graphics();

  // 몸통
  gfx.fillStyle(bodyColor, 1);
  gfx.fillRect(8, 10, 16, 18);

  // 머리
  gfx.fillStyle(0xffcc88, 1);
  gfx.fillCircle(16, 8, 6);

  // 검
  gfx.lineStyle(2, swordColor, 1);
  gfx.lineBetween(24, 12, 30, 4);

  gfx.generateTexture(key, TILE, TILE);
  gfx.destroy();
}

/**
 * 스프라이트시트 형태의 텍스처를 생성합니다.
 * 프레임별로 약간의 변화를 주어 애니메이션 효과를 냅니다.
 */
function makeSpriteSheet(
  scene: Phaser.Scene,
  key: string,
  frameCount: number,
  bodyColor: number,
  swordColor: number,
): void {
  const frameW = TILE;
  const totalW = frameW * frameCount;
  const gfx = scene.add.graphics();

  for (let i = 0; i < frameCount; i++) {
    const offsetX = i * frameW;

    // 몸통 (프레임마다 약간 위아래로 흔들림)
    const bounceY = Math.sin((i / frameCount) * Math.PI * 2) * 2;
    gfx.fillStyle(bodyColor, 1);
    gfx.fillRect(offsetX + 8, 10 + bounceY, 16, 18);

    // 머리
    gfx.fillStyle(0xffcc88, 1);
    gfx.fillCircle(offsetX + 16, 8 + bounceY, 6);

    // 검 (프레임마다 각도 변화)
    const angle = (i / frameCount) * Math.PI * 0.8 - 0.4;
    const swordLen = 12;
    gfx.lineStyle(2, swordColor, 1);
    gfx.lineBetween(
      offsetX + 24,
      12 + bounceY,
      offsetX + 24 + Math.cos(angle) * swordLen,
      12 + bounceY - Math.sin(angle) * swordLen,
    );
  }

  gfx.generateTexture(key, totalW, TILE);
  gfx.destroy();

  // 스프라이트시트로 등록
  const tex = scene.textures.get(key);
  if (tex) {
    tex.add('__BASE', 0, 0, 0, totalW, TILE);
    for (let i = 0; i < frameCount; i++) {
      tex.add(i, 0, i * frameW, 0, frameW, TILE);
    }
  }
}

/**
 * 이펙트(슬래시) 텍스처를 생성합니다.
 */
function makeSlashEffect(scene: Phaser.Scene, key: string, color: number): void {
  const gfx = scene.add.graphics();
  gfx.lineStyle(3, color, 0.8);
  gfx.beginPath();
  gfx.arc(16, 16, 12, -Math.PI * 0.3, Math.PI * 0.3, false);
  gfx.strokePath();
  gfx.generateTexture(key, TILE, TILE);
  gfx.destroy();
}

/**
 * 모든 플레이스홀더 스프라이트를 생성합니다.
 * BootScene의 preload()에서 호출됩니다.
 */
export function generatePlaceholderSprites(scene: Phaser.Scene): void {
  // ─── 플레이어 ───
  makeCharacter(scene, 'player_idle', 0x4488ff, 0xcccccc);

  // 플레이어 공격 스프라이트시트 (각 무공별)
  makeSpriteSheet(scene, 'player_attack_samjae', 6, 0x4488ff, 0xffffff);
  makeSpriteSheet(scene, 'player_attack_yukhap', 8, 0x4488ff, 0x88ccff);
  makeSpriteSheet(scene, 'player_attack_maehwa', 12, 0x4488ff, 0xff88cc);
  makeSpriteSheet(scene, 'player_attack_cheongpung', 8, 0x4488ff, 0x88ffcc);
  makeSpriteSheet(scene, 'player_attack_taegeuk', 20, 0x4488ff, 0xffff88);
  makeSpriteSheet(scene, 'player_attack_changung', 30, 0x4488ff, 0xffd740);
  makeSpriteSheet(scene, 'player_dash', 6, 0x4488ff, 0xcccccc);
  makeSpriteSheet(scene, 'player_run', 4, 0x4488ff, 0xcccccc);

  // ─── 적 ───
  makeCharacter(scene, 'enemy_bandit', 0x886644, 0x666666);
  makeCharacter(scene, 'enemy_swordsman', 0x664444, 0xaaaaaa);
  makeCharacter(scene, 'enemy_assassin', 0x333333, 0x88ff88);
  makeCharacter(scene, 'enemy_boss', 0x880000, 0xff4444);

  // ─── 이펙트 ───
  makeSlashEffect(scene, 'fx_slash_white', 0xffffff);
  makeSlashEffect(scene, 'fx_slash_pink', 0xff88cc);
  makeSlashEffect(scene, 'fx_slash_blue', 0x88ccff);
  makeSlashEffect(scene, 'fx_slash_gold', 0xffd740);

  // ─── 배경 타일 ───
  makeRect(scene, 'tile_ground', TILE, TILE, 0x2d5a27);
  makeRect(scene, 'tile_path', TILE, TILE, 0x8b7355);

  // ─── UI 요소 ───
  makeRect(scene, 'ui_btn', 48, 48, 0x333355);
  makeRect(scene, 'ui_bar_bg', 100, 8, 0x333333);
  makeRect(scene, 'ui_bar_hp', 100, 8, 0xff4444);
  makeRect(scene, 'ui_bar_sp', 100, 8, 0x4488ff);
  makeRect(scene, 'ui_drop_item', 16, 16, 0xffd740);
}
