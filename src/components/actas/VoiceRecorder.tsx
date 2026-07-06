'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VoiceRecorderProps {
  onSave: (text: string, durationSeconds: number) => Promise<void>;
  onFinish: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * VoiceRecorder - Real-time voice transcription using MediaRecorder + Groq Whisper.
 *
 * Architecture:
 * - MediaRecorder captures audio in 3-second chunks
 * - Each chunk is sent IMMEDIATELY to /api/voice/transcribe (Whisper)
 * - Whisper returns text in ~1-2 seconds per chunk
 * - Text appears progressively as each chunk is transcribed
 * - Multiple chunks are processed IN PARALLEL for speed
 * - On save, all accumulated text is stored to DB
 *
 * This eliminates Web Speech API entirely — no more freezing/stalling.
 * Trade-off: ~3-4 second latency before first text appears (Whisper processing)
 * but NEVER freezes and transcription quality is far superior.
 */
export function VoiceRecorder({ onSave, onFinish }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [savedSegments, setSavedSegments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTranscriptions, setActiveTranscriptions] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textRef = useRef('');
  const isRecordingRef = useRef(false);
  const chunkIndexRef = useRef(0);
  const transcribedChunksRef = useRef<Map<number, string>>(new Map());
  const nextExpectedRef = useRef(0);

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  /**
   * Rebuilds the full text from transcribed chunks in order.
   * This ensures text appears in the correct chronological order
   * even if chunks are transcribed out of order.
   */
  const rebuildText = useCallback(() => {
    const chunks = transcribedChunksRef.current;
    let text = '';
    let i = 0;
    while (chunks.has(i)) {
      const chunkText = chunks.get(i)!;
      if (chunkText) {
        text = text ? text + ' ' + chunkText : chunkText;
      }
      i++;
    }
    nextExpectedRef.current = i;
    textRef.current = text;
    setCurrentText(text);
  }, []);

  /**
   * Sends a single audio chunk to Whisper for transcription.
   * Runs in parallel — multiple chunks can be transcribing at once.
   */
  const transcribeChunk = useCallback(async (blob: Blob, index: number) => {
    if (blob.size < 500) {
      // Very small chunk (likely silence) — mark as empty
      transcribedChunksRef.current.set(index, '');
      rebuildText();
      return;
    }

    setActiveTranscriptions(prev => prev + 1);

    try {
      const formData = new FormData();
      formData.append('audio', blob, `chunk-${index}.webm`);

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const text = (data.text || '').trim();
        transcribedChunksRef.current.set(index, text);
      } else {
        transcribedChunksRef.current.set(index, '');
      }
    } catch {
      transcribedChunksRef.current.set(index, '');
    }

    setActiveTranscriptions(prev => Math.max(0, prev - 1));
    rebuildText();
  }, [rebuildText]);

  /** Start recording */
  const startRecording = useCallback(async () => {
    setError(null);
    setCurrentText('');
    textRef.current = '';
    chunkIndexRef.current = 0;
    nextExpectedRef.current = 0;
    transcribedChunksRef.current.clear();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && isRecordingRef.current) {
          const index = chunkIndexRef.current++;
          // Fire and forget — transcription happens in parallel
          transcribeChunk(event.data, index);
        }
      };

      recorder.onerror = () => {
        setError('Error en la grabación. Intenta nuevamente.');
      };

      // Capture chunks every 3 seconds for near-real-time transcription
      recorder.start(3000);
      isRecordingRef.current = true;
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Permiso de micrófono denegado. Habilita el micrófono en configuración del navegador.');
      } else {
        setError('No se pudo acceder al micrófono.');
      }
    }
  }, [transcribeChunk]);

  /** Stop and save */
  const pauseAndSave = useCallback(async () => {
    isRecordingRef.current = false;
    setIsRecording(false);

    // Stop recorder — triggers final ondataavailable
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    setSaving(true);

    // Wait for all pending transcriptions to finish (max 10 seconds)
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      // Check if all chunks have been transcribed
      const totalChunks = chunkIndexRef.current;
      const transcribed = transcribedChunksRef.current.size;
      if (transcribed >= totalChunks) break;
      await new Promise(r => setTimeout(r, 300));
    }

    // Final rebuild
    rebuildText();

    const segDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const text = textRef.current.trim();

    if (text) {
      await onSave(text, segDuration);
      setSavedSegments(prev => [...prev, text]);
    }

    setSaving(false);
  }, [onSave, rebuildText]);

  /** Cancel */
  const cancel = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { mediaRecorderRef.current.stop(); }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
      if (timerRef.current) { clearInterval(timerRef.current); }
    };
  }, []);

  function formatDuration(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <div className="rounded-lg border-2 border-purple-300 bg-linear-to-r from-purple-50 to-blue-50 p-4 space-y-3 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1.5 bg-red-500 text-white px-2.5 py-1 rounded-full shadow">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <span className="text-[10px] font-bold uppercase">REC</span>
            </div>
          )}
          <span className="text-sm font-semibold text-gray-800">
            {saving
              ? 'Guardando...'
              : isRecording
                ? 'Grabando...'
                : 'Agente IA de Voz'
            }
          </span>
          {isRecording && (
            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border">{formatDuration(duration)}</span>
          )}
          {/* Transcription activity indicator */}
          {activeTranscriptions > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Transcribiendo
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <button type="button" onClick={pauseAndSave}
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Guardar segmento
              </button>
              <button type="button" onClick={cancel}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
            </>
          ) : !saving ? (
            <>
              <button type="button" onClick={startRecording}
                className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /></svg>
                {savedSegments.length > 0 ? 'Grabar más' : 'Iniciar grabación'}
              </button>
              {savedSegments.length > 0 && (
                <button type="button" onClick={onFinish}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-ucc-green rounded-lg hover:bg-ucc-green-dark transition-colors shadow">
                  Finalizar
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Error */}
      {error && <div className="rounded bg-red-50 border border-red-200 p-2"><p className="text-xs text-red-700">{error}</p></div>}

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded p-2 border border-blue-200">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Procesando fragmentos pendientes y guardando...
        </div>
      )}

      {/* Live transcription */}
      {(isRecording || currentText || saving) && (
        <div className="rounded bg-white border border-gray-200 p-3 min-h-[60px] max-h-[150px] overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {currentText || (
              <span className="text-gray-400 italic">
                {isRecording ? 'Escuchando... el texto aparecerá en segundos' : ''}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Saved segments summary */}
      {savedSegments.length > 0 && (
        <div className="rounded bg-green-50 border border-green-200 p-2 space-y-1">
          <p className="text-xs font-semibold text-green-700">✅ {savedSegments.length} segmento(s) guardado(s) en BD</p>
          <p className="text-[10px] text-green-600">{savedSegments.reduce((a, s) => a + s.length, 0)} caracteres totales almacenados</p>
        </div>
      )}

      <p className="text-[10px] text-gray-500">🎙️ Transcripción en línea con Whisper IA. El texto aparece progresivamente mientras hablas. Nunca se congela.</p>
    </div>
  );
}
