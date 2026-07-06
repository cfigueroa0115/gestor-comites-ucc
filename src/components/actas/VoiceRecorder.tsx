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
 * VoiceRecorder - Real-time voice transcription with MediaRecorder + Whisper.
 *
 * ROOT CAUSE FIX: The previous approach used MediaRecorder's `timeslice` param
 * which produces incomplete chunks (only first has WebM header). Whisper can't
 * decode headerless chunks → that's why only 1 fragment transcribed.
 *
 * NEW APPROACH: Stop/Start cycling.
 * - Every 4 seconds: stop the recorder → get a COMPLETE webm file → start new recorder
 * - Each complete file is sent to Whisper in parallel
 * - Text builds up progressively in chronological order
 * - The microphone stream stays open (only the recorder cycles)
 * - Result: text appears every ~5-6 seconds, fluently, without ever freezing
 */
export function VoiceRecorder({ onSave, onFinish }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [savedSegments, setSavedSegments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTranscriptions, setActiveTranscriptions] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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
   * Rebuild full text from all transcribed chunks in order.
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
   * Send a complete audio blob to Whisper for transcription.
   */
  const sendToWhisper = useCallback(async (blob: Blob, index: number) => {
    if (blob.size < 2000) {
      // Too small — likely silence
      transcribedMapRef.current.set(index, '');
      rebuildText();
      pendingCountRef.current--;
      setActiveTranscriptions(pendingCountRef.current);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', blob, `segment-${index}.webm`);

      const resp = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (resp.ok) {
        const data = await resp.json();
        transcribedMapRef.current.set(index, (data.text || '').trim());
      } else {
        transcribedMapRef.current.set(index, '');
      }
    } catch {
      transcribedMapRef.current.set(index, '');
    }

    pendingCountRef.current--;
    setActiveTranscriptions(Math.max(0, pendingCountRef.current));
    rebuildText();
  }, [rebuildText]);

  /**
   * Creates a new MediaRecorder on the existing stream and starts it.
   * Returns the recorder instance.
   */
  const createAndStartRecorder = useCallback((): MediaRecorder | null => {
    const stream = streamRef.current;
    if (!stream) return null;

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
        setActiveTranscriptions(pendingCountRef.current);
        // Send to Whisper in background (don't await)
        sendToWhisper(completeBlob, idx);
      }
    };

    recorder.start();
    return recorder;
  }, [sendToWhisper]);

  /**
   * Cycle: stop current recorder (triggers onstop → sends to Whisper),
   * then immediately start a new one on the same stream.
   */
  const cycleRecorder = useCallback(() => {
    if (!isRecordingRef.current || !streamRef.current) return;

    // Stop current (triggers onstop which sends the complete file to Whisper)
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }

    // Start new recorder immediately on same stream
    const newRecorder = createAndStartRecorder();
    recorderRef.current = newRecorder;
  }, [createAndStartRecorder]);

  /** Start recording */
  const startRecording = useCallback(async () => {
    setError(null);
    setCurrentText('');
    textRef.current = '';
    chunkIndexRef.current = 0;
    pendingCountRef.current = 0;
    transcribedMapRef.current.clear();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Determine MIME type
      mimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus';

      isRecordingRef.current = true;
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setDuration(0);

      // Start first recorder
      const recorder = createAndStartRecorder();
      recorderRef.current = recorder;

      // Cycle every 4 seconds (stop current → send to Whisper → start new)
      cycleTimerRef.current = setInterval(() => {
        cycleRecorder();
      }, 4000);

      // Duration display
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Permiso de micrófono denegado. Habilita el micrófono en configuración del navegador.');
      } else {
        setError('No se pudo acceder al micrófono.');
      }
    }
  }, [createAndStartRecorder, cycleRecorder]);

  /** Stop everything */
  const stopAll = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (cycleTimerRef.current) { clearInterval(cycleTimerRef.current); cycleTimerRef.current = null; }
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }

    // Stop current recorder (sends final chunk to Whisper)
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

  /** Save segment */
  const pauseAndSave = useCallback(async () => {
    stopAll();
    setSaving(true);

    // Wait for all pending transcriptions (max 15s)
    const deadline = Date.now() + 15000;
    while (pendingCountRef.current > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 400));
    }

    rebuildText();
    const segDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const text = textRef.current.trim();

    if (text) {
      await onSave(text, segDuration);
      setSavedSegments(prev => [...prev, text]);
    }
    setSaving(false);
  }, [stopAll, rebuildText, onSave]);

  /** Cancel */
  const cancel = useCallback(() => {
    stopAll();
    transcribedMapRef.current.clear();
    chunkIndexRef.current = 0;
  }, [stopAll]);

  // Cleanup
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
          {activeTranscriptions > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Procesando
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

      {/* Error */}
      {error && <div className="rounded bg-red-50 border border-red-200 p-2"><p className="text-xs text-red-700">{error}</p></div>}

      {/* Saving */}
      {saving && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded p-2 border border-blue-200">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Esperando transcripciones pendientes y guardando...
        </div>
      )}

      {/* Transcription display */}
      {(isRecording || currentText || saving) && (
        <div className="rounded bg-white border border-gray-200 p-3 min-h-[60px] max-h-[150px] overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {currentText || (
              <span className="text-gray-400 italic">
                {isRecording ? 'Escuchando... el texto aparece progresivamente' : ''}
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

      <p className="text-[10px] text-gray-500">🎙️ Transcripción con Whisper IA. El texto se actualiza progresivamente. Habla con naturalidad.</p>
    </div>
  );
}
