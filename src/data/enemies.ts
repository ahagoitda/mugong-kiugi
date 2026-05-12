import type { EnemyData } from './types';

/**
 * 적 데이터베이스
 *
 * 일반 적 6종 + 보스 2종으로 구성합니다.
 * 웨이브가 높아질수록 더 강한 적이 등장합니다.
 *
 * 스프라이트 전략 (크레딧 절약):
 * - 기존 3종 스프라이트(bandit/swordsman/assassin)를 재사용하되
 *   tint(색조)를 달리하여 시각적으로 차별화합니다.
 * - 보스 2종: boss_beopwang(기존) + 색조 변형 버전(천마신군)
 *
 * dropTable.chance 합은 1.0 이하로 유지합니다.
 */
export const ENEMY_DATABASE: ReadonlyMap<string, EnemyData> = new Map([

  // ─── 1~3웨이브: 초급 적 ───

  ['bandit', {
    id: 'bandit',
    name: '산적',
    hp: 30,
    damage: 5,
    speed: 40,
    attackRange: 28,
    attackCooldown: 1500,
    spriteKey: 'enemy_bandit',
    dropTable: [
      { skillId: 'samjae', chance: 0.3 },
    ],
  }],

  ['militia', {
    id: 'militia',
    name: '관군',
    hp: 45,
    damage: 7,
    speed: 35,
    attackRange: 30,
    attackCooldown: 1400,
    spriteKey: 'enemy_bandit',
    tint: 0x88aaff,          // 파란 색조 → 관군 느낌
    dropTable: [
      { skillId: 'samjae', chance: 0.2 },
      { skillId: 'yukhap', chance: 0.1 },
    ],
  }],

  // ─── 4~7웨이브: 중급 적 ───

  ['swordsman', {
    id: 'swordsman',
    name: '검객',
    hp: 60,
    damage: 10,
    speed: 50,
    attackRange: 32,
    attackCooldown: 1200,
    spriteKey: 'enemy_swordsman',
    dropTable: [
      { skillId: 'samjae', chance: 0.2 },
      { skillId: 'yukhap', chance: 0.15 },
    ],
  }],

  ['dark_swordsman', {
    id: 'dark_swordsman',
    name: '흑도 검객',
    hp: 80,
    damage: 14,
    speed: 55,
    attackRange: 34,
    attackCooldown: 1100,
    spriteKey: 'enemy_swordsman',
    tint: 0xff4444,          // 붉은 색조 → 사파 느낌
    dropTable: [
      { skillId: 'yukhap', chance: 0.2 },
      { skillId: 'maehwa', chance: 0.05 },
    ],
  }],

  // ─── 8~12웨이브: 고급 적 ───

  ['assassin', {
    id: 'assassin',
    name: '자객',
    hp: 45,
    damage: 15,
    speed: 70,
    attackRange: 24,
    attackCooldown: 900,
    spriteKey: 'enemy_assassin',
    dropTable: [
      { skillId: 'yukhap', chance: 0.25 },
      { skillId: 'samjae', chance: 0.15 },
    ],
  }],

  ['shadow_assassin', {
    id: 'shadow_assassin',
    name: '살막 고수',
    hp: 65,
    damage: 22,
    speed: 85,
    attackRange: 26,
    attackCooldown: 750,
    spriteKey: 'enemy_assassin',
    tint: 0xaa44ff,          // 보라 색조 → 마교 자객 느낌
    dropTable: [
      { skillId: 'cheongpung', chance: 0.1 },
      { skillId: 'yukhap', chance: 0.2 },
    ],
  }],

  // ─── 보스 1: 5웨이브마다 (마교 법왕) ───

  ['boss_beopwang', {
    id: 'boss_beopwang',
    name: '마교 법왕',
    hp: 300,
    damage: 25,
    speed: 35,
    attackRange: 48,
    attackCooldown: 2000,
    spriteKey: 'boss_beopwang',
    dropTable: [
      { skillId: 'maehwa', chance: 0.15 },
      { skillId: 'cheongpung', chance: 0.15 },
      { skillId: 'samjae', chance: 0.3 },
      { skillId: 'yukhap', chance: 0.3 },
    ],
  }],

  // ─── 보스 2: 10웨이브마다 (천마신군) ───

  ['boss_cheonma', {
    id: 'boss_cheonma',
    name: '천마신군',
    hp: 600,
    damage: 40,
    speed: 50,
    attackRange: 60,
    attackCooldown: 1500,
    spriteKey: 'boss_beopwang',
    tint: 0x4400cc,          // 짙은 보라 색조 → 천마 느낌
    dropTable: [
      { skillId: 'taegeuk', chance: 0.1 },
      { skillId: 'maehwa', chance: 0.2 },
      { skillId: 'cheongpung', chance: 0.2 },
      { skillId: 'yukhap', chance: 0.15 },
    ],
  }],
]);

/**
 * 웨이브에 따른 스폰 가능 적 ID 풀을 반환합니다.
 *
 * 설계 원칙:
 * - 초반에는 약한 적만 등장 → 점진적으로 강한 적 추가
 * - 배열에서 랜덤 선택하므로, 같은 ID를 여러 번 넣으면 등장 확률이 높아집니다.
 */
export function getEnemyPoolForWave(wave: number): readonly string[] {
  if (wave <= 3)  return ['bandit', 'bandit', 'militia'];
  if (wave <= 6)  return ['bandit', 'militia', 'swordsman', 'swordsman'];
  if (wave <= 9)  return ['militia', 'swordsman', 'dark_swordsman', 'assassin'];
  if (wave <= 14) return ['swordsman', 'dark_swordsman', 'assassin', 'shadow_assassin'];
  return ['dark_swordsman', 'assassin', 'shadow_assassin', 'shadow_assassin'];
}

/**
 * 해당 웨이브의 보스 ID를 반환합니다.
 * 보스 웨이브가 아니면 null을 반환합니다.
 *
 * - 10웨이브 배수: 천마신군 (더 강한 보스, 우선 체크)
 * - 5웨이브 배수: 마교 법왕
 */
export function getBossForWave(wave: number): string | null {
  if (wave % 10 === 0) return 'boss_cheonma';
  if (wave % 5 === 0)  return 'boss_beopwang';
  return null;
}
