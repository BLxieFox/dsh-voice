# DSH Voice

为 DeepSeek Harness（DSH）增加本地 GPT-SoVITS 语音回复能力。

插件会调用本机的 `api_v2.py`，按当前选择的 GPT / SoVITS 权重和参考音频生成语音，并把播放控件作为紧凑的语音消息放进每轮回复中。

## 功能

- 在 **设置 → 语音回复** 中选择 GPT 模型、SoVITS 音色和参考音频。
- 自动扫描 GPT-SoVITS 目录下的权重与参考 WAV，并读取训练日志中的参考文本。
- 按需启动 / 停止本地 `api_v2.py`，切换模型时自动应用对应权重。
- 注册 `speak` 工具，让 Agent 可以用本地音色朗读回复。
- 语音消息固定显示在每轮回复尾部，不依赖工具详情是否展开。
- 自动消除 Agent 在工具调用前后重复输出的同一条正文。
- 支持语速、朗读语言、参考文本语言和自动播放。
- 生成的 WAV 保存在当前 DSH profile 内，仅保留最近 48 条。

## 环境要求

- Windows 上的 DeepSeek Harness Desktop。
- 一份可运行的 GPT-SoVITS v5 目录，至少包含：
  - `api_v2.py`
  - `GPT_SoVITS/configs/tts_infer.yaml`
  - `runtime/python.exe`，或在设置里填写其他 Python 路径
  - 至少一组 GPT / SoVITS 推理权重
  - 一段 3–10 秒的参考人声和对应参考文本

## 安装

本仓库是 DSH 的本地 bundle 插件，不会把模型文件上传到远端。

1. 将仓库放在任意本地目录，例如：

   ```text
   F:\dsh-plugins\dsh-voice
   ```

2. 在 DSH profile 的 `package.json` 的 `dependencies` 中加入：

   ```json
   "@local/dsh-voice": "link:F:/dsh-plugins/dsh-voice"
   ```

3. 在同一个 `package.json` 的 `dsh.profile.bundles` 末尾加入：

   ```json
   "@local/dsh-voice"
   ```

4. 在 profile 目录执行：

   ```powershell
   pnpm install
   ```

5. 重启 DeepSeek Harness。

默认 profile 位于：

```text
%APPDATA%\@deepseek-ai\dsh-desktop
```

不同版本的 DSH 可能使用不同 profile 路径，请以实际安装为准。

## 配置

打开 **设置 → 语音回复**，填写以下内容：

- `GPT-SoVITS 目录`
- `GPT 模型`
- `SoVITS 模型`
- `参考音频`
- `参考文本`
- `朗读语言`
- `参考文本语言`
- `语速`

首次打开时，插件会扫描默认目录 `F:\GPT-SoVITS-v5`。如果你的 GPT-SoVITS 位于其他位置，请在「连接与目录」中修改。

点击「生成试听」可以直接验证当前权重、音色和服务连接。

## 回复方式

开启「每条回复都生成语音」后，Agent 会：

1. 输出一次最终文字回复。
2. 调用 `speak`，用与正文一致的自然口语生成语音。
3. 结束本轮，避免再次输出相同正文。

语音消息会固定在回复尾部，即使「已调用工具」区域处于折叠状态也会显示。

## 数据与隐私

- GPT-SoVITS 推理在本机运行。
- 插件不会上传模型、参考音频或生成的 WAV。
- 生成的音频只保存在 DSH profile 的 `dsh-voice/clips` 目录。
- 面板和音频路由使用 DSH 当前会话的同源认证，并限制模型与参考文件位于配置的 GPT-SoVITS 目录内。

## 实现

- `index.js`：Cordis Host 插件、模型扫描、GPT-SoVITS 进程管理、HTTP 路由和 `speak` 工具。
- `client.js`：DSH 设置页、语音消息播放器、按轮次绑定的语音展示和重复正文清理。
- `cordis.patch.yml`：bundle 挂载声明。

## 开发检查

```powershell
npm run check
```

## 许可证

[MIT](LICENSE)
