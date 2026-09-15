# Browse-Amp

可自部署的多 Agent 浏览器与 Linux X11 桌面控制原型。独立编写，没有复制 Ego Lite 闭源浏览器。**不是全平台成品，也未完成公开发布。**

## 已能运行

- 独立 Chromium 会话、页面元素读取、点击、输入、截图；浏览器与 cookie 隔离。
- 多个 Agent 各用自己的会话；同一个会话仅一方能输入，人类可交接或接管。
- Linux X11 整机画面、坐标点击和键盘输入。需电脑所有者显式开启；停止会话不关闭用户应用。
- 网页工作台、TypeScript SDK、CLI、MCP；网页每 2 秒更新截图，**不是低延迟视频流**。
- 用户按网站授权，以一次性加密票据导入 cookie/localStorage。不是任意账号的一键登录，也不会自动证明登录仍有效。

## 本地启动

需要 Node.js 24+、pnpm 12、Chromium 所需系统库。在 Linux 上验证过；其他系统尚未运行检查。

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm run init
pnpm build
pnpm dev
```

在运行服务的电脑打开 3000 端口。访问凭据位于 `.data/credentials.json`，人类和 `agent-1` 使用不同凭据。不要提交或分享这个文件；`init` 不覆盖已有凭据。

默认只允许 `https://example.com`。通过 `BROWSE_ALLOWED_ORIGINS` 配置逗号分隔的完整来源。网页资源来自其他域名时也需明确允许。来源列表不能代替系统网络隔离；不要把不可信网页和生产秘密放在同一主机。

### 从另一设备控制 Linux 电脑

在**被控制的电脑**安装 `xdotool`、ImageMagick（`import`）并运行本服务：

```sh
BROWSE_DESKTOP_DISPLAY=:0 BROWSE_DESKTOP_OWNER=local pnpm dev
```

必须填写你实际授权的 X11 display，且服务用户有该 display 的访问权限；不支持原生 Wayland。通过受认证的 HTTPS 反向代理或私人网络从另一设备访问服务。默认只监听回环地址；不要把裸 HTTP 服务直接开放到公网。当前没有自动穿透、设备配对或原生手机 App。

连接工作台 → 选择“Linux 整机桌面” → 创建会话 → 点击画面、发送文字；填入已配置的 Agent 名称，点“交给 Agent”。Agent 使用自己的凭据列出会话并操作；人类点“接管 / 续租”拿回控制权。Linux 文字输入基于 X11 键盘映射，复杂中文输入法未验证。

### Agent 入口

```sh
pnpm cli --help
# 用你的 Agent 凭据设置 BROWSE_TOKEN，不要把凭据写进共享配置。
BROWSE_URL=https://your-private-host.example pnpm mcp
```

MCP 客户端请直接运行 `node --import tsx apps/mcp/main.ts`，避免包管理器日志污染标准输出。提供创建、列表、观察、动作、续租、结束六个工具。Linux 目前应由人类先创建再交给 Agent。`packages/sdk/index.ts` 导出 `BrowseClient`；输入返回 `OUTCOME_UNKNOWN` 时先检查实际结果，不要换请求编号自动重发。

### 登录态导入

在 Chromium 扩展开发模式加载 `apps/browser-extension`。工作台为当前网站生成 60 秒有效授权，将其复制到扩展，核对目标与网站后明确授权导出。票据只能使用一次，可撤销。密钥在本地服务主机，不是已验证的跨 E2B 端到端传输。扩展权限弹窗尚未完成实际安装验收；cookie 与 localStorage 加密导入的服务端流程已测试。

## 验证与限制

```sh
pnpm lint
pnpm build
pnpm test
```

Linux 整机测试需要**专用可丢弃的** 1280×800 Xvfb 与前台 xterm，设置 `BROWSE_TEST_DISPLAY` 后运行 `tests/linux.test.ts`。不要把这个测试指向日常桌面，它会输入终端命令。

`.github/workflows/check.yml` 只检查本项目：三种系统上的 Chromium，以及 Linux X11；尚未在 GitHub 运行。不提供通用远程电脑、隧道或无限模拟器。公共标准运行器免分钟费不代表无限资源；有时长、并发和用途限制。

E2B、macOS/Windows 原生桌面、Android、iOS/iPadOS、visionOS、watchOS **未完成接入与实测**。Linux 桌面缺少元素树、拖动和实时视频。服务为单进程 PGlite，不支持多实例部署；未做性能排名，不能宣称 SOTA。详细状态见 [平台表](docs/platform-support.md)。

许可证：[GNU AGPL 3.0](LICENSE)（`AGPL-3.0-only`）。修改版本用于网络服务时，应按许可证向远程使用者提供对应源码。依赖保持各自许可证，Ego DMG 和个人浏览数据不包含在源码中。
