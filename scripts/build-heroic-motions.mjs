#!/usr/bin/env node
/**
 * 고품질 heroic 크로마키 모션 → 게임용 스프라이트시트 변환 스크립트
 *
 * 입력:
 *  - public/sprites/illustrations/heroic_illustrations/motions/<hero>_<skill>/<hero>_<skill>_fNN.jpg
 *    (그린 스크린 #00FF00, 12프레임 시퀀스)
 *  - public/sprites/illustrations/heroic_illustrations/motions/<hero>_<skill>.jpg
 *    (어두운 배경 단일 컷인 일러스트)
 *
 * 출력 (public/sprites/generated/runtime/):
 *  - heroic_<hero>_<skill>.png  : 가로 12프레임 스프라이트시트 (그린 키아웃 + 투명 알파, 256x384/frame)
 *  - cutin_<hero>_<skill>.webp  : 스킬 컷인용 다운스케일 일러스트 (360px 폭)
 *
 * 사용: node scripts/build-heroic-motions.mjs
 *
 * 새 캐릭터/무공 시퀀스가 추가되면 SEQUENCES / CUTINS에 항목을 추가하고
 * 다시 실행한 뒤, src/data/heroicMotions.ts 의 매니페스트도 함께 갱신할 것.
 * (주의: motions/ 하위의 *_12frame_grid.jpg 중 일부는 0바이트/텍스트 스텁이므로
 *  실제 이미지가 채워진 시퀀스만 여기 등록한다)
 */
import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MOTIONS_DIR = path.join(ROOT, 'public/sprites/illustrations/heroic_illustrations/motions');
const OUT_DIR = path.join(ROOT, 'public/sprites/generated/runtime');

const FRAME_W = 256;
const FRAME_H = 384;
const FRAME_COUNT = 12;

/** 12프레임 그린스크린 시퀀스 (폴더에 실제 이미지 프레임이 있는 것만) */
const SEQUENCES = [
  { char: 'sword_male', skill: 'samjae', dir: 'sword_male_samjae' },
  { char: 'sword_male', skill: 'maehwa', dir: 'sword_male_maehwa' },
  { char: 'sword_male', skill: 'changung', dir: 'sword_male_changung' },
];

/** 단일 컷인 일러스트 (어두운 배경, 키잉 불필요) */
const CUTINS = [
  { char: 'sword_female', skill: 'samjae', file: 'sword_female_samjae.jpg' },
  { char: 'sword_female', skill: 'maehwa', file: 'sword_female_maehwa.jpg' },
  { char: 'sword_female', skill: 'changung', file: 'sword_female_changung.jpg' },
  { char: 'dao_male', skill: 'baldo', file: 'dao_male_baldo.jpg' },
  { char: 'dao_female', skill: 'gwangpung', file: 'dao_female_gwangpung.jpg' },
  { char: 'dao_female', skill: 'paewang', file: 'dao_female_paewang.jpg' },
  { char: 'fist_male', skill: 'taejo', file: 'fist_male_taejo.jpg' },
  { char: 'fist_male', skill: 'yeorae', file: 'fist_male_yeorae.jpg' },
  { char: 'fist_female', skill: 'yeonhwante', file: 'fist_female_yeonhwante.jpg' },
  { char: 'spear_male', skill: 'yongchang', file: 'spear_male_yongchang.jpg' },
  { char: 'spear_male', skill: 'cheonha', file: 'spear_male_cheonha.jpg' },
  { char: 'spear_female', skill: 'hoeseon', file: 'spear_female_hoeseon.jpg' },
];

/**
 * 그린스크린 키아웃.
 * 초록 우세 픽셀을 투명 처리하고, 경계의 그린 스필은 g 채널을 눌러서 제거한다.
 */
function chromaKeyGreen(rgba, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];

    // 초록 우세도: g가 r/b 평균보다 얼마나 큰가
    const dominance = g - Math.max(r, b);

    let alpha = 255;
    if (dominance > 90 && g > 120) {
      alpha = 0; // 완전한 그린 스크린
    } else if (dominance > 40 && g > 100) {
      // 경계부: 우세도에 비례해 부드럽게 투명화
      alpha = Math.round(255 * (1 - (dominance - 40) / 50));
    }

    out[i * 4] = r;
    // 그린 스필 억제: 남는 픽셀의 g를 r/b 수준으로 클램프
    out[i * 4 + 1] = alpha < 255 ? Math.min(g, Math.round((r + b) / 2)) : g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = alpha;
  }
  return out;
}

async function buildSequence({ char, skill, dir }) {
  const frames = [];
  for (let f = 0; f < FRAME_COUNT; f++) {
    const file = path.join(MOTIONS_DIR, dir, `${dir}_f${String(f).padStart(2, '0')}.jpg`);
    if (!existsSync(file) || statSync(file).size < 10_000) {
      console.warn(`  ! 프레임 누락/스텁: ${file} — 시퀀스 건너뜀`);
      return false;
    }
    frames.push(file);
  }

  const composites = [];
  for (let f = 0; f < FRAME_COUNT; f++) {
    const { data, info } = await sharp(frames[f])
      .resize(FRAME_W, FRAME_H, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const keyed = chromaKeyGreen(data, info.width, info.height);
    composites.push({
      input: await sharp(keyed, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toBuffer(),
      left: f * FRAME_W,
      top: 0,
    });
  }

  const outFile = path.join(OUT_DIR, `heroic_${char}_${skill}.png`);
  await sharp({
    create: {
      width: FRAME_W * FRAME_COUNT,
      height: FRAME_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outFile);
  console.log(`  ✓ ${path.relative(ROOT, outFile)}`);
  return true;
}

async function buildCutin({ char, skill, file }) {
  const src = path.join(MOTIONS_DIR, file);
  if (!existsSync(src) || statSync(src).size < 10_000) {
    console.warn(`  ! 컷인 누락/스텁: ${src} — 건너뜀`);
    return false;
  }
  const outFile = path.join(OUT_DIR, `cutin_${char}_${skill}.webp`);
  await sharp(src).resize(360, 540, { fit: 'cover' }).webp({ quality: 82 }).toFile(outFile);
  console.log(`  ✓ ${path.relative(ROOT, outFile)}`);
  return true;
}

await mkdir(OUT_DIR, { recursive: true });
console.log('heroic 12프레임 시퀀스 변환:');
for (const seq of SEQUENCES) await buildSequence(seq);
console.log('컷인 일러스트 변환:');
for (const cut of CUTINS) await buildCutin(cut);
console.log('완료');
