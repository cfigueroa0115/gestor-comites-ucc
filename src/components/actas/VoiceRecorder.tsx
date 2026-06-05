'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types - Web Speech API (not in all TS libs by default)
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
  start(): void;
  stop(): void;
  abort(): void;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceRecorderProps {
  /** Called when the recording is stopped with the full transcription text */
  onRecordingComplete: (text: string, durationSeconds: number) => void;
  /** Called when user cancels / stops recording */
  onCancel: () => void;
  /** Called periodically (every 30s) with accumulated text for auto-save */
  onPartialSave?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * VoiceRecorder – Real-time speech-to-text using the Web Speech API.
 *
 * Features:
 * - Continuous speech recognition in es-CO (Spanish Colombia)
 * - Live transcription display
 * - Animated recording indicator (red blinking dot)
 * - Browser compatibility handling (Chrome, Edge)
 * - Accumulates all recognized text until stopped
 */
export function VoiceRecorder({ onRecordingComplete, onCancel, onPartialSave }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef('');
  const transcriptRef = useRef('');

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  /**
   * Check browser support for Web Speech API
   */
  const getSpeechRecognition = useCallback((): (new () => ISpeechRecognition) | null => {
    if (typeof window === 'undefined') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return SR ?? null;
  }, []);

  /**
   * Start recording
   */
  const startRecording = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    setError(null);
    setTranscript('');
    setInterimText('');
    setDuration(0);
    transcriptRef.current = '';

    const recognition = new SpeechRecognitionClass();
    // NOT continuous - we manually restart to avoid mobile duplication bug
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'es-CO';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';

      // Get the last result (the newest one)
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Append final result to transcript
          const finalText = result[0].transcript.trim();
          if (finalText) {
            transcriptRef.current = transcriptRef.current
              ? transcriptRef.current + '. ' + finalText
              : finalText;
            setTranscript(transcriptRef.current);
          }
        } else {
          interim = result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      setError(`Error de reconocimiento: ${event.error}`);
    };

    recognition.onend = () => {
      // Auto-restart if still in recording mode (not manually stopped)
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // May have been explicitly stopped
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      startTimeRef.current = Date.now();
      lastSavedRef.current = '';

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Auto-save every 30 seconds to prevent data loss on long sessions
      if (onPartialSave) {
        autoSaveRef.current = setInterval(() => {
          const currentText = transcriptRef.current;
          if (currentText && currentText !== lastSavedRef.current) {
            onPartialSave(currentText);
            lastSavedRef.current = currentText;
          }
        }, 30000);
      }
    } catch {
      setError('No se pudo iniciar el reconocimiento de voz. Verifica los permisos del micrófono.');
    }
  }, [getSpeechRecognition, onPartialSave]);

  /**
   * Stop recording and return transcription
   */
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (autoSaveRef.current) {
      clearInterval(autoSaveRef.current);
      autoSaveRef.current = null;
    }

    setIsRecording(false);
    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const finalText = transcriptRef.current;

    if (finalText.trim()) {
      onRecordingComplete(finalText.trim(), finalDuration);
    } else {
      onCancel();
    }
  }, [onRecordingComplete, onCancel]);

  /**
   * Cancel recording without saving
   */
  const cancelRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (autoSaveRef.current) {
      clearInterval(autoSaveRef.current);
      autoSaveRef.current = null;
    }

    setIsRecording(false);
    onCancel();
  }, [onCancel]);

  // Auto-start recording on mount
  useEffect(() => {
    startRecording();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Format duration as mm:ss
   */
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="rounded-lg border-2 border-purple-300 bg-linear-to-r from-purple-50 to-blue-50 p-4 space-y-3 shadow-md">
      {/* Header with recording indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRecording && (
            <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-full shadow-lg">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wide">GRABANDO</span>
            </div>
          )}
          <span className="text-sm font-semibold text-gray-800">
            {isRecording ? 'Agente IA escuchando...' : 'Grabación finalizada'}
          </span>
          <span className="text-xs text-gray-500 font-mono bg-white px-2 py-0.5 rounded">{formatDuration(duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <>
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-md flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Detener grabación
              </button>
              <button
                type="button"
                onClick={cancelRecording}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Live transcription display */}
      <div className="rounded-md bg-white border border-gray-200 p-3 min-h-[80px] max-h-[160px] overflow-y-auto">
        {transcript || interimText ? (
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {transcript}
            {interimText && (
              <span className="text-gray-400 italic">{interimText}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {isRecording ? 'Esperando voz... Habla cerca del micrófono.' : 'Sin transcripción disponible.'}
          </p>
        )}
      </div>

      {/* Info text */}
      <p className="text-xs text-gray-500">
        🎙️ La transcripción se envía al agente IA para generar el desarrollo del acta junto con los documentos adjuntos.
      </p>
    </div>
  );
}
