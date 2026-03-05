import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ANALYSIS_DIR = path.join(ROOT, "docs", "analysis");
const ASSET_ROOT = path.join(ROOT, "test-baseline-assets");

const UPSTREAM_COMMAND_ROOTS = [
  path.join(ROOT, "sillytavern-plugins", "SillyTavern", "public", "scripts"),
  path.join(ROOT, "sillytavern-plugins", "JS-Slash-Runner", "src"),
  path.join(ROOT, "sillytavern-plugins", "MagVarUpdate", "src"),
];

const REPO_SCAN_ROOTS = [
  "app",
  "components",
  "hooks",
  "lib",
  "scripts",
  "docs",
  "function",
].map((item) => path.join(ROOT, item));

const LOCAL_SLASH_USAGE_ROOTS = [
  path.join(ROOT, "app", "test-script-runner"),
  path.join(ROOT, "lib", "core", "__tests__"),
  path.join(ROOT, "lib", "slash-command", "__tests__"),
  path.join(ROOT, "hooks", "script-bridge", "__tests__"),
];

const SHIM_PATH = path.join(ROOT, "public", "iframe-libs", "slash-runner-shim.js");
const MATRIX_PATH = path.join(ROOT, "hooks", "script-bridge", "capability-matrix.ts");
const REGISTRY_PATH = path.join(ROOT, "lib", "slash-command", "registry", "index.ts");
const JS_SLASH_RUNNER_API_PATH = path.join(
  ROOT,
  "sillytavern-plugins",
  "JS-Slash-Runner",
  "src",
  "function",
  "index.ts",
);

const RELEVANT_SUFFIXES = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".json"]);
const SCAN_IGNORES = new Set(["node_modules", ".git", ".next", "out", "dist"]);

const CRITICAL_COMMAND_PREFIXES = [
  "send",
  "trigger",
  "set",
  "get",
  "add",
  "del",
  "list",
  "chat",
  "char",
  "world",
  "lore",
  "preset",
  "regex",
  "audio",
  "event",
  "gen",
  "message",
  "checkpoint",
  "branch",
  "run",
  "api",
  "if",
  "while",
  "times",
  "return",
  "abort",
  "break",
];

const CRITICAL_API_KEYWORDS = [
  "variable",
  "chat",
  "message",
  "worldbook",
  "lorebook",
  "preset",
  "regex",
  "generate",
  "audio",
  "script",
  "event",
  "character",
  "importraw",
  "trigger",
];

const KERNEL_CORE_COMMANDS = [
  "if",
  "while",
  "times",
  "return",
  "break",
  "abort",
  "parser-flag",
  "breakpoint",
  "let",
  "var",
];

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SCAN_IGNORES.has(entry.name)) continue;
      files.push(...listFiles(fullPath));
      continue;
    }

    if (RELEVANT_SUFFIXES.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function listAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SCAN_IGNORES.has(entry.name)) continue;
      files.push(...listAllFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function isGeneratedGapReport(filePath) {
  const normalized = filePath.replaceAll(path.sep, "/");
  return normalized.includes("/docs/analysis/sillytavern-gap-report-");
}

function sanitizeCommandName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) return null;
  return normalized;
}

