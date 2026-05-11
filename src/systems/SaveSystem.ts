import type { SaveData } from '../data/types';

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

const SAVE_KEY = 'mugong_save_v1';
const CURRENT_VERSION = 1;

/**
 * 기본 세이브 데이터를 생성합니다.
 * 새 게임 시작 시 사용됩니다.
 */
export function createDefaultSave(): SaveData {
  return {
    version: CURRENT_VERSION,
    level: 1,
    exp: 0,
    hp: 100,
    maxHp: 100,
    stamina: 50,
    maxStamina: 50,
    equippedSkills: ['samjae'],
    equippedDash: 'chosangbi',
    inventory: { samjae: 1, chosangbi: 1 },
    unlockedSkills: ['samjae', 'chosangbi'],
    stageCleared: 0,
    totalPlayTime: 0,
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

    // 버전 마이그레이션 (향후 확장)
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
 * 세이브 데이터 마이그레이션 (향후 버전 업 시 사용)
 */
function migrateSave(oldData: SaveData): SaveData {
  // 현재는 v1만 존재하므로 그대로 반환
  return { ...oldData, version: CURRENT_VERSION };
}
