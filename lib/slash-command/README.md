**一旦我所属的文件夹有所变化，请更新我**

# slash-command/

斜杠命令系统。解析和执行 `/command` 风格的用户指令。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出斜杠命令功能 |
| `types.ts` | 类型定义 | 命令类型定义 |
| `executor.ts` | 核心 | 命令执行器（旧版） |
| `parser.ts` | 核心 | 命令解析器（旧版） |
| `core/` | 子目录 | 核心执行引擎 |
| `registry/` | 子目录 | 命令注册与处理器 |

## 近期约束

- `registry/handlers/js-slash-runner.ts` 的 `audio*` 命令已对齐 JS-Slash-Runner 常用语义：
  - `/audioplay type=... play=...` 为播放/暂停状态切换，不再以 URL 作为主参数。
  - `/audiomode` 仅接受 `repeat|random|single|stop`。
  - `/audioimport` 支持逗号分隔批量 URL，`play=false` 时只导入不播放。
- `registry/handlers/operators.ts` 已补齐一批高频算子命令：
  - 数学：`/mul` `/div` `/mod` `/rand`
  - 字符串：`/split` `/join` `/replace`（别名 `/re`）
  - 约束：`/div` 与 `/mod` 在除数为 0 时 fail-fast 报错。
