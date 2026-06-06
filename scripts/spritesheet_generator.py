#!/usr/bin/env python3
import os
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "sprites" / "generated" / "runtime"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Character definition mapped by id
CHARACTERS = {
    "sword_male": {"class": "SWORD", "gender": "MALE", "hair": "topknot", "clothes": "blue_robe"},
    "sword_female": {"class": "SWORD", "gender": "FEMALE", "hair": "bun", "clothes": "light_blue_robe"},
    "dao_male": {"class": "BLADE", "gender": "MALE", "hair": "bald_beard", "clothes": "shirtless_leather"},
    "dao_female": {"class": "BLADE", "gender": "FEMALE", "hair": "ponytail", "clothes": "red_robe"},
    "fist_male": {"class": "FIST", "gender": "MALE", "hair": "spiky", "clothes": "yellow_vest"},
    "fist_female": {"class": "FIST", "gender": "FEMALE", "hair": "short", "clothes": "crop_top"},
    "spear_male": {"class": "SPEAR", "gender": "MALE", "hair": "headband", "clothes": "green_dopeo"},
    "spear_female": {"class": "SPEAR", "gender": "FEMALE", "hair": "ribbon", "clothes": "sky_blue_robe"}
}

# Color palettes (R, G, B)
SKIN_LIGHT = (255, 219, 172)
SKIN_SHADOW = (224, 172, 105)
HAIR_DARK = (30, 30, 30)
HAIR_SHADOW = (15, 15, 15)

PALETTES = {
    "blue_robe": {"main": (54, 90, 166), "shadow": (34, 58, 115), "trim": (195, 209, 235)},
    "light_blue_robe": {"main": (102, 153, 204), "shadow": (64, 102, 140), "trim": (230, 240, 250)},
    "shirtless_leather": {"main": (102, 68, 51), "shadow": (68, 44, 31), "trim": (210, 180, 160)},
    "red_robe": {"main": (196, 30, 30), "shadow": (120, 15, 15), "trim": (245, 190, 190)},
    "yellow_vest": {"main": (230, 150, 20), "shadow": (160, 100, 10), "trim": (40, 40, 40)},
    "crop_top": {"main": (40, 40, 42), "shadow": (20, 20, 22), "trim": (235, 160, 30)},
    "green_dopeo": {"main": (34, 117, 76), "shadow": (20, 77, 48), "trim": (200, 225, 210)},
    "sky_blue_robe": {"main": (79, 172, 196), "shadow": (45, 112, 130), "trim": (235, 90, 90)}
}

def draw_capsule(draw, p1, p2, r, color):
    # Draw rounded capsule for limbs
    draw.line([p1, p2], fill=color, width=int(r * 2))
    draw.ellipse([p1[0]-r, p1[1]-r, p1[0]+r, p1[1]+r], fill=color)
    draw.ellipse([p2[0]-r, p2[1]-r, p2[0]+r, p2[1]+r], fill=color)

def draw_glow_arc(draw, center, r_inner, r_outer, start_angle, end_angle, color):
    steps = 18
    pts = []
    # Outer arc
    for i in range(steps + 1):
        t = start_angle + (end_angle - start_angle) * (i / steps)
        pts.append((center[0] + r_outer * math.cos(t), center[1] + r_outer * math.sin(t)))
    # Inner arc (reversed)
    for i in range(steps, -1, -1):
        t = start_angle + (end_angle - start_angle) * (i / steps)
        pts.append((center[0] + r_inner * math.cos(t), center[1] + r_inner * math.sin(t)))
    draw.polygon(pts, fill=color)

def draw_thrust_wave(draw, start_pt, angle, length, width, color):
    perp = angle + math.pi / 2
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    cos_p, sin_p = math.cos(perp), math.sin(perp)
    pts = [
        start_pt,
        (start_pt[0] + length * 0.45 * cos_a - width * 0.45 * cos_p, start_pt[1] + length * 0.45 * sin_a - width * 0.45 * sin_p),
        (start_pt[0] + length * cos_a, start_pt[1] + length * sin_a),
        (start_pt[0] + length * 0.45 * cos_a + width * 0.45 * cos_p, start_pt[1] + length * 0.45 * sin_a + width * 0.45 * sin_p),
    ]
    draw.polygon(pts, fill=color)

