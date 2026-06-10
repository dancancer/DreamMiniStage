import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const APP_URL = process.env.APP_URL ?? "http://localhost:3303";
const OUT_DIR = path.join(ROOT, "docs/analysis/artifacts");
const PREFIX = "2026-06-04-story-agent-browser-state-render";

const FILES = {
  summary: path.join(OUT_DIR, `${PREFIX}-summary.json`),
  initial: path.join(OUT_DIR, `${PREFIX}-initial.png`),
  final: path.join(OUT_DIR, `${PREFIX}-final.png`),
  regex: path.join(OUT_DIR, `${PREFIX}-dashboard-regex.json`),
  request: (index) => path.join(OUT_DIR, `${PREFIX}-request-${index}.json`),
};

const MODEL_CONFIG = {
  id: "story-agent-e2e-model",
  name: "Story Agent E2E Gateway",
  type: "openai",
  baseUrl: "https://provider.invalid/v1",
  model: "deepseek-v4-pro",
  apiKey: "browser-secret-should-not-leave",
  availableModels: ["deepseek-v4-pro"],
  advanced: {
    contextWindow: 32000,
    maxTokens: 8192,
    streaming: false,
    streamUsage: false,
    temperature: 0.2,
  },
};

const TURNS = [
  {
    input: "E2E 第一轮：我停下来听素世说完，不催她。",
    marker: "E2E-TURN-1",
    delta: 3,
    location: "赤羽后巷",
    time: "17:05",
    meter: "42",
  },
  {
    input: "E2E 第二轮：我把伞递给素世，继续保持距离。",
    marker: "E2E-TURN-2",
    delta: 2,
    location: "RiNG 后台",
    time: "17:18",
    meter: "57",
  },
  {
    input: "E2E 第三轮：我确认她可以自己决定下一步。",
    marker: "E2E-TURN-3",
    delta: 1,
    location: "月之森门口",
    time: "17:36",
    meter: "64",
  },
];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await writeDashboardRegexFixture();

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(seedBrowserStorage, MODEL_CONFIG);
  const page = await context.newPage();
  const gatewayRequests = [];

  await page.route("**/api/model-gateway/chat-completions", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    gatewayRequests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      body,
    });

    const turn = TURNS[Math.min(gatewayRequests.length - 1, TURNS.length - 1)];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { content: assistantResponse(turn) } }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }),
    });
  });

  await importStoryAgent(page);
  await page.screenshot({ path: FILES.initial, fullPage: true });

  for (let index = 0; index < TURNS.length; index += 1) {
    await sendTurn(page, TURNS[index]);
    await fs.writeFile(
      FILES.request(index + 1),
      JSON.stringify(gatewayRequests[index]?.body ?? null, null, 2),
    );
  }

  await scrollToBottom(page);
  await page.screenshot({ path: FILES.final, fullPage: true });
  const summary = await buildSummary(page, gatewayRequests);
  await fs.writeFile(FILES.summary, JSON.stringify(summary, null, 2));
  await browser.close();

  if (summary.failures.length > 0) {
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(summary, null, 2));
}

function seedBrowserStorage(config) {
  const state = {
    state: {
      configs: [config],
      activeConfigId: config.id,
    },
    version: 0,
  };
  localStorage.setItem("model-config-storage", JSON.stringify(state));
  localStorage.setItem("fastModelEnabled", "false");
  localStorage.setItem("modelStreamingEnabled", "false");
  localStorage.setItem("modelStreamUsageEnabled", "false");
}

async function writeDashboardRegexFixture() {
  const fixture = {
    source: "story-agent-browser-state-render-e2e",
    description: "Safe custom status dashboard fixture for Story Agent browser E2E",
    scripts: [{
      id: "story-agent-e2e-status-dashboard",
      scriptName: "E2E Status Dashboard",
      disabled: false,
      runOnEdit: true,
      findRegex: "<StatusDashboard>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StatusDashboard>",
      replaceString: "<div class=\"status-panel\"><div data-field=\"dashboard\">$1</div></div>",
      trimStrings: [],
      placement: [1, 2],
      substituteRegex: 0,
      minDepth: null,
      maxDepth: null,
      markdownOnly: true,
      promptOnly: false,
    }],
  };
  await fs.writeFile(FILES.regex, JSON.stringify(fixture, null, 2));
}

