import Phaser from 'phaser';
import { CHARACTER_LIST } from '../data/characters';

const W = 540;
const H = 960;
const BG = 0x080706;

type MotionType = 'idle' | 'run' | 'heavy' | 'quick' | 'thrust' | 'dynamic';

const MOTION_LABELS: Record<MotionType, string> = {
  idle: 'Idle (생동감 대기)',
  run: 'Run (가벼운 달리기)',
  heavy: 'Heavy Attack (무거운 일격)',
  quick: 'Quick Attack (빠른 연타)',
  thrust: 'Thrust Attack (찌르기)',
  dynamic: 'Dynamic Combat (자동사냥 동작)',
};

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

export class MotionGalleryScene extends Phaser.Scene {
  private selectedCharId: string = 'sword_male';
  private currentVideo: Phaser.GameObjects.Video | null = null;
  private currentMotion: MotionType = 'idle';
  private videoContainer!: Phaser.GameObjects.Container;
  private previewSprite!: Phaser.GameObjects.Image;
  private charLabel!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private motionButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'MotionGalleryScene' });
  }

  create(data?: { characterId?: string }): void {
    this.cameras.main.setBackgroundColor(BG);

    // subtle bg
    this.add.image(W / 2, H / 2, 'background_main')
      .setDisplaySize(W, H)
      .setAlpha(0.25);

    // title
    this.add.text(W / 2, 35, '고품질 모션 갤러리', {
      fontFamily: 'serif', fontSize: '28px', color: '#e8c36a', fontStyle: 'bold',
      stroke: '#1a0d03', strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(W / 2, 62, 'High-Quality Motion References (Hollow Knight inspired)', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#a38e6a'
    }).setOrigin(0.5);

    // character selector with preview
    this.createCharacterSelector();

    // character preview sprite (high quality reference feel)
    this.previewSprite = this.add.image(W / 2, 200, `hero_${this.selectedCharId}`)
      .setDisplaySize(180, 180)
      .setAlpha(0.9);

    // current char label under preview
    this.charLabel = this.add.text(W / 2, 295, '', {
      fontFamily: 'serif', fontSize: '18px', color: '#e8c36a', fontStyle: 'bold'
    }).setOrigin(0.5);

    // video area panel (improved UI)
    this.add.rectangle(W / 2, 380 + 140, 440, 300, 0x14100c, 0.85)
      .setStrokeStyle(1, 0x3a2f1f);
    this.videoContainer = this.add.container(W / 2, 380);

    // info text below video panel
    this.infoText = this.add.text(W / 2, 680, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#d8cfbd',
      align: 'center', wordWrap: { width: 480 }
    }).setOrigin(0.5);

    // motion buttons
    this.createMotionButtons();

    // back button
    const backBtn = this.add.text(50, H - 30, '← 캐릭터 선택으로', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#d4a74e'
    }).setInteractive().setOrigin(0, 0.5);
    backBtn.on('pointerdown', () => {
      this.stopCurrentVideo();
      this.scene.start('CharacterSelectScene');
    });

    // initial with passed character or default
    const initial = data?.characterId && CHARACTER_LIST.some(c => c.id === data.characterId) ? data.characterId : 'sword_male';
    this.selectCharacter(initial);
    this.playMotion('idle');

    // keyboard support for gallery (desktop/Windows)
    this.input.keyboard?.on('keydown-ESC', () => {
      this.stopCurrentVideo();
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
    const y = 110;
    const spacing = 55;

    CHARACTER_LIST.forEach((char, i) => {
      const x = startX + i * spacing;
      const btn = this.add.text(x, y, CHAR_NAME[char.id] || char.nameEn, {
        fontFamily: 'serif', fontSize: '13px', color: '#c9a46b',
        backgroundColor: '#1f1812', padding: { x: 6, y: 3 }
      })
        .setInteractive()
        .setOrigin(0.5);

      btn.on('pointerdown', () => {
        this.selectCharacter(char.id);
      });

      // highlight on select later
      (btn as any).charId = char.id;
    });
  }

  private selectCharacter(charId: string): void {
    this.selectedCharId = charId;
    this.stopCurrentVideo();

    // update preview sprite
    if (this.previewSprite) {
      this.previewSprite.setTexture(`hero_${charId}`);
    }
    if (this.charLabel) {
      this.charLabel.setText(CHAR_NAME[charId] || charId);
    }

    // update buttons highlight (simple)
    this.children.list.forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && (child as any).charId) {
        if ((child as any).charId === charId) {
          child.setColor('#e8c36a');
          child.setStyle({ backgroundColor: '#3a2f1f' });
        } else {
          child.setColor('#c9a46b');
          child.setStyle({ backgroundColor: '#1f1812' });
        }
      }
    });

    // play current motion or default idle
    this.playMotion(this.currentMotion || 'idle');
  }

  private createMotionButtons(): void {
    const motions: MotionType[] = ['idle', 'run', 'heavy', 'quick', 'thrust', 'dynamic'];
    const y = 730;
    const btnWidth = 78;
    const startX = (W - (motions.length * btnWidth)) / 2 + btnWidth / 2;

    this.motionButtons = [];

    motions.forEach((motion, i) => {
      const x = startX + i * btnWidth;
      const btn = this.add.text(x, y, MOTION_LABELS[motion], {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#d6c7a7',
        backgroundColor: '#2b1d0c', padding: { x: 5, y: 4 },
        align: 'center'
      })
        .setInteractive()
        .setOrigin(0.5)
        .setFixedSize(btnWidth - 4, 32);

      btn.on('pointerdown', () => {
        this.playMotion(motion);
      });

      this.motionButtons.push(btn);
    });
  }

  private playMotion(motion: MotionType): void {
    this.currentMotion = motion;
    this.stopCurrentVideo();

    const charId = this.selectedCharId;
    const fileName = this.getVideoFileName(charId, motion);

    if (!fileName) {
      this.showNoVideoMessage(motion);
      return;
    }

    const key = `motion_${charId}_${motion}`;

    // highlight active button
    this.motionButtons.forEach((btn, idx) => {
      const m = (['idle', 'run', 'heavy', 'quick', 'thrust', 'dynamic'] as MotionType[])[idx];
      if (m === motion) {
        btn.setColor('#e8c36a');
        btn.setStyle({ backgroundColor: '#4a3a1f' });
      } else {
        btn.setColor('#d6c7a7');
        btn.setStyle({ backgroundColor: '#2b1d0c' });
      }
    });

    const loadAndPlay = () => {
      const video = this.add.video(W / 2, 0, key);
      video.setDisplaySize(420, 280);
      video.setOrigin(0.5, 0);

      this.videoContainer.add(video);
      this.currentVideo = video;

      // play (loop for idle/run, once for attacks)
      const shouldLoop = motion === 'idle' || motion === 'run';
      video.play(shouldLoop);

      this.infoText.setText(this.getMotionDescription(motion));
    };

    if (this.cache.video.exists(key)) {
      loadAndPlay();
    } else {
      this.infoText.setText('로딩 중...');
      this.load.video(key, `demo-videos/characters/${fileName}`);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        loadAndPlay();
      });
      this.load.start();
    }
  }

  private getVideoFileName(charId: string, motion: MotionType): string | null {
    // Map based on what we actually generated
    const map: Partial<Record<string, Partial<Record<MotionType, string>>>> = {
      'sword_male': {
        idle: 'sword_male_idle.mp4',
        run: 'sword_male_run.mp4',
        heavy: 'sword_male_heavy_attack.mp4',
        quick: 'sword_male_quick_attack.mp4',
        thrust: 'sword_male_thrust_attack.mp4',
        dynamic: 'sword_male_dynamic_combat.mp4',
      },
      'sword_female': {
        idle: 'sword_female_idle.mp4',
        run: 'sword_female_run.mp4',
        heavy: 'sword_female_heavy_attack.mp4',
        dynamic: 'sword_female_dynamic_combat.mp4',
      },
      'dao_male': {
        idle: 'dao_male_idle.mp4',
        run: 'dao_male_run.mp4',
        heavy: 'dao_male_heavy_attack.mp4',
        dynamic: 'dao_male_dynamic_combat.mp4',
      },
      'dao_female': {
        idle: 'dao_female_idle.mp4',
        run: 'dao_female_run.mp4',
        heavy: 'dao_female_heavy_attack.mp4',
      },
      'fist_male': {
        idle: 'fist_male_idle.mp4',
        run: 'fist_male_run.mp4',
        heavy: 'fist_male_heavy_attack.mp4',
      },
      'fist_female': {
        idle: 'fist_female_idle.mp4',
        run: 'fist_female_run.mp4',
        heavy: 'fist_female_heavy_attack.mp4',
      },
      'spear_male': {
        idle: 'spear_male_idle.mp4',
        run: 'spear_male_run.mp4',
        heavy: 'spear_male_heavy_attack.mp4',
      },
      'spear_female': {
        idle: 'spear_female_idle.mp4',
        run: 'spear_female_run.mp4',
        heavy: 'spear_female_heavy_attack.mp4',
      },
    };

    const charMap = map[charId];
    if (!charMap) return null;
    return charMap[motion] || null;
  }

  private getMotionDescription(motion: MotionType): string {
    const descriptions: Record<MotionType, string> = {
      idle: '살아있는 대기 모션 — 호흡, 무게 중심 이동, 2차 동작 (망토/무기)',
      run: '무게감 있는 주행 — 발먼지, 옷의 흐름, 자연스러운 모멘텀',
      heavy: '무거운 일격 — 긴 윈드업 → 폭발적 커밋 → 긴 리커버리 (Hollow Knight 스타일)',
      quick: '빠른 연타 — 가볍고 날카로운 움직임',
      thrust: '찌르기 — 정밀하고 강한 전진 공격',
      dynamic: '자동사냥 동작 — 접근 → 공격 → 후퇴의 유기적 흐름',
    };
    return descriptions[motion] || '';
  }

  private showNoVideoMessage(motion: MotionType): void {
    this.infoText.setText(`${MOTION_LABELS[motion]} 모션은 현재 이 캐릭터에 대해 준비 중입니다.\n다른 모션을 선택해 주세요.`);
    // optionally show a static image or text placeholder
  }

  private stopCurrentVideo(): void {
    if (this.currentVideo) {
      this.currentVideo.stop();
      this.currentVideo.destroy();
      this.currentVideo = null;
    }
    // clear container children
    this.videoContainer.removeAll(true);
  }

  shutdown(): void {
    this.stopCurrentVideo();
  }
}
