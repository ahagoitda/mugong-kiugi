from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sprites" / "generated" / "runtime"
OUT.mkdir(parents=True, exist_ok=True)


def remove_green(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            dominance = g - max(r, b)
            if g > 120 and dominance > 25:
                alpha = max(0, min(255, 255 - int((dominance - 25) * 3.2)))
                pixels[x, y] = (r, min(g, max(r, b)), b, alpha)
    return rgba


def crop_grid(source: Path, cols: int, rows: int, names: list[str], prefix: str, chroma: bool = False):
    img = Image.open(source)
    cell_w, cell_h = img.width // cols, img.height // rows
    for i, name in enumerate(names):
        x, y = (i % cols) * cell_w, (i // cols) * cell_h
        cell = img.crop((x, y, x + cell_w, y + cell_h))
        if chroma:
            cell = remove_green(cell)
            bbox = cell.getbbox()
            if bbox:
                cell = cell.crop(bbox)
            canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
            cell.thumbnail((460, 460), Image.Resampling.LANCZOS)
            canvas.alpha_composite(cell, ((512 - cell.width) // 2, 512 - cell.height - 16))
            cell = canvas
            cell.save(OUT / f"{prefix}_{name}.png")
        else:
            cell = cell.convert("RGB")
            cell.save(OUT / f"{prefix}_{name}.webp", "WEBP", quality=92, method=6)


def main():
    generated = Path.home() / ".codex" / "generated_images" / "019e87f3-da8f-7cd0-9328-70a29970b7d6"
    hero_sheet = generated / "ig_09b61d1814528429016a203b5a2b5481918c6dc6a67064dd30.png"
    battle_bg = generated / "ig_09b61d1814528429016a203b1aae4c8191976422a869b074ba.png"
    enemy_sheet = generated / "ig_09b61d1814528429016a203c431cd48191aadc22865cfbf821.png"
    boss_sheet = generated / "ig_09b61d1814528429016a203ca1d2cc8191b1726016e044b7d3.png"
    extra_skill_sheet = generated / "ig_09b61d1814528429016a2040b4ff388191a9d509989db01900.png"

    hero_names = [
        "sword_male", "sword_female", "dao_male", "dao_female",
        "fist_male", "fist_female", "spear_male", "spear_female",
    ]
    enemy_names = [f"{i:02d}" for i in range(1, 25)]
    boss_names = ["daeju", "danju", "gakju", "magun", "hobup", "saja", "bugyoju", "hyeolma"]

    crop_grid(hero_sheet, 4, 2, hero_names, "hero", True)
    crop_grid(enemy_sheet, 6, 4, enemy_names, "enemy", True)
    crop_grid(boss_sheet, 4, 2, boss_names, "boss", True)

    bg = Image.open(battle_bg).convert("RGB")
    bg.save(OUT / "background_main.webp", "WEBP", quality=94, method=6)

    skill_sheet = ROOT / "public" / "sprites" / "generated" / "skill-cards-mockup-v2.png"
    crop_grid(skill_sheet, 5, 4, [f"{i:02d}" for i in range(1, 21)], "skill_card")
    crop_grid(extra_skill_sheet, 5, 4, [f"{i:02d}" for i in range(21, 41)], "skill_card")

    bg_sheet = ROOT / "public" / "sprites" / "generated" / "backgrounds-mockup-v2.png"
    crop_grid(bg_sheet, 4, 2, [f"{i:02d}" for i in range(1, 9)], "region")


if __name__ == "__main__":
    main()
