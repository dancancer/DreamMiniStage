# Slash Command 行为差异分析

> **更新时间**: 2024-12-11
> **测试覆盖**: 23/23 通过
> **实现位置**: `lib/slash-command/`

当前实现已切换到内核解析/执行器（递归下降 + 链式作用域 + 生成器），支持 `{: :}`、`/if` `/while` `/times`、控制信号 `/return` `/break` `/abort` 与作用域变量 `/let|/var`。仍与 SillyTavern 在参数、返回值、UI 副作用上存在差异。

---

## 📊 差异总览

| 命令 | 兼容性 | 主要差异 |
|------|--------|----------|
| `/send` | ⚠️ 部分兼容 | 已支持 `at`/`name`/`compact`/`return`；无 persona/布局副作用 |
| `/trigger` | ⚠️ 部分兼容 | 返回空字符串，await + 简单生成锁 + 群组成员参数 |
| `/setvar` | ⚠️ 部分兼容 | 无 `index`/`as`，缺少全局/本地开关 |
| `/getvar` | ⚠️ 部分兼容 | 无 `index`，无数字转换 |
| `/delvar` | ⚠️ 部分兼容 | 无 `/flushvar` 别名 |
| `/let` `/var` | ⚠️ 部分兼容 | 仅作用域变量，不写入聊天存储 |
| `/if` `/while` `/times` | ⚠️ 部分兼容 | 支持 `{: :}` 块，条件为 truthy 判断 |
| `/echo` | ✅ 基本兼容 | 无 toast/UI 副作用 |
| `/pass` | ✅ 项目扩展 | SillyTavern 无该命令 |
| `/return` | ✅ 基本兼容 | 终止执行链并返回值 |
| `/break` `/abort` | ✅ 基本兼容 | 控制信号 |
| `/sendas` | ⚠️ 部分兼容 | 依赖 `onSendAs` 回调 |
| `/sys` | ⚠️ 部分兼容 | 依赖 `onSendSystem` |
| `/impersonate` | ⚠️ 部分兼容 | 依赖 `onImpersonate` |
| `/continue` `/cont` | ⚠️ 部分兼容 | 调用 `onContinue`/`onTrigger` |
| `/swipe` | ⚠️ 部分兼容 | 透传 `onSwipe` |
| `/add` `/sub` | ⚠️ 部分兼容 | 数字求和/相减 |
| `/len` `/trim` | ✅ 基础功能 | 字符串长度/裁剪 |
| `/push` | ⚠️ 部分兼容 | append 数组 |

---

## 0. 内核与控制流现状

- **已对齐的形态**：支持 `{: ... :}` 块、`/if` `/while` `/times`、控制信号 `/return` `/break` `/abort`，作用域栈支持 `/let|/var`。
- **局限**：条件只做字符串 truthy 判断；不支持表达式比较、宏/模板替换、`parser-flag`、`return=` 等高级特性；作用域与聊天变量隔离（`/setvar` 不会进入作用域，`/let` 不会持久化）。

---

## 1. `/send` 命令

### SillyTavern 原版

```javascript
// 命令签名
/send [compact=false] [at=<index>] [name=<persona>] [return=none] <text>
```
- 插入位置/角色名/布局/返回值类型可配置；空文本会照常插入。

### 当前项目实现

```typescript
// lib/slash-command/registry.ts
const handleSend: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const text = (args.join(" ") || pipe || "").toString();
  const at = normalizeIndex(parseNumber(namedArgs.at), ctx.messages?.length ?? 0);
  const name = namedArgs.name;
  const compact = parseBoolean(namedArgs.compact);
  const returnType = namedArgs["return"];

  await ctx.onSend(text, { at, name, compact, returnType });
  return buildSendReturn(returnType, text, pipe, at);
};
```

### 差异
- 支持 `at`（含负索引）、`name`（存入 message.name）、`compact`（元数据）、`return`（none/pipe/object/text），空字符串/`...` 会发送。
- 名称/compact 暂无 UI 副作用；插入为本地消息数组操作（未做后端同步）。

---

## 2. `/trigger` 命令

| 特性 | SillyTavern | 当前项目 |
|------|-------------|----------|
| await/生成锁 | ✅ | ⚠️（await 参数 + 简单串行锁） |
| 群组成员指定 | ✅ | ⚠️（参数透传，需回调支持） |
| 返回值 | `""` | `""` |

- 实现：调用 `ctx.onTrigger(member)`；按 characterId 串行化执行，默认 await=true。

---

## 3. 变量命令 `/setvar` `/getvar` `/delvar`

| 特性 | SillyTavern | 当前项目 | 差异 |
|------|-------------|----------|------|
| `index` 访问 | ✅ | ❌ | 缺失 |
| `as` 类型转换 | ✅ | ❌ | 缺失 |
| 本地/全局区分 | ✅ | ⚠️ (依赖 characterId) | 无显式命令 |
| 空 key 处理 | 报错 | 静默返回 | 不同 |
| 删除命令名 | `/flushvar` | `/delvar` | 命名不同，无别名 |
| 闭包参数 | ✅ | ❌ | 缺失 |

