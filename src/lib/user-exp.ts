// Quản lý hệ thống điểm kinh nghiệm & cấp độ ẩm thực Xuân Hòa (Không cần đăng ký tài khoản)

export interface UserGourmetProfile {
  spinsCount: number;
  exp: number;
  level: number;
  title: string;
  nextExp: number;
  lastExpGain?: number;
  isJackpot?: boolean;
}

export const LEVEL_TITLES = [
  'Người mới ghé Xuân Hòa',
  'Tín đồ ẩm thực',
  'Thực khách sành ăn',
  'Thổ địa ẩm thực Xuân Hòa',
  'Chuyên gia sành ăn Đại Lải',
  'Trùm ẩm thực Phường Xuân Hòa',
  'Huyền thoại Bếp Vương',
];

export const EXP_PER_LEVEL = 150;
const STORAGE_KEY = 'xuanhoa_gourmet_profile_v1';

export function getExpForRarity(rarity: number = 0): { exp: number; label: string; color: string; isJackpot: boolean } {
  switch (rarity) {
    case 0:
      return { exp: 25, label: '+25 EXP (Hòm Phổ Thông)', color: '#10B981', isJackpot: false };
    case 1:
      return { exp: 50, label: '+50 EXP (Hòm Đặc Biệt)', color: '#F59E0B', isJackpot: false };
    case 2:
      return { exp: 100, label: '+100 EXP (Hòm Quý Hiếm)', color: '#A855F7', isJackpot: false };
    case 3:
      return { exp: 200, label: '+200 EXP (Hòm Cực Hiếm)', color: '#F97316', isJackpot: false };
    case 4:
      return { exp: 500, label: '+500 EXP (HUYỀN THOẠI - NỔ HŨ)', color: '#EF4444', isJackpot: true };
    default:
      return { exp: 35, label: '+35 EXP', color: '#10B981', isJackpot: false };
  }
}

export function getLocalProfile(): UserGourmetProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const level = Math.min(LEVEL_TITLES.length, Math.max(1, Math.floor(data.exp / EXP_PER_LEVEL) + 1));
      return {
        spinsCount: data.spinsCount || 0,
        exp: data.exp || 0,
        level,
        title: LEVEL_TITLES[level - 1] || LEVEL_TITLES[0],
        nextExp: level * EXP_PER_LEVEL,
      };
    }
  } catch {}

  return {
    spinsCount: 0,
    exp: 40,
    level: 1,
    title: LEVEL_TITLES[0],
    nextExp: EXP_PER_LEVEL,
  };
}

export function addSpinExp(rarity?: number): UserGourmetProfile {
  const current = getLocalProfile();
  
  let addedExp = Math.floor(Math.random() * 20) + 35;
  let isJackpot = false;

  if (rarity !== undefined) {
    const reward = getExpForRarity(rarity);
    addedExp = reward.exp;
    isJackpot = reward.isJackpot;
  }

  const nextExpTotal = current.exp + addedExp;
  const nextSpins = current.spinsCount + 1;
  const nextLevel = Math.min(LEVEL_TITLES.length, Math.floor(nextExpTotal / EXP_PER_LEVEL) + 1);

  const updated: UserGourmetProfile = {
    spinsCount: nextSpins,
    exp: nextExpTotal,
    level: nextLevel,
    title: LEVEL_TITLES[nextLevel - 1] || LEVEL_TITLES[0],
    nextExp: nextLevel * EXP_PER_LEVEL,
    lastExpGain: addedExp,
    isJackpot,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      spinsCount: nextSpins,
      exp: nextExpTotal,
    }));
  } catch {}

  return updated;
}
