import { CHARACTER_LIST } from './characters';
import { SET_IDS } from './equipment';

export const RUNTIME_ASSET_PATH = 'sprites/generated/runtime';

export const HERO_ASSETS = CHARACTER_LIST.map(character => ({
  key: `hero_${character.id}`,
  path: `${RUNTIME_ASSET_PATH}/hero_${character.id}.png`,
}));

export const HERO_SET_SKIN_ASSETS = CHARACTER_LIST.flatMap(character =>
  SET_IDS.map(setId => {
    const key = `hero_set_${character.id}_${setId}`;
    const cls = character.charClass === 'BLADE' ? 'dao' : character.charClass.toLowerCase();
    return {
      key,
      path: `${RUNTIME_ASSET_PATH}/hero_set_${cls}_${setId}.png`,
    };
  })
);

export const HERO_SET_SKIN_KEYS = HERO_SET_SKIN_ASSETS.map(asset => asset.key);

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
    return [
      { key: `region_${id}_bg`, path: `${RUNTIME_ASSET_PATH}/region_${id}_bg.webp` },
      { key: `region_${id}_mg`, path: `${RUNTIME_ASSET_PATH}/region_${id}_mg.webp` },
      { key: `region_${id}_fg`, path: `${RUNTIME_ASSET_PATH}/region_${id}_fg.webp` },
    ];
  }).flat(),
];

export const NPC_ASSETS = [
  { key: 'npc_jeomsoyi', path: `${RUNTIME_ASSET_PATH}/npc_jeomsoyi.png` },
  { key: 'npc_master', path: `${RUNTIME_ASSET_PATH}/npc_master.png` },
  { key: 'npc_blacksmith', path: `${RUNTIME_ASSET_PATH}/npc_blacksmith.png` },
  { key: 'npc_merchant', path: `${RUNTIME_ASSET_PATH}/npc_merchant.png` },
  { key: 'npc_innkeeper', path: `${RUNTIME_ASSET_PATH}/npc_innkeeper.png` },
];

export const UI_FRAME_ASSETS = [
  { key: 'ui_card_common', path: `${RUNTIME_ASSET_PATH}/ui_card_common.png` },
  { key: 'ui_card_rare', path: `${RUNTIME_ASSET_PATH}/ui_card_rare.png` },
  { key: 'ui_card_epic', path: `${RUNTIME_ASSET_PATH}/ui_card_epic.png` },
  { key: 'ui_card_legend', path: `${RUNTIME_ASSET_PATH}/ui_card_legend.png` },
  { key: 'ui_dialog_bg', path: `${RUNTIME_ASSET_PATH}/ui_dialog_bg.png` },
  { key: 'ui_boss_warn_border', path: `${RUNTIME_ASSET_PATH}/ui_boss_warn_border.png` },
  { key: 'ui_frame_dragon', path: `${RUNTIME_ASSET_PATH}/ui_frame_dragon.png` },
  { key: 'ui_frame_tiger', path: `${RUNTIME_ASSET_PATH}/ui_frame_tiger.png` },
  { key: 'ui_panel_bg', path: `${RUNTIME_ASSET_PATH}/ui_panel_bg.png` },
];

export const SKILL_CARD_ASSETS = Array.from({ length: 40 }, (_, index) => {
  const id = String(index + 1).padStart(2, '0');
  return { key: `skill_card_${id}`, path: `${RUNTIME_ASSET_PATH}/skill_card_${id}.webp` };
});

export const COMBAT_VFX_KEYS = Array.from({ length: 24 }, (_, index) =>
  `combat_vfx_${String(index + 1).padStart(2, '0')}`
);

export const COMBAT_VFX_ASSETS = COMBAT_VFX_KEYS.map(key => ({
  key,
  path: `${RUNTIME_ASSET_PATH}/${key}.png`,
}));

export const ALL_RUNTIME_ASSETS = [
  ...HERO_ASSETS,
  ...HERO_SET_SKIN_ASSETS,
  ...ENEMY_ASSETS,
  ...BOSS_ASSETS,
  ...BACKGROUND_ASSETS,
  ...NPC_ASSETS,
  ...UI_FRAME_ASSETS,
  ...SKILL_CARD_ASSETS,
  ...COMBAT_VFX_ASSETS,
];

export function skillCardKey(skillId: string): string {
  let hash = 0;
  for (const char of skillId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `skill_card_${String((hash % 40) + 1).padStart(2, '0')}`;
}

export function skillVfxKey(skillId: string): string {
  let hash = 0;
  for (const char of skillId) hash = (hash * 131 + char.charCodeAt(0)) >>> 0;
  return COMBAT_VFX_KEYS[hash % COMBAT_VFX_KEYS.length];
}

export function heroSetSkinKey(characterId: string, setId: string): string {
  return `hero_set_${characterId}_${setId}`;
}
