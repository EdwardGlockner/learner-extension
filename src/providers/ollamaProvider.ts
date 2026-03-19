import { DEFAULT_OLLAMA_MODEL, PROMPT_TEMPLATE_VERSION } from "../shared/constants";
import type { ProviderLessonRequest, ProviderLessonResult } from "../shared/types";
import type { LessonProvider } from "./types";
import { parseJsonLesson, renderPromptTemplate } from "./shared";

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
}

interface OllamaGenerateResponse {
  response?: string;
}

const OLLAMA_MAX_PREDICT = 320;
const OLLAMA_NUM_CTX = 2048;
const OLLAMA_MAX_THREADS = 2;
const LESSON_JSON_SCHEMA = {
  type: "object",
  required: ["explanation", "whyItMatters", "examples", "pitfalls", "nextSteps", "resources"],
  properties: {
    explanation: { type: "string" },
    whyItMatters: { type: "string" },
    examples: {
      type: "array",
      items: { type: "string" }
    },
    pitfalls: {
      type: "array",
      items: { type: "string" }
    },
    nextSteps: {
      type: "array",
      items: { type: "string" }
    },
    resources: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "url", "source"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          source: { type: "string" }
        }
      }
    }
  }
} as const;

function getOllamaBaseUrl(baseUrl: string): string {
  return (baseUrl.trim() || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

function getOllamaModel(model: string): string {
  return model.trim() || DEFAULT_OLLAMA_MODEL;
}

function matchesOllamaModel(installedModel: string | undefined, requestedModel: string): boolean {
  if (!installedModel) {
    return false;
  }

  const normalizedInstalled = installedModel.trim();
  const normalizedRequested = requestedModel.trim();

  return (
    normalizedInstalled === normalizedRequested ||
    normalizedInstalled === `${normalizedRequested}:latest` ||
    normalizedRequested === `${normalizedInstalled}:latest`
  );
}

function getOllamaThreadCount(): number {
  const hardwareConcurrency = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;

  if (!hardwareConcurrency || Number.isNaN(hardwareConcurrency)) {
    return OLLAMA_MAX_THREADS;
  }

  return Math.max(1, Math.min(OLLAMA_MAX_THREADS, Math.floor(hardwareConcurrency / 2) || 1));
}

async function generateOllamaResponse(
  baseUrl: string,
  model: string,
  prompt: string,
  maxPredict: number
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      format: LESSON_JSON_SCHEMA,
      stream: false,
      raw: false,
      think: false,
      keep_alive: "5m",
      system:
        "You are a precise technical tutor. Return one valid JSON object only. Do not add markdown fences, prose before the JSON, or prose after the JSON.",
      options: {
        num_predict: maxPredict,
        num_ctx: OLLAMA_NUM_CTX,
        num_thread: getOllamaThreadCount(),
        temperature: 0.2
      },
      prompt
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed (${response.status}). Make sure ${model} is installed locally.`);
  }

  const json = (await response.json()) as OllamaGenerateResponse;
  const raw = json.response?.trim();

  if (!raw) {
    throw new Error(`Ollama returned no lesson content. Prompt version: ${PROMPT_TEMPLATE_VERSION}`);
  }

  return raw;
}

export const ollamaProvider: LessonProvider = {
  id: "ollama",
  label: "Ollama",
  requiresApiKey: false,
  async validateConnection(settings) {
    const baseUrl = getOllamaBaseUrl(settings.ollamaBaseUrl);
    const model = getOllamaModel(settings.ollamaModel);
    const extensionOriginHint =
      "If localhost works in your browser but the extension cannot connect, restart Ollama with OLLAMA_ORIGINS including moz-extension://* and chrome-extension://*.";

    try {
      const response = await fetch(`${baseUrl}/api/tags`);

      if (!response.ok) {
        return {
          ok: false,
          message: `Could not reach Ollama at ${baseUrl}. ${extensionOriginHint}`
        };
      }

      const json = (await response.json()) as OllamaTagsResponse;
      const models = json.models ?? [];
      const matchingModel = models.find(
        (candidate) => matchesOllamaModel(candidate.name, model) || matchesOllamaModel(candidate.model, model)
      );

      return matchingModel
        ? {
            ok: true,
            message: `Connected to Ollama with ${matchingModel.name ?? model}.`
          }
        : {
            ok: false,
            message: `Connected to Ollama, but ${model} is not installed. Run "ollama pull ${model}".`
          };
    } catch {
      return {
        ok: false,
        message: `Could not reach Ollama at ${baseUrl}. Make sure the local Ollama app is running. ${extensionOriginHint}`
      };
    }
  },
  async generateLesson(request: ProviderLessonRequest): Promise<ProviderLessonResult> {
    const baseUrl = getOllamaBaseUrl(request.settings.ollamaBaseUrl);
    const model = getOllamaModel(request.settings.ollamaModel);
    const prompt = renderPromptTemplate(request.settings.promptTemplate, request);
    const raw = await generateOllamaResponse(baseUrl, model, prompt, OLLAMA_MAX_PREDICT);

    try {
      return parseJsonLesson(raw, "ollama", model, request);
    } catch (error) {
      const repairPrompt = [
        "Convert the following malformed output into one valid JSON object that matches the required schema exactly.",
        "Do not add any explanation or markdown fences.",
        "",
        "Malformed output:",
        raw
      ].join("\n");

      const repairedRaw = await generateOllamaResponse(baseUrl, model, repairPrompt, 384);

      try {
        return parseJsonLesson(repairedRaw, "ollama", model, request);
      } catch {
        throw error;
      }
    }
  }
};
