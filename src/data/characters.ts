/**
 * 캐릭터 데이터 정의
 *
 * 4계열(검법/도법/권법/창법) x 2성별(남/여) = 8 플레이어블 캐릭터
 *
 * 각 캐릭터는 고유한 스프라이트 프리픽스를 가지며,
 * 이를 통해 idle/run/attack 애니메이션 키를 동적으로 생성합니다.
 *
 * 왜 spritePrefix 방식인가?
 * - 하드코딩된 텍스처 키 대신 프리픽스 + 접미사 조합으로
 *   캐릭터 추가 시 코드 수정 없이 데이터만 추가하면 됩니다.
 * - 예: spritePrefix='sword_male' → 'sword_male_idle', 'sword_male_run', 'sword_male_attack'
 */

/** 캐릭터 계열 */
export type CharacterClass = 'SWORD' | 'BLADE' | 'FIST' | 'SPEAR';

/** 캐릭터 성별 */
export type CharacterGender = 'MALE' | 'FEMALE';

/** 캐릭터 정의 */
export interface CharacterDef {
  readonly id: string;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly charClass: CharacterClass;
  readonly gender: CharacterGender;
  /** 스프라이트 파일명 프리픽스 (예: 'sword_male') */
  readonly spritePrefix: string;
  /** 캐릭터 설명 */
  readonly description: string;
  /** 기본 스탯 보정 (1.0 = 기본) */
  readonly stats: {
    readonly hpMul: number;
    readonly staminaMul: number;
    readonly speedMul: number;
    readonly damageMul: number;
  };
}

/**
 * 전체 캐릭터 목록
 *
 * 계열별 특성:
 * - 검법(SWORD): 균형 잡힌 스탯, 중거리 공격
 * - 도법(BLADE): 높은 공격력, 낮은 속도
 * - 권법(FIST): 높은 속도, 근접 공격, 다단 히트
 * - 창법(SPEAR): 긴 사거리, 중간 속도
 */
export const CHARACTER_LIST: readonly CharacterDef[] = [
  // ─── 검법 (SWORD) ───
  {
    id: 'sword_male',
    nameKo: '검객 (남)',
    nameEn: 'Swordsman',
    charClass: 'SWORD',
    gender: 'MALE',
    spritePrefix: 'sword_male',
    description: '정도를 걷는 젊은 검객. 균형 잡힌 능력치로 초보자에게 추천.',
    stats: { hpMul: 1.0, staminaMul: 1.0, speedMul: 1.0, damageMul: 1.0 },
  },
  {
    id: 'sword_female',
    nameKo: '여검객',
    nameEn: 'Swordswoman',
    charClass: 'SWORD',
    gender: 'FEMALE',
    spritePrefix: 'sword_female',
    description: '빠르고 우아한 검술을 구사하는 여협. 기력 회복이 빠르다.',
    stats: { hpMul: 0.9, staminaMul: 1.2, speedMul: 1.1, damageMul: 1.0 },
  },
  // ─── 도법 (BLADE) ───
  {
    id: 'dao_male',
    nameKo: '도객 (남)',
    nameEn: 'Blade Master',
    charClass: 'BLADE',
    gender: 'MALE',
    spritePrefix: 'dao_male',
    description: '묵직한 도를 휘두르는 호방한 사내. 한 방의 위력이 강하다.',
    stats: { hpMul: 1.2, staminaMul: 0.9, speedMul: 0.85, damageMul: 1.3 },
  },
  {
    id: 'dao_female',
    nameKo: '여도객',
    nameEn: 'Blade Mistress',
    charClass: 'BLADE',
    gender: 'FEMALE',
    spritePrefix: 'dao_female',
    description: '날렵한 도술로 적을 베는 여협. 치명타 확률이 높다.',
    stats: { hpMul: 1.0, staminaMul: 1.0, speedMul: 0.95, damageMul: 1.2 },
  },
  // ─── 권법 (FIST) ───
  {
    id: 'fist_male',
    nameKo: '권사 (남)',
    nameEn: 'Fist Fighter',
    charClass: 'FIST',
    gender: 'MALE',
    spritePrefix: 'fist_male',
    description: '맨손으로 싸우는 강인한 권사. 공격 속도가 매우 빠르다.',
    stats: { hpMul: 1.1, staminaMul: 1.1, speedMul: 1.2, damageMul: 0.85 },
  },
  {
    id: 'fist_female',
    nameKo: '여권사',
    nameEn: 'Fist Maiden',
    charClass: 'FIST',
    gender: 'FEMALE',
    spritePrefix: 'fist_female',
    description: '민첩한 몸놀림의 여권사. 회피율이 높고 연타가 강하다.',
    stats: { hpMul: 0.85, staminaMul: 1.3, speedMul: 1.3, damageMul: 0.8 },
  },
  // ─── 창법 (SPEAR) ───
  {
    id: 'spear_male',
    nameKo: '창객 (남)',
    nameEn: 'Spearman',
    charClass: 'SPEAR',
    gender: 'MALE',
    spritePrefix: 'spear_male',
    description: '긴 창으로 적을 찌르는 무인. 사거리가 길어 안전하게 싸운다.',
    stats: { hpMul: 1.0, staminaMul: 1.0, speedMul: 0.95, damageMul: 1.1 },
  },
  {
    id: 'spear_female',
    nameKo: '여창객',
    nameEn: 'Spear Maiden',
    charClass: 'SPEAR',
    gender: 'FEMALE',
    spritePrefix: 'spear_female',
    description: '화려한 창술을 펼치는 여협. 넓은 범위의 공격이 특기.',
    stats: { hpMul: 0.9, staminaMul: 1.1, speedMul: 1.0, damageMul: 1.05 },
  },
] as const;

