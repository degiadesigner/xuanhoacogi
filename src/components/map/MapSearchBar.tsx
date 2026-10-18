import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  MapPin,
  Route,
  AlertCircle,
  Castle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Compass,
} from 'lucide-react';
import type {
  GameAsset,
  MapCategoryKey,
  PlaceLocation,
  RoadSearchResult,
} from '@/lib/map/map-types';
import { MAP_CATEGORY_BY_ID } from '@/lib/map/map-categories';
import { normalizeVietnamese } from '@/lib/map/map-data';

interface MapSearchBarProps {
  verifiedPlaces: PlaceLocation[];
  unverifiedPlaces: PlaceLocation[];
  roads: RoadSearchResult[];
  gameAssets: GameAsset[];
  selectedCategories: MapCategoryKey[];
  isCategoryDrawerOpen: boolean;
  onToggleCategoryDrawer: () => void;
  onSelectVerifiedPlace: (place: PlaceLocation) => void;
  onSelectUnverifiedPlace: (place: PlaceLocation) => void;
  onSelectRoad: (road: RoadSearchResult) => void;
  onSelectGameAsset: (asset: GameAsset) => void;
  isGameLayerEnabled: boolean;
  onToggleGameLayer: () => void;
  isAdminUser: boolean;
  onOpenAdminCoordTool: (place?: PlaceLocation) => void;
}

