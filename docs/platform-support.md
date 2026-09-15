# 平台支持与实际证据

截至 2026-09-15，本地测试环境为 Linux x64 orb、Node 26.5.1、Playwright 1.63.0。GitHub Actions 使用 Node 24，在 Ubuntu 24.04、macOS 15、Windows 2025 完成浏览器检查，Linux 另通过 X11 测试。未执行付费 E2B 请求。

| 目标 | 实现与实测状态 | 仍缺少 |
| --- | --- | --- |
| Chromium | 本地真实运行；输入、iframe、cookie 隔离、HTTP SDK、MCP 通过 | 上传下载、多标签、低延迟流 |
| Linux X11 | Xvfb 1280×800 + xterm；授权 Agent 输入并独立读取输出文件；接管后旧请求被拒绝 | Wayland、可访问性树、中文输入法、拖动、用户真实电脑跨网验证 |
| E2B | 安装官方 Desktop SDK，未创建资源、未实现完整资源生命周期 | 账号和资源授权、创建结果未知时恢复、持久化资源ID、远程验收 |
| macOS / Windows 原生 | 没有可用主机，没有原生驱动 | 系统权限、交互桌面、系统输入实现及实测 |
| Android | orb 无 KVM，没有启动模拟器 | 支持硬件加速的主机或真机、驱动与测试 app |
| iOS / iPadOS | 无 Mac / Xcode / Simulator | 对应 runtime、XCTest 输入与测试 app |
| visionOS / watchOS | 无对应 runtime 或设备 | 单独证明输入能力，不假定普通 iOS 驱动可用 |
| GitHub Actions | [三系统任务通过](https://github.com/sol1560/Browse-Amp/actions/runs/34941716103)；各13项通过、2项跳过，Linux另通过1项X11测试 | 远程触控、Apple/Android原生测试；不把 Chromium 检查算原生桌面支持 |

多 Agent 指隔离会话和可交接输入权，不是多个 Agent 同时操纵同一鼠标。整机操作会影响该 X11 用户能访问的文件和应用，应使用专用账户或隔离环境。

当前画面刷新间隔为 2 秒，不是完整远程桌面体验。未完成计划里的全部功能、性能与安全验收；不能据此用于高风险生产操作。
