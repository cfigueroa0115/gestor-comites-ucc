/**
 * Fallback Provider
 *
 * Deterministic provider that generates structured formal academic minute content
 * using only form data (no external API calls). Used when AI_PROVIDER is unset/empty
 * or when the primary provider fails.
 *
 * Generates a complete "desarrollo" section including:
 * 1. Header section with committee type and program
 * 2. Each agenda point as a numbered section with neutral template language
 * 3. Notes about supporting documents when attachment text is available
 * 4. Closing section noting the session ended
 * 5. Attendee list formatted
 *
 * Requirements: 8.3, 8.6, 14.5
 */

import type { IAIProvider, ActaGenerationInput, ActaGenerationResult } from './provider.interface';

/**
 * Maps committee type to its formal Spanish name for document generation.
 */
function getComiteNombreFormal(tipoComite: string): string {
  const mapping: Record<string, string> = {
    Curricular: 'Comité Curricular',
    Investigación: 'Comité de Investigación',
    Decanatura: 'Comité de Decanatura',
    Otro: 'Comité',
  };
  return mapping[tipoComite] || 'Comité';
}

/**
 * Parses agenda points from the ordenDia text.
 * Splits by line breaks and filters empty lines.
 */
function parseAgendaPoints(ordenDia: string): string[] {
  return ordenDia
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Formats the attendees section for the desarrollo document.
 */
function formatAttendeesSection(asistentes: { nombre: string; cargo: string }[]): string {
  if (asistentes.length === 0) {
    return '';
  }

  const header = 'Asistentes a la sesión:';
  const list = asistentes
    .map((a, idx) => `  ${idx + 1}. ${a.nombre} – ${a.cargo}`)
    .join('\n');

  return `${header}\n${list}`;
}

/**
 * Generates the header section of the desarrollo content.
 */
function generateHeader(tipoComite: string, areaPrograma: string): string {
  const nombreComite = getComiteNombreFormal(tipoComite);
  return (
    `DESARROLLO DE LA SESIÓN\n\n` +
    `Se llevó a cabo la sesión del ${nombreComite} del programa de ${areaPrograma}, ` +
    `con el fin de tratar los puntos establecidos en el orden del día.`
  );
}

/**
 * Generates the body sections from agenda points with neutral template language.
 * If attachment texts are provided for a point, includes a note about supporting documents.
 */
function generateAgendaSections(
  agendaPoints: string[],
  hasAttachments: boolean
): string {
  if (agendaPoints.length === 0) {
    return 'No se registraron puntos en el orden del día para esta sesión.';
  }

  const sections = agendaPoints.map((punto, idx) => {
    const pointNumber = idx + 1;
    let section =
      `${pointNumber}. ${punto}\n\n` +
      `Se revisó el punto ${pointNumber} del orden del día.`;

    // If there are attachments, add a note about supporting documents
    if (hasAttachments) {
      section += ` Se presentaron los documentos de soporte correspondientes.`;
    }

    return section;
  });

  return sections.join('\n\n');
}

/**
 * Generates the closing section of the desarrollo content.
 */
function generateClosing(asistentes: { nombre: string; cargo: string }[]): string {
  const attendeesSection = formatAttendeesSection(asistentes);

  const closing =
    `No habiendo más asuntos que tratar, se dio por terminada la sesión.`;

  if (attendeesSection) {
    return `${closing}\n\n${attendeesSection}`;
  }

  return closing;
}

export class FallbackProvider implements IAIProvider {
  /**
   * Generates structured formal academic minute content using only form data.
   * No external API calls are made. Always returns success.
   */
  async generateActaContent(input: ActaGenerationInput): Promise<ActaGenerationResult> {
    const { ordenDia, asistentes, attachmentTexts, tipoComite, areaPrograma } = input;

    const agendaPoints = parseAgendaPoints(ordenDia);
    const hasAttachments = attachmentTexts.length > 0 &&
      attachmentTexts.some((text) => text.trim().length > 0);

    // Build the complete desarrollo content
    const header = generateHeader(tipoComite, areaPrograma);
    const body = generateAgendaSections(agendaPoints, hasAttachments);
    const closing = generateClosing(asistentes);

    const desarrollo = [header, body, closing].join('\n\n');

    return {
      desarrollo,
      success: true,
      provider: 'fallback',
    };
  }

  /**
   * Fallback provider does not have text extraction capability.
   * Always returns an empty string.
   */
  async extractTextFromDocument(_buffer: Buffer, _mimeType: string): Promise<string> {
    return '';
  }

  /**
   * Fallback provider is always available (no external dependencies).
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }
}
