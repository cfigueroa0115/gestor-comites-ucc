'use server';

import { headers } from 'next/headers';
import { requireGestor } from '@/lib/auth/guards';
import { validateFile, getFileExtension } from '@/lib/validations/file.schema';
import { sanitizeFilename } from '@/lib/utils/sanitize';
import { getFileStorage } from '@/lib/services/file-storage.service';
import { auditLogger } from '@/lib/services/audit.service';
import { extractText, isUnsupportedMediaType } from '@/lib/services/ai/text-extractor';
import { prisma } from '@/lib/db/prisma';
import { DEFAULT_MAX_FILE_SIZE_MB, MEDIA_EXTENSIONS } from '@/lib/utils/constants';
import type { ActionResult } from '@/types';
import type { Attachment } from '@prisma/client';
import type { AllowedExtension } from '@/lib/utils/constants';

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

/**
 * Server Action: Upload a file attachment for an acta.
 *
 * Validation pipeline:
 * 1. Check file extension against the allowlist
 * 2. Sanitize the filename (remove path traversal, special chars)
 * 3. Verify MIME type matches the file extension
 * 4. Check file size against MAX_FILE_SIZE_MB environment variable
 *
 * On validation failure: reject the file with a specific error message,
 * keeping all other previously uploaded files unchanged.
 *
 * On success: store the file and create an Attachment record in the database.
 *
 * Validates: Requirements 7.2, 7.3, 7.6, 7.7, 7.8, 7.9, 13.6
 */
export async function uploadFileAction(
  formData: FormData,
): Promise<ActionResult<Attachment>> {
  // Require authenticated gestor or admin role
  const session = await requireGestor();

  // Extract form data fields
  const file = formData.get('file') as File | null;
  const actaId = formData.get('actaId') as string | null;

  // Basic presence validation
  if (!file || !(file instanceof File)) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'No se proporcionó un archivo válido.',
      },
    };
  }

  if (!actaId || typeof actaId !== 'string' || actaId.trim() === '') {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'No se proporcionó un ID de acta válido.',
      },
    };
  }

  // Get MAX_FILE_SIZE_MB from environment or use default
  const maxFileSizeMB = getMaxFileSizeMB();

  // Run validation pipeline: extension → sanitize → MIME → size
  const validationResult = validateFile(
    { name: file.name, size: file.size, type: file.type },
    maxFileSizeMB,
  );

  if (!validationResult.valid) {
    return {
      success: false,
      error: {
        code: getErrorCode(validationResult.error || ''),
        message: validationResult.error || 'Error de validación del archivo.',
      },
    };
  }

  // Sanitize the filename
  const sanitizedName = sanitizeFilename(file.name);
  const extension = getFileExtension(file.name);

  // Verify the acta exists
  const acta = await prisma.acta.findUnique({
    where: { id: actaId.trim() },
    select: { id: true },
  });

  if (!acta) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'El acta especificada no existe.',
      },
    };
  }

  // Build storage path: {actaId}/{timestamp}-{sanitizedFilename}
  const timestamp = Date.now();
  const storagePath = `${actaId}/${timestamp}-${sanitizedName}`;

  try {
    // Read file content as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store the file using the storage service
    const storage = getFileStorage();
    const storageResult = await storage.upload(buffer, storagePath, {
      originalName: sanitizedName,
      mimeType: file.type,
      extension,
      sizeBytes: file.size,
      actaId,
    });

    if (!storageResult.success) {
      return {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: storageResult.error || 'Error al almacenar el archivo.',
        },
      };
    }

    // Determine initial processing status based on file type
    const estadoProcesamiento = MEDIA_EXTENSIONS.includes(extension as AllowedExtension)
      ? 'no_soportado' as const
      : 'pendiente' as const;

    // Create Attachment record in the database
    const attachment = await prisma.attachment.create({
      data: {
        actaId,
        nombreArchivo: sanitizedName,
        tipoMime: file.type,
        extension,
        sizeBytes: file.size,
        storagePath: storageResult.storagePath,
        estadoCarga: 'completado',
        estadoProcesamiento,
      },
    });

    // Extract text from the file if it's a supported document type (not media)
    if (!isUnsupportedMediaType(file.type)) {
      try {
        const extractedText = await extractText(buffer, file.type, extension);
        if (extractedText && extractedText.trim().length > 0) {
          await prisma.attachment.update({
            where: { id: attachment.id },
            data: {
              textoExtraido: extractedText,
              estadoProcesamiento: 'completado',
            },
          });
        } else {
          await prisma.attachment.update({
            where: { id: attachment.id },
            data: { estadoProcesamiento: 'completado' },
          });
        }
      } catch {
        // Text extraction failure is non-critical — mark as error but don't fail the upload
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: {
            estadoProcesamiento: 'error',
            errorProcesamiento: 'No se pudo extraer texto del documento.',
          },
        });
      }
    }

    // Audit log (fire-and-forget, non-blocking)
    const ipAddress = await getClientIp();
    auditLogger.log({
      userId: session.userId,
      action: 'UPLOAD',
      entityType: 'attachment',
      entityId: attachment.id,
      metadataJson: {
        actaId,
        fileName: sanitizedName,
        fileSize: file.size,
        mimeType: file.type,
      },
      ipAddress,
    });

    return { success: true, data: attachment };
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Error al subir el archivo. Intente nuevamente.',
      },
    };
  }
}

