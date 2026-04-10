import {
  ResearchSession,
  SessionStatus,
  Message,
  GenerationOutput,
  TaskEntry,
  StatusEntry,
  UserSettingEntry,
  WorldViewEntry,
  SupplementEntry,
} from "../../models/agent-model";
import {
  AGENT_CONVERSATIONS_FILE,
  getRecordByKey,
  putRecord,
} from "../local-storage";

// ============================================================================
//                              存储辅助
// ============================================================================

async function loadSession(sessionId: string): Promise<ResearchSession | null> {
  return await getRecordByKey<ResearchSession>(AGENT_CONVERSATIONS_FILE, sessionId);
}

async function persistSession(session: ResearchSession): Promise<void> {
  await putRecord(AGENT_CONVERSATIONS_FILE, session.id, session);
}

function requireSession(session: ResearchSession | null, sessionId: string): ResearchSession {
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return session;
}

// ============================================================================
//                              UI 辅助函数
// ============================================================================

/**
 * Get session summary for UI display (similar to character dialogue info)
 */
export async function getSessionSummary(sessionId: string): Promise<{
  title: string;
  status: SessionStatus;
  messageCount: number;
  hasCharacter: boolean;
  hasWorldbook: boolean;
  completionPercentage: number;
  knowledgeBaseSize: number;
} | null> {
  const session = await loadSession(sessionId);
  if (!session) return null;

  const hasCharacter = !!session.generation_output.character_data;
  const hasWorldbook = !!(
    session.generation_output.status_data ||
    session.generation_output.user_setting_data ||
    session.generation_output.world_view_data ||
    (session.generation_output.supplement_data && session.generation_output.supplement_data.length > 0)
  );

  // Calculate completion percentage based on available data
  let completedComponents = 0;
  const totalComponents = 5; // character + 4 worldbook components

  if (session.generation_output.character_data) completedComponents++;
  if (session.generation_output.status_data) completedComponents++;
  if (session.generation_output.user_setting_data) completedComponents++;
  if (session.generation_output.world_view_data) completedComponents++;
  if (session.generation_output.supplement_data && session.generation_output.supplement_data.length >= 5) completedComponents++;

  const completionPercentage = (completedComponents / totalComponents) * 100;

  return {
    title: session.title,
    status: session.status,
    messageCount: session.messages.length,
    hasCharacter,
    hasWorldbook,
    completionPercentage,
    knowledgeBaseSize: session.research_state.knowledge_base.length,
  };
}

/**
 * Get session with formatted messages for UI display
 */
export async function getSessionForUI(sessionId: string): Promise<{
  session: ResearchSession;
  formattedMessages: Message[];
  needsUserInput: boolean;
  userInputQuestion?: string;
  userInputOptions?: string[];
} | null> {
  const session = await loadSession(sessionId);
  if (!session) return null;

  const formattedMessages = session.messages.map(msg => ({
    id: msg.id,
    role: msg.role as "agent" | "user",
    content: msg.content,
    type: msg.type || "agent_action" as unknown,
    timestamp: new Date(msg.timestamp || Date.now()),
    metadata: msg.metadata,
  }));

  // Check if waiting for user input
  const needsUserInput = session.status === SessionStatus.WAITING_USER;
  let userInputQuestion: string | undefined;
  let userInputOptions: string[] | undefined;

  if (needsUserInput) {
    const lastMessage = session.messages[session.messages.length - 1];
    if (lastMessage && lastMessage.content.includes("INPUT REQUIRED:")) {
      const lines = lastMessage.content.split("\n");
      const questionLine = lines.find(line => line.includes("INPUT REQUIRED:"));
      const optionsLine = lines.find(line => line.includes("Options:"));

      if (questionLine) {
        userInputQuestion = questionLine.replace("INPUT REQUIRED:", "").trim();
      }
      if (optionsLine) {
        userInputOptions = optionsLine
          .replace("Options:", "")
          .split(",")
          .map(opt => opt.trim())
          .filter(opt => opt.length > 0);
      }
    }
  }

  return {
    session,
    formattedMessages: formattedMessages as Message[],
    needsUserInput,
    userInputQuestion,
    userInputOptions,
  };
}

// ============================================================================
//                              任务队列操作
// ============================================================================

/**
 * Add new tasks to the task queue efficiently
 */
export async function addTasksToQueue(
  sessionId: string,
  newTasks: TaskEntry[],
): Promise<void> {
  const session = requireSession(await loadSession(sessionId), sessionId);

  const currentQueue = session.research_state.task_queue || [];
  session.research_state.task_queue = [...currentQueue, ...newTasks];
  await persistSession(session);
}

/**
 * Complete current task efficiently by moving it to completed_tasks
 */
