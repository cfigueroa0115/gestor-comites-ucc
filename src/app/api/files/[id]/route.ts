import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { getFileStorage } from '@/lib/services/file-storage.service';
import type { SessionData } from '@/types';
import { sessionOptions } from '@/lib/auth/session';

/**
 * Authenticated file serving API route.
 * Verifies the user has a valid session before streaming the file.
 * Files are stored outside the public directory for security (Requirement 13.7).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify session authentication
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, {
    password: process.env.SESSION_SECRET as string,
    cookieName: sessionOptions.cookieName,
    cookieOptions: sessionOptions.cookieOptions,
  });

  if (!session.userId) {
    return NextResponse.json(
      { error: 'No autenticado. Debe iniciar sesión para acceder a este recurso.' },
      { status: 401 }
    );
  }

  // 2. Get the attachment ID from route params
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { error: 'ID de archivo no válido.' },
      { status: 400 }
    );
  }

  // 3. Fetch file metadata from database
  const attachment = await prisma.attachment.findUnique({
    where: { id },
  });

  if (!attachment) {
    return NextResponse.json(
      { error: 'Archivo no encontrado.' },
      { status: 404 }
    );
  }

  // 4. Stream file from storage
  try {
    const storage = getFileStorage();
    const stream = await storage.getStream(attachment.storagePath);

    // 5. Set response headers based on attachment metadata
    const headers = new Headers();
    headers.set('Content-Type', attachment.tipoMime);
    headers.set(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.nombreArchivo)}"`
    );
    headers.set('Content-Length', String(attachment.sizeBytes));
    headers.set('Cache-Control', 'private, no-cache');

    return new Response(stream, { headers });
  } catch (error) {
    // File not found on storage (deleted externally, storage error, etc.)
    console.error(`[API/files/${id}] Error streaming file:`, error);

    return NextResponse.json(
      { error: 'No se pudo recuperar el archivo del almacenamiento.' },
      { status: 404 }
    );
  }
}
