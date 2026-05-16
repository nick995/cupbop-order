"""
Remove the (light) background of cupbop-truck.png by flood-filling
from the four corners. Interior whites (driver face, headlights, etc.)
stay intact because they're not connected to the corners through
similar-colored pixels — bold black outlines separate them.
"""

from PIL import Image
from collections import deque
import sys
from pathlib import Path

SRC = Path("scripts/image-backups/cupbop-truck-original.png")
DST = Path("public/images/cupbop-truck.png")

# Pixels with all channels >= this and low saturation are considered background-like
BRIGHTNESS_MIN = 180       # 0-255 — lower catches anti-aliased gray edge pixels
MAX_CHANNEL_SPREAD = 40    # max(R,G,B) - min(R,G,B) ≤ this → near-grayscale


def is_bg_like(pixel):
    r, g, b, a = pixel
    if a == 0:
        return True
    if r < BRIGHTNESS_MIN or g < BRIGHTNESS_MIN or b < BRIGHTNESS_MIN:
        return False
    if max(r, g, b) - min(r, g, b) > MAX_CHANNEL_SPREAD:
        return False
    return True


def main():
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    visited = [[False] * h for _ in range(w)]
    queue = deque()

    # seed from the 4 corners + sample along edges
    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
    ]
    for x in range(0, w, max(1, w // 20)):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(0, h, max(1, h // 20)):
        seeds.append((0, y))
        seeds.append((w - 1, y))

    cleared = 0
    for sx, sy in seeds:
        if visited[sx][sy]:
            continue
        if not is_bg_like(pixels[sx, sy]):
            continue
        queue.append((sx, sy))
        visited[sx][sy] = True

        while queue:
            x, y = queue.popleft()
            r, g, b, _ = pixels[x, y]
            pixels[x, y] = (r, g, b, 0)
            cleared += 1
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                    visited[nx][ny] = True
                    if is_bg_like(pixels[nx, ny]):
                        queue.append((nx, ny))

    img.save(DST, "PNG", optimize=True)
    print(f"Cleared {cleared} background pixels out of {w*h} total")


if __name__ == "__main__":
    sys.exit(main())