export const MapSearchBar: React.FC<MapSearchBarProps> = ({
  verifiedPlaces,
  unverifiedPlaces,
  roads,
  gameAssets,
  selectedCategories,
  isCategoryDrawerOpen,
  onToggleCategoryDrawer,
  onSelectVerifiedPlace,
  onSelectUnverifiedPlace,
  onSelectRoad,
  onSelectGameAsset,
  isGameLayerEnabled,
  onToggleGameLayer,
  isAdminUser,
  onOpenAdminCoordTool,
}) => {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce 200ms theo Phần 8
  useEffect(() => {
    if (!rawQuery.trim()) {
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim());
      setIsSearching(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [rawQuery]);

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

  const results = useMemo(() => {
    const q = normalizeVietnamese(debouncedQuery);
    if (!q) {
      return {
        matchedVerified: [] as PlaceLocation[],
        matchedRoads: [] as RoadSearchResult[],
        matchedUnverified: [] as PlaceLocation[],
        matchedGame: [] as GameAsset[],
        totalCount: 0,
      };
    }

    const matchLocation = (loc: PlaceLocation) => {
      const catLabel = MAP_CATEGORY_BY_ID[loc.category]?.label || '';
      const haystack = normalizeVietnamese(
        `${loc.name} ${loc.address} ${catLabel} ${loc.metadata.signatureDishName || ''} ${(loc.metadata.tags || []).join(' ')}`
      );
      return haystack.includes(q);
    };

    const matchedVerified = verifiedPlaces.filter(matchLocation).slice(0, 8);
    const matchedRoads = roads
      .filter((r) => normalizeVietnamese(r.name).includes(q))
      .slice(0, 6);
    const matchedUnverified = unverifiedPlaces.filter(matchLocation).slice(0, 8);
    const matchedGame = gameAssets
      .filter((g) => normalizeVietnamese(`${g.name} ${g.districtLabel}`).includes(q))
      .slice(0, 4);

    return {
      matchedVerified,
      matchedRoads,
      matchedUnverified,
      matchedGame,
      totalCount:
        matchedVerified.length +
        matchedRoads.length +
        matchedUnverified.length +
        matchedGame.length,
    };
  }, [debouncedQuery, verifiedPlaces, unverifiedPlaces, roads, gameAssets]);

  const activeFilterCount = selectedCategories.includes('all')
    ? 0
    : selectedCategories.length;

  const showDropdown = isFocused && rawQuery.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      {/* Thanh tìm kiếm & Nút danh mục */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#FFFDF9]/95 backdrop-blur-md border-2 transition-all shadow-[0_6px_20px_rgba(64,48,100,0.10)]"
          style={{
            borderColor: isFocused ? '#39B980' : '#403064',
          }}
        >
          <Search size={18} className="shrink-0 text-[#403064]" />
          <input
            type="text"
            value={rawQuery}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              setRawQuery(e.target.value);
              setIsFocused(true);
            }}
            placeholder="Tìm quán, trường học, tên đường (Nguyễn Văn Linh, Đại Lải...)"
            aria-label="Tìm kiếm địa điểm hoặc tên đường trên bản đồ Xuân Hòa"
            className="w-full bg-transparent text-[13.5px] font-semibold text-[#2D2246] placeholder:text-[#7B6F95] focus:outline-none"
          />
          {isSearching && (
            <Loader2 size={16} className="shrink-0 animate-spin text-[#39B980]" />
          )}
          {rawQuery && (
            <button
              type="button"
              onClick={() => {
                setRawQuery('');
                setDebouncedQuery('');
              }}
              aria-label="Xóa từ khóa tìm kiếm"
              className="p-1 rounded-full hover:bg-[#F1ECE1] text-[#65587F] transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Nút mở Danh mục ẩn (Drawer / Bottom Sheet) */}
        <button
          type="button"
          onClick={onToggleCategoryDrawer}
          className="relative flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border-2 font-bold text-xs transition-all shrink-0 shadow-[0_6px_18px_rgba(64,48,100,0.10)] cursor-pointer"
          style={{
            backgroundColor: isCategoryDrawerOpen || activeFilterCount > 0 ? '#39B980' : '#FFFDF9',
            borderColor: '#403064',
            color: isCategoryDrawerOpen || activeFilterCount > 0 ? '#FFFFFF' : '#403064',
          }}
          aria-expanded={isCategoryDrawerOpen}
          aria-label="Mở bộ lọc danh mục địa điểm"
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Danh mục</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#403064] text-white text-[10px] font-extrabold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Nút bật/tắt Lớp Tài sản Game Demo */}
        <button
          type="button"
          onClick={onToggleGameLayer}
          className="hidden md:flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border-2 font-bold text-xs transition-all shrink-0 shadow-[0_6px_18px_rgba(64,48,100,0.10)] cursor-pointer"
          style={{
            backgroundColor: isGameLayerEnabled ? '#403064' : '#FFFDF9',
            borderColor: '#403064',
            color: isGameLayerEnabled ? '#FFFFFF' : '#403064',
          }}
          title="Bật/Tắt lớp Tài sản Game XUHO CITY (Dữ liệu Demo)"
        >
          <Castle size={15} className={isGameLayerEnabled ? 'text-[#39B980]' : 'text-[#403064]'} />
          <span>Game Layer</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-extrabold"
            style={{
              backgroundColor: isGameLayerEnabled ? '#39B980' : '#E5F0DF',
              color: isGameLayerEnabled ? '#FFFFFF' : '#1D7A52',
            }}
          >
            {isGameLayerEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Bảng kết quả tìm kiếm */}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 mt-2 rounded-2xl bg-[#FFFDF9] border-2 border-[#403064] shadow-[0_14px_36px_rgba(64,48,100,0.18)] max-h-[70vh] overflow-y-auto z-50 p-2"
          role="listbox"
        >
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs font-semibold text-[#65587F]">
              <Loader2 size={16} className="animate-spin text-[#39B980]" />
              <span>Đang tìm kiếm địa điểm & tuyến đường tại Xuân Hòa...</span>
            </div>
          ) : results.totalCount === 0 ? (
            <div className="py-7 px-4 text-center">
              <Compass size={26} className="mx-auto mb-2 text-[#65587F] opacity-60" />
              <p className="text-xs font-bold text-[#2D2246]">
                Không tìm thấy kết quả khớp với “{debouncedQuery}”
              </p>
              <p className="text-[11px] text-[#65587F] mt-1">
                Thử tìm theo tên đường (Nguyễn Văn Linh, Lê Quang Đạo, Kim Ngọc), trường học (ĐHSP2, Cơ Điện) hoặc tên quán.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 1. Địa điểm đã xác minh tọa độ trên bản đồ */}
              {results.matchedVerified.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#1D7A52] bg-[#E6F7EF] rounded-lg">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} /> Địa điểm đã xác minh tọa độ ({results.matchedVerified.length})
                    </span>
                    <span>Bay tới vị trí</span>
                  </div>
                  <div className="mt-1 divide-y divide-[#F0EAE0]">
                    {results.matchedVerified.map((loc) => {
                      const cat = MAP_CATEGORY_BY_ID[loc.category];
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => {
                            onSelectVerifiedPlace(loc);
                            setIsFocused(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F5F1E6] transition-colors flex items-start gap-2.5 cursor-pointer"
                        >
                          <span
                            className="mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border border-[#403064] text-white"
                            style={{ backgroundColor: cat?.markerBg || '#39B980' }}
                          >
                            <MapPin size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-[#2D2246] truncate">
                                {loc.name}
                              </span>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: cat?.badgeBg || '#E6F7EF',
                                  color: cat?.badgeText || '#1D7A52',
                                }}
                              >
                                {cat?.shortLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#65587F] truncate mt-0.5">
                              {loc.address}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Tuyến đường thực tế từ OpenStreetMap */}
              {results.matchedRoads.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#403064] bg-[#F1ECE1] rounded-lg">
                    <span className="flex items-center gap-1">
                      <Route size={12} /> Tuyến đường & Phố thực tế ({results.matchedRoads.length})
                    </span>
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
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-[#FFF5D6] border border-[#403064] flex items-center justify-center text-[#403064] shrink-0">
                            <Route size={13} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#2D2246] truncate">
                              {road.name}
                            </p>
                            <p className="text-[10px] text-[#65587F]">
                              {road.insideWard ? 'Trong ranh giới Phường Xuân Hòa' : 'Tuyến đường kết nối lân cận'} · {road.osmId}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-[#1D7A52] shrink-0">
                          Xem đường →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Quán trong danh mục chưa xác minh tọa độ (Phần 7: hiển thị trong danh sách, không đặt marker giả) */}
              {results.matchedUnverified.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#92400E] bg-[#FEF3C7] rounded-lg">
                    <span className="flex items-center gap-1">
                      <AlertCircle size={12} /> Quán trong danh mục — Chưa xác minh tọa độ ({results.matchedUnverified.length})
                    </span>
                    <span>Xem thực đơn</span>
                  </div>
                  <div className="mt-1 divide-y divide-[#F0EAE0]">
                    {results.matchedUnverified.map((loc) => (
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
                            <span className="text-xs font-bold text-[#2D2246] truncate">
                              {loc.name}
                            </span>
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/40">
                              Chờ xác minh tọa độ
                            </span>
                          </div>
                          <p className="text-[11px] text-[#65587F] truncate mt-0.5">
                            {loc.address} {loc.metadata.priceRange ? `· ${loc.metadata.priceRange}` : ''}
                          </p>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAdminUser && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenAdminCoordTool(loc);
                                setIsFocused(false);
                              }}
                              className="px-2 py-1 rounded-lg bg-[#39B980] text-white text-[10px] font-bold hover:bg-[#2FA36E] cursor-pointer"
                            >
                              Gắn tọa độ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onSelectUnverifiedPlace(loc);
                              setIsFocused(false);
                            }}
                            className="px-2 py-1 rounded-lg bg-[#F1ECE1] text-[#403064] text-[10px] font-bold hover:bg-[#E5DEC9] flex items-center gap-1 cursor-pointer"
                          >
                            <span>Menu</span>
                            <ExternalLink size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Tài sản Game Demo */}
              {results.matchedGame.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#403064] bg-[#EDE9FE] rounded-lg">
                    <span className="flex items-center gap-1">
                      <Castle size={12} /> Tài sản Game XUHO CITY — Dữ liệu Demo ({results.matchedGame.length})
                    </span>
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
                          <p className="text-xs font-bold text-[#403064] truncate">
                            {asset.name}
                          </p>
                          <p className="text-[10px] text-[#65587F]">
                            {asset.districtLabel} · Giá ảo: {asset.virtualBuyPriceXu.toLocaleString('vi-VN')} XU
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
