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
  updateAdminSystemSettings,
  getAdminAccounts,
  getLoggedAdminSession,
  loginAdminWithCredentials,
  logoutAdminSession,
  upsertAdminAccount,
  deleteAdminAccount,
} from '@/lib/admin-store';
import { UserAuthProfile } from '@/lib/auth';
import { Place } from '@/lib/places-xuanhoa';

interface AdminDashboardViewProps {
  authUser: UserAuthProfile | null;
  onBack: () => void;
  onOpenAuthModal?: () => void;
}

type AdminSection = 'overview' | 'places' | 'members' | 'reviews' | 'logs';

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

  // Mặc định vào Quản lý Quán (hoặc Tổng quan)
  const [activeSection, setActiveSection] = useState<AdminSection>('places');
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

  // Quản lý Quán (Cột 2 & Cột 3 cao bằng nhau, xếp A-Z, 2 ô lọc sổ xuống ngang hàng)
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeSectorFilter, setPlaceSectorFilter] = useState<string>('all');
  const [placeStatusFilter, setPlaceStatusFilter] = useState<'all' | 'active' | 'boosted' | 'locked' | 'deleted'>('all');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [mobileShowDetailPane, setMobileShowDetailPane] = useState(false);

  // Thêm nhanh phân khu ngành nghề ngay trong cài đặt của Quán
  const [isAddingSectorInline, setIsAddingSectorInline] = useState(false);
  const [inlineSectorLabel, setInlineSectorLabel] = useState('');

  // Thu gọn / Mở rộng phần thông tin phụ của quán
  const [showAdvancedPlaceFields, setShowAdvancedPlaceFields] = useState(false);

  // Thông tin chính của Quán
  const [editPlaceName, setEditPlaceName] = useState('');
  const [editPlacePhone, setEditPlacePhone] = useState('');
  const [editPlaceHours, setEditPlaceHours] = useState('');
  const [editPlaceAddress, setEditPlaceAddress] = useState('');
  const [editPlaceMapsUrl, setEditPlaceMapsUrl] = useState('');
  const [editPlaceMapsQuery, setEditPlaceMapsQuery] = useState('');
  const [editPlaceSectorTag, setEditPlaceSectorTag] = useState('an-chinh');
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

  // Modal tạo Quán mới
  const [isNewPlaceModalOpen, setIsNewPlaceModalOpen] = useState(false);
  const [newPlaceForm, setNewPlaceForm] = useState({
    name: '',
    sectorTag: 'an-chinh',
    phone: '',
    openHours: '07:00 - 22:00',
    address: 'P. Xuân Hòa, Phúc Yên, Vĩnh Phúc',
    mapsUrl: '',
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
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  useEffect(() => {
    seedDemoMembersIfEmpty();
    const onSync = () => setRefreshTick(t => t + 1);
    window.addEventListener('xuanhoa_admin_sync', onSync);
    return () => window.removeEventListener('xuanhoa_admin_sync', onSync);
  }, []);

  const adminState = useMemo(() => getAdminState(), [refreshTick]);
  const adminAccounts = useMemo(() => getAdminAccounts(), [refreshTick]);
  const allPlaces = useMemo(() => getAllManagedPlaces(), [refreshTick]);
  const allDishes = useMemo(() => getAllManagedDishes(), [refreshTick]);
  const allReviews = useMemo(() => getAllSystemReviews(), [refreshTick]);
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

  // Lọc và sắp xếp danh sách quán theo đúng bảng chữ cái A -> B -> C -> D
  const filteredPlaces = useMemo(() => {
    const q = placeSearch.trim().toLowerCase();
    const list = allPlaces.filter(item => {
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
  }, [allPlaces, placeSearch, placeSectorFilter, placeStatusFilter]);

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

  // Xử lý đăng nhập Admin
  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const res = loginAdminWithCredentials(loginUsername, loginPassword, loginRememberMe);
    if (!res.ok || !res.account) {
      setLoginError(res.message || 'Sai tên đăng nhập hoặc mật khẩu');
      return;
    }
    setLoggedAdmin(res.account);
    setLoginPassword('');
    showToast(`Xin chào ${res.account.displayName}!`);
  };

  const handleAdminLogout = () => {
    logoutAdminSession();
    setLoggedAdmin(null);
    showToast('Đã đăng xuất khỏi tài khoản Quản trị');
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

    savePlaceAdminOverride(
      selectedPlaceItem.place.id,
      {
        name: editPlaceName.trim() || selectedPlaceItem.place.name,
        tagline: editPlaceTagline.trim(),
        sectorTag: editPlaceSectorTag,
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
      },
      toastLabel || `Cập nhật quán "${editPlaceName}"`
    );
    setRefreshTick(t => t + 1);
    showToast(toastLabel || `Đã lưu cập nhật quán "${editPlaceName}"`);
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
        : `Đã bật Ưu tiên x${nextBoost} (Quán & Món sẽ xuất hiện nhiều hơn gấp ${nextBoost} lần)`
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
      showToast('Vui lòng nhập tên món mới');
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
    handleSavePlaceAndMenu(nextMenu, `Đã thêm món "${newEntry.name}" (${priceNum}k)`);
  };

  const handleToggleLockDishInPlace = (idx: number) => {
    const next = [...editPlaceMenu];
    next[idx] = { ...next[idx], isLocked: !next[idx].isLocked };
    setEditPlaceMenu(next);
    handleSavePlaceAndMenu(
      next,
      `${next[idx].isLocked ? 'Tạm hết món' : 'Mở bán lại'}: "${next[idx].name}"`
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
    savePlaceAdminOverride(newId, { sectorTag: newPlaceForm.sectorTag });
    setIsNewPlaceModalOpen(false);
    setRefreshTick(t => t + 1);
    setSelectedPlaceId(newId);
    showToast(`Đã thêm quán mới: ${created.name}`);
  };

  const handleSaveAdminAccount = () => {
    if (!adminAccForm.username.trim() || !adminAccForm.password.trim()) {
      showToast('Vui lòng nhập đầy đủ Tên đăng nhập (Nick) và Mật khẩu');
      return;
    }
    upsertAdminAccount({
      id: adminAccForm.id || undefined,
      username: adminAccForm.username,
      password: adminAccForm.password,
      displayName: adminAccForm.displayName || adminAccForm.username,
      role: adminAccForm.role,
    });
    setIsAdminAccModalOpen(false);
    setAdminAccForm({ id: '', username: '', password: '', displayName: '', role: 'manager' });
    setRefreshTick(t => t + 1);
    showToast(`Đã lưu tài khoản quản lý @${adminAccForm.username}`);
  };

  const handleCreateSeederAccount = () => {
    if (!seederForm.nickname.trim()) return;
    const state = getAdminState();
    const emailKey = (
      seederForm.email.trim() ||
      `seeder.${Date.now().toString().slice(-4)}@xuanhoacogi.com`
    ).toLowerCase();

    state.members[emailKey] = {
      uid: `seeder_${Date.now()}`,
      email: emailKey,
      displayName: seederForm.nickname.trim(),
      nickname: seederForm.nickname.trim(),
      avatar: '',
      avatarId: 'm_thin',
      gender: 'male',
      residentType: seederForm.residentType,
      status: 'active',
      spinsCount: 5,
      level: 2,
      reviewsCount: 0,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isTestAccount: true,
    };
    saveAdminState(state);
    setIsAddSeederModalOpen(false);
    setSeederForm({ nickname: '', email: '', residentType: 'student_sp2' });
    setRefreshTick(t => t + 1);
    showToast(`Đã tạo nick đánh giá: ${seederForm.nickname}`);
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
          showToast('Đã khôi phục dữ liệu thành công!');
        } else {
          showToast('File không đúng định dạng sao lưu');
        }
      } catch {
        showToast('Không thể đọc file sao lưu');
      }
    };
    reader.readAsText(file);
  };

  const realMembersCount = allMembers.filter(m => !m.isTestAccount).length;
  const seederMembersCount = allMembers.filter(m => m.isTestAccount).length;
  const boostedPlacesCount = allPlaces.filter(p => p.priorityBoost > 1).length;

  // ===========================================================================
  // NẾU CHƯA ĐĂNG NHẬP TÀI KHOẢN QUẢN LÝ -> HIỆN TRANG ĐĂNG NHẬP ADMIN ĐÀNG HOÀNG
  // ===========================================================================
  if (!loggedAdmin) {
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
            maxWidth: '380px',
            background: theme.bgCard,
            borderRadius: '18px',
            border: `1px solid ${theme.border}`,
            padding: '30px 26px 24px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
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
            <div style={{ fontSize: '12.5px', color: theme.textMuted, marginTop: '3px' }}>
              Xuân Hòa Có Gì
            </div>
          </div>

          <form onSubmit={handleAdminLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={compactLabelStyle(theme)}>Tài khoản</label>
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
                padding: '11px',
                borderRadius: '10px',
                border: 'none',
                background: theme.accent,
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <LogIn size={16} />
              <span>Đăng nhập</span>
            </button>
          </form>
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
      {/* TOAST THÔNG BÁO */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 99999,
            background: '#18181B',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '10px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600,
            borderLeft: `4px solid ${theme.accent}`,
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#10B981', flexShrink: 0 }} />
          <span>{toast}</span>
        </div>
      )}

      {/* TOPBAR TRÊN CÙNG */}
      <header
        className="xh-admin-topbar"
        style={{
          background: theme.bgSidebar,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              }}
            >
              <Shield size={16} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 800 }}>QUẢN TRỊ XUÂN HÒA CÓ GÌ</span>
              <span
                className="xh-hide-mobile"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: theme.accentSoft,
                  color: theme.accent,
                }}
              >
                Hệ thống Quản lý Độc lập
              </span>
            </div>
          </div>
        </div>

        {/* GÓC PHẢI: NICK ĐANG ĐĂNG NHẬP + NÚT ĐĂNG XUẤT + NÚT CÀI ĐẶT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            className="xh-hide-mobile"
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
            <span>{loggedAdmin.displayName}</span>
            <span style={{ color: theme.textMuted, fontWeight: 500 }}>(@{loggedAdmin.username})</span>
          </div>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              background: theme.bgElevated,
              color: theme.textPrimary,
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Settings size={15} style={{ color: theme.accent }} />
            <span>Cài đặt</span>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: theme.dotColor,
              }}
            />
          </button>

          <button
            onClick={handleAdminLogout}
            title="Đăng xuất khỏi trang Quản trị"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 10px',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              background: theme.bgElevated,
              color: '#B91C1C',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            <span className="xh-hide-mobile">Thoát</span>
          </button>
        </div>
      </header>

      {/* THÂN TRANG: CỘT 1 TRÁI (MENU THEO ĐÚNG THỨ TỰ: TỔNG QUAN - QUẢN LÝ QUÁN - THÀNH VIÊN - ĐÁNH GIÁ - NHẬT KÝ) */}
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
                {
                  id: 'overview',
                  label: 'Tổng quan',
                  icon: Eye,
                },
                {
                  id: 'places',
                  label: 'Quản lý Quán',
                  icon: Store,
                  badge: String(allPlaces.length),
                },
                {
                  id: 'members',
                  label: 'Quản lý Thành viên',
                  icon: Users,
                  badge: String(realMembersCount),
                },
                {
                  id: 'reviews',
                  label: 'Đánh giá & Bình luận',
                  icon: MessageSquare,
                  badge: String(allReviews.length),
                },
                {
                  id: 'logs',
                  label: 'Nhật ký',
                  icon: Activity,
                },
              ] as const
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
          {/* 2. QUẢN LÝ QUÁN (CỘT 2 VÀ CỘT 3 CAO BẰNG NHAU CÂN ĐỐI, XẾP A-Z)      */}
          {/* =================================================================== */}
          {activeSection === 'places' && (
            <div className="xh-places-master-detail">
              {/* CỘT 2: DANH SÁCH QUÁN XẾP THEO CHỮ CÁI A-B-C-D + 2 Ô SỔ XUỐNG NGANG HÀNG */}
              <div
                className={`xh-places-list-pane ${mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                style={{
                  background: theme.bgCard,
                  borderRadius: '14px',
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow,
                }}
              >
                <div style={{ padding: '14px', borderBottom: `1px solid ${theme.border}` }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 800 }}>
                        Danh sách Quán A–Z ({filteredPlaces.length})
                      </span>
                    </div>
                    <button
                      onClick={() => setIsNewPlaceModalOpen(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 11px',
                        borderRadius: '8px',
                        border: 'none',
                        background: theme.accent,
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} /> Thêm Quán
                    </button>
                  </div>

                  {/* Ô TÌM KIẾM NHANH QUÁN HOẶC MÓN */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '8px 11px',
                      borderRadius: '9px',
                      background: theme.bgInput,
                      border: `1px solid ${theme.border}`,
                      marginBottom: '8px',
                    }}
                  >
                    <Search size={14} style={{ color: theme.textMuted, flexShrink: 0 }} />
                    <input
                      type="text"
                      value={placeSearch}
                      onChange={e => setPlaceSearch(e.target.value)}
                      placeholder="Tìm tên quán (A-Z), SĐT, hoặc món ăn..."
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        width: '100%',
                        fontSize: '12.5px',
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <select
                      value={placeSectorFilter}
                      onChange={e => setPlaceSectorFilter(e.target.value)}
                      style={lightSelectStyle(theme)}
                    >
                      <option value="all">Tất cả phân khu ({allPlaces.length})</option>
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
                      style={lightSelectStyle(theme)}
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="active">Đang mở ({allPlaces.filter(p => p.status === 'active').length})</option>
                      <option value="boosted">★ Đang Ưu tiên ({boostedPlacesCount})</option>
                      <option value="locked">Tạm khóa ({allPlaces.filter(p => p.status === 'locked').length})</option>
                      <option value="deleted">Đã ẩn ({allPlaces.filter(p => p.status === 'deleted').length})</option>
                    </select>
                  </div>
                </div>

                {/* DANH SÁCH THẺ QUÁN XẾP THEO A -> B -> C -> D */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {filteredPlaces.map(item => {
                    const isSelected = selectedPlaceId === item.place.id;
                    const matchedDish = getMatchedDishPreview(item);
                    return (
                      <div
                        key={item.place.id}
                        onClick={() => {
                          selectPlaceForEdit(item);
                          setMobileShowDetailPane(true);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          marginBottom: '6px',
                          cursor: 'pointer',
                          border: isSelected
                            ? `1.5px solid ${theme.accent}`
                            : `1px solid ${theme.border}`,
                          background: isSelected ? theme.accentSoft : theme.bgElevated,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: theme.textPrimary }}>
                            {item.place.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {item.priorityBoost > 1 && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: theme.accent,
                                  color: '#FFF',
                                }}
                              >
                                ★ x{item.priorityBoost}
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
                              title={item.status === 'active' ? 'Đang mở' : 'Tạm khóa / Đã ẩn'}
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: '11.5px',
                            color: theme.textMuted,
                            marginTop: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
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

                        {matchedDish && (
                          <div
                            style={{
                              marginTop: '5px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#047857',
                            }}
                          >
                            Khớp món: {matchedDish}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CỘT 3: CHI TIẾT QUÁN & MÓN (CAO CÂN ĐỐI BẰNG CỘT 2) */}
              {selectedPlaceItem ? (
                <div
                  className={`xh-places-detail-pane ${!mobileShowDetailPane ? 'xh-mobile-hidden' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                >
                  <button
                    className="xh-show-mobile-only"
                    onClick={() => setMobileShowDetailPane(false)}
                    style={{
                      display: 'none',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 13px',
                      borderRadius: '9px',
                      border: `1px solid ${theme.border}`,
                      background: theme.bgCard,
                      color: theme.textPrimary,
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeft size={15} /> Danh sách Quán ({filteredPlaces.length})
                  </button>

                  {/* =============================================================== */}
                  {/* KHỐI 1 (Ở TRÊN): THÔNG TIN QUÁN GỌN GÀNG + NÚT ƯU TIÊN XUẤT HIỆN */}
                  {/* =============================================================== */}
                  <div
                    style={{
                      background: theme.bgCard,
                      borderRadius: '14px',
                      border: `1px solid ${theme.border}`,
                      boxShadow: theme.shadow,
                      padding: '18px 20px',
                    }}
                  >
                    {/* THANH TIÊU ĐỀ QUÁN + Ô CHỌN ƯU TIÊN (BOOST) + TẠM KHÓA + LƯU */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        paddingBottom: '12px',
                        borderBottom: `1px solid ${theme.border}`,
                        marginBottom: '14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: 800 }}>
                          {selectedPlaceItem.place.name}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background:
                              selectedPlaceItem.status === 'active'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(245, 158, 11, 0.15)',
                            color:
                              selectedPlaceItem.status === 'active' ? '#047857' : '#B45309',
                          }}
                        >
                          {selectedPlaceItem.status === 'active' ? 'Đang mở' : 'Tạm khóa'}
                        </span>
                      </div>

                      {/* CÁC NÚT ĐIỀU KHIỂN: ĐỘ ƯU TIÊN (BOOST QUÁN & MÓN) + KHÓA + LƯU */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Ô SỔ RA CHỌN MỨC ƯU TIÊN XUẤT HIỆN (QUÁN & MÓN) */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={14} style={{ color: theme.accent }} />
                          <select
                            value={editPlacePriorityBoost}
                            onChange={e => handleChangePriorityBoost(Number(e.target.value) as 1 | 2 | 3)}
                            style={{
                              ...lightSelectStyle(theme),
                              width: 'auto',
                              fontWeight: 700,
                              color: editPlacePriorityBoost > 1 ? theme.accent : theme.textSecondary,
                              borderColor: editPlacePriorityBoost > 1 ? theme.accent : theme.border,
                              backgroundColor: editPlacePriorityBoost > 1 ? theme.accentSoft : theme.bgElevated,
                            }}
                            title="Khi bật Ưu tiên, cả Quán này và các Món ăn của quán đều xuất hiện nhiều hơn trên vòng quay"
                          >
                            <option value={1}>Tần suất: Bình thường (1x)</option>
                            <option value={2}>★ Ưu tiên vừa (x2 Quán & Món)</option>
                            <option value={3}>★★ Ưu tiên cao (x3 Quán & Món)</option>
                          </select>
                        </div>

                        <button
                          onClick={() => {
                            const nextStatus = selectedPlaceItem.status === 'active' ? 'locked' : 'active';
                            savePlaceAdminOverride(
                              selectedPlaceItem.place.id,
                              { status: nextStatus },
                              nextStatus === 'locked' ? 'Tạm khóa quán' : 'Mở khóa quán'
                            );
                            setRefreshTick(t => t + 1);
                            showToast(nextStatus === 'locked' ? 'Đã tạm khóa quán' : 'Đã mở hoạt động quán');
                          }}
                          style={{
                            ...actionBtnStyle(theme, false),
                            color: selectedPlaceItem.status === 'active' ? '#B45309' : '#047857',
                          }}
                        >
                          {selectedPlaceItem.status === 'active' ? <Lock size={13} /> : <Unlock size={13} />}
                          <span>{selectedPlaceItem.status === 'active' ? 'Tạm khóa' : 'Mở lại'}</span>
                        </button>

                        <button
                          onClick={() => {
                            savePlaceAdminOverride(
                              selectedPlaceItem.place.id,
                              { status: 'deleted' },
                              'Ẩn quán'
                            );
                            setRefreshTick(t => t + 1);
                            showToast('Đã ẩn quán khỏi web chính');
                          }}
                          style={{ ...actionBtnStyle(theme, false), color: '#B91C1C' }}
                        >
                          <Trash2 size={13} />
                          <span>Ẩn</span>
                        </button>

                        <button
                          onClick={() => handleSavePlaceAndMenu()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: theme.accent,
                            color: '#FFFFFF',
                            fontSize: '12.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          <Save size={14} />
                          <span>Lưu Thay Đổi</span>
                        </button>
                      </div>
                    </div>

                    {/* THÔNG TIN CHÍNH CỦA QUÁN: TÊN, SĐT, GIỜ MỞ CỬA, ĐỊA CHỈ, MAPS, PHÂN KHU */}
                    <div className="xh-compact-grid">
                      <div>
                        <label style={compactLabelStyle(theme)}>Tên Quán</label>
                        <input
                          type="text"
                          value={editPlaceName}
                          onChange={e => setEditPlaceName(e.target.value)}
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      <div>
                        <label style={compactLabelStyle(theme)}>
                          <Phone size={12} style={{ display: 'inline', marginRight: 4 }} />
                          Số điện thoại liên hệ
                        </label>
                        <input
                          type="text"
                          value={editPlacePhone}
                          onChange={e => setEditPlacePhone(e.target.value)}
                          placeholder="Chưa cập nhật SĐT"
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      <div>
                        <label style={compactLabelStyle(theme)}>
                          <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                          Giờ mở cửa – đóng cửa
                        </label>
                        <input
                          type="text"
                          value={editPlaceHours}
                          onChange={e => setEditPlaceHours(e.target.value)}
                          placeholder="VD: 06:30 - 22:30"
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      <div>
                        <label style={compactLabelStyle(theme)}>
                          <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                          Địa chỉ quán
                        </label>
                        <input
                          type="text"
                          value={editPlaceAddress}
                          onChange={e => setEditPlaceAddress(e.target.value)}
                          style={compactInputStyle(theme)}
                        />
                      </div>

                      {/* ĐỊNH VỊ GOOGLE MAPS */}
                      <div className="xh-col-span-2">
                        <label style={compactLabelStyle(theme)}>
                          Định vị Google Maps (Dán link Maps hoặc địa chỉ tìm kiếm)
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={editPlaceMapsUrl || editPlaceMapsQuery}
                            onChange={e => {
                              const val = e.target.value;
                              if (val.startsWith('http')) {
                                setEditPlaceMapsUrl(val);
                              } else {
                                setEditPlaceMapsUrl('');
                                setEditPlaceMapsQuery(val);
                              }
                            }}
                            placeholder="Dán link Google Maps hoặc nhập tên + địa chỉ quán..."
                            style={{ ...compactInputStyle(theme), flex: 1 }}
                          />
                          <a
                            href={
                              editPlaceMapsUrl.trim() ||
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                editPlaceMapsQuery || `${editPlaceName} Xuân Hòa Phúc Yên`
                              )}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '0 13px',
                              borderRadius: '8px',
                              border: `1px solid ${theme.accentBorder}`,
                              background: theme.accentSoft,
                              color: theme.accent,
                              fontSize: '12px',
                              fontWeight: 700,
                              textDecoration: 'none',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <ExternalLink size={13} /> Xem Maps
                          </a>
                        </div>
                      </div>

                      {/* PHÂN KHU NGÀNH NGHỀ (Ô SỔ RA GỌN GÀNG + NÚT THÊM NGÀNH MỚI NGAY TẠI QUÁN) */}
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
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            {isAddingSectorInline ? 'Đóng' : '+ Thêm phân khu mới'}
                          </button>
                        </div>

                        {!isAddingSectorInline ? (
                          <select
                            value={editPlaceSectorTag}
                            onChange={e => setEditPlaceSectorTag(e.target.value)}
                            style={{ ...lightSelectStyle(theme), padding: '8px 11px', fontSize: '13px' }}
                          >
                            {sectorTags.map(sec => (
                              <option key={sec.id} value={sec.id}>
                                {sec.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              value={inlineSectorLabel}
                              onChange={e => setInlineSectorLabel(e.target.value)}
                              placeholder="Tên ngành mới (VD: Homestay, Bi-a...)"
                              style={{ ...compactInputStyle(theme), flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={handleAddInlineSector}
                              style={{
                                padding: '0 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: theme.accent,
                                color: '#FFF',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Thêm
                            </button>
                          </div>
                        )}
                      </div>

                      {/* HÌNH THỨC PHỤC VỤ (Ô SỔ RA NGANG HÀNG VỚI PHÂN KHU) */}
                      <div>
                        <label style={compactLabelStyle(theme)}>Hình thức Phục vụ</label>
                        <select
                          value={editPlaceServiceMode}
                          onChange={e => setEditPlaceServiceMode(e.target.value as Place['serviceMode'])}
                          style={{ ...lightSelectStyle(theme), padding: '8px 11px', fontSize: '13px' }}
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
                            : 'Mở rộng: Mô tả, Tag tìm kiếm, Khoảng giá, Món tủ, Khu vực & Ảnh...'}
                        </span>
                      </button>

                      {showAdvancedPlaceFields && (
                        <div className="xh-compact-grid" style={{ marginTop: '12px' }}>
                          <div>
                            <label style={compactLabelStyle(theme)}>Mô tả ngắn hiển thị dưới tên quán</label>
                            <input
                              type="text"
                              value={editPlaceTagline}
                              onChange={e => setEditPlaceTagline(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>

                          <div>
                            <label style={compactLabelStyle(theme)}>Các Tag tìm kiếm (cách nhau dấu phẩy)</label>
                            <input
                              type="text"
                              value={editPlaceTagsText}
                              onChange={e => setEditPlaceTagsText(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={compactLabelStyle(theme)}>Giá thấp nhất (k)</label>
                              <input
                                type="number"
                                value={editPlaceMinPrice}
                                onChange={e => setEditPlaceMinPrice(Number(e.target.value))}
                                style={compactInputStyle(theme)}
                              />
                            </div>
                            <div>
                              <label style={compactLabelStyle(theme)}>Giá cao nhất (k)</label>
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
                              <label style={compactLabelStyle(theme)}>Giá Món Tủ (k)</label>
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

                          <div>
                            <label style={compactLabelStyle(theme)}>Lời bình ngắn (Quip)</label>
                            <input
                              type="text"
                              value={editPlaceQuip}
                              onChange={e => setEditPlaceQuip(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>

                          <div>
                            <label style={compactLabelStyle(theme)}>Link Ảnh Đại Diện</label>
                            <input
                              type="text"
                              value={editPlaceImageUrl}
                              onChange={e => setEditPlaceImageUrl(e.target.value)}
                              style={compactInputStyle(theme)}
                            />
                          </div>

                          {selectedPlaceItem.isModified && !selectedPlaceItem.isCustom && (
                            <div className="xh-col-span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  resetPlaceToDefault(selectedPlaceItem.place.id);
                                  setRefreshTick(t => t + 1);
                                  showToast('Đã khôi phục dữ liệu gốc của quán');
                                }}
                                style={actionBtnStyle(theme, false)}
                              >
                                <RotateCcw size={13} /> Khôi phục thông tin gốc ban đầu
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* =============================================================== */}
                  {/* KHỐI 2 (Ở DƯỚI): THỰC ĐƠN MÓN CỦA QUÁN (BẢNG 1 DÒNG GỌN GÀNG)  */}
                  {/* =============================================================== */}
                  <div
                    style={{
                      background: theme.bgCard,
                      borderRadius: '14px',
                      border: `1px solid ${theme.border}`,
                      boxShadow: theme.shadow,
                      padding: '18px 20px',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UtensilsCrossed size={16} style={{ color: theme.accent }} />
                        <span style={{ fontSize: '15px', fontWeight: 800 }}>
                          Thực đơn của Quán ({editPlaceMenu.length} món)
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: theme.bgInput,
                            border: `1px solid ${theme.border}`,
                          }}
                        >
                          <Search size={13} style={{ color: theme.textMuted }} />
                          <input
                            type="text"
                            value={dishSearchInPlace}
                            onChange={e => setDishSearchInPlace(e.target.value)}
                            placeholder="Tìm món trong quán..."
                            style={{
                              border: 'none',
                              background: 'transparent',
                              outline: 'none',
                              fontSize: '12px',
                              color: theme.textPrimary,
                              width: '150px',
                            }}
                          />
                        </div>

                        <button
                          onClick={() => setIsAddingDishRow(!isAddingDishRow)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '7px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: theme.accent,
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={14} /> Thêm Món Mới
                        </button>
                      </div>
                    </div>

                    {isAddingDishRow && (
                      <div
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          background: theme.bgElevated,
                          border: `1px solid ${theme.accentBorder}`,
                          marginBottom: '12px',
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr auto auto',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                        className="xh-quick-add-dish"
                      >
                        <input
                          type="text"
                          value={newMenuDishName}
                          onChange={e => setNewMenuDishName(e.target.value)}
                          placeholder="Tên món mới..."
                          style={compactInputStyle(theme)}
                        />
                        <input
                          type="number"
                          value={newMenuDishPrice}
                          onChange={e => setNewMenuDishPrice(e.target.value)}
                          placeholder="Giá (.000đ)"
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
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: theme.accent,
                            color: '#FFF',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Lưu món
                        </button>
                        <button
                          onClick={() => setIsAddingDishRow(false)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            background: 'transparent',
                            color: theme.textMuted,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    )}

                    <div
                      style={{
                        borderRadius: '10px',
                        border: `1px solid ${theme.border}`,
                        overflow: 'hidden',
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
                              padding: '10px 14px',
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
                                  gap: '10px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    flex: 1,
                                    minWidth: '180px',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => setEditingDishIndex(idx)}
                                >
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      color: theme.textMuted,
                                      minWidth: '22px',
                                    }}
                                  >
                                    #{idx + 1}
                                  </span>
                                  <div>
                                    <span
                                      style={{
                                        fontSize: '13.5px',
                                        fontWeight: 700,
                                        color: dish.isLocked ? theme.textMuted : theme.textPrimary,
                                        textDecoration: dish.isLocked ? 'line-through' : 'none',
                                      }}
                                    >
                                      {dish.name}
                                    </span>
                                    {dish.category && (
                                      <span
                                        style={{
                                          marginLeft: '8px',
                                          fontSize: '10.5px',
                                          padding: '1px 6px',
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
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      fontSize: '13.5px',
                                      fontWeight: 800,
                                      color: theme.accent,
                                      minWidth: '68px',
                                      textAlign: 'right',
                                    }}
                                  >
                                    {dish.price}.000đ
                                  </span>

                                  <button
                                    onClick={() => setEditingDishIndex(idx)}
                                    style={smallRowBtnStyle(theme)}
                                  >
                                    <Edit3 size={12} /> Sửa
                                  </button>

                                  <button
                                    onClick={() => handleToggleLockDishInPlace(idx)}
                                    style={{
                                      ...smallRowBtnStyle(theme),
                                      color: dish.isLocked ? '#047857' : '#B45309',
                                    }}
                                  >
                                    {dish.isLocked ? 'Mở bán' : 'Tạm hết'}
                                  </button>

                                  <button
                                    onClick={() => handleDeleteDishFromPlace(idx)}
                                    style={{
                                      ...smallRowBtnStyle(theme),
                                      color: '#B91C1C',
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="xh-inline-dish-edit"
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '2fr 95px 1fr 1.5fr auto',
                                  gap: '8px',
                                  alignItems: 'center',
                                }}
                              >
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
                                <input
                                  type="text"
                                  value={dish.description || ''}
                                  onChange={e => {
                                    const next = [...editPlaceMenu];
                                    next[idx] = { ...next[idx], description: e.target.value };
                                    setEditPlaceMenu(next);
                                  }}
                                  placeholder="Mô tả ngắn"
                                  style={compactInputStyle(theme)}
                                />
                                <button
                                  onClick={() => {
                                    setEditingDishIndex(null);
                                    handleSavePlaceAndMenu(editPlaceMenu, `Đã cập nhật món "${dish.name}"`);
                                  }}
                                  style={{
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: theme.accent,
                                    color: '#FFF',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Lưu món
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* =================================================================== */}
          {/* 3. QUẢN LÝ THÀNH VIÊN (GỒM CẤP NICK + PASS QUẢN LÝ & THÀNH VIÊN THỰC) */}
          {/* =================================================================== */}
          {activeSection === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* KHỐI 1: DANH SÁCH TÀI KHOẢN QUẢN LÝ (CẤP NICK & MẬT KHẨU RIÊNG) */}
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
                      <span>Tài khoản Ban Quản Lý Web ({adminAccounts.length} nick)</span>
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>
                      Mỗi quản lý được cấp Nick đăng nhập và Mật khẩu riêng để vào trang /quanly
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

              {/* KHỐI 2: DANH SÁCH THÀNH VIÊN NGƯỜI DÙNG THỰC TẾ (100% SỐ THỰC) */}
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
                      Thành viên Người dùng thực tế ({realMembersCount} người)
                      {seederMembersCount > 0 ? ` (+ ${seederMembersCount} nick phụ)` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>
                      100% người dùng đăng ký thực qua Gmail trên hệ thống
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
                      <Plus size={13} /> Tạo nick phụ đánh giá
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
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
                        <th style={{ padding: '10px 14px' }}>Thành viên</th>
                        <th style={{ padding: '10px 14px' }}>Phân loại</th>
                        <th style={{ padding: '10px 14px' }}>Trạng thái</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(member => (
                        <tr key={member.email} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>{member.nickname}</div>
                            <div style={{ fontSize: '11.5px', color: theme.textMuted }}>{member.email}</div>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                            {member.isTestAccount ? 'Nick phụ (Đánh giá)' : 'Gmail Thực Tế'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700 }}>
                            {member.status === 'admin'
                              ? 'Quản trị viên'
                              : member.status === 'active'
                              ? 'Hoạt động'
                              : member.status === 'muted'
                              ? 'Đang Mute'
                              : 'Đã chặn (Ban)'}
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
                      ))}
                    </tbody>
                  </table>
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
              maxWidth: '400px',
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
              <div>
                <label style={compactLabelStyle(theme)}>Phân khu ngành nghề</label>
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
                <label style={compactLabelStyle(theme)}>Link Google Maps (nếu có)</label>
                <input
                  type="text"
                  value={newPlaceForm.mapsUrl}
                  onChange={e => setNewPlaceForm({ ...newPlaceForm, mapsUrl: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                  style={compactInputStyle(theme)}
                />
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

      {/* CSS CHUẨN LIGHT MODE, CỘT 2 VÀ CỘT 3 CAO BẰNG NHAU CÂN ĐỐI 100% */}
      <style>{`
        .xh-admin-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
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
          padding: 16px 18px 40px 18px;
          max-width: 1440px;
          width: 100%;
          overflow-x: hidden;
        }
        /* CỘT 2 (DANH SÁCH QUÁN) VÀ CỘT 3 (CHI TIẾT QUÁN) BẮT ĐẦU CÙNG MÉP TRÊN VÀ CAO CÂN ĐỐI */
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

        @media (max-width: 960px) {
          .xh-hide-mobile {
            display: none !important;
          }
          .xh-show-mobile-only {
            display: inline-flex !important;
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
          }
          .xh-sidebar-btn {
            padding: 8px 11px;
            font-size: 12px;
            flex-shrink: 0;
            gap: 6px;
          }
          .xh-admin-main {
            padding: 12px 10px 50px 10px;
          }
          .xh-places-master-detail {
            grid-template-columns: 1fr;
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
