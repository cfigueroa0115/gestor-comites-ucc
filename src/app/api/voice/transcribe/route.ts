import { NextResponse } from 'next/server';

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

/**
 * POST /api/voice/transcribe
 *
 * Receives an audio file (complete webm from MediaRecorder stop/start cycle)
 * and returns transcribed text using Groq Whisper API.
 */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API key not configured', text: '' },
        { status: 200 },
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json({ text: '' });
    }

    // Skip files that are too small to contain speech (< 2KB)
    if (audioFile.size < 2000) {
      return NextResponse.json({ text: '' });
    }

    // Send to Groq Whisper
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VoiceTranscribe] Whisper error (${response.status}):`, errorText.substring(0, 300));
      return NextResponse.json({ text: '', error: errorText.substring(0, 100) });
    }

    const text = await response.text();
    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    console.error('[VoiceTranscribe] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ text: '' });
  }
}
