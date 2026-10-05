# Cloudflare 配额核验记录（2026-10-05）

站长随后确认账号为 **Free**，并明确授权 GitHub 推送及部署。实际当日用量仍未取得，但本次已改用 **纯静态 Pages 的 `off` 构建**，不执行 Functions，工具功能不依赖 Workers 请求/CPU 额度；本次发布不再等待账单读取。没有升级套餐或修改超额行为。

## 账号与项目只读证据

目标为 GIF Splitter 所在账号及 Pages 项目 `gifframeextractor`。本地 OAuth 到期后，Wrangler 用原权限完成常规刷新；刷新后的项目接口可以读取，账单接口仍拒绝访问。

| 检查 | 实际结果 | 能确认的范围 |
| --- | --- | --- |
| `GET /workers/account-settings` | `success: true`；`default_usage_model: standard` | 默认计费模型；不能证明 Workers Free/Paid。 |
| `GET /pages/projects/gifframeextractor` | `success: true`；production/preview 均 `usage_model: standard`、`fail_open: true` | 两个环境当前超额处理设置。 |
| `GET /subscriptions` | `success: false`；错误 10000 `Authentication error` | 现有 OAuth 缺少账单读取权限；不是套餐或额度耗尽证据。 |
| `GET /billable-usage` | `success: false`；错误 10000 `Authentication error` | 未取得当前账期用量。 |
| `GET /entitlements` | `success: true`；9 个 entitlement；Pages 并发构建 1、自定义域名 100、构建缓存 7 天/10000 MB | Pages 资源分配；没有 Workers 请求/CPU/套餐字段，不能据此推断 Workers Free。 |
| 已登录 Chrome | 浏览器控制接口无法连接；枚举、会话命名、创建标签页均失败 | 未读取到实际控制台；不能将用户已登录等同于本轮已核验。 |
| GraphQL 统计读取 | 命令执行前被自动审批系统拒绝，返回 `blocked by policy` | 没有发出该统计请求，也没有取得用量证据。 |

## 官方额度规则

这些规则说明不同套餐的额度，不证明当前账号使用哪个套餐。

- Workers Free：同账号全部 Workers 与 Pages Functions 共用每天 100000 次请求；UTC 00:00（香港时间 08:00）重置。每次调用 CPU 限制 10 ms。[Pages Functions 计费](https://developers.cloudflare.com/pages/functions/pricing/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)
- Workers Paid Standard：最低每月 USD 5；每账期包含 10000000 次请求和 30000000 CPU-ms，额外请求 USD 0.30/百万次、额外 CPU USD 0.02/百万 CPU-ms。没有免费方案的每日请求上限；实际账期须从后台读取。[Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)
- 不执行 Function 的静态资源请求免费且不限量；本轮方案中 HTML 执行 `_worker.js`，计入 Functions/Workers 请求用量，`_routes.json` 排除的静态资源不执行它。[Pages Functions 计费](https://developers.cloudflare.com/pages/functions/pricing/)
- 当前 `fail_open: true` 会在免费请求额度耗尽时跳过 Function、返回静态资源。本轮 nonce/CSP 处理依赖 Function，因此发布前应采用 fail closed；本轮没有修改该设置。[Fail open/closed](https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed)

## 还需要的实际证据

在同账号控制台读取 Workers & Pages 的 Free/Paid 明确标识，并读取 Billing → Billable Usage 中当前账期（或 Free 当日）的请求数、CPU 用量及超额费用。Free 余量按 `max(0, 100000 − 当日同账号请求数)` 计算；Paid 包含量的余额与额外计费分别记录，不称其为每日硬上限。[用量页面说明](https://developers.cloudflare.com/billing/manage/billable-usage/)

这组证据留给未来 `consent`/`live` nonce Worker 启用前核验。当前静态 off 版本用 `_headers` 中 SHA-256 CSP 授权现有分析 bootstrap，不生成 `_worker.js` 或 `_routes.json`，不加载 Google 标签，不必新增高权限凭据或付费升级。
