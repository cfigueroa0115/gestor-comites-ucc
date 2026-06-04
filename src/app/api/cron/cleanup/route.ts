import { NextResponse } from 'next/server';
import { cleanOldTranscriptions } from '@/actions/voice.actions';

/**
 * GET /api/cron/cleanup
 *
 * Cleans up voice transcriptions older than 20 days.
 * Can be triggered by Vercel Cron or manually.
 *
 * Protected by a simple authorization header check using CRON_SECRET.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await cleanOldTranscriptions();

  if (result.success) {
    return NextResponse.json({
      success: true,
      deletedCount: result.data?.deletedCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    { success: false, error: result.error?.message },
    { status: 500 },
  );
}
