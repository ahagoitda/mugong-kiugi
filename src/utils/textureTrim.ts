import Phaser from 'phaser';

/**
 * 텍스처의 불투명 픽셀 영역(bounding box)을 찾아 'trim' 프레임으로 등록한다.
 *
 * 적/보스 일러스트(512x512)는 캐릭터가 캔버스의 절반 이하만 차지해
 * 그대로 setDisplaySize 하면 실제 보이는 크기가 매우 작아진다.
 * 여백을 제거한 프레임을 만들어두면 표시 크기를 "캐릭터 실측" 기준으로
 * 정확히 제어할 수 있다.
 *
 * @returns trim 프레임 등록 성공 여부
 */
export function addTrimFrame(scene: Phaser.Scene, key: string, alphaThreshold = 12): boolean {
  if (!scene.textures.exists(key)) return false;
  const texture = scene.textures.get(key);
  if (texture.has('trim')) return true;

  const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const width = source.width;
  const height = source.height;
  if (!width || !height) return false;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return false;
  }

  let minX = width, minY = height, maxX = -1, maxY = -1;
  // 2px 간격 샘플링으로 충분히 정확하고 4배 빠르다
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return false;

  // 샘플링 간격/이펙트 가장자리 고려해 약간의 패딩
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  texture.add('trim', 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
  return true;
}
