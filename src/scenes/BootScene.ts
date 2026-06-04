import Phaser from 'phaser';
import { ALL_RUNTIME_ASSETS, heroSetSkinKey } from '../data/assets';
import { CHARACTER_LIST } from '../data/characters';
import { SET_IDS, SET_TINTS } from '../data/equipment';

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
    this.createHeroSetSkinTextures();
    this.scene.start('CharacterSelectScene');
  }



  private createHeroSetSkinTextures(): void {
    for (const character of CHARACTER_LIST) {
      const baseKey = `hero_${character.id}`;
      const texObj = this.textures.get(baseKey);
      if (!texObj) continue;
      const source = texObj.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const width = source.width;
      const height = source.height;

      for (const setId of SET_IDS) {
        const key = heroSetSkinKey(character.id, setId);
        if (this.textures.exists(key)) continue;
        const texture = this.textures.createCanvas(key, width, height);
        if (!texture) continue;
        const ctx = texture.getContext();
        ctx.clearRect(0, 0, width, height);

        const tint = SET_TINTS[setId] ?? 0xffffff;
        const tr = (tint >> 16) & 0xff;
        const tg = (tint >> 8) & 0xff;
        const tb = tint & 0xff;

        // Create temporary canvas to selectively process pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(source, 0, 0, width, height);
          const imgData = tempCtx.getImageData(0, 0, width, height);
          const pixels = imgData.data;

          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i+1];
            const b = pixels[i+2];
            const a = pixels[i+3];

            if (a > 10) {
              // Skin color check (standard peach/beige ranges)
              const isSkin = (r > 135 && g > 85 && b > 55 && r > g && g > b) || (r > 190 && g > 140 && b > 110);
              // Hair / outline check (dark pixels)
              const isDark = r < 75 && g < 75 && b < 75;

              if (!isSkin && !isDark) {
                const blend = 0.48; // Apply 48% color tint to clothing
                pixels[i] = Math.round(r * (1 - blend) + tr * blend);
                pixels[i+1] = Math.round(g * (1 - blend) + tg * blend);
                pixels[i+2] = Math.round(b * (1 - blend) + tb * blend);
              }
            }
          }
          tempCtx.putImageData(imgData, 0, 0);

          // Draw a soft glowing outline behind the hero using shadow properties
          ctx.save();
          ctx.shadowColor = `#${tint.toString(16).padStart(6, '0')}`;
          ctx.shadowBlur = 24;
          ctx.globalAlpha = 0.65;
          ctx.drawImage(tempCanvas, 0, 0, width, height);
          ctx.restore();

          // Draw the tinted character itself
          ctx.drawImage(tempCanvas, 0, 0, width, height);

          // Add a premium diagonal sheen reflection across the character
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(width * 0.22, 0, width * 0.12, height);
          ctx.restore();
        }

        texture.refresh();
      }
    }
  }
}
