import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  MapPin,
  Route,
  AlertCircle,
  Castle,
  CheckCircle2,
  ExternalLink,
  Compass,
  Sparkles,
  Store,
  Navigation,
} from 'lucide-react';
import type {
  GameAsset,
  MapAreaPreset,
  MapCategoryKey,
  PlaceLocation,
  RoadSearchResult,
} from '@/lib/map/map-types';
import { MAP_CATEGORY_BY_ID } from '@/lib/map/map-categories';
import { MAP_AREA_PRESETS, XUANHOA_DEFAULT_CENTER } from '@/lib/map/map-config';
import {
  normalizeVietnamese,
  calculateDistanceAndEta,
  evaluatePlaceOpenStatus,
} from '@/lib/map/map-data';

interface MapSearchBarProps {
  verifiedPlaces: PlaceLocation[];
  unverifiedPlaces: PlaceLocation[];
  roads: RoadSearchResult[];
  gameAssets: GameAsset[];
  selectedCategories: MapCategoryKey[];
  isCategoryDrawerOpen: boolean;
  onToggleCategoryDrawer: () => void;
  activeCategoryLabel?: string;
  onSelectVerifiedPlace: (place: PlaceLocation) => void;
  onSelectUnverifiedPlace: (place: PlaceLocation) => void;
  onSelectRoad: (road: RoadSearchResult) => void;
  onSelectGameAsset: (asset: GameAsset) => void;
  onSelectPreset?: (preset: MapAreaPreset) => void;
  isGameLayerEnabled: boolean;
  onToggleGameLayer: () => void;
  isAdminUser: boolean;
  onOpenAdminCoordTool: (place?: PlaceLocation) => void;
  userCoords?: { lat: number; lng: number } | null;
  onDrawRouteToPlace?: (place: PlaceLocation) => void;
  onOpenMerchantPortal?: (tab?: 'merchant' | 'admin_approvals' | 'admin_codes') => void;
  pendingApprovalCount?: number;
  activePresetId?: string;
  hasClaimedPlaces?: boolean;
  claimedPlaceName?: string | null;
  savedPlaceIds?: string[];
  isSavedDrawerOpen?: boolean;
  onToggleSavedDrawer?: () => void;
}

type QuickTopicId =
  | 'all_places'
  | 'food_verified'
  | 'civic'
  | 'school'
  | 'roads'
  | 'zones'
  | 'kdt'
  | 'heritage'
  | 'fuel_market'
  | 'resort';

const QUICK_TOPICS: Array<{ id: QuickTopicId; label: string }> = [
  { id: 'all_places', label: 'Tất cả' },
  { id: 'food_verified', label: 'Hàng quán' },
  { id: 'civic', label: 'Cơ quan & Trụ sở' },
  { id: 'school', label: 'Trường học' },
  { id: 'roads', label: 'Đường & Ngõ' },
  { id: 'zones', label: '11 Khu vực' },
];

