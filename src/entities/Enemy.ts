import Phaser from 'phaser';
import type { EnemyData, DropEntry } from '../data/types';

/**
 * Enemy - 적 엔티티
 *
 * 간단한 추적 AI를 가지고 있습니다:
 * 1. 플레이어와의 거리를 계산합니다.
 * 2. attackRange 밖이면 플레이어를 향해 이동합니다.
 * 3. attackRange 안이면 쿨타임에 따라 공격합니다.
 *
 * 상태이상 지원:
 * - STUN: setStunned(true) 시 모든 행동 중지
 * - SLOW: setSpeedMultiplier(0.5) 시 이동속도 50% 감소
 *
 * 오브젝트 풀링을 위해 activate/deactivate 패턴을 사용합니다.
 * destroy()를 호출하지 않고 setActive(false) + setVisible(false)로
 * 풀에 반환하여 GC를 방지합니다.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private enemyData: EnemyData | null = null;
  private _hp = 0;
  private lastAttackTime = 0;
  private targetX = 0;
  private targetY = 0;
  private knockbackTimer = 0;

  // 상태이상
  private stunned = false;
  private speedMultiplier = 1.0;

  // 드랍 결과를 외부에서 읽기 위한 필드
  private pendingDrop: DropEntry | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy_bandit');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(0.75);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(50, 90);
    body.setOffset(39, 34);
    body.setCollideWorldBounds(true);

    this.setActive(false);
    this.setVisible(false);
    body.enable = false;
  }

  /** 현재 HP */
  get hp(): number { return this._hp; }

  /** 적 데이터 (이름 등 UI 표시용) */
  get data_(): EnemyData | null { return this.enemyData; }

  /** 현재 이동 속도 반환 */
  getSpeed(): number {
    return (this.enemyData?.speed ?? 0) * this.speedMultiplier;
  }

  /** 기절 상태 설정 */
  setStunned(value: boolean): void {
    this.stunned = value;
    if (value) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
    }
  }

  /** 이동속도 배율 설정 (SLOW 효과용) */
  setSpeedMultiplier(mul: number): void {
    this.speedMultiplier = mul;
  }

  /** 드랍 아이템 소비 (BattleScene에서 호출) */
  consumeDrop(): DropEntry | null {
    const drop = this.pendingDrop;
    this.pendingDrop = null;
    return drop;
  }

  /**
   * 풀에서 꺼내어 활성화합니다.
   */
  activate(data: EnemyData, x: number, y: number): void {
    this.enemyData = data;
    this._hp = data.hp;
    this.lastAttackTime = 0;
    this.knockbackTimer = 0;
    this.pendingDrop = null;
    this.stunned = false;
    this.speedMultiplier = 1.0;

    this.setTexture(data.spriteKey);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.clearTint();
    this.setAlpha(1);

    // 적 애니메이션 재생
    const animKey = `enemy-${data.id}-idle`;
    if (this.scene.anims.exists(animKey)) {
      this.play(animKey);
    } else {
      // 변형 적은 원본 스프라이트의 애니메이션 사용
      const baseSpriteId = data.spriteKey.replace('enemy_', '').replace('boss_', '');
      const fallbackKey = `enemy-${baseSpriteId}-idle`;
      if (this.scene.anims.exists(fallbackKey)) {
        this.play(fallbackKey);
      } else if (this.scene.anims.exists('boss-beopwang-idle')) {
        // 보스는 beopwang 애니메이션 사용
        if (data.spriteKey === 'boss_beopwang') {
          this.play('boss-beopwang-idle');
        }
      }
    }

    // 적은 스폰 즉시 왼쪽(플레이어 방향)을 바라봐야 함
    this.setFlipX(true);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);
  }

  /**
   * 풀에 반환합니다 (destroy 대신 사용).
   */
  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.enemyData = null;
    this.stunned = false;
    this.speedMultiplier = 1.0;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
  }

  /**
   * 피격 처리
   * @returns 사망 여부
   */
  takeDamage(amount: number): boolean {
    if (!this.active || !this.enemyData) return false;

    this._hp = Math.max(0, this._hp - amount);
    this.setTint(0xff8888);

    // 피격 경직
    this.knockbackTimer = 200;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // 0.1초 후 틴트 해제
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });

    if (this._hp <= 0) {
      this.onDeath();
      return true;
    }

    return false;
  }

  /**
   * 넉백 적용
   */
  applyKnockback(fromX: number, fromY: number, force: number): void {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / len) * force, (dy / len) * force);
    this.knockbackTimer = 300;
  }

  /**
   * 플레이어 위치를 추적 대상으로 설정합니다.
   */
  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  /**
   * 프레임 업데이트 - AI 로직
   */
  update(_time: number, delta: number): void {
    if (!this.active || !this.enemyData) return;

    // 기절 상태면 모든 행동 중지
    if (this.stunned) return;

    // 넉백 중이면 이동 AI 중지
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= delta;
      return;
    }

    const data = this.enemyData;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 적은 항상 왼쪽(플레이어 방향)을 바라봄
    this.setFlipX(true);

    if (dist > data.attackRange) {
      // 추적 이동 (speedMultiplier 적용)
      const nx = dx / dist;
      const ny = dy / dist;
      const speed = data.speed * this.speedMultiplier;
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(nx * speed, ny * speed);
    } else {
      // 공격 범위 내 → 정지 후 공격
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);

      const now = this.scene.time.now;
      if (now - this.lastAttackTime >= data.attackCooldown) {
        this.lastAttackTime = now;
        this.scene.events.emit('enemy-attack', this, data.damage);
      }
    }
  }

  /**
   * 사망 처리 - 드랍 테이블 롤링 후 비활성화
   */
  private onDeath(): void {
    if (!this.enemyData) return;

    // 드랍 테이블 롤링
    const roll = Math.random();
    let cumulative = 0;
    for (const entry of this.enemyData.dropTable) {
      cumulative += entry.chance;
      if (roll < cumulative) {
        this.pendingDrop = entry;
        break;
      }
    }

    // 사망 연출 (빠른 페이드아웃 - 파편 이펙트는 BattleScene에서 처리)
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.deactivate();
      },
    });
  }
}
