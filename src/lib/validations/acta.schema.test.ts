import { describe, it, expect } from 'vitest';
import { actaFormSchema, asistenteSchema } from './acta.schema';

describe('actaFormSchema', () => {
  const validInput = {
    tipoComite: 'Curricular' as const,
    areaPrograma: 'Ingeniería Industrial' as const,
    ordenDia: 'Punto 1: Revisión de avances\nPunto 2: Aprobación de actas',
    asistentes: [
      { nombre: 'Carlos Figueroa', cargo: 'Director de Programa' },
    ],
    proyecto: 'Carlos Figueroa',
    reviso: 'María González',
  };

  it('acepta datos válidos sin copia', () => {
    const result = actaFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('acepta datos válidos con copia', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      copia: 'Decanatura, Archivo',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza tipoComite inválido', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      tipoComite: 'Inexistente',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza areaPrograma inválido', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      areaPrograma: 'Medicina',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza ordenDia vacío', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      ordenDia: '',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza ordenDia que excede 1200 caracteres', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      ordenDia: 'a'.repeat(1201),
    });
    expect(result.success).toBe(false);
  });

  it('acepta ordenDia con exactamente 1200 caracteres', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      ordenDia: 'a'.repeat(1200),
    });
    expect(result.success).toBe(true);
  });

  it('rechaza asistentes vacíos', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      asistentes: [],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza más de 50 asistentes', () => {
    const asistentes = Array.from({ length: 51 }, (_, i) => ({
      nombre: `Asistente ${i + 1}`,
      cargo: `Cargo ${i + 1}`,
    }));
    const result = actaFormSchema.safeParse({
      ...validInput,
      asistentes,
    });
    expect(result.success).toBe(false);
  });

  it('acepta exactamente 50 asistentes', () => {
    const asistentes = Array.from({ length: 50 }, (_, i) => ({
      nombre: `Asistente ${i + 1}`,
      cargo: `Cargo ${i + 1}`,
    }));
    const result = actaFormSchema.safeParse({
      ...validInput,
      asistentes,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza asistente con nombre vacío', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      asistentes: [{ nombre: '', cargo: 'Director' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza asistente con cargo vacío', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      asistentes: [{ nombre: 'Carlos', cargo: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza asistente con nombre mayor a 150 caracteres', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      asistentes: [{ nombre: 'a'.repeat(151), cargo: 'Director' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza asistente con cargo mayor a 100 caracteres', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      asistentes: [{ nombre: 'Carlos', cargo: 'a'.repeat(101) }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza proyecto vacío', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      proyecto: '',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza proyecto mayor a 150 caracteres', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      proyecto: 'a'.repeat(151),
    });
    expect(result.success).toBe(false);
  });

  it('rechaza reviso vacío', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      reviso: '',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza reviso mayor a 150 caracteres', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      reviso: 'a'.repeat(151),
    });
    expect(result.success).toBe(false);
  });

  it('rechaza copia mayor a 300 caracteres', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      copia: 'a'.repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it('acepta copia con exactamente 300 caracteres', () => {
    const result = actaFormSchema.safeParse({
      ...validInput,
      copia: 'a'.repeat(300),
    });
    expect(result.success).toBe(true);
  });

  it('acepta todos los tipos de comité válidos', () => {
    const tipos = ['Curricular', 'Investigación', 'Decanatura', 'Otro'] as const;
    for (const tipo of tipos) {
      const result = actaFormSchema.safeParse({
        ...validInput,
        tipoComite: tipo,
      });
      expect(result.success).toBe(true);
    }
  });

  it('acepta todas las áreas/programas válidos', () => {
    const areas = [
      'Ingeniería Industrial',
      'Ingeniería Electrónica',
      'Ingeniería Ambiental',
    ] as const;
    for (const area of areas) {
      const result = actaFormSchema.safeParse({
        ...validInput,
        areaPrograma: area,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('asistenteSchema', () => {
  it('acepta asistente válido', () => {
    const result = asistenteSchema.safeParse({
      nombre: 'Carlos Figueroa',
      cargo: 'Director de Programa',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre faltante', () => {
    const result = asistenteSchema.safeParse({ cargo: 'Director' });
    expect(result.success).toBe(false);
  });

  it('rechaza cargo faltante', () => {
    const result = asistenteSchema.safeParse({ nombre: 'Carlos' });
    expect(result.success).toBe(false);
  });
});
