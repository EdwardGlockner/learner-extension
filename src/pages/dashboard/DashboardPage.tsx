import { useEffect, useMemo, useState } from "react";
import { navigateCurrentExtensionPage, openExternalUrl } from "../../lib/browserApi";
import { getCuratedResources } from "../../domain/resources";
import { sortTopicsByLearningOrder } from "../../domain/planner";
import { sendBackgroundMessage } from "../../lib/messages";
import { getProviderLabel, isSelectedProviderConfigured } from "../../providers";
import { applyTheme } from "../../lib/theme";
import { titleFromLines } from "../../lib/strings";
import { CATEGORY_LABELS } from "../../shared/constants";
import type { LessonGeneration, Topic } from "../../shared/types";
import { EmptyState } from "../../ui/components/EmptyState";
import { useDashboardData } from "../../ui/hooks/useDashboardData";

type DailyCardProps = {
  title: string;
  category: string;
  explanation: string;
  whyItMatters: string;
  examples: string[];
  pitfalls: string[];
  nextSteps: string[];
  resources: Array<{ title: string; url: string }>;
  disabled?: boolean;
  onDone: () => Promise<void>;
};

type TopicLessonCard = {
  topic: Topic;
  lesson: LessonGeneration;
};

type VisibleCardSlot =
  | {
      type: "lesson";
      topic: Topic;
      lesson: LessonGeneration;
    }
  | {
      type: "loading";
      topic: Topic;
  };

