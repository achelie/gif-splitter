# GIF Splitter：CMP 配置、验收与广告启用

2026-10-05。本站正在审核；本轮默认 `ADSENSE_MODE=off`，不重复提交、不投放。本文是配置与待执行验收说明，不表示后台操作已经完成。

## 1. 发布前核对

在现有 AdSense 账号核对本站域名和现有发布商 `ca-pub-7443237558968985`。保留 ads.txt，不创建第二个账号。关闭本站 Auto Ads，并保存脱敏证据。Ready 状态必须来自本站 Sites 后台。[站点管理](https://support.google.com/adsense/answer/12131223?hl=en)

站长已确认 Cloudflare Free，并授权发布。本次 `off` 构建采用纯静态 Pages，所有页面与 GIF 功能均不执行 Functions，不依赖每日 100000 次请求及 10 ms CPU 额度。静态 CSP 用精确 SHA-256 授权分析 bootstrap，保留安全头与 `no-transform`，无 nonce 占位符。静态资源请求免费且不限量。[Pages Functions 计费](https://developers.cloudflare.com/pages/functions/pricing/)

未来进入 `consent`/`live` 后，HTML 才会执行 nonce `_worker.js`；`_routes.json` 排除静态资源。那时重新核对实际 Functions 余量，并将 `fail_open: true` 改为 fail closed，避免超额绕过 nonce/CSP。当前 `off` 未部署 Worker，超额设置不影响本次功能；后台设置未改变。详见[配额核验记录](cloudflare-quota-check-2026-10-05.md)、[Fail open/closed](https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed)。

## 2. Google Privacy & messaging

在对应账号为本站建立 European regulations 消息，使用 Google 当前的 TCF v2.3 实施。填写真实站点名称和隐私政策 URL，展示接受、管理选项、拒绝三个入口；核对可见性、管理选项和返回路径，然后发布。只使用官方标准 Google 标签，不配置广告代理或 Google Cookie 改写。[TCF 更新要求](https://support.google.com/adsense/answer/16942036?hl=en)、[CMP 要求](https://support.google.com/adsense/answer/13554116?hl=en)

开启 Google 支持的英语、日语、西班牙语、法语、德语、意大利语、俄语、葡萄牙语消息语言，默认英语。韩语、繁中和不能匹配的地区语言使用英语回退。葡萄牙语需用 `pt-BR`、`pt-PT` 及不同设备语言分别测试，不能把网站有巴葡翻译等同于 CMP 支持巴葡。网站正文和设置入口维持十语种完整翻译。[支持语言](https://support.google.com/adsense/answer/10924669?hl=en)

Privacy 路由不加载 Clarity、Google 广告或 CMP 消息标签。它的设置链接转至同语言首页 `?privacy-settings=1`，首页等待官方 API 后打开 `googlefc.showRevocationMessage()`。页面导航会依正常工具行为释放当前 GIF；在当前工具页直接撤回不会清除工作文件。[隐私页要求](https://support.google.com/adsense/answer/10961370?hl=en)、[撤回入口](https://support.google.com/adsense/answer/10959060?hl=en)

## 3. 先部署 consent 模式

完成消息发布及关闭 Auto Ads 后，将构建进程变量 `ADSENSE_MODE` 设为 `consent`，保留真实 publisher；广告单元仍可为空。执行生产构建、站点检查和发布。此模式在官方标签插入前设置 `adsbygoogle.pauseAdRequests = 1`，不注册手动广告位、不请求广告。

这仍会加载 Google 代码，并可能访问网络、Cookie 或标识符，不能宣传为零数据访问。非个性化广告同样不能绕过适用 Cookie 同意。[暂停广告请求](https://support.google.com/adsense/answer/7670312?hl=en)、[非个性化广告](https://support.google.com/adsense/answer/9007336?hl=en)

## 4. 实际验收与证据

用 EEA、英国、瑞士真实出口及全新浏览器会话测试；地理位置权限模拟不是网络地区证据。记录日期、消息版本、出口地区、浏览器语言、屏幕和脱敏网络日志。强制展示测试参数可用于界面调试，不能代替地区验收。

| 场景 | 需要观察 |
| --- | --- |
| 新访问/未知 | 三入口可操作；CMP 未就绪、TCF 未确定前广告始终暂停。 |
| 接受 | TCF 回调成功且状态稳定；consent 模式仍没有广告请求。 |
| 拒绝 | 存储和供应商行为符合选择；没有广告请求。 |
| 细粒度选择 | 缺少必要用途或 Google 供应商授权时不开广告；无 NPA 绕行。 |
| 返回访问 | 选择被官方 CMP 正确恢复；没有重复 unit 请求。 |
| 撤回 | 首页/文章入口打开官方界面；Privacy 通过同语言首页进入；撤回暂停后续请求并隐藏已有广告。 |
| API 失败、拦截器 | 显示本地化不可用说明，隐藏不可操作按钮，广告保持关闭；晚到成功不重试。 |
| 语言 | 支持语言匹配，韩语/繁中回退英文；巴葡/欧洲葡语实际结果有记录。 |
| Privacy/信任页 | 十个 Privacy 无 Clarity、广告或 CMP 标签；About/Terms/404 无广告位。 |
| 请求数据 | URL、请求、数据层不包含邮箱、手机号、用户 GIF 文件名或帧数据。 |

TCF 模拟测试验证的是应用状态转换，不证明官方 CMP 的发布或认证状态。`CONSENT_API_READY` 不是最终同意；还需有效的 TCF 结果。未知、失败和拒绝一律关闭。当前实现不会自动降级为非个性化广告。

Clarity 独立核验 masking、Consent Mode 设置、Google Consent Mode 监听及 EEA/UK/瑞士实际 Cookie/请求行为。本站不替用户发出同意授予信号；Google 广告选择也不能自动声称控制 Microsoft 分析。[Clarity Consent Mode](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode)

## 5. Ready 后启用 live

取得本站真实响应式手动广告单元 ID。下列值只在相应证据完成后设为 `true`；代码把这些值当部署声明，不能自行判断后台批准。

```text
ADSENSE_MODE=live
ADSENSE_CLIENT=ca-pub-7443237558968985
ADSENSE_ARTICLE_SLOT_ID=<从账号取得的真实数字 ID>
ADSENSE_SITE_READY=true
ADSENSE_CMP_PUBLISHED=true
ADSENSE_CMP_VERIFIED=true
ADSENSE_AUTO_ADS_DISABLED=true
```

说明符不可直接当广告 ID。任一条件缺失会阻止 live 构建。发布后仅四种指南在第二节后有一个标明“Advertisements”或对应翻译的手动位；与工具按钮分隔，不刷新、不重复 push。首页及信任页不放广告。重复回调、撤回、选择改变和失败必须再次验收。[版位政策](https://support.google.com/adsense/answer/1346295?hl=en)

正式投放时隐私页切换为十语种实际使用 AdSense 的披露；consent 模式披露暂停请求但可能访问数据；off 保留关闭的准确说明。

每次发布检查 nonce 变化、标签与 CSP 一致、只有一条 CSP、无 CSP 错误，beacon 只加载一次、mailto 不依赖解码、预览 noindex 和真实 404。静态资源保持缓存，HTML 使用 `no-store, no-transform`。[Google CSP](https://support.google.com/adsense/answer/16283098?hl=en)

## 6. 额外待核验

真实流量来源、无效流量通知、账号映射和敏感/美加住房招聘信贷定向需账号证据。联系邮箱实际送达由站长从外部邮箱发送测试并确认收到；MX、Email Routing Active 不能替代。代码测试、发布成功、消息能打开或其他网站获批均不是本站广告批准。
