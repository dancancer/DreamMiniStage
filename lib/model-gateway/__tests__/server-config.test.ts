import { describe, expect, it } from "vitest";
import {
  parseEnvText,
  resolveModelGatewayProviderConfig,
} from "@/lib/model-gateway/server-config";

describe("model gateway server config", () => {
  it("parses equal and colon env lines", () => {
    expect(parseEnvText([
      "api_key: local-key",
      "baseurl=https://api.deepseek.com",
      "model: deepseek-v4-pro",
    ].join("\n"))).toEqual({
      api_key: "local-key",
      baseurl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
    });
  });

  it("resolves explicit process env before local .env text", () => {
    const config = resolveModelGatewayProviderConfig({
      MODEL_GATEWAY_API_KEY: "server-key",
      MODEL_GATEWAY_BASE_URL: "https://server.example/v1",
      MODEL_GATEWAY_MODEL: "server-model",
    }, [
      "api_key: local-key",
      "baseurl: https://local.example/v1",
      "model: local-model",
    ].join("\n"));

    expect(config).toEqual({
      apiKey: "server-key",
      baseUrl: "https://server.example/v1",
      modelName: "server-model",
    });
  });

  it("fails fast when no server API key exists", () => {
    expect(() => resolveModelGatewayProviderConfig({}, "model: deepseek-v4-pro")).toThrow(
      "Model gateway API key is not configured",
    );
  });
});
