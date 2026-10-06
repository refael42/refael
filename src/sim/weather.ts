import { WEATHER, Weather } from '../data/weather';

/** The weather on a day: a fixed calendar from the day number (the first days always sunny). */
export function weatherOn(day: number): Weather {
  if (day <= WEATHER.sunnyStart) return Weather.Sunny;
  const h = Math.sin(day * 12.9898 + 4.1414) * 43758.5453;
  let roll = h - Math.floor(h);
  for (let w = 0; w < WEATHER.odds.length; w++) {
    roll -= WEATHER.odds[w]!;
    if (roll < 0) return w as Weather;
  }
  return Weather.Sunny;
}

export const weatherArrivals = (day: number): number => WEATHER.arrivals[weatherOn(day)];
export const weatherPatience = (day: number): number => WEATHER.patience[weatherOn(day)];
