# 已确定事项

- auto_approve_plan=true：用户已经明确批准开始执行。
- use_cross_review=true、use_rescue=true、adversarial_final=true、use_test_agent=true；由当前 Agent 分别执行，不擅自创建其他 Agent。
- max_parallel_features=1；其他 autonomous-mission 默认配置保持默认。
- 环境：Linux x64 orb、Node 26.5.1、pnpm 12.0.0；仓库初始无源码/依赖/测试；无 KVM、Mac、Windows、psql 或 7z 命令。
- Git remote 是 Amp 托管，不是已存在的 GitHub public 仓库。远程 Actions 执行需要另行创建/选择 GitHub 仓库并授权；先写可检查的任务文件。
- 用户授权执行已批准任务，并未授权推送、共享部署或付费资源创建。
- 有条件的平台验证允许 BLOCKED，不能为方便勾选完成。浏览器本地实现和验证继续进行。
- 单机开发使用 PGlite（嵌入 PostgreSQL）持久化，明确只允许一个服务进程持有数据库；多进程外部 PostgreSQL 接入仍需后续完成。避免为了本地测试要求额外数据库服务。
- 已安装 7zip 用于只读 DMG 检查；pnpm 12 要求明确允许 esbuild 安装脚本，固定版本并仅允许该包。

- 后续用户回复“好的，用 AGPL3.0”：授权创建 sol1560/Browse-Amp 公共 GitHub 仓库、推送当前源码并运行已准备的仓库检查；许可证改为 AGPL-3.0-only。此前未授权记录为历史状态。仍不包含付费 E2B 资源或生产部署。
