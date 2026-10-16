// Quản lý lịch sử các món đã ăn / đã quay của thực khách Xuân Hòa
export interface FoodHistoryItem {
  id: string;
  foodId: string;
  name: string;
  image: string;
  price: number;
  placeName?: string;
  timestamp: number;
}

const HISTORY_STORAGE_KEY = 'xuanhoa_food_history_v1';

export function getFoodHistory(): FoodHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveFoodHistoryItem(item: {
  foodId: string;
  name: string;
  image: string;
  price: number;
  placeName?: string;
}): FoodHistoryItem {
  const newItem: FoodHistoryItem = {
    ...item,
    id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
  };

  if (typeof window === 'undefined') return newItem;
  try {
    const history = getFoodHistory();
    // Giữ tối đa 30 món gần nhất, loại bỏ trùng tên liền trước
    const updated = [newItem, ...history.filter(h => h.name !== item.name)].slice(0, 30);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('xuanhoa_history_change', { detail: updated }));
  } catch (err) {
    console.warn('Lỗi lưu lịch sử món đã ăn:', err);
  }
  return newItem;
}
