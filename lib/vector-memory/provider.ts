import { LocalEmbeddingClient, OpenAIEmbeddingClient } from "@/lib/vectors/embeddings";

export type ProviderKind = "openai" | "local" | "none";

export interface EmbeddingProvider {
  name: string;
  embed(text: string): Promise<number[]>;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = "local";
  private client: LocalEmbeddingClient;

  constructor(dimensions = 128) {
    this.client = new LocalEmbeddingClient(dimensions);
  }

  async embed(text: string): Promise<number[]> {
    const { embedding } = await this.client.embed(text);
    return embedding;
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = "openai";
  private client: OpenAIEmbeddingClient;

  constructor(apiKey: string, apiUrl?: string, model?: string) {
    this.client = new OpenAIEmbeddingClient({
      apiKey,
      apiUrl,
      model: model || "text-embedding-3-small",
    });
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.client.embed(text);
    return result.embedding;
  }
}

export class NoopEmbeddingProvider implements EmbeddingProvider {
  name = "noop";

  async embed(): Promise<number[]> {
    return [];
  }
}

export interface ProviderConfig {
  provider?: ProviderKind;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}

export function resolveEmbeddingProvider(config: ProviderConfig = {}): {
  provider: EmbeddingProvider;
  reason?: string;
} {
  const envProvider = (config.provider || process.env.VECTOR_MEMORY_PROVIDER) as ProviderKind | undefined;
  const providerName = envProvider || (process.env.OPENAI_API_KEY ? "openai" : "local");

  if (providerName === "none") {
    return { provider: new NoopEmbeddingProvider(), reason: "provider set to none" };
  }

  if (providerName === "openai") {
    const apiKey = config.apiKey || process.env.VECTOR_MEMORY_API_KEY || process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      return {
        provider: new LocalEmbeddingProvider(),
        reason: "missing api key for openai, fallback to local provider",
      };
    }
    return { provider: new OpenAIEmbeddingProvider(apiKey, config.apiUrl, config.model) };
  }

  return { provider: new LocalEmbeddingProvider() };
}
