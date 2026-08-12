import { describe, expect, it } from "vitest";
import { createId } from "../src/lib/id";
import { normalizeTitle } from "../src/lib/strings";
import { createInitialState } from "../src/shared/seed";
import { migrateState } from "../src/storage/migrateState";

describe("state migration", () => {
  it("preserves user topics and provider settings across version upgrades", () => {
    const priorState = createInitialState("2026-08-12T09:00:00.000Z");
    priorState.version = 4;
    priorState.settings.provider.selectedProvider = "gemini";
    priorState.settings.provider.geminiApiKey = "AIza-test-key";
    priorState.settings.provider.promptTemplate = "Custom prompt";
    priorState.topics = [
      {
        id: createId("topic"),
        title: "Attention",
        normalizedTitle: normalizeTitle("Attention"),
        description: "",
        tags: ["foundations"],
        category: "llm-fundamentals",
        difficulty: 2,
        prerequisites: [],
        manuallyOrderedIndex: 0,
        status: "active",
        timesShown: 1,
        timesLearned: 0,
        createdAt: "2026-08-12T09:00:00.000Z",
        updatedAt: "2026-08-12T09:00:00.000Z",
        source: "user"
      }
    ];

    const migrated = migrateState(priorState);

    expect(migrated.version).toBe(5);
    expect(migrated.topics).toHaveLength(1);
    expect(migrated.topics[0]?.title).toBe("Attention");
    expect(migrated.settings.provider.selectedProvider).toBe("gemini");
    expect(migrated.settings.provider.geminiApiKey).toBe("AIza-test-key");
    expect(migrated.settings.provider.promptTemplate).toBe("Custom prompt");
  });

  it("replaces legacy prompt and ollama defaults with current publishable defaults", () => {
    const priorState = createInitialState("2026-08-12T09:00:00.000Z");
    priorState.version = 4;
    priorState.settings.provider.promptTemplate = "";
    priorState.settings.provider.ollamaModel = "gemma3";

    const migrated = migrateState(priorState);

    expect(migrated.settings.provider.promptTemplate.length).toBeGreaterThan(0);
    expect(migrated.settings.provider.ollamaModel).toBe("qwen2.5:3b");
  });
});
