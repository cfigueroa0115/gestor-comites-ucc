import { describe, it, expect } from 'vitest';
import {
  generateActaFilename,
  removeAccents,
  sanitizeProgramName,
} from './filename';

describe('removeAccents', () => {
  it('remueve tildes de vocales', () => {
    expect(removeAccents('Ingeniería')).toBe('Ingenieria');
    expect(removeAccents('Investigación')).toBe('Investigacion');
    expect(removeAccents('Electrónica')).toBe('Electronica');
  });

  it('remueve la tilde de la ñ', () => {
    expect(removeAccents('Decanatura')).toBe('Decanatura');
    expect(removeAccents('año')).toBe('ano');
  });

  it('preserva texto sin acentos', () => {
    expect(removeAccents('Industrial')).toBe('Industrial');
    expect(removeAccents('CUR')).toBe('CUR');
  });

  it('maneja cadena vacía', () => {
    expect(removeAccents('')).toBe('');
  });
});

describe('sanitizeProgramName', () => {
  it('reemplaza espacios con guiones', () => {
    expect(sanitizeProgramName('Ingenieria Industrial')).toBe('Ingenieria-Industrial');
  });

  it('remueve acentos y reemplaza espacios', () => {
    expect(sanitizeProgramName('Ingeniería Industrial')).toBe('Ingenieria-Industrial');
    expect(sanitizeProgramName('Ingeniería Electrónica')).toBe('Ingenieria-Electronica');
    expect(sanitizeProgramName('Ingeniería Ambiental')).toBe('Ingenieria-Ambiental');
  });

  it('remueve caracteres especiales', () => {
    expect(sanitizeProgramName('Programa (Test)')).toBe('Programa-Test');
    expect(sanitizeProgramName('Area/Programa')).toBe('AreaPrograma');
  });

  it('colapsa múltiples guiones consecutivos', () => {
    expect(sanitizeProgramName('Ingeniería  Industrial')).toBe('Ingenieria-Industrial');
    expect(sanitizeProgramName('Area - Programa')).toBe('Area-Programa');
  });

  it('elimina guiones iniciales y finales', () => {
    expect(sanitizeProgramName(' Industrial ')).toBe('Industrial');
    expect(sanitizeProgramName('-Test-')).toBe('Test');
  });

  it('maneja cadena vacía', () => {
    expect(sanitizeProgramName('')).toBe('');
  });
});

describe('generateActaFilename', () => {
  it('genera filename con formato correcto para Comité Curricular', () => {
    const result = generateActaFilename(
      'CUR', 2026, 1, 'Curricular', 'Ingeniería Industrial'
    );
    expect(result).toBe('ACTA-CUR-2026-0001-Comite-Curricular-Ingenieria-Industrial.docx');
  });

  it('genera filename con formato correcto para Comité de Investigación', () => {
    const result = generateActaFilename(
      'INV', 2026, 15, 'Investigación', 'Ingeniería Electrónica'
    );
    expect(result).toBe('ACTA-INV-2026-0015-Comite-Investigacion-Ingenieria-Electronica.docx');
  });

  it('genera filename con formato correcto para Comité de Decanatura', () => {
    const result = generateActaFilename(
      'DEC', 2025, 100, 'Decanatura', 'Ingeniería Ambiental'
    );
    expect(result).toBe('ACTA-DEC-2025-0100-Comite-Decanatura-Ingenieria-Ambiental.docx');
  });

  it('genera filename con formato correcto para Otro comité', () => {
    const result = generateActaFilename(
      'OTR', 2026, 9999, 'Otro', 'Ingeniería Industrial'
    );
    expect(result).toBe('ACTA-OTR-2026-9999-Comite-Otro-Ingenieria-Industrial.docx');
  });

  it('rellena con ceros la secuencia a 4 dígitos', () => {
    expect(generateActaFilename('CUR', 2026, 1, 'Curricular', 'Industrial'))
      .toContain('-0001-');
    expect(generateActaFilename('CUR', 2026, 12, 'Curricular', 'Industrial'))
      .toContain('-0012-');
    expect(generateActaFilename('CUR', 2026, 123, 'Curricular', 'Industrial'))
      .toContain('-0123-');
    expect(generateActaFilename('CUR', 2026, 1234, 'Curricular', 'Industrial'))
      .toContain('-1234-');
  });

  it('siempre termina con extensión .docx', () => {
    const result = generateActaFilename(
      'CUR', 2026, 1, 'Curricular', 'Ingeniería Industrial'
    );
    expect(result).toMatch(/\.docx$/);
  });

  it('siempre comienza con ACTA-', () => {
    const result = generateActaFilename(
      'INV', 2025, 5, 'Investigación', 'Ingeniería Electrónica'
    );
    expect(result).toMatch(/^ACTA-/);
  });

  it('incluye "Comite" como separador entre secuencia y tipo', () => {
    const result = generateActaFilename(
      'CUR', 2026, 1, 'Curricular', 'Ingeniería Industrial'
    );
    expect(result).toContain('-Comite-');
  });

  it('no contiene espacios en el filename resultante', () => {
    const result = generateActaFilename(
      'CUR', 2026, 1, 'Curricular', 'Ingeniería Industrial'
    );
    expect(result).not.toContain(' ');
  });

  it('no contiene caracteres acentuados en el filename resultante', () => {
    const result = generateActaFilename(
      'INV', 2026, 1, 'Investigación', 'Ingeniería Electrónica'
    );
    expect(result).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/);
  });
});
