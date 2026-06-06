# Grok Builder Prompt Guide - Martial Arts Raising Game (무공키우기)

> **참고**: 이 가이드는 **픽셀 스프라이트 (chibi cell-shaded 게임 에셋)** 용입니다. 
> 고화질 히어로 일러스트 모션 프레임 (heroic wuxia painting 스타일, 자연스러운 모션, chroma-key green, 각 무공 초식 맞춤 12프레임 시퀀스)은 `public/sprites/illustrations/heroic_illustrations/motions/<hero>_<skill>/` 와 heroic_illustrations/README.md 를 사용하세요. (참조 기반 생성 + 그린 배경으로 격리/시퀀싱 용이)

This guide provides high-quality, structured prompts for **Grok Builder** (or other AI image generators) to generate frame-by-frame character combat animations for **무공키우기 (Mugong Kiugi)**.

To easily extract the characters and convert them into game assets, we use a **Chroma-key green background** (chroma key / green screen) and specify precise poses, angles, and strict consistency rules.

All generated assets feed into the existing pipeline:
- Place raw AI outputs (with green bg) into `public/sprites/originals/`
- Run `node scripts/process-assets.js` (with green chroma keying) + `python scripts/extract-frames.py` (or repack tools) to produce runtime-ready transparent sprites in `sprites/generated/runtime/` and individual `frames/`.

---

## 1. Master Style Guide (Common Prompt Base)

**Always append this style block at the beginning of every prompt** to keep characters consistent and matching the 2D side-scrolling chibi mobile game aesthetic:

```text
[STYLE]: Professional 2D side-scrolling mobile game sprite, clean game art, cell-shaded chibi anime style, thick black outlines, bold colors, no shading gradients, crisp pixel-perfect line art. Front-facing side-view profile (facing left, facing direction: ◄). Clear solid chroma-key green background (#00FF00) for easy transparency masking. No ground shadows, no background objects, isolated asset.
```

**Full resolved STYLE prefix (copy-paste ready):**

```
Professional 2D side-scrolling mobile game sprite, clean game art, cell-shaded chibi anime style, thick black outlines, bold colors, no shading gradients, crisp pixel-perfect line art. Front-facing side-view profile (facing left, facing direction: ◄). Clear solid chroma-key green background (#00FF00) for easy transparency masking. No ground shadows, no background objects, isolated asset.
```

---

## 2. Character Appearance Definitions (8 Heroes)

Use exactly one of these `[CHARACTER]` fragments depending on the hero:

| Class / ID          | Prompt Fragment |
|---------------------|-----------------|
| **Sword Male** (`sword_male`) | `[CHARACTER]: Young male martial arts swordsman, short topknot (상투) hair, deep blue oriental robe with white trims, holding a straight double-edged sword (직도), determined look.` |
| **Sword Female** (`sword_female`) | `[CHARACTER]: Graceful female swordsman, hair tied in a clean bun (쪽진머리), light-blue silk robe with white accents, holding a thin slender sword (가는 검).` |
| **Blade/Dao Male** (`dao_male`) | `[CHARACTER]: Muscular bald male warrior with a short black beard, shirtless torso wearing brown leather vests and belts, holding a heavy single-edged saber (도, 刀).` |
| **Blade/Dao Female** (`dao_female`) | `[CHARACTER]: Agile female blade warrior, high ponytail black hair, vibrant red kung-fu robe, holding a curved slender saber (날렵한 도).` |
| **Fist Male** (`fist_male`) | `[CHARACTER]: Heavy-set male monk fighter, short spiky black hair, orange and yellow martial arts vest, wearing large thick golden fist gloves/gauntlets.` |
| **Fist Female** (`fist_female`) | `[CHARACTER]: Athletic female fist fighter, short black hair, wearing a black crop top with orange waist wrap, wearing red combat boxing gloves.` |
| **Spear Male** (`spear_male`) | `[CHARACTER]: Male spearman wearing a white headband, flowing forest green oriental robe (도포), holding a long wooden spear (창) with a red tassel.` |
| **Spear Female** (`spear_female`) | `[CHARACTER]: Female spearman with a long red ribbon in her hair, sky-blue oriental robe, holding a long spear with a steel point and blue tassel.` |

