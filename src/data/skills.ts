import type { SkillData, SynthesisRecipe, SkillGrade, SkillCategory, StatusEffect } from './types';
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

const CATEGORY_META: Readonly<Record<CharacterClass, {
  category: Exclude<SkillCategory, 'MOVEMENT'>;
  prefix: string;
  ko: string;
  baseAnim: string;
}>> = {
  SWORD: { category: 'SWORD', prefix: 'sword', ko: '검결', baseAnim: 'player_attack' },
  BLADE: { category: 'BLADE', prefix: 'blade', ko: '도결', baseAnim: 'player_attack' },
  FIST: { category: 'FIST', prefix: 'fist', ko: '권결', baseAnim: 'player_attack' },
  SPEAR: { category: 'SPEAR', prefix: 'spear', ko: '창결', baseAnim: 'player_attack' },
};

const GRADE_CONFIG: Readonly<Record<SkillGrade, {
  count: number;
  range: number;
  cooldown: number;
  damage: number;
  stamina: number;
  color: number;
  gold: number;
  shard: number;
  maxLevel: number;
}>> = {
  LOW: { count: 18, range: 38, cooldown: 850, damage: 0.95, stamina: 5, color: 0xb0b0b0, gold: 25, shard: 1, maxLevel: 20 },
  MID: { count: 16, range: 52, cooldown: 1250, damage: 1.55, stamina: 10, color: 0x4fc3f7, gold: 80, shard: 1, maxLevel: 25 },
  HIGH: { count: 8, range: 72, cooldown: 2200, damage: 2.45, stamina: 18, color: 0xab47bc, gold: 220, shard: 2, maxLevel: 30 },
  ULTIMATE: { count: 2, range: 105, cooldown: 4200, damage: 4.4, stamina: 34, color: 0xffd740, gold: 700, shard: 3, maxLevel: 40 },
};

const MOTIONS = ['standard', 'quick', 'heavy', 'thrust'] as const;
const EFFECT_TYPES = ['slash', 'multi', 'wave', 'burst'] as const;
const STATUS_EFFECTS: readonly StatusEffect[] = ['BLEED', 'STUN', 'KNOCKBACK', 'SLOW'];
const GENERATED_SKILL_IDS: Record<CharacterClass, Record<SkillGrade, string[]>> = {
  SWORD: { LOW: [], MID: [], HIGH: [], ULTIMATE: [] },
  BLADE: { LOW: [], MID: [], HIGH: [], ULTIMATE: [] },
  FIST: { LOW: [], MID: [], HIGH: [], ULTIMATE: [] },
  SPEAR: { LOW: [], MID: [], HIGH: [], ULTIMATE: [] },
};

function createGeneratedSkill(cls: CharacterClass, grade: SkillGrade, index: number): SkillData {
  const meta = CATEGORY_META[cls];
  const cfg = GRADE_CONFIG[grade];
  const id = `${meta.prefix}_${grade.toLowerCase()}_${index.toString().padStart(2, '0')}`;
  const motion = MOTIONS[index % MOTIONS.length];
  const effectType = EFFECT_TYPES[index % EFFECT_TYPES.length];
  const effect = STATUS_EFFECTS[index % STATUS_EFFECTS.length];
  const gradeBonus = grade === 'LOW' ? 0 : grade === 'MID' ? 0.35 : grade === 'HIGH' ? 0.9 : 1.9;
  const spread = 1 + (index % 5) * 0.06;

  const nameKo = SKILL_NAME_MAP[id] ?? `${meta.ko} ${index}`;
  const description = SKILL_DESC_MAP[id] ?? `${meta.ko} 계열 자동 생성 무공. 강화할수록 피해량이 상승한다.`;

  return {
    id,
    name: `${meta.prefix}-${grade.toLowerCase()}-${index}`,
    nameKo,
    grade,
    type: 'ACTIVE',
    category: meta.category,
    range: Math.round(cfg.range + (index % 6) * 3),
    cooldown: Math.max(420, Math.round(cfg.cooldown - (index % 4) * 45)),
    damageMultiplier: Number((cfg.damage * spread + gradeBonus).toFixed(2)),
    staminaCost: Math.round(cfg.stamina + (index % 4) * 2),
    animKey: meta.baseAnim,
    totalFrames: 4,
    frameRate: grade === 'ULTIMATE' ? 7 : grade === 'HIGH' ? 9 : 12 + (index % 4),
    hitFrames: effectType === 'multi' ? [1, 3] : effectType === 'burst' ? [1, 2, 3] : [2],
    hitboxSize: {
      w: Math.round(cfg.range * (effectType === 'burst' ? 1.1 : 0.85)),
      h: Math.round(24 + (index % 5) * 6 + (grade === 'ULTIMATE' ? 36 : grade === 'HIGH' ? 18 : 0)),
    },
    moveOffset: { x: motion === 'thrust' ? 12 : motion === 'quick' ? 7 : 4, y: 0 },
    effect,
    effectChance: Math.min(0.85, 0.18 + (index % 5) * 0.08 + (grade === 'ULTIMATE' ? 0.2 : 0)),
    effectDuration: grade === 'LOW' ? 900 : grade === 'MID' ? 1500 : grade === 'HIGH' ? 2200 : 3200,
    attackMotion: motion,
    effectType,
    effectColor: cfg.color,
    upgradeGoldBase: cfg.gold,
    upgradeShardBase: cfg.shard,
    maxLevel: cfg.maxLevel,
    description,
  };
}

