import type { Runtime } from "webextension-polyfill";
import { browserApi } from "../lib/browserApi";
import type { BackgroundMessage, MessagePayloads } from "../shared/messages";
import { createId } from "../lib/id";
import { inferTopicSuggestion } from "../domain/topicInference";
import { normalizeTitle } from "../lib/strings";
import {
  bootstrapExtension,
  ensureDashboardData,
  loadDashboardData,
  openDashboard,
  validateProviderConnection,
  refreshLesson,
  scheduleReminder,
  sendReminderNotification,
  updateLessonStatus
} from "./runtime";
import { loadState, replaceState } from "../storage/state";

async function importTopics(titles: string[]) {
  const state = await loadState();
  const existingTitles = new Set(state.topics.map((topic) => normalizeTitle(topic.title)));
  const now = new Date().toISOString();
  const drafts = titles
    .map((title) => title.trim())
    .filter(Boolean)
    .filter((title) => !existingTitles.has(normalizeTitle(title)))
    .map((title, index) => {
      const suggestion = inferTopicSuggestion(title);
      return {
        id: createId("topic"),
        suggestion,
        title,
        normalizedTitle: normalizeTitle(title),
        description: "",
        tags: suggestion.tags,
        category: suggestion.category,
        difficulty: suggestion.difficulty,
        prerequisites: [],
        manuallyOrderedIndex: state.topics.length + index,
        status: "active" as const,
        timesShown: 0,
        timesLearned: 0,
        createdAt: now,
        updatedAt: now,
        source: "user" as const
      };
    });

  const titleToId = new Map(state.topics.map((topic) => [normalizeTitle(topic.title), topic.id]));

  for (const draft of drafts) {
    titleToId.set(draft.normalizedTitle, draft.id);
  }

  const created = drafts.map(({ suggestion, ...draft }) => ({
    ...draft,
    prerequisites: suggestion.inferredPrerequisites
      .map((title) => titleToId.get(normalizeTitle(title)))
      .filter((value): value is string => Boolean(value))
  }));

  if (created.length) {
    await replaceState({ ...state, topics: [...state.topics, ...created] });
  }

  return created;
}

browserApi.runtime.onInstalled.addListener(async (details: Runtime.OnInstalledDetailsType) => {
  await bootstrapExtension();

  if (details.reason === "install") {
    await openDashboard();
  }
});

browserApi.runtime.onStartup.addListener(async () => {
  await bootstrapExtension();
});

browserApi.action.onClicked.addListener(async () => {
  await openDashboard();
});

browserApi.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "daily-learning-reminder") {
    await sendReminderNotification(false);
  }
});

browserApi.runtime.onMessage.addListener(async (message: BackgroundMessage) => {
  switch (message.type) {
    case "dashboard/load":
      return loadDashboardData();
    case "dashboard/refresh":
    case "dashboard/generate-missing":
      return ensureDashboardData();
    case "lessons/refresh-topic":
      return refreshLesson(message.topicId);
    case "lessons/update-status":
      await updateLessonStatus(message.lessonId, message.status);
      return loadDashboardData();
    case "settings/reschedule-reminder": {
      await scheduleReminder();
      const state = await loadState();
      return state.settings.reminders;
    }
    case "provider/validate":
      return validateProviderConnection();
    case "notifications/test":
      await sendReminderNotification(true);
      return { success: true };
    case "topics/import":
      return {
        createdCount: (await importTopics(message.titles)).length,
        dashboard: await loadDashboardData()
      };
    default:
      return undefined;
  }
});
