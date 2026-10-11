import { Place } from './places-xuanhoa';

export interface SpinProfile {
  durationMs: number;
  tiles: number;
  friction: number;
}

export function createPlaceSpinProfile(random = Math.random, reducedMotion = false): SpinProfile {
  if (reducedMotion) {
    return {
      durationMs: 4000 + Math.floor(random() * 800),
      tiles: 12 + Math.floor(random() * 4),
      friction: 2.8 + random() * 0.4,
    };
  }
  return {
    durationMs: 6500 + Math.floor(random() * 1500),
    tiles: 25 + Math.floor(random() * 8),
    friction: 2.8 + random() * 0.5,
  };
}

export function spinProgress(progress: number, friction: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return 1 - Math.pow(1 - p, friction);
}

export function stopFraction(random = Math.random): number {
  return (Math.floor(random() * 60) + 20) / 100;
}

export function chooseRandomPlace(places: Place[], budgetTier: string = 'all'): Place {
  if (!places.length) throw new Error('No places to choose from');

  let candidates = places;
  if (budgetTier === 'cheap') {
    candidates = places.filter(p => p.minPrice <= 35);
  } else if (budgetTier === 'mid') {
    candidates = places.filter(p => p.minPrice <= 75 && p.maxPrice >= 30);
  } else if (budgetTier === 'high') {
    candidates = places.filter(p => p.maxPrice >= 75);
  }

  if (!candidates.length) candidates = places;

  // Weight higher rated places slightly more
  const weights = candidates.map(p => Math.pow(p.rating, 2));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let randomVal = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    if ((randomVal -= weights[i]) <= 0) {
      return candidates[i];
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
