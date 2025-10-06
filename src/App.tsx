import React, { useEffect, useMemo, useState } from 'react';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { EXERCISES } from './config/exercises';
import { useExerciseController } from './hooks/useExerciseController';
import { formatSeconds } from './utils/time';
import { useThemePreference } from './hooks/useThemePreference';
import { ThemeSwitcher } from './components/ThemeSwitcher';

const AUDIO_PREF_KEY = 'settings:audio-enabled';
const EXERCISE_SETTINGS_KEY = 'settings:exercise-config';

type ExerciseDurations = {
  workDurationSeconds: number;
  breakDurationSeconds: number;
};

const parseDuration = (value: unknown): number | null => {
  const parsed =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.floor(parsed);

  if (normalized < 1) {
    return null;
  }

  return normalized;
};

const loadExerciseOverrides = (): Record<string, ExerciseDurations> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(EXERCISE_SETTINGS_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, Partial<ExerciseDurations>>;

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const result: Record<string, ExerciseDurations> = {};

    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') {
        continue;
      }

      const work = parseDuration(value.workDurationSeconds);
      const rest = parseDuration(value.breakDurationSeconds);

      if (work !== null && rest !== null) {
        result[id] = {
          workDurationSeconds: work,
          breakDurationSeconds: rest,
        };
      }
    }

    return result;
  } catch (error) {
    console.warn('Failed to load exercise settings', error);
    return {};
  }
};

