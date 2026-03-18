import { DEFAULT_SETTINGS, STATE_VERSION } from "./constants";
import type { ExtensionState } from "./types";

export function createInitialState(now = new Date().toISOString()): ExtensionState {
  return {
    version: STATE_VERSION,
    topics: [],
    dailyPlans: [],
    lessons: [],
    generationAttempts: [],
    settings: DEFAULT_SETTINGS,
    initializedAt: now,
    updatedAt: now
  };
}
