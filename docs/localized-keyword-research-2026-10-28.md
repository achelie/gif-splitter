# 新工具页多语言关键词研究

研究日期：2026-10-28。目标是为五个已实现工具选择自然的本地语言表达，并避免承诺不存在的功能：合并仅支持顺序连接；JPG/WebP 导出静态帧；缩放和裁剪保留 GIF 动画。

Google Trends 的相对指数不是月搜索量。零值可能是相对量过低或样本不足，不代表没有搜索；同组之外的指数不能直接比较。本记录仅反映所列查询的当时结果，不说明未来排名或流量。查询链接使用滚动的最近 12 个月窗口，点击后可能与研究日结果不同。

## Google Trends 查询

| 地区 | 搜索字词（网页搜索，最近 12 个月） | 观察 |
| --- | --- | --- |
| 西班牙 ES | [combinar gifs、cambiar tamano gif、recortar gif、gif a jpg、gif a webp](https://trends.google.com/trends/explore?date=today%2012-m&geo=ES&q=combinar%20gifs,cambiar%20tamano%20gif,recortar%20gif,gif%20a%20jpg,gif%20a%20webp) | 当次组内相对平均依次为 0、0、1、5、0；相关查询出现 `recortar gif online`、`de gif a jpg`。这里实际查询为不带 ñ 的 `tamano`，不能当作带重音形式的结果。 |
| 巴西 BR | [juntar gifs、redimensionar gif、recortar gif、gif para jpg、gif para webp](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=juntar%20gifs,redimensionar%20gif,recortar%20gif,gif%20para%20jpg,gif%20para%20webp) | 当次组内相对平均依次为 0、26、18、30、26；0 不等于无需求。 |
| 法国 FR | [redimensionner gif、recadrer gif、fusionner gif、gif en jpg、gif en webp](https://trends.google.com/trends/explore?date=today%2012-m&geo=FR&q=redimensionner%20gif,recadrer%20gif,fusionner%20gif,gif%20en%20jpg,gif%20en%20webp) | 当次组内相对平均依次为 0、0、2、1、2，周数据稀疏；不能据此断言无需求或稳定热度。 |
| 日本 JP | `gif 結合` 与 `gif 連結` 等 | 请求返回 HTTP 429，没有取得可比较趋势值。 |
| 韩国 KR | `GIF 합치기`、`GIF 크기 조절`、`GIF 자르기` | 请求返回 HTTP 429，没有取得可比较趋势值。 |
| 台湾 TW | `GIF 合併`、`GIF 調整尺寸`、`GIF 裁切` | 请求返回 HTTP 429，没有取得可比较趋势值。 |
| 德国 DE | `gif zusammenfügen`、`gif Größe ändern`、`gif zuschneiden` | 请求返回 HTTP 429，没有取得可比较趋势值。 |
| 意大利 IT | `unire gif`、`ridimensionare gif`、`ritagliare gif` | 请求返回 HTTP 429，没有取得可比较趋势值。 |
| 俄罗斯 RU | `gif объединить`、`gif обрезать` | 请求返回 HTTP 429，没有取得可比较趋势值。 |
| 墨西哥 MX | `combinar gifs`、`recortar gif`、`gif a jpg` | 请求返回 HTTP 429，没有取得可比较趋势值；西班牙结果不能直接代表墨西哥。 |

以上成功的五词组比较的是不同工具需求，并非同一工具不同同义词的直接胜负。选词还需结合语言自然度、功能准确性和后续 Search Console 表现。

## 自然用法与翻译判断

| 语言 | 合并 / 调整尺寸 / 裁剪 / 转换 | 用法参考（不代表搜索量） |
| --- | --- | --- |
| 日语 | GIF 結合；GIF サイズ変更；GIF トリミング；GIFをJPG/WebPに変換 | [GIF 合并](https://tools.studioasari.co.jp/design-tools/gifmerge)、[尺寸调整](https://watermarkly.com/ja/resize-gif/)、[裁剪](https://www.gifspeed.com/ja/gif-cropper) |
| 韩语 | GIF 합치기；GIF 크기 조절；GIF 자르기；GIF JPG/WebP 변환 | [GIF 工具](https://imageonline.io/ko/gif-tools/)、[GIF 转 JPG](https://imageonline.io/ko/gif-to-jpg/) |
| 繁体中文（台湾） | GIF 合併；GIF 調整尺寸；GIF 裁切；GIF 轉 JPG/WebP | [繁体中文图片工具](https://imagestool.com/zh_TW/)、[GIF 转 WebP](https://anyconv.com/tw/gif-zhuan-webp/) |
| 西班牙语 | combinar GIF；cambiar el tamaño de GIF；recortar GIF；GIF a JPG/WebP | [GIF 合并](https://convertico.com/es/fusi%C3%B3n-de-gifs/)；结合 ES Trends 及语言判断。 |
| 巴西葡语 | juntar GIFs；redimensionar GIF；recortar GIF；GIF para JPG/WebP | [葡语 GIF 工具](https://omyimage.com/pt/juntar-gif)；`recortar` 更明确指画面，`cortar` 也可能指剪辑时长。 |
| 法语 | fusionner des GIF；redimensionner GIF；recadrer GIF；GIF en JPG/WebP | [法语 GIF 工具](https://imageonline.io/fr/gif-tools/) |
| 德语 | GIFs zusammenfügen；GIF-Größe ändern；GIF zuschneiden；GIF in JPG/WebP umwandeln | [GIF 合并](https://imageonline.io/de/merge-gifs/)、[GIF 裁剪](https://imagy.app/de/crop-gif-online/)、[转换词用法](https://yunknow.cc/de/lab/) |
| 意大利语 | unire GIF；ridimensionare GIF；ritagliare GIF；GIF in JPG/WebP | [意大利语 GIF 工具](https://imageonline.io/it/gif-tools/)、[GIF 调整尺寸](https://xatools.net/it/ridimensionare-gif/) |
| 俄语 | объединить GIF；изменить размер GIF；обрезать GIF；GIF в JPG/WebP | [俄语 GIF 工具](https://imageonline.io/ru/gif-tools/)；裁剪应在正文明确为画面区域，而非截取动画时间。 |

这些用法是研究与本地化判断。上线后应按页面、国家、查询和语言查看 Search Console 数据，再决定是否调整标题或正文。
