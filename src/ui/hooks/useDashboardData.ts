import { useCallback, useEffect, useState } from "react";
import { selectVisibleTopics } from "../../domain/planner";
import { sendBackgroundMessage } from "../../lib/messages";
import { isSelectedProviderConfigured } from "../../providers";
import type { DashboardData, LessonGenerationAttempt, LessonStatus } from "../../shared/types";

const GENERATION_POLL_INTERVAL_MS = 1500;
const GENERATION_POLL_TIMEOUT_MS = 45000;

function getMissingVisibleTopicIds(data: DashboardData): string[] {
  return data.visibleTopicIds.filter((topicId) => !data.visibleLessons.some((lesson) => lesson.topicId === topicId));
}

function getLatestVisibleAttempt(data: DashboardData): LessonGenerationAttempt | undefined {
  const providerId = data.state.settings.provider.selectedProvider;

  if (!providerId) {
    return undefined;
  }

  return data.state.generationAttempts
    .filter((attempt) => attempt.providerId === providerId)
    .filter((attempt) => data.visibleTopicIds.includes(attempt.topicId))
    .sort((left, right) => right.lastAttemptAt.localeCompare(left.lastAttemptAt))[0];
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAutoGenerateKey, setLastAutoGenerateKey] = useState<string | null>(null);

  const load = useCallback(async (type: "dashboard/load" | "dashboard/refresh") => {
    try {
      setLoading(true);
      const nextData = await sendBackgroundMessage({ type });
      setData(nextData);
      setLastAutoGenerateKey(null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("dashboard/load");
  }, [load]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!isSelectedProviderConfigured(data.state.settings.provider)) {
      return;
    }

    const missingTopicIds = getMissingVisibleTopicIds(data);

    if (!missingTopicIds.length) {
      return;
    }

    const autoGenerateKey = `${missingTopicIds.join(",")}`;

    if (lastAutoGenerateKey === autoGenerateKey || generating) {
      return;
    }

    setLastAutoGenerateKey(autoGenerateKey);
    setGenerating(true);

    void sendBackgroundMessage({ type: "dashboard/generate-missing" })
      .then((nextData) => {
        setData(nextData);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Failed to generate lessons.");
        setGenerating(false);
      });
  }, [data, generating, lastAutoGenerateKey]);

  useEffect(() => {
    if (!data || !generating) {
      return;
    }

    const startedAt = Date.now();
    let cancelled = false;

    const poll = async () => {
      try {
        const nextData = await sendBackgroundMessage({ type: "dashboard/load" });

        if (cancelled) {
          return;
        }

        setData(nextData);
        const missingTopicIds = getMissingVisibleTopicIds(nextData);

        if (!missingTopicIds.length) {
          setGenerating(false);
          setError(null);
          return;
        }

        const latestAttempt = getLatestVisibleAttempt(nextData);

        if (latestAttempt?.lastError) {
          setGenerating(false);
          setError(latestAttempt.lastError);
          return;
        }

        if (Date.now() - startedAt >= GENERATION_POLL_TIMEOUT_MS) {
          setGenerating(false);
          setError("Lesson generation is taking longer than expected. Keep Ollama running and try again.");
          return;
        }

        void sendBackgroundMessage({ type: "dashboard/generate-missing" }).catch(() => undefined);
      } catch (reason) {
        if (cancelled) {
          return;
        }

        setGenerating(false);
        setError(reason instanceof Error ? reason.message : "Failed to refresh lesson generation.");
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, GENERATION_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [data, generating]);

  useEffect(() => {
    const handleFocus = () => {
      void load("dashboard/load");
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setLastAutoGenerateKey(null);
    await load("dashboard/refresh");
  }, [load]);

  const reload = useCallback(async () => {
    await load("dashboard/load");
  }, [load]);

  const updateLessonStatus = useCallback(async (lessonId: string, status: LessonStatus) => {
    setData((current) => {
      if (!current) {
        return current;
      }

      const updatedState = {
        ...current.state,
        lessons: current.state.lessons.map((lesson) =>
          lesson.id === lessonId ? { ...lesson, status, updatedAt: new Date().toISOString() } : lesson
        ),
        topics: current.state.topics.map((topic) => {
          const lesson = current.state.lessons.find((candidate) => candidate.id === lessonId);

          if (!lesson || topic.id !== lesson.topicId) {
            return topic;
          }

          return status === "learned" ? { ...topic, status: "learned" as const } : topic;
        })
      };
      const visibleTopicIds = selectVisibleTopics(
        updatedState.topics.filter((topic) => topic.status !== "learned" && topic.status !== "paused"),
        2
      ).map((topic) => topic.id);
      const visibleLessons = visibleTopicIds
        .map((topicId) =>
          updatedState.lessons
            .filter((lesson) => lesson.topicId === topicId && lesson.status !== "learned")
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
        )
        .filter((lesson): lesson is NonNullable<(typeof updatedState.lessons)[number]> => Boolean(lesson));

      return {
        state: updatedState,
        visibleTopicIds,
        visibleLessons
      };
    });

    const nextData = await sendBackgroundMessage({ type: "lessons/update-status", lessonId, status });
    setData(nextData);
    setError(null);
  }, []);

  const regenerateLesson = useCallback(async (topicId: string) => {
    await sendBackgroundMessage({ type: "lessons/refresh-topic", topicId });
    await load("dashboard/load");
  }, [load]);

  return {
    data,
    setData,
    loading,
    generating,
    error,
    reload,
    refresh,
    updateLessonStatus,
    regenerateLesson
  };
}
