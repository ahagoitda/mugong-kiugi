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

    // 버전 마이그레이션 (v1 → v2)
    if (parsed.version < CURRENT_VERSION) {
      return migrateSave(parsed);
    }

    return parsed;
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

/**
 * 타입 가드: unknown 데이터가 유효한 SaveData인지 검증합니다.
 *
 * 이 함수는 외부에서 주입될 수 있는 악의적인 데이터를 차단하는
 * 방어적 프로그래밍의 핵심입니다.
 *
 * v1과 v2 모두 허용 (마이그레이션 대상 포함)
 */
function isValidSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  return (
    typeof d.version === 'number' &&
    typeof d.level === 'number' &&
    typeof d.exp === 'number' &&
    typeof d.hp === 'number' &&
    typeof d.maxHp === 'number' &&
    typeof d.stamina === 'number' &&
    typeof d.maxStamina === 'number' &&
    Array.isArray(d.equippedSkills) &&
    typeof d.equippedDash === 'string' &&
    typeof d.inventory === 'object' &&
    d.inventory !== null &&
    Array.isArray(d.unlockedSkills) &&
    typeof d.stageCleared === 'number' &&
    typeof d.totalPlayTime === 'number'
  );
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
