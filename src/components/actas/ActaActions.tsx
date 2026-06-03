'use client';

import type { EstadoActa, Rol } from '@/types';
import { ROLE_PERMISSIONS } from '@/lib/utils/constants';

export interface ActaActionsProps {
  /** ID of the acta for building links/actions */
  actaId: string;
  /** Current status of the acta */
  estado: EstadoActa;
  /** Role of the current user */
  userRole: Rol;
}

/**
 * ActaActions renders action buttons for a single acta row.
 *
 * Visible actions depend on user role and acta estado:
 * - All roles: ver detalle, consultar soportes, ver estado
 * - Administrador & Usuario_Gestor: descargar, reintentar generación (when Error_generacion)
 * - Consulta: only ver detalle, consultar soportes, ver estado
 *
 * Validates: Requirements 5.5, 5.6, 5.8
 */
export function ActaActions({ actaId, estado, userRole }: ActaActionsProps) {
  const permissions = ROLE_PERMISSIONS[userRole];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Ver detalle - visible for all roles */}
      <ActionButton
        label="Ver detalle"
        icon={<EyeIcon />}
        onClick={() => handleVerDetalle(actaId)}
      />

      {/* Descargar - hidden for Consulta role */}
      {permissions.downloadActa && (
        <ActionButton
          label="Descargar"
          icon={<DownloadIcon />}
          onClick={() => handleDescargar(actaId)}
        />
      )}

      {/* Consultar soportes - visible for all roles */}
      <ActionButton
        label="Consultar soportes"
        icon={<PaperClipIcon />}
        onClick={() => handleConsultarSoportes(actaId)}
      />

      {/* Ver estado - visible for all roles */}
      <ActionButton
        label="Ver estado"
        icon={<StatusIcon />}
        onClick={() => handleVerEstado(actaId)}
      />

      {/* Reintentar generación - only when estado = Error_generacion AND role has permission */}
      {estado === 'Error_generacion' && permissions.retryGeneration && (
        <ActionButton
          label="Reintentar"
          icon={<RetryIcon />}
          onClick={() => handleReintentar(actaId)}
          variant="danger"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "+ Nueva Acta" Header Button
// ---------------------------------------------------------------------------

export interface NuevaActaButtonProps {
  /** Role of the current user */
  userRole: Rol;
  /** Click handler to open the new acta form */
  onClick: () => void;
}

/**
 * NuevaActaButton renders the "+ Nueva Acta" button in the page header.
 * Hidden for Consulta role.
 *
 * Validates: Requirements 5.7, 5.8
 */
export function NuevaActaButton({ userRole, onClick }: NuevaActaButtonProps) {
  const permissions = ROLE_PERMISSIONS[userRole];

  if (!permissions.createActa) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 bg-ucc-green text-white text-sm font-medium rounded-md hover:bg-ucc-green-dark transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-ucc-green focus:ring-offset-2"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
      Nueva Acta
    </button>
  );
}

// ---------------------------------------------------------------------------
// ActionButton (internal reusable)
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

function ActionButton({ label, icon, onClick, variant = 'default' }: ActionButtonProps) {
  const baseClasses =
    'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1';

  const variantClasses =
    variant === 'danger'
      ? 'text-red-700 hover:bg-red-50 hover:text-red-800 focus:ring-red-500'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:ring-ucc-green';

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`${baseClasses} ${variantClasses}`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Action handlers (placeholder - will be wired in future tasks)
// ---------------------------------------------------------------------------

function handleVerDetalle(actaId: string) {
  // Will navigate to /actas/[id] detail page
  if (typeof window !== 'undefined') {
    window.location.href = `/actas/${actaId}`;
  }
}

function handleDescargar(actaId: string) {
  // Will trigger document download via API route
  if (typeof window !== 'undefined') {
    window.open(`/api/files/acta/${actaId}/download`, '_blank');
  }
}

function handleConsultarSoportes(actaId: string) {
  // Will navigate to acta detail with soportes tab/section open
  if (typeof window !== 'undefined') {
    window.location.href = `/actas/${actaId}?tab=soportes`;
  }
}

function handleVerEstado(actaId: string) {
  // Will navigate to acta detail with estado tab/section open
  if (typeof window !== 'undefined') {
    window.location.href = `/actas/${actaId}?tab=estado`;
  }
}

function handleReintentar(actaId: string) {
  // Will call server action to retry acta generation
  // For now, placeholder - will be implemented in AI generation task
  console.log('Reintentar generación para acta:', actaId);
}

// ---------------------------------------------------------------------------
// Icon Components (small inline SVGs for action buttons)
// ---------------------------------------------------------------------------

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PaperClipIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
