export enum NodeCategory {
  ENTRY = "entry",
  MIDDLE = "middle", 
  EXIT = "exit",
  AFTER = "after" // Background execution after main workflow completes
}

export interface NodeConfig {
  id: string;
  name: string;
  category: NodeCategory;
  next?: string[];
  initParams?: string[];
  inputFields?: string[];
  optionalInputFields?: string[];
  outputFields?: string[];
  inputMapping?: Record<string, string>;
}

export type NodeValue = unknown;

export type NodeInput = Record<string, NodeValue>;
export type NodeOutput = Record<string, NodeValue>;

export enum NodeExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped"
}

export interface NodeExecutionResult {
  nodeId: string;
  status: NodeExecutionStatus;
  input: NodeInput;
  output?: NodeOutput;
  error?: Error;
  startTime: Date;
  endTime?: Date;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  nodes: NodeConfig[];
}

export interface WorkflowExecutionResult {
  workflowId: string;
  status: NodeExecutionStatus;
  results: NodeExecutionResult[];
  outputData?: Record<string, unknown>;
  startTime: Date;
  endTime?: Date;
}

export interface NodeRegistryEntry {
  nodeClass: new (config: NodeConfig) => unknown;
}

export type NodeRegistry = Record<string, NodeRegistryEntry>;
