import { normalizeTitle } from "../lib/strings";
import type { DifficultyLevel, Topic, TopicCategory, TopicSuggestion } from "../shared/types";

type RuleSet = {
  match: RegExp;
  category: TopicCategory;
  difficulty: DifficultyLevel;
  tags: string[];
};

const rules: RuleSet[] = [
  {
    match: /(tokenization|context|attention|foundation models|llm course)/i,
    category: "llm-fundamentals",
    difficulty: 2,
    tags: ["foundations", "transformers"]
  },
  {
    match: /(rag|langchain|multimodal|rlhf|sota llms)/i,
    category: "llm-applications",
    difficulty: 4,
    tags: ["applied-llm", "product"]
  },
  {
    match: /(docker|proxy server|disk|ram|cache)/i,
    category: "systems-infrastructure",
    difficulty: 2,
    tags: ["systems", "networking"]
  },
  {
    match: /(jpeg|png|compression|codec|image format|lossless|lossy)/i,
    category: "systems-infrastructure",
    difficulty: 3,
    tags: ["compression", "media-formats"]
  },
  {
    match: /(cloud|kubernetes)/i,
    category: "cloud-devops",
    difficulty: 3,
    tags: ["cloud", "deployment"]
  },
  {
    match: /(mcp|agent|orchestration|skills)/i,
    category: "agents-tooling",
    difficulty: 4,
    tags: ["agents", "tooling"]
  },
  {
    match: /(arm vs x86|inference speed)/i,
    category: "hardware-performance",
    difficulty: 3,
    tags: ["hardware", "performance"]
  },
  {
    match: /(recursive self-improvement)/i,
    category: "research-concepts",
    difficulty: 5,
    tags: ["research", "alignment"]
  }
];

const topicPrerequisites: Record<string, string[]> = {
  attention: ["Context"],
  "foundation models": ["Context", "Attention", "Tokenization"],
  "llm course": ["Context", "Tokenization"],
  "sota llms": ["Foundation models", "Attention", "Tokenization"],
  rag: ["Context", "Foundation models"],
  langchain: ["RAG", "Foundation models"],
  "agent skills": ["Foundation models"],
  mcp: ["Foundation models", "Agent skills"],
  "agent orchestration": ["MCP", "Agent skills", "LangChain"],
  rlhf: ["Foundation models"],
  "multimodal embedding space without transcribe, google embedding 2": ["Foundation models"],
  "recursive self-improvement": ["Foundation models", "Agent orchestration"],
  kubernetes: ["Docker", "Cloud"],
  "inference speed": ["Foundation models", "Arm vs x86", "Disk vs RAM vs cache (training)"]
};

export function inferTopicSuggestion(title: string): TopicSuggestion {
  const normalized = normalizeTitle(title);
  const matched = rules.find((rule) => rule.match.test(title));
  const looksResearchHeavy = /(theory|alignment|causal|interpretability|self-improvement|emergence|optimization)/i.test(title);

  return {
    title: title.trim(),
    tags: matched?.tags ?? (looksResearchHeavy ? ["research"] : ["general"]),
    category: matched?.category ?? (looksResearchHeavy ? "research-concepts" : "systems-infrastructure"),
    difficulty: matched?.difficulty ?? 3,
    inferredPrerequisites: topicPrerequisites[normalized] ?? []
  };
}

export function inferEffectivePrerequisites(topic: Topic, allTopics: Topic[]): string[] {
  const inferred = inferTopicSuggestion(topic.title).inferredPrerequisites
    .map((title) => allTopics.find((candidate) => normalizeTitle(candidate.title) === normalizeTitle(title))?.id)
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set([...topic.prerequisites, ...inferred]));
}
