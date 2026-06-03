/**
 * Fallback Provider - Enhanced
 *
 * Generates detailed formal academic minute content using form data AND
 * the extracted text from attached documents. Produces rich, point-by-point
 * development incorporating actual document content.
 *
 * This provider works WITHOUT external AI APIs — it uses structured
 * template logic enhanced with attachment content to produce professional actas.
 *
 * Requirements: 8.3, 8.6, 14.5
 */

import type { IAIProvider, ActaGenerationInput, ActaGenerationResult } from './provider.interface';

/**
 * Maps committee type to its formal Spanish name.
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
 * Extracts meaningful sentences from attachment text.
 * Cleans up whitespace, removes very short lines, limits length.
 */
function extractKeyContent(text: string, maxSentences: number = 8): string[] {
  if (!text || text.trim().length === 0) return [];

  // Split by sentence endings or line breaks
  const sentences = text
    .split(/[.\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15) // Only meaningful sentences
    .slice(0, maxSentences);

  return sentences;
}

/**
 * Distributes attachment content across agenda points.
 * Tries to relate content to points by keywords or distributes evenly.
 */
function distributeContentToPoints(
  agendaPoints: string[],
  attachmentTexts: string[]
): Map<number, string[]> {
  const contentMap = new Map<number, string[]>();

  // Initialize all points
  agendaPoints.forEach((_, idx) => contentMap.set(idx, []));

  if (attachmentTexts.length === 0) return contentMap;

  // Combine all attachment text
  const allContent = attachmentTexts.join('\n\n');
  const allSentences = extractKeyContent(allContent, 30);

  if (allSentences.length === 0) return contentMap;

  // Try keyword matching first
  agendaPoints.forEach((punto, idx) => {
    const keywords = punto.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matched: string[] = [];

    allSentences.forEach(sentence => {
      const sentLower = sentence.toLowerCase();
      if (keywords.some(kw => sentLower.includes(kw))) {
        matched.push(sentence);
      }
    });

    if (matched.length > 0) {
      contentMap.set(idx, matched.slice(0, 4));
    }
  });

  // Distribute remaining content to points that have nothing
  const emptyPoints = [...contentMap.entries()].filter(([, v]) => v.length === 0).map(([k]) => k);
  if (emptyPoints.length > 0 && allSentences.length > 0) {
    const perPoint = Math.max(1, Math.floor(allSentences.length / agendaPoints.length));
    let sentIdx = 0;
    emptyPoints.forEach(pointIdx => {
      const chunk = allSentences.slice(sentIdx, sentIdx + perPoint);
      if (chunk.length > 0) {
        contentMap.set(pointIdx, chunk);
        sentIdx += perPoint;
      }
    });
  }

  return contentMap;
}

export class FallbackProvider implements IAIProvider {
  /**
   * Generates detailed formal academic minute content using form data
   * and extracted attachment text. Produces rich point-by-point development.
   */
  async generateActaContent(input: ActaGenerationInput): Promise<ActaGenerationResult> {
    const { ordenDia, asistentes, attachmentTexts, tipoComite, areaPrograma } = input;
    const nombreComite = getComiteNombreFormal(tipoComite);

    // Parse agenda points
    const agendaPoints = ordenDia
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Get useful content from attachments
    const validTexts = attachmentTexts.filter(t => t.trim().length > 0);
    const contentDistribution = distributeContentToPoints(agendaPoints, validTexts);

    // Build the desarrollo
    const parts: string[] = [];

    // Header
    parts.push(
      `Se dio inicio a la sesión del ${nombreComite} del programa de ${areaPrograma}, ` +
      `contando con la asistencia de ${asistentes.length} miembro(s), ` +
      `con el fin de abordar los ${agendaPoints.length} punto(s) establecidos en el orden del día.`
    );

    // Each agenda point with detailed content
    if (agendaPoints.length === 0) {
      parts.push('\nNo se registraron puntos en el orden del día para esta sesión.');
    } else {
      agendaPoints.forEach((punto, idx) => {
        const pointNum = idx + 1;
        const relatedContent = contentDistribution.get(idx) || [];

        let section = `\n${pointNum}. ${punto}\n\n`;

        if (relatedContent.length > 0) {
          // Use attachment content to elaborate on the point
          section += `Se abordó el punto ${pointNum} del orden del día referente a "${punto}". `;
          section += `De acuerdo con la documentación presentada y la discusión realizada, se estableció lo siguiente:\n\n`;

          relatedContent.forEach(content => {
            section += `• ${content}.\n`;
          });

          section += `\nLos miembros del comité tomaron nota de los aspectos expuestos y se acordaron las acciones correspondientes.`;
        } else {
          // No specific content available — use more descriptive neutral language
          section += `Se procedió a la revisión y discusión del punto ${pointNum} del orden del día: "${punto}". `;
          section += `Los miembros del comité analizaron los aspectos relevantes relacionados con este tema. `;
          section += `Se tomaron las consideraciones pertinentes y se dejó constancia de los acuerdos alcanzados.`;
        }

        parts.push(section);
      });
    }

    // Supporting documents section
    if (validTexts.length > 0) {
      parts.push(
        `\nDocumentos de soporte: Se presentaron ${validTexts.length} documento(s) de soporte ` +
        `que fueron revisados y analizados por los miembros del comité durante la sesión.`
      );
    }

    // Attendees section
    if (asistentes.length > 0) {
      parts.push('\nAsistentes a la sesión:');
      asistentes.forEach((a, idx) => {
        parts.push(`  ${idx + 1}. ${a.nombre} – ${a.cargo}`);
      });
    }

    // Closing
    parts.push(
      `\nNo habiendo más asuntos que tratar, se dio por terminada la sesión del ${nombreComite}, ` +
      `dejando constancia de los compromisos y acuerdos establecidos durante la reunión.`
    );

    const desarrollo = parts.join('\n');

    return {
      desarrollo,
      success: true,
      provider: 'fallback',
    };
  }

  async extractTextFromDocument(_buffer: Buffer, _mimeType: string): Promise<string> {
    return '';
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
