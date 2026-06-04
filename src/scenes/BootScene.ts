import Phaser from 'phaser';
import { ALL_RUNTIME_ASSETS, COMBAT_VFX_KEYS, heroSetSkinKey } from '../data/assets';
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
    this.createCombatVfxTextures();
    this.createHeroSetSkinTextures();
    this.scene.start('CharacterSelectScene');
  }

  private createCombatVfxTextures(): void {
    const palette = [
      0x66ccff, 0xffcc33, 0xff6633, 0x99ffbb, 0xff5599, 0xab47bc,
      0x4fc3f7, 0xffd740, 0x66ffee, 0xff3366, 0x88ddff, 0xd6a84b,
    ];

    COMBAT_VFX_KEYS.forEach((key, index) => {
      const g = this.make.graphics({ x: 0, y: 0 });
      const color = palette[index % palette.length];
      const accent = palette[(index + 5) % palette.length];
      const mode = index % 6;

      g.setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(3 + (index % 4), color, 0.9);
      g.fillStyle(color, 0.35);

      if (mode === 0) {
        g.beginPath();
        g.arc(64, 64, 42, -0.95, 0.85);
        g.strokePath();
        g.lineStyle(2, accent, 0.7);
        g.beginPath();
        g.arc(62, 59, 26, -0.75, 0.65);
        g.strokePath();
      } else if (mode === 1) {
        for (let i = 0; i < 3; i++) {
          g.lineStyle(3, i === 1 ? accent : color, 0.85 - i * 0.12);
          g.beginPath();
          g.moveTo(22 + i * 7, 36 + i * 15);
          g.lineTo(104 - i * 4, 70 - i * 7);
          g.strokePath();
        }
      } else if (mode === 2) {
        g.fillCircle(64, 64, 14);
        g.lineStyle(3, color, 0.8);
        g.strokeCircle(64, 64, 30);
        g.lineStyle(2, accent, 0.65);
        g.strokeCircle(64, 64, 46);
      } else if (mode === 3) {
        this.drawCurve(g, 16, 62, 48, 24 + (index % 3) * 8, 112, 60);
        g.strokePath();
        g.lineStyle(2, accent, 0.65);
        this.drawCurve(g, 24, 78, 58, 48, 112, 80);
        g.strokePath();
      } else if (mode === 4) {
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8 + index * 0.08;
          g.lineStyle(i % 2 ? 2 : 4, i % 2 ? accent : color, 0.8);
          g.beginPath();
          g.moveTo(64, 64);
          g.lineTo(64 + Math.cos(angle) * 48, 64 + Math.sin(angle) * 48);
          g.strokePath();
        }
      } else {
        g.lineStyle(4, color, 0.9);
        g.beginPath();
        g.moveTo(20, 74);
        g.lineTo(72, 26);
        g.lineTo(110, 62);
        g.strokePath();
        g.fillStyle(accent, 0.38);
        g.fillCircle(82, 52, 12);
      }

      g.generateTexture(key, 128, 128);
      g.destroy();
    });
  }

  private drawCurve(g: Phaser.GameObjects.Graphics, sx: number, sy: number, cx: number, cy: number, ex: number, ey: number): void {
    g.beginPath();
    g.moveTo(sx, sy);
    for (let step = 1; step <= 10; step++) {
      const t = step / 10;
      const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
      const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
      g.lineTo(x, y);
    }
  }

  private createHeroSetSkinTextures(): void {
    for (const character of CHARACTER_LIST) {
      const baseKey = `hero_${character.id}`;
      const source = this.textures.get(baseKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const width = source.width;
      const height = source.height;

      for (const setId of SET_IDS) {
        const key = heroSetSkinKey(character.id, setId);
        if (this.textures.exists(key)) continue;
        const texture = this.textures.createCanvas(key, width, height);
        if (!texture) continue;
        const ctx = texture.getContext();
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(source, 0, 0, width, height);
        const tint = SET_TINTS[setId] ?? 0xffffff;
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = `#${tint.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(width * 0.18, 0, width * 0.16, height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        texture.refresh();
      }
    }
  }
}
