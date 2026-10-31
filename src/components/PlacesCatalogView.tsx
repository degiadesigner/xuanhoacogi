import React, { useState, useMemo, useEffect, useRef } from 'react';
import { xuanHoaPlaces, Place } from '@/lib/places-xuanhoa';
import { getActivePublicPlaces, getAdminState } from '@/lib/admin-store';
import { VERIFIED_OSM_POIS, haversineDistanceMeters } from '@/lib/map/map-data';
import {
  MAIN_PLACE_CATEGORIES,
  MainPlaceCategoryKey,
  getPlaceMainCategories,
  getPlaceSubcategories,
  getPlaceDisplayTypeBadge,
  getPlaceMapAvailability,
} from '@/lib/place-map-utils';
import { PlaceCard } from './PlaceCard';
import {
  Search,
  ChevronDown,
  Check,
  Store,
  X,
} from 'lucide-react';

interface PlacesCatalogViewProps {
  onSelectPlace: (place: Place) => void;
  onGoToSpin: () => void;
  onGoToDishes?: () => void;
}

export type PlaceSortKey =
  | 'recommend'
  | 'rating'
  | 'nearest'
  | 'price_asc'
  | 'price_desc'
  | 'updated';

interface SortOptionDef {
  id: PlaceSortKey;
  label: string;
  shortLabel: string;
  icon: string;
}

const SORT_OPTIONS: SortOptionDef[] = [
  { id: 'recommend', label: 'Đề xuất', shortLabel: '↕ Đề xuất', icon: '↕' },
  { id: 'rating', label: 'Đánh giá cao', shortLabel: '⭐ Đánh giá cao', icon: '⭐' },
  { id: 'nearest', label: 'Gần tôi', shortLabel: '📍 Gần tôi', icon: '📍' },
  { id: 'price_asc', label: 'Giá thấp', shortLabel: '↑ Giá thấp', icon: '↑' },
  { id: 'price_desc', label: 'Giá cao', shortLabel: '↓ Giá cao', icon: '↓' },
  { id: 'updated', label: 'Mới cập nhật', shortLabel: '✨ Mới cập nhật', icon: '✨' },
];

const PAGE_SIZE = 12; // 2 cột × 6 hàng = 12 quán (Mục 1 & 21)

const CATEGORY_DROPDOWN_ITEMS: Array<{
  id: MainPlaceCategoryKey;
  label: string;
  buttonLabel: string;
  icon: string;
}> = [
  { id: 'all', label: 'Tất cả', buttonLabel: '🍴 Tất cả danh mục', icon: '🍴' },
  { id: 'an', label: 'Ăn', buttonLabel: '🍜 Ăn', icon: '🍜' },
  { id: 'nhau', label: 'Nhậu', buttonLabel: '🍻 Nhậu', icon: '🍻' },
  { id: 'uong', label: 'Uống', buttonLabel: '☕ Uống', icon: '☕' },
  { id: 'vui-choi', label: 'Vui chơi', buttonLabel: '🎱 Vui chơi', icon: '🎱' },
  { id: 'dich-vu', label: 'Dịch vụ', buttonLabel: '🛠 Dịch vụ', icon: '🛠' },
  { id: 'dia-danh', label: 'Địa danh', buttonLabel: '🏛 Địa danh', icon: '🏛' },
];

