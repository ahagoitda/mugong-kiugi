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
 *
 * 웨이브 시스템:
 * - 일반 웨이브: 잡몹 처치 → 다음 웨이브
 * - 보스 웨이브 (5, 10, 15...): 보스 단독 등장, HP바 표시, 클리어 시 특별 보상
 *
 * 보스전 설계:
 * - 보스는 일반 적보다 크고 (0.7x 스케일), HP가 높음
 * - 보스 HP바가 화면 상단에 표시됨
 * - 보스 처치 시 중급 이상 비급 확정 드랍
 * - 보스 웨이브에서는 일반 적이 스폰되지 않음
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
const BOSS_WAVE_INTERVAL = 5; // 5웨이브마다 보스 등장

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

  // 보스전 상태
  private isBossWave = false;
  private bossEnemy: Enemy | null = null;
  private bossHpBar: Phaser.GameObjects.Graphics | null = null;
  private bossHpBg: Phaser.GameObjects.Graphics | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;
  private bossWarningText: Phaser.GameObjects.Text | null = null;

  // 횡스크롤 상태
  private scrollX = 0;
  private isMoving = true;

  // 이펙트 풀
  private slashPool: Phaser.GameObjects.Sprite[] = [];

  // 배경 레이어 (패럴랙스)
  private bgMountains: Phaser.GameObjects.TileSprite | null = null;
  private bgGround: Phaser.GameObjects.TileSprite | null = null;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    // 카메라를 상단 영역으로 제한
    this.cameras.main.setViewport(0, 0, GAME_W, BATTLE_H);
    this.cameras.main.setBackgroundColor('#1a0a2e');

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

    // 보스 HP바 UI 생성 (초기에는 숨김)
    this.createBossHpUI();

    // 적 공격 이벤트
    this.events.on('enemy-attack', this.onEnemyAttack, this);

    // UIScene에서 오는 이벤트
    this.events.on('toggle-battle-mode', this.toggleBattleMode, this);
    this.events.on('equip-changed', this.applySaveData, this);
    this.events.on('use-skill', this.onUseSkill, this);
    this.events.on('use-dash', this.onUseDash, this);

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

    // 보스 HP바 업데이트
    this.updateBossHpBar();

    // UIScene에 상태 전달
    this.emitState();
  }

  // ─── 보스 HP바 UI ───

  /**
   * 보스 HP바를 화면 상단에 생성합니다.
   * 초기에는 숨김 상태이며, 보스 웨이브 시작 시 표시됩니다.
   *
   * 구조:
   * [보스 이름]
   * [████████████████░░░░] (HP바)
   */
  private createBossHpUI(): void {
    // 보스 이름 텍스트
    this.bossNameText = this.add.text(GAME_W / 2, 12, '', {
      fontSize: '11px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false).setDepth(100);

    // HP바 배경 (어두운 회색)
    this.bossHpBg = this.add.graphics()
      .setScrollFactor(0).setVisible(false).setDepth(100);

    // HP바 (빨간색 → 노란색 → 초록색)
    this.bossHpBar = this.add.graphics()
      .setScrollFactor(0).setVisible(false).setDepth(101);
  }

  /**
   * 보스 HP바를 매 프레임 업데이트합니다.
   * 보스의 현재 HP 비율에 따라 바 길이와 색상이 변합니다.
   */
  private updateBossHpBar(): void {
    if (!this.isBossWave || !this.bossEnemy || !this.bossEnemy.active) return;
    if (!this.bossHpBar || !this.bossHpBg) return;

    const bossData = this.bossEnemy.data_;
    if (!bossData) return;

    const ratio = this.bossEnemy.hp / bossData.hp;
    const barWidth = GAME_W - 60;
    const barHeight = 10;
    const barX = 30;
    const barY = 24;

    // 배경
    this.bossHpBg.clear();
    this.bossHpBg.fillStyle(0x333333, 0.8);
    this.bossHpBg.fillRoundedRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 3);

    // HP바 색상: 높으면 빨강, 중간이면 주황, 낮으면 진빨강
    let barColor = 0xff2222;
    if (ratio > 0.6) barColor = 0xff4444;
    else if (ratio > 0.3) barColor = 0xff8800;
    else barColor = 0xcc0000;

    this.bossHpBar.clear();
    this.bossHpBar.fillStyle(barColor, 1);
    this.bossHpBar.fillRoundedRect(barX, barY, barWidth * ratio, barHeight, 2);

    // HP 수치 표시 (바 오른쪽)
    // Text는 매 프레임 생성하면 GC 부담이므로 bossNameText를 재활용
    if (this.bossNameText) {
      this.bossNameText.setText(`⚔ ${bossData.name} ⚔  HP: ${this.bossEnemy.hp}/${bossData.hp}`);
    }
  }

  /**
   * 보스 HP바 UI를 표시합니다.
   */
  private showBossHpUI(bossName: string): void {
    if (this.bossNameText) {
      this.bossNameText.setText(`⚔ ${bossName} ⚔`);
      this.bossNameText.setVisible(true);
    }
    if (this.bossHpBg) this.bossHpBg.setVisible(true);
    if (this.bossHpBar) this.bossHpBar.setVisible(true);
  }

  /**
   * 보스 HP바 UI를 숨깁니다.
   */
  private hideBossHpUI(): void {
    if (this.bossNameText) this.bossNameText.setVisible(false);
    if (this.bossHpBg) {
      this.bossHpBg.clear();
      this.bossHpBg.setVisible(false);
    }
    if (this.bossHpBar) {
      this.bossHpBar.clear();
      this.bossHpBar.setVisible(false);
    }
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

  // ─── 수동 조작 이벤트 ───

  private onUseSkill(slotIndex: number): void {
    if (this.battleMode === 'MANUAL') {
      this.player.handleAttack(slotIndex);
    }
  }

  private onUseDash(): void {
    this.player.handleDash();
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

        // 보스 처치 판정
        const isBossDeath = (enemy === this.bossEnemy);

        // 풀에 반환
        this.enemyPool.push(enemy);
        this.killCount++;
        this.waveKilled++;

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
    // 보스 웨이브에서는 보스만 스폰하므로 추가 스폰 없음
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

  /**
   * 보스를 스폰합니다.
   *
   * 보스는 일반 적보다 크고 (0.7x 스케일),
   * 웨이브 수에 비례하여 HP가 스케일링됩니다.
   * 등장 시 화면 흔들림 + 경고 텍스트를 표시합니다.
   */
  private spawnBoss(): void {
    const enemy = this.enemyPool.pop();
    if (!enemy) return;

    const bossData = ENEMY_DATABASE.get('boss_beopwang');
    if (!bossData) return;

    // 웨이브에 따른 보스 HP 스케일링
    // 5웨이브: x1.0, 10웨이브: x1.5, 15웨이브: x2.0 ...
    const hpMultiplier = 1 + (this.waveNumber / BOSS_WAVE_INTERVAL - 1) * 0.5;
    const scaledBossData = {
      ...bossData,
      hp: Math.round(bossData.hp * hpMultiplier),
      damage: Math.round(bossData.damage * (1 + (this.waveNumber / BOSS_WAVE_INTERVAL - 1) * 0.3)),
    };

    // 플레이어 오른쪽에서 스폰
    const spawnX = this.player.x + SPAWN_DISTANCE + 40;
    const spawnY = GROUND_Y;

    enemy.activate(scaledBossData, spawnX, spawnY);
    // 보스는 더 크게 표시 (0.7x, 일반 적은 0.5x)
    enemy.setScale(0.7);

    this.bossEnemy = enemy;
    this.enemies.push(enemy);

    // 보스 HP바 표시
    this.showBossHpUI(scaledBossData.name);

    // 등장 연출: 화면 흔들림
    this.cameras.main.shake(400, 0.01);

    // 경고 텍스트
    this.bossWarningText = this.add.text(GAME_W / 2, BATTLE_H / 2 - 30, '⚠ BOSS ⚠', {
      fontSize: '24px',
      color: '#ff0000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // 경고 텍스트 페이드아웃
    this.tweens.add({
      targets: this.bossWarningText,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        if (this.bossWarningText) {
          this.bossWarningText.destroy();
          this.bossWarningText = null;
        }
      },
    });
  }

  // ─── 웨이브 관리 ───

  /**
   * 웨이브를 시작합니다.
   *
   * 5의 배수 웨이브는 보스 웨이브로 처리됩니다.
   * 보스 웨이브에서는 보스 1체만 등장하며, 일반 적은 스폰되지 않습니다.
   */
  private startWave(wave: number): void {
    this.waveNumber = wave;
    this.waveSpawned = 0;
    this.waveKilled = 0;
    this.spawnTimer = 0;
    this.isMoving = true;

    // 보스 웨이브 판정
    this.isBossWave = (wave % BOSS_WAVE_INTERVAL === 0);

    if (this.isBossWave) {
      // 보스 웨이브: 보스 1체만 등장
      this.waveEnemyTotal = 1;

      // 1초 딜레이 후 보스 스폰 (연출 시간 확보)
      this.time.delayedCall(800, () => {
        this.spawnBoss();
      });
    } else {
      // 일반 웨이브: 적 수 점진적 증가
      this.waveEnemyTotal = 3 + wave * 2;
      if (this.waveEnemyTotal > 20) this.waveEnemyTotal = 20;
    }
  }

  /**
   * 일반 웨이브 클리어 처리
   */
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

  /**
   * 보스 처치 처리
   *
   * 보스 처치 시:
   * 1. 보스 HP바 숨김
   * 2. 화면 흔들림 + 승리 텍스트
   * 3. 체력 완전 회복
   * 4. 특별 보상 (중급 이상 비급 확정 드랍)
   * 5. 다음 웨이브로 진행
   */
  private onBossDefeated(): void {
    // 보스 HP바 숨김
    this.hideBossHpUI();
    this.isBossWave = false;
    this.bossEnemy = null;

    // 승리 연출
    this.cameras.main.flash(300, 255, 215, 0); // 금색 플래시

    const victoryText = this.add.text(GAME_W / 2, BATTLE_H / 2 - 20, '✦ BOSS CLEAR ✦', {
      fontSize: '18px',
      color: '#ffd740',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.tweens.add({
      targets: victoryText,
      alpha: 0,
      y: victoryText.y - 30,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => { victoryText.destroy(); },
    });

    // 체력 완전 회복
    this.player.heal(this.player.maxHp, this.player.maxStamina);

    // 세이브
    const save = loadGame();
    save.stageCleared = Math.max(save.stageCleared, this.waveNumber);
    saveGame(save);

    // UI에 보스 클리어 알림
    this.events.emit('boss-clear', this.waveNumber);
    this.events.emit('wave-clear', this.waveNumber);

    // 다음 웨이브 (2초 딜레이, 보스 클리어 후 여유 시간)
    this.time.delayedCall(2000, () => {
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

      // 보스는 히트박스가 더 큼
      const isBoss = (enemy === this.bossEnemy);
      const halfW = isBoss ? 24 : 16;
      const halfH = isBoss ? 36 : 24;

      const enemyRect = new Phaser.Geom.Rectangle(
        enemy.x - halfW, enemy.y - halfH, halfW * 2, halfH * 2,
      );

      if (Phaser.Geom.Rectangle.Overlaps(hitRect, enemyRect)) {
        const damage = Math.round(skill.damageMultiplier * 10);
        const killed = enemy.takeDamage(damage);

        if (skill.effect === 'KNOCKBACK' && !killed) {
          const chance = skill.effectChance ?? 0;
          if (Math.random() < chance) {
            // 보스는 넉백 거리 감소
            const knockForce = isBoss ? 60 : 150;
            enemy.applyKnockback(this.player.x, this.player.y, knockForce);
          }
        }

        // 보스에게는 대미지 텍스트를 더 크게 표시
        if (isBoss) {
          this.showDamageText(enemy.x, enemy.y - 40, damage, true);
        } else {
          this.showDamageText(enemy.x, enemy.y - 20, damage, false);
        }
      }
    }
  }

  private onEnemyAttack(_enemy: Enemy, damage: number): void {
    this.player.takeDamage(damage);
  }

  // ─── 배경 ───

  private createBackground(): void {
    // 패럴랙스 배경 (TileSprite로 무한 스크롤)
    this.bgMountains = this.add.tileSprite(0, 0, GAME_W, BATTLE_H - 48, 'bg_mountains')
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // 바닥 (돌길 + 풀)
    this.bgGround = this.add.tileSprite(0, BATTLE_H - 96, GAME_W, 96, 'bg_ground')
      .setOrigin(0, 0)
      .setScrollFactor(0);
  }

  private updateBackground(): void {
    if (this.bgMountains) this.bgMountains.tilePositionX = this.scrollX * 0.2;
    if (this.bgGround) this.bgGround.tilePositionX = this.scrollX * 1.0;
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

  private handleDrop(skillId: string, x: number, y: number): void {
    const skill = SKILL_DATABASE.get(skillId);
    if (!skill) return;

    const save = loadGame();
    save.inventory[skillId] = (save.inventory[skillId] ?? 0) + 1;
    if (!save.unlockedSkills.includes(skillId)) {
      save.unlockedSkills.push(skillId);
    }
    saveGame(save);

    // 드랍 텍스트 (등급에 따라 색상 변경)
    let dropColor = '#ffd740';
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
      isBossWave: this.isBossWave,
    });
  }
}
