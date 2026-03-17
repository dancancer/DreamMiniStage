import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeContext } from "@/lib/nodeflow/NodeContext";
import { 
  NodeInput, 
  NodeOutput,
  NodeRegistry,
  WorkflowConfig,
  NodeExecutionStatus,
  WorkflowExecutionResult,
  NodeCategory,
  NodeValue,
} from "@/lib/nodeflow/types";

export interface WorkflowExecutionOptions {
  executeAfterNodes?: boolean; // Whether to execute AFTER nodes (default: true)
  awaitAfterNodes?: boolean; // Whether to wait for AFTER nodes completion (default: false)
}

export { NodeCategory } from "@/lib/nodeflow/types";

export class WorkflowEngine {
  private config: WorkflowConfig;
  private registry: NodeRegistry;
  private nodes: Map<string, NodeBase>;

  constructor(
    config: WorkflowConfig,
    registry: NodeRegistry,
    context: NodeContext,
  ) {
    this.config = config;
    this.registry = registry;
    this.nodes = new Map();
    this.initializeNodes(context);
  }

  private initializeNodes(_context: NodeContext): void {
    for (const nodeConfig of this.config.nodes) {
      const registryEntry = this.registry[nodeConfig.name];
      const NodeClass = registryEntry.nodeClass;
      const node = new NodeClass(nodeConfig) as NodeBase;
      this.nodes.set(nodeConfig.id, node);
    }
  }

  private getEntryNodes(): NodeBase[] {
    const entryNodesByCategory = Array.from(this.nodes.values())
      .filter(node => node.isEntryNode());
    
    if (entryNodesByCategory.length > 0) {
      return entryNodesByCategory;
    }

    const targetNodes = new Set<string>();
    this.config.nodes.forEach(node => {
      if (node.next) {
        node.next.forEach(nextId => targetNodes.add(nextId));
      }
    });

    return this.config.nodes
      .filter(node => !targetNodes.has(node.id))
      .map(node => this.nodes.get(node.id)!)
      .filter(Boolean);
  }

  private getNodesByCategory(category: NodeCategory): NodeBase[] {
    return this.config.nodes
      .filter(nodeConfig => nodeConfig.category === category)
      .map(nodeConfig => this.nodes.get(nodeConfig.id)!)
      .filter(Boolean);
  }

  private getNextNodes(nodeId: string): NodeBase[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.getNext()
      .map(id => this.nodes.get(id))
      .filter(Boolean) as NodeBase[];
  }

  private async executeNode(
    node: NodeBase,
    context: NodeContext,
  ): Promise<NodeOutput> {
    const result = await node.execute(context);
    if (result.status === NodeExecutionStatus.FAILED) {
      throw result.error || new Error(`Node ${node.getId()} execution failed`);
    }
    return result.output!;
  }

  private async executeParallel(
    nodes: NodeBase[],
    context: NodeContext,
  ): Promise<NodeOutput[]> {
    return Promise.all(
      nodes.map(node => this.executeNode(node, context)),
    );
  }

  private enqueueNextNodes(
    sourceNodes: NodeBase[],
    processedNodes: Set<string>,
    skipAfterNodes: boolean = true,
  ): NodeBase[] {
    const nextLevelNodesSet = new Set<NodeBase>();

    sourceNodes.forEach((node) => {
      this.getNextNodes(node.getId()).forEach((nextNode) => {
        const nodeConfig = this.config.nodes.find((item) => item.id === nextNode.getId());
        if (skipAfterNodes && nodeConfig?.category === NodeCategory.AFTER) {
          return;
        }
        if (!processedNodes.has(nextNode.getId())) {
          nextLevelNodesSet.add(nextNode);
        }
      });
    });

    return Array.from(nextLevelNodesSet);
  }

  /**
   * Execute main workflow until EXIT nodes, then optionally execute AFTER nodes in background
   */
  async execute(
    initialWorkflowInput: NodeInput,
    context?: NodeContext,
    options: WorkflowExecutionOptions = {},
  ): Promise<WorkflowExecutionResult> {
    const { executeAfterNodes = true, awaitAfterNodes = false } = options;
    const ctx = context || new NodeContext();
    const startTime = new Date();
    const result: WorkflowExecutionResult = {
      workflowId: this.config.id,
      status: NodeExecutionStatus.RUNNING,
      results: [],
      startTime,
    };

    try {
      // Set initial input
      for (const key in initialWorkflowInput) {
        ctx.setInput(key, initialWorkflowInput[key] as NodeValue);
      }

      // Execute main workflow (ENTRY -> MIDDLE -> EXIT)
      const mainWorkflowResult = await this.executeMainWorkflow(ctx);
      
      // Set main workflow results
      result.outputData = mainWorkflowResult.outputData;
      result.status = mainWorkflowResult.status;

      // Handle AFTER nodes
      if (executeAfterNodes) {
        const afterNodesPromise = this.executeAfterNodes(ctx);
        
        if (awaitAfterNodes) {
          // Wait for AFTER nodes to complete before returning
          await afterNodesPromise;
        } else {
          // Execute AFTER nodes in background (fire and forget)
          afterNodesPromise.catch(error => {
            console.error("AFTER nodes execution failed:", error);
          });
        }
      }

    } catch (error) {
      console.error(error);
      result.status = NodeExecutionStatus.FAILED;
    } finally {
      result.endTime = new Date();
    }

    return result;
  }

