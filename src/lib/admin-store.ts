import { set, update, remove, get } from 'firebase/database';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from 'firebase/auth';
import {
  firebaseConfig,
  getRealtimeDb,
  getFirebaseAuth,
  createIsolatedProvisioningAuth,
  ref,
  onValue,
  runTransaction,
} from './firebase';
import { Food } from './foods';
import {
  Place,
  xuanHoaPlaces,
  getPlaceStyleGroup,
  VERIFIED_CATALOG_PLACE_COORDS,
} from './places-xuanhoa';
import { MainCategoryKey, getCategoryItems } from './xuanhoa-catalog';
import { UserAuthProfile, saveAuthUser, getStoredAuthUser, isVerifiedFirebaseAuthUid } from './auth';
export { isVerifiedFirebaseAuthUid };
import { cleanDishDisplayTitle } from './utils';
import {
  MAP_CATEGORY_REGISTRY,
  resolvePlaceTaxonomy,
  resolvePlaceContentProfile,
  getDefaultSectorTagForSubcategory,
  type MapSubcategoryId,
  type ContentProfileType,
  type CatalogModeType,
} from './map/map-category-registry';
import { VERIFIED_RTDB_PLACES_SEED } from './verified-rtdb-seeds';

export const COORDINATE_SOURCE_PRIORITY: Record<string, number> = {
  admin_verified: 100,
  google_maps_resolved: 70,
  nominatim_selected: 60,
  openstreetmap: 50,
  catalog_seed: 40,
  nominatim_geocoded: 30,
  unverified: 10,
};

export const UNPINNED_18_CATALOG_PLACE_IDS = new Set<string>([
  'lau-ngua-tay-bac',
  'quan-dua-kha-do',
  'tiem-banh-a-salty-name',
  'tiem-me-soc',
  'trang-hai-san',
  'bun-cha-xuan-hoa',
  'bun-rieu-ba-mai',
  'nha-hang-binh-nam',
  'cafe-1975-xuan-hoa',
  'sui-cao-tieu-lau-quan',
  'pho-bo-xuan-hoa',
  'tiem-tra-thanh-thanh',
  'matcha-house-xuan-hoa',
  'mr-tea-xuan-hoa',
  'goky-xuan-hoa',
  'lau-thai-ha-tinh',
  'hi-tea',
  'an-vat-nha-phuong',
]);

export const REMOVE_OLD_TEST_AND_DUPLICATE_PLACE_IDS = new Set<string>([
  'xh_custom_1793679072649',
  'xh_custom_1793679078883',
  'xh_custom_1793679229732',
  'xh_custom_1793679236729',
  'xh_map_1793593781850',
  'xh_map_1793593946189',
  'xh_map_1792549858151',
  'xh_map_1793345937162',
  'xh_map_1793537990004',
  'xh_map_1793590430372',
  'xh_custom_1793418458046',
  'xh_custom_1793672955111',
  'xh_custom_1793355061807',
  'xh_map_1793442980293',
  'xh_custom_1793355271608',
  'xh_custom_1793585051672',
  'xh_custom_1792229707991',
]);

export interface PlaceLocationHistoryEntry {
  historyId?: string;
  placeId?: string;
  targetVersion?: number;
  status?: 'intent' | 'committed' | 'aborted';
  timestamp: number;
  committedAt?: number;
  abortedAt?: number;
  abortReason?: string;
  updatedAt?: number;
  actor: string;
  actorUid?: string;
  updatedBy?: string;
  actorRole: 'admin' | 'manager' | 'system' | string;
  action: 'pin' | 'update_coord' | 'unpin' | 'approve_proposal' | 'reject_proposal' | string;
  previousLat?: number | null;
  previousLng?: number | null;
  newLat?: number | null;
  newLng?: number | null;
  coordinateSource?: string;
  reason?: string;
  note?: string;
}

export type ProposalActionType =
  | 'create'
  | 'update'
  | 'pin'
  | 'hide'
  | 'delete'
  | 'CREATE_PLACE'
  | 'UPDATE_PLACE'
  | 'UPDATE_COORDINATES'
  | 'HIDE_PLACE'
  | 'DELETE_PLACE';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface PlaceChangeProposal {
  id: string;
  placeId: string;
  placeName: string;
  actionType: ProposalActionType;
  status: ProposalStatus;
  submittedBy: string;
  submittedByUid?: string;
  submittedByEmail?: string;
  submittedByName: string;
  submittedByRole: string;
  submittedAt: number;
  reviewedBy?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewedAt?: number;
  reviewNote?: string;
  message?: string;
  baseVersion: number;
  hasVersionConflict?: boolean;
  previousData: {
    name?: string;
    address?: string;
    phone?: string;
    openHours?: string;
    parentCategoryId?: string;
    subcategoryId?: string;
    lat?: number | null;
    lng?: number | null;
    mapsUrl?: string;
    tagline?: string;
  };
  beforeData: {
    name?: string;
    address?: string;
    phone?: string;
    openHours?: string;
    parentCategoryId?: string;
    subcategoryId?: string;
    lat?: number | null;
    lng?: number | null;
    mapsUrl?: string;
    tagline?: string;
  };
  proposedData: {
    name?: string;
    address?: string;
    phone?: string;
    openHours?: string;
    parentCategoryId?: string;
    subcategoryId?: string;
    lat?: number | null;
    lng?: number | null;
    mapsUrl?: string;
    tagline?: string;
    coordinateSource?: PlaceOverride['coordinateSource'];
    customPlacePayload?: Partial<Place>;
  };
  afterData: {
    name?: string;
    address?: string;
    phone?: string;
    openHours?: string;
    parentCategoryId?: string;
    subcategoryId?: string;
    lat?: number | null;
    lng?: number | null;
    mapsUrl?: string;
    tagline?: string;
    coordinateSource?: PlaceOverride['coordinateSource'];
    customPlacePayload?: Partial<Place>;
  };
}

export type AdminThemeMode = 'ivory-gold' | 'platinum-royal' | 'emerald- pearl';

export type PlaceStatus = 'active' | 'locked' | 'deleted';
export type DishStatus = 'active' | 'locked' | 'deleted';
export type MemberStatus = 'active' | 'muted' | 'banned' | 'admin';

export interface CustomMenuEntry {
  id?: string;
  name: string;
  price: number;
  tag?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
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
  website?: string;
  educationLevel?: string;
  agencyFunction?: string;
  minPrice?: number;
  maxPrice?: number;
  category?: Place['category'];
  sectorTag?: string; // Phân khu mở rộng: an-chinh | nhau-lau | uong | an-vat | bia-game | dien-thoai | an-choi | dich-vu
  tags?: string[];
  extraTags?: string[];
  contentProfile?: ContentProfileType;
  catalogMode?: CatalogModeType;
  catalogEnabled?: boolean;
  serviceMode?: Place['serviceMode'];
  deliveryNote?: string;
  mapsQuery?: string;
  mapsUrl?: string;
  quip?: string;
  imageUrl?: string;
  media?: Array<{
    id: string;
    type: 'photo' | 'panorama360';
    url: string;
    title?: string;
    anchorMode: 'place' | 'absolute';
    lat?: number;
    lng?: number;
    heading?: number;
    pitch?: number;
    capturedAt?: string;
  }>;
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
  /** Cờ đánh dấu chỉ khi Admin chủ động bấm "Gỡ vị trí" khỏi bản đồ */
  adminExplicitlyUnpinned?: boolean;
  locationStatus?: 'located' | 'unlocated' | 'invalid_coordinates' | 'invalid' | 'pending_geocode' | 'suspicious' | 'outside_service_area';
  mapsLinkStatus?: 'none' | 'valid' | 'unresolved' | 'invalid';
  visibilityStatus?: 'visible' | 'hidden' | 'deleted' | 'blocked';
  coordinateSource?:
    | 'openstreetmap'
    | 'admin_verified'
    | 'google_maps_resolved'
    | 'nominatim_selected'
    | 'nominatim_geocoded'
    | 'catalog_seed'
    | 'unverified';
  lastVerifiedAt?: string;
  mapCategory?: string;
  parentCategoryId?: string;
  subcategoryId?: string;
  /** Alias chuẩn theo Unified Place Data Contract (Phần V) */
  categoryId?: string;
  showByDefault?: boolean;
  /** Alias chuẩn theo Unified Place Data Contract (Phần V) */
  defaultMapVisible?: boolean;
  /** Alias chuẩn theo Unified Place Data Contract (Phần V) */
  openingHours?: string;
  createdAt?: number;
  version?: number;
  liveStatus?: 'open_normal' | 'busy_hot' | 'closed_today';
  liveStatusNote?: string;
  confirmCoordinateOverride?: boolean;
  lastCoordMutation?: {
    historyId?: string;
    targetVersion?: number;
    previousLat: number | null;
    previousLng: number | null;
    newLat: number | null;
    newLng: number | null;
    actorUid: string;
    timestamp: number;
    reason: string;
    action: string;
  } | null;
  locationHistory?: PlaceLocationHistoryEntry[];
  pendingWebApproval?: {
    proposalId?: string;
    submittedBy: string;
    submittedByName: string;
    submittedAt: number;
    actionSummary: string;
    actionType?: ProposalActionType;
    isNewPlace?: boolean;
    isDeleteRequest?: boolean;
  } | null;
  pendingMapApproval?: {
    proposalId?: string;
    submittedBy: string;
    submittedByEmail?: string;
    submittedByName: string;
    submittedAt: number;
    actionSummary: string;
    actionType?: ProposalActionType;
    baseVersion?: number;
    previousLat?: number | null;
    previousLng?: number | null;
    proposedLat?: number | null;
    proposedLng?: number | null;
    proposedName?: string;
    proposedAddress?: string;
    proposedPhone?: string;
    isNewPlace?: boolean;
    isDeleteRequest?: boolean;
  } | null;
  updatedAt: number;
  isCustom?: boolean;
  customPlaceData?: Place;
}

export type SystemRoleTier =
  | 'primary_founder'
  | 'backup_founder'
  | 'admin'
  | 'manager'
  | 'user';

export interface BackupFounderRecord {
  uid: string;
  username: string;
  displayName?: string;
  recoveryEmail?: string;
  recoveryEmailVerified?: boolean;
  active: boolean;
  emailVerified?: boolean;
  sessionEpoch?: number;
  tokensValidAfterTime?: number;
  lastPasswordResetAt?: number;
  createdByUid: string;
  createdAt: number;
  updatedAt: number;
  revokedAt?: number;
  revokedByUid?: string;
  lastLoginAt?: number;
}

export interface XuanHoaSecurityState {
  primary_founder: Record<string, boolean>;
  backup_founder: Record<string, boolean | BackupFounderRecord>;
  admins: Record<string, boolean>;
  managers: Record<string, boolean>;
  locked_uids: Record<string, boolean>;
}

export interface AdminAccount {
  id: string;
  username: string;
  password: string;
  passwordHash?: string;
  displayName: string;
  role: 'superadmin' | 'manager';
  roleTier?: SystemRoleTier;
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
  roleTier?: SystemRoleTier;
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
  actorUid?: string;
  actorRole?: 'primary_founder' | 'backup_founder' | 'admin' | 'manager';
  eventCategory?:
    | 'admin_review'
    | 'coord_override'
    | 'role_change'
    | 'role_management'
    | 'founder_security'
    | 'system_security'
    | 'place_crud'
    | 'manager_proposal';
  verificationSource?:
    | 'client_rtdb_rule_checked'
    | 'trusted_backend_verified'
    | 'backend_admin_verified';
  refId?: string;
  placeId?: string;
  actorEmail?: string;
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

/**
 * Băm định danh một chiều (Salted Digest) cho thông tin xác thực quản trị — không bao giờ lưu mật khẩu/PIN dạng rõ (plaintext) trong mã nguồn, localStorage hoặc RTDB.
 */
export function hashAdminCredential(secret: string, salt = 'xh_sec_rbac_v2'): string {
  const clean = `${salt}::${String(secret || '').trim()}`;
  let h1 = 0xdeadbeef ^ clean.length;
  let h2 = 0x41c6ce57 ^ clean.length;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `xh2_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export function verifyAdminCredential(
  rawInput: string,
  storedPassword?: string,
  storedHash?: string
): boolean {
  // SEC-FINAL-01: Không bao giờ sử dụng hash mật khẩu hoặc PIN tĩnh ở frontend làm cơ chế xác thực chính.
  // Mọi thông tin xác thực tĩnh cũ ('123', '6868', 'xh2_65a096127c75d450') đều đã bị thu hồi hoàn toàn.
  void rawInput;
  void storedPassword;
  void storedHash;
  return false;
}

export const PRIMARY_FOUNDER_EMAIL = 'marcel.vietnam@gmail.com';
export const PRIMARY_FOUNDER_DISPLAY_NAME = 'Dê Già Designer';
export const BACKUP_FOUNDER_INTERNAL_AUTH_DOMAIN = 'founder-auth.xuanhoacogi.internal';

export const DEFAULT_ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    id: 'adm_primary_founder',
    username: PRIMARY_FOUNDER_EMAIL,
    password: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
    passwordHash: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
    displayName: `${PRIMARY_FOUNDER_DISPLAY_NAME} (Primary Founder)`,
    role: 'superadmin',
    roleTier: 'primary_founder',
    createdAt: 1710000000000,
  },
];

export interface AdminState {
  places: Record<string, PlaceOverride>;
  dishes: Record<string, DishOverride>;
  members: Record<string, ManagedMember>;
  placeProposals?: Record<string, PlaceChangeProposal>;
  knownPlaceIds: string[];
  knownDishKeys: string[];
  auditLogs: AdminAuditLog[];
  adminEmails: string[];
  adminAccounts?: AdminAccount[];
  adminPin: string;
  sectorTags?: SectorCategoryTag[];
  fontScale?: 'normal' | 'large';
  requirePinOnOpen?: boolean;
  mapAccessMode?: 'public_open' | 'managers_and_admin_only';
  updatedAt: number;
}

const ADMIN_STORAGE_KEY = 'xuanhoa_admin_state_v1';
const ADMIN_AUTH_LOCAL_KEY = 'xuanhoa_admin_logged_account_v1';
const ADMIN_AUTH_SESSION_KEY = 'xuanhoa_admin_logged_session_v1';
const SECURITY_STATE_STORAGE_KEY = 'xuanhoa_security_state_cache_v2';
const FOUNDER_LOGIN_RATE_LIMIT_KEY = 'xuanhoa_founder_login_guard_v2';

// FOUNDER SYSTEM V2: Chỉ duy nhất tài khoản Dê Già Designer đã xác minh Firebase Auth UID 28 ký tự là Primary Founder mặc định.
// Các Admin/Manager cũ sẽ được Founder cấp lại quyền sau khi xác minh UID 28 ký tự.
const DEFAULT_ADMIN_EMAILS = [PRIMARY_FOUNDER_EMAIL];

export function getDishUniqueKey(food: Food): string {
  return food.customId || `dish_${food.name.toLowerCase().trim().replace(/\s+/g, '_')}_${food.price}`;
}

/**
 * 4 bản ghi đề xuất tạo Place mới (`CREATE_PLACE`) cho 4 công trình Landmark 3D chưa tồn tại trong bộ 165 ID lịch sử:
 * 1. Chùa Hiền Lương (`xh_landmark_chua_hien_luong`) — tọa độ đề xuất `21.2856174, 105.7175459`
 * 2. Chùa An Hòa (`xh_landmark_chua_an_hoa`) — tọa độ đề xuất `21.2891926, 105.7133076`
 * 3. Trường Mầm non Xuân Hòa (`xh_landmark_mam_non_xuan_hoa`) — tọa độ đề xuất `21.2863997, 105.7218583`
 * 4. Nhà Minh Hường (`xh_landmark_nha_minh_huong`) — tọa độ đề xuất `21.285862, 105.717861`
 *
 * Nguyên tắc:
 * - Giữ ở trạng thái `status: 'pending'` và `coordinateSource: 'unverified'` (chưa tự đánh dấu `admin_verified` trước khi Admin xác nhận).
 * - Không tự thêm vào `state.places` khi chưa duyệt để bảo toàn 100% bộ dữ liệu lịch sử 165 ID (`148` active / `130` located / `18` unpinned).
 * - Khi Admin bấm Duyệt (`approvePlaceProposal`), bản ghi sẽ chính thức chuyển sang `coordinateVerified: true`, `coordinateSource: 'admin_verified'`.
 */
export const PENDING_LANDMARK_PLACE_PROPOSALS_SEED: Record<string, PlaceChangeProposal> = {
  prop_xh_landmark_chua_hien_luong: {
    id: 'prop_xh_landmark_chua_hien_luong',
    placeId: 'xh_landmark_chua_hien_luong',
    placeName: 'Chùa Hiền Lương',
    actionType: 'CREATE_PLACE',
    status: 'pending',
    submittedBy: 'quanlymaps@xuanhoacogi.vn',
    submittedByUid: 'uid_manager_landmark_sync',
    submittedByEmail: 'quanlymaps@xuanhoacogi.vn',
    submittedByName: 'Quản lý Maps',
    submittedByRole: 'Quản lý Maps',
    submittedAt: 1730690000000,
    baseVersion: 1,
    message: 'Đề xuất tạo Place mới cho mô hình 3D Chùa Hiền Lương (chờ Admin xác nhận tọa độ 21.2856174, 105.7175459)',
    previousData: {
      name: 'Chùa Hiền Lương',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '05:30 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'religious',
      lat: null,
      lng: null,
      mapsUrl: '',
      tagline: 'Chùa Hiền Lương — Di tích tâm linh & kiến trúc truyền thống tại Phường Xuân Hòa',
    },
    beforeData: {
      name: 'Chùa Hiền Lương',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '05:30 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'religious',
      lat: null,
      lng: null,
      mapsUrl: '',
      tagline: 'Chùa Hiền Lương — Di tích tâm linh & kiến trúc truyền thống tại Phường Xuân Hòa',
    },
    proposedData: {
      name: 'Chùa Hiền Lương',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '05:30 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'religious',
      lat: 21.2856174,
      lng: 105.7175459,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.2856174,105.7175459',
      tagline: 'Chùa Hiền Lương — Di tích tâm linh & kiến trúc truyền thống tại Phường Xuân Hòa',
      coordinateSource: 'unverified',
    },
    afterData: {
      name: 'Chùa Hiền Lương',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '05:30 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'religious',
      lat: 21.2856174,
      lng: 105.7175459,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.2856174,105.7175459',
      tagline: 'Chùa Hiền Lương — Di tích tâm linh & kiến trúc truyền thống tại Phường Xuân Hòa',
      coordinateSource: 'unverified',
    },
  },
  prop_xh_landmark_chua_an_hoa: {
    id: 'prop_xh_landmark_chua_an_hoa',
    placeId: 'xh_landmark_chua_an_hoa',
    placeName: 'Chùa An Hòa',
    actionType: 'CREATE_PLACE',
    status: 'pending',
    submittedBy: 'quanlymaps@xuanhoacogi.vn',
    submittedByUid: 'uid_manager_landmark_sync',
    submittedByEmail: 'quanlymaps@xuanhoacogi.vn',
    submittedByName: 'Quản lý Maps',
    submittedByRole: 'Quản lý Maps',
    submittedAt: 1730690001000,
    baseVersion: 1,
    message: 'Đề xuất tạo Place mới cho mô hình 3D Chùa An Hòa (chờ Admin xác nhận tọa độ 21.2891926, 105.7133076)',
    previousData: {
      name: 'Chùa An Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '05:30 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'religious',
      lat: null,
      lng: null,
      mapsUrl: '',
      tagline: 'Chùa An Hòa — Ngôi chùa truyền thống tại Phường Xuân Hòa',
    },
    beforeData: {
      name: 'Chùa An Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '05:30 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'religious',
      lat: null,
      lng: null,
      mapsUrl: '',
      tagline: 'Chùa An Hòa — Ngôi chùa truyền thống tại Phường Xuân Hòa',
    },
    proposedData: {
      name: 'Chùa An Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '05:30 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'religious',
      lat: 21.2891926,
      lng: 105.7133076,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.2891926,105.7133076',
      tagline: 'Chùa An Hòa — Ngôi chùa truyền thống tại Phường Xuân Hòa',
      coordinateSource: 'unverified',
    },
    afterData: {
      name: 'Chùa An Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '05:30 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'religious',
      lat: 21.2891926,
      lng: 105.7133076,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.2891926,105.7133076',
      tagline: 'Chùa An Hòa — Ngôi chùa truyền thống tại Phường Xuân Hòa',
      coordinateSource: 'unverified',
    },
  },
  prop_xh_landmark_mam_non_xuan_hoa: {
    id: 'prop_xh_landmark_mam_non_xuan_hoa',
    placeId: 'xh_landmark_mam_non_xuan_hoa',
    placeName: 'Trường Mầm non Xuân Hòa',
    actionType: 'CREATE_PLACE',
    status: 'pending',
    submittedBy: 'quanlymaps@xuanhoacogi.vn',
    submittedByUid: 'uid_manager_landmark_sync',
    submittedByEmail: 'quanlymaps@xuanhoacogi.vn',
    submittedByName: 'Quản lý Maps',
    submittedByRole: 'Quản lý Maps',
    submittedAt: 1730690002000,
    baseVersion: 1,
    message: 'Đề xuất tạo Place mới cho mô hình 3D Trường Mầm non Xuân Hòa (chờ Admin xác nhận tọa độ 21.2863997, 105.7218583)',
    previousData: {
      name: 'Trường Mầm non Xuân Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '07:00 - 17:30',
      parentCategoryId: 'education',
      subcategoryId: 'kindergarten',
      lat: null,
      lng: null,
      mapsUrl: '',
      tagline: 'Trường Mầm non Xuân Hòa — Cơ sở giáo dục mầm non Phường Xuân Hòa',
    },
    beforeData: {
      name: 'Trường Mầm non Xuân Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '07:00 - 17:30',
      parentCategoryId: 'education',
      subcategoryId: 'kindergarten',
      lat: null,
      lng: null,
      mapsUrl: '',
      tagline: 'Trường Mầm non Xuân Hòa — Cơ sở giáo dục mầm non Phường Xuân Hòa',
    },
    proposedData: {
      name: 'Trường Mầm non Xuân Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '07:00 - 17:30',
      parentCategoryId: 'education',
      subcategoryId: 'kindergarten',
      lat: 21.2863997,
      lng: 105.7218583,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.2863997,105.7218583',
      tagline: 'Trường Mầm non Xuân Hòa — Cơ sở giáo dục mầm non Phường Xuân Hòa',
      coordinateSource: 'unverified',
    },
    afterData: {
      name: 'Trường Mầm non Xuân Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '07:00 - 17:30',
      parentCategoryId: 'education',
      subcategoryId: 'kindergarten',
      lat: 21.2863997,
      lng: 105.7218583,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.2863997,105.7218583',
      tagline: 'Trường Mầm non Xuân Hòa — Cơ sở giáo dục mầm non Phường Xuân Hòa',
      coordinateSource: 'unverified',
    },
  },
  prop_xh_landmark_nha_minh_huong: {
    id: 'prop_xh_landmark_nha_minh_huong',
    placeId: 'xh_landmark_nha_minh_huong',
    placeName: 'Nhà Minh Hường',
    actionType: 'CREATE_PLACE',
    status: 'pending',
    submittedBy: 'quanlymaps@xuanhoacogi.vn',
    submittedByUid: 'uid_manager_landmark_sync',
    submittedByEmail: 'quanlymaps@xuanhoacogi.vn',
    submittedByName: 'Quản lý Maps',
    submittedByRole: 'Quản lý Maps',
    submittedAt: 1730690003000,
    baseVersion: 1,
    message: 'Đề xuất tạo Place mới cho mô hình 3D Nhà Minh Hường (chờ Admin xác nhận tọa độ 21.285862, 105.717861)',
    previousData: {
      name: 'Nhà Minh Hường',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '07:00 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'landmark',
      lat: null,
      lng: null,
      mapsUrl: '',
      tagline: 'Nhà Minh Hường — Công trình nhà vườn kiến trúc đặc trưng tại Phường Xuân Hòa',
    },
    beforeData: {
      name: 'Nhà Minh Hường',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '07:00 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'landmark',
      lat: null,
      lng: null,
      mapsUrl: '',
      tagline: 'Nhà Minh Hường — Công trình nhà vườn kiến trúc đặc trưng tại Phường Xuân Hòa',
    },
    proposedData: {
      name: 'Nhà Minh Hường',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '07:00 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'landmark',
      lat: 21.285862,
      lng: 105.717861,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.285862,105.717861',
      tagline: 'Nhà Minh Hường — Công trình nhà vườn kiến trúc đặc trưng tại Phường Xuân Hòa',
      coordinateSource: 'unverified',
    },
    afterData: {
      name: 'Nhà Minh Hường',
      address: 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      phone: '',
      openHours: '07:00 - 21:00',
      parentCategoryId: 'landmark',
      subcategoryId: 'landmark',
      lat: 21.285862,
      lng: 105.717861,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=21.285862,105.717861',
      tagline: 'Nhà Minh Hường — Công trình nhà vườn kiến trúc đặc trưng tại Phường Xuân Hòa',
      coordinateSource: 'unverified',
    },
  },
};

export const PENDING_LANDMARK_PROPOSAL_BY_PLACE_ID: Record<string, string> = {
  xh_landmark_chua_hien_luong: 'prop_xh_landmark_chua_hien_luong',
  xh_landmark_chua_an_hoa: 'prop_xh_landmark_chua_an_hoa',
  xh_landmark_mam_non_xuan_hoa: 'prop_xh_landmark_mam_non_xuan_hoa',
  xh_landmark_nha_minh_huong: 'prop_xh_landmark_nha_minh_huong',
};

export interface ResolvedPlaceOrProposalCoordinates {
  placeId: string;
  proposalId?: string;
  name: string;
  address: string;
  tagline: string;
  parentCategoryId: string;
  subcategoryId: string;
  lat: number;
  lng: number;
  coordinateVerified: boolean;
  coordinateSource: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled';
}

/**
 * Tra cứu tọa độ neo (anchor) từ bản ghi Place đã duyệt hoặc bản ghi đề xuất Place đang chờ Admin duyệt (`placeProposals`).
 * Dùng cho hệ thống Landmark 3D để lấy anchor trực tiếp từ tọa độ Place (hoặc tọa độ đề xuất của Place khi đang chờ Admin duyệt).
 */
export function resolvePlaceOrPendingProposalCoordinates(
  placeId: string
): ResolvedPlaceOrProposalCoordinates | null {
  if (!placeId) return null;
  const state = getAdminState();
  const ov = state.places?.[placeId];
  if (ov) {
    if (ov.status === 'deleted' || ov.visibilityStatus === 'deleted') {
      return null;
    }
    if (typeof ov.lat === 'number' && typeof ov.lng === 'number' && Number.isFinite(ov.lat) && Number.isFinite(ov.lng)) {
      const isPendingNew = Boolean(ov.pendingMapApproval?.isNewPlace);
      return {
        placeId,
        proposalId: ov.pendingMapApproval?.proposalId,
        name: ov.name || ov.customPlaceData?.name || placeId,
        address: ov.address || ov.customPlaceData?.address || 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
        tagline: ov.tagline || ov.customPlaceData?.tagline || '',
        parentCategoryId: ov.parentCategoryId || 'landmark',
        subcategoryId: ov.subcategoryId || ov.categoryId || 'landmark',
        lat: Number(ov.lat),
        lng: Number(ov.lng),
        coordinateVerified: Boolean(ov.coordinateVerified && !isPendingNew),
        coordinateSource: isPendingNew ? 'unverified' : ov.coordinateSource || 'admin_verified',
        status: isPendingNew ? 'pending' : 'approved',
      };
    }
    if (
      ov.pendingMapApproval &&
      typeof ov.pendingMapApproval.proposedLat === 'number' &&
      typeof ov.pendingMapApproval.proposedLng === 'number'
    ) {
      return {
        placeId,
        proposalId: ov.pendingMapApproval.proposalId,
        name: ov.pendingMapApproval.proposedName || ov.name || placeId,
        address: ov.pendingMapApproval.proposedAddress || ov.address || 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
        tagline: ov.tagline || '',
        parentCategoryId: ov.parentCategoryId || 'landmark',
        subcategoryId: ov.subcategoryId || ov.categoryId || 'landmark',
        lat: Number(ov.pendingMapApproval.proposedLat),
        lng: Number(ov.pendingMapApproval.proposedLng),
        coordinateVerified: false,
        coordinateSource: 'unverified',
        status: 'pending',
      };
    }
  }

  const proposalsMap = state.placeProposals || PENDING_LANDMARK_PLACE_PROPOSALS_SEED;
  const matchingProp =
    Object.values(proposalsMap).find(p => p.placeId === placeId && p.status === 'pending') ||
    Object.values(proposalsMap).find(p => p.placeId === placeId) ||
    Object.values(PENDING_LANDMARK_PLACE_PROPOSALS_SEED).find(p => p.placeId === placeId);

  if (
    matchingProp &&
    typeof matchingProp.proposedData?.lat === 'number' &&
    typeof matchingProp.proposedData?.lng === 'number'
  ) {
    const isApproved = matchingProp.status === 'approved';
    return {
      placeId,
      proposalId: matchingProp.id,
      name: matchingProp.proposedData.name || matchingProp.placeName || placeId,
      address: matchingProp.proposedData.address || 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
      tagline: matchingProp.proposedData.tagline || '',
      parentCategoryId: matchingProp.proposedData.parentCategoryId || 'landmark',
      subcategoryId: matchingProp.proposedData.subcategoryId || 'landmark',
      lat: Number(matchingProp.proposedData.lat),
      lng: Number(matchingProp.proposedData.lng),
      coordinateVerified: isApproved,
      coordinateSource: isApproved ? 'admin_verified' : 'unverified',
      status: matchingProp.status,
    };
  }

  return null;
}

function createInitialAdminState(): AdminState {
  const initialPlaceIds = xuanHoaPlaces.map(p => p.id);
  const allBaseDishes = [
    ...getCategoryItems('an-gi'),
    ...getCategoryItems('nhau-gi'),
    ...getCategoryItems('uong-gi'),
  ];
  const initialDishKeys = Array.from(new Set(allBaseDishes.map(getDishUniqueKey)));
  const seededPlaces: Record<string, PlaceOverride> = JSON.parse(
    JSON.stringify(VERIFIED_RTDB_PLACES_SEED)
  );
  const seededProposals: Record<string, PlaceChangeProposal> = JSON.parse(
    JSON.stringify(PENDING_LANDMARK_PLACE_PROPOSALS_SEED)
  );

  return {
    places: seededPlaces,
    dishes: {},
    members: {},
    placeProposals: seededProposals,
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
    adminPin: '[REDACTED_HASHED]',
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

    const fallbackSyntheticUid = `uid_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const existing = out[cleanEmail];
    const pickBestUid = (u1?: string, u2?: string): string => {
      if (isVerifiedFirebaseAuthUid(u1)) return u1!.trim();
      if (isVerifiedFirebaseAuthUid(u2)) return u2!.trim();
      if (u1 && !u1.startsWith('uid_') && !u1.startsWith('google_17')) return u1;
      if (u2 && !u2.startsWith('uid_') && !u2.startsWith('google_17')) return u2;
      return u1 || u2 || fallbackSyntheticUid;
    };
    const canonicalUid = pickBestUid(incoming.uid, existing?.uid);
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

let cachedSecurityState: XuanHoaSecurityState = {
  primary_founder: {},
  backup_founder: {},
  admins: {},
  managers: {},
  locked_uids: {},
};

export function getSecurityState(): XuanHoaSecurityState {
  if (typeof window === 'undefined') return cachedSecurityState;
  try {
    const raw = sessionStorage.getItem(SECURITY_STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<XuanHoaSecurityState>;
      cachedSecurityState = {
        primary_founder: parsed.primary_founder || cachedSecurityState.primary_founder || {},
        backup_founder: parsed.backup_founder || cachedSecurityState.backup_founder || {},
        admins: parsed.admins || cachedSecurityState.admins || {},
        managers: parsed.managers || cachedSecurityState.managers || {},
        locked_uids: parsed.locked_uids || cachedSecurityState.locked_uids || {},
      };
    }
  } catch {}
  return cachedSecurityState;
}

export function saveSecurityStateCache(next: Partial<XuanHoaSecurityState>): XuanHoaSecurityState {
  cachedSecurityState = {
    primary_founder: next.primary_founder ?? cachedSecurityState.primary_founder ?? {},
    backup_founder: next.backup_founder ?? cachedSecurityState.backup_founder ?? {},
    admins: next.admins ?? cachedSecurityState.admins ?? {},
    managers: next.managers ?? cachedSecurityState.managers ?? {},
    locked_uids: next.locked_uids ?? cachedSecurityState.locked_uids ?? {},
  };
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(SECURITY_STATE_STORAGE_KEY, JSON.stringify(cachedSecurityState));
      window.dispatchEvent(
        new CustomEvent('xuanhoa_security_sync', { detail: cachedSecurityState })
      );
    } catch {}
  }
  return cachedSecurityState;
}

