'use server';

import { NextResponse } from 'next/server';

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

/**
 * POST /api/voice/transcribe
 *
 * Receives an audio chunk (webm/ogg from MediaRecorder) and returns
 * the transcribed text using Groq Whisper API.
 *
 * This enables real-time voice transcription by sending microphone
 * audio chunks to Whisper instead of relying on the unreliable
 * Web Speech API which stalls in Chrome.
 */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API key not configured' },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json(
        { error: 'No audio provided' },
        { status: 400 },
      );
    }

    // Skip very small files (likely silence or noise)
    if (audioFile.size < 1000) {
      return NextResponse.json({ text: '' });
    }

    // Send to Groq Whisper
    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, 'audio.webm');
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
      console.error(`[VoiceTranscribe] Whisper error (${response.status}):`, errorText.substring(0, 200));
      return NextResponse.json(
        { error: 'Transcription failed', text: '' },
        { status: 200 }, // Return 200 so client doesn't break
      );
    }

    const text = await response.text();
    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    console.error('[VoiceTranscribe] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ text: '' });
  }
}
