import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { ENEMY_DATABASE } from '../data/enemies';
import { SKILL_DATABASE } from '../data/skills';
import type { SkillData, BattleMode } from '../data/types';
import { loadGame, saveGame } from '../systems/SaveSystem';
import { getBackgroundForWave, type BackgroundTheme } from '../data/characters';

/**
 * BattleScene - 상단 횡스크롤 자동전투 씬
 *
 * 화면 상단 60% (360 x 384)를 차지합니다.
 *
 * 캐릭터 선택 연동:
 * - CharacterSelectScene에서 전달받은 characterId로 Player를 생성
 * - 캐릭터별 고유 스프라이트 + 스탯 보정이 자동 적용됨
 *
 * 배경 전환 시스템:
 * - 웨이브 진행에 따라 배경이 자동 전환 (산림→대나무숲→설산→사막→화산)
 *
 * 보스전 설계:
 * - 5의 배수 웨이브에서 보스 등장, HP바 표시, 클리어 시 특별 보상
 */

const GAME_W = 360;
const BATTLE_H = 384;
const GROUND_Y = BATTLE_H - 80;
const SCROLL_SPEED = 40;
const MAX_ENEMIES = 6;
const SPAWN_DISTANCE = 300;
const BOSS_WAVE_INTERVAL = 5;

