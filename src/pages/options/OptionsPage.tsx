import { useEffect, useState } from "react";
import { navigateCurrentExtensionPage, openExternalUrl } from "../../lib/browserApi";
import { sendBackgroundMessage } from "../../lib/messages";
import { applyTheme } from "../../lib/theme";
import { DEFAULT_OLLAMA_MODEL } from "../../shared/constants";
import type { AppSettings } from "../../shared/types";
import { replaceState } from "../../storage/state";
import { EmptyState } from "../../ui/components/EmptyState";
import { useStoredState } from "../../ui/hooks/useStoredState";

export function OptionsPage() {
  const { state, loading, error, setState } = useStoredState();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  useEffect(() => {
    if (state) {
      applyTheme(state.settings.ui.theme);
      setDraft(state.settings);
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
  const selectedProvider = currentDraft.provider.selectedProvider ?? "ollama";

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
    const result = await sendBackgroundMessage({ type: "notifications/test" });
    setReminderStatus(result.message);
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
        <div className="settings-header-leading">
          <button type="button" className="button button-ghost button-icon" aria-label="Back" onClick={() => navigateCurrentExtensionPage("dashboard.html")}>
            &lt;
          </button>
          <div>
            <p className="mini-label">learning-plugin</p>
            <h1>Settings</h1>
          </div>
        </div>
        <button type="button" className="button button-primary" onClick={() => void handleSave()}>
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
            <option value="openai">OpenAI / GPT</option>
          </select>
        </label>
        {selectedProvider === "gemini" ? (
          <label className="field">
            <span>Gemini API key</span>
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
        ) : selectedProvider === "openai" ? (
          <>
            <label className="field">
              <span>OpenAI API key</span>
              <input
                type="password"
                value={currentDraft.provider.openAiApiKey}
                onChange={(event) =>
                  {
                    setConnectionStatus(null);
                    setDraft({
                      ...currentDraft,
                      provider: {
                        ...currentDraft.provider,
                        selectedProvider: "openai" as const,
                        openAiApiKey: event.target.value
                      }
                    });
                  }
                }
                placeholder="sk-..."
              />
            </label>
            <label className="field">
              <span>Model</span>
              <input
                value={currentDraft.provider.openAiModel}
                onChange={(event) =>
                  {
                    setConnectionStatus(null);
                    setDraft({
                      ...currentDraft,
                      provider: {
                        ...currentDraft.provider,
                        selectedProvider: "openai" as const,
                        openAiModel: event.target.value
                      }
                    });
                  }
                }
                placeholder="gpt-4.1-mini"
              />
            </label>
          </>
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
                placeholder={DEFAULT_OLLAMA_MODEL}
              />
            </label>
            <div className="helper-box ollama-setup-box">
              <div className="ollama-setup-copy">
                <p className="mini-label">Ollama setup</p>
                <strong>New-user local setup</strong>
                <ol className="compact-list compact-list-numbered">
                  <li>Install Ollama for Windows.</li>
                  <li>Open the Ollama app and leave it running in the tray.</li>
                  <li>Pull the model once from PowerShell.</li>
                  <li>If the extension still cannot connect in Firefox, restart Ollama with extension origins enabled.</li>
                </ol>
              </div>
              <div className="helper-box-tech ollama-command-box">
                <p className="mini-label">PowerShell</p>
                <strong>{`ollama pull ${DEFAULT_OLLAMA_MODEL}`}</strong>
              </div>
              <div className="ollama-fallback-block">
                <span className="ollama-fallback-label">Firefox fallback</span>
                <p className="compact-secondary">
                  If the connection test still fails in Firefox, close Ollama and run these commands in PowerShell.
                </p>
                <textarea
                  className="terminal-textarea"
                  readOnly
                  value={
                    '$env:OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*,safari-web-extension://*"\nollama serve'
                  }
                />
              </div>
              <div className="compact-actions compact-actions-spaced ollama-doc-row">
                <button type="button" className="button" onClick={() => void openExternalUrl("https://docs.ollama.com/windows")}>
                  Install guide
                </button>
                <button type="button" className="button" onClick={() => void openExternalUrl("https://docs.ollama.com/faq")}>
                  Origin help
                </button>
              </div>
            </div>
          </>
        )}
        <div className="compact-actions">
          <button type="button" className="button" onClick={() => void handleCheckConnection()}>
            Test connection
          </button>
        </div>
        <p className="compact-secondary">
          {selectedProvider === "ollama"
            ? `Run Ollama locally, then pull a model like "ollama pull ${DEFAULT_OLLAMA_MODEL}".`
            : selectedProvider === "gemini"
              ? "Paste your Gemini API key here to generate lesson cards."
              : "Paste your OpenAI API key here to generate GPT lesson cards."}
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
            <button type="button" className="button" onClick={() => void handleTestReminder()}>
              Test reminder
            </button>
          </div>
        </div>
        {reminderStatus ? <p className="compact-secondary">{reminderStatus}</p> : null}
        <p className="compact-secondary">
          The test reminder should trigger a native browser/OS notification immediately. If nothing appears, Firefox or your OS is likely suppressing notifications.
        </p>
      </section>
    </div>
  );
}
