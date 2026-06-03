'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * BackButton - Elegant breadcrumb-style navigation.
 * Shows "← Volver al inicio" as a subtle inline link integrated into the page flow.
 */
export function BackButton() {
  const router = useRouter();

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-ucc-green hover:text-ucc-green-dark transition-colors duration-200"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Inicio
      </Link>
      <span className="text-gray-300">/</span>
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-ucc-green transition-colors duration-200"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
        </svg>
        Volver
      </button>
    </nav>
  );
}
