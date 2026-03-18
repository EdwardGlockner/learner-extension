import type { ProviderLessonRequest, ProviderLessonResult, ProviderSettings } from "../shared/types";

export interface ProviderValidationResult {
  ok: boolean;
  message: string;
}

export interface LessonProvider {
  id: string;
  label: string;
  requiresApiKey: boolean;
  generateLesson(request: ProviderLessonRequest): Promise<ProviderLessonResult>;
  validateConnection(settings: ProviderSettings): Promise<ProviderValidationResult>;
}
