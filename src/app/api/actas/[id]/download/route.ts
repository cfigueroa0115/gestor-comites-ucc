import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { getFileStorage } from '@/lib/services/file-storage.service';
import { auditLogger } from '@/lib/services/audit.service';
import type { SessionData } from '@/types';
import { sessionOptions } from '@/lib/auth/session';

/**
 * Authenticated document download API route for acta .docx files.
 *
 * Flow:
 * 1. Verify session authentication
 * 2. Fetch acta record and verify docx exists
 * 3. Stream the .docx file with proper Content-Type and Content-Disposition
 * 4. Update Estado_Acta to 'Descargada'
 * 5. Audit log the download (user, filename, timestamp)
 *
 * Validates: Requirements 9.5, 9.6
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
      { error: 'No autenticado. Debe iniciar sesión para descargar documentos.' },
      { status: 401 }
    );
  }

  // 2. Get the acta ID from route params
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { error: 'ID de acta no válido.' },
      { status: 400 }
    );
  }

  // 3. Fetch acta record from database
  const acta = await prisma.acta.findUnique({
    where: { id },
  });

  if (!acta) {
    return NextResponse.json(
      { error: 'Acta no encontrada.' },
      { status: 404 }
    );
  }

  // 4. Verify the acta has a generated document
  if (!acta.docxPath || !acta.docxFilename) {
    return NextResponse.json(
      { error: 'El documento aún no ha sido generado para esta acta.' },
      { status: 404 }
    );
  }

  // 5. Stream the file from storage
  try {
    const storage = getFileStorage();
    const stream = await storage.getStream(acta.docxPath);

    // 6. Update Estado_Acta to 'Descargada'
    await prisma.acta.update({
      where: { id },
      data: { estado: 'Descargada' },
    });

    // 7. Audit log the download (fire-and-forget)
    const ip = request.headers.get('x-forwarded-for')
      || request.headers.get('x-real-ip')
      || '0.0.0.0';

    auditLogger.log({
      userId: session.userId,
      action: 'DOWNLOAD',
      entityType: 'acta',
      entityId: acta.id,
      metadataJson: {
        filename: acta.docxFilename,
        numeroActa: acta.numeroActa,
        timestamp: new Date().toISOString(),
      },
      ipAddress: ip.split(',')[0].trim(),
    });

    // 8. Set response headers for .docx download
    const headers = new Headers();
    headers.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    headers.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(acta.docxFilename)}"`
    );
    headers.set('Cache-Control', 'private, no-cache');

    return new Response(stream, { headers });
  } catch (error) {
    console.error(`[API/actas/${id}/download] Error streaming document:`, error);

    return NextResponse.json(
      { error: 'No se pudo recuperar el documento del almacenamiento.' },
      { status: 500 }
    );
  }
}
