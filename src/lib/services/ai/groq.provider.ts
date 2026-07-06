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

/** Default model - llama-3.1-8b-instant has higher rate limits on free tier */
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

/**
 * Builds the system prompt for formal academic minute generation.
 */
function buildSystemPrompt(): string {
  return `Redacta actas de comités académicos. Español formal colombiano, tercera persona, tiempo pasado, texto plano.

INSTRUCCIÓN CLAVE: Lee con máxima precisión las FUENTES proporcionadas. Cada dato, nombre, cifra, decisión y compromiso que aparezca en las fuentes DEBE aparecer textualmente en el acta. NO resumas ni generalices: transcribe la información detallada.

Estructura: Apertura (comité, fecha, asistentes, quórum) → Desarrollo (un punto por cada ítem del orden del día, desarrollado con los datos de las fuentes) → Cierre (compromisos con responsables).

NO inventes. Si no hay dato en las fuentes para un punto, indica brevemente que se revisó sin detalles adicionales.`;
}

/**
 * Builds the user prompt with all available data.
 */
function buildUserPrompt(input: ActaGenerationInput): string {
  const { ordenDia, asistentes, attachmentTexts, tipoComite, areaPrograma } = input;

  let prompt = `ACTA: ${tipoComite} | ${areaPrograma} | ${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric' })}

ASISTENTES: ${asistentes.map(a => a.nombre + ' (' + a.cargo + ')').join(', ')}

ORDEN DEL DÍA:
${ordenDia}
`;

  const validTexts = attachmentTexts.filter(t => t.trim().length > 0);
  if (validTexts.length > 0) {
    prompt += `\nCONTENIDO DE LA SESIÓN (lee con precisión cada detalle):\n\n`;
    validTexts.forEach((text, idx) => {
      const trimmed = text.length > 3000 ? text.substring(0, 3000) : text;
      prompt += `[${idx + 1}] ${trimmed}\n\n`;
    });
  }

  prompt += `Genera el desarrollo del acta punto por punto con TODOS los datos de las fuentes.`;

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
          temperature: 0.3,
          max_tokens: 4000,
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
