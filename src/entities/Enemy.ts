import Phaser from 'phaser';
import type { EnemyData, DropEntry } from '../data/types';

/**
 * 원본 스프라이트시트가 왼쪽을 보고 그려졌는지 여부.
 *
 * 적은 항상 왼쪽(플레이어 방향)을 바라봐야 한다.
 * - 원본이 왼쪽을 보면(true) → flipX=false (그대로)
 * - 원본이 오른쪽을 보면(false) → flipX=true (뒤집어서 왼쪽)
 * 즉 flipX = !facesLeft.
 *
 * 산적/검객 계열은 원본이 왼쪽, 자객/보스 계열은 원본이 오른쪽을 본다.
 */
const SPRITE_FACES_LEFT: Readonly<Record<string, boolean>> = {
  enemy_bandit: true,
  enemy_swordsman: true,
  enemy_assassin: false,
  boss_beopwang: false,
};

function shouldFlipX(spriteKey: string | undefined): boolean {
  const facesLeft = SPRITE_FACES_LEFT[spriteKey ?? ''] ?? false;
  return !facesLeft;
}

/**
 * 적 공격 모션 파라미터 (스프라이트별).
 *
 * 적 스프라이트는 idle 4프레임뿐이라 별도 공격 프레임이 없다.
 * 대신 "윈드업(뒤로) → 돌진(앞으로) → 복귀" 위치 트윈으로 공격감을 연출한다.
 * - windup: 타격 전 뒤로 빼는 거리(px)
 * - lunge:  타격 시 앞으로 돌진하는 거리(px)
 * - hopY:   타격 시 살짝 떠오르는 높이(px, 도끼 내려치기 등)
 * - windupMs/strikeMs/recoverMs: 각 단계 지속시간
 */
interface AttackMotion {
  windup: number;
  lunge: number;
  hopY: number;
  windupMs: number;
  strikeMs: number;
  recoverMs: number;
}

const ATTACK_MOTION: Readonly<Record<string, AttackMotion>> = {
  // 산적 (도끼): 큰 동작 + 내려치는 느낌의 hop
  enemy_bandit:    { windup: 6, lunge: 16, hopY: 5, windupMs: 130, strikeMs: 80, recoverMs: 160 },
  // 검객 (검): 길게 찌르기
  enemy_swordsman: { windup: 7, lunge: 20, hopY: 2, windupMs: 120, strikeMs: 75, recoverMs: 150 },
  // 자객 (단검): 짧고 빠른 연속 찌르기 느낌
  enemy_assassin:  { windup: 3, lunge: 12, hopY: 0, windupMs: 70,  strikeMs: 55, recoverMs: 90 },
  // 보스: 묵직한 큰 동작
  boss_beopwang:   { windup: 8, lunge: 18, hopY: 6, windupMs: 200, strikeMs: 110, recoverMs: 240 },
  default:         { windup: 5, lunge: 14, hopY: 2, windupMs: 110, strikeMs: 80, recoverMs: 140 },
};

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

  // 공격 모션 진행 중 여부 (true 동안 이동 AI 정지, tween 이 위치 제어)
  private attacking = false;
  private baseY = 0;

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
    this.attacking = false;
    this.setAngle(0);
    this.scene.tweens.killTweensOf(this);

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
    // (스프라이트 원본 방향에 따라 flip 여부 결정)
    this.setFlipX(shouldFlipX(data.spriteKey));

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);
  }

  /**
   * 풀에 반환합니다 (destroy 대신 사용).
   */
  deactivate(): void {
    this.scene.tweens.killTweensOf(this);
    this.attacking = false;
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
    // 공격 모션 중이면 중단하고 넉백이 우선
    if (this.attacking) {
      this.scene.tweens.killTweensOf(this);
      this.attacking = false;
      this.setAngle(0);
      this.y = this.baseY || this.y;
    }

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

    const data = this.enemyData;

    // 적은 항상 왼쪽(플레이어 방향)을 바라봄 (스프라이트 원본 방향 보정)
    this.setFlipX(shouldFlipX(data.spriteKey));

    // 공격 모션 중에는 tween 이 위치를 제어하므로 이동 AI 정지
    if (this.attacking) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      return;
    }

    // 넉백 중이면 이동 AI 중지
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= delta;
      return;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

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
        this.performAttack(data);
      }
    }
  }

  /**
   * 공격 모션 실행: 윈드업(뒤로) → 돌진(앞으로) → 복귀.
   * 돌진 정점에서 'enemy-attack' 이벤트를 발생시켜 데미지를 입힌다.
   *
   * 적 스프라이트에 공격 프레임이 없으므로 위치/높이 트윈으로 연출한다.
   */
  private performAttack(data: EnemyData): void {
    if (this.attacking || !this.active) return;
    this.attacking = true;

    const dir = this.targetX < this.x ? -1 : 1; // 플레이어 방향
    const startX = this.x;
    this.baseY = this.y;
    const m = ATTACK_MOTION[data.spriteKey] ?? ATTACK_MOTION.default;

    this.scene.tweens.chain({
      targets: this,
      onComplete: () => {
        this.attacking = false;
        this.y = this.baseY;
      },
      tweens: [
        // 1) 윈드업: 살짝 뒤로 빼기
        {
          x: startX - dir * m.windup,
          duration: m.windupMs,
          ease: 'Sine.easeOut',
        },
        // 2) 돌진: 앞으로 + 살짝 떠오르기, 정점에서 타격
        {
          x: startX + dir * m.lunge,
          y: this.baseY - m.hopY,
          duration: m.strikeMs,
          ease: 'Power2',
          onComplete: () => {
            if (this.active && this.enemyData) {
              this.scene.events.emit('enemy-attack', this, data.damage);
            }
          },
        },
        // 3) 복귀: 원위치
        {
          x: startX,
          y: this.baseY,
          duration: m.recoverMs,
          ease: 'Sine.easeInOut',
        },
      ],
    });
  }

  /**
   * 사망 처리 - 드랍 테이블 롤링 후 비활성화
   */
  private onDeath(): void {
    if (!this.enemyData) return;

    // 공격 모션 중 사망 시 위치 트윈 중단 (시체가 계속 돌진하지 않도록)
    this.scene.tweens.killTweensOf(this);
    this.attacking = false;
    this.setAngle(0);

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
