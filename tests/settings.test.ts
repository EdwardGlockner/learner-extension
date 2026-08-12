import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/shared/seed";

describe("default settings", () => {
  it("starts with reminders disabled for a new install", () => {
    const state = createInitialState("2026-03-19T09:00:00.000Z");
    expect(state.settings.reminders.enabled).toBe(false);
  });

  it("creates isolated settings objects for each new state", () => {
    const first = createInitialState("2026-03-19T09:00:00.000Z");
    const second = createInitialState("2026-03-19T09:00:00.000Z");

    first.settings.provider.selectedProvider = "gemini";

    expect(second.settings.provider.selectedProvider).toBe("ollama");
  });
});
