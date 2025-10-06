import { type Exercise } from '../types';

export const EXERCISES: Exercise[] = [
  {
    id: '20-20-20',
    name: '20-20-20 Break',
    description: 'Every 20 minutes, look at something 20 feet away for 20 seconds.',
    workDurationSeconds: 20 * 60,
    breakDurationSeconds: 20,
    instructions: [
      'Find a point at least 20 feet away and focus on it.',
      'Unclench your jaw and relax your shoulders.',
      'Blink slowly to moisten your eyes.',
    ],
    notificationTitle: 'Time to rest your eyes',
    notificationBody: 'Follow the 20-20-20 routine to keep your eyes refreshed.',
  },
];
