import { useCallback, useEffect, useRef, useState } from 'react';

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

type PersistedCountdownMeta = {
  targetTimestamp: number | null;
  isRunning: boolean;
  lastUpdated: number;
};

type CountdownSnapshot = {
  remainingSeconds: number;
  targetTimestamp: number | null;
  isRunning: boolean;
  lastUpdated: number | null;
};

const META_SUFFIX = ':meta';

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

const readPersistedMeta = (storageKey?: string): PersistedCountdownMeta | null => {
  if (!storageKey || typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(`${storageKey}${META_SUFFIX}`);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const targetTimestamp =
      typeof (parsed as Record<string, unknown>).targetTimestamp === 'number'
        ? (parsed as Record<string, unknown>).targetTimestamp
        : null;
    const isRunning = Boolean((parsed as Record<string, unknown>).isRunning);
    const lastUpdated =
      typeof (parsed as Record<string, unknown>).lastUpdated === 'number'
        ? (parsed as Record<string, unknown>).lastUpdated
        : Date.now();

    return {
      targetTimestamp,
      isRunning,
      lastUpdated,
    };
  } catch (error) {
    console.warn('Failed to read countdown metadata', error);
    return null;
  }
};

const persistMeta = (storageKey: string, meta: PersistedCountdownMeta) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${storageKey}${META_SUFFIX}`, JSON.stringify(meta));
  } catch (error) {
    console.warn('Failed to persist countdown metadata', error);
  }
};

export const useCountdown = (
  initialDurationSeconds: number,
  options: CountdownOptions = {}
): UseCountdownResult => {
  const normalizedInitialDuration = toPositiveInteger(initialDurationSeconds);
  const persistedSeconds = readPersistedSeconds(options.storageKey);
  const persistedMeta = readPersistedMeta(options.storageKey);

  const computeInitialRemaining = () => {
    if (persistedMeta?.targetTimestamp) {
      const diff = persistedMeta.targetTimestamp - Date.now();
      const fromTarget = Math.max(0, Math.ceil(diff / 1000));
      return Math.min(fromTarget, normalizedInitialDuration);
    }

    if (persistedSeconds !== null) {
      return Math.min(persistedSeconds, normalizedInitialDuration);
    }

    return normalizedInitialDuration;
  };

  const [remainingSeconds, setRemainingSeconds] = useState(computeInitialRemaining);
  const [isRunning, setIsRunning] = useState<boolean>(() => {
    if (!persistedMeta) {
      return false;
    }

    if (persistedMeta.targetTimestamp && persistedMeta.targetTimestamp <= Date.now()) {
      return false;
    }

    return persistedMeta.isRunning;
  });

  const durationRef = useRef(normalizedInitialDuration);
  const targetTimestampRef = useRef<number | null>(persistedMeta?.targetTimestamp ?? null);
  const intervalRef = useRef<number | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const startRef = useRef<(durationSeconds?: number) => void>(() => undefined);
  const onCompleteRef = useRef<(() => void) | undefined>(options.onComplete);
  const autoRestartRef = useRef<boolean>(options.autoRestart ?? false);

  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const clearIntervalRef = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const persistState = useCallback(
    (nextRemaining: number, nextIsRunning: boolean) => {
      if (!options.storageKey) {
        return;
      }

      persistSeconds(options.storageKey, nextRemaining);
      persistMeta(options.storageKey, {
        targetTimestamp: targetTimestampRef.current,
        isRunning: nextIsRunning,
        lastUpdated: Date.now(),
      });
    },
    [options.storageKey]
  );

  const tick = useCallback(() => {
    if (targetTimestampRef.current === null) {
      return;
    }

    const diff = targetTimestampRef.current - Date.now();
    const nextValue = Math.max(0, Math.ceil(diff / 1000));

    setRemainingSeconds((previous) => (previous === nextValue ? previous : nextValue));

    if (diff <= 0) {
      clearIntervalRef();
      targetTimestampRef.current = null;
      setIsRunning(false);
      persistState(0, false);
      onCompleteRef.current?.();

      if (autoRestartRef.current) {
        clearRestartTimeout();
        restartTimeoutRef.current = window.setTimeout(() => {
          startRef.current(durationRef.current);
        }, 0);
      }
    }
  }, [clearIntervalRef, clearRestartTimeout, persistState]);

  const start = useCallback(
    (durationSeconds?: number) => {
      const duration = toPositiveInteger(durationSeconds ?? durationRef.current);
      durationRef.current = duration;

      clearIntervalRef();
      clearRestartTimeout();

      const now = Date.now();
      const target = now + duration * 1000;
      targetTimestampRef.current = target;

      setRemainingSeconds(Math.min(duration, Math.max(0, Math.ceil((target - now) / 1000))));
      setIsRunning(true);
      persistState(duration, true);

      intervalRef.current = window.setInterval(tick, 1000);
      tick();
    },
    [clearIntervalRef, clearRestartTimeout, persistState, tick]
  );

  startRef.current = start;

  const stop = useCallback(() => {
    tick();
    clearIntervalRef();
    clearRestartTimeout();
    targetTimestampRef.current = null;
    setIsRunning(false);
    setRemainingSeconds((previous) => {
      persistState(previous, false);
      return previous;
    });
  }, [clearIntervalRef, clearRestartTimeout, persistState, tick]);

  const reset = useCallback(
    (durationSeconds?: number) => {
      const duration = toPositiveInteger(durationSeconds ?? durationRef.current);
      durationRef.current = duration;

      clearIntervalRef();
      clearRestartTimeout();
      targetTimestampRef.current = null;
      setIsRunning(false);
      setRemainingSeconds(duration);
      persistState(duration, false);
    },
    [clearIntervalRef, clearRestartTimeout, persistState]
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

    if (!targetTimestampRef.current) {
      const nextRemaining = readPersistedSeconds(options.storageKey);
      setRemainingSeconds(nextRemaining !== null ? Math.min(nextRemaining, normalized) : normalized);
    }
  }, [initialDurationSeconds, options.storageKey]);

  useEffect(() => {
    if (!options.storageKey) {
      return;
    }

    persistSeconds(options.storageKey, remainingSeconds);
    persistMeta(options.storageKey, {
      targetTimestamp: targetTimestampRef.current,
      isRunning,
      lastUpdated: Date.now(),
    });
  }, [isRunning, options.storageKey, remainingSeconds]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const handleVisibility = () => {
        if (!document.hidden) {
          tick();
        }
      };

      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }

    return undefined;
  }, [tick]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleFocus = () => {
        tick();
      };

      window.addEventListener('focus', handleFocus);

      return () => {
        window.removeEventListener('focus', handleFocus);
      };
    }

    return undefined;
  }, [tick]);

  useEffect(() => () => {
    clearIntervalRef();
    clearRestartTimeout();
  }, [clearIntervalRef, clearRestartTimeout]);

  return {
    remainingSeconds,
    isRunning,
    start,
    stop,
    reset,
    setOnComplete,
  };
};

const computeRemainingFromTarget = (targetTimestamp: number | null): number | null => {
  if (targetTimestamp === null) {
    return null;
  }

  const diff = targetTimestamp - Date.now();

  return Math.max(0, Math.ceil(diff / 1000));
};

export const readCountdownSnapshot = (
  storageKey: string,
  fallbackSeconds: number
): CountdownSnapshot => {
  if (typeof window === 'undefined') {
    return {
      remainingSeconds: fallbackSeconds,
      targetTimestamp: null,
      isRunning: false,
      lastUpdated: null,
    };
  }

  const persistedSeconds = readPersistedSeconds(storageKey);
  const persistedMeta = readPersistedMeta(storageKey);

  const normalizedFallback = toPositiveInteger(fallbackSeconds);
  const baseline =
    persistedSeconds !== null ? Math.min(persistedSeconds, normalizedFallback) : normalizedFallback;

  const remainingFromTarget = computeRemainingFromTarget(persistedMeta?.targetTimestamp ?? null);
  const remainingSeconds =
    typeof remainingFromTarget === 'number'
      ? Math.min(remainingFromTarget, normalizedFallback)
      : baseline;

  const targetTimestamp = persistedMeta?.targetTimestamp ?? null;
  const isRunning =
    targetTimestamp !== null && targetTimestamp > Date.now() ? persistedMeta?.isRunning ?? false : false;

  return {
    remainingSeconds,
    targetTimestamp,
    isRunning,
    lastUpdated: persistedMeta?.lastUpdated ?? null,
  };
};

export type { UseCountdownResult, CountdownSnapshot };
