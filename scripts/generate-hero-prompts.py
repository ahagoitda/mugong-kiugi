#!/usr/bin/env python3
"""
generate-hero-prompts.py

Encodes the official Grok Builder Prompt Guide for 무공키우기 (Mugong Kiugi).
Generates exact, copy-paste ready prompts for consistent 8-hero chroma-key sprite frames.

Usage examples:
  python scripts/generate-hero-prompts.py --list
  python scripts/generate-hero-prompts.py --hero sword_male --action standard --frame 5
  python scripts/generate-hero-prompts.py --hero all --action standard,heavy --output-dir prompts/
  python scripts/generate-hero-prompts.py --hero dao_female --action idle,run,thrust
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# =============================================================================
# MASTER DATA (sourced from docs/grok-builder-prompt-guide.md)
# =============================================================================

STYLE_BASE = (
    "Professional 2D side-scrolling mobile game sprite, clean game art, "
    "cell-shaded chibi anime style, thick black outlines, bold colors, no shading gradients, "
    "crisp pixel-perfect line art. Front-facing side-view profile (facing left, facing direction: ◄). "
    "Clear solid chroma-key green background (#00FF00) for easy transparency masking. "
    "No ground shadows, no background objects, isolated asset."
)

CHARACTERS: Dict[str, str] = {
    "sword_male": (
        "Young male martial arts swordsman, short topknot (상투) hair, deep blue oriental robe "
        "with white trims, holding a straight double-edged sword (직도), determined look."
    ),
    "sword_female": (
        "Graceful female swordsman, hair tied in a clean bun (쪽진머리), light-blue silk robe "
        "with white accents, holding a thin slender sword (가는 검)."
    ),
    "dao_male": (
        "Muscular bald male warrior with a short black beard, shirtless torso wearing brown "
        "leather vests and belts, holding a heavy single-edged saber (도, 刀)."
    ),
    "dao_female": (
        "Agile female blade warrior, high ponytail black hair, vibrant red kung-fu robe, "
        "holding a curved slender saber (날렵한 도)."
    ),
    "fist_male": (
        "Heavy-set male monk fighter, short spiky black hair, orange and yellow martial arts vest, "
        "wearing large thick golden fist gloves/gauntlets."
    ),
    "fist_female": (
        "Athletic female fist fighter, short black hair, wearing a black crop top with orange "
        "waist wrap, wearing red combat boxing gloves."
    ),
    "spear_male": (
        "Male spearman wearing a white headband, flowing forest green oriental robe (도포), "
        "holding a long wooden spear (창) with a red tassel."
    ),
    "spear_female": (
        "Female spearman with a long red ribbon in her hair, sky-blue oriental robe, "
        "holding a long spear with a steel point and blue tassel."
    ),
}

HERO_ORDER = [
    "sword_male", "sword_female",
    "dao_male", "dao_female",
    "fist_male", "fist_female",
    "spear_male", "spear_female",
]

# Pose definitions. For grouped frames we store the canonical description + which frames use it.
# Each entry: (description, list_of_frame_indices_that_use_it)

IDLE_POSE = (
    "Standing in a relaxed martial arts combat stance, knees slightly bent, breathing, "
    "holding weapon pointing downwards, facing left."
)

RUN_POSE = (
    "Running dynamic action pose, body slightly tilted forward, arms swinging, "
    "legs bent in a running stride cycle, facing left."
)

STANDARD_POSES: List[Tuple[str, List[int]]] = [
    (
        "Attack preparation wind-up. Leaning body back slightly, holding weapon high behind "
        "the head with both hands, ready to strike, facing left.",
        list(range(0, 4)),  # F0-F3
    ),
    (
        "Fast overhead slash beginning. Swinging the weapon forward, body beginning to lunge "
        "forward, facing left.",
        [4],
    ),
    (
        "Full extension downward slash. Swinging weapon fully down in front, drawing a sharp "
        "blue glowing crescent sword-trail arc in the air, facing left.",
        [5],
    ),
    (
        "Attack follow-through pose. Body bent forward, weapon extended downward at the end "
        "of the swing, holding the strike stance, facing left.",
        list(range(6, 10)),  # F6-F9
    ),
    (
        "Returning to idle. Body relaxing, lifting weapon back up to defensive position, facing left.",
        list(range(10, 12)),  # F10-F11
    ),
]

HEAVY_POSES: List[Tuple[str, List[int]]] = [
    (
        "Heavy charge wind-up. Leaning body far back, lifting the weapon straight up vertically "
        "over the head, preparing a massive downward slam, facing left.",
        list(range(0, 5)),  # F0-F4
    ),
    (
        "Massive downward slam strike. Leaning body forward, slamming weapon onto the ground, "
        "drawing a large golden dust explosion effect at the impact point, facing left.",
        [5, 6],
    ),
    (
        "Low crouched impact pose. Body crouched very low to the ground, holding weapon firmly "
        "pressed against the floor, facing left.",
        list(range(7, 10)),  # F7-F9
    ),
    (
        "Recovering stance. Standing back up slowly from a low crouch, facing left.",
        list(range(10, 12)),  # F10-F11
    ),
]

THRUST_POSES: List[Tuple[str, List[int]]] = [
    (
        "Thrust preparation. Pulling the weapon back tight against the chest, aiming horizontally "
        "forward, crouching slightly, facing left.",
        list(range(0, 4)),  # F0-F3
    ),
    (
        "High-speed straight lunge pierce. Body lunged far forward in a straight line, arm fully "
        "extended straight forward, weapon pointing straight left, drawing a cyan spiraling wind "
        "shockwave trail, facing left.",
        [4, 5],
    ),
    (
        "Fully extended pierce hold. Maintaining the lunged straight pierce pose, body stretched "
        "forward, facing left.",
        list(range(6, 10)),  # F6-F9
    ),
    (
        "Sliding back into the default stance, facing left.",
        list(range(10, 12)),  # F10-F11
    ),
]

ACTION_MAP = {
    "idle": {"poses": [(IDLE_POSE, [0])], "frame_count": 1, "label": "idle"},
    "run": {"poses": [(RUN_POSE, [0])], "frame_count": 1, "label": "run"},
    "standard": {"poses": STANDARD_POSES, "frame_count": 12, "label": "standard_attack"},
    "heavy": {"poses": HEAVY_POSES, "frame_count": 12, "label": "heavy_attack"},
    "thrust": {"poses": THRUST_POSES, "frame_count": 12, "label": "thrust_attack"},
}

ALL_ACTIONS = ["idle", "run", "standard", "heavy", "thrust"]


def get_character_fragment(hero_id: str) -> str:
    if hero_id not in CHARACTERS:
        raise ValueError(f"Unknown hero: {hero_id}. Valid: {', '.join(HERO_ORDER)}")
    return CHARACTERS[hero_id]


def get_pose_for_frame(action: str, frame: int) -> str:
    if action not in ACTION_MAP:
        raise ValueError(f"Unknown action: {action}. Valid: {ALL_ACTIONS}")
    cfg = ACTION_MAP[action]
    if frame < 0 or frame >= cfg["frame_count"]:
        raise ValueError(f"Frame {frame} out of range for {action} (0..{cfg['frame_count']-1})")

    for pose_text, frames in cfg["poses"]:
        if frame in frames:
            return pose_text
    # Fallback (should not happen)
    return cfg["poses"][0][0]


def build_full_prompt(hero_id: str, action: str, frame: int) -> str:
    style = STYLE_BASE
    char_frag = get_character_fragment(hero_id)
    pose = get_pose_for_frame(action, frame)
    return f"{style} {char_frag} {pose}"


def suggest_filename(hero_id: str, action: str, frame: int) -> str:
    label = ACTION_MAP[action]["label"]
    if action in ("idle", "run"):
        return f"{hero_id}_{label}.png"
    return f"{hero_id}_{label}_f{frame:02d}.png"


def get_all_heroes() -> List[str]:
    return HERO_ORDER[:]


def get_all_actions() -> List[str]:
    return ALL_ACTIONS[:]


# =============================================================================
# CLI
# =============================================================================

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate exact Grok Builder prompts for Mugong Kiugi hero sprites."
    )
    p.add_argument(
        "--list",
        action="store_true",
        help="List all heroes and actions (no prompts generated).",
    )
    p.add_argument(
        "--hero",
        default=None,
        help="Hero ID or 'all' (e.g. sword_male, dao_female). Comma-separated also supported.",
    )
    p.add_argument(
        "--action",
        default=None,
        help="Action(s): idle,run,standard,heavy,thrust or 'all'. Comma-separated supported.",
    )
    p.add_argument(
        "--frame",
        type=int,
        default=None,
        help="Specific frame index (0-11). Only valid for standard/heavy/thrust.",
    )
    p.add_argument(
        "--output-dir",
        default=None,
        help="If provided, write one .txt file per prompt into this directory (named by suggested filename).",
    )
    p.add_argument(
        "--json",
        action="store_true",
        help="Output a JSON array of {hero, action, frame, prompt, filename} instead of human text.",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress / header printing (useful for scripting).",
    )
    return p.parse_args()


def resolve_heroes(raw: str | None) -> List[str]:
    if not raw or raw.lower() == "all":
        return get_all_heroes()
    heroes = []
    for token in raw.split(","):
        h = token.strip()
        if h:
            if h not in CHARACTERS:
                sys.stderr.write(f"Warning: unknown hero '{h}' (skipping)\n")
                continue
            heroes.append(h)
    return heroes or get_all_heroes()


def resolve_actions(raw: str | None) -> List[str]:
    if not raw or raw.lower() == "all":
        return get_all_actions()
    actions = []
    for token in raw.split(","):
        a = token.strip().lower()
        if a in ALL_ACTIONS:
            actions.append(a)
        else:
            sys.stderr.write(f"Warning: unknown action '{a}' (skipping)\n")
    return actions or get_all_actions()


def main() -> int:
    args = parse_args()

    if args.list:
        print("Heroes (8):")
        for h in HERO_ORDER:
            print(f"  - {h}")
        print("\nActions:")
        for a in ALL_ACTIONS:
            fc = ACTION_MAP[a]["frame_count"]
            print(f"  - {a:<10} (frames: 0..{fc-1})")
        return 0

    heroes = resolve_heroes(args.hero)
    actions = resolve_actions(args.action)

    results: List[Dict[str, object]] = []

    out_dir: Path | None = None
    if args.output_dir:
        out_dir = Path(args.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

    total = 0

    for hero in heroes:
        for action in actions:
            cfg = ACTION_MAP[action]
            max_frame = cfg["frame_count"] - 1

            frame_range: List[int]
            if args.frame is not None:
                if args.frame < 0 or args.frame > max_frame:
                    if not args.quiet:
                        print(f"  ! frame {args.frame} out of range for {action} (0..{max_frame}), skipping", file=sys.stderr)
                    continue
                frame_range = [args.frame]
            else:
                frame_range = list(range(cfg["frame_count"]))

            for f in frame_range:
                prompt = build_full_prompt(hero, action, f)
                fname = suggest_filename(hero, action, f)

                results.append(
                    {
                        "hero": hero,
                        "action": action,
                        "frame": f,
                        "prompt": prompt,
                        "filename": fname,
                    }
                )

                if out_dir:
                    (out_dir / f"{fname}.txt").write_text(prompt, encoding="utf-8")

                total += 1

                if not args.json and not args.quiet:
                    header = f"=== {hero} | {action} | f{f:02d} -> {fname}"
                    print(header)
                    print(prompt)
                    print()

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    elif not args.quiet:
        if args.output_dir:
            print(f"\nWrote {total} prompt file(s) to: {out_dir}")
        else:
            print(f"\nGenerated {total} prompt(s).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
