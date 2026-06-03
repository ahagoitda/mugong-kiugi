import { CHARACTER_LIST } from './characters';

export const RUNTIME_ASSET_PATH = 'sprites/generated/runtime';

export const HERO_ASSETS = CHARACTER_LIST.map(character => ({
  key: `hero_${character.id}`,
  path: `${RUNTIME_ASSET_PATH}/hero_${character.id}.png`,
}));

export const ENEMY_ASSETS = Array.from({ length: 24 }, (_, index) => {
  const id = String(index + 1).padStart(2, '0');
  return { key: `enemy_art_${id}`, path: `${RUNTIME_ASSET_PATH}/enemy_${id}.png` };
});

export const BOSS_ASSETS = [
  'daeju', 'danju', 'gakju', 'magun', 'hobup', 'saja', 'bugyoju', 'hyeolma',
].map(id => ({ key: `boss_art_${id}`, path: `${RUNTIME_ASSET_PATH}/boss_${id}.png` }));

export const BACKGROUND_ASSETS = [
  { key: 'background_main', path: `${RUNTIME_ASSET_PATH}/background_main.webp` },
  ...Array.from({ length: 8 }, (_, index) => {
    const id = String(index + 1).padStart(2, '0');
    return { key: `region_${id}`, path: `${RUNTIME_ASSET_PATH}/region_${id}.webp` };
  }),
];

export const SKILL_CARD_ASSETS = Array.from({ length: 40 }, (_, index) => {
  const id = String(index + 1).padStart(2, '0');
  return { key: `skill_card_${id}`, path: `${RUNTIME_ASSET_PATH}/skill_card_${id}.webp` };
});

export const ALL_RUNTIME_ASSETS = [
  ...HERO_ASSETS,
  ...ENEMY_ASSETS,
  ...BOSS_ASSETS,
  ...BACKGROUND_ASSETS,
  ...SKILL_CARD_ASSETS,
];

export function skillCardKey(skillId: string): string {
  let hash = 0;
  for (const char of skillId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `skill_card_${String((hash % 40) + 1).padStart(2, '0')}`;
}
