import { describe, it, expect } from 'vitest';
import { FallbackProvider } from './fallback.provider';
import type { ActaGenerationInput } from './provider.interface';

describe('FallbackProvider', () => {
  const provider = new FallbackProvider();

  describe('isAvailable', () => {
    it('always returns true', async () => {
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });
  });

  describe('extractTextFromDocument', () => {
    it('always returns empty string', async () => {
      const buffer = Buffer.from('some content');
      const result = await provider.extractTextFromDocument(buffer, 'application/pdf');
      expect(result).toBe('');
    });
  });

  describe('generateActaContent', () => {
    const baseInput: ActaGenerationInput = {
      ordenDia: 'Aprobación del acta anterior\nRevision de avances académicos\nProposiciones y varios',
      asistentes: [
        { nombre: 'Carlos Figueroa', cargo: 'Director de Programa' },
        { nombre: 'María López', cargo: 'Docente' },
      ],
      attachmentTexts: [],
      tipoComite: 'Curricular',
      areaPrograma: 'Ingeniería Industrial',
    };

    it('always returns success with provider "fallback"', async () => {
      const result = await provider.generateActaContent(baseInput);
      expect(result.success).toBe(true);
      expect(result.provider).toBe('fallback');
      expect(result.error).toBeUndefined();
    });

    it('includes header with committee type and program', async () => {
      const result = await provider.generateActaContent(baseInput);
      expect(result.desarrollo).toContain('DESARROLLO DE LA SESIÓN');
      expect(result.desarrollo).toContain('Comité Curricular');
      expect(result.desarrollo).toContain('Ingeniería Industrial');
    });

    it('generates one section per agenda point with neutral template language', async () => {
      const result = await provider.generateActaContent(baseInput);
      expect(result.desarrollo).toContain('Se revisó el punto 1 del orden del día.');
      expect(result.desarrollo).toContain('Se revisó el punto 2 del orden del día.');
      expect(result.desarrollo).toContain('Se revisó el punto 3 del orden del día.');
    });

    it('includes agenda point text as section title', async () => {
      const result = await provider.generateActaContent(baseInput);
      expect(result.desarrollo).toContain('Aprobación del acta anterior');
      expect(result.desarrollo).toContain('Revision de avances académicos');
      expect(result.desarrollo).toContain('Proposiciones y varios');
    });

    it('includes note about supporting documents when attachments have text', async () => {
      const inputWithAttachments: ActaGenerationInput = {
        ...baseInput,
        attachmentTexts: ['Contenido del documento adjunto.'],
      };
      const result = await provider.generateActaContent(inputWithAttachments);
      expect(result.desarrollo).toContain('Se presentaron los documentos de soporte correspondientes.');
    });

    it('does not include supporting docs note when no attachment text', async () => {
      const result = await provider.generateActaContent(baseInput);
      expect(result.desarrollo).not.toContain('Se presentaron los documentos de soporte correspondientes.');
    });

    it('does not include supporting docs note when attachment texts are empty strings', async () => {
      const inputEmptyAttachments: ActaGenerationInput = {
        ...baseInput,
        attachmentTexts: ['', '   '],
      };
      const result = await provider.generateActaContent(inputEmptyAttachments);
      expect(result.desarrollo).not.toContain('Se presentaron los documentos de soporte correspondientes.');
    });

    it('includes closing section noting the session ended', async () => {
      const result = await provider.generateActaContent(baseInput);
      expect(result.desarrollo).toContain('No habiendo más asuntos que tratar, se dio por terminada la sesión.');
    });

    it('includes formatted attendee list', async () => {
      const result = await provider.generateActaContent(baseInput);
      expect(result.desarrollo).toContain('Asistentes a la sesión:');
      expect(result.desarrollo).toContain('1. Carlos Figueroa – Director de Programa');
      expect(result.desarrollo).toContain('2. María López – Docente');
    });

    it('handles empty orden del dia gracefully', async () => {
      const emptyInput: ActaGenerationInput = {
        ...baseInput,
        ordenDia: '',
      };
      const result = await provider.generateActaContent(emptyInput);
      expect(result.success).toBe(true);
      expect(result.desarrollo).toContain('No se registraron puntos en el orden del día para esta sesión.');
    });

    it('handles different committee types', async () => {
      const investigacionInput: ActaGenerationInput = {
        ...baseInput,
        tipoComite: 'Investigación',
        areaPrograma: 'Ingeniería Electrónica',
      };
      const result = await provider.generateActaContent(investigacionInput);
      expect(result.desarrollo).toContain('Comité de Investigación');
      expect(result.desarrollo).toContain('Ingeniería Electrónica');
    });

    it('handles Decanatura committee type', async () => {
      const decanaturaInput: ActaGenerationInput = {
        ...baseInput,
        tipoComite: 'Decanatura',
      };
      const result = await provider.generateActaContent(decanaturaInput);
      expect(result.desarrollo).toContain('Comité de Decanatura');
    });

    it('handles Otro committee type', async () => {
      const otroInput: ActaGenerationInput = {
        ...baseInput,
        tipoComite: 'Otro',
      };
      const result = await provider.generateActaContent(otroInput);
      expect(result.desarrollo).toContain('Comité');
    });

    it('handles empty attendees list', async () => {
      const noAttendeesInput: ActaGenerationInput = {
        ...baseInput,
        asistentes: [],
      };
      const result = await provider.generateActaContent(noAttendeesInput);
      expect(result.success).toBe(true);
      expect(result.desarrollo).not.toContain('Asistentes a la sesión:');
      expect(result.desarrollo).toContain('No habiendo más asuntos que tratar, se dio por terminada la sesión.');
    });

    it('handles single agenda point', async () => {
      const singlePointInput: ActaGenerationInput = {
        ...baseInput,
        ordenDia: 'Único punto a tratar',
      };
      const result = await provider.generateActaContent(singlePointInput);
      expect(result.desarrollo).toContain('1. Único punto a tratar');
      expect(result.desarrollo).toContain('Se revisó el punto 1 del orden del día.');
    });

    it('filters empty lines from orden del dia', async () => {
      const multilineInput: ActaGenerationInput = {
        ...baseInput,
        ordenDia: 'Punto uno\n\n\nPunto dos\n\n',
      };
      const result = await provider.generateActaContent(multilineInput);
      expect(result.desarrollo).toContain('Se revisó el punto 1 del orden del día.');
      expect(result.desarrollo).toContain('Se revisó el punto 2 del orden del día.');
      // Should not have a point 3 (empty lines filtered)
      expect(result.desarrollo).not.toContain('Se revisó el punto 3 del orden del día.');
    });
  });
});
