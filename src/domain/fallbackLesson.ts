import { CATEGORY_LABELS } from "../shared/constants";
import type { GeneratedLessonContent, Topic } from "../shared/types";

function docsLinkForTopic(topic: Topic): string[] {
  const lower = topic.title.toLowerCase();

  if (lower.includes("docker")) {
    return ["https://docs.docker.com/get-started/"];
  }

  if (lower.includes("kubernetes")) {
    return ["https://kubernetes.io/docs/concepts/overview/"];
  }

  if (lower.includes("langchain")) {
    return ["https://python.langchain.com/docs/introduction/"];
  }

  if (lower.includes("mcp")) {
    return ["https://modelcontextprotocol.io/introduction"];
  }

  if (lower.includes("foundation")) {
    return ["https://arxiv.org/abs/2304.12210"];
  }

  return ["https://en.wikipedia.org/wiki/" + encodeURIComponent(topic.title)];
}

export function createFallbackLesson(topic: Topic): GeneratedLessonContent {
  const categoryLabel = CATEGORY_LABELS[topic.category];
  const resourceUrls = docsLinkForTopic(topic);

  return {
    explanation: `${topic.title} sits in the ${categoryLabel} track. This offline preview is intentionally compact: it gives you a workable mental model until a live LLM provider is configured. Start by defining what the concept is, where it fits in a real system, and which neighboring topics in your queue it depends on.`,
    whyItMatters: `${topic.title} matters because it shapes how you reason about performance, system behavior, and design tradeoffs. Treat it as a foundational lens rather than an isolated fact to memorize.`,
    examples: [
      `Explain ${topic.title} to yourself using one concrete system you already know.`,
      `Compare ${topic.title} with an adjacent concept in the same category to surface the boundary.`,
      `Write down one implementation or debugging scenario where ${topic.title} changes the right decision.`
    ],
    pitfalls: [
      "Learning the definition without understanding the tradeoffs.",
      "Skipping prerequisites and jumping straight into tools or benchmarks.",
      "Assuming the concept works the same way in every stack or deployment context."
    ],
    nextSteps: [
      "Connect an API-backed provider in Settings for richer generated lessons.",
      "Pair this topic with one prerequisite and one follow-on topic from your queue.",
      "Capture one question you still cannot answer clearly after reading."
    ],
    resources: resourceUrls.map((url) => ({
      title: `Reference for ${topic.title}`,
      url,
      source: "reference"
    }))
  };
}
