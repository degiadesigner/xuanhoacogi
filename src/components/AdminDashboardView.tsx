'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Shield,
  Store,
  Users,
  MessageSquare,
  Activity,
  Search,
  Plus,
  Lock,
  Unlock,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Check,
  ArrowLeft,
  Save,
  Ban,
  VolumeX,
  UserCheck,
  LogIn,
  LogOut,
  Eye,
  EyeOff,
  MapPin,
  Clock,
  Phone,
  Settings,
  ExternalLink,
  Download,
  Upload,
  X,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Edit3,
  Copy,
  UtensilsCrossed,
  Sparkles,
  UserPlus,
  Bell,
} from 'lucide-react';
import {
  AdminThemeMode,
  AdminPlaceItem,
  AdminAccount,
  CustomMenuEntry,
  SectorCategoryTag,
  DEFAULT_SECTOR_TAGS,
  getAdminState,
  saveAdminState,
  getAllManagedPlaces,
  getAllManagedDishes,
  getAllSystemReviews,
  savePlaceAdminOverride,
  resetPlaceToDefault,
  createNewCustomPlace,
  updateMemberStatusInAdmin,
  deleteMemberAndPurgeReviews,
  deleteSystemReview,
  seedDemoMembersIfEmpty,
  initAdminCloudSync,
  pushMemberToCloudRealtime,
  updateAdminSystemSettings,
  getAdminAccounts,
  getLoggedAdminSession,
  loginAdminWithCredentials,
  logoutAdminSession,
  upsertAdminAccount,
  deleteAdminAccount,
  getOrGenerateMerchantCode,
  getAllMerchantSubmissions,
  simulateMerchantDemoSubmission,
  assignMerchantOwnerByEmail,
  setMapAccessMode,
  updateMemberManagerPermissions,
  getEffectiveAdminRoleInfo,
  approvePendingPlaceItem,
  rejectPendingPlaceItem,
  approveAllPendingPlaceItems,
  requestOrExecuteDeletePlace,
  clearPlaceCoordinates,
  computePlaceLocationStatus,
  computeMapsLinkStatus,
  computePlaceVisibilityStatus,
  logMapDebug,
  syncUserToAdminRegistry,
  ensureCloudPermissionsSyncedForEmail,
} from '@/lib/admin-store';
import {
  UserAuthProfile,
  saveAuthUser,
  getStoredAuthUser,
  clearAuthUser,
  signInWithGoogleService,
  createOrUpdateAuthUserFromGoogle,
} from '@/lib/auth';
import { GoogleGIcon } from '@/components/GoogleGIcon';
import { DigitalMapView, prefetchDigitalMapGeoLayers } from '@/components/DigitalMapView';
import { Place } from '@/lib/places-xuanhoa';
import { MerchantPortalModal } from '@/components/map/MerchantPortalModal';
import { triggerFeedback, FeedbackSoundType } from '@/lib/ui-feedback';
import {
  getAllAdminPlaceAndLandmarkItems,
  getCommercialAdminPlaceItems,
  getManagedOsmLandmarks,
  parseCoordinatesFromInputOrUrl,
  expandAndParseShortMapsUrl,
  isShortOrUnresolvableMapsUrl,
  resolvePlaceMapCategory,
  mapSectorTagToMapCategory,
  resolvePlaceCoordinates,
  migrateExistingPlacesCoordinates,
  normalizeVietnamese,
  geocodeAddressWithNominatim,
  findSuggestedRoadForAddress,
  VERIFIED_OSM_ROADS_SEED,
} from '@/lib/map/map-data';
import { MAP_CATEGORIES } from '@/lib/map/map-categories';
import type { MapCategoryKey } from '@/lib/map/map-types';

type EditableMapCategory = Exclude<MapCategoryKey, 'all' | 'game_asset'>;
const EDITABLE_MAP_CATEGORIES = MAP_CATEGORIES.filter(
  (c): c is typeof c & { id: EditableMapCategory } => c.id !== 'all' && c.id !== 'game_asset'
);

interface AdminDashboardViewProps {
  authUser: UserAuthProfile | null;
  onBack: () => void;
  onOpenAuthModal?: () => void;
}

type AdminSection = 'overview' | 'places' | 'maps' | 'members' | 'reviews' | 'logs';

interface ThemeTokens {
  id: AdminThemeMode;
  name: string;
  shortName: string;
  bgMain: string;
  bgSidebar: string;
  bgCard: string;
  bgElevated: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  border: string;
  shadow: string;
  dotColor: string;
}

const ADMIN_THEMES: Record<AdminThemeMode, ThemeTokens> = {
  'ivory-gold': {
    id: 'ivory-gold',
    name: 'Vàng Champagne & Kem Sáng',
    shortName: 'Vàng Champagne',
    bgMain: '#F7F5F0',
    bgSidebar: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgElevated: '#FAF8F5',
    bgInput: '#F3F0EA',
    textPrimary: '#18181B',
    textSecondary: '#3F3F46',
    textMuted: '#71717A',
    accent: '#B47B26',
    accentSoft: 'rgba(180, 123, 38, 0.10)',
    accentBorder: 'rgba(180, 123, 38, 0.30)',
    border: '#E5E0D5',
    shadow: '0 2px 12px rgba(24, 24, 27, 0.04)',
    dotColor: '#D49A3D',
  },
  'platinum-royal': {
    id: 'platinum-royal',
    name: 'Xanh Hoàng Gia & Bạch Kim',
    shortName: 'Xanh Hoàng Gia',
    bgMain: '#F1F5F9',
    bgSidebar: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgElevated: '#F8FAFC',
    bgInput: '#EEF2F6',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    accent: '#1D4ED8',
    accentSoft: 'rgba(29, 78, 216, 0.08)',
    accentBorder: 'rgba(29, 78, 216, 0.25)',
    border: '#E2E8F0',
    shadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
    dotColor: '#2563EB',
  },
  'emerald- pearl': {
    id: 'emerald- pearl',
    name: 'Xanh Ngọc Lục Bảo & Kem',
    shortName: 'Ngọc Lục Bảo',
    bgMain: '#F2F7F4',
    bgSidebar: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgElevated: '#F7FBF9',
    bgInput: '#EBF3EF',
    textPrimary: '#062C1E',
    textSecondary: '#1E4635',
    textMuted: '#527968',
    accent: '#047857',
    accentSoft: 'rgba(4, 120, 87, 0.09)',
    accentBorder: 'rgba(4, 120, 87, 0.28)',
    border: '#D8E6DF',
    shadow: '0 2px 12px rgba(6, 44, 30, 0.04)',
    dotColor: '#059669',
  },
};

function matchesMapCategoryFilter(
  item: AdminPlaceItem,
  mapCat: EditableMapCategory,
  mapCatFilter: string
): boolean {
  if (mapCatFilter === 'all') return true;
  if (mapCat === mapCatFilter) return true;
  if (mapCatFilter === 'billiards') {
    const nameLower = item.place.name.toLowerCase();
    const normHay = item.normalizedHaystack || normalizeVietnamese(`${item.place.name} ${(item.place.tags || []).join(' ')}`);
    return (
      item.sectorTag === 'bia-game' ||
      normHay.includes('bi a') ||
      nameLower.includes('bi-a') ||
      nameLower.includes('billiards') ||
      nameLower.includes('bida')
    );
  }
  if (mapCatFilter === 'game' && item.sectorTag === 'bia-game') {
    return true;
  }
  return false;
}

interface MapPlaceListRowProps {
  item: AdminPlaceItem;
  isSelected: boolean;
  hasCoords: boolean;
  isLinkError: boolean;
  catLabel: string;
  hasPendingMap: boolean;
  isDelReq: boolean;
  accentColor: string;
  accentSoft: string;
  textPrimary: string;
  textMuted: string;
  onSelect: (item: AdminPlaceItem) => void;
}

