import { requireAdmin } from '@/lib/auth/guards';
import { listUsers } from '@/lib/services/user.service';
import { UserTable } from '@/components/admin/UserTable';

/**
 * User Administration Page (Server Component)
 *
 * Accessible only to users with Administrador role.
 * Calls requireAdmin() which redirects non-admins to /dashboard (403 behavior).
 *
 * Fetches the initial user list server-side and passes it to the
 * UserTable client component for pagination and interaction.
 *
 * Validates: Requirements 3.1, 3.9, 3.10
 */
export default async function AdminUsuariosPage() {
  // Guard: only Administrador role can access this page
  // Redirects to /dashboard if non-admin (requirement 3.10)
  const session = await requireAdmin();

  // Fetch initial user list (page 1)
  const result = await listUsers(1);
  const initialData = result.data!;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Administración de Usuarios
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Gestione las cuentas de usuario del sistema, sus roles y estado de acceso.
        </p>
      </div>

      {/* User Table (Client Component) */}
      <UserTable
        initialData={initialData}
        currentAdminId={session.userId}
      />
    </div>
  );
}
