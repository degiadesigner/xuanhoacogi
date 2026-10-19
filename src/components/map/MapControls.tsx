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
      className="fixed right-2.5 sm:right-3.5 bottom-20 md:bottom-6 z-30 flex flex-col items-end gap-2 pointer-events-auto"
      style={{
        fontFamily:
          "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Popover chọn nhanh Khu vực & Bật/Tắt các lớp bản đồ */}
      {isLayerMenuOpen && (
        <div className="mb-1 w-68 rounded-2xl bg-[#FFFDF9] border-2 border-[#403064] shadow-[0_12px_30px_rgba(64,48,100,0.22)] p-3 text-xs text-[#2D2246] space-y-2.5">
          <div className="font-extrabold text-[#403064] pb-2 border-b border-[#E5DEC9] flex items-center justify-between leading-snug">
            <span>Lớp bản đồ & Khu vực</span>
            <button
              type="button"
              onClick={() => setIsLayerMenuOpen(false)}
              className="text-[11px] text-[#65587F] hover:text-[#2D2246] cursor-pointer"
            >
              Đóng
            </button>
          </div>

          {/* Chọn nhanh 11 Khu vực Xuân Hòa */}
          <div>
            <label className="block text-[10.5px] font-extrabold text-[#65587F] mb-1">
              📍 Bay nhanh tới Khu vực ({activeIdx + 1}/{MAP_AREA_PRESETS.length}):
            </label>
            <select
              value={activePreset.id}
              onChange={(e) => {
                const found = MAP_AREA_PRESETS.find((p) => p.id === e.target.value);
                if (found) {
                  onSelectPreset(found);
                  setIsLayerMenuOpen(false);
                }
              }}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#F8F5EE] border border-[#403064] font-extrabold text-xs text-[#2D2246] cursor-pointer"
            >
              {MAP_AREA_PRESETS.map((p, idx) => (
                <option key={p.id} value={p.id}>
                  #{idx + 1} • {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-[#E5DEC9]">
            {(
              [
                { key: 'realPois', label: '📍 Hiện Icon Địa điểm & Quán' },
                { key: 'buildings', label: '🏢 Công trình & Khối nhà 3D' },
                { key: 'baseGeography', label: '🛣️ Đường phố & Ngõ (OSM)' },
                { key: 'waterAndParks', label: '🌳 Núi Thằn Lằn & Hồ Đại Lải' },
                { key: 'wardBoundary', label: '🗺️ Ranh giới Phường Xuân Hòa' },
                { key: 'userLocation', label: '🟢 Chấm xanh Vị trí của tôi' },
                { key: 'gameAssets', label: '🏰 Lớp Tài sản Game (Demo)' },
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

          <div className="pt-1.5 border-t border-[#E5DEC9]">
            <button
              type="button"
              onClick={() => {
                setIsLayerMenuOpen(false);
                onOpenDataQualityModal();
              }}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#E6F7EF] text-[#1D7A52] font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck size={13} />
              <span>Thông tin dữ liệu bản đồ OSM</span>
            </button>
          </div>
        </div>
      )}

      {/* Cột nút tròn gọn chuẩn Google Maps ở góc phải dưới (GPS, 3D/2D, Lớp bản đồ, Về trung tâm) */}
      <div className="flex flex-col rounded-2xl bg-[#FFFDF9]/95 backdrop-blur-sm border-2 border-[#403064] shadow-[0_6px_20px_rgba(64,48,100,0.16)] overflow-hidden">
        <button
          type="button"
          onClick={onLocateUser}
          aria-label="Định vị vị trí hiện tại của tôi"
          title="Định vị vị trí hiện tại của bạn (GPS)"
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#1D7A52] hover:bg-[#E6F7EF] transition-colors border-b border-[#E5DEC9] cursor-pointer"
        >
          {isLocatingUser ? (
            <Loader2 size={16} className="animate-spin text-[#39B980]" />
          ) : (
            <LocateFixed size={16} className="text-[#39B980]" />
          )}
        </button>

        {onToggle3DMode && (
          <button
            type="button"
            onClick={onToggle3DMode}
            aria-label="Chuyển đổi góc nhìn 3D / 2D"
            title="Chuyển đổi góc nhìn 3D / 2D"
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center font-extrabold text-[11px] transition-colors border-b border-[#E5DEC9] cursor-pointer"
            style={{
              backgroundColor: is3DMode ? '#39B980' : 'transparent',
              color: is3DMode ? '#FFFFFF' : '#403064',
            }}
          >
            {is3DMode ? '3D' : '2D'}
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsLayerMenuOpen((v) => !v)}
          aria-label="Tùy chỉnh lớp bản đồ & khu vực"
          title="Chọn Khu vực & Bật/Tắt các lớp bản đồ"
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-colors border-b border-[#E5DEC9] cursor-pointer"
          style={{
            backgroundColor: isLayerMenuOpen ? '#E6F7EF' : 'transparent',
            color: '#403064',
          }}
        >
          <Layers size={16} />
        </button>

        <button
          type="button"
          onClick={onResetCenter}
          aria-label="Trở về vị trí trung tâm Xuân Hòa"
          title="Trở về trung tâm Xuân Hòa"
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#403064] hover:bg-[#E6F7EF] transition-colors cursor-pointer"
        >
          <Home size={16} />
        </button>
      </div>
    </div>
  );
};
