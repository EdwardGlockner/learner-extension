import { useEffect, useState } from "react";
import { browserApi } from "../../lib/browserApi";
import { STORAGE_KEY } from "../../shared/constants";
import type { ExtensionState } from "../../shared/types";
import { loadState } from "../../storage/state";

export function useStoredState() {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      try {
        const nextState = await loadState();

        if (!cancelled) {
          setState(nextState);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Failed to load extension state.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    const listener: Parameters<typeof browserApi.storage.onChanged.addListener>[0] = (changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]?.newValue) {
        return;
      }

      setState(changes[STORAGE_KEY].newValue as ExtensionState);
    };

    browserApi.storage.onChanged.addListener(listener);

    return () => {
      cancelled = true;
      browserApi.storage.onChanged.removeListener(listener);
    };
  }, []);

  return { state, loading, error, setState };
}
