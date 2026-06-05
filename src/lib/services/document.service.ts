/**
 * Document Generator Service - DOCX generation using institutional templates.
 *
 * Uses docxtemplater + PizZip to load an institutional Word template,
 * replace placeholders with acta data, and produce a formatted .docx buffer.
 * Preserves original template formatting (headers, margins, tables, styles, signatures).
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { IDocumentGenerator, ActaDocxData, GeneratedDocument } from '@/types';

/** Path to the institutional template files. */
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');

/** Template mapping by committee type prefix */
const TEMPLATE_FILES: Record<string, string> = {
  'CUR': 'acta-comite-curricular-ing-industrial.docx',
  'INV': 'acta-comite-curricular-ing-industrial.docx',
  'COF': 'acta-consejo-de-facultad-ingenieria.docx',
};

const DEFAULT_TEMPLATE = 'acta-comite-curricular-ing-industrial.docx';

/**
 * All placeholder tags defined in the institutional template.
 * Used to ensure every placeholder is substituted (with empty string if unavailable).
 */
const TEMPLATE_PLACEHOLDERS = [
  'NUMERO_ACTA',
  'CIUDAD_FECHA',
  'HORA',
  'LUGAR',
  'ASISTENTES',
  'ORDEN_DIA',
  'DESARROLLO',
  'PROYECTO',
  'REVISO',
  'COPIA',
] as const;

/**
 * Formats the asistentes array as a numbered string listing.
 * Each entry is formatted as "N. nombre - cargo" on a separate line.
 *
 * @param asistentes - Array of attendees with nombre and cargo
 * @returns Formatted string listing
 */
export function formatAsistentes(asistentes: { nombre: string; cargo: string }[]): string {
  if (!asistentes || asistentes.length === 0) {
    return '';
  }

  return asistentes
    .map((a, index) => `${index + 1}. ${a.nombre} - ${a.cargo}`)
    .join('\n');
}

/**
 * Builds the template data object from ActaDocxData, ensuring all placeholders
 * have a value (empty string if not available).
 *
 * @param data - The acta document data
 * @returns Record mapping placeholder names to their replacement values
 */
export function buildTemplateData(data: ActaDocxData): Record<string, string> {
  const rawData: Record<string, string | undefined> = {
    NUMERO_ACTA: data.numeroActa,
    CIUDAD_FECHA: data.ciudadFecha,
    HORA: data.hora,
    LUGAR: data.lugar,
    ASISTENTES: formatAsistentes(data.asistentes),
    ORDEN_DIA: data.ordenDia,
    DESARROLLO: data.desarrollo,
    PROYECTO: data.proyecto,
    REVISO: data.reviso,
    COPIA: data.copia,
  };

  // Substitute empty string for any undefined/null placeholder values
  const templateData: Record<string, string> = {};
  for (const placeholder of TEMPLATE_PLACEHOLDERS) {
    templateData[placeholder] = rawData[placeholder] ?? '';
  }

  return templateData;
}

/**
 * Loads the institutional template file from disk.
 *
 * @returns Buffer containing the template file content
 * @throws Error if template file is missing or unreadable
 */
function loadTemplate(committeePrefix?: string): Buffer {
  const templateFile = (committeePrefix && TEMPLATE_FILES[committeePrefix]) || DEFAULT_TEMPLATE;
  const templatePath = path.join(TEMPLATES_DIR, templateFile);

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Template not found: ${templatePath}. Ensure the institutional template file exists in the templates/ directory.`
    );
  }

  try {
    return fs.readFileSync(templatePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown read error';
    throw new Error(`Failed to read template file: ${message}`);
  }
}

/**
 * Document Generator implementation using docxtemplater + PizZip.
 *
 * Loads the institutional .docx template, replaces all defined placeholders
 * with provided data (or empty strings for missing values), and generates
 * a Buffer output that preserves original formatting.
 */
export const documentService: IDocumentGenerator = {
  /**
   * Generates an acta DOCX document from the institutional template.
   *
   * @param data - ActaDocxData containing all field values for placeholder replacement
   * @returns GeneratedDocument with buffer, filename, and size
   * @throws Error if template is missing, corrupted, or generation fails
   */
  async generateActaDocx(data: ActaDocxData, committeePrefix?: string): Promise<GeneratedDocument> {
    // Load the template file (selects based on committee type)
    const templateBuffer = loadTemplate(committeePrefix);

    // Parse the template with PizZip
    let zip: PizZip;
    try {
      zip = new PizZip(templateBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ZIP error';
      throw new Error(`Corrupted template file: unable to parse as ZIP. ${message}`);
    }

    // Create docxtemplater instance with the parsed zip
    let doc: Docxtemplater;
    try {
      doc = new Docxtemplater(zip, {
        // Use double curly brace delimiters matching the template format: {{TAG}}
        delimiters: { start: '{{', end: '}}' },
        // Paragraph loop for line breaks in multiline content
        paragraphLoop: true,
        // Convert \n in values to line breaks in the output document
        linebreaks: true,
        // Do not throw on undefined tags - substitute empty string for missing values
        nullGetter() {
          return '';
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown docxtemplater error';
      throw new Error(`Failed to initialize document template engine: ${message}`);
    }

    // Build template data with all placeholders guaranteed to have values
    const templateData = buildTemplateData(data);

    // Replace placeholders in the template
    try {
      doc.render(templateData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown render error';
      throw new Error(`Failed to render document template: ${message}`);
    }

    // Generate output buffer
    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      // Use DEFLATE compression to maintain reasonable file size
      compression: 'DEFLATE',
    }) as Buffer;

    // Use the acta number as the filename basis
    const filename = `${data.numeroActa}.docx`;

    return {
      buffer: outputBuffer,
      filename,
      size: outputBuffer.length,
    };
  },
};
