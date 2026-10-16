// Quản lý trạng thái xác thực và hồ sơ thực khách Google Gmail cho XuanHoaCoGi
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, User } from 'firebase/auth';
import { firebaseConfig } from './firebase';

export type UserResidentType = 'student_sp2' | 'student_other' | 'local' | 'worker' | 'tourist';

export interface ResidentTypeOption {
  id: UserResidentType;
  label: string;
  sublabel: string;
  emoji: string;
}

export const RESIDENT_TYPE_OPTIONS: ResidentTypeOption[] = [
  { id: 'student_sp2', label: 'Sinh viên ĐHSP Hà Nội 2', sublabel: 'Ngon - Rẻ - Quán ruột SV', emoji: '🎓' },
  { id: 'student_other', label: 'Học sinh / SV trường khác', sublabel: 'Cơ Điện, THPT, Lân cận...', emoji: '🎒' },
  { id: 'local', label: 'Dân bản địa Xuân Hòa', sublabel: 'Chuẩn vị truyền thống & lâu đời', emoji: '🏡' },
  { id: 'worker', label: 'Người đi làm / Văn phòng', sublabel: 'Nhanh gọn, chất lượng, tiếp khách', emoji: '💼' },
  { id: 'tourist', label: 'Khách du lịch / Vãng lai', sublabel: 'Khám phá đặc sản Đại Lải - Xuân Hòa', emoji: '🚗' },
];

export function getResidentTypeInfo(type?: UserResidentType): ResidentTypeOption {
  const found = RESIDENT_TYPE_OPTIONS.find(r => r.id === type);
  return found || RESIDENT_TYPE_OPTIONS[0];
}

export interface UserAuthProfile {
  isLoggedIn: boolean;
  uid?: string;
  email?: string;
  displayName: string;
  nickname: string;
  gender: 'male' | 'female' | 'other';
  avatar: string; // Emoji linh vật hoặc ảnh avatar
  avatarId: string;
  phone?: string;
  residentType?: UserResidentType; // Nhóm đối tượng thực khách (SV SP2, trường khác, dân bản địa...)
  tastePreferences?: string[];
  filterByTaste?: boolean; // Bật/Tắt bộ lọc theo gu ẩm thực
  photoURL?: string;
  hasCompletedProfile: boolean;
  createdAt: number;
}

export interface TastePreferenceOption {
  id: string;
  label: string;
  emoji: string;
}

export const TASTE_PREFERENCES_OPTIONS: TastePreferenceOption[] = [
  { id: 'spicy', label: 'Nghiện ăn cay', emoji: '🌶️' },
  { id: 'non_spicy', label: 'Thanh đạm, ít cay', emoji: '🍲' },
  { id: 'lau_nuong', label: 'Mê lẩu & nướng', emoji: '🥩' },
  { id: 'tra_sua', label: 'Trà sữa đồ ngọt', emoji: '🧋' },
  { id: 'nhau_bia', label: 'Bia mồi vỉa hè', emoji: '🍺' },
  { id: 'bun_pho', label: 'Bún, phở đậm đà', emoji: '🍜' },
  { id: 'an_vat_dem', label: 'Cú đêm ăn vặt', emoji: '🌙' },
  { id: 'cafe_chill', label: 'Cafe chill tán gẫu', emoji: '☕' },
  { id: 'healthy', label: 'Healthy ít béo', emoji: '🥗' },
  { id: 'an_chay', label: 'Món chay thanh tịnh', emoji: '🌿' },
];

export interface MascotAvatar {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  zodiac: string;
  gender: 'male' | 'female';
  bgGradient: string;
  accentColor: string;
}

