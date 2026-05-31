export interface ModelGatewayProviderConfig {
  apiKey: string;
  baseUrl: string;
  modelName?: string;
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export function resolveModelGatewayProviderConfig(
  env: Record<string, string | undefined> = process.env,
  localEnvText?: string,
): ModelGatewayProviderConfig {
  const local = parseEnvText(localEnvText ?? "");
  const apiKey = firstEnvValue(env, local, [
    "MODEL_GATEWAY_API_KEY",
    "MODEL_API_KEY",
    "DEEPSEEK_API_KEY",
    "OPENAI_API_KEY",
    "api_key",
    "apiKey",
  ]);
  const baseUrl = firstEnvValue(env, local, [
    "MODEL_GATEWAY_BASE_URL",
    "MODEL_BASE_URL",
    "DEEPSEEK_BASE_URL",
    "OPENAI_BASE_URL",
    "baseurl",
    "baseUrl",
  ]) || DEFAULT_OPENAI_BASE_URL;
  const modelName = firstEnvValue(env, local, [
    "MODEL_GATEWAY_MODEL",
    "MODEL_NAME",
    "DEEPSEEK_MODEL",
    "OPENAI_MODEL",
    "model",
  ]);

  if (!apiKey) {
    throw new Error("Model gateway API key is not configured");
  }

  return {
    apiKey,
    baseUrl,
    modelName,
  };
}

export function parseEnvText(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(.*)$/);
    if (!match) continue;
    values[match[1]] = unquote(match[2].trim());
  }
  return values;
}

function firstEnvValue(
  env: Record<string, string | undefined>,
  local: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = env[key] ?? local[key];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}
