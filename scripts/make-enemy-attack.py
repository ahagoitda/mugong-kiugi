#!/usr/bin/env python3
"""
make-enemy-attack.py - 적 공격 프레임 생성

적 스프라이트는 idle 프레임만 있고 공격 프레임이 없다.
새 도트를 그릴 수 없으므로 idle 프레임 0 을 기반으로
전단(shear) + 수직 압축으로 "윈드업 → 타격 → 마무리" 4프레임을 합성한다.

- 발(컨텐츠 하단)을 피벗으로 상체를 앞/뒤로 기울임
- 캐릭터가 바라보는(공격하는) 방향으로 기울여 찌르기/내려치기 느낌
- NEAREST 리샘플로 도트 선명도 유지

출력: public/sprites/frames/<sprite>_attack_<i>.png
이후 repack-sprites.py 로 시트 합성.
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "public" / "sprites" / "originals"
OUT_DIR = ROOT / "public" / "sprites" / "frames"

# (스프라이트, 프레임폭, 원본이 왼쪽을 보는가)
# 공격 기울임 방향 = 캐릭터가 바라보는 방향 (원본 기준)
ENEMIES = [
    ("enemy_bandit", 128, True),
    ("enemy_swordsman", 128, True),
    ("enemy_assassin", 128, False),
    ("boss_beopwang", 160, False),
]

# 프레임별 기울임 비율(앞=+) 과 수직 압축
# f0 윈드업(뒤로), f1 준비, f2 타격(최대 전진), f3 마무리
LEAN_SEQ = [-0.42, 0.18, 1.0, 0.62]
SQUASH_SEQ = [0.0, 0.0, 0.06, 0.02]  # 타격 시 살짝 눌림


def content_bottom(frame: Image.Image) -> int:
    arr = np.array(frame)
    alpha = arr[:, :, 3] > 0
    if not alpha.any():
        return frame.size[1] - 1
    return int(np.where(alpha.any(axis=1))[0].max())


def make_attack_frame(base: Image.Image, dx_top: float, squash: float) -> Image.Image:
    """발 피벗 전단 + 수직 압축으로 한 장의 공격 프레임 생성."""
    w, h = base.size
    bottom = content_bottom(base)
    if bottom <= 0:
        bottom = h - 1

    # 1) 수직 압축 (발 고정): 위쪽을 눌러 임팩트 느낌
    img = base
    if squash > 0:
        new_h = max(1, int(round(h * (1.0 - squash))))
        scaled = base.resize((w, new_h), Image.NEAREST)
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        img.paste(scaled, (0, h - new_h), scaled)  # 하단(발) 정렬

    # 2) 전단 (발 피벗): top 이 dx_top 만큼 이동
    b = dx_top / bottom if bottom > 0 else 0.0
    c = -dx_top
    sheared = img.transform((w, h), Image.AFFINE, (1, b, c, 0, 1, 0), resample=Image.NEAREST)
    return sheared


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for sprite, fw, faces_left in ENEMIES:
        src = SRC_DIR / f"{sprite}.png"
        if not src.exists():
            print(f"  ! {sprite}: not found")
            continue
        sheet = Image.open(src).convert("RGBA")
        fh = sheet.size[1]
        base = sheet.crop((0, 0, fw, fh))  # idle frame 0

        # 최대 전단량 (px). 보스는 크게.
        max_shear = 20 if fw >= 160 else 15
        forward_sign = -1 if faces_left else 1  # 바라보는 방향이 +

        for i, (lean, squash) in enumerate(zip(LEAN_SEQ, SQUASH_SEQ)):
            dx = forward_sign * lean * max_shear
            frame = make_attack_frame(base, dx, squash)
            out = OUT_DIR / f"{sprite}_attack_{i}.png"
            frame.save(out)
        print(f"  {sprite}: 4 attack frames (shear≤{max_shear}px, forward={'left' if faces_left else 'right'})")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
