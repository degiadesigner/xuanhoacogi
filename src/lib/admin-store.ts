import { set, update, remove, get } from 'firebase/database';
import { firebaseConfig, getRealtimeDb, ref, onValue } from './firebase';
import { Food } from './foods';
import { Place, xuanHoaPlaces, getPlaceStyleGroup } from './places-xuanhoa';
import { MainCategoryKey, getCategoryItems } from './xuanhoa-catalog';
import { UserAuthProfile, saveAuthUser, getStoredAuthUser } from './auth';
import { cleanDishDisplayTitle } from './utils';

export type AdminThemeMode = 'ivory-gold' | 'platinum-royal' | 'emerald- pearl';

export type PlaceStatus = 'active' | 'locked' | 'deleted';
export type DishStatus = 'active' | 'locked' | 'deleted';
export type MemberStatus = 'active' | 'muted' | 'banned' | 'admin';

export interface CustomMenuEntry {
  id?: string;
  name: string;
  price: number;
  category?: string;
  description?: string;
  serviceTag?: 'ship' | 'dine_in' | 'both';
  isLocked?: boolean;
}

export interface PlaceOverride {
  id: string;
  status?: PlaceStatus;
  name?: string;
  tagline?: string;
  address?: string;
  zone?: Place['zone'];
  distance?: string;
  phone?: string;
  openHours?: string;
  minPrice?: number;
  maxPrice?: number;
  category?: Place['category'];
  sectorTag?: string; // Phân khu mở rộng: an-chinh | nhau-lau | uong | an-vat | bia-game | dien-thoai | an-choi | dich-vu
  tags?: string[];
  serviceMode?: Place['serviceMode'];
  deliveryNote?: string;
  mapsQuery?: string;
  mapsUrl?: string;
  quip?: string;
  imageUrl?: string;
  verified?: boolean;
  isFeatured?: boolean;
  priorityBoost?: 1 | 2 | 3; // 1: Bình thường, 2: Ưu tiên x2, 3: Ưu tiên cao x3 (Tăng tần suất xuất hiện cả Quán & Món)
  signatureDishName?: string;
  signatureDishPrice?: number;
  customMenu?: CustomMenuEntry[];
  lat?: number;
  lng?: number;
  coordinateVerified?: boolean;
  adminPinApproved?: boolean;
  locationStatus?: 'located' | 'unlocated' | 'invalid' | 'pending_geocode';
  coordinateSource?: 'openstreetmap' | 'admin_verified' | 'merchant_verified' | 'nominatim_geocoded' | 'unverified';
  lastVerifiedAt?: string;
  mapCategory?: string;
  merchantClaimCode?: string; // Mã code duy nhất do Admin cấp cho chủ quán
  claimedByEmail?: string; // Gmail của chủ quán đã kích hoạt mã
  claimedByUid?: string;
  claimedByName?: string;
  claimedAt?: number;
  liveStatus?: 'open_normal' | 'busy_hot' | 'closed_today'; // Trạng thái mở bán trực tiếp trong ngày của chủ quán
  liveStatusNote?: string;
  pendingWebApproval?: {
    submittedBy: string;
    submittedByName: string;
    submittedAt: number;
    actionSummary: string;
    actionType?: 'create' | 'delete' | 'update';
    isNewPlace?: boolean;
    isDeleteRequest?: boolean;
  } | null;
  pendingMapApproval?: {
    submittedBy: string;
    submittedByName: string;
    submittedAt: number;
    actionSummary: string;
    actionType?: 'create' | 'delete' | 'update';
    previousLat?: number | null;
    previousLng?: number | null;
    isNewPlace?: boolean;
    isDeleteRequest?: boolean;
  } | null;
  updatedAt: number;
  isCustom?: boolean;
  customPlaceData?: Place;
}

export interface MerchantPendingSubmission {
  id: string;
  placeId: string;
  placeOriginalName: string;
  merchantEmail: string;
  merchantName: string;
  claimCodeUsed: string;
  submittedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: number;
  reviewNote?: string;
  proposed: {
    name: string;
    phone: string;
    openHours: string;
    address: string;
    tagline?: string;
    minPrice?: number;
    maxPrice?: number;
    serviceMode?: Place['serviceMode'];
    deliveryNote?: string;
    signatureDishName?: string;
    signatureDishPrice?: number;
    customMenu?: CustomMenuEntry[];
    lat: number | null;
    lng: number | null;
    gpsDistanceMeters?: number | null;
  };
  previous: {
    name: string;
    phone: string;
    openHours: string;
    address: string;
    lat: number | null;
    lng: number | null;
    menuCount: number;
  };
}

export interface AdminAccount {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: 'superadmin' | 'manager';
  canManageWeb?: boolean;
  canManageMaps?: boolean;
  createdAt: number;
}

export interface DishOverride {
  key: string; // customId hoặc name-price
  status?: DishStatus;
  name?: string;
  sub?: string;
  price?: number;
  rarity?: number;
  quip?: string;
  customImage?: string;
  categoryKey?: MainCategoryKey;
  placeId?: string;
  placeName?: string;
  updatedAt: number;
  isCustom?: boolean;
  customFoodData?: Food & { categoryKey: MainCategoryKey; placeId?: string; placeName?: string };
}

export interface ManagedMember {
  uid: string;
  email: string;
  displayName: string;
  nickname: string;
  avatar: string;
  avatarId: string;
  gender: 'male' | 'female' | 'other';
  phone?: string;
  residentType?: string;
  tastePreferences?: string[];
  photoURL?: string;
  status: MemberStatus;
  banReason?: string;
  canManageWeb?: boolean;
  canManageMaps?: boolean;
  spinsCount?: number;
  level?: number;
  reviewsCount?: number;
  createdAt: number;
  lastActiveAt: number;
  isTestAccount?: boolean;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  target: string;
  type: 'place' | 'dish' | 'user' | 'review' | 'system';
  timestamp: number;
}

export interface SectorCategoryTag {
  id: string;
  label: string;
}

export const DEFAULT_SECTOR_TAGS: SectorCategoryTag[] = [
  { id: 'an-chinh', label: 'Quán Ăn Chính (Cơm / Bún / Phở)' },
  { id: 'nhau-lau', label: 'Quán Nhậu & Lẩu Nướng' },
  { id: 'uong', label: 'Cafe & Đồ Uống' },
  { id: 'an-vat', label: 'Quán Ăn Vặt' },
  { id: 'bia-game', label: 'Bi-a & Game Cyber' },
  { id: 'an-choi', label: 'Giải Trí / Karaoke / Ăn Chơi' },
  { id: 'dien-thoai', label: 'Cửa Hàng Điện Thoại / Công Nghệ' },
  { id: 'dich-vu', label: 'Thời Trang / Làm Đẹp / Dịch Vụ' },
  { id: 'dia-danh', label: '🏛️ Địa Danh / Cơ Quan / Trường Học / Y Tế' },
];

export const DEFAULT_ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    id: 'adm_owner_1',
    username: 'admin',
    password: '123',
    displayName: 'Tổng Quản Trị (Admin)',
    role: 'superadmin',
    createdAt: 1710000000000,
  },
  {
    id: 'adm_owner_2',
    username: 'minhtt',
    password: '123',
    displayName: 'MinhTT (Founder)',
    role: 'superadmin',
    createdAt: 1710000000000,
  },
];

export interface AdminState {
  places: Record<string, PlaceOverride>;
  dishes: Record<string, DishOverride>;
  members: Record<string, ManagedMember>;
  merchantSubmissions?: Record<string, MerchantPendingSubmission>;
  knownPlaceIds: string[];
  knownDishKeys: string[];
  auditLogs: AdminAuditLog[];
  adminEmails: string[];
  adminAccounts?: AdminAccount[];
  adminPin: string;
  sectorTags?: SectorCategoryTag[];
  fontScale?: 'normal' | 'large';
  requirePinOnOpen?: boolean;
  mapAccessMode?: 'merchants_and_admin_only' | 'public_open'; // Chế độ mở Bản đồ số: Chỉ Chủ Quán + Admin hoặc Mở công khai cho mọi Khách
  updatedAt: number;
}

const ADMIN_STORAGE_KEY = 'xuanhoa_admin_state_v1';
const ADMIN_AUTH_LOCAL_KEY = 'xuanhoa_admin_logged_account_v1';
const ADMIN_AUTH_SESSION_KEY = 'xuanhoa_admin_logged_session_v1';

const DEFAULT_ADMIN_EMAILS = [
  'truongtuanminh.91@gmail.com',
  'marcel.vietnam@gmail.com',
  'admin@xuanhoacogi.com',
  'minhtt@xuanhoacogi.com',
];

export function getDishUniqueKey(food: Food): string {
  return food.customId || `dish_${food.name.toLowerCase().trim().replace(/\s+/g, '_')}_${food.price}`;
}

function createInitialAdminState(): AdminState {
  const initialPlaceIds = xuanHoaPlaces.map(p => p.id);
  const allBaseDishes = [
    ...getCategoryItems('an-gi'),
    ...getCategoryItems('nhau-gi'),
    ...getCategoryItems('uong-gi'),
  ];
  const initialDishKeys = Array.from(new Set(allBaseDishes.map(getDishUniqueKey)));

  return {
    places: {},
    dishes: {},
    members: {},
    merchantSubmissions: {},
    knownPlaceIds: initialPlaceIds,
    knownDishKeys: initialDishKeys,
    auditLogs: [
      {
        id: 'init_log_1',
        action: 'Khởi tạo Trung tâm Quản trị Xuân Hòa Có Gì (Đồng bộ 2 chiều)',
        target: `${initialPlaceIds.length} quán & ${initialDishKeys.length} món ăn`,
        type: 'system',
        timestamp: Date.now(),
      },
    ],
    adminEmails: DEFAULT_ADMIN_EMAILS,
    adminAccounts: DEFAULT_ADMIN_ACCOUNTS,
    adminPin: '6868',
    sectorTags: DEFAULT_SECTOR_TAGS,
    fontScale: 'normal',
    requirePinOnOpen: false,
    mapAccessMode: 'public_open',
    updatedAt: 0,
  };
}

// Mã hóa / giải mã khóa cho Firebase Realtime Database (Firebase RTDB cấm các ký tự . # $ / [ ] trong key, ví dụ email có dấu chấm ".")
export function encodeRtdbKey(key: string): string {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/%/g, '%25')
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
}

export function decodeRtdbKey(encodedKey: string): string {
  try {
    return decodeURIComponent(String(encodedKey || '')).trim().toLowerCase();
  } catch {
    return String(encodedKey || '')
      .replace(/%2E/gi, '.')
      .replace(/%23/gi, '#')
      .replace(/%24/gi, '$')
      .replace(/%2F/gi, '/')
      .replace(/%5B/gi, '[')
      .replace(/%5D/gi, ']')
      .replace(/%25/gi, '%')
      .trim()
      .toLowerCase();
  }
}

// Danh sách chặn tuyệt đối mọi email mẫu / nick quản lý ảo / tài khoản thử nghiệm để không bao giờ tự sinh nick mới trong Quản lý Thành viên
const BLOCKED_FAKE_OR_TEST_MEMBER_EMAILS = new Set([
  'minhanh.sp2@gmail.com',
  'hoangnam.xuanhoa@gmail.com',
  'nickao.phaquay99@gmail.com',
  'nguoimoi.xuanhoa@gmail.com',
  'quanlyweb.xh@gmail.com',
  'quanlymaps.xh@gmail.com',
  'kiemnhiem.xh@gmail.com',
  'quanlymaps@xuanhoacogi.vn',
  'chuquan.xuanhoa@gmail.com',
  'merchant@xuanhoacogi.vn',
  'thuckhach@gmail.com',
  'admin@xuanhoacogi.com',
  'minhtt@xuanhoacogi.com',
]);

export function isBlockedFakeOrTestMemberEmail(email?: string | null): boolean {
  if (!email) return true;
  const clean = decodeRtdbKey(email).trim().toLowerCase();
  if (!clean || !clean.includes('@')) return true;
  if (BLOCKED_FAKE_OR_TEST_MEMBER_EMAILS.has(clean)) return true;
  if (/^(thanhvien|seeder|test|demo|quanlyweb|quanlymaps|kiemnhiem)\b/i.test(clean)) return true;
  if (
    clean.endsWith('@chuquan.xuanhoa') ||
    clean.endsWith('@xuanhoacogi.vn') ||
    clean.endsWith('@xuanhoacogi.com')
  ) {
    return true;
  }
  return false;
}

