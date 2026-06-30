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
  // 명시적으로 등록되지 않은 스프라이트(enemy_art_*, boss_art_*)는 왼쪽을 향하는 아트이므로 뒤집지 않음
  const facesLeft = SPRITE_FACES_LEFT[spriteKey ?? ''] ?? true;
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
  private lastEnemyData: EnemyData | null = null;
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
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarLag: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private hpBarShine: Phaser.GameObjects.Graphics;
  private hpBarLagRatio = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy_art_01');

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.hpBarBg = scene.add.graphics().setDepth(32).setVisible(false);
    this.hpBarLag = scene.add.graphics().setDepth(33).setVisible(false);
    this.hpBarFill = scene.add.graphics().setDepth(34).setVisible(false);
    this.hpBarShine = scene.add.graphics().setDepth(35).setVisible(false);

    this.setDisplaySize(170, 170);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(58, 120);
    body.setOffset(56, 42);
    body.setCollideWorldBounds(true);

    this.setActive(false);
    this.setVisible(false);
    body.enable = false;
  }

  /** 현재 HP */
  get hp(): number { return this._hp; }

  /** 적 데이터 (이름 등 UI 표시용) */
  get data_(): EnemyData | null { return this.enemyData ?? this.lastEnemyData; }

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
   * 애니메이션 키 베이스. 스프라이트 키 기준이라 변형 적(militia 등)도 동작.
   * 'enemy_bandit' -> 'enemy-bandit', 'boss_beopwang' -> 'boss-beopwang'
   */
  private animBase(): string {
    return (this.enemyData?.spriteKey ?? '').replace(/_/g, '-');
  }

  private playIdleAnim(): void {
    const key = `${this.animBase()}-idle`;
    if (this.scene.anims.exists(key)) this.play(key, true);
  }

  private playAttackAnim(): void {
    const key = `${this.animBase()}-attack`;
    if (this.scene.anims.exists(key)) {
      this.play(key);
    } else {
      // 공격 애니메이션이 없으면 idle 유지 (위치 트윈만으로 연출)
      this.scene.tweens.add({ targets: this, angle: -4, duration: 80, yoyo: true });
    }
  }

  /**
   * 보스 특수 스킬 시전 모션 (BattleScene에서 호출).
   * 공격 애니메이션 + 잠깐 커졌다 돌아오는 윈드업으로 시전감을 준다.
   * 위치 이동은 없음(원거리 스킬). 이동 AI와 충돌하지 않도록 attacking 사용 안 함.
   */
  playCastMotion(): void {
    if (!this.active) return;
    this.playAttackAnim();
    const s = this.scaleX;
    this.scene.tweens.add({
      targets: this,
      scaleX: s * 1.12, scaleY: s * 1.12,
      duration: 160, yoyo: true, ease: 'Sine.easeOut',
      onComplete: () => { if (this.active) { this.setScale(s); this.playIdleAnim(); } },
    });
  }

  /**
   * 풀에서 꺼내어 활성화합니다.
   */
  activate(data: EnemyData, x: number, y: number): void {
    this.enemyData = data;
    this.lastEnemyData = data;
    this._hp = data.hp;
    this.lastAttackTime = 0;
    this.knockbackTimer = 0;
    this.pendingDrop = null;
    this.stunned = false;
    this.speedMultiplier = 1.0;
    this.attacking = false;
    this.setAngle(0);
    this.setDepth(0); // 보스로 쓰였던 객체가 풀에서 재사용될 때 depth(20) 잔존 방지
    this.scene.tweens.killTweensOf(this);

    // 여백이 트리밍된 프레임이 있으면 캐릭터 실측 기준으로 크기를 잡는다.
    // (512x512 원본은 캐릭터가 ~55%만 차지해 졸병이 너무 작게 보였음)
    const hasTrim = this.scene.textures.exists(data.spriteKey) &&
      this.scene.textures.get(data.spriteKey).has('trim');
    this.setTexture(data.spriteKey, hasTrim ? 'trim' : undefined);

    const isBoss = data.rank === 'BOSS';
    if (hasTrim) {
      const targetH = isBoss ? 235 : 158;
      const aspect = this.frame.width / this.frame.height;
      this.setDisplaySize(targetH * aspect, targetH);
    } else if (isBoss) {
      this.setDisplaySize(250, 250);
    } else {
      this.setDisplaySize(170, 170);
    }

    // 물리 바디를 현재 프레임 크기에 맞춤 (월드 경계 충돌용)
    const physBody = this.body as Phaser.Physics.Arcade.Body;
    physBody.setSize(this.frame.width * 0.55, this.frame.height * 0.9, true);

    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(12); // 배경 레이어(1~3) 위에 표시; 보스는 spawnBoss에서 더 높게 재설정됨
    this.clearTint();
    this.setAlpha(1);
    this.setAngle(0);
    this.setScale(1);
    this.idleVisualTimer = 0;

    // 적 애니메이션 재생 (idle)
    this.playIdleAnim();

    // 적은 스폰 즉시 왼쪽(플레이어 방향)을 바라봐야 함
    // (스프라이트 원본 방향에 따라 flip 여부 결정)
    this.setFlipX(shouldFlipX(data.spriteKey));

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);
    this.hpBarLagRatio = 1;
    this.hpBarBg.setVisible(true);
    this.hpBarLag.setVisible(true);
    this.hpBarFill.setVisible(true);
    this.hpBarShine.setVisible(true);
    this.updateHpBar();
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
    this.idleVisualTimer = 0;
    this.setAngle(0);
    this.setScale(1);
    this.hpBarBg.clear().setVisible(false);
    this.hpBarLag.clear().setVisible(false);
    this.hpBarFill.clear().setVisible(false);
    this.hpBarShine.clear().setVisible(false);

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

    const prevRatio = Phaser.Math.Clamp(this._hp / Math.max(1, this.enemyData.hp), 0, 1);
    this._hp = Math.max(0, this._hp - amount);
    const nextRatio = Phaser.Math.Clamp(this._hp / Math.max(1, this.enemyData.hp), 0, 1);
    this.hpBarLagRatio = Math.max(this.hpBarLagRatio, prevRatio);
    this.scene.tweens.add({
      targets: this,
      hpBarLagRatio: nextRatio,
      duration: 430,
      delay: 80,
      ease: 'Cubic.easeOut',
    });
    this.setTint(0xff8888);
    this.updateHpBar();

    // Hollow Knight 느낌의 피격 반응 (작은 flinch)
    if (!this.attacking) {
      this.scene.tweens.add({
        targets: this,
        angle: (Math.random() - 0.5) * 6,
        scaleX: this.scaleX * 0.96,
        duration: 70,
        yoyo: true,
        ease: 'Sine.easeOut'
      });
    }

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

  private idleVisualTimer = 0;

  /**
   * 프레임 업데이트 - AI 로직
   */
  update(_time: number, delta: number): void {
    if (!this.active || !this.enemyData) return;
    this.updateHpBar();

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

    // 살아있는 idle 느낌 (싱글 스프라이트여도 미세 각도/스케일로 생동감)
    this.idleVisualTimer += delta;
    if (!this.attacking && this.knockbackTimer <= 0) {
      const t = this.idleVisualTimer * 0.0015;
      const wobble = Math.sin(t * 2.1) * 1.1;
      const breath = 1 + Math.sin(t * 1.6) * 0.009;
      this.setAngle(wobble * 0.6);
      this.setScale(breath, breath);
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const body = this.body as Phaser.Physics.Arcade.Body;

    // 확대된 표시 크기에 맞춰 플레이어와 겹치지 않는 최소 간격 확보
    const stopOffsetX = Math.max(42, Math.min(data.attackRange, 64));
    if (this.x <= this.targetX + stopOffsetX) {
      this.x = this.targetX + stopOffsetX;
      body.setVelocity(0, 0);

      const now = this.scene.time.now;
      if (now - this.lastAttackTime >= data.attackCooldown) {
        this.lastAttackTime = now;
        this.performAttack(data);
      }
      return;
    }

    if (dist > data.attackRange) {
      // 추적 이동 (speedMultiplier 적용)
      const nx = dx / dist;
      const ny = dy / dist;
      const speed = data.speed * this.speedMultiplier;
      body.setVelocity(nx * speed, ny * speed);
      // 이동 중에는 idle visual 리셋
      this.setAngle(0);
      this.setScale(1);
    } else {
      // 공격 범위 내 → 정지 후 공격
      body.setVelocity(0, 0);

      const now = this.scene.time.now;
      if (now - this.lastAttackTime >= data.attackCooldown) {
        this.lastAttackTime = now;
        this.performAttack(data);
      }
    }
  }

  private updateHpBar(): void {
    const data = this.enemyData;
    if (!this.active || !data) return;

    const isBoss = data.rank === 'BOSS';
    const width = isBoss ? 96 : 64;
    const height = isBoss ? 7 : 5;
    const x = this.x - width / 2;
    // 표시 크기에 따라 머리 위에 정확히 위치 (스케일 변동 대응)
    const y = this.y - this.displayHeight / 2 - (isBoss ? 18 : 12);
    const ratio = Phaser.Math.Clamp(this._hp / Math.max(1, data.hp), 0, 1);
    const fillColor = ratio < 0.3 ? 0xd9211b : isBoss ? 0xff3b21 : 0xe4432d;

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x090706, 0.82);
    this.hpBarBg.fillRoundedRect(x - 2, y - 2, width + 4, height + 4, 2);
    this.hpBarBg.lineStyle(1, isBoss ? 0xb78238 : 0x2b2015, 0.9);
    this.hpBarBg.strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, 2);

    const lagRatio = Phaser.Math.Clamp(this.hpBarLagRatio, ratio, 1);
    this.hpBarLag.clear();
    if (lagRatio > ratio) {
      this.hpBarLag.fillStyle(isBoss ? 0xffd05c : 0xff8a3d, 0.78);
      this.hpBarLag.fillRoundedRect(x + width * ratio, y, width * (lagRatio - ratio), height, 2);
    }

    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(fillColor, 1);
    this.hpBarFill.fillRoundedRect(x, y, width * ratio, height, 2);

    this.hpBarShine.clear();
    this.hpBarShine.fillStyle(0xffffff, isBoss ? 0.24 : 0.18);
    this.hpBarShine.fillRect(x + 1, y + 1, Math.max(0, width * ratio - 2), 1);
    if (isBoss) {
      this.hpBarShine.lineStyle(1, 0x090706, 0.72);
      for (let i = 1; i < 4; i++) {
        const tickX = x + (width / 4) * i;
        this.hpBarShine.lineBetween(tickX, y - 1, tickX, y + height + 1);
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

    this.setAngle(0);
    this.setScale(1);

    // 공격 프레임 애니메이션 재생 (위치 트윈과 함께 연출)
    this.playAttackAnim();

    this.scene.tweens.chain({
      targets: this,
      onComplete: () => {
        this.attacking = false;
        this.y = this.baseY;
        this.setAngle(0);
        this.setScale(1);
        this.playIdleAnim();
      },
      tweens: [
        // 1) 윈드업: 살짝 뒤로 빼기
        {
          x: startX - dir * m.windup,
          duration: m.windupMs,
          ease: 'Sine.easeOut',
        },
        // 2) 돌진: 앞으로 + 살짝 떠오르기, 정점에서 타격 + 지면 먼지 VFX
        {
          x: startX + dir * m.lunge,
          y: this.baseY - m.hopY,
          duration: m.strikeMs,
          ease: 'Power2',
          onComplete: () => {
            if (this.active && this.enemyData) {
              this.scene.events.emit('enemy-attack', this, data.damage);
              this.spawnAttackDust(dir);
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

  /** 공격 착지 시 간단한 먼지/파편 (싱글스프라이트 적에게 생동감 추가) */
  private spawnAttackDust(dir: number): void {
    const gx = this.x + dir * 8;
    const gy = this.baseY + 18;
    for (let i = 0; i < 3; i++) {
      const p = this.scene.add.rectangle(
        gx + (Math.random() - 0.5) * 6,
        gy + Math.random() * 3,
        3 + Math.random() * 2, 2,
        0x665544, 0.6
      ).setDepth(5);
      this.scene.tweens.add({
        targets: p,
        x: gx + dir * (18 + Math.random() * 12),
        alpha: 0,
        duration: 180 + Math.random() * 80,
        onComplete: () => p.destroy(),
      });
    }
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
