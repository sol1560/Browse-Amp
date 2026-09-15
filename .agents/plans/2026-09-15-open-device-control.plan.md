---
name: 开源多 Agent 浏览器与跨平台设备控制
overview: "独立实现可自部署的浏览器与设备控制工具，使用 E2B 承载 Linux 和浏览器，使用 GitHub Actions 执行相关项目的跨平台开发测试，支持多 Agent 隔离、人工接管和经用户授权的登录态导入。各平台先实测再声明支持，不以无限免费模拟器为前提。"
todos:
  - id: inspect-ego
    content: 下载并检查 Ego Lite 安装包、公开源码与许可，记录可复用实现和闭源边界
    status: pending
  - id: prove-platforms
    content: 验证各平台启动、观察、输入和销毁能力，确定可用驱动与支持等级
    status: pending
  - id: build-sessions
    content: 建立会话服务、设备连接、权限检查与多 Agent 控制权管理
    status: in_progress
  - id: deliver-browser
    content: 实现 E2B 浏览器和 Linux 控制及命令行、JavaScript 和 MCP 入口
    status: pending
  - id: deliver-auth
    content: 实现按网站授权的登录态导入、加密传输、检查和撤销
    status: pending
  - id: deliver-native
    content: 接入已验证的桌面和移动平台驱动及受限 Actions 测试任务
    status: pending
  - id: deliver-console
    content: 实现设备列表、实时画面、排队、人工接管和登录导入界面
    status: pending
  - id: verify-release
    content: 验证跨平台操作、并发隔离、安全边界和性能，准备开源文档与发布材料
    status: pending
isProject: true
---

# 开源多 Agent 浏览器与跨平台设备控制

## 背景与已核实事实

