import { z } from 'zod';

/**
 * Valores válidos para el tipo de comité.
 */
const tipoComiteValues = [
  'Curricular',
  'Investigación',
  'Consejo de Facultad',
] as const;

/**
 * Valores válidos para el área/programa académico.
 */
const areaProgramaValues = [
  'Ingeniería Industrial',
  'Ingeniería Electrónica',
  'Ingeniería Ambiental',
  'Facultad de Ingeniería',
] as const;

/**
 * Schema de validación para cada asistente en la tabla de asistentes.
 *
 * Campos:
 * - nombre: nombre completo del asistente (1–150 caracteres, obligatorio)
 * - cargo: cargo del asistente (1–100 caracteres, obligatorio)
 */
export const asistenteSchema = z.object({
  nombre: z
    .string({ error: 'El nombre del asistente es obligatorio' })
    .min(1, 'El nombre del asistente es obligatorio')
    .max(150, 'El nombre del asistente no puede exceder 150 caracteres'),

  cargo: z
    .string({ error: 'El cargo del asistente es obligatorio' })
    .min(1, 'El cargo del asistente es obligatorio')
    .max(100, 'El cargo del asistente no puede exceder 100 caracteres'),
});

/**
 * Schema de validación para el formulario de nueva acta.
 *
 * Campos obligatorios:
 * - tipoComite: tipo de comité (Curricular, Investigación, Decanatura, Otro)
 * - areaPrograma: área/programa académico (Ingeniería Industrial, Electrónica, Ambiental)
 * - ordenDia: orden del día (1–1200 caracteres)
 * - asistentes: lista de asistentes (1–50 entradas, cada una con nombre y cargo)
 * - proyecto: nombre de quien proyecta (1–150 caracteres)
 * - reviso: nombre de quien revisa (1–150 caracteres)
 *
 * Campo opcional:
 * - copia: destinatarios de copia (máximo 300 caracteres)
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */
export const actaFormSchema = z.object({
  tipoComite: z.enum(tipoComiteValues, {
    error: 'Debe seleccionar un tipo de comité válido',
  }),

  areaPrograma: z.enum(areaProgramaValues, {
    error: 'Debe seleccionar un área/programa válido',
  }),

  ordenDia: z
    .string({ error: 'El orden del día es obligatorio' })
    .min(1, 'El orden del día es obligatorio')
    .max(1200, 'El orden del día no puede exceder 1200 caracteres'),

  asistentes: z
    .array(asistenteSchema, {
      error: 'La lista de asistentes es obligatoria',
    })
    .min(1, 'Debe incluir al menos un asistente')
    .max(50, 'No puede incluir más de 50 asistentes'),

  proyecto: z
    .string({ error: 'El campo Proyectó es obligatorio' })
    .min(1, 'El campo Proyectó es obligatorio')
    .max(150, 'El campo Proyectó no puede exceder 150 caracteres'),

  reviso: z
    .string({ error: 'El campo Revisó es obligatorio' })
    .min(1, 'El campo Revisó es obligatorio')
    .max(150, 'El campo Revisó no puede exceder 150 caracteres'),

  copia: z
    .string()
    .max(300, 'El campo Copia no puede exceder 300 caracteres')
    .optional(),
});

/** Tipo inferido del schema del formulario de acta. */
export type ActaFormInput = z.infer<typeof actaFormSchema>;

/** Tipos de comité exportados para uso en componentes. */
export type TipoComite = (typeof tipoComiteValues)[number];

/** Áreas/programas exportados para uso en componentes. */
export type AreaPrograma = (typeof areaProgramaValues)[number];

/** Exportar valores para uso en selects/dropdowns. */
export const TIPO_COMITE_OPTIONS = tipoComiteValues;
export const AREA_PROGRAMA_OPTIONS = areaProgramaValues;
