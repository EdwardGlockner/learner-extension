import { useCallback, useEffect, useState } from "react";
import { selectVisibleTopics } from "../../domain/planner";
import { sendBackgroundMessage } from "../../lib/messages";
import { isSelectedProviderConfigured } from "../../providers";
import type { DashboardData, LessonStatus } from "../../shared/types";

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

    const missingTopicIds = data.visibleTopicIds.filter((topicId) => !data.visibleLessons.some((lesson) => lesson.topicId === topicId));

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
        setError(null);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Failed to generate lessons.");
      })
      .finally(() => {
        setGenerating(false);
      });
  }, [data, generating, lastAutoGenerateKey]);

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
