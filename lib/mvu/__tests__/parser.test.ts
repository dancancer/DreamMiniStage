/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU Parser 测试                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import { extractCommands, parseCommandValue, fixPath } from "../core/parser";

describe("parseCommandValue", () => {
  it("解析布尔值", () => {
    expect(parseCommandValue("true")).toBe(true);
    expect(parseCommandValue("false")).toBe(false);
  });

  it("解析 null 和 undefined", () => {
    expect(parseCommandValue("null")).toBe(null);
    expect(parseCommandValue("undefined")).toBe(undefined);
  });

  it("解析数字", () => {
    expect(parseCommandValue("42")).toBe(42);
    expect(parseCommandValue("3.14")).toBe(3.14);
    expect(parseCommandValue("-10")).toBe(-10);
  });

  it("解析 JSON 对象", () => {
    expect(parseCommandValue("{\"a\": 1}")).toEqual({ a: 1 });
    expect(parseCommandValue("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("解析字符串", () => {
    expect(parseCommandValue("\"hello\"")).toBe("hello");
    expect(parseCommandValue("\"world\"")).toBe("world");
  });

  it("解析数学表达式", () => {
    expect(parseCommandValue("10 + 5")).toBe(15);
    expect(parseCommandValue("100 / 4")).toBe(25);
  });
});

describe("fixPath", () => {
  it("处理简单路径", () => {
    expect(fixPath("a.b.c")).toBe("a.b.c");
  });

  it("处理数组索引", () => {
    expect(fixPath("a[0].b")).toBe("a[0].b");
    expect(fixPath("a[1][2]")).toBe("a[1][2]");
  });

  it("处理带引号的键", () => {
    expect(fixPath("a[\"key\"].b")).toBe("a[key].b");
    expect(fixPath("a[\"key\"].b")).toBe("a[key].b");
  });

  it("处理带空格的键", () => {
    expect(fixPath("a[\"key with space\"].b")).toBe("a[\"key with space\"].b");
  });
});

describe("extractCommands", () => {
  it("提取 set 命令", () => {
    const text = "_.set('path.to.var', 100);//更新原因";
    const commands = extractCommands(text);

    expect(commands).toHaveLength(1);
    expect(commands[0].type).toBe("set");
    expect(commands[0].args).toEqual(["'path.to.var'", "100"]);
    expect(commands[0].reason).toBe("更新原因");
  });

  it("提取多个命令", () => {
    const text = `
      _.set('a', 1);//原因1
      _.add('b', 5);//原因2
      _.delete('c');//原因3
    `;
    const commands = extractCommands(text);

    expect(commands).toHaveLength(3);
    expect(commands[0].type).toBe("set");
    expect(commands[1].type).toBe("add");
    expect(commands[2].type).toBe("delete");
  });

  it("处理嵌套括号", () => {
    const text = "_.set('path', {\"nested\": [1, 2, 3]});";
    const commands = extractCommands(text);

    expect(commands).toHaveLength(1);
    expect(commands[0].args[1]).toBe("{\"nested\": [1, 2, 3]}");
  });

  it("处理 UpdateVariable 块", () => {
    const text = `
      <UpdateVariable>
        <Analysis>变量分析</Analysis>
        _.set('好感度', 50, 60);//好感度提升
      </UpdateVariable>
    `;
    const commands = extractCommands(text);

    expect(commands).toHaveLength(1);
    expect(commands[0].type).toBe("set");
  });

  it("处理命令别名", () => {
    const text = `
      _.remove('a');//删除
      _.unset('b');//删除
      _.assign('c', 'key', 'value');//插入
    `;
    const commands = extractCommands(text);

    expect(commands).toHaveLength(3);
    expect(commands[0].type).toBe("delete");
    expect(commands[1].type).toBe("delete");
    expect(commands[2].type).toBe("insert");
  });
});
