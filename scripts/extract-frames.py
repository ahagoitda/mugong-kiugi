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
# originals/ = repack 이전의 깨끗한 원본 시트 (128x128 셀, margin/spacing 없음).
# processed/ 는 repack-sprites.py 가 덮어쓰므로 source 로 쓰면 안 됨.
SRC_DIR = ROOT / "public" / "sprites" / "originals"
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


def _bbox_gap(box_a: tuple[int, int, int, int], box_b: tuple[int, int, int, int]) -> int:
    """두 bbox 사이 최소 거리(축별). 겹치면 0."""
    ax0, ay0, ax1, ay1 = box_a
    bx0, by0, bx1, by1 = box_b
    dx = max(0, ax0 - bx1, bx0 - ax1)
    dy = max(0, ay0 - by1, by0 - ay1)
    return max(dx, dy)


# 떠다니는 누출 조각 필터 임계값
# - 슬롯 내 메인(최대) 컴포넌트와 떨어진 작은 조각을 제거
MIN_SIZE = 8        # 이보다 작은 조각은 노이즈로 간주, gap 무관 제거
LOOSE_SIZE = 60     # 이보다 작고 ↓ 거리 임계 초과면 제거
LOOSE_GAP = 8       # 메인 bbox 와 이만큼 이상 떨어진 조각은 의심


def filter_slot_components(
    labeled: np.ndarray,
    component_ids: list[int],
) -> tuple[np.ndarray, int]:
    """슬롯의 컴포넌트들 중 누출 조각을 걸러내고 (유효 픽셀 마스크, 폐기 픽셀 수) 반환."""
    if not component_ids:
        return np.zeros_like(labeled, dtype=bool)

    # 사이즈 순 정렬 (최대 = 메인 몸체)
    sized: list[tuple[int, int]] = []
    for lid in component_ids:
        size = int((labeled == lid).sum())
        sized.append((size, lid))
    sized.sort(reverse=True)

    main_size, main_id = sized[0]
    main_mask = labeled == main_id
    main_ys, main_xs = np.where(main_mask)
    main_bbox = (
        int(main_xs.min()), int(main_ys.min()),
        int(main_xs.max()), int(main_ys.max()),
    )

    keep = main_mask.copy()
    dropped = 0
    for size, lid in sized[1:]:
        comp_mask = labeled == lid
        comp_ys, comp_xs = np.where(comp_mask)
        comp_bbox = (
            int(comp_xs.min()), int(comp_ys.min()),
            int(comp_xs.max()), int(comp_ys.max()),
        )
        gap = _bbox_gap(comp_bbox, main_bbox)
        # 필터 규칙
        is_tiny = size < MIN_SIZE
        is_loose = size < LOOSE_SIZE and gap > LOOSE_GAP
        if is_tiny or is_loose:
            dropped += size
            continue
        keep |= comp_mask
    return keep, dropped


def extract_sheet(src_path: Path, out_dir: Path, base: str, fw: int, fh: int, expected: int) -> None:
    """단일 시트를 슬롯 기반 연결 요소 분리로 프레임 단위 PNG 로 추출.

    각 슬롯에서:
    1) 무게중심으로 컴포넌트 → 슬롯 할당
    2) 슬롯 내 최대 컴포넌트를 메인 몸체로 간주
    3) MIN_SIZE 미만이거나 (LOOSE_SIZE 미만 & 메인과 LOOSE_GAP 초과) 조각은 누출로 폐기
    """
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
    slot_components: list[list[int]] = [[] for _ in range(n_frames)]
    for label_id in range(1, n_components + 1):
        comp_mask = labeled == label_id
        ys, xs = np.where(comp_mask)
        if len(xs) == 0:
            continue
        cx_mean = float(xs.mean())
        slot = max(0, min(n_frames - 1, int(cx_mean // fw)))
        slot_components[slot].append(label_id)

    # 각 슬롯 → 누출 필터링 후 마스크 생성
    slot_masks: list[np.ndarray] = []
    total_dropped = 0
    for i in range(n_frames):
        mask, dropped = filter_slot_components(labeled, slot_components[i])
        slot_masks.append(mask)
        total_dropped += dropped

    # 각 슬롯 → 128x128 (또는 boss 160x160) 캔버스로 크롭/저장
    out_dir.mkdir(parents=True, exist_ok=True)
    for i in range(n_frames):
        masked_rgba = arr.copy()
        keep = slot_masks[i]
        masked_rgba[~keep] = [0, 0, 0, 0]
        x0 = i * fw
        x1 = x0 + fw
        frame_arr = masked_rgba[:, x0:x1]
        out = Image.fromarray(frame_arr, mode="RGBA")
        out_path = out_dir / f"{base}_{i}.png"
        out.save(out_path)

    total_kept = sum(int(m.sum()) for m in slot_masks)
    total_orig = int(alpha.sum())
    print(f"  {base}: {n_components} comps → {n_frames} frames, "
          f"kept {total_kept}px, dropped {total_dropped}px (leak fragments)")


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
