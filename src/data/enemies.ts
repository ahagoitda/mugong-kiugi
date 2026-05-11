import type { EnemyData } from './types';

/**
 * MVP 적 데이터
 *
 * 3종 일반 적 + 1종 보스로 구성합니다.
 * dropTable의 chance 합이 1.0을 넘지 않도록 설계합니다.
 * (나머지 확률은 "드랍 없음"에 해당)
 *
 * spriteKey는 BootScene에서 로드한 스프라이트시트 키와 일치해야 합니다.
 * 적 애니메이션은 BootScene.createAnimations()에서 등록됩니다.
 */
export const ENEMY_DATABASE: ReadonlyMap<string, EnemyData> = new Map([
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
]);
