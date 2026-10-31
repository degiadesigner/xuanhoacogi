'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { 
  MAIN_CATEGORIES, 
  MainCategoryKey, 
  getCategoryItems 
} from '@/lib/xuanhoa-catalog';
import { Food } from '@/lib/foods';
import { 
  MEAL_SESSIONS, 
  MealSession, 
  getLiveMealSession, 
  isFoodSuitableForSession,
  isDrinkSuitableForSession,
  isNhauSuitableForSession,
  isPlaceSuitableForSession
} from '@/lib/time-mechanics';
import { 
  getLocalProfile, 
  addSpinExp, 
  UserGourmetProfile 
} from '@/lib/user-exp';
import { createSpinProfile, spinProgress, stopFraction } from '@/lib/case-mechanics';
import { FoodImage } from '@/components/FoodImage';
import { WinnerDialog } from '@/components/WinnerDialog';
import { PlaceCard } from '@/components/PlaceCard';
import { PlaceModal } from '@/components/PlaceModal';
import { 
  xuanHoaPlaces, 
  Place, 
  PLACE_SESSIONS, 
  PlaceSessionType,
  PlaceKeoType,
  PLACE_KEO_LIST,
  isPlaceMatchKeo,
  getPlaceStyleGroup,
  xuanHoaPlaySpots,
  PLAY_CATEGORY_LIST,
  PlayCategoryType
} from '@/lib/places-xuanhoa';
import { 
  createPlaceSpinProfile, 
  spinProgress as placeSpinProgress, 
  stopFraction as placeStopFraction 
} from '@/lib/places-spin';
import { CaseAudio } from '@/lib/case-audio';
import { Volume2, VolumeX, RotateCw, Shuffle, Search, UtensilsCrossed, Store, Sparkles, ChevronDown, ChevronUp, Clock, Flame, Coffee, Layers, X, ChevronRight, LayoutGrid, MapPin, Heart, Map, ExternalLink, User, LogIn, Star, Shield, Settings } from 'lucide-react';
import { DishesCatalogView } from '@/components/DishesCatalogView';
import { PlacesCatalogView } from '@/components/PlacesCatalogView';
import { DigitalMapView, prefetchDigitalMapGeoLayers } from '@/components/DigitalMapView';
import { UserGuideView } from '@/components/UserGuideView';
import { AboutView } from '@/components/AboutView';
import { ComingSoonView } from '@/components/ComingSoonView';
import { AdminDashboardView } from '@/components/AdminDashboardView';
import { SettingsMenuModal } from '@/components/SettingsMenuModal';
import { GoogleGIcon } from '@/components/GoogleGIcon';
import { AuthModal } from '@/components/AuthModal';
import { UserProfileModal } from '@/components/UserProfileModal';
import { GuestUpgradeGateModal } from '@/components/GuestUpgradeGateModal';
import { GourmetScoreboardModal } from '@/components/GourmetScoreboardModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useI18n } from '@/lib/i18n';
import { saveFoodHistoryItem } from '@/lib/food-history';
import { getStoredAuthUser, saveAuthUser, clearAuthUser, UserAuthProfile, checkRedirectAuthResult, consumeJustLoggedInFlag } from '@/lib/auth';
import { GlobalSpinCounter } from '@/components/GlobalSpinCounter';
import { useGlobalSpinCounter } from '@/hooks/use-global-spin-counter';
import { getDishRatingSummary } from '@/lib/reviews-storage';
import { BudgetDropdown, PlaceKeoDropdown, SessionDropdown } from '@/components/LuxuryFilterDropdowns';
import { CatalogFoodItem, getDishConceptKey, diversifyFoodList, getUniqueConceptFoods } from '@/lib/xuanhoa-catalog';
import { getSpotsForDish } from '@/lib/dish-places';
import { formatTypography, getFoodCategoryLabel, cleanDishDisplayTitle } from '@/lib/utils';
import {
  getActivePublicCategoryItems,
  getActivePublicPlaces,
  syncUserToAdminRegistry,
  getMemberRestrictionStatus,
  initAdminCloudSync,
  getPrimaryClaimedPlaceForUser,
  getEffectiveAdminRoleInfo,
  getLoggedAdminSession,
  ensureCloudPermissionsSyncedForEmail,
} from '@/lib/admin-store';

export type AppView = 'spin' | 'places' | 'map' | 'dishes' | 'guide' | 'about' | 'coming-soon' | 'admin';

