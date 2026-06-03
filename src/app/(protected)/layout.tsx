import Image from 'next/image';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { logoutAction } from '@/actions/auth.actions';
import { BackButton } from '@/components/ui/BackButton';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="min-h-screen flex flex-col bg-ucc-gray bg-digital-pattern bg-digital-dots">
      {/* Navigation Header */}
      <header className="bg-gradient-to-r from-ucc-green to-ucc-green-dark text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top bar */}
          <div className="flex items-center justify-between h-[72px]">
            {/* Left: Logo clickable (goes to dashboard) */}
            <Link href="/dashboard" className="flex items-center gap-3 group transition-all duration-300 hover:scale-[1.02]">
              <div className="bg-white rounded-lg p-1 shadow-md group-hover:shadow-lg transition-shadow">
                <Image
                  src="/images/logo-ucc.jpeg"
                  alt="Logo UCC - Volver al inicio"
                  width={48}
                  height={48}
                  className="rounded"
                  priority
                />
              </div>
            </Link>

            {/* Center: Navigation with icons */}
            <nav className="flex items-center gap-1">
              <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-base font-semibold rounded-lg hover:bg-white/15 transition-all duration-200 group">
                <svg className="w-5 h-5 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Inicio</span>
              </Link>
              <Link href="/actas" className="flex items-center gap-2 px-4 py-2 text-base font-semibold rounded-lg hover:bg-white/15 transition-all duration-200 group">
                <svg className="w-5 h-5 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Actas</span>
              </Link>
              {session.rol === 'Administrador' && (
                <Link href="/admin/usuarios" className="flex items-center gap-2 px-4 py-2 text-base font-semibold rounded-lg hover:bg-white/15 transition-all duration-200 group">
                  <svg className="w-5 h-5 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Admin</span>
                </Link>
              )}
            </nav>

            {/* Right: User avatar + status + logout */}
            <div className="flex items-center gap-3">
              {/* User info with avatar icon */}
              <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
                {/* User avatar icon */}
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  {/* Blinking green dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400 border-2 border-ucc-green-dark shadow-[0_0_6px_rgba(74,222,128,0.8)]"></span>
                  </span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium text-white truncate max-w-[160px]">
                    {session.nombreCompleto}
                  </span>
                  <span className="text-[11px] text-green-300 font-medium flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_4px_rgba(74,222,128,0.9)]"></span>
                    En línea
                  </span>
                </div>
              </div>

              {/* Logout button */}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-white/10 hover:bg-red-500/80 border border-white/20 hover:border-red-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <BackButton />
      </div>

      {/* Main content area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