// 12 Con Giáp Đẳng Cấp Cho NAM (Bản lĩnh, Khí chất, Soái ca Ẩm Thực)
export const MALE_ZODIAC_AVATARS: MascotAvatar[] = [
  { id: 'm_ty', emoji: '🐭', name: 'Tý Lém Lỉnh', tagline: 'Soái Ca Tinh Anh', zodiac: 'Tý', gender: 'male', bgGradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', accentColor: '#3b82f6' },
  { id: 'm_suu', emoji: '🐂', name: 'Sửu Dũng Mãnh', tagline: 'Bền Bỉ Trấn Thủ', zodiac: 'Sửu', gender: 'male', bgGradient: 'linear-gradient(135deg, #10b981, #047857)', accentColor: '#10b981' },
  { id: 'm_dan', emoji: '🐯', name: 'Dần Bá Vương', tagline: 'Mãnh Hổ Ẩm Thực', zodiac: 'Dần', gender: 'male', bgGradient: 'linear-gradient(135deg, #f97316, #b91c1c)', accentColor: '#f97316' },
  { id: 'm_mao', emoji: '🐱', name: 'Mão Quý Tộc', tagline: 'Hoàng Tử Sành Ăn', zodiac: 'Mão', gender: 'male', bgGradient: 'linear-gradient(135deg, #f59e0b, #d97706)', accentColor: '#f59e0b' },
  { id: 'm_thin', emoji: '🐲', name: 'Thìn Hoàng Gia', tagline: 'Long Vương Phú Thọ', zodiac: 'Thìn', gender: 'male', bgGradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', accentColor: '#8b5cf6' },
  { id: 'm_ty_snake', emoji: '🐍', name: 'Tỵ Thần Bí', tagline: 'Hào Kiệt Bản Lĩnh', zodiac: 'Tỵ', gender: 'male', bgGradient: 'linear-gradient(135deg, #06b6d4, #0e7490)', accentColor: '#06b6d4' },
  { id: 'm_ngo', emoji: '🐴', name: 'Ngọ Tuấn Mã', tagline: 'Phong Trần Tiên Phong', zodiac: 'Ngọ', gender: 'male', bgGradient: 'linear-gradient(135deg, #ec4899, #be185d)', accentColor: '#ec4899' },
  { id: 'm_mui', emoji: '🐐', name: 'Mùi Hảo Hán', tagline: 'Đệ Nhất Bếp Vương', zodiac: 'Mùi', gender: 'male', bgGradient: 'linear-gradient(135deg, #eab308, #a16207)', accentColor: '#eab308' },
  { id: 'm_than', emoji: '🐵', name: 'Thân Đại Thánh', tagline: 'Thông Thái Cơ Trí', zodiac: 'Thân', gender: 'male', bgGradient: 'linear-gradient(135deg, #6366f1, #4338ca)', accentColor: '#6366f1' },
  { id: 'm_dau', emoji: '🐓', name: 'Dậu Tiên Phong', tagline: 'Đại Soái Uy Vũ', zodiac: 'Dậu', gender: 'male', bgGradient: 'linear-gradient(135deg, #ef4444, #991b1b)', accentColor: '#ef4444' },
  { id: 'm_tuat', emoji: '🐶', name: 'Tuất Hiệp Sĩ', tagline: 'Trung Nghĩa Trọn Đời', zodiac: 'Tuất', gender: 'male', bgGradient: 'linear-gradient(135deg, #14b8a6, #0f766e)', accentColor: '#14b8a6' },
  { id: 'm_hoi', emoji: '🐷', name: 'Hợi Phúc Lộc', tagline: 'Đại Gia Viên Mãn', zodiac: 'Hợi', gender: 'male', bgGradient: 'linear-gradient(135deg, #fb7185, #e11d48)', accentColor: '#fb7185' },
];

// 12 Con Giáp Kiều Diễm Cho NỮ (Ngọt ngào, Quý phái, Xinh xắn)
export const FEMALE_ZODIAC_AVATARS: MascotAvatar[] = [
  { id: 'f_ty', emoji: '🐭', name: 'Tý Đáng Yêu', tagline: 'Tiểu Đậu Xinh Tươi', zodiac: 'Tý', gender: 'female', bgGradient: 'linear-gradient(135deg, #f472b6, #db2777)', accentColor: '#f472b6' },
  { id: 'f_suu', emoji: '🐮', name: 'Sửu Dịu Dàng', tagline: 'Nàng Thơ Trà Chiều', zodiac: 'Sửu', gender: 'female', bgGradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)', accentColor: '#a78bfa' },
  { id: 'f_dan', emoji: '🐯', name: 'Dần Nữ Vương', tagline: 'Cá Tính Sang Chảnh', zodiac: 'Dần', gender: 'female', bgGradient: 'linear-gradient(135deg, #fb923c, #ea580c)', accentColor: '#fb923c' },
  { id: 'f_mao', emoji: '🐱', name: 'Mão Tiểu Thư', tagline: 'Công Chúa Trà Sữa', zodiac: 'Mão', gender: 'female', bgGradient: 'linear-gradient(135deg, #f9a8d4, #f43f5e)', accentColor: '#f9a8d4' },
  { id: 'f_thin', emoji: '🐲', name: 'Thìn Thiên Kim', tagline: 'Ái Nữ Quyền Quý', zodiac: 'Thìn', gender: 'female', bgGradient: 'linear-gradient(135deg, #c084fc, #9333ea)', accentColor: '#c084fc' },
  { id: 'f_ty_snake', emoji: '🐍', name: 'Tỵ Mỹ Nhân', tagline: 'Kiêu Sa Diễm Lệ', zodiac: 'Tỵ', gender: 'female', bgGradient: 'linear-gradient(135deg, #2dd4bf, #0d9488)', accentColor: '#2dd4bf' },
  { id: 'f_ngo', emoji: '🐴', name: 'Ngọ Năng Động', tagline: 'Tiểu Thư Rực Rỡ', zodiac: 'Ngọ', gender: 'female', bgGradient: 'linear-gradient(135deg, #38bdf8, #0284c7)', accentColor: '#38bdf8' },
  { id: 'f_mui', emoji: '🐐', name: 'Mùi Ngọt Ngào', tagline: 'Kẹo Ngọt ĐHSP2', zodiac: 'Mùi', gender: 'female', bgGradient: 'linear-gradient(135deg, #fda4af, #f43f5e)', accentColor: '#fda4af' },
  { id: 'f_than', emoji: '🐵', name: 'Thân Thông Thái', tagline: 'Cô Nàng Tri Thức', zodiac: 'Thân', gender: 'female', bgGradient: 'linear-gradient(135deg, #818cf8, #4f46e5)', accentColor: '#818cf8' },
  { id: 'f_dau', emoji: '🐣', name: 'Dậu Kiêu Kỳ', tagline: 'Hoa Khôi Xuân Hòa', zodiac: 'Dậu', gender: 'female', bgGradient: 'linear-gradient(135deg, #fde047, #ca8a04)', accentColor: '#fde047' },
  { id: 'f_tuat', emoji: '🐶', name: 'Tuất Tinh Nghịch', tagline: 'Em Bé Dễ Thương', zodiac: 'Tuất', gender: 'female', bgGradient: 'linear-gradient(135deg, #6ee7b7, #059669)', accentColor: '#6ee7b7' },
  { id: 'f_hoi', emoji: '🐷', name: 'Hợi Phúc Hậu', tagline: 'Búp Bê May Mắn', zodiac: 'Hợi', gender: 'female', bgGradient: 'linear-gradient(135deg, #f472b6, #e11d48)', accentColor: '#f472b6' },
];

export const ALL_ZODIAC_AVATARS: MascotAvatar[] = [...MALE_ZODIAC_AVATARS, ...FEMALE_ZODIAC_AVATARS];

// Tương thích ngược với MASCOT_AVATARS
export const MASCOT_AVATARS: MascotAvatar[] = ALL_ZODIAC_AVATARS;

export function getMascotById(id: string): MascotAvatar {
  const found = ALL_ZODIAC_AVATARS.find(m => m.id === id);
  if (found) return found;
  if (id === 'cat') return MALE_ZODIAC_AVATARS[3];
  if (id === 'dog') return MALE_ZODIAC_AVATARS[10];
  return MALE_ZODIAC_AVATARS[0];
}

const AUTH_STORAGE_KEY = 'xuanhoa_auth_user_v1';

export function getStoredAuthUser(): UserAuthProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user: UserAuthProfile = JSON.parse(raw);
    return user.isLoggedIn ? user : null;
  } catch {
    return null;
  }
}

