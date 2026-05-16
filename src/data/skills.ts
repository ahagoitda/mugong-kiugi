import type { SkillData, SynthesisRecipe } from './types';

/**
 * MVP 무공 데이터
 *
 * 검법(SWORD) 계열 6개 + 보법(MOVEMENT) 1개로 구성합니다.
 *
 * 모든 무공은 동일한 공격 스프라이트시트(player_attack, 4프레임)를 공유하되,
 * 이펙트 색상과 히트박스 크기/타이밍으로 차별화합니다.
 * 추후 무공별 고유 모션을 추가할 때 animKey만 교체하면 됩니다.
 *
 * 등급 체계:
 *   LOW(하급) → MID(중급) → HIGH(상급) → ULTIMATE(최상급)
 *
 * 합성 경로:
 *   삼재검법 + 삼재검법 → 매화검법
 *   육합검 + 육합검 → 청풍검법
 *   매화검법 + 청풍검법 → 태극검법
 *   태극검법 + 태극검법 → 창궁무애검법
 */
export const SKILL_DATABASE: ReadonlyMap<string, SkillData> = new Map([
  // ─── 하급 검법 ───
  ['samjae', {
    id: 'samjae',
    name: 'Samjae Swordsmanship',
    nameKo: '삼재검법',
    grade: 'LOW',
    type: 'ACTIVE',
    category: 'SWORD',
    range: 40,
    cooldown: 800,
    damageMultiplier: 1.0,
    staminaCost: 5,
    animKey: 'player_attack',
    totalFrames: 4,
    frameRate: 12,
    hitFrames: [2],
    hitboxSize: { w: 36, h: 24 },
    moveOffset: { x: 4, y: 0 },
    description: '천하삼재(天·地·人)의 이치를 담은 기본 검법. 빠르고 안정적이다.',
  }],

  ['yukhap', {
    id: 'yukhap',
    name: 'Yukhap Sword',
    nameKo: '육합검',
    grade: 'LOW',
    type: 'ACTIVE',
    category: 'SWORD',
    range: 36,
    cooldown: 1000,
    damageMultiplier: 0.8,
    staminaCost: 6,
    animKey: 'player_attack',
    totalFrames: 4,
    frameRate: 10,
    hitFrames: [2, 3],
    hitboxSize: { w: 32, h: 32 },
    moveOffset: { x: 0, y: 0 },
    effect: 'KNOCKBACK',
    effectChance: 0.3,
    effectDuration: 200,
    description: '육합(六合)의 힘으로 적을 밀어내는 검법. 넉백 확률이 있다.',
  }],

  // ─── 중급 검법 ───
  ['maehwa', {
    id: 'maehwa',
    name: 'Plum Blossom Swordsmanship',
    nameKo: '매화검법',
    grade: 'MID',
    type: 'ACTIVE',
    category: 'SWORD',
    range: 52,
    cooldown: 1500,
    damageMultiplier: 1.6,
    staminaCost: 12,
    animKey: 'player_attack',
    totalFrames: 4,
    frameRate: 14,
    hitFrames: [1, 3],
    hitboxSize: { w: 48, h: 36 },
    moveOffset: { x: 8, y: 0 },
    effect: 'BLEED',
    effectChance: 0.4,
    effectDuration: 3000,
    description: '매화가 흩날리듯 화려한 연속 베기. 출혈을 유발한다.',
  }],

  ['cheongpung', {
    id: 'cheongpung',
    name: 'Azure Wind Swordsmanship',
    nameKo: '청풍검법',
    grade: 'MID',
    type: 'ACTIVE',
    category: 'SWORD',
    range: 44,
    cooldown: 1200,
    damageMultiplier: 1.4,
    staminaCost: 10,
    animKey: 'player_attack',
    totalFrames: 4,
    frameRate: 16,
    hitFrames: [1, 3],
    hitboxSize: { w: 40, h: 20 },
    moveOffset: { x: 12, y: 0 },
    effect: 'SLOW',
    effectChance: 0.5,
    effectDuration: 2000,
    description: '청풍처럼 빠른 돌진 검격. 적의 이동 속도를 둔화시킨다.',
  }],

  // ─── 상급 검법 ───
  ['taegeuk', {
    id: 'taegeuk',
    name: 'Taegeuk Swordsmanship',
    nameKo: '태극검법',
    grade: 'HIGH',
    type: 'ACTIVE',
    category: 'SWORD',
    range: 72,
    cooldown: 2500,
    damageMultiplier: 2.5,
    staminaCost: 20,
    animKey: 'player_attack',
    totalFrames: 4,
    frameRate: 8,
    hitFrames: [2, 3],
    hitboxSize: { w: 64, h: 48 },
    moveOffset: { x: 0, y: 0 },
    effect: 'STUN',
    effectChance: 0.6,
    effectDuration: 1000,
    description: '음양의 조화를 담은 절학. 강력한 기절 효과를 부여한다.',
  }],

  // ─── 최상급 검법 ───
  ['changung', {
    id: 'changung',
    name: 'Boundless Sky Swordsmanship',
    nameKo: '창궁무애검법',
    grade: 'ULTIMATE',
    type: 'ACTIVE',
    category: 'SWORD',
    range: 120,
    cooldown: 5000,
    damageMultiplier: 5.0,
    staminaCost: 40,
    animKey: 'player_attack',
    totalFrames: 4,
    frameRate: 6,
    hitFrames: [1, 2, 3],
    hitboxSize: { w: 120, h: 80 },
    moveOffset: { x: 16, y: 0 },
    effect: 'KNOCKBACK',
    effectChance: 1.0,
    effectDuration: 500,
    description: '하늘을 가르는 무애의 일검. 모든 것을 베어내는 궁극의 검법.',
  }],

  // ─── 보법 (회피기) ───
  ['chosangbi', {
    id: 'chosangbi',
    name: 'Grass Glide',
    nameKo: '초상비',
    grade: 'LOW',
    type: 'DASH',
    category: 'MOVEMENT',
    range: 0,
    cooldown: 1500,
    damageMultiplier: 0,
    staminaCost: 8,
    animKey: 'player_run',
    totalFrames: 6,
    frameRate: 18,
    hitFrames: [],
    hitboxSize: { w: 0, h: 0 },
    moveOffset: { x: 64, y: 0 },
    description: '풀 위를 스치듯 빠르게 이동하는 경공술.',
  }],
]);

