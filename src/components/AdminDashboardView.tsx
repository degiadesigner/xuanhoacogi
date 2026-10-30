'use client';
import React, { useState, useEffect, useMemo } from 'react';
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
} from '@/lib/admin-store';
import { UserAuthProfile, saveAuthUser } from '@/lib/auth';
import { Place } from '@/lib/places-xuanhoa';
import { MerchantPortalModal } from '@/components/map/MerchantPortalModal';
import { triggerFeedback, FeedbackSoundType } from '@/lib/ui-feedback';
import {
  getAllAdminPlaceAndLandmarkItems,
  getManagedOsmLandmarks,
  parseCoordinatesFromInputOrUrl,
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
  // =========================================================================
  const [loggedAdmin, setLoggedAdmin] = useState<AdminAccount | null>(() => getLoggedAdminSession());
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
  const [mapCatFilter, setMapCatFilter] = useState<string>('all');
  const [mapCoordFilter, setMapCoordFilter] = useState<'all' | 'verified' | 'unverified' | 'locked'>('all');
  const [gmailLoginInput, setGmailLoginInput] = useState('');

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

  const showToast = (msg: string, sound: FeedbackSoundType = 'success') => {
    triggerFeedback(sound);
    setToast(msg);
    setTimeout(() => setToast(''), 3400);
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
    initAdminCloudSync();
    seedDemoMembersIfEmpty();
    const onSync = () => setRefreshTick(t => t + 1);
    window.addEventListener('xuanhoa_admin_sync', onSync);
    return () => window.removeEventListener('xuanhoa_admin_sync', onSync);
  }, []);

  const adminState = useMemo(() => getAdminState(), [refreshTick]);
  const adminAccounts = useMemo(() => getAdminAccounts(), [refreshTick]);
  const roleInfo = useMemo(
    () => getEffectiveAdminRoleInfo(loggedAdmin, authUser),
    [loggedAdmin, authUser, refreshTick]
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

  const allPlaces = useMemo(() => getAllAdminPlaceAndLandmarkItems(), [refreshTick]);
  const managedOsmLandmarks = useMemo(() => getManagedOsmLandmarks(true), [refreshTick]);
  const allDishes = useMemo(() => getAllManagedDishes(), [refreshTick]);
  const allReviews = useMemo(() => getAllSystemReviews(), [refreshTick]);
  const pendingMerchantSubmissions = useMemo(
    () => getAllMerchantSubmissions().filter(s => s.status === 'pending'),
    [refreshTick]
  );

  // Danh sách chờ Admin duyệt ở cột 1 của Quản lý Quán và Quản lý Maps
  const pendingWebPlaces = useMemo(() => {
    return allPlaces.filter(item => {
      const ov = adminState.places?.[item.place.id];
      const hasSub = pendingMerchantSubmissions.some(s => s.placeId === item.place.id);
      return Boolean(ov?.pendingWebApproval) || hasSub;
    });
  }, [allPlaces, adminState, pendingMerchantSubmissions]);

  const pendingMapPlaces = useMemo(() => {
    return allPlaces.filter(item => {
      const ov = adminState.places?.[item.place.id];
      const hasMapSub = pendingMerchantSubmissions.some(
        s => s.placeId === item.place.id && s.proposed.lat !== null
      );
      return Boolean(ov?.pendingMapApproval) || hasMapSub;
    });
  }, [allPlaces, adminState, pendingMerchantSubmissions]);
  const allMembers = useMemo(() => {
    return Object.values(adminState.members || {}).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }, [adminState]);

  const sectorTags: SectorCategoryTag[] = useMemo(() => {
    return adminState.sectorTags && adminState.sectorTags.length > 0
      ? adminState.sectorTags
      : DEFAULT_SECTOR_TAGS;
  }, [adminState]);

  const getSectorShortLabel = (sectorId: string) => {
    const found = sectorTags.find(s => s.id === sectorId);
    if (!found) return sectorId;
    return found.label.split(' (')[0];
  };

  useEffect(() => {
    if (!selectedPlaceId && allPlaces.length > 0) {
      selectPlaceForEdit(allPlaces[0]);
    } else if (selectedPlaceId) {
      const updated = allPlaces.find(p => p.place.id === selectedPlaceId);
      if (updated && editPlaceName === '') {
        selectPlaceForEdit(updated);
      }
    }
  }, [allPlaces, selectedPlaceId]);

  const selectPlaceForEdit = (item: AdminPlaceItem) => {
    setSelectedPlaceId(item.place.id);
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

    const ov = adminState.places?.[item.place.id];
    const osmItem = managedOsmLandmarks.find(l => l.id === item.place.id);
    const resolvedLat = typeof ov?.lat === 'number' ? ov.lat : osmItem?.lat;
    const resolvedLng = typeof ov?.lng === 'number' ? ov.lng : osmItem?.lng;
    setEditPlaceLat(typeof resolvedLat === 'number' ? String(resolvedLat) : '');
    setEditPlaceLng(typeof resolvedLng === 'number' ? String(resolvedLng) : '');

    const resolvedMapCat = (ov?.mapCategory ||
      osmItem?.category ||
      (item.sectorTag === 'dia-danh'
        ? 'public'
        : item.sectorTag === 'nhau-lau'
        ? 'pub'
        : item.sectorTag === 'uong'
        ? 'cafe'
        : item.sectorTag === 'an-vat'
        ? 'snack'
        : 'food')) as EditableMapCategory;
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
  };

  // Lọc và sắp xếp danh sách quán theo đúng bảng chữ cái A -> B -> C -> D (hoặc tab Duyệt Quán)
  const filteredPlaces = useMemo(() => {
    const q = placeSearch.trim().toLowerCase();
    const sourceList = placeListTab === 'pending_web' ? pendingWebPlaces : allPlaces;
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
  }, [allPlaces, pendingWebPlaces, placeListTab, placeSearch, placeSectorFilter, placeStatusFilter]);

  // Lọc danh sách Địa điểm cho mục Quản lý Maps (Cột 1 của Quản lý Maps)
  const getResolvedPlaceCoordsAndCat = (item: AdminPlaceItem) => {
    const ov = adminState.places?.[item.place.id];
    const osmItem = managedOsmLandmarks.find(l => l.id === item.place.id);
    const lat = typeof ov?.lat === 'number' ? ov.lat : osmItem?.lat ?? null;
    const lng = typeof ov?.lng === 'number' ? ov.lng : osmItem?.lng ?? null;
    const hasCoords = typeof lat === 'number' && typeof lng === 'number';
    const mapCat = (ov?.mapCategory ||
      osmItem?.category ||
      (item.sectorTag === 'dia-danh'
        ? 'public'
        : item.sectorTag === 'nhau-lau'
        ? 'pub'
        : item.sectorTag === 'uong'
        ? 'cafe'
        : item.sectorTag === 'an-vat'
        ? 'snack'
        : 'food')) as EditableMapCategory;
    return { lat, lng, hasCoords, mapCat };
  };

  const filteredMapPlaces = useMemo(() => {
    const q = mapSearch.trim().toLowerCase();
    const sourceList = mapListTab === 'pending_maps' ? pendingMapPlaces : allPlaces;
    const list = sourceList.filter(item => {
      const { hasCoords, mapCat } = getResolvedPlaceCoordsAndCat(item);
      if (mapCatFilter !== 'all' && mapCat !== mapCatFilter) return false;
      if (mapCoordFilter === 'verified' && !hasCoords) return false;
      if (mapCoordFilter === 'unverified' && hasCoords) return false;
      if (mapCoordFilter === 'locked' && item.status !== 'locked') return false;
      if (!q) return true;
      return (
        item.place.name.toLowerCase().includes(q) ||
        item.place.address.toLowerCase().includes(q) ||
        (item.place.phone || '').toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => a.place.name.localeCompare(b.place.name, 'vi'));
  }, [allPlaces, pendingMapPlaces, mapListTab, mapSearch, mapCatFilter, mapCoordFilter, adminState, managedOsmLandmarks]);

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

  const selectedPlaceItem = useMemo(
    () => allPlaces.find(p => p.place.id === selectedPlaceId) || null,
    [allPlaces, selectedPlaceId]
  );

  const totalMenuDishesCount = useMemo(() => {
    return allPlaces.reduce((acc, item) => acc + (item.fullMenu?.length || 0), 0);
  }, [allPlaces]);

  // Xử lý đăng nhập Admin (theo Nick + Mật khẩu) hoặc Quản lý (nếu gõ trực tiếp Gmail đã được cấp quyền vào ô tài khoản)
  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanInput = loginUsername.trim().toLowerCase();
    if (cleanInput.includes('@')) {
      const member = adminState.members?.[cleanInput];
      const isSuperEmail = Boolean(
        adminState.adminEmails?.some(em => em.trim().toLowerCase() === cleanInput)
      );
      if (isSuperEmail || (member && (member.canManageWeb || member.canManageMaps || member.status === 'admin'))) {
        saveAuthUser({
          isLoggedIn: true,
          uid: member?.uid || `mgr_${Date.now()}`,
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
        showToast(`Xin chào ${member?.nickname || cleanInput}! Đã vào bằng Gmail được cấp quyền.`);
        return;
      }
      setLoginError('Gmail này chưa được Admin tích cấp quyền Quản lý Quán hoặc Quản lý Maps!');
      return;
    }

    const res = loginAdminWithCredentials(loginUsername, loginPassword, loginRememberMe);
    if (!res.ok || !res.account) {
      setLoginError(res.message || 'Sai tên đăng nhập hoặc mật khẩu Admin');
      return;
    }
    setLoggedAdmin(res.account);
    setLoginPassword('');
    showToast(`Xin chào ${res.account.displayName}!`);
  };

  const handleAdminLogout = () => {
    logoutAdminSession();
    setLoggedAdmin(null);
    setIsSettingsModalOpen(false);
    showToast('Đã thoát khỏi phiên Quản trị');
    if (!loggedAdmin) {
      onBackToApp();
    }
  };

  // Lưu thay đổi của Quán & Thực đơn
  const handleSavePlaceAndMenu = (customMenuOverride?: CustomMenuEntry[], toastLabel?: string) => {
    if (!selectedPlaceItem) return;
    const menuToSave = customMenuOverride !== undefined ? customMenuOverride : editPlaceMenu;
    const parsedTags = editPlaceTagsText
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    let mappedCategory: Place['category'] = editPlaceCategory;
    if (editPlaceSectorTag === 'nhau-lau') mappedCategory = 'pub';
    else if (editPlaceSectorTag === 'uong') mappedCategory = 'cafe';
    else if (editPlaceSectorTag === 'an-vat') mappedCategory = 'fast_food';
    else if (editPlaceSectorTag === 'an-chinh') mappedCategory = 'restaurant';

    // Tự động trích xuất tọa độ từ link Google Maps / Plus Code nếu có
    const parsedFromUrl = parseCoordinatesFromInputOrUrl(editPlaceMapsUrl || editPlaceMapsQuery);
    const numLat = editPlaceLat.trim() !== '' ? Number(editPlaceLat) : parsedFromUrl?.lat;
    const numLng = editPlaceLng.trim() !== '' ? Number(editPlaceLng) : parsedFromUrl?.lng;
    const hasValidCoords =
      typeof numLat === 'number' &&
      typeof numLng === 'number' &&
      !Number.isNaN(numLat) &&
      !Number.isNaN(numLng) &&
      numLat >= 20.5 &&
      numLat <= 22.0 &&
      numLng >= 105.0 &&
      numLng <= 106.5;

    const prevOv = adminState.places?.[selectedPlaceItem.place.id];
    const isEditingMapsSection = activeSection === 'maps';

    savePlaceAdminOverride(
      selectedPlaceItem.place.id,
      {
        name: editPlaceName.trim() || selectedPlaceItem.place.name,
        tagline: editPlaceTagline.trim(),
        sectorTag: editPlaceSectorTag,
        mapCategory: editPlaceMapCategory,
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
        mapsQuery: editPlaceMapsQuery.trim() || `${editPlaceName.trim()} Xuân Hòa Phúc Yên`,
        mapsUrl: editPlaceMapsUrl.trim(),
        minPrice: Number(editPlaceMinPrice) || 20,
        maxPrice: Number(editPlaceMaxPrice) || 60,
        signatureDishName: editPlaceSigName.trim() || 'Món tủ',
        signatureDishPrice: Number(editPlaceSigPrice) || 35,
        quip: editPlaceQuip.trim(),
        imageUrl: editPlaceImageUrl.trim() || undefined,
        customMenu: menuToSave,
        ...(hasValidCoords
          ? {
              lat: Number(numLat!.toFixed(6)),
              lng: Number(numLng!.toFixed(6)),
              coordinateVerified: true,
              coordinateSource: 'admin_verified',
            }
          : {}),
        ...(!isSuperAdmin
          ? isEditingMapsSection
            ? {
                pendingMapApproval: {
                  submittedBy: roleInfo.identifier || 'quanlymaps',
                  submittedByName: roleInfo.displayName || 'Quản lý Maps',
                  submittedAt: Date.now(),
                  actionSummary: hasValidCoords
                    ? `Cập nhật định vị (${Number(numLat!.toFixed(5))}, ${Number(numLng!.toFixed(5))})`
                    : 'Cập nhật thông tin địa điểm Maps',
                  previousLat: prevOv?.lat ?? null,
                  previousLng: prevOv?.lng ?? null,
                },
              }
            : {
                pendingWebApproval: {
                  submittedBy: roleInfo.identifier || 'quanlyweb',
                  submittedByName: roleInfo.displayName || 'Quản lý Web',
                  submittedAt: Date.now(),
                  actionSummary: customMenuOverride
                    ? `Cập nhật thực đơn (${menuToSave.length} món)`
                    : 'Cập nhật thông tin quán',
                },
              }
          : {}),
      },
      toastLabel || `Cập nhật "${editPlaceName}"`
    );
    setRefreshTick(t => t + 1);
    setJustSavedPlace(true);
    setTimeout(() => setJustSavedPlace(false), 2000);
    showToast(
      !isSuperAdmin
        ? `✅ Đã lưu và gửi vào mục ${isEditingMapsSection ? 'Duyệt Maps' : 'Duyệt Quán'} chờ Admin duyệt!`
        : toastLabel || `✅ Đã lưu cập nhật "${editPlaceName}"!`,
      'approve'
    );
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
    if (!newPlaceForm.name.trim()) return;
    const newId = `xh_custom_${Date.now()}`;
    let mappedCategory: Place['category'] = 'restaurant';
    if (newPlaceForm.sectorTag === 'nhau-lau') mappedCategory = 'pub';
    else if (newPlaceForm.sectorTag === 'uong') mappedCategory = 'cafe';
    else if (newPlaceForm.sectorTag === 'an-vat') mappedCategory = 'fast_food';

    const created: Place = {
      id: newId,
      name: newPlaceForm.name.trim(),
      category: mappedCategory,
      tagline: `${newPlaceForm.name.trim()} • Xuân Hòa`,
      tags: [getSectorShortLabel(newPlaceForm.sectorTag), 'Xuân Hòa'],
      serviceMode: 'both',
      zone: 'dhsp2',
      address: newPlaceForm.address.trim(),
      distance: 'Cách ĐHSP2 350m',
      minPrice: 25,
      maxPrice: 65,
      priceRange: '25k - 65k',
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
        name: newPlaceForm.sigDishName.trim() || 'Món đặc trưng',
        price: Number(newPlaceForm.sigDishPrice) || 35,
      },
      menu: [
        {
          id: `${newId}_m1`,
          name: newPlaceForm.sigDishName.trim() || 'Món đặc trưng',
          price: Number(newPlaceForm.sigDishPrice) || 35,
          tag: 'Bán chạy',
          serviceTag: 'both',
        },
      ],
      quip: 'Địa điểm mới tại Xuân Hòa Có Gì.',
    };
    createNewCustomPlace(created);
    const parsedFromUrl = parseCoordinatesFromInputOrUrl(newPlaceForm.mapsUrl || newPlaceForm.address);
    const numLat = newPlaceForm.lat.trim() !== '' ? Number(newPlaceForm.lat) : parsedFromUrl?.lat;
    const numLng = newPlaceForm.lng.trim() !== '' ? Number(newPlaceForm.lng) : parsedFromUrl?.lng;
    const hasCoords =
      typeof numLat === 'number' &&
      typeof numLng === 'number' &&
      !Number.isNaN(numLat) &&
      !Number.isNaN(numLng);

    const isFromMapsSection = activeSection === 'maps';
    savePlaceAdminOverride(newId, {
      sectorTag: newPlaceForm.sectorTag,
      mapCategory: newPlaceForm.mapCategory,
      ...(hasCoords
        ? {
            lat: Number(numLat!.toFixed(6)),
            lng: Number(numLng!.toFixed(6)),
            coordinateVerified: true,
            coordinateSource: 'admin_verified',
          }
        : {}),
      ...(!isSuperAdmin
        ? isFromMapsSection
          ? {
              pendingMapApproval: {
                submittedBy: roleInfo.identifier || 'quanlymaps',
                submittedByName: roleInfo.displayName || 'Quản lý Maps',
                submittedAt: Date.now(),
                actionSummary: 'Thêm địa điểm định vị mới',
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
                actionSummary: 'Thêm quán mới vào hệ thống',
                isNewPlace: true,
              },
            }
        : {}),
    });
    setIsNewPlaceModalOpen(false);
    setRefreshTick(t => t + 1);
    setSelectedPlaceId(newId);
    showToast(
      !isSuperAdmin
        ? `✅ Đã tạo "${created.name}" và đưa vào danh sách chờ Admin duyệt!`
        : hasCoords
        ? `✅ Đã tạo & cắm ghim lên Bản đồ: ${created.name}`
        : `✅ Đã thêm địa điểm mới: ${created.name}`,
      'approve'
    );
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
  const boostedPlacesCount = allPlaces.filter(p => p.priorityBoost > 1).length;

  // ===========================================================================
  // NẾU CHƯA ĐĂNG NHẬP TÀI KHOẢN QUẢN LÝ HOẶC GMAIL ĐƯỢC CẤP QUYỀN -> HIỆN TRANG ĐĂNG NHẬP
  // ===========================================================================
  if (!roleInfo.isAuthenticated) {
    const handleGmailQuickAuth = (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      const cleanEmail = gmailLoginInput.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setLoginError('Vui lòng nhập đúng địa chỉ Gmail đã đăng ký.');
        return;
      }
      const member = adminState.members?.[cleanEmail];
      const isSuperEmail = Boolean(
        adminState.adminEmails?.some(em => em.trim().toLowerCase() === cleanEmail)
      );
      if (!isSuperEmail && (!member || (!member.canManageWeb && !member.canManageMaps && member.status !== 'admin'))) {
        setLoginError(
          'Gmail này chưa được Admin tích cấp quyền Quản lý Web hoặc Quản lý Maps trong bảng Quản lý Thành viên!'
        );
        return;
      }
      saveAuthUser({
        isLoggedIn: true,
        uid: member?.uid || `mgr_${Date.now()}`,
        email: cleanEmail,
        displayName: member?.displayName || member?.nickname || cleanEmail,
        nickname: member?.nickname || member?.displayName || cleanEmail,
        gender: member?.gender || 'male',
        avatar: member?.avatar || '🛡️',
        avatarId: member?.avatarId || 'm_ty',
        hasCompletedProfile: true,
        isFirstTimeSetupDone: true,
        createdAt: member?.createdAt || Date.now(),
      });
      setRefreshTick(t => t + 1);
      showToast(`Xin chào ${member?.nickname || cleanEmail}! Đã xác thực quyền quản lý qua Gmail.`);
    };

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
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '390px',
            background: theme.bgCard,
            borderRadius: '18px',
            border: `1px solid ${theme.border}`,
            padding: '28px 24px 22px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: theme.accentSoft,
                color: theme.accent,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
              }}
            >
              <Shield size={22} />
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Đăng nhập Quản trị
            </h2>
            <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '3px' }}>
              Admin Tối Cao • Quản lý Web • Quản lý Maps
            </div>
          </div>

          <form onSubmit={handleAdminLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={compactLabelStyle(theme)}>Tài khoản Admin / Quản lý</label>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="Nhập tên tài khoản"
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
                  placeholder="Nhập mật khẩu"
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
                fontSize: '12.5px',
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
                style={{ width: '15px', height: '15px', accentColor: theme.accent, cursor: 'pointer' }}
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
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: `1px dashed ${theme.border}`,
            }}
          >
            <form onSubmit={handleGmailQuickAuth} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={compactLabelStyle(theme)}>
                Hoặc vào bằng Gmail đã được Admin cấp quyền Quản lý:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="email"
                  value={gmailLoginInput}
                  onChange={e => setGmailLoginInput(e.target.value)}
                  placeholder="Nhập Gmail của bạn..."
                  style={{ ...compactInputStyle(theme), flex: 1 }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '0 13px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.accentBorder}`,
                    background: theme.accentSoft,
                    color: theme.accent,
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Vào ngay
                </button>
              </div>
            </form>
          </div>
        </div>
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
      {/* TOAST THÔNG BÁO NỔI GIỮA ĐỈNH MÀN HÌNH — LUÔN NHÌN THẤY RÕ RÀNG */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100005,
            background: '#18181B',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '999px',
            boxShadow: '0 14px 36px rgba(0,0,0,0.28)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            fontWeight: 800,
            border: '2px solid #10B981',
            maxWidth: '92vw',
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#10B981', flexShrink: 0 }} />
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
                            ? `${allPlaces.length} • ${pendingWebPlaces.length} duyệt`
                            : String(allPlaces.length),
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
                            ? `${allPlaces.length} • ${pendingMapPlaces.length} duyệt`
                            : String(allPlaces.length),
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
        <main className="xh-admin-main">
          {/* =================================================================== */}
          {/* 1. TỔNG QUAN                                                        */}
          {/* =================================================================== */}
          {activeSection === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="xh-overview-cards">
                {[
                  {
                    label: 'Tổng số Quán (A-Z)',
                    val: allPlaces.length,
                    sub: `${allPlaces.filter(p => p.status === 'active').length} quán đang mở`,
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
                  Phân khu Địa điểm tại Xuân Hòa (Bấm vào để lọc ngay trong Quản lý Quán)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {sectorTags.map(sec => {
                    const cnt = allPlaces.filter(p => p.sectorTag === sec.id).length;
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
                      Danh sách ({allPlaces.length})
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
                      onClick={() => setIsNewPlaceModalOpen(true)}
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
                        {sectorTags.map(sec => {
                          const cnt = allPlaces.filter(p => p.sectorTag === sec.id).length;
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
                        <option value="active">Đang mở ({allPlaces.filter(p => p.status === 'active').length})</option>
                        <option value="boosted">★ Ưu tiên ({boostedPlacesCount})</option>
                        <option value="locked">Tạm khóa ({allPlaces.filter(p => p.status === 'locked').length})</option>
                        {isSuperAdmin && (
                          <option value="deleted">Đã xóa ({allPlaces.filter(p => p.status === 'deleted').length})</option>
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
                              ? '1px solid #F59E0B'
                              : `1px solid ${theme.border}`,
                            background: isSelected
                              ? theme.accentSoft
                              : pendingWeb
                              ? 'rgba(254, 243, 199, 0.45)'
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
                                    background: '#FEF3C7',
                                    color: '#B45309',
                                    border: '1px solid #FCD34D',
                                  }}
                                >
                                  Chờ duyệt
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
                            {item.place.phone && (
                              <>
                                <span>•</span>
                                <span>{item.place.phone}</span>
                              </>
                            )}
                          </div>

                          {pendingWeb && (
                            <div style={{ marginTop: '4px', fontSize: '10.5px', fontWeight: 700, color: '#B45309' }}>
                              📝 {pendingWeb.submittedByName}: {pendingWeb.actionSummary}
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
                      return (
                        <div
                          style={{
                            padding: '11px 13px',
                            borderRadius: '10px',
                            background: '#FFFBEB',
                            border: '1.5px solid #F59E0B',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#B45309' }}>
                              ⏳ Đang chờ Admin duyệt thay đổi Quán
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#92400E', marginTop: '2px' }}>
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
                                  showToast(`✅ Đã duyệt chính thức quán "${selectedPlaceItem.place.name}"!`, 'approve');
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
                                ✓ Duyệt Quán
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  rejectPendingPlaceItem(selectedPlaceItem.place.id, 'web');
                                  setRefreshTick(t => t + 1);
                                  showToast(`Đã từ chối bản cập nhật của "${selectedPlaceItem.place.name}"`, 'warn');
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
                              <Lock size={12} /> Chờ Admin duyệt (Đã khóa với Quản lý)
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* THANH TIÊU ĐỀ CỘT 2: TÊN QUÁN + TẦN SUẤT + BLOCK (TẠM KHÓA) + XÓA (CHỈ ADMIN) + LƯU */}
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

                        {/* NÚT XÓA: CHỈ SUPER ADMIN MỚI CÓ QUYỀN XÓA */}
                        {isSuperAdmin ? (
                          <button
                            onClick={() => {
                              savePlaceAdminOverride(
                                selectedPlaceItem.place.id,
                                { status: 'deleted' },
                                'Xóa quán khỏi hệ thống'
                              );
                              setRefreshTick(t => t + 1);
                              showToast('Đã xóa quán khỏi hệ thống');
                            }}
                            style={{
                              ...actionBtnStyle(theme, false),
                              padding: '6px 10px',
                              fontSize: '11.5px',
                              color: '#B91C1C',
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Xóa</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '5px 8px',
                              borderRadius: '7px',
                              background: theme.bgElevated,
                              border: `1px solid ${theme.border}`,
                              color: theme.textMuted,
                            }}
                            title="Quản lý Web chỉ có quyền thêm/sửa và Block, không có quyền Xóa"
                          >
                            🔒 Xóa: Chỉ Admin
                          </span>
                        )}

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

                      {/* PHÂN KHU NGÀNH NGHỀ */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
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
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            {isAddingSectorInline ? 'Đóng' : '+ Thêm mới'}
                          </button>
                        </div>

                        {!isAddingSectorInline ? (
                          <select
                            value={editPlaceSectorTag}
                            onChange={e => setEditPlaceSectorTag(e.target.value)}
                            style={{ ...lightSelectStyle(theme), padding: '8px 10px', fontSize: '12.5px' }}
                          >
                            {sectorTags.map(sec => (
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
                                padding: '0 10px',
                                borderRadius: '8px',
                                border: 'none',
                                background: theme.accent,
                                color: '#FFF',
                                fontSize: '11.5px',
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
                          style={{ ...lightSelectStyle(theme), padding: '8px 10px', fontSize: '12.5px' }}
                        >
                          <option value="both">Ăn tại quán & Có nhận Ship</option>
                          <option value="dine_in_only">Chỉ phục vụ tại quán</option>
                          <option value="delivery_only">Chỉ giao hàng (Ship)</option>
                        </select>
                      </div>
                    </div>

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
          )}

          {/* =================================================================== */}
          {/* 2B. QUẢN LÝ MAPS — BỐ CỤC 3 CỘT ĐỒNG BỘ:                            */}
          {/*     CỘT 1 (DANH SÁCH & DUYỆT MAPS) | CỘT 2 (THÔNG TIN ĐỊNH VỊ) |    */}
          {/*     CỘT 3 (SA BÀN CHẤM TỌA ĐỘ TRỰC QUAN & ĐỐI CHIẾU LÂN CẬN)        */}
          {/* =================================================================== */}
          {activeSection === 'maps' && canManageMaps && (
            <div className="xh-three-col-layout">
              {/* CỘT 1: DANH SÁCH ĐỊA ĐIỂM MAPS + TAB DUYỆT MAPS */}
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
                  {/* NÚT CHUYỂN TAB TRÊN ĐẦU CỘT 1: ĐỊA ĐIỂM MAPS | DUYỆT MAPS */}
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
                      onClick={() => setMapListTab('all')}
                      style={{
                        padding: '7px 8px',
                        borderRadius: '7px',
                        border: 'none',
                        background: mapListTab === 'all' ? theme.bgCard : 'transparent',
                        color: mapListTab === 'all' ? theme.textPrimary : theme.textMuted,
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                        boxShadow: mapListTab === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      Địa điểm ({allPlaces.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapListTab('pending_maps')}
                      style={{
                        padding: '7px 8px',
                        borderRadius: '7px',
                        border: 'none',
                        background:
                          mapListTab === 'pending_maps'
                            ? '#FEF3C7'
                            : pendingMapPlaces.length > 0
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'transparent',
                        color:
                          mapListTab === 'pending_maps' || pendingMapPlaces.length > 0
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
                      <span>Duyệt Maps ({pendingMapPlaces.length})</span>
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
                      {mapListTab === 'pending_maps'
                        ? `Chờ duyệt Maps (${filteredMapPlaces.length})`
                        : `Định vị Maps (${filteredMapPlaces.length})`}
                    </span>
                    <button
                      onClick={() => setIsNewPlaceModalOpen(true)}
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
                      <Plus size={13} /> Thêm Định Vị
                    </button>
                  </div>

                  {/* TÌM ĐỊA ĐIỂM TRÊN MAPS */}
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
                      value={mapSearch}
                      onChange={e => setMapSearch(e.target.value)}
                      placeholder="Tìm địa điểm, đường phố..."
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        width: '100%',
                        fontSize: '12px',
                        color: theme.textPrimary,
                      }}
                    />
                  </div>

                  {mapListTab === 'all' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                      <select
                        value={mapCatFilter}
                        onChange={e => setMapCatFilter(e.target.value)}
                        style={{ ...lightSelectStyle(theme), fontSize: '11.5px', padding: '5px 7px' }}
                      >
                        <option value="all">Mọi nhóm bản đồ</option>
                        {EDITABLE_MAP_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={mapCoordFilter}
                        onChange={e => setMapCoordFilter(e.target.value as any)}
                        style={{ ...lightSelectStyle(theme), fontSize: '11.5px', padding: '5px 7px' }}
                      >
                        <option value="all">Mọi tọa độ</option>
                        <option value="verified">📍 Đã ghim chuẩn</option>
                        <option value="unverified">⏳ Chưa có tọa độ</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* DANH SÁCH ĐỊA ĐIỂM TRONG QUẢN LÝ MAPS */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {filteredMapPlaces.length === 0 ? (
                    <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '12px', color: theme.textMuted }}>
                      {mapListTab === 'pending_maps'
                        ? 'Hiện không có vị trí nào chờ Admin duyệt.'
                        : 'Không tìm thấy địa điểm phù hợp.'}
                    </div>
                  ) : (
                    filteredMapPlaces.map(item => {
                      const isSelected = selectedPlaceId === item.place.id;
                      const ov = adminState.places?.[item.place.id];
                      const hasCoords =
                        Boolean(ov?.coordinateVerified) &&
                        typeof ov?.lat === 'number' &&
                        typeof ov?.lng === 'number';
                      const pendingMap = ov?.pendingMapApproval;
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
                              : pendingMap
                              ? '1px solid #F59E0B'
                              : `1px solid ${theme.border}`,
                            background: isSelected
                              ? theme.accentSoft
                              : pendingMap
                              ? 'rgba(254, 243, 199, 0.45)'
                              : theme.bgElevated,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: theme.textPrimary }}>
                              {item.place.name}
                            </span>
                            {pendingMap ? (
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: '#FEF3C7',
                                  color: '#B45309',
                                }}
                              >
                                Chờ duyệt
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: hasCoords ? '#047857' : '#B45309',
                                }}
                              >
                                {hasCoords ? '📍 Đã ghim' : '⏳ Chưa ghim'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '3px' }}>
                            {item.place.address || 'P. Xuân Hòa'}
                          </div>
                          {pendingMap && (
                            <div style={{ marginTop: '4px', fontSize: '10.5px', fontWeight: 700, color: '#B45309' }}>
                              📍 {pendingMap.submittedByName}: {pendingMap.actionSummary}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* CỘT 2: THÔNG TIN ĐỊNH VỊ & TỌA ĐỘ MAPS */}
              {selectedPlaceItem ? (
                <div
                  className={`xh-col-middle-pane ${!mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  <div
                    style={{
                      background: theme.bgCard,
                      borderRadius: '14px',
                      border: `1px solid ${theme.border}`,
                      boxShadow: theme.shadow,
                      padding: '16px 18px',
                    }}
                  >
                    {/* KHUNG DUYỆT MAPS (CHỈ ADMIN ĐƯỢC DUYỆT, QUẢN LÝ MAPS BỊ KHÓA) */}
                    {(() => {
                      const ov = adminState.places?.[selectedPlaceItem.place.id];
                      const pending = ov?.pendingMapApproval;
                      if (!pending) return null;
                      return (
                        <div
                          style={{
                            padding: '11px 13px',
                            borderRadius: '10px',
                            background: '#FFFBEB',
                            border: '1.5px solid #F59E0B',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#B45309' }}>
                              ⏳ Đang chờ Admin duyệt Định vị Bản đồ số
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#92400E', marginTop: '2px' }}>
                              Người gửi: <strong>{pending.submittedByName}</strong> ({pending.submittedBy}) •{' '}
                              {pending.actionSummary}
                            </div>
                          </div>

                          {isSuperAdmin ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  approvePendingPlaceItem(selectedPlaceItem.place.id, 'maps');
                                  setRefreshTick(t => t + 1);
                                  showToast(`✅ Đã duyệt định vị "${selectedPlaceItem.place.name}"!`, 'approve');
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
                                ✓ Duyệt Maps
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  rejectPendingPlaceItem(selectedPlaceItem.place.id, 'maps');
                                  setRefreshTick(t => t + 1);
                                  showToast(`Đã hoàn tác định vị của "${selectedPlaceItem.place.name}"`, 'warn');
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
                              <Lock size={12} /> Chờ Admin duyệt (Đã khóa với Quản lý)
                            </span>
                          )}
                        </div>
                      );
                    })()}

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
                      <span style={{ fontSize: '15px', fontWeight: 800 }}>
                        2. Thông tin Định vị Bản đồ
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {/* NÚT BLOCK (TẠM KHÓA) TRÊN MAPS */}
                        <button
                          onClick={() => {
                            const nextStatus = selectedPlaceItem.status === 'active' ? 'locked' : 'active';
                            savePlaceAdminOverride(
                              selectedPlaceItem.place.id,
                              { status: nextStatus },
                              nextStatus === 'locked' ? 'Block địa điểm trên Maps' : 'Mở khóa địa điểm Maps'
                            );
                            setRefreshTick(t => t + 1);
                            showToast(nextStatus === 'locked' ? 'Đã Block địa điểm' : 'Đã mở khóa địa điểm');
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

                        {isSuperAdmin ? (
                          <button
                            onClick={() => {
                              savePlaceAdminOverride(
                                selectedPlaceItem.place.id,
                                { status: 'deleted' },
                                'Xóa địa điểm khỏi Maps'
                              );
                              setRefreshTick(t => t + 1);
                              showToast('Đã xóa địa điểm khỏi bản đồ');
                            }}
                            style={{
                              ...actionBtnStyle(theme, false),
                              padding: '6px 10px',
                              fontSize: '11.5px',
                              color: '#B91C1C',
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Xóa</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '5px 8px',
                              borderRadius: '7px',
                              background: theme.bgElevated,
                              border: `1px solid ${theme.border}`,
                              color: theme.textMuted,
                            }}
                          >
                            🔒 Xóa: Chỉ Admin
                          </span>
                        )}

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
                          <span>{justSavedPlace ? 'Đã Lưu' : 'Lưu Định Vị'}</span>
                        </button>
                      </div>
                    </div>

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
                            const nextCat = e.target.value as EditableMapCategory;
                            setEditPlaceMapCategory(nextCat);
                            if (nextCat === 'public' || nextCat === 'school') {
                              setEditPlaceSectorTag('dia-danh');
                            }
                          }}
                          style={{ ...lightSelectStyle(theme), height: '36px', fontWeight: 700 }}
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
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      <div className="xh-col-span-2">
                        <label style={compactLabelStyle(theme)}>Địa chỉ chi tiết</label>
                        <input
                          type="text"
                          value={editPlaceAddress}
                          onChange={e => setEditPlaceAddress(e.target.value)}
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      <div className="xh-col-span-2">
                        <label style={compactLabelStyle(theme)}>
                          Dán link Google Maps, Plus Code (VD: 7PQ6+VFP) hoặc tìm tọa độ tự động
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            value={editPlaceMapsUrl || editPlaceMapsQuery}
                            onChange={e => {
                              const val = e.target.value;
                              if (val.startsWith('http')) setEditPlaceMapsUrl(val);
                              else {
                                setEditPlaceMapsUrl('');
                                setEditPlaceMapsQuery(val);
                              }
                              const parsed = parseCoordinatesFromInputOrUrl(val);
                              if (parsed) {
                                setEditPlaceLat(String(parsed.lat));
                                setEditPlaceLng(String(parsed.lng));
                              }
                            }}
                            placeholder="Dán link Google Maps, Plus Code hoặc tọa độ..."
                            style={{ ...compactInputStyle(theme), flex: 1 }}
                          />
                          <button
                            type="button"
                            disabled={isAdminGeocoding}
                            onClick={async () => {
                              const rawQ = (
                                editPlaceMapsUrl ||
                                editPlaceMapsQuery ||
                                editPlaceAddress ||
                                editPlaceName
                              ).trim();
                              const direct = parseCoordinatesFromInputOrUrl(rawQ);
                              if (direct) {
                                setEditPlaceLat(String(direct.lat));
                                setEditPlaceLng(String(direct.lng));
                                showToast(`📍 Đã trích xuất tọa độ: ${direct.lat}, ${direct.lng}`);
                                return;
                              }
                              setIsAdminGeocoding(true);
                              try {
                                const results = await geocodeAddressWithNominatim(
                                  `${editPlaceAddress || editPlaceName}, Xuân Hòa, Phúc Yên`
                                );
                                if (results.length > 0) {
                                  setEditPlaceLat(String(results[0].lat));
                                  setEditPlaceLng(String(results[0].lng));
                                  showToast(`📍 Đã tìm thấy tọa độ: ${results[0].lat}, ${results[0].lng}`);
                                } else {
                                  const road = findSuggestedRoadForAddress(
                                    `${editPlaceAddress} ${editPlaceName}`,
                                    VERIFIED_OSM_ROADS_SEED
                                  );
                                  if (road) {
                                    setEditPlaceLat(String(Number(road.lat.toFixed(6))));
                                    setEditPlaceLng(String(Number(road.lng.toFixed(6))));
                                    showToast(`📍 Định vị theo đường ${road.name}`);
                                  } else {
                                    showToast('Chưa tìm thấy tự động — hãy chấm trực tiếp ở Cột 3 bên phải', 'warn');
                                  }
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
                              height: '36px',
                            }}
                          >
                            <MapPin size={13} />
                            <span>{isAdminGeocoding ? 'Đang tìm...' : 'Tìm tọa độ'}</span>
                          </button>
                        </div>
                      </div>

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

              {/* CỘT 3 CỦA QUẢN LÝ MAPS: SA BÀN TỌA ĐỘ TƯƠNG TÁC & ĐỐI CHIẾU LÂN CẬN */}
              {selectedPlaceItem ? (
                <div
                  className={`xh-col-right-pane ${!mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                  style={{
                    background: theme.bgCard,
                    borderRadius: '14px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '10px',
                      borderBottom: `1px solid ${theme.border}`,
                    }}
                  >
                    <span style={{ fontSize: '14.5px', fontWeight: 800 }}>
                      3. Sa bàn Tọa độ & Đối chiếu
                    </span>
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
                        ...smallRowBtnStyle(theme),
                        background: theme.accentSoft,
                        color: theme.accent,
                        borderColor: theme.accentBorder,
                      }}
                    >
                      <MapPin size={12} /> Mở Bản đồ Số
                    </button>
                  </div>

                  {/* KHUNG CHẤM TỌA ĐỘ NHANH TRỰC QUAN TRONG CỘT 3 */}
                  {(() => {
                    const minLat = 21.278;
                    const maxLat = 21.302;
                    const minLng = 105.698;
                    const maxLng = 105.726;
                    const curLat = Number(editPlaceLat) || 21.2897;
                    const curLng = Number(editPlaceLng) || 105.7112;
                    const pctX = Math.max(4, Math.min(96, ((curLng - minLng) / (maxLng - minLng)) * 100));
                    const pctY = Math.max(4, Math.min(96, ((maxLat - curLat) / (maxLat - minLat)) * 100));

                    return (
                      <div>
                        <div style={{ fontSize: '11.5px', color: theme.textSecondary, marginBottom: '6px' }}>
                          Bấm trực tiếp lên khung lưới tọa độ Xuân Hòa bên dưới để dời ghim nhanh:
                        </div>
                        <div
                          onClick={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const rx = (e.clientX - rect.left) / rect.width;
                            const ry = (e.clientY - rect.top) / rect.height;
                            const nextLng = Number((minLng + rx * (maxLng - minLng)).toFixed(6));
                            const nextLat = Number((maxLat - ry * (maxLat - minLat)).toFixed(6));
                            setEditPlaceLat(String(nextLat));
                            setEditPlaceLng(String(nextLng));
                            showToast(`📍 Đã chấm tọa độ: ${nextLat}, ${nextLng} (Bấm Lưu Định Vị để áp dụng)`);
                          }}
                          style={{
                            position: 'relative',
                            height: '190px',
                            borderRadius: '12px',
                            border: `1.5px solid ${theme.accentBorder}`,
                            background:
                              'radial-gradient(circle at 50% 50%, #F0FDF4 0%, #E0F2FE 100%)',
                            cursor: 'crosshair',
                            overflow: 'hidden',
                          }}
                        >
                          {/* LƯỚI TỌA ĐỘ TRỰC QUAN */}
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundImage:
                                'linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)',
                              backgroundSize: '24px 24px',
                            }}
                          />
                          {/* TRỤC ĐHSP2 MỐC TRUNG TÂM */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '48%',
                              top: '51%',
                              transform: 'translate(-50%, -50%)',
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#0369A1',
                              background: 'rgba(255,255,255,0.85)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              pointerEvents: 'none',
                            }}
                          >
                            🎓 Tâm ĐHSP2
                          </div>

                          {/* GHIM HIỆN TẠI */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${pctX}%`,
                              top: `${pctY}%`,
                              transform: 'translate(-50%, -100%)',
                              pointerEvents: 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                background: '#18181B',
                                color: '#FFF',
                                padding: '2px 6px',
                                borderRadius: '5px',
                                whiteSpace: 'nowrap',
                                marginBottom: '2px',
                              }}
                            >
                              {editPlaceName}
                            </span>
                            <MapPin size={22} style={{ color: '#DC2626', fill: '#FEE2E2' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* DANH SÁCH ĐỊA ĐIỂM LÂN CẬN ĐỂ KIỂM TRA TRÙNG LẶP GHIM */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: theme.bgElevated,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>
                      Các điểm đã ghim gần vị trí này:
                    </div>
                    {(() => {
                      const curLat = Number(editPlaceLat);
                      const curLng = Number(editPlaceLng);
                      if (!curLat || !curLng) {
                        return (
                          <div style={{ fontSize: '11.5px', color: theme.textMuted }}>
                            Chưa có tọa độ Lat/Lng để đối chiếu khoảng cách lân cận.
                          </div>
                        );
                      }
                      const nearby = allPlaces
                        .filter(p => p.place.id !== selectedPlaceItem.place.id)
                        .map(p => {
                          const ov = adminState.places?.[p.place.id];
                          if (typeof ov?.lat !== 'number' || typeof ov?.lng !== 'number') return null;
                          const distMeters = Math.round(
                            Math.hypot((ov.lat - curLat) * 111320, (ov.lng - curLng) * 103000)
                          );
                          return { name: p.place.name, distMeters, lat: ov.lat, lng: ov.lng };
                        })
                        .filter((x): x is NonNullable<typeof x> => Boolean(x))
                        .sort((a, b) => a.distMeters - b.distMeters)
                        .slice(0, 4);

                      if (nearby.length === 0) {
                        return (
                          <div style={{ fontSize: '11.5px', color: theme.textMuted }}>
                            Chưa có địa điểm lân cận nào khác.
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {nearby.map((nb, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '11.5px',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                background: theme.bgCard,
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{nb.name}</span>
                              <span style={{ color: theme.accent, fontWeight: 800 }}>~{nb.distMeters}m</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : null}
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
        </main>
      </div>

      {/* ======================================================================= */}
      {/* Ô CÀI ĐẶT GÓC PHẢI — SIÊU GỌN: MÀU SẮC SỔ RA 3 MÀU NGANG HÀNG CỠ CHỮ   */}
      {/* ======================================================================= */}
      {isSettingsModalOpen && (
        <div className="xh-modal-backdrop" onClick={() => setIsSettingsModalOpen(false)}>
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

              {/* HÀNG 4: TÀI KHOẢN HIỆN TẠI & NÚT THOÁT (ĐĂNG XUẤT) ĐƯỢC GOM VÀO CÀI ĐẶT */}
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
        <div className="xh-modal-backdrop" onClick={() => setIsAdminAccModalOpen(false)}>
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

      {/* MODAL THÊM QUÁN MỚI */}
      {isNewPlaceModalOpen && (
        <div className="xh-modal-backdrop" onClick={() => setIsNewPlaceModalOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '16px',
              border: `1px solid ${theme.border}`,
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800 }}>
              Thêm Quán / Địa Điểm Mới
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={compactLabelStyle(theme)}>Tên quán *</label>
                <input
                  type="text"
                  value={newPlaceForm.name}
                  onChange={e => setNewPlaceForm({ ...newPlaceForm, name: e.target.value })}
                  placeholder="VD: Lẩu Nướng Cô Ba / Bi-a Club..."
                  style={compactInputStyle(theme)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={compactLabelStyle(theme)}>Phân khu quản lý</label>
                  <select
                    value={newPlaceForm.sectorTag}
                    onChange={e => setNewPlaceForm({ ...newPlaceForm, sectorTag: e.target.value })}
                    style={{ ...lightSelectStyle(theme), padding: '8px 11px' }}
                  >
                    {sectorTags.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={compactLabelStyle(theme)}>Biểu tượng Bản đồ (Icon)</label>
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
                            : newPlaceForm.sectorTag,
                      });
                    }}
                    style={{ ...lightSelectStyle(theme), padding: '8px 11px' }}
                  >
                    {EDITABLE_MAP_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
                  <label style={compactLabelStyle(theme)}>Giờ mở cửa</label>
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
                      setNewPlaceForm({
                        ...newPlaceForm,
                        mapsUrl: val,
                        lat: parsed ? String(parsed.lat) : newPlaceForm.lat,
                        lng: parsed ? String(parsed.lng) : newPlaceForm.lng,
                      });
                    }}
                    placeholder="Dán link Maps, Plus Code (7PQ6+VFP) hoặc 21.289, 105.711..."
                    style={{ ...compactInputStyle(theme), flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const q = (newPlaceForm.mapsUrl || newPlaceForm.address || newPlaceForm.name).trim();
                      const direct = parseCoordinatesFromInputOrUrl(q);
                      if (direct) {
                        setNewPlaceForm({
                          ...newPlaceForm,
                          lat: String(direct.lat),
                          lng: String(direct.lng),
                        });
                        showToast(`📍 Đã lấy tọa độ: ${direct.lat}, ${direct.lng}`);
                        return;
                      }
                      const res = await geocodeAddressWithNominatim(`${q}, Xuân Hòa, Phúc Yên`);
                      if (res.length > 0) {
                        setNewPlaceForm({
                          ...newPlaceForm,
                          lat: String(res[0].lat),
                          lng: String(res[0].lng),
                        });
                        showToast(`📍 Đã tìm thấy tọa độ: ${res[0].lat}, ${res[0].lng}`);
                      } else {
                        const road = findSuggestedRoadForAddress(q, VERIFIED_OSM_ROADS_SEED);
                        if (road) {
                          setNewPlaceForm({
                            ...newPlaceForm,
                            lat: String(Number(road.lat.toFixed(6))),
                            lng: String(Number(road.lng.toFixed(6))),
                          });
                          showToast(`📍 Định vị theo đường ${road.name}`);
                        } else {
                          showToast('Không tìm thấy tự động — hãy nhập Plus Code hoặc Vĩ độ/Kinh độ', 'warn');
                        }
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
                Tạo Quán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẠO NICK PHỤ ĐÁNH GIÁ */}
      {isAddSeederModalOpen && (
        <div className="xh-modal-backdrop" onClick={() => setIsAddSeederModalOpen(false)}>
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
          background-color: ${theme.bgInput};
          color: ${theme.textPrimary};
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
        /* BỐ CỤC 3 CỘT CHO QUẢN LÝ QUÁN VÀ QUẢN LÝ MAPS */
        .xh-three-col-layout {
          display: grid;
          grid-template-columns: 295px minmax(350px, 1.15fr) minmax(320px, 1fr);
          gap: 14px;
          align-items: start;
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
          height: calc(100vh - 86px);
          position: sticky;
          top: 68px;
          align-self: start;
        }
        .xh-col-right-pane {
          position: sticky;
          top: 68px;
          align-self: start;
        }
        .xh-compact-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 12px;
        }
        .xh-col-span-2 {
          grid-column: span 2;
        }
        .xh-overview-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        @media (max-width: 1180px) {
          .xh-three-col-layout {
            grid-template-columns: 280px 1fr;
          }
          .xh-col-right-pane {
            grid-column: 2;
            position: static;
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
    fontWeight: 700,
    color: theme.textSecondary,
    marginBottom: '4px',
  };
}

function compactInputStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 11px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.bgInput,
    color: theme.textPrimary,
    fontSize: '13px',
    fontWeight: 500,
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
