import type { EnemyData, BossRank } from './types';

/**
 * 적 데이터베이스 - 혈교(血敎) 세계관 기반
 *
 * ═══════════════════════════════════════════════════════
 * 혈교 위계 구조 (하위 → 상위):
 *   대주(隊主) → 단주(團主) → 각주(閣主) → 마군(魔君) →
 *   호법(護法) → 사자(使者) → 부교주(副敎主) → 혈마(血魔)
 * ═══════════════════════════════════════════════════════
 *
 * 일반 적 8종 + 보스 8종으로 구성합니다.
 * 웨이브가 높아질수록 더 강한 적이 등장합니다.
 *
 * 스프라이트 전략 (크레딧 절약):
 * - 기존 3종 스프라이트(bandit/swordsman/assassin)를 재사용하되
 *   tint(색조)를 달리하여 시각적으로 차별화합니다.
 * - 보스: boss_beopwang 스프라이트에 색조 변형
 *
 * 밸런스 설계 원칙:
 * - 플레이어 기본 DPS: ~12.5 (삼재검법 damageMultiplier 1.0 * 10 / 0.8초)
 * - 일반 적 HP: 2~8초 내 처치 가능하도록 설계
 * - 보스 HP: 15~60초 내 처치 가능하도록 설계
 * - 적 DPS: 플레이어 HP의 1~3%/초 수준으로 긴장감 유지
 */
