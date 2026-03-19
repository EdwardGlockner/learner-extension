import { openExtensionPopupWindow, browserApi } from "../lib/browserApi";
import { createId } from "../lib/id";
import { getDateKey, nextReminderAt } from "../lib/time";
import { filterReachableResources } from "../domain/resources";
import { selectVisibleTopics, sortTopicsByLearningOrder } from "../domain/planner";
import { getProvider, isSelectedProviderConfigured } from "../providers";
import { DASHBOARD_PATH, PROMPT_TEMPLATE_VERSION, REMINDER_ALARM_ID } from "../shared/constants";
import type {
  DashboardData,
  ExtensionState,
  LessonGeneration,
  LessonGenerationAttempt,
  LessonStatus,
  ProviderId,
  Topic
} from "../shared/types";
import { initializeStateIfNeeded, loadState, replaceState } from "../storage/state";
import { getTopicById } from "../storage/selectors";

let activeDashboardGeneration: Promise<void> | null = null;

async function generateLessonForTopic(
  state: Awaited<ReturnType<typeof loadState>>,
  topic: Topic,
  dateKey: string
): Promise<LessonGeneration | null> {
  const relatedTopics = state.topics
    .filter((candidate) => candidate.id !== topic.id)
    .filter((candidate) => candidate.category === topic.category || candidate.tags.some((tag) => topic.tags.includes(tag)))
    .slice(0, 3);

  const provider = getProvider(state.settings.provider.selectedProvider);
  const now = new Date().toISOString();

  if (!provider || !isSelectedProviderConfigured(state.settings.provider)) {
    return null;
  }

  const result = await provider.generateLesson({
    topic,
    relatedTopics,
    settings: state.settings.provider
  });

  return {
    id: createId("lesson"),
    topicId: topic.id,
    dateKey,
    providerId: result.providerId,
    model: result.model,
    promptVersion: PROMPT_TEMPLATE_VERSION,
    content: {
      explanation: result.explanation,
      whyItMatters: result.whyItMatters,
      examples: result.examples,
      pitfalls: result.pitfalls,
      nextSteps: result.nextSteps,
      resources: await filterReachableResources(result.resources)
    },
    status: "new",
    createdAt: now,
    updatedAt: now
  };
}

function touchTopics(topics: Topic[], selectedIds: string[]): Topic[] {
  const now = new Date().toISOString();

  return topics.map((topic) =>
    selectedIds.includes(topic.id)
      ? {
          ...topic,
          timesShown: topic.timesShown + 1,
          lastShownAt: now,
          updatedAt: now
        }
      : topic
  );
}

function sameTopicIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function laterIsoDate(left?: string, right?: string): string | undefined {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left >= right ? left : right;
}

function mergeTouchedTopics(latestTopics: Topic[], touchedTopics: Topic[], touchedTopicIds: string[]): Topic[] {
  const touchedIds = new Set(touchedTopicIds);
  const touchedMap = new Map(touchedTopics.map((topic) => [topic.id, topic]));

  return latestTopics.map((topic) => {
    if (!touchedIds.has(topic.id)) {
      return topic;
    }

    const touchedTopic = touchedMap.get(topic.id);

    if (!touchedTopic) {
      return topic;
    }

    return {
      ...topic,
      timesShown: Math.max(topic.timesShown, touchedTopic.timesShown),
      lastShownAt: laterIsoDate(topic.lastShownAt, touchedTopic.lastShownAt),
      updatedAt: laterIsoDate(topic.updatedAt, touchedTopic.updatedAt) ?? topic.updatedAt
    };
  });
}

