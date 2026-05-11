/**
 * 무공키우기 - 핵심 타입 정의
 *
 * Any 타입을 사용하지 않고 종단간 타입 안전성을 확보합니다.
 * 모든 데이터 구조는 readonly 속성으로 불변성을 보장합니다.
 */

/** 무공 등급 */
export type SkillGrade = 'LOW' | 'MID' | 'HIGH' | 'ULTIMATE';

/** 무공 유형 */
export type SkillType = 'ACTIVE' | 'PASSIVE' | 'DASH';

/** 무공 계열 */
export type SkillCategory = 'SWORD' | 'BLADE' | 'FIST' | 'SPEAR' | 'MOVEMENT';

/** 상태 이상 효과 */
export type StatusEffect = 'STUN' | 'BLEED' | 'KNOCKBACK' | 'SLOW' | 'SILENCE';

/** 캐릭터 상태머신 상태 */
export type CharacterState = 'IDLE' | 'RUN' | 'ATTACK' | 'DASH' | 'HIT' | 'DEAD';

/** 전투 모드 */
export type BattleMode = 'AUTO' | 'MANUAL';

/**
 * 무공(스킬) 데이터 구조
 *
 * 각 필드의 역할:
 * - id: 고유 식별자 (합성 레시피에서 참조)
 * - hitFrames: 타격 판정이 발생하는 프레임 인덱스 배열
 *   예) [5] → 5번째 프레임에서 1회 판정
 *   예) [3, 6, 9] → 3회 다단 히트
 * - hitboxSize: 타격 판정 영역의 가로/세로 크기 (픽셀)
 * - moveOffset: 시전 중 캐릭터 이동량 (돌진기에서 사용)
 */
export interface SkillData {
  readonly id: string;
  readonly name: string;
  readonly nameKo: string;
  readonly grade: SkillGrade;
  readonly type: SkillType;
  readonly category: SkillCategory;
  readonly range: number;
  readonly cooldown: number;
  readonly damageMultiplier: number;
  readonly staminaCost: number;
  // 애니메이션 & 판정
  readonly animKey: string;
  readonly totalFrames: number;
  readonly frameRate: number;
  readonly hitFrames: readonly number[];
  readonly hitboxSize: { readonly w: number; readonly h: number };
  readonly moveOffset: { readonly x: number; readonly y: number };
  // 부가 효과 (선택)
  readonly effect?: StatusEffect;
  readonly effectDuration?: number;
  readonly effectChance?: number;
}

/**
 * 비급 합성 레시피
 *
 * material1 + material2 → result
 * 동일한 비급 2개를 합성하여 상위 비급을 획득합니다.
 */
export interface SynthesisRecipe {
  readonly material1: string;
  readonly material2: string;
  readonly result: string;
}

/**
 * 플레이어 세이브 데이터
 *
 * localStorage에 JSON으로 직렬화하여 저장합니다.
 * 민감한 정보는 포함하지 않습니다 (오프라인 전용).
 */
export interface SaveData {
  version: number;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  equippedSkills: string[];
  equippedDash: string;
  inventory: Record<string, number>;  // skillId → 보유 수량
  unlockedSkills: string[];
  stageCleared: number;
  totalPlayTime: number;
  /** 선택한 캐릭터 ID (characters.ts의 CharacterDef.id) */
  selectedCharacter?: string;
}

/**
 * 적 데이터 구조
 */
export interface EnemyData {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly damage: number;
  readonly speed: number;
  readonly attackRange: number;
  readonly attackCooldown: number;
  readonly spriteKey: string;
  readonly dropTable: readonly DropEntry[];
}

/**
 * 드랍 테이블 항목
 */
export interface DropEntry {
  readonly skillId: string;
  readonly chance: number;  // 0.0 ~ 1.0
}
