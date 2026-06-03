import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import {
  ENEMY_DATABASE, getEnemyPoolForWave, getBossForWave,
  BOSS_RANK_NAMES, BOSS_RANK_COLORS,
} from '../data/enemies';
import {
  SKILL_DATABASE, getExpToNextLevel, getStarterSkill, getClassSkillByGrade,
} from '../data/skills';
import type { SkillData, BattleMode, StatusEffect } from '../data/types';
import { loadGame, saveGame } from '../systems/SaveSystem';
import {
  getBackgroundForWave, CHARACTER_MAP, type BackgroundTheme, type CharacterClass,
} from '../data/characters';
import { soundSystem } from '../systems/SoundSystem';
import { bgmSystem } from '../systems/BgmSystem';
import { createEquipment, createSetEquipment, dominantSetId, equippedItems, equipmentSetBonus } from '../data/equipment';
import { skillVfxKey } from '../data/assets';

/**
 * BattleScene - 상단 횡스크롤 자동전투 씬
 *
 * 화면 상단 60% (360 x 384)를 차지합니다.
 *
 * 혈교(血敎) 세계관 기반 보스 시스템:
 * - 5웨이브마다 혈교 위계에 따른 보스 등장
 * - 대주 → 단주 → 각주 → 마군 → 호법 → 사자 → 부교주 → 혈마
 * - 50웨이브 이후 강화 순환
 *
 * 상태이상 시스템:
 * - BLEED: 3초간 0.5초마다 데미지의 10% 추가 피해
 * - STUN: 지속시간 동안 적 행동 불가
 * - SLOW: 이동속도 50% 감소
 * - KNOCKBACK: 즉시 밀어내기
 */

const GAME_W = 540;
const BATTLE_H = 620;
const GROUND_Y = BATTLE_H - 130;
const SCROLL_SPEED = 40;
const MAX_ENEMIES = 8;

// ─── 난이도 조정(하향) 전역 배율 ───
// 방치형 게임에 맞춰 적 위협을 낮춰 편하게 진행되도록 한다.
const ENEMY_HP_MUL = 0.45;
const ENEMY_DMG_MUL = 0.12;
const BOSS_HP_MUL = 0.38;
const BOSS_DMG_MUL = 0.14;

/**
 * 보스 등급별 고유 스킬 정의.
 *
 * type 별 연출:
 * - projectiles: 보스 → 플레이어 방향으로 투사체 N발 (부채꼴)
 * - shockwave:   지면을 따라 밀려오는 충격파 (회피기로 회피 가능)
 * - rain:        하늘에서 떨어지는 낙하물 N개
 * - burst:       사방 투사체 + 화면 섬광 + 지면 충격파 (광역)
 */
interface BossSkillDef {
  readonly type: 'projectiles' | 'shockwave' | 'rain' | 'burst';
  readonly color: number;
  readonly count: number;
  readonly dmgMul: number;
  readonly nameKo: string;
}

const BOSS_SKILLS: Readonly<Record<string, BossSkillDef>> = {
  DAEJU:   { type: 'shockwave',   color: 0xcc8844, count: 1, dmgMul: 1.1, nameKo: '진각(震脚)' },
  DANJU:   { type: 'projectiles', color: 0xff5522, count: 3, dmgMul: 1.0, nameKo: '혈풍참(血風斬)' },
  GAKJU:   { type: 'projectiles', color: 0x9966dd, count: 5, dmgMul: 1.0, nameKo: '단혼격(斷魂擊)' },
  MAGUN:   { type: 'rain',        color: 0x44bbff, count: 6, dmgMul: 1.1, nameKo: '빙룡강림(氷龍降臨)' },
  HOBUP:   { type: 'shockwave',   color: 0xffcc33, count: 2, dmgMul: 1.2, nameKo: '금강진(金剛震)' },
  SAJA:    { type: 'projectiles', color: 0x8855cc, count: 6, dmgMul: 1.15, nameKo: '흑운탄(黑雲彈)' },
  BUGYOJU: { type: 'rain',        color: 0xff3366, count: 8, dmgMul: 1.15, nameKo: '혈우(血雨)' },
  HYEOLMA: { type: 'burst',       color: 0xff2222, count: 8, dmgMul: 1.3, nameKo: '혈마강세(血魔降世)' },
};

/**
 * 캐릭터별 공격 이펙트(슬래시) 색상.
 * 선택한 캐릭터마다 전투 이펙트 색이 달라진다.
 */
const CHAR_SLASH_COLORS: Readonly<Record<string, number>> = {
  sword_male:   0x66ccff, // 검객(남) - 청
  sword_female: 0x66ffee, // 여검객 - 청록
  dao_male:     0xff7733, // 도객(남) - 주황
  dao_female:   0xff5599, // 여도객 - 분홍
  fist_male:    0xffcc33, // 권사(남) - 금
  fist_female:  0xffe866, // 여권사 - 연금
  spear_male:   0x66ff88, // 창객(남) - 녹
  spear_female: 0x99ffbb, // 여창객 - 연녹
};

/** 상태이상이 적용된 적 추적 */
interface StatusInstance {
  enemy: Enemy;
  effect: StatusEffect;
  remaining: number;    // 남은 지속시간 (ms)
  tickTimer: number;    // 틱 타이머 (BLEED용)
  damage: number;       // 틱당 데미지 (BLEED용)
  originalSpeed: number; // 원래 속도 (SLOW 복구용)
}

interface CombatBonuses {
  attackMul: number;
  hpMul: number;
  goldMul: number;
  flatAttack: number;
  flatHp: number;
}

export class BattleScene extends Phaser.Scene {
  private player!: Player;
  private characterId: string = 'sword_male';
  private enemies: Enemy[] = [];
  private enemyPool: Enemy[] = [];

  private battleMode: BattleMode = 'AUTO';
  private killCount = 0;
  private waveNumber = 1;
  private waveEnemyTotal = 3;
  private waveSpawned = 0;
  private waveKilled = 0;
  private spawnTimer = 0;
  private spawnInterval = 1500;

  // 보스전 상태
  private isBossWave = false;
  private bossEnemy: Enemy | null = null;
  private bossAura: Phaser.GameObjects.Ellipse | null = null;
  private bossSkillTimer = 0;
  private bossSkillInterval = 3600;
  private bossHpBar: Phaser.GameObjects.Graphics | null = null;
  private bossHpBg: Phaser.GameObjects.Graphics | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;
  private bossWarningText: Phaser.GameObjects.Text | null = null;
  private bossRankText: Phaser.GameObjects.Text | null = null;

  // 횡스크롤 상태
  private scrollX = 0;
  private worldOffsetX = 0;
  private isMoving = true;
  private _isRevive = false;

  // 이펙트 풀
  private slashPool: Phaser.GameObjects.Sprite[] = [];

  // 배경 레이어 (패럴랙스)
  private bgMountains: Phaser.GameObjects.TileSprite | null = null;
  private bgGround: Phaser.GameObjects.TileSprite | null = null;
  private currentBgTheme: BackgroundTheme | null = null;

  // 상태이상 추적
  private statusEffects: StatusInstance[] = [];

  // 골드/경험치 세션 누적
  private sessionGold = 0;
  private sessionExp = 0;

