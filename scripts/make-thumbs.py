#!/usr/bin/env python3
"""480px cover thumbnails for the enter-gate mosaic. It fills the screen (8x3
cells ~160x300px CSS at 1280x900, 4x6 ~98x111px on phones) dimmed under a
gradient, so 480 is ample even at 2x DPR. The full covers stay for the
hero, wall tiles, wheel and og:image.

  python3 scripts/make-thumbs.py            # write missing thumbs
  python3 scripts/make-thumbs.py --all      # rewrite every thumb

Needs Pillow. Output: public/images/tracks/thumbs/<cover name>.jpg
(cover-thumbs.test.ts checks every catalogue cover has one).
"""
import os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "public/images/tracks")
OUT = os.path.join(SRC, "thumbs")
SIZE, QUALITY = 480, 78

def main():
    os.makedirs(OUT, exist_ok=True)
    every = "--all" in sys.argv
    n = 0
    for name in sorted(os.listdir(SRC)):
        if not name.endswith(".jpg"):
            continue
        dest = os.path.join(OUT, name)
        if os.path.exists(dest) and not every:
            continue
        im = Image.open(os.path.join(SRC, name)).convert("RGB")
        im.resize((SIZE, SIZE), Image.LANCZOS).save(dest, "JPEG", quality=QUALITY, optimize=True)
        n += 1
    print(f"wrote {n} thumb(s) to public/images/tracks/thumbs")

if __name__ == "__main__":
    main()
