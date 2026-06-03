import { describe, it, expect } from 'vitest';
import {
  getFileExtension,
  isAllowedExtension,
  mimeMatchesExtension,
  validateFile,
} from './file.schema';

describe('getFileExtension', () => {
  it('extrae extensión en minúsculas', () => {
    expect(getFileExtension('document.PDF')).toBe('.pdf');
    expect(getFileExtension('file.DocX')).toBe('.docx');
  });

  it('extrae la última extensión para extensiones múltiples', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('.gz');
  });

  it('retorna cadena vacía si no hay extensión', () => {
    expect(getFileExtension('noextension')).toBe('');
  });

  it('retorna cadena vacía si el punto es el último carácter', () => {
    expect(getFileExtension('file.')).toBe('');
  });
});

describe('isAllowedExtension', () => {
  it('acepta extensiones permitidas', () => {
    expect(isAllowedExtension('.pdf')).toBe(true);
    expect(isAllowedExtension('.docx')).toBe(true);
    expect(isAllowedExtension('.png')).toBe(true);
    expect(isAllowedExtension('.csv')).toBe(true);
  });

  it('rechaza extensiones no permitidas', () => {
    expect(isAllowedExtension('.exe')).toBe(false);
    expect(isAllowedExtension('.bat')).toBe(false);
    expect(isAllowedExtension('.sh')).toBe(false);
    expect(isAllowedExtension('.js')).toBe(false);
  });
});

describe('mimeMatchesExtension', () => {
  it('valida MIME correcto para extensión', () => {
    expect(mimeMatchesExtension('application/pdf', '.pdf')).toBe(true);
    expect(mimeMatchesExtension('image/png', '.png')).toBe(true);
    expect(mimeMatchesExtension('image/jpeg', '.jpg')).toBe(true);
    expect(mimeMatchesExtension('text/plain', '.txt')).toBe(true);
  });

  it('acepta tipos MIME alternativos válidos', () => {
    expect(mimeMatchesExtension('audio/mpeg', '.mp3')).toBe(true);
    expect(mimeMatchesExtension('audio/mp3', '.mp3')).toBe(true);
    expect(mimeMatchesExtension('text/csv', '.csv')).toBe(true);
    expect(mimeMatchesExtension('application/csv', '.csv')).toBe(true);
  });

  it('rechaza MIME incorrecto para extensión', () => {
    expect(mimeMatchesExtension('application/pdf', '.docx')).toBe(false);
    expect(mimeMatchesExtension('image/png', '.pdf')).toBe(false);
    expect(mimeMatchesExtension('text/html', '.txt')).toBe(false);
  });

  it('rechaza extensiones no permitidas', () => {
    expect(mimeMatchesExtension('application/x-executable', '.exe')).toBe(false);
  });

  it('maneja MIME con parámetros (charset)', () => {
    expect(mimeMatchesExtension('text/plain; charset=utf-8', '.txt')).toBe(true);
  });

  it('normaliza MIME a minúsculas', () => {
    expect(mimeMatchesExtension('Application/PDF', '.pdf')).toBe(true);
  });
});

describe('validateFile', () => {
  it('acepta archivo válido', () => {
    const result = validateFile(
      { name: 'report.pdf', size: 1024, type: 'application/pdf' },
      10
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rechaza archivo sin extensión', () => {
    const result = validateFile(
      { name: 'noext', size: 1024, type: 'application/octet-stream' },
      10
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('noext');
    expect(result.error).toContain('extensión');
  });

  it('rechaza extensión no permitida', () => {
    const result = validateFile(
      { name: 'virus.exe', size: 1024, type: 'application/x-executable' },
      10
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('virus.exe');
    expect(result.error).toContain('.exe');
    expect(result.error).toContain('no está permitida');
  });

  it('rechaza archivo con MIME incompatible con extensión', () => {
    const result = validateFile(
      { name: 'doc.pdf', size: 1024, type: 'image/png' },
      10
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('doc.pdf');
    expect(result.error).toContain('tipo de contenido');
    expect(result.error).toContain('image/png');
  });

  it('rechaza archivo que excede tamaño máximo', () => {
    const maxMB = 5;
    const oversizeBytes = maxMB * 1024 * 1024 + 1;
    const result = validateFile(
      { name: 'large.pdf', size: oversizeBytes, type: 'application/pdf' },
      maxMB
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('large.pdf');
    expect(result.error).toContain(`${maxMB} MB`);
  });

  it('acepta archivo exactamente en el límite de tamaño', () => {
    const maxMB = 10;
    const exactSize = maxMB * 1024 * 1024;
    const result = validateFile(
      { name: 'exact.pdf', size: exactSize, type: 'application/pdf' },
      maxMB
    );
    expect(result.valid).toBe(true);
  });

  it('usa DEFAULT_MAX_FILE_SIZE_MB cuando no se especifica maxSizeMB', () => {
    // DEFAULT_MAX_FILE_SIZE_MB = 10 (from constants)
    const oversizeBytes = 11 * 1024 * 1024;
    const result = validateFile({
      name: 'big.pdf',
      size: oversizeBytes,
      type: 'application/pdf',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10 MB');
  });

  it('valida todos los tipos de archivos permitidos', () => {
    const testCases = [
      { name: 'file.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'file.doc', type: 'application/msword' },
      { name: 'file.pdf', type: 'application/pdf' },
      { name: 'file.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'file.xls', type: 'application/vnd.ms-excel' },
      { name: 'file.png', type: 'image/png' },
      { name: 'file.jpg', type: 'image/jpeg' },
      { name: 'file.jpeg', type: 'image/jpeg' },
      { name: 'file.gif', type: 'image/gif' },
      { name: 'file.mp3', type: 'audio/mpeg' },
      { name: 'file.mp4', type: 'video/mp4' },
      { name: 'file.wav', type: 'audio/wav' },
      { name: 'file.avi', type: 'video/x-msvideo' },
      { name: 'file.txt', type: 'text/plain' },
      { name: 'file.csv', type: 'text/csv' },
      { name: 'file.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    ];

    for (const { name, type } of testCases) {
      const result = validateFile({ name, size: 1024, type }, 10);
      expect(result.valid, `Expected ${name} with type ${type} to be valid`).toBe(true);
    }
  });

  it('incluye nombre del archivo en todos los mensajes de error', () => {
    const filename = 'test-file.bad';
    const result = validateFile(
      { name: filename, size: 1024, type: 'application/octet-stream' },
      10
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain(filename);
  });
});
