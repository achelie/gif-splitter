"""Regenerate a transparent animated GIF and its independent RGBA reference.

Requires Pillow; the checked-in fixtures mean it is not a test dependency.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence

out = Path(__file__).resolve().parents[1] / 'tests' / 'fixtures'
frames = []
for rect, color in [((0, 0, 5, 5), 'red'), ((4, 2, 9, 7), 'green'),
                    ((2, 4, 7, 9), 'blue'), ((7, 0, 11, 4), 'yellow')]:
    frame = Image.new('RGBA', (12, 10), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rectangle(rect, fill=color)
    frames.append(frame)

gif_path = out / 'pillow-composite.gif'
frames[0].save(gif_path, save_all=True, append_images=frames[1:],
               duration=[40, 50, 60, 70], disposal=[1, 2, 3, 1],
               loop=0, transparency=0, optimize=True)
with Image.open(gif_path) as gif:
    (out / 'pillow-composite.rgba').write_bytes(
        b''.join(frame.convert('RGBA').tobytes() for frame in ImageSequence.Iterator(gif))
    )