const MapPlaceListRow = React.memo<MapPlaceListRowProps>(function MapPlaceListRow({
  item,
  isSelected,
  hasCoords,
  isLinkError,
  catLabel,
  hasPendingMap,
  isDelReq,
  accentColor,
  accentSoft,
  textPrimary,
  textMuted,
  onSelect,
}) {
  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        minHeight: '54px',
        padding: '7px 10px',
        borderRadius: '8px',
        marginBottom: '4px',
        cursor: 'pointer',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '3px',
        border: isSelected
          ? `1px solid ${accentColor}`
          : hasPendingMap
          ? isDelReq
            ? '1px solid #FCA5A5'
            : '1px solid #FCD34D'
          : '1px solid transparent',
        background: isSelected
          ? accentSoft
          : hasPendingMap
          ? isDelReq
            ? '#FEF2F2'
            : '#FFFBEB'
          : '#F8F6F1',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: textPrimary,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={item.place.name}
        >
          {item.place.name}
        </span>
        <span
          style={{
            fontSize: '11px',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {hasCoords ? '📍' : isLinkError ? '⚠' : '⏳'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
        }}
      >
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 600,
            color: textMuted,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {catLabel}
        </span>

        {hasPendingMap ? (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '4px',
              background: isDelReq ? '#FEE2E2' : '#FEF3C7',
              color: isDelReq ? '#B91C1C' : '#B45309',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {isDelReq ? 'Chờ xóa' : 'Chờ duyệt'}
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '4px',
                background: hasCoords ? '#E6F7EF' : '#FEF3C7',
                color: hasCoords ? '#047857' : '#B45309',
                whiteSpace: 'nowrap',
              }}
            >
              {hasCoords ? 'Đã định vị' : 'Chưa định vị'}
            </span>
            {isLinkError && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  whiteSpace: 'nowrap',
                }}
                title="Link Google Maps bị lỗi hoặc chưa đọc được tọa độ"
              >
                ⚠ Link lỗi
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export function AdminDashboardView({
  authUser,
  onBack: onBackToApp,
}: AdminDashboardViewProps) {
  const [themeMode, setThemeMode] = useState<AdminThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xuanhoa_admin_theme') as AdminThemeMode;
      if (saved && ADMIN_THEMES[saved]) return saved;
    }
    return 'ivory-gold';
  });

  const theme = ADMIN_THEMES[themeMode];

  const handleSelectTheme = (mode: AdminThemeMode) => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('xuanhoa_admin_theme', mode);
    }
  };

  // Giữ nguyên mục đang xem (Quản lý Thành viên, Quản lý Maps, Quản lý Quán...) kể cả khi bấm F5 tải lại trang
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xuanhoa_admin_active_section_v1') as AdminSection | null;
      if (
        saved === 'overview' ||
        saved === 'places' ||
        saved === 'maps' ||
        saved === 'members' ||
        saved === 'reviews' ||
        saved === 'logs'
      ) {
        return saved;
      }
    }
    return 'places';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('xuanhoa_admin_active_section_v1', activeSection);
    }
  }, [activeSection]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [toast, setToast] = useState<string>('');

  // =========================================================================
  // ĐĂNG NHẬP ADMIN ĐÀNG HOÀNG (CÓ NICK + MẬT KHẨU + TÍCH LƯU ĐĂNG NHẬP)
  // HOẶC ĐĂNG NHẬP TRỰC TIẾP BẰNG GOOGLE (GMAIL) NHƯ WEB CHÍNH
  // =========================================================================
  const [loggedAdmin, setLoggedAdmin] = useState<AdminAccount | null>(() => getLoggedAdminSession());
  const [localAuthUser, setLocalAuthUser] = useState<UserAuthProfile | null>(
    () => authUser || getStoredAuthUser()
  );
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRememberMe, setLoginRememberMe] = useState(true);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Bảng Cài đặt gọn gàng ở góc phải
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Quản lý Quán (3 cột: Cột 1 Danh sách & Duyệt Quán | Cột 2 Thông tin | Cột 3 Thực đơn)
  const [placeListTab, setPlaceListTab] = useState<'all' | 'pending_web'>('all');
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeSectorFilter, setPlaceSectorFilter] = useState<string>('all');
  const [placeStatusFilter, setPlaceStatusFilter] = useState<'all' | 'active' | 'boosted' | 'locked' | 'deleted'>('all');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [mobileShowDetailPane, setMobileShowDetailPane] = useState(false);

  // Quản lý Maps (3 cột: Cột 1 Danh sách & Duyệt Maps | Cột 2 Định vị & Địa danh | Cột 3 Bản đồ tương tác & Kiểm tra)
  const [mapListTab, setMapListTab] = useState<'all' | 'pending_maps'>('all');
  const [mapSearch, setMapSearch] = useState('');
  const [debouncedMapSearch, setDebouncedMapSearch] = useState('');
  const [mapCatFilter, setMapCatFilter] = useState<string>('all');
  const [mapCoordFilter, setMapCoordFilter] = useState<'all' | 'verified' | 'unverified' | 'invalid' | 'locked'>('all');
  const resolveRequestIdRef = useRef(0);
  const resolveAbortRef = useRef<AbortController | null>(null);
  const isSavingPlaceRef = useRef(false);
  const [isSavingPlace, setIsSavingPlace] = useState(false);

  useEffect(() => {
    if (!mapSearch.trim()) {
      setDebouncedMapSearch('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedMapSearch(mapSearch);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [mapSearch]);

  // Thêm nhanh phân khu ngành nghề ngay trong cài đặt của Quán
  const [isAddingSectorInline, setIsAddingSectorInline] = useState(false);
  const [inlineSectorLabel, setInlineSectorLabel] = useState('');

  // Thu gọn / Mở rộng phần thông tin phụ của quán
  const [showAdvancedPlaceFields, setShowAdvancedPlaceFields] = useState(false);

  // Thông tin chính của Quán / Địa Danh
  const [editPlaceName, setEditPlaceName] = useState('');
  const [editPlacePhone, setEditPlacePhone] = useState('');
  const [editPlaceHours, setEditPlaceHours] = useState('');
  const [editPlaceAddress, setEditPlaceAddress] = useState('');
  const [editPlaceMapsUrl, setEditPlaceMapsUrl] = useState('');
  const [editPlaceMapsQuery, setEditPlaceMapsQuery] = useState('');
  const [editPlaceSectorTag, setEditPlaceSectorTag] = useState('an-chinh');
  const [editPlaceMapCategory, setEditPlaceMapCategory] = useState<EditableMapCategory>('food');
  const [editPlaceLat, setEditPlaceLat] = useState('');
  const [editPlaceLng, setEditPlaceLng] = useState('');
  const [hasActivelyPinnedOnMap, setHasActivelyPinnedOnMap] = useState(false);
  const [isAdminGeocoding, setIsAdminGeocoding] = useState(false);
  const [adminGeoSuggestions, setAdminGeoSuggestions] = useState<
    Array<{ displayName: string; lat: number; lng: number }>
  >([]);
  const [editPlaceServiceMode, setEditPlaceServiceMode] = useState<Place['serviceMode']>('both');
  const [editPlacePriorityBoost, setEditPlacePriorityBoost] = useState<1 | 2 | 3>(1);

  // Thông tin nâng cao (đồng bộ 100% với web chính)
  const [editPlaceTagline, setEditPlaceTagline] = useState('');
  const [editPlaceCategory, setEditPlaceCategory] = useState<Place['category']>('restaurant');
  const [editPlaceTagsText, setEditPlaceTagsText] = useState('');
  const [editPlaceZone, setEditPlaceZone] = useState<Place['zone']>('dhsp2');
  const [editPlaceDistance, setEditPlaceDistance] = useState('');
  const [editPlaceDeliveryNote, setEditPlaceDeliveryNote] = useState('');
  const [editPlaceMinPrice, setEditPlaceMinPrice] = useState(25);
  const [editPlaceMaxPrice, setEditPlaceMaxPrice] = useState(65);
  const [editPlaceSigName, setEditPlaceSigName] = useState('');
  const [editPlaceSigPrice, setEditPlaceSigPrice] = useState(35);
  const [editPlaceQuip, setEditPlaceQuip] = useState('');
  const [editPlaceImageUrl, setEditPlaceImageUrl] = useState('');

  // Thực đơn Món của Quán
  const [editPlaceMenu, setEditPlaceMenu] = useState<CustomMenuEntry[]>([]);
  const [dishSearchInPlace, setDishSearchInPlace] = useState('');
  const [editingDishIndex, setEditingDishIndex] = useState<number | null>(null);
  const [isAddingDishRow, setIsAddingDishRow] = useState(false);
  const [newMenuDishName, setNewMenuDishName] = useState('');
  const [newMenuDishPrice, setNewMenuDishPrice] = useState('35');
  const [newMenuDishCat, setNewMenuDishCat] = useState('Món chính');
  const [newMenuDishDesc, setNewMenuDishDesc] = useState('');

  // Modal tạo Quán / Địa danh mới
  const [isNewPlaceModalOpen, setIsNewPlaceModalOpen] = useState(false);
  const [newPlaceForm, setNewPlaceForm] = useState({
    name: '',
    sectorTag: 'an-chinh',
    mapCategory: 'food' as EditableMapCategory,
    phone: '',
    openHours: '07:00 - 22:00',
    address: 'P. Xuân Hòa, Phúc Yên, Vĩnh Phúc',
    mapsUrl: '',
    lat: '',
    lng: '',
    sigDishName: 'Món đặc trưng',
    sigDishPrice: 35,
  });

  // Quản lý Thành viên & Quản lý Tài khoản Admin (Nick + Mật khẩu riêng)
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'active' | 'muted' | 'banned' | 'admin'>('all');
  const [isAddSeederModalOpen, setIsAddSeederModalOpen] = useState(false);
  const [seederForm, setSeederForm] = useState({
    nickname: '',
    email: '',
    residentType: 'student_sp2',
  });

  // Cấp / Sửa Nick & Mật khẩu Quản lý (Admin Accounts) trong mục Quản lý Thành viên
  const [isAdminAccModalOpen, setIsAdminAccModalOpen] = useState(false);
  const [adminAccForm, setAdminAccForm] = useState({
    id: '',
    username: '',
    password: '',
    displayName: '',
    role: 'manager' as 'superadmin' | 'manager',
    canManageWeb: true,
    canManageMaps: false,
  });

  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [merchantModalTab, setMerchantModalTab] = useState<
    'merchant' | 'admin_approvals' | 'admin_codes'
  >('admin_approvals');
  const [justSavedPlace, setJustSavedPlace] = useState(false);
  const [copiedBtnKey, setCopiedBtnKey] = useState<string | null>(null);
  const [toastId, setToastId] = useState(0);
  const [toastKind, setToastKind] = useState<FeedbackSoundType>('success');
  const toastTimerRef = useRef<number | null>(null);
  const [mapFlyTrigger, setMapFlyTrigger] = useState(0);

  const showToast = (msg: string, sound: FeedbackSoundType = 'success') => {
    triggerFeedback(sound);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastKind(sound);
    setToast(msg);
    setToastId(id => id + 1);
    toastTimerRef.current = window.setTimeout(() => {
      setToast('');
      toastTimerRef.current = null;
    }, 2400);
  };

  const jumpToMapUrl = (hashRoute: string) => {
    triggerFeedback('pin');
    if (typeof window !== 'undefined') {
      if (
        window.location.pathname === '/quanly' ||
        window.location.pathname === '/quanly/' ||
        window.location.pathname === '/admin' ||
        window.location.pathname === '/admin/'
      ) {
        window.history.replaceState(null, '', `/${hashRoute}`);
      }
      window.location.hash = hashRoute;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  useEffect(() => {
    if (authUser) {
      setLocalAuthUser(authUser);
    }
  }, [authUser]);

  useEffect(() => {
    initAdminCloudSync();
    seedDemoMembersIfEmpty();
    try {
      const mig = migrateExistingPlacesCoordinates();
      if (mig.autoResolvedFromUrl > 0 || mig.categoryFixedCount > 0) {
        setRefreshTick(t => t + 1);
      }
    } catch {}
    prefetchDigitalMapGeoLayers().catch(() => {});
    const onSync = () => setRefreshTick(t => t + 1);
    const onAuthChange = (e: Event) => {
      const customEvt = e as CustomEvent<UserAuthProfile | null>;
      setLocalAuthUser(customEvt.detail || getStoredAuthUser());
      setRefreshTick(t => t + 1);
    };
    window.addEventListener('xuanhoa_admin_sync', onSync);
    window.addEventListener('xuanhoa_auth_change', onAuthChange);
    return () => {
      window.removeEventListener('xuanhoa_admin_sync', onSync);
      window.removeEventListener('xuanhoa_auth_change', onAuthChange);
    };
  }, []);

  const effectiveAuthUser = authUser || localAuthUser;
  const adminState = useMemo(() => getAdminState(), [refreshTick]);
  const adminAccounts = useMemo(() => getAdminAccounts(), [refreshTick]);
  const roleInfo = useMemo(
    () => getEffectiveAdminRoleInfo(loggedAdmin, effectiveAuthUser),
    [loggedAdmin, effectiveAuthUser, refreshTick]
  );
  const isSuperAdmin = roleInfo.isSuperAdmin;
  const canManageWeb = roleInfo.canManageWeb;
  const canManageMaps = roleInfo.canManageMaps;

  // Đảm bảo khi Quản lý đăng nhập chỉ vào đúng mảng được cấp quyền
  useEffect(() => {
    if (!roleInfo.isAuthenticated) return;
    if (!isSuperAdmin) {
      if (activeSection === 'overview' || activeSection === 'members' || activeSection === 'reviews' || activeSection === 'logs') {
        if (canManageWeb) setActiveSection('places');
        else if (canManageMaps) setActiveSection('maps');
      } else if (activeSection === 'places' && !canManageWeb && canManageMaps) {
        setActiveSection('maps');
      } else if (activeSection === 'maps' && !canManageMaps && canManageWeb) {
        setActiveSection('places');
      }
    }
  }, [roleInfo.isAuthenticated, isSuperAdmin, canManageWeb, canManageMaps, activeSection]);

  // Tách biệt hoàn toàn:
  // - commercialPlaces: CHỈ chứa các Quán ăn / Nhậu / Cafe / Ăn vặt / Dịch vụ (Dùng cho Quản lý Quán)
  // - allMapPlaces: Chứa toàn bộ Địa điểm Bản đồ gồm Hành chính & Công cộng, Trường học, và Quán (Dùng cho Quản lý Maps)
  const commercialPlaces = useMemo(() => getCommercialAdminPlaceItems(), [refreshTick]);
  const allMapPlaces = useMemo(() => getAllAdminPlaceAndLandmarkItems(), [refreshTick]);
  const managedOsmLandmarks = useMemo(() => getManagedOsmLandmarks(true), [refreshTick]);
  const osmLandmarkById = useMemo(
    () => new Map(managedOsmLandmarks.map(l => [l.id, l])),
    [managedOsmLandmarks]
  );
  const allDishes = useMemo(() => getAllManagedDishes(), [refreshTick]);
  const allReviews = useMemo(() => getAllSystemReviews(), [refreshTick]);

  // Danh sách chờ Admin duyệt (CHỈ khi Quản lý thực hiện Thêm mới hoặc Yêu cầu Xóa)
  const pendingWebPlaces = useMemo(() => {
    return commercialPlaces.filter(item => {
      const ov = adminState.places?.[item.place.id];
      return Boolean(ov?.pendingWebApproval);
    });
  }, [commercialPlaces, adminState]);

  const pendingMapPlaces = useMemo(() => {
    return allMapPlaces.filter(item => {
      const ov = adminState.places?.[item.place.id];
      return Boolean(ov?.pendingMapApproval);
    });
  }, [allMapPlaces, adminState]);

  const allMembers = useMemo(() => {
    const uniqueByEmail = new Map<string, (typeof adminState.members)[string]>();
    for (const m of Object.values(adminState.members || {})) {
      if (!m || !m.email) continue;
      const emailKey = m.email.trim().toLowerCase();
      if (!uniqueByEmail.has(emailKey)) {
        uniqueByEmail.set(emailKey, m);
      }
    }
    return Array.from(uniqueByEmail.values()).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }, [adminState]);

  const sectorTags: SectorCategoryTag[] = useMemo(() => {
    return adminState.sectorTags && adminState.sectorTags.length > 0
      ? adminState.sectorTags
      : DEFAULT_SECTOR_TAGS;
  }, [adminState]);

  // Phân khu dành riêng cho Quản lý Quán (Loại bỏ Địa Danh / Hành Chính / Trường Học để không bao giờ lẫn vào Quán)
  const commercialSectorTags: SectorCategoryTag[] = useMemo(() => {
    return sectorTags.filter(s => s.id !== 'dia-danh');
  }, [sectorTags]);

  const getSectorShortLabel = (sectorId: string) => {
    const found = sectorTags.find(s => s.id === sectorId);
    if (!found) return sectorId;
    return found.label.split(' (')[0];
  };

  const prevSectionRef = useRef<AdminSection>(activeSection);
  const loadedPlaceIdRef = useRef<string | null>(null);
  const [inlineActionFeedback, setInlineActionFeedback] = useState<string>('');

  useEffect(() => {
    const activeList = activeSection === 'maps' ? allMapPlaces : commercialPlaces;
    prevSectionRef.current = activeSection;

    if (!selectedPlaceId && activeList.length > 0) {
      selectPlaceForEdit(activeList[0], false);
    } else if (selectedPlaceId) {
      const inActiveList = activeList.find(p => p.place.id === selectedPlaceId);
      if (!inActiveList && activeList.length > 0) {
        selectPlaceForEdit(activeList[0], false);
      } else if (inActiveList && loadedPlaceIdRef.current !== inActiveList.place.id) {
        selectPlaceForEdit(inActiveList, false);
      }
    }
  }, [commercialPlaces, allMapPlaces, selectedPlaceId, activeSection]);

  const selectPlaceForEdit = useCallback((item: AdminPlaceItem, playFeedback = true) => {
    if (playFeedback) triggerFeedback('tap');
    resolveRequestIdRef.current += 1;
    const reqId = resolveRequestIdRef.current;
    if (resolveAbortRef.current) {
      resolveAbortRef.current.abort();
      resolveAbortRef.current = null;
    }

    const targetPlaceId = item.place.id;
    loadedPlaceIdRef.current = targetPlaceId;
    setSelectedPlaceId(targetPlaceId);
    setEditPlaceName(item.place.name);
    setEditPlaceTagline(item.place.tagline);
    setEditPlaceSectorTag(item.sectorTag || 'an-chinh');
    setEditPlaceCategory(item.place.category);
    setEditPlaceTagsText((item.place.tags || []).join(', '));
    setEditPlaceAddress(item.place.address);
    setEditPlaceZone(item.place.zone || 'dhsp2');
    setEditPlaceDistance(item.place.distance || 'Cách ĐHSP2 400m');
    setEditPlacePhone(item.place.phone || '');
    setEditPlaceHours(item.place.openHours || '07:00 - 22:00');
    setEditPlaceServiceMode(item.place.serviceMode || 'both');
    setEditPlacePriorityBoost(item.priorityBoost || 1);
    setEditPlaceDeliveryNote(item.place.deliveryNote || '');
    setEditPlaceMapsQuery(item.place.mapsQuery || `${item.place.name} Xuân Hòa Phúc Yên`);
    setEditPlaceMapsUrl(item.place.mapsUrl || '');
    setEditPlaceMinPrice(item.place.minPrice);
    setEditPlaceMaxPrice(item.place.maxPrice);
    setEditPlaceSigName(item.place.signatureDish.name);
    setEditPlaceSigPrice(item.place.signatureDish.price);
    setEditPlaceQuip(item.place.quip || '');
    setEditPlaceImageUrl(item.place.imageUrl || '');

    const currentAdminState = getAdminState();
    const ov = currentAdminState.places?.[targetPlaceId];
    const osmItem = osmLandmarkById.get(targetPlaceId);
    const isCivic =
      Boolean(osmItem) ||
      item.sectorTag === 'dia-danh' ||
      ov?.sectorTag === 'dia-danh' ||
      ov?.mapCategory === 'public' ||
      ov?.mapCategory === 'school' ||
      ov?.mapCategory === 'medical';
    const isExplicitlyUnpinned =
      ov?.coordinateVerified === false &&
      !ov?.pendingMapApproval &&
      !(ov?.mapsUrl || item.place.mapsUrl);
    const hasVerifiedOvCoords =
      !isExplicitlyUnpinned &&
      typeof ov?.lat === 'number' &&
      typeof ov?.lng === 'number' &&
      (isCivic || ov?.adminPinApproved === true || ov?.coordinateVerified === true || Boolean(ov?.pendingMapApproval));
    const parsedFromMapsUrl =
      !hasVerifiedOvCoords && (ov?.mapsUrl || item.place.mapsUrl)
        ? parseCoordinatesFromInputOrUrl(ov?.mapsUrl || item.place.mapsUrl || '')
        : null;
    const resolvedLat = isExplicitlyUnpinned
      ? null
      : hasVerifiedOvCoords
      ? ov!.lat
      : parsedFromMapsUrl
      ? parsedFromMapsUrl.lat
      : osmItem?.lat ?? null;
    const resolvedLng = isExplicitlyUnpinned
      ? null
      : hasVerifiedOvCoords
      ? ov!.lng
      : parsedFromMapsUrl
      ? parsedFromMapsUrl.lng
      : osmItem?.lng ?? null;
    const hasResolvedCoords = typeof resolvedLat === 'number' && typeof resolvedLng === 'number';
    setEditPlaceLat(hasResolvedCoords ? String(resolvedLat) : '');
    setEditPlaceLng(hasResolvedCoords ? String(resolvedLng) : '');
    setHasActivelyPinnedOnMap(hasResolvedCoords);

    if (!hasResolvedCoords && (ov?.mapsUrl || item.place.mapsUrl) && ov?.mapsLinkStatus !== 'invalid') {
      const candidateShortUrl = (ov?.mapsUrl || item.place.mapsUrl || '').trim();
      if (/^https?:\/\//i.test(candidateShortUrl)) {
        const abortCtrl = new AbortController();
        resolveAbortRef.current = abortCtrl;
        expandAndParseShortMapsUrl(candidateShortUrl, abortCtrl.signal).then(expanded => {
          if (resolveRequestIdRef.current !== reqId || loadedPlaceIdRef.current !== targetPlaceId) {
            return;
          }
          if (expanded) {
            setEditPlaceLat(String(expanded.lat));
            setEditPlaceLng(String(expanded.lng));
            setHasActivelyPinnedOnMap(true);
            savePlaceAdminOverride(
              targetPlaceId,
              {
                lat: expanded.lat,
                lng: expanded.lng,
                coordinateVerified: true,
                adminPinApproved: true,
                locationStatus: 'located',
                mapsLinkStatus: 'valid',
                coordinateSource: 'google_maps_resolved',
                lastVerifiedAt: new Date().toISOString().slice(0, 10),
              },
              'Tự động giải mã tọa độ từ link Google Maps rút gọn'
            );
            setMapFlyTrigger(t => t + 1);
            setRefreshTick(t => t + 1);
            setInlineActionFeedback(
              `📍 Đã tự động giải mã & ghim tọa độ (${expanded.lat}, ${expanded.lng}) lên Bản đồ!`
            );
          }
        });
      }
    }
    if (playFeedback) {
      setInlineActionFeedback(
        hasResolvedCoords
          ? `🎯 Đang chọn: "${item.place.name}" (${resolvedLat}, ${resolvedLng})`
          : `🎯 Đang chọn: "${item.place.name}" — Chưa ghim tọa độ (Bấm "Tìm tọa độ" hoặc chấm trực tiếp lên Bản đồ Cột 3)`
      );
    }

    const resolvedMapCat = (osmItem?.category ||
      resolvePlaceMapCategory(
        item.place,
        ov?.sectorTag || item.sectorTag,
        ov?.mapCategory || item.mapCategory
      )) as EditableMapCategory;
    setEditPlaceMapCategory(resolvedMapCat);
    setAdminGeoSuggestions([]);

    setEditPlaceMenu(
      (item.fullMenu || []).map(m => ({
        id: m.id,
        name: m.name,
        price: m.price,
        category: m.category || 'Món chính',
        description: m.description || '',
        serviceTag: m.serviceTag || 'both',
        isLocked: !!m.isLocked,
      }))
    );
    setDishSearchInPlace('');
    setEditingDishIndex(null);
    setIsAddingDishRow(false);
  }, [osmLandmarkById]);

  const handleSelectRowInMapsList = useCallback(
    (item: AdminPlaceItem) => {
      selectPlaceForEdit(item);
      setMobileShowDetailPane(true);
    },
    [selectPlaceForEdit]
  );

  // Lọc và sắp xếp danh sách quán theo đúng bảng chữ cái A -> B -> C -> D (hoặc tab Duyệt Quán)
  const filteredPlaces = useMemo(() => {
    const q = placeSearch.trim().toLowerCase();
    const sourceList = placeListTab === 'pending_web' ? pendingWebPlaces : commercialPlaces;
    const list = sourceList.filter(item => {
      if (placeSectorFilter !== 'all' && item.sectorTag !== placeSectorFilter) return false;
      if (placeStatusFilter === 'boosted') {
        if (item.priorityBoost <= 1) return false;
      } else if (placeStatusFilter !== 'all' && item.status !== placeStatusFilter) {
        return false;
      }
      if (!q) return true;

      const matchPlaceInfo =
        item.place.name.toLowerCase().includes(q) ||
        item.place.address.toLowerCase().includes(q) ||
        (item.place.phone || '').toLowerCase().includes(q) ||
        (item.place.tags || []).some(t => t.toLowerCase().includes(q));

      const matchDishInside =
        item.place.signatureDish.name.toLowerCase().includes(q) ||
        (item.fullMenu || []).some(m => m.name.toLowerCase().includes(q));

      return matchPlaceInfo || matchDishInside;
    });

    // Luôn xếp chuẩn theo bảng chữ cái A -> B -> C -> D
    return [...list].sort((a, b) => a.place.name.localeCompare(b.place.name, 'vi'));
  }, [commercialPlaces, pendingWebPlaces, placeListTab, placeSearch, placeSectorFilter, placeStatusFilter]);

  // Lọc danh sách Địa điểm cho mục Quản lý Maps (Cột 1 của Quản lý Maps) — Tách bạch tuyệt đối locationStatus và mapsLinkStatus
  const getResolvedPlaceCoordsAndCat = useCallback(
    (item: AdminPlaceItem) => {
      const ov = adminState.places?.[item.place.id];
      const osmItem = osmLandmarkById.get(item.place.id);
      const isCivic =
        Boolean(osmItem) ||
        item.sectorTag === 'dia-danh' ||
        ov?.sectorTag === 'dia-danh' ||
        ov?.mapCategory === 'public' ||
        ov?.mapCategory === 'school' ||
        ov?.mapCategory === 'medical';
      const isExplicitlyUnpinned = ov?.coordinateVerified === false;
      const hasVerifiedOv =
        !isExplicitlyUnpinned &&
        typeof ov?.lat === 'number' &&
        typeof ov?.lng === 'number' &&
        (ov?.coordinateVerified === true || ov?.locationStatus === 'located') &&
        !ov?.pendingMapApproval &&
        (isCivic || ov?.adminPinApproved === true || ov?.coordinateVerified === true);
      const lat = isExplicitlyUnpinned ? null : hasVerifiedOv ? ov!.lat! : osmItem?.lat ?? null;
      const lng = isExplicitlyUnpinned ? null : hasVerifiedOv ? ov!.lng! : osmItem?.lng ?? null;
      const hasCoords = typeof lat === 'number' && typeof lng === 'number';
      const mapCat = (osmItem?.category ||
        resolvePlaceMapCategory(
          item.place,
          ov?.sectorTag || item.sectorTag,
          ov?.mapCategory || item.mapCategory
        )) as EditableMapCategory;
      const rawMapsUrl = (ov?.mapsUrl ?? item.place.mapsUrl ?? '').trim();
      const mapsLinkStatus = computeMapsLinkStatus(ov, item.place.mapsUrl);
      const isLinkError = mapsLinkStatus === 'invalid' || mapsLinkStatus === 'unresolved';
      const locationStatus: 'located' | 'unlocated' | 'invalid_coordinates' = hasCoords
        ? 'located'
        : 'unlocated';
      return {
        lat,
        lng,
        hasCoords,
        mapCat,
        locationStatus,
        mapsLinkStatus,
        isLinkError,
        rawMapsUrl,
      };
    },
    [adminState, osmLandmarkById]
  );

  // Thống kê số lượng trạng thái định vị cho Quản lý Maps — DÙNG CÙNG 1 NGUỒN VÀ CÙNG 1 PREDICATE VỚI filteredMapPlaces
  const mapLocationStats = useMemo(() => {
    const sourceList = mapListTab === 'pending_maps' ? pendingMapPlaces : allMapPlaces;
    let total = 0;
    let located = 0;
    let unlocated = 0;
    let invalid = 0;
    for (const item of sourceList) {
      const { hasCoords, mapCat, isLinkError } = getResolvedPlaceCoordsAndCat(item);
      if (!matchesMapCategoryFilter(item, mapCat, mapCatFilter)) continue;
      total++;
      if (hasCoords) located++;
      else unlocated++;
      if (isLinkError) invalid++;
    }
    logMapDebug('FILTER COUNTS', {
      mapListTab,
      mapCatFilter,
      total,
      located,
      unlocated,
      linkError: invalid,
    });
    return {
      total,
      located,
      unlocated,
      invalid,
      commercialCount: commercialPlaces.length,
      landmarkCount: Math.max(0, allMapPlaces.length - commercialPlaces.length),
    };
  }, [
    allMapPlaces,
    pendingMapPlaces,
    mapListTab,
    mapCatFilter,
    commercialPlaces.length,
    getResolvedPlaceCoordsAndCat,
  ]);

  const filteredMapPlaces = useMemo(() => {
    const qRaw = debouncedMapSearch.trim().toLowerCase();
    const qNorm = qRaw ? normalizeVietnamese(debouncedMapSearch) : '';
    const sourceList = mapListTab === 'pending_maps' ? pendingMapPlaces : allMapPlaces;
    const list = sourceList.filter(item => {
      const { hasCoords, mapCat, isLinkError, rawMapsUrl } = getResolvedPlaceCoordsAndCat(item);
      if (!matchesMapCategoryFilter(item, mapCat, mapCatFilter)) return false;
      if (mapCoordFilter === 'verified' && !hasCoords) return false;
      if (mapCoordFilter === 'unverified' && hasCoords) return false;
      if (mapCoordFilter === 'invalid' && !isLinkError) return false;
      if (mapCoordFilter === 'locked' && item.status !== 'locked') return false;
      if (!qRaw) return true;

      if (item.normalizedHaystack && qNorm && item.normalizedHaystack.includes(qNorm)) {
        return true;
      }
      const catLabel = EDITABLE_MAP_CATEGORIES.find(c => c.id === mapCat)?.label || mapCat;
      const sectorLabel = getSectorShortLabel(item.sectorTag || '');
      const haystackRaw = `${item.place.name} ${item.place.address} ${item.place.phone || ''} ${catLabel} ${sectorLabel} ${mapCat} ${item.sectorTag} ${(item.place.tags || []).join(' ')} ${item.place.mapsQuery || ''} ${rawMapsUrl}`.toLowerCase();
      if (haystackRaw.includes(qRaw)) return true;
      if (qNorm && normalizeVietnamese(haystackRaw).includes(qNorm)) return true;
      return false;
    });
    return [...list].sort((a, b) => a.place.name.localeCompare(b.place.name, 'vi'));
  }, [
    allMapPlaces,
    pendingMapPlaces,
    mapListTab,
    debouncedMapSearch,
    mapCatFilter,
    mapCoordFilter,
    getResolvedPlaceCoordsAndCat,
  ]);

  const getMatchedDishPreview = (item: AdminPlaceItem): string | null => {
    const q = placeSearch.trim().toLowerCase();
    if (!q) return null;
    const matchedMenu = (item.fullMenu || []).find(m => m.name.toLowerCase().includes(q));
    if (matchedMenu) return `${matchedMenu.name} (${matchedMenu.price}k)`;
    return null;
  };

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return allMembers.filter(m => {
      if (memberFilter !== 'all' && m.status !== memberFilter) return false;
      if (!q) return true;
      return (
        m.nickname.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q)
      );
    });
  }, [allMembers, memberSearch, memberFilter]);

  const selectedPlaceItem = useMemo(() => {
    const activeList = activeSection === 'maps' ? allMapPlaces : commercialPlaces;
    return (
      activeList.find(p => p.place.id === selectedPlaceId) ||
      allMapPlaces.find(p => p.place.id === selectedPlaceId) ||
      null
    );
  }, [commercialPlaces, allMapPlaces, selectedPlaceId, activeSection]);

  const adminMapEditContextRef = useRef({
    selectedPlaceItem,
    selectedPlaceId,
    editPlaceName,
    editPlaceAddress,
    editPlacePhone,
    editPlaceMapCategory,
    editPlaceSectorTag,
    isSuperAdmin,
    allMapPlaces,
    selectPlaceForEdit,
  });
  adminMapEditContextRef.current = {
    selectedPlaceItem,
    selectedPlaceId,
    editPlaceName,
    editPlaceAddress,
    editPlacePhone,
    editPlaceMapCategory,
    editPlaceSectorTag,
    isSuperAdmin,
    allMapPlaces,
    selectPlaceForEdit,
  };

  const handleAdminMapPickCoordinates = useCallback((pickedLat: number, pickedLng: number) => {
    const ctx = adminMapEditContextRef.current;
    if (!ctx.selectedPlaceItem) return;
    const cleanLat = Number(pickedLat.toFixed(6));
    const cleanLng = Number(pickedLng.toFixed(6));
    setEditPlaceLat(String(cleanLat));
    setEditPlaceLng(String(cleanLng));
    setHasActivelyPinnedOnMap(true);
    const targetName = ctx.editPlaceName.trim() || ctx.selectedPlaceItem.place.name;
    savePlaceAdminOverride(
      ctx.selectedPlaceItem.place.id,
      {
        name: targetName,
        address: ctx.editPlaceAddress.trim() || ctx.selectedPlaceItem.place.address,
        phone: ctx.editPlacePhone.trim() || ctx.selectedPlaceItem.place.phone,
        mapCategory: ctx.editPlaceMapCategory,
        sectorTag:
          ctx.editPlaceMapCategory === 'public' || ctx.editPlaceMapCategory === 'school'
            ? 'dia-danh'
            : ctx.editPlaceSectorTag,
        lat: cleanLat,
        lng: cleanLng,
        coordinateVerified: ctx.isSuperAdmin,
        adminPinApproved: ctx.isSuperAdmin,
        coordinateSource: 'admin_verified',
        ...(ctx.isSuperAdmin
          ? {
              status: 'active',
              pendingMapApproval: null,
              pendingWebApproval: null,
            }
          : {
              pendingMapApproval: {
                submittedBy: roleInfo.identifier || 'quanlymaps',
                submittedByName: roleInfo.displayName || 'Quản lý Maps',
                submittedAt: Date.now(),
                actionType: 'update',
                actionSummary: `Chờ Admin duyệt ghim tọa độ (${cleanLat}, ${cleanLng})`,
                previousLat: null,
                previousLng: null,
              },
            }),
      },
      `Ghim tọa độ (${cleanLat}, ${cleanLng}) cho "${targetName}"`
    );
    setRefreshTick(t => t + 1);
    setJustSavedPlace(true);
    setTimeout(() => setJustSavedPlace(false), 1800);
    const pinMsg = `✅ Đã chấm & lưu ngay vị trí "${targetName}" (${cleanLat}, ${cleanLng})!`;
    setInlineActionFeedback(pinMsg);
    showToast(pinMsg, 'approve');
  }, []);

  const handleAdminMapSelectPlace = useCallback((pickedPlaceId: string) => {
    const ctx = adminMapEditContextRef.current;
    const found = ctx.allMapPlaces.find(p => p.place.id === pickedPlaceId);
    if (found && found.place.id !== ctx.selectedPlaceId) {
      ctx.selectPlaceForEdit(found);
    }
  }, []);

  const totalMenuDishesCount = useMemo(() => {
    return commercialPlaces.reduce((acc, item) => acc + (item.fullMenu?.length || 0), 0);
  }, [commercialPlaces]);

  const redirectToCustomerHome = () => {
    if (typeof window !== 'undefined') {
      if (
        window.location.pathname === '/quanly' ||
        window.location.pathname === '/quanly/' ||
        window.location.pathname === '/admin' ||
        window.location.pathname === '/admin/'
      ) {
        window.history.replaceState(null, '', '/#/');
      }
      window.location.hash = '#/';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    onBackToApp();
  };

  // Xử lý đăng nhập Admin (theo Nick + Mật khẩu) hoặc Quản lý (nếu gõ trực tiếp Gmail vào ô tài khoản)
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanInput = loginUsername.trim().toLowerCase();
    if (cleanInput.includes('@')) {
      await ensureCloudPermissionsSyncedForEmail(cleanInput);
      const freshState = getAdminState();
      const member = freshState.members?.[cleanInput];
      const isSuperEmail = Boolean(
        freshState.adminEmails?.some(em => em.trim().toLowerCase() === cleanInput)
      );
      if (isSuperEmail || (member && (member.canManageWeb || member.canManageMaps || member.status === 'admin'))) {
        saveAuthUser({
          isLoggedIn: true,
          uid: member?.uid || `uid_${cleanInput.replace(/[^a-z0-9]/g, '_')}`,
          email: cleanInput,
          displayName: member?.displayName || member?.nickname || cleanInput,
          nickname: member?.nickname || member?.displayName || cleanInput,
          gender: member?.gender || 'male',
          avatar: member?.avatar || '🛡️',
          avatarId: member?.avatarId || 'm_ty',
          hasCompletedProfile: true,
          isFirstTimeSetupDone: true,
          createdAt: member?.createdAt || Date.now(),
        });
        setRefreshTick(t => t + 1);
        showToast(`Xin chào ${member?.nickname || cleanInput}!`);
        return;
      }
      // Không được cấp quyền quản lý -> đẩy thẳng ra trang chính dùng như khách hàng
      redirectToCustomerHome();
      return;
    }

    const res = loginAdminWithCredentials(loginUsername, loginPassword, loginRememberMe);
    if (!res.ok || !res.account) {
      setLoginError(res.message || 'Sai tài khoản hoặc mật khẩu');
      return;
    }
    setLoggedAdmin(res.account);
    setLoginPassword('');
    showToast(`Xin chào ${res.account.displayName}!`);
  };

  const handleGoogleOAuthLoginInAdmin = async () => {
    setLoginError('');
    setIsGoogleAuthLoading(true);
    try {
      const googleInfo = await signInWithGoogleService();
      if (!googleInfo) {
        return;
      }
      const user = createOrUpdateAuthUserFromGoogle(googleInfo);
      setLocalAuthUser(user);
      syncUserToAdminRegistry(user);
      await ensureCloudPermissionsSyncedForEmail(user.email);
      setRefreshTick(t => t + 1);
      const latestRole = getEffectiveAdminRoleInfo(loggedAdmin, user);
      if (latestRole.isAuthenticated) {
        showToast(`Xin chào ${user.nickname || user.displayName || user.email}!`);
      } else {
        // Nếu Gmail không có quyền quản lý -> đẩy thẳng ra trang chính dùng Quay Món & Bản Đồ Số như khách hàng
        redirectToCustomerHome();
      }
    } catch (err: any) {
      if (err?.message && !String(err.message).includes('Đã hủy') && !String(err.message).includes('đóng cửa sổ')) {
        setLoginError(err.message);
      }
    } finally {
      setIsGoogleAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    logoutAdminSession();
    setLoggedAdmin(null);
    clearAuthUser();
    setLocalAuthUser(null);
    setIsSettingsModalOpen(false);
    setRefreshTick(t => t + 1);
    showToast('Đã thoát khỏi phiên Quản trị');
  };

  // Lưu thay đổi của Quán & Thực đơn (Chỉnh sửa: Áp dụng ngay lập tức không cần chờ duyệt; Admin lưu là mệnh lệnh tối cao)
  const handleSavePlaceAndMenu = (customMenuOverride?: CustomMenuEntry[], toastLabel?: string) => {
    if (!selectedPlaceItem || isSavingPlaceRef.current) return;
    isSavingPlaceRef.current = true;
    setIsSavingPlace(true);
    window.setTimeout(() => {
      isSavingPlaceRef.current = false;
      setIsSavingPlace(false);
    }, 280);

    const isEditingMapsSection = activeSection === 'maps';
    const isLandmarkCat =
      isEditingMapsSection &&
      (editPlaceMapCategory === 'public' || editPlaceMapCategory === 'school');

    const resolvedSectorTag = isLandmarkCat
      ? 'dia-danh'
      : editPlaceSectorTag === 'dia-danh' && !isEditingMapsSection
      ? 'an-chinh'
      : editPlaceSectorTag;

    const resolvedMapCat: EditableMapCategory = isEditingMapsSection
      ? editPlaceMapCategory
      : mapSectorTagToMapCategory(
          resolvedSectorTag,
          `${editPlaceName} ${editPlaceTagline} ${editPlaceTagsText}`,
          editPlaceMapCategory
        );

    const menuToSave = isLandmarkCat
      ? []
      : customMenuOverride !== undefined
      ? customMenuOverride
      : editPlaceMenu;
    const parsedTags = editPlaceTagsText
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    let mappedCategory: Place['category'] = editPlaceCategory;
    if (resolvedSectorTag === 'nhau-lau' || resolvedSectorTag === 'bia-game' || resolvedSectorTag === 'an-choi') {
      mappedCategory = 'pub';
    } else if (resolvedSectorTag === 'uong' || resolvedSectorTag === 'dien-thoai' || resolvedSectorTag === 'dich-vu') {
      mappedCategory = 'cafe';
    } else if (resolvedSectorTag === 'an-vat') {
      mappedCategory = 'fast_food';
    } else if (resolvedSectorTag === 'an-chinh') {
      mappedCategory = 'restaurant';
    }

    // Tự động trích xuất tọa độ trực tiếp từ link Google Maps / Plus Code nếu có
    const cleanMapsUrl = editPlaceMapsUrl.trim();
    const parsedFromUrl = parseCoordinatesFromInputOrUrl(cleanMapsUrl || editPlaceMapsQuery);
    const numLat = editPlaceLat.trim() !== '' ? Number(editPlaceLat) : parsedFromUrl?.lat;
    const numLng = editPlaceLng.trim() !== '' ? Number(editPlaceLng) : parsedFromUrl?.lng;
    const hasValidCoords =
      typeof numLat === 'number' &&
      typeof numLng === 'number' &&
      !Number.isNaN(numLat) &&
      !Number.isNaN(numLng) &&
      numLat >= 20.0 &&
      numLat <= 23.0 &&
      numLng >= 104.0 &&
      numLng <= 107.0;

    const initialMapsLinkStatus = !cleanMapsUrl
      ? 'none'
      : parseCoordinatesFromInputOrUrl(cleanMapsUrl)
      ? 'valid'
      : isShortOrUnresolvableMapsUrl(cleanMapsUrl)
      ? 'unresolved'
      : 'invalid';

    const targetPlaceId = selectedPlaceItem.place.id;
    const cleanPlaceName = editPlaceName.trim() || selectedPlaceItem.place.name;

    savePlaceAdminOverride(
      targetPlaceId,
      {
        name: cleanPlaceName,
        tagline: editPlaceTagline.trim(),
        sectorTag: resolvedSectorTag,
        mapCategory: resolvedMapCat,
        category: mappedCategory,
        tags: parsedTags,
        address: editPlaceAddress.trim(),
        zone: editPlaceZone,
        distance: editPlaceDistance.trim(),
        phone: editPlacePhone.trim(),
        openHours: editPlaceHours.trim(),
        serviceMode: editPlaceServiceMode,
        priorityBoost: editPlacePriorityBoost,
        isFeatured: editPlacePriorityBoost > 1,
        deliveryNote: editPlaceDeliveryNote.trim(),
        mapsQuery: editPlaceMapsQuery.trim() || `${cleanPlaceName} Xuân Hòa Phúc Yên`,
        mapsUrl: cleanMapsUrl,
        mapsLinkStatus: initialMapsLinkStatus,
        minPrice: isLandmarkCat ? 0 : Number(editPlaceMinPrice) || 20,
        maxPrice: isLandmarkCat ? 0 : Number(editPlaceMaxPrice) || 60,
        signatureDishName: isLandmarkCat ? 'Cơ quan / Địa danh' : editPlaceSigName.trim() || 'Món tủ',
        signatureDishPrice: isLandmarkCat ? 0 : Number(editPlaceSigPrice) || 35,
        quip: editPlaceQuip.trim(),
        imageUrl: editPlaceImageUrl.trim() || undefined,
        customMenu: menuToSave,
        ...(hasValidCoords
          ? {
              lat: Number(numLat!.toFixed(6)),
              lng: Number(numLng!.toFixed(6)),
              coordinateVerified: isSuperAdmin || isLandmarkCat,
              adminPinApproved: isSuperAdmin || isLandmarkCat,
              locationStatus: 'located',
              coordinateSource: 'admin_verified',
              ...(!isSuperAdmin && !isLandmarkCat
                ? {
                    pendingMapApproval: {
                      submittedBy: roleInfo.identifier || 'quanlymaps',
                      submittedByName: roleInfo.displayName || 'Quản lý Maps',
                      submittedAt: Date.now(),
                      actionType: 'update',
                      actionSummary: `Chờ Admin duyệt tọa độ (${Number(numLat!.toFixed(6))}, ${Number(numLng!.toFixed(6))})`,
                      previousLat: null,
                      previousLng: null,
                    },
                  }
                : {}),
            }
          : {}),
        // Chỉnh sửa thông tin/tọa độ có hiệu lực ngay lập tức. Nếu Admin lưu trên mục đang chờ duyệt thì tự động duyệt luôn!
        ...(isSuperAdmin
          ? {
              status: 'active',
              pendingWebApproval: null,
              pendingMapApproval: null,
            }
          : {}),
      },
      toastLabel || `Cập nhật "${cleanPlaceName}"`
    );

    setEditPlaceMapCategory(resolvedMapCat);
    if (hasValidCoords) {
      const cleanLat = Number(numLat!.toFixed(6));
      const cleanLng = Number(numLng!.toFixed(6));
      setEditPlaceLat(String(cleanLat));
      setEditPlaceLng(String(cleanLng));
      setHasActivelyPinnedOnMap(true);
      setMapFlyTrigger(t => t + 1);
    }

    setRefreshTick(t => t + 1);
    setJustSavedPlace(true);
    setTimeout(() => setJustSavedPlace(false), 1800);

    const isUnresolvedMapsLink = initialMapsLinkStatus === 'unresolved' || initialMapsLinkStatus === 'invalid';
    const finalMsg =
      toastLabel ||
      (hasValidCoords
        ? `✅ Đã cập nhật & ghim Bản đồ "${cleanPlaceName}" (${Number(numLat!.toFixed(6))}, ${Number(numLng!.toFixed(6))})`
        : isUnresolvedMapsLink
        ? `⚠️ Đã lưu "${cleanPlaceName}" — đang kiểm tra link Google Maps...`
        : `✅ Đã cập nhật "${cleanPlaceName}"`);
    setInlineActionFeedback(finalMsg);
    showToast(finalMsg, !hasValidCoords && isUnresolvedMapsLink ? 'warn' : 'approve');

    // Nếu người dùng dán link Google Maps rút gọn chưa có tọa độ trực tiếp, phân giải qua Server-Side Resolver (KHÔNG tự động fallback sang Nominatim khi lưu)
    if (!hasValidCoords && cleanMapsUrl) {
      resolveRequestIdRef.current += 1;
      const reqId = resolveRequestIdRef.current;
      if (resolveAbortRef.current) {
        resolveAbortRef.current.abort();
      }
      const abortCtrl = new AbortController();
      resolveAbortRef.current = abortCtrl;

      resolvePlaceCoordinates({
        mapsUrl: cleanMapsUrl,
        mapsQuery: editPlaceMapsQuery.trim(),
        address: editPlaceAddress.trim(),
        name: cleanPlaceName,
        allowGeocode: false,
        signal: abortCtrl.signal,
      })
        .then(resolved => {
          if (resolveRequestIdRef.current !== reqId) return;
          const latestOv = getAdminState().places?.[targetPlaceId];
          // Không bao giờ ghi đè nếu Admin đã chấm tay lên bản đồ trong lúc đang chờ mạng
          if (
            latestOv?.coordinateSource === 'admin_verified' &&
            typeof latestOv.lat === 'number' &&
            typeof latestOv.lng === 'number'
          ) {
            return;
          }
          if (resolved.status === 'located' && resolved.lat !== null && resolved.lng !== null) {
            savePlaceAdminOverride(targetPlaceId, {
              lat: resolved.lat,
              lng: resolved.lng,
              coordinateVerified: isSuperAdmin || isLandmarkCat,
              adminPinApproved: isSuperAdmin || isLandmarkCat,
              locationStatus: 'located',
              mapsLinkStatus: 'valid',
              coordinateSource: 'google_maps_resolved',
            });
            if (loadedPlaceIdRef.current === targetPlaceId) {
              setEditPlaceLat(String(resolved.lat));
              setEditPlaceLng(String(resolved.lng));
              setHasActivelyPinnedOnMap(true);
              setMapFlyTrigger(t => t + 1);
            }
            setRefreshTick(t => t + 1);
            const autoMsg = `📍 Đã giải mã link Google Maps (${resolved.lat}, ${resolved.lng}) và ghim "${cleanPlaceName}" lên Bản đồ!`;
            setInlineActionFeedback(autoMsg);
            showToast(autoMsg, 'approve');
          } else {
            savePlaceAdminOverride(targetPlaceId, {
              mapsLinkStatus: 'invalid',
            });
            setRefreshTick(t => t + 1);
            const errMsg = resolved.note || 'Không thể đọc tọa độ chính xác từ Google Maps.';
            setInlineActionFeedback(`⚠️ ${errMsg}`);
            showToast(`⚠️ ${errMsg}`, 'warn');
          }
        })
        .catch(() => {});
    }
  };

  const handleChangePriorityBoost = (nextBoost: 1 | 2 | 3) => {
    if (!selectedPlaceItem) return;
    setEditPlacePriorityBoost(nextBoost);
    savePlaceAdminOverride(
      selectedPlaceItem.place.id,
      {
        priorityBoost: nextBoost,
        isFeatured: nextBoost > 1,
      },
      nextBoost === 1
        ? `Đặt tần suất bình thường cho "${selectedPlaceItem.place.name}"`
        : `Bật Ưu tiên x${nextBoost} xuất hiện Quán & Món cho "${selectedPlaceItem.place.name}"`
    );
    setRefreshTick(t => t + 1);
    showToast(
      nextBoost === 1
        ? 'Đã chuyển về tần suất xuất hiện bình thường'
        : `⚡ Đã bật Ưu tiên x${nextBoost} (Quán & Món sẽ xuất hiện nhiều hơn gấp ${nextBoost} lần)`,
      'approve'
    );
  };

  const handleAddInlineSector = () => {
    if (!inlineSectorLabel.trim()) return;
    const slug = inlineSectorLabel
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    const newId = slug || `tag-${Date.now()}`;
    const next = [...sectorTags, { id: newId, label: inlineSectorLabel.trim() }];
    updateAdminSystemSettings({ sectorTags: next });
    setEditPlaceSectorTag(newId);
    setInlineSectorLabel('');
    setIsAddingSectorInline(false);
    setRefreshTick(t => t + 1);
    showToast(`Đã thêm phân khu: ${inlineSectorLabel.trim()}`);
  };

  const handleAddMenuDishToPlace = () => {
    if (!newMenuDishName.trim()) {
      showToast('Vui lòng nhập tên món mới', 'warn');
      return;
    }
    const priceNum = Number(newMenuDishPrice) || 30;
    const newEntry: CustomMenuEntry = {
      id: `m_${Date.now()}`,
      name: newMenuDishName.trim(),
      price: priceNum,
      category: newMenuDishCat.trim() || 'Món chính',
      description: newMenuDishDesc.trim(),
      serviceTag: 'both',
      isLocked: false,
    };
    const nextMenu = [newEntry, ...editPlaceMenu];
    setEditPlaceMenu(nextMenu);
    setNewMenuDishName('');
    setNewMenuDishDesc('');
    setIsAddingDishRow(false);
    handleSavePlaceAndMenu(nextMenu, `✅ Đã thêm món "${newEntry.name}" (${priceNum}k)`);
  };

  const handleToggleLockDishInPlace = (idx: number) => {
    const next = [...editPlaceMenu];
    next[idx] = { ...next[idx], isLocked: !next[idx].isLocked };
    setEditPlaceMenu(next);
    handleSavePlaceAndMenu(
      next,
      `${next[idx].isLocked ? '⏳ Tạm hết món' : '✓ Mở bán lại'}: "${next[idx].name}"`
    );
  };

  const handleDeleteDishFromPlace = (idx: number) => {
    const targetName = editPlaceMenu[idx]?.name || 'món ăn';
    const next = editPlaceMenu.filter((_, i) => i !== idx);
    setEditPlaceMenu(next);
    if (editingDishIndex === idx) setEditingDishIndex(null);
    handleSavePlaceAndMenu(next, `Đã xóa món "${targetName}"`);
  };

  const handleCreatePlace = () => {
    if (!newPlaceForm.name.trim()) {
      showToast('⚠️ Vui lòng nhập Tên địa điểm / Tên quán trước khi bấm Tạo!', 'warn');
      return;
    }
    const isFromMapsSection = activeSection === 'maps';
    const isLandmarkCat =
      isFromMapsSection &&
      (newPlaceForm.mapCategory === 'public' || newPlaceForm.mapCategory === 'school');

    const resolvedSectorTag = isLandmarkCat
      ? 'dia-danh'
      : newPlaceForm.sectorTag === 'dia-danh'
      ? 'an-chinh'
      : newPlaceForm.sectorTag;

    const newId = `xh_custom_${Date.now()}`;
    let mappedCategory: Place['category'] = 'restaurant';
    if (resolvedSectorTag === 'nhau-lau' || resolvedSectorTag === 'bia-game' || resolvedSectorTag === 'an-choi') {
      mappedCategory = 'pub';
    } else if (resolvedSectorTag === 'uong' || resolvedSectorTag === 'dien-thoai' || resolvedSectorTag === 'dich-vu') {
      mappedCategory = 'cafe';
    } else if (resolvedSectorTag === 'an-vat') {
      mappedCategory = 'fast_food';
    }

    const resolvedMapCat: EditableMapCategory = isFromMapsSection
      ? newPlaceForm.mapCategory
      : mapSectorTagToMapCategory(
          resolvedSectorTag,
          `${newPlaceForm.name} ${newPlaceForm.address}`,
          newPlaceForm.mapCategory
        );
    const mapCatLabel =
      EDITABLE_MAP_CATEGORIES.find(c => c.id === resolvedMapCat)?.label || resolvedMapCat;

    const created: Place = {
      id: newId,
      name: newPlaceForm.name.trim(),
      category: mappedCategory,
      tagline: isLandmarkCat
        ? `${newPlaceForm.mapCategory === 'school' ? 'Trường học & Giảng đường' : 'Hành chính & Công cộng'} • Xuân Hòa`
        : `${newPlaceForm.name.trim()} • Xuân Hòa`,
      tags: isLandmarkCat
        ? [newPlaceForm.mapCategory === 'school' ? 'Trường học' : 'Hành chính', 'Xuân Hòa']
        : [getSectorShortLabel(resolvedSectorTag), mapCatLabel, 'Xuân Hòa'],
      serviceMode: 'dine_in_only',
      zone: 'dhsp2',
      address: newPlaceForm.address.trim(),
      distance: 'Cách ĐHSP2 350m',
      minPrice: isLandmarkCat ? 0 : 25,
      maxPrice: isLandmarkCat ? 0 : 65,
      priceRange: isLandmarkCat ? '' : '25k - 65k',
      rating: 4.9,
      reviewCount: 1,
      imageUrl: '',
      rarity: 2,
      openHours: newPlaceForm.openHours.trim() || '07:00 - 22:00',
      phone: newPlaceForm.phone.trim(),
      mapsQuery: `${newPlaceForm.name.trim()} Xuân Hòa Phúc Yên`,
      mapsUrl: newPlaceForm.mapsUrl.trim() || undefined,
      signatureDish: {
        id: `${newId}_sig`,
        name: isLandmarkCat ? 'Địa danh / Cơ quan' : newPlaceForm.sigDishName.trim() || 'Món đặc trưng',
        price: isLandmarkCat ? 0 : Number(newPlaceForm.sigDishPrice) || 35,
      },
      menu: isLandmarkCat
        ? []
        : [
            {
              id: `${newId}_m1`,
              name: newPlaceForm.sigDishName.trim() || 'Món đặc trưng',
              price: Number(newPlaceForm.sigDishPrice) || 35,
              tag: 'Bán chạy',
              serviceTag: 'both',
            },
          ],
      quip: isLandmarkCat
        ? 'Địa điểm Hành chính / Công cộng / Trường học trên Bản đồ số Xuân Hòa.'
        : 'Quán tại Xuân Hòa Có Gì.',
    };
    createNewCustomPlace(created);
    const parsedFromUrl = parseCoordinatesFromInputOrUrl(
      newPlaceForm.mapsUrl || newPlaceForm.address
    );
    const numLat = newPlaceForm.lat.trim() !== '' ? Number(newPlaceForm.lat) : parsedFromUrl?.lat;
    const numLng = newPlaceForm.lng.trim() !== '' ? Number(newPlaceForm.lng) : parsedFromUrl?.lng;
    const hasCoords =
      typeof numLat === 'number' &&
      typeof numLng === 'number' &&
      !Number.isNaN(numLat) &&
      !Number.isNaN(numLng) &&
      numLat >= 20.0 &&
      numLat <= 23.0 &&
      numLng >= 104.0 &&
      numLng <= 107.0;

    const cleanNewMapsUrl = newPlaceForm.mapsUrl.trim();
    const initialNewMapsLinkStatus = !cleanNewMapsUrl
      ? 'none'
      : parseCoordinatesFromInputOrUrl(cleanNewMapsUrl)
      ? 'valid'
      : isShortOrUnresolvableMapsUrl(cleanNewMapsUrl)
      ? 'unresolved'
      : 'invalid';
    const isUnresolvedMapsLink =
      initialNewMapsLinkStatus === 'unresolved' || initialNewMapsLinkStatus === 'invalid';

    savePlaceAdminOverride(newId, {
      status: 'active',
      sectorTag: resolvedSectorTag,
      mapCategory: resolvedMapCat,
      customMenu: isLandmarkCat ? [] : undefined,
      locationStatus: hasCoords ? 'located' : 'unlocated',
      mapsLinkStatus: initialNewMapsLinkStatus,
      ...(hasCoords
        ? {
            lat: Number(numLat!.toFixed(6)),
            lng: Number(numLng!.toFixed(6)),
            coordinateVerified: isSuperAdmin,
            adminPinApproved: isSuperAdmin,
            coordinateSource: 'admin_verified',
          }
        : {}),
      // Admin tạo là mệnh lệnh thực thi luôn, chỉ Quản lý tạo mới cần chờ duyệt!
      ...(!isSuperAdmin
        ? isFromMapsSection
          ? {
              pendingMapApproval: {
                submittedBy: roleInfo.identifier || 'quanlymaps',
                submittedByName: roleInfo.displayName || 'Quản lý Maps',
                submittedAt: Date.now(),
                actionType: 'create',
                actionSummary: isLandmarkCat
                  ? `Thêm địa danh định vị mới (${newPlaceForm.mapCategory === 'school' ? 'Trường học' : 'Hành chính & Công cộng'})`
                  : 'Thêm địa điểm định vị mới',
                previousLat: null,
                previousLng: null,
                isNewPlace: true,
              },
            }
          : {
              pendingWebApproval: {
                submittedBy: roleInfo.identifier || 'quanlyweb',
                submittedByName: roleInfo.displayName || 'Quản lý Web',
                submittedAt: Date.now(),
                actionType: 'create',
                actionSummary: 'Thêm quán mới vào hệ thống',
                isNewPlace: true,
              },
            }
        : {
            pendingWebApproval: null,
            pendingMapApproval: null,
          }),
    });

    // Mở khóa toàn bộ bộ lọc tìm kiếm ở Cột 1 của cả Quản lý Quán và Quản lý Maps để mục vừa thêm luôn hiện 100%
    setMapListTab('all');
    setMapSearch('');
    setMapCatFilter('all');
    setMapCoordFilter('all');
    setPlaceListTab('all');
    setPlaceSearch('');
    setPlaceSectorFilter('all');
    setPlaceStatusFilter('all');

    loadedPlaceIdRef.current = newId;
    setSelectedPlaceId(newId);
    setEditPlaceName(created.name);
    setEditPlaceTagline(created.tagline);
    setEditPlaceSectorTag(resolvedSectorTag);
    setEditPlaceCategory(created.category);
    setEditPlaceTagsText((created.tags || []).join(', '));
    setEditPlaceAddress(created.address);
    setEditPlacePhone(created.phone || '');
    setEditPlaceHours(created.openHours || '07:00 - 22:00');
    setEditPlaceMapCategory(resolvedMapCat);
    setEditPlaceMapsQuery(created.mapsQuery || `${created.name} Xuân Hòa Phúc Yên`);
    setEditPlaceMapsUrl(created.mapsUrl || '');
    if (hasCoords) {
      const cleanLat = Number(numLat!.toFixed(6));
      const cleanLng = Number(numLng!.toFixed(6));
      setEditPlaceLat(String(cleanLat));
      setEditPlaceLng(String(cleanLng));
      setHasActivelyPinnedOnMap(true);
      setMapFlyTrigger(t => t + 1);
    } else {
      setEditPlaceLat('');
      setEditPlaceLng('');
      setHasActivelyPinnedOnMap(false);
    }

    setIsNewPlaceModalOpen(false);
    setRefreshTick(t => t + 1);
    setJustSavedPlace(true);
    setTimeout(() => setJustSavedPlace(false), 1800);

    const addMsg = !isSuperAdmin
      ? `✅ Đã thêm "${created.name}" và gửi vào Hộp Duyệt chờ Admin duyệt!`
      : hasCoords
      ? `✅ Đã thêm mới & ghim Bản đồ ngay lập tức: "${created.name}" (${Number(numLat!.toFixed(6))}, ${Number(numLng!.toFixed(6))})!`
      : isUnresolvedMapsLink
      ? `⚠️ Đã tạo "${created.name}"! Link Maps rút gọn không chứa sẵn tọa độ số — đã đưa vào mục Chưa định vị trong Quản lý Maps để chấm tay.`
      : `✅ Đã tạo "${created.name}" (nằm trong mục Chưa định vị của Quản lý Maps)! Hãy dán link Maps hoặc bấm lên Bản đồ để ghim vị trí.`;
    setInlineActionFeedback(addMsg);
    showToast(addMsg, isUnresolvedMapsLink ? 'warn' : 'approve');

    // Nếu tạo quán có kèm link Google Maps rút gọn chưa có sẵn số tọa độ, tự động thử phân giải tọa độ qua Server-Side Resolver
    if (!hasCoords && cleanNewMapsUrl) {
      resolvePlaceCoordinates({
        mapsUrl: cleanNewMapsUrl,
        mapsQuery: created.mapsQuery,
        address: newPlaceForm.address.trim(),
        name: created.name,
        allowGeocode: false,
      })
        .then(resolved => {
          const latestOv = getAdminState().places?.[newId];
          if (
            latestOv?.coordinateSource === 'admin_verified' &&
            typeof latestOv.lat === 'number' &&
            typeof latestOv.lng === 'number'
          ) {
            return;
          }
          if (resolved.status === 'located' && resolved.lat !== null && resolved.lng !== null) {
            savePlaceAdminOverride(newId, {
              lat: resolved.lat,
              lng: resolved.lng,
              coordinateVerified: isSuperAdmin,
              adminPinApproved: isSuperAdmin,
              locationStatus: 'located',
              mapsLinkStatus: 'valid',
              coordinateSource: 'google_maps_resolved',
            });
            if (loadedPlaceIdRef.current === newId) {
              setEditPlaceLat(String(resolved.lat));
              setEditPlaceLng(String(resolved.lng));
              setHasActivelyPinnedOnMap(true);
              setMapFlyTrigger(t => t + 1);
            }
            setRefreshTick(t => t + 1);
            const autoMsg = `📍 Đã giải mã link Google Maps (${resolved.lat}, ${resolved.lng}) và ghim "${created.name}" lên Bản đồ!`;
            setInlineActionFeedback(autoMsg);
            showToast(autoMsg, 'approve');
          } else {
            savePlaceAdminOverride(newId, {
              mapsLinkStatus: 'invalid',
            });
            setRefreshTick(t => t + 1);
          }
        })
        .catch(() => {});
    }
  };

  const handleDeletePlaceAction = (scope: 'web' | 'maps') => {
    if (!selectedPlaceItem) return;
    const targetId = selectedPlaceItem.place.id;
    const targetName = selectedPlaceItem.place.name;
    const currentList = scope === 'maps' ? filteredMapPlaces : filteredPlaces;
    const currentIdx = currentList.findIndex(item => item.place.id === targetId);
    const nextCandidate =
      currentIdx >= 0
        ? currentList[currentIdx + 1] || currentList[currentIdx - 1] || null
        : currentList.find(item => item.place.id !== targetId) || null;

    const res = requestOrExecuteDeletePlace(targetId, scope, targetName, isSuperAdmin);

    if (res.executedImmediately) {
      if (nextCandidate) {
        selectPlaceForEdit(nextCandidate, false);
      } else {
        loadedPlaceIdRef.current = null;
        setSelectedPlaceId('');
        setEditPlaceName('');
        setEditPlaceLat('');
        setEditPlaceLng('');
        setHasActivelyPinnedOnMap(false);
      }
    }

    setRefreshTick(t => t + 1);
    const delMsg = res.executedImmediately
      ? `🗑️ Đã xóa "${targetName}" khỏi ${scope === 'maps' ? 'Bản đồ số' : 'danh sách Quán'} ngay lập tức!`
      : `⏳ Đã gửi yêu cầu xóa "${targetName}" vào Hộp Duyệt chờ Admin!`;
    setInlineActionFeedback(delMsg);
    showToast(delMsg, res.executedImmediately ? 'approve' : 'warn');
  };

  const handleSaveAdminAccount = () => {
    if (!adminAccForm.username.trim() || !adminAccForm.password.trim()) {
      showToast('Vui lòng nhập đầy đủ Tên đăng nhập (Nick) và Mật khẩu', 'warn');
      return;
    }
    upsertAdminAccount({
      id: adminAccForm.id || undefined,
      username: adminAccForm.username,
      password: adminAccForm.password,
      displayName: adminAccForm.displayName || adminAccForm.username,
      role: adminAccForm.role,
      canManageWeb: adminAccForm.role === 'superadmin' ? true : adminAccForm.canManageWeb,
      canManageMaps: adminAccForm.role === 'superadmin' ? true : adminAccForm.canManageMaps,
    });
    setIsAdminAccModalOpen(false);
    setAdminAccForm({
      id: '',
      username: '',
      password: '',
      displayName: '',
      role: 'manager',
      canManageWeb: true,
      canManageMaps: false,
    });
    setRefreshTick(t => t + 1);
    showToast(`✅ Đã lưu tài khoản quản lý @${adminAccForm.username}`, 'approve');
  };

  const handleCreateSeederAccount = () => {
    if (!seederForm.nickname.trim()) return;
    const state = getAdminState();
    const emailKey = (
      seederForm.email.trim() ||
      `seeder.${Date.now().toString().slice(-4)}@xuanhoacogi.com`
    ).toLowerCase();

    const createdMember = {
      uid: `seeder_${Date.now()}`,
      email: emailKey,
      displayName: seederForm.nickname.trim(),
      nickname: seederForm.nickname.trim(),
      avatar: '',
      avatarId: 'm_thin',
      gender: 'male' as const,
      residentType: seederForm.residentType,
      status: 'active' as const,
      spinsCount: 5,
      level: 2,
      reviewsCount: 0,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isTestAccount: true,
    };
    state.members[emailKey] = createdMember;
    pushMemberToCloudRealtime(createdMember, true);
    saveAdminState(state);
    setIsAddSeederModalOpen(false);
    setSeederForm({ nickname: '', email: '', residentType: 'student_sp2' });
    setRefreshTick(t => t + 1);
    showToast(`✅ Đã tạo nick đánh giá: ${seederForm.nickname}`, 'approve');
  };

  const handleExportBackupJson = () => {
    const state = getAdminState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xuanhoacogi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải file sao lưu (.json)');
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        if (parsed && typeof parsed === 'object' && parsed.places) {
          saveAdminState(parsed, true);
          setRefreshTick(t => t + 1);
          showToast('Đã khôi phục dữ liệu thành công!', 'approve');
        } else {
          showToast('File không đúng định dạng sao lưu', 'warn');
        }
      } catch {
        showToast('Không thể đọc file sao lưu', 'warn');
      }
    };
    reader.readAsText(file);
  };

  const realMembersCount = allMembers.filter(m => !m.isTestAccount).length;
  const seederMembersCount = allMembers.filter(m => m.isTestAccount).length;
  const boostedPlacesCount = commercialPlaces.filter(p => p.priorityBoost > 1).length;

  // ===========================================================================
  // NẾU CHƯA ĐĂNG NHẬP TÀI KHOẢN QUẢN LÝ HOẶC GMAIL ĐƯỢC CẤP QUYỀN -> HIỆN TRANG ĐĂNG NHẬP TINH GỌN
  // ===========================================================================
  if (!roleInfo.isAuthenticated) {
    return (
      <div
        className="xh-admin-shell"
        style={{
          backgroundColor: theme.bgMain,
          color: theme.textPrimary,
          colorScheme: 'light',
          fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif",
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 16px 18px',
        }}
      >
        <div />

        <div
          style={{
            width: '100%',
            maxWidth: '370px',
            background: theme.bgCard,
            borderRadius: '18px',
            border: `1px solid ${theme.border}`,
            padding: '26px 22px 20px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: theme.accentSoft,
                color: theme.accent,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
              }}
            >
              <Shield size={21} />
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Đăng nhập Quản trị
            </h2>
          </div>

          {/* 1 NÚT KẾT NỐI GMAIL DUY NHẤT: ĐƯỢC CẤP QUYỀN THÌ VÀO, KHÔNG THÌ ĐẨY RA TRANG CHÍNH */}
          <button
            type="button"
            onClick={handleGoogleOAuthLoginInAdmin}
            disabled={isGoogleAuthLoading}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: '11px',
              border: `1.5px solid ${theme.border}`,
              background: '#FFFFFF',
              color: '#18181B',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: isGoogleAuthLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              marginBottom: '16px',
            }}
          >
            <GoogleGIcon size={18} />
            <span>
              {isGoogleAuthLoading ? 'Đang kết nối Gmail...' : 'Kết nối bằng Gmail'}
            </span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: theme.border }} />
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: theme.textMuted }}>
              HOẶC TÀI KHOẢN ADMIN
            </span>
            <div style={{ flex: 1, height: '1px', background: theme.border }} />
          </div>

          <form onSubmit={handleAdminLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            <div>
              <label style={compactLabelStyle(theme)}>Tài khoản</label>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="Nhập tài khoản..."
                autoComplete="username"
                style={compactInputStyle(theme)}
              />
            </div>

            <div>
              <label style={compactLabelStyle(theme)}>Mật khẩu</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPass ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  autoComplete="current-password"
                  style={{ ...compactInputStyle(theme), paddingRight: '38px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: theme.textMuted,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  {showLoginPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: theme.textSecondary,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={loginRememberMe}
                onChange={e => setLoginRememberMe(e.target.checked)}
                style={{ width: '14px', height: '14px', accentColor: theme.accent, cursor: 'pointer' }}
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>

            {loginError && (
              <div
                style={{
                  padding: '8px 11px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#B91C1C',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {loginError}
              </div>
            )}

            <button
              type="submit"
              style={{
                marginTop: '2px',
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: theme.accent,
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <LogIn size={15} />
              <span>Đăng nhập</span>
            </button>
          </form>

          <div
            style={{
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: `1px dashed ${theme.border}`,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={redirectToCustomerHome}
              style={{
                border: 'none',
                background: 'transparent',
                color: theme.textSecondary,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <ArrowLeft size={14} /> Trang chủ Xuân Hòa Có Gì
            </button>
          </div>
        </div>

        {/* BẢN QUYỀN DƯỚI CHÂN WEB ĐẸP & TINH TẾ */}
        <footer
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: theme.textMuted,
            fontWeight: 600,
            paddingTop: '16px',
            letterSpacing: '0.01em',
          }}
        >
          © 2026 <strong style={{ color: theme.textSecondary }}>Xuân Hòa Có Gì</strong> • Bản đồ số & Ẩm thực Xuân Hòa. Designed by{' '}
          <strong style={{ color: theme.accent }}>MinhTT</strong>. All Rights Reserved.
        </footer>
      </div>
    );
  }

  return (
    <div
      className={`xh-admin-shell ${adminState.fontScale === 'large' ? 'xh-font-large' : ''}`}
      style={{
        backgroundColor: theme.bgMain,
        color: theme.textPrimary,
        colorScheme: 'light',
        fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* THÔNG BÁO NHẢY LÊN (POPUP TOAST) KHI LƯU / THÊM / XÓA / DUYỆT — HIỆN RÕ RỒI TỰ TẮT (TRỪ MỤC MAPS ĐÃ CÓ BANNER GỌN CỘT 2) */}
      {toast && activeSection !== 'maps' && (
        <div
          key={toastId}
          onClick={() => setToast('')}
          style={{
            position: 'fixed',
            top: '58px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100005,
            background: toastKind === 'warn' ? '#7F1D1D' : '#064E3B',
            color: '#FFFFFF',
            padding: '10px 20px',
            borderRadius: '999px',
            boxShadow: '0 14px 34px rgba(0, 0, 0, 0.28)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 800,
            border: toastKind === 'warn' ? '2px solid #F87171' : '2px solid #34D399',
            maxWidth: '92vw',
            cursor: 'pointer',
            animation: 'xhToastJump 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <CheckCircle2
            size={16}
            style={{ color: toastKind === 'warn' ? '#FCA5A5' : '#34D399', flexShrink: 0 }}
          />
          <span>{toast}</span>
        </div>
      )}

      {/* TOPBAR TRÊN CÙNG — ĐÃ LÀM GỌN TỐI ĐA: CHỈ CÒN BẢN ĐỒ + TÊN/QUYỀN + CÀI ĐẶT */}
      <header
        className="xh-admin-topbar"
        style={{
          background: theme.bgSidebar,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: theme.accentSoft,
              color: theme.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Shield size={16} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span className="xh-topbar-title" style={{ fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap' }}>
              QUẢN TRỊ <span className="xh-hide-mobile">XUÂN HÒA CÓ GÌ</span>
            </span>
          </div>
        </div>

        {/* GÓC PHẢI GỌN GÀNG: BẢN ĐỒ + TÀI KHOẢN ĐANG ĐĂNG NHẬP + CÀI ĐẶT (THOÁT NẰM TRONG CÀI ĐẶT) */}
        <div className="xh-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => jumpToMapUrl('#/bandoso')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 11px',
              borderRadius: '8px',
              border: '1px solid #10B981',
              background: '#E6F7EF',
              color: '#047857',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Mở Bản Đồ Số Xuân Hòa"
          >
            <MapPin size={14} />
            <span>Bản đồ</span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '8px',
              background: theme.bgElevated,
              border: `1px solid ${theme.border}`,
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} />
            <span>{roleInfo.displayName}</span>
            <span
              className="xh-hide-mobile"
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '5px',
                background: isSuperAdmin ? theme.accentSoft : '#E0F2FE',
                color: isSuperAdmin ? theme.accent : '#0369A1',
              }}
            >
              {roleInfo.roleBadgeLabel}
            </span>
          </div>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            title="Cài đặt giao diện, sao lưu & đăng xuất"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 11px',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              background: theme.bgElevated,
              color: theme.textPrimary,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Settings size={14} style={{ color: theme.accent }} />
            <span>Cài đặt</span>
          </button>
        </div>
      </header>

      {/* THÂN TRANG: CỘT MENU TRÁI (PHÂN QUYỀN THEO VAI TRÒ ADMIN / QUẢN LÝ WEB / QUẢN LÝ MAPS) */}
      <div className="xh-admin-body">
        <aside
          className="xh-admin-sidebar"
          style={{
            background: theme.bgSidebar,
            borderRight: `1px solid ${theme.border}`,
          }}
        >
          <nav className="xh-sidebar-nav">
            {(
              [
                ...(isSuperAdmin
                  ? [
                      {
                        id: 'overview' as const,
                        label: 'Tổng quan',
                        icon: Eye,
                      },
                    ]
                  : []),
                ...(isSuperAdmin || canManageWeb
                  ? [
                      {
                        id: 'places' as const,
                        label: 'Quản lý Quán',
                        icon: Store,
                        badge:
                          pendingWebPlaces.length > 0
                            ? `${commercialPlaces.length} • ${pendingWebPlaces.length} duyệt`
                            : String(commercialPlaces.length),
                      },
                    ]
                  : []),
                ...(isSuperAdmin || canManageMaps
                  ? [
                      {
                        id: 'maps' as const,
                        label: 'Quản lý Maps',
                        icon: MapPin,
                        badge:
                          pendingMapPlaces.length > 0
                            ? `${allMapPlaces.length} • ${pendingMapPlaces.length} duyệt`
                            : String(allMapPlaces.length),
                      },
                    ]
                  : []),
                ...(isSuperAdmin
                  ? [
                      {
                        id: 'members' as const,
                        label: 'Quản lý Thành viên',
                        icon: Users,
                        badge: String(realMembersCount),
                      },
                      {
                        id: 'reviews' as const,
                        label: 'Đánh giá & Bình luận',
                        icon: MessageSquare,
                        badge: String(allReviews.length),
                      },
                      {
                        id: 'logs' as const,
                        label: 'Nhật ký',
                        icon: Activity,
                      },
                    ]
                  : []),
              ]
            ).map(item => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="xh-sidebar-btn"
                  style={{
                    border: active ? `1px solid ${theme.accentBorder}` : '1px solid transparent',
                    background: active ? theme.accentSoft : 'transparent',
                    color: active ? theme.accent : theme.textSecondary,
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {'badge' in item && item.badge !== undefined && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '99px',
                        background: active ? theme.accent : theme.bgInput,
                        color: active ? '#FFFFFF' : theme.textMuted,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div
            className="xh-hide-mobile"
            style={{
              marginTop: 'auto',
              padding: '12px',
              borderRadius: '10px',
              background: theme.bgElevated,
              border: `1px solid ${theme.border}`,
              fontSize: '11.5px',
              color: theme.textMuted,
            }}
          >
            <div style={{ fontWeight: 700, color: theme.textPrimary, marginBottom: '3px' }}>
              Quản lý Mọi Lúc Mọi Nơi
            </div>
            <div style={{ fontWeight: 700, color: theme.accent }}>
              xuanhoacogi.com/quanly
            </div>
          </div>
        </aside>

        {/* NỘI DUNG CHÍNH BÊN PHẢI */}
        <main className={`xh-admin-main ${activeSection === 'maps' ? 'xh-admin-main-maps' : ''}`}>
          {/* =================================================================== */}
          {/* 1. TỔNG QUAN                                                        */}
          {/* =================================================================== */}
          {activeSection === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="xh-overview-cards">
                {[
                  {
                    label: 'Tổng số Quán (A-Z)',
                    val: commercialPlaces.length,
                    sub: `${commercialPlaces.filter(p => p.status === 'active').length} quán đang mở`,
                  },
                  {
                    label: 'Quán đang Bật Ưu Tiên',
                    val: boostedPlacesCount,
                    sub: 'Tăng x2 / x3 tần suất Quán & Món',
                  },
                  {
                    label: 'Tổng Món trong các Quán',
                    val: totalMenuDishesCount,
                    sub: `${allDishes.length} món trên vòng quay`,
                  },
                  {
                    label: 'Thành viên thực & Quản lý',
                    val: `${realMembersCount} / ${adminAccounts.length} Admin`,
                    sub: '100% số liệu thực tế',
                  },
                ].map((c, i) => (
                  <div
                    key={i}
                    style={{
                      background: theme.bgCard,
                      borderRadius: '14px',
                      padding: '16px',
                      border: `1px solid ${theme.border}`,
                      boxShadow: theme.shadow,
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textMuted }}>{c.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, margin: '6px 0 2px 0' }}>{c.val}</div>
                    <div style={{ fontSize: '11.5px', color: theme.textMuted }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: theme.bgCard,
                  borderRadius: '14px',
                  padding: '18px 20px',
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow,
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px' }}>
                  Phân khu Quán tại Xuân Hòa (Bấm vào để lọc ngay trong Quản lý Quán)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {commercialSectorTags.map(sec => {
                    const cnt = commercialPlaces.filter(p => p.sectorTag === sec.id).length;
                    return (
                      <div
                        key={sec.id}
                        onClick={() => {
                          setPlaceSectorFilter(sec.id);
                          setActiveSection('places');
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          background: theme.bgElevated,
                          border: `1px solid ${theme.border}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{sec.label.split(' (')[0]}</span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '99px',
                            background: theme.accentSoft,
                            color: theme.accent,
                          }}
                        >
                          {cnt} quán
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 2. QUẢN LÝ QUÁN — BỐ CỤC 3 CỘT: CỘT 1 (DANH SÁCH & DUYỆT QUÁN) |   */}
          {/*    CỘT 2 (THÔNG TIN QUÁN) | CỘT 3 (THỰC ĐƠN MÓN ĂN)                 */}
          {/* =================================================================== */}
          {activeSection === 'places' && canManageWeb && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* HỘP DUYỆT YÊU CẦU QUÁN (THÊM MỚI / XÓA) — Ô DUYỆT HẲN HOI RÕ RÀNG */}
              {pendingWebPlaces.length > 0 && (
                <div
                  style={{
                    background: '#FFFBEB',
                    border: '2px solid #F59E0B',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 16px rgba(245, 158, 11, 0.14)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: '99px',
                          background: '#D97706',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        HỘP DUYỆT QUÁN ({pendingWebPlaces.length})
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#92400E' }}>
                        Danh sách yêu cầu Thêm mới / Xóa Quán từ Quản lý Web chờ Admin duyệt
                      </span>
                    </div>
                    {isSuperAdmin && pendingWebPlaces.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const cnt = approveAllPendingPlaceItems('web');
                          setRefreshTick(t => t + 1);
                          showToast(`✅ Admin đã duyệt toàn bộ ${cnt} yêu cầu Quán!`, 'approve');
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#059669',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Duyệt tất cả ({pendingWebPlaces.length})
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '8px' }}>
                    {pendingWebPlaces.map(item => {
                      const ov = adminState.places?.[item.place.id];
                      const p = ov?.pendingWebApproval;
                      if (!p) return null;
                      const isDel = p.isDeleteRequest || p.actionType === 'delete';
                      return (
                        <div
                          key={item.place.id}
                          onClick={() => selectPlaceForEdit(item)}
                          style={{
                            background: '#FFFFFF',
                            border: isDel ? '1.5px solid #FCA5A5' : '1.5px solid #6EE7B7',
                            borderRadius: '10px',
                            padding: '9px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  background: isDel ? '#FEE2E2' : '#D1FAE5',
                                  color: isDel ? '#B91C1C' : '#047857',
                                }}
                              >
                                {isDel ? '🔴 YÊU CẦU XÓA' : '🟢 THÊM MỚI'}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#18181B' }}>
                                {item.place.name}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#71717A', marginTop: '3px' }}>
                              Bởi <strong>{p.submittedByName}</strong> • {p.actionSummary}
                            </div>
                          </div>

                          {isSuperAdmin ? (
                            <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  approvePendingPlaceItem(item.place.id, 'web');
                                  setRefreshTick(t => t + 1);
                                  showToast(
                                    isDel
                                      ? `🗑️ Admin đã duyệt xóa quán "${item.place.name}"!`
                                      : `✅ Admin đã duyệt thêm quán "${item.place.name}"!`,
                                    'approve'
                                  );
                                }}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '7px',
                                  border: 'none',
                                  background: isDel ? '#DC2626' : '#059669',
                                  color: '#FFFFFF',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                ✓ Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  rejectPendingPlaceItem(item.place.id, 'web');
                                  setRefreshTick(t => t + 1);
                                  showToast(`Đã từ chối yêu cầu với "${item.place.name}"`, 'warn');
                                }}
                                style={{
                                  padding: '6px 9px',
                                  borderRadius: '7px',
                                  border: '1px solid #FCA5A5',
                                  background: '#FEF2F2',
                                  color: '#B91C1C',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                ✕ Hủy
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#B45309', flexShrink: 0 }}>
                              Chờ Admin
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="xh-three-col-layout">
              {/* CỘT 1: DANH SÁCH QUÁN + TAB DUYỆT QUÁN */}
              <div
                className={`xh-places-list-pane ${mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                style={{
                  background: theme.bgCard,
                  borderRadius: '14px',
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow,
                }}
              >
                <div style={{ padding: '12px', borderBottom: `1px solid ${theme.border}` }}>
                  {/* NÚT CHUYỂN TAB TRÊN ĐẦU CỘT 1: DANH SÁCH QUÁN | DUYỆT QUÁN */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px',
                      padding: '3px',
                      borderRadius: '10px',
                      background: theme.bgInput,
                      border: `1px solid ${theme.border}`,
                      marginBottom: '10px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPlaceListTab('all')}
                      style={{
                        padding: '7px 8px',
                        borderRadius: '7px',
                        border: 'none',
                        background: placeListTab === 'all' ? theme.bgCard : 'transparent',
                        color: placeListTab === 'all' ? theme.textPrimary : theme.textMuted,
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                        boxShadow: placeListTab === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      Danh sách ({commercialPlaces.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaceListTab('pending_web')}
                      style={{
                        padding: '7px 8px',
                        borderRadius: '7px',
                        border: 'none',
                        background:
                          placeListTab === 'pending_web'
                            ? '#FEF3C7'
                            : pendingWebPlaces.length > 0
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'transparent',
                        color:
                          placeListTab === 'pending_web' || pendingWebPlaces.length > 0
                            ? '#B45309'
                            : theme.textMuted,
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      {!isSuperAdmin && <Lock size={11} />}
                      <span>Duyệt Quán ({pendingWebPlaces.length})</span>
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>
                      {placeListTab === 'pending_web'
                        ? `Chờ Admin duyệt (${filteredPlaces.length})`
                        : `Quán A–Z (${filteredPlaces.length})`}
                    </span>
                    <button
                      onClick={() => {
                        setNewPlaceForm(prev => ({
                          ...prev,
                          name: '',
                          sectorTag: 'an-chinh',
                          mapCategory: 'food',
                        }));
                        setIsNewPlaceModalOpen(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: theme.accent,
                        color: '#FFFFFF',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} /> Thêm Quán
                    </button>
                  </div>

                  {/* Ô TÌM KIẾM NHANH QUÁN HOẶC MÓN */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '7px 10px',
                      borderRadius: '9px',
                      background: theme.bgInput,
                      border: `1px solid ${theme.border}`,
                      marginBottom: '7px',
                    }}
                  >
                    <Search size={13} style={{ color: theme.textMuted, flexShrink: 0 }} />
                    <input
                      type="text"
                      value={placeSearch}
                      onChange={e => setPlaceSearch(e.target.value)}
                      placeholder="Tìm tên quán, SĐT, món ăn..."
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        width: '100%',
                        fontSize: '12px',
                        color: theme.textPrimary,
                      }}
                    />
                    {placeSearch && (
                      <button
                        onClick={() => setPlaceSearch('')}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: theme.textMuted,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* 2 Ô LỰA CHỌN SỔ RA NẰM NGANG HÀNG NHAU (PHÂN KHU + TRẠNG THÁI) */}
                  {placeListTab === 'all' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                      <select
                        value={placeSectorFilter}
                        onChange={e => setPlaceSectorFilter(e.target.value)}
                        style={{ ...lightSelectStyle(theme), fontSize: '11.5px', padding: '5px 7px' }}
                      >
                        <option value="all">Tất cả phân khu</option>
                        {commercialSectorTags.map(sec => {
                          const cnt = commercialPlaces.filter(p => p.sectorTag === sec.id).length;
                          return (
                            <option key={sec.id} value={sec.id}>
                              {sec.label.split(' (')[0]} ({cnt})
                            </option>
                          );
                        })}
                      </select>

                      <select
                        value={placeStatusFilter}
                        onChange={e => setPlaceStatusFilter(e.target.value as any)}
                        style={{ ...lightSelectStyle(theme), fontSize: '11.5px', padding: '5px 7px' }}
                      >
                        <option value="all">Mọi trạng thái</option>
                        <option value="active">Đang mở ({commercialPlaces.filter(p => p.status === 'active').length})</option>
                        <option value="boosted">★ Ưu tiên ({boostedPlacesCount})</option>
                        <option value="locked">Tạm khóa ({commercialPlaces.filter(p => p.status === 'locked').length})</option>
                        {isSuperAdmin && (
                          <option value="deleted">Đã xóa ({commercialPlaces.filter(p => p.status === 'deleted').length})</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>

                {/* DANH SÁCH THẺ QUÁN */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {filteredPlaces.length === 0 ? (
                    <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '12px', color: theme.textMuted }}>
                      {placeListTab === 'pending_web'
                        ? 'Hiện không có quán nào chờ Admin duyệt.'
                        : 'Không tìm thấy quán phù hợp.'}
                    </div>
                  ) : (
                    filteredPlaces.map(item => {
                      const isSelected = selectedPlaceId === item.place.id;
                      const matchedDish = getMatchedDishPreview(item);
                      const ov = adminState.places?.[item.place.id];
                      const pendingWeb = ov?.pendingWebApproval;
                      const isDelReq = Boolean(pendingWeb?.isDeleteRequest || pendingWeb?.actionType === 'delete');
                      return (
                        <div
                          key={item.place.id}
                          onClick={() => {
                            selectPlaceForEdit(item);
                            setMobileShowDetailPane(true);
                          }}
                          style={{
                            padding: '9px 11px',
                            borderRadius: '10px',
                            marginBottom: '6px',
                            cursor: 'pointer',
                            border: isSelected
                              ? `1.5px solid ${theme.accent}`
                              : pendingWeb
                              ? isDelReq
                                ? '1.5px solid #EF4444'
                                : '1.5px solid #F59E0B'
                              : `1px solid ${theme.border}`,
                            background: isSelected
                              ? theme.accentSoft
                              : pendingWeb
                              ? isDelReq
                                ? 'rgba(254, 226, 226, 0.5)'
                                : 'rgba(254, 243, 199, 0.45)'
                              : theme.bgElevated,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: theme.textPrimary }}>
                              {item.place.name}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              {pendingWeb && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: isDelReq ? '#FEE2E2' : '#FEF3C7',
                                    color: isDelReq ? '#B91C1C' : '#B45309',
                                    border: isDelReq ? '1px solid #FCA5A5' : '1px solid #FCD34D',
                                  }}
                                >
                                  {isDelReq ? '🔴 Chờ xóa' : '🟢 Chờ duyệt'}
                                </span>
                              )}
                              {item.priorityBoost > 1 && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: theme.accent,
                                    color: '#FFF',
                                  }}
                                >
                                  ★x{item.priorityBoost}
                                </span>
                              )}
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background:
                                    item.status === 'active'
                                      ? '#10B981'
                                      : item.status === 'locked'
                                      ? '#F59E0B'
                                      : '#EF4444',
                                }}
                              />
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: '11px',
                              color: theme.textMuted,
                              marginTop: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ color: theme.accent, fontWeight: 700 }}>
                              {getSectorShortLabel(item.sectorTag)}
                            </span>
                            <span>•</span>
                            <span>{item.fullMenu.length} món</span>
                            <span>•</span>
                            {(() => {
                              const { hasCoords, isLinkError } = getResolvedPlaceCoordsAndCat(item);
                              return (
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: hasCoords
                                      ? '#047857'
                                      : isLinkError
                                      ? '#DC2626'
                                      : '#B45309',
                                  }}
                                >
                                  {hasCoords
                                    ? '📍 Đã định vị'
                                    : isLinkError
                                    ? '⚠ Link Maps lỗi'
                                    : '⏳ Chưa định vị'}
                                </span>
                              );
                            })()}
                            {item.place.phone && (
                              <>
                                <span>•</span>
                                <span>{item.place.phone}</span>
                              </>
                            )}
                          </div>

                          {pendingWeb && (
                            <div
                              style={{
                                marginTop: '6px',
                                paddingTop: '5px',
                                borderTop: '1px dashed rgba(217, 119, 6, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                              }}
                            >
                              <span style={{ fontSize: '10.5px', fontWeight: 700, color: isDelReq ? '#B91C1C' : '#B45309' }}>
                                {pendingWeb.submittedByName}: {pendingWeb.actionSummary}
                              </span>
                              {isSuperAdmin && (
                                <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      approvePendingPlaceItem(item.place.id, 'web');
                                      setRefreshTick(t => t + 1);
                                      showToast(`✅ Đã duyệt "${item.place.name}"!`, 'approve');
                                    }}
                                    style={{
                                      padding: '2px 7px',
                                      borderRadius: '5px',
                                      border: 'none',
                                      background: '#059669',
                                      color: '#FFF',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✓ Duyệt
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      rejectPendingPlaceItem(item.place.id, 'web');
                                      setRefreshTick(t => t + 1);
                                      showToast(`Đã hủy yêu cầu "${item.place.name}"`, 'warn');
                                    }}
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '5px',
                                      border: '1px solid #FCA5A5',
                                      background: '#FEF2F2',
                                      color: '#B91C1C',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {matchedDish && (
                            <div
                              style={{
                                marginTop: '4px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: '#047857',
                              }}
                            >
                              Khớp món: {matchedDish}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* CỘT 2: THÔNG TIN CHI TIẾT QUÁN (TÁCH BIỆT GỌN GÀNG, BỎ MÃ CODE & BỎ MAPS) */}
              {selectedPlaceItem ? (
                <div
                  className={`xh-col-middle-pane ${!mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  <button
                    className="xh-show-mobile-only"
                    onClick={() => setMobileShowDetailPane(false)}
                    style={{
                      display: 'none',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '9px',
                      border: `1px solid ${theme.border}`,
                      background: theme.bgCard,
                      color: theme.textPrimary,
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeft size={14} /> Quay lại Danh sách ({filteredPlaces.length})
                  </button>

                  <div
                    style={{
                      background: theme.bgCard,
                      borderRadius: '14px',
                      border: `1px solid ${theme.border}`,
                      boxShadow: theme.shadow,
                      padding: '16px 18px',
                    }}
                  >
                    {/* KHUNG DUYỆT QUÁN (CHỈ ADMIN ĐƯỢC DUYỆT, QUẢN LÝ BỊ KHÓA) */}
                    {(() => {
                      const ov = adminState.places?.[selectedPlaceItem.place.id];
                      const pending = ov?.pendingWebApproval;
                      if (!pending) return null;
                      const isDel = pending.isDeleteRequest || pending.actionType === 'delete';
                      return (
                        <div
                          style={{
                            padding: '11px 13px',
                            borderRadius: '10px',
                            background: isDel ? '#FEF2F2' : '#FFFBEB',
                            border: isDel ? '1.5px solid #EF4444' : '1.5px solid #F59E0B',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: isDel ? '#B91C1C' : '#B45309' }}>
                              {isDel ? '🔴 Yêu cầu XÓA Quán đang chờ Admin duyệt' : '🟢 Quán MỚI thêm đang chờ Admin duyệt'}
                            </div>
                            <div style={{ fontSize: '11.5px', color: isDel ? '#991B1B' : '#92400E', marginTop: '2px' }}>
                              Người gửi: <strong>{pending.submittedByName}</strong> ({pending.submittedBy}) •{' '}
                              {pending.actionSummary}
                            </div>
                          </div>

                          {isSuperAdmin ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  approvePendingPlaceItem(selectedPlaceItem.place.id, 'web');
                                  setRefreshTick(t => t + 1);
                                  showToast(
                                    isDel
                                      ? `🗑️ Đã duyệt xóa quán "${selectedPlaceItem.place.name}"!`
                                      : `✅ Đã duyệt chính thức quán "${selectedPlaceItem.place.name}"!`,
                                    'approve'
                                  );
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: isDel ? '#DC2626' : '#059669',
                                  color: '#FFFFFF',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                {isDel ? '✓ Duyệt Xóa' : '✓ Duyệt Thêm Quán'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  rejectPendingPlaceItem(selectedPlaceItem.place.id, 'web');
                                  setRefreshTick(t => t + 1);
                                  showToast(`Đã từ chối yêu cầu với "${selectedPlaceItem.place.name}"`, 'warn');
                                }}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid #FCA5A5',
                                  background: '#FEF2F2',
                                  color: '#B91C1C',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                borderRadius: '7px',
                                background: '#FEF3C7',
                                color: '#92400E',
                                fontSize: '11.5px',
                                fontWeight: 800,
                              }}
                            >
                              <Lock size={12} /> Chờ Admin duyệt
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* THANH TIÊU ĐỀ CỘT 2: TÊN QUÁN + TẦN SUẤT + BLOCK (TẠM KHÓA) + XÓA + LƯU */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        paddingBottom: '12px',
                        borderBottom: `1px solid ${theme.border}`,
                        marginBottom: '14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800 }}>
                          2. Thông tin Quán
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background:
                              selectedPlaceItem.status === 'active'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(245, 158, 11, 0.15)',
                            color:
                              selectedPlaceItem.status === 'active' ? '#047857' : '#B45309',
                          }}
                        >
                          {selectedPlaceItem.status === 'active' ? 'Đang mở' : 'Đã Block (Khóa)'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <select
                          value={editPlacePriorityBoost}
                          onChange={e => handleChangePriorityBoost(Number(e.target.value) as 1 | 2 | 3)}
                          style={{
                            ...lightSelectStyle(theme),
                            width: 'auto',
                            padding: '5px 8px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: editPlacePriorityBoost > 1 ? theme.accent : theme.textSecondary,
                          }}
                        >
                          <option value={1}>Tần suất: 1x</option>
                          <option value={2}>★ Ưu tiên x2</option>
                          <option value={3}>★★ Ưu tiên x3</option>
                        </select>

                        {/* NÚT BLOCK (TẠM KHÓA): CẢ QUẢN LÝ WEB VÀ ADMIN ĐỀU ĐƯỢC QUYỀN BLOCK */}
                        <button
                          onClick={() => {
                            const nextStatus = selectedPlaceItem.status === 'active' ? 'locked' : 'active';
                            savePlaceAdminOverride(
                              selectedPlaceItem.place.id,
                              { status: nextStatus },
                              nextStatus === 'locked' ? 'Block (Tạm khóa) quán' : 'Mở khóa quán'
                            );
                            setRefreshTick(t => t + 1);
                            showToast(nextStatus === 'locked' ? 'Đã Block (Tạm khóa) quán' : 'Đã mở hoạt động quán');
                          }}
                          style={{
                            ...actionBtnStyle(theme, false),
                            padding: '6px 10px',
                            fontSize: '11.5px',
                            color: selectedPlaceItem.status === 'active' ? '#B45309' : '#047857',
                          }}
                        >
                          {selectedPlaceItem.status === 'active' ? <Lock size={12} /> : <Unlock size={12} />}
                          <span>{selectedPlaceItem.status === 'active' ? 'Block' : 'Mở khóa'}</span>
                        </button>

                        {/* NÚT XÓA: ADMIN XÓA NGAY LẬP TỨC, QUẢN LÝ XÓA SẼ GỬI VÀO HỘP DUYỆT */}
                        <button
                          onClick={() => handleDeletePlaceAction('web')}
                          style={{
                            ...actionBtnStyle(theme, false),
                            padding: '6px 10px',
                            fontSize: '11.5px',
                            color: '#B91C1C',
                          }}
                          title={
                            isSuperAdmin
                              ? 'Admin xóa ngay lập tức'
                              : 'Quản lý gửi yêu cầu xóa chờ Admin duyệt'
                          }
                        >
                          <Trash2 size={12} />
                          <span>{isSuperAdmin ? 'Xóa ngay' : 'Xóa (Chờ duyệt)'}</span>
                        </button>

                        <button
                          onClick={() => handleSavePlaceAndMenu()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: justSavedPlace ? '#059669' : theme.accent,
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {justSavedPlace ? <Check size={13} /> : <Save size={13} />}
                          <span>{justSavedPlace ? 'Đã Lưu' : 'Lưu Quán'}</span>
                        </button>
                      </div>
                    </div>

                    {/* THÔNG BÁO THAO TÁC NHẢY LÊN TRỰC TIẾP NGAY TRONG CỘT 2 RỒI TỰ ĐỘNG TẮT */}
                    {toast && (
                      <div
                        key={`web-toast-${toastId}`}
                        onClick={() => setToast('')}
                        style={{
                          marginBottom: '12px',
                          padding: '9px 13px',
                          borderRadius: '10px',
                          background: toastKind === 'warn' ? '#FEF2F2' : '#ECFDF5',
                          border: toastKind === 'warn' ? '1.5px solid #EF4444' : '1.5px solid #10B981',
                          color: toastKind === 'warn' ? '#991B1B' : '#065F46',
                          fontSize: '12.5px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.14)',
                          animation: 'xhInlineBannerPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <CheckCircle2
                            size={15}
                            style={{
                              color: toastKind === 'warn' ? '#DC2626' : '#059669',
                              flexShrink: 0,
                            }}
                          />
                          <span>{toast}</span>
                        </div>
                        <span style={{ fontSize: '10.5px', opacity: 0.75, whiteSpace: 'nowrap' }}>
                          Tự tắt • Đóng ✕
                        </span>
                      </div>
                    )}

                    {/* FORM THÔNG TIN QUÁN GỌN GÀNG TRONG CỘT 2 */}
                    <div className="xh-compact-grid">
                      <div className="xh-col-span-2">
                        <label style={compactLabelStyle(theme)}>Tên Quán</label>
                        <input
                          type="text"
                          value={editPlaceName}
                          onChange={e => setEditPlaceName(e.target.value)}
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      <div>
                        <label style={compactLabelStyle(theme)}>Số điện thoại liên hệ</label>
                        <input
                          type="text"
                          value={editPlacePhone}
                          onChange={e => setEditPlacePhone(e.target.value)}
                          placeholder="Chưa cập nhật SĐT"
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      <div>
                        <label style={compactLabelStyle(theme)}>Giờ mở cửa – đóng cửa</label>
                        <input
                          type="text"
                          value={editPlaceHours}
                          onChange={e => setEditPlaceHours(e.target.value)}
                          placeholder="VD: 06:30 - 22:30"
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      <div className="xh-col-span-2">
                        <label style={compactLabelStyle(theme)}>Địa chỉ quán</label>
                        <input
                          type="text"
                          value={editPlaceAddress}
                          onChange={e => setEditPlaceAddress(e.target.value)}
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      {/* PHÂN KHU NGÀNH NGHỀ (CHỈ HIỆN CÁC NGÀNH QUÁN ĂN / NHẬU / CAFE / DỊCH VỤ, KHÔNG HIỆN ĐỊA DANH HÀNH CHÍNH) */}
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: '18px',
                            marginBottom: '5px',
                          }}
                        >
                          <label style={{ ...compactLabelStyle(theme), marginBottom: 0 }}>
                            Phân khu Ngành nghề
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsAddingSectorInline(!isAddingSectorInline)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: theme.accent,
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0,
                              lineHeight: '18px',
                            }}
                          >
                            {isAddingSectorInline ? 'Đóng' : '+ Thêm mới'}
                          </button>
                        </div>

                        {!isAddingSectorInline ? (
                          <select
                            value={editPlaceSectorTag === 'dia-danh' ? 'an-chinh' : editPlaceSectorTag}
                            onChange={e => {
                              const nextSec = e.target.value;
                              setEditPlaceSectorTag(nextSec);
                              setEditPlaceMapCategory(
                                mapSectorTagToMapCategory(
                                  nextSec,
                                  `${editPlaceName} ${editPlaceTagline} ${editPlaceTagsText}`,
                                  editPlaceMapCategory
                                )
                              );
                            }}
                            style={{
                              ...lightSelectStyle(theme),
                              height: '38px',
                              padding: '0 10px',
                              fontSize: '13px',
                              boxSizing: 'border-box',
                            }}
                          >
                            {commercialSectorTags.map(sec => (
                              <option key={sec.id} value={sec.id}>
                                {sec.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <input
                              type="text"
                              value={inlineSectorLabel}
                              onChange={e => setInlineSectorLabel(e.target.value)}
                              placeholder="Tên ngành mới..."
                              style={{ ...compactInputStyle(theme), flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={handleAddInlineSector}
                              style={{
                                height: '38px',
                                padding: '0 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: theme.accent,
                                color: '#FFF',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Thêm
                            </button>
                          </div>
                        )}
                      </div>

                      {/* HÌNH THỨC PHỤC VỤ */}
                      <div>
                        <label style={compactLabelStyle(theme)}>Hình thức Phục vụ</label>
                        <select
                          value={editPlaceServiceMode}
                          onChange={e => setEditPlaceServiceMode(e.target.value as Place['serviceMode'])}
                          style={{
                            ...lightSelectStyle(theme),
                            height: '38px',
                            padding: '0 10px',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                          }}
                        >
                          <option value="both">Ăn tại quán & Có nhận Ship</option>
                          <option value="dine_in_only">Chỉ phục vụ tại quán</option>
                          <option value="delivery_only">Chỉ giao hàng (Ship)</option>
                        </select>
                      </div>

                      {/* KHỐI ĐỊNH VỊ BẢN ĐỒ SỐ (LINK GOOGLE MAPS & TỌA ĐỘ ĐỒNG BỘ 100% SANG QUẢN LÝ MAPS & BẢN ĐỒ 2D/3D) */}
                      <div
                        className="xh-col-span-2"
                        style={{
                          marginTop: '4px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: theme.bgElevated,
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            marginBottom: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <MapPin size={14} style={{ color: theme.accent }} />
                            <span style={{ fontSize: '12px', fontWeight: 800, color: theme.textPrimary }}>
                              Định vị Bản đồ 2D / 3D
                            </span>
                            {(() => {
                              const hasCoordsNow =
                                editPlaceLat.trim() !== '' &&
                                editPlaceLng.trim() !== '' &&
                                !Number.isNaN(Number(editPlaceLat)) &&
                                !Number.isNaN(Number(editPlaceLng));
                              const isInvalidUrlNow =
                                !hasCoordsNow && isShortOrUnresolvableMapsUrl(editPlaceMapsUrl);
                              return (
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    background: hasCoordsNow
                                      ? '#E6F7EF'
                                      : isInvalidUrlNow
                                      ? '#FEF2F2'
                                      : '#FEF3C7',
                                    color: hasCoordsNow
                                      ? '#047857'
                                      : isInvalidUrlNow
                                      ? '#DC2626'
                                      : '#B45309',
                                  }}
                                >
                                  {hasCoordsNow
                                    ? `📍 Đã định vị (${editPlaceLat}, ${editPlaceLng})`
                                    : isInvalidUrlNow
                                    ? '🗺 Có link Maps — chưa lấy được tọa độ'
                                    : '⏳ Chưa định vị'}
                                </span>
                              );
                            })()}
                          </div>

                          {canManageMaps && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerFeedback('tap');
                                setMapListTab('all');
                                setMapSearch('');
                                setMapCatFilter('all');
                                setMapCoordFilter('all');
                                setActiveSection('maps');
                              }}
                              style={{
                                ...smallRowBtnStyle(theme),
                                background: theme.accentSoft,
                                color: theme.accent,
                                borderColor: theme.accentBorder,
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '4px 9px',
                              }}
                            >
                              <MapPin size={11} /> Mở bên Quản lý Maps để chấm bản đồ
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginBottom: '7px' }}>
                          <input
                            type="text"
                            value={editPlaceMapsUrl}
                            onChange={e => {
                              const val = e.target.value;
                              setEditPlaceMapsUrl(val);
                              const parsed = parseCoordinatesFromInputOrUrl(val);
                              if (parsed) {
                                setEditPlaceLat(String(parsed.lat));
                                setEditPlaceLng(String(parsed.lng));
                                setHasActivelyPinnedOnMap(true);
                                setInlineActionFeedback(
                                  `📍 Đã nhận diện tọa độ (${parsed.lat}, ${parsed.lng}) từ link Maps — bấm "Lưu Quán" để ghim ngay!`
                                );
                              } else if (/^https?:\/\//i.test(val.trim())) {
                                expandAndParseShortMapsUrl(val.trim()).then(expanded => {
                                  if (expanded) {
                                    setEditPlaceLat(String(expanded.lat));
                                    setEditPlaceLng(String(expanded.lng));
                                    setHasActivelyPinnedOnMap(true);
                                    setInlineActionFeedback(
                                      `📍 Đã giải mã link rút gọn (${expanded.lat}, ${expanded.lng}) — bấm "Lưu Quán" để ghim ngay!`
                                    );
                                  }
                                });
                              }
                            }}
                            placeholder="Dán link Google Maps, Plus Code (VD: 7PQ6+VFP) hoặc tọa độ 21.2805, 105.7261..."
                            style={{ ...compactInputStyle(theme), flex: 1 }}
                          />
                          <button
                            type="button"
                            disabled={isAdminGeocoding}
                            onClick={async () => {
                              triggerFeedback('tap');
                              setIsAdminGeocoding(true);
                              setInlineActionFeedback('⏳ Đang phân tích link Google Maps & địa chỉ để lấy tọa độ...');
                              try {
                                const resolved = await resolvePlaceCoordinates({
                                  mapsUrl: editPlaceMapsUrl,
                                  mapsQuery: editPlaceMapsQuery,
                                  address: editPlaceAddress,
                                  name: editPlaceName,
                                  allowGeocode: true,
                                });
                                if (resolved.lat !== null && resolved.lng !== null) {
                                  setEditPlaceLat(String(resolved.lat));
                                  setEditPlaceLng(String(resolved.lng));
                                  setHasActivelyPinnedOnMap(true);
                                  setMapFlyTrigger(t => t + 1);
                                  const msg = `📍 Đã tìm thấy tọa độ chuẩn (${resolved.lat}, ${resolved.lng}) — bấm "Lưu Quán" để ghim!`;
                                  setInlineActionFeedback(msg);
                                  showToast(msg);
                                } else {
                                  const msg =
                                    'Chưa tìm thấy tự động — hãy bấm "Mở bên Quản lý Maps" để chấm trực tiếp lên bản đồ!';
                                  setInlineActionFeedback(msg);
                                  showToast(msg, 'warn');
                                }
                              } finally {
                                setIsAdminGeocoding(false);
                              }
                            }}
                            style={{
                              ...smallRowBtnStyle(theme),
                              background: theme.accent,
                              color: '#FFFFFF',
                              borderColor: theme.accent,
                              padding: '0 12px',
                              height: '38px',
                              boxSizing: 'border-box',
                            }}
                          >
                            <MapPin size={13} />
                            <span>{isAdminGeocoding ? 'Đang tìm...' : 'Tìm tọa độ'}</span>
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={compactLabelStyle(theme)}>Vĩ độ (Lat)</label>
                            <input
                              type="text"
                              value={editPlaceLat}
                              onChange={e => setEditPlaceLat(e.target.value)}
                              placeholder="VD: 21.2805..."
                              style={{ ...compactInputStyle(theme), fontFamily: 'monospace' }}
                            />
                          </div>
                          <div>
                            <label style={compactLabelStyle(theme)}>Kinh độ (Lng)</label>
                            <input
                              type="text"
                              value={editPlaceLng}
                              onChange={e => setEditPlaceLng(e.target.value)}
                              placeholder="VD: 105.7261..."
                              style={{ ...compactInputStyle(theme), fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {inlineActionFeedback && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          background: justSavedPlace ? '#E6F7EF' : theme.bgElevated,
                          border: justSavedPlace
                            ? '1.5px solid #10B981'
                            : `1px solid ${theme.border}`,
                          color: justSavedPlace ? '#047857' : theme.textSecondary,
                          fontSize: '12px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <span>{inlineActionFeedback}</span>
                      </div>
                    )}

                    {/* MỞ RỘNG THÔNG TIN BỔ SUNG KHI CẦN */}
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px dashed ${theme.border}` }}>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedPlaceFields(!showAdvancedPlaceFields)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: theme.textSecondary,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: 0,
                        }}
                      >
                        {showAdvancedPlaceFields ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        <span>
                          {showAdvancedPlaceFields
                            ? 'Thu gọn thông tin bổ sung'
                            : 'Mở rộng: Mô tả, Tag, Khoảng giá, Món tủ & Ảnh...'}
                        </span>
                      </button>

                      {showAdvancedPlaceFields && (
                        <div className="xh-compact-grid" style={{ marginTop: '10px' }}>
                          <div>
                            <label style={compactLabelStyle(theme)}>Mô tả ngắn dưới tên quán</label>
                            <input
                              type="text"
                              value={editPlaceTagline}
                              onChange={e => setEditPlaceTagline(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>

                          <div>
                            <label style={compactLabelStyle(theme)}>Tag tìm kiếm (phẩy)</label>
                            <input
                              type="text"
                              value={editPlaceTagsText}
                              onChange={e => setEditPlaceTagsText(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={compactLabelStyle(theme)}>Giá thấp (k)</label>
                              <input
                                type="number"
                                value={editPlaceMinPrice}
                                onChange={e => setEditPlaceMinPrice(Number(e.target.value))}
                                style={compactInputStyle(theme)}
                              />
                            </div>
                            <div>
                              <label style={compactLabelStyle(theme)}>Giá cao (k)</label>
                              <input
                                type="number"
                                value={editPlaceMaxPrice}
                                onChange={e => setEditPlaceMaxPrice(Number(e.target.value))}
                                style={compactInputStyle(theme)}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={compactLabelStyle(theme)}>Món Tủ đại diện</label>
                              <input
                                type="text"
                                value={editPlaceSigName}
                                onChange={e => setEditPlaceSigName(e.target.value)}
                                style={compactInputStyle(theme)}
                              />
                            </div>
                            <div>
                              <label style={compactLabelStyle(theme)}>Giá (k)</label>
                              <input
                                type="number"
                                value={editPlaceSigPrice}
                                onChange={e => setEditPlaceSigPrice(Number(e.target.value))}
                                style={compactInputStyle(theme)}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={compactLabelStyle(theme)}>Ghi chú Giao hàng / Ship</label>
                            <input
                              type="text"
                              value={editPlaceDeliveryNote}
                              onChange={e => setEditPlaceDeliveryNote(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>

                          <div>
                            <label style={compactLabelStyle(theme)}>Khoảng cách tới ĐHSP2</label>
                            <input
                              type="text"
                              value={editPlaceDistance}
                              onChange={e => setEditPlaceDistance(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>

                          <div className="xh-col-span-2">
                            <label style={compactLabelStyle(theme)}>Link Ảnh Đại Diện</label>
                            <input
                              type="text"
                              value={editPlaceImageUrl}
                              onChange={e => setEditPlaceImageUrl(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* CỘT 3: THỰC ĐƠN CỦA QUÁN (NẰM RIÊNG BIỆT Ở CỘT THỨ 3 BÊN PHẢI) */}
              {selectedPlaceItem ? (
                <div
                  className={`xh-col-right-pane ${!mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                  style={{
                    background: theme.bgCard,
                    borderRadius: '14px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                    padding: '16px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: 'calc(100vh - 86px)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      paddingBottom: '10px',
                      borderBottom: `1px solid ${theme.border}`,
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UtensilsCrossed size={15} style={{ color: theme.accent }} />
                      <span style={{ fontSize: '14.5px', fontWeight: 800 }}>
                        3. Thực đơn ({editPlaceMenu.length} món)
                      </span>
                    </div>

                    <button
                      onClick={() => setIsAddingDishRow(!isAddingDishRow)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: theme.accent,
                        color: '#FFFFFF',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} /> Thêm Món
                    </button>
                  </div>

                  {/* TÌM MÓN TRONG CỘT 3 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: theme.bgInput,
                      border: `1px solid ${theme.border}`,
                      marginBottom: '10px',
                    }}
                  >
                    <Search size={13} style={{ color: theme.textMuted }} />
                    <input
                      type="text"
                      value={dishSearchInPlace}
                      onChange={e => setDishSearchInPlace(e.target.value)}
                      placeholder="Tìm món trong thực đơn..."
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '12px',
                        color: theme.textPrimary,
                        width: '100%',
                      }}
                    />
                  </div>

                  {isAddingDishRow && (
                    <div
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        background: theme.bgElevated,
                        border: `1px solid ${theme.accentBorder}`,
                        marginBottom: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <input
                        type="text"
                        value={newMenuDishName}
                        onChange={e => setNewMenuDishName(e.target.value)}
                        placeholder="Tên món mới..."
                        style={compactInputStyle(theme)}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '6px' }}>
                        <input
                          type="number"
                          value={newMenuDishPrice}
                          onChange={e => setNewMenuDishPrice(e.target.value)}
                          placeholder="Giá (k)"
                          style={compactInputStyle(theme)}
                        />
                        <input
                          type="text"
                          value={newMenuDishCat}
                          onChange={e => setNewMenuDishCat(e.target.value)}
                          placeholder="Nhóm món"
                          style={compactInputStyle(theme)}
                        />
                        <button
                          onClick={handleAddMenuDishToPlace}
                          style={{
                            padding: '0 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: theme.accent,
                            color: '#FFF',
                            fontWeight: 700,
                            fontSize: '11.5px',
                            cursor: 'pointer',
                          }}
                        >
                          Lưu
                        </button>
                        <button
                          onClick={() => setIsAddingDishRow(false)}
                          style={{
                            padding: '0 8px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            background: 'transparent',
                            color: theme.textMuted,
                            fontSize: '11.5px',
                            cursor: 'pointer',
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      borderRadius: '10px',
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {editPlaceMenu.map((dish, idx) => {
                      if (
                        dishSearchInPlace.trim() &&
                        !dish.name.toLowerCase().includes(dishSearchInPlace.trim().toLowerCase()) &&
                        !(dish.category || '').toLowerCase().includes(dishSearchInPlace.trim().toLowerCase())
                      ) {
                        return null;
                      }
                      const isEditingThis = editingDishIndex === idx;

                      return (
                        <div
                          key={dish.id || idx}
                          style={{
                            padding: '9px 11px',
                            borderBottom:
                              idx === editPlaceMenu.length - 1 ? 'none' : `1px solid ${theme.border}`,
                            background: isEditingThis
                              ? theme.accentSoft
                              : dish.isLocked
                              ? 'rgba(245, 158, 11, 0.05)'
                              : idx % 2 === 0
                              ? theme.bgCard
                              : theme.bgElevated,
                          }}
                        >
                          {!isEditingThis ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  cursor: 'pointer',
                                }}
                                onClick={() => setEditingDishIndex(idx)}
                              >
                                <div
                                  style={{
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    color: dish.isLocked ? theme.textMuted : theme.textPrimary,
                                    textDecoration: dish.isLocked ? 'line-through' : 'none',
                                  }}
                                >
                                  #{idx + 1}. {dish.name}
                                </div>
                                {dish.category && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: theme.bgInput,
                                      color: theme.textSecondary,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {dish.category}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                <span
                                  style={{
                                    fontSize: '12.5px',
                                    fontWeight: 800,
                                    color: theme.accent,
                                  }}
                                >
                                  {dish.price}k
                                </span>

                                <button
                                  onClick={() => setEditingDishIndex(idx)}
                                  style={{ ...smallRowBtnStyle(theme), padding: '3px 7px', fontSize: '11px' }}
                                >
                                  Sửa
                                </button>

                                <button
                                  onClick={() => handleToggleLockDishInPlace(idx)}
                                  style={{
                                    ...smallRowBtnStyle(theme),
                                    padding: '3px 7px',
                                    fontSize: '11px',
                                    color: dish.isLocked ? '#047857' : '#B45309',
                                  }}
                                >
                                  {dish.isLocked ? 'Mở' : 'Khóa'}
                                </button>

                                {isSuperAdmin && (
                                  <button
                                    onClick={() => handleDeleteDishFromPlace(idx)}
                                    style={{
                                      ...smallRowBtnStyle(theme),
                                      padding: '3px 6px',
                                      color: '#B91C1C',
                                    }}
                                    title="Chỉ Admin có quyền xóa món"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <input
                                type="text"
                                value={dish.name}
                                onChange={e => {
                                  const next = [...editPlaceMenu];
                                  next[idx] = { ...next[idx], name: e.target.value };
                                  setEditPlaceMenu(next);
                                }}
                                placeholder="Tên món"
                                style={compactInputStyle(theme)}
                              />
                              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: '6px' }}>
                                <input
                                  type="number"
                                  value={dish.price}
                                  onChange={e => {
                                    const next = [...editPlaceMenu];
                                    next[idx] = { ...next[idx], price: Number(e.target.value) };
                                    setEditPlaceMenu(next);
                                  }}
                                  placeholder="Giá (k)"
                                  style={compactInputStyle(theme)}
                                />
                                <input
                                  type="text"
                                  value={dish.category || ''}
                                  onChange={e => {
                                    const next = [...editPlaceMenu];
                                    next[idx] = { ...next[idx], category: e.target.value };
                                    setEditPlaceMenu(next);
                                  }}
                                  placeholder="Nhóm món"
                                  style={compactInputStyle(theme)}
                                />
                                <button
                                  onClick={() => {
                                    setEditingDishIndex(null);
                                    handleSavePlaceAndMenu(editPlaceMenu, `Đã cập nhật món "${dish.name}"`);
                                  }}
                                  style={{
                                    padding: '0 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: theme.accent,
                                    color: '#FFF',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Lưu
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 2B. QUẢN LÝ MAPS — BỐ CỤC 3 CỘT ĐỒNG BỘ:                            */}
          {/*     CỘT 1 (DANH SÁCH & DUYỆT MAPS) | CỘT 2 (THÔNG TIN ĐỊNH VỊ) |    */}
          {/*     CỘT 3 (BẢN ĐỒ SỐ TRỰC TIẾP NGAY TRONG TRANG QUẢN LÝ)           */}
          {/* =================================================================== */}
          {/* =================================================================== */}
          {/* 2B. QUẢN LÝ MAPS — DASHBOARD 3 CỘT TINH GỌN, THẲNG HÀNG, SẠCH      */}
          {/* =================================================================== */}
          {activeSection === 'maps' && canManageMaps && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* HỘP DUYỆT ĐỊNH VỊ MAPS (CHỈ HIỆN KHI CÓ YÊU CẦU CHỜ DUYỆT) */}
              {pendingMapPlaces.length > 0 && (
                <div
                  style={{
                    background: '#FFFBEB',
                    border: '1px solid #F59E0B',
                    borderRadius: '12px',
                    padding: '10px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: '#D97706',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        Duyệt Maps ({pendingMapPlaces.length})
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>
                        Yêu cầu Thêm mới / Xóa địa điểm chờ Admin duyệt
                      </span>
                    </div>
                    {isSuperAdmin && pendingMapPlaces.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const cnt = approveAllPendingPlaceItems('maps');
                          setRefreshTick(t => t + 1);
                          showToast(`Đã duyệt toàn bộ ${cnt} yêu cầu trên Bản đồ số!`, 'approve');
                        }}
                        style={{
                          height: '28px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#059669',
                          color: '#FFFFFF',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Duyệt tất cả ({pendingMapPlaces.length})
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '6px' }}>
                    {pendingMapPlaces.map(item => {
                      const ov = adminState.places?.[item.place.id];
                      const p = ov?.pendingMapApproval;
                      if (!p) return null;
                      const isDel = p.isDeleteRequest || p.actionType === 'delete';
                      return (
                        <div
                          key={item.place.id}
                          onClick={() => selectPlaceForEdit(item)}
                          style={{
                            background: '#FFFFFF',
                            border: isDel ? '1px solid #FCA5A5' : '1px solid #A7F3D0',
                            borderRadius: '8px',
                            padding: '7px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: isDel ? '#FEE2E2' : '#D1FAE5',
                                  color: isDel ? '#B91C1C' : '#047857',
                                }}
                              >
                                {isDel ? 'Xóa' : 'Mới'}
                              </span>
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: '#18181B',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.place.name}
                              </span>
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#71717A', marginTop: '2px' }}>
                              {p.submittedByName} • {p.actionSummary}
                            </div>
                          </div>

                          {isSuperAdmin ? (
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  approvePendingPlaceItem(item.place.id, 'maps');
                                  setRefreshTick(t => t + 1);
                                  showToast(
                                    isDel
                                      ? `Đã duyệt xóa "${item.place.name}"`
                                      : `Đã duyệt địa điểm "${item.place.name}"`,
                                    'approve'
                                  );
                                }}
                                style={{
                                  height: '26px',
                                  padding: '0 8px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: isDel ? '#DC2626' : '#059669',
                                  color: '#FFFFFF',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ✓ Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  rejectPendingPlaceItem(item.place.id, 'maps');
                                  setRefreshTick(t => t + 1);
                                  showToast(`Đã hủy yêu cầu "${item.place.name}"`, 'warn');
                                }}
                                style={{
                                  height: '26px',
                                  padding: '0 7px',
                                  borderRadius: '6px',
                                  border: '1px solid #FCA5A5',
                                  background: '#FEF2F2',
                                  color: '#B91C1C',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#B45309', flexShrink: 0 }}>
                              Chờ duyệt
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* THANH CHUYỂN TAB NHANH TRÊN MOBILE (CHỈ HIỆN TRÊN MOBILE) */}
              <div
                className="xh-show-mobile-only"
                style={{
                  display: 'none',
                  gap: '6px',
                  background: '#FFFFFF',
                  padding: '4px',
                  borderRadius: '10px',
                  border: '1px solid #E8E2D8',
                }}
              >
                <button
                  type="button"
                  onClick={() => setMobileShowDetailPane(false)}
                  style={{
                    flex: 1,
                    height: '32px',
                    borderRadius: '7px',
                    border: 'none',
                    background: !mobileShowDetailPane ? theme.accentSoft : 'transparent',
                    color: !mobileShowDetailPane ? theme.accent : theme.textSecondary,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Danh sách ({filteredMapPlaces.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMobileShowDetailPane(true)}
                  style={{
                    flex: 1,
                    height: '32px',
                    borderRadius: '7px',
                    border: 'none',
                    background: mobileShowDetailPane ? theme.accentSoft : 'transparent',
                    color: mobileShowDetailPane ? theme.accent : theme.textSecondary,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Thông tin & Bản đồ
                </button>
              </div>

              <div className="xh-three-col-layout xh-maps-three-col">
                {/* ============================================================= */}
                {/* CỘT 1: DANH SÁCH ĐỊA ĐIỂM                                     */}
                {/* ============================================================= */}
                <div
                  className={`xh-places-list-pane ${mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E8E2D8',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                    overflow: 'hidden',
                  }}
                >
                  {/* HEADER CỘT 1 — THẲNG HÀNG CAO ĐỘ VỚI CỘT 2 VÀ CỘT 3 */}
                  <div
                    className="xh-maps-col-header"
                    style={{
                      minHeight: '46px',
                      padding: '8px 12px',
                      borderBottom: '1px solid #E8E2D8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: theme.textPrimary, whiteSpace: 'nowrap' }}>
                        1. Địa điểm
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: theme.textMuted,
                          background: '#F4F1EA',
                          padding: '1px 6px',
                          borderRadius: '6px',
                        }}
                      >
                        {filteredMapPlaces.length}/{allMapPlaces.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {pendingMapPlaces.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setMapListTab(mapListTab === 'pending_maps' ? 'all' : 'pending_maps')}
                          style={{
                            height: '28px',
                            padding: '0 7px',
                            borderRadius: '7px',
                            border:
                              mapListTab === 'pending_maps'
                                ? '1px solid #D97706'
                                : '1px solid #E8E2D8',
                            background: mapListTab === 'pending_maps' ? '#FEF3C7' : '#FFFFFF',
                            color: '#B45309',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Duyệt ({pendingMapPlaces.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setNewPlaceForm(prev => ({
                            ...prev,
                            name: '',
                            sectorTag: 'dia-danh',
                            mapCategory: 'public',
                          }));
                          setIsNewPlaceModalOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          height: '28px',
                          padding: '0 8px',
                          borderRadius: '7px',
                          border: `1px solid ${theme.accentBorder}`,
                          background: theme.accentSoft,
                          color: theme.accent,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Plus size={12} /> Thêm
                      </button>
                    </div>
                  </div>

                  {/* KHỐI FILTER 3 DÒNG GỌN SẠCH */}
                  <div
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #E8E2D8',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      background: '#FCFBF9',
                    }}
                  >
                    {/* DÒNG 1: [Tất cả] [Đã định vị] [Chưa định vị] [Lỗi] */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          mapLocationStats.invalid > 0
                            ? 'repeat(4, minmax(0, 1fr))'
                            : 'repeat(3, minmax(0, 1fr))',
                        gap: '4px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMapListTab('all');
                          setMapCoordFilter('all');
                        }}
                        style={{
                          height: '30px',
                          padding: '0 4px',
                          borderRadius: '8px',
                          border:
                            mapListTab === 'all' && mapCoordFilter === 'all'
                              ? `1px solid ${theme.accent}`
                              : '1px solid #E8E2D8',
                          background:
                            mapListTab === 'all' && mapCoordFilter === 'all'
                              ? theme.accentSoft
                              : '#FFFFFF',
                          color:
                            mapListTab === 'all' && mapCoordFilter === 'all'
                              ? theme.accent
                              : theme.textSecondary,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Tất cả ({mapLocationStats.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapListTab('all');
                          setMapCoordFilter('verified');
                        }}
                        style={{
                          height: '30px',
                          padding: '0 4px',
                          borderRadius: '8px',
                          border:
                            mapListTab === 'all' && mapCoordFilter === 'verified'
                              ? '1px solid #059669'
                              : '1px solid #E8E2D8',
                          background:
                            mapListTab === 'all' && mapCoordFilter === 'verified'
                              ? '#E6F7EF'
                              : '#FFFFFF',
                          color:
                            mapListTab === 'all' && mapCoordFilter === 'verified'
                              ? '#047857'
                              : theme.textSecondary,
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Đã ghim ({mapLocationStats.located})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapListTab('all');
                          setMapCoordFilter('unverified');
                        }}
                        style={{
                          height: '30px',
                          padding: '0 4px',
                          borderRadius: '8px',
                          border:
                            mapListTab === 'all' && mapCoordFilter === 'unverified'
                              ? '1px solid #D97706'
                              : '1px solid #E8E2D8',
                          background:
                            mapListTab === 'all' && mapCoordFilter === 'unverified'
                              ? '#FEF3C7'
                              : '#FFFFFF',
                          color:
                            mapListTab === 'all' && mapCoordFilter === 'unverified'
                              ? '#B45309'
                              : theme.textSecondary,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Chưa ({mapLocationStats.unlocated})
                      </button>
                      {mapLocationStats.invalid > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setMapListTab('all');
                            setMapCoordFilter('invalid');
                          }}
                          style={{
                            height: '30px',
                            padding: '0 4px',
                            borderRadius: '8px',
                            border:
                              mapListTab === 'all' && mapCoordFilter === 'invalid'
                                ? '1px solid #DC2626'
                                : '1px solid #E8E2D8',
                            background:
                              mapListTab === 'all' && mapCoordFilter === 'invalid'
                                ? '#FEF2F2'
                                : '#FFFFFF',
                            color:
                              mapListTab === 'all' && mapCoordFilter === 'invalid'
                                ? '#DC2626'
                                : theme.textSecondary,
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Lỗi ({mapLocationStats.invalid})
                        </button>
                      )}
                    </div>

                    {/* DÒNG 2: SEARCH FULL WIDTH */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '34px',
                        padding: '0 9px',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        border: '1px solid #E8E2D8',
                        boxSizing: 'border-box',
                      }}
                    >
                      <Search size={13} style={{ color: theme.textMuted, flexShrink: 0 }} />
                      <input
                        type="text"
                        value={mapSearch}
                        onChange={e => setMapSearch(e.target.value)}
                        placeholder="Tìm tên quán, đường, SĐT..."
                        style={{
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          width: '100%',
                          fontSize: '12px',
                          color: theme.textPrimary,
                        }}
                      />
                      {mapSearch && (
                        <button
                          type="button"
                          onClick={() => setMapSearch('')}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: theme.textMuted,
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* DÒNG 3: [Nhóm bản đồ ▼] [Trạng thái ▼] */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6px' }}>
                      <select
                        value={mapCatFilter}
                        onChange={e => setMapCatFilter(e.target.value)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          height: '32px',
                          padding: '0 6px',
                          borderRadius: '8px',
                          border: '1px solid #E8E2D8',
                          backgroundColor: '#FFFFFF',
                          color: theme.textPrimary,
                          fontSize: '11px',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="all">Nhóm bản đồ ({allMapPlaces.length})</option>
                        {EDITABLE_MAP_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={mapCoordFilter}
                        onChange={e => setMapCoordFilter(e.target.value as any)}
                        style={{
                          width: '100%',
                          minWidth: 0,
                          height: '32px',
                          padding: '0 6px',
                          borderRadius: '8px',
                          border: '1px solid #E8E2D8',
                          backgroundColor: '#FFFFFF',
                          color: theme.textPrimary,
                          fontSize: '11px',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="all">Trạng thái ({mapLocationStats.total})</option>
                        <option value="verified">Đã định vị ({mapLocationStats.located})</option>
                        <option value="unverified">Chưa định vị ({mapLocationStats.unlocated})</option>
                        <option value="invalid">⚠ Link Maps lỗi ({mapLocationStats.invalid})</option>
                        <option value="locked">Đang khóa (Block)</option>
                      </select>
                    </div>
                  </div>

                  {/* DANH SÁCH ĐỊA ĐIỂM GỌN (54–62px / item) — ĐÃ MEMOIZE ĐỂ GÕ FORM KHÔNG RE-RENDER LIST */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
                    {filteredMapPlaces.length === 0 ? (
                      <div
                        style={{
                          padding: '24px 10px',
                          textAlign: 'center',
                          fontSize: '12px',
                          color: theme.textMuted,
                        }}
                      >
                        {mapListTab === 'pending_maps'
                          ? 'Không có vị trí nào chờ duyệt.'
                          : 'Không tìm thấy địa điểm phù hợp.'}
                      </div>
                    ) : (
                      filteredMapPlaces.map(item => {
                        const isSelected = selectedPlaceId === item.place.id;
                        const ov = adminState.places?.[item.place.id];
                        const { hasCoords, mapCat, isLinkError } = getResolvedPlaceCoordsAndCat(item);
                        const catLabel =
                          EDITABLE_MAP_CATEGORIES.find(c => c.id === mapCat)?.label || mapCat;
                        const pendingMap = ov?.pendingMapApproval;
                        const isDelReq = Boolean(
                          pendingMap?.isDeleteRequest || pendingMap?.actionType === 'delete'
                        );
                        return (
                          <MapPlaceListRow
                            key={item.place.id}
                            item={item}
                            isSelected={isSelected}
                            hasCoords={hasCoords}
                            isLinkError={isLinkError}
                            catLabel={catLabel}
                            hasPendingMap={Boolean(pendingMap)}
                            isDelReq={isDelReq}
                            accentColor={theme.accent}
                            accentSoft={theme.accentSoft}
                            textPrimary={theme.textPrimary}
                            textMuted={theme.textMuted}
                            onSelect={handleSelectRowInMapsList}
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ============================================================= */}
                {/* CỘT 2: THÔNG TIN ĐỊNH VỊ (CAO THEO NỘI DUNG, GỌN SẠCH)        */}
                {/* ============================================================= */}
                {selectedPlaceItem ? (
                  <div
                    className={`xh-col-middle-pane ${!mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E8E2D8',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    {/* HEADER CỘT 2 — THẲNG HÀNG CAO ĐỘ VỚI CỘT 1 VÀ CỘT 3 */}
                    <div
                      className="xh-maps-col-header"
                      style={{
                        minHeight: '46px',
                        padding: '8px 12px',
                        borderBottom: '1px solid #E8E2D8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: theme.textPrimary, whiteSpace: 'nowrap' }}>
                          2. Định vị
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '5px',
                            background:
                              editPlaceLat.trim() !== '' && editPlaceLng.trim() !== ''
                                ? '#E6F7EF'
                                : '#FEF3C7',
                            color:
                              editPlaceLat.trim() !== '' && editPlaceLng.trim() !== ''
                                ? '#047857'
                                : '#B45309',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {editPlaceLat.trim() !== '' && editPlaceLng.trim() !== ''
                            ? '📍 Đã định vị'
                            : '⏳ Chưa định vị'}
                        </span>
                        {getResolvedPlaceCoordsAndCat(selectedPlaceItem).isLinkError && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '5px',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                            title="Link Google Maps lỗi hoặc chưa giải mã được tọa độ"
                          >
                            ⚠ Link Maps lỗi
                          </span>
                        )}
                      </div>

                      {/* NHÓM NÚT SECONDARY NHỎ + 1 NÚT PRIMARY DUY NHẤT */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const nextStatus = selectedPlaceItem.status === 'active' ? 'locked' : 'active';
                            savePlaceAdminOverride(
                              selectedPlaceItem.place.id,
                              { status: nextStatus },
                              nextStatus === 'locked' ? 'Block địa điểm trên Maps' : 'Mở khóa địa điểm Maps'
                            );
                            setRefreshTick(t => t + 1);
                            const msg =
                              nextStatus === 'locked'
                                ? `Đã khóa "${selectedPlaceItem.place.name}" trên Bản đồ`
                                : `Đã mở khóa "${selectedPlaceItem.place.name}" trên Bản đồ`;
                            setInlineActionFeedback(msg);
                            showToast(msg);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            height: '28px',
                            padding: '0 6px',
                            borderRadius: '6px',
                            border: '1px solid #E8E2D8',
                            background: '#F8F6F1',
                            color: selectedPlaceItem.status === 'active' ? theme.textSecondary : '#047857',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {selectedPlaceItem.status === 'active' ? <Lock size={11} /> : <Unlock size={11} />}
                          <span>{selectedPlaceItem.status === 'active' ? 'Block' : 'Mở'}</span>
                        </button>

                        {editPlaceLat.trim() !== '' && editPlaceLng.trim() !== '' && (
                          <button
                            type="button"
                            onClick={() => {
                              clearPlaceCoordinates(
                                selectedPlaceItem.place.id,
                                selectedPlaceItem.place.name
                              );
                              setEditPlaceLat('');
                              setEditPlaceLng('');
                              setHasActivelyPinnedOnMap(false);
                              setRefreshTick(t => t + 1);
                              const msg = `Đã gỡ ghim "${selectedPlaceItem.place.name}" về Chưa định vị`;
                              setInlineActionFeedback(msg);
                              showToast(msg, 'tap');
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              height: '28px',
                              padding: '0 6px',
                              borderRadius: '6px',
                              border: '1px solid #E8E2D8',
                              background: '#F8F6F1',
                              color: theme.textSecondary,
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                            title="Gỡ ghim tọa độ"
                          >
                            <RotateCcw size={11} />
                            <span>Gỡ</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeletePlaceAction('maps')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            height: '28px',
                            padding: '0 6px',
                            borderRadius: '6px',
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#B91C1C',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Trash2 size={11} />
                          <span>Xóa</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSavingPlace}
                          onClick={() => handleSavePlaceAndMenu()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            height: '28px',
                            padding: '0 9px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#047857',
                            color: '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: isSavingPlace ? 'wait' : 'pointer',
                            opacity: isSavingPlace ? 0.8 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {justSavedPlace ? <Check size={12} /> : <Save size={12} />}
                          <span>{justSavedPlace ? '✓ Đã lưu' : 'Lưu Định Vị'}</span>
                        </button>
                      </div>
                    </div>

                    {/* BODY FORM GỌN SẠCH — KHOẢNG CÁCH 10–12px */}
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* DUYỆT NHANH NẾU ĐỊA ĐIỂM ĐANG CHỜ DUYỆT */}
                      {(() => {
                        const ov = adminState.places?.[selectedPlaceItem.place.id];
                        const pending = ov?.pendingMapApproval;
                        if (!pending) return null;
                        const isDel = pending.isDeleteRequest || pending.actionType === 'delete';
                        return (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background: isDel ? '#FEF2F2' : '#FFFBEB',
                              border: isDel ? '1px solid #FCA5A5' : '1px solid #FCD34D',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              fontSize: '11px',
                            }}
                          >
                            <div style={{ color: isDel ? '#991B1B' : '#92400E', fontWeight: 600 }}>
                              <strong>{pending.submittedByName}</strong>: {pending.actionSummary}
                            </div>
                            {isSuperAdmin && (
                              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    approvePendingPlaceItem(selectedPlaceItem.place.id, 'maps');
                                    setRefreshTick(t => t + 1);
                                    showToast(`Đã duyệt "${selectedPlaceItem.place.name}"`, 'approve');
                                  }}
                                  style={{
                                    height: '26px',
                                    padding: '0 8px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: isDel ? '#DC2626' : '#059669',
                                    color: '#FFFFFF',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✓ Duyệt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    rejectPendingPlaceItem(selectedPlaceItem.place.id, 'maps');
                                    setRefreshTick(t => t + 1);
                                    showToast(`Đã từ chối "${selectedPlaceItem.place.name}"`, 'warn');
                                  }}
                                  style={{
                                    height: '26px',
                                    padding: '0 7px',
                                    borderRadius: '6px',
                                    border: '1px solid #FCA5A5',
                                    background: '#FFFFFF',
                                    color: '#B91C1C',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Từ chối
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* COMPACT SUCCESS BANNER (42–50px) — CHỈ HIỆN TẠM THỜI SAU THAO TÁC */}
                      {toast && (
                        <div
                          key={`maps-toast-${toastId}`}
                          onClick={() => setToast('')}
                          style={{
                            minHeight: '42px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: toastKind === 'warn' ? '#FEF2F2' : '#ECFDF5',
                            border: toastKind === 'warn' ? '1px solid #FCA5A5' : '1px solid #A7F3D0',
                            color: toastKind === 'warn' ? '#991B1B' : '#065F46',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <CheckCircle2
                              size={14}
                              style={{
                                color: toastKind === 'warn' ? '#DC2626' : '#059669',
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {toast}
                              </div>
                              {editPlaceLat && editPlaceLng && (
                                <div style={{ fontSize: '10.5px', opacity: 0.8, fontFamily: 'monospace' }}>
                                  {editPlaceLat}, {editPlaceLng}
                                </div>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.75, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            Đóng ×
                          </span>
                        </div>
                      )}

                      {/* NHẮC NHỞ GỌN KHI CHƯA CÓ TỌA ĐỘ */}
                      {(editPlaceLat.trim() === '' || editPlaceLng.trim() === '') && (
                        <div
                          style={{
                            padding: '7px 10px',
                            borderRadius: '8px',
                            background: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            color: '#92400E',
                            fontSize: '11px',
                            fontWeight: 600,
                            lineHeight: 1.4,
                          }}
                        >
                          Chưa có tọa độ — bấm <strong>Tìm tọa độ</strong> hoặc chấm trực tiếp lên Bản đồ bên phải.
                        </div>
                      )}

                      <div className="xh-compact-grid">
                        <div className="xh-col-span-2">
                          <label style={compactLabelStyle(theme)}>Tên hiển thị trên Bản đồ 2D/3D</label>
                          <input
                            type="text"
                            value={editPlaceName}
                            onChange={e => setEditPlaceName(e.target.value)}
                            style={compactInputStyle(theme)}
                          />
                        </div>

                        <div>
                          <label style={compactLabelStyle(theme)}>Biểu tượng & Nhóm Bản đồ</label>
                          <select
                            value={editPlaceMapCategory}
                            onChange={e => {
                              triggerFeedback('tap');
                              const nextCat = e.target.value as EditableMapCategory;
                              setEditPlaceMapCategory(nextCat);
                              if (nextCat === 'public' || nextCat === 'school') {
                                setEditPlaceSectorTag('dia-danh');
                              } else if (nextCat === 'billiards' || nextCat === 'game') {
                                setEditPlaceSectorTag('bia-game');
                              } else if (nextCat === 'phone') {
                                setEditPlaceSectorTag('dien-thoai');
                              } else if (nextCat === 'entertainment') {
                                setEditPlaceSectorTag('an-choi');
                              } else if (nextCat === 'service' || nextCat === 'grocery' || nextCat === 'supermarket') {
                                setEditPlaceSectorTag('dich-vu');
                              } else if (nextCat === 'pub') {
                                setEditPlaceSectorTag('nhau-lau');
                              } else if (nextCat === 'cafe') {
                                setEditPlaceSectorTag('uong');
                              } else if (nextCat === 'snack') {
                                setEditPlaceSectorTag('an-vat');
                              } else if (nextCat === 'food') {
                                setEditPlaceSectorTag('an-chinh');
                              }
                            }}
                            style={{
                              ...lightSelectStyle(theme),
                              height: '36px',
                              padding: '0 9px',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              backgroundColor: theme.bgInput,
                              boxSizing: 'border-box',
                            }}
                          >
                            {EDITABLE_MAP_CATEGORIES.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={compactLabelStyle(theme)}>Số điện thoại liên hệ</label>
                          <input
                            type="text"
                            value={editPlacePhone}
                            onChange={e => setEditPlacePhone(e.target.value)}
                            placeholder="Chưa cập nhật SĐT"
                            style={compactInputStyle(theme)}
                          />
                        </div>

                        <div className="xh-col-span-2">
                          <label style={compactLabelStyle(theme)}>Địa chỉ chi tiết (Số nhà, Đường, Khu vực)</label>
                          <input
                            type="text"
                            value={editPlaceAddress}
                            onChange={e => setEditPlaceAddress(e.target.value)}
                            style={compactInputStyle(theme)}
                          />
                        </div>

                        <div className="xh-col-span-2">
                          <label style={compactLabelStyle(theme)}>
                            Link Google Maps / Plus Code / Tọa độ
                          </label>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editPlaceMapsUrl || editPlaceMapsQuery}
                              onChange={e => {
                                const val = e.target.value;
                                setAdminGeoSuggestions([]);
                                if (val.startsWith('http')) setEditPlaceMapsUrl(val);
                                else {
                                  setEditPlaceMapsUrl('');
                                  setEditPlaceMapsQuery(val);
                                }
                                const parsed = parseCoordinatesFromInputOrUrl(val);
                                if (parsed) {
                                  setEditPlaceLat(String(parsed.lat));
                                  setEditPlaceLng(String(parsed.lng));
                                  setHasActivelyPinnedOnMap(true);
                                  setMapFlyTrigger(t => t + 1);
                                  setInlineActionFeedback(
                                    `📍 Đã nhận diện tọa độ (${parsed.lat}, ${parsed.lng}) từ link Maps!`
                                  );
                                } else if (/^https?:\/\//i.test(val.trim())) {
                                  resolveRequestIdRef.current += 1;
                                  const reqId = resolveRequestIdRef.current;
                                  if (resolveAbortRef.current) {
                                    resolveAbortRef.current.abort();
                                  }
                                  const abortCtrl = new AbortController();
                                  resolveAbortRef.current = abortCtrl;
                                  expandAndParseShortMapsUrl(val.trim(), abortCtrl.signal).then(expanded => {
                                    if (resolveRequestIdRef.current !== reqId) return;
                                    if (expanded) {
                                      setEditPlaceLat(String(expanded.lat));
                                      setEditPlaceLng(String(expanded.lng));
                                      setHasActivelyPinnedOnMap(true);
                                      setMapFlyTrigger(t => t + 1);
                                      setInlineActionFeedback(
                                        `📍 Đã giải mã link rút gọn (${expanded.lat}, ${expanded.lng})!`
                                      );
                                    }
                                  });
                                }
                              }}
                              placeholder="Dán link Maps, Plus Code hoặc tọa độ..."
                              style={{ ...compactInputStyle(theme), flex: 1 }}
                            />
                            <button
                              type="button"
                              disabled={isAdminGeocoding}
                              onClick={async () => {
                                triggerFeedback('tap');
                                resolveRequestIdRef.current += 1;
                                const reqId = resolveRequestIdRef.current;
                                if (resolveAbortRef.current) {
                                  resolveAbortRef.current.abort();
                                }
                                const abortCtrl = new AbortController();
                                resolveAbortRef.current = abortCtrl;
                                const targetPlaceId = selectedPlaceItem?.place.id;

                                setIsAdminGeocoding(true);
                                setAdminGeoSuggestions([]);
                                setInlineActionFeedback(
                                  '⏳ Đang giải mã link Google Maps / địa chỉ & bay tới vị trí...'
                                );
                                try {
                                  const resolved = await resolvePlaceCoordinates({
                                    mapsUrl: editPlaceMapsUrl,
                                    mapsQuery: editPlaceMapsQuery,
                                    address: editPlaceAddress,
                                    name: editPlaceName,
                                    allowGeocode: true,
                                    signal: abortCtrl.signal,
                                  });
                                  if (resolveRequestIdRef.current !== reqId) return;

                                  if (resolved.lat !== null && resolved.lng !== null) {
                                    const latNum = Number(resolved.lat.toFixed(6));
                                    const lngNum = Number(resolved.lng.toFixed(6));
                                    setEditPlaceLat(String(latNum));
                                    setEditPlaceLng(String(lngNum));
                                    setHasActivelyPinnedOnMap(true);

                                    if (selectedPlaceItem && targetPlaceId === selectedPlaceItem.place.id) {
                                      const osmItem = osmLandmarkById.get(selectedPlaceItem.place.id);
                                      const isCivicItem =
                                        Boolean(osmItem) ||
                                        editPlaceSectorTag === 'dia-danh' ||
                                        editPlaceMapCategory === 'public' ||
                                        editPlaceMapCategory === 'school';
                                      const autoApprovePin = isCivicItem || isSuperAdmin;
                                      savePlaceAdminOverride(
                                        selectedPlaceItem.place.id,
                                        {
                                          name: editPlaceName.trim() || selectedPlaceItem.place.name,
                                          address: editPlaceAddress.trim() || selectedPlaceItem.place.address,
                                          phone: editPlacePhone.trim(),
                                          sectorTag: editPlaceSectorTag,
                                          mapCategory: editPlaceMapCategory,
                                          mapsUrl: editPlaceMapsUrl.trim(),
                                          mapsLinkStatus: resolved.mapsLinkStatus || (editPlaceMapsUrl.trim() ? 'valid' : 'none'),
                                          mapsQuery:
                                            editPlaceMapsQuery.trim() ||
                                            `${editPlaceName.trim() || selectedPlaceItem.place.name} Xuân Hòa Phúc Yên`,
                                          lat: latNum,
                                          lng: lngNum,
                                          coordinateVerified: autoApprovePin,
                                          adminPinApproved: autoApprovePin,
                                          locationStatus: 'located',
                                          pendingMapApproval: autoApprovePin
                                            ? undefined
                                            : {
                                                submittedBy: effectiveAuthUser?.email || 'manager',
                                                submittedByName: effectiveAuthUser?.displayName || 'Quản lý Maps',
                                                submittedAt: Date.now(),
                                                actionSummary: `Tìm tọa độ tự động (${latNum}, ${lngNum})`,
                                                actionType: 'update',
                                              },
                                          coordinateSource:
                                            resolved.source === 'google_maps_resolved'
                                              ? 'google_maps_resolved'
                                              : resolved.source === 'geocoded_address'
                                              ? 'nominatim_selected'
                                              : 'admin_verified',
                                          lastVerifiedAt: new Date().toISOString().slice(0, 10),
                                        },
                                        'Định vị & ghim tọa độ tự động từ Tìm tọa độ'
                                      );
                                    }

                                    setMapFlyTrigger(t => t + 1);
                                    setRefreshTick(t => t + 1);
                                    triggerFeedback('success');
                                    const msg = `Đã cập nhật & ghim "${editPlaceName || selectedPlaceItem?.place.name}"`;
                                    setInlineActionFeedback(msg);
                                    showToast(msg);
                                  } else if (resolved.candidates && resolved.candidates.length > 1) {
                                    setAdminGeoSuggestions(resolved.candidates);
                                    const msg =
                                      resolved.note ||
                                      `Tìm thấy ${resolved.candidates.length} vị trí gần khớp — hãy bấm chọn đúng địa chỉ bên dưới!`;
                                    setInlineActionFeedback(msg);
                                    showToast(msg, 'tap');
                                  } else {
                                    if (selectedPlaceItem && editPlaceMapsUrl.trim()) {
                                      savePlaceAdminOverride(selectedPlaceItem.place.id, {
                                        mapsUrl: editPlaceMapsUrl.trim(),
                                        mapsLinkStatus: 'invalid',
                                      });
                                      setRefreshTick(t => t + 1);
                                    }
                                    const msg =
                                      resolved.note ||
                                      (editPlaceMapsUrl.trim()
                                        ? 'Không thể đọc tọa độ chính xác từ Google Maps.'
                                        : 'Chưa tìm thấy tự động — hãy chấm trực tiếp trên Bản đồ bên phải');
                                    setInlineActionFeedback(msg);
                                    showToast(msg, 'warn');
                                  }
                                } finally {
                                  if (resolveRequestIdRef.current === reqId) {
                                    setIsAdminGeocoding(false);
                                  }
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                height: '36px',
                                padding: '0 10px',
                                borderRadius: '8px',
                                border: `1px solid ${theme.accentBorder}`,
                                background: theme.accentSoft,
                                color: theme.accent,
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                width: 'auto',
                                flexShrink: 0,
                              }}
                            >
                              <MapPin size={12} />
                              <span>{isAdminGeocoding ? 'Đang tìm...' : 'Tìm tọa độ'}</span>
                            </button>
                          </div>
                          {adminGeoSuggestions.length > 0 && (
                            <div
                              style={{
                                marginTop: '6px',
                                padding: '6px',
                                borderRadius: '8px',
                                background: '#F8FAFC',
                                border: '1px solid #CBD5E1',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                              }}
                            >
                              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#334155' }}>
                                Chọn vị trí phù hợp nhất ({adminGeoSuggestions.length} kết quả):
                              </div>
                              {adminGeoSuggestions.map((cand, idx) => (
                                <button
                                  key={`${cand.lat}_${cand.lng}_${idx}`}
                                  type="button"
                                  onClick={() => {
                                    const latNum = Number(cand.lat.toFixed(6));
                                    const lngNum = Number(cand.lng.toFixed(6));
                                    setEditPlaceLat(String(latNum));
                                    setEditPlaceLng(String(lngNum));
                                    setHasActivelyPinnedOnMap(true);
                                    setAdminGeoSuggestions([]);
                                    if (selectedPlaceItem) {
                                      savePlaceAdminOverride(
                                        selectedPlaceItem.place.id,
                                        {
                                          lat: latNum,
                                          lng: lngNum,
                                          coordinateVerified: isSuperAdmin,
                                          adminPinApproved: isSuperAdmin,
                                          locationStatus: 'located',
                                          coordinateSource: 'nominatim_selected',
                                        },
                                        `Chọn tọa độ gợi ý (${latNum}, ${lngNum})`
                                      );
                                    }
                                    setMapFlyTrigger(t => t + 1);
                                    setRefreshTick(t => t + 1);
                                    showToast(`📍 Đã chọn tọa độ (${latNum}, ${lngNum})`, 'approve');
                                  }}
                                  style={{
                                    textAlign: 'left',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #E2E8F0',
                                    background: '#FFFFFF',
                                    fontSize: '11px',
                                    color: '#0F172A',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <strong>📍 {cand.lat.toFixed(5)}, {cand.lng.toFixed(5)}</strong> — {cand.displayName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* LAT + LNG CÙNG MỘT HÀNG (50% / 50%) */}
                        <div>
                          <label style={compactLabelStyle(theme)}>Vĩ độ (Lat)</label>
                          <input
                            type="text"
                            value={editPlaceLat}
                            onChange={e => setEditPlaceLat(e.target.value)}
                            placeholder="21.2897..."
                            style={{ ...compactInputStyle(theme), fontFamily: 'monospace' }}
                          />
                        </div>

                        <div>
                          <label style={compactLabelStyle(theme)}>Kinh độ (Lng)</label>
                          <input
                            type="text"
                            value={editPlaceLng}
                            onChange={e => setEditPlaceLng(e.target.value)}
                            placeholder="105.7112..."
                            style={{ ...compactInputStyle(theme), fontFamily: 'monospace' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* ============================================================= */}
                {/* CỘT 3: BẢN ĐỒ SỐ XUÂN HÒA (TRỌNG TÂM — RỘNG NHẤT & CAO NHẤT) */}
                {/* ============================================================= */}
                {selectedPlaceItem ? (
                  <div
                    className={`xh-col-right-pane ${!mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E8E2D8',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      height: 'calc(100vh - 76px)',
                      minHeight: '580px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* HEADER CỘT 3 — THẲNG HÀNG CAO ĐỘ VỚI CỘT 1 VÀ CỘT 2 */}
                    <div
                      className="xh-maps-col-header"
                      style={{
                        minHeight: '46px',
                        padding: '8px 14px',
                        borderBottom: '1px solid #E8E2D8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        flexShrink: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: theme.textPrimary, whiteSpace: 'nowrap' }}>
                          3. Bản đồ số Xuân Hòa
                        </span>
                        <span
                          className="xh-hide-mobile"
                          style={{
                            fontSize: '11px',
                            color: theme.textMuted,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          • Bấm trực tiếp lên bản đồ để ghim tọa độ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (editPlaceLat && editPlaceLng) {
                            jumpToMapUrl(
                              `#/ban-do?flyLat=${editPlaceLat}&flyLng=${editPlaceLng}&flyLabel=${encodeURIComponent(
                                editPlaceName
                              )}`
                            );
                          } else {
                            jumpToMapUrl(
                              `#/ban-do?pick=${encodeURIComponent(
                                selectedPlaceItem.place.id
                              )}&pickName=${encodeURIComponent(editPlaceName)}`
                            );
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          height: '28px',
                          padding: '0 9px',
                          borderRadius: '6px',
                          border: '1px solid #E8E2D8',
                          background: '#F8F6F1',
                          color: theme.textSecondary,
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        title="Phóng toàn màn hình Bản đồ Số"
                      >
                        <ExternalLink size={11} /> Toàn màn hình
                      </button>
                    </div>

                    {/* BẢN ĐỒ SỐ THẬT NHÚNG TRỰC TIẾP — KHÔNG LỒNG KHUNG THỪA */}
                    <div
                      style={{
                        position: 'relative',
                        flex: 1,
                        width: '100%',
                        minHeight: '500px',
                        overflow: 'hidden',
                      }}
                    >
                      {isAdminGeocoding && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 60,
                            background: 'rgba(15, 23, 42, 0.92)',
                            color: '#FFFFFF',
                            padding: '6px 14px',
                            borderRadius: '999px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                            pointerEvents: 'none',
                          }}
                        >
                          <MapPin size={13} style={{ color: '#34D399' }} />
                          <span>Đang định vị & di chuyển bản đồ...</span>
                        </div>
                      )}
                      <DigitalMapView
                        authUser={effectiveAuthUser}
                        onBackToHome={onBackToApp}
                        embeddedInAdmin={true}
                        adminSelectedPlaceId={selectedPlaceItem.place.id}
                        adminPreviewLat={
                          hasActivelyPinnedOnMap &&
                          editPlaceLat.trim() !== '' &&
                          !Number.isNaN(Number(editPlaceLat))
                            ? Number(editPlaceLat)
                            : null
                        }
                        adminPreviewLng={
                          hasActivelyPinnedOnMap &&
                          editPlaceLng.trim() !== '' &&
                          !Number.isNaN(Number(editPlaceLng))
                            ? Number(editPlaceLng)
                            : null
                        }
                        adminFlyTrigger={mapFlyTrigger}
                        adminSyncVersion={refreshTick}
                        onAdminPickCoordinates={handleAdminMapPickCoordinates}
                        onAdminSelectPlace={handleAdminMapSelectPlace}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 3. QUẢN LÝ THÀNH VIÊN (CẤP QUYỀN QUẢN LÝ MAPS / QUẢN LÝ WEB THEO GMAIL) */}
          {/* =================================================================== */}
          {activeSection === 'members' && isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* KHỐI 1: DANH SÁCH THÀNH VIÊN ĐĂNG KÝ QUA GMAIL — TÍCH CẤP QUYỀN TRỰC TIẾP */}
              <div
                style={{
                  background: theme.bgCard,
                  borderRadius: '14px',
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow,
                  padding: '16px 18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800 }}>
                      Bảng Quản lý Thành viên Gmail ({realMembersCount} người)
                      {seederMembersCount > 0 ? ` (+ ${seederMembersCount} nick phụ)` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>
                      Khi người mới đăng ký bằng Gmail sẽ hiện lên bảng này. Admin biết ai có thể tích cấp quyền{' '}
                      <strong style={{ color: theme.accent }}>Quản lý Web (Quán)</strong> hoặc{' '}
                      <strong style={{ color: '#047857' }}>Quản lý Maps</strong> (cấp 1 hoặc cả 2 chức vụ).
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 11px',
                        borderRadius: '8px',
                        background: theme.bgInput,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <Search size={14} style={{ color: theme.textMuted }} />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Tìm Gmail, tên..."
                        style={{
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          fontSize: '12.5px',
                          color: theme.textPrimary,
                        }}
                      />
                    </div>

                    <select
                      value={memberFilter}
                      onChange={e => setMemberFilter(e.target.value as any)}
                      style={{ ...lightSelectStyle(theme), width: 'auto' }}
                    >
                      <option value="all">Tất cả ({allMembers.length})</option>
                      <option value="active">Đang hoạt động</option>
                      <option value="muted">Đang Mute</option>
                      <option value="banned">Đã Ban (Chặn)</option>
                    </select>

                    <button
                      onClick={() => setIsAddSeederModalOpen(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 11px',
                        borderRadius: '8px',
                        border: `1px solid ${theme.accentBorder}`,
                        background: theme.accentSoft,
                        color: theme.accent,
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} /> Thêm Gmail / Nick mới
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '720px' }}>
                    <thead>
                      <tr
                        style={{
                          background: theme.bgElevated,
                          borderBottom: `1px solid ${theme.border}`,
                          fontSize: '11px',
                          fontWeight: 800,
                          color: theme.textMuted,
                          textTransform: 'uppercase',
                        }}
                      >
                        <th style={{ padding: '10px 14px' }}>Thành viên & Gmail</th>
                        <th style={{ padding: '10px 14px' }}>Cấp quyền Quản lý (Admin tích chọn 1 hoặc cả 2)</th>
                        <th style={{ padding: '10px 14px' }}>Trạng thái</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(member => {
                        const hasWeb = Boolean(member.canManageWeb);
                        const hasMaps = Boolean(member.canManageMaps);
                        return (
                          <tr key={member.email} style={{ borderBottom: `1px solid ${theme.border}` }}>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ fontWeight: 700, fontSize: '13px' }}>{member.nickname}</div>
                              <div style={{ fontSize: '11.5px', color: theme.textMuted }}>{member.email}</div>
                            </td>

                            {/* CỘT TÍCH CẤP QUYỀN QUẢN LÝ WEB & QUẢN LÝ MAPS */}
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <label
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    border: hasWeb ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
                                    background: hasWeb ? theme.accentSoft : theme.bgElevated,
                                    color: hasWeb ? theme.accent : theme.textSecondary,
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={hasWeb}
                                    onChange={e => {
                                      const nextVal = e.target.checked;
                                      updateMemberManagerPermissions(member.email, { canManageWeb: nextVal });
                                      setRefreshTick(t => t + 1);
                                      showToast(
                                        nextVal
                                          ? `✅ Đã cấp quyền Quản lý Web (Quán) cho ${member.nickname} (${member.email})`
                                          : `Đã gỡ quyền Quản lý Web của ${member.nickname}`
                                      );
                                    }}
                                    style={{ accentColor: theme.accent, cursor: 'pointer' }}
                                  />
                                  <span>Quản lý Web (Quán)</span>
                                </label>

                                <label
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    border: hasMaps ? '1.5px solid #10B981' : `1px solid ${theme.border}`,
                                    background: hasMaps ? 'rgba(16, 185, 129, 0.12)' : theme.bgElevated,
                                    color: hasMaps ? '#047857' : theme.textSecondary,
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={hasMaps}
                                    onChange={e => {
                                      const nextVal = e.target.checked;
                                      updateMemberManagerPermissions(member.email, { canManageMaps: nextVal });
                                      setRefreshTick(t => t + 1);
                                      showToast(
                                        nextVal
                                          ? `📍 Đã cấp quyền Quản lý Maps cho ${member.nickname} (${member.email})`
                                          : `Đã gỡ quyền Quản lý Maps của ${member.nickname}`
                                      );
                                    }}
                                    style={{ accentColor: '#059669', cursor: 'pointer' }}
                                  />
                                  <span>Quản lý Maps</span>
                                </label>
                              </div>
                            </td>

                            <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700 }}>
                              {hasWeb && hasMaps ? (
                                <span style={{ color: '#047857' }}>Quản lý Web & Maps</span>
                              ) : hasWeb ? (
                                <span style={{ color: theme.accent }}>Quản lý Web</span>
                              ) : hasMaps ? (
                                <span style={{ color: '#047857' }}>Quản lý Maps</span>
                              ) : member.status === 'active' ? (
                                'Thành viên'
                              ) : member.status === 'muted' ? (
                                'Đang Mute'
                              ) : (
                                'Đã chặn (Ban)'
                              )}
                            </td>

                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                {member.status !== 'active' && (
                                  <button
                                    onClick={() => {
                                      updateMemberStatusInAdmin(member.email, 'active');
                                      setRefreshTick(t => t + 1);
                                      showToast(`Đã mở khóa ${member.nickname}`);
                                    }}
                                    style={smallRowBtnStyle(theme)}
                                  >
                                    <UserCheck size={12} /> Mở
                                  </button>
                                )}
                                {member.status !== 'muted' && member.status !== 'admin' && (
                                  <button
                                    onClick={() => {
                                      updateMemberStatusInAdmin(member.email, 'muted');
                                      setRefreshTick(t => t + 1);
                                      showToast(`Đã Mute ${member.nickname}`);
                                    }}
                                    style={{ ...smallRowBtnStyle(theme), color: '#B45309' }}
                                  >
                                    <VolumeX size={12} /> Mute
                                  </button>
                                )}
                                {member.status !== 'banned' && member.status !== 'admin' && (
                                  <button
                                    onClick={() => {
                                      updateMemberStatusInAdmin(member.email, 'banned');
                                      setRefreshTick(t => t + 1);
                                      showToast(`Đã Ban ${member.nickname}`);
                                    }}
                                    style={{ ...smallRowBtnStyle(theme), color: '#B91C1C' }}
                                  >
                                    <Ban size={12} /> Ban
                                  </button>
                                )}
                                {member.status !== 'admin' && (
                                  <button
                                    onClick={() => {
                                      deleteMemberAndPurgeReviews(member.email);
                                      setRefreshTick(t => t + 1);
                                      showToast(`Đã xóa ${member.nickname}`);
                                    }}
                                    style={{ ...smallRowBtnStyle(theme), color: '#B91C1C' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KHỐI 2: TÀI KHOẢN QUẢN LÝ CẤP BẰNG NICK & MẬT KHẨU RIÊNG */}
              <div
                style={{
                  background: theme.bgCard,
                  borderRadius: '14px',
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow,
                  padding: '16px 18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <KeyRound size={16} style={{ color: theme.accent }} />
                      <span>Tài khoản Ban Quản Lý theo Nick & Mật khẩu ({adminAccounts.length} nick)</span>
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>
                      Ngoài việc cấp quyền theo Gmail ở bảng trên, bạn có thể tạo Nick & Mật khẩu riêng cho Quản lý
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setAdminAccForm({
                        id: '',
                        username: '',
                        password: '',
                        displayName: '',
                        role: 'manager',
                        canManageWeb: true,
                        canManageMaps: false,
                      });
                      setIsAdminAccModalOpen(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: theme.accent,
                      color: '#FFF',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <UserPlus size={14} /> Cấp Nick Quản Lý Mới
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  {adminAccounts.map(acc => (
                    <div
                      key={acc.id}
                      style={{
                        padding: '11px 13px',
                        borderRadius: '10px',
                        background: theme.bgElevated,
                        border: `1px solid ${theme.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800 }}>
                          {acc.displayName}
                        </div>
                        <div style={{ fontSize: '11.5px', color: theme.textMuted }}>
                          Nick: <strong style={{ color: theme.accent }}>@{acc.username}</strong> • Pass:{' '}
                          <code>{acc.password}</code>
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', marginTop: '3px' }}>
                          {acc.role === 'superadmin'
                            ? '★ Admin Tối Cao (Toàn quyền)'
                            : acc.canManageWeb && acc.canManageMaps
                            ? 'Quản lý Web & Maps'
                            : acc.canManageMaps
                            ? 'Quản lý Maps'
                            : 'Quản lý Web (Quán)'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => {
                            setAdminAccForm({
                              id: acc.id,
                              username: acc.username,
                              password: acc.password,
                              displayName: acc.displayName,
                              role: acc.role,
                              canManageWeb: acc.canManageWeb ?? true,
                              canManageMaps: acc.canManageMaps ?? false,
                            });
                            setIsAdminAccModalOpen(true);
                          }}
                          style={smallRowBtnStyle(theme)}
                        >
                          <Edit3 size={12} /> Sửa
                        </button>
                        {adminAccounts.length > 1 && (
                          <button
                            onClick={() => {
                              deleteAdminAccount(acc.id);
                              setRefreshTick(t => t + 1);
                              showToast(`Đã xóa nick quản lý @${acc.username}`);
                            }}
                            style={{ ...smallRowBtnStyle(theme), color: '#B91C1C' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* 4. ĐÁNH GIÁ & BÌNH LUẬN                                             */}
          {/* =================================================================== */}
          {activeSection === 'reviews' && (
            <div
              style={{
                background: theme.bgCard,
                borderRadius: '14px',
                border: `1px solid ${theme.border}`,
                padding: '18px 20px',
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800 }}>
                Đánh giá & Bình luận ({allReviews.length})
              </h3>
              {allReviews.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
                  Chưa có bình luận mới cần kiểm duyệt.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {allReviews.map(rev => (
                    <div
                      key={rev.id}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: theme.bgElevated,
                        border: `1px solid ${theme.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>
                          {rev.author} • <span style={{ color: theme.accent }}>{rev.targetName}</span> (★{rev.rating})
                        </div>
                        <div style={{ fontSize: '12.5px', color: theme.textSecondary, marginTop: '3px' }}>
                          "{rev.content}"
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          deleteSystemReview(rev.id, rev.targetId, rev.targetType);
                          setRefreshTick(t => t + 1);
                          showToast('Đã xóa bình luận');
                        }}
                        style={{ ...smallRowBtnStyle(theme), color: '#B91C1C' }}
                      >
                        <Trash2 size={13} /> Xóa
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* 5. NHẬT KÝ HOẠT ĐỘNG                                                */}
          {/* =================================================================== */}
          {activeSection === 'logs' && (
            <div
              style={{
                background: theme.bgCard,
                borderRadius: '14px',
                border: `1px solid ${theme.border}`,
                padding: '18px 20px',
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800 }}>
                Nhật ký thay đổi gần đây
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(adminState.auditLogs || []).slice(0, 30).map(log => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      background: theme.bgElevated,
                      border: `1px solid ${theme.border}`,
                      fontSize: '12.5px',
                    }}
                  >
                    <span>
                      <strong>{log.action}</strong> — {log.target}
                    </span>
                    <span style={{ color: theme.textMuted, fontSize: '11.5px' }}>
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* CHÂN TRANG BẢN QUYỀN TRONG WEB QUẢN TRỊ */}
          <footer
            style={{
              marginTop: '22px',
              paddingTop: '14px',
              borderTop: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '11.5px',
              color: theme.textMuted,
              fontWeight: 600,
            }}
          >
            <span>
              © 2026 <strong style={{ color: theme.textSecondary }}>Xuân Hòa Có Gì</strong> • Bản đồ số & Ẩm thực Xuân Hòa
            </span>
            <span>
              Designed & Developed by <strong style={{ color: theme.accent }}>MinhTT</strong> • All Rights Reserved.
            </span>
          </footer>
        </main>
      </div>

      {/* ======================================================================= */}
      {/* Ô CÀI ĐẶT GÓC PHẢI — SIÊU GỌN: MÀU SẮC SỔ RA 3 MÀU NGANG HÀNG CỠ CHỮ   */}
      {/* ======================================================================= */}
      {isSettingsModalOpen && (
        <div className="xh-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '16px',
              border: `1px solid ${theme.border}`,
              padding: '18px 20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '10px',
                borderBottom: `1px solid ${theme.border}`,
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Settings size={17} style={{ color: theme.accent }} />
                <span style={{ fontSize: '15.5px', fontWeight: 800 }}>Cài đặt</span>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.bgElevated,
                  borderRadius: '7px',
                  padding: '4px',
                  cursor: 'pointer',
                  color: theme.textPrimary,
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* HÀNG 1: MÀU SẮC (1 Ô SỔ RA 3 MÀU) NẰM NGANG HÀNG VỚI CỠ CHỮ */}
              <div
                style={{
                  ...settingRowBoxStyle(theme),
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: '10px',
                }}
              >
                <div>
                  <label style={compactLabelStyle(theme)}>Màu giao diện</label>
                  <select
                    value={themeMode}
                    onChange={e => handleSelectTheme(e.target.value as AdminThemeMode)}
                    style={{ ...lightSelectStyle(theme), padding: '7px 10px', fontSize: '12.5px' }}
                  >
                    <option value="ivory-gold">● Vàng Champagne</option>
                    <option value="platinum-royal">● Xanh Hoàng Gia</option>
                    <option value="emerald- pearl">● Ngọc Lục Bảo</option>
                  </select>
                </div>

                <div>
                  <label style={compactLabelStyle(theme)}>Cỡ chữ hiển thị</label>
                  <select
                    value={adminState.fontScale || 'normal'}
                    onChange={e => {
                      updateAdminSystemSettings({ fontScale: e.target.value as 'normal' | 'large' });
                      setRefreshTick(t => t + 1);
                    }}
                    style={{ ...lightSelectStyle(theme), padding: '7px 10px', fontSize: '12.5px' }}
                  >
                    <option value="normal">Chữ tiêu chuẩn</option>
                    <option value="large">Chữ lớn dễ nhìn</option>
                  </select>
                </div>
              </div>

              {/* HÀNG 2: LINK QUẢN LÝ MỌI NƠI */}
              <div
                style={{
                  ...settingRowBoxStyle(theme),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Link vào Quản lý (PC & Mobile)</div>
                  <div style={{ fontSize: '11.5px', color: theme.accent, fontWeight: 700 }}>
                    https://xuanhoacogi.com/quanly
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText('https://xuanhoacogi.com/quanly');
                    showToast('Đã sao chép link');
                  }}
                  style={smallRowBtnStyle(theme)}
                >
                  <Copy size={12} /> Copy
                </button>
              </div>

              {/* HÀNG 3: SAO LƯU & KHÔI PHỤC GỌN TRÊN 1 DÒNG */}
              <div
                style={{
                  ...settingRowBoxStyle(theme),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Sao lưu & Khôi phục</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleExportBackupJson} style={smallRowBtnStyle(theme)}>
                    <Download size={12} /> Tải Backup
                  </button>
                  <label style={{ ...smallRowBtnStyle(theme), cursor: 'pointer' }}>
                    <Upload size={12} /> Khôi phục
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackupJson}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* HÀNG 4: KẾT NỐI / ĐỔI GMAIL GOOGLE TRỰC TIẾP */}
              <div
                style={{
                  ...settingRowBoxStyle(theme),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>
                    Gmail đang kết nối:{' '}
                    <span style={{ color: theme.accent }}>
                      {effectiveAuthUser?.email || 'Chưa kết nối Gmail'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textMuted }}>
                    Đăng nhập bằng Google (Gmail) để đồng bộ 1 nick duy nhất
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleOAuthLoginInAdmin}
                  style={{
                    ...smallRowBtnStyle(theme),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <GoogleGIcon size={13} />
                  <span>{effectiveAuthUser?.email ? 'Đổi Gmail' : 'Đăng nhập Gmail'}</span>
                </button>
              </div>

              {/* HÀNG 5: TÀI KHOẢN HIỆN TẠI & NÚT THOÁT (ĐĂNG XUẤT) ĐƯỢC GOM VÀO CÀI ĐẶT */}
              <div
                style={{
                  ...settingRowBoxStyle(theme),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  borderColor: 'rgba(220, 38, 38, 0.22)',
                  background: 'rgba(254, 242, 242, 0.6)',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: theme.textPrimary }}>
                    {roleInfo.displayName} ({roleInfo.roleBadgeLabel})
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textMuted }}>
                    Đăng xuất khỏi phiên Quản trị hiện tại
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    handleAdminLogout();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(220, 38, 38, 0.35)',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={13} /> Thoát Quản trị
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CẤP / SỬA TÀI KHOẢN QUẢN LÝ (NICK + MẬT KHẨU RIÊNG) */}
      {isAdminAccModalOpen && (
        <div className="xh-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '410px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '16px',
              border: `1px solid ${theme.border}`,
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800 }}>
              {adminAccForm.id ? 'Cập nhật Tài khoản Quản lý' : 'Cấp Nick Quản Lý Mới'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={compactLabelStyle(theme)}>Tên hiển thị / Chức danh</label>
                <input
                  type="text"
                  value={adminAccForm.displayName}
                  onChange={e => setAdminAccForm({ ...adminAccForm, displayName: e.target.value })}
                  placeholder="VD: Quản lý Quán 1"
                  style={compactInputStyle(theme)}
                />
              </div>
              <div>
                <label style={compactLabelStyle(theme)}>Tên đăng nhập (Nick) *</label>
                <input
                  type="text"
                  value={adminAccForm.username}
                  onChange={e => setAdminAccForm({ ...adminAccForm, username: e.target.value })}
                  placeholder="VD: quanly1"
                  style={compactInputStyle(theme)}
                />
              </div>
              <div>
                <label style={compactLabelStyle(theme)}>Mật khẩu riêng *</label>
                <input
                  type="text"
                  value={adminAccForm.password}
                  onChange={e => setAdminAccForm({ ...adminAccForm, password: e.target.value })}
                  placeholder="Nhập mật khẩu..."
                  style={compactInputStyle(theme)}
                />
              </div>
              <div>
                <label style={compactLabelStyle(theme)}>
                  Phân quyền mảng quản lý (Tích chọn 1 hoặc cả 2)
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 11px',
                      borderRadius: '8px',
                      border: adminAccForm.canManageWeb
                        ? `1.5px solid ${theme.accent}`
                        : `1px solid ${theme.border}`,
                      background: adminAccForm.canManageWeb ? theme.accentSoft : theme.bgElevated,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={adminAccForm.canManageWeb}
                      onChange={e =>
                        setAdminAccForm({ ...adminAccForm, canManageWeb: e.target.checked })
                      }
                    />
                    <span>Quản lý Web (Quán)</span>
                  </label>

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 11px',
                      borderRadius: '8px',
                      border: adminAccForm.canManageMaps
                        ? '1.5px solid #10B981'
                        : `1px solid ${theme.border}`,
                      background: adminAccForm.canManageMaps
                        ? 'rgba(16, 185, 129, 0.12)'
                        : theme.bgElevated,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={adminAccForm.canManageMaps}
                      onChange={e =>
                        setAdminAccForm({ ...adminAccForm, canManageMaps: e.target.checked })
                      }
                    />
                    <span>Quản lý Maps</span>
                  </label>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setIsAdminAccModalOpen(false)} style={actionBtnStyle(theme, false)}>
                Hủy
              </button>
              <button
                onClick={handleSaveAdminAccount}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: theme.accent,
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Lưu Tài Khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM QUÁN MỚI (QUẢN LÝ QUÁN) HOẶC THÊM ĐỊNH VỊ MỚI (QUẢN LÝ MAPS) */}
      {isNewPlaceModalOpen && (
        <div className="xh-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '450px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '16px',
              border: `1px solid ${theme.border}`,
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800 }}>
              {activeSection === 'maps'
                ? '📍 Thêm Địa Điểm Định Vị Mới (Maps)'
                : '🏪 Thêm Quán Mới (Quản lý Quán)'}
            </h3>
            <div style={{ fontSize: '11.5px', color: theme.textMuted, marginBottom: '12px' }}>
              {activeSection === 'maps'
                ? 'Chọn đúng mục Hành chính & Công cộng, Trường học... Các mục Hành chính/Trường học chỉ nằm trên Bản đồ số, không đẩy sang Quản lý Quán.'
                : 'Chỉ dành cho Quán ăn, Quán nhậu, Cafe, Ăn vặt, Dịch vụ.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={compactLabelStyle(theme)}>
                  {activeSection === 'maps' ? 'Tên Địa điểm / Cơ quan / Quán *' : 'Tên Quán *'}
                </label>
                <input
                  type="text"
                  value={newPlaceForm.name}
                  onChange={e => setNewPlaceForm({ ...newPlaceForm, name: e.target.value })}
                  placeholder={
                    activeSection === 'maps'
                      ? 'VD: UBND Phường Xuân Hòa / Công an Phường Xuân Hòa...'
                      : 'VD: Lẩu Nướng Cô Ba / Bi-a Club...'
                  }
                  style={compactInputStyle(theme)}
                />
              </div>

              {activeSection === 'maps' ? (
                <div>
                  <label style={compactLabelStyle(theme)}>
                    Danh mục Bản đồ số (Chọn đúng mục Hành chính / Trường học / Quán)
                  </label>
                  <select
                    value={newPlaceForm.mapCategory}
                    onChange={e => {
                      const nextCat = e.target.value as EditableMapCategory;
                      setNewPlaceForm({
                        ...newPlaceForm,
                        mapCategory: nextCat,
                        sectorTag:
                          nextCat === 'public' || nextCat === 'school'
                            ? 'dia-danh'
                            : nextCat === 'billiards' || nextCat === 'game'
                            ? 'bia-game'
                            : nextCat === 'phone'
                            ? 'dien-thoai'
                            : nextCat === 'entertainment'
                            ? 'an-choi'
                            : nextCat === 'pub'
                            ? 'nhau-lau'
                            : nextCat === 'cafe'
                            ? 'uong'
                            : nextCat === 'snack'
                            ? 'an-vat'
                            : nextCat === 'service' || nextCat === 'grocery' || nextCat === 'supermarket'
                            ? 'dich-vu'
                            : 'an-chinh',
                      });
                    }}
                    style={{ ...lightSelectStyle(theme), padding: '8px 11px', fontSize: '12.5px' }}
                  >
                    {EDITABLE_MAP_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={compactLabelStyle(theme)}>Phân khu Quán (Ngành nghề)</label>
                  <select
                    value={newPlaceForm.sectorTag === 'dia-danh' ? 'an-chinh' : newPlaceForm.sectorTag}
                    onChange={e => {
                      const sec = e.target.value;
                      setNewPlaceForm({
                        ...newPlaceForm,
                        sectorTag: sec,
                        mapCategory: mapSectorTagToMapCategory(sec, newPlaceForm.name),
                      });
                    }}
                    style={{ ...lightSelectStyle(theme), padding: '8px 11px', fontSize: '12.5px' }}
                  >
                    {commercialSectorTags.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={compactLabelStyle(theme)}>Số điện thoại</label>
                  <input
                    type="text"
                    value={newPlaceForm.phone}
                    onChange={e => setNewPlaceForm({ ...newPlaceForm, phone: e.target.value })}
                    style={compactInputStyle(theme)}
                  />
                </div>
                <div>
                  <label style={compactLabelStyle(theme)}>Giờ mở cửa / làm việc</label>
                  <input
                    type="text"
                    value={newPlaceForm.openHours}
                    onChange={e => setNewPlaceForm({ ...newPlaceForm, openHours: e.target.value })}
                    style={compactInputStyle(theme)}
                  />
                </div>
              </div>
              <div>
                <label style={compactLabelStyle(theme)}>Địa chỉ</label>
                <input
                  type="text"
                  value={newPlaceForm.address}
                  onChange={e => setNewPlaceForm({ ...newPlaceForm, address: e.target.value })}
                  style={compactInputStyle(theme)}
                />
              </div>
              <div>
                <label style={compactLabelStyle(theme)}>
                  Link Google Maps / Plus Code (VD: 7PQ6+VFP) / Tọa độ
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={newPlaceForm.mapsUrl}
                    onChange={e => {
                      const val = e.target.value;
                      const parsed = parseCoordinatesFromInputOrUrl(val);
                      setNewPlaceForm(prev => ({
                        ...prev,
                        mapsUrl: val,
                        lat: parsed ? String(parsed.lat) : prev.lat,
                        lng: parsed ? String(parsed.lng) : prev.lng,
                      }));
                      if (!parsed && /^https?:\/\//i.test(val.trim())) {
                        expandAndParseShortMapsUrl(val.trim()).then(expanded => {
                          if (expanded) {
                            setNewPlaceForm(prev => ({
                              ...prev,
                              lat: String(expanded.lat),
                              lng: String(expanded.lng),
                            }));
                            showToast(`📍 Đã giải mã link rút gọn: ${expanded.lat}, ${expanded.lng}`);
                          }
                        });
                      }
                    }}
                    placeholder="Dán link Maps, Plus Code (7PQ6+VFP) hoặc 21.289, 105.711..."
                    style={{ ...compactInputStyle(theme), flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const resolved = await resolvePlaceCoordinates({
                        mapsUrl: newPlaceForm.mapsUrl,
                        address: newPlaceForm.address,
                        name: newPlaceForm.name,
                        allowGeocode: true,
                      });
                      if (resolved.lat !== null && resolved.lng !== null) {
                        setNewPlaceForm(prev => ({
                          ...prev,
                          lat: String(resolved.lat),
                          lng: String(resolved.lng),
                        }));
                        showToast(`📍 Đã tìm thấy tọa độ: ${resolved.lat}, ${resolved.lng}`);
                      } else {
                        showToast('Không tìm thấy tự động — hãy nhập Plus Code hoặc chấm trên Bản đồ', 'warn');
                      }
                    }}
                    style={{
                      ...smallRowBtnStyle(theme),
                      background: theme.accent,
                      color: '#FFF',
                      borderColor: theme.accent,
                    }}
                  >
                    Tìm tọa độ
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={compactLabelStyle(theme)}>Vĩ độ (Lat - tự động cắm ghim)</label>
                  <input
                    type="text"
                    value={newPlaceForm.lat}
                    onChange={e => setNewPlaceForm({ ...newPlaceForm, lat: e.target.value })}
                    placeholder="21.2897..."
                    style={{ ...compactInputStyle(theme), fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={compactLabelStyle(theme)}>Kinh độ (Lng - tự động cắm ghim)</label>
                  <input
                    type="text"
                    value={newPlaceForm.lng}
                    onChange={e => setNewPlaceForm({ ...newPlaceForm, lng: e.target.value })}
                    placeholder="105.7112..."
                    style={{ ...compactInputStyle(theme), fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setIsNewPlaceModalOpen(false)} style={actionBtnStyle(theme, false)}>
                Hủy
              </button>
              <button
                onClick={handleCreatePlace}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: theme.accent,
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                {isSuperAdmin
                  ? activeSection === 'maps'
                    ? '✓ Thêm & Ghim Ngay'
                    : '✓ Tạo Quán Ngay'
                  : 'Gửi Duyệt Tạo Mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẠO NICK PHỤ ĐÁNH GIÁ */}
      {isAddSeederModalOpen && (
        <div className="xh-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '16px',
              border: `1px solid ${theme.border}`,
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 800 }}>
              Tạo Nick Phụ Đánh Giá
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={compactLabelStyle(theme)}>Tên hiển thị</label>
                <input
                  type="text"
                  value={seederForm.nickname}
                  onChange={e => setSeederForm({ ...seederForm, nickname: e.target.value })}
                  placeholder="VD: Minh K48 ĐHSP2"
                  style={compactInputStyle(theme)}
                />
              </div>
              <div>
                <label style={compactLabelStyle(theme)}>Email (Tùy chọn)</label>
                <input
                  type="text"
                  value={seederForm.email}
                  onChange={e => setSeederForm({ ...seederForm, email: e.target.value })}
                  placeholder="Để trống sẽ tự tạo"
                  style={compactInputStyle(theme)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setIsAddSeederModalOpen(false)} style={actionBtnStyle(theme, false)}>
                Đóng
              </button>
              <button
                onClick={handleCreateSeederAccount}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: theme.accent,
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Tạo nick
              </button>
            </div>
          </div>
        </div>
      )}

      <MerchantPortalModal
        isOpen={isMerchantModalOpen}
        onClose={() => setIsMerchantModalOpen(false)}
        authUser={authUser}
        isAdminUser={true}
        initialTab={merchantModalTab}
        onStartPickOnMap={(placeId, placeName) => {
          jumpToMapUrl(
            `#/ban-do?pick=${encodeURIComponent(placeId)}&pickName=${encodeURIComponent(placeName)}`
          );
        }}
        onFlyToCoordinates={(lat, lng, label) => {
          jumpToMapUrl(
            `#/ban-do?flyLat=${lat}&flyLng=${lng}&flyLabel=${encodeURIComponent(label || '')}`
          );
        }}
        onDataChanged={() => setRefreshTick(t => t + 1)}
      />

      {/* CSS CHUẨN LIGHT MODE, CỘT 2 VÀ CỘT 3 CAO BẰNG NHAU CÂN ĐỐI 100% */}
      <style>{`
        .xh-admin-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .xh-admin-shell button {
          transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.15s ease, box-shadow 0.15s ease;
        }
        .xh-admin-shell button:active {
          transform: scale(0.95) !important;
        }
        .xh-admin-shell input,
        .xh-admin-shell select,
        .xh-admin-shell option,
        .xh-admin-shell textarea {
          color-scheme: light !important;
          background-color: ${theme.bgInput} !important;
          color: ${theme.textPrimary} !important;
        }
        .xh-font-large {
          font-size: 105%;
        }
        .xh-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.48);
          backdrop-filter: blur(4px);
          z-index: 99998;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
        }
        .xh-admin-topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .xh-admin-body {
          display: flex;
          flex: 1;
          min-height: calc(100vh - 54px);
        }
        .xh-admin-sidebar {
          width: 215px;
          flex-shrink: 0;
          padding: 14px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .xh-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .xh-sidebar-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 11px;
          border-radius: 9px;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          white-space: nowrap;
        }
        .xh-admin-main {
          flex: 1;
          padding: 16px 16px 40px 16px;
          max-width: 1580px;
          width: 100%;
          overflow-x: hidden;
        }
        .xh-admin-main.xh-admin-main-maps {
          max-width: none;
          padding: 10px 12px 14px 12px;
        }
        /* BỐ CỤC 3 CỘT CHO QUẢN LÝ QUÁN VÀ QUẢN LÝ MAPS — CÂN ĐỐI 100% KHUNG HÌNH */
        .xh-three-col-layout {
          display: grid;
          grid-template-columns: 295px minmax(360px, 1.12fr) minmax(330px, 1fr);
          gap: 14px;
          align-items: stretch;
        }
        .xh-three-col-layout.xh-maps-three-col {
          grid-template-columns: 280px 420px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }
        .xh-three-col-layout.xh-maps-three-col > .xh-places-list-pane,
        .xh-three-col-layout.xh-maps-three-col > .xh-col-middle-pane,
        .xh-three-col-layout.xh-maps-three-col > .xh-col-right-pane {
          position: static;
          top: auto;
          margin-top: 0;
        }
        .xh-places-master-detail {
          display: grid;
          grid-template-columns: 330px 1fr;
          gap: 16px;
          align-items: stretch;
        }
        .xh-places-list-pane {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 76px);
          position: sticky;
          top: 62px;
          align-self: start;
          box-sizing: border-box;
        }
        .xh-col-middle-pane {
          position: sticky;
          top: 62px;
          align-self: start;
          max-height: calc(100vh - 76px);
          overflow-y: auto;
          box-sizing: border-box;
        }
        .xh-col-right-pane {
          position: sticky;
          top: 62px;
          align-self: start;
          box-sizing: border-box;
        }
        .xh-compact-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 10px;
          align-items: end;
        }
        .xh-col-span-2 {
          grid-column: span 2;
        }
        .xh-overview-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .xh-admin-root button,
        .xh-admin-root select,
        .xh-admin-root input {
          transition: background-color 0.14s ease, border-color 0.14s ease, transform 0.1s ease, box-shadow 0.14s ease;
        }
        .xh-admin-root button:active {
          transform: scale(0.97);
        }
        .xh-admin-root input:focus,
        .xh-admin-root select:focus {
          border-color: #166534 !important;
          box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.14);
        }

        @keyframes xhToastJump {
          0% {
            opacity: 0;
            transform: translate(-50%, 14px) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }

        @keyframes xhInlineBannerPop {
          0% {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 1320px) {
          .xh-three-col-layout.xh-maps-three-col {
            grid-template-columns: 245px 365px minmax(0, 1fr);
            gap: 10px;
          }
        }

        @media (max-width: 1120px) {
          .xh-three-col-layout {
            grid-template-columns: 260px 1fr;
          }
          .xh-three-col-layout.xh-maps-three-col {
            grid-template-columns: 240px 350px minmax(0, 1fr);
          }
        }

        @media (max-width: 960px) {
          .xh-hide-mobile {
            display: none !important;
          }
          .xh-show-mobile-only {
            display: inline-flex !important;
          }
          .xh-admin-topbar {
            padding: 8px 10px;
            gap: 6px;
          }
          .xh-admin-body {
            flex-direction: column;
          }
          .xh-admin-sidebar {
            width: 100%;
            padding: 8px 10px;
            border-right: none !important;
            border-bottom: 1px solid rgba(0,0,0,0.08);
          }
          .xh-sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            gap: 6px;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .xh-sidebar-nav::-webkit-scrollbar {
            display: none;
          }
          .xh-sidebar-btn {
            padding: 7px 11px;
            font-size: 12px;
            flex-shrink: 0;
            gap: 6px;
          }
          .xh-admin-main {
            padding: 12px 10px 50px 10px;
          }
          .xh-three-col-layout,
          .xh-places-master-detail {
            grid-template-columns: 1fr;
          }
          .xh-col-right-pane {
            grid-column: 1;
            position: static;
            max-height: none !important;
          }
          .xh-places-list-pane {
            position: static;
            height: auto;
            max-height: 75vh;
          }
          .xh-mobile-hidden {
            display: none !important;
          }
          .xh-compact-grid {
            grid-template-columns: 1fr;
          }
          .xh-col-span-2 {
            grid-column: span 1;
          }
          .xh-quick-add-dish,
          .xh-inline-dish-edit {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function compactLabelStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    display: 'block',
    fontSize: '11.5px',
    fontWeight: 600,
    color: theme.textSecondary,
    marginBottom: '4px',
    lineHeight: '16px',
    height: '16px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
}

function compactInputStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    width: '100%',
    height: '36px',
    boxSizing: 'border-box',
    padding: '0 10px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.bgInput,
    color: theme.textPrimary,
    fontSize: '12.5px',
    fontWeight: 600,
    outline: 'none',
    fontFamily: 'inherit',
  };
}

function lightSelectStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    width: '100%',
    padding: '6px 8px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.bgElevated,
    color: theme.textPrimary,
    fontSize: '11.5px',
    fontWeight: 700,
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

function actionBtnStyle(theme: ThemeTokens, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 11px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    border: active ? `1px solid ${theme.accentBorder}` : `1px solid ${theme.border}`,
    backgroundColor: active ? theme.accentSoft : theme.bgElevated,
    color: active ? theme.accent : theme.textSecondary,
  };
}

function smallRowBtnStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 9px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: 700,
    cursor: 'pointer',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.bgCard,
    color: theme.textSecondary,
    whiteSpace: 'nowrap',
  };
}

function settingRowBoxStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: '10px',
    backgroundColor: theme.bgElevated,
    border: `1px solid ${theme.border}`,
  };
}
