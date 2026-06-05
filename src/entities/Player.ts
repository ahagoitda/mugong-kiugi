import Phaser from 'phaser';
import type { CharacterState, SkillData } from '../data/types';
import { SKILL_DATABASE, getStarterSkill } from '../data/skills';
import { CHARACTER_MAP, type CharacterClass } from '../data/characters';
import { heroSetSkinKey } from '../data/assets';

/**
 * Player - 플레이어 캐릭터 엔티티
 *
 * 상태머신(State Machine) 패턴으로 캐릭터 행동을 관리합니다.
 *
 * 캐릭터 선택 시스템 연동:
 * - 생성자에서 characterId를 받아 해당 캐릭터의 스프라이트 프리픽스를 사용
 * - 애니메이션 키: '{spritePrefix}-idle', '{spritePrefix}-run', '{spritePrefix}-attack'
 * - 스탯 보정: CharacterDef.stats의 배율을 기본 스탯에 적용
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
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // ─── 캐릭터 설정 ───
  private readonly spritePrefix: string;
  private readonly charClass: CharacterClass;
  private readonly characterId: string;
  private readonly baseTextureKey: string;

  // ─── 상태 ───
  private currentState: CharacterState = 'IDLE';
  private stateTimer = 0;
  private facingRight = true;

  // ─── 스탯 ───
  private _hp: number;
  private _maxHp: number;
  private _stamina: number;
  private _maxStamina: number;
  private moveSpeed: number;
  private baseMoveSpeed = 100;
  private baseMaxStamina = 50;
  private damageMul: number;

  // ─── 무공 장착 ───
  private equippedSkills: SkillData[] = [];
  private equippedDash: SkillData | null = null;
  private skillCooldowns: Map<string, number> = new Map();

  // ─── 전투 ───
  private currentSkill: SkillData | null = null;
  private currentFrame = 0;
  private hitFrameIndex = 0;
  private invincible = false;
  // 회피 시작 위치 — 회피 완료 시 정확히 이 좌표로 복귀
  private dashOriginX = 0;
  // 자동(확률) 회피 연출 중복 방지
  private autoEvading = false;

  // ─── 콜백 ───
  private onHitCallback: ((x: number, y: number, skill: SkillData) => void) | null = null;

  /**
   * @param scene - Phaser Scene
   * @param x - 초기 X 좌표
   * @param y - 초기 Y 좌표
   * @param characterId - 선택한 캐릭터 ID (characters.ts에서 정의)
   *                       미지정 시 기존 player_idle 사용 (하위 호환)
   */
  constructor(scene: Phaser.Scene, x: number, y: number, characterId?: string) {
    // 캐릭터 ID로 스프라이트 프리픽스 결정
    const charDef = characterId ? CHARACTER_MAP.get(characterId) ?? null : null;
    const prefix = charDef ? charDef.spritePrefix : 'player';
    const idleTexture = charDef ? `hero_${charDef.id}` : 'hero_sword_male';

    super(scene, x, y, idleTexture);

    this.spritePrefix = prefix;
    this.charClass = charDef?.charClass ?? 'SWORD';
    this.characterId = charDef?.id ?? 'sword_male';
    this.baseTextureKey = idleTexture;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // 128x128 스프라이트를 0.8배로 표시 (화면에서 ~102x102 크기)
    this.setDisplaySize(210, 210);

    // 물리 바디 설정 (128x128 스프라이트, 0.8배 스케일 기준)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(70, 150);
    body.setOffset(70, 55);

    // 초기 애니메이션 재생
    this.playAnim('idle');

    // 스탯 계산 (캐릭터 보정 적용)
    const stats = charDef?.stats ?? { hpMul: 1, staminaMul: 1, speedMul: 1, damageMul: 1 };
    this._maxHp = Math.round(100 * stats.hpMul);
    this._hp = this._maxHp;
    this._maxStamina = Math.round(50 * stats.staminaMul);
    this._stamina = this._maxStamina;
    this.baseMoveSpeed = Math.round(100 * stats.speedMul);
    this.baseMaxStamina = Math.round(50 * stats.staminaMul);
    this.moveSpeed = this.baseMoveSpeed;
    this.damageMul = stats.damageMul;

    // 기본 무공 장착 (계열 시작 스킬)
    const starter = SKILL_DATABASE.get(getStarterSkill(this.charClass));
    const dash = SKILL_DATABASE.get('chosangbi');
    if (starter) this.equippedSkills.push(starter);
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
  get dashSkill(): SkillData | null { return this.equippedDash; }
  get characterDamageMul(): number { return this.damageMul; }

  applyTrainingBonuses(speedMul: number, stamMul: number): void {
    this.moveSpeed = Math.round(this.baseMoveSpeed * speedMul);
    this._maxStamina = Math.round(this.baseMaxStamina * stamMul);
    this._stamina = Math.min(this._stamina, this._maxStamina);
  }

  setEquipmentSetSkin(setId: string | null): void {
    if (!setId) {
      this.setTexture(this.baseTextureKey);
      return;
    }
    const key = heroSetSkinKey(this.characterId, setId);
    this.setTexture(this.scene.textures.exists(key) ? key : this.baseTextureKey);
  }

  /**
   * 캐릭터 프리픽스 기반 애니메이션 재생 헬퍼
   *
   * 왜 이 방식인가?
   * - 기존 하드코딩된 'player-idle' 대신 '{prefix}-idle' 형태로
   *   캐릭터마다 다른 애니메이션을 재생합니다.
   * - 중앙 집중식으로 관리하여 오타/불일치를 방지합니다.
   */
  /** 플레이어 고정 횡스크롤: 달리기 애니메이션 재생 (BattleScene에서 호출) */
  playRunAnim(): void {
    if (this.currentState === 'ATTACK' || this.currentState === 'DASH' ||
        this.currentState === 'HIT' || this.currentState === 'DEAD') return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    if (this.currentState !== 'RUN') {
      this.playAnim('run', true);
      this.changeState('RUN');
    }
  }
  /** 플레이어 고정 횡스크롤: 대기 애니메이션 재생 (BattleScene에서 호출) */
  playIdleAnim(): void {
    if (this.currentState === 'ATTACK' || this.currentState === 'DASH' ||
        this.currentState === 'HIT' || this.currentState === 'DEAD') return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    if (this.currentState !== 'IDLE') {
      this.playAnim('idle', true);
      this.changeState('IDLE');
    }
  }
  private playAnim(action: 'idle' | 'run' | 'attack', ignoreIfPlaying = false): void {
    if (!this.scene.anims.exists(`${this.spritePrefix}-${action}`)) {
      if (action === 'attack') {
        this.scene.tweens.add({ targets: this, angle: this.facingRight ? 5 : -5, duration: 90, yoyo: true });
      } else if (action === 'run' && !ignoreIfPlaying) {
        this.scene.tweens.add({ targets: this, y: this.y - 4, duration: 180, yoyo: true });
      }
      return;
    }
    let key = `${this.spritePrefix}-${action}`;
    // 공격 모션이면 스킬의 attackMotion 으로 변형 키를 선택
    if (action === 'attack' && this.currentSkill?.attackMotion && this.currentSkill.attackMotion !== 'standard') {
      const variantKey = `${this.spritePrefix}-attack-${this.currentSkill.attackMotion}`;
      if (this.anims.exists(variantKey)) key = variantKey;
    }
    if (this.anims.exists(key)) {
      this.play(key, ignoreIfPlaying);
    }
  }

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

    // 배열 크기 보장 (계열 시작 스킬로 채움)
    while (this.equippedSkills.length <= slotIndex) {
      const defaultSkill = SKILL_DATABASE.get(getStarterSkill(this.charClass));
      if (defaultSkill) this.equippedSkills.push(defaultSkill);
      else break;
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

  handleMove(dx: number, dy: number): void {
    if (this.currentState === 'ATTACK' || this.currentState === 'DASH' ||
        this.currentState === 'HIT' || this.currentState === 'DEAD') {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;

    if (dx === 0 && dy === 0) {
      body.setVelocity(0, 0);
      if (this.currentState !== 'IDLE') {
        this.playAnim('idle', true);
      }
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
    if (this.currentState !== 'RUN') {
      this.playAnim('run', true);
    }
    this.changeState('RUN');
  }

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
    this.playAnim('attack');

    return true;
  }

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
    this.stateTimer = 0;
    this.currentFrame = 0;

    // 회피 = facing 반대 방향으로 옆구르기 + 원위치 복귀
    const dir = this.facingRight ? 1 : -1;
    const dashDistance = Math.abs(dash.moveOffset.x) * 0.5; // 기존 거리의 절반
    this.dashOriginX = this.x;
    const targetX = this.x - dir * dashDistance;

    // velocity 대신 tween 으로 정확히 제어 (yoyo 로 자동 복귀)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    this.invincible = true;
    this.setAlpha(0.5);
    this.changeState('DASH');
    this.playAnim('run', true);

    const halfDur = (dash.totalFrames / dash.frameRate) * 500;
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      duration: halfDur,
      yoyo: true,
      ease: 'Power2',
    });

    return true;
  }

  /**
   * 자동(확률) 회피 시각 연출.
   * 데미지/쿨다운/기력 소모 없이 짧게 옆으로 비키며 반투명 깜빡임만 준다.
   * (실제 무피해 처리는 BattleScene.applyPlayerHit 에서 수행)
   */
  playEvade(): void {
    if (this.currentState === 'DEAD' || this.autoEvading) return;
    this.autoEvading = true;
    const originX = this.x;
    this.setAlpha(0.45);
    this.scene.tweens.add({
      targets: this,
      x: originX - 12,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.x = originX;
        if (this.currentState !== 'DEAD') this.setAlpha(1);
        this.autoEvading = false;
      },
    });
  }

  takeDamage(amount: number): void {
    if (this.invincible || this.currentState === 'DEAD') return;

    this._hp = Math.max(1, this._hp - amount);

    this.changeState('HIT');
    this.stateTimer = 300; // 300ms 경직
    this.setTint(0xff8888);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }

  heal(hpAmount: number, staminaAmount: number): void {
    this._hp = Math.min(this._maxHp, this._hp + hpAmount);
    this._stamina = Math.min(this._maxStamina, this._stamina + staminaAmount);
  }

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
    // 체력 소량 패시브 재생 (방치형 생존력) — 초당 maxHp의 0.4%
    this._hp = Math.min(this._maxHp, this._hp + this._maxHp * 0.004 * (delta / 1000));

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
      this.changeState('IDLE');
      this.playAnim('idle');
      return;
    }

    const skill = this.currentSkill;
    const frameDuration = 1000 / skill.frameRate;
    this.stateTimer += delta;

    const newFrame = Math.floor(this.stateTimer / frameDuration);

    if (newFrame !== this.currentFrame && newFrame < skill.totalFrames) {
      this.currentFrame = newFrame;

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
      this.playAnim('idle');
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
      // tween 의 yoyo 가 이미 원위치로 돌려놓지만, 부동소수점 오차 방지로 강제 보정
      this.x = this.dashOriginX;
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
    this.playAnim('idle');
    this.changeState('IDLE');
  }

  private updateHit(delta: number): void {
    this.stateTimer -= delta;
    if (this.stateTimer <= 0) {
      this.clearTint();
      this.playAnim('idle');
      this.changeState('IDLE');
    }
  }

  private emitHit(skill: SkillData): void {
    if (!this.onHitCallback) return;

    const dir = this.facingRight ? 1 : -1;
    const hitX = this.x + dir * (skill.range / 2 + 8);
    const hitY = this.y;

    this.onHitCallback(hitX, hitY, skill);
  }

  private changeState(newState: CharacterState): void {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.stateTimer = 0;
  }
}
