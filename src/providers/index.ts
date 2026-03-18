import type { ProviderId, ProviderSettings } from "../shared/types";
import { geminiProvider } from "./geminiProvider";
import { openAiProvider } from "./openAiProvider";
import type { LessonProvider } from "./types";

const providers: Record<ProviderId, LessonProvider> = {
  gemini: geminiProvider,
  openai: openAiProvider
};

export function getProvider(id: ProviderId | null): LessonProvider | null {
  if (!id) {
    return null;
  }

  return providers[id] ?? null;
}

export function getSelectedProviderApiKey(settings: ProviderSettings): string {
  switch (settings.selectedProvider) {
    case "gemini":
      return settings.geminiApiKey.trim();
    case "openai":
      return settings.openAiApiKey.trim();
    default:
      return "";
  }
}

export function getSelectedProviderModel(settings: ProviderSettings): string {
  switch (settings.selectedProvider) {
    case "gemini":
      return settings.geminiModel.trim() || "gemini-2.5-flash-lite";
    case "openai":
      return settings.openAiModel.trim() || "gpt-4.1-mini";
    default:
      return "";
  }
}

export function getProviderLabel(id: ProviderId | null): string {
  return id ? providers[id]?.label ?? "Provider" : "Provider";
}
