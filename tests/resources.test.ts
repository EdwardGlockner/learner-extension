import { describe, expect, it } from "vitest";
import { getCuratedResources } from "../src/domain/resources";
import { createId } from "../src/lib/id";
import { normalizeTitle } from "../src/lib/strings";
import { inferTopicSuggestion } from "../src/domain/topicInference";
import type { Topic } from "../src/shared/types";

function createTopic(title: string): Topic {
  const suggestion = inferTopicSuggestion(title);
  const now = "2026-08-12T09:00:00.000Z";

  return {
    id: createId("topic"),
    title,
    normalizedTitle: normalizeTitle(title),
    description: "",
    tags: suggestion.tags,
    category: suggestion.category,
    difficulty: suggestion.difficulty,
    prerequisites: [],
    manuallyOrderedIndex: 0,
    status: "active",
    timesShown: 0,
    timesLearned: 0,
    createdAt: now,
    updatedAt: now,
    source: "user"
  };
}

describe("resources", () => {
  it("does not guess a direct wikipedia article for composite LLM topics", () => {
    const resources = getCuratedResources(createTopic("Attention mechanism LLM"));

    expect(resources.some((resource) => /wikipedia\.org\/wiki\/Attention_mechanism_LLM/i.test(resource.url))).toBe(false);
  });

  it("adds paper fallback for research-heavy topics", () => {
    const resources = getCuratedResources(createTopic("Hypersphere"));

    expect(resources.some((resource) => resource.url.includes("arxiv.org/search/"))).toBe(true);
  });

  it("prefers practical links over paper-only fallback for systems topics", () => {
    const resources = getCuratedResources(createTopic("Cloud"));

    expect(
      resources.some(
        (resource) =>
          resource.url.includes("wikipedia.org/") ||
          resource.url.includes("cloud.google.com/") ||
          resource.source === "docs"
      )
    ).toBe(true);
    expect(resources.some((resource) => resource.url.includes("arxiv.org/search/"))).toBe(false);
  });
});