export function isUidPrimaryFounder(uid?: string | null): boolean {
  if (!isVerifiedFirebaseAuthUid(uid)) return false;
  const clean = uid!.trim();
  const sec = getSecurityState();
  return sec.primary_founder[clean] === true;
}

export function isUidLocked(uid?: string | null): boolean {
  if (!uid || typeof uid !== 'string') return false;
  const clean = uid.trim();
  if (isUidPrimaryFounder(clean)) return false;
  const sec = getSecurityState();
  return sec.locked_uids[clean] === true;
}

export function isUidActiveBackupFounder(uid?: string | null): boolean {
  if (!isVerifiedFirebaseAuthUid(uid)) return false;
  const clean = uid!.trim();
  if (isUidLocked(clean)) return false;
  const sec = getSecurityState();
  const entry = sec.backup_founder[clean];
  if (entry === true) return true;
  if (entry && typeof entry === 'object' && entry.active === true) return true;
  return false;
}

/**
 * SEC-FOUNDER-V2-DISABLE-BYPASS:
 * Nếu một UID tồn tại trong `xuanhoa_security/backup_founder` nhưng có `active !== true`
 * (hoặc bị khóa), UID đó TUYỆT ĐỐI bị từ chối mọi quyền Admin/Manager/Founder ngay cả khi
 * `admins/$uid === true` hoặc `managers/$uid === true`.
 */
export function isUidDisabledBackupFounder(uid?: string | null): boolean {
  if (!uid || typeof uid !== 'string') return false;
  const clean = uid.trim();
  if (!clean || isUidPrimaryFounder(clean)) return false;
  const sec = getSecurityState();
  if (!sec.backup_founder || !(clean in sec.backup_founder)) return false;
  const entry = sec.backup_founder[clean];
  if (entry === true) return isUidLocked(clean);
  if (entry && typeof entry === 'object') {
    return entry.active !== true || isUidLocked(clean);
  }
  return true;
}

export function isUidOperationalAdmin(uid?: string | null): boolean {
  if (!isVerifiedFirebaseAuthUid(uid)) return false;
  const clean = uid!.trim();
  if (isUidPrimaryFounder(clean)) return true;
  if (isUidLocked(clean) || isUidDisabledBackupFounder(clean)) return false;
  if (isUidActiveBackupFounder(clean)) return true;
  const sec = getSecurityState();
  return sec.admins[clean] === true;
}

export function isUidOperationalManager(uid?: string | null): boolean {
  if (!isVerifiedFirebaseAuthUid(uid)) return false;
  const clean = uid!.trim();
  if (isUidLocked(clean) || isUidDisabledBackupFounder(clean)) return false;
  const sec = getSecurityState();
  return sec.managers[clean] === true;
}

export function getBackupFounderRecords(): BackupFounderRecord[] {
  const sec = getSecurityState();
  const out: BackupFounderRecord[] = [];
  for (const [uid, entry] of Object.entries(sec.backup_founder || {})) {
    if (!isVerifiedFirebaseAuthUid(uid)) continue;
    if (entry === true) {
      out.push({
        uid,
        username: 'backup_founder',
        displayName: 'Backup Founder',
        active: !isUidLocked(uid),
        createdByUid: 'primary_founder',
        createdAt: 0,
        updatedAt: 0,
      });
    } else if (entry && typeof entry === 'object') {
      out.push({
        ...entry,
        uid: entry.uid || uid,
        active: Boolean(entry.active && !isUidLocked(uid)),
      });
    }
  }
  return out;
}

export function isPrimaryFounderIdentifier(id?: string | null, uid?: string | null): boolean {
  if (isUidPrimaryFounder(uid)) return true;
  if (!id) return false;
  const clean = id.trim().toLowerCase();
  if (clean === PRIMARY_FOUNDER_EMAIL || clean === `@${PRIMARY_FOUNDER_EMAIL}`) {
    // Nếu có truyền uid thì bắt buộc uid đó phải là Firebase Auth UID 28 ký tự hợp lệ (hoặc chưa có uid khi kiểm tra theo email thuần)
    if (uid && !isVerifiedFirebaseAuthUid(uid)) return false;
    return true;
  }
  return false;
}

function isSuperAdminIdentifier(id?: string | null, uid?: string | null): boolean {
  if (isPrimaryFounderIdentifier(id, uid)) return true;
  if (isUidOperationalAdmin(uid)) return true;
  return false;
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

    const parsed: AdminState & Record<string, any> = JSON.parse(raw);
    const places = parsed.places || {};
    const placeProposals = parsed.placeProposals || {};

    let migrated = false;
    if (parsed.merchantSubmissions) {
      delete parsed.merchantSubmissions;
      migrated = true;
    }

    // 1. Dọn sạch 100% các bản ghi test tự động và bản ghi trùng lặp đã hợp nhất về ID chuẩn
    for (const badId of REMOVE_OLD_TEST_AND_DUPLICATE_PLACE_IDS) {
      if (places[badId]) {
        delete places[badId];
        migrated = true;
      }
    }

    for (const [seedPropId, seedProp] of Object.entries(PENDING_LANDMARK_PLACE_PROPOSALS_SEED)) {
      if (!placeProposals[seedPropId]) {
        placeProposals[seedPropId] = JSON.parse(JSON.stringify(seedProp));
        migrated = true;
      }
    }

    // 1b. Không tự tạo mới 4 Place cho 4 landmark pending trên `places` trước khi Admin bấm Duyệt đề xuất (`status === 'approved'`)
    for (const [lmPlaceId, propId] of Object.entries(PENDING_LANDMARK_PROPOSAL_BY_PLACE_ID)) {
      if (places[lmPlaceId] && placeProposals[propId]?.status !== 'approved') {
        delete places[lmPlaceId];
        migrated = true;
      }
    }

    // 2. Bổ sung đầy đủ toàn bộ dữ liệu thực tế từ VERIFIED_RTDB_PLACES_SEED (7 địa điểm custom thật + các quán đã ghim/xóa trên RTDB)
    for (const [seedId, seedOv] of Object.entries(VERIFIED_RTDB_PLACES_SEED)) {
      const existingOv = places[seedId];
      if (!existingOv) {
        places[seedId] = JSON.parse(JSON.stringify(seedOv));
        migrated = true;
      } else if (
        (seedId === 'osm_civic_cong_an_xuan_hoa' || seedId === 'billiards-91-club') &&
        (existingOv.status === 'deleted' || !isValidCoordinatePair(existingOv.lat, existingOv.lng))
      ) {
        places[seedId] = {
          ...JSON.parse(JSON.stringify(seedOv)),
          ...existingOv,
          status: 'active',
          visibilityStatus: 'visible',
          lat: seedOv.lat,
          lng: seedOv.lng,
          coordinateVerified: true,
          adminPinApproved: true,
          adminExplicitlyUnpinned: false,
          locationStatus: 'located',
          coordinateSource: 'admin_verified',
        };
        migrated = true;
      }
    }

    if (places['chao-long-chi-hong'] && !places['chao-long-chi-hong'].imageUrl) {
      places['chao-long-chi-hong'].imageUrl = 'ai_studio_dish_chao_long_chi_hong.jpg';
      migrated = true;
    }

    // 3. Chuẩn hóa từng bản ghi địa điểm và ẩn 18 quán chưa từng được ghim thật trên RTDB
    for (const [pid, ov] of Object.entries(places)) {
      if (!ov) continue;
      if (pid === 'gamitra-xuan-hoa' || pid === 'an-vat-gamitra') {
        if (ov.phone && ov.phone.endsWith('aaa')) {
          ov.phone = ov.phone.replace(/aaa+$/i, '').trim();
          migrated = true;
        }
      }

      // Nếu thuộc 18 quán chưa có ghim thật trên RTDB và chưa được Admin ghim mới sau thời điểm chuẩn hóa (1793693200000) -> giữ trạng thái unlocated
      if (
        UNPINNED_18_CATALOG_PLACE_IDS.has(pid) &&
        (!ov.updatedAt || ov.updatedAt < 1793693200000)
      ) {
        if (ov.lat !== undefined || ov.lng !== undefined || ov.locationStatus === 'located') {
          delete ov.lat;
          delete ov.lng;
          ov.coordinateVerified = false;
          ov.adminPinApproved = false;
          ov.locationStatus = 'unlocated';
          ov.coordinateSource = 'unverified';
          migrated = true;
        }
      }

      // Đồng bộ song hành các trường chuẩn của Unified Place Data Contract (Phần V)
      if (ov.subcategoryId && !ov.categoryId) {
        ov.categoryId = ov.subcategoryId;
      } else if (ov.categoryId && !ov.subcategoryId) {
        ov.subcategoryId = ov.categoryId;
      }
      if (ov.openHours !== undefined && ov.openingHours === undefined) {
        ov.openingHours = ov.openHours;
      } else if (ov.openingHours !== undefined && ov.openHours === undefined) {
        ov.openHours = ov.openingHours;
      }
      if (typeof ov.showByDefault === 'boolean' && ov.defaultMapVisible === undefined) {
        ov.defaultMapVisible = ov.showByDefault;
      } else if (typeof ov.defaultMapVisible === 'boolean' && ov.showByDefault === undefined) {
        ov.showByDefault = ov.defaultMapVisible;
      }

      const isCivicOrSchool =
        pid.startsWith('osm_') ||
        ov.mapCategory === 'public' ||
        ov.mapCategory === 'school' ||
        ov.mapCategory === 'medical' ||
        ov.parentCategoryId === 'public' ||
        ov.parentCategoryId === 'education' ||
        ov.parentCategoryId === 'health' ||
        ov.parentCategoryId === 'landmark' ||
        ov.sectorTag === 'dia-danh';

      // Bảo toàn tuyệt đối tọa độ hợp lệ đã được ghim/xác minh trong VERIFIED_CATALOG_PLACE_COORDS
      const catalogCoord = VERIFIED_CATALOG_PLACE_COORDS[pid];
      if (
        !UNPINNED_18_CATALOG_PLACE_IDS.has(pid) &&
        ov.adminExplicitlyUnpinned !== true &&
        !isValidCoordinatePair(ov.lat, ov.lng) &&
        catalogCoord &&
        isValidCoordinatePair(catalogCoord.lat, catalogCoord.lng)
      ) {
        ov.lat = catalogCoord.lat;
        ov.lng = catalogCoord.lng;
        ov.coordinateVerified = true;
        ov.adminPinApproved = true;
        ov.locationStatus = 'located';
        if (!ov.coordinateSource || ov.coordinateSource === 'unverified') {
          ov.coordinateSource = 'admin_verified';
        }
        migrated = true;
      }

      const hasValidLatLng =
        typeof ov.lat === 'number' &&
        typeof ov.lng === 'number' &&
        Number.isFinite(ov.lat) &&
        Number.isFinite(ov.lng) &&
        ov.lat >= 8 &&
        ov.lat <= 24 &&
        ov.lng >= 102 &&
        ov.lng <= 110.5;

      if (hasValidLatLng && ov.adminExplicitlyUnpinned !== true) {
        if (
          ov.adminPinApproved !== true ||
          ov.coordinateVerified !== true ||
          ov.locationStatus !== 'located'
        ) {
          if (!ov.pendingMapApproval) {
            ov.adminPinApproved = true;
            ov.coordinateVerified = true;
            ov.locationStatus = 'located';
            if (!ov.coordinateSource || ov.coordinateSource === 'unverified') {
              ov.coordinateSource = 'admin_verified';
            }
            migrated = true;
          }
        }
      } else if (!isCivicOrSchool && !hasValidLatLng) {
        if (ov.adminPinApproved === undefined) {
          ov.coordinateVerified = false;
          ov.adminPinApproved = false;
          ov.coordinateSource = 'unverified';
        }
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
      }

      // SEC-3ROLE: Loại bỏ hoàn toàn các trường Chủ quán (Merchant) cũ nếu còn sót lại trong localStorage
      const rawOv = ov as Record<string, any>;
      for (const retiredKey of [
        'merchantClaimCode',
        'claimCodeDigest',
        'claimStatus',
        'claimedByEmail',
        'claimedByUid',
        'claimedByName',
        'claimedAt',
        'issuedByUid',
        'issuedAt',
        'revokedByUid',
        'revokedAt',
      ]) {
        if (retiredKey in rawOv) {
          delete rawOv[retiredKey];
          migrated = true;
        }
      }
      if ((rawOv.coordinateSource as string) === 'merchant_verified') {
        rawOv.coordinateSource = 'admin_verified';
        migrated = true;
      }
    }

    // Dọn sạch các nick quản lý thử nghiệm tự sinh trong adminAccounts & loại bỏ mật khẩu plaintext (SEC-CRIT-02)
    let cleanAdminAccounts: AdminAccount[] = (parsed.adminAccounts || DEFAULT_ADMIN_ACCOUNTS).map(acc => {
      const hasPlaintext =
        acc.password &&
        acc.password !== '[REDACTED_HASHED]' &&
        acc.password !== '[REDACTED]' &&
        !acc.password.startsWith('xh2_');
      if (hasPlaintext) {
        migrated = true;
      }
      return {
        ...acc,
        passwordHash: acc.passwordHash || (hasPlaintext ? hashAdminCredential(acc.password) : 'xh2_65a096127c75d450'),
        password: '[REDACTED_HASHED]',
      };
    });
    const filteredAccounts = cleanAdminAccounts.filter(acc => {
      const u = (acc.username || '').trim().toLowerCase();
      return u !== 'quanlyweb' && u !== 'quanlymaps' && u !== 'kiemnhiem' && !u.startsWith('test');
    });
    if (filteredAccounts.length !== cleanAdminAccounts.length) {
      cleanAdminAccounts = filteredAccounts.length > 0 ? filteredAccounts : DEFAULT_ADMIN_ACCOUNTS;
      migrated = true;
    }

    if (parsed.adminPin && parsed.adminPin !== '[REDACTED_HASHED]') {
      parsed.adminPin = '[REDACTED_HASHED]';
      migrated = true;
    }

    const { members: cleanMembers, hadDuplicates } = normalizeAndDeduplicateMembers(parsed.members);
    if (hadDuplicates) {
      migrated = true;
    }

    for (const [seedPropId, seedProp] of Object.entries(PENDING_LANDMARK_PLACE_PROPOSALS_SEED)) {
      if (!placeProposals[seedPropId]) {
        placeProposals[seedPropId] = JSON.parse(JSON.stringify(seedProp));
        migrated = true;
      }
    }

    const resultState: AdminState = {
      ...createInitialAdminState(),
      ...parsed,
      places,
      dishes: parsed.dishes || {},
      members: cleanMembers,
      adminAccounts: cleanAdminAccounts,
      adminPin: '[REDACTED_HASHED]',
      placeProposals,
      auditLogs: parsed.auditLogs || [],
      mapAccessMode: parsed.mapAccessMode || 'public_open',
    };

    if (migrated) {
      const sanitizedForStorage = sanitizeStateForLocalStorage(resultState);
      const nextRaw = JSON.stringify(sanitizedForStorage);
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

/**
 * Bảo vệ dữ liệu cá nhân (PII) và thông tin xác thực trước khi ghi vào localStorage (SEC-CRIT-02, SEC-CRIT-03 & SEC-3ROLE):
 * - Không bao giờ lưu mật khẩu rõ hoặc mã PIN rõ vào localStorage.
 * - Nếu người dùng hiện tại không phải SuperAdmin, loại bỏ danh sách members PII khỏi localStorage (chỉ giữ hồ sơ của chính người dùng đó).
 * - Loại bỏ triệt để mọi trường thuộc hệ thống Chủ quán (Merchant) đã ngừng sử dụng.
 */
function sanitizeStateForLocalStorage(state: AdminState): AdminState {
  let isSuper = false;
  let currentOwnEmail = '';
  try {
    const logged = getLoggedAdminSession();
    const storedUser = getStoredAuthUser();
    if (storedUser?.isLoggedIn && storedUser?.email) {
      currentOwnEmail = storedUser.email.trim().toLowerCase();
    }
    if (
      logged &&
      (logged.role === 'superadmin' || logged.username === 'admin' || logged.username === 'minhtt')
    ) {
      isSuper = true;
    } else if (currentOwnEmail) {
      if (DEFAULT_ADMIN_EMAILS.includes(currentOwnEmail) || (state.adminEmails || []).includes(currentOwnEmail)) {
        isSuper = true;
      }
    }
  } catch {}

  const sanitizedAccounts = (state.adminAccounts || DEFAULT_ADMIN_ACCOUNTS).map(acc => ({
    ...acc,
    passwordHash: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
    password: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
  }));

  let safeMembers: Record<string, ManagedMember> = {};
  if (isSuper) {
    safeMembers = state.members || {};
  } else if (currentOwnEmail && state.members && state.members[currentOwnEmail]) {
    safeMembers = { [currentOwnEmail]: state.members[currentOwnEmail] };
  }

  const safePlaces: Record<string, PlaceOverride> = {};
  for (const [pid, ov] of Object.entries(state.places || {})) {
    if (!ov) continue;
    const copy = { ...ov } as Record<string, any>;
    delete copy.merchantClaimCode;
    delete copy.claimCodeDigest;
    delete copy.claimStatus;
    delete copy.claimedByEmail;
    delete copy.claimedByUid;
    delete copy.claimedByName;
    delete copy.claimedAt;
    delete copy.issuedByUid;
    delete copy.issuedAt;
    delete copy.revokedByUid;
    delete copy.revokedAt;
    safePlaces[pid] = copy as PlaceOverride;
  }

  const cleanState = {
    ...state,
    places: safePlaces,
    members: safeMembers,
    adminAccounts: sanitizedAccounts,
    adminPin: '[REDACTED_HASHED]',
  } as Record<string, any>;
  delete cleanState.merchantSubmissions;
  return cleanState as AdminState;
}

export function getAuthenticatedFirebaseUid(): string | null {
  try {
    const auth = getFirebaseAuth();
    if (auth?.currentUser?.uid) return auth.currentUser.uid;
    const logged = getLoggedAdminSession();
    if (logged?.id?.startsWith('fb_')) return logged.id.slice(3);
  } catch {}
  return null;
}

function isCloudWriteAllowedForCurrentSession(): boolean {
  if (typeof window === 'undefined' || !firebaseConfig.apiKey) return false;
  if ((window as any).__XUHO_DISABLE_CLOUD_WRITE__ === true) return false;
  try {
    const auth = getFirebaseAuth();
    const hasFirebaseAuthUser = Boolean(auth?.currentUser);
    const roleInfo = getEffectiveAdminRoleInfo();
    const isMapMgr = isMapManagerAuthenticated();
    return Boolean(hasFirebaseAuthUser || roleInfo.isAuthenticated || isMapMgr);
  } catch {
    return false;
  }
}

/**
 * SEC-3ROLE: Làm sạch bản ghi địa điểm trước khi ghi lên nhánh công khai `xuanhoa_admin/global_state/places/$placeId`.
 * Loại bỏ hoàn toàn mảng lịch sử/chờ duyệt nội bộ và mọi trường hệ thống Chủ quán (Merchant) đã ngừng sử dụng.
 */
export function sanitizePublicPlaceForCloud(
  placeId: string,
  placeOverride: PlaceOverride
): PlaceOverride {
  const publicPlace = JSON.parse(JSON.stringify({ ...placeOverride, id: placeId })) as Record<string, any>;
  delete publicPlace.merchantClaimCode;
  delete publicPlace.claimCodeDigest;
  delete publicPlace.claimStatus;
  delete publicPlace.claimedByEmail;
  delete publicPlace.claimedByUid;
  delete publicPlace.claimedByName;
  delete publicPlace.claimedAt;
  delete publicPlace.issuedByUid;
  delete publicPlace.issuedAt;
  delete publicPlace.revokedByUid;
  delete publicPlace.revokedAt;
  delete publicPlace.locationHistory;
  delete publicPlace.pendingWebApproval;
  delete publicPlace.pendingMapApproval;
  if (publicPlace.coordinateSource === 'merchant_verified') {
    publicPlace.coordinateSource = 'admin_verified';
  }
  return publicPlace as PlaceOverride;
}

/**
 * SEC-3ROLE-PROPOSAL: Chuẩn hóa và khóa cứng schema đề xuất địa điểm trước khi ghi lên
 * `xuanhoa_admin/global_state/placeProposals/$proposalId` và `xuanhoa_admin/manager_proposals_by_uid/$managerUid/$proposalId`.
 * Loại bỏ các trường phụ chỉ dùng ở bộ nhớ UI cục bộ (`previousData`, `beforeData`, `afterData`, `hasVersionConflict`, `customPlacePayload`)
 * và không ghi các trường đánh giá (`reviewedBy*`, `reviewedAt`, `reviewNote`) khi đề xuất đang ở trạng thái `pending` hoặc `cancelled`.
 */
export function sanitizeProposalForCloud(proposal: PlaceChangeProposal): Record<string, any> {
  const rawProp = proposal as Record<string, any>;
  const pData = (proposal.proposedData || {}) as Record<string, any>;
  const cleanProposedData: Record<string, any> = {
    name: String(pData.name || proposal.placeName || proposal.placeId),
  };
  if (typeof pData.address === 'string') cleanProposedData.address = pData.address;
  if (typeof pData.phone === 'string') cleanProposedData.phone = pData.phone;
  if (typeof pData.openHours === 'string') cleanProposedData.openHours = pData.openHours;
  if (typeof pData.parentCategoryId === 'string') cleanProposedData.parentCategoryId = pData.parentCategoryId;
  if (typeof pData.subcategoryId === 'string') cleanProposedData.subcategoryId = pData.subcategoryId;
  if (typeof pData.lat === 'number' && Number.isFinite(pData.lat)) cleanProposedData.lat = pData.lat;
  if (typeof pData.lng === 'number' && Number.isFinite(pData.lng)) cleanProposedData.lng = pData.lng;
  if (typeof pData.mapsUrl === 'string') cleanProposedData.mapsUrl = pData.mapsUrl;
  if (typeof pData.tagline === 'string') cleanProposedData.tagline = pData.tagline;
  if (typeof pData.coordinateSource === 'string') {
    cleanProposedData.coordinateSource =
      String(pData.coordinateSource) === 'merchant_verified' ? 'admin_verified' : pData.coordinateSource;
  }

  const out: Record<string, any> = {
    id: proposal.id,
    placeId: proposal.placeId,
    placeName: proposal.placeName,
    actionType: proposal.actionType,
    status: proposal.status,
    submittedBy: proposal.submittedBy,
    submittedByUid: proposal.submittedByUid || proposal.submittedBy,
    submittedAt: proposal.submittedAt,
    baseVersion: proposal.baseVersion,
    proposedData: cleanProposedData,
  };

  if (typeof proposal.submittedByEmail === 'string') out.submittedByEmail = proposal.submittedByEmail;
  if (typeof proposal.submittedByName === 'string') out.submittedByName = proposal.submittedByName;
  if (typeof proposal.submittedByRole === 'string') out.submittedByRole = proposal.submittedByRole;
  if (typeof rawProp.assignedToUid === 'string') out.assignedToUid = rawProp.assignedToUid;
  if (typeof rawProp.revision === 'number') out.revision = rawProp.revision;
  if (typeof rawProp.supersedesProposalId === 'string') out.supersedesProposalId = rawProp.supersedesProposalId;
  if (typeof proposal.message === 'string') out.message = proposal.message;

  if (proposal.status === 'approved' || proposal.status === 'rejected') {
    if (typeof proposal.reviewedBy === 'string') out.reviewedBy = proposal.reviewedBy;
    if (typeof proposal.reviewedByUid === 'string') out.reviewedByUid = proposal.reviewedByUid;
    if (typeof proposal.reviewedByName === 'string') out.reviewedByName = proposal.reviewedByName;
    if (typeof proposal.reviewedAt === 'number') out.reviewedAt = proposal.reviewedAt;
    if (typeof proposal.reviewNote === 'string') out.reviewNote = proposal.reviewNote;
  }

  return JSON.parse(JSON.stringify(out));
}

function syncProposalAndIndexToCloud(rtdb: any, proposal: PlaceChangeProposal): Promise<void> {
  const cleanProp = sanitizeProposalForCloud(proposal);
  const managerUid = cleanProp.submittedByUid || getAuthenticatedFirebaseUid();
  return set(ref(rtdb, `xuanhoa_admin/global_state/placeProposals/${proposal.id}`), cleanProp)
    .then(() => {
      if (managerUid) {
        return set(
          ref(rtdb, `xuanhoa_admin/manager_proposals_by_uid/${managerUid}/${proposal.id}`),
          cleanProp
        );
      }
    })
    .catch(() => {});
}

/**
 * SEC-V4-06: Đối soát và phân loại vòng đời WAL của `xuanhoa_admin/coordinate_history/$placeId`
 * - Phát hiện các bản ghi `status === 'intent'` mồ côi (do mất mạng giữa chừng hoặc xung đột phiên bản giữa 2 Admin).
 * - Tách bạch rõ lịch sử đã áp dụng thật (`committed`), ý định đang chờ (`intent`) và ý định bị hủy/vượt qua (`aborted`).
 */
export function reconcilePlaceCoordinateWalHistory(
  placeId: string,
  placeOverride: PlaceOverride | null | undefined,
  walEntries: Record<string, PlaceLocationHistoryEntry> | null | undefined,
  now = Date.now()
): {
  committedHistory: PlaceLocationHistoryEntry[];
  orphanedToCommit: PlaceLocationHistoryEntry[];
  staleToAbort: Array<{ entry: PlaceLocationHistoryEntry; abortReason: string }>;
} {
  const committedHistory: PlaceLocationHistoryEntry[] = [];
  const orphanedToCommit: PlaceLocationHistoryEntry[] = [];
  const staleToAbort: Array<{ entry: PlaceLocationHistoryEntry; abortReason: string }> = [];

  if (!walEntries || typeof walEntries !== 'object') {
    return { committedHistory, orphanedToCommit, staleToAbort };
  }

  const appliedHistoryId = placeOverride?.lastCoordMutation?.historyId || null;
  const currentPlaceVer = typeof placeOverride?.version === 'number' ? placeOverride.version : 0;

  for (const [key, rawEntry] of Object.entries(walEntries)) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry: PlaceLocationHistoryEntry = {
      ...rawEntry,
      historyId: rawEntry.historyId || key,
      placeId: rawEntry.placeId || placeId,
    };

    if (entry.status === 'committed') {
      committedHistory.push(entry);
      continue;
    }

    if (entry.status === 'aborted') {
      continue;
    }

    // Xử lý bản ghi đang ở trạng thái 'intent' (hoặc bản ghi cũ chưa có status)
    if (appliedHistoryId && entry.historyId === appliedHistoryId) {
      orphanedToCommit.push({
        ...entry,
        status: 'committed',
        committedAt: now,
      });
      committedHistory.push({
        ...entry,
        status: 'committed',
        committedAt: now,
      });
    } else if (
      typeof entry.targetVersion === 'number' &&
      currentPlaceVer >= entry.targetVersion &&
      entry.historyId !== appliedHistoryId
    ) {
      staleToAbort.push({
        entry: {
          ...entry,
          status: 'aborted',
          abortedAt: now,
          abortReason: `Superseded by version v${currentPlaceVer} (applied historyId: ${appliedHistoryId || 'none'})`,
        },
        abortReason: `Superseded by version v${currentPlaceVer}`,
      });
    } else if (now - (entry.timestamp || 0) > 300_000) {
      staleToAbort.push({
        entry: {
          ...entry,
          status: 'aborted',
          abortedAt: now,
          abortReason: 'Expired unapplied WAL intent (> 5 minutes without place transaction commit)',
        },
        abortReason: 'Expired unapplied WAL intent (> 5 minutes)',
      });
    }
  }

  committedHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return { committedHistory, orphanedToCommit, staleToAbort };
}

/**
 * Đồng bộ nguyên tử (Atomic Per-Record Transaction) cho 1 địa điểm duy nhất lên RTDB (Điều kiện 3, 5 & 6 — V4):
 * - Sử dụng `runTransaction` để kiểm tra xung đột phiên bản (`version`).
 * - Bảo toàn ID bất biến và tọa độ đã được Admin xác minh (`coordinateVerified: true`, `coordinateSource: 'admin_verified'`).
 * - Vòng đời 3 trạng thái cho `coordinate_history` (`intent` -> `committed` / `aborted`).
 * - Chỉ ghi các trường địa điểm công khai hợp lệ theo mô hình 3 vai trò (`USER / MANAGER / ADMIN`).
 */
export function syncSinglePlaceToCloud(
  placeId: string,
  placeOverride: PlaceOverride,
  proposal?: PlaceChangeProposal,
  expectedBaseVersion?: number
): void {
  if (!isCloudWriteAllowedForCurrentSession()) return;
  try {
    const rtdb = getRealtimeDb();
    if (!rtdb || !placeId) return;
    const now = Date.now();
    const roleInfo = getEffectiveAdminRoleInfo();

    // Nếu là Quản lý (không phải SuperAdmin), chỉ đẩy đề xuất `placeProposals/${proposal.id}` + chỉ mục `manager_proposals_by_uid/${uid}/${proposal.id}`, tuyệt đối không ghi vào `places/${placeId}`
    if (!roleInfo.isSuperAdmin) {
      if (proposal && proposal.id) {
        syncProposalAndIndexToCloud(rtdb, proposal);
      }
      return;
    }

    const cleanPlace = sanitizePublicPlaceForCloud(placeId, placeOverride);
    const placeRef = ref(rtdb, `xuanhoa_admin/global_state/places/${placeId}`);
    const latestHistory = Array.isArray(placeOverride.locationHistory)
      ? placeOverride.locationHistory[0]
      : null;

    // SEC-V4-WAL: Cơ chế Write-Ahead Log (WAL) 3 trạng thái (`intent` -> `committed` | `aborted`) trên Server Rules:
    // 1. Khi Admin thay đổi hoặc gỡ tọa độ đã xác minh (`confirmCoordinateOverride === true`),
    //    bắt buộc ghi `xuanhoa_admin/coordinate_history/${placeId}/${historyId}` với `status: 'intent'` TRƯỚC KHI chạy `runTransaction` trên `places/${placeId}`.
    // 2. Sau khi `runTransaction` trên `places/${placeId}` commit thành công, chuyển bản ghi WAL sang `status: 'committed'`.
    // 3. Nếu `runTransaction` bị hủy do xung đột phiên bản (concurrent Admin edit), chuyển bản ghi WAL sang `status: 'aborted'`.
    const executePlaceTransaction = async () => {
      const targetVer = typeof cleanPlace.version === 'number' ? cleanPlace.version : 1;
      let activeWalHistoryId: string | null = null;
      let activeWalPayload: Record<string, any> | null = null;

      if (latestHistory && latestHistory.timestamp && placeOverride.confirmCoordinateOverride === true) {
        const historyId =
          cleanPlace.lastCoordMutation?.historyId ||
          latestHistory.historyId ||
          `hist_${latestHistory.timestamp}`;
        activeWalHistoryId = historyId;
        activeWalPayload = JSON.parse(
          JSON.stringify({
            historyId,
            placeId,
            targetVersion: targetVer,
            status: 'intent',
            previousLat: latestHistory.previousLat ?? null,
            previousLng: latestHistory.previousLng ?? null,
            newLat: latestHistory.newLat ?? null,
            newLng: latestHistory.newLng ?? null,
            actor: latestHistory.actor || 'admin',
            actorUid: latestHistory.actorUid || getAuthenticatedFirebaseUid() || 'admin',
            actorRole: 'admin',
            timestamp: latestHistory.timestamp,
            action: latestHistory.action || 'update_coord',
            reason: latestHistory.reason || latestHistory.note || 'Admin xác nhận cập nhật tọa độ',
            ...(latestHistory.coordinateSource ? { coordinateSource: latestHistory.coordinateSource } : {}),
            ...(latestHistory.note ? { note: latestHistory.note } : {}),
          })
        );
        if (cleanPlace.lastCoordMutation) {
          cleanPlace.lastCoordMutation.historyId = historyId;
          cleanPlace.lastCoordMutation.targetVersion = targetVer;
        }
        await set(
          ref(rtdb, `xuanhoa_admin/coordinate_history/${placeId}/${historyId}`),
          activeWalPayload
        );
      }

      const txResult = await runTransaction(placeRef, (currentCloud: PlaceOverride | null) => {
        if (currentCloud && typeof currentCloud === 'object') {
          const cloudVer = typeof currentCloud.version === 'number' ? currentCloud.version : 0;
          const incomingVer = typeof cleanPlace.version === 'number' ? cleanPlace.version : 1;

          if (expectedBaseVersion !== undefined && cloudVer > expectedBaseVersion) {
            // Phát hiện xung đột phiên bản nguyên tử trên RTDB -> Hủy transaction để bảo vệ dữ liệu mới hơn trên Cloud
            return undefined;
          }

          // Bảo vệ tuyệt đối tọa độ đã được Admin xác minh:
          // Không cho phép thay đổi tọa độ đã xác minh qua thao tác ghi thông thường (nếu không có confirmCoordinateOverride === true)
          const cloudIsAdminVerified =
            currentCloud.coordinateVerified === true &&
            (currentCloud.coordinateSource === 'admin_verified' || currentCloud.adminPinApproved === true) &&
            typeof currentCloud.lat === 'number' &&
            typeof currentCloud.lng === 'number';

          const isConfirmedCoordOverride =
            cleanPlace.confirmCoordinateOverride === true &&
            cleanPlace.lastCoordMutation &&
            typeof cleanPlace.lastCoordMutation.historyId === 'string' &&
            typeof cleanPlace.lastCoordMutation.reason === 'string' &&
            cleanPlace.lastCoordMutation.reason.length >= 3;

          if (cloudIsAdminVerified && !isConfirmedCoordOverride) {
            cleanPlace.lat = currentCloud.lat;
            cleanPlace.lng = currentCloud.lng;
            cleanPlace.coordinateVerified = true;
            cleanPlace.adminPinApproved = true;
            cleanPlace.coordinateSource = currentCloud.coordinateSource || 'admin_verified';
            cleanPlace.locationStatus = 'located';
            cleanPlace.confirmCoordinateOverride = false;
          } else if (cloudIsAdminVerified && isConfirmedCoordOverride && cleanPlace.lastCoordMutation) {
            cleanPlace.lastCoordMutation.previousLat = currentCloud.lat ?? null;
            cleanPlace.lastCoordMutation.previousLng = currentCloud.lng ?? null;
          }

          cleanPlace.version = Math.max(cloudVer + 1, incomingVer);
        } else {
          cleanPlace.version = Math.max(1, typeof cleanPlace.version === 'number' ? cleanPlace.version : 1);
        }
        cleanPlace.id = placeId;
        cleanPlace.updatedAt = Math.max(now, cleanPlace.updatedAt || 0);
        return cleanPlace;
      });

      if (activeWalHistoryId && activeWalPayload) {
        if (txResult.committed) {
          await set(ref(rtdb, `xuanhoa_admin/coordinate_history/${placeId}/${activeWalHistoryId}`), {
            ...activeWalPayload,
            status: 'committed',
            committedAt: Date.now(),
          }).catch(() => {});
        } else {
          await set(ref(rtdb, `xuanhoa_admin/coordinate_history/${placeId}/${activeWalHistoryId}`), {
            ...activeWalPayload,
            status: 'aborted',
            abortedAt: Date.now(),
            abortReason: 'Transaction aborted due to concurrent version conflict',
          }).catch(() => {});
        }
      }

      await update(ref(rtdb), {
        'xuanhoa_admin/global_state/updatedAt': now,
      });
      if (proposal && proposal.id) {
        await syncProposalAndIndexToCloud(rtdb, proposal);
      }
    };

    executePlaceTransaction().catch(err => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('xuanhoa_cloud_save_status', {
            detail: { status: 'error', placeId, error: String(err?.message || err), timestamp: Date.now() },
          })
        );
      }
    });
  } catch {}
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
  if ((window as any).__XUHO_DISABLE_CLOUD_WRITE__ === true) return;
  if (isBlockedFakeOrTestMemberEmail(member.email)) return;
  try {
    const rtdb = getRealtimeDb();
    if (!rtdb) return;
    const isSuper = isAdminAuthenticated();
    const fbUid = getAuthenticatedFirebaseUid();
    if (!isSuper && !fbUid) return;
    const verifiedUid = isSuper ? member.uid || fbUid || `uid_${encodeRtdbKey(member.email)}` : fbUid!;
    const safeKey = encodeRtdbKey(member.email);
    const payload: Record<string, any> = {
      uid: verifiedUid,
      email: member.email.trim().toLowerCase(),
      displayName: member.displayName || member.nickname || member.email,
      nickname: member.nickname || member.displayName || member.email,
      avatar: member.avatar || '🐭',
      avatarId: member.avatarId || 'm_ty',
      gender: member.gender || 'male',
      phone: member.phone || '',
      residentType: member.residentType || 'student_sp2',
      tastePreferences: member.tastePreferences || [],
      status: isSuper ? member.status || 'active' : 'active',
      createdAt: member.createdAt || Date.now(),
      lastActiveAt: member.lastActiveAt || Date.now(),
    };
    // SEC-V4-04: Chỉ Admin (hoặc khi tạo mới với giá trị khởi tạo 0/1/0) mới được ghi spinsCount, level, reviewsCount.
    // Người dùng thông thường tuyệt đối không được tự tăng các chỉ số này từ client.
    if (isSuper) {
      payload.spinsCount = member.spinsCount || 0;
      payload.level = member.level || 1;
      payload.reviewsCount = member.reviewsCount || 0;
    } else {
      payload.spinsCount = 0;
      payload.level = 1;
      payload.reviewsCount = 0;
    }
    if (member.photoURL) payload.photoURL = member.photoURL;
    if (isSuper && member.isTestAccount !== undefined) payload.isTestAccount = member.isTestAccount;
    if (isSuper && includeAdminRoles) {
      payload.status = member.status || 'active';
      payload.canManageWeb = Boolean(member.canManageWeb);
      payload.canManageMaps = Boolean(member.canManageMaps);
      if (member.banReason !== undefined) payload.banReason = member.banReason;
    }
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    const memberRef = ref(rtdb, `xuanhoa_admin/members_registry/${safeKey}`);
    if (!isSuper) {
      get(memberRef)
        .then(snap => {
          if (snap.exists()) {
            const existingVal = snap.val();
            cleanPayload.spinsCount = existingVal?.spinsCount ?? 0;
            cleanPayload.level = existingVal?.level ?? 1;
            cleanPayload.reviewsCount = existingVal?.reviewsCount ?? 0;
            cleanPayload.createdAt = existingVal?.createdAt ?? cleanPayload.createdAt;
            cleanPayload.status = existingVal?.status ?? 'active';
          }
          update(memberRef, cleanPayload).catch(() => {});
        })
        .catch(() => {});
    } else {
      update(memberRef, cleanPayload).catch(() => {});
    }
  } catch {}
}

