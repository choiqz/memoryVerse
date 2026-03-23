/**
 * Speech recognition wrapper.
 *
 * In a proper dev build (npx expo run:android/ios), uses the native
 * expo-speech-recognition module (Apple SpeechRecognizer / Google SpeechRecognizer).
 *
 * In Expo Go, the native module is unavailable, so `isSupported` returns false
 * and the review screen falls back to a text input.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

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
 * Strip overlapping suffix-prefix when appending a new speech segment.
 * E.g. existing="he gave his only" + segment="his only begotten son"
 * → returns "begotten son" (the non-overlapping part).
 * Returns the full segment if no overlap is found.
 */
function stripOverlap(existing: string, segment: string): string {
  if (!existing || !segment) return segment;
  const existingWords = existing.toLowerCase().split(/\s+/);
  const segmentWords = segment.split(/\s+/);
  const segmentLower = segmentWords.map((w) => w.toLowerCase());

  // Try progressively shorter suffixes of existing against prefix of segment
  const maxCheck = Math.min(existingWords.length, segmentLower.length);
  for (let overlap = maxCheck; overlap >= 1; overlap--) {
    const existingSuffix = existingWords.slice(-overlap);
    const segmentPrefix = segmentLower.slice(0, overlap);
    if (existingSuffix.every((w, i) => w === segmentPrefix[i])) {
      const remaining = segmentWords.slice(overlap);
      return remaining.length > 0 ? remaining.join(' ') : '';
    }
  }
  return segment;
}

/**
 * Hook for managing speech recognition in a review session.
 * Falls back gracefully when native module is unavailable (Expo Go).
 */
export function useSpeech(onFinalResult?: (transcript: string) => void): UseSpeechReturn & { debugLog: string[] } {
  const [state, setState] = useState<SpeechState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => setDebugLog((prev) => [...prev.slice(-8), msg]);

  const finalTranscriptRef = useRef('');
  const interimRef = useRef('');
  // When true, we've manually stopped — ignore all native events
  const stoppedRef = useRef(false);
  const onFinalResultRef = useRef(onFinalResult);

  // Keep callback ref up to date
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  // Register native event listeners in useEffect (proper React lifecycle)
  useEffect(() => {
    if (!NATIVE_AVAILABLE) return;

    let subs: { remove: () => void }[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { addSpeechRecognitionListener } = require('expo-speech-recognition');

      subs.push(
        addSpeechRecognitionListener('result', (event: any) => {
          addLog(`result: ${JSON.stringify(event).slice(0, 120)}`);
          if (stoppedRef.current) { addLog('result ignored (stopped)'); return; }
          const results: any[] = event.results ?? [];
          if (!results.length) { addLog('result ignored (empty)'); return; }
          const result = results[results.length - 1] ?? results[0];
          const text: string = result?.transcript ?? '';
          const isFinal: boolean = event.isFinal ?? result?.isFinal ?? true;
          addLog(`text="${text}" isFinal=${isFinal}`);
          if (isFinal) {
            // Accumulate final segments — don't auto-score; user presses Done
            if (text) {
              const deduped = stripOverlap(finalTranscriptRef.current, text);
              if (deduped) {
                finalTranscriptRef.current = finalTranscriptRef.current
                  ? finalTranscriptRef.current + ' ' + deduped
                  : deduped;
              }
              setTranscript(finalTranscriptRef.current);
            }
            interimRef.current = '';
            setInterimTranscript('');
            // Stay in listening state — user decides when to stop
            setState('listening');
          } else {
            interimRef.current = text;
            setInterimTranscript(text);
            setState('listening');
          }
        }),
      );
      subs.push(
        addSpeechRecognitionListener('start', () => {
          addLog('start');
          if (stoppedRef.current) return;
          setState('listening');
          setError(null);
        }),
      );
      subs.push(
        addSpeechRecognitionListener('end', () => {
          addLog('end');
          if (stoppedRef.current) return;
          // Recognizer auto-ended (e.g. silence timeout) but user hasn't
          // pressed Done — restart so they can keep reciting
          interimRef.current = '';
          setInterimTranscript('');
          addLog('auto-restarting recognizer...');
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { ExpoSpeechRecognitionModule: mod } = require('expo-speech-recognition');
            mod.start({
              lang: 'en-US',
              interimResults: true,
              continuous: true,
              androidRecognitionServicePackage: 'com.google.android.as',
            });
          } catch (e: any) {
            addLog(`auto-restart failed: ${e.message}`);
            setState('idle');
          }
        }),
      );
      subs.push(
        addSpeechRecognitionListener('error', (e: any) => {
          addLog(`error: ${JSON.stringify(e)}`);
          if (stoppedRef.current) return;
          setError(e.message ?? e.error ?? 'Speech error');
          setState('error');
        }),
      );
      // Diagnostic events
      subs.push(
        addSpeechRecognitionListener('audiostart', () => addLog('audiostart')),
        addSpeechRecognitionListener('audioend', () => addLog('audioend')),
        addSpeechRecognitionListener('speechstart', () => addLog('speechstart')),
        addSpeechRecognitionListener('speechend', () => addLog('speechend')),
        addSpeechRecognitionListener('soundstart', () => addLog('soundstart')),
        addSpeechRecognitionListener('soundend', () => addLog('soundend')),
        addSpeechRecognitionListener('nomatch', () => addLog('nomatch')),
      );
    } catch { /* module unavailable */ }

    return () => {
      subs.forEach((s) => s.remove());
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!NATIVE_AVAILABLE) return;
    try {
      stoppedRef.current = false;
      setState('listening');
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      finalTranscriptRef.current = '';
      interimRef.current = '';

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ESR = require('expo-speech-recognition');
      const { ExpoSpeechRecognitionModule } = ESR;

      // Log available services and recognition status
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        addLog(`recognitionAvailable: ${available}`);
        const services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
        addLog(`services: ${JSON.stringify(services)}`);
        const defaultSvc = ExpoSpeechRecognitionModule.getDefaultRecognitionService();
        addLog(`defaultService: ${JSON.stringify(defaultSvc)}`);
      } catch (e: any) {
        addLog(`service check error: ${e.message}`);
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      addLog(`permission: ${JSON.stringify(permission).slice(0, 100)}`);
      // If user pressed stop while we were awaiting permission, bail out
      if (stoppedRef.current) return;
      if (!permission.granted) {
        setError('Microphone permission denied. Please enable in Settings.');
        setState('error');
        return;
      }

      addLog('calling start()...');
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        androidRecognitionServicePackage: 'com.google.android.as',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
      setState('error');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!NATIVE_AVAILABLE) return;
    // Mark as manually stopped — all future native events will be ignored
    stoppedRef.current = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
      ExpoSpeechRecognitionModule.stop();
    } catch { /* ignore */ }

    // Build full transcript: accumulated finals + any trailing interim
    let full = finalTranscriptRef.current || '';
    if (interimRef.current) {
      full = full ? full + ' ' + interimRef.current : interimRef.current;
    }
    if (full) {
      setTranscript(full);
      setInterimTranscript('');
      setState('done');
      onFinalResultRef.current?.(full);
    } else {
      setInterimTranscript('');
      setState('idle');
    }
  }, []);

  const reset = useCallback(() => {
    stoppedRef.current = true;
    setState('idle');
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    finalTranscriptRef.current = '';
    interimRef.current = '';
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
    debugLog,
  };
}
