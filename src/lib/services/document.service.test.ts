/**
 * Unit tests for Document Generator Service.
 *
 * Tests helper functions (formatAsistentes, buildTemplateData) and
 * validates error handling for missing templates.
 */

import { describe, it, expect } from 'vitest';
import { formatAsistentes, buildTemplateData } from './document.service';
import type { ActaDocxData } from '@/types';

describe('Document Service', () => {
  describe('formatAsistentes', () => {
    it('formats attendees as numbered list with name - cargo per line', () => {
      const asistentes = [
        { nombre: 'Juan Pérez', cargo: 'Director' },
        { nombre: 'María García', cargo: 'Coordinadora' },
        { nombre: 'Carlos López', cargo: 'Profesor' },
      ];

      const result = formatAsistentes(asistentes);

      expect(result).toBe(
        '1. Juan Pérez - Director\n2. María García - Coordinadora\n3. Carlos López - Profesor'
      );
    });

    it('returns empty string for empty array', () => {
      expect(formatAsistentes([])).toBe('');
    });

    it('returns empty string for null/undefined input', () => {
      expect(formatAsistentes(null as unknown as { nombre: string; cargo: string }[])).toBe('');
      expect(formatAsistentes(undefined as unknown as { nombre: string; cargo: string }[])).toBe('');
    });

    it('handles single attendee', () => {
      const asistentes = [{ nombre: 'Ana Torres', cargo: 'Secretaria' }];
      const result = formatAsistentes(asistentes);
      expect(result).toBe('1. Ana Torres - Secretaria');
    });
  });

  describe('buildTemplateData', () => {
    const baseData: ActaDocxData = {
      numeroActa: 'ACTA-CUR-2026-0001',
      ciudadFecha: 'Bogotá D.C., 15 de enero de 2026',
      hora: '10:00 a.m.',
      lugar: 'Sala de Juntas',
      asistentes: [
        { nombre: 'Juan Pérez', cargo: 'Director' },
      ],
      ordenDia: '1. Verificación del quórum\n2. Aprobación del acta anterior',
      desarrollo: 'Se verificó el quórum con la asistencia de los miembros.',
      proyecto: 'Carlos Figueroa',
      reviso: 'María García',
      copia: 'Archivo central',
    };

    it('maps all ActaDocxData fields to template placeholders', () => {
      const result = buildTemplateData(baseData);

      expect(result.NUMERO_ACTA).toBe('ACTA-CUR-2026-0001');
      expect(result.CIUDAD_FECHA).toBe('Bogotá D.C., 15 de enero de 2026');
      expect(result.HORA).toBe('10:00 a.m.');
      expect(result.LUGAR).toBe('Sala de Juntas');
      expect(result.ASISTENTES).toBe('1. Juan Pérez - Director');
      expect(result.ORDEN_DIA).toBe('1. Verificación del quórum\n2. Aprobación del acta anterior');
      expect(result.DESARROLLO).toBe('Se verificó el quórum con la asistencia de los miembros.');
      expect(result.PROYECTO).toBe('Carlos Figueroa');
      expect(result.REVISO).toBe('María García');
      expect(result.COPIA).toBe('Archivo central');
    });

    it('substitutes empty string for undefined copia', () => {
      const dataWithoutCopia: ActaDocxData = { ...baseData, copia: undefined };
      const result = buildTemplateData(dataWithoutCopia);

      expect(result.COPIA).toBe('');
    });

    it('substitutes empty string for empty attendees array', () => {
      const dataWithNoAttendees: ActaDocxData = { ...baseData, asistentes: [] };
      const result = buildTemplateData(dataWithNoAttendees);

      expect(result.ASISTENTES).toBe('');
    });

    it('all template placeholders have a defined value (never undefined)', () => {
      const result = buildTemplateData(baseData);

      const expectedKeys = [
        'NUMERO_ACTA', 'CIUDAD_FECHA', 'HORA', 'LUGAR',
        'ASISTENTES', 'ORDEN_DIA', 'DESARROLLO', 'PROYECTO', 'REVISO', 'COPIA',
      ];

      for (const key of expectedKeys) {
        expect(result[key]).toBeDefined();
        expect(typeof result[key]).toBe('string');
      }
    });
  });

  describe('documentService.generateActaDocx', () => {
    it('generates a valid docx document when template exists', async () => {
      const { documentService } = await import('./document.service');

      const data: ActaDocxData = {
        numeroActa: 'ACTA-CUR-2026-0001',
        ciudadFecha: 'Bogotá D.C., 15 de enero de 2026',
        hora: '10:00 a.m.',
        lugar: 'Sala de Juntas',
        asistentes: [{ nombre: 'Test User', cargo: 'Director' }],
        ordenDia: '1. Punto uno',
        desarrollo: 'Desarrollo del punto.',
        proyecto: 'Proyectó Name',
        reviso: 'Revisó Name',
        copia: 'Copia info',
      };

      const result = await documentService.generateActaDocx(data);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.filename).toBe('ACTA-CUR-2026-0001.docx');
      expect(result.size).toBe(result.buffer.length);
    });

    it('generates document with empty string for undefined optional fields', async () => {
      const { documentService } = await import('./document.service');

      const data: ActaDocxData = {
        numeroActa: 'ACTA-INV-2026-0002',
        ciudadFecha: 'Bogotá D.C., 20 de marzo de 2026',
        hora: '14:00',
        lugar: 'Sala Virtual',
        asistentes: [],
        ordenDia: '1. Único punto',
        desarrollo: 'Desarrollo breve.',
        proyecto: 'Carlos Figueroa',
        reviso: 'María García',
        // copia is intentionally omitted
      };

      const result = await documentService.generateActaDocx(data);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.size).toBeGreaterThan(0);
      expect(result.filename).toBe('ACTA-INV-2026-0002.docx');
    });

    it('replaces all placeholders - no raw {{PLACEHOLDER}} tags remain in output', async () => {
      const PizZipModule = await import('pizzip');
      const { documentService } = await import('./document.service');

      const data: ActaDocxData = {
        numeroActa: 'ACTA-CUR-2026-0010',
        ciudadFecha: 'Medellín, 5 de abril de 2026',
        hora: '08:00 a.m.',
        lugar: 'Auditorio B',
        asistentes: [
          { nombre: 'Ana Torres', cargo: 'Investigadora' },
          { nombre: 'Luis Ramírez', cargo: 'Profesor' },
        ],
        ordenDia: '1. Revisión\n2. Aprobación',
        desarrollo: 'Se aprobaron todos los puntos.',
        proyecto: 'Pedro Ruiz',
        reviso: 'Laura Sánchez',
        copia: 'Decanatura',
      };

      const result = await documentService.generateActaDocx(data);
      const zip = new PizZipModule.default(result.buffer);
      const docXml = zip.file('word/document.xml')?.asText() || '';

      // No raw placeholder tags should remain
      expect(docXml).not.toContain('{{NUMERO_ACTA}}');
      expect(docXml).not.toContain('{{CIUDAD_FECHA}}');
      expect(docXml).not.toContain('{{HORA}}');
      expect(docXml).not.toContain('{{LUGAR}}');
      expect(docXml).not.toContain('{{ASISTENTES}}');
      expect(docXml).not.toContain('{{ORDEN_DIA}}');
      expect(docXml).not.toContain('{{DESARROLLO}}');
      expect(docXml).not.toContain('{{PROYECTO}}');
      expect(docXml).not.toContain('{{REVISO}}');
      expect(docXml).not.toContain('{{COPIA}}');

      // Verify actual values are present in document content
      expect(docXml).toContain('ACTA-CUR-2026-0010');
      expect(docXml).toContain('08:00 a.m.');
      expect(docXml).toContain('Auditorio B');
      expect(docXml).toContain('Pedro Ruiz');
      expect(docXml).toContain('Decanatura');
    });
  });
});
