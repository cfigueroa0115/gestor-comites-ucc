import { describe, it, expect } from 'vitest';
import { sanitizeFilename, sanitizeInput } from './sanitize';

describe('sanitizeFilename', () => {
  it('remueve secuencias de path traversal (../)', () => {
    expect(sanitizeFilename('../../etc/passwd.txt')).toBe('etcpasswd.txt');
  });

  it('remueve secuencias de path traversal (..\\)', () => {
    expect(sanitizeFilename('..\\..\\windows\\system32.dll')).toBe('windowssystem32.dll');
  });

  it('reemplaza espacios con guiones bajos y limpia paréntesis', () => {
    expect(sanitizeFilename('file (1).doc')).toBe('file_1.doc');
  });

  it('conserva extensiones de archivo con puntos', () => {
    expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
    expect(sanitizeFilename('archive.tar.gz')).toBe('archive.tar.gz');
  });

  it('remueve caracteres especiales manteniendo alfanuméricos', () => {
    expect(sanitizeFilename('my<file>name.txt')).toBe('myfilename.txt');
    expect(sanitizeFilename('report@2024#final.xlsx')).toBe('report2024final.xlsx');
  });

  it('permite guiones y guiones bajos', () => {
    expect(sanitizeFilename('my-report_2024.pdf')).toBe('my-report_2024.pdf');
  });

  it('colapsa múltiples guiones bajos consecutivos', () => {
    expect(sanitizeFilename('file___name.doc')).toBe('file_name.doc');
  });

  it('remueve puntos iniciales (archivos ocultos)', () => {
    expect(sanitizeFilename('.hidden_file.txt')).toBe('hidden_file.txt');
    expect(sanitizeFilename('...file.pdf')).toBe('file.pdf');
  });

  it('retorna "unnamed_file" para entrada vacía', () => {
    expect(sanitizeFilename('')).toBe('unnamed_file');
  });

  it('retorna "unnamed_file" para entrada null/undefined', () => {
    expect(sanitizeFilename(null as unknown as string)).toBe('unnamed_file');
    expect(sanitizeFilename(undefined as unknown as string)).toBe('unnamed_file');
  });

  it('retorna "unnamed_file" cuando solo quedan puntos', () => {
    expect(sanitizeFilename('...')).toBe('unnamed_file');
  });

  it('maneja nombres con solo caracteres especiales', () => {
    expect(sanitizeFilename('$%^&*')).toBe('unnamed_file');
  });

  it('remueve separadores de directorio', () => {
    expect(sanitizeFilename('path/to/file.txt')).toBe('pathtofile.txt');
    expect(sanitizeFilename('C:\\Users\\doc.pdf')).toBe('CUsersdoc.pdf');
  });

  it('maneja nombres unicode removiendo caracteres no-ASCII', () => {
    expect(sanitizeFilename('documento_ñ_año.pdf')).toBe('documento_ao.pdf');
  });

  it('remueve contenido de scripts en nombres de archivo', () => {
    expect(sanitizeFilename('<script>alert(1)</script>.txt')).toBe('scriptalert1script.txt');
  });

  it('maneja nombres largos sin truncar', () => {
    const longName = 'a'.repeat(200) + '.pdf';
    const result = sanitizeFilename(longName);
    expect(result).toBe('a'.repeat(200) + '.pdf');
  });
});

describe('sanitizeInput', () => {
  it('remueve etiquetas script completas con contenido', () => {
    expect(sanitizeInput("<script>alert('xss')</script>Hello")).toBe('Hello');
  });

  it('remueve etiquetas style con contenido', () => {
    expect(sanitizeInput('<style>body{display:none}</style>Visible')).toBe('Visible');
  });

  it('remueve etiquetas HTML manteniendo texto interno', () => {
    expect(sanitizeInput('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
  });

  it('remueve secuencias de path traversal', () => {
    expect(sanitizeInput('../../etc/passwd')).toBe('etc/passwd');
    expect(sanitizeInput('..\\windows\\system32')).toBe('windows\\system32');
  });

  it('remueve metacaracteres SQL (punto y coma)', () => {
    expect(sanitizeInput("SELECT * FROM users; DROP TABLE users")).toBe(
      'SELECT * FROM users DROP TABLE users'
    );
  });

  it('remueve comentarios SQL (--)', () => {
    expect(sanitizeInput('admin-- comment')).toBe('admin comment');
  });

  it('remueve comentarios de bloque SQL (/* */)', () => {
    expect(sanitizeInput('value /* malicious */ end')).toBe('value  end');
  });

  it('remueve bytes nulos', () => {
    expect(sanitizeInput('hello\0world')).toBe('helloworld');
  });

  it('retorna cadena vacía para entrada vacía', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('retorna cadena vacía para null/undefined', () => {
    expect(sanitizeInput(null as unknown as string)).toBe('');
    expect(sanitizeInput(undefined as unknown as string)).toBe('');
  });

  it('preserva texto normal sin modificaciones', () => {
    expect(sanitizeInput('Orden del día: Reunión de comité')).toBe(
      'Orden del día: Reunión de comité'
    );
  });

  it('recorta espacios al inicio y final', () => {
    expect(sanitizeInput('  hello world  ')).toBe('hello world');
  });

  it('maneja múltiples amenazas combinadas', () => {
    const malicious = "<script>alert(1)</script>; DROP TABLE--../../secret";
    const result = sanitizeInput(malicious);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain(';');
    expect(result).not.toContain('--');
    expect(result).not.toContain('../');
  });
});