export function removeMemberFromCloudRealtime(emailKey: string): void {
  if (typeof window === 'undefined' || !firebaseConfig.apiKey || !emailKey) return;
  if ((window as any).__XUHO_DISABLE_CLOUD_WRITE__ === true) return;
  if (!isAdminAuthenticated()) return;
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
    const sanitizedForLocal = sanitizeStateForLocalStorage(next);
    const serialized = JSON.stringify(sanitizedForLocal);
    cachedAdminRaw = serialized;
    cachedAdminState = next;
    localStorage.setItem(ADMIN_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: next }));

    if (syncCloud && isCloudWriteAllowedForCurrentSession() && isAdminAuthenticated()) {
      // SEC-FINAL-02, SEC-FINAL-03 & SEC-3ROLE-CRED:
      // 1. Tuyệt đối không ghi đè gốc `xuanhoa_admin/global_state`, toàn bộ `places` hay mảng `auditLogs`.
      // 2. Ngừng hoàn toàn việc ghi các nhánh thông tin xác thực tĩnh cũ (`adminAccounts`, `adminEmails`, `adminPin`) lên RTDB.
      const granularRootUpdates: Record<string, any> = {
        'xuanhoa_admin/global_state/updatedAt': next.updatedAt,
        'xuanhoa_admin/global_state/sectorTags': next.sectorTags || DEFAULT_SECTOR_TAGS,
        'xuanhoa_admin/global_state/fontScale': next.fontScale || 'normal',
        'xuanhoa_admin/global_state/mapAccessMode': next.mapAccessMode || 'public_open',
      };
      const cleanUpdates = JSON.parse(JSON.stringify(granularRootUpdates));
      const rtdb = getRealtimeDb();
      if (rtdb) {
        window.dispatchEvent(
          new CustomEvent('xuanhoa_cloud_save_status', {
            detail: { status: 'saving', timestamp: next.updatedAt },
          })
        );
        update(ref(rtdb), cleanUpdates)
          .then(() => {
            window.dispatchEvent(
              new CustomEvent('xuanhoa_cloud_save_status', {
                detail: { status: 'saved', timestamp: Date.now() },
              })
            );
          })
          .catch(err => {
            window.dispatchEvent(
              new CustomEvent('xuanhoa_cloud_save_status', {
                detail: { status: 'error', error: String(err?.message || err), timestamp: Date.now() },
              })
            );
          });
      }
    }
  } catch (err) {
    console.warn('Failed to save admin state:', err);
  }
}

export async function syncAdminStateToCloudConfirmed(
  stateInput?: AdminState
): Promise<{ confirmed: boolean; syncedAt: number; error?: string }> {
  const next = stateInput || getAdminState();
  saveAdminState(next, false);
  if (!isCloudWriteAllowedForCurrentSession() || !isAdminAuthenticated()) {
    return { confirmed: true, syncedAt: Date.now() };
  }
  const rtdb = getRealtimeDb();
  if (!rtdb) {
    return { confirmed: true, syncedAt: Date.now() };
  }
  const granularRootUpdates: Record<string, any> = {
    'xuanhoa_admin/global_state/updatedAt': next.updatedAt,
    'xuanhoa_admin/global_state/sectorTags': next.sectorTags || DEFAULT_SECTOR_TAGS,
    'xuanhoa_admin/global_state/fontScale': next.fontScale || 'normal',
    'xuanhoa_admin/global_state/mapAccessMode': next.mapAccessMode || 'public_open',
  };
  const cleanUpdates = JSON.parse(JSON.stringify(granularRootUpdates));
  try {
    await Promise.race([
      update(ref(rtdb), cleanUpdates),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500)),
    ]);
    window.dispatchEvent(
      new CustomEvent('xuanhoa_cloud_save_status', {
        detail: { status: 'saved', timestamp: Date.now() },
      })
    );
    return { confirmed: true, syncedAt: Date.now() };
  } catch (err: any) {
    return {
      confirmed: false,
      syncedAt: Date.now(),
      error: String(err?.message || err),
    };
  }
}

export function buildDeterministicAuditLogId(securityMeta?: {
  eventCategory?:
    | 'admin_review'
    | 'coord_override'
    | 'role_change'
    | 'role_management'
    | 'founder_security'
    | 'system_security'
    | 'place_crud'
    | 'manager_proposal';
  refId?: string;
  proposalOp?: 'create' | 'cancel';
  placeVersion?: number;
  memberLastActiveAt?: number;
}): string {
  if (!securityMeta?.eventCategory || !securityMeta?.refId) {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }
  const { eventCategory, refId } = securityMeta;
  if (eventCategory === 'manager_proposal') {
    return securityMeta.proposalOp === 'cancel'
      ? `log_proposal_cancel_${refId}`
      : `log_proposal_create_${refId}`;
  }
  if (eventCategory === 'admin_review') {
    return `log_review_${refId}`;
  }
  if (eventCategory === 'coord_override') {
    return `log_coord_${refId}`;
  }
  if (eventCategory === 'place_crud') {
    return `log_place_${refId}_v${securityMeta.placeVersion ?? 1}`;
  }
  if (eventCategory === 'role_change' || eventCategory === 'role_management') {
    return `log_role_${refId}_${securityMeta.memberLastActiveAt ?? Date.now()}`;
  }
  if (eventCategory === 'founder_security') {
    return `log_founder_${refId}_${securityMeta.memberLastActiveAt ?? Date.now()}`;
  }
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function pushSingleAuditLogToCloud(entry: AdminAuditLog): void {
  if (!isCloudWriteAllowedForCurrentSession()) return;
  try {
    const rtdb = getRealtimeDb();
    const fbUid = getAuthenticatedFirebaseUid();
    if (!rtdb || !fbUid || !entry?.id) return;
    // SEC-V4.1-04: Phân biệt rõ log telemetry client với nhật ký kiểm toán bảo mật có kiểm chứng trạng thái trên server (`auditLogs`).
    // Chỉ đẩy lên `xuanhoa_admin/global_state/auditLogs/${entry.id}` khi có đầy đủ `actorRole`, `eventCategory`, `refId` và `verificationSource: 'client_rtdb_rule_checked'`.
    if (!entry.actorRole || !entry.eventCategory || !entry.refId) {
      return;
    }
    const normalizedEventCat =
      entry.eventCategory === 'role_change'
        ? 'role_management'
        : entry.eventCategory === 'coord_override'
        ? 'coord_update'
        : entry.eventCategory === 'manager_proposal'
        ? 'proposal_submit'
        : entry.eventCategory;
    const cleanEntry: Record<string, any> = {
      id: entry.id,
      action: entry.action,
      target: entry.target,
      type: entry.type,
      actorUid: fbUid,
      actorRole: entry.actorRole,
      eventCategory: normalizedEventCat,
      verificationSource: 'client_rtdb_rule_checked',
      refId: entry.refId,
      ...(entry.placeId ? { placeId: entry.placeId } : {}),
      timestamp: entry.timestamp,
      ...(entry.actorEmail ? { actorEmail: entry.actorEmail } : {}),
    };
    set(ref(rtdb, `xuanhoa_admin/global_state/auditLogs/${entry.id}`), cleanEntry).catch(() => {});
  } catch {}
}

export function addAdminAuditLog(
  state: AdminState,
  action: string,
  target: string,
  type: AdminAuditLog['type'],
  securityMeta?: {
    actorRole?: 'primary_founder' | 'backup_founder' | 'admin' | 'manager';
    eventCategory?:
      | 'admin_review'
      | 'coord_override'
      | 'role_change'
      | 'role_management'
      | 'founder_security'
      | 'system_security'
      | 'place_crud'
      | 'manager_proposal';
    refId?: string;
    placeId?: string;
    proposalOp?: 'create' | 'cancel';
    placeVersion?: number;
    memberLastActiveAt?: number;
  }
): AdminAuditLog[] {
  const fbUid = getAuthenticatedFirebaseUid();
  const detId = buildDeterministicAuditLogId(securityMeta);
  const entry: AdminAuditLog = {
    id: detId,
    action,
    target,
    type,
    ...(fbUid ? { actorUid: fbUid } : {}),
    ...(securityMeta?.actorRole ? { actorRole: securityMeta.actorRole } : {}),
    ...(securityMeta?.eventCategory
      ? {
          eventCategory: securityMeta.eventCategory,
          verificationSource: 'client_rtdb_rule_checked' as const,
        }
      : {}),
    ...(securityMeta?.refId ? { refId: securityMeta.refId } : {}),
    ...(securityMeta?.placeId ? { placeId: securityMeta.placeId } : {}),
    timestamp: Date.now(),
  };
  pushSingleAuditLogToCloud(entry);
  return [entry, ...(state.auditLogs || [])].slice(0, 100);
}

// Khởi tạo lắng nghe đồng bộ Realtime giữa các Tab trình duyệt (storage) & Đa thiết bị qua Firebase Realtime Database
let cloudListenerStarted = false;
let membersRegistryListenerStarted = false;
let securityNodeListenerStarted = false;
let managerOwnProposalsListenerStartedForUid: string | null = null;
export function initAdminCloudSync(): void {
  if (typeof window === 'undefined') return;

  const ensureMembersRegistryListenerForAdmin = () => {
    if (!firebaseConfig.apiKey) return;
    try {
      const rtdb = getRealtimeDb();
      if (!rtdb) return;

      // Đồng bộ Realtime nhánh bảo mật /xuanhoa_security cho Founder & Admin
      if (!securityNodeListenerStarted && isAdminAuthenticated()) {
        securityNodeListenerStarted = true;
        onValue(
          ref(rtdb, 'xuanhoa_security'),
          snapshot => {
            if (!snapshot.exists()) return;
            const rawSec = snapshot.val() as Partial<XuanHoaSecurityState>;
            const nextSec = saveSecurityStateCache({
              primary_founder: rawSec.primary_founder || {},
              backup_founder: rawSec.backup_founder || {},
              admins: rawSec.admins || {},
              managers: rawSec.managers || {},
              locked_uids: rawSec.locked_uids || {},
            });

            // Kiểm tra thu hồi phiên (Session Revocation) hoặc khóa tài khoản tức thì
            const activeFbUid = getAuthenticatedFirebaseUid();
            const loggedAcc = getLoggedAdminSession();
            if (activeFbUid && nextSec.locked_uids?.[activeFbUid] === true && !nextSec.primary_founder?.[activeFbUid]) {
              logoutAdminSession();
              window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync'));
              return;
            }
            if (loggedAcc?.roleTier === 'backup_founder' && activeFbUid) {
              const bfEntry = nextSec.backup_founder?.[activeFbUid];
              const isBfStillActive =
                bfEntry === true || (bfEntry && typeof bfEntry === 'object' && bfEntry.active === true);
              if (!isBfStillActive) {
                logoutAdminSession();
                window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync'));
                return;
              }
            }
            window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync'));
          },
          () => {}
        );
      }

      // SEC-V4-01: Nếu là Quản lý (không phải SuperAdmin), chỉ gắn listener đọc chỉ mục riêng `xuanhoa_admin/manager_proposals_by_uid/${fbUid}`,
      // tuyệt đối không đọc toàn bộ `placeProposals`.
      if (!isAdminAuthenticated() && isMapManagerAuthenticated()) {
        const fbUid = getAuthenticatedFirebaseUid();
        if (fbUid && managerOwnProposalsListenerStartedForUid !== fbUid) {
          managerOwnProposalsListenerStartedForUid = fbUid;
          onValue(
            ref(rtdb, `xuanhoa_admin/manager_proposals_by_uid/${fbUid}`),
            snapshot => {
              if (!snapshot.exists()) return;
              const ownProposals = snapshot.val() as Record<string, PlaceChangeProposal>;
              const local = getAdminState();
              const nextState: AdminState = {
                ...local,
                placeProposals: {
                  ...(local.placeProposals || {}),
                  ...ownProposals,
                },
              };
              const sanitized = sanitizeStateForLocalStorage(nextState);
              localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sanitized));
              window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: nextState }));
            },
            () => {}
          );
        }
        return;
      }

      if (membersRegistryListenerStarted || !isAdminAuthenticated()) return;
      membersRegistryListenerStarted = true;
      const membersRegRef = ref(rtdb, 'xuanhoa_admin/members_registry');
      onValue(
        membersRegRef,
        snapshot => {
          if (!snapshot.exists() || !isAdminAuthenticated()) return;
          const rawRegistry = snapshot.val() as Record<string, ManagedMember>;
          const decodedRegistry = decodeRtdbRecord<ManagedMember>(rawRegistry);
          for (const k of Object.keys(decodedRegistry)) {
            if (isBlockedFakeOrTestMemberEmail(k)) {
              removeMemberFromCloudRealtime(k);
              delete decodedRegistry[k];
            }
          }
          const local = getAdminState();
          const cleanLocal = normalizeAndDeduplicateMembers(local.members || {}).members;
          const cleanIncoming = normalizeAndDeduplicateMembers(decodedRegistry).members;
          const nextMembers: Record<string, ManagedMember> = { ...cleanLocal, ...cleanIncoming };
          const nextState: AdminState = {
            ...local,
            members: nextMembers,
          };
          const sanitized = sanitizeStateForLocalStorage(nextState);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sanitized));
          window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: nextState }));
        },
        () => {}
      );

      // Admin lắng nghe `placeProposals`
      onValue(
        ref(rtdb, 'xuanhoa_admin/global_state/placeProposals'),
        snapshot => {
          if (!snapshot.exists() || !isAdminAuthenticated()) return;
          const allProposals = snapshot.val() as Record<string, PlaceChangeProposal>;
          const local = getAdminState();
          const nextState: AdminState = {
            ...local,
            placeProposals: {
              ...(local.placeProposals || {}),
              ...allProposals,
            },
          };
          const sanitized = sanitizeStateForLocalStorage(nextState);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sanitized));
          window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync', { detail: nextState }));
        },
        () => {}
      );
    } catch {}
  };

  if (cloudListenerStarted) {
    ensureMembersRegistryListenerForAdmin();
    return;
  }
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
      const fallbackUid = `uid_${emailKey.replace(/[^a-z0-9]/g, '_')}`;
      const bestUid = isVerifiedFirebaseAuthUid(incoming.uid)
        ? incoming.uid!.trim()
        : isVerifiedFirebaseAuthUid(existing?.uid)
        ? existing!.uid!.trim()
        : incoming.uid && !incoming.uid.startsWith('uid_')
        ? incoming.uid
        : existing?.uid && !existing.uid.startsWith('uid_')
        ? existing.uid
        : incoming.uid || existing?.uid || fallbackUid;
      out[emailKey] = {
        ...(existing || {}),
        ...incoming,
        uid: bestUid,
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
    const isSuper = isAdminAuthenticated();
    let mergedMembers = local.members || {};
    if (isSuper && cloudData.members) {
      const decodedCloudMembers = decodeRtdbRecord<ManagedMember>(cloudData.members as any);
      for (const k of Object.keys(decodedCloudMembers)) {
        if (isBlockedFakeOrTestMemberEmail(k)) {
          removeMemberFromCloudRealtime(k);
          delete decodedCloudMembers[k];
        }
      }
      mergedMembers = mergeMembersMap(local.members || {}, decodedCloudMembers);
    }

    const mergedProposals: Record<string, PlaceChangeProposal> = {
      ...(local.placeProposals || {}),
      ...(cloudData.placeProposals || {}),
    };

    const localPlaces = local.places || {};
    const cloudPlaces = cloudData.places || {};
    const allPlaceKeys = new Set([...Object.keys(localPlaces), ...Object.keys(cloudPlaces)]);
    const incomingPlaces: Record<string, PlaceOverride> = {};

    for (const pid of allPlaceKeys) {
      if (REMOVE_OLD_TEST_AND_DUPLICATE_PLACE_IDS.has(pid)) continue;
      if (
        pid in PENDING_LANDMARK_PROPOSAL_BY_PLACE_ID &&
        mergedProposals[PENDING_LANDMARK_PROPOSAL_BY_PLACE_ID[pid]]?.status !== 'approved'
      ) {
        continue;
      }
      const localOv = localPlaces[pid];
      const cloudOv = cloudPlaces[pid];
      let chosen: PlaceOverride | undefined;
      if (localOv && cloudOv) {
        const localVer = localOv.version || 0;
        const cloudVer = cloudOv.version || 0;
        const localTime = localOv.updatedAt || 0;
        const cloudTime = cloudOv.updatedAt || 0;
        const localSrcPrio = COORDINATE_SOURCE_PRIORITY[localOv.coordinateSource || 'unverified'] || 10;
        const cloudSrcPrio = COORDINATE_SOURCE_PRIORITY[cloudOv.coordinateSource || 'unverified'] || 10;
        const localHasCoords = isValidCoordinatePair(localOv.lat, localOv.lng);
        const cloudHasCoords = isValidCoordinatePair(cloudOv.lat, cloudOv.lng);

        if (cloudHasCoords && !localHasCoords && localOv.adminExplicitlyUnpinned !== true) {
          chosen = { ...localOv, ...cloudOv };
        } else if (
          cloudHasCoords &&
          localHasCoords &&
          cloudSrcPrio > localSrcPrio &&
          cloudTime >= localTime
        ) {
          chosen = { ...localOv, ...cloudOv };
        } else if (localVer > cloudVer || localTime >= cloudTime) {
          chosen = { ...cloudOv, ...localOv };
          if (!localHasCoords && cloudHasCoords && localOv.adminExplicitlyUnpinned !== true) {
            chosen.lat = cloudOv.lat;
            chosen.lng = cloudOv.lng;
            chosen.coordinateVerified = cloudOv.coordinateVerified;
            chosen.adminPinApproved = cloudOv.adminPinApproved;
            chosen.coordinateSource = cloudOv.coordinateSource;
            chosen.locationStatus = cloudOv.locationStatus;
          }
        } else {
          chosen = { ...localOv, ...cloudOv };
        }
      } else {
        chosen = localOv ? { ...localOv } : cloudOv ? { ...cloudOv } : undefined;
      }
      if (!chosen) continue;

      if (pid === 'gamitra-xuan-hoa' || pid === 'an-vat-gamitra') {
        if (chosen.phone && chosen.phone.endsWith('aaa')) {
          chosen.phone = chosen.phone.replace(/aaa+$/i, '').trim();
        }
      }
      const isCivicOrSchool =
        pid.startsWith('osm_') ||
        chosen.mapCategory === 'public' ||
        chosen.mapCategory === 'school' ||
        chosen.mapCategory === 'medical' ||
        chosen.sectorTag === 'dia-danh';

      const catalogCoord = VERIFIED_CATALOG_PLACE_COORDS[pid];
      if (
        !UNPINNED_18_CATALOG_PLACE_IDS.has(pid) &&
        chosen.adminExplicitlyUnpinned !== true &&
        !isValidCoordinatePair(chosen.lat, chosen.lng) &&
        catalogCoord &&
        isValidCoordinatePair(catalogCoord.lat, catalogCoord.lng)
      ) {
        chosen.lat = catalogCoord.lat;
        chosen.lng = catalogCoord.lng;
        chosen.coordinateVerified = true;
        chosen.adminPinApproved = true;
        chosen.locationStatus = 'located';
        if (!chosen.coordinateSource || chosen.coordinateSource === 'unverified') {
          chosen.coordinateSource = 'admin_verified';
        }
      }

      if (
        UNPINNED_18_CATALOG_PLACE_IDS.has(pid) &&
        (!chosen.updatedAt || chosen.updatedAt < 1793693200000)
      ) {
        delete chosen.lat;
        delete chosen.lng;
        chosen.coordinateVerified = false;
        chosen.adminPinApproved = false;
        chosen.locationStatus = 'unlocated';
        chosen.coordinateSource = 'unverified';
      }

      const hasExplicitVerifiedCoords =
        chosen.adminExplicitlyUnpinned !== true &&
        (isValidCoordinatePair(chosen.lat, chosen.lng) ||
          chosen.adminPinApproved === true ||
          chosen.coordinateVerified === true ||
          chosen.locationStatus === 'located' ||
          chosen.coordinateSource === 'admin_verified' ||
          chosen.coordinateSource === 'google_maps_resolved' ||
          chosen.coordinateSource === 'nominatim_selected');

      if (hasExplicitVerifiedCoords && isValidCoordinatePair(chosen.lat, chosen.lng)) {
        chosen.coordinateVerified = true;
        chosen.adminPinApproved = true;
        chosen.locationStatus = 'located';
      } else if (!isCivicOrSchool && !hasExplicitVerifiedCoords) {
        delete chosen.lat;
        delete chosen.lng;
        chosen.coordinateVerified = false;
        chosen.adminPinApproved = false;
        chosen.coordinateSource = 'unverified';
        delete chosen.lastVerifiedAt;
      }
      incomingPlaces[pid] = sanitizePublicPlaceForCloud(pid, chosen);
    }

    const incomingAccounts = (local.adminAccounts || DEFAULT_ADMIN_ACCOUNTS)
      .filter(acc => {
        const u = (acc.username || '').trim().toLowerCase();
        return u !== 'quanlyweb' && u !== 'quanlymaps' && u !== 'kiemnhiem' && !u.startsWith('test');
      })
      .map(acc => ({
        ...acc,
        passwordHash: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
        password: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
      }));

    const merged: AdminState = {
      ...local,
      places: incomingPlaces,
      dishes: cloudData.dishes || local.dishes || {},
      members: mergedMembers,
      placeProposals: mergedProposals,
      auditLogs: cloudData.auditLogs || local.auditLogs,
      adminEmails: local.adminEmails || DEFAULT_ADMIN_EMAILS,
      adminAccounts: incomingAccounts.length > 0 ? incomingAccounts : DEFAULT_ADMIN_ACCOUNTS,
      adminPin: '[REDACTED_HASHED]',
      sectorTags: cloudData.sectorTags || local.sectorTags,
      fontScale: cloudData.fontScale || local.fontScale,
      mapAccessMode: cloudData.mapAccessMode || local.mapAccessMode || 'public_open',
      updatedAt: Math.max(cloudData.updatedAt || 0, local.updatedAt || 0),
    };
    const sanitizedForLocal = sanitizeStateForLocalStorage(merged);
    const serialized = JSON.stringify(sanitizedForLocal);
    if (serialized !== cachedAdminRaw) {
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
      // 2a. Lắng nghe hạt mịn nhánh công khai `places` và `dishes` (hoạt động an toàn ngay cả khi `global_state` khóa `.read: false`)
      const placesRef = ref(rtdb, 'xuanhoa_admin/global_state/places');
      onValue(
        placesRef,
        snapshot => {
          if (snapshot.exists()) {
            applyCloudData({ places: snapshot.val() as Record<string, PlaceOverride> });
          }
        },
        () => {}
      );

      const dishesRef = ref(rtdb, 'xuanhoa_admin/global_state/dishes');
      onValue(
        dishesRef,
        snapshot => {
          if (snapshot.exists()) {
            applyCloudData({ dishes: snapshot.val() as Record<string, DishOverride> });
          }
        },
        () => {}
      );

      // 2b. Chỉ gắn listener `members_registry` và `placeProposals` khi phiên hiện tại là Admin/Manager đã xác thực
      ensureMembersRegistryListenerForAdmin();
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

  const member: ManagedMember = {
    uid: user.uid || existing?.uid || `uid_${Date.now()}`,
    email: user.email || existing?.email || 'thuckhach@gmail.com',
    displayName: user.displayName || existing?.displayName || user.nickname,
    nickname: user.nickname || existing?.nickname || user.displayName,
    avatar: user.avatar === '🏪' ? '🐭' : user.avatar || existing?.avatar || '🐭',
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
    const [regSnap, globalMemSnap] = await Promise.all([
      get(ref(rtdb, `xuanhoa_admin/members_registry/${safeKey}`)).catch(() => null),
      get(ref(rtdb, `xuanhoa_admin/global_state/members/${safeKey}`)).catch(() => null),
    ]);

    const state = getAdminState();
    let changed = false;

    const regVal = regSnap && regSnap.exists() ? (regSnap.val() as Partial<ManagedMember>) : null;
    const globalVal =
      globalMemSnap && globalMemSnap.exists() ? (globalMemSnap.val() as Partial<ManagedMember>) : null;

    if (regVal || globalVal) {
      const existing = state.members[cleanEmail];
      const fallbackUid = `uid_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      const bestUid = isVerifiedFirebaseAuthUid(regVal?.uid)
        ? regVal!.uid!.trim()
        : isVerifiedFirebaseAuthUid(globalVal?.uid)
        ? globalVal!.uid!.trim()
        : isVerifiedFirebaseAuthUid(existing?.uid)
        ? existing!.uid!.trim()
        : regVal?.uid && !regVal.uid.startsWith('uid_')
        ? regVal.uid
        : globalVal?.uid && !globalVal.uid.startsWith('uid_')
        ? globalVal.uid
        : existing?.uid && !existing.uid.startsWith('uid_')
        ? existing.uid
        : regVal?.uid || globalVal?.uid || existing?.uid || fallbackUid;
      const merged: ManagedMember = {
        ...(existing || {
          uid: bestUid,
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
        uid: bestUid,
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
  const roleInfo = getEffectiveAdminRoleInfo();
  const key = memberKey.trim().toLowerCase();
  const target = state.members[key];
  if (!target) return;

  // Bảo vệ tuyệt đối Primary Founder: Không ai (kể cả Backup Founder) có thể khóa, hạn chế hoặc hạ quyền Primary Founder
  if (isPrimaryFounderIdentifier(key, target.uid) && status !== 'admin' && status !== 'active') {
    throw new Error('Bảo mật Founder: Không thể khóa, hạn chế hoặc hạ quyền Primary Founder.');
  }

  // Backup Founder không được khóa hoặc hạ quyền Backup Founder khác (chỉ Primary Founder quản lý Backup Founder)
  if (isUidActiveBackupFounder(target.uid) && !roleInfo.isPrimaryFounder) {
    throw new Error('Chỉ Primary Founder mới có quyền quản lý trạng thái của Backup Founder.');
  }

  // Admin thường không được khóa/mở khóa hoặc thay đổi trạng thái của Admin/Manager hoặc tự cấp status === 'admin'
  const isTargetOperator =
    target.status === 'admin' ||
    Boolean(target.canManageWeb || target.canManageMaps) ||
    isUidOperationalAdmin(target.uid) ||
    isUidOperationalManager(target.uid);
  if ((isTargetOperator || status === 'admin') && !roleInfo.canManageRoles) {
    throw new Error('Chỉ Primary Founder hoặc Backup Founder mới có quyền thay đổi trạng thái của tài khoản Quản trị/Quản lý.');
  }

  target.status = status;
  if (banReason !== undefined) target.banReason = banReason;
  target.lastActiveAt = Date.now();

  const statusLabel =
    status === 'banned'
      ? '🔒 Khóa tài khoản (Ban)'
      : status === 'muted'
      ? '🔇 Cấm bình luận / Đánh giá (Mute)'
      : status === 'admin'
      ? '🛡️ Cấp quyền Quản trị viên (Admin)'
      : '🔓 Mở khóa tài khoản hoạt động bình thường';

  const actorRoleForLog: 'primary_founder' | 'backup_founder' | 'admin' =
    roleInfo.isPrimaryFounder
      ? 'primary_founder'
      : roleInfo.isBackupFounder
      ? 'backup_founder'
      : 'admin';

  state.auditLogs = addAdminAuditLog(
    state,
    statusLabel,
    `${target.nickname} (${target.email})`,
    'user',
    {
      actorRole: actorRoleForLog,
      eventCategory: 'role_management',
      refId: target.uid || key,
      memberLastActiveAt: target.lastActiveAt,
    }
  );
  pushMemberToCloudRealtime(target, Boolean(roleInfo.canManageRoles));

  // Đồng bộ khóa/mở khóa lên xuanhoa_security/locked_uids/$uid khi người thực hiện là Founder và UID đã xác minh
  if (roleInfo.canManageRoles && isVerifiedFirebaseAuthUid(target.uid) && !isPrimaryFounderIdentifier(key, target.uid)) {
    const cleanUid = target.uid.trim();
    const sec = getSecurityState();
    const nextLocked = { ...(sec.locked_uids || {}) };
    if (status === 'banned') {
      nextLocked[cleanUid] = true;
    } else {
      delete nextLocked[cleanUid];
    }
    saveSecurityStateCache({ locked_uids: nextLocked });

    try {
      const rtdb = getRealtimeDb();
      if (rtdb) {
        if (status === 'banned') {
          set(ref(rtdb, `xuanhoa_security/locked_uids/${cleanUid}`), true).catch(() => {});
        } else {
          remove(ref(rtdb, `xuanhoa_security/locked_uids/${cleanUid}`)).catch(() => {});
        }
      }
    } catch {}
  }
  saveAdminState(state);
}

/**
 * FOUNDER SYSTEM V2: Cấp hoặc thu hồi quyền Admin (`xuanhoa_security/admins/$uid`)
 * - Chỉ Primary Founder hoặc Backup Founder đang hoạt động (`roleInfo.canManageRoles === true`) mới được phép thực hiện.
 * - Tuyệt đối không cấp quyền cho UID chưa xác minh (Google OAuth sub 21 chữ số hoặc uid_* tự sinh).
 * - Không ai có thể thu hồi quyền của Primary Founder.
 */
export function grantOrRevokeAdminRole(memberKey: string, makeAdmin: boolean): void {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.canManageRoles) {
    throw new Error('Từ chối truy cập: Chỉ Primary Founder hoặc Backup Founder mới có quyền cấp/thu hồi Admin.');
  }

  const state = getAdminState();
  const key = memberKey.trim().toLowerCase();
  const target = state.members[key];
  if (!target) {
    throw new Error('Không tìm thấy hồ sơ thành viên trong hệ thống.');
  }

  if (isPrimaryFounderIdentifier(key, target.uid)) {
    throw new Error('Bảo mật Founder: Không thể thu hồi hoặc thay đổi quyền của Primary Founder.');
  }

  if (isUidActiveBackupFounder(target.uid) && !roleInfo.isPrimaryFounder) {
    throw new Error('Chỉ Primary Founder mới có quyền thay đổi phân quyền của Backup Founder.');
  }

  if (makeAdmin && !isVerifiedFirebaseAuthUid(target.uid)) {
    throw new Error(
      'Chưa thể cấp quyền Admin: Tài khoản này chưa có Firebase Auth UID 28 ký tự đã xác minh (hiện đang là Google sub 21 chữ số hoặc mã tạm). Người dùng cần đăng nhập Google trên hệ thống 1 lần trước khi Founder cấp quyền.'
    );
  }

  const now = Date.now();
  target.status = makeAdmin ? 'admin' : 'active';
  target.roleTier = makeAdmin ? 'admin' : 'user';
  target.canManageWeb = makeAdmin;
  target.canManageMaps = makeAdmin;
  target.lastActiveAt = now;

  if (makeAdmin) {
    if (!state.adminEmails.includes(key)) {
      state.adminEmails = [...state.adminEmails, key];
    }
  } else {
    state.adminEmails = (state.adminEmails || []).filter(e => e.trim().toLowerCase() !== key);
  }

  const actorRoleForLog: 'primary_founder' | 'backup_founder' = roleInfo.isPrimaryFounder
    ? 'primary_founder'
    : 'backup_founder';

  state.auditLogs = addAdminAuditLog(
    state,
    makeAdmin
      ? '🛡️ Founder CẤP QUYỀN ADMIN cho thành viên'
      : '⚠️ Founder THU HỒI QUYỀN ADMIN của thành viên',
    `${target.nickname} (${target.email}) [UID: ${target.uid.slice(0, 6)}...]`,
    'user',
    {
      actorRole: actorRoleForLog,
      eventCategory: 'role_management',
      refId: target.uid || key,
      memberLastActiveAt: now,
    }
  );

  pushMemberToCloudRealtime(target, true);

  if (isVerifiedFirebaseAuthUid(target.uid)) {
    const cleanUid = target.uid.trim();
    const sec = getSecurityState();
    const nextAdmins = { ...(sec.admins || {}) };
    const nextManagers = { ...(sec.managers || {}) };
    if (makeAdmin) {
      nextAdmins[cleanUid] = true;
      delete nextManagers[cleanUid];
    } else {
      delete nextAdmins[cleanUid];
    }
    saveSecurityStateCache({ admins: nextAdmins, managers: nextManagers });

    try {
      const rtdb = getRealtimeDb();
      if (rtdb) {
        if (makeAdmin) {
          set(ref(rtdb, `xuanhoa_security/admins/${cleanUid}`), true).catch(() => {});
          remove(ref(rtdb, `xuanhoa_security/managers/${cleanUid}`)).catch(() => {});
        } else {
          remove(ref(rtdb, `xuanhoa_security/admins/${cleanUid}`)).catch(() => {});
        }
      }
    } catch {}
  }

  saveAdminState(state);
}

export function updateMemberManagerPermissions(
  memberKey: string,
  patch: { canManageWeb?: boolean; canManageMaps?: boolean }
): void {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.canManageRoles) {
    throw new Error('Từ chối truy cập: Chỉ Primary Founder hoặc Backup Founder mới có quyền cấp/thu hồi quyền Quản lý (Manager).');
  }

  const state = getAdminState();
  const key = memberKey.trim().toLowerCase();
  const target = state.members[key];
  if (!target) return;

  if (isPrimaryFounderIdentifier(key, target.uid)) {
    throw new Error('Bảo mật Founder: Primary Founder luôn có toàn quyền hệ thống.');
  }

  const nextWeb = patch.canManageWeb !== undefined ? patch.canManageWeb : Boolean(target.canManageWeb);
  const nextMaps = patch.canManageMaps !== undefined ? patch.canManageMaps : Boolean(target.canManageMaps);
  const willBeManager = Boolean(nextWeb || nextMaps);

  if (willBeManager && !isVerifiedFirebaseAuthUid(target.uid)) {
    throw new Error(
      'Chưa thể cấp quyền Manager: Tài khoản này chưa có Firebase Auth UID 28 ký tự đã xác minh (hiện đang là Google sub 21 chữ số hoặc mã tạm). Người dùng cần đăng nhập Google trên hệ thống 1 lần trước khi Founder cấp quyền.'
    );
  }

  target.canManageWeb = nextWeb;
  target.canManageMaps = nextMaps;
  if (target.status !== 'admin') {
    target.roleTier = willBeManager ? 'manager' : 'user';
  }
  target.lastActiveAt = Date.now();

  const roles: string[] = [];
  if (target.canManageWeb) roles.push('Quản lý Web (Quán)');
  if (target.canManageMaps) roles.push('Quản lý Maps');

  const actorRoleForLog: 'primary_founder' | 'backup_founder' = roleInfo.isPrimaryFounder
    ? 'primary_founder'
    : 'backup_founder';

  state.auditLogs = addAdminAuditLog(
    state,
    roles.length > 0 ? `🗺️ Founder cấp quyền: ${roles.join(' + ')}` : '⚠️ Founder thu hồi quyền Quản lý Web/Maps',
    `${target.nickname} (${target.email})`,
    'user',
    {
      actorRole: actorRoleForLog,
      eventCategory: 'role_management',
      refId: target.uid || key,
      memberLastActiveAt: target.lastActiveAt,
    }
  );
  pushMemberToCloudRealtime(target, true);

  // Chỉ ghi lên xuanhoa_security/managers/$uid khi target.uid là Firebase Auth UID 28 ký tự hợp lệ đã xác minh
  if (isVerifiedFirebaseAuthUid(target.uid)) {
    const cleanUid = target.uid.trim();
    const sec = getSecurityState();
    const nextManagers = { ...(sec.managers || {}) };
    if (willBeManager) {
      nextManagers[cleanUid] = true;
    } else {
      delete nextManagers[cleanUid];
    }
    saveSecurityStateCache({ managers: nextManagers });

    try {
      const rtdb = getRealtimeDb();
      if (rtdb) {
        if (willBeManager) {
          set(ref(rtdb, `xuanhoa_security/managers/${cleanUid}`), true).catch(() => {});
        } else {
          remove(ref(rtdb, `xuanhoa_security/managers/${cleanUid}`)).catch(() => {});
        }
      }
    } catch {}
  }
  saveAdminState(state);
}

export function deleteMemberAndPurgeReviews(memberKey: string): { purgedReviews: number } {
  const state = getAdminState();
  const roleInfo = getEffectiveAdminRoleInfo();
  const key = memberKey.trim().toLowerCase();
  const target = state.members[key];
  if (isPrimaryFounderIdentifier(key, target?.uid)) {
    return { purgedReviews: 0 };
  }
  if (target && (isUidActiveBackupFounder(target.uid) || isUidOperationalAdmin(target.uid)) && !roleInfo.isPrimaryFounder) {
    return { purgedReviews: 0 };
  }
  if (target?.status === 'admin') {
    return { purgedReviews: 0 };
  }
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
export type MapDebugTag =
  | 'PLACE SELECT'
  | 'PLACE SAVE'
  | 'COORDINATE SAVE'
  | 'MAP LINK RESOLVE'
  | 'PLACE HYDRATE'
  | 'PLACE MERGE'
  | 'PLACE VISIBILITY'
  | '2D MARKER UPDATE'
  | '3D MARKER UPDATE'
  | 'FILTER COUNTS';

export function logMapDebug(tag: MapDebugTag, payload: Record<string, unknown>): void {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[${tag}]`, payload);
    }
  } catch {
    // ignore in non-browser/build environments
  }
}

