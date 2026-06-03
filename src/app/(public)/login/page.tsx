import Link from 'next/link';
import Image from 'next/image';
import { LoginForm } from '@/components/forms/LoginForm';

export const metadata = {
  title: 'Iniciar Sesión | Portal Gestión de Comités',
  description: 'Inicie sesión en el Portal de Gestión de Comités de la Facultad de Ingeniería - UCC',
};

/**
 * Login page – Server Component wrapper for the LoginForm client component.
 *
 * Renders a centered card with UCC institutional branding containing
 * the login form.
 *
 * Route: /login (public)
 * Validates: Requirements 2.1, 2.3, 2.8
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ucc-gray px-4 py-8 bg-digital-pattern bg-digital-dots">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="rounded-2xl bg-white p-8 shadow-card sm:p-10">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4">
              <Image
                src="/images/logo-ucc.jpeg"
                alt="Logo Universidad Cooperativa de Colombia"
                width={80}
                height={80}
                className="mx-auto rounded-lg"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Iniciar Sesión
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Portal Gestión de Comités
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />

          {/* Back Link */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-ucc-green transition-colors duration-200 hover:text-ucc-green-dark hover:underline"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          © Mgtr. Carlos Alberto Figueroa Martínez || Programa Ingeniería Industrial
        </p>
      </div>
    </main>
  );
}
