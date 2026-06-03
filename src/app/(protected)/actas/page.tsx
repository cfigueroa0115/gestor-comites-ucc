import { requireAuth } from '@/lib/auth/guards';
import { listActas } from '@/lib/services/acta.service';
import { ActaTable } from '@/components/actas/ActaTable';

/**
 * Actas List Page (Server Component)
 *
 * Displays the "Gestión de Actas de Comité" module with paginated table.
 * Calls requireAuth() for session validation and passes the user role
 * to client components for role-based action visibility.
 *
 * Validates: Requirements 5.1, 5.3
 */
export default async function ActasPage() {
  const session = await requireAuth();

  // Fetch initial actas list (page 1, default 10 per page, sorted by fecha DESC)
  const result = await listActas({}, 1);
  const initialData = result.success && result.data ? result.data : {
    actas: [],
    total: 0,
    page: 1,
    totalPages: 0,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Gestión de Actas de Comité
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Consulte, genere y administre las actas de los comités académicos con
          trazabilidad documental e inteligencia artificial aplicada.
        </p>
      </div>

      {/* Acta Table (Client Component) */}
      <ActaTable
        initialData={initialData}
        userRole={session.rol}
      />
    </div>
  );
}
