'use server';

import { prisma } from '@/lib/db/prisma';
import type { ActionResult } from '@/types';

/**
 * Saves a voice transcription chunk to the database.
 */
export async function saveTranscriptionAction(
  sessionId: string,
  texto: string,
  duracion?: number,
): Promise<ActionResult<{ id: string }>> {
  if (!sessionId || !texto.trim()) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'sessionId y texto son requeridos.',
      },
    };
  }

  try {
    const record = await prisma.voiceTranscription.create({
      data: {
        sessionId,
        texto: texto.trim(),
        duracion: duracion ?? 0,
      },
    });

    return {
      success: true,
      data: { id: record.id },
    };
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al guardar la transcripción.',
      },
    };
  }
}

/**
 * Retrieves all transcriptions for a given session, ordered by creation time.
 */
export async function getTranscriptionsBySession(
  sessionId: string,
): Promise<ActionResult<{ transcriptions: { id: string; texto: string; duracion: number | null; createdAt: Date }[] }>> {
  if (!sessionId) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'sessionId es requerido.',
      },
    };
  }

  try {
    const transcriptions = await prisma.voiceTranscription.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        texto: true,
        duracion: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: { transcriptions },
    };
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener las transcripciones.',
      },
    };
  }
}

/**
 * Deletes transcriptions older than 20 days.
 * Intended to be called from a cron job.
 */
export async function cleanOldTranscriptions(): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

    const result = await prisma.voiceTranscription.deleteMany({
      where: {
        createdAt: { lt: twentyDaysAgo },
      },
    });

    return {
      success: true,
      data: { deletedCount: result.count },
    };
  } catch {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al limpiar transcripciones antiguas.',
      },
    };
  }
}
