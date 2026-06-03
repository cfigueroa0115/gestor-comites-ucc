import { z } from 'zod';

/**
 * Expresión regular para validar contraseñas seguras.
 * Requiere al menos: 1 mayúscula, 1 minúscula, 1 número.
 */
const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/;

/**
 * Roles válidos del sistema.
 */
const rolValues = ['Administrador', 'Usuario_Gestor', 'Consulta'] as const;

/**
 * Schema de validación para la creación de un usuario.
 *
 * Campos obligatorios:
 * - nombreCompleto: 1–100 caracteres
 * - usuario: 3–50 caracteres, debe ser único (validado en servicio)
 * - password: mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula, 1 número
 * - cargo: 1–100 caracteres
 * - correo: formato de email válido, máximo 150 caracteres
 * - rol: uno de Administrador, Usuario_Gestor, Consulta
 *
 * Validates: Requirements 3.2, 3.4
 */
export const createUserSchema = z.object({
  nombreCompleto: z
    .string({ error: 'El nombre completo es obligatorio' })
    .min(1, 'El nombre completo es obligatorio')
    .max(100, 'El nombre completo no puede exceder 100 caracteres'),

  usuario: z
    .string({ error: 'El usuario es obligatorio' })
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario no puede exceder 50 caracteres'),

  password: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(
      passwordRegex,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    ),

  cargo: z
    .string({ error: 'El cargo es obligatorio' })
    .min(1, 'El cargo es obligatorio')
    .max(100, 'El cargo no puede exceder 100 caracteres'),

  correo: z
    .string({ error: 'El correo es obligatorio' })
    .email('El correo debe tener un formato válido')
    .max(150, 'El correo no puede exceder 150 caracteres'),

  rol: z.enum(rolValues, {
    error: 'El rol debe ser Administrador, Usuario_Gestor o Consulta',
  }),
});

/**
 * Schema de validación para la edición de un usuario existente.
 *
 * Campos editables (obligatorios):
 * - nombreCompleto: 1–100 caracteres
 * - cargo: 1–100 caracteres
 * - correo: formato de email válido, máximo 150 caracteres
 * - rol: uno de Administrador, Usuario_Gestor, Consulta
 *
 * No se permite cambiar usuario ni contraseña en edición.
 *
 * Validates: Requirements 3.4
 */
export const updateUserSchema = z.object({
  nombreCompleto: z
    .string({ error: 'El nombre completo es obligatorio' })
    .min(1, 'El nombre completo es obligatorio')
    .max(100, 'El nombre completo no puede exceder 100 caracteres'),

  cargo: z
    .string({ error: 'El cargo es obligatorio' })
    .min(1, 'El cargo es obligatorio')
    .max(100, 'El cargo no puede exceder 100 caracteres'),

  correo: z
    .string({ error: 'El correo es obligatorio' })
    .email('El correo debe tener un formato válido')
    .max(150, 'El correo no puede exceder 150 caracteres'),

  rol: z.enum(rolValues, {
    error: 'El rol debe ser Administrador, Usuario_Gestor o Consulta',
  }),
});

/**
 * Schema para cambiar el rol de un usuario.
 */
export const changeRoleSchema = z.object({
  userId: z.string().min(1, 'El ID de usuario es requerido'),
  rol: z.enum(rolValues, {
    error: 'El rol debe ser Administrador, Usuario_Gestor o Consulta',
  }),
});

/**
 * Schema para activar/desactivar un usuario.
 */
export const toggleActiveSchema = z.object({
  userId: z.string().min(1, 'El ID de usuario es requerido'),
});

/**
 * Schema para parámetros de listado (paginación).
 */
export const listUsersSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

/** Tipo inferido del schema de creación de usuario. */
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Tipo inferido del schema de edición de usuario. */
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Tipo inferido del schema de cambio de rol. */
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

/** Tipo inferido del schema de toggle de estado activo. */
export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>;

/** Tipo inferido del schema de paginación de listado. */
export type ListUsersInput = z.infer<typeof listUsersSchema>;