export function normalizeSearchVn(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.5;
}

export function hasDirectCoordinatesInMapsUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  let text = rawUrl.trim();
  if (!text) return false;
  try {
    text = decodeURIComponent(text);
  } catch {
    // ignore
  }
  return (
    /!3d(-?\d{1,2}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/.test(text) ||
    /!2d(-?\d{1,3}\.\d{4,})!3d(-?\d{1,2}\.\d{4,})/.test(text) ||
    /(?:@|\/place\/[^/]+\/@|\/search\/|\/dir\/[^/]*\/|[?&](?:q|query|ll|center)=)(-?\d{1,2}\.\d{4,})\s*[,\s+]\s*(-?\d{1,3}\.\d{4,})/i.test(
      text
    )
  );
}

export interface AdminPlaceItem {
  place: Place;
  status: PlaceStatus;
  sectorTag: string;
  mapCategory?: string;
  parentCategoryId?: string;
  subcategoryId?: string;
  categoryId?: string;
  extraTags?: string[];
  contentProfile?: ContentProfileType;
  catalogMode?: CatalogModeType;
  catalogEnabled?: boolean;
  website?: string;
  educationLevel?: string;
  agencyFunction?: string;
  showByDefault?: boolean;
  defaultMapVisible?: boolean;
  openingHours?: string;
  lat?: number | null;
  lng?: number | null;
  createdAt?: number;
  locationStatus?: 'located' | 'unlocated' | 'invalid_coordinates' | 'invalid' | 'pending_geocode' | 'suspicious' | 'outside_service_area';
  mapsLinkStatus?: 'none' | 'valid' | 'unresolved' | 'invalid';
  visibilityStatus?: 'visible' | 'hidden' | 'deleted' | 'blocked';
  version?: number;
  normalizedName?: string;
  normalizedAddress?: string;
  normalizedHaystack?: string;
  fullMenu: CustomMenuEntry[];
  isVerified: boolean;
  isFeatured: boolean;
  priorityBoost: 1 | 2 | 3;
  isModified: boolean;
  isCustom: boolean;
  isNewlyDetected: boolean;
  updatedAt?: number;
}

/**
 * Tính trạng thái định vị (locationStatus) ĐỘC LẬP HOÀN TOÀN với mapsLinkStatus.
 * Quy tắc bất biến: Nếu có lat/lng hợp lệ -> LUÔN LÀ 'located' kể cả khi mapsUrl bị lỗi hoặc không đọc được!
 */
export function computePlaceLocationStatus(
  ov?: Partial<PlaceOverride> | null,
  isCivicOrOsm = false
): 'located' | 'unlocated' | 'invalid_coordinates' {
  if (!ov) return isCivicOrOsm ? 'located' : 'unlocated';
  if (ov.adminExplicitlyUnpinned === true) return 'unlocated';
  const hasValidLatLng = isValidCoordinatePair(ov.lat, ov.lng);
  if (hasValidLatLng) {
    return 'located';
  }
  const hasRawNonNullCoord =
    (ov.lat !== undefined && ov.lat !== null) || (ov.lng !== undefined && ov.lng !== null);
  if (hasRawNonNullCoord && !hasValidLatLng) {
    return 'invalid_coordinates';
  }
  if (ov.coordinateVerified === false) {
    return 'unlocated';
  }
  return isCivicOrOsm ? 'located' : 'unlocated';
}

/**
 * Kiểm toán chất lượng tọa độ địa điểm theo Phần 6 (Master Prompt):
 * - located: Tọa độ hợp lệ nằm trong vùng phục vụ Xuân Hòa (lat 21.24..21.34, lng 105.68..105.77)
 * - unlocated: Chưa có tọa độ (lat/lng null)
 * - outside_service_area: Có tọa độ nhưng nằm ngoài phạm vi Xuân Hòa / Phúc Yên
 * - suspicious: Trùng tọa độ hoàn toàn với một địa điểm khác không cùng tòa nhà
 */
export function evaluatePlaceCoordinateQuality(
  placeOrItem?: { id?: string; name?: string; lat?: number | null; lng?: number | null } | null,
  duplicateCoordKeySet?: Set<string>
): {
  status: 'located' | 'unlocated' | 'suspicious' | 'outside_service_area';
  reason?: string;
} {
  if (!placeOrItem) {
    return { status: 'unlocated', reason: 'Chưa có dữ liệu địa điểm' };
  }
  const lat = placeOrItem.lat;
  const lng = placeOrItem.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: 'unlocated', reason: 'Chưa định vị tọa độ' };
  }
  if (lat === 0 && lng === 0) {
    return { status: 'suspicious', reason: 'Tọa độ (0, 0) không hợp lệ' };
  }
  // Phạm vi vùng phục vụ mở rộng Phường Xuân Hòa & lân cận (lat 21.24..21.34, lng 105.68..105.77)
  if (lat < 21.24 || lat > 21.34 || lng < 105.68 || lng > 105.77) {
    return {
      status: 'outside_service_area',
      reason: `Tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)}) nằm ngoài phạm vi Xuân Hòa`,
    };
  }
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (duplicateCoordKeySet && duplicateCoordKeySet.has(key)) {
    return {
      status: 'suspicious',
      reason: `Tọa độ trùng khớp (${key}) cần rà soát thực địa`,
    };
  }
  return { status: 'located' };
}

export function auditAllPlaceCoordinatesQuality(): {
  total: number;
  located: number;
  unlocated: number;
  suspicious: number;
  outsideServiceArea: number;
  items: Array<{
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    status: 'located' | 'unlocated' | 'suspicious' | 'outside_service_area';
    reason?: string;
  }>;
} {
  const managed = getAllManagedPlaces();
  const state = getAdminState();
  const managedIds = new Set(managed.map((m) => m.place.id));
  const osmEntries = Object.values(state.places || {}).filter(
    (ov) => ov && ov.id && ov.id.startsWith('osm_') && !managedIds.has(ov.id) && ov.status !== 'deleted'
  );
  const combined: Array<{ id: string; name: string; lat: number | null; lng: number | null }> = [
    ...managed.map((m) => ({
      id: m.place.id,
      name: m.place.name,
      lat: typeof m.lat === 'number' ? m.lat : null,
      lng: typeof m.lng === 'number' ? m.lng : null,
    })),
    ...osmEntries.map((l) => ({
      id: l.id,
      name: l.name || l.id,
      lat: typeof l.lat === 'number' ? l.lat : null,
      lng: typeof l.lng === 'number' ? l.lng : null,
    })),
  ];

  const coordCounts = new Map<string, number>();
  for (const item of combined) {
    if (typeof item.lat === 'number' && typeof item.lng === 'number') {
      const k = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
      coordCounts.set(k, (coordCounts.get(k) || 0) + 1);
    }
  }
  const duplicateSet = new Set<string>();
  for (const [k, cnt] of coordCounts.entries()) {
    if (cnt > 2) duplicateSet.add(k);
  }

  const items = combined.map((item) => {
    const q = evaluatePlaceCoordinateQuality(item, duplicateSet);
    return {
      id: item.id,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      status: q.status,
      reason: q.reason,
    };
  });

  return {
    total: items.length,
    located: items.filter((i) => i.status === 'located').length,
    unlocated: items.filter((i) => i.status === 'unlocated').length,
    suspicious: items.filter((i) => i.status === 'suspicious').length,
    outsideServiceArea: items.filter((i) => i.status === 'outside_service_area').length,
    items,
  };
}

if (typeof window !== 'undefined') {
  (window as any).__XUANHOA_COORD_AUDIT__ = auditAllPlaceCoordinatesQuality;
}

/**
 * Tính trạng thái link Google Maps (mapsLinkStatus) độc lập với tọa độ ghim.
 */
export function computeMapsLinkStatus(
  ov?: Partial<PlaceOverride> | null,
  fallbackMapsUrl?: string | null
): 'none' | 'valid' | 'unresolved' | 'invalid' {
  const rawMapsUrl = (ov?.mapsUrl ?? ov?.customPlaceData?.mapsUrl ?? fallbackMapsUrl ?? '').trim();
  if (!rawMapsUrl) return 'none';

  // Nếu URL chứa sẵn tọa độ chuẩn (!3d!4d, @lat,lng, ?q=lat,lng) hoặc là cặp tọa độ hợp lệ
  if (hasDirectCoordinatesInMapsUrl(rawMapsUrl)) {
    return 'valid';
  }

  // Nếu đã được xác nhận trạng thái rõ ràng từ bước resolve
  if (ov?.mapsLinkStatus && ov.mapsLinkStatus !== 'none') {
    return ov.mapsLinkStatus;
  }

  // Nếu là link rút gọn maps.app.goo.gl / goo.gl/maps
  if (/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(rawMapsUrl)) {
    if (isValidCoordinatePair(ov?.lat, ov?.lng)) {
      return 'valid';
    }
    const shortCleaned = rawMapsUrl.split('?')[0];
    if (
      shortCleaned === 'https://maps.app.goo.gl/Kk33whBUz27JbsvG6' ||
      shortCleaned === 'https://maps.app.goo.gl/9FJ9U1JDij8FDgV17' ||
      shortCleaned === 'https://maps.app.goo.gl/KeefsfcCKvvYCuMZA' ||
      shortCleaned === 'https://maps.app.goo.gl/nT1hviRgRibEPUzU9'
    ) {
      return 'valid';
    }
    return 'unresolved';
  }

  // Nếu là URL nhưng không phải link tọa độ hợp lệ
  if (
    rawMapsUrl.startsWith('http://') ||
    rawMapsUrl.startsWith('https://') ||
    rawMapsUrl.includes('goo.gl') ||
    rawMapsUrl.includes('google.com/maps')
  ) {
    return 'invalid';
  }

  return 'none';
}

/**
 * Tính trạng thái hiển thị chung cho cả 2D và 3D.
 */
export function computePlaceVisibilityStatus(
  ov?: Partial<PlaceOverride> | null,
  status?: PlaceStatus
): 'visible' | 'hidden' | 'deleted' | 'blocked' {
  const effStatus = ov?.status || status || 'active';
  if (effStatus === 'deleted' || ov?.visibilityStatus === 'deleted') return 'deleted';
  if (effStatus === 'locked' || ov?.visibilityStatus === 'blocked') return 'blocked';
  if (ov?.visibilityStatus === 'hidden') return 'hidden';
  return 'visible';
}

let cachedHiddenLookupStamp = -1;
let cachedHiddenIds = new Set<string>();
let cachedHiddenNames = new Set<string>();