/** ID로 캐릭터를 빠르게 조회하기 위한 Map */
export const CHARACTER_MAP: ReadonlyMap<string, CharacterDef> = new Map(
  CHARACTER_LIST.map(c => [c.id, c])
);

/** 배경 테마 정의 */
export interface BackgroundTheme {
  readonly id: string;
  readonly nameKo: string;
  readonly mountainsKey: string;
  readonly groundKey: string;
  /** 이 배경이 해금되는 웨이브 */
  readonly unlockWave: number;
}

/**
 * 배경 테마 목록
 *
 * 웨이브 진행에 따라 자동으로 배경이 전환됩니다.
 * 1~9: 산림, 10~19: 대나무숲, 20~29: 설산, 30~39: 사막, 40+: 화산
 */
export const BACKGROUND_THEMES: readonly BackgroundTheme[] = [
  {
    id: 'forest',
    nameKo: '산림',
    mountainsKey: 'bg_mountains',
    groundKey: 'bg_ground',
    unlockWave: 1,
  },
  {
    id: 'bamboo',
    nameKo: '대나무숲',
    mountainsKey: 'bg_bamboo_mountains',
    groundKey: 'bg_bamboo_ground',
    unlockWave: 10,
  },
  {
    id: 'snow',
    nameKo: '설산',
    mountainsKey: 'bg_snow_mountains',
    groundKey: 'bg_snow_ground',
    unlockWave: 20,
  },
  {
    id: 'desert',
    nameKo: '사막',
    mountainsKey: 'bg_desert_mountains',
    groundKey: 'bg_desert_ground',
    unlockWave: 30,
  },
  {
    id: 'volcano',
    nameKo: '화산',
    mountainsKey: 'bg_volcano_mountains',
    groundKey: 'bg_volcano_ground',
    unlockWave: 40,
  },
] as const;

/**
 * 현재 웨이브에 맞는 배경 테마를 반환합니다.
 *
 * 10스테이지마다 테마가 전환되며, 5종 테마를 무한 순환합니다.
 *   1~10: 산림, 11~20: 대나무숲, 21~30: 설산, 31~40: 사막, 41~50: 화산,
 *   51~60: 산림(순환) ...
 */
export function getBackgroundForWave(wave: number): BackgroundTheme {
  const idx = Math.floor((Math.max(1, wave) - 1) / 10) % BACKGROUND_THEMES.length;
  return BACKGROUND_THEMES[idx];
}