export const MapSearchBar: React.FC<MapSearchBarProps> = ({
  verifiedPlaces,
  unverifiedPlaces,
  roads,
  gameAssets,
  selectedCategories,
  isCategoryDrawerOpen,
  onToggleCategoryDrawer,
  activeCategoryLabel = 'Danh mục',
  onSelectVerifiedPlace,
  onSelectUnverifiedPlace,
  onSelectRoad,
  onSelectGameAsset,
  onSelectPreset,
  isGameLayerEnabled,
  onToggleGameLayer,
  isAdminUser,
  onOpenAdminCoordTool,
  userCoords,
  onDrawRouteToPlace,
  onOpenMerchantPortal,
  pendingApprovalCount = 0,
  activePresetId = 'dhsp2',
  hasClaimedPlaces = false,
  claimedPlaceName = null,
  savedPlaceIds = [],
  isSavedDrawerOpen = false,
  onToggleSavedDrawer,
}) => {
  const [rawQuery, setRawQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeQuickTopic, setActiveQuickTopic] = useState<QuickTopicId>('all_places');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const originLat = userCoords ? userCoords.lat : XUANHOA_DEFAULT_CENTER.lat;
  const originLng = userCoords ? userCoords.lng : XUANHOA_DEFAULT_CENTER.lng;

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tìm kiếm tức thì 0ms ngay trên Client (Ưu tiên sắp xếp quán gần vị trí định vị của khách nhất!)
  const results = useMemo(() => {
    const q = normalizeVietnamese(rawQuery);
    if (!q) {
      return {
        matchedPresets: [] as MapAreaPreset[],
        matchedVerified: [] as PlaceLocation[],
        matchedRoads: [] as RoadSearchResult[],
        matchedUnverified: [] as PlaceLocation[],
        matchedGame: [] as GameAsset[],
        totalCount: 0,
      };
    }

    const terms = q.split(' ').filter(Boolean);
    const matchesAllTerms = (haystack: string) => {
      const norm = normalizeVietnamese(haystack);
      return terms.every((t) => norm.includes(t));
    };

    const matchedPresets = MAP_AREA_PRESETS.filter((p) =>
      matchesAllTerms(`${p.label} ${p.sublabel}`)
    ).slice(0, 4);

    const matchLocation = (loc: PlaceLocation) => {
      const catLabel = MAP_CATEGORY_BY_ID[loc.category]?.label || '';
      const haystack = `${loc.name} ${loc.address} ${catLabel} ${loc.metadata.subType || ''} ${loc.metadata.signatureDishName || ''} ${(loc.metadata.tags || []).join(' ')}`;
      return matchesAllTerms(haystack);
    };

    // Sắp xếp kết quả đã có tọa độ theo khoảng cách gần khách hàng nhất (như Google Maps)
    const matchedVerified = verifiedPlaces
      .filter(matchLocation)
      .sort((a, b) => {
        if (a.lat === null || a.lng === null) return 1;
        if (b.lat === null || b.lng === null) return -1;
        const da = Math.hypot(a.lat - originLat, a.lng - originLng);
        const db = Math.hypot(b.lat - originLat, b.lng - originLng);
        return da - db;
      })
      .slice(0, 20);

    const matchedRoads = roads
      .filter((r) => matchesAllTerms(r.name))
      .slice(0, 15);
    const matchedUnverified = unverifiedPlaces.filter(matchLocation).slice(0, 10);
    const matchedGame = gameAssets
      .filter((g) => matchesAllTerms(`${g.name} ${g.districtLabel}`))
      .slice(0, 3);

    return {
      matchedPresets,
      matchedVerified,
      matchedRoads,
      matchedUnverified,
      matchedGame,
      totalCount:
        matchedPresets.length +
        matchedVerified.length +
        matchedRoads.length +
        matchedUnverified.length +
        matchedGame.length,
    };
  }, [rawQuery, verifiedPlaces, unverifiedPlaces, roads, gameAssets, originLat, originLng]);

  // Danh sách gợi ý nhanh khi người dùng chạm vào ô tìm kiếm nhưng chưa gõ chữ
  const quickTopicItems = useMemo(() => {
    if (activeQuickTopic === 'all_places') {
      return {
        places: verifiedPlaces
          .slice()
          .sort((a, b) => {
            if (a.dataSource !== 'openstreetmap' && b.dataSource === 'openstreetmap') return -1;
            if (a.dataSource === 'openstreetmap' && b.dataSource !== 'openstreetmap') return 1;
            return (
              Math.hypot((a.lat || 0) - originLat, (a.lng || 0) - originLng) -
              Math.hypot((b.lat || 0) - originLat, (b.lng || 0) - originLng)
            );
          })
          .slice(0, 40),
        roads: roads.slice(0, 8),
      };
    }
    if (activeQuickTopic === 'food_verified') {
      const foodAndCommercial = verifiedPlaces.filter(
        (p) =>
          p.dataSource !== 'openstreetmap' ||
          ['food', 'cafe', 'snack', 'pub', 'billiards', 'game', 'supermarket', 'phone'].includes(
            p.category
          )
      );
      return {
        places: (foodAndCommercial.length > 0 ? foodAndCommercial : verifiedPlaces)
          .slice()
          .sort((a, b) => {
            if (a.dataSource !== 'openstreetmap' && b.dataSource === 'openstreetmap') return -1;
            if (a.dataSource === 'openstreetmap' && b.dataSource !== 'openstreetmap') return 1;
            return (
              Math.hypot((a.lat || 0) - originLat, (a.lng || 0) - originLng) -
              Math.hypot((b.lat || 0) - originLat, (b.lng || 0) - originLng)
            );
          })
          .slice(0, 30),
        roads: [] as RoadSearchResult[],
      };
    }
    if (activeQuickTopic === 'civic') {
      return {
        places: verifiedPlaces
          .filter((p) => p.category === 'public' || p.category === 'service')
          .slice(0, 30),
        roads: [] as RoadSearchResult[],
      };
    }
    if (activeQuickTopic === 'school') {
      return {
        places: verifiedPlaces.filter((p) => p.category === 'school').slice(0, 20),
        roads: [] as RoadSearchResult[],
      };
    }
    return {
      places: [] as PlaceLocation[],
      roads: roads.slice(0, 40),
    };
  }, [activeQuickTopic, verifiedPlaces, roads, originLat, originLng]);

  const activeFilterCount = selectedCategories.includes('all')
    ? 0
    : selectedCategories.length;

  const hasQuery = rawQuery.trim().length > 0;
  const showDropdown = isFocused;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-w-0 max-w-full lg:max-w-xl"
      style={{
        fontFamily:
          "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Thanh tìm kiếm gọn gàng chuẩn Google Maps */}
      <div className="flex items-center gap-1.5">
        <div
          className="flex-1 min-w-0 flex items-center gap-1 pl-1.5 pr-2.5 h-9 sm:h-10 rounded-full bg-white/96 backdrop-blur-md border transition-all shadow-[0_6px_20px_rgba(15,23,42,0.10)]"
          style={{
            borderColor: isFocused ? '#10B981' : 'rgba(203,213,225,0.9)',
          }}
        >
          <button
            type="button"
            onClick={onToggleCategoryDrawer}
            className="flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-[#1E1633] hover:bg-[#2D2246] text-white text-[11px] sm:text-[11.5px] font-extrabold transition-all shrink-0 cursor-pointer max-w-[128px] sm:max-w-[180px]"
            title="Bật/tắt các danh mục trên bản đồ"
          >
            <span className="truncate">{activeCategoryLabel}</span>
            <span className="text-[9px] opacity-80 ml-0.5 shrink-0">{isCategoryDrawerOpen ? '▲' : '▼'}</span>
          </button>

          {onToggleSavedDrawer && (
            <button
              type="button"
              onClick={onToggleSavedDrawer}
              title="Địa điểm đã lưu của bạn (★)"
              className={`flex items-center justify-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-extrabold border transition-all shrink-0 cursor-pointer ${
                isSavedDrawerOpen || savedPlaceIds.length > 0
                  ? 'bg-[#FEF3C7] text-[#B45309] border-[#F59E0B] hover:bg-[#FDE68A]'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <span>★</span>
              {savedPlaceIds.length > 0 && (
                <span className="text-[10px] font-extrabold">{savedPlaceIds.length}</span>
              )}
            </button>
          )}

          <div className="mx-0.5 h-4 w-[1px] bg-slate-200 shrink-0" />

          <input
            ref={inputRef}
            type="text"
            value={rawQuery}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              setRawQuery(e.target.value);
              setIsFocused(true);
            }}
            placeholder="Tìm địa chỉ, quán..."
            aria-label="Tìm kiếm quán ăn, địa điểm hoặc tên đường trên bản đồ Xuân Hòa"
            className="w-full min-w-0 bg-transparent text-[12px] sm:text-[12.5px] leading-snug font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {rawQuery && (
            <button
              type="button"
              onClick={() => {
                setRawQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Xóa từ khóa tìm kiếm"
              className="px-1 rounded-full hover:bg-slate-100 text-slate-500 text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Bảng kết quả tìm kiếm hoặc Khám phá nhanh (Chuẩn 100% Mobile & PC không tràn viền) */}
      {showDropdown && (
        <div
          className="fixed left-2.5 right-2.5 top-[52px] md:absolute md:left-0 md:right-0 md:top-full md:mt-2 rounded-2xl bg-[#FFFDF9] border border-[#403064]/85 shadow-[0_16px_40px_rgba(64,48,100,0.22)] max-h-[70vh] overflow-y-auto z-50 p-2.5"
          role="listbox"
        >
          {!hasQuery ? (
            /* CHẾ ĐỘ KHÁM PHÁ NHANH KHI CHƯA GÕ TỪ KHÓA */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-extrabold text-[#403064] leading-snug">
                  <span>
                    {userCoords
                      ? 'Khám phá gần vị trí định vị của bạn'
                      : 'Khám phá nhanh Xuân Hòa'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFocused(false)}
                  className="text-[11px] font-bold text-[#65587F] hover:text-[#2D2246] px-2 py-0.5 rounded-lg bg-[#F1ECE1] cursor-pointer"
                >
                  Đóng
                </button>
              </div>

              {/* Chip chủ đề nhanh */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {QUICK_TOPICS.map((topic) => {
                  const active = activeQuickTopic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setActiveQuickTopic(topic.id)}
                      className="px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold leading-snug transition-all cursor-pointer border"
                      style={{
                        backgroundColor: active ? '#403064' : '#F6F2E9',
                        borderColor: active ? '#403064' : '#E2DAC9',
                        color: active ? '#FFFFFF' : '#2D2246',
                      }}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>

              {/* Danh sách Khu vực trọng điểm hoặc Địa điểm / Đường phố thuộc chủ đề đang chọn */}
              <div className="divide-y divide-[#F0EAE0] max-h-[44vh] overflow-y-auto pr-0.5">
                {activeQuickTopic === 'zones' && onSelectPreset
                  ? MAP_AREA_PRESETS.map((preset, idx) => {
                      const isActive = preset.id === activePresetId;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            onSelectPreset(preset);
                            setIsFocused(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#E6F7EF]/60 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#F1ECE1] text-[#403064]">
                                #{idx + 1}
                              </span>
                              <span className="text-xs font-extrabold text-[#2D2246] truncate">
                                {preset.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#65587F] truncate mt-0.5">
                              {preset.sublabel}
                            </p>
                          </div>
                          <span
                            className="text-[10.5px] font-extrabold px-2 py-1 rounded-lg shrink-0"
                            style={{
                              backgroundColor: isActive ? '#403064' : '#E6F7EF',
                              color: isActive ? '#FFFFFF' : '#1D7A52',
                            }}
                          >
                            {isActive ? 'Đang xem' : 'Bay tới →'}
                          </span>
                        </button>
                      );
                    })
                  : null}

                {activeQuickTopic !== 'zones' &&
                  quickTopicItems.places.map((loc) => {
                    const cat = MAP_CATEGORY_BY_ID[loc.category];
                    const eta =
                      loc.lat !== null && loc.lng !== null
                        ? calculateDistanceAndEta(originLat, originLng, loc.lat, loc.lng)
                        : null;
                    const openInfo = evaluatePlaceOpenStatus(
                      loc.openHours,
                      loc.metadata.liveStatus,
                      loc.metadata.liveStatusNote
                    );

                    return (
                      <div
                        key={loc.id}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-[#E6F7EF]/60 transition-colors flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectVerifiedPlace(loc);
                            setIsFocused(false);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <span
                            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border border-[#403064] text-white"
                            style={{ backgroundColor: cat?.markerBg || '#39B980' }}
                          >
                            <MapPin size={13} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-[#2D2246] leading-snug truncate">
                                {loc.name}
                              </p>
                              {eta && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-[#E6F7EF] text-[#1D7A52]">
                                  {eta.distanceText} • {eta.bikeMinutes}p
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#65587F] leading-snug truncate">
                              {loc.address}{' '}
                              {loc.openHours ? `• ${openInfo.badgeText}` : ''}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {onDrawRouteToPlace && loc.lat !== null && loc.lng !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                onDrawRouteToPlace(loc);
                                setIsFocused(false);
                              }}
                              className="text-[10.5px] font-extrabold text-white px-2.5 py-1 rounded-lg bg-[#39B980] hover:bg-[#2FA36E] flex items-center cursor-pointer"
                              title="Chỉ đường từ vị trí của bạn tới địa điểm này"
                            >
                              <span>Chỉ đường</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {activeQuickTopic !== 'zones' &&
                  quickTopicItems.roads.map((road) => (
                    <button
                      key={road.id}
                      type="button"
                      onClick={() => {
                        onSelectRoad(road);
                        setIsFocused(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F5F1E6] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#2D2246] leading-snug truncate">
                          {road.name}
                        </p>
                        <p className="text-[10.5px] text-[#65587F] leading-snug">
                          Tuyến phố thực tế tại Phường Xuân Hòa
                        </p>
                      </div>
                      <span className="text-[10.5px] font-extrabold text-[#1D7A52] px-2 py-1 rounded-lg bg-[#E6F7EF] shrink-0">
                        Xem đường
                      </span>
                    </button>
                  ))}
              </div>

              {/* Dòng truy cập nhanh Cổng Chủ Quán gọn gàng ở đáy menu tìm kiếm */}
              {onOpenMerchantPortal && (
                <div className="pt-1.5 border-t border-[#E5DEC9] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFocused(false);
                      onOpenMerchantPortal(
                        isAdminUser && pendingApprovalCount > 0 ? 'admin_approvals' : 'merchant'
                      );
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#EDE9FE] border border-[#D8CFC0] text-[11px] font-bold text-[#403064] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate">
                      {isAdminUser
                        ? `Quản trị Chủ Quán & Mã Code (${pendingApprovalCount} chờ duyệt)`
                        : hasClaimedPlaces
                        ? 'Mở bảng quản lý & ghim vị trí quán của bạn'
                        : 'Bạn là Chủ Quán? Nhập mã hoặc nhận quyền quản lý quán'}
                    </span>
                    <span className="text-[10.5px] font-extrabold text-[#1D7A52] shrink-0">
                      Mở ngay
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : results.totalCount === 0 ? (
            <div className="py-6 px-4 text-center">
              <Compass size={26} className="mx-auto mb-2 text-[#65587F] opacity-60" />
              <p className="text-xs font-bold text-[#2D2246] leading-snug">
                Không tìm thấy kết quả khớp với “{rawQuery.trim()}”
              </p>
              <p className="text-[11px] text-[#65587F] mt-1 leading-relaxed">
                Thử gõ không dấu hoặc có dấu: <strong>com</strong>, <strong>bun</strong>,{' '}
                <strong>tra sua</strong>, <strong>sp2</strong>, <strong>le quang dao</strong>...
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* 0. Khu vực trọng điểm khớp từ khóa */}
              {results.matchedPresets.length > 0 && onSelectPreset && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#403064] bg-[#EDE9FE] rounded-lg leading-snug">
                    <span>Phân khu trọng điểm ({results.matchedPresets.length})</span>
                    <span>Bay tới ngay</span>
                  </div>
                  <div className="mt-1 divide-y divide-[#F0EAE0]">
                    {results.matchedPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onSelectPreset(preset);
                          setIsFocused(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F5F1E6] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#2D2246] leading-snug truncate">
                            {preset.label}
                          </p>
                          <p className="text-[11px] text-[#65587F] leading-snug truncate">
                            {preset.sublabel}
                          </p>
                        </div>
                        <span className="text-[10.5px] font-extrabold text-[#FFFFFF] px-2 py-1 rounded-lg bg-[#39B980] shrink-0">
                          Bay tới
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. Địa điểm & Quán đã có định vị chuẩn trên bản đồ */}
              {results.matchedVerified.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#1D7A52] bg-[#E6F7EF] rounded-lg leading-snug">
                    <span>Quán & Địa điểm đã định vị ({results.matchedVerified.length})</span>
                    <span>Gần nhất</span>
                  </div>
                  <div className="mt-1 divide-y divide-[#F0EAE0]">
                    {results.matchedVerified.map((loc) => {
                      const eta =
                        loc.lat !== null && loc.lng !== null
                          ? calculateDistanceAndEta(originLat, originLng, loc.lat, loc.lng)
                          : null;
                      const openStatus = evaluatePlaceOpenStatus(
                        loc.openHours,
                        loc.metadata.liveStatus,
                        loc.metadata.liveStatusNote
                      );

                      return (
                        <div
                          key={loc.id}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-[#F5F1E6] transition-colors flex items-center justify-between gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectVerifiedPlace(loc);
                              setIsFocused(false);
                            }}
                            className="flex items-start gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-extrabold text-[#2D2246] leading-snug truncate">
                                  {loc.name}
                                </span>
                                <span
                                  className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md leading-snug"
                                  style={{
                                    backgroundColor:
                                      openStatus.tone === 'emerald'
                                        ? '#E6F7EF'
                                        : openStatus.tone === 'amber'
                                        ? '#FEF3C7'
                                        : '#FEE2E2',
                                    color:
                                      openStatus.tone === 'emerald'
                                        ? '#1D7A52'
                                        : openStatus.tone === 'amber'
                                        ? '#92400E'
                                        : '#991B1B',
                                  }}
                                >
                                  {openStatus.badgeText}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#65587F] leading-snug truncate mt-0.5">
                                {loc.address}{' '}
                                {loc.openHours ? `• ${loc.openHours}` : ''}
                              </p>
                              {eta && (
                                <p className="text-[11px] font-bold text-[#1D7A52] mt-0.5">
                                  Cách {eta.distanceText} • Xe {eta.bikeText} • Bộ {eta.walkText}
                                </p>
                              )}
                            </div>
                          </button>

                          {onDrawRouteToPlace && loc.lat !== null && loc.lng !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                onDrawRouteToPlace(loc);
                                setIsFocused(false);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] text-white border border-[#403064] text-[10.5px] font-extrabold shrink-0 cursor-pointer"
                            >
                              Chỉ đường
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Tuyến đường & Ngõ thực tế từ OpenStreetMap */}
              {results.matchedRoads.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#403064] bg-[#F1ECE1] rounded-lg leading-snug">
                    <span>Đường phố & Ngõ ({results.matchedRoads.length})</span>
                    <span>OpenStreetMap</span>
                  </div>
                  <div className="mt-1 divide-y divide-[#F0EAE0]">
                    {results.matchedRoads.map((road) => (
                      <button
                        key={road.id}
                        type="button"
                        onClick={() => {
                          onSelectRoad(road);
                          setIsFocused(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F5F1E6] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#2D2246] leading-snug truncate">
                            {road.name}
                          </p>
                          <p className="text-[10.5px] text-[#65587F] leading-snug">
                            {road.insideWard
                              ? 'Phường Xuân Hòa'
                              : 'Tuyến đường kết nối lân cận'}
                          </p>
                        </div>
                        <span className="text-[10.5px] font-bold text-[#1D7A52] shrink-0">
                          Xem đường
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Quán trong danh mục chưa xác minh tọa độ */}
              {results.matchedUnverified.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#92400E] bg-[#FEF3C7] rounded-lg leading-snug">
                    <span>Quán chờ cắm định vị ({results.matchedUnverified.length})</span>
                    <span>Xem Menu / Ghim</span>
                  </div>
                  <div className="mt-1 divide-y divide-[#F0EAE0]">
                    {results.matchedUnverified.map((loc) => {
                      const openStatus = evaluatePlaceOpenStatus(
                        loc.openHours,
                        loc.metadata.liveStatus,
                        loc.metadata.liveStatusNote
                      );
                      return (
                        <div
                          key={loc.id}
                          className="px-2.5 py-2 rounded-xl hover:bg-[#F5F1E6] transition-colors flex items-center justify-between gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectUnverifiedPlace(loc);
                              setIsFocused(false);
                            }}
                            className="flex-1 text-left min-w-0 cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-[#2D2246] leading-snug truncate">
                                {loc.name}
                              </span>
                              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/40 leading-snug">
                                Chờ ghim
                              </span>
                              <span className="text-[9.5px] font-bold text-[#1D7A52]">
                                • {openStatus.badgeText}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#65587F] leading-snug truncate mt-0.5">
                              {loc.address}{' '}
                              {loc.openHours ? `· ${loc.openHours}` : ''}{' '}
                              {loc.metadata.priceRange ? `· ${loc.metadata.priceRange}` : ''}
                            </p>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onOpenMerchantPortal && (
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenMerchantPortal('merchant');
                                  setIsFocused(false);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#EDE9FE] text-[#403064] border border-[#403064]/30 text-[10px] font-extrabold hover:bg-[#DDD6FE] cursor-pointer"
                                title="Chủ quán nhập mã code để tự cắm định vị"
                              >
                                Chủ quán ghim
                              </button>
                            )}
                            {isAdminUser && (
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenAdminCoordTool(loc);
                                  setIsFocused(false);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#39B980] text-white text-[10px] font-bold hover:bg-[#2FA36E] cursor-pointer"
                              >
                                Admin ghim
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                onSelectUnverifiedPlace(loc);
                                setIsFocused(false);
                              }}
                              className="px-2 py-1 rounded-lg bg-[#F1ECE1] text-[#403064] text-[10px] font-bold hover:bg-[#E5DEC9] cursor-pointer"
                            >
                              Menu
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Tài sản Game Demo */}
              {results.matchedGame.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#403064] bg-[#EDE9FE] rounded-lg leading-snug">
                    <span>Lô đất Game XUHO CITY — Demo ({results.matchedGame.length})</span>
                    <span>Mô phỏng</span>
                  </div>
                  <div className="mt-1 divide-y divide-[#F0EAE0]">
                    {results.matchedGame.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          onSelectGameAsset(asset);
                          setIsFocused(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F5F1E6] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#403064] leading-snug truncate">
                            {asset.name}
                          </p>
                          <p className="text-[10.5px] text-[#65587F] leading-snug">
                            {asset.districtLabel} · Giá ảo:{' '}
                            {asset.virtualBuyPriceXu.toLocaleString('vi-VN')} XU
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#403064] text-white shrink-0">
                          DEMO
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
