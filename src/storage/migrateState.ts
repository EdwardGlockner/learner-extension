import {
  ADVANCED_DEFAULT_PROMPT_TEMPLATE_V1,
  DEFAULT_SETTINGS,
  DEFAULT_OLLAMA_MODEL,
  INTERMEDIATE_DEFAULT_PROMPT_TEMPLATE,
  LEGACY_OLLAMA_MODEL,
  LEGACY_DEFAULT_PROMPT_TEMPLATE,
  STATE_VERSION
} from "../shared/constants";
import { createInitialState } from "../shared/seed";
import type { ExtensionState } from "../shared/types";

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function migrateState(input: ExtensionState | undefined): ExtensionState {
  if (!input || typeof input !== "object") {
    return createInitialState();
  }

  const baseState = createInitialState(input.initializedAt);
  const inputSettings = input.settings ?? baseState.settings;
  const inputProvider = inputSettings.provider ?? baseState.settings.provider;
  const nextPromptTemplate =
    !inputProvider.promptTemplate ||
    inputProvider.promptTemplate === LEGACY_DEFAULT_PROMPT_TEMPLATE ||
    inputProvider.promptTemplate === INTERMEDIATE_DEFAULT_PROMPT_TEMPLATE ||
    inputProvider.promptTemplate === ADVANCED_DEFAULT_PROMPT_TEMPLATE_V1
      ? DEFAULT_SETTINGS.provider.promptTemplate
      : inputProvider.promptTemplate;
  const nextDifficultyPreference =
    inputProvider.difficultyPreference === "mixed"
      ? DEFAULT_SETTINGS.provider.difficultyPreference
      : inputProvider.difficultyPreference;
  const nextOllamaModel =
    !inputProvider.ollamaModel || inputProvider.ollamaModel === LEGACY_OLLAMA_MODEL
      ? DEFAULT_OLLAMA_MODEL
      : inputProvider.ollamaModel;

  return {
    ...baseState,
    ...input,
    version: STATE_VERSION,
    topics: asArray(input.topics),
    dailyPlans: asArray(input.dailyPlans),
    lessons: asArray(input.lessons),
    generationAttempts: asArray(input.generationAttempts),
    settings: {
      ...baseState.settings,
      ...inputSettings,
      provider: {
        ...DEFAULT_SETTINGS.provider,
        ...inputProvider,
        selectedProvider: inputProvider.selectedProvider ?? DEFAULT_SETTINGS.provider.selectedProvider,
        promptTemplate: nextPromptTemplate,
        difficultyPreference: nextDifficultyPreference,
        ollamaModel: nextOllamaModel
      },
      reminders: {
        ...baseState.settings.reminders,
        ...inputSettings.reminders
      },
      scheduling: {
        ...baseState.settings.scheduling,
        ...inputSettings.scheduling,
        dailyTopicCount: 2
      },
      ui: {
        ...baseState.settings.ui,
        ...inputSettings.ui
      }
    }
  };
}
