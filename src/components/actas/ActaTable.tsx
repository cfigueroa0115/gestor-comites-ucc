'use client';

import { useState, useTransition } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { listActasAction } from '@/actions/acta.actions';
import type { PaginatedActas, ActaWithElaboradoPor } from '@/lib/services/acta.service';
import type { Rol, EstadoActa } from '@/types';
import { ROLE_PERMISSIONS } from '@/lib/utils/constants';

interface ActaTableProps {
  initialData: PaginatedActas;
  userRole: Rol;
}

/**
 * Formats a Date to dd/mm/yyyy string.
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * ActaTable – Client component for displaying the paginated acta list.
 *
 * Features:
 * - Max 10 rows per page, sorted by fecha_generacion DESC
 * - Columns: estado badge, número acta, fecha generación, tipo comité,
 *   área/programa, usuario que generó, estado texto, acciones
 * - Role-based action buttons visibility
 * - Pagination controls
 *
 * Validates: Requirements 5.1, 5.3, 5.5, 5.6, 5.8
 */
export function ActaTable({ initialData, userRole }: ActaTableProps) {
  const [data, setData] = useState<PaginatedActas>(initialData);
  const [isPending, startTransition] = useTransition();
  const [detailActa, setDetailActa] = useState<ActaWithElaboradoPor | null>(null);

  const permissions = ROLE_PERMISSIONS[userRole];

  function goToPage(page: number) {
    startTransition(async () => {
      const result = await listActasAction({}, page);
      if (result.success && result.data) {
        setData(result.data);
      }
    });
  }

  /**
   * Formats the estado enum value to a human-readable text label.
   */
  function formatEstadoText(estado: EstadoActa): string {
    const map: Record<EstadoActa, string> = {
      Borrador: 'Borrador',
      Generada: 'Generada',
      Descargada: 'Descargada',
      Error_generacion: 'Error generación',
      En_procesamiento: 'En procesamiento',
    };
    return map[estado] || estado;
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-card">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Número Acta
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Fecha Generación
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tipo Comité
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Área/Programa
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Generó
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
            {data.actas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                  No se encontraron resultados para los criterios seleccionados.
                </td>
              </tr>
            ) : (
              data.actas.map((acta: ActaWithElaboradoPor) => (
                <tr key={acta.id} className="hover:bg-gray-50 transition-colors duration-150">
                  {/* Estado Badge */}
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge estado={acta.estado} />
                  </td>

                  {/* Número Acta */}
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {acta.numeroActa}
                  </td>

                  {/* Fecha Generación (dd/mm/yyyy) */}
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDate(acta.fechaGeneracion)}
                  </td>

                  {/* Tipo Comité */}
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {acta.tipoComite}
                  </td>

                  {/* Área/Programa */}
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {acta.areaPrograma}
                  </td>

                  {/* Usuario que Generó */}
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {acta.elaboradoPor.nombreCompleto}
                  </td>

                  {/* Estado Texto */}
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatEstadoText(acta.estado)}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      {/* Ver detalle - opens modal with desarrollo content */}
                      <button
                        type="button"
                        onClick={() => setDetailActa(acta)}
                        className="inline-flex items-center p-1.5 rounded-md text-gray-500 hover:text-ucc-green hover:bg-ucc-green-light transition-colors duration-200"
                        title="Ver detalle"
                        aria-label={`Ver detalle acta ${acta.numeroActa}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      {/* Descargar - downloads the .docx file */}
                      {permissions.downloadActa && (
                        <a
                          href={`/api/actas/${acta.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
                          title="Descargar Word"
                          aria-label={`Descargar acta ${acta.numeroActa}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      )}

                      {/* Consultar soportes */}
                      <button
                        type="button"
                        onClick={() => setDetailActa(acta)}
                        className="inline-flex items-center p-1.5 rounded-md text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors duration-200"
                        title="Consultar soportes"
                        aria-label={`Consultar soportes acta ${acta.numeroActa}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>

                      {/* Ver estado */}
                      <button
                        type="button"
                        onClick={() => setDetailActa(acta)}
                        className="inline-flex items-center p-1.5 rounded-md text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors duration-200"
                        title="Ver estado"
                        aria-label={`Ver estado acta ${acta.numeroActa}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </button>

                      {/* Reintentar generación - only for Error_generacion estado, hidden for Consulta */}
                      {acta.estado === 'Error_generacion' && permissions.retryGeneration && (
                        <button
                          type="button"
                          className="inline-flex items-center p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
                          title="Reintentar generación"
                          aria-label={`Reintentar generación acta ${acta.numeroActa}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
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
            Página {data.page} de {data.totalPages} ({data.total} acta{data.total !== 1 ? 's' : ''})
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
            <span className="text-sm text-gray-700">Cargando...</span>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailActa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {detailActa.numeroActa}
              </h2>
              <button
                type="button"
                onClick={() => setDetailActa(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold text-gray-700">Estado:</span> <StatusBadge estado={detailActa.estado} /></div>
                <div><span className="font-semibold text-gray-700">Fecha:</span> {formatDate(detailActa.fechaGeneracion)}</div>
                <div><span className="font-semibold text-gray-700">Tipo comité:</span> {detailActa.tipoComite}</div>
                <div><span className="font-semibold text-gray-700">Área/Programa:</span> {detailActa.areaPrograma}</div>
                <div><span className="font-semibold text-gray-700">Elaboró:</span> {detailActa.elaboradoPorNombre}</div>
                <div><span className="font-semibold text-gray-700">Ciudad:</span> {detailActa.ciudad}</div>
              </div>

              {/* Orden del día */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Orden del día</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 rounded p-3">{detailActa.ordenDia}</p>
              </div>

              {/* Desarrollo generado */}
              {detailActa.desarrolloGenerado && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Desarrollo de la sesión (generado por IA)</h3>
                  <div className="text-sm text-gray-600 whitespace-pre-line bg-green-50 border border-green-200 rounded p-3 max-h-80 overflow-y-auto">
                    {detailActa.desarrolloGenerado}
                  </div>
                </div>
              )}

              {/* Download button */}
              {detailActa.docxFilename && permissions.downloadActa && (
                <div className="pt-4 border-t">
                  <a
                    href={`/api/actas/${detailActa.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar documento Word ({detailActa.docxFilename})
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailActa(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
