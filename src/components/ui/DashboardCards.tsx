'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Rol } from '@/types';

interface DashboardCardsProps {
  userRole: Rol;
}

interface ModuleCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  showModal?: boolean;
}

const modules: ModuleCard[] = [
  {
    title: 'Gestionar actas',
    description:
      'Genere, consulte, descargue y controle el estado de las actas de comité',
    icon: (
      <svg
        className="w-10 h-10 text-ucc-green"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    href: '/actas',
  },
  {
    title: 'Gestionar solicitudes',
    description:
      'Administre solicitudes asociadas a los diferentes comités académicos',
    icon: (
      <svg
        className="w-10 h-10 text-ucc-green"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
    showModal: true,
  },
  {
    title: 'Gestionar otras',
    description:
      'Acceda a funcionalidades complementarias de gestión y seguimiento',
    icon: (
      <svg
        className="w-10 h-10 text-ucc-green"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
    showModal: true,
  },
];

export function DashboardCards({ userRole }: DashboardCardsProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {modules.map((mod) => {
          if (mod.href) {
            return (
              <Link
                key={mod.title}
                href={mod.href}
                className="block rounded-institutional bg-white p-6 shadow-card transition-all duration-300 hover:scale-105 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-ucc-green"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  {mod.icon}
                  <h2 className="text-lg font-semibold text-gray-900">
                    {mod.title}
                  </h2>
                  <p className="text-sm text-gray-600">{mod.description}</p>
                </div>
              </Link>
            );
          }

          return (
            <button
              key={mod.title}
              type="button"
              onClick={() => setModalOpen(true)}
              className="block w-full rounded-institutional bg-white p-6 shadow-card transition-all duration-300 hover:scale-105 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-ucc-green cursor-pointer"
            >
              <div className="flex flex-col items-center text-center gap-4">
                {mod.icon}
                <h2 className="text-lg font-semibold text-gray-900">
                  {mod.title}
                </h2>
                <p className="text-sm text-gray-600">{mod.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Admin button - only visible to Administrador */}
      {userRole === 'Administrador' && (
        <div className="mt-10 flex justify-center">
          <Link
            href="/admin/usuarios"
            className="inline-flex items-center gap-2 rounded-institutional bg-ucc-green px-6 py-3 text-white font-medium shadow-card transition-all duration-300 hover:bg-ucc-green-dark hover:shadow-card-hover animate-pulse"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Administración
          </Link>
        </div>
      )}

      {/* "Módulo en construcción" Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="bg-white rounded-institutional p-8 shadow-card-hover max-w-sm w-full mx-4 text-center">
            <h2
              id="modal-title"
              className="text-xl font-semibold text-gray-900 mb-4"
            >
              Módulo en construcción
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Este módulo se encuentra actualmente en desarrollo. Estará
              disponible próximamente.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-institutional bg-ucc-green px-6 py-2 text-white font-medium transition-all duration-300 hover:bg-ucc-green-dark focus:outline-none focus:ring-2 focus:ring-ucc-green"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
