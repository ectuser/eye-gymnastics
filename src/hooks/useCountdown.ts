import { useCallback, useEffect, useRef, useState } from 'react';
import { Subscription, timer, map, takeWhile } from 'rxjs';

type CountdownOptions = {
  autoRestart?: boolean;
  onComplete?: () => void;
  storageKey?: string;
};

type UseCountdownResult = {
  remainingSeconds: number;
  isRunning: boolean;
  start: (durationSeconds?: number) => void;
  stop: () => void;
  reset: (durationSeconds?: number) => void;
  setOnComplete: (callback?: () => void) => void;
};

const toPositiveInteger = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

const readPersistedSeconds = (storageKey?: string): number | null => {
  if (!storageKey || typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (rawValue === null) {
      return null;
    }

    const parsed = Number.parseInt(rawValue, 10);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return toPositiveInteger(parsed);
  } catch (error) {
    console.warn('Failed to read countdown persistence', error);
    return null;
  }
};

const persistSeconds = (storageKey: string, value: number) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, value.toString(10));
  } catch (error) {
    console.warn('Failed to persist countdown state', error);
  }
};

export const useCountdown = (
  initialDurationSeconds: number,
  options: CountdownOptions = {}
): UseCountdownResult => {
  const normalizedInitialDuration = toPositiveInteger(initialDurationSeconds);
  const persistedSeconds = readPersistedSeconds(options.storageKey);

  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    persistedSeconds !== null ? Math.min(persistedSeconds, normalizedInitialDuration) : normalizedInitialDuration
  );
  const [isRunning, setIsRunning] = useState(false);

  const durationRef = useRef(normalizedInitialDuration);
  const subscriptionRef = useRef<Subscription | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const onCompleteRef = useRef<(() => void) | undefined>(options.onComplete);
  const autoRestartRef = useRef<boolean>(options.autoRestart ?? false);

  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
    clearRestartTimeout();
    setIsRunning(false);
  }, [clearRestartTimeout]);

  const start = useCallback(
    (durationSeconds?: number) => {
      const duration = toPositiveInteger(durationSeconds ?? durationRef.current);
      durationRef.current = duration;

      stop();
      setRemainingSeconds(duration);
      setIsRunning(true);

      const countdown$ = timer(0, 1000).pipe(
        map((elapsed) => duration - elapsed),
        takeWhile((value) => value >= 0)
      );

      const subscription = countdown$.subscribe({
        next: (value) => {
          const nextValue = toPositiveInteger(value);
          setRemainingSeconds(nextValue);

          if (nextValue === 0) {
            setIsRunning(false);
            onCompleteRef.current?.();

            if (autoRestartRef.current) {
              clearRestartTimeout();
              restartTimeoutRef.current = window.setTimeout(() => {
                start(duration);
              }, 0);
            }
          }
        },
        complete: () => {
          setIsRunning(false);
        },
      });

      subscriptionRef.current = subscription;
    },
    [clearRestartTimeout, stop]
  );

  const reset = useCallback(
    (durationSeconds?: number) => {
      const duration = toPositiveInteger(durationSeconds ?? durationRef.current);
      durationRef.current = duration;
      stop();
      setRemainingSeconds(duration);
    },
    [stop]
  );

  const setOnComplete = useCallback((callback?: () => void) => {
    onCompleteRef.current = callback;
  }, []);

  useEffect(() => {
    onCompleteRef.current = options.onComplete;
  }, [options.onComplete]);

  useEffect(() => {
    autoRestartRef.current = options.autoRestart ?? false;
  }, [options.autoRestart]);

  useEffect(() => {
    const normalized = toPositiveInteger(initialDurationSeconds);
    durationRef.current = normalized;

    const nextRemaining = readPersistedSeconds(options.storageKey);
    setRemainingSeconds(nextRemaining !== null ? Math.min(nextRemaining, normalized) : normalized);
  }, [initialDurationSeconds, options.storageKey]);

  useEffect(() => {
    if (!options.storageKey || typeof window === 'undefined') {
      return;
    }

    persistSeconds(options.storageKey, remainingSeconds);
  }, [options.storageKey, remainingSeconds]);

  useEffect(() => () => {
    stop();
  }, [stop]);

  return {
    remainingSeconds,
    isRunning,
    start,
    stop,
    reset,
    setOnComplete,
  };
};

export type { UseCountdownResult };
