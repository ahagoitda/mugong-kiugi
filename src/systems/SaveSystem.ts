import type { SaveData } from '../data/types';
import { getExpToNextLevel } from '../data/skills';

/**
 * SaveSystem - localStorage 기반 오프라인 세이브/로드 시스템
 *
 * 보안 고려사항:
 * - localStorage에는 민감한 정보(API 키, 비밀번호 등)를 저장하지 않습니다.
 * - JSON.parse 시 try-catch로 감싸서 악의적인 데이터 주입을 방어합니다.
 * - 버전 필드로 세이브 데이터 마이그레이션을 지원합니다.
 *
 * 메모리 누수 방지:
 * - 싱글톤 패턴 대신 순수 함수로 구현하여 참조 순환을 방지합니다.
 */

const SAVE_KEY = 'mugong_save_highres_v1';
const CURRENT_VERSION = 4;

/**
 * 기본 세이브 데이터를 생성합니다.
 * 새 게임 시작 시 사용됩니다.
 */
export function createDefaultSave(): SaveData {
  return {
    version: CURRENT_VERSION,
    level: 1,
    exp: 0,
    expToNext: getExpToNextLevel(1),
    gold: 0,
    hp: 100,
    maxHp: 100,
    stamina: 50,
    maxStamina: 50,
    equippedSkills: ['samjae'],
    equippedDash: 'chosangbi',
    inventory: { samjae: 1, chosangbi: 1 },
    unlockedSkills: ['samjae', 'chosangbi'],
    skillLevels: {},
    stageCleared: 0,
    totalPlayTime: 0,
    defeatedBosses: [],
    totalKills: 0,
    lastSavedAt: Date.now(),
    lastOfflineRewardAt: Date.now(),
    equipmentInventory: [],
    equippedItems: {},
    trainingLevels: { attack: 0, hp: 0, gold: 0, speed: 0, stamina: 0, crit: 0 },
    sectFacilities: { hall: 1, forge: 1, library: 1 },
    sectResearch: { SWORD: 0, BLADE: 0, FIST: 0, SPEAR: 0 },
    disciples: [],
    codexUnlocked: ['region_1'],
    missionProgress: {},
    missionClaims: [],
    dailyMissionDate: new Date().toLocaleDateString('en-CA'),
    storyRegion: 1,
    tutorialCompleted: false,
    gems: 30,
    shopLastReset: '',
    shopDailyPurchased: [],
    rebirthCount: 0,
    rebirthPaths: [],
    activeBuffs: [],
    enhanceStones: 0,
  };
}

/**
 * 세이브 데이터를 localStorage에 저장합니다.
 *
 * @param data - 저장할 세이브 데이터
 * @returns 저장 성공 여부
 */
export function saveGame(data: SaveData): boolean {
  try {
    data.lastSavedAt = Date.now();
    const serialized = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY, serialized);
    return true;
  } catch {
    // localStorage가 가득 찼거나 접근 불가능한 경우
    console.error('[SaveSystem] 세이브 실패: localStorage 접근 불가');
    return false;
  }
}

/**
 * localStorage에서 세이브 데이터를 불러옵니다.
 *
 * JSON.parse 실패 시 기본 세이브 데이터를 반환하여
 * 악의적인 데이터 주입이나 손상된 데이터로부터 안전합니다.
 *
 * @returns 로드된 세이브 데이터 (없으면 기본값)
 */
export function loadGame(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) {
      return createDefaultSave();
    }

    const parsed: unknown = JSON.parse(raw);

    // 타입 검증: parsed가 올바른 SaveData 구조인지 확인
    if (!isValidSaveData(parsed)) {
      console.warn('[SaveSystem] 손상된 세이브 데이터 감지. 기본값으로 초기화합니다.');
      return createDefaultSave();
    }

    // 버전 마이그레이션 (v1 → v4)
    if (parsed.version < CURRENT_VERSION) {
      return sanitizeSave(migrateSave(parsed));
    }

    return sanitizeSave(parsed);
  } catch {
    console.error('[SaveSystem] 로드 실패: 데이터 파싱 오류');
    return createDefaultSave();
  }
}

/**
 * 세이브 데이터 삭제 (새 게임 시작 시)
 */
export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    console.error('[SaveSystem] 삭제 실패');
  }
}

const VALID_EQUIPMENT_SLOTS = new Set(['WEAPON', 'ARMOR', 'HELM', 'BOOTS', 'ACCESSORY', 'RELIC']);
const VALID_EQUIPMENT_GRADES = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
const VALID_BUFF_TYPES = new Set(['ATK_BOOST', 'GOLD_BOOST', 'EXP_BOOST']);

