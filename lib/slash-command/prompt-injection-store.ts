export type PromptInjectionRole = "system" | "assistant" | "user";

export type PromptInjectionPosition = "before" | "after" | "in_chat" | "none";

export interface PromptInjectionScope {
  characterId?: string;
  dialogueId?: string;
  iframeId?: string;
}

export interface PromptInjectionRecord {
  id: string;
  content: string;
  role: PromptInjectionRole;
  position: PromptInjectionPosition;
  depth: number;
  should_scan: boolean;
  createdAt: string;
  scope: PromptInjectionScope;
}

interface PromptInjectionInput {
  id?: string;
  content: string;
  role?: PromptInjectionRole;
  position?: PromptInjectionPosition | "chat";
  depth?: number;
  should_scan?: boolean;
}

const promptInjectionStore = new Map<string, PromptInjectionRecord>();

function createInjectionId(): string {
  return `inject_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeScope(scope?: PromptInjectionScope): PromptInjectionScope {
  return {
    characterId: scope?.characterId || undefined,
    dialogueId: scope?.dialogueId || undefined,
    iframeId: scope?.iframeId || undefined,
  };
}

function normalizePosition(position?: PromptInjectionInput["position"]): PromptInjectionPosition {
  if (position === "chat") {
    return "in_chat";
  }
  if (position === "before" || position === "after" || position === "in_chat" || position === "none") {
    return position;
  }
  return "in_chat";
}

function matchScope(recordScope: PromptInjectionScope, scope: PromptInjectionScope): boolean {
  if (scope.dialogueId) {
    return recordScope.dialogueId === scope.dialogueId;
  }
  if (scope.characterId) {
    return recordScope.characterId === scope.characterId;
  }
  return true;
}

export function upsertPromptInjection(
  payload: PromptInjectionInput,
  scope?: PromptInjectionScope,
): PromptInjectionRecord {
  const record: PromptInjectionRecord = {
    id: payload.id?.trim() || createInjectionId(),
    content: payload.content,
    role: payload.role || "system",
    position: normalizePosition(payload.position),
    depth: typeof payload.depth === "number" && Number.isFinite(payload.depth)
      ? Math.trunc(payload.depth)
      : 0,
    should_scan: payload.should_scan === true,
    createdAt: new Date().toISOString(),
    scope: normalizeScope(scope),
  };
  promptInjectionStore.set(record.id, record);
  return record;
}

export function removePromptInjections(ids: string[]): number {
  let removed = 0;
  for (const id of ids) {
    if (promptInjectionStore.delete(id)) {
      removed += 1;
    }
  }
  return removed;
}

export function listPromptInjections(scope?: PromptInjectionScope): PromptInjectionRecord[] {
  const normalizedScope = normalizeScope(scope);
  return Array.from(promptInjectionStore.values())
    .filter((record) => matchScope(record.scope, normalizedScope))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function clearPromptInjections(): void {
  promptInjectionStore.clear();
}
