import { requireAuth } from '@/lib/auth/guards';
import { DashboardCards } from '@/components/ui/DashboardCards';

export default async function DashboardPage() {
  const session = await requireAuth();

  return (
    <main className="min-h-screen bg-ucc-gray">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-10">
          Gestor de Comités
        </h1>

        <DashboardCards userRole={session.rol} />
      </div>
    </main>
  );
}
