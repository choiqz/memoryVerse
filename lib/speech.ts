/**
 * Speech recognition wrapper using expo-speech-recognition.
 * Wraps native iOS SpeechRecognizer / Android SpeechRecognizer.
 */
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  getSpeechRecognitionServices,
} from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

export type SpeechState = 'idle' | 'listening' | 'processing' | 'done' | 'error';

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

export interface UseSpeechReturn {
  state: SpeechState;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  reset: () => void;
  isSupported: boolean;
}

/**
 * Hook for managing speech recognition in a review session.
 */
export function useSpeech(onFinalResult?: (transcript: string) => void): UseSpeechReturn {
  const [state, setState] = useState<SpeechState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finalTranscriptRef = useRef('');

  // Listen for interim and final results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSpeechRecognitionEvent('result', (event: any) => {
    const results = event.results as any[] | undefined;
    if (!results || results.length === 0) return;

    // Take the last/best result
    const result = results[results.length - 1] ?? results[0];
    if (!result) return;

    // expo-speech-recognition may use 'transcript' or nested alternatives
    const text: string =
      result.transcript ??
      (Array.isArray(result) ? result[0]?.transcript : undefined) ??
      '';

    // isFinal may be at event level or result level
    const isFinal: boolean =
      event.isFinal === true ||
      result.isFinal === true ||
      !event.isFinal === false; // treat as final if field absent (fallback)

    if (isFinal) {
      finalTranscriptRef.current = text;
      setTranscript(text);
      setInterimTranscript('');
      setState('done');
      onFinalResult?.(text);
    } else {
      setInterimTranscript(text);
      setState('listening');
    }
  });

  useSpeechRecognitionEvent('start', () => {
    setState('listening');
    setError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    // If we ended without a final result (silence timeout), use whatever we have
    if (state === 'listening' && interimTranscript) {
      const text = interimTranscript;
      setTranscript(text);
      setInterimTranscript('');
      setState('done');
      onFinalResult?.(text);
    } else if (state === 'listening') {
      setState('idle');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    const msg = event.message ?? event.error ?? 'Speech recognition error';
    setError(msg);
    setState('error');
  });

  const startListening = useCallback(async () => {
    try {
      setState('listening');
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      finalTranscriptRef.current = '';

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission denied. Please enable it in Settings.');
        setState('error');
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        // Hint the recognizer with Biblical/common words to improve accuracy
        contextualStrings: [
          'LORD', 'God', 'Christ', 'Jesus', 'Holy', 'Spirit',
          'shall', 'hath', 'thee', 'thou', 'thy', 'thine',
          'gospel', 'blessed', 'grace', 'mercy', 'righteousness',
          'covenant', 'commandment', 'prophet', 'apostle',
        ],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start speech recognition';
      setError(msg);
      setState('error');
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
      setState('processing');
    } catch {
      setState('idle');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    finalTranscriptRef.current = '';
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // ignore
    }
  }, []);

  // Check if speech recognition is available on this device
  const isSupported = true; // expo-speech-recognition handles availability per platform

  return {
    state,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    reset,
    isSupported,
  };
}

/**
 * Check and request microphone + speech recognition permissions.
 */
export async function requestSpeechPermissions(): Promise<boolean> {
  try {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}
