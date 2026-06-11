import { equippedItems } from './equipment';
import type { SaveData } from './types';

/** 졸병 데미지 배율 (wave 스케일링 전) */
export const ENEMY_DMG_MUL = 0.25;

/** 졸병 HP 배율 */
export const ENEMY_HP_MUL = 0.45;

/** 보스 HP/데미지 배율 */
export const BOSS_HP_MUL = 0.38;
export const BOSS_DMG_MUL = 0.14;

/** 40웨이브마다 졸병 데미지 +30% (region 순환 톱니 보정) */
export function minionCycleDmgMul(wave: number): number {
  return 1 + Math.floor((wave - 1) / 40) * 0.3;
}

/** wave 50 이후 보스 연속 스케일링 */
export function bossPost50Mul(wave: number): { hpMul: number; dmgMul: number } {
  if (wave <= 50) return { hpMul: 1, dmgMul: 1 };
  const extra = wave - 50;
  return { hpMul: 1 + extra * 0.02, dmgMul: 1 + extra * 0.01 };
}

/** 환생 영구 공격 배율 (+10%/회) */
export function rebirthAttackMul(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * 0.10;
}

/** 환생 경로별 HP/금화 보너스 */
export function rebirthPathBonuses(paths: readonly string[] | undefined): { hpMul: number; goldMul: number } {
  const warrior = (paths ?? []).filter(p => p === 'warrior').length;
  const scholar = (paths ?? []).filter(p => p === 'scholar').length;
  return {
    hpMul: 1 + warrior * 0.05,
    goldMul: 1 + scholar * 0.10,
  };
}

/**
 * 플레이어 자동 회피 확률.
 * 기본 공식 50% 캡 + 체력 수련(+2%/lv, 최대 20%) + 6세트 장비(+5%).
 */
export function calculateEvade(save: SaveData): number {
  const level = save.level ?? 1;
  const baseEvade = Math.min(0.50, 0.18 + (level - 1) * 0.025);
  const trainingHealth = save.trainingLevels?.hp ?? 0;
  const trainingBonus = Math.min(0.20, trainingHealth * 0.02);

  const equipped = equippedItems(save.equipmentInventory ?? [], save.equippedItems);
  const setCounts = new Map<string, number>();
  for (const item of equipped) {
    if (!item.setId) continue;
    setCounts.set(item.setId, (setCounts.get(item.setId) ?? 0) + 1);
  }
  const hasFullSet = [...setCounts.values()].some(c => c >= 6);
  const equipmentBonus = hasFullSet ? 0.05 : 0;

  return Math.min(0.70, baseEvade + trainingBonus + equipmentBonus);
}

/** 공격 수련 비용 (21레벨부터 3× 구간) */
export function trainingAttackCost(level: number): number {
  const mul = level >= 20 ? 300 : 100;
  return mul * (level + 1);
}

/** 일반 수련 비용 */
export function trainingCost(base: number, level: number): number {
  return base * (level + 1);
}