import Phaser from 'phaser';
import { loadGame, saveGame } from '../systems/SaveSystem';
import { soundSystem } from '../systems/SoundSystem';

/**
 * GameOverScene - 사망 후 부활/재시작 선택 화면
 *
 * 레이아웃 (360x640):
 * ┌─────────────────────────────┐
 * │                             │
 * │     ☠ 전사하였습니다 ☠      │
 * │                             │
 * │   도달 웨이브: 7파           │
 * │   처치 수: 23               │
 * │                             │
 * │  ┌─────────────────────┐   │
 * │  │  ⚡ 부활 (내공 -10%)│   │  ← 내공(경험치) 패널티로 부활
 * │  └─────────────────────┘   │
 * │                             │
 * │  ┌─────────────────────┐   │
 * │  │  🔄 처음부터 시작   │   │  ← 세이브 유지, 웨이브만 리셋
 * │  └─────────────────────┘   │
 * │                             │
 * └─────────────────────────────┘
 *
 * 부활 시스템 설계:
 * - 부활 비용: 현재 경험치의 10% (누적 사망 횟수에 따라 증가)
 * - 부활 후: 현재 웨이브 1웨이브 전으로 돌아감, HP 50% 회복
 * - "처음부터 시작": 세이브 데이터(인벤토리/무공)는 유지, 웨이브만 1로 리셋
 */

interface GameOverData {
  waveNumber: number;
  killCount: number;
  characterId: string;
}

const GAME_W = 360;
const GAME_H = 640;

export class GameOverScene extends Phaser.Scene {
  private gameData: GameOverData = { waveNumber: 1, killCount: 0, characterId: 'sword_male' };

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: GameOverData): void {
    this.gameData = data;
  }

  create(): void {
    soundSystem.play('game_over');

    // 어두운 배경 오버레이
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.85);

    // 붉은 테두리 효과
    const border = this.add.graphics();
    border.lineStyle(3, 0xff2222, 0.8);
    border.strokeRect(10, 10, GAME_W - 20, GAME_H - 20);

    // 제목
    this.add.text(GAME_W / 2, 140, '☠', {
      fontSize: '64px',
      color: '#ff2222',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 220, '전사하였습니다', {
      fontSize: '22px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 구분선
    const line = this.add.graphics();
    line.lineStyle(1, 0x444444);
    line.lineBetween(40, 255, GAME_W - 40, 255);

    // 결과 표시
    this.add.text(GAME_W / 2, 275, `도달 웨이브: ${this.gameData.waveNumber}파`, {
      fontSize: '14px',
      color: '#ffd740',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 300, `처치 수: ${this.gameData.killCount}`, {
      fontSize: '12px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 부활 비용 계산
    const save = loadGame();
    const deathCount = (save.deathCount ?? 0) + 1;
    const expPenaltyPct = Math.min(10 + (deathCount - 1) * 5, 30); // 최대 30%
    const expPenalty = Math.floor(save.exp * (expPenaltyPct / 100));
    const reviveWave = Math.max(1, this.gameData.waveNumber - 1);

    // 부활 버튼
    const reviveBg = this.add.rectangle(GAME_W / 2, 380, 260, 54, 0x1a0a0a)
      .setStrokeStyle(2, 0xff6600)
      .setInteractive({ useHandCursor: true });

    this.add.text(GAME_W / 2, 372, `⚡ 부활하기`, {
      fontSize: '16px',
      color: '#ff9900',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 394, `경험치 -${expPenaltyPct}% (${expPenalty}exp) | ${reviveWave}파부터`, {
      fontSize: '9px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    reviveBg.on('pointerover', () => reviveBg.fillColor = 0x2a1a00);
    reviveBg.on('pointerout',  () => reviveBg.fillColor = 0x1a0a0a);
    reviveBg.on('pointerdown', () => this.onRevive(expPenalty, reviveWave));

    // 처음부터 시작 버튼
    const restartBg = this.add.rectangle(GAME_W / 2, 460, 260, 54, 0x0a0a1a)
      .setStrokeStyle(2, 0x4466aa)
      .setInteractive({ useHandCursor: true });

    this.add.text(GAME_W / 2, 452, `🔄 처음부터 시작`, {
      fontSize: '16px',
      color: '#4488ff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 474, '인벤토리/무공 유지 | 웨이브 1부터', {
      fontSize: '9px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    restartBg.on('pointerover', () => restartBg.fillColor = 0x0a0a2a);
    restartBg.on('pointerout',  () => restartBg.fillColor = 0x0a0a1a);
    restartBg.on('pointerdown', () => this.onRestart());

    // 캐릭터 선택 버튼
    const charBg = this.add.rectangle(GAME_W / 2, 535, 180, 36, 0x111111)
      .setStrokeStyle(1, 0x555555)
      .setInteractive({ useHandCursor: true });

    this.add.text(GAME_W / 2, 535, '캐릭터 변경', {
      fontSize: '11px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    charBg.on('pointerover', () => charBg.fillColor = 0x1a1a1a);
    charBg.on('pointerout',  () => charBg.fillColor = 0x111111);
    charBg.on('pointerdown', () => {
      this.scene.stop('UIScene');
      this.scene.stop('BattleScene');
      this.scene.start('CharacterSelectScene');
    });

    // 페이드인 효과
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  /**
   * 부활 처리
   * - 경험치 패널티 적용
   * - 사망 횟수 증가
   * - 현재 웨이브 -1에서 재시작
   */
  private onRevive(expPenalty: number, reviveWave: number): void {
    soundSystem.play('revive');

    const save = loadGame();
    save.exp = Math.max(0, save.exp - expPenalty);
    save.deathCount = (save.deathCount ?? 0) + 1;
    saveGame(save);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('GameOverScene');
      // BattleScene을 해당 웨이브에서 재시작
      this.scene.start('BattleScene', {
        characterId: this.gameData.characterId,
        startWave: reviveWave,
        isRevive: true,
      });
      this.scene.start('UIScene');
    });
  }

  /**
   * 처음부터 시작
   * - 세이브 데이터(인벤토리/무공) 유지
   * - 웨이브 1부터 재시작
   */
  private onRestart(): void {
    soundSystem.play('dash');

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('GameOverScene');
      this.scene.start('BattleScene', {
        characterId: this.gameData.characterId,
        startWave: 1,
        isRevive: false,
      });
      this.scene.start('UIScene');
    });
  }
}