export async function completeCurrentTask(
  sessionId: string,
): Promise<void> {
  const session = requireSession(await loadSession(sessionId), sessionId);

  const taskQueue = session.research_state.task_queue || [];

  if (taskQueue.length > 0) {
    const completedTask = taskQueue[0];
    const remainingTasks = taskQueue.slice(1);

    // Update research state
    session.research_state.task_queue = remainingTasks;
    session.research_state.completed_tasks.push(completedTask.description);

    await persistSession(session);
  }
}

/**
 * Append new worldbook entries to existing specialized worldbook data efficiently
 */
export async function appendWorldbookData(
  sessionId: string,
  worldbookData: {
    status_data?: StatusEntry;
    user_setting_data?: UserSettingEntry;
    world_view_data?: WorldViewEntry;
    supplement_data?: SupplementEntry[];
  },
): Promise<void> {
  const session = requireSession(await loadSession(sessionId), sessionId);

  if (worldbookData.status_data) {
    session.generation_output.status_data = worldbookData.status_data;
  }

  if (worldbookData.user_setting_data) {
    session.generation_output.user_setting_data = worldbookData.user_setting_data;
  }

  if (worldbookData.world_view_data) {
    session.generation_output.world_view_data = worldbookData.world_view_data;
  }

  if (worldbookData.supplement_data && worldbookData.supplement_data.length > 0) {
    const currentSupplements = session.generation_output.supplement_data || [];
    session.generation_output.supplement_data = [...currentSupplements, ...worldbookData.supplement_data];
  }

  await persistSession(session);
}

/**
 * Get generation output without fetching entire session
 */
export async function getGenerationOutput(sessionId: string): Promise<GenerationOutput | null> {
  const session = await loadSession(sessionId);
  if (!session) return null;

  return session.generation_output;
}

/**
 * Complete current sub-problem by removing it from the latest task
 */
export async function completeCurrentSubProblem(sessionId: string): Promise<void> {
  const session = requireSession(await loadSession(sessionId), sessionId);

  const taskQueue = session.research_state.task_queue || [];

  if (taskQueue.length > 0 && taskQueue[0].sub_problems.length > 0) {
    const currentTask = taskQueue[0];
    const completedSubProblem = currentTask.sub_problems[0]; // First sub-problem

    // Remove the first sub-problem
    currentTask.sub_problems = currentTask.sub_problems.slice(1);

    // If no more sub-problems in this task, move the task to completed
    if (currentTask.sub_problems.length === 0) {
      session.research_state.task_queue = taskQueue.slice(1);
      session.research_state.completed_tasks.push(currentTask.description);
    }

    await persistSession(session);

    console.log(`✅ Sub-problem completed: ${completedSubProblem.description}`);
    if (currentTask.sub_problems.length === 0) {
      console.log(`✅ Task completed: ${currentTask.description}`);
    }
  }
}

/**
 * Get current sub-problem from the first task in queue
 */
export async function getCurrentSubProblem(sessionId: string): Promise<{
  task?: TaskEntry,
  subProblem?: unknown
}> {
  const session = await loadSession(sessionId);
  if (!session || !session.research_state.task_queue || session.research_state.task_queue.length === 0) {
    return {};
  }

  const currentTask = session.research_state.task_queue[0];
  if (!currentTask.sub_problems || currentTask.sub_problems.length === 0) {
    return { task: currentTask };
  }

  return {
    task: currentTask,
    subProblem: currentTask.sub_problems[0],
  };
}

/**
 * Modify current task description and replace sub-problems
 */
export async function modifyCurrentTaskAndSubproblems(sessionId: string, newDescription: string, newSubproblems: string[]): Promise<void> {
  const session = requireSession(await loadSession(sessionId), sessionId);

  const taskQueue = session.research_state.task_queue || [];

  if (taskQueue.length > 0) {
    const currentTask = taskQueue[0];

    // Update task description
    currentTask.description = newDescription;

    // Replace sub-problems with new ones
    if (newSubproblems.length > 0) {
      currentTask.sub_problems = newSubproblems.map((description, index) => ({
        id: `modified_sub_${Date.now()}_${index}`,
        description: description,
        reasoning: "Updated by task adjustment",
      }));
    } else {
      // If no new sub-problems provided, clear existing ones and mark task as complete
      currentTask.sub_problems = [];
      session.research_state.task_queue = taskQueue.slice(1);
      session.research_state.completed_tasks.push(currentTask.description);
    }

    await persistSession(session);
    console.log(`✅ Modified current task to: ${newDescription}`);

    if (newSubproblems.length > 0) {
      console.log(`✅ Updated with ${newSubproblems.length} new sub-problems`);
    } else {
      console.log(`✅ Task completed with no sub-problems: ${currentTask.description}`);
    }
  }
}

/**
 * Clear all tasks from the task queue
 */
export async function clearAllTasks(sessionId: string): Promise<void> {
  const session = requireSession(await loadSession(sessionId), sessionId);

  session.research_state.task_queue = [];
  await persistSession(session);
}
