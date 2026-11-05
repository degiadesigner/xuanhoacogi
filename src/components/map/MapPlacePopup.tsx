import React from 'react';
import {
  X,
  Phone,
  Navigation,
  ExternalLink,
  Bookmark,
  Star,
  Globe,
  FileText,
  Settings2,
} from 'lucide-react';
import type { PlaceLocation } from '@/lib/map/map-types';
import {
  formatPlaceTaxonomyLine,
  getPlaceTaxonomyMeta,
  renderRegistryIcon,
  resolvePlaceContentProfile,
} from '@/lib/map/map-category-registry';
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
  isSaved = false,
  onToggleSave,
}) => {
  const [selectedMode, setSelectedMode] = React.useState<TravelMode>('motorbike');

  if (!place) return null;

  const { subMeta } = getPlaceTaxonomyMeta(place);
  const profileMeta = resolvePlaceContentProfile(place.originalPlace || place);
  const extraTags = place.extraTags || place.originalPlace?.extraTags || [];
  const taxonomyLine = formatPlaceTaxonomyLine(subMeta.id, extraTags);
  const isCatalogEnabled =
    place.catalogEnabled ??
    place.originalPlace?.catalogEnabled ??
    profileMeta.catalogEnabledByDefault;
  const catalogItemsCount = place.originalPlace?.menu?.length || 0;
  const primaryDetailLabel = profileMeta.forbidsMenuAndOrdering
    ? profileMeta.contentProfile === 'government'
      ? 'Thông tin cơ quan'
      : profileMeta.contentProfile === 'education'
      ? 'Thông tin trường'
      : 'Giới thiệu'
    : isCatalogEnabled && catalogItemsCount > 0
    ? profileMeta.contentProfile === 'retail'
      ? `Xem sản phẩm (${catalogItemsCount})`
      : profileMeta.contentProfile === 'service' ||
        profileMeta.contentProfile === 'entertainment'
      ? `Xem bảng giá (${catalogItemsCount})`
      : `Xem thực đơn (${catalogItemsCount})`
    : 'Chi tiết';

  const contactPhone = place.phone || '';
  const ratingValue = place.originalPlace?.rating;

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
      className="w-full max-w-[420px] rounded-[18px] bg-white border border-[#E2E8F0] shadow-[0_12px_32px_rgba(15,23,42,0.12)] p-3.5 sm:p-4 text-[#0F172A] animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* Top Row: Name + Save + Close */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-[#0F172A] leading-snug truncate">
            {place.name}
          </h3>
          <div className="mt-1 flex items-center flex-wrap gap-1.5 text-[12px] text-[#475569]">
            <span
              data-testid="map-popup-taxonomy-line"
              className="inline-flex items-center gap-1 font-medium text-[#059669]"
            >
              {renderRegistryIcon(subMeta.iconName, 13, 'text-[#059669]')}
              <span>{taxonomyLine}</span>
            </span>

            {typeof ratingValue === 'number' && ratingValue > 0 && (
              <>
                <span className="text-[#CBD5E1]">•</span>
                <span className="inline-flex items-center gap-0.5 font-medium text-[#0F172A]">
                  <Star size={12} strokeWidth={1.75} className="text-[#059669] fill-[#059669]" />
                  <span>{ratingValue.toFixed(1)}</span>
                </span>
              </>
            )}

            {(place.openHours || profileMeta.requiresPhoneAndHours) && (
              <>
                <span className="text-[#CBD5E1]">•</span>
                <span
                  className={`font-medium ${
                    openStatus.tone === 'emerald'
                      ? 'text-[#059669]'
                      : openStatus.tone === 'amber'
                      ? 'text-[#B45309]'
                      : 'text-[#64748B]'
                  }`}
                >
                  {openStatus.badgeText}
                </span>
              </>
            )}

            {etaInfo && (
              <>
                <span className="text-[#CBD5E1]">•</span>
                <span className="font-medium text-[#475569]">{etaInfo.distanceText}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(place)}
              title={isSaved ? 'Bỏ lưu địa điểm này' : 'Lưu địa điểm'}
              className={`h-7 px-2 rounded-[9px] text-[11px] font-medium border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                isSaved
                  ? 'bg-[#ECFDF5] text-[#059669] border-[#059669]/40'
                  : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]'
              }`}
            >
              <Bookmark
                size={12}
                strokeWidth={1.75}
                className={isSaved ? 'fill-[#059669] text-[#059669]' : 'text-[#64748B]'}
              />
              <span>{isSaved ? 'Đã lưu' : 'Lưu'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông tin địa điểm"
            className="w-7 h-7 rounded-[9px] bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] border border-[#E2E8F0] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Address & Metadata */}
      <p className="mt-1.5 text-[12px] text-[#64748B] line-clamp-1">
        {place.address}
      </p>

      {/* Travel Mode Pills (when route is active or distance available) */}
      {etaInfo && isRouteActiveForThisPlace && (
        <div className="mt-2.5 grid grid-cols-4 gap-1 p-1 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[11px]">
          {(
            [
              { id: 'motorbike', label: 'Xe máy', time: etaInfo.bikeText },
              { id: 'car', label: 'Ô tô', time: etaInfo.carText },
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
                className={`py-1 px-1.5 rounded-[8px] text-center transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0F172A] text-white font-semibold'
                    : 'text-[#475569] hover:bg-white font-medium'
                }`}
              >
                <div className="leading-tight">{m.label}</div>
                <div className={`text-[10px] leading-tight ${active ? 'text-[#6EE7B7]' : 'text-[#059669]'}`}>
                  {m.time}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Primary Action Buttons: [Chi tiết / Thực đơn / Sản phẩm / Giới thiệu] [Chỉ đường] [Google Maps] */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-testid="map-popup-primary-detail-btn"
          onClick={() => onOpenFullPlaceModal(place)}
          className="h-8 px-3 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileText size={13} strokeWidth={1.7} className="text-[#475569]" />
          <span>{primaryDetailLabel}</span>
        </button>

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
            className={`flex-1 min-w-[110px] h-8 px-3 rounded-[10px] text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isRouteActiveForThisPlace
                ? 'bg-[#0F172A] text-white'
                : 'bg-[#059669] hover:bg-[#047857] text-white'
            }`}
          >
            <Navigation size={13} strokeWidth={1.75} />
            <span>{isRouteActiveForThisPlace ? 'Tắt chỉ đường' : 'Chỉ đường'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenGoogleMaps}
          className="h-8 px-3 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          title="Mở trên Google Maps"
        >
          <ExternalLink size={13} strokeWidth={1.7} className="text-[#475569]" />
          <span>Google Maps</span>
        </button>

        {contactPhone ? (
          <a
            href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`}
            className="h-8 px-2.5 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] text-[12px] font-medium inline-flex items-center justify-center gap-1 transition-colors"
            title={`Gọi ${contactPhone}`}
          >
            <Phone size={13} strokeWidth={1.7} className="text-[#059669]" />
            <span className="hidden sm:inline">{contactPhone}</span>
          </a>
        ) : isAdminUser && profileMeta.requiresPhoneAndHours ? (
          <span
            data-testid="admin-empty-phone-badge"
            className="h-8 px-2.5 rounded-[10px] bg-[#F8FAFC] text-[#64748B] border border-dashed border-[#CBD5E1] text-[11px] font-medium inline-flex items-center justify-center"
          >
            Chưa có SĐT
          </span>
        ) : null}

        {place.media && place.media.some((m) => m.type === 'panorama360') && (
          <button
            type="button"
            onClick={() => {
              const pano = place.media?.find((m) => m.type === 'panorama360');
              if (pano?.url) {
                window.open(pano.url, '_blank', 'noopener,noreferrer');
              }
            }}
            className="h-8 px-2.5 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] text-[12px] font-medium inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Globe size={13} strokeWidth={1.7} className="text-[#059669]" />
            <span>360°</span>
          </button>
        )}

        {isAdminUser && onEditCoordinates && (
          <button
            type="button"
            data-testid="map-popup-edit-place-btn"
            onClick={() => onEditCoordinates(place)}
            className="h-8 px-2.5 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] text-[11.5px] font-medium inline-flex items-center gap-1 cursor-pointer"
            title="Chỉnh sửa thông tin & định vị địa điểm"
          >
            <Settings2 size={13} strokeWidth={1.7} className="text-[#059669]" />
            <span>Sửa</span>
          </button>
        )}
      </div>
    </div>
  );
};
