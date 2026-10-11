import { Review, INITIAL_REVIEWS } from './places-xuanhoa';

const STORAGE_KEY = 'xuanhoa_reviews_v1';

export function getLocalReviews(placeId: string): Review[] {
  const initial = INITIAL_REVIEWS[placeId] || [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const allCustom: Record<string, Review[]> = JSON.parse(raw);
    const custom = allCustom[placeId] || [];
    return [...custom, ...initial];
  } catch {
    return initial;
  }
}

export function saveLocalReview(placeId: string, review: Omit<Review, 'id' | 'date'>): Review {
  const newReview: Review = {
    ...review,
    id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    date: 'Vừa xong',
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const allCustom: Record<string, Review[]> = raw ? JSON.parse(raw) : {};
    if (!allCustom[placeId]) allCustom[placeId] = [];
    allCustom[placeId].unshift(newReview);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allCustom));
  } catch (err) {
    console.warn('Cannot save to localStorage', err);
  }

  return newReview;
}
