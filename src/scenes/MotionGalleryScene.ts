import Phaser from 'phaser';
import { CHARACTER_LIST } from '../data/characters';
import { SKILL_DATABASE } from '../data/skills';
import {
  HEROIC_MOTION_SEQUENCES, heroicAnimKey, heroicSheetKey, heroicSheetPath,
  HEROIC_FRAME_W, HEROIC_FRAME_H,
} from '../data/heroicMotions';

const W = 540;
const H = 960;
const BG = 0x080706;

/** 'idle' = 일러스트 living idle, 그 외 = heroic 무공 skillId */
type MotionId = string;

const CHAR_NAME: Record<string, string> = {
  sword_male: '검객',
  sword_female: '여검객',
  dao_male: '도객',
  dao_female: '여도객',
  fist_male: '권사',
  fist_female: '여권사',
  spear_male: '창객',
  spear_female: '여창객',
};

/**
 * MotionGalleryScene - 고품질 모션 갤러리
 *
 * 실제 인게임에서 사용하는 고품질 에셋을 감상하는 씬:
 * - Living Idle: 고품질 일러스트 + 수학 기반 호흡/무게중심 모션 (전투 대기와 동일)
 * - Heroic 무공: 캐릭터별 12프레임 고품질 풀모션 시퀀스 (전투 시전 연출과 동일)
 */
export class MotionGalleryScene extends Phaser.Scene {
  private selectedCharId: string = 'sword_male';
  private currentMotion: MotionId = 'idle';
  private motionSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null = null;
  private idleTween: Phaser.Tweens.Tween | null = null;
  private previewSprite!: Phaser.GameObjects.Image;
  private charLabel!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private motionButtons: Phaser.GameObjects.Text[] = [];
  private loadingSeq = 0; // 캐릭터 전환 중 지연 로딩 완료 콜백 무효화용

  constructor() {
    super({ key: 'MotionGalleryScene' });
  }

  create(data?: { characterId?: string }): void {
    this.cameras.main.setBackgroundColor(BG);

    this.add.image(W / 2, H / 2, 'background_main')
      .setDisplaySize(W, H)
      .setAlpha(0.25);

    this.add.text(W / 2, 35, '고품질 모션 갤러리', {
      fontFamily: 'serif', fontSize: '28px', color: '#e8c36a', fontStyle: 'bold',
      stroke: '#1a0d03', strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(W / 2, 62, '전투에서 실제로 재생되는 고품질 일러스트 모션', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#a38e6a'
    }).setOrigin(0.5);

    this.createCharacterSelector();

    this.previewSprite = this.add.image(W / 2, 190, `hero_${this.selectedCharId}`)
      .setDisplaySize(150, 150)
      .setAlpha(0.9);

    this.charLabel = this.add.text(W / 2, 272, '', {
      fontFamily: 'serif', fontSize: '18px', color: '#e8c36a', fontStyle: 'bold'
    }).setOrigin(0.5);

    // 재생 패널
    this.add.rectangle(W / 2, 500, 440, 380, 0x14100c, 0.85)
      .setStrokeStyle(1, 0x3a2f1f);

    this.infoText = this.add.text(W / 2, 712, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#d8cfbd',
      align: 'center', wordWrap: { width: 480 }
    }).setOrigin(0.5);

    const backBtn = this.add.text(50, H - 30, '← 캐릭터 선택으로', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#d4a74e'
    }).setInteractive({ useHandCursor: true }).setOrigin(0, 0.5);
    backBtn.on('pointerdown', () => {
      this.stopCurrentMotion();
      this.scene.start('CharacterSelectScene');
    });

    const initial = data?.characterId && CHARACTER_LIST.some(c => c.id === data.characterId)
      ? data.characterId : 'sword_male';
    this.selectCharacter(initial);

