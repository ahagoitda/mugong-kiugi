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
import { createEquipment, createSetEquipment, dominantSetId, equippedItems, equipmentSetBonus, SET_TINTS } from '../data/equipment';
import { skillVfxKey } from '../data/assets';
import {
  HEROIC_MOTION_SEQUENCES, heroicAnimKey, heroicSheetKey, heroicSheetPath,
  cutinKey, HEROIC_FRAME_W, HEROIC_FRAME_H,
} from '../data/heroicMotions';
import {
  ENEMY_DMG_MUL, ENEMY_HP_MUL, BOSS_DMG_MUL, BOSS_HP_MUL,
  bossPost50Mul, calculateEvade, minionCycleDmgMul,
  rebirthAttackMul, rebirthPathBonuses,
} from '../data/combatBalance';

const BOSS_DIALOGUES: Record<string, string[]> = {
  boss_daeju:   ['혈교의 기운을 느꼈느냐...', '이곳을 통과하려면 내 시체를 밟고 가라!'],
  boss_danju:   ['약자는 강자의 양식이다.', '내 앞에 무릎 꿇어라!'],
  boss_gakju:   ['혈교의 힘을 보여주지.', '너 같은 하찮은 자가 감히!'],
  boss_magun:   ['마기를 두려워하지 않는 자가 왔군.', '그 용기, 여기서 끝내주마!'],
  boss_hobup:   ['멈춰라. 이 이상은 허용하지 않겠다.', '내 법도가 네 최후가 되리라!'],
  boss_saja:    ['혈교의 사자가 출동했다.', '이 세상에서 사라져라!'],
  boss_bugyoju: ['오랜만에 재미있는 상대로군.', '혈교 부교주를 상대하다니 영광이지!'],
  boss_hyeolma: ['드디어 이 자리까지 왔군...', '혈마의 힘 앞에 모든 것이 사라진다!'],
};

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
const SCROLL_SPEED = 32;          // 약간 느리게 (플레이어가 직접 움직이는 느낌 강조)
const MAX_ENEMIES = 8;

// Hollow Knight 스타일 자동 전투를 위한 포지셔닝 (고품질 모션 적용)
const PLAYER_MIN_X = 70;
const PLAYER_MAX_X = 320;
const IDEAL_MELEE_DIST = 95;
const IDEAL_RANGED_DIST = 140;

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

const BOSS_SKILL_NAMES: Readonly<Record<string, string>> = {
  DAEJU: '혈예 진각',
  DANJU: '적월 혈창',
  GAKJU: '유영환검',
  MAGUN: '비천강림',
  HOBUP: '금강지진',
  SAJA: '묵운산탄',
  BUGYOJU: '혈우',
  HYEOLMA: '혈마강세',
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
  speedMul: number;
  critChance: number;
}

export class BattleScene extends Phaser.Scene {
  private isGameOverTriggered = false;
  private battleH = 620;
  private groundY = 490;
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

  // 플레이어 아우라
  private playerAuraFeet: Phaser.GameObjects.Ellipse | null = null;
  private playerAuraBack: Phaser.GameObjects.Graphics | null = null;

  // 횡스크롤 상태
  private scrollX = 0;
  private worldOffsetX = 0;
  private isMoving = true;
  private _isRevive = false;

  // 이펙트 풀
  private slashPool: Phaser.GameObjects.Sprite[] = [];

  // 고품질 heroic 모션 오버레이 (무공 시전 시 픽셀 캐릭터 대신 표시)
  private heroicSprite: Phaser.GameObjects.Sprite | null = null;
  // 무공 컷인 일러스트 상태 (중복 표시 방지 + 스킬별 쿨다운)
  private cutinActive = false;
  private cutinLastShown: Map<string, number> = new Map();

  // 배경 레이어 (패럴랙스)
  private bgLayerBg: Phaser.GameObjects.TileSprite | null = null;
  private bgLayerMg: Phaser.GameObjects.TileSprite | null = null;
  private bgLayerFg: Phaser.GameObjects.TileSprite | null = null;
  private groundShadowLayer: Phaser.GameObjects.TileSprite | null = null;
  private foregroundMistLayer: Phaser.GameObjects.TileSprite | null = null;
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
    this.isGameOverTriggered = false;
    this.battleH = this.scale.height - 340;
    this.groundY = this.battleH - 130;

    // 같은 Scene 인스턴스가 재시작(게임오버 후 재도전 등)될 때
    // 이전 세션의 파괴된 오브젝트가 배열에 남아 있으면
    // 즉시 킬 처리되거나 파괴된 적을 풀에서 꺼내 크래시가 난다 — 반드시 초기화
    this.enemies = [];
    this.enemyPool = [];
    this.slashPool = [];
    this.bossEnemy = null;
    this.bossAura = null;
    this.isBossWave = false;
    this.killCount = 0;
    this.scrollX = 0;
    this.worldOffsetX = 0;
    this.isMoving = true;

    // 카메라를 상단 영역으로 제한
    this.cameras.main.setViewport(0, 0, GAME_W, this.battleH);
    this.cameras.main.setBackgroundColor('#1a0a2e');

    // 배경 생성 (패럴랙스 스크롤)
    this.createBackground();

    // 플레이어 생성 (선택한 캐릭터 ID 전달)
    this.player = new Player(this, 125, this.groundY, this.characterId);
    this.player.setDepth(10);
    this.player.setOnHitCallback(this.onPlayerHit.bind(this));

    // 플레이어 아우라 생성
    this.playerAuraFeet = this.add.ellipse(125, this.groundY + 100, 80, 24, 0xffffff, 0.35)
      .setVisible(false)
      .setDepth(8);
    
    this.playerAuraBack = this.add.graphics()
      .setVisible(false)
      .setDepth(9);

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

    // heroic 모션 오버레이 스프라이트 (시퀀스가 있는 캐릭터의 무공 시전 시 사용)
    this.heroicSprite = this.add.sprite(-200, -200, '__DEFAULT')
      .setOrigin(0.5, 0.92)
      .setDepth(11)
      .setVisible(false);
    this.cutinActive = false;
    this.cutinLastShown.clear();
    // 용량이 큰 heroic 시트는 선택한 캐릭터 것만 백그라운드 로딩
    this.loadHeroicSequences();

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
    this.events.on('request-retreat', this.retreatBoss, this);
    this.events.on('player-slash-fx', (x: number, y: number, skill: SkillData) => {
      this.showSlashEffect(x, y, skill);
    }, this);

    // BGM 시작
    bgmSystem.play('battle');

    // 초기 웨이브 시작
    this.startWave(this.waveNumber);

    // 메모리 누수 방지: 씬 종료 시 철저히 정리
    this.events.once('shutdown', this.handleShutdown, this);

    // 부활 시 HP 50% 회복 연출
    if (this._isRevive) {
      this._isRevive = false;
      this.time.delayedCall(300, () => {
        soundSystem.play('revive');
        this.player.heal(this.player.maxHp * 0.5, this.player.maxStamina);
        this.cameras.main.flash(400, 100, 200, 255);
        const reviveText = this.add.text(GAME_W / 2, this.battleH / 2, '✦ 부활 ✦', {
          fontSize: '20px', color: '#88aaff', fontFamily: 'monospace', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
        this.tweens.add({
          targets: reviveText, alpha: 0, y: reviveText.y - 30,
          duration: 1500, onComplete: () => reviveText.destroy(),
        });
      });
    }

    // ─── 데스크톱 / Windows 플레이 지원: 키보드 입력 (1,2,3 스킬 / Space 대시) ───
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-ONE', () => this.tryUseSkill(0));
      kb.on('keydown-2', () => this.tryUseSkill(1));
      kb.on('keydown-3', () => this.tryUseSkill(2));
      kb.on('keydown-SPACE', () => this.onUseDash());
      // F: 전체화면 토글 (Windows 플레이 편의)
      kb.on('keydown-F', () => {
        if (this.scale.isFullscreen) {
          this.scale.stopFullscreen();
        } else {
          this.scale.startFullscreen();
        }
      });
    }
  }

