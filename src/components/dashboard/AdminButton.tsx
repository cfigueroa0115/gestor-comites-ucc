'use client';

import Link from 'next/link';

/**
 * Administration button with pulse animation.
 * Only rendered when the user has the Administrador role.
 *
 * Requirements:
 * - 4.5: Display administration button with repeating pulse animation for Administrador
 * - 4.6: Hide for non-admin users (handled by parent conditional render)
 * - 4.7: Navigate to User_Admin_Module (/admin/usuarios) on click
 */
export function AdminButton() {
  return (
    <div className="mb-6 flex justify-end">
      <Link
        href="/admin/usuarios"
        className="inline-flex items-center gap-2 px-5 py-3 bg-ucc-green text-white font-medium rounded-full shadow-card hover:bg-ucc-green-dark hover:shadow-card-hover transition-colors duration-300 animate-pulse"
      >
        {/* Gear/Settings icon */}
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
  );
}