export function saveAuthUser(user: UserAuthProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('xuanhoa_auth_change', { detail: user }));
  } catch (err) {
    console.warn('Lỗi lưu tài khoản người dùng:', err);
  }
}

export function clearAuthUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('xuanhoa_auth_change', { detail: null }));
  } catch (err) {
    console.warn('Lỗi đăng xuất:', err);
  }
}

// Xử lý xác thực Google (Firebase Auth kèm Fallback mượt mà cho trải nghiệm Demo)
export async function signInWithGoogleService(): Promise<{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}> {
  // 1. Nếu có cấu hình Firebase API Key thực tế -> Gọi Firebase Google Auth Popup
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5) {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      return {
        uid: user.uid,
        email: user.email || 'user@gmail.com',
        displayName: user.displayName || user.email?.split('@')[0] || 'Thực khách Xuân Hòa',
        photoURL: user.photoURL || undefined,
      };
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        throw new Error('Người dùng đã hủy cửa sổ đăng nhập Google');
      }
      console.warn('Firebase signInWithPopup warning:', err?.code, err?.message || err);
      if (err?.code === 'auth/unauthorized-domain') {
        alert('Tên miền này chưa được cấp phép trong Firebase! Vui lòng vào Firebase Console > Authentication > Settings > Authorized Domains để thêm tên miền.');
      }
      throw err;
    }
  }

  // 2. Chế độ tương thích tức thì (Demo / Localhost) để người dùng thử nghiệm trơn tru 100%
  // Giả lập phản hồi đăng nhập Google một chạm mượt mà
  await new Promise(resolve => setTimeout(resolve, 400));
  return {
    uid: 'google_user_' + Math.random().toString(36).substring(2, 9),
    email: 'thuckhach.xuanhoa@gmail.com',
    displayName: 'Thực Khách Sành Ăn',
    photoURL: undefined,
  };
}

export async function signOutService(): Promise<void> {
  try {
    if (firebaseConfig.apiKey) {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      await fbSignOut(auth);
    }
  } catch (err) {
    console.warn('Firebase signOut warning:', err);
  } finally {
    clearAuthUser();
  }
}
