import Image from 'next/image';
import { requireAuth } from '@/lib/auth/guards';
import { DashboardCards } from '@/components/ui/DashboardCards';

export default async function DashboardPage() {
  const session = await requireAuth();

  return (
    <main className="min-h-screen bg-ucc-gray">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/images/logo-ucc.jpeg"
            alt="Logo Universidad Cooperativa de Colombia"
            width={100}
            height={100}
            className="rounded-lg shadow-card mb-4"
          />
          <h1 className="text-3xl font-bold text-center text-gray-900">
            Gestor de Comités
          </h1>
        </div>

        <DashboardCards userRole={session.rol} />
      </div>
    </main>
  );
}
