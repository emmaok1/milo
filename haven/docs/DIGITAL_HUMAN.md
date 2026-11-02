# 写实数字人对话

聊天页面 `/talk` 上方提供写实数字人、按住说话和回复字幕，下方保留原有文字聊天。

## 配置

在 `.env.local` 添加服务端变量，然后重启开发服务器：

```dotenv
DID_API_KEY=你的D-ID-Basic凭据
DID_VOICE_ID=zh-CN-XiaoxiaoNeural
# 可选：公网可访问的 HTTPS 人像图片，不支持 localhost
DID_SOURCE_URL=https://example.com/portrait.png
```

`DID_API_KEY` 使用 D-ID 控制台提供的 Basic 凭据，不要加 `Basic ` 前缀，不要放到 `NEXT_PUBLIC_*`。未配置时页面会提示，仍可使用文字聊天。默认采用 D-ID 官方 Noelle 人像。更换图片后刷新页面。

## 使用与限制

- Chrome / Edge，在 HTTPS 或 localhost 打开，允许麦克风权限。
- 按住按钮说中文，松开发送；上滑超过 70px 或指针取消时丢弃；最长 60 秒。键盘支持按住空格 / Enter。
- 语音识别使用浏览器 SpeechRecognition，可能依赖浏览器厂商网络服务。不支持时使用文字输入。
- 只有本次新生成且完整成功的 agent 回复会送到 D-ID，历史消息不会自动播放。
- D-ID Talks 将回复文本生成带语音与真实口型的视频，通常等待 10–30 秒；前端最多等待约 150 秒。单次回复最多 3000 字，超出显示错误并保留文字。
- 当前字幕显示完整回复，不提供逐字时间对齐。视频含原生播放按钮；浏览器阻止自动播放时可点击播放。
- 录音前停止已有视频，生成 agent 回复期间按钮暂时禁用。停止视频生成等待不保证取消第三方已经开始的计费任务。
- 回复文本会发送至 D-ID；现有对话的临时模式只控制原有记忆策略，不控制第三方服务保留策略。
- 服务端通过现有登录 / demo 会话验证访问，用绑定用户且有有效期的签名 token 查询视频，不向浏览器暴露 API 密钥。

## 验证

运行 `npm run typecheck`、`npm run lint`、`npm test`、`npm run build`。
真实语音与口型验收需要配置有额度的 D-ID 凭据，并在浏览器允许麦克风后测试：识别、发送、视频生成、声音 / 口型、静音、停止、上滑取消、权限拒绝及手机触摸操作。

服务文档：https://docs.d-id.com/docs/v2-photo-avatar-quickstart
