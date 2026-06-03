/**
 * Utilidades de sanitización de entrada para el Portal Gestión de Comités.
 *
 * Incluye sanitización de nombres de archivo y sanitización general de texto
 * para prevenir ataques de inyección (XSS, SQL injection, path traversal).
 *
 * Validates: Requirements 7.9, 13.4
 */

/**
 * Sanitiza un nombre de archivo removiendo secuencias de path traversal,
 * caracteres especiales y manteniendo solo caracteres alfanuméricos,
 * guiones, guiones bajos y puntos.
 *
 * Comportamiento:
 * - Remueve secuencias de path traversal (../, ..\, ..\\)
 * - Reemplaza espacios con guiones bajos
 * - Reemplaza paréntesis y su contenido con guion bajo + contenido limpio
 * - Conserva puntos para extensiones de archivo
 * - Elimina todos los caracteres que no sean alfanuméricos, guiones, guiones bajos o puntos
 * - Colapsa múltiples guiones bajos consecutivos en uno solo
 * - Remueve puntos iniciales (para evitar archivos ocultos)
 * - Retorna 'unnamed_file' si el resultado está vacío
 *
 * @example
 * sanitizeFilename("../../etc/passwd.txt") // "etcpasswd.txt"
 * sanitizeFilename("file (1).doc") // "file_1.doc"
 * sanitizeFilename("my file<script>.pdf") // "my_filescript.pdf"
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }

  let sanitized = filename;

  // Remove path traversal sequences
  sanitized = sanitized.replace(/\.\.\//g, '');
  sanitized = sanitized.replace(/\.\.\\/g, '');
  sanitized = sanitized.replace(/\.\.\\\\/g, '');

  // Remove any directory separators
  sanitized = sanitized.replace(/[/\\]/g, '');

  // Replace spaces with underscores
  sanitized = sanitized.replace(/\s+/g, '_');

  // Remove all characters that are not alphanumeric, hyphens, underscores, or dots
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_\.]/g, '');

  // Collapse multiple consecutive underscores into one
  sanitized = sanitized.replace(/_+/g, '_');

  // Remove underscores immediately before a dot (clean up "file_.doc" → "file.doc")
  sanitized = sanitized.replace(/_\./g, '.');

  // Remove leading dots (prevent hidden files)
  sanitized = sanitized.replace(/^\.+/, '');

  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');

  // If the result is empty or only dots, return a default name
  if (!sanitized || sanitized === '.' || sanitized.replace(/\./g, '') === '') {
    return 'unnamed_file';
  }

  return sanitized;
}

/**
 * Sanitiza texto de entrada general removiendo contenido potencialmente
 * peligroso: etiquetas HTML, scripts, metacaracteres SQL y secuencias
 * de path traversal.
 *
 * Esta función está diseñada para sanitizar campos de texto libre
 * (orden del día, nombres, etc.) antes de su procesamiento.
 *
 * @example
 * sanitizeInput("<script>alert('xss')</script>Hello") // "Hello"
 * sanitizeInput("SELECT * FROM users; DROP TABLE--") // "SELECT * FROM users DROP TABLE"
 * sanitizeInput("../../etc/passwd") // "etc/passwd"
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Remove path traversal sequences
  sanitized = sanitized.replace(/\.\.[/\\]/g, '');

  // Remove HTML tags and their content for script/style tags
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove remaining HTML tags (keep inner text)
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove SQL metacharacters that could be used for injection
  // (semicolons as statement terminators, -- as comment starters, /* */ block comments)
  sanitized = sanitized.replace(/;/g, '');
  sanitized = sanitized.replace(/--/g, '');
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}
