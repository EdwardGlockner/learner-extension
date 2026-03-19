import { normalizeTitle } from "../lib/strings";
import type { ResourceLink, Topic } from "../shared/types";

type ResourceRule = {
  match: RegExp;
  resources: ResourceLink[];
};

const rules: ResourceRule[] = [
  {
    match: /\battention\b/i,
    resources: [
      { title: "Attention Is All You Need", url: "https://arxiv.org/abs/1706.03762", source: "paper" },
      { title: "Attention (machine learning)", url: "https://en.wikipedia.org/wiki/Attention_(machine_learning)", source: "article" }
    ]
  },
  {
    match: /\btokenization\b/i,
    resources: [
      { title: "OpenAI tokenizer guide", url: "https://platform.openai.com/tokenizer", source: "docs" },
      { title: "Tokenization", url: "https://en.wikipedia.org/wiki/Lexical_analysis#Tokenization", source: "article" }
    ]
  },
  {
    match: /\bfoundation models?\b/i,
    resources: [
      { title: "On the Opportunities and Risks of Foundation Models", url: "https://arxiv.org/abs/2108.07258", source: "paper" },
      { title: "Foundation model", url: "https://en.wikipedia.org/wiki/Foundation_model", source: "article" }
    ]
  },
  {
    match: /\brlhf\b/i,
    resources: [
      { title: "Hugging Face RLHF overview", url: "https://huggingface.co/blog/rlhf", source: "article" },
      { title: "InstructGPT paper", url: "https://arxiv.org/abs/2203.02155", source: "paper" }
    ]
  },
  {
    match: /\brag\b/i,
    resources: [
      { title: "Retrieval-Augmented Generation paper", url: "https://arxiv.org/abs/2005.11401", source: "paper" },
      { title: "RAG model docs", url: "https://huggingface.co/docs/transformers/model_doc/rag", source: "docs" }
    ]
  },
  {
    match: /\blangchain\b/i,
    resources: [
      { title: "LangChain introduction", url: "https://python.langchain.com/docs/introduction/", source: "docs" },
      { title: "LangGraph overview", url: "https://langchain-ai.github.io/langgraph/", source: "docs" }
    ]
  },
  {
    match: /\blanggraph\b/i,
    resources: [
      { title: "LangGraph overview", url: "https://langchain-ai.github.io/langgraph/", source: "docs" },
      { title: "LangGraph guides", url: "https://langchain-ai.github.io/langgraph/concepts/why-langgraph/", source: "docs" }
    ]
  },
  {
    match: /\bmcp\b|model context protocol/i,
    resources: [
      { title: "Model Context Protocol", url: "https://modelcontextprotocol.io/introduction", source: "docs" },
      { title: "MCP specification", url: "https://spec.modelcontextprotocol.io/", source: "docs" }
    ]
  },
  {
    match: /\bdocker\b/i,
    resources: [
      { title: "Docker overview", url: "https://docs.docker.com/get-started/docker-overview/", source: "docs" },
      { title: "Get started with Docker", url: "https://docs.docker.com/get-started/", source: "docs" }
    ]
  },
  {
    match: /\bkubernetes\b/i,
    resources: [
      { title: "What is Kubernetes?", url: "https://kubernetes.io/docs/concepts/overview/what-is-kubernetes/", source: "docs" },
      { title: "Kubernetes concepts", url: "https://kubernetes.io/docs/concepts/", source: "docs" }
    ]
  },
  {
    match: /\bcloud\b/i,
    resources: [
      { title: "Cloud computing", url: "https://en.wikipedia.org/wiki/Cloud_computing", source: "article" },
      { title: "Google Cloud architecture basics", url: "https://cloud.google.com/architecture/framework", source: "docs" }
    ]
  },
  {
    match: /\bproxy server\b/i,
    resources: [
      { title: "Proxy server", url: "https://en.wikipedia.org/wiki/Proxy_server", source: "article" },
      { title: "NGINX reverse proxy guide", url: "https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/", source: "docs" }
    ]
  },
  {
    match: /\barm vs x86\b|\barm\b|\bx86\b/i,
    resources: [
      { title: "ARM architecture family", url: "https://en.wikipedia.org/wiki/ARM_architecture_family", source: "article" },
      { title: "x86", url: "https://en.wikipedia.org/wiki/X86", source: "article" }
    ]
  },
  {
    match: /\binference speed\b/i,
    resources: [
      { title: "Transformers text generation", url: "https://huggingface.co/docs/transformers/main_classes/text_generation", source: "docs" },
      { title: "vLLM documentation", url: "https://docs.vllm.ai/", source: "docs" }
    ]
  },
  {
    match: /\bdisk\b|\bram\b|\bcache\b/i,
    resources: [
      { title: "CPU cache", url: "https://en.wikipedia.org/wiki/CPU_cache", source: "article" },
      { title: "Random-access memory", url: "https://en.wikipedia.org/wiki/Random-access_memory", source: "article" }
    ]
  },
  {
    match: /\bjpeg\b|\bjpg\b|\bpng\b|\blossless\b|\blossy\b|\bcompression\b/i,
    resources: [
      { title: "PNG specification", url: "https://www.w3.org/TR/png-3/", source: "docs" },
      { title: "JPEG overview", url: "https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types", source: "docs" },
      { title: "Discrete cosine transform", url: "https://en.wikipedia.org/wiki/Discrete_cosine_transform", source: "article" }
    ]
  },
  {
    match: /\bagent orchestration\b|\bagent skills\b/i,
    resources: [
      { title: "LangGraph", url: "https://langchain-ai.github.io/langgraph/", source: "docs" },
      { title: "Building effective agents", url: "https://www.anthropic.com/engineering/building-effective-agents", source: "article" }
    ]
  },
  {
    match: /\bcontext\b/i,
    resources: [
      { title: "Transformer paper", url: "https://arxiv.org/abs/1706.03762", source: "paper" },
      { title: "Context window", url: "https://en.wikipedia.org/wiki/Context_window", source: "article" }
    ]
  }
];

