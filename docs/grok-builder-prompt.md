# Grok Builder Prompt: Heroic Animations + Combat System Implementation

## Context

This repo is a Korean idle RPG game (무공 키우기) built in Phaser 3. Recent analysis (docs/combat-progression-analysis.md) identified:
- 7 design issues in progression curves
- 5 concrete system adjustments needed
- 8 characters with only sword_male having complete heroic animations (3/3 skills done, 7 chars need 0-3 sequences each)

Your task: **Generate remaining 21+ chromakey animation sequences AND implement game system fixes per the analysis report.**

---

## Part 1: Chromakey Animation Sequence Generation

### Goal
Complete all 8 character heroic animations with consistent visual quality and style matching existing sword_male sequences.

### Technical Specs

**Format:**
- 12-frame grid, each frame 256×384px
- Green screen (#00FF00 chroma key)
- JPG input → processed by `scripts/build-heroic-motions.mjs` → WebP output (256×384×12 horizontal spritesheet)
- Save JPG files to `assets_src/illustrations/heroic_illustrations/motions/<char>_<skill>/`

**Visual Requirements:**
- Sword_male reference: 3 existing sequences (samjae, maehwa, changung) show consistent tall frames with upper-body focus, martial stance, flowing robes
- Anticipation frame 0-1, main action frames 2-8, recovery frames 9-11
- Natural motion with follow-through (sleeves/fabric lag, weapon swing arc)
- Bright green background consistent throughout sequence
- Character should occupy ~70-80% of frame height (tall, vertical emphasis)

**Characters & Skills (21 sequences total):**
```
sword_female: samjae, maehwa, changung (3 skills)
dao_male: baldo (1 skill)
dao_female: gwangpung, paewang (2 skills)
fist_male: taejo, yeorae (2 skills)
fist_female: yeonhwante (1 skill)
spear_male: yongchang, cheonha (2 skills)
spear_female: hoeseon (1 skill)
```

**Styling by Weapon Type:**
- Sword (female variant): Longer flowing robes, more graceful arc motion, similar to male version
- Dao (saber/broadsword): Horizontal sweeping arcs, more aggressive stance
- Fist (hand-to-hand): Compact motion, explosive energy, close-range strikes with body twist
- Spear: Vertical/diagonal thrusts, extended reach, spinning motion elements

**File Structure:**
```
assets_src/illustrations/heroic_illustrations/motions/
  sword_female_samjae/
    sword_female_samjae_f00.jpg  (frame 0)
    sword_female_samjae_f01.jpg
    ...
    sword_female_samjae_f11.jpg  (frame 11)
  dao_male_baldo/
    ...
  [etc for all 21 sequences]
```

**Validation:**
- Run `node scripts/build-heroic-motions.mjs` after adding sequences to ensure successful WebP conversion
- Update `src/data/heroicMotions.ts` HEROIC_MOTION_SEQUENCES array with new entries (following sword_male pattern)
- Start game, pick character, use skill to visually verify animation plays

---

## Part 2: Game System Modifications

Implement these 5 key fixes from `docs/combat-progression-analysis.md` (Section 4, Recommendations).

### 1. Enemy Damage Rebalance
**File:** `src/data/enemies.ts` / function `minionStats(wave)`

**Current:**
```typescript
const dmg = (4 + Math.floor(n * 1.2)) * (1 + (wave - 1) * 0.012) * ENEMY_DMG_MUL;
// where ENEMY_DMG_MUL = 0.12
```

**Change:**
- Increase `ENEMY_DMG_MUL` from `0.12` → `0.25`
- Add region cycle scaling: `dmgMul = 1 + Math.floor((wave - 1) / 40) * 0.3` (every 40 waves, +30% damage)
- Formula becomes: `(4 + Math.floor(n * 1.2)) * (1 + (wave - 1) * 0.012) * 0.25 * (1 + Math.floor((wave - 1) / 40) * 0.3)`

**Intent:** Minions become threatening around wave 10+, motivate evade skill usage (currently irrelevant).

---

### 2. Boss Difficulty Curve Smoothing
**File:** `src/data/enemies.ts` / function `bossStats(wave)`

**Current (wave 50+):**
```typescript
if (wave > 50) {
  const cycles = Math.floor((wave - 50) / 40);
  hpMul = 1 + cycles * 0.8;      // +80% per 40-wave cycle → cliff at wave 90
  dmgMul = 1 + cycles * 0.5;
}
```

**Change to continuous scaling:**
```typescript
if (wave > 50) {
  hpMul = 1 + (wave - 50) * 0.02;  // +2% per wave above 50
  dmgMul = 1 + (wave - 50) * 0.01; // +1% per wave above 50
}
```

**Before:** Wave 90 boss has hpMul = 1.8 (sudden cliff). After: smooth curve.
**Intent:** Eliminate the wave 90 wall where even active players hit TTK > TTD.

---

### 3. Evade Stat Cap Increase
**File:** `src/data/skills.ts` / `skillExp()` function or player evade calculation

**Current:** Evade caps at 70% at level 22 (formula: `0.18 + (lv - 1) * 0.025`)
- Level 22: `0.18 + 21 * 0.025 = 0.705` → hard caps at 0.7

**Change:**
- Level cap remains unlimited, but evade caps at 50% from base formula
- Add equipment/training bonus: Training Health lv can grant +2% evade per level (new training path)
- Max reachable: 50% base + 20% from training = 70% (same end state, but progression extends to later)

**Implementation:**
```typescript
// In BattleScene.calculateEvade() or similar:
const baseEvade = Math.min(0.50, 0.18 + (level - 1) * 0.025);
const trainingBonus = Math.min(0.20, trainingHealth * 0.02);
const equipmentBonus = 0.05; // set bonus from late equipment
const totalEvade = Math.min(0.70, baseEvade + trainingBonus + equipmentBonus);
```

**Intent:** Extend late-game survival progression beyond level 22, maintain level relevance.

---

### 4. Training Cap Extension
**File:** `src/scenes/UIScene.ts` / training cost table

**Current:** Attack Training caps at level 20 (maxed around wave 70)

**Change:**
- Levels 1–20: cost = `100 × (lv + 1)` (current)
- Levels 21–50: cost = `300 × (lv + 1)` (3× multiplier)
- New cap: 50 total levels (+100% attack from training alone, vs current +40%)

**Intent:** Gold sinks remain useful past wave 70, active players have continued growth until wave 100.

---

### 5. Rebirth System Implementation (Core Loop Completion)
**File:** `src/systems/SaveSystem.ts` + new `src/scenes/RebirthScene.ts`

**Current State:**
- `rebirthCount` and `rebirthPaths` fields stored but unused
- Offline multiplier `1 + 0.15 * rebirthCount` never applied
- No UI to trigger rebirth

**Implementation:**

**A. SaveSystem - Apply Offline Multiplier**
```typescript
function getOfflineReward(goldPerMin, timeSinceLastQuit_ms) {
  const rebirthMul = 1 + (this.rebirthCount || 0) * 0.15;
  return Math.round(goldPerMin * (timeSinceLastQuit_ms / 60000) * rebirthMul);
}
```

**B. BattleScene - Rebirth Unlock & Trigger**
```typescript
// After boss wave 50 cleared:
if (wave === 50 && !this.rebirthUnlocked) {
  this.rebirthUnlocked = true;
  // Show prompt: "Rebirth unlocked! Reset progression → Gain permanent +10% attack"
}

// Rebirth button in UIScene (wave 50+):
rebirthButton.on('pointerdown', () => {
  scene.start('RebirthScene', { characterId, currentStats });
});
```

**C. RebirthScene - New Scene**
```typescript
// Display:
// "Rebirth Path Selection"
// Current: <character>, Attack +XXX%
// 
// [Standard Path: +10% permanent attack]
// [Warrior Path: +10% attack + +5% HP (special rebirthPaths reward)]
// [Scholar Path: +10% attack + +10% gold income]
//
// → On confirm: 
//   - rebirthCount++
//   - rebirthPaths.push(selectedPath)
//   - Reset: wave=1, level=1, all trainings=0, all gear=0
//   - Apply permanent bonuses to player base stats
//   - Return to BattleScene wave 1
```

**D. Player Base Stat Calculation**
```typescript
function getBaseDamageMultiplier() {
  let dmgMul = 1.0;
  if (this.rebirthCount > 0) {
    dmgMul *= (1 + this.rebirthCount * 0.10);
  }
  return dmgMul;
}
// Apply in BattleScene.calculatePlayerDamage()
```

**Intent:** Complete the long-term retention loop — players can reset to wave 1 for permanent power boost, enabling "NG+" playstyle and extending engagement beyond wave 100 (current dead end).

---

## Part 3: Testing Checklist

### Animation Testing:
- [ ] All 8 characters appear in character select
- [ ] Each character with new sequences: pick character → use skill → heroic animation plays (256×384 tall, smooth 12-frame loop)
- [ ] No console errors during animation load/playback
- [ ] `node scripts/build-heroic-motions.mjs` completes successfully

### System Testing (use simulator: `node scripts/simulate-progression.mjs`):
- [ ] Boss wave 90 TTK is now ~18-20s (was cliff at 17.7s, should smooth to continuous)
- [ ] Minion DPS is now ~0.8–1.2/s at wave 10-50 (was <0.4/s, almost harmless)
- [ ] Training Attack extends past wave 70 (new cost table at levels 21+)
- [ ] Level-up progression reaches lv 40+ by wave 100 (was capped at lv 22)

### Gameplay Testing (manual):
- [ ] Pick sword_male, wave 1 → use samjae/maehwa/changung → heroic anim plays
- [ ] Pick sword_female, wave 1 → use samjae → heroic cutin still displays
- [ ] Reach wave 50 as any character → rebirth button available, clicking it opens RebirthScene
- [ ] Select rebirth path → stats reset, +10% permanent attack applied, back at wave 1
- [ ] Play to wave 100, verify minions are no longer decorative (evade skill matters)

---

## Part 4: Deliverables

**By end of implementation:**

1. ✅ 21 new heroic sequences generated (JPGs in `assets_src/`)
2. ✅ `src/data/heroicMotions.ts` updated with all 24 sequences
3. ✅ `scripts/build-heroic-motions.mjs` runs without error
4. ✅ Enemy damage formula updated (0.12 → 0.25 + cycle scaling)
5. ✅ Boss curve smoothed (stepped → continuous 2%/wave)
6. ✅ Evade cap raised to 50% base + training extension
7. ✅ Training Attack extended to level 50 (cost table updated)
8. ✅ Rebirth system fully implemented (unlock at wave 50, UI, scene, stat persistence)
9. ✅ Simulator re-run to verify TTK/TTD balance at critical waves
10. ✅ Manual gameplay testing passes (animations smooth, systems functional)

**Commits to push:**
- One or more commits on branch `claude/game-character-animation-fixes-xa4ixz` with clear messages:
  - "feat: generate remaining 21 heroic chromakey sequences for all 8 characters"
  - "feat: implement rebirth system + training/difficulty curve rebalance"
  - "chore: update heroicMotions manifest and build validation"

**Final step:** User will merge to main and deploy.

---

## Reference Materials

- **Analysis Report:** `docs/combat-progression-analysis.md` (Section 4 has all numerical targets)
- **Simulator:** `scripts/simulate-progression.mjs` (run after changes to validate curves)
- **Existing Sequences:** `assets_src/illustrations/heroic_illustrations/motions/sword_male_*` (visual reference for style/quality)
- **Build Script:** `scripts/build-heroic-motions.mjs` (auto-converts JPG → WebP, reads from SEQUENCES array)
- **Manifest:** `src/data/heroicMotions.ts` (update HEROIC_MOTION_SEQUENCES array when adding new sequences)
- **Asset Path:** `public/sprites/generated/runtime/` (where WebP files are output/served)

---

## Notes for Grok

This is a continuation of a previous feature branch where chromakey animations were partially implemented (sword_male only) and combat analysis was completed. You're adding the remaining characters' animations and implementing the identified game balance fixes.

**Key constraints:**
- All 21 new sequences must match the visual style/quality of existing sword_male sequences
- Game system changes must not break existing save/progression (backward compat for rebirthCount/rebirthPaths)
- Simulator is the source of truth for balance validation — run it after each system change
- Animation playback uses Phaser's sprite animation system (frame-based, 12 frames expected per character+skill combo)

**Timeline estimate:** 
- Chromakey sequences: 2-3 hours (generation + WebP build validation)
- Game system code: 3-4 hours (5 features + testing + simulator validation)
- Total: ~6 hours of focused work

Good luck! The repo is well-structured and this completes the final "feel-good" loop for the game.