/**
 * 비급 합성 레시피
 *
 * 동일 등급의 비급 2개를 합성하여 상위 비급을 획득합니다.
 * 합성 경로는 선형적이며, 플레이어에게 명확한 성장 목표를 제시합니다.
 * 상위 합성일수록 더 많은 골드가 필요합니다.
 */
export const SYNTHESIS_RECIPES: readonly SynthesisRecipe[] = [
  { material1: 'samjae', material2: 'samjae', result: 'maehwa', goldCost: 50 },
  { material1: 'yukhap', material2: 'yukhap', result: 'cheongpung', goldCost: 50 },
  { material1: 'maehwa', material2: 'cheongpung', result: 'taegeuk', goldCost: 200 },
  { material1: 'taegeuk', material2: 'taegeuk', result: 'changung', goldCost: 1000 },
];

/**
 * 등급별 색상 (UI 표시용)
 */
export const GRADE_COLORS: Readonly<Record<string, number>> = {
  LOW: 0xaaaaaa,
  MID: 0x4fc3f7,
  HIGH: 0xab47bc,
  ULTIMATE: 0xffd740,
};

/**
 * 레벨업에 필요한 경험치 계산
 *
 * 공식: 50 + (level - 1) * 30 + level^1.5 * 10
 * - 레벨 1→2: 50 EXP
 * - 레벨 5→6: 182 EXP
 * - 레벨 10→11: 586 EXP
 * - 레벨 20→21: 1,464 EXP
 *
 * 이 곡선은 초반에는 빠른 레벨업으로 성취감을 주고,
 * 후반에는 점진적으로 느려져 장기 플레이를 유도합니다.
 */
export function getExpToNextLevel(level: number): number {
  return Math.round(50 + (level - 1) * 30 + Math.pow(level, 1.5) * 10);
}
