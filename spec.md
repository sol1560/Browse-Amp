---
auto_approve_plan: true
use_cross_review: true
use_rescue: true
adversarial_final: true
use_test_agent: true
max_parallel_features: 1
---
# Browse-Amp

按已批准的 `.agents/plans/2026-09-15-open-device-control.plan.md` 完整执行。
用户于 2026-09-15 明确要求使用 autonomous-mission 开始，不再请求重复计划批准。

目标是开源的多 Agent 浏览器与设备控制：浏览器、Linux、macOS、Windows、Android、iOS、iPadOS、visionOS、watchOS；E2B 承载 Linux，GitHub Actions 仅相关项目开发测试。提供隔离会话、人工接管、登录态授权导入、实时界面与程序入口。

不伪造设备支持或测试结果；不能运行的平台记录 BLOCKED，继续独立工作。不推送、部署、购买计算资源或触发远程任务，除非另获明确授权。真实账号不得进入公共 Actions 日志或 artifacts。完整范围和验收标准以批准的计划为准。

追加要求：用户可从其他 device 控制自己的电脑，并让 Agent 控制和验收效果。包括人工/Agent 交接、触控与键盘输入、实际结果检查。原生电脑控制与浏览器控制分别验收；“价格功能”暂按“加个功能”理解，不增加计费系统。
