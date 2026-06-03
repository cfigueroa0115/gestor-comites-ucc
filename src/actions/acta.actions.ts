'use server';

import { headers } from 'next/headers';
import { requireAuth, requireGestor } from '@/lib/auth/guards';
import { actaFormSchema, type ActaFormInput } from '@/lib/validations/acta.schema';
import { listActas, type ActaFilters, type PaginatedActas } from '@/lib/services/acta.service';
import { prisma } from '@/lib/db/prisma';
import { auditLogger } from '@/lib/services/audit.service';
import { COMMITTEE_PREFIXES, APP_TIMEZONE } from '@/lib/utils/constants';
import { sequenceService } from '@/lib/services/sequence.service';
import { generateActaContentFromForm } from '@/lib/services/ai';
import { documentService } from '@/lib/services/document.service';
import { getFileStorage } from '@/lib/services/file-storage.service';
import { generateActaFilename } from '@/lib/utils/filename';
import { sanitizeInput } from '@/lib/utils/sanitize';
import type { ActionResult, ActaDocxData, ActaGenerationInput } from '@/types';
import type { Acta } from '@prisma/client';

/**
 * Attempts to extract the client IP address from request headers.
 * Falls back to '0.0.0.0' if unavailable.
 */
async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = headersList.get('x-real-ip');
    if (realIp) return realIp.trim();
  } catch {
    // headers() may not be available in all contexts
  }
  return '0.0.0.0';
}

// ---------------------------------------------------------------------------
// Spanish month names for ciudadFecha formatting
// ---------------------------------------------------------------------------

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Formats the current date as "Bogotá D.C., [day] de [month in Spanish] de [year]"
 * using America/Bogota timezone.
 */
function formatCiudadFecha(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(now);
  const day = parts.find(p => p.type === 'day')?.value ?? '1';
  const monthNum = parseInt(parts.find(p => p.type === 'month')?.value ?? '1', 10);
  const year = parts.find(p => p.type === 'year')?.value ?? String(now.getFullYear());

  const monthName = SPANISH_MONTHS[monthNum - 1] ?? 'enero';

  return `Bogotá D.C., ${day} de ${monthName} de ${year}`;
}

/**
 * Gets the current hour formatted as "HH:mm" in America/Bogota timezone.
 */
function getCurrentHourBogota(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(now);
}

/**
 * Gets the current year in America/Bogota timezone.
 */
function getCurrentYearBogota(): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
  });
  return parseInt(formatter.format(now), 10);
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Server Action: List actas with pagination and optional filters.
 *
 * Requires an authenticated session (any role can view actas).
 * Returns paginated actas sorted by fecha_generacion DESC.
 *
 * Validates: Requirements 5.2, 5.3
 */
export async function listActasAction(
  filters: ActaFilters = {},
  page: number = 1,
): Promise<ActionResult<PaginatedActas>> {
  await requireAuth();

  try {
    const result = await listActas(filters, page);
    return result;
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener las actas.',
      },
    };
  }
}

/**
 * Server Action: Create a new acta with the full generation pipeline.
 *
 * Pipeline:
 * 1. Validate input with Zod schema
 * 2. Create acta record with estado='En_procesamiento'
 * 3. Call sequenceService.getNextNumber() for the real numero_acta
 * 4. Call generateActaContentFromForm (AI orchestrator) for the desarrollo
 * 5. Call documentService.generateActaDocx() with ActaDocxData
 * 6. Store the .docx via file storage service
 * 7. Update the acta with: numeroActa, secuencia, estado='Generada', docxPath, docxFilename, desarrolloGenerado
 * 8. On any failure in steps 3-7: set estado='Error_generacion' and return error
 *
 * Requires Usuario_Gestor or Administrador role.
 *
 * Validates: Requirements 6.10, 8.7, 9.5, 9.7
 */
