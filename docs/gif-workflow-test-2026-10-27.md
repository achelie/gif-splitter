# GIF 拆帧流程测试记录（2026-10-27）

测试对象为本地生产构建，通过 Wrangler Pages 提供与站点相同的安全响应头；不是对线上版本的发布验证。桌面浏览器使用 Google Chrome 155.0.8059.86 和 Windows 上的 Playwright WebKit 26.6。移动测试使用 320px 宽的模拟视口，并非真实手机。

| 测试 | 样本和验证方法 | 结果 |
| --- | --- | --- |
| 普通 GIF 流程 | 480×300、24 帧的站内示例；预览、播放、选择第 1/5 帧、单张下载、选中和全部 ZIP，检查文件名、PNG 尺寸和 ZIP 条目顺序 | 通过 |
| 透明与复杂叠加 | Pillow 独立编码并解码的 12×10、4 帧 GIF，含局部更新和 disposal 1/2/3；对浏览器下载的单张 PNG 和 ZIP 中全部 PNG 逐帧比对 RGBA 像素 | 通过，透明度、完整画面和顺序与参考结果一致 |
| 文件大小限制 | 单元测试用尾部填充构造正好 30 MiB 的 GIF，可提取；浏览器测试 30 MiB + 1 字节显示大小限制提示 | 通过；30 MiB 样本不是高分辨率的大型真实动画 |
| 帧数限制 | 浏览器中使用 2×1 像素的 1,000 帧和 1,001 帧 GIF；前者完成提取，后者显示帧数限制提示 | 通过；未验证高分辨率的 1,000 帧动画 |
| 内存限制 | 4,000×4,000、6 帧样本，完整输出需 9,600 万像素，超过 8,000 万输出像素保护；检查提示与恢复 | 通过 |
| 损坏文件与恢复 | 两个损坏 GIF 显示错误后重新上传正常文件 | 通过 |
| 取消和重新开始 | 解码中取消，确认 Worker 终止，再上传文件；另测试选择另一个 GIF | 通过 |
| 手机尺寸与多语言 | 10 种语言在 320px 宽下检查横向溢出；模拟视口下载 PNG 和 ZIP。另人工检查首页 320×568、390×844 和桌面 1280×800 布局 | 通过；不是手机系统的下载验证 |

本轮没有发现需要修改的 GIF 合成或下载逻辑。首页现在展示一次处理一个 GIF、30 MiB / 1,000 帧上限、免费免注册，并说明本地处理及 PNG / ZIP 下载；大小提示统一使用二进制单位。额外的尺寸、像素、内存及 ZIP 限制仍可能先触发。

## 复现

```powershell
npm test
npm run build:production
npm run check:site -- --production-domain
$env:BROWSER_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:browser
Remove-Item Env:BROWSER_EXECUTABLE_PATH
$env:BROWSER_ENGINE = 'webkit'
npm run test:browser
Remove-Item Env:BROWSER_ENGINE
```

WebKit 需要先运行 `npx playwright install webkit`。测试在本地启动和关闭 Wrangler，下载产物及运行记录保存在被 Git 忽略的 `output/playwright/`。两个浏览器测试应顺序运行，因为它们共享产物目录。

## 仍需实机确认

- 在 iPhone / iPad Safari、Mac Safari 和至少一台 Android 手机上测试文件选择、单张及 ZIP 的系统下载与保存位置。
- 用真实、较大的高分辨率和多帧 GIF 检查低内存设备的表现。小样本通过不能保证其他文件或设备一定成功。
- 本地生产构建的通过结果不代表线上已更新或线上浏览器测试已经完成。
