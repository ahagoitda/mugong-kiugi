#!/usr/bin/env python3
"""
repack-sprites.py - 낱장 프레임을 시트로 재합성

입력: public/sprites/frames/<base>_<i>.png  (extract-frames.py 출력)
출력: public/sprites/processed/<base>.png   (덮어쓰기)

레이아웃 (margin=2, spacing=4):

  ┌──── 시트 ────┐
  │ m ┌──┐ s ┌──┐ s ... ┌──┐ m │
  │ m │ 0│ s │ 1│ s ... │N-1│ m │
  │ m └──┘ s └──┘ s ... └──┘ m │
  └─────────────┘

  width  = 2*m + N*fw + (N-1)*s
  height = 2*m + fh

왜 빈틈을 두는가?
- WebGL 렌더링 시 인접 프레임의 픽셀이 텍스처 필터링으로 새는 현상(texture bleeding)
  방지. spacing=4 면 양쪽 2px 의 안전 영역이 생긴다.
- Phaser 스프라이트시트 로더의 margin/spacing 옵션과 매핑된다:
    this.load.spritesheet(key, url, {
      frameWidth: 128, frameHeight: 128,
      margin: 2, spacing: 4,
    });
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
FRAMES_DIR = ROOT / "public" / "sprites" / "frames"
OUT_DIR = ROOT / "public" / "sprites" / "processed"

MARGIN = 2
SPACING = 4


# (basename, frame_width, frame_height, frame_count)
# extract-frames.py 와 같은 순서/스펙
SHEETS: list[tuple[str, int, int, int]] = [
    ("sword_male_idle",    128, 128, 4),
    ("sword_male_run",     128, 128, 6),
    ("sword_male_attack",  128, 128, 4),
    ("sword_female_idle",  128, 128, 4),
    ("sword_female_run",   128, 128, 6),
    ("sword_female_attack",128, 128, 4),
    ("dao_male_idle",      128, 128, 4),
    ("dao_male_run",       128, 128, 6),
    ("dao_male_attack",    128, 128, 4),
    ("dao_female_idle",    128, 128, 4),
    ("dao_female_run",     128, 128, 6),
    ("dao_female_attack",  128, 128, 4),
    ("fist_male_idle",     128, 128, 4),
    ("fist_male_run",      128, 128, 6),
    ("fist_male_attack",   128, 128, 4),
    ("fist_female_idle",   128, 128, 4),
    ("fist_female_run",    128, 128, 6),
    ("fist_female_attack", 128, 128, 4),
    ("spear_male_idle",    128, 128, 4),
    ("spear_male_run",     128, 128, 6),
    ("spear_male_attack",  128, 128, 4),
    ("spear_female_idle",  128, 128, 4),
    ("spear_female_run",   128, 128, 6),
    ("spear_female_attack",128, 128, 4),
    ("player_idle",        128, 128, 4),
    ("player_run",         128, 128, 6),
    ("player_attack",      128, 128, 4),
    ("enemy_bandit",       128, 128, 4),
    ("enemy_swordsman",    128, 128, 4),
    ("enemy_assassin",     128, 128, 4),
    # 적 공격 프레임 (make-enemy-attack.py 로 생성)
    ("enemy_bandit_attack",    128, 128, 4),
    ("enemy_swordsman_attack", 128, 128, 4),
    ("enemy_assassin_attack",  128, 128, 4),
    ("boss_beopwang_attack",   160, 160, 4),
    ("boss_beopwang",      160, 160, 4),
]


def repack_sheet(base: str, fw: int, fh: int, n: int) -> bool:
    """N 개의 낱장 프레임을 margin/spacing 을 둔 한 장의 시트로 합성."""
    frame_paths = [FRAMES_DIR / f"{base}_{i}.png" for i in range(n)]
    missing = [p for p in frame_paths if not p.exists()]
    if missing:
        print(f"  ! {base}: missing {len(missing)} frame(s), skipping")
        return False

    sheet_w = 2 * MARGIN + n * fw + (n - 1) * SPACING
    sheet_h = 2 * MARGIN + fh
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    for i, fp in enumerate(frame_paths):
        frame = Image.open(fp).convert("RGBA")
        if frame.size != (fw, fh):
            print(f"  ! {base}_{i}: size {frame.size} != ({fw},{fh}), skipping sheet")
            return False
        x = MARGIN + i * (fw + SPACING)
        y = MARGIN
        sheet.paste(frame, (x, y), frame)

    out_path = OUT_DIR / f"{base}.png"
    sheet.save(out_path)
    print(f"  {base}: {sheet_w}x{sheet_h} ({n} frames @ {fw}x{fh}, m={MARGIN} s={SPACING})")
    return True


def main() -> int:
    if not FRAMES_DIR.exists():
        print(f"Error: frames dir {FRAMES_DIR} not found", file=sys.stderr)
        print("       Run scripts/extract-frames.py first.", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Frames:  {FRAMES_DIR}")
    print(f"Output:  {OUT_DIR}")
    print(f"Layout:  margin={MARGIN}, spacing={SPACING}")
    print()

    ok = 0
    for base, fw, fh, n in SHEETS:
        if repack_sheet(base, fw, fh, n):
            ok += 1

    print(f"\nDone. {ok}/{len(SHEETS)} sheets repacked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
