import path from "node:path";

// ============================================================================
// P4 Session Replay Helpers
// ============================================================================

export function buildPayload(runId, nowIso) {
  const characterId = "p4-round9-character";
  const now = nowIso();
  const sessions = [
    { id: `${runId}-session-a`, characterId, name: "P4 Round9 Session A", createdAt: now, updatedAt: now },
    { id: `${runId}-session-b`, characterId, name: "P4 Round9 Session B", createdAt: now, updatedAt: now },
    { id: `${runId}-session-plain`, characterId, name: "P4 Round9 Session Plain401", createdAt: now, updatedAt: now },
  ];

  const characterRecord = {
    id: characterId,
    data: {
      id: characterId,
      name: "P4 Round9 Hero",
      description: "P4 round9 replay character",
      personality: "stable",
      first_mes: "P4 Round9 Opening A",
      scenario: "P4",
      mes_example: "",
      creatorcomment: "",
      avatar: "",
      sample_status: "ready",
      data: {
        name: "P4 Round9 Hero",
        description: "P4 round9 replay character",
        personality: "stable",
        first_mes: "P4 Round9 Opening A",
        scenario: "P4",
        mes_example: "",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        tags: [],
        creator: "p4",
        character_version: "1.0",
        alternate_greetings: ["P4 Round9 Opening A", "P4 Round9 Opening B", "P4 Round9 Opening Plain"],
        character_book: { entries: [] },
        extensions: {},
      },
    },
    imagePath: "",
    created_at: now,
    updated_at: now,
    order: Date.now(),
  };

  const makeTree = (sessionId, nodeId, openingText) => ({
    id: sessionId,
    character_id: characterId,
    current_nodeId: nodeId,
    nodes: [
      { nodeId: "root", parentNodeId: "root", userInput: "", assistantResponse: "", fullResponse: "" },
      { nodeId, parentNodeId: "root", userInput: "", assistantResponse: openingText, fullResponse: openingText },
    ],
  });

  return {
    characterRecord,
    sessions,
    dialogues: [
      makeTree(sessions[0].id, "node-opening-a", "P4 Round9 Opening A"),
      makeTree(sessions[1].id, "node-opening-b", "P4 Round9 Opening B"),
      makeTree(sessions[2].id, "node-opening-plain", "P4 Round9 Opening Plain"),
    ],
    ids: {
      sessionAId: sessions[0].id,
      sessionBId: sessions[1].id,
      sessionPlainId: sessions[2].id,
    },
  };
}

export async function seedIndexedDb(page, baseUrl, payload) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (input) => {
    const DB_NAME = "CharacterAppDB";
    const DB_VERSION = 12;
    const STORE_NAMES = [
      "characters_record", "character_dialogues", "character_images", "world_book", "regex_scripts", "preset_data",
      "sessions_record", "agent_conversations", "memory_entries", "memory_embeddings", "regex_allow_list", "regex_presets",
    ];

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const inner = request.result;
        for (const name of STORE_NAMES) {
          if (!inner.objectStoreNames.contains(name)) inner.createObjectStore(name);
        }
      };
      request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
      request.onsuccess = () => resolve(request.result);
    });

    const tx = db.transaction(["characters_record", "sessions_record", "character_dialogues"], "readwrite");
    tx.objectStore("characters_record").put(input.characterRecord, input.characterRecord.id);
    for (const session of input.sessions) tx.objectStore("sessions_record").put(session, session.id);
    for (const dialogue of input.dialogues) tx.objectStore("character_dialogues").put(dialogue, dialogue.id);

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
    });
  }, payload);
}

export function artifactPaths(runDir) {
  return {
    round7Slash: path.join(runDir, "round7-slash-direct-pass.png"),
    round7Refresh: path.join(runDir, "round7-refresh-persistence-pass.png"),
    round7Isolation: path.join(runDir, "round7-session-b-isolation-pass.png"),
    round8Refresh: path.join(runDir, "round8-plain-refresh-pass.png"),
    round8PreConsole: path.join(runDir, "round8-pre-refresh-console.log"),
    round8PreNetwork: path.join(runDir, "round8-pre-refresh-network.log"),
    console: path.join(runDir, "round9-console.log"),
    network: path.join(runDir, "round9-network.log"),
    summaryJson: path.join(runDir, "summary.json"),
    summaryMd: path.join(runDir, "summary.md"),
  };
}

export function renderSummaryMarkdown(summary, files, repoRoot) {
  const lines = [
    `# P4 Session Replay Summary (${summary.runId})`,
    "",
    `- startedAt: ${summary.startedAt}`,
    `- finishedAt: ${summary.finishedAt}`,
    `- baseUrl: ${summary.baseUrl}`,
    `- allPassed: ${summary.allPassed}`,
    "",
    "## Checkpoints",
    ...summary.checkpoints.map((item) => `- ${item.passed ? "PASS" : "FAIL"}: ${item.name}`),
    "",
    "## Artifacts",
    `- round7 slash 直达截图: ${path.relative(repoRoot, files.round7Slash)}`,
    `- round7 刷新持久化截图: ${path.relative(repoRoot, files.round7Refresh)}`,
    `- round7 会话隔离截图: ${path.relative(repoRoot, files.round7Isolation)}`,
    `- round8 普通输入刷新截图: ${path.relative(repoRoot, files.round8Refresh)}`,
    `- round8 pre-refresh console: ${path.relative(repoRoot, files.round8PreConsole)}`,
    `- round8 pre-refresh network: ${path.relative(repoRoot, files.round8PreNetwork)}`,
    `- full console log: ${path.relative(repoRoot, files.console)}`,
    `- full network log: ${path.relative(repoRoot, files.network)}`,
    "",
  ];

  if (summary.error) {
    lines.push("## Error", `- ${summary.error}`, "");
  }

  return `${lines.join("\n")}`;
}
