import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white bg-digital-pattern bg-digital-dots">
      {/* Header */}
      <header className="w-full bg-gradient-to-r from-ucc-green to-ucc-green-dark py-3 px-4 sm:px-6 lg:px-8 shadow-md">
        <div className="mx-auto max-w-7xl flex items-center gap-4">
          <Image
            src="/images/logo-ucc.jpeg"
            alt="Logo Universidad Cooperativa de Colombia"
            width={52}
            height={52}
            className="rounded-lg"
          />
          <div className="flex flex-col">
            <span className="text-base font-bold text-white sm:text-lg tracking-tight">
              Universidad Cooperativa de Colombia
            </span>
            <span className="text-[11px] text-green-200 font-medium hidden sm:inline">
              Facultad de Ingeniería
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="mx-auto w-full max-w-3xl text-center">
          {/* UCC Logo - Large */}
          <div className="mx-auto mb-8">
            <Image
              src="/images/logo-ucc.jpeg"
              alt="Logo Universidad Cooperativa de Colombia"
              width={180}
              height={180}
              className="mx-auto rounded-lg shadow-card"
              priority
            />
          </div>

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
