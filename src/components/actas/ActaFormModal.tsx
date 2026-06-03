'use client';

import { useState, useTransition, useCallback } from 'react';
import { AttendeesTable, type Attendee, type AttendeesErrors } from '@/components/forms/AttendeesTable';
import { AttachmentManager } from '@/components/actas/AttachmentManager';
import { actaFormSchema, TIPO_COMITE_OPTIONS, AREA_PROGRAMA_OPTIONS } from '@/lib/validations/acta.schema';
import { createActaAction } from '@/actions/acta.actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userNombreCompleto: string;
}

interface FieldErrors {
  tipoComite?: string;
  areaPrograma?: string;
  ordenDia?: string;
  asistentes?: string;
  proyecto?: string;
  reviso?: string;
  copia?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current date formatted as dd/mm/yyyy in America/Bogota timezone.
 */
function getCurrentDateBogota(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  // Intl returns "dd/mm/yyyy" for es-CO locale
  return formatter.format(now);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ActaFormModal – Modal form for creating a new acta de comité.
 *
 * Features:
 * - Non-editable date field (current date, dd/mm/yyyy, America/Bogota)
 * - Tipo comité select
 * - Área/programa select
 * - Orden del día textarea with character counter (max 1200) and line break support
 * - Editable attendees table (add/remove rows, min 1 max 50)
 * - Proyectó field (defaults to user's nombre completo)
 * - Revisó field (required, max 150)
 * - Copia field (optional, max 300)
 * - Client-side validation with error highlighting per field
 * - Server action call on valid submit with useTransition for pending state
 * - Shows success confirmation on complete
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10
 */
export function ActaFormModal({
  isOpen,
  onClose,
  onSuccess,
  userNombreCompleto,
}: ActaFormModalProps) {
  if (!isOpen) return null;

  return (
    <ActaFormModalInner
      key="acta-form-modal"
      onClose={onClose}
      onSuccess={onSuccess}
      userNombreCompleto={userNombreCompleto}
    />
  );
}

function ActaFormModalInner({
  onClose,
  onSuccess,
  userNombreCompleto,
}: Omit<ActaFormModalProps, 'isOpen'>) {
  const [isPending, startTransition] = useTransition();

  // Form state - initialized fresh each time the modal opens (component mounts)
  const [tipoComite, setTipoComite] = useState('');
  const [areaPrograma, setAreaPrograma] = useState('');
  const [ordenDia, setOrdenDia] = useState('');
  const [asistentes, setAsistentes] = useState<Attendee[]>([{ nombre: '', cargo: '' }]);
  const [proyecto, setProyecto] = useState(userNombreCompleto);
  const [reviso, setReviso] = useState('');
  const [copia, setCopia] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Error state
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [attendeesErrors, setAttendeesErrors] = useState<AttendeesErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [uploadInProgress, setUploadInProgress] = useState(false);

  /**
   * Client-side validation. Returns true if all fields are valid.
   */
  const validateForm = useCallback((): boolean => {
    const errors: FieldErrors = {};
    const attErrors: AttendeesErrors = {};
    let valid = true;

    // Tipo comité
    if (!tipoComite) {
      errors.tipoComite = 'Debe seleccionar un tipo de comité';
      valid = false;
    }

    // Área/programa
    if (!areaPrograma) {
      errors.areaPrograma = 'Debe seleccionar un área/programa';
      valid = false;
    }

    // Orden del día
    if (!ordenDia.trim()) {
      errors.ordenDia = 'El orden del día es obligatorio';
      valid = false;
    } else if (ordenDia.length > 1200) {
      errors.ordenDia = 'El orden del día no puede exceder 1200 caracteres';
      valid = false;
    }

    // Asistentes - at least 1 row
    if (asistentes.length === 0) {
      errors.asistentes = 'Debe incluir al menos un asistente';
      valid = false;
    } else {
      // Validate each row
      asistentes.forEach((attendee, index) => {
        const rowErrors: { nombre?: string; cargo?: string } = {};
        if (!attendee.nombre.trim()) {
          rowErrors.nombre = 'El nombre es obligatorio';
          valid = false;
        }
        if (!attendee.cargo.trim()) {
          rowErrors.cargo = 'El cargo es obligatorio';
          valid = false;
        }
        if (rowErrors.nombre || rowErrors.cargo) {
          attErrors[index] = rowErrors;
        }
      });
    }

    // Proyectó
    if (!proyecto.trim()) {
      errors.proyecto = 'El campo Proyectó es obligatorio';
      valid = false;
    } else if (proyecto.length > 150) {
      errors.proyecto = 'El campo Proyectó no puede exceder 150 caracteres';
      valid = false;
    }

    // Revisó
    if (!reviso.trim()) {
      errors.reviso = 'El campo Revisó es obligatorio';
      valid = false;
    } else if (reviso.length > 150) {
      errors.reviso = 'El campo Revisó no puede exceder 150 caracteres';
      valid = false;
    }

    // Copia (optional but max 300)
    if (copia.length > 300) {
      errors.copia = 'El campo Copia no puede exceder 300 caracteres';
      valid = false;
    }

    setFieldErrors(errors);
    setAttendeesErrors(attErrors);
    return valid;
  }, [tipoComite, areaPrograma, ordenDia, asistentes, proyecto, reviso, copia]);

  /**
   * Handle form submission.
   */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) return;

    startTransition(async () => {
      try {
        // Validate again with Zod schema on client side
        const formData = {
          tipoComite,
          areaPrograma,
          ordenDia,
          asistentes,
          proyecto,
          reviso,
          copia: copia || undefined,
        };

        const zodResult = actaFormSchema.safeParse(formData);
        if (!zodResult.success) {
          const errors: FieldErrors = {};
          for (const issue of zodResult.error.issues) {
            const path = issue.path[0] as string;
            if (path && !errors[path as keyof FieldErrors]) {
              errors[path as keyof FieldErrors] = issue.message;
            }
          }
          setFieldErrors(errors);
          return;
        }

        // Call server action with the Zod-validated data
        // First, extract text from attached files to pass to the AI
        const fileTexts: string[] = [];
        for (const file of attachedFiles) {
          try {
            // For text-based files, read content directly on client
            if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
              const text = await file.text();
              if (text.trim()) fileTexts.push(text.trim());
            } else {
              // For other files (PDF, DOCX, XLSX), send to server for extraction
              const formDataUpload = new FormData();
              formDataUpload.append('file', file);
              try {
                const { extractFileTextAction } = await import('@/actions/file.actions');
                const extractResult = await extractFileTextAction(formDataUpload);
                if (extractResult.success && extractResult.data) {
                  fileTexts.push(extractResult.data);
                }
              } catch {
                // Extraction failed — continue without this file's text
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }

        const result = await createActaAction(zodResult.data, fileTexts);

        if (result.success) {
          onSuccess();
          onClose();
        } else {
          // Handle server-side field errors
          if (result.error?.fieldErrors) {
            const serverErrors: FieldErrors = {};
            const serverAttErrors: AttendeesErrors = {};

            for (const [key, message] of Object.entries(result.error.fieldErrors)) {
              // Check if it's an attendees row error (e.g., "asistentes.0.nombre")
              const attendeeMatch = key.match(/^asistentes\.(\d+)\.(\w+)$/);
              if (attendeeMatch) {
                const index = parseInt(attendeeMatch[1], 10);
                const field = attendeeMatch[2] as 'nombre' | 'cargo';
                if (!serverAttErrors[index]) serverAttErrors[index] = {};
                serverAttErrors[index][field] = message;
              } else {
                serverErrors[key as keyof FieldErrors] = message;
              }
            }

            setFieldErrors(serverErrors);
            setAttendeesErrors(serverAttErrors);
          }
          setGeneralError(result.error?.message || 'Ocurrió un error inesperado');
        }
      } catch {
        setGeneralError('Ocurrió un error inesperado. Intente nuevamente.');
      }
    });
  }

  const currentDate = getCurrentDateBogota();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Acta de Comité</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* AI Generation Overlay */}
        {isPending && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 rounded-lg">
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="relative">
                <svg className="h-16 w-16 animate-spin text-ucc-green" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">Generando acta con Inteligencia Artificial</p>
                <p className="text-sm text-gray-500 mt-1">Leyendo documentos adjuntos y redactando el desarrollo...</p>
                <p className="text-xs text-gray-400 mt-2">Este proceso puede tomar entre 10-30 segundos</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          {/* General error */}
          {generalError && (
            <div
              role="alert"
              className="rounded-lg p-3 text-sm font-medium border border-red-300 bg-red-50 text-red-800"
            >
              {generalError}
            </div>
          )}

          {/* Fecha (non-editable) */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">
              Fecha
            </label>
            <input
              type="text"
              value={currentDate}
              readOnly
              disabled
              className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm text-gray-700 cursor-not-allowed"
              aria-label="Fecha actual"
            />
          </div>

          {/* Tipo Comité */}
          <div className="space-y-1">
            <label htmlFor="tipoComite" className="block text-sm font-semibold text-gray-700">
              Tipo de Comité <span className="text-red-500">*</span>
            </label>
            <select
              id="tipoComite"
              value={tipoComite}
              onChange={(e) => setTipoComite(e.target.value)}
              disabled={isPending}
              aria-invalid={!!fieldErrors.tipoComite}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.tipoComite
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-300 focus:border-ucc-green'
              }`}
            >
              <option value="" disabled>Seleccione un tipo de comité</option>
              {TIPO_COMITE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {fieldErrors.tipoComite && (
              <p className="text-xs text-red-600">{fieldErrors.tipoComite}</p>
            )}
          </div>

          {/* Área/Programa */}
          <div className="space-y-1">
            <label htmlFor="areaPrograma" className="block text-sm font-semibold text-gray-700">
              Área / Programa <span className="text-red-500">*</span>
            </label>
            <select
              id="areaPrograma"
              value={areaPrograma}
              onChange={(e) => setAreaPrograma(e.target.value)}
              disabled={isPending}
              aria-invalid={!!fieldErrors.areaPrograma}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.areaPrograma
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-300 focus:border-ucc-green'
              }`}
            >
              <option value="" disabled>Seleccione un área/programa</option>
              {AREA_PROGRAMA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {fieldErrors.areaPrograma && (
              <p className="text-xs text-red-600">{fieldErrors.areaPrograma}</p>
            )}
          </div>

          {/* Orden del día */}
          <div className="space-y-1">
            <label htmlFor="ordenDia" className="block text-sm font-semibold text-gray-700">
              Orden del día <span className="text-red-500">*</span>
            </label>
            <textarea
              id="ordenDia"
              value={ordenDia}
              onChange={(e) => setOrdenDia(e.target.value)}
              disabled={isPending}
              maxLength={1200}
              rows={5}
              placeholder="Liste los puntos del orden del día que serán tratados en el comité."
              aria-invalid={!!fieldErrors.ordenDia}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 resize-y ${
                fieldErrors.ordenDia
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-300 focus:border-ucc-green'
              }`}
            />
            <div className="flex items-center justify-between">
              {fieldErrors.ordenDia ? (
                <p className="text-xs text-red-600">{fieldErrors.ordenDia}</p>
              ) : (
                <span />
              )}
              <p className={`text-xs ${ordenDia.length > 1200 ? 'text-red-600' : 'text-gray-500'}`}>
                {ordenDia.length}/1200
              </p>
            </div>
          </div>

          {/* Asistentes */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700">
              Asistentes <span className="text-red-500">*</span>
            </label>
            {fieldErrors.asistentes && (
              <p className="text-xs text-red-600 mb-2">{fieldErrors.asistentes}</p>
            )}
            <AttendeesTable
              value={asistentes}
              onChange={setAsistentes}
              errors={attendeesErrors}
            />
          </div>

          {/* Archivos Adjuntos (Soportes) */}
          <div className="space-y-1">
            <AttachmentManager onUploadStatusChange={setUploadInProgress} onFilesReady={setAttachedFiles} />
          </div>

          {/* Proyectó */}
          <div className="space-y-1">
            <label htmlFor="proyecto" className="block text-sm font-semibold text-gray-700">
              Proyectó <span className="text-red-500">*</span>
            </label>
            <input
              id="proyecto"
              type="text"
              value={proyecto}
              onChange={(e) => setProyecto(e.target.value)}
              disabled={isPending}
              maxLength={150}
              placeholder="Nombre de quien proyecta el acta"
              aria-invalid={!!fieldErrors.proyecto}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.proyecto
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-300 focus:border-ucc-green'
              }`}
            />
            {fieldErrors.proyecto && (
              <p className="text-xs text-red-600">{fieldErrors.proyecto}</p>
            )}
          </div>

          {/* Revisó */}
          <div className="space-y-1">
            <label htmlFor="reviso" className="block text-sm font-semibold text-gray-700">
              Revisó <span className="text-red-500">*</span>
            </label>
            <input
              id="reviso"
              type="text"
              value={reviso}
              onChange={(e) => setReviso(e.target.value)}
              disabled={isPending}
              maxLength={150}
              placeholder="Nombre de quien revisa el acta"
              aria-invalid={!!fieldErrors.reviso}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.reviso
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-300 focus:border-ucc-green'
              }`}
            />
            {fieldErrors.reviso && (
              <p className="text-xs text-red-600">{fieldErrors.reviso}</p>
            )}
          </div>

          {/* Copia (optional) */}
          <div className="space-y-1">
            <label htmlFor="copia" className="block text-sm font-semibold text-gray-700">
              Copia <span className="text-xs font-normal text-gray-500">(opcional)</span>
            </label>
            <input
              id="copia"
              type="text"
              value={copia}
              onChange={(e) => setCopia(e.target.value)}
              disabled={isPending}
              maxLength={300}
              placeholder="Destinatarios de copia"
              aria-invalid={!!fieldErrors.copia}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ucc-green/20 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                fieldErrors.copia
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-300 focus:border-ucc-green'
              }`}
            />
            {fieldErrors.copia && (
              <p className="text-xs text-red-600">{fieldErrors.copia}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || uploadInProgress}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-ucc-green rounded-lg hover:bg-ucc-green-dark transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generando acta con IA...
                </>
              ) : (
                'Crear Acta'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
