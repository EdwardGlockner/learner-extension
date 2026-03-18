import type { AppSettings, TopicCategory } from "./types";

export const STORAGE_KEY = "learning-plugin-state";
export const STATE_VERSION = 4;
export const DASHBOARD_PATH = "dashboard.html";
export const REMINDER_ALARM_ID = "daily-learning-reminder";
export const PROMPT_TEMPLATE_VERSION = "v1";

export const CATEGORY_LABELS: Record<TopicCategory, string> = {
  "llm-fundamentals": "LLM Fundamentals",
  "llm-applications": "LLM Applications",
  "systems-infrastructure": "Systems & Infrastructure",
  "cloud-devops": "Cloud & DevOps",
  "agents-tooling": "Agents & Tooling",
  "hardware-performance": "Hardware & Performance",
  "research-concepts": "Research Concepts"
};

export const DEFAULT_PROMPT_TEMPLATE = `You are an expert technical tutor.
Create a short daily lesson about "{{topicTitle}}" for a self-guided learner.

Context:
- Topic category: {{category}}
- Difficulty preference: {{difficultyPreference}}
- Desired lesson depth: {{contentLength}}
- Related topics in the learner queue: {{relatedTopics}}
- Optional learner note: {{topicDescription}}

Return strict JSON with this shape:
{
  "explanation": "2-4 short paragraphs in plain language",
  "whyItMatters": "1 short paragraph",
  "examples": ["1 to 3 concrete examples"],
  "pitfalls": ["1 to 3 common confusions or mistakes"],
  "nextSteps": ["1 to 3 short next-step recommendations"],
  "resources": [{"title":"resource title","url":"https://...","source":"book|docs|paper|article"}]
}

Keep the tone direct, teach clearly, and avoid filler.`;

export const DEFAULT_SETTINGS: AppSettings = {
  reminders: {
    enabled: true,
    time: "09:00",
    timezoneMode: "browser-local",
    fixedOffsetMinutes: 0,
    quietWeekends: true,
    lastNotificationStatus: "idle"
  },
  provider: {
    selectedProvider: "ollama",
    openAiApiKey: "",
    openAiModel: "gpt-4.1-mini",
    geminiApiKey: "",
    geminiModel: "gemini-2.5-flash-lite",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "gemma3",
    contentLength: "balanced",
    difficultyPreference: "mixed",
    promptTemplate: DEFAULT_PROMPT_TEMPLATE
  },
  scheduling: {
    dailyTopicCount: 2,
    reviewFrequency: 0.35
  },
  ui: {
    theme: "system",
    compactQueue: false,
    popupScale: "standard"
  }
};
