import type { BossRank, EnemyData } from './types';

const SKILLS = ['samjae', 'yukhap', 'maehwa', 'cheongpung', 'taegeuk', 'changung'] as const;
const ENEMY_NAMES = [
  '녹림 도적', '흑의 검객', '혈교 자객',
  '창룡 문도', '입문 제자', '철권 무사',
  '대나무 산적', '비도 암수', '설산 검수',
  '빙혈 권사', '빙창 호위', '백면 자객',
  '흑야 낭인', '사막 도객', '낙양 창객',
  '금사 낭사', '혈교 무사', '혈교 고수',
  '흑풍 대주', '적월 자객', '금강 호위',
  '마예 권사', '혈창 술사', '혈교 집행관',
] as const;

const BOSS_IDS = ['daeju', 'danju', 'gakju', 'magun', 'hobup', 'saja', 'bugyoju', 'hyeolma'] as const;
const BOSS_RANKS: readonly BossRank[] = ['DAEJU', 'DANJU', 'GAKJU', 'MAGUN', 'HOBUP', 'SAJA', 'BUGYOJU', 'HYEOLMA'];
const BOSS_NAMES = ['혈예 대주', '적월 단주', '유영 각주', '비천 마군', '금강 호법', '묵운 사자', '혈마 부교주', '무령 혈마'] as const;

const entries: [string, EnemyData][] = ENEMY_NAMES.map((name, index) => {
  const n = index + 1;
  const region = Math.floor(index / 3) + 1;
  const id = `enemy_${String(n).padStart(2, '0')}`;
  return [id, {
    id,
    name,
    hp: 28 + n * 8,
    damage: 4 + Math.floor(n * 1.2),
    speed: 34 + (n % 5) * 7,
    attackRange: 34 + (n % 3) * 4,
    attackCooldown: 1500 - Math.min(650, n * 24),
    spriteKey: `enemy_art_${String(n).padStart(2, '0')}`,
    rank: n % 3 === 0 ? 'ELITE' : 'MINION',
    region,
    setId: `blood_set_${region}`,
    goldReward: 20 + n * 12,
    expReward: 25 + n * 15,
    dropTable: [{ skillId: SKILLS[Math.min(SKILLS.length - 1, Math.floor(index / 4))], chance: 0.18 }],
  }];
});

for (let index = 0; index < BOSS_IDS.length; index++) {
  const shortId = BOSS_IDS[index];
  const id = `boss_${shortId}`;
  entries.push([id, {
    id,
    name: BOSS_NAMES[index],
    title: BOSS_NAMES[index],
    hp: 260 + index * 340,
    damage: 18 + index * 9,
    speed: 40 + index * 3,
    attackRange: 52 + index * 3,
    attackCooldown: 1700 - index * 80,
    spriteKey: `boss_art_${shortId}`,
    rank: 'BOSS',
    bossRank: BOSS_RANKS[index],
    region: index + 1,
    setId: `blood_set_${index + 1}`,
    goldReward: 600 + index * 1400,
    expReward: 900 + index * 1800,
    dropTable: [{ skillId: SKILLS[Math.min(SKILLS.length - 1, index)], chance: 0.55 }],
  }]);
}

export const ENEMY_DATABASE: ReadonlyMap<string, EnemyData> = new Map(entries);

export const BOSS_RANK_COLORS: Readonly<Record<string, number>> = {
  DAEJU: 0x9b7440, DANJU: 0xb73d25, GAKJU: 0x7850a0, MAGUN: 0x2f7fba,
  HOBUP: 0xd2a431, SAJA: 0x65509e, BUGYOJU: 0xb51f49, HYEOLMA: 0xe02120,
};

export const BOSS_RANK_NAMES: Readonly<Record<string, string>> = {
  DAEJU: '대주', DANJU: '단주', GAKJU: '각주', MAGUN: '마군',
  HOBUP: '호법', SAJA: '사자', BUGYOJU: '부교주', HYEOLMA: '혈마',
};

export function getEnemyPoolForWave(wave: number): readonly string[] {
  const region = Math.min(8, Math.max(1, Math.floor((wave - 1) / 5) + 1));
  const start = (region - 1) * 3 + 1;
  return [0, 0, 1, 1, 2].map(offset => `enemy_${String(start + offset).padStart(2, '0')}`);
}

export function getBossForWave(wave: number): string | null {
  if (wave % 5 !== 0) return null;
  const index = Math.min(7, Math.max(0, Math.floor(wave / 5) - 1));
  return `boss_${BOSS_IDS[index]}`;
}

export const BOSS_RANK_ORDER = BOSS_RANKS;
