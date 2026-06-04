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
  return `Eres un redactor experto de actas formales para comités académicos universitarios en Colombia. Tu trabajo es transformar la información en bruto (transcripciones de sesiones, documentos de soporte) en un acta formal profesional.

REGLAS ABSOLUTAS DE REDACCIÓN:

1. FIDELIDAD TOTAL A LOS DATOS: Cada dato, cifra, nombre, fecha, decisión, compromiso y acuerdo mencionado en los documentos o transcripciones DEBE aparecer en el acta. NO omitas información relevante.

2. CIFRAS Y DATOS EXACTOS: Si se mencionan montos ($250 millones), porcentajes (30%), fechas (15 de marzo), cantidades (8 semestres, 160 créditos), plazos (8 días), CÍTALOS TEXTUALMENTE en el acta.

3. NOMBRES PROPIOS: Incluye TODOS los nombres de personas, instituciones, empresas, programas y proyectos mencionados. Si un profesor o funcionario dijo algo, atribúyelo a esa persona.

4. DECISIONES Y ACUERDOS: Toda votación, aprobación, rechazo o acuerdo debe quedar documentado con claridad: quién propuso, quién apoyó, resultado (aprobado por unanimidad, mayoría, etc.).

5. COMPROMISOS Y RESPONSABLES: Cada tarea, compromiso o seguimiento DEBE indicar: qué se debe hacer, quién es el responsable, y el plazo (si se mencionó).

6. FORMATO: Español formal académico colombiano. Tercera persona, tiempo pasado. Texto plano sin markdown. Numeración por puntos del orden del día.

7. ESTRUCTURA:
   - Apertura: tipo de comité, programa, fecha, hora, lugar, verificación de quórum, listado de asistentes.
   - Desarrollo: cada punto del orden del día como sección numerada con desarrollo completo.
   - Cierre: compromisos adquiridos, fecha próxima reunión (si se menciona), hora de finalización.

8. TRANSCRIPCIONES DE VOZ: Si recibes una transcripción de sesión de voz, es el contenido REAL de lo que se habló en la reunión. Extrae TODA la información relevante: temas discutidos, opiniones expresadas, decisiones tomadas, datos mencionados.

9. NO INVENTES: Si la información no está en los documentos ni en la transcripción, NO la agregues. Usa lenguaje neutral: "Se revisó el tema sin que se presentaran observaciones adicionales."

10. EXTENSIÓN: El desarrollo debe ser completo y detallado. Mínimo 3 párrafos por punto. Para puntos con mucha información, desarrolla todo el contenido disponible.`;
}

/**
 * Builds the user prompt with all available data.
 */
function buildUserPrompt(input: ActaGenerationInput): string {
  const { ordenDia, asistentes, attachmentTexts, tipoComite, areaPrograma } = input;

  const asistentesFormatted = asistentes
    .map((a, i) => `  ${i + 1}. ${a.nombre} – ${a.cargo}`)
    .join('\n');

  let prompt = `GENERA EL ACTA FORMAL COMPLETA para la siguiente sesión de comité:

═══════════════════════════════════════
DATOS DE LA SESIÓN:
═══════════════════════════════════════
TIPO DE COMITÉ: ${tipoComite}
PROGRAMA: ${areaPrograma}
FECHA: ${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric' })}

ASISTENTES (${asistentes.length}):
${asistentesFormatted}

ORDEN DEL DÍA:
${ordenDia}
═══════════════════════════════════════
`;

  const validTexts = attachmentTexts.filter(t => t.trim().length > 0);
  if (validTexts.length > 0) {
    prompt += `\n═══════════════════════════════════════\nINFORMACIÓN DE LA SESIÓN (documentos y/o transcripción de voz):\n═══════════════════════════════════════\n\n`;
    prompt += `IMPORTANTE: Esta información contiene los datos REALES de la sesión. Extrae TODOS los datos, cifras, nombres, decisiones, acuerdos y compromisos para incluirlos en el acta.\n\n`;
    validTexts.forEach((text, idx) => {
      const trimmed = text.length > 2500 ? text.substring(0, 2500) + '\n...[contenido continúa]' : text;
      prompt += `──── FUENTE ${idx + 1} ────\n${trimmed}\n\n`;
    });
  }

  prompt += `\n═══════════════════════════════════════\nINSTRUCCIONES FINALES:\n═══════════════════════════════════════\n`;
  prompt += `- Incluye TODAS las cifras, datos, nombres y decisiones de las fuentes.\n`;
  prompt += `- Cada punto del orden del día debe desarrollarse con la información REAL proporcionada.\n`;
  prompt += `- Los acuerdos y compromisos deben quedar explícitos con responsables.\n`;
  prompt += `- El acta debe reflejar FIELMENTE lo que ocurrió en la sesión.\n`;
  prompt += `- Genera el texto listo para insertar en un documento Word oficial.\n`;

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
          max_tokens: 6000,
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