function mergeLessons(existingLessons: LessonGeneration[], newLessons: LessonGeneration[]): LessonGeneration[] {
  const byId = new Map(existingLessons.map((lesson) => [lesson.id, lesson]));

  for (const lesson of newLessons) {
    byId.set(lesson.id, lesson);
  }

  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function getVisibleTopicIds(state: ExtensionState): string[] {
  return selectVisibleTopics(
    state.topics.filter((topic) => topic.status !== "learned" && topic.status !== "paused")
  )
    .slice(0, 2)
    .map((topic) => topic.id);
}

function getVisibleLessons(state: ExtensionState, topicIds: string[]): LessonGeneration[] {
  return topicIds
    .map((topicId) =>
      state.lessons
        .filter((lesson) => lesson.topicId === topicId && lesson.status !== "learned")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    )
    .filter((lesson): lesson is LessonGeneration => Boolean(lesson));
}

function getGenerationAttempt(
  state: ExtensionState,
  topicId: string,
  dateKey: string,
  providerId: ProviderId
): LessonGenerationAttempt | undefined {
  return state.generationAttempts.find(
    (attempt) => attempt.topicId === topicId && attempt.dateKey === dateKey && attempt.providerId === providerId
  );
}

function shouldAttemptGeneration(
  state: ExtensionState,
  topicId: string,
  dateKey: string,
  providerId: ProviderId
): boolean {
  const attempt = getGenerationAttempt(state, topicId, dateKey, providerId);

  if (!attempt?.nextRetryAt) {
    return true;
  }

  return new Date(attempt.nextRetryAt).getTime() <= Date.now();
}

function getRetryDelaySeconds(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const explicitSeconds = message.match(/about\s+(\d+)\s+seconds/i) ?? message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);

  if (explicitSeconds) {
    return Math.max(15, Math.ceil(Number(explicitSeconds[1])));
  }

  if (/quota|resource_exhausted|429/i.test(message)) {
    return 60;
  }

  return 180;
}

function upsertGenerationAttempt(
  state: ExtensionState,
  topicId: string,
  dateKey: string,
  providerId: ProviderId,
  error: unknown
): ExtensionState {
  const now = new Date();
  const retrySeconds = getRetryDelaySeconds(error);
  const nextRetryAt = new Date(now.getTime() + retrySeconds * 1000).toISOString();
  const lastError = error instanceof Error ? error.message : "Lesson generation failed.";
  const nextAttempt: LessonGenerationAttempt = {
    topicId,
    dateKey,
    providerId,
    lastAttemptAt: now.toISOString(),
    nextRetryAt,
    lastError
  };

  return {
    ...state,
    generationAttempts: [
      ...state.generationAttempts.filter(
        (attempt) =>
          !(attempt.topicId === topicId && attempt.dateKey === dateKey && attempt.providerId === providerId)
      ),
      nextAttempt
    ]
  };
}

function clearGenerationAttempt(
  state: ExtensionState,
  topicId: string,
  dateKey: string,
  providerId: ProviderId
): ExtensionState {
  return {
    ...state,
    generationAttempts: state.generationAttempts.filter(
      (attempt) => !(attempt.topicId === topicId && attempt.dateKey === dateKey && attempt.providerId === providerId)
    )
  };
}

export async function ensureDashboardData(dateKey = getDateKey()): Promise<DashboardData> {
  return ensureDashboardDataInternal(dateKey, true);
}

export async function loadDashboardData(dateKey = getDateKey()): Promise<DashboardData> {
  return ensureDashboardDataInternal(dateKey, false);
}

export async function startDashboardGeneration(dateKey = getDateKey()): Promise<DashboardData> {
  const dashboardData = await loadDashboardData(dateKey);
  const providerId = dashboardData.state.settings.provider.selectedProvider;

  if (!providerId) {
    return dashboardData;
  }

  const missingTopicIds = dashboardData.visibleTopicIds.filter(
    (topicId) => !dashboardData.visibleLessons.some((lesson) => lesson.topicId === topicId)
  );
  const hasEligibleMissingTopics = missingTopicIds.some((topicId) =>
    shouldAttemptGeneration(dashboardData.state, topicId, dateKey, providerId)
  );

  if (!hasEligibleMissingTopics) {
    return dashboardData;
  }

  if (!activeDashboardGeneration) {
    activeDashboardGeneration = ensureDashboardDataInternal(dateKey, true)
      .then(() => undefined)
      .catch((error) => {
        console.error("Background lesson generation failed", error);
      })
      .finally(() => {
        activeDashboardGeneration = null;
      });
  }

  return dashboardData;
}

