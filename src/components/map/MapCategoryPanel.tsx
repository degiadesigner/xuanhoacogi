import React, { useMemo } from 'react';
import {
  X,
  RotateCcw,
  Compass,
  UtensilsCrossed,
  Coffee,
  Sparkles,
  Flame,
  CircleDot,
  Gamepad2,
  Music,
  Smartphone,
  ShoppingBag,
  Store,
  Wrench,
  GraduationCap,
  Landmark,
  Castle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { GameAsset, MapCategoryKey, PlaceLocation } from '@/lib/map/map-types';
import { MAP_CATEGORIES, type MapCategoryDefinition } from '@/lib/map/map-categories';

interface MapCategoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategories: MapCategoryKey[];
  onToggleCategory: (category: MapCategoryKey) => void;
  onResetCategories: () => void;
  verifiedPlaces: PlaceLocation[];
  unverifiedPlaces: PlaceLocation[];
  gameAssets: GameAsset[];
  onSelectVerifiedPlace: (place: PlaceLocation) => void;
  onSelectUnverifiedPlace: (place: PlaceLocation) => void;
  isAdminUser: boolean;
  onOpenAdminCoordTool: (place?: PlaceLocation) => void;
}

export function renderCategoryIcon(
  iconName: MapCategoryDefinition['iconName'],
  size = 16
) {
  switch (iconName) {
    case 'UtensilsCrossed':
      return <UtensilsCrossed size={size} />;
    case 'Coffee':
      return <Coffee size={size} />;
    case 'Sparkles':
      return <Sparkles size={size} />;
    case 'Flame':
      return <Flame size={size} />;
    case 'CircleDot':
      return <CircleDot size={size} />;
    case 'Gamepad2':
      return <Gamepad2 size={size} />;
    case 'Music':
      return <Music size={size} />;
    case 'Smartphone':
      return <Smartphone size={size} />;
    case 'ShoppingBag':
      return <ShoppingBag size={size} />;
    case 'Store':
      return <Store size={size} />;
    case 'Wrench':
      return <Wrench size={size} />;
    case 'GraduationCap':
      return <GraduationCap size={size} />;
    case 'Landmark':
      return <Landmark size={size} />;
    case 'Castle':
      return <Castle size={size} />;
    case 'Compass':
    default:
      return <Compass size={size} />;
  }
}

