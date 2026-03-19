import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/shared/seed";

describe("default settings", () => {
  it("starts with reminders disabled for a new install", () => {
    const state = createInitialState("2026-03-19T09:00:00.000Z");
    expect(state.settings.reminders.enabled).toBe(false);
  });
});