- `/setvar` 支持命名参数和 `key=value`，但返回值不统一（命名参数模式返回 pipe，其它模式返回设置值）。
- `/getvar` 把 `undefined` 转为空字符串，且不做数字转换。

---

## 4. 作用域变量 `/let` `/var`

- **SillyTavern**：声明作用域变量，可与 `/if`/`/while` 配合，查找冒泡。
- **当前**：写入执行器的作用域栈（`ScopeChain`），不写入聊天变量，也不会从聊天变量回填；适用于控制流内部条件判断。无类型转换/结构解构。

---

## 5. 控制流 `/if` `/while` `/times` `/break` `/abort`

- 支持 `{: ... :}` 块语法；`/break` 退出当前块；`/abort` 触发 `isError: true, aborted: true`。
- 条件求值：仅对字符串做 truthy 判断，`$pipe` 取当前管道值，其它标识需先用 `/let|/var` 写入作用域。
- 不支持表达式比较（如 `a>1`）、`/continue`（循环控制版）、`parser-flag`。

---

## 6. `/echo` & `/pass`

- `/echo`：返回参数或 pipe，无 UI toast。
- `/pass`：透传 pipe（SillyTavern 无该命令，用 `{{pipe}}` 宏替代）。

---

## 7. `/return`

- **SillyTavern**：返回值并终止脚本，支持 `return=<type>`。
- **当前**：`/return <value?>` 终止执行链，返回参数或 pipe；不支持 `return=` 类型枚举。

---

## 8. 扩展消息命令

### `/sendas <role> <text>`
- 依赖 `ctx.onSendAs`；无回调时退化为 `onSend("[role] text")`。
- 无 persona 元数据/头像/插入位置/群组成员支持。

### `/sys <text>`
- 依赖 `ctx.onSendSystem`；无回调时前缀 `[SYS]` 发送用户消息。
- 无 severity/标题等 UI 选项。

### `/impersonate <text>`
- 依赖 `ctx.onImpersonate`；无回调时发送 `[impersonate] text` 后调用 `onTrigger`。
- 无角色选择/姿态控制。

### `/continue` (`/cont`)
- 调用 `ctx.onContinue`，缺省时回退到 `onTrigger`；不检查生成锁/上下文。

### `/swipe [index]`
- 仅透传 `ctx.onSwipe(target)`；未对接实际多候选切换逻辑。

---

## 9. P2 基础算子

| 命令 | 行为 | 与 SillyTavern 的主要差异 |
|------|------|--------------------------|
| `/add` | 将 pipe 作为前置操作数求和；无参时返回 `0` | 无 `return` 选项；仅数字，`Number()` 解析失败会报错终止链 |
| `/sub` | 依次相减，pipe 也参与 | 同上 |
| `/len` | 计算参数或 pipe 的字符串长度 | 返回字符串，不支持对象/数组长度 |
| `/trim` | 去除参数或 pipe 的首尾空白 | 仅字符串 |
| `/push` | 将值 append 到变量数组（非数组则新建）；返回 JSON 字符串 | 无 `pop`/`shift`/`slice` 等配套命令，未做类型转换 |

---

## 📋 兼容性修复建议（优先级）

1. `/send`：persona/compact 的 UI 与持久化语义；`at` 插入与对话树/后端同步；`return` 支持 chat-* 类型。
2. `/trigger`：群组成员选择接线（按 member 路由生成），与 UI isSending/生成锁状态联动。
3. 变量命令：补 `/flushvar` 别名、`index`/`as`、本地/全局区分与数字转换。
4. 控制流：提供表达式求值或将聊天变量注入作用域（使 `/if someVar` 可用）。
5. 消息扩展：`/sendas`/`/sys`/`/impersonate` 接入正式渲染与消息类型；`/swipe` 对接真实多候选。
6. 算子：补齐 `return=` 选项、类型安全与数组/字符串配套命令。

---

## 🔧 快速修复代码示例

### `/send` 支持 at/name/compact/return 并允许空文本
```typescript
const handleSend: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const text = (args.join(" ") || pipe || "").toString();
  const at = normalizeIndex(parseNumber(namedArgs.at), ctx.messages?.length ?? 0);
  const name = namedArgs.name;
  const compact = parseBoolean(namedArgs.compact);
  const returnType = namedArgs["return"];

  await ctx.onSend(text, { at, name, compact, returnType });
  return buildSendReturn(returnType, text, pipe, at);
};
```

### `/trigger` 返回空字符串
```typescript
const handleTrigger: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  const member = args[0] ?? namedArgs.member;
  const shouldAwait = parseBoolean(namedArgs["await"], true);
  const lockKey = ctx.characterId || "__default__";
  const pending = TRIGGER_LOCKS.get(lockKey);
  if (pending) await pending.catch(() => {});
  const triggerPromise = ctx.onTrigger(member);
  TRIGGER_LOCKS.set(lockKey, Promise.resolve(triggerPromise));
  if (shouldAwait) await triggerPromise;
  triggerPromise.finally(() => TRIGGER_LOCKS.delete(lockKey));
  return "";
};
```

### `/delvar` 增加 `/flushvar` 别名
```typescript
export const COMMAND_REGISTRY = new Map<string, CommandHandler>([
  ["delvar", handleDelVar],
  ["flushvar", handleDelVar],
  // ...
]);
```
