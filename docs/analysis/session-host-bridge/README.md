# Session Host Bridge Protocol

## 目标

- 为 `/session` 页面定义唯一宿主注入入口。
- 让 `/translate` 与 `/yt-script` 的 provider 模式有一份可落地、可复用、可回归的正式协议。
- 保持 fail-fast：宿主未注入、返回值类型错误、或 provider 不支持时，必须显式报错，不做静默兼容。

## Window Key

- 宿主注入点：`window.__DREAMMINISTAGE_SESSION_HOST__`
- 页面协议模块：`app/session/session-host-bridge.ts`

## 当前支持的方法

### `translateText(text, options?) => string | Promise<string>`

- 对应 slash：`/translate`
- `text`: 待翻译正文
- `options.target`: 目标语言，例如 `"ja"`、`"zh"`
- `options.provider`: 宿主侧 provider 名称；推荐把默认 provider 也显式命名，而不是依赖隐式分支
- 返回值必须是字符串；非字符串会被 `/session` 视为协议违规并显式失败

### `getYouTubeTranscript(urlOrId, options?) => string | Promise<string>`

- 对应 slash：`/yt-script`
- `urlOrId`: YouTube URL 或视频 ID
- `options.lang`: transcript 语言，例如 `"ja"`、`"en"`
- 返回值必须是字符串；非字符串会被 `/session` 视为协议违规并显式失败

## 页面侧行为

- 页面入口通过 `resolveSessionSlashHostBridge(...)` 读取宿主对象。
- 当方法缺失时，页面会报：
  - `/translate is not wired in /session host yet: window.__DREAMMINISTAGE_SESSION_HOST__.translateText`
  - `/yt-script is not wired in /session host yet: window.__DREAMMINISTAGE_SESSION_HOST__.getYouTubeTranscript`
- 这两条报错是回归门的一部分；不要替换成静默空转或模糊提示。

## 推荐注入方式

```ts
window.__DREAMMINISTAGE_SESSION_HOST__ = {
  async translateText(text, options) {
    return await myTranslateProvider.translate(text, options);
  },
  async getYouTubeTranscript(urlOrId, options) {
    return await myTranscriptProvider.fetch(urlOrId, options);
  },
};
```

## 兼容性边界

- 允许只注入 `translateText` 或只注入 `getYouTubeTranscript`；未注入的方法继续 fail-fast。
- 不提供 legacy key、备用 window slot、或 silent fallback。
- 如果后续要引入默认 provider，应直接在宿主层明确默认值，并保持本协议 shape 不变。

## 当前回归门

- 页面级：`app/session/__tests__/page.slash-integration.test.tsx`
- 协议级：`app/session/__tests__/session-host-bridge.test.ts`
- Replay 成功路径：`round9 /yt-script`、`round10 /translate`
- Replay 失败路径：`round11 /translate`、`round11 /yt-script`