- 2026-09-15 当前工作区只有 `.git/`，`git status --short` 无输出；没有现有源码、测试、配置或可复用模块。下述工程路径均为待创建，不是已经实现的文件。
- 用户目标：下载 Ego Lite，研究思路与实现，做一个开源工具；覆盖浏览器、macOS、Windows、Linux、Android、iOS、iPadOS、visionOS、watchOS；基于 E2B 和 GitHub Actions；多个 Agent 同时使用；一键导入登录态；体验与性能可比较。
- 本轮仅阅读公开页面、源码调查结果和本地 skill 文件，不下载或安装应用，不触发远程任务。下载和运行检查属于批准后的第一步。
- 用户给的下载链接返回 HTML，不是直接安装包。官方安装脚本列出的地址为 `https://cdn.ego.app/setup/macos/arm64/egolite.dmg` 和 `https://cdn.ego.app/setup/macos/x64/egolite.dmg`；当前 Linux x64 orb 不能执行 macOS app。
- [Ego Lite 仓库说明](https://github.com/citrolabs/ego-lite/blob/main/AGENTS.md)明确公开 SDK/CLI，不包含浏览器本体；[MIT 许可](https://github.com/citrolabs/ego-lite/blob/main/LICENSE)覆盖该仓库，不自动覆盖 DMG 内的闭源内容。
- 可参考的真实源码：[`run.ts`](https://github.com/citrolabs/ego-lite/blob/main/package/ego-browser/src/run.ts) 的脚本执行入口；[`helpers.ts`](https://github.com/citrolabs/ego-lite/blob/main/package/ego-browser/src/helpers.ts) 的 TaskSpace 和接管规则；[`page-ref-registry.ts`](https://github.com/citrolabs/ego-lite/blob/main/package/ego-browser/src/page-ref-registry.ts) 的页面元素编号；[`native-gate.ts`](https://github.com/citrolabs/ego-lite/blob/main/package/ego-browser/src/native-gate.ts) 的串行调用保护。底层空间实现、原始快照生成和浏览器登录迁移不可见。执行时固定源码版本，再逐项核对，不将官网性能数字视为实测。
- [GitHub 标准运行器](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)对公共仓库免分钟费；[限制](https://docs.github.com/en/actions/reference/limits)包括单任务最多 6 小时，Free 账户通常总并发 20、macOS 并发 5。标准运行器不等于 larger runners；存储、带宽、E2B 和转发服务不承诺免费。
- [GitHub 附加条款 Actions 部分](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)限制用途为相关仓库的软件开发测试等，不允许将 Actions 包装成通用商业计算服务。条款还包含同一虚拟机同时仅一名 licensed user 的要求；不把多个产品用户共享一台 runner 作为设计基础。
- [E2B Desktop](https://docs.e2b.dev/use-cases/computer-use)提供 Linux 桌面、截图、输入与实时画面，不提供 macOS 或 Windows。当前 orb 无 KVM，不在此安装 Android 模拟器。
- [Apple 设备文档](https://developer.apple.com/documentation/xcode/devices-and-simulator)支持开发测试用模拟器，但模拟器不等于真机。镜像 README 中列出 SDK 不能证明 runtime 已安装且能启动，必须以 `xcrun simctl list -j` 和实际操作结果确认。
- [Chrome 136 安全变更](https://developer.chrome.com/blog/remote-debugging-port)不再允许用旧远程调试参数直接控制默认用户目录；不能靠打开调试端口搬走用户的日常浏览器数据。

## A. 先检查参考实现和平台能力

### 安装包与公开代码

- 批准后下载所需架构 DMG 到仓库外临时目录，记录来源、版本和 SHA-256。先只读列出包内容、许可证、随包公开资源及可见 JavaScript，再在可用 Mac 上检查签名与正常安装行为。
- 不执行官方脚本中自动移除 quarantine 的步骤；不关闭系统安全检查，不绕过授权或复制闭源内核。不把闭源包、商标、个人浏览数据提交到开源仓库。
- 对公开源码和安装包中的可见实现进行区分记录；MIT 代码若复用，保留版权声明，在 `THIRD_PARTY_NOTICES.md` 说明范围。未知授权代码只记录观察到的行为，独立编写实现。
- 输出 `docs/research/ego-lite.md`：版本、路径、行为测试、可见源码与未知内部实现分开列出。没有 Mac 时保留明确的待验证项，不伪称完成运行检查。

### 各平台必须先跑四项测试

每个平台都执行：启动环境 → 读取真实画面或元素 → 输入文字并验证结果 → 销毁环境。创建 `tests/platform-smoke/` 与 `docs/platform-support.md`，记录主机架构、系统版本、runtime、测试 app、截图和失败原因。

| 平台 | 推荐执行位置与初始实现 | 验收范围 |
| --- | --- | --- |
| 浏览器 | E2B 或本地独立 Chromium；Playwright/CDP | 导航、元素读取、iframe、输入、上传下载、多空间 |
| Linux | E2B Desktop；桌面输入，优先可访问性树 | 应用启动、窗口观察、点击、输入、拖动、画面 |
| Android | GitHub Linux runner 的硬件加速模拟器，用于项目测试；日常使用接用户设备或自有主机 | ADB 生命周期、UIAutomator2 元素操作、截图与输入 |
| macOS | 自有 Mac；Actions 仅相关项目测试 | Accessibility、屏幕权限、真实 GUI 会话、输入；需实测 runner 限制 |
| Windows | 自有 Windows；Actions 仅相关项目测试 | UI Automation、交互式桌面、输入与截图；无桌面时明确不可用 |
| iOS / iPadOS | Mac 上 Simulator，simctl 生命周期加经过验证的 XCTest 驱动 | iPhone/iPad 分别测试；需要 Simulator 构建，不直接使用真机 IPA |
| visionOS | Apple Silicon Mac、兼容 Xcode 和已安装 runtime | 模拟器启动、截图、测试 app 操作；空间和眼手输入按能力逐项标记 |
| watchOS | Mac 上 watch runtime，必要时配对 iPhone simulator | 启动配对、截图、测试 app 操作；表冠与跨设备流程分别验证 |

- iOS 可采用 Appium XCUITest/WebDriverAgent；不推断其自然支持 watchOS 或 visionOS，后二者先做 XCTest 小型验证程序。未有可靠通用输入方式时标为“仅测试 app”或“暂不可用”，不假装支持系统任意界面。
- 固定已验证 runner label、Xcode 和 runtime 组合，启动前探测；不依赖不断变化的 `*-latest`。visionOS 优先 arm64，检查 runner-images 安装脚本与运行时输出。
- 不支持时返回 `UNSUPPORTED_CAPABILITY` 及原因。桌面无交互权限时转向用户自有设备，不通过模拟成功填补结果。

## B. 会话服务与多个 Agent 同时操作

- 默认采用 TypeScript、pnpm workspace、Node.js 服务；浏览器与控制台为 React/Vite，服务使用 Fastify、WebSocket 和 PostgreSQL。原生系统 API 用小型 Swift、C# 或 Python 程序调用，不为每个平台重建一套服务。
- `packages/core/src/types.ts` 定义 `Session`、`Target`、`Capabilities`、`Observation`、`Action`、`ActionResult`。能力包含 `snapshot/screenshot/pointer/keyboard/touch/appLifecycle/stream/authImport`，同时记录限制，不让单一布尔值掩盖平台差异。
- `packages/providers/` 定义 `createSession/getStatus/destroySession`，接 E2B、Actions 和用户自有设备。`packages/drivers/` 定义 `observe/act/startStream/stop`，分别负责浏览器、桌面、Android 和 Apple。执行位置和操作系统分开，避免每种组合重复实现。
- `apps/server/src/sessions/` 管理 `queued → starting → ready → stopping → stopped` 以及失败和到期；持久化供应商资源 ID。创建请求带幂等键，创建结果未知时先查询，不直接再创建一台。定时清理失联资源，明确暂停和销毁不同。
- 每个 Agent 默认独立 Session、独立浏览器 context 或设备实例；不共用可变的全局“当前空间”。共享画面可多读，输入控制权只给一方。
- `apps/server/src/control/` 用数据库原子更新、到期租约和递增控制版本分配输入权。命令必须携带 `sessionId/agentId/requestId/leaseEpoch/deadline`，设备端也检查控制版本，防止旧连接恢复后继续点击。
- 人工接管先撤销旧控制权并让设备端确认停止，再允许人工输入；不能撤回已经提交到外部应用的操作，界面显示最后已执行项。长脚本每一步检查控制权。
- 非幂等动作断线后返回 `OUTCOME_UNKNOWN`，必须重新观察或由人确认，不自动重放付款、发送消息等动作。普通重试不等于成功。
- 设备只主动建立加密出站连接，使用短期、限定设备和任务的凭据；不公开无认证的 CDP、ADB、VNC 或桌面控制端口。按用户检查每个动作、画面和文件访问权限。

## C. 浏览器、Linux 与 Agent 入口

- `packages/drivers/browser/` 用 Playwright 管理页面与等待，必要时通过 CDP 读取可访问性树和 frame 信息。元素编号包含 session、页面、frame、document 版本；导航后旧编号必须失效。跨域 iframe、shadow DOM、弹窗和下载单独覆盖测试。
- `packages/drivers/linux/` 接 E2B Desktop 和可用的可访问性接口；截图坐标带分辨率和缩放信息。每次动作返回真实执行结果，结果检查与动作提交分开。
- `packages/sdk/`、`apps/cli/`、`apps/mcp/` 提供相同的会话、观察、操作、等待和人工交接功能；不绑定特定模型或 Agent 产品。支持一段 JavaScript 连续操作，减少逐次远程往返。
- Agent 的脚本在隔离的执行进程或沙箱内运行，禁止服务端直接 `eval` 用户脚本；资源、超时、网络权限和工具范围受限，执行器拿不到管理服务数据库或其他用户凭据。
- 浏览器先采用独立 Chromium，不从零维护 Chromium 分支。需要内核修改的功能在有可复现证据后再评估，不承诺拥有 Ego 私有内核的全部行为。

## D. 用户授权的登录态导入

- 将“一键 input”理解为“一键 import 已授权的网站会话”，不是把用户名密码贴进所有设备。首版支持 Chromium 网站；Safari、原生 app、系统账号不承诺跨设备搬迁。
- `apps/browser-extension/` 提供浏览器扩展，通过明确的站点权限和用户按钮导出选定网站的可迁移 cookies/storage；不直接读取或解密浏览器配置数据库，不要求关闭浏览器保护。对 HttpOnly、分区 cookie、第三方 frame、localStorage/IndexedDB 分别建立支持清单。
- `apps/local-bridge/` 负责本地配对与传输；首次安装配对和站点授权后，一次操作可把指定站点发送到选定会话。传输前展示来源、站点、目标运行环境及到期时间。
- `packages/auth-transfer/` 采用成熟加密库，目标会话生成临时密钥，本地加密后传输；服务只短暂转发密文。导入完成后删除临时材料，不把 cookie、密码或 token 放进 GitHub inputs、日志、缓存、artifacts、仓库或截图。
- 导入后访问无副作用的登录检查页面，分别显示“可用 / 需要重登 / 不支持”。不将网站的二次验证、设备绑定、通行密钥或风控当作可绕过的错误。失败时允许用户在目标浏览器手动登录并复用该会话。
- 日常真实账号默认只进入用户自己的设备或明确同意的 E2B 会话；Actions 首版只接受项目专用测试账号，不接受个人整包浏览器资料。外部贡献的 PR 不可访问任何会话凭据。
- 导入的副本是该 Agent 的私有状态，不自动写回源浏览器。多个 Agent 共用同一个网站账号可能在网站端互相影响，需要提示；本地隔离不能阻止网站端冲突。
- “撤销”立即撤销本工具访问并删除目标会话凭据；远端网站 token 是否失效取决于网站注销/撤销功能，不能声称删除文件就使服务器凭据失效。

## E. 跨平台执行与控制台

- `.github/workflows/platform-test.yml` 只运行关联仓库指定版本的软件测试；手动触发绑定仓库、commit、测试目标和最长期限，不提供任意公网用户申请云桌面的入口。
- Actions 使用最小权限、固定依赖版本、环境保护和短期 OIDC 身份。管理端验证仓库、ref、workflow、audience 与 run ID，拒绝重复和过期凭据；不在 workflow 参数携带长期访问密钥。
- 默认单任务控制时间 30 分钟，到期清理；排队限制、账户额度和剩余时间可见。取消时同时撤销设备端权限并停止任务。不得用循环启动任务绕过限制。
- `packages/drivers/macos/`、`windows/`、`android/`、`apple/` 按 A 节实测结果实现；每平台提交真实最小测试 app，原生测试不以网页尺寸模拟代替。
- `apps/console/` 主视图包含设备列表和实时画面，侧面显示 Agent、任务、最后动作、控制权和剩余时间；支持新建、排队、取消、接管、交回、销毁和登录导入。
- 必须设计并检查空列表、启动中、排队、权限缺失、断线、控制权冲突、登录失效、不支持和到期状态。遇到平台不支持就给原因，禁止灰色按钮背后返回假成功。
- 画面优先复用已有认证流方案，浏览器可用 screencast、E2B 可用其桌面流；先测延迟和带宽，再决定是否需要额外 WebRTC 服务。默认不录像，敏感会话可禁用画面保存。
- 首版自部署、用户自带 E2B/GitHub 账号与设备；不加入支付、账号市场或集中出租计算资源。

## 验证

以下为实施时应创建并实际执行的命令，不是本轮已经通过的测试：

- `pnpm lint && pnpm typecheck && pnpm test`：接口、权限、状态转换和元素编号检查。
- `pnpm test:integration`：数据库租约竞争、重启、重复回调、资源创建结果未知、设备断线和清理。
- `pnpm test:e2e`：浏览器登录导入、实际操作、多 Agent、人工接管和控制台界面；截图必须查看，交互检查 DOM 或可访问性结果。
- `pnpm test:platform --target <platform>`：逐个平台执行 A 节四步。报告区分真实测试、模拟单测、无法运行；任何平台未验证不得计入“已支持”。
- 20 个 Agent 并行，各自设置不同 cookie 和不对称测试文本；断言任何 Agent 不能读到别人的页面、文件、画面、凭据或输入。该测试先在受控本地环境运行，不要求占满 GitHub 并发。
- 两个 Agent 同时请求同一目标控制权只允许一个成功；租约过期后旧 Agent 的排队动作必须拒绝；人工接管期间脚本不得继续输入。
- 在“服务端已执行但回复丢失”处注入故障，断言不自动重复发送；浏览器导航前后的同号元素不能被误点。
- 登录导入覆盖 HttpOnly、SameSite、分区 cookie、过期、站点撤销、不同域、部分 storage 不支持和用户取消；在日志与 artifacts 扫描测试用标记秘密，必须零泄漏。
- `pnpm bench`：固定系统、浏览器、模型和网络条件，对 30 个有标准答案的浏览器任务至少重复 5 次，记录成功率、耗时中位数/P95、工具调用数、输入输出 token 与成本；与固定版本 Playwright/agent-browser 比较。Ego 若无可运行 Mac 则不列其数字。
- 初始验收目标：受控浏览器任务成功率至少 95%；就绪设备普通控制操作 P95 小于 1 秒、用户接管确认 P95 小于 1 秒（不含平台排队与建机，环境条件公开）；每种原生平台至少完成 5 个支持范围内任务。未达标记录结果和改进，不更改样本制造通过。
- 开源前检查许可证和依赖声明、安装文档、能力矩阵、无密钥样例配置、版本固定、清理说明；新用户从干净环境执行一次完整上手流程。

## 风险、默认值与执行顺序

- 这是长期总计划，不把所有平台当作一次交付可用。顺序是：参考与平台实测 → 会话服务 → 浏览器/Linux 可用版本 → 登录导入 → 原生平台 → 控制台完整体验 → 综合验证。平台实测会改变驱动选择时先修订本计划。
- 保留全部平台目标，但 visionOS/watchOS 初期按实验支持处理；如果只能控制自有测试 app，明确说明，不能据此宣称可控制任意 app。
- 项目名 Browse-Amp，自己的新增代码按用户后续要求采用 AGPL-3.0-only，复用代码遵守原许可。品牌、Chromium 长期分支、移动端商店 app 不属于首版。
- 本轮不宣称完成下载、逆向分析或运行检查；只能确认公开 SDK 与安装入口。若批准后仍没有 Mac，先完成可做的静态检查和浏览器/Linux，其余保留待验证状态。
- Actions 仅承担相关项目开发测试；通用控制在 E2B 或自有设备运行。这是依据用途限制对“无限免费模拟器”前提的修正，不通过增加 public repo 或账户绕过限制。
- 不保证所有登录态可跨系统迁移，不复制系统钥匙串，不绕过验证码、多因素认证、设备绑定或网站访问限制。
- “SOTA”作为有公开可复现比较结果后的表述，不作为未测试的宣传语。延迟、成功率和成本必须提供测量条件。
- 未经单独明确授权不推送代码、不创建公开 GitHub 仓库、不部署共享服务、不触发付费 E2B 资源或远程 Actions；先完成本地实现和能执行的验证，再请求具体操作许可。
- 回退：供应商或某平台不可用时关闭该能力，保留已验证平台；不自动把真实登录凭据转移到另一个供应商。销毁会话前对用户产生的文件提供下载提示，但不保留登录凭据。

## 批准方式

回复 `/plan go` 开始执行；也可以直接说明需要修改的内容，或回复“放弃”。

执行记录：已获批准。inspect-ego 的静态检查完成，动态检查受 Mac 主机缺失阻塞；prove-platforms 的非浏览器测试受设备和远程授权阻塞。未标为 completed，详情见 state/blocked.md。继续独立的 build-sessions。本地先用单进程 PGlite PostgreSQL，外部 PostgreSQL 多进程模式尚未完成。