  update(time: number, delta: number): void {
    // heroic 모션 복귀는 사망 분기보다 먼저 (사망 연출이 가려지지 않도록)
    this.updateHeroicMotion();
    if (this.player.currentCharState === 'DEAD') {
      if (!this.isGameOverTriggered) {
        this.isGameOverTriggered = true;
        soundSystem.play('game_over');
        this.time.delayedCall(1200, () => {
          this.scene.start('GameOverScene', {
            waveNumber: this.waveNumber,
            killCount: this.killCount,
            characterId: this.characterId
          });
        });
      }
      return;
    }
    this.player.update(time, delta);

    // 공격 / 대시 중 고품질 모션 트레일
    this.updateMotionTrails(delta);

    // 발자국 먼지 (run 상태)
    this.updateFootDust(delta);

    // Hollow Knight 느낌의 동적 자동 전투 (포지셔닝 + 액션)
    this.updateAutoCombat(delta);

    this.updateEnemies(time, delta);
    this.updateSpawning(delta);
    this.updateBackground();
    this.updateBossHpBar();
    this.updateBossSkill(delta);
    this.updateStatusEffects(delta);
    this.updatePlayerAuraPosition(delta);
    this.emitState();
  }

  private trailTimer = 0;
  private footDustTimer = 0;

  private updateMotionTrails(delta: number): void {
    const state = this.player.currentCharState;
    const isFastAction = state === 'ATTACK' || state === 'DASH' || state === 'RUN';

    if (!isFastAction) {
      this.trailTimer = 0;
      return;
    }

    this.trailTimer += delta;

    let interval = 28;
    if (state === 'RUN') interval = 45;
    else if (state === 'DASH') interval = 18;

    if (this.trailTimer >= interval) {
      this.trailTimer = 0;
      const tKey = this.player.texture.key;
      let tint: number | undefined;
      let alpha = 0.25;
      let life = 140;

      if (state === 'DASH') {
        tint = 0x88ddff;
        alpha = 0.35;
        life = 180;
      } else if (state === 'RUN') {
        alpha = 0.15;
        life = 120;
      } else if (state === 'ATTACK') {
        alpha = 0.32;
        life = 200;
      }

      this.spawnAfterimage(
        this.player.x - (this.player.isFacingRight ? 10 : -10),
        this.player.y - 2,
        tKey,
        this.player.flipX,
        alpha,
        life,
        tint,
        state === 'RUN' ? 0.9 : 0.95
      );

      // extra for attack
      if (state === 'ATTACK') {
        this.spawnAfterimage(
          this.player.x - (this.player.isFacingRight ? 20 : -20),
          this.player.y + 3,
          tKey,
          this.player.flipX,
          0.18,
          130,
          undefined,
          0.92
        );
      }
    }
  }

  /** Hollow Knight 스타일 발자국 먼지 (run 중 주기적 + 공격 착지) */
  private updateFootDust(delta: number): void {
    const state = this.player.currentCharState;
    if (state !== 'RUN' && state !== 'ATTACK') {
      this.footDustTimer = 0;
      return;
    }

    this.footDustTimer += delta;
    const freq = state === 'RUN' ? 70 : 180;  // run more frequent
    if (this.footDustTimer > freq) {
      this.footDustTimer = 0;

      const dir = this.player.isFacingRight ? 1 : -1;
      const dx = -dir * (state === 'RUN' ? 16 : 8);
      const dust = this.add.ellipse(
        this.player.x + dx,
        GROUND_Y + 16,
        state === 'RUN' ? 10 : 14, 4,
        state === 'RUN' ? 0x554433 : 0x886644,
        0.5
      ).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);

      this.tweens.add({
        targets: dust,
        x: dust.x - dir * (state === 'RUN' ? 10 : 4),
        scaleX: state === 'RUN' ? 1.7 : 2.2,
        scaleY: 0.3,
        alpha: 0,
        duration: state === 'RUN' ? 220 : 300,
        ease: 'Quad.easeOut',
        onComplete: () => dust.destroy()
      });
    }
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
    this.showBossSkillName(BOSS_SKILL_NAMES[rank] ?? def.nameKo, def.color);
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
    const wave = this.add.ellipse(fromX, this.groundY + 18, 26, 16, color, 0.7).setDepth(139);
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
    const marker = this.add.ellipse(targetX, this.groundY + 16, 28, 10, color, 0.3).setDepth(138);
    this.tweens.add({
      targets: shard,
      y: this.groundY,
      duration: 520,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.bossSkillImpact(targetX, this.groundY, color, dmg, 30);
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

  // ─── Hollow Knight 스타일 자동사냥 전투 (동적 포지셔닝 + 액션) ───

  private updateAutoCombat(delta: number): void {
    if (!this.isMoving) return;

    const inAction = this.player.currentCharState === 'ATTACK' ||
                     this.player.currentCharState === 'DASH' ||
                     this.player.currentCharState === 'HIT' ||
                     this.player.currentCharState === 'DEAD';

    // 1. 위협 분석
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    let bossThreat = false;

    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.hp <= 0) continue;
      // 플레이어 우측에 있는 적만 (등 뒤의 적에게 스킬 낭비 방지)
      if (enemy.x <= this.player.x) continue;

      const dist = enemy.x - this.player.x;
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
      if (enemy === this.bossEnemy) bossThreat = true;
    }

    // 2. 플레이어 포지셔닝 목표 계산 (Hollow Knight 느낌의 spacing + 클래스별 모션)
    let desiredX = this.player.x;

    if (!inAction && closest) {
      const isMelee = this.player.skills.some(s => s.range < 70);
      let idealDist = isMelee ? IDEAL_MELEE_DIST : IDEAL_RANGED_DIST;

      // 클래스별 모션 강조 (고품질 비디오 참조)
      // fist: 더 공격적, 가까이
      // spear: 원거리 유지
      const charId = this.characterId || 'sword_male';
      if (charId.includes('fist')) idealDist = Math.max(60, idealDist - 20);
      else if (charId.includes('spear')) idealDist += 25;
      else if (charId.includes('dao')) idealDist += 10; // blade heavier feel

      // 적과 이상적인 거리 유지하면서 살짝 움직임
      if (closestDist > idealDist + 35) {
        // 앞으로 접근
        desiredX = closest.x - idealDist * (this.player.isFacingRight ? 0.7 : 1.3);
      } else if (closestDist < idealDist - 25) {
        // 살짝 물러남 (무거운 공격 후 리커버리 느낌)
        desiredX = closest.x - idealDist * 1.1;
      } else {
        // 적당히 유지하면서 미세하게 좌우 흔들 (생동감)
        const micro = Math.sin(this.time.now * 0.002) * 12;
        desiredX = this.player.x + micro;
      }

      // 보스 패턴 대응: 위험한 투사체/웨이브 올 때 뒤로 물러나기
      if (bossThreat && closestDist < 85) {
        desiredX = Math.min(this.player.x - 25, desiredX);
      }
    }

    // 월드 진행 (천천히, 플레이어가 움직이는 걸 더 강조)
    const shouldAdvance = !closest || closestDist > 160;
    if (shouldAdvance && !inAction) {
      this.scrollX += SCROLL_SPEED * 0.6 * (delta / 1000);
      this.worldOffsetX += SCROLL_SPEED * 0.6 * (delta / 1000);
      desiredX += 18; // 자연스럽게 앞으로 밀어줌
    }

    // 3. 실제 플레이어 이동 적용 (부드럽게)
    if (!inAction) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const dx = desiredX - this.player.x;
      const moveSpeed = 108;

      if (Math.abs(dx) > 4) {
        const vx = Phaser.Math.Clamp(dx * 4.0, -moveSpeed, moveSpeed);
        body.setVelocity(vx, 0);
        // run anim + 내부 flip 처리를 믿음
        this.player.playRunAnim();
      } else {
        body.setVelocity(0, 0);
        this.player.playIdleAnim();
      }

      // 화면 경계 클램프 (전투 공간을 제한해서 Hollow Knight 스타일 arena 느낌)
      this.player.x = Phaser.Math.Clamp(this.player.x, PLAYER_MIN_X, PLAYER_MAX_X);
    }