**Note on IDs**: Project uses `sword_male` / `dao_male` (blade) / `fist_male` / `spear_male` (and `_female` variants). These map directly to sprite prefixes and filenames.

---

## 3. Action Poses (12-Frame Breakdown)

Specify the **exact frame index** and pose. AI generators produce one image per call, so request one frame at a time for maximum control and consistency.

### A. Idle & Run (Looping)

- **Idle Pose**:
  ```
  [POSE]: Standing in a relaxed martial arts combat stance, knees slightly bent, breathing, holding weapon pointing downwards, facing left.
  ```

- **Run Pose**:
  ```
  [POSE]: Running dynamic action pose, body slightly tilted forward, arms swinging, legs bent in a running stride cycle, facing left.
  ```

### B. Standard Attack (12-Frame Set)

| Frames | Description | Pose Text |
|--------|-------------|-----------|
| F0 - F3 (Wind-up) | Attack preparation wind-up | `[POSE]: Attack preparation wind-up. Leaning body back slightly, holding weapon high behind the head with both hands, ready to strike, facing left.` |
| F4 (Strike Start) | Fast overhead slash beginning | `[POSE]: Fast overhead slash beginning. Swinging the weapon forward, body beginning to lunge forward, facing left.` |
| F5 (Strike Release) | Full extension downward slash | `[POSE]: Full extension downward slash. Swinging weapon fully down in front, drawing a sharp blue glowing crescent sword-trail arc in the air, facing left.` |
| F6 - F9 (Impact Hold) | Attack follow-through pose | `[POSE]: Attack follow-through pose. Body bent forward, weapon extended downward at the end of the swing, holding the strike stance, facing left.` |
| F10 - F11 (Recovery) | Returning to idle | `[POSE]: Returning to idle. Body relaxing, lifting weapon back up to defensive position, facing left.` |

### C. Heavy Attack (12-Frame Set)

| Frames | Description | Pose Text |
|--------|-------------|-----------|
| F0 - F4 (Overhead Charge) | Heavy charge wind-up | `[POSE]: Heavy charge wind-up. Leaning body far back, lifting the weapon straight up vertically over the head, preparing a massive downward slam, facing left.` |
| F5 - F6 (Slam) | Massive downward slam strike | `[POSE]: Massive downward slam strike. Leaning body forward, slamming weapon onto the ground, drawing a large golden dust explosion effect at the impact point, facing left.` |
| F7 - F9 (Impact Hold) | Low crouched impact pose | `[POSE]: Low crouched impact pose. Body crouched very low to the ground, holding weapon firmly pressed against the floor, facing left.` |
| F10 - F11 (Recovery) | Recovering stance | `[POSE]: Recovering stance. Standing back up slowly from a low crouch, facing left.` |

### D. Thrust Attack (12-Frame Set)

| Frames | Description | Pose Text |
|--------|-------------|-----------|
| F0 - F3 (Focus pull-back) | Thrust preparation | `[POSE]: Thrust preparation. Pulling the weapon back tight against the chest, aiming horizontally forward, crouching slightly, facing left.` |
| F4 - F5 (Lunge) | High-speed straight lunge pierce | `[POSE]: High-speed straight lunge pierce. Body lunged far forward in a straight line, arm fully extended straight forward, weapon pointing straight left, drawing a cyan spiraling wind shockwave trail, facing left.` |
| F6 - F9 (Thrust Hold) | Fully extended pierce hold | `[POSE]: Fully extended pierce hold. Maintaining the lunged straight pierce pose, body stretched forward, facing left.` |
| F10 - F11 (Recovery) | Sliding back into the default stance | `[POSE]: Sliding back into the default stance, facing left.` |

