import {
  ResearchSession,
  SessionStatus,
  Message,
  ResearchState,
  KnowledgeEntry,
  GenerationOutput,
} from "../../models/agent-model";
import {
  AGENT_CONVERSATIONS_FILE,
  clearStore,
  deleteRecord,
  getAllRecords,
  getRecordByKey,
  putRecord,
} from "../local-storage";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
//                              Agent 会话辅助函数出口
// ============================================================================

export {
  getSessionSummary,
  getSessionForUI,
  addTasksToQueue,
  completeCurrentTask,
  appendWorldbookData,
  getGenerationOutput,
  completeCurrentSubProblem,
  getCurrentSubProblem,
  modifyCurrentTaskAndSubproblems,
  clearAllTasks,
} from "./agent-conversation-helpers";

// ============================================================================
//                              核心操作类
// ============================================================================

/**
 * Agent Conversation Operations - Simplified for Real-time Architecture
 */
export class ResearchSessionOperations {

  /**
   * Create a new agent conversation with simplified initial state
   */
  static async createSession(
    initialUserRequest: string,
  ): Promise<ResearchSession> {
    const conversationId = uuidv4();

    // Create initial task state
    const ResearchState: ResearchState = {
      id: uuidv4(),
      session_id: conversationId,
      main_objective: initialUserRequest,
      // Sequential task management - will be populated by task decomposition
      task_queue: [], // Empty initially - will be filled by task decomposition
      completed_tasks: [],
      knowledge_base: [],
    };

    // Create initial character progress
    const GenerationOutput: GenerationOutput = {
    };

    // Create initial user message
    const initialMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: initialUserRequest,
      type: "user_input",
    };

    const session: ResearchSession = {
      id: conversationId,
      title: initialUserRequest ,
      status: SessionStatus.IDLE,
      messages: [initialMessage],
      research_state: ResearchState,
      generation_output: GenerationOutput,
      execution_info: {
        current_iteration: 0,
        max_iterations: 50,
        error_count: 0,
        total_tokens_used: 0,
        token_budget: 100000, // 100K tokens default budget
      },
    };

    await this.saveSession(session);
    return session;
  }

  /**
   * Get conversation by ID
   */
  static async getSessionById(sessionId: string): Promise<ResearchSession | null> {
    return await getRecordByKey<ResearchSession>(AGENT_CONVERSATIONS_FILE, sessionId);
  }

  /**
   * Get all conversations
   */
  static async getAllSessions(): Promise<ResearchSession[]> {
    try {
      const data = await getAllRecords<ResearchSession>(AGENT_CONVERSATIONS_FILE);
      return Array.isArray(data) ? data.filter(Boolean) : [];
    } catch (error) {
      console.error("Failed to load sessions:", error);
      return [];
    }
  }

  /**
   * Save conversation to storage
   */
  static async saveSession(session: ResearchSession): Promise<void> {
    await putRecord(AGENT_CONVERSATIONS_FILE, session.id, session);
  }

  /**
   * Update conversation status
   */
  static async updateStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = status;
    await this.saveSession(session);
  }

  /**
   * Add message to conversation
   */
  static async addMessage(
    sessionId: string,
    messageData: Omit<Message, "id">,
  ): Promise<Message> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const message: Message = {
      ...messageData,
      id: uuidv4(),
    };

    session.messages.push(message);
    await this.saveSession(session);

    return message;
  }

  /**
   * Update task state
   */
  static async updateResearchState(
    sessionId: string,
    updates: Partial<Omit<ResearchState, "id" | "session_id">>,
  ): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update task state
    Object.assign(session.research_state, updates);

    await this.saveSession(session);
  }

  /**
   * Update generation output with intelligent merging
   * For character_data: merges new fields with existing ones, overwrites existing fields with new values
   * For other fields: performs direct assignment
   */
  static async updateGenerationOutput(
    sessionId: string,
    updates: Partial<GenerationOutput>,
  ): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Handle character_data with intelligent merging
    if (updates.character_data) {
      const existingCharacterData = session.generation_output.character_data || {};
      // Merge new character fields with existing ones, new fields override existing ones
      session.generation_output.character_data = {
        ...existingCharacterData,
        ...updates.character_data,
      };

      // Remove character_data from updates to avoid double processing
      const { character_data, ...otherUpdates } = updates;

      // Apply other updates normally
      if (Object.keys(otherUpdates).length > 0) {
        Object.assign(session.generation_output, otherUpdates);
      }
    } else {
      // No character_data to merge, apply updates normally
      Object.assign(session.generation_output, updates);
    }

    await this.saveSession(session);
  }

  /**
   * Add knowledge entries to the knowledge base
   */
  static async addKnowledgeEntries(
    sessionId: string,
    entries: KnowledgeEntry[],
  ): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.research_state.knowledge_base.push(...entries);

    await this.saveSession(session);
  }

  /**
   * Increment iteration counter
   */
  static async incrementIteration(sessionId: string): Promise<number> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.execution_info.current_iteration++;
    await this.saveSession(session);

    return session.execution_info.current_iteration;
  }

  /**
   * Record token usage
   */
  static async recordTokenUsage(sessionId: string, tokensUsed: number): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.execution_info.total_tokens_used += tokensUsed;
    await this.saveSession(session);
  }

  /**
   * Record error
   */
  static async recordError(sessionId: string, error: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.execution_info.error_count++;
    session.execution_info.last_error = error;
    await this.saveSession(session);
  }

  /**
   * Delete conversation
   */
  static async deleteSession(sessionId: string): Promise<void> {
    await deleteRecord(AGENT_CONVERSATIONS_FILE, sessionId);
  }

  /**
   * Clear all sessions from the data file
   */
  static async clearAll(): Promise<void> {
    await clearStore(AGENT_CONVERSATIONS_FILE);
  }

  /**
   * Get or create session for UI (similar to character dialogue loading)
   */
  static async getOrCreateSession(
    sessionId?: string,
    initialRequest?: string,
  ): Promise<{ session: ResearchSession; isNew: boolean }> {
    if (sessionId) {
      const existingSession = await this.getSessionById(sessionId);
      if (existingSession) {
        return { session: existingSession, isNew: false };
      }
    }

    if (!initialRequest) {
      throw new Error("initial request required for new session");
    }

    const newSession = await this.createSession(initialRequest);
    return { session: newSession, isNew: true };
  }
}
