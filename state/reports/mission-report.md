# 本地阶段验收，完整任务未完成

日期：2026-09-15。原计划保留，任务状态 BLOCKED；不是 COMPLETED。

## 已执行检查

- `pnpm lint`：31 文件通过，无修复或警告。
- `pnpm build`：TypeScript 检查和 Vite 构建通过。
- `BROWSE_TEST_DISPLAY=:88 BROWSE_TEST_UI=1 pnpm test`：15项通过、0失败、0跳过。
- 两个独立客户端：模拟触控从390宽页面点中1280宽目标输入框，填写 touch-739；交给 Agent 客户端点击目标按钮，独立读取目标 DOM 得到 touch-739；人类接管后旧 Agent 请求被拒绝。
- Linux 实际输入：专用 Xvfb+xterm，Agent 输入 printf 命令，测试从临时文件读取 verified-native-731；不是以 HTTP 200 当作输入成功。临时输出已删除。
- MCP 独立进程：连接、工具列表、真实 Chromium 创建/观察/结束通过。
- 登录导入：测试网站导入后出现登录结果，另一个会话保持未登录；重复/过期票据拒绝。

## 自查修复与残留

- 修复接管发生在校验与发送间仍可能输入的问题；确定性测试强制该时序，断言0次输入。
- 修复 Linux mousemove --sync 在重复同坐标时超时；测试连续两次点击相同坐标。
- 创建会话只允许 starting 转 ready，已停止会话不被迟到的启动结果复活。
- Linux 桌面只有配置所有者能首次连接，同桌面只有一个会话；跨用户和未授权 Agent 创建均拒绝。
- 一次 API 截图测试出现临时错误，单测重跑与后续完整两次检查未重现，原因未确定，不掩盖该记录。
- Node 26 的 module.register 弃用提示仍存在，不影响本次通过结果。

## 界面检查

agent-browser 检查真实工作台与平台列表；Playwright Chromium hasTouch=true、390×844、DPR2 检查触控，确认 pointer:coarse 与无水平溢出。不是 Android/iOS 真机测试。

截图：`.amp/in/artifacts/linux-desktop.png`、`platforms.png`、`mobile-control.png`，均已查看。Linux 图中白色区域是 xterm 默认背景，黑色边缘是未铺满的 Xvfb 根窗口，不是页面丢图。首次移动截图早于下一帧，补充等待图片更新后重新截图；保存按钮的文字已变为 touch-739，目标 DOM 断言同时通过。手机缩小整张桌面后文字很小，尚无缩放体验优化。

## 未完成

Ego Mac 动态运行；E2B 完整连接/资源恢复；Mac/Windows/移动设备原生控制；扩展安装权限实际流程；实时视频、浏览器上传下载、多标签、设备配对、多实例数据库、性能比较。GitHub Actions 文件只准备在本地，没有公开仓库或远程执行。没有推送、付费云资源创建或生产部署。

详见 `state/blocked.md`。继续任务需要相应设备与云端权限，同时必须继续开发，不能只补几张截图就宣布完成。
