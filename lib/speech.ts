/**
 * Speech recognition wrapper.
 *
 * In a proper dev build (npx expo run:android/ios), uses the native
 * expo-speech-recognition module (Apple SpeechRecognizer / Google SpeechRecognizer).
 *
 * In Expo Go, the native module is unavailable, so `isSupported` returns false
 * and the review screen falls back to a text input.
 */
import { useCallback, useRef, useState } from 'react';

export type SpeechState = 'idle' | 'listening' | 'processing' | 'done' | 'error';

export interface UseSpeechReturn {
  state: SpeechState;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  reset: () => void;
  /** false in Expo Go; true in a dev/production build with native module */
  isSupported: boolean;
}

// Detect whether the native module is available at runtime
function isSpeechRecognitionAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-speech-recognition');
    return !!mod?.ExpoSpeechRecognitionModule;
  } catch {
    return false;
  }
}

const NATIVE_AVAILABLE = isSpeechRecognitionAvailable();

/**
 * Hook for managing speech recognition in a review session.
 * Falls back gracefully when native module is unavailable (Expo Go).
 */
export function useSpeech(onFinalResult?: (transcript: string) => void): UseSpeechReturn {
  const [state, setState] = useState<SpeechState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const finalTranscriptRef = useRef('');
  const moduleRef = useRef<ReturnType<typeof loadNativeModule> | null>(null);

  // Lazy-load the native module and attach event listeners only when available
  if (NATIVE_AVAILABLE && !moduleRef.current) {
    moduleRef.current = loadNativeModule({
      onInterim: (text) => {
        setInterimTranscript(text);
        setState('listening');
      },
      onFinal: (text) => {
        finalTranscriptRef.current = text;
        setTranscript(text);
        setInterimTranscript('');
        setState('done');
        onFinalResult?.(text);
      },
      onStart: () => {
        setState('listening');
        setError(null);
      },
      onEnd: () => {
        setState((prev) => {
          if (prev === 'listening') return 'idle';
          return prev;
        });
      },
      onError: (msg) => {
        setError(msg);
        setState('error');
      },
    });
  }

  const startListening = useCallback(async () => {
    if (!NATIVE_AVAILABLE) return;
    try {
      setState('listening');
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      finalTranscriptRef.current = '';

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission denied. Please enable in Settings.');
        setState('error');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        contextualStrings: [
          'LORD', 'God', 'Christ', 'Jesus', 'Holy', 'Spirit',
          'shall', 'hath', 'thee', 'thou', 'thy', 'thine',
          'gospel', 'blessed', 'grace', 'mercy', 'righteousness',
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
      setState('error');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!NATIVE_AVAILABLE) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('expo-speech-recognition').ExpoSpeechRecognitionModule.stop();
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
    if (NATIVE_AVAILABLE) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('expo-speech-recognition').ExpoSpeechRecognitionModule.abort();
      } catch { /* ignore */ }
    }
  }, []);

  return {
    state,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    reset,
    isSupported: NATIVE_AVAILABLE,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface NativeCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onError: (msg: string) => void;
}

function loadNativeModule(cbs: NativeCallbacks): true {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { addSpeechRecognitionListener } = require('expo-speech-recognition');

    addSpeechRecognitionListener('result', (event: any) => {
      const results: any[] = event.results ?? [];
      if (!results.length) return;
      const result = results[results.length - 1] ?? results[0];
      const text: string = result?.transcript ?? '';
      const isFinal: boolean = event.isFinal ?? result?.isFinal ?? true;
      if (isFinal) cbs.onFinal(text);
      else cbs.onInterim(text);
    });
    addSpeechRecognitionListener('start', cbs.onStart);
    addSpeechRecognitionListener('end', cbs.onEnd);
    addSpeechRecognitionListener('error', (e: any) => {
      cbs.onError(e.message ?? e.error ?? 'Speech error');
    });
  } catch { /* module unavailable */ }
  return true;
}
