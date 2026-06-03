/**
 * AI Provider Factory
 *
 * Reads the AI_PROVIDER environment variable and returns the corresponding
 * IAIProvider implementation. Defaults to FallbackProvider when the variable
 * is unset or empty, ensuring the system operates normally without an
 * external AI service (Requirement 14.5).
 */

import type { IAIProvider } from './provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GroqProvider } from './groq.provider';
import { FallbackProvider } from './fallback.provider';

export type AIProviderName = 'openai' | 'anthropic' | 'groq' | 'fallback';

/**
 * Creates an AI provider instance based on the AI_PROVIDER environment variable.
 *
 * - 'openai'    → OpenAIProvider
 * - 'anthropic' → AnthropicProvider
 * - 'groq'      → GroqProvider (free, fast, Llama 3.1)
 * - '' / unset  → FallbackProvider (deterministic, no API calls)
 */
export function createAIProvider(): IAIProvider {
  const providerName = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();

  switch (providerName) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'groq':
      return new GroqProvider();
    case 'fallback':
    case '':
    default:
      return new FallbackProvider();
  }
}

/**
 * Resolves the effective provider name from the environment.
 */
export function getProviderName(): AIProviderName {
  const providerName = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();

  if (providerName === 'openai') return 'openai';
  if (providerName === 'anthropic') return 'anthropic';
  if (providerName === 'groq') return 'groq';
  return 'fallback';
}
