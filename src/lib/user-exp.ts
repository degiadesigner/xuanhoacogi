// Quản lý hệ thống cấp độ ẩm thực Xuân Hòa TÍNH THEO SỐ LƯỢNG MÓN ĂN
// Khách vãng lai: Tối đa Cấp 1 (tối đa 3 món ăn khám phá). Vượt quá 3 món -> Nhắc đăng nhập.

export interface UserGourmetProfile {
  spinsCount: number;
  dishesCount: number; // SỐ LƯỢNG MÓN ĂN TRONG BỘ SƯU TẬP
  exp: number;
  level: number;
  title: string;
  badge: string;
  currentLevelMinDishes: number;
  nextLevelDishes: number;
  currentLevelMinExp: number;
  nextExp: number;
  progressPercent: number;
  lastExpGain?: number;
  isJackpot?: boolean;
}

export interface LevelTierConfig {
  minLevel: number;
  maxLevel: number;
  title: string;
  badge: string;
}

// Hệ thống 50 Cấp Độ Danh Giá theo 9 Bậc Thực Khách Ẩm Thực Xuân Hòa
export const LEVEL_TIERS: LevelTierConfig[] = [
  { minLevel: 1, maxLevel: 2, title: 'Tân Khách Xuân Hòa', badge: '🥉' },
  { minLevel: 3, maxLevel: 5, title: 'Tín Đồ Ăn Vặt', badge: '🥈' },
  { minLevel: 6, maxLevel: 9, title: 'Thực Khách Quen Mặt', badge: '🥇' },
  { minLevel: 10, maxLevel: 14, title: 'Sành Ăn ĐHSP2', badge: '💎' },
  { minLevel: 15, maxLevel: 20, title: 'Thổ Địa Quán Xá', badge: '👑' },
  { minLevel: 21, maxLevel: 28, title: 'Chuyên Gia Ẩm Thực Phúc Yên', badge: '🌟' },
  { minLevel: 29, maxLevel: 38, title: 'Trùm Ẩm Thực Xuân Hòa', badge: '🔥' },
  { minLevel: 39, maxLevel: 49, title: 'Đại Cao Thủ Bếp Vương', badge: '⚡' },
  { minLevel: 50, maxLevel: 50, title: 'Huyền Thoại Ẩm Thực Phú Thọ', badge: '🏆' },
];

export const LEVEL_TITLES = LEVEL_TIERS.map(t => t.title);
export const MAX_LEVEL = 50;

// CẤP ĐỘ TÍNH THEO SỐ LƯỢNG MÓN ĂN (DISHES COUNT)
// Cấp 1: 0 - 3 món (Khách vãng lai)
// Cấp 2: 4 - 7 món (Cần đăng nhập)
// Cấp 3: 8 - 12 món ...
export function getMinDishesForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 4;
  if (level === 3) return 8;
  if (level === 4) return 13;
  if (level === 5) return 19;
  if (level === 6) return 26;
  if (level === 7) return 34;
  if (level === 8) return 43;
  if (level === 9) return 53;
  if (level === 10) return 64;
  const l = Math.min(MAX_LEVEL, level) - 10;
  return 64 + l * 8;
}

export function getTierForLevel(level: number): { title: string; badge: string } {
  const tier = LEVEL_TIERS.find(t => level >= t.minLevel && level <= t.maxLevel);
  if (tier) return { title: tier.title, badge: tier.badge };
  return { title: LEVEL_TIERS[0].title, badge: LEVEL_TIERS[0].badge };
}

export function calculateLevelFromDishes(dishesCount: number): {
  level: number;
  currentLevelMinDishes: number;
  nextLevelDishes: number;
  currentLevelMinExp: number;
  nextExp: number;
  progressPercent: number;
  title: string;
  badge: string;
} {
  let level = 1;
  while (level < MAX_LEVEL && dishesCount >= getMinDishesForLevel(level + 1)) {
    level++;
  }

  const currentLevelMinDishes = getMinDishesForLevel(level);
  const nextLevelDishes = level >= MAX_LEVEL ? currentLevelMinDishes : getMinDishesForLevel(level + 1);
  
  const span = Math.max(1, nextLevelDishes - currentLevelMinDishes);
  const progressPercent = level >= MAX_LEVEL 
    ? 100 
    : Math.min(100, Math.max(0, Math.round(((dishesCount - currentLevelMinDishes) / span) * 100)));

  const { title, badge } = getTierForLevel(level);

  return {
    level,
    currentLevelMinDishes,
    nextLevelDishes,
    currentLevelMinExp: currentLevelMinDishes * 10,
    nextExp: nextLevelDishes * 10,
    progressPercent,
    title,
    badge,
  };
}

