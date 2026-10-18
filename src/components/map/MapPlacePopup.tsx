import React from 'react';
import {
  X,
  MapPin,
  Phone,
  Clock,
  Navigation,
  UtensilsCrossed,
  CheckCircle2,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import type { PlaceLocation } from '@/lib/map/map-types';
import { MAP_CATEGORY_BY_ID } from '@/lib/map/map-categories';
import { renderCategoryIcon } from './MapCategoryPanel';

interface MapPlacePopupProps {
  place: PlaceLocation | null;
  onClose: () => void;
  onOpenFullPlaceModal: (place: PlaceLocation) => void;
  isAdminUser: boolean;
  onEditCoordinates?: (place: PlaceLocation) => void;
}

export const MapPlacePopup: React.FC<MapPlacePopupProps> = ({
  place,
  onClose,
  onOpenFullPlaceModal,
  isAdminUser,
  onEditCoordinates,
}) => {
  if (!place) return null;

  const cat = MAP_CATEGORY_BY_ID[place.category];

  const handleOpenDirections = () => {
    if (place.lat !== null && place.lng !== null) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`Thông tin địa điểm ${place.name}`}
      className="w-full max-w-md rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-[0_14px_38px_rgba(64,48,100,0.22)] p-4 text-[#2D2246] animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Top Row: Category Badge + Verified Status + Close */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-extrabold border border-[#403064] text-white"
            style={{ backgroundColor: cat?.markerBg || '#39B980' }}
          >
            {cat && renderCategoryIcon(cat.iconName, 12)}
            <span>{cat?.shortLabel || 'Địa điểm'}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#E6F7EF] text-[#1D7A52] border border-[#39B980]/40">
            <CheckCircle2 size={11} />
            <span>
              {place.coordinateSource === 'openstreetmap'
                ? 'OSM Verified'
                : 'Đã xác minh tọa độ'}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông tin địa điểm"
          className="p-1.5 rounded-xl bg-[#F1ECE1] text-[#403064] hover:bg-[#E5DEC9] transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Tên & Địa chỉ */}
      <div className="mt-2.5">
        <h3 className="text-[15px] font-extrabold text-[#2D2246] leading-snug">
          {place.name}
        </h3>
        <p className="text-xs text-[#65587F] mt-1 flex items-start gap-1.5">
          <MapPin size={13} className="shrink-0 mt-0.5 text-[#39B980]" />
          <span>{place.address}</span>
        </p>
      </div>

      {/* Metadata chips */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#403064]">
        {place.metadata.subType && (
          <span className="px-2 py-0.5 rounded-lg bg-[#F3EFE6] font-semibold">
            {place.metadata.subType}
          </span>
        )}
        {place.metadata.priceRange && (
          <span className="px-2 py-0.5 rounded-lg bg-[#E6F7EF] text-[#1D7A52] font-bold">
            💰 {place.metadata.priceRange}
          </span>
        )}
        {place.openHours && (
          <span className="px-2 py-0.5 rounded-lg bg-[#F3EFE6] inline-flex items-center gap-1 font-semibold">
            <Clock size={11} /> {place.openHours}
          </span>
        )}
        {place.lat !== null && place.lng !== null && (
          <span className="px-2 py-0.5 rounded-lg bg-[#F3EFE6] font-mono text-[10px] text-[#65587F]">
            {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
          </span>
        )}
        {place.metadata.osmId && (
          <span className="px-2 py-0.5 rounded-lg bg-[#F3EFE6] font-mono text-[10px] text-[#65587F]">
            OSM: {place.metadata.osmId}
          </span>
        )}
      </div>

      {/* Món tủ nếu là quán trong danh mục */}
      {place.metadata.signatureDishName && (
        <div className="mt-2.5 px-3 py-2 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] flex items-center justify-between text-xs">
          <span className="text-[#65587F] font-medium">
            Món nổi bật: <strong className="text-[#2D2246]">{place.metadata.signatureDishName}</strong>
          </span>
          {place.metadata.signatureDishPrice && (
            <span className="font-extrabold text-[#1D7A52]">
              {place.metadata.signatureDishPrice}k
            </span>
          )}
        </div>
      )}

      {/* Nút hành động */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {place.originalPlace && (
          <button
            type="button"
            onClick={() => onOpenFullPlaceModal(place)}
            className="flex-1 min-w-[140px] py-2 px-3 rounded-2xl bg-[#39B980] hover:bg-[#2FA36E] text-white border-2 border-[#403064] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <UtensilsCrossed size={14} />
            <span>Thực đơn & Đánh giá</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenDirections}
          className="flex-1 min-w-[120px] py-2 px-3 rounded-2xl bg-[#403064] hover:bg-[#523E7D] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Navigation size={13} />
          <span>Chỉ đường</span>
        </button>

        {place.phone && (
          <a
            href={`tel:${place.phone.replace(/[^0-9+]/g, '')}`}
            className="py-2 px-3 rounded-2xl bg-[#F1ECE1] hover:bg-[#E5DEC9] text-[#403064] border border-[#403064]/30 text-xs font-bold flex items-center gap-1"
          >
            <Phone size={13} />
            <span>Gọi</span>
          </a>
        )}

        {place.metadata.website && (
          <a
            href={place.metadata.website}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 rounded-2xl bg-[#F1ECE1] hover:bg-[#E5DEC9] text-[#403064] text-xs font-bold flex items-center gap-1"
          >
            <span>Website</span>
            <ExternalLink size={12} />
          </a>
        )}

        {isAdminUser && onEditCoordinates && (
          <button
            type="button"
            onClick={() => onEditCoordinates(place)}
            className="py-2 px-2.5 rounded-2xl bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            title="Chỉnh sửa tọa độ trong Admin"
          >
            <Edit3 size={12} />
            <span>Tọa độ</span>
          </button>
        )}
      </div>
    </div>
  );
};