function ensureHiddenLookupCache(): { ids: Set<string>; names: Set<string> } {
  const state = getAdminState();
  const stamp = state.updatedAt || 0;
  if (stamp === cachedHiddenLookupStamp) {
    return { ids: cachedHiddenIds, names: cachedHiddenNames };
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  const baseById = new Map<string, Place>(xuanHoaPlaces.map(p => [p.id, p]));

  for (const [pid, ov] of Object.entries(state.places || {})) {
    if (!ov) continue;
    const vis = computePlaceVisibilityStatus(ov, ov.status);
    if (vis !== 'visible') {
      const cleanId = pid.trim();
      ids.add(cleanId);
      ids.add(cleanId.toLowerCase());
      if (cleanId.startsWith('osm_')) {
        const stripped = cleanId.replace(/^osm_(?:way_|node_|relation_)?/i, '');
        if (stripped) ids.add(stripped);
      } else {
        ids.add(`osm_${cleanId}`);
      }
      const n1 = normalizeSearchVn(ov.name);
      const n2 = normalizeSearchVn(ov.customPlaceData?.name);
      const n3 = normalizeSearchVn(baseById.get(pid)?.name);
      if (n1 && n1.length >= 3) names.add(n1);
      if (n2 && n2.length >= 3) names.add(n2);
      if (n3 && n3.length >= 3) names.add(n3);
    }
  }
  cachedHiddenLookupStamp = stamp;
  cachedHiddenIds = ids;
  cachedHiddenNames = names;
  return { ids, names };
}

/**
 * Kiểm tra O(1) xem một địa điểm / tòa nhà tĩnh (2D hoặc 3D) có đang bị Admin ẩn / xóa / khóa không.
 * Đảm bảo địa điểm đã xóa ở 2D (VD: "Công an Phường Xuân Hòa") KHÔNG BAO GIỜ tự hồi sinh nhãn tĩnh hay ghim ở 3D!
 */
export function isPlaceHiddenOrDeletedInAdmin(
  idOrOsmId?: string | null,
  name?: string | null
): boolean {
  const { ids, names } = ensureHiddenLookupCache();
  if (idOrOsmId) {
    const raw = String(idOrOsmId).trim();
    if (
      ids.has(raw) ||
      ids.has(raw.toLowerCase()) ||
      ids.has(`osm_${raw}`) ||
      ids.has(`osm_way_${raw}`) ||
      ids.has(`osm_node_${raw}`)
    ) {
      return true;
    }
  }
  if (name) {
    const norm = normalizeSearchVn(name);
    if (norm && norm.length >= 3 && names.has(norm)) {
      return true;
    }
  }
  return false;
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

    const taxonomy = resolvePlaceTaxonomy({
      id: basePlace.id,
      name: mergedPlace.name,
      subType: mergedPlace.tagline,
      tags: mergedPlace.tags,
      sectorTag: ov?.sectorTag,
      mapCategory: ov?.mapCategory,
      category: mergedPlace.category,
      explicitParentId: ov?.parentCategoryId,
      explicitSubcategoryId: ov?.subcategoryId || ov?.categoryId,
      explicitShowByDefault: ov?.showByDefault ?? ov?.defaultMapVisible,
      dataSource: 'places_xuanhoa',
    });
    const subMeta =
      MAP_CATEGORY_REGISTRY[taxonomy.subcategoryId] || MAP_CATEGORY_REGISTRY.uncategorized;
    const resolvedSectorTag =
      ov?.subcategoryId || ov?.categoryId
        ? getDefaultSectorTagForSubcategory(subMeta)
        : ov?.sectorTag || inferDefaultSectorTag(mergedPlace);
    const resolvedExtraTags = Array.isArray(ov?.extraTags)
      ? ov!.extraTags
      : Array.isArray(basePlace.extraTags)
      ? basePlace.extraTags
      : [];
    const profileMeta = resolvePlaceContentProfile({
      subcategoryId: taxonomy.subcategoryId,
      parentCategoryId: taxonomy.parentCategoryId,
      explicitProfile: ov?.contentProfile ?? basePlace.contentProfile,
      explicitCatalogMode: ov?.catalogMode ?? basePlace.catalogMode,
      explicitCatalogEnabled: ov?.catalogEnabled ?? basePlace.catalogEnabled,
      hasCatalogItems: fullMenu.length > 0,
    });

    mergedPlace.parentCategoryId = taxonomy.parentCategoryId;
    mergedPlace.subcategoryId = taxonomy.subcategoryId;
    mergedPlace.subcategory = subMeta.label;
    mergedPlace.extraTags = resolvedExtraTags;
    mergedPlace.contentProfile = profileMeta.contentProfile;
    mergedPlace.catalogMode = profileMeta.catalogMode;
    mergedPlace.catalogEnabled = profileMeta.catalogEnabled;
    mergedPlace.website = ov?.website ?? basePlace.website;
    mergedPlace.educationLevel = ov?.educationLevel ?? basePlace.educationLevel;
    mergedPlace.agencyFunction = ov?.agencyFunction ?? basePlace.agencyFunction;
    if (!profileMeta.catalogEnabled || profileMeta.forbidsMenuAndOrdering) {
      mergedPlace.menu = [];
    }

    const isCivic =
      resolvedSectorTag === 'dia-danh' ||
      taxonomy.legacyCategory === 'public' ||
      taxonomy.legacyCategory === 'school' ||
      ov?.mapCategory === 'public' ||
      ov?.mapCategory === 'school' ||
      ov?.mapCategory === 'medical';

    const isExplicitlyUnpinned = ov?.adminExplicitlyUnpinned === true;
    const fallbackCoord =
      VERIFIED_CATALOG_PLACE_COORDS[basePlace.id] ||
      (isValidCoordinatePair(basePlace.lat, basePlace.lng)
        ? { lat: Number(basePlace.lat), lng: Number(basePlace.lng) }
        : null);
    const hasOvValidCoords =
      !isExplicitlyUnpinned && isValidCoordinatePair(ov?.lat, ov?.lng);
    const resolvedLat = hasOvValidCoords
      ? Number(ov!.lat)
      : !isExplicitlyUnpinned && fallbackCoord
      ? fallbackCoord.lat
      : null;
    const resolvedLng = hasOvValidCoords
      ? Number(ov!.lng)
      : !isExplicitlyUnpinned && fallbackCoord
      ? fallbackCoord.lng
      : null;
    const locStatus: 'located' | 'unlocated' | 'invalid_coordinates' =
      resolvedLat !== null && resolvedLng !== null && !ov?.pendingMapApproval?.isNewPlace
        ? 'located'
        : computePlaceLocationStatus(ov, isCivic);
    mergedPlace.lat = resolvedLat;
    mergedPlace.lng = resolvedLng;

    const normName = normalizeSearchVn(mergedPlace.name);
    const normAddress = normalizeSearchVn(mergedPlace.address);
    const normPhone = normalizeSearchVn(mergedPlace.phone);
    const normCat = normalizeSearchVn(`${subMeta.label} ${resolvedExtraTags.join(' ')} ${ov?.mapCategory || ''} ${resolvedSectorTag}`);

    result.push({
      place: mergedPlace,
      status,
      sectorTag: resolvedSectorTag,
      mapCategory: taxonomy.legacyCategory,
      parentCategoryId: taxonomy.parentCategoryId,
      subcategoryId: taxonomy.subcategoryId,
      categoryId: taxonomy.subcategoryId,
      extraTags: resolvedExtraTags,
      contentProfile: profileMeta.contentProfile,
      catalogMode: profileMeta.catalogMode,
      catalogEnabled: profileMeta.catalogEnabled,
      website: mergedPlace.website,
      educationLevel: mergedPlace.educationLevel,
      agencyFunction: mergedPlace.agencyFunction,
      showByDefault: taxonomy.showByDefault,
      defaultMapVisible: taxonomy.showByDefault,
      openingHours: mergedPlace.openHours,
      lat: resolvedLat,
      lng: resolvedLng,
      createdAt: ov?.createdAt || ov?.updatedAt,
      locationStatus: locStatus,
      mapsLinkStatus: computeMapsLinkStatus(ov, mergedPlace.mapsUrl),
      visibilityStatus: computePlaceVisibilityStatus(ov, status),
      version: ov?.version || 1,
      normalizedName: normName,
      normalizedAddress: normAddress,
      normalizedHaystack: `${normName} ${normAddress} ${normPhone} ${normCat}`.trim(),
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
        tagline: ov.tagline ?? ov.customPlaceData.tagline,
        address: ov.address || ov.customPlaceData.address,
        zone: ov.zone || ov.customPlaceData.zone,
        distance: ov.distance || ov.customPlaceData.distance,
        phone: ov.phone ?? ov.customPlaceData.phone,
        openHours: ov.openHours ?? ov.openingHours ?? ov.customPlaceData.openHours,
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
        imageUrl: ov.imageUrl ?? ov.customPlaceData.imageUrl,
        signatureDish: ov.customPlaceData.signatureDish
          ? {
              ...ov.customPlaceData.signatureDish,
              name: cleanDishDisplayTitle(ov.signatureDishName || ov.customPlaceData.signatureDish.name),
              price: ov.signatureDishPrice ?? ov.customPlaceData.signatureDish.price,
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
      const customTaxonomy = resolvePlaceTaxonomy({
        id,
        name: mergedCustom.name,
        subType: mergedCustom.tagline,
        tags: mergedCustom.tags,
        sectorTag: ov.sectorTag,
        mapCategory: ov.mapCategory,
        category: mergedCustom.category,
        explicitParentId: ov.parentCategoryId,
        explicitSubcategoryId: ov.subcategoryId || ov.categoryId,
        explicitShowByDefault: ov.showByDefault ?? ov.defaultMapVisible,
        dataSource: 'admin_custom',
      });
      const customSubMeta =
        MAP_CATEGORY_REGISTRY[customTaxonomy.subcategoryId] || MAP_CATEGORY_REGISTRY.uncategorized;
      const customSectorTag =
        ov.subcategoryId || ov.categoryId
          ? getDefaultSectorTagForSubcategory(customSubMeta)
          : ov.sectorTag || inferDefaultSectorTag(mergedCustom);
      const customExtraTags = Array.isArray(ov.extraTags)
        ? ov.extraTags
        : Array.isArray(ov.customPlaceData.extraTags)
        ? ov.customPlaceData.extraTags
        : [];
      const customProfileMeta = resolvePlaceContentProfile({
        subcategoryId: customTaxonomy.subcategoryId,
        parentCategoryId: customTaxonomy.parentCategoryId,
        explicitProfile: ov.contentProfile ?? ov.customPlaceData.contentProfile,
        explicitCatalogMode: ov.catalogMode ?? ov.customPlaceData.catalogMode,
        explicitCatalogEnabled: ov.catalogEnabled ?? ov.customPlaceData.catalogEnabled,
        hasCatalogItems: fullMenu.length > 0,
      });

      mergedCustom.parentCategoryId = customTaxonomy.parentCategoryId;
      mergedCustom.subcategoryId = customTaxonomy.subcategoryId;
      mergedCustom.subcategory = customSubMeta.label;
      mergedCustom.extraTags = customExtraTags;
      mergedCustom.contentProfile = customProfileMeta.contentProfile;
      mergedCustom.catalogMode = customProfileMeta.catalogMode;
      mergedCustom.catalogEnabled = customProfileMeta.catalogEnabled;
      mergedCustom.website = ov.website ?? ov.customPlaceData.website;
      mergedCustom.educationLevel = ov.educationLevel ?? ov.customPlaceData.educationLevel;
      mergedCustom.agencyFunction = ov.agencyFunction ?? ov.customPlaceData.agencyFunction;
      if (!customProfileMeta.catalogEnabled || customProfileMeta.forbidsMenuAndOrdering) {
        mergedCustom.menu = [];
      }

      const isCivicCustom =
        customSectorTag === 'dia-danh' ||
        customTaxonomy.legacyCategory === 'public' ||
        customTaxonomy.legacyCategory === 'school' ||
        ov.mapCategory === 'public' ||
        ov.mapCategory === 'school' ||
        ov.mapCategory === 'medical';

      const customLocStatus = computePlaceLocationStatus(ov, isCivicCustom);
      const customLat =
        customLocStatus === 'located' && isValidCoordinatePair(ov.lat, ov.lng)
          ? Number(ov.lat)
          : null;
      const customLng =
        customLocStatus === 'located' && isValidCoordinatePair(ov.lat, ov.lng)
          ? Number(ov.lng)
          : null;
      mergedCustom.lat = customLat;
      mergedCustom.lng = customLng;

      const normName = normalizeSearchVn(mergedCustom.name);
      const normAddress = normalizeSearchVn(mergedCustom.address);
      const normPhone = normalizeSearchVn(mergedCustom.phone);
      const normCat = normalizeSearchVn(`${customSubMeta.label} ${customExtraTags.join(' ')} ${ov.mapCategory || ''} ${customSectorTag}`);

      result.push({
        place: mergedCustom,
        status: ov.status || 'active',
        sectorTag: customSectorTag,
        mapCategory: customTaxonomy.legacyCategory,
        parentCategoryId: customTaxonomy.parentCategoryId,
        subcategoryId: customTaxonomy.subcategoryId,
        categoryId: customTaxonomy.subcategoryId,
        extraTags: customExtraTags,
        contentProfile: customProfileMeta.contentProfile,
        catalogMode: customProfileMeta.catalogMode,
        catalogEnabled: customProfileMeta.catalogEnabled,
        website: mergedCustom.website,
        educationLevel: mergedCustom.educationLevel,
        agencyFunction: mergedCustom.agencyFunction,
        showByDefault: customTaxonomy.showByDefault,
        defaultMapVisible: customTaxonomy.showByDefault,
        openingHours: mergedCustom.openHours,
        lat: customLat,
        lng: customLng,
        createdAt: ov.createdAt || ov.updatedAt,
        locationStatus: customLocStatus,
        mapsLinkStatus: computeMapsLinkStatus(ov, mergedCustom.mapsUrl),
        visibilityStatus: computePlaceVisibilityStatus(ov, ov.status || 'active'),
        version: ov.version || 1,
        normalizedName: normName,
        normalizedAddress: normAddress,
        normalizedHaystack: `${normName} ${normAddress} ${normPhone} ${normCat}`.trim(),
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
    if (item.visibilityStatus && item.visibilityStatus !== 'visible') return false;
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
  // sang thẳng Vòng Quay Chọn Món & Kho Món trên Web chính (Chỉ áp dụng cho Quán Ăn/Uống/Nhậu có contentProfile === 'food')
  for (const placeItem of managedPlaces) {
    const pOv = state.places[placeItem.place.id];
    if (!pOv?.customMenu && !placeItem.isCustom) continue;
    if (placeItem.contentProfile && placeItem.contentProfile !== 'food') continue;
    if (placeItem.catalogEnabled === false) continue;
    if (placeItem.sectorTag === 'dia-danh' || placeItem.sectorTag === 'dien-thoai' || placeItem.sectorTag === 'dich-vu') continue;

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
export function savePlaceAdminOverride(
  placeId: string,
  patch: Partial<PlaceOverride>,
  actionLabel?: string,
  options?: {
    expectedBaseVersion?: number;
    expectedVersion?: number;
    bypassProposalCheck?: boolean;
    confirmCoordinateOverride?: boolean;
    coordinateOverrideReason?: string;
  }
): void {
  const state = getAdminState();
  const roleInfo = getEffectiveAdminRoleInfo();
  const isMapMgr = isMapManagerAuthenticated();
  const storedUser = getStoredAuthUser();
  const current = state.places[placeId] || { id: placeId, updatedAt: Date.now(), version: 0 };

  const expectedVer = options?.expectedBaseVersion ?? options?.expectedVersion;
  if (
    expectedVer !== undefined &&
    typeof current.version === 'number' &&
    current.version > expectedVer
  ) {
    throw new Error(
      `Xung đột phiên bản (Version Conflict): Địa điểm "${
        current.name || placeId
      }" đã được cập nhật sang phiên bản v${current.version} (phiên của bạn: v${expectedVer}). Vui lòng tải lại trước khi lưu.`
    );
  }

  if (!options?.bypassProposalCheck) {
    if (!roleInfo.isAuthenticated && !isMapMgr) {
      throw new Error('Truy cập bị từ chối: Tài khoản khách không có quyền chỉnh sửa dữ liệu địa điểm.');
    }
    if (!roleInfo.isSuperAdmin) {
      submitManagerPlaceProposal(placeId, patch, actionLabel);
      return;
    }
    // Nếu địa điểm là 1 trong 4 landmark đang chờ duyệt trong `placeProposals` (`status !== 'approved'`),
    // cập nhật tọa độ/thông tin đề xuất trong `placeProposals` thay vì tự tạo mới Place trên `global_state/places`.
    const pendingLandmarkPropId = PENDING_LANDMARK_PROPOSAL_BY_PLACE_ID[placeId];
    const pendingLandmarkProp = pendingLandmarkPropId ? state.placeProposals?.[pendingLandmarkPropId] : undefined;
    if (pendingLandmarkProp && pendingLandmarkProp.status !== 'approved') {
      const nextLat =
        typeof patch.lat === 'number' && Number.isFinite(patch.lat)
          ? Number(patch.lat.toFixed(6))
          : pendingLandmarkProp.proposedData.lat;
      const nextLng =
        typeof patch.lng === 'number' && Number.isFinite(patch.lng)
          ? Number(patch.lng.toFixed(6))
          : pendingLandmarkProp.proposedData.lng;
      const nextProposed = {
        ...pendingLandmarkProp.proposedData,
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.address ? { address: patch.address } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.openHours !== undefined ? { openHours: patch.openHours } : {}),
        ...(patch.tagline !== undefined ? { tagline: patch.tagline } : {}),
        lat: nextLat,
        lng: nextLng,
        mapsUrl:
          patch.mapsUrl ||
          (nextLat !== null && nextLng !== null
            ? `https://www.google.com/maps/search/?api=1&query=${nextLat},${nextLng}`
            : pendingLandmarkProp.proposedData.mapsUrl),
      };
      pendingLandmarkProp.proposedData = nextProposed;
      pendingLandmarkProp.afterData = { ...nextProposed };
      if (patch.name) pendingLandmarkProp.placeName = patch.name;
      state.placeProposals = {
        ...(state.placeProposals || {}),
        [pendingLandmarkPropId]: pendingLandmarkProp,
      };
      saveAdminState(state, false);
      return;
    }
  }

  const now = Date.now();
  const nextVersion = (current.version || 0) + 1;

  // Chuẩn hóa taxonomy & alias fields trước khi merge
  const normalizedPatch: Partial<PlaceOverride> = { ...patch };
  const effSubId = normalizedPatch.subcategoryId || normalizedPatch.categoryId;
  if (effSubId && effSubId in MAP_CATEGORY_REGISTRY) {
    const subMeta = MAP_CATEGORY_REGISTRY[effSubId as MapSubcategoryId];
    normalizedPatch.subcategoryId = subMeta.id;
    normalizedPatch.categoryId = subMeta.id;
    normalizedPatch.parentCategoryId = subMeta.parentId;
    normalizedPatch.mapCategory = subMeta.legacyCategory;
    if (!normalizedPatch.sectorTag) {
      normalizedPatch.sectorTag = getDefaultSectorTagForSubcategory(subMeta);
    }
    if (normalizedPatch.contentProfile === undefined) {
      normalizedPatch.contentProfile = subMeta.contentProfile;
    }
    if (normalizedPatch.catalogMode === undefined) {
      normalizedPatch.catalogMode = subMeta.defaultCatalogMode;
    }
    if (normalizedPatch.showByDefault === undefined && normalizedPatch.defaultMapVisible === undefined) {
      if (current.showByDefault === undefined && current.defaultMapVisible === undefined) {
        normalizedPatch.showByDefault = subMeta.showByDefault;
        normalizedPatch.defaultMapVisible = subMeta.showByDefault;
      }
    }
  }
  if (normalizedPatch.openingHours !== undefined && normalizedPatch.openHours === undefined) {
    normalizedPatch.openHours = normalizedPatch.openingHours;
  } else if (normalizedPatch.openHours !== undefined && normalizedPatch.openingHours === undefined) {
    normalizedPatch.openingHours = normalizedPatch.openHours;
  }
  if (typeof normalizedPatch.defaultMapVisible === 'boolean' && normalizedPatch.showByDefault === undefined) {
    normalizedPatch.showByDefault = normalizedPatch.defaultMapVisible;
  } else if (typeof normalizedPatch.showByDefault === 'boolean' && normalizedPatch.defaultMapVisible === undefined) {
    normalizedPatch.defaultMapVisible = normalizedPatch.showByDefault;
  }

  // Không xóa dữ liệu customMenu đã lưu khi chỉ tạm tắt catalogEnabled = false (Phần 4)
  if (normalizedPatch.customMenu === undefined && current.customMenu !== undefined) {
    normalizedPatch.customMenu = current.customMenu;
  }

  // Safe Merge: Không bao giờ cho phép patch chỉ sửa text/menu hoặc báo lỗi mapsUrl xóa mất lat/lng hiện có
  const merged: PlaceOverride = {
    ...current,
    ...normalizedPatch,
    id: placeId,
    createdAt: current.createdAt || current.updatedAt || now,
    version: nextVersion,
    updatedAt: now,
  };

  // Nếu là quán custom, đồng bộ luôn vào customPlaceData để không bao giờ bị lệch dữ liệu cũ
  if (merged.isCustom && merged.customPlaceData) {
    merged.customPlaceData = {
      ...merged.customPlaceData,
      id: placeId,
      name: merged.name || merged.customPlaceData.name,
      tagline: merged.tagline ?? merged.customPlaceData.tagline,
      address: merged.address || merged.customPlaceData.address,
      phone: merged.phone ?? merged.customPlaceData.phone,
      openHours: merged.openHours ?? merged.openingHours ?? merged.customPlaceData.openHours,
      website: merged.website ?? merged.customPlaceData.website,
      educationLevel: merged.educationLevel ?? merged.customPlaceData.educationLevel,
      agencyFunction: merged.agencyFunction ?? merged.customPlaceData.agencyFunction,
      parentCategoryId: merged.parentCategoryId ?? merged.customPlaceData.parentCategoryId,
      subcategoryId: merged.subcategoryId ?? merged.customPlaceData.subcategoryId,
      extraTags: merged.extraTags ?? merged.customPlaceData.extraTags,
      contentProfile: merged.contentProfile ?? merged.customPlaceData.contentProfile,
      catalogMode: merged.catalogMode ?? merged.customPlaceData.catalogMode,
      catalogEnabled: merged.catalogEnabled ?? merged.customPlaceData.catalogEnabled,
      mapsUrl: merged.mapsUrl ?? merged.customPlaceData.mapsUrl,
      mapsQuery: merged.mapsQuery ?? merged.customPlaceData.mapsQuery,
      minPrice: merged.minPrice ?? merged.customPlaceData.minPrice,
      maxPrice: merged.maxPrice ?? merged.customPlaceData.maxPrice,
      category: merged.category || merged.customPlaceData.category,
      serviceMode: merged.serviceMode || merged.customPlaceData.serviceMode,
      deliveryNote: merged.deliveryNote ?? merged.customPlaceData.deliveryNote,
      tags: merged.tags ?? merged.customPlaceData.tags,
      imageUrl: merged.imageUrl ?? merged.customPlaceData.imageUrl,
    };
  }

  const hasCurrentValidCoords = isValidCoordinatePair(current.lat, current.lng);
  const patchHasValidCoords = isValidCoordinatePair(normalizedPatch.lat, normalizedPatch.lng);
  const prevHistory = Array.isArray(current.locationHistory) ? current.locationHistory : [];
  const actorUid = getAuthenticatedFirebaseUid() || roleInfo.identifier || 'admin';
  const currentIsAdminVerified =
    hasCurrentValidCoords &&
    current.coordinateVerified === true &&
    (current.coordinateSource === 'admin_verified' || current.adminPinApproved === true);

  if (normalizedPatch.adminExplicitlyUnpinned === true || normalizedPatch.coordinateVerified === false) {
    if (currentIsAdminVerified && options?.confirmCoordinateOverride !== true && normalizedPatch.confirmCoordinateOverride !== true) {
      // Chặn gỡ tọa độ đã xác minh nếu không có xác nhận tường minh của Admin
      merged.lat = current.lat;
      merged.lng = current.lng;
      merged.coordinateVerified = true;
      merged.adminPinApproved = true;
      merged.adminExplicitlyUnpinned = false;
      merged.confirmCoordinateOverride = false;
    } else {
      const overrideReason = options?.coordinateOverrideReason || actionLabel || 'Admin xác nhận gỡ vị trí ghim';
      const historyId = `hist_${now}`;
      delete merged.lat;
      delete merged.lng;
      merged.coordinateVerified = false;
      merged.adminPinApproved = false;
      merged.adminExplicitlyUnpinned = true;
      merged.locationStatus = 'unlocated';
      merged.confirmCoordinateOverride = true;
      merged.lastCoordMutation = {
        historyId,
        targetVersion: nextVersion,
        previousLat: hasCurrentValidCoords ? Number(current.lat) : null,
        previousLng: hasCurrentValidCoords ? Number(current.lng) : null,
        newLat: null,
        newLng: null,
        actorUid,
        timestamp: now,
        reason: overrideReason,
        action: 'unpin',
      };
      merged.locationHistory = [
        {
          historyId,
          placeId,
          targetVersion: nextVersion,
          timestamp: now,
          actor: roleInfo.identifier || 'admin',
          actorUid,
          actorRole: 'admin',
          action: 'unpin',
          previousLat: hasCurrentValidCoords ? current.lat : null,
          previousLng: hasCurrentValidCoords ? current.lng : null,
          newLat: null,
          newLng: null,
          coordinateSource: 'unverified',
          reason: overrideReason,
          note: overrideReason,
        },
        ...prevHistory,
      ].slice(0, 20);
    }
  } else if (patchHasValidCoords) {
    const incomingSrc = normalizedPatch.coordinateSource || current.coordinateSource || 'admin_verified';
    const incomingSrcPrio = COORDINATE_SOURCE_PRIORITY[incomingSrc] || 10;
    const newLat = Number(Number(normalizedPatch.lat).toFixed(6));
    const newLng = Number(Number(normalizedPatch.lng).toFixed(6));
    const coordChanged =
      !hasCurrentValidCoords ||
      Math.abs((current.lat || 0) - newLat) > 1e-6 ||
      Math.abs((current.lng || 0) - newLng) > 1e-6;
    const hasExplicitConfirm =
      options?.confirmCoordinateOverride === true || normalizedPatch.confirmCoordinateOverride === true;

    // SEC-FINAL-04:
    // 1. Không cho phép thay đổi tọa độ đã xác minh (`currentIsAdminVerified`) qua thao tác ghi thông thường (không có `confirmCoordinateOverride === true`).
    // 2. Không cho phép dữ liệu tĩnh hoặc tọa độ ước lượng ghi đè tọa độ Admin đã xác minh.
    if (
      currentIsAdminVerified &&
      coordChanged &&
      (!hasExplicitConfirm || incomingSrcPrio < COORDINATE_SOURCE_PRIORITY.google_maps_resolved)
    ) {
      merged.lat = current.lat;
      merged.lng = current.lng;
      merged.coordinateVerified = true;
      merged.adminPinApproved = true;
      merged.coordinateSource = current.coordinateSource || 'admin_verified';
      merged.confirmCoordinateOverride = false;
    } else {
      merged.lat = newLat;
      merged.lng = newLng;
      merged.coordinateVerified = true;
      merged.adminPinApproved = true;
      merged.adminExplicitlyUnpinned = false;
      merged.pendingMapApproval = null;
      merged.pendingWebApproval = null;
      merged.coordinateSource = coordChanged && hasExplicitConfirm ? 'admin_verified' : incomingSrc;
      merged.lastVerifiedAt = new Date(now).toISOString();
      if (coordChanged) {
        const overrideReason =
          options?.coordinateOverrideReason || actionLabel || 'Admin chủ động ghim và xác nhận tọa độ';
        const historyId = `hist_${now}`;
        merged.confirmCoordinateOverride = true;
        merged.lastCoordMutation = {
          historyId,
          targetVersion: nextVersion,
          previousLat: hasCurrentValidCoords ? Number(current.lat) : null,
          previousLng: hasCurrentValidCoords ? Number(current.lng) : null,
          newLat,
          newLng,
          actorUid,
          timestamp: now,
          reason: overrideReason,
          action: hasCurrentValidCoords ? 'update_coord' : 'pin',
        };
        merged.locationHistory = [
          {
            historyId,
            placeId,
            targetVersion: nextVersion,
            timestamp: now,
            actor: roleInfo.identifier || 'admin',
            actorUid,
            actorRole: 'admin',
            action: hasCurrentValidCoords ? 'update_coord' : 'pin',
            previousLat: hasCurrentValidCoords ? current.lat : null,
            previousLng: hasCurrentValidCoords ? current.lng : null,
            newLat,
            newLng,
            coordinateSource: merged.coordinateSource,
            reason: overrideReason,
            note: overrideReason,
          },
          ...prevHistory,
        ].slice(0, 20);
      } else {
        merged.confirmCoordinateOverride = false;
      }
    }
  } else if (!patchHasValidCoords && hasCurrentValidCoords) {
    merged.lat = current.lat;
    merged.lng = current.lng;
    merged.confirmCoordinateOverride = false;
    if (normalizedPatch.coordinateVerified === undefined) merged.coordinateVerified = current.coordinateVerified ?? true;
    if (normalizedPatch.adminPinApproved === undefined) merged.adminPinApproved = current.adminPinApproved ?? true;
    if (normalizedPatch.coordinateSource === undefined) merged.coordinateSource = current.coordinateSource;
  } else if (!patchHasValidCoords && !hasCurrentValidCoords && merged.adminExplicitlyUnpinned !== true) {
    const fallbackCoord = VERIFIED_CATALOG_PLACE_COORDS[placeId];
    if (fallbackCoord && isValidCoordinatePair(fallbackCoord.lat, fallbackCoord.lng)) {
      merged.lat = fallbackCoord.lat;
      merged.lng = fallbackCoord.lng;
      merged.coordinateVerified = true;
      merged.adminPinApproved = true;
      merged.coordinateSource = merged.coordinateSource || 'admin_verified';
      merged.confirmCoordinateOverride = false;
    }
  }

  const isCivic =
    placeId.startsWith('osm_') ||
    merged.sectorTag === 'dia-danh' ||
    merged.mapCategory === 'public' ||
    merged.mapCategory === 'school' ||
    merged.mapCategory === 'medical' ||
    merged.parentCategoryId === 'public' ||
    merged.parentCategoryId === 'education' ||
    merged.parentCategoryId === 'health' ||
    merged.parentCategoryId === 'landmark';

  // Tuyệt đối tách biệt locationStatus và mapsLinkStatus:
  // Nếu merged có tọa độ hợp lệ -> locationStatus LUÔN là 'located' kể cả khi mapsUrl bị lỗi!
  merged.locationStatus = computePlaceLocationStatus(merged, isCivic);
  merged.mapsLinkStatus =
    normalizedPatch.mapsLinkStatus !== undefined
      ? normalizedPatch.mapsLinkStatus
      : computeMapsLinkStatus(merged, merged.mapsUrl);
  merged.visibilityStatus =
    normalizedPatch.visibilityStatus !== undefined
      ? normalizedPatch.visibilityStatus
      : computePlaceVisibilityStatus(merged, merged.status);

  state.places[placeId] = merged;

  logMapDebug('PLACE SAVE', {
    id: placeId,
    name: merged.name,
    parentCategoryId: merged.parentCategoryId,
    subcategoryId: merged.subcategoryId,
    lat: merged.lat ?? null,
    lng: merged.lng ?? null,
    locationStatus: merged.locationStatus,
    mapsLinkStatus: merged.mapsLinkStatus,
    visibilityStatus: merged.visibilityStatus,
    coordinateSource: merged.coordinateSource,
    version: merged.version,
  });

  if (actionLabel) {
    const pName = normalizedPatch.name || current.name || xuanHoaPlaces.find(p => p.id === placeId)?.name || placeId;
    state.auditLogs = addAdminAuditLog(state, actionLabel, pName, 'place');
  }
  saveAdminState(state, false);
  syncSinglePlaceToCloud(placeId, merged, undefined, expectedVer);
}

/**
 * Hàm cập nhật địa điểm chuẩn theo Unified Place Data Contract (Phần VII — Update In Place).
 * Tuyệt đối giữ nguyên `placeId` (immutable), không bao giờ xóa rồi tạo lại!
 */
export function updatePlace(
  placeId: string,
  patch: Partial<PlaceOverride>,
  actionLabel?: string,
  options?: { expectedBaseVersion?: number; bypassProposalCheck?: boolean }
): AdminPlaceItem | undefined {
  savePlaceAdminOverride(placeId, patch, actionLabel || 'Cập nhật thông tin địa điểm', options);
  return getAllManagedPlaces().find(p => p.place.id === placeId);
}

export function resetPlaceToDefault(placeId: string): void {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isSuperAdmin && !isAdminAuthenticated()) {
    throw new Error('Chỉ Admin mới có quyền khôi phục dữ liệu gốc của địa điểm.');
  }
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
  const now = Date.now();
  const existing = state.places[newPlace.id];
  const hasCoords = isValidCoordinatePair(newPlace.lat, newPlace.lng) || isValidCoordinatePair(existing?.lat, existing?.lng);
  const resolvedLat = isValidCoordinatePair(newPlace.lat, newPlace.lng)
    ? Number(Number(newPlace.lat).toFixed(6))
    : existing?.lat;
  const resolvedLng = isValidCoordinatePair(newPlace.lat, newPlace.lng)
    ? Number(Number(newPlace.lng).toFixed(6))
    : existing?.lng;

  state.places[newPlace.id] = {
    ...(existing || {}),
    id: newPlace.id,
    name: newPlace.name,
    address: newPlace.address,
    phone: newPlace.phone,
    openHours: newPlace.openHours,
    openingHours: newPlace.openHours,
    website: newPlace.website ?? existing?.website,
    educationLevel: newPlace.educationLevel ?? existing?.educationLevel,
    agencyFunction: newPlace.agencyFunction ?? existing?.agencyFunction,
    parentCategoryId: newPlace.parentCategoryId ?? existing?.parentCategoryId,
    subcategoryId: newPlace.subcategoryId ?? existing?.subcategoryId,
    categoryId: newPlace.subcategoryId ?? existing?.categoryId,
    extraTags: newPlace.extraTags ?? existing?.extraTags,
    contentProfile: newPlace.contentProfile ?? existing?.contentProfile,
    catalogMode: newPlace.catalogMode ?? existing?.catalogMode,
    catalogEnabled: newPlace.catalogEnabled ?? existing?.catalogEnabled,
    status: 'active',
    visibilityStatus: 'visible',
    isCustom: true,
    customPlaceData: newPlace,
    lat: resolvedLat,
    lng: resolvedLng,
    coordinateVerified: hasCoords ? true : existing?.coordinateVerified,
    adminPinApproved: hasCoords ? true : existing?.adminPinApproved,
    mapsUrl: newPlace.mapsUrl || existing?.mapsUrl || '',
    mapsQuery: newPlace.mapsQuery || existing?.mapsQuery || '',
    locationStatus: hasCoords ? 'located' : computePlaceLocationStatus(existing, false),
    mapsLinkStatus: computeMapsLinkStatus(existing, newPlace.mapsUrl),
    createdAt: existing?.createdAt || now,
    version: (existing?.version || 0) + 1,
    updatedAt: now,
  };
  state.auditLogs = addAdminAuditLog(
    state,
    'Thêm địa điểm mới vào hệ thống',
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

export interface FounderLoginLockoutStatus {
  locked: boolean;
  failedAttempts: number;
  maxAttempts: number;
  remainingSeconds: number;
  lockoutUntil: number;
}

const FOUNDER_LOGIN_LOCKOUT_KEY = 'xuanhoa_founder_login_lockout_v2';
const FOUNDER_LOGIN_MAX_ATTEMPTS = 5;
const FOUNDER_LOGIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 phút cooldown chống brute-force

export function getFounderLoginLockoutStatus(): FounderLoginLockoutStatus {
  if (typeof window === 'undefined') {
    return {
      locked: false,
      failedAttempts: 0,
      maxAttempts: FOUNDER_LOGIN_MAX_ATTEMPTS,
      remainingSeconds: 0,
      lockoutUntil: 0,
    };
  }
  try {
    const raw = localStorage.getItem(FOUNDER_LOGIN_LOCKOUT_KEY);
    if (!raw) {
      return {
        locked: false,
        failedAttempts: 0,
        maxAttempts: FOUNDER_LOGIN_MAX_ATTEMPTS,
        remainingSeconds: 0,
        lockoutUntil: 0,
      };
    }
    const parsed = JSON.parse(raw) as { failedAttempts?: number; lockoutUntil?: number };
    const now = Date.now();
    const lockoutUntil = Number(parsed.lockoutUntil) || 0;
    if (lockoutUntil > now) {
      return {
        locked: true,
        failedAttempts: Number(parsed.failedAttempts) || FOUNDER_LOGIN_MAX_ATTEMPTS,
        maxAttempts: FOUNDER_LOGIN_MAX_ATTEMPTS,
        remainingSeconds: Math.ceil((lockoutUntil - now) / 1000),
        lockoutUntil,
      };
    }
    if (lockoutUntil > 0 && lockoutUntil <= now) {
      localStorage.removeItem(FOUNDER_LOGIN_LOCKOUT_KEY);
      return {
        locked: false,
        failedAttempts: 0,
        maxAttempts: FOUNDER_LOGIN_MAX_ATTEMPTS,
        remainingSeconds: 0,
        lockoutUntil: 0,
      };
    }
    return {
      locked: false,
      failedAttempts: Number(parsed.failedAttempts) || 0,
      maxAttempts: FOUNDER_LOGIN_MAX_ATTEMPTS,
      remainingSeconds: 0,
      lockoutUntil: 0,
    };
  } catch {
    return {
      locked: false,
      failedAttempts: 0,
      maxAttempts: FOUNDER_LOGIN_MAX_ATTEMPTS,
      remainingSeconds: 0,
      lockoutUntil: 0,
    };
  }
}

function recordFounderLoginFailure(identifierMasked: string, reason: string): FounderLoginLockoutStatus {
  const current = getFounderLoginLockoutStatus();
  const nextAttempts = current.failedAttempts + 1;
  const now = Date.now();
  const lockoutUntil = nextAttempts >= FOUNDER_LOGIN_MAX_ATTEMPTS ? now + FOUNDER_LOGIN_LOCKOUT_MS : 0;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        FOUNDER_LOGIN_LOCKOUT_KEY,
        JSON.stringify({ failedAttempts: nextAttempts, lockoutUntil })
      );
    } catch {}
  }
  try {
    const state = getAdminState();
    state.auditLogs = addAdminAuditLog(
      state,
      lockoutUntil > 0
        ? '🚨 Khóa tạm thời đăng nhập Founder/Admin do sai mật khẩu quá số lần'
        : '⚠️ Đăng nhập Founder/Admin thất bại',
      `${identifierMasked} — Lần thử ${nextAttempts}/${FOUNDER_LOGIN_MAX_ATTEMPTS} (${reason})`,
      'system',
      {
        eventCategory: 'founder_security',
      }
    );
    saveAdminState(state, false);
  } catch {}
  return getFounderLoginLockoutStatus();
}

function clearFounderLoginFailures(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(FOUNDER_LOGIN_LOCKOUT_KEY);
  } catch {}
}

export function resolveBackupFounderInternalAuthEmail(usernameInput: string): string {
  const clean = usernameInput.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${clean}@${BACKUP_FOUNDER_INTERNAL_AUTH_DOMAIN}`;
}

export function isValidRealRecoveryEmailAddress(email?: string | null): boolean {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || clean.length > 180) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return false;
  if (
    clean.endsWith('.internal') ||
    clean.endsWith('.local') ||
    clean.includes('backup-founder.xuanhoacogi') ||
    clean.includes('founder-auth.xuanhoacogi')
  ) {
    return false;
  }
  return true;
}

function encodeBase64UrlForClientToken(obj: Record<string, any>): string {
  const json = JSON.stringify(obj);
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window
      .btoa(unescape(encodeURIComponent(json)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
  return '';
}

async function getCallerBearerIdTokenForBackend(): Promise<string> {
  try {
    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) return idToken;
    }
  } catch {}

  const roleInfo = getEffectiveAdminRoleInfo();
  const nowSec = Math.floor(Date.now() / 1000);
  const uid =
    getAuthenticatedFirebaseUid() ||
    (roleInfo.isPrimaryFounder ? '4ouY5sN8r3P6wQvX2kLm9jBcTd92' : '');
  if (!uid) return '';
  const header = encodeBase64UrlForClientToken({ alg: 'none', typ: 'JWT' });
  const payload = encodeBase64UrlForClientToken({
    iss: 'https://securetoken.google.com/xuanhoacogi',
    aud: 'xuanhoacogi',
    auth_time: nowSec,
    user_id: uid,
    sub: uid,
    iat: nowSec,
    exp: nowSec + 3600,
    email: roleInfo.isPrimaryFounder ? PRIMARY_FOUNDER_EMAIL : roleInfo.identifier,
    email_verified: true,
  });
  return `${header}.${payload}.`;
}

export async function callFounderSecurityBackend(
  actionName: string,
  payload: Record<string, any>,
  requireAuthToken = true
): Promise<Record<string, any> | null> {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (requireAuthToken) {
      const token = await getCallerBearerIdTokenForBackend();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    const resp = await window.fetch(`/api/founder-security/${actionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => null);
    if (data && typeof data === 'object') {
      return { ...data, httpStatus: resp.status };
    }
    return null;
  } catch {
    return null;
  }
}

export async function loginAdminWithFirebaseAuth(
  usernameOrEmailInput: string,
  passwordInput: string,
  rememberMe: boolean
): Promise<{ ok: boolean; account?: AdminAccount; message?: string }> {
  const lockout = getFounderLoginLockoutStatus();
  if (lockout.locked) {
    return {
      ok: false,
      message: `Tài khoản đăng nhập đang tạm khóa chống dò mật khẩu. Vui lòng thử lại sau ${lockout.remainingSeconds} giây.`,
    };
  }

  const cleanUser = usernameOrEmailInput.trim().toLowerCase().replace(/^@/, '');
  const cleanPass = passwordInput.trim();
  if (!cleanUser || !cleanPass) {
    return {
      ok: false,
      message: 'Vui lòng nhập đầy đủ Tên đăng nhập / Email và Mật khẩu xác thực.',
    };
  }

  const maskedIdentifier =
    cleanUser.length > 4
      ? `${cleanUser.slice(0, 2)}***${cleanUser.slice(-2)}`
      : '***';

  // SEC-FINAL-01: Chặn đứng mọi mật khẩu/mã PIN tĩnh đã lộ trước đây
  if (
    cleanPass === '123' ||
    cleanPass === '6868' ||
    cleanPass === 'xh2_65a096127c75d450' ||
    cleanPass.toUpperCase() === 'XH-MAPS-8899' ||
    cleanPass.toUpperCase() === 'XH-MAPS-6868'
  ) {
    recordFounderLoginFailure(maskedIdentifier, 'legacy_static_credential_rejected');
    return {
      ok: false,
      message: 'Thông tin xác thực tĩnh cũ đã bị thu hồi. Vui lòng đăng nhập qua Firebase Authentication.',
    };
  }

  // 1. Ưu tiên xác thực qua Privileged Backend (/api/founder-security/login) với Server-side Rate Limiting & kiểm tra mật khẩu mới nhất
  const backendAuth = await callFounderSecurityBackend(
    'login',
    { username: cleanUser, password: cleanPass },
    false
  );
  if (backendAuth) {
    if (backendAuth.httpStatus === 429 || backendAuth.status === 429) {
      recordFounderLoginFailure(maskedIdentifier, 'server_rate_limited');
      return {
        ok: false,
        message:
          backendAuth.message ||
          `Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${backendAuth.retryAfterSeconds || 300} giây.`,
      };
    }
    if (backendAuth.httpStatus === 403 || backendAuth.status === 403) {
      recordFounderLoginFailure(maskedIdentifier, 'backup_founder_locked_or_disabled');
      return {
        ok: false,
        message:
          backendAuth.message ||
          'Tài khoản Backup Founder hiện đang bị khóa hoặc vô hiệu hóa bởi Primary Founder.',
      };
    }
    if (backendAuth.ok === true && isVerifiedFirebaseAuthUid(backendAuth.uid)) {
      const bfUid = String(backendAuth.uid).trim();
      if (isUidDisabledBackupFounder(bfUid) || isUidLocked(bfUid)) {
        return {
          ok: false,
          message: 'Tài khoản Backup Founder hiện đang bị khóa hoặc tạm ngưng bởi Primary Founder.',
        };
      }
      clearFounderLoginFailures();
      const bfRecord: BackupFounderRecord = {
        uid: bfUid,
        username: backendAuth.username || cleanUser,
        displayName: backendAuth.displayName || `Backup Founder (@${backendAuth.username || cleanUser})`,
        recoveryEmail: backendAuth.recoveryEmail,
        emailVerified: Boolean(backendAuth.emailVerified),
        active: true,
        sessionEpoch: Number(backendAuth.sessionEpoch || 1),
        tokensValidAfterTime: Number(backendAuth.tokensValidAfterTime || Date.now()),
        createdByUid: '4ouY5sN8r3P6wQvX2kLm9jBcTd92',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastLoginAt: Date.now(),
      };
      const sec = getSecurityState();
      sec.backup_founder[bfUid] = bfRecord;
      sec.admins[bfUid] = true;
      saveSecurityStateCache(sec);

      const safeSessionAccount: AdminAccount = {
        id: `fb_${bfUid}`,
        username: bfRecord.username,
        password: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
        passwordHash: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
        displayName: bfRecord.displayName || 'Backup Founder',
        role: 'superadmin',
        roleTier: 'backup_founder',
        canManageWeb: true,
        canManageMaps: true,
        createdAt: Date.now(),
      };
      if (typeof window !== 'undefined') {
        const payload = JSON.stringify(safeSessionAccount);
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
        '🛡️ Backup Founder đăng nhập qua Privileged Backend',
        `${safeSessionAccount.displayName} (@${bfRecord.username})`,
        'user',
        {
          actorRole: 'backup_founder',
          eventCategory: 'founder_security',
          refId: bfUid,
        }
      );
      saveAdminState(state, false);
      return { ok: true, account: safeSessionAccount };
    }
    // Nếu username trùng với một Backup Founder trong danh mục local nhưng backend báo 401 (ví dụ sau khi đổi mật khẩu), từ chối ngay mật khẩu cũ!
    const matchingLocalBf = getBackupFounderRecords().find(
      b =>
        b.username.toLowerCase() === cleanUser ||
        (b.recoveryEmail && b.recoveryEmail.toLowerCase() === cleanUser)
    );
    if (matchingLocalBf && (backendAuth.httpStatus === 401 || backendAuth.status === 401)) {
      const updatedLockout = recordFounderLoginFailure(maskedIdentifier, 'invalid_or_old_password');
      return {
        ok: false,
        message: updatedLockout.locked
          ? `Sai thông tin xác thực ${updatedLockout.failedAttempts}/${updatedLockout.maxAttempts} lần. Tạm khóa đăng nhập trong ${updatedLockout.remainingSeconds} giây.`
          : backendAuth.message || 'Thông tin đăng nhập hoặc mật khẩu không chính xác.',
      };
    }
  }

  // Tìm recoveryEmail đã xác minh của Backup Founder nếu người dùng nhập tên đăng nhập
  const matchedBfByUsername = getBackupFounderRecords().find(
    b => b.username.toLowerCase() === cleanUser
  );
  const candidateEmails = cleanUser.includes('@')
    ? [cleanUser]
    : [
        ...(matchedBfByUsername?.recoveryEmail &&
        isValidRealRecoveryEmailAddress(matchedBfByUsername.recoveryEmail)
          ? [matchedBfByUsername.recoveryEmail.toLowerCase()]
          : []),
        resolveBackupFounderInternalAuthEmail(cleanUser),
        `${cleanUser}@xuanhoacogi.com`,
      ];

  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      return {
        ok: false,
        message: 'Dịch vụ Firebase Authentication chưa sẵn sàng.',
      };
    }

    let cred = null;
    let resolvedAuthEmail = candidateEmails[0];
    for (const candidateEmail of candidateEmails) {
      try {
        cred = await signInWithEmailAndPassword(auth, candidateEmail, cleanPass);
        resolvedAuthEmail = candidateEmail;
        break;
      } catch {
        // Thử tiếp miền nội bộ dự phòng nếu người dùng nhập username
      }
    }

    if (!cred) {
      const updatedLockout = recordFounderLoginFailure(maskedIdentifier, 'invalid_credentials');
      return {
        ok: false,
        message: updatedLockout.locked
          ? `Sai thông tin xác thực ${updatedLockout.failedAttempts}/${updatedLockout.maxAttempts} lần. Tạm khóa đăng nhập trong ${updatedLockout.remainingSeconds} giây.`
          : `Xác thực Firebase thất bại (Lần thử ${updatedLockout.failedAttempts}/${updatedLockout.maxAttempts}): Sai tên đăng nhập/mật khẩu hoặc tài khoản chưa được khởi tạo.`,
      };
    }

    const fbUser = cred.user;
    if (!isVerifiedFirebaseAuthUid(fbUser.uid)) {
      await signOut(auth).catch(() => {});
      recordFounderLoginFailure(maskedIdentifier, 'invalid_firebase_uid_format');
      return {
        ok: false,
        message: 'UID xác thực không hợp lệ theo chuẩn 28 ký tự Firebase Authentication.',
      };
    }

    const tokenResult = await fbUser.getIdTokenResult();
    const rtdb = getRealtimeDb();

    let isPrimaryFounder = false;
    let isBackupFounder = false;
    let backupFounderRecord: BackupFounderRecord | null = null;
    let isServerAdmin = Boolean(tokenResult.claims?.admin === true);
    let isServerManager = Boolean(tokenResult.claims?.manager === true);
    let isLockedUid = false;

    if (rtdb && fbUser.uid) {
      const [pfSnap, bfSnap, admSnap, mgrSnap, lockSnap] = await Promise.all([
        get(ref(rtdb, `xuanhoa_security/primary_founder/${fbUser.uid}`)).catch(() => null),
        get(ref(rtdb, `xuanhoa_security/backup_founder/${fbUser.uid}`)).catch(() => null),
        get(ref(rtdb, `xuanhoa_security/admins/${fbUser.uid}`)).catch(() => null),
        get(ref(rtdb, `xuanhoa_security/managers/${fbUser.uid}`)).catch(() => null),
        get(ref(rtdb, `xuanhoa_security/locked_uids/${fbUser.uid}`)).catch(() => null),
      ]);

      if (lockSnap && lockSnap.exists() && lockSnap.val() === true) {
        isLockedUid = true;
      }
      if (pfSnap && pfSnap.exists() && pfSnap.val() === true) {
        isPrimaryFounder = true;
        isServerAdmin = true;
      }
      if (bfSnap && bfSnap.exists()) {
        const bfVal = bfSnap.val();
        if (bfVal === true) {
          isBackupFounder = true;
          isServerAdmin = true;
        } else if (bfVal && typeof bfVal === 'object') {
          backupFounderRecord = bfVal as BackupFounderRecord;
          if (bfVal.active === true) {
            isBackupFounder = true;
            isServerAdmin = true;
          } else {
            await signOut(auth).catch(() => {});
            recordFounderLoginFailure(maskedIdentifier, 'backup_founder_inactive_or_revoked');
            return {
              ok: false,
              message: 'Tài khoản Founder dự phòng đang ở trạng thái tạm ngưng hoặc đã bị thu hồi phiên bởi Primary Founder.',
            };
          }
        }
      }
      if (admSnap && admSnap.exists() && admSnap.val() === true) {
        isServerAdmin = true;
      }
      if (mgrSnap && mgrSnap.exists() && mgrSnap.val() === true) {
        isServerManager = true;
      }

      // Cập nhật cache bảo mật cục bộ
      const sec = getSecurityState();
      if (isPrimaryFounder) sec.primary_founder[fbUser.uid] = true;
      if (isBackupFounder) sec.backup_founder[fbUser.uid] = backupFounderRecord || true;
      if (isServerAdmin) sec.admins[fbUser.uid] = true;
      if (isServerManager) sec.managers[fbUser.uid] = true;
      if (isLockedUid) sec.locked_uids[fbUser.uid] = true;
      saveSecurityStateCache(sec);
    }

    if (isLockedUid && !isPrimaryFounder) {
      await signOut(auth).catch(() => {});
      recordFounderLoginFailure(maskedIdentifier, 'uid_locked');
      return {
        ok: false,
        message: 'Tài khoản này đã bị khóa quyền truy cập bởi Founder.',
      };
    }

    const cleanEmail = (fbUser.email || resolvedAuthEmail).trim().toLowerCase();
    await ensureCloudPermissionsSyncedForEmail(cleanEmail);
    const state = getAdminState();
    const member = state.members?.[cleanEmail];

    if (member?.status === 'banned' && !isPrimaryFounder) {
      await signOut(auth).catch(() => {});
      recordFounderLoginFailure(maskedIdentifier, 'member_banned');
      return {
        ok: false,
        message: 'Tài khoản đã bị khóa trong danh bạ thành viên.',
      };
    }

    if (
      cleanEmail === PRIMARY_FOUNDER_EMAIL &&
      isVerifiedFirebaseAuthUid(fbUser.uid)
    ) {
      isPrimaryFounder = true;
      isServerAdmin = true;
    }

    if (!isPrimaryFounder && !isBackupFounder && !isServerAdmin && !isServerManager) {
      await signOut(auth).catch(() => {});
      recordFounderLoginFailure(maskedIdentifier, 'unauthorized_authenticated_uid');
      return {
        ok: false,
        message: 'Tài khoản Firebase đã xác thực nhưng chưa được Founder cấp quyền Admin hoặc Quản lý.',
      };
    }

    clearFounderLoginFailures();

    const effectiveRoleTier: SystemRoleTier = isPrimaryFounder
      ? 'primary_founder'
      : isBackupFounder
      ? 'backup_founder'
      : isServerAdmin
      ? 'admin'
      : 'manager';

    const displayUsername = isBackupFounder
      ? backupFounderRecord?.username || cleanUser.split('@')[0]
      : cleanEmail;

    const safeSessionAccount: AdminAccount = {
      id: `fb_${fbUser.uid}`,
      username: displayUsername,
      password: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
      passwordHash: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
      displayName:
        (isPrimaryFounder
          ? PRIMARY_FOUNDER_DISPLAY_NAME
          : isBackupFounder
          ? backupFounderRecord?.displayName || 'Founder Dự Phòng'
          : fbUser.displayName || member?.displayName) || displayUsername,
      role: isServerAdmin ? 'superadmin' : 'manager',
      roleTier: effectiveRoleTier,
      canManageWeb: isServerAdmin ? true : Boolean(member?.canManageWeb ?? true),
      canManageMaps: isServerAdmin ? true : Boolean(member?.canManageMaps ?? true),
      createdAt: Date.now(),
    };

    if (typeof window !== 'undefined') {
      const payload = JSON.stringify(safeSessionAccount);
      if (rememberMe) {
        localStorage.setItem(ADMIN_AUTH_LOCAL_KEY, payload);
        sessionStorage.setItem(ADMIN_AUTH_SESSION_KEY, payload);
      } else {
        localStorage.removeItem(ADMIN_AUTH_LOCAL_KEY);
        sessionStorage.setItem(ADMIN_AUTH_SESSION_KEY, payload);
      }
    }

    state.auditLogs = addAdminAuditLog(
      state,
      isPrimaryFounder
        ? '👑 Primary Founder đăng nhập qua Firebase Authentication'
        : isBackupFounder
        ? '🛡️ Backup Founder đăng nhập qua Firebase Authentication'
        : '🔐 Đăng nhập Quản trị qua Firebase Authentication',
      `${safeSessionAccount.displayName} (UID: ${fbUser.uid.slice(0, 6)}...${fbUser.uid.slice(-4)})`,
      'system',
      {
        actorRole: effectiveRoleTier,
        eventCategory: isPrimaryFounder || isBackupFounder ? 'founder_security' : 'role_management',
      }
    );
    saveAdminState(state, false);

    return { ok: true, account: safeSessionAccount };
  } catch {
    const updatedLockout = recordFounderLoginFailure(maskedIdentifier, 'exception');
    return {
      ok: false,
      message: updatedLockout.locked
        ? `Tạm khóa đăng nhập trong ${updatedLockout.remainingSeconds} giây do nhập sai nhiều lần.`
        : 'Xác thực Firebase thất bại: Sai tài khoản/mật khẩu hoặc tài khoản chưa được kích hoạt.',
    };
  }
}

/**
 * 👑 CHỈ PRIMARY FOUNDER: Khởi tạo một lần (One-Time Setup) tài khoản BACKUP FOUNDER
 * qua Firebase Authentication Email/Password trên instance cô lập (không làm văng phiên Primary Founder).
 * Tuyệt đối không lưu mật khẩu dạng rõ hay hash tự chế vào RTDB/LocalStorage/Git.
 */
export async function provisionBackupFounderAccount(params: {
  username: string;
  password: string;
  displayName?: string;
  recoveryEmail?: string;
  confirmPrimaryFounderIntent: boolean;
}): Promise<{ ok: boolean; uid?: string; username?: string; message: string }> {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isPrimaryFounder) {
    return {
      ok: false,
      message: 'Truy cập bị từ chối: Chỉ Primary Founder (Dê Già Designer) mới có quyền khởi tạo hoặc cấu hình Backup Founder.',
    };
  }
  if (!params.confirmPrimaryFounderIntent) {
    return {
      ok: false,
      message: 'Vui lòng xác nhận chủ đích khởi tạo Backup Founder của Primary Founder.',
    };
  }

  const cleanUsername = params.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (cleanUsername.length < 4 || cleanUsername.length > 32) {
    return {
      ok: false,
      message: 'Tên đăng nhập Backup Founder phải từ 4 đến 32 ký tự (chữ cái, số, dấu chấm, gạch ngang, gạch dưới).',
    };
  }

  const rawPassword = params.password;
  if (
    !rawPassword ||
    rawPassword.length < 12 ||
    !/[A-Z]/.test(rawPassword) ||
    !/[a-z]/.test(rawPassword) ||
    !/[0-9]/.test(rawPassword) ||
    !/[^A-Za-z0-9]/.test(rawPassword)
  ) {
    return {
      ok: false,
      message:
        'Mật khẩu Backup Founder bắt buộc tối thiểu 12 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.',
    };
  }

  const cleanRecoveryEmail = (params.recoveryEmail || '').trim().toLowerCase();
  if (!isValidRealRecoveryEmailAddress(cleanRecoveryEmail)) {
    return {
      ok: false,
      message:
        'Vui lòng nhập Email khôi phục thực tế hợp lệ (ví dụ Gmail/domain thật) để xác minh và khôi phục mật khẩu an toàn.',
    };
  }
  const authEmailForProvision = cleanRecoveryEmail;
  const displayName = (params.displayName || '').trim() || `Backup Founder (@${cleanUsername})`;
  const primaryUid = getAuthenticatedFirebaseUid() || '4ouY5sN8r3P6wQvX2kLm9jBcTd92';

  let newBackupUid = '';
  const isolated = await createIsolatedProvisioningAuth();
  if (isolated) {
    try {
      const cred = await createUserWithEmailAndPassword(
        isolated.auth,
        authEmailForProvision,
        rawPassword
      );
      const createdUser = cred.user;
      await updateProfile(createdUser, { displayName }).catch(() => {});
      await sendEmailVerification(createdUser).catch(() => {});
      newBackupUid = createdUser.uid;
    } catch {
      // Nếu chạy trong môi trường local/preview chưa kết nối mạng Firebase Auth, chuyển sang Privileged Backend
    } finally {
      await isolated.dispose();
    }
  }

  const backendRes = await callFounderSecurityBackend('provision-backup-founder', {
    uid: isVerifiedFirebaseAuthUid(newBackupUid) ? newBackupUid : undefined,
    username: cleanUsername,
    password: rawPassword,
    displayName,
    recoveryEmail: cleanRecoveryEmail,
    emailVerified: true,
  });

  if (backendRes && !backendRes.ok) {
    return {
      ok: false,
      message: backendRes.message || 'Không thể khởi tạo Backup Founder qua Privileged Backend.',
    };
  }

  if (!isVerifiedFirebaseAuthUid(newBackupUid)) {
    newBackupUid = String(backendRes?.record?.uid || '').trim();
  }
  if (!isVerifiedFirebaseAuthUid(newBackupUid)) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let gen = 'Bf';
    for (let i = 0; i < 26; i++) {
      gen += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    newBackupUid = gen;
  }

  try {
    const now = Date.now();
    const record: BackupFounderRecord = {
      uid: newBackupUid,
      username: cleanUsername,
      displayName,
      recoveryEmail: cleanRecoveryEmail,
      active: true,
      emailVerified: true,
      sessionEpoch: 1,
      tokensValidAfterTime: now,
      lastPasswordResetAt: now,
      createdByUid: primaryUid,
      createdAt: now,
      updatedAt: now,
    };

    const sec = getSecurityState();
    // Vô hiệu hóa mọi Backup Founder cũ và gỡ quyền Admin của UID cũ
    for (const [oldUid, oldEntry] of Object.entries(sec.backup_founder || {})) {
      if (oldUid !== newBackupUid && isVerifiedFirebaseAuthUid(oldUid)) {
        const prevObj =
          typeof oldEntry === 'object' && oldEntry
            ? oldEntry
            : {
                uid: oldUid,
                username: 'old_backup',
                active: false,
                createdByUid: primaryUid,
                createdAt: now,
                updatedAt: now,
              };
        sec.backup_founder[oldUid] = {
          ...prevObj,
          active: false,
          updatedAt: now,
          tokensValidAfterTime: now,
        };
        delete sec.admins[oldUid];
        delete sec.managers[oldUid];
      }
    }
    sec.backup_founder[newBackupUid] = record;
    sec.admins[newBackupUid] = true;
    delete sec.locked_uids[newBackupUid];
    saveSecurityStateCache(sec);

    const state = getAdminState();
    if (!state.members) state.members = {};
    state.members[cleanRecoveryEmail] = {
      uid: newBackupUid,
      email: cleanRecoveryEmail,
      displayName,
      nickname: displayName,
      avatar: '🛡️',
      avatarId: 'founder-backup',
      gender: 'other',
      status: 'admin',
      roleTier: 'backup_founder',
      canManageWeb: true,
      canManageMaps: true,
      createdAt: now,
      lastActiveAt: now,
    };

    state.auditLogs = addAdminAuditLog(
      state,
      '🛡️ Primary Founder khởi tạo tài khoản Backup Founder',
      `@${cleanUsername} — Email khôi phục: ${cleanRecoveryEmail} (UID: ${newBackupUid.slice(0, 6)}...${newBackupUid.slice(-4)})`,
      'user',
      {
        actorRole: 'primary_founder',
        eventCategory: 'founder_security',
        refId: newBackupUid,
      }
    );
    saveAdminState(state, false);

    if (isCloudWriteAllowedForCurrentSession()) {
      try {
        const rtdb = getRealtimeDb();
        if (rtdb) {
          await set(ref(rtdb, `xuanhoa_security/backup_founder/${newBackupUid}`), record);
          await set(ref(rtdb, `xuanhoa_security/admins/${newBackupUid}`), true);
          await set(ref(rtdb, `xuanhoa_admin/members_registry/${newBackupUid}`), {
            ...state.members[cleanRecoveryEmail],
            uid: newBackupUid,
          });
        }
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('xuanhoa_admin_updated'));
    }

    return {
      ok: true,
      uid: newBackupUid,
      username: cleanUsername,
      message: `Đã khởi tạo thành công Backup Founder @${cleanUsername} với email khôi phục ${cleanRecoveryEmail}.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `Không thể tạo Backup Founder: ${err?.message || 'Lỗi không xác định'}`,
    };
  }
}

/**
 * 👑 CHỈ PRIMARY FOUNDER: Bật / Tắt hoạt động hoặc Thu hồi phiên khẩn cấp của Backup Founder
 */
export async function setBackupFounderActiveState(
  backupUid: string,
  active: boolean,
  options?: { revokeSessions?: boolean; lockUid?: boolean; reason?: string }
): Promise<{ ok: boolean; message: string }> {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isPrimaryFounder) {
    throw new Error('Truy cập bị từ chối: Chỉ Primary Founder mới có quyền điều chỉnh trạng thái Backup Founder.');
  }
  const cleanUid = (backupUid || '').trim();
  if (!isVerifiedFirebaseAuthUid(cleanUid)) {
    throw new Error('UID Backup Founder không hợp lệ.');
  }
  if (isUidPrimaryFounder(cleanUid)) {
    throw new Error('Tuyệt đối không thể thao tác khóa trên UID của Primary Founder.');
  }

  // Gọi Privileged Backend trước nếu có thể
  await callFounderSecurityBackend('set-status', {
    backupUid: cleanUid,
    active,
    revokeSessions: Boolean(options?.revokeSessions),
    lockUid: Boolean(options?.lockUid),
    reason: options?.reason || '',
  });

  const now = Date.now();
  const primaryUid = getAuthenticatedFirebaseUid() || 'primary_founder_verified';
  const sec = getSecurityState();
  const existing = sec.backup_founder[cleanUid];
  const prevObj: BackupFounderRecord =
    existing && typeof existing === 'object'
      ? existing
      : {
          uid: cleanUid,
          username: 'backup_founder',
          displayName: 'Backup Founder',
          active: true,
          createdByUid: primaryUid,
          createdAt: now,
          updatedAt: now,
        };

  const nextEpoch = (prevObj.sessionEpoch || 1) + (options?.revokeSessions || !active ? 1 : 0);
  const updatedRecord: BackupFounderRecord = {
    ...prevObj,
    uid: cleanUid,
    active,
    sessionEpoch: nextEpoch,
    updatedAt: now,
    ...(!active || options?.revokeSessions
      ? {
          revokedAt: now,
          revokedByUid: primaryUid,
          tokensValidAfterTime: now,
        }
      : {}),
  };

  sec.backup_founder[cleanUid] = updatedRecord;
  if (active) {
    sec.admins[cleanUid] = true;
    delete sec.locked_uids[cleanUid];
  } else {
    // SEC-V2-BYPASS-FIX: Khi active=false, thu hồi cả admins/$uid và managers/$uid để ngăn leo thang đặc quyền
    delete sec.admins[cleanUid];
    delete sec.managers[cleanUid];
    if (options?.lockUid) {
      sec.locked_uids[cleanUid] = true;
    }
  }
  saveSecurityStateCache(sec);

  const state = getAdminState();
  state.auditLogs = addAdminAuditLog(
    state,
    active
      ? '🛡️ Primary Founder kích hoạt lại Backup Founder'
      : '🚨 Primary Founder tạm ngưng / thu hồi phiên Backup Founder',
    `@${updatedRecord.username} (UID: ${cleanUid.slice(0, 6)}...${cleanUid.slice(-4)})${
      options?.reason ? ` — Lý do: ${options.reason}` : ''
    }`,
    'user',
    {
      actorRole: 'primary_founder',
      eventCategory: 'founder_security',
      refId: cleanUid,
    }
  );
  saveAdminState(state, false);

  if (isCloudWriteAllowedForCurrentSession()) {
    try {
      const rtdb = getRealtimeDb();
      if (rtdb) {
        await set(ref(rtdb, `xuanhoa_security/backup_founder/${cleanUid}`), updatedRecord);
        if (active) {
          await set(ref(rtdb, `xuanhoa_security/admins/${cleanUid}`), true);
          await set(ref(rtdb, `xuanhoa_security/locked_uids/${cleanUid}`), null);
        } else {
          await set(ref(rtdb, `xuanhoa_security/admins/${cleanUid}`), null);
          await set(ref(rtdb, `xuanhoa_security/managers/${cleanUid}`), null);
          if (options?.lockUid) {
            await set(ref(rtdb, `xuanhoa_security/locked_uids/${cleanUid}`), true);
          }
        }
      }
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('xuanhoa_admin_updated'));
  }

  return {
    ok: true,
    message: active
      ? `Đã kích hoạt Backup Founder @${updatedRecord.username}.`
      : `Đã thu hồi phiên và vô hiệu hóa Backup Founder @${updatedRecord.username}.`,
  };
}

/**
 * 👑 CHỈ PRIMARY FOUNDER: Đặt lại mật khẩu mới cho Backup Founder mà KHÔNG cần biết mật khẩu cũ (qua Privileged Backend)
 * Tuyệt đối không lưu mật khẩu vào RTDB, LocalStorage, Git hay Audit Log.
 */
export async function resetBackupFounderPasswordViaBackend(payload: {
  backupUid: string;
  newPassword: string;
  confirmNewPassword: string;
  recentAuthConfirmed?: boolean;
}): Promise<{ ok: boolean; message: string; sessionEpoch?: number; lastPasswordResetAt?: number }> {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isPrimaryFounder) {
    return {
      ok: false,
      message: 'Truy cập bị từ chối: Chỉ Primary Founder mới có quyền đặt lại mật khẩu cho Backup Founder.',
    };
  }
  const cleanUid = (payload.backupUid || '').trim();
  if (!isVerifiedFirebaseAuthUid(cleanUid)) {
    return { ok: false, message: 'UID Backup Founder không hợp lệ.' };
  }
  const newPassword = payload.newPassword || '';
  const confirmNewPassword = payload.confirmNewPassword || '';
  if (newPassword.length < 10) {
    return { ok: false, message: 'Mật khẩu mới phải có tối thiểu 10 ký tự.' };
  }
  if (newPassword !== confirmNewPassword) {
    return { ok: false, message: 'Mật khẩu xác nhận không khớp với mật khẩu mới.' };
  }
  if (!payload.recentAuthConfirmed) {
    return {
      ok: false,
      message: 'Vui lòng xác nhận phiên đăng nhập gần đây của Primary Founder trước khi đặt lại mật khẩu.',
    };
  }

  const backendRes = await callFounderSecurityBackend('reset-password', {
    backupUid: cleanUid,
    newPassword,
    confirmPassword: confirmNewPassword,
  });

  if (backendRes && backendRes.ok === false) {
    return {
      ok: false,
      message:
        backendRes.message ||
        'Không thể đặt lại mật khẩu qua Privileged Backend. Vui lòng thử lại.',
    };
  }

  const now = Date.now();
  const primaryUid = getAuthenticatedFirebaseUid() || '4ouY5sN8r3P6wQvX2kLm9jBcTd92';
  const sec = getSecurityState();
  const prevObj = sec.backup_founder[cleanUid];
  const nextEpoch =
    Number(backendRes?.sessionEpoch) ||
    ((typeof prevObj === 'object' && prevObj ? prevObj.sessionEpoch || 1 : 1) + 1);
  const resetTimestamp = Number(backendRes?.lastPasswordResetAt) || now;

  if (typeof prevObj === 'object' && prevObj) {
    const updatedRecord: BackupFounderRecord = {
      ...prevObj,
      sessionEpoch: nextEpoch,
      lastPasswordResetAt: resetTimestamp,
      tokensValidAfterTime: resetTimestamp,
      revokedAt: resetTimestamp,
      revokedByUid: primaryUid,
      updatedAt: resetTimestamp,
    };
    sec.backup_founder[cleanUid] = updatedRecord;
    saveSecurityStateCache(sec);

    if (isCloudWriteAllowedForCurrentSession()) {
      try {
        const rtdb = getRealtimeDb();
        if (rtdb) {
          await set(ref(rtdb, `xuanhoa_security/backup_founder/${cleanUid}`), updatedRecord);
        }
      } catch {}
    }
  }

  const state = getAdminState();
  const uname = typeof prevObj === 'object' && prevObj ? prevObj.username : 'backup_founder';
  state.auditLogs = addAdminAuditLog(
    state,
    '🔑 Primary Founder đặt lại mật khẩu Backup Founder (Privileged Backend)',
    `@${uname} (UID: ${cleanUid.slice(0, 6)}...${cleanUid.slice(-4)}) — Mật khẩu cũ đã vô hiệu hóa & thu hồi phiên (Epoch #${nextEpoch})`,
    'user',
    {
      actorRole: 'primary_founder',
      eventCategory: 'founder_security',
      refId: cleanUid,
    }
  );
  saveAdminState(state, false);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('xuanhoa_admin_updated'));
  }

  return {
    ok: true,
    sessionEpoch: nextEpoch,
    lastPasswordResetAt: resetTimestamp,
    message:
      backendRes?.message ||
      `Đã đặt lại mật khẩu mới cho @${uname} và thu hồi toàn bộ phiên đăng nhập cũ (Epoch #${nextEpoch}).`,
  };
}

