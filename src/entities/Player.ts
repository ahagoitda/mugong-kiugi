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
  private currentSetId: string | null = null;
  private readonly baseScaleX: number;
  private readonly baseScaleY: number;

  // ─── 상태 ───
  private currentState: CharacterState = 'IDLE';
  private stateTimer = 0;
  private facingRight = true;
  /**
   * 고정 횡스크롤 기준 X 좌표.
   * 공격 돌진/피격 등으로 트윈이 중간에 끊겨도 항상 이 위치로 복귀한다.
   * (트윈이 killTweensOf 로 취소되면 복귀 트윈도 사라져 캐릭터가
   *  조금씩 오른쪽으로 밀려나던 버그 방지)
   */
  private homeX = 0;

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
    this.homeX = x;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // 128x128 스프라이트를 0.8배로 표시 (화면에서 ~102x102 크기)
    this.setDisplaySize(210, 210);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    // 초기(정적 일러스트) 텍스처는 캐릭터마다 방향이 다르다 —
    // 왼쪽을 보는 아트만 뒤집어 항상 오른쪽(적 방향)을 바라보게 한다.
    // 애니메이션 시트는 전 캐릭터 왼쪽 기준이므로 playAnim 에서 별도 보정.
    this.setFlipX(charDef?.staticFacesLeft ?? true);

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
    this.currentSetId = setId;
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
    let key = `${this.spritePrefix}-${action}`;
    if (this.currentSetId) {
      const skinKey = `${this.spritePrefix}-${action}-${this.currentSetId}`;
      if (this.scene.anims.exists(skinKey)) {
        key = skinKey;
      }
    }

    if (!this.scene.anims.exists(key)) {
      if (action === 'attack') {
        this.playFallbackAttackTween();
      } else if (action === 'idle') {
        // 공격 트윈 도중 상태가 강제 전환된 경우 스케일/각도 초기화
        this.scene.tweens.killTweensOf(this);
        this.clearTint();
        this.setAngle(0);
        this.setScale(this.baseScaleX, this.baseScaleY);
      } else if (action === 'run' && !ignoreIfPlaying) {
        this.scene.tweens.add({ targets: this, y: this.y - 4, duration: 180, yoyo: true });
      }
      return;
    }
    // 공격 모션이면 스킬의 attackMotion 으로 변형 키를 선택
    // (스프라이트시트가 없는 신규 모션은 가장 비슷한 시트로 대체)
    if (action === 'attack' && this.currentSkill?.attackMotion && this.currentSkill.attackMotion !== 'standard') {
      const sheetVariant: Record<string, string> = {
        heavy: 'heavy', quick: 'quick', thrust: 'thrust',
        spin: 'heavy', slam: 'heavy', flurry: 'quick',
      };
      const variant = sheetVariant[this.currentSkill.attackMotion] ?? this.currentSkill.attackMotion;
      const variantKey = `${this.spritePrefix}-attack-${variant}`;
      if (this.anims.exists(variantKey)) key = variantKey;
    }
    if (this.anims.exists(key)) {
      // 애니메이션 시트는 전 캐릭터가 왼쪽을 보고 그려졌으므로
      // 오른쪽을 볼 때 flip (정적 일러스트와 방향 기준이 다름)
      this.setFlipX(this.facingRight);
      this.play(key, ignoreIfPlaying);
    }
  }

  private startAttackSequence(skill: SkillData): void {
    const dir = this.facingRight ? 1 : -1;
    const startX = this.x;
    const startY = this.y;
    const motion = skill.attackMotion ?? 'standard';

    let windupDur = 120;
    let pullBack = 25;
    let tiltAngle = -12;
    let tintColor = 0xffe57f;

    if (motion === 'heavy') {
      windupDur = 220;
      pullBack = 35;
      tiltAngle = -20;
      tintColor = 0xff8a80;
    } else if (motion === 'quick') {
      windupDur = 80;
      pullBack = 15;
      tiltAngle = -8;
      tintColor = 0xb3e5fc;
    } else if (motion === 'thrust') {
      windupDur = 140;
      pullBack = 30;
      tiltAngle = -5;
      tintColor = 0xb2dfdb;
    } else if (motion === 'spin') {
      // 회전 베기: 예비동작 후 한 바퀴 돌며 휩쓸기
      windupDur = 150;
      pullBack = 22;
      tiltAngle = -16;
      tintColor = 0xce93d8;
    } else if (motion === 'slam') {
      // 도약 내려찍기: 웅크렸다 떠올라 내리꽂기
      windupDur = 200;
      pullBack = 20;
      tiltAngle = -22;
      tintColor = 0xffab91;
    } else if (motion === 'flurry') {
      // 연속 타격: 짧은 예비동작 후 잔진동 연타
      windupDur = 70;
      pullBack = 12;
      tiltAngle = -6;
      tintColor = 0xc5e1a5;
    }

    this.scene.tweens.killTweensOf(this);
    this.setTint(tintColor);

    this.scene.tweens.add({
      targets: this,
      x: startX - dir * pullBack,
      // slam 은 윈드업에서 웅크림 (착지 임팩트 대비)
      y: motion === 'slam' ? startY + 8 : startY,
      angle: tiltAngle,
      scaleX: this.baseScaleX * (motion === 'slam' ? 0.85 : 0.9),
      scaleY: this.baseScaleY * (motion === 'slam' ? 1.0 : 1.1),
      duration: windupDur,
      ease: 'Quad.easeOut',
      onComplete: () => {
        let dashDist = skill.range * 0.45;
        if (motion === 'thrust') dashDist = skill.range * 0.6;
        if (motion === 'spin') dashDist = skill.range * 0.5;
        if (motion === 'flurry') dashDist = skill.range * 0.3;

        let strikeDur = 160;
        if (motion === 'heavy') strikeDur = 250;
        if (motion === 'quick') strikeDur = 110;
        if (motion === 'spin') strikeDur = 240;
        if (motion === 'slam') strikeDur = 230;
        if (motion === 'flurry') strikeDur = 100;

        const targetX = startX + dir * dashDist;

        this.playAnim('attack');
        this.clearTint();

        const totalHits = skill.hitFrames.length;
        if (totalHits > 1) {
          for (let i = 0; i < totalHits - 1; i++) {
            const hitDelay = (strikeDur / totalHits) * (i + 1);
            this.scene.time.delayedCall(hitDelay, () => {
              if (this.currentState === 'ATTACK' && this.hp > 0) {
                this.emitHit(skill);
                this.scene.events.emit('player-slash-fx', this.x + dir * 30, this.y, skill);
              }
            });
          }
        }

        this.scene.tweens.add({
          targets: this,
          x: targetX,
          // spin: 한 바퀴 회전 / slam: 도약 후 내리꽂기 / 그 외: 살짝 기울기
          angle: motion === 'spin' ? dir * 360 : -tiltAngle * 0.8,
          y: motion === 'slam' ? startY - 34 : startY,
          scaleX: this.baseScaleX * 1.2,
          scaleY: this.baseScaleY * 0.85,
          duration: strikeDur,
          ease: motion === 'slam' ? 'Quad.easeOut' : 'Cubic.easeOut',
          onComplete: () => {
            this.emitHit(skill);

            let impactDur = 120;
            let shakeForce = 0.003;
            let hitStopMs = 40;

            if (motion === 'heavy') {
              impactDur = 200;
              shakeForce = 0.008;
              hitStopMs = 90;
            } else if (motion === 'thrust') {
              impactDur = 100;
              shakeForce = 0.004;
              hitStopMs = 50;
            } else if (motion === 'quick') {
              impactDur = 80;
              shakeForce = 0.002;
              hitStopMs = 20;
            } else if (motion === 'spin') {
              impactDur = 140;
              shakeForce = 0.006;
              hitStopMs = 60;
            } else if (motion === 'slam') {
              // 착지 임팩트가 핵심 — 가장 강한 흔들림/정지감
              impactDur = 110;
              shakeForce = 0.01;
              hitStopMs = 100;
            } else if (motion === 'flurry') {
              impactDur = 70;
              shakeForce = 0.002;
              hitStopMs = 15;
            }

            if (hitStopMs > 0) {
              const prevScale = this.scene.physics.world.timeScale;
              this.scene.physics.world.timeScale = 2.5;
              this.scene.time.delayedCall(hitStopMs, () => {
                this.scene.physics.world.timeScale = prevScale;
              });
            }

            this.scene.cameras.main.shake(impactDur, shakeForce);

            this.scene.tweens.add({
              targets: this,
              angle: dir * (motion === 'heavy' || motion === 'slam' ? 25 : motion === 'thrust' ? 12 : 15),
              // slam 은 임팩트에서 지면으로 내리꽂힘
              y: startY,
              scaleX: this.baseScaleX * (motion === 'slam' ? 1.32 : 1.25),
              scaleY: this.baseScaleY * (motion === 'slam' ? 0.72 : 0.8),
              duration: impactDur,
              ease: motion === 'slam' ? 'Quad.easeIn' : 'Linear',
              onComplete: () => {
                this.setAlpha(0.65);
                this.scene.tweens.add({
                  targets: this,
                  x: this.homeX,
                  y: startY,
                  angle: 0,
                  scaleX: this.baseScaleX,
                  scaleY: this.baseScaleY,
                  duration: 180,
                  ease: 'Quad.easeInOut',
                  onComplete: () => {
                    this.setAlpha(1.0);
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

  private playFallbackAttackTween(): void {
    this.scene.tweens.add({
      targets: this,
      angle: 15,
      scaleX: 1.1,
      duration: 150,
      yoyo: true,
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
    this.setScale(this.baseScaleX, this.baseScaleY);
    this.setAngle(0);
    this.clearTint();

    this._hp = Math.max(0, this._hp - amount);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    if (this._hp <= 0) {
      this.changeState('DEAD');
      // 사망 연출: 캐릭터가 쓰러지는 모션 (각도 트위닝)
      this.setTint(0xff5555);
      this.scene.tweens.add({
        targets: this,
        angle: this.facingRight ? -90 : 90,
        alpha: 0.6,
        y: this.y + 15,
        duration: 600,
        ease: 'Cubic.easeOut',
      });
      return;
    }

    this.changeState('HIT');
    this.stateTimer = 300; // 300ms 경직
    this.setTint(0xff8888);

    // 공격 돌진 도중 피격되면 복귀 트윈이 취소되므로 기준 위치로 되돌린다
    if (Math.abs(this.x - this.homeX) > 1) {
      this.scene.tweens.add({
        targets: this,
        x: this.homeX,
        duration: 160,
        ease: 'Quad.easeOut',
      });
    }
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

    // 고정 횡스크롤 기준 위치 유지: 트윈 취소 등으로 어긋난 X를 부드럽게 복귀
    if ((this.currentState === 'IDLE' || this.currentState === 'RUN') &&
        Math.abs(this.x - this.homeX) > 0.5) {
      this.x += (this.homeX - this.x) * Math.min(1, delta / 130);
    }

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
