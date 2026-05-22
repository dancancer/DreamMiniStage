# 03. Personas

> 路由：`/personas`
> 入口：`app/personas/page.tsx`

## 1. 用户目标

用户维护“自己在故事里是谁”。Persona 用于替换 `{{user}}`、提供 `{{persona}}` 内容，或以 Author's Note/指定深度方式注入提示词。

## 2. 页面能力

- Persona 列表。
- 新建/编辑 Persona。
- 删除确认。
- 设置默认 Persona。
- 激活 Persona。
- 导出全部 Persona 数据。

## 3. Persona 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | UUID |
| `name` | string | 显示名，必填 |
| `avatarPath` | string | data URL 或相对路径 |
| `description` | string | Persona 描述 |
| `position` | enum | 描述注入位置 |
| `depth` | number | `AT_DEPTH` 时使用 |
| `role` | `system | user` | 注入消息角色 |
| `createdAt/updatedAt` | ISO string | 元数据 |

## 4. 注入位置

| 值 | 业务含义 |
|----|----------|
| `IN_PROMPT` | 通过 `{{persona}}` 注入 story string |
| `TOP_AN` | Author's Note 上方 |
| `BOTTOM_AN` | Author's Note 下方 |
| `AT_DEPTH` | 从聊天历史底部按深度注入 |
| `NONE` | 不注入 |

## 5. 交互规则

- 名称不能为空。
- `AT_DEPTH` 才展示 depth 输入。
- 用户可上传头像，也可生成首字母默认头像。
- 默认 Persona 和当前激活 Persona 是两种不同状态。
- 运行时 Persona 解析优先级：chat lock > character connection > default > none。

## 6. 数据依赖

- `hooks/usePersonas.ts`
- `lib/store/persona-store.ts`
- `lib/models/persona-model.ts`
- `lib/data/roleplay/persona-operation.ts`
