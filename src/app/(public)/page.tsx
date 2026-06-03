import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white">
      {/* Header */}
      <header className="w-full bg-ucc-green py-4 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <span className="text-sm font-medium text-white sm:text-base">
            Universidad Cooperativa de Colombia
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="mx-auto w-full max-w-3xl text-center">
          {/* Green accent line */}
          <div
            className="mx-auto mb-6 h-1 w-16 rounded bg-ucc-green"
            aria-hidden="true"
          />

          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Portal Gestión de Comités
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
            Sistema institucional para la gestión de actas de comités académicos
            de la Facultad de Ingeniería. Administre, genere y consulte las
            actas de sus comités con trazabilidad documental y apoyo de
            inteligencia artificial.
          </p>

          <div className="mt-10">
            <Link
              href="/login"
              className="inline-block rounded-lg bg-ucc-green px-8 py-3 text-base font-semibold text-white shadow-sm transition-all duration-300 hover:bg-ucc-green-dark hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ucc-green focus:ring-offset-2"
              aria-label="Ingresar al portal de gestión de comités"
            >
              Ingresar al portal
            </Link>
          </div>
        </div>
      </main>

      {/* Light gray section */}
      <section
        className="w-full bg-ucc-gray px-4 py-8 sm:px-6 lg:px-8"
        aria-label="Información del programa"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm text-gray-500 sm:text-base">
            Facultad de Ingeniería — Programa Ingeniería Industrial
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-ucc-gray-dark bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-xs text-gray-500 sm:text-sm">
            © Mgtr. Carlos Alberto Figueroa Martínez || Programa Ingeniería
            Industrial
          </p>
        </div>
      </footer>
    </div>
  );
}
