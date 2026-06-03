/**
 * Groq Provider
 *
 * Implements IAIProvider using Groq's OpenAI-compatible API.
 * Uses Llama 3.1 models for fast, free AI generation.
 * Groq API is compatible with the OpenAI SDK format.
 *
 * Requirements: 8.1, 8.2, 8.5
 */

import type { IAIProvider, ActaGenerationInput, ActaGenerationResult } from './provider.interface';

/** Groq API base URL (OpenAI-compatible) */
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Maximum time allowed for AI generation (5 minutes). */
const TIMEOUT_MS = 5 * 60 * 1000;

/** Default model */
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/**
 * Builds the system prompt for formal academic minute generation.
 */
function buildSystemPrompt(): string {
  return `Eres un asistente especializado en redacción de actas formales para comités académicos universitarios en Colombia. Tu tarea es generar el contenido COMPLETO y DETALLADO de la sección "DESARROLLO DE LA SESIÓN" de un acta de comité académico.

INSTRUCCIONES ESTRICTAS:
1. Redacta en español formal académico colombiano, en tercera persona y tiempo pasado.
2. Genera contenido EXTENSO y DETALLADO para cada punto del orden del día (mínimo 3-4 párrafos por punto).
3. Utiliza TODA la información proporcionada en los documentos adjuntos para elaborar cada punto.
4. Si hay documentos de soporte, INCORPORA su contenido directamente en el desarrollo de cada punto relevante.
5. Si la información para un punto es insuficiente, elabora con lenguaje neutral profesional indicando que se revisó el tema.
6. Incluye una sección de apertura indicando tipo de comité, programa, fecha y quórum.
7. Incluye una sección de cierre con compromisos y fin de sesión.
8. NO uses formato markdown. Usa texto plano con numeración.
9. Mantén un tono institucional, objetivo y profesional.
10. El desarrollo debe ser COMPLETO y listo para insertar en un documento Word oficial.`;
}

/**
 * Builds the user prompt with all available data.
 */
function buildUserPrompt(input: ActaGenerationInput): string {
  const { ordenDia, asistentes, attachmentTexts, tipoComite, areaPrograma } = input;

  const asistentesFormatted = asistentes
    .map((a, i) => `  ${i + 1}. ${a.nombre} – ${a.cargo}`)
    .join('\n');

  let prompt = `Genera el DESARROLLO COMPLETO Y DETALLADO de la sesión para la siguiente acta de comité:

TIPO DE COMITÉ: ${tipoComite}
PROGRAMA: ${areaPrograma}
FECHA: ${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric' })}

ORDEN DEL DÍA:
${ordenDia}

ASISTENTES (${asistentes.length}):
${asistentesFormatted}
`;

  const validTexts = attachmentTexts.filter(t => t.trim().length > 0);
  if (validTexts.length > 0) {
    prompt += `\n\nDOCUMENTOS DE SOPORTE ADJUNTOS (${validTexts.length} documento(s)):\nUSA ESTE CONTENIDO para desarrollar cada punto del acta de forma DETALLADA:\n\n`;
    validTexts.forEach((text, idx) => {
      // Limit each document to 3000 chars to stay within context limits
      const trimmed = text.length > 3000 ? text.substring(0, 3000) + '...[contenido recortado]' : text;
      prompt += `--- DOCUMENTO ${idx + 1} ---\n${trimmed}\n\n`;
    });
  }

  prompt += `\nRECUERDA: Genera un desarrollo EXTENSO, DETALLADO y PROFESIONAL. Cada punto del orden del día debe tener varios párrafos de desarrollo basados en la información disponible. El documento final será un acta oficial.`;

  return prompt;
}

export class GroqProvider implements IAIProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.AI_API_KEY ?? '';
    this.model = process.env.AI_MODEL || DEFAULT_MODEL;
  }

  async generateActaContent(input: ActaGenerationInput): Promise<ActaGenerationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(GROQ_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(input) },
          ],
          temperature: 0.4,
          max_tokens: 8000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          desarrollo: '',
          success: false,
          provider: 'groq',
          error: `Groq API error (${response.status}): ${errorBody.substring(0, 200)}`,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content || content.trim().length === 0) {
        return {
          desarrollo: '',
          success: false,
          provider: 'groq',
          error: 'Groq no generó contenido en la respuesta.',
        };
      }

      return {
        desarrollo: content.trim(),
        success: true,
        provider: 'groq',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      if (msg.includes('abort')) {
        return { desarrollo: '', success: false, provider: 'groq', error: 'Timeout: la generación excedió 5 minutos.' };
      }
      return { desarrollo: '', success: false, provider: 'groq', error: `Error Groq: ${msg}` };
    }
  }

  async extractTextFromDocument(_buffer: Buffer, _mimeType: string): Promise<string> {
    return '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }
}
