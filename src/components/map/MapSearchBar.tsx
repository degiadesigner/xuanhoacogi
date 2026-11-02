import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Route,
  Navigation,
  Bookmark,
  Compass,
} from 'lucide-react';
import type {
  GameAsset,
  MapAreaPreset,
  MapCategoryKey,
  PlaceLocation,
  RoadSearchResult,
} from '@/lib/map/map-types';
import { MAP_AREA_PRESETS } from '@/lib/map/map-config';
import { calculateDistanceAndEta } from '@/lib/map/map-data';
import { normalizeSearchVn } from '@/lib/admin-store';
import {
  getPlaceTaxonomyMeta,
  renderRegistryIcon,
} from '@/lib/map/map-category-registry';

interface MapSearchBarProps {
  verifiedPlaces: PlaceLocation[];
  unverifiedPlaces: PlaceLocation[];
  roads: RoadSearchResult[];
  gameAssets: GameAsset[];
  selectedCategories: MapCategoryKey[];
  isCategoryDrawerOpen: boolean;
  onToggleCategoryDrawer: () => void;
  savedPlaceIds?: string[];
  isSavedDrawerOpen?: boolean;
  onToggleSavedDrawer?: () => void;
  activeCategoryLabel?: string;
  onSelectVerifiedPlace: (place: PlaceLocation) => void;
  onSelectUnverifiedPlace: (place: PlaceLocation) => void;
  onSelectRoad: (road: RoadSearchResult) => void;
  onReviewRoad?: (road: RoadSearchResult) => void;
  onSelectGameAsset: (asset: GameAsset) => void;
  onSelectPreset: (preset: MapAreaPreset) => void;
  isGameLayerEnabled: boolean;
  onToggleGameLayer: () => void;
  isAdminUser: boolean;
  onOpenAdminCoordTool: (place?: PlaceLocation) => void;
  userCoords?: { lat: number; lng: number } | null;
  onDrawRouteToPlace?: (place: PlaceLocation) => void;
  onOpenMerchantPortal: (
    defaultTab?: 'merchant' | 'create_new' | 'admin_approvals' | 'admin_codes'
  ) => void;
  pendingApprovalCount: number;
  activePresetId?: string;
  hasClaimedPlaces?: boolean;
  claimedPlaceName?: string | null;
}

/**
 * THANH TÌM KIẾM TRÊN CÙNG TỐI GIẢN (PHẦN 6, 39, 49, 61)
 * - Không có nút "Danh mục ▼" trên top bar.
 * - Không dùng emoji.
 * - Luôn tìm kiếm toàn bộ địa điểm (kể cả khi tất cả business categories đang tắt trên bản đồ).
 */
