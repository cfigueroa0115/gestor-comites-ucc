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
  return `Eres un redactor profesional de actas de comités académicos universitarios en Colombia.

Tu tarea: Generar la sección DESARROLLO DE LA SESIÓN de un acta formal.

Formato: Español formal colombiano, tercera persona, tiempo pasado, texto plano sin markdown.

Estructura obligatoria:
1. APERTURA: Indica comité, programa, fecha, lugar, quórum verificado y asistentes presentes.
2. DESARROLLO: Sigue EXACTAMENTE los puntos del ORDEN DEL DÍA como secciones numeradas. Para cada punto, desarrolla el contenido basándote en la información de las fuentes.
3. CIERRE: Compromisos adquiridos con responsables, y cierre formal de la sesión.

Reglas de contenido:
- Usa ÚNICAMENTE información de las fuentes proporcionadas (documentos, transcripciones de audio/video, grabación de voz).
- Incluye todas las cifras, nombres, fechas y decisiones tal como aparecen en las fuentes.
- Atribuye las intervenciones a quien las realizó.
- Si para un punto no hay información en las fuentes, indica brevemente que se revisó el tema.
- NO inventes datos que no estén en las fuentes.

Reglas de calidad:
- Si recibes múltiples fuentes con contenido similar o repetido, UNIFICA la información sin duplicar párrafos.
- Clasifica y organiza la información por punto del orden del día, sin repetir lo mismo en diferentes secciones.
- Redacta de forma fluida, coherente y profesional. Evita redundancias.
- El acta debe tener alto nivel de redacción académica institucional.`;
}

/**
 * Builds the user prompt with all available data.
 */
function buildUserPrompt(input: ActaGenerationInput): string {
  const { ordenDia, asistentes, attachmentTexts, tipoComite, areaPrograma } = input;

  const asistentesFormatted = asistentes
    .map((a, i) => `  ${i + 1}. ${a.nombre} – ${a.cargo}`)
    .join('\n');

  let prompt = `Genera el DESARROLLO DE LA SESIÓN para esta acta de comité. Usa los puntos del ORDEN DEL DÍA como estructura principal.

COMITÉ: ${tipoComite} | PROGRAMA: ${areaPrograma}
FECHA: ${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric' })}

ASISTENTES:
${asistentesFormatted}

ORDEN DEL DÍA (usa estos puntos como estructura del desarrollo):
${ordenDia}
`;

  const validTexts = attachmentTexts.filter(t => t.trim().length > 0);
  if (validTexts.length > 0) {
    prompt += `\nFUENTES DE INFORMACIÓN DE LA SESIÓN:\n`;
    prompt += `(Pueden venir de: documentos adjuntos, transcripción de audio/video, o grabación de voz en vivo.\n`;
    prompt += `Si hay contenido repetido entre fuentes, UNIFICA sin duplicar. Clasifica por punto del orden del día.)\n\n`;
    validTexts.forEach((text, idx) => {
      const trimmed = text.length > 2500 ? text.substring(0, 2500) + '\n...' : text;
      prompt += `[Fuente ${idx + 1}]\n${trimmed}\n\n`;
    });
  }

  prompt += `Desarrolla cada punto del orden del día con la información de las fuentes. No repitas contenido entre secciones. Incluye datos, nombres y decisiones. Redacción académica de alta calidad.`;

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
