/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              MVU 变量管理系统基线测试（SillyTavern 对标）                    ║
 * ║                                                                            ║
 * ║  测试当前项目的 MVU 系统与 SillyTavern MagVarUpdate 插件的行为一致性。     ║
 * ║                                                                            ║
 * ║  覆盖范围：                                                                 ║
 * ║  1. 变量初始化（[InitVar] 条目解析）                                        ║
 * ║  2. 命令解析（_.set, _.insert, _.delete）                                  ║
 * ║  3. 变量更新执行（路径解析、值设置）                                         ║
 * ║  4. display_data vs stat_data 差异                                         ║
 * ║  5. 变量持久化和恢复                                                        ║
 * ║  6. Schema 自动推断和验证                                                   ║
 * ║                                                                            ║
 * ║  ⚠️ 测试结果：59 个测试 - 21 通过 / 36 失败 / 2 跳过 (35.6% 通过率)        ║
 * ║                                                                            ║
 * ║  ⚠️ 已知实现差异（36 个失败）：                                             ║
 * ║                                                                            ║
 * ║  1. 【变量初始化 API 不匹配】（8 个失败）                                    ║
 * ║     - SillyTavern/测试期望：简化的 API 调用方式                             ║
 * ║       initializeVariables({ worldBooks, worldBookNames })                 ║
 * ║     - 当前实现：完整的函数签名                                               ║
 * ║       initializeVariables(existingData, worldBooks, worldBookNames, ...)  ║
 * ║     - 错误：Cannot read properties of undefined (reading 'length')        ║
 * ║     - 位置：lib/mvu/variable-init.ts:250                                   ║
 * ║     - 需要修复：提供简化的 API 包装函数，或统一 API 签名                     ║
 * ║                                                                            ║
 * ║  2. 【命令解析要求分号结尾】（9 个失败）                                      ║
 * ║     - SillyTavern 行为：命令可以不带分号                                    ║
 * ║       _.set('name', 'Alice', 'Bob')                                       ║
 * ║     - 当前实现：命令必须以分号结尾，否则解析失败                              ║
 * ║       _.set('name', 'Alice', 'Bob');                                      ║
 * ║     - 错误：expected [] to have a length of 1 but got +0                 ║
 * ║     - 位置：lib/mvu/core/parser.ts:213-218                                 ║
 * ║     - 需要修复：修改 extractCommands 使分号可选                             ║
 * ║                                                                            ║
 * ║  3. 【命令执行 API 不匹配】（17 个失败）                                     ║
 * ║     - SillyTavern/测试期望：接受 MvuCommand 对象                            ║
 * ║       updateSingleVariable(variables, command)                            ║
 * ║     - 当前实现：接受独立参数                                                ║
 * ║       updateSingleVariable(variables, path, newValue, reason)             ║
 * ║     - 错误：path.replace is not a function                                ║
 * ║     - 位置：lib/mvu/core/parser.ts:291                                     ║
 * ║     - 需要修复：提供接受 MvuCommand 的重载版本                               ║
 * ║                                                                            ║
 * ║  4. 【deepClone 无法处理 undefined】（2 个失败）                            ║
 * ║     - 错误："undefined" is not valid JSON                                 ║
 * ║     - 位置：lib/mvu/core/executor.ts:21                                    ║
 * ║     - 需要修复：在 deepClone 前过滤 undefined 值                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initializeVariables } from "../../mvu/variable-init";
import { extractCommands, parseCommandValue, fixPath } from "../../mvu/core/parser";
import { updateVariablesFromMessage, updateSingleVariable } from "../../mvu/core/executor";
import { generateSchema, validateValue } from "../../mvu/core/schema";
import type { MvuData, StatData, WorldBookEntry } from "../../mvu/variable-init";
import type { MvuCommand } from "../../mvu/types";

// ════════════════════════════════════════════════════════════════════════════
//   测试辅助函数
// ════════════════════════════════════════════════════════════════════════════

