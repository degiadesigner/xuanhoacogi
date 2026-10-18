import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { set } from 'firebase/database';
import { firebaseConfig, getRealtimeDb, ref, onValue } from './firebase';
import { Food } from './foods';
import { Place, xuanHoaPlaces, getPlaceStyleGroup } from './places-xuanhoa';
import { MainCategoryKey, getCategoryItems } from './xuanhoa-catalog';
import { UserAuthProfile } from './auth';
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
  coordinateSource?: 'openstreetmap' | 'admin_verified' | 'nominatim_geocoded' | 'unverified';
  lastVerifiedAt?: string;
  mapCategory?: string;
  updatedAt: number;
  isCustom?: boolean;
  customPlaceData?: Place;
}

export interface AdminAccount {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: 'superadmin' | 'manager';
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
  knownPlaceIds: string[];
  knownDishKeys: string[];
  auditLogs: AdminAuditLog[];
  adminEmails: string[];
  adminAccounts?: AdminAccount[];
  adminPin: string;
  sectorTags?: SectorCategoryTag[];
  fontScale?: 'normal' | 'large';
  requirePinOnOpen?: boolean;
  updatedAt: number;
}

const ADMIN_STORAGE_KEY = 'xuanhoa_admin_state_v1';
const ADMIN_AUTH_LOCAL_KEY = 'xuanhoa_admin_logged_account_v1';
const ADMIN_AUTH_SESSION_KEY = 'xuanhoa_admin_logged_session_v1';

const DEFAULT_ADMIN_EMAILS = [
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
    updatedAt: Date.now(),
  };
}

export function getAdminState(): AdminState {
  if (typeof window === 'undefined') return createInitialAdminState();
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) {
      const init = createInitialAdminState();
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(init));
      return init;
    }
    const parsed: AdminState = JSON.parse(raw);
    const places = parsed.places || {};

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

    const resultState: AdminState = {
      ...createInitialAdminState(),
      ...parsed,
      places,
      dishes: parsed.dishes || {},
      members: parsed.members || {},
      auditLogs: parsed.auditLogs || [],
    };

    if (migrated) {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(resultState));
    }

    return resultState;
  } catch {
    return createInitialAdminState();
  }
}

export function saveAdminState(next: AdminState, syncCloud = true): void {
  if (typeof window === 'undefined') return;
  try {
    next.updatedAt = Date.now();
    const serialized = JSON.stringify(next);
    localStorage.setItem(ADMIN_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: next }));

    if (syncCloud && firebaseConfig.apiKey) {
      const cleanPayload = JSON.parse(
        JSON.stringify({
          places: next.places || {},
          dishes: next.dishes || {},
          members: next.members || {},
          auditLogs: (next.auditLogs || []).slice(0, 80),
          adminEmails: next.adminEmails || DEFAULT_ADMIN_EMAILS,
          adminAccounts: next.adminAccounts || DEFAULT_ADMIN_ACCOUNTS,
          sectorTags: next.sectorTags || DEFAULT_SECTOR_TAGS,
          fontScale: next.fontScale || 'normal',
          updatedAt: next.updatedAt,
        })
      );
      // 1. Đồng bộ qua Firebase Realtime Database (chính thức)
      const rtdb = getRealtimeDb();
      if (rtdb) {
        set(ref(rtdb, 'xuanhoa_admin/global_state'), cleanPayload).catch(() => {});
      }
      // 2. Dự phòng Cloud Firestore
      try {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const db = getFirestore(app);
        setDoc(doc(db, 'xuanhoa_admin', 'global_state'), cleanPayload).catch(() => {});
      } catch {}
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

// Khởi tạo lắng nghe đồng bộ Realtime giữa các Tab trình duyệt (storage) & Đa thiết bị qua Firebase Realtime Database + Firestore
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

  const applyCloudData = (cloudData: Partial<AdminState> | null | undefined) => {
    if (!cloudData) return;
    const local = getAdminState();
    if (cloudData.updatedAt && cloudData.updatedAt > (local.updatedAt || 0)) {
      const merged: AdminState = {
        ...local,
        places: cloudData.places || {},
        dishes: cloudData.dishes || {},
        members: { ...local.members, ...(cloudData.members || {}) },
        auditLogs: cloudData.auditLogs || local.auditLogs,
        adminEmails: cloudData.adminEmails || local.adminEmails,
        adminAccounts: cloudData.adminAccounts || local.adminAccounts,
        sectorTags: cloudData.sectorTags || local.sectorTags,
        fontScale: cloudData.fontScale || local.fontScale,
        updatedAt: cloudData.updatedAt,
      };
      saveAdminState(merged, false);
    }
  };

  // 2. Đồng bộ Realtime đa thiết bị qua Firebase Realtime Database
  try {
    const rtdb = getRealtimeDb();
    if (rtdb) {
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
    }
  } catch {}

  // 3. Dự phòng qua Cloud Firestore
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const fsRef = doc(db, 'xuanhoa_admin', 'global_state');

    onSnapshot(
      fsRef,
      snap => {
        if (!snap.exists()) return;
        applyCloudData(snap.data() as Partial<AdminState>);
      },
      () => {}
    );
  } catch {}
}

