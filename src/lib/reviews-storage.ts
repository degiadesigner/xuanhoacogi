import { Review, INITIAL_REVIEWS } from './places-xuanhoa';

const STORAGE_KEY_PLACES = 'xuanhoa_reviews_v1';
const STORAGE_KEY_DISHES = 'xuanhoa_dish_reviews_v1';

export interface DishReview {
  id: string;
  foodId: string;
  author: string;
  avatar?: string;
  rating: number; // 1 - 5 sao
  date: string;
  content: string;
  tags?: string[];
  photo?: string;
  isVerified?: boolean;
}

// Yêu cầu: Các món 100% chưa có đánh giá thực, để trống danh sách để khách tự trải nghiệm và đánh giá thực
const INITIAL_DISH_REVIEWS: Record<string, DishReview[]> = {};

// 1. QUẢN LÝ ĐÁNH GIÁ QUÁN ĂN (PLACES)
export function getLocalReviews(placeId: string): Review[] {
  const initial = INITIAL_REVIEWS[placeId] || [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLACES);
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
    const raw = localStorage.getItem(STORAGE_KEY_PLACES);
    const allCustom: Record<string, Review[]> = raw ? JSON.parse(raw) : {};
    if (!allCustom[placeId]) allCustom[placeId] = [];
    allCustom[placeId].unshift(newReview);
    localStorage.setItem(STORAGE_KEY_PLACES, JSON.stringify(allCustom));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync'));
    }
  } catch (err) {
    console.warn('Cannot save to localStorage', err);
  }

  return newReview;
}

// 2. QUẢN LÝ ĐÁNH GIÁ MÓN ĂN (DISHES)
export function getLocalDishReviews(foodId: string): DishReview[] {
  const initial = INITIAL_DISH_REVIEWS[foodId] || [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISHES);
    if (!raw) return initial;
    const allCustom: Record<string, DishReview[]> = JSON.parse(raw);
    // Lọc bỏ bất kỳ đánh giá giả lập cũ nào (nếu đã lưu trong cache trình duyệt)
    const custom = (allCustom[foodId] || []).filter(r => !r.id.startsWith('init_dish_'));
    return [...custom, ...initial];
  } catch {
    return initial;
  }
}

// Lấy tóm tắt điểm sao trên góc món ăn
export function getDishRatingSummary(foodId: string): { avgRating: number; count: number; displayRating: string } {
  const reviews = getLocalDishReviews(foodId);
  if (!reviews || reviews.length === 0) {
    return { avgRating: 5.0, count: 0, displayRating: '5.0' };
  }
  const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
  const avg = Number((sum / reviews.length).toFixed(1));
  return { avgRating: avg, count: reviews.length, displayRating: avg.toFixed(1) };
}

export function saveLocalDishReview(foodId: string, review: Omit<DishReview, 'id' | 'date'>): DishReview {
  const newReview: DishReview = {
    ...review,
    id: 'dish_rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    date: 'Vừa xong',
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISHES);
    const allCustom: Record<string, DishReview[]> = raw ? JSON.parse(raw) : {};
    if (!allCustom[foodId]) allCustom[foodId] = [];
    allCustom[foodId].unshift(newReview);
    localStorage.setItem(STORAGE_KEY_DISHES, JSON.stringify(allCustom));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync'));
    }
  } catch (err) {
    console.warn('Cannot save dish review to localStorage', err);
  }

  return newReview;
}

// 3. THỐNG KÊ ĐÁNH GIÁ CỦA NGƯỜI DÙNG (DÙNG CHO BẢNG ĐIỂM)
export interface UserReviewStats {
  placeReviewsCount: number;
  dishReviewsCount: number;
  totalReviews: number;
}

export function getUserReviewsStats(authorName?: string): UserReviewStats {
  if (typeof window === 'undefined') {
    return { placeReviewsCount: 0, dishReviewsCount: 0, totalReviews: 0 };
  }

  let placeCount = 0;
  let dishCount = 0;

  try {
    const rawPlaces = localStorage.getItem(STORAGE_KEY_PLACES);
    if (rawPlaces) {
      const placesData: Record<string, Review[]> = JSON.parse(rawPlaces);
      for (const revList of Object.values(placesData)) {
        if (Array.isArray(revList)) {
          if (authorName) {
            placeCount += revList.filter(r => r.author === authorName).length;
          } else {
            placeCount += revList.length;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc thống kê đánh giá quán:', err);
  }

  try {
    const rawDishes = localStorage.getItem(STORAGE_KEY_DISHES);
    if (rawDishes) {
      const dishesData: Record<string, DishReview[]> = JSON.parse(rawDishes);
      for (const revList of Object.values(dishesData)) {
        if (Array.isArray(revList)) {
          if (authorName) {
            dishCount += revList.filter(r => r.author === authorName).length;
          } else {
            dishCount += revList.length;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc thống kê đánh giá món:', err);
  }

  return {
    placeReviewsCount: placeCount,
    dishReviewsCount: dishCount,
    totalReviews: placeCount + dishCount,
  };
}
