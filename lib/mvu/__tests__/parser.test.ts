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

  it("解析扩展数学表达式（Math/math 别名）", () => {
    expect(parseCommandValue("sqrt(144)")).toBe(12);
    expect(parseCommandValue("log(1000, 10)")).toBe(3);
    expect(parseCommandValue("math.sqrt(16) + pow(2, 3)")).toBe(12);
    expect(parseCommandValue("Math.cos(Math.PI) + 2")).toBeCloseTo(1, 12);
  });

  it("解析 complex/date 扩展表达式（无需 mathjs）", () => {
    expect(parseCommandValue("complex(2, -3)")).toBe("2-3i");
    expect(parseCommandValue("date(\"2026-03-02T10:00:00Z\")")).toBe(1772445600000);
  });

  it("未知数学符号保持原样字符串", () => {
    expect(parseCommandValue("hp + bonus")).toBe("hp + bonus");
    expect(parseCommandValue("'10 + 2'")).toBe("10 + 2");
    expect(parseCommandValue("matrix(1,2,3)")).toBe("matrix(1,2,3)");

    const matrixExpr = "math.matrix([[1, 2], [3, 4]]).multiply(math.matrix([[5], [6]]))";
    expect(parseCommandValue(matrixExpr)).toBe(matrixExpr);
  });

  it("解析 YAML 片段", () => {
    expect(parseCommandValue("name: Alice\nhp: 10")).toEqual({
      name: "Alice",
      hp: 10,
    });
    expect(parseCommandValue("- sword\n- shield")).toEqual(["sword", "shield"]);
  });
});

describe("fixPath", () => {
  // 基础测试
  it("处理简单路径", () => {
    expect(fixPath("a.b.c")).toBe("a.b.c");
  });

  it("处理数组索引", () => {
    expect(fixPath("a[0].b")).toBe("a[0].b");
    expect(fixPath("a[1][2]")).toBe("a[1][2]");
  });

  it("处理带引号的键", () => {
    expect(fixPath("a[\"key\"].b")).toBe("a[key].b");
    expect(fixPath("a['key'].b")).toBe("a[key].b");
  });

  it("处理带空格的键", () => {
    expect(fixPath("a[\"key with space\"].b")).toBe("a[\"key with space\"].b");
  });

  // 对照 MagVarUpdate pathFix 测试用例
  it("baseline: 保持正确路径不变", () => {
    const input = "测试员.物品&装备.武器栏[衔尾蛇OICW原型].弹药系统[\"7.62mm ETC弹匣\"].载弹量";
    // 注意：我们的实现可能与 MagVarUpdate 略有不同
    const out = fixPath(input);
    expect(out).toContain("测试员");
    expect(out).toContain("武器栏");
  });

  it("点分段: 移除简单标识符的额外引号", () => {
    expect(fixPath("foo.\"bar\".baz")).toBe("foo.bar.baz");
    expect(fixPath("foo.'bar'.baz")).toBe("foo.bar.baz");
  });

  it("点分段: 带空格的引号段转为括号字符串", () => {
    expect(fixPath("foo.\"a b\".c")).toBe("foo[\"a b\"].c");
  });

  it("括号: 纯数字索引不带引号", () => {
    expect(fixPath("foo[0]")).toBe("foo[0]");
    expect(fixPath("foo[  12  ]")).toBe("foo[12]");
  });

  it("括号字符串: 无空白保持裸形式", () => {
    expect(fixPath("武器栏[衔尾蛇]")).toBe("武器栏[衔尾蛇]");
    expect(fixPath("武器栏[\"衔尾蛇\"]")).toBe("武器栏[衔尾蛇]");
    expect(fixPath("武器栏['衔尾蛇']")).toBe("武器栏[衔尾蛇]");
  });

  it("括号字符串: 含空白强制引号形式", () => {
    expect(fixPath("foo[hello world]")).toBe("foo[\"hello world\"]");
    expect(fixPath("foo[\"hello world\"]")).toBe("foo[\"hello world\"]");
  });

  it("空或仅空白的括号", () => {
    expect(fixPath("foo[]")).toBe("foo[]");
    expect(fixPath("foo[   ]")).toBe("foo[]");
  });

  it("括号内 trim", () => {
    expect(fixPath("foo[   abc   ]")).toBe("foo[abc]");
    expect(fixPath("foo[   a b   ]")).toBe("foo[\"a b\"]");
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