async function importStoryAgent(page) {
  await page.goto(`${APP_URL}/story-agent-import`, { waitUntil: "networkidle" });
  const inputs = page.locator("input[type='file']");
  await inputs.nth(0).setInputFiles(asset("test-baseline-assets/character-card/Sgw3.png"));
  await inputs.nth(1).setInputFiles(asset("test-baseline-assets/preset/明月秋青v3.94.json"));
  await inputs.nth(3).setInputFiles([
    asset("test-baseline-assets/regex-scripts/sgw3-sample.json"),
    FILES.regex,
  ]);

  await page.getByRole("button", { name: /检查资产|Inspect Assets/ }).click();
  await page.getByText(/UI 渲染规则|Render rules/).waitFor({ timeout: 60000 });
  await confirmIfNeeded(page);
  await page.getByRole("button", { name: /创建 Agent|Create Agent/ }).click();
  const enterSession = page.getByRole("button", { name: /进入会话|Enter Session/ });
  await enterSession.waitFor({ timeout: 60000 });
  await enterSession.click();
  await page.locator("#send_textarea").waitFor({ timeout: 60000 });
}

async function confirmIfNeeded(page) {
  const checkbox = page.getByRole("checkbox").first();
  if (await checkbox.count() === 0) return;
  const checked = await checkbox.getAttribute("aria-checked");
  if (checked !== "true") await checkbox.click();
}

async function sendTurn(page, turn) {
  await page.locator("#send_textarea").fill(turn.input);
  const response = page.waitForResponse((item) =>
    item.url().includes("/api/model-gateway/chat-completions")
    && item.request().method() === "POST",
  );
  await page.getByRole("button", { name: /发送|Send/ }).click();
  await response;
  await page.getByText(turn.marker).first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => {
    const input = document.querySelector("#send_textarea");
    return input && !input.disabled;
  });
}

async function scrollToBottom(page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    for (const element of document.querySelectorAll("*")) {
      if (element.scrollHeight > element.clientHeight) {
        element.scrollTop = element.scrollHeight;
      }
    }
  });
  await page.waitForTimeout(300);
}

function assistantResponse(turn) {
  const sfw = {
    mode: "sfw",
    date: "2020年3月28日",
    time: turn.time,
    location: turn.location,
    characters: [{
      name: "长崎素世",
      status: "谨慎放松",
      relation: "信任正在上升",
      pose: "侧身站着，手指轻扣伞柄",
      clothing: "月之森制服",
      location: turn.location,
      avatar: null,
      portrait: null,
      thought: "(他没有逼我立刻回答。)",
    }],
  };
  const dashboard = {
    date: "2020年3月28日",
    time: turn.time,
    location: turn.location,
    characters: [],
    sections: [
      {
        title: "战术资源",
        fields: [
          { label: "EP", value: "5000", description: "应急资金保持可用" },
          { label: "线索", value: turn.marker, description: "本轮浏览器验证标记" },
        ],
      },
      {
        title: "队伍节奏",
        fields: [
          { label: "当前阶段", value: "排演" },
          { label: "叙事压力", value: "低" },
        ],
      },
    ],
    meters: [
      { label: "稳定度", value: turn.meter, max: "100", unit: "%", description: "多轮状态仪表" },
      { label: "信任", value: String(Number(turn.meter) - 12), max: "100", unit: "%" },
    ],
  };

  return [
    `${turn.marker} ${turn.location}｜2020年3月28日｜星期六｜${turn.time}`,
    "素世把伞柄向内收了收，终于愿意把视线停在你身上。",
    `<SFW>${JSON.stringify(sfw)}</SFW>`,
    `<StatusDashboard>${JSON.stringify(dashboard)}</StatusDashboard>`,
    "<UpdateVariable>",
    `_.add('长崎素世.好感度', ${turn.delta});`,
    "</UpdateVariable>",
  ].join("\n");
}

