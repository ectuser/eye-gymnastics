export type NotificationPayload = {
  title: string;
  options?: NotificationOptions;
};

export const isSupported = (): boolean => 'Notification' in window;

type AudioCapableWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const { AudioContext: BrowserAudioContext } = window;
  const WebkitAudioContext = (window as AudioCapableWindow).webkitAudioContext;
  const ContextConstructor = BrowserAudioContext ?? WebkitAudioContext;

  if (!ContextConstructor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new ContextConstructor();
  }

  return audioContext;
};

const resumeContext = async (context: AudioContext): Promise<void> => {
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch (error) {
      console.warn('Failed to resume audio context', error);
    }
  }
};

export const primeNotificationSound = async (): Promise<void> => {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  await resumeContext(context);
};

export const playFocusCompleteSound = async (): Promise<void> => {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  await resumeContext(context);

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const now = context.currentTime;

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(880, now);

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.18, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.5);
};

export const playBreakCompleteSound = async (): Promise<void> => {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  await resumeContext(context);

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const now = context.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(600, now);
  oscillator.frequency.linearRampToValueAtTime(400, now + 0.4);

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.16, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.6);
};

export const requestPermission = async (): Promise<boolean> => {
  if (!isSupported()) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const sendNotification = ({ title, options }: NotificationPayload): void => {
  if (!isSupported() || Notification.permission !== 'granted') {
    return;
  }

  if ('serviceWorker' in navigator) {
    const fallbackToWindowNotification = () => {
      new Notification(title, options);
    };

    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!registration) {
          fallbackToWindowNotification();
          return;
        }

        if (registration.active) {
          return registration.showNotification(title, options).catch(fallbackToWindowNotification);
        }

        return navigator.serviceWorker.ready
          .then((readyRegistration) => readyRegistration.showNotification(title, options))
          .catch(fallbackToWindowNotification);
      })
      .catch(fallbackToWindowNotification);
    return;
  }

  new Notification(title, options);
};
