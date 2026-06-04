import Phaser from 'phaser';
import { loadGame, saveGame } from '../systems/SaveSystem';
import { soundSystem } from '../systems/SoundSystem';

interface GameOverData {
  waveNumber: number;
  killCount: number;
  characterId: string;
}

const W = 540;
const H = 960;

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
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88);
    this.add.rectangle(W / 2, H / 2, W - 42, H - 58, 0x100806, 0.96).setStrokeStyle(3, 0x9b3126);

    this.add.text(W / 2, 190, '패배', this.titleStyle(54, '#ff5a45')).setOrigin(0.5);
    this.add.text(W / 2, 270, `도달 웨이브 ${this.gameData.waveNumber}`, this.textStyle(22, '#ffd27a')).setOrigin(0.5);
    this.add.text(W / 2, 310, `처치 ${this.gameData.killCount}`, this.textStyle(18, '#d8cfbd')).setOrigin(0.5);

    const save = loadGame();
    const deathCount = (save.deathCount ?? 0) + 1;
    const expPenaltyPct = Math.min(10 + (deathCount - 1) * 5, 30);
    const expPenalty = Math.floor(save.exp * (expPenaltyPct / 100));
    const reviveWave = Math.max(1, this.gameData.waveNumber - 1);

    this.addButton(390, '부활', `경험치 -${expPenaltyPct}% (${expPenalty}) / ${reviveWave}웨이브`, 0x3a190a, 0xff8a32, () => {
      this.onRevive(expPenalty, reviveWave);
    });
    this.addButton(510, '처음부터 재도전', '보유 성장 유지 / 1웨이브 시작', 0x0a172d, 0x5f8dff, () => {
      this.onRestart();
    });
    this.addButton(630, '캐릭터 선택', '다른 무인으로 시작', 0x151515, 0x777777, () => {
      this.scene.stop('UIScene');
      this.scene.stop('BattleScene');
      this.scene.start('CharacterSelectScene');
    });

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private addButton(y: number, title: string, sub: string, fill: number, stroke: number, onClick: () => void): void {
    const bg = this.add.rectangle(W / 2, y, 360, 78, fill, 0.96).setStrokeStyle(2, stroke).setInteractive({ useHandCursor: true });
    this.add.text(W / 2, y - 12, title, this.titleStyle(21, '#f0d493')).setOrigin(0.5);
    this.add.text(W / 2, y + 18, sub, this.textStyle(13, '#9f9688')).setOrigin(0.5);
    bg.on('pointerdown', onClick);
  }

  private onRevive(expPenalty: number, reviveWave: number): void {
    soundSystem.play('revive');
    const save = loadGame();
    save.exp = Math.max(0, save.exp - expPenalty);
    save.deathCount = (save.deathCount ?? 0) + 1;
    saveGame(save);
    this.restartBattle(reviveWave, true);
  }

  private onRestart(): void {
    soundSystem.play('dash');
    this.restartBattle(1, false);
  }

  private restartBattle(startWave: number, isRevive: boolean): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('GameOverScene');
      this.scene.start('BattleScene', { characterId: this.gameData.characterId, startWave, isRevive });
      this.scene.start('UIScene', { characterId: this.gameData.characterId });
    });
  }

  private titleStyle(size: number, color = '#e8c36a'): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'serif', fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#1a0d03', strokeThickness: 4 };
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'sans-serif', fontSize: `${size}px`, color };
  }
}
