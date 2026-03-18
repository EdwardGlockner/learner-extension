import { useEffect, useMemo, useState } from "react";
import { openExtensionPopupWindow } from "../../lib/browserApi";
import { sortTopicsByLearningOrder } from "../../domain/planner";
import { sendBackgroundMessage } from "../../lib/messages";
import { getProviderLabel, getSelectedProviderApiKey } from "../../providers";
import { applyTheme } from "../../lib/theme";
import { titleFromLines } from "../../lib/strings";
import { CATEGORY_LABELS } from "../../shared/constants";
import type { LessonGeneration, Topic } from "../../shared/types";
import { loadState, replaceState } from "../../storage/state";
import { EmptyState } from "../../ui/components/EmptyState";
import { useDashboardData } from "../../ui/hooks/useDashboardData";

type DailyCardProps = {
  title: string;
  category: string;
  explanation: string;
  examples: string[];
  resources: Array<{ title: string; url: string }>;
  disabled?: boolean;
  onDone: () => Promise<void>;
};

type TopicLessonCard = {
  topic: Topic;
  lesson: LessonGeneration;
};

function formatRetryMessage(nextRetryAt?: string): string | null {
  if (!nextRetryAt) {
    return null;
  }

  const remainingMs = new Date(nextRetryAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    return "Retrying now.";
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);

  if (remainingSeconds < 60) {
    return `Retrying in about ${remainingSeconds} seconds.`;
  }

  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  return `Retrying in about ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.`;
}

