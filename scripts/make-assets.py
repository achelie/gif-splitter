"""Generate the original geometric sample GIF and social preview. Requires Pillow."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

out = Path(__file__).resolve().parent.parent / 'public'
out.mkdir(exist_ok=True)
frames = []
for i in range(24):
    im = Image.new('RGB', (480, 300), '#f4efe5')
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((20, 20, 460, 280), radius=18, fill='#fbf8f1', outline='#e5dece', width=2)
    d.ellipse((145, 55, 335, 245), outline='#dfd6c4', width=2)
    angle = i * math.tau / 24
    x, y = 240 + 95 * math.cos(angle), 150 + 95 * math.sin(angle)
    d.ellipse((205, 115, 275, 185), fill='#be4519')
    d.ellipse((219, 125, 235, 141), fill='#df7c50')
    d.ellipse((x-16, y-16, x+16, y+16), fill='#778b70')
    d.ellipse((x-7, y-11, x, y-4), fill='#acb59b')
    d.line((54, 56, 68, 56), fill='#b7ad99', width=2)
    d.line((61, 49, 61, 63), fill='#b7ad99', width=2)
    d.ellipse((405, 235, 411, 241), fill='#be4519')
    frames.append(im)
frames[0].save(out / 'sample.gif', save_all=True, append_images=frames[1:], duration=80, loop=0, disposal=1, optimize=True)

im = Image.new('RGB', (1200, 630), '#fafaf9')
d = ImageDraw.Draw(im)
font_dir = Path('C:/Windows/Fonts')
def font(size, bold=False):
    return ImageFont.truetype(str(font_dir / ('segoeuib.ttf' if bold else 'segoeui.ttf')), size)
d.rounded_rectangle((60, 55, 1140, 575), radius=24, fill='#ffffff', outline='#e5e5df', width=2)
d.rounded_rectangle((100, 96, 152, 148), radius=12, fill='#be4519')
d.rounded_rectangle((119, 115, 141, 137), radius=4, outline='#ffffff', width=2)
d.line((109, 127, 109, 108, 128, 108), fill='#ffffff', width=2)
d.text((168, 103), 'GIF Splitter', font=font(25, True), fill='#282824')
d.text((100, 204), 'Every frame,', font=font(68, True), fill='#282824')
d.text((100, 280), 'yours to keep.', font=font(68, True), fill='#be4519')
d.text((104, 393), 'GIF to PNG. One frame or the whole story.', font=font(24), fill='#6c6c66')
d.text((104, 486), 'Free  /  Private  /  No uploads', font=font(21), fill='#6c6c66')
for j, pos in enumerate([(824, 180), (795, 215), (765, 250)]):
    x,y=pos
    d.rounded_rectangle((x,y,x+205,y+185),radius=16,fill=['#eeeae1','#f5f1e8','#ffffff'][j],outline='#d6d3cb',width=2)
    d.ellipse((x+63,y+45,x+143,y+125),fill=['#dca480','#cd764e','#be4519'][j])
d.text((789, 405), '001  /  PNG', font=font(18), fill='#6c6c66')
im.save(out / 'og.png', optimize=True)
print('Created public/sample.gif and public/og.png')