function extractSlashCommandsFromText(text) {
  const counts = new Map();
  let cursor = 0;
  const token = "SlashCommand.fromProps(";

  while (true) {
    const start = text.indexOf(token, cursor);
    if (start === -1) break;

    let i = start + token.length;
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (text[i] !== "{") {
      cursor = i;
      continue;
    }

    const block = extractBalancedBlock(text, i, "{", "}");
    if (!block) break;
    const body = block.content;

    const nameMatch = body.match(/\bname\s*:\s*(["'`])([^"'`]+)\1/);
    if (nameMatch) {
      const command = sanitizeCommandName(nameMatch[2]);
      if (command) counts.set(command, (counts.get(command) || 0) + 1);
    }

    const aliasMatch = body.match(/\baliases\s*:\s*\[([\s\S]*?)\]/);
    if (aliasMatch) {
      const aliasText = aliasMatch[1];
      for (const aliasToken of aliasText.matchAll(/(["'`])([^"'`]+)\1/g)) {
        const alias = sanitizeCommandName(aliasToken[2]);
        if (!alias) continue;
        counts.set(alias, (counts.get(alias) || 0) + 1);
      }
    }

    cursor = block.nextIndex;
  }

  return counts;
}

function extractBalancedBlock(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(openIndex + 1, i),
          nextIndex: i + 1,
        };
      }
    }
  }

  return null;
}

function extractArrayByName(text, arrayName) {
  const marker = `export const ${arrayName} = [`;
  const start = text.indexOf(marker);
  if (start === -1) return [];
  const listStart = start + marker.length - 1;
  const block = extractBalancedBlock(text, listStart, "[", "]");
  if (!block) return [];

  const values = [];
  for (const match of block.content.matchAll(/"([^"]+)"/g)) {
    values.push(match[1]);
  }
  return values;
}

function extractRegistryCommands(text) {
  const values = [];
  for (const match of text.matchAll(/\["([^"]+)"\s*,/g)) {
    const command = sanitizeCommandName(match[1]);
    if (command) values.push(command);
  }
  return uniqueSorted(values);
}

function extractTopLevelObjectKeys(text, assignmentToken) {
  const tokenIndex = text.indexOf(assignmentToken);
  if (tokenIndex === -1) return { keys: [], unsupported: [] };
  const braceIndex = text.indexOf("{", tokenIndex + assignmentToken.length);
  if (braceIndex === -1) return { keys: [], unsupported: [] };

  const block = extractBalancedBlock(text, braceIndex, "{", "}");
  if (!block) return { keys: [], unsupported: [] };

  const keys = [];
  const unsupported = [];
  for (const line of block.content.split("\n")) {
    const direct = line.match(/^\s{4}([A-Za-z0-9_.$]+)\s*:\s*(.+)$/);
    if (!direct) continue;
    const key = direct[1];
    keys.push(key);
    if (direct[2].includes("unsupportedAsync") || direct[2].includes("unsupportedSync")) {
      unsupported.push(key);
    }
  }

  return {
    keys: uniqueSorted(keys),
    unsupported: uniqueSorted(unsupported),
  };
}

function extractJsSlashRunnerFacade(text) {
  const functionIndex = text.indexOf("function getTavernHelper()");
  if (functionIndex === -1) return { keys: [], unsupported: [] };

  const returnIndex = text.indexOf("return {", functionIndex);
  if (returnIndex === -1) return { keys: [], unsupported: [] };

  const braceIndex = text.indexOf("{", returnIndex);
  if (braceIndex === -1) return { keys: [], unsupported: [] };

  const block = extractBalancedBlock(text, braceIndex, "{", "}");
  if (!block) return { keys: [], unsupported: [] };

  const keys = [];
  for (const line of block.content.split("\n")) {
    const withValue = line.match(/^\s{4}([A-Za-z0-9_.$]+)\s*:/);
    if (withValue) {
      keys.push(withValue[1]);
      continue;
    }

    const shorthand = line.match(/^\s{4}([A-Za-z0-9_.$]+)\s*,\s*$/);
    if (shorthand) {
      keys.push(shorthand[1]);
    }
  }

  return {
    keys: uniqueSorted(keys),
    unsupported: [],
  };
}

function extractShimApiMethods(text) {
  const methods = new Set();
  for (const match of text.matchAll(/api\("([^"]+)"\)/g)) {
    methods.add(match[1]);
  }
  for (const match of text.matchAll(/callApi\("([^"]+)"\s*,/g)) {
    methods.add(match[1]);
  }
  return uniqueSorted(Array.from(methods));
}

function extractSlashUsageInLocalRepo(files) {
  const counts = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/\/([a-z0-9][a-z0-9-]*)(?=[\s|:{)}\]]|$)/gi)) {
      const command = sanitizeCommandName(match[1]);
      if (!command) continue;
      counts.set(command, (counts.get(command) || 0) + 1);
    }
  }
  return counts;
}

