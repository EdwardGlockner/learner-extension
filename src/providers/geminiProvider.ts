import { PROMPT_TEMPLATE_VERSION } from "../shared/constants";
import type { ProviderLessonRequest, ProviderLessonResult } from "../shared/types";
import type { LessonProvider } from "./types";
import { parseJsonLesson, renderPromptTemplate } from "./shared";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

interface GeminiErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      "@type"?: string;
      retryDelay?: string;
    }>;
  };
}

function normalizeGeminiModel(model: string): string {
  return (model.trim() || "gemini-2.5-flash-lite").replace(/^models\//, "");
}

function getGeminiEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeGeminiModel(model))}:generateContent`;
}

function getGeminiModelInfoEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeGeminiModel(model))}`;
}

function getGeminiText(response: GeminiGenerateContentResponse): string | null {
  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}

function formatGeminiError(status: number, raw: string): string {
  try {
    const parsed = JSON.parse(raw) as GeminiErrorResponse;
    const message = parsed.error?.message?.replace(/\s+/g, " ").trim() ?? "";
    const retryDelay = parsed.error?.details?.find((detail) => detail.retryDelay)?.retryDelay;

    if (parsed.error?.status === "RESOURCE_EXHAUSTED" || /quota exceeded/i.test(message)) {
      return retryDelay
        ? `Gemini free-tier quota reached. Try again in about ${retryDelay.replace(/s$/, " seconds")}.`
        : "Gemini free-tier quota reached. Try again shortly.";
    }

    if (message) {
      return `Connection failed (${status}). ${message}`;
    }
  } catch {
    // Ignore parse failures and fall back to the generic message.
  }

  return `Connection failed (${status}).`;
}

function buildGeminiPayload(request: ProviderLessonRequest) {
  const prompt = renderPromptTemplate(request.settings.promptTemplate, request);

  return {
    systemInstruction: {
      parts: [
        {
          text: "You are a precise technical tutor. Return valid JSON only, with no markdown fences or commentary."
        }
      ]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.5,
      responseMimeType: "application/json"
    }
  };
}

export const geminiProvider: LessonProvider = {
  id: "gemini",
  label: "Gemini",
  requiresApiKey: true,
  async validateConnection(settings) {
    const apiKey = settings.geminiApiKey.trim();

    if (!apiKey) {
      return {
        ok: false,
        message: "Add a Gemini API key first."
      };
    }

    const model = normalizeGeminiModel(settings.geminiModel);
    const response = await fetch(getGeminiModelInfoEndpoint(model), {
      method: "GET",
      headers: {
        "x-goog-api-key": apiKey
      }
    });

    if (!response.ok) {
      const message = formatGeminiError(response.status, await response.text());
      return {
        ok: false,
        message
      };
    }

    return {
      ok: true,
      message: `Connected successfully with ${model}.`
    };
  },
  async generateLesson(request: ProviderLessonRequest): Promise<ProviderLessonResult> {
    const apiKey = request.settings.geminiApiKey.trim();

    if (!apiKey) {
      throw new Error("Add a Gemini API key in Settings before generating lessons.");
    }

    const model = normalizeGeminiModel(request.settings.geminiModel);
    const response = await fetch(getGeminiEndpoint(model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(buildGeminiPayload(request))
    });

    if (!response.ok) {
      throw new Error(formatGeminiError(response.status, await response.text()));
    }

    const json = (await response.json()) as GeminiGenerateContentResponse;
    const raw = getGeminiText(json);

    if (!raw) {
      const blockReason = json.promptFeedback?.blockReason;
      const suffix = blockReason ? ` Block reason: ${blockReason}.` : "";
      throw new Error(`Gemini returned no lesson content. Prompt version: ${PROMPT_TEMPLATE_VERSION}.${suffix}`);
    }

    return parseJsonLesson(raw, "gemini", model);
  }
};