function fallbackResources(topic: Topic): ResourceLink[] {
  const searchQuery = encodeURIComponent(topic.title.trim());
  const normalizedQuery = normalizeTitle(topic.title);
  const wikipediaSlug = encodeURIComponent(topic.title.trim().replace(/\s+/g, "_"));
  const genericResources: ResourceLink[] = [
    {
      title: `${topic.title} on Wikipedia`,
      url: `https://en.wikipedia.org/wiki/${wikipediaSlug}`,
      source: "article"
    },
    {
      title: `${topic.title} web results`,
      url: `https://duckduckgo.com/?q=${searchQuery}`,
      source: "article"
    }
  ];
  const researchResources: ResourceLink[] =
    topic.category === "llm-fundamentals" ||
    topic.category === "llm-applications" ||
    topic.category === "research-concepts"
      ? [
          {
            title: `${topic.title} papers`,
            url: `https://arxiv.org/search/?query=${encodeURIComponent(normalizedQuery)}&searchtype=all&source=header`,
            source: "paper"
          }
        ]
      : [];

  return [
    ...genericResources,
    ...researchResources
  ];
}

const resourceReachabilityCache = new Map<string, boolean>();

function normalizeResourceTitle(title: string): string {
  return normalizeTitle(title)
    .replace(/\bon wikipedia\b/g, "")
    .replace(/\bpaper[s]?\b/g, "")
    .replace(/\bweb results\b/g, "")
    .trim();
}

function normalizeResourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "");

    if (hostname.includes("wikipedia.org")) {
      if (pathname.startsWith("/wiki/")) {
        return `${hostname}${pathname}`;
      }

      if (pathname.includes("/Special:Search")) {
        return `${hostname}/wiki-search`;
      }
    }

    if (hostname.includes("arxiv.org")) {
      if (pathname.startsWith("/abs/")) {
        return `${hostname}${pathname}`;
      }

      if (pathname.startsWith("/search/")) {
        return `${hostname}/search`;
      }
    }

    return `${hostname}${pathname}`;
  } catch {
    return url.trim();
  }
}

export function getCuratedResources(topic: Topic, generated: ResourceLink[] = []): ResourceLink[] {
  const normalizedTitle = normalizeTitle(topic.title);
  const curated = rules
    .filter((rule) => rule.match.test(topic.title))
    .flatMap((rule) => rule.resources);
  const combined = [...curated, ...generated, ...fallbackResources(topic)];
  const seen = new Set<string>();

  return combined.filter((resource) => {
    if (!resource.url.startsWith("http")) {
      return false;
    }

    if (/wikipedia\.org\/wiki\/Special:Search/i.test(resource.url)) {
      return false;
    }

    const key = `${normalizeResourceUrl(resource.url)}|${normalizedTitle}`;
    const titleKey = normalizeResourceTitle(resource.title);
    const titleTopicKey = `${titleKey}|${normalizedTitle}`;

    if (seen.has(key) || seen.has(titleTopicKey)) {
      return false;
    }

    seen.add(key);
    seen.add(titleTopicKey);
    return true;
  }).slice(0, 3);
}

async function urlResponds(url: string): Promise<boolean> {
  if (resourceReachabilityCache.has(url)) {
    return resourceReachabilityCache.get(url) ?? false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal
    });

    if (headResponse.ok) {
      resourceReachabilityCache.set(url, true);
      return true;
    }
  } catch {
    // Some sites reject HEAD; fall through to GET.
  } finally {
    clearTimeout(timeoutId);
  }

  const getController = new AbortController();
  const getTimeoutId = setTimeout(() => getController.abort(), 5000);

  try {
    const getResponse = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: getController.signal
    });
    const ok = getResponse.ok;
    resourceReachabilityCache.set(url, ok);
    return ok;
  } catch {
    resourceReachabilityCache.set(url, false);
    return false;
  } finally {
    clearTimeout(getTimeoutId);
  }
}

export async function filterReachableResources(resources: ResourceLink[]): Promise<ResourceLink[]> {
  const validResources: ResourceLink[] = [];

  for (const resource of resources) {
    if (!resource.url.startsWith("http")) {
      continue;
    }

    if (await urlResponds(resource.url)) {
      validResources.push(resource);
    }

    if (validResources.length >= 3) {
      break;
    }
  }

  return validResources;
}
