import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ORIGINALS_DIR = './public/sprites/originals';
const RUNTIME_DIR = './public/sprites/generated/runtime';

// Ensure runtime directory exists
if (!fs.existsSync(RUNTIME_DIR)) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

/**
 * Chroma keying using custom pixel operation.
 * Removes green or black background and applies edge smoothing.
 */
async function processImage(inputPath, outputPath, options = {}) {
  const {
    type = 'none', // 'green', 'black', 'none'
    width = null,
    height = null,
    format = 'png', // 'png' or 'webp'
    cropToBottom = false // If true, fit with bottom gravity
  } = options;

  try {
    let sh = sharp(inputPath);
    const metadata = await sh.metadata();
    
    // Resize if requested
    if (width || height) {
      if (cropToBottom) {
        sh = sh.resize(width, height, {
          fit: 'cover',
          position: 'bottom'
        });
      } else {
        sh = sh.resize(width, height, {
          fit: 'cover'
        });
      }
    }

    if (type === 'none') {
      // No chroma keying needed, just convert format and save
      if (format === 'webp') {
        await sh.webp({ quality: 85 }).toFile(outputPath);
      } else {
        await sh.png().toFile(outputPath);
      }
      console.log(`[Success] Processed (No-Key) -> ${outputPath}`);
      return;
    }

    // Get raw pixel data (RGBA)
    const { data, info } = await sh.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const pixelCount = w * h;

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (type === 'green') {
        // Green screen keying
        // Smooth transition based on green dominance
        const maxRB = Math.max(r, b);
        const greenDominance = g - maxRB;

        if (greenDominance > 45) {
          // Fully transparent
          data[idx + 3] = 0;
        } else if (greenDominance > 15) {
          // Semi-transparent edge smoothing
          const blend = (greenDominance - 15) / 30; // 0.0 to 1.0
          data[idx + 3] = Math.round(a * (1 - blend));
          
          // Desaturate green edge to remove green spill/halo
          data[idx] = Math.round(r * 0.8 + maxRB * 0.2);
          data[idx + 1] = maxRB;
          data[idx + 2] = Math.round(b * 0.8 + maxRB * 0.2);
        }
      } else if (type === 'black') {
        // Black screen keying
        const maxVal = Math.max(r, g, b);

        if (maxVal < 25) {
          // Fully transparent
          data[idx + 3] = 0;
        } else if (maxVal < 60) {
          // Semi-transparent edge smoothing
          const blend = (maxVal - 25) / 35; // 0.0 to 1.0
          data[idx + 3] = Math.round(a * blend);
        }
      }
    }

    // Write raw data back to sharp and save
    let resultImg = sharp(data, {
      raw: {
        width: w,
        height: h,
        channels: 4
      }
    });

    if (format === 'webp') {
      await resultImg.webp({ quality: 85 }).toFile(outputPath);
    } else {
      await resultImg.png().toFile(outputPath);
    }
    console.log(`[Success] Processed (${type}-key) -> ${outputPath}`);

  } catch (err) {
    console.error(`[Error] Failed processing ${inputPath}:`, err.message);
  }
}

// Read directory and process assets sequentially
async function main() {
  const args = process.argv.slice(2);
  const targetFile = args[0]; // If specified, only process this file
  
  if (targetFile) {
    const inputPath = path.join(ORIGINALS_DIR, targetFile);
    if (!fs.existsSync(inputPath)) {
      console.error(`Target file not found: ${inputPath}`);
      return;
    }
    await autoProcessFile(targetFile);
    return;
  }

  if (!fs.existsSync(ORIGINALS_DIR)) {
    console.log(`Originals directory does not exist yet. Creating: ${ORIGINALS_DIR}`);
    fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
    return;
  }

  const files = fs.readdirSync(ORIGINALS_DIR);
  console.log(`Found ${files.length} original assets to process.`);
  
  for (const file of files) {
    await autoProcessFile(file);
  }
}

async function autoProcessFile(file) {
  const inputPath = path.join(ORIGINALS_DIR, file);
  
  // 1. Parallax backgrounds
  // Format: region_{id}_{bg|mg|fg}.webp or png
  if (file.startsWith('region_') && (file.endsWith('.png') || file.endsWith('.webp') || file.endsWith('.jpg'))) {
    const parts = file.split('_');
    const id = parts[1]; // e.g. '01'
    const layerPart = parts[2]; // e.g. 'bg.png'
    const layer = layerPart.split('.')[0]; // 'bg', 'mg', 'fg'
    
    const outName = `region_${id}_${layer}.webp`;
    const outputPath = path.join(RUNTIME_DIR, outName);
    
    if (layer === 'bg') {
      // Backlayer background (sky/mountains) - no keying
      await processImage(inputPath, outputPath, {
        type: 'none',
        width: 1024,
        height: 1024, // Background is tileSprite, square is good
        format: 'webp'
      });
    } else if (layer === 'mg') {
      // Middleground - green-key or black-key (usually green screen)
      await processImage(inputPath, outputPath, {
        type: 'green',
        width: 1024,
        height: 1024,
        format: 'webp'
      });
    } else if (layer === 'fg') {
      // Foreground - green-key, crop bottom
      await processImage(inputPath, outputPath, {
        type: 'green',
        width: 1024,
        height: 1024,
        format: 'webp',
        cropToBottom: true
      });
    }
  }
  
  // 2. Hero set skin illustrations
  // Format: hero_set_{class}_blood_set_{set_id}.png
  else if (file.startsWith('hero_set_') && file.endsWith('.png')) {
    const outputPath = path.join(RUNTIME_DIR, file);
    await processImage(inputPath, outputPath, {
      type: 'green', // Green background default for heroes
      width: 512,
      height: 512,
      format: 'png'
    });
  }
  
  // 3. NPC Illustrations
  // Format: npc_*.png
  else if (file.startsWith('npc_') && file.endsWith('.png')) {
    const outputPath = path.join(RUNTIME_DIR, file);
    await processImage(inputPath, outputPath, {
      type: 'green',
      width: 512,
      height: 512,
      format: 'png'
    });
  }
  
  // 4. UI Frames
  // Format: ui_*.png
  else if (file.startsWith('ui_') && file.endsWith('.png')) {
    const outputPath = path.join(RUNTIME_DIR, file);
    // UI cards/frames are usually created on black screens or green screens
    // If card frame, we typically key out the center black area or green area
    const keyType = file.includes('card') ? 'black' : 'green';
    await processImage(inputPath, outputPath, {
      type: keyType,
      format: 'png'
    });
  }
}

main().catch(err => console.error("Global Error:", err));