function buildLandmarkPlaces(): Place[] {
  const adminState = getAdminState();

  return VERIFIED_OSM_POIS.filter((poi) => (adminState.places?.[poi.id] as any)?.isHidden !== true).map(
    (poi): Place => {
      const ov = adminState.places?.[poi.id];
      const name = ov?.name || poi.name;
      const address = ov?.address || poi.address;
      const tagline = ov?.tagline || poi.metadata?.subType || 'Địa danh & Tiện ích Xuân Hòa';
      const phone = ov?.phone || poi.phone;
      const openHours = ov?.openHours || poi.openHours || 'Mở cửa tự do';
      const mapsUrl = ov?.mapsUrl || poi.metadata?.mapsUrl;
      const lat = typeof ov?.lat === 'number' ? ov.lat : poi.lat;
      const lng = typeof ov?.lng === 'number' ? ov.lng : poi.lng;

      return {
        id: poi.id,
        name,
        tagline,
        category: 'restaurant',
        subcategory: poi.metadata?.subType || 'Địa danh',
        address,
        distance: poi.metadata?.distance || 'Phường Xuân Hòa',
        zone: 'center',
        rating: 4.9,
        reviewCount: 120,
        priceRange: poi.metadata?.priceRange || 'Công cộng',
        minPrice: 0,
        maxPrice: 0,
        imageUrl: '/brand/brand-icon-mark.webp',
        openHours,
        serviceMode: 'dine_in_only',
        phone,
        mapsQuery: `${name} Xuân Hòa`,
        mapsUrl,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        rarity: 2,
        quip: tagline,
        signatureDish: {
          id: `${poi.id}-sig`,
          name: poi.metadata?.subType || tagline,
          price: 0,
        },
        menu: [],
        tags: [
          poi.metadata?.subType || 'Địa danh',
          poi.category === 'school'
            ? 'Trường học'
            : poi.category === 'public'
            ? 'Công viên & Hồ'
            : 'Tiện ích',
        ],
      };
    }
  );
}

interface IndexedPlaceEntry {
  place: Place;
  sectorTag?: string;
  mainCategories: Exclude<MainPlaceCategoryKey, 'all'>[];
  subcategoriesByMain: Record<string, string[]>;
  searchBlob: string;
  menuItemsNormalized: Array<{ rawName: string; rawPrice: number; normText: string }>;
  sigNormalized: { rawName: string; rawPrice: number; normText: string } | null;
  effectivePrice: number;
  orderIndex: number;
}

