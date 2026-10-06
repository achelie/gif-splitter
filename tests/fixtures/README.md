# Decoder fixtures

`pillow-interlaced.gif` is an independently encoded, interlaced 96 × 96 GIF
with a 256-color palette. It was generated with Python 3.13 and Pillow 12.2.0.
The test checks every decoded pixel against the procedural source image,
without relying on another LZW decoder or the implementation under test.

To reproduce the fixture (Pillow is only needed for regeneration):

```python
from pathlib import Path
from PIL import Image

width = height = 96
image = Image.new('P', (width, height))
image.putpalette([
    channel
    for index in range(256)
    for channel in (index, (index * 73) & 255, (index * 151) & 255)
])
image.putdata([
    ((x * 73 + y * 151 + ((x * y * 17) >> 3)) ^ (x * 11 + y * 31)) & 255
    for y in range(height)
    for x in range(width)
])
image.save(
    Path('tests/fixtures/pillow-interlaced.gif'),
    format='GIF', optimize=False, interlace=True,
)
```

The other compressed streams in `gif-decoder.test.js` use explicit code widths
and known pixels. In particular, the deferred-clear test fills all 4096
dictionary entries, continues at 12 bits, then emits a clear followed by 9-bit
codes. Its packer only writes bits; it does not implement dictionary handling.
