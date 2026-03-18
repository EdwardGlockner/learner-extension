import { getDateKey } from "../lib/time";
import type { DailyPlan, ExtensionState, LessonGeneration, Topic } from "../shared/types";

export function getTopicById(state: ExtensionState, topicId: string): Topic | undefined {
  return state.topics.find((topic) => topic.id === topicId);
}

export function getDailyPlan(state: ExtensionState, dateKey = getDateKey()): DailyPlan | undefined {
  return state.dailyPlans.find((plan) => plan.dateKey === dateKey);
}

export function getLessonsForPlan(state: ExtensionState, plan: DailyPlan | null | undefined): LessonGeneration[] {
  if (!plan) {
    return [];
  }

  return plan.lessonIds
    .map((lessonId) => state.lessons.find((lesson) => lesson.id === lessonId))
    .filter((value): value is LessonGeneration => Boolean(value));
}