function installGeneratedSkills(): void {
  const db = SKILL_DATABASE as Map<string, SkillData>;
  for (const cls of Object.keys(CATEGORY_META) as CharacterClass[]) {
    for (const grade of Object.keys(GRADE_CONFIG) as SkillGrade[]) {
      for (let i = 1; i <= GRADE_CONFIG[grade].count; i++) {
        const skill = createGeneratedSkill(cls, grade, i);
        if (!db.has(skill.id)) db.set(skill.id, skill);
        GENERATED_SKILL_IDS[cls][grade].push(skill.id);
      }
    }
  }
}

installGeneratedSkills();

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

function installGeneratedRecipes(): void {
  const recipes = SYNTHESIS_RECIPES as SynthesisRecipe[];
  for (const cls of Object.keys(GENERATED_SKILL_IDS) as CharacterClass[]) {
    const grades: SkillGrade[] = ['LOW', 'MID', 'HIGH', 'ULTIMATE'];
    for (const grade of grades) {
      const ids = GENERATED_SKILL_IDS[cls][grade];
      const nextGrade = grade === 'LOW' ? 'MID' : grade === 'MID' ? 'HIGH' : grade === 'HIGH' ? 'ULTIMATE' : null;
      for (let i = 0; i < ids.length - 1; i += 2) {
        const resultPool = nextGrade ? GENERATED_SKILL_IDS[cls][nextGrade] : ids;
        const result = resultPool[Math.floor(i / 2) % resultPool.length];
        recipes.push({
          material1: ids[i],
          material2: ids[i + 1],
          result,
          goldCost: GRADE_CONFIG[grade].gold * 2,
        });
      }
    }
  }
}

installGeneratedRecipes();

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
  const arr = Array.from(SKILL_DATABASE.values())
    .filter(s => s.category === CATEGORY_META[cls]?.category && s.grade === grade)
    .map(s => s.id);
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
  // Fast early (lv1≈30, lv10≈350, lv50≈5k, lv100≈18k, lv500≈350k)
  return Math.round(30 + (level - 1) * 18 + Math.pow(level, 1.65) * 6);
}

