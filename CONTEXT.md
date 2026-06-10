# DreamMiniStage Context

DreamMiniStage 是一个本地优先的沉浸式叙事舞台。这个上下文用于统一角色、身份、会话、世界设定、提示词和叙事控制相关的项目语言。

## Language

### Product Surface

**DreamMiniStage**:
面向叙事创作者和体验者的产品上下文，用于持续的角色扮演、故事续写和上下文管理。它是叙事舞台，不是通用聊天应用或后台系统。
_Avoid_: Chat app, dashboard, backend product

**Narrative Stage**:
用户进入和延续故事的舞台空间，由角色、会话、上下文资产和生成控制共同构成。它强调沉浸感、连续性和作者可控性。
_Avoid_: Chatroom, workspace, control panel

**Session**:
用户可见的叙事实例，绑定到一个 Character Card。同一个 Character Card 可以创建多个 Session，删除 Session 会删除对应 Dialogue Tree，但不删除 Character Card。
_Avoid_: Chat, conversation, thread

**Dialogue Tree**:
Session 内部的分支式对话记录。它承载开场白、用户回合、助手回合、再生、swipe、隐藏和恢复后的完整故事路径。
_Avoid_: Flat transcript, message list

**Dialogue Turn**:
Dialogue Tree 中的一步叙事推进。它可以来自用户、助手生成，或本地控制动作。
_Avoid_: Log line, event, row

**Opening**:
Session 开始时可选的第一条助手消息。Opening 是故事起点的一部分，用户开始对话后不再随意切换。
_Avoid_: Greeting, sample reply, placeholder

**Swipe**:
同一对话位置上的候选助手续写。Swipe 表示另一种故事分支，不是新的用户请求。
_Avoid_: Retry, edit, duplicate message

**Character Card**:
作者维护的角色资产，用来锚定一个可游玩的角色。它包含角色身份和叙事源材料。
_Avoid_: Bot, contact, profile

**Persona**:
用户在叙事中的扮演身份。Persona 与 Character Card 分离，用来描述“用户作为谁进入故事”。
_Avoid_: User account, character, model profile

**Local Data Boundary**:
叙事数据默认由用户本地环境控制的产品边界。它是信任边界，不是部署细节。
_Avoid_: Cloud account, server workspace

**External Boundary**:
任何离开本地叙事空间的服务边界，例如模型提供方、远程备份、阅读服务、分析服务或插件发现。该边界上的失败应当对用户显式可见。
_Avoid_: Backend, infrastructure, integration

### Imported Narrative Assets

**Story Agent**:
由外部叙事资产编译成 DreamMiniStage 自有故事模型后的可游玩叙事代理。运行时不应把它当作原始 SillyTavern 对象。
_Avoid_: Bot, imported character, ST runtime

**Story Agent Import**:
把外部叙事资产转成 Story Agent 前的审阅与确认过程。它需要暴露语义损失、不支持内容和修复结果。
_Avoid_: Upload, migration, conversion

**Session Blueprint**:
Story Agent 的规范化编译定义。它把 Agent Profile、Prompt Stack、World Module、Transform、Render Intent、初始 Story State、Memory Policy、诊断和来源信息收敛成一个叙事契约。
_Avoid_: Preset, raw card, runtime config

**Agent Profile**:
Story Agent 的编译后叙事身份。它描述名称、角色说明、性格、场景、Opening、示例和提示词片段。
_Avoid_: Character Card, model profile, user profile

**Prompt Stack**:
按角色和顺序组织的提示词消息集合，构成 Story Agent 的稳定叙事指令基础。它不是临时拼接出来的一段 prompt。
_Avoid_: Prompt text, template, prompt_order

**World Module**:
Story Agent 使用的编译后世界上下文。它来自作者维护的世界材料，并被收敛成可在叙事中激活的条目。
_Avoid_: World Book, World Info, lore file, raw world info

**Text Transform**:
声明了作用方向的文本转换规则，可作用于输入、输出或提示词。只有能表达为安全叙事转换的规则才属于这个概念。
_Avoid_: Regex hack, script, plugin

**Content Rule**:
对运行时必须显式处理的内容约束说明，例如不支持的 UI 内容或 markdown-only 期望。它记录叙事约束，不代表执行源行为。
_Avoid_: Validator, sanitizer, patch

**Import Diagnostic**:
导入过程中面向用户展示的诊断信息，用来说明哪些内容被接受、修改、拒绝或丢失。它的职责是暴露语义损失。
_Avoid_: Error log, warning text, debug output

**Repair Report**:
导入阶段的修复记录，说明哪些修复已应用、哪些需要人工处理、哪些被拒绝。它解释清理状态，不是运行时行为。
_Avoid_: Changelog, migration log, patch list

