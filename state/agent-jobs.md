# 运行任务

| 名称 | 类型 | 状态 | 命令与用途 |
| --- | --- | --- | --- |
| browse | orb 托管服务 | running | BROWSE_DESKTOP_DISPLAY=:88 BROWSE_DESKTOP_OWNER=local pnpm dev，端口3000；stop 用 amp orb service stop browse |
| desktop-x11 | orb 托管服务 | running | Xvfb :88 -screen 0 1280x800x24 -nolisten tcp；仅测试桌面 |
| desktop-terminal | orb 托管服务 | running | DISPLAY=:88 xterm -geometry 120x36+30+30 -fa Monospace -fs 14 |
| browse-qa | agent-browser | done | 工作台与平台截图检查后关闭；无其他 Agent |