export const SKILL_NAME_MAP: Readonly<Record<string, string>> = {
  "sword_low_01": "비연검", "sword_low_02": "낙엽검", "sword_low_03": "풍림검",
  "sword_low_04": "청죽검", "sword_low_05": "명월검", "sword_low_06": "백운검",
  "sword_low_07": "한천검", "sword_low_08": "적령검", "sword_low_09": "은파검",
  "sword_low_10": "모운검", "sword_low_11": "진풍검", "sword_low_12": "석양검",
  "sword_low_13": "비우검", "sword_low_14": "설산검", "sword_low_15": "화령검",
  "sword_low_16": "해랑검", "sword_low_17": "야천검", "sword_low_18": "혼원검",

  "sword_mid_01": "청류검법", "sword_mid_02": "적하검법", "sword_mid_03": "낙진검",
  "sword_mid_04": "풍뢰검법", "sword_mid_05": "빙섬검법", "sword_mid_06": "화염검",
  "sword_mid_07": "운무검법", "sword_mid_08": "만화검법", "sword_mid_09": "소울검",
  "sword_mid_10": "은하검", "sword_mid_11": "현령검법", "sword_mid_12": "용문검",
  "sword_mid_13": "뇌전검", "sword_mid_14": "암야검", "sword_mid_15": "백랑검법",
  "sword_mid_16": "단예검",

  "sword_high_01": "만화검경", "sword_high_02": "무형검결", "sword_high_03": "천상검도",
  "sword_high_04": "귀일검법", "sword_high_05": "빙하검경", "sword_high_06": "화천검결",
  "sword_high_07": "암야검도", "sword_high_08": "용천검법",

  "sword_ultimate_01": "천상비검결", "sword_ultimate_02": "귀일무형검",

  "blade_low_01": "풍래도", "blade_low_02": "열파도", "blade_low_03": "선풍도",
  "blade_low_04": "혈염도", "blade_low_05": "철벽도", "blade_low_06": "암흑도",
  "blade_low_07": "뇌화도", "blade_low_08": "참마도", "blade_low_09": "백호도",
  "blade_low_10": "묵룡도", "blade_low_11": "단암도", "blade_low_12": "사풍도",
  "blade_low_13": "적진도", "blade_low_14": "잔영도", "blade_low_15": "풍압도",
  "blade_low_16": "옥쇄도", "blade_low_17": "마풍도", "blade_low_18": "혈인도",

  "blade_mid_01": "혈란도법", "blade_mid_02": "철벽도법", "blade_mid_03": "풍마도",
  "blade_mid_04": "만파도법", "blade_mid_05": "밀풍도법", "blade_mid_06": "백조도",
  "blade_mid_07": "암살도법", "blade_mid_08": "진압도법", "blade_mid_09": "분열도",
  "blade_mid_10": "혈인도법", "blade_mid_11": "마탄도", "blade_mid_12": "음마도",
  "blade_mid_13": "광란도법", "blade_mid_14": "풍화도", "blade_mid_15": "만력도",
  "blade_mid_16": "은봉도",

  "blade_high_01": "파천도결", "blade_high_02": "멸마도법", "blade_high_03": "암야도경",
  "blade_high_04": "혈천도결", "blade_high_05": "만마도법", "blade_high_06": "천파도경",
  "blade_high_07": "용도도결", "blade_high_08": "진천도법",

  "blade_ultimate_01": "천마멸세도", "blade_ultimate_02": "일도만검파",

  "fist_low_01": "풍뢰권", "fist_low_02": "철산장", "fist_low_03": "백호권",
  "fist_low_04": "운룡퇴", "fist_low_05": "암격장", "fist_low_06": "금강권",
  "fist_low_07": "파옥권", "fist_low_08": "벽류퇴", "fist_low_09": "맹호권",
  "fist_low_10": "비각장", "fist_low_11": "섬광퇴", "fist_low_12": "투운권",
  "fist_low_13": "천둥장", "fist_low_14": "낙성퇴", "fist_low_15": "연화권",
  "fist_low_16": "호풍장", "fist_low_17": "명왕권", "fist_low_18": "적열장",

  "fist_mid_01": "벽력장", "fist_mid_02": "운룡퇴법", "fist_mid_03": "만화장",
  "fist_mid_04": "소산권", "fist_mid_05": "천둥장법", "fist_mid_06": "혈인장",
  "fist_mid_07": "연환퇴법", "fist_mid_08": "밀풍권법", "fist_mid_09": "암격장법",
  "fist_mid_10": "백랑권", "fist_mid_11": "진산장", "fist_mid_12": "금강권법",
  "fist_mid_13": "풍마퇴", "fist_mid_14": "일격장", "fist_mid_15": "암야권",
  "fist_mid_16": "파옥장법",

  "fist_high_01": "패왕권결", "fist_high_02": "천둥장경", "fist_high_03": "만불장도",
  "fist_high_04": "항룡장도", "fist_high_05": "백보권결", "fist_high_06": "화천장경",
  "fist_high_07": "암야권도", "fist_high_08": "혈천장경",

  "fist_ultimate_01": "만불귀일장", "fist_ultimate_02": "패천무상권",

  "spear_low_01": "풍룡창", "spear_low_02": "파천창", "spear_low_03": "백호창",
  "spear_low_04": "연환창", "spear_low_05": "섬광창", "spear_low_06": "투천창",
  "spear_low_07": "적진창", "spear_low_08": "모운창", "spear_low_09": "철벽창",
  "spear_low_10": "비연창", "spear_low_11": "혈인창", "spear_low_12": "명왕창",
  "spear_low_13": "비각창", "spear_low_14": "파옥창", "spear_low_15": "서광창",
  "spear_low_16": "화령창", "spear_low_17": "천둥창", "spear_low_18": "암격창",

  "spear_mid_01": "풍룡창법", "spear_mid_02": "백호창법", "spear_mid_03": "연환창법",
  "spear_mid_04": "만화창", "spear_mid_05": "소산창법", "spear_mid_06": "천둥창",
  "spear_mid_07": "진산창법", "spear_mid_08": "비천창", "spear_mid_09": "암야창",
  "spear_mid_10": "파옥창법", "spear_mid_11": "화염창", "spear_mid_12": "운무창법",
  "spear_mid_13": "만력창", "spear_mid_14": "은파창", "spear_mid_15": "백랑창법",
  "spear_mid_16": "혈인창법",

  "spear_high_01": "용호창결", "spear_high_02": "파천창경", "spear_high_03": "만화창도",
  "spear_high_04": "천상창법", "spear_high_05": "혈천창결", "spear_high_06": "멸마창경",
  "spear_high_07": "암야창도", "spear_high_08": "진천창법",

  "spear_ultimate_01": "천하무적창법", "spear_ultimate_02": "만용귀일창"
};