function DailyCard({
  title,
  category,
  explanation,
  examples,
  resources,
  disabled,
  onDone
}: DailyCardProps) {
  return (
    <article className="daily-card">
      <div className="daily-card-header">
        <div>
          <p className="mini-label">{category}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="daily-card-body">
        <p>{explanation}</p>
        {examples.length ? (
          <ul className="compact-list">
            {examples.slice(0, 2).map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        ) : null}
        {resources.length ? (
          <div className="resource-inline-row">
            {resources.slice(0, 2).map((resource) => (
              <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="inline-link">
                {resource.title}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div className="compact-actions">
        <button className="button button-primary" disabled={disabled} onClick={() => void onDone()}>
          {disabled ? "Removing..." : "Finished / remove"}
        </button>
      </div>
    </article>
  );
}

export function DashboardPage() {
  const { data, loading, error, refresh, regenerateLesson, updateLessonStatus } = useDashboardData();
  const [newTopicInput, setNewTopicInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingLessonIds, setPendingLessonIds] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      applyTheme(data.state.settings.ui.theme);
    }
  }, [data]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  useEffect(() => {
    if (error) {
      setToast(error);
    }
  }, [error]);

  const topicsById = useMemo(() => {
    if (!data) {
      return new Map();
    }

    return new Map(data.state.topics.map((topic) => [topic.id, topic]));
  }, [data]);

  const todaysTopicCards = useMemo<TopicLessonCard[]>(() => {
    if (!data) {
      return [];
    }

    return data.todaysLessons
      .filter((lesson) => lesson.status !== "learned")
      .map((lesson) => {
        const topic = topicsById.get(lesson.topicId);
        return topic ? { topic, lesson } : null;
      })
      .filter((value): value is TopicLessonCard => Boolean(value))
      .slice(0, 2);
  }, [data, topicsById]);

  if (loading && !data) {
    return (
      <div className="popup-shell popup-shell-standard popup-loading">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="popup-shell popup-shell-standard">
        <EmptyState title="Dashboard unavailable" body={error ?? "The popup did not load."} />
      </div>
    );
  }

  const { state, todaysPlan } = data;
  const providerLabel = getProviderLabel(state.settings.provider.selectedProvider);
  const hasProviderKey = Boolean(getSelectedProviderApiKey(state.settings.provider));
  const todaysCardTopicIds = new Set(todaysTopicCards.map(({ topic }) => topic.id));
  const pendingPlanTopics = (todaysPlan?.topicIds ?? [])
    .filter((topicId) => !todaysCardTopicIds.has(topicId))
    .map((topicId) => topicsById.get(topicId))
    .filter((topic): topic is Topic => Boolean(topic));
  const latestGenerationAttempt = state.settings.provider.selectedProvider
    ? state.generationAttempts
        .filter((attempt) => attempt.providerId === state.settings.provider.selectedProvider)
        .filter((attempt) => attempt.dateKey === todaysPlan?.dateKey)
        .filter((attempt) => todaysPlan?.topicIds.includes(attempt.topicId))
        .sort((left, right) => right.lastAttemptAt.localeCompare(left.lastAttemptAt))[0]
    : undefined;
  const retryMessage = formatRetryMessage(latestGenerationAttempt?.nextRetryAt);
  const queueTopics = sortTopicsByLearningOrder(
    state.topics
      .filter((topic) => topic.status !== "learned")
      .filter((topic) => !todaysCardTopicIds.has(topic.id))
  );
  const shouldShowLoadingState =
    hasProviderKey &&
    pendingPlanTopics.length > 0 &&
    !todaysTopicCards.length &&
    (loading || isSubmittingTopic);

  async function handleQuickAdd(): Promise<void> {
    const titles = titleFromLines(newTopicInput);

    if (!titles.length) {
      return;
    }

    setIsSubmittingTopic(true);

    try {
      const created = await sendBackgroundMessage({ type: "topics/import", titles });
      setNewTopicInput("");
      setToast(created.length ? "Topic added" : "Already exists");
      await refresh();
    } finally {
      setIsSubmittingTopic(false);
    }
  }

  async function handleRemoveTopic(topicId: string): Promise<void> {
    const currentState = await loadState();
    const nextTopics = currentState.topics
      .filter((topic) => topic.id !== topicId)
      .map((topic, index) => ({
        ...topic,
        prerequisites: topic.prerequisites.filter((dependencyId) => dependencyId !== topicId),
        manuallyOrderedIndex: index
      }));

    await replaceState({ ...currentState, topics: nextTopics });
    setToast("Topic removed");
    await refresh();
  }

  async function handleRefresh(): Promise<void> {
    setIsRefreshing(true);

    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleFinishLesson(lessonId: string): Promise<void> {
    setPendingLessonIds((current) => [...current, lessonId]);

    try {
      await updateLessonStatus(lessonId, "learned");
    } finally {
      setPendingLessonIds((current) => current.filter((id) => id !== lessonId));
    }
  }

  return (
    <div className={`popup-shell ${state.settings.ui.popupScale === "large" ? "popup-shell-large" : "popup-shell-standard"}`}>
      {toast ? <div className="toast-banner">{toast}</div> : null}
      <header className="popup-header">
        <p className="mini-label">learning-plugin</p>
        <div className="compact-actions">
          <button className="button button-ghost" onClick={() => void handleRefresh()}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="button button-ghost" onClick={() => void openExtensionPopupWindow("options.html", 560, 760)}>
            Settings
          </button>
        </div>
      </header>

      <section className="quick-add-inline">
        <label className="quick-add-inline-label" htmlFor="quick-add-topic">
          Add topic:
        </label>
        <input
          id="quick-add-topic"
          className="quick-add-inline-input"
          value={newTopicInput}
          onChange={(event) => setNewTopicInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleQuickAdd();
            }
          }}
          placeholder="Example: Attention LLM"
        />
        <button className="button button-primary" onClick={() => void handleQuickAdd()}>
          {isSubmittingTopic ? "Adding..." : "Add"}
        </button>
      </section>

      {hasProviderKey && todaysTopicCards.length ? (
        <section className="daily-grid">
          {todaysTopicCards.map(({ topic, lesson }) => (
            <DailyCard
              key={lesson.id}
              title={topic.title}
              category={CATEGORY_LABELS[topic.category]}
              explanation={lesson.content.explanation}
              examples={lesson.content.examples}
              resources={lesson.content.resources}
              disabled={pendingLessonIds.includes(lesson.id)}
              onDone={() => handleFinishLesson(lesson.id)}
            />
          ))}
        </section>
      ) : shouldShowLoadingState ? (
        <section className="loading-panel" aria-live="polite">
          <div className="loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>Generating your lesson cards...</p>
          {pendingPlanTopics.length ? (
            <div className="loading-topic-list">
              {pendingPlanTopics.map((topic) => (
                <span key={topic.id} className="pill">
                  {topic.title}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <EmptyState
          title={hasProviderKey ? "No lessons ready" : `Connect ${providerLabel}`}
          body={
            hasProviderKey
              ? latestGenerationAttempt?.lastError
                ? retryMessage
                  ? `${latestGenerationAttempt.lastError} ${retryMessage}`
                  : latestGenerationAttempt.lastError
                : todaysPlan?.topicIds.length
                  ? "Lesson generation did not complete yet."
                  : "Add one or two topics above to start building the daily queue."
              : `Open Settings and add a ${providerLabel} API key to generate lessons.`
          }
        />
      )}

      <details className="upcoming-dropdown">
        <summary className="upcoming-summary">
          <span>Upcoming topics</span>
          <span className="pill">{queueTopics.length}</span>
        </summary>
        <div className="upcoming-content">
          {queueTopics.length ? (
            <ul className="queue-inline-list">
              {queueTopics.map((topic) => (
                <li key={topic.id} className="queue-inline-item">
                  <button className="queue-inline-button" onClick={() => void regenerateLesson(topic.id).catch(() => undefined)}>
                    <span>{topic.title}</span>
                    <small>{CATEGORY_LABELS[topic.category]}</small>
                  </button>
                  <button className="button button-ghost button-danger" onClick={() => void handleRemoveTopic(topic.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="compact-secondary">No queued topics yet.</p>
          )}
        </div>
      </details>
    </div>
  );
}