// ============================================================================
// 1. ĐỒNG BỘ THÀNH VIÊN (USERS CRM) & KIỂM TRA CHẶN / BAN / MUTE
// ============================================================================
export function syncUserToAdminRegistry(user: UserAuthProfile, spinsCount = 0, level = 1): ManagedMember {
  const state = getAdminState();
  const key = (user.email || user.uid || 'guest').trim().toLowerCase();
  const existing = state.members[key];

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
  saveAdminState(state);
  return member;
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

  // 1. Xóa bỏ hoàn toàn 3 tài khoản mẫu (demo) cũ để đảm bảo 100% là số người đăng ký THỰC TẾ
  const fakeDemoEmails = [
    'minhanh.sp2@gmail.com',
    'hoangnam.xuanhoa@gmail.com',
    'nickao.phaquay99@gmail.com',
  ];
  for (const fakeEmail of fakeDemoEmails) {
    if (state.members[fakeEmail]) {
      delete state.members[fakeEmail];
      changed = true;
    }
  }

  // 2. Quét toàn bộ hồ sơ người dùng THẬT đã từng đăng nhập Google trên trình duyệt
  try {
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
          if (fakeDemoEmails.includes(emailKey)) continue;
          const isAdminEmail = (state.adminEmails || DEFAULT_ADMIN_EMAILS).includes(emailKey);
          if (!state.members[emailKey]) {
            state.members[emailKey] = {
              uid: parsedUser.uid || `uid_${Date.now()}`,
              email: parsedUser.email,
              displayName: parsedUser.displayName || parsedUser.nickname || emailKey,
              nickname: parsedUser.nickname || parsedUser.displayName || emailKey,
              avatar: parsedUser.avatar || '',
              avatarId: parsedUser.avatarId || 'm_thin',
              gender: parsedUser.gender || 'male',
              phone: parsedUser.phone || '',
              residentType: parsedUser.residentType || 'local',
              status: isAdminEmail ? 'admin' : 'active',
              spinsCount: 0,
              level: 1,
              reviewsCount: 0,
              createdAt: parsedUser.createdAt || Date.now(),
              lastActiveAt: Date.now(),
            };
            changed = true;
          }
        }
      }
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
  fullMenu: CustomMenuEntry[];
  isVerified: boolean;
  isFeatured: boolean;
  priorityBoost: 1 | 2 | 3;
  isModified: boolean;
  isCustom: boolean;
  isNewlyDetected: boolean;
  updatedAt?: number;
}

function inferDefaultSectorTag(place: Place): string {
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

    result.push({
      place: mergedPlace,
      status,
      sectorTag: ov?.sectorTag || inferDefaultSectorTag(mergedPlace),
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

      result.push({
        place: mergedCustom,
        status: ov.status || 'active',
        sectorTag: ov.sectorTag || inferDefaultSectorTag(mergedCustom),
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
  const activeItems = getAllManagedPlaces().filter(item => item.status === 'active');
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
  state.places[placeId] = {
    ...current,
    ...patch,
    id: placeId,
    updatedAt: Date.now(),
  };

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
  if (getLoggedAdminSession()) return true;
  if (authUser && authUser.isLoggedIn && authUser.email) {
    const state = getAdminState();
    const emailLower = authUser.email.trim().toLowerCase();
    return Boolean(
      state.adminEmails?.some((e) => e.trim().toLowerCase() === emailLower)
    );
  }
  return false;
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
    };
  } else {
    const created: AdminAccount = {
      id: `adm_${Date.now()}`,
      username: cleanUsername,
      password: account.password.trim(),
      displayName: account.displayName.trim() || cleanUsername,
      role: account.role || 'manager',
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
    coordinateSource: 'openstreetmap' | 'admin_verified' | 'nominatim_geocoded';
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
  const prev = state.places[placeId] || { id: placeId, updatedAt: Date.now() };
  const nowIso = new Date().toISOString();

  state.places[placeId] = {
    ...prev,
    id: placeId,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    coordinateVerified: payload.coordinateVerified,
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
  const prev = state.places[placeId];
  if (!prev) return state;

  state.places[placeId] = {
    ...prev,
    lat: undefined,
    lng: undefined,
    coordinateVerified: false,
    coordinateSource: 'unverified',
    lastVerifiedAt: undefined,
    updatedAt: Date.now(),
  };

  state.auditLogs = addAdminAuditLog(
    state,
    'Đặt lại trạng thái chờ xác minh tọa độ',
    placeName || placeId,
    'place'
  );
  saveAdminState(state);
  return state;
}