export const SKILL_DESC_MAP: Readonly<Record<string, string>> = {
  "sword_low_01": "제비처럼 날아드는 가벼운 검",
  "sword_low_02": "낙엽처럼 흩날리는 검초",
  "sword_low_03": "바람 속 숲처럼 변화무쌍한 검",
  "sword_low_04": "푸른 대나무처럼 탄력 있는 검",
  "sword_low_05": "밝은 달빛 아래 펼치는 검",
  "sword_low_06": "흰 구름처럼 유려한 검",
  "sword_low_07": "차가운 하늘의 서늘한 검",
  "sword_low_08": "붉은 영기로 베어내는 검",
  
  "sword_mid_01": "맑은 물결처럼 흐르는 검법",
  "sword_mid_02": "붉은 비처럼 쏟아지는 검법",
  "sword_mid_03": "낙화진신처럼 떨어지는 검",
  "sword_mid_04": "바람과 번개가 교차하는 검법",
  "sword_mid_05": "빙산처럼 차갑게 베는 검법",
  "sword_mid_06": "화염을 품은 일격 검",
  "sword_mid_07": "운무처럼 아스라한 검법",
  "sword_mid_08": "만개한 꽃처럼 화려한 검법",
  
  "blade_low_01": "바람처럼 몰아치는 기본 도",
  "blade_low_02": "열파를 내려치는 묵직한 도",
  "blade_low_03": "선풍처럼 휘두르는 도",
  "blade_low_04": "혈염을 품은 붉은 도",
  "blade_low_05": "철벽을 쪼개는 도",
  "blade_low_06": "암흑 속에서 번뜩이는 도",
  "blade_low_07": "벼락을 내려치는 도",
  "blade_low_08": "마를 베어내는 도",
  
  "blade_mid_01": "피비린내 나는 혼란의 도법",
  "blade_mid_02": "철벽을 부수는 도법",
  "blade_mid_03": "바람과 마가 얽힌 도",
  "blade_mid_04": "만파를 쓸어버리는 도법",
  "blade_mid_05": "밀풍도법",
  "blade_mid_06": "백조의 깃털처럼 가볍고 날카로운 도",
  "blade_mid_07": "암살에 특화된 은밀한 도법",
  "blade_mid_08": "진압하는 힘의 도법",

  "fist_low_01": "바람과 천둥을 담은 기본 권",
  "fist_low_02": "철산처럼 묵직한 장",
  "fist_low_03": "백호의 기운을 담은 권",
  "fist_low_04": "운룡이 승천하듯 차는 퇴",
  "fist_low_05": "암격으로 찌르는 장",
  "fist_low_06": "금강처럼 단단한 권",
  "fist_low_07": "파옥석처럼 부수는 권",
  "fist_low_08": "벽력처럼 내려찍는 퇴",
  
  "fist_mid_01": "벼락처럼 내려치는 장",
  "fist_mid_02": "운룡이 승천하는 퇴법",
  "fist_mid_03": "만화처럼 화려한 장",
  "fist_mid_04": "소산의 기운을 담은 권",
  "fist_mid_05": "천둥을 내려치는 장법",
  "fist_mid_06": "혈인을 찍는 장",
  "fist_mid_07": "연환으로 차는 퇴법",
  "fist_mid_08": "밀려오는 바람의 권법",

  "spear_low_01": "바람과 용의 기운을 담은 창",
  "spear_low_02": "하늘을 가르는 창",
  "spear_low_03": "백호의 기운을 담은 창",
  "spear_low_04": "연환으로 꿰뚫는 창",
  "spear_low_05": "번개처럼 번뜩이는 창",
  "spear_low_06": "하늘을 뚫는 창",
  "spear_low_07": "적진을 돌파하는 창",
  "spear_low_08": "구름 속에서 찌르는 창",
  
  "spear_mid_01": "바람과 용의 창법",
  "spear_mid_02": "백호의 기운을 담은 창법",
  "spear_mid_03": "연환으로 꿰뚫는 창법",
  "spear_mid_04": "만화처럼 화려한 창",
  "spear_mid_05": "소산의 기운을 담은 창법",
  "spear_mid_06": "천둥을 창에 담아",
  "spear_mid_07": "산을 진압하는 창법",
  "spear_mid_08": "하늘을 나는 창",

  "sword_high_01": "만화무쌍의 검 경지",
  "sword_high_02": "형태 없이 베어내는 검결",
  "sword_high_03": "하늘의 이치를 담은 검도",
  "sword_high_04": "만법이 하나로 귀일하는 검",
  "sword_high_05": "빙하처럼 얼어붙은 검 경지",
  "sword_high_06": "불꽃 하늘을 가르는 검결",
  "sword_high_07": "어둠 속에서 빛나는 검도",
  "sword_high_08": "용이 하늘로 오르는 검법",
  "sword_ultimate_01": "하늘을 비상하는 궁극의 검결",
  "sword_ultimate_02": "만법귀일 무형의 궁극 검",

  "blade_high_01": "하늘을 가르는 도의 결",
  "blade_high_02": "마를 멸하는 도법",
  "blade_high_03": "어둠 속 번뜩이는 도경",
  "blade_high_04": "피 하늘을 베는 도결",
  "blade_high_05": "만 마를 쓸어버리는 도법",
  "blade_high_06": "하늘을 파괴하는 도경",
  "blade_high_07": "용의 도 결",
  "blade_high_08": "하늘을 뒤흔드는 도법",
  "blade_ultimate_01": "천마가 세상을 멸하는 궁극의 도",
  "blade_ultimate_02": "한 도로 만 검을 파하는 궁극의 도",

  "fist_high_01": "패왕의 권 결",
  "fist_high_02": "천둥의 장 경지",
  "fist_high_03": "만 불의 장 도",
  "fist_high_04": "항룡의 장 도",
  "fist_high_05": "백 보 권의 결",
  "fist_high_06": "불꽃 하늘의 장 경지",
  "fist_high_07": "어둠 속 권의 도",
  "fist_high_08": "혈천의 장 경지",
  "fist_ultimate_01": "만 불이 하나로 귀일하는 궁극 장법",
  "fist_ultimate_02": "하늘을 패하는 무상의 궁극 권법",

  "spear_high_01": "용과 호의 창 결",
  "spear_high_02": "하늘을 파천하는 창 경지",
  "spear_high_03": "만화의 창 도",
  "spear_high_04": "하늘의 창법",
  "spear_high_05": "혈천의 창 결",
  "spear_high_06": "마를 멸하는 창 경지",
  "spear_high_07": "어둠 속 창의 도",
  "spear_high_08": "하늘을 뒤흔드는 창법",
  "spear_ultimate_01": "천하에 적이 없는 궁극 창법",
  "spear_ultimate_02": "만 용이 귀일하는 궁극 창"
};
