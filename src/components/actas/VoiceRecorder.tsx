'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types - Web Speech API
// ---------------------------------------------------------------------------

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
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
  /** Called each time user saves a recording segment */
  onSave: (text: string, durationSeconds: number) => Promise<void>;
  /** Called when user finishes all recordings */
  onFinish: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceRecorder({ onSave, onFinish }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [savedSegments, setSavedSegments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'restarting'>('idle');

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textRef = useRef('');
  const isRecordingRef = useRef(false);
  const lastResultTimeRef = useRef<number>(0);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartCountRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => { textRef.current = currentText; }, [currentText]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  const getSpeechRecognition = useCallback((): (new () => ISpeechRecognition) | null => {
    if (typeof window === 'undefined') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return SR ?? null;
  }, []);

  /**
   * Creates a FRESH SpeechRecognition instance.
   * Key insight: Chrome's Web Speech API can get stuck when reusing instances.
   * Creating a new instance on every restart ensures clean state.
   */
  const createRecognition = useCallback((): ISpeechRecognition | null => {
    const SR = getSpeechRecognition();
    if (!SR) return null;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'es-419'; // Latin American Spanish
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus('listening');
      lastResultTimeRef.current = Date.now();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      lastResultTimeRef.current = Date.now();
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) {
            textRef.current = textRef.current ? textRef.current + '. ' + t : t;
            setCurrentText(textRef.current);
          }
        } else {
          interim = r[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // These errors are normal — recognition ended due to silence or network hiccup
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
        return;
      }
      if (event.error === 'not-allowed') {
        setError('Permiso de micrófono denegado. Habilita el micrófono en la configuración del navegador.');
        return;
      }
      setError(`Error: ${event.error}. Intenta guardar y grabar de nuevo.`);
    };

    recognition.onend = () => {
      setInterimText('');
      // Auto-restart with a NEW instance if still recording
      if (isRecordingRef.current) {
        setStatus('restarting');
        // Small delay to let browser release resources, then create fresh instance
        setTimeout(() => {
          if (isRecordingRef.current) {
            restartWithNewInstance();
          }
        }, 150);
      }
    };

    return recognition;
  }, [getSpeechRecognition]);

  /**
   * Restarts recognition with a completely new instance.
   * This avoids Chrome's internal state issues with reused instances.
   */
  const restartWithNewInstance = useCallback(() => {
    if (!isRecordingRef.current) return;

    // Destroy old instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    // Create fresh instance
    const newRecognition = createRecognition();
    if (newRecognition) {
      try {
        newRecognition.start();
        recognitionRef.current = newRecognition;
        restartCountRef.current++;
      } catch {
        // If start fails, try again after a longer delay
        setTimeout(() => {
          if (isRecordingRef.current) {
            restartWithNewInstance();
          }
        }, 500);
      }
    }
  }, [createRecognition]);

  /**
   * WATCHDOG: Checks every 3 seconds if recognition is still alive.
   * If no results received in 5 seconds, force-restart with a new instance.
   * This prevents the "stuck" state where recognition silently stops working.
   */
  const startWatchdog = useCallback(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);

    watchdogRef.current = setInterval(() => {
      if (!isRecordingRef.current) return;

      const now = Date.now();
      const silenceDuration = now - lastResultTimeRef.current;

      // If more than 5 seconds without any result (not even interim), force restart
      if (silenceDuration > 5000) {
        setStatus('restarting');
        // Kill current instance
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch { /* ignore */ }
          recognitionRef.current = null;
        }
        // Create fresh instance after brief pause
        setTimeout(() => {
          if (isRecordingRef.current) {
            restartWithNewInstance();
          }
        }, 200);
      }
    }, 3000);
  }, [restartWithNewInstance]);

  /** Start recording */
  const startRecording = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError('Navegador no soportado. Usa Chrome o Edge.');
      return;
    }
    setError(null);
    setCurrentText('');
    setInterimText('');
    textRef.current = '';
    restartCountRef.current = 0;
    isRecordingRef.current = true;
    setIsRecording(true);
    setStatus('listening');

    // Create first recognition instance
    const recognition = createRecognition();
    if (!recognition) {
      setError('No se pudo crear el reconocimiento de voz.');
      setIsRecording(false);
      isRecordingRef.current = false;
      return;
    }

    try {
      recognition.start();
      recognitionRef.current = recognition;
      startTimeRef.current = Date.now();
      lastResultTimeRef.current = Date.now();
      setDuration(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Start watchdog
      startWatchdog();
    } catch {
      setError('No se pudo iniciar. Verifica permisos del micrófono.');
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [getSpeechRecognition, createRecognition, startWatchdog]);

  /** Pause and save current segment to DB */
  const pauseAndSave = useCallback(async () => {
    // Stop everything
    isRecordingRef.current = false;
    setIsRecording(false);
    setStatus('idle');

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }

    const segDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const text = textRef.current.trim();

    if (text) {
      setSaving(true);
      await onSave(text, segDuration);
      setSavedSegments(prev => [...prev, text]);
      setSaving(false);
    }
    setInterimText('');
  }, [onSave]);

  /** Cancel without saving */
  const cancel = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setStatus('idle');

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    setInterimText('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch { /* */ } recognitionRef.current = null; }
      if (timerRef.current) { clearInterval(timerRef.current); }
      if (watchdogRef.current) { clearInterval(watchdogRef.current); }
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
              ? status === 'restarting'
                ? 'Reconectando...'
                : 'Escuchando...'
              : saving
                ? 'Guardando...'
                : 'Agente IA de Voz'
            }
          </span>
          {isRecording && (
            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border">{formatDuration(duration)}</span>
          )}
          {/* Status indicator */}
          {isRecording && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
              status === 'listening'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'listening' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-bounce'
              }`}></span>
              {status === 'listening' ? 'Activo' : 'Reiniciando'}
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
        <div className="rounded bg-white border border-gray-200 p-3 min-h-[60px] max-h-[120px] overflow-y-auto">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {currentText}
            {interimText && <span className="text-gray-400 italic"> {interimText}</span>}
            {!currentText && !interimText && isRecording && (
              <span className="text-gray-400 italic">Esperando voz...</span>
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

      <p className="text-[10px] text-gray-500">🎙️ Habla claro y pausado cerca del micrófono. El reconocimiento se reinicia automáticamente si detecta silencio. Para reuniones largas, adjunta la grabación de audio/video directamente.</p>
    </div>
  );
}
