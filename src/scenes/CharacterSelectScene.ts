import Phaser from 'phaser';
import { CHARACTER_LIST } from '../data/characters';
import { loadGame, saveGame } from '../systems/SaveSystem';

const W = 540;
const H = 960;

export class CharacterSelectScene extends Phaser.Scene {
  private selected = 0;
  private hero!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private statText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#080706');
    this.add.image(W / 2, H / 2, 'background_main').setDisplaySize(W, H).setAlpha(0.42);
    this.add.rectangle(W / 2, H / 2, W - 28, H - 28, 0x080706, 0.35).setStrokeStyle(2, 0x9b7438);
    this.add.text(W / 2, 54, '무공 키우기', this.titleStyle(38)).setOrigin(0.5);
    this.add.text(W / 2, 100, '강호에 나설 무인을 선택하십시오', this.textStyle(18, '#d6c7a7')).setOrigin(0.5);

    this.hero = this.add.image(W / 2, 350, 'hero_sword_male').setDisplaySize(390, 390);
    this.nameText = this.add.text(W / 2, 570, '', this.titleStyle(30)).setOrigin(0.5);
    this.descText = this.add.text(W / 2, 620, '', {
      ...this.textStyle(17, '#d8cfbd'), align: 'center', wordWrap: { width: 430 },
    }).setOrigin(0.5, 0);
    this.statText = this.add.text(W / 2, 720, '', this.textStyle(16, '#e8c36a')).setOrigin(0.5);

    this.add.text(55, 350, '‹', this.titleStyle(64)).setOrigin(0.5).setInteractive()
      .on('pointerdown', () => this.select(this.selected - 1));
    this.add.text(W - 55, 350, '›', this.titleStyle(64)).setOrigin(0.5).setInteractive()
      .on('pointerdown', () => this.select(this.selected + 1));

    const start = this.add.rectangle(W / 2, H - 105, 300, 70, 0x2b1d0c, 0.96)
      .setStrokeStyle(2, 0xd4a74e).setInteractive();
    this.add.text(W / 2, H - 105, '강호 출정', this.titleStyle(25)).setOrigin(0.5);
    start.on('pointerdown', () => {
      const character = CHARACTER_LIST[this.selected];
      const save = loadGame();
      save.selectedCharacter = character.id;
      saveGame(save);
      this.scene.start('BattleScene', { characterId: character.id, startWave: Math.max(1, save.stageCleared + 1) });
      this.scene.launch('UIScene', { characterId: character.id });
    });
    this.select(0);
  }

  private select(index: number): void {
    this.selected = Phaser.Math.Wrap(index, 0, CHARACTER_LIST.length);
    const character = CHARACTER_LIST[this.selected];
    this.hero.setTexture(`hero_${character.id}`);
    this.nameText.setText(character.nameKo);
    this.descText.setText(character.description);
    this.statText.setText(`체력 x${character.stats.hpMul.toFixed(1)}   공격 x${character.stats.damageMul.toFixed(1)}   속도 x${character.stats.speedMul.toFixed(1)}`);
  }

  private titleStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'serif', fontSize: `${size}px`, color: '#e8c36a', fontStyle: 'bold', stroke: '#1a0d03', strokeThickness: 4 };
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'sans-serif', fontSize: `${size}px`, color };
  }
}
