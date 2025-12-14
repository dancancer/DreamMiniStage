/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Import Adapter Property Tests                                ║
 * ║                                                                           ║
 * ║  **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测** ║
 * ║  **Validates: Requirements 2.1, 2.3, 2.4**                               ║
 * ║                                                                           ║
 * ║  验证导入管道的核心不变量：                                                  ║
 * ║  *For any* input data matching a registered adapter's format,             ║
 * ║  the import pipeline SHALL correctly detect and select the                ║
 * ║  appropriate adapter.                                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  createImportPipeline,
  ImportAdapter,
  NoAdapterMatchError,
  ImportError,
} from "../import/types";

/* ═══════════════════════════════════════════════════════════════════════════
   测试用适配器定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface TestItem {
  id: string;
  value: number;
}

/** 数组格式适配器 */
const arrayAdapter: ImportAdapter<TestItem[], TestItem[]> = {
  name: "array",
  canHandle: (input): input is TestItem[] =>
    Array.isArray(input) &&
    input.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "value" in item,
    ),
  normalize: (input) => input.map((item) => ({ ...item })),
};

/** 对象包装格式适配器 { items: [] } */
const objectWrapperAdapter: ImportAdapter<{ items: TestItem[] }, TestItem[]> = {
  name: "object-wrapper",
  canHandle: (input): input is { items: TestItem[] } =>
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    "items" in input &&
    Array.isArray((input as { items: unknown }).items),
  normalize: (input) => input.items.map((item) => ({ ...item })),
};

/** 单对象格式适配器 */
const singleObjectAdapter: ImportAdapter<TestItem, TestItem[]> = {
  name: "single-object",
  canHandle: (input): input is TestItem =>
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    "id" in input &&
    "value" in input &&
    !("items" in input),
  normalize: (input) => [{ ...input }],
};

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成有效的 TestItem
 */
const testItemArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  value: fc.integer(),
});

/**
 * 生成数组格式输入
 */
const arrayInputArb = fc.array(testItemArb, { minLength: 1, maxLength: 10 });

/**
 * 生成对象包装格式输入
 */
const objectWrapperInputArb = fc.record({
  items: fc.array(testItemArb, { minLength: 1, maxLength: 10 }),
});

/**
 * 生成单对象格式输入
 */
const singleObjectInputArb = testItemArb;

/**
 * 生成任意有效格式输入（带格式标签）
 */
const validInputArb = fc.oneof(
  arrayInputArb.map((input) => ({ format: "array" as const, input })),
  objectWrapperInputArb.map((input) => ({
    format: "object-wrapper" as const,
    input,
  })),
  singleObjectInputArb.map((input) => ({
    format: "single-object" as const,
    input,
  })),
);

/**
 * 生成无效输入（不匹配任何适配器）
 */
const invalidInputArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.record({
    wrongField: fc.string(),
  }),
);

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 1: 导入适配器格式检测", () => {
  /**
   * **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测**
   * **Validates: Requirements 2.1**
   *
   * 导入管道应该能正确识别并处理所有已注册的格式
   */
  it("*For any* valid input matching a registered adapter, the pipeline SHALL correctly process it", () => {
    const pipeline = createImportPipeline<TestItem[]>(
      [arrayAdapter, objectWrapperAdapter, singleObjectAdapter],
      "test",
    );

    fc.assert(
      fc.property(validInputArb, ({ format, input }) => {
        const result = pipeline.process(input);

        // 结果应该是数组
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);

        // 每个元素应该有 id 和 value 字段
        for (const item of result) {
          expect(typeof item.id).toBe("string");
          expect(typeof item.value).toBe("number");
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测**
   * **Validates: Requirements 2.3**
   *
   * 当多个适配器可以处理同一输入时，应该使用第一个匹配的适配器
   */
  it("*For any* input matching multiple adapters, the pipeline SHALL use the first matching adapter", () => {
    // 创建两个都能处理数组的适配器
    const firstArrayAdapter: ImportAdapter<TestItem[], TestItem[]> = {
      name: "first-array",
      canHandle: (input): input is TestItem[] => Array.isArray(input),
      normalize: (input) =>
        input.map((item) => ({ ...item, source: "first" as unknown })),
    };

    const secondArrayAdapter: ImportAdapter<TestItem[], TestItem[]> = {
      name: "second-array",
      canHandle: (input): input is TestItem[] => Array.isArray(input),
      normalize: (input) =>
        input.map((item) => ({ ...item, source: "second" as unknown })),
    };

    const pipeline = createImportPipeline<TestItem[]>(
      [firstArrayAdapter, secondArrayAdapter],
      "test",
    );

    fc.assert(
      fc.property(arrayInputArb, (input) => {
        const result = pipeline.process(input);

        // 应该使用第一个适配器
        for (const item of result) {
          expect((item as unknown).source).toBe("first");
        }
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测**
   * **Validates: Requirements 2.4**
   *
   * 当没有适配器匹配时，应该抛出描述性错误
   */
  it("*For any* input not matching any adapter, the pipeline SHALL throw NoAdapterMatchError", () => {
    const pipeline = createImportPipeline<TestItem[]>(
      [arrayAdapter, objectWrapperAdapter, singleObjectAdapter],
      "test",
    );

    fc.assert(
      fc.property(invalidInputArb, (input) => {
        expect(() => pipeline.process(input)).toThrow(NoAdapterMatchError);

        try {
          pipeline.process(input);
        } catch (error) {
          if (error instanceof NoAdapterMatchError) {
            // 错误应该包含可用适配器列表
            expect(error.availableAdapters).toContain("array");
            expect(error.availableAdapters).toContain("object-wrapper");
            expect(error.availableAdapters).toContain("single-object");
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测**
   * **Validates: Requirements 2.1**
   *
   * 数组格式输入应该被正确处理
   */
  it("*For any* array input, the pipeline SHALL normalize it to array format", () => {
    const pipeline = createImportPipeline<TestItem[]>([arrayAdapter], "test");

    fc.assert(
      fc.property(arrayInputArb, (input) => {
        const result = pipeline.process(input);

        // 结果数量应该与输入相同
        expect(result.length).toBe(input.length);

        // 内容应该一致
        for (let i = 0; i < input.length; i++) {
          expect(result[i].id).toBe(input[i].id);
          expect(result[i].value).toBe(input[i].value);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测**
   * **Validates: Requirements 2.1**
   *
   * 对象包装格式输入应该被正确处理
   */
  it("*For any* object-wrapper input, the pipeline SHALL normalize it to array format", () => {
    const pipeline = createImportPipeline<TestItem[]>(
      [objectWrapperAdapter],
      "test",
    );

    fc.assert(
      fc.property(objectWrapperInputArb, (input) => {
        const result = pipeline.process(input);

        // 结果数量应该与 items 相同
        expect(result.length).toBe(input.items.length);

        // 内容应该一致
        for (let i = 0; i < input.items.length; i++) {
          expect(result[i].id).toBe(input.items[i].id);
          expect(result[i].value).toBe(input.items[i].value);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测**
   * **Validates: Requirements 2.1**
   *
   * 单对象格式输入应该被正确处理
   */
  it("*For any* single-object input, the pipeline SHALL normalize it to array with one element", () => {
    const pipeline = createImportPipeline<TestItem[]>(
      [singleObjectAdapter],
      "test",
    );

    fc.assert(
      fc.property(singleObjectInputArb, (input) => {
        const result = pipeline.process(input);

        // 结果应该是只有一个元素的数组
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(input.id);
        expect(result[0].value).toBe(input.value);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测**
   * **Validates: Requirements 2.5**
   *
   * 动态注册适配器应该立即生效
   */
  it("*For any* newly registered adapter, the pipeline SHALL recognize its format immediately", () => {
    const pipeline = createImportPipeline<TestItem[]>([], "test");

    // 初始时没有适配器，应该抛出错误
    fc.assert(
      fc.property(arrayInputArb, (input) => {
        expect(() => pipeline.process(input)).toThrow(NoAdapterMatchError);
      }),
      { numRuns: 10 },
    );

    // 注册适配器
    pipeline.register(arrayAdapter);

    // 注册后应该能正常处理
    fc.assert(
      fc.property(arrayInputArb, (input) => {
        const result = pipeline.process(input);
        expect(result.length).toBe(input.length);
      }),
      { numRuns: 10 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 1: 导入适配器格式检测**
   * **Validates: Requirements 2.1**
   *
   * getAdapterNames 应该返回所有已注册的适配器名称
   */
  it("*For any* pipeline with registered adapters, getAdapterNames SHALL return all adapter names", () => {
    const pipeline = createImportPipeline<TestItem[]>(
      [arrayAdapter, objectWrapperAdapter, singleObjectAdapter],
      "test",
    );

    const names = pipeline.getAdapterNames();

    expect(names).toContain("array");
    expect(names).toContain("object-wrapper");
    expect(names).toContain("single-object");
    expect(names.length).toBe(3);
  });
});

describe("Property: 适配器错误处理", () => {
  /**
   * 当适配器的 normalize 函数抛出错误时，应该包装为 ImportError
   */
  it("*For any* adapter that throws during normalization, the pipeline SHALL wrap it as ImportError", () => {
    const errorAdapter: ImportAdapter<TestItem[], TestItem[]> = {
      name: "error-adapter",
      canHandle: (input): input is TestItem[] => Array.isArray(input),
      normalize: () => {
        throw new Error("Normalization failed");
      },
    };

    const pipeline = createImportPipeline<TestItem[]>([errorAdapter], "test");

    fc.assert(
      fc.property(arrayInputArb, (input) => {
        expect(() => pipeline.process(input)).toThrow(ImportError);

        try {
          pipeline.process(input);
        } catch (error) {
          if (error instanceof ImportError) {
            expect(error.inputType).toBe("test");
            expect(error.message).toContain("error-adapter");
            expect(error.cause).toBeInstanceOf(Error);
          }
        }
      }),
      { numRuns: 10 },
    );
  });
});
