import { useEffect } from "react";
import { navigateCurrentExtensionPage } from "../../lib/browserApi";
import { applyTheme } from "../../lib/theme";
import { CATEGORY_LABELS } from "../../shared/constants";
import { EmptyState } from "../../ui/components/EmptyState";
import { useStoredState } from "../../ui/hooks/useStoredState";

function formatDate(value?: string): string {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not yet";
}

export function HistoryPage() {
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
        <EmptyState title="History unavailable" body={error ?? "The archive could not be loaded."} />
      </div>
    );
  }

  const learnedTopics = [...state.topics]
    .filter((topic) => topic.timesLearned > 0 || topic.status === "learned")
    .sort((a, b) => (b.lastLearnedAt ?? "").localeCompare(a.lastLearnedAt ?? ""));
  const archivedLessons = [...state.lessons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const topicsById = new Map(state.topics.map((topic) => [topic.id, topic]));

  return (
    <div className="settings-shell">
      <header className="settings-header">
        <div className="settings-header-leading">
          <button type="button" className="button button-ghost button-icon" aria-label="Back" onClick={() => navigateCurrentExtensionPage("dashboard.html")}>
            &lt;
          </button>
          <div>
            <p className="mini-label">learning-plugin</p>
            <h1>History</h1>
          </div>
        </div>
      </header>
      <div className="history-grid">
        <section className="settings-card">
          <p className="mini-label">Completion log</p>
          <h2>Learned topics</h2>
          {learnedTopics.length ? (
            <ul className="archive-list">
              {learnedTopics.map((topic) => (
                <li key={topic.id} className="archive-item">
                  <div className="archive-header">
                    <div>
                      <strong>{topic.title}</strong>
                      <p className="helper-text">{CATEGORY_LABELS[topic.category]}</p>
                    </div>
                  </div>
                  <p className="helper-text">Learned: {formatDate(topic.lastLearnedAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing learned yet" body="Mark cards as learned from the dashboard to build history." />
          )}
        </section>

        <section className="settings-card">
          <p className="mini-label">Generated content</p>
          <h2>Lesson archive</h2>
          {archivedLessons.length ? (
            <ul className="archive-list">
              {archivedLessons.map((lesson) => {
                const topic = topicsById.get(lesson.topicId);
                return (
                  <li key={lesson.id} className="archive-item">
                    <div className="archive-header">
                      <div>
                        <strong>{topic?.title ?? "Unknown topic"}</strong>
                        <p className="helper-text">
                          {formatDate(lesson.createdAt)} • {lesson.status}
                        </p>
                      </div>
                      <span className="pill">{lesson.providerId}</span>
                    </div>
                    <p>{lesson.content.explanation}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No lessons archived" body="Your generated lessons will appear here automatically." />
          )}
        </section>
      </div>
    </div>
  );
}
