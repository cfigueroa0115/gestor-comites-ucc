import { requireAuth } from '@/lib/auth/guards';
import { listActas } from '@/lib/services/acta.service';
import { ActasPageContent } from '@/components/actas/ActasPageContent';

/**
 * Actas List Page (Server Component)
 */
export default async function ActasPage() {
  const session = await requireAuth();

  const result = await listActas({}, 1);
  const initialData = result.success && result.data ? result.data : {
    actas: [],
    total: 0,
    page: 1,
    totalPages: 0,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <ActasPageContent
        initialData={initialData}
        userRole={session.rol}
        userNombreCompleto={session.nombreCompleto}
      />
    </div>
  );
}
