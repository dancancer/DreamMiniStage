/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     MVU 执行选项语义测试                                   ║
 * ║                                                                           ║
 * ║  覆盖 strictSet / strictTemplate / concatTemplateArray 的执行行为          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, expect, it } from "vitest";
import { updateVariablesFromMessage } from "../core/executor";
import type { MvuData } from "../types";

type SchemaWithExecutionSwitches = NonNullable<MvuData["schema"]> & {
  strictSet?: boolean;
  strictTemplate?: boolean;
  concatTemplateArray?: boolean;
};

describe("mvu executor option semantics", () => {
  it("strictSet=false 时仅更新 ValueWithDescription 的值", () => {
    const variables: MvuData = {
      stat_data: {
        health: [100, "生命值"],
      },
      display_data: {},
      delta_data: {},
      schema: {
        type: "object",
        strictSet: false,
        properties: {
          health: { type: "array", elementType: { type: "any" } },
        },
      } as SchemaWithExecutionSwitches,
    };

    const result = updateVariablesFromMessage(variables, "_.set('health', 80);//受伤");
    expect(result.results[0]).toMatchObject({
      success: true,
      oldValue: 100,
      newValue: 80,
    });
    expect(variables.stat_data.health).toEqual([80, "生命值"]);
  });

  it("strictSet=true 时替换整个 ValueWithDescription 结构", () => {
    const variables: MvuData = {
      stat_data: {
        health: [100, "生命值"],
      },
      display_data: {},
      delta_data: {},
      schema: {
        type: "object",
        strictSet: true,
        properties: {
          health: { type: "array", elementType: { type: "any" } },
        },
      } as SchemaWithExecutionSwitches,
    };

    const result = updateVariablesFromMessage(variables, "_.set('health', [120, '增强生命值']);");
    expect(result.results[0]).toMatchObject({
      success: true,
      oldValue: [100, "生命值"],
      newValue: [120, "增强生命值"],
    });
    expect(variables.stat_data.health).toEqual([120, "增强生命值"]);
  });

  it("strictTemplate=true + concatTemplateArray=true 阻止 primitive->array 转换并保留拼接行为", () => {
    const variables: MvuData = {
      stat_data: { items: [] },
      display_data: {},
      delta_data: {},
      schema: {
        type: "object",
        strictTemplate: true,
        concatTemplateArray: true,
        properties: {
          items: {
            type: "array",
            extensible: true,
            elementType: { type: "any" },
            template: ["default1", "default2"],
          },
        },
      } as SchemaWithExecutionSwitches,
    };

    updateVariablesFromMessage(variables, "_.insert('items', 'primitive-value');");
    updateVariablesFromMessage(variables, "_.insert('items', ['user1', 'user2']);");

    expect(variables.stat_data.items).toEqual([
      "primitive-value",
      ["user1", "user2", "default1", "default2"],
    ]);
  });

  it("strictTemplate=false + concatTemplateArray=false 使用按位合并", () => {
    const variables: MvuData = {
      stat_data: { items: [] },
      display_data: {},
      delta_data: {},
      schema: {
        type: "object",
        strictTemplate: false,
        concatTemplateArray: false,
        properties: {
          items: {
            type: "array",
            extensible: true,
            elementType: { type: "any" },
            template: ["default1", "default2", "default3"],
          },
        },
      } as SchemaWithExecutionSwitches,
    };

    updateVariablesFromMessage(variables, "_.insert('items', 'primitive-value');");
    expect(variables.stat_data.items).toEqual([["primitive-value", "default2", "default3"]]);
  });

  it("模板配置不应绕过 schema 拒绝写入规则", () => {
    const variables: MvuData = {
      stat_data: {
        profile: {
          name: "alice",
        },
      },
      display_data: {},
      delta_data: {},
      schema: {
        type: "object",
        strictTemplate: true,
        concatTemplateArray: true,
        properties: {
          profile: {
            type: "object",
            extensible: false,
            properties: {
              name: { type: "string", required: true },
            },
          },
        },
      } as SchemaWithExecutionSwitches,
    };

    const result = updateVariablesFromMessage(
      variables,
      "_.insert('profile', 'title', 'maintainer');",
    );

    expect(result.results[0].success).toBe(false);
    expect(variables.stat_data.profile).toEqual({ name: "alice" });
  });
});
