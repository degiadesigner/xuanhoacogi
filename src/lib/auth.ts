import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signInWithCredential, 
  onAuthStateChanged,
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
  isFirstTimeSetupDone?: boolean;
  isMerchantAccount?: boolean; // Đã xác thực Mã Code Quán -> Trở thành Nick Quán Chính Chủ
  isMapManager?: boolean; // Đã xác thực Mã Quản lý Maps (XH-MAPS-8899) -> Cấp quyền CTV Quản lý Định vị & Tạo Địa điểm mới
  merchantPlaceId?: string;
  merchantPlaceName?: string;
  merchantVerifiedCode?: string;
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
const AUTH_COOKIE_NAME = 'xuanhoa_auth_cookie_v1';
const LOGGED_OUT_KEY = 'xuanhoa_logged_out_explicitly';
const PROFILE_BY_EMAIL_PREFIX = 'xuanhoa_profile_email_';
const JUST_LOGGED_IN_KEY = 'xuanhoa_just_logged_in_v1';

export const GOOGLE_CLIENT_ID = "691215879950-nulp01gi8js5j1m9jno1ih86g98hj381.apps.googleusercontent.com";
export const GOOGLE_REDIRECT_URI = "https://xuanhoacogi.com/__/auth/handler";

function writeAuthCookie(user: UserAuthProfile): void {
  if (typeof document === 'undefined') return;
  try {
    const compactUser: UserAuthProfile = {
      ...user,
      photoURL: user.photoURL && user.photoURL.length < 450 ? user.photoURL : undefined,
    };
    const encoded = encodeURIComponent(JSON.stringify(compactUser));
    const maxAge = 365 * 24 * 60 * 60; // 365 ngày
    document.cookie = `${AUTH_COOKIE_NAME}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('xuanhoacogi.com')) {
      document.cookie = `${AUTH_COOKIE_NAME}=${encoded}; domain=.xuanhoacogi.com; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
    }
  } catch (err) {
    console.warn('Cookie write warning:', err);
  }
}

