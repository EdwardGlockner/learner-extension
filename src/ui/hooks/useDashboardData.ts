import { useCallback, useEffect, useState } from "react";
import { sendBackgroundMessage } from "../../lib/messages";
import type { DashboardData, LessonStatus } from "../../shared/types";

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    await load("dashboard/refresh");
  }, [load]);

  const updateLessonStatus = useCallback(async (lessonId: string, status: LessonStatus) => {
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
    loading,
    error,
    refresh,
    updateLessonStatus,
    regenerateLesson
  };
}
