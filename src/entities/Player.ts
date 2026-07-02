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
  private readonly charClass: CharacterClass;
  private readonly characterId: string;
  private readonly baseTextureKey: string;
  private readonly baseScaleX: number;
  private readonly baseScaleY: number;

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
  private invincible = false;
  // 회피 시작 위치 — 회피 완료 시 정확히 이 좌표로 복귀
  private dashOriginX = 0;
  // 자동(확률) 회피 연출 중복 방지
  private autoEvading = false;

  // ─── 시각 / 애니메이션 보조 (메모리 안전 + 살아있는 idle) ───
  private animTime = 0;
  private baseGroundY = 0;   // IDLE 시 기준 Y (미세 모션용)
  private visualBaseScaleX = 1;
  private visualBaseScaleY = 1;

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
    const charDef = characterId ? CHARACTER_MAP.get(characterId) ?? null : null;
    const idleTexture = charDef ? `hero_${charDef.id}` : 'hero_sword_male';

    super(scene, x, y, idleTexture);

    this.charClass = charDef?.charClass ?? 'SWORD';
    this.characterId = charDef?.id ?? 'sword_male';
    this.baseTextureKey = idleTexture;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // 128x128 스프라이트를 0.8배로 표시 (화면에서 ~102x102 크기)
    this.setDisplaySize(210, 210);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.visualBaseScaleX = this.baseScaleX;
    this.visualBaseScaleY = this.baseScaleY;
    this.baseGroundY = y;
    this.setFlipX(true); // 아트가 왼쪽을 향하므로 항상 flip → 오른쪽(적 방향)을 바라봄

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
      this.setAngle(0);
      this.setScale(this.visualBaseScaleX, this.visualBaseScaleY);
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
      this.setAngle(0);
      this.setScale(this.visualBaseScaleX, this.visualBaseScaleY);
      this.baseGroundY = this.y;
      this.playAnim('idle', true);
      this.changeState('IDLE');
    }
  }
  private playAnim(action: 'idle' | 'run' | 'attack', _ignoreIfPlaying = false): void {
    // 고품질 일러스트 + 절차적(수학/트윈) 모션이 기본 연출이다.
    // 128px 플레이스홀더 스프라이트시트는 프리미엄 룩을 해치므로 사용하지 않는다.
    // - idle/run: updateVisuals 의 상태별 절차적 모션이 매 프레임 담당
    // - attack:   startAttackSequence 의 트윈 체인 + heroic 풀모션(BattleScene)이 담당
    if (action !== 'attack') {
      this.scene.tweens.killTweensOf(this);
    }
    if (action === 'idle') {
      this.clearTint();
      this.setAngle(0);
      this.setScale(this.visualBaseScaleX, this.visualBaseScaleY);
    }
  }

  private startAttackSequence(skill: SkillData): void {
    const dir = this.facingRight ? 1 : -1;
    const startX = this.x;
    const startY = this.y;
    const motion = skill.attackMotion ?? 'standard';

    this.scene.tweens.killTweensOf(this);
    this.setTint(0xffffff);

    // === Hollow Knight 스타일: 강한 anticipation + commitment + recovery ===
    let windupDur = 105;
    let pullBack = 18;
    let tilt = -8;
    let hopY = 0;

    if (motion === 'heavy') {
      windupDur = 185;
      pullBack = 28;
      tilt = -14;
      hopY = -6; // 무거운 공격은 살짝 뜨는 느낌
    } else if (motion === 'quick') {
      windupDur = 65;
      pullBack = 10;
      tilt = -5;
    } else if (motion === 'thrust') {
      windupDur = 115;
      pullBack = 22;
      tilt = -4;
      hopY = -3;
    }

    // Windup (예비 동작)
    this.scene.tweens.add({
      targets: this,
      x: startX - dir * pullBack,
      y: startY + hopY,
      angle: tilt,
      duration: windupDur,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.playAnim('attack');

        // Strike: 실제로 전진하는 강한 root motion (프레임 + 이동 결합)
        let strikeDist = skill.range * 0.38;
        if (motion === 'thrust') strikeDist = skill.range * 0.55;
        if (motion === 'heavy') strikeDist = skill.range * 0.32;

        const strikeDur = motion === 'heavy' ? 235 : motion === 'quick' ? 105 : motion === 'thrust' ? 155 : 165;
        const targetX = startX + dir * strikeDist;
        const targetY = startY - hopY * 0.6;

        // 프레임 기반 히트
        const totalHits = Math.max(1, skill.hitFrames?.length ?? 1);
        for (let i = 0; i < totalHits; i++) {
          const frameIdx = skill.hitFrames?.[i] ?? (2 + i);
          const progress = Math.min(0.92, (frameIdx + 1) / 12);
          const hitDelay = strikeDur * (0.38 + progress * 0.48);

          this.scene.time.delayedCall(hitDelay, () => {
            if (this.currentState === 'ATTACK' && this.hp > 0 && this.currentSkill === skill) {
              this.emitHit(skill);
              this.scene.events.emit('player-slash-fx', this.x + dir * 32, this.y - 6, skill);
            }
          });
        }

        // 메인 돌진 (무게감 있게)
        this.scene.tweens.add({
          targets: this,
          x: targetX,
          y: targetY,
          angle: tilt * -0.7,
          duration: strikeDur,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            this.emitHit(skill);

            const impactDur = motion === 'heavy' ? 195 : motion === 'thrust' ? 105 : 95;
            const impactShake = motion === 'heavy' ? 0.0085 : 0.0045;

            this.scene.cameras.main.shake(impactDur * 0.7, impactShake);

            // 강한 impact + 느린 recovery (Hollow Knight의 느낌)
            this.scene.tweens.add({
              targets: this,
              angle: dir * (motion === 'heavy' ? 11 : 5),
              scaleX: this.visualBaseScaleX * (motion === 'heavy' ? 1.06 : 1.02),
              scaleY: this.visualBaseScaleY * 0.93,
              duration: impactDur * 0.35,
              ease: 'Power2',
              onComplete: () => {
                // Recovery: 천천히 원위치 + idle 복귀 (무거운 동작 후 여운)
                const recoverDur = motion === 'heavy' ? 210 : 155;
                this.scene.tweens.add({
                  targets: this,
                  x: startX,
                  y: startY,
                  angle: 0,
                  scaleX: this.visualBaseScaleX,
                  scaleY: this.visualBaseScaleY,
                  duration: recoverDur,
                  ease: 'Quad.easeInOut',
                  onComplete: () => {
                    this.currentSkill = null;
                    this.playAnim('idle');
                    this.changeState('IDLE');
                  }
                });
              }
            });
          }
        });
      }
    });
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

  /**
   * 장착 무공 전체 재설정 (세이브 로드 시 호출)
   */
  resetEquippedSkills(skillIds: string[]): void {
    this.equippedSkills = [];
    skillIds.forEach((id, idx) => {
      this.equipSkill(id, idx);
    });
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
    this.setFlipX(this.facingRight);
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

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    this.changeState('ATTACK');
    this.startAttackSequence(skill);

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

    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1.0);
    this.setScale(this.visualBaseScaleX, this.visualBaseScaleY);
    this.setAngle(0);
    this.clearTint();

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

    this.animTime += delta;

    // 기력 자연 회복 (초당 3)
    this._stamina = Math.min(this._maxStamina, this._stamina + 3 * (delta / 1000));
    // 체력 소량 패시브 재생 (방치형 생존력) — 초당 maxHp의 0.4%
    this._hp = Math.min(this._maxHp, this._hp + this._maxHp * 0.004 * (delta / 1000));

    this.updateVisuals(delta);

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

  /**
   * 살아있는 캐릭터 느낌을 위한 IDLE 전용 미세 모션.
   * 스프라이트시트 프레임(기본 idle 애니) + 수학 기반 2차 모션.
   * 트윈 남발 대신 delta 기반 sin으로 GC/누수 최소화.
   */
  private updateVisuals(_delta: number): void {
    // RUN 전용: 빠른 스쿼시&스트레치 바운스 + 전방 기울임 (달리는 무게감)
    // y 위치는 물리 이동이 제어하므로 스케일/각도만 사용해 드리프트를 방지한다.
    if (this.currentState === 'RUN') {
      const t = this.animTime * 0.001;
      const bounce = Math.sin(t * 9);
      this.setScale(
        this.visualBaseScaleX * (1 - bounce * 0.015),
        this.visualBaseScaleY * (1 + bounce * 0.03),
      );
      this.setAngle((this.facingRight ? 1 : -1) * (2.2 + bounce * 0.6));
      return;
    }

    if (this.currentState !== 'IDLE') {
      return;
    }

    // Idle 전용: 부드러운 브리딩 + 몸통 미세 흔들림 + 살짝 무게중심 이동
    const t = this.animTime * 0.001; // 초 단위

    // 1. 수직 호흡 bob (느린)
    const bob = Math.sin(t * 1.7) * 1.8;

    // 2. 미세 숨쉬기 scale (가슴/몸 전체)
    const breath = 1 + Math.sin(t * 1.15) * 0.012;

    // 3. 무기/상체 살짝 sway (무게감)
    const sway = Math.sin(t * 1.35 + 1.2) * 1.6;

    // 4. 아주 미세한 좌우 weight shift
    const lean = Math.sin(t * 0.85) * 0.6;

    this.y = this.baseGroundY + bob;
    this.setScale(this.visualBaseScaleX * breath, this.visualBaseScaleY * breath);
    this.setAngle(lean + sway * 0.28);

    // 살짝 틴트로 생기 (매우 약하게, 과하지 않게)
    // 필요 시 생략. 지금은 angle/scale/position으로 충분히 "살아있음"
  }

  // ─── Private 상태 업데이트 ───

  private updateAttack(_delta: number): void {
    // 공격 시퀀스가 트윈에 의해 관리되므로 빈 채로 둡니다.
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
    // 대시 후 위치가 변했을 수 있으니 기준 Y 재설정
    this.baseGroundY = this.y;
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
