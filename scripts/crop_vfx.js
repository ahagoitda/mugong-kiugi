import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = 'public/sprites/generated/combat-motions-mockup-v2.png';
const OUT_DIR = 'public/sprites/generated/runtime';

async function cropVfx() {
  try {
    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    const cols = 6;
    const rows = 4;
    const cellW = 256;
    const cellH = 256;

    const bgR = 27;
    const bgG = 28;
    const bgB = 27;

    const image = sharp(SRC);
    const metadata = await image.metadata();
    console.log('Src dimensions:', metadata.width, 'x', metadata.height);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col + 1;
        const vfxKey = `combat_vfx_${String(index).padStart(2, '0')}`;
        const outPath = path.join(OUT_DIR, `${vfxKey}.png`);

        const left = col * cellW;
        const top = row * cellH;

        // Crop the cell
        const cellRaw = await image
          .clone()
          .extract({ left, top, width: cellW, height: cellH })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const data = cellRaw.data;
        const width = cellRaw.info.width;
        const height = cellRaw.info.height;

        // Process pixels to remove the background
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];

          // Distance from the background dark color (27, 28, 27)
          const dist = Math.sqrt((r - bgR)**2 + (g - bgG)**2 + (b - bgB)**2);

          let alpha = 0;
          if (dist > 15) {
            // Smooth transition: if distance is between 15 and 45, interpolate alpha
            alpha = Math.min(255, Math.round((dist - 15) * 8.5));
          }

          // If alpha is 0, we can zero out the RGB channels too
          if (alpha === 0) {
            data[i] = 0;
            data[i+1] = 0;
            data[i+2] = 0;
          } else {
            // We can also subtract background color to clean up borders, or keep it.
            // Let's slightly clean up dark edges
            const factor = alpha / 255;
            data[i] = Math.min(255, Math.max(0, Math.round((r - bgR * (1 - factor)))));
            data[i+1] = Math.min(255, Math.max(0, Math.round((g - bgG * (1 - factor)))));
            data[i+2] = Math.min(255, Math.max(0, Math.round((b - bgB * (1 - factor)))));
          }

          data[i+3] = alpha;
        }

        // Save as PNG
        await sharp(data, { raw: { width, height, channels: 4 } })
          .png()
          .toFile(outPath);

        console.log(`Saved ${vfxKey}.png`);
      }
    }
    console.log('All 24 combat VFX cropped successfully!');
  } catch (err) {
    console.error('Error cropping VFX:', err);
  }
}

cropVfx();
