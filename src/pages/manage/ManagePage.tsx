import { useEffect, useMemo, useState } from "react";
import { inferTopicSuggestion } from "../../domain/topicInference";
import { createId } from "../../lib/id";
import { sendBackgroundMessage } from "../../lib/messages";
import { normalizeTitle, titleFromLines } from "../../lib/strings";
import { applyTheme } from "../../lib/theme";
import { CATEGORY_LABELS } from "../../shared/constants";
import { TOPIC_CATEGORIES } from "../../shared/types";
import type { ExtensionState, Topic } from "../../shared/types";
import { loadState, replaceState } from "../../storage/state";
import { EmptyState } from "../../ui/components/EmptyState";
import { SectionCard } from "../../ui/components/SectionCard";
import { useStoredState } from "../../ui/hooks/useStoredState";
import { AppShell } from "../../ui/layout/AppShell";

type TopicEditor = {
  id?: string;
  title: string;
  description: string;
  category: Topic["category"];
  difficulty: Topic["difficulty"];
  tags: string;
  prerequisites: string[];
  status: Topic["status"];
};

function editorFromTopic(topic?: Topic): TopicEditor {
  return {
    id: topic?.id,
    title: topic?.title ?? "",
    description: topic?.description ?? "",
    category: topic?.category ?? "llm-fundamentals",
    difficulty: topic?.difficulty ?? 2,
    tags: topic?.tags.join(", ") ?? "",
    prerequisites: topic?.prerequisites ?? [],
    status: topic?.status ?? "active"
  };
}

function reorderTopics(state: ExtensionState, topicId: string, direction: -1 | 1): ExtensionState {
  const topics = [...state.topics].sort((a, b) => a.manuallyOrderedIndex - b.manuallyOrderedIndex);
  const index = topics.findIndex((topic) => topic.id === topicId);
  const targetIndex = index + direction;

  if (index < 0 || targetIndex < 0 || targetIndex >= topics.length) {
    return state;
  }

  const [moved] = topics.splice(index, 1);
  topics.splice(targetIndex, 0, moved);

  return {
    ...state,
    topics: topics.map((topic, position) => ({
      ...topic,
      manuallyOrderedIndex: position,
      updatedAt: new Date().toISOString()
    }))
  };
}