export function PlacesCatalogView({
  onSelectPlace,
}: PlacesCatalogViewProps) {
  const [syncTick, setSyncTick] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  useEffect(() => {
    const onSync = () => setSyncTick((t) => t + 1);
    window.addEventListener('xuanhoa_admin_sync', onSync);
    return () => window.removeEventListener('xuanhoa_admin_sync', onSync);
  }, []);

  // Kiểm tra vị trí GPS của người dùng (nếu có) để bật/tắt sort "Gần tôi" (Mục 5)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('xuanhoa_last_user_gps');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Precompute danh sách quán + search index 1 lần duy nhất mỗi khi dữ liệu thay đổi (Mục 37 & 38)
  const { allIndexedCatalog, allIndexedCombined, mainCategoryCounts } = useMemo(() => {
    const adminState = getAdminState();
    const active = getActivePublicPlaces();
    const baseList = active.length > 0 ? active : xuanHoaPlaces;
    const seen = new Set<string>();

    const catalogUnique = baseList.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const landmarks = buildLandmarkPlaces().filter((lm) => {
      if (seen.has(lm.id)) return false;
      seen.add(lm.id);
      return true;
    });

    const buildIndex = (place: Place, idx: number, isLandmark: boolean): IndexedPlaceEntry => {
      const sectorTag = isLandmark ? 'dia-danh' : adminState.places?.[place.id]?.sectorTag;
      const mainCategories = getPlaceMainCategories(place, sectorTag);
      const subcategoriesByMain: Record<string, string[]> = {};
      for (const mc of mainCategories) {
        subcategoriesByMain[mc] = getPlaceSubcategories(place, mc, sectorTag);
      }

      const typeBadge = getPlaceDisplayTypeBadge(place, sectorTag);
      const searchParts = [
        place.name,
        place.address,
        place.tagline,
        place.category,
        place.subcategory,
        typeBadge,
        ...(place.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const menuItemsNormalized = (place.menu || []).map((m) => ({
        rawName: m.name,
        rawPrice: m.price,
        normText: `${m.name} ${m.description || ''} ${m.tag || ''}`.toLowerCase(),
      }));

      const sigNormalized = place.signatureDish?.name
        ? {
            rawName: place.signatureDish.name,
            rawPrice: place.signatureDish.price,
            normText: place.signatureDish.name.toLowerCase(),
          }
        : null;

      const effectivePrice =
        place.minPrice > 0
          ? place.minPrice
          : place.signatureDish?.price > 0
          ? place.signatureDish.price
          : 35;

      return {
        place,
        sectorTag,
        mainCategories,
        subcategoriesByMain,
        searchBlob: searchParts,
        menuItemsNormalized,
        sigNormalized,
        effectivePrice,
        orderIndex: idx,
      };
    };

    const indexedCatalog = catalogUnique.map((p, i) => buildIndex(p, i, false));
    const indexedLandmarks = landmarks.map((p, i) =>
      buildIndex(p, catalogUnique.length + i, true)
    );
    const indexedCombined = [...indexedCatalog, ...indexedLandmarks];

    const counts: Record<MainPlaceCategoryKey, number> = {
      all: indexedCatalog.length,
      an: 0,
      nhau: 0,
      uong: 0,
      'vui-choi': 0,
      'dich-vu': 0,
      'dia-danh': indexedLandmarks.length,
    };

    for (const item of indexedCombined) {
      for (const c of item.mainCategories) {
        counts[c] = (counts[c] || 0) + 1;
      }
    }

    return {
      allIndexedCatalog: indexedCatalog,
      allIndexedCombined: indexedCombined,
      mainCategoryCounts: counts,
    };
  }, [syncTick]);

  // Search input + Debounce 120ms (Mục 38)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (!searchInput.trim()) {
      setDebouncedQuery('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim().toLowerCase());
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Category, Subcategory & Sort states (Mục 3, 4, 5)
  const [mainCategory, setMainCategory] = useState<MainPlaceCategoryKey>('all');
  const [subCategory, setSubCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<PlaceSortKey>('rating');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Dropdown open states
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const filterRowRef = useRef<HTMLDivElement>(null);
  const gridTopRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    if (!isCatDropdownOpen && !isSortDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRowRef.current && !filterRowRef.current.contains(e.target as Node)) {
        setIsCatDropdownOpen(false);
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCatDropdownOpen, isSortDropdownOpen]);

  // Reset visibleCount = 12 khi filter / sort / search thay đổi (Mục 23)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedQuery, mainCategory, subCategory, sortBy]);

  // Danh mục con có dữ liệu thật cho Category đang chọn (Mục 3 & 7)
  const availableSubcategories = useMemo(() => {
    if (mainCategory === 'all') return [];
    const catDef = MAIN_PLACE_CATEGORIES.find((c) => c.id === mainCategory);
    if (!catDef || catDef.subcategories.length === 0) return [];

    const inMain = allIndexedCombined.filter((item) =>
      item.mainCategories.includes(mainCategory)
    );

    return catDef.subcategories
      .map((subName) => {
        const count = inMain.filter((item) =>
          (item.subcategoriesByMain[mainCategory] || []).includes(subName)
        ).length;
        return { name: subName, count };
      })
      .filter((s) => s.count > 0);
  }, [mainCategory, allIndexedCombined]);

  // Lọc & sắp xếp tức thì trên client (Mục 37, 38, 39)
  const { filteredEntries, matchedDishByPlaceId } = useMemo(() => {
    const q = debouncedQuery;
    const dishMatchMap: Record<string, string> = {};

    const sourcePool =
      q.length > 0 ||
      mainCategory === 'dia-danh' ||
      mainCategory === 'vui-choi' ||
      mainCategory === 'dich-vu'
        ? allIndexedCombined
        : allIndexedCatalog;

    const filtered = sourcePool.filter((entry) => {
      // 1. Lọc theo Category chính & Subcategory
      if (mainCategory !== 'all') {
        if (!entry.mainCategories.includes(mainCategory)) return false;
        if (subCategory !== 'all') {
          const subs = entry.subcategoriesByMain[mainCategory] || [];
          if (!subs.includes(subCategory)) return false;
        }
      }

      // 2. Lọc theo từ khóa tìm kiếm (Tên quán, địa chỉ, loại hình, món ăn, đồ uống, dịch vụ, địa danh)
      if (q) {
        const matchMeta = entry.searchBlob.includes(q);
        const matchedMenu = entry.menuItemsNormalized.find((m) => m.normText.includes(q));
        const matchSig =
          entry.sigNormalized && entry.sigNormalized.normText.includes(q)
            ? entry.sigNormalized
            : null;

        if (matchedMenu) {
          dishMatchMap[entry.place.id] =
            matchedMenu.rawPrice > 0
              ? `${matchedMenu.rawName} (${matchedMenu.rawPrice}k)`
              : matchedMenu.rawName;
        } else if (matchSig) {
          dishMatchMap[entry.place.id] =
            matchSig.rawPrice > 0
              ? `${matchSig.rawName} (${matchSig.rawPrice}k)`
              : matchSig.rawName;
        }

        if (!matchMeta && !matchedMenu && !matchSig) return false;
      }

      return true;
    });

    // 3. Sắp xếp (Mục 5)
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rating': {
          if (b.place.rating !== a.place.rating) return b.place.rating - a.place.rating;
          return (b.place.reviewCount || 0) - (a.place.reviewCount || 0);
        }
        case 'nearest': {
          if (!userCoords) return 0;
          const avA = getPlaceMapAvailability(a.place);
          const avB = getPlaceMapAvailability(b.place);
          const distA =
            avA.lat !== null && avA.lng !== null
              ? haversineDistanceMeters(userCoords.lat, userCoords.lng, avA.lat, avA.lng)
              : 999999;
          const distB =
            avB.lat !== null && avB.lng !== null
              ? haversineDistanceMeters(userCoords.lat, userCoords.lng, avB.lat, avB.lng)
              : 999999;
          return distA - distB;
        }
        case 'price_asc': {
          return a.effectivePrice - b.effectivePrice;
        }
        case 'price_desc': {
          return b.effectivePrice - a.effectivePrice;
        }
        case 'updated': {
          // Những quán mới bổ sung ở cuối danh sách hiện lên đầu
          return b.orderIndex - a.orderIndex;
        }
        case 'recommend':
        default: {
          // Đề xuất: ưu tiên quán có đánh giá & độ hiếm tốt
          const scoreA = (a.place.rating || 4.8) * 10 + (a.place.rarity || 1) * 2;
          const scoreB = (b.place.rating || 4.8) * 10 + (b.place.rarity || 1) * 2;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return (b.place.reviewCount || 0) - (a.place.reviewCount || 0);
        }
      }
    });

    return {
      filteredEntries: sorted,
      matchedDishByPlaceId: dishMatchMap,
    };
  }, [allIndexedCatalog, allIndexedCombined, debouncedQuery, mainCategory, subCategory, sortBy, userCoords]);

  const displayedEntries = useMemo(() => {
    return filteredEntries.slice(0, visibleCount);
  }, [filteredEntries, visibleCount]);

  const hasActiveFilters =
    Boolean(searchInput.trim()) ||
    mainCategory !== 'all' ||
    subCategory !== 'all' ||
    sortBy !== 'rating';

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setMainCategory('all');
    setSubCategory('all');
    setSortBy('rating');
    setVisibleCount(PAGE_SIZE);
  };

  // Nhãn hiển thị trên nút Category Dropdown (Mục 3, 31, 32)
  const activeCategoryButtonText = useMemo(() => {
    const found =
      CATEGORY_DROPDOWN_ITEMS.find((c) => c.id === mainCategory) || CATEGORY_DROPDOWN_ITEMS[0];
    if (mainCategory === 'all') return found.buttonLabel;
    if (subCategory !== 'all') {
      return `${found.icon} ${subCategory}`;
    }
    return found.buttonLabel;
  }, [mainCategory, subCategory]);

  // Nhãn hiển thị trên nút Sort Dropdown (Mục 4, 5, 33)
  const activeSortButtonText = useMemo(() => {
    const found = SORT_OPTIONS.find((s) => s.id === sortBy) || SORT_OPTIONS[1];
    return found.shortLabel;
  }, [sortBy]);

  return (
    <div className="xh-places-hub-container">
      {/* 1. HEADER QUÁN XÁ GỌN (Mục 2 & 30) */}
      <header className="xh-places-hub-header">
        <div className="xh-places-hub-title-row">
          <h1 className="xh-places-hub-title">
            QUÁN XÁ <span>XUÂN HÒA</span>
          </h1>
          <span className="xh-places-hub-subtitle">Ăn uống • Vui chơi • Dịch vụ</span>
        </div>

        {/* 2. SEARCH FULL WIDTH + COUNTER PHỤ NHỎ GÓC PHẢI (Mục 6 & 34) */}
        <div className="xh-places-search-wrap">
          <Search size={15} className="xh-places-search-icon" />
          <input
            type="search"
            className="xh-places-search-input"
            placeholder="Tìm quán, món ăn, đồ uống, địa điểm…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Tìm quán, món ăn, đồ uống, địa điểm"
          />
          <div className="xh-places-search-right">
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedQuery('');
                }}
                className="xh-places-search-clear"
                aria-label="Xóa từ khóa"
              >
                <X size={13} />
              </button>
            )}
            <span className="xh-places-search-count">
              {filteredEntries.length} quán
            </span>
          </div>
        </div>

        {/* 3. MỘT HÀNG FILTER 50% / 50%: [ Tất cả danh mục ▾ ] [ Đánh giá cao ▾ ] (Mục 3, 4, 5, 31, 32, 33, 34) */}
        <div className="xh-places-filter-bar-5050" ref={filterRowRef}>
          {/* Cột Trái (50%): Dropdown Danh mục */}
          <div className="xh-dropdown-col">
            <button
              type="button"
              onClick={() => {
                setIsCatDropdownOpen((prev) => !prev);
                setIsSortDropdownOpen(false);
              }}
              aria-expanded={isCatDropdownOpen}
              className={`xh-filter-dropdown-btn ${
                mainCategory !== 'all' || isCatDropdownOpen ? 'active' : ''
              }`}
            >
              <span className="truncate">{activeCategoryButtonText}</span>
              <ChevronDown
                size={14}
                className={`shrink-0 transition-transform duration-150 ${
                  isCatDropdownOpen ? 'rotate-180 text-[#E5B85C]' : 'text-slate-400'
                }`}
              />
            </button>

            {isCatDropdownOpen && (
              <div className="xh-dropdown-menu left" role="menu" aria-label="Chọn danh mục">
                <div className="xh-dropdown-section-label">Danh mục</div>
                {CATEGORY_DROPDOWN_ITEMS.map((item) => {
                  const count = mainCategoryCounts[item.id] || 0;
                  if (item.id !== 'all' && count === 0) return null;
                  const isSelected = mainCategory === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMainCategory(item.id);
                        setSubCategory('all');
                        setIsCatDropdownOpen(false);
                      }}
                      className={`xh-dropdown-option ${isSelected ? 'selected' : ''}`}
                    >
                      <span className="xh-dropdown-opt-left">
                        <span className="xh-dropdown-opt-check">
                          {isSelected ? <Check size={13} className="text-[#E5B85C]" /> : item.icon}
                        </span>
                        <span>{item.label}</span>
                      </span>
                      <span className="xh-dropdown-opt-count">{count}</span>
                    </button>
                  );
                })}

                {/* Nếu đang chọn 1 Category có Subcategory thật thì hiển thị gọn bên dưới menu (Mục 3) */}
                {availableSubcategories.length > 0 && (
                  <div className="xh-dropdown-subcat-block">
                    <div className="xh-dropdown-section-label">
                      Lọc chi tiết ({CATEGORY_DROPDOWN_ITEMS.find((c) => c.id === mainCategory)?.label})
                    </div>
                    <div className="xh-dropdown-subcat-pills">
                      <button
                        type="button"
                        onClick={() => {
                          setSubCategory('all');
                          setIsCatDropdownOpen(false);
                        }}
                        className={`xh-subcat-mini-pill ${subCategory === 'all' ? 'active' : ''}`}
                      >
                        Tất cả
                      </button>
                      {availableSubcategories.map((sub) => (
                        <button
                          key={sub.name}
                          type="button"
                          onClick={() => {
                            setSubCategory(sub.name);
                            setIsCatDropdownOpen(false);
                          }}
                          className={`xh-subcat-mini-pill ${
                            subCategory === sub.name ? 'active' : ''
                          }`}
                        >
                          {sub.name} ({sub.count})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cột Phải (50%): Dropdown Sắp xếp */}
          <div className="xh-dropdown-col">
            <button
              type="button"
              onClick={() => {
                setIsSortDropdownOpen((prev) => !prev);
                setIsCatDropdownOpen(false);
              }}
              aria-expanded={isSortDropdownOpen}
              className={`xh-filter-dropdown-btn ${isSortDropdownOpen ? 'active' : ''}`}
            >
              <span className="truncate">{activeSortButtonText}</span>
              <ChevronDown
                size={14}
                className={`shrink-0 transition-transform duration-150 ${
                  isSortDropdownOpen ? 'rotate-180 text-[#E5B85C]' : 'text-slate-400'
                }`}
              />
            </button>

            {isSortDropdownOpen && (
              <div className="xh-dropdown-menu right" role="menu" aria-label="Sắp xếp theo">
                <div className="xh-dropdown-section-label">Sắp xếp theo</div>
                {SORT_OPTIONS.map((opt) => {
                  const isDisabled = opt.id === 'nearest' && !userCoords;
                  const isSelected = sortBy === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitem"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        setSortBy(opt.id);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`xh-dropdown-option ${isSelected ? 'selected' : ''} ${
                        isDisabled ? 'disabled' : ''
                      }`}
                      title={
                        isDisabled
                          ? 'Cần bật định vị GPS trên Bản đồ số để sắp xếp theo khoảng cách gần nhất'
                          : opt.label
                      }
                    >
                      <span className="xh-dropdown-opt-left">
                        <span className="xh-dropdown-opt-check">
                          {isSelected ? <Check size={13} className="text-[#E5B85C]" /> : opt.icon}
                        </span>
                        <span>{opt.label}</span>
                      </span>
                      {isDisabled && (
                        <span className="text-[10px] text-slate-500">Chưa bật vị trí</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Điểm neo đầu Grid */}
      <div ref={gridTopRef} />

      {/* 4. GRID QUÁN 2 CỘT (2 cột × 6 hàng = 12 quán mỗi lượt - Mục 1, 7, 21, 25, 26) */}
      {isInitialLoading ? (
        <div className="xh-compact-places-grid" aria-busy="true">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="xh-compact-skeleton-card">
              <div className="xh-skeleton-media" />
              <div className="xh-skeleton-body">
                <div className="xh-skeleton-line w-4/5" />
                <div className="xh-skeleton-line w-3/5" />
                <div className="xh-skeleton-line w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEntries.length > 0 ? (
        <>
          <div className="xh-compact-places-grid">
            {displayedEntries.map((entry, idx) => (
              <PlaceCard
                key={entry.place.id}
                place={entry.place}
                sectorTag={entry.sectorTag}
                matchedDishHighlight={matchedDishByPlaceId[entry.place.id] || null}
                eagerImage={idx < 4}
                onClick={() => onSelectPlace(entry.place)}
              />
            ))}
          </div>

          {/* 5. NÚT XEM THÊM (+12 quán mỗi lần bấm, giữ nguyên vị trí cuộn - Mục 1, 21, 22, 39) */}
          {visibleCount < filteredEntries.length && (
            <div className="xh-load-more-container">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="xh-load-more-btn"
              >
                <span>
                  Xem thêm {Math.min(PAGE_SIZE, filteredEntries.length - visibleCount)} quán
                </span>
                <span className="xh-load-more-sub">
                  ({Math.min(visibleCount, filteredEntries.length)}/{filteredEntries.length})
                </span>
              </button>
            </div>
          )}
        </>
      ) : (
        /* 6. EMPTY STATE GỌN (Mục 24) */
        <div className="xh-places-empty-state">
          <Store size={36} className="text-[#E5B85C]/80" />
          <p className="xh-empty-title">Không tìm thấy quán phù hợp.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="xh-empty-reset-btn"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}
    </div>
  );
}
