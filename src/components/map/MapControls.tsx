import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Minus,
  LocateFixed,
  Home,
  Layers,
  Castle,
  ShieldCheck,
  Loader2,
  ChevronDown,
  Box,
  MapPin,
  Check,
} from 'lucide-react';
import type { MapAreaPreset, MapLayerVisibility } from '@/lib/map/map-types';
import { MAP_AREA_PRESETS } from '@/lib/map/map-config';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCenter: () => void;
  onLocateUser: () => void;
  isLocatingUser: boolean;
  layerVisibility: MapLayerVisibility;
  onToggleLayer: (key: keyof MapLayerVisibility) => void;
  onSelectPreset: (preset: MapAreaPreset) => void;
  activePresetId: string;
  onOpenDataQualityModal: () => void;
  is3DMode?: boolean;
  onToggle3DMode?: () => void;
  onOpenCity3D?: () => void;
  onClickHomeButton?: () => void;
  hasSavedHome?: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetCenter,
  onLocateUser,
  isLocatingUser,
  layerVisibility,
  onToggleLayer,
  onSelectPreset,
  activePresetId,
  onOpenDataQualityModal,
  is3DMode = true,
  onToggle3DMode,
  onOpenCity3D,
  onClickHomeButton,
  hasSavedHome = false,
}) => {
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [isPresetRollOpen, setIsPresetRollOpen] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
  const rollListRef = useRef<HTMLDivElement | null>(null);

  const activeIdx = Math.max(
    0,
    MAP_AREA_PRESETS.findIndex((p) => p.id === activePresetId)
  );
  const activePreset = MAP_AREA_PRESETS[activeIdx] || MAP_AREA_PRESETS[0];

  // Đóng menu roll kéo xuống khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsPresetRollOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tự động cuộn tới khu vực đang chọn khi mở thanh roll dọc
  useEffect(() => {
    if (isPresetRollOpen && rollListRef.current) {
      const activeEl = rollListRef.current.children[activeIdx] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [isPresetRollOpen, activeIdx]);

  return (
    <div
      ref={dropdownContainerRef}
      className="fixed right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-2 pointer-events-auto"
      style={{
        fontFamily:
          "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Popover Tùy chỉnh Bản đồ 2D — Chuẩn, Đủ, Không Thừa */}
      {isLayerMenuOpen && (
        <div className="mb-1 w-60 rounded-2xl bg-[#FFFDF9] border border-[#403064]/80 shadow-[0_12px_30px_rgba(64,48,100,0.22)] p-3 text-xs text-[#2D2246] space-y-2.5">
          <div className="font-extrabold text-[#403064] pb-1.5 border-b border-[#E5DEC9] flex items-center justify-between leading-snug">
            <span>Tùy chỉnh bản đồ</span>
            <button
              type="button"
              onClick={() => setIsLayerMenuOpen(false)}
              className="text-[11px] font-bold text-[#65587F] hover:text-[#2D2246] cursor-pointer"
            >
              Đóng
            </button>
          </div>

          <div className="space-y-1.5">
            {(
              [
                { key: 'realPois', label: 'Hiện ghim định vị' },
                { key: 'buildings', label: 'Hiện khối nhà & công trình' },
                { key: 'baseGeography', label: 'Hiện đường phố & ngõ nhỏ' },
                { key: 'waterAndParks', label: 'Hiện mặt hồ & công viên' },
                { key: 'wardBoundary', label: 'Hiện ranh giới Phường' },
              ] as Array<{ key: keyof MapLayerVisibility; label: string }>
            ).map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-2 cursor-pointer select-none py-0.5"
              >
                <span className="font-semibold text-[11.5px] leading-snug">
                  {item.label}
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility[item.key]}
                  onChange={() => onToggleLayer(item.key)}
                  className="w-4 h-4 accent-[#39B980] rounded cursor-pointer"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[#E5DEC9]">
            <button
              type="button"
              onClick={onZoomIn}
              className="py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#E6F7EF] border border-[#403064]/30 font-extrabold text-[11px] text-[#2D2246] cursor-pointer"
            >
              Phóng +
            </button>
            <button
              type="button"
              onClick={onZoomOut}
              className="py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#E6F7EF] border border-[#403064]/30 font-extrabold text-[11px] text-[#2D2246] cursor-pointer"
            >
              Thu −
            </button>
            <button
              type="button"
              onClick={() => {
                onResetCenter();
                setIsLayerMenuOpen(false);
              }}
              className="py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#E6F7EF] border border-[#403064]/30 font-extrabold text-[11px] text-[#2D2246] cursor-pointer"
            >
              Trung tâm
            </button>
          </div>
        </div>
      )}

      {/* Cột điều khiển gọn gàng bên phải (3D/2D ở đầu, GPS, Tùy chỉnh bản đồ, Ngôi nhà = Chỗ bạn sống) */}
      <div className="flex flex-col rounded-2xl bg-[#FFFDF9]/95 backdrop-blur-sm border border-[#403064]/85 shadow-[0_6px_20px_rgba(64,48,100,0.16)] overflow-hidden">
        {onOpenCity3D ? (
          <button
            type="button"
            onClick={onOpenCity3D}
            aria-label="Mở Sa bàn 3D Phường Xuân Hòa"
            title="Chuyển sang Bản đồ 3D"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center font-black text-[11px] transition-all border-b border-[#E5DEC9] cursor-pointer bg-[#059669] hover:bg-[#047857] text-white"
          >
            3D
          </button>
        ) : onToggle3DMode ? (
          <button
            type="button"
            onClick={onToggle3DMode}
            aria-label="Chuyển đổi góc nhìn 3D / 2D"
            title="Chuyển đổi góc nhìn 3D / 2D"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center font-extrabold text-[11px] transition-colors border-b border-[#E5DEC9] cursor-pointer"
            style={{
              backgroundColor: is3DMode ? '#39B980' : 'transparent',
              color: is3DMode ? '#FFFFFF' : '#403064',
            }}
          >
            {is3DMode ? '3D' : '2D'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onLocateUser}
          aria-label="Định vị vị trí hiện tại của tôi"
          title="Định vị vị trí hiện tại của bạn (GPS)"
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#1D7A52] hover:bg-[#E6F7EF] transition-colors border-b border-[#E5DEC9] cursor-pointer"
        >
          {isLocatingUser ? (
            <Loader2 size={15} className="animate-spin text-[#39B980]" />
          ) : (
            <LocateFixed size={15} className="text-[#39B980]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsLayerMenuOpen((v) => !v)}
          aria-label="Tùy chỉnh lớp bản đồ"
          title="Tùy chỉnh hiển thị bản đồ"
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-colors border-b border-[#E5DEC9] cursor-pointer"
          style={{
            backgroundColor: isLayerMenuOpen ? '#E6F7EF' : 'transparent',
            color: '#403064',
          }}
        >
          <Layers size={15} />
        </button>

        <button
          type="button"
          onClick={onClickHomeButton || onResetCenter}
          aria-label="Chỗ bạn sinh sống (Nhà của bạn)"
          title={
            hasSavedHome
              ? 'Nhà của bạn — Bấm để về đúng địa chỉ chỗ bạn sống'
              : 'Định vị chỗ bạn sinh sống (Nhà của bạn)'
          }
          className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-colors cursor-pointer ${
            hasSavedHome
              ? 'bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A]'
              : 'text-[#403064] hover:bg-[#E6F7EF]'
          }`}
        >
          <Home size={15} />
        </button>
      </div>
    </div>
  );
};
