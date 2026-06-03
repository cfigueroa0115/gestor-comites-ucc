/**
 * Output filename generation for acta documents.
 *
 * Generates filenames following the institutional naming convention:
 * ACTA-{PREFIX}-{YEAR}-{SEQ}-Comite-{TYPE}-{PROGRAM}.docx
 *
 * Requirements: 9.4
 */

/**
 * Removes accents/diacritics from a string by decomposing unicode
 * characters and stripping combining marks.
 *
 * @param str - Input string with possible accents
 * @returns String with accents removed
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Sanitizes a program name for safe use in filenames.
 * - Removes accents/diacritics (e.g., "í" → "i", "ñ" → "n")
 * - Replaces spaces with hyphens
 * - Removes any character that is not alphanumeric or hyphen
 * - Collapses multiple consecutive hyphens into one
 * - Trims leading/trailing hyphens
 *
 * @param programName - The raw program name (e.g., "Ingeniería Industrial")
 * @returns Filename-safe string (e.g., "Ingenieria-Industrial")
 */
export function sanitizeProgramName(programName: string): string {
  let sanitized = removeAccents(programName);
  sanitized = sanitized.replace(/\s+/g, '-');
  sanitized = sanitized.replace(/[^a-zA-Z0-9-]/g, '');
  sanitized = sanitized.replace(/-{2,}/g, '-');
  sanitized = sanitized.replace(/^-+|-+$/g, '');
  return sanitized;
}

/**
 * Generates the output filename for an acta document following the
 * institutional convention.
 *
 * Format: ACTA-{PREFIX}-{YEAR}-{SEQ}-Comite-{TYPE}-{PROGRAM}.docx
 *
 * @param prefix - Committee code prefix (CUR, INV, DEC, OTR)
 * @param year - Four-digit calendar year
 * @param sequence - Sequential number (1-9999), zero-padded to 4 digits
 * @param tipoComite - Committee type name (e.g., "Curricular", "Investigación")
 * @param areaPrograma - Program/area name (e.g., "Ingeniería Industrial")
 * @returns Generated filename string
 *
 * @example
 * generateActaFilename('CUR', 2026, 1, 'Curricular', 'Ingeniería Industrial')
 * // => "ACTA-CUR-2026-0001-Comite-Curricular-Ingenieria-Industrial.docx"
 */
export function generateActaFilename(
  prefix: string,
  year: number,
  sequence: number,
  tipoComite: string,
  areaPrograma: string
): string {
  const seq = String(sequence).padStart(4, '0');
  const sanitizedType = sanitizeProgramName(tipoComite);
  const sanitizedProgram = sanitizeProgramName(areaPrograma);

  return `ACTA-${prefix}-${year}-${seq}-Comite-${sanitizedType}-${sanitizedProgram}.docx`;
}
