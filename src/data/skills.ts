import type { SkillData, SynthesisRecipe, SkillGrade } from './types';
import type { CharacterClass } from './characters';

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
    attackMotion: 'standard',
    effectType: 'slash',
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
    attackMotion: 'quick',
    effectType: 'multi',
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
    attackMotion: 'quick',
    effectType: 'multi',
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
    attackMotion: 'quick',
    effectType: 'wave',
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
    attackMotion: 'heavy',
    effectType: 'wave',
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
    attackMotion: 'heavy',
    effectType: 'burst',
    description: '하늘을 가르는 무애의 일검. 모든 것을 베어내는 궁극의 검법.',
  }],

  // ═══════════════════════════════════════════════════════
  // 도법 (BLADE) - 묵직한 고위력, 중근거리
  // ═══════════════════════════════════════════════════════
  ['baldo', {
    id: 'baldo', name: 'Iai Draw', nameKo: '발도술', grade: 'LOW', type: 'ACTIVE',
    category: 'BLADE', range: 42, cooldown: 900, damageMultiplier: 1.2, staminaCost: 6,
    animKey: 'player_attack', totalFrames: 4, frameRate: 12, hitFrames: [2],
    hitboxSize: { w: 40, h: 26 }, moveOffset: { x: 6, y: 0 },
    attackMotion: 'thrust', effectType: 'slash',
    description: '단숨에 도를 뽑아 베는 기본 도법. 한 방이 묵직하다.',
  }],
  ['hoengso', {
    id: 'hoengso', name: 'Sky Sweep', nameKo: '횡소천군', grade: 'LOW', type: 'ACTIVE',
    category: 'BLADE', range: 48, cooldown: 1100, damageMultiplier: 1.0, staminaCost: 7,
    animKey: 'player_attack', totalFrames: 4, frameRate: 10, hitFrames: [2, 3],
    hitboxSize: { w: 40, h: 34 }, moveOffset: { x: 0, y: 0 },
    effect: 'KNOCKBACK', effectChance: 0.35, effectDuration: 250,
    attackMotion: 'heavy', effectType: 'wave',
    description: '하늘을 쓸어버리는 횡베기. 적을 밀어낸다.',
  }],
  ['gwangpung', {
    id: 'gwangpung', name: 'Gale Blade', nameKo: '광풍도법', grade: 'MID', type: 'ACTIVE',
    category: 'BLADE', range: 50, cooldown: 1500, damageMultiplier: 2.0, staminaCost: 13,
    animKey: 'player_attack', totalFrames: 4, frameRate: 14, hitFrames: [1, 3],
    hitboxSize: { w: 52, h: 38 }, moveOffset: { x: 8, y: 0 },
    effect: 'BLEED', effectChance: 0.45, effectDuration: 3000,
    attackMotion: 'quick', effectType: 'multi',
    description: '광풍처럼 몰아치는 연속 도격. 출혈을 유발한다.',
  }],
  ['byeokryeokdo', {
    id: 'byeokryeokdo', name: 'Thunder Blade', nameKo: '벽력도', grade: 'MID', type: 'ACTIVE',
    category: 'BLADE', range: 46, cooldown: 1300, damageMultiplier: 1.8, staminaCost: 12,
    animKey: 'player_attack', totalFrames: 4, frameRate: 14, hitFrames: [1, 3],
    hitboxSize: { w: 46, h: 34 }, moveOffset: { x: 6, y: 0 },
    effect: 'STUN', effectChance: 0.3, effectDuration: 700,
    attackMotion: 'heavy', effectType: 'slash',
    description: '벼락처럼 내려치는 일격. 적을 잠시 기절시킨다.',
  }],
  ['paewang', {
    id: 'paewang', name: 'Overlord Blade', nameKo: '패왕도법', grade: 'HIGH', type: 'ACTIVE',
    category: 'BLADE', range: 70, cooldown: 2600, damageMultiplier: 3.0, staminaCost: 22,
    animKey: 'player_attack', totalFrames: 4, frameRate: 8, hitFrames: [2, 3],
    hitboxSize: { w: 66, h: 50 }, moveOffset: { x: 4, y: 0 },
    effect: 'STUN', effectChance: 0.6, effectDuration: 1000,
    attackMotion: 'heavy', effectType: 'burst',
    description: '패왕의 기세로 적을 짓누르는 절학. 강력한 기절.',
  }],
  ['cheonma', {
    id: 'cheonma', name: 'Heaven Demon Blade', nameKo: '천마군림도', grade: 'ULTIMATE', type: 'ACTIVE',
    category: 'BLADE', range: 110, cooldown: 5200, damageMultiplier: 5.6, staminaCost: 42,
    animKey: 'player_attack', totalFrames: 4, frameRate: 6, hitFrames: [1, 2, 3],
    hitboxSize: { w: 120, h: 84 }, moveOffset: { x: 16, y: 0 },
    effect: 'KNOCKBACK', effectChance: 1.0, effectDuration: 500,
    attackMotion: 'heavy', effectType: 'burst',
    description: '천마가 군림하는 도의 극의. 모든 것을 쓸어버린다.',
  }],

  // ═══════════════════════════════════════════════════════
  // 권법 (FIST) - 빠른 연타, 짧은 사거리
  // ═══════════════════════════════════════════════════════
  ['taejo', {
    id: 'taejo', name: 'Founding Palm', nameKo: '태조장권', grade: 'LOW', type: 'ACTIVE',
    category: 'FIST', range: 28, cooldown: 650, damageMultiplier: 0.85, staminaCost: 4,
    animKey: 'player_attack', totalFrames: 4, frameRate: 12, hitFrames: [2],
    hitboxSize: { w: 30, h: 24 }, moveOffset: { x: 6, y: 0 },
    attackMotion: 'quick', effectType: 'slash',
    description: '태조의 기본 권법. 빠르고 가볍게 연타한다.',
  }],
  ['bunggwon', {
    id: 'bunggwon', name: 'Burst Fist', nameKo: '붕권', grade: 'LOW', type: 'ACTIVE',
    category: 'FIST', range: 26, cooldown: 780, damageMultiplier: 0.9, staminaCost: 5,
    animKey: 'player_attack', totalFrames: 4, frameRate: 12, hitFrames: [1, 3],
    hitboxSize: { w: 28, h: 26 }, moveOffset: { x: 4, y: 0 },
    effect: 'KNOCKBACK', effectChance: 0.25, effectDuration: 200,
    attackMotion: 'heavy', effectType: 'slash',
    description: '폭발하듯 내지르는 주먹. 적을 밀어낸다.',
  }],
  ['yeonhwante', {
    id: 'yeonhwante', name: 'Chain Kicks', nameKo: '연환퇴', grade: 'MID', type: 'ACTIVE',
    category: 'FIST', range: 34, cooldown: 1100, damageMultiplier: 1.3, staminaCost: 10,
    animKey: 'player_attack', totalFrames: 4, frameRate: 16, hitFrames: [1, 2, 3],
    hitboxSize: { w: 36, h: 30 }, moveOffset: { x: 6, y: 0 },
    effect: 'SLOW', effectChance: 0.4, effectDuration: 1500,
    attackMotion: 'quick', effectType: 'multi',
    description: '쉴 새 없는 연환 발차기. 다단 히트로 적을 둔화시킨다.',
  }],
  ['baekbo', {
    id: 'baekbo', name: 'Hundred Step Fist', nameKo: '백보신권', grade: 'MID', type: 'ACTIVE',
    category: 'FIST', range: 50, cooldown: 1300, damageMultiplier: 1.5, staminaCost: 11,
    animKey: 'player_attack', totalFrames: 4, frameRate: 14, hitFrames: [1, 3],
    hitboxSize: { w: 44, h: 28 }, moveOffset: { x: 10, y: 0 },
    effect: 'BLEED', effectChance: 0.35, effectDuration: 2500,
    attackMotion: 'thrust', effectType: 'wave',
    description: '백 보 밖의 적도 꿰뚫는 권풍. 출혈을 유발한다.',
  }],
  ['hangryong', {
    id: 'hangryong', name: 'Dragon Subduing Palm', nameKo: '항룡십팔장', grade: 'HIGH', type: 'ACTIVE',
    category: 'FIST', range: 58, cooldown: 2300, damageMultiplier: 2.3, staminaCost: 18,
    animKey: 'player_attack', totalFrames: 4, frameRate: 10, hitFrames: [2, 3],
    hitboxSize: { w: 60, h: 44 }, moveOffset: { x: 8, y: 0 },
    effect: 'STUN', effectChance: 0.6, effectDuration: 1000,
    attackMotion: 'heavy', effectType: 'wave',
    description: '용을 항복시키는 열여덟 장법. 강력한 기절.',
  }],
  ['yeorae', {
    id: 'yeorae', name: 'Tathagata Palm', nameKo: '여래신장', grade: 'ULTIMATE', type: 'ACTIVE',
    category: 'FIST', range: 100, cooldown: 4800, damageMultiplier: 4.6, staminaCost: 38,
    animKey: 'player_attack', totalFrames: 4, frameRate: 8, hitFrames: [1, 2, 3],
    hitboxSize: { w: 104, h: 72 }, moveOffset: { x: 14, y: 0 },
    effect: 'KNOCKBACK', effectChance: 1.0, effectDuration: 500,
    attackMotion: 'heavy', effectType: 'burst',
    description: '여래의 신장. 거대한 장력이 전장을 휩쓴다.',
  }],

  // ═══════════════════════════════════════════════════════
  // 창법 (SPEAR) - 긴 사거리 찌르기
  // ═══════════════════════════════════════════════════════
  ['pyeongsa', {
    id: 'pyeongsa', name: 'Falling Goose', nameKo: '평사낙안', grade: 'LOW', type: 'ACTIVE',
    category: 'SPEAR', range: 56, cooldown: 900, damageMultiplier: 1.0, staminaCost: 6,
    animKey: 'player_attack', totalFrames: 4, frameRate: 12, hitFrames: [2],
    hitboxSize: { w: 48, h: 20 }, moveOffset: { x: 10, y: 0 },
    attackMotion: 'thrust', effectType: 'slash',
    description: '내려앉는 기러기처럼 부드럽게 찌르는 기본 창법.',
  }],
  ['iljeom', {
    id: 'iljeom', name: 'Crimson Point', nameKo: '일점홍', grade: 'LOW', type: 'ACTIVE',
    category: 'SPEAR', range: 60, cooldown: 1000, damageMultiplier: 0.95, staminaCost: 6,
    animKey: 'player_attack', totalFrames: 4, frameRate: 12, hitFrames: [2],
    hitboxSize: { w: 52, h: 18 }, moveOffset: { x: 12, y: 0 },
    effect: 'SLOW', effectChance: 0.3, effectDuration: 1500,
    attackMotion: 'thrust', effectType: 'multi',
    description: '한 점을 꿰뚫는 직선 찌르기. 적을 둔화시킨다.',
  }],
  ['hoeseon', {
    id: 'hoeseon', name: 'Spinning Spear', nameKo: '회선창', grade: 'MID', type: 'ACTIVE',
    category: 'SPEAR', range: 58, cooldown: 1500, damageMultiplier: 1.5, staminaCost: 12,
    animKey: 'player_attack', totalFrames: 4, frameRate: 14, hitFrames: [1, 3],
    hitboxSize: { w: 56, h: 40 }, moveOffset: { x: 6, y: 0 },
    effect: 'KNOCKBACK', effectChance: 0.4, effectDuration: 250,
    attackMotion: 'quick', effectType: 'wave',
    description: '창을 회전시켜 주변을 휩쓰는 광역기. 적을 밀어낸다.',
  }],
  ['gwansan', {
    id: 'gwansan', name: 'Mountain Piercer', nameKo: '관산월', grade: 'MID', type: 'ACTIVE',
    category: 'SPEAR', range: 64, cooldown: 1300, damageMultiplier: 1.6, staminaCost: 11,
    animKey: 'player_attack', totalFrames: 4, frameRate: 14, hitFrames: [1, 3],
    hitboxSize: { w: 60, h: 28 }, moveOffset: { x: 12, y: 0 },
    effect: 'BLEED', effectChance: 0.35, effectDuration: 2500,
    attackMotion: 'thrust', effectType: 'slash',
    description: '산을 꿰뚫는 강맹한 일격. 출혈을 유발한다.',
  }],
  ['yongchang', {
    id: 'yongchang', name: 'Dragon Spear Forms', nameKo: '용창구식', grade: 'HIGH', type: 'ACTIVE',
    category: 'SPEAR', range: 84, cooldown: 2600, damageMultiplier: 2.6, staminaCost: 21,
    animKey: 'player_attack', totalFrames: 4, frameRate: 8, hitFrames: [2, 3],
    hitboxSize: { w: 80, h: 46 }, moveOffset: { x: 10, y: 0 },
    effect: 'STUN', effectChance: 0.55, effectDuration: 1000,
    attackMotion: 'heavy', effectType: 'burst',
    description: '용의 아홉 가지 창식. 긴 사거리에서 적을 제압한다.',
  }],
  ['cheonha', {
    id: 'cheonha', name: 'Peerless Spear', nameKo: '천하무쌍창', grade: 'ULTIMATE', type: 'ACTIVE',
    category: 'SPEAR', range: 130, cooldown: 5200, damageMultiplier: 5.2, staminaCost: 42,
    animKey: 'player_attack', totalFrames: 4, frameRate: 6, hitFrames: [1, 2, 3],
    hitboxSize: { w: 130, h: 80 }, moveOffset: { x: 16, y: 0 },
    effect: 'KNOCKBACK', effectChance: 1.0, effectDuration: 500,
    attackMotion: 'thrust', effectType: 'burst',
    description: '천하에 짝이 없는 창의 극의. 전장을 관통한다.',
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
  // 검법
  { material1: 'samjae', material2: 'samjae', result: 'maehwa', goldCost: 50 },
  { material1: 'yukhap', material2: 'yukhap', result: 'cheongpung', goldCost: 50 },
  { material1: 'maehwa', material2: 'cheongpung', result: 'taegeuk', goldCost: 200 },
  { material1: 'taegeuk', material2: 'taegeuk', result: 'changung', goldCost: 1000 },
  // 도법
  { material1: 'baldo', material2: 'baldo', result: 'gwangpung', goldCost: 50 },
  { material1: 'hoengso', material2: 'hoengso', result: 'byeokryeokdo', goldCost: 50 },
  { material1: 'gwangpung', material2: 'byeokryeokdo', result: 'paewang', goldCost: 200 },
  { material1: 'paewang', material2: 'paewang', result: 'cheonma', goldCost: 1000 },
  // 권법
  { material1: 'taejo', material2: 'taejo', result: 'yeonhwante', goldCost: 50 },
  { material1: 'bunggwon', material2: 'bunggwon', result: 'baekbo', goldCost: 50 },
  { material1: 'yeonhwante', material2: 'baekbo', result: 'hangryong', goldCost: 200 },
  { material1: 'hangryong', material2: 'hangryong', result: 'yeorae', goldCost: 1000 },
  // 창법
  { material1: 'pyeongsa', material2: 'pyeongsa', result: 'hoeseon', goldCost: 50 },
  { material1: 'iljeom', material2: 'iljeom', result: 'gwansan', goldCost: 50 },
  { material1: 'hoeseon', material2: 'gwansan', result: 'yongchang', goldCost: 200 },
  { material1: 'yongchang', material2: 'yongchang', result: 'cheonha', goldCost: 1000 },
];

/**
 * 계열별 스킬 구성.
 * - starter: 캐릭터 선택 시 기본 장착되는 시작 스킬
 * - byGrade: 등급별 스킬 id (드랍을 현재 계열 스킬로 환산할 때 사용)
 */
export const CLASS_SKILLS: Readonly<Record<CharacterClass, {
  starter: string;
  byGrade: Readonly<Record<SkillGrade, readonly string[]>>;
}>> = {
  SWORD: {
    starter: 'samjae',
    byGrade: { LOW: ['samjae', 'yukhap'], MID: ['maehwa', 'cheongpung'], HIGH: ['taegeuk'], ULTIMATE: ['changung'] },
  },
  BLADE: {
    starter: 'baldo',
    byGrade: { LOW: ['baldo', 'hoengso'], MID: ['gwangpung', 'byeokryeokdo'], HIGH: ['paewang'], ULTIMATE: ['cheonma'] },
  },
  FIST: {
    starter: 'taejo',
    byGrade: { LOW: ['taejo', 'bunggwon'], MID: ['yeonhwante', 'baekbo'], HIGH: ['hangryong'], ULTIMATE: ['yeorae'] },
  },
  SPEAR: {
    starter: 'pyeongsa',
    byGrade: { LOW: ['pyeongsa', 'iljeom'], MID: ['hoeseon', 'gwansan'], HIGH: ['yongchang'], ULTIMATE: ['cheonha'] },
  },
};

/** 계열의 시작 스킬 id */
export function getStarterSkill(cls: CharacterClass): string {
  return CLASS_SKILLS[cls]?.starter ?? 'samjae';
}

/** 해당 계열에서 주어진 등급의 스킬 하나(랜덤). 드랍 환산용. */
export function getClassSkillByGrade(cls: CharacterClass, grade: SkillGrade): string {
  const arr = CLASS_SKILLS[cls]?.byGrade[grade];
  if (arr && arr.length > 0) return arr[Math.floor(Math.random() * arr.length)];
  return getStarterSkill(cls);
}

/** 캐릭터 선택 시 적용할 계열 기본 로드아웃 (장착/회피/해금) */
export function defaultLoadoutFor(cls: CharacterClass): {
  equippedSkills: string[];
  equippedDash: string;
  unlocked: string[];
} {
  const starter = getStarterSkill(cls);
  return { equippedSkills: [starter], equippedDash: 'chosangbi', unlocked: [starter, 'chosangbi'] };
}

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