function scoreMissingCommand(command, upstreamCount, localUsageCount) {
  let score = upstreamCount * 2 + localUsageCount * 5;
  if (CRITICAL_COMMAND_PREFIXES.some((prefix) => command.startsWith(prefix))) {
    score += 3;
  }
  if (command.includes("world") || command.includes("lore") || command.includes("regex")) {
    score += 1;
  }

  if (score >= 10) return { score, priority: "P1" };
  if (score >= 5) return { score, priority: "P2" };
  return { score, priority: "P3" };
}

function scoreMissingApi(name, unsupported) {
  const lower = name.toLowerCase();
  let score = unsupported ? 8 : 2;
  if (CRITICAL_API_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    score += 3;
  }

  if (score >= 8) return { score, priority: "P1" };
  if (score >= 5) return { score, priority: "P2" };
  return { score, priority: "P3" };
}

function collectAssetCoverage(scanFiles) {
  const assetFiles = listAllFiles(ASSET_ROOT)
    .filter((file) => !file.endsWith(".DS_Store"))
    .map((file) => path.relative(ROOT, file).replaceAll(path.sep, "/"));

  const coverage = [];
  for (const assetPath of assetFiles) {
    const assetBaseName = path.basename(assetPath);
    let totalHits = 0;
    let testHits = 0;
    let scenarioHits = 0;

    for (const file of scanFiles) {
      const text = fs.readFileSync(file, "utf8");
      const hasFullPath = text.includes(assetPath);
      const hasBaseName = text.includes(assetBaseName);
      if (!hasFullPath && !hasBaseName) continue;

      totalHits += 1;
      const normalized = file.replaceAll(path.sep, "/");
      if (normalized.includes("__tests__") || normalized.endsWith(".test.ts") || normalized.endsWith(".test.tsx")) {
        testHits += 1;
      }
      if (normalized.endsWith("app/test-script-runner/scenarios.ts")) {
        scenarioHits += 1;
      }
    }

    coverage.push({
      asset: assetPath,
      referencedFiles: totalHits,
      testReferences: testHits,
      scenarioReferences: scenarioHits,
      status: totalHits > 0 ? "covered" : "uncovered",
    });
  }

  coverage.sort((a, b) => a.asset.localeCompare(b.asset));
  return coverage;
}

function collectAssetDirectoryHealth() {
  const expectedDirs = [
    "character-card",
    "preset",
    "worldbook",
    "regex-scripts",
    "slash-scripts",
    "mvu-examples",
  ];

  const health = [];
  for (const name of expectedDirs) {
    const fullPath = path.join(ASSET_ROOT, name);
    if (!fs.existsSync(fullPath)) {
      health.push({ dir: name, status: "missing", fileCount: 0 });
      continue;
    }

    const files = listAllFiles(fullPath).filter((file) => !file.endsWith(".DS_Store"));
    health.push({
      dir: name,
      status: files.length === 0 ? "empty" : "ready",
      fileCount: files.length,
    });
  }

  return health;
}

