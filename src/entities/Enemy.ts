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

  // 드랍 결과를 외부에서 읽기 위한 필드
  private pendingDrop: DropEntry | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy_bandit');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 128x128 스프라이트를 0.75배로 표시 (화면에서 ~96x96 크기)
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

    this.setTexture(data.spriteKey);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.clearTint();
    this.setAlpha(1);

    // 적 애니메이션 재생 (spriteKey에서 'enemy_' 제거 후 애니메이션 키 생성)
    const animKey = `enemy-${data.id}-idle`;
    if (this.scene.anims.exists(animKey)) {
      this.play(animKey);
    }

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
    // 오른쪽에서 왼쪽으로 다가오므로 flipX = true 고정
    this.setFlipX(true);

    if (dist > data.attackRange) {
      // 추적 이동
      const nx = dx / dist;
      const ny = dy / dist;
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(nx * data.speed, ny * data.speed);
    } else {
      // 공격 범위 내 → 정지 후 공격
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);

      const now = this.scene.time.now;
      if (now - this.lastAttackTime >= data.attackCooldown) {
        this.lastAttackTime = now;
        // 공격 이벤트 발생 (BattleScene에서 처리)
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

    // 사망 연출 (페이드아웃)
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.deactivate();
      },
    });
  }
}
