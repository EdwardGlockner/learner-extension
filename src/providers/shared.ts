import { CATEGORY_LABELS } from "../shared/constants";
import { getCuratedResources } from "../domain/resources";
import type { ProviderId, ProviderLessonRequest, ProviderLessonResult, ResourceLink } from "../shared/types";

export function renderPromptTemplate(template: string, request: ProviderLessonRequest): string {
  const replacements: Record<string, string> = {
    topicTitle: request.topic.title,
    topicDescription: request.topic.description?.trim() || "None",
    category: CATEGORY_LABELS[request.topic.category],
    difficultyPreference: request.settings.difficultyPreference,
    contentLength: request.settings.contentLength,
    relatedTopics: request.relatedTopics.map((topic) => topic.title).join(", ") || "None"
  };

  return Object.entries(replacements).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
    template
  );
}

export function normalizeResources(resources: unknown): ResourceLink[] {
  if (!Array.isArray(resources)) {
    return [];
  }

  return resources
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : "Reference",
      url: typeof item.url === "string" ? item.url : "",
      source: typeof item.source === "string" ? item.source : "generated"
    }))
    .filter((item) => item.url.startsWith("http"));
}

function stripJsonCodeFence(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export function parseJsonLesson(
  raw: string,
  providerId: ProviderId,
  model: string,
  request: ProviderLessonRequest
): ProviderLessonResult {
  const parsed = JSON.parse(stripJsonCodeFence(raw)) as Record<string, unknown>;
  const generatedResources = normalizeResources(parsed.resources);

  return {
    providerId,
    model,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "No explanation returned.",
    whyItMatters: typeof parsed.whyItMatters === "string" ? parsed.whyItMatters : "",
    examples: Array.isArray(parsed.examples) ? parsed.examples.filter((value): value is string => typeof value === "string") : [],
    pitfalls: Array.isArray(parsed.pitfalls) ? parsed.pitfalls.filter((value): value is string => typeof value === "string") : [],
    nextSteps: Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.filter((value): value is string => typeof value === "string")
      : [],
    resources: getCuratedResources(request.topic, generatedResources)
  };
}
