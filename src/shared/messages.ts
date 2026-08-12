import type { DashboardData, LessonGeneration, ReminderSettings, Topic } from "./types";
import type { ProviderValidationResult } from "../providers/types";

export type BackgroundMessage =
  | { type: "dashboard/load" }
  | { type: "dashboard/refresh" }
  | { type: "dashboard/generate-missing" }
  | { type: "lessons/refresh-topic"; topicId: string }
  | { type: "lessons/update-status"; lessonId: string; status: LessonGeneration["status"] }
  | { type: "settings/reschedule-reminder" }
  | { type: "provider/validate" }
  | { type: "notifications/test" }
  | { type: "topics/import"; titles: string[] }
  | { type: "topics/remove"; topicId: string };

export interface MessagePayloads {
  "dashboard/load": DashboardData;
  "dashboard/refresh": DashboardData;
  "dashboard/generate-missing": DashboardData;
  "lessons/refresh-topic": LessonGeneration;
  "lessons/update-status": DashboardData;
  "settings/reschedule-reminder": ReminderSettings;
  "provider/validate": ProviderValidationResult;
  "notifications/test": { success: boolean; message: string };
  "topics/import": { createdCount: number; dashboard: DashboardData };
  "topics/remove": DashboardData;
}
