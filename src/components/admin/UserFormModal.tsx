'use client';

import { useState, useTransition } from 'react';
import { createUserAction, updateUserAction } from '@/actions/user.actions';
import type { UserListItem } from '@/lib/services/user.service';

interface UserFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  user?: UserListItem;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const ROL_OPTIONS = [
  { value: 'Administrador', label: 'Administrador' },
  { value: 'Usuario_Gestor', label: 'Usuario Gestor' },
  { value: 'Consulta', label: 'Consulta' },
] as const;

/**
 * UserFormModal – Client component for creating and editing users.
 *
 * Two modes:
 * - Create: all fields including usuario and password
 * - Edit: only nombreCompleto, cargo, correo, and rol (no password/usuario)
 *
 * Client-side validation + server-side validation via Zod.
 * Shows field-specific errors returned from the server action.
 *
 * Validates: Requirements 3.2, 3.4
 */
export function UserFormModal({
  isOpen,
  mode,
  user,
  onClose,
  onSuccess,
}: UserFormModalProps) {
  if (!isOpen) return null;

  return (
    <UserFormModalInner
      key={`${mode}-${user?.id ?? 'new'}`}
      mode={mode}
      user={user}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function UserFormModalInner({
  mode,
  user,
  onClose,
  onSuccess,
}: Omit<UserFormModalProps, 'isOpen'>) {
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Gather field values
    const nombreCompleto = (formData.get('nombreCompleto') as string) || '';
    const cargo = (formData.get('cargo') as string) || '';
    const correo = (formData.get('correo') as string) || '';
    const rol = (formData.get('rol') as string) || '';

    // Client-side basic validation
    const errors: Record<string, string> = {};

    if (!nombreCompleto.trim()) errors.nombreCompleto = 'El nombre completo es obligatorio';
    else if (nombreCompleto.length > 100) errors.nombreCompleto = 'Máximo 100 caracteres';
    if (!cargo.trim()) errors.cargo = 'El cargo es obligatorio';
    else if (cargo.length > 100) errors.cargo = 'Máximo 100 caracteres';
    if (!correo.trim()) errors.correo = 'El correo es obligatorio';
    if (!rol) errors.rol = 'Debe seleccionar un rol';

    let usuario = '';
    let password = '';

    if (mode === 'create') {
      usuario = (formData.get('usuario') as string) || '';
      password = (formData.get('password') as string) || '';

      if (!usuario.trim()) errors.usuario = 'El usuario es obligatorio';
      else if (usuario.length < 3) errors.usuario = 'Mínimo 3 caracteres';
      else if (usuario.length > 50) errors.usuario = 'Máximo 50 caracteres';

      if (!password) errors.password = 'La contraseña es obligatoria';
      else if (password.length < 8) errors.password = 'Mínimo 8 caracteres';
      else if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/.test(password)) {
        errors.password = 'Debe contener al menos una mayúscula, una minúscula y un número';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Submit to server
    startTransition(async () => {
      try {
        if (mode === 'create') {
          const result = await createUserAction({
            nombreCompleto,
            usuario,
            password,
            cargo,
            correo,
            rol,
          });

          if (result.success) {
            onSuccess('Usuario creado exitosamente');
          } else {
            if (result.error?.fieldErrors) {
              setFieldErrors(result.error.fieldErrors);
            }
            setGeneralError(result.error?.message || 'Ocurrió un error inesperado');
          }
        } else {
          const result = await updateUserAction(user!.id, {
            nombreCompleto,
            cargo,
            correo,
            rol,
          });

          if (result.success) {
            onSuccess('Usuario actualizado exitosamente');
          } else {
            if (result.error?.fieldErrors) {
              setFieldErrors(result.error.fieldErrors);
            }
            setGeneralError(result.error?.message || 'Ocurrió un error inesperado');
          }
        }
      } catch {
        setGeneralError('Ocurrió un error inesperado. Intente nuevamente.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? 'Crear Usuario' : 'Editar Usuario'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* General error */}
          {generalError && (
            <div
              role="alert"
              className="rounded-lg p-3 text-sm font-medium border border-red-300 bg-red-50 text-red-800"
            >
              {generalError}
            </div>
          )}

          {/* Nombre Completo */}
          <div className="space-y-1">
            <label htmlFor="nombreCompleto" className="block text-sm font-semibold text-gray-700">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              id="nombreCompleto"
              name="nombreCompleto"
              type="text"
              maxLength={100}
              defaultValue={mode === 'edit' ? user?.nombreCompleto : ''}
              disabled={isPending}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.nombreCompleto ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-ucc-green'
              }`}
              placeholder="Nombre completo del usuario"
            />
            {fieldErrors.nombreCompleto && (
              <p className="text-xs text-red-600">{fieldErrors.nombreCompleto}</p>
            )}
          </div>

          {/* Usuario (only in create mode) */}
          {mode === 'create' && (
            <div className="space-y-1">
              <label htmlFor="usuario" className="block text-sm font-semibold text-gray-700">
                Usuario <span className="text-red-500">*</span>
              </label>
              <input
                id="usuario"
                name="usuario"
                type="text"
                minLength={3}
                maxLength={50}
                disabled={isPending}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                  fieldErrors.usuario ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-ucc-green'
                }`}
                placeholder="Nombre de usuario único"
              />
              {fieldErrors.usuario && (
                <p className="text-xs text-red-600">{fieldErrors.usuario}</p>
              )}
            </div>
          )}

          {/* Password (only in create mode) */}
          {mode === 'create' && (
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={8}
                disabled={isPending}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                  fieldErrors.password ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-ucc-green'
                }`}
                placeholder="Mínimo 8 caracteres (mayúscula, minúscula, número)"
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>
          )}

          {/* Cargo */}
          <div className="space-y-1">
            <label htmlFor="cargo" className="block text-sm font-semibold text-gray-700">
              Cargo <span className="text-red-500">*</span>
            </label>
            <input
              id="cargo"
              name="cargo"
              type="text"
              maxLength={100}
              defaultValue={mode === 'edit' ? user?.cargo : ''}
              disabled={isPending}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.cargo ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-ucc-green'
              }`}
              placeholder="Cargo del usuario"
            />
            {fieldErrors.cargo && (
              <p className="text-xs text-red-600">{fieldErrors.cargo}</p>
            )}
          </div>

          {/* Correo */}
          <div className="space-y-1">
            <label htmlFor="correo" className="block text-sm font-semibold text-gray-700">
              Correo electrónico <span className="text-red-500">*</span>
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              maxLength={150}
              defaultValue={mode === 'edit' ? user?.correo : ''}
              disabled={isPending}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.correo ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-ucc-green'
              }`}
              placeholder="correo@ejemplo.com"
            />
            {fieldErrors.correo && (
              <p className="text-xs text-red-600">{fieldErrors.correo}</p>
            )}
          </div>

          {/* Rol */}
          <div className="space-y-1">
            <label htmlFor="rol" className="block text-sm font-semibold text-gray-700">
              Rol <span className="text-red-500">*</span>
            </label>
            <select
              id="rol"
              name="rol"
              defaultValue={mode === 'edit' ? user?.rol : ''}
              disabled={isPending}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.rol ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-ucc-green'
              }`}
            >
              <option value="" disabled>
                Seleccione un rol
              </option>
              {ROL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.rol && (
              <p className="text-xs text-red-600">{fieldErrors.rol}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-ucc-green rounded-lg hover:bg-ucc-green-dark transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Guardando...
                </>
              ) : mode === 'create' ? (
                'Crear usuario'
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
