import { useEffect } from "react";
import { applyTheme } from "../../lib/theme";
import { CATEGORY_LABELS } from "../../shared/constants";
import { EmptyState } from "../../ui/components/EmptyState";
import { SectionCard } from "../../ui/components/SectionCard";
import { useStoredState } from "../../ui/hooks/useStoredState";
import { AppShell } from "../../ui/layout/AppShell";

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
      <AppShell activePage="history" title="Learning history" subtitle="Loading lesson archive.">
        <div className="history-grid">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </AppShell>
    );
  }

  if (!state) {
    return (
      <AppShell activePage="history" title="Learning history" subtitle="Archive unavailable.">
        <EmptyState title="History unavailable" body={error ?? "The archive could not be loaded."} />
      </AppShell>
    );
  }

  const learnedTopics = [...state.topics]
    .filter((topic) => topic.timesLearned > 0 || topic.status === "learned")
    .sort((a, b) => (b.lastLearnedAt ?? "").localeCompare(a.lastLearnedAt ?? ""));
  const archivedLessons = [...state.lessons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const topicsById = new Map(state.topics.map((topic) => [topic.id, topic]));

  return (
    <AppShell
      activePage="history"
      title="Learning history"
      subtitle="Review what you have learned, reopen prior lessons, and inspect completion patterns."
    >
      <div className="history-grid">
        <SectionCard title="Learned topics" kicker="Completion log">
          {learnedTopics.length ? (
            <ul className="archive-list">
              {learnedTopics.map((topic) => (
                <li key={topic.id} className="archive-item">
                  <div className="archive-header">
                    <div>
                      <strong>{topic.title}</strong>
                      <p className="helper-text">{CATEGORY_LABELS[topic.category]}</p>
                    </div>
                    <span className="pill">{topic.timesLearned} completions</span>
                  </div>
                  <p className="helper-text">Last learned: {formatDate(topic.lastLearnedAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing learned yet" body="Mark cards as learned from the dashboard to build history." />
          )}
        </SectionCard>

        <SectionCard title="Lesson archive" kicker="Generated content">
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
        </SectionCard>
      </div>
    </AppShell>
  );
}
