import type { ProviderId, ProviderSettings } from "../shared/types";
import { geminiProvider } from "./geminiProvider";
import { ollamaProvider } from "./ollamaProvider";
import { openAiProvider } from "./openAiProvider";
import type { LessonProvider } from "./types";

const providers: Record<ProviderId, LessonProvider> = {
  gemini: geminiProvider,
  ollama: ollamaProvider,
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
    case "ollama":
      return "";
    case "openai":
      return settings.openAiApiKey.trim();
    default:
      return "";
  }
}

export function isSelectedProviderConfigured(settings: ProviderSettings): boolean {
  switch (settings.selectedProvider) {
    case "gemini":
      return Boolean(settings.geminiApiKey.trim());
    case "ollama":
      return Boolean(settings.ollamaModel.trim());
    case "openai":
      return Boolean(settings.openAiApiKey.trim());
    default:
      return false;
  }
}

export function getSelectedProviderModel(settings: ProviderSettings): string {
  switch (settings.selectedProvider) {
    case "gemini":
      return settings.geminiModel.trim() || "gemini-2.5-flash-lite";
    case "ollama":
      return settings.ollamaModel.trim() || "gemma3";
    case "openai":
      return settings.openAiModel.trim() || "gpt-4.1-mini";
    default:
      return "";
  }
}

export function getProviderLabel(id: ProviderId | null): string {
  return id ? providers[id]?.label ?? "Provider" : "Provider";
}
