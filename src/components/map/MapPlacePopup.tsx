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
  Route,
  Store,
} from 'lucide-react';
import type { PlaceLocation } from '@/lib/map/map-types';
import { MAP_CATEGORY_BY_ID } from '@/lib/map/map-categories';
import {
  calculateDistanceAndEta,
  evaluatePlaceOpenStatus,
} from '@/lib/map/map-data';
import { XUANHOA_DEFAULT_CENTER } from '@/lib/map/map-config';
import { renderCategoryIcon } from './MapCategoryPanel';

interface MapPlacePopupProps {
  place: PlaceLocation | null;
  onClose: () => void;
  onOpenFullPlaceModal: (place: PlaceLocation) => void;
  isAdminUser: boolean;
  onEditCoordinates?: (place: PlaceLocation) => void;
  userCoords?: { lat: number; lng: number } | null;
  activeRouteDistanceMeters?: number | null;
  onDrawRouteToPlace?: (place: PlaceLocation) => void;
  onClearRoute?: () => void;
  isRouteActiveForThisPlace?: boolean;
  onOpenMerchantPortal?: (place: PlaceLocation) => void;
}

export const MapPlacePopup: React.FC<MapPlacePopupProps> = ({
  place,
  onClose,
  onOpenFullPlaceModal,
  isAdminUser,
  onEditCoordinates,
  userCoords,
  activeRouteDistanceMeters,
  onDrawRouteToPlace,
  onClearRoute,
  isRouteActiveForThisPlace,
  onOpenMerchantPortal,
}) => {
  if (!place) return null;

  const cat = MAP_CATEGORY_BY_ID[place.category];

  // Tính khoảng cách và thời gian di chuyển từ vị trí GPS của khách (hoặc từ tâm Xuân Hòa nếu chưa bật GPS)
  const originLat = userCoords ? userCoords.lat : XUANHOA_DEFAULT_CENTER.lat;
  const originLng = userCoords ? userCoords.lng : XUANHOA_DEFAULT_CENTER.lng;
  const etaInfo =
    place.lat !== null && place.lng !== null
      ? calculateDistanceAndEta(
          originLat,
          originLng,
          place.lat,
          place.lng,
          isRouteActiveForThisPlace ? activeRouteDistanceMeters : null
        )
      : null;

  // Đánh giá giờ mở cửa thực tế + Trạng thái hôm nay của chủ quán
  const openStatus = evaluatePlaceOpenStatus(
    place.openHours,
    place.metadata.liveStatus,
    place.metadata.liveStatusNote
  );

  const handleOpenGoogleMaps = () => {
    if (place.lat !== null && place.lng !== null) {
      const originParam = userCoords
        ? `&origin=${userCoords.lat},${userCoords.lng}`
        : '';
      const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${place.lat},${place.lng}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`Thông tin địa điểm ${place.name}`}
      className="w-full max-w-md rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-[0_14px_38px_rgba(64,48,100,0.24)] p-3.5 sm:p-4 text-[#2D2246] animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Top Row: Category Badge + Verified Status + Close */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[11px] font-extrabold border border-[#403064] text-white"
            style={{ backgroundColor: cat?.markerBg || '#39B980' }}
          >
            {cat && renderCategoryIcon(cat.iconName, 12)}
            <span>{cat?.shortLabel || 'Địa điểm'}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#E6F7EF] text-[#1D7A52] border border-[#39B980]/40">
            <CheckCircle2 size={11} />
            <span>
              {place.coordinateSource === 'merchant_verified' ||
              place.metadata.claimedByEmail
                ? 'Chính chủ đã xác thực'
                : place.coordinateSource === 'openstreetmap'
                ? 'OSM Verified'
                : 'Đã xác minh tọa độ'}
            </span>
          </span>

          {/* Trạng thái Đang mở cửa / Đã đóng cửa giống Google Maps */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border"
            style={{
              backgroundColor:
                openStatus.tone === 'emerald'
                  ? '#E6F7EF'
                  : openStatus.tone === 'amber'
                  ? '#FEF3C7'
                  : '#FEE2E2',
              borderColor:
                openStatus.tone === 'emerald'
                  ? '#39B980'
                  : openStatus.tone === 'amber'
                  ? '#F59E0B'
                  : '#EF4444',
              color:
                openStatus.tone === 'emerald'
                  ? '#1D7A52'
                  : openStatus.tone === 'amber'
                  ? '#92400E'
                  : '#991B1B',
            }}
          >
            <span>{openStatus.badgeText}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông tin địa điểm"
          className="p-1.5 rounded-xl bg-[#F1ECE1] text-[#403064] hover:bg-[#E5DEC9] transition-colors cursor-pointer shrink-0"
        >
          <X size={15} />
        </button>
      </div>

      {/* Tên & Địa chỉ */}
      <div className="mt-2">
        <h3 className="text-[15px] font-extrabold text-[#2D2246] leading-snug">
          {place.name}
        </h3>
        <p className="text-xs text-[#65587F] mt-0.5 flex items-start gap-1.5">
          <MapPin size={13} className="shrink-0 mt-0.5 text-[#39B980]" />
          <span>{place.address}</span>
        </p>
      </div>

      {/* THANH KHOẢNG CÁCH & THỜI GIAN DI CHUYỂN TỪ VỊ TRÍ ĐỊNH VỊ (GOOGLE MAPS STYLE) */}
      {etaInfo && (
        <div className="mt-2.5 p-2.5 rounded-2xl bg-[#E6F7EF]/85 border border-[#39B980] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-[#1D7A52]">
            <Route size={14} className="shrink-0" />
            <span>
              {userCoords ? 'Cách vị trí của bạn:' : 'Từ trung tâm ĐHSP2:'}{' '}
              <strong className="text-[#2D2246]">{etaInfo.distanceText}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#2D2246]">
            <span className="px-2 py-0.5 rounded-lg bg-[#FFFDF9] border border-[#39B980]/40">
              🛵 {etaInfo.bikeText}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-[#FFFDF9] border border-[#39B980]/40">
              🚶 {etaInfo.walkText}
            </span>
          </div>
        </div>
      )}

      {/* Lời nhắn trực tiếp từ chủ quán hoặc Giờ bán chi tiết */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#403064]">
        <span className="px-2 py-0.5 rounded-lg bg-[#F3EFE6] inline-flex items-center gap-1 font-semibold">
          <Clock size={11} /> {openStatus.detailText}
        </span>
        {place.metadata.priceRange && (
          <span className="px-2 py-0.5 rounded-lg bg-[#E6F7EF] text-[#1D7A52] font-bold">
            💰 {place.metadata.priceRange}
          </span>
        )}
        {place.metadata.subType && (
          <span className="px-2 py-0.5 rounded-lg bg-[#F3EFE6] font-semibold">
            {place.metadata.subType}
          </span>
        )}
      </div>

      {/* Món tủ nếu là quán trong danh mục */}
      {place.metadata.signatureDishName && (
        <div className="mt-2 px-3 py-1.5 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] flex items-center justify-between text-xs">
          <span className="text-[#65587F] font-medium truncate">
            Món nổi bật:{' '}
            <strong className="text-[#2D2246]">{place.metadata.signatureDishName}</strong>
          </span>
          {place.metadata.signatureDishPrice && (
            <span className="font-extrabold text-[#1D7A52] shrink-0 ml-2">
              {place.metadata.signatureDishPrice}.000đ
            </span>
          )}
        </div>
      )}

      {/* Nút hành động: Chỉ đường ngay trên bản đồ + Thực đơn + Google Maps + Gọi */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {onDrawRouteToPlace && place.lat !== null && place.lng !== null && (
          <button
            type="button"
            onClick={() => {
              if (isRouteActiveForThisPlace && onClearRoute) {
                onClearRoute();
              } else {
                onDrawRouteToPlace(place);
              }
            }}
            className="flex-1 min-w-[140px] py-2 px-3 rounded-2xl border-2 border-[#403064] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            style={{
              backgroundColor: isRouteActiveForThisPlace ? '#403064' : '#39B980',
              color: '#FFFFFF',
            }}
          >
            <Route size={14} />
            <span>
              {isRouteActiveForThisPlace ? 'Đang chỉ đường (Tắt)' : 'Chỉ đường tới đây'}
            </span>
          </button>
        )}

        {place.originalPlace && (
          <button
            type="button"
            onClick={() => onOpenFullPlaceModal(place)}
            className="flex-1 min-w-[125px] py-2 px-3 rounded-2xl bg-[#403064] hover:bg-[#523E7D] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <UtensilsCrossed size={13} />
            <span>Xem Thực đơn</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenGoogleMaps}
          className="py-2 px-2.5 rounded-2xl bg-[#F1ECE1] hover:bg-[#E5DEC9] text-[#403064] border border-[#403064]/30 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          title="Mở ứng dụng Google Maps dẫn đường giọng nói"
        >
          <Navigation size={13} />
          <span>Google Maps</span>
        </button>

        {place.phone && (
          <a
            href={`tel:${place.phone.replace(/[^0-9+]/g, '')}`}
            className="py-2 px-2.5 rounded-2xl bg-[#F1ECE1] hover:bg-[#E5DEC9] text-[#403064] border border-[#403064]/30 text-xs font-bold flex items-center gap-1"
          >
            <Phone size={13} />
            <span>Gọi</span>
          </a>
        )}

        {place.originalPlace && onOpenMerchantPortal && (
          <button
            type="button"
            onClick={() => onOpenMerchantPortal(place)}
            className="py-2 px-2.5 rounded-2xl bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#403064] border border-[#403064]/40 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
            title="Dành cho Chủ quán nhập mã code để cập nhật thông tin hoặc tọa độ"
          >
            <Store size={12} />
            <span>Chủ quán</span>
          </button>
        )}

        {isAdminUser && onEditCoordinates && (
          <button
            type="button"
            onClick={() => onEditCoordinates(place)}
            className="py-2 px-2.5 rounded-2xl bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            title="Chỉnh sửa tọa độ trong Admin"
          >
            <Edit3 size={12} />
            <span>Admin</span>
          </button>
        )}
      </div>
    </div>
  );
};
