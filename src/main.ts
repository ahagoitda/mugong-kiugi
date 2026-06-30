import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { BattleScene } from './scenes/BattleScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';
import { MotionGalleryScene } from './scenes/MotionGalleryScene';

const GAME_W = 540;
const GAME_H = 960;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#080706',
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Windows / desktop 브라우저에서 창 크기 조절 시 대응
    min: { width: 360, height: 640 },
    max: { width: 900, height: 1600 },
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, CharacterSelectScene, BattleScene, UIScene, GameOverScene, MotionGalleryScene],
};

const game = new Phaser.Game(config);
(window as unknown as Record<string, unknown>).__GAME__ = game;