async function buildSummary(page, gatewayRequests) {
  const requestSummaries = gatewayRequests.map((request, index) =>
    summarizeRequest(request.body, TURNS[index]?.input ?? ""));
  const text = await page.locator("body").innerText();
  const ui = {
    statusPanelCount: await page.getByText("Story Status").count(),
    sfwCharacterVisible: text.includes("长崎素世") && text.includes("信任正在上升"),
    customSectionsVisible: text.includes("战术资源") && text.includes("队伍节奏"),
    metersVisible: text.includes("稳定度") && text.includes("信任"),
    rawTagsVisible: /<SFW>|<StatusDashboard>|<UpdateVariable>/i.test(text),
    stateTupleVisible: text.includes("长崎素世.好感度") && text.includes("= 6"),
    rawStateJsonVisible: /\{"\$meta"|"好感度":\[6/.test(text),
    finalMarkerVisible: text.includes(TURNS.at(-1).marker),
  };
  const failures = failuresFor(requestSummaries, ui, gatewayRequests);
  return {
    appUrl: APP_URL,
    card: "Sgw3",
    mockedRoute: "**/api/model-gateway/chat-completions",
    requestCount: gatewayRequests.length,
    requestSummaries,
    ui,
    failures,
    artifacts: {
      initialScreenshot: relative(FILES.initial),
      finalScreenshot: relative(FILES.final),
      customRegex: relative(FILES.regex),
      requests: TURNS.map((_turn, index) => relative(FILES.request(index + 1))),
      summary: relative(FILES.summary),
    },
  };
}

function summarizeRequest(body, currentInput) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const prompt = messages.map((message) => String(message.content ?? "")).join("\n\n");
  const stateBlocks = extractStateBlocks(prompt);
  const state = stateBlocks[0] ? parseJson(stateBlocks[0]) : null;
  return {
    model: body?.model ?? null,
    stream: body?.stream ?? null,
    maxTokens: body?.max_tokens ?? null,
    messageCount: messages.length,
    roleCounts: roleCounts(messages),
    browserBodyHasApiKey: Object.prototype.hasOwnProperty.call(body ?? {}, "apiKey"),
    browserBodyHasBaseUrl: Object.prototype.hasOwnProperty.call(body ?? {}, "baseUrl"),
    currentInputIsLastUserMessage: messages.at(-1)?.role === "user"
      && String(messages.at(-1)?.content ?? "").includes(currentInput),
    stateBlockCount: stateBlocks.length,
    soyoAffinity: readSoyoAffinity(state),
    renderContractMentionsSfw: prompt.includes("<SFW>"),
    renderContractMentionsCustomDashboard: prompt.includes("<StatusDashboard>")
      && prompt.includes("sections")
      && prompt.includes("meters"),
    rawLegacyStatEcho: prompt.includes("get_message_variable::stat_data"),
  };
}

function failuresFor(requests, ui, gatewayRequests) {
  const failures = [];
  const expectedAffinity = [0, 3, 5];
  if (gatewayRequests.length !== 3) failures.push(`expected 3 gateway requests, got ${gatewayRequests.length}`);
  requests.forEach((request, index) => {
    if (request.stateBlockCount !== 1) failures.push(`turn ${index + 1}: expected one state block`);
    if (request.soyoAffinity !== expectedAffinity[index]) {
      failures.push(`turn ${index + 1}: expected Soyo affinity ${expectedAffinity[index]}, got ${request.soyoAffinity}`);
    }
    if (!request.currentInputIsLastUserMessage) failures.push(`turn ${index + 1}: current input is not last user message`);
    if (request.browserBodyHasApiKey) failures.push(`turn ${index + 1}: browser body leaked apiKey`);
    if (request.browserBodyHasBaseUrl) failures.push(`turn ${index + 1}: browser body leaked baseUrl`);
    if (!request.renderContractMentionsSfw) failures.push(`turn ${index + 1}: missing SFW render contract`);
    if (!request.renderContractMentionsCustomDashboard) failures.push(`turn ${index + 1}: missing custom dashboard render contract`);
    if (request.rawLegacyStatEcho) failures.push(`turn ${index + 1}: legacy stat_data echo leaked`);
  });
  if (ui.statusPanelCount < 2) failures.push(`expected at least 2 rendered status panels, got ${ui.statusPanelCount}`);
  if (!ui.sfwCharacterVisible) failures.push("SFW character panel was not visible");
  if (!ui.customSectionsVisible) failures.push("custom dashboard sections were not visible");
  if (!ui.metersVisible) failures.push("custom dashboard meters were not visible");
  if (ui.rawTagsVisible) failures.push("raw source tags leaked into visible text");
  if (!ui.stateTupleVisible) failures.push("Story State tuple was not rendered as a readable field");
  if (ui.rawStateJsonVisible) failures.push("Story State snapshot leaked raw JSON into visible text");
  if (!ui.finalMarkerVisible) failures.push("final turn marker was not visible");
  return failures;
}

function extractStateBlocks(prompt) {
  return Array.from(prompt.matchAll(/<status_current_variables>\s*(\{[\s\S]*?\})\s*<\/status_current_variables>/g))
    .map((match) => match[1] ?? "");
}

function readSoyoAffinity(state) {
  const value = state?.["长崎素世"]?.["好感度"];
  return Array.isArray(value) ? value[0] : value;
}

function roleCounts(messages) {
  return messages.reduce((counts, message) => ({
    ...counts,
    [message.role]: (counts[message.role] ?? 0) + 1,
  }), {});
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asset(relativePath) {
  return path.join(ROOT, relativePath);
}

function relative(absolutePath) {
  return path.relative(ROOT, absolutePath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
