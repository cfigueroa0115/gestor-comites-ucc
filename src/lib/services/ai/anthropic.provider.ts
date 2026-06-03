/**
 * Anthropic Provider
 *
 * Implements IAIProvider using the Anthropic SDK (Claude).
 * Generates formal Spanish academic minute content structured by agenda points.
 *
 * Configuration via environment variables:
 * - AI_API_KEY: Anthropic API key
 * - AI_MODEL: Model identifier (e.g. 'claude-sonnet-4-20250514')
 *
 * Requirements: 8.1, 8.2, 8.5
 */

import Anthropic from '@anthropic-ai/sdk';
import type { IAIProvider, ActaGenerationInput, ActaGenerationResult } from './provider.interface';

/** Maximum time allowed for AI generation (5 minutes). */
const TIMEOUT_MS = 5 * 60 * 1000;

/** Default model when AI_MODEL is not set. */
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Builds the system prompt for formal academic minute generation.
 */
function buildSystemPrompt(): string {
  return (
    'Eres un asistente especializado en redacción de actas formales para comités académicos ' +
    'universitarios en Colombia. Tu tarea es generar el contenido de la sección "DESARROLLO DE LA SESIÓN" ' +
    'de un acta de comité académico.\n\n' +
    'Reglas estrictas:\n' +
    '1. Redacta en español formal académico colombiano.\n' +
    '2. Utiliza ÚNICAMENTE la información proporcionada en el orden del día, los datos del formulario ' +
    'y los textos extraídos de los documentos adjuntos.\n' +
    '3. NO inventes, supongas ni agregues información que no esté en los datos proporcionados.\n' +
    '4. Si la información es insuficiente para elaborar un punto del orden del día, incluye lenguaje ' +
    'neutral indicando que el punto fue revisado sin fabricar detalles.\n' +
    '5. Estructura el desarrollo siguiendo el orden de los puntos de la agenda.\n' +
    '6. Usa un tono formal, impersonal y objetivo propio de documentos institucionales universitarios.\n' +
    '7. Incluye una frase de apertura indicando el inicio de la sesión y una de cierre.'
  );
}

/**
 * Builds the user prompt with the acta form data and extracted attachment content.
 */
function buildUserPrompt(input: ActaGenerationInput): string {
  const { ordenDia, asistentes, attachmentTexts, tipoComite, areaPrograma } = input;

  const attendeesList = asistentes
    .map((a, i) => `  ${i + 1}. ${a.nombre} – ${a.cargo}`)
    .join('\n');

  let prompt =
    `Genera el DESARROLLO DE LA SESIÓN para un acta de comité académico con los siguientes datos:\n\n` +
    `TIPO DE COMITÉ: ${tipoComite}\n` +
    `ÁREA/PROGRAMA: ${areaPrograma}\n\n` +
    `ASISTENTES:\n${attendeesList}\n\n` +
    `ORDEN DEL DÍA:\n${ordenDia}\n`;

  // Include extracted text from attachments if available
  const relevantTexts = attachmentTexts.filter((t) => t.trim().length > 0);
  if (relevantTexts.length > 0) {
    prompt += `\nDOCUMENTOS DE SOPORTE (textos extraídos):\n`;
    relevantTexts.forEach((text, idx) => {
      prompt += `\n--- Documento ${idx + 1} ---\n${text}\n`;
    });
  }

  prompt +=
    `\nGenera ÚNICAMENTE el texto del desarrollo de la sesión. ` +
    `No incluyas encabezados como "DESARROLLO DE LA SESIÓN" ni formateo Markdown. ` +
    `Responde solo con el contenido del desarrollo en texto plano.`;

  return prompt;
}

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.AI_API_KEY ?? '',
    });
    this.model = process.env.AI_MODEL || DEFAULT_MODEL;
  }

  /**
   * Generates formal academic minute content using the Anthropic Claude API.
   * Enforces a 5-minute timeout.
   */
  async generateActaContent(input: ActaGenerationInput): Promise<ActaGenerationResult> {
    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(input);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await this.client.messages.create(
          {
            model: this.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: userPrompt,
              },
            ],
          },
          {
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        // Extract text content from the response
        const textBlocks = response.content.filter(
          (block) => block.type === 'text'
        );
        const desarrollo = textBlocks.map((block) => block.text).join('\n\n');

        if (!desarrollo.trim()) {
          return {
            desarrollo: '',
            success: false,
            provider: 'anthropic',
            error: 'Anthropic returned empty content',
          };
        }

        return {
          desarrollo: desarrollo.trim(),
          success: true,
          provider: 'anthropic',
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Anthropic API error';

      // Detect timeout/abort
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || errorMessage.includes('abort'))
      ) {
        return {
          desarrollo: '',
          success: false,
          provider: 'anthropic',
          error: 'Anthropic request timed out after 5 minutes',
        };
      }

      return {
        desarrollo: '',
        success: false,
        provider: 'anthropic',
        error: `Anthropic API error: ${errorMessage}`,
      };
    }
  }

  /**
   * Text extraction is handled by dedicated utilities (task 13.5).
   * This method is a placeholder that returns an empty string.
   */
  async extractTextFromDocument(_buffer: Buffer, _mimeType: string): Promise<string> {
    return '';
  }

  /**
   * Checks whether the Anthropic provider is available by verifying
   * that the AI_API_KEY environment variable is set.
   */
  async isAvailable(): Promise<boolean> {
    const apiKey = process.env.AI_API_KEY;
    return !!apiKey && apiKey.trim().length > 0;
  }
}