function readAuthCookie(): UserAuthProfile | null {
  if (typeof document === 'undefined') return null;
  try {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const c of cookies) {
      if (c.startsWith(`${AUTH_COOKIE_NAME}=`)) {
        const val = c.substring(AUTH_COOKIE_NAME.length + 1);
        const parsed: UserAuthProfile = JSON.parse(decodeURIComponent(val));
        if (parsed && parsed.isLoggedIn) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Cookie read warning:', err);
  }
  return null;
}

function deleteAuthCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('xuanhoacogi.com')) {
      document.cookie = `${AUTH_COOKIE_NAME}=; domain=.xuanhoacogi.com; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
    }
  } catch {}
}

function getSavedProfileByEmail(email?: string): UserAuthProfile | null {
  if (typeof window === 'undefined' || !email) return null;
  try {
    const raw = localStorage.getItem(PROFILE_BY_EMAIL_PREFIX + email.trim().toLowerCase());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStoredAuthUser(): UserAuthProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const user: UserAuthProfile = JSON.parse(raw);
      if (user && user.isLoggedIn) {
        return user;
      }
    }
    // Nếu localStorage bị trống (ví dụ chuyển giữa www.xuanhoacogi.com và xuanhoacogi.com),
    // tự động khôi phục từ Cookie 365 ngày nếu người dùng chưa bấm Đăng xuất
    if (localStorage.getItem(LOGGED_OUT_KEY) !== '1') {
      const cookieUser = readAuthCookie();
      if (cookieUser && cookieUser.isLoggedIn) {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cookieUser));
        } catch {}
        return cookieUser;
      }
    }
    return null;
  } catch {
    return readAuthCookie();
  }
}

export function saveAuthUser(user: UserAuthProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOGGED_OUT_KEY);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    if (user.email) {
      localStorage.setItem(PROFILE_BY_EMAIL_PREFIX + user.email.trim().toLowerCase(), JSON.stringify(user));
    }
    writeAuthCookie(user);
    window.dispatchEvent(new CustomEvent('xuanhoa_auth_change', { detail: user }));
  } catch (err) {
    console.warn('Lỗi lưu tài khoản người dùng:', err);
  }
}

export function clearAuthUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOGGED_OUT_KEY, '1');
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(JUST_LOGGED_IN_KEY);
    deleteAuthCookie();
    window.dispatchEvent(new CustomEvent('xuanhoa_auth_change', { detail: null }));
    if (firebaseConfig.apiKey) {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      fbSignOut(auth).catch(() => {});
    }
  } catch (err) {
    console.warn('Lỗi đăng xuất:', err);
  }
}

// Giải mã JWT id_token chuẩn UTF-8 (hỗ trợ đầy đủ tiếng Việt có dấu)
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.warn('Lỗi giải mã JWT:', err);
    return null;
  }
}

// Tạo hoặc cập nhật ngay lập tức hồ sơ người dùng từ thông tin Google thật và lưu bền vững
export function createOrUpdateAuthUserFromGoogle(googleData: {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}): UserAuthProfile {
  const existingCurrent = getStoredAuthUser();
  const existingByEmail = getSavedProfileByEmail(googleData.email);
  const baseProfile =
    existingByEmail ||
    (existingCurrent && existingCurrent.email?.toLowerCase() === googleData.email?.toLowerCase()
      ? existingCurrent
      : null);

  const cleanDisplayName =
    googleData.displayName || googleData.email?.split('@')[0] || 'Thực Khách';

  const updated: UserAuthProfile = {
    isLoggedIn: true,
    uid: googleData.uid || baseProfile?.uid || 'google_' + Date.now(),
    email: googleData.email || baseProfile?.email || 'thuckhach@gmail.com',
    displayName: cleanDisplayName,
    nickname: baseProfile?.merchantPlaceName || baseProfile?.nickname || cleanDisplayName,
    gender: baseProfile?.gender || 'male',
    avatar: baseProfile?.isMerchantAccount ? '🏪' : baseProfile?.avatar || '🐭',
    avatarId: baseProfile?.avatarId || 'm_ty',
    phone: baseProfile?.phone || '',
    residentType: baseProfile?.residentType || 'student_sp2',
    tastePreferences: baseProfile?.tastePreferences || ['lau_nuong', 'tra_sua'],
    filterByTaste: baseProfile?.filterByTaste ?? true,
    photoURL: googleData.photoURL || baseProfile?.photoURL,
    hasCompletedProfile: true,
    isFirstTimeSetupDone: baseProfile?.isFirstTimeSetupDone || false,
    isMerchantAccount: baseProfile?.isMerchantAccount,
    merchantPlaceId: baseProfile?.merchantPlaceId,
    merchantPlaceName: baseProfile?.merchantPlaceName,
    merchantVerifiedCode: baseProfile?.merchantVerifiedCode,
    createdAt: baseProfile?.createdAt || Date.now(),
  };

  saveAuthUser(updated);
  return updated;
}

// ============================================================================
// BẮT ĐỒNG BỘ TOKEN GOOGLE OAUTH NGAY LÚC KHỞI TẠO MODULE (TRƯỚC KHI REACT RENDER)
// ============================================================================
let pendingOAuthAccessToken: string | null = null;
let pendingOAuthIdToken: string | null = null;
let synchronousOAuthUser: UserAuthProfile | null = null;

if (typeof window !== 'undefined') {
  try {
    const rawHash =
      (window as any).__XUANHOA_OAUTH_HASH__ ||
      sessionStorage.getItem('xuanhoa_oauth_hash') ||
      window.location.hash ||
      '';

    if (rawHash.includes('access_token=') || rawHash.includes('id_token=')) {
      const cleanParamsStr = rawHash.replace(/^#\/?/, '').replace(/^#/, '');
      const params = new URLSearchParams(cleanParamsStr);
      const accessToken = params.get('access_token');
      const idToken = params.get('id_token');

      if (accessToken) {
        pendingOAuthAccessToken = accessToken;
      }
      if (idToken) {
        pendingOAuthIdToken = idToken;
        const payload = decodeJwtPayload(idToken);
        if (payload && (payload.email || payload.sub)) {
          synchronousOAuthUser = createOrUpdateAuthUserFromGoogle({
            uid: payload.sub || 'google_' + Date.now(),
            email: payload.email || 'thuckhach@gmail.com',
            displayName: payload.name || payload.email?.split('@')[0] || 'Thực Khách',
            photoURL: payload.picture || undefined,
          });
          localStorage.setItem(JUST_LOGGED_IN_KEY, '1');
        }
      }

      delete (window as any).__XUANHOA_OAUTH_HASH__;
      try {
        sessionStorage.removeItem('xuanhoa_oauth_hash');
      } catch {}

      if (
        window.location.pathname.startsWith('/__/auth/handler') ||
        window.location.hash.includes('access_token=') ||
        window.location.hash.includes('id_token=')
      ) {
        window.history.replaceState(null, document.title, '/');
      }
    } else if (window.location.pathname.startsWith('/__/auth/handler')) {
      window.history.replaceState(null, document.title, '/');
    }
  } catch (err) {
    console.warn('Lỗi xử lý đồng bộ OAuth hash:', err);
  }
}

export function consumeJustLoggedInFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const flag = localStorage.getItem(JUST_LOGGED_IN_KEY);
    if (flag === '1') {
      localStorage.removeItem(JUST_LOGGED_IN_KEY);
      return true;
    }
  } catch {}
  return false;
}

// Kiểm tra có phải thiết bị di động / máy tính bảng cần dùng chuyển hướng OAuth trực tiếp cùng tên miền hay không
export function shouldUseDirectOAuthRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith('xuanhoacogi.com')) return false;

  const ua = navigator.userAgent || '';
  const isMobileBrowser =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|CriOS|FxiOS|EdgiOS|CocCoc|Mobile|Tablet/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    window.innerWidth <= 900;

  return isMobileBrowser;
}

// Tạo URL OAuth 2.0 chuẩn với redirect_uri đã được xác thực trên Google Cloud Console
function buildDirectGoogleOAuthUrl(): string {
  const nonce = 'xh_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'token id_token',
    scope: 'openid email profile',
    prompt: 'select_account',
    nonce,
    include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Chuyển hướng OAuth 2.0 trực tiếp về cùng tên miền https://xuanhoacogi.com/__/auth/handler
// (Hoạt động 100% trên mọi trình duyệt: Chrome PC/Mobile, Cốc Cốc, Safari, Edge... không bao giờ bị lỗi 400 origin_mismatch)
export function redirectToGoogleOAuthDirect(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOGGED_OUT_KEY);
  } catch {}

  window.location.assign(buildDirectGoogleOAuthUrl());
}

// Giải mã hash OAuth trả về từ popup hoặc redirect thành thông tin người dùng Google
async function parseOAuthHashAndSignIn(rawHash: string): Promise<{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}> {
  const cleanParamsStr = rawHash.replace(/^#\/?/, '').replace(/^#/, '');
  const params = new URLSearchParams(cleanParamsStr);
  const accessToken = params.get('access_token');
  const idToken = params.get('id_token');

  let googleUser: {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  } | null = null;

  if (idToken) {
    const payload = decodeJwtPayload(idToken);
    if (payload && (payload.email || payload.sub)) {
      googleUser = {
        uid: payload.sub || 'google_' + Date.now(),
        email: payload.email || 'thuckhach@gmail.com',
        displayName: payload.name || payload.email?.split('@')[0] || 'Thực Khách',
        photoURL: payload.picture || undefined,
      };
    }
  }

  if (accessToken) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const info = await res.json();
        googleUser = {
          uid: info.sub || googleUser?.uid || 'google_' + Date.now(),
          email: info.email || googleUser?.email || 'thuckhach@gmail.com',
          displayName: info.name || googleUser?.displayName || info.email?.split('@')[0] || 'Thực Khách',
          photoURL: info.picture || googleUser?.photoURL || undefined,
        };
      }
    } catch (err) {
      console.warn('UserInfo fetch fallback to id_token payload:', err);
    }

    if (firebaseConfig.apiKey) {
      try {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const credential = GoogleAuthProvider.credential(idToken || null, accessToken);
        await signInWithCredential(auth, credential);
      } catch (fbErr) {
        console.warn('Firebase credential sync warning:', fbErr);
      }
    }
  }

  if (!googleUser) {
    throw new Error('Không nhận được thông tin xác thực từ Google');
  }

  createOrUpdateAuthUserFromGoogle(googleUser);
  return googleUser;
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

// Kiểm tra kết quả chuyển hướng đăng nhập Google & đồng bộ trạng thái bền vững
export async function checkRedirectAuthResult(): Promise<UserAuthProfile | null> {
  if (typeof window === 'undefined') return null;

  // 1. Nếu có access_token hoặc id_token từ cùng tên miền https://xuanhoacogi.com/__/auth/handler
  if (pendingOAuthAccessToken || synchronousOAuthUser) {
    const accessToken = pendingOAuthAccessToken;
    const idToken = pendingOAuthIdToken;
    pendingOAuthAccessToken = null;
    pendingOAuthIdToken = null;

    let finalUser: UserAuthProfile | null = synchronousOAuthUser;
    synchronousOAuthUser = null;

    if (accessToken) {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const info = await res.json();
          finalUser = createOrUpdateAuthUserFromGoogle({
            uid: info.sub || finalUser?.uid || 'google_' + Date.now(),
            email: info.email || finalUser?.email || 'thuckhach@gmail.com',
            displayName: info.name || finalUser?.displayName || info.email?.split('@')[0] || 'Thực Khách',
            photoURL: info.picture || finalUser?.photoURL || undefined,
          });
          localStorage.setItem(JUST_LOGGED_IN_KEY, '1');
        }
      } catch (err) {
        console.warn('UserInfo fetch fallback to JWT user:', err);
      }

      // Đồng bộ ngầm sang Firebase Authentication (IndexedDB)
      if (firebaseConfig.apiKey) {
        try {
          const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
          const auth = getAuth(app);
          const credential = GoogleAuthProvider.credential(idToken || null, accessToken);
          await signInWithCredential(auth, credential);
        } catch (fbErr) {
          console.warn('Firebase credential sync warning:', fbErr);
        }
      }
    }

    if (finalUser) {
      return finalUser;
    }
  }

  // 2. Kiểm tra dự phòng Firebase getRedirectResult và onAuthStateChanged
  try {
    if (!firebaseConfig.apiKey) return getStoredAuthUser();
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);

    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        const u = result.user;
        const updated = createOrUpdateAuthUserFromGoogle({
          uid: u.uid,
          email: u.email || 'thuckhach@gmail.com',
          displayName: u.displayName || u.email?.split('@')[0] || 'Thực Khách',
          photoURL: u.photoURL || undefined,
        });
        localStorage.setItem(JUST_LOGGED_IN_KEY, '1');
        return updated;
      }
    } catch (redirErr) {
      console.warn('getRedirectResult warning:', redirErr);
    }

    // 3. Nếu người dùng chưa chủ động bấm Đăng xuất mà localStorage bị trống, tự động khôi phục từ Firebase IndexedDB
    if (localStorage.getItem(LOGGED_OUT_KEY) !== '1' && !getStoredAuthUser()) {
      return await new Promise<UserAuthProfile | null>((resolve) => {
        const unsubscribe = onAuthStateChanged(
          auth,
          (fbUser: User | null) => {
            unsubscribe();
            if (fbUser && localStorage.getItem(LOGGED_OUT_KEY) !== '1') {
              const restored = createOrUpdateAuthUserFromGoogle({
                uid: fbUser.uid,
                email: fbUser.email || 'thuckhach@gmail.com',
                displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Thực Khách',
                photoURL: fbUser.photoURL || undefined,
              });
              resolve(restored);
            } else {
              resolve(null);
            }
          },
          () => {
            unsubscribe();
            resolve(null);
          }
        );
      });
    }
  } catch (err: any) {
    console.warn('Lỗi kiểm tra trạng thái xác thực:', err?.message || err);
  }

  return getStoredAuthUser();
}

// Xử lý xác thực Google OAuth 2.0 chuẩn chỉ (Không dùng GIS initTokenClient postmessage để triệt tiêu 100% Lỗi 400: origin_mismatch)
export async function signInWithGoogleService(): Promise<{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOGGED_OUT_KEY);
      localStorage.removeItem('xuanhoa_oauth_popup_hash');
    } catch {}
  }

  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';

  // 1. Trên tên miền chính thức xuanhoacogi.com:
  // Nếu trên thiết bị di động -> chuyển hướng toàn trang mượt mà
  if (shouldUseDirectOAuthRedirect()) {
    redirectToGoogleOAuthDirect();
    return new Promise(() => {});
  }

  // Nếu trên máy tính (PC Chrome/Edge/Cốc Cốc) tại xuanhoacogi.com:
  // Mở cửa sổ popup OAuth với redirect_uri=https://xuanhoacogi.com/__/auth/handler (đã được cấp phép trong Authorized Redirect URIs)
  // giúp không bao giờ gặp Lỗi 400: origin_mismatch của postmessage!
  if (host === 'xuanhoacogi.com' || host.endsWith('.xuanhoacogi.com')) {
    const oauthUrl = buildDirectGoogleOAuthUrl();
    const w = 500;
    const h = 620;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
    const popup = window.open(
      oauthUrl,
      'xuanhoa_google_oauth',
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no`
    );

    if (!popup) {
      // Nếu trình duyệt chặn popup, chuyển hướng trực tiếp ngay trên tab hiện tại
      redirectToGoogleOAuthDirect();
      return new Promise(() => {});
    }

    return await new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        window.removeEventListener('storage', onStorage);
        clearInterval(pollTimer);
      };

      const handleHashResult = async (hashStr: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          localStorage.removeItem('xuanhoa_oauth_popup_hash');
        } catch {}
        try {
          const user = await parseOAuthHashAndSignIn(hashStr);
          resolve(user);
        } catch (err) {
          reject(err);
        }
      };

      const onMessage = (event: MessageEvent) => {
        const allowedOrigins = [
          window.location.origin,
          'https://xuanhoacogi.com',
          'https://www.xuanhoacogi.com',
        ];
        if (!allowedOrigins.includes(event.origin)) return;
        if (event.data && event.data.type === 'XUANHOA_OAUTH_CALLBACK' && event.data.hash) {
          handleHashResult(event.data.hash);
        }
      };

      const onStorage = (event: StorageEvent) => {
        if (event.key === 'xuanhoa_oauth_popup_hash' && event.newValue) {
          handleHashResult(event.newValue);
        }
      };

      window.addEventListener('message', onMessage);
      window.addEventListener('storage', onStorage);

      const pollTimer = setInterval(() => {
        try {
          const storedHash = localStorage.getItem('xuanhoa_oauth_popup_hash');
          if (storedHash) {
            handleHashResult(storedHash);
            return;
          }
          if (popup.closed && !settled) {
            settled = true;
            cleanup();
            reject(new Error('Người dùng đã đóng cửa sổ Google'));
          }
        } catch {}
      }, 400);
    });
  }

  // 2. Trên môi trường Demo Localhost (127.0.0.1 / localhost):
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5) {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await signInWithPopup(auth, provider);
      const u = res.user;
      const googleUser = {
        uid: u.uid,
        email: u.email || 'thuckhach@gmail.com',
        displayName: u.displayName || u.email?.split('@')[0] || 'Thực Khách',
        photoURL: u.photoURL || undefined,
      };
      createOrUpdateAuthUserFromGoogle(googleUser);
      return googleUser;
    } catch (err: any) {
      console.warn('Localhost Firebase popup fallback:', err?.code || err?.message);
      // Nếu trên bản Demo Localhost bị chặn domain hoặc đóng popup, tự động đăng nhập tài khoản Demo để test mượt mà
      const demoUser = {
        uid: 'demo_admin_' + Date.now(),
        email: 'marcel.vietnam@gmail.com',
        displayName: 'Marcel Vietnam',
        photoURL: undefined,
      };
      createOrUpdateAuthUserFromGoogle(demoUser);
      return demoUser;
    }
  }

  throw new Error('Chưa thể kết nối tới máy chủ Google OAuth');
}

export async function signOutService(): Promise<void> {
  clearAuthUser();
}

