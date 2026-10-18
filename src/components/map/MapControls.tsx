import React, { useState } from 'react';
import {
  Plus,
  Minus,
  LocateFixed,
  Home,
  Layers,
  Castle,
  ShieldCheck,
  Loader2,
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
}) => {
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  return (
    <>
      {/* Thanh nhảy nhanh các phân khu thực tế của Phường Xuân Hòa mới */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-full">
        {MAP_AREA_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className="px-3 py-1.5 rounded-full text-[11.5px] font-bold border-2 transition-all whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
              style={{
                backgroundColor: isActive ? '#403064' : '#FFFDF9',
                borderColor: '#403064',
                color: isActive ? '#FFFFFF' : '#2D2246',
              }}
              title={preset.sublabel}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Cụm nút điều khiển bản đồ bên phải */}
      <div className="fixed right-3.5 bottom-24 md:bottom-8 z-30 flex flex-col items-end gap-2">
        {/* Popover bật/tắt 5 lớp độc lập (Phần 4) */}
        {isLayerMenuOpen && (
          <div className="mb-1 w-64 rounded-2xl bg-[#FFFDF9] border-2 border-[#403064] shadow-[0_12px_30px_rgba(64,48,100,0.2)] p-3 text-xs text-[#2D2246]">
            <div className="font-extrabold text-[#403064] pb-2 mb-2 border-b border-[#E5DEC9] flex items-center justify-between">
              <span>Lớp hiển thị Bản đồ (Layers)</span>
              <button
                type="button"
                onClick={() => setIsLayerMenuOpen(false)}
                className="text-[11px] text-[#65587F] hover:text-[#2D2246] cursor-pointer"
              >
                Đóng
              </button>
            </div>
            <div className="space-y-2">
              {(
                [
                  { key: 'baseGeography', label: '1. Đường phố & Ngõ (OSM)' },
                  { key: 'buildings', label: '2. Công trình & Khối nhà (5.083)' },
                  { key: 'waterAndParks', label: '3. Hồ Đại Lải, Sông & Cây xanh' },
                  { key: 'wardBoundary', label: '4. Ranh giới Phường Xuân Hòa' },
                  { key: 'realPois', label: '5. Địa điểm thực tế (Verified POIs)' },
                  { key: 'gameAssets', label: '6. Lớp Tài sản Game (Demo)' },
                  { key: 'userLocation', label: '7. Vị trí của tôi (GPS)' },
                ] as Array<{ key: keyof MapLayerVisibility; label: string }>
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 cursor-pointer select-none py-0.5"
                >
                  <span className="font-semibold text-[11.5px]">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={layerVisibility[item.key]}
                    onChange={() => onToggleLayer(item.key)}
                    className="w-4 h-4 accent-[#39B980] rounded cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col rounded-2xl bg-[#FFFDF9] border-2 border-[#403064] shadow-[0_8px_24px_rgba(64,48,100,0.16)] overflow-hidden">
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Phóng to bản đồ"
            title="Phóng to (+)"
            className="w-10 h-10 flex items-center justify-center text-[#403064] hover:bg-[#E6F7EF] transition-colors border-b border-[#E5DEC9] cursor-pointer"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Thu nhỏ bản đồ"
            title="Thu nhỏ (-)"
            className="w-10 h-10 flex items-center justify-center text-[#403064] hover:bg-[#E6F7EF] transition-colors border-b border-[#E5DEC9] cursor-pointer"
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            onClick={onLocateUser}
            aria-label="Định vị vị trí hiện tại của tôi"
            title="Vị trí của tôi (GPS)"
            className="w-10 h-10 flex items-center justify-center text-[#403064] hover:bg-[#E6F7EF] transition-colors border-b border-[#E5DEC9] cursor-pointer"
          >
            {isLocatingUser ? (
              <Loader2 size={17} className="animate-spin text-[#39B980]" />
            ) : (
              <LocateFixed size={17} />
            )}
          </button>
          <button
            type="button"
            onClick={onResetCenter}
            aria-label="Trở về vị trí trung tâm Xuân Hòa"
            title="Trở về trung tâm Xuân Hòa"
            className="w-10 h-10 flex items-center justify-center text-[#403064] hover:bg-[#E6F7EF] transition-colors border-b border-[#E5DEC9] cursor-pointer"
          >
            <Home size={17} />
          </button>
          <button
            type="button"
            onClick={() => onToggleLayer('gameAssets')}
            aria-label="Bật hoặc tắt lớp tài sản game demo"
            title="Bật/Tắt Lớp Tài sản Game (Demo)"
            className="w-10 h-10 flex items-center justify-center transition-colors border-b border-[#E5DEC9] cursor-pointer"
            style={{
              backgroundColor: layerVisibility.gameAssets ? '#403064' : 'transparent',
              color: layerVisibility.gameAssets ? '#FFFFFF' : '#403064',
            }}
          >
            <Castle size={17} />
          </button>
          <button
            type="button"
            onClick={() => setIsLayerMenuOpen((v) => !v)}
            aria-label="Tùy chỉnh các lớp bản đồ"
            title="Bật/Tắt các lớp bản đồ"
            className="w-10 h-10 flex items-center justify-center transition-colors border-b border-[#E5DEC9] cursor-pointer"
            style={{
              backgroundColor: isLayerMenuOpen ? '#E6F7EF' : 'transparent',
              color: '#403064',
            }}
          >
            <Layers size={17} />
          </button>
          <button
            type="button"
            onClick={onOpenDataQualityModal}
            aria-label="Xem báo cáo nguồn dữ liệu địa lý"
            title="Nguồn & Chất lượng dữ liệu địa lý"
            className="w-10 h-10 flex items-center justify-center text-[#1D7A52] hover:bg-[#E6F7EF] transition-colors cursor-pointer"
          >
            <ShieldCheck size={17} />
          </button>
        </div>
      </div>
    </>
  );
};
