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
  startDashboardGeneration,
  validateProviderConnection,
  refreshLesson,
  scheduleReminder,
  sendReminderNotification,
  updateLessonStatus
} from "./runtime";
import { loadState, replaceState } from "../storage/state";

async function importTopics(titles: string[]) {
  const state = await loadState();
  const now = new Date().toISOString();
  const existingTopicsByTitle = new Map(state.topics.map((topic) => [normalizeTitle(topic.title), topic]));
  const incomingTitleEntries = titles
    .map((title) => title.trim())
    .filter(Boolean)
    .map((title) => [normalizeTitle(title), title] as const);
  const uniqueIncomingTitles = new Map(incomingTitleEntries);
  const normalizedIncomingTitles = [...uniqueIncomingTitles.keys()];
  const titlesToCreate = normalizedIncomingTitles
    .filter((normalizedTitle) => !existingTopicsByTitle.has(normalizedTitle))
    .map((normalizedTitle) => uniqueIncomingTitles.get(normalizedTitle) ?? normalizedTitle);
  const titlesToReactivate = normalizedIncomingTitles.filter((normalizedTitle) => {
    const existingTopic = existingTopicsByTitle.get(normalizedTitle);
    return Boolean(existingTopic && existingTopic.status !== "active");
  });
  const drafts = titlesToCreate
    .map((title) => title.trim())
    .filter(Boolean)
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

  if (created.length || titlesToReactivate.length) {
    const reactivatedIds = new Set(
      titlesToReactivate
        .map((normalizedTitle) => existingTopicsByTitle.get(normalizedTitle)?.id)
        .filter((value): value is string => Boolean(value))
    );
    let nextOrderIndex = state.topics.length;
    const nextTopics = state.topics.map((topic) => {
      if (!reactivatedIds.has(topic.id)) {
        return topic;
      }

      return {
        ...topic,
        status: "active" as const,
        manuallyOrderedIndex: nextOrderIndex++,
        updatedAt: now
      };
    });

    await replaceState({ ...state, topics: [...nextTopics, ...created] });
  }

  return {
    addedCount: created.length + titlesToReactivate.length
  };
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
      return ensureDashboardData();
    case "dashboard/generate-missing":
      return startDashboardGeneration();
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
      return sendReminderNotification(true);
    case "topics/import":
      return {
        createdCount: (await importTopics(message.titles)).addedCount,
        dashboard: await loadDashboardData()
      };
    default:
      return undefined;
  }
});
