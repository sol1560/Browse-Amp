# 外部限制

- Mac 上 Ego 动态检查、Apple Simulator、Windows 原生桌面：当前只有 Linux orb，缺少对应主机。
- Android 模拟器：当前无 KVM，不在 orb 内尝试安装模拟器。
- GitHub Actions：用户已授权创建公共仓库、推送与运行检查，但当前 GitHub 连接没有创建仓库权限；创建 sol1560/Browse-Amp 请求被拒绝，后续读取仍未找到仓库。
- E2B 真实资源测试：须有可用账号及创建资源授权；不打印凭据或自动消费。

以上不阻止本地实现与 Chromium 检查。

## 本轮结束时

- 已准备 `.github/workflows/check.yml`（本仓库三系统 Chromium 检查及 Linux X11），没有运行；需要补充 GitHub 连接权限，或由用户创建空公共仓库并允许此连接访问，再继续已授权的推送和检查。此文件没有 Apple/Android 原生控制测试，不得误称覆盖。
- E2B 尚未实现完整资源生命周期，不仅是缺凭据；创建结果未知时的资源恢复、资源 ID 持久化和失联清理仍需开发。
- 浏览器扩展已写出，但扩展安装与权限弹窗未验收；保持 PENDING，不假称被当前工具绝对阻断。
- 其他剩余开发范围详见 progress.md 与原计划。授权外部执行之后继续，不能标 COMPLETED。
