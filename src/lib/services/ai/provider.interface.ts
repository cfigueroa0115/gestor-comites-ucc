/**
 * AI Provider Interface
 *
 * Re-exports the IAIProvider strategy interface and related types from the
 * shared types module. This file serves as the canonical import point for
 * AI service consumers within the services layer.
 */

export type {
  IAIProvider,
  ActaGenerationInput,
  ActaGenerationResult,
} from '@/types';
