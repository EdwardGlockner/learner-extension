import { browserApi } from "../lib/browserApi";
import { DEFAULT_SETTINGS, STORAGE_KEY, STATE_VERSION } from "../shared/constants";
import { createInitialState } from "../shared/seed";
import type { AppSettings, DailyPlan, ExtensionState, LessonGeneration, Topic } from "../shared/types";

function migrateState(input: ExtensionState | undefined): ExtensionState {
  if (!input) {
    return createInitialState();
  }

  if (input.version === STATE_VERSION) {
    return {
      ...input,
      generationAttempts: input.generationAttempts ?? [],
      settings: {
        ...input.settings,
        provider: {
          ...DEFAULT_SETTINGS.provider,
          ...input.settings.provider,
          selectedProvider: input.settings.provider.selectedProvider ?? DEFAULT_SETTINGS.provider.selectedProvider
        },
        ui: {
          ...createInitialState(input.initializedAt).settings.ui,
          ...input.settings.ui
        },
        scheduling: {
          ...input.settings.scheduling,
          dailyTopicCount: 2
        }
      }
    };
  }

  return createInitialState();
}

export async function loadState(): Promise<ExtensionState> {
  const stored = await browserApi.storage.local.get(STORAGE_KEY);
  const storedState = stored[STORAGE_KEY] as ExtensionState | undefined;
  const state = migrateState(storedState);

  if (!storedState || JSON.stringify(storedState) !== JSON.stringify(state)) {
    await saveState(state);
  }

  return state;
}

export async function saveState(state: ExtensionState): Promise<void> {
  const nextState: ExtensionState = {
    ...state,
    updatedAt: new Date().toISOString()
  };

  await browserApi.storage.local.set({ [STORAGE_KEY]: nextState });
}

export async function initializeStateIfNeeded(): Promise<ExtensionState> {
  return loadState();
}

export async function updateTopics(updater: (topics: Topic[]) => Topic[]): Promise<ExtensionState> {
  const state = await loadState();
  const topics = updater([...state.topics]);
  const nextState = { ...state, topics };
  await saveState(nextState);
  return nextState;
}

export async function updateSettings(updater: (settings: AppSettings) => AppSettings): Promise<ExtensionState> {
  const state = await loadState();
  const settings = updater(state.settings);
  const nextState = { ...state, settings };
  await saveState(nextState);
  return nextState;
}

export async function upsertDailyPlan(plan: DailyPlan): Promise<ExtensionState> {
  const state = await loadState();
  const dailyPlans = state.dailyPlans.filter((candidate) => candidate.dateKey !== plan.dateKey);
  dailyPlans.push(plan);
  const nextState = { ...state, dailyPlans: dailyPlans.sort((a, b) => a.dateKey.localeCompare(b.dateKey)) };
  await saveState(nextState);
  return nextState;
}

export async function upsertLesson(lesson: LessonGeneration): Promise<ExtensionState> {
  const state = await loadState();
  const lessons = state.lessons.filter((candidate) => candidate.id !== lesson.id);
  lessons.push(lesson);
  const nextState = {
    ...state,
    lessons: lessons.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  };
  await saveState(nextState);
  return nextState;
}

export async function replaceState(nextState: ExtensionState): Promise<ExtensionState> {
  await saveState(nextState);
  return nextState;
}
