import Image from 'next/image';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { logoutAction } from '@/actions/auth.actions';
import { BackButton } from '@/components/ui/BackButton';

/**
 * Protected layout that wraps all authenticated routes (/dashboard, /actas, /admin).
 *
 * This Server Component:
 * 1. Validates the session via requireAuth() — redirects to /login if invalid
 * 2. Renders a navigation header with user info and logout button
 * 3. Passes children as the main content area
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="min-h-screen flex flex-col bg-ucc-gray bg-digital-pattern bg-digital-dots">
      {/* Navigation Header */}
      <header className="bg-ucc-green text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Portal title with logo + nav links */}
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Image
                  src="/images/logo-ucc.jpeg"
                  alt="Logo UCC"
                  width={36}
                  height={36}
                  className="rounded-sm bg-white p-0.5"
                />
                <span className="text-lg font-semibold tracking-tight hidden md:inline">
                  Portal Gestión de Comités
                </span>
              </Link>
              {/* Navigation links */}
              <nav className="hidden sm:flex items-center gap-1 ml-4">
                <Link href="/dashboard" className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-white/10 transition-colors">
                  Inicio
                </Link>
                <Link href="/actas" className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-white/10 transition-colors">
                  Actas
                </Link>
                {session.rol === 'Administrador' && (
                  <Link href="/admin/usuarios" className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-white/10 transition-colors">
                    Admin
                  </Link>
                )}
              </nav>
            </div>

            {/* Right: User info + Online indicator + Logout */}
            <div className="flex items-center gap-4">
              {/* Online indicator + User name */}
              <div className="flex items-center gap-2 hidden sm:flex">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-sm font-medium">
                  {session.nombreCompleto}
                </span>
                <span className="text-xs text-green-200">En línea</span>
              </div>

              {/* Role badge */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30">
                {session.rol}
              </span>

              {/* Logout button as form with server action */}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-white/10 hover:bg-white/20 border border-white/30 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Back navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <BackButton />
      </div>

      {/* Main content area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
