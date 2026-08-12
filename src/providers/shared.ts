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
    .filter((item) => item.url.startsWith("http"))
    .filter((item) => !/wikipedia\.org\/wiki\/Special:Search/i.test(item.url));
}

function stripJsonCodeFence(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractJsonObject(raw: string): string {
  const trimmed = stripJsonCodeFence(raw);

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const startIndex = trimmed.indexOf("{");

  if (startIndex === -1) {
    return trimmed;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return trimmed.slice(startIndex, index + 1);
      }
    }
  }

  return trimmed;
}

function sanitizeJsonLikeString(raw: string): string {
  return extractJsonObject(raw)
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function tryParseJsonLikeObject(raw: string): Record<string, unknown> | null {
  const candidates = [extractJsonObject(raw), sanitizeJsonLikeString(raw)];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

function splitListItems(value: string): string[] {
  return value
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-Z0-9-])/))
    .map((item) => item.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function decodeJsonLikeString(value: string): string {
  return value
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .trim();
}

function extractJsonLikeStringField(raw: string, key: string): string {
  const match = raw.match(new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"|,\\s*\\}|\\s*\\})`, "i"));

  return decodeJsonLikeString(match?.[1] ?? "");
}

function extractJsonLikeArrayField(raw: string, key: string): string[] {
  const arrayMatch = raw.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,\\s*"|,\\s*\\}|\\s*\\})`, "i"));

  if (arrayMatch?.[1]) {
    return arrayMatch[1]
      .split(/",\s*"/)
      .map((item) => item.replace(/^"/, "").replace(/"$/, ""))
      .map(decodeJsonLikeString)
      .filter(Boolean);
  }

  const stringValue = extractJsonLikeStringField(raw, key);
  return stringValue ? splitListItems(stringValue) : [];
}

function extractLooseResourceLines(raw: string): ResourceLink[] {
  const deepDiveBlock = extractSection(raw, ["deep dive", "resources"]);

  if (!deepDiveBlock) {
    return [];
  }

  return splitListItems(deepDiveBlock)
    .slice(0, 3)
    .map((title) => ({
      title,
      url: "",
      source: "generated"
    }));
}

function extractSection(raw: string, headings: string[]): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  const headingPattern = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const sectionRegex = new RegExp(
    `(?:^|\\n)\\s*(?:${headingPattern})\\s*:?[ \\t]*\\n?([\\s\\S]*?)(?=\\n\\s*(?:summary|explanation|why it matters|why it matter|examples|common pitfalls|pitfalls|what to learn next|next steps|deep dive|resources)\\s*:|$)`,
    "i"
  );
  const match = normalized.match(sectionRegex);

  return match?.[1]?.trim() ?? "";
}

function fallbackParseLesson(
  raw: string,
  request: ProviderLessonRequest,
  model: string,
  providerId: ProviderId
): ProviderLessonResult {
  const explanation =
    extractJsonLikeStringField(raw, "explanation") ||
    extractSection(raw, ["summary", "explanation"]) ||
    raw
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter((block) => block && !block.startsWith("{"))[0] ||
    "No explanation returned.";
  const whyItMatters =
    extractJsonLikeStringField(raw, "whyItMatters") || extractSection(raw, ["why it matters", "why it matter"]);
  const examples = (
    extractJsonLikeArrayField(raw, "examples").length
      ? extractJsonLikeArrayField(raw, "examples")
      : splitListItems(extractSection(raw, ["examples"]))
  ).slice(0, 4);
  const pitfalls = (
    extractJsonLikeArrayField(raw, "pitfalls").length
      ? extractJsonLikeArrayField(raw, "pitfalls")
      : splitListItems(extractSection(raw, ["common pitfalls", "pitfalls"]))
  ).slice(0, 4);
  const nextSteps = (
    extractJsonLikeArrayField(raw, "nextSteps").length
      ? extractJsonLikeArrayField(raw, "nextSteps")
      : splitListItems(extractSection(raw, ["what to learn next", "next steps"]))
  ).slice(0, 4);
  const looseResources = extractLooseResourceLines(raw);

  return {
    providerId,
    model,
    explanation,
    whyItMatters,
    examples,
    pitfalls,
    nextSteps,
    resources: getCuratedResources(request.topic, looseResources)
  };
}

export function parseJsonLesson(
  raw: string,
  providerId: ProviderId,
  model: string,
  request: ProviderLessonRequest
): ProviderLessonResult {
  const parsed = tryParseJsonLikeObject(raw);

  if (!parsed) {
    return fallbackParseLesson(raw, request, model, providerId);
  }
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