// Tương thích ngược với hàm calculateLevelFromExp
export function calculateLevelFromExp(exp: number) {
  // Quy đổi tương đương: 10 EXP ~ 1 món
  const dishes = Math.floor(exp / 10);
  return calculateLevelFromDishes(dishes);
}

export function getExpForRarity(rarity: number = 0): { exp: number; label: string; color: string; isJackpot: boolean } {
  switch (rarity) {
    case 0:
      return { exp: 6, label: '+1 Món (Phổ Thông)', color: '#10B981', isJackpot: false };
    case 1:
      return { exp: 12, label: '+1 Món (Đặc Biệt)', color: '#F59E0B', isJackpot: false };
    case 2:
      return { exp: 20, label: '+1 Món (Quý Hiếm)', color: '#A855F7', isJackpot: false };
    case 3:
      return { exp: 35, label: '+1 Món (Cực Hiếm)', color: '#F97316', isJackpot: false };
    case 4:
      return { exp: 80, label: '+1 Món (HUYỀN THOẠI)', color: '#EF4444', isJackpot: true };
    default:
      return { exp: 8, label: '+1 Món', color: '#10B981', isJackpot: false };
  }
}

const STORAGE_KEY_V2 = 'xuanhoa_gourmet_profile_v2';

export function getLocalProfile(): UserGourmetProfile {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const data = JSON.parse(rawV2);
      const spinsCount = Number(data.spinsCount) || 0;
      const dishesCount = Number(data.dishesCount) || Math.min(spinsCount, 1);
      const exp = Number(data.exp) || dishesCount * 10;
      const stats = calculateLevelFromDishes(dishesCount);
      return {
        spinsCount,
        dishesCount,
        exp,
        ...stats,
      };
    }
  } catch {}

  const stats = calculateLevelFromDishes(0);
  return {
    spinsCount: 0,
    dishesCount: 0,
    exp: 0,
    ...stats,
  };
}

export function addSpinExp(rarity?: number, isLoggedIn: boolean = false, isNewDish: boolean = true): {
  profile: UserGourmetProfile;
  reachedGuestLimit: boolean;
} {
  const current = getLocalProfile();
  
  const nextSpins = current.spinsCount + 1;
  let nextDishes = current.dishesCount + (isNewDish ? 1 : 1);
  let reachedGuestLimit = false;

  // GIỚI HẠN CẤP 1 CHO KHÁCH VÃNG LAI: Tối đa 3 món ăn!
  // Khi đã có 3 món và chuẩn bị vượt lên món thứ 4 (Cấp 2), kích hoạt Gate Modal
  if (!isLoggedIn && nextDishes >= 3) {
    reachedGuestLimit = true;
    nextDishes = 3; // Cố định ở 3 món (trần Cấp 1)
  }

  const stats = calculateLevelFromDishes(nextDishes);

  // Nếu chưa đăng nhập và đạt 3 món: Cố định Cấp 1 (100% 3/3 món)
  if (!isLoggedIn && nextDishes >= 3) {
    stats.level = 1;
    stats.progressPercent = 100;
    stats.title = 'Tân Khách Xuân Hòa';
    stats.badge = '🥉';
  }

  const updated: UserGourmetProfile = {
    spinsCount: nextSpins,
    dishesCount: nextDishes,
    exp: nextDishes * 10,
    ...stats,
    lastExpGain: 1,
    isJackpot: rarity === 4,
  };

  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({
      spinsCount: nextSpins,
      dishesCount: nextDishes,
      exp: nextDishes * 10,
    }));
  } catch {}

  return { profile: updated, reachedGuestLimit };
}
