export abstract class NodeTool {
  protected static readonly toolType: string = "base";
  protected static readonly version: string = "1.0.0";

  static getToolType(): string {
    return this.toolType;
  }

  static getVersion(): string {
    return this.version;
  }

  protected static logExecution(methodName: string, params?: unknown): void {
    console.log(`[${this.getToolType()}Tool] Executing ${methodName}`, params);
  }

  protected static handleError(error: Error, methodName: string): never {
    const enhancedError = new Error(`[${this.getToolType()}Tool.${methodName}] ${error.message}`);
    enhancedError.stack = error.stack;
    throw enhancedError;
  }

  static getAvailableMethods(): string[] {
    const methods = Object.getOwnPropertyNames(NodeTool)
      .filter(name => typeof NodeTool[name as keyof typeof NodeTool] === "function")
      .filter(name => !name.startsWith("_") && !["constructor", "prototype"].includes(name))
      .filter(name => !["getToolType", "getVersion", "logExecution", "handleError", "getMetadata", "getAvailableMethods"].includes(name));
    
    return methods;
  }

  static async executeMethod(methodName: string, ...params: unknown[]): Promise<unknown> {
    const method = (this as unknown as Record<string, unknown>)[methodName];
    
    if (typeof method !== "function") {
      console.error(`方法查找失败: ${methodName} 在 ${this.getToolType()}Tool 中不存在`);
      throw new Error(`Method ${methodName} not found in ${this.getToolType()}Tool`);
    }

    try {
      this.logExecution(methodName, params);
      return await (method as (...args: unknown[]) => Promise<unknown>).apply(this, params);
    } catch (error) {
      this.handleError(error as Error, methodName);
    }
  }
}

export interface ToolMetadata {
  type: string;
  version: string;
  methods: string[];
}

export interface ToolMethodDescriptor {
  name: string;
  description: string;
  parameters: ToolParameterDescriptor[];
  returnType: string;
}

export interface ToolParameterDescriptor {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

export function ToolMethod(description: string, parameters: ToolParameterDescriptor[] = []) {
  return function(target: unknown, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    let methodName: string;
    
    if (typeof propertyKey === "string") {
      methodName = propertyKey;
    } else if (typeof propertyKey === "symbol") {
      methodName = propertyKey.toString();
    } else {
      methodName = "unknownMethod";
      console.warn("ToolMethod: Unable to determine method name");
    }
    const constructor = (target as { constructor?: unknown })?.constructor || target;
    const constructorWithMethods = constructor as { _toolMethods?: Map<string, ToolMethodDescriptor> };
    if (!constructorWithMethods._toolMethods) {
      constructorWithMethods._toolMethods = new Map();
    }
    constructorWithMethods._toolMethods.set(methodName, {
      name: methodName,
      description,
      parameters,
      returnType: "any",
    });
    return descriptor ? descriptor.value : target;
  };
}

export class NodeToolRegistry {
  private static tools: Map<string, typeof NodeTool> = new Map();

  static register(toolClass: typeof NodeTool): void {
    this.tools.set(toolClass.getToolType(), toolClass);
  }

  static get(toolType: string): typeof NodeTool | undefined {
    return this.tools.get(toolType);
  }

  static isRegistered(toolClass: typeof NodeTool): boolean {
    return this.tools.has(toolClass.getToolType());
  }

  static getRegisteredTypes(): string[] {
    return Array.from(this.tools.keys());
  }
}
