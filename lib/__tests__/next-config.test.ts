import { afterEach, describe, expect, test, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;

async function loadConfig(nodeEnv?: string) {
  vi.resetModules();

  if (nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = nodeEnv;
  }

  return (await import("../../next.config.ts")).default;
}

afterEach(() => {
  vi.resetModules();

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }

  process.env.NODE_ENV = originalNodeEnv;
});

describe("next.config", () => {
  test("does not expose webpack config in development", async () => {
    const config = await loadConfig("development");

    expect("webpack" in config).toBe(false);
  });

  test("keeps the webpack wrapper for production builds", async () => {
    const config = await loadConfig("production");

    expect(typeof (config as { webpack?: unknown }).webpack).toBe("function");
  });
});
