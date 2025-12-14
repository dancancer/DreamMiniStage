/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Property 8: MVU 值对象格式统一                      ║
 * ║                                                                           ║
 * ║  **Feature: compatibility-debt-remediation, Property 8**                  ║
 * ║  **Validates: Requirements 11.1, 11.3**                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isValueWithDescription,
  safeGetValue,
  updateSingleVariable,
  type MvuData,
  type ValueWithDescription,
} from "@/lib/mvu";

/** 生成 ValueWithDescription 对象 */
const valueWithDescriptionArb = fc.record({
  value: fc.jsonValue(),
  description: fc.string(),
});

describe("Property 8: MVU 值对象格式统一", () => {
  it("*For any* ValueWithDescription update, executor SHALL keep object format and preserve description", () => {
    fc.assert(
      fc.property(valueWithDescriptionArb, fc.jsonValue(), (initial, nextValue) => {
        const variables: MvuData = {
          stat_data: { hp: { ...initial } },
          display_data: {},
          delta_data: {},
          initialized_lorebooks: {},
        };

        const result = updateSingleVariable(variables, "hp", nextValue);
        expect(result.success).toBe(true);

        const stored = variables.stat_data.hp as ValueWithDescription<unknown>;
        expect(isValueWithDescription(stored)).toBe(true);
        expect(stored.value).toEqual(nextValue);
        expect(stored.description).toBe(initial.description);
        expect(safeGetValue(stored)).toEqual(nextValue);
      }),
    );
  });
});