const SPAWN_TABLE = ['bandit', 'swordsman', 'assassin'] as const;

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
  private currentBgTheme: BackgroundTheme | null = null;

  constructor() {
    super({ key: 'BattleScene' });
  }

  /**
   * init은 scene.start()에서 전달된 데이터를 받습니다.
   * CharacterSelectScene에서 { characterId: string }을 전달합니다.
   */
  init(data: { characterId?: string }): void {
    if (data.characterId) {
      this.characterId = data.characterId;
    }
  }

  create(): void {
    // 카메라를 상단 영역으로 제한
    this.cameras.main.setViewport(0, 0, GAME_W, BATTLE_H);
    this.cameras.main.setBackgroundColor('#1a0a2e');

    // 배경 생성 (패럴랙스 스크롤)
    this.createBackground();

    // 플레이어 생성 (선택한 캐릭터 ID 전달)
    this.player = new Player(this, 80, GROUND_Y, this.characterId);
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
    this.player.update(time, delta);
    this.updateScroll(delta);
    this.updateBattleAI(delta);
    this.updateEnemies(time, delta);
    this.updateSpawning(delta);
    this.updateBackground();
    this.updateBossHpBar();
    this.emitState();
  }

  // ─── 보스 HP바 UI ───

  private createBossHpUI(): void {
    this.bossNameText = this.add.text(GAME_W / 2, 12, '', {
      fontSize: '11px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
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
    const barY = 24;

    this.bossHpBg.clear();
    this.bossHpBg.fillStyle(0x333333, 0.8);
    this.bossHpBg.fillRoundedRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 3);

    let barColor = 0xff2222;
    if (ratio > 0.6) barColor = 0xff4444;
    else if (ratio > 0.3) barColor = 0xff8800;
    else barColor = 0xcc0000;

    this.bossHpBar.clear();
    this.bossHpBar.fillStyle(barColor, 1);
    this.bossHpBar.fillRoundedRect(barX, barY, barWidth * ratio, barHeight, 2);

    if (this.bossNameText) {
      this.bossNameText.setText(`⚔ ${bossData.name} ⚔  HP: ${this.bossEnemy.hp}/${bossData.hp}`);
    }
  }

  private showBossHpUI(bossName: string): void {
    if (this.bossNameText) {
      this.bossNameText.setText(`⚔ ${bossName} ⚔`);
      this.bossNameText.setVisible(true);
    }
    if (this.bossHpBg) this.bossHpBg.setVisible(true);
    if (this.bossHpBar) this.bossHpBar.setVisible(true);
  }

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

    const hasNearbyEnemy = this.enemies.some(e =>
      e.active && Math.abs(e.x - this.player.x) < 120
    );

    if (!hasNearbyEnemy && this.player.currentCharState !== 'ATTACK') {
      this.scrollX += SCROLL_SPEED * (delta / 1000);
      this.player.handleMove(1, 0);
    } else {
      this.player.handleMove(0, 0);
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

    const skills = this.player.skills;
    for (let i = 0; i < skills.length; i++) {
      if (closestDist <= skills[i].range + 20) {
        this.player.handleAttack(i);
        return;
      }
    }
  }

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
        enemy.setTarget(this.player.x, this.player.y);
        enemy.update(time, delta);
        activeEnemies.push(enemy);
      } else {
        const drop = enemy.consumeDrop();
        if (drop) {
          this.handleDrop(drop.skillId, enemy.x, enemy.y);
        }

        const isBossDeath = (enemy === this.bossEnemy);

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

    const enemyId = SPAWN_TABLE[Math.floor(Math.random() * SPAWN_TABLE.length)];
    const data = ENEMY_DATABASE.get(enemyId);
    if (!data) return;

    const spawnX = this.player.x + SPAWN_DISTANCE + Math.random() * 60;
    const spawnY = GROUND_Y + (Math.random() - 0.5) * 16;

    enemy.activate(data, spawnX, spawnY);
    this.enemies.push(enemy);
    this.waveSpawned++;
  }

  private spawnBoss(): void {
    const enemy = this.enemyPool.pop();
    if (!enemy) return;

    const bossData = ENEMY_DATABASE.get('boss_beopwang');
    if (!bossData) return;

    const hpMultiplier = 1 + (this.waveNumber / BOSS_WAVE_INTERVAL - 1) * 0.5;
    const scaledBossData = {
      ...bossData,
      hp: Math.round(bossData.hp * hpMultiplier),
      damage: Math.round(bossData.damage * (1 + (this.waveNumber / BOSS_WAVE_INTERVAL - 1) * 0.3)),
    };

    const spawnX = this.player.x + SPAWN_DISTANCE + 40;
    const spawnY = GROUND_Y;

    enemy.activate(scaledBossData, spawnX, spawnY);
    enemy.setScale(1.0);

    this.bossEnemy = enemy;
    this.enemies.push(enemy);

    this.showBossHpUI(scaledBossData.name);
    this.cameras.main.shake(400, 0.01);

    this.bossWarningText = this.add.text(GAME_W / 2, BATTLE_H / 2 - 30, '⚠ BOSS ⚠', {
      fontSize: '24px',
      color: '#ff0000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

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

  private startWave(wave: number): void {
    this.waveNumber = wave;
    this.waveSpawned = 0;
    this.waveKilled = 0;
    this.spawnTimer = 0;
    this.isMoving = true;

    // 배경 전환 체크
    this.checkBackgroundChange();

    this.isBossWave = (wave % BOSS_WAVE_INTERVAL === 0);

    if (this.isBossWave) {
      this.waveEnemyTotal = 1;
      this.time.delayedCall(800, () => {
        this.spawnBoss();
      });
    } else {
      this.waveEnemyTotal = 3 + wave * 2;
      if (this.waveEnemyTotal > 20) this.waveEnemyTotal = 20;
    }
  }

  /**
   * 웨이브에 따라 배경을 전환합니다.
   * 새 배경 테마가 현재와 다르면 TileSprite의 텍스처를 교체합니다.
   */
  private checkBackgroundChange(): void {
    const theme = getBackgroundForWave(this.waveNumber);
    if (this.currentBgTheme && this.currentBgTheme.id === theme.id) return;

    this.currentBgTheme = theme;

    // 배경 텍스처 교체
    if (this.bgMountains) {
      this.bgMountains.setTexture(theme.mountainsKey);
    }
    if (this.bgGround) {
      this.bgGround.setTexture(theme.groundKey);
    }

    // 배경 전환 연출 (짧은 플래시)
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
    this.player.heal(30, 20);

    const save = loadGame();
    save.stageCleared = Math.max(save.stageCleared, this.waveNumber);
    saveGame(save);

    this.events.emit('wave-clear', this.waveNumber);

    this.time.delayedCall(1000, () => {
      this.startWave(this.waveNumber + 1);
    });
  }

  private onBossDefeated(): void {
    this.hideBossHpUI();
    this.isBossWave = false;
    this.bossEnemy = null;

    this.cameras.main.flash(300, 255, 215, 0);

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

    this.player.heal(this.player.maxHp, this.player.maxStamina);

    const save = loadGame();
    save.stageCleared = Math.max(save.stageCleared, this.waveNumber);
    saveGame(save);

    this.events.emit('boss-clear', this.waveNumber);
    this.events.emit('wave-clear', this.waveNumber);

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

    // 캐릭터 대미지 배율 적용
    const charDmgMul = this.player.characterDamageMul;

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;

      const isBoss = (enemy === this.bossEnemy);
      const halfW = isBoss ? 24 : 16;
      const halfH = isBoss ? 36 : 24;

      const enemyRect = new Phaser.Geom.Rectangle(
        enemy.x - halfW, enemy.y - halfH, halfW * 2, halfH * 2,
      );

      if (Phaser.Geom.Rectangle.Overlaps(hitRect, enemyRect)) {
        const damage = Math.round(skill.damageMultiplier * 10 * charDmgMul);
        const killed = enemy.takeDamage(damage);

        if (skill.effect === 'KNOCKBACK' && !killed) {
          const chance = skill.effectChance ?? 0;
          if (Math.random() < chance) {
            const knockForce = isBoss ? 60 : 150;
            enemy.applyKnockback(this.player.x, this.player.y, knockForce);
          }
        }

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
    const theme = getBackgroundForWave(this.waveNumber);
    this.currentBgTheme = theme;

    // 배경 산 레이어: 상단을 잘라내고 아래쪽만 보여줌 (하늘 비율 축소)
    this.bgMountains = this.add.tileSprite(0, -120, GAME_W, BATTLE_H + 60, theme.mountainsKey)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // 바닥 레이어: 더 넓게 표시
    this.bgGround = this.add.tileSprite(0, BATTLE_H - 140, GAME_W, 140, theme.groundKey)
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