export async function createActaAction(
  formData: ActaFormInput,
  fileTexts?: string[],
): Promise<ActionResult<{ actaId: string }>> {
  // Require gestor or admin role
  const session = await requireGestor();

  // Step 0: Sanitize string inputs before validation (Req 13.4)
  const sanitizedFormData: ActaFormInput = {
    ...formData,
    ordenDia: sanitizeInput(formData.ordenDia),
    proyecto: sanitizeInput(formData.proyecto),
    reviso: sanitizeInput(formData.reviso),
    copia: formData.copia ? sanitizeInput(formData.copia) : undefined,
    asistentes: formData.asistentes.map((a) => ({
      nombre: sanitizeInput(a.nombre),
      cargo: sanitizeInput(a.cargo),
    })),
  };

  // Step 1: Validate input
  const parsed = actaFormSchema.safeParse(sanitizedFormData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos del formulario no son válidos.',
        fieldErrors,
      },
    };
  }

  const data = parsed.data;

  // Step 2: Create acta record with estado='En_procesamiento'
  // Use a temporary placeholder for numero_acta (unique constraint)
  const tempNumeroActa = `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const currentYear = getCurrentYearBogota();

  let acta: Acta;
  try {
    acta = await prisma.acta.create({
      data: {
        numeroActa: tempNumeroActa,
        secuencia: 0,
        anio: currentYear,
        fechaGeneracion: new Date(),
        ciudad: 'Bogotá D.C.',
        horaInicio: getCurrentHourBogota(),
        lugar: 'Facultad de Ingeniería',
        tipoComite: data.tipoComite,
        areaPrograma: data.areaPrograma,
        ordenDia: data.ordenDia,
        asistentesJson: data.asistentes,
        elaboradoPorUsuarioId: session.userId,
        elaboradoPorNombre: session.nombreCompleto,
        elaboradoPorCargo: session.cargo,
        proyecto: data.proyecto,
        reviso: data.reviso,
        copia: data.copia ?? null,
        estado: 'En_procesamiento',
      },
    });
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al crear el registro del acta.',
      },
    };
  }

  // Steps 3-7: Generation pipeline (sequence → AI → docx → store → update)
  // On any failure, set estado='Error_generacion'
  try {
    // Step 3: Get sequential number
    const committeePrefix = COMMITTEE_PREFIXES[data.tipoComite as keyof typeof COMMITTEE_PREFIXES];
    if (!committeePrefix) {
      throw new Error(`Tipo de comité no reconocido: ${data.tipoComite}`);
    }

    const seqResult = await sequenceService.getNextNumber(committeePrefix, currentYear);
    if (!seqResult.success) {
      throw new Error(seqResult.error ?? 'Error al generar número secuencial.');
    }

    // Step 4: Generate desarrollo content using AI orchestrator
    const aiInput: ActaGenerationInput = {
      ordenDia: data.ordenDia,
      asistentes: data.asistentes,
      attachmentTexts: [],
      tipoComite: data.tipoComite as ActaGenerationInput['tipoComite'],
      areaPrograma: data.areaPrograma,
    };

    // Fetch any extracted texts from existing attachments linked to this acta
    const attachments = await prisma.attachment.findMany({
      where: { actaId: acta.id, estadoProcesamiento: 'completado' },
      select: { textoExtraido: true },
    });
    const dbTexts = attachments
      .map(a => a.textoExtraido)
      .filter((t): t is string => t != null && t.trim().length > 0);

    // Combine DB texts with any pre-extracted texts passed from the form (local uploads)
    const inlineTexts = (fileTexts || []).filter(t => t.trim().length > 0);
    aiInput.attachmentTexts = [...dbTexts, ...inlineTexts];

    const aiResult = await generateActaContentFromForm(aiInput);
    if (!aiResult.success) {
      throw new Error(aiResult.error ?? 'Error en la generación de contenido con IA.');
    }

    // Step 5: Generate DOCX document
    const ciudadFecha = formatCiudadFecha();
    const hora = getCurrentHourBogota();

    const docxData: ActaDocxData = {
      numeroActa: seqResult.numero,
      ciudadFecha,
      hora,
      lugar: 'Facultad de Ingeniería',
      asistentes: data.asistentes,
      ordenDia: data.ordenDia,
      desarrollo: aiResult.desarrollo,
      proyecto: data.proyecto,
      reviso: data.reviso,
      copia: data.copia,
    };

    const generatedDoc = await documentService.generateActaDocx(docxData);

    // Generate the proper output filename
    const docxFilename = generateActaFilename(
      committeePrefix,
      currentYear,
      seqResult.secuencia,
      data.tipoComite,
      data.areaPrograma,
    );

    // Step 6: Store the generated .docx via file storage service
    const fileStorage = getFileStorage();
    const storageResult = await fileStorage.upload(
      generatedDoc.buffer,
      `actas/${docxFilename}`,
      {
        originalName: docxFilename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: '.docx',
        sizeBytes: generatedDoc.size,
        actaId: acta.id,
      },
    );

    if (!storageResult.success) {
      throw new Error(storageResult.error ?? 'Error al almacenar el documento generado.');
    }

    // Step 7: Update acta record with all generated data
    await prisma.acta.update({
      where: { id: acta.id },
      data: {
        numeroActa: seqResult.numero,
        secuencia: seqResult.secuencia,
        anio: seqResult.anio,
        estado: 'Generada',
        desarrolloGenerado: aiResult.desarrollo,
        docxPath: storageResult.storagePath,
        docxFilename: docxFilename,
      },
    });

    // Audit log acta creation (fire-and-forget)
    const ipAddress = await getClientIp();
    auditLogger.log({
      userId: session.userId,
      action: 'CREATE',
      entityType: 'acta',
      entityId: acta.id,
      metadataJson: {
        numeroActa: seqResult.numero,
        tipoComite: data.tipoComite,
        areaPrograma: data.areaPrograma,
        docxFilename,
      },
      ipAddress,
    });

    // Audit log document generation (fire-and-forget)
    auditLogger.log({
      userId: session.userId,
      action: 'GENERATE',
      entityType: 'acta',
      entityId: acta.id,
      metadataJson: {
        numeroActa: seqResult.numero,
        aiProvider: aiResult.provider,
        docxFilename,
      },
      ipAddress,
    });

    return {
      success: true,
      data: { actaId: acta.id },
    };
  } catch (error) {
    // On any failure in steps 3-7: set estado='Error_generacion'
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido en la generación del acta.';

    try {
      await prisma.acta.update({
        where: { id: acta.id },
        data: {
          estado: 'Error_generacion',
        },
      });
    } catch {
      // If even the status update fails, we still return the error
    }

    return {
      success: false,
      error: {
        code: 'GENERATION_FAILED',
        message: errorMessage,
      },
    };
  }
}
