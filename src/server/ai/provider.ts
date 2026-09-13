import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { withDeepSeekNonThinking } from "@/lib/deepseek-request";

export type ModelPurpose = "conversation" | "interview" | "review";

const defaults: Record<ModelPurpose, string> = {
  conversation: "qwen-plus",
  interview: "qwen-plus",
  review: "qwen-max",
};

export function modelConfig(purpose: ModelPurpose) {
  const suffix = purpose.toUpperCase();
  return {
    id: process.env[`MODEL_${suffix}`] || defaults[purpose],
    baseURL: process.env.MODEL_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.MODEL_API_KEY,
  };
}

export function getLanguageModel(purpose: ModelPurpose) {
  const config = modelConfig(purpose);
  if (!config.apiKey) return null;
  const isDeepSeek = /^https:\/\/api\.deepseek\.com(?:\/|$)/i.test(config.baseURL);
  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    name: "merittrace-model",
    fetch: isDeepSeek ? withDeepSeekNonThinking : undefined,
  });
  return provider.chat(config.id);
}
