import Phaser from 'phaser';
import { SKILL_DATABASE, SYNTHESIS_RECIPES, GRADE_COLORS } from '../data/skills';
import { loadGame, saveGame } from '../systems/SaveSystem';

/**
 * UIScene - 하단 무공 관리 UI (화면 하단 40%)
 *
 * 레이아웃 (360 x 256, y=384부터 시작):
 * ┌─────────────────────────────────────┐ y=384
 * │ [HP바] [SP바]  [웨이브] [자동/수동]  │ 상태 바
 * ├─────────────────────────────────────┤ y=420
 * │                                     │
 * │  [무공1] [무공2] [무공3]  [회피]     │ 장착 슬롯
 * │                                     │
 * ├─────────────────────────────────────┤ y=480
 * │                                     │
 * │  [도감]  [합성]  [장착변경]          │ 메뉴 탭
 * │                                     │
 * │  (선택된 탭의 내용 표시)             │
 * │                                     │
 * └─────────────────────────────────────┘ y=640
 *
 * BattleScene과 이벤트로 통신합니다.
 */

const GAME_W = 360;
const GAME_H = 640;
const BATTLE_H = 384;
const UI_H = GAME_H - BATTLE_H; // 256
const UI_Y = BATTLE_H;

const BAR_W = 100;
const BAR_H = 6;
const BTN_SIZE = 40;

interface PlayerStatePayload {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  skills: { id: string; nameKo: string; cooldownRemaining: number; cooldown: number }[];
  killCount: number;
  waveNumber: number;
  battleMode: string;
}

type TabType = 'NONE' | 'CODEX' | 'SYNTH' | 'EQUIP';

export class UIScene extends Phaser.Scene {
  // HUD
  private hpBar!: Phaser.GameObjects.Rectangle;
  private spBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private modeBtn!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;

  // 스킬 슬롯
  private skillSlots: Phaser.GameObjects.Container[] = [];
  private skillLabels: Phaser.GameObjects.Text[] = [];
  private cooldownBars: Phaser.GameObjects.Rectangle[] = [];

  // 탭 시스템
  private currentTab: TabType = 'NONE';
  private tabContent: Phaser.GameObjects.Container | null = null;

  // 알림
  private notifText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // UI 영역 배경
    this.add.rectangle(GAME_W / 2, UI_Y + UI_H / 2, GAME_W, UI_H, 0x0f0f1a)
      .setStrokeStyle(1, 0x333366);

    // 구분선
    this.add.rectangle(GAME_W / 2, UI_Y, GAME_W, 2, 0x4fc3f7).setOrigin(0.5, 0);

    this.createStatusBar();
    this.createSkillSlots();
    this.createMenuTabs();
    this.createNotification();

