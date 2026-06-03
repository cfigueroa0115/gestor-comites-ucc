/**
 * Text Extraction Utilities
 *
 * Provides MIME-type based routing to extract text content from different
 * document formats (PDF, DOCX, XLSX, TXT/CSV, PPTX). Media files (image,
 * audio, video) are not supported for text extraction and return empty string.
 *
 * The main `extractText` function NEVER throws — all errors are caught
 * and an empty string is returned.
 *
 * @module text-extractor
 * @see Requirements 8.1, 8.10
 */

import { EXTRACTABLE_EXTENSIONS, MEDIA_EXTENSIONS, MIME_TYPE_MAP } from '@/lib/utils/constants';

/**
 * MIME types that correspond to media files (images, audio, video).
 * Built from MEDIA_EXTENSIONS constant for consistency with the rest of the app.
 */
const MEDIA_MIME_TYPES: Set<string> = new Set(
  MEDIA_EXTENSIONS.flatMap((ext) => MIME_TYPE_MAP[ext] ?? [])
);

/**
 * MIME prefixes for media types as a fallback check.
 */
const MEDIA_MIME_PREFIXES = ['image/', 'audio/', 'video/'] as const;

/**
 * Checks whether a MIME type corresponds to a media file (image, audio, video).
 * Uses both the explicit set derived from MEDIA_EXTENSIONS and prefix matching.
 */
function isMediaMimeType(mimeType: string): boolean {
  if (MEDIA_MIME_TYPES.has(mimeType)) return true;
  return MEDIA_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

/**
 * Determines if text can be extracted from a file with the given extension.
 *
 * Returns true for extractable document types (PDF, DOCX, DOC, XLSX, XLS, TXT, CSV, PPTX).
 * Returns false for media files and unsupported types.
 *
 * @param extension - File extension including the dot (e.g., '.pdf', '.docx')
 * @returns true if text extraction is supported for this extension
 */
export function canExtractText(extension: string): boolean {
  const normalized = extension.toLowerCase().startsWith('.')
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;
  // PPTX is also extractable (best-effort via xlsx)
  return (
    (EXTRACTABLE_EXTENSIONS as readonly string[]).includes(normalized) ||
    normalized === '.pptx'
  );
}

/**
 * Extracts text content from a buffer based on its MIME type and extension.
 *
 * Routing:
 * - application/pdf → pdf-parse
 * - application/vnd.openxmlformats-officedocument.wordprocessingml.document → mammoth
 * - application/msword → mammoth (best-effort for .doc)
 * - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet → xlsx
 * - application/vnd.ms-excel → xlsx
 * - application/vnd.openxmlformats-officedocument.presentationml.presentation → xlsx (best-effort)
 * - text/plain, text/csv → buffer.toString('utf-8')
 * - image/*, audio/*, video/* → empty string (not supported)
 *
 * This function NEVER throws. All errors are caught and an empty string is returned.
 *
 * @param buffer - The file content as a Buffer
 * @param mimeType - The MIME type of the file
 * @param extension - The file extension (e.g., '.pdf', '.docx')
 * @returns The extracted text, or empty string if extraction is not supported or fails
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  extension: string
): Promise<string> {
  // Media files are not supported for text extraction
  if (isMediaMimeType(mimeType)) {
    return '';
  }

  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractFromPdf(buffer);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractFromDocx(buffer);

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return await extractFromXlsx(buffer);

      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return await extractFromPptx(buffer);

      case 'text/plain':
      case 'text/csv':
        return extractFromText(buffer);

      default:
        // Try extension-based fallback for edge cases
        return extractByExtension(buffer, extension);
    }
  } catch {
    // If extraction fails for any reason, return empty string gracefully
    return '';
  }
}

/**
 * Determines if a MIME type represents a media file that should be marked
 * as 'no_soportado' for processing status.
 *
 * @param mimeType - The MIME type to check
 * @returns true if the MIME type is a media type (image/audio/video)
 */
export function isUnsupportedMediaType(mimeType: string): boolean {
  return isMediaMimeType(mimeType);
}

// ---------------------------------------------------------------------------
// Internal extractors
// ---------------------------------------------------------------------------

/**
 * Extracts text from a PDF buffer using pdf-parse.
 */
async function extractFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const data = new Uint8Array(buffer);
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  return result.text?.trim() || '';
}

/**
 * Extracts text from a DOCX (or .doc best-effort) buffer using mammoth.
 */
async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value?.trim() || '';
}

/**
 * Extracts text from an XLSX/XLS buffer by reading all cells using the xlsx library.
 */
async function extractFromXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const texts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert sheet to array of arrays for cell-by-cell extraction
    const rows: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    for (const row of rows) {
      const rowText = row
        .map((cell) => (cell != null ? String(cell).trim() : ''))
        .filter(Boolean)
        .join('\t');
      if (rowText) {
        texts.push(rowText);
      }
    }
  }

  return texts.join('\n').trim();
}

/**
 * Attempts to extract text from a PPTX buffer using xlsx (best-effort).
 * PPTX doesn't have a great Node.js text extraction library, so we try xlsx
 * which can sometimes read embedded data, and return empty string otherwise.
 */
async function extractFromPptx(buffer: Buffer): Promise<string> {
  try {
    // xlsx can sometimes parse OOXML-related formats
    return await extractFromXlsx(buffer);
  } catch {
    // PPTX is best-effort — return empty if xlsx can't handle it
    return '';
  }
}

/**
 * Extracts text from a plain text or CSV buffer.
 */
function extractFromText(buffer: Buffer): string {
  return buffer.toString('utf-8').trim();
}

/**
 * Extension-based fallback when MIME type doesn't match known patterns.
 * Handles cases where the MIME type is generic (e.g., application/octet-stream)
 * but the extension indicates a supported format.
 */
async function extractByExtension(buffer: Buffer, extension: string): Promise<string> {
  const ext = extension.toLowerCase().startsWith('.')
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;

  switch (ext) {
    case '.pdf':
      return await extractFromPdf(buffer);
    case '.docx':
    case '.doc':
      return await extractFromDocx(buffer);
    case '.xlsx':
    case '.xls':
      return await extractFromXlsx(buffer);
    case '.pptx':
      return await extractFromPptx(buffer);
    case '.txt':
    case '.csv':
      return extractFromText(buffer);
    default:
      return '';
  }
}