export function ManagePage() {
  const { state, loading, error, setState } = useStoredState();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"existing" | "new">("existing");
  const [editor, setEditor] = useState<TopicEditor>(editorFromTopic());
  const [batchImport, setBatchImport] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (state) {
      applyTheme(state.settings.ui.theme);
      if (!selectedTopicId && editorMode === "existing" && state.topics.length) {
        setSelectedTopicId(state.topics[0].id);
      }
    }
  }, [editorMode, selectedTopicId, state]);

  const sortedTopics = useMemo(
    () => [...(state?.topics ?? [])].sort((a, b) => a.manuallyOrderedIndex - b.manuallyOrderedIndex),
    [state]
  );

  useEffect(() => {
    if (!state) {
      return;
    }

    if (editorMode === "new") {
      setEditor(editorFromTopic());
      return;
    }

    const selectedTopic = sortedTopics.find((topic) => topic.id === selectedTopicId);
    setEditor(editorFromTopic(selectedTopic));
  }, [editorMode, selectedTopicId, sortedTopics, state]);

  async function persist(nextState: ExtensionState, message: string): Promise<void> {
    const saved = await replaceState(nextState);
    setState(saved);
    setFlash(message);
  }

  if (loading && !state) {
    return (
      <AppShell activePage="manage" title="Topic management" subtitle="Loading topic queue.">
        <div className="management-grid">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </AppShell>
    );
  }

  if (!state) {
    return (
      <AppShell activePage="manage" title="Topic management" subtitle="Topic manager unavailable.">
        <EmptyState title="Unable to load topics" body={error ?? "No state available."} />
      </AppShell>
    );
  }

  const currentState = state;
  const selectedTopic = sortedTopics.find((topic) => topic.id === selectedTopicId);

  async function handleSave(): Promise<void> {
    const now = new Date().toISOString();
    const existing = currentState.topics.find((topic) => topic.id === editor.id);
    const tags = editor.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!editor.title.trim()) {
      setFlash("Topic title is required.");
      return;
    }

    if (existing) {
      await persist(
        {
          ...currentState,
          topics: currentState.topics.map((topic) =>
            topic.id === existing.id
              ? {
                  ...topic,
                  title: editor.title.trim(),
                  normalizedTitle: normalizeTitle(editor.title),
                  description: editor.description.trim(),
                  category: editor.category,
                  difficulty: Number(editor.difficulty) as Topic["difficulty"],
                  tags,
                  prerequisites: editor.prerequisites,
                  status: editor.status,
                  updatedAt: now
                }
              : topic
          )
        },
        "Topic updated."
      );
      return;
    }

    const suggestion = inferTopicSuggestion(editor.title);
    const topic: Topic = {
      id: createId("topic"),
      title: editor.title.trim(),
      normalizedTitle: normalizeTitle(editor.title),
      description: editor.description.trim(),
      category: editor.category || suggestion.category,
      difficulty: Number(editor.difficulty) as Topic["difficulty"],
      tags: tags.length ? tags : suggestion.tags,
      prerequisites: editor.prerequisites,
      manuallyOrderedIndex: currentState.topics.length,
      status: editor.status,
      timesShown: 0,
      timesLearned: 0,
      createdAt: now,
      updatedAt: now,
      source: "user"
    };
    const nextState = { ...currentState, topics: [...currentState.topics, topic] };
    await persist(nextState, "Topic created.");
    setSelectedTopicId(topic.id);
    setEditorMode("existing");
  }

  async function handleDelete(): Promise<void> {
    if (!selectedTopic) {
      return;
    }

    const remainingTopics = currentState.topics
      .filter((topic) => topic.id !== selectedTopic.id)
      .map((topic, index) => ({
        ...topic,
        prerequisites: topic.prerequisites.filter((dependencyId) => dependencyId !== selectedTopic.id),
        manuallyOrderedIndex: index
      }));

    await persist({ ...currentState, topics: remainingTopics }, "Topic deleted.");
    setSelectedTopicId(remainingTopics[0]?.id ?? null);
    setEditorMode(remainingTopics.length ? "existing" : "new");
  }

  async function handleImport(): Promise<void> {
    const titles = titleFromLines(batchImport);

    if (!titles.length) {
      setFlash("Paste one topic per line or comma-separated.");
      return;
    }

    const imported = await sendBackgroundMessage({ type: "topics/import", titles });
    setState(imported.dashboard.state);
    setBatchImport("");
    setFlash(`Imported ${imported.createdCount} new topics.`);
  }

  return (
    <AppShell
      activePage="manage"
      title="Topic management"
      subtitle="Edit the queue, set dependencies, import topics in bulk, and shape the order the scheduler sees."
      actions={
        <div className="button-row">
          <button
            className="button"
            onClick={() => {
              setEditorMode("new");
              setSelectedTopicId(null);
              setEditor(editorFromTopic());
            }}
          >
            New topic
          </button>
          <a className="button" href="/dashboard.html">
            Back to dashboard
          </a>
        </div>
      }
    >
      <div className="management-grid">
        <SectionCard title="Queue" kicker="Ordered topic list">
          {flash ? <div className="helper-box">{flash}</div> : null}
          {sortedTopics.length ? (
            <ul className="topic-list">
              {sortedTopics.map((topic) => (
                <li
                  key={topic.id}
                  className={topic.id === selectedTopicId ? "topic-list-item topic-list-item-active" : "topic-list-item"}
                >
                  <div className="topic-title-row">
                    <button
                      className="button button-ghost"
                      onClick={() => {
                        setEditorMode("existing");
                        setSelectedTopicId(topic.id);
                      }}
                    >
                      {topic.title}
                    </button>
                    <span className="pill">{CATEGORY_LABELS[topic.category]}</span>
                  </div>
                  <p className="helper-text">
                    Difficulty {topic.difficulty} • {topic.status} • shown {topic.timesShown} times
                  </p>
                  <div className="button-row">
                    <button
                      className="button button-ghost"
                      onClick={() => void persist(reorderTopics(currentState, topic.id, -1), "Topic moved up.")}
                    >
                      Move up
                    </button>
                    <button
                      className="button button-ghost"
                      onClick={() => void persist(reorderTopics(currentState, topic.id, 1), "Topic moved down.")}
                    >
                      Move down
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No topics yet" body="Create your first topic or import a list." />
          )}
        </SectionCard>

        <div className="lesson-stack">
          <SectionCard title={selectedTopic ? "Edit topic" : "Create topic"} kicker="Topic editor">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="topic-title">Title</label>
                <input
                  id="topic-title"
                  value={editor.title}
                  onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: Attention"
                />
              </div>
              <div className="field">
                <label htmlFor="topic-description">Description</label>
                <textarea
                  id="topic-description"
                  value={editor.description}
                  onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Optional note to help the LLM personalize the lesson."
                />
              </div>
              <div className="form-grid-two">
                <div className="field">
                  <label htmlFor="topic-category">Category</label>
                  <select
                    id="topic-category"
                    value={editor.category}
                    onChange={(event) =>
                      setEditor((current) => ({ ...current, category: event.target.value as Topic["category"] }))
                    }
                  >
                    {TOPIC_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="topic-difficulty">Difficulty</label>
                  <select
                    id="topic-difficulty"
                    value={editor.difficulty}
                    onChange={(event) =>
                      setEditor((current) => ({
                        ...current,
                        difficulty: Number(event.target.value) as Topic["difficulty"]
                      }))
                    }
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-grid-two">
                <div className="field">
                  <label htmlFor="topic-status">Status</label>
                  <select
                    id="topic-status"
                    value={editor.status}
                    onChange={(event) =>
                      setEditor((current) => ({ ...current, status: event.target.value as Topic["status"] }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="learned">Learned</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="topic-tags">Tags</label>
                  <input
                    id="topic-tags"
                    value={editor.tags}
                    onChange={(event) => setEditor((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="foundations, transformers"
                  />
                </div>
              </div>
              <div className="field">
                <label>Manual prerequisites</label>
                <div className="checkbox-grid">
                  {sortedTopics
                    .filter((topic) => topic.id !== editor.id)
                    .map((topic) => {
                      const checked = editor.prerequisites.includes(topic.id);
                      return (
                        <label key={topic.id} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setEditor((current) => ({
                                ...current,
                                prerequisites: event.target.checked
                                  ? [...current.prerequisites, topic.id]
                                  : current.prerequisites.filter((item) => item !== topic.id)
                              }))
                            }
                          />
                          <span>{topic.title}</span>
                        </label>
                      );
                    })}
                </div>
                <small>Keyword inference still runs in the planner. These checkboxes act as manual overrides.</small>
              </div>
              <div className="button-row">
                <button className="button button-primary" onClick={() => void handleSave()}>
                  Save topic
                </button>
                {selectedTopic ? (
                  <button className="button button-danger" onClick={() => void handleDelete()}>
                    Delete topic
                  </button>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Batch import" kicker="Paste topics">
            <div className="field">
              <label htmlFor="batch-import">Add many topics</label>
              <textarea
                id="batch-import"
                value={batchImport}
                onChange={(event) => setBatchImport(event.target.value)}
                placeholder={"Context\nAttention\nDocker"}
              />
              <small>One topic per line or comma-separated. Duplicate normalized titles are ignored.</small>
            </div>
            <button className="button button-primary" onClick={() => void handleImport()}>
              Import topics
            </button>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