/**
 * 创建简化的世界书条目
 */
function createWorldBookEntry(comment: string, content: string): WorldBookEntry {
  return {
    uid: `test-${Math.random().toString(36).slice(2, 9)}`,
    comment,
    content,
    enabled: true,
  };
}

/**
 * 创建 [InitVar] 条目
 */
function createInitVarEntry(variables: Record<string, unknown>): WorldBookEntry {
  return createWorldBookEntry(
    "[InitVar]",
    JSON.stringify(variables, null, 2),
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   测试套件
// ════════════════════════════════════════════════════════════════════════════

describe("MVU 变量管理系统基线测试", () => {
  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 1：变量初始化
  // ──────────────────────────────────────────────────────────────────────────

  describe("变量初始化", () => {
    it("应从 [InitVar] 条目解析简单变量", () => {
      const entry = createInitVarEntry({
        name: "Alice",
        age: 25,
        active: true,
      });

      const result = initializeVariables({
        worldBooks: [[entry]],
        worldBookNames: ["test"],
      });

      expect(result.success).toBe(true);
      expect(result.variables.stat_data.name).toBe("Alice");
      expect(result.variables.stat_data.age).toBe(25);
      expect(result.variables.stat_data.active).toBe(true);
    });

    it("应从 [InitVar] 条目解析嵌套对象", () => {
      const entry = createInitVarEntry({
        player: {
          name: "Bob",
          stats: {
            hp: 100,
            mp: 50,
          },
        },
      });

      const result = initializeVariables({
        worldBooks: [[entry]],
        worldBookNames: ["test"],
      });

      expect(result.success).toBe(true);
      const player = result.variables.stat_data.player as StatData;
      expect(player.name).toBe("Bob");
      const stats = player.stats as StatData;
      expect(stats.hp).toBe(100);
      expect(stats.mp).toBe(50);
    });

    it("应从 [InitVar] 条目解析数组", () => {
      const entry = createInitVarEntry({
        inventory: ["sword", "shield", "potion"],
        numbers: [1, 2, 3, 4, 5],
      });

      const result = initializeVariables({
        worldBooks: [[entry]],
        worldBookNames: ["test"],
      });

      expect(result.success).toBe(true);
      expect(result.variables.stat_data.inventory).toEqual(["sword", "shield", "potion"]);
      expect(result.variables.stat_data.numbers).toEqual([1, 2, 3, 4, 5]);
    });

    it("应合并多个 [InitVar] 条目", () => {
      const entry1 = createInitVarEntry({ a: 1, b: 2 });
      const entry2 = createInitVarEntry({ c: 3, d: 4 });

      const result = initializeVariables({
        worldBooks: [[entry1, entry2]],
        worldBookNames: ["test"],
      });

      expect(result.success).toBe(true);
      expect(result.variables.stat_data.a).toBe(1);
      expect(result.variables.stat_data.b).toBe(2);
      expect(result.variables.stat_data.c).toBe(3);
      expect(result.variables.stat_data.d).toBe(4);
    });

    it("后面的 [InitVar] 条目应覆盖前面的同名变量", () => {
      const entry1 = createInitVarEntry({ value: "old", keep: "original" });
      const entry2 = createInitVarEntry({ value: "new" });

      const result = initializeVariables({
        worldBooks: [[entry1, entry2]],
        worldBookNames: ["test"],
      });

      expect(result.success).toBe(true);
      expect(result.variables.stat_data.value).toBe("new");
      expect(result.variables.stat_data.keep).toBe("original");
    });

    it("应跳过非 [InitVar] 条目", () => {
      const initEntry = createInitVarEntry({ valid: true });
      const normalEntry = createWorldBookEntry("Normal Entry", JSON.stringify({ ignored: true }));

      const result = initializeVariables({
        worldBooks: [[initEntry, normalEntry]],
        worldBookNames: ["test"],
      });

      expect(result.success).toBe(true);
      expect(result.variables.stat_data.valid).toBe(true);
      expect(result.variables.stat_data.ignored).toBeUndefined();
    });

    it("应处理 YAML 格式的 [InitVar] 条目", () => {
      const entry = createWorldBookEntry(
        "[InitVar]",
        "name: Charlie\nage: 30\nactive: true",
      );

      const result = initializeVariables({
        worldBooks: [[entry]],
        worldBookNames: ["test"],
      });

      expect(result.success).toBe(true);
      expect(result.variables.stat_data.name).toBe("Charlie");
      expect(result.variables.stat_data.age).toBe(30);
      expect(result.variables.stat_data.active).toBe(true);
    });

    it("应处理格式错误的 [InitVar] 条目并记录错误", () => {
      const entry = createWorldBookEntry("[InitVar]", "{ invalid json");

      const result = initializeVariables({
        worldBooks: [[entry]],
        worldBookNames: ["test"],
      });

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 2：命令解析
  // ──────────────────────────────────────────────────────────────────────────

  describe("命令解析", () => {
    it("应解析简单的 _.set 命令", () => {
      const text = "_.set('name', 'Alice', 'Bob')";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe("set");
      expect(commands[0].path).toBe("name");
      expect(commands[0].oldValue).toBe("Alice");
      expect(commands[0].newValue).toBe("Bob");
    });

    it("应解析嵌套路径的 _.set 命令", () => {
      const text = "_.set('player.stats.hp', 100, 80)";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe("set");
      expect(commands[0].path).toBe("player.stats.hp");
      expect(commands[0].oldValue).toBe(100);
      expect(commands[0].newValue).toBe(80);
    });

    it("应解析数组索引路径的 _.set 命令", () => {
      const text = "_.set('inventory[0]', 'sword', 'axe')";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].path).toBe("inventory[0]");
    });

    it("应解析包含特殊字符的路径", () => {
      const text = "_.set('player[\"带空格的键\"].value', 10, 20)";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].path).toContain("带空格的键");
    });

    it("应解析多个 _.set 命令", () => {
      const text = `
        _.set('a', 1, 2)
        _.set('b', 3, 4)
        _.set('c', 5, 6)
      `;
      const commands = extractCommands(text);

      expect(commands).toHaveLength(3);
      expect(commands[0].path).toBe("a");
      expect(commands[1].path).toBe("b");
      expect(commands[2].path).toBe("c");
    });

    it("应解析 _.insert 命令", () => {
      const text = "_.insert('items', { name: 'potion' })";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe("insert");
      expect(commands[0].path).toBe("items");
    });

    it("应解析 _.delete 命令", () => {
      const text = "_.delete('items[0]')";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe("delete");
      expect(commands[0].path).toBe("items[0]");
    });

    it("应解析对象值的 _.set 命令", () => {
      const text = "_.set('player', {}, { name: 'Alice', hp: 100 })";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].newValue).toEqual({ name: "Alice", hp: 100 });
    });

    it("应解析数组值的 _.set 命令", () => {
      const text = "_.set('inventory', [], ['sword', 'shield'])";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].newValue).toEqual(["sword", "shield"]);
    });

    it("应忽略非命令文本", () => {
      const text = "这是普通文本，没有命令";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 3：命令执行
  // ──────────────────────────────────────────────────────────────────────────

  describe("命令执行", () => {
    let variables: MvuData;

    beforeEach(() => {
      variables = {
        stat_data: {
          player: {
            name: "Alice",
            hp: 100,
            mp: 50,
          },
          inventory: ["sword", "shield"],
        },
        display_data: {},
      };
    });

    it("应执行简单的 _.set 命令", () => {
      const command: MvuCommand = {
        name: "set",
        path: "player.name",
        oldValue: "Alice",
        newValue: "Bob",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const player = variables.stat_data.player as StatData;
      expect(player.name).toBe("Bob");
    });

    it("应执行嵌套路径的 _.set 命令", () => {
      const command: MvuCommand = {
        name: "set",
        path: "player.hp",
        oldValue: 100,
        newValue: 80,
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const player = variables.stat_data.player as StatData;
      expect(player.hp).toBe(80);
    });

    it("应执行数组元素的 _.set 命令", () => {
      const command: MvuCommand = {
        name: "set",
        path: "inventory[0]",
        oldValue: "sword",
        newValue: "axe",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const inventory = variables.stat_data.inventory as unknown[];
      expect(inventory[0]).toBe("axe");
    });

    it("应在 oldValue 不匹配时跳过更新", () => {
      const command: MvuCommand = {
        name: "set",
        path: "player.name",
        oldValue: "Charlie",
        newValue: "David",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(false);
      const player = variables.stat_data.player as StatData;
      expect(player.name).toBe("Alice"); // 未改变
    });

    it("应创建不存在的嵌套路径", () => {
      const command: MvuCommand = {
        name: "set",
        path: "player.stats.strength",
        oldValue: undefined,
        newValue: 15,
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const player = variables.stat_data.player as StatData;
      const stats = player.stats as StatData;
      expect(stats.strength).toBe(15);
    });

    it("应执行 _.insert 命令向数组添加元素", () => {
      const command: MvuCommand = {
        name: "insert",
        path: "inventory",
        newValue: "potion",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const inventory = variables.stat_data.inventory as unknown[];
      expect(inventory).toContain("potion");
      expect(inventory).toHaveLength(3);
    });

    it("应执行 _.delete 命令删除数组元素", () => {
      const command: MvuCommand = {
        name: "delete",
        path: "inventory[0]",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const inventory = variables.stat_data.inventory as unknown[];
      expect(inventory).toHaveLength(1);
      expect(inventory[0]).toBe("shield");
    });

    it("应执行 _.delete 命令删除对象属性", () => {
      const command: MvuCommand = {
        name: "delete",
        path: "player.mp",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const player = variables.stat_data.player as StatData;
      expect(player.mp).toBeUndefined();
    });

    it("应从消息文本中提取并执行多个命令", () => {
      const message = `
        角色状态更新：
        _.set('player.hp', 100, 90)
        _.set('player.mp', 50, 45)
        _.insert('inventory', 'potion')
      `;

      const result = updateVariablesFromMessage(variables, message);

      expect(result.updatedCount).toBe(3);
      const player = variables.stat_data.player as StatData;
      expect(player.hp).toBe(90);
      expect(player.mp).toBe(45);
      const inventory = variables.stat_data.inventory as unknown[];
      expect(inventory).toContain("potion");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 4：值解析
  // ──────────────────────────────────────────────────────────────────────────

  describe("值解析", () => {
    it("应解析布尔值", () => {
      expect(parseCommandValue("true")).toBe(true);
      expect(parseCommandValue("false")).toBe(false);
    });

    it("应解析 null 和 undefined", () => {
      expect(parseCommandValue("null")).toBe(null);
      expect(parseCommandValue("undefined")).toBe(undefined);
    });

    it("应解析数字", () => {
      expect(parseCommandValue("42")).toBe(42);
      expect(parseCommandValue("3.14")).toBe(3.14);
      expect(parseCommandValue("-10")).toBe(-10);
    });

    it("应解析 JSON 对象", () => {
      expect(parseCommandValue("{\"a\": 1, \"b\": 2}")).toEqual({ a: 1, b: 2 });
    });

    it("应解析 JSON 数组", () => {
      expect(parseCommandValue("[1, 2, 3]")).toEqual([1, 2, 3]);
    });

    it("应解析字符串并去除引号", () => {
      expect(parseCommandValue("\"hello\"")).toBe("hello");
      expect(parseCommandValue("'world'")).toBe("world");
    });

    it("应解析数学表达式", () => {
      expect(parseCommandValue("10 + 5")).toBe(15);
      expect(parseCommandValue("100 / 4")).toBe(25);
      expect(parseCommandValue("2 * 3")).toBe(6);
    });

    it("应解析 JavaScript 对象字面量", () => {
      const result = parseCommandValue("{ name: 'Alice', age: 25 }");
      expect(result).toEqual({ name: "Alice", age: 25 });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 5：路径处理
  // ──────────────────────────────────────────────────────────────────────────

  describe("路径处理", () => {
    it("应处理简单路径", () => {
      expect(fixPath("a.b.c")).toBe("a.b.c");
    });

    it("应处理数组索引", () => {
      expect(fixPath("a[0].b")).toBe("a[0].b");
      expect(fixPath("a[1][2]")).toBe("a[1][2]");
    });

    it("应处理带引号的键", () => {
      expect(fixPath("a[\"key\"].b")).toBe("a[key].b");
      expect(fixPath("a['key'].b")).toBe("a[key].b");
    });

    it("应保留带空格的键的引号", () => {
      expect(fixPath("a[\"key with space\"].b")).toBe("a[\"key with space\"].b");
    });

    it("应处理复杂路径", () => {
      const path = "player.inventory[0].properties.durability";
      expect(fixPath(path)).toBe(path);
    });

    it("应处理中文路径", () => {
      const path = "角色.装备.武器";
      expect(fixPath(path)).toBe(path);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 6：Schema 生成和验证
  // ──────────────────────────────────────────────────────────────────────────

  describe("Schema 生成和验证", () => {
    it("应从简单数据生成 Schema", () => {
      const data: StatData = {
        name: "Alice",
        age: 25,
        active: true,
      };

      const schema = generateSchema(data);

      expect(schema.type).toBe("object");
      expect(schema.properties.name.type).toBe("string");
      expect(schema.properties.age.type).toBe("number");
      expect(schema.properties.active.type).toBe("boolean");
    });

    it("应从嵌套对象生成 Schema", () => {
      const data: StatData = {
        player: {
          name: "Bob",
          stats: {
            hp: 100,
            mp: 50,
          },
        },
      };

      const schema = generateSchema(data);

      expect(schema.type).toBe("object");
      expect(schema.properties.player.type).toBe("object");
      const playerSchema = schema.properties.player;
      if (playerSchema.type === "object") {
        expect(playerSchema.properties.stats.type).toBe("object");
      }
    });

    it("应从数组生成 Schema", () => {
      const data: StatData = {
        inventory: ["sword", "shield", "potion"],
      };

      const schema = generateSchema(data);

      expect(schema.type).toBe("object");
      expect(schema.properties.inventory.type).toBe("array");
      const inventorySchema = schema.properties.inventory;
      if (inventorySchema.type === "array") {
        expect(inventorySchema.elementType.type).toBe("string");
      }
    });

    it("应验证值类型", () => {
      const stringValue = validateValue("hello", { type: "string" });
      expect(stringValue.valid).toBe(true);

      const numberValue = validateValue(42, { type: "number" });
      expect(numberValue.valid).toBe(true);

      const invalidValue = validateValue("not a number", { type: "number" });
      expect(invalidValue.valid).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 7：display_data vs stat_data
  // ──────────────────────────────────────────────────────────────────────────

  describe("display_data vs stat_data", () => {
    it("display_data 和 stat_data 应相互独立", () => {
      const variables: MvuData = {
        stat_data: {
          internal_value: 42,
        },
        display_data: {
          displayed_value: "42 points",
        },
      };

      expect(variables.stat_data.internal_value).toBe(42);
      expect(variables.display_data.displayed_value).toBe("42 points");
      expect(variables.stat_data.displayed_value).toBeUndefined();
      expect(variables.display_data.internal_value).toBeUndefined();
    });

    it("_.set 命令默认应更新 stat_data", () => {
      const variables: MvuData = {
        stat_data: { value: 10 },
        display_data: {},
      };

      const command: MvuCommand = {
        name: "set",
        path: "value",
        oldValue: 10,
        newValue: 20,
      };

      updateSingleVariable(variables, command);

      expect(variables.stat_data.value).toBe(20);
      expect(variables.display_data.value).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 8：边界情况
  // ──────────────────────────────────────────────────────────────────────────

  describe("边界情况", () => {
    it("应处理空的变量对象", () => {
      const variables: MvuData = {
        stat_data: {},
        display_data: {},
      };

      const command: MvuCommand = {
        name: "set",
        path: "new_value",
        oldValue: undefined,
        newValue: 42,
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      expect(variables.stat_data.new_value).toBe(42);
    });

    it("应处理深度嵌套的路径", () => {
      const variables: MvuData = {
        stat_data: {},
        display_data: {},
      };

      const command: MvuCommand = {
        name: "set",
        path: "a.b.c.d.e",
        oldValue: undefined,
        newValue: "deep",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const a = variables.stat_data.a as StatData;
      const b = a.b as StatData;
      const c = b.c as StatData;
      const d = c.d as StatData;
      expect(d.e).toBe("deep");
    });

    it("应处理格式错误的命令", () => {
      const text = "_.set('incomplete'";
      const commands = extractCommands(text);

      expect(commands).toHaveLength(0);
    });

    it("应处理空数组的 _.insert", () => {
      const variables: MvuData = {
        stat_data: { items: [] },
        display_data: {},
      };

      const command: MvuCommand = {
        name: "insert",
        path: "items",
        newValue: "first_item",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const items = variables.stat_data.items as unknown[];
      expect(items).toHaveLength(1);
      expect(items[0]).toBe("first_item");
    });

    it("应处理不存在路径的 _.delete", () => {
      const variables: MvuData = {
        stat_data: {},
        display_data: {},
      };

      const command: MvuCommand = {
        name: "delete",
        path: "nonexistent",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 9：SillyTavern 行为对齐
  // ──────────────────────────────────────────────────────────────────────────

  describe("SillyTavern 行为对齐", () => {
    it("oldValue 匹配应使用严格相等", () => {
      const variables: MvuData = {
        stat_data: { value: "10" },
        display_data: {},
      };

      const command: MvuCommand = {
        name: "set",
        path: "value",
        oldValue: 10, // 数字 10
        newValue: 20,
      };

      const result = updateSingleVariable(variables, command);

      // 字符串 "10" !== 数字 10，应该失败
      expect(result.success).toBe(false);
      expect(variables.stat_data.value).toBe("10");
    });

    it("应支持不提供 oldValue 的 _.set", () => {
      const variables: MvuData = {
        stat_data: { value: 10 },
        display_data: {},
      };

      const command: MvuCommand = {
        name: "set",
        path: "value",
        newValue: 20,
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      expect(variables.stat_data.value).toBe(20);
    });

    it("应按文本顺序执行多个命令", () => {
      const variables: MvuData = {
        stat_data: { counter: 0 },
        display_data: {},
      };

      const message = `
        _.set('counter', 0, 1)
        _.set('counter', 1, 2)
        _.set('counter', 2, 3)
      `;

      const result = updateVariablesFromMessage(variables, message);

      expect(result.updatedCount).toBe(3);
      expect(variables.stat_data.counter).toBe(3);
    });

    it("命令中的换行和空格应被正确处理", () => {
      const text = `
        _.set(
          'player.name',
          'Alice',
          'Bob'
        )
      `;

      const commands = extractCommands(text);

      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe("set");
      expect(commands[0].path).toBe("player.name");
    });

    it("应保留数组中的 null 值", () => {
      const variables: MvuData = {
        stat_data: { items: [null, "item", null] },
        display_data: {},
      };

      const command: MvuCommand = {
        name: "set",
        path: "items[1]",
        oldValue: "item",
        newValue: "new_item",
      };

      const result = updateSingleVariable(variables, command);

      expect(result.success).toBe(true);
      const items = variables.stat_data.items as unknown[];
      expect(items[0]).toBe(null);
      expect(items[1]).toBe("new_item");
      expect(items[2]).toBe(null);
    });
  });
});