function isValidEquipmentItem(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const e = item as Record<string, unknown>;
  return (
    typeof e.id === 'string' && e.id.length > 0 && e.id.length < 64 &&
    typeof e.name === 'string' && e.name.length <= 60 &&
    typeof e.slot === 'string' && VALID_EQUIPMENT_SLOTS.has(e.slot) &&
    typeof e.grade === 'string' && VALID_EQUIPMENT_GRADES.has(e.grade) &&
    typeof e.attack === 'number' && isFinite(e.attack) && e.attack >= 0 && e.attack <= 2_000_000 &&
    typeof e.hp === 'number' && isFinite(e.hp) && e.hp >= 0 && e.hp <= 100_000_000 &&
    typeof e.bonus === 'number' && isFinite(e.bonus) && e.bonus >= 0 && e.bonus <= 1_000_000 &&
    (e.enhance === undefined || (typeof e.enhance === 'number' && e.enhance >= 0 && e.enhance <= 10))
  );
}

function isValidActiveBuff(buff: unknown): boolean {
  if (typeof buff !== 'object' || buff === null) return false;
  const b = buff as Record<string, unknown>;
  return (
    typeof b.type === 'string' && VALID_BUFF_TYPES.has(b.type) &&
    typeof b.expiresAt === 'number' && isFinite(b.expiresAt) && b.expiresAt > 0
  );
}

/**
 * 로드된 세이브 데이터의 수치를 안전한 범위로 클램프합니다.
 * 손상된 데이터나 치트 시도로부터 게임 상태를 보호합니다.
 */
function sanitizeSave(data: SaveData): SaveData {
  data.level = Math.max(1, Math.min(100_000, Math.trunc(data.level)));
  data.exp = Math.max(0, Math.trunc(data.exp));
  data.maxHp = Math.max(1, Math.trunc(data.maxHp));
  data.hp = Math.max(0, Math.min(data.maxHp, Math.trunc(data.hp)));
  data.maxStamina = Math.max(1, Math.trunc(data.maxStamina));
  data.stamina = Math.max(0, Math.min(data.maxStamina, Math.trunc(data.stamina)));
  data.gold = Math.max(0, Math.trunc(data.gold ?? 0));
  data.gems = Math.max(0, Math.trunc(data.gems ?? 0));
  data.stageCleared = Math.max(0, Math.trunc(data.stageCleared));
  data.totalPlayTime = Math.max(0, Math.trunc(data.totalPlayTime));
  data.enhanceStones = Math.max(0, Math.trunc(data.enhanceStones ?? 0));
  // 만료된 버프 및 구조 무효 버프 제거
  const now = Date.now();
  data.activeBuffs = (data.activeBuffs ?? []).filter(b => isValidActiveBuff(b) && b.expiresAt > now);
  // 무효 장비 아이템 제거
  data.equipmentInventory = (data.equipmentInventory ?? []).filter(isValidEquipmentItem);
  // 인벤토리 수량 클램프 (음수 방지)
  if (data.inventory) {
    for (const key of Object.keys(data.inventory)) {
      data.inventory[key] = Math.max(0, Math.trunc(data.inventory[key] ?? 0));
    }
  }
  return data;
}

/**
 * 타입 가드: unknown 데이터가 유효한 SaveData인지 검증합니다.
 * 배열 내부 콘텐츠와 수치 범위까지 검증하여 악성 데이터 주입을 방어합니다.
 */
function isValidSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (!(
    typeof d.version === 'number' &&
    typeof d.level === 'number' &&
    typeof d.exp === 'number' &&
    typeof d.hp === 'number' &&
    typeof d.maxHp === 'number' &&
    typeof d.stamina === 'number' &&
    typeof d.maxStamina === 'number' &&
    Array.isArray(d.equippedSkills) &&
    typeof d.equippedDash === 'string' &&
    typeof d.inventory === 'object' && d.inventory !== null &&
    Array.isArray(d.unlockedSkills) &&
    typeof d.stageCleared === 'number' &&
    typeof d.totalPlayTime === 'number'
  )) return false;

  // 수치 범위 검증
  if (!isFinite(d.level as number) || (d.level as number) < 1) return false;
  if (!isFinite(d.exp as number) || (d.exp as number) < 0) return false;
  if (!isFinite(d.maxHp as number) || (d.maxHp as number) < 1) return false;
  if (!isFinite(d.stageCleared as number) || (d.stageCleared as number) < 0) return false;

  // 배열 원소 타입 검증
  if (!(d.equippedSkills as unknown[]).every(s => typeof s === 'string')) return false;
  if (!(d.unlockedSkills as unknown[]).every(s => typeof s === 'string')) return false;

  // 장비 인벤토리 구조 검증
  if (d.equipmentInventory !== undefined) {
    if (!Array.isArray(d.equipmentInventory)) return false;
    if (!(d.equipmentInventory as unknown[]).every(isValidEquipmentItem)) return false;
  }

  // 버프 구조 검증
  if (d.activeBuffs !== undefined) {
    if (!Array.isArray(d.activeBuffs)) return false;
    if (!(d.activeBuffs as unknown[]).every(isValidActiveBuff)) return false;
  }

  // 인벤토리 값 타입 검증 (키: string, 값: number)
  const inv = d.inventory as Record<string, unknown>;
  if (!Object.values(inv).every(v => typeof v === 'number')) return false;

  return true;
}

/**
 * 세이브 데이터 마이그레이션
 *
 * v1 → v2: gold, expToNext, defeatedBosses, totalKills 필드 추가
 */
function migrateSave(oldData: SaveData): SaveData {
  const migrated: SaveData = {
    ...oldData,
    version: CURRENT_VERSION,
    gold: oldData.gold ?? 0,
    expToNext: oldData.expToNext ?? getExpToNextLevel(oldData.level),
    defeatedBosses: oldData.defeatedBosses ?? [],
    totalKills: oldData.totalKills ?? 0,
    skillLevels: oldData.skillLevels ?? {},
    lastSavedAt: oldData.lastSavedAt ?? Date.now(),
    lastOfflineRewardAt: oldData.lastOfflineRewardAt ?? Date.now(),
    equipmentInventory: oldData.equipmentInventory ?? [],
    equippedItems: oldData.equippedItems ?? {},
    trainingLevels: { attack: 0, hp: 0, gold: 0, speed: 0, stamina: 0, crit: 0, ...(oldData.trainingLevels ?? {}) },
    sectFacilities: oldData.sectFacilities ?? { hall: 1, forge: 1, library: 1 },
    sectResearch: oldData.sectResearch ?? { SWORD: 0, BLADE: 0, FIST: 0, SPEAR: 0 },
    disciples: oldData.disciples ?? [],
    codexUnlocked: oldData.codexUnlocked ?? ['region_1'],
    missionProgress: oldData.missionProgress ?? {},
    missionClaims: oldData.missionClaims ?? [],
    dailyMissionDate: oldData.dailyMissionDate ?? new Date().toLocaleDateString('en-CA'),
    storyRegion: oldData.storyRegion ?? 1,
    tutorialCompleted: oldData.tutorialCompleted ?? false,
    gems: oldData.gems ?? 30,
    shopLastReset: oldData.shopLastReset ?? '',
    shopDailyPurchased: oldData.shopDailyPurchased ?? [],
    rebirthPaths: oldData.rebirthPaths ?? [],
    activeBuffs: oldData.activeBuffs ?? [],
    enhanceStones: oldData.enhanceStones ?? 0,
  };
  // 마이그레이션 후 즉시 저장
  saveGame(migrated);
  return migrated;
}

export function claimOfflineReward(): { gold: number; exp: number; minutes: number } {
  const save = loadGame();
  const now = Date.now();
  const last = save.lastOfflineRewardAt ?? save.lastSavedAt ?? now;
  const minutes = Math.min(480, Math.floor(Math.max(0, now - last) / 60000));

  if (minutes < 3) {
    save.lastOfflineRewardAt = now;
    saveGame(save);
    return { gold: 0, exp: 0, minutes: 0 };
  }

  const waveFactor = Math.max(1, save.stageCleared + 1);
  const rebirthMul = 1 + (save.rebirthCount ?? 0) * 0.15;
  const gold = Math.floor(minutes * (10 + waveFactor * 1.8) * rebirthMul);
  const exp  = Math.floor(minutes * (15 + waveFactor * 2.2) * rebirthMul);

  save.gold += gold;
  save.exp += exp;
  while (save.exp >= save.expToNext) {
    save.exp -= save.expToNext;
    save.level += 1;
    save.expToNext = getExpToNextLevel(save.level);
  }
  save.lastOfflineRewardAt = now;
  saveGame(save);

  return { gold, exp, minutes };
}
