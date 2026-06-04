import type { EquipmentGrade, EquipmentItem, EquipmentSlot } from './types';

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'WEAPON', 'ARMOR', 'HELM', 'BOOTS', 'ACCESSORY', 'RELIC',
];

export const EQUIPMENT_SLOT_NAMES: Readonly<Record<EquipmentSlot, string>> = {
  WEAPON: '무기', ARMOR: '갑옷', HELM: '투구', BOOTS: '신발', ACCESSORY: '장신구', RELIC: '유물',
};

export const SET_NAMES: Readonly<Record<string, string>> = {
  blood_set_1: '혈예', blood_set_2: '적월', blood_set_3: '유영', blood_set_4: '비천',
  blood_set_5: '금강', blood_set_6: '묵운', blood_set_7: '혈마', blood_set_8: '무령',
};

export const SET_IDS = Object.keys(SET_NAMES);

export const SET_TINTS: Readonly<Record<string, number>> = {
  blood_set_1: 0xb73d25,
  blood_set_2: 0x4fc3f7,
  blood_set_3: 0x66ff88,
  blood_set_4: 0xd6a84b,
  blood_set_5: 0xffd740,
  blood_set_6: 0x7850a0,
  blood_set_7: 0xff3366,
  blood_set_8: 0xe02120,
};

const GRADE_POWER: Readonly<Record<EquipmentGrade, number>> = {
  COMMON: 1, RARE: 1.7, EPIC: 2.8, LEGENDARY: 4.5,
};

export function createEquipment(region: number, slot?: EquipmentSlot, boss = false): EquipmentItem {
  const grade: EquipmentGrade = boss
    ? (Math.random() < 0.28 ? 'LEGENDARY' : 'EPIC')
    : (Math.random() < 0.08 ? 'EPIC' : Math.random() < 0.35 ? 'RARE' : 'COMMON');
  const chosenSlot = slot ?? EQUIPMENT_SLOTS[Math.floor(Math.random() * EQUIPMENT_SLOTS.length)];
  const power = Math.round((8 + region * 6) * GRADE_POWER[grade]);
  const setId = boss || Math.random() < 0.18 ? `blood_set_${region}` : undefined;
  const setName = setId ? SET_NAMES[setId] : '무명';
  return {
    id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `${setName} ${EQUIPMENT_SLOT_NAMES[chosenSlot]}`,
    slot: chosenSlot,
    grade,
    setId,
    attack: chosenSlot === 'WEAPON' || chosenSlot === 'RELIC' ? power : Math.round(power * 0.35),
    hp: chosenSlot === 'ARMOR' || chosenSlot === 'HELM' ? power * 5 : power,
    bonus: Math.round(power * 0.06),
  };
}

export function createSetEquipment(region: number, slot?: EquipmentSlot, grade?: EquipmentGrade): EquipmentItem {
  const chosenSlot = slot ?? EQUIPMENT_SLOTS[Math.floor(Math.random() * EQUIPMENT_SLOTS.length)];
  const finalGrade = grade ?? (Math.random() < 0.3 ? 'LEGENDARY' : 'EPIC');
  const power = Math.round((12 + region * 8) * GRADE_POWER[finalGrade]);
  const setId = `blood_set_${Math.min(8, Math.max(1, region))}`;
  const setName = SET_NAMES[setId] ?? '세트';
  return {
    id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `${setName} ${EQUIPMENT_SLOT_NAMES[chosenSlot]}`,
    slot: chosenSlot,
    grade: finalGrade,
    setId,
    attack: chosenSlot === 'WEAPON' || chosenSlot === 'RELIC' ? power : Math.round(power * 0.4),
    hp: chosenSlot === 'ARMOR' || chosenSlot === 'HELM' ? power * 6 : Math.round(power * 1.2),
    bonus: Math.round(power * 0.1),
  };
}

export function equipmentScore(item: EquipmentItem): number {
  return item.attack * 5 + item.hp + item.bonus * 10;
}

export interface EquipmentSetBonus {
  attackMul: number;
  hpMul: number;
  goldMul: number;
}

export function equippedItems(inventory: readonly EquipmentItem[], equipped?: Partial<Record<EquipmentSlot, string>>): EquipmentItem[] {
  if (!equipped) return [];
  return EQUIPMENT_SLOTS
    .map(slot => inventory.find(item => item.id === equipped[slot]))
    .filter((item): item is EquipmentItem => Boolean(item));
}

export function equipmentSetBonus(items: readonly EquipmentItem[]): EquipmentSetBonus {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.setId) continue;
    counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  }

  let attackMul = 1;
  let hpMul = 1;
  let goldMul = 1;
  for (const count of counts.values()) {
    if (count >= 2) attackMul += 0.08;
    if (count >= 4) hpMul += 0.12;
    if (count >= 6) {
      attackMul += 0.12;
      goldMul += 0.18;
    }
  }

  return { attackMul, hpMul, goldMul };
}

export function dominantSetId(items: readonly EquipmentItem[], minimumCount = 4): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.setId) continue;
    counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  }

  let bestId: string | null = null;
  let bestCount = minimumCount - 1;
  for (const [setId, count] of counts) {
    if (count > bestCount) {
      bestId = setId;
      bestCount = count;
    }
  }
  return bestId;
}
