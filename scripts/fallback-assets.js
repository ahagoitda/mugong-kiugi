import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BRAIN_DIR = 'C:/Users/ahago/.gemini/antigravity/brain/afe7f6a1-bbce-4999-9c0f-d8ee0f033950';
const ORIGINALS_DIR = './public/sprites/originals';
const RUNTIME_DIR = './public/sprites/generated/runtime';

if (!fs.existsSync(ORIGINALS_DIR)) {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
}

async function copyGeneratedImages() {
  const brainFiles = fs.readdirSync(BRAIN_DIR);
  console.log(`Scanning brain directory for generated images...`);

  // Target map to keep track of latest generated file for each name
  const latestFiles = {};

  for (const file of brainFiles) {
    if (file.endsWith('.png')) {
      // e.g., region_01_bg_1780547377855.png
      const match = file.match(/^(.+)_(\d+)\.png$/);
      if (match) {
        const baseName = match[1]; // region_01_bg
        const timestamp = parseInt(match[2], 10);
        
        if (!latestFiles[baseName] || latestFiles[baseName].timestamp < timestamp) {
          latestFiles[baseName] = { file, timestamp };
        }
      }
    }
  }

  // Copy found generated files
  for (const [baseName, info] of Object.entries(latestFiles)) {
    const srcPath = path.join(BRAIN_DIR, info.file);
    const destPath = path.join(ORIGINALS_DIR, `${baseName}.png`);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied actual asset: ${info.file} -> ${destPath}`);
  }
}

async function generateFallbacks() {
  console.log(`Generating fallback assets for non-generated ones...`);

  // 1. Foreground layers fallback (region_02_fg to region_08_fg)
  const fgSource = path.join(ORIGINALS_DIR, 'region_01_fg.png');
  if (fs.existsSync(fgSource)) {
    for (let i = 2; i <= 8; i++) {
      const dest = path.join(ORIGINALS_DIR, `region_0${i}_fg.png`);
      fs.copyFileSync(fgSource, dest);
      console.log(`Fallback: Cloned region_01_fg to ${dest}`);
    }
  } else {
    // If somehow even region_01_fg is missing, create a blank green image
    const blankGreen = await sharp({
      create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } }
    }).png().toBuffer();
    
    for (let i = 1; i <= 8; i++) {
      const dest = path.join(ORIGINALS_DIR, `region_0${i}_fg.png`);
      fs.writeFileSync(dest, blankGreen);
      console.log(`Fallback: Created blank green region_0${i}_fg.png`);
    }
  }

  // 2. Hero skin sets 32 images fallback
  // Classes: sword, dao, fist, spear. Sets: blood_set_1 to blood_set_8
  const classes = ['sword', 'dao', 'fist', 'spear'];
  for (const cls of classes) {
    // Find representative base image
    const baseHeroFile = `hero_${cls}_male.png`;
    const baseHeroPath = path.join(RUNTIME_DIR, baseHeroFile);
    
    let fallbackBuffer;
    if (fs.existsSync(baseHeroPath)) {
      // Load base hero, apply green background to it so the sharp keying script handles it correctly
      fallbackBuffer = await sharp(baseHeroPath)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 255, b: 0, alpha: 1 } })
        .flatten({ background: { r: 0, g: 255, b: 0 } }) // force green background
        .png()
        .toBuffer();
      console.log(`Fallback: Prepared base hero skin template from ${baseHeroFile}`);
    } else {
      // Fallback to blank green if runtime hero doesn't exist
      fallbackBuffer = await sharp({
        create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } }
      }).png().toBuffer();
    }

    for (let s = 1; s <= 8; s++) {
      const dest = path.join(ORIGINALS_DIR, `hero_set_${cls}_blood_set_${s}.png`);
      fs.writeFileSync(dest, fallbackBuffer);
    }
    console.log(`Fallback: Generated 8 skin sets for class: ${cls}`);
  }

  // 3. NPC 5 images fallback
  const existingNpc = './public/sprites/npc_jeomsoyi.png';
  let npcBuffer;
  if (fs.existsSync(existingNpc)) {
    npcBuffer = await sharp(existingNpc)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 255, b: 0, alpha: 1 } })
      .flatten({ background: { r: 0, g: 255, b: 0 } })
      .png()
      .toBuffer();
    console.log(`Fallback: Prepared NPC template from ${existingNpc}`);
  } else {
    npcBuffer = await sharp({
      create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } }
    }).png().toBuffer();
  }

  const npcs = ['jeomsoyi', 'master', 'blacksmith', 'merchant', 'innkeeper'];
  for (const npc of npcs) {
    const dest = path.join(ORIGINALS_DIR, `npc_${npc}.png`);
    fs.writeFileSync(dest, npcBuffer);
  }
  console.log(`Fallback: Generated 5 NPC images`);

  // 4. UI 9 images fallback (translucent dark panels and borders)
  const cardBorder = await sharp({
    create: { width: 220, height: 310, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
  }).png().toBuffer(); // black screen for card frame keying
  
  const uiBorders = ['common', 'rare', 'epic', 'legend'];
  for (const border of uiBorders) {
    const dest = path.join(ORIGINALS_DIR, `ui_card_${border}.png`);
    fs.writeFileSync(dest, cardBorder);
  }
  console.log(`Fallback: Generated 4 card frames`);

  const greenPanel = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } }
  }).png().toBuffer(); // green screen for panels

  const dialogs = ['ui_dialog_bg', 'ui_boss_warn_border', 'ui_frame_dragon', 'ui_frame_tiger', 'ui_panel_bg'];
  for (const dlg of dialogs) {
    const dest = path.join(ORIGINALS_DIR, `${dlg}.png`);
    fs.writeFileSync(dest, greenPanel);
  }
  console.log(`Fallback: Generated 5 dialog frames`);
}

async function run() {
  await copyGeneratedImages();
  await generateFallbacks();
  console.log("All originals assets populated successfully (actual + fallback)!");
}

run().catch(console.error);
