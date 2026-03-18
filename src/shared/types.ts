export const TOPIC_CATEGORIES = [
  "llm-fundamentals",
  "llm-applications",
  "systems-infrastructure",
  "cloud-devops",
  "agents-tooling",
  "hardware-performance",
  "research-concepts"
] as const;

export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;
export type TopicLifecycleStatus = "active" | "learned" | "paused";
export type LessonStatus =
  | "new"
  | "shown"
  | "continue-later"
  | "not-now"
  | "learned"
  | "review";
export type ThemePreference = "system" | "light" | "dark";
export type ProviderId = "openai" | "gemini";

export interface ResourceLink {
  title: string;
  url: string;
  source?: string;
}

export interface Topic {
  id: string;
  title: string;
  normalizedTitle: string;
  description?: string;
  tags: string[];
  category: TopicCategory;
  difficulty: DifficultyLevel;
  prerequisites: string[];
  manuallyOrderedIndex: number;
  status: TopicLifecycleStatus;
  timesShown: number;
  timesLearned: number;
  lastShownAt?: string;
  lastLearnedAt?: string;
  createdAt: string;
  updatedAt: string;
  source: "seed" | "user";
}

export interface GeneratedLessonContent {
  explanation: string;
  whyItMatters: string;
  examples: string[];
  pitfalls: string[];
  nextSteps: string[];
  resources: ResourceLink[];
}

export interface LessonGeneration {
  id: string;
  topicId: string;
  dateKey: string;
  providerId: string;
  model: string;
  promptVersion: string;
  content: GeneratedLessonContent;
  status: LessonStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LessonGenerationAttempt {
  topicId: string;
  dateKey: string;
  providerId: ProviderId;
  lastAttemptAt: string;
  nextRetryAt?: string;
  lastError?: string;
}

export interface PlanTopicReason {
  topicId: string;
  score: number;
  reviewCandidate: boolean;
  varietyPenalty: number;
  rationale: string[];
}

export interface DailyPlan {
  id: string;
  dateKey: string;
  topicIds: string[];
  lessonIds: string[];
  generatedAt: string;
  reminderSentAt?: string;
  reasons: PlanTopicReason[];
}

export interface ReminderSettings {
  enabled: boolean;
  time: string;
  timezoneMode: "browser-local" | "fixed-offset";
  fixedOffsetMinutes: number;
  quietWeekends: boolean;
  lastNotificationStatus: "idle" | "sent" | "unavailable" | "failed";
  lastNotificationError?: string;
}

export interface ProviderSettings {
  selectedProvider: ProviderId | null;
  openAiApiKey: string;
  openAiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  contentLength: "compact" | "balanced" | "deep";
  difficultyPreference: "beginner" | "mixed" | "advanced";
  promptTemplate: string;
}

export interface SchedulingSettings {
  dailyTopicCount: 2 | 3;
  reviewFrequency: number;
}

export interface UiPreferences {
  theme: ThemePreference;
  compactQueue: boolean;
  popupScale: "standard" | "large";
}

export interface AppSettings {
  reminders: ReminderSettings;
  provider: ProviderSettings;
  scheduling: SchedulingSettings;
  ui: UiPreferences;
}

export interface ExtensionState {
  version: number;
  topics: Topic[];
  dailyPlans: DailyPlan[];
  lessons: LessonGeneration[];
  generationAttempts: LessonGenerationAttempt[];
  settings: AppSettings;
  initializedAt: string;
  updatedAt: string;
}

export interface TopicSuggestion {
  title: string;
  tags: string[];
  category: TopicCategory;
  difficulty: DifficultyLevel;
  inferredPrerequisites: string[];
}

export interface ProviderLessonRequest {
  topic: Topic;
  relatedTopics: Topic[];
  settings: ProviderSettings;
}

export interface ProviderLessonResult extends GeneratedLessonContent {
  providerId: string;
  model: string;
}

export interface BackgroundResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface DashboardData {
  state: ExtensionState;
  todaysPlan: DailyPlan | null;
  todaysLessons: LessonGeneration[];
}
