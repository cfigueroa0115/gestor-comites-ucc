import { NextResponse } from 'next/server';

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3-turbo';
const MAX_RETRIES = 2;

/**
 * POST /api/voice/transcribe
 *
 * Receives a complete audio file (webm from MediaRecorder stop/start cycle)
 * and returns transcribed text using Groq Whisper API.
 *
 * Includes retry logic for rate limiting (429 errors).
 */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ text: '', error: 'API_KEY_MISSING' });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json({ text: '', error: 'NO_AUDIO' });
    }

    // Skip files too small to contain speech
    if (audioFile.size < 1500) {
      return NextResponse.json({ text: '', error: 'TOO_SMALL' });
    }

    // Retry loop for rate limiting
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const whisperForm = new FormData();
      whisperForm.append('file', audioFile, 'recording.webm');
      whisperForm.append('model', WHISPER_MODEL);
      whisperForm.append('language', 'es');
      whisperForm.append('response_format', 'text');

      const response = await fetch(GROQ_WHISPER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: whisperForm,
      });

      if (response.ok) {
        const text = await response.text();
        return NextResponse.json({ text: text.trim() });
      }

      // Rate limited — wait and retry
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000;
        await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
        continue;
      }

      // Other error
      const errorText = await response.text();
      console.error(`[VoiceTranscribe] Whisper error (${response.status}):`, errorText.substring(0, 300));
      return NextResponse.json({
        text: '',
        error: `WHISPER_${response.status}`,
        detail: errorText.substring(0, 100),
      });
    }

    return NextResponse.json({ text: '', error: 'MAX_RETRIES_EXCEEDED' });
  } catch (error) {
    console.error('[VoiceTranscribe] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ text: '', error: 'NETWORK_ERROR' });
  }
}
