'use client';

import { useState, useTransition } from 'react';
import { listUsersAction, toggleActiveAction } from '@/actions/user.actions';
import { UserFormModal } from '@/components/admin/UserFormModal';
import type { PaginatedUsers, UserListItem } from '@/lib/services/user.service';

interface UserTableProps {
  initialData: PaginatedUsers;
  currentAdminId: string;
}

/**
 * UserTable – Client component for displaying the paginated user list.
 *
 * Features:
 * - 20 users per page, sorted alphabetically by nombre_completo
 * - Columns: nombre completo, usuario, cargo, rol, correo, estado
 * - Activate/deactivate toggle per user row
 * - "+ Crear usuario" button that opens UserFormModal
 * - Edit button per row that opens UserFormModal in edit mode
 * - Success/error notifications
 *
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.7, 3.9
 */
export function UserTable({ initialData, currentAdminId }: UserTableProps) {
  const [data, setData] = useState<PaginatedUsers>(initialData);
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    user?: UserListItem;
  }>({ isOpen: false, mode: 'create' });

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  function refreshList(page?: number) {
    startTransition(async () => {
      const result = await listUsersAction(page ?? data.page);
      if (result.success && result.data) {
        setData(result.data);
      }
    });
  }

  function handleToggleActive(userId: string) {
    startTransition(async () => {
      const result = await toggleActiveAction(userId);
      if (result.success) {
        showNotification('success', 'Estado del usuario actualizado correctamente');
        refreshList();
      } else {
        showNotification('error', result.error?.message || 'Error al cambiar estado');
      }
    });
  }

  function handleCreateClick() {
    setModalState({ isOpen: true, mode: 'create' });
  }

  function handleEditClick(user: UserListItem) {
    setModalState({ isOpen: true, mode: 'edit', user });
  }

  function handleModalClose() {
    setModalState({ isOpen: false, mode: 'create' });
  }

  function handleModalSuccess(message: string) {
    showNotification('success', message);
    handleModalClose();
    refreshList();
  }

  function goToPage(page: number) {
    refreshList(page);
  }

  return (
    <div>
      {/* Notification */}
      {notification && (
        <div
          role="alert"
          className={`mb-4 rounded-lg p-4 text-sm font-medium ${
            notification.type === 'success'
              ? 'border border-green-300 bg-green-50 text-green-800'
              : 'border border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header with create button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-600">
          {data.total} usuario{data.total !== 1 ? 's' : ''} registrado{data.total !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={handleCreateClick}
          className="inline-flex items-center gap-2 rounded-lg bg-ucc-green px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-all duration-300 hover:bg-ucc-green-dark hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-ucc-green/50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear usuario
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-card">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Nombre Completo
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Usuario
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Cargo
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Rol
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Correo
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  No hay usuarios registrados
                </td>
              </tr>
            ) : (
              data.users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {user.nombreCompleto}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {user.usuario}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {user.cargo}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.rol === 'Administrador'
                        ? 'bg-purple-100 text-purple-800'
                        : user.rol === 'Usuario_Gestor'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.rol.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {user.correo}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.activo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleEditClick(user)}
                        className="inline-flex items-center p-1.5 rounded-md text-gray-500 hover:text-ucc-green hover:bg-ucc-green-light transition-colors duration-200"
                        title="Editar usuario"
                        aria-label={`Editar ${user.nombreCompleto}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Toggle Active Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(user.id)}
                        disabled={isPending || user.id === currentAdminId}
                        className={`inline-flex items-center p-1.5 rounded-md transition-colors duration-200 ${
                          user.id === currentAdminId
                            ? 'text-gray-300 cursor-not-allowed'
                            : user.activo
                            ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={
                          user.id === currentAdminId
                            ? 'No puede desactivar su propia cuenta'
                            : user.activo
                            ? 'Desactivar usuario'
                            : 'Activar usuario'
                        }
                        aria-label={
                          user.activo
                            ? `Desactivar ${user.nombreCompleto}`
                            : `Activar ${user.nombreCompleto}`
                        }
                      >
                        {user.activo ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-gray-600">
            Página {data.page} de {data.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(data.page - 1)}
              disabled={data.page <= 1 || isPending}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => goToPage(data.page + 1)}
              disabled={data.page >= data.totalPages || isPending}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/10">
          <div className="bg-white rounded-lg p-4 shadow-lg flex items-center gap-3">
            <svg className="h-5 w-5 animate-spin text-ucc-green" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-gray-700">Procesando...</span>
          </div>
        </div>
      )}

      {/* Create/Edit User Modal */}
      <UserFormModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        user={modalState.user}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
