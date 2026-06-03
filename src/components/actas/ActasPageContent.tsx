'use client';

import { useState } from 'react';
import { ActaTable } from '@/components/actas/ActaTable';
import { ActaFormModal } from '@/components/actas/ActaFormModal';
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
 */
export function ActasPageContent({ initialData, userRole, userNombreCompleto }: ActasPageContentProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const permissions = ROLE_PERMISSIONS[userRole];

  function handleSuccess() {
    setRefreshKey((k) => k + 1);
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

      {/* Acta Table */}
      <ActaTable
        key={refreshKey}
        initialData={initialData}
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