**Variable Convention**:
角色卡、世界书或扩展用来声明初始 Story State 的一种可识别模式，例如 `[InitVar]` 世界书条目、`<status_current_variables>` / `<StoryState>` JSON 标签、MVU `initial` 对象、TavernHelper variables 对。它是**按约定识别、不按单卡定制**的提取单位：识别一种约定，所有遵循该约定的角色卡都能自动适配，无需逐卡提取。无法识别的约定必须成为 Import Diagnostic，不静默丢弃。
_Avoid_: per-card schema, 逐卡提取, hardcoded card config

### Context And Prompt Assets

**World Book**:
作者维护的上下文资产，可用于角色级、会话级或全局级世界设定。它是 lore 和情境上下文的可编辑来源。
_Avoid_: World Module, World Info, knowledge base, lore dump

**World Book Entry**:
World Book 中的一条作者上下文。它描述当故事匹配某些条件时应被引入的相关信息。
_Avoid_: World Info Entry, Fact, document, memory

**World Activation**:
决定世界上下文何时相关、如何持续相关的激活语义。它属于叙事上下文选择，不属于界面状态。
_Avoid_: Cache, trigger, flag

**Preset**:
全局提示词工作区，用于维护生成行为相关的提示词资产。它包含 Prompt Entry、排序、采样期望、context 和 sysprompt 等作者配置。
_Avoid_: Model config, template, blueprint

**Prompt Entry**:
Preset 中的一条提示词单元。它有角色、内容、启用状态和顺序关系。
_Avoid_: Message, setting, instruction line

**Model Config**:
用户选择的生成提供方和模型参数。它决定如何请求生成，而 Preset 和上下文资产决定发送什么叙事材料。
_Avoid_: Preset, agent profile, prompt stack

**Regex Script**:
作者维护的文本规则资产，用于在受支持的位置转换或解释叙事文本。它是受限的叙事规则，不是任意插件执行路径。
_Avoid_: Plugin script, JavaScript, render code

**Render Intent**:
从受支持叙事输出模式中提取的安全 UI 语义结构。它描述界面可以渲染什么，不执行任意来源内容。
_Avoid_: HTML, widget code, script output

**Unsupported Regex Fallback**:
对无法安全表达的 regex 或源行为的显式处理方式。不支持的行为应成为诊断或被剥离，不应静默运行。
_Avoid_: Compatibility mode, silent fallback, best effort execution

### Story Runtime State

**Story Session**:
Session 背后的运行期叙事状态。它绑定 Session 和 Session Blueprint，并承载 Recent Transcript、World Activation、Render State、Story State 和 Story Memory。
_Avoid_: Session, store state, chat state

**Recent Transcript**:
用于继续生成的近期故事上下文。它不是完整 Dialogue Tree，只包含运行时维持连续性所需的部分。
_Avoid_: Dialogue tree, complete log, archive

**Story State**:
故事当前的命名变量和结构化状态。它表示后续回合仍应持续生效的叙事事实。
_Avoid_: UI state, plugin state, local variables

**Story Memory**:
Recent Transcript 之外用于维持连续性的长期叙事记忆。它包含摘要、事件片段、事实和关系。
_Avoid_: Vector store, transcript, cache

**Running Summary**:
对当前故事重要内容的持续压缩摘要。它用于保持连续性，而不是重放每个历史回合。
_Avoid_: Recap message, system prompt, notes

**Episode Memory**:
被记住的一段叙事片段。它记录后续可能再次重要的故事时刻。
_Avoid_: Scene, chapter, log chunk

**Fact Memory**:
关于故事世界、角色或情境的稳定事实记忆。它应足够明确，能够影响后续叙事连续性。
_Avoid_: World Book Entry, variable, annotation

**Relationship Memory**:
叙事实体之间的关系状态记忆。它用于维持社交关系和情绪连续性。
_Avoid_: Persona link, character setting, tag

**Render State**:
当前面向界面的结构化故事呈现状态。它来自叙事输出和 Render Intent，不来自任意源脚本。
_Avoid_: DOM state, plugin state, HTML

### Local Control Surface

**Slash Command**:
通过 Session 输入或兼容控制面输入的本地控制指令。它控制本地舞台行为，不应当作发送给模型的用户消息。
_Avoid_: Prompt, user message, script call

**Quick Reply**:
面向用户的快捷输入或草稿入口。它应展开为受支持的本地行为，而不是绕过 Session 控制规则。
_Avoid_: Macro, slash script, plugin action

**Session Tool**:
Session 表面上的低频控制工具，用于检查、调整、导出或调试当前叙事实例。它属于舞台的一部分，不是独立后台功能。
_Avoid_: Settings page, developer tool, sidebar widget

**Prompt Viewer**:
用于查看生成前提示词材料的调试视图。它帮助高级用户检查叙事组装结果，但不是提示词事实来源。
_Avoid_: Prompt editor, console, trace log

**Checkpoint**:
Session 叙事进度中的保存点。它让用户保留或分支故事状态，而不是重新定义 Character Card。
_Avoid_: Git commit, autosave, backup

**JSONL Export**:
用于检查、备份或迁移的行式对话数据导出。它表达叙事记录，不是产品的规范数据模型。
_Avoid_: Database dump, full backup, prompt export
