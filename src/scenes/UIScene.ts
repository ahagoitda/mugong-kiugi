import Phaser from 'phaser';
import { SKILL_DATABASE, SYNTHESIS_RECIPES, getStarterSkill } from '../data/skills';
import { BOSS_RANK_NAMES, BOSS_RANK_COLORS, ENEMY_DATABASE } from '../data/enemies';
import { CHARACTER_MAP, type CharacterClass } from '../data/characters';
import {
  EQUIPMENT_SLOTS, EQUIPMENT_SLOT_NAMES, equipmentScore,
  equippedItems, equipmentSetBonus, dominantSetId,
} from '../data/equipment';
import { skillCardKey } from '../data/assets';
import { claimOfflineReward, loadGame, saveGame, deleteSave } from '../systems/SaveSystem';
import type { EquipmentGrade, EquipmentItem, SkillData } from '../data/types';
import { soundSystem } from '../systems/SoundSystem';
import { bgmSystem } from '../systems/BgmSystem';

const W = 540;
const H = 960;
const GOLD = 0xd4a74e;
const UI = {
  martial: '\uBB34\uACF5',
  synth: '\uD569\uC131',
  upgrade: '\uAC15\uD654',
  boss: '\uBCF4\uC2A4',
  training: '\uC218\uB828',
  equipment: '\uC7A5\uBE44',
  sect: '\uBB38\uD30C',
  codex: '\uB3C4\uAC10',
  manual: '\uC218\uB3D9',
  mission: '\uC784\uBB34',
  secret: '\uBE44\uAE09',
  dash: '\uACBD\uACF5',
  ultimate: '\uC808\uAE30',
  locked: '\uBD09\uC778',
  gold: '\uAE08\uD654',
  gem: '\uC6D0\uBCF4',
  energy: '\uAE30\uC6B4',
  wave: '\uC6E8\uC774\uBE0C',
  acquired: '\uD68D\uB4DD',
  equipped: '\uC7A5\uCC29',
  clear: '\uD074\uB9AC\uC5B4',
  levelUp: '\uACBD\uC9C0 \uC0C1\uC2B9',
  offline: '\uC624\uD504\uB77C\uC778 \uBCF4\uC0C1',
};

type Panel = 'MARTIAL' | 'TRAINING' | 'EQUIPMENT' | 'SECT' | 'CODEX' | 'MISSIONS' | 'SETTINGS' | 'SHOP';
type MartialTab = 'SKILLS' | 'SYNTH' | 'UPGRADE' | 'BOSS';
type EquipmentFilter = 'ALL' | 'SET' | EquipmentGrade;

interface PlayerStatePayload {
  hp: number; maxHp: number; stamina: number; maxStamina: number;
  skills: { id: string; nameKo: string; cooldownRemaining: number; cooldown: number }[];
  dashCooldownRemaining: number; dashCooldown: number;
  killCount: number; waveNumber: number; battleMode: string; isBossWave: boolean;
  gold: number; level: number; exp: number; expToNext: number;
}