    // BattleScene 이벤트 리스닝
    const battleScene = this.scene.get('BattleScene');
    battleScene.events.on('player-state', this.updateHUD, this);
    battleScene.events.on('wave-clear', this.showWaveClear, this);
    battleScene.events.on('item-drop', this.showDropNotif, this);
  }

  // ─── 상태 바 (y=384~420) ───

  private createStatusBar(): void {
    const barY = UI_Y + 12;

    // HP
    this.add.rectangle(10 + BAR_W / 2, barY, BAR_W, BAR_H, 0x333333);
    this.hpBar = this.add.rectangle(10, barY, BAR_W, BAR_H, 0xff4444).setOrigin(0, 0.5);
    this.hpText = this.add.text(10 + BAR_W + 4, barY, '100/100', {
      fontSize: '7px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // SP
    const spY = barY + 12;
    this.add.rectangle(10 + BAR_W / 2, spY, BAR_W, BAR_H, 0x333333);
    this.spBar = this.add.rectangle(10, spY, BAR_W, BAR_H, 0x4488ff).setOrigin(0, 0.5);

    // 웨이브
    this.waveText = this.add.text(GAME_W / 2, barY, '제 1파', {
      fontSize: '9px', color: '#ffd740', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 처치 수
    this.killText = this.add.text(GAME_W / 2, spY, '처치: 0', {
      fontSize: '7px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 자동/수동 버튼
    this.modeBtn = this.add.text(GAME_W - 10, barY + 4, '⚔ 자동', {
      fontSize: '9px', color: '#88ff88', fontFamily: 'monospace',
      backgroundColor: '#222244',
      padding: { x: 6, y: 3 },
    }).setOrigin(1, 0.5).setInteractive();

    this.modeBtn.on('pointerdown', () => {
      const battleScene = this.scene.get('BattleScene');
      battleScene.events.emit('toggle-battle-mode');
    });
  }

  // ─── 무공 장착 슬롯 (y=420~480) ───

  private createSkillSlots(): void {
    const slotY = UI_Y + 52;
    const startX = 30;
    const gap = BTN_SIZE + 12;

    for (let i = 0; i < 3; i++) {
      const x = startX + i * gap;

      const bg = this.add.rectangle(0, 0, BTN_SIZE, BTN_SIZE, 0x1a1a3a)
        .setStrokeStyle(1, 0x4466aa);
      const label = this.add.text(0, -2, `${i + 1}`, {
        fontSize: '8px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const nameLabel = this.add.text(0, 10, '-', {
        fontSize: '7px', color: '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const coolBar = this.add.rectangle(0, BTN_SIZE / 2 - 2, BTN_SIZE - 4, 3, 0x4fc3f7)
        .setOrigin(0.5, 0.5).setVisible(false);

      const container = this.add.container(x, slotY, [bg, label, nameLabel, coolBar]);
      container.setSize(BTN_SIZE, BTN_SIZE);
      container.setInteractive();

      const slotIndex = i;
      container.on('pointerdown', () => {
        const battleScene = this.scene.get('BattleScene');
        battleScene.events.emit('use-skill', slotIndex);
      });

      this.skillSlots.push(container);
      this.skillLabels.push(nameLabel);
      this.cooldownBars.push(coolBar);
    }

    // 회피 버튼
    const dashX = startX + 3 * gap + 10;
    const dashBg = this.add.rectangle(0, 0, BTN_SIZE, BTN_SIZE, 0x2a1a1a)
      .setStrokeStyle(1, 0xaa4444);
    const dashLabel = this.add.text(0, 0, '회피', {
      fontSize: '8px', color: '#ff8888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const dashContainer = this.add.container(dashX, slotY, [dashBg, dashLabel]);
    dashContainer.setSize(BTN_SIZE, BTN_SIZE);
    dashContainer.setInteractive();
    dashContainer.on('pointerdown', () => {
      const battleScene = this.scene.get('BattleScene');
      battleScene.events.emit('use-dash');
    });
  }

  // ─── 메뉴 탭 (y=480~640) ───

  private createMenuTabs(): void {
    const tabY = UI_Y + 90;
    const tabs: { label: string; type: TabType }[] = [
      { label: '도감', type: 'CODEX' },
      { label: '합성', type: 'SYNTH' },
      { label: '장착', type: 'EQUIP' },
    ];

    const tabW = 60;
    const startX = GAME_W / 2 - (tabs.length * tabW) / 2 + tabW / 2;

    tabs.forEach((tab, i) => {
      const x = startX + i * tabW;
      const btn = this.add.text(x, tabY, tab.label, {
        fontSize: '10px', color: '#4fc3f7', fontFamily: 'monospace',
        backgroundColor: '#1a1a3a',
        padding: { x: 10, y: 4 },
      }).setOrigin(0.5).setInteractive();

      btn.on('pointerdown', () => {
        if (this.currentTab === tab.type) {
          this.closeTab();
        } else {
          this.openTab(tab.type);
        }
      });
    });
  }

  // ─── 알림 ───

  private createNotification(): void {
    this.notifText = this.add.text(GAME_W / 2, UI_Y + 108, '', {
      fontSize: '9px', color: '#ffd740', fontFamily: 'monospace',
      backgroundColor: '#000000cc',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setAlpha(0);
  }

  // ─── HUD 업데이트 ───

  private updateHUD(state: PlayerStatePayload): void {
    // HP
    this.hpBar.width = BAR_W * (state.hp / state.maxHp);
    this.hpText.setText(`${Math.ceil(state.hp)}/${state.maxHp}`);

    // SP
    this.spBar.width = BAR_W * (state.stamina / state.maxStamina);

    // 웨이브
    this.waveText.setText(`제 ${state.waveNumber}파`);
    this.killText.setText(`처치: ${state.killCount}`);

    // 모드
    this.modeBtn.setText(state.battleMode === 'AUTO' ? '⚔ 자동' : '🗡 수동');
    this.modeBtn.setColor(state.battleMode === 'AUTO' ? '#88ff88' : '#ffaa88');

    // 스킬 슬롯
    state.skills.forEach((skill, i) => {
      if (i < this.skillLabels.length) {
        this.skillLabels[i].setText(skill.nameKo.substring(0, 3));

        const coolBar = this.cooldownBars[i];
        if (skill.cooldownRemaining > 0) {
          coolBar.setVisible(true);
          const ratio = 1 - (skill.cooldownRemaining / skill.cooldown);
          coolBar.width = (BTN_SIZE - 4) * ratio;
        } else {
          coolBar.setVisible(false);
        }
      }
    });
  }

  // ─── 탭 콘텐츠 ───

  private openTab(tab: TabType): void {
    this.closeTab();
    this.currentTab = tab;

    const contentY = UI_Y + 120;
    const contentH = GAME_H - contentY - 8;
    const items: Phaser.GameObjects.GameObject[] = [];

    // 배경
    const bg = this.add.rectangle(GAME_W / 2, contentY + contentH / 2, GAME_W - 16, contentH, 0x0a0a1a, 0.95)
      .setStrokeStyle(1, 0x333366);
    items.push(bg);

    const save = loadGame();

    switch (tab) {
      case 'CODEX':
        this.buildCodexTab(items, contentY + 12, save);
        break;
      case 'SYNTH':
        this.buildSynthTab(items, contentY + 12, save);
        break;
      case 'EQUIP':
        this.buildEquipTab(items, contentY + 12, save);
        break;
    }

    this.tabContent = this.add.container(0, 0, items);
  }

  private closeTab(): void {
    if (this.tabContent) {
      this.tabContent.destroy(true);
      this.tabContent = null;
    }
    this.currentTab = 'NONE';
  }

  /** 도감 탭: 보유 비급 목록 */
  private buildCodexTab(
    items: Phaser.GameObjects.GameObject[],
    startY: number,
    save: ReturnType<typeof loadGame>,
  ): void {
    let y = startY;
    const allSkills = Array.from(SKILL_DATABASE.values()).filter(s => s.type === 'ACTIVE');

    for (const skill of allSkills) {
      const count = save.inventory[skill.id] ?? 0;
      const unlocked = save.unlockedSkills.includes(skill.id);
      const gradeColor = GRADE_COLORS[skill.grade] ?? 0xffffff;

      const dot = this.add.rectangle(20, y, 6, 6, gradeColor);
      const name = this.add.text(30, y, skill.nameKo, {
        fontSize: '8px',
        color: unlocked ? '#ffffff' : '#444444',
        fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      const qty = this.add.text(GAME_W - 60, y, `x${count}`, {
        fontSize: '8px',
        color: count > 0 ? '#ffd740' : '#444444',
        fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      const grade = this.add.text(GAME_W - 30, y, skill.grade[0], {
        fontSize: '7px', color: `#${gradeColor.toString(16).padStart(6, '0')}`,
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      items.push(dot, name, qty, grade);
      y += 18;
    }
  }

  /** 합성 탭: 합성 레시피 + 실행 버튼 */
  private buildSynthTab(
    items: Phaser.GameObjects.GameObject[],
    startY: number,
    save: ReturnType<typeof loadGame>,
  ): void {
    let y = startY;

    const title = this.add.text(GAME_W / 2, y, '비급 합성', {
      fontSize: '10px', color: '#4fc3f7', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    items.push(title);
    y += 20;

    for (const recipe of SYNTHESIS_RECIPES) {
      const mat1 = SKILL_DATABASE.get(recipe.material1);
      const mat2 = SKILL_DATABASE.get(recipe.material2);
      const result = SKILL_DATABASE.get(recipe.result);
      if (!mat1 || !mat2 || !result) continue;

      const count1 = save.inventory[recipe.material1] ?? 0;
      const count2 = save.inventory[recipe.material2] ?? 0;
      const canSynth = recipe.material1 === recipe.material2
        ? count1 >= 2
        : count1 >= 1 && count2 >= 1;

      const text = this.add.text(16, y,
        `${mat1.nameKo}(${count1}) + ${mat2.nameKo}(${count2}) → ${result.nameKo}`, {
        fontSize: '7px',
        color: canSynth ? '#ffffff' : '#555555',
        fontFamily: 'monospace',
      });
      items.push(text);

      if (canSynth) {
        const btn = this.add.text(GAME_W - 30, y + 4, '합성', {
          fontSize: '8px', color: '#ffd740', fontFamily: 'monospace',
          backgroundColor: '#332211',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setInteractive();

        btn.on('pointerdown', () => {
          this.performSynthesis(recipe.material1, recipe.material2, recipe.result);
        });
        items.push(btn);
      }

      y += 20;
    }
  }

  /** 장착 탭: 무공 장착 변경 */
  private buildEquipTab(
    items: Phaser.GameObjects.GameObject[],
    startY: number,
    save: ReturnType<typeof loadGame>,
  ): void {
    let y = startY;

    const title = this.add.text(GAME_W / 2, y, '무공 장착', {
      fontSize: '10px', color: '#4fc3f7', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    items.push(title);
    y += 20;

    // 현재 장착 표시
    const equipped = this.add.text(16, y, `장착중: ${save.equippedSkills.join(', ')}`, {
      fontSize: '7px', color: '#88ff88', fontFamily: 'monospace',
    });
    items.push(equipped);
    y += 18;

    // 장착 가능한 무공 목록
    const availableSkills = save.unlockedSkills
      .map(id => SKILL_DATABASE.get(id))
      .filter(s => s && s.type === 'ACTIVE');

    for (const skill of availableSkills) {
      if (!skill) continue;
      const count = save.inventory[skill.id] ?? 0;
      if (count <= 0) continue;

      const isEquipped = save.equippedSkills.includes(skill.id);
      const gradeColor = GRADE_COLORS[skill.grade] ?? 0xffffff;

      const dot = this.add.rectangle(20, y, 6, 6, gradeColor);
      const name = this.add.text(30, y, `${skill.nameKo} (x${count})`, {
        fontSize: '8px',
        color: isEquipped ? '#88ff88' : '#ffffff',
        fontFamily: 'monospace',
      }).setOrigin(0, 0.5);

      items.push(dot, name);

      if (!isEquipped) {
        const btn = this.add.text(GAME_W - 30, y, '장착', {
          fontSize: '8px', color: '#4fc3f7', fontFamily: 'monospace',
          backgroundColor: '#1a1a3a',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setInteractive();

        btn.on('pointerdown', () => {
          this.equipSkill(skill.id);
        });
        items.push(btn);
      }

      y += 18;
    }
  }

  // ─── 합성 실행 ───

  private performSynthesis(mat1Id: string, mat2Id: string, resultId: string): void {
    const save = loadGame();

    if (mat1Id === mat2Id) {
      if ((save.inventory[mat1Id] ?? 0) < 2) return;
      save.inventory[mat1Id] -= 2;
    } else {
      if ((save.inventory[mat1Id] ?? 0) < 1 || (save.inventory[mat2Id] ?? 0) < 1) return;
      save.inventory[mat1Id] -= 1;
      save.inventory[mat2Id] -= 1;
    }

    save.inventory[resultId] = (save.inventory[resultId] ?? 0) + 1;
    if (!save.unlockedSkills.includes(resultId)) {
      save.unlockedSkills.push(resultId);
    }
    saveGame(save);

    const result = SKILL_DATABASE.get(resultId);
    this.showNotif(`합성 성공! ${result?.nameKo ?? resultId} 획득`);

    // 탭 새로고침
    this.openTab('SYNTH');
  }

  // ─── 장착 ───

  private equipSkill(skillId: string): void {
    const save = loadGame();
    const skills = save.equippedSkills;

    if (skills.includes(skillId)) return;

    if (skills.length < 3) {
      skills.push(skillId);
    } else {
      skills[2] = skillId; // 마지막 슬롯 교체
    }
    saveGame(save);

    const battleScene = this.scene.get('BattleScene');
    battleScene.events.emit('equip-changed');

    this.showNotif(`${SKILL_DATABASE.get(skillId)?.nameKo ?? skillId} 장착!`);
    this.openTab('EQUIP');
  }

  // ─── 알림 표시 ───

  private showNotif(msg: string): void {
    this.notifText.setText(msg);
    this.notifText.setAlpha(1);
    this.tweens.add({
      targets: this.notifText,
      alpha: 0,
      duration: 2000,
      delay: 500,
    });
  }

  private showWaveClear(wave: number): void {
    this.showNotif(`제 ${wave}파 돌파!`);
  }

  private showDropNotif(_skillId: string, nameKo: string): void {
    this.showNotif(`비급 획득: ${nameKo}`);
  }
}
