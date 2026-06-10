// status-pattern —— status/state 类 source tag 的模式检测。
// 单一事实来源：classifier 与 extractor 都从这里 import，避免重复实现漂移。

/** source tag 是否为携带转义 JSON 大括号的 status/state/dashboard/variables/SFW/NSFW 标签。 */
export function isStatusJsonSourcePattern(pattern: string): boolean {
  return /\\\{/.test(pattern) &&
    /<\\?\/?((?:[a-z][a-z0-9_-]*(?:status|state|dashboard|variables?)[a-z0-9_-]*)|status|state|dashboard|variables?|SFW|NSFW)>/i.test(pattern);
}

/** source tag 是否为 `<SFW>` / `<NSFW>` 状态标签。 */
export function isSfwStatusSourcePattern(pattern: string): boolean {
  return /<SFW>|<NSFW>/i.test(pattern);
}