function fmtGold(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PANEL_TITLES: Record<Panel, string> = {
  MARTIAL: '무공 관리',
  TRAINING: '수련',
  EQUIPMENT: '장비',
  SECT: '문파',
  CODEX: '도감',
  MISSIONS: '임무',
  SETTINGS: '설정',
  SHOP: '상점',
};

const CLASS_KO: Record<CharacterClass, string> = {
  SWORD: '검법',
  BLADE: '도법',
  FIST: '권법',
  SPEAR: '창법',
};

const GRADE_KO: Record<string, string> = {
  LOW: '하급',
  MID: '중급',
  HIGH: '상급',
  ULTIMATE: '절기',
};

const SKILL_NAME_KO: Record<string, string> = {
  samjae: '삼재검법',
  yukhap: '육합검',
  maehwa: '매화검법',
  cheongpung: '청풍검',
  taegeuk: '태극검법',
  changung: '창궁무애검',
  baldo: '발도술',
  hoengso: '횡소천군',
  gwangpung: '광풍도법',
  byeokryeokdo: '벽력도',
  paewang: '패왕도법',
  cheonma: '천마군림도',
  taejo: '태조장권',
  bunggwon: '붕권',
  yeonhwante: '연환퇴',
  baekbo: '백보신권',
  hangryong: '항룡장',
  yeorae: '여래신장',
  pyeongsa: '평사낙안',
  iljeom: '일점홍',
  hoeseon: '회선창',
  gwansan: '관산월',
  yongchang: '용창구식',
  cheonha: '천하무쌍창',
};

export class UIScene extends Phaser.Scene {
  private charClass: CharacterClass = 'SWORD';
  private martialTab: MartialTab = 'SKILLS';
  private equipmentFilter: EquipmentFilter = 'ALL';
  private overlay: Phaser.GameObjects.Container | null = null;
  private codexTab: 'SKILLS' | 'ENEMIES' | 'BOSSES' = 'SKILLS';
  private missionsTab: 'DAILY' | 'ACHIEVEMENT' = 'DAILY';
  private hpFill!: Phaser.GameObjects.Rectangle;
  private spFill!: Phaser.GameObjects.Rectangle;
  private expFill!: Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private modeButton!: Phaser.GameObjects.Arc;
  private modeGlow!: Phaser.GameObjects.Arc;
  private dashCooldown!: Phaser.GameObjects.Arc;
  private dashCooldownText!: Phaser.GameObjects.Text;
  private skillLabels: Phaser.GameObjects.Text[] = [];
  private skillIcons: Phaser.GameObjects.Image[] = [];
  private cooldowns: Phaser.GameObjects.Arc[] = [];
  private cooldownTexts: Phaser.GameObjects.Text[] = [];
  private progressNodes: Phaser.GameObjects.Arc[] = [];
  private bossNode!: Phaser.GameObjects.Star;
  private notif!: Phaser.GameObjects.Text;
  private portraitImage!: Phaser.GameObjects.Image;
  private shopTab: 'DAILY' | 'SKILLS' | 'GEMS' = 'DAILY';
  private tutorialOverlay: Phaser.GameObjects.Container | null = null;
  private cachedRebirth = 0;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: { characterId?: string }): void {
    this.charClass = CHARACTER_MAP.get(data.characterId ?? '')?.charClass ?? 'SWORD';
  }

  create(): void {
    const battle = this.scene.get('BattleScene');
    battle.events.on('player-state', this.updateHUD, this);
    battle.events.on('wave-clear', (wave: number) => this.showNotice(`${wave} ${UI.wave} ${UI.clear}`), this);
    battle.events.on('boss-clear', (wave: number) => this.showNotice(`${UI.boss} ${UI.clear} · ${wave} ${UI.wave}`), this);
    battle.events.on('item-drop', (id: string) => this.showNotice(`${UI.martial} ${UI.acquired} · ${this.skillLabel(SKILL_DATABASE.get(id))}`), this);
    battle.events.on('level-up', (level: number) => this.showNotice(`${UI.levelUp} · Lv.${level}`), this);

    this.createTopHud();
    this.createTopResourceStrip();
    this.createProgressTrack();
    this.createCombatSkillDockV2();
    this.createQuickMartialBoard();
    this.createBottomNavV2();
    this.notif = this.add.text(W / 2, 560, '', this.textStyle(19, '#ffe29a'))
      .setOrigin(0.5).setDepth(500).setStroke('#000000', 5).setAlpha(0);

    const reward = claimOfflineReward();
    if (reward.minutes > 0) this.showNotice(`${UI.offline} ${reward.minutes}분 · +${fmtGold(reward.gold)}G · +${fmtGold(reward.exp)}EXP`);

    const saveData = loadGame();
    this.cachedRebirth = saveData.rebirthCount ?? 0;
    if (!saveData.tutorialCompleted) {
      this.time.delayedCall(800, () => this.showTutorial(0));
    }
  }

  private createTopHud(): void {
    this.add.rectangle(W / 2, 50, W, 100, 0x080706, 0.9).setDepth(200);
    this.add.rectangle(W / 2, 99, W, 2, 0x916c35, 0.72).setDepth(202);
    this.add.circle(62, 50, 47, 0x070504, 1).setStrokeStyle(2, 0x8b672f).setDepth(201);
    this.add.circle(62, 50, 41, 0x15110c, 1).setStrokeStyle(2, GOLD).setDepth(201);
    
    const save = loadGame();
    const equipped = equippedItems(save.equipmentInventory ?? [], save.equippedItems);
    const dominantSet = dominantSetId(equipped, 4);
    const charId = save.selectedCharacter ?? 'sword_male';
    const portraitKey = dominantSet ? `hero_set_${charId}_${dominantSet}` : `hero_${charId}`;

    this.portraitImage = this.add.image(62, 50, portraitKey).setDisplaySize(82, 82).setDepth(202);
    
    // 무협 느낌의 용/호랑이 테두리 프레임 적용 (여성이면 호랑이, 남성이면 용)
    const frameKey = charId.includes('female') ? 'ui_frame_tiger' : 'ui_frame_dragon';
    this.add.image(62, 50, frameKey).setDisplaySize(84, 84).setDepth(203);
    
    this.add.rectangle(194, 33, 230, 21, 0x070403, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x7d5a2a).setDepth(201);
    this.add.rectangle(194, 58, 202, 15, 0x050708, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x516b82).setDepth(201);
    this.hpFill = this.add.rectangle(198, 33, 220, 13, 0xb82922).setOrigin(0, 0.5).setDepth(202);
    this.spFill = this.add.rectangle(198, 58, 190, 8, 0x218ac4).setOrigin(0, 0.5).setDepth(202);
    this.add.rectangle(198, 27, 220, 3, 0xff7258, 0.38).setOrigin(0, 0.5).setDepth(203);
    this.add.rectangle(198, 54, 190, 2, 0x8ce8ff, 0.38).setOrigin(0, 0.5).setDepth(203);
    this.add.circle(62, 87, 18, 0x120b04, 1).setStrokeStyle(2, GOLD).setDepth(203);
    this.levelText = this.add.text(62, 87, 'Lv.1', this.textStyle(15, '#f2d27d')).setOrigin(0.5).setDepth(204);
    this.goldText = this.add.text(430, 32, '0 금화', this.textStyle(16, '#f2d27d')).setOrigin(0.5).setDepth(203);
    this.waveText = this.add.text(430, 60, '1 웨이브', this.textStyle(15, '#e8dfce')).setOrigin(0.5).setDepth(203);
    this.expFill = this.add.rectangle(0, 99, 0, 2, GOLD).setOrigin(0, 0.5).setDepth(203);
  }

  private createTopResourceStrip(): void {
    const resources = [
      { x: 302, y: 20, icon: '\u25CE', text: UI.gold, color: 0xd4a74e },
      { x: 394, y: 20, icon: '\u25C6', text: UI.gem, color: 0xffc85a },
      { x: 486, y: 20, icon: '\u2726', text: UI.energy, color: 0x55a7ff },
    ];
    resources.forEach(({ x, y, icon, text, color }) => {
      this.add.rectangle(x, y, 82, 24, 0x0b0907, 0.86)
        .setStrokeStyle(1, 0x8d6b32)
        .setDepth(204);
      this.add.text(x - 26, y, icon, this.textStyle(15, `#${color.toString(16).padStart(6, '0')}`))
        .setOrigin(0.5)
        .setDepth(205);
      this.add.text(x + 2, y, text, this.textStyle(12, '#d9caa8'))
        .setOrigin(0.5)
        .setDepth(205);
      this.add.text(x + 34, y, '+', this.titleStyle(17))
        .setOrigin(0.5)
        .setDepth(205);
    });

    const menu = this.add.circle(W - 30, 78, 23, 0x15110c, 1)
      .setStrokeStyle(2, GOLD)
      .setDepth(205)
      .setInteractive();
    this.add.text(W - 30, 78, '\u2630', this.titleStyle(24)).setOrigin(0.5).setDepth(206);
    menu.on('pointerdown', () => this.openPanel('SETTINGS'));
  }

  createSkillDock(): void {
    this.add.rectangle(W / 2, 690, W, 140, 0x080706, 0.88).setDepth(200).setStrokeStyle(1, 0x60451f);
    [95, 195, 295, 395].forEach((x, index) => {
      const radius = index === 2 ? 46 : 38;
      const ring = this.add.circle(x, 680, radius, 0x11100e, 1)
        .setStrokeStyle(index === 2 ? 4 : 2, index === 2 ? 0xe2b655 : 0x8d6b32).setDepth(202).setInteractive();
      ring.on('pointerdown', () => this.scene.get('BattleScene').events.emit('use-skill', index));
      this.add.circle(x, 680, radius - 7, 0x183f67, 0.9).setDepth(201);
      const label = this.add.text(x, 680, '무공', { ...this.textStyle(12, '#f6e3b2'), align: 'center', wordWrap: { width: 74 } }).setOrigin(0.5).setDepth(204);
      this.skillLabels.push(label);
      this.cooldowns.push(this.add.arc(x, 680, radius - 6, 0, 360, false, 0x000000, 0.62).setDepth(205).setVisible(false));
    });
    const auto = this.add.circle(485, 680, 34, 0x21170b, 1).setStrokeStyle(2, GOLD).setDepth(202).setInteractive();
    this.modeText = this.add.text(485, 680, 'AUTO', this.textStyle(13, '#f2d27d')).setOrigin(0.5).setDepth(203);
    auto.on('pointerdown', () => this.scene.get('BattleScene').events.emit('toggle-battle-mode'));
  }

  createBottomNav(): void {
    this.add.rectangle(W / 2, 855, W, 210, 0x080706, 0.98).setDepth(200).setStrokeStyle(1, 0x60451f);
    const nav: [Panel, string, string][] = [
      ['TRAINING', '수련', '修'], ['EQUIPMENT', '장비', '裝'], ['MARTIAL', '무공', '武'],
      ['SECT', '문파', '門'], ['CODEX', '도감', '鑑'], ['MISSIONS', '임무', '令'],
    ];
    nav.forEach(([panel, label, glyph], index) => {
      const x = 45 + index * 90;
      const button = this.add.circle(x, 850, panel === 'MARTIAL' ? 38 : 31, 0x17120d, 1)
        .setStrokeStyle(panel === 'MARTIAL' ? 3 : 1, panel === 'MARTIAL' ? GOLD : 0x75572b).setDepth(202).setInteractive();
      this.add.text(x, 847, glyph, this.titleStyle(panel === 'MARTIAL' ? 28 : 23)).setOrigin(0.5).setDepth(203);
      this.add.text(x, 898, label, this.textStyle(14, '#d5c6a7')).setOrigin(0.5).setDepth(203);
      button.on('pointerdown', () => this.openPanel(panel));
    });
  }

  private createProgressTrack(): void {
    const y = 110;
    this.add.rectangle(W / 2, y, 340, 4, 0x1a1712, 1).setDepth(204);
    this.add.rectangle(W / 2, y, 340, 2, 0x7a5d2d, 0.85).setDepth(205);
    const nodeXs = [112, 154, 196, 344, 386, 428];
    for (let i = 0; i < nodeXs.length; i++) {
      const x = nodeXs[i];
      this.add.circle(x, y, 15, 0x070504, 1).setStrokeStyle(1, 0x4a3a24).setDepth(205);
      const node = this.add.arc(x, y, 10, 0, 360, false, 0x241b12, 1)
        .setStrokeStyle(2, 0x4d4a43)
        .setDepth(206);
      this.add.text(x, y, '\u25C8', this.textStyle(10, '#31281b')).setOrigin(0.5).setDepth(207);
      this.progressNodes.push(node);
    }
    this.add.circle(W / 2, y, 36, 0x070504, 1).setStrokeStyle(2, 0x8c642d).setDepth(206);
    this.bossNode = this.add.star(W / 2, y - 1, 8, 17, 31, 0x5b150c, 1)
      .setStrokeStyle(3, 0xf1b34f)
      .setDepth(207);
    this.add.text(W / 2, y - 1, '\u9B54', this.titleStyle(18)).setOrigin(0.5).setDepth(208);
  }

  private createCombatSkillDockV2(): void {
    this.add.rectangle(W / 2, 642, W, 116, 0x080706, 0.9).setDepth(200).setStrokeStyle(1, 0x60451f);
    const slots = [
      { x: 56, radius: 35, label: UI.dash, action: 'dash' as const, color: 0x2f2a16 },
      { x: 145, radius: 38, label: UI.martial, action: 0 as const, color: 0x163b64 },
      { x: 235, radius: 46, label: UI.ultimate, action: 1 as const, color: 0x65180f },
      { x: 325, radius: 38, label: UI.martial, action: 2 as const, color: 0x163b64 },
      { x: 415, radius: 35, label: UI.locked, action: 'locked' as const, color: 0x152f55 },
    ];

    slots.forEach((slot) => {
      const ring = this.add.circle(slot.x, 680, slot.radius, 0x11100e, 1)
        .setStrokeStyle(slot.radius > 40 ? 4 : 2, slot.radius > 40 ? 0xe2b655 : 0x8d6b32)
        .setDepth(202)
        .setInteractive();
      this.add.circle(slot.x, 680, slot.radius - 7, slot.color, 0.95).setDepth(201);
      const glow = this.add.circle(slot.x, 680, slot.radius - 14, 0xffffff, slot.radius > 40 ? 0.12 : 0.07).setDepth(202);
      this.tweens.add({ targets: glow, alpha: 0.02, duration: 900, yoyo: true, repeat: -1 });

      if (slot.action === 'dash') {
        ring.on('pointerdown', () => this.scene.get('BattleScene').events.emit('use-dash'));
        this.add.text(slot.x, 680, slot.label, { ...this.textStyle(12, '#f6e3b2'), align: 'center', wordWrap: { width: 62 } }).setOrigin(0.5).setDepth(204);
        this.dashCooldown = this.add.arc(slot.x, 680, slot.radius - 6, 0, 360, false, 0x000000, 0.62).setDepth(205).setVisible(false);
        this.dashCooldownText = this.add.text(slot.x, 680, '', this.textStyle(13, '#ffe29a')).setOrigin(0.5).setDepth(206).setVisible(false);
        return;
      }

      if (slot.action === 'locked') {
        this.add.text(slot.x, 680, slot.label, this.textStyle(12, '#7d766a')).setOrigin(0.5).setDepth(204);
        return;
      }

      ring.on('pointerdown', () => this.scene.get('BattleScene').events.emit('use-skill', slot.action));
      this.skillIcons[slot.action] = this.add.image(slot.x, 676, skillCardKey(getStarterSkill(this.charClass)))
        .setDisplaySize(slot.radius * 1.24, slot.radius * 1.24)
        .setDepth(202)
        .setAlpha(0.9);
      this.add.circle(slot.x, 680, slot.radius - 9, 0x000000, 0.18).setDepth(203);
      this.skillLabels[slot.action] = this.add.text(slot.x, 704, slot.label, { ...this.textStyle(9, '#f6e3b2'), align: 'center', wordWrap: { width: 74 } }).setOrigin(0.5).setDepth(204);
      this.cooldowns[slot.action] = this.add.arc(slot.x, 680, slot.radius - 6, 0, 360, false, 0x000000, 0.62).setDepth(205).setVisible(false);
      this.cooldownTexts[slot.action] = this.add.text(slot.x, 680, '', this.textStyle(13, '#ffe29a')).setOrigin(0.5).setDepth(206).setVisible(false);
    });

    this.modeGlow = this.add.circle(488, 680, 40, 0xffc45a, 0.12)
      .setDepth(201)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.modeGlow, alpha: 0.04, scaleX: 1.1, scaleY: 1.1, duration: 900, yoyo: true, repeat: -1 });
    const auto = this.add.circle(488, 680, 34, 0x21170b, 1).setStrokeStyle(2, GOLD).setDepth(202).setInteractive();
    this.modeButton = auto;
    this.modeText = this.add.text(488, 680, 'AUTO', this.textStyle(13, '#f2d27d')).setOrigin(0.5).setDepth(203);
    auto.on('pointerdown', () => this.scene.get('BattleScene').events.emit('toggle-battle-mode'));
  }

  private createQuickMartialBoard(): void {
    this.add.rectangle(W / 2, 806, W, 214, 0x0a0806, 0.97).setDepth(190).setStrokeStyle(1, 0x60451f);
    const tabs: [MartialTab, string][] = [['SKILLS', UI.martial], ['SYNTH', UI.synth], ['UPGRADE', UI.upgrade], ['BOSS', UI.boss]];
    tabs.forEach(([tab, label], index) => {
      const x = 28 + index * 121;
      const active = tab === 'SKILLS';
      const button = this.add.rectangle(x, 718, 112, 36, active ? 0x6a481a : 0x17120d)
        .setOrigin(0, 0)
        .setStrokeStyle(active ? 2 : 1, active ? GOLD : 0x60451f)
        .setDepth(202)
        .setInteractive();
      this.add.rectangle(x + 56, 724, 98, 3, active ? 0xffdf84 : 0x2a2115, active ? 0.55 : 0.35).setDepth(203);
      this.add.rectangle(x + 56, 753, 100, 2, active ? 0x8d5a20 : 0x050403, active ? 0.6 : 0.45).setDepth(203);
      if (active) {
        this.add.circle(x + 56, 718, 7, 0x080604, 1).setStrokeStyle(1, GOLD).setDepth(204);
        this.add.text(x + 56, 718, '\u25C6', this.textStyle(8, '#ffe29a')).setOrigin(0.5).setDepth(205);
      }
      button.on('pointerdown', () => { this.martialTab = tab; this.openPanel('MARTIAL'); });
      this.add.text(x + 56, 736, label, this.textStyle(16, active ? '#f3d992' : '#b7aa92')).setOrigin(0.5).setDepth(204);
    });

    const save = loadGame();
    const owned = this.ownedSkills(save);
    const equipped = new Set(save.equippedSkills ?? []);
    const fallback = [...SKILL_DATABASE.values()].filter(skill => skill.type === 'ACTIVE' && skill.category === this.charClass);
    const seen = new Set<string>();
    const skills = [...owned, ...fallback]
      .filter(skill => {
        if (seen.has(skill.id)) return false;
        seen.add(skill.id);
        return true;
      })
      .slice(0, 10);

    skills.forEach((skill, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const cx = 54 + col * 108;
      const cy = 780 + row * 78;
      const gradeTint = this.skillGradeColor(skill.grade);
      const isEquipped = equipped.has(skill.id);

      this.add.rectangle(cx, cy, 86, 76, 0x090706, 0.96)
        .setStrokeStyle(isEquipped ? 2 : 1, isEquipped ? 0xffdf84 : gradeTint, isEquipped ? 1 : 0.72)
        .setDepth(200);
      this.add.ellipse(cx, cy - 6, 74, 48, gradeTint, isEquipped ? 0.26 : 0.14)
        .setDepth(200)
        .setBlendMode(Phaser.BlendModes.ADD);

      const art = this.add.image(cx, cy, skillCardKey(skill.id))
        .setDisplaySize(82, 74)
        .setDepth(201)
        .setInteractive();
      art.on('pointerdown', () => this.equipSkill(skill.id, index % 3));

      const grade = skill.grade.toLowerCase();
      const frameKey = `ui_card_${grade === 'low' ? 'common' : grade === 'mid' ? 'rare' : grade === 'high' ? 'epic' : 'legend'}`;
      this.add.image(cx, cy, frameKey).setDisplaySize(82, 74).setDepth(202);
      if (isEquipped) {
        this.add.rectangle(cx, cy - 33, 58, 12, 0x2a1707, 0.86).setDepth(203).setStrokeStyle(1, 0xffdf84, 0.8);
        this.add.text(cx, cy - 34, UI.equipped, this.textStyle(8, '#ffe3a0')).setOrigin(0.5).setDepth(204);
      }
      this.add.rectangle(cx, cy + 21, 76, 24, 0x050403, 0.72).setDepth(203);
      this.add.text(cx, cy + 12, this.skillLabel(skill), {
        ...this.textStyle(9, '#f3e7ca'),
        align: 'center',
        wordWrap: { width: 72 },
      }).setOrigin(0.5, 0).setDepth(204);
      const gradeMark = { LOW: '\uD558', MID: '\uC911', HIGH: '\uC0C1', ULTIMATE: '\uC808' }[skill.grade] ?? '';
      this.add.rectangle(cx - 29, cy - 25, 17, 17, 0x17120d, 0.92)
        .setRotation(Math.PI / 4)
        .setDepth(203)
        .setStrokeStyle(1, gradeTint, 1);
      this.add.text(cx - 29, cy - 25, gradeMark, this.textStyle(12, '#f6d47a')).setOrigin(0.5).setDepth(204);
      const level = save.skillLevels?.[skill.id] ?? 0;
      this.add.text(cx + 26, cy + 27, `+${level}`, this.textStyle(10, '#d4a74e')).setOrigin(0.5).setDepth(204);

      const stars = Math.min(5, Math.max(1, level + (skill.grade === 'ULTIMATE' ? 4 : skill.grade === 'HIGH' ? 3 : skill.grade === 'MID' ? 2 : 1)));
      for (let i = 0; i < 5; i++) {
        this.add.rectangle(cx - 25 + i * 11, cy + 30, 5, 5, i < stars ? 0xd7a63a : 0x2b2419, 1)
          .setRotation(Math.PI / 4)
          .setDepth(204)
          .setStrokeStyle(1, i < stars ? 0xffe19a : 0x6a5130, 0.8);
      }
    });
  }

  private createBottomNavV2(): void {
    this.add.rectangle(W / 2, 925, W, 70, 0x080706, 0.98).setDepth(200).setStrokeStyle(1, 0x60451f);
    const nav: [Panel, string, string][] = [
      ['TRAINING', UI.training, '\u4FEE'],
      ['EQUIPMENT', UI.equipment, '\u88DD'],
      ['SHOP', '\uC0C1\uC810', '\u5546'],
      ['MARTIAL', UI.sect, '\u9580'],
      ['SECT', UI.codex, '\u66F8'],
      ['CODEX', UI.secret, '\u5178'],
      ['MISSIONS', UI.mission, '\u4EE4'],
    ];
    nav.forEach(([panel, label, glyph], index) => {
      const x = 38 + index * 77;
      const isMain = panel === 'MARTIAL';
      const button = this.add.circle(x, 910, isMain ? 28 : 23, 0x17120d, 1)
        .setStrokeStyle(isMain ? 3 : 1, isMain ? GOLD : 0x75572b).setDepth(202).setInteractive();
      this.add.text(x, 907, glyph, this.titleStyle(isMain ? 20 : 17)).setOrigin(0.5).setDepth(203);
      this.add.text(x, 940, label, this.textStyle(10, '#d5c6a7')).setOrigin(0.5).setDepth(203);
      button.on('pointerdown', () => this.openPanel(panel));
    });
  }

  private openPanel(panel: Panel): void {
    this.overlay?.destroy(true);
    const items: Phaser.GameObjects.GameObject[] = [];
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82).setInteractive();
    const bg = this.add.image(W / 2, H / 2, 'ui_dialog_bg').setDisplaySize(W - 24, H - 40).setDepth(701);
    const title = this.add.text(50, 42, PANEL_TITLES[panel], this.titleStyle(28)).setDepth(702);
    const close = this.add.text(W - 55, 46, 'X', this.titleStyle(30)).setOrigin(0.5).setInteractive().setDepth(702);
    close.on('pointerdown', () => this.closePanel());
    items.push(shade, bg, title, close);
    if (panel === 'MARTIAL') this.buildMartial(items);
    if (panel === 'TRAINING') this.buildTraining(items);
    if (panel === 'EQUIPMENT') this.buildEquipment(items);
    if (panel === 'SECT') this.buildSect(items);
    if (panel === 'CODEX') this.buildCodex(items);
    if (panel === 'MISSIONS') this.buildMissions(items);
    if (panel === 'SETTINGS') this.buildSettings(items);
    if (panel === 'SHOP') this.buildShop(items);
    this.overlay = this.add.container(0, 0, items).setDepth(700);
  }

  private buildMartial(items: Phaser.GameObjects.GameObject[]): void {
    const tabs: [MartialTab, string][] = [['SKILLS', UI.martial], ['SYNTH', UI.synth], ['UPGRADE', UI.upgrade], ['BOSS', UI.boss]];
    tabs.forEach(([tab, label], index) => {
      const x = 38 + index * 124;
      const button = this.add.rectangle(x, 95, 112, 44, tab === this.martialTab ? 0x5a3d18 : 0x17120d)
        .setOrigin(0, 0).setStrokeStyle(1, GOLD).setInteractive().setDepth(702);
      button.on('pointerdown', () => { this.martialTab = tab; this.openPanel('MARTIAL'); });
      items.push(button, this.add.text(x + 56, 117, label, this.textStyle(17, '#f0d493')).setOrigin(0.5).setDepth(703));
    });
    if (this.martialTab === 'SKILLS') this.buildSkillCards(items);
    if (this.martialTab === 'SYNTH') this.buildSynthesis(items);
    if (this.martialTab === 'UPGRADE') this.buildUpgrades(items);
    if (this.martialTab === 'BOSS') this.buildBossList(items);
  }

  private buildSkillCards(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    this.ownedSkills(save).slice(0, 8).forEach((skill, index) => {
      const x = 38 + (index % 4) * 124;
      const y = 165 + Math.floor(index / 4) * 260;
      const art = this.add.image(x + 55, y + 78, skillCardKey(skill.id)).setDisplaySize(110, 156).setInteractive().setDepth(702);
      art.on('pointerdown', () => this.equipSkill(skill.id, index % 3));

      const grade = skill.grade.toLowerCase();
      const frameKey = `ui_card_${grade === 'low' ? 'common' : grade === 'mid' ? 'rare' : grade === 'high' ? 'epic' : 'legend'}`;
      const frame = this.add.image(x + 55, y + 78, frameKey).setDisplaySize(110, 156).setDepth(703);

      items.push(art, frame,
        this.add.text(x + 55, y + 172, this.skillLabel(skill), { ...this.textStyle(13, '#f3e7ca'), align: 'center', wordWrap: { width: 112 } }).setOrigin(0.5).setDepth(704),
        this.add.text(x + 55, y + 198, `보유 ${save.inventory[skill.id] ?? 0} · +${save.skillLevels?.[skill.id] ?? 0}`, this.textStyle(12, '#d4a74e')).setOrigin(0.5).setDepth(704));
    });
  }

  private buildSynthesis(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    const recipes = SYNTHESIS_RECIPES.filter(recipe => {
      const result = SKILL_DATABASE.get(recipe.result);
      return result?.category === this.charClass && (save.inventory[recipe.material1] ?? 0) >= (recipe.material1 === recipe.material2 ? 2 : 1);
    }).slice(0, 8);
    recipes.forEach((recipe, index) => {
      const result = SKILL_DATABASE.get(recipe.result)!;
      const x = 38 + (index % 4) * 124;
      const y = 165 + Math.floor(index / 4) * 240;
      const art = this.add.image(x + 55, y + 75, skillCardKey(result.id)).setDisplaySize(110, 156).setInteractive().setDepth(702);
      art.on('pointerdown', () => this.synth(recipe.material1, recipe.material2, recipe.result, recipe.goldCost));

      const grade = result.grade.toLowerCase();
      const frameKey = `ui_card_${grade === 'low' ? 'common' : grade === 'mid' ? 'rare' : grade === 'high' ? 'epic' : 'legend'}`;
      const frame = this.add.image(x + 55, y + 75, frameKey).setDisplaySize(110, 156).setDepth(703);

      items.push(art, frame, this.add.text(x + 55, y + 170, `${recipe.goldCost} 금화`, this.textStyle(13, '#d4a74e')).setOrigin(0.5).setDepth(704));
    });
  }

  private buildUpgrades(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    this.ownedSkills(save).slice(0, 8).forEach((skill, index) => {
      const x = 38 + (index % 4) * 124;
      const y = 165 + Math.floor(index / 4) * 240;
      const art = this.add.image(x + 55, y + 75, skillCardKey(skill.id)).setDisplaySize(110, 156).setInteractive().setDepth(702);
      art.on('pointerdown', () => this.upgradeSkill(skill));

      const grade = skill.grade.toLowerCase();
      const frameKey = `ui_card_${grade === 'low' ? 'common' : grade === 'mid' ? 'rare' : grade === 'high' ? 'epic' : 'legend'}`;
      const frame = this.add.image(x + 55, y + 75, frameKey).setDisplaySize(110, 156).setDepth(703);

      items.push(art, frame, this.add.text(x + 55, y + 170, `강화 +${save.skillLevels?.[skill.id] ?? 0}`, this.textStyle(13, '#d4a74e')).setOrigin(0.5).setDepth(704));
    });
  }

  private buildBossList(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    const ranks = ['DAEJU', 'DANJU', 'GAKJU', 'MAGUN', 'HOBUP', 'SAJA', 'BUGYOJU', 'HYEOLMA'];
    const BOSS_SHORT = ['daeju', 'danju', 'gakju', 'magun', 'hobup', 'saja', 'bugyoju', 'hyeolma'];
    const gems = save.gems ?? 0;

    items.push(this.add.text(W / 2, 137, `재도전: 보스 5💎 소모 · 보상 ×2.5`, this.textStyle(11, '#7a6e5a')).setOrigin(0.5).setDepth(702));

    ranks.forEach((rank, index) => {
      const y = 162 + index * 72;
      const id = `boss_${BOSS_SHORT[index]}`;
      const done = save.defeatedBosses?.includes(id) ?? false;
      const row = this.add.rectangle(W / 2, y, W - 76, 58, done ? 0x162416 : 0x17120d).setStrokeStyle(1, BOSS_RANK_COLORS[rank]);
      items.push(row,
        this.add.text(55, y - 10, `${index + 1}장 · ${BOSS_RANK_NAMES[rank] ?? rank}`, this.textStyle(17, '#f0d493')).setOrigin(0, 0.5),
        this.add.text(55, y + 10, done ? '✓ 격파 완료' : '도전 중...', this.textStyle(11, done ? '#83d68a' : '#7a6e5a')).setOrigin(0, 0.5),
      );
      if (done) {
        const canChallenge = gems >= 5;
        const cBtn = this.add.rectangle(W - 90, y, 130, 36, canChallenge ? 0x3a2a10 : 0x1a1209)
          .setStrokeStyle(1, canChallenge ? 0xd4a74e : 0x3a3020).setInteractive().setDepth(703);
        cBtn.on('pointerdown', () => this.rechallengeBoss(index, 5 * (index + 1)));
        items.push(cBtn, this.add.text(W - 90, y, canChallenge ? '재도전 💎5' : '💎 부족', this.textStyle(12, canChallenge ? '#e8c36a' : '#5a4a38')).setOrigin(0.5).setDepth(704));
      }
    });
  }

  private rechallengeBoss(index: number, wave: number): void {
    const save = loadGame();
    if ((save.gems ?? 0) < 5) return this.showNotice('원보가 부족합니다 (5💎 필요)');
    save.gems = (save.gems ?? 0) - 5;
    saveGame(save);
    this.closePanel();
    this.scene.get('BattleScene').events.emit('challenge-boss', wave);
    this.showNotice(`${index + 1}장 보스 재도전 — 보상 ×2.5`);
  }

  private buildTraining(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    const TRAIN = [
      { key: 'attack',  name: '공격 수련', sub: '호신강공(護身剛功)', icon: '剑', eff: '공격력',    pct: 2,   base: 80,  color: 0xe05555 },
      { key: 'hp',      name: '체력 수련', sub: '금강불괴(金剛不壞)', icon: '氣', eff: '최대 체력',  pct: 2,   base: 80,  color: 0xcc3333 },
      { key: 'gold',    name: '재물 수련', sub: '취재술(聚財術)',     icon: '財', eff: '금화 획득',  pct: 2,   base: 60,  color: 0xd4a74e },
      { key: 'speed',   name: '신법 수련', sub: '경공술(輕功術)',     icon: '步', eff: '이동 속도',  pct: 1.5, base: 120, color: 0x5aafff },
      { key: 'stamina', name: '내공 수련', sub: '심기단련(心氣鍛鍊)', icon: '心', eff: '최대 내공',  pct: 3,   base: 100, color: 0x50c878 },
      { key: 'crit',    name: '격파 수련', sub: '파공술(破功術)',     icon: '破', eff: '치명타 확률', pct: 2,   base: 200, color: 0xc878ff },
    ] as const;

    // 2×3 그리드
    const COL = [150, 392];
    const ROW = [180, 360, 540];
    const CW = 224, CH = 158;

    TRAIN.forEach((t, i) => {
      const cx = COL[i % 2];
      const cy = ROW[Math.floor(i / 2)];
      const lv = save.trainingLevels?.[t.key] ?? 0;
      // 무한 수련: 초반 저렴, 레벨 오를수록 부드럽게 증가
      const cost = Math.round(t.base * (1 + lv * 0.4 + Math.pow(lv, 1.7) * 0.06));
      // 10레벨 단위 진행 표시
      const chunk = Math.floor(lv / 10);
      const chunkPct = (lv % 10) / 10;
      const effPct = (t.pct * lv).toFixed(1);
      const tierLabel = lv === 0 ? '' : lv < 10 ? '입문' : lv < 30 ? '초급' : lv < 60 ? '중급' : lv < 100 ? '고급' : lv < 200 ? '달인' : '신경';

      // 카드 배경
      items.push(
        this.add.rectangle(cx, cy, CW, CH, 0x0f0e0c, 1)
          .setStrokeStyle(2, t.color, 0.65).setDepth(702),
        this.add.rectangle(cx, cy - CH / 2 + 3, CW - 4, 5, t.color, 0.6)
          .setOrigin(0.5, 0.5).setDepth(703),
      );
      // 아이콘
      items.push(
        this.add.circle(cx - 90, cy - 40, 21, 0x0a0806).setStrokeStyle(2, t.color, 0.9).setDepth(703),
        this.add.text(cx - 90, cy - 40, t.icon, this.titleStyle(19)).setOrigin(0.5).setDepth(704),
      );
      // 이름 / 서브 / 레벨
      items.push(
        this.add.text(cx - 62, cy - 52, t.name, this.textStyle(14, '#e8c36a')).setDepth(703),
        this.add.text(cx - 62, cy - 34, t.sub, this.textStyle(9, '#6e6254')).setDepth(703),
        this.add.text(cx + 100, cy - 52, `Lv.${lv}  ${tierLabel}`, this.textStyle(11, '#f0d493'))
          .setOrigin(1, 0).setDepth(703),
      );
      // 효과 텍스트
      items.push(
        this.add.text(cx - 104, cy - 10, `${t.eff}  +${effPct}%`, this.textStyle(13, '#c8b98a')).setDepth(703),
      );
      // 10단위 진행 바 (chunk * 10 표시)
      const bw = 200;
      items.push(
        this.add.rectangle(cx, cy + 22, bw, 7, 0x1e1a13, 1).setDepth(703),
        this.add.rectangle(cx - bw / 2, cy + 22, Math.max(3, bw * chunkPct), 7, t.color, 0.85)
          .setOrigin(0, 0.5).setDepth(704),
      );
      if (chunk > 0) {
        items.push(this.add.text(cx + bw / 2 + 4, cy + 22, `×${chunk}`, this.textStyle(9, '#a09060')).setOrigin(0, 0.5).setDepth(704));
      }
      // 수련 버튼 (×1 / ×10)
      const cost10 = Array.from({ length: 10 }, (_, k) =>
        Math.round(t.base * (1 + (lv + k) * 0.4 + Math.pow(lv + k, 1.7) * 0.06))
      ).reduce((a, b) => a + b, 0);
      const btn1 = this.add.rectangle(cx - 55, cy + 52, 86, 28, 0x4a3215)
        .setStrokeStyle(1, GOLD).setInteractive().setDepth(703);
      btn1.on('pointerdown', () => this.upgradeTraining(t.key, cost, 1));
      const btn10 = this.add.rectangle(cx + 55, cy + 52, 86, 28, 0x3a2a12)
        .setStrokeStyle(1, 0xb8922a).setInteractive().setDepth(703);
      btn10.on('pointerdown', () => this.upgradeTraining(t.key, cost10, 10));
      items.push(
        btn1,  this.add.text(cx - 55, cy + 52, `×1  ${fmtGold(cost)}G`, this.textStyle(11, '#f0d493')).setOrigin(0.5).setDepth(704),
        btn10, this.add.text(cx + 55, cy + 52, `×10  ${fmtGold(cost10)}G`, this.textStyle(11, '#c89a60')).setOrigin(0.5).setDepth(704),
      );
    });

    // 종합 보너스 요약
    const tl = save.trainingLevels ?? {};
    const totalAtk = (tl.attack ?? 0) * 2;
    const totalHp = (tl.hp ?? 0) * 2;
    const totalSpd = ((tl.speed ?? 0) * 1.5).toFixed(1);
    const totalCrit = (tl.crit ?? 0) * 2;
    items.push(
      this.add.rectangle(W / 2, 655, W - 52, 46, 0x0c0a07, 1).setStrokeStyle(1, GOLD, 0.45).setDepth(702),
      this.add.text(W / 2, 647, '현재 총 보너스', this.textStyle(11, '#7a6e58')).setOrigin(0.5).setDepth(703),
      this.add.text(W / 2, 665,
        `공격 +${totalAtk}%   체력 +${totalHp}%   속도 +${totalSpd}%   치명타 +${totalCrit}%`,
        this.textStyle(12, '#d4a74e')).setOrigin(0.5).setDepth(703),
    );

    const npc = this.add.image(W - 95, 820, 'npc_jeomsoyi').setDisplaySize(190, 210).setDepth(702).setAlpha(0.82);
    items.push(npc);
  }

  private buildEquipment(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    const filters: [EquipmentFilter, string][] = [['ALL', '전체'], ['SET', '세트'], ['EPIC', '영웅'], ['LEGENDARY', '전설']];
    filters.forEach(([filter, label], index) => {
      const x = 48 + index * 62;
      const button = this.add.rectangle(x, 105, 56, 38, this.equipmentFilter === filter ? 0x5a3d18 : 0x17120d)
        .setStrokeStyle(1, this.equipmentFilter === filter ? GOLD : 0x75572b).setInteractive();
      button.on('pointerdown', () => { this.equipmentFilter = filter; this.openPanel('EQUIPMENT'); });
      items.push(button, this.add.text(x, 105, label, this.textStyle(12, '#f0d493')).setOrigin(0.5));
    });
    const salvage = this.add.rectangle(305, 105, 86, 38, 0x3b2514).setStrokeStyle(1, GOLD).setInteractive();
    salvage.on('pointerdown', () => this.salvageFilteredEquipment());
    items.push(salvage, this.add.text(305, 105, '분해', this.textStyle(13, '#f0d493')).setOrigin(0.5));
    const auto = this.add.rectangle(W - 72, 105, 96, 38, 0x4a3215).setStrokeStyle(1, GOLD).setInteractive();
    auto.on('pointerdown', () => this.autoEquip());
    items.push(auto, this.add.text(W - 72, 105, '최적', this.textStyle(13, '#f0d493')).setOrigin(0.5));

    const setBonus = equipmentSetBonus(equippedItems(save.equipmentInventory ?? [], save.equippedItems));
    items.push(this.add.text(55, 148, `세트 효과  공격 x${setBonus.attackMul.toFixed(2)}  체력 x${setBonus.hpMul.toFixed(2)}  금화 x${setBonus.goldMul.toFixed(2)}`, this.textStyle(13, '#d4a74e')));

    EQUIPMENT_SLOTS.forEach((slot, index) => {
      const x = 55 + (index % 3) * 165;
      const y = 190 + Math.floor(index / 3) * 145;
      const item = save.equipmentInventory?.find(candidate => candidate.id === save.equippedItems?.[slot]);
      items.push(this.add.rectangle(x, y, 145, 120, 0x15110c).setOrigin(0, 0).setStrokeStyle(1, item ? GOLD : 0x4b4132),
        this.add.text(x + 72, y + 24, EQUIPMENT_SLOT_NAMES[slot], this.textStyle(16, '#d4a74e')).setOrigin(0.5),
        this.add.text(x + 72, y + 68, item ? item.name : '미장착', { ...this.textStyle(13, item ? '#eee0c1' : '#777066'), align: 'center', wordWrap: { width: 125 } }).setOrigin(0.5));
    });

    const equippedIds = new Set(Object.values(save.equippedItems ?? {}));
    const inventory = [...(save.equipmentInventory ?? [])]
      .filter(item => this.equipmentFilter === 'ALL' || (this.equipmentFilter === 'SET' ? Boolean(item.setId) : item.grade === this.equipmentFilter))
      .sort((a, b) => equipmentScore(b) - equipmentScore(a)).slice(0, 8);
    inventory.forEach((item, index) => {
      const x = 55 + (index % 2) * 245;
      const y = 540 + Math.floor(index / 2) * 70;
      const equipped = equippedIds.has(item.id);
      const button = this.add.rectangle(x, y, 220, 56, equipped ? 0x26301a : 0x17120d).setOrigin(0, 0).setStrokeStyle(1, this.gradeColor(item));
      button.setInteractive().on('pointerdown', () => this.equipItem(item));
      items.push(button,
        this.add.text(x + 10, y + 10, item.name, { ...this.textStyle(13, '#eee0c1'), wordWrap: { width: 200 } }),
        this.add.text(x + 10, y + 33, `${equipped ? '장착 · ' : ''}전투력 ${equipmentScore(item)}`, this.textStyle(12, '#d4a74e')));
    });
    // 대장장이 일러스트 배치
    const npc = this.add.image(W - 90, 440, 'npc_blacksmith').setDisplaySize(160, 160).setDepth(702).setAlpha(0.85);
    items.push(npc);
  }

  private buildSect(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();

    // ─── 시설 섹션 ───
    items.push(
      this.add.rectangle(W / 2, 90, W - 52, 30, 0x1a1410, 1).setStrokeStyle(1, GOLD, 0.45).setDepth(702),
      this.add.text(56, 90, '시설 (施設)', this.titleStyle(17)).setOrigin(0, 0.5).setDepth(703),
    );

    const FACILITIES = [
      { key: 'hall',    name: '대전 (大殿)',    icon: '殿', eff: (lv: number) => `공격력 +${(lv * 2.5).toFixed(1)}%  ·  제자 +${lv}명` },
      { key: 'forge',   name: '대장간 (冶鐵)',  icon: '鐵', eff: (lv: number) => `장비 효율 +${lv * 3}%  ·  골드 생산 +${lv}%` },
      { key: 'library', name: '무경각 (武經閣)', icon: '卷', eff: (lv: number) => `연구 효율 +${lv * 5}%  ·  무공 경험 +${lv * 2}%` },
    ] as const;
    FACILITIES.forEach(({ key, name, icon, eff }, i) => {
      const lv = save.sectFacilities?.[key] ?? 1;
      const cost = lv * 250;
      const y = 133 + i * 82;
      items.push(
        this.add.rectangle(W / 2, y, W - 52, 68, 0x110e0a, 1).setStrokeStyle(1, 0x75572b, 0.7).setDepth(702),
        this.add.circle(70, y, 24, 0x0a0806).setStrokeStyle(2, GOLD, 0.7).setDepth(703),
        this.add.text(70, y, icon, this.titleStyle(20)).setOrigin(0.5).setDepth(704),
        this.add.text(102, y - 16, name, this.textStyle(15, '#e8c36a')).setDepth(703),
        this.add.text(102, y + 6, eff(lv), this.textStyle(11, '#a8987a')).setDepth(703),
        this.add.text(102, y + 22, `시설 Lv.${lv}`, this.textStyle(11, '#d4a74e')).setDepth(703),
      );
      const btn = this.add.rectangle(W - 95, y, 130, 38, 0x4a3215).setStrokeStyle(1, GOLD).setInteractive().setDepth(703);
      btn.on('pointerdown', () => this.upgradeSect(key, cost));
      items.push(btn, this.add.text(W - 95, y, `${cost}G 업그레이드`, this.textStyle(12, '#f0d493')).setOrigin(0.5).setDepth(704));
    });

    // ─── 계열 연구 섹션 ───
    items.push(
      this.add.rectangle(W / 2, 384, W - 52, 30, 0x1a1410, 1).setStrokeStyle(1, GOLD, 0.45).setDepth(702),
      this.add.text(56, 384, '계열 연구 (系列硏究)', this.titleStyle(17)).setOrigin(0, 0.5).setDepth(703),
    );
    const RESEARCH_COLORS: Record<CharacterClass, number> = { SWORD: 0x5aafff, BLADE: 0xe05555, FIST: 0xf0b444, SPEAR: 0x60d060 };
    (['SWORD', 'BLADE', 'FIST', 'SPEAR'] as CharacterClass[]).forEach((key, i) => {
      const lv = save.sectResearch?.[key] ?? 0;
      const cost = 220 * (lv + 1);
      const x = 68 + i * 102;
      const isActive = key === this.charClass;
      items.push(
        this.add.rectangle(x, 450, 90, 90, isActive ? 0x1a2035 : 0x100e0c, 1)
          .setStrokeStyle(2, RESEARCH_COLORS[key], isActive ? 0.9 : 0.5).setDepth(702),
        this.add.text(x, 425, CLASS_KO[key], this.textStyle(14, isActive ? '#e8c36a' : '#8a7d6a')).setOrigin(0.5).setDepth(703),
        this.add.text(x, 445, `Lv.${lv}`, this.textStyle(13, '#f0d493')).setOrigin(0.5).setDepth(703),
        this.add.text(x, 462, `공격+${(lv * 2.5).toFixed(1)}%`, this.textStyle(10, '#a8987a')).setOrigin(0.5).setDepth(703),
      );
      const btn = this.add.rectangle(x, 482, 80, 26, 0x4a3215).setStrokeStyle(1, RESEARCH_COLORS[key], 0.7).setInteractive().setDepth(703);
      btn.on('pointerdown', () => this.upgradeResearch(key, cost));
      items.push(btn, this.add.text(x, 482, `${cost}G`, this.textStyle(11, '#f0d493')).setOrigin(0.5).setDepth(704));
    });

    // ─── 제자 섹션 ───
    const DISCIPLE_NAMES = ['청운', '백호', '철검', '방파', '나한', '운학', '소월', '천풍', '화룡', '옥기'];
    const disciples = save.disciples ?? [];
    const discipleCount = disciples.length;
    const recruitCost = 600 + discipleCount * 350;
    items.push(
      this.add.rectangle(W / 2, 532, W - 52, 30, 0x1a1410, 1).setStrokeStyle(1, GOLD, 0.45).setDepth(702),
      this.add.text(56, 532, `제자 (弟子)  ·  ${discipleCount}명`, this.titleStyle(17)).setOrigin(0, 0.5).setDepth(703),
    );
    const recruit = this.add.rectangle(W - 95, 532, 130, 30, 0x4a3215).setStrokeStyle(1, GOLD).setInteractive().setDepth(703);
    recruit.on('pointerdown', () => this.recruitDisciple(recruitCost));
    items.push(recruit, this.add.text(W - 95, 532, `모집  ${recruitCost}G`, this.textStyle(12, '#f0d493')).setOrigin(0.5).setDepth(704));

    const maxShow = 5;
    for (let d = 0; d < maxShow; d++) {
      const y = 570 + d * 52;
      const hasDisciple = d < discipleCount;
      items.push(
        this.add.rectangle(W / 2, y, W - 52, 44, hasDisciple ? 0x141008 : 0x0d0b09, 1)
          .setStrokeStyle(1, hasDisciple ? 0x75572b : 0x2a2218, 0.7).setDepth(702),
      );
      if (hasDisciple) {
        const nameIdx = d % DISCIPLE_NAMES.length;
        items.push(
          this.add.text(70, y, DISCIPLE_NAMES[nameIdx], this.textStyle(15, '#e8c36a')).setOrigin(0, 0.5).setDepth(703),
          this.add.text(220, y, `공격 +${((d + 1) * 1).toFixed(0)}%`, this.textStyle(12, '#a8987a')).setOrigin(0, 0.5).setDepth(703),
          this.add.text(W - 60, y, `제자 ${d + 1}호`, this.textStyle(11, '#7a6e5a')).setOrigin(1, 0.5).setDepth(703),
        );
      } else {
        items.push(
          this.add.text(W / 2, y, '비어있음', this.textStyle(13, '#3a3530')).setOrigin(0.5).setDepth(703),
        );
      }
    }

    // ─── 환생 섹션 ───
    const rebirthCount = save.rebirthCount ?? 0;
    const canRebirth = save.level >= 30;
    const rebirthBonus = rebirthCount * 15;
    items.push(
      this.add.rectangle(W / 2, 842, W - 52, 2, 0x60451f, 0.5).setDepth(702),
      this.add.rectangle(W / 2, 876, W - 52, 68, 0x0e0a06).setStrokeStyle(2, rebirthCount > 0 ? 0xd4a74e : 0x3a2a1a).setDepth(702),
      this.add.text(55, 861, `환생 (還生)  ·  ${rebirthCount}회`, this.titleStyle(16)).setOrigin(0, 0.5).setDepth(703),
      this.add.text(55, 880, canRebirth ? `처음부터 시작, 영구 +${rebirthBonus + 15}% 능력치` : `Lv.30 도달 시 환생 가능 (현재 Lv.${save.level})`,
        this.textStyle(12, canRebirth ? '#c8b89a' : '#5a4a38')).setDepth(703),
    );
    if (rebirthCount > 0) {
      const paths = save.rebirthPaths ?? [];
      const pathSummary = paths.length > 0
        ? paths.slice(-3).map(p => ({ ATK: '공격', HP: '체력', GOLD: '재물', EXP: '경험' }[p] ?? p).slice(0, 2)).join('·')
        : '';
      items.push(this.add.text(W - 55, 861, `+${rebirthBonus}% · ${pathSummary}`, this.textStyle(11, '#d4a74e')).setOrigin(1, 0.5).setDepth(703));
    }
    const rebirthBtn = this.add.rectangle(W - 90, 882, 120, 28, canRebirth ? 0x4a2a08 : 0x1a1209)
      .setStrokeStyle(1, canRebirth ? 0xd4a74e : 0x3a2a18).setInteractive().setDepth(703);
    const rebirthTxt = this.add.text(W - 90, 882, '환생하기', this.textStyle(13, canRebirth ? '#d4a74e' : '#4a3828')).setOrigin(0.5).setDepth(704);
    if (canRebirth) {
      rebirthBtn.on('pointerdown', () => this.confirmRebirth(items));
    }
    items.push(rebirthBtn, rebirthTxt);

    const npc = this.add.image(W - 90, 840, 'npc_master').setDisplaySize(170, 190).setDepth(702).setAlpha(0.82);
    items.push(npc);
  }

  private confirmRebirth(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    const nextBonus = ((save.rebirthCount ?? 0) + 1) * 15;
    let selectedPath: string | null = null;

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88).setInteractive().setDepth(800);
    const box = this.add.rectangle(W / 2, H / 2, W - 40, 440, 0x110c07).setStrokeStyle(2, 0xd4a74e).setDepth(801);
    const msg  = this.add.text(W / 2, H / 2 - 185, '⚡ 환생 (還生)', this.titleStyle(22)).setOrigin(0.5).setDepth(802);
    const desc = this.add.text(W / 2, H / 2 - 145,
      `레벨·골드·수련 초기화  ·  영구 +${nextBonus}% 능력치`, this.textStyle(13, '#c8b89a')).setOrigin(0.5).setDepth(802);

    // 경로 선택
    const pathLabel = this.add.text(W / 2, H / 2 - 108, '특화 경로 선택 (영구 +5% 추가)', this.textStyle(13, '#8a7a60')).setOrigin(0.5).setDepth(802);
    const PATHS: [string, string, string, number][] = [
      ['ATK',  '공격 경로', '공격력 +5%', 0xe05555],
      ['HP',   '체력 경로', '체력  +5%',  0x50c878],
      ['GOLD', '재물 경로', '금화  +5%',  0xd4a74e],
      ['EXP',  '경험 경로', '경험치 +5%', 0x5aafff],
    ];
    const pathBtns: Phaser.GameObjects.Rectangle[] = [];
    const pathIndicators: Phaser.GameObjects.Text[] = [];
    PATHS.forEach(([key, label, eff, color], i) => {
      const x = 80 + i * 120;
      const y = H / 2 - 60;
      const btn = this.add.rectangle(x, y, 108, 70, 0x1a1209).setStrokeStyle(2, color, 0.5).setInteractive().setDepth(802);
      const indicator = this.add.text(x, y - 14, label, this.textStyle(12, '#c8b89a')).setOrigin(0.5).setDepth(803);
      const effTxt = this.add.text(x, y + 8, eff, this.textStyle(11, `#${color.toString(16).padStart(6, '0')}`)).setOrigin(0.5).setDepth(803);
      btn.on('pointerdown', () => {
        selectedPath = key;
        pathBtns.forEach((b, j) => b.setStrokeStyle(2, PATHS[j][3], j === i ? 1.0 : 0.3).setFillStyle(j === i ? 0x2a1f10 : 0x1a1209));
        pathIndicators.forEach((t, j) => t.setColor(j === i ? '#f0d493' : '#c8b89a'));
      });
      pathBtns.push(btn);
      pathIndicators.push(indicator);
      items.push(btn, indicator, effTxt);
    });

    const yes = this.add.rectangle(W / 2 - 90, H / 2 + 120, 150, 44, 0x3a2208).setStrokeStyle(2, 0xd4a74e).setInteractive().setDepth(802);
    const yesLabel = this.add.text(W / 2 - 90, H / 2 + 120, '환생!', this.titleStyle(20)).setOrigin(0.5).setDepth(803);
    const no = this.add.rectangle(W / 2 + 90, H / 2 + 120, 150, 44, 0x1a1209).setStrokeStyle(1, 0x5a4a38).setInteractive().setDepth(802);
    const noLabel = this.add.text(W / 2 + 90, H / 2 + 120, '취소', this.textStyle(18, '#8a7a60')).setOrigin(0.5).setDepth(803);

    yes.on('pointerdown', () => {
      if (!selectedPath) return this.showNotice('경로를 먼저 선택해주세요');
      save.rebirthCount = (save.rebirthCount ?? 0) + 1;
      save.rebirthPaths = [...(save.rebirthPaths ?? []), selectedPath];
      save.level = 1; save.exp = 0; save.expToNext = 30; save.gold = 0;
      save.trainingLevels = { attack: 0, hp: 0, gold: 0, speed: 0, stamina: 0, crit: 0 };
      save.stageCleared = 0;
      saveGame(save);
      this.cachedRebirth = save.rebirthCount;
      items.push(overlay, box, msg, desc, pathLabel, yes, yesLabel, no, noLabel);
      this.closePanel();
      soundSystem.play('level_up');
      this.showNotice(`환생 완료! 영구 +${save.rebirthCount * 15}% · ${selectedPath} 경로 선택!`);
    });
    no.on('pointerdown', () => [overlay, box, msg, desc, pathLabel, yes, yesLabel, no, noLabel, ...pathBtns, ...pathIndicators].forEach(o => o.destroy()));
    items.push(overlay, box, msg, desc, pathLabel, yes, yesLabel, no, noLabel);
  }

  private buildCodex(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();

    // ─── 탭 바 ───
    const CODEX_TABS: [typeof this.codexTab, string, string][] = [
      ['SKILLS', '무공', '武'],
      ['ENEMIES', '일반 적', '敵'],
      ['BOSSES', '보스', '魔'],
    ];
    CODEX_TABS.forEach(([tab, label, glyph], i) => {
      const x = 90 + i * 125;
      const isActive = this.codexTab === tab;
      const btn = this.add.rectangle(x, 103, 112, 38, isActive ? 0x5a3d18 : 0x17120d)
        .setStrokeStyle(isActive ? 2 : 1, isActive ? GOLD : 0x60451f).setInteractive().setDepth(702);
      btn.on('pointerdown', () => { this.codexTab = tab; this.openPanel('CODEX'); });
      items.push(btn,
        this.add.text(x - 20, 103, glyph, this.titleStyle(18)).setOrigin(0.5).setDepth(703),
        this.add.text(x + 16, 103, label, this.textStyle(14, isActive ? '#f3d992' : '#b7aa92')).setOrigin(0, 0.5).setDepth(703),
      );
    });

    if (this.codexTab === 'SKILLS') {
      // 무공 탭 - 2열 스킬 목록
      const allSkills = [...SKILL_DATABASE.values()].filter(s => s.type === 'ACTIVE' && s.category === this.charClass);
      const owned = new Set(save.unlockedSkills);
      items.push(this.add.text(38, 140, `${this.charClass === 'SWORD' ? '검법' : this.charClass === 'BLADE' ? '도법' : this.charClass === 'FIST' ? '권법' : '창법'} 계열 무공  ·  ${owned.size}개 습득`, this.textStyle(12, '#7a6e58')).setDepth(702));
      allSkills.slice(0, 14).forEach((skill, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 38 + col * 248;
        const y = 160 + row * 90;
        const isOwned = owned.has(skill.id);
        const gradeColor = this.skillGradeColor(skill.grade);
        items.push(
          this.add.rectangle(x, y, 234, 78, 0x110f0c, 1)
            .setOrigin(0, 0).setStrokeStyle(1, isOwned ? gradeColor : 0x2a2218, isOwned ? 0.8 : 0.5).setDepth(702),
          this.add.image(x + 36, y + 39, skillCardKey(skill.id)).setDisplaySize(58, 58).setOrigin(0.5).setAlpha(isOwned ? 0.9 : 0.25).setDepth(703),
          this.add.text(x + 70, y + 16, this.skillLabel(skill), this.textStyle(13, isOwned ? '#e8c36a' : '#4a4035')).setDepth(703),
          this.add.text(x + 70, y + 36, `${GRADE_KO[skill.grade]} · 쿨타임 ${(skill.cooldown / 1000).toFixed(1)}s`, this.textStyle(11, isOwned ? '#a8987a' : '#3a3530')).setDepth(703),
          this.add.text(x + 70, y + 54, skill.description ? skill.description.slice(0, 20) + (skill.description.length > 20 ? '…' : '') : '', this.textStyle(10, '#6a5e4a')).setDepth(703),
          this.add.text(x + 222, y + 14, GRADE_KO[skill.grade], this.textStyle(10, isOwned ? '#f0d493' : '#3a3530')).setOrigin(1, 0).setDepth(703),
          this.add.text(x + 222, y + 58, isOwned ? '습득' : '미습득', this.textStyle(10, isOwned ? '#83d68a' : '#554e45')).setOrigin(1, 1).setDepth(703),
        );
      });
    } else if (this.codexTab === 'ENEMIES') {
      // 일반 적 탭
      const enemies = [...ENEMY_DATABASE.values()].filter(e => e.rank !== 'BOSS');
      const unlockedRegion = save.storyRegion ?? 1;
      items.push(this.add.text(38, 140, `일반 적 도감  ·  총 ${Math.min(enemies.length, unlockedRegion * 3)}마리 발견`, this.textStyle(12, '#7a6e58')).setDepth(702));
      enemies.slice(0, 12).forEach((enemy, i) => {
        const y = 158 + i * 58;
        const isUnlocked = (enemy.region ?? 1) <= unlockedRegion;
        const regionColor = [0x5aafff, 0x60d060, 0xffd060, 0xe07030, 0xe05555, 0xc04040, 0x9050e0, 0xcc2030][Math.min(7, (enemy.region ?? 1) - 1)];
        items.push(
          this.add.rectangle(W / 2, y + 26, W - 52, 50, 0x110f0c, 1)
            .setStrokeStyle(1, isUnlocked ? regionColor : 0x2a2218, isUnlocked ? 0.55 : 0.3).setDepth(702),
          this.add.text(56, y + 16, isUnlocked ? enemy.name : '???', this.textStyle(14, isUnlocked ? '#e8c36a' : '#3a3530')).setDepth(703),
          this.add.text(56, y + 36, isUnlocked ? `${enemy.region ?? 1}지역  ·  HP ${enemy.hp}  ·  공격 ${enemy.damage}` : '미발견', this.textStyle(11, '#7a6e58')).setDepth(703),
          this.add.text(W - 56, y + 26, isUnlocked ? (enemy.rank === 'ELITE' ? '정예' : '일반') : '', this.textStyle(12, isUnlocked ? '#f0d493' : '#3a3530')).setOrigin(1, 0.5).setDepth(703),
        );
      });
    } else {
      // 보스 탭
      const bosses = [...ENEMY_DATABASE.values()].filter(e => e.rank === 'BOSS');
      const defeatedSet = new Set(save.defeatedBosses ?? []);
      items.push(this.add.text(38, 140, `혈교 보스 도감  ·  ${defeatedSet.size} / ${bosses.length} 격파`, this.textStyle(12, '#7a6e58')).setDepth(702));
      bosses.forEach((boss, i) => {
        const y = 160 + i * 84;
        const isDefeated = defeatedSet.has(boss.id);
        const rankColor = BOSS_RANK_COLORS[boss.bossRank ?? 'DAEJU'] ?? 0x75572b;
        items.push(
          this.add.rectangle(W / 2, y + 34, W - 52, 72, isDefeated ? 0x131c0e : 0x110f0c, 1)
            .setStrokeStyle(2, rankColor, isDefeated ? 0.9 : 0.35).setDepth(702),
          this.add.text(56, y + 16, `${i + 1}장  ${BOSS_RANK_NAMES[boss.bossRank ?? 'DAEJU'] ?? ''}`, this.textStyle(11, '#7a6e58')).setDepth(703),
          this.add.text(56, y + 34, isDefeated ? boss.name : '???', this.titleStyle(18)).setDepth(703),
          this.add.text(56, y + 56, isDefeated ? `HP ${boss.hp}  ·  공격 ${boss.damage}  ·  ${boss.region ?? 1}지역 수호자` : '격파 필요', this.textStyle(11, '#7a6e58')).setDepth(703),
          this.add.text(W - 56, y + 34, isDefeated ? '격파 ✓' : '미격파', this.textStyle(14, isDefeated ? '#83d68a' : '#554e45')).setOrigin(1, 0.5).setDepth(703),
        );
      });
    }
  }

  private buildMissions(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    this.ensureDailyMission(save);
    const mp = save.missionProgress ?? {};
    const claims = save.missionClaims ?? [];

    // ─── 탭 바 ───
    const TABS: [typeof this.missionsTab, string][] = [['DAILY', '일일 임무'], ['ACHIEVEMENT', '업적']];
    TABS.forEach(([tab, label], i) => {
      const x = 135 + i * 178;
      const isActive = this.missionsTab === tab;
      const btn = this.add.rectangle(x, 103, 158, 38, isActive ? 0x5a3d18 : 0x17120d)
        .setStrokeStyle(isActive ? 2 : 1, isActive ? GOLD : 0x60451f).setInteractive().setDepth(702);
      btn.on('pointerdown', () => { this.missionsTab = tab; this.openPanel('MISSIONS'); });
      items.push(btn, this.add.text(x, 103, label, this.textStyle(15, isActive ? '#f3d992' : '#b7aa92')).setOrigin(0.5).setDepth(703));
    });

    if (this.missionsTab === 'DAILY') {
      // 일일 임무 리셋 날짜 표시
      items.push(this.add.text(W / 2, 137, `자정에 초기화 · ${save.dailyMissionDate ?? '오늘'}`, this.textStyle(11, '#4a4438')).setOrigin(0.5).setDepth(702));

      const daily = [
        { id: 'daily_kill',      name: '적 30명 처치',       prog: mp.daily_kill ?? 0,      target: 30,  reward: 500  },
        { id: 'daily_waves',     name: '웨이브 5회 클리어',  prog: mp.daily_waves ?? 0,     target: 5,   reward: 400  },
        { id: 'daily_boss',      name: '보스 1회 처치',       prog: mp.daily_boss ?? 0,      target: 1,   reward: 800  },
        { id: 'daily_gold',      name: '금화 500개 수집',     prog: mp.daily_gold ?? 0,      target: 500, reward: 300  },
        { id: 'daily_synthesis', name: '합성 1회 성공',       prog: mp.daily_synthesis ?? 0, target: 1,   reward: 400  },
      ];

      daily.forEach(({ id, name, prog, target, reward }, i) => {
        const y = 158 + i * 128;
        const claimed = claims.includes(id);
        const done = prog >= target;
        const canClaim = done && !claimed;
        const ratio = Math.min(1, prog / target);
        const cardColor = claimed ? 0x131e0e : canClaim ? 0x1e2010 : 0x110f0c;
        const borderColor = claimed ? 0x3a6a2a : canClaim ? GOLD : 0x3a3528;
        items.push(
          this.add.rectangle(W / 2, y + 46, W - 52, 110, cardColor, 1)
            .setStrokeStyle(2, borderColor, claimed ? 0.7 : canClaim ? 1 : 0.4).setDepth(702),
          this.add.text(56, y + 18, name, this.titleStyle(18)).setDepth(703),
          this.add.text(56, y + 44, `보상  ${reward}G`, this.textStyle(13, '#d4a74e')).setDepth(703),
          // 진행 바
          this.add.rectangle(56, y + 68, W - 108, 10, 0x1e1a13, 1).setOrigin(0, 0.5).setDepth(703),
          this.add.rectangle(56, y + 68, Math.max(4, (W - 108) * ratio), 10, canClaim || claimed ? 0x83d68a : GOLD, 0.85).setOrigin(0, 0.5).setDepth(704),
          this.add.text(56, y + 87, `${Math.min(prog, target)} / ${target}`, this.textStyle(12, '#8a7d6a')).setDepth(703),
        );
        const btn = this.add.rectangle(W - 95, y + 65, 120, 38, canClaim ? 0x4a3215 : 0x17120d)
          .setStrokeStyle(1, canClaim ? GOLD : 0x3a3528).setInteractive().setDepth(703);
        btn.on('pointerdown', () => this.claimMission(id, canClaim));
        items.push(btn, this.add.text(W - 95, y + 65, claimed ? '수령 완료' : canClaim ? '보상 수령' : '진행 중',
          this.textStyle(13, claimed ? '#83d68a' : canClaim ? '#f0d493' : '#666666')).setOrigin(0.5).setDepth(704));
      });
    } else {
      // 업적
      items.push(this.add.text(W / 2, 137, '영구적으로 달성되는 업적입니다', this.textStyle(11, '#4a4438')).setOrigin(0.5).setDepth(702));

      const totalKills = save.totalKills ?? 0;
      const bossCount = save.defeatedBosses?.length ?? 0;
      const skillCount = save.unlockedSkills.length;
      const eqCount = save.equipmentInventory?.length ?? 0;
      const waveMax = save.stageCleared ?? 0;
      const rebirths = save.rebirthCount ?? 0;

      // 업적 목록: id, 이름, 설명, 진행, 목표, 골드 보상, 젬 보상
      type AchDef = { id: string; name: string; desc: string; prog: number; target: number; reward: number; gems: number };
      const achievements: AchDef[] = [
        { id: 'ach_kill100',   name: '첫 번째 백인도',  desc: '적 100명 처치',    prog: totalKills, target: 100,   reward: 1000,  gems: 2  },
        { id: 'ach_kill500',   name: '오백인도',        desc: '적 500명 처치',    prog: totalKills, target: 500,   reward: 2500,  gems: 5  },
        { id: 'ach_kill2000',  name: '이천인도',        desc: '적 2000명 처치',   prog: totalKills, target: 2000,  reward: 5000,  gems: 10 },
        { id: 'ach_kill10000', name: '만인지적(萬人之敵)',desc: '적 10000명 처치', prog: totalKills, target: 10000, reward: 20000, gems: 30 },
        { id: 'ach_boss1',     name: '혈교 첫 타도',   desc: '보스 1회 격파',    prog: bossCount,  target: 1,     reward: 1500,  gems: 5  },
        { id: 'ach_boss4',     name: '사악한 사천왕',  desc: '보스 4회 격파',    prog: bossCount,  target: 4,     reward: 3000,  gems: 10 },
        { id: 'ach_boss8',     name: '혈교 완전 소탕', desc: '보스 8회 모두 격파',prog: bossCount,  target: 8,     reward: 10000, gems: 50 },
        { id: 'ach_wave10',    name: '초보 도전자',    desc: '10웨이브 돌파',    prog: waveMax,    target: 10,    reward: 800,   gems: 2  },
        { id: 'ach_wave30',    name: '혈교 정예',      desc: '30웨이브 돌파',    prog: waveMax,    target: 30,    reward: 3000,  gems: 8  },
        { id: 'ach_wave50',    name: '혈교 중견',      desc: '50웨이브 돌파',    prog: waveMax,    target: 50,    reward: 8000,  gems: 20 },
        { id: 'ach_lvl10',     name: '초입 경지',      desc: '레벨 10 달성',    prog: save.level, target: 10,    reward: 1000,  gems: 3  },
        { id: 'ach_lvl30',     name: '화경(化境) 돌입',desc: '레벨 30 달성',    prog: save.level, target: 30,    reward: 5000,  gems: 10 },
        { id: 'ach_lvl50',     name: '고수 입문',      desc: '레벨 50 달성',    prog: save.level, target: 50,    reward: 10000, gems: 20 },
        { id: 'ach_lvl100',    name: '초절정 경지',    desc: '레벨 100 달성',   prog: save.level, target: 100,   reward: 30000, gems: 50 },
        { id: 'ach_rebirth1',  name: '환생자',         desc: '환생 1회',         prog: rebirths,   target: 1,     reward: 5000,  gems: 15 },
        { id: 'ach_rebirth3',  name: '삼생삼세',       desc: '환생 3회',         prog: rebirths,   target: 3,     reward: 15000, gems: 40 },
        { id: 'ach_skill8',    name: '팔방진인',       desc: '무공 8개 습득',   prog: skillCount, target: 8,     reward: 2000,  gems: 5  },
        { id: 'ach_skill16',   name: '무공 종사',      desc: '무공 16개 습득',  prog: skillCount, target: 16,    reward: 6000,  gems: 15 },
        { id: 'ach_equip10',   name: '무장 강화',      desc: '장비 10개 수집',  prog: eqCount,    target: 10,    reward: 1500,  gems: 3  },
        { id: 'ach_equip30',   name: '병기 수집가',    desc: '장비 30개 수집',  prog: eqCount,    target: 30,    reward: 4000,  gems: 8  },
      ];

      const claimedCount = achievements.filter(a => claims.includes(a.id)).length;
      items.push(this.add.text(W / 2, 137, `달성: ${claimedCount} / ${achievements.length}`, this.textStyle(11, '#4a4438')).setOrigin(0.5).setDepth(702));

      achievements.forEach(({ id, name, desc, prog, target, reward, gems: gemReward }, i) => {
        const y = 152 + i * 78;
        const claimed = claims.includes(id);
        const canClaim = prog >= target && !claimed;
        const ratio = Math.min(1, prog / target);
        const rewardStr = gemReward > 0 ? `${reward}G + ${gemReward}💎` : `${reward}G`;
        items.push(
          this.add.rectangle(W / 2, y + 30, W - 52, 64, claimed ? 0x131e0e : 0x110f0c, 1)
            .setStrokeStyle(1, claimed ? 0x3a6a2a : canClaim ? GOLD : 0x3a3528, claimed ? 0.7 : canClaim ? 1 : 0.4).setDepth(702),
          this.add.text(56, y + 14, name, this.textStyle(14, claimed ? '#83d68a' : canClaim ? '#e8c36a' : '#8a7d6a')).setDepth(703),
          this.add.text(56, y + 34, `${desc}  ·  ${rewardStr}`, this.textStyle(11, '#7a6e58')).setDepth(703),
          this.add.rectangle(56, y + 52, 240, 5, 0x1e1a13, 1).setOrigin(0, 0.5).setDepth(703),
          this.add.rectangle(56, y + 52, Math.max(3, 240 * ratio), 5, canClaim || claimed ? 0x83d68a : GOLD, 0.8).setOrigin(0, 0.5).setDepth(704),
          this.add.text(304, y + 52, `${Math.min(prog, target)}/${target}`, this.textStyle(10, '#5a5048')).setOrigin(0, 0.5).setDepth(703),
        );
        const btn = this.add.rectangle(W - 88, y + 30, 110, 34, canClaim ? 0x4a3215 : 0x17120d)
          .setStrokeStyle(1, canClaim ? GOLD : 0x3a3528).setInteractive().setDepth(703);
        btn.on('pointerdown', () => this.claimMission(id, canClaim, gemReward));
        items.push(btn, this.add.text(W - 88, y + 30, claimed ? '달성 ✓' : canClaim ? '수령' : `${Math.floor(ratio * 100)}%`,
          this.textStyle(12, claimed ? '#83d68a' : canClaim ? '#f0d493' : '#555555')).setOrigin(0.5).setDepth(704));
      });
    }
  }

  private updateHUD(state: PlayerStatePayload): void {
    this.hpFill.width = 220 * Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1);
    this.spFill.width = 190 * Phaser.Math.Clamp(state.stamina / state.maxStamina, 0, 1);
    this.expFill.width = W * Phaser.Math.Clamp(state.exp / state.expToNext, 0, 1);
    this.levelText.setText(this.cachedRebirth > 0 ? `Lv.${state.level} ⬆${this.cachedRebirth}` : `Lv.${state.level}`);
    this.goldText.setText(`${fmtGold(state.gold)} 금화`);
    this.waveText.setText(`${state.isBossWave ? '보스 · ' : ''}${state.waveNumber} 웨이브`);
    const isAuto = state.battleMode === 'AUTO';
    this.modeText.setText(isAuto ? 'AUTO' : '수동');
    if (this.modeButton) {
      this.modeButton.setFillStyle(isAuto ? 0x2a1908 : 0x161310, 1);
      this.modeButton.setStrokeStyle(2, isAuto ? 0xffd56b : 0x75572b);
    }
    if (this.modeGlow) {
      this.modeGlow.setFillStyle(isAuto ? 0xffc45a : 0x4f4536, isAuto ? 0.12 : 0.05);
    }
    if (this.dashCooldown) {
      this.updateCooldown(this.dashCooldown, this.dashCooldownText, state.dashCooldownRemaining, state.dashCooldown);
    }
    state.skills.forEach((skill, index) => {
      if (!this.skillLabels[index]) return;
      const data = SKILL_DATABASE.get(skill.id);
      this.skillLabels[index].setText(this.skillLabel(data));
      this.skillIcons[index]?.setTexture(skillCardKey(skill.id));
      this.updateCooldown(this.cooldowns[index], this.cooldownTexts[index], skill.cooldownRemaining, skill.cooldown);
    });
    const activeProgress = state.isBossWave ? this.progressNodes.length : (state.waveNumber - 1) % this.progressNodes.length;
    this.progressNodes.forEach((node, index) => {
      const active = activeProgress > index;
      node.setFillStyle(active ? GOLD : 0x241b12, 1);
      node.setStrokeStyle(2, active ? 0xffdf84 : 0x4d4a43);
      node.setScale(active ? 1.12 : 1);
    });
    if (this.bossNode) {
      this.bossNode.setFillStyle(state.isBossWave ? 0xb92512 : 0x5b150c, 1);
      this.bossNode.setScale(state.isBossWave ? 1.12 : 1);
    }

    // 초상화 일러스트 실시간 갱신
    const save = loadGame();
    const equipped = equippedItems(save.equipmentInventory ?? [], save.equippedItems);
    const dominantSet = dominantSetId(equipped, 4);
    const charId = save.selectedCharacter ?? 'sword_male';
    const portraitKey = dominantSet ? `hero_set_${charId}_${dominantSet}` : `hero_${charId}`;
    if (this.portraitImage) {
      this.portraitImage.setTexture(portraitKey);
    }
  }

  private ownedSkills(save: ReturnType<typeof loadGame>): SkillData[] {
    return [...SKILL_DATABASE.values()].filter(skill => skill.type === 'ACTIVE' && skill.category === this.charClass)
      .filter(skill => (save.inventory[skill.id] ?? 0) > 0 || save.unlockedSkills.includes(skill.id));
  }

  private equipSkill(id: string, slot: number): void {
    const save = loadGame();
    while (save.equippedSkills.length <= slot) save.equippedSkills.push(id);
    save.equippedSkills[slot] = id;
    saveGame(save);
    this.scene.get('BattleScene').events.emit('equip-changed');
    this.showNotice(`무공 장착 · ${this.skillLabel(SKILL_DATABASE.get(id))}`);
  }

  private synth(a: string, b: string, result: string, cost: number): void {
    const save = loadGame();
    const countA = save.inventory[a] ?? 0;
    const countB = save.inventory[b] ?? 0;
    if (save.gold < cost || (a === b ? countA < 2 : countA < 1 || countB < 1)) return this.showNotice('합성 재료가 부족합니다');
    save.gold -= cost;
    save.inventory[a] = countA - 1;
    save.inventory[b] = (save.inventory[b] ?? 0) - 1;
    save.inventory[result] = (save.inventory[result] ?? 0) + 1;
    if (!save.unlockedSkills.includes(result)) save.unlockedSkills.push(result);
    save.missionProgress = save.missionProgress ?? {};
    save.missionProgress.daily_synthesis = (save.missionProgress.daily_synthesis ?? 0) + 1;
    saveGame(save);
    this.showNotice(`합성 성공 · ${this.skillLabel(SKILL_DATABASE.get(result))}`);
    this.openPanel('MARTIAL');
  }

  private upgradeSkill(skill: SkillData): void {
    const save = loadGame();
    save.skillLevels = save.skillLevels ?? {};
    const level = save.skillLevels[skill.id] ?? 0;
    const cost = Math.round((skill.upgradeGoldBase ?? 40) * (1 + level * 0.32));
    if (save.gold < cost || (save.inventory[skill.id] ?? 0) < 1) return this.showNotice('강화 재료가 부족합니다');
    save.gold -= cost;
    save.inventory[skill.id] -= 1;
    save.skillLevels[skill.id] = level + 1;
    saveGame(save);
    this.openPanel('MARTIAL');
  }

  private upgradeTraining(key: string, cost: number, times = 1): void {
    const save = loadGame();
    if (save.gold < cost) return this.showNotice('금화가 부족합니다');
    save.gold -= cost;
    save.trainingLevels = save.trainingLevels ?? {};
    save.trainingLevels[key] = (save.trainingLevels[key] ?? 0) + times;
    saveGame(save);
    this.openPanel('TRAINING');
  }

  private upgradeSect(key: string, cost: number): void {
    const save = loadGame();
    if (save.gold < cost) return this.showNotice('금화가 부족합니다');
    save.gold -= cost;
    save.sectFacilities = save.sectFacilities ?? {};
    save.sectFacilities[key] = (save.sectFacilities[key] ?? 1) + 1;
    saveGame(save);
    this.openPanel('SECT');
  }

  private autoEquip(): void {
    const save = loadGame();
    save.equippedItems = save.equippedItems ?? {};
    for (const slot of EQUIPMENT_SLOTS) {
      const best = (save.equipmentInventory ?? []).filter(item => item.slot === slot).sort((a, b) => equipmentScore(b) - equipmentScore(a))[0];
      if (best) save.equippedItems[slot] = best.id;
    }
    saveGame(save);
    this.scene.get('BattleScene').events.emit('equip-changed');
    this.openPanel('EQUIPMENT');
  }

  private salvageFilteredEquipment(): void {
    const save = loadGame();
    const equippedIds = new Set(Object.values(save.equippedItems ?? {}));
    const keep: EquipmentItem[] = [];
    let refund = 0;
    for (const item of save.equipmentInventory ?? []) {
      const matched = this.equipmentFilter === 'ALL' || (this.equipmentFilter === 'SET' ? Boolean(item.setId) : item.grade === this.equipmentFilter);
      const protectedItem = equippedIds.has(item.id) || item.grade === 'LEGENDARY';
      if (matched && !protectedItem) refund += Math.max(5, Math.round(equipmentScore(item) * 0.08));
      else keep.push(item);
    }
    if (refund <= 0) return this.showNotice('분해할 장비가 없습니다');
    save.equipmentInventory = keep;
    save.gold += refund;
    saveGame(save);
    this.scene.get('BattleScene').events.emit('equip-changed');
    this.showNotice(`분해 보상 +${refund}G`);
    this.openPanel('EQUIPMENT');
  }

  private equipItem(item: EquipmentItem): void {
    const save = loadGame();
    save.equippedItems = save.equippedItems ?? {};
    save.equippedItems[item.slot] = item.id;
    saveGame(save);
    this.scene.get('BattleScene').events.emit('equip-changed');
    this.openPanel('EQUIPMENT');
  }

  private upgradeResearch(key: string, cost: number): void {
    const save = loadGame();
    if (save.gold < cost) return this.showNotice('금화가 부족합니다');
    save.gold -= cost;
    save.sectResearch = save.sectResearch ?? {};
    save.sectResearch[key] = (save.sectResearch[key] ?? 0) + 1;
    saveGame(save);
    this.openPanel('SECT');
  }

  private recruitDisciple(cost: number): void {
    const save = loadGame();
    if (save.gold < cost) return this.showNotice('금화가 부족합니다');
    save.gold -= cost;
    save.disciples = save.disciples ?? [];
    save.disciples.push(`disciple_${Date.now()}_${save.disciples.length + 1}`);
    saveGame(save);
    this.openPanel('SECT');
  }

  private ensureDailyMission(save: ReturnType<typeof loadGame>): void {
    const today = new Date().toLocaleDateString('en-CA');
    if (save.dailyMissionDate === today) return;
    save.dailyMissionDate = today;
    save.missionProgress = save.missionProgress ?? {};
    save.missionProgress.daily_kill = 0;
    save.missionProgress.daily_waves = 0;
    save.missionProgress.daily_boss = 0;
    save.missionProgress.daily_gold = 0;
    save.missionProgress.daily_synthesis = 0;
    save.missionClaims = (save.missionClaims ?? []).filter(id => !id.startsWith('daily_'));
    saveGame(save);
  }

  private claimMission(id: string, can: boolean, bonusGems = 0): void {
    if (!can) return;
    const save = loadGame();
    save.missionClaims = save.missionClaims ?? [];
    save.missionClaims.push(id);
    const REWARDS: Record<string, number> = {
      daily_kill: 500, daily_waves: 400, daily_boss: 800, daily_gold: 300, daily_synthesis: 400,
      ach_kill100: 1000,  ach_kill500: 2500,   ach_kill2000: 5000,  ach_kill10000: 20000,
      ach_boss1: 1500,    ach_boss4: 3000,      ach_boss8: 10000,
      ach_wave10: 800,    ach_wave30: 3000,     ach_wave50: 8000,
      ach_lvl10: 1000,    ach_lvl30: 5000,      ach_lvl50: 10000,    ach_lvl100: 30000,
      ach_rebirth1: 5000, ach_rebirth3: 15000,
      ach_skill8: 2000,   ach_skill16: 6000,
      ach_equip10: 1500,  ach_equip30: 4000,
      achievement: 2000, story: 900,
    };
    const reward = REWARDS[id] ?? 500;
    save.gold += reward;
    if (bonusGems > 0) save.gems = (save.gems ?? 0) + bonusGems;
    saveGame(save);
    const noticeStr = bonusGems > 0 ? `임무 완료 · +${fmtGold(reward)}G · +${bonusGems}💎` : `임무 완료 · +${fmtGold(reward)}G`;
    this.showNotice(noticeStr);
    this.openPanel('MISSIONS');
  }

  private closePanel(): void {
    this.overlay?.destroy(true);
    this.overlay = null;
  }

  // ─── Settings Panel ───────────────────────────────────────────────────────

  private buildSettings(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    let bgmVol = bgmSystem.volume;
    let sfxVol = soundSystem.volume;

    // 전투력 계산 (간략 표시)
    const training = save.trainingLevels ?? {};
    const rebirthMul = 1 + (save.rebirthCount ?? 0) * 0.15;
    const atkMul = rebirthMul * (1 + (training.attack ?? 0) * 0.02);
    const hpMul  = rebirthMul * (1 + (training.hp ?? 0) * 0.02);
    const lv = save.level;
    const approxAtk = Math.round((10 + (lv - 1) * 0.5) * atkMul * 10);
    const approxHp  = Math.round(100 * hpMul * (1 + (lv - 1) * 0.05));
    const powerScore = Math.round(approxAtk * 0.7 + approxHp * 0.3 + (save.stageCleared ?? 0) * 8 + lv * 25);
    items.push(
      this.add.rectangle(W / 2, 100, W - 60, 48, 0x1a1206).setStrokeStyle(1, 0x8b6932).setDepth(703),
      this.add.text(W / 2, 92, '전투력', this.textStyle(13, '#a08060')).setOrigin(0.5).setDepth(704),
      this.add.text(W / 2, 112, fmtGold(powerScore), this.titleStyle(22)).setOrigin(0.5).setDepth(704),
    );

    const row = (y: number, label: string, value: number, onMinus: () => void, onPlus: () => void) => {
      items.push(
        this.add.text(55, y, label, this.titleStyle(18)).setDepth(703),
      );
      const valText = this.add.text(W / 2, y + 2, `${Math.round(value * 100)}%`,
        this.textStyle(17, '#e8c36a')).setOrigin(0.5).setDepth(703);
      items.push(valText);
      const minus = this.add.text(W / 2 - 70, y, '◀', this.titleStyle(20)).setOrigin(0.5)
        .setInteractive().setDepth(703);
      const plus  = this.add.text(W / 2 + 70, y, '▶', this.titleStyle(20)).setOrigin(0.5)
        .setInteractive().setDepth(703);
      minus.on('pointerdown', () => { onMinus(); });
      plus.on('pointerdown', () => { onPlus(); });
      items.push(minus, plus);
      return valText;
    };

    const bgmText = row(175, '배경음악', bgmVol,
      () => { bgmVol = Math.max(0, bgmVol - 0.1); bgmSystem.setVolume(bgmVol); bgmText.setText(`${Math.round(bgmVol * 100)}%`); },
      () => { bgmVol = Math.min(1, bgmVol + 0.1); bgmSystem.setVolume(bgmVol); bgmText.setText(`${Math.round(bgmVol * 100)}%`); },
    );
    const sfxText = row(240, '효과음', sfxVol,
      () => { sfxVol = Math.max(0, sfxVol - 0.1); soundSystem.setVolume(sfxVol); sfxText.setText(`${Math.round(sfxVol * 100)}%`); },
      () => { sfxVol = Math.min(1, sfxVol + 0.1); soundSystem.setVolume(sfxVol); sfxText.setText(`${Math.round(sfxVol * 100)}%`); },
    );

    // Divider
    items.push(this.add.rectangle(W / 2, 305, W - 60, 1, 0x60451f).setDepth(703));

    // Tutorial restart
    const tutBtn = this.add.rectangle(W / 2, 355, 300, 48, 0x2a1f0e).setStrokeStyle(1, GOLD).setInteractive().setDepth(703);
    const tutLabel = this.add.text(W / 2, 355, '튜토리얼 다시 보기', this.textStyle(16, '#e8c36a')).setOrigin(0.5).setDepth(704);
    tutBtn.on('pointerdown', () => {
      this.closePanel();
      this.time.delayedCall(100, () => this.showTutorial(0));
    });
    items.push(tutBtn, tutLabel);

    // Reset save
    const resetBtn = this.add.rectangle(W / 2, 435, 300, 48, 0x2a1f0e).setStrokeStyle(1, 0x9c3b28).setInteractive().setDepth(703);
    const resetLabel = this.add.text(W / 2, 435, '세이브 초기화', this.textStyle(16, '#e05050')).setOrigin(0.5).setDepth(704);
    resetBtn.on('pointerdown', () => this.confirmReset(items));
    items.push(resetBtn, resetLabel);

    // Play time + version
    const totalSec = save.totalPlayTime ?? 0;
    const hours = Math.floor(totalSec / 3600);
    const mins  = Math.floor((totalSec % 3600) / 60);
    const playTimeStr = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
    items.push(
      this.add.text(W / 2, 503, `총 플레이: ${playTimeStr}`, this.textStyle(14, '#a0a090')).setOrigin(0.5).setDepth(703),
      this.add.text(W / 2, 528, '무공키우기 v1.0.0', this.textStyle(11, '#5a4a38')).setOrigin(0.5).setDepth(703),
    );

    // 기록 섹션
    items.push(
      this.add.rectangle(W / 2, 566, W - 60, 1, 0x60451f).setDepth(703),
      this.add.text(W / 2, 586, '무림 기록', this.titleStyle(17)).setOrigin(0.5).setDepth(703),
    );
    const statsLeft = 55;
    const statsRight = W / 2 + 20;
    const statEntries: [number, number, string, string][] = [
      [statsLeft,  616, '최고 웨이브', `${save.stageCleared}웨이브`],
      [statsRight, 616, '총 처치',     `${fmtGold(save.totalKills ?? 0)}명`],
      [statsLeft,  652, '보스 격파',   `${save.defeatedBosses?.length ?? 0} / 8`],
      [statsRight, 652, '환생',        `${save.rebirthCount ?? 0}회`],
      [statsLeft,  688, '해금 스킬',   `${save.unlockedSkills?.length ?? 0}종`],
      [statsRight, 688, '장비 보유',   `${save.equipmentInventory?.length ?? 0}개`],
    ];
    for (const [x, y, label, val] of statEntries) {
      items.push(
        this.add.text(x, y, label, this.textStyle(13, '#7a6a50')).setDepth(703),
        this.add.text(x, y + 20, val, this.textStyle(15, '#e8c36a')).setDepth(703),
      );
    }
  }

  private confirmReset(items: Phaser.GameObjects.GameObject[]): void {
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setInteractive().setDepth(800);
    const box = this.add.rectangle(W / 2, H / 2, 380, 220, 0x110c07).setStrokeStyle(2, 0x9c3b28).setDepth(801);
    const msg = this.add.text(W / 2, H / 2 - 60, '정말 초기화하시겠습니까?\n모든 진행이 삭제됩니다.', {
      ...this.textStyle(16, '#e8c36a'), align: 'center',
    }).setOrigin(0.5).setDepth(802);
    const yes = this.add.text(W / 2 - 70, H / 2 + 50, '초기화', this.titleStyle(20)).setOrigin(0.5)
      .setInteractive().setDepth(802);
    const no = this.add.text(W / 2 + 70, H / 2 + 50, '취소', this.titleStyle(20)).setOrigin(0.5)
      .setInteractive().setDepth(802);
    yes.on('pointerdown', () => {
      deleteSave();
      items.push(overlay, box, msg, yes, no);
      this.scene.restart();
    });
    no.on('pointerdown', () => {
      [overlay, box, msg, yes, no].forEach(o => o.destroy());
    });
    items.push(overlay, box, msg, yes, no);
  }

  // ─── Shop Panel ───────────────────────────────────────────────────────────

  private buildShop(items: Phaser.GameObjects.GameObject[]): void {
    const save = loadGame();
    const today = new Date().toLocaleDateString('en-CA');
    const TABS: ['DAILY' | 'SKILLS' | 'GEMS', string][] = [['DAILY', '일일상점'], ['SKILLS', '무공구매'], ['GEMS', '원보']];

    TABS.forEach(([tab, label], i) => {
      const x = 90 + i * 130;
      const btn = this.add.rectangle(x, 115, 115, 36, this.shopTab === tab ? 0x4a3520 : 0x1e1409)
        .setStrokeStyle(1, this.shopTab === tab ? GOLD : 0x60451f).setInteractive().setDepth(703);
      const txt = this.add.text(x, 115, label, this.textStyle(14, this.shopTab === tab ? '#e8c36a' : '#8a7a60'))
        .setOrigin(0.5).setDepth(704);
      btn.on('pointerdown', () => {
        this.shopTab = tab;
        this.closePanel();
        this.openPanel('SHOP');
      });
      items.push(btn, txt);
    });

    const contentY = 150;

    if (this.shopTab === 'DAILY') {
      const purchased = save.shopLastReset === today ? (save.shopDailyPurchased ?? []) : [];
      const dailyItems: Array<{ id: string; name: string; cost: number; reward: string }> = [
        { id: 'daily_gold_sm', name: '소 금괴', cost: 10, reward: '금화 500' },
        { id: 'daily_gold_lg', name: '대 금괴', cost: 50, reward: '금화 3000' },
        { id: 'daily_exp_sm', name: '수련서 (소)', cost: 15, reward: 'EXP 2000' },
        { id: 'daily_exp_lg', name: '수련서 (대)', cost: 80, reward: 'EXP 15000' },
        { id: 'daily_skill_scroll', name: '무공 비급', cost: 30, reward: '무공 해금 1회' },
      ];

      items.push(this.add.text(W / 2, contentY + 10, `일일 초기화: ${today}`, this.textStyle(12, '#7a6a50')).setOrigin(0.5).setDepth(703));

      dailyItems.forEach((item, i) => {
        const y = contentY + 55 + i * 100;
        const bought = purchased.includes(item.id);
        const card = this.add.rectangle(W / 2, y, W - 60, 86, bought ? 0x111111 : 0x1e1409)
          .setStrokeStyle(1, bought ? 0x333333 : 0x60451f).setDepth(703);
        const name = this.add.text(80, y - 20, item.name, this.titleStyle(16)).setDepth(704);
        const reward = this.add.text(80, y + 5, item.reward, this.textStyle(13, '#a0e080')).setDepth(704);
        const costTxt = this.add.text(W - 120, y - 20, `💎 ${item.cost}`, this.textStyle(14, '#a0c8ff')).setDepth(704);
        const buyBtn = this.add.rectangle(W - 100, y + 15, 90, 30, bought ? 0x333333 : 0x2d4d1e)
          .setStrokeStyle(1, bought ? 0x444444 : 0x5a9d2f).setInteractive().setDepth(703);
        const buyTxt = this.add.text(W - 100, y + 15, bought ? '구매완료' : '구매', this.textStyle(13, bought ? '#555555' : '#a0e080'))
          .setOrigin(0.5).setDepth(704);
        if (!bought) {
          buyBtn.on('pointerdown', () => {
            const gems = save.gems ?? 0;
            if (gems < item.cost) { this.showNotice('원보가 부족합니다'); return; }
            save.gems = gems - item.cost;
            if (item.id === 'daily_gold_sm') save.gold += 500;
            else if (item.id === 'daily_gold_lg') save.gold += 3000;
            else if (item.id === 'daily_exp_sm') save.exp += 2000;
            else if (item.id === 'daily_exp_lg') save.exp += 15000;
            else if (item.id === 'daily_skill_scroll') {
              const locked = [...SKILL_DATABASE.values()].filter(s => !save.unlockedSkills.includes(s.id));
              if (locked.length > 0) {
                const random = locked[Math.floor(Math.random() * locked.length)];
                save.unlockedSkills.push(random.id);
                save.inventory[random.id] = (save.inventory[random.id] ?? 0) + 1;
              }
            }
            save.shopLastReset = today;
            save.shopDailyPurchased = [...purchased, item.id];
            saveGame(save);
            soundSystem.play('synth_ok');
            this.closePanel();
            this.openPanel('SHOP');
          });
        }
        items.push(card, name, reward, costTxt, buyBtn, buyTxt);
      });
    } else if (this.shopTab === 'SKILLS') {
      const grades: Array<{ grade: string; label: string; cost: number }> = [
        { grade: 'LOW',      label: '하급 무공 비급',  cost: 20  },
        { grade: 'MID',      label: '중급 무공 비급',  cost: 80  },
        { grade: 'HIGH',     label: '상급 무공 비급',  cost: 250 },
        { grade: 'ULTIMATE', label: '절기 무공 비급',  cost: 800 },
      ];
      items.push(this.add.text(W / 2, contentY + 10, '원보로 무공 비급 구매', this.textStyle(14, '#a0a090')).setOrigin(0.5).setDepth(703));
      grades.forEach((g, i) => {
        const y = contentY + 70 + i * 110;
        const color = this.skillGradeColor(g.grade as SkillData['grade']);
        const colorHex = `#${color.toString(16).padStart(6, '0')}`;
        const card = this.add.rectangle(W / 2, y, W - 60, 94, 0x1e1409).setStrokeStyle(2, color).setDepth(703);
        const lbl = this.add.text(80, y - 22, g.label, { ...this.titleStyle(17), color: colorHex }).setDepth(704);
        const sub = this.add.text(80, y + 4, '무작위 해당 등급 무공 해금', this.textStyle(13, '#a0a090')).setDepth(704);
        const cost = this.add.text(W - 115, y - 22, `💎 ${g.cost}`, this.textStyle(14, '#a0c8ff')).setDepth(704);
        const btn = this.add.rectangle(W - 100, y + 18, 90, 30, 0x2d4d1e).setStrokeStyle(1, 0x5a9d2f).setInteractive().setDepth(703);
        const btnTxt = this.add.text(W - 100, y + 18, '구매', this.textStyle(13, '#a0e080')).setOrigin(0.5).setDepth(704);
        btn.on('pointerdown', () => {
          const gems = save.gems ?? 0;
          if (gems < g.cost) { this.showNotice('원보가 부족합니다'); return; }
          const pool = [...SKILL_DATABASE.values()].filter(s => s.grade === g.grade && !save.unlockedSkills.includes(s.id));
          if (pool.length === 0) { this.showNotice('해금할 무공이 없습니다'); return; }
          const skill = pool[Math.floor(Math.random() * pool.length)];
          save.gems = gems - g.cost;
          save.unlockedSkills.push(skill.id);
          save.inventory[skill.id] = (save.inventory[skill.id] ?? 0) + 1;
          saveGame(save);
          soundSystem.play('synth_ok');
          this.showNotice(`${skill.nameKo} 획득!`);
          this.closePanel();
          this.openPanel('SHOP');
        });
        items.push(card, lbl, sub, cost, btn, btnTxt);
      });
    } else {
      // GEMS tab
      const gems = save.gems ?? 0;
      items.push(
        this.add.text(W / 2, contentY + 10, `보유 원보: 💎 ${gems}`, this.titleStyle(18)).setOrigin(0.5).setDepth(703),
        this.add.text(W / 2, contentY + 46, '(매일 무료 원보 지급 예정)', this.textStyle(13, '#7a6a50')).setOrigin(0.5).setDepth(703),
      );
      const freeKey = `gem_free_${today}`;
      const gotFree = (save.shopDailyPurchased ?? []).includes(freeKey);
      const freeBtn = this.add.rectangle(W / 2, contentY + 100, 260, 52, gotFree ? 0x111111 : 0x1a2d0e)
        .setStrokeStyle(1, gotFree ? 0x333333 : GOLD).setInteractive().setDepth(703);
      const freeTxt = this.add.text(W / 2, contentY + 100, gotFree ? '오늘 이미 수령함' : '💎 무료 원보 10개 받기', this.textStyle(15, gotFree ? '#555' : '#a0c8ff'))
        .setOrigin(0.5).setDepth(704);
      if (!gotFree) {
        freeBtn.on('pointerdown', () => {
          save.gems = (save.gems ?? 0) + 10;
          save.shopLastReset = today;
          save.shopDailyPurchased = [...(save.shopDailyPurchased ?? []), freeKey];
          saveGame(save);
          soundSystem.play('synth_ok');
          this.showNotice('💎 원보 10개 획득!');
          this.closePanel();
          this.openPanel('SHOP');
        });
      }
      items.push(freeBtn, freeTxt);
      items.push(this.add.text(W / 2, contentY + 180, '원보 획득 방법:', this.titleStyle(16)).setOrigin(0.5).setDepth(703));
      const tips = ['• 임무 완료 보상', '• 보스 첫 격파 시', '• 매일 무료 수령', '• 업적 달성 보상'];
      tips.forEach((tip, i) => {
        items.push(this.add.text(W / 2, contentY + 220 + i * 36, tip, this.textStyle(14, '#a0a090')).setOrigin(0.5).setDepth(703));
      });
    }
  }

  // ─── Tutorial System ──────────────────────────────────────────────────────

  private showTutorial(step: number): void {
    this.tutorialOverlay?.destroy(true);
    this.tutorialOverlay = null;

    const steps: Array<{ title: string; body: string; highlight?: { x: number; y: number; r: number } }> = [
      {
        title: '⚔ 무공키우기에 오신 것을 환영합니다!',
        body: '화면을 터치하면 자동으로 전투합니다.\n적을 처치해 경험치와 금화를 획득하세요.',
      },
      {
        title: '🎯 스킬 사용하기',
        body: '하단 스킬 버튼을 눌러 무공을 시전하세요.\n쿨다운이 차면 자동으로 사용됩니다.',
        highlight: { x: W / 2, y: 860, r: 60 },
      },
      {
        title: '💨 경공 (회피)',
        body: '경공 버튼으로 적의 공격을 피하세요.\n무적 시간이 있어 피격을 무효화합니다.',
        highlight: { x: W - 60, y: 860, r: 40 },
      },
      {
        title: '🔰 수련',
        body: '수련 패널에서 능력치를 강화하세요.\n공격력, 체력, 금화 획득량 등을 올릴 수 있습니다.',
        highlight: { x: 38, y: 910, r: 32 },
      },
      {
        title: '⚗ 무공 합성',
        body: '무공 관리 → 합성 탭에서 상위 무공을 만드세요.\n같은 무공 3개를 합성하면 상위 등급이 됩니다.',
        highlight: { x: W / 2 - 77, y: 910, r: 32 },
      },
      {
        title: '🏯 문파 & 도감',
        body: '문파에서 시설을 업그레이드하고,\n도감에서 수집한 정보를 확인하세요.',
        highlight: { x: W / 2 + 77, y: 910, r: 32 },
      },
      {
        title: '✅ 준비 완료!',
        body: '이제 강호를 평정할 준비가 되었습니다.\n무공을 갈고 닦아 천하제일이 되세요!',
      },
    ];

    const s = steps[Math.min(step, steps.length - 1)];
    const items: Phaser.GameObjects.GameObject[] = [];

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setInteractive().setDepth(900);
    items.push(dim);

    if (s.highlight) {
      const { x, y, r } = s.highlight;
      const hole = this.add.circle(x, y, r + 8, 0x000000, 0)
        .setStrokeStyle(3, GOLD).setDepth(901);
      this.tweens.add({ targets: hole, scaleX: 1.15, scaleY: 1.15, duration: 600, yoyo: true, repeat: -1 });
      items.push(hole);
    }

    const boxY = s.highlight && s.highlight.y < H / 2 ? H * 0.72 : H * 0.38;
    const box = this.add.rectangle(W / 2, boxY, W - 60, 220, 0x0d0905).setStrokeStyle(2, GOLD).setDepth(901);
    const title = this.add.text(W / 2, boxY - 75, s.title, { ...this.titleStyle(18), align: 'center' }).setOrigin(0.5).setDepth(902);
    const body  = this.add.text(W / 2, boxY - 10, s.body, { ...this.textStyle(15, '#c8b89a'), align: 'center', wordWrap: { width: W - 100 } }).setOrigin(0.5).setDepth(902);

    const isLast = step >= steps.length - 1;
    const nextBtn = this.add.rectangle(W / 2, boxY + 80, 220, 44, 0x2a1f0e).setStrokeStyle(2, GOLD).setInteractive().setDepth(902);
    const nextTxt = this.add.text(W / 2, boxY + 80, isLast ? '시작!' : `다음 (${step + 1}/${steps.length})`, this.titleStyle(18)).setOrigin(0.5).setDepth(903);

    nextBtn.on('pointerdown', () => {
      items.forEach(o => o.destroy());
      this.tutorialOverlay = null;
      if (isLast) {
        const save = loadGame();
        save.tutorialCompleted = true;
        saveGame(save);
      } else {
        this.showTutorial(step + 1);
      }
    });

    const stepDots = steps.map((_, i) => {
      const dot = this.add.circle(W / 2 - (steps.length - 1) * 12 + i * 24, boxY + 110, 5, i === step ? GOLD : 0x5a4a30).setDepth(903);
      return dot;
    });

    items.push(box, title, body, nextBtn, nextTxt, ...stepDots);
    this.tutorialOverlay = this.add.container(0, 0, items).setDepth(900);
  }

  private skillLabel(skill: SkillData | undefined): string {
    if (!skill) return '무공';
    if (SKILL_NAME_KO[skill.id]) return SKILL_NAME_KO[skill.id];
    const cls = CLASS_KO[skill.category as CharacterClass] ?? '무공';
    const grade = GRADE_KO[skill.grade] ?? '';
    return `${cls} ${grade}`.trim();
  }

  private gradeColor(item: EquipmentItem): number {
    return { COMMON: 0x777777, RARE: 0x3c8ed0, EPIC: 0x9a57d1, LEGENDARY: 0xd5a633 }[item.grade];
  }

  private updateCooldown(
    arc: Phaser.GameObjects.Arc | undefined,
    text: Phaser.GameObjects.Text | undefined,
    remaining: number,
    total: number,
  ): void {
    if (!arc || !text) return;
    const active = remaining > 0;
    arc.setVisible(active);
    text.setVisible(active);
    if (!active) return;

    const ratio = Phaser.Math.Clamp(remaining / Math.max(1, total), 0, 1);
    arc.setStartAngle(-90);
    arc.setEndAngle(-90 + 360 * ratio);
    text.setText((remaining / 1000).toFixed(1));
  }

  private skillGradeColor(grade: SkillData['grade']): number {
    return { LOW: 0x9c3b28, MID: 0x5a9d2f, HIGH: 0x2f8fc6, ULTIMATE: 0xd08a2f }[grade];
  }

  private showNotice(message: string): void {
    this.notif.setText(message).setAlpha(1);
    this.tweens.killTweensOf(this.notif);
    this.tweens.add({ targets: this.notif, alpha: 0, duration: 900, delay: 1300 });
  }

  private titleStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'serif', fontSize: `${size}px`, color: '#e8c36a', fontStyle: 'bold', stroke: '#1a0d03', strokeThickness: 3 };
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'sans-serif', fontSize: `${size}px`, color };
  }
}
