import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signInWithCredential, 
  signOut as fbSignOut, 
  User 
} from 'firebase/auth';
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

export const GOOGLE_CLIENT_ID = "691215879950-nulp01gi8js5j1m9jno1ih86g98hj381.apps.googleusercontent.com";

// Kiểm tra trình duyệt Chrome trên hệ điều hành iOS (CriOS)
export function isChromeOnIos(): boolean {
  if (typeof window === 'undefined') return false;
  return /CriOS/i.test(navigator.userAgent);
}

// Đảm bảo thư viện Google Identity Services (GIS) đã nạp xong
export async function ensureGsiLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).google?.accounts?.oauth2) return true;

  return new Promise((resolve) => {
    let waited = 0;
    const interval = setInterval(() => {
      if ((window as any).google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve(true);
      } else if (waited >= 3500) {
        clearInterval(interval);
        resolve(false);
      }
      waited += 100;
    }, 100);
  });
}

// Kiểm tra kết quả chuyển hướng đăng nhập Google (dành cho Chrome iOS hoặc khi dùng redirect)
export async function checkRedirectAuthResult(): Promise<UserAuthProfile | null> {
  if (typeof window === 'undefined') return null;
  try {
    if (!firebaseConfig.apiKey) return null;
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const u = result.user;
      const existing = getStoredAuthUser();
      const updated: UserAuthProfile = {
        isLoggedIn: true,
        uid: u.uid,
        email: u.email || 'thuckhach@gmail.com',
        displayName: u.displayName || u.email?.split('@')[0] || 'Thực khách',
        nickname: existing?.nickname || u.displayName || u.email?.split('@')[0] || 'Thực khách',
        gender: existing?.gender || 'male',
        avatar: existing?.avatar || '🐭',
        avatarId: existing?.avatarId || 'm_ty',
        residentType: existing?.residentType || 'student_sp2',
        tastePreferences: existing?.tastePreferences || ['lau_nuong', 'tra_sua'],
        filterByTaste: existing?.filterByTaste ?? true,
        photoURL: u.photoURL || undefined,
        hasCompletedProfile: existing?.hasCompletedProfile || false,
        createdAt: existing?.createdAt || Date.now(),
      };
      saveAuthUser(updated);
      return updated;
    }
  } catch (err: any) {
    console.warn('Lỗi kiểm tra getRedirectResult:', err?.message || err);
  }
  return null;
}

// Xử lý xác thực Google OAuth 2.0 chuẩn chỉ, mở cửa sổ Google thật để chọn Gmail và đồng ý kết nối
export async function signInWithGoogleService(): Promise<{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}> {
  // 1. Kiểm tra môi trường Chrome trên iOS (CriOS):
  // Trên Chrome iOS, cơ chế mở popup cửa sổ ngoài bị trình duyệt cô lập khiến accounts.google.com bị trắng.
  // Do đó, trên Chrome iOS bắt buộc kích hoạt signInWithRedirect chuyển hướng toàn trang chính thống của Google!
  if (isChromeOnIos()) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithRedirect(auth, provider);
    return new Promise(() => {}); // Chờ trình duyệt chuyển hướng
  }

  // 2. Với các trình duyệt khác (Cốc Cốc, Desktop Chrome, Safari, Android, Edge...):
  // Ưu tiên Google Identity Services (GIS) - hiển thị popup chọn Gmail và cấp quyền tức thì (Đã hoạt động 100% trên Cốc Cốc)
  const gsiReady = await ensureGsiLoaded();
  const google = typeof window !== 'undefined' ? (window as any).google : null;

  if (gsiReady && google?.accounts?.oauth2) {
    try {
      return await new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'popup_closed_by_user') {
                reject(new Error('Người dùng đã đóng cửa sổ Google'));
                return;
              }
              reject(new Error(tokenResponse.error_description || tokenResponse.error));
              return;
            }

            try {
              // Lấy thông tin tài khoản Google thật từ Google UserInfo API
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              if (!res.ok) {
                throw new Error('Không thể tải thông tin hồ sơ Google');
              }
              const info = await res.json();

              // Đồng bộ phiên xác thực sang Firebase Authentication
              try {
                const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
                const auth = getAuth(app);
                const credential = GoogleAuthProvider.credential(null, tokenResponse.access_token);
                await signInWithCredential(auth, credential);
              } catch (fbErr) {
                console.warn('Firebase sync warning:', fbErr);
              }

              resolve({
                uid: info.sub || 'google_' + Date.now(),
                email: info.email || 'thuckhach@gmail.com',
                displayName: info.name || info.email?.split('@')[0] || 'Thực Khách',
                photoURL: info.picture || undefined,
              });
            } catch (fetchErr) {
              reject(fetchErr);
            }
          },
        });

        // Bật cửa sổ chọn tài khoản Gmail thật của Google và cấp quyền kết nối
        client.requestAccessToken({ prompt: 'select_account' });
      });
    } catch (popupErr: any) {
      console.warn('GIS popup failed, falling back to redirect:', popupErr);
      if (firebaseConfig.apiKey) {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithRedirect(auth, provider);
        return new Promise(() => {});
      }
      throw popupErr;
    }
  }

  // 3. Phương thức phụ trợ: Firebase signInWithRedirect
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithRedirect(auth, provider);
    return new Promise(() => {});
  }

  throw new Error('Chưa thể kết nối tới máy chủ Google OAuth');
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
