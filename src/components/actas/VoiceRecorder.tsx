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
export function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-CO';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript(finalText.trim());
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        // Ignore no-speech errors, they happen naturally
        return;
      }
      if (event.error === 'aborted') {
        return;
      }
      setError(`Error de reconocimiento: ${event.error}`);
    };

    recognition.onend = () => {
      // If still recording (not manually stopped), restart
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // Recognition may have been explicitly stopped
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch {
      setError('No se pudo iniciar el reconocimiento de voz. Verifica los permisos del micrófono.');
    }
  }, [getSpeechRecognition]);

  /**
   * Stop recording and return transcription
   */
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null; // prevent restart in onend
      ref.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
    <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4 space-y-3">
      {/* Header with recording indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="recording-dot inline-block w-3 h-3 rounded-full bg-red-500" />
          )}
          <span className="text-sm font-semibold text-gray-800">
            {isRecording ? 'Grabando sesión...' : 'Grabación finalizada'}
          </span>
          <span className="text-xs text-gray-500 font-mono">{formatDuration(duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <>
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
              >
                Detener grabación
              </button>
              <button
                type="button"
                onClick={cancelRecording}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
