import { browserApi } from "../lib/browserApi";
import { STORAGE_KEY } from "../shared/constants";
import type { ExtensionState } from "../shared/types";
import { migrateState } from "./migrateState";

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

export async function replaceState(nextState: ExtensionState): Promise<ExtensionState> {
  await saveState(nextState);
  return nextState;
}
