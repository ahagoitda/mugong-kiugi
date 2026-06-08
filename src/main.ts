import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { BattleScene } from './scenes/BattleScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';

// ✅ 기본 디자인 해상도 (기기 비율에 맞춰 세로 해상도 동적 설정)
const BASE_W = 540;
const dprRatio = window.innerHeight / window.innerWidth;
const BASE_H = Math.max(960, Math.round(BASE_W * (dprRatio > 0 ? dprRatio : 1.7778)));

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: BASE_W,
  height: BASE_H,
  parent: 'game-container',
  backgroundColor: '#080706',
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,           // 화면에 맞춰 자동 확대/축소 (현대 폰에서 더 크게)
    autoCenter: Phaser.Scale.CENTER_BOTH,
    fullscreenTarget: '#game-container',
    expandParent: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, CharacterSelectScene, BattleScene, UIScene, GameOverScene],
};

const game = new Phaser.Game(config);
(window as unknown as Record<string, unknown>).__GAME__ = game;

// ✅ 화면 크기 변경(회전, 폴딩 등) 대응
window.addEventListener('resize', () => {
  if (game && game.scale) {
    game.scale.refresh();
  }
});

// Capacitor 환경에서 fullscreen 힌트
if (typeof (window as any).Capacitor !== 'undefined') {
  console.log('[Mugong] Running on Capacitor native platform');
}