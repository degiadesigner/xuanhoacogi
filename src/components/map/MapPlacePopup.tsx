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
  type TravelMode,
} from '@/lib/map/map-data';
import { XUANHOA_DEFAULT_CENTER } from '@/lib/map/map-config';

interface MapPlacePopupProps {
  place: PlaceLocation | null;
  onClose: () => void;
  onOpenFullPlaceModal: (place: PlaceLocation) => void;
  isAdminUser: boolean;
  onEditCoordinates?: (place: PlaceLocation) => void;
  userCoords?: { lat: number; lng: number } | null;
  activeRouteDistanceMeters?: number | null;
  onDrawRouteToPlace?: (place: PlaceLocation, mode?: TravelMode) => void;
  onClearRoute?: () => void;
  isRouteActiveForThisPlace?: boolean;
  onOpenMerchantPortal?: (place: PlaceLocation) => void;
  isSaved?: boolean;
  onToggleSave?: (place: PlaceLocation) => void;
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
  isSaved = false,
  onToggleSave,
}) => {
  const [selectedMode, setSelectedMode] = React.useState<TravelMode>('motorbike');

  if (!place) return null;

  const cat = MAP_CATEGORY_BY_ID[place.category];
  const contactPhone = place.phone || '0211 3863 203';

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
            className="inline-flex items-center px-2.5 py-0.5 rounded-xl text-[10.5px] font-extrabold border border-[#403064] text-white"
            style={{ backgroundColor: cat?.markerBg || '#39B980' }}
          >
            <span>{cat?.shortLabel || 'Địa điểm'}</span>
          </span>

          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#E6F7EF] text-[#1D7A52] border border-[#39B980]/40">
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
            className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold border"
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

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(place)}
              title={isSaved ? 'Bỏ lưu địa điểm này' : 'Lưu địa điểm vào tài khoản của bạn'}
              className={`px-2.5 py-0.5 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer flex items-center gap-1 ${
                isSaved
                  ? 'bg-[#FEF3C7] text-[#B45309] border-[#F59E0B] shadow-xs'
                  : 'bg-[#FFFDF9] text-[#403064] border-[#403064]/30 hover:bg-[#FEF3C7]/60'
              }`}
            >
              <span>{isSaved ? '★ Đã lưu' : '☆ Lưu'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông tin địa điểm"
            className="px-2 py-0.5 rounded-xl bg-[#F1ECE1] text-[#403064] hover:bg-[#E5DEC9] text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            ×
          </button>
        </div>
      </div>

      {/* Tên & Địa chỉ */}
      <div className="mt-1.5">
        <h3 className="text-[14px] sm:text-[15px] font-extrabold text-[#2D2246] leading-snug">
          {place.name}
        </h3>
        <p className="text-[11.5px] text-[#65587F] mt-0.5">
          <span>{place.address}</span>
        </p>
      </div>

      {/* THANH KHOẢNG CÁCH & 4 PHƯƠNG TIỆN DI CHUYỂN CHUẨN GOOGLE MAPS */}
      {etaInfo && (
        <div className="mt-2 p-2.5 rounded-2xl bg-[#E6F7EF]/85 border border-[#39B980] space-y-1.5 text-[11.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-[#1D7A52]">
              Quãng đường dự kiến:{' '}
              <strong className="text-[#2D2246]">{etaInfo.distanceText}</strong>
            </span>
            <span className="text-[10.5px] font-bold text-[#65587F]">
              Chọn phương tiện để đi
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-[10.5px] font-bold">
            {(
              [
                { id: 'car', label: 'Ô tô', time: etaInfo.carText },
                { id: 'motorbike', label: 'Xe máy', time: etaInfo.bikeText },
                { id: 'bicycle', label: 'Xe đạp', time: etaInfo.bicycleText },
                { id: 'walk', label: 'Đi bộ', time: etaInfo.walkText },
              ] as Array<{ id: TravelMode; label: string; time: string }>
            ).map((m) => {
              const active = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMode(m.id);
                    if (onDrawRouteToPlace && place.lat !== null && place.lng !== null) {
                      onDrawRouteToPlace(place, m.id);
                    }
                  }}
                  className={`py-1 px-1.5 rounded-xl border text-center transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#2D2246] text-white border-[#2D2246]'
                      : 'bg-[#FFFDF9] text-[#2D2246] border-[#39B980]/40 hover:bg-[#E6F7EF]'
                  }`}
                >
                  <div className="font-extrabold leading-tight">{m.label}</div>
                  <div
                    className={`text-[10px] leading-tight ${
                      active ? 'text-[#6EE7B7]' : 'text-[#1D7A52]'
                    }`}
                  >
                    {m.time}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lời nhắn trực tiếp từ chủ quán + Giờ mở cửa + SĐT liên hệ */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#403064]">
        <span className="px-2 py-0.5 rounded-lg bg-[#F3EFE6] font-semibold">
          {openStatus.detailText}
        </span>
        {contactPhone && (
          <a
            href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`}
            className="px-2 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-[#3B82F6]/30 font-extrabold hover:bg-[#DBEAFE]"
          >
            SĐT: {contactPhone}
          </a>
        )}
        {place.metadata.priceRange && (
          <span className="px-2 py-0.5 rounded-lg bg-[#E6F7EF] text-[#1D7A52] font-bold">
            {place.metadata.priceRange}
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

      {/* Nút hành động: Chỉ đường ngay trên bản đồ + Thực đơn + Gọi SĐT + Google Maps */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {onDrawRouteToPlace && place.lat !== null && place.lng !== null && (
          <button
            type="button"
            onClick={() => {
              if (isRouteActiveForThisPlace && onClearRoute) {
                onClearRoute();
              } else {
                onDrawRouteToPlace(place, selectedMode);
              }
            }}
            className="flex-1 min-w-[130px] py-1.5 px-3 rounded-2xl border-2 border-[#403064] text-[11.5px] font-extrabold flex items-center justify-center shadow-sm transition-colors cursor-pointer"
            style={{
              backgroundColor: isRouteActiveForThisPlace ? '#403064' : '#39B980',
              color: '#FFFFFF',
            }}
          >
            <span>
              {isRouteActiveForThisPlace ? 'Đang chỉ đường (Tắt)' : 'Bắt đầu chỉ đường'}
            </span>
          </button>
        )}

        {contactPhone && (
          <a
            href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`}
            className="py-1.5 px-3 rounded-2xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#3B82F6]/40 text-[11.5px] font-extrabold flex items-center justify-center"
          >
            <span>Gọi điện</span>
          </a>
        )}

        {place.originalPlace && (
          <button
            type="button"
            onClick={() => onOpenFullPlaceModal(place)}
            className="py-1.5 px-3 rounded-2xl bg-[#403064] hover:bg-[#523E7D] text-white text-[11.5px] font-extrabold flex items-center justify-center shadow-sm transition-colors cursor-pointer"
          >
            <span>Thực đơn</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenGoogleMaps}
          className="py-1.5 px-2.5 rounded-2xl bg-[#F1ECE1] hover:bg-[#E5DEC9] text-[#403064] border border-[#403064]/30 text-[11.5px] font-bold flex items-center justify-center transition-colors cursor-pointer"
          title="Mở ứng dụng Google Maps dẫn đường giọng nói"
        >
          <span>Google Maps</span>
        </button>

        {isAdminUser && place.originalPlace && onOpenMerchantPortal && (
          <button
            type="button"
            onClick={() => onOpenMerchantPortal(place)}
            className="py-1.5 px-2.5 rounded-2xl bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#403064] border border-[#403064]/40 text-[11px] font-extrabold flex items-center cursor-pointer"
            title="Quản lý mã code & thực đơn quán"
          >
            <span>Mã quán</span>
          </button>
        )}

        {isAdminUser && onEditCoordinates && (
          <button
            type="button"
            onClick={() => onEditCoordinates(place)}
            className="py-1.5 px-2.5 rounded-2xl bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F59E0B] text-[11.5px] font-extrabold flex items-center cursor-pointer shadow-xs"
            title="Chỉnh sửa tên địa danh, danh mục, địa chỉ, mô tả, tọa độ hoặc ẩn địa điểm"
          >
            <span>Sửa địa điểm</span>
          </button>
        )}
      </div>
    </div>
  );
};
