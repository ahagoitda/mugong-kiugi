#!/usr/bin/env python3
"""
extract-frames.py - 슬롯 기반 연결 요소 추출

이전의 clean-frames.py 는 시트 전체에서 "가장 큰 연결 요소"만 남겨,
캐릭터 본인의 떨어진 발/검 끝/모션 잔재까지 제거하는 문제가 있었다.

이 스크립트는:
  1) 원본 시트(public/sprites/processed/<sheet>.png)를 읽고
  2) 시트 전체에서 8-이웃 연결 요소 라벨링
  3) 각 컴포넌트의 무게중심 x 를 frame_width 로 나눠 슬롯 i 결정
  4) frame i = 슬롯 i 에 할당된 모든 컴포넌트의 픽셀 합집합
  5) 각 frame 을 128x128 (boss는 160x160) 캔버스에 저장
     - 시트 x 범위 [i*FW, (i+1)*FW) 의 픽셀을 그대로 (위치 보존)
     - 슬롯 안에는 본인 조각만, 이웃 슬롯에 무게중심이 있는 조각은 제외
  6) 출력: public/sprites/frames/<sheet>_<i>.png

원본 시트는 절대 수정하지 않는다.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image
import numpy as np
from scipy import ndimage


ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "public" / "sprites" / "processed"
OUT_DIR = ROOT / "public" / "sprites" / "frames"


# (basename, frame_width, frame_height, expected_frame_count)
# 시트별 셀 크기와 프레임 수
SHEETS: list[tuple[str, int, int, int]] = [
    # 8캐릭터 (4계열 x 남/녀) idle 4프레임, run 6프레임, attack 4프레임
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
    # 레거시 player 시트
    ("player_idle",        128, 128, 4),
    ("player_run",         128, 128, 6),
    ("player_attack",      128, 128, 4),
    # 적 (idle 4프레임)
    ("enemy_bandit",       128, 128, 4),
    ("enemy_swordsman",    128, 128, 4),
    ("enemy_assassin",     128, 128, 4),
    # 보스 (160x160, idle 4프레임)
    ("boss_beopwang",      160, 160, 4),
]


def extract_sheet(src_path: Path, out_dir: Path, base: str, fw: int, fh: int, expected: int) -> None:
    """단일 시트를 슬롯 기반 연결 요소 분리로 프레임 단위 PNG 로 추출."""
    img = Image.open(src_path).convert("RGBA")
    sw, sh = img.size
    if sh != fh:
        print(f"  ! {base}: sheet height {sh} != expected {fh}, skipping")
        return

    n_frames = sw // fw
    if n_frames != expected:
        print(f"  ! {base}: detected {n_frames} frames, expected {expected} (sheet {sw}x{sh}, fw {fw})")

    arr = np.array(img)
    alpha = arr[:, :, 3] > 0

    # 8-이웃 라벨링 (구조 행렬 3x3 = 모든 인접 픽셀 연결)
    structure = np.ones((3, 3), dtype=int)
    labeled, n_components = ndimage.label(alpha, structure=structure)

    # 컴포넌트별 무게중심 x → 슬롯 i 결정
    # slot_mask[i] = i 슬롯에 속하는 모든 픽셀의 boolean mask (시트 전체 크기)
    slot_mask: list[np.ndarray] = [
        np.zeros_like(alpha, dtype=bool) for _ in range(n_frames)
    ]

    for label_id in range(1, n_components + 1):
        comp_mask = labeled == label_id
        ys, xs = np.where(comp_mask)
        if len(xs) == 0:
            continue
        cx_mean = float(xs.mean())
        slot = int(cx_mean // fw)
        # 범위 안전
        slot = max(0, min(n_frames - 1, slot))
        # 이 컴포넌트의 모든 픽셀을 해당 슬롯에 추가
        # (픽셀이 이웃 슬롯 x 범위로 흘러가더라도, 슬롯의 [i*fw, (i+1)*fw) 크롭에서
        #  자동으로 잘려나가도록 시트 전체 마스크에 표시만 해둔다)
        slot_mask[slot] |= comp_mask

    # 각 슬롯 → 128x128 (또는 boss 160x160) 캔버스로 크롭/저장
    out_dir.mkdir(parents=True, exist_ok=True)
    for i in range(n_frames):
        # 해당 슬롯의 픽셀만 남긴 시트 (전체 크기)
        masked_rgba = arr.copy()
        keep = slot_mask[i]
        # mask 가 False 인 자리는 알파 0 으로
        masked_rgba[~keep] = [0, 0, 0, 0]

        # 슬롯 i 의 x 범위로 크롭
        x0 = i * fw
        x1 = x0 + fw
        frame_arr = masked_rgba[:, x0:x1]
        # 보스의 경우 fh != 128 일 수 있음. 이미 sh == fh 보장됨
        # 출력은 항상 (fh, fw) 크기
        out = Image.fromarray(frame_arr, mode="RGBA")
        out_path = out_dir / f"{base}_{i}.png"
        out.save(out_path)

    # 요약
    total_kept = sum(int(m.sum()) for m in slot_mask)
    total_orig = int(alpha.sum())
    excluded = total_orig - total_kept
    print(f"  {base}: {n_components} comps → {n_frames} frames, kept {total_kept}px, excluded {excluded}px")


def main() -> int:
    if not SRC_DIR.exists():
        print(f"Error: source dir {SRC_DIR} not found", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Source: {SRC_DIR}")
    print(f"Output: {OUT_DIR}")
    print()

    for base, fw, fh, expected in SHEETS:
        src_path = SRC_DIR / f"{base}.png"
        if not src_path.exists():
            print(f"  - {base}.png not found, skipping")
            continue
        extract_sheet(src_path, OUT_DIR, base, fw, fh, expected)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
