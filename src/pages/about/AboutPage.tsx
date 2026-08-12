import { useEffect } from "react";
import { navigateCurrentExtensionPage } from "../../lib/browserApi";
import { applyTheme } from "../../lib/theme";
import { EmptyState } from "../../ui/components/EmptyState";
import { useStoredState } from "../../ui/hooks/useStoredState";

export function AboutPage() {
  const { state, loading, error } = useStoredState();

  useEffect(() => {
    if (state) {
      applyTheme(state.settings.ui.theme);
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

  if (!state) {
    return (
      <div className="settings-shell">
        <EmptyState title="About unavailable" body={error ?? "The help page could not be loaded."} />
      </div>
    );
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
            <h1>About</h1>
          </div>
        </div>
      </header>

      <section className="settings-card">
        <p className="mini-label">How it works</p>
        <h2>Small daily lessons from your own queue</h2>
        <div className="lesson-paragraph-group">
          <p className="lesson-paragraph">
            Add topics you want to learn. The plugin keeps them in an ordered queue, tries to place prerequisites before advanced topics, and shows up to two lesson cards at a time.
          </p>
          <p className="lesson-paragraph">
            When a topic reaches the front of the queue, the selected model generates a compact lesson with explanation, examples, pitfalls, next steps, and deeper links.
          </p>
          <p className="lesson-paragraph">
            Press <strong>Finished / remove</strong> when you are done. The next topic moves forward automatically.
          </p>
        </div>
      </section>

      <section className="settings-card">
        <p className="mini-label">Surfaces</p>
        <h2>What each page is for</h2>
        <ul className="lesson-bullets">
          <li><strong>Dashboard:</strong> your current cards and upcoming queue.</li>
          <li><strong>Settings:</strong> provider setup and reminders.</li>
          <li><strong>History:</strong> past learned topics and generated lessons.</li>
        </ul>
      </section>

      <section className="settings-card">
        <p className="mini-label">Providers</p>
        <h2>Gemini, OpenAI, or Ollama</h2>
        <ul className="lesson-bullets">
          <li><strong>Gemini:</strong> easier hosted setup, but quotas can apply.</li>
          <li><strong>OpenAI:</strong> hosted GPT models through an OpenAI API key from the developer platform.</li>
          <li><strong>Ollama:</strong> local generation on your machine, no hosted quota, but Ollama must be installed and running.</li>
        </ul>
      </section>
    </div>
  );
}
