import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { ENEMY_DATABASE } from '../data/enemies';
import { SKILL_DATABASE } from '../data/skills';
import type { SkillData, BattleMode } from '../data/types';
import { loadGame, saveGame } from '../systems/SaveSystem';

/**
 * BattleScene - 상단 횡스크롤 자동전투 씬
 *
 * 화면 상단 60% (360 x 384)를 차지합니다.
 * 카메라가 플레이어를 따라 오른쪽으로 스크롤합니다.
 *
 * 전투 흐름:
 * 1. 플레이어가 자동으로 오른쪽으로 이동합니다.
 * 2. 적이 화면 오른쪽 밖에서 스폰됩니다.
 * 3. 적이 사거리 안에 들어오면 자동 공격합니다.
 * 4. 적 처치 시 비급이 드랍됩니다.
 * 5. 모든 적 처치 → 다음 웨이브로 자동 진행합니다.
 *
 * 성능 최적화:
 * - 적 오브젝트 풀링 (GC 방지)
 * - 이펙트 풀링
 * - 카메라 컬링 (화면 밖 오브젝트 렌더링 스킵)
 */

const GAME_W = 360;
const BATTLE_H = 384; // 상단 60%
const GROUND_Y = BATTLE_H - 48; // 바닥 라인
const SCROLL_SPEED = 40; // 자동 이동 속도 (px/s)
const MAX_ENEMIES = 6;
const SPAWN_DISTANCE = 300; // 플레이어 오른쪽으로부터의 스폰 거리

/** 스폰 가능한 적 ID */
const SPAWN_TABLE = ['bandit', 'swordsman', 'assassin'] as const;

export class BattleScene extends Phaser.Scene {
  private player!: Player;
  private enemies: Enemy[] = [];
  private enemyPool: Enemy[] = [];

  private battleMode: BattleMode = 'AUTO';
  private killCount = 0;
  private waveNumber = 1;
  private waveEnemyTotal = 3;
  private waveSpawned = 0;
  private waveKilled = 0;
  private spawnTimer = 0;
  private spawnInterval = 1500; // ms

  // 횡스크롤 상태
  private scrollX = 0;
  private isMoving = true;

  // 이펙트 풀
  private slashPool: Phaser.GameObjects.Sprite[] = [];

  // 배경 레이어 (패럴랙스)
  private bgLayer1: Phaser.GameObjects.TileSprite | null = null;
  private bgLayer2: Phaser.GameObjects.TileSprite | null = null;
  private groundLayer: Phaser.GameObjects.TileSprite | null = null;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    // 카메라를 상단 영역으로 제한
    this.cameras.main.setViewport(0, 0, GAME_W, BATTLE_H);
    this.cameras.main.setBackgroundColor('#2d1b4e');

    // 배경 생성 (패럴랙스 스크롤)
    this.createBackground();

    // 플레이어 생성 (화면 왼쪽 1/4 지점, 바닥)
    this.player = new Player(this, 80, GROUND_Y);
    this.player.setOnHitCallback(this.onPlayerHit.bind(this));

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

    // 적 공격 이벤트
    this.events.on('enemy-attack', this.onEnemyAttack, this);

    // UIScene에서 오는 이벤트
    this.events.on('toggle-battle-mode', this.toggleBattleMode, this);
    this.events.on('equip-changed', this.applySaveData, this);

