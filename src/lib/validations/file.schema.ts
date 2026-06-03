/**
 * Schema de validación de archivos para el Portal Gestión de Comités.
 *
 * Proporciona validación de extensiones, tipos MIME, tamaño de archivo,
 * y detección de incompatibilidad entre tipo de contenido y extensión.
 *
 * Validates: Requirements 7.2, 7.3, 7.8, 13.6
 */

import {
  ALLOWED_EXTENSIONS,
  MIME_TYPE_MAP,
  DEFAULT_MAX_FILE_SIZE_MB,
  type AllowedExtension,
} from '@/lib/utils/constants';

/**
 * Resultado de la validación de un archivo.
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Entrada mínima requerida para validar un archivo.
 */
export interface FileInput {
  name: string;
  size: number;
  type: string;
}

/**
 * Extrae la extensión de un nombre de archivo (con punto, en minúsculas).
 *
 * @example
 * getFileExtension("document.PDF") // ".pdf"
 * getFileExtension("archive.tar.gz") // ".gz"
 * getFileExtension("noext") // ""
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Verifica si una extensión de archivo está en la lista permitida.
 */
export function isAllowedExtension(extension: string): extension is AllowedExtension {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Verifica si el tipo MIME declarado corresponde a la extensión del archivo.
 *
 * @returns true si el MIME coincide con la extensión, false en caso contrario
 */
export function mimeMatchesExtension(mimeType: string, extension: string): boolean {
  if (!isAllowedExtension(extension)) {
    return false;
  }

  const allowedMimes = MIME_TYPE_MAP[extension];
  if (!allowedMimes || allowedMimes.length === 0) {
    return false;
  }

  // Normalize MIME type (lowercase, strip parameters like charset)
  const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();

  return allowedMimes.includes(normalizedMime);
}

/**
 * Valida un archivo verificando: extensión permitida, correspondencia MIME,
 * y tamaño dentro del límite.
 *
 * @param file - Objeto con nombre, tamaño y tipo MIME del archivo
 * @param maxSizeMB - Tamaño máximo en megabytes (usa DEFAULT_MAX_FILE_SIZE_MB si no se especifica)
 * @returns Resultado de validación con indicador de éxito y mensaje de error específico
 *
 * @example
 * validateFile({ name: "doc.pdf", size: 1024, type: "application/pdf" }, 10)
 * // { valid: true }
 *
 * validateFile({ name: "virus.exe", size: 1024, type: "application/octet-stream" }, 10)
 * // { valid: false, error: "virus.exe: la extensión .exe no está permitida..." }
 */
export function validateFile(
  file: FileInput,
  maxSizeMB: number = DEFAULT_MAX_FILE_SIZE_MB
): FileValidationResult {
  const { name, size, type } = file;

  // 1. Check file extension is in the allowlist
  const extension = getFileExtension(name);
  if (!extension) {
    return {
      valid: false,
      error: `${name}: el archivo no tiene extensión válida. Extensiones permitidas: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (!isAllowedExtension(extension)) {
    return {
      valid: false,
      error: `${name}: la extensión ${extension} no está permitida. Extensiones permitidas: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // 2. Verify MIME type matches the declared extension
  if (type && !mimeMatchesExtension(type, extension)) {
    return {
      valid: false,
      error: `${name}: el tipo de contenido (${type}) no corresponde a la extensión ${extension}`,
    };
  }

  // 3. Check file size against limit
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `${name}: el archivo excede el tamaño máximo permitido de ${maxSizeMB} MB`,
    };
  }

  return { valid: true };
}
