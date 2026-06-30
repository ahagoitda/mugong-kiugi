import { RUNTIME_ASSET_PATH } from './assets';

/**
 * 고품질 heroic 모션 매니페스트
 *
 * 원본은 assets_src/illustrations/heroic_illustrations/motions/ 의
 * 그린스크린 12프레임 시퀀스와 단일 컷인 일러스트.
 * scripts/build-heroic-motions.mjs 가 키아웃/다운스케일하여
 * runtime 폴더에 게임용 에셋으로 변환한다.
 *
 * - 시퀀스(HEROIC_MOTION_SEQUENCES): 전투 중 해당 무공 시전 시
 *   픽셀 캐릭터 대신 재생되는 고품질 풀모션.
 * - 컷인(HEROIC_CUTIN_STILLS): 시퀀스가 없는 영웅의 무공 시전 시
 *   화면에 잠깐 등장하는 일러스트 컷인 (시퀀스 완성 시 미사용).
 */

export interface HeroicSequenceDef {
  readonly characterId: string;
  readonly skillId: string;
  readonly frameCount: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

export interface HeroicCutinDef {
  readonly characterId: string;
  readonly skillId: string;
}

export const HEROIC_FRAME_W = 256;
export const HEROIC_FRAME_H = 384;

export const HEROIC_MOTION_SEQUENCES: readonly HeroicSequenceDef[] = [
  { characterId: 'sword_male', skillId: 'samjae', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'sword_male', skillId: 'maehwa', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'sword_male', skillId: 'changung', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'sword_female', skillId: 'samjae', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'sword_female', skillId: 'maehwa', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'sword_female', skillId: 'changung', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'dao_male', skillId: 'baldo', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'dao_female', skillId: 'gwangpung', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'dao_female', skillId: 'paewang', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'fist_male', skillId: 'taejo', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'fist_male', skillId: 'yeorae', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'fist_female', skillId: 'yeonhwante', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'spear_male', skillId: 'yongchang', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'spear_male', skillId: 'cheonha', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
  { characterId: 'spear_female', skillId: 'hoeseon', frameCount: 12, frameWidth: HEROIC_FRAME_W, frameHeight: HEROIC_FRAME_H },
];

/** 시퀀스가 없는 조합만 컷인으로 폴백 (현재 전 캐릭터 시퀀스 완성) */
export const HEROIC_CUTIN_STILLS: readonly HeroicCutinDef[] = [];

export function heroicSheetKey(characterId: string, skillId: string): string {
  return `heroic_${characterId}_${skillId}`;
}

export function heroicSheetPath(characterId: string, skillId: string): string {
  return `${RUNTIME_ASSET_PATH}/heroic_${characterId}_${skillId}.webp`;
}

export function heroicAnimKey(characterId: string, skillId: string): string {
  return `heroic-${characterId}-${skillId}`;
}

export function cutinKey(characterId: string, skillId: string): string {
  return `cutin_${characterId}_${skillId}`;
}

export function cutinPath(characterId: string, skillId: string): string {
  return `${RUNTIME_ASSET_PATH}/cutin_${characterId}_${skillId}.webp`;
}