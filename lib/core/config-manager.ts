/**
 * LLM Configuration interface
 */
import { getString, setString } from "@/lib/storage/client-storage";
export interface LLMConfig {
  model_name: string;
  api_key: string;
  base_url?: string;
  llm_type: "openai" | "ollama" | "gemini";
  temperature: number;
  max_tokens?: number;
  tavily_api_key?: string;
  jina_api_key?: string;
  fal_api_key?: string;
}

/**
 * Configuration Manager
 * Provides centralized access to configuration without file system dependencies
 * Configuration is now passed as parameters from external sources (e.g., localStorage)
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: LLMConfig = {
    model_name: "",
    api_key: "",
    llm_type: "openai",
    temperature: 0.7,
    max_tokens: 4000,
    tavily_api_key: "",
    jina_api_key: "",
    fal_api_key: "",
  };

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Set configuration from external source (e.g., localStorage)
   * @param config Configuration object from external source
   */
  setConfig(config: LLMConfig): void {
    this.config = { ...config };
  }

  /**
   * Get LLM configuration for tool execution
   * Combines defaults with command line overrides
   */
  getLLMConfig(overrides?: {
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    type?: "openai" | "ollama" | "gemini";
  }): LLMConfig {
    const llmType = overrides?.type || this.config.llm_type;
    const model = overrides?.model || this.config.model_name;
    const apiKey = overrides?.apiKey || this.config.api_key;
    const baseUrl = overrides?.baseUrl || this.config.base_url;

    if (!model) {
      throw new Error("LLM model not configured. Please configure your AI model settings.");
    }

    if ((llmType === "openai" || llmType === "gemini") && !apiKey) {
      throw new Error("Remote LLM API key not configured. Please configure your API key.");
    }

    return {
      llm_type: llmType,
      model_name: model,
      api_key: apiKey || "",
      base_url: baseUrl || (llmType === "ollama" ? "http://localhost:11434" : (llmType === "gemini" ? process.env.NEXT_PUBLIC_GEMINI_API_BASE_URL : undefined)),
      temperature: this.config.temperature,
      max_tokens: this.config.max_tokens,
      tavily_api_key: this.config.tavily_api_key || "",
      jina_api_key: this.config.jina_api_key || "",
      fal_api_key: this.config.fal_api_key || "",
    };
  }

  /**
   * Check if configuration is complete
   */
  isConfigured(): boolean {
    const hasBasicConfig = !!(this.config.llm_type && this.config.model_name);
    const hasApiKey = this.config.llm_type === "ollama" || !!this.config.api_key;
    
    return hasBasicConfig && hasApiKey;
  }
}

/**
 * Utility functions for Web environment
 * These functions handle localStorage integration for LLM configuration
 */

/**
 * Load configuration from localStorage
 * This function should be called from the UI layer
 */
export function loadConfigFromLocalStorage(): LLMConfig {
  try {
    const llmType = getString("llmType") as "openai" | "ollama" | "gemini" | "";
    const openaiModel = getString("openaiModel");
    const ollamaModel = getString("ollamaModel");
    const geminiModel = getString("geminiModel");
    const openaiApiKey = getString("openaiApiKey");
    const geminiApiKey = getString("geminiApiKey");
    const openaiBaseUrl = getString("openaiBaseUrl");
    const ollamaBaseUrl = getString("ollamaBaseUrl");
    const geminiBaseUrl = getString("geminiBaseUrl");
    const temperature = getString("temperature");
    const maxTokens = getString("maxTokens");
    const tavilyApiKey = getString("tavilyApiKey");
    const jinaApiKey = getString("jinaApiKey");
    const falApiKey = getString("falApiKey");

    const modelName =
      llmType === "ollama"
        ? ollamaModel || ""
        : llmType === "gemini"
          ? geminiModel || ""
          : openaiModel || "";

    const apiKey =
      llmType === "ollama"
        ? ""
        : llmType === "gemini"
          ? geminiApiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
          : openaiApiKey || process.env.OPENAI_API_KEY || "";

    const baseUrl =
      llmType === "ollama"
        ? ollamaBaseUrl || ""
        : llmType === "gemini"
          ? geminiBaseUrl || process.env.NEXT_PUBLIC_GEMINI_API_BASE_URL || ""
          : openaiBaseUrl || "";

    const config: LLMConfig = {
      llm_type: llmType || "openai",
      model_name: modelName,
      api_key: apiKey,
      base_url: baseUrl,
      temperature: temperature ? parseFloat(temperature) : 0.7,
      max_tokens: maxTokens ? parseInt(maxTokens) : 4000,
      tavily_api_key: tavilyApiKey || process.env.NEXT_PUBLIC_TAVILY_API_KEY || "",
      jina_api_key: jinaApiKey || process.env.NEXT_PUBLIC_JINA_API_KEY || "",
      fal_api_key: falApiKey || process.env.NEXT_PUBLIC_FAL_API_KEY || "",
    };
    
    // Debug: Log configuration loading
    console.log("Config loaded from localStorage:", {
      tavilyFromStorage: tavilyApiKey ? "***has value***" : "empty",
      tavilyFromEnv: process.env.NEXT_PUBLIC_TAVILY_API_KEY ? "***has value***" : "empty",
      finalTavily: config.tavily_api_key ? "***configured***" : "missing",
    });
    
    return config;
  } catch (error) {
    console.warn("Failed to load configuration from localStorage:", error);
    return {
      llm_type: "openai",
      model_name: "",
      api_key: "",
      temperature: 0.7,
      max_tokens: 4000,
      tavily_api_key: "",
      jina_api_key: "",
      fal_api_key: "",
    };
  }
}

/**
 * Save configuration to localStorage
 * This function should be called from the UI layer when configuration changes
 */
export function saveConfigToLocalStorage(config: LLMConfig): void {
  if (typeof window === "undefined") {
    console.warn("Cannot save to localStorage in server-side environment");
    return;
  }

  try {
    setString("llmType", config.llm_type);
    
    const modelKey = config.llm_type === "openai" ? "openaiModel" : config.llm_type === "gemini" ? "geminiModel" : "ollamaModel";
    setString(modelKey, config.model_name);
    
    if (config.api_key && config.llm_type !== "ollama") {
      const apiKeyKey = config.llm_type === "gemini" ? "geminiApiKey" : "openaiApiKey";
      setString(apiKeyKey, config.api_key);
    }
    
    if (config.base_url) {
      const baseUrlKey = config.llm_type === "openai" ? "openaiBaseUrl" : config.llm_type === "gemini" ? "geminiBaseUrl" : "ollamaBaseUrl";
      setString(baseUrlKey, config.base_url);
    }
    
    setString("temperature", config.temperature.toString());
    
    if (config.max_tokens) {
      setString("maxTokens", config.max_tokens.toString());
    }
    
    if (config.tavily_api_key !== undefined) {
      setString("tavilyApiKey", config.tavily_api_key);
    }
    
    if (config.jina_api_key !== undefined) {
      setString("jinaApiKey", config.jina_api_key);
    }
    
    if (config.fal_api_key !== undefined) {
      setString("falApiKey", config.fal_api_key);
    }
  } catch (error) {
    console.error("Failed to save configuration to localStorage:", error);
  }
}