const App: React.FC = () => {
  const { preference: themePreference, setPreference: setThemePreference, systemTheme } =
    useThemePreference();
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const stored = window.localStorage.getItem(AUDIO_PREF_KEY);
    if (stored === null) {
      return true;
    }

    return stored !== 'false';
  });
  const [exerciseOverrides, setExerciseOverrides] = useState<Record<string, ExerciseDurations>>(
    () => loadExerciseOverrides()
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftWorkSeconds, setDraftWorkSeconds] = useState<number>(() =>
    parseDuration(EXERCISES[0].workDurationSeconds) ?? EXERCISES[0].workDurationSeconds
  );
  const [draftBreakSeconds, setDraftBreakSeconds] = useState<number>(() =>
    parseDuration(EXERCISES[0].breakDurationSeconds) ?? EXERCISES[0].breakDurationSeconds
  );
  const [draftAudioEnabled, setDraftAudioEnabled] = useState<boolean>(audioEnabled);
  const [draftThemePreference, setDraftThemePreference] = useState(themePreference);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(AUDIO_PREF_KEY, String(audioEnabled));
  }, [audioEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        EXERCISE_SETTINGS_KEY,
        JSON.stringify(exerciseOverrides)
      );
    } catch (error) {
      console.warn('Failed to persist exercise settings', error);
    }
  }, [exerciseOverrides]);

  const exercise = useMemo(
    () => EXERCISES.find((candidate) => candidate.id === exerciseId) ?? EXERCISES[0],
    [exerciseId]
  );

  const activeDurations = useMemo<ExerciseDurations>(() => {
    const override = exerciseOverrides[exercise.id];

    return {
      workDurationSeconds: override?.workDurationSeconds ?? exercise.workDurationSeconds,
      breakDurationSeconds: override?.breakDurationSeconds ?? exercise.breakDurationSeconds,
    };
  }, [exercise, exerciseOverrides]);

  const exerciseConfig = useMemo(
    () => ({
      ...exercise,
      workDurationSeconds: activeDurations.workDurationSeconds,
      breakDurationSeconds: activeDurations.breakDurationSeconds,
    }),
    [activeDurations, exercise]
  );

  const controller = useExerciseController(exerciseConfig, {
    enableAudio: audioEnabled,
  });

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    setDraftWorkSeconds(activeDurations.workDurationSeconds);
    setDraftBreakSeconds(activeDurations.breakDurationSeconds);
    setDraftAudioEnabled(audioEnabled);
    setDraftThemePreference(themePreference);
    setSettingsError(null);
  }, [activeDurations, audioEnabled, isSettingsOpen, themePreference]);

  const handlePlay = () => {
    void controller.startExercise();
  };

  const handleNext = () => {
    controller.startBreak();
  };

  const handlePause = () => {
    controller.pause();
  };

  const handleReset = () => {
    controller.reset();
  };

  const openSettings = () => {
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
    setSettingsError(null);
  };

  const handleSubmitSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedWork = parseDuration(draftWorkSeconds) ?? 0;
    const normalizedBreak = parseDuration(draftBreakSeconds) ?? 0;

    if (normalizedWork <= 0) {
      setSettingsError('Focus duration must be at least 1 second.');
      return;
    }

    if (normalizedBreak <= 0) {
      setSettingsError('Break duration must be at least 1 second.');
      return;
    }

    setExerciseOverrides((previous) => {
      const defaults: ExerciseDurations = {
        workDurationSeconds: exercise.workDurationSeconds,
        breakDurationSeconds: exercise.breakDurationSeconds,
      };

      const next = { ...previous };

      if (
        normalizedWork === defaults.workDurationSeconds &&
        normalizedBreak === defaults.breakDurationSeconds
      ) {
        delete next[exercise.id];
      } else {
        next[exercise.id] = {
          workDurationSeconds: normalizedWork,
          breakDurationSeconds: normalizedBreak,
        };
      }

      return next;
    });

    setAudioEnabled(draftAudioEnabled);
    if (draftThemePreference !== themePreference) {
      setThemePreference(draftThemePreference);
    }
    setIsSettingsOpen(false);
    setSettingsError(null);
  };

  return (
    <>
      <main className="min-h-screen bg-base-200 flex flex-col items-center py-10 px-4 justify-center">
        <div className="w-full max-w-3xl">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary">Eye Gymnastics</h1>
            <p className="mt-2 text-base-content/70">
              Stay refreshed with guided vision breaks.
            </p>
          </header>

          <section className="card bg-base-100 shadow-xl">
            <div className="card-body gap-6">
              <div className="flex gap-3 flex-row items-center justify-end">
                <ThemeSwitcher
                  preference={themePreference}
                  systemTheme={systemTheme}
                  onChange={setThemePreference}
                />
                <button
                  type="button"
                  className="btn btn-ghost gap-2"
                  onClick={openSettings}
                  title='Settings'
                >
                  <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <select
                id="exercise-select"
                className="select select-bordered"
                value={exerciseId}
                onChange={(event) => setExerciseId(event.target.value)}
              >
                {EXERCISES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>

              <article className="prose max-w-none">
                <h2 className="text-xl font-semibold">{exercise.name}</h2>
                <p>{exercise.description}</p>
              </article>

              <div className="bg-base-200 rounded-box p-6 flex flex-col gap-6">
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-sm uppercase tracking-wide text-base-content/60">
                    {controller.phase === 'break' ? 'Focus resumes in' : 'Next break in'}
                  </p>
                  <p className="text-6xl font-mono font-semibold" data-testid="work-timer">
                    {formatSeconds(controller.work.remainingSeconds)}
                  </p>
                  {controller.breakDue && controller.phase !== 'break' && (
                    <span className="badge badge-warning badge-outline">Break due</span>
                  )}
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handlePlay}
                    disabled={controller.work.isRunning || controller.phase === 'break'}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={handlePause}
                    disabled={!controller.work.isRunning}
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleNext}
                    disabled={controller.phase !== 'work'}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleReset}
                  >
                    Stop
                  </button>
                </div>

                <div className="bg-base-100 rounded-box p-4 space-y-3" data-testid="instructions-panel">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">
                        {controller.phase === 'break' ? 'Gymnastics instructions' : 'Upcoming instructions'}
                      </h3>
                      <p className="text-sm text-base-content/70">
                        {controller.phase === 'break'
                          ? 'Follow each step while the timer counts down.'
                          : 'Preview the steps you will complete during your next break.'}
                      </p>
                    </div>
                    {controller.phase === 'break' && (
                      <p className="text-3xl font-mono font-semibold" data-testid="break-timer">
                        {formatSeconds(controller.rest.remainingSeconds)}
                      </p>
                    )}
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-sm text-base-content/80">
                    {exercise.instructions.map((instruction, index) => (
                      <li key={instruction.substring(0, 12) + index.toString()}>{instruction}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-1 text-sm text-base-content/70 text-center sm:text-left">
                  <span>
                    Status:{' '}
                    {controller.phase === 'idle' && 'Waiting to start'}
                    {controller.phase === 'work' &&
                      (controller.breakDue ? 'Break available' : 'Focusing time in progress')}
                    {controller.phase === 'break' && 'Gymnastics in progress'}
                  </span>
                  <span>
                    Cycle:
                    {controller.work.isRunning ? ' Active' : ' Paused'}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {isSettingsOpen && (
        <div className="modal modal-open">
          <div className="modal-box space-y-6">
            <h2 className="text-xl font-semibold">Exercise settings</h2>
            <form className="space-y-4" onSubmit={handleSubmitSettings}>
              <div className="form-control">
                <label className="label" htmlFor="settings-focus-seconds">
                  <span className="label-text">Focus duration (seconds)</span>
                </label>
                <input
                  id="settings-focus-seconds"
                  type="number"
                  min={1}
                  className="input input-bordered w-full"
                  value={draftWorkSeconds}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setDraftWorkSeconds(Number.isFinite(value) ? value : 0);
                    setSettingsError(null);
                  }}
                />
              </div>

              <div className="form-control">
                <label className="label" htmlFor="settings-break-seconds">
                  <span className="label-text">Break duration (seconds)</span>
                </label>
                <input
                  id="settings-break-seconds"
                  type="number"
                  min={1}
                  className="input input-bordered w-full"
                  value={draftBreakSeconds}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setDraftBreakSeconds(Number.isFinite(value) ? value : 0);
                    setSettingsError(null);
                  }}
                />
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-between" htmlFor="settings-audio-toggle">
                  <span className="label-text">Audio effects</span>
                  <input
                    id="settings-audio-toggle"
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={draftAudioEnabled}
                    onChange={(event) => setDraftAudioEnabled(event.target.checked)}
                  />
                </label>
              </div>

              {settingsError && (
                <p className="text-sm text-error" role="alert">
                  {settingsError}
                </p>
              )}

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={closeSettings}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeSettings}
            aria-label="Close settings"
          />
        </div>
      )}
    </>
  );
};

export default App;