  // 선택 캐릭터별 공격 이펙트 색
  private slashColor = 0xffffff;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: { characterId?: string; startWave?: number; isRevive?: boolean }): void {
    if (data.characterId) {
      this.characterId = data.characterId;
    }
    if (data.startWave) {
      this.waveNumber = data.startWave;
    }
    if (data.isRevive) {
      this._isRevive = true;
    }
  }

  create(): void {
    // 카메라를 상단 영역으로 제한
    this.cameras.main.setViewport(0, 0, GAME_W, BATTLE_H);
    this.cameras.main.setBackgroundColor('#1a0a2e');

    // 배경 생성 (패럴랙스 스크롤)
    this.createBackground();

    // 플레이어 생성 (선택한 캐릭터 ID 전달)
    this.player = new Player(this, 125, GROUND_Y, this.characterId);
    this.player.setOnHitCallback(this.onPlayerHit.bind(this));

    // 선택 캐릭터별 공격 이펙트 색 결정
    this.slashColor = CHAR_SLASH_COLORS[this.characterId] ?? 0xffffff;

    // 세이브 데이터 적용
    this.applySaveData();

    // 적 풀 초기화
    for (let i = 0; i < MAX_ENEMIES + 4; i++) {
      const enemy = new Enemy(this, -100, -100);
      this.enemyPool.push(enemy);
    }

    // 이펙트 풀 초기화
    for (let i = 0; i < 15; i++) {
      const fx = this.add.sprite(-100, -100, 'fx_slash_white');
      fx.setActive(false);
      fx.setVisible(false);
      this.slashPool.push(fx);
    }

    // 보스 HP바 UI 생성 (초기에는 숨김)
    this.createBossHpUI();

    // 상태이상 초기화
    this.statusEffects = [];
    this.sessionGold = 0;
    this.sessionExp = 0;

    // 적 공격 이벤트
    this.events.on('enemy-attack', this.onEnemyAttack, this);

    // UIScene에서 오는 이벤트
    this.events.on('toggle-battle-mode', this.toggleBattleMode, this);
    this.events.on('equip-changed', this.applySaveData, this);
    this.events.on('use-skill', this.onUseSkill, this);
    this.events.on('use-dash', this.onUseDash, this);

    // BGM 시작
    bgmSystem.play('battle');

    // 초기 웨이브 시작
    this.startWave(this.waveNumber);

    // 부활 시 HP 50% 회복 연출
    if (this._isRevive) {
      this._isRevive = false;
      this.time.delayedCall(300, () => {
        soundSystem.play('revive');
        this.player.heal(this.player.maxHp * 0.5, this.player.maxStamina);
        this.cameras.main.flash(400, 100, 200, 255);
        const reviveText = this.add.text(GAME_W / 2, BATTLE_H / 2, '✦ 부활 ✦', {
          fontSize: '20px', color: '#88aaff', fontFamily: 'monospace', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
        this.tweens.add({
          targets: reviveText, alpha: 0, y: reviveText.y - 30,
          duration: 1500, onComplete: () => reviveText.destroy(),
        });
      });
    }
  }

  update(time: number, delta: number): void {
    if (this.player.currentCharState === 'DEAD') {
      this.player.heal(this.player.maxHp, this.player.maxStamina);
    }
    this.player.update(time, delta);
    this.updateScroll(delta);
    this.updateBattleAI(delta);
    this.updateEnemies(time, delta);
    this.updateSpawning(delta);
    this.updateBackground();
    this.updateBossHpBar();
    this.updateBossSkill(delta);
    this.updateStatusEffects(delta);
    this.emitState();
  }

  // ─── 보스 HP바 UI ───

  private createBossHpUI(): void {
    this.bossNameText = this.add.text(GAME_W / 2, 10, '', {
      fontSize: '11px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false).setDepth(100);

    this.bossRankText = this.add.text(GAME_W / 2, 22, '', {
      fontSize: '8px',
      color: '#ffaa44',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false).setDepth(100);

    this.bossHpBg = this.add.graphics()
      .setScrollFactor(0).setVisible(false).setDepth(100);

    this.bossHpBar = this.add.graphics()
      .setScrollFactor(0).setVisible(false).setDepth(101);
  }

  private updateBossHpBar(): void {
    if (!this.isBossWave || !this.bossEnemy || !this.bossEnemy.active) return;
    if (!this.bossHpBar || !this.bossHpBg) return;

    const bossData = this.bossEnemy.data_;
    if (!bossData) return;

    const ratio = this.bossEnemy.hp / bossData.hp;
    const barWidth = GAME_W - 60;
    const barHeight = 10;
    const barX = 30;
    const barY = 32;

    this.bossHpBg.clear();
    this.bossHpBg.fillStyle(0x333333, 0.8);
    this.bossHpBg.fillRoundedRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 3);

    const bossRank = bossData.bossRank;
    let barColor = BOSS_RANK_COLORS[bossRank ?? 'DAEJU'] ?? 0xff2222;
    if (ratio <= 0.3) barColor = 0xcc0000;

    this.bossHpBar.clear();
    this.bossHpBar.fillStyle(barColor, 1);
    this.bossHpBar.fillRoundedRect(barX, barY, barWidth * ratio, barHeight, 2);

    if (this.bossNameText) {
      this.bossNameText.setText(`${bossData.title ?? bossData.name}  HP: ${this.bossEnemy.hp}/${bossData.hp}`);
    }
  }

  private showBossHpUI(bossData: { name: string; title?: string; bossRank?: string }): void {
    if (this.bossNameText) {
      this.bossNameText.setText(bossData.title ?? bossData.name);
      this.bossNameText.setVisible(true);
    }
    if (this.bossRankText) {
      const rankName = BOSS_RANK_NAMES[bossData.bossRank ?? ''] ?? '';
      this.bossRankText.setText(rankName ? `[ 혈교 ${rankName} ]` : '');
      this.bossRankText.setVisible(true);
    }
    if (this.bossHpBg) this.bossHpBg.setVisible(true);
    if (this.bossHpBar) this.bossHpBar.setVisible(true);
  }

  private hideBossHpUI(): void {
    if (this.bossNameText) this.bossNameText.setVisible(false);
    if (this.bossRankText) this.bossRankText.setVisible(false);
    if (this.bossHpBg) {
      this.bossHpBg.clear();
      this.bossHpBg.setVisible(false);
    }
    if (this.bossHpBar) {
      this.bossHpBar.clear();
      this.bossHpBar.setVisible(false);
    }
  }

  // ─── 보스 특수 스킬 ───

  /** 보스 오라를 보스 위치에 따라가게 하고, 주기적으로 특수 스킬을 시전 */
  private updateBossSkill(delta: number): void {
    if (!this.isBossWave || !this.bossEnemy || !this.bossEnemy.active) return;

    // 오라를 보스 발밑에 고정
    if (this.bossAura) {
      this.bossAura.x = this.bossEnemy.x;
      this.bossAura.y = this.bossEnemy.y + 26;
    }

    if (this.player.currentCharState === 'DEAD') return;

    this.bossSkillTimer += delta;
    if (this.bossSkillTimer >= this.bossSkillInterval) {
      this.bossSkillTimer = 0;
      const rank = this.bossEnemy.data_?.bossRank ?? 'DAEJU';
      this.executeBossSkill(rank);
    }
  }

  /** 보스 등급별 고유 스킬 실행 */
  private executeBossSkill(rank: string): void {
    const boss = this.bossEnemy;
    if (!boss || !boss.active) return;
    const def = BOSS_SKILLS[rank] ?? BOSS_SKILLS.DAEJU;
    const baseDmg = Math.max(2, Math.round((boss.data_?.damage ?? 10) * def.dmgMul));

    boss.playCastMotion();
    this.cameras.main.shake(140, 0.004);
    this.showBossSkillName(def.nameKo, def.color);
    soundSystem.play('boss_appear');

    const bx = boss.x;
    const by = boss.y - 12;
    const px = this.player.x;
    const py = this.player.y - 8;

    switch (def.type) {
      case 'projectiles': {
        for (let i = 0; i < def.count; i++) {
          const spread = (i - (def.count - 1) / 2) * 16;
          this.time.delayedCall(i * 90, () => {
            if (boss.active) this.spawnBossProjectile(bx, by, px, py + spread, def.color, baseDmg);
          });
        }
        break;
      }
      case 'shockwave': {
        for (let r = 0; r < def.count; r++) {
          this.time.delayedCall(r * 380, () => {
            if (boss.active) this.spawnGroundWave(boss.x, def.color, baseDmg);
          });
        }
        break;
      }
      case 'rain': {
        for (let i = 0; i < def.count; i++) {
          const tx = px + (Math.random() - 0.5) * 140;
          this.time.delayedCall(i * 110, () => {
            if (boss.active) this.spawnRainShard(tx, def.color, baseDmg);
          });
        }
        break;
      }
      case 'burst': {
        const r = (def.color >> 16) & 0xff;
        const g = (def.color >> 8) & 0xff;
        const b = def.color & 0xff;
        this.cameras.main.flash(220, r, g, b);
        for (let i = 0; i < def.count; i++) {
          const ang = (i / def.count) * Math.PI * 2;
          const tx = bx + Math.cos(ang) * 220;
          const ty = by + Math.sin(ang) * 140;
          this.spawnBossProjectile(bx, by, tx, ty, def.color, baseDmg);
        }
        this.time.delayedCall(450, () => {
          if (boss.active) this.spawnGroundWave(boss.x, def.color, baseDmg);
        });
        break;
      }
    }
  }

  /** 보스 투사체: 시작점 → 목표점으로 날아가 착탄 시 광역 판정 */
  private spawnBossProjectile(
    fromX: number, fromY: number, toX: number, toY: number, color: number, dmg: number,
  ): void {
    const proj = this.add.circle(fromX, fromY, 7, color, 0.95).setDepth(140);
    proj.setStrokeStyle(2, 0xffffff, 0.7);
    this.tweens.add({
      targets: proj,
      x: toX, y: toY,
      duration: 620,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.bossSkillImpact(proj.x, proj.y, color, dmg, 34);
        proj.destroy();
      },
    });
  }

  /** 지면 충격파: 보스 발밑에서 플레이어 쪽으로 밀려오는 파동 (회피 가능) */
  private spawnGroundWave(fromX: number, color: number, dmg: number): void {
    const wave = this.add.ellipse(fromX, GROUND_Y + 18, 26, 16, color, 0.7).setDepth(139);
    wave.setStrokeStyle(2, 0xffffff, 0.5);
    const dir = this.player.x < fromX ? -1 : 1;
    this.tweens.add({
      targets: wave,
      x: this.player.x + dir * 4,
      scaleX: 2.2, scaleY: 1.4,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.bossSkillImpact(wave.x, this.player.y, color, dmg, 40);
        wave.destroy();
      },
    });
  }

  /** 낙하물: 하늘에서 떨어져 지면 착탄 시 광역 판정 */
  private spawnRainShard(targetX: number, color: number, dmg: number): void {
    const shard = this.add.circle(targetX, 0, 6, color, 0.95).setDepth(140);
    shard.setStrokeStyle(2, 0xffffff, 0.6);
    // 착탄 지점 텔레그래프
    const marker = this.add.ellipse(targetX, GROUND_Y + 16, 28, 10, color, 0.3).setDepth(138);
    this.tweens.add({
      targets: shard,
      y: GROUND_Y,
      duration: 520,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.bossSkillImpact(targetX, GROUND_Y, color, dmg, 30);
        shard.destroy();
        marker.destroy();
      },
    });
  }

  /**
   * 보스 스킬 착탄 처리: 폭발 이펙트 + 범위 내 플레이어 피격.
   * 플레이어 피격은 evade/무적 판정을 거치는 applyPlayerHit 사용.
   */
  private bossSkillImpact(x: number, y: number, color: number, dmg: number, radius: number): void {
    const burst = this.add.circle(x, y, radius * 0.4, color, 0.8).setDepth(141);
    this.tweens.add({
      targets: burst, scaleX: 2.4, scaleY: 2.4, alpha: 0,
      duration: 240, onComplete: () => burst.destroy(),
    });
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    if (Math.sqrt(dx * dx + dy * dy) <= radius) {
      const hit = this.applyPlayerHit(dmg);
      if (hit) this.showEnemyHitImpact(this.player.x, this.player.y - 6);
    }
  }

  /** 보스 오라 제거 (트윈 정리 포함) */
  private destroyBossAura(): void {
    if (this.bossAura) {
      this.tweens.killTweensOf(this.bossAura);
      this.bossAura.destroy();
      this.bossAura = null;
    }
  }

  /** 보스 스킬명 표시 (화면 상단) */
  private showBossSkillName(nameKo: string, color: number): void {
    const colorStr = `#${color.toString(16).padStart(6, '0')}`;
    const text = this.add.text(GAME_W / 2, 52, nameKo, {
      fontSize: '13px', color: colorStr, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.tweens.add({
      targets: text, alpha: 0, y: text.y - 14,
      duration: 1100, ease: 'Power2', onComplete: () => text.destroy(),
    });
  }

  // ─── 횡스크롤 ───

  private updateScroll(delta: number): void {
    if (!this.isMoving) return;

    const hasNearbyEnemy = this.enemies.some(e =>
      e.active && Math.abs(e.x - this.player.x) < 120
    );

    if (!hasNearbyEnemy && this.player.currentCharState !== 'ATTACK') {
      this.scrollX += SCROLL_SPEED * (delta / 1000);
      this.worldOffsetX += SCROLL_SPEED * (delta / 1000);
      this.player.playRunAnim();
    } else {
      this.player.playIdleAnim();
    }
  }

  // ─── 전투 AI ───

  private updateBattleAI(_delta: number): void {
    if (this.battleMode !== 'AUTO') return;
    if (this.player.currentCharState === 'ATTACK' ||
        this.player.currentCharState === 'DASH' ||
        this.player.currentCharState === 'DEAD') return;

    let closest: Enemy | null = null;
    let closestDist = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const dist = Math.abs(enemy.x - this.player.x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    if (!closest) return;

    // 자동 회피: HP가 35% 미만이고 적이 매우 가까우면 회피기 사용 (가능할 때)
    const hpRatio = this.player.hp / this.player.maxHp;
    if (hpRatio < 0.35 && closestDist < 70) {
      if (this.player.handleDash()) return;
    }

    // 사거리 안의 적에게 "가장 강한" 스킬부터 자동 시전.
    // handleAttack 내부에서 쿨타임/기력을 검사하므로, 시전 가능한
    // 첫 스킬이 발동될 때까지 강→약 순으로 시도한다. (방치형 자동 플레이)
    const skills = this.player.skills;
    const order = skills
      .map((_, i) => i)
      .sort((a, b) => skills[b].damageMultiplier - skills[a].damageMultiplier);

    for (const i of order) {
      if (closestDist <= skills[i].range + 20) {
        if (this.player.handleAttack(i)) return;
      }
    }
  }

  private onUseSkill(slotIndex: number): void {
    // AUTO/MANUAL 모드와 무관하게 사용자 입력은 항상 받음.
    // (AUTO 모드는 추가로 가장 가까운 적을 향해 자동 발동)
    this.player.handleAttack(slotIndex);
  }

  private onUseDash(): void {
    this.player.handleDash();
  }

  // ─── 적 업데이트 ───

  private updateEnemies(time: number, delta: number): void {
    const activeEnemies: Enemy[] = [];

    for (const enemy of this.enemies) {
      if (enemy.active) {
        if (this.isMoving) {
          const hasNearby = this.enemies.some(e =>
            e.active && Math.abs(e.x - this.player.x) < 120
          );
          if (!hasNearby) {
            enemy.x -= SCROLL_SPEED * (delta / 1000);
          }
        }
        enemy.setTarget(this.player.x, this.player.y);
        enemy.update(time, delta);
        activeEnemies.push(enemy);
      } else {
        const drop = enemy.consumeDrop();
        if (drop) {
          this.handleDrop(drop.skillId, enemy.x, enemy.y);
        }

        const isBossDeath = (enemy === this.bossEnemy);
        const enemyData = enemy.data_;

        // 골드/경험치 보상
        if (enemyData) {
          this.awardRewards(enemyData.goldReward, enemyData.expReward, enemy.x, enemy.y);
        }

        // 사망 이펙트: 도트 파편 흩어지기
        this.spawnDeathParticles(enemy.x, enemy.y, enemyData?.tint);

        // 상태이상 정리
        this.statusEffects = this.statusEffects.filter(s => s.enemy !== enemy);

        this.enemyPool.push(enemy);
        this.killCount++;
        this.waveKilled++;

        // 총 처치 수 갱신
        const save = loadGame();
        this.ensureDailyMission(save);
        save.totalKills = (save.totalKills ?? 0) + 1;
        save.missionProgress = save.missionProgress ?? {};
        save.missionProgress.daily_kill = (save.missionProgress.daily_kill ?? 0) + 1;
        if (enemyData && (enemyData.rank === 'BOSS' || Math.random() < 0.22)) {
          save.equipmentInventory = save.equipmentInventory ?? [];
          save.equipmentInventory.push(createEquipment(enemyData.region ?? 1, undefined, enemyData.rank === 'BOSS'));
          if (save.equipmentInventory.length > 120) save.equipmentInventory.splice(0, save.equipmentInventory.length - 120);
        }
        saveGame(save);

        if (isBossDeath) {
          this.onBossDefeated();
        } else if (this.waveKilled >= this.waveEnemyTotal && this.waveSpawned >= this.waveEnemyTotal) {
          this.onWaveClear();
        }
      }
    }
    this.enemies = activeEnemies;
  }

  // ─── 스폰 ───

  private updateSpawning(delta: number): void {
    if (this.isBossWave) return;
    if (this.waveSpawned >= this.waveEnemyTotal) return;

    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }
  }

  private spawnEnemy(): void {
    const enemy = this.enemyPool.pop();
    if (!enemy) return;

    const pool = getEnemyPoolForWave(this.waveNumber);
    const enemyId = pool[Math.floor(Math.random() * pool.length)];
    const data = ENEMY_DATABASE.get(enemyId);
    if (!data) return;

    // 웨이브 스케일링: 웨이브가 높아질수록 적이 조금씩 강해짐 (난이도 배율 적용)
    const waveScale = 1 + (this.waveNumber - 1) * 0.015;
    const scaledData = {
      ...data,
      hp: Math.max(1, Math.round(data.hp * waveScale * ENEMY_HP_MUL)),
      damage: Math.max(1, Math.round(data.damage * (1 + (this.waveNumber - 1) * 0.012) * ENEMY_DMG_MUL)),
    };

    const spawnX = GAME_W + 60 + Math.random() * 80;
    const spawnY = GROUND_Y + (Math.random() - 0.5) * 16;

    enemy.activate(scaledData, spawnX, spawnY);
    if (data.tint !== undefined) {
      enemy.setTint(data.tint);
    } else {
      enemy.clearTint();
    }
    this.enemies.push(enemy);
    this.waveSpawned++;
  }

  private spawnBoss(): void {
    const enemy = this.enemyPool.pop();
    if (!enemy) return;

    const bossId = getBossForWave(this.waveNumber) ?? 'boss_daeju';
    const bossData = ENEMY_DATABASE.get(bossId);
    if (!bossData) return;

    // 50웨이브 이후 순환 시 추가 스케일링
    let hpMultiplier = 1;
    let dmgMultiplier = 1;
    if (this.waveNumber > 50) {
      const cycles = Math.floor((this.waveNumber - 50) / 40);
      hpMultiplier = 1 + cycles * 0.8;
      dmgMultiplier = 1 + cycles * 0.5;
    }

    const scaledBossData = {
      ...bossData,
      hp: Math.round(bossData.hp * hpMultiplier * BOSS_HP_MUL),
      damage: Math.round(bossData.damage * dmgMultiplier * BOSS_DMG_MUL),
    };

    const spawnX = GAME_W + 80;
    const spawnY = GROUND_Y;

    enemy.activate(scaledBossData, spawnX, spawnY);

    // 보스 등급에 따른 스케일
    const rankScales: Record<string, number> = {
      DAEJU: 0.9, DANJU: 0.95, GAKJU: 1.0, MAGUN: 1.05,
      HOBUP: 1.1, SAJA: 1.15, BUGYOJU: 1.2, HYEOLMA: 1.3,
    };
    const bossScale = rankScales[bossData.bossRank ?? 'DAEJU'] ?? 1.0;
    enemy.setScale(bossScale);
    enemy.setDepth(20); // 오라 위에 보스가 표시되도록

    if (bossData.tint !== undefined) {
      enemy.setTint(bossData.tint);
    } else {
      enemy.clearTint();
    }

    // 보스 오라(등급 색상): 발밑에서 맥동하는 글로우로 시각 차별화
    const auraColor = BOSS_RANK_COLORS[bossData.bossRank ?? ''] ?? 0xff2222;
    this.bossAura = this.add.ellipse(spawnX, spawnY + 26, 90, 28, auraColor, 0.4)
      .setDepth(19);
    this.tweens.add({
      targets: this.bossAura,
      scaleX: 1.25, scaleY: 1.25, alpha: 0.18,
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.bossSkillTimer = 0;
    this.bossEnemy = enemy;
    this.enemies.push(enemy);

    this.showBossHpUI(scaledBossData);
    soundSystem.play('boss_appear');
    this.cameras.main.shake(400, 0.01);

    // 보스 등장 경고 텍스트
    const rankName = BOSS_RANK_NAMES[bossData.bossRank ?? ''] ?? 'BOSS';
    const rankColor = BOSS_RANK_COLORS[bossData.bossRank ?? ''] ?? 0xff0000;
    const colorStr = `#${rankColor.toString(16).padStart(6, '0')}`;

    this.bossWarningText = this.add.text(GAME_W / 2, BATTLE_H / 2 - 30,
      `⚠ 혈교 ${rankName} ⚠`, {
      fontSize: '20px',
      color: colorStr,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // 보스 이름 표시
    const bossNameDisplay = this.add.text(GAME_W / 2, BATTLE_H / 2,
      scaledBossData.title ?? scaledBossData.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.tweens.add({
      targets: [this.bossWarningText, bossNameDisplay],
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => {
        if (this.bossWarningText) {
          this.bossWarningText.destroy();
          this.bossWarningText = null;
        }
        bossNameDisplay.destroy();
      },
    });
  }

  // ─── 웨이브 관리 ───

  private startWave(wave: number): void {
    this.waveNumber = wave;
    this.waveSpawned = 0;
    this.waveKilled = 0;
    this.spawnTimer = 0;
    this.isMoving = true;

    // 배경 전환 체크
    this.checkBackgroundChange();

    const bossId = getBossForWave(wave);
    this.isBossWave = bossId !== null;

    if (this.isBossWave) {
      this.waveEnemyTotal = 1;
      bgmSystem.play('boss');
      this.time.delayedCall(800, () => {
        this.spawnBoss();
      });
    } else {
      // 웨이브 적 수: 초반 적게, 점진적 증가, 최대 8 (난이도 추가 하향)
      this.waveEnemyTotal = Math.min(8, 2 + Math.floor(wave * 0.7));
      // 스폰 간격: 웨이브 높아질수록 빨라짐 (하한 700ms)
      this.spawnInterval = Math.max(700, 1500 - wave * 25);
    }
  }

  private checkBackgroundChange(): void {
    const theme = getBackgroundForWave(this.waveNumber);
    if (this.currentBgTheme && this.currentBgTheme.id === theme.id) return;

    this.currentBgTheme = theme;

    if (this.bgMountains) {
      this.bgMountains.setTexture(theme.mountainsKey);
      this.bgMountains.setSize(GAME_W, BATTLE_H);
    }
    if (this.bgGround) {
      this.bgGround.setTexture(theme.groundKey);
    }

    if (this.waveNumber > 1) {
      this.cameras.main.flash(200, 255, 255, 255, true);

      const regionText = this.add.text(GAME_W / 2, BATTLE_H / 2, `~ ${theme.nameKo} ~`, {
        fontSize: '16px',
        color: '#ffd740',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

      this.tweens.add({
        targets: regionText,
        alpha: 0,
        y: regionText.y - 20,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => { regionText.destroy(); },
      });
    }
  }

  private onWaveClear(): void {
    this.player.heal(this.player.maxHp * 0.8, this.player.maxStamina);
    soundSystem.play('level_up');

    const save = loadGame();
    save.stageCleared = Math.max(save.stageCleared, this.waveNumber);
    saveGame(save);

    this.events.emit('wave-clear', this.waveNumber);

    this.time.delayedCall(1000, () => {
      this.startWave(this.waveNumber + 1);
    });
  }

  private onBossDefeated(): void {
    soundSystem.play('boss_die');
    this.hideBossHpUI();
    this.destroyBossAura();

    const bossData = this.bossEnemy?.data_;
    this.isBossWave = false;
    this.bossEnemy = null;
    bgmSystem.play('battle');

    this.cameras.main.flash(300, 255, 215, 0);

    // 보스 처치 기록
    const save = loadGame();
    save.stageCleared = Math.max(save.stageCleared, this.waveNumber);
    if (bossData && !save.defeatedBosses?.includes(bossData.id)) {
      if (!save.defeatedBosses) save.defeatedBosses = [];
      save.defeatedBosses.push(bossData.id);
    }
    save.storyRegion = Math.max(save.storyRegion ?? 1, Math.min(8, (bossData?.region ?? 1) + 1));
    save.codexUnlocked = save.codexUnlocked ?? [];
    if (bossData && !save.codexUnlocked.includes(bossData.id)) save.codexUnlocked.push(bossData.id);
    const bonusGold = 80 + this.waveNumber * 12;
    const bonusExp = 120 + this.waveNumber * 18;
    save.gold += bonusGold;
    save.exp += bonusExp;
    save.equipmentInventory = save.equipmentInventory ?? [];
    if (bossData) {
      const rewardSlots = ['WEAPON', 'ARMOR', 'HELM', 'BOOTS', 'ACCESSORY', 'RELIC'] as const;
      const rewardSlot = rewardSlots[((bossData.region ?? 1) - 1) % rewardSlots.length];
      save.equipmentInventory.push(createSetEquipment(bossData.region ?? 1, rewardSlot, this.waveNumber >= 30 ? 'LEGENDARY' : undefined));
      if (save.equipmentInventory.length > 140) save.equipmentInventory.splice(0, save.equipmentInventory.length - 140);
    }
    const rewardGrade = this.waveNumber >= 20 ? 'ULTIMATE' : this.waveNumber >= 10 ? 'HIGH' : 'MID';
    const rewardSkillId = getClassSkillByGrade(this.playerClass, rewardGrade);
    save.inventory[rewardSkillId] = (save.inventory[rewardSkillId] ?? 0) + 1;
    if (!save.unlockedSkills.includes(rewardSkillId)) save.unlockedSkills.push(rewardSkillId);
    while (save.exp >= save.expToNext) {
      save.exp -= save.expToNext;
      save.level += 1;
      save.expToNext = getExpToNextLevel(save.level);
    }
    saveGame(save);

    const rankName = bossData?.bossRank ? BOSS_RANK_NAMES[bossData.bossRank] : '';
    const bossTitle = bossData?.title ?? bossData?.name ?? 'BOSS';

    const victoryText = this.add.text(GAME_W / 2, BATTLE_H / 2 - 20,
      `✦ ${rankName} 격파 ✦\n${bossTitle}`, {
      fontSize: '16px',
      color: '#ffd740',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.tweens.add({
      targets: victoryText,
      alpha: 0,
      y: victoryText.y - 30,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => { victoryText.destroy(); },
    });

    this.player.heal(this.player.maxHp, this.player.maxStamina);

    this.events.emit('boss-clear', this.waveNumber);
    this.events.emit('wave-clear', this.waveNumber);

    this.time.delayedCall(2000, () => {
      this.startWave(this.waveNumber + 1);
    });
  }

  // ─── 히트 판정 ───

  private onPlayerHit(hitX: number, hitY: number, skill: SkillData): void {
    if (skill.grade === 'ULTIMATE' || skill.grade === 'HIGH') {
      soundSystem.play('hit_heavy');
    } else {
      soundSystem.play('hit_light');
    }

    const hitRect = new Phaser.Geom.Rectangle(
      hitX - skill.hitboxSize.w / 2,
      hitY - skill.hitboxSize.h / 2,
      skill.hitboxSize.w,
      skill.hitboxSize.h,
    );

    this.showSlashEffect(hitX, hitY, skill);

    // 레벨 기반 데미지 보정
    const save = loadGame();
    const levelBonus = 1 + (save.level - 1) * 0.05;
    const skillLevel = save.skillLevels?.[skill.id] ?? 0;
    const skillUpgradeBonus = 1 + skillLevel * 0.08;
    const charDmgMul = this.player.characterDamageMul;
    const bonuses = this.getCombatBonuses(save);

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;

      const isBoss = (enemy === this.bossEnemy);
      const halfW = isBoss ? 24 : 16;
      const halfH = isBoss ? 36 : 24;

      const enemyRect = new Phaser.Geom.Rectangle(
        enemy.x - halfW, enemy.y - halfH, halfW * 2, halfH * 2,
      );

      if (Phaser.Geom.Rectangle.Overlaps(hitRect, enemyRect)) {
        const damage = Math.round((skill.damageMultiplier * 10 + bonuses.flatAttack) * charDmgMul * levelBonus * skillUpgradeBonus * bonuses.attackMul);
        const killed = enemy.takeDamage(damage);

        // 상태이상 적용
        if (!killed && skill.effect) {
          this.applyStatusEffect(enemy, skill, damage);
        }

        if (isBoss) {
          this.showDamageText(enemy.x, enemy.y - 40, damage, true);
        } else {
          this.showDamageText(enemy.x, enemy.y - 20, damage, false);
        }
      }
    }
  }

  // ─── 상태이상 시스템 ───

  private applyStatusEffect(enemy: Enemy, skill: SkillData, baseDamage: number): void {
    const effect = skill.effect;
    if (!effect) return;

    const chance = skill.effectChance ?? 0;
    if (Math.random() >= chance) return;

    const duration = skill.effectDuration ?? 1000;

    switch (effect) {
      case 'KNOCKBACK': {
        const isBoss = (enemy === this.bossEnemy);
        const knockForce = isBoss ? 60 : 150;
        enemy.applyKnockback(this.player.x, this.player.y, knockForce);
        break;
      }
      case 'BLEED': {
        // 기존 출혈 효과가 있으면 갱신
        const existing = this.statusEffects.find(
          s => s.enemy === enemy && s.effect === 'BLEED'
        );
        if (existing) {
          existing.remaining = duration;
          existing.damage = Math.round(baseDamage * 0.1);
        } else {
          this.statusEffects.push({
            enemy,
            effect: 'BLEED',
            remaining: duration,
            tickTimer: 0,
            damage: Math.round(baseDamage * 0.1),
            originalSpeed: 0,
          });
        }
        // 출혈 시각 효과
        enemy.setTint(0xff4444);
        break;
      }
      case 'STUN': {
        const existing = this.statusEffects.find(
          s => s.enemy === enemy && s.effect === 'STUN'
        );
        if (existing) {
          existing.remaining = duration;
        } else {
          this.statusEffects.push({
            enemy,
            effect: 'STUN',
            remaining: duration,
            tickTimer: 0,
            damage: 0,
            originalSpeed: 0,
          });
          enemy.setStunned(true);
        }
        // 기절 시각 효과
        this.showStatusIcon(enemy.x, enemy.y - 40, '💫');
        break;
      }
      case 'SLOW': {
        const existing = this.statusEffects.find(
          s => s.enemy === enemy && s.effect === 'SLOW'
        );
        if (existing) {
          existing.remaining = duration;
        } else {
          const origSpeed = enemy.getSpeed();
          enemy.setSpeedMultiplier(0.5);
          this.statusEffects.push({
            enemy,
            effect: 'SLOW',
            remaining: duration,
            tickTimer: 0,
            damage: 0,
            originalSpeed: origSpeed,
          });
          enemy.setTint(0x4488ff);
        }
        break;
      }
    }
  }

  private updateStatusEffects(delta: number): void {
    const expired: StatusInstance[] = [];

    for (const status of this.statusEffects) {
      if (!status.enemy.active) {
        expired.push(status);
        continue;
      }

      status.remaining -= delta;

      if (status.remaining <= 0) {
        expired.push(status);
        continue;
      }

      // 효과별 틱 처리
      if (status.effect === 'BLEED') {
        status.tickTimer += delta;
        if (status.tickTimer >= 500) {
          status.tickTimer -= 500;
          status.enemy.takeDamage(status.damage);
          this.showDamageText(
            status.enemy.x + (Math.random() - 0.5) * 10,
            status.enemy.y - 30,
            status.damage,
            false,
          );
        }
      }
    }

    // 만료된 상태이상 정리
    for (const status of expired) {
      if (status.effect === 'STUN' && status.enemy.active) {
        status.enemy.setStunned(false);
      }
      if (status.effect === 'SLOW' && status.enemy.active) {
        status.enemy.setSpeedMultiplier(1.0);
        status.enemy.clearTint();
      }
      if (status.effect === 'BLEED' && status.enemy.active) {
        status.enemy.clearTint();
      }
    }

    this.statusEffects = this.statusEffects.filter(s => !expired.includes(s));
  }

  private showStatusIcon(x: number, y: number, icon: string): void {
    const text = this.add.text(x, y, icon, {
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(150);

    this.tweens.add({
      targets: text,
      y: y - 16,
      alpha: 0,
      duration: 800,
      onComplete: () => { text.destroy(); },
    });
  }

  private onEnemyAttack(enemy: Enemy, damage: number): void {
    const hit = this.applyPlayerHit(damage);
    if (hit) {
      // 타격 임팩트 이펙트 (적 → 플레이어 사이 충돌 지점)
      const impactX = (this.player.x + enemy.x) / 2;
      this.showEnemyHitImpact(impactX, this.player.y - 6);
    }
  }

  /**
   * 플레이어 피격 공통 처리 (자동 회피 확률 포함).
   *
   * 방치형 자동 사냥 중, 레벨에 비례하는 확률로 공격을 자동 회피한다.
   *   회피 확률 = 12% + (레벨-1) × 2%, 최대 60%
   * 회피 성공 시 무피해 + "회피!" 연출, 실패 시에만 데미지.
   *
   * @returns 실제 피격 여부 (회피했으면 false)
   */
  private applyPlayerHit(damage: number): boolean {
    if (this.player.currentCharState === 'DEAD') return false;

    const save = loadGame();
    const evadeChance = Math.min(0.7, 0.18 + (save.level - 1) * 0.025);
    if (Math.random() < evadeChance) {
      this.player.playEvade();
      soundSystem.play('dash');
      const t = this.add.text(this.player.x, this.player.y - 34, '회피!', {
        fontSize: '11px', color: '#88ddff', fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(160);
      this.tweens.add({
        targets: t, y: t.y - 18, alpha: 0, duration: 600,
        onComplete: () => t.destroy(),
      });
      return false;
    }

    const bonuses = this.getCombatBonuses(save);
    const reducedDamage = Math.max(1, Math.round(damage / bonuses.hpMul - bonuses.flatHp * 0.015));
    this.player.takeDamage(reducedDamage);
    soundSystem.play('player_hurt');
    return true;
  }

  /**
   * 적 공격 타격 시 충격 이펙트.
   * 붉은 파편이 사방으로 튀고 짧은 섬광이 번쩍인다.
   */
  private showEnemyHitImpact(x: number, y: number): void {
    // 섬광
    const flash = this.add.circle(x, y, 10, 0xffdddd, 0.9).setDepth(135);
    this.tweens.add({
      targets: flash,
      scaleX: 1.8, scaleY: 1.8, alpha: 0,
      duration: 160,
      onComplete: () => flash.destroy(),
    });
    // 붉은 파편
    const count = 5;
    for (let i = 0; i < count; i++) {
      const p = this.add.rectangle(x, y, 3, 3, 0xff4444).setDepth(136);
      const ang = Math.PI * (0.15 + Math.random() * 0.7); // 위쪽 반원
      const spd = 35 + Math.random() * 45;
      this.tweens.add({
        targets: p,
        x: x - Math.cos(ang) * spd,
        y: y - Math.sin(ang) * spd,
        alpha: 0,
        duration: 220 + Math.random() * 120,
        ease: 'Power2',
        onComplete: () => p.destroy(),
      });
    }
  }

  // ─── 골드/경험치 보상 ───

  private awardRewards(gold: number, exp: number, x: number, y: number): void {
    const save = loadGame();
    const bonuses = this.getCombatBonuses(save);
    const finalGold = Math.max(0, Math.round(gold * bonuses.goldMul));
    save.gold += finalGold;
    save.exp += exp;
    this.sessionGold += finalGold;
    this.sessionExp += exp;

    // 레벨업 체크
    let leveledUp = false;
    while (save.exp >= save.expToNext) {
      save.exp -= save.expToNext;
      save.level += 1;
      save.expToNext = getExpToNextLevel(save.level);
      leveledUp = true;
    }

    saveGame(save);

    if (leveledUp) {
      soundSystem.play('level_up');
      const lvlText = this.add.text(this.player.x, this.player.y - 50, `LEVEL UP! Lv.${save.level}`, {
        fontSize: '14px',
        color: '#ffd740',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(200);

      this.tweens.add({
        targets: lvlText,
        y: lvlText.y - 30,
        alpha: 0,
        duration: 2000,
        onComplete: () => { lvlText.destroy(); },
      });

      this.events.emit('level-up', save.level);
    }

    // 골드 획득 표시 (작은 텍스트)
    if (finalGold > 0) {
      const goldText = this.add.text(x + 10, y - 8, `+${finalGold}G`, {
        fontSize: '8px',
        color: '#ffd740',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(150);

      this.tweens.add({
        targets: goldText,
        y: goldText.y - 16,
        alpha: 0,
        duration: 800,
        onComplete: () => { goldText.destroy(); },
      });
    }
  }

  // ─── 배경 ───

  private createBackground(): void {
    const theme = getBackgroundForWave(this.waveNumber);
    this.currentBgTheme = theme;

    this.bgMountains = this.add.tileSprite(0, 0, GAME_W, BATTLE_H, 'background_main')
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.bgGround = null;
  }

  private updateBackground(): void {
    // 패럴랙스 효과: 산은 느리게, 바닥은 빠르게
    if (this.bgMountains) this.bgMountains.tilePositionX = this.scrollX * 0.15;
    if (this.bgGround) this.bgGround.tilePositionX = this.scrollX * 1.0;
  }

  // ─── 이펙트 ───

  private showSlashEffect(x: number, y: number, skill: SkillData): void {
    // 이펙트 색: 스킬 오버라이드 → 캐릭터 기본색
    let baseTint = skill.effectColor ?? this.slashColor;
    if (skill.grade === 'HIGH' || skill.grade === 'ULTIMATE') {
      baseTint = Phaser.Display.Color.IntegerToColor(baseTint).brighten(20).color;
    }

    const effectType = skill.effectType ?? 'slash';

    if (effectType === 'multi') {
      this.showMultiSlash(x, y, skill, baseTint);
    } else if (effectType === 'wave') {
      this.showWaveSlash(x, y, skill, baseTint);
    } else if (effectType === 'burst') {
      this.showBurstSlash(x, y, skill, baseTint);
    } else {
      this.showSingleSlash(x, y, skill, baseTint);
    }

    // 등급별 화면 효과
    if (skill.grade === 'HIGH') {
      this.cameras.main.shake(80, 0.003);
    } else if (skill.grade === 'ULTIMATE') {
      this.cameras.main.shake(120, 0.006);
      this.cameras.main.flash(100, 255, 255, 255, true);
    }
  }

  private showSingleSlash(x: number, y: number, skill: SkillData, tint: number): void {
    const fx = this.slashPool.pop();
    if (!fx) return;
    fx.setTexture(skill.vfxKey ?? skillVfxKey(skill.id));
    fx.setTint(tint);
    fx.setPosition(x, y);
    fx.setActive(true);
    fx.setVisible(true);
    fx.setAlpha(1);
    fx.setScale(skill.hitboxSize.w / 32);
    fx.setFlipX(this.player.isFacingRight);
    this.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: fx.scaleX * 1.5,
      scaleY: fx.scaleY * 1.5,
      duration: 200,
      onComplete: () => {
        fx.setActive(false);
        fx.setVisible(false);
        fx.setScale(1);
        this.slashPool.push(fx);
      },
    });
  }

  private showMultiSlash(x: number, y: number, skill: SkillData, tint: number): void {
    // 2연속 슬래시: 약간 다른 위치·딜레이로 연타감 표현
    const offsets = [{ dx: 0, dy: 0, delay: 0 }, { dx: 10, dy: -6, delay: 70 }];
    for (const { dx, dy, delay } of offsets) {
      this.time.delayedCall(delay, () => {
        this.showSingleSlash(x + dx, y + dy, skill, tint);
      });
    }
  }

  private showWaveSlash(x: number, y: number, skill: SkillData, tint: number): void {
    const fx = this.slashPool.pop();
    if (!fx) return;
    fx.setTexture(skill.vfxKey ?? skillVfxKey(skill.id));
    fx.setTint(tint);
    fx.setPosition(x, y);
    fx.setActive(true);
    fx.setVisible(true);
    fx.setAlpha(1);
    const baseScale = skill.hitboxSize.w / 32;
    fx.setScale(baseScale * 1.8, baseScale * 0.7); // 가로로 넓게
    fx.setFlipX(this.player.isFacingRight);
    // y 진동 + 페이드
    let dir = 1;
    this.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: fx.scaleX * 1.3,
      duration: 280,
      onUpdate: () => {
        fx.y += dir * 0.8;
        dir *= -1;
      },
      onComplete: () => {
        fx.setActive(false);
        fx.setVisible(false);
        fx.setScale(1);
        this.slashPool.push(fx);
      },
    });
  }

  private showBurstSlash(x: number, y: number, skill: SkillData, tint: number): void {
    // 슬래시 + 원형 파티클 폭발
    this.showSingleSlash(x, y, skill, tint);

    const r = (tint >> 16) & 0xff;
    const g = (tint >> 8) & 0xff;
    const b = tint & 0xff;
    const radius = skill.hitboxSize.w * 0.35;

    const burst = this.add.graphics();
    burst.fillStyle(tint, 0.55);
    burst.fillCircle(0, 0, radius * 0.4);
    burst.lineStyle(2, tint, 0.8);
    burst.strokeCircle(0, 0, radius * 0.4);
    burst.setPosition(x, y);
    burst.setDepth(135);

    this.tweens.add({
      targets: burst,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => burst.destroy(),
    });

    // 화면 플래시 (색조 기반)
    this.cameras.main.flash(60, r, g, b, true);
  }

  private showDamageText(x: number, y: number, damage: number, isCritical: boolean): void {
    const fontSize = isCritical ? '16px' : '12px';
    const color = isCritical ? '#ffd740' : '#ff4444';

    const text = this.add.text(x, y, String(damage), {
      fontSize,
      color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: isCritical ? 2 : 0,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 24,
      alpha: 0,
      duration: 600,
      onComplete: () => { text.destroy(); },
    });
  }

  /**
   * 적 사망 시 도트 파편 이펙트
   *
   * 작은 사각형 파편 6~10개가 사방으로 흩어지며 사라집니다.
   * 적의 tint 색상을 반영하여 시각적 일관성을 유지합니다.
   */
  private spawnDeathParticles(x: number, y: number, tint?: number): void {
    soundSystem.play('enemy_die');
    const particleCount = 6 + Math.floor(Math.random() * 5);
    const baseColor = tint ?? 0xffffff;

    for (let i = 0; i < particleCount; i++) {
      const size = 2 + Math.floor(Math.random() * 4);
      const particle = this.add.rectangle(x, y, size, size, baseColor)
        .setDepth(120);

      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const targetX = x + Math.cos(angle) * speed;
      const targetY = y + Math.sin(angle) * speed;

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 300 + Math.random() * 300,
        ease: 'Power2',
        onComplete: () => { particle.destroy(); },
      });
    }
  }

  private handleDrop(dropSkillId: string, x: number, y: number): void {
    const dropped = SKILL_DATABASE.get(dropSkillId);
    if (!dropped) return;

    // 적 드랍 테이블은 검법 id를 등급별로 참조하므로, 드랍 등급을
    // 현재 캐릭터 계열의 동급 스킬로 환산해 지급한다 (권사는 권법 비급 획득).
    const skillId = getClassSkillByGrade(this.playerClass, dropped.grade);
    const skill = SKILL_DATABASE.get(skillId);
    if (!skill) return;

    const save = loadGame();
    save.inventory[skillId] = (save.inventory[skillId] ?? 0) + 1;
    if (!save.unlockedSkills.includes(skillId)) {
      save.unlockedSkills.push(skillId);
    }
    saveGame(save);

    let dropColor = '#aaaaaa';
    if (skill.grade === 'MID') dropColor = '#4fc3f7';
    if (skill.grade === 'HIGH') dropColor = '#ab47bc';
    if (skill.grade === 'ULTIMATE') dropColor = '#ffd740';

    const dropText = this.add.text(x, y - 8, `★ ${skill.nameKo}`, {
      fontSize: '10px',
      color: dropColor,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: '#000000cc',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);

    this.tweens.add({
      targets: dropText,
      y: y - 40,
      alpha: 0,
      duration: 1500,
      onComplete: () => { dropText.destroy(); },
    });

    this.events.emit('item-drop', skillId, skill.nameKo);
  }

  private getCombatBonuses(save: ReturnType<typeof loadGame>): CombatBonuses {
    const equipped = equippedItems(save.equipmentInventory ?? [], save.equippedItems);
    const sets = equipmentSetBonus(equipped);
    const training = save.trainingLevels ?? {};
    const research = save.sectResearch ?? {};
    const classResearch = research[this.playerClass] ?? 0;
    const disciples = save.disciples?.length ?? 0;
    const flatAttack = equipped.reduce((sum, item) => sum + item.attack + item.bonus, 0);
    const flatHp = equipped.reduce((sum, item) => sum + item.hp + item.bonus * 4, 0);

    return {
      attackMul: sets.attackMul * (1 + (training.attack ?? 0) * 0.02 + classResearch * 0.025 + disciples * 0.01),
      hpMul: sets.hpMul * (1 + (training.hp ?? 0) * 0.02),
      goldMul: sets.goldMul * (1 + (training.gold ?? 0) * 0.02),
      flatAttack,
      flatHp,
    };
  }

  // ─── 유틸 ───

  /** 현재 플레이어 캐릭터의 계열 */
  private get playerClass(): CharacterClass {
    return CHARACTER_MAP.get(this.characterId)?.charClass ?? 'SWORD';
  }

  private applySaveData(): void {
    const save = loadGame();
    const cls = this.playerClass;

    // 안전망: 장착 스킬 중 현재 계열과 다른 ACTIVE 스킬은 제외(구버전 세이브 교정).
    // MOVEMENT(회피기)는 계열 무관이라 유지.
    const valid = save.equippedSkills.filter(id => {
      const s = SKILL_DATABASE.get(id);
      return s && (s.category === cls || s.category === 'MOVEMENT');
    });
    if (valid.length === 0) valid.push(getStarterSkill(cls));

    valid.forEach((skillId, index) => {
      this.player.equipSkill(skillId, index);
    });
    if (save.equippedDash) {
      this.player.equipDash(save.equippedDash);
    }
    this.applyEquipmentSkin(save);
  }

  private applyEquipmentSkin(save = loadGame()): void {
    const currentItems = equippedItems(save.equipmentInventory ?? [], save.equippedItems);
    this.player.setEquipmentSetSkin(dominantSetId(currentItems, 4));
  }

  private ensureDailyMission(save: ReturnType<typeof loadGame>): void {
    const today = new Date().toLocaleDateString('en-CA');
    if (save.dailyMissionDate === today) return;
    save.dailyMissionDate = today;
    save.missionProgress = save.missionProgress ?? {};
    save.missionProgress.daily_kill = 0;
    save.missionClaims = (save.missionClaims ?? []).filter(id => !id.startsWith('daily_'));
  }

  private toggleBattleMode(): void {
    this.battleMode = this.battleMode === 'AUTO' ? 'MANUAL' : 'AUTO';
  }

  private emitState(): void {
    const save = loadGame();
    const dashSkill = this.player.dashSkill;
    this.events.emit('player-state', {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      skills: this.player.skills.map(s => ({
        id: s.id,
        nameKo: s.nameKo,
        cooldownRemaining: this.player.getSkillCooldownRemaining(s.id),
        cooldown: s.cooldown,
      })),
      dashCooldownRemaining: dashSkill ? this.player.getSkillCooldownRemaining(dashSkill.id) : 0,
      dashCooldown: dashSkill ? dashSkill.cooldown : 0,
      killCount: this.killCount,
      waveNumber: this.waveNumber,
      battleMode: this.battleMode,
      isBossWave: this.isBossWave,
      gold: save.gold,
      level: save.level,
      exp: save.exp,
      expToNext: save.expToNext,
    });
  }
}
