'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types - Web Speech API
// ---------------------------------------------------------------------------

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

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
 * VoiceRecorder - Hybrid approach for voice transcription.
 *
 * DUAL ENGINE:
 * 1. Web Speech API → Shows text immediately on screen (visual feedback).
 *    If it stalls, no problem — it's only for preview.
 * 2. MediaRecorder → Records complete audio in background.
 *    On "Guardar", sends full audio to Whisper for HIGH QUALITY transcription.
 *
 * This gives the user:
 * - IMMEDIATE visual feedback while speaking (Web Speech API)
 * - HIGH QUALITY final transcription (Whisper on complete audio)
 * - NEVER freezes the UI (MediaRecorder always works)
 */
export function VoiceRecorder({ onSave, onFinish }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [savedSegments, setSavedSegments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState('');

  // Refs
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewTextRef = useRef('');
  const isRecordingRef = useRef(false);

  useEffect(() => { previewTextRef.current = previewText; }, [previewText]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // -----------------------------------------------------------------------
  // Web Speech API (preview only — not critical if it stalls)
  // -----------------------------------------------------------------------

  const startSpeechPreview = useCallback(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return; // Not supported — that's fine, Whisper handles it

    const recognition = new SR() as ISpeechRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-419';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!isRecordingRef.current) return;
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript.trim() + '. ';
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalText) {
        previewTextRef.current = previewTextRef.current
          ? previewTextRef.current + ' ' + finalText.trim()
          : finalText.trim();
        setPreviewText(previewTextRef.current);
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      // Ignore all errors — this is just preview
    };

    recognition.onend = () => {
      setInterimText('');
      // Auto-restart if still recording (best effort)
      if (isRecordingRef.current) {
        setTimeout(() => {
          if (isRecordingRef.current && recognitionRef.current === recognition) {
            try {
              const newRecognition = new SR() as ISpeechRecognition;
              newRecognition.continuous = true;
              newRecognition.interimResults = true;
              newRecognition.lang = 'es-419';
              newRecognition.maxAlternatives = 1;
              newRecognition.onresult = recognition.onresult;
              newRecognition.onerror = recognition.onerror;
              newRecognition.onend = recognition.onend;
              newRecognition.start();
              recognitionRef.current = newRecognition;
            } catch { /* give up on preview */ }
          }
        }, 300);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch { /* Not critical */ }
  }, []);

  const stopSpeechPreview = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* */ }
      recognitionRef.current = null;
    }
    setInterimText('');
  }, []);

  // -----------------------------------------------------------------------
  // MediaRecorder (reliable audio capture for Whisper)
  // -----------------------------------------------------------------------

  const startMediaRecorder = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // Collect data every 1 second (for fast save)
      recorder.start(1000);
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Permiso de micrófono denegado. Habilita el micrófono en configuración del navegador.');
      } else {
        setError('No se pudo acceder al micrófono.');
      }
      return false;
    }
  }, []);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Public actions
  // -----------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    setError(null);
    setPreviewText('');
    setInterimText('');
    previewTextRef.current = '';
    audioChunksRef.current = [];

    // Start MediaRecorder first (critical)
    const ok = await startMediaRecorder();
    if (!ok) return;

    isRecordingRef.current = true;
    setIsRecording(true);
    startTimeRef.current = Date.now();
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Start speech preview (non-critical, best effort)
    startSpeechPreview();
  }, [startMediaRecorder, startSpeechPreview]);

  const pauseAndSave = useCallback(async () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    stopSpeechPreview();

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // Stop MediaRecorder and collect final data
    setSaving(true);
    setSavingStep('Deteniendo grabación...');

    // Request final data
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.requestData();
      // Give it a moment to flush
      await new Promise(resolve => setTimeout(resolve, 500));
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // Wait for ondataavailable to fire
    await new Promise(resolve => setTimeout(resolve, 300));

    const segDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    // Build complete audio blob
    if (audioChunksRef.current.length > 0) {
      setSavingStep('Transcribiendo audio con Whisper IA...');
      const fullBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      // Send to Whisper for high-quality transcription
      try {
        const formData = new FormData();
        formData.append('audio', fullBlob, 'recording.webm');

        const response = await fetch('/api/voice/transcribe', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.text && data.text.trim()) {
            const whisperText = data.text.trim();
            setSavingStep('Guardando en base de datos...');
            await onSave(whisperText, segDuration);
            setSavedSegments(prev => [...prev, whisperText]);
            setPreviewText(whisperText); // Show final Whisper result
            setSaving(false);
            setSavingStep('');
            return;
          }
        }
      } catch {
        // Whisper failed — fall back to preview text
      }

      // Fallback: use the Web Speech preview text if Whisper failed
      const fallbackText = previewTextRef.current.trim();
      if (fallbackText) {
        setSavingStep('Guardando en base de datos...');
        await onSave(fallbackText, segDuration);
        setSavedSegments(prev => [...prev, fallbackText]);
      }
    } else {
      // No audio chunks — use preview text
      const fallbackText = previewTextRef.current.trim();
      if (fallbackText) {
        setSavingStep('Guardando en base de datos...');
        await onSave(fallbackText, segDuration);
        setSavedSegments(prev => [...prev, fallbackText]);
      }
    }

    setSaving(false);
    setSavingStep('');
  }, [onSave, stopSpeechPreview]);

  const cancel = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    stopSpeechPreview();
    stopMediaRecorder();
    audioChunksRef.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, [stopSpeechPreview, stopMediaRecorder]);

  // Cleanup
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch { /* */ } }
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
              ? 'Procesando...'
              : isRecording
                ? 'Grabando...'
                : 'Agente IA de Voz'
            }
          </span>
          {isRecording && (
            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border">{formatDuration(duration)}</span>
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

      {/* Saving progress */}
      {saving && savingStep && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded p-2 border border-blue-200">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          {savingStep}
        </div>
      )}

      {/* Live preview transcription */}
      {(isRecording || previewText) && (
        <div className="rounded bg-white border border-gray-200 p-3 min-h-[60px] max-h-[150px] overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {previewText}
            {interimText && <span className="text-gray-400 italic"> {interimText}</span>}
            {!previewText && !interimText && isRecording && (
              <span className="text-gray-400 italic">Escuchando... habla cerca del micrófono</span>
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

      <p className="text-[10px] text-gray-500">🎙️ La vista previa aparece en tiempo real. Al guardar, el audio completo se transcribe con Whisper IA para máxima calidad y precisión.</p>
    </div>
  );
}
