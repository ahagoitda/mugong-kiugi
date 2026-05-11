/**
 * ObjectPool<T> - 제네릭 오브젝트 풀
 *
 * 왜 오브젝트 풀링이 필요한가?
 * - JavaScript의 가비지 컬렉터(GC)는 메모리를 해제할 때 프레임을 멈춥니다.
 * - 적, 투사체, 이펙트를 매번 new/destroy 하면 GC가 자주 발동합니다.
 * - 풀링은 객체를 재사용하여 GC 발동 자체를 차단합니다.
 *
 * 사용 예:
 *   const pool = new ObjectPool(() => new Bullet(), 50);
 *   const bullet = pool.acquire();  // 풀에서 꺼냄
 *   pool.release(bullet);           // 풀에 반환
 *
 * 메모리 누수 방지:
 * - maxSize로 풀 크기를 제한하여 무한 증식을 방지합니다.
 * - destroy() 메서드로 풀 전체를 정리할 수 있습니다.
 */
export class ObjectPool<T> {
  private readonly pool: T[] = [];
  private readonly factory: () => T;
  private readonly resetFn: (obj: T) => void;
  private readonly maxSize: number;

  constructor(
    factory: () => T,
    maxSize: number,
    resetFn: (obj: T) => void = () => {},
  ) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.resetFn = resetFn;
  }

  /**
   * 풀에서 객체를 꺼냅니다.
   * 풀이 비어있으면 새로 생성합니다.
   */
  acquire(): T {
    const obj = this.pool.pop();
    if (obj !== undefined) {
      return obj;
    }
    return this.factory();
  }

  /**
   * 객체를 풀에 반환합니다.
   * maxSize를 초과하면 반환하지 않습니다 (GC에 맡김).
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  /**
   * 풀을 비우고 모든 참조를 해제합니다.
   */
  destroy(): void {
    this.pool.length = 0;
  }

  /** 현재 풀에 대기 중인 객체 수 */
  get available(): number {
    return this.pool.length;
  }
}
