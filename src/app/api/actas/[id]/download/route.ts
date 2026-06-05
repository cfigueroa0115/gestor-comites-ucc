import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { documentService } from '@/lib/services/document.service';
import { auditLogger } from '@/lib/services/audit.service';
import type { SessionData, ActaDocxData } from '@/types';
import { sessionOptions } from '@/lib/auth/session';

/**
 * Authenticated document download API route for acta .docx files.
 *
 * Regenerates the .docx on-the-fly from the data stored in the database.
 * This approach works on Vercel's ephemeral filesystem since it doesn't
 * depend on previously stored files in /tmp.
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

  // 4. Verify the acta has generated content
  if (!acta.desarrolloGenerado) {
    return NextResponse.json(
      { error: 'El acta aún no tiene contenido generado.' },
      { status: 404 }
    );
  }

  try {
    // 5. Build the document data from the acta record
    const asistentes = Array.isArray(acta.asistentesJson)
      ? (acta.asistentesJson as { nombre: string; cargo: string }[])
      : [];

    const docxData: ActaDocxData = {
      numeroActa: acta.numeroActa,
      ciudadFecha: `${acta.ciudad}, ${formatDateSpanish(acta.fechaGeneracion)}`,
      hora: acta.horaInicio || '',
      lugar: acta.lugar || 'Facultad de Ingeniería',
      asistentes,
      ordenDia: acta.ordenDia,
      desarrollo: acta.desarrolloGenerado,
      proyecto: acta.proyecto,
      reviso: acta.reviso,
      copia: acta.copia || undefined,
    };

    // 6. Generate the .docx document on-the-fly
    // Determine template based on committee type
    const { COMMITTEE_PREFIXES } = await import('@/lib/utils/constants');
    const prefix = COMMITTEE_PREFIXES[acta.tipoComite as keyof typeof COMMITTEE_PREFIXES] || 'CUR';
    const generatedDoc = await documentService.generateActaDocx(docxData, prefix);

    // 7. Update Estado_Acta to 'Descargada'
    await prisma.acta.update({
      where: { id },
      data: { estado: 'Descargada' },
    });

    // 8. Audit log the download (fire-and-forget)
    const ip = request.headers.get('x-forwarded-for')
      || request.headers.get('x-real-ip')
      || '0.0.0.0';

    auditLogger.log({
      userId: session.userId,
      action: 'DOWNLOAD',
      entityType: 'acta',
      entityId: acta.id,
      metadataJson: {
        filename: acta.docxFilename || acta.numeroActa + '.docx',
        numeroActa: acta.numeroActa,
        timestamp: new Date().toISOString(),
      },
      ipAddress: ip.split(',')[0].trim(),
    });

    // 9. Return the generated document as download
    const filename = acta.docxFilename || `${acta.numeroActa}.docx`;

    return new Response(new Uint8Array(generatedDoc.buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(generatedDoc.size),
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error(`[API/actas/${id}/download] Error generating document:`, error);

    return NextResponse.json(
      { error: 'No se pudo generar el documento. Verifique que la plantilla institucional esté configurada.' },
      { status: 500 }
    );
  }
}

/**
 * Formats a date as "DD de [month in Spanish] de YYYY"
 */
function formatDateSpanish(date: Date): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const d = new Date(date);
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}
