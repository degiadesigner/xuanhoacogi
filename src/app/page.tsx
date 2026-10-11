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
import { Volume2, VolumeX, RotateCw, Search, UtensilsCrossed, Store, Sparkles, ChevronDown, ChevronUp, Clock, Flame, Coffee, Layers, X, ChevronRight, LayoutGrid, MapPin, Heart, Map, ExternalLink } from 'lucide-react';
import { DishesCatalogView } from '@/components/DishesCatalogView';
import { PlacesCatalogView } from '@/components/PlacesCatalogView';
import { UserGuideView } from '@/components/UserGuideView';
import { AboutView } from '@/components/AboutView';
import { ComingSoonView } from '@/components/ComingSoonView';
import { SettingsMenuModal } from '@/components/SettingsMenuModal';
import { GlobalSpinCounter } from '@/components/GlobalSpinCounter';
import { useGlobalSpinCounter } from '@/hooks/use-global-spin-counter';
import { BudgetDropdown, PlaceKeoDropdown } from '@/components/LuxuryFilterDropdowns';
import { CatalogFoodItem, getDishConceptKey, diversifyFoodList, getUniqueConceptFoods } from '@/lib/xuanhoa-catalog';
import { getSpotsForDish } from '@/lib/dish-places';
import { formatTypography, getFoodCategoryLabel, cleanDishDisplayTitle } from '@/lib/utils';

export type AppView = 'spin' | 'dishes' | 'places' | 'guide' | 'about' | 'coming-soon';