  async executeUntil(
    targetNodeId: string,
    initialWorkflowInput: NodeInput,
    context?: NodeContext,
  ): Promise<{
    context: NodeContext;
    targetNode: NodeBase;
    targetInput: NodeInput;
  }> {
    const ctx = context || new NodeContext();

    for (const key in initialWorkflowInput) {
      ctx.setInput(key, initialWorkflowInput[key] as NodeValue);
    }

    const entryNodes = this.getEntryNodes();
    if (entryNodes.length === 0) {
      throw new Error("No entry nodes found in workflow");
    }

    const directEntryTarget = entryNodes.find((node) => node.getId() === targetNodeId);
    if (directEntryTarget) {
      return {
        context: ctx,
        targetNode: directEntryTarget,
        targetInput: await directEntryTarget.previewInput(ctx),
      };
    }

    await this.executeParallel(entryNodes, ctx);

    const processedNodes = new Set<string>();
    entryNodes.forEach((node) => processedNodes.add(node.getId()));

    const queue: Array<{ nodes: NodeBase[] }> = [];
    const initialNextNodes = this.enqueueNextNodes(entryNodes, processedNodes);
    if (initialNextNodes.length > 0) {
      queue.push({ nodes: initialNextNodes });
    }

    while (queue.length > 0) {
      const currentBatch = queue.shift()!;
      const nodesToExecuteInBatch = currentBatch.nodes.filter((node) => !processedNodes.has(node.getId()));
      if (nodesToExecuteInBatch.length === 0) continue;

      const targetNode = nodesToExecuteInBatch.find((node) => node.getId() === targetNodeId);
      if (targetNode) {
        return {
          context: ctx,
          targetNode,
          targetInput: await targetNode.previewInput(ctx),
        };
      }

      await this.executeParallel(nodesToExecuteInBatch, ctx);
      nodesToExecuteInBatch.forEach((node) => processedNodes.add(node.getId()));

      const nextNodes = this.enqueueNextNodes(nodesToExecuteInBatch, processedNodes);
      if (nextNodes.length > 0) {
        queue.push({ nodes: nextNodes });
      }
    }

    throw new Error(`Target node not found in executable path: ${targetNodeId}`);
  }

  async executeFrom(
    startNodeId: string,
    context?: NodeContext,
  ): Promise<{
    status: NodeExecutionStatus;
    outputData: Record<string, unknown>;
  }> {
    const ctx = context || new NodeContext();
    const startNode = this.nodes.get(startNodeId);
    if (!startNode) {
      throw new Error(`Start node not found: ${startNodeId}`);
    }

    const processedNodes = new Set<string>();
    const queue: Array<{ nodes: NodeBase[] }> = [{ nodes: [startNode] }];

    while (queue.length > 0) {
      const currentBatch = queue.shift()!;
      const nodesToExecuteInBatch = currentBatch.nodes.filter((node) => !processedNodes.has(node.getId()));
      if (nodesToExecuteInBatch.length === 0) continue;

      await this.executeParallel(nodesToExecuteInBatch, ctx);
      nodesToExecuteInBatch.forEach((node) => processedNodes.add(node.getId()));

      const hasExitNodes = nodesToExecuteInBatch.some((node) => {
        const nodeConfig = this.config.nodes.find((item) => item.id === node.getId());
        return nodeConfig?.category === NodeCategory.EXIT;
      });
      if (hasExitNodes) {
        break;
      }

      const nextNodes = this.enqueueNextNodes(nodesToExecuteInBatch, processedNodes);
      if (nextNodes.length > 0) {
        queue.push({ nodes: nextNodes });
      }
    }

    return {
      status: NodeExecutionStatus.COMPLETED,
      outputData: ctx.toJSON().outputStore as Record<string, unknown>,
    };
  }

  /**
   * Execute main workflow from ENTRY to EXIT nodes
   */
  private async executeMainWorkflow(context: NodeContext): Promise<{
    status: NodeExecutionStatus;
    outputData: Record<string, unknown>;
  }> {
    const entryNodes = this.getEntryNodes();
    if (entryNodes.length === 0) {
      throw new Error("No entry nodes found in workflow");
    }
    
    await this.executeParallel(entryNodes, context);

    const processedNodes = new Set<string>();
    entryNodes.forEach(node => processedNodes.add(node.getId()));

    const queue: Array<{ nodes: NodeBase[] }> = [];
    const initialNextNodes = this.enqueueNextNodes(entryNodes, processedNodes);
    if (initialNextNodes.length > 0) {
      queue.push({ nodes: initialNextNodes });
    }

    // Process nodes level by level until EXIT nodes
    while (queue.length > 0) {
      const currentBatch = queue.shift()!;
      const nodesToExecuteInBatch = currentBatch.nodes.filter(node => !processedNodes.has(node.getId()));
      
      if (nodesToExecuteInBatch.length === 0) continue;

      await this.executeParallel(nodesToExecuteInBatch, context);

      nodesToExecuteInBatch.forEach(node => processedNodes.add(node.getId()));

      // Check if we have reached EXIT nodes
      const hasExitNodes = nodesToExecuteInBatch.some(node => {
        const nodeConfig = this.config.nodes.find(n => n.id === node.getId());
        return nodeConfig?.category === NodeCategory.EXIT;
      });

      // If we reached EXIT nodes, stop main workflow execution
      if (hasExitNodes) {
        break;
      }

      // Add next level nodes (excluding AFTER nodes)
      const nextNodes = this.enqueueNextNodes(nodesToExecuteInBatch, processedNodes);
      if (nextNodes.length > 0) {
        queue.push({ nodes: nextNodes });
      }
    }

    return {
      status: NodeExecutionStatus.COMPLETED,
      outputData: context.toJSON().outputStore as Record<string, unknown>,
    };
  }