async function ensureDashboardDataInternal(dateKey: string, shouldGenerateMissing: boolean): Promise<DashboardData> {
  let state = await loadState();
  let shouldPersistState = false;
  let visibleTopicIds = getVisibleTopicIds(state);
  const previouslyShownIds = new Set(
    state.topics.filter((topic) => topic.lastShownAt && topic.status !== "learned").map((topic) => topic.id)
  );
  const nextTopicIdsToTouch = visibleTopicIds.filter((topicId) => !previouslyShownIds.has(topicId));

  if (nextTopicIdsToTouch.length) {
    state = {
      ...state,
      topics: touchTopics(state.topics, nextTopicIdsToTouch)
    };
    shouldPersistState = true;
  }

  const lessons = getVisibleLessons(state, visibleTopicIds);
  const providerId = state.settings.provider.selectedProvider;
  const missingTopicIds = visibleTopicIds.filter((topicId) => !lessons.some((lesson) => lesson.topicId === topicId));
  const eligibleTopicIds = providerId
    ? missingTopicIds.filter((topicId) => shouldAttemptGeneration(state, topicId, dateKey, providerId))
    : [];

  if (shouldGenerateMissing && eligibleTopicIds.length) {
    const newLessons: LessonGeneration[] = [];
    const topicId = eligibleTopicIds[0];
    const topic = topicId ? getTopicById(state, topicId) : undefined;

    if (topic) {
      try {
        const lesson = await generateLessonForTopic(state, topic, dateKey);

        if (lesson) {
          newLessons.push(lesson);
          state = clearGenerationAttempt(state, topicId, dateKey, lesson.providerId as ProviderId);
        }
      } catch (error) {
        if (providerId) {
          state = upsertGenerationAttempt(state, topicId, dateKey, providerId, error);
        }
        console.error("Lesson generation failed", {
          topicId,
          error
        });
      }
    }
    const latestState = await loadState();
    const nextState = {
      ...latestState,
      topics: mergeTouchedTopics(latestState.topics, state.topics, nextTopicIdsToTouch),
      lessons: mergeLessons(latestState.lessons, newLessons),
      generationAttempts: state.generationAttempts
    };

    state = nextState;
    shouldPersistState = true;
  } else if (nextTopicIdsToTouch.length) {
    const latestState = await loadState();
    state = {
      ...latestState,
      topics: mergeTouchedTopics(latestState.topics, state.topics, nextTopicIdsToTouch)
    };
    shouldPersistState = true;
  }

  visibleTopicIds = getVisibleTopicIds(state);

  if (shouldPersistState) {
    await replaceState(state);
  }

  return {
    state,
    visibleTopicIds,
    visibleLessons: getVisibleLessons(state, visibleTopicIds)
  };
}

export async function refreshLesson(topicId: string, dateKey = getDateKey()): Promise<LessonGeneration> {
  let state = await loadState();
  const topic = getTopicById(state, topicId);
  const providerId = state.settings.provider.selectedProvider;

  if (!topic) {
    throw new Error("Topic is missing.");
  }

  let nextLesson: LessonGeneration | null = null;

  try {
    nextLesson = await generateLessonForTopic(state, topic, dateKey);
  } catch (error) {
    if (providerId) {
      state = upsertGenerationAttempt(state, topicId, dateKey, providerId, error);
      await replaceState(state);
    }

    throw error;
  }

  if (!nextLesson) {
    throw new Error("Add a provider API key in Settings before generating lessons.");
  }
  const latestState = await loadState();
  const clearedState = clearGenerationAttempt(latestState, topicId, dateKey, nextLesson.providerId as ProviderId);
  const replacedLessons = clearedState.lessons.filter(
    (lesson) => !(lesson.topicId === topicId && lesson.dateKey === dateKey)
  );

  await replaceState({
    ...clearedState,
    lessons: [...replacedLessons, nextLesson]
  });

  return nextLesson;
}