/**
 * Server Action: Delete a file attachment.
 *
 * Removes the file from storage and deletes the Attachment record from the database.
 * Requires authenticated gestor or admin role.
 *
 * Validates: Requirements 7.5
 */
export async function deleteFileAction(
  id: string,
): Promise<ActionResult> {
  // Require authenticated gestor or admin role
  const session = await requireGestor();

  if (!id || typeof id !== 'string' || id.trim() === '') {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'No se proporcionó un ID de archivo válido.',
      },
    };
  }

  try {
    // Find the attachment record
    const attachment = await prisma.attachment.findUnique({
      where: { id: id.trim() },
    });

    if (!attachment) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'El archivo no fue encontrado.',
        },
      };
    }

    // Delete from storage
    const storage = getFileStorage();
    await storage.delete(attachment.storagePath);

    // Delete the database record
    await prisma.attachment.delete({
      where: { id: attachment.id },
    });

    // Audit log (fire-and-forget, non-blocking)
    const ipAddress = await getClientIp();
    auditLogger.log({
      userId: session.userId,
      action: 'FILE_DELETE',
      entityType: 'attachment',
      entityId: attachment.id,
      metadataJson: {
        actaId: attachment.actaId,
        fileName: attachment.nombreArchivo,
        storagePath: attachment.storagePath,
      },
      ipAddress,
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al eliminar el archivo. Intente nuevamente.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gets the maximum file size in MB from environment variable or default.
 */
function getMaxFileSizeMB(): number {
  const envValue = process.env.MAX_FILE_SIZE_MB;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_MAX_FILE_SIZE_MB;
}

/**
 * Maps validation error messages to appropriate error codes.
 */
function getErrorCode(errorMessage: string): 'INVALID_FILE_TYPE' | 'MIME_MISMATCH' | 'FILE_TOO_LARGE' | 'VALIDATION_ERROR' {
  if (errorMessage.includes('extensión') && errorMessage.includes('no está permitida')) {
    return 'INVALID_FILE_TYPE';
  }
  if (errorMessage.includes('no tiene extensión')) {
    return 'INVALID_FILE_TYPE';
  }
  if (errorMessage.includes('tipo de contenido')) {
    return 'MIME_MISMATCH';
  }
  if (errorMessage.includes('tamaño máximo')) {
    return 'FILE_TOO_LARGE';
  }
  return 'VALIDATION_ERROR';
}