export const MapSearchBar: React.FC<MapSearchBarProps> = ({
  verifiedPlaces,
  unverifiedPlaces,
  roads,
  savedPlaceIds = [],
  isSavedDrawerOpen = false,
  onToggleSavedDrawer,
  onSelectVerifiedPlace,
  onSelectUnverifiedPlace,
  onSelectRoad,
  onReviewRoad,
  onSelectPreset,
  isAdminUser,
  userCoords,
  onDrawRouteToPlace,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    const q = normalizeSearchVn(query);
    if (!q) {
      return {
        verified: [] as PlaceLocation[],
        unverified: [] as PlaceLocation[],
        matchedRoads: [] as RoadSearchResult[],
        reviewingRoads: [] as RoadSearchResult[],
        totalCount: 0,
      };
    }

    const isAlleyQuery = /\b(ngo|ngach|hem)\s+[0-9a-z]/i.test(q);

    // Luôn tìm trên toàn bộ địa điểm đã xác minh tọa độ (Phần 39)
    const verified = verifiedPlaces
      .filter((p) => {
        const tax = getPlaceTaxonomyMeta(p);
        const hay = normalizeSearchVn(
          `${p.name} ${p.address || ''} ${p.metadata?.subType || ''} ${tax.subMeta.label} ${tax.parentMeta.label} ${(p.metadata?.tags || []).join(' ')}`
        );
        return hay.includes(q);
      })
      .slice(0, 8);

    // Nguyên tắc 18: Search phải tôn trọng Verification
    // - Chỉ trả về road đã verified hoặc candidate rõ ràng trong matchedRoads.
    // - Nếu người dùng tìm một ngõ cụ thể (VD: "Ngõ 29 Nguyễn Văn Linh"), KHÔNG trả về đường chính "Nguyễn Văn Linh" bất kỳ.
    // - Nếu ngõ đang ở trạng thái needs_review / unverified -> đưa vào reviewingRoads để báo "Địa chỉ này đang được rà soát."
    const matchedRoads: RoadSearchResult[] = [];
    const reviewingRoads: RoadSearchResult[] = [];

    for (const r of roads) {
      if (r.verificationStatus === 'rejected' || r.nameSource === 'inferred') {
        continue;
      }
      const normName = normalizeSearchVn(r.name);
      if (!normName) continue;

      const isMatch = isAlleyQuery
        ? normName.includes(q) || q.includes(normName)
        : normName.includes(q);

      if (!isMatch) continue;

      // Nếu truy vấn là Ngõ/Ngách cụ thể, không khớp lùi về đường chính không phải ngõ
      if (isAlleyQuery && !/\b(ngo|ngach|hem)\b/i.test(normName)) {
        continue;
      }

      if (r.verificationStatus === 'needs_review' || r.verificationStatus === 'unverified') {
        reviewingRoads.push(r);
      } else {
        matchedRoads.push(r);
      }
    }

    const unverified = unverifiedPlaces
      .filter((p) => {
        const tax = getPlaceTaxonomyMeta(p);
        const hay = normalizeSearchVn(
          `${p.name} ${p.address || ''} ${p.metadata?.subType || ''} ${tax.subMeta.label}`
        );
        return hay.includes(q);
      })
      .slice(0, 4);

    return {
      verified,
      unverified,
      matchedRoads: matchedRoads.slice(0, 5),
      reviewingRoads: reviewingRoads.slice(0, 3),
      totalCount:
        verified.length + matchedRoads.length + reviewingRoads.length + unverified.length,
    };
  }, [query, verifiedPlaces, unverifiedPlaces, roads]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 max-w-md">
      {/* Thanh Search gọn, cao 40px, nền trắng, viền mảnh #E2E8F0 (Phần 6) */}
      <div className="flex items-center gap-2 bg-white/98 backdrop-blur-md border border-[#E2E8F0] rounded-xl px-3 h-10 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
        <Search size={16} strokeWidth={1.65} className="text-[#64748B] shrink-0" />

        <input
          type="text"
          value={query}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsFocused(true);
          }}
          placeholder="Tìm địa chỉ, quán..."
          aria-label="Tìm kiếm địa điểm hoặc đường phố tại Xuân Hòa"
          className="w-full bg-transparent text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] font-medium focus:outline-none min-w-0"
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Xóa từ khóa tìm kiếm"
            className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] cursor-pointer shrink-0"
          >
            <X size={14} strokeWidth={1.65} />
          </button>
        )}

        {/* Nút Địa điểm đã lưu bằng icon vector Bookmark sạch sẽ (Không dùng emoji ★) */}
        {onToggleSavedDrawer && (
          <button
            type="button"
            onClick={onToggleSavedDrawer}
            title="Địa điểm đã lưu"
            aria-label="Mở danh sách địa điểm đã lưu"
            className={`h-7 px-2 rounded-lg text-[11.5px] font-semibold border transition flex items-center gap-1 shrink-0 cursor-pointer ${
              isSavedDrawerOpen || savedPlaceIds.length > 0
                ? 'bg-[#ECFDF5] text-[#059669] border-[#059669]/40'
                : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]'
            }`}
          >
            <Bookmark size={14} strokeWidth={1.65} />
            {savedPlaceIds.length > 0 && (
              <span className="text-[11px] font-bold">{savedPlaceIds.length}</span>
            )}
          </button>
        )}
      </div>

      {/* Dropdown kết quả tìm kiếm */}
      {isFocused && (
        <div
          role="listbox"
          aria-label="Kết quả tìm kiếm bản đồ Xuân Hòa"
          className="mt-1.5 bg-white/98 backdrop-blur-md border border-[#E2E8F0] rounded-2xl shadow-[0_14px_34px_rgba(15,23,42,0.14)] max-h-[68vh] overflow-y-auto p-2 text-xs text-[#0F172A] space-y-2 z-50"
        >
          {!query.trim() ? (
            <div className="p-1.5 space-y-2">
              <div className="text-[11px] font-semibold text-[#64748B] px-1">
                Khu vực trọng điểm tại Phường Xuân Hòa
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {MAP_AREA_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(preset);
                      setIsFocused(false);
                    }}
                    className="text-left p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#ECFDF5] border border-[#E2E8F0] hover:border-[#059669]/40 transition-colors cursor-pointer flex items-start gap-2"
                  >
                    <Compass
                      size={15}
                      strokeWidth={1.65}
                      className="text-[#059669] shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0F172A] truncate text-[12px]">
                        {preset.label}
                      </div>
                      <div className="text-[10.5px] text-[#64748B] truncate mt-0.5">
                        {preset.sublabel}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : searchResults.totalCount === 0 ? (
            <div className="p-4 text-center text-[#64748B]">
              Không tìm thấy kết quả cho{' '}
              <strong className="text-[#0F172A]">"{query}"</strong>
            </div>
          ) : (
            <>
              {searchResults.verified.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Địa điểm trên bản đồ ({searchResults.verified.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.verified.map((place) => {
                      const tax = getPlaceTaxonomyMeta(place);
                      const eta =
                        userCoords && place.lat !== null && place.lng !== null
                          ? calculateDistanceAndEta(
                              userCoords.lat,
                              userCoords.lng,
                              place.lat,
                              place.lng
                            )
                          : null;
                      return (
                        <div
                          key={place.id}
                          className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F8FAFC] flex items-center justify-between gap-2 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectVerifiedPlace(place);
                              setIsFocused(false);
                            }}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <span className="w-7 h-7 rounded-full bg-white border border-[#059669] text-[#059669] flex items-center justify-center shrink-0">
                              {renderRegistryIcon(tax.subMeta.iconName, 14, 1.65)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-[#0F172A] truncate text-[12.5px]">
                                {place.name}
                              </div>
                              <div className="text-[11px] text-[#64748B] truncate">
                                <span className="text-[#059669] font-medium">
                                  {tax.subMeta.label}
                                </span>
                                {' · '}
                                {place.address}
                                {eta ? ` · ${eta.distanceText}` : ''}
                              </div>
                            </div>
                          </button>

                          {onDrawRouteToPlace && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDrawRouteToPlace(place);
                                setIsFocused(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#059669] text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 hover:bg-[#047857] cursor-pointer"
                            >
                              <Navigation size={11} strokeWidth={1.65} />
                              <span>Đi</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {searchResults.matchedRoads.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Tuyến đường & Ngõ đã xác minh ({searchResults.matchedRoads.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.matchedRoads.map((road) => (
                      <button
                        key={road.id}
                        type="button"
                        onClick={() => {
                          onSelectRoad(road);
                          setIsFocused(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F8FAFC] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Route
                            size={15}
                            strokeWidth={1.65}
                            className="text-[#059669] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0F172A] truncate text-[12.5px]">
                              {road.name}
                            </div>
                            <div className="text-[10.5px] text-[#64748B] truncate">
                              {road.parentRoad
                                ? `${road.roadType === 'lane' ? 'Ngách' : 'Ngõ'} thuộc ${road.parentRoad}`
                                : 'Tuyến đường Phường Xuân Hòa'}
                              {road.verificationStatus === 'candidate'
                                ? ' · Ứng viên đối chiếu'
                                : ' · Đã xác minh'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#059669] shrink-0">
                          Xem đường
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.reviewingRoads.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">
                    Đường / Ngõ đang rà soát ({searchResults.reviewingRoads.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.reviewingRoads.map((road) => (
                      <div
                        key={road.id}
                        className="w-full text-left px-2.5 py-2 rounded-xl bg-amber-50/90 border border-amber-200/80 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <Route
                            size={15}
                            strokeWidth={1.65}
                            className="text-amber-600 shrink-0 mt-0.5"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0F172A] truncate text-[12.5px]">
                              {road.name}
                            </div>
                            <div className="text-[11px] font-medium text-amber-800">
                              Địa chỉ này đang được rà soát.
                            </div>
                            {road.parentRoad && (
                              <div className="text-[10px] text-amber-700/80 truncate mt-0.5">
                                Thuộc trục: {road.parentRoad}
                                {road.candidateRoadId ? ` · Ứng viên: ${road.candidateRoadId}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        {isAdminUser && onReviewRoad ? (
                          <button
                            type="button"
                            onClick={() => {
                              onReviewRoad(road);
                              setIsFocused(false);
                            }}
                            className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 shrink-0 cursor-pointer"
                          >
                            Rà soát
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 shrink-0">
                            Đang rà soát
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.unverified.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Địa điểm trong danh mục ({searchResults.unverified.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.unverified.map((place) => {
                      const tax = getPlaceTaxonomyMeta(place);
                      return (
                        <div
                          key={place.id}
                          onClick={() => {
                            onSelectUnverifiedPlace(place);
                            setIsFocused(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F8FAFC] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-[#475569] flex items-center justify-center shrink-0">
                              {renderRegistryIcon(tax.subMeta.iconName, 14, 1.65)}
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#0F172A] truncate text-[12.5px]">
                                {place.name}
                              </div>
                              <div className="text-[10.5px] text-[#64748B] truncate">
                                {tax.subMeta.label} · {place.address}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10.5px] font-semibold text-[#64748B] shrink-0">
                            Chi tiết
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