def apply_outline(image: Image.Image, outline_color=(0, 0, 0, 255), thickness=2) -> Image.Image:
    # 2px circular outline generator using mask offset
    outline = Image.new("RGBA", image.size, (0, 0, 0, 0))
    alpha = image.split()[3]
    for dx in range(-thickness, thickness + 1):
        for dy in range(-thickness, thickness + 1):
            if dx*dx + dy*dy <= thickness*thickness:
                if dx == 0 and dy == 0:
                    continue
                shifted = Image.new("L", image.size, 0)
                shifted.paste(alpha, (dx, dy))
                outline.paste(outline_color, (0, 0), mask=shifted)
    
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(outline)
    result.alpha_composite(image)
    return result

def draw_character_frame(char_id: str, action: str, frame: int) -> Image.Image:
    cfg = CHARACTERS[char_id]
    cls = cfg["class"]
    gender = cfg["gender"]
    hair_type = cfg["hair"]
    clothes_key = cfg["clothes"]
    colors = PALETTES[clothes_key]

    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Base coordinates
    cx, cy = 64, 75
    hx, hy = 64, 45

    # Animation properties
    bounce_y = 0
    body_tilt = 0 # degrees/offset
    leg_swing = 0.0
    arm_swing = 0.0
    x_offset = 0

    # Action checks
    is_attack = action.startswith("attack")
    attack_type = action.split("_")[1] if "_" in action else "standard"
    
    # Render queue for in-sprite VFX
    vfx_draw_queue = []

    # Frame details (All scales expanded to 12 frames)
    if action == "idle":
        bounce_y = -3.0 * math.sin(frame * (2.0 * math.pi / 12.0))
        leg_swing = 0.08 * math.sin(frame * (2.0 * math.pi / 12.0))
        arm_swing = 0.04 * math.cos(frame * (2.0 * math.pi / 12.0))
    elif action == "run":
        bounce_y = -3.5 * abs(math.sin(frame * (2.0 * math.pi / 6.0)))
        leg_swing = 0.6 * math.sin(frame * (2.0 * math.pi / 12.0))
        arm_swing = 0.5 * math.sin(frame * (2.0 * math.pi / 12.0))
        body_tilt = -2.5 - 1.0 * math.sin(frame * (2.0 * math.pi / 6.0))
    elif is_attack:
        if attack_type == "heavy":
            if frame < 5:
                ratio = frame / 4.0
                bounce_y = 1.0 * ratio
                x_offset = 2.0 * ratio
                body_tilt = 1.0 * ratio
                leg_swing = -0.1 * ratio
                arm_swing = -1.2 * ratio
                sword_angle = 1.3 + 1.25 * ratio
            elif frame in [5, 6]:
                ratio = (frame - 5) / 1.0
                bounce_y = 1.0 - 2.0 * ratio
                x_offset = 2.0 - 6.0 * ratio
                body_tilt = 1.0 - 4.0 * ratio
                leg_swing = -0.1 + 0.6 * ratio
                arm_swing = -1.2 + 2.6 * ratio
                if frame == 5:
                    sword_angle = -0.5
                    vfx_draw_queue.append(("slash", 2.4, -0.6, 15, 62, 0.8))
                else:
                    sword_angle = -3.4
                    vfx_draw_queue.append(("slash", -0.5, -3.5, 15, 65, 0.95))
                    vfx_draw_queue.append(("impact", -3.4, 18, 0.9))
            elif frame < 10:
                bounce_y = -1.0
                x_offset = -4.0
                body_tilt = -3.0
                leg_swing = 0.5
                arm_swing = 1.4
                sword_angle = -3.5
                if frame == 7:
                    vfx_draw_queue.append(("slash", -1.8, -3.5, 12, 58, 0.4))
            else:
                ratio = (frame - 10) / 1.0
                bounce_y = -1.0 + 1.0 * ratio
                x_offset = -4.0 + 4.0 * ratio
                body_tilt = -3.0 + 3.0 * ratio
                leg_swing = 0.5 - 0.5 * ratio
                arm_swing = 1.4 - 1.4 * ratio
                sword_angle = -3.5 + 2.7 * ratio

        elif attack_type == "quick":
            sub_frame = frame % 6
            if frame < 6:
                if sub_frame < 2:
                    ratio = sub_frame / 1.0
                    x_offset = 1.0 * ratio
                    body_tilt = 1.0 * ratio
                    bounce_y = 0.0
                    arm_swing = -0.4 * ratio
                    sword_angle = 1.4 + 0.6 * ratio
                elif sub_frame == 2:
                    x_offset = -3.0
                    body_tilt = -2.0
                    bounce_y = -1.0
                    leg_swing = 0.4
                    arm_swing = 1.2
                    sword_angle = -3.0
                    vfx_draw_queue.append(("slash", 1.8, -3.14, 10, 48, 0.8))
                elif sub_frame == 3:
                    x_offset = -4.0
                    body_tilt = -3.0
                    bounce_y = -1.0
                    leg_swing = 0.45
                    arm_swing = 1.3
                    sword_angle = -3.3
                    vfx_draw_queue.append(("slash", -1.5, -3.4, 10, 45, 0.5))
                else:
                    ratio = (sub_frame - 4) / 1.0
                    x_offset = -4.0 + 4.0 * ratio
                    body_tilt = -3.0 + 3.0 * ratio
                    arm_swing = 1.3 - 1.1 * ratio
                    sword_angle = -3.3 + 1.8 * ratio
            else:
                if sub_frame < 2:
                    ratio = sub_frame / 1.0
                    x_offset = 1.0 * ratio
                    body_tilt = 1.0 * ratio
                    bounce_y = 0.0
                    arm_swing = -0.3 * ratio
                    sword_angle = -1.5 + 1.2 * ratio
                elif sub_frame == 2:
                    x_offset = -4.0
                    body_tilt = -3.0
                    bounce_y = -1.0
                    leg_swing = 0.55
                    arm_swing = 1.4
                    sword_angle = -3.2
                    vfx_draw_queue.append(("slash", -0.2, -3.2, 10, 52, 0.85))
                elif sub_frame == 3:
                    x_offset = -4.5
                    body_tilt = -3.5
                    bounce_y = -1.0
                    leg_swing = 0.6
                    arm_swing = 1.5
                    sword_angle = -3.5
                    vfx_draw_queue.append(("slash", -1.8, -3.6, 10, 48, 0.45))
                else:
                    ratio = (sub_frame - 4) / 1.0
                    x_offset = -4.5 + 4.5 * ratio
                    body_tilt = -3.5 + 3.5 * ratio
                    leg_swing = 0.6 - 0.6 * ratio
                    arm_swing = 1.5 - 1.5 * ratio
                    sword_angle = -3.5 + 2.7 * ratio

        elif attack_type == "thrust":
            if frame < 4:
                ratio = frame / 3.0
                bounce_y = 1.0 * ratio
                x_offset = 2.0 * ratio
                body_tilt = 1.0 * ratio
                leg_swing = -0.15 * ratio
                arm_swing = -0.6 * ratio
                sword_angle = -3.14
            elif frame in [4, 5]:
                ratio = (frame - 4) / 1.0
                bounce_y = 1.0 - 1.5 * ratio
                x_offset = 2.0 - 7.0 * ratio
                body_tilt = 1.0 - 4.0 * ratio
                leg_swing = -0.15 + 0.65 * ratio
                arm_swing = -0.6 + 2.4 * ratio
                sword_angle = -3.14
                if frame == 4:
                    vfx_draw_queue.append(("thrust", -3.14, 30, 16, 0.75))
                else:
                    vfx_draw_queue.append(("thrust", -3.14, 60, 24, 0.95))
            elif frame < 10:
                bounce_y = -0.5
                x_offset = -5.0
                body_tilt = -3.0
                leg_swing = 0.5
                arm_swing = 1.8
                sword_angle = -3.14
                if frame == 6:
                    vfx_draw_queue.append(("thrust", -3.14, 45, 14, 0.45))
            else:
                ratio = (frame - 10) / 1.0
                bounce_y = -0.5 + 0.5 * ratio
                x_offset = -5.0 + 5.0 * ratio
                body_tilt = -3.0 + 3.0 * ratio
                leg_swing = 0.5 - 0.5 * ratio
                arm_swing = 1.8 - 1.8 * ratio
                sword_angle = -3.14 + 2.3 * ratio

        else:
            if frame < 4:
                ratio = frame / 3.0
                bounce_y = 1.0 * ratio
                x_offset = 2.0 * ratio
                body_tilt = 1.0 * ratio
                leg_swing = -0.15 * ratio
                arm_swing = -0.8 * ratio
                sword_angle = 1.3 + 1.2 * ratio
            elif frame in [4, 5]:
                ratio = (frame - 4) / 1.0
                bounce_y = 1.0 - 2.0 * ratio
                x_offset = 2.0 - 6.0 * ratio
                body_tilt = 1.0 - 4.0 * ratio
                leg_swing = -0.15 + 0.65 * ratio
                arm_swing = -0.8 + 2.2 * ratio
                if frame == 4:
                    sword_angle = -0.4
                    vfx_draw_queue.append(("slash", 2.2, -0.5, 12, 50, 0.75))
                else:
                    sword_angle = -3.1
                    vfx_draw_queue.append(("slash", -0.4, -3.2, 12, 54, 0.9))
            elif frame < 10:
                bounce_y = -1.0
                x_offset = -4.0
                body_tilt = -3.0
                leg_swing = 0.5
                arm_swing = 1.4
                sword_angle = -3.1
                if frame == 6:
                    vfx_draw_queue.append(("slash", -1.5, -3.2, 10, 48, 0.4))
            else:
                ratio = (frame - 10) / 1.0
                bounce_y = -1.0 + 1.0 * ratio
                x_offset = -4.0 + 4.0 * ratio
                body_tilt = -3.0 + 3.0 * ratio
                leg_swing = 0.5 - 0.5 * ratio
                arm_swing = 1.4 - 1.4 * ratio
                sword_angle = -3.1 + 2.3 * ratio

    # Adjust offsets
    cy += bounce_y
    hy += bounce_y
    cx += x_offset
    hx += x_offset

    # Draw far leg (right leg)
    r_leg_angle = 1.57 - leg_swing
    r_knee = (cx + 15 * math.cos(r_leg_angle), cy + 20 + 10 * math.sin(r_leg_angle))
    r_foot = (r_knee[0] + 12 * math.cos(r_leg_angle + 0.2), cy + 40)
    draw_capsule(draw, (cx + 3, cy + 10), r_knee, 5, colors["shadow"])
    draw_capsule(draw, r_knee, r_foot, 4, colors["shadow"])
    draw.ellipse([r_foot[0]-6, r_foot[1]-4, r_foot[0]+2, r_foot[1]+2], fill=HAIR_SHADOW)

    # Draw far arm (right arm)
    r_arm_angle = 1.57 + arm_swing
    r_elbow = (cx + 12 * math.cos(r_arm_angle), cy - 5 + 10 * math.sin(r_arm_angle))
    r_hand = (r_elbow[0] + 10 * math.cos(r_arm_angle + 0.3), r_elbow[1] + 10 * math.sin(r_arm_angle + 0.3))
    draw_capsule(draw, (cx + 6, cy - 8), r_elbow, 4.5, colors["shadow"])
    draw_capsule(draw, r_elbow, r_hand, 3.5, colors["shadow"])
    draw.ellipse([r_hand[0]-4, r_hand[1]-4, r_hand[0]+4, r_hand[1]+4], fill=SKIN_SHADOW)

    # Draw Torso / Clothing
    torso_points = [
        (cx - 9 - body_tilt, cy - 15),
        (cx + 9 - body_tilt, cy - 15),
        (cx + 7, cy + 12),
        (cx - 7, cy + 12)
    ]
    draw.polygon(torso_points, fill=colors["shadow"])
    torso_main = [
        (cx - 8 - body_tilt, cy - 15),
        (cx + 4 - body_tilt, cy - 15),
        (cx + 5, cy + 12),
        (cx - 7, cy + 12)
    ]
    draw.polygon(torso_main, fill=colors["main"])

    # Clothing details
    draw.line([(cx - 8 - body_tilt, cy - 15), (cx - 2, cy + 12)], fill=colors["trim"], width=2)
    if clothes_key == "shirtless_leather":
        chest_skin = [
            (cx - 3 - body_tilt, cy - 15),
            (cx + 3 - body_tilt, cy - 15),
            (cx, cy - 2)
        ]
        draw.polygon(chest_skin, fill=SKIN_LIGHT)

    # Draw head
    draw.ellipse([hx-10, hy-10, hx+10, hy+10], fill=SKIN_LIGHT)
    draw.ellipse([hx-10, hy-10, hx-3, hy+10], fill=SKIN_LIGHT)
    draw.chord([hx-10, hy-10, hx+10, hy+10], 0, 180, fill=SKIN_SHADOW)
    draw.ellipse([hx-9, hy-9, hx+9, hy+9], fill=SKIN_LIGHT)
    draw.rectangle([hx-7, hy-2, hx-5, hy+1], fill=(40, 30, 20))

    # Draw hair
    draw.chord([hx-10, hy-11, hx+10, hy+4], 180, 360, fill=HAIR_DARK)
    draw.chord([hx, hy-10, hx+11, hy+10], 270, 90, fill=HAIR_DARK)

    # Hair accessories
    if hair_type == "topknot":
        draw.ellipse([hx-4, hy-16, hx+4, hy-10], fill=HAIR_DARK)
        draw.line([(hx, hy-10), (hx, hy-15)], fill=(200, 50, 50), width=2)
    elif hair_type == "bun":
        draw.ellipse([hx+6, hy-7, hx+13, hy], fill=HAIR_DARK)
        draw.line([(hx+9, hy-10), (hx+9, hy+3)], fill=(220, 200, 100), width=1)
    elif hair_type == "bald_beard":
        draw.ellipse([hx-10, hy-10, hx+10, hy+10], fill=SKIN_LIGHT)
        draw.chord([hx-10, hy-10, hx+10, hy+10], 45, 135, fill=SKIN_SHADOW)
        draw.rectangle([hx-7, hy-2, hx-5, hy+1], fill=(40, 30, 20))
        draw.polygon([(hx-9, hy+3), (hx-3, hy+10), (hx+3, hy+10), (hx+7, hy+6), (hx+2, hy+13), (hx-8, hy+11)], fill=HAIR_DARK)
    elif hair_type == "ponytail":
        draw.ellipse([hx+7, hy-6, hx+12, hy-1], fill=HAIR_SHADOW)
        tail_pts = [(hx+9, hy-3), (hx+18, hy+5), (hx+22, hy+18), (hx+17, hy+18), (hx+12, hy+8)]
        draw.polygon(tail_pts, fill=HAIR_DARK)
    elif hair_type == "spiky":
        draw.polygon([(hx-10, hy-8), (hx-13, hy-14), (hx-6, hy-11), (hx-2, hy-16), (hx+4, hy-11), (hx+9, hy-14), (hx+9, hy-4)], fill=HAIR_DARK)
    elif hair_type == "headband":
        draw.line([(hx-10, hy-4), (hx+10, hy-4)], fill=(220, 220, 220), width=4)
        draw.polygon([(hx+9, hy-4), (hx+16, hy), (hx+14, hy+6), (hx+8, hy+1)], fill=(200, 200, 200))
    elif hair_type == "ribbon":
        draw.line([(hx+6, hy+5), (hx+11, hy+28)], fill=HAIR_DARK, width=4)
        draw.ellipse([hx+9, hy+27, hx+13, hy+33], fill=(210, 40, 40))

    # Draw near leg (left leg)
    l_leg_angle = 1.57 + leg_swing
    l_knee = (cx - 15 * math.cos(l_leg_angle - 0.2), cy + 20 + 10 * math.sin(l_leg_angle - 0.2))
    l_foot = (l_knee[0] - 12 * math.cos(l_leg_angle), cy + 40)
    draw_capsule(draw, (cx - 3, cy + 10), l_knee, 5.5, colors["main"])
    draw_capsule(draw, l_knee, l_foot, 4.5, colors["main"])
    draw.ellipse([l_foot[0]-7, l_foot[1]-4, l_foot[0]+1, l_foot[1]+2], fill=HAIR_DARK)

    # Draw near arm (left arm)
    l_arm_angle = 1.57 - arm_swing
    l_elbow = (cx - 12 * math.cos(l_arm_angle), cy - 5 + 10 * math.sin(l_arm_angle))
    l_hand = (l_elbow[0] - 10 * math.cos(l_arm_angle - 0.3), l_elbow[1] + 10 * math.sin(l_arm_angle - 0.3))
    draw_capsule(draw, (cx - 6, cy - 8), l_elbow, 5, colors["main"])
    draw_capsule(draw, l_elbow, l_hand, 4, colors["main"])
    draw.ellipse([l_hand[0]-4.5, l_hand[1]-4.5, l_hand[0]+4.5, l_hand[1]+4.5], fill=SKIN_LIGHT)

    # Draw Weapon
    wx, wy = l_hand[0], l_hand[1]

    if cls == "SWORD":
        blade_len = 38 if gender == "MALE" else 32
        sword_angle = -0.78
        if is_attack:
            sword_angle = sword_angle_calc = sword_angle # placeholder
            sword_angle = sword_angle_calc = locals().get('sword_angle', -0.78)
        bx_end = wx + blade_len * math.cos(sword_angle)
        by_end = wy + blade_len * math.sin(sword_angle)
        hx_end = wx - 8 * math.cos(sword_angle)
        hy_end = wy - 8 * math.sin(sword_angle)
        draw.line([(wx, wy), (hx_end, hy_end)], fill=(150, 100, 50), width=3)
        draw.line([(wx - 2*math.sin(sword_angle), wy + 2*math.cos(sword_angle)), 
                   (wx + 2*math.sin(sword_angle), wy - 2*math.cos(sword_angle))], fill=(220, 180, 50), width=4)
        draw.line([(wx, wy), (bx_end, by_end)], fill=(210, 220, 235), width=2)
        draw.ellipse([bx_end-1.5, by_end-1.5, bx_end+1.5, by_end+1.5], fill=(255, 255, 255))

    elif cls == "BLADE":
        blade_len = 34 if gender == "MALE" else 30
        blade_width = 5 if gender == "MALE" else 4
        sword_angle = -0.5
        if is_attack:
            sword_angle = locals().get('sword_angle', -0.5)
        bx_end = wx + blade_len * math.cos(sword_angle)
        by_end = wy + blade_len * math.sin(sword_angle)
        hx_end = wx - 7 * math.cos(sword_angle)
        hy_end = wy - 7 * math.sin(sword_angle)
        draw.line([(wx, wy), (hx_end, hy_end)], fill=(90, 40, 20), width=4)
        perp_angle = sword_angle + 1.57
        p_offset = blade_width
        b_pts = [
            (wx, wy),
            (bx_end, by_end),
            (bx_end - p_offset * math.cos(perp_angle), by_end - p_offset * math.sin(perp_angle)),
            (wx - p_offset * 0.5 * math.cos(perp_angle), wy - p_offset * 0.5 * math.sin(perp_angle))
        ]
        draw.polygon(b_pts, fill=(180, 185, 195))
        draw.line([(wx, wy), (bx_end, by_end)], fill=(240, 245, 255), width=1)

    elif cls == "FIST":
        glove_color = (235, 140, 20) if gender == "MALE" else (225, 60, 60)
        draw.ellipse([wx-6, wy-6, wx+6, wy+6], fill=glove_color)
        draw.ellipse([wx-5, wy-5, wx+3, wy+3], fill=(glove_color[0]+20, glove_color[1]+20, glove_color[2]+20))
        draw.ellipse([r_hand[0]-5, r_hand[1]-5, r_hand[0]+5, r_hand[1]+5], fill=colors["shadow"])
        if is_attack and (frame in [2, 3, 4, 5, 8, 9, 10]):
            vfx_draw_queue.append(("impact", 0, 10, 0.75))

    elif cls == "SPEAR":
        spear_angle = -0.6
        if is_attack:
            spear_angle = locals().get('sword_angle', -0.6)
        shaft_len = 65
        tip_len = 15
        shaft_start_x = wx - (shaft_len * 0.4) * math.cos(spear_angle)
        shaft_start_y = wy - (shaft_len * 0.4) * math.sin(spear_angle)
        shaft_end_x = wx + (shaft_len * 0.6) * math.cos(spear_angle)
        shaft_end_y = wy + (shaft_len * 0.6) * math.sin(spear_angle)
        draw.line([(shaft_start_x, shaft_start_y), (shaft_end_x, shaft_end_y)], fill=(120, 80, 40), width=2)
        tassel_x = (shaft_end_x + 2 * math.cos(spear_angle))
        tassel_y = (shaft_end_y + 2 * math.sin(spear_angle))
        draw.ellipse([tassel_x-3, tassel_y-3, tassel_x+3, tassel_y+3], fill=(210, 40, 40))
        head_end_x = shaft_end_x + tip_len * math.cos(spear_angle)
        head_end_y = shaft_end_y + tip_len * math.sin(spear_angle)
        perp_angle = spear_angle + 1.57
        head_pts = [
            (shaft_end_x, shaft_end_y),
            (shaft_end_x - 3 * math.cos(perp_angle), shaft_end_y - 3 * math.sin(perp_angle)),
            (head_end_x, head_end_y),
            (shaft_end_x + 3 * math.cos(perp_angle), shaft_end_y + 3 * math.sin(perp_angle))
        ]
        draw.polygon(head_pts, fill=(200, 210, 225))
        draw.line([(shaft_end_x, shaft_end_y), (head_end_x, head_end_y)], fill=(255, 255, 255), width=1)

    # Render VFX Queue (Draw overlay)
    for vfx in vfx_draw_queue:
        vfx_type = vfx[0]
        if cls == "SWORD":
            vfx_color = (180, 215, 255)
        elif cls == "BLADE":
            vfx_color = (255, 75, 45)
        elif cls == "SPEAR":
            vfx_color = (40, 220, 160)
        else: # FIST
            vfx_color = (255, 195, 30)

        if vfx_type == "slash":
            start_ang, end_ang, r_in, r_out, alpha = vfx[1], vfx[2], vfx[3], vfx[4], vfx[5]
            col = (vfx_color[0], vfx_color[1], vfx_color[2], int(alpha * 220))
            draw_glow_arc(draw, (wx, wy), r_in, r_out, start_ang, end_ang, col)
            core_col = (255, 255, 255, int(alpha * 255))
            draw_glow_arc(draw, (wx, wy), r_in + 4, r_out - 6, start_ang + 0.1, end_ang - 0.1, core_col)
        elif vfx_type == "thrust":
            ang, length, width, alpha = vfx[1], vfx[2], vfx[3], vfx[4]
            col = (vfx_color[0], vfx_color[1], vfx_color[2], int(alpha * 200))
            draw_thrust_wave(draw, (wx, wy), ang, length, width, col)
            core_col = (255, 255, 255, int(alpha * 255))
            draw_thrust_wave(draw, (wx, wy), ang, length * 0.9, width * 0.4, core_col)
        elif vfx_type == "impact":
            ang, radius, alpha = vfx[1], vfx[2], vfx[3]
            col = (vfx_color[0], vfx_color[1], vfx_color[2], int(alpha * 180))
            draw.ellipse([wx - radius, wy - radius, wx + radius, wy + radius], fill=col)
            draw.ellipse([wx - radius*0.5, wy - radius*0.5, wx + radius*0.5, wy + radius*0.5], fill=(255, 255, 255, int(alpha*240)))

    # Apply thick black outline
    img = apply_outline(img, outline_color=(5, 5, 10, 255), thickness=2)
    return img

def create_spritesheet(char_id: str, action: str, frames: int):
    sheet_w = 128 * frames
    sheet_h = 128
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    for i in range(frames):
        frame_img = draw_character_frame(char_id, action, i)
        sheet.paste(frame_img, (i * 128, 0), frame_img)

    out_path = OUT_DIR / f"hero_{char_id}_{action}.png"
    sheet.save(out_path)
    print(f"Generated: {out_path.name} ({sheet_w}x{sheet_h})")

def main():
    print("Generating procedural hero spritesheets (12 frames)...")
    for char_id in CHARACTERS.keys():
        create_spritesheet(char_id, "idle", 12)
        create_spritesheet(char_id, "run", 12)
        create_spritesheet(char_id, "attack", 12)
        create_spritesheet(char_id, "attack_heavy", 12)
        create_spritesheet(char_id, "attack_quick", 12)
        create_spritesheet(char_id, "attack_thrust", 12)
    print("All hero assets generated successfully!")

if __name__ == "__main__":
    main()