// Chuẩn hóa & gộp tuyệt đối theo Gmail: Đảm bảo 1 Gmail = DUY NHẤT 1 Nick, tự động dọn sạch mọi khóa bị nhân đôi (%2E hoặc trùng lặp) và loại bỏ 100% nick ảo
export function normalizeAndDeduplicateMembers(
  rawMembers?: Record<string, ManagedMember> | null
): { members: Record<string, ManagedMember>; hadDuplicates: boolean } {
  const out: Record<string, ManagedMember> = {};
  let hadDuplicates = false;
  if (!rawMembers || typeof rawMembers !== 'object') {
    return { members: out, hadDuplicates: false };
  }

  for (const [rawKey, incoming] of Object.entries(rawMembers)) {
    if (!incoming || typeof incoming !== 'object') {
      hadDuplicates = true;
      continue;
    }
    const cleanEmail = decodeRtdbKey(incoming.email || rawKey).trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || isBlockedFakeOrTestMemberEmail(cleanEmail)) {
      hadDuplicates = true;
      continue;
    }
    if (rawKey !== cleanEmail) {
      hadDuplicates = true;
    }

    const canonicalUid = `uid_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const existing = out[cleanEmail];
    if (existing) {
      hadDuplicates = true;
      const preferIncomingNick =
        incoming.nickname &&
        incoming.nickname !== cleanEmail &&
        (!existing.nickname || existing.nickname === cleanEmail);
      out[cleanEmail] = {
        ...existing,
        ...incoming,
        uid: canonicalUid,
        email: cleanEmail,
        displayName: preferIncomingNick
          ? incoming.displayName || incoming.nickname
          : existing.displayName || incoming.displayName || cleanEmail,
        nickname: preferIncomingNick
          ? incoming.nickname
          : existing.nickname || incoming.nickname || cleanEmail,
        phone: incoming.phone || existing.phone || '',
        avatar:
          incoming.avatar && incoming.avatar !== '🐭'
            ? incoming.avatar
            : existing.avatar || incoming.avatar || '🐭',
        avatarId:
          incoming.avatarId && incoming.avatarId !== 'm_ty'
            ? incoming.avatarId
            : existing.avatarId || incoming.avatarId || 'm_ty',
        gender: incoming.gender || existing.gender || 'male',
        residentType: incoming.residentType || existing.residentType || 'student_sp2',
        tastePreferences:
          incoming.tastePreferences && incoming.tastePreferences.length > 0
            ? incoming.tastePreferences
            : existing.tastePreferences || [],
        status:
          existing.status && existing.status !== 'active'
            ? existing.status
            : incoming.status || 'active',
        canManageWeb: Boolean(existing.canManageWeb || incoming.canManageWeb),
        canManageMaps: Boolean(existing.canManageMaps || incoming.canManageMaps),
        banReason: existing.banReason || incoming.banReason,
        spinsCount: Math.max(existing.spinsCount || 0, incoming.spinsCount || 0),
        level: Math.max(existing.level || 1, incoming.level || 1),
        reviewsCount: Math.max(existing.reviewsCount || 0, incoming.reviewsCount || 0),
        createdAt: Math.min(
          existing.createdAt || Date.now(),
          incoming.createdAt || Date.now()
        ),
        lastActiveAt: Math.max(existing.lastActiveAt || 0, incoming.lastActiveAt || 0) || Date.now(),
      };
    } else {
      out[cleanEmail] = {
        ...incoming,
        uid: canonicalUid,
        email: cleanEmail,
      };
    }
  }

  return { members: out, hadDuplicates };
}

let cachedAdminRaw: string | null = null;
let cachedAdminState: AdminState | null = null;
let lastLocalSaveUpdatedAt = 0;

function isSuperAdminIdentifier(id?: string | null): boolean {
  if (!id) return false;
  const clean = id.trim().toLowerCase();
  return (
    clean === 'admin' ||
    clean === '@admin' ||
    clean === 'minhtt' ||
    clean === '@minhtt' ||
    clean === 'admin@xuanhoacogi.com' ||
    clean === 'minhtt@xuanhoacogi.com' ||
    clean === 'truongtuanminh.91@gmail.com' ||
    clean === 'marcel.vietnam@gmail.com'
  );
}

export function getAdminState(): AdminState {
  if (typeof window === 'undefined') return createInitialAdminState();
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) {
      const init = createInitialAdminState();
      const s = JSON.stringify(init);
      localStorage.setItem(ADMIN_STORAGE_KEY, s);
      cachedAdminRaw = s;
      cachedAdminState = init;
      return init;
    }
    if (raw === cachedAdminRaw && cachedAdminState) {
      return cachedAdminState;
    }

    const parsed: AdminState = JSON.parse(raw);
    const places = parsed.places || {};
    const merchantSubmissions = parsed.merchantSubmissions || {};

    // Tự động hợp nhất quán Cháo Lòng Chị Hồng (xh_custom_1792229707991) đã tạo trong Admin sang mã chính thức có biển quán & ảnh món
    let migrated = false;
    if (places['xh_custom_1792229707991']) {
      const customHong = places['xh_custom_1792229707991'];
      places['chao-long-chi-hong'] = {
        ...customHong,
        id: 'chao-long-chi-hong',
        isCustom: false,
        customPlaceData: undefined,
        imageUrl: 'ai_studio_dish_chao_long_chi_hong.jpg',
        updatedAt: Date.now(),
      };
      delete places['xh_custom_1792229707991'];
      migrated = true;
    }
    if (places['chao-long-chi-hong'] && !places['chao-long-chi-hong'].imageUrl) {
      places['chao-long-chi-hong'].imageUrl = 'ai_studio_dish_chao_long_chi_hong.jpg';
      migrated = true;
    }

    // Dọn sạch dữ liệu thử nghiệm vô tình lưu vào Ăn Vặt Gamitra (gamitra-xuan-hoa) để trả về đúng trạng thái ⏳ Chưa ghim
    for (const [pid, ov] of Object.entries(places)) {
      if (!ov) continue;
      if (pid === 'gamitra-xuan-hoa' || pid === 'an-vat-gamitra') {
        if (ov.phone && ov.phone.endsWith('aaa')) {
          ov.phone = ov.phone.replace(/aaa+$/i, '').trim();
          migrated = true;
        }
        if (
          ov.lat !== undefined ||
          ov.lng !== undefined ||
          ov.coordinateVerified
        ) {
          delete ov.lat;
          delete ov.lng;
          ov.coordinateVerified = false;
          ov.coordinateSource = 'unverified';
          delete ov.lastVerifiedAt;
          migrated = true;
        }
      }

      const isCivicOrSchool =
        pid.startsWith('osm_') ||
        ov.mapCategory === 'public' ||
        ov.mapCategory === 'school' ||
        ov.mapCategory === 'medical' ||
        ov.sectorTag === 'dia-danh';

      // Mọi hàng quán thương mại chưa được Admin đích thân ghim & duyệt chuẩn (adminPinApproved !== true)
      // thì bắt buộc giữ ở trạng thái Chưa ghim (ẩn 100% trên Bản đồ dù có bật danh mục)
      if (!isCivicOrSchool) {
        if (ov.adminPinApproved === undefined) {
          delete ov.lat;
          delete ov.lng;
          ov.coordinateVerified = false;
          ov.adminPinApproved = false;
          ov.coordinateSource = 'unverified';
          delete ov.lastVerifiedAt;
          ov.pendingMapApproval = null;
          migrated = true;
        } else if (ov.adminPinApproved !== true && !ov.pendingMapApproval) {
          if (ov.lat !== undefined || ov.lng !== undefined || ov.coordinateVerified) {
            delete ov.lat;
            delete ov.lng;
            ov.coordinateVerified = false;
            ov.coordinateSource = 'unverified';
            delete ov.lastVerifiedAt;
            migrated = true;
          }
        }
      } else if (ov.coordinateVerified !== false && ov.adminPinApproved === undefined && !ov.pendingMapApproval) {
        ov.adminPinApproved = true;
        migrated = true;
      }

      if (isCivicOrSchool) {
        if (ov.sectorTag !== 'dia-danh') {
          ov.sectorTag = 'dia-danh';
          migrated = true;
        }
        if (ov.customMenu && ov.customMenu.length > 0) {
          ov.customMenu = [];
          migrated = true;
        }
        if (ov.customPlaceData?.menu && ov.customPlaceData.menu.length > 0) {
          ov.customPlaceData.menu = [];
          ov.customPlaceData.minPrice = 0;
          ov.customPlaceData.maxPrice = 0;
          ov.customPlaceData.priceRange = 'Địa danh công cộng';
          migrated = true;
        }
        if (ov.pendingWebApproval) {
          ov.pendingWebApproval = null;
          migrated = true;
        }
      }

      // Admin làm gì là mệnh lệnh (không cần duyệt)
      if (ov.pendingWebApproval) {
        const pw = ov.pendingWebApproval;
        if (
          isSuperAdminIdentifier(pw.submittedBy) ||
          (!pw.isNewPlace && !pw.isDeleteRequest)
        ) {
          ov.pendingWebApproval = null;
          migrated = true;
        }
      }
      if (ov.pendingMapApproval) {
        const pm = ov.pendingMapApproval;
        if (isSuperAdminIdentifier(pm.submittedBy)) {
          ov.pendingMapApproval = null;
          ov.adminPinApproved = true;
          ov.coordinateVerified = true;
          migrated = true;
        }
      }

      const subKey = `sub_${pid}`;
      if (
        merchantSubmissions[subKey] &&
        (isCivicOrSchool ||
          pid.startsWith('xh_map_') ||
          isSuperAdminIdentifier(merchantSubmissions[subKey].merchantEmail))
      ) {
        delete merchantSubmissions[subKey];
        migrated = true;
      }
    }

    // Dọn sạch các nick quản lý thử nghiệm tự sinh trong adminAccounts (chỉ giữ tài khoản thật)
    let cleanAdminAccounts = parsed.adminAccounts || DEFAULT_ADMIN_ACCOUNTS;
    const filteredAccounts = cleanAdminAccounts.filter(acc => {
      const u = (acc.username || '').trim().toLowerCase();
      return u !== 'quanlyweb' && u !== 'quanlymaps' && u !== 'kiemnhiem' && !u.startsWith('test');
    });
    if (filteredAccounts.length !== cleanAdminAccounts.length) {
      cleanAdminAccounts = filteredAccounts.length > 0 ? filteredAccounts : DEFAULT_ADMIN_ACCOUNTS;
      migrated = true;
    }

    const { members: cleanMembers, hadDuplicates } = normalizeAndDeduplicateMembers(parsed.members);
    if (hadDuplicates) {
      migrated = true;
    }

    const resultState: AdminState = {
      ...createInitialAdminState(),
      ...parsed,
      places,
      dishes: parsed.dishes || {},
      members: cleanMembers,
      adminAccounts: cleanAdminAccounts,
      merchantSubmissions,
      auditLogs: parsed.auditLogs || [],
      mapAccessMode: parsed.mapAccessMode || 'merchants_and_admin_only',
    };

    if (migrated) {
      const nextRaw = JSON.stringify(resultState);
      localStorage.setItem(ADMIN_STORAGE_KEY, nextRaw);
      cachedAdminRaw = nextRaw;
    } else {
      cachedAdminRaw = raw;
    }
    cachedAdminState = resultState;

    return resultState;
  } catch {
    return createInitialAdminState();
  }
}

function encodeRtdbRecord<T>(record?: Record<string, T> | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!record || typeof record !== 'object') return out;
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined) {
      out[encodeRtdbKey(k)] = v;
    }
  }
  return out;
}

function decodeRtdbRecord<T>(record?: Record<string, T> | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!record || typeof record !== 'object') return out;
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined && v !== null) {
      out[decodeRtdbKey(k)] = v;
    }
  }
  return out;
}

export function pushMemberToCloudRealtime(member: ManagedMember, includeAdminRoles = false): void {
  if (typeof window === 'undefined' || !firebaseConfig.apiKey || !member?.email) return;
  if (isBlockedFakeOrTestMemberEmail(member.email)) return;
  try {
    const rtdb = getRealtimeDb();
    if (!rtdb) return;
    const safeKey = encodeRtdbKey(member.email);
    const payload: Record<string, any> = {
      uid: member.uid || `uid_${Date.now()}`,
      email: member.email.trim().toLowerCase(),
      displayName: member.displayName || member.nickname || member.email,
      nickname: member.nickname || member.displayName || member.email,
      avatar: member.avatar || '🐭',
      avatarId: member.avatarId || 'm_ty',
      gender: member.gender || 'male',
      phone: member.phone || '',
      residentType: member.residentType || 'student_sp2',
      tastePreferences: member.tastePreferences || [],
      spinsCount: member.spinsCount || 0,
      level: member.level || 1,
      reviewsCount: member.reviewsCount || 0,
      createdAt: member.createdAt || Date.now(),
      lastActiveAt: member.lastActiveAt || Date.now(),
    };
    if (member.photoURL) payload.photoURL = member.photoURL;
    if (member.isTestAccount !== undefined) payload.isTestAccount = member.isTestAccount;
    if (includeAdminRoles) {
      payload.status = member.status || 'active';
      payload.canManageWeb = Boolean(member.canManageWeb);
      payload.canManageMaps = Boolean(member.canManageMaps);
      if (member.banReason !== undefined) payload.banReason = member.banReason;
    }
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    update(ref(rtdb, `xuanhoa_admin/members_registry/${safeKey}`), cleanPayload).catch(() => {});
  } catch {}
}

export function removeMemberFromCloudRealtime(emailKey: string): void {
  if (typeof window === 'undefined' || !firebaseConfig.apiKey || !emailKey) return;
  try {
    const rtdb = getRealtimeDb();
    if (!rtdb) return;
    const safeKey = encodeRtdbKey(emailKey);
    remove(ref(rtdb, `xuanhoa_admin/members_registry/${safeKey}`)).catch(() => {});
    remove(ref(rtdb, `xuanhoa_admin/global_state/members/${safeKey}`)).catch(() => {});
  } catch {}
}

export function saveAdminState(next: AdminState, syncCloud = true): void {
  if (typeof window === 'undefined') return;
  try {
    next.updatedAt = Date.now();
    lastLocalSaveUpdatedAt = next.updatedAt;
    next.members = normalizeAndDeduplicateMembers(next.members || {}).members;
    const serialized = JSON.stringify(next);
    cachedAdminRaw = serialized;
    cachedAdminState = next;
    localStorage.setItem(ADMIN_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: next }));

    if (syncCloud && firebaseConfig.apiKey) {
      const encodedMembers = encodeRtdbRecord(next.members || {});
      const cleanPayload = JSON.parse(
        JSON.stringify({
          places: next.places || {},
          dishes: next.dishes || {},
          members: encodedMembers,
          merchantSubmissions: next.merchantSubmissions || {},
          auditLogs: (next.auditLogs || []).slice(0, 80),
          adminEmails: next.adminEmails || DEFAULT_ADMIN_EMAILS,
          adminAccounts: next.adminAccounts || DEFAULT_ADMIN_ACCOUNTS,
          sectorTags: next.sectorTags || DEFAULT_SECTOR_TAGS,
          fontScale: next.fontScale || 'normal',
          mapAccessMode: next.mapAccessMode || 'merchants_and_admin_only',
          updatedAt: next.updatedAt,
        })
      );
      const rtdb = getRealtimeDb();
      if (rtdb) {
        set(ref(rtdb, 'xuanhoa_admin/global_state'), cleanPayload).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Failed to save admin state:', err);
  }
}

export function addAdminAuditLog(
  state: AdminState,
  action: string,
  target: string,
  type: AdminAuditLog['type']
): AdminAuditLog[] {
  const entry: AdminAuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    target,
    type,
    timestamp: Date.now(),
  };
  return [entry, ...(state.auditLogs || [])].slice(0, 100);
}

// Khởi tạo lắng nghe đồng bộ Realtime giữa các Tab trình duyệt (storage) & Đa thiết bị qua Firebase Realtime Database
let cloudListenerStarted = false;
export function initAdminCloudSync(): void {
  if (typeof window === 'undefined' || cloudListenerStarted) return;
  cloudListenerStarted = true;

  // 1. Đồng bộ Realtime tức thì (0.1s) giữa các Tab trên cùng trình duyệt (Web <-> Admin)
  window.addEventListener('storage', (e: StorageEvent) => {
    if (!e.key || e.key.startsWith('xuanhoa_')) {
      window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync'));
    }
  });

  if (!firebaseConfig.apiKey) return;

  const mergeMembersMap = (
    localMembers: Record<string, ManagedMember>,
    incomingMembers: Record<string, ManagedMember>
  ): Record<string, ManagedMember> => {
    const cleanLocal = normalizeAndDeduplicateMembers(localMembers).members;
    const cleanIncoming = normalizeAndDeduplicateMembers(incomingMembers).members;
    const out: Record<string, ManagedMember> = { ...cleanLocal };
    for (const [emailKey, incoming] of Object.entries(cleanIncoming)) {
      if (!incoming || !emailKey || isBlockedFakeOrTestMemberEmail(emailKey)) continue;
      const existing = out[emailKey];
      out[emailKey] = {
        ...(existing || {}),
        ...incoming,
        uid: `uid_${emailKey.replace(/[^a-z0-9]/g, '_')}`,
        email: emailKey,
        status: incoming.status || existing?.status || 'active',
        canManageWeb:
          incoming.canManageWeb !== undefined ? incoming.canManageWeb : existing?.canManageWeb,
        canManageMaps:
          incoming.canManageMaps !== undefined ? incoming.canManageMaps : existing?.canManageMaps,
        banReason: incoming.banReason !== undefined ? incoming.banReason : existing?.banReason,
        spinsCount: Math.max(incoming.spinsCount || 0, existing?.spinsCount || 0),
        level: Math.max(incoming.level || 1, existing?.level || 1),
        reviewsCount: Math.max(incoming.reviewsCount || 0, existing?.reviewsCount || 0),
        createdAt: Math.min(
          existing?.createdAt || Date.now(),
          incoming.createdAt || Date.now()
        ),
        lastActiveAt: Math.max(incoming.lastActiveAt || 0, existing?.lastActiveAt || 0) || Date.now(),
      };
    }
    return out;
  };

  const applyCloudData = (cloudData: Partial<AdminState> | null | undefined) => {
    if (!cloudData) return;
    if (cloudData.updatedAt && cloudData.updatedAt === lastLocalSaveUpdatedAt) {
      return;
    }
    const local = getAdminState();
    const decodedCloudMembers = decodeRtdbRecord<ManagedMember>(cloudData.members as any);
    for (const k of Object.keys(decodedCloudMembers)) {
      if (isBlockedFakeOrTestMemberEmail(k)) {
        removeMemberFromCloudRealtime(k);
        delete decodedCloudMembers[k];
      }
    }
    const mergedMembers = mergeMembersMap(local.members || {}, decodedCloudMembers);

    const incomingPlaces = { ...(cloudData.places || local.places || {}) };
    for (const [pid, ov] of Object.entries(incomingPlaces)) {
      if (!ov) continue;
      if (pid === 'gamitra-xuan-hoa' || pid === 'an-vat-gamitra') {
        if (ov.phone && ov.phone.endsWith('aaa')) {
          ov.phone = ov.phone.replace(/aaa+$/i, '').trim();
        }
      }
      const isCivicOrSchool =
        pid.startsWith('osm_') ||
        ov.mapCategory === 'public' ||
        ov.mapCategory === 'school' ||
        ov.mapCategory === 'medical' ||
        ov.sectorTag === 'dia-danh';
      if (!isCivicOrSchool && ov.adminPinApproved !== true) {
        delete ov.lat;
        delete ov.lng;
        ov.coordinateVerified = false;
        ov.adminPinApproved = false;
        ov.coordinateSource = 'unverified';
        delete ov.lastVerifiedAt;
      }
    }

    const incomingAccounts = (cloudData.adminAccounts || local.adminAccounts || DEFAULT_ADMIN_ACCOUNTS).filter(acc => {
      const u = (acc.username || '').trim().toLowerCase();
      return u !== 'quanlyweb' && u !== 'quanlymaps' && u !== 'kiemnhiem' && !u.startsWith('test');
    });

    if (cloudData.updatedAt && cloudData.updatedAt > (local.updatedAt || 0)) {
      const merged: AdminState = {
        ...local,
        places: incomingPlaces,
        dishes: cloudData.dishes || local.dishes || {},
        members: mergedMembers,
        merchantSubmissions: cloudData.merchantSubmissions || local.merchantSubmissions || {},
        auditLogs: cloudData.auditLogs || local.auditLogs,
        adminEmails: cloudData.adminEmails || local.adminEmails,
        adminAccounts: incomingAccounts.length > 0 ? incomingAccounts : DEFAULT_ADMIN_ACCOUNTS,
        sectorTags: cloudData.sectorTags || local.sectorTags,
        fontScale: cloudData.fontScale || local.fontScale,
        mapAccessMode: cloudData.mapAccessMode || local.mapAccessMode || 'merchants_and_admin_only',
        updatedAt: cloudData.updatedAt,
      };
      const serialized = JSON.stringify(merged);
      cachedAdminRaw = serialized;
      cachedAdminState = merged;
      localStorage.setItem(ADMIN_STORAGE_KEY, serialized);
      window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: merged }));
    } else if (
      Object.keys(decodedCloudMembers).length > Object.keys(local.members || {}).length
    ) {
      // Kể cả khi local.updatedAt mới hơn, vẫn luôn hợp nhất danh sách thành viên từ Cloud để không bao giờ sót người mới đăng ký
      const merged: AdminState = {
        ...local,
        members: mergedMembers,
      };
      const serialized = JSON.stringify(merged);
      cachedAdminRaw = serialized;
      cachedAdminState = merged;
      localStorage.setItem(ADMIN_STORAGE_KEY, serialized);
      window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: merged }));
    }
  };

  // 2. Đồng bộ Realtime đa thiết bị qua Firebase Realtime Database
  try {
    const rtdb = getRealtimeDb();
    if (rtdb) {
      // 2a. Lắng nghe trạng thái tổng thể (Quán, Maps, Cài đặt, Thành viên)
      const rtdbRef = ref(rtdb, 'xuanhoa_admin/global_state');
      onValue(
        rtdbRef,
        snapshot => {
          if (snapshot.exists()) {
            applyCloudData(snapshot.val() as Partial<AdminState>);
          }
        },
        () => {}
      );

      // 2b. Lắng nghe nhánh chuyên biệt `members_registry` để bất kỳ ai đăng ký Gmail mới trên điện thoại/máy tính khác đều nhảy Realtime (<0.1s) vào bảng Quản lý Thành viên
      const membersRegRef = ref(rtdb, 'xuanhoa_admin/members_registry');
      onValue(
        membersRegRef,
        snapshot => {
          if (!snapshot.exists()) return;
          const rawRegistry = snapshot.val() as Record<string, ManagedMember>;
          const decodedRegistry = decodeRtdbRecord<ManagedMember>(rawRegistry);
          for (const k of Object.keys(decodedRegistry)) {
            if (isBlockedFakeOrTestMemberEmail(k)) {
              removeMemberFromCloudRealtime(k);
              delete decodedRegistry[k];
            }
          }
          const local = getAdminState();
          const nextMembers = mergeMembersMap(local.members || {}, decodedRegistry);
          const nextState: AdminState = {
            ...local,
            members: nextMembers,
          };
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(nextState));
          window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: nextState }));
        },
        () => {}
      );
    }
  } catch {}
}

// ============================================================================
// 1. ĐỒNG BỘ THÀNH VIÊN (USERS CRM) & KIỂM TRA CHẶN / BAN / MUTE
// ============================================================================
export function syncUserToAdminRegistry(user: UserAuthProfile, spinsCount = 0, level = 1): ManagedMember {
  const state = getAdminState();
  const key = (user.email || user.uid || 'guest').trim().toLowerCase();
  const existing = state.members[key];

  // Tuyệt đối không tự tạo thành viên cho các tài khoản mẫu / nick quản lý ảo / khách chưa có Gmail thật
  if (!user.email || isBlockedFakeOrTestMemberEmail(user.email)) {
    return (
      existing || {
        uid: user.uid || 'guest',
        email: user.email || '',
        displayName: user.displayName || user.nickname || 'Thực khách',
        nickname: user.nickname || user.displayName || 'Thực khách',
        avatar: user.avatar || '🐭',
        avatarId: user.avatarId || 'm_ty',
        gender: user.gender || 'male',
        status: 'active',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      }
    );
  }

  // Đồng bộ 2 chiều quyền Chủ Quán & Mã Code đi theo Gmail mãi mãi
  if (user.email) {
    const cleanEmail = user.email.trim().toLowerCase();
    // Chiều 1: Nếu tài khoản đã lưu sẵn mã code & quán trong hồ sơ/cookie, đảm bảo state.places vẫn giữ liên kết
    if (user.isMerchantAccount && user.merchantPlaceId && user.merchantVerifiedCode) {
      const pid = user.merchantPlaceId;
      const ov = state.places[pid];
      if (!ov?.claimedByEmail || ov.claimedByEmail.trim().toLowerCase() === cleanEmail) {
        state.places[pid] = {
          ...(ov || { id: pid }),
          id: pid,
          merchantClaimCode: ov?.merchantClaimCode || user.merchantVerifiedCode,
          claimedByEmail: cleanEmail,
          claimedByUid: user.uid || ov?.claimedByUid || '',
          claimedByName: user.displayName || user.nickname || cleanEmail,
          claimedAt: ov?.claimedAt || Date.now(),
          updatedAt: Date.now(),
        };
      }
    } else {
      // Chiều 2: Nếu Gmail này đã từng nhập mã code (hoặc được Admin gán) trong state.places, tự động khôi phục Nick Quán 🏪 & Mã Code vào hồ sơ người dùng
      const matchedEntry = Object.values(state.places).find(
        p => p.claimedByEmail && p.claimedByEmail.trim().toLowerCase() === cleanEmail
      );
      if (matchedEntry) {
        const basePlace = xuanHoaPlaces.find(bp => bp.id === matchedEntry.id);
        const placeName = matchedEntry.name || basePlace?.name || 'Quán của bạn';
        const code = matchedEntry.merchantClaimCode || getOrGenerateMerchantCode(matchedEntry.id, false);
        try {
          saveAuthUser({
            ...user,
            isMerchantAccount: true,
            merchantPlaceId: matchedEntry.id,
            merchantPlaceName: placeName,
            merchantVerifiedCode: code,
            nickname: placeName,
            avatar: '🏪',
          });
        } catch {}
      }
    }
  }

  const member: ManagedMember = {
    uid: user.uid || existing?.uid || `uid_${Date.now()}`,
    email: user.email || existing?.email || 'thuckhach@gmail.com',
    displayName: user.displayName || existing?.displayName || user.nickname,
    nickname: user.nickname || existing?.nickname || user.displayName,
    avatar: user.avatar || existing?.avatar || '🐭',
    avatarId: user.avatarId || existing?.avatarId || 'm_ty',
    gender: user.gender || existing?.gender || 'male',
    phone: user.phone || existing?.phone || '',
    residentType: user.residentType || existing?.residentType || 'student_sp2',
    tastePreferences: user.tastePreferences || existing?.tastePreferences || [],
    photoURL: user.photoURL || existing?.photoURL,
    status: existing?.status || 'active',
    banReason: existing?.banReason,
    canManageWeb: existing?.canManageWeb,
    canManageMaps: existing?.canManageMaps,
    spinsCount: Math.max(spinsCount, existing?.spinsCount || 0),
    level: Math.max(level, existing?.level || 1),
    reviewsCount: existing?.reviewsCount || 0,
    createdAt: existing?.createdAt || user.createdAt || Date.now(),
    lastActiveAt: Date.now(),
  };

  state.members[key] = member;
  if (!existing) {
    state.auditLogs = addAdminAuditLog(
      state,
      'Thành viên mới kết nối Gmail',
      `${member.nickname} (${member.email})`,
      'user'
    );
  }
  pushMemberToCloudRealtime(member, false);
  saveAdminState(state, false);
  return member;
}

// Đảm bảo kiểm tra trực tiếp quyền Quản lý Web / Quản lý Maps mới nhất của Gmail từ Cloud Firebase trước khi phân luồng tại /quanly
export async function ensureCloudPermissionsSyncedForEmail(email?: string | null): Promise<void> {
  if (typeof window === 'undefined' || !firebaseConfig.apiKey || !email) return;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) return;
  try {
    const rtdb = getRealtimeDb();
    if (!rtdb) return;
    const safeKey = encodeRtdbKey(cleanEmail);
    const [regSnap, globalMemSnap, globalEmailsSnap] = await Promise.all([
      get(ref(rtdb, `xuanhoa_admin/members_registry/${safeKey}`)).catch(() => null),
      get(ref(rtdb, `xuanhoa_admin/global_state/members/${safeKey}`)).catch(() => null),
      get(ref(rtdb, `xuanhoa_admin/global_state/adminEmails`)).catch(() => null),
    ]);

    const state = getAdminState();
    let changed = false;

    if (globalEmailsSnap && globalEmailsSnap.exists()) {
      const cloudEmails = globalEmailsSnap.val();
      if (Array.isArray(cloudEmails) && cloudEmails.length > 0) {
        state.adminEmails = Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...cloudEmails]));
        changed = true;
      }
    }

    const regVal = regSnap && regSnap.exists() ? (regSnap.val() as Partial<ManagedMember>) : null;
    const globalVal =
      globalMemSnap && globalMemSnap.exists() ? (globalMemSnap.val() as Partial<ManagedMember>) : null;

    if (regVal || globalVal) {
      const existing = state.members[cleanEmail];
      const merged: ManagedMember = {
        ...(existing || {
          uid: `uid_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0],
          nickname: cleanEmail.split('@')[0],
          avatar: '🐭',
          avatarId: 'm_ty',
          gender: 'male',
          residentType: 'student_sp2',
          status: 'active',
          spinsCount: 0,
          level: 1,
          reviewsCount: 0,
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        }),
        ...(globalVal || {}),
        ...(regVal || {}),
        uid: `uid_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
        email: cleanEmail,
        status:
          regVal?.status === 'admin' || globalVal?.status === 'admin' || existing?.status === 'admin'
            ? 'admin'
            : regVal?.status || globalVal?.status || existing?.status || 'active',
        canManageWeb: Boolean(
          regVal?.canManageWeb || globalVal?.canManageWeb || existing?.canManageWeb
        ),
        canManageMaps: Boolean(
          regVal?.canManageMaps || globalVal?.canManageMaps || existing?.canManageMaps
        ),
      };
      state.members[cleanEmail] = merged;
      changed = true;
    }

    if (changed) {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: state }));
    }
  } catch {}
}

export function getMemberRestrictionStatus(user?: UserAuthProfile | null): {
  status: MemberStatus;
  banReason?: string;
} {
  if (!user || !user.isLoggedIn) return { status: 'active' };
  const state = getAdminState();
  const key = (user.email || user.uid || '').trim().toLowerCase();
  const found = state.members[key];
  if (!found) return { status: 'active' };
  return {
    status: found.status,
    banReason: found.banReason,
  };
}

export function updateMemberStatusInAdmin(
  memberKey: string,
  status: MemberStatus,
  banReason?: string
): void {
  const state = getAdminState();
  const key = memberKey.trim().toLowerCase();
  const target = state.members[key];
  if (!target) return;

  target.status = status;
  if (banReason !== undefined) target.banReason = banReason;
  target.lastActiveAt = Date.now();

  const statusLabel =
    status === 'banned'
      ? 'Khóa / Chặn vĩnh viễn (Ban)'
      : status === 'muted'
      ? 'Cấm bình luận / Đánh giá (Mute)'
      : status === 'admin'
      ? 'Cấp quyền Quản trị viên'
      : 'Mở khóa hoạt động bình thường';

  state.auditLogs = addAdminAuditLog(
    state,
    statusLabel,
    `${target.nickname} (${target.email})`,
    'user'
  );
  pushMemberToCloudRealtime(target, true);
  saveAdminState(state);
}

export function updateMemberManagerPermissions(
  memberKey: string,
  patch: { canManageWeb?: boolean; canManageMaps?: boolean }
): void {
  const state = getAdminState();
  const key = memberKey.trim().toLowerCase();
  const target = state.members[key];
  if (!target) return;

  if (patch.canManageWeb !== undefined) target.canManageWeb = patch.canManageWeb;
  if (patch.canManageMaps !== undefined) target.canManageMaps = patch.canManageMaps;
  target.lastActiveAt = Date.now();

  const roles: string[] = [];
  if (target.canManageWeb) roles.push('Quản lý Web (Quán)');
  if (target.canManageMaps) roles.push('Quản lý Maps');

  state.auditLogs = addAdminAuditLog(
    state,
    roles.length > 0 ? `Cấp quyền: ${roles.join(' + ')}` : 'Thu hồi quyền Quản lý Web/Maps',
    `${target.nickname} (${target.email})`,
    'user'
  );
  pushMemberToCloudRealtime(target, true);
  saveAdminState(state);
}

export function deleteMemberAndPurgeReviews(memberKey: string): { purgedReviews: number } {
  const state = getAdminState();
  const key = memberKey.trim().toLowerCase();
  const target = state.members[key];
  let purgedCount = 0;

  if (target && typeof window !== 'undefined') {
    const authorName = (target.nickname || '').toLowerCase().trim();
    const displayName = (target.displayName || '').toLowerCase().trim();

    // 1. Quét và xóa toàn bộ đánh giá quán của nick này
    for (const storageKey of ['xuanhoa_reviews_v1', 'xuanhoa_place_reviews_v1']) {
      try {
        const rawPlaceRevs = localStorage.getItem(storageKey);
        if (rawPlaceRevs) {
          const map = JSON.parse(rawPlaceRevs) as Record<string, any[]>;
          for (const pid of Object.keys(map)) {
            const before = map[pid].length;
            map[pid] = map[pid].filter(r => {
              const rAuthor = (r.author || '').toLowerCase().trim();
              return rAuthor !== authorName && rAuthor !== displayName;
            });
            purgedCount += before - map[pid].length;
          }
          localStorage.setItem(storageKey, JSON.stringify(map));
        }
      } catch {}
    }

    // 2. Quét và xóa toàn bộ đánh giá món của nick này
    try {
      const rawDishRevs = localStorage.getItem('xuanhoa_dish_reviews_v1');
      if (rawDishRevs) {
        const map = JSON.parse(rawDishRevs) as Record<string, any[]>;
        for (const did of Object.keys(map)) {
          const before = map[did].length;
          map[did] = map[did].filter(r => {
            const rAuthor = (r.author || '').toLowerCase().trim();
            return rAuthor !== authorName && rAuthor !== displayName;
          });
          purgedCount += before - map[did].length;
        }
        localStorage.setItem('xuanhoa_dish_reviews_v1', JSON.stringify(map));
      }
    } catch {}

    state.auditLogs = addAdminAuditLog(
      state,
      `Xóa tài khoản & Quét sạch ${purgedCount} đánh giá`,
      `${target.nickname} (${target.email})`,
      'user'
    );
    delete state.members[key];
    removeMemberFromCloudRealtime(key);
    saveAdminState(state);
  }

  return { purgedReviews: purgedCount };
}

export interface SystemReviewItem {
  id: string;
  targetId: string;
  targetName: string;
  targetType: 'place' | 'dish';
  author: string;
  avatar?: string;
  rating: number;
  date: string;
  content: string;
  photo?: string;
}

export function getAllSystemReviews(): SystemReviewItem[] {
  if (typeof window === 'undefined') return [];
  const list: SystemReviewItem[] = [];
  const placesMap = new Map(xuanHoaPlaces.map(p => [p.id, p.name]));

  try {
    const rawPlaces = localStorage.getItem('xuanhoa_reviews_v1');
    if (rawPlaces) {
      const parsed: Record<string, any[]> = JSON.parse(rawPlaces);
      for (const [placeId, revs] of Object.entries(parsed)) {
        for (const r of revs || []) {
          list.push({
            id: r.id,
            targetId: placeId,
            targetName: placesMap.get(placeId) || placeId,
            targetType: 'place',
            author: r.author || 'Ẩn danh',
            avatar: r.avatar,
            rating: r.rating || 5,
            date: r.date || 'Gần đây',
            content: r.content || '',
            photo: r.photo,
          });
        }
      }
    }
  } catch {}

  try {
    const rawDishes = localStorage.getItem('xuanhoa_dish_reviews_v1');
    if (rawDishes) {
      const parsed: Record<string, any[]> = JSON.parse(rawDishes);
      for (const [foodId, revs] of Object.entries(parsed)) {
        for (const r of revs || []) {
          if (r.id?.startsWith('init_dish_')) continue;
          list.push({
            id: r.id,
            targetId: foodId,
            targetName: foodId,
            targetType: 'dish',
            author: r.author || 'Ẩn danh',
            avatar: r.avatar,
            rating: r.rating || 5,
            date: r.date || 'Gần đây',
            content: r.content || '',
            photo: r.photo,
          });
        }
      }
    }
  } catch {}

  return list;
}

export function deleteSystemReview(reviewId: string, targetId: string, targetType: 'place' | 'dish'): void {
  if (typeof window === 'undefined') return;
  const storageKey = targetType === 'place' ? 'xuanhoa_reviews_v1' : 'xuanhoa_dish_reviews_v1';
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed: Record<string, any[]> = JSON.parse(raw);
      if (parsed[targetId]) {
        parsed[targetId] = parsed[targetId].filter(r => r.id !== reviewId);
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
    }
  } catch {}

  const state = getAdminState();
  state.auditLogs = addAdminAuditLog(
    state,
    `Xóa bình luận vi phạm (${targetType === 'place' ? 'Quán' : 'Món'})`,
    `ID: ${reviewId}`,
    'review'
  );
  saveAdminState(state);
}

export function seedDemoMembersIfEmpty(): void {
  if (typeof window === 'undefined') return;
  const state = getAdminState();
  let changed = false;

  // 1. Xóa bỏ hoàn toàn các tài khoản mẫu / mô phỏng cả ở Local lẫn trên Firebase Cloud để đảm bảo 100% là người đăng ký THỰC TẾ
  for (const fakeEmail of Array.from(BLOCKED_FAKE_OR_TEST_MEMBER_EMAILS)) {
    removeMemberFromCloudRealtime(fakeEmail);
    if (state.members[fakeEmail]) {
      delete state.members[fakeEmail];
      changed = true;
    }
  }
  for (const existingKey of Object.keys(state.members)) {
    if (isBlockedFakeOrTestMemberEmail(existingKey)) {
      removeMemberFromCloudRealtime(existingKey);
      delete state.members[existingKey];
      changed = true;
    }
  }

  // 2. Chỉ đồng bộ nick Gmail THẬT đang đăng nhập trên trình duyệt hiện tại (và dọn sạch cache localStorage nếu vướng nick mẫu cũ)
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (
        storageKey === 'xuanhoa_auth_user_v1' ||
        (storageKey && storageKey.startsWith('xuanhoa_profile_email_'))
      ) {
        const rawUser = localStorage.getItem(storageKey);
        if (!rawUser) continue;
        const parsedUser = JSON.parse(rawUser);
        if (parsedUser && parsedUser.email) {
          const emailKey = parsedUser.email.trim().toLowerCase();
          if (isBlockedFakeOrTestMemberEmail(emailKey)) {
            keysToRemove.push(storageKey);
            continue;
          }
          if (storageKey !== 'xuanhoa_auth_user_v1') continue;
          const isAdminEmail = (state.adminEmails || DEFAULT_ADMIN_EMAILS).includes(emailKey);
          if (!state.members[emailKey]) {
            const newLocalMember: ManagedMember = {
              uid: parsedUser.uid || `uid_${Date.now()}`,
              email: parsedUser.email,
              displayName: parsedUser.displayName || parsedUser.nickname || emailKey,
              nickname: parsedUser.nickname || parsedUser.displayName || emailKey,
              avatar: parsedUser.avatar || '',
              avatarId: parsedUser.avatarId || 'm_thin',
              gender: parsedUser.gender || 'male',
              phone: parsedUser.phone || '',
              residentType: parsedUser.residentType || 'local',
              tastePreferences: parsedUser.tastePreferences || [],
              status: isAdminEmail ? 'admin' : 'active',
              spinsCount: 0,
              level: 1,
              reviewsCount: 0,
              createdAt: parsedUser.createdAt || Date.now(),
              lastActiveAt: Date.now(),
            };
            state.members[emailKey] = newLocalMember;
            pushMemberToCloudRealtime(newLocalMember, false);
            changed = true;
          } else {
            pushMemberToCloudRealtime(state.members[emailKey], false);
          }
        }
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {}

  if (changed) {
    saveAdminState(state, true);
  }
}

// ============================================================================
// 2. HỢP NHẤT DỮ LIỆU QUÁN ĂN (CODE GỐC + ADMIN OVERRIDES + QUÁN MỚI)
// ============================================================================
export interface AdminPlaceItem {
  place: Place;
  status: PlaceStatus;
  sectorTag: string;
  mapCategory?: string;
  locationStatus?: 'located' | 'unlocated' | 'invalid' | 'pending_geocode';
  fullMenu: CustomMenuEntry[];
  isVerified: boolean;
  isFeatured: boolean;
  priorityBoost: 1 | 2 | 3;
  isModified: boolean;
  isCustom: boolean;
  isNewlyDetected: boolean;
  updatedAt?: number;
}

export function computePlaceLocationStatus(
  ov?: Partial<PlaceOverride> | null,
  isCivicOrOsm = false
): 'located' | 'unlocated' | 'invalid' | 'pending_geocode' {
  if (!ov) return isCivicOrOsm ? 'located' : 'unlocated';
  if (ov.coordinateVerified === false) {
    if (ov.locationStatus === 'invalid') return 'invalid';
    return 'unlocated';
  }
  const hasValidLatLng =
    typeof ov.lat === 'number' &&
    typeof ov.lng === 'number' &&
    Number.isFinite(ov.lat) &&
    Number.isFinite(ov.lng) &&
    ov.lat >= 8 &&
    ov.lat <= 24 &&
    ov.lng >= 102 &&
    ov.lng <= 110;
  if (hasValidLatLng && (isCivicOrOsm || (ov.coordinateVerified === true && ov.adminPinApproved === true))) {
    return 'located';
  }
  if (ov.locationStatus === 'invalid' || ov.locationStatus === 'pending_geocode') {
    return ov.locationStatus;
  }
  const rawMapsUrl = (ov.mapsUrl || ov.customPlaceData?.mapsUrl || '').trim();
  if (
    rawMapsUrl &&
    !hasValidLatLng &&
    (rawMapsUrl.startsWith('http://') ||
      rawMapsUrl.startsWith('https://') ||
      rawMapsUrl.includes('goo.gl') ||
      rawMapsUrl.includes('google.com/maps'))
  ) {
    return 'invalid';
  }
  return isCivicOrOsm ? 'located' : 'unlocated';
}

function inferDefaultSectorTag(place: Place): string {
  const combined = `${place.name || ''} ${place.tagline || ''} ${(place.tags || []).join(' ')}`.toLowerCase();
  if (
    combined.includes('bi-a') ||
    combined.includes('bi a') ||
    combined.includes('bida') ||
    combined.includes('billiards') ||
    combined.includes('billiard') ||
    combined.includes('pool club') ||
    combined.includes('clb bi') ||
    combined.includes('cyber') ||
    combined.includes('ps5') ||
    combined.includes('ps4')
  ) {
    return 'bia-game';
  }
  const tagsLower = (place.tags || []).map(t => t.toLowerCase());
  if (tagsLower.some(t => t.includes('bi-a') || t.includes('billiards') || t.includes('game') || t.includes('cyber'))) {
    return 'bia-game';
  }
  if (tagsLower.some(t => t.includes('điện thoại') || t.includes('mobile') || t.includes('công nghệ'))) {
    return 'dien-thoai';
  }
  if (tagsLower.some(t => t.includes('karaoke') || t.includes('ăn chơi') || t.includes('lounge'))) {
    return 'an-choi';
  }
  if (tagsLower.some(t => t.includes('thời trang') || t.includes('dịch vụ') || t.includes('spa'))) {
    return 'dich-vu';
  }
  return getPlaceStyleGroup(place);
}

export function getAllManagedPlaces(): AdminPlaceItem[] {
  const state = getAdminState();
  const knownSet = new Set(state.knownPlaceIds || []);
  const result: AdminPlaceItem[] = [];

  // 1. Quán từ code gốc (tự động nhận diện cả các quán mới thêm vào code sau này)
  for (const basePlace of xuanHoaPlaces) {
    const ov = state.places[basePlace.id];
    const status: PlaceStatus = ov?.status || 'active';
    if (status === 'deleted' && !ov?.pendingWebApproval && !ov?.pendingMapApproval) {
      continue;
    }

    const fullMenu: CustomMenuEntry[] = ov?.customMenu
      ? ov.customMenu.map(m => ({ ...m, name: cleanDishDisplayTitle(m.name) }))
      : (basePlace.menu || []).map(m => ({
          id: m.id,
          name: cleanDishDisplayTitle(m.name),
          price: m.price,
          category: m.tag,
          description: m.description,
          serviceTag: m.serviceTag || 'both',
          isLocked: false,
        }));

    const minP = ov?.minPrice !== undefined ? ov.minPrice : basePlace.minPrice;
    const maxP = ov?.maxPrice !== undefined ? ov.maxPrice : basePlace.maxPrice;

    const mergedPlace: Place = {
      ...basePlace,
      name: ov?.name !== undefined ? ov.name : basePlace.name,
      tagline: ov?.tagline !== undefined ? ov.tagline : basePlace.tagline,
      address: ov?.address !== undefined ? ov.address : basePlace.address,
      zone: ov?.zone !== undefined ? ov.zone : basePlace.zone,
      distance: ov?.distance !== undefined ? ov.distance : basePlace.distance,
      phone: ov?.phone !== undefined ? ov.phone : basePlace.phone,
      openHours: ov?.openHours !== undefined ? ov.openHours : basePlace.openHours,
      minPrice: minP,
      maxPrice: maxP,
      priceRange: `${minP}k - ${maxP}k`,
      category: ov?.category !== undefined ? ov.category : basePlace.category,
      serviceMode: ov?.serviceMode !== undefined ? ov.serviceMode : basePlace.serviceMode,
      deliveryNote: ov?.deliveryNote !== undefined ? ov.deliveryNote : basePlace.deliveryNote,
      mapsQuery: ov?.mapsQuery !== undefined ? ov.mapsQuery : basePlace.mapsQuery,
      mapsUrl: ov?.mapsUrl !== undefined ? ov.mapsUrl : basePlace.mapsUrl,
      quip: ov?.quip !== undefined ? ov.quip : basePlace.quip,
      tags: ov?.tags !== undefined ? ov.tags : basePlace.tags,
      imageUrl: ov?.imageUrl !== undefined ? ov.imageUrl : basePlace.imageUrl,
      signatureDish: {
        ...basePlace.signatureDish,
        id: basePlace.signatureDish.id || `${basePlace.id}_sig`,
        name: cleanDishDisplayTitle(ov?.signatureDishName !== undefined ? ov.signatureDishName : basePlace.signatureDish.name),
        price: ov?.signatureDishPrice !== undefined ? ov.signatureDishPrice : basePlace.signatureDish.price,
      },
      menu: fullMenu
        .filter(m => !m.isLocked)
        .map((m, idx) => ({
          id: m.id || `${basePlace.id}_m_${idx}`,
          name: cleanDishDisplayTitle(m.name),
          price: m.price,
          tag: m.category,
          description: m.description,
          serviceTag: m.serviceTag,
        })),
    };

    const boost: 1 | 2 | 3 = ov?.priorityBoost || (ov?.isFeatured ? 2 : 1);

    const resolvedSectorTag = ov?.sectorTag || inferDefaultSectorTag(mergedPlace);
    const isCivic =
      resolvedSectorTag === 'dia-danh' ||
      ov?.mapCategory === 'public' ||
      ov?.mapCategory === 'school' ||
      ov?.mapCategory === 'medical';

    result.push({
      place: mergedPlace,
      status,
      sectorTag: resolvedSectorTag,
      mapCategory: ov?.mapCategory,
      locationStatus: computePlaceLocationStatus(ov, isCivic),
      fullMenu,
      isVerified: ov?.verified !== undefined ? ov.verified : true,
      isFeatured: boost > 1 || !!ov?.isFeatured,
      priorityBoost: boost,
      isModified: !!ov,
      isCustom: false,
      isNewlyDetected: !knownSet.has(basePlace.id),
      updatedAt: ov?.updatedAt,
    });
  }

  // 2. Quán do Admin thêm mới trực tiếp trên bảng điều khiển
  for (const [id, ov] of Object.entries(state.places)) {
    if (ov.status === 'deleted' && !ov.pendingWebApproval && !ov.pendingMapApproval) {
      continue;
    }
    if (ov.isCustom && ov.customPlaceData && !xuanHoaPlaces.some(p => p.id === id)) {
      const fullMenu: CustomMenuEntry[] = ov.customMenu
        ? ov.customMenu.map(m => ({ ...m, name: cleanDishDisplayTitle(m.name) }))
        : (ov.customPlaceData.menu || []).map(m => ({
            id: m.id,
            name: cleanDishDisplayTitle(m.name),
            price: m.price,
            category: m.tag,
            description: m.description,
            serviceTag: m.serviceTag || 'both',
            isLocked: false,
          }));

      const minP = ov.minPrice ?? ov.customPlaceData.minPrice;
      const maxP = ov.maxPrice ?? ov.customPlaceData.maxPrice;

      const mergedCustom: Place = {
        ...ov.customPlaceData,
        name: ov.name || ov.customPlaceData.name,
        tagline: ov.tagline || ov.customPlaceData.tagline,
        address: ov.address || ov.customPlaceData.address,
        zone: ov.zone || ov.customPlaceData.zone,
        distance: ov.distance || ov.customPlaceData.distance,
        phone: ov.phone ?? ov.customPlaceData.phone,
        openHours: ov.openHours ?? ov.customPlaceData.openHours,
        minPrice: minP,
        maxPrice: maxP,
        priceRange: `${minP}k - ${maxP}k`,
        category: ov.category || ov.customPlaceData.category,
        serviceMode: ov.serviceMode || ov.customPlaceData.serviceMode,
        deliveryNote: ov.deliveryNote ?? ov.customPlaceData.deliveryNote,
        mapsQuery: ov.mapsQuery ?? ov.customPlaceData.mapsQuery,
        mapsUrl: ov.mapsUrl ?? ov.customPlaceData.mapsUrl,
        quip: ov.quip ?? ov.customPlaceData.quip,
        tags: ov.tags ?? ov.customPlaceData.tags,
        imageUrl: ov.imageUrl || ov.customPlaceData.imageUrl,
        signatureDish: ov.customPlaceData.signatureDish
          ? {
              ...ov.customPlaceData.signatureDish,
              name: cleanDishDisplayTitle(ov.signatureDishName || ov.customPlaceData.signatureDish.name),
            }
          : { id: `${id}_sig`, name: 'Món ngon đặc trưng', price: minP },
        menu: fullMenu
          .filter(m => !m.isLocked)
          .map((m, idx) => ({
            id: m.id || `${id}_m_${idx}`,
            name: cleanDishDisplayTitle(m.name),
            price: m.price,
            tag: m.category,
            description: m.description,
            serviceTag: m.serviceTag,
          })),
      };

      const boost: 1 | 2 | 3 = ov.priorityBoost || (ov.isFeatured ? 2 : 1);
      const customSectorTag = ov.sectorTag || inferDefaultSectorTag(mergedCustom);
      const isCivicCustom =
        customSectorTag === 'dia-danh' ||
        ov.mapCategory === 'public' ||
        ov.mapCategory === 'school' ||
        ov.mapCategory === 'medical';

      result.push({
        place: mergedCustom,
        status: ov.status || 'active',
        sectorTag: customSectorTag,
        mapCategory: ov.mapCategory,
        locationStatus: computePlaceLocationStatus(ov, isCivicCustom),
        fullMenu,
        isVerified: ov.verified ?? true,
        isFeatured: boost > 1 || !!ov.isFeatured,
        priorityBoost: boost,
        isModified: true,
        isCustom: true,
        isNewlyDetected: false,
        updatedAt: ov.updatedAt,
      });
    }
  }

  // Sắp xếp chuẩn theo bảng chữ cái A -> B -> C -> D (tiếng Việt)
  return result.sort((a, b) => a.place.name.localeCompare(b.place.name, 'vi'));
}

// Dành cho giao diện người dùng (Vòng quay & Danh bạ Quán):
// Quán đang Ưu tiên (priorityBoost > 1) sẽ xuất hiện lên đầu và có tần suất xuất hiện trên vòng quay cao hơn
export function getActivePublicPlaces(): Place[] {
  const state = getAdminState();
  const activeItems = getAllManagedPlaces().filter(item => {
    if (item.status !== 'active') return false;
    if (item.sectorTag === 'dia-danh') return false;
    const ov = state.places[item.place.id];
    if (ov?.mapCategory === 'public' || ov?.mapCategory === 'school' || ov?.mapCategory === 'medical') {
      return false;
    }
    return true;
  });
  const sorted = [...activeItems].sort((a, b) => {
    if (b.priorityBoost !== a.priorityBoost) return b.priorityBoost - a.priorityBoost;
    return a.place.name.localeCompare(b.place.name, 'vi');
  });

  const pool: Place[] = [];
  for (const item of sorted) {
    pool.push(item.place);
    // Nếu quán được bật Ưu tiên (x2 hoặc x3), nhân bản nhẹ trong bể quay để tăng xác suất trúng
    if (item.priorityBoost === 2) {
      pool.push(item.place);
    } else if (item.priorityBoost === 3) {
      pool.push(item.place, item.place);
    }
  }
  return pool;
}

// ============================================================================
// 3. HỢP NHẤT DỮ LIỆU MÓN ĂN (CODE GỐC + ADMIN OVERRIDES + MÓN MỚI)
// ============================================================================
export interface AdminDishItem {
  food: Food;
  key: string;
  categoryKey: MainCategoryKey;
  status: DishStatus;
  placeId?: string;
  placeName?: string;
  priorityBoost: 1 | 2 | 3;
  isModified: boolean;
  isCustom: boolean;
  isNewlyDetected: boolean;
  updatedAt?: number;
}

// Tự động liên kết món ăn với quán tương ứng dựa trên thông tin sub/tên quán
export function matchDishToPlace(food: Food, places: Place[]): { placeId?: string; placeName?: string } {
  const subText = (food.sub || '').toLowerCase();
  const nameText = (food.name || '').toLowerCase();

  for (const p of places) {
    const cleanPName = p.name
      .toLowerCase()
      .split(' - ')[0]
      .split(' • ')[0]
      .split(' (')[0]
      .trim();
    if (cleanPName.length >= 4 && (subText.includes(cleanPName) || nameText.includes(cleanPName))) {
      return { placeId: p.id, placeName: p.name };
    }
    if (p.menu && p.menu.some(m => m.name.toLowerCase().trim() === nameText.trim())) {
      return { placeId: p.id, placeName: p.name };
    }
  }
  return {};
}

export function getAllManagedDishes(): AdminDishItem[] {
  const state = getAdminState();
  const knownSet = new Set(state.knownDishKeys || []);
  const managedPlaces = getAllManagedPlaces();
  const placeItemMap = new Map<string, AdminPlaceItem>(
    managedPlaces.map(p => [p.place.id, p])
  );
  const lockedOrDeletedPlaceIds = new Set(
    managedPlaces.filter(p => p.status !== 'active').map(p => p.place.id)
  );
  const placeBoostMap = new Map<string, 1 | 2 | 3>(
    managedPlaces.map(p => [p.place.id, p.priorityBoost])
  );
  const allPlacesList = managedPlaces.map(p => p.place);

  const categories: MainCategoryKey[] = ['an-gi', 'nhau-gi', 'uong-gi'];
  const seenKeys = new Set<string>();
  const seenNormalizedNames = new Set<string>();
  const result: AdminDishItem[] = [];

  for (const catKey of categories) {
    const items = getCategoryItems(catKey);
    for (const baseFood of items) {
      const key = getDishUniqueKey(baseFood);
      if (seenKeys.has(`${catKey}_${key}`)) continue;
      seenKeys.add(`${catKey}_${key}`);

      const ov = state.dishes[key];
      const matched = matchDishToPlace(baseFood, allPlacesList);
      const placeId = ov?.placeId || matched.placeId;
      const placeItem = placeId ? placeItemMap.get(placeId) : undefined;
      const placeName = ov?.placeName || placeItem?.place.name || matched.placeName;

      // Kiểm tra xem món này có đang nằm trong Thực đơn đã chỉnh sửa của Quán không
      let matchedMenuEntry: CustomMenuEntry | undefined;
      if (placeId && state.places[placeId]?.customMenu && placeItem) {
        const normBase = baseFood.name.toLowerCase().trim();
        matchedMenuEntry = placeItem.fullMenu.find(
          m =>
            (m.id && m.id === baseFood.customId) ||
            m.name.toLowerCase().trim() === normBase
        );
      }

      let status: DishStatus = ov?.status || 'active';
      if (status === 'active' && placeId && lockedOrDeletedPlaceIds.has(placeId)) {
        status = 'locked';
      }
      if (status === 'active' && matchedMenuEntry?.isLocked) {
        status = 'locked';
      }

      const boost: 1 | 2 | 3 = (placeId && placeBoostMap.get(placeId)) || 1;

      const finalName = cleanDishDisplayTitle(ov?.name !== undefined ? ov.name : matchedMenuEntry?.name || baseFood.name);
      const finalPrice = ov?.price !== undefined ? ov.price : matchedMenuEntry?.price ?? baseFood.price;

      const mergedFood: Food = {
        ...baseFood,
        name: finalName,
        sub: ov?.sub !== undefined ? ov.sub : baseFood.sub,
        price: finalPrice,
        rarity: ov?.rarity !== undefined ? ov.rarity : baseFood.rarity,
        quip: ov?.quip !== undefined ? ov.quip : matchedMenuEntry?.description || baseFood.quip,
        customImage: ov?.customImage !== undefined ? ov.customImage : baseFood.customImage,
      };

      seenNormalizedNames.add(finalName.toLowerCase().trim());
      if (baseFood.customId === 'dish_clch_chao_long') {
        seenNormalizedNames.add('cháo lòng');
        seenNormalizedNames.add('cháo lòng thập cẩm');
      }
      if (baseFood.customId === 'dish_clch_bun_long') {
        seenNormalizedNames.add('bún lòng');
        seenNormalizedNames.add('bún lòng thập cẩm');
      }

      result.push({
        food: mergedFood,
        key,
        categoryKey: ov?.categoryKey || catKey,
        status,
        placeId,
        placeName,
        priorityBoost: boost,
        isModified: !!ov || !!matchedMenuEntry,
        isCustom: false,
        isNewlyDetected: !knownSet.has(key),
        updatedAt: ov?.updatedAt || placeItem?.updatedAt,
      });
    }
  }

  // 2. Các món do Admin thêm trong state.dishes
  for (const [key, ov] of Object.entries(state.dishes)) {
    if (ov.isCustom && ov.customFoodData) {
      const placeId = ov.placeId || ov.customFoodData.placeId;
      let status: DishStatus = ov.status || 'active';
      if (status === 'active' && placeId && lockedOrDeletedPlaceIds.has(placeId)) {
        status = 'locked';
      }
      const boost: 1 | 2 | 3 = (placeId && placeBoostMap.get(placeId)) || 1;
      const fName = cleanDishDisplayTitle(ov.name || ov.customFoodData.name);
      seenNormalizedNames.add(fName.toLowerCase().trim());

      result.push({
        food: {
          ...ov.customFoodData,
          name: fName,
          sub: ov.sub ?? ov.customFoodData.sub,
          price: ov.price ?? ov.customFoodData.price,
          rarity: ov.rarity ?? ov.customFoodData.rarity,
          quip: ov.quip ?? ov.customFoodData.quip,
          customImage: ov.customImage ?? ov.customFoodData.customImage,
        },
        key,
        categoryKey: ov.categoryKey || ov.customFoodData.categoryKey || 'an-gi',
        status,
        placeId,
        placeName: ov.placeName || ov.customFoodData.placeName,
        priorityBoost: boost,
        isModified: true,
        isCustom: true,
        isNewlyDetected: false,
        updatedAt: ov.updatedAt,
      });
    }
  }

  // 3. Tự động đồng bộ các món mới được thêm trực tiếp trong Thực đơn của Quán (hoặc Quán Mới thêm ở Admin)
  // sang thẳng Vòng Quay Chọn Món & Kho Món trên Web chính
  for (const placeItem of managedPlaces) {
    const pOv = state.places[placeItem.place.id];
    if (!pOv?.customMenu && !placeItem.isCustom) continue;

    const inferCategoryKey = (dishTag?: string): MainCategoryKey => {
      const t = (dishTag || '').toLowerCase();
      if (
        t.includes('uống') ||
        t.includes('trà') ||
        t.includes('cafe') ||
        t.includes('cà phê') ||
        placeItem.sectorTag === 'uong' ||
        placeItem.place.category === 'cafe'
      ) {
        return 'uong-gi';
      }
      if (
        placeItem.sectorTag === 'nhau-lau' ||
        placeItem.place.category === 'pub' ||
        t.includes('lẩu') ||
        t.includes('nướng') ||
        t.includes('nhậu')
      ) {
        return 'nhau-gi';
      }
      return 'an-gi';
    };

    placeItem.fullMenu.forEach((m, idx) => {
      const cleanedMenuName = cleanDishDisplayTitle(m.name || '');
      const normName = cleanedMenuName.toLowerCase().trim();
      if (!normName || seenNormalizedNames.has(normName)) return;
      seenNormalizedNames.add(normName);

      const customId = m.id || `place_menu_${placeItem.place.id}_${idx}`;
      const catKey = inferCategoryKey(m.category);
      const rarity = m.price >= 150 ? 3 : m.price >= 80 ? 2 : m.price >= 45 ? 1 : 0;
      const dishStatus: DishStatus =
        placeItem.status !== 'active' || m.isLocked ? 'locked' : 'active';

      let resolvedDishImage = placeItem.place.imageUrl || 'ai_studio_dish_com_68_suon.jpg';
      if (normName.includes('bún lòng')) {
        resolvedDishImage = 'ai_studio_dish_bun_long_chi_hong.jpg';
      } else if (normName.includes('cháo lòng')) {
        resolvedDishImage = 'ai_studio_dish_chao_long_chi_hong.jpg';
      } else if (normName.includes('kem dừa')) {
        resolvedDishImage = 'ai_studio_dish_bap1991_kem_dua_ma_lai.jpg';
      } else if (normName.includes('mỳ cay') || normName.includes('mì cay')) {
        resolvedDishImage = 'ai_studio_dish_bap1991_my_cay.jpg';
      }

      const generatedFood: Food = {
        name: cleanedMenuName,
        sub: `${m.category || 'Đặc sản'} • ${placeItem.place.name}`,
        price: m.price,
        image: -101,
        customId,
        customImage: resolvedDishImage,
        rarity,
        quip:
          m.description ||
          placeItem.place.tagline ||
          `Món ngon tại ${placeItem.place.name} (${placeItem.place.address})`,
      };

      result.push({
        food: generatedFood,
        key: customId,
        categoryKey: catKey,
        status: dishStatus,
        placeId: placeItem.place.id,
        placeName: placeItem.place.name,
        priorityBoost: placeItem.priorityBoost,
        isModified: true,
        isCustom: true,
        isNewlyDetected: false,
        updatedAt: placeItem.updatedAt,
      });
    });
  }

  return result;
}

// Dành cho Vòng quay Chọn Món & Kho Món:
// Nếu quán của món đó đang được bật Ưu tiên (x2 / x3), món ăn của quán đó cũng xuất hiện nhiều hơn tương ứng!
export function getActivePublicCategoryItems(categoryKey: MainCategoryKey): Food[] {
  const activeDishes = getAllManagedDishes().filter(
    item => item.categoryKey === categoryKey && item.status === 'active'
  );
  const pool: Food[] = [];
  for (const item of activeDishes) {
    pool.push(item.food);
    if (item.priorityBoost === 2) {
      pool.push(item.food);
    } else if (item.priorityBoost === 3) {
      pool.push(item.food, item.food);
    }
  }
  return pool;
}

// ============================================================================
// 4. CÁC HÀM THAO TÁC QUẢN TRỊ QUÁN & MÓN (CRUD + KHÔI PHỤC GỐC)
// ============================================================================
export function savePlaceAdminOverride(placeId: string, patch: Partial<PlaceOverride>, actionLabel?: string): void {
  const state = getAdminState();
  const current = state.places[placeId] || { id: placeId, updatedAt: Date.now() };
  // Không cho phép patch chỉ sửa text/menu vô tình ghi đè lat/lng hiện có bằng undefined
  const merged: PlaceOverride = {
    ...current,
    ...patch,
    id: placeId,
    updatedAt: Date.now(),
  };
  if (
    !('lat' in patch) &&
    typeof current.lat === 'number' &&
    typeof current.lng === 'number' &&
    patch.coordinateVerified !== false
  ) {
    merged.lat = current.lat;
    merged.lng = current.lng;
    if (patch.coordinateVerified === undefined) merged.coordinateVerified = current.coordinateVerified;
    if (patch.adminPinApproved === undefined) merged.adminPinApproved = current.adminPinApproved;
  }
  const isCivic =
    merged.sectorTag === 'dia-danh' ||
    merged.mapCategory === 'public' ||
    merged.mapCategory === 'school' ||
    merged.mapCategory === 'medical';
  merged.locationStatus = patch.locationStatus ?? computePlaceLocationStatus(merged, isCivic);
  state.places[placeId] = merged;

  if (actionLabel) {
    const pName = patch.name || current.name || xuanHoaPlaces.find(p => p.id === placeId)?.name || placeId;
    state.auditLogs = addAdminAuditLog(state, actionLabel, pName, 'place');
  }
  saveAdminState(state);
}

export function resetPlaceToDefault(placeId: string): void {
  const state = getAdminState();
  const base = xuanHoaPlaces.find(p => p.id === placeId);
  if (state.places[placeId]) {
    delete state.places[placeId];
    state.auditLogs = addAdminAuditLog(
      state,
      'Khôi phục dữ liệu gốc cho quán',
      base?.name || placeId,
      'place'
    );
    saveAdminState(state);
  }
}

export function createNewCustomPlace(newPlace: Place): void {
  const state = getAdminState();
  state.places[newPlace.id] = {
    id: newPlace.id,
    status: 'active',
    isCustom: true,
    customPlaceData: newPlace,
    updatedAt: Date.now(),
  };
  state.auditLogs = addAdminAuditLog(
    state,
    'Thêm quán ăn mới vào hệ thống',
    newPlace.name,
    'place'
  );
  saveAdminState(state);
}

export function saveDishAdminOverride(dishKey: string, patch: Partial<DishOverride>, actionLabel?: string): void {
  const state = getAdminState();
  const current = state.dishes[dishKey] || { key: dishKey, updatedAt: Date.now() };
  state.dishes[dishKey] = {
    ...current,
    ...patch,
    key: dishKey,
    updatedAt: Date.now(),
  };

  if (actionLabel) {
    state.auditLogs = addAdminAuditLog(state, actionLabel, patch.name || current.name || dishKey, 'dish');
  }
  saveAdminState(state);
}

export function resetDishToDefault(dishKey: string): void {
  const state = getAdminState();
  if (state.dishes[dishKey]) {
    const name = state.dishes[dishKey].name || dishKey;
    delete state.dishes[dishKey];
    state.auditLogs = addAdminAuditLog(state, 'Khôi phục mặc định cho món ăn', name, 'dish');
    saveAdminState(state);
  }
}

export function createNewCustomDish(
  food: Food,
  categoryKey: MainCategoryKey,
  placeId?: string,
  placeName?: string
): void {
  const state = getAdminState();
  const key = food.customId || `custom_dish_${Date.now()}`;
  const fullFood: Food = { ...food, customId: key };

  state.dishes[key] = {
    key,
    status: 'active',
    name: fullFood.name,
    sub: fullFood.sub,
    price: fullFood.price,
    rarity: fullFood.rarity,
    quip: fullFood.quip,
    customImage: fullFood.customImage,
    categoryKey,
    placeId,
    placeName,
    isCustom: true,
    customFoodData: {
      ...fullFood,
      categoryKey,
      placeId,
      placeName,
    },
    updatedAt: Date.now(),
  };

  // Nếu gắn vào 1 quán cụ thể, tự động thêm luôn vào menu của quán đó
  if (placeId) {
    const basePlace = xuanHoaPlaces.find(p => p.id === placeId);
    const placeOv = state.places[placeId] || { id: placeId, updatedAt: Date.now() };
    const existingMenu = placeOv.customMenu || basePlace?.menu?.map(m => ({ ...m })) || [];
    if (!existingMenu.some(m => m.name.toLowerCase() === fullFood.name.toLowerCase())) {
      placeOv.customMenu = [
        { name: fullFood.name, price: fullFood.price, category: 'Món mới' },
        ...existingMenu,
      ];
      state.places[placeId] = placeOv;
    }
  }

  state.auditLogs = addAdminAuditLog(
    state,
    `Thêm món mới (${placeName || categoryKey})`,
    `${fullFood.name} - ${fullFood.price}.000đ`,
    'dish'
  );
  saveAdminState(state);
}

export function updateAdminSystemSettings(patch: {
  adminPin?: string;
  adminEmails?: string[];
  adminAccounts?: AdminAccount[];
  sectorTags?: SectorCategoryTag[];
  fontScale?: 'normal' | 'large';
  requirePinOnOpen?: boolean;
}): void {
  const state = getAdminState();
  if (patch.adminPin !== undefined) state.adminPin = patch.adminPin;
  if (patch.adminEmails !== undefined) state.adminEmails = patch.adminEmails;
  if (patch.adminAccounts !== undefined) state.adminAccounts = patch.adminAccounts;
  if (patch.sectorTags !== undefined) state.sectorTags = patch.sectorTags;
  if (patch.fontScale !== undefined) state.fontScale = patch.fontScale;
  if (patch.requirePinOnOpen !== undefined) state.requirePinOnOpen = patch.requirePinOnOpen;

  state.auditLogs = addAdminAuditLog(
    state,
    'Cập nhật Cài đặt Hệ thống Quản trị',
    'Bảo mật & Cấu hình Giao diện',
    'system'
  );
  saveAdminState(state);
}

// ============================================================================
// 5. ĐĂNG NHẬP TÀI KHOẢN QUẢN LÝ (NICK + PASS + LƯU ĐĂNG NHẬP)
// ============================================================================
export function getAdminAccounts(): AdminAccount[] {
  const state = getAdminState();
  if (!state.adminAccounts || state.adminAccounts.length === 0) {
    return DEFAULT_ADMIN_ACCOUNTS;
  }
  return state.adminAccounts;
}

export function getLoggedAdminSession(): AdminAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawLocal = localStorage.getItem(ADMIN_AUTH_LOCAL_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as AdminAccount;
      if (parsed && parsed.username) return parsed;
    }
    const rawSession = sessionStorage.getItem(ADMIN_AUTH_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as AdminAccount;
      if (parsed && parsed.username) return parsed;
    }
  } catch {}
  return null;
}

export function isAdminAuthenticated(authUser?: UserAuthProfile | null): boolean {
  const roleInfo = getEffectiveAdminRoleInfo(undefined, authUser);
  return roleInfo.isSuperAdmin;
}

export function loginAdminWithCredentials(
  usernameInput: string,
  passwordInput: string,
  rememberMe: boolean
): { ok: boolean; account?: AdminAccount; message?: string } {
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();
  const accounts = getAdminAccounts();

  const matched = accounts.find(
    acc => acc.username.trim().toLowerCase() === cleanUser && acc.password === cleanPass
  );

  if (!matched) {
    return {
      ok: false,
      message: 'Tài khoản hoặc mật khẩu quản lý chưa chính xác!',
    };
  }

  if (typeof window !== 'undefined') {
    const payload = JSON.stringify(matched);
    if (rememberMe) {
      localStorage.setItem(ADMIN_AUTH_LOCAL_KEY, payload);
      sessionStorage.setItem(ADMIN_AUTH_SESSION_KEY, payload);
    } else {
      localStorage.removeItem(ADMIN_AUTH_LOCAL_KEY);
      sessionStorage.setItem(ADMIN_AUTH_SESSION_KEY, payload);
    }
  }

  const state = getAdminState();
  state.auditLogs = addAdminAuditLog(
    state,
    'Đăng nhập trang Quản trị',
    `${matched.displayName} (@${matched.username})`,
    'system'
  );
  saveAdminState(state);

  return { ok: true, account: matched };
}

export function logoutAdminSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ADMIN_AUTH_LOCAL_KEY);
    sessionStorage.removeItem(ADMIN_AUTH_SESSION_KEY);
    sessionStorage.removeItem('xuanhoa_admin_pin_ok');
  } catch {}
}

export function upsertAdminAccount(account: {
  id?: string;
  username: string;
  password: string;
  displayName: string;
  role?: 'superadmin' | 'manager';
  canManageWeb?: boolean;
  canManageMaps?: boolean;
}): void {
  const state = getAdminState();
  const currentList = getAdminAccounts();
  const cleanUsername = account.username.trim().toLowerCase();

  const existingIdx = currentList.findIndex(
    a => a.id === account.id || a.username.toLowerCase() === cleanUsername
  );

  let nextList: AdminAccount[];
  if (existingIdx >= 0) {
    nextList = [...currentList];
    nextList[existingIdx] = {
      ...nextList[existingIdx],
      username: cleanUsername,
      password: account.password.trim(),
      displayName: account.displayName.trim() || cleanUsername,
      role: account.role || nextList[existingIdx].role,
      canManageWeb: account.canManageWeb ?? nextList[existingIdx].canManageWeb ?? true,
      canManageMaps: account.canManageMaps ?? nextList[existingIdx].canManageMaps ?? false,
    };
  } else {
    const created: AdminAccount = {
      id: `adm_${Date.now()}`,
      username: cleanUsername,
      password: account.password.trim(),
      displayName: account.displayName.trim() || cleanUsername,
      role: account.role || 'manager',
      canManageWeb: account.canManageWeb ?? true,
      canManageMaps: account.canManageMaps ?? false,
      createdAt: Date.now(),
    };
    nextList = [...currentList, created];
  }

  state.adminAccounts = nextList;
  state.auditLogs = addAdminAuditLog(
    state,
    existingIdx >= 0 ? 'Cập nhật tài khoản Quản lý' : 'Cấp tài khoản Quản lý mới',
    `@${cleanUsername} (${account.displayName})`,
    'user'
  );
  saveAdminState(state);
}

export function deleteAdminAccount(accountId: string): void {
  const state = getAdminState();
  const currentList = getAdminAccounts();
  if (currentList.length <= 1) return; // Giữ tối thiểu 1 tài khoản quản trị
  const target = currentList.find(a => a.id === accountId);
  state.adminAccounts = currentList.filter(a => a.id !== accountId);
  if (target) {
    state.auditLogs = addAdminAuditLog(
      state,
      'Xóa tài khoản Quản lý',
      `@${target.username} (${target.displayName})`,
      'user'
    );
  }
  saveAdminState(state);
}

export function updatePlaceCoordinates(
  placeId: string,
  payload: {
    lat: number;
    lng: number;
    coordinateVerified: boolean;
    coordinateSource: 'openstreetmap' | 'admin_verified' | 'merchant_verified' | 'nominatim_geocoded';
    mapCategory?: string;
    placeName?: string;
  }
): AdminState {
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 20.0 ||
    lat > 23.0 ||
    lng < 104.0 ||
    lng > 107.0
  ) {
    throw new Error('Tọa độ không hợp lệ (ngoài phạm vi miền Bắc Việt Nam).');
  }

  const state = getAdminState();
  const roleInfo = getEffectiveAdminRoleInfo();
  const isSubManagerOnly = roleInfo.isAuthenticated && !roleInfo.isSuperAdmin;
  const isApproved = payload.coordinateVerified && !isSubManagerOnly;
  const prev = state.places[placeId] || { id: placeId, updatedAt: Date.now() };
  const nowIso = new Date().toISOString();

  state.places[placeId] = {
    ...prev,
    id: placeId,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    coordinateVerified: isApproved,
    adminPinApproved: isApproved,
    locationStatus: isApproved ? 'located' : 'unlocated',
    coordinateSource: payload.coordinateSource,
    lastVerifiedAt: nowIso,
    ...(payload.mapCategory ? { mapCategory: payload.mapCategory } : {}),
    updatedAt: Date.now(),
  };

  state.auditLogs = addAdminAuditLog(
    state,
    payload.coordinateVerified ? 'Xác minh tọa độ Bản đồ XUHO CITY' : 'Cập nhật tọa độ đề xuất',
    `${payload.placeName || placeId} (${lat.toFixed(5)}, ${lng.toFixed(5)}) [${payload.coordinateSource}]`,
    'place'
  );
  saveAdminState(state);
  return state;
}

export function clearPlaceCoordinates(placeId: string, placeName?: string): AdminState {
  const state = getAdminState();
  const prev = state.places[placeId] || { id: placeId, updatedAt: Date.now() };

  state.places[placeId] = {
    ...prev,
    id: placeId,
    lat: undefined,
    lng: undefined,
    mapsUrl: '',
    coordinateVerified: false,
    adminPinApproved: false,
    locationStatus: 'unlocated',
    coordinateSource: 'unverified',
    lastVerifiedAt: undefined,
    updatedAt: Date.now(),
  };

  state.auditLogs = addAdminAuditLog(
    state,
    'Gỡ ghim tọa độ về trạng thái Chưa định vị',
    placeName || placeId,
    'place'
  );
  saveAdminState(state);
  return state;
}

// ============================================================================
// 6. HỆ THỐNG MÃ CODE CHỦ QUÁN (MERCHANT CLAIM CODE) & DUYỆT THAY ĐỔI ĐỊNH VỊ
// ============================================================================

/**
 * Sinh mã code mặc định duy nhất cho mỗi quán (chỉ hiển thị trong trang Admin)
 */
export function buildDefaultMerchantCode(placeId: string): string {
  const clean = placeId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = (clean.slice(0, 5) || 'QUAN').padEnd(4, 'X');
  let hash = 2166136261;
  for (let i = 0; i < placeId.length; i++) {
    hash ^= placeId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  let h = Math.abs(hash);
  for (let i = 0; i < 4; i++) {
    suffix += chars[h % chars.length];
    h = Math.floor(h / chars.length) ^ (i + 17);
  }
  return `XH-${prefix}-${suffix}`;
}

/**
 * Lấy mã code hiện tại của quán (hoặc cấp lại mã mới nếu forceRegenerate = true)
 */
export function getOrGenerateMerchantCode(
  placeId: string,
  forceRegenerate = false,
  placeName?: string
): string {
  const state = getAdminState();
  const ov = state.places[placeId];
  if (!forceRegenerate && ov?.merchantClaimCode) {
    return ov.merchantClaimCode;
  }
  if (!forceRegenerate) {
    return buildDefaultMerchantCode(placeId);
  }

  const clean = placeId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = (clean.slice(0, 5) || 'QUAN').padEnd(4, 'X');
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  const newCode = `XH-${prefix}-${rand}`;

  state.places[placeId] = {
    ...(ov || { id: placeId }),
    id: placeId,
    merchantClaimCode: newCode,
    claimedByEmail: undefined,
    claimedByUid: undefined,
    claimedByName: undefined,
    claimedAt: undefined,
    updatedAt: Date.now(),
  };

  state.auditLogs = addAdminAuditLog(
    state,
    'Cấp lại Mã Code Chủ Quán mới & Thu hồi quyền cũ',
    `${placeName || placeId} -> Mã mới: ${newCode}`,
    'place'
  );
  saveAdminState(state);
  return newCode;
}

/**
 * Mã chuyên biệt dành cho Cộng tác viên / Quản lý Maps (không có quyền xóa quán hay khóa hệ thống như Admin tối cao,
 * nhưng được phép vào Bản đồ số, chỉnh định vị mọi quán và Tạo Địa Điểm Mới theo danh mục)
 */
export const MAP_MANAGER_MASTER_CODE = 'XH-MAPS-8899';

export interface EffectiveAdminRoleInfo {
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  canManageWeb: boolean;
  canManageMaps: boolean;
  displayName: string;
  identifier: string;
  roleBadgeLabel: string;
}

export function getEffectiveAdminRoleInfo(
  loggedAdmin?: AdminAccount | null,
  authUser?: UserAuthProfile | null
): EffectiveAdminRoleInfo {
  const state = getAdminState();
  const activeAdmin = loggedAdmin !== undefined ? loggedAdmin : getLoggedAdminSession();

  if (activeAdmin) {
    const accounts = getAdminAccounts();
    const freshAcc =
      accounts.find(a => a.id === activeAdmin.id || a.username === activeAdmin.username) ||
      activeAdmin;
    const isSuper =
      freshAcc.role === 'superadmin' ||
      freshAcc.username === 'admin' ||
      freshAcc.username === 'minhtt';
    const canWeb = isSuper ? true : Boolean(freshAcc.canManageWeb ?? true);
    const canMaps = isSuper ? true : Boolean(freshAcc.canManageMaps ?? false);
    const roleBadgeLabel = isSuper
      ? 'Admin'
      : canWeb && canMaps
      ? 'Quản lý Web & Maps'
      : canMaps
      ? 'Quản lý Maps'
      : 'Quản lý Web';
    return {
      isAuthenticated: true,
      isSuperAdmin: isSuper,
      canManageWeb: canWeb,
      canManageMaps: canMaps,
      displayName: freshAcc.displayName,
      identifier: `@${freshAcc.username}`,
      roleBadgeLabel,
    };
  }

  const effectiveUser = authUser?.email ? authUser : getStoredAuthUser();
  if (effectiveUser && effectiveUser.isLoggedIn && effectiveUser.email) {
    const cleanEmail = effectiveUser.email.trim().toLowerCase();
    const isSuperEmail = Boolean(
      DEFAULT_ADMIN_EMAILS.includes(cleanEmail) ||
        state.adminEmails?.some(e => e.trim().toLowerCase() === cleanEmail)
    );
    if (isSuperEmail) {
      return {
        isAuthenticated: true,
        isSuperAdmin: true,
        canManageWeb: true,
        canManageMaps: true,
        displayName: effectiveUser.displayName || effectiveUser.nickname || cleanEmail,
        identifier: cleanEmail,
        roleBadgeLabel: 'Admin',
      };
    }

    const memberRecord = state.members?.[cleanEmail];
    if (memberRecord && (memberRecord.canManageWeb || memberRecord.canManageMaps || memberRecord.status === 'admin')) {
      const isSuper = memberRecord.status === 'admin';
      const canWeb = isSuper ? true : Boolean(memberRecord.canManageWeb);
      const canMaps = isSuper ? true : Boolean(memberRecord.canManageMaps);
      const roleBadgeLabel = isSuper
        ? 'Admin'
        : canWeb && canMaps
        ? 'Quản lý Web & Maps'
        : canMaps
        ? 'Quản lý Maps'
        : 'Quản lý Web';
      return {
        isAuthenticated: true,
        isSuperAdmin: isSuper,
        canManageWeb: canWeb,
        canManageMaps: canMaps,
        displayName: memberRecord.nickname || memberRecord.displayName || cleanEmail,
        identifier: cleanEmail,
        roleBadgeLabel,
      };
    }
  }

  return {
    isAuthenticated: false,
    isSuperAdmin: false,
    canManageWeb: false,
    canManageMaps: false,
    displayName: '',
    identifier: '',
    roleBadgeLabel: '',
  };
}

export function requestOrExecuteDeletePlace(
  placeId: string,
  scope: 'web' | 'maps',
  placeName?: string,
  forceImmediate?: boolean
): { executedImmediately: boolean } {
  const state = getAdminState();
  const roleInfo = getEffectiveAdminRoleInfo();
  const current = state.places[placeId] || { id: placeId, updatedAt: Date.now() };
  const resolvedName =
    placeName || current.name || xuanHoaPlaces.find(p => p.id === placeId)?.name || placeId;

  if (roleInfo.isSuperAdmin || forceImmediate) {
    state.places[placeId] = {
      ...current,
      id: placeId,
      status: 'deleted',
      coordinateVerified: false,
      lat: undefined,
      lng: undefined,
      pendingWebApproval: null,
      pendingMapApproval: null,
      updatedAt: Date.now(),
    };
    const subKey = `sub_${placeId}`;
    if (state.merchantSubmissions?.[subKey]) {
      delete state.merchantSubmissions[subKey];
    }
    state.auditLogs = addAdminAuditLog(
      state,
      scope === 'web' ? '🗑️ Admin xóa quán khỏi hệ thống' : '🗑️ Admin xóa địa điểm khỏi Bản đồ',
      resolvedName,
      'place'
    );
    saveAdminState(state);
    return { executedImmediately: true };
  }

  // Quản lý (Web / Maps) yêu cầu xóa -> Chờ Admin duyệt
  const reqPayload = {
    submittedBy: roleInfo.identifier || (scope === 'web' ? 'quanlyweb' : 'quanlymaps'),
    submittedByName: roleInfo.displayName || (scope === 'web' ? 'Quản lý Web' : 'Quản lý Maps'),
    submittedAt: Date.now(),
    actionSummary: scope === 'web' ? 'Yêu cầu XÓA quán khỏi hệ thống' : 'Yêu cầu XÓA địa điểm khỏi Bản đồ',
    actionType: 'delete' as const,
    isDeleteRequest: true,
  };

  state.places[placeId] = {
    ...current,
    id: placeId,
    ...(scope === 'web' ? { pendingWebApproval: reqPayload } : { pendingMapApproval: reqPayload }),
    updatedAt: Date.now(),
  };

  state.auditLogs = addAdminAuditLog(
    state,
    scope === 'web' ? '⏳ Quản lý gửi yêu cầu XÓA quán (chờ duyệt)' : '⏳ Quản lý gửi yêu cầu XÓA địa điểm (chờ duyệt)',
    `${resolvedName} — bởi ${reqPayload.submittedByName}`,
    'place'
  );
  saveAdminState(state);
  return { executedImmediately: false };
}

export function approvePendingPlaceItem(placeId: string, scope: 'web' | 'maps'): void {
  const state = getAdminState();
  const ov = state.places[placeId];
  if (!ov) return;

  const baseName = ov.name || xuanHoaPlaces.find(p => p.id === placeId)?.name || placeId;
  const pendingObj = scope === 'web' ? ov.pendingWebApproval : ov.pendingMapApproval;
  const isDelete = Boolean(
    pendingObj?.isDeleteRequest ||
      pendingObj?.actionType === 'delete' ||
      ov.pendingWebApproval?.isDeleteRequest ||
      ov.pendingMapApproval?.isDeleteRequest
  );

  if (isDelete) {
    ov.status = 'deleted';
    ov.coordinateVerified = false;
    ov.adminPinApproved = false;
    ov.pendingWebApproval = null;
    ov.pendingMapApproval = null;
  } else {
    ov.status = 'active';
    const subKey = `sub_${placeId}`;
    const pendingSub = state.merchantSubmissions?.[subKey];
    if (
      pendingSub?.proposed &&
      typeof pendingSub.proposed.lat === 'number' &&
      typeof pendingSub.proposed.lng === 'number'
    ) {
      ov.lat = Number(pendingSub.proposed.lat.toFixed(6));
      ov.lng = Number(pendingSub.proposed.lng.toFixed(6));
    }
    if (typeof ov.lat === 'number' && typeof ov.lng === 'number') {
      ov.coordinateVerified = true;
      ov.adminPinApproved = true;
      ov.coordinateSource = ov.coordinateSource || 'admin_verified';
    }
    if (scope === 'web') {
      ov.pendingWebApproval = null;
    } else {
      ov.pendingMapApproval = null;
    }
  }
  ov.updatedAt = Date.now();
  state.places[placeId] = ov;

  // Đồng thời duyệt luôn trong merchantSubmissions nếu có
  const subKey = `sub_${placeId}`;
  if (state.merchantSubmissions?.[subKey]?.status === 'pending') {
    state.merchantSubmissions[subKey].status = 'approved';
    state.merchantSubmissions[subKey].reviewedAt = Date.now();
  }

  state.auditLogs = addAdminAuditLog(
    state,
    isDelete
      ? `✅ Admin đã duyệt XÓA ${scope === 'web' ? 'quán' : 'địa điểm Maps'}`
      : scope === 'web'
      ? '✅ Admin đã duyệt thêm Quán mới'
      : '✅ Admin đã duyệt thêm Định vị Maps',
    baseName,
    'place'
  );
  saveAdminState(state);
}

export function approveAllPendingPlaceItems(scope: 'web' | 'maps'): number {
  const state = getAdminState();
  let count = 0;
  for (const [placeId, ov] of Object.entries(state.places || {})) {
    const pendingObj = scope === 'web' ? ov.pendingWebApproval : ov.pendingMapApproval;
    if (!pendingObj) continue;
    const isDelete = Boolean(pendingObj.isDeleteRequest || pendingObj.actionType === 'delete');
    if (isDelete) {
      ov.status = 'deleted';
      ov.coordinateVerified = false;
      ov.adminPinApproved = false;
      ov.pendingWebApproval = null;
      ov.pendingMapApproval = null;
    } else {
      ov.status = 'active';
      const subKey = `sub_${placeId}`;
      const pendingSub = state.merchantSubmissions?.[subKey];
      if (
        pendingSub?.proposed &&
        typeof pendingSub.proposed.lat === 'number' &&
        typeof pendingSub.proposed.lng === 'number'
      ) {
        ov.lat = Number(pendingSub.proposed.lat.toFixed(6));
        ov.lng = Number(pendingSub.proposed.lng.toFixed(6));
      }
      if (typeof ov.lat === 'number' && typeof ov.lng === 'number') {
        ov.coordinateVerified = true;
        ov.adminPinApproved = true;
        ov.coordinateSource = ov.coordinateSource || 'admin_verified';
      }
      if (scope === 'web') ov.pendingWebApproval = null;
      else ov.pendingMapApproval = null;
    }
    ov.updatedAt = Date.now();
    state.places[placeId] = ov;
    const subKey = `sub_${placeId}`;
    if (state.merchantSubmissions?.[subKey]?.status === 'pending') {
      state.merchantSubmissions[subKey].status = 'approved';
      state.merchantSubmissions[subKey].reviewedAt = Date.now();
    }
    count++;
  }
  if (count > 0) {
    state.auditLogs = addAdminAuditLog(
      state,
      `⚡ Admin duyệt hàng loạt ${count} yêu cầu (${scope === 'web' ? 'Quản lý Quán' : 'Quản lý Maps'})`,
      `${count} mục`,
      'place'
    );
    saveAdminState(state);
  }
  return count;
}

export function rejectPendingPlaceItem(placeId: string, scope: 'web' | 'maps'): void {
  const state = getAdminState();
  const ov = state.places[placeId];
  if (!ov) return;

  const baseName = ov.name || xuanHoaPlaces.find(p => p.id === placeId)?.name || placeId;
  const pendingObj = scope === 'web' ? ov.pendingWebApproval : ov.pendingMapApproval;
  const isDelete = Boolean(pendingObj?.isDeleteRequest || pendingObj?.actionType === 'delete');

  if (isDelete) {
    if (scope === 'web') ov.pendingWebApproval = null;
    else ov.pendingMapApproval = null;
    ov.updatedAt = Date.now();
    state.places[placeId] = ov;
  } else if (scope === 'web') {
    if (ov.pendingWebApproval?.isNewPlace && ov.isCustom) {
      delete state.places[placeId];
    } else {
      ov.pendingWebApproval = null;
      state.places[placeId] = ov;
    }
  } else {
    if (ov.pendingMapApproval?.isNewPlace && ov.isCustom) {
      delete state.places[placeId];
    } else {
      if (ov.pendingMapApproval && ov.pendingMapApproval.previousLat !== undefined) {
        ov.lat = ov.pendingMapApproval.previousLat ?? undefined;
        ov.lng = ov.pendingMapApproval.previousLng ?? undefined;
      }
      ov.pendingMapApproval = null;
      state.places[placeId] = ov;
    }
  }

  const subKey = `sub_${placeId}`;
  if (state.merchantSubmissions?.[subKey]?.status === 'pending') {
    state.merchantSubmissions[subKey].status = 'rejected';
    state.merchantSubmissions[subKey].reviewedAt = Date.now();
  }

  state.auditLogs = addAdminAuditLog(
    state,
    isDelete
      ? `❌ Admin từ chối yêu cầu XÓA (${scope === 'web' ? 'Quán' : 'Maps'})`
      : scope === 'web'
      ? '❌ Admin từ chối thêm Quán mới'
      : '❌ Admin từ chối thêm Định vị Maps',
    baseName,
    'place'
  );
  saveAdminState(state);
}

export function isMapManagerAuthenticated(authUser?: UserAuthProfile | null): boolean {
  const roleInfo = getEffectiveAdminRoleInfo(undefined, authUser);
  if (roleInfo.isSuperAdmin || roleInfo.canManageMaps) return true;
  if (isAdminAuthenticated(authUser)) return true;
  if (authUser?.isMapManager) return true;
  const stored = getStoredAuthUser();
  if (stored?.isMapManager) return true;
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('xuanhoa_map_manager_active_v1') === 'true';
    } catch {}
  }
  return false;
}

/**
 * Chủ quán hoặc Quản lý Maps nhập Mã Code trên Bản đồ số
 */
export function verifyAndClaimPlaceWithCode(
  rawCodeInput: string,
  authUser: UserAuthProfile | null | undefined
): {
  ok: boolean;
  placeItem?: AdminPlaceItem;
  isMapManager?: boolean;
  message: string;
} {
  const cleanCode = rawCodeInput.trim().toUpperCase();
  if (!cleanCode) {
    return {
      ok: false,
      message: 'Vui lòng nhập mã định danh được cấp.',
    };
  }

  const state = getAdminState();
  const allManaged = getAllManagedPlaces();

  // Kiểm tra nếu nhập Mã Quản Lý Maps (XH-MAPS-8899 hoặc XH-MAPS-6868)
  if (cleanCode === MAP_MANAGER_MASTER_CODE || cleanCode === 'XH-MAPS-6868') {
    const effectiveEmail = (authUser?.email || 'quanlymaps@xuanhoacogi.vn').trim().toLowerCase();
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('xuanhoa_map_manager_active_v1', 'true');
      }
      const baseUser: UserAuthProfile =
        authUser && authUser.isLoggedIn
          ? authUser
          : {
              isLoggedIn: true,
              uid: `map_mgr_${Date.now()}`,
              email: effectiveEmail,
              displayName: 'Quản lý Maps Xuân Hòa',
              nickname: 'Quản lý Maps',
              gender: 'male',
              avatar: '🗺️',
              avatarId: 'm_ty',
              hasCompletedProfile: true,
              isFirstTimeSetupDone: true,
              createdAt: Date.now(),
            };
      saveAuthUser({
        ...baseUser,
        isLoggedIn: true,
        isMapManager: true,
        merchantVerifiedCode: MAP_MANAGER_MASTER_CODE,
        avatar: baseUser.avatar === '🐭' ? '🗺️' : baseUser.avatar,
      });
    } catch {}

    state.auditLogs = addAdminAuditLog(
      state,
      '🗺️ Kích hoạt tài khoản Quản lý Maps & Định vị',
      `Tài khoản: ${effectiveEmail} (Mã: ${cleanCode})`,
      'system'
    );
    saveAdminState(state);

    return {
      ok: true,
      isMapManager: true,
      placeItem: allManaged[0],
      message:
        '🗺️ Đã kích hoạt quyền Quản lý Maps! Bạn có thể cập nhật định vị các quán và thêm địa điểm mới theo danh mục.',
    };
  }

  let matchedItem: AdminPlaceItem | undefined;
  for (const item of allManaged) {
    const activeCode = getOrGenerateMerchantCode(item.place.id, false).toUpperCase();
    if (activeCode === cleanCode) {
      matchedItem = item;
      break;
    }
  }

  if (!matchedItem) {
    return {
      ok: false,
      message: 'Mã định danh không chính xác. Vui lòng kiểm tra lại!',
    };
  }

  const placeId = matchedItem.place.id;
  const ov = state.places[placeId];

  // Nếu người dùng đã đăng nhập Gmail thì lấy Gmail đó; nếu chưa đăng nhập thì tự động tạo/khôi phục phiên Nick Quán Chính Chủ theo Mã Code
  const effectiveEmail = (
    authUser?.email ||
    ov?.claimedByEmail ||
    `${placeId.replace(/[^a-z0-9]/gi, '').toLowerCase()}@chuquan.xuanhoa`
  )
    .trim()
    .toLowerCase();

  // Kiểm tra nếu mã đã được gắn với 1 Gmail thật khác (và người dùng hiện tại đang đăng nhập bằng 1 Gmail khác, không phải Admin)
  if (
    authUser?.email &&
    ov?.claimedByEmail &&
    !ov.claimedByEmail.endsWith('@chuquan.xuanhoa') &&
    ov.claimedByEmail.trim().toLowerCase() !== effectiveEmail &&
    !isAdminAuthenticated(authUser) &&
    !isMapManagerAuthenticated(authUser)
  ) {
    return {
      ok: false,
      message: `Mã quán "${matchedItem.place.name}" đã được liên kết với Gmail (${ov.claimedByEmail}). Nếu bạn là chủ quán mới, hãy báo Admin cấp lại mã.`,
    };
  }

  // Khóa mã code này vào tài khoản của chủ quán
  state.places[placeId] = {
    ...(ov || { id: placeId }),
    id: placeId,
    merchantClaimCode: cleanCode,
    claimedByEmail: effectiveEmail,
    claimedByUid: authUser?.uid || ov?.claimedByUid || `merchant_${placeId}`,
    claimedByName: authUser?.displayName || matchedItem.place.name,
    claimedAt: ov?.claimedAt || Date.now(),
    updatedAt: Date.now(),
  };

  state.auditLogs = addAdminAuditLog(
    state,
    'Chủ quán kích hoạt Mã Code & Nhận quyền quản lý quán vĩnh viễn',
    `${matchedItem.place.name} (Mã: ${cleanCode}) — Tài khoản: ${effectiveEmail}`,
    'place'
  );
  saveAdminState(state);

  const refreshed = getAllManagedPlaces().find((p) => p.place.id === placeId) || matchedItem;

  // Tự động biến tài khoản đang dùng thành "Nick Quán Chính Chủ" vĩnh viễn (biểu tượng 🏪 + Tên Quán + Mã Code đi theo mãi)
  try {
    const baseUser: UserAuthProfile = authUser && authUser.isLoggedIn
      ? authUser
      : {
          isLoggedIn: true,
          uid: `merchant_${placeId}`,
          email: effectiveEmail,
          displayName: refreshed.place.name,
          nickname: refreshed.place.name,
          gender: 'male',
          avatar: '🏪',
          avatarId: 'm_ty',
          hasCompletedProfile: true,
          isFirstTimeSetupDone: true,
          createdAt: Date.now(),
        };

    const updatedUser: UserAuthProfile = {
      ...baseUser,
      isLoggedIn: true,
      email: effectiveEmail,
      isMerchantAccount: true,
      merchantPlaceId: refreshed.place.id,
      merchantPlaceName: refreshed.place.name,
      merchantVerifiedCode: cleanCode,
      displayName: refreshed.place.name,
      nickname: refreshed.place.name,
      avatar: '🏪',
    };
    saveAuthUser(updatedUser);
  } catch (err) {
    console.warn('Merchant profile upgrade warning:', err);
  }

  return {
    ok: true,
    placeItem: refreshed,
    message: `🎉 Xác thực thành công! Đã kết nối vĩnh viễn quán "${refreshed.place.name}" 🏪`,
  };
}

/**
 * Lấy danh sách các quán mà Gmail hiện tại đã được cấp quyền quản lý
 */
export function getClaimedPlacesForUser(email?: string | null): AdminPlaceItem[] {
  if (!email) return [];
  const cleanEmail = email.trim().toLowerCase();
  const state = getAdminState();
  const allManaged = getAllManagedPlaces();
  return allManaged.filter((item) => {
    const ov = state.places[item.place.id];
    return ov?.claimedByEmail?.trim().toLowerCase() === cleanEmail;
  });
}

/**
 * Lấy quán chính chủ đại diện cho tài khoản hiện tại (dùng để hiển thị biểu tượng Nick Quán 🏪 trên toàn hệ thống)
 */
export function getPrimaryClaimedPlaceForUser(
  authUser?: UserAuthProfile | null
): AdminPlaceItem | null {
  if (!authUser || !authUser.isLoggedIn || !authUser.email) return null;
  const claimed = getClaimedPlacesForUser(authUser.email);
  if (claimed.length === 0) return null;
  if (authUser.merchantPlaceId) {
    const matched = claimed.find((c) => c.place.id === authUser.merchantPlaceId);
    if (matched) return matched;
  }
  return claimed[0];
}

/**
 * Chủ quán cập nhật tức thì Trạng thái Mở bán Hôm nay (Live Status)
 */
export function updateMerchantLiveStatus(
  placeId: string,
  authUser: UserAuthProfile | null | undefined,
  liveStatus: 'open_normal' | 'busy_hot' | 'closed_today',
  liveStatusNote?: string
): void {
  const effectiveUser = authUser?.email ? authUser : getStoredAuthUser();
  const state = getAdminState();
  const ov = state.places[placeId];
  const userEmail = (
    effectiveUser?.email ||
    ov?.claimedByEmail ||
    'merchant@xuanhoacogi.vn'
  )
    .trim()
    .toLowerCase();

  if (
    ov?.claimedByEmail &&
    ov.claimedByEmail.trim().toLowerCase() !== userEmail &&
    !isAdminAuthenticated(effectiveUser) &&
    !isMapManagerAuthenticated(effectiveUser)
  ) {
    throw new Error('Tài khoản Gmail này chưa được cấp quyền quản lý quán này.');
  }

  state.places[placeId] = {
    ...(ov || { id: placeId }),
    id: placeId,
    liveStatus,
    liveStatusNote: (liveStatusNote || '').trim().slice(0, 80),
    updatedAt: Date.now(),
  };

  const statusLabel =
    liveStatus === 'closed_today'
      ? 'Hôm nay tạm nghỉ'
      : liveStatus === 'busy_hot'
      ? 'Đang đông / Món mới nóng hổi'
      : 'Đang mở bán bình thường';

  state.auditLogs = addAdminAuditLog(
    state,
    `Chủ quán cập nhật trạng thái hôm nay (${statusLabel})`,
    `${ov?.name || placeId} — bởi ${userEmail}`,
    'place'
  );
  saveAdminState(state);
}

/**
 * Chủ quán hoặc Quản lý Maps gửi bản cập nhật (Định vị tọa độ, Tên quán, Giờ bán, SĐT, Menu...)
 * Chủ quán và Quản lý Maps hoàn toàn KHÔNG có quyền xóa quán.
 */
export function submitMerchantPlaceUpdate(
  placeId: string,
  authUser: UserAuthProfile | null | undefined,
  proposed: MerchantPendingSubmission['proposed']
): MerchantPendingSubmission {
  const effectiveUser = authUser?.email ? authUser : getStoredAuthUser();
  const state = getAdminState();
  const allManaged = getAllManagedPlaces();
  const currentItem = allManaged.find((p) => p.place.id === placeId);
  if (!currentItem) {
    throw new Error('Không tìm thấy thông tin quán trong hệ thống.');
  }

  const ov = state.places[placeId];
  const userEmail = (
    effectiveUser?.email ||
    ov?.claimedByEmail ||
    'merchant@xuanhoacogi.vn'
  )
    .trim()
    .toLowerCase();
  if (
    ov?.claimedByEmail &&
    ov.claimedByEmail.trim().toLowerCase() !== userEmail &&
    !isAdminAuthenticated(effectiveUser) &&
    !isMapManagerAuthenticated(effectiveUser)
  ) {
    throw new Error('Gmail của bạn chưa kích hoạt Mã Code của quán này.');
  }

  if (proposed.lat !== null && proposed.lng !== null) {
    const lat = Number(proposed.lat);
    const lng = Number(proposed.lng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 20.0 ||
      lat > 23.0 ||
      lng < 104.0 ||
      lng > 107.0
    ) {
      throw new Error('Tọa độ cắm ghim không hợp lệ (ngoài phạm vi Xuân Hòa - Phú Thọ).');
    }
  }

  const submissionId = `sub_${placeId}`;
  const submission: MerchantPendingSubmission = {
    id: submissionId,
    placeId,
    placeOriginalName: currentItem.place.name,
    merchantEmail: userEmail,
    merchantName: effectiveUser?.displayName || effectiveUser?.nickname || userEmail,
    claimCodeUsed: getOrGenerateMerchantCode(placeId, false),
    submittedAt: Date.now(),
    status: 'pending',
    proposed: {
      name: proposed.name.trim() || currentItem.place.name,
      phone: proposed.phone.trim(),
      openHours: proposed.openHours.trim() || currentItem.place.openHours || '07:00 - 22:00',
      address: proposed.address.trim() || currentItem.place.address,
      tagline: proposed.tagline?.trim() ?? currentItem.place.tagline,
      minPrice: proposed.minPrice ?? currentItem.place.minPrice,
      maxPrice: proposed.maxPrice ?? currentItem.place.maxPrice,
      serviceMode: proposed.serviceMode ?? currentItem.place.serviceMode,
      deliveryNote: proposed.deliveryNote?.trim() ?? currentItem.place.deliveryNote,
      signatureDishName:
        proposed.signatureDishName?.trim() ?? currentItem.place.signatureDish?.name,
      signatureDishPrice:
        proposed.signatureDishPrice ?? currentItem.place.signatureDish?.price,
      customMenu: proposed.customMenu ?? currentItem.fullMenu,
      lat: proposed.lat !== null ? Number(Number(proposed.lat).toFixed(6)) : null,
      lng: proposed.lng !== null ? Number(Number(proposed.lng).toFixed(6)) : null,
      gpsDistanceMeters: proposed.gpsDistanceMeters ?? null,
    },
    previous: {
      name: currentItem.place.name,
      phone: currentItem.place.phone || '',
      openHours: currentItem.place.openHours || '',
      address: currentItem.place.address || '',
      lat: typeof ov?.lat === 'number' ? ov.lat : null,
      lng: typeof ov?.lng === 'number' ? ov.lng : null,
      menuCount: currentItem.fullMenu.length,
    },
  };

  if (!state.merchantSubmissions) {
    state.merchantSubmissions = {};
  }
  state.merchantSubmissions[submissionId] = submission;

  // Áp dụng ngay tọa độ & thông tin đã lưu lên Bản đồ số để hiển thị tức thì (Admin vẫn kiểm soát tại mục Duyệt Quán)
  const p = submission.proposed;
  const nextOv: PlaceOverride = {
    ...(ov || { id: placeId }),
    id: placeId,
    name: p.name,
    phone: p.phone,
    openHours: p.openHours,
    address: p.address,
    tagline: p.tagline,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    serviceMode: p.serviceMode,
    deliveryNote: p.deliveryNote,
    signatureDishName: p.signatureDishName,
    signatureDishPrice: p.signatureDishPrice,
    customMenu: p.customMenu,
    updatedAt: Date.now(),
  };

  const roleCheck = getEffectiveAdminRoleInfo(undefined, effectiveUser);
  if (roleCheck.isSuperAdmin) {
    if (p.lat !== null && p.lng !== null) {
      nextOv.lat = p.lat;
      nextOv.lng = p.lng;
      nextOv.coordinateVerified = true;
      nextOv.adminPinApproved = true;
      nextOv.coordinateSource = 'admin_verified';
      nextOv.lastVerifiedAt = new Date().toISOString().slice(0, 10);
    }
    nextOv.pendingMapApproval = null;
    nextOv.pendingWebApproval = null;
  } else {
    if (p.lat !== null && p.lng !== null) {
      nextOv.lat = p.lat;
      nextOv.lng = p.lng;
      nextOv.coordinateVerified = false;
      nextOv.adminPinApproved = false;
      nextOv.coordinateSource = 'merchant_verified';
      nextOv.pendingMapApproval = {
        submittedBy: userEmail,
        submittedByName: submission.merchantName,
        submittedAt: Date.now(),
        actionSummary: `Chờ Admin duyệt tọa độ (${p.lat}, ${p.lng})`,
        previousLat: submission.previous.lat,
        previousLng: submission.previous.lng,
      };
    }
    nextOv.pendingWebApproval = {
      submittedBy: userEmail,
      submittedByName: submission.merchantName,
      submittedAt: Date.now(),
      actionSummary: 'Cập nhật thông tin & thực đơn quán',
    };
  }

  state.places[placeId] = nextOv;

  state.auditLogs = addAdminAuditLog(
    state,
    '🏪 Lưu cập nhật Vị trí & Thông tin quán lên Bản đồ số',
    `${submission.proposed.name} (${userEmail}) — Tọa độ: ${
      submission.proposed.lat !== null
        ? `${submission.proposed.lat}, ${submission.proposed.lng}`
        : 'Giữ nguyên'
    }`,
    'place'
  );

  saveAdminState(state);
  return submission;
}

/**
 * 🗺️ QUẢN LÝ MAPS / ADMIN TẠO ĐỊA ĐIỂM MỚI TRỰC TIẾP TRÊN BẢN ĐỒ SỐ THEO DANH MỤC (TAG)
 * Hỗ trợ đầy đủ 13 danh mục: Quán ăn, Cà phê, Ăn vặt, Nhậu, Bi-a, Game, Giải trí, Điện thoại,
 * Tạp hóa, Siêu thị, Dịch vụ, Trường học, Công cộng / Đơn vị hành chính (UBND, Công an, Y tế...)
 */
export function createNewPlaceFromMap(
  authUser: UserAuthProfile | null | undefined,
  payload: {
    name: string;
    mapCategory: string;
    address: string;
    phone?: string;
    openHours?: string;
    tagline?: string;
    lat: number;
    lng: number;
    mapsUrl?: string;
    signatureDishName?: string;
    signatureDishPrice?: number;
  }
): AdminPlaceItem {
  const effectiveUser = authUser?.email ? authUser : getStoredAuthUser();
  if (!isAdminAuthenticated(effectiveUser) && !isMapManagerAuthenticated(effectiveUser)) {
    throw new Error('Chỉ Quản trị viên hoặc Quản lý Maps mới có quyền tạo địa điểm mới trên bản đồ.');
  }

  const cleanName = payload.name.trim();
  if (!cleanName) {
    throw new Error('Vui lòng nhập tên quán hoặc tên địa điểm / đơn vị hành chính.');
  }

  const lat = Number(Number(payload.lat).toFixed(6));
  const lng = Number(Number(payload.lng).toFixed(6));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 20.0 ||
    lat > 23.0 ||
    lng < 104.0 ||
    lng > 107.0
  ) {
    throw new Error('Tọa độ định vị chưa hợp lệ. Hãy dán Link Google Maps hoặc chấm trực tiếp trên bản đồ.');
  }

  const mapCat = payload.mapCategory || 'food';
  const isCivicOrSchool = mapCat === 'public' || mapCat === 'school' || mapCat === 'medical';
  const sectorMap: Record<string, { category: Place['category']; sectorTag: string }> = {
    food: { category: 'restaurant', sectorTag: 'an-chinh' },
    pub: { category: 'pub', sectorTag: 'nhau-lau' },
    cafe: { category: 'cafe', sectorTag: 'uong' },
    snack: { category: 'fast_food', sectorTag: 'an-vat' },
    billiards: { category: 'pub', sectorTag: 'bia-game' },
    game: { category: 'pub', sectorTag: 'bia-game' },
    entertainment: { category: 'pub', sectorTag: 'an-choi' },
    phone: { category: 'cafe', sectorTag: 'dien-thoai' },
    grocery: { category: 'fast_food', sectorTag: 'dich-vu' },
    supermarket: { category: 'fast_food', sectorTag: 'dich-vu' },
    service: { category: 'cafe', sectorTag: 'dich-vu' },
    school: { category: 'cafe', sectorTag: 'dia-danh' },
    public: { category: 'cafe', sectorTag: 'dia-danh' },
    medical: { category: 'cafe', sectorTag: 'dia-danh' },
  };
  const mapped = sectorMap[mapCat] || sectorMap.food;

  const newPlaceId = `xh_map_${Date.now()}`;
  const sigName =
    payload.signatureDishName?.trim() ||
    (mapCat === 'public' || mapCat === 'medical'
      ? 'Cơ quan hành chính / Điểm công cộng'
      : mapCat === 'school'
      ? 'Cơ sở Giáo dục & Đào tạo'
      : `Đặc trưng tại ${cleanName}`);
  const sigPrice = isCivicOrSchool ? 0 : Number(payload.signatureDishPrice) || 35;

  const newPlace: Place = {
    id: newPlaceId,
    name: cleanName,
    tagline:
      payload.tagline?.trim() ||
      (mapCat === 'public' || mapCat === 'medical'
        ? 'Đơn vị hành chính & Điểm dịch vụ công Phường Xuân Hòa'
        : mapCat === 'school'
        ? 'Trường học & Giảng đường tại Phường Xuân Hòa'
        : `Địa điểm tiêu biểu tại Phường Xuân Hòa`),
    category: mapped.category,
    address: payload.address.trim() || 'Phường Xuân Hòa, Tỉnh Phú Thọ',
    zone: 'center',
    distance: 'Trung tâm Xuân Hòa',
    openHours: payload.openHours?.trim() || (isCivicOrSchool ? '07:30 - 17:30' : '07:00 - 22:00'),
    phone: payload.phone?.trim() || '',
    priceRange: isCivicOrSchool ? 'Địa danh công cộng' : `${sigPrice}k - ${sigPrice + 35}k`,
    minPrice: isCivicOrSchool ? 0 : sigPrice,
    maxPrice: isCivicOrSchool ? 0 : sigPrice + 35,
    rating: 5.0,
    reviewCount: 10,
    imageUrl: '',
    tags: [mapCat, 'Xuân Hòa'],
    signatureDish: {
      id: `${newPlaceId}_sig`,
      name: sigName,
      price: sigPrice,
      tag: isCivicOrSchool ? 'Địa danh' : 'Món tủ',
    },
    menu: isCivicOrSchool
      ? []
      : [
          {
            id: `${newPlaceId}_m1`,
            name: sigName,
            price: sigPrice,
            tag: 'Bán chạy',
          },
        ],
    serviceMode: 'both',
    mapsQuery: `${cleanName} Xuân Hòa Phú Thọ`,
    mapsUrl:
      payload.mapsUrl?.trim() ||
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    rarity: 2,
    quip: `Địa điểm đã xác minh tọa độ trên Bản đồ số Xuân Hòa!`,
  };

  const state = getAdminState();
  const creatorRole = getEffectiveAdminRoleInfo(undefined, effectiveUser);
  const creatorIdentifier =
    creatorRole.identifier ||
    (effectiveUser?.email || 'quanlymaps@xuanhoacogi.vn').trim().toLowerCase();
  const claimCode = getOrGenerateMerchantCode(newPlaceId, false, cleanName);

  state.places[newPlaceId] = {
    id: newPlaceId,
    status: 'active',
    name: newPlace.name,
    tagline: newPlace.tagline,
    address: newPlace.address,
    zone: newPlace.zone,
    distance: newPlace.distance,
    phone: newPlace.phone,
    openHours: newPlace.openHours,
    minPrice: newPlace.minPrice,
    maxPrice: newPlace.maxPrice,
    category: newPlace.category,
    sectorTag: mapped.sectorTag,
    mapCategory: mapCat,
    tags: newPlace.tags,
    serviceMode: newPlace.serviceMode,
    mapsQuery: newPlace.mapsQuery,
    mapsUrl: newPlace.mapsUrl,
    quip: newPlace.quip,
    verified: true,
    signatureDishName: sigName,
    signatureDishPrice: sigPrice,
    customMenu: newPlace.menu,
    lat,
    lng,
    coordinateVerified: creatorRole.isSuperAdmin,
    adminPinApproved: creatorRole.isSuperAdmin,
    locationStatus: creatorRole.isSuperAdmin ? 'located' : 'unlocated',
    coordinateSource: 'admin_verified',
    lastVerifiedAt: new Date().toISOString().slice(0, 10),
    merchantClaimCode: claimCode,
    ...(!creatorRole.isSuperAdmin
      ? {
          pendingMapApproval: {
            submittedBy: creatorIdentifier,
            submittedByName: creatorRole.displayName || effectiveUser?.displayName || 'Quản lý Maps',
            submittedAt: Date.now(),
            actionSummary: `Yêu cầu thêm định vị mới (${mapCat})`,
            actionType: 'create',
            previousLat: null,
            previousLng: null,
            isNewPlace: true,
          },
        }
      : {
          pendingMapApproval: null,
          pendingWebApproval: null,
        }),
    updatedAt: Date.now(),
    isCustom: true,
    customPlaceData: newPlace,
  };

  state.auditLogs = addAdminAuditLog(
    state,
    creatorRole.isSuperAdmin
      ? `🗺️ Admin ghim địa điểm mới trên Bản đồ (${mapCat})`
      : `⏳ Quản lý Maps thêm địa điểm mới chờ duyệt (${mapCat})`,
    `${cleanName} — Tọa độ: ${lat}, ${lng}`,
    'place'
  );

  saveAdminState(state);

  const created = getAllManagedPlaces().find((p) => p.place.id === newPlaceId);
  if (!created) {
    throw new Error('Không thể khởi tạo địa điểm mới.');
  }
  return created;
}

/**
 * Lấy danh sách tất cả yêu cầu cập nhật từ Chủ quán (Ưu tiên trạng thái 'pending' lên đầu)
 */
export function getAllMerchantSubmissions(): MerchantPendingSubmission[] {
  const state = getAdminState();
  const map = state.merchantSubmissions || {};
  return Object.values(map).sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return b.submittedAt - a.submittedAt;
  });
}

/**
 * Admin nhấn OK / Duyệt phương án thay đổi của Chủ quán
 */
export function approveMerchantSubmission(submissionId: string, reviewNote?: string): void {
  const state = getAdminState();
  const sub = state.merchantSubmissions?.[submissionId];
  if (!sub) {
    throw new Error('Không tìm thấy yêu cầu cần duyệt.');
  }

  const placeId = sub.placeId;
  const prev = state.places[placeId] || { id: placeId, updatedAt: Date.now() };
  const p = sub.proposed;
  const hasValidCoord =
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng);

  state.places[placeId] = {
    ...prev,
    id: placeId,
    name: p.name,
    phone: p.phone,
    openHours: p.openHours,
    address: p.address,
    ...(p.tagline !== undefined ? { tagline: p.tagline } : {}),
    ...(p.minPrice !== undefined ? { minPrice: p.minPrice } : {}),
    ...(p.maxPrice !== undefined ? { maxPrice: p.maxPrice } : {}),
    ...(p.serviceMode !== undefined ? { serviceMode: p.serviceMode } : {}),
    ...(p.deliveryNote !== undefined ? { deliveryNote: p.deliveryNote } : {}),
    ...(p.signatureDishName !== undefined ? { signatureDishName: p.signatureDishName } : {}),
    ...(p.signatureDishPrice !== undefined ? { signatureDishPrice: p.signatureDishPrice } : {}),
    ...(p.customMenu !== undefined ? { customMenu: p.customMenu } : {}),
    ...(hasValidCoord
      ? {
          lat: Number(p.lat!.toFixed(6)),
          lng: Number(p.lng!.toFixed(6)),
          coordinateVerified: true,
          adminPinApproved: true,
          coordinateSource: 'merchant_verified',
          lastVerifiedAt: new Date().toISOString(),
        }
      : {}),
    pendingMapApproval: null,
    pendingWebApproval: null,
    updatedAt: Date.now(),
  };

  sub.status = 'approved';
  sub.reviewedAt = Date.now();
  sub.reviewNote = reviewNote || 'Đã được Admin phê duyệt và cập nhật lên Bản đồ số.';
  state.merchantSubmissions![submissionId] = sub;

  state.auditLogs = addAdminAuditLog(
    state,
    '✅ Admin ĐÃ DUYỆT cập nhật định vị & thông tin từ Chủ quán',
    `${p.name} (Chủ quán: ${sub.merchantEmail})`,
    'place'
  );

  saveAdminState(state);
}

/**
 * Admin từ chối phương án thay đổi của Chủ quán
 */
export function rejectMerchantSubmission(submissionId: string, reviewNote?: string): void {
  const state = getAdminState();
  const sub = state.merchantSubmissions?.[submissionId];
  if (!sub) return;

  sub.status = 'rejected';
  sub.reviewedAt = Date.now();
  sub.reviewNote = reviewNote || 'Thông tin hoặc vị trí ghim chưa chính xác, vui lòng kiểm tra lại.';
  state.merchantSubmissions![submissionId] = sub;

  state.auditLogs = addAdminAuditLog(
    state,
    '❌ Admin từ chối yêu cầu cập nhật của Chủ quán',
    `${sub.placeOriginalName} (${sub.merchantEmail}) — Lý do: ${sub.reviewNote}`,
    'place'
  );

  saveAdminState(state);
}

/**
 * ĐẤNG TỐI CAO (SUPER ADMIN): Gán trực tiếp quyền Chủ Quán cho 1 địa chỉ Gmail bất kỳ (1 chạm, không cần nhập mã)
 * Hoặc truyền email rỗng '' để thu hồi quyền Chủ Quán.
 */
export function assignMerchantOwnerByEmail(
  placeId: string,
  ownerEmail: string,
  ownerName?: string
): void {
  const state = getAdminState();
  const prev = state.places[placeId] || { id: placeId, updatedAt: Date.now() };
  const cleanEmail = ownerEmail.trim().toLowerCase();
  const activeCode = getOrGenerateMerchantCode(placeId, false);

  if (!cleanEmail) {
    state.places[placeId] = {
      ...prev,
      id: placeId,
      claimedByEmail: '',
      claimedByUid: '',
      claimedByName: '',
      updatedAt: Date.now(),
    };
    state.auditLogs = addAdminAuditLog(
      state,
      '🔓 Admin thu hồi quyền Chủ Quán',
      `Quán ID: ${placeId}`,
      'place'
    );
  } else {
    state.places[placeId] = {
      ...prev,
      id: placeId,
      merchantClaimCode: activeCode,
      claimedByEmail: cleanEmail,
      claimedByName: (ownerName || cleanEmail).trim(),
      claimedAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.auditLogs = addAdminAuditLog(
      state,
      '👑 Admin gán thẳng quyền Chủ Quán cho Gmail',
      `Quán ID: ${placeId} → Gmail: ${cleanEmail}`,
      'place'
    );
  }

  saveAdminState(state);

  // Nếu Gmail được gán trùng với tài khoản đang đăng nhập trên trình duyệt hiện tại, đồng bộ ngay biểu tượng Nick Quán 🏪
  try {
    const currentStored = getStoredAuthUser();
    if (currentStored?.email && currentStored.email.trim().toLowerCase() === cleanEmail) {
      const targetPlace = getAllManagedPlaces().find((p) => p.place.id === placeId);
      if (targetPlace) {
        saveAuthUser({
          ...currentStored,
          isMerchantAccount: true,
          merchantPlaceId: targetPlace.place.id,
          merchantPlaceName: targetPlace.place.name,
          merchantVerifiedCode: activeCode,
          nickname: targetPlace.place.name,
          avatar: '🏪',
        });
      }
    }
  } catch {}
}

/**
 * ĐẤNG TỐI CAO (SUPER ADMIN): Duyệt tất cả yêu cầu chờ duyệt chỉ với 1 chạm
 */
export function approveAllPendingMerchantSubmissions(): number {
  const state = getAdminState();
  const map = state.merchantSubmissions || {};
  let count = 0;

  for (const sub of Object.values(map)) {
    if (sub.status !== 'pending') continue;
    const placeId = sub.placeId;
    const prev = state.places[placeId] || { id: placeId, updatedAt: Date.now() };
    const p = sub.proposed;
    const hasValidCoord =
      typeof p.lat === 'number' &&
      typeof p.lng === 'number' &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng);

    state.places[placeId] = {
      ...prev,
      id: placeId,
      name: p.name,
      phone: p.phone,
      openHours: p.openHours,
      address: p.address,
      ...(p.tagline !== undefined ? { tagline: p.tagline } : {}),
      ...(p.minPrice !== undefined ? { minPrice: p.minPrice } : {}),
      ...(p.maxPrice !== undefined ? { maxPrice: p.maxPrice } : {}),
      ...(p.serviceMode !== undefined ? { serviceMode: p.serviceMode } : {}),
      ...(p.deliveryNote !== undefined ? { deliveryNote: p.deliveryNote } : {}),
      ...(p.signatureDishName !== undefined ? { signatureDishName: p.signatureDishName } : {}),
      ...(p.signatureDishPrice !== undefined ? { signatureDishPrice: p.signatureDishPrice } : {}),
      ...(p.customMenu !== undefined ? { customMenu: p.customMenu } : {}),
      ...(hasValidCoord
        ? {
            lat: Number(p.lat!.toFixed(6)),
            lng: Number(p.lng!.toFixed(6)),
            coordinateVerified: true,
            adminPinApproved: true,
            coordinateSource: 'merchant_verified',
            lastVerifiedAt: new Date().toISOString(),
          }
        : {}),
      pendingMapApproval: null,
      pendingWebApproval: null,
      updatedAt: Date.now(),
    };

    sub.status = 'approved';
    sub.reviewedAt = Date.now();
    sub.reviewNote = 'Đã được Admin duyệt nhanh (Duyệt tất cả 1 chạm).';
    map[sub.id] = sub;
    count++;
  }

  if (count > 0) {
    state.auditLogs = addAdminAuditLog(
      state,
      `⚡ Admin duyệt hàng loạt ${count} yêu cầu từ Chủ quán`,
      `Tổng số: ${count} quán`,
      'place'
    );
    saveAdminState(state);
  }
  return count;
}

/**
 * Giả lập cập nhật định vị dành cho kiểm thử nội bộ
 */
export function simulateMerchantDemoSubmission(
  targetPlaceId?: string,
  currentUser?: UserAuthProfile | null
): MerchantPendingSubmission | null {
  const allManaged = getAllManagedPlaces();
  const item =
    (targetPlaceId ? allManaged.find((p) => p.place.id === targetPlaceId) : null) ||
    allManaged[0];
  if (!item) return null;

  const placeId = item.place.id;
  const code = getOrGenerateMerchantCode(placeId, false, item.place.name);
  const demoEmail = (currentUser?.email || 'chuquan.xuanhoa@gmail.com').trim().toLowerCase();

  assignMerchantOwnerByEmail(placeId, demoEmail, item.place.name);

  if (currentUser) {
    saveAuthUser({
      ...currentUser,
      isLoggedIn: true,
      email: demoEmail,
      isMerchantAccount: true,
      merchantPlaceId: placeId,
      merchantPlaceName: item.place.name,
      merchantVerifiedCode: code,
      nickname: item.place.name,
      avatar: '🏪',
    });
  } else {
    const stored = getStoredAuthUser();
    if (stored) {
      saveAuthUser({
        ...stored,
        isLoggedIn: true,
        email: stored.email || demoEmail,
        isMerchantAccount: true,
        merchantPlaceId: placeId,
        merchantPlaceName: item.place.name,
        merchantVerifiedCode: code,
        nickname: item.place.name,
        avatar: '🏪',
      });
    }
  }

  const state = getAdminState();
  const ov = state.places[placeId];
  const hashNum = placeId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const demoLat = Number((21.2808 + (hashNum % 25) * 0.00018).toFixed(6));
  const demoLng = Number((105.7248 + (hashNum % 25) * 0.00022).toFixed(6));

  const updatedMenu: CustomMenuEntry[] = item.fullMenu.map((m, idx) =>
    idx === 0 ? { ...m, price: m.price + 5 } : { ...m }
  );

  const submissionId = `sub_${placeId}`;
  const submission: MerchantPendingSubmission = {
    id: submissionId,
    placeId,
    placeOriginalName: item.place.name,
    merchantEmail: demoEmail,
    merchantName: `🏪 ${item.place.name}`,
    claimCodeUsed: code,
    submittedAt: Date.now(),
    status: 'pending',
    proposed: {
      name: item.place.name,
      phone: item.place.phone || '0988 686 868',
      openHours: '07:00 - 22:30 (Mở cả tuần)',
      address: item.place.address,
      tagline: item.place.tagline,
      minPrice: item.place.minPrice,
      maxPrice: item.place.maxPrice,
      serviceMode: 'both',
      deliveryNote: item.place.deliveryNote,
      signatureDishName: item.place.signatureDish?.name,
      signatureDishPrice: item.place.signatureDish?.price,
      customMenu: updatedMenu,
      lat: demoLat,
      lng: demoLng,
      gpsDistanceMeters: 0,
    },
    previous: {
      name: item.place.name,
      phone: item.place.phone || '',
      openHours: item.place.openHours || '',
      address: item.place.address,
      lat: typeof ov?.lat === 'number' ? ov.lat : null,
      lng: typeof ov?.lng === 'number' ? ov.lng : null,
      menuCount: item.fullMenu.length,
    },
  };

  if (!state.merchantSubmissions) state.merchantSubmissions = {};
  state.merchantSubmissions[submissionId] = submission;
  saveAdminState(state);
  return submission;
}

/**
 * Lấy chế độ mở cửa của Bản đồ số (Mặc định: 'merchants_and_admin_only' — Chỉ mở cho Chủ Quán đã có Mã Code & Admin)
 */
export function getMapAccessMode(): 'merchants_and_admin_only' | 'public_open' {
  const state = getAdminState();
  return state.mapAccessMode || 'merchants_and_admin_only';
}

/**
 * Admin bật/tắt công tắc Mở cửa Bản đồ số cho toàn bộ khách hoặc Chỉ Chủ Quán & Admin
 */
export function setMapAccessMode(mode: 'merchants_and_admin_only' | 'public_open'): void {
  const state = getAdminState();
  state.mapAccessMode = mode;
  state.auditLogs = addAdminAuditLog(
    state,
    mode === 'public_open'
      ? '🌍 Admin MỞ CỬA Bản Đồ Số công khai cho toàn bộ Khách'
      : '🔒 Admin bật chế độ Bản Đồ Số: Chỉ Chủ Quán (có Mã Code) & Admin',
    mode === 'public_open' ? 'Công khai toàn bộ' : 'Chỉ Chủ Quán & Admin',
    'system'
  );
  saveAdminState(state);
}

/**
 * Kiểm tra quyền vào Bản đồ số của tài khoản hiện tại:
 * - Admin: Auto vào thẳng 100%
 * - Quản lý Maps (đã kích hoạt mã XH-MAPS-8899): Auto vào thẳng 100% + Quyền tạo mới & chỉnh định vị
 * - Chủ Quán đã kích hoạt Mã Code (đi theo Gmail mãi mãi): Auto vào thẳng Bản đồ + Quản lý quán
 * - Khách thường: Nếu đang ở chế độ 'merchants_and_admin_only' -> Hiện màn hình "Đang phát triển • Nhập Mã Code Chủ Quán"
 */
export function getDigitalMapAccessStatus(authUser?: UserAuthProfile | null): {
  canAccess: boolean;
  accessReason: 'admin' | 'map_manager' | 'merchant' | 'public_open' | 'locked_for_guest';
  mode: 'merchants_and_admin_only' | 'public_open';
  claimedPlace: AdminPlaceItem | null;
  verifiedCount: number;
  totalCount: number;
} {
  const state = getAdminState();
  const mode = state.mapAccessMode || 'merchants_and_admin_only';
  const allManaged = getAllManagedPlaces();
  const totalCount = allManaged.length;
  const verifiedCount = allManaged.filter((item) => {
    const ov = state.places[item.place.id];
    return (
      Boolean(ov?.coordinateVerified) &&
      typeof ov?.lat === 'number' &&
      typeof ov?.lng === 'number'
    );
  }).length;

  let claimedPlace = getPrimaryClaimedPlaceForUser(authUser);
  if (!claimedPlace && authUser?.isLoggedIn && authUser?.isMerchantAccount && authUser?.merchantPlaceId) {
    claimedPlace = allManaged.find((p) => p.place.id === authUser.merchantPlaceId) || null;
  }

  if (isAdminAuthenticated(authUser)) {
    return {
      canAccess: true,
      accessReason: 'admin',
      mode,
      claimedPlace,
      verifiedCount,
      totalCount,
    };
  }

  if (isMapManagerAuthenticated(authUser)) {
    return {
      canAccess: true,
      accessReason: 'map_manager',
      mode,
      claimedPlace,
      verifiedCount,
      totalCount,
    };
  }

  if (claimedPlace) {
    return {
      canAccess: true,
      accessReason: 'merchant',
      mode,
      claimedPlace,
      verifiedCount,
      totalCount,
    };
  }

  const isDirectDemoUrl =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hash.includes('demo') ||
      window.location.hash.includes('map'));

  if (mode === 'public_open' || isDirectDemoUrl) {
    return {
      canAccess: true,
      accessReason: 'public_open',
      mode,
      claimedPlace: null,
      verifiedCount,
      totalCount,
    };
  }

  return {
    canAccess: false,
    accessReason: 'locked_for_guest',
    mode,
    claimedPlace: null,
    verifiedCount,
    totalCount,
  };
}


