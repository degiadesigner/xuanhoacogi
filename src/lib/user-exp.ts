// Quản lý hệ thống điểm kinh nghiệm & cấp độ ẩm thực Xuân Hòa (Không cần đăng ký tài khoản)

export interface UserGourmetProfile {
  spinsCount: number;
  exp: number;
  level: number;
  title: string;
  badge: string;
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
  { minLevel: 50, maxLevel: 50, title: 'Huyền Thoại Ẩm Thực Vĩnh Phúc', badge: '🏆' },
];

export const LEVEL_TITLES = LEVEL_TIERS.map(t => t.title);
export const MAX_LEVEL = 50;

// Hàm tính tổng EXP yêu cầu để đạt Level (Đường cong lũy tiến RPG mượt mà, chống lạm phát cấp)
export function getMinExpForLevel(level: number): number {
  if (level <= 1) return 0;
  const l = Math.min(MAX_LEVEL, level) - 1;
  return Math.floor(15 * l * l + 10 * l);
}

export function getTierForLevel(level: number): { title: string; badge: string } {
  const tier = LEVEL_TIERS.find(t => level >= t.minLevel && level <= t.maxLevel);
  if (tier) return { title: tier.title, badge: tier.badge };
  return { title: LEVEL_TIERS[0].title, badge: LEVEL_TIERS[0].badge };
}

export function calculateLevelFromExp(exp: number): {
  level: number;
  currentLevelMinExp: number;
  nextExp: number;
  progressPercent: number;
  title: string;
  badge: string;
} {
  let level = 1;
  while (level < MAX_LEVEL && exp >= getMinExpForLevel(level + 1)) {
    level++;
  }

  const currentLevelMinExp = getMinExpForLevel(level);
  const nextExp = level >= MAX_LEVEL ? currentLevelMinExp : getMinExpForLevel(level + 1);
  
  const span = Math.max(1, nextExp - currentLevelMinExp);
  const progressPercent = level >= MAX_LEVEL 
    ? 100 
    : Math.min(100, Math.max(0, Math.round(((exp - currentLevelMinExp) / span) * 100)));

  const { title, badge } = getTierForLevel(level);

  return {
    level,
    currentLevelMinExp,
    nextExp,
    progressPercent,
    title,
    badge,
  };
}

// Thưởng điểm EXP cân bằng: Mỗi lượt quay tăng vừa phải, tạo động lực đua cấp bền vững
export function getExpForRarity(rarity: number = 0): { exp: number; label: string; color: string; isJackpot: boolean } {
  switch (rarity) {
    case 0:
      return { exp: 6, label: '+6 EXP (Hòm Phổ Thông)', color: '#10B981', isJackpot: false };
    case 1:
      return { exp: 12, label: '+12 EXP (Hòm Đặc Biệt)', color: '#F59E0B', isJackpot: false };
    case 2:
      return { exp: 20, label: '+20 EXP (Hòm Quý Hiếm)', color: '#A855F7', isJackpot: false };
    case 3:
      return { exp: 35, label: '+35 EXP (Hòm Cực Hiếm)', color: '#F97316', isJackpot: false };
    case 4:
      return { exp: 80, label: '+80 EXP (HUYỀN THOẠI · NỔ HŨ)', color: '#EF4444', isJackpot: true };
    default:
      return { exp: 8, label: '+8 EXP', color: '#10B981', isJackpot: false };
  }
}

const STORAGE_KEY_V2 = 'xuanhoa_gourmet_profile_v2';
const STORAGE_KEY_V1 = 'xuanhoa_gourmet_profile_v1';

export function getLocalProfile(): UserGourmetProfile {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const data = JSON.parse(rawV2);
      const spinsCount = Number(data.spinsCount) || 0;
      const exp = Number(data.exp) || 0;
      const stats = calculateLevelFromExp(exp);
      return {
        spinsCount,
        exp,
        ...stats,
      };
    }

    // Tự động chuyển đổi dữ liệu từ v1 cũ: Cân bằng lại điểm theo số lượt quay thực tế!
    // Tránh việc mới quay vài lần mà bị nhảy lên Cấp 7 ảo!
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const dataV1 = JSON.parse(rawV1);
      const spinsCount = Number(dataV1.spinsCount) || 0;
      // Điểm thực tế chuẩn = spinsCount * 8 EXP trung bình
      const convertedExp = Math.max(0, spinsCount * 8);
      const stats = calculateLevelFromExp(convertedExp);
      const profile: UserGourmetProfile = {
        spinsCount,
        exp: convertedExp,
        ...stats,
      };
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({
        spinsCount,
        exp: convertedExp,
      }));
      return profile;
    }
  } catch {}

  const stats = calculateLevelFromExp(0);
  return {
    spinsCount: 0,
    exp: 0,
    ...stats,
  };
}

export function addSpinExp(rarity?: number): UserGourmetProfile {
  const current = getLocalProfile();
  
  let addedExp = 8;
  let isJackpot = false;

  if (rarity !== undefined) {
    const reward = getExpForRarity(rarity);
    addedExp = reward.exp;
    isJackpot = reward.isJackpot;
  }

  const nextExpTotal = current.exp + addedExp;
  const nextSpins = current.spinsCount + 1;
  const stats = calculateLevelFromExp(nextExpTotal);

  const updated: UserGourmetProfile = {
    spinsCount: nextSpins,
    exp: nextExpTotal,
    ...stats,
    lastExpGain: addedExp,
    isJackpot,
  };

  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({
      spinsCount: nextSpins,
      exp: nextExpTotal,
    }));
  } catch {}

  return updated;
}
