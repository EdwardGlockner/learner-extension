import { PROMPT_TEMPLATE_VERSION } from "../shared/constants";
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

function getOllamaBaseUrl(baseUrl: string): string {
  return (baseUrl.trim() || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

function getOllamaModel(model: string): string {
  return model.trim() || "gemma3";
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

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        stream: false,
        prompt:
          "You are a precise technical tutor. Return valid JSON only, with no markdown fences or commentary.\n\n" +
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

    return parseJsonLesson(raw, "ollama", model, request);
  }
};
