import Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/characters';
import { getExpToNextLevel, getStarterSkill } from '../data/skills';
import { rebirthAttackMul, rebirthPathBonuses } from '../data/combatBalance';
import { loadGame, saveGame } from '../systems/SaveSystem';
import { soundSystem } from '../systems/SoundSystem';

export type RebirthPath = 'standard' | 'warrior' | 'scholar';

interface RebirthSceneData {
  characterId: string;
}

const W = 540;
let H = 960;
const GOLD = 0xd4a74e;

const PATHS: { id: RebirthPath; title: string; desc: string; color: number }[] = [
  { id: 'standard', title: '표준 경로', desc: '영구 공격 +10%', color: 0x5a3d18 },
  { id: 'warrior', title: '무인 경로', desc: '공격 +10% · 최대 체력 +5%', color: 0x8b2020 },
  { id: 'scholar', title: '학자 경로', desc: '공격 +10% · 금화 수입 +10%', color: 0x2a4a7a },
];

export class RebirthScene extends Phaser.Scene {
  private characterId = 'sword_male';
  private selectedPath: RebirthPath = 'standard';

  constructor() {
    super({ key: 'RebirthScene' });
  }

  init(data: RebirthSceneData): void {
    this.characterId = data.characterId ?? loadGame().selectedCharacter ?? 'sword_male';
    this.selectedPath = 'standard';
  }

  create(): void {
    H = this.scale.height;
    const save = loadGame();
    const char = CHARACTER_MAP.get(this.characterId);
    const atkPct = Math.round((rebirthAttackMul(save.rebirthCount ?? 0) - 1) * 100);
    const paths = rebirthPathBonuses(save.rebirthPaths);

    this.add.rectangle(W / 2, H / 2, W, H, 0x050403, 0.96);
    this.add.rectangle(W / 2, H / 2, W - 36, H - 48, 0x0f0c08, 1).setStrokeStyle(3, GOLD);

    this.add.text(W / 2, 72, '환생 경로 선택', this.titleStyle(28)).setOrigin(0.5);
    this.add.text(W / 2, 118, `${char?.nameKo ?? '무인'}  ·  누적 환생 ${save.rebirthCount ?? 0}회`, this.textStyle(14, '#b7aa92')).setOrigin(0.5);
    this.add.text(W / 2, 148, `현재 영구 공격 +${atkPct}%  ·  HP×${paths.hpMul.toFixed(2)}  ·  금화×${paths.goldMul.toFixed(2)}`, this.textStyle(12, '#8a7d6a')).setOrigin(0.5);

    this.add.text(W / 2, 188, '진행을 초기화하고 영구 보너스를 획득합니다', this.textStyle(13, '#d4a74e')).setOrigin(0.5);
    this.add.text(W / 2, 212, '웨이브·레벨·수련·장비가 리셋됩니다 (환생 기록은 유지)', this.textStyle(11, '#6e6254')).setOrigin(0.5);

    const pathButtons: Phaser.GameObjects.Rectangle[] = [];
    PATHS.forEach((path, i) => {
      const y = 290 + i * 118;
      const btn = this.add.rectangle(W / 2, y, 420, 96, path.color, 0.92)
        .setStrokeStyle(2, i === 0 ? GOLD : 0x75572b)
        .setInteractive({ useHandCursor: true });
      this.add.text(W / 2, y - 22, path.title, this.titleStyle(20)).setOrigin(0.5);
      this.add.text(W / 2, y + 10, path.desc, this.textStyle(13, '#e8dcc0')).setOrigin(0.5);
      btn.on('pointerdown', () => {
        soundSystem.play('dash');
        this.selectedPath = path.id;
        pathButtons.forEach((b, j) => b.setStrokeStyle(2, j === i ? GOLD : 0x75572b));
      });
      pathButtons.push(btn);
    });

    const confirm = this.add.rectangle(W / 2, H - 160, 360, 56, 0x4a3215, 1)
      .setStrokeStyle(2, GOLD)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, H - 160, '환생 확정', this.titleStyle(22)).setOrigin(0.5);
    confirm.on('pointerdown', () => this.confirmRebirth());

    const cancel = this.add.rectangle(W / 2, H - 88, 280, 44, 0x17120d, 1)
      .setStrokeStyle(1, 0x555555)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, H - 88, '취소', this.textStyle(16, '#999999')).setOrigin(0.5);
    cancel.on('pointerdown', () => this.exitToBattle());

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private confirmRebirth(): void {
    const save = loadGame();
    const cls = CHARACTER_MAP.get(this.characterId)?.charClass ?? 'SWORD';
    const starter = getStarterSkill(cls);

    save.rebirthCount = (save.rebirthCount ?? 0) + 1;
    save.rebirthPaths = [...(save.rebirthPaths ?? []), this.selectedPath];

    // 진행 리셋
    save.stageCleared = 0;
    save.level = 1;
    save.exp = 0;
    save.expToNext = getExpToNextLevel(1);
    save.gold = 0;
    save.trainingLevels = { attack: 0, hp: 0, gold: 0, speed: 0, stamina: 0, crit: 0 };
    save.equipmentInventory = [];
    save.equippedItems = {};
    save.skillLevels = {};
    save.inventory = { [starter]: 1, chosangbi: 1 };
    save.equippedSkills = [starter];
    save.equippedDash = 'chosangbi';
    save.unlockedSkills = [starter, 'chosangbi'];
    save.defeatedBosses = [];
    save.totalKills = 0;
    save.deathCount = 0;
    save.activeBuffs = [];
    save.lastOfflineRewardAt = Date.now();

    saveGame(save);
    soundSystem.play('level_up');
    this.exitToBattle(1);
  }

  private exitToBattle(startWave = loadGame().stageCleared + 1): void {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('RebirthScene');
      this.scene.stop('BattleScene');
      this.scene.stop('UIScene');
      this.scene.start('BattleScene', { characterId: this.characterId, startWave: Math.max(1, startWave) });
      this.scene.start('UIScene', { characterId: this.characterId });
    });
  }

  private titleStyle(size: number, color = '#e8c36a'): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'serif', fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#1a0d03', strokeThickness: 3 };
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'sans-serif', fontSize: `${size}px`, color };
  }
}