  /**
   * Execute AFTER nodes in background
   */
  private async executeAfterNodes(context: NodeContext): Promise<void> {
    const afterNodes = this.getNodesByCategory(NodeCategory.AFTER);
    
    if (afterNodes.length === 0) {
      return;
    }

    console.log(`Executing ${afterNodes.length} AFTER nodes in background...`);
    
    try {
      // Execute all AFTER nodes in parallel
      await this.executeParallel(afterNodes, context);
      console.log("AFTER nodes execution completed successfully");
    } catch (error) {
      console.error("AFTER nodes execution failed:", error);
      throw error;
    }
  }

  async *executeAsync(
    initialWorkflowInput: NodeInput,
    context?: NodeContext,
  ): AsyncGenerator<NodeOutput[], WorkflowExecutionResult, undefined> {
    const ctx = context || new NodeContext();
    const startTime = new Date();
    const result: WorkflowExecutionResult = {
      workflowId: this.config.id,
      status: NodeExecutionStatus.RUNNING,
      results: [],
      startTime,
    };

    try {
      for (const key in initialWorkflowInput) {
        ctx.setInput(key, initialWorkflowInput[key] as NodeValue);
      }

      const entryNodes = this.getEntryNodes();
      if (entryNodes.length === 0) {
        throw new Error("No entry nodes found in workflow");
      }

      await this.executeParallel(entryNodes, ctx);

      const processedNodes = new Set<string>();
      entryNodes.forEach(node => processedNodes.add(node.getId()));

      const queue: Array<{
        nodes: NodeBase[];
      }> = [];
      
      const nextLevelNodesSet = new Set<NodeBase>();
      entryNodes.forEach(node => {
        this.getNextNodes(node.getId()).forEach(nextNode => {
          if (!processedNodes.has(nextNode.getId())) {
            nextLevelNodesSet.add(nextNode);
          }
        });
      });
      if (nextLevelNodesSet.size > 0) {
        queue.push({ nodes: Array.from(nextLevelNodesSet) });
      }

      while (queue.length > 0) {
        const currentBatch = queue.shift()!;
        const nodesToExecuteInBatch = currentBatch.nodes.filter(node => !processedNodes.has(node.getId()));
        
        if (nodesToExecuteInBatch.length === 0) continue;

        await this.executeParallel(nodesToExecuteInBatch, ctx);

        nodesToExecuteInBatch.forEach(node => processedNodes.add(node.getId()));

        const nextLevelNodesSet = new Set<NodeBase>();
        nodesToExecuteInBatch.forEach((node) => {
          this.getNextNodes(node.getId()).forEach(nextNode => {
            if (!processedNodes.has(nextNode.getId())) {
              nextLevelNodesSet.add(nextNode);
            }
          });
        });
        if (nextLevelNodesSet.size > 0) {
          queue.push({ nodes: Array.from(nextLevelNodesSet) });
        }
      }

      result.status = NodeExecutionStatus.COMPLETED;
    } catch (error) {
      result.status = NodeExecutionStatus.FAILED;
    } finally {
      result.endTime = new Date();
      result.outputData = ctx.toJSON().outputStore as Record<string, unknown> | undefined;
    }

    return result;
  }

  validate(): boolean {
    const nodeIds = new Set(this.config.nodes.map(n => n.id));
    for (const node of this.config.nodes) {
      if (node.next) {
        for (const nextId of node.next) {
          if (!nodeIds.has(nextId)) {
            throw new Error(`Invalid node reference: ${nextId} in node ${node.id}`);
          }
        }
      }
    }

    this.detectCycles();

    return true;
  }

  private detectCycles(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const nextId of node.getNext()) {
          if (!visited.has(nextId)) {
            dfs(nextId);
          } else if (recursionStack.has(nextId)) {
            throw new Error(`Cycle detected in workflow: ${nextId}`);
          }
        }
      }

      recursionStack.delete(nodeId);
    };

    const entryNodes = this.getEntryNodes();
    for (const node of entryNodes) {
      if (!visited.has(node.getId())) {
        dfs(node.getId());
      }
    }
  }
} 
