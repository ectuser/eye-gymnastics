import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Exercise } from '../types';
import { readCountdownSnapshot, useCountdown } from './useCountdown';
import {
  playBreakCompleteSound,
  playFocusCompleteSound,
  primeNotificationSound,
  requestPermission,
  sendNotification,
} from '../services/notificationService';

type ExercisePhase = 'idle' | 'work' | 'break';

type ExerciseController = {
  phase: ExercisePhase;
  breakDue: boolean;
  startExercise: () => Promise<void>;
  startBreak: () => void;
  pause: () => void;
  reset: () => void;
  work: {
    remainingSeconds: number;
    isRunning: boolean;
  };
  rest: {
    remainingSeconds: number;
    isRunning: boolean;
  };
};

type PersistedExerciseState = {
  phase: ExercisePhase;
  breakDue: boolean;
  workRunning: boolean;
  breakRunning: boolean;
  workSeconds: number;
  breakSeconds: number;
};

type ExerciseControllerOptions = {
  enableAudio?: boolean;
};

export const useExerciseController = (
  exercise: Exercise,
  options: ExerciseControllerOptions = {}
): ExerciseController => {
  const [phase, setPhase] = useState<ExercisePhase>('idle');
  const [breakDue, setBreakDue] = useState(false);

  const workStorageKey = useMemo(() => `exercise:${exercise.id}:work`, [exercise.id]);
  const breakStorageKey = useMemo(() => `exercise:${exercise.id}:break`, [exercise.id]);
  const stateStorageKey = useMemo(() => `exercise:${exercise.id}:state`, [exercise.id]);

  const workTimer = useCountdown(exercise.workDurationSeconds, { storageKey: workStorageKey });

  const breakTimer = useCountdown(exercise.breakDurationSeconds, { storageKey: breakStorageKey });

  const {
    start: startWorkTimer,
    stop: stopWorkTimer,
    reset: resetWorkTimer,
    setOnComplete: setWorkOnComplete,
    remainingSeconds: workRemainingSeconds,
    isRunning: isWorkRunning,
  } = workTimer;

  const {
    start: startBreakTimer,
    stop: stopBreakTimer,
    reset: resetBreakTimer,
    setOnComplete: setBreakOnComplete,
    remainingSeconds: breakRemainingSeconds,
    isRunning: isBreakRunning,
  } = breakTimer;

  const persistedStateHydratedRef = useRef(false);
  const audioEnabledRef = useRef<boolean>(options.enableAudio ?? true);

  useEffect(() => {
    audioEnabledRef.current = options.enableAudio ?? true;
  }, [options.enableAudio]);

  const notifyBreak = useCallback(() => {
    sendNotification({
      title: exercise.notificationTitle,
      options: exercise.notificationBody
        ? {
            body: exercise.notificationBody,
          }
        : undefined,
    });
    if (audioEnabledRef.current) {
      void playFocusCompleteSound();
    }
  }, [exercise.notificationBody, exercise.notificationTitle]);

  useEffect(() => {
    setWorkOnComplete(() => {
      setBreakDue(true);
      notifyBreak();
      startWorkTimer(exercise.workDurationSeconds);
    });
  }, [exercise.workDurationSeconds, notifyBreak, setWorkOnComplete, startWorkTimer]);

  useEffect(() => {
    setBreakOnComplete(() => {
      setPhase('work');
      setBreakDue(false);
      resetBreakTimer(exercise.breakDurationSeconds);
      resetWorkTimer(exercise.workDurationSeconds);
      startWorkTimer(exercise.workDurationSeconds);
      if (audioEnabledRef.current) {
        void playBreakCompleteSound();
      }
    });
  }, [
    exercise.breakDurationSeconds,
    exercise.workDurationSeconds,
    resetBreakTimer,
    resetWorkTimer,
    setBreakOnComplete,
    startWorkTimer,
  ]);

  useEffect(() => {
    persistedStateHydratedRef.current = false;
    stopWorkTimer();
    stopBreakTimer();
    setBreakDue(false);
    setPhase('idle');
  }, [exercise.breakDurationSeconds, exercise.workDurationSeconds, stopBreakTimer, stopWorkTimer]);

  const readSeconds = useCallback((storageKey: string, fallback: number) => {
    if (typeof window === 'undefined') {
      return fallback;
    }

    return readCountdownSnapshot(storageKey, fallback).remainingSeconds;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      persistedStateHydratedRef.current = true;
      return;
    }

    const rawState = window.localStorage.getItem(stateStorageKey);

    if (!rawState) {
      persistedStateHydratedRef.current = true;
      return;
    }

    try {
      const parsedState = JSON.parse(rawState) as Partial<PersistedExerciseState>;

      if (parsedState.phase) {
        setPhase(parsedState.phase);
      }

      if (typeof parsedState.breakDue === 'boolean') {
        setBreakDue(parsedState.breakDue);
      }

      const shouldResumeWork = parsedState.phase === 'work' && parsedState.workRunning;
      const shouldResumeBreak = parsedState.phase === 'break' && parsedState.breakRunning;

      if (shouldResumeWork) {
        const targetSeconds = parsedState.workSeconds ?? readSeconds(workStorageKey, exercise.workDurationSeconds);
        if (targetSeconds > 0) {
          startWorkTimer(targetSeconds);
        } else {
          setBreakDue(true);
        }
      } else if (shouldResumeBreak) {
        const targetSeconds = parsedState.breakSeconds ?? readSeconds(breakStorageKey, exercise.breakDurationSeconds);
        if (targetSeconds > 0) {
          startBreakTimer(targetSeconds);
        } else {
          setPhase('work');
          setBreakDue(false);
          startWorkTimer(exercise.workDurationSeconds);
        }
      }
    } catch (error) {
      console.warn('Failed to hydrate exercise state', error);
    } finally {
      persistedStateHydratedRef.current = true;
    }
  }, [
    breakStorageKey,
    exercise.breakDurationSeconds,
    exercise.workDurationSeconds,
    readSeconds,
    startBreakTimer,
    startWorkTimer,
    stateStorageKey,
    workStorageKey,
  ]);

  useEffect(() => {
    if (!persistedStateHydratedRef.current || typeof window === 'undefined') {
      return;
    }

    const payload: PersistedExerciseState = {
      phase,
      breakDue,
      workRunning: isWorkRunning,
      breakRunning: isBreakRunning,
      workSeconds: workRemainingSeconds,
      breakSeconds: breakRemainingSeconds,
    };

    try {
      window.localStorage.setItem(stateStorageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist exercise state', error);
    }
  }, [
    breakDue,
    breakRemainingSeconds,
    isBreakRunning,
    isWorkRunning,
    phase,
    stateStorageKey,
    workRemainingSeconds,
  ]);

  const startExercise = useCallback(async () => {
    if (audioEnabledRef.current) {
      await primeNotificationSound();
    }
    await requestPermission();
    stopBreakTimer();
    resetBreakTimer(exercise.breakDurationSeconds);
    setPhase('work');
    setBreakDue(false);
    const resumeTarget =
      workRemainingSeconds > 0 && workRemainingSeconds < exercise.workDurationSeconds
        ? workRemainingSeconds
        : exercise.workDurationSeconds;
    startWorkTimer(resumeTarget);
  }, [
    exercise.breakDurationSeconds,
    exercise.workDurationSeconds,
    resetBreakTimer,
    startWorkTimer,
    stopBreakTimer,
    workRemainingSeconds,
  ]);

  const startBreak = useCallback(() => {
    if (phase === 'idle') {
      return;
    }

    setPhase('break');
    setBreakDue(false);
    stopWorkTimer();
    resetWorkTimer(exercise.workDurationSeconds);
    resetBreakTimer(exercise.breakDurationSeconds);
    startBreakTimer(exercise.breakDurationSeconds);
  }, [exercise.breakDurationSeconds, exercise.workDurationSeconds, phase, resetBreakTimer, resetWorkTimer, startBreakTimer, stopWorkTimer]);

  const pause = useCallback(() => {
    if (phase !== 'work') {
      return;
    }

    stopWorkTimer();
    setPhase('idle');
  }, [phase, stopWorkTimer]);

  const resetExercise = useCallback(() => {
    stopWorkTimer();
    stopBreakTimer();
    resetWorkTimer(exercise.workDurationSeconds);
    resetBreakTimer(exercise.breakDurationSeconds);
    setBreakDue(false);
    setPhase('idle');
    if (audioEnabledRef.current) {
      void primeNotificationSound();
    }
  }, [exercise.breakDurationSeconds, exercise.workDurationSeconds, resetBreakTimer, resetWorkTimer, stopBreakTimer, stopWorkTimer]);

  return useMemo(
    () => ({
      phase,
      breakDue,
      startExercise,
      startBreak,
      pause,
      reset: resetExercise,
      work: {
        remainingSeconds: workRemainingSeconds,
        isRunning: isWorkRunning,
      },
      rest: {
        remainingSeconds: breakRemainingSeconds,
        isRunning: isBreakRunning,
      },
    }),
    [
      breakDue,
      breakRemainingSeconds,
      isBreakRunning,
      isWorkRunning,
      phase,
      pause,
      resetExercise,
      startBreak,
      startExercise,
      workRemainingSeconds,
    ]
  );
};
