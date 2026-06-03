import type { EquipmentGrade, EquipmentItem, EquipmentSlot } from './types';

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'WEAPON', 'ARMOR', 'HELM', 'BOOTS', 'ACCESSORY', 'RELIC',
];

export const EQUIPMENT_SLOT_NAMES: Readonly<Record<EquipmentSlot, string>> = {
  WEAPON: '무기', ARMOR: '갑옷', HELM: '투구', BOOTS: '신발', ACCESSORY: '장신구', RELIC: '유물',
};

export const SET_NAMES: Readonly<Record<string, string>> = {
  blood_set_1: '철혈', blood_set_2: '적월', blood_set_3: '환영', blood_set_4: '비천',
  blood_set_5: '금강', blood_set_6: '묵운', blood_set_7: '혈마', blood_set_8: '무령',
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

export function equipmentScore(item: EquipmentItem): number {
  return item.attack * 5 + item.hp + item.bonus * 10;
}
