'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Rol } from '@/types';
import { AdminButton } from '@/components/dashboard/AdminButton';

interface DashboardContentProps {
  rol: Rol;
  nombreCompleto: string;
}

interface ModuleCard {
  title: string;
  description: string;
  href: string | null;
  icon: React.ReactNode;
}

const MODULE_CARDS: ModuleCard[] = [
  {
    title: 'Gestionar actas',
    description: 'Genere, consulte, descargue y controle el estado de las actas de comité',
    href: '/actas',
    icon: (
      <svg className="w-8 h-8 text-ucc-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Gestionar solicitudes',
    description: 'Administre solicitudes asociadas a los diferentes comités académicos',
    href: null,
    icon: (
      <svg className="w-8 h-8 text-ucc-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    title: 'Gestionar otras',
    description: 'Acceda a funcionalidades complementarias de gestión y seguimiento',
    href: null,
    icon: (
      <svg className="w-8 h-8 text-ucc-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
];

/**
 * DashboardContent client component.
 * Renders module cards and the role-based administration button.
 * Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8.
 */
export function DashboardContent({ rol }: DashboardContentProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {/* Admin button - only visible for Administrador role (Req 4.5, 4.6, 4.7) */}
      {rol === 'Administrador' && <AdminButton />}

      {/* Module Cards (Req 4.2, 4.3, 4.4, 4.8) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MODULE_CARDS.map((card) => (
          <div key={card.title}>
            {card.href ? (
              <Link
                href={card.href}
                className="block bg-white rounded-institutional p-6 shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-4 mb-3">
                  {card.icon}
                  <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
                </div>
                <p className="text-sm text-gray-600">{card.description}</p>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="block w-full text-left bg-white rounded-institutional p-6 shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-4 mb-3">
                  {card.icon}
                  <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
                </div>
                <p className="text-sm text-gray-600">{card.description}</p>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* "Módulo en construcción" modal (Req 4.4) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-institutional p-6 max-w-sm mx-4 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Módulo en construcción
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Este módulo se encuentra en desarrollo y estará disponible próximamente.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-full px-4 py-2 bg-ucc-green text-white rounded-institutional font-medium hover:bg-ucc-green-dark transition-colors duration-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