    // 초기 웨이브 시작
    this.startWave(1);
  }

  update(time: number, delta: number): void {
    // 플레이어 업데이트
    this.player.update(time, delta);

    // 횡스크롤 처리
    this.updateScroll(delta);

    // 전투 AI
    this.updateBattleAI(delta);

    // 적 업데이트
    this.updateEnemies(time, delta);

    // 스폰 처리
    this.updateSpawning(delta);

    // 배경 패럴랙스
    this.updateBackground();

    // UIScene에 상태 전달
    this.emitState();
  }

  // ─── 횡스크롤 ───

  private updateScroll(delta: number): void {
    if (!this.isMoving) return;

    // 적이 없으면 자동 전진
    const hasNearbyEnemy = this.enemies.some(e =>
      e.active && Math.abs(e.x - this.player.x) < 120
    );

    if (!hasNearbyEnemy && this.player.currentCharState !== 'ATTACK') {
      // 플레이어 오른쪽으로 이동
      this.scrollX += SCROLL_SPEED * (delta / 1000);
      this.player.handleMove(1, 0);
    } else {
      // 적이 가까이 있으면 정지
      this.player.handleMove(0, 0);
    }
  }

  // ─── 전투 AI ───

  private updateBattleAI(_delta: number): void {
    if (this.battleMode !== 'AUTO') return;
    if (this.player.currentCharState === 'ATTACK' ||
        this.player.currentCharState === 'DASH' ||
        this.player.currentCharState === 'DEAD') return;

    // 가장 가까운 적 찾기
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

    // 사거리 내이면 공격
    const skills = this.player.skills;
    for (let i = 0; i < skills.length; i++) {
      if (closestDist <= skills[i].range + 20) {
        this.player.handleAttack(i);
        return;
      }
    }
  }

  // ─── 적 업데이트 ───

  private updateEnemies(time: number, delta: number): void {
    const activeEnemies: Enemy[] = [];

    for (const enemy of this.enemies) {
      if (enemy.active) {
        // 적은 플레이어를 향해 왼쪽으로 이동 (횡스크롤이므로 X축만)
        enemy.setTarget(this.player.x, this.player.y);
        enemy.update(time, delta);
        activeEnemies.push(enemy);
      } else {
        // 드랍 처리
        const drop = enemy.consumeDrop();
        if (drop) {
          this.handleDrop(drop.skillId, enemy.x, enemy.y);
        }
        // 풀에 반환
        this.enemyPool.push(enemy);
        this.killCount++;
        this.waveKilled++;

        // 웨이브 클리어 체크
        if (this.waveKilled >= this.waveEnemyTotal && this.waveSpawned >= this.waveEnemyTotal) {
          this.onWaveClear();
        }
      }
    }
    this.enemies = activeEnemies;
  }

  // ─── 스폰 ───

  private updateSpawning(delta: number): void {
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

    // 랜덤 적 선택
    const enemyId = SPAWN_TABLE[Math.floor(Math.random() * SPAWN_TABLE.length)];
    const data = ENEMY_DATABASE.get(enemyId);
    if (!data) return;

    // 플레이어 오른쪽에서 스폰
    const spawnX = this.player.x + SPAWN_DISTANCE + Math.random() * 60;
    const spawnY = GROUND_Y + (Math.random() - 0.5) * 16; // 약간의 Y 변화

    enemy.activate(data, spawnX, spawnY);
    this.enemies.push(enemy);
    this.waveSpawned++;
  }

  // ─── 웨이브 관리 ───

  private startWave(wave: number): void {
    this.waveNumber = wave;
    this.waveEnemyTotal = 3 + wave * 2; // 웨이브마다 적 수 증가
    if (this.waveEnemyTotal > 20) this.waveEnemyTotal = 20;
    this.waveSpawned = 0;
    this.waveKilled = 0;
    this.spawnTimer = 0;
    this.isMoving = true;
  }

  private onWaveClear(): void {
    // 체력/기력 회복
    this.player.heal(30, 20);

    // 세이브
    const save = loadGame();
    save.stageCleared = Math.max(save.stageCleared, this.waveNumber);
    saveGame(save);

    // UI에 알림
    this.events.emit('wave-clear', this.waveNumber);

    // 다음 웨이브 (1초 딜레이)
    this.time.delayedCall(1000, () => {
      this.startWave(this.waveNumber + 1);
    });
  }

  // ─── 히트 판정 ───

  private onPlayerHit(hitX: number, hitY: number, skill: SkillData): void {
    const hitRect = new Phaser.Geom.Rectangle(
      hitX - skill.hitboxSize.w / 2,
      hitY - skill.hitboxSize.h / 2,
      skill.hitboxSize.w,
      skill.hitboxSize.h,
    );

    this.showSlashEffect(hitX, hitY, skill);

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;

      const enemyRect = new Phaser.Geom.Rectangle(
        enemy.x - 8, enemy.y - 12, 16, 24,
      );

      if (Phaser.Geom.Rectangle.Overlaps(hitRect, enemyRect)) {
        const damage = Math.round(skill.damageMultiplier * 10);
        const killed = enemy.takeDamage(damage);

        if (skill.effect === 'KNOCKBACK' && !killed) {
          const chance = skill.effectChance ?? 0;
          if (Math.random() < chance) {
            enemy.applyKnockback(this.player.x, this.player.y, 150);
          }
        }

        this.showDamageText(enemy.x, enemy.y - 20, damage);
      }
    }
  }

  private onEnemyAttack(_enemy: Enemy, damage: number): void {
    this.player.takeDamage(damage);
  }

  // ─── 배경 ───

  private createBackground(): void {
    // 패럴랙스 배경 (TileSprite로 무한 스크롤)
    // 레이어 1: 먼 산 (느리게 스크롤)
    this.bgLayer1 = this.add.tileSprite(0, 0, GAME_W, BATTLE_H, 'tile_ground')
      .setOrigin(0, 0)
      .setTint(0x1a2a1a)
      .setAlpha(0.5)
      .setScrollFactor(0);

    // 레이어 2: 나무/구조물 (중간 속도)
    this.bgLayer2 = this.add.tileSprite(0, BATTLE_H - 120, GAME_W, 120, 'tile_ground')
      .setOrigin(0, 0)
      .setTint(0x2d4a2d)
      .setAlpha(0.7)
      .setScrollFactor(0);

    // 바닥
    this.groundLayer = this.add.tileSprite(0, BATTLE_H - 48, GAME_W, 48, 'tile_path')
      .setOrigin(0, 0)
      .setScrollFactor(0);
  }

  private updateBackground(): void {
    if (this.bgLayer1) this.bgLayer1.tilePositionX = this.scrollX * 0.2;
    if (this.bgLayer2) this.bgLayer2.tilePositionX = this.scrollX * 0.5;
    if (this.groundLayer) this.groundLayer.tilePositionX = this.scrollX * 1.0;
  }

  // ─── 이펙트 ───

  private showSlashEffect(x: number, y: number, skill: SkillData): void {
    const fx = this.slashPool.pop();
    if (!fx) return;

    let textureKey = 'fx_slash_white';
    if (skill.grade === 'MID') textureKey = 'fx_slash_pink';
    if (skill.grade === 'HIGH') textureKey = 'fx_slash_blue';
    if (skill.grade === 'ULTIMATE') textureKey = 'fx_slash_gold';

    fx.setTexture(textureKey);
    fx.setPosition(x, y);
    fx.setActive(true);
    fx.setVisible(true);
    fx.setAlpha(1);
    fx.setScale(skill.hitboxSize.w / 32);
    fx.setFlipX(!this.player.isFacingRight);

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

  private showDamageText(x: number, y: number, damage: number): void {
    const text = this.add.text(x, y, String(damage), {
      fontSize: '12px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 24,
      alpha: 0,
      duration: 600,
      onComplete: () => { text.destroy(); },
    });
  }

  private handleDrop(skillId: string, x: number, y: number): void {
    const skill = SKILL_DATABASE.get(skillId);
    if (!skill) return;

    const save = loadGame();
    save.inventory[skillId] = (save.inventory[skillId] ?? 0) + 1;
    if (!save.unlockedSkills.includes(skillId)) {
      save.unlockedSkills.push(skillId);
    }
    saveGame(save);

    // 드랍 텍스트
    const dropText = this.add.text(x, y - 8, `${skill.nameKo}`, {
      fontSize: '9px',
      color: '#ffd740',
      fontFamily: 'monospace',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 2 },
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

  // ─── 유틸 ───

  private applySaveData(): void {
    const save = loadGame();
    save.equippedSkills.forEach((skillId, index) => {
      this.player.equipSkill(skillId, index);
    });
    if (save.equippedDash) {
      this.player.equipDash(save.equippedDash);
    }
  }

  private toggleBattleMode(): void {
    this.battleMode = this.battleMode === 'AUTO' ? 'MANUAL' : 'AUTO';
  }

  private emitState(): void {
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
      killCount: this.killCount,
      waveNumber: this.waveNumber,
      battleMode: this.battleMode,
    });
  }
}
