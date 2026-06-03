'use client';

import { useState, useTransition, useCallback } from 'react';
import { ActaTable } from '@/components/actas/ActaTable';
import { ActaFormModal } from '@/components/actas/ActaFormModal';
import { listActasAction } from '@/actions/acta.actions';
import { ROLE_PERMISSIONS } from '@/lib/utils/constants';
import type { PaginatedActas } from '@/lib/services/acta.service';
import type { Rol } from '@/types';

interface ActasPageContentProps {
  initialData: PaginatedActas;
  userRole: Rol;
  userNombreCompleto: string;
}

/**
 * ActasPageContent – Client wrapper that includes the page header,
 * "+ Nueva Acta" button, form modal, and the ActaTable.
 * Auto-refreshes the table after successful acta creation.
 */
export function ActasPageContent({ initialData, userRole, userNombreCompleto }: ActasPageContentProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [tableData, setTableData] = useState<PaginatedActas>(initialData);
  const [isPending, startTransition] = useTransition();
  const permissions = ROLE_PERMISSIONS[userRole];

  const refreshTable = useCallback(() => {
    startTransition(async () => {
      const result = await listActasAction({}, 1);
      if (result.success && result.data) {
        setTableData(result.data);
      }
    });
  }, []);

  function handleSuccess() {
    setModalOpen(false);
    // Auto-refresh the table with fresh data from the server
    refreshTable();
  }

  return (
    <>
      {/* Page Header with + Nueva Acta button */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestión de Actas de Comité
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Consulte, genere y administre las actas de los comités académicos con
            trazabilidad documental e inteligencia artificial aplicada.
          </p>
        </div>

        {/* + Nueva Acta button — hidden for Consulta role */}
        {permissions.createActa && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ucc-green text-white text-sm font-semibold rounded-lg shadow-card hover:bg-ucc-green-dark hover:shadow-card-hover transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ucc-green/50 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Acta
          </button>
        )}
      </div>

      {/* Success notification */}
      {isPending && (
        <div className="mb-4 rounded-lg p-3 text-sm font-medium border border-green-300 bg-green-50 text-green-800 flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Actualizando tabla de actas...
        </div>
      )}

      {/* Acta Table — receives live data */}
      <ActaTable
        initialData={tableData}
        userRole={userRole}
      />

      {/* New Acta Form Modal */}
      <ActaFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        userNombreCompleto={userNombreCompleto}
      />
    </>
  );
}