function isEquationLike(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed.length < 6 || trimmed.length > 120) {
    return false;
  }

  if (!/[=<>+\-/*^]/.test(trimmed)) {
    return false;
  }

  return /^[a-zA-Z0-9_()[\]{}.,:%+\-/*^<>\s|]+$/.test(trimmed);
}

function splitIntoSentenceChunks(line: string): string[] {
  const normalized = line.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 2 && normalized.length < 280) {
    return [normalized];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const nextChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;

    if (currentChunk && (currentChunk.length >= 220 || nextChunk.length > 260)) {
      chunks.push(currentChunk);
      currentChunk = sentence;
      continue;
    }

    currentChunk = nextChunk;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length ? chunks : [normalized];
}

function renderStructuredText(text: string) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return null;
    }

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return (
        <ul key={`${block}-${index}`} className="lesson-bullets">
          {lines.map((line) => (
            <li key={line}>{line.replace(/^[-*]\s+/, "")}</li>
          ))}
        </ul>
      );
    }

    if (lines.length === 1 && isEquationLike(lines[0])) {
      return (
        <pre key={`${block}-${index}`} className="equation-block">
          {lines[0]}
        </pre>
      );
    }

    return (
      <div key={`${block}-${index}`} className="lesson-paragraph-group">
        {lines.flatMap((line, lineIndex) => {
          if (isEquationLike(line)) {
            return (
              <pre key={`${block}-${index}-equation-${lineIndex}`} className="equation-block">
                {line}
              </pre>
            );
          }

          return splitIntoSentenceChunks(line).map((chunk, chunkIndex) => (
            <p key={`${block}-${index}-line-${lineIndex}-chunk-${chunkIndex}`} className="lesson-paragraph">
              {chunk}
            </p>
          ));
        })}
      </div>
    );
  });
}

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
  whyItMatters,
  examples,
  pitfalls,
  nextSteps,
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
        <section className="lesson-section">
          <p className="lesson-section-label">Summary</p>
          {renderStructuredText(explanation)}
        </section>
        {whyItMatters ? (
          <section className="lesson-section">
            <p className="lesson-section-label">Why it matters</p>
            {renderStructuredText(whyItMatters)}
          </section>
        ) : null}
        {examples.length ? (
          <section className="lesson-section">
            <p className="lesson-section-label">Examples</p>
            <ul className="lesson-chip-list">
              {examples.slice(0, 3).map((example) => (
                <li key={example} className="lesson-chip-item">
                  {example}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {pitfalls.length ? (
          <section className="lesson-section">
            <p className="lesson-section-label">Common pitfalls</p>
            <ul className="lesson-bullets">
              {pitfalls.slice(0, 3).map((pitfall) => (
                <li key={pitfall}>{pitfall}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {nextSteps.length ? (
          <section className="lesson-section">
            <p className="lesson-section-label">What to learn next</p>
            <ul className="lesson-bullets">
              {nextSteps.slice(0, 3).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {resources.length ? (
          <section className="lesson-section">
            <p className="lesson-section-label">Deep dive</p>
            <div className="resource-inline-row">
              {resources.slice(0, 3).map((resource) => (
                <a
                  key={resource.url}
                  className="inline-link inline-link-button"
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {resource.title}
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <div className="compact-actions">
        <button type="button" className="button button-primary" disabled={disabled} onClick={() => void onDone()}>
          {disabled ? "Removing..." : "Finished / remove"}
        </button>
      </div>
    </article>
  );
}

function LoadingCard({ topic }: { topic: Topic }) {
  return (
    <article className="daily-card daily-card-loading" aria-live="polite">
      <div className="daily-card-header">
        <div>
          <p className="mini-label">{CATEGORY_LABELS[topic.category]}</p>
          <h2>{topic.title}</h2>
        </div>
      </div>
      <div className="daily-card-loading-body">
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>Generating lesson...</p>
      </div>
    </article>
  );
}

export function DashboardPage() {
  const { data, setData, loading, generating, error, regenerateLesson, updateLessonStatus } =
    useDashboardData();
  const [newTopicInput, setNewTopicInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);
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

    return data.visibleLessons
      .filter((lesson) => lesson.status !== "learned")
      .map((lesson) => {
        const topic = topicsById.get(lesson.topicId);
        return topic ? { topic, lesson } : null;
      })
      .filter((value): value is TopicLessonCard => Boolean(value))
      .slice(0, 2);
  }, [data, topicsById]);

  const visibleCardSlots = useMemo<VisibleCardSlot[]>(() => {
    if (!data) {
      return [];
    }

    return data.visibleTopicIds
      .map((topicId) => {
        const topic = topicsById.get(topicId);

        if (!topic) {
          return null;
        }

        const lesson = data.visibleLessons.find((candidate) => candidate.topicId === topicId && candidate.status !== "learned");

        if (lesson) {
          return {
            type: "lesson" as const,
            topic,
            lesson
          };
        }

        return {
          type: "loading" as const,
          topic
        };
      })
      .filter((value): value is VisibleCardSlot => Boolean(value))
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

  const { state, visibleTopicIds } = data;
  const providerLabel = getProviderLabel(state.settings.provider.selectedProvider);
  const hasProviderKey = isSelectedProviderConfigured(state.settings.provider);
  const todaysCardTopicIds = new Set(todaysTopicCards.map(({ topic }) => topic.id));
  const pendingPlanTopics = visibleTopicIds
    .filter((topicId) => !data.visibleLessons.some((lesson) => lesson.topicId === topicId && lesson.status !== "learned"))
    .map((topicId) => topicsById.get(topicId))
    .filter((topic): topic is Topic => Boolean(topic));
  const latestGenerationAttempt = state.settings.provider.selectedProvider
    ? state.generationAttempts
        .filter((attempt) => attempt.providerId === state.settings.provider.selectedProvider)
        .filter((attempt) => visibleTopicIds.includes(attempt.topicId))
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
    !visibleCardSlots.length &&
    (loading || generating || isSubmittingTopic);

  async function importTopics(titles: string[]): Promise<void> {
    if (!titles.length) {
      return;
    }

    setIsSubmittingTopic(true);

    try {
      const result = await sendBackgroundMessage({ type: "topics/import", titles });
      setNewTopicInput("");
      setData(result.dashboard);
      setToast(result.createdCount ? "Topic added" : "Already exists");
    } finally {
      setIsSubmittingTopic(false);
    }
  }

  async function handleQuickAdd(): Promise<void> {
    await importTopics(titleFromLines(newTopicInput));
  }

  async function handleRemoveTopic(topicId: string): Promise<void> {
    const nextData = await sendBackgroundMessage({ type: "topics/remove", topicId });
    setData(nextData);
    setToast("Topic removed");
  }

  async function handleFinishLesson(lessonId: string): Promise<void> {
    if (pendingLessonIds.includes(lessonId)) {
      return;
    }

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
            <button type="button" className="button button-ghost" onClick={() => navigateCurrentExtensionPage("history.html")}>
              History
            </button>
            <button type="button" className="button button-ghost" onClick={() => navigateCurrentExtensionPage("options.html")}>
              Settings
            </button>
            <button
              type="button"
              className="button button-ghost"
              aria-label="GitHub repository"
              onClick={() => void openExternalUrl("https://github.com/EdwardGlockner/learner-extension")}
            >
              GitHub
            </button>
            <button type="button" className="button button-ghost button-icon" aria-label="About" onClick={() => navigateCurrentExtensionPage("about.html")}>
              ?
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
          onPaste={(event) => {
            const pastedText = event.clipboardData.getData("text");
            const pastedTitles = titleFromLines(pastedText);

            if (pastedTitles.length <= 1) {
              return;
            }

            event.preventDefault();
            void importTopics(pastedTitles);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleQuickAdd();
            }
          }}
          placeholder="Example: Attention LLM"
        />
        <button type="button" className="button button-primary" onClick={() => void handleQuickAdd()}>
          {isSubmittingTopic ? "Adding..." : "Add"}
        </button>
      </section>

      {error ? <div className="compact-banner compact-banner-error">{error}</div> : null}

      {hasProviderKey && visibleCardSlots.length ? (
        <section className="daily-grid">
          {visibleCardSlots.map((slot) =>
            slot.type === "lesson" ? (
              <DailyCard
                key={slot.lesson.id}
                title={slot.topic.title}
                category={CATEGORY_LABELS[slot.topic.category]}
                explanation={slot.lesson.content.explanation}
                whyItMatters={slot.lesson.content.whyItMatters}
                examples={slot.lesson.content.examples}
                pitfalls={slot.lesson.content.pitfalls}
                nextSteps={slot.lesson.content.nextSteps}
                resources={getCuratedResources(slot.topic, slot.lesson.content.resources)}
                disabled={pendingLessonIds.includes(slot.lesson.id)}
                onDone={() => handleFinishLesson(slot.lesson.id)}
              />
            ) : (
              <LoadingCard key={`loading-${slot.topic.id}`} topic={slot.topic} />
            )
          )}
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
            error
              ? error
              : hasProviderKey
              ? latestGenerationAttempt?.lastError
                ? retryMessage
                  ? `${latestGenerationAttempt.lastError} ${retryMessage}`
                  : latestGenerationAttempt.lastError
                : visibleTopicIds.length
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
                  <button type="button" className="queue-inline-button" onClick={() => void regenerateLesson(topic.id).catch(() => undefined)}>
                    <span>{topic.title}</span>
                    <small>{CATEGORY_LABELS[topic.category]}</small>
                  </button>
                  <button type="button" className="button button-ghost button-danger" onClick={() => void handleRemoveTopic(topic.id)}>
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
