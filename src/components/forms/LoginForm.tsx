'use client';

import { useActionState, useState } from 'react';
import { loginAction } from '@/lib/auth/actions';
import type { ActionResult } from '@/types';

/** Static cargo options for the login form dropdown. */
const CARGO_OPTIONS = [
  'Docente',
  'Director de Programa',
  'Decano',
  'Administrativo',
  'Investigador',
] as const;

/** Initial state for the form action. */
const initialState: ActionResult = {
  success: false,
};

/**
 * Wraps loginAction for use with useActionState.
 * useActionState expects (prevState, formData) => Promise<State>
 */
async function loginFormAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return loginAction(formData);
}

/**
 * LoginForm – Client component that renders the authentication form.
 *
 * Features:
 * - Client-side validation before submission (usuario 3-50, contraseña 8-128, cargo required)
 * - Generic error messages on failure (no field-specific hints)
 * - Lock message when account is temporarily blocked (errorCode === 'ACCOUNT_LOCKED')
 * - Loading state while submitting
 * - UCC institutional styling
 *
 * Validates: Requirements 2.1, 2.3, 2.8
 */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginFormAction, initialState);
  const [clientError, setClientError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const formData = new FormData(form);

    const usuario = (formData.get('usuario') as string) || '';
    const contrasena = (formData.get('contrasena') as string) || '';
    const cargo = (formData.get('cargo') as string) || '';

    // Client-side validation
    if (usuario.length < 3 || usuario.length > 50) {
      e.preventDefault();
      setClientError('Credenciales inválidas. Por favor verifique sus datos.');
      return;
    }

    if (contrasena.length < 8 || contrasena.length > 128) {
      e.preventDefault();
      setClientError('Credenciales inválidas. Por favor verifique sus datos.');
      return;
    }

    if (!cargo) {
      e.preventDefault();
      setClientError('Credenciales inválidas. Por favor verifique sus datos.');
      return;
    }

    // Clear client error if validation passes – form will proceed with action
    setClientError(null);
  }

  const errorMessage = clientError || (state?.error?.message ?? null);
  const isLocked = state?.error?.code === 'ACCOUNT_LOCKED';

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-6"
      noValidate
    >
      {/* Error / Lock Messages */}
      {errorMessage && (
        <div
          role="alert"
          className={`rounded-lg p-4 text-sm font-medium ${
            isLocked
              ? 'border border-ucc-orange/30 bg-orange-50 text-ucc-orange'
              : 'border border-ucc-red/30 bg-red-50 text-ucc-red'
          }`}
        >
          {isLocked && (
            <span className="mr-2 inline-block" aria-hidden="true">
              🔒
            </span>
          )}
          {errorMessage}
        </div>
      )}

      {/* Usuario Field */}
      <div className="space-y-2">
        <label
          htmlFor="usuario"
          className="block text-sm font-semibold text-gray-700"
        >
          Usuario
        </label>
        <input
          id="usuario"
          name="usuario"
          type="text"
          required
          minLength={3}
          maxLength={50}
          autoComplete="username"
          placeholder="Ingrese su usuario"
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:border-ucc-green focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      {/* Contraseña Field */}
      <div className="space-y-2">
        <label
          htmlFor="contrasena"
          className="block text-sm font-semibold text-gray-700"
        >
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="current-password"
          placeholder="Ingrese su contraseña"
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:border-ucc-green focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      {/* Cargo Field */}
      <div className="space-y-2">
        <label
          htmlFor="cargo"
          className="block text-sm font-semibold text-gray-700"
        >
          Cargo
        </label>
        <select
          id="cargo"
          name="cargo"
          required
          disabled={isPending}
          defaultValue=""
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 transition-colors duration-200 focus:border-ucc-green focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          <option value="" disabled>
            Seleccione su cargo
          </option>
          {CARGO_OPTIONS.map((cargo) => (
            <option key={cargo} value={cargo}>
              {cargo}
            </option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-ucc-green px-6 py-3 text-base font-semibold text-white shadow-card transition-all duration-300 hover:bg-ucc-green-dark hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-ucc-green/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-5 w-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Ingresando...
          </span>
        ) : (
          'Ingresar'
        )}
      </button>
    </form>
  );
}
