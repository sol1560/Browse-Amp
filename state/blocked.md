# 外部限制

- Mac 上 Ego 动态检查、Apple Simulator、Windows 原生桌面：当前只有 Linux orb，缺少对应主机。
- Android 模拟器：当前无 KVM，不在 orb 内尝试安装模拟器。
- GitHub 发布权限问题已解除：用户创建 sol1560/Browse-Amp 并开放连接访问，已保留其许可证提交、合并源码并推送，三系统仓库检查通过。
- E2B 真实资源测试：须有可用账号及创建资源授权；不打印凭据或自动消费。

以上不阻止本地实现与 Chromium 检查。

## 本轮结束时

- `.github/workflows/check.yml` 已远程运行通过（本仓库三系统 Chromium 检查及 Linux X11）。此文件没有 Apple/Android 原生控制测试，不得误称覆盖。
- E2B 尚未实现完整资源生命周期，不仅是缺凭据；创建结果未知时的资源恢复、资源 ID 持久化和失联清理仍需开发。
- 浏览器扩展已写出，但扩展安装与权限弹窗未验收；保持 PENDING，不假称被当前工具绝对阻断。
- 其他剩余开发范围详见 progress.md 与原计划。授权外部执行之后继续，不能标 COMPLETED。
