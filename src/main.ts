import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { BattleScene } from './scenes/BattleScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';

/**
 * 무공키우기 - 메인 엔트리
 *
 * 레이아웃 구조 (스마트폰 세로 9:16 비율):
 * ┌─────────────────────┐
 * │  [상단 60%] 전투 영역  │  ← 횡스크롤 자동전투
 * │  캐릭터 자동 진행      │
 * │  적 처치 + 비급 드랍   │
 * ├─────────────────────┤
 * │  [하단 40%] 관리 영역  │  ← 무공 장착/합성/도감
 * │  비급 슬롯, 합성 버튼  │
 * │  스탯, 설정           │
 * └─────────────────────┘
 *
 * 해상도: 360 x 640 (9:16)
 * - 전투 영역: 360 x 384 (상단 60%)
 * - 관리 영역: 360 x 256 (하단 40%)
 *
 * pixelArt: true → 도트 스프라이트가 선명하게 렌더링됩니다.
 * antialias: false → Nearest-neighbor 스케일링으로 도트 깨짐 방지.
 */

const GAME_W = 540;
const GAME_H = 960;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#080706',
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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

// Phaser 인스턴스 생성 (디버깅용으로 window에 노출)
const game = new Phaser.Game(config);
(window as unknown as Record<string, unknown>).__GAME__ = game;
