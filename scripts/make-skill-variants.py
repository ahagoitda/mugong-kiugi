#!/usr/bin/env python3
"""
make-skill-variants.py - 캐릭터별 스킬 모션 변형 생성

기존 공격 프레임(4장)을 3가지 방식으로 변형하여 스킬 모션 다양화.
make-enemy-attack.py 와 동일한 shear/squash 기법 사용.

변형 종류:
  heavy  - 강한 예비동작 → 강타 → 반동 (느리고 묵직한 느낌)
  quick  - 짧은 예비동작 → 연타 (빠른 2연타 느낌)
  thrust - 찌르기 특화 (창/도 계열, 수평 길게 뻗기)

입력:  public/sprites/frames/{prefix}_attack_{0-3}.png
출력:  public/sprites/processed/{prefix}_attack_{variant}.png  (margin=2, spacing=4)
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FRAMES_DIR = ROOT / "public" / "sprites" / "frames"
OUT_DIR = ROOT / "public" / "sprites" / "processed"

CHAR_PREFIXES = [
    "sword_male", "sword_female",
    "dao_male",   "dao_female",
    "fist_male",  "fist_female",
    "spear_male", "spear_female",
]

FRAME_W = 128
FRAME_H = 128
MARGIN = 2
SPACING = 4
N_FRAMES = 4

# 각 변형의 프레임별 파라미터: (shear_px, squash_ratio, x_stretch, y_compress)
# shear_px: top 픽셀이 얼마나 이동하는지 (양수=오른쪽, 즉 전진 방향)
# squash_ratio: 수직 압축 비율 (0~0.15)
# x_stretch: 수평 스케일 (1.0=원본)
# y_compress: 수직 스케일 (1.0=원본)
VARIANTS: dict[str, list[tuple[float, float, float, float]]] = {
    # 묵직한 강타: 뒤로 크게 젖혔다가 → 강하게 전진 타격
    "heavy": [
        (-18.0, 0.00, 1.00, 1.00),   # f0: 크게 뒤로 예비동작
        ( -6.0, 0.00, 1.00, 0.97),   # f1: 가볍게 앞으로
        (+22.0, 0.07, 1.04, 0.93),   # f2: 최대 전진 + 임팩트 squash
        ( +6.0, 0.02, 1.00, 0.98),   # f3: 반동 마무리
    ],
    # 빠른 연타: 짧은 예비동작 → 2연타 느낌
    "quick": [
        ( +4.0, 0.00, 1.00, 1.00),   # f0: 살짝 앞으로 (1타 예비)
        (+13.0, 0.04, 1.02, 0.96),   # f1: 1타 타격
        ( +3.0, 0.00, 1.00, 1.00),   # f2: 짧은 귀환 (2타 예비)
        (+11.0, 0.04, 1.02, 0.97),   # f3: 2타 타격
    ],
    # 찌르기: 수평으로 길게 뻗는 모션 (창/도 계열에 어울림)
    "thrust": [
        (-10.0, 0.00, 0.92, 1.04),   # f0: 뒤로 젖힘 + 세로 약간 늘기
        ( +5.0, 0.00, 0.96, 1.02),   # f1: 중간 자세
        (+24.0, 0.10, 1.10, 0.90),   # f2: 최대 전진 찌르기 (가로 늘고 세로 압축)
        ( +8.0, 0.01, 0.98, 0.99),   # f3: 회수 마무리
    ],
}


def content_bottom(frame: Image.Image) -> int:
    arr = np.array(frame)
    alpha = arr[:, :, 3] > 0
    if not alpha.any():
        return frame.size[1] - 1
    return int(np.where(alpha.any(axis=1))[0].max())


def apply_transform(
    base: Image.Image,
    shear_px: float,
    squash: float,
    x_stretch: float,
    y_compress: float,
) -> Image.Image:
    """shear + squash + stretch 조합으로 한 장의 변형 프레임 생성."""
    w, h = base.size
    bottom = content_bottom(base)
    if bottom <= 0:
        bottom = h - 1

    img = base.copy()

    # 1) x/y 스케일 (중심 기준)
    if x_stretch != 1.0 or y_compress != 1.0:
        new_w = max(1, int(round(w * x_stretch)))
        new_h = max(1, int(round(h * y_compress)))
        scaled = img.resize((new_w, new_h), Image.NEAREST)
        # 캔버스 중앙 배치
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        off_x = (w - new_w) // 2
        off_y = (h - new_h) // 2
        canvas.paste(scaled, (off_x, off_y), scaled)
        img = canvas

    # 2) 수직 squash (발 고정)
    if squash > 0:
        new_h2 = max(1, int(round(h * (1.0 - squash))))
        scaled2 = img.resize((w, new_h2), Image.NEAREST)
        canvas2 = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas2.paste(scaled2, (0, h - new_h2), scaled2)
        img = canvas2

    # 3) 전단 (발 피벗)
    if shear_px != 0.0:
        b = shear_px / bottom if bottom > 0 else 0.0
        c = -shear_px
        img = img.transform(
            (w, h), Image.AFFINE, (1, b, c, 0, 1, 0), resample=Image.NEAREST
        )

    return img


def pack_sheet(frames: list[Image.Image], fw: int, fh: int) -> Image.Image:
    """프레임 리스트를 margin/spacing 포함 가로 시트로 합친다."""
    n = len(frames)
    sheet_w = 2 * MARGIN + n * fw + (n - 1) * SPACING
    sheet_h = 2 * MARGIN + fh
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        x = MARGIN + i * (fw + SPACING)
        sheet.paste(fr, (x, MARGIN), fr)
    return sheet


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ok_count = 0
    skip_count = 0

    for prefix in CHAR_PREFIXES:
        # 기존 attack 프레임 로드
        bases: list[Image.Image] = []
        for i in range(N_FRAMES):
            p = FRAMES_DIR / f"{prefix}_attack_{i}.png"
            if not p.exists():
                print(f"  ! {prefix}: frame {i} not found, skipping")
                break
            bases.append(Image.open(p).convert("RGBA"))
        else:
            # 모든 4장 로드 성공
            for variant, params in VARIANTS.items():
                out_frames: list[Image.Image] = []
                for base, (shear, squash, xs, yc) in zip(bases, params):
                    out_frames.append(apply_transform(base, shear, squash, xs, yc))
                sheet = pack_sheet(out_frames, FRAME_W, FRAME_H)
                out_path = OUT_DIR / f"{prefix}_attack_{variant}.png"
                sheet.save(out_path)
                ok_count += 1
            print(f"  {prefix}: heavy + quick + thrust 생성 완료")
            continue
        skip_count += 1

    print(f"\n완료: {ok_count}개 시트 생성, {skip_count}개 스킵")
    return 0


if __name__ == "__main__":
    sys.exit(main())