---

## 4. Master Prompt Template for Grok Builder

**Template** (always in this exact order):

```
[STYLE PROMPT BASE] [CHARACTER CHOSEN] [POSE CHOSEN]
```

### Full Example (Sword Male - Standard Attack Frame 5)

```
Professional 2D side-scrolling mobile game sprite, clean game art, cell-shaded chibi anime style, thick black outlines, bold colors, no shading gradients, crisp pixel-perfect line art. Front-facing side-view profile (facing left, facing direction: ◄). Clear solid chroma-key green background (#00FF00) for easy transparency masking. No ground shadows, no background objects, isolated asset. Young male martial arts swordsman, short topknot (상투) hair, deep blue oriental robe with white trims, holding a straight double-edged sword (직도), determined look. Full extension downward slash. Swinging weapon fully down in front, drawing a sharp blue glowing crescent sword-trail arc in the air, facing left.
```

---

## 5. Recommended Workflow & Naming

1. Use the `scripts/generate-hero-prompts.py` helper (see below) to produce exact prompts + suggested filenames.
2. Generate images one frame at a time in Grok (or your preferred tool). Aim for **consistent character appearance, size, and facing** across all frames of a sequence.
3. Save results with suggested names into `public/sprites/originals/` (or a dedicated `originals/ai_chroma/` subfolder for traceability).
4. Process:
   ```bash
   node scripts/process-assets.js   # chroma-key removal + WebP/PNG optimization (use green mode)
   python scripts/extract-frames.py # or repack tools for new sheets
   ```
5. Update animation frame counts / hit frame data in `src/data/skills.ts`, `src/entities/Player.ts`, and `src/scenes/BattleScene.ts` when introducing 12-frame cycles.
6. For best results, generate an entire attack cycle in one session while the model still has strong context of the character.

### Suggested Filename Patterns (for new detailed animations)

- `sword_male_idle.png` (or per-frame if multi-pose idle)
- `sword_male_run_0.png` ... (or full sheet)
- `sword_male_standard_attack_f05.png`
- `dao_female_heavy_attack_f07.png`
- `spear_male_thrust_attack_f04.png`

Individual frames can later be assembled into sprite sheets matching the expectations of `extract-frames.py` / `repack-sprites.py` (typically 128x128 cells).

---

## 6. Using the Prompt Generator Script

```bash
# List all available heroes and actions
python scripts/generate-hero-prompts.py --list

# Generate one specific prompt (stdout)
python scripts/generate-hero-prompts.py --hero sword_male --action standard --frame 5

# Generate a batch of .txt prompt files
python scripts/generate-hero-prompts.py --hero all --action standard,heavy,thrust --output-dir prompts/hero-frames

# All idles + runs for every hero
python scripts/generate-hero-prompts.py --hero all --action idle,run
```

The script encodes the exact STYLE + CHARACTER + POSE rules from this guide so you never have to copy-paste manually.

---

## 7. Consistency Tips for High-Quality Results

- Always include the full STYLE block verbatim.
- Never omit "facing left" / "facing direction: ◄".
- Request the **exact same character details** every time (topknot, robe color, weapon type, hair style, etc.).
- For weapon trails / impact VFX (blue crescent, golden dust, cyan shockwave), describe them explicitly in the POSE as shown.
- Generate small batches (e.g. one full 12-frame attack for one hero) in a single chat/session for better visual coherence.
- After generation, you can use image reference / editing tools (img2img or "edit with reference") for fine fixes while keeping the green background.

---

**This guide supersedes ad-hoc prompting for hero sprites.** Use it for all future hero combat animation generations to maintain a cohesive 8-hero visual identity.

See also:
- `docs/GDD_MVP.md`
- `docs/contents_plan.md`
- `scripts/process-assets.js` (chroma key implementation)
- `scripts/extract-frames.py`
- `src/data/characters.ts` (canonical 8 hero definitions)
