import { describe, expect, it } from "vitest";
import { buildDailyPlan, scoreTopic, selectDailyTopics, selectVisibleTopics, sortTopicsByLearningOrder } from "../src/domain/planner";
import { inferTopicSuggestion } from "../src/domain/topicInference";
import { createId } from "../src/lib/id";
import { normalizeTitle } from "../src/lib/strings";
import { createInitialState } from "../src/shared/seed";
import type { ExtensionState, Topic } from "../src/shared/types";

function createTopic(title: string, index: number): Topic {
  const suggestion = inferTopicSuggestion(title);
  const now = "2026-03-01T09:00:00.000Z";

  return {
    id: createId("topic"),
    title,
    normalizedTitle: normalizeTitle(title),
    description: "",
    tags: suggestion.tags,
    category: suggestion.category,
    difficulty: suggestion.difficulty,
    prerequisites: [],
    manuallyOrderedIndex: index,
    status: "active",
    timesShown: 0,
    timesLearned: 0,
    createdAt: now,
    updatedAt: now,
    source: "user"
  };
}

function cloneState(): ExtensionState {
  const state = structuredClone(createInitialState("2026-03-01T09:00:00.000Z"));
  const context = createTopic("Context", 0);
  const attention = createTopic("Attention", 1);
  const docker = createTopic("Docker", 2);
  const kubernetes = createTopic("Kubernetes", 3);

  attention.prerequisites = [context.id];
  kubernetes.prerequisites = [docker.id];
  state.topics = [context, attention, docker, kubernetes];
  return state;
}

function getTopic(state: ExtensionState, title: string): Topic {
  const topic = state.topics.find((candidate) => candidate.title === title);

  if (!topic) {
    throw new Error(`Missing topic ${title}`);
  }

  return topic;
}

describe("planner", () => {
  it("keeps prerequisite ordering intact for advanced topics", () => {
    const state = cloneState();
    state.settings.scheduling.dailyTopicCount = 3;
    const selected = selectDailyTopics(state, "2026-03-18").map((item) => item.topic.title);

    const dockerIndex = selected.indexOf("Docker");
    const kubernetesIndex = selected.indexOf("Kubernetes");

    if (kubernetesIndex !== -1) {
      expect(dockerIndex).toBeGreaterThanOrEqual(0);
      expect(dockerIndex).toBeLessThan(kubernetesIndex);
    }
  });

  it("keeps directly related prerequisite topics close together in queue order", () => {
    const state = cloneState();
    const ordered = sortTopicsByLearningOrder(state.topics).map((topic) => topic.title);

    expect(ordered.indexOf("Context")).toBeLessThan(ordered.indexOf("Attention"));
    expect(ordered.indexOf("Attention") - ordered.indexOf("Context")).toBe(1);
    expect(ordered.indexOf("Docker")).toBeLessThan(ordered.indexOf("Kubernetes"));
    expect(ordered.indexOf("Kubernetes") - ordered.indexOf("Docker")).toBe(1);
  });

  it("uses variety penalties to avoid clustering the same category when alternatives exist", () => {
    const state = cloneState();
    state.settings.scheduling.dailyTopicCount = 2;

    const foundation = getTopic(state, "Context");
    const attention = getTopic(state, "Attention");
    const docker = getTopic(state, "Docker");

    foundation.tags = ["shared"];
    attention.tags = ["shared"];
    docker.tags = ["systems"];
    foundation.category = "llm-fundamentals";
    attention.category = "llm-fundamentals";
    docker.category = "systems-infrastructure";

    const secondTopicScore = scoreTopic(attention, state.topics, state.lessons, state, "2026-03-18", [foundation.id]);
    const alternativeScore = scoreTopic(docker, state.topics, state.lessons, state, "2026-03-18", [foundation.id]);

    expect(alternativeScore.score).toBeGreaterThan(secondTopicScore.score);
  });

  it("schedules review candidates once the review interval has elapsed", () => {
    const state = cloneState();
    state.settings.scheduling.dailyTopicCount = 2;
    state.settings.scheduling.reviewFrequency = 0.9;

    const docker = getTopic(state, "Docker");
    docker.timesLearned = 1;
    docker.status = "learned";
    docker.lastLearnedAt = "2026-03-01T09:00:00.000Z";
    docker.lastShownAt = "2026-03-02T09:00:00.000Z";

    const plan = buildDailyPlan(state, "2026-03-18");
    expect(plan.reasons.some((reason) => reason.topicId === docker.id && reason.reviewCandidate)).toBe(true);
  });

  it("does not immediately reschedule a recently learned topic", () => {
    const state = cloneState();
    state.settings.scheduling.dailyTopicCount = 2;

    const context = getTopic(state, "Context");
    context.timesLearned = 1;
    context.status = "learned";
    context.lastLearnedAt = "2026-03-17T09:00:00.000Z";
    context.lastShownAt = "2026-03-17T09:00:00.000Z";

    const selected = selectDailyTopics(state, "2026-03-18").map((item) => item.topic.title);
    expect(selected).not.toContain("Context");
  });

  it("mixes visible cards when the queue has a strong alternative subject", () => {
    const state = cloneState();
    const visible = selectVisibleTopics(state.topics, 2).map((topic) => topic.title);

    expect(visible[0]).toBe("Context");
    expect(visible[1]).toBe("Docker");
  });
});
