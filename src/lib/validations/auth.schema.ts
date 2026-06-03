import { z } from 'zod';

/**
 * Schema de validación para el formulario de inicio de sesión.
 *
 * Campos:
 * - usuario: nombre de usuario (3–50 caracteres)
 * - contrasena: contraseña del usuario (8–128 caracteres)
 * - cargo: cargo seleccionado, debe ser un string no vacío
 *
 * Los mensajes de error están en español para coherencia con la UI.
 *
 * Validates: Requirements 2.1, 13.4
 */
export const loginSchema = z.object({
  usuario: z
    .string({ error: 'El usuario es obligatorio' })
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario no puede exceder 50 caracteres'),

  contrasena: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres'),

  cargo: z
    .string({ error: 'El cargo es obligatorio' })
    .min(1, 'Debe seleccionar un cargo'),
});

/** Tipo inferido del schema de login para uso en formularios y server actions. */
export type LoginInput = z.infer<typeof loginSchema>;
