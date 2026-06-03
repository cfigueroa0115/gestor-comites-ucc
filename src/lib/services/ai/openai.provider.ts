/**
 * OpenAI Provider
 *
 * Implements IAIProvider using the OpenAI SDK to generate formal academic
 * minute content structured by agenda points. Uses AbortController with a
 * 5-minute timeout as required by the specification.
 *
 * Environment variables:
 * - AI_API_KEY: OpenAI API key
 * - AI_MODEL: Model identifier (defaults to 'gpt-4o')
 *
 * Requirements: 8.1, 8.2, 8.5
 */

import OpenAI from 'openai';
import type { IAIProvider, ActaGenerationInput, ActaGenerationResult } from './provider.interface';

/** Maximum time allowed for a single AI generation request (5 minutes). */
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Builds the system prompt instructing the AI to generate formal Spanish
 * academic committee minute content.
 */
function buildSystemPrompt(): string {
  return `Eres un asistente especializado en redacción de actas formales para comités académicos universitarios en Colombia. Tu tarea es generar el contenido de la sección "DESARROLLO DE LA SESIÓN" de un acta de comité.

Reglas estrictas:
1. Redacta en español formal académico, en tercera persona y tiempo pasado.
2. Estructura el contenido siguiendo cada punto del orden del día como sección numerada.
3. Utiliza ÚNICAMENTE la información proporcionada en los datos del formulario y en los textos extraídos de los documentos adjuntos. NO inventes ni agregues información que no esté presente en los datos proporcionados.
4. Si la información disponible para un punto del orden del día es insuficiente, incluye lenguaje neutral que indique que el punto fue revisado sin fabricar detalles. Ejemplo: "Se revisó el punto correspondiente a [tema]. Los miembros del comité tomaron nota de lo expuesto."
5. Incluye una sección de apertura que indique el tipo de comité, programa y que se procedió a tratar los puntos del orden del día.
6. Incluye una sección de cierre indicando que no habiendo más asuntos que tratar se dio por terminada la sesión.
7. No incluyas encabezados como "DESARROLLO DE LA SESIÓN" ya que se agrega externamente.
8. Mantén un tono institucional, objetivo y profesional.
9. No utilices markdown, viñetas ni formato especial. Usa texto plano con numeración para los puntos.`;
}

/**
 * Builds the user prompt with the specific acta data for content generation.
 */
function buildUserPrompt(input: ActaGenerationInput): string {
  const { ordenDia, asistentes, attachmentTexts, tipoComite, areaPrograma } = input;

  const asistentesFormatted = asistentes
    .map((a, i) => `  ${i + 1}. ${a.nombre} – ${a.cargo}`)
    .join('\n');

  let prompt = `Genera el contenido del desarrollo de la sesión para la siguiente acta de comité:

TIPO DE COMITÉ: ${tipoComite}
PROGRAMA: ${areaPrograma}

ORDEN DEL DÍA:
${ordenDia}

ASISTENTES:
${asistentesFormatted}
`;

  // Include extracted attachment text if available
  const validTexts = attachmentTexts.filter((t) => t.trim().length > 0);
  if (validTexts.length > 0) {
    prompt += `\nCONTENIDO EXTRAÍDO DE DOCUMENTOS ADJUNTOS:\n`;
    validTexts.forEach((text, idx) => {
      prompt += `\n--- Documento ${idx + 1} ---\n${text}\n`;
    });
  }

  prompt += `\nGenera el desarrollo completo de la sesión basándote exclusivamente en la información proporcionada arriba.`;

  return prompt;
}

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.AI_API_KEY,
    });
    this.model = process.env.AI_MODEL || 'gpt-4o';
  }

  /**
   * Generates formal academic content structured by agenda points using OpenAI.
   * Includes a 5-minute timeout via AbortController.
   */
  async generateActaContent(input: ActaGenerationInput): Promise<ActaGenerationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(input) },
          ],
          temperature: 0.4,
          max_tokens: 4096,
        },
        { signal: controller.signal }
      );

      const content = response.choices?.[0]?.message?.content;

      if (!content || content.trim().length === 0) {
        return {
          desarrollo: '',
          success: false,
          provider: 'openai',
          error: 'El modelo no generó contenido en la respuesta.',
        };
      }

      return {
        desarrollo: content.trim(),
        success: true,
        provider: 'openai',
      };
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      return {
        desarrollo: '',
        success: false,
        provider: 'openai',
        error: errorMessage,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Text extraction is handled by a separate task (13.5).
   * Returns empty string for now.
   */
  async extractTextFromDocument(_buffer: Buffer, _mimeType: string): Promise<string> {
    return '';
  }

  /**
   * Checks if the OpenAI provider is available by verifying the API key
   * environment variable is set and non-empty.
   */
  async isAvailable(): Promise<boolean> {
    const apiKey = process.env.AI_API_KEY;
    return !!apiKey && apiKey.trim().length > 0;
  }

  /**
   * Extracts a user-friendly error message from various error types.
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        return 'La generación de contenido excedió el tiempo límite de 5 minutos.';
      }
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return 'API key de OpenAI inválida o no autorizada.';
      }
      if (error.status === 429) {
        return 'Se ha excedido el límite de solicitudes de la API de OpenAI. Intente más tarde.';
      }
      if (error.status === 500 || error.status === 503) {
        return 'El servicio de OpenAI no está disponible temporalmente.';
      }
      return `Error de la API de OpenAI: ${error.message}`;
    }

    if (error instanceof Error) {
      return `Error al generar contenido con OpenAI: ${error.message}`;
    }

    return 'Error desconocido al generar contenido con OpenAI.';
  }
}
