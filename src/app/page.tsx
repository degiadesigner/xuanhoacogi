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
  getPlaceStyleGroup
} from '@/lib/places-xuanhoa';
import { 
  createPlaceSpinProfile, 
  spinProgress as placeSpinProgress, 
  stopFraction as placeStopFraction 
} from '@/lib/places-spin';
import { CaseAudio } from '@/lib/case-audio';
import { Volume2, VolumeX, RotateCw, Shuffle, Search, UtensilsCrossed, Store, Sparkles, ChevronDown, ChevronUp, Clock, Flame, Coffee, Layers, X, ChevronRight, LayoutGrid, MapPin, Heart, Map, ExternalLink, User, LogIn, Star, Shield } from 'lucide-react';
import { DishesCatalogView } from '@/components/DishesCatalogView';
import { PlacesCatalogView } from '@/components/PlacesCatalogView';
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
} from '@/lib/admin-store';

export type AppView = 'spin' | 'dishes' | 'places' | 'guide' | 'about' | 'coming-soon' | 'admin';

function parseHashToView(): AppView {
  if (typeof window === 'undefined') return 'spin';
  const hash = window.location.hash.toLowerCase();
  const pathname = (window.location.pathname || '').toLowerCase();
  if (
    hash.includes('quanly') ||
    hash.includes('quan-ly') ||
    hash.includes('admin') ||
    hash.includes('quan-tri') ||
    pathname === '/quanly' ||
    pathname === '/quanly/' ||
    pathname === '/admin' ||
    pathname === '/admin/'
  ) {
    return 'admin';
  }
  if (hash.includes('coming-soon') || hash.includes('sap-ra-mat') || hash.includes('teaser')) {
    return 'coming-soon';
  }
  if (hash.includes('kham-pha-mon') || hash.includes('dishes') || hash.includes('mon-an')) {
    return 'dishes';
  }
  if (hash.includes('quan-an') || hash.includes('places') || hash.includes('dia-diem')) {
    return 'places';
  }
  if (hash.includes('cach-su-dung') || hash.includes('huong-dan') || hash.includes('guide')) {
    return 'guide';
  }
  if (hash.includes('gioi-thieu') || hash.includes('about')) {
    return 'about';
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

    // Kiểm tra kết quả chuyển hướng từ Google (dành cho mọi trình duyệt Mobile & PC)
    checkRedirectAuthResult().then((user) => {
      if (user) {
        setAuthUser(user);
        syncUserToAdminRegistry(user, profile.dishesCount, profile.level);
        const justLogged = consumeJustLoggedInFlag();
        if (justLogged) {
          setAuthToastMsg(`Đã kết nối Google: ${user.email || user.nickname}`);
          setTimeout(() => setAuthToastMsg(''), 4000);
          if (!user.isFirstTimeSetupDone) {
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

  // Active App View: 'spin' | 'dishes' | 'places' | 'guide' | 'about' | 'coming-soon' | 'admin'
  const [currentView, setCurrentView] = useState<AppView>(() => parseHashToView());

  const navigateTo = (view: AppView) => {
    setCurrentView(view);
    const hashMap: Record<AppView, string> = {
      spin: '#/',
      dishes: '#/kham-pha-mon',
      places: '#/quan-an',
      guide: '#/cach-su-dung',
      about: '#/gioi-thieu',
      'coming-soon': '#/sap-ra-mat',
      admin: '#/quanly',
    };
    if (typeof window !== 'undefined') {
      window.location.hash = hashMap[view];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleHash = () => {
      setCurrentView(parseHashToView());
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // 2-TAB Mode: 'dish' (Quay Chọn Món) vs 'place' (Quay Chọn Quán)
  const [mainMode, setMainMode] = useState<'dish' | 'place'>('dish');

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
    setMapToast(true);
    setTimeout(() => {
      setMapToast(false);
    }, 2800);
  }, []);

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
  const [placeCategory, setPlaceCategory] = useState<'all' | 'an-chinh' | 'nhau-lau' | 'uong' | 'an-vat'>('all');
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

  // Eligible places filtered by Category, Kèo đi ăn, Meal Session, and Budget
  const eligiblePlaces = useMemo(() => {
    let list = allPlaces;

    // 1. Phân loại theo nhóm quán chuẩn xác
    if (placeCategory !== 'all') {
      list = list.filter(p => getPlaceStyleGroup(p) === placeCategory);
    }

    // 2. Lọc theo Kèo đi ăn (Hẹn hò / Ăn nhanh / Nhóm đông / Ship)
    if (placeKeo !== 'all') {
      const keoList = list.filter(p => isPlaceMatchKeo(p, placeKeo));
      if (keoList.length) list = keoList;
    }

    // 3. Lọc theo khung giờ chuẩn xác (chỉ lọc khi placeSession !== 'all')
    if (placeSession !== 'all') {
      const sessionList = list.filter(p => isPlaceSuitableForSession(p, placeSession));
      if (sessionList.length) list = sessionList;
    }

    // 4. Lọc theo ngân sách (Mức chi)
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
  }, [allPlaces, placeCategory, placeKeo, placeSession, placeBudget, placeCustomPrice]);

  // Place pagination state ("Xem tiếp" / Load more - Chuẩn 4x4 = 16 quán mỗi đợt)
  const [visiblePlaceCount, setVisiblePlaceCount] = useState<number>(16);

  // Danh sách quán hiển thị trong kho quán (hỗ trợ tìm kiếm thông minh & ngẫu nhiên hóa, không trùng lặp thẻ)
  const displayedPlacesForInventory = useMemo(() => {
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
      return uniqueById(allPlaces).filter(p => {
        const matchName = p.name.toLowerCase().includes(q);
        const matchAddress = p.address ? p.address.toLowerCase().includes(q) : false;
        const matchTagline = p.tagline ? p.tagline.toLowerCase().includes(q) : false;
        const matchTags = p.tags ? p.tags.some(t => t.toLowerCase().includes(q)) : false;
        const matchMenu = p.menu?.some(m => m.name.toLowerCase().includes(q)) ?? false;
        return matchName || matchAddress || matchTagline || matchTags || matchMenu;
      });
    }

    // Ngẫu nhiên hóa thứ tự danh sách quán mỗi lần quay hoặc mỗi lần đổi bộ lọc
    return uniqueById(shuffleArray(eligiblePlaces));
  }, [allPlaces, eligiblePlaces, placeSearchQuery, placeShuffleKey]);

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

      {/* Header (Clean, Professional, No Emojis) */}
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

            {/* 🎯 CÁC NÚT ICON GỌN GÀNG Ở CẠNH (ĐĂNG NHẬP, BẢN ĐỒ, CÀI ĐẶT) */}
            <div className="header-action-icons-wrap header-btn-desktop-only">
              {/* 1. Nút Đăng Nhập / Hồ Sơ Gọn Gàng */}
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
                  <User size={24} className="text-amber-400" />
                </button>
              ) : (
                <button 
                  type="button"
                  className="header-icon-action-btn header-user-avatar-btn"
                  onClick={() => setIsUserProfileModalOpen(true)}
                  title={`${authUser.nickname} · ${t('dock_profile')}`}
                  aria-label={t('dock_profile')}
                >
                  <span className="text-2xl leading-none">{authUser.avatar || '🐱'}</span>
                </button>
              )}

              {/* 3. Nút Bản Đồ Số */}
              <button 
                type="button"
                className="header-icon-action-btn"
                onClick={handleOpenMap}
                title={t('map_coming_soon')}
                aria-label={t('map_coming_soon')}
              >
                <Map size={24} />
              </button>

              {/* 4. Nút Menu Cài đặt (Grid) */}
              <button 
                type="button"
                className="header-icon-action-btn header-menu-trigger-btn"
                onClick={() => setIsSettingsMenuOpen(true)}
                title={t('menu_title')}
                aria-label={t('menu_title')}
              >
                <LayoutGrid size={24} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-wrapper">
        {currentView === 'spin' && (
          <>
            {/* ========================================================
                1. DESKTOP EXPERIENCE: Bàn điều khiển đầy đủ & hoành tráng
                ======================================================== */}
            <div className="desktop-experience-deck">
              {/* 2-TAB MODE SWITCHER: CHỌN MÓN vs CHỌN QUÁN */}
              <div className="main-mode-switcher">
          <button
            className={`mode-switch-btn ${mainMode === 'dish' ? 'active' : ''}`}
            onClick={() => {
              if (!spinning && !placeSpinning) {
                setMainMode('dish');
              }
            }}
            disabled={spinning || placeSpinning}
          >
            <div className="mode-btn-title-row">
              <UtensilsCrossed size={18} className={mainMode === 'dish' ? 'text-amber-400' : 'text-slate-400'} />
              <span>{t('spin_dish_tab')}</span>
            </div>
            <span className="mode-sub-tag">
              <span>{t('spin_dish_sub')}</span>
            </span>
          </button>

          <button
            className={`mode-switch-btn ${mainMode === 'place' ? 'active' : ''}`}
            onClick={() => {
              if (!spinning && !placeSpinning) {
                setMainMode('place');
              }
            }}
            disabled={spinning || placeSpinning}
          >
            <div className="mode-btn-title-row">
              <Store size={18} className={mainMode === 'place' ? 'text-amber-400' : 'text-slate-400'} />
              <span>{t('spin_place_tab')}</span>
            </div>
            <span className="mode-sub-tag">
              <span>{t('spin_place_sub')}</span>
            </span>
          </button>
        </div>

        {/* Centralized Balanced Console */}
        <section className="central-console">
          {mainMode === 'dish' ? (
            <>
              {/* Row 1: Primary Category Segmented Tabs */}
              <div className="category-nav-bar category-nav-bar-dish">
                {MAIN_CATEGORIES.map(cat => {
                  const catLabel = cat.id === 'an-gi' ? t('today_eat') : cat.id === 'nhau-gi' ? t('today_pub') : t('today_drink');
                  return (
                    <button
                      key={cat.id}
                      className={`category-nav-tab ${activeCategory === cat.id ? 'active' : ''}`}
                      onClick={() => {
                        if (!spinning) {
                          setActiveCategory(cat.id);
                          setDishSearchQuery('');
                          setNhauSubFilter('all');
                          setDrinkSubFilter('all');
                          setBudget('all');
                          setCaseTier('all');
                          setVisibleDishCount(18);
                        }
                      }}
                      disabled={spinning}
                    >
                      {catLabel}
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Khung giờ lựa chọn (hiện toàn bộ) + Mức giá (cuộn xuống) trên cùng 1 dòng */}
              <div className="luxury-filter-bar">
                {/* 1. Khung giờ phục vụ (hiện toàn bộ ra) */}
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
                        title={lang === 'en' ? 'All dishes all day' : 'Tất cả các món cả ngày'}
                      >
                        {t('session_all_day')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-filter Mồi nhậu nếu tab Nhậu Gì */}
                {activeCategory === 'nhau-gi' && (
                  <div className="session-filter-group">
                    <span className="control-label inline-flex items-center gap-1.5">
                      <Flame size={13} className="text-orange-400 shrink-0" />
                      {t('pub_filter_label')}
                    </span>
                    <div className="session-pills-wrap session-pills-4">
                      <button
                        type="button"
                        className={`session-pill-btn ${nhauSubFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setNhauSubFilter('all')}
                        disabled={spinning}
                      >
                        {t('pub_all')}
                      </button>
                      <button
                        type="button"
                        className={`session-pill-btn ${nhauSubFilter === 'lau-nuong' ? 'active' : ''}`}
                        onClick={() => setNhauSubFilter('lau-nuong')}
                        disabled={spinning}
                      >
                        {t('pub_hotpot_grill')}
                      </button>
                      <button
                        type="button"
                        className={`session-pill-btn ${nhauSubFilter === 'oc-haisan' ? 'active' : ''}`}
                        onClick={() => setNhauSubFilter('oc-haisan')}
                        disabled={spinning}
                      >
                        {t('pub_snails_seafood')}
                      </button>
                      <button
                        type="button"
                        className={`session-pill-btn ${nhauSubFilter === 'bia-moi' ? 'active' : ''}`}
                        onClick={() => setNhauSubFilter('bia-moi')}
                        disabled={spinning}
                      >
                        {t('pub_beer_bites')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-filter Đồ uống nếu tab Uống Gì */}
                {activeCategory === 'uong-gi' && (
                  <div className="session-filter-group">
                    <span className="control-label inline-flex items-center gap-1.5">
                      <Coffee size={13} className="text-sky-400 shrink-0" />
                      {t('drink_filter_label')}
                    </span>
                    <div className="session-pills-wrap session-pills-4">
                      <button
                        type="button"
                        className={`session-pill-btn ${drinkSubFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setDrinkSubFilter('all')}
                        disabled={spinning}
                      >
                        {t('drink_all')}
                      </button>
                      <button
                        type="button"
                        className={`session-pill-btn ${drinkSubFilter === 'tra-sua' ? 'active' : ''}`}
                        onClick={() => setDrinkSubFilter('tra-sua')}
                        disabled={spinning}
                      >
                        {t('drink_milktea')}
                      </button>
                      <button
                        type="button"
                        className={`session-pill-btn ${drinkSubFilter === 'cafe' ? 'active' : ''}`}
                        onClick={() => setDrinkSubFilter('cafe')}
                        disabled={spinning}
                      >
                        {t('drink_coffee')}
                      </button>
                      <button
                        type="button"
                        className={`session-pill-btn ${drinkSubFilter === 'tra-traicay' ? 'active' : ''}`}
                        onClick={() => setDrinkSubFilter('tra-traicay')}
                        disabled={spinning}
                      >
                        {t('drink_fruittea')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Thanh ngăn cách giữa Khung giờ và Mức giá */}
                <div className="luxury-bar-divider" />

                {/* 2. Mức giá: Lựa chọn theo cuộn/xổ xuống (Dropdown) - Cùng 1 dòng */}
                <div className="luxury-budget-control-wrap">
                  <BudgetDropdown
                    value={budget}
                    onChange={val => setBudget(val)}
                    disabled={spinning}
                  />

                  {budget === 'custom' && (
                    <div className="custom-budget-input-wrap">
                      <input 
                        type="number" 
                        min="15" 
                        max="500" 
                        step="5"
                        className="custom-budget-input"
                        value={customPrice}
                        onChange={e => setCustomPrice(e.target.value)}
                        disabled={spinning}
                        title={lang === 'en' ? 'Enter thousands VND (e.g. 45)' : 'Nhập số nghìn đồng (VD: 45)'}
                      />
                      <span className="custom-budget-suffix">.000đ</span>
                    </div>
                  )}
                </div>

                {/* 3. Công Tắc Nhanh: Bộ Lọc Theo Gu Ẩm Thực (Đồng bộ Web & Mobile) */}
                <div className="luxury-taste-filter-wrap">
                  {authUser?.isLoggedIn ? (
                    <button
                      type="button"
                      className={`taste-filter-toggle-pill ${authUser.filterByTaste !== false ? 'active' : ''}`}
                      onClick={handleToggleTasteFilter}
                      disabled={spinning}
                      title={authUser.filterByTaste !== false 
                        ? (lang === 'en' ? 'Taste Filter ON · Click to turn off (random discovery)' : 'Đang BẬT lọc theo gu ẩm thực của bạn · Bấm để tắt (Khám phá ngẫu nhiên)')
                        : (lang === 'en' ? 'Taste Filter OFF · Click to turn on' : 'Đang TẮT lọc theo gu · Bấm để bật')}
                    >
                      <span className="taste-filter-icon">🎯</span>
                      <span className="taste-filter-text">
                        {authUser.filterByTaste !== false ? t('taste_pill_on') : t('taste_pill_off')}
                      </span>
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
                      title={lang === 'en' ? 'Sign in to customize taste filter' : 'Đăng nhập để thiết lập khẩu vị theo gu'}
                    >
                      <span className="taste-filter-icon">🎯</span>
                      <span className="taste-filter-text">{t('taste_filter_nav_btn')}</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* TAB CHỌN QUÁN: Đồng bộ phân loại, khung giờ & mức chi y như Chọn Món */
            <>
              {/* Row 1: Primary Place Category Segmented Tabs */}
              <div className="category-nav-bar category-nav-bar-place">
                <button
                  className={`category-nav-tab ${placeCategory === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setPlaceCategory('all');
                    setPlaceSession('all');
                    setPlaceKeo('all');
                    setPlaceBudget('all');
                  }}
                  disabled={placeSpinning}
                >
                  {t('place_cat_all')} ({allPlaces.length})
                </button>
                <button
                  className={`category-nav-tab ${placeCategory === 'an-chinh' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('an-chinh')}
                  disabled={placeSpinning}
                >
                  {t('place_cat_rice_noodles')}
                </button>
                <button
                  className={`category-nav-tab ${placeCategory === 'nhau-lau' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('nhau-lau')}
                  disabled={placeSpinning}
                >
                  {t('place_cat_pub_grill')}
                </button>
                <button
                  className={`category-nav-tab ${placeCategory === 'uong' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('uong')}
                  disabled={placeSpinning}
                >
                  {t('place_cat_cafe_drinks')}
                </button>
                <button
                  className={`category-nav-tab ${placeCategory === 'an-vat' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('an-vat')}
                  disabled={placeSpinning}
                >
                  {t('place_cat_street_snacks')}
                </button>
              </div>

              {/* Row 2: Khung giờ phục vụ (hiện toàn bộ) + Kèo & Mức giá trên cùng 1 dòng */}
              <div className="luxury-filter-bar">
                {/* 1. Khung giờ phục vụ (hiện toàn bộ ra) */}
                <div className="session-filter-group">
                  <span className="control-label inline-flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-400 shrink-0" />
                    {t('session_label')}
                  </span>
                  <div className="session-pills-wrap session-pills-6">
                    {MEAL_SESSIONS.map((s) => {
                      const isLive = s.id === liveSession;
                      const isSelected = placeSession === s.id;
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
                          onClick={() => setPlaceSession(s.id)}
                          disabled={placeSpinning}
                          title={`${sessionName} (${s.timeRange})`}
                        >
                          {isLive && <span className="live-gem-indicator mr-1.5" />}
                          {sessionName}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`session-pill-btn ${placeSession === 'all' ? 'active' : ''}`}
                      onClick={() => setPlaceSession('all')}
                      disabled={placeSpinning}
                      title={lang === 'en' ? 'All places all day' : 'Tất cả các quán cả ngày'}
                    >
                      {t('session_all_day')}
                    </button>
                  </div>
                </div>

                <div className="luxury-bar-divider" />

                {/* 2 & 3. Kèo đi ăn & Mức chi trên cùng 1 hàng gọn gàng */}
                <div className="place-filters-dropdowns-row">
                  {/* 2. Kèo đi ăn */}
                  <PlaceKeoDropdown
                    value={placeKeo}
                    onChange={setPlaceKeo}
                    disabled={placeSpinning}
                  />

                  {/* 3. Mức chi */}
                  <div className="luxury-budget-control-wrap">
                    <BudgetDropdown
                      value={placeBudget}
                      onChange={val => setPlaceBudget(val)}
                      disabled={placeSpinning}
                    />

                    {placeBudget === 'custom' && (
                      <div className="custom-budget-input-wrap">
                        <input 
                          type="number" 
                          min="15" 
                          max="500" 
                          step="5"
                          className="custom-budget-input"
                          value={placeCustomPrice}
                          onChange={e => setPlaceCustomPrice(e.target.value)}
                          disabled={placeSpinning}
                          title="Nhập số nghìn đồng (VD: 50)"
                        />
                        <span className="custom-budget-suffix">.000đ</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ========================================================
          2. MOBILE DEDICATED APP DECK: Tinh gọn 1 màn hình, 1-chạm
          ======================================================== */}
      <div className="mobile-experience-deck">
        {/* Row 1: Mode Segmented Pill Switcher + Taste Filter Pill */}
        <div className="mobile-deck-top-row">
          <div className="mobile-mode-segmented">
            <button
              type="button"
              className={`mobile-mode-tab ${mainMode === 'dish' ? 'active' : ''}`}
              onClick={() => {
                if (!spinning && !placeSpinning) setMainMode('dish');
              }}
              disabled={spinning || placeSpinning}
            >
              <UtensilsCrossed size={13} className={mainMode === 'dish' ? 'text-amber-400' : 'text-slate-400'} />
              <span>{t('mobile_mode_dishes')}</span>
            </button>
            <button
              type="button"
              className={`mobile-mode-tab ${mainMode === 'place' ? 'active' : ''}`}
              onClick={() => {
                if (!spinning && !placeSpinning) setMainMode('place');
              }}
              disabled={spinning || placeSpinning}
            >
              <Store size={13} className={mainMode === 'place' ? 'text-amber-400' : 'text-slate-400'} />
              <span>{t('mobile_mode_places')}</span>
            </button>
          </div>

          {/* Taste Filter Button on Mobile: Balanced, Luxury & One-touch */}
          {mainMode === 'dish' && (
            <button
              type="button"
              className={`mobile-taste-filter-btn ${authUser?.isLoggedIn && authUser.filterByTaste !== false ? 'active' : ''}`}
              onClick={handleToggleTasteFilter}
              disabled={spinning}
              title={authUser?.isLoggedIn 
                ? (authUser.filterByTaste !== false 
                    ? (lang === 'en' ? 'Taste Filter: Active' : 'Lọc theo gu: Đang BẬT') 
                    : (lang === 'en' ? 'Taste Filter: Off' : 'Lọc theo gu: Đang TẮT'))
                : (lang === 'en' ? 'Sign in to filter by taste' : 'Đăng nhập để lọc theo gu')}
            >
              <span className="mobile-taste-icon">🎯</span>
              <span className="mobile-taste-label">
                {authUser?.isLoggedIn 
                  ? (authUser.filterByTaste !== false ? t('taste_mobile_on') : t('taste_mobile_off'))
                  : t('taste_mobile_guest')}
              </span>
              <span className={`mobile-taste-dot ${authUser?.isLoggedIn && authUser.filterByTaste !== false ? 'active' : ''}`} />
            </button>
          )}
        </div>

        {/* ========================================================
            PHƯƠNG ÁN A: 2 TẦNG CÂN ĐỐI, VỪA KHÍT 100% MÀN HÌNH MOBILE
            ======================================================== */}
        {mainMode === 'dish' ? (
          <div className="mobile-filter-matrix">
            {/* Tầng 1: 3 Tab Thể Loại Chính chia đều 3 cột (Grid 33.3%, không cần cuộn) */}
            <div className="mobile-category-grid">
              <button
                type="button"
                className={`mobile-cat-pill ${activeCategory === 'an-gi' ? 'active' : ''}`}
                onClick={() => {
                  if (!spinning) {
                    setActiveCategory('an-gi');
                    setDishSearchQuery('');
                    setNhauSubFilter('all');
                    setDrinkSubFilter('all');
                    setVisibleDishCount(18);
                  }
                }}
                disabled={spinning}
              >
                <UtensilsCrossed size={12} className="shrink-0" />
                <span>{t('mobile_cat_food')}</span>
              </button>
              <button
                type="button"
                className={`mobile-cat-pill ${activeCategory === 'nhau-gi' ? 'active' : ''}`}
                onClick={() => {
                  if (!spinning) {
                    setActiveCategory('nhau-gi');
                    setDishSearchQuery('');
                    setNhauSubFilter('all');
                    setVisibleDishCount(18);
                  }
                }}
                disabled={spinning}
              >
                <Flame size={12} className="shrink-0 text-orange-400" />
                <span>{t('mobile_cat_pub')}</span>
              </button>
              <button
                type="button"
                className={`mobile-cat-pill ${activeCategory === 'uong-gi' ? 'active' : ''}`}
                onClick={() => {
                  if (!spinning) {
                    setActiveCategory('uong-gi');
                    setDishSearchQuery('');
                    setDrinkSubFilter('all');
                    setVisibleDishCount(18);
                  }
                }}
                disabled={spinning}
              >
                <Coffee size={12} className="shrink-0 text-sky-400" />
                <span>{t('mobile_cat_drink')}</span>
              </button>
            </div>

            {/* Tầng 2: 2 Dropdown hộp bấm sang trọng song song 50/50 */}
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
                      title={lang === 'en' ? 'Select pub style' : 'Chọn kèo nhậu'}
                    >
                      <option value="all">🔥 {t('pub_all')} ({t('today_pub')})</option>
                      <option value="lau-nuong">🍲 {t('pub_hotpot_grill')}</option>
                      <option value="oc-haisan">🐚 {t('pub_snails_seafood')}</option>
                      <option value="nhau-binh-dan">🍻 {t('pub_casual')}</option>
                    </select>
                  </div>
                ) : (
                  <div className="relative inline-block text-left w-full">
                    <select
                      value={drinkSubFilter}
                      onChange={e => setDrinkSubFilter(e.target.value as any)}
                      disabled={spinning}
                      className="luxury-filter-trigger w-full mobile-select-clean"
                      title={lang === 'en' ? 'Select drink type' : 'Chọn loại đồ uống'}
                    >
                      <option value="all">☕ {t('drink_all')} ({t('today_drink')})</option>
                      <option value="cafe">☕ {t('drink_coffee')}</option>
                      <option value="tra-sua">🧋 {t('drink_milktea')}</option>
                      <option value="nuoc-ep">🍹 {t('drink_juice')}</option>
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
          </div>
        ) : (
          /* Chế độ Chọn Quán */
          <div className="mobile-filter-matrix">
            {/* Tầng 1: 4 Tab Danh mục quán chia đều 4 cột */}
            <div className="mobile-place-grid">
              <button
                type="button"
                className={`mobile-cat-pill ${placeCategory === 'all' ? 'active' : ''}`}
                onClick={() => {
                  if (!placeSpinning) {
                    setPlaceCategory('all');
                    setPlaceSession('all');
                    setPlaceKeo('all');
                    setPlaceBudget('all');
                  }
                }}
                disabled={placeSpinning}
              >
                <span>{t('mobile_place_all')} ({allPlaces.length})</span>
              </button>
              <button
                type="button"
                className={`mobile-cat-pill ${placeCategory === 'an-chinh' ? 'active' : ''}`}
                onClick={() => {
                  if (!placeSpinning) setPlaceCategory('an-chinh');
                }}
                disabled={placeSpinning}
              >
                <span>{t('mobile_place_rice_pho')}</span>
              </button>
              <button
                type="button"
                className={`mobile-cat-pill ${placeCategory === 'nhau-lau' ? 'active' : ''}`}
                onClick={() => {
                  if (!placeSpinning) setPlaceCategory('nhau-lau');
                }}
                disabled={placeSpinning}
              >
                <Flame size={11} className="text-orange-400 mr-0.5 inline" />
                <span>{t('mobile_place_pub')}</span>
              </button>
              <button
                type="button"
                className={`mobile-cat-pill ${placeCategory === 'uong' ? 'active' : ''}`}
                onClick={() => {
                  if (!placeSpinning) setPlaceCategory('uong');
                }}
                disabled={placeSpinning}
              >
                <Coffee size={11} className="text-sky-400 mr-0.5 inline" />
                <span>{t('mobile_place_cafe')}</span>
              </button>
            </div>

            {/* Tầng 2: 2 Dropdown Kèo Đi Ăn + Mức Chi (Song song 50/50) */}
            <div className="mobile-dropdowns-row">
              <div className="mobile-dropdown-half">
                <PlaceKeoDropdown
                  value={placeKeo}
                  onChange={setPlaceKeo}
                  disabled={placeSpinning}
                />
              </div>
              <div className="mobile-dropdown-half">
                <BudgetDropdown
                  value={placeBudget}
                  onChange={val => setPlaceBudget(val)}
                  disabled={placeSpinning}
                />
              </div>
            </div>
          </div>
        )}
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
                          if (!authUser || !authUser.isLoggedIn) {
                            setAuthNotice('Bạn hãy đăng nhập để xem thông tin chi tiết món ăn này! Khách vãng lai chỉ có thể quay thưởng.');
                            setAuthModalStep(1);
                            setIsAuthModalOpen(true);
                            return;
                          }
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
                          if (!authUser || !authUser.isLoggedIn) {
                            setAuthNotice('Bạn hãy đăng nhập để xem thông tin chi tiết quán ăn này! Khách vãng lai chỉ có thể quay thưởng.');
                            setAuthModalStep(1);
                            setIsAuthModalOpen(true);
                            return;
                          }
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

        {/* Grid Inventory Section */}
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
                  <p className="text-neutral-400 text-xs mb-4 max-w-md">
                    Hãy thử từ khóa khác (VD: {activeCategory === 'uong-gi' ? 'trà sữa, cà phê, trà mãng cầu, nước mía' : activeCategory === 'nhau-gi' ? 'lẩu, nướng, ốc' : 'cơm, bún, phở, bánh mì'}) hoặc bấm nút dưới để xem toàn bộ kho.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDishSearchQuery('')}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
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
                          if (!authUser || !authUser.isLoggedIn) {
                            setAuthNotice('Bạn hãy đăng nhập để xem thông tin chi tiết món ăn này! Khách vãng lai chỉ có thể quay thưởng.');
                            setAuthModalStep(1);
                            setIsAuthModalOpen(true);
                            return;
                          }
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
                      <button
                        type="button"
                        className="btn-load-more"
                        onClick={() => setVisibleDishCount(prev => prev + 18)}
                      >
                        <ChevronDown size={16} />
                        <span>Xem tiếp (+{Math.min(18, displayedDishes.length - visibleDishCount)})</span>
                      </button>
                      <button
                        type="button"
                        className="btn-load-all"
                        onClick={() => setVisibleDishCount(displayedDishes.length)}
                      >
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
                  {t('inventory_place_title')} <span>{displayedPlacesForInventory.length} {lang === 'en' ? 'places' : 'quán'}</span>
                </h2>
                <span className="inventory-hint">
                  {t('inventory_place_desc')}
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
                    if (!authUser || !authUser.isLoggedIn) {
                      setAuthNotice('Bạn hãy đăng nhập để xem thông tin chi tiết quán ăn này! Khách vãng lai chỉ có thể quay thưởng.');
                      setAuthModalStep(1);
                      setIsAuthModalOpen(true);
                      return;
                    }
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
                    Đang hiển thị <strong>{Math.min(visiblePlaceCount, displayedPlacesForInventory.length)}</strong> / <strong>{displayedPlacesForInventory.length}</strong> quán ăn đề xuất
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
                            // Nếu số quán còn lại sau khi tăng <= 4 quán (1 hàng), gom hiển thị hết luôn để không bị lẻ hàng
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
                      <button
                        type="button"
                        className="btn-load-all"
                        onClick={() => setVisiblePlaceCount(displayedPlacesForInventory.length)}
                      >
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
          if (!authUser || !authUser.isLoggedIn) {
            setAuthNotice('Bạn hãy đăng nhập để xem thông tin chi tiết món ăn này! Khách vãng lai chỉ có thể quay thưởng.');
            setAuthModalStep(1);
            setIsAuthModalOpen(true);
            return;
          }
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
          if (!authUser || !authUser.isLoggedIn) {
            setAuthNotice('Bạn hãy đăng nhập để xem thông tin chi tiết quán ăn này! Khách vãng lai chỉ có thể quay thưởng.');
            setAuthModalStep(1);
            setIsAuthModalOpen(true);
            return;
          }
          setWinnerPlace(place);
          setPlaceModalOpen(true);
        }}
        onGoToSpin={() => navigateTo('spin')}
        onGoToDishes={() => navigateTo('dishes')}
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

  {/* Footer: Trên Web PC vẫn có Khám phá món & Quán ăn để tìm kiếm; trên Mobile (đã có thanh tab dưới) tự động ẩn gọn */}
  <footer className="site-footer">
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
      <p className="header-btn-desktop-only">{t('brand_tagline')}</p>
    </div>
    <div className="site-footer-links">
      <nav className="header-btn-desktop-only" aria-label="Liên kết cuối trang">
        <button className={`footer-link-btn ${currentView === 'dishes' ? 'active' : ''}`} onClick={() => navigateTo('dishes')}>{t('footer_dishes')}</button>
        <button className={`footer-link-btn ${currentView === 'places' ? 'active' : ''}`} onClick={() => navigateTo('places')}>{t('footer_places')}</button>
      </nav>
      <div className="site-footer-contact">
        <span>Crafted &amp; Curated by MinhTT © 2026</span>
      </div>
    </div>
  </footer>

  {/* Thanh điều hướng cố định đáy chuẩn Mobile App (Chỉ hiển thị trên điện thoại) */}
  <MobileBottomNav
    currentView={currentView}
    onNavigate={navigateTo}
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
