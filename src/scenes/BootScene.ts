import Phaser from 'phaser';
import { ALL_RUNTIME_ASSETS, heroSetSkinKey, RUNTIME_ASSET_PATH } from '../data/assets';
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

    // Load character spritesheets
    for (const char of CHARACTER_LIST) {
      const id = char.id;
      this.load.spritesheet(`hero_${id}_idle`,
        `${RUNTIME_ASSET_PATH}/hero_${id}_idle.png`,
        { frameWidth: 128, frameHeight: 128 });
      this.load.spritesheet(`hero_${id}_run`,
        `${RUNTIME_ASSET_PATH}/hero_${id}_run.png`,
        { frameWidth: 128, frameHeight: 128 });
      this.load.spritesheet(`hero_${id}_attack`,
        `${RUNTIME_ASSET_PATH}/hero_${id}_attack.png`,
        { frameWidth: 128, frameHeight: 128 });
      this.load.spritesheet(`hero_${id}_attack_heavy`,
        `${RUNTIME_ASSET_PATH}/hero_${id}_attack_heavy.png`,
        { frameWidth: 128, frameHeight: 128 });
      this.load.spritesheet(`hero_${id}_attack_quick`,
        `${RUNTIME_ASSET_PATH}/hero_${id}_attack_quick.png`,
        { frameWidth: 128, frameHeight: 128 });
      this.load.spritesheet(`hero_${id}_attack_thrust`,
        `${RUNTIME_ASSET_PATH}/hero_${id}_attack_thrust.png`,
        { frameWidth: 128, frameHeight: 128 });
    }
  }

  create(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const size = 384;
    const center = size / 2;

    const colors = [
      { key: 'fx_slash_white', tint: 0xffffff },
      { key: 'fx_slash_pink', tint: 0xff4488 },
      { key: 'fx_slash_blue', tint: 0x33aaff },
      { key: 'fx_slash_gold', tint: 0xffbb22 }
    ];

    for (const item of colors) {
      graphics.clear();
      // 1. Outer glow (가장 넓고 흐릿한 외각 오라)
      graphics.fillStyle(item.tint, 0.22);
      graphics.beginPath();
      graphics.arc(center, center, 170, -1.35, 1.35, false);
      graphics.arc(center, center, 80, 1.35, -1.35, true);
      graphics.closePath();
      graphics.fillPath();

      // 2. Color body (색상 띠)
      graphics.fillStyle(item.tint, 0.65);
      graphics.beginPath();
      graphics.arc(center, center, 150, -1.25, 1.25, false);
      graphics.arc(center, center, 105, 1.25, -1.25, true);
      graphics.closePath();
      graphics.fillPath();

      // 3. Inner core (눈부시게 하얗게 타오르는 중심선)
      graphics.fillStyle(0xffffff, 0.95);
      graphics.beginPath();
      graphics.arc(center, center, 140, -1.15, 1.15, false);
      graphics.arc(center, center, 115, 1.15, -1.15, true);
      graphics.closePath();
      graphics.fillPath();

      graphics.generateTexture(item.key, size, size);
    }
    graphics.destroy();

    // Create animations for each hero
    for (const char of CHARACTER_LIST) {
      const prefix = char.spritePrefix;
      const id = char.id;

      this.anims.create({
        key: `${prefix}-idle`,
        frames: this.anims.generateFrameNumbers(`hero_${id}_idle`, { start: 0, end: 11 }),
        frameRate: 9,   // slower for living breathing feel
        repeat: -1
      });

      this.anims.create({
        key: `${prefix}-run`,
        frames: this.anims.generateFrameNumbers(`hero_${id}_run`, { start: 0, end: 11 }),
        frameRate: 12,  // weightier run
        repeat: -1
      });

      this.anims.create({
        key: `${prefix}-attack`,
        frames: this.anims.generateFrameNumbers(`hero_${id}_attack`, { start: 0, end: 11 }),
        frameRate: 14,
        repeat: 0
      });

      for (const variant of ['heavy', 'quick', 'thrust']) {
        this.anims.create({
          key: `${prefix}-attack-${variant}`,
          frames: this.anims.generateFrameNumbers(`hero_${id}_attack_${variant}`, { start: 0, end: 11 }),
          frameRate: variant === 'heavy' ? 12 : 15,
          repeat: 0
        });
      }
    }

    this.createHeroSetSkinTextures();
    this.scene.start('CharacterSelectScene');
  }



  private createHeroSetSkinTextures(): void {
    const actions = ['idle', 'run', 'attack', 'attack_heavy', 'attack_quick', 'attack_thrust'] as const;
    const actionFrameCounts = { idle: 12, run: 12, attack: 12, attack_heavy: 12, attack_quick: 12, attack_thrust: 12 };

    for (const character of CHARACTER_LIST) {
      const id = character.id;
      const prefix = character.spritePrefix;

      // 1. Static Preview Textures
      const baseKey = `hero_${id}`;
      const texObj = this.textures.get(baseKey);
      if (texObj) {
        const source = texObj.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        const width = source.width;
        const height = source.height;

        for (const setId of SET_IDS) {
          const key = heroSetSkinKey(id, setId);
          if (!this.textures.exists(key)) {
            this.createTintedCanvas(key, source, width, height, setId);
          }
        }
      }

      // 2. Animated Spritesheet Textures
      for (const action of actions) {
        const baseAnimKey = `hero_${id}_${action}`;
        const animTexObj = this.textures.get(baseAnimKey);
        if (!animTexObj) continue;

        const source = animTexObj.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        const width = source.width;
        const height = source.height;
        const frameCount = actionFrameCounts[action];

        for (const setId of SET_IDS) {
          const key = `hero_set_${id}_${setId}_${action}`;
          if (this.textures.exists(key)) continue;

          this.createTintedCanvas(key, source, width, height, setId);

          const tex = this.textures.get(key);
          if (tex) {
            tex.add('__BASE', 0, 0, 0, width, height);
            const frameW = width / frameCount;
            for (let i = 0; i < frameCount; i++) {
              tex.add(i, 0, i * frameW, 0, frameW, height);
            }
          }

          let animKey = '';
          if (action.startsWith('attack_')) {
            const variant = action.split('_')[1];
            animKey = `${prefix}-attack-${setId}-${variant}`;
          } else {
            animKey = `${prefix}-${action}-${setId}`;
          }

          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: frameCount - 1 }),
            frameRate: action.startsWith('attack') ? 12 : action === 'run' ? 10 : 8,
            repeat: action.startsWith('attack') ? 0 : -1
          });
        }
      }
    }
  }

  private createTintedCanvas(key: string, source: HTMLImageElement | HTMLCanvasElement, width: number, height: number, setId: string): void {
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, width, height);

    const tint = SET_TINTS[setId] ?? 0xffffff;
    const tr = (tint >> 16) & 0xff;
    const tg = (tint >> 8) & 0xff;
    const tb = tint & 0xff;

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
          const isSkin = (r > 135 && g > 85 && b > 55 && r > g && g > b) || (r > 190 && g > 140 && b > 110);
          const isDark = r < 75 && g < 75 && b < 75;

          if (!isSkin && !isDark) {
            const blend = 0.48;
            pixels[i] = Math.round(r * (1 - blend) + tr * blend);
            pixels[i+1] = Math.round(g * (1 - blend) + tg * blend);
            pixels[i+2] = Math.round(b * (1 - blend) + tb * blend);
          }
        }
      }
      tempCtx.putImageData(imgData, 0, 0);

      ctx.save();
      ctx.shadowColor = `#${tint.toString(16).padStart(6, '0')}`;
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 0.65;
      ctx.drawImage(tempCanvas, 0, 0, width, height);
      ctx.restore();

      ctx.drawImage(tempCanvas, 0, 0, width, height);

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
