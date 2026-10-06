// Weather (polish): every day has its own, the same for everyone on that day (a calendar, not
// dice: the simulation's random numbers stay untouched). Sunshine is a normal day; in the rain
// fewer walk in, but whoever comes in is in no hurry to go back out.

export const Weather = { Sunny: 0, Cloudy: 1, Rain: 2 } as const;
export type Weather = (typeof Weather)[keyof typeof Weather];

export const WEATHER_IDS = ['sunny', 'cloudy', 'rain'] as const;

export const WEATHER = {
  /** The first days are always sunny: a gentle start (and the tutorial). */
  sunnyStart: 3,
  /** Share of days of each kind after that. */
  odds: [0.5, 0.3, 0.2],
  /** Customer arrivals and patience on such a day (sunshine is the normal day). */
  arrivals: [1, 0.95, 0.85],
  patience: [1, 1.05, 1.25],
} as const;
