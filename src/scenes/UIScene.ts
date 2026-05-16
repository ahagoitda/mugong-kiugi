import Phaser from 'phaser';
import { SKILL_DATABASE, SYNTHESIS_RECIPES, GRADE_COLORS } from '../data/skills';
import { BOSS_RANK_NAMES, BOSS_RANK_COLORS } from '../data/enemies';
import { soundSystem } from '../systems/SoundSystem';
import { loadGame, saveGame } from '../systems/SaveSystem';

/**
 * UIScene - 하단 무공 관리 UI (화면 하단 40%)
 *
 * 레이아웃 (360 x 256, y=384부터 시작):
 * ┌─────────────────────────────────────┐ y=384
 * │ [HP바] [SP바]  [Lv/EXP] [Gold]     │ 상태 바
 * │ [웨이브] [처치수]  [자동/수동]       │
 * ├─────────────────────────────────────┤ y=424
 * │  [무공1] [무공2] [무공3]  [회피]     │ 장착 슬롯
 * ├─────────────────────────────────────┤ y=472
 * │  [도감]  [합성]  [장착]  [보스]      │ 메뉴 탭
 * │  (선택된 탭의 내용 표시)             │
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
  isBossWave: boolean;
  gold: number;
  level: number;
  exp: number;
  expToNext: number;
}

type TabType = 'NONE' | 'CODEX' | 'SYNTH' | 'EQUIP' | 'BOSS';

export class UIScene extends Phaser.Scene {
  // HUD
  private hpBar!: Phaser.GameObjects.Rectangle;
  private spBar!: Phaser.GameObjects.Rectangle;
  private expBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private modeBtn!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;

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
    battleScene.events.on('boss-clear', this.showBossClear, this);
    battleScene.events.on('item-drop', this.showDropNotif, this);
    battleScene.events.on('level-up', this.showLevelUp, this);
  }

  // ─── 상태 바 (y=384~424) ───

  private createStatusBar(): void {
    const barY = UI_Y + 10;

    // HP 바
    this.add.rectangle(10 + BAR_W / 2, barY, BAR_W, BAR_H, 0x333333);
    this.hpBar = this.add.rectangle(10, barY, BAR_W, BAR_H, 0xff4444).setOrigin(0, 0.5);
    this.hpText = this.add.text(10 + BAR_W + 4, barY, '100/100', {
      fontSize: '7px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // SP 바
    const spY = barY + 10;
    this.add.rectangle(10 + BAR_W / 2, spY, BAR_W, BAR_H, 0x333333);
    this.spBar = this.add.rectangle(10, spY, BAR_W, BAR_H, 0x4488ff).setOrigin(0, 0.5);

    // EXP 바
    const expY = spY + 10;
    this.add.rectangle(10 + BAR_W / 2, expY, BAR_W, BAR_H - 2, 0x222222);
    this.expBar = this.add.rectangle(10, expY, 0, BAR_H - 2, 0x88cc44).setOrigin(0, 0.5);

    // 레벨 텍스트
    this.levelText = this.add.text(10 + BAR_W + 4, expY, 'Lv.1', {
      fontSize: '7px', color: '#88cc44', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // 골드 표시
    this.goldText = this.add.text(GAME_W - 10, barY, '0 G', {
      fontSize: '9px', color: '#ffd740', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // 웨이브
    this.waveText = this.add.text(GAME_W / 2, barY, '제 1파', {
      fontSize: '9px', color: '#ffd740', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 처치 수
    this.killText = this.add.text(GAME_W / 2, spY, '처치: 0', {
      fontSize: '7px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 자동/수동 버튼
    this.modeBtn = this.add.text(GAME_W - 10, spY, '⚔ 자동', {
      fontSize: '8px', color: '#88ff88', fontFamily: 'monospace',
      backgroundColor: '#222244',
      padding: { x: 4, y: 2 },
    }).setOrigin(1, 0.5).setInteractive();

    this.modeBtn.on('pointerdown', () => {
      const battleScene = this.scene.get('BattleScene');
      battleScene.events.emit('toggle-battle-mode');
    });

    // 음소거 버튼
    this.muteBtn = this.add.text(GAME_W - 10, expY, soundSystem.muted ? '🔇' : '🔊', {
      fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setInteractive();

    this.muteBtn.on('pointerdown', () => {
      soundSystem.toggleMute();
      this.muteBtn.setText(soundSystem.muted ? '🔇' : '🔊');
    });
  }

  // ─── 무공 장착 슬롯 (y=424~472) ───

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

  // ─── 메뉴 탭 (y=472~640) ───

  private createMenuTabs(): void {
    const tabY = UI_Y + 86;
    const tabs: { label: string; type: TabType }[] = [
      { label: '도감', type: 'CODEX' },
      { label: '합성', type: 'SYNTH' },
      { label: '장착', type: 'EQUIP' },
      { label: '혈교', type: 'BOSS' },
    ];

    const tabW = 52;
    const startX = GAME_W / 2 - (tabs.length * tabW) / 2 + tabW / 2;

    tabs.forEach((tab, i) => {
      const x = startX + i * tabW;
      const btn = this.add.text(x, tabY, tab.label, {
        fontSize: '9px', color: '#4fc3f7', fontFamily: 'monospace',
        backgroundColor: '#1a1a3a',
        padding: { x: 8, y: 3 },
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
    this.notifText = this.add.text(GAME_W / 2, UI_Y + 102, '', {
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

    // EXP
    const expRatio = state.expToNext > 0 ? state.exp / state.expToNext : 0;
    this.expBar.width = BAR_W * expRatio;
    this.levelText.setText(`Lv.${state.level}`);

    // 골드
    this.goldText.setText(`${state.gold} G`);

    // 웨이브
    const wavePrefix = state.isBossWave ? '⚠ ' : '';
    this.waveText.setText(`${wavePrefix}제 ${state.waveNumber}파`);
    if (state.isBossWave) {
      this.waveText.setColor('#ff4444');
    } else {
      this.waveText.setColor('#ffd740');
    }
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

    const contentY = UI_Y + 114;
    const contentH = GAME_H - contentY - 4;
    const items: Phaser.GameObjects.GameObject[] = [];

    // 배경
    const bg = this.add.rectangle(GAME_W / 2, contentY + contentH / 2, GAME_W - 12, contentH, 0x0a0a1a, 0.95)
      .setStrokeStyle(1, 0x333366);
    items.push(bg);

    const save = loadGame();

    switch (tab) {
      case 'CODEX':
        this.buildCodexTab(items, contentY + 10, save);
        break;
      case 'SYNTH':
        this.buildSynthTab(items, contentY + 10, save);
        break;
      case 'EQUIP':
        this.buildEquipTab(items, contentY + 10, save);
        break;
      case 'BOSS':
        this.buildBossTab(items, contentY + 10, save);
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

  /** 도감 탭: 보유 비급 목록 + 설명 */
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
      const colorStr = `#${gradeColor.toString(16).padStart(6, '0')}`;

      const dot = this.add.rectangle(20, y, 6, 6, gradeColor);
      const name = this.add.text(30, y, skill.nameKo, {
        fontSize: '8px',
        color: unlocked ? '#ffffff' : '#444444',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const qty = this.add.text(GAME_W - 60, y, `x${count}`, {
        fontSize: '8px',
        color: count > 0 ? '#ffd740' : '#444444',
        fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      const grade = this.add.text(GAME_W - 30, y, skill.grade[0], {
        fontSize: '7px', color: colorStr,
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      items.push(dot, name, qty, grade);

      // 설명 (해금된 무공만)
      if (unlocked && skill.description) {
        y += 12;
        const desc = this.add.text(30, y, skill.description, {
          fontSize: '6px',
          color: '#888888',
          fontFamily: 'monospace',
          wordWrap: { width: GAME_W - 70 },
        }).setOrigin(0, 0.5);
        items.push(desc);
      }

      // 효과 정보
      if (unlocked && skill.effect) {
        y += 10;
        const effectNames: Record<string, string> = {
          BLEED: '출혈', STUN: '기절', SLOW: '둔화', KNOCKBACK: '넉백', SILENCE: '봉인',
        };
        const effectText = `효과: ${effectNames[skill.effect] ?? skill.effect} (${Math.round((skill.effectChance ?? 0) * 100)}%)`;
        const eff = this.add.text(30, y, effectText, {
          fontSize: '6px', color: '#ff8888', fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        items.push(eff);
      }

      y += 16;
    }
  }

  /** 합성 탭: 합성 레시피 + 골드 비용 + 실행 버튼 */
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
    y += 16;

    // 보유 골드 표시
    const goldInfo = this.add.text(GAME_W / 2, y, `보유 골드: ${save.gold} G`, {
      fontSize: '8px', color: '#ffd740', fontFamily: 'monospace',
    }).setOrigin(0.5);
    items.push(goldInfo);
    y += 16;

    for (const recipe of SYNTHESIS_RECIPES) {
      const mat1 = SKILL_DATABASE.get(recipe.material1);
      const mat2 = SKILL_DATABASE.get(recipe.material2);
      const result = SKILL_DATABASE.get(recipe.result);
      if (!mat1 || !mat2 || !result) continue;

      const count1 = save.inventory[recipe.material1] ?? 0;
      const count2 = save.inventory[recipe.material2] ?? 0;
      const hasGold = save.gold >= recipe.goldCost;
      const hasMats = recipe.material1 === recipe.material2
        ? count1 >= 2
        : count1 >= 1 && count2 >= 1;
      const canSynth = hasMats && hasGold;

      const resultColor = GRADE_COLORS[result.grade] ?? 0xffffff;
      const resultColorStr = `#${resultColor.toString(16).padStart(6, '0')}`;

      const text = this.add.text(16, y,
        `${mat1.nameKo}(${count1}) + ${mat2.nameKo}(${count2})`, {
        fontSize: '7px',
        color: hasMats ? '#ffffff' : '#555555',
        fontFamily: 'monospace',
      });
      items.push(text);
      y += 12;

      const arrow = this.add.text(16, y,
        `  → ${result.nameKo}  [${recipe.goldCost}G]`, {
        fontSize: '7px',
        color: canSynth ? resultColorStr : '#555555',
        fontFamily: 'monospace',
      });
      items.push(arrow);

      if (canSynth) {
        const btn = this.add.text(GAME_W - 30, y, '합성', {
          fontSize: '8px', color: '#ffd740', fontFamily: 'monospace',
          backgroundColor: '#332211',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setInteractive();

        btn.on('pointerdown', () => {
          this.performSynthesis(recipe.material1, recipe.material2, recipe.result, recipe.goldCost);
        });
        items.push(btn);
      }

      y += 16;
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
    y += 16;

    // 현재 장착 표시
    const equippedNames = save.equippedSkills.map(id => {
      const s = SKILL_DATABASE.get(id);
      return s ? s.nameKo : id;
    }).join(' / ');
    const equipped = this.add.text(16, y, `장착중: ${equippedNames}`, {
      fontSize: '7px', color: '#88ff88', fontFamily: 'monospace',
    });
    items.push(equipped);
    y += 16;

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

      // 데미지 정보
      const dmgInfo = this.add.text(GAME_W - 80, y, `x${skill.damageMultiplier}`, {
        fontSize: '7px', color: '#ff8888', fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      items.push(dmgInfo);

      if (!isEquipped) {
        // 슬롯 선택 버튼들
        for (let slot = 0; slot < 3; slot++) {
          const btn = this.add.text(GAME_W - 50 + slot * 20, y, `${slot + 1}`, {
            fontSize: '8px', color: '#4fc3f7', fontFamily: 'monospace',
            backgroundColor: '#1a1a3a',
            padding: { x: 3, y: 1 },
          }).setOrigin(0.5).setInteractive();

          btn.on('pointerdown', () => {
            this.equipSkillToSlot(skill.id, slot);
          });
          items.push(btn);
        }
      } else {
        const eqLabel = this.add.text(GAME_W - 30, y, '장착중', {
          fontSize: '7px', color: '#88ff88', fontFamily: 'monospace',
        }).setOrigin(0.5);
        items.push(eqLabel);
      }

      y += 16;
    }
  }

  /** 혈교 탭: 보스 처치 기록 */
  private buildBossTab(
    items: Phaser.GameObjects.GameObject[],
    startY: number,
    save: ReturnType<typeof loadGame>,
  ): void {
    let y = startY;

    const title = this.add.text(GAME_W / 2, y, '혈교 위계도', {
      fontSize: '10px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    items.push(title);
    y += 16;

    const subtitle = this.add.text(GAME_W / 2, y, '처치한 혈교 간부', {
      fontSize: '7px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    items.push(subtitle);
    y += 14;

    const bossList: { id: string; name: string; rank: string; wave: number }[] = [
      { id: 'boss_daeju', name: '냉혈대주', rank: 'DAEJU', wave: 5 },
      { id: 'boss_danju', name: '혈풍단주', rank: 'DANJU', wave: 10 },
      { id: 'boss_gakju', name: '단혼각주', rank: 'GAKJU', wave: 15 },
      { id: 'boss_magun', name: '빙룡마군', rank: 'MAGUN', wave: 20 },
      { id: 'boss_hobup', name: '금강호법', rank: 'HOBUP', wave: 25 },
      { id: 'boss_saja', name: '흑운좌사자', rank: 'SAJA', wave: 30 },
      { id: 'boss_bugyoju', name: '적마부교주', rank: 'BUGYOJU', wave: 40 },
      { id: 'boss_hyeolma', name: '무령혈마', rank: 'HYEOLMA', wave: 50 },
    ];

    const defeated = save.defeatedBosses ?? [];

    for (const boss of bossList) {
      const isDefeated = defeated.includes(boss.id);
      const rankColor = BOSS_RANK_COLORS[boss.rank] ?? 0xffffff;
      const colorStr = `#${rankColor.toString(16).padStart(6, '0')}`;
      const rankName = BOSS_RANK_NAMES[boss.rank] ?? '';

      const dot = this.add.rectangle(20, y, 8, 8, isDefeated ? rankColor : 0x333333);
      const rankLabel = this.add.text(34, y, rankName, {
        fontSize: '7px', color: isDefeated ? colorStr : '#444444',
        fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      const nameLabel = this.add.text(70, y, boss.name, {
        fontSize: '8px',
        color: isDefeated ? '#ffffff' : '#333333',
        fontFamily: 'monospace',
        fontStyle: isDefeated ? 'bold' : 'normal',
      }).setOrigin(0, 0.5);
      const waveLabel = this.add.text(GAME_W - 30, y, `${boss.wave}파`, {
        fontSize: '7px', color: isDefeated ? '#88ff88' : '#333333',
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      // 처치 표시
      if (isDefeated) {
        const check = this.add.text(GAME_W - 60, y, '✓', {
          fontSize: '9px', color: '#88ff88', fontFamily: 'monospace',
        }).setOrigin(0.5);
        items.push(check);
      }

      items.push(dot, rankLabel, nameLabel, waveLabel);
      y += 16;
    }

    // 총 처치 수
    y += 6;
    const totalKills = this.add.text(GAME_W / 2, y, `총 처치: ${save.totalKills ?? 0}`, {
      fontSize: '8px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    items.push(totalKills);
  }

  // ─── 합성 실행 ───

  private performSynthesis(mat1Id: string, mat2Id: string, resultId: string, goldCost: number): void {
    const save = loadGame();

    // 골드 체크
    if (save.gold < goldCost) {
      this.showNotif('골드가 부족합니다!');
      return;
    }

    if (mat1Id === mat2Id) {
      if ((save.inventory[mat1Id] ?? 0) < 2) return;
      save.inventory[mat1Id] -= 2;
    } else {
      if ((save.inventory[mat1Id] ?? 0) < 1 || (save.inventory[mat2Id] ?? 0) < 1) return;
      save.inventory[mat1Id] -= 1;
      save.inventory[mat2Id] -= 1;
    }

    save.gold -= goldCost;
    save.inventory[resultId] = (save.inventory[resultId] ?? 0) + 1;
    if (!save.unlockedSkills.includes(resultId)) {
      save.unlockedSkills.push(resultId);
    }
    saveGame(save);
    soundSystem.play('synth_ok');

    const result = SKILL_DATABASE.get(resultId);
    this.showNotif(`합성 성공! ${result?.nameKo ?? resultId} 획득`);

    // 탭 새로고침
    this.openTab('SYNTH');
  }

  // ─── 장착 (슬롯 지정) ───

  private equipSkillToSlot(skillId: string, slotIndex: number): void {
    const save = loadGame();
    const skills = save.equippedSkills;

    // 배열 크기 보장
    while (skills.length <= slotIndex) {
      skills.push('samjae');
    }

    skills[slotIndex] = skillId;
    saveGame(save);
    soundSystem.play('equip');

    const battleScene = this.scene.get('BattleScene');
    battleScene.events.emit('equip-changed');

    this.showNotif(`${SKILL_DATABASE.get(skillId)?.nameKo ?? skillId} → 슬롯 ${slotIndex + 1} 장착!`);
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

  private showBossClear(wave: number): void {
    this.showNotif(`⚔ 보스 격파! 제 ${wave}파 ⚔`);
  }

  private showDropNotif(_skillId: string, nameKo: string): void {
    this.showNotif(`비급 획득: ${nameKo}`);
  }

  private showLevelUp(level: number): void {
    this.showNotif(`레벨 업! Lv.${level}`);
  }
}
