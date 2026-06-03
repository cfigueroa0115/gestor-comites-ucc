import Image from 'next/image';
import { requireAuth } from '@/lib/auth/guards';
import { logoutAction } from '@/actions/auth.actions';

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
    <div className="min-h-screen flex flex-col bg-ucc-gray">
      {/* Navigation Header */}
      <header className="bg-ucc-green text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Portal title with logo */}
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo-ucc.jpeg"
                alt="Logo UCC"
                width={36}
                height={36}
                className="rounded-sm bg-white p-0.5"
              />
              <h1 className="text-lg font-semibold tracking-tight">
                Portal Gestión de Comités
              </h1>
            </div>

            {/* Right: User info + Logout */}
            <div className="flex items-center gap-4">
              {/* User name */}
              <span className="text-sm font-medium hidden sm:inline">
                {session.nombreCompleto}
              </span>

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

      {/* Main content area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