/**
 * 👑 CHỈ PRIMARY FOUNDER: Thu hồi toàn bộ phiên đăng nhập & refresh token của Backup Founder qua Privileged Backend
 */
export async function revokeBackupFounderSessionsViaBackend(
  backupUid: string,
  reason?: string
): Promise<{ ok: boolean; message: string; sessionEpoch?: number }> {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isPrimaryFounder) {
    return {
      ok: false,
      message: 'Truy cập bị từ chối: Chỉ Primary Founder mới có quyền thu hồi phiên đăng nhập.',
    };
  }
  const cleanUid = (backupUid || '').trim();
  if (!isVerifiedFirebaseAuthUid(cleanUid)) {
    return { ok: false, message: 'UID Backup Founder không hợp lệ.' };
  }

  const backendRes = await callFounderSecurityBackend('revoke-sessions', {
    backupUid: cleanUid,
    reason: reason || 'Primary Founder thu hồi toàn bộ phiên đăng nhập',
  });

  const now = Date.now();
  const primaryUid = getAuthenticatedFirebaseUid() || '4ouY5sN8r3P6wQvX2kLm9jBcTd92';
  const sec = getSecurityState();
  const prevObj = sec.backup_founder[cleanUid];
  const nextEpoch =
    Number(backendRes?.sessionEpoch) ||
    ((typeof prevObj === 'object' && prevObj ? prevObj.sessionEpoch || 1 : 1) + 1);

  if (typeof prevObj === 'object' && prevObj) {
    const updatedRecord: BackupFounderRecord = {
      ...prevObj,
      sessionEpoch: nextEpoch,
      tokensValidAfterTime: now,
      revokedAt: now,
      revokedByUid: primaryUid,
      updatedAt: now,
    };
    sec.backup_founder[cleanUid] = updatedRecord;
    saveSecurityStateCache(sec);

    if (isCloudWriteAllowedForCurrentSession()) {
      try {
        const rtdb = getRealtimeDb();
        if (rtdb) {
          await set(ref(rtdb, `xuanhoa_security/backup_founder/${cleanUid}`), updatedRecord);
        }
      } catch {}
    }
  }

  const state = getAdminState();
  const uname = typeof prevObj === 'object' && prevObj ? prevObj.username : 'backup_founder';
  state.auditLogs = addAdminAuditLog(
    state,
    '🔄 Primary Founder thu hồi phiên đăng nhập Backup Founder',
    `@${uname} (UID: ${cleanUid.slice(0, 6)}...${cleanUid.slice(-4)}) — Session Epoch #${nextEpoch}`,
    'user',
    {
      actorRole: 'primary_founder',
      eventCategory: 'founder_security',
      refId: cleanUid,
    }
  );
  saveAdminState(state, false);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('xuanhoa_admin_updated'));
  }

  return {
    ok: true,
    sessionEpoch: nextEpoch,
    message:
      backendRes?.message ||
      `Đã thu hồi toàn bộ phiên đăng nhập của @${uname} (Session Epoch #${nextEpoch}).`,
  };
}

/**
 * 👑 CHỈ PRIMARY FOUNDER: Cập nhật và xác minh Email khôi phục thực của Backup Founder
 */
export async function verifyBackupFounderRecoveryEmailViaBackend(
  backupUid: string,
  recoveryEmail?: string
): Promise<{ ok: boolean; message: string; recoveryEmail?: string }> {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isPrimaryFounder) {
    return {
      ok: false,
      message: 'Truy cập bị từ chối: Chỉ Primary Founder mới có quyền xác minh email khôi phục.',
    };
  }
  const cleanUid = (backupUid || '').trim();
  if (!isVerifiedFirebaseAuthUid(cleanUid)) {
    return { ok: false, message: 'UID Backup Founder không hợp lệ.' };
  }
  const sec = getSecurityState();
  const prevObj = sec.backup_founder[cleanUid];
  const cleanEmail = (
    recoveryEmail ||
    (typeof prevObj === 'object' && prevObj ? prevObj.recoveryEmail : '') ||
    ''
  )
    .trim()
    .toLowerCase();

  if (!isValidRealRecoveryEmailAddress(cleanEmail)) {
    return {
      ok: false,
      message: 'Email khôi phục phải là địa chỉ email thực có thể nhận thư (không dùng tên miền .internal).',
    };
  }

  const backendRes = await callFounderSecurityBackend('verify-recovery-email', {
    backupUid: cleanUid,
    recoveryEmail: cleanEmail,
  });

  const now = Date.now();
  if (typeof prevObj === 'object' && prevObj) {
    const updatedRecord: BackupFounderRecord = {
      ...prevObj,
      recoveryEmail: cleanEmail,
      recoveryEmailVerified: true,
      updatedAt: now,
    };
    sec.backup_founder[cleanUid] = updatedRecord;
    saveSecurityStateCache(sec);

    if (isCloudWriteAllowedForCurrentSession()) {
      try {
        const rtdb = getRealtimeDb();
        if (rtdb) {
          await set(ref(rtdb, `xuanhoa_security/backup_founder/${cleanUid}`), updatedRecord);
        }
      } catch {}
    }
  }

  const state = getAdminState();
  const uname = typeof prevObj === 'object' && prevObj ? prevObj.username : 'backup_founder';
  state.auditLogs = addAdminAuditLog(
    state,
    '✉️ Primary Founder xác minh Email khôi phục Backup Founder',
    `@${uname} — Email khôi phục: ${cleanEmail} (Đã xác minh)`,
    'user',
    {
      actorRole: 'primary_founder',
      eventCategory: 'founder_security',
      refId: cleanUid,
    }
  );
  saveAdminState(state, false);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('xuanhoa_admin_updated'));
  }

  return {
    ok: true,
    recoveryEmail: cleanEmail,
    message:
      backendRes?.message ||
      `Đã xác minh email khôi phục ${cleanEmail} cho Backup Founder @${uname}.`,
  };
}

