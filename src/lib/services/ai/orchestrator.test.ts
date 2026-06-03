/**
 * Tests for AI Generation Orchestrator
 *
 * Validates the orchestration flow including:
 * - Text extraction from attachments
 * - Primary provider success path
 * - Fallback on primary failure
 * - Fallback on timeout
 * - Both providers failing → error result
 * - Media files skipped during extraction
 * - generateActaContent public API (never throws)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateActaWithAI, generateActaContent, generateActaContentFromForm } from './orchestrator';
import type { ActaGenerationInput, ActaGenerationResult } from './provider.interface';

// Mock dependencies
vi.mock('./factory', () => ({
  createAIProvider: vi.fn(),
}));

vi.mock('./text-extractor', () => ({
  extractText: vi.fn().mockResolvedValue('Extracted text content'),
  isUnsupportedMediaType: vi.fn((mimeType: string) =>
    mimeType.startsWith('image/') || mimeType.startsWith('audio/') || mimeType.startsWith('video/')
  ),
}));

vi.mock('@/lib/services/audit.service', () => ({
  auditLogger: {
    log: vi.fn(),
  },
}));

import { createAIProvider } from './factory';
import { extractText } from './text-extractor';

const mockedCreateAIProvider = vi.mocked(createAIProvider);
const mockedExtractText = vi.mocked(extractText);

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function buildInput(overrides?: Partial<ActaGenerationInput>): ActaGenerationInput {
  return {
    ordenDia: '1. Revisión de plan de estudios\n2. Aprobación de syllabus',
    asistentes: [
      { nombre: 'Juan Pérez', cargo: 'Decano' },
      { nombre: 'María López', cargo: 'Directora de Programa' },
    ],
    attachmentTexts: [],
    tipoComite: 'Curricular',
    areaPrograma: 'Ingeniería Industrial',
    ...overrides,
  };
}

function buildSuccessResult(provider: string = 'openai'): ActaGenerationResult {
  return {
    desarrollo: 'DESARROLLO DE LA SESIÓN\n\nContenido generado por IA.',
    success: true,
    provider,
  };
}

function createMockProvider(overrides: {
  generateActaContent?: () => Promise<ActaGenerationResult>;
  isAvailable?: () => Promise<boolean>;
} = {}) {
  return {
    generateActaContent: overrides.generateActaContent ?? vi.fn().mockResolvedValue(buildSuccessResult()),
    extractTextFromDocument: vi.fn().mockResolvedValue(''),
    isAvailable: overrides.isAvailable ?? vi.fn().mockResolvedValue(true),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateActaWithAI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedExtractText.mockReset();
    mockedExtractText.mockResolvedValue('Extracted text content');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('successful primary provider', () => {
    it('returns result from primary provider when it succeeds', async () => {
      const mockProvider = createMockProvider();
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const resultPromise = generateActaWithAI(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.desarrollo).toContain('Contenido generado por IA');
    });

    it('passes extracted attachment texts to the primary provider', async () => {
      const generateFn = vi.fn().mockResolvedValue(buildSuccessResult());
      const mockProvider = createMockProvider({
        generateActaContent: generateFn,
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);
      mockedExtractText.mockResolvedValue('Texto del PDF');

      const input = buildInput();
      const attachments = [
        { buffer: Buffer.from('pdf content'), mimeType: 'application/pdf' },
      ];

      const resultPromise = generateActaWithAI(input, attachments);
      await vi.runAllTimersAsync();
      await resultPromise;

      // Verify extractText was called for the PDF
      expect(mockedExtractText).toHaveBeenCalledWith(
        Buffer.from('pdf content'),
        'application/pdf',
        '',
      );

      // Verify the full input passed to generateActaContent includes extracted text
      expect(generateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentTexts: ['Texto del PDF'],
        }),
      );
    });

    it('skips media files during text extraction', async () => {
      const mockProvider = createMockProvider();
      mockedCreateAIProvider.mockReturnValue(mockProvider);
      mockedExtractText.mockResolvedValue('should not be called');

      const input = buildInput();
      const attachments = [
        { buffer: Buffer.from('image data'), mimeType: 'image/png' },
        { buffer: Buffer.from('audio data'), mimeType: 'audio/mpeg' },
        { buffer: Buffer.from('video data'), mimeType: 'video/mp4' },
      ];

      const resultPromise = generateActaWithAI(input, attachments);
      await vi.runAllTimersAsync();
      await resultPromise;

      // extractText should NOT be called for media files
      expect(mockedExtractText).not.toHaveBeenCalled();
    });
  });

  describe('fallback on primary failure', () => {
    it('falls back to FallbackProvider when primary returns success=false', async () => {
      const mockProvider = createMockProvider({
        generateActaContent: vi.fn().mockResolvedValue({
          desarrollo: '',
          success: false,
          provider: 'openai',
          error: 'API key invalid',
        }),
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const resultPromise = generateActaWithAI(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.provider).toBe('fallback');
      expect(result.desarrollo).toContain('DESARROLLO DE LA SESIÓN');
    });

    it('falls back to FallbackProvider when primary throws an error', async () => {
      const mockProvider = createMockProvider({
        generateActaContent: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const resultPromise = generateActaWithAI(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.provider).toBe('fallback');
      expect(result.desarrollo).toContain('DESARROLLO DE LA SESIÓN');
    });
  });

  describe('timeout handling', () => {
    it('falls back to FallbackProvider when primary times out (5 minutes)', async () => {
      // Create a provider that never resolves
      const mockProvider = createMockProvider({
        generateActaContent: () => new Promise(() => {/* never resolves */}),
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const resultPromise = generateActaWithAI(input);

      // Advance past the 5-minute timeout
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.provider).toBe('fallback');
    });
  });

  describe('both providers fail', () => {
    it('returns error result when both primary and fallback fail', async () => {
      // Primary provider fails
      const mockProvider = createMockProvider({
        generateActaContent: vi.fn().mockRejectedValue(new Error('Primary failed')),
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      // Mock FallbackProvider to also fail by importing and spying
      const fallbackModule = await import('./fallback.provider');
      vi.spyOn(fallbackModule.FallbackProvider.prototype, 'generateActaContent')
        .mockRejectedValue(new Error('Fallback also failed'));

      const input = buildInput();
      const resultPromise = generateActaWithAI(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.provider).toBe('none');
      expect(result.error).toContain('Error de generación');
      expect(result.error).toContain('Fallback also failed');
    });
  });

  describe('text extraction edge cases', () => {
    it('continues with empty texts when extraction fails for a single file', async () => {
      mockedExtractText
        .mockResolvedValueOnce('First file text')
        .mockRejectedValueOnce(new Error('Parse error'))
        .mockResolvedValueOnce('Third file text');

      const generateFn = vi.fn().mockResolvedValue(buildSuccessResult());
      const mockProvider = createMockProvider({
        generateActaContent: generateFn,
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const attachments = [
        { buffer: Buffer.from('file1'), mimeType: 'application/pdf' },
        { buffer: Buffer.from('file2'), mimeType: 'application/pdf' },
        { buffer: Buffer.from('file3'), mimeType: 'text/plain' },
      ];

      const resultPromise = generateActaWithAI(input, attachments);
      await vi.runAllTimersAsync();
      await resultPromise;

      // Should include text from files 1 and 3, skip file 2 (error → empty)
      expect(generateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentTexts: ['First file text', 'Third file text'],
        }),
      );
    });

    it('works correctly with no attachments', async () => {
      const mockProvider = createMockProvider();
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput({ attachmentTexts: ['existing text'] });
      const resultPromise = generateActaWithAI(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
    });

    it('works correctly with empty attachments array', async () => {
      const mockProvider = createMockProvider();
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const resultPromise = generateActaWithAI(input, []);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
    });
  });

  describe('generateActaContent public API', () => {
    it('returns result from primary provider when it succeeds', async () => {
      const mockProvider = createMockProvider();
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const resultPromise = generateActaContent(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
    });

    it('accepts attachments with extension field', async () => {
      const generateFn = vi.fn().mockResolvedValue(buildSuccessResult());
      const mockProvider = createMockProvider({
        generateActaContent: generateFn,
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);
      mockedExtractText.mockResolvedValue('PDF extracted text');

      const input = buildInput();
      const attachments = [
        { buffer: Buffer.from('pdf content'), mimeType: 'application/pdf', extension: '.pdf' },
        { buffer: Buffer.from('txt content'), mimeType: 'text/plain', extension: '.txt' },
      ];

      const resultPromise = generateActaContent(input, attachments);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockedExtractText).toHaveBeenCalledTimes(2);
    });

    it('never throws even on unexpected internal errors', async () => {
      // Force createAIProvider to throw unexpectedly
      mockedCreateAIProvider.mockImplementation(() => {
        throw new Error('Unexpected factory crash');
      });

      const input = buildInput();
      const resultPromise = generateActaContent(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Should return error result, not throw
      expect(result.success).toBe(false);
      expect(result.provider).toBe('none');
      expect(result.error).toContain('Unexpected factory crash');
    });

    it('skips media files in attachments with extension field', async () => {
      const mockProvider = createMockProvider();
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const attachments = [
        { buffer: Buffer.from('image data'), mimeType: 'image/png', extension: '.png' },
        { buffer: Buffer.from('video data'), mimeType: 'video/mp4', extension: '.mp4' },
      ];

      const resultPromise = generateActaContent(input, attachments);
      await vi.runAllTimersAsync();
      await resultPromise;

      // extractText should NOT be called for media files
      expect(mockedExtractText).not.toHaveBeenCalled();
    });

    it('falls back on primary timeout with 5-minute limit', async () => {
      const mockProvider = createMockProvider({
        generateActaContent: () => new Promise(() => {/* never resolves */}),
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const resultPromise = generateActaContent(input);

      // Advance past the 5-minute timeout
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.provider).toBe('fallback');
    });

    it('returns error result when both primary and fallback fail', async () => {
      const mockProvider = createMockProvider({
        generateActaContent: vi.fn().mockRejectedValue(new Error('Primary failed')),
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      // Mock FallbackProvider to also fail
      const fallbackModule = await import('./fallback.provider');
      vi.spyOn(fallbackModule.FallbackProvider.prototype, 'generateActaContent')
        .mockRejectedValue(new Error('Fallback also failed'));

      const input = buildInput();
      const resultPromise = generateActaContent(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.provider).toBe('none');
      expect(result.error).toContain('Error de generación');
    });
  });

  describe('generateActaContentFromForm', () => {
    it('generates content using only form data without attachment extraction', async () => {
      const generateFn = vi.fn().mockResolvedValue(buildSuccessResult());
      const mockProvider = createMockProvider({
        generateActaContent: generateFn,
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput({ attachmentTexts: ['pre-extracted text'] });
      const resultPromise = generateActaContentFromForm(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      // extractText should NOT be called since no attachments are passed
      expect(mockedExtractText).not.toHaveBeenCalled();
      // The pre-populated attachmentTexts should be passed through
      expect(generateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentTexts: ['pre-extracted text'],
        }),
      );
    });

    it('falls back to FallbackProvider on primary failure', async () => {
      const mockProvider = createMockProvider({
        generateActaContent: vi.fn().mockRejectedValue(new Error('API down')),
      });
      mockedCreateAIProvider.mockReturnValue(mockProvider);

      const input = buildInput();
      const resultPromise = generateActaContentFromForm(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.provider).toBe('fallback');
    });

    it('never throws even on unexpected errors', async () => {
      mockedCreateAIProvider.mockImplementation(() => {
        throw new Error('Unexpected crash');
      });

      const input = buildInput();
      const resultPromise = generateActaContentFromForm(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.provider).toBe('none');
      expect(result.error).toContain('Unexpected crash');
    });
  });
});