    // 4. 스킬 사용 결정 (기존 로직 + 상황 인식)
    if (this.battleMode === 'AUTO' && !inAction && closest) {
      const hpRatio = this.player.hp / this.player.maxHp;

      // Hollow Knight 스타일: 쿨타임 되면 적극적으로 대시로 리포지셔닝 (스타일리시 자동 플레이)
      const canStyleDash = Math.random() < 0.28 && closestDist > 55 && closestDist < 145;
      if ((hpRatio < 0.42 && closestDist < 70) || canStyleDash) {
        if (this.player.handleDash()) return;
      }

      const skills = this.player.skills;
      const sorted = skills
        .map((_, i) => i)
        .sort((a, b) => skills[b].damageMultiplier - skills[a].damageMultiplier);

      for (const i of sorted) {
        const sk = skills[i];
        const effectiveRange = sk.range + (sk.attackMotion === 'thrust' ? 15 : 0);

        if (closestDist <= effectiveRange + 18) {
          if (this.tryUseSkill(i)) {
            // 공격 직후 살짝 뒤로 빼는 느낌 (무거운 모션 후)
            if (sk.grade === 'HIGH' || sk.grade === 'ULTIMATE') {
              this.time.delayedCall(180, () => {
                if (this.player.currentCharState === 'IDLE' && closest && closest.active) {
                  const retreat = this.player.x - (this.player.isFacingRight ? 22 : -22);
                  this.player.x = Phaser.Math.Clamp(retreat, PLAYER_MIN_X, PLAYER_MAX_X);
                }
              });
            }
            return;
          }
        }
      }
    }
  }

  private onUseSkill(slotIndex: number): void {
    // AUTO/MANUAL 모드와 무관하게 사용자 입력은 항상 받음.
    // (AUTO 모드는 추가로 가장 가까운 적을 향해 자동 발동)
    this.tryUseSkill(slotIndex);
  }

  private tryUseSkill(slotIndex: number): boolean {
    const skill = this.player.skills[slotIndex];
    if (!skill) return false;
    const used = this.player.handleAttack(slotIndex);
    if (used) {
      this.showSkillCastTell(skill);
      this.playHeroicVisual(skill);
    }
    return used;
  }

  // ─── 고품질 heroic 모션 / 컷인 ───

  /**
   * 선택한 캐릭터의 heroic 12프레임 시트만 지연 로딩하고 애니메이션을 등록한다.
   * (시트당 ~280KB × 무공 수 — 부팅 시 전 캐릭터 분을 로드하면 낭비)
   * 로딩이 끝나기 전에는 playHeroicVisual 이 anims.exists 검사에서 걸러
   * 기존 픽셀 모션/컷인으로 자연스럽게 동작한다.
   */
  private loadHeroicSequences(): void {
    const sequences = HEROIC_MOTION_SEQUENCES.filter(s => s.characterId === this.characterId);
    if (sequences.length === 0) return;

    const registerAnims = () => {
      for (const seq of sequences) {
        const sheetKey = heroicSheetKey(seq.characterId, seq.skillId);
        const animKey = heroicAnimKey(seq.characterId, seq.skillId);
        if (!this.textures.exists(sheetKey) || this.anims.exists(animKey)) continue;
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: seq.frameCount - 1 }),
          frameRate: 16,
          repeat: 0,
        });
      }
    };

    const missing = sequences.filter(s => !this.textures.exists(heroicSheetKey(s.characterId, s.skillId)));
    if (missing.length === 0) {
      registerAnims();
      return;
    }
    for (const seq of missing) {
      this.load.spritesheet(
        heroicSheetKey(seq.characterId, seq.skillId),
        heroicSheetPath(seq.characterId, seq.skillId),
        { frameWidth: seq.frameWidth, frameHeight: seq.frameHeight },
      );
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, registerAnims);
    this.load.start();
  }

  /**
   * 무공 시전 시 고품질 일러스트 연출 적용.
   * 1) 12프레임 heroic 시퀀스가 있으면 → 픽셀 캐릭터를 잠시 숨기고 풀모션 재생
   * 2) 시퀀스가 없고 컷인 일러스트가 있으면 → 화면에 컷인 표시
   * 둘 다 없으면 기존 픽셀 모션 그대로.
   */
  private playHeroicVisual(skill: SkillData): void {
    const animKey = heroicAnimKey(this.characterId, skill.id);
    if (this.heroicSprite && this.anims.exists(animKey)) {
      this.playHeroicMotion(animKey);
      return;
    }
    const stillKey = cutinKey(this.characterId, skill.id);
    if (this.textures.exists(stillKey)) {
      this.showSkillCutin(stillKey, skill);
    }
  }

  private playHeroicMotion(animKey: string): void {
    if (!this.heroicSprite) return;
    // 먼저 애니메이션을 재생해 프레임(256x384)이 적용된 뒤 크기를 잡는다
    // (이전 텍스처 기준으로 setDisplaySize 하면 스케일이 틀어짐)
    this.heroicSprite.play(animKey, false);
    const displayH = 330;
    const displayW = displayH * (HEROIC_FRAME_W / HEROIC_FRAME_H);
    this.heroicSprite
      .setDisplaySize(displayW, displayH)
      .setPosition(this.player.x + 12, this.groundY + 90)
      .setVisible(true)
      .setAlpha(1);
    this.player.setVisible(false);
  }

  /** heroic 모션 종료 처리 — 공격 상태가 끝나면 픽셀 캐릭터로 복귀 */
  private updateHeroicMotion(): void {
    if (!this.heroicSprite || !this.heroicSprite.visible) return;
    if (this.player.currentCharState !== 'ATTACK') {
      this.heroicSprite.setVisible(false);
      this.player.setVisible(true); // 사망 시에도 쓰러지는 연출이 보여야 한다
    }
  }

  /** 무공 컷인 일러스트: 시전 순간 화면 왼쪽에 짧게 등장 */
  private showSkillCutin(texKey: string, skill: SkillData): void {
    const now = this.time.now;
    const last = this.cutinLastShown.get(texKey) ?? -999999;
    // 저등급 무공은 자주 시전되므로 컷인 반복 주기를 길게 둔다
    const minGap = (skill.grade === 'ULTIMATE' || skill.grade === 'HIGH') ? 4500 : 10000;
    if (this.cutinActive || now - last < minGap) return;
    this.cutinActive = true;
    this.cutinLastShown.set(texKey, now);

    const h = Math.min(310, this.battleH * 0.56);
    const w = h * (2 / 3);
    const targetX = 26 + w / 2;
    const y = this.battleH * 0.44;

    const img = this.add.image(targetX - 46, y, texKey)
      .setDisplaySize(w, h)
      .setAlpha(0)
      .setAngle(-3)
      .setScrollFactor(0)
      .setDepth(205);
    const border = this.add.rectangle(targetX - 46, y, w + 6, h + 6)
      .setStrokeStyle(2, 0xd6a84b, 0.95)
      .setFillStyle(0, 0)
      .setAlpha(0)
      .setAngle(-3)
      .setScrollFactor(0)
      .setDepth(206);

    const slide = (target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle) => {
      this.tweens.add({
        targets: target,
        x: targetX,
        alpha: 0.97,
        duration: 130,
        ease: 'Cubic.easeOut',
      });
    };
    slide(img);
    slide(border);

    this.time.delayedCall(620, () => {
      this.tweens.add({
        targets: [img, border],
        x: targetX + 34,
        alpha: 0,
        duration: 190,
        ease: 'Quad.easeIn',
        onComplete: () => {
          img.destroy();
          border.destroy();
          this.cutinActive = false;
        },
      });
    });
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
      damage: Math.max(1, Math.round(
        data.damage * (1 + (this.waveNumber - 1) * 0.012) * ENEMY_DMG_MUL * minionCycleDmgMul(this.waveNumber),
      )),
    };

    const spawnX = GAME_W + 60 + Math.random() * 80;

    enemy.activate(scaledData, spawnX, this.groundY);
    // 트리밍된 프레임 크기에 맞춰 발끝을 플레이어 발 위치(groundY+88)에 정렬
    enemy.y = this.groundY + 88 - enemy.displayHeight / 2 + (Math.random() - 0.5) * 14;
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

    const post50 = bossPost50Mul(this.waveNumber);
    const hpMultiplier = post50.hpMul;
    const dmgMultiplier = post50.dmgMul;

    const scaledBossData = {
      ...bossData,
      hp: Math.round(bossData.hp * hpMultiplier * BOSS_HP_MUL),
      damage: Math.round(bossData.damage * dmgMultiplier * BOSS_DMG_MUL),
    };

    const spawnX = GAME_W + 80;
    const spawnY = this.groundY;

    enemy.activate(scaledBossData, spawnX, spawnY);

    // 보스 등급에 따른 스케일
    const rankScales: Record<string, number> = {
      DAEJU: 0.9, DANJU: 0.95, GAKJU: 1.0, MAGUN: 1.05,
      HOBUP: 1.1, SAJA: 1.15, BUGYOJU: 1.2, HYEOLMA: 1.3,
    };
    const bossScale = rankScales[bossData.bossRank ?? 'DAEJU'] ?? 1.0;
    // 표시 크기에 대한 상대 배율 (절대 스케일을 덮어쓰면 원본 512px 기준으로 거대해짐)
    enemy.setScale(enemy.scaleX * bossScale, enemy.scaleY * bossScale);
    enemy.captureBaseScale(); // 이후 idle 호흡/공격 리셋이 보스 스케일을 유지하도록

    // 발끝을 지면에 정렬
    enemy.y = this.groundY + 88 - enemy.displayHeight / 2;
    enemy.setDepth(20); // 오라 위에 보스가 표시되도록

    if (bossData.tint !== undefined) {
      enemy.setTint(bossData.tint);
    } else {
      enemy.clearTint();
    }

    // 보스 오라(등급 색상): 발밑에서 맥동하는 글로우로 시각 차별화
    const auraColor = BOSS_RANK_COLORS[bossData.bossRank ?? ''] ?? 0xff2222;
    this.bossAura = this.add.ellipse(spawnX, this.groundY + 80, 90, 28, auraColor, 0.4)
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
    this.showBossCutscene(bossId, bossData.name);

    // 보스 등장 경고 텍스트
    const rankName = BOSS_RANK_NAMES[bossData.bossRank ?? ''] ?? 'BOSS';
    const rankColor = BOSS_RANK_COLORS[bossData.bossRank ?? ''] ?? 0xff0000;
    const colorStr = `#${rankColor.toString(16).padStart(6, '0')}`;

    this.bossWarningText = this.add.text(GAME_W / 2, this.battleH / 2 - 30,
      `⚠ 혈교 ${rankName} ⚠`, {
      fontSize: '20px',
      color: colorStr,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // 보스 이름 표시
    const bossNameDisplay = this.add.text(GAME_W / 2, this.battleH / 2,
      scaledBossData.title ?? scaledBossData.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // 보스 경고 프레임(ui_boss_warn_border) 연출 추가
    const warnBorder = this.add.image(GAME_W / 2, this.battleH / 2, 'ui_boss_warn_border')
      .setDisplaySize(GAME_W, this.battleH)
      .setScrollFactor(0)
      .setDepth(190)
      .setAlpha(0);

    this.tweens.add({
      targets: warnBorder,
      alpha: 0.82,
      duration: 400,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        warnBorder.destroy();
      }
    });

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

  private retreatBoss(): void {
    if (!this.isBossWave) return;

    // 보스/일반 적 제거 — 풀링 대상이므로 destroy 가 아닌 deactivate 후 풀에 반환
    // (destroy 하면 풀이 영구히 줄어들고 HP바 Graphics 가 누수된다)
    if (this.bossEnemy) {
      this.bossEnemy.deactivate();
      this.enemyPool.push(this.bossEnemy);
      this.bossEnemy = null;
    }
    this.enemies.forEach(e => {
      if (e && e.active) {
        e.deactivate();
        this.enemyPool.push(e);
      }
    });
    this.enemies = [];
    this.statusEffects = [];
    this.destroyBossAura();

    // 보스 HP 바 등 숨김
    if (this.bossHpBg) this.bossHpBg.setVisible(false);
    if (this.bossHpBar) this.bossHpBar.setVisible(false);
    if (this.bossNameText) this.bossNameText.setVisible(false);
    if (this.bossRankText) this.bossRankText.setVisible(false);

    // 보스 공격 타이머 등 초기화
    this.bossSkillTimer = 0;

    // 플레이어의 사망 방지 처리 (퇴각 시 무조건 생명력과 기력 100% 보정)
    this.player.heal(this.player.maxHp, this.player.maxStamina);

    // 이전 일반 웨이브로 회귀 (최소 1웨이브)
    const prevWave = Math.max(1, this.waveNumber - 1);
    this.isBossWave = false;
    
    // BGM 변경
    bgmSystem.play('battle');
    
    // 웨이브 재시작
    this.startWave(prevWave);
    
    // 알림 띄우기
    this.events.emit('show-notice', '보스 도전을 포기하고 퇴각했습니다.');
  }

  private checkBackgroundChange(): void {
    const theme = getBackgroundForWave(this.waveNumber);
    if (this.currentBgTheme && this.currentBgTheme.id === theme.id) return;

    this.currentBgTheme = theme;
    const id = theme.mountainsKey;

    if (this.bgLayerBg) this.bgLayerBg.setTexture(`${id}_bg`);
    if (this.bgLayerMg) this.bgLayerMg.setTexture(`${id}_mg`);
    if (this.bgLayerFg) this.bgLayerFg.setTexture(`${id}_fg`);

    if (this.waveNumber > 1) {
      this.cameras.main.flash(200, 255, 255, 255, true);

      const regionText = this.add.text(GAME_W / 2, this.battleH / 2, `~ ${theme.nameKo} ~`, {
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
    this.ensureDailyMission(save);
    save.missionProgress = save.missionProgress ?? {};
    save.missionProgress.daily_waves = (save.missionProgress.daily_waves ?? 0) + 1;
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
    this.ensureDailyMission(save);
    save.missionProgress = save.missionProgress ?? {};
    save.missionProgress.daily_boss = (save.missionProgress.daily_boss ?? 0) + 1;
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

    const victoryText = this.add.text(GAME_W / 2, this.battleH / 2 - 20,
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

    if (this.waveNumber === 50) {
      this.events.emit('rebirth-unlocked');
      const unlockText = this.add.text(GAME_W / 2, this.battleH / 2 + 40,
        '환생 해금!\n진행을 초기화하고 영구 공격 +10%를 얻을 수 있습니다', {
        fontSize: '13px', color: '#88ddff', fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2, align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
      this.tweens.add({
        targets: unlockText, alpha: 0, y: unlockText.y - 24, duration: 3200,
        onComplete: () => unlockText.destroy(),
      });
    }

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
      // 확대된 표시 크기에 맞춘 피격 판정 (트리밍 프레임 기준 몸통 영역)
      const halfW = isBoss ? 40 : 26;
      const halfH = isBoss ? 80 : 55;

      const enemyRect = new Phaser.Geom.Rectangle(
        enemy.x - halfW, enemy.y - halfH, halfW * 2, halfH * 2,
      );

      if (Phaser.Geom.Rectangle.Overlaps(hitRect, enemyRect)) {
        const isCrit = Math.random() < bonuses.critChance;
        const rebirthMul = rebirthAttackMul(save.rebirthCount ?? 0);
        const damage = Math.round((skill.damageMultiplier * 10 + bonuses.flatAttack) * charDmgMul * levelBonus * skillUpgradeBonus * bonuses.attackMul * rebirthMul * (isCrit ? 2 : 1));
        const killed = enemy.takeDamage(damage);

        // Hollow Knight 스타일 반동: 강한 공격은 적을 밀어냄
        if (!killed && (skill.grade === 'HIGH' || skill.grade === 'ULTIMATE' || Math.random() < 0.35)) {
          const knock = (skill.grade === 'ULTIMATE' ? 55 : 32);
          enemy.applyKnockback(this.player.x, this.player.y, knock);
        }

        // 상태이상 적용
        if (!killed && skill.effect) {
          this.applyStatusEffect(enemy, skill, damage);
        }

        if (isBoss) {
          this.showDamageText(enemy.x, enemy.y - 40, damage, true, skill.grade);
        } else {
          this.showDamageText(enemy.x, enemy.y - 20, damage, skill.grade === 'HIGH' || skill.grade === 'ULTIMATE', skill.grade);
        }
        this.showSkillImpactBurst(enemy.x, enemy.y - (isBoss ? 18 : 8), skill, isBoss);
        if (isBoss || skill.grade === 'HIGH' || skill.grade === 'ULTIMATE') {
          this.pulseHitStop(skill.grade === 'ULTIMATE' ? 70 : 45);
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
    const evadeChance = calculateEvade(save);
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
    save.missionProgress = save.missionProgress ?? {};
    save.missionProgress.daily_gold = (save.missionProgress.daily_gold ?? 0) + finalGold;
    this.sessionExp += exp;

    if (finalGold > 0) {
      this.showRewardText(x - 20, y - 50, `+${finalGold}G`, '#ffd740');
    }
    if (exp > 0) {
      this.showRewardText(x + 20, y - 50, `+${exp} EXP`, '#d580ff');
    }

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
    const id = theme.mountainsKey;

    this.bgLayerBg = this.add.tileSprite(0, 0, GAME_W, this.battleH, `${id}_bg`)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1);
    this.bgLayerBg.tileScaleX = 1.5;
    this.bgLayerBg.tileScaleY = this.battleH / 1024;

    this.bgLayerMg = this.add.tileSprite(0, 0, GAME_W, this.battleH, `${id}_mg`)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2);
    this.bgLayerMg.tileScaleX = 1.5;
    this.bgLayerMg.tileScaleY = this.battleH / 1024;

    this.bgLayerFg = this.add.tileSprite(0, 0, GAME_W, this.battleH, `${id}_fg`)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(3);
    this.bgLayerFg.tileScaleX = 1.5;
    this.bgLayerFg.tileScaleY = this.battleH / 1024;

    this.groundShadowLayer = this.add.tileSprite(0, this.groundY + 34, GAME_W, 106, `${id}_fg`)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(6)
      .setTint(0x080604)
      .setAlpha(0.42);
    this.groundShadowLayer.tileScaleX = 1.5;
    this.groundShadowLayer.tileScaleY = 0.22;

    this.foregroundMistLayer = this.add.tileSprite(0, this.groundY + 2, GAME_W, 72, `${id}_mg`)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(7)
      .setTint(0x6d7680)
      .setAlpha(0.16)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    this.foregroundMistLayer.tileScaleX = 1.5;
    this.foregroundMistLayer.tileScaleY = 0.18;

    this.add.rectangle(GAME_W / 2, 20, GAME_W, 120, 0x000000, 0.28)
      .setDepth(120)
      .setScrollFactor(0);
    this.add.rectangle(GAME_W / 2, this.battleH - 38, GAME_W, 120, 0x000000, 0.46)
      .setDepth(120)
      .setScrollFactor(0);
    this.add.rectangle(10, this.battleH / 2, 28, this.battleH, 0x000000, 0.28)
      .setDepth(120)
      .setScrollFactor(0);
    this.add.rectangle(GAME_W - 10, this.battleH / 2, 28, this.battleH, 0x000000, 0.28)
      .setDepth(120)
      .setScrollFactor(0);
  }

  private updateBackground(): void {
    if (this.bgLayerBg) this.bgLayerBg.tilePositionX = this.scrollX * 0.1;
    if (this.bgLayerMg) this.bgLayerMg.tilePositionX = this.scrollX * 0.45;
    if (this.bgLayerFg) this.bgLayerFg.tilePositionX = this.scrollX * 1.0;
    if (this.groundShadowLayer) this.groundShadowLayer.tilePositionX = this.scrollX * 1.08;
    if (this.foregroundMistLayer) this.foregroundMistLayer.tilePositionX = this.scrollX * 0.62;
  }

  // ─── 이펙트 ───

  private showSkillCastTell(skill: SkillData): void {
    soundSystem.play('skill_cast');
    let tint = skill.effectColor ?? this.slashColor;
    if (skill.grade === 'HIGH' || skill.grade === 'ULTIMATE') {
      tint = Phaser.Display.Color.IntegerToColor(tint).brighten(20).color;
    }

    const dir = this.player.isFacingRight ? 1 : -1;
    const x = this.player.x + dir * 34;
    const y = this.player.y - 8;
    const gradeScale = skill.grade === 'ULTIMATE' ? 1.5 : skill.grade === 'HIGH' ? 1.25 : 1;
    const windup = this.add.ellipse(x, y + 6, 28, 12, tint, 0.34)
      .setDepth(132)
      .setBlendMode(Phaser.BlendModes.ADD);
    windup.setStrokeStyle(2, 0xffffff, 0.55);

    this.tweens.add({
      targets: windup,
      scaleX: 2.1 * gradeScale,
      scaleY: 1.45 * gradeScale,
      alpha: 0,
      duration: skill.grade === 'ULTIMATE' ? 260 : 180,
      ease: 'Quad.easeOut',
      onComplete: () => windup.destroy(),
    });

    const streaks = skill.grade === 'ULTIMATE' ? 7 : skill.grade === 'HIGH' ? 5 : 3;
    for (let i = 0; i < streaks; i++) {
      const sy = y - 24 + Math.random() * 48;
      const sx = this.player.x - dir * (12 + Math.random() * 18);
      const line = this.add.rectangle(sx, sy, 28 + Math.random() * 28, 2, tint, 0.72)
        .setDepth(131)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setRotation((Math.random() - 0.5) * 0.35);
      this.tweens.add({
        targets: line,
        x: sx + dir * (42 + Math.random() * 34),
        alpha: 0,
        duration: 120 + Math.random() * 90,
        ease: 'Cubic.easeOut',
        onComplete: () => line.destroy(),
      });
    }

    if (skill.grade === 'ULTIMATE') {
      this.showScreenPulse(tint, 0.16, 170);
      this.cameras.main.shake(90, 0.004);
    }
    this.showCastAfterimages(tint, gradeScale);
    this.showGroundWindup(x, y + 44, tint, skill.grade === 'ULTIMATE' ? 1.35 : gradeScale);
  }

  private showCastAfterimages(tint: number, scale: number): void {
    const dir = this.player.isFacingRight ? 1 : -1;
    const copies = scale > 1.3 ? 4 : scale > 1.1 ? 3 : 2;
    for (let i = 0; i < copies; i++) {
      const ghost = this.add.image(this.player.x - dir * (10 + i * 8), this.player.y, this.player.texture.key)
        .setDisplaySize(this.player.displayWidth, this.player.displayHeight)
        .setFlipX(this.player.flipX)
        .setTint(tint)
        .setAlpha(0.24 - i * 0.04)
        .setDepth(9)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ghost,
        x: ghost.x - dir * (10 + i * 4),
        alpha: 0,
        duration: 150 + i * 35,
        ease: 'Quad.easeOut',
        onComplete: () => ghost.destroy(),
      });
    }
  }

  /**
   * 범용 고퀄 모션 트레일 / 애프터 이미지 생성기.
   * 공격, 대시, 빠른 이동 시 "프레임 연결" 느낌을 주어 낮은 프레임 애니도 매끄럽게 보이게 함.
   * 모든 ghost는 자동 파괴 → 메모리 누수 방지.
   */
  private spawnAfterimage(
    x: number, y: number,
    textureKey: string,
    flipX: boolean,
    startAlpha = 0.35,
    lifeMs = 180,
    tint?: number,
    extraScale = 1.0
  ): void {
    const img = this.add.image(x, y, textureKey)
      .setDisplaySize(this.player.displayWidth * extraScale, this.player.displayHeight * extraScale)
      .setFlipX(flipX)
      .setAlpha(startAlpha)
      .setDepth(this.player.depth - 1)
      .setBlendMode(Phaser.BlendModes.ADD);

    if (tint !== undefined) img.setTint(tint);

    this.tweens.add({
      targets: img,
      alpha: 0,
      x: x + (this.player.isFacingRight ? -6 : 6),
      scaleX: img.scaleX * 0.96,
      scaleY: img.scaleY * 0.96,
      duration: lifeMs,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  private showGroundWindup(x: number, y: number, tint: number, scale: number): void {
    const dir = this.player.isFacingRight ? 1 : -1;
    const width = 72 * scale;
    const wake = this.add.ellipse(x - dir * 10, y, width, 12 * scale, tint, 0.28)
      .setDepth(6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setRotation(dir > 0 ? -0.08 : 0.08);
    wake.setStrokeStyle(1, 0xffffff, 0.28);
    this.tweens.add({
      targets: wake,
      x: x + dir * 26,
      scaleX: 1.8,
      scaleY: 0.35,
      alpha: 0,
      duration: 210,
      ease: 'Cubic.easeOut',
      onComplete: () => wake.destroy(),
    });
  }

  private showSlashEffect(x: number, y: number, skill: SkillData): void {
    // 이펙트 색: 스킬 오버라이드 → 캐릭터 기본색
    let baseTint = skill.effectColor ?? this.slashColor;
    if (skill.grade === 'HIGH' || skill.grade === 'ULTIMATE') {
      baseTint = Phaser.Display.Color.IntegerToColor(baseTint).brighten(20).color;
    }

    const effectType = skill.effectType ?? 'slash';
    this.showBladeTrail(x, y, skill, baseTint);

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
      this.kickCamera(110, 1.012);
      this.cameras.main.shake(80, 0.003);
      this.focusOnAction(260, 0.97);
    } else if (skill.grade === 'ULTIMATE') {
      this.kickCamera(150, 1.02);
      this.cameras.main.shake(120, 0.006);
      this.cameras.main.flash(100, 255, 255, 255, true);
      this.focusOnAction(380, 0.94);
    }
  }

  /** Hollow Knight 스타일: 중요한 액션 순간 카메라가 살짝 액션에 집중 */
  private focusOnAction(duration: number, zoom: number): void {
    this.tweens.killTweensOf(this.cameras.main);
    this.tweens.add({
      targets: this.cameras.main,
      zoom,
      duration: duration * 0.4,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.cameras.main.setZoom(1),
    });
  }

  private kickCamera(duration: number, zoom: number): void {
    this.tweens.killTweensOf(this.cameras.main);
    this.tweens.add({
      targets: this.cameras.main,
      zoom,
      duration,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => { this.cameras.main.setZoom(1); },
    });
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
    const baseScale = skill.hitboxSize.w / 100;
    fx.setScale(baseScale);
    fx.setFlipX(this.player.isFacingRight);
    const dir = this.player.isFacingRight ? 1 : -1;
    fx.setAngle(dir * Phaser.Math.Between(-25, 25));

    this.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: baseScale * 1.4,
      scaleY: baseScale * 1.4,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => {
        fx.setActive(false);
        fx.setVisible(false);
        fx.setScale(1);
        fx.setAngle(0);
        this.slashPool.push(fx);
      },
    });

    // 고퀄리티 추가: 강한 스킬일 때 잔상 슬래시
    if (skill.grade === 'HIGH' || skill.grade === 'ULTIMATE') {
      const after = this.add.image(x + dir * 8, y + 4, fx.texture.key)
        .setTint(tint).setAlpha(0.35).setFlipX(this.player.isFacingRight)
        .setScale(baseScale * 0.85).setAngle(fx.angle + dir * 12)
        .setDepth(fx.depth - 1);
      this.tweens.add({
        targets: after,
        alpha: 0,
        x: x + dir * 24,
        duration: 280,
        onComplete: () => after.destroy()
      });
    }
  }

  private showBladeTrail(x: number, y: number, skill: SkillData, tint: number): void {
    const dir = this.player.isFacingRight ? 1 : -1;
    const length = Phaser.Math.Clamp(skill.hitboxSize.w * 1.15, 48, 150);
    const width = skill.grade === 'ULTIMATE' ? 8 : skill.grade === 'HIGH' ? 6 : 4;
    const trail = this.add.rectangle(x - dir * 8, y - 8, length, width, tint, 0.78)
      .setDepth(134)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setRotation(dir > 0 ? -0.34 : 0.34);
    trail.setOrigin(dir > 0 ? 0.15 : 0.85, 0.5);

    this.tweens.add({
      targets: trail,
      x: x + dir * 28,
      scaleX: 1.55,
      scaleY: 0.2,
      alpha: 0,
      duration: skill.effectType === 'multi' ? 120 : 170,
      ease: 'Cubic.easeOut',
      onComplete: () => trail.destroy(),
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

  private showSkillImpactBurst(x: number, y: number, skill: SkillData, isBoss: boolean): void {
    let tint = skill.effectColor ?? this.slashColor;
    if (skill.grade === 'HIGH' || skill.grade === 'ULTIMATE') {
      tint = Phaser.Display.Color.IntegerToColor(tint).brighten(18).color;
    }

    const intensity = skill.grade === 'ULTIMATE' ? 1.45 : skill.grade === 'HIGH' ? 1.18 : 1;
    const ring = this.add.ellipse(x, y, 18, 9, tint, 0.42)
      .setDepth(137)
      .setBlendMode(Phaser.BlendModes.ADD);
    ring.setStrokeStyle(2, 0xffffff, 0.6);
    this.tweens.add({
      targets: ring,
      scaleX: 2.2 * intensity,
      scaleY: 1.8 * intensity,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    const shardCount = Math.round((isBoss ? 9 : 6) * intensity);
    for (let i = 0; i < shardCount; i++) {
      const shard = this.add.rectangle(x, y, 3, 9 + Math.random() * 10, tint, 0.85)
        .setDepth(138)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setRotation(Math.random() * Math.PI);
      const angle = Math.PI * (Math.random() * 0.9 + 0.05);
      const speed = (28 + Math.random() * 52) * intensity;
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * speed,
        y: y - Math.sin(angle) * speed,
        alpha: 0,
        duration: 180 + Math.random() * 130,
        ease: 'Cubic.easeOut',
        onComplete: () => shard.destroy(),
      });
    }
    this.showBloodSpray(x, y, isBoss, intensity);

    if (skill.grade === 'HIGH') {
      this.cameras.main.shake(70, 0.0035);
    } else if (skill.grade === 'ULTIMATE') {
      this.showScreenPulse(tint, 0.2, 190);
      this.cameras.main.shake(130, 0.007);
    }
  }

  private showBloodSpray(x: number, y: number, isBoss: boolean, intensity: number): void {
    const count = Math.round((isBoss ? 13 : 8) * intensity);
    for (let i = 0; i < count; i++) {
      const drop = this.add.circle(x, y, 1.5 + Math.random() * 2.8, 0x8d100b, 0.82)
        .setDepth(136);
      const angle = Math.PI * (0.1 + Math.random() * 0.8);
      const speed = (18 + Math.random() * 62) * intensity;
      this.tweens.add({
        targets: drop,
        x: x + Math.cos(angle) * speed,
        y: y - Math.sin(angle) * speed + Math.random() * 16,
        alpha: 0,
        scaleX: 0.45,
        scaleY: 0.45,
        duration: 260 + Math.random() * 160,
        ease: 'Quad.easeOut',
        onComplete: () => drop.destroy(),
      });
    }

    const stain = this.add.ellipse(x + 6, this.groundY + 30, isBoss ? 28 : 18, isBoss ? 9 : 6, 0x4a0705, 0.46)
      .setDepth(4);
    this.tweens.add({
      targets: stain,
      alpha: 0,
      duration: 1600,
      delay: 600,
      onComplete: () => stain.destroy(),
    });
  }

  private showScreenPulse(tint: number, alpha: number, duration: number): void {
    const pulse = this.add.rectangle(GAME_W / 2, this.battleH / 2, GAME_W, this.battleH, tint, alpha)
      .setScrollFactor(0)
      .setDepth(180)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => pulse.destroy(),
    });
  }

  private showDamageText(x: number, y: number, damage: number, isCritical: boolean, grade?: SkillData['grade']): void {
    const isUltimate = grade === 'ULTIMATE';
    const fontSize = isUltimate ? '20px' : isCritical ? '16px' : '12px';
    const color = isUltimate ? '#fff0a8' : isCritical ? '#ffd740' : '#ff4444';
    const label = isCritical ? `${isUltimate ? '절기 ' : ''}${damage}` : String(damage);

    const text = this.add.text(x, y, label, {
      fontSize,
      color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: isCritical ? 4 : 2,
    }).setOrigin(0.5).setDepth(190);

    if (isCritical) {
      const flare = this.add.circle(x, y, isUltimate ? 22 : 14, isUltimate ? 0xffd740 : 0xff5544, isUltimate ? 0.22 : 0.14)
        .setDepth(189)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: flare,
        scaleX: 1.8,
        scaleY: 1.8,
        alpha: 0,
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () => flare.destroy(),
      });
    }

    this.tweens.add({
      targets: text,
      y: y - (isCritical ? 34 : 24),
      x: x + (Math.random() - 0.5) * 16,
      alpha: 0,
      scaleX: isCritical ? 1.12 : 1,
      scaleY: isCritical ? 1.12 : 1,
      duration: isCritical ? 760 : 600,
      ease: 'Cubic.easeOut',
      onComplete: () => { text.destroy(); },
    });
  }

  private showRewardText(x: number, y: number, textStr: string, color: string): void {
    const text = this.add.text(x, y, textStr, {
      fontSize: '13px',
      color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(191);

    this.tweens.add({
      targets: text,
      y: y - 42,
      x: x + (Math.random() - 0.5) * 12,
      alpha: 0,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => { text.destroy(); },
    });
  }

  private pulseHitStop(duration: number): void {
    const clock = this.physics.world.timeScale;
    this.physics.world.timeScale = 0.65;
    this.time.delayedCall(duration, () => {
      this.physics.world.timeScale = clock;
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

    const pathBonuses = rebirthPathBonuses(save.rebirthPaths);
    return {
      attackMul: sets.attackMul * (1 + (training.attack ?? 0) * 0.02 + classResearch * 0.025 + disciples * 0.01),
      hpMul: sets.hpMul * (1 + (training.hp ?? 0) * 0.02) * pathBonuses.hpMul,
      goldMul: sets.goldMul * (1 + (training.gold ?? 0) * 0.02) * pathBonuses.goldMul,
      flatAttack,
      flatHp,
      speedMul: 1 + (training.speed ?? 0) * 0.015,
      critChance: Math.min(0.5, (training.crit ?? 0) * 0.02),
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

    this.player.resetEquippedSkills(valid);
    if (save.equippedDash) {
      this.player.equipDash(save.equippedDash);
    }
    const bonuses = this.getCombatBonuses(save);
    this.player.applyTrainingBonuses(bonuses.speedMul, 1 + (save.trainingLevels?.stamina ?? 0) * 0.03);
    this.applyEquipmentSkin(save);
  }

  private applyEquipmentSkin(save = loadGame()): void {
    const currentItems = equippedItems(save.equipmentInventory ?? [], save.equippedItems);
    const setId = dominantSetId(currentItems, 4);
    this.player.setEquipmentSetSkin(setId);
    this.updatePlayerAura(setId);
  }

  private updatePlayerAura(setId: string | null): void {
    if (!setId || !SET_TINTS[setId]) {
      if (this.playerAuraFeet) this.playerAuraFeet.setVisible(false);
      if (this.playerAuraBack) {
        this.playerAuraBack.clear();
        this.playerAuraBack.setVisible(false);
      }
      return;
    }

    const color = SET_TINTS[setId];
    
    if (this.playerAuraFeet) {
      this.playerAuraFeet.setFillStyle(color, 0.45);
      this.playerAuraFeet.setVisible(true);
      
      this.tweens.killTweensOf(this.playerAuraFeet);
      this.playerAuraFeet.setScale(1);
      this.tweens.add({
        targets: this.playerAuraFeet,
        scaleX: 1.25,
        scaleY: 1.25,
        alpha: 0.18,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    if (this.playerAuraBack) {
      this.playerAuraBack.clear();
      this.playerAuraBack.setVisible(true);
      
      // Draw a glowing ring/halo behind the player's back
      this.playerAuraBack.lineStyle(4, color, 0.85);
      this.playerAuraBack.strokeCircle(0, 0, 36);
      
      // Add glowing spikes (radiating martial energy)
      this.playerAuraBack.lineStyle(2, color, 0.45);
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        this.playerAuraBack.lineBetween(
          Math.cos(angle) * 40, Math.sin(angle) * 40,
          Math.cos(angle) * 54, Math.sin(angle) * 54
        );
      }
    }
  }

  private updatePlayerAuraPosition(delta: number): void {
    if (!this.player || !this.player.active) return;
    
    if (this.playerAuraFeet && this.playerAuraFeet.visible) {
      this.playerAuraFeet.setPosition(this.player.x, this.player.y + 100);
    }
    
    if (this.playerAuraBack && this.playerAuraBack.visible) {
      this.playerAuraBack.setPosition(this.player.x, this.player.y - 12);
      this.playerAuraBack.rotation += 0.0012 * delta; // Rotates based on frame time
    }
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
  }

  private toggleBattleMode(): void {
    this.battleMode = this.battleMode === 'AUTO' ? 'MANUAL' : 'AUTO';
  }

  private showBossCutscene(bossId: string, bossName: string): void {
    let mappedId = bossId;
    if (bossId.startsWith('boss_stage_')) {
      const stage = parseInt(bossId.replace('boss_stage_', ''), 10);
      const index = (stage - 1) % 8;
      mappedId = 'boss_' + ['daeju', 'danju', 'gakju', 'magun', 'hobup', 'saja', 'bugyoju', 'hyeolma'][index];
    }
    const lines = BOSS_DIALOGUES[mappedId] ?? [`${bossName}이(가) 나타났다!`];
    const GAME_W = this.scale.width;
    const GAME_H = this.scale.height;

    const overlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0)
      .setScrollFactor(0).setDepth(300).setInteractive();
    this.tweens.add({ targets: overlay, alpha: 0.75, duration: 300 });

    const redFlash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x8b0000, 0.3)
      .setScrollFactor(0).setDepth(301);
    this.tweens.add({ targets: redFlash, alpha: 0, duration: 600, delay: 200, onComplete: () => redFlash.destroy() });

    // 보스 일러스트 (여백 트리밍 프레임으로 크게 표시, 오른쪽에서 슬라이드 인)
    let bossImage: Phaser.GameObjects.Image | null = null;
    const bossArtKey = mappedId.replace('boss_', 'boss_art_');
    if (this.textures.exists(bossArtKey)) {
      const hasTrim = this.textures.get(bossArtKey).has('trim');
      bossImage = this.add.image(GAME_W / 2 + 50, GAME_H / 2 - 230, bossArtKey, hasTrim ? 'trim' : undefined)
        .setScrollFactor(0).setDepth(301).setAlpha(0);
      const targetH = 320;
      bossImage.setDisplaySize(targetH * (bossImage.frame.width / bossImage.frame.height), targetH);
      this.tweens.add({
        targets: bossImage,
        x: GAME_W / 2, alpha: 1,
        duration: 420, ease: 'Cubic.easeOut',
      });
    }

    const nameText = this.add.text(GAME_W / 2, GAME_H / 2 - 60, bossName, {
      fontSize: '28px', color: '#e05050', fontFamily: 'serif', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302).setAlpha(0);
    this.tweens.add({ targets: nameText, alpha: 1, y: GAME_H / 2 - 80, duration: 500, ease: 'Power2' });

    let lineIndex = 0;
    const dialogText = this.add.text(GAME_W / 2, GAME_H / 2 + 10, '', {
      fontSize: '18px', color: '#e8c36a', fontFamily: 'serif',
      stroke: '#000000', strokeThickness: 3, align: 'center',
      wordWrap: { width: GAME_W - 80 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302).setAlpha(0);

    const tapHint = this.add.text(GAME_W / 2, GAME_H / 2 + 80, '(탭하여 계속)', {
      fontSize: '14px', color: '#7a6a50', fontFamily: 'sans-serif',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302).setAlpha(0);
    this.tweens.add({ targets: tapHint, alpha: 1, duration: 400, delay: 800, yoyo: true, repeat: -1 });

    const showLine = (i: number) => {
      dialogText.setText(lines[i]).setAlpha(0);
      this.tweens.add({ targets: dialogText, alpha: 1, duration: 300 });
    };
    this.time.delayedCall(500, () => showLine(0));

    const dismiss = () => {
      if (lineIndex < lines.length - 1) {
        lineIndex++;
        showLine(lineIndex);
        return;
      }
      overlay.off('pointerdown', dismiss);
      const parts: Phaser.GameObjects.GameObject[] = [overlay, nameText, dialogText, tapHint];
      if (bossImage) parts.push(bossImage);
      parts.forEach(o => {
        this.tweens.add({ targets: o, alpha: 0, duration: 300, onComplete: () => o.destroy() });
      });
    };
    overlay.on('pointerdown', dismiss);
    this.time.delayedCall(4000, () => dismiss());
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

  /**
   * 씬 종료 시 철저한 정리 (메모리 누수 방지 핵심).
   * 모든 tween, timer 이벤트, 리스너, 풀, 그래픽 객체를 명시적으로 해제.
   */
  private handleShutdown(): void {
    // 트윈 전체 kill (안전)
    this.tweens.killAll();

    // 이벤트 리스너 정리
    this.events.removeAllListeners();
    // 다른 병렬 씬(UIScene) 리스너는 해당 씬이 스스로 정리하도록 둔다 (교차 참조 금지)

    // 풀 정리
    this.slashPool.forEach(fx => {
      if (fx && fx.active) fx.destroy();
    });
    this.slashPool = [];

    // 보스 오라 등 특수 오브젝트
    this.destroyBossAura();
    if (this.bossHpBar) { this.bossHpBar.destroy(); this.bossHpBar = null; }
    if (this.bossHpBg) { this.bossHpBg.destroy(); this.bossHpBg = null; }
    if (this.bossNameText) { this.bossNameText.destroy(); this.bossNameText = null; }
    if (this.bossRankText) { this.bossRankText.destroy(); this.bossRankText = null; }

    // 배경 타일 정리
    [this.bgLayerBg, this.bgLayerMg, this.bgLayerFg, this.groundShadowLayer, this.foregroundMistLayer]
      .forEach(l => l?.destroy());

    // 상태이상 정리
    this.statusEffects = [];

    // 남은 적 풀 반환
    this.enemies.forEach(e => { if (e.active) (e as any).deactivate?.(); });
    this.enemyPool.forEach(e => e.destroy());
    this.enemies = [];
    this.enemyPool = [];

    this.bossEnemy = null;
  }
}
