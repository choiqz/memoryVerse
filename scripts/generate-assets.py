# Generates app store image assets: icon, adaptive icon, splash, favicon.
# Run from project root: python scripts/generate-assets.py
#
# Design: white open-book glyph with a rising spark on a purple gradient,
# matching the app's primary color (#8B5CF6 / #7C3AED).

from PIL import Image, ImageDraw, ImageFont
import os

SS = 4  # supersampling factor for crisp anti-aliased curves

PRIMARY = (139, 92, 246)        # #8B5CF6
PRIMARY_DARK = (109, 40, 217)   # #6D28D9
SPLASH_BG = (124, 58, 237)      # #7C3AED (matches app.json backgroundColor)
WHITE = (255, 255, 255, 255)
SPARK_GOLD = (252, 211, 77, 255)  # #FCD34D


def quad_bezier(p0, p1, p2, steps=40):
    """Sample a quadratic bezier curve into a list of points."""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y))
    return pts


def gradient_bg(size, top_color, bottom_color):
    """Vertical gradient image."""
    strip = Image.new('RGB', (1, 256))
    for y in range(256):
        t = y / 255
        strip.putpixel((0, y), tuple(
            round(top_color[c] + (bottom_color[c] - top_color[c]) * t) for c in range(3)
        ))
    return strip.resize(size, Image.LANCZOS)


def draw_glyph(draw, cx, cy, scale, color=WHITE, spark_color=SPARK_GOLD):
    """Open book with a spark above the spine. scale=1 fits ~600px wide."""
    s = scale

    def pt(x, y):
        return (cx + x * s, cy + y * s)

    gap = 14  # spine gap so the background shows through

    # Left page: top edge curves down from spine, outer edge, bottom edge curves back
    left = (
        quad_bezier(pt(-gap, -120), pt(-150, -165), pt(-280, -130))
        + [pt(-280, 95)]
        + quad_bezier(pt(-280, 95), pt(-150, 130), pt(-gap, 175))
    )
    draw.polygon(left, fill=color)

    # Right page (mirror)
    right = (
        quad_bezier(pt(gap, -120), pt(150, -165), pt(280, -130))
        + [pt(280, 95)]
        + quad_bezier(pt(280, 95), pt(150, 130), pt(gap, 175))
    )
    draw.polygon(right, fill=color)

    # Spark: four-point star above the spine
    sx, sy = pt(0, -255)
    R, r = 78 * s, 20 * s
    star = [
        (sx, sy - R), (sx + r, sy - r), (sx + R, sy), (sx + r, sy + r),
        (sx, sy + R), (sx - r, sy + r), (sx - R, sy), (sx - r, sy - r),
    ]
    draw.polygon(star, fill=spark_color)

    # Two small companion dots
    for dx, dy, dr in [(-95, -245, 14), (95, -245, 14)]:
        ox, oy = pt(dx, dy)
        rr = dr * s
        draw.ellipse([ox - rr, oy - rr, ox + rr, oy + rr], fill=spark_color)


def make_icon(path, size=1024):
    big = size * SS
    img = gradient_bg((big, big), PRIMARY, PRIMARY_DARK).convert('RGBA')
    draw = ImageDraw.Draw(img)
    draw_glyph(draw, big / 2, big / 2 + 40 * SS, SS * size / 1024 * 1.05)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print('wrote', path)


def make_adaptive_icon(path, size=1024):
    # Foreground layer: transparent, glyph inside the ~66% safe zone
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_glyph(draw, big / 2, big / 2 + 30 * SS, SS * size / 1024 * 0.72)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print('wrote', path)


def make_splash(path, w=1284, h=2778):
    big_w, big_h = w * SS, h * SS
    img = Image.new('RGBA', (big_w, big_h), SPLASH_BG + (255,))
    draw = ImageDraw.Draw(img)
    draw_glyph(draw, big_w / 2, big_h / 2 - 60 * SS, SS * 0.62)

    # Wordmark below the glyph
    font = None
    for candidate in [r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\arialbd.ttf']:
        if os.path.exists(candidate):
            font = ImageFont.truetype(candidate, 92 * SS)
            break
    if font:
        text = 'memoryVerse'
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        draw.text(((big_w - tw) / 2 - bbox[0], big_h / 2 + 220 * SS), text,
                  font=font, fill=WHITE)

    img = img.resize((w, h), Image.LANCZOS)
    img.save(path)
    print('wrote', path)


def make_favicon(icon_path, path, size=48):
    Image.open(icon_path).resize((size, size), Image.LANCZOS).save(path)
    print('wrote', path)


if __name__ == '__main__':
    root = os.path.join(os.path.dirname(__file__), '..', 'assets')
    make_icon(os.path.join(root, 'icon.png'))
    make_adaptive_icon(os.path.join(root, 'adaptive-icon.png'))
    make_splash(os.path.join(root, 'splash.png'))
    make_favicon(os.path.join(root, 'icon.png'), os.path.join(root, 'favicon.png'))