function parseHashToView(): AppView {
  if (typeof window === 'undefined') return 'spin';
  const hash = window.location.hash.toLowerCase();
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
  // Gourmet profile (Level & EXP without requiring login)
  const [profile, setProfile] = useState<UserGourmetProfile>(() => getLocalProfile());

  // Global total spins counter (starting from 688)
  const { count: globalSpinCount, increment: incrementGlobalSpins } = useGlobalSpinCounter();

  // Active App View: 'spin' | 'dishes' | 'places' | 'guide' | 'about' | 'coming-soon'
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



  // Items for the chosen category
  const categoryItems = useMemo(() => {
    return getCategoryItems(activeCategory);
  }, [activeCategory]);

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
          return n.includes('trà sữa') || n.includes('matcha') || n.includes('cheese') || n.includes('latte') || n.includes('hojicha') || n.includes('cacao') || n.includes('trà sen') || n.includes('sữa tươi trân châu');
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
          return n.includes('trà') || n.includes('nước') || n.includes('sinh tố') || n.includes('sữa chua') || n.includes('sâm') || n.includes('soda') || n.includes('rau má') || n.includes('sữa');
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

    return filtered.length ? filtered : sessionFiltered;
  }, [categoryItems, activeCategory, session, nhauSubFilter, drinkSubFilter, budget, customPrice, caseTier]);

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

  // Danh sách món độc bản (mỗi món chỉ đại diện 1 lần, triệt tiêu trùng lặp)
  const uniqueEligibleDishes = useMemo(() => {
    return getUniqueConceptFoods(eligibleItems);
  }, [eligibleItems]);

  // Danh sách món hiển thị trong kho
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
    return inventoryMode === 'unique' ? baseList : diversifyFoodList(baseList);
  }, [eligibleItems, uniqueEligibleDishes, inventoryMode, dishSearchQuery]);

  // Tự động reset về 18 món khi thay đổi bất kỳ bộ lọc món nào
  useEffect(() => {
    setVisibleDishCount(18);
  }, [activeCategory, session, nhauSubFilter, drinkSubFilter, budget, customPrice, caseTier]);

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

  // Toàn bộ 100% các quán ăn và cơ sở ẩm thực xác thực tại Xuân Hòa
  const allPlaces = useMemo(() => {
    return xuanHoaPlaces;
  }, []);

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

  // Danh sách quán hiển thị trong kho quán (hỗ trợ tìm kiếm thông minh)
  const displayedPlacesForInventory = useMemo(() => {
    if (!placeSearchQuery.trim()) return eligiblePlaces;
    const q = placeSearchQuery.toLowerCase().trim();
    return eligiblePlaces.filter(p => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchAddress = p.address ? p.address.toLowerCase().includes(q) : false;
      const matchTagline = p.tagline ? p.tagline.toLowerCase().includes(q) : false;
      const matchMenu = p.menu?.some(m => m.name.toLowerCase().includes(q)) ?? false;
      return matchName || matchAddress || matchTagline || matchMenu;
    });
  }, [eligiblePlaces, placeSearchQuery]);

  // Tự động reset về chuẩn 4x4 = 16 quán khi thay đổi bất kỳ bộ lọc hoặc tìm kiếm quán nào
  useEffect(() => {
    setVisiblePlaceCount(16);
  }, [placeCategory, placeSession, placeKeo, placeBudget, placeCustomPrice, placeSearchQuery]);

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

  const attachTrack = useCallback((node: HTMLDivElement | null) => {
    track.current = node;
    if (node) node.style.transform = `translate3d(${position.current}px,0,0)`;
  }, []);

  // Sync reel when eligible items change: Xáo trộn danh sách MÓN ĐỘC BẢN tuyệt đối không bao giờ trùng món
  useEffect(() => {
    if (spinning || !eligibleItems.length) return;
    const uniquePool = getUniqueConceptFoods(eligibleItems);
    const pool = uniquePool.length >= 6 ? uniquePool : eligibleItems;
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
    audio.current?.unlock();
    busy.current = true;

    // Pick winner từ danh sách MÓN ĐỘC BẢN (Unique Concept)
    const uniquePool = getUniqueConceptFoods(eligibleItems);
    const pool = uniquePool.length >= 6 ? uniquePool : (eligibleItems.length ? eligibleItems : categoryItems);
    const winner = pool[Math.floor(Math.random() * pool.length)];

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
      const nextProf = addSpinExp(winner.rarity);
      setProfile(nextProf);

      busy.current = false;
      setSpinning(false);
      setWinnerFood(winner);
      setDialogOpen(true);

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
    audio.current?.unlock();
    placeBusy.current = true;

    // Pick winner place
    const pool = eligiblePlaces.length ? eligiblePlaces : allPlaces;
    const winner = pool[Math.floor(Math.random() * pool.length)];

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
    for (let id = last + 1; id <= target + 4; id++) {
      let place: Place;
      if (id === target) {
        place = winner;
      } else {
        const poolWithoutPrev = pool.filter(p => p.id !== prevPlace?.id);
        const source = poolWithoutPrev.length ? poolWithoutPrev : pool;
        place = source[Math.floor(Math.random() * source.length)];
      }
      prevPlace = place;
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
      const nextProf = addSpinExp(winner.rarity);
      setProfile(nextProf);

      placeBusy.current = false;
      setPlaceSpinning(false);
      setWinnerPlace(winner);
      setPlaceModalOpen(true);

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
  const expPercentage = Math.min(100, Math.round(((profile.exp % 150) / 150) * 100));

  return (
    <div className="site-shell">
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
              <div className="brand-name">
                XUÂN HÒA <span>CÓ GÌ</span>
              </div>
              <div className="brand-tagline">
                Chuyên trị: &ldquo;Ăn gì cũng được&rdquo;
              </div>
            </div>
          </a>

          <div className="header-right">
            {/* Compact Header EXP Gourmet Badge */}
            <div 
              className="header-exp-pill" 
              title={`${profile.title} · ${profile.exp}/${profile.nextExp} EXP (Đã mở ${profile.spinsCount} lượt) · Bấm để xem Menu`}
              onClick={() => setIsSettingsMenuOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <div className="header-exp-info">
                <span className="header-exp-level">Cấp {profile.level}</span>
                <span className="header-exp-title">{profile.title}</span>
              </div>
              <div className="header-exp-track">
                <div className="header-exp-fill" style={{ width: `${expPercentage}%` }} />
              </div>
            </div>

            {/* 1. Nút Bản Đồ Số (Icon Maps - Ấn vào thông báo Đang phát triển) */}
            <button 
              className="header-icon-action-btn"
              onClick={handleOpenMap}
              title="Bản Đồ Số (Đang phát triển)"
              aria-label="Bản Đồ Số"
            >
              <Map size={17} />
            </button>

            {/* 2. Nút Mạng Xã Hội FB - IG (Xoay lật 3D giữa icon Facebook và Instagram) */}
            <div className="social-flip-wrapper">
              <button 
                className={`header-icon-action-btn social-flip-btn ${isSocialMenuOpen ? 'active' : ''}`}
                onClick={() => setIsSocialMenuOpen(prev => !prev)}
                title="Kênh Facebook cá nhân & Fanpage"
                aria-label="Kênh Facebook & Fanpage"
              >
                <div className="social-flip-inner">
                  <div className="social-icon-face social-icon-front">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div className="social-icon-face social-icon-back">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                    </svg>
                  </div>
                </div>
              </button>

              {/* Backdrop trong suốt click ra ngoài để đóng menu */}
              {isSocialMenuOpen && (
                <div 
                  className="social-popover-backdrop"
                  onClick={() => setIsSocialMenuOpen(false)}
                />
              )}

              {/* Popover Menu Facebook cá nhân & Fanpage xuất hiện ở góc */}
              {isSocialMenuOpen && (
                <div className="social-popover-corner">
                  <div className="social-popover-header">
                    <span>Kênh Facebook</span>
                    <button 
                      type="button" 
                      className="social-popover-close"
                      onClick={() => setIsSocialMenuOpen(false)}
                      aria-label="Đóng"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="social-popover-links">
                    <a 
                      href="https://www.facebook.com/minhttvp/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="social-popover-item"
                      onClick={() => setIsSocialMenuOpen(false)}
                    >
                      <div className="social-popover-badge fb-user">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <div className="social-popover-text">
                        <strong>Trang cá nhân</strong>
                        <span>MinhTT (Founder)</span>
                      </div>
                      <ExternalLink size={13} className="social-popover-ext" />
                    </a>

                    <a 
                      href="https://www.facebook.com/xuanhoacogi" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="social-popover-item"
                      onClick={() => setIsSocialMenuOpen(false)}
                    >
                      <div className="social-popover-badge fb-page">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <div className="social-popover-text">
                        <strong>Fanpage</strong>
                        <span>Xuân Hòa Có Gì</span>
                      </div>
                      <ExternalLink size={13} className="social-popover-ext" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Nút Menu Cài đặt (9 ô vuông Grid) - Âm lượng đã được đưa vào trong cài đặt này */}
            <button 
              className="header-icon-action-btn header-menu-trigger-btn"
              onClick={() => setIsSettingsMenuOpen(true)}
              title="Menu Cài đặt"
              aria-label="Menu Cài đặt"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-wrapper">
        {currentView === 'spin' && (
          <>
            {/* Thanh Thống Kê Tổng Lượt Mở Hòm Sang Trọng (Khởi điểm 688) */}
            <GlobalSpinCounter count={globalSpinCount} isSpinning={spinning || placeSpinning} />

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
              <span>QUAY CHỌN MÓN</span>
            </div>
            <span className="mode-sub-tag">150+ món ngon · Lọc món theo bữa & ví tiền</span>
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
              <span>QUAY CHỌN QUÁN</span>
            </div>
            <span className="mode-sub-tag">{allPlaces.length}+ quán thực tế · Lọc theo khung giờ & sở thích</span>
          </button>
        </div>

        {/* Centralized Balanced Console */}
        <section className="central-console">
          {mainMode === 'dish' ? (
            <>
              {/* Row 1: Primary Category Segmented Tabs */}
              <div className="category-nav-bar category-nav-bar-dish">
                {MAIN_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    className={`category-nav-tab ${activeCategory === cat.id ? 'active' : ''}`}
                    onClick={() => {
                      if (!spinning) {
                        setActiveCategory(cat.id);
                        setNhauSubFilter('all');
                        setDrinkSubFilter('all');
                        setBudget('all');
                        setCaseTier('all');
                      }
                    }}
                    disabled={spinning}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Row 2: Khung giờ lựa chọn (hiện toàn bộ) + Mức giá (cuộn xuống) trên cùng 1 dòng */}
              <div className="luxury-filter-bar">
                {/* 1. Khung giờ phục vụ (hiện toàn bộ ra) */}
                {activeCategory === 'an-gi' && (
                  <div className="session-filter-group">
                    <span className="control-label inline-flex items-center gap-1.5">
                      <Clock size={13} className="text-amber-400 shrink-0" />
                      Khung giờ:
                    </span>
                    {MEAL_SESSIONS.map((s) => {
                      const isLive = s.id === liveSession;
                      const isSelected = session === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`session-pill-btn ${isSelected ? 'active' : ''}`}
                          onClick={() => setSession(s.id)}
                          disabled={spinning}
                          title={`${s.label} (${s.timeRange})`}
                        >
                          {isLive && <span className="live-gem-indicator mr-1.5" />}
                          {s.label.replace('Buổi ', '')}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`session-pill-btn ${session === 'all' ? 'active' : ''}`}
                      onClick={() => setSession('all')}
                      disabled={spinning}
                      title="Tất cả các món cả ngày"
                    >
                      Cả ngày
                    </button>
                  </div>
                )}

                {/* Sub-filter Mồi nhậu nếu tab Nhậu Gì */}
                {activeCategory === 'nhau-gi' && (
                  <div className="session-filter-group">
                    <span className="control-label inline-flex items-center gap-1.5">
                      <Flame size={13} className="text-orange-400 shrink-0" />
                      Kèo nhậu:
                    </span>
                    <button
                      type="button"
                      className={`session-pill-btn ${nhauSubFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setNhauSubFilter('all')}
                      disabled={spinning}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      className={`session-pill-btn ${nhauSubFilter === 'lau-nuong' ? 'active' : ''}`}
                      onClick={() => setNhauSubFilter('lau-nuong')}
                      disabled={spinning}
                    >
                      Lẩu & Nướng
                    </button>
                    <button
                      type="button"
                      className={`session-pill-btn ${nhauSubFilter === 'oc-haisan' ? 'active' : ''}`}
                      onClick={() => setNhauSubFilter('oc-haisan')}
                      disabled={spinning}
                    >
                      Ốc & Hải Sản
                    </button>
                    <button
                      type="button"
                      className={`session-pill-btn ${nhauSubFilter === 'bia-moi' ? 'active' : ''}`}
                      onClick={() => setNhauSubFilter('bia-moi')}
                      disabled={spinning}
                    >
                      Bia & Mồi
                    </button>
                  </div>
                )}

                {/* Sub-filter Đồ uống nếu tab Uống Gì */}
                {activeCategory === 'uong-gi' && (
                  <div className="session-filter-group">
                    <span className="control-label inline-flex items-center gap-1.5">
                      <Coffee size={13} className="text-sky-400 shrink-0" />
                      Đồ uống:
                    </span>
                    <button
                      type="button"
                      className={`session-pill-btn ${drinkSubFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setDrinkSubFilter('all')}
                      disabled={spinning}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      className={`session-pill-btn ${drinkSubFilter === 'tra-sua' ? 'active' : ''}`}
                      onClick={() => setDrinkSubFilter('tra-sua')}
                      disabled={spinning}
                    >
                      Trà sữa
                    </button>
                    <button
                      type="button"
                      className={`session-pill-btn ${drinkSubFilter === 'cafe' ? 'active' : ''}`}
                      onClick={() => setDrinkSubFilter('cafe')}
                      disabled={spinning}
                    >
                      Cà phê
                    </button>
                    <button
                      type="button"
                      className={`session-pill-btn ${drinkSubFilter === 'tra-traicay' ? 'active' : ''}`}
                      onClick={() => setDrinkSubFilter('tra-traicay')}
                      disabled={spinning}
                    >
                      Trà trái cây
                    </button>
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
                        title="Nhập số nghìn đồng (VD: 45)"
                      />
                      <span className="custom-budget-suffix">.000đ</span>
                    </div>
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
                  Tất Cả Quán ({allPlaces.length})
                </button>
                <button
                  className={`category-nav-tab ${placeCategory === 'an-chinh' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('an-chinh')}
                  disabled={placeSpinning}
                >
                  Quán Cơm & Bún Phở
                </button>
                <button
                  className={`category-nav-tab ${placeCategory === 'nhau-lau' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('nhau-lau')}
                  disabled={placeSpinning}
                >
                  Quán Nhậu & Lẩu Nướng
                </button>
                <button
                  className={`category-nav-tab ${placeCategory === 'uong' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('uong')}
                  disabled={placeSpinning}
                >
                  Cafe & Đồ Uống
                </button>
                <button
                  className={`category-nav-tab ${placeCategory === 'an-vat' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('an-vat')}
                  disabled={placeSpinning}
                >
                  Quán Ăn Vặt
                </button>
              </div>

              {/* Row 2: Khung giờ phục vụ (hiện toàn bộ) + Kèo & Mức giá trên cùng 1 dòng */}
              <div className="luxury-filter-bar">
                {/* 1. Khung giờ phục vụ (hiện toàn bộ ra) */}
                <div className="session-filter-group">
                  <span className="control-label inline-flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-400 shrink-0" />
                    Khung giờ:
                  </span>
                  {MEAL_SESSIONS.map((s) => {
                    const isLive = s.id === liveSession;
                    const isSelected = placeSession === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`session-pill-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => setPlaceSession(s.id)}
                        disabled={placeSpinning}
                        title={`${s.label} (${s.timeRange})`}
                      >
                        {isLive && <span className="live-gem-indicator mr-1.5" />}
                        {s.label.replace('Buổi ', '')}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`session-pill-btn ${placeSession === 'all' ? 'active' : ''}`}
                    onClick={() => setPlaceSession('all')}
                    disabled={placeSpinning}
                    title="Tất cả các quán cả ngày"
                  >
                    Cả ngày
                  </button>
                </div>

                <div className="luxury-bar-divider" />

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
            </>
          )}
        </section>

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
                        {rarityNames[food.rarity ?? 0]}
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
                    ĐANG CHỌN MÓN…
                  </span>
                ) : winnerFood ? (
                  <span>QUAY TIẾP</span>
                ) : (
                  <span>QUAY CHỌN MÓN</span>
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
                    ĐANG CHỌN QUÁN…
                  </span>
                ) : winnerPlace ? (
                  <span>QUAY TIẾP</span>
                ) : (
                  <span>QUAY CHỌN QUÁN</span>
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
                  Trong kho có gì?{' '}
                  <span>
                    {inventoryMode === 'unique' ? `${uniqueEligibleDishes.length} món độc bản` : `${eligibleItems.length} món`}
                  </span>
                </h2>
                <span className="inventory-hint">
                  {inventoryMode === 'unique'
                    ? 'Mỗi món đại diện 1 lần duy nhất (không trùng lặp) · Bấm vào món để xem các quán ở Xuân Hòa'
                    : 'Hiển thị danh sách đầy đủ theo từng quán tại Xuân Hòa'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* View Mode Toggle: Món độc bản vs Toàn bộ menu quán */}
                <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <button
                    type="button"
                    onClick={() => setInventoryMode('all')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '7px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: inventoryMode === 'all' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'transparent',
                      color: inventoryMode === 'all' ? '#fff' : '#cbd5e1',
                      border: 'none',
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Layers size={13} className="shrink-0" />
                      Toàn bộ menu quán
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryMode('unique')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '7px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: inventoryMode === 'unique' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                      color: inventoryMode === 'unique' ? '#000' : '#cbd5e1',
                      border: 'none',
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles size={13} className="shrink-0" />
                      Món độc bản (Không trùng)
                    </span>
                  </button>
                </div>

                {/* Smart Search Bar */}
                <div className="inventory-search-wrap">
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Tìm món, quán hoặc vị... (VD: bánh xèo, bún đậu, trà đào)"
                    value={dishSearchQuery}
                    onChange={e => setDishSearchQuery(e.target.value)}
                    className="inventory-search-input"
                  />
                  {dishSearchQuery && (
                    <button 
                      onClick={() => setDishSearchQuery('')} 
                      className="search-clear-btn inline-flex items-center justify-center"
                      title="Xóa tìm kiếm"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="inventory-grid">
              {displayedDishes
                .slice(0, visibleDishCount)
                .map(food => {
                  const rarity = food.rarity ?? 0;
                  const rarityColor = rarityColors[rarity] || '#06B6D4';
                  const rarityName = rarityNames[rarity] || 'Phổ thông';
                  const categoryLabel = getFoodCategoryLabel(food);
                  const displayTitle = cleanDishDisplayTitle(food.name);

                  return (
                    <div 
                      key={food.customId ?? food.image}
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
                })}
            </div>

            {eligibleItems.length > 18 && (
              <div className="inventory-pagination-bar">
                <div className="pagination-info">
                  <span>
                    Đang hiển thị <strong>{Math.min(visibleDishCount, eligibleItems.length)}</strong> / <strong>{eligibleItems.length}</strong> món đề xuất
                  </span>
                  <div className="pagination-progress-track">
                    <div 
                      className="pagination-progress-fill" 
                      style={{ width: `${Math.min(100, Math.round((Math.min(visibleDishCount, eligibleItems.length) / eligibleItems.length) * 100))}%` }} 
                    />
                  </div>
                </div>
                <div className="pagination-actions">
                  {eligibleItems.length > visibleDishCount && (
                    <>
                      <button
                        type="button"
                        className="btn-load-more"
                        onClick={() => setVisibleDishCount(prev => prev + 18)}
                      >
                        <ChevronDown size={18} />
                        <span>Xem tiếp (+{Math.min(18, eligibleItems.length - visibleDishCount)} món nữa)</span>
                      </button>
                      <button
                        type="button"
                        className="btn-load-all"
                        onClick={() => setVisibleDishCount(eligibleItems.length)}
                      >
                        Xem tất cả ({eligibleItems.length} món)
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
          </section>
        ) : (
          <section className="inventory-section">
            <div id="inventory-place-anchor" style={{ position: 'relative', top: '-24px' }} />
            <div className="inventory-heading-row">
              <div className="inventory-title-col">
                <h2>
                  DANH SÁCH ĐỊA ĐIỂM XÁC THỰC <span>{displayedPlacesForInventory.length} quán</span>
                </h2>
                <span className="inventory-hint">
                  Bấm vào quán để xem địa chỉ, hotline, Google Maps và thực đơn đầy đủ
                </span>
              </div>

              {/* Smart Search Bar cho bên quán */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="inventory-search-wrap">
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Tìm tên quán, địa chỉ hoặc món ăn..."
                    value={placeSearchQuery}
                    onChange={e => setPlaceSearchQuery(e.target.value)}
                    className="inventory-search-input"
                  />
                  {placeSearchQuery && (
                    <button 
                      onClick={() => setPlaceSearchQuery('')} 
                      className="search-clear-btn inline-flex items-center justify-center"
                      title="Xóa tìm kiếm"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
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
                        <ChevronDown size={18} />
                        <span>Xem tiếp (+{Math.min(16, displayedPlacesForInventory.length - visiblePlaceCount)} quán nữa)</span>
                      </button>
                      <button
                        type="button"
                        className="btn-load-all"
                        onClick={() => setVisiblePlaceCount(displayedPlacesForInventory.length)}
                      >
                        Xem tất cả ({displayedPlacesForInventory.length} quán)
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
  />

  {/* Place Modal (Quán Ăn) */}
  <PlaceModal 
    place={winnerPlace}
    isOpen={placeModalOpen}
    onClose={() => setPlaceModalOpen(false)}
    onSpinAgain={spinPlace}
    allPlaces={allPlaces}
    onSelectPlace={setWinnerPlace}
  />

  {/* Settings Menu Modal (Chuẩn Trưa Nay Ăn Gì - Grid 3 Cột) */}
  {/* Settings Menu Modal (4 ô tinh gọn: Ngôn ngữ, Âm lượng, Hướng dẫn, Cộng đồng) */}
  <SettingsMenuModal 
    isOpen={isSettingsMenuOpen}
    onClose={() => setIsSettingsMenuOpen(false)}
    sound={sound}
    onToggleSound={toggleSound}
    onOpenGuide={() => navigateTo('guide')}
    onOpenAbout={() => navigateTo('about')}
  />

  {/* Toast thông báo Bản Đồ Số */}
  {mapToast && (
    <div className="map-dev-toast">
      <Map size={18} className="text-amber-400" />
      <span>Bản đồ Số : Sắp ra mắt</span>
    </div>
  )}

  {/* Footer (Clean, Humorous & Professional) */}
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
        XUÂN HÒA CÓ GÌ
      </a>
      <p>Chuyên trị căn bệnh : &apos;&apos;Ăn gì cũng được&apos;&apos; !</p>
    </div>
    <div className="site-footer-links">
      <nav aria-label="Liên kết cuối trang">
        <button className={`footer-link-btn ${currentView === 'dishes' ? 'active' : ''}`} onClick={() => navigateTo('dishes')}>Khám phá món</button>
        <button className={`footer-link-btn ${currentView === 'places' ? 'active' : ''}`} onClick={() => navigateTo('places')}>Quán ăn</button>
        <button className={`footer-link-btn ${currentView === 'guide' ? 'active' : ''}`} onClick={() => navigateTo('guide')}>Cách sử dụng</button>
        <button className={`footer-link-btn ${currentView === 'about' ? 'active' : ''}`} onClick={() => navigateTo('about')}>Giới thiệu</button>
      </nav>
      <div className="site-footer-contact">
        <span>Crafted &amp; Curated by MinhTT © 2026</span>
      </div>
    </div>
  </footer>
    </div>
  );
}