    // keyboard support (desktop)
    this.input.keyboard?.on('keydown-ESC', () => {
      this.stopCurrentMotion();
      this.scene.start('CharacterSelectScene');
    });
    this.input.keyboard?.on('keydown-LEFT', () => {
      const idx = CHARACTER_LIST.findIndex(c => c.id === this.selectedCharId);
      const prev = CHARACTER_LIST[(idx - 1 + CHARACTER_LIST.length) % CHARACTER_LIST.length];
      this.selectCharacter(prev.id);
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      const idx = CHARACTER_LIST.findIndex(c => c.id === this.selectedCharId);
      const next = CHARACTER_LIST[(idx + 1) % CHARACTER_LIST.length];
      this.selectCharacter(next.id);
    });
  }

  private createCharacterSelector(): void {
    const startX = 60;
    const y = 100;
    const spacing = 60;

    CHARACTER_LIST.forEach((char, i) => {
      const x = startX + i * spacing;
      const btn = this.add.text(x, y, CHAR_NAME[char.id] || char.nameEn, {
        fontFamily: 'serif', fontSize: '13px', color: '#c9a46b',
        backgroundColor: '#1f1812', padding: { x: 6, y: 3 }
      })
        .setInteractive({ useHandCursor: true })
        .setOrigin(0.5);

      btn.on('pointerdown', () => {
        this.selectCharacter(char.id);
      });

      (btn as unknown as { charId: string }).charId = char.id;
    });
  }

  private selectCharacter(charId: string): void {
    this.selectedCharId = charId;
    this.loadingSeq++;
    this.stopCurrentMotion();

    this.previewSprite.setTexture(`hero_${charId}`);
    this.charLabel.setText(CHAR_NAME[charId] || charId);

    // 캐릭터 버튼 하이라이트
    this.children.list.forEach(child => {
      const c = child as Phaser.GameObjects.Text & { charId?: string };
      if (c instanceof Phaser.GameObjects.Text && c.charId) {
        if (c.charId === charId) {
          c.setColor('#e8c36a');
          c.setStyle({ backgroundColor: '#3a2f1f' });
        } else {
          c.setColor('#c9a46b');
          c.setStyle({ backgroundColor: '#1f1812' });
        }
      }
    });

    this.rebuildMotionButtons();
    this.playMotion('idle');
  }

  /** 캐릭터별 모션 버튼: Living Idle + 보유 heroic 무공들 */
  private rebuildMotionButtons(): void {
    this.motionButtons.forEach(b => b.destroy());
    this.motionButtons = [];

    const motions: { id: MotionId; label: string }[] = [
      { id: 'idle', label: 'Living Idle' },
      ...HEROIC_MOTION_SEQUENCES
        .filter(seq => seq.characterId === this.selectedCharId)
        .map(seq => ({
          id: seq.skillId,
          label: SKILL_DATABASE.get(seq.skillId)?.nameKo ?? seq.skillId,
        })),
    ];

    const y = 755;
    const btnWidth = 108;
    const startX = (W - motions.length * btnWidth) / 2 + btnWidth / 2;

    motions.forEach((motion, i) => {
      const x = startX + i * btnWidth;
      const btn = this.add.text(x, y, motion.label, {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#d6c7a7',
        backgroundColor: '#2b1d0c', padding: { x: 8, y: 6 },
        align: 'center'
      })
        .setInteractive({ useHandCursor: true })
        .setOrigin(0.5);

      (btn as unknown as { motionId: MotionId }).motionId = motion.id;
      btn.on('pointerdown', () => this.playMotion(motion.id));
      this.motionButtons.push(btn);
    });
  }

  private highlightMotionButton(motion: MotionId): void {
    this.motionButtons.forEach(btn => {
      const id = (btn as unknown as { motionId: MotionId }).motionId;
      if (id === motion) {
        btn.setColor('#e8c36a');
        btn.setStyle({ backgroundColor: '#4a3a1f' });
      } else {
        btn.setColor('#d6c7a7');
        btn.setStyle({ backgroundColor: '#2b1d0c' });
      }
    });
  }

  private playMotion(motion: MotionId): void {
    this.currentMotion = motion;
    this.stopCurrentMotion();
    this.highlightMotionButton(motion);

    if (motion === 'idle') {
      this.playLivingIdle();
      return;
    }
    this.playHeroicSequence(motion);
  }

  /** 전투 대기와 동일한 일러스트 + 호흡/무게중심 모션 */
  private playLivingIdle(): void {
    const img = this.add.image(W / 2, 500, `hero_${this.selectedCharId}`);
    // 원본 비율 유지하며 패널에 맞춤
    const maxH = 330;
    const ratio = img.width > 0 ? img.height / img.width : 1;
    img.setDisplaySize(maxH / Math.max(1, ratio), maxH);
    this.motionSprite = img;

    const baseScaleX = img.scaleX;
    const baseScaleY = img.scaleY;
    this.idleTween = this.tweens.add({
      targets: img,
      y: 500 - 5,
      scaleX: baseScaleX * 1.012,
      scaleY: baseScaleY * 1.012,
      angle: 0.8,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.infoText.setText('살아있는 대기 모션 — 호흡, 무게 중심 이동 (전투 대기와 동일한 연출)');
  }

  /** 전투 시전과 동일한 heroic 12프레임 고품질 풀모션 */
  private playHeroicSequence(skillId: string): void {
    const charId = this.selectedCharId;
    const seq = HEROIC_MOTION_SEQUENCES.find(s => s.characterId === charId && s.skillId === skillId);
    if (!seq) {
      this.infoText.setText('이 모션은 현재 준비 중입니다. 다른 모션을 선택해 주세요.');
      return;
    }

    const sheetKey = heroicSheetKey(charId, skillId);
    const animKey = heroicAnimKey(charId, skillId);
    const mySeq = ++this.loadingSeq;

    const start = () => {
      // 캐릭터/모션이 이미 전환됐으면 무시
      if (mySeq !== this.loadingSeq || this.currentMotion !== skillId) return;
      if (!this.anims.exists(animKey)) {
        if (!this.textures.exists(sheetKey)) return;
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: seq.frameCount - 1 }),
          frameRate: 14,
          repeat: -1,
        });
      }
      const displayH = 350;
      const displayW = displayH * (HEROIC_FRAME_W / HEROIC_FRAME_H);
      const sprite = this.add.sprite(W / 2, 500, sheetKey, 0);
      sprite.setDisplaySize(displayW, displayH);
      sprite.play(animKey);
      this.motionSprite = sprite;

      const skill = SKILL_DATABASE.get(skillId);
      this.infoText.setText(
        `${skill?.nameKo ?? skillId} — 12프레임 고품질 풀모션 (전투에서 무공 시전 시 재생)`
      );
    };

    if (this.textures.exists(sheetKey)) {
      start();
      return;
    }

    this.infoText.setText('고품질 모션 로딩 중...');
    this.load.spritesheet(sheetKey, heroicSheetPath(charId, skillId), {
      frameWidth: seq.frameWidth, frameHeight: seq.frameHeight,
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, start);
    this.load.start();
  }

  private stopCurrentMotion(): void {
    if (this.idleTween) {
      this.idleTween.stop();
      this.idleTween = null;
    }
    if (this.motionSprite) {
      this.motionSprite.destroy();
      this.motionSprite = null;
    }
  }

  shutdown(): void {
    this.stopCurrentMotion();
  }
}
