import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasCommand } from "@/lib/slash-command/registry";

import { variableHandlers } from "../variable-handlers";
import { worldbookHandlers } from "../worldbook-handlers";
import { lorebookHandlers } from "../lorebook-handlers";
import { presetHandlers } from "../preset-handlers";
import { generationHandlers } from "../generation-handlers";
import { messageHandlers } from "../message-handlers";
import { mvuHandlers } from "../mvu-handlers";
import { slashHandlers } from "../slash-handlers";
import { eventHandlers } from "../event-handlers";
import { extensionHandlers } from "../extension-handlers";
import { quickReplyHandlers } from "../quickreply-handlers";
import { characterHandlers } from "../character-handlers";
import { audioHandlers } from "../audio-handlers";
import { toolHandlers } from "../tool-handlers";
import { compatHandlers } from "../compat-handlers";
import {
  SCRIPT_BRIDGE_API_MATRIX,
  SLASH_COMMAND_MATRIX,
} from "../capability-matrix";

const SHIM_PATH = path.resolve(process.cwd(), "public/iframe-libs/slash-runner-shim.js");

function getShimApiMethods(source: string): string[] {
  const methods = new Set<string>();
  const apiMethodPattern = /api\("([^"]+)"\)/g;
  const directCallPattern = /callApi\("([^"]+)"\s*,/g;

  for (const match of source.matchAll(apiMethodPattern)) {
    methods.add(match[1]);
  }

  for (const match of source.matchAll(directCallPattern)) {
    methods.add(match[1]);
  }

  return Array.from(methods).sort();
}

function getRegisteredHandlerMethods(): Set<string> {
  return new Set(
    Object.keys({
      ...variableHandlers,
      ...worldbookHandlers,
      ...lorebookHandlers,
      ...presetHandlers,
      ...generationHandlers,
      ...messageHandlers,
      ...mvuHandlers,
      ...slashHandlers,
      ...eventHandlers,
      ...extensionHandlers,
      ...quickReplyHandlers,
      ...characterHandlers,
      ...audioHandlers,
      ...toolHandlers,
      ...compatHandlers,
    }),
  );
}

describe("script bridge api surface", () => {
  it("keeps shim api methods aligned with registered handlers", () => {
    const source = readFileSync(SHIM_PATH, "utf8");
    const shimMethods = getShimApiMethods(source);
    const handlerMethods = getRegisteredHandlerMethods();

    const missingHandlers = shimMethods.filter((method) => !handlerMethods.has(method));

    expect(missingHandlers).toEqual([]);
  });

  it("keeps capability matrix aligned with shim and handlers", () => {
    const source = readFileSync(SHIM_PATH, "utf8");
    const shimMethods = new Set(getShimApiMethods(source));
    const handlerMethods = getRegisteredHandlerMethods();

    const missingFromShim = SCRIPT_BRIDGE_API_MATRIX.filter((method) => !shimMethods.has(method));
    const missingFromHandlers = SCRIPT_BRIDGE_API_MATRIX.filter((method) => !handlerMethods.has(method));

    expect(missingFromShim).toEqual([]);
    expect(missingFromHandlers).toEqual([]);
  });

  it("keeps slash command matrix aligned with registry", () => {
    const missingCommands = SLASH_COMMAND_MATRIX.filter((command) => !hasCommand(command));
    expect(missingCommands).toEqual([]);
  });
});
