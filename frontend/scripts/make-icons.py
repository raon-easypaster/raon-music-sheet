import sys, os
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]
GREEN = (20, 83, 45, 255); GOLD = (212, 175, 55, 255); IVORY = (250, 248, 243, 255)

def font(px):
    for p in ['/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
              '/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf',
              '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()

def make(size, full=False):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    if full:
        d.rectangle([0, 0, S, S], fill=GREEN); scale = 0.5
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=GREEN); scale = 0.62
        inset = int(S * 0.06)
        d.rounded_rectangle([inset, inset, S - 1 - inset, S - 1 - inset], radius=int(S * 0.17), outline=GOLD, width=max(4, S // 90))
    f = font(int(S * scale)); t = 'R'
    b = d.textbbox((0, 0), t, font=f); w = b[2] - b[0]; h = b[3] - b[1]
    top = (S - h) / 2 - S * 0.04
    d.text(((S - w) / 2 - b[0], top - b[1]), t, font=f, fill=IVORY)
    y = top + h + S * 0.06
    lw = S * (0.18 if full else 0.22)
    d.line([(S / 2 - lw, y), (S / 2 + lw, y)], fill=GOLD, width=max(4, S // 60))
    return img.resize((size, size), Image.LANCZOS)

make(192).save(f'{out}/icon-192.png')
make(512).save(f'{out}/icon-512.png')
make(512, True).save(f'{out}/icon-maskable-512.png')
make(180, True).convert('RGB').save(f'{out}/apple-touch-icon.png')
