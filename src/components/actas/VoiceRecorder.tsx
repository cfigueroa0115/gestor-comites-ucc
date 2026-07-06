'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VoiceRecorderProps {
  /** Called each time user saves a recording segment */
  onSave: (text: string, durationSeconds: number) => Promise<void>;
  /** Called when user finishes all recordings */
  onFinish: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * VoiceRecorder - Real-time voice transcription using MediaRecorder + Groq Whisper.
 *
 * Strategy: Instead of the unreliable Web Speech API (which stalls in Chrome),
 * we use MediaRecorder to capture actual audio from the microphone in chunks
 * every 5 seconds, then send each chunk to Groq Whisper for transcription.
 *
 * Benefits:
 * - Never stalls or freezes (MediaRecorder is rock-solid across browsers)
 * - Much higher transcription quality (Whisper >> Web Speech API)
 * - Works identically on desktop, tablet, and mobile
 * - No duplicate text issues
 */
export function VoiceRecorder({ onSave, onFinish }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [processingChunk, setProcessingChunk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [savedSegments, setSavedSegments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [chunksProcessed, setChunksProcessed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textRef = useRef('');
  const isRecordingRef = useRef(false);
  const chunksQueueRef = useRef<Blob[]>([]);
  const processingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { textRef.current = currentText; }, [currentText]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  /**
   * Sends an audio chunk to the server for Whisper transcription.
   */
  const transcribeChunk = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 1000) return; // Skip tiny/silent chunks

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'chunk.webm');

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.text && data.text.trim()) {
          const newText = data.text.trim();
          textRef.current = textRef.current
            ? textRef.current + ' ' + newText
            : newText;
          setCurrentText(textRef.current);
          setChunksProcessed(prev => prev + 1);
        }
      }
    } catch {
      // Network error — skip this chunk silently
    }
  }, []);

  /**
   * Process chunks from the queue one at a time.
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (chunksQueueRef.current.length > 0) {
      const chunk = chunksQueueRef.current.shift();
      if (chunk) {
        setProcessingChunk(true);
        await transcribeChunk(chunk);
        setProcessingChunk(false);
      }
    }

    processingRef.current = false;
  }, [transcribeChunk]);

  /** Start recording */
  const startRecording = useCallback(async () => {
    setError(null);
    setCurrentText('');
    textRef.current = '';
    setChunksProcessed(0);
    chunksQueueRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksQueueRef.current.push(event.data);
          processQueue();
        }
      };

      mediaRecorder.onerror = () => {
        setError('Error en la grabación. Intenta nuevamente.');
      };

      // Start recording with 5-second chunks
      mediaRecorder.start(5000);
      isRecordingRef.current = true;
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setDuration(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Permiso de micrófono denegado. Habilita el micrófono en la configuración del navegador.');
      } else {
        setError('No se pudo acceder al micrófono. Verifica permisos.');
      }
    }
  }, [processQueue]);

  /** Stop recording and wait for final chunks */
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Pause and save current segment to DB */
  const pauseAndSave = useCallback(async () => {
    stopRecording();

    // Wait a moment for final chunk to process
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Process any remaining chunks
    while (chunksQueueRef.current.length > 0 || processingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const segDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const text = textRef.current.trim();

    if (text) {
      setSaving(true);
      await onSave(text, segDuration);
      setSavedSegments(prev => [...prev, text]);
      setSaving(false);
    }
  }, [onSave, stopRecording]);

  /** Cancel without saving */
  const cancel = useCallback(() => {
    stopRecording();
    chunksQueueRef.current = [];
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
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
            {isRecording
              ? 'Grabando...'
              : saving
                ? 'Guardando...'
                : 'Agente IA de Voz'
            }
          </span>
          {isRecording && (
            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border">{formatDuration(duration)}</span>
          )}
          {/* Processing indicator */}
          {processingChunk && (
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
          ) : (
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
          )}
        </div>
      </div>

      {/* Error */}
      {error && <div className="rounded bg-red-50 border border-red-200 p-2"><p className="text-xs text-red-700">{error}</p></div>}

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded p-2 border border-blue-200">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Guardando transcripción en base de datos...
        </div>
      )}

      {/* Live transcription */}
      {(isRecording || currentText) && (
        <div className="rounded bg-white border border-gray-200 p-3 min-h-[60px] max-h-[150px] overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {currentText || (
              <span className="text-gray-400 italic">
                {isRecording ? 'Grabando audio... el texto aparecerá cada 5 segundos' : ''}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Progress info */}
      {isRecording && chunksProcessed > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>📝 {chunksProcessed} fragmento(s) transcrito(s) con Whisper IA</span>
        </div>
      )}

      {/* Saved segments summary */}
      {savedSegments.length > 0 && (
        <div className="rounded bg-green-50 border border-green-200 p-2 space-y-1">
          <p className="text-xs font-semibold text-green-700">✅ {savedSegments.length} segmento(s) guardado(s) en BD</p>
          <p className="text-[10px] text-green-600">{savedSegments.reduce((a, s) => a + s.length, 0)} caracteres totales almacenados</p>
        </div>
      )}

      <p className="text-[10px] text-gray-500">🎙️ El audio se transcribe con Whisper IA cada 5 segundos. Habla con naturalidad — la transcripción es de alta calidad y nunca se congela.</p>
    </div>
  );
}
