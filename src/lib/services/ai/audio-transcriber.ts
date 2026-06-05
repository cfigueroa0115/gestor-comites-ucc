/**
 * Audio/Video Transcription Service using Groq Whisper API.
 *
 * Transcribes audio from video/audio files (mp4, mp3, wav, etc.)
 * using Groq's Whisper Large v3 Turbo model — free with existing API key.
 */

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

/** Maximum file size for Whisper API (25MB per request) */
const MAX_WHISPER_SIZE = 25 * 1024 * 1024;

/**
 * Transcribes audio/video content to text using Groq Whisper.
 *
 * @param buffer - The audio/video file buffer
 * @param filename - Original filename (used for MIME detection)
 * @param mimeType - The MIME type of the file
 * @returns Transcribed text, or empty string if transcription fails
 */
export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    console.error('[AudioTranscriber] No AI_API_KEY configured');
    return '';
  }

  // Check file size - Whisper has 25MB limit per request
  if (buffer.length > MAX_WHISPER_SIZE) {
    console.warn(`[AudioTranscriber] File too large for Whisper (${(buffer.length / 1024 / 1024).toFixed(1)}MB > 25MB). Splitting not supported yet.`);
    // For files > 25MB, we can't transcribe directly
    // Return empty - the user should use the voice recording feature instead
    return '';
  }

  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('model', WHISPER_MODEL);
    formData.append('language', 'es');
    formData.append('response_format', 'text');

    const response = await fetch(GROQ_WHISPER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AudioTranscriber] Whisper API error (${response.status}):`, errorText.substring(0, 200));
      return '';
    }

    const text = await response.text();
    return text.trim();
  } catch (error) {
    console.error('[AudioTranscriber] Error:', error instanceof Error ? error.message : 'Unknown');
    return '';
  }
}

/**
 * Checks if a MIME type is an audio or video type that can be transcribed.
 */
export function isTranscribableMedia(mimeType: string): boolean {
  return (
    mimeType.startsWith('audio/') ||
    mimeType.startsWith('video/') ||
    mimeType === 'application/octet-stream' // Sometimes videos come as this
  );
}
