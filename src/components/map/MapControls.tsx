import React, { useEffect, useRef, useState } from 'react';
import {
  LocateFixed,
  Compass,
  Home,
  Layers,
  Loader2,
} from 'lucide-react';
import type { MapAreaPreset, MapLayerVisibility } from '@/lib/map/map-types';

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
  isCity3DOpen?: boolean;
  onToggle3DMode?: () => void;
  onSelectMapMode?: (mode: '2d' | '2.5d' | '3d') => void;
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
  is3DMode = false,
  isCity3DOpen = false,
  onToggle3DMode,
  onSelectMapMode,
  onOpenCity3D,
  onClickHomeButton,
  hasSavedHome = false,
}) => {
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsLayerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={dropdownContainerRef}
      data-testid="map-right-controls"
      className="absolute right-2.5 sm:right-3.5 top-28 sm:top-1/2 sm:-translate-y-1/2 z-30 flex flex-col items-end gap-2 pointer-events-auto"
    >
      {/* Popover Tùy chỉnh Lớp Bản đồ */}
      {isLayerMenuOpen && (
        <div className="mb-1 w-60 rounded-[14px] bg-white border border-[#E2E8F0] shadow-[0_12px_32px_rgba(15,23,42,0.12)] p-3 text-xs text-[#0F172A] space-y-2.5">
          <div className="font-semibold text-[#0F172A] pb-1.5 border-b border-[#F1F5F9] flex items-center justify-between leading-snug">
            <span>Lớp bản đồ</span>
            <button
              type="button"
              onClick={() => setIsLayerMenuOpen(false)}
              className="text-[11px] font-medium text-[#64748B] hover:text-[#0F172A] cursor-pointer"
            >
              Đóng
            </button>
          </div>

          <div className="space-y-1.5">
            {(
              [
                { key: 'realPois', label: 'Hiện địa danh & POI' },
                { key: 'buildings', label: 'Hiện khối nhà & công trình' },
                { key: 'baseGeography', label: 'Hiện đường phố & ngõ nhỏ' },
                { key: 'waterAndParks', label: 'Hiện mặt hồ & công viên' },
                { key: 'wardBoundary', label: 'Hiện ranh giới Phường' },
                { key: 'decorativeZones', label: 'Lớp quy hoạch phân khu' },
              ] as Array<{ key: keyof MapLayerVisibility; label: string }>
            ).map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-2 cursor-pointer select-none py-0.5"
              >
                <span className="font-medium text-[11.5px] text-[#334155] leading-snug">
                  {item.label}
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(layerVisibility[item.key])}
                  onChange={() => onToggleLayer(item.key)}
                  className="w-3.5 h-3.5 accent-[#059669] rounded cursor-pointer"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={onZoomIn}
              className="py-1.5 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] font-medium text-[11px] text-[#0F172A] cursor-pointer"
            >
              Phóng +
            </button>
            <button
              type="button"
              onClick={onZoomOut}
              className="py-1.5 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] font-medium text-[11px] text-[#0F172A] cursor-pointer"
            >
              Thu −
            </button>
            <button
              type="button"
              onClick={() => {
                onResetCenter();
                setIsLayerMenuOpen(false);
              }}
              className="py-1.5 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] font-medium text-[11px] text-[#0F172A] cursor-pointer"
            >
              Trung tâm
            </button>
          </div>
        </div>
      )}

      {/* Cụm chọn chế độ cố định 3 nút: [ 2D ] [ 2.5D ] [ 3D ] — luôn hiện đủ 3 lựa chọn */}
      <div
        data-testid="map-mode-switcher"
        role="group"
        aria-label="Chế độ hiển thị bản đồ 2D, 2.5D, 3D"
        className="flex flex-col rounded-[14px] bg-white/95 backdrop-blur-md border border-[#E2E8F0] shadow-[0_4px_16px_rgba(15,23,42,0.08)] overflow-hidden"
      >
        <button
          type="button"
          data-testid="map-mode-2d"
          aria-pressed={!isCity3DOpen && !is3DMode}
          onClick={() => {
            if (onSelectMapMode) {
              onSelectMapMode('2d');
            } else if (is3DMode && onToggle3DMode) {
              onToggle3DMode();
            }
          }}
          title="Chế độ 2D phẳng (pitch = 0°)"
          className={`w-9 h-8 sm:w-10 sm:h-8 flex items-center justify-center font-bold text-[10.5px] transition-colors border-b border-[#F1F5F9] cursor-pointer ${
            !isCity3DOpen && !is3DMode
              ? 'bg-[#059669] text-white shadow-inner'
              : 'text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
          }`}
        >
          2D
        </button>

        <button
          type="button"
          data-testid="map-mode-25d"
          aria-pressed={!isCity3DOpen && Boolean(is3DMode)}
          onClick={() => {
            if (onSelectMapMode) {
              onSelectMapMode('2.5d');
            } else if (!is3DMode && onToggle3DMode) {
              onToggle3DMode();
            }
          }}
          title="Chế độ 2.5D nghiêng phối cảnh"
          className={`w-9 h-8 sm:w-10 sm:h-8 flex items-center justify-center font-bold text-[10.5px] transition-colors border-b border-[#F1F5F9] cursor-pointer ${
            !isCity3DOpen && is3DMode
              ? 'bg-[#059669] text-white shadow-inner'
              : 'text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
          }`}
        >
          2.5D
        </button>

        <button
          type="button"
          data-testid="map-mode-3d"
          aria-pressed={Boolean(isCity3DOpen)}
          onClick={() => {
            if (onSelectMapMode) {
              onSelectMapMode('3d');
            } else if (onOpenCity3D) {
              onOpenCity3D();
            }
          }}
          title="Chế độ Sa bàn 3D đầy đủ công trình & Landmark"
          className={`w-9 h-8 sm:w-10 sm:h-8 flex items-center justify-center font-bold text-[10.5px] transition-colors cursor-pointer ${
            isCity3DOpen
              ? 'bg-[#059669] text-white shadow-inner'
              : 'text-[#0F172A] hover:bg-[#0F172A] hover:text-white'
          }`}
        >
          3D
        </button>
      </div>

      {/* Floating Right Control Pill */}
      <div className="flex flex-col rounded-[14px] bg-white/95 backdrop-blur-md border border-[#E2E8F0] shadow-[0_4px_16px_rgba(15,23,42,0.08)] overflow-hidden">

        <button
          type="button"
          onClick={onLocateUser}
          aria-label="Định vị vị trí hiện tại của tôi"
          title="Vị trí hiện tại (GPS)"
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#0F172A] hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] cursor-pointer"
        >
          {isLocatingUser ? (
            <Loader2 size={15} strokeWidth={1.7} className="animate-spin text-[#059669]" />
          ) : (
            <LocateFixed size={15} strokeWidth={1.7} className="text-[#059669]" />
          )}
        </button>

        <button
          type="button"
          onClick={onResetCenter}
          aria-label="Về trung tâm Xuân Hòa"
          title="Về trung tâm Xuân Hòa"
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] cursor-pointer"
        >
          <Compass size={15} strokeWidth={1.7} />
        </button>

        <button
          type="button"
          onClick={() => setIsLayerMenuOpen((v) => !v)}
          aria-label="Tùy chỉnh lớp bản đồ"
          title="Lớp bản đồ"
          className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-colors border-b border-[#F1F5F9] cursor-pointer ${
            isLayerMenuOpen
              ? 'bg-[#ECFDF5] text-[#059669]'
              : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
          }`}
        >
          <Layers size={15} strokeWidth={1.7} />
        </button>

        <button
          type="button"
          onClick={onClickHomeButton || onResetCenter}
          aria-label="Nhà của bạn"
          title={hasSavedHome ? 'Nhà của bạn' : 'Đặt vị trí nhà của bạn'}
          className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-colors cursor-pointer ${
            hasSavedHome
              ? 'bg-[#ECFDF5] text-[#059669]'
              : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
          }`}
        >
          <Home size={15} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
};
