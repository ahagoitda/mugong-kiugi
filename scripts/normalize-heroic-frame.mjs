#!/usr/bin/env node
/**
 * Post-process AI generated heroic frame:
 * - Resize to gold standard source res 832x1248 (2:3)
 * - High quality JPG
 */
import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const TARGET_W = 832;
const TARGET_H = 1248;
const JPG_QUALITY = 92;

async function normalize(inputPath, outputPath) {
  if (!existsSync(inputPath)) {
    console.error('Input not found:', inputPath);
    process.exit(1);
  }
  await sharp(inputPath)
    .resize(TARGET_W, TARGET_H, {
      fit: 'cover',
      position: 'center',
      background: { r: 0, g: 255, b: 0, alpha: 1 }
    })
    .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
    .toFile(outputPath);
  const size = statSync(outputPath).size;
  console.log(`Normalized: ${path.basename(outputPath)} (${TARGET_W}x${TARGET_H}, ${Math.round(size/1024)}KB)`);
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/normalize-heroic-frame.mjs <input.png|jpg> <output.jpg>');
  process.exit(1);
}
normalize(input, output).catch(err => { console.error(err); process.exit(1); });
