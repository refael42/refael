/** Game clock: one game day lasts DAY_SECONDS of play, starting at 07:00. */
export const DAY_SECONDS = 600;
const START_MIN = 7 * 60;

export interface ClockTime {
  day: number;
  hour: number;
  minute: number;
  /** Minutes since midnight. */
  minuteOfDay: number;
}

export function gameClock(time: number): ClockTime {
  const total = START_MIN + (Math.max(0, time) * 1440) / DAY_SECONDS;
  const day = 1 + Math.floor(total / 1440);
  const m = total - (day - 1) * 1440;
  return { day, hour: Math.floor(m / 60), minute: Math.floor(m % 60), minuteOfDay: m };
}

export function clockText(time: number): string {
  const c = gameClock(time);
  return `${c.hour < 10 ? '0' : ''}${c.hour}:${c.minute < 10 ? '0' : ''}${c.minute}`;
}
