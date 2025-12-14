/* ═══════════════════════════════════════════════════════════════════════════
   导入适配器接口定义

   设计理念：
   - 边界转换：在系统边界完成格式转换，核心逻辑只处理规范格式
   - 适配器模式：用适配器隔离外部格式差异，核心代码保持纯净
   - 单一事实源：每种数据只有一个权威表示
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────────────
   错误类型定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 导入错误
 * 当导入过程中发生可恢复错误时抛出
 */
export class ImportError extends Error {
  constructor(
    message: string,
    public readonly inputType: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

/**
 * 适配器未匹配错误
 * 当没有适配器能处理输入数据时抛出
 */
export class NoAdapterMatchError extends Error {
  constructor(
    message: string,
    public readonly inputType: string,
    public readonly availableAdapters: string[],
  ) {
    super(message);
    this.name = "NoAdapterMatchError";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   适配器接口定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 导入适配器接口
 *
 * 职责：
 * - 检测输入是否匹配特定格式
 * - 将匹配的输入转换为规范格式
 *
 * 设计原则：
 * - 每个适配器只处理一种输入格式
 * - canHandle 必须是纯函数，无副作用
 * - normalize 保证输出格式的一致性
 *
 * @template TInput - 输入数据类型
 * @template TOutput - 输出数据类型（规范格式）
 */
export interface ImportAdapter<TInput, TOutput> {
  /** 检测输入是否匹配此适配器 */
  canHandle(input: unknown): input is TInput;

  /** 将输入转换为规范格式 */
  normalize(input: TInput): TOutput;

  /** 适配器名称，用于日志和错误信息 */
  readonly name: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   管道接口定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 导入管道接口
 *
 * 职责：
 * - 管理多个适配器的注册
 * - 自动选择匹配的适配器处理输入
 * - 提供统一的错误处理
 *
 * @template TOutput - 输出数据类型（规范格式）
 */
export interface ImportPipeline<TOutput> {
  /** 注册新适配器 */
  register(adapter: ImportAdapter<unknown, TOutput>): void;

  /** 处理输入，自动选择适配器 */
  process(input: unknown): TOutput;

  /** 获取所有已注册的适配器名称 */
  getAdapterNames(): string[];
}

/* ─────────────────────────────────────────────────────────────────────────────
   管道实现
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 导入管道实现类
 *
 * 设计要点：
 * - 适配器按注册顺序检测，第一个匹配的被使用
 * - 无匹配时抛出 NoAdapterMatchError
 * - 转换失败时抛出 ImportError
 */
class ImportPipelineImpl<TOutput> implements ImportPipeline<TOutput> {
  private adapters: ImportAdapter<unknown, TOutput>[] = [];
  private pipelineName: string;

  constructor(
    adapters: ImportAdapter<unknown, TOutput>[] = [],
    name = "import",
  ) {
    this.adapters = [...adapters];
    this.pipelineName = name;
  }

  register(adapter: ImportAdapter<unknown, TOutput>): void {
    this.adapters.push(adapter);
  }

  process(input: unknown): TOutput {
    // 查找第一个匹配的适配器
    for (const adapter of this.adapters) {
      if (adapter.canHandle(input)) {
        try {
          return adapter.normalize(input);
        } catch (error) {
          throw new ImportError(
            `适配器 "${adapter.name}" 转换失败: ${error instanceof Error ? error.message : String(error)}`,
            this.pipelineName,
            error,
          );
        }
      }
    }

    // 无匹配适配器
    throw new NoAdapterMatchError(
      "没有适配器能处理此输入格式",
      this.pipelineName,
      this.adapters.map((a) => a.name),
    );
  }

  getAdapterNames(): string[] {
    return this.adapters.map((a) => a.name);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   工厂函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 创建导入管道
 *
 * @param adapters - 初始适配器列表
 * @param name - 管道名称，用于错误信息
 * @returns 新的导入管道实例
 *
 * @example
 * const pipeline = createImportPipeline<RegexScript[]>([
 *   arrayAdapter,
 *   objectAdapter,
 * ], "regex-scripts");
 */
export function createImportPipeline<TOutput>(
  adapters: ImportAdapter<unknown, TOutput>[] = [],
  name = "import",
): ImportPipeline<TOutput> {
  return new ImportPipelineImpl(adapters, name);
}

/* ─────────────────────────────────────────────────────────────────────────────
   类型守卫辅助函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 检查值是否为非空对象
 */
export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 检查对象是否包含指定属性且属性值为数组
 */
export function hasArrayProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown[]> {
  return isNonNullObject(obj) && key in obj && Array.isArray((obj as Record<K, unknown>)[key]);
}