export async function updateLessonStatus(lessonId: string, status: LessonStatus): Promise<void> {
  const state = await loadState();
  const lesson = state.lessons.find((candidate) => candidate.id === lessonId);

  if (!lesson) {
    throw new Error("Lesson not found.");
  }

  const now = new Date().toISOString();
  const latestState = await loadState();
  const latestLesson = latestState.lessons.find((candidate) => candidate.id === lessonId);

  if (!latestLesson) {
    throw new Error("Lesson not found.");
  }

  const mergedLessons = latestState.lessons.map((candidate) =>
    candidate.id === lessonId
      ? {
          ...candidate,
          status,
          updatedAt: now
        }
      : candidate
  );

  const mergedTopics = latestState.topics.map((topic) => {
    if (topic.id !== latestLesson.topicId) {
      return topic;
    }

    if (status === "learned") {
      return {
        ...topic,
        timesLearned: topic.timesLearned + 1,
        lastLearnedAt: now,
        status: "learned" as const,
        updatedAt: now
      };
    }

    if (status === "not-now" || status === "continue-later" || status === "review") {
      return {
        ...topic,
        status: "active" as const,
        updatedAt: now
      };
    }

    return topic;
  });

  await replaceState({ ...latestState, lessons: mergedLessons, topics: mergedTopics });
}

async function setReminderStatus(status: "idle" | "sent" | "unavailable" | "failed", error?: string): Promise<void> {
  const state = await loadState();
  await replaceState({
    ...state,
    settings: {
      ...state.settings,
      reminders: {
        ...state.settings.reminders,
        lastNotificationStatus: status,
        lastNotificationError: error
      }
    }
  });
}

export async function scheduleReminder(): Promise<void> {
  const state = await loadState();

  await browserApi.alarms.clear(REMINDER_ALARM_ID);

  if (!state.settings.reminders.enabled) {
    await setReminderStatus("idle");
    return;
  }

  const next = nextReminderAt(
    state.settings.reminders.time,
    state.settings.reminders.quietWeekends,
    new Date(),
    state.settings.reminders.timezoneMode,
    state.settings.reminders.fixedOffsetMinutes
  );
  await browserApi.alarms.create(REMINDER_ALARM_ID, { when: next.getTime() });
}

export async function validateProviderConnection() {
  const state = await loadState();
  const provider = getProvider(state.settings.provider.selectedProvider);

  if (!provider) {
    return {
      ok: false,
      message: "No provider selected."
    };
  }

  try {
    return await provider.validateConnection(state.settings.provider);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Connection check failed."
    };
  }
}

export async function sendReminderNotification(force = false): Promise<{ success: boolean; message: string }> {
  const { state, visibleTopicIds } = await ensureDashboardData();

  if (!force && !visibleTopicIds.length) {
    return {
      success: false,
      message: "No queued cards are ready, so no reminder was sent."
    };
  }

  try {
    await browserApi.notifications.create("learning-plugin-reminder", {
      type: "basic",
      iconUrl: browserApi.runtime.getURL("icons/icon128.png"),
      title: force ? "learning-plugin test reminder" : "Your learning cards are ready",
      message: force
        ? "Notifications are working."
        : `You have ${visibleTopicIds.length} topics ready in learning-plugin.`
    });
    await setReminderStatus("sent");
    return {
      success: true,
      message: force
        ? "Test reminder sent. If you do not see a system notification, check Firefox notification permissions and your OS Do Not Disturb settings."
        : "Reminder sent."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notifications are unavailable in this browser.";
    await setReminderStatus(
      "failed",
      message
    );
    return {
      success: false,
      message: `Reminder failed: ${message}`
    };
  } finally {
    await scheduleReminder();
  }
}

export async function openDashboard(): Promise<void> {
  await openExtensionPopupWindow(DASHBOARD_PATH, 980, 760);
}

export async function bootstrapExtension(): Promise<void> {
  await initializeStateIfNeeded();
  await scheduleReminder();
}
