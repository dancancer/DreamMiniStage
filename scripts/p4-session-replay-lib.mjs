import path from "node:path";

// ============================================================================
// P4 Session Replay Helpers
// ============================================================================

const DEFAULT_REPLAY_ARTIFACT_ROOT_RELATIVE = ".artifacts/p4-session-replay";
const DEFAULT_REPLAY_RUN_INDEX_JSON = "p4-session-replay-run-index.json";
const DEFAULT_REPLAY_RUN_INDEX_MD = "p4-session-replay-run-index.md";

export function resolveReplayArtifactLayout(repoRoot, artifactRootInput = DEFAULT_REPLAY_ARTIFACT_ROOT_RELATIVE) {
  const artifactRoot = path.resolve(repoRoot, artifactRootInput);
  return {
    artifactRoot,
    runIndexJsonPath: path.join(artifactRoot, DEFAULT_REPLAY_RUN_INDEX_JSON),
    runIndexMdPath: path.join(artifactRoot, DEFAULT_REPLAY_RUN_INDEX_MD),
  };
}

export function buildPayload(runId, nowIso) {
  const characterId = "p4-round10-character";
  const now = nowIso();
  const sessions = [
    { id: `${runId}-session-a`, characterId, name: "P4 Round10 Session A", createdAt: now, updatedAt: now },
    { id: `${runId}-session-b`, characterId, name: "P4 Round10 Session B", createdAt: now, updatedAt: now },
    { id: `${runId}-session-plain`, characterId, name: "P4 Round10 Session Plain401", createdAt: now, updatedAt: now },
  ];

  const characterRecord = {
    id: characterId,
    data: {
      id: characterId,
      name: "P4 Round10 Hero",
      description: "P4 round10 replay character",
      personality: "stable",
      first_mes: "P4 Round10 Opening A",
      scenario: "P4",
      mes_example: "",
      creatorcomment: "",
      avatar: "",
      sample_status: "ready",
      data: {
        name: "P4 Round10 Hero",
        description: "P4 round10 replay character",
        personality: "stable",
        first_mes: "P4 Round10 Opening A",
        scenario: "P4",
        mes_example: "",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        tags: [],
        creator: "p4",
        character_version: "1.0",
        alternate_greetings: ["P4 Round10 Opening A", "P4 Round10 Opening B", "P4 Round10 Opening Plain"],
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
      makeTree(sessions[0].id, "node-opening-a", "P4 Round10 Opening A"),
      makeTree(sessions[1].id, "node-opening-b", "P4 Round10 Opening B"),
      makeTree(sessions[2].id, "node-opening-plain", "P4 Round10 Opening Plain"),
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
    round9Teleport: path.join(runDir, "round9-floor-teleport-pass.png"),
    round9ProxySwitch: path.join(runDir, "round9-proxy-switch-pass.png"),
    round9YtProvider: path.join(runDir, "round9-yt-script-provider-pass.png"),
    round10TranslateProvider: path.join(runDir, "round10-translate-provider-pass.png"),
    round11TranslateUnsupportedProvider: path.join(runDir, "round11-translate-unsupported-provider-pass.png"),
    round11YtFailFast: path.join(runDir, "round11-yt-script-provider-failfast-pass.png"),
    round12ProxyUnknownPresetFailFast: path.join(runDir, "round12-proxy-unknown-preset-failfast-pass.png"),
    round13TimedEffectSuccess: path.join(runDir, "round13-wi-timed-effect-success-pass.png"),
    round13TimedEffectFailFast: path.join(runDir, "round13-wi-timed-effect-failfast-pass.png"),
    console: path.join(runDir, "round13-console.log"),
    network: path.join(runDir, "round13-network.log"),
    noiseReportJson: path.join(runDir, "round13-noise-baseline-report.json"),
    noiseReportMd: path.join(runDir, "round13-noise-baseline-report.md"),
    summaryJson: path.join(runDir, "summary.json"),
    summaryMd: path.join(runDir, "summary.md"),
  };
}

function getUnknownEntries(summary, channel) {
  const entries = summary?.noiseBaseline?.[channel]?.unknown;
  return Array.isArray(entries) ? entries : [];
}

function pushUnknownDigest(lines, title, entries, maxEntries) {
  if (entries.length === 0) return;
  lines.push(title);
  for (const entry of entries.slice(0, maxEntries)) {
    lines.push(`- x ${entry.count} ${entry.signature}`);
  }
  if (entries.length > maxEntries) {
    lines.push(`- ... ${entries.length - maxEntries} more`);
  }
  lines.push("");
}

export function renderReplayFailureDigest(summary, options = {}) {
  const maxEntries = Number.isInteger(options.maxEntries) && options.maxEntries > 0 ? options.maxEntries : 5;
  const consoleUnknown = getUnknownEntries(summary, "console");
  const networkUnknown = getUnknownEntries(summary, "network");
  const lines = [
    "[p4-session-replay] Failure digest",
    `- runId: ${summary?.runId || "n/a"}`,
    `- error: ${summary?.error || "n/a"}`,
    `- artifacts: ${summary?.runDir || "n/a"}`,
    `- unknownSignatureCount: ${summary?.noiseBaseline?.unknownSignatureCount ?? "n/a"}`,
    `- noiseReport: ${summary?.noiseReportPath || "n/a"}`,
    "",
  ];

  pushUnknownDigest(lines, "Console New Signatures", consoleUnknown, maxEntries);
  pushUnknownDigest(lines, "Network New Signatures", networkUnknown, maxEntries);

  return lines.join("\n").trimEnd();
}

export function renderReplayJobSummaryMarkdown(summary, options = {}) {
  const maxEntries = Number.isInteger(options.maxEntries) && options.maxEntries > 0 ? options.maxEntries : 5;
  const consoleUnknown = getUnknownEntries(summary, "console");
  const networkUnknown = getUnknownEntries(summary, "network");
  const lines = [
    `## P4 Session Replay ${summary?.allPassed ? "Success" : "Failure"}`,
    `- runId: \`${summary?.runId || "n/a"}\``,
    `- allPassed: \`${summary?.allPassed ? "true" : "false"}\``,
    `- unknown signatures: \`${summary?.noiseBaseline?.unknownSignatureCount ?? "n/a"}\``,
    `- artifacts: \`${summary?.runDir || "n/a"}\``,
    `- noise report: \`${summary?.noiseReportPath || "n/a"}\``,
  ];

  if (summary?.error) {
    lines.push(`- error: \`${summary.error}\``);
  }

  lines.push("");

  if (consoleUnknown.length > 0) {
    lines.push("### Console New Signatures", ...consoleUnknown.slice(0, maxEntries).map((entry) => `- x ${entry.count} \`${entry.signature}\``), "");
  }

  if (networkUnknown.length > 0) {
    lines.push("### Network New Signatures", ...networkUnknown.slice(0, maxEntries).map((entry) => `- x ${entry.count} \`${entry.signature}\``), "");
  }

  if (consoleUnknown.length === 0 && networkUnknown.length === 0) {
    lines.push("### New Signatures", "- (none)", "");
  }

  return lines.join("\n").trimEnd();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function normalizeTextFragment(text) {
  return text.replace(/\s+/g, " ").trim();
}

function testRuleText(text, rule) {
  if (rule.messageIncludes && !text.includes(rule.messageIncludes)) return false;
  if (rule.messageRegex && !(new RegExp(rule.messageRegex).test(text))) return false;
  return true;
}

function testRuleUrl(url, rule) {
  if (rule.urlIncludes && !url.includes(rule.urlIncludes)) return false;
  if (rule.urlRegex && !(new RegExp(rule.urlRegex).test(url))) return false;
  return true;
}

function matchConsoleRule(event, rule) {
  if (rule.level && rule.level !== event.level) return false;
  return testRuleText(event.message, rule);
}

function matchNetworkRule(event, rule) {
  if (rule.eventType && rule.eventType !== event.eventType) return false;
  if (rule.method && rule.method !== event.method) return false;
  if (typeof rule.status === "number" && rule.status !== event.status) return false;
  if (!testRuleUrl(event.url, rule)) return false;
  if (rule.errorIncludes && !event.error.includes(rule.errorIncludes)) return false;
  if (rule.errorRegex && !(new RegExp(rule.errorRegex).test(event.error))) return false;
  return true;
}

function buildConsoleUnknownSignature(event) {
  return `${event.level}|${normalizeTextFragment(event.message).slice(0, 240)}`;
}

function buildNetworkUnknownSignature(event) {
  const status = typeof event.status === "number" ? String(event.status) : "none";
  const url = normalizeUrl(event.url);
  const error = normalizeTextFragment(event.error || "");
  return `${event.eventType}|${status}|${event.method}|${url}|${error}`;
}

function aggregateKnown(ruleMap) {
  return Array.from(ruleMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function aggregateUnknown(signatureMap) {
  return Array.from(signatureMap.entries())
    .map(([signature, count]) => ({ signature, count }))
    .sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature));
}

function buildRuleAudit(rules, knownEntries) {
  const allRuleIds = rules.map((rule) => rule.id).filter(Boolean);
  const matchedRuleIds = knownEntries.map((entry) => entry.id);
  const matchedSet = new Set(matchedRuleIds);
  const unusedRuleIds = allRuleIds.filter((id) => !matchedSet.has(id));

  return {
    totalRules: allRuleIds.length,
    matchedRuleCount: matchedRuleIds.length,
    allRuleIds,
    matchedRuleIds,
    unusedRuleIds,
  };
}

function classifyConsoleEvents(events, rules) {
  const known = new Map();
  const unknown = new Map();

  for (const event of events) {
    const matchedRule = rules.find((rule) => matchConsoleRule(event, rule));
    if (!matchedRule) {
      const signature = buildConsoleUnknownSignature(event);
      unknown.set(signature, (unknown.get(signature) || 0) + 1);
      continue;
    }

    const entry = known.get(matchedRule.id) || {
      id: matchedRule.id,
      classification: matchedRule.classification || "known-noise",
      count: 0,
      sample: `${event.level}|${normalizeTextFragment(event.message).slice(0, 200)}`,
    };
    entry.count += 1;
    known.set(matchedRule.id, entry);
  }

  return {
    total: events.length,
    known: aggregateKnown(known),
    unknown: aggregateUnknown(unknown),
  };
}

function classifyNetworkEvents(events, rules) {
  const known = new Map();
  const unknown = new Map();

  for (const event of events) {
    const matchedRule = rules.find((rule) => matchNetworkRule(event, rule));
    if (!matchedRule) {
      const signature = buildNetworkUnknownSignature(event);
      unknown.set(signature, (unknown.get(signature) || 0) + 1);
      continue;
    }

    const entry = known.get(matchedRule.id) || {
      id: matchedRule.id,
      classification: matchedRule.classification || "known-noise",
      count: 0,
      sample: `${event.eventType}|${event.status || "none"}|${event.method}|${normalizeUrl(event.url)}`,
    };
    entry.count += 1;
    known.set(matchedRule.id, entry);
  }

  return {
    total: events.length,
    known: aggregateKnown(known),
    unknown: aggregateUnknown(unknown),
  };
}

export function analyzeNoiseBaseline(input) {
  const consoleRules = Array.isArray(input.baseline?.consoleRules) ? input.baseline.consoleRules : [];
  const networkRules = Array.isArray(input.baseline?.networkRules) ? input.baseline.networkRules : [];
  const consoleCandidates = input.consoleEvents.filter((event) => event.level === "error" || event.level === "warning");
  const networkCandidates = input.networkEvents.filter((event) => {
    if (event.eventType === "requestfailed" || event.eventType === "mock") return true;
    return typeof event.status === "number" && event.status >= 400;
  });

  const consoleResult = classifyConsoleEvents(consoleCandidates, consoleRules);
  const networkResult = classifyNetworkEvents(networkCandidates, networkRules);
  const consoleRuleAudit = buildRuleAudit(consoleRules, consoleResult.known);
  const networkRuleAudit = buildRuleAudit(networkRules, networkResult.known);
  const unknownCount = consoleResult.unknown.length + networkResult.unknown.length;

  return {
    baselineVersion: input.baseline?.version || 1,
    console: consoleResult,
    network: networkResult,
    ruleAudit: {
      console: consoleRuleAudit,
      network: networkRuleAudit,
    },
    hasNewNoise: unknownCount > 0,
    unknownSignatureCount: unknownCount,
  };
}

function pushKnownList(lines, title, entries) {
  lines.push(`### ${title}`, "");
  if (entries.length === 0) {
    lines.push("- (none)", "");
    return;
  }

  for (const entry of entries) {
    lines.push(`- ${entry.id} (${entry.classification}) x ${entry.count}`);
  }
  lines.push("");
}

function pushUnknownList(lines, title, entries) {
  lines.push(`### ${title}`, "");
  if (entries.length === 0) {
    lines.push("- (none)", "");
    return;
  }

  for (const entry of entries) {
    lines.push(`- x ${entry.count} ${entry.signature}`);
  }
  lines.push("");
}

function pushRuleAudit(lines, title, audit) {
  lines.push(`### ${title}`, "");
  lines.push(`- totalRules: ${audit.totalRules}`);
  lines.push(`- matchedRuleCount: ${audit.matchedRuleCount}`);
  lines.push(`- unusedRuleCount: ${audit.unusedRuleIds.length}`);
  if (audit.unusedRuleIds.length > 0) {
    lines.push(...audit.unusedRuleIds.map((id) => `- unused: ${id}`));
  }
  lines.push("");
}

export function renderNoiseReportMarkdown(report, baselinePath, repoRoot) {
  const lines = [
    "# P4 Session Replay Noise Baseline Report",
    "",
    `- baseline: ${path.relative(repoRoot, baselinePath)}`,
    `- baselineVersion: ${report.baselineVersion}`,
    `- hasNewNoise: ${report.hasNewNoise}`,
    `- unknownSignatureCount: ${report.unknownSignatureCount}`,
    "",
    "## Console Candidates",
    `- total: ${report.console.total}`,
    "",
  ];

  pushKnownList(lines, "Console Known Signatures", report.console.known);
  pushUnknownList(lines, "Console New Signatures", report.console.unknown);

  lines.push("## Network Candidates", `- total: ${report.network.total}`, "");
  pushKnownList(lines, "Network Known Signatures", report.network.known);
  pushUnknownList(lines, "Network New Signatures", report.network.unknown);

  if (report.ruleAudit) {
    lines.push("## Rule Audit", "");
    pushRuleAudit(lines, "Console Rules", report.ruleAudit.console);
    pushRuleAudit(lines, "Network Rules", report.ruleAudit.network);
  }

  return `${lines.join("\n")}`;
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
    `- round9 floor-teleport 宿主滚动截图: ${path.relative(repoRoot, files.round9Teleport)}`,
    `- round9 /proxy 成功切换截图: ${path.relative(repoRoot, files.round9ProxySwitch)}`,
    `- round9 /yt-script 默认 provider 成功截图: ${path.relative(repoRoot, files.round9YtProvider)}`,
    `- round10 /translate 默认 provider 成功截图: ${path.relative(repoRoot, files.round10TranslateProvider)}`,
    `- round11 /translate unsupported provider fail-fast 截图: ${path.relative(repoRoot, files.round11TranslateUnsupportedProvider)}`,
    `- round11 /yt-script 默认 provider fail-fast 截图: ${path.relative(repoRoot, files.round11YtFailFast)}`,
    `- round12 /proxy unknown preset fail-fast 截图: ${path.relative(repoRoot, files.round12ProxyUnknownPresetFailFast)}`,
    `- round13 /wi-set-timed-effect 成功截图: ${path.relative(repoRoot, files.round13TimedEffectSuccess)}`,
    `- round13 /wi-set-timed-effect fail-fast 截图: ${path.relative(repoRoot, files.round13TimedEffectFailFast)}`,
    `- full console log: ${path.relative(repoRoot, files.console)}`,
    `- full network log: ${path.relative(repoRoot, files.network)}`,
    `- noise baseline report: ${path.relative(repoRoot, files.noiseReportMd)}`,
    "",
  ];

  if (summary.noiseBaseline) {
    lines.push(
      "## Noise Baseline",
      `- baselineVersion: ${summary.noiseBaseline.baselineVersion}`,
      `- hasNewNoise: ${summary.noiseBaseline.hasNewNoise}`,
      `- unknownSignatureCount: ${summary.noiseBaseline.unknownSignatureCount}`,
      "",
    );
  }

  if (summary.runIndex) {
    lines.push(
      "## Run Index",
      `- json: ${summary.runIndex.jsonPath}`,
      `- markdown: ${summary.runIndex.markdownPath}`,
      `- staleRuleCount: ${summary.runIndex.staleRuleCount}`,
      "",
    );
  }

  if (summary.error) {
    lines.push("## Error", `- ${summary.error}`, "");
  }

  return `${lines.join("\n")}`;
}

function toDurationMs(startedAt, finishedAt) {
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return null;
  return finished - started;
}

function toRuleHealthMap(previousHealth, allRuleIds, matchedRuleIds, summary) {
  const matchedSet = new Set(matchedRuleIds);
  const next = {};

  for (const id of allRuleIds) {
    const previous = previousHealth[id] || {
      totalHits: 0,
      consecutiveMisses: 0,
      lastHitRunId: null,
      lastHitAt: null,
    };
    if (matchedSet.has(id)) {
      next[id] = {
        totalHits: previous.totalHits + 1,
        consecutiveMisses: 0,
        lastHitRunId: summary.runId,
        lastHitAt: summary.finishedAt,
      };
      continue;
    }

    next[id] = {
      totalHits: previous.totalHits,
      consecutiveMisses: previous.consecutiveMisses + 1,
      lastHitRunId: previous.lastHitRunId,
      lastHitAt: previous.lastHitAt,
    };
  }

  return next;
}

function toStaleRules(ruleHealthMap, staleMissThreshold) {
  return Object.entries(ruleHealthMap)
    .filter(([, state]) => state.consecutiveMisses >= staleMissThreshold)
    .map(([id, state]) => ({
      id,
      consecutiveMisses: state.consecutiveMisses,
      totalHits: state.totalHits,
      lastHitRunId: state.lastHitRunId,
      lastHitAt: state.lastHitAt,
    }))
    .sort((a, b) => b.consecutiveMisses - a.consecutiveMisses || a.id.localeCompare(b.id));
}

function toRunEntry(summary) {
  const checkpoints = Array.isArray(summary.checkpoints) ? summary.checkpoints : [];
  const passedCheckpoints = checkpoints.filter((item) => item.passed).length;
  return {
    runId: summary.runId,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    durationMs: toDurationMs(summary.startedAt, summary.finishedAt),
    allPassed: Boolean(summary.allPassed),
    checkpointTotal: checkpoints.length,
    checkpointPassed: passedCheckpoints,
    unknownSignatureCount: summary.noiseBaseline?.unknownSignatureCount ?? null,
    hasNewNoise: summary.noiseBaseline?.hasNewNoise ?? null,
    runDir: summary.runDir || null,
    summaryPath: summary.summaryPath || null,
    noiseReportPath: summary.noiseReportPath || null,
  };
}

function upsertRuns(previousRuns, entry, maxRuns) {
  const next = previousRuns.filter((item) => item.runId !== entry.runId);
  next.push(entry);
  next.sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  return next.slice(0, maxRuns);
}

export function buildReplayRunIndex(input) {
  const nowIso = input.nowIso || (() => new Date().toISOString());
  const staleMissThreshold = Number.isInteger(input.staleMissThreshold) && input.staleMissThreshold > 0
    ? input.staleMissThreshold
    : 3;
  const maxRuns = Number.isInteger(input.maxRuns) && input.maxRuns > 0 ? input.maxRuns : 50;
  const previousIndex = input.previousIndex && typeof input.previousIndex === "object" ? input.previousIndex : {};
  const summary = input.summary;
  const noiseBaseline = summary.noiseBaseline || {};
  const consoleRuleAudit = noiseBaseline.ruleAudit?.console || {
    allRuleIds: [],
    matchedRuleIds: [],
  };
  const networkRuleAudit = noiseBaseline.ruleAudit?.network || {
    allRuleIds: [],
    matchedRuleIds: [],
  };

  const previousRuleHealth = previousIndex.ruleHealth || {};
  const consoleRuleHealth = toRuleHealthMap(
    previousRuleHealth.console || {},
    consoleRuleAudit.allRuleIds,
    consoleRuleAudit.matchedRuleIds,
    summary,
  );
  const networkRuleHealth = toRuleHealthMap(
    previousRuleHealth.network || {},
    networkRuleAudit.allRuleIds,
    networkRuleAudit.matchedRuleIds,
    summary,
  );

  const staleRules = {
    console: toStaleRules(consoleRuleHealth, staleMissThreshold),
    network: toStaleRules(networkRuleHealth, staleMissThreshold),
  };

  const previousRuns = Array.isArray(previousIndex.runs) ? previousIndex.runs : [];
  const runs = upsertRuns(previousRuns, toRunEntry(summary), maxRuns);

  return {
    version: 1,
    generatedAt: nowIso(),
    staleMissThreshold,
    maxRuns,
    latestRunId: summary.runId,
    runs,
    ruleHealth: {
      console: consoleRuleHealth,
      network: networkRuleHealth,
    },
    staleRules,
  };
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs === null) return "n/a";
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function pushStaleRules(lines, title, rules) {
  lines.push(`## ${title}`, "");
  if (rules.length === 0) {
    lines.push("- (none)", "");
    return;
  }

  for (const rule of rules) {
    const lastHit = rule.lastHitRunId ? `${rule.lastHitRunId} @ ${rule.lastHitAt}` : "never";
    lines.push(`- ${rule.id}: misses=${rule.consecutiveMisses}, totalHits=${rule.totalHits}, lastHit=${lastHit}`);
  }
  lines.push("");
}

export function renderReplayRunIndexMarkdown(index, repoRoot) {
  const lines = [
    "# P4 Session Replay Run Index",
    "",
    `- generatedAt: ${index.generatedAt}`,
    `- latestRunId: ${index.latestRunId}`,
    `- staleMissThreshold: ${index.staleMissThreshold}`,
    `- trackedRuns: ${index.runs.length}`,
    "",
    "## Recent Runs",
    "",
  ];

  if (index.runs.length === 0) {
    lines.push("- (none)", "");
  } else {
    for (const run of index.runs) {
      const summaryPath = run.summaryPath ? path.relative(repoRoot, path.resolve(repoRoot, run.summaryPath)) : "n/a";
      lines.push(
        `- ${run.runId}: pass=${run.allPassed}, checkpoints=${run.checkpointPassed}/${run.checkpointTotal}, unknownNoise=${run.unknownSignatureCount}, duration=${formatDuration(run.durationMs)}, summary=${summaryPath}`,
      );
    }
    lines.push("");
  }

  pushStaleRules(lines, "Stale Console Rules", index.staleRules.console);
  pushStaleRules(lines, "Stale Network Rules", index.staleRules.network);

  return `${lines.join("\n")}`;
}
