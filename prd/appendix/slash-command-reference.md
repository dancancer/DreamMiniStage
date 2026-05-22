# Slash Command Reference

> 当前注册表入口：`lib/slash-command/registry/index.ts`
> 命令清单分片：`lib/slash-command/registry/command-group-*.ts`
> 静态扫描：464 个命令/别名。

## 1. 分组清单

| 分组 | 数量 | 代表命令 |
|------|------|----------|
| Core | 27 | `/send`, `/trigger`, `/sys`, `/impersonate`, `/continue`, `/swipe`, `/checkpoint-create` |
| Chat | 67 | `/newchat`, `/tempchat`, `/renamechat`, `/hide`, `/unhide`, `/member-add`, `/reasoning-get` |
| Generation | 59 | `/gen`, `/genraw`, `/summarize`, `/inject`, `/model`, `/context`, `/instruct` |
| Lore | 32 | `/world`, `/getcharbook`, `/setlorefield`, `/wi-get-timed-effect`, `/vector-query` |
| DataBank | 33 | `/data-bank`, `/db-list`, `/db-add`, `/db-search` |
| UI | 29 | `/panels`, `/bg`, `/bubble`, `/theme`, `/css-var`, `/popup`, `/vn` |
| Utility | 25 | `/run`, `/show-gallery`, `/trimtokens`, `/reload-page`, `/clipboard-get` |
| Variable | 23 | `/setvar`, `/getvar`, `/incvar`, `/push`, `/flushvar` |
| Operator | 24 | `/add`, `/sub`, `/mul`, `/rand`, `/replace`, `/match` |
| QuickReply | 24 | `/qr`, `/qr-set`, `/qr-create`, `/qr-contextadd` |
| Message | 18 | `/getmessage`, `/setmessage`, `/edit`, `/del`, `/message-role` |
| Note/Persona | 15 | `/persona`, `/persona-lock`, `/note`, `/note-depth` |
| Expression | 14 | `/expression-set`, `/emote`, `/expression-list`, `/expression-upload` |
| JS Slash Runner | 14 | `/event-emit`, `/audioplay`, `/audioimport`, `/audiovolume` |
| Tooling | 12 | `/tools-list`, `/tool-invoke`, `/tag-add` |
| SystemPrompt | 10 | `/sysprompt`, `/sysprompt-on`, `/sysgen` |
| Character | 9 | `/char`, `/go`, `/random`, `/rename-char`, `/ask` |
| Extension | 8 | `/extension-enable`, `/extension-state`, `/translate`, `/yt-script` |
| Secret | 8 | `/secret-id`, `/secret-write`, `/secret-read` |
| ProfilePrompt | 8 | `/profile`, `/prompt`, `/prompt-post-processing` |
| API | 4 | `/api`, `/api-url`, `/proxy` |
| Fuzzy | 1 | `/fuzzy` |

## 2. 执行入口

- 用户在聊天输入框输入 `/...`。
- 角色卡脚本通过 script bridge 调用 `triggerSlash`。
- 插件 iframe 通过 `registerSlashCommand` 注册自定义命令。
- Quick Reply 可注册命令标签。

## 3. Host 依赖

部分命令纯本地执行；部分命令依赖 host callbacks：

- translation / YouTube transcript。
- clipboard。
- extension state。
- gallery list/show。
- checkpoint/branch。
- group members。
- timed world info。
- audio。
- UI panels/background/theme/popup。

缺少 host 时必须返回错误结果，不能假成功。

## 4. 用户可见规则

- Slash command 不进入 LLM 消息流，除非命令显式发送消息或触发生成。
- 串联命令中段失败后，后续命令不继续执行。
- 命令参数错误要 fail-fast，并给出命令名相关错误。
- 页面直输 slash 和 iframe script bridge 应共享同一调试链路。
