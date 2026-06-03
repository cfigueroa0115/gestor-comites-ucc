import { describe, it, expect } from 'vitest';
import { loginSchema, type LoginInput } from './auth.schema';

describe('loginSchema', () => {
  it('acepta datos válidos', () => {
    const input: LoginInput = {
      usuario: 'admin',
      contrasena: 'Passw0rd!',
      cargo: 'Docente',
    };
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rechaza usuario con menos de 3 caracteres', () => {
    const result = loginSchema.safeParse({
      usuario: 'ab',
      contrasena: 'Passw0rd!',
      cargo: 'Docente',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza usuario con más de 50 caracteres', () => {
    const result = loginSchema.safeParse({
      usuario: 'a'.repeat(51),
      contrasena: 'Passw0rd!',
      cargo: 'Docente',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña con menos de 8 caracteres', () => {
    const result = loginSchema.safeParse({
      usuario: 'admin',
      contrasena: 'short',
      cargo: 'Docente',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña con más de 128 caracteres', () => {
    const result = loginSchema.safeParse({
      usuario: 'admin',
      contrasena: 'a'.repeat(129),
      cargo: 'Docente',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza cargo vacío', () => {
    const result = loginSchema.safeParse({
      usuario: 'admin',
      contrasena: 'Passw0rd!',
      cargo: '',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza campos faltantes', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
