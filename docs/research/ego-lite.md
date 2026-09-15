# Ego Lite 检查结果

日期：2026-09-15。静态检查完成，macOS 动态检查未执行。

- 官方 x64 安装包：`https://cdn.ego.app/setup/macos/x64/egolite.dmg`
- 版本：0.5.0.33；大小：154014765 bytes。
- SHA-256：`f04f9f9e01dd0154de24fc700c2a1510ffd8fa50c3b59f8d6e7a8fa60cbab183`，与官方响应 `x-amz-meta-sha256` 完全一致。这是完整性检查，不是 macOS 签名验证。
- 用 `7zz l` 确认为 DMG / HFS+，XZ 压缩；只提取 Info.plist、ego-browser helper 和随包文档，没有执行安装脚本，没有移除 quarantine。
- 包内包含 `Contents/Frameworks/ego Framework.framework/Versions/0.5.0.33/Helpers/ego-browser`、Node/GPU/Renderer helpers 和 `Resources/ego-skills/ego-browser`。这些名称说明包内组件存在，不证明闭源内部的具体算法。
- 本轮材料在 `/tmp/browse-amp-research/`，不是项目依赖，也不会提交安装包。

公开代码固定在 [d01be933](https://github.com/citrolabs/ego-lite/commit/d01be93325c7ea59d41c2ca9f4c59b58b4be4046)，许可 MIT，版权 CitroLabs 2026。

## 阅读的实现

- `package/ego-browser/src/native-gate.ts`：Promise 队列保护进程级 selected space，同空间重入允许，不同空间重入报错；finally 清除活动标记。值得避免的是不同任务共享可变当前目标。
- `package/ego-browser/src/page-ref-registry.ts`：ref 绑定 backend node、frame、document；新文档使旧 ref 失效，不应按文字相同自动点新节点。
- `package/ego-browser/src/run.ts`：把一段 JS 作为一次执行，减少逐动作调用开销。不能把这种方式原样放进有管理密钥的服务器进程。
- `helpers.ts` 和 native bindings 文档：公开接管策略，真正强制执行在闭源 app。我们的实现必须在动作提交处检查，而不只在界面禁用按钮。

## 独立实现边界

本项目目前不复制上游代码；使用 Playwright 驱动独立 Chromium。MIT SDK 不能提供闭源浏览器内核、原始快照或 Chrome 登录迁移器。没有宣称完成反编译、签名验证、Mac 运行或性能对比。
