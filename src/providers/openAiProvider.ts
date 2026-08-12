import { PROMPT_TEMPLATE_VERSION } from "../shared/constants";
import type { ProviderLessonRequest, ProviderLessonResult } from "../shared/types";
import type { LessonProvider } from "./types";
import { parseJsonLesson, renderPromptTemplate } from "./shared";

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface OpenAiErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

function formatOpenAiError(status: number, raw: string): string {
  try {
    const parsed = JSON.parse(raw) as OpenAiErrorResponse;
    const message = parsed.error?.message?.replace(/\s+/g, " ").trim();

    if (message) {
      return `Connection failed (${status}). ${message}`;
    }
  } catch {
    // Fall back to a compact plain-text version below.
  }

  const compact = raw.replace(/\s+/g, " ").trim();
  return compact ? `Connection failed (${status}). ${compact}` : `Connection failed (${status}).`;
}

export const openAiProvider: LessonProvider = {
  id: "openai",
  label: "OpenAI",
  requiresApiKey: true,
  async validateConnection(settings) {
    if (!settings.openAiApiKey.trim()) {
      return {
        ok: false,
        message: "Add an API key first."
      };
    }

    const model = settings.openAiModel.trim() || "gpt-4.1-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openAiApiKey.trim()}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 5,
        messages: [
          {
            role: "user",
            content: "Reply with OK."
          }
        ]
      })
    });

    if (!response.ok) {
      return {
        ok: false,
        message: formatOpenAiError(response.status, await response.text())
      };
    }

    return {
      ok: true,
      message: `Connected successfully with ${model}.`
    };
  },
  async generateLesson(request: ProviderLessonRequest): Promise<ProviderLessonResult> {
    if (!request.settings.openAiApiKey.trim()) {
      throw new Error("Add an OpenAI API key in Settings before generating lessons.");
    }

    const model = request.settings.openAiModel.trim() || "gpt-4.1-mini";
    const messages = [
      {
        role: "system",
        content:
          "You are a precise technical tutor. Return valid JSON only, with no markdown fences or commentary."
      },
      {
        role: "user",
        content: renderPromptTemplate(request.settings.promptTemplate, request)
      }
    ] as const;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.settings.openAiApiKey.trim()}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        response_format: {
          type: "json_object"
        },
        messages
      })
    });

    if (!response.ok) {
      throw new Error(formatOpenAiError(response.status, await response.text()));
    }

    const json = (await response.json()) as OpenAiResponse;
    const raw = json.choices?.[0]?.message?.content;

    if (!raw) {
      throw new Error(`OpenAI returned no lesson content. Prompt version: ${PROMPT_TEMPLATE_VERSION}`);
    }

    return parseJsonLesson(raw, "openai", model, request);
  }
};
