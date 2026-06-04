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
 * 보스 등급 - 혈교(血敎) 위계 구조 기반
 *
 * 천마신교/혈교의 수직적 조직 체계를 게임 보스 등급에 매핑합니다.
 * 하위 → 상위 순서:
 *   대주(隊主) → 단주(團主) → 각주(閣主) → 마군(魔君) →
 *   호법(護法) → 사자(使者) → 부교주(副敎主) → 혈마(血魔)
 */
export type BossRank =
  | 'DAEJU'      // 대주 - 10인 부대장, 하위 보스
  | 'DANJU'      // 단주 - 100인 부대장, 중하위 보스
  | 'GAKJU'      // 각주 - 특수 조직 수장, 중위 보스
  | 'MAGUN'      // 마군 - 야전 사령관, 고위 보스
  | 'HOBUP'      // 호법 - 교단 근위대, 최고위 보스
  | 'SAJA'       // 사자 - 교주 직속 심복, 준최종 보스
  | 'BUGYOJU'    // 부교주 - 교단 2인자, 최종 직전 보스
  | 'HYEOLMA';   // 혈마 - 교단 절대자, 최종 보스

/**
 * 적 등급 - 일반 적의 계급
 */
export type EnemyRank = 'MINION' | 'ELITE' | 'BOSS';

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
  /** 스킬 설명 (도감 표시용) */
  readonly description?: string;
  /**
   * 공격 모션 종류. undefined 이면 'standard' (기존 attack 애님).
   *   heavy  - 묵직한 강타 (느린 예비동작 → 임팩트)
   *   quick  - 빠른 2연타
   *   thrust - 찌르기 (창/도 계열)
   */
  readonly attackMotion?: 'standard' | 'heavy' | 'quick' | 'thrust';
  /**
   * 이펙트 종류. undefined 이면 'slash' (기존 단일 슬래시).
   *   slash  - 단일 슬래시 (기존)
   *   multi  - 연속 슬래시 2~3개
   *   wave   - 넓게 퍼지는 파동형 슬래시
   *   burst  - 슬래시 + 원형 폭발 파티클
   */
  readonly effectType?: 'slash' | 'multi' | 'wave' | 'burst';
  /** 이펙트 색상 오버라이드 (0xRRGGBB). undefined 면 캐릭터 기본 색 사용 */
  readonly effectColor?: number;
  /** 강화 1회 기준 골드 비용 */
  readonly upgradeGoldBase?: number;
  /** 강화 1회 기준 중복 무공 소모량 */
  readonly upgradeShardBase?: number;
  /** 최대 강화 레벨 */
  readonly maxLevel?: number;
  readonly cardArtKey?: string;
  readonly iconKey?: string;
  readonly vfxKey?: string;
  readonly motionKey?: string;
}

export type EquipmentSlot = 'WEAPON' | 'ARMOR' | 'HELM' | 'BOOTS' | 'ACCESSORY' | 'RELIC';
export type EquipmentGrade = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  grade: EquipmentGrade;
  setId?: string;
  attack: number;
  hp: number;
  bonus: number;
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
  /** 합성에 필요한 골드 */
  readonly goldCost: number;
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
  /** 다음 레벨까지 필요한 경험치 */
  expToNext: number;
  /** 보유 골드 */
  gold: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  equippedSkills: string[];
  equippedDash: string;
  inventory: Record<string, number>;  // skillId → 보유 수량
  unlockedSkills: string[];
  skillLevels?: Record<string, number>;
  stageCleared: number;
  totalPlayTime: number;
  lastSavedAt?: number;
  lastOfflineRewardAt?: number;
  /** 선택한 캐릭터 ID (characters.ts의 CharacterDef.id) */
  selectedCharacter?: string;
  /** 누적 사망 횟수 (부활 비용 계산용) */
  deathCount?: number;
  /** 처치한 보스 목록 (보스 ID 배열) */
  defeatedBosses?: string[];
  /** 총 처치 수 */
  totalKills?: number;
  equipmentInventory?: EquipmentItem[];
  equippedItems?: Partial<Record<EquipmentSlot, string>>;
  trainingLevels?: Record<string, number>;
  sectFacilities?: Record<string, number>;
  sectResearch?: Record<string, number>;
  disciples?: string[];
  codexUnlocked?: string[];
  missionProgress?: Record<string, number>;
  missionClaims?: string[];
  dailyMissionDate?: string;
  storyRegion?: number;
  tutorialCompleted?: boolean;
  shopLastReset?: string;
  shopDailyPurchased?: string[];
  gems?: number;
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
  /** 색조 변형 (0xRRGGBB). undefined면 원본 색상 유지 */
  readonly tint?: number;
  readonly dropTable: readonly DropEntry[];
  /** 적 등급 */
  readonly rank: EnemyRank;
  /** 보스 등급 (rank가 BOSS일 때만 유효) */
  readonly bossRank?: BossRank;
  /** 보스 별호 (예: '냉혈단주', '빙룡마군') */
  readonly title?: string;
  /** 처치 시 획득 골드 */
  readonly goldReward: number;
  /** 처치 시 획득 경험치 */
  readonly expReward: number;
  readonly region?: number;
  readonly setId?: string;
}

/**
 * 드랍 테이블 항목
 */
export interface DropEntry {
  readonly skillId: string;
  readonly chance: number;  // 0.0 ~ 1.0
}
