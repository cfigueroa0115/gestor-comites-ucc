/**
 * AI Generation Orchestrator
 *
 * Main entry point for acta generation with AI. Orchestrates the full pipeline:
 * 1. Extract text from attachment buffers
 * 2. Build generation input combining form data + extracted texts
 * 3. Call primary AI provider (from factory)
 * 4. Fall back to FallbackProvider on error or timeout (5 minutes)
 * 5. If both fail: return error result for Estado_Acta = Error_generacion
 *
 * Uses Promise.race for the 5-minute timeout on provider calls.
 * The orchestrator NEVER throws — always returns an ActaGenerationResult.
 *
 * Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 */

import type { ActaGenerationInput, ActaGenerationResult } from './provider.interface';
import { createAIProvider } from './factory';
import { FallbackProvider } from './fallback.provider';
import { extractText, isUnsupportedMediaType } from './text-extractor';
import { auditLogger } from '@/lib/services/audit.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum time in milliseconds for a provider call before timeout (5 minutes). */
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Attachment buffer with its MIME type for text extraction. */
export interface AttachmentBuffer {
  buffer: Buffer;
  mimeType: string;
  extension?: string;
}

/**
 * Extended attachment buffer type that includes the file extension.
 * Used by the public `generateActaContent` API.
 */
export interface AttachmentBufferWithExtension {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

// ---------------------------------------------------------------------------
// Text Extraction
// ---------------------------------------------------------------------------

/**
 * Extracts text from attachment buffers using the text-extractor utility.
 * Skips media files (images, audio, video) per Requirement 8.10.
 * Returns an array of extracted text strings (empty strings for non-extractable files).
 */
async function extractTextsFromAttachments(
  attachments: AttachmentBuffer[],
): Promise<string[]> {
  const results: string[] = [];

  for (const attachment of attachments) {
    // Skip media files - they are stored but content is not extracted
    if (isUnsupportedMediaType(attachment.mimeType)) {
      results.push('');
      continue;
    }

    // Attempt text extraction using the text-extractor utility
    try {
      const text = await extractText(attachment.buffer, attachment.mimeType, attachment.extension ?? '');
      results.push(text);
    } catch {
      // If extraction fails for a single file, continue with empty text
      results.push('');
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Timeout Helper
// ---------------------------------------------------------------------------

/**
 * Creates a timeout promise that rejects after the specified duration.
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`AI generation timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Races a provider call against a timeout. Returns the result or throws on timeout.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, createTimeoutPromise(ms)]);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Main orchestration function for AI-based acta generation.
 *
 * This is the primary public API. It matches the task spec signature:
 * `generateActaContent(input, attachmentBuffers?) → Promise<ActaGenerationResult>`
 *
 * The orchestrator NEVER throws — all errors are caught and returned
 * as ActaGenerationResult with success=false.
 *
 * Flow:
 * 1. Extract text from provided attachment buffers (skip media files)
 * 2. Build ActaGenerationInput with form data + extracted texts
 * 3. Get primary provider via factory
 * 4. If primary is available, try primary with 5-minute timeout
 * 5. On primary failure/timeout → fall back to FallbackProvider
 * 6. If both fail → return error result (Estado_Acta = Error_generacion)
 *
 * @param input - The acta generation input containing form data
 * @param attachmentBuffers - Optional array of file buffers with MIME types and extensions
 * @returns ActaGenerationResult - always resolves, never throws
 */
export async function generateActaContent(
  input: ActaGenerationInput,
  attachmentBuffers?: AttachmentBufferWithExtension[],
): Promise<ActaGenerationResult> {
  try {
    return await _executeGeneration(input, attachmentBuffers);
  } catch (unexpectedError) {
    // Absolute safety net — the orchestrator should NEVER throw
    const errorMessage = unexpectedError instanceof Error
      ? unexpectedError.message
      : 'Unknown unexpected error in orchestrator';
    return buildErrorResult(errorMessage);
  }
}

/**
 * Simplified generation function that skips attachment extraction.
 *
 * Use this when attachments have already been processed and their extracted
 * text is already included in `input.attachmentTexts`. Avoids redundant
 * extraction work and runs the primary→fallback pipeline directly.
 *
 * @param input - The acta generation input (attachmentTexts already populated)
 * @returns ActaGenerationResult - always resolves, never throws
 */
export async function generateActaContentFromForm(
  input: ActaGenerationInput,
): Promise<ActaGenerationResult> {
  try {
    return await _executeGeneration(input, undefined);
  } catch (unexpectedError) {
    const errorMessage = unexpectedError instanceof Error
      ? unexpectedError.message
      : 'Unknown unexpected error in orchestrator';
    return buildErrorResult(errorMessage);
  }
}

/**
 * Backward-compatible alias for `generateActaContent`.
 * Used by existing callers (uses the simpler AttachmentBuffer type).
 */
export async function generateActaWithAI(
  input: ActaGenerationInput,
  attachmentBuffers?: AttachmentBuffer[],
): Promise<ActaGenerationResult> {
  try {
    return await _executeGeneration(input, attachmentBuffers);
  } catch (unexpectedError) {
    const errorMessage = unexpectedError instanceof Error
      ? unexpectedError.message
      : 'Unknown unexpected error in orchestrator';
    return buildErrorResult(errorMessage);
  }
}

/**
 * Internal orchestration logic shared by both public functions.
 */
async function _executeGeneration(
  input: ActaGenerationInput,
  attachmentBuffers?: AttachmentBuffer[] | AttachmentBufferWithExtension[],
): Promise<ActaGenerationResult> {
  // Step 1: Create primary provider from factory
  const primaryProvider = createAIProvider();

  // Step 2: Extract text from attachments
  let extractedTexts: string[] = [];
  if (attachmentBuffers && attachmentBuffers.length > 0) {
    try {
      extractedTexts = await extractTextsFromAttachments(attachmentBuffers);
    } catch {
      // If text extraction fails entirely, continue with empty texts
      extractedTexts = [];
    }
  }

  // Step 3: Build the full generation input with extracted texts
  const fullInput: ActaGenerationInput = {
    ...input,
    attachmentTexts: [
      ...input.attachmentTexts,
      ...extractedTexts.filter((text) => text.trim().length > 0),
    ],
  };

  // Step 4: Try primary provider with 5-minute timeout
  try {
    const result = await withTimeout(
      primaryProvider.generateActaContent(fullInput),
      GENERATION_TIMEOUT_MS,
    );

    // If primary provider returned success, use its result
    if (result.success) {
      return result;
    }

    // Primary provider returned a non-success result → fall through to fallback
  } catch {
    // Primary provider threw an error or timed out → fall through to fallback
  }

  // Step 5: Fall back to FallbackProvider
  try {
    const fallbackProvider = new FallbackProvider();
    const fallbackResult = await withTimeout(
      fallbackProvider.generateActaContent(fullInput),
      GENERATION_TIMEOUT_MS,
    );

    if (fallbackResult.success) {
      return fallbackResult;
    }

    // Fallback also returned non-success → both failed
    return buildErrorResult('Fallback provider returned non-success result');
  } catch (fallbackError) {
    // Both primary and fallback failed
    const errorMessage = fallbackError instanceof Error
      ? fallbackError.message
      : 'Unknown error in fallback provider';

    return buildErrorResult(errorMessage);
  }
}

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

/**
 * Builds an error ActaGenerationResult and logs the error to the audit log.
 * This corresponds to setting Estado_Acta = Error_generacion (Requirement 8.9).
 */
function buildErrorResult(errorDetail: string): ActaGenerationResult {
  // Audit log the generation failure (fire-and-forget, non-blocking)
  logGenerationError(errorDetail);

  return {
    desarrollo: '',
    success: false,
    provider: 'none',
    error: `Error de generación: tanto el proveedor principal como el fallback fallaron. ${errorDetail}`,
  };
}

/**
 * Logs a generation error to the audit_logs table.
 * Fire-and-forget: does not block the caller or propagate errors.
 */
function logGenerationError(errorDetail: string): void {
  auditLogger.log({
    action: 'GENERATE',
    entityType: 'acta',
    metadataJson: {
      status: 'Error_generacion',
      error: errorDetail,
      timestamp: new Date().toISOString(),
    },
    ipAddress: '0.0.0.0',
  });
}
