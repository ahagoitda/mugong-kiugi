import Phaser from 'phaser';
import { CHARACTER_LIST } from '../data/characters';
import { loadGame, saveGame } from '../systems/SaveSystem';

/**
 * CharacterSelectScene - 캐릭터 선택 화면
 *
 * 게임 시작 전 8캐릭터(4계열 x 남녀) 중 하나를 선택합니다.
 * 선택한 캐릭터는 SaveData에 저장되어 이후 세션에서도 유지됩니다.
 *
 * 레이아웃 (360 x 640):
 * ┌─────────────────────┐
 * │    무공키우기 제목     │  40px
 * │  캐릭터를 선택하세요   │  30px
 * ├─────────────────────┤
 * │  [캐릭터 미리보기]    │  200px (선택된 캐릭터 큰 스프라이트)
 * │  이름 + 설명          │
 * ├─────────────────────┤
 * │  ◀ [카드1][카드2]... ▶│  200px (가로 스크롤 카드 목록)
 * ├─────────────────────┤
 * │    [게임 시작] 버튼    │  80px
 * └─────────────────────┘
 */

const GAME_W = 360;
const GAME_H = 640;

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private previewSprite: Phaser.GameObjects.Sprite | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private descText: Phaser.GameObjects.Text | null = null;
  private statsText: Phaser.GameObjects.Text | null = null;
  private cardSprites: Phaser.GameObjects.Sprite[] = [];
  private cardBorders: Phaser.GameObjects.Rectangle[] = [];
  private classLabel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    // 배경
    this.cameras.main.setBackgroundColor('#0d0d1a');

    // 제목
    this.add.text(GAME_W / 2, 30, '무공키우기', {
      fontSize: '24px',
      color: '#ffd740',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 58, '캐릭터를 선택하세요', {
      fontSize: '12px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 구분선
    const line1 = this.add.graphics();
    line1.lineStyle(1, 0x444444);
    line1.lineBetween(20, 75, GAME_W - 20, 75);

    // ─── 미리보기 영역 (중앙) ───
    this.previewSprite = this.add.sprite(GAME_W / 2, 170, 'sword_male_idle')
      .setScale(1.5);

    this.classLabel = this.add.text(GAME_W / 2, 105, '검법', {
      fontSize: '10px',
      color: '#4fc3f7',
      fontFamily: 'monospace',
      backgroundColor: '#1a3a5c',
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5);

    this.nameText = this.add.text(GAME_W / 2, 250, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.descText = this.add.text(GAME_W / 2, 275, '', {
      fontSize: '10px',
      color: '#cccccc',
      fontFamily: 'monospace',
      wordWrap: { width: 300 },
      align: 'center',
    }).setOrigin(0.5, 0);

    this.statsText = this.add.text(GAME_W / 2, 320, '', {
      fontSize: '10px',
      color: '#88ff88',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5, 0);

    // 구분선
    const line2 = this.add.graphics();
    line2.lineStyle(1, 0x444444);
    line2.lineBetween(20, 365, GAME_W - 20, 365);

    // ─── 카드 목록 (하단) ───
    this.createCardGrid();

    // ─── 게임 시작 버튼 ───
    this.createStartButton();

    // ─── 좌우 화살표 ───
    const leftArrow = this.add.text(15, 170, '◀', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const rightArrow = this.add.text(GAME_W - 15, 170, '▶', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    leftArrow.on('pointerdown', () => this.changeSelection(-1));
    rightArrow.on('pointerdown', () => this.changeSelection(1));

    // 키보드 입력
    this.input.keyboard?.on('keydown-LEFT', () => this.changeSelection(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changeSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());

    // 기존 세이브에서 캐릭터 복원
    const save = loadGame();
    if (save.selectedCharacter) {
      const idx = CHARACTER_LIST.findIndex(c => c.id === save.selectedCharacter);
      if (idx >= 0) this.selectedIndex = idx;
    }

    // 초기 선택 표시
    this.updateSelection();
  }

  /**
   * 캐릭터 카드 그리드를 생성합니다.
   * 4x2 그리드 (4계열 x 2성별)
   */
  private createCardGrid(): void {
    const startX = 30;
    const startY = 385;
    const cardW = 68;
    const cardH = 80;
    const gapX = 8;
    const gapY = 8;
    const cols = 4;

    CHARACTER_LIST.forEach((char, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cx = startX + col * (cardW + gapX) + cardW / 2;
      const cy = startY + row * (cardH + gapY) + cardH / 2;

      // 카드 배경
      const border = this.add.rectangle(cx, cy, cardW, cardH, 0x222244)
        .setStrokeStyle(2, 0x444466)
        .setInteractive({ useHandCursor: true });

      border.on('pointerdown', () => {
        this.selectedIndex = index;
        this.updateSelection();
      });

      this.cardBorders.push(border);

      // 캐릭터 미니 스프라이트
      const spriteKey = `${char.spritePrefix}_idle`;
      const sprite = this.add.sprite(cx, cy - 8, spriteKey)
        .setScale(0.4);

      // idle 애니메이션 재생
      const animKey = `${char.spritePrefix}-idle`;
      if (this.anims.exists(animKey)) {
        sprite.play(animKey);
      }

      this.cardSprites.push(sprite);

      // 캐릭터 이름 (카드 하단)
      this.add.text(cx, cy + 30, char.nameKo, {
        fontSize: '8px',
        color: '#cccccc',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
    });
  }

  /**
   * 게임 시작 버튼을 생성합니다.
   */
  private createStartButton(): void {
    const btnY = GAME_H - 35;
    const btn = this.add.rectangle(GAME_W / 2, btnY, 200, 40, 0xcc6600)
      .setStrokeStyle(2, 0xff8800)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(GAME_W / 2, btnY, '⚔ 게임 시작 ⚔', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.setFillStyle(0xff8800);
    });
    btn.on('pointerout', () => {
      btn.setFillStyle(0xcc6600);
    });
    btn.on('pointerdown', () => {
      btnText.setText('시작 중...');
      this.startGame();
    });
  }

  /**
   * 선택 변경 (좌우 화살표)
   */
  private changeSelection(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + CHARACTER_LIST.length) % CHARACTER_LIST.length;
    this.updateSelection();
  }

  /**
   * 선택된 캐릭터에 맞게 UI를 업데이트합니다.
   */
  private updateSelection(): void {
    const char = CHARACTER_LIST[this.selectedIndex];

    // 미리보기 스프라이트 변경
    if (this.previewSprite) {
      const idleKey = `${char.spritePrefix}_idle`;
      this.previewSprite.setTexture(idleKey);
      const animKey = `${char.spritePrefix}-idle`;
      if (this.anims.exists(animKey)) {
        this.previewSprite.play(animKey);
      }
    }

    // 텍스트 업데이트
    if (this.nameText) this.nameText.setText(char.nameKo);
    if (this.descText) this.descText.setText(char.description);

    // 계열 라벨
    const classNames: Record<string, string> = {
      SWORD: '검법', BLADE: '도법', FIST: '권법', SPEAR: '창법',
    };
    const classColors: Record<string, string> = {
      SWORD: '#4fc3f7', BLADE: '#ff7043', FIST: '#ffd740', SPEAR: '#66bb6a',
    };
    if (this.classLabel) {
      this.classLabel.setText(classNames[char.charClass] ?? '');
      this.classLabel.setColor(classColors[char.charClass] ?? '#ffffff');
    }

    // 스탯 표시
    if (this.statsText) {
      const s = char.stats;
      const bar = (val: number): string => {
        // 스탯 배율이 1.0을 초과(예: 1.3)하면 filled가 5를 넘어
        // '░'.repeat(음수)로 RangeError가 발생하므로 0~5로 클램프한다.
        const filled = Math.max(0, Math.min(5, Math.round(val * 5)));
        return '█'.repeat(filled) + '░'.repeat(5 - filled);
      };
      this.statsText.setText(
        `체력 ${bar(s.hpMul)}  기력 ${bar(s.staminaMul)}\n` +
        `속도 ${bar(s.speedMul)}  공격 ${bar(s.damageMul)}`
      );
    }

    // 카드 테두리 하이라이트
    this.cardBorders.forEach((border, i) => {
      if (i === this.selectedIndex) {
        border.setStrokeStyle(3, 0xffd740);
        border.setFillStyle(0x333366);
      } else {
        border.setStrokeStyle(2, 0x444466);
        border.setFillStyle(0x222244);
      }
    });
  }

  /**
   * 게임 시작: 선택한 캐릭터를 세이브에 저장하고 BattleScene으로 전환
   */
  private startGame(): void {
    const char = CHARACTER_LIST[this.selectedIndex];

    // 세이브에 선택한 캐릭터 저장
    const save = loadGame();
    save.selectedCharacter = char.id;
    saveGame(save);

    // BattleScene과 UIScene을 시작하며 선택한 캐릭터 ID를 전달
    this.scene.start('BattleScene', { characterId: char.id });
    this.scene.start('UIScene', { characterId: char.id });
  }
}