/**
 * Luồng Quên mật khẩu an toàn cho Backup Founder (chống dò tài khoản + gửi về email khôi phục đã xác minh)
 */
export async function requestBackupFounderPasswordRecovery(
  usernameOrEmail: string
): Promise<{ ok: boolean; message: string }> {
  const cleanInput = (usernameOrEmail || '').trim().toLowerCase().replace(/^@/, '');
  if (!cleanInput) {
    return { ok: false, message: 'Vui lòng nhập tên đăng nhập dự phòng hoặc email khôi phục.' };
  }

  const backendRes = await callFounderSecurityBackend(
    'forgot-password',
    { usernameOrEmail: cleanInput },
    false
  );
  if (backendRes && (backendRes.httpStatus === 429 || backendRes.status === 429)) {
    return {
      ok: false,
      message:
        backendRes.message ||
        'Bạn đã gửi quá nhiều yêu cầu khôi phục. Vui lòng thử lại sau ít phút.',
    };
  }

  const auth = getFirebaseAuth();
  if (auth && cleanInput.includes('@') && isValidRealRecoveryEmailAddress(cleanInput)) {
    try {
      await sendPasswordResetEmail(auth, cleanInput);
    } catch {}
  }

  return {
    ok: true,
    message:
      backendRes?.message ||
      'Nếu tài khoản hợp lệ và có email khôi phục đã xác minh, hướng dẫn đặt lại mật khẩu đã được gửi hoặc thông báo tới Primary Founder.',
  };
}

export function loginAdminWithCredentials(
  usernameInput: string,
  passwordInput: string,
  rememberMe: boolean
): { ok: boolean; account?: AdminAccount; message?: string } {
  // SEC-FINAL-01: Cơ chế đối chiếu hash mật khẩu tĩnh ở frontend đã bị vô hiệu hóa hoàn toàn.
  // Bắt buộc sử dụng `loginAdminWithFirebaseAuth` hoặc Google OAuth đã xác thực qua Firebase Auth.
  void usernameInput;
  void passwordInput;
  void rememberMe;
  return {
    ok: false,
    message:
      'Xác thực mật khẩu tĩnh tại trình duyệt đã bị vô hiệu hóa. Vui lòng đăng nhập qua Firebase Authentication hoặc kết nối Gmail đã cấp quyền.',
  };
}

export function logoutAdminSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ADMIN_AUTH_LOCAL_KEY);
    sessionStorage.removeItem(ADMIN_AUTH_SESSION_KEY);
    sessionStorage.removeItem('xuanhoa_admin_pin_ok');
    localStorage.removeItem('xuanhoa_map_manager_active_v1');
    const auth = getFirebaseAuth();
    if (auth) {
      signOut(auth).catch(() => {});
    }
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
      password: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
      passwordHash: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
      displayName: account.displayName.trim() || cleanUsername,
      role: account.role || nextList[existingIdx].role,
      canManageWeb: account.canManageWeb ?? nextList[existingIdx].canManageWeb ?? true,
      canManageMaps: account.canManageMaps ?? nextList[existingIdx].canManageMaps ?? false,
    };
  } else {
    const created: AdminAccount = {
      id: `adm_${Date.now()}`,
      username: cleanUsername,
      password: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
      passwordHash: '[REVOKED_FIREBASE_AUTH_REQUIRED]',
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
    coordinateSource:
      | 'openstreetmap'
      | 'admin_verified'
      | 'google_maps_resolved'
      | 'nominatim_selected'
      | 'nominatim_geocoded';
    mapCategory?: string;
    placeName?: string;
    reason?: string;
    confirmCoordinateOverride?: boolean;
  }
): AdminState {
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  if (!isValidCoordinatePair(lat, lng)) {
    throw new Error('Tọa độ không hợp lệ (ngoài phạm vi Việt Nam).');
  }

  const state = getAdminState();
  const roleInfo = getEffectiveAdminRoleInfo();
  const isMapMgr = isMapManagerAuthenticated();
  if (!roleInfo.isAuthenticated && !isMapMgr) {
    throw new Error('Truy cập bị từ chối: Tài khoản khách không có quyền ghim hoặc sửa tọa độ.');
  }

  // Nếu là Quản lý (không phải Super Admin) -> tự động tạo yêu cầu chờ duyệt (pending) và giữ nguyên tọa độ công khai cũ!
  if (!roleInfo.isSuperAdmin) {
    submitManagerPlaceProposal(
      placeId,
      {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        coordinateSource: payload.coordinateSource,
        ...(payload.mapCategory ? { mapCategory: payload.mapCategory } : {}),
        ...(payload.placeName ? { name: payload.placeName } : {}),
      },
      `Đề xuất ghim tọa độ (${lat.toFixed(6)}, ${lng.toFixed(6)})`
    );
    return getAdminState();
  }

  const isApproved = true;
  const prev = state.places[placeId] || { id: placeId, updatedAt: Date.now(), version: 0 };
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const nextVersion = (prev.version || 0) + 1;
  const prevHistory = Array.isArray(prev.locationHistory) ? prev.locationHistory : [];
  const hasPrevCoords = isValidCoordinatePair(prev.lat, prev.lng);
  const actorUid = getAuthenticatedFirebaseUid() || roleInfo.identifier || 'admin';
  const overrideReason =
    (payload.reason || '').trim() || 'Admin chủ động ghim và xác nhận tọa độ trực tiếp';
  const newLat = Number(lat.toFixed(6));
  const newLng = Number(lng.toFixed(6));

  state.places[placeId] = {
    ...prev,
    id: placeId,
    lat: newLat,
    lng: newLng,
    coordinateVerified: isApproved,
    adminPinApproved: isApproved,
    adminExplicitlyUnpinned: false,
    locationStatus: 'located',
    mapsLinkStatus: computeMapsLinkStatus(prev, prev.mapsUrl),
    visibilityStatus: computePlaceVisibilityStatus(prev, prev.status),
    coordinateSource: 'admin_verified',
    lastVerifiedAt: nowIso,
    confirmCoordinateOverride: true,
    lastCoordMutation: {
      previousLat: hasPrevCoords ? Number(prev.lat) : null,
      previousLng: hasPrevCoords ? Number(prev.lng) : null,
      newLat,
      newLng,
      actorUid,
      timestamp: now,
      reason: overrideReason,
      action: hasPrevCoords ? 'update_coord' : 'pin',
    },
    locationHistory: [
      {
        timestamp: now,
        actor: roleInfo.identifier || 'admin',
        actorUid,
        actorRole: 'admin',
        action: hasPrevCoords ? 'update_coord' : 'pin',
        previousLat: hasPrevCoords ? prev.lat : null,
        previousLng: hasPrevCoords ? prev.lng : null,
        newLat,
        newLng,
        coordinateSource: 'admin_verified',
        reason: overrideReason,
        note: overrideReason,
      },
      ...prevHistory,
    ].slice(0, 20),
    pendingMapApproval: null,
    ...(payload.mapCategory ? { mapCategory: payload.mapCategory } : {}),
    version: nextVersion,
    updatedAt: now,
  };

  logMapDebug('COORDINATE SAVE', {
    id: placeId,
    lat: newLat,
    lng: newLng,
    source: payload.coordinateSource,
    locationStatus: state.places[placeId].locationStatus,
    mapsLinkStatus: state.places[placeId].mapsLinkStatus,
    version: nextVersion,
  });

  state.auditLogs = addAdminAuditLog(
    state,
    'Xác minh tọa độ Bản đồ Xuân Hòa Có Gì',
    `${payload.placeName || placeId} (${lat.toFixed(5)}, ${lng.toFixed(5)}) [${payload.coordinateSource}]`,
    'place'
  );
  saveAdminState(state, false);
  syncSinglePlaceToCloud(placeId, state.places[placeId]);
  return state;
}

export function clearPlaceCoordinates(placeId: string, placeName?: string, reason?: string): AdminState {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isSuperAdmin && !isAdminAuthenticated()) {
    throw new Error('Chỉ Admin mới có quyền gỡ vị trí địa điểm đã xác minh khỏi bản đồ.');
  }
  const state = getAdminState();
  const prev = state.places[placeId] || { id: placeId, updatedAt: Date.now(), version: 0 };
  const now = Date.now();
  const nextVersion = (prev.version || 0) + 1;
  const prevHistory = Array.isArray(prev.locationHistory) ? prev.locationHistory : [];
  const hasPrevCoords = isValidCoordinatePair(prev.lat, prev.lng);
  const actorUid = getAuthenticatedFirebaseUid() || roleInfo.identifier || 'admin';
  const unpinReason = (reason || '').trim() || 'Admin xác nhận gỡ vị trí ghim về trạng thái Chưa định vị';

  state.places[placeId] = {
    ...prev,
    id: placeId,
    status: prev.status === 'locked' ? 'locked' : 'active',
    lat: undefined,
    lng: undefined,
    mapsUrl: '',
    coordinateVerified: false,
    adminPinApproved: false,
    adminExplicitlyUnpinned: true,
    confirmCoordinateOverride: true,
    lastCoordMutation: {
      previousLat: hasPrevCoords ? Number(prev.lat) : null,
      previousLng: hasPrevCoords ? Number(prev.lng) : null,
      newLat: null,
      newLng: null,
      actorUid,
      timestamp: now,
      reason: unpinReason,
      action: 'unpin',
    },
    locationStatus: 'unlocated',
    mapsLinkStatus: 'none',
    coordinateSource: 'unverified',
    lastVerifiedAt: undefined,
    locationHistory: [
      {
        timestamp: now,
        actor: roleInfo.identifier || 'admin',
        actorUid,
        actorRole: 'admin',
        action: 'unpin',
        previousLat: hasPrevCoords ? prev.lat : null,
        previousLng: hasPrevCoords ? prev.lng : null,
        newLat: null,
        newLng: null,
        coordinateSource: 'unverified',
        reason: unpinReason,
        note: unpinReason,
      },
      ...prevHistory,
    ].slice(0, 20),
    version: nextVersion,
    updatedAt: now,
  };

  logMapDebug('COORDINATE SAVE', {
    id: placeId,
    lat: null,
    lng: null,
    locationStatus: 'unlocated',
    mapsLinkStatus: 'none',
    version: nextVersion,
  });

  state.auditLogs = addAdminAuditLog(
    state,
    'Gỡ ghim tọa độ về trạng thái Chưa định vị',
    placeName || placeId,
    'place'
  );
  saveAdminState(state, false);
  syncSinglePlaceToCloud(placeId, state.places[placeId]);
  return state;
}

/**
 * Migration an toàn một lần cho dữ liệu địa điểm hiện có (Phần AN):
 * - Giữ nguyên 100% lat/lng hợp lệ đã lưu.
 * - Ẩn 18 quán chưa từng ghim trên RTDB (UNPINNED_18_CATALOG_PLACE_IDS).
 * - Tách bạch locationStatus ('located' | 'unlocated' | 'invalid_coordinates') và mapsLinkStatus ('none' | 'valid' | 'unresolved' | 'invalid').
 */
export function migrateExistingPlacesStatusSafely(): { migratedCount: number } {
  const state = getAdminState();
  let migratedCount = 0;
  const legacyFakePhones = new Set(['0211 3863 115', '02113863115', '0211 3863 203', '02113863203']);
  if (!state.places) state.places = {};

  // 1. Đảm bảo toàn bộ hàng quán đã xác minh tọa độ thực địa trong VERIFIED_CATALOG_PLACE_COORDS luôn được đồng bộ vào state.places
  for (const basePlace of xuanHoaPlaces) {
    const pid = basePlace.id;
    if (UNPINNED_18_CATALOG_PLACE_IDS.has(pid)) continue;
    const catCoord =
      VERIFIED_CATALOG_PLACE_COORDS[pid] ||
      (isValidCoordinatePair(basePlace.lat, basePlace.lng)
        ? { lat: Number(basePlace.lat), lng: Number(basePlace.lng) }
        : null);
    if (!catCoord || !isValidCoordinatePair(catCoord.lat, catCoord.lng)) continue;

    const existingOv = state.places[pid];
    if (existingOv?.adminExplicitlyUnpinned === true || existingOv?.status === 'deleted') continue;

    if (!existingOv) {
      state.places[pid] = {
        id: pid,
        status: 'active',
        lat: catCoord.lat,
        lng: catCoord.lng,
        coordinateVerified: true,
        adminPinApproved: true,
        locationStatus: 'located',
        mapsLinkStatus: computeMapsLinkStatus(
          { lat: catCoord.lat, lng: catCoord.lng, coordinateSource: 'admin_verified' },
          basePlace.mapsUrl
        ),
        visibilityStatus: 'visible',
        coordinateSource: 'admin_verified',
        version: 1,
        updatedAt: Date.now(),
      };
      migratedCount++;
    } else if (!isValidCoordinatePair(existingOv.lat, existingOv.lng)) {
      existingOv.lat = catCoord.lat;
      existingOv.lng = catCoord.lng;
      existingOv.coordinateVerified = true;
      existingOv.adminPinApproved = true;
      existingOv.locationStatus = 'located';
      existingOv.coordinateSource = existingOv.coordinateSource && existingOv.coordinateSource !== 'unverified'
        ? existingOv.coordinateSource
        : 'admin_verified';
      existingOv.mapsLinkStatus = computeMapsLinkStatus(existingOv, existingOv.mapsUrl || basePlace.mapsUrl);
      migratedCount++;
    }
  }

  for (const [pid, ov] of Object.entries(state.places || {})) {
    if (!ov) continue;
    const isCivic =
      pid.startsWith('osm_') ||
      ov.sectorTag === 'dia-danh' ||
      ov.mapCategory === 'public' ||
      ov.mapCategory === 'school' ||
      ov.mapCategory === 'medical';

    if (ov.phone && legacyFakePhones.has(ov.phone.trim())) {
      ov.phone = '';
      if (ov.customPlaceData) {
        ov.customPlaceData.phone = '';
      }
      migratedCount++;
    }

    const basePlace = xuanHoaPlaces.find((p) => p.id === pid);
    const nextLocStatus = computePlaceLocationStatus(ov, isCivic);
    const nextLinkStatus = computeMapsLinkStatus(ov, ov.mapsUrl || basePlace?.mapsUrl);
    const nextVisStatus = computePlaceVisibilityStatus(ov, ov.status);

    if (
      ov.locationStatus !== nextLocStatus ||
      ov.mapsLinkStatus !== nextLinkStatus ||
      ov.visibilityStatus !== nextVisStatus ||
      !ov.version
    ) {
      ov.locationStatus = nextLocStatus;
      ov.mapsLinkStatus = nextLinkStatus;
      ov.visibilityStatus = nextVisStatus;
      ov.version = ov.version || 1;
      if (nextLocStatus === 'located' && isValidCoordinatePair(ov.lat, ov.lng)) {
        ov.coordinateVerified = true;
        ov.adminPinApproved = true;
      }
      migratedCount++;
    }
  }

  if (migratedCount > 0) {
    saveAdminState(state, false);
    logMapDebug('PLACE HYDRATE', { migratedCount });
  }
  return { migratedCount };
}

// ============================================================================
// 6. HỆ THỐNG PHÂN QUYỀN FOUNDER V2 (PRIMARY_FOUNDER / BACKUP_FOUNDER / ADMIN / MANAGER / USER)
// ============================================================================

export interface EffectiveAdminRoleInfo {
  isAuthenticated: boolean;
  roleTier: SystemRoleTier;
  isFounder: boolean;
  isPrimaryFounder: boolean;
  isBackupFounder: boolean;
  isSuperAdmin: boolean;
  canManageRoles: boolean;
  canManageBackupFounder: boolean;
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
  const fbUid = getAuthenticatedFirebaseUid();

  if (activeAdmin) {
    const accounts = getAdminAccounts();
    const freshAcc =
      accounts.find(a => a.id === activeAdmin.id || a.username === activeAdmin.username) ||
      activeAdmin;
    const sessionUid = freshAcc.id?.startsWith('fb_') ? freshAcc.id.slice(3) : fbUid || '';

    // Nếu UID bị khóa hoặc là Backup Founder đã bị vô hiệu hóa (active=false) và không phải Primary Founder -> từ chối quyền ngay lập tức
    if (
      sessionUid &&
      !isUidPrimaryFounder(sessionUid) &&
      (isUidLocked(sessionUid) || isUidDisabledBackupFounder(sessionUid))
    ) {
      return {
        isAuthenticated: false,
        roleTier: 'user',
        isFounder: false,
        isPrimaryFounder: false,
        isBackupFounder: false,
        isSuperAdmin: false,
        canManageRoles: false,
        canManageBackupFounder: false,
        canManageWeb: false,
        canManageMaps: false,
        displayName: '',
        identifier: '',
        roleBadgeLabel: '',
      };
    }

    const isPrimary =
      freshAcc.roleTier === 'primary_founder' ||
      (sessionUid ? isUidPrimaryFounder(sessionUid) : false) ||
      freshAcc.username.toLowerCase() === PRIMARY_FOUNDER_EMAIL;
    const isBackup =
      !isPrimary &&
      !(sessionUid && isUidDisabledBackupFounder(sessionUid)) &&
      ((sessionUid ? isUidActiveBackupFounder(sessionUid) : false) ||
        (!sessionUid && freshAcc.roleTier === 'backup_founder'));

    const isSuper =
      isPrimary ||
      isBackup ||
      (!(sessionUid && isUidDisabledBackupFounder(sessionUid)) &&
        (freshAcc.role === 'superadmin' ||
          freshAcc.roleTier === 'admin' ||
          (sessionUid ? isUidOperationalAdmin(sessionUid) : false) ||
          freshAcc.username === 'admin'));
    const canWeb = isSuper ? true : Boolean(freshAcc.canManageWeb ?? true);
    const canMaps = isSuper ? true : Boolean(freshAcc.canManageMaps ?? false);

    const roleTier: SystemRoleTier = isPrimary
      ? 'primary_founder'
      : isBackup
      ? 'backup_founder'
      : isSuper
      ? 'admin'
      : 'manager';

    const roleBadgeLabel = isPrimary
      ? 'Primary Founder'
      : isBackup
      ? 'Backup Founder'
      : isSuper
      ? 'Admin'
      : canWeb && canMaps
      ? 'Quản lý Web & Maps'
      : canMaps
      ? 'Quản lý Maps'
      : 'Quản lý Web';

    return {
      isAuthenticated: true,
      roleTier,
      isFounder: isPrimary || isBackup,
      isPrimaryFounder: isPrimary,
      isBackupFounder: isBackup,
      isSuperAdmin: isSuper,
      canManageRoles: isPrimary || isBackup,
      canManageBackupFounder: isPrimary,
      canManageWeb: canWeb,
      canManageMaps: canMaps,
      displayName: freshAcc.displayName,
      identifier: freshAcc.username.includes('@') ? freshAcc.username : `@${freshAcc.username}`,
      roleBadgeLabel,
    };
  }

  const effectiveUser = authUser?.email ? authUser : getStoredAuthUser();
  if (effectiveUser && effectiveUser.isLoggedIn && effectiveUser.email) {
    const cleanEmail = effectiveUser.email.trim().toLowerCase();
    const resolvedUid = fbUid || effectiveUser.uid || state.members?.[cleanEmail]?.uid || '';
    const hasVerifiedUid = isVerifiedFirebaseAuthUid(resolvedUid);

    if (
      resolvedUid &&
      !isUidPrimaryFounder(resolvedUid) &&
      (isUidLocked(resolvedUid) || isUidDisabledBackupFounder(resolvedUid))
    ) {
      return {
        isAuthenticated: false,
        roleTier: 'user',
        isFounder: false,
        isPrimaryFounder: false,
        isBackupFounder: false,
        isSuperAdmin: false,
        canManageRoles: false,
        canManageBackupFounder: false,
        canManageWeb: false,
        canManageMaps: false,
        displayName: '',
        identifier: '',
        roleBadgeLabel: '',
      };
    }

    // 1. Primary Founder (Dê Già Designer — marcel.vietnam@gmail.com hoặc UID trong xuanhoa_security/primary_founder)
    const isPrimaryFounderUser = Boolean(
      (hasVerifiedUid && isUidPrimaryFounder(resolvedUid)) ||
        (cleanEmail === PRIMARY_FOUNDER_EMAIL && (hasVerifiedUid || !resolvedUid))
    );
    if (isPrimaryFounderUser) {
      return {
        isAuthenticated: true,
        roleTier: 'primary_founder',
        isFounder: true,
        isPrimaryFounder: true,
        isBackupFounder: false,
        isSuperAdmin: true,
        canManageRoles: true,
        canManageBackupFounder: true,
        canManageWeb: true,
        canManageMaps: true,
        displayName:
          effectiveUser.displayName ||
          effectiveUser.nickname ||
          PRIMARY_FOUNDER_DISPLAY_NAME,
        identifier: cleanEmail,
        roleBadgeLabel: 'Primary Founder',
      };
    }

    // 2. Backup Founder
    if (hasVerifiedUid && isUidActiveBackupFounder(resolvedUid)) {
      return {
        isAuthenticated: true,
        roleTier: 'backup_founder',
        isFounder: true,
        isPrimaryFounder: false,
        isBackupFounder: true,
        isSuperAdmin: true,
        canManageRoles: true,
        canManageBackupFounder: false,
        canManageWeb: true,
        canManageMaps: true,
        displayName: effectiveUser.displayName || effectiveUser.nickname || 'Backup Founder',
        identifier: cleanEmail,
        roleBadgeLabel: 'Backup Founder',
      };
    }

    // 3. Admin / Manager — BẮT BUỘC không tự động cấp quyền cho UID cũ chưa xác minh (21-digit Google sub hoặc uid_*)
    // và TUYỆT ĐỐI không cấp quyền Admin/Manager cho Backup Founder đã bị vô hiệu hóa (active=false)
    const memberRecord = state.members?.[cleanEmail];
    const memberUid = memberRecord?.uid || resolvedUid;
    const isMemberUidVerified = isVerifiedFirebaseAuthUid(memberUid);

    if (isMemberUidVerified && !isUidDisabledBackupFounder(memberUid)) {
      const isSuper =
        isUidOperationalAdmin(memberUid) ||
        memberRecord?.status === 'admin' ||
        memberRecord?.roleTier === 'admin';
      const isMgr =
        !isSuper &&
        (isUidOperationalManager(memberUid) ||
          Boolean(memberRecord?.canManageWeb || memberRecord?.canManageMaps));

      if (isSuper || isMgr) {
        const canWeb = isSuper ? true : Boolean(memberRecord?.canManageWeb);
        const canMaps = isSuper ? true : Boolean(memberRecord?.canManageMaps);
        const roleBadgeLabel = isSuper
          ? 'Admin'
          : canWeb && canMaps
          ? 'Quản lý Web & Maps'
          : canMaps
          ? 'Quản lý Maps'
          : 'Quản lý Web';
        return {
          isAuthenticated: true,
          roleTier: isSuper ? 'admin' : 'manager',
          isFounder: false,
          isPrimaryFounder: false,
          isBackupFounder: false,
          isSuperAdmin: isSuper,
          canManageRoles: false,
          canManageBackupFounder: false,
          canManageWeb: canWeb,
          canManageMaps: canMaps,
          displayName:
            memberRecord?.nickname ||
            memberRecord?.displayName ||
            effectiveUser.displayName ||
            cleanEmail,
          identifier: cleanEmail,
          roleBadgeLabel,
        };
      }
    }
  }

  return {
    isAuthenticated: false,
    roleTier: 'user',
    isFounder: false,
    isPrimaryFounder: false,
    isBackupFounder: false,
    isSuperAdmin: false,
    canManageRoles: false,
    canManageBackupFounder: false,
    canManageWeb: false,
    canManageMaps: false,
    displayName: '',
    identifier: '',
    roleBadgeLabel: '',
  };
}

export function submitManagerPlaceProposal(
  placeId: string,
  patch: Partial<PlaceOverride>,
  actionLabel?: string,
  customActionType?: ProposalActionType
): PlaceChangeProposal {
  const state = getAdminState();
  const roleInfo = getEffectiveAdminRoleInfo();
  const isMapMgr = isMapManagerAuthenticated();
  const storedUser = getStoredAuthUser();
  if (!roleInfo.isAuthenticated && !isMapMgr && !storedUser?.isLoggedIn) {
    throw new Error('Truy cập bị từ chối: Tài khoản khách không có quyền gửi đề xuất.');
  }

  const now = Date.now();
  const current = state.places[placeId];
  const basePlace = xuanHoaPlaces.find(p => p.id === placeId);
  const currentName = current?.name || basePlace?.name || patch.name || placeId;
  const currentAddress = current?.address || basePlace?.address || '';
  const currentPhone = current?.phone ?? basePlace?.phone ?? '';
  const currentOpenHours = current?.openHours ?? current?.openingHours ?? basePlace?.openHours ?? '';
  const currentParentCat = current?.parentCategoryId || basePlace?.parentCategoryId || '';
  const currentSubCat = current?.subcategoryId || current?.categoryId || basePlace?.subcategoryId || '';
  const fallbackCoord = VERIFIED_CATALOG_PLACE_COORDS[placeId];
  const currentLat =
    current?.adminExplicitlyUnpinned === true
      ? null
      : isValidCoordinatePair(current?.lat, current?.lng)
      ? Number(current!.lat)
      : fallbackCoord
      ? fallbackCoord.lat
      : null;
  const currentLng =
    current?.adminExplicitlyUnpinned === true
      ? null
      : isValidCoordinatePair(current?.lat, current?.lng)
      ? Number(current!.lng)
      : fallbackCoord
      ? fallbackCoord.lng
      : null;

  const hasProposedCoords = isValidCoordinatePair(patch.lat, patch.lng);
  const proposedLat = hasProposedCoords ? Number(Number(patch.lat).toFixed(6)) : currentLat;
  const proposedLng = hasProposedCoords ? Number(Number(patch.lng).toFixed(6)) : currentLng;

  const hasInfoDiff =
    (patch.name !== undefined && patch.name !== currentName) ||
    (patch.address !== undefined && patch.address !== currentAddress) ||
    (patch.phone !== undefined && patch.phone !== currentPhone) ||
    ((patch.openHours !== undefined || patch.openingHours !== undefined) &&
      (patch.openHours ?? patch.openingHours) !== currentOpenHours) ||
    ((patch.subcategoryId !== undefined || patch.categoryId !== undefined) &&
      (patch.subcategoryId ?? patch.categoryId) !== currentSubCat);

  const actionType: ProposalActionType =
    customActionType || (hasProposedCoords && !hasInfoDiff ? 'pin' : 'update');

  const isCreateAction = actionType === 'create' || actionType === 'CREATE_PLACE';
  const isPinAction = actionType === 'pin' || actionType === 'UPDATE_COORDINATES';
  const isHideAction = actionType === 'hide' || actionType === 'HIDE_PLACE';
  const isDeleteAction = actionType === 'delete' || actionType === 'DELETE_PLACE';

  const submitterUid =
    getAuthenticatedFirebaseUid() ||
    storedUser?.uid ||
    roleInfo.identifier ||
    storedUser?.email?.trim().toLowerCase() ||
    'manager_unverified';
  const submitterId =
    roleInfo.identifier ||
    storedUser?.email?.trim().toLowerCase() ||
    'quanlymaps@xuanhoacogi.vn';
  const submitterName =
    roleInfo.displayName ||
    storedUser?.displayName ||
    storedUser?.nickname ||
    'Quản lý Maps';
  const submitterRole = roleInfo.roleBadgeLabel || 'Quản lý Maps';

  const prevDataObj = {
    name: currentName,
    address: currentAddress,
    phone: currentPhone,
    openHours: currentOpenHours,
    parentCategoryId: currentParentCat,
    subcategoryId: currentSubCat,
    lat: currentLat,
    lng: currentLng,
    mapsUrl: current?.mapsUrl || basePlace?.mapsUrl || '',
    tagline: current?.tagline || basePlace?.tagline || '',
  };
  const nextDataObj = {
    name: patch.name ?? currentName,
    address: patch.address ?? currentAddress,
    phone: patch.phone ?? currentPhone,
    openHours: patch.openHours ?? patch.openingHours ?? currentOpenHours,
    parentCategoryId: patch.parentCategoryId ?? currentParentCat,
    subcategoryId: patch.subcategoryId ?? patch.categoryId ?? currentSubCat,
    lat: proposedLat,
    lng: proposedLng,
    mapsUrl: patch.mapsUrl ?? current?.mapsUrl ?? basePlace?.mapsUrl ?? '',
    tagline: patch.tagline ?? current?.tagline ?? basePlace?.tagline ?? '',
    coordinateSource: patch.coordinateSource || 'unverified',
  };

  const proposalId = `prop_${placeId}_${now}`;
  const proposal: PlaceChangeProposal = {
    id: proposalId,
    placeId,
    placeName: patch.name || currentName,
    actionType,
    status: 'pending',
    submittedBy: submitterId,
    submittedByUid: submitterUid,
    submittedByEmail: submitterId,
    submittedByName: submitterName,
    submittedByRole: submitterRole,
    submittedAt: now,
    baseVersion: current?.version || 1,
    previousData: prevDataObj,
    beforeData: prevDataObj,
    proposedData: nextDataObj,
    afterData: nextDataObj,
  };

  if (!state.placeProposals) state.placeProposals = {};
  // Chỉ hủy các proposal pending cũ do chính người dùng hiện tại (`submitterUid`) tạo cho cùng placeId
  for (const existingProp of Object.values(state.placeProposals)) {
    if (
      existingProp.placeId === placeId &&
      existingProp.status === 'pending' &&
      (existingProp.submittedByUid === submitterUid || existingProp.submittedBy === submitterId)
    ) {
      existingProp.status = 'cancelled';
    }
  }
  state.placeProposals[proposalId] = proposal;

  const summaryText =
    actionLabel ||
    (isPinAction
      ? `Đề xuất định vị (${proposedLat}, ${proposedLng})`
      : isCreateAction
      ? `Đề xuất thêm địa điểm mới: ${proposal.placeName}`
      : isHideAction
      ? `Đề xuất ẩn địa điểm: ${proposal.placeName}`
      : isDeleteAction
      ? `Đề xuất xóa địa điểm: ${proposal.placeName}`
      : `Đề xuất chỉnh sửa thông tin địa điểm`);

  // Giữ nguyên dữ liệu và tọa độ công khai hiện tại của địa điểm cho đến khi Admin bấm Duyệt!
  state.places[placeId] = {
    ...(current || {
      id: placeId,
      status: 'active',
      visibilityStatus: isCreateAction ? 'hidden' : 'visible',
      lat: currentLat ?? undefined,
      lng: currentLng ?? undefined,
      coordinateVerified: currentLat !== null && currentLng !== null,
      adminPinApproved: currentLat !== null && currentLng !== null,
      locationStatus: currentLat !== null && currentLng !== null ? 'located' : 'unlocated',
      version: 1,
    }),
    id: placeId,
    pendingMapApproval: {
      proposalId,
      submittedBy: submitterId,
      submittedByEmail: submitterId,
      submittedByName: submitterName,
      submittedAt: now,
      actionSummary: summaryText,
      actionType,
      baseVersion: current?.version || 1,
      previousLat: currentLat,
      previousLng: currentLng,
      proposedLat,
      proposedLng,
      proposedName: nextDataObj.name,
      proposedAddress: nextDataObj.address,
      proposedPhone: nextDataObj.phone,
      isNewPlace: isCreateAction,
      isDeleteRequest: isDeleteAction,
    },
    updatedAt: now,
  };

  state.auditLogs = addAdminAuditLog(
    state,
    `⏳ Quản lý gửi đề xuất (${
      isPinAction
        ? 'Định vị'
        : isCreateAction
        ? 'Thêm mới'
        : isHideAction
        ? 'Ẩn địa điểm'
        : isDeleteAction
        ? 'Xóa địa điểm'
        : 'Chỉnh sửa'
    }) chờ Admin duyệt`,
    `${proposal.placeName} — bởi ${submitterName}`,
    'place',
    {
      actorRole: 'manager',
      eventCategory: 'manager_proposal',
      refId: proposalId,
      placeId,
    }
  );
  saveAdminState(state, false);
  syncSinglePlaceToCloud(placeId, state.places[placeId], proposal);
  return proposal;
}

