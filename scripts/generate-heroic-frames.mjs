#!/usr/bin/env node
/**
 * 컷인 일러스트 → 12프레임 그린스크린 시퀀스 생성
 *
 * sword_male 참조 시퀀스의 타이밍(anticipation 0-1, action 2-8, recovery 9-11)을
 * 무기별 모션 프로파일로 재현한다. 컷인 원본에서 어두운 배경을 제거하고
 * #00FF00 크로마키 위에 프레임별 변환을 적용한다.
 *
 * 사용: node scripts/generate-heroic-frames.mjs
 */
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MOTIONS_DIR = path.join(ROOT, 'assets_src/illustrations/heroic_illustrations/motions');
const FRAME_W = 256;
const FRAME_H = 384;
const FRAME_COUNT = 12;
const GREEN = { r: 0, g: 255, b: 0 };

/** 12프레임 모션 키프레임: rot(deg), tx, ty, scale, skewX */
function buildProfile(style) {
  const curves = {
    sword: [
      [0, 0, 8, 0.94, 0], [4, -2, 6, 0.96, 0],
      [-6, -4, 2, 0.98, -2], [-14, -8, -2, 1.0, -4], [-22, -12, -6, 1.02, -6],
      [-28, -16, -8, 1.04, -8], [-24, -10, -4, 1.03, -6], [-16, -4, 0, 1.0, -3],
      [-8, 2, 4, 0.98, -1], [0, 4, 8, 0.96, 0], [4, 2, 10, 0.95, 0], [2, 0, 8, 0.94, 0],
    ],
    dao: [
      [0, 0, 6, 0.95, 0], [6, 4, 4, 0.97, 3],
      [12, 10, 0, 1.0, 6], [20, 16, -4, 1.03, 10], [28, 22, -8, 1.05, 14],
      [32, 26, -10, 1.06, 16], [24, 18, -6, 1.04, 12], [14, 8, -2, 1.0, 6],
      [4, 0, 4, 0.97, 2], [-2, -2, 8, 0.95, 0], [0, 0, 6, 0.94, 0], [2, 2, 5, 0.95, 1],
    ],
    fist: [
      [0, 0, 4, 0.96, 0], [2, 2, 2, 0.98, 1],
      [8, 6, -2, 1.02, 3], [16, 12, -6, 1.06, 5], [22, 18, -8, 1.08, 6],
      [18, 14, -4, 1.05, 4], [10, 6, 0, 1.0, 2], [4, 2, 2, 0.98, 1],
      [0, 0, 4, 0.96, 0], [-2, -2, 6, 0.95, 0], [0, 0, 4, 0.94, 0], [1, 0, 3, 0.95, 0],
    ],
    spear: [
      [0, 0, 6, 0.94, 0], [-4, -2, 4, 0.96, -2],
      [-10, -6, 0, 0.98, -4], [-6, 4, -8, 1.02, -2], [0, 12, -14, 1.06, 0],
      [4, 18, -18, 1.08, 2], [2, 14, -12, 1.05, 1], [0, 8, -6, 1.0, 0],
      [-2, 2, 0, 0.98, -1], [-4, 0, 4, 0.96, -2], [0, 0, 6, 0.94, 0], [-1, 0, 5, 0.94, -1],
    ],
  };
  return curves[style] ?? curves.sword;
}

const SEQUENCES = [
  { char: 'sword_female', skill: 'samjae', style: 'sword' },
  { char: 'sword_female', skill: 'maehwa', style: 'sword' },
  { char: 'sword_female', skill: 'changung', style: 'sword' },
  { char: 'dao_male', skill: 'baldo', style: 'dao' },
  { char: 'dao_female', skill: 'gwangpung', style: 'dao' },
  { char: 'dao_female', skill: 'paewang', style: 'dao' },
  { char: 'fist_male', skill: 'taejo', style: 'fist' },
  { char: 'fist_male', skill: 'yeorae', style: 'fist' },
  { char: 'fist_female', skill: 'yeonhwante', style: 'fist' },
  { char: 'spear_male', skill: 'yongchang', style: 'spear' },
  { char: 'spear_male', skill: 'cheonha', style: 'spear' },
  { char: 'spear_female', skill: 'hoeseon', style: 'spear' },
];

function removeDarkBackground(rgba, width, height) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < width * height; i++) {
    const r = out[i * 4];
    const g = out[i * 4 + 1];
    const b = out[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    if (lum < 28 || (lum < 55 && sat < 0.25)) {
      out[i * 4 + 3] = 0;
    }
  }
  return out;
}

async function loadSubject(cutinPath) {
  const { data, info } = await sharp(cutinPath)
    .resize(Math.round(FRAME_W * 0.92), Math.round(FRAME_H * 0.88), { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = removeDarkBackground(data, info.width, info.height);
  return sharp(keyed, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function renderFrame(subjectPng, profile, frameIndex) {
  const [rot, tx, ty, scale, skewX] = profile[frameIndex];
  const meta = await sharp(subjectPng).metadata();
  const sw = meta.width;
  const sh = meta.height;
  const scaledW = Math.round(sw * scale);
  const scaledH = Math.round(sh * scale);

  let img = sharp(subjectPng).resize(scaledW, scaledH, { fit: 'fill' });
  if (rot !== 0) img = img.rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const transformed = await img.png().toBuffer();

  const fitted = await sharp(transformed)
    .resize(FRAME_W, FRAME_H, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const tMeta = await sharp(fitted).metadata();
  const tw = tMeta.width ?? FRAME_W;
  const th = tMeta.height ?? FRAME_H;
  const cx = Math.round(FRAME_W / 2 + tx);
  const cy = Math.round(FRAME_H * 0.58 + ty);
  const left = PhaserMathClamp(cx - Math.round(tw / 2), 0, FRAME_W - tw);
  const top = PhaserMathClamp(cy - Math.round(th / 2), 0, FRAME_H - th);

  return sharp({
    create: { width: FRAME_W, height: FRAME_H, channels: 3, background: GREEN },
  })
    .composite([{ input: fitted, left, top }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

function PhaserMathClamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

async function generateSequence({ char, skill, style }) {
  const dirName = `${char}_${skill}`;
  const outDir = path.join(MOTIONS_DIR, dirName);
  const cutinPath = path.join(MOTIONS_DIR, `${dirName}.jpg`);
  if (!existsSync(cutinPath)) {
    console.warn(`  ! 컷인 없음: ${cutinPath}`);
    return false;
  }

  mkdirSync(outDir, { recursive: true });
  const profile = buildProfile(style);
  const subject = await loadSubject(cutinPath);

  for (let f = 0; f < FRAME_COUNT; f++) {
    const frameBuf = await renderFrame(subject, profile, f);
    const outFile = path.join(outDir, `${dirName}_f${String(f).padStart(2, '0')}.jpg`);
    await sharp(frameBuf).toFile(outFile);
  }

  console.log(`  ✓ ${dirName} (12 frames, style=${style})`);
  return true;
}

console.log('heroic 12프레임 시퀀스 생성:');
let ok = 0;
for (const seq of SEQUENCES) {
  if (await generateSequence(seq)) ok++;
}
console.log(`완료: ${ok}/${SEQUENCES.length} 시퀀스`);