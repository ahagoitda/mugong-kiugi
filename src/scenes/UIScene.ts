import Phaser from 'phaser';
import { SKILL_DATABASE, SYNTHESIS_RECIPES, GRADE_COLORS } from '../data/skills';
import { BOSS_RANK_NAMES, BOSS_RANK_COLORS } from '../data/enemies';
import { soundSystem } from '../systems/SoundSystem';
import { claimOfflineReward, loadGame, saveGame } from '../systems/SaveSystem';
import { CHARACTER_MAP, type CharacterClass } from '../data/characters';
import type { SkillData, SynthesisRecipe } from '../data/types';

const GAME_W = 360;
const GAME_H = 640;
const UI_Y = 384;
const UI_H = GAME_H - UI_Y;
const BAR_W = 108;
const BTN_SIZE = 50;

type TabType = 'NONE' | 'SKILLS' | 'SYNTH' | 'UPGRADE' | 'BOSS';

interface PlayerStatePayload {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  skills: { id: string; nameKo: string; cooldownRemaining: number; cooldown: number }[];
  dashCooldownRemaining: number;
  dashCooldown: number;
  killCount: number;
  waveNumber: number;
  battleMode: string;
  isBossWave: boolean;
  gold: number;
  level: number;
  exp: number;
  expToNext: number;
}

