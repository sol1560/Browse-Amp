# 执行计划

批准来源：用户“用automission skills开始完整执行”。不重复请求计划批准。
原计划保留范围和阶段状态；state/ 是本任务的执行记录。

| 阶段 | 内容 | 文件范围 | 依赖 |
| --- | --- | --- | --- |
| M1 | F1.1 下载检查 Ego；F1.2 平台能力探测 | docs/research、scripts、docs/platform-support.md | 无 |
| M2 | F2.1 会话与控制权；F2.2 浏览器执行和认证服务 | packages/core、packages/drivers、apps/server | M1 可验证部分 |
| M3 | F3.1 SDK/CLI/MCP；F3.2 E2B 与原生连接 | packages/sdk、apps/cli、apps/mcp、packages/providers | M2 |
| M4 | F4.1 加密登录导入；F4.2 扩展授权 | packages/auth-transfer、apps/browser-extension | M2 |
| M5 | F5.1 控制台；F5.2 真实界面检查 | apps/console、tests/e2e | M2、M4 |
| M5R | F5.3 跨设备画面输入；F5.4 Agent 操作后验收 | 控制台、drivers、测试 | M2、M5 |
| M6 | F6.1 综合检查、安全复查；F6.2 文档与结果 | tests、docs、README、state/reports | 所有可执行阶段 |

外部执行受阻不等于完成。保留未完成项；在可执行部分耗尽后列出具体所需权限或设备。

用户追加：从其他设备控制电脑，并让 Agent 控制、检查效果。“价格功能”按“加个功能”理解。浏览器控制先用同一认证界面的触控、坐标和键盘输入验证；原生桌面使用独立设备连接，不能把浏览器控制标成整机控制。
