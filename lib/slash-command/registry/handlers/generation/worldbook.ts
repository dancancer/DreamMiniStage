/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    WorldBook Command Handlers                            ║
 * ║                                                                          ║
 * ║  WorldBook条目的增删改查命令                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";

/* ═══════════════════════════════════════════════════════════════════════════
   WorldBook 命令
   ═══════════════════════════════════════════════════════════════════════════ */

/** /getentry <id> - 获取 World Book 条目 */
export const handleGetEntry: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getWorldBookEntry) return pipe;
  if (args.length === 0) return pipe;
  const entry = ctx.getWorldBookEntry(args[0]);
  return entry ? JSON.stringify(entry) : "";
};

/** /searchentry <query> - 搜索 World Book 条目 */
export const handleSearchEntry: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.searchWorldBook) return pipe;
  const query = args.join(" ") || pipe;
  if (!query) return "[]";
  const entries = ctx.searchWorldBook(query);
  return JSON.stringify(entries);
};

/** /setentry <id> key=value ... - 设置 World Book 条目属性 */
export const handleSetEntry: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setWorldBookEntry) return pipe;
  if (args.length === 0) return pipe;
  const id = args[0];
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(namedArgs)) {
    if (key === "enabled") {
      data[key] = value.toLowerCase() === "true" || value === "1";
    } else if (key === "priority" || key === "depth") {
      data[key] = parseInt(value, 10);
    } else if (key === "keys") {
      data[key] = value.split(",").map((k) => k.trim());
    } else {
      data[key] = value;
    }
  }
  await ctx.setWorldBookEntry(id, data);
  return pipe;
};

/** /createentry key=value ... - 创建新的 World Book 条目 */
export const handleCreateEntry: CommandHandler = async (_args, namedArgs, ctx, pipe) => {
  if (!ctx.createWorldBookEntry) return pipe;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(namedArgs)) {
    if (key === "enabled") {
      data[key] = value.toLowerCase() === "true" || value === "1";
    } else if (key === "priority" || key === "depth") {
      data[key] = parseInt(value, 10);
    } else if (key === "keys") {
      data[key] = value.split(",").map((k) => k.trim());
    } else {
      data[key] = value;
    }
  }
  const newEntry = await ctx.createWorldBookEntry(data);
  return newEntry ? JSON.stringify(newEntry) : pipe;
};

/** /deleteentry <id> - 删除 World Book 条目 */
export const handleDeleteEntry: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.deleteWorldBookEntry) return pipe;
  if (args.length === 0) return pipe;
  await ctx.deleteWorldBookEntry(args[0]);
  return pipe;
};

/** /activateentry <id> - 手动激活 World Book 条目 */
export const handleActivateEntry: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.activateWorldBookEntry) return pipe;
  if (args.length === 0) return pipe;
  await ctx.activateWorldBookEntry(args[0]);
  return pipe;
};

/** /listentries [book] - 列出 World Book 所有条目 */
export const handleListEntries: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.listWorldBookEntries) return pipe;
  const bookName = args[0];
  const entries = ctx.listWorldBookEntries(bookName);
  return JSON.stringify(entries);
};

/** /worldbook <action> [args] - 世界书管理命令 */
export const handleWorldBook: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const action = args[0].toLowerCase();
  const rest = args.slice(1);

  if (action === "list") {
    if (!ctx.listWorldBookEntries) return pipe;
    return JSON.stringify(ctx.listWorldBookEntries(rest[0]));
  }
  if (action === "get") {
    if (!ctx.getWorldBookEntry || rest.length === 0) return pipe;
    const entry = ctx.getWorldBookEntry(rest[0]);
    return entry ? JSON.stringify(entry) : "";
  }
  if (action === "search") {
    if (!ctx.searchWorldBook) return pipe;
    return JSON.stringify(ctx.searchWorldBook(rest.join(" ") || pipe));
  }
  if (action === "enable") {
    if (!ctx.setWorldBookEntry || rest.length === 0) return pipe;
    await ctx.setWorldBookEntry(rest[0], { enabled: true });
    return pipe;
  }
  if (action === "disable") {
    if (!ctx.setWorldBookEntry || rest.length === 0) return pipe;
    await ctx.setWorldBookEntry(rest[0], { enabled: false });
    return pipe;
  }
  if (action === "delete") {
    if (!ctx.deleteWorldBookEntry || rest.length === 0) return pipe;
    await ctx.deleteWorldBookEntry(rest[0]);
    return pipe;
  }
  return pipe;
};