export const MapCategoryPanel: React.FC<MapCategoryPanelProps> = ({
  isOpen,
  onClose,
  selectedCategories,
  onToggleCategory,
  onResetCategories,
  verifiedPlaces,
  unverifiedPlaces,
  gameAssets,
  onSelectVerifiedPlace,
  onSelectUnverifiedPlace,
  isAdminUser,
  onOpenAdminCoordTool,
}) => {
  const countsByCategory = useMemo(() => {
    const verifiedMap: Record<string, number> = {};
    const unverifiedMap: Record<string, number> = {};

    for (const cat of MAP_CATEGORIES) {
      verifiedMap[cat.id] = 0;
      unverifiedMap[cat.id] = 0;
    }

    for (const p of verifiedPlaces) {
      verifiedMap[p.category] = (verifiedMap[p.category] || 0) + 1;
      verifiedMap['all'] = (verifiedMap['all'] || 0) + 1;
    }
    for (const p of unverifiedPlaces) {
      unverifiedMap[p.category] = (unverifiedMap[p.category] || 0) + 1;
      unverifiedMap['all'] = (unverifiedMap['all'] || 0) + 1;
    }
    verifiedMap['game_asset'] = gameAssets.length;

    return { verifiedMap, unverifiedMap };
  }, [verifiedPlaces, unverifiedPlaces, gameAssets]);

  const filteredUnverifiedList = useMemo(() => {
    if (selectedCategories.includes('all')) {
      return unverifiedPlaces.slice(0, 20);
    }
    return unverifiedPlaces
      .filter((p) => selectedCategories.includes(p.category))
      .slice(0, 25);
  }, [selectedCategories, unverifiedPlaces]);

  const filteredVerifiedList = useMemo(() => {
    if (selectedCategories.includes('all')) {
      return verifiedPlaces;
    }
    return verifiedPlaces.filter((p) => selectedCategories.includes(p.category));
  }, [selectedCategories, verifiedPlaces]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-[#2D2246]/35 backdrop-blur-[2px]">
      {/* Vùng bấm ra ngoài để đóng */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer (Desktop) / Bottom Sheet (Mobile) */}
      <aside
        aria-label="Bộ lọc danh mục địa điểm XUHO CITY"
        className="w-full md:w-[430px] max-h-[82vh] md:max-h-full bg-[#F8F5EE] border-t-2 md:border-t-0 md:border-l-2 border-[#403064] rounded-t-3xl md:rounded-none shadow-[0_-10px_35px_rgba(64,48,100,0.2)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-[#FFFDF9] border-b border-[#E5DEC9] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#2D2246] flex items-center gap-2">
              <span>Danh mục Địa điểm & Lớp Bản đồ</span>
            </h2>
            <p className="text-[11px] text-[#65587F] mt-0.5">
              Chọn 1 hoặc nhiều nhóm để lọc ghim trên bản đồ Xuân Hòa
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {!selectedCategories.includes('all') && (
              <button
                type="button"
                onClick={onResetCategories}
                className="px-2.5 py-1.5 rounded-xl bg-[#E6F7EF] text-[#1D7A52] text-[11px] font-bold flex items-center gap-1 hover:bg-[#D1F2E1] cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Mặc định</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng bảng danh mục"
              className="p-1.5 rounded-xl bg-[#F1ECE1] text-[#403064] hover:bg-[#E5DEC9] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Nội dung cuộn */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Lưới 15 danh mục */}
          <div className="grid grid-cols-2 gap-2">
            {MAP_CATEGORIES.map((cat) => {
              const isSelected = selectedCategories.includes(cat.id);
              const vCount = countsByCategory.verifiedMap[cat.id] || 0;
              const uCount = countsByCategory.unverifiedMap[cat.id] || 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onToggleCategory(cat.id)}
                  className="text-left p-2.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-1.5 cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? '#E6F7EF' : '#FFFDF9',
                    borderColor: isSelected ? '#39B980' : '#E2DAC9',
                  }}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-white border border-[#403064] shrink-0"
                      style={{ backgroundColor: cat.markerBg }}
                    >
                      {renderCategoryIcon(cat.iconName, 14)}
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md"
                        style={{
                          backgroundColor: vCount > 0 ? '#E6F7EF' : '#F3EFE6',
                          color: vCount > 0 ? '#1D7A52' : '#7B6F95',
                        }}
                        title="Số địa điểm đã có tọa độ xác minh trên bản đồ"
                      >
                        {vCount} ghim
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-extrabold text-[#2D2246] leading-tight">
                      {cat.shortLabel}
                    </p>
                    <p className="text-[10px] text-[#65587F] line-clamp-1 mt-0.5">
                      {vCount > 0
                        ? `${vCount} trên bản đồ${uCount > 0 ? ` · ${uCount} chờ xác minh` : ''}`
                        : uCount > 0
                        ? `${uCount} quán chờ xác minh tọa độ`
                        : 'Chưa có dữ liệu xác minh'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Thông báo trung thực khi nhóm đang chọn chưa có ghim tọa độ xác minh trên bản đồ */}
          {!selectedCategories.includes('all') &&
            !selectedCategories.includes('game_asset') &&
            filteredVerifiedList.length === 0 && (
              <div className="p-3.5 rounded-2xl bg-[#FEF3C7]/80 border border-[#F59E0B]/50 text-[#92400E]">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-extrabold">
                      Danh mục đang chọn chưa có ghim tọa độ xác minh trên bản đồ
                    </p>
                    <p className="text-[11px] mt-1 leading-relaxed">
                      Theo nguyên tắc dữ liệu địa lý thật của XUHO CITY, hệ thống không tự tạo tọa độ giả cho các địa điểm chưa xác minh.
                      {filteredUnverifiedList.length > 0
                        ? ` Hiện có ${filteredUnverifiedList.length} quán thuộc nhóm này trong danh mục bên dưới — bạn vẫn có thể bấm xem thực đơn hoặc xác minh tọa độ trong Admin.`
                        : ' Dữ liệu nhóm này sẽ được hiển thị ngay khi quản trị viên cập nhật tọa độ thực địa.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Danh sách địa điểm đã xác minh trong bộ lọc hiện tại */}
          {filteredVerifiedList.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-[#1D7A52] flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>Địa điểm đã xác minh trên bản đồ ({filteredVerifiedList.length})</span>
                </span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {filteredVerifiedList.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      onSelectVerifiedPlace(loc);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-[#FFFDF9] hover:bg-[#E6F7EF]/60 border border-[#E5DEC9] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#2D2246] truncate">{loc.name}</p>
                      <p className="text-[10px] text-[#65587F] truncate">{loc.address}</p>
                    </div>
                    <span className="text-[10px] font-extrabold text-[#39B980] shrink-0">
                      Tới ghim →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Danh sách quán trong danh mục chờ xác minh tọa độ (Phần 7) */}
          {filteredUnverifiedList.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-[#92400E] flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>Quán trong danh mục chờ xác minh tọa độ ({filteredUnverifiedList.length})</span>
                </span>
                {isAdminUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAdminCoordTool();
                      onClose();
                    }}
                    className="text-[10.5px] font-extrabold text-[#1D7A52] underline cursor-pointer"
                  >
                    Mở trình gắn tọa độ
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {filteredUnverifiedList.map((loc) => (
                  <div
                    key={loc.id}
                    className="px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#E5DEC9] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#2D2246] truncate">{loc.name}</p>
                      <p className="text-[10px] text-[#65587F] truncate">
                        {loc.address} {loc.metadata.priceRange ? `· ${loc.metadata.priceRange}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdminUser && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenAdminCoordTool(loc);
                            onClose();
                          }}
                          className="px-2 py-1 rounded-lg bg-[#39B980] text-white text-[10px] font-bold hover:bg-[#2FA36E] cursor-pointer"
                        >
                          Xác minh
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectUnverifiedPlace(loc);
                          onClose();
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
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#FFFDF9] border-t border-[#E5DEC9] flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[#65587F]">
            Đang hiển thị:{' '}
            <strong className="text-[#2D2246]">{filteredVerifiedList.length}</strong> địa điểm đã xác minh
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#403064] text-white text-xs font-bold hover:bg-[#533F80] cursor-pointer"
          >
            Xem bản đồ
          </button>
        </div>
      </aside>
    </div>
  );
};
