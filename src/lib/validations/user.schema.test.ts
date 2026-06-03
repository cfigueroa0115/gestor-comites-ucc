import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema } from './user.schema';

describe('createUserSchema', () => {
  const validInput = {
    nombreCompleto: 'Carlos Figueroa',
    usuario: 'cfigueroa',
    password: 'Segura1234',
    cargo: 'Docente',
    correo: 'carlos@ucc.edu.co',
    rol: 'Administrador' as const,
  };

  it('acepta datos válidos', () => {
    const result = createUserSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rechaza nombreCompleto vacío', () => {
    const result = createUserSchema.safeParse({ ...validInput, nombreCompleto: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza nombreCompleto mayor a 100 caracteres', () => {
    const result = createUserSchema.safeParse({ ...validInput, nombreCompleto: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rechaza usuario menor a 3 caracteres', () => {
    const result = createUserSchema.safeParse({ ...validInput, usuario: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rechaza usuario mayor a 50 caracteres', () => {
    const result = createUserSchema.safeParse({ ...validInput, usuario: 'a'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña menor a 8 caracteres', () => {
    const result = createUserSchema.safeParse({ ...validInput, password: 'Abc1' });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña sin mayúscula', () => {
    const result = createUserSchema.safeParse({ ...validInput, password: 'segura1234' });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña sin minúscula', () => {
    const result = createUserSchema.safeParse({ ...validInput, password: 'SEGURA1234' });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña sin número', () => {
    const result = createUserSchema.safeParse({ ...validInput, password: 'SeguraABCD' });
    expect(result.success).toBe(false);
  });

  it('rechaza cargo vacío', () => {
    const result = createUserSchema.safeParse({ ...validInput, cargo: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza cargo mayor a 100 caracteres', () => {
    const result = createUserSchema.safeParse({ ...validInput, cargo: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rechaza correo con formato inválido', () => {
    const result = createUserSchema.safeParse({ ...validInput, correo: 'no-es-email' });
    expect(result.success).toBe(false);
  });

  it('rechaza correo mayor a 150 caracteres', () => {
    const longEmail = 'a'.repeat(140) + '@ucc.edu.co';
    const result = createUserSchema.safeParse({ ...validInput, correo: longEmail });
    expect(result.success).toBe(false);
  });

  it('rechaza rol inválido', () => {
    const result = createUserSchema.safeParse({ ...validInput, rol: 'SuperAdmin' });
    expect(result.success).toBe(false);
  });

  it('acepta todos los roles válidos', () => {
    for (const rol of ['Administrador', 'Usuario_Gestor', 'Consulta'] as const) {
      const result = createUserSchema.safeParse({ ...validInput, rol });
      expect(result.success).toBe(true);
    }
  });
});

describe('updateUserSchema', () => {
  const validInput = {
    nombreCompleto: 'Carlos Figueroa',
    cargo: 'Docente',
    correo: 'carlos@ucc.edu.co',
    rol: 'Usuario_Gestor' as const,
  };

  it('acepta datos válidos', () => {
    const result = updateUserSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('no incluye campo usuario', () => {
    const withUsuario = { ...validInput, usuario: 'cfigueroa' };
    const result = updateUserSchema.safeParse(withUsuario);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>)['usuario']).toBeUndefined();
    }
  });

  it('no incluye campo password', () => {
    const withPassword = { ...validInput, password: 'Segura1234' };
    const result = updateUserSchema.safeParse(withPassword);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>)['password']).toBeUndefined();
    }
  });

  it('rechaza nombreCompleto vacío', () => {
    const result = updateUserSchema.safeParse({ ...validInput, nombreCompleto: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza correo con formato inválido', () => {
    const result = updateUserSchema.safeParse({ ...validInput, correo: 'invalido' });
    expect(result.success).toBe(false);
  });

  it('rechaza rol inválido', () => {
    const result = updateUserSchema.safeParse({ ...validInput, rol: 'Root' });
    expect(result.success).toBe(false);
  });

  it('acepta rol Consulta', () => {
    const result = updateUserSchema.safeParse({ ...validInput, rol: 'Consulta' });
    expect(result.success).toBe(true);
  });
});