export const ENEMY_DATABASE: ReadonlyMap<string, EnemyData> = new Map([

  // ═══════════════════════════════════════════════════════
  // 일반 적 (MINION) - 8종
  // ═══════════════════════════════════════════════════════

  // ─── 1~5웨이브: 초급 적 ───

  ['bandit', {
    id: 'bandit',
    name: '산적',
    hp: 30,
    damage: 5,
    speed: 40,
    attackRange: 28,
    attackCooldown: 1500,
    spriteKey: 'enemy_bandit',
    rank: 'MINION',
    goldReward: 3,
    expReward: 5,
    dropTable: [
      { skillId: 'samjae', chance: 0.25 },
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
    tint: 0x88aaff,
    rank: 'MINION',
    goldReward: 5,
    expReward: 8,
    dropTable: [
      { skillId: 'samjae', chance: 0.2 },
      { skillId: 'yukhap', chance: 0.1 },
    ],
  }],

  // ─── 6~10웨이브: 중급 적 ───

  ['swordsman', {
    id: 'swordsman',
    name: '검객',
    hp: 65,
    damage: 10,
    speed: 50,
    attackRange: 32,
    attackCooldown: 1200,
    spriteKey: 'enemy_swordsman',
    rank: 'MINION',
    goldReward: 8,
    expReward: 12,
    dropTable: [
      { skillId: 'samjae', chance: 0.15 },
      { skillId: 'yukhap', chance: 0.15 },
    ],
  }],

  ['dark_swordsman', {
    id: 'dark_swordsman',
    name: '흑도 검객',
    hp: 85,
    damage: 14,
    speed: 55,
    attackRange: 34,
    attackCooldown: 1100,
    spriteKey: 'enemy_swordsman',
    tint: 0xff4444,
    rank: 'ELITE',
    goldReward: 12,
    expReward: 18,
    dropTable: [
      { skillId: 'yukhap', chance: 0.2 },
      { skillId: 'maehwa', chance: 0.05 },
    ],
  }],

  // ─── 11~20웨이브: 고급 적 ───

  ['assassin', {
    id: 'assassin',
    name: '자객',
    hp: 50,
    damage: 16,
    speed: 70,
    attackRange: 24,
    attackCooldown: 900,
    spriteKey: 'enemy_assassin',
    rank: 'MINION',
    goldReward: 10,
    expReward: 15,
    dropTable: [
      { skillId: 'yukhap', chance: 0.2 },
      { skillId: 'samjae', chance: 0.15 },
    ],
  }],

  ['shadow_assassin', {
    id: 'shadow_assassin',
    name: '혈교 살수',
    hp: 70,
    damage: 22,
    speed: 85,
    attackRange: 26,
    attackCooldown: 750,
    spriteKey: 'enemy_assassin',
    tint: 0xaa44ff,
    rank: 'ELITE',
    goldReward: 18,
    expReward: 25,
    dropTable: [
      { skillId: 'cheongpung', chance: 0.1 },
      { skillId: 'yukhap', chance: 0.2 },
    ],
  }],

  // ─── 21~30웨이브: 혈교 정예 ───

  ['blood_warrior', {
    id: 'blood_warrior',
    name: '혈교 무사',
    hp: 100,
    damage: 25,
    speed: 60,
    attackRange: 30,
    attackCooldown: 1000,
    spriteKey: 'enemy_swordsman',
    tint: 0xcc2222,
    rank: 'ELITE',
    goldReward: 25,
    expReward: 35,
    dropTable: [
      { skillId: 'maehwa', chance: 0.12 },
      { skillId: 'cheongpung', chance: 0.12 },
    ],
  }],

  // ─── 31+웨이브: 혈교 고수 ───

  ['blood_master', {
    id: 'blood_master',
    name: '혈교 고수',
    hp: 140,
    damage: 32,
    speed: 75,
    attackRange: 34,
    attackCooldown: 850,
    spriteKey: 'enemy_assassin',
    tint: 0x880000,
    rank: 'ELITE',
    goldReward: 40,
    expReward: 50,
    dropTable: [
      { skillId: 'cheongpung', chance: 0.15 },
      { skillId: 'taegeuk', chance: 0.03 },
    ],
  }],

  // ═══════════════════════════════════════════════════════
  // 보스 (BOSS) - 혈교 위계 8단계
  // ═══════════════════════════════════════════════════════

  // ─── 5웨이브: 대주(隊主) - 10인 부대장 ───
  ['boss_daeju', {
    id: 'boss_daeju',
    name: '제7대주',
    title: '냉혈대주',
    hp: 250,
    damage: 20,
    speed: 40,
    attackRange: 40,
    attackCooldown: 1800,
    spriteKey: 'boss_beopwang',
    tint: 0x886644,
    rank: 'BOSS',
    bossRank: 'DAEJU',
    goldReward: 80,
    expReward: 100,
    dropTable: [
      { skillId: 'samjae', chance: 0.4 },
      { skillId: 'yukhap', chance: 0.3 },
      { skillId: 'maehwa', chance: 0.1 },
    ],
  }],

  // ─── 10웨이브: 단주(團主) - 100인 부대장 ───
  ['boss_danju', {
    id: 'boss_danju',
    name: '혈풍단주',
    title: '혈풍단주',
    hp: 450,
    damage: 28,
    speed: 45,
    attackRange: 44,
    attackCooldown: 1600,
    spriteKey: 'boss_beopwang',
    tint: 0xaa4422,
    rank: 'BOSS',
    bossRank: 'DANJU',
    goldReward: 150,
    expReward: 200,
    dropTable: [
      { skillId: 'yukhap', chance: 0.3 },
      { skillId: 'maehwa', chance: 0.15 },
      { skillId: 'cheongpung', chance: 0.1 },
    ],
  }],

  // ─── 15웨이브: 각주(閣主) - 특수 조직 수장 ───
  ['boss_gakju', {
    id: 'boss_gakju',
    name: '단혼각주',
    title: '단혼각주',
    hp: 700,
    damage: 35,
    speed: 50,
    attackRange: 48,
    attackCooldown: 1400,
    spriteKey: 'boss_beopwang',
    tint: 0x664488,
    rank: 'BOSS',
    bossRank: 'GAKJU',
    goldReward: 250,
    expReward: 350,
    dropTable: [
      { skillId: 'maehwa', chance: 0.2 },
      { skillId: 'cheongpung', chance: 0.2 },
      { skillId: 'taegeuk', chance: 0.05 },
    ],
  }],

  // ─── 20웨이브: 마군(魔君) - 야전 사령관 ───
  ['boss_magun', {
    id: 'boss_magun',
    name: '빙룡마군',
    title: '빙룡마군',
    hp: 1000,
    damage: 42,
    speed: 55,
    attackRange: 52,
    attackCooldown: 1300,
    spriteKey: 'boss_beopwang',
    tint: 0x2288cc,
    rank: 'BOSS',
    bossRank: 'MAGUN',
    goldReward: 400,
    expReward: 500,
    dropTable: [
      { skillId: 'cheongpung', chance: 0.25 },
      { skillId: 'maehwa', chance: 0.2 },
      { skillId: 'taegeuk', chance: 0.1 },
    ],
  }],

  // ─── 25웨이브: 호법(護法) - 교단 근위대 ───
  ['boss_hobup', {
    id: 'boss_hobup',
    name: '금강호법',
    title: '금강호법',
    hp: 1500,
    damage: 50,
    speed: 45,
    attackRange: 56,
    attackCooldown: 1500,
    spriteKey: 'boss_beopwang',
    tint: 0xddaa22,
    rank: 'BOSS',
    bossRank: 'HOBUP',
    goldReward: 600,
    expReward: 750,
    dropTable: [
      { skillId: 'taegeuk', chance: 0.15 },
      { skillId: 'cheongpung', chance: 0.2 },
      { skillId: 'maehwa', chance: 0.2 },
    ],
  }],

  // ─── 30웨이브: 사자(使者) - 교주 직속 심복 ───
  ['boss_saja', {
    id: 'boss_saja',
    name: '흑운좌사자',
    title: '흑운좌사자',
    hp: 2200,
    damage: 60,
    speed: 60,
    attackRange: 60,
    attackCooldown: 1200,
    spriteKey: 'boss_beopwang',
    tint: 0x222244,
    rank: 'BOSS',
    bossRank: 'SAJA',
    goldReward: 1000,
    expReward: 1200,
    dropTable: [
      { skillId: 'taegeuk', chance: 0.2 },
      { skillId: 'changung', chance: 0.05 },
      { skillId: 'cheongpung', chance: 0.2 },
    ],
  }],

  // ─── 40웨이브: 부교주(副敎主) ───
  ['boss_bugyoju', {
    id: 'boss_bugyoju',
    name: '적마부교주',
    title: '적마부교주',
    hp: 3500,
    damage: 75,
    speed: 65,
    attackRange: 64,
    attackCooldown: 1100,
    spriteKey: 'boss_beopwang',
    tint: 0xcc0044,
    rank: 'BOSS',
    bossRank: 'BUGYOJU',
    goldReward: 2000,
    expReward: 2500,
    dropTable: [
      { skillId: 'taegeuk', chance: 0.25 },
      { skillId: 'changung', chance: 0.1 },
    ],
  }],

  // ─── 50웨이브: 혈마(血魔) - 교단 절대자 ───
  ['boss_hyeolma', {
    id: 'boss_hyeolma',
    name: '무령혈마',
    title: '무령혈마',
    hp: 5000,
    damage: 100,
    speed: 70,
    attackRange: 72,
    attackCooldown: 1000,
    spriteKey: 'boss_beopwang',
    tint: 0x440000,
    rank: 'BOSS',
    bossRank: 'HYEOLMA',
    goldReward: 5000,
    expReward: 6000,
    dropTable: [
      { skillId: 'changung', chance: 0.25 },
      { skillId: 'taegeuk', chance: 0.3 },
    ],
  }],
]);

/**
 * 보스 등급별 표시 색상 (UI용)
 */
export const BOSS_RANK_COLORS: Readonly<Record<string, number>> = {
  DAEJU:    0x886644,
  DANJU:    0xaa4422,
  GAKJU:    0x664488,
  MAGUN:    0x2288cc,
  HOBUP:    0xddaa22,
  SAJA:     0x6644aa,
  BUGYOJU:  0xcc0044,
  HYEOLMA:  0xff0000,
};

/**
 * 보스 등급 한글 명칭
 */
export const BOSS_RANK_NAMES: Readonly<Record<string, string>> = {
  DAEJU:    '대주',
  DANJU:    '단주',
  GAKJU:    '각주',
  MAGUN:    '마군',
  HOBUP:    '호법',
  SAJA:     '사자',
  BUGYOJU:  '부교주',
  HYEOLMA:  '혈마',
};

/**
 * 웨이브에 따른 스폰 가능 적 ID 풀을 반환합니다.
 *
 * 설계 원칙:
 * - 초반에는 약한 적만 등장 → 점진적으로 강한 적 추가
 * - 배열에서 랜덤 선택하므로, 같은 ID를 여러 번 넣으면 등장 확률이 높아집니다.
 * - 혈교 세력은 웨이브 11부터 등장하기 시작합니다.
 */
export function getEnemyPoolForWave(wave: number): readonly string[] {
  if (wave <= 3)  return ['bandit', 'bandit', 'bandit', 'militia'];
  if (wave <= 6)  return ['bandit', 'militia', 'militia', 'swordsman'];
  if (wave <= 10) return ['militia', 'swordsman', 'swordsman', 'dark_swordsman'];
  if (wave <= 15) return ['swordsman', 'dark_swordsman', 'assassin', 'assassin'];
  if (wave <= 20) return ['dark_swordsman', 'assassin', 'shadow_assassin', 'shadow_assassin'];
  if (wave <= 30) return ['shadow_assassin', 'blood_warrior', 'blood_warrior', 'assassin'];
  if (wave <= 40) return ['blood_warrior', 'blood_warrior', 'blood_master', 'shadow_assassin'];
  return ['blood_warrior', 'blood_master', 'blood_master', 'blood_master'];
}

/**
 * 해당 웨이브의 보스 ID를 반환합니다.
 * 보스 웨이브가 아니면 null을 반환합니다.
 *
 * 혈교 위계에 따른 보스 등장 순서:
 * - 5웨이브: 대주 (隊主)
 * - 10웨이브: 단주 (團主)
 * - 15웨이브: 각주 (閣主)
 * - 20웨이브: 마군 (魔君)
 * - 25웨이브: 호법 (護法)
 * - 30웨이브: 사자 (使者)
 * - 40웨이브: 부교주 (副敎主)
 * - 50웨이브: 혈마 (血魔)
 * - 50+ 이후: 5의 배수마다 강화된 보스 재등장
 */
export function getBossForWave(wave: number): string | null {
  if (wave % 5 !== 0) return null;

  // 고정 보스 배치
  if (wave === 5)  return 'boss_daeju';
  if (wave === 10) return 'boss_danju';
  if (wave === 15) return 'boss_gakju';
  if (wave === 20) return 'boss_magun';
  if (wave === 25) return 'boss_hobup';
  if (wave === 30) return 'boss_saja';
  if (wave === 40) return 'boss_bugyoju';
  if (wave === 50) return 'boss_hyeolma';

  // 50+ 이후: 순환 강화 보스
  // 5의 배수마다 위계 순서대로 재등장 (스케일링은 BattleScene에서 처리)
  const bossOrder: string[] = [
    'boss_daeju', 'boss_danju', 'boss_gakju', 'boss_magun',
    'boss_hobup', 'boss_saja', 'boss_bugyoju', 'boss_hyeolma',
  ];
  const cycleIndex = (Math.floor((wave - 50) / 5)) % bossOrder.length;
  return bossOrder[cycleIndex];
}

/**
 * 보스 등급 순서 (스케일링 계산용)
 * 인덱스가 높을수록 강한 보스
 */
export const BOSS_RANK_ORDER: readonly BossRank[] = [
  'DAEJU', 'DANJU', 'GAKJU', 'MAGUN', 'HOBUP', 'SAJA', 'BUGYOJU', 'HYEOLMA',
];
