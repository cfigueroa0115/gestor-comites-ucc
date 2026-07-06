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
// Constants
// ---------------------------------------------------------------------------

/** Seconds per recording cycle. Each cycle produces one complete audio file. */
const CYCLE_SECONDS = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * VoiceRecorder - Voice transcription with MediaRecorder + Groq Whisper.
 *
 * How it works:
 * 1. Opens microphone stream (stays open the entire session)
 * 2. Every CYCLE_SECONDS: stops MediaRecorder → produces COMPLETE webm file
 * 3. Sends that file to /api/voice/transcribe (Groq Whisper)
 * 4. Immediately starts a new MediaRecorder on the same stream
 * 5. Text appears progressively as Whisper returns results
 * 6. On "Guardar": waits for all pending, combines text, saves to DB
 *
 * Key: Each stop() produces a COMPLETE file with valid headers.
 * This is essential because Whisper cannot decode partial webm fragments.
 */
export function VoiceRecorder({ onSave, onFinish }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [savedSegments, setSavedSegments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const textRef = useRef('');
  const isRecordingRef = useRef(false);
  const chunkIndexRef = useRef(0);
  const transcribedMapRef = useRef<Map<number, string>>(new Map());
  const pendingCountRef = useRef(0);
  const mimeTypeRef = useRef('audio/webm');

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  /**
   * Rebuild the full text from transcribed chunks in chronological order.
   */
  const rebuildText = useCallback(() => {
    const map = transcribedMapRef.current;
    const parts: string[] = [];
    for (let i = 0; i < chunkIndexRef.current; i++) {
      const t = map.get(i);
      if (t) parts.push(t);
    }
    const fullText = parts.join(' ');
    textRef.current = fullText;
    setCurrentText(fullText);
  }, []);

  /**
   * Send a complete audio blob to the server for Whisper transcription.
   */
  const sendToWhisper = useCallback(async (blob: Blob, index: number) => {
    if (blob.size < 1500) {
      // Too small — mark as silence
      transcribedMapRef.current.set(index, '');
      pendingCountRef.current--;
      setPendingCount(pendingCountRef.current);
      rebuildText();
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', blob, `segment-${index}.webm`);

      const resp = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await resp.json();

      if (data.text) {
        transcribedMapRef.current.set(index, data.text);
        setLastError(null);
      } else {
        transcribedMapRef.current.set(index, '');
        if (data.error && data.error !== 'TOO_SMALL') {
          setLastError(`Error Whisper: ${data.error}`);
        }
      }
    } catch {
      transcribedMapRef.current.set(index, '');
      setLastError('Error de red al transcribir');
    }

    pendingCountRef.current--;
    setPendingCount(Math.max(0, pendingCountRef.current));
    setCompletedCount(prev => prev + 1);
    rebuildText();
  }, [rebuildText]);

  /**
   * Create a new MediaRecorder and start it on the existing stream.
   * When it stops, it sends the complete audio to Whisper.
   */
  const createAndStartRecorder = useCallback((): MediaRecorder | null => {
    const stream = streamRef.current;
    if (!stream || !stream.active) return null;

    try {
      const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
      const localChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) localChunks.push(e.data);
      };

      recorder.onstop = () => {
        if (localChunks.length > 0) {
          const completeBlob = new Blob(localChunks, { type: mimeTypeRef.current });
          const idx = chunkIndexRef.current++;
          pendingCountRef.current++;
          setPendingCount(pendingCountRef.current);
          sendToWhisper(completeBlob, idx);
        }
      };

      recorder.start();
      return recorder;
    } catch {
      return null;
    }
  }, [sendToWhisper]);

  /**
   * Cycle: stop current recorder → start new one.
   * Each stop produces a complete audio file for Whisper.
   */
  const cycleRecorder = useCallback(() => {
    if (!isRecordingRef.current || !streamRef.current) return;

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }

    const newRecorder = createAndStartRecorder();
    recorderRef.current = newRecorder;
  }, [createAndStartRecorder]);

  /** START recording */
  const startRecording = useCallback(async () => {
    setError(null);
    setLastError(null);
    setCurrentText('');
    textRef.current = '';
    chunkIndexRef.current = 0;
    pendingCountRef.current = 0;
    setPendingCount(0);
    setCompletedCount(0);
    transcribedMapRef.current.clear();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Determine best supported MIME type
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeTypeRef.current = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeTypeRef.current = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeTypeRef.current = 'audio/ogg;codecs=opus';
      } else {
        setError('Tu navegador no soporta grabación de audio. Usa Chrome o Edge.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setDuration(0);

      // Start first recorder
      const recorder = createAndStartRecorder();
      recorderRef.current = recorder;

      // Cycle every N seconds
      cycleTimerRef.current = setInterval(cycleRecorder, CYCLE_SECONDS * 1000);

      // Duration display
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Permiso de micrófono denegado. Habilita el micrófono en la configuración del navegador.');
      } else {
        setError('No se pudo acceder al micrófono. Verifica los permisos.');
      }
    }
  }, [createAndStartRecorder, cycleRecorder]);

  /** STOP all recording infrastructure */
  const stopAll = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (cycleTimerRef.current) { clearInterval(cycleTimerRef.current); cycleTimerRef.current = null; }
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }

    // Stop current recorder → sends final chunk
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    // Release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  /** SAVE segment */
  const pauseAndSave = useCallback(async () => {
    stopAll();
    setSaving(true);

    // Wait for pending transcriptions (max 20s)
    const deadline = Date.now() + 20000;
    while (pendingCountRef.current > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500));
    }

    rebuildText();
    const segDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const text = textRef.current.trim();

    if (text) {
      await onSave(text, segDuration);
      setSavedSegments(prev => [...prev, text]);
    } else {
      setError('No se capturó texto. Verifica que hablaste cerca del micrófono y que la conexión a internet está activa.');
    }
    setSaving(false);
  }, [stopAll, rebuildText, onSave]);

  /** CANCEL */
  const cancel = useCallback(() => {
    stopAll();
    transcribedMapRef.current.clear();
    chunkIndexRef.current = 0;
    setCurrentText('');
  }, [stopAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
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
          {(isRecording || saving) && (
            <div className="flex items-center gap-1.5 bg-red-500 text-white px-2.5 py-1 rounded-full shadow">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <span className="text-[10px] font-bold uppercase">REC</span>
            </div>
          )}
          <span className="text-sm font-semibold text-gray-800">
            {saving ? 'Procesando...' : isRecording ? 'Grabando...' : 'Agente IA de Voz'}
          </span>
          {isRecording && (
            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border">{formatDuration(duration)}</span>
          )}
          {/* Transcription progress */}
          {(isRecording || saving) && completedCount > 0 && (
            <span className="text-[10px] text-green-600 font-medium">
              ✓ {completedCount} transcrito{completedCount > 1 ? 's' : ''}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Buttons */}
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

      {/* Errors */}
      {error && <div className="rounded bg-red-50 border border-red-200 p-2"><p className="text-xs text-red-700">{error}</p></div>}
      {lastError && isRecording && (
        <div className="rounded bg-yellow-50 border border-yellow-200 p-2">
          <p className="text-xs text-yellow-700">⚠️ {lastError} — reintentando...</p>
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded p-2 border border-blue-200">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Procesando fragmentos pendientes y guardando en base de datos...
        </div>
      )}

      {/* Transcription display */}
      {(isRecording || currentText || saving) && (
        <div className="rounded bg-white border border-gray-200 p-3 min-h-[60px] max-h-[150px] overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {currentText || (
              <span className="text-gray-400 italic">
                {isRecording ? 'Escuchando... la transcripción aparecerá en unos segundos' : ''}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Saved segments */}
      {savedSegments.length > 0 && (
        <div className="rounded bg-green-50 border border-green-200 p-2 space-y-1">
          <p className="text-xs font-semibold text-green-700">✅ {savedSegments.length} segmento(s) guardado(s) en BD</p>
          <p className="text-[10px] text-green-600">{savedSegments.reduce((a, s) => a + s.length, 0)} caracteres totales almacenados</p>
        </div>
      )}

      <p className="text-[10px] text-gray-500">🎙️ Transcripción con Whisper IA. Habla con naturalidad — el texto se actualiza cada {CYCLE_SECONDS} segundos. Para reuniones largas, adjunta el audio directamente.</p>
    </div>
  );
}
