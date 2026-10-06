import { describe, expect, it } from 'vitest';
import { WEATHER, Weather } from '../src/data/weather';
import { weatherArrivals, weatherOn, weatherPatience } from '../src/sim/weather';

describe('weather', () => {
  it('starts sunny, then follows a fixed calendar with every kind of day', () => {
    for (let d = 1; d <= WEATHER.sunnyStart; d++) expect(weatherOn(d)).toBe(Weather.Sunny);
    const days = Array.from({ length: 200 }, (_, i) => weatherOn(i + WEATHER.sunnyStart + 1));
    expect(weatherOn(42)).toBe(weatherOn(42));
    const share = (w: Weather) => days.filter((x) => x === w).length / days.length;
    expect(share(Weather.Sunny)).toBeGreaterThan(0.35);
    expect(share(Weather.Cloudy)).toBeGreaterThan(0.15);
    expect(share(Weather.Rain)).toBeGreaterThan(0.1);
  });

  it('rain: fewer walk in, the ones inside wait longer; sun is a normal day', () => {
    const rainy = Array.from({ length: 100 }, (_, i) => i + 4).find((d) => weatherOn(d) === Weather.Rain)!;
    const sunny = Array.from({ length: 100 }, (_, i) => i + 4).find((d) => weatherOn(d) === Weather.Sunny)!;
    expect(weatherArrivals(rainy)).toBeLessThan(1);
    expect(weatherPatience(rainy)).toBeGreaterThan(1);
    expect(weatherArrivals(sunny)).toBe(1);
    expect(weatherPatience(sunny)).toBe(1);
  });
});