function buildMarkdown(report, outputRelPath) {
  const lines = [];
  lines.push("# SillyTavern Gap Report (Auto)");
  lines.push("");
  lines.push(`- generatedAt: ${report.generatedAt}`);
  lines.push(`- source: \`${outputRelPath}\``);
  lines.push("");

  lines.push("## Coverage Snapshot");
  lines.push("");
  lines.push(`- slash commands: ${report.slash.covered}/${report.slash.upstreamTotal} (${report.slash.coverage})`);
  lines.push(`- script bridge API matrix: ${report.apiMatrix.covered}/${report.apiMatrix.upstreamShimTotal} (${report.apiMatrix.coverage})`);
  lines.push(`- JS-Slash-Runner TavernHelper facade: ${report.apiFacade.covered}/${report.apiFacade.upstreamTotal} (${report.apiFacade.coverage})`);
  lines.push("");

  lines.push("## Priority Command Gaps (Top 25)");
  lines.push("");
  for (const item of report.slash.missingTop.slice(0, 25)) {
    lines.push(`- [${item.priority}] /${item.command} (score=${item.score}, upstreamRefs=${item.upstreamRefs}, localRefs=${item.localRefs})`);
  }
  lines.push("");

  lines.push("## Priority API Gaps (Top 25)");
  lines.push("");
  for (const item of report.apiFacade.missingTop.slice(0, 25)) {
    const unsupportedTag = item.unsupportedInShim ? "unsupported-in-shim" : "missing-in-shim";
    lines.push(`- [${item.priority}] ${item.name} (score=${item.score}, ${unsupportedTag})`);
  }
  lines.push("");

  lines.push("## Baseline Asset Coverage");
  lines.push("");
  for (const item of report.assets.coverage) {
    lines.push(`- ${item.status === "covered" ? "[covered]" : "[uncovered]"} ${item.asset} (refs=${item.referencedFiles}, tests=${item.testReferences}, scenarios=${item.scenarioReferences})`);
  }
  lines.push("");

  lines.push("## Asset Directory Health");
  lines.push("");
  for (const item of report.assets.directoryHealth) {
    lines.push(`- ${item.dir}: ${item.status} (files=${item.fileCount})`);
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const upstreamCommandCounts = new Map();
  for (const root of UPSTREAM_COMMAND_ROOTS) {
    for (const file of listFiles(root)) {
      const text = fs.readFileSync(file, "utf8");
      const counts = extractSlashCommandsFromText(text);
      for (const [command, count] of counts.entries()) {
        upstreamCommandCounts.set(command, (upstreamCommandCounts.get(command) || 0) + count);
      }
    }
  }

  const matrixText = fs.readFileSync(MATRIX_PATH, "utf8");
  const matrixSlashCommands = uniqueSorted(extractArrayByName(matrixText, "SLASH_COMMAND_MATRIX").map(sanitizeCommandName).filter(Boolean));
  const registryCommands = extractRegistryCommands(fs.readFileSync(REGISTRY_PATH, "utf8"));
  const localCommandSet = new Set([...matrixSlashCommands, ...registryCommands, ...KERNEL_CORE_COMMANDS]);

  const scanFiles = REPO_SCAN_ROOTS
    .flatMap((dir) => listFiles(dir))
    .filter((file) => !isGeneratedGapReport(file));
  const slashUsageFiles = LOCAL_SLASH_USAGE_ROOTS
    .flatMap((dir) => listFiles(dir))
    .filter((file) => !isGeneratedGapReport(file));
  const localSlashUsage = extractSlashUsageInLocalRepo(slashUsageFiles);

  const upstreamCommands = uniqueSorted(Array.from(upstreamCommandCounts.keys()));
  const coveredCommands = upstreamCommands.filter((command) => localCommandSet.has(command));
  const missingCommands = upstreamCommands.filter((command) => !localCommandSet.has(command));

  const missingCommandsRanked = missingCommands
    .map((command) => {
      const upstreamRefs = upstreamCommandCounts.get(command) || 0;
      const localRefs = localSlashUsage.get(command) || 0;
      const scored = scoreMissingCommand(command, upstreamRefs, localRefs);
      return {
        command,
        upstreamRefs,
        localRefs,
        score: scored.score,
        priority: scored.priority,
      };
    })
    .sort((a, b) => b.score - a.score || b.upstreamRefs - a.upstreamRefs || a.command.localeCompare(b.command));

  const shimText = fs.readFileSync(SHIM_PATH, "utf8");
  const shimApiMethods = extractShimApiMethods(shimText);
  const matrixApiMethods = extractArrayByName(matrixText, "SCRIPT_BRIDGE_API_MATRIX");

  const shimFacade = extractTopLevelObjectKeys(shimText, "window.TavernHelper =");
  const upstreamApiFacade = extractJsSlashRunnerFacade(fs.readFileSync(JS_SLASH_RUNNER_API_PATH, "utf8"));

  const shimFacadeSet = new Set(shimFacade.keys);
  const upstreamFacadeSet = new Set(upstreamApiFacade.keys);

  const missingFacade = uniqueSorted(Array.from(upstreamFacadeSet).filter((name) => !shimFacadeSet.has(name)));
  const unsupportedFacade = uniqueSorted(Array.from(upstreamFacadeSet).filter((name) => shimFacade.unsupported.includes(name)));

  const missingFacadeRanked = uniqueSorted([...missingFacade, ...unsupportedFacade])
    .map((name) => {
      const unsupportedInShim = unsupportedFacade.includes(name);
      const scored = scoreMissingApi(name, unsupportedInShim);
      return {
        name,
        unsupportedInShim,
        score: scored.score,
        priority: scored.priority,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const assetCoverage = collectAssetCoverage(scanFiles);
  const assetDirHealth = collectAssetDirectoryHealth();

  const now = new Date();
  const dateTag = now.toISOString().slice(0, 10);

  const report = {
    generatedAt: now.toISOString(),
    slash: {
      upstreamTotal: upstreamCommands.length,
      covered: coveredCommands.length,
      coverage: `${((coveredCommands.length / Math.max(1, upstreamCommands.length)) * 100).toFixed(2)}%`,
      missingTop: missingCommandsRanked,
    },
    apiMatrix: {
      upstreamShimTotal: shimApiMethods.length,
      covered: matrixApiMethods.length,
      coverage: `${((matrixApiMethods.length / Math.max(1, shimApiMethods.length)) * 100).toFixed(2)}%`,
    },
    apiFacade: {
      upstreamTotal: upstreamApiFacade.keys.length,
      covered: upstreamApiFacade.keys.length - missingFacade.length,
      coverage: `${(((upstreamApiFacade.keys.length - missingFacade.length) / Math.max(1, upstreamApiFacade.keys.length)) * 100).toFixed(2)}%`,
      missingTop: missingFacadeRanked,
    },
    assets: {
      coverage: assetCoverage,
      directoryHealth: assetDirHealth,
    },
  };

  fs.mkdirSync(ANALYSIS_DIR, { recursive: true });

  const jsonPath = path.join(ANALYSIS_DIR, `sillytavern-gap-report-${dateTag}.json`);
  const mdPath = path.join(ANALYSIS_DIR, `sillytavern-gap-report-${dateTag}.md`);
  const latestJsonPath = path.join(ANALYSIS_DIR, "sillytavern-gap-report-latest.json");
  const latestMdPath = path.join(ANALYSIS_DIR, "sillytavern-gap-report-latest.md");

  const jsonText = `${JSON.stringify(report, null, 2)}\n`;
  const mdText = buildMarkdown(report, path.relative(ROOT, jsonPath).replaceAll(path.sep, "/"));

  fs.writeFileSync(jsonPath, jsonText);
  fs.writeFileSync(mdPath, mdText);
  fs.writeFileSync(latestJsonPath, jsonText);
  fs.writeFileSync(latestMdPath, mdText);

  const missingAssets = assetCoverage.filter((item) => item.status === "uncovered").map((item) => item.asset);
  const dirIssues = assetDirHealth.filter((item) => item.status !== "ready");

  console.log(`[gap-report] wrote ${path.relative(ROOT, mdPath)}`);
  console.log(`[gap-report] slash coverage ${report.slash.coverage}`);
  console.log(`[gap-report] api matrix coverage ${report.apiMatrix.coverage}`);
  console.log(`[gap-report] api facade coverage ${report.apiFacade.coverage}`);
  console.log(`[gap-report] uncovered assets: ${missingAssets.length}`);
  console.log(`[gap-report] asset dir issues: ${dirIssues.length}`);
}

main();
