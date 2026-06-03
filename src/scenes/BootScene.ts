import Phaser from 'phaser';
import { ALL_RUNTIME_ASSETS } from '../data/assets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#080706');
    const title = this.add.text(width / 2, height / 2 - 50, '무공 키우기', {
      fontFamily: 'serif',
      fontSize: '34px',
      color: '#e9c878',
      fontStyle: 'bold',
      stroke: '#2a1606',
      strokeThickness: 4,
    }).setOrigin(0.5);
    const frame = this.add.rectangle(width / 2, height / 2 + 18, 330, 12, 0x17130e)
      .setStrokeStyle(1, 0x8b6a32);
    const bar = this.add.rectangle(width / 2 - 164, height / 2 + 18, 0, 8, 0xd6a84b).setOrigin(0, 0.5);
    this.load.on('progress', (value: number) => { bar.width = 328 * value; });
    this.load.on('complete', () => { title.destroy(); frame.destroy(); bar.destroy(); });
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn(`[BootScene] asset load failed: ${file.key}`));

    for (const asset of ALL_RUNTIME_ASSETS) this.load.image(asset.key, asset.path);
  }

  create(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.lineStyle(8, 0xffffff, 0.9);
    graphics.beginPath();
    graphics.arc(48, 48, 34, -0.8, 0.8);
    graphics.strokePath();
    for (const key of ['fx_slash_white', 'fx_slash_pink', 'fx_slash_blue', 'fx_slash_gold']) {
      graphics.generateTexture(key, 96, 96);
    }
    graphics.destroy();
    this.scene.start('CharacterSelectScene');
  }
}
