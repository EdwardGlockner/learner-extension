import type { AppSettings, TopicCategory } from "./types";

export const STORAGE_KEY = "learning-plugin-state";
export const STATE_VERSION = 4;
export const DASHBOARD_PATH = "dashboard.html";
export const REMINDER_ALARM_ID = "daily-learning-reminder";
export const PROMPT_TEMPLATE_VERSION = "v2";
export const DEFAULT_OLLAMA_MODEL = "qwen2.5:3b";
export const LEGACY_OLLAMA_MODEL = "gemma3";

export const CATEGORY_LABELS: Record<TopicCategory, string> = {
  "llm-fundamentals": "LLM Fundamentals",
  "llm-applications": "LLM Applications",
  "systems-infrastructure": "Systems & Infrastructure",
  "cloud-devops": "Cloud & DevOps",
  "agents-tooling": "Agents & Tooling",
  "hardware-performance": "Hardware & Performance",
  "research-concepts": "Research Concepts"
};

export const LEGACY_DEFAULT_PROMPT_TEMPLATE = `You are an expert technical tutor.
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

export const INTERMEDIATE_DEFAULT_PROMPT_TEMPLATE = `You are an expert technical tutor.
Create a compact but high-quality lesson about "{{topicTitle}}" for a self-guided learner.

Context:
- Topic category: {{category}}
- Difficulty preference: {{difficultyPreference}}
- Desired lesson depth: {{contentLength}}
- Related topics in the learner queue: {{relatedTopics}}
- Optional learner note: {{topicDescription}}

Return strict JSON with this shape:
{
  "explanation": "3 to 5 short paragraphs. Use line breaks between ideas. If a simple formula, equation, notation, or comparison helps, include it inline on its own line.",
  "whyItMatters": "1 to 2 short paragraphs focused on practical importance",
  "examples": ["2 to 4 concrete examples or comparisons"],
  "pitfalls": ["2 to 4 common confusions or mistakes"],
  "nextSteps": ["2 to 4 short next-step recommendations"],
  "resources": [{"title":"resource title","url":"https://...","source":"book|docs|paper|article"}]
}

Writing rules:
- Avoid a single dense text blob.
- Prefer short paragraphs and crisp sentences.
- If a topic benefits from notation, include one simple line such as "attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V".
- Use plain language first, then add precision.
- Do not include markdown fences or commentary outside the JSON.`;

export const ADVANCED_DEFAULT_PROMPT_TEMPLATE_V1 = `You are an expert technical tutor writing for an advanced technical reader.
Create a compact but high-signal lesson about "{{topicTitle}}".

Reader assumptions:
- The user is already technically strong.
- Do not explain obvious basics.
- Do not use toy exercises, beginner analogies, or generic study advice.
- Focus on mechanisms, tradeoffs, constraints, edge cases, and research/engineering implications.

Context:
- Topic category: {{category}}
- Difficulty preference: {{difficultyPreference}}
- Desired lesson depth: {{contentLength}}
- Related topics in the learner queue: {{relatedTopics}}
- Optional learner note: {{topicDescription}}

Return strict JSON with this shape:
{
  "explanation": "4 to 6 short paragraphs. Each paragraph should add a distinct technical idea and usually stay under 2 to 3 sentences. If useful, include one compact equation, notation line, or compact comparison.",
  "whyItMatters": "1 to 2 short paragraphs focused on system-level or research-level relevance, not one dense block",
  "examples": ["2 to 4 technically meaningful examples, edge cases, or engineering tradeoffs"],
  "pitfalls": ["2 to 4 nuanced misconceptions, failure modes, or misleading simplifications"],
  "nextSteps": ["2 to 4 advanced adjacent topics, papers, benchmarks, or implementation angles"],
  "resources": [{"title":"resource title","url":"https://...","source":"book|docs|paper|article"}]
}

Writing rules:
- Assume the reader does not need definitions of basic terms.
- Avoid filler like "experiment with X to learn the difference".
- Avoid generic examples like "a sunny photo is good for JPEG" unless the topic genuinely requires it.
- Prefer statements about compression artifacts, transform behavior, entropy, latency, scaling laws, architecture tradeoffs, optimization dynamics, evaluation, or deployment constraints when relevant.
- Do not write long wall-of-text paragraphs. Split ideas into short sections with visible paragraph breaks.
- If a topic benefits from notation, include one compact line such as "attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V".
- Keep the lesson concise but dense.
- Do not include markdown fences or commentary outside the JSON.`;

export const DEFAULT_PROMPT_TEMPLATE = `You are an expert technical tutor writing for an advanced technical reader.
Create a compact but high-signal lesson about "{{topicTitle}}".

Reader assumptions:
- The user is already technically strong.
- Do not explain obvious basics.
- Do not use toy exercises, beginner analogies, or generic study advice.
- Focus on mechanisms, tradeoffs, constraints, edge cases, and research/engineering implications.

Context:
- Topic category: {{category}}
- Difficulty preference: {{difficultyPreference}}
- Desired lesson depth: {{contentLength}}
- Related topics in the learner queue: {{relatedTopics}}
- Optional learner note: {{topicDescription}}

Return strict JSON with this shape:
{
  "explanation": "4 to 6 short paragraphs. Each paragraph should add a distinct technical idea and usually stay under 2 to 3 sentences. If useful, include one compact equation, notation line, or compact comparison.",
  "whyItMatters": "1 to 2 short paragraphs focused on system-level or research-level relevance, not one dense block",
  "examples": ["2 to 4 technically meaningful examples, edge cases, or engineering tradeoffs"],
  "pitfalls": ["2 to 4 nuanced misconceptions, failure modes, or misleading simplifications"],
  "nextSteps": ["2 to 4 advanced adjacent topics, papers, benchmarks, or implementation angles"],
  "resources": [{"title":"resource title","url":"https://...","source":"book|docs|paper|article"}]
}

Writing rules:
- Assume the reader does not need definitions of basic terms.
- Avoid filler like "experiment with X to learn the difference".
- Avoid generic examples like "a sunny photo is good for JPEG" unless the topic genuinely requires it.
- Prefer statements about compression artifacts, transform behavior, entropy, latency, scaling laws, architecture tradeoffs, optimization dynamics, evaluation, or deployment constraints when relevant.
- Do not write long wall-of-text paragraphs. Split ideas into short sections with visible paragraph breaks.
- If a topic benefits from notation, include one compact line such as "attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V".
- Keep the lesson concise but dense.
- Do not include markdown fences or commentary outside the JSON.`;

export const DEFAULT_SETTINGS: AppSettings = {
  reminders: {
    enabled: false,
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
    ollamaModel: DEFAULT_OLLAMA_MODEL,
    contentLength: "balanced",
    difficultyPreference: "advanced",
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
