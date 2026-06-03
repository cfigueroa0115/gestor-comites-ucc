/**
 * Unit tests for OpenAIProvider
 *
 * Tests the provider logic by mocking the OpenAI SDK client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ActaGenerationInput } from './provider.interface';

// Mock the OpenAI module
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const mockModelsList = vi.fn();
  return {
    default: class OpenAI {
      chat = { completions: { create: mockCreate } };
      models = { list: mockModelsList };
      static APIError = class APIError extends Error {
        status: number;
        constructor(status: number, message: string) {
          super(message);
          this.status = status;
          this.name = 'APIError';
        }
      };
    },
  };
});

// Import after mocking
import { OpenAIProvider } from './openai.provider';
import OpenAI from 'openai';

const sampleInput: ActaGenerationInput = {
  ordenDia: '1. Apertura\n2. Revisión de notas\n3. Cierre',
  asistentes: [
    { nombre: 'Carlos Figueroa', cargo: 'Decano' },
    { nombre: 'María López', cargo: 'Profesor' },
  ],
  attachmentTexts: ['Contenido del documento adjunto.'],
  tipoComite: 'Curricular',
  areaPrograma: 'Ingeniería Industrial',
};

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockModelsList: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('AI_API_KEY', 'test-api-key-12345');
    vi.stubEnv('AI_MODEL', 'gpt-4o');
    provider = new OpenAIProvider();
    // Access the mocked functions
    mockCreate = (provider as unknown as { client: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } }).client.chat.completions.create as unknown as ReturnType<typeof vi.fn>;
    mockModelsList = (provider as unknown as { client: { models: { list: ReturnType<typeof vi.fn> } } }).client.models.list as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('generateActaContent', () => {
    it('should return successful result when OpenAI responds with content', async () => {
      const generatedText = 'Se dio apertura a la sesión del Comité Curricular...';
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: generatedText } }],
      });

      const result = await provider.generateActaContent(sampleInput);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.desarrollo).toBe(generatedText);
      expect(result.error).toBeUndefined();
    });

    it('should return failure when response has no content', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '' } }],
      });

      const result = await provider.generateActaContent(sampleInput);

      expect(result.success).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.error).toContain('no generó contenido');
    });

    it('should return failure when response choices are null', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      const result = await provider.generateActaContent(sampleInput);

      expect(result.success).toBe(false);
      expect(result.provider).toBe('openai');
    });

    it('should handle timeout (AbortError)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockCreate.mockRejectedValueOnce(abortError);

      const result = await provider.generateActaContent(sampleInput);

      expect(result.success).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.error).toContain('tiempo límite de 5 minutos');
    });

    it('should handle rate limit errors (429)', async () => {
      const apiError = new (OpenAI.APIError as unknown as new (status: number, message: string) => Error & { status: number })(429, 'Rate limit exceeded');
      mockCreate.mockRejectedValueOnce(apiError);

      const result = await provider.generateActaContent(sampleInput);

      expect(result.success).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.error).toContain('límite de solicitudes');
    });

    it('should handle authentication errors (401)', async () => {
      const apiError = new (OpenAI.APIError as unknown as new (status: number, message: string) => Error & { status: number })(401, 'Invalid API key');
      mockCreate.mockRejectedValueOnce(apiError);

      const result = await provider.generateActaContent(sampleInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('inválida o no autorizada');
    });

    it('should handle server errors (500/503)', async () => {
      const apiError = new (OpenAI.APIError as unknown as new (status: number, message: string) => Error & { status: number })(503, 'Service unavailable');
      mockCreate.mockRejectedValueOnce(apiError);

      const result = await provider.generateActaContent(sampleInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('no está disponible temporalmente');
    });

    it('should handle generic errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.generateActaContent(sampleInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should pass correct model and messages to OpenAI', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Contenido generado.' } }],
      });

      await provider.generateActaContent(sampleInput);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const [params] = mockCreate.mock.calls[0];
      expect(params.model).toBe('gpt-4o');
      expect(params.messages).toHaveLength(2);
      expect(params.messages[0].role).toBe('system');
      expect(params.messages[1].role).toBe('user');
      expect(params.messages[1].content).toContain('Curricular');
      expect(params.messages[1].content).toContain('Ingeniería Industrial');
    });

    it('should include attachment texts in user prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Contenido.' } }],
      });

      await provider.generateActaContent(sampleInput);

      const [params] = mockCreate.mock.calls[0];
      expect(params.messages[1].content).toContain('CONTENIDO EXTRAÍDO DE DOCUMENTOS ADJUNTOS');
      expect(params.messages[1].content).toContain('Contenido del documento adjunto.');
    });

    it('should not include attachment section when all texts are empty', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Contenido.' } }],
      });

      const inputNoAttachments = { ...sampleInput, attachmentTexts: ['', '  '] };
      await provider.generateActaContent(inputNoAttachments);

      const [params] = mockCreate.mock.calls[0];
      expect(params.messages[1].content).not.toContain('CONTENIDO EXTRAÍDO DE DOCUMENTOS ADJUNTOS');
    });
  });

  describe('extractTextFromDocument', () => {
    it('should return empty string (delegated to task 13.5)', async () => {
      const result = await provider.extractTextFromDocument(Buffer.from('test'), 'application/pdf');
      expect(result).toBe('');
    });
  });

  describe('isAvailable', () => {
    it('should return false when AI_API_KEY is not set', async () => {
      vi.stubEnv('AI_API_KEY', '');
      const p = new OpenAIProvider();
      const result = await p.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when AI_API_KEY is whitespace only', async () => {
      vi.stubEnv('AI_API_KEY', '   ');
      const p = new OpenAIProvider();
      const result = await p.isAvailable();
      expect(result).toBe(false);
    });

    it('should return true when API key is set and non-empty', async () => {
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });
  });
});
