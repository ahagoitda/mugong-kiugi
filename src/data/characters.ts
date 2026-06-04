export type CharacterClass = 'SWORD' | 'BLADE' | 'FIST' | 'SPEAR';
export type CharacterGender = 'MALE' | 'FEMALE';

export interface CharacterDef {
  readonly id: string;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly charClass: CharacterClass;
  readonly gender: CharacterGender;
  readonly spritePrefix: string;
  readonly description: string;
  readonly stats: {
    readonly hpMul: number;
    readonly staminaMul: number;
    readonly speedMul: number;
    readonly damageMul: number;
  };
}

export const CHARACTER_LIST: readonly CharacterDef[] = [
  {
    id: 'sword_male',
    nameKo: '검객',
    nameEn: 'Swordsman',
    charClass: 'SWORD',
    gender: 'MALE',
    spritePrefix: 'sword_male',
    description: '균형 잡힌 검법으로 강호를 걷는 무인',
    stats: { hpMul: 1.0, staminaMul: 1.0, speedMul: 1.0, damageMul: 1.0 },
  },
  {
    id: 'sword_female',
    nameKo: '여검객',
    nameEn: 'Swordswoman',
    charClass: 'SWORD',
    gender: 'FEMALE',
    spritePrefix: 'sword_female',
    description: '빠른 기세와 안정적인 검초를 다루는 무인',
    stats: { hpMul: 0.9, staminaMul: 1.2, speedMul: 1.1, damageMul: 1.0 },
  },
  {
    id: 'dao_male',
    nameKo: '도객',
    nameEn: 'Blade Master',
    charClass: 'BLADE',
    gender: 'MALE',
    spritePrefix: 'dao_male',
    description: '묵직한 도법으로 적을 베어내는 무인',
    stats: { hpMul: 1.2, staminaMul: 0.9, speedMul: 0.85, damageMul: 1.3 },
  },
  {
    id: 'dao_female',
    nameKo: '여도객',
    nameEn: 'Blade Mistress',
    charClass: 'BLADE',
    gender: 'FEMALE',
    spritePrefix: 'dao_female',
    description: '예리한 도세로 빈틈을 파고드는 무인',
    stats: { hpMul: 1.0, staminaMul: 1.0, speedMul: 0.95, damageMul: 1.2 },
  },
  {
    id: 'fist_male',
    nameKo: '권사',
    nameEn: 'Fist Fighter',
    charClass: 'FIST',
    gender: 'MALE',
    spritePrefix: 'fist_male',
    description: '근접 연타와 빠른 몸놀림에 능한 무인',
    stats: { hpMul: 1.1, staminaMul: 1.1, speedMul: 1.2, damageMul: 0.85 },
  },
  {
    id: 'fist_female',
    nameKo: '여권사',
    nameEn: 'Fist Maiden',
    charClass: 'FIST',
    gender: 'FEMALE',
    spritePrefix: 'fist_female',
    description: '가벼운 보법과 연속 타격에 특화된 무인',
    stats: { hpMul: 0.85, staminaMul: 1.3, speedMul: 1.3, damageMul: 0.8 },
  },
  {
    id: 'spear_male',
    nameKo: '창객',
    nameEn: 'Spearman',
    charClass: 'SPEAR',
    gender: 'MALE',
    spritePrefix: 'spear_male',
    description: '긴 사거리로 전장을 제압하는 무인',
    stats: { hpMul: 1.0, staminaMul: 1.0, speedMul: 0.95, damageMul: 1.1 },
  },
  {
    id: 'spear_female',
    nameKo: '여창객',
    nameEn: 'Spear Maiden',
    charClass: 'SPEAR',
    gender: 'FEMALE',
    spritePrefix: 'spear_female',
    description: '날카로운 창술로 적의 진입을 막는 무인',
    stats: { hpMul: 0.9, staminaMul: 1.1, speedMul: 1.0, damageMul: 1.05 },
  },
] as const;

export const CHARACTER_MAP: ReadonlyMap<string, CharacterDef> = new Map(
  CHARACTER_LIST.map(c => [c.id, c])
);

export interface BackgroundTheme {
  readonly id: string;
  readonly nameKo: string;
  readonly mountainsKey: string;
  readonly groundKey: string;
  readonly unlockWave: number;
}

export const BACKGROUND_THEMES: readonly BackgroundTheme[] = [
  { id: 'forest', nameKo: '녹림', mountainsKey: 'region_01', groundKey: 'region_01', unlockWave: 1 },
  { id: 'bamboo', nameKo: '죽림', mountainsKey: 'region_02', groundKey: 'region_02', unlockWave: 10 },
  { id: 'snow', nameKo: '설산', mountainsKey: 'region_03', groundKey: 'region_03', unlockWave: 20 },
  { id: 'desert', nameKo: '사막', mountainsKey: 'region_04', groundKey: 'region_04', unlockWave: 30 },
  { id: 'volcano', nameKo: '화산', mountainsKey: 'region_05', groundKey: 'region_05', unlockWave: 40 },
  { id: 'coast',        nameKo: '해안',  mountainsKey: 'region_06', groundKey: 'region_06', unlockWave: 50 },
  { id: 'blood_valley', nameKo: '혈곡',  mountainsKey: 'region_07', groundKey: 'region_07', unlockWave: 60 },
  { id: 'demon_palace', nameKo: '마천궁', mountainsKey: 'region_08', groundKey: 'region_08', unlockWave: 70 },
] as const;

export function getBackgroundForWave(wave: number): BackgroundTheme {
  const idx = Math.floor((Math.max(1, wave) - 1) / 10) % BACKGROUND_THEMES.length;
  return BACKGROUND_THEMES[idx];
}
