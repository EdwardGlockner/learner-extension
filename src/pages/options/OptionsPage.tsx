import { useEffect, useState } from "react";
import { openExternalUrl } from "../../lib/browserApi";
import { sendBackgroundMessage } from "../../lib/messages";
import { applyTheme } from "../../lib/theme";
import type { AppSettings } from "../../shared/types";
import { replaceState } from "../../storage/state";
import { EmptyState } from "../../ui/components/EmptyState";
import { useStoredState } from "../../ui/hooks/useStoredState";

export function OptionsPage() {
  const { state, loading, error, setState } = useStoredState();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (state) {
      applyTheme(state.settings.ui.theme);
      setDraft({
        ...state.settings,
        provider: {
          ...state.settings.provider,
          selectedProvider:
            state.settings.provider.selectedProvider === "gemini" ? "gemini" : "ollama"
        }
      });
    }
  }, [state]);

  if (loading && !state) {
    return (
      <div className="settings-shell">
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  if (!state || !draft) {
    return (
      <div className="settings-shell">
        <EmptyState title="Settings unavailable" body={error ?? "The settings page did not load."} />
      </div>
    );
  }

  const currentState = state;
  const currentDraft = draft;
  const selectedProvider = currentDraft.provider.selectedProvider === "gemini" ? "gemini" : "ollama";

  async function handleSave(): Promise<void> {
    const nextState = {
      ...currentState,
      settings: currentDraft
    };
    const saved = await replaceState(nextState);
    setState(saved);
    applyTheme(saved.settings.ui.theme);
    await sendBackgroundMessage({ type: "settings/reschedule-reminder" });
    setFlash("Settings saved.");
  }

  async function handleTestReminder(): Promise<void> {
    await sendBackgroundMessage({ type: "notifications/test" });
    setFlash("Reminder sent.");
  }

  async function handleCheckConnection(): Promise<void> {
    const nextState = {
      ...currentState,
      settings: currentDraft
    };
    const saved = await replaceState(nextState);
    setState(saved);
    const result = await sendBackgroundMessage({ type: "provider/validate" });
    setConnectionStatus(result.message);
  }

  return (
    <div className="settings-shell">
      <header className="settings-header">
        <div>
          <p className="mini-label">learning-plugin</p>
          <h1>Settings</h1>
        </div>
        <button className="button button-primary" onClick={() => void handleSave()}>
          Save
        </button>
      </header>

      {flash ? <div className="compact-banner">{flash}</div> : null}

      <section className="settings-card">
        <p className="mini-label">API</p>
        <h2>Lesson provider</h2>
        <label className="field">
          <span>Provider</span>
          <select
            value={selectedProvider}
            onChange={(event) =>
              {
                setConnectionStatus(null);
                setDraft({
                  ...currentDraft,
                  provider: {
                    ...currentDraft.provider,
                    selectedProvider: event.target.value as AppSettings["provider"]["selectedProvider"]
                  }
                });
              }
            }
          >
            <option value="ollama">Ollama</option>
            <option value="gemini">Gemini</option>
          </select>
        </label>
        {selectedProvider === "gemini" ? (
          <label className="field">
            <span>API key</span>
            <input
              type="password"
              value={currentDraft.provider.geminiApiKey}
              onChange={(event) =>
                {
                  setConnectionStatus(null);
                  setDraft({
                    ...currentDraft,
                    provider: {
                      ...currentDraft.provider,
                      selectedProvider: "gemini" as const,
                      geminiApiKey: event.target.value
                    }
                  });
                }
              }
              placeholder="AIza..."
            />
          </label>
        ) : (
          <>
            <label className="field">
              <span>Model</span>
              <input
                value={currentDraft.provider.ollamaModel}
                onChange={(event) =>
                  {
                    setConnectionStatus(null);
                    setDraft({
                      ...currentDraft,
                      provider: {
                        ...currentDraft.provider,
                        selectedProvider: "ollama" as const,
                        ollamaModel: event.target.value
                      }
                    });
                  }
                }
                placeholder="gemma3"
              />
            </label>
            <div className="helper-box">
              <p className="compact-secondary">
                New-user Ollama setup:
              </p>
              <ol className="compact-list compact-list-numbered">
                <li>Install Ollama for Windows.</li>
                <li>Open the Ollama app and leave it running in the tray.</li>
                <li>In PowerShell, run <code>ollama pull gemma3</code>.</li>
                <li>If the extension still cannot connect in Firefox, restart Ollama with extension origins enabled.</li>
              </ol>
              <div className="compact-actions">
                <button className="button" onClick={() => void openExternalUrl("https://docs.ollama.com/windows")}>
                  Ollama install guide
                </button>
                <button className="button" onClick={() => void openExternalUrl("https://docs.ollama.com/faq")}>
                  Origin setup help
                </button>
              </div>
              <div className="field">
                <span>PowerShell if Firefox access fails</span>
                <textarea
                  readOnly
                  value={
                    '$env:OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*,safari-web-extension://*"\nollama serve'
                  }
                />
              </div>
            </div>
          </>
        )}
        <div className="compact-actions">
          <button className="button" onClick={() => void handleCheckConnection()}>
            Test connection
          </button>
        </div>
        <p className="compact-secondary">
          {selectedProvider === "ollama"
            ? 'Run Ollama locally, then pull a model like "ollama pull gemma3".'
            : "Paste your Gemini API key here to generate lesson cards."}
        </p>
        {connectionStatus ? <p className="compact-secondary">{connectionStatus}</p> : null}
      </section>

      <section className="settings-card">
        <p className="mini-label">Notifications</p>
        <h2>Reminder window</h2>
        <div className="settings-grid">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={currentDraft.reminders.enabled}
              onChange={(event) =>
                setDraft({
                  ...currentDraft,
                  reminders: {
                    ...currentDraft.reminders,
                    enabled: event.target.checked
                  }
                })
              }
            />
            <span>Enable daily reminder</span>
          </label>

          <label className="field">
            <span>Reminder time</span>
            <input
              type="time"
              value={currentDraft.reminders.time}
              onChange={(event) =>
                setDraft({
                  ...currentDraft,
                  reminders: {
                    ...currentDraft.reminders,
                    time: event.target.value
                  }
                })
              }
            />
          </label>

          <div className="compact-actions">
            <button className="button" onClick={() => void handleTestReminder()}>
              Test reminder
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