export class UIScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Rectangle;
  private spBar!: Phaser.GameObjects.Rectangle;
  private expBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private modeBtn!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;

  private skillLabels: Phaser.GameObjects.Text[] = [];
  private skillBgs: Phaser.GameObjects.Rectangle[] = [];
  private cooldownOverlays: Phaser.GameObjects.Rectangle[] = [];
  private cooldownTexts: Phaser.GameObjects.Text[] = [];
  private dashCooldownOverlay: Phaser.GameObjects.Rectangle | null = null;
  private dashCooldownText: Phaser.GameObjects.Text | null = null;

  private currentTab: TabType = 'NONE';
  private tabContent: Phaser.GameObjects.Container | null = null;
  private notifText!: Phaser.GameObjects.Text;
  private charClass: CharacterClass = 'SWORD';

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: { characterId?: string }): void {
    if (data?.characterId) {
      this.charClass = CHARACTER_MAP.get(data.characterId)?.charClass ?? 'SWORD';
    }
  }

  create(): void {
    this.add.rectangle(GAME_W / 2, UI_Y + UI_H / 2, GAME_W, UI_H, 0x101018);
    this.add.rectangle(GAME_W / 2, UI_Y, GAME_W, 2, 0xc98b2e).setOrigin(0.5, 0);

    this.createStatusBar();
    this.createSkillButtons();
    this.createTabs();
    this.createNotification();
    this.claimOffline();

    const battleScene = this.scene.get('BattleScene');
    battleScene.events.on('player-state', this.updateHUD, this);
    battleScene.events.on('wave-clear', this.showWaveClear, this);
    battleScene.events.on('boss-clear', this.showBossClear, this);
    battleScene.events.on('item-drop', this.showDropNotif, this);
    battleScene.events.on('level-up', this.showLevelUp, this);
  }

  private createStatusBar(): void {
    const y = UI_Y + 10;
    this.add.rectangle(10 + BAR_W / 2, y, BAR_W, 8, 0x2a2a32);
    this.hpBar = this.add.rectangle(10, y, BAR_W, 8, 0xd94a3a).setOrigin(0, 0.5);
    this.hpText = this.add.text(10 + BAR_W + 5, y, '100/100', {
      fontSize: '8px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    this.add.rectangle(10 + BAR_W / 2, y + 11, BAR_W, 8, 0x2a2a32);
    this.spBar = this.add.rectangle(10, y + 11, BAR_W, 8, 0x4a84d9).setOrigin(0, 0.5);

    this.add.rectangle(10 + BAR_W / 2, y + 22, BAR_W, 6, 0x202024);
    this.expBar = this.add.rectangle(10, y + 22, 0, 6, 0x72c05b).setOrigin(0, 0.5);

    this.levelText = this.add.text(10 + BAR_W + 5, y + 22, 'Lv.1', {
      fontSize: '8px', color: '#72c05b', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.waveText = this.add.text(GAME_W / 2, y, '1파', {
      fontSize: '10px', color: '#ffd56a', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.killText = this.add.text(GAME_W / 2, y + 14, '처치 0', {
      fontSize: '8px', color: '#b8b8c8', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.goldText = this.add.text(GAME_W - 10, y, '0 G', {
      fontSize: '10px', color: '#ffd56a', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    this.modeBtn = this.add.text(GAME_W - 10, y + 14, '자동', {
      fontSize: '9px', color: '#8cff9b', fontFamily: 'monospace',
      backgroundColor: '#1d2c22', padding: { x: 8, y: 3 },
    }).setOrigin(1, 0.5).setInteractive();
    this.modeBtn.on('pointerdown', () => this.scene.get('BattleScene').events.emit('toggle-battle-mode'));

    this.muteBtn = this.add.text(GAME_W - 10, y + 29, soundSystem.muted ? '음소거' : '소리', {
      fontSize: '8px', color: '#b8b8c8', fontFamily: 'monospace',
      backgroundColor: '#20202a', padding: { x: 6, y: 2 },
    }).setOrigin(1, 0.5).setInteractive();
    this.muteBtn.on('pointerdown', () => {
      soundSystem.toggleMute();
      this.muteBtn.setText(soundSystem.muted ? '음소거' : '소리');
    });
  }

  private createSkillButtons(): void {
    const y = UI_Y + 64;
    const gap = 12;
    const startX = (GAME_W - BTN_SIZE * 4 - gap * 3) / 2 + BTN_SIZE / 2;

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (BTN_SIZE + gap);
      const bg = this.add.rectangle(0, 0, BTN_SIZE, BTN_SIZE, 0x1a2235).setStrokeStyle(2, 0x5f82d6);
      const num = this.add.text(-20, -21, `${i + 1}`, { fontSize: '8px', color: '#9eb9ff', fontFamily: 'monospace' }).setOrigin(0);
      const label = this.add.text(0, -2, '-', {
        fontSize: '9px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
        align: 'center', wordWrap: { width: BTN_SIZE - 8 },
      }).setOrigin(0.5);
      const overlay = this.add.rectangle(0, BTN_SIZE / 2 - 2, BTN_SIZE - 4, BTN_SIZE - 4, 0x000000, 0.65)
        .setOrigin(0.5, 1).setVisible(false);
      const coolText = this.add.text(0, 0, '', {
        fontSize: '12px', color: '#ffd56a', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setVisible(false);

      const c = this.add.container(x, y, [bg, num, label, overlay, coolText]).setSize(BTN_SIZE, BTN_SIZE).setInteractive();
      c.on('pointerdown', () => this.scene.get('BattleScene').events.emit('use-skill', i));

      this.skillBgs.push(bg);
      this.skillLabels.push(label);
      this.cooldownOverlays.push(overlay);
      this.cooldownTexts.push(coolText);
    }

    const dashX = startX + 3 * (BTN_SIZE + gap);
    const dashBg = this.add.rectangle(0, 0, BTN_SIZE, BTN_SIZE, 0x351c1c).setStrokeStyle(2, 0xd45b4b);
    const dashLabel = this.add.text(0, -3, '회피', {
      fontSize: '11px', color: '#ffb0a6', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    const overlay = this.add.rectangle(0, BTN_SIZE / 2 - 2, BTN_SIZE - 4, BTN_SIZE - 4, 0x000000, 0.65)
      .setOrigin(0.5, 1).setVisible(false);
    const coolText = this.add.text(0, 0, '', {
      fontSize: '12px', color: '#ffd56a', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    const c = this.add.container(dashX, y, [dashBg, dashLabel, overlay, coolText]).setSize(BTN_SIZE, BTN_SIZE).setInteractive();
    c.on('pointerdown', () => this.scene.get('BattleScene').events.emit('use-dash'));
    this.dashCooldownOverlay = overlay;
    this.dashCooldownText = coolText;
  }

  private createTabs(): void {
    const tabs: { label: string; type: TabType }[] = [
      { label: '무공', type: 'SKILLS' },
      { label: '합성', type: 'SYNTH' },
      { label: '강화', type: 'UPGRADE' },
      { label: '보스', type: 'BOSS' },
    ];
    const y = UI_Y + 113;
    const w = 76;
    const startX = GAME_W / 2 - (tabs.length * w) / 2 + w / 2;

    tabs.forEach((tab, i) => {
      const x = startX + i * w;
      const btn = this.add.text(x, y, tab.label, {
        fontSize: '11px', color: '#f0c36a', fontFamily: 'monospace', fontStyle: 'bold',
        backgroundColor: '#211b13', padding: { x: 12, y: 5 },
      }).setOrigin(0.5).setInteractive();
      btn.on('pointerdown', () => this.currentTab === tab.type ? this.closeTab() : this.openTab(tab.type));
    });
  }

  private createNotification(): void {
    this.notifText = this.add.text(GAME_W / 2, UI_Y + 136, '', {
      fontSize: '9px', color: '#ffd56a', fontFamily: 'monospace',
      backgroundColor: '#000000dd', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setAlpha(0).setDepth(200);
  }

  private claimOffline(): void {
    const reward = claimOfflineReward();
    if (reward.minutes > 0) {
      this.showNotif(`오프라인 ${reward.minutes}분 보상: ${reward.gold}G / ${reward.exp}EXP`);
    }
  }

  private openTab(tab: TabType): void {
    this.closeTab();
    this.currentTab = tab;
    const items: Phaser.GameObjects.GameObject[] = [];
    const top = UI_Y + 130;
    const bg = this.add.rectangle(GAME_W / 2, top + 62, GAME_W - 12, 124, 0x0b0b12, 0.96)
      .setStrokeStyle(1, 0x49351c);
    items.push(bg);

    const save = loadGame();
    if (tab === 'SKILLS') this.buildSkillTab(items, top + 10, save);
    if (tab === 'SYNTH') this.buildSynthTab(items, top + 10, save);
    if (tab === 'UPGRADE') this.buildUpgradeTab(items, top + 10, save);
    if (tab === 'BOSS') this.buildBossTab(items, top + 10, save);

    this.tabContent = this.add.container(0, 0, items);
  }

  private closeTab(): void {
    this.tabContent?.destroy(true);
    this.tabContent = null;
    this.currentTab = 'NONE';
  }

  private buildSkillTab(items: Phaser.GameObjects.GameObject[], y: number, save: ReturnType<typeof loadGame>): void {
    const skills = this.availableOwnedSkills(save).slice(0, 4);
    this.addTitle(items, '보유 무공', y);
    y += 18;
    skills.forEach((skill, i) => {
      this.addSkillCard(items, 12 + i * 84, y, 78, skill, save, () => this.equipSkillToSlot(skill.id, i % 3));
    });
  }

  private buildSynthTab(items: Phaser.GameObjects.GameObject[], y: number, save: ReturnType<typeof loadGame>): void {
    this.addTitle(items, `합성 가능 ${save.gold}G`, y);
    const allBtn = this.add.text(GAME_W - 52, y, '일괄', {
      fontSize: '9px', color: '#ffd56a', fontFamily: 'monospace',
      backgroundColor: '#3a2812', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive();
    allBtn.on('pointerdown', () => this.performAllSynthesis());
    items.push(allBtn);
    y += 18;

    const recipes = this.availableRecipes(save).slice(0, 3);
    recipes.forEach((recipe, i) => {
      const result = SKILL_DATABASE.get(recipe.result);
      if (!result) return;
      const x = 12 + i * 112;
      this.addRecipeCard(items, x, y, 104, recipe, result);
    });
  }

  private buildUpgradeTab(items: Phaser.GameObjects.GameObject[], y: number, save: ReturnType<typeof loadGame>): void {
    this.addTitle(items, `강화 ${save.gold}G`, y);
    y += 18;
    this.availableOwnedSkills(save).slice(0, 4).forEach((skill, i) => {
      this.addUpgradeCard(items, 12 + i * 84, y, 78, skill, save);
    });
  }

  private buildBossTab(items: Phaser.GameObjects.GameObject[], y: number, save: ReturnType<typeof loadGame>): void {
    this.addTitle(items, '보스 돌파', y);
    y += 18;
    const bosses = [
      ['boss_daeju', 'DAEJU', 5],
      ['boss_danju', 'DANJU', 10],
      ['boss_gakju', 'GAKJU', 15],
      ['boss_magun', 'MAGUN', 20],
    ] as const;
    bosses.forEach((boss, i) => {
      const [id, rank, wave] = boss;
      const done = save.defeatedBosses?.includes(id);
      const color = BOSS_RANK_COLORS[rank] ?? 0xffffff;
      const x = 12 + i * 84;
      const card = this.add.rectangle(x, y, 78, 70, done ? 0x1d2b1d : 0x161620).setOrigin(0, 0)
        .setStrokeStyle(1, done ? color : 0x393946);
      const rankText = this.add.text(x + 8, y + 8, BOSS_RANK_NAMES[rank] ?? rank, {
        fontSize: '8px', color: `#${color.toString(16).padStart(6, '0')}`, fontFamily: 'monospace',
      });
      const waveText = this.add.text(x + 8, y + 28, `${wave}파`, {
        fontSize: '13px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      });
      const stateText = this.add.text(x + 8, y + 50, done ? '격파' : '대기', {
        fontSize: '9px', color: done ? '#8cff9b' : '#777788', fontFamily: 'monospace',
      });
      items.push(card, rankText, waveText, stateText);
    });
  }

  private addTitle(items: Phaser.GameObjects.GameObject[], text: string, y: number): void {
    const title = this.add.text(14, y, text, {
      fontSize: '11px', color: '#f0c36a', fontFamily: 'monospace', fontStyle: 'bold',
    });
    items.push(title);
  }

  private addSkillCard(
    items: Phaser.GameObjects.GameObject[],
    x: number,
    y: number,
    w: number,
    skill: SkillData,
    save: ReturnType<typeof loadGame>,
    onTap: () => void,
  ): void {
    const level = save.skillLevels?.[skill.id] ?? 0;
    const color = GRADE_COLORS[skill.grade] ?? 0xffffff;
    const card = this.add.rectangle(x, y, w, 72, 0x171722).setOrigin(0, 0).setStrokeStyle(1, color).setInteractive();
    card.on('pointerdown', onTap);
    const name = this.add.text(x + 6, y + 7, skill.nameKo, {
      fontSize: '8px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: w - 12 },
    });
    const meta = this.add.text(x + 6, y + 34, `x${save.inventory[skill.id] ?? 0}  +${level}`, {
      fontSize: '9px', color: '#ffd56a', fontFamily: 'monospace',
    });
    const dmg = this.add.text(x + 6, y + 52, `피해 x${skill.damageMultiplier}`, {
      fontSize: '7px', color: '#b8b8c8', fontFamily: 'monospace',
    });
    items.push(card, name, meta, dmg);
  }

  private addRecipeCard(
    items: Phaser.GameObjects.GameObject[],
    x: number,
    y: number,
    w: number,
    recipe: SynthesisRecipe,
    result: SkillData,
  ): void {
    const color = GRADE_COLORS[result.grade] ?? 0xffffff;
    const card = this.add.rectangle(x, y, w, 72, 0x171722).setOrigin(0, 0).setStrokeStyle(1, color).setInteractive();
    card.on('pointerdown', () => this.performSynthesis(recipe.material1, recipe.material2, recipe.result, recipe.goldCost));
    const title = this.add.text(x + 7, y + 7, result.nameKo, {
      fontSize: '8px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: w - 14 },
    });
    const cost = this.add.text(x + 7, y + 42, `${recipe.goldCost}G`, {
      fontSize: '10px', color: '#ffd56a', fontFamily: 'monospace',
    });
    const hint = this.add.text(x + 7, y + 57, '터치 합성', {
      fontSize: '7px', color: '#9aa0b8', fontFamily: 'monospace',
    });
    items.push(card, title, cost, hint);
  }

  private addUpgradeCard(
    items: Phaser.GameObjects.GameObject[],
    x: number,
    y: number,
    w: number,
    skill: SkillData,
    save: ReturnType<typeof loadGame>,
  ): void {
    const level = save.skillLevels?.[skill.id] ?? 0;
    const maxLevel = skill.maxLevel ?? 20;
    const gold = this.upgradeGoldCost(skill, level);
    const shards = this.upgradeShardCost(skill, level);
    const can = level < maxLevel && save.gold >= gold && (save.inventory[skill.id] ?? 0) > shards;
    const color = GRADE_COLORS[skill.grade] ?? 0xffffff;
    const card = this.add.rectangle(x, y, w, 72, can ? 0x1d2418 : 0x171722).setOrigin(0, 0)
      .setStrokeStyle(1, can ? color : 0x34343f).setInteractive();
    card.on('pointerdown', () => this.upgradeSkill(skill.id));
    const name = this.add.text(x + 6, y + 7, skill.nameKo, {
      fontSize: '8px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: w - 12 },
    });
    const lvl = this.add.text(x + 6, y + 34, `+${level}/${maxLevel}`, {
      fontSize: '10px', color: '#ffd56a', fontFamily: 'monospace',
    });
    const cost = this.add.text(x + 6, y + 53, `${gold}G / x${shards}`, {
      fontSize: '7px', color: can ? '#8cff9b' : '#777788', fontFamily: 'monospace',
    });
    items.push(card, name, lvl, cost);
  }

  private availableOwnedSkills(save: ReturnType<typeof loadGame>): SkillData[] {
    return Array.from(SKILL_DATABASE.values())
      .filter(s => s.type === 'ACTIVE' && s.category === this.charClass)
      .filter(s => (save.inventory[s.id] ?? 0) > 0 || save.unlockedSkills.includes(s.id))
      .sort((a, b) => (save.skillLevels?.[b.id] ?? 0) - (save.skillLevels?.[a.id] ?? 0));
  }

  private availableRecipes(save: ReturnType<typeof loadGame>): SynthesisRecipe[] {
    return [...SYNTHESIS_RECIPES]
      .filter(r => {
        const result = SKILL_DATABASE.get(r.result);
        if (!result || result.category !== this.charClass) return false;
        const c1 = save.inventory[r.material1] ?? 0;
        const c2 = save.inventory[r.material2] ?? 0;
        const mats = r.material1 === r.material2 ? c1 >= 2 : c1 >= 1 && c2 >= 1;
        return mats && save.gold >= r.goldCost;
      })
      .sort((a, b) => a.goldCost - b.goldCost);
  }

  private performAllSynthesis(): void {
    let count = 0;
    for (let i = 0; i < 12; i++) {
      const save = loadGame();
      const recipe = this.availableRecipes(save)[0];
      if (!recipe) break;
      if (this.applySynthesis(recipe)) count++;
    }
    this.showNotif(count > 0 ? `${count}회 합성 완료` : '가능한 합성이 없습니다');
    this.openTab('SYNTH');
  }

  private performSynthesis(mat1Id: string, mat2Id: string, resultId: string, goldCost: number): void {
    const ok = this.applySynthesis({ material1: mat1Id, material2: mat2Id, result: resultId, goldCost });
    this.showNotif(ok ? `${SKILL_DATABASE.get(resultId)?.nameKo ?? resultId} 획득` : '재료 또는 골드 부족');
    this.openTab('SYNTH');
  }

  private applySynthesis(recipe: SynthesisRecipe): boolean {
    const save = loadGame();
    if (save.gold < recipe.goldCost) return false;
    const c1 = save.inventory[recipe.material1] ?? 0;
    const c2 = save.inventory[recipe.material2] ?? 0;
    if (recipe.material1 === recipe.material2) {
      if (c1 < 2) return false;
      save.inventory[recipe.material1] = c1 - 2;
    } else {
      if (c1 < 1 || c2 < 1) return false;
      save.inventory[recipe.material1] = c1 - 1;
      save.inventory[recipe.material2] = c2 - 1;
    }
    save.gold -= recipe.goldCost;
    save.inventory[recipe.result] = (save.inventory[recipe.result] ?? 0) + 1;
    if (!save.unlockedSkills.includes(recipe.result)) save.unlockedSkills.push(recipe.result);
    saveGame(save);
    soundSystem.play('synth_ok');
    return true;
  }

  private upgradeSkill(skillId: string): void {
    const skill = SKILL_DATABASE.get(skillId);
    if (!skill) return;
    const save = loadGame();
    if (!save.skillLevels) save.skillLevels = {};
    const level = save.skillLevels[skillId] ?? 0;
    const maxLevel = skill.maxLevel ?? 20;
    const gold = this.upgradeGoldCost(skill, level);
    const shards = this.upgradeShardCost(skill, level);
    if (level >= maxLevel || save.gold < gold || (save.inventory[skillId] ?? 0) <= shards) {
      this.showNotif('강화 재료 부족');
      return;
    }
    save.gold -= gold;
    save.inventory[skillId] -= shards;
    save.skillLevels[skillId] = level + 1;
    saveGame(save);
    soundSystem.play('equip');
    this.showNotif(`${skill.nameKo} +${level + 1}`);
    this.openTab('UPGRADE');
  }

  private upgradeGoldCost(skill: SkillData, level: number): number {
    return Math.round((skill.upgradeGoldBase ?? 40) * (1 + level * 0.32));
  }

  private upgradeShardCost(skill: SkillData, level: number): number {
    return Math.max(1, (skill.upgradeShardBase ?? 1) + Math.floor(level / 10));
  }

  private equipSkillToSlot(skillId: string, slotIndex: number): void {
    const save = loadGame();
    while (save.equippedSkills.length <= slotIndex) save.equippedSkills.push(skillId);
    save.equippedSkills[slotIndex] = skillId;
    saveGame(save);
    soundSystem.play('equip');
    this.scene.get('BattleScene').events.emit('equip-changed');
    this.showNotif(`${slotIndex + 1}번 슬롯 장착`);
    this.openTab('SKILLS');
  }

  private updateHUD(state: PlayerStatePayload): void {
    this.hpBar.width = BAR_W * Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1);
    this.spBar.width = BAR_W * Phaser.Math.Clamp(state.stamina / state.maxStamina, 0, 1);
    this.expBar.width = BAR_W * Phaser.Math.Clamp(state.exp / state.expToNext, 0, 1);
    this.hpText.setText(`${Math.ceil(state.hp)}/${state.maxHp}`);
    this.levelText.setText(`Lv.${state.level}`);
    this.goldText.setText(`${state.gold} G`);
    this.waveText.setText(`${state.isBossWave ? '보스 ' : ''}${state.waveNumber}파`);
    this.waveText.setColor(state.isBossWave ? '#ff6b57' : '#ffd56a');
    this.killText.setText(`처치 ${state.killCount}`);
    this.modeBtn.setText(state.battleMode === 'AUTO' ? '자동' : '수동');

    state.skills.forEach((skill, i) => {
      if (!this.skillLabels[i]) return;
      this.skillLabels[i].setText(skill.nameKo);
      const overlay = this.cooldownOverlays[i];
      const coolText = this.cooldownTexts[i];
      if (skill.cooldownRemaining > 0 && skill.cooldown > 0) {
        const ratio = Phaser.Math.Clamp(skill.cooldownRemaining / skill.cooldown, 0, 1);
        overlay.setVisible(true);
        overlay.height = (BTN_SIZE - 4) * ratio;
        coolText.setVisible(true).setText((skill.cooldownRemaining / 1000).toFixed(1));
        this.skillBgs[i].setStrokeStyle(2, 0x666666);
      } else {
        overlay.setVisible(false);
        coolText.setVisible(false);
        this.skillBgs[i].setStrokeStyle(2, 0x5f82d6);
      }
    });

    if (this.dashCooldownOverlay && this.dashCooldownText) {
      if (state.dashCooldownRemaining > 0 && state.dashCooldown > 0) {
        const ratio = Phaser.Math.Clamp(state.dashCooldownRemaining / state.dashCooldown, 0, 1);
        this.dashCooldownOverlay.setVisible(true);
        this.dashCooldownOverlay.height = (BTN_SIZE - 4) * ratio;
        this.dashCooldownText.setVisible(true).setText((state.dashCooldownRemaining / 1000).toFixed(1));
      } else {
        this.dashCooldownOverlay.setVisible(false);
        this.dashCooldownText.setVisible(false);
      }
    }
  }

  private showNotif(msg: string): void {
    this.notifText.setText(msg);
    this.notifText.setAlpha(1);
    this.tweens.add({ targets: this.notifText, alpha: 0, duration: 1800, delay: 700 });
  }

  private showWaveClear(wave: number): void {
    this.showNotif(`${wave}파 돌파`);
  }

  private showBossClear(wave: number): void {
    this.showNotif(`보스 격파: ${wave}파`);
  }

  private showDropNotif(_skillId: string, nameKo: string): void {
    this.showNotif(`무공 획득: ${nameKo}`);
  }

  private showLevelUp(level: number): void {
    this.showNotif(`레벨 상승: ${level}`);
  }
}