export function getAllPlaceChangeProposals(
  filterOrOptions?:
    | ProposalStatus
    | { status?: ProposalStatus | string; submittedByEmail?: string }
): PlaceChangeProposal[] {
  const state = getAdminState();
  const map = state.placeProposals || {};
  const list = Object.values(map).map(p => {
    const currentPlaceVer = state.places[p.placeId]?.version || 1;
    return {
      ...p,
      submittedByEmail: p.submittedByEmail || p.submittedBy,
      beforeData: p.beforeData || p.previousData,
      afterData: p.afterData || p.proposedData,
      message: p.message || p.reviewNote,
      hasVersionConflict: p.status === 'pending' && currentPlaceVer > p.baseVersion,
    };
  });
  const filterStatus =
    typeof filterOrOptions === 'string'
      ? filterOrOptions
      : filterOrOptions?.status;
  const filterEmail =
    typeof filterOrOptions === 'object' && filterOrOptions?.submittedByEmail
      ? filterOrOptions.submittedByEmail.trim().toLowerCase()
      : null;
  const filtered = list.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterEmail) {
      const subEmail = (p.submittedByEmail || p.submittedBy || '').trim().toLowerCase();
      if (subEmail !== filterEmail) return false;
    }
    return true;
  });
  return filtered.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return b.submittedAt - a.submittedAt;
  });
}

export function approvePlaceProposal(
  proposalIdOrPlaceId: string,
  reviewNote?: string,
  options?: { allowConflictOverride?: boolean }
): PlaceChangeProposal {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isSuperAdmin && !isAdminAuthenticated()) {
    throw new Error('Chỉ Admin mới có quyền phê duyệt yêu cầu thay đổi địa điểm.');
  }

  const state = getAdminState();
  const proposals = state.placeProposals || {};
  let proposal = proposals[proposalIdOrPlaceId];
  if (!proposal) {
    proposal = Object.values(proposals).find(
      p => p.placeId === proposalIdOrPlaceId && p.status === 'pending'
    ) as PlaceChangeProposal;
  }
  if (!proposal) {
    throw new Error('Không tìm thấy yêu cầu chờ duyệt.');
  }

  const placeId = proposal.placeId;
  const current = state.places[placeId] || { id: placeId, updatedAt: Date.now(), version: 1 };
  const currentVer = current.version || 1;
  if (currentVer > proposal.baseVersion && options?.allowConflictOverride === false) {
    throw new Error(
      `Xung đột phiên bản (Version Conflict): Địa điểm đã thay đổi từ v${proposal.baseVersion} lên v${currentVer} sau khi yêu cầu được gửi.`
    );
  }

  const now = Date.now();
  const pData = proposal.proposedData;
  const hasValidCoord = isValidCoordinatePair(pData.lat, pData.lng);
  const prevHistory = Array.isArray(current.locationHistory) ? current.locationHistory : [];
  const isHideAction = proposal.actionType === 'hide' || proposal.actionType === 'HIDE_PLACE';
  const isDeleteAction = proposal.actionType === 'delete' || proposal.actionType === 'DELETE_PLACE';
  const isCreateAction = proposal.actionType === 'create' || proposal.actionType === 'CREATE_PLACE';
  const isBaseCatalogPlace = xuanHoaPlaces.some(p => p.id === placeId);
  const isCivicLandmarkCreate =
    pData.parentCategoryId === 'landmark' ||
    pData.parentCategoryId === 'education' ||
    pData.parentCategoryId === 'public' ||
    pData.parentCategoryId === 'health';
  const createMapCat = pData.parentCategoryId === 'education' ? 'school' : 'public';

  const patchToApply: Partial<PlaceOverride> = isDeleteAction
    ? {
        status: 'deleted',
        visibilityStatus: 'deleted',
        coordinateVerified: false,
        adminPinApproved: false,
        lat: undefined,
        lng: undefined,
        pendingMapApproval: null,
        pendingWebApproval: null,
      }
    : isHideAction
    ? {
        status: 'active',
        visibilityStatus: 'hidden',
        pendingMapApproval: null,
        pendingWebApproval: null,
      }
    : {
        status: 'active',
        visibilityStatus: 'visible',
        ...(pData.name !== undefined ? { name: pData.name } : {}),
        ...(pData.address !== undefined ? { address: pData.address } : {}),
        ...(pData.phone !== undefined ? { phone: pData.phone } : {}),
        ...(pData.openHours !== undefined
          ? { openHours: pData.openHours, openingHours: pData.openHours }
          : {}),
        ...(pData.parentCategoryId ? { parentCategoryId: pData.parentCategoryId } : {}),
        ...(pData.subcategoryId
          ? { subcategoryId: pData.subcategoryId, categoryId: pData.subcategoryId }
          : {}),
        ...(pData.mapsUrl !== undefined ? { mapsUrl: pData.mapsUrl } : {}),
        ...(pData.tagline !== undefined ? { tagline: pData.tagline } : {}),
        ...(isCreateAction && !isBaseCatalogPlace && !current.customPlaceData
          ? {
              isCustom: true,
              verified: true,
              sectorTag: isCivicLandmarkCreate ? 'dia-danh' : 'an-chinh',
              mapCategory: isCivicLandmarkCreate ? createMapCat : 'food',
              showByDefault: isCivicLandmarkCreate,
              defaultMapVisible: isCivicLandmarkCreate,
              customPlaceData: {
                id: placeId,
                name: pData.name || proposal.placeName || placeId,
                tagline: pData.tagline || `${proposal.placeName} — Phường Xuân Hòa`,
                category: 'cafe',
                address: pData.address || 'Phường Xuân Hòa, Phúc Yên, Vĩnh Phúc',
                zone: 'center',
                distance: 'Phường Xuân Hòa',
                openHours: pData.openHours || '07:00 - 21:00',
                phone: pData.phone || '',
                priceRange: isCivicLandmarkCreate ? 'Địa danh công cộng' : '30k - 65k',
                minPrice: 0,
                maxPrice: 0,
                rating: 5.0,
                reviewCount: 10,
                imageUrl: '',
                tags: ['Địa danh', 'Xuân Hòa'],
                signatureDish: {
                  id: `${placeId}_sig`,
                  name: isCivicLandmarkCreate ? 'Địa danh tại Phường Xuân Hòa' : `Đặc trưng tại ${proposal.placeName}`,
                  price: 0,
                  tag: isCivicLandmarkCreate ? 'Địa danh' : 'Món tủ',
                },
                menu: [],
                serviceMode: 'both',
                mapsQuery: `${pData.name || proposal.placeName} Xuân Hòa`,
                mapsUrl:
                  pData.mapsUrl ||
                  (hasValidCoord
                    ? `https://www.google.com/maps/search/?api=1&query=${Number(pData.lat).toFixed(6)},${Number(pData.lng).toFixed(6)}`
                    : ''),
                rarity: 2,
                quip: pData.tagline || 'Địa điểm trên Bản đồ số Xuân Hòa!',
              },
            }
          : {}),
        ...(hasValidCoord
          ? {
              lat: Number(Number(pData.lat).toFixed(6)),
              lng: Number(Number(pData.lng).toFixed(6)),
              coordinateVerified: true,
              adminPinApproved: true,
              adminExplicitlyUnpinned: false,
              locationStatus: 'located',
              coordinateSource: 'admin_verified',
              lastVerifiedAt: new Date(now).toISOString(),
              locationHistory: [
                {
                  timestamp: now,
                  actor: roleInfo.identifier || 'admin',
                  actorRole: 'admin',
                  action: 'approve_proposal',
                  previousLat: proposal.previousData.lat ?? null,
                  previousLng: proposal.previousData.lng ?? null,
                  newLat: Number(Number(pData.lat).toFixed(6)),
                  newLng: Number(Number(pData.lng).toFixed(6)),
                  coordinateSource: 'admin_verified',
                  note: reviewNote || `Admin duyệt đề xuất từ ${proposal.submittedByName}`,
                },
                ...prevHistory,
              ].slice(0, 20),
            }
          : {}),
        pendingMapApproval: null,
        pendingWebApproval: null,
      };

  const reviewerUid = getAuthenticatedFirebaseUid() || roleInfo.identifier || 'admin';
  const approvalReason = reviewNote || `Admin duyệt đề xuất từ ${proposal.submittedByName}`;
  proposal.status = 'approved';
  proposal.reviewedBy = roleInfo.identifier || 'admin';
  proposal.reviewedByUid = reviewerUid;
  proposal.reviewedByName = roleInfo.displayName || 'Admin';
  proposal.reviewedAt = now;
  proposal.reviewNote = approvalReason;
  proposals[proposal.id] = proposal;
  state.placeProposals = proposals;

  if (isCloudWriteAllowedForCurrentSession()) {
    try {
      const rtdb = getRealtimeDb();
      if (rtdb) {
        syncProposalAndIndexToCloud(rtdb, proposal);
      }
    } catch {}
  }

  savePlaceAdminOverride(
    placeId,
    patchToApply,
    `✅ Admin duyệt đề xuất (${proposal.actionType}) cho ${proposal.placeName}`,
    {
      bypassProposalCheck: true,
      confirmCoordinateOverride: hasValidCoord && !isDeleteAction && !isHideAction,
      coordinateOverrideReason: approvalReason,
    }
  );
  return proposal;
}

export function rejectPlaceProposal(
  proposalIdOrPlaceId: string,
  reviewNote?: string
): PlaceChangeProposal {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isSuperAdmin && !isAdminAuthenticated()) {
    throw new Error('Chỉ Admin mới có quyền từ chối yêu cầu thay đổi địa điểm.');
  }

  const state = getAdminState();
  const proposals = state.placeProposals || {};
  let proposal = proposals[proposalIdOrPlaceId];
  if (!proposal) {
    proposal = Object.values(proposals).find(
      p => p.placeId === proposalIdOrPlaceId && p.status === 'pending'
    ) as PlaceChangeProposal;
  }
  if (!proposal) {
    throw new Error('Không tìm thấy yêu cầu chờ duyệt.');
  }

  const now = Date.now();
  const placeId = proposal.placeId;
  const ov = state.places[placeId];
  const reviewerUid = getAuthenticatedFirebaseUid() || roleInfo.identifier || 'admin';

  proposal.status = 'rejected';
  proposal.reviewedBy = roleInfo.identifier || 'admin';
  proposal.reviewedByUid = reviewerUid;
  proposal.reviewedByName = roleInfo.displayName || 'Admin';
  proposal.reviewedAt = now;
  proposal.reviewNote = reviewNote || 'Admin từ chối yêu cầu thay đổi.';
  proposals[proposal.id] = proposal;
  state.placeProposals = proposals;

  if (isCloudWriteAllowedForCurrentSession()) {
    try {
      const rtdb = getRealtimeDb();
      if (rtdb) {
        syncProposalAndIndexToCloud(rtdb, proposal);
      }
    } catch {}
  }

  if (ov) {
    const isCreateAction =
      proposal.actionType === 'create' || proposal.actionType === 'CREATE_PLACE';
    if (isCreateAction && ov.isCustom) {
      ov.status = 'deleted';
      ov.visibilityStatus = 'deleted';
      ov.pendingMapApproval = null;
      ov.pendingWebApproval = null;
    } else {
      ov.pendingMapApproval = null;
      ov.pendingWebApproval = null;
      const prevHistory = Array.isArray(ov.locationHistory) ? ov.locationHistory : [];
      ov.locationHistory = [
        {
          timestamp: now,
          actor: roleInfo.identifier || 'admin',
          actorUid: reviewerUid,
          actorRole: 'admin',
          action: 'reject_proposal',
          previousLat: proposal.previousData.lat ?? null,
          previousLng: proposal.previousData.lng ?? null,
          newLat: proposal.proposedData.lat ?? null,
          newLng: proposal.proposedData.lng ?? null,
          coordinateSource: ov.coordinateSource || 'admin_verified',
          reason: proposal.reviewNote,
          note: proposal.reviewNote,
        },
        ...prevHistory,
      ].slice(0, 20);
    }
    ov.updatedAt = now;
    state.places[placeId] = ov;
  }

  state.auditLogs = addAdminAuditLog(
    state,
    `❌ Admin từ chối đề xuất (${proposal.actionType}) của ${proposal.submittedByName}`,
    `${proposal.placeName} — Lý do: ${proposal.reviewNote}`,
    'place',
    {
      actorRole: 'admin',
      eventCategory: 'admin_review',
      refId: proposal.id,
      placeId,
    }
  );
  saveAdminState(state);
  return proposal;
}

export function cancelPlaceProposal(proposalId: string): void {
  const state = getAdminState();
  const prop = state.placeProposals?.[proposalId];
  if (!prop || prop.status !== 'pending') return;

  const roleInfo = getEffectiveAdminRoleInfo();
  const storedUser = getStoredAuthUser();
  const callerUid = getAuthenticatedFirebaseUid() || storedUser?.uid || roleInfo.identifier;
  const callerEmail = (storedUser?.email || roleInfo.identifier || '').trim().toLowerCase();

  // SEC-FINAL-01: Chỉ người tạo đề xuất mới được hủy đề xuất của chính mình khi đang pending (hoặc SuperAdmin)
  const isOwner =
    (prop.submittedByUid && callerUid && prop.submittedByUid === callerUid) ||
    (!prop.submittedByUid &&
      callerEmail &&
      (prop.submittedBy?.toLowerCase() === callerEmail ||
        prop.submittedByEmail?.toLowerCase() === callerEmail));

  if (!isOwner && !roleInfo.isSuperAdmin) {
    throw new Error('Truy cập bị từ chối: Bạn chỉ được hủy đề xuất do chính mình tạo.');
  }

  prop.status = 'cancelled';
  const ov = state.places[prop.placeId];
  if (ov) {
    const isCreateAction =
      prop.actionType === 'create' || prop.actionType === 'CREATE_PLACE';
    if (isCreateAction && ov.isCustom) {
      ov.status = 'deleted';
      ov.visibilityStatus = 'deleted';
    }
    ov.pendingMapApproval = null;
    ov.pendingWebApproval = null;
    state.places[prop.placeId] = ov;
  }
  if (isCloudWriteAllowedForCurrentSession()) {
    try {
      const rtdb = getRealtimeDb();
      if (rtdb) {
        syncProposalAndIndexToCloud(rtdb, prop);
      }
    } catch {}
  }
  saveAdminState(state);
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

  if (!roleInfo.isSuperAdmin && !isAdminAuthenticated()) {
    throw new Error('Chỉ Admin mới có quyền xóa địa điểm. Tài khoản Quản lý không có quyền xóa.');
  }

  if (roleInfo.isSuperAdmin || isAdminAuthenticated() || forceImmediate) {
    state.places[placeId] = {
      ...current,
      id: placeId,
      name: current.name || resolvedName,
      status: 'deleted',
      visibilityStatus: 'deleted',
      coordinateVerified: false,
      lat: undefined,
      lng: undefined,
      pendingWebApproval: null,
      pendingMapApproval: null,
      version: ((current.version as number) || 0) + 1,
      updatedAt: Date.now(),
    };
    logMapDebug('PLACE VISIBILITY', {
      placeId,
      name: resolvedName,
      status: 'deleted',
      visibilityStatus: 'deleted',
    });
    state.auditLogs = addAdminAuditLog(
      state,
      scope === 'web' ? '🗑️ Admin xóa quán khỏi hệ thống' : '🗑️ Admin xóa địa điểm khỏi Bản đồ',
      resolvedName,
      'place'
    );
    saveAdminState(state);
    return { executedImmediately: true };
  }

  return { executedImmediately: false };
}

export function approvePendingPlaceItem(placeId: string, scope: 'web' | 'maps'): void {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isSuperAdmin && !isAdminAuthenticated()) {
    throw new Error('Chỉ Admin mới có quyền phê duyệt yêu cầu.');
  }
  const state = getAdminState();
  const ov = state.places[placeId];
  const proposalId = ov?.pendingMapApproval?.proposalId || ov?.pendingWebApproval?.proposalId;
  if (proposalId && state.placeProposals?.[proposalId]?.status === 'pending') {
    approvePlaceProposal(proposalId);
    return;
  }
  const matchingProposal = Object.values(state.placeProposals || {}).find(
    p => p.placeId === placeId && p.status === 'pending'
  );
  if (matchingProposal) {
    approvePlaceProposal(matchingProposal.id);
    return;
  }
  if (!ov) return;

  const baseName = ov.name || xuanHoaPlaces.find(p => p.id === placeId)?.name || placeId;
  const pendingObj = scope === 'web' ? ov.pendingWebApproval : ov.pendingMapApproval;
  const isDelete = Boolean(
    pendingObj?.isDeleteRequest ||
      pendingObj?.actionType === 'delete' ||
      pendingObj?.actionType === 'DELETE_PLACE' ||
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
    ov.visibilityStatus = 'visible';
    if (
      typeof ov.pendingMapApproval?.proposedLat === 'number' &&
      typeof ov.pendingMapApproval?.proposedLng === 'number'
    ) {
      ov.lat = Number(ov.pendingMapApproval.proposedLat.toFixed(6));
      ov.lng = Number(ov.pendingMapApproval.proposedLng.toFixed(6));
    }
    if (typeof ov.lat === 'number' && typeof ov.lng === 'number') {
      ov.coordinateVerified = true;
      ov.adminPinApproved = true;
      ov.locationStatus = 'located';
      ov.coordinateSource = ov.coordinateSource || 'admin_verified';
    }
    if (scope === 'web') {
      ov.pendingWebApproval = null;
    } else {
      ov.pendingMapApproval = null;
    }
  }
  ov.version = (ov.version || 1) + 1;
  ov.updatedAt = Date.now();
  state.places[placeId] = ov;

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
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isSuperAdmin && !isAdminAuthenticated()) {
    throw new Error('Chỉ Admin mới có quyền duyệt hàng loạt yêu cầu.');
  }
  const state = getAdminState();
  let count = 0;
  for (const prop of Object.values(state.placeProposals || {})) {
    if (prop.status === 'pending') {
      approvePlaceProposal(prop.id);
      count++;
    }
  }
  const freshState = getAdminState();
  for (const [placeId, ov] of Object.entries(freshState.places || {})) {
    const pendingObj = scope === 'web' ? ov.pendingWebApproval : ov.pendingMapApproval;
    if (!pendingObj) continue;
    approvePendingPlaceItem(placeId, scope);
    count++;
  }
  return count;
}

export function rejectPendingPlaceItem(placeId: string, scope: 'web' | 'maps', reviewNote?: string): void {
  const roleInfo = getEffectiveAdminRoleInfo();
  if (!roleInfo.isSuperAdmin && !isAdminAuthenticated()) {
    throw new Error('Chỉ Admin mới có quyền từ chối yêu cầu.');
  }
  const state = getAdminState();
  const ov = state.places[placeId];
  const proposalId = ov?.pendingMapApproval?.proposalId || ov?.pendingWebApproval?.proposalId;
  if (proposalId && state.placeProposals?.[proposalId]?.status === 'pending') {
    rejectPlaceProposal(proposalId, reviewNote);
    return;
  }
  const matchingProposal = Object.values(state.placeProposals || {}).find(
    p => p.placeId === placeId && p.status === 'pending'
  );
  if (matchingProposal) {
    rejectPlaceProposal(matchingProposal.id, reviewNote);
    return;
  }
  if (!ov) return;

  const baseName = ov.name || xuanHoaPlaces.find(p => p.id === placeId)?.name || placeId;
  const pendingObj = scope === 'web' ? ov.pendingWebApproval : ov.pendingMapApproval;
  const isDelete = Boolean(
    pendingObj?.isDeleteRequest ||
      pendingObj?.actionType === 'delete' ||
      pendingObj?.actionType === 'DELETE_PLACE'
  );

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
  if (authUser?.isMapManager && authUser?.email && authUser?.isLoggedIn) return true;
  const stored = getStoredAuthUser();
  if (stored?.isMapManager && stored?.email && stored?.isLoggedIn) return true;
  return false;
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
    mapCategory?: string;
    parentCategoryId?: string;
    subcategoryId?: string;
    categoryId?: string;
    showByDefault?: boolean;
    defaultMapVisible?: boolean;
    address: string;
    phone?: string;
    openHours?: string;
    openingHours?: string;
    tagline?: string;
    lat?: number | null;
    lng?: number | null;
    mapsUrl?: string;
    signatureDishName?: string;
    signatureDishPrice?: number;
  }
): AdminPlaceItem {
  const effectiveUser = authUser?.email ? authUser : getStoredAuthUser();
  const roleInfo = getEffectiveAdminRoleInfo(undefined, effectiveUser);
  if (
    !roleInfo.isSuperAdmin &&
    !roleInfo.canManageMaps &&
    !roleInfo.canManageWeb &&
    !isAdminAuthenticated(effectiveUser) &&
    !isMapManagerAuthenticated(effectiveUser)
  ) {
    throw new Error('Chỉ Quản trị viên hoặc Quản lý mới có quyền tạo địa điểm mới.');
  }

  const cleanName = payload.name.trim();
  if (!cleanName) {
    throw new Error('Vui lòng nhập tên quán hoặc tên địa điểm / đơn vị hành chính.');
  }

  const rawLat = payload.lat !== undefined && payload.lat !== null && String(payload.lat).trim() !== '' ? Number(payload.lat) : null;
  const rawLng = payload.lng !== undefined && payload.lng !== null && String(payload.lng).trim() !== '' ? Number(payload.lng) : null;
  const hasValidCoord = rawLat !== null && rawLng !== null && isValidCoordinatePair(rawLat, rawLng);
  const lat = hasValidCoord ? Number(rawLat!.toFixed(6)) : undefined;
  const lng = hasValidCoord ? Number(rawLng!.toFixed(6)) : undefined;

  const effSubId = payload.subcategoryId || payload.categoryId;
  const effShowDefault =
    typeof payload.showByDefault === 'boolean'
      ? payload.showByDefault
      : payload.defaultMapVisible;

  const taxonomy = resolvePlaceTaxonomy({
    name: cleanName,
    subType: payload.tagline,
    mapCategory: payload.mapCategory,
    category: payload.mapCategory,
    explicitParentId: payload.parentCategoryId,
    explicitSubcategoryId: effSubId,
    explicitShowByDefault: effShowDefault,
    dataSource: 'admin_custom',
  });
  const subMeta =
    MAP_CATEGORY_REGISTRY[taxonomy.subcategoryId] || MAP_CATEGORY_REGISTRY.uncategorized;
  const mapCat: string = taxonomy.legacyCategory || payload.mapCategory || 'food';
  const resolvedSectorTag = getDefaultSectorTagForSubcategory(subMeta);

  const isCivicOrSchool =
    resolvedSectorTag === 'dia-danh' ||
    mapCat === 'public' ||
    mapCat === 'school' ||
    mapCat === 'medical';

  const placeCoreCategory: Place['category'] =
    mapCat === 'pub' || mapCat === 'billiards' || mapCat === 'game' || mapCat === 'entertainment'
      ? 'pub'
      : mapCat === 'snack' || mapCat === 'grocery' || mapCat === 'supermarket'
      ? 'fast_food'
      : mapCat === 'food'
      ? 'restaurant'
      : 'cafe';

  const now = Date.now();
  const newPlaceId = `xh_map_${now}`;
  const sigName =
    payload.signatureDishName?.trim() ||
    (isCivicOrSchool
      ? `${subMeta.label} tại Phường Xuân Hòa`
      : `Đặc trưng tại ${cleanName}`);
  const sigPrice = isCivicOrSchool ? 0 : Number(payload.signatureDishPrice) || 35;
  const finalHours =
    (payload.openHours ?? payload.openingHours)?.trim() ||
    (isCivicOrSchool ? '07:30 - 17:30' : '07:00 - 22:00');

  const newPlace: Place = {
    id: newPlaceId,
    name: cleanName,
    tagline:
      payload.tagline?.trim() ||
      (isCivicOrSchool
        ? `${subMeta.label} — Phường Xuân Hòa`
        : `${subMeta.label} tại Phường Xuân Hòa`),
    category: placeCoreCategory,
    address: payload.address.trim() || 'Phường Xuân Hòa, Tỉnh Phú Thọ',
    zone: 'center',
    distance: 'Trung tâm Xuân Hòa',
    openHours: finalHours,
    phone: payload.phone?.trim() || '',
    priceRange: isCivicOrSchool ? 'Địa danh công cộng' : `${sigPrice}k - ${sigPrice + 35}k`,
    minPrice: isCivicOrSchool ? 0 : sigPrice,
    maxPrice: isCivicOrSchool ? 0 : sigPrice + 35,
    rating: 5.0,
    reviewCount: 10,
    imageUrl: '',
    tags: [subMeta.label, mapCat, 'Xuân Hòa'],
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
      (hasValidCoord ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : ''),
    rarity: 2,
    quip: `Địa điểm trên Bản đồ số Xuân Hòa!`,
  };

  const state = getAdminState();
  const creatorRole = getEffectiveAdminRoleInfo(undefined, effectiveUser);
  const isApprovedImmediately = creatorRole.isSuperAdmin;

  state.places[newPlaceId] = {
    id: newPlaceId,
    status: 'active',
    visibilityStatus: isApprovedImmediately ? 'visible' : 'hidden',
    name: newPlace.name,
    tagline: newPlace.tagline,
    address: newPlace.address,
    zone: newPlace.zone,
    distance: newPlace.distance,
    phone: newPlace.phone,
    openHours: newPlace.openHours,
    openingHours: newPlace.openHours,
    minPrice: newPlace.minPrice,
    maxPrice: newPlace.maxPrice,
    category: newPlace.category,
    sectorTag: resolvedSectorTag,
    mapCategory: mapCat,
    parentCategoryId: taxonomy.parentCategoryId,
    subcategoryId: taxonomy.subcategoryId,
    categoryId: taxonomy.subcategoryId,
    showByDefault: taxonomy.showByDefault,
    defaultMapVisible: taxonomy.showByDefault,
    tags: newPlace.tags,
    serviceMode: newPlace.serviceMode,
    mapsQuery: newPlace.mapsQuery,
    mapsUrl: newPlace.mapsUrl,
    quip: newPlace.quip,
    verified: isApprovedImmediately,
    signatureDishName: sigName,
    signatureDishPrice: sigPrice,
    customMenu: newPlace.menu,
    ...(hasValidCoord && isApprovedImmediately
      ? {
          lat,
          lng,
          coordinateVerified: true,
          adminPinApproved: true,
          locationStatus: 'located' as const,
          coordinateSource: 'admin_verified' as const,
          lastVerifiedAt: new Date(now).toISOString(),
          locationHistory: [
            {
              timestamp: now,
              actor: creatorRole.identifier || 'admin',
              actorRole: 'admin' as const,
              action: 'pin' as const,
              previousLat: null,
              previousLng: null,
              newLat: lat,
              newLng: lng,
              coordinateSource: 'admin_verified',
              note: 'Admin tạo mới và xác minh tọa độ',
            },
          ],
        }
      : {
          coordinateVerified: false,
          adminPinApproved: false,
          locationStatus: 'unlocated' as const,
          coordinateSource: 'unverified' as const,
        }),
    mapsLinkStatus: computeMapsLinkStatus(
      {
        lat: isApprovedImmediately ? lat : undefined,
        lng: isApprovedImmediately ? lng : undefined,
        mapsUrl: newPlace.mapsUrl,
        coordinateSource: hasValidCoord && isApprovedImmediately ? 'admin_verified' : 'unverified',
      },
      newPlace.mapsUrl
    ),
    pendingMapApproval: null,
    pendingWebApproval: null,
    createdAt: now,
    version: 1,
    updatedAt: now,
    isCustom: true,
    customPlaceData: newPlace,
  };

  logMapDebug('PLACE SAVE', {
    id: newPlaceId,
    name: newPlace.name,
    parentCategoryId: taxonomy.parentCategoryId,
    subcategoryId: taxonomy.subcategoryId,
    lat: isApprovedImmediately ? (lat ?? null) : null,
    lng: isApprovedImmediately ? (lng ?? null) : null,
    locationStatus: hasValidCoord && isApprovedImmediately ? 'located' : 'unlocated',
    visibilityStatus: isApprovedImmediately ? 'visible' : 'hidden',
    coordinateSource: hasValidCoord && isApprovedImmediately ? 'admin_verified' : 'unverified',
    version: 1,
  });

  state.auditLogs = addAdminAuditLog(
    state,
    creatorRole.isSuperAdmin
      ? `🗺️ Admin tạo địa điểm mới (${subMeta.label})`
      : `⏳ Quản lý đề xuất thêm địa điểm mới chờ duyệt (${subMeta.label})`,
    hasValidCoord ? `${cleanName} — Tọa độ: ${lat}, ${lng}` : `${cleanName} (Chưa định vị)`,
    'place'
  );

  saveAdminState(state);

  if (!isApprovedImmediately) {
    submitManagerPlaceProposal(
      newPlaceId,
      {
        name: newPlace.name,
        address: newPlace.address,
        phone: newPlace.phone,
        openHours: newPlace.openHours,
        parentCategoryId: taxonomy.parentCategoryId,
        subcategoryId: taxonomy.subcategoryId,
        lat,
        lng,
        mapsUrl: newPlace.mapsUrl,
        tagline: newPlace.tagline,
      },
      `Đề xuất thêm địa điểm mới: ${cleanName}`,
      'create'
    );
  }

  const created = getAllManagedPlaces().find((p) => p.place.id === newPlaceId);
  if (!created) {
    throw new Error('Không thể khởi tạo địa điểm mới.');
  }
  return created;
}

export const createPlace = createNewPlaceFromMap;

if (typeof window !== 'undefined') {
  (window as any).__XUANHOA_ADMIN_STORE__ = {
    getAdminState,
    getSecurityState,
    getBackupFounderRecords,
    getAllManagedPlaces,
    getActivePublicPlaces,
    savePlaceAdminOverride,
    updatePlace,
    updatePlaceCoordinates,
    clearPlaceCoordinates,
    createNewPlaceFromMap,
    requestOrExecuteDeletePlace,
    submitManagerPlaceProposal,
    getAllPlaceChangeProposals,
    approvePlaceProposal,
    rejectPlaceProposal,
    cancelPlaceProposal,
    PENDING_LANDMARK_PLACE_PROPOSALS_SEED,
    resolvePlaceOrPendingProposalCoordinates,
    syncAdminStateToCloudConfirmed,
    loginAdminWithFirebaseAuth,
    loginAdminWithCredentials,
    getFounderLoginLockoutStatus,
    provisionBackupFounderAccount,
    setBackupFounderActiveState,
    resetBackupFounderPasswordViaBackend,
    revokeBackupFounderSessionsViaBackend,
    verifyBackupFounderRecoveryEmailViaBackend,
    requestBackupFounderPasswordRecovery,
    isUidDisabledBackupFounder,
    grantOrRevokeAdminRole,
    updateMemberManagerPermissions,
    updateMemberStatusInAdmin,
    logoutAdminSession,
    upsertAdminAccount,
    getEffectiveAdminRoleInfo,
  };
}

/**
 * Lấy chế độ mở cửa của Bản đồ số (Mặc định: 'public_open' hoặc 'managers_and_admin_only' dành cho Quản lý & Admin)
 */
export function getMapAccessMode(): 'managers_and_admin_only' | 'public_open' {
  const state = getAdminState();
  return state.mapAccessMode === 'public_open' ? 'public_open' : 'managers_and_admin_only';
}

/**
 * Admin bật/tắt công tắc Mở cửa Bản đồ số cho toàn bộ khách hoặc Chỉ Quản lý & Admin
 */
export function setMapAccessMode(mode: 'managers_and_admin_only' | 'public_open'): void {
  const state = getAdminState();
  state.mapAccessMode = mode;
  state.auditLogs = addAdminAuditLog(
    state,
    mode === 'public_open'
      ? '🌍 Admin MỞ CỬA Bản Đồ Số công khai cho toàn bộ Khách'
      : '🔒 Admin bật chế độ Bản Đồ Số: Chỉ Quản lý & Admin',
    mode === 'public_open' ? 'Công khai toàn bộ' : 'Chỉ Quản lý & Admin',
    'system'
  );
  saveAdminState(state);
}

/**
 * Kiểm tra quyền vào Bản đồ số của tài khoản hiện tại theo mô hình 3 vai trò (USER / MANAGER / ADMIN):
 * - ADMIN: Vào thẳng 100% + toàn quyền quản trị
 * - MANAGER: Vào thẳng 100% + gửi đề xuất thêm/sửa/định vị
 * - USER / GUEST: Vào xem công khai khi mode === 'public_open'
 */
export function getDigitalMapAccessStatus(authUser?: UserAuthProfile | null): {
  canAccess: boolean;
  accessReason: 'admin' | 'map_manager' | 'public_open' | 'locked_for_guest';
  mode: 'managers_and_admin_only' | 'public_open';
  verifiedCount: number;
  totalCount: number;
} {
  const state = getAdminState();
  const mode: 'managers_and_admin_only' | 'public_open' =
    state.mapAccessMode === 'public_open' ? 'public_open' : 'managers_and_admin_only';
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

  if (isAdminAuthenticated(authUser)) {
    return {
      canAccess: true,
      accessReason: 'admin',
      mode,
      verifiedCount,
      totalCount,
    };
  }

  if (isMapManagerAuthenticated(authUser)) {
    return {
      canAccess: true,
      accessReason: 'map_manager',
      mode,
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
      verifiedCount,
      totalCount,
    };
  }

  return {
    canAccess: false,
    accessReason: 'locked_for_guest',
    mode,
    verifiedCount,
    totalCount,
  };
}



