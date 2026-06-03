/**
 * AI Service module barrel export.
 */

export type { IAIProvider, ActaGenerationInput, ActaGenerationResult } from './provider.interface';
export { createAIProvider, getProviderName } from './factory';
export type { AIProviderName } from './factory';
export { FallbackProvider } from './fallback.provider';
export { OpenAIProvider } from './openai.provider';
export { AnthropicProvider } from './anthropic.provider';
export { extractText, isUnsupportedMediaType, canExtractText } from './text-extractor';
export { generateActaContent, generateActaContentFromForm, generateActaWithAI } from './orchestrator';
export type { AttachmentBuffer, AttachmentBufferWithExtension } from './orchestrator';
