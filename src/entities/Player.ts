import Phaser from 'phaser';
import type { CharacterState, SkillData } from '../data/types';
import { SKILL_DATABASE } from '../data/skills';

/**
 * Player - 플레이어 캐릭터 엔티티
 *
 * 상태머신(State Machine) 패턴으로 캐릭터 행동을 관리합니다.
 *
 * 상태 전이 규칙:
 *   IDLE ↔ RUN (이동 입력)
 *   IDLE/RUN → ATTACK (공격 입력, 쿨타임 충족 시)
 *   IDLE/RUN → DASH (대시 입력, 쿨타임 충족 시)
 *   ATTACK → IDLE (애니메이션 완료)
 *   DASH → IDLE (애니메이션 완료)
 *   * → HIT (피격 시)
 *   HIT → IDLE (경직 시간 경과)
 *   * → DEAD (HP ≤ 0)
 *
 * 왜 상태머신인가?
 * - 각 상태에서 허용되는 행동을 명확히 제한합니다.
 * - "공격 중에 이동 불가", "대시 중 무적" 같은 규칙을 깔끔하게 구현합니다.
 * - 상태 전이가 명시적이므로 버그 추적이 쉽습니다.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // ─── 상태 ───
  private currentState: CharacterState = 'IDLE';
  private stateTimer = 0;
  private facingRight = true;

  // ─── 스탯 ───
  private _hp: number;
  private _maxHp: number;
  private _stamina: number;
  private _maxStamina: number;
  private moveSpeed = 100;

  // ─── 무공 장착 ───
  private equippedSkills: SkillData[] = [];
  private equippedDash: SkillData | null = null;
  private skillCooldowns: Map<string, number> = new Map();

  // ─── 전투 ───
  private currentSkill: SkillData | null = null;
  private currentFrame = 0;
  private hitFrameIndex = 0;
  private invincible = false;

  // ─── 콜백 ───
  private onHitCallback: ((x: number, y: number, skill: SkillData) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player_idle');

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // 물리 바디 설정
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(16, 24);
    body.setOffset(8, 8);

    // 초기 스탯
    this._hp = 100;
    this._maxHp = 100;
    this._stamina = 50;
    this._maxStamina = 50;

    // 기본 무공 장착
    const samjae = SKILL_DATABASE.get('samjae');
    const dash = SKILL_DATABASE.get('chosangbi');
    if (samjae) this.equippedSkills.push(samjae);
    if (dash) this.equippedDash = dash;
  }

  // ─── Public Getters (읽기 전용 접근) ───

  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get stamina(): number { return this._stamina; }
  get maxStamina(): number { return this._maxStamina; }
  get currentCharState(): CharacterState { return this.currentState; }
  get isFacingRight(): boolean { return this.facingRight; }
  get skills(): readonly SkillData[] { return this.equippedSkills; }

  /**
   * 히트 콜백 등록
   * BattleScene에서 히트박스 판정을 처리하기 위해 사용합니다.
   */
  setOnHitCallback(cb: (x: number, y: number, skill: SkillData) => void): void {
    this.onHitCallback = cb;
  }

  /**
   * 무공 장착 (외부에서 호출)
   */
  equipSkill(skillId: string, slotIndex: number): boolean {
    const skill = SKILL_DATABASE.get(skillId);
    if (!skill || skill.type !== 'ACTIVE') return false;
    if (slotIndex < 0 || slotIndex > 2) return false;

    // 배열 크기 보장
    while (this.equippedSkills.length <= slotIndex) {
      const defaultSkill = SKILL_DATABASE.get('samjae');
      if (defaultSkill) this.equippedSkills.push(defaultSkill);
    }
    this.equippedSkills[slotIndex] = skill;
    return true;
  }

  equipDash(skillId: string): boolean {
    const skill = SKILL_DATABASE.get(skillId);
    if (!skill || skill.type !== 'DASH') return false;
    this.equippedDash = skill;
    return true;
  }

  // ─── 입력 처리 ───

  /**
   * 이동 입력을 처리합니다.
   * IDLE 또는 RUN 상태에서만 이동 가능합니다.
   */
  handleMove(dx: number, dy: number): void {
    if (this.currentState === 'ATTACK' || this.currentState === 'DASH' ||
        this.currentState === 'HIT' || this.currentState === 'DEAD') {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;

    if (dx === 0 && dy === 0) {
      body.setVelocity(0, 0);
      this.changeState('IDLE');
      return;
    }

    // 방향 정규화 (대각선 이동 시 속도 일정하게)
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / len;
    const ny = dy / len;

    body.setVelocity(nx * this.moveSpeed, ny * this.moveSpeed);
    this.facingRight = dx >= 0;
    this.setFlipX(!this.facingRight);
    this.changeState('RUN');
  }

  /**
   * 공격 입력을 처리합니다.
   * @param slotIndex - 사용할 무공 슬롯 (0, 1, 2)
   * @returns 공격 성공 여부
   */
  handleAttack(slotIndex: number): boolean {
    if (this.currentState === 'ATTACK' || this.currentState === 'DASH' ||
        this.currentState === 'HIT' || this.currentState === 'DEAD') {
      return false;
    }

    const skill = this.equippedSkills[slotIndex];
    if (!skill) return false;

    // 쿨타임 체크
    const lastUsed = this.skillCooldowns.get(skill.id) ?? 0;
    const now = this.scene.time.now;
    if (now - lastUsed < skill.cooldown) return false;

    // 기력 체크
    if (this._stamina < skill.staminaCost) return false;

    // 공격 실행
    this._stamina -= skill.staminaCost;
    this.skillCooldowns.set(skill.id, now);
    this.currentSkill = skill;
    this.currentFrame = 0;
    this.hitFrameIndex = 0;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    this.changeState('ATTACK');
    this.setTexture(skill.animKey, 0);

    return true;
  }

  /**
   * 대시(회피) 입력을 처리합니다.
   */
  handleDash(): boolean {
    if (this.currentState === 'ATTACK' || this.currentState === 'DASH' ||
        this.currentState === 'HIT' || this.currentState === 'DEAD') {
      return false;
    }
    if (!this.equippedDash) return false;

    const dash = this.equippedDash;
    const lastUsed = this.skillCooldowns.get(dash.id) ?? 0;
    const now = this.scene.time.now;
    if (now - lastUsed < dash.cooldown) return false;
    if (this._stamina < dash.staminaCost) return false;

    this._stamina -= dash.staminaCost;
    this.skillCooldowns.set(dash.id, now);
    this.currentSkill = dash;
    this.currentFrame = 0;

    // 대시 방향으로 이동
    const dir = this.facingRight ? 1 : -1;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(dir * dash.moveOffset.x * 10);

    this.invincible = true;
    this.setAlpha(0.5);
    this.changeState('DASH');

    return true;
  }

  /**
   * 피격 처리
   */
  takeDamage(amount: number): void {
    if (this.invincible || this.currentState === 'DEAD') return;

    this._hp = Math.max(0, this._hp - amount);

    if (this._hp <= 0) {
      this.changeState('DEAD');
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      body.enable = false;
      this.setTint(0x888888);
      return;
    }

    this.changeState('HIT');
    this.stateTimer = 300; // 300ms 경직
    this.setTint(0xff8888);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }

  /**
   * HP/기력 회복 (스테이지 클리어 시 등)
   */
  heal(hpAmount: number, staminaAmount: number): void {
    this._hp = Math.min(this._maxHp, this._hp + hpAmount);
    this._stamina = Math.min(this._maxStamina, this._stamina + staminaAmount);
  }

  /**
   * 스킬 쿨타임 잔여 시간 (ms)
   */
  getSkillCooldownRemaining(skillId: string): number {
    const skill = SKILL_DATABASE.get(skillId);
    if (!skill) return 0;
    const lastUsed = this.skillCooldowns.get(skillId) ?? 0;
    const elapsed = this.scene.time.now - lastUsed;
    return Math.max(0, skill.cooldown - elapsed);
  }

  // ─── 프레임 업데이트 ───

  update(_time: number, delta: number): void {
    if (this.currentState === 'DEAD') return;

    // 기력 자연 회복 (초당 3)
    this._stamina = Math.min(this._maxStamina, this._stamina + 3 * (delta / 1000));

    switch (this.currentState) {
      case 'ATTACK':
        this.updateAttack(delta);
        break;
      case 'DASH':
        this.updateDash(delta);
        break;
      case 'HIT':
        this.updateHit(delta);
        break;
      default:
        break;
    }
  }

  // ─── Private 상태 업데이트 ───

  private updateAttack(delta: number): void {
    if (!this.currentSkill) {
      this.setState('IDLE');
      return;
    }

    const skill = this.currentSkill;
    const frameDuration = 1000 / skill.frameRate;
    this.stateTimer += delta;

    const newFrame = Math.floor(this.stateTimer / frameDuration);

    if (newFrame !== this.currentFrame && newFrame < skill.totalFrames) {
      this.currentFrame = newFrame;
      this.setFrame(this.currentFrame);

      // 이동 오프셋 적용 (돌진기)
      if (skill.moveOffset.x !== 0) {
        const dir = this.facingRight ? 1 : -1;
        this.x += dir * (skill.moveOffset.x / skill.totalFrames);
      }

      // 히트 프레임 체크
      if (this.hitFrameIndex < skill.hitFrames.length &&
          this.currentFrame >= skill.hitFrames[this.hitFrameIndex]) {
        this.emitHit(skill);
        this.hitFrameIndex++;
      }
    }

    // 애니메이션 완료
    if (newFrame >= skill.totalFrames) {
      this.currentSkill = null;
      this.stateTimer = 0;
      this.currentFrame = 0;
      this.hitFrameIndex = 0;
      this.setTexture('player_idle');
      this.changeState('IDLE');
    }
  }

  private updateDash(delta: number): void {
    if (!this.currentSkill) {
      this.finishDash();
      return;
    }

    const skill = this.currentSkill;
    const totalDuration = (skill.totalFrames / skill.frameRate) * 1000;
    this.stateTimer += delta;

    if (this.stateTimer >= totalDuration) {
      this.finishDash();
    }
  }

  private finishDash(): void {
    this.invincible = false;
    this.setAlpha(1);
    this.currentSkill = null;
    this.stateTimer = 0;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    this.setTexture('player_idle');
    this.changeState('IDLE');
  }

  private updateHit(delta: number): void {
    this.stateTimer -= delta;
    if (this.stateTimer <= 0) {
      this.clearTint();
      this.setTexture('player_idle');
      this.changeState('IDLE');
    }
  }

  /**
   * 히트 판정 이벤트를 발생시킵니다.
   * BattleScene에서 등록한 콜백을 통해 적과의 충돌을 검사합니다.
   */
  private emitHit(skill: SkillData): void {
    if (!this.onHitCallback) return;

    const dir = this.facingRight ? 1 : -1;
    const hitX = this.x + dir * (skill.range / 2 + 8);
    const hitY = this.y;

    this.onHitCallback(hitX, hitY, skill);
  }

  /**
   * 상태 전이 (내부용)
   */
  private changeState(newState: CharacterState): void {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.stateTimer = 0;
  }
}
