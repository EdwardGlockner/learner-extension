import { openExtensionPopupWindow, browserApi } from "../lib/browserApi";
import { createId } from "../lib/id";
import { getDateKey, nextReminderAt } from "../lib/time";
import { buildDailyPlan } from "../domain/planner";
import { getProvider, getSelectedProviderApiKey } from "../providers";
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
import { getDailyPlan, getLessonsForPlan, getTopicById } from "../storage/selectors";

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

  if (!provider || !getSelectedProviderApiKey(state.settings.provider)) {
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
      resources: result.resources
    },
    status: "new",
    createdAt: now,
    updatedAt: now
  };
}

function touchTopicsForPlan(topics: Topic[], selectedIds: string[]): Topic[] {
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
  let state = await loadState();
  let plan = getDailyPlan(state, dateKey);
  const nextCandidatePlan = buildDailyPlan(state, dateKey);

  if (!plan || !sameTopicIds(plan.topicIds, nextCandidatePlan.topicIds)) {
    const previousTopicIds = new Set(plan?.topicIds ?? []);
    const nextTopicIdsToTouch = nextCandidatePlan.topicIds.filter((topicId) => !previousTopicIds.has(topicId));
    plan = nextCandidatePlan;
    state = {
      ...state,
      topics: touchTopicsForPlan(state.topics, nextTopicIdsToTouch),
      dailyPlans: [...state.dailyPlans.filter((candidate) => candidate.dateKey !== dateKey), plan]
    };
  }

  const lessons = getLessonsForPlan(state, plan);
  const providerId = state.settings.provider.selectedProvider;
  const missingTopicIds = plan.topicIds.filter((topicId) => !lessons.some((lesson) => lesson.topicId === topicId));
  const eligibleTopicIds = providerId
    ? missingTopicIds.filter((topicId) => shouldAttemptGeneration(state, topicId, dateKey, providerId))
    : [];

  if (eligibleTopicIds.length) {
    const newLessons: LessonGeneration[] = [];

    for (const topicId of eligibleTopicIds) {
      const topic = getTopicById(state, topicId);

      if (!topic) {
        continue;
      }

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

    const lessonIds = [...plan.lessonIds, ...newLessons.map((lesson) => lesson.id)];
    const nextPlan = { ...plan, lessonIds };
    state = {
      ...state,
      lessons: [...state.lessons, ...newLessons],
      dailyPlans: [...state.dailyPlans.filter((candidate) => candidate.dateKey !== dateKey), nextPlan]
    };
    plan = nextPlan;
  }

  await replaceState(state);

  return {
    state,
    todaysPlan: plan,
    todaysLessons: getLessonsForPlan(state, plan)
  };
}

export async function refreshLesson(topicId: string, dateKey = getDateKey()): Promise<LessonGeneration> {
  let state = await loadState();
  const topic = getTopicById(state, topicId);
  const plan = getDailyPlan(state, dateKey);
  const providerId = state.settings.provider.selectedProvider;

  if (!topic || !plan) {
    throw new Error("Topic or today's plan is missing.");
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
  const replacedLessons = state.lessons.filter(
    (lesson) => !(lesson.topicId === topicId && lesson.dateKey === dateKey)
  );
  const existingLessonIds = plan.lessonIds.filter((lessonId) => {
    const lesson = state.lessons.find((candidate) => candidate.id === lessonId);
    return lesson?.topicId !== topicId;
  });
  const nextPlan = {
    ...plan,
    lessonIds: [...existingLessonIds, nextLesson.id]
  };

  await replaceState({
    ...clearGenerationAttempt(state, topicId, dateKey, nextLesson.providerId as ProviderId),
    lessons: [...replacedLessons, nextLesson],
    dailyPlans: [...state.dailyPlans.filter((candidate) => candidate.dateKey !== dateKey), nextPlan]
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
  const lessons = state.lessons.map((candidate) =>
    candidate.id === lessonId
      ? {
          ...candidate,
          status,
          updatedAt: now
        }
      : candidate
  );

  const topics = state.topics.map((topic) => {
    if (topic.id !== lesson.topicId) {
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

  await replaceState({ ...state, lessons, topics });
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

export async function sendReminderNotification(force = false): Promise<void> {
  const { state, todaysPlan } = await ensureDashboardData();

  if (!todaysPlan || !todaysPlan.topicIds.length) {
    return;
  }

  const todaysPlanAlreadySent = Boolean(todaysPlan.reminderSentAt);

  if (!force && todaysPlanAlreadySent) {
    return;
  }

  try {
    await browserApi.notifications.create("learning-plugin-reminder", {
      type: "basic",
      iconUrl: browserApi.runtime.getURL("icons/icon128.png"),
      title: "Today's learning cards are ready",
      message: `You have ${todaysPlan.topicIds.length} topics ready in learning-plugin.`
    });

    const nextPlan = { ...todaysPlan, reminderSentAt: new Date().toISOString() };
    await replaceState({
      ...state,
      dailyPlans: [...state.dailyPlans.filter((plan) => plan.dateKey !== todaysPlan.dateKey), nextPlan]
    });
    await setReminderStatus("sent");
  } catch (error) {
    await setReminderStatus(
      "failed",
      error instanceof Error ? error.message : "Notifications are unavailable in this browser."
    );
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