function parseHashToView(): AppView {
  if (typeof window === 'undefined') return 'spin';
  const hash = window.location.hash.toLowerCase();
  const pathname = (window.location.pathname || '').toLowerCase();

  // 1. Ưu tiên kiểm tra hash tường minh trước để khi từ /quanly nhảy sang #/bandoso luôn chuyển trang tức thì
  if (
    hash.includes('bandoso') ||
    hash.includes('demo-ban-do') ||
    hash.includes('ban-do') ||
    hash.includes('map') ||
    hash.includes('chu-quan') ||
    hash.includes('merchant') ||
    hash.includes('claim=') ||
    hash.includes('pick=') ||
    hash.includes('flylat=') ||
    hash.includes('select=')
  ) {
    return 'map';
  }
  if (
    hash.includes('quanly') ||
    hash.includes('quan-ly') ||
    hash.includes('admin') ||
    hash.includes('quan-tri')
  ) {
    return 'admin';
  }
  if (hash.includes('coming-soon') || hash.includes('sap-ra-mat') || hash.includes('teaser')) {
    return 'coming-soon';
  }
  if (hash.includes('quan-an') || hash.includes('places') || hash.includes('dia-diem') || hash.includes('quan-xa')) {
    return 'places';
  }
  if (hash.includes('kham-pha-mon') || hash.includes('dishes') || hash.includes('mon-an')) {
    return 'places';
  }
  if (hash.includes('cach-su-dung') || hash.includes('huong-dan') || hash.includes('guide')) {
    return 'guide';
  }
  if (hash.includes('gioi-thieu') || hash.includes('about')) {
    return 'about';
  }
  if (hash === '#/' || hash === '#spin') {
    return 'spin';
  }

  // 2. Hỗ trợ cả xuanhoacogi.com/bandoso VÀ bandoso.xuanhoacogi.com
  const hostname = (window.location.hostname || '').toLowerCase();
  if (
    hostname.startsWith('bandoso.') ||
    pathname === '/bandoso' ||
    pathname === '/bandoso/' ||
    pathname === '/ban-do' ||
    pathname === '/ban-do/' ||
    pathname === '/map' ||
    pathname === '/map/'
  ) {
    return 'map';
  }

  // 3. Nếu không có hash cụ thể thì kiểm tra pathname (/quanly, /admin)
  if (
    pathname === '/quanly' ||
    pathname === '/quanly/' ||
    pathname === '/admin' ||
    pathname === '/admin/'
  ) {
    return 'admin';
  }
  return 'spin';
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const rarityColors = ['#10B981', '#F59E0B', '#A855F7', '#F97316', '#EF4444'];
const rarityNames = ['Phổ thông', 'Đặc biệt', 'Quý hiếm', 'Cực hiếm', 'Huyền thoại'];

// Hàm xáo trộn ngẫu nhiên các món / quán (Fisher-Yates Shuffle) giúp thanh quay luôn đa dạng
function shuffleArray<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function Home() {
  // Gourmet profile (Level & EXP)
  const [profile, setProfile] = useState<UserGourmetProfile>(() => getLocalProfile());

  // Google Auth User Profile State
  const [authUser, setAuthUser] = useState<UserAuthProfile | null>(() => getStoredAuthUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalStep, setAuthModalStep] = useState<1 | 2>(1);
  const [authNotice, setAuthNotice] = useState<string>('');
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [isGuestGateOpen, setIsGuestGateOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [authToastMsg, setAuthToastMsg] = useState<string>('');
  const [adminSyncTick, setAdminSyncTick] = useState<number>(0);

  // i18n Multi-language Hook (Vietnamese / English)
  const { lang, changeLanguage, t } = useI18n();

  useEffect(() => {
    initAdminCloudSync();
    const existingStored = getStoredAuthUser();
    if (existingStored && existingStored.isLoggedIn && existingStored.email) {
      syncUserToAdminRegistry(existingStored, profile.dishesCount, profile.level);
    }

    // Kiểm tra kết quả chuyển hướng từ Google (dành cho mọi trình duyệt Mobile & PC)
    checkRedirectAuthResult().then(async (user) => {
      if (user) {
        setAuthUser(user);
        syncUserToAdminRegistry(user, profile.dishesCount, profile.level);
        await ensureCloudPermissionsSyncedForEmail(user.email);
        setAdminSyncTick(t => t + 1);
        const justLogged = consumeJustLoggedInFlag();
        if (justLogged) {
          setAuthToastMsg(`Đã kết nối Google: ${user.email || user.nickname}`);
          setTimeout(() => setAuthToastMsg(''), 4000);
          if (parseHashToView() === 'admin') {
            const roleInfo = getEffectiveAdminRoleInfo(getLoggedAdminSession(), user);
            if (!roleInfo.isAuthenticated) {
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', '/#/');
                window.location.hash = '#/';
              }
              setCurrentView('spin');
            }
          } else if (!user.isFirstTimeSetupDone) {
            setAuthModalStep(2);
            setIsAuthModalOpen(true);
          }
        }
      }
    });

    const handleAuthChange = (e: any) => {
      const nextUser = e.detail !== undefined ? e.detail : getStoredAuthUser();
      setAuthUser(nextUser);
      if (nextUser && nextUser.isLoggedIn) {
        syncUserToAdminRegistry(nextUser, profile.dishesCount, profile.level);
      }
    };
    const handleAdminSync = () => {
      setAdminSyncTick(t => t + 1);
    };
    window.addEventListener('xuanhoa_auth_change', handleAuthChange);
    window.addEventListener('xuanhoa_admin_sync', handleAdminSync);
    return () => {
      window.removeEventListener('xuanhoa_auth_change', handleAuthChange);
      window.removeEventListener('xuanhoa_admin_sync', handleAdminSync);
    };
  }, [profile.dishesCount, profile.level]);

  // Global total spins counter (starting from 688)
  const { count: globalSpinCount, increment: incrementGlobalSpins } = useGlobalSpinCounter();

  // Active App View: 'spin' | 'places' | 'map' | 'dishes' | 'guide' | 'about' | 'coming-soon' | 'admin'
  const [currentView, setCurrentView] = useState<AppView>(() => parseHashToView());

  const navigateTo = useCallback((view: AppView) => {
    setCurrentView(view);
    const hashMap: Record<AppView, string> = {
      spin: '#/',
      places: '#/quan-an',
      map: '#/bandoso',
      dishes: '#/quan-an',
      guide: '#/cach-su-dung',
      about: '#/gioi-thieu',
      'coming-soon': '#/sap-ra-mat',
      admin: '#/quanly',
    };
    if (typeof window !== 'undefined') {
      if (view === 'map' && window.location.hash.startsWith('#/bandoso?')) {
        // Giữ nguyên query params (?select=...&flyLat=...) khi chuyển sang Bản Đồ Số
      } else {
        window.location.hash = hashMap[view];
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const handleHash = () => {
      setCurrentView(parseHashToView());
    };
    const handleOpenInternalMap = () => {
      setCurrentView('map');
    };
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('xuanhoa_open_internal_map', handleOpenInternalMap);
    // Prefetch dữ liệu bản đồ số sau 1.2s để khi bấm [🗺 Bản đồ số] mở tức thì 0ms
    const timer = window.setTimeout(() => {
      prefetchDigitalMapGeoLayers().catch(() => {});
    }, 1200);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('xuanhoa_open_internal_map', handleOpenInternalMap);
      window.clearTimeout(timer);
    };
  }, []);

  // 2-TAB Mode: 'dish' (Quay Chọn Món) vs 'place' (Quay Chọn Quán)
  const [mainMode, setMainMode] = useState<'dish' | 'place' | 'play'>('dish');
  const [playCategory, setPlayCategory] = useState<PlayCategoryType>('all');

  // Active Category (Bữa Chính, Quán Nhậu, Đồ Uống, Ăn Vặt, Thời Trang)
  const [activeCategory, setActiveCategory] = useState<MainCategoryKey>('an-gi');

  // Meal Session (Mặc định AUTO lựa theo khung giờ thực tế: Sáng, Trưa, Chiều, Tối, Cú Đêm)
  const [session, setSession] = useState<MealSession>(() => getLiveMealSession());
  const [liveSession, setLiveSession] = useState<MealSession>(() => getLiveMealSession());
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Chạy ngầm nhận diện khung giờ thực tế liên tục
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setCurrentTimeStr(`${h}:${m}:${s}`);

      const live = getLiveMealSession();
      setLiveSession(live);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // Sub-filters for specialized tabs
  const [nhauSubFilter, setNhauSubFilter] = useState<'all' | 'lau-nuong' | 'oc-haisan' | 'bia-moi'>('all');
  const [drinkSubFilter, setDrinkSubFilter] = useState<'all' | 'tra-sua' | 'cafe' | 'tra-traicay'>('all');

  // Budget Filter (All, Presets, or Custom Input)
  const [budget, setBudget] = useState<string>('all');
  const [customPrice, setCustomPrice] = useState<string>('50');
  const [caseTier, setCaseTier] = useState<'all' | number>('all');
  const [sound, setSound] = useState(true);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isSocialMenuOpen, setIsSocialMenuOpen] = useState(false);
  const [mapToast, setMapToast] = useState(false);

  const handleOpenMap = useCallback(() => {
    navigateTo('map');
  }, [navigateTo]);

  const toggleSound = useCallback(() => {
    setSound(prev => {
      const nextSound = !prev;
      audio.current?.setMuted(!nextSound);
      if (nextSound) audio.current?.unlock();
      return nextSound;
    });
  }, []);

  const handleToggleTasteFilter = useCallback(() => {
    if (!authUser || !authUser.isLoggedIn) {
      setAuthNotice('Đăng nhập Google để bật bộ lọc theo gu ẩm thực của bạn');
      setAuthModalStep(1);
      setIsAuthModalOpen(true);
      return;
    }
    const updatedUser: UserAuthProfile = {
      ...authUser,
      filterByTaste: authUser.filterByTaste === false ? true : false,
    };
    setAuthUser(updatedUser);
    saveAuthUser(updatedUser);
  }, [authUser]);

  const isFoodMatchingTaste = (food: Food, prefs: string[]): boolean => {
    if (!prefs || prefs.length === 0) return true;
    const name = (food.name || '').toLowerCase();
    const sub = (food.sub || '').toLowerCase();
    const text = `${name} ${sub}`;

    return prefs.some(pref => {
      switch (pref) {
        case 'spicy':
          return text.includes('cay') || text.includes('sa tế') || text.includes('tiêu') || text.includes('lẩu thái') || text.includes('bò né') || text.includes('chua cay') || text.includes('mì cay');
        case 'non_spicy':
          return text.includes('phở') || text.includes('cháo') || text.includes('súp') || text.includes('thanh đạm') || text.includes('cơm') || text.includes('gà hấp') || text.includes('canh');
        case 'lau_nuong':
          return text.includes('lẩu') || text.includes('nướng') || text.includes('bbq') || text.includes('chảo gang') || text.includes('bò tơ') || text.includes('nhúng');
        case 'tra_sua':
          return text.includes('trà sữa') || text.includes('matcha') || text.includes('chè') || text.includes('trân châu') || text.includes('kem') || text.includes('sữa chua') || text.includes('bánh');
        case 'nhau_bia':
          return text.includes('bia') || text.includes('nem') || text.includes('chân gà') || text.includes('dồi') || text.includes('ốc') || text.includes('mực') || text.includes('lòng') || text.includes('sụn') || text.includes('nộm');
        case 'bun_pho':
          return text.includes('bún') || text.includes('phở') || text.includes('miến') || text.includes('hủ tiếu') || text.includes('bánh đa') || text.includes('bánh canh');
        case 'an_vat_dem':
          return text.includes('bánh tráng') || text.includes('nem rán') || text.includes('khoai') || text.includes('xúc xích') || text.includes('tokbokki') || text.includes('mì tôm') || text.includes('xiên');
        case 'cafe_chill':
          return text.includes('cà phê') || text.includes('cafe') || text.includes('bạc xỉu') || text.includes('trà') || text.includes('nước ép');
        case 'healthy':
          return text.includes('salad') || text.includes('gỏi cuốn') || text.includes('nước ép') || text.includes('ức gà') || text.includes('sinh tố') || text.includes('trái cây');
        case 'an_chay':
          return !!food.veg || text.includes('chay') || text.includes('nấm') || text.includes('đậu') || text.includes('rau');
        default:
          return false;
      }
    });
  };



  // Items for the chosen category (Đồng bộ 2 chiều thời gian thực với Admin)
  const categoryItems = useMemo(() => {
    const activeList = getActivePublicCategoryItems(activeCategory);
    return activeList.length > 0 ? activeList : getCategoryItems(activeCategory);
  }, [activeCategory, adminSyncTick]);

  // Dish count statistics per rarity tier
  const tierCounts = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    categoryItems.forEach(f => {
      const t = f.rarity ?? 0;
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [categoryItems]);

  // Filtered items based on active category, session, sub-filter and budget
  const eligibleItems = useMemo(() => {
    let sessionFiltered = categoryItems;

    // 1. Phân loại theo khung giờ phù hợp (Sáng, Trưa, Chiều nhẹ dạ dày, Tối & Đêm)
    if (activeCategory === 'an-gi') {
      sessionFiltered = categoryItems.filter(f => isFoodSuitableForSession(f, session));
    } else if (activeCategory === 'nhau-gi') {
      sessionFiltered = categoryItems.filter(f => isNhauSuitableForSession(f, session));
    } else if (activeCategory === 'uong-gi') {
      sessionFiltered = categoryItems.filter(f => isDrinkSuitableForSession(f, session));
    }

    if (!sessionFiltered.length) sessionFiltered = categoryItems;
    let filtered = sessionFiltered;

    // 2. Lọc theo sub-filter chuyên mục (Nhậu / Đồ uống)
    if (activeCategory === 'nhau-gi' && nhauSubFilter !== 'all') {
      if (nhauSubFilter === 'lau-nuong') {
        const sub = filtered.filter(f => {
          const n = f.name.toLowerCase();
          return n.includes('lẩu') || n.includes('nướng') || n.includes('bbq') || n.includes('bò né') || n.includes('bò lúc lắc') || n.includes('bít tết') || n.includes('nhúng mẻ') || n.includes('thắng cố');
        });
        if (sub.length) filtered = sub;
      } else if (nhauSubFilter === 'oc-haisan') {
        const sub = filtered.filter(f => {
          const n = f.name.toLowerCase();
          return n.includes('ốc') || n.includes('hàu') || n.includes('hải sản') || n.includes('cá') || n.includes('sushi') || n.includes('nghêu') || n.includes('sò') || n.includes('tôm') || n.includes('mực');
        });
        if (sub.length) filtered = sub;
      } else if (nhauSubFilter === 'bia-moi') {
        const sub = filtered.filter(f => {
          const n = f.name.toLowerCase();
          return n.includes('bia') || n.includes('nem') || n.includes('đậu') || n.includes('chân gà') || n.includes('ngô') || n.includes('khoai') || n.includes('lạc') || n.includes('tóp mỡ') || n.includes('sụn') || n.includes('dồi') || n.includes('tai heo') || n.includes('cháy tỏi') || n.includes('dưa chuột') || n.includes('dạ dày') || n.includes('lòng') || n.includes('ba chỉ') || n.includes('ếch') || n.includes('gà') || n.includes('vịt') || n.includes('chim') || n.includes('rau') || n.includes('ngọn') || n.includes('nộm') || n.includes('gỏi') || n.includes('trâu') || n.includes('măng');
        });
        if (sub.length) filtered = sub;
      }
    } else if (activeCategory === 'uong-gi' && drinkSubFilter !== 'all') {
      if (drinkSubFilter === 'tra-sua') {
        const sub = filtered.filter(f => {
          const n = f.name.toLowerCase();
          return n.includes('trà sữa') || n.includes('matcha') || n.includes('cheese') || n.includes('latte') || n.includes('hojicha') || n.includes('cacao') || n.includes('trà sen') || n.includes('sữa tươi trân châu') || n.includes('cốm') || n.includes('ôlong') || n.includes('olong') || n.includes('milo') || n.includes('trân châu') || n.includes('mochi');
        });
        if (sub.length) filtered = sub;
      } else if (drinkSubFilter === 'cafe') {
        const sub = filtered.filter(f => {
          const n = f.name.toLowerCase();
          return n.includes('cà phê') || n.includes('cafe') || n.includes('espresso') || n.includes('americano') || n.includes('cappuccino') || n.includes('bạc xỉu');
        });
        if (sub.length) filtered = sub;
      } else if (drinkSubFilter === 'tra-traicay') {
        const sub = filtered.filter(f => {
          const n = f.name.toLowerCase();
          return n.includes('trà') || n.includes('nước') || n.includes('sinh tố') || n.includes('sữa chua') || n.includes('sâm') || n.includes('soda') || n.includes('rau má') || n.includes('sữa') || n.includes('mãng cầu') || n.includes('măng cụt') || n.includes('lựu') || n.includes('dứa') || n.includes('mít') || n.includes('nhãn') || n.includes('ổi') || n.includes('chè') || n.includes('tào phớ');
        });
        if (sub.length) filtered = sub;
      }
    }

    // 3. Lọc theo ngân sách chi tiêu
    if (budget !== 'all') {
      if (budget === 'custom') {
        const customVal = Number(customPrice);
        if (customVal > 0) {
          const customList = filtered.filter(f => Math.abs(f.price - customVal) <= 20 || f.price <= customVal);
          if (customList.length) filtered = customList;
        }
      } else {
        const target = Number(budget);
        let budgetList = filtered;
        if (target <= 35) budgetList = filtered.filter(f => f.price <= 40);
        else if (target <= 50) budgetList = filtered.filter(f => f.price <= 60);
        else if (target <= 75) budgetList = filtered.filter(f => f.price >= 35 && f.price <= 90);
        else if (target <= 100) budgetList = filtered.filter(f => f.price >= 50 && f.price <= 120);
        else budgetList = filtered.filter(f => f.price >= 80);
        if (budgetList.length) filtered = budgetList;
      }
    }

    // 4. Lọc theo cấp độ hòm (Case Tier / Rarity)
    if (caseTier !== 'all') {
      const tierFiltered = filtered.filter(f => f.rarity === caseTier);
      if (tierFiltered.length > 0) {
        filtered = tierFiltered;
      }
    }

    // 5. Lọc theo Gu Ẩm Thực (nếu người dùng đã đăng nhập và bật filterByTaste)
    if (authUser?.isLoggedIn && authUser.filterByTaste !== false && authUser.tastePreferences && authUser.tastePreferences.length > 0) {
      const tasteFiltered = filtered.filter(f => isFoodMatchingTaste(f, authUser.tastePreferences!));
      if (tasteFiltered.length >= 4) {
        filtered = tasteFiltered;
      }
    }

    return filtered.length ? filtered : sessionFiltered;
  }, [categoryItems, activeCategory, session, nhauSubFilter, drinkSubFilter, budget, customPrice, caseTier, authUser]);

  // Reel State (Bắt đầu với dải món độc bản được xáo trộn ngẫu nhiên, không trùng lặp)
  const [reel, setReel] = useState<{ food: Food; id: number }[]>(() => {
    const initial = getUniqueConceptFoods(shuffleArray(getCategoryItems('an-gi')));
    return initial.slice(0, 16).map((food, id) => ({ food, id }));
  });
  const [spinning, setSpinning] = useState(false);
  const [visibleStart, setVisibleStart] = useState(0);

  // Winner dialog state (Món Ăn)
  const [winnerFood, setWinnerFood] = useState<Food | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Dish pagination state ("Xem tiếp" / Load more khi chọn Cả ngày)
  const [visibleDishCount, setVisibleDishCount] = useState<number>(18);
  // Search Query States
  const [dishSearchQuery, setDishSearchQuery] = useState('');
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');

  // Chế độ xem kho: 'all' (Tất cả menu quán) vs 'unique' (Món độc bản - Không trùng lặp)
  const [inventoryMode, setInventoryMode] = useState<'unique' | 'all'>('all');

  // Key xáo trộn ngẫu nhiên danh sách món & quán bên dưới vòng quay
  const [dishShuffleKey, setDishShuffleKey] = useState<number>(() => Date.now());
  const [placeShuffleKey, setPlaceShuffleKey] = useState<number>(() => Date.now());

  // Danh sách món độc bản (xáo trộn trước khi gom nhóm để mọi quán đều có cơ hội xuất hiện công bằng 100%)
  const uniqueEligibleDishes = useMemo(() => {
    return getUniqueConceptFoods(shuffleArray(eligibleItems));
  }, [eligibleItems, dishShuffleKey]);

  // Danh sách món hiển thị trong kho (Xáo trộn ngẫu nhiên hoàn toàn mỗi lần hiển thị & mỗi lần quay)
  const displayedDishes = useMemo(() => {
    const baseList = inventoryMode === 'unique' ? uniqueEligibleDishes : eligibleItems;
    if (dishSearchQuery.trim()) {
      const q = dishSearchQuery.toLowerCase().trim();
      return baseList.filter(food => 
        food.name.toLowerCase().includes(q) || 
        (food.sub && food.sub.toLowerCase().includes(q)) ||
        (food.quip && food.quip.toLowerCase().includes(q))
      );
    }
    // Ngẫu nhiên hóa thứ tự các món mỗi lần quay hoặc mỗi lần đổi danh mục
    const randomized = shuffleArray(baseList);
    return inventoryMode === 'unique' ? randomized : diversifyFoodList(randomized);
  }, [eligibleItems, uniqueEligibleDishes, inventoryMode, dishSearchQuery, dishShuffleKey]);

  // Tự động reset về 18 món và xáo trộn ngẫu nhiên khi thay đổi bất kỳ bộ lọc món nào
  useEffect(() => {
    setVisibleDishCount(18);
    setDishShuffleKey(Date.now());
  }, [activeCategory, session, nhauSubFilter, drinkSubFilter, budget, customPrice, caseTier, inventoryMode]);

  // Tự động xóa từ khóa tìm kiếm khi đổi chuyên mục chính (Ăn gì / Nhậu gì / Uống gì)
  useEffect(() => {
    setDishSearchQuery('');
  }, [activeCategory]);

  // Place Mode States (Chọn Quán - Đồng bộ với Chọn Món)
  const [placeCategory, setPlaceCategory] = useState<'all' | 'an-chinh' | 'nhau-lau' | 'uong' | 'an-vat' | 'vui-choi'>('all');
  const [placeKeo, setPlaceKeo] = useState<PlaceKeoType>('all');
  const [placeSession, setPlaceSession] = useState<MealSession>(() => getLiveMealSession());
  const [placeBudget, setPlaceBudget] = useState<string>('all');
  const [placeCustomPrice, setPlaceCustomPrice] = useState<string>('50');

  const [winnerPlace, setWinnerPlace] = useState<Place | null>(null);
  const [placeModalOpen, setPlaceModalOpen] = useState(false);
  const [placeSpinning, setPlaceSpinning] = useState(false);
  const [placeVisibleStart, setPlaceVisibleStart] = useState(0);

  // Toàn bộ 100% các quán ăn và cơ sở ẩm thực xác thực tại Xuân Hòa (Đồng bộ 2 chiều với Admin)
  const allPlaces = useMemo(() => {
    const active = getActivePublicPlaces();
    return active.length > 0 ? active : xuanHoaPlaces;
  }, [adminSyncTick]);

  // Eligible places filtered by Category, Kèo đi ăn, Meal Session, and Budget (Hoặc Địa Điểm Chơi khi mainMode === 'play')
  const eligiblePlaces = useMemo((): Place[] => {
    if (mainMode === 'play') {
      let playList: Place[] = xuanHoaPlaySpots;
      if (playCategory !== 'all') {
        const catFiltered = xuanHoaPlaySpots.filter(p => p.playCategory === playCategory);
        if (catFiltered.length) playList = catFiltered;
      }
      if (placeSession !== 'all') {
        const sessionList = playList.filter(p => isPlaceSuitableForSession(p, placeSession));
        if (sessionList.length) playList = sessionList;
      }
      return playList.length ? playList : xuanHoaPlaySpots;
    }

    let list = allPlaces;
    if (placeCategory !== 'all') {
      list = list.filter(p => getPlaceStyleGroup(p) === placeCategory);
    }
    if (placeKeo !== 'all') {
      const keoList = list.filter(p => isPlaceMatchKeo(p, placeKeo));
      if (keoList.length) list = keoList;
    }
    if (placeSession !== 'all') {
      const sessionList = list.filter(p => isPlaceSuitableForSession(p, placeSession));
      if (sessionList.length) list = sessionList;
    }
    if (placeBudget !== 'all') {
      if (placeBudget === 'custom') {
        const val = Number(placeCustomPrice);
        if (val > 0) {
          const budgetList = list.filter(p => p.minPrice <= val * 1.3 && p.maxPrice >= val * 0.7);
          if (budgetList.length) list = budgetList;
        }
      } else {
        const target = Number(placeBudget);
        let budgetList = list;
        if (target <= 35) budgetList = list.filter(p => p.minPrice <= 40);
        else if (target <= 50) budgetList = list.filter(p => p.minPrice <= 60);
        else if (target <= 75) budgetList = list.filter(p => p.minPrice <= 90 && p.maxPrice >= 35);
        else if (target <= 100) budgetList = list.filter(p => p.maxPrice >= 70);
        else budgetList = list.filter(p => p.maxPrice >= 120);
        if (budgetList.length) list = budgetList;
      }
    }
    return list.length ? list : allPlaces;
  }, [allPlaces, mainMode, playCategory, placeCategory, placeKeo, placeSession, placeBudget, placeCustomPrice]);

  const [visiblePlaceCount, setVisiblePlaceCount] = useState<number>(16);

  const displayedPlacesForInventory = useMemo((): Place[] => {
    const uniqueById = (arr: Place[]) => {
      const seen = new Set<string>();
      return arr.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    };

    if (placeSearchQuery.trim()) {
      const q = placeSearchQuery.toLowerCase().trim();
      const source = mainMode === 'play' ? xuanHoaPlaySpots : allPlaces;
      return uniqueById(source).filter(p => {
        const matchName = p.name.toLowerCase().includes(q);
        const matchAddress = p.address ? p.address.toLowerCase().includes(q) : false;
        const matchTagline = p.tagline ? p.tagline.toLowerCase().includes(q) : false;
        const matchTags = p.tags ? p.tags.some(t => t.toLowerCase().includes(q)) : false;
        const matchMenu = p.menu?.some(m => m.name.toLowerCase().includes(q)) ?? false;
        return matchName || matchAddress || matchTagline || matchTags || matchMenu;
      });
    }

    if (mainMode === 'play') {
      const shuffled = uniqueById(shuffleArray(eligiblePlaces));
      const happiIdx = shuffled.findIndex(p => p.id === 'khu-vui-choi-happi-kid');
      if (happiIdx > 0) {
        const [happi] = shuffled.splice(happiIdx, 1);
        shuffled.unshift(happi);
      }
      return shuffled;
    }

    return uniqueById(shuffleArray(eligiblePlaces));
  }, [allPlaces, mainMode, eligiblePlaces, placeSearchQuery, placeShuffleKey]);

  // Tự động reset về chuẩn 4x4 = 16 quán và xáo trộn ngẫu nhiên khi thay đổi bất kỳ bộ lọc hoặc tìm kiếm quán nào
  useEffect(() => {
    setVisiblePlaceCount(16);
    setPlaceShuffleKey(Date.now());
  }, [placeCategory, placeSession, placeKeo, placeBudget, placeCustomPrice]);

  // Place Reel State (Bắt đầu với dải quán ngẫu nhiên đa dạng phong cách)
  const [placeReel, setPlaceReel] = useState<{ place: Place; id: number }[]>(() => {
    const shuffled = shuffleArray(allPlaces);
    return shuffled.slice(0, 16).map((place, id) => ({ place, id }));
  });

  // Track animation references for Place Reel
  const placeTrack = useRef<HTMLDivElement>(null);
  const placeViewport = useRef<HTMLDivElement>(null);
  const placePosition = useRef(-400);
  const placeFrame = useRef(0);
  const placeBusy = useRef(false);

  const attachPlaceTrack = useCallback((node: HTMLDivElement | null) => {
    placeTrack.current = node;
    if (node) node.style.transform = `translate3d(${placePosition.current}px,0,0)`;
  }, []);

  // Sync place reel when eligible places change: Xáo trộn ngẫu nhiên toàn bộ danh sách quán
  useEffect(() => {
    if (placeSpinning || !eligiblePlaces.length) return;
    const shuffled = shuffleArray(eligiblePlaces);
    setPlaceReel(current => current.map((item, idx) => ({
      id: item.id,
      place: shuffled[idx % shuffled.length] || eligiblePlaces[0]
    })));
  }, [eligiblePlaces, placeSpinning]);

  useEffect(() => () => cancelAnimationFrame(placeFrame.current), []);

  // Audio Engine
  const audio = useRef<CaseAudio | null>(null);
  useEffect(() => {
    const engine = new CaseAudio(basePath);
    audio.current = engine;
    engine.preload();
    const hide = () => { if (document.hidden) engine.pause(); else engine.recover(); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      engine.dispose();
      audio.current = null;
    };
  }, []);

  // Track animation references
  const track = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const position = useRef(-400);
  const frame = useRef(0);
  const busy = useRef(false);
  const recentDishWinners = useRef<string[]>([]);
  const recentPlaceWinners = useRef<string[]>([]);

  const attachTrack = useCallback((node: HTMLDivElement | null) => {
    track.current = node;
    if (node) node.style.transform = `translate3d(${position.current}px,0,0)`;
  }, []);

  // Sync reel when eligible items change: Xáo trộn danh sách trước khi lọc độc bản để công bằng 100% giữa các quán
  useEffect(() => {
    if (spinning || !eligibleItems.length) return;
    const shuffledEligible = shuffleArray(eligibleItems);
    const uniquePool = getUniqueConceptFoods(shuffledEligible);
    const pool = uniquePool.length >= 6 ? uniquePool : shuffledEligible;
    const diversified = shuffleArray(pool);
    setReel(current => current.map((item, idx) => ({
      id: item.id,
      food: diversified[idx % diversified.length] || eligibleItems[0]
    })));
  }, [eligibleItems, spinning]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);


  const spinCase = () => {
    if (busy.current || !eligibleItems.length || !track.current || !viewport.current) return;
    incrementGlobalSpins();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(35); } catch {}
    }
    audio.current?.unlock();
    busy.current = true;

    // 1. Xáo trộn toàn bộ eligibleItems trước khi lọc Unique Concept để mọi quán đều có xác suất trúng ngang nhau
    const shuffledEligible = shuffleArray(eligibleItems);
    const uniquePool = getUniqueConceptFoods(shuffledEligible);
    const pool = uniquePool.length >= 6 ? uniquePool : (shuffledEligible.length ? shuffledEligible : shuffleArray(categoryItems));

    // 2. Chống lặp lại món vừa trúng ở 3 lượt quay gần nhất
    const getDishKey = (f: Food) => f.customId || `${f.name}-${f.price}`;
    const nonRepeatingPool = pool.length > 3
      ? pool.filter(f => !recentDishWinners.current.includes(getDishKey(f)) && getDishConceptKey(f) !== (winnerFood ? getDishConceptKey(winnerFood) : ''))
      : pool.length > 1
      ? pool.filter(f => getDishKey(f) !== (winnerFood ? getDishKey(winnerFood) : ''))
      : pool;
    const finalWinnerPool = nonRepeatingPool.length > 0 ? nonRepeatingPool : pool;
    const winner = finalWinnerPool[Math.floor(Math.random() * finalWinnerPool.length)];
    recentDishWinners.current = [...recentDishWinners.current.slice(-2), getDishKey(winner)];

    const step = 254;
    const tileWidth = 236;
    const width = viewport.current.clientWidth;
    const start = position.current;
    const center = Math.floor((width / 2 - start) / step);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const profile = createSpinProfile(Math.random, reducedMotion);
    const target = center + profile.tiles;
    const end = width / 2 - tileWidth * stopFraction() - target * step;

    const rightEdge = Math.ceil((width - start) / step) + 1;
    const items = reel.filter(item => item.id >= center - Math.ceil(width / step) - 2 && item.id <= rightEdge);
    const last = items.length ? Math.max(...items.map(item => item.id)) : 0;

    let prevFood = items.length ? items[items.length - 1].food : null;
    const recentConcepts = items.slice(-6).map(it => getDishConceptKey(it.food));
    const recentImages = items.slice(-6).map(it => it.food.customImage || it.food.image);

    for (let id = last + 1; id <= target + 4; id++) {
      let food: Food;
      if (id === target) {
        food = winner;
      } else {
        const windowConcepts = recentConcepts.slice(-4);
        const windowImages = recentImages.slice(-4);

        // Ưu tiên cao nhất: Khác concept món và khác ảnh tuyệt đối
        let candidates = pool.filter(f => 
          getDishConceptKey(f) !== getDishConceptKey(prevFood!) &&
          (f.customImage || f.image) !== (prevFood?.customImage || prevFood?.image) &&
          !windowConcepts.includes(getDishConceptKey(f)) &&
          !windowImages.includes(f.customImage || f.image)
        );

        if (!candidates.length) {
          candidates = pool.filter(f => 
            getDishConceptKey(f) !== getDishConceptKey(prevFood!) &&
            (f.customImage || f.image) !== (prevFood?.customImage || prevFood?.image) &&
            !windowConcepts.slice(-2).includes(getDishConceptKey(f))
          );
        }

        if (!candidates.length) {
          candidates = pool.filter(f => 
            getDishConceptKey(f) !== getDishConceptKey(prevFood!) &&
            (f.customImage || f.image) !== (prevFood?.customImage || prevFood?.image)
          );
        }

        if (!candidates.length) {
          candidates = pool.filter(f => f.name !== prevFood?.name);
        }

        const source = candidates.length ? candidates : pool;
        food = source[Math.floor(Math.random() * source.length)];
      }

      prevFood = food;
      recentConcepts.push(getDishConceptKey(food));
      recentImages.push(food.customImage || food.image);
      items.push({ id, food });
    }

    flushSync(() => {
      setReel(items);
      setSpinning(true);
    });

    audio.current?.play('csgo_ui_crate_open');
    const duration = profile.durationMs;
    const started = performance.now();
    let renderedStart = visibleStart;
    let lastCell = Math.floor((start - width / 2) / step);

    const animate = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - started) / duration));
      const next = start + (end - start) * spinProgress(progress, profile.friction);
      position.current = next;

      const firstVisible = Math.max(0, Math.floor(-next / step));
      if (firstVisible - renderedStart >= 4 || firstVisible < renderedStart) {
        renderedStart = Math.max(0, firstVisible - 2);
        setVisibleStart(renderedStart);
      }

      if (track.current) track.current.style.transform = `translate3d(${next}px,0,0)`;

      const cell = Math.floor((next - width / 2) / step);
      if (cell !== lastCell) {
        audio.current?.play('csgo_ui_crate_item_scroll');
        lastCell = cell;
      }

      if (progress < 1) {
        frame.current = requestAnimationFrame(animate);
        return;
      }

      // Spin complete: Add EXP & Level theo độ hiếm món
      const { profile: nextProf, reachedGuestLimit } = addSpinExp(winner.rarity, !!authUser?.isLoggedIn);
      setProfile(nextProf);

      // Tự động lưu món vào lịch sử món đã ăn
      const winnerId = winner.customId || `${winner.name}-${winner.price}`;
      const winnerImg = winner.customImage || (typeof winner.image === 'number' ? `food_${winner.image}.jpg` : String(winner.image));
      saveFoodHistoryItem({
        foodId: winnerId,
        name: winner.name,
        image: winnerImg,
        price: winner.price,
        placeName: getSpotsForDish(winner)[0]?.name,
      });

      if (reachedGuestLimit && (!authUser || !authUser.isLoggedIn)) {
        setIsGuestGateOpen(true);
      }

      busy.current = false;
      setSpinning(false);
      setWinnerFood(winner);
      setDialogOpen(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([40, 50, 70]); } catch {}
      }
      setDishShuffleKey(Date.now() + Math.random());

      const revealSounds = [
        'item_reveal3_rare', 
        'item_reveal4_mythical', 
        'item_reveal5_legendary', 
        'item_reveal6_ancient'
      ] as const;
      audio.current?.play(revealSounds[Math.min(winner.rarity, 3)]);
    };

    frame.current = requestAnimationFrame(animate);
  };

  // Master Spin function for Places (Quay Chọn Quán)
  const spinPlace = () => {
    if (placeBusy.current || !eligiblePlaces.length || !placeTrack.current || !placeViewport.current) return;
    incrementGlobalSpins();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(35); } catch {}
    }
    audio.current?.unlock();
    placeBusy.current = true;

    // Pick winner place (Xáo trộn và chống lặp lại quán vừa trúng ở 3 lượt gần nhất)
    const pool = shuffleArray(eligiblePlaces.length ? eligiblePlaces : allPlaces);
    const nonRepeatingPlaces = pool.length > 3
      ? pool.filter(p => !recentPlaceWinners.current.includes(p.id) && p.id !== winnerPlace?.id)
      : pool.length > 1
      ? pool.filter(p => p.id !== winnerPlace?.id)
      : pool;
    const finalPlacePool = nonRepeatingPlaces.length > 0 ? nonRepeatingPlaces : pool;
    const winner = finalPlacePool[Math.floor(Math.random() * finalPlacePool.length)];
    recentPlaceWinners.current = [...recentPlaceWinners.current.slice(-2), winner.id];

    const step = 260;
    const tileWidth = 242;
    const width = placeViewport.current.clientWidth;
    const start = placePosition.current;
    const center = Math.floor((width / 2 - start) / step);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const profile = createPlaceSpinProfile(Math.random, reducedMotion);
    const target = center + profile.tiles;
    const end = width / 2 - tileWidth * placeStopFraction() - target * step;

    const rightEdge = Math.ceil((width - start) / step) + 1;
    const items = placeReel.filter(item => item.id >= center - Math.ceil(width / step) - 2 && item.id <= rightEdge);
    const last = items.length ? Math.max(...items.map(item => item.id)) : 0;

    let prevPlace = items.length ? items[items.length - 1].place : null;
    const recentPlaceIds = items.slice(-4).map(it => it.place.id);
    for (let id = last + 1; id <= target + 4; id++) {
      let place: Place;
      if (id === target) {
        place = winner;
      } else {
        const recentWindow = recentPlaceIds.slice(-3);
        let poolWithoutRecent = pool.filter(p => p.id !== prevPlace?.id && !recentWindow.includes(p.id));
        if (!poolWithoutRecent.length) {
          poolWithoutRecent = pool.filter(p => p.id !== prevPlace?.id);
        }
        const source = poolWithoutRecent.length ? poolWithoutRecent : pool;
        place = source[Math.floor(Math.random() * source.length)];
      }
      prevPlace = place;
      recentPlaceIds.push(place.id);
      items.push({ id, place });
    }

    flushSync(() => {
      setPlaceReel(items);
      setPlaceSpinning(true);
    });

    audio.current?.play('csgo_ui_crate_open');
    const duration = profile.durationMs;
    const started = performance.now();
    let renderedStart = placeVisibleStart;
    let lastCell = Math.floor((start - width / 2) / step);

    const animate = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - started) / duration));
      const next = start + (end - start) * placeSpinProgress(progress, profile.friction);
      placePosition.current = next;

      const firstVisible = Math.max(0, Math.floor(-next / step));
      if (firstVisible - renderedStart >= 4 || firstVisible < renderedStart) {
        renderedStart = Math.max(0, firstVisible - 2);
        setPlaceVisibleStart(renderedStart);
      }

      if (placeTrack.current) placeTrack.current.style.transform = `translate3d(${next}px,0,0)`;

      const cell = Math.floor((next - width / 2) / step);
      if (cell !== lastCell) {
        audio.current?.play('csgo_ui_crate_item_scroll');
        lastCell = cell;
      }

      if (progress < 1) {
        placeFrame.current = requestAnimationFrame(animate);
        return;
      }

      // Spin complete: Add EXP & Level theo độ hiếm quán
      const { profile: nextProf, reachedGuestLimit } = addSpinExp(winner.rarity, !!authUser?.isLoggedIn);
      setProfile(nextProf);

      if (reachedGuestLimit && (!authUser || !authUser.isLoggedIn)) {
        setIsGuestGateOpen(true);
      }

      placeBusy.current = false;
      setPlaceSpinning(false);
      setWinnerPlace(winner);
      setPlaceModalOpen(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([40, 50, 70]); } catch {}
      }
      setPlaceShuffleKey(Date.now() + Math.random());

      const revealSounds = [
        'item_reveal3_rare', 
        'item_reveal4_mythical', 
        'item_reveal5_legendary', 
        'item_reveal6_ancient'
      ] as const;
      audio.current?.play(revealSounds[Math.min(winner.rarity, 3)]);
    };

    placeFrame.current = requestAnimationFrame(animate);
  };

  const currentSessionObj = MEAL_SESSIONS.find(s => s.id === session) || MEAL_SESSIONS[1];
  const expPercentage = profile.progressPercent ?? Math.min(100, Math.round(((profile.exp % 150) / 150) * 100));
  const memberRestriction = getMemberRestrictionStatus(authUser);

  if (currentView === 'admin') {
    return (
      <>
        <AdminDashboardView
          onBack={() => navigateTo('spin')}
          authUser={authUser}
          onOpenAuthModal={() => {
            setAuthModalStep(1);
            setIsAuthModalOpen(true);
          }}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          initialStep={authModalStep}
          existingUser={authUser}
          customNotice={authNotice}
          onClose={() => {
            setIsAuthModalOpen(false);
            setAuthNotice('');
          }}
          onSuccess={(user) => {
            setAuthUser(user);
            syncUserToAdminRegistry(user, profile.dishesCount, profile.level);
            setIsAuthModalOpen(false);
            setAuthNotice('');
            setAuthToastMsg(`Xin chào Quản trị viên ${user.nickname}!`);
            setTimeout(() => setAuthToastMsg(''), 3500);
          }}
        />
      </>
    );
  }

  return (
    <div className="site-shell">
      {memberRestriction.status === 'banned' && (
        <div
          style={{
            background: 'linear-gradient(90deg, #991B1B, #DC2626)',
            color: '#FFF',
            padding: '10px 16px',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 200,
          }}
        >
          <span>
            🚫 Tài khoản ({authUser?.email}) hiện đang bị khóa truy cập bởi Quản trị viên:{' '}
            {memberRestriction.banReason || 'Vi phạm quy chuẩn cộng đồng'}.
          </span>
        </div>
      )}

      {/* Header (Clean, Professional, No Emojis — Ẩn khi mở Bản đồ số full-screen để tối ưu 100% không gian) */}
      {currentView !== 'map' && (
      <header className="site-header">
        <div className="header-inner">
          <a 
            href="#/" 
            onClick={(e) => { 
              e.preventDefault(); 
              navigateTo('spin'); 
            }} 
            className="brand-box" 
            title="Xuân Hòa Có Gì"
          >
            <div className="brand-logo-mark">
              <img 
                src={`${basePath}/brand/brand-icon-mark.webp`} 
                alt="Logo Xuân Hòa Có Gì" 
                className="brand-logo-mark-img"
              />
            </div>
            <div className="brand-text-col">
              <div className="brand-name brand-name-domain">
                {t('brand_domain')}<span>{t('brand_suffix')}</span>
              </div>
              <div className="brand-tagline">
                {t('brand_tagline')}
              </div>
            </div>
          </a>

          {/* 🎯 TRUNG TÂM ĐIỀU HƯỚNG 4 CỤC TRÊN WEB PC: QUAY MÓN • QUÁN XÁ • BẢN ĐỒ SỐ • CÀI ĐẶT */}
          <nav className="desktop-header-nav header-btn-desktop-only" aria-label="Điều hướng chính">
            <button
              type="button"
              className={`desktop-header-nav-tab ${currentView === 'spin' ? 'active' : ''}`}
              onClick={() => navigateTo('spin')}
            >
              <RotateCw size={16} className="desktop-header-nav-icon" />
              <span>{t('dock_spin')}</span>
            </button>

            <button
              type="button"
              className={`desktop-header-nav-tab ${currentView === 'places' ? 'active' : ''}`}
              onClick={() => navigateTo('places')}
            >
              <Store size={16} className="desktop-header-nav-icon" />
              <span>{t('dock_places')}</span>
            </button>

            <button
              type="button"
              className={`desktop-header-nav-tab ${(currentView as AppView) === 'map' ? 'active' : ''}`}
              onClick={handleOpenMap}
            >
              <Map size={16} className="desktop-header-nav-icon" />
              <span>{lang === 'en' ? 'Digital Map' : 'Bản Đồ Số'}</span>
            </button>

            <button
              type="button"
              className={`desktop-header-nav-tab ${isSettingsMenuOpen ? 'active' : ''}`}
              onClick={() => setIsSettingsMenuOpen(true)}
            >
              <Settings size={16} className="desktop-header-nav-icon" />
              <span>{lang === 'en' ? 'Settings' : 'Cài Đặt'}</span>
            </button>
          </nav>

          <div className="header-right">
            {/* 🎯 CỘT CÂN ĐỐI: CẤP ĐỘ + THANH KÉO ĐIỂM Ở TRÊN, TỔNG LƯỢT QUAY Ở DƯỚI */}
            <div className="header-auth-counter-col">
              {/* Hàng 1: Cấp độ + Thanh kéo điểm (EXP Progress) */}
              <button
                type="button"
                className="header-level-progress-pill"
                onClick={() => setIsScoreboardOpen(true)}
                title={`${profile.badge || '🥉'} ${t('header_level')} ${profile.level}: ${profile.title} · ${profile.dishesCount}/${profile.nextLevelDishes} ${t('dishes_unit')} (${expPercentage}%)`}
              >
                <span className="header-level-pill-badge">{profile.badge || '🥉'} {t('header_level')} {profile.level}</span>
                <div className="header-level-mini-progress" title={`${expPercentage}%`}>
                  <div 
                    className="header-level-mini-fill" 
                    style={{ width: `${expPercentage}%` }} 
                  />
                </div>
                <span className="header-level-pill-points">
                  {profile.dishesCount}/{profile.nextLevelDishes} <span className="font-normal text-[10px] text-slate-400">{t('dishes_unit')}</span>
                </span>
              </button>

              {/* Hàng 2: Tổng Lượt Quay (Cân đối thẳng hàng bên dưới) */}
              <div className="header-sub-spin-counter" title={t('header_total_spins')}>
                <span className="sub-spin-label">{t('header_total_spins')}:</span>
                <span className="sub-spin-value">{globalSpinCount.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}</span>
              </div>
            </div>

            {/* 🎯 NÚT ĐĂNG NHẬP / HỒ SƠ GỌN GÀNG Ở CẠNH PHẢI */}
            <div className="header-action-icons-wrap header-btn-desktop-only">
              {!authUser || !authUser.isLoggedIn ? (
                <button 
                  type="button"
                  className="header-icon-action-btn header-auth-icon-btn"
                  onClick={() => {
                    setAuthNotice('');
                    setAuthModalStep(1);
                    setIsAuthModalOpen(true);
                  }}
                  title={t('login')}
                  aria-label={t('login')}
                >
                  <User size={22} className="text-amber-400" />
                </button>
              ) : (() => {
                const merchantShop = getPrimaryClaimedPlaceForUser(authUser);
                const isShopAcc = Boolean(merchantShop || authUser.isMerchantAccount);
                const displayTitle = merchantShop?.place.name || authUser.merchantPlaceName || authUser.nickname;
                return (
                  <button 
                    type="button"
                    className="header-icon-action-btn header-user-avatar-btn"
                    onClick={() => setIsUserProfileModalOpen(true)}
                    title={
                      isShopAcc
                        ? `🏪 Nick Quán Chính Chủ: ${displayTitle}`
                        : `${authUser.nickname} · ${t('dock_profile')}`
                    }
                    aria-label={t('dock_profile')}
                  >
                    <span className="text-2xl leading-none">{isShopAcc ? '🏪' : authUser.avatar || '🐱'}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </header>
      )}

      {/* Main Container */}
      <main
        className="main-wrapper"
        style={
          currentView === 'map'
            ? { maxWidth: '100%', width: '100%', padding: 0, margin: 0 }
            : undefined
        }
      >
        {currentView === 'spin' && (
          <>
            {/* ========================================================
                1. DESKTOP EXPERIENCE: Bàn điều khiển đầy đủ & hoành tráng
                ======================================================== */}
            <div className="desktop-experience-deck">
              {/* HƯỚNG B TỐI GIẢN: 4 TAB NGANG HÀNG (ĂN GÌ | NHẬU GÌ | UỐNG GÌ | QUÁN XÁ & VUI CHƠI) */}
              <section className="central-console">
                {/* Row 1 (PC): 4 Tab Ngang Hàng Cân Đối */}
                <div className="category-nav-bar category-nav-bar-dish">
                  {MAIN_CATEGORIES.map(cat => {
                    const catLabel = cat.id === 'an-gi' ? t('today_eat') : cat.id === 'nhau-gi' ? t('today_pub') : t('today_drink');
                    const isTabActive = mainMode === 'dish' && activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        className={`category-nav-tab ${isTabActive ? 'active' : ''}`}
                        onClick={() => {
                          if (!spinning && !placeSpinning) {
                            setMainMode('dish');
                            setActiveCategory(cat.id);
                            setDishSearchQuery('');
                            setNhauSubFilter('all');
                            setDrinkSubFilter('all');
                            setBudget('all');
                            setCaseTier('all');
                            setVisibleDishCount(18);
                          }
                        }}
                        disabled={spinning || placeSpinning}
                      >
                        {catLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Row 2 (PC): Bộ lọc chi tiết theo Món hoặc theo Quán Xá & Vui Chơi */}
                {mainMode === 'dish' ? (
                  <div className="luxury-filter-bar">
                    {activeCategory === 'an-gi' && (
                      <div className="session-filter-group">
                        <span className="control-label inline-flex items-center gap-1.5">
                          <Clock size={13} className="text-amber-400 shrink-0" />
                          {t('session_label')}
                        </span>
                        <div className="session-pills-wrap session-pills-6">
                          {MEAL_SESSIONS.map((s) => {
                            const isLive = s.id === liveSession;
                            const isSelected = session === s.id;
                            const sessionName = s.id === 'morning' ? t('session_morning')
                              : s.id === 'noon' ? t('session_noon')
                              : s.id === 'afternoon' ? t('session_afternoon')
                              : s.id === 'evening' ? t('session_evening')
                              : t('session_night');
                            return (
                              <button
                                key={s.id}
                                type="button"
                                className={`session-pill-btn ${isSelected ? 'active' : ''}`}
                                onClick={() => setSession(s.id)}
                                disabled={spinning}
                                title={`${sessionName} (${s.timeRange})`}
                              >
                                {isLive && <span className="live-gem-indicator mr-1.5" />}
                                {sessionName}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            className={`session-pill-btn ${session === 'all' ? 'active' : ''}`}
                            onClick={() => setSession('all')}
                            disabled={spinning}
                          >
                            {t('session_all_day')}
                          </button>
                        </div>
                      </div>
                    )}

                    {activeCategory === 'nhau-gi' && (
                      <div className="session-filter-group">
                        <span className="control-label inline-flex items-center gap-1.5">
                          <Flame size={13} className="text-orange-400 shrink-0" />
                          {t('pub_filter_label')}
                        </span>
                        <div className="session-pills-wrap session-pills-4">
                          <button type="button" className={`session-pill-btn ${nhauSubFilter === 'all' ? 'active' : ''}`} onClick={() => setNhauSubFilter('all')} disabled={spinning}>{t('pub_all')}</button>
                          <button type="button" className={`session-pill-btn ${nhauSubFilter === 'lau-nuong' ? 'active' : ''}`} onClick={() => setNhauSubFilter('lau-nuong')} disabled={spinning}>{t('pub_hotpot_grill')}</button>
                          <button type="button" className={`session-pill-btn ${nhauSubFilter === 'oc-haisan' ? 'active' : ''}`} onClick={() => setNhauSubFilter('oc-haisan')} disabled={spinning}>{t('pub_snails_seafood')}</button>
                          <button type="button" className={`session-pill-btn ${nhauSubFilter === 'bia-moi' ? 'active' : ''}`} onClick={() => setNhauSubFilter('bia-moi')} disabled={spinning}>{t('pub_beer_bites')}</button>
                        </div>
                      </div>
                    )}

                    {activeCategory === 'uong-gi' && (
                      <div className="session-filter-group">
                        <span className="control-label inline-flex items-center gap-1.5">
                          <Coffee size={13} className="text-sky-400 shrink-0" />
                          {t('drink_filter_label')}
                        </span>
                        <div className="session-pills-wrap session-pills-4">
                          <button type="button" className={`session-pill-btn ${drinkSubFilter === 'all' ? 'active' : ''}`} onClick={() => setDrinkSubFilter('all')} disabled={spinning}>{t('drink_all')}</button>
                          <button type="button" className={`session-pill-btn ${drinkSubFilter === 'tra-sua' ? 'active' : ''}`} onClick={() => setDrinkSubFilter('tra-sua')} disabled={spinning}>{t('drink_milktea')}</button>
                          <button type="button" className={`session-pill-btn ${drinkSubFilter === 'cafe' ? 'active' : ''}`} onClick={() => setDrinkSubFilter('cafe')} disabled={spinning}>{t('drink_coffee')}</button>
                          <button type="button" className={`session-pill-btn ${drinkSubFilter === 'tra-traicay' ? 'active' : ''}`} onClick={() => setDrinkSubFilter('tra-traicay')} disabled={spinning}>{t('drink_fruittea')}</button>
                        </div>
                      </div>
                    )}

                    <div className="luxury-bar-divider" />

                    <div className="luxury-budget-control-wrap">
                      <BudgetDropdown value={budget} onChange={val => setBudget(val)} disabled={spinning} />
                      {budget === 'custom' && (
                        <div className="custom-budget-input-wrap">
                          <input type="number" min="15" max="500" step="5" className="custom-budget-input" value={customPrice} onChange={e => setCustomPrice(e.target.value)} disabled={spinning} />
                          <span className="custom-budget-suffix">.000đ</span>
                        </div>
                      )}
                    </div>

                    <div className="luxury-taste-filter-wrap">
                      {authUser?.isLoggedIn ? (
                        <button type="button" className={`taste-filter-toggle-pill ${authUser.filterByTaste !== false ? 'active' : ''}`} onClick={handleToggleTasteFilter} disabled={spinning}>
                          <span className="taste-filter-icon">🎯</span>
                          <span className="taste-filter-text">{authUser.filterByTaste !== false ? t('taste_pill_on') : t('taste_pill_off')}</span>
                          <span className={`taste-filter-indicator ${authUser.filterByTaste !== false ? 'active' : ''}`} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="taste-filter-toggle-pill guest"
                          onClick={() => {
                            setAuthNotice(lang === 'en' ? 'Sign in with Google to enable taste-based filtering' : 'Đăng nhập Google để bật bộ lọc theo gu khẩu vị của bạn');
                            setAuthModalStep(1);
                            setIsAuthModalOpen(true);
                          }}
                        >
                          <span className="taste-filter-icon">🎯</span>
                          <span className="taste-filter-text">{t('taste_filter_nav_btn')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Row 2 (PC) khi chọn tab thứ 4: Quán Xá & Vui Chơi */
                  <div className="luxury-filter-bar">
                    <div className="session-filter-group">
                      <span className="control-label inline-flex items-center gap-1.5">
                        <Store size={13} className="text-amber-400 shrink-0" />
                        <span>PHÂN LOẠI:</span>
                      </span>
                      <div className="session-pills-wrap session-pills-6">
                        <button type="button" className={`session-pill-btn ${placeCategory === 'all' ? 'active' : ''}`} onClick={() => { setPlaceCategory('all'); setPlaceSession('all'); setPlaceKeo('all'); setPlaceBudget('all'); }} disabled={placeSpinning}>Tất cả ({allPlaces.length})</button>
                        <button type="button" className={`session-pill-btn ${placeCategory === 'an-chinh' ? 'active' : ''}`} onClick={() => setPlaceCategory('an-chinh')} disabled={placeSpinning}>Cơm & Bún Phở</button>
                        <button type="button" className={`session-pill-btn ${placeCategory === 'nhau-lau' ? 'active' : ''}`} onClick={() => setPlaceCategory('nhau-lau')} disabled={placeSpinning}>Nhậu & Lẩu</button>
                        <button type="button" className={`session-pill-btn ${placeCategory === 'uong' ? 'active' : ''}`} onClick={() => setPlaceCategory('uong')} disabled={placeSpinning}>Cafe & Đồ Uống</button>
                        <button type="button" className={`session-pill-btn ${placeCategory === 'an-vat' ? 'active' : ''}`} onClick={() => setPlaceCategory('an-vat')} disabled={placeSpinning}>Ăn Vặt</button>
                        <button type="button" className={`session-pill-btn ${placeCategory === 'vui-choi' ? 'active' : ''}`} onClick={() => setPlaceCategory('vui-choi')} disabled={placeSpinning}>🎮 Vui Chơi & Giải Trí</button>
                      </div>
                    </div>

                    <div className="luxury-bar-divider" />

                    <div className="place-filters-dropdowns-row">
                      <PlaceKeoDropdown value={placeKeo} onChange={setPlaceKeo} disabled={placeSpinning} />
                      <div className="luxury-budget-control-wrap">
                        <BudgetDropdown value={placeBudget} onChange={val => setPlaceBudget(val)} disabled={placeSpinning} />
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

      {/* ========================================================
          2. MOBILE DEDICATED APP DECK: Tinh gọn 1 màn hình, 1-chạm
             (Chỉ còn đúng 4 Tab Ngang Hàng: Món Ăn | Kèo Nhậu | Đồ Uống | Quán Xá)
          ======================================================== */}
      <div className="mobile-experience-deck">
        <div className="mobile-filter-matrix">
          {/* Tầng 1 (Mobile): 4 Tab chia đều 4 cột vừa khít 1 dòng: Món Ăn - Kèo Nhậu - Đồ Uống - Quán Xá */}
          <div className="mobile-category-grid">
            <button
              type="button"
              className={`mobile-cat-pill ${mainMode === 'dish' && activeCategory === 'an-gi' ? 'active' : ''}`}
              onClick={() => {
                if (!spinning && !placeSpinning) {
                  setMainMode('dish');
                  setActiveCategory('an-gi');
                  setDishSearchQuery('');
                  setNhauSubFilter('all');
                  setDrinkSubFilter('all');
                  setVisibleDishCount(18);
                }
              }}
              disabled={spinning || placeSpinning}
            >
              <UtensilsCrossed size={11} className="shrink-0" />
              <span>{t('mobile_cat_food')}</span>
            </button>
            <button
              type="button"
              className={`mobile-cat-pill ${mainMode === 'dish' && activeCategory === 'nhau-gi' ? 'active' : ''}`}
              onClick={() => {
                if (!spinning && !placeSpinning) {
                  setMainMode('dish');
                  setActiveCategory('nhau-gi');
                  setDishSearchQuery('');
                  setNhauSubFilter('all');
                  setVisibleDishCount(18);
                }
              }}
              disabled={spinning || placeSpinning}
            >
              <Flame size={11} className="shrink-0 text-orange-400" />
              <span>{t('mobile_cat_pub')}</span>
            </button>
            <button
              type="button"
              className={`mobile-cat-pill ${mainMode === 'dish' && activeCategory === 'uong-gi' ? 'active' : ''}`}
              onClick={() => {
                if (!spinning && !placeSpinning) {
                  setMainMode('dish');
                  setActiveCategory('uong-gi');
                  setDishSearchQuery('');
                  setDrinkSubFilter('all');
                  setVisibleDishCount(18);
                }
              }}
              disabled={spinning || placeSpinning}
            >
              <Coffee size={11} className="shrink-0 text-sky-400" />
              <span>{t('mobile_cat_drink')}</span>
            </button>
          </div>

          {/* Tầng 2 (Mobile): 2 Dropdown hộp bấm song song 50/50 */}
          {mainMode === 'dish' ? (
            <div className="mobile-dropdowns-row">
              <div className="mobile-dropdown-half">
                {activeCategory === 'an-gi' ? (
                  <SessionDropdown
                    value={session}
                    onChange={setSession}
                    liveSession={liveSession}
                    disabled={spinning}
                  />
                ) : activeCategory === 'nhau-gi' ? (
                  <div className="relative inline-block text-left w-full">
                    <select
                      value={nhauSubFilter}
                      onChange={e => setNhauSubFilter(e.target.value as any)}
                      disabled={spinning}
                      className="luxury-filter-trigger w-full mobile-select-clean"
                    >
                      <option value="all">🔥 {t('pub_all')} ({t('today_pub')})</option>
                      <option value="lau-nuong">🍲 {t('pub_hotpot_grill')}</option>
                      <option value="oc-haisan">🐚 {t('pub_snails_seafood')}</option>
                      <option value="bia-moi">🍻 {t('pub_beer_bites')}</option>
                    </select>
                  </div>
                ) : (
                  <div className="relative inline-block text-left w-full">
                    <select
                      value={drinkSubFilter}
                      onChange={e => setDrinkSubFilter(e.target.value as any)}
                      disabled={spinning}
                      className="luxury-filter-trigger w-full mobile-select-clean"
                    >
                      <option value="all">☕ {t('drink_all')} ({t('today_drink')})</option>
                      <option value="tra-sua">🧋 {t('drink_milktea')}</option>
                      <option value="cafe">☕ {t('drink_coffee')}</option>
                      <option value="tra-traicay">🍹 {t('drink_fruittea')}</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="mobile-dropdown-half">
                <BudgetDropdown
                  value={budget}
                  onChange={val => setBudget(val)}
                  disabled={spinning}
                />
              </div>
            </div>
          ) : (
            /* Khi bấm vào tab thứ 4 "Quán Xá" trên Mobile: 2 Dropdown 50/50 chọn Danh Mục Quán/Chỗ Chơi & Kèo */
            <div className="mobile-dropdowns-row">
              <div className="mobile-dropdown-half">
                <div className="relative inline-block text-left w-full">
                  <select
                    value={placeCategory}
                    onChange={e => setPlaceCategory(e.target.value as any)}
                    disabled={placeSpinning}
                    className="luxury-filter-trigger w-full mobile-select-clean"
                  >
                    <option value="all">🏪 Tất cả Quán Xá ({allPlaces.length})</option>
                    <option value="an-chinh">🍚 Cơm & Bún Phở</option>
                    <option value="nhau-lau">🍻 Nhậu & Lẩu Nướng</option>
                    <option value="uong">☕ Cafe & Đồ Uống</option>
                    <option value="an-vat">🍢 Quán Ăn Vặt</option>
                    <option value="vui-choi">🎮 Vui Chơi & Giải Trí</option>
                  </select>
                </div>
              </div>
              <div className="mobile-dropdown-half">
                <PlaceKeoDropdown
                  value={placeKeo}
                  onChange={setPlaceKeo}
                  disabled={placeSpinning}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Case Roulette Reel Window */}
      <section className="case-roulette-panel" aria-label="Vòng quay lựa chọn">
        <div className="reel-window" ref={mainMode === 'dish' ? viewport : placeViewport}>
          <div className="gold-needle-pointer" />
          {mainMode === 'dish' ? (
            <div className="reel-track" ref={attachTrack}>
              {reel
                .filter(({ id }) => id >= visibleStart && id < visibleStart + 12)
                .map(({ food, id }) => (
                  <div 
                    key={id}
                    className="reel-food-card"
                    style={{
                      left: id * 254,
                      ['--rarity-color' as any]: rarityColors[food.rarity] || '#D4AF37'
                    }}
                    onClick={() => {
                      if (!spinning) {
                        setWinnerFood(food);
                        setDialogOpen(true);
                      }
                    }}
                  >
                    <div className="reel-card-top-tag">
                      <span>{rarityNames[food.rarity ?? 0]}</span>
                      <span className="dish-corner-star-badge" title="Đánh giá chất lượng món">
                        <Star size={10} className="inline mr-1 text-amber-400 fill-amber-400" />
                        <span>{getDishRatingSummary(food.customId || food.name).displayRating}</span>
                      </span>
                    </div>
                    <div className="reel-card-art-area">
                      <div className="food-plate-halo">
                        <FoodImage food={food} size="md" />
                      </div>
                    </div>
                    <div className="reel-card-footer">
                      <strong>{cleanDishDisplayTitle(food.name)}</strong>
                      <span>{food.price}.000đ</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="reel-track" ref={attachPlaceTrack}>
              {placeReel
                .filter(({ id }) => id >= placeVisibleStart && id < placeVisibleStart + 12)
                .map(({ place, id }) => (
                  <PlaceCard
                    key={id}
                    place={place}
                    slot={id}
                    isReel={true}
                    onClick={() => {
                      if (!placeSpinning) {
                        setWinnerPlace(place);
                        setPlaceModalOpen(true);
                      }
                    }}
                  />
                ))}
            </div>
          )}
          <div className="reel-fade-side left" />
          <div className="reel-fade-side right" />
        </div>
      </section>

      {/* CENTERED ACTION BUTTONS (Hero Stage Action) */}
      <div className="action-center-container">
        {mainMode === 'dish' ? (
          <div className="action-button-group">
            <button 
              className="master-action-btn"
              onClick={spinCase}
              disabled={spinning || !eligibleItems.length}
            >
              {spinning ? (
                <span className="flex items-center gap-2">
                  <RotateCw size={18} className="animate-spin" />
                  {t('spin_rolling_cta')}
                </span>
              ) : winnerFood ? (
                <span>{t('spin_again_cta')}</span>
              ) : (
                <span>{t('spin_food_cta')}</span>
              )}
            </button>
          </div>
        ) : (
          <div className="action-button-group">
            <button 
              className="master-action-btn"
              onClick={spinPlace}
              disabled={placeSpinning || !eligiblePlaces.length}
            >
              {placeSpinning ? (
                <span className="flex items-center gap-2">
                  <RotateCw size={18} className="animate-spin" />
                  {t('spin_rolling_cta')}
                </span>
              ) : winnerPlace ? (
                <span>{t('spin_again_cta')}</span>
              ) : (
                <span>{t('spin_place_cta')}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Grid Inventory Section (Món Ăn hoặc Quán Xá & Vui Chơi) */}
      {mainMode === 'dish' ? (
        <section className="inventory-section">
          <div id="inventory-dish-anchor" style={{ position: 'relative', top: '-24px' }} />
          <div className="inventory-heading-row">
            <div className="inventory-title-col">
              <h2>
                {t('inventory_title')}{' '}
                <span>
                  {inventoryMode === 'unique' 
                    ? `${uniqueEligibleDishes.length} ${lang === 'en' ? 'unique dishes' : 'món độc bản'}` 
                    : `${eligibleItems.length} ${t('dishes_unit')}`}
                </span>
              </h2>
              <span className="inventory-hint">
                {inventoryMode === 'unique'
                  ? t('inventory_dish_desc_unique')
                  : t('inventory_dish_desc_all')}
              </span>
            </div>

            <div className="inventory-controls-col">
              <div className="inventory-mode-toggle">
                <button
                  type="button"
                  onClick={() => setInventoryMode('all')}
                  className={`inventory-mode-btn ${inventoryMode === 'all' ? 'active-all' : ''}`}
                >
                  <Layers size={13} className="shrink-0 text-amber-400" />
                  <span>{t('inventory_all_dishes')} ({eligibleItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryMode('unique')}
                  className={`inventory-mode-btn ${inventoryMode === 'unique' ? 'active-unique' : ''}`}
                >
                  <Sparkles size={13} className="shrink-0 text-amber-400" />
                  <span>{t('inventory_unique_dishes')} ({uniqueEligibleDishes.length})</span>
                </button>
              </div>
            </div>
          </div>

          <div className="inventory-grid">
            {displayedDishes.length === 0 ? (
              <div className="col-span-full py-12 px-4 text-center flex flex-col items-center justify-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl my-2">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 mb-3">
                  <Search size={22} />
                </div>
                <p className="text-neutral-200 font-semibold text-base mb-1">
                  Không tìm thấy {activeCategory === 'uong-gi' ? 'đồ uống' : activeCategory === 'nhau-gi' ? 'món nhậu' : 'món ăn'} nào khớp với "{dishSearchQuery}"
                </p>
                <button
                  type="button"
                  onClick={() => setDishSearchQuery('')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-bold text-xs rounded-xl mt-2"
                >
                  Xem tất cả {eligibleItems.length} món trong kho
                </button>
              </div>
            ) : (
              displayedDishes
                .slice(0, visibleDishCount)
                .map((food, idx) => {
                  const rarity = food.rarity ?? 0;
                  const rarityColor = rarityColors[rarity] || '#06B6D4';
                  const rarityName = rarityNames[rarity] || 'Phổ thông';
                  const categoryLabel = getFoodCategoryLabel(food);
                  const displayTitle = cleanDishDisplayTitle(food.name);

                  return (
                    <div 
                      key={`${food.customId || food.name}-${food.price}-${idx}`}
                      className="catalog-food-card"
                      style={{
                        ['--rarity-color' as any]: rarityColor
                      }}
                      onClick={() => {
                        setWinnerFood(food);
                        setDialogOpen(true);
                      }}
                    >
                      <div className="catalog-card-art">
                        <div className="catalog-card-star-badge" title="Đánh giá chất lượng món">
                          <Star size={10} className="inline mr-1 text-amber-400 fill-amber-400" />
                          <span>{getDishRatingSummary(food.customId || food.name).displayRating}</span>
                        </div>
                        <div className="food-plate-halo">
                          <FoodImage food={food} size="md" />
                        </div>
                      </div>
                      <div className="catalog-card-details">
                        <span className="catalog-category-tag" title={categoryLabel}>
                          {categoryLabel}
                        </span>
                        <strong className="catalog-item-name" title={displayTitle}>
                          {formatTypography(displayTitle)}
                        </strong>
                        <div className="catalog-card-bottom-row">
                          <span className="catalog-item-price">{food.price}.000đ</span>
                          <span className="catalog-card-rarity-label">
                            {rarityName.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {displayedDishes.length > 18 && (
            <div className="inventory-pagination-bar">
              <div className="pagination-info">
                <span>
                  Đang hiển thị <strong>{Math.min(visibleDishCount, displayedDishes.length)}</strong> / <strong>{displayedDishes.length}</strong> món {dishSearchQuery.trim() ? 'phù hợp' : 'đề xuất'}
                </span>
                <div className="pagination-progress-track">
                  <div 
                    className="pagination-progress-fill" 
                    style={{ width: `${Math.min(100, Math.round((Math.min(visibleDishCount, displayedDishes.length) / displayedDishes.length) * 100))}%` }} 
                  />
                </div>
              </div>
              <div className="pagination-actions">
                {displayedDishes.length > visibleDishCount && (
                  <>
                    <button type="button" className="btn-load-more" onClick={() => setVisibleDishCount(prev => prev + 18)}>
                      <ChevronDown size={16} />
                      <span>Xem tiếp (+{Math.min(18, displayedDishes.length - visibleDishCount)})</span>
                    </button>
                    <button type="button" className="btn-load-all" onClick={() => setVisibleDishCount(displayedDishes.length)}>
                      <span>Xem tất cả ({displayedDishes.length})</span>
                    </button>
                  </>
                )}
                {visibleDishCount > 18 && (
                  <button
                    type="button"
                    className="btn-collapse"
                    onClick={() => {
                      setVisibleDishCount(18);
                      const el = document.getElementById('inventory-dish-anchor');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronUp size={16} />
                    <span>Thu gọn (về 18 món)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-slate-500 italic mt-3 mb-1 select-none">
            * Lưu ý: Hình ảnh mang tính chất minh họa cho sản phẩm. Quý khách vui lòng liên hệ quán để được tư vấn chi tiết hơn.
          </p>
        </section>
      ) : (
        <section className="inventory-section">
          <div id="inventory-place-anchor" style={{ position: 'relative', top: '-24px' }} />
          <div className="inventory-heading-row">
            <div className="inventory-title-col">
              <h2>
                {placeCategory === 'vui-choi' ? 'Điểm vui chơi & giải trí tại Xuân Hòa' : t('inventory_place_title')}{' '}
                <span>{displayedPlacesForInventory.length} {placeCategory === 'vui-choi' ? 'địa điểm' : (lang === 'en' ? 'places' : 'quán')}</span>
              </h2>
              <span className="inventory-hint">
                {placeCategory === 'vui-choi'
                  ? 'Tổng hợp Khu vui chơi, Bi-a, Quán Game & Giải trí — bấm vào địa điểm để xem bảng giá, giờ mở cửa và chỉ đường'
                  : t('inventory_place_desc')}
              </span>
            </div>
          </div>

          <div className="places-grid">
            {displayedPlacesForInventory
              .slice(0, visiblePlaceCount)
              .map(place => (
              <PlaceCard 
                key={place.id}
                place={place}
                onClick={() => {
                  setWinnerPlace(place);
                  setPlaceModalOpen(true);
                }}
              />
            ))}
          </div>

          {displayedPlacesForInventory.length > 16 && (
            <div className="inventory-pagination-bar">
              <div className="pagination-info">
                <span>
                  Đang hiển thị <strong>{Math.min(visiblePlaceCount, displayedPlacesForInventory.length)}</strong> / <strong>{displayedPlacesForInventory.length}</strong> quán đề xuất
                </span>
                <div className="pagination-progress-track">
                  <div 
                    className="pagination-progress-fill" 
                    style={{ width: `${Math.min(100, Math.round((Math.min(visiblePlaceCount, displayedPlacesForInventory.length) / displayedPlacesForInventory.length) * 100))}%` }} 
                  />
                </div>
              </div>
              <div className="pagination-actions">
                {displayedPlacesForInventory.length > visiblePlaceCount && (
                  <>
                    <button
                      type="button"
                      className="btn-load-more"
                      onClick={() => {
                        setVisiblePlaceCount(prev => {
                          const next = prev + 16;
                          if (displayedPlacesForInventory.length - next <= 4) {
                            return displayedPlacesForInventory.length;
                          }
                          return next;
                        });
                      }}
                    >
                      <ChevronDown size={16} />
                      <span>Xem tiếp (+{Math.min(16, displayedPlacesForInventory.length - visiblePlaceCount)})</span>
                    </button>
                    <button type="button" className="btn-load-all" onClick={() => setVisiblePlaceCount(displayedPlacesForInventory.length)}>
                      <span>Xem tất cả ({displayedPlacesForInventory.length})</span>
                    </button>
                  </>
                )}
                {visiblePlaceCount > 16 && (
                  <button
                    type="button"
                    className="btn-collapse"
                    onClick={() => {
                      setVisiblePlaceCount(16);
                      const el = document.getElementById('inventory-place-anchor');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronUp size={16} />
                    <span>Thu gọn (về 16 quán - 4x4)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  )}

    {currentView === 'dishes' && (
      <DishesCatalogView
        initialCategory={activeCategory}
        onSelectDish={(dish) => {
          setWinnerFood(dish);
          setDialogOpen(true);
        }}
        onSpinWithDish={(dish) => {
          setActiveCategory(dish.categoryKey);
          setMainMode('dish');
          navigateTo('spin');
        }}
        onGoToSpin={() => navigateTo('spin')}
        onGoToPlaces={() => navigateTo('places')}
      />
    )}

    {currentView === 'places' && (
      <PlacesCatalogView
        onSelectPlace={(place) => {
          setWinnerPlace(place);
          setPlaceModalOpen(true);
        }}
        onGoToSpin={() => navigateTo('spin')}
        onGoToDishes={() => navigateTo('places')}
      />
    )}

    {currentView === 'map' && (
      <DigitalMapView
        onBackToHome={() => navigateTo('spin')}
        authUser={authUser}
        onOpenLogin={() => {
          setAuthNotice('Đăng nhập tài khoản Google để lưu địa điểm yêu thích và sử dụng đầy đủ tính năng Bản đồ số!');
          setAuthModalStep(1);
          setIsAuthModalOpen(true);
        }}
      />
    )}

    {currentView === 'guide' && (
      <UserGuideView
        onGoToSpin={() => navigateTo('spin')}
        onGoToDishes={() => navigateTo('dishes')}
        onGoToPlaces={() => navigateTo('places')}
        onGoToAbout={() => navigateTo('about')}
      />
    )}

    {currentView === 'about' && (
      <AboutView
        onGoToSpin={() => navigateTo('spin')}
        onGoToDishes={() => navigateTo('dishes')}
        onGoToPlaces={() => navigateTo('places')}
      />
    )}

    {currentView === 'coming-soon' && (
      <ComingSoonView
        onGoToSpin={() => navigateTo('spin')}
        onGoToDishes={() => navigateTo('dishes')}
        onGoToPlaces={() => navigateTo('places')}
      />
    )}
  </main>

  {/* Winner Modal (Món Ăn) */}
  <WinnerDialog 
    food={winnerFood}
    isOpen={dialogOpen}
    onClose={() => setDialogOpen(false)}
    onSpinAgain={spinCase}
    allActiveFoods={eligibleItems}
    onSelectFood={(f) => setWinnerFood(f)}
    onSelectPlace={(p) => {
      setDialogOpen(false);
      setWinnerPlace(p);
      setPlaceModalOpen(true);
    }}
    authUser={authUser}
    onOpenLogin={() => {
      setAuthNotice('Đăng nhập tài khoản Google để xem địa chỉ quán, hotline và đánh giá món ăn nhé!');
      setAuthModalStep(1);
      setIsAuthModalOpen(true);
    }}
  />

  {/* Place Modal (Quán Ăn) */}
  <PlaceModal 
    place={winnerPlace}
    isOpen={placeModalOpen}
    onClose={() => setPlaceModalOpen(false)}
    onSpinAgain={spinPlace}
    allPlaces={allPlaces}
    onSelectPlace={setWinnerPlace}
    authUser={authUser}
    onOpenLogin={() => {
      setAuthNotice('Đăng nhập tài khoản Google để xem hotline, bản đồ và gửi đánh giá cho quán nhé!');
      setAuthModalStep(1);
      setIsAuthModalOpen(true);
    }}
  />

  {/* Modal Cảnh báo thăng cấp khi chạm trần Cấp 1 dành cho Khách Vãng Lai */}
  <GuestUpgradeGateModal
    isOpen={isGuestGateOpen}
    onClose={() => setIsGuestGateOpen(false)}
    onOpenLogin={() => {
      setIsGuestGateOpen(false);
      setAuthModalStep(1);
      setIsAuthModalOpen(true);
    }}
  />

  {/* Settings Menu Modal (4 ô tinh gọn: Ngôn ngữ, Âm lượng, Hướng dẫn, Cộng đồng) */}
  <SettingsMenuModal 
    isOpen={isSettingsMenuOpen}
    onClose={() => setIsSettingsMenuOpen(false)}
    sound={sound}
    onToggleSound={toggleSound}
    onOpenGuide={() => navigateTo('guide')}
    onOpenAbout={() => navigateTo('about')}
    currentLang={lang}
    onChangeLang={changeLanguage}
    authUser={authUser}
    onToggleTasteFilter={handleToggleTasteFilter}
    onOpenLogin={() => {
      setAuthNotice('');
      setAuthModalStep(1);
      setIsAuthModalOpen(true);
    }}
    onOpenProfile={() => setIsUserProfileModalOpen(true)}
  />

  {/* Bảng Điểm Thực Khách Chuyên Nghiệp (Scorecard Modal) */}
  <GourmetScoreboardModal
    isOpen={isScoreboardOpen}
    onClose={() => setIsScoreboardOpen(false)}
    profile={profile}
    authUser={authUser}
    onOpenLogin={() => {
      setIsScoreboardOpen(false);
      setAuthNotice('');
      setAuthModalStep(1);
      setIsAuthModalOpen(true);
    }}
    onContinueSpinning={() => {
      setIsScoreboardOpen(false);
      navigateTo('spin');
    }}
  />

  {/* Modal Đăng nhập & Thiết lập nhanh (Bước 1 & Bước 2) */}
  <AuthModal 
    isOpen={isAuthModalOpen}
    onClose={() => setIsAuthModalOpen(false)}
    onSuccess={(user) => {
      setAuthUser(user);
      setAuthToastMsg(`Đã kết nối Google: ${user.email || user.nickname}`);
      setTimeout(() => setAuthToastMsg(''), 4000);
    }}
    initialStep={authModalStep}
    existingUser={authUser}
    customNotice={authNotice}
  />

  {/* Modal Hồ sơ Cá nhân Chi tiết khi đã đăng nhập */}
  {authUser && authUser.isLoggedIn && (
    <UserProfileModal 
      isOpen={isUserProfileModalOpen}
      onClose={() => setIsUserProfileModalOpen(false)}
      user={authUser}
      profile={profile}
      onOpenScoreboard={() => setIsScoreboardOpen(true)}
      onEditProfile={() => {
        setAuthModalStep(2);
        setIsAuthModalOpen(true);
      }}
      onSignOut={() => {
        clearAuthUser();
        setAuthUser(null);
      }}
    />
  )}

  {/* Toast thông báo Đã kết nối Google thành công */}
  {authToastMsg && (
    <div className="map-dev-toast">
      <GoogleGIcon size={18} />
      <span>{authToastMsg}</span>
    </div>
  )}

  {/* Toast thông báo Bản Đồ Số */}
  {mapToast && (
    <div className="map-dev-toast">
      <Map size={18} className="text-amber-400" />
      <span>{t('toast_map_title')}</span>
    </div>
  )}

  {/* Footer: Chuẩn quốc tế, tinh gọn trên cả PC & Mobile */}
  {currentView !== 'map' && (
  <footer className="site-footer" role="contentinfo">
    <div className="site-footer-identity">
      <a 
        className="site-footer-brand" 
        href="#/" 
        onClick={(e) => { 
          e.preventDefault(); 
          navigateTo('spin'); 
        }} 
        title="Xuân Hòa Có Gì"
      >
        {t('brand_domain')}<span>{t('brand_suffix')}</span>
      </a>
    </div>
    <div className="site-footer-links">
      <span className="site-footer-rights">
        © 2026 <strong>MinhTT</strong>. All rights reserved.
      </span>
    </div>
  </footer>
  )}

  {/* Thanh điều hướng cố định đáy chuẩn Mobile App (Chỉ hiển thị trên điện thoại) */}
  <MobileBottomNav
    currentView={currentView}
    onNavigate={navigateTo}
    onOpenMap={handleOpenMap}
    onOpenScoreboard={() => setIsScoreboardOpen(true)}
    onOpenSettings={() => setIsSettingsMenuOpen(true)}
    onOpenLogin={() => {
      setAuthNotice('');
      setAuthModalStep(1);
      setIsAuthModalOpen(true);
    }}
    onOpenProfile={() => setIsUserProfileModalOpen(true)}
    authUser={authUser}
    level={profile.level}
    lang={lang}
  />
    </div>
  );
}
