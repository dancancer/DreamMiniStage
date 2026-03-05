# SillyTavern Regex 扩展说明

## 作用概览
- 为角色卡、预设或全局文本应用自定义正则脚本，用于清洗、重写或提取内容（如格式化世界信息、对话、作者注等）。
- 支持多来源合并：全局脚本、角色嵌入脚本、预设脚本，按优先级顺序运行。
- 提供可视化编辑、调试、批量导入导出、按角色/预设授权启用等功能。

## 核心文件
- `public/scripts/extensions/regex/engine.js`：获取/运行/保存正则脚本，核心算法。
- `public/scripts/extensions/regex/dropdown.html`：UI 下拉菜单（创建/导入/批量操作/预设选择）。
- `public/scripts/extensions/regex/debugger.html`：调试器界面（步骤展示、替换高亮、渲染模式）。
- `public/scripts/extensions/connection-manager/index.js`：连接配置可绑定 regex preset。

## 数据模型与存储
- **RegexScript** 主要字段（见 `engine.js`）：
  - `findRegex`：待匹配正则，字符串形式。
  - `replaceString`：替换模板；支持 `{{match}}` → `$0` 替换。
  - `disabled`：是否禁用该脚本。
  - `trimStrings`：过滤匹配结果时的附加修剪规则。
  - `substituteRegex`：枚举 `NONE` / `RAW` / `ESCAPED`，决定对 findRegex 做参数替换及是否转义宏（`substituteParamsExtended`）。
  - `placement`：枚举 `regex_placement`，决定应用位置（如 REASONING、PROMPT 等）。
  - 其它元数据：脚本 id、name、备注等（由 UI 维护）。

- **存储来源**（按优先级合并）：
  1) 全局：`extension_settings.regex`
  2) 角色嵌入：`characters[this_chid]?.data?.extensions?.regex_scripts`
  3) 预设附带：`presetManager.readPresetExtensionField({ path: 'regex_scripts' })`

- **授权控制**：
  - 角色允许列表：`extension_settings.character_allowed_regex`（avatar 名）。
  - 预设允许列表：`extension_settings.preset_allowed_regex[apiId]`。
  - 只有在允许列表中的角色/预设脚本才会参与合并（`allowedOnly` 参数）。

## 运行流程
1) 调用 `getRegexScripts(scriptType, { allowedOnly })` 按来源汇总脚本，脚本类型由调用方指定（`SCRIPT_TYPES` 枚举）。
2) `regexString = runRegexScript(regexScript, rawString, params)`：
   - 跳过 disabled/无 regex/空文本。
   - 根据 `substituteRegex`：
     - `NONE`：直接使用 findRegex。
     - `RAW`：`substituteParamsExtended(findRegex)`。
     - `ESCAPED`：`substituteParamsExtended(findRegex, {}, sanitizeRegexMacro)`（宏转义）。
   - 构造 RegExp：`regexFromString(regexString)`。
   - 替换：`replaceString` 中 `{{match}}` → `$0`，执行 `rawString.replace(findRegex, replaceString)`。
   - 过滤：`filterString(match, regexScript.trimStrings, { characterOverride })` 用于进一步裁剪匹配结果。
3) `regexString`/替换结果按 `regex_placement` 注入到对应位置（如 reasoning、prompt）。
4) 处理完成的字符串返回给调用者；调用方决定如何应用（如展示、发送前处理）。

## 位置与参数枚举
- `regex_placement`（`engine.js:223`）：标记脚本作用区（如 `REGEX_REASONING`, `REGEX_PROMPT`, `REGEX_CHAT` 等，具体枚举在代码中）。
- `substitute_find_regex`（`engine.js:240`）：`NONE` / `RAW` / `ESCAPED`，决定 findRegex 的参数替换策略。
- `RegexParams` / `RegexScriptParams`：调用时可传 `characterOverride`、`isMarkdown`、`isPrompt`、`isEdit`、`depth` 等，影响宏替换或过滤行为。

## UI 与操作
- 下拉面板（`dropdown.html`）：
  - 新建脚本：Global / Preset / Scoped(角色)。
  - 导入/导出 JSON（支持批量）。
  - Bulk 操作：启用/禁用、移动到不同作用域、删除。
  - Regex Presets：保存一组“启用状态+脚本集”，可快速切换；连接配置可引用 `regex-preset`。
  - Debugger：打开高级调试界面。

- 调试器（`debugger.html`）：
  - 列表显示当前规则、可排序。
  - 输入测试文本，查看逐步替换与最终结果，支持高亮或渲染为 message 模式。

## 预设与角色嵌入
- 角色卡可携带 `extensions.regex_scripts`，需在“允许角色 regex”列表中才生效。
- 预设可携带 `regex_scripts`（存储在预设 extensions 字段），需允许该预设才生效。
- Global/Preset/Scoped 脚本混合时按合并顺序运行，UI 支持按来源迁移/导出。

## 批量/授权逻辑
- 批量移动脚本：在下拉菜单 Bulk 区域可移动到 global/preset/scoped。
- 授权开关：`allowCharacterRegex` / `disallowCharacterRegex` / `allowPresetRegex` / `disallowPresetRegex` 相关函数（`engine.js`）维护允许列表。

## 使用要点
- 优先级：获取时按来源顺序合并（global → scoped → preset），在 `engine.js` 先后顺序即执行优先级。
- 正则编译：`regexFromString` 支持带修饰符的字符串（如 `/foo/gi`）；`substituteRegex` 可对 pattern 进行参数化或转义，避免宏破坏正则。
- 替换模板：`{{match}}` 会在运行时替换为 `$0` 以兼容 JS replace。
- 性能与安全：空文本/禁用脚本/不允许的来源会被跳过；若关闭扩展或 placement 未指定则直接返回原文。
