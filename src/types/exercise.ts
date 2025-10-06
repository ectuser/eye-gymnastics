export type Exercise = {
  id: string;
  name: string;
  description: string;
  workDurationSeconds: number;
  breakDurationSeconds: number;
  instructions: string[];
  notificationTitle: string;
  notificationBody?: string;
};
