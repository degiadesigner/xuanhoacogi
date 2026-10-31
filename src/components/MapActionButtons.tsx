'use client';

import React from 'react';
import { Map as MapIcon, Globe, MapPinOff } from 'lucide-react';
import type { Place } from '@/lib/places-xuanhoa';
import type { PlaceLocation } from '@/lib/map/map-types';
import {
  getPlaceMapAvailability,
  openInternalDigitalMap,
  openGoogleMapsUrl,
} from '@/lib/place-map-utils';

export interface MapActionButtonsProps {
  place?: Partial<Place> | Partial<PlaceLocation> | null;
  placeId?: string;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  compact?: boolean;
  showLabels?: boolean;
  hideUnlocatedBadge?: boolean;
  allowCoordinateGoogleFallback?: boolean;
  onOpenInternalMap?: (placeId: string, lat: number, lng: number) => void;
  onAfterInternalMapClick?: () => void;
  className?: string;
}

export function MapActionButtons({
  place,
  placeId,
  lat,
  lng,
  mapsUrl,
  compact = false,
  showLabels = true,
  hideUnlocatedBadge = false,
  allowCoordinateGoogleFallback = false,
  onOpenInternalMap,
  onAfterInternalMapClick,
  className = '',
}: MapActionButtonsProps) {
  const effectiveInput = React.useMemo(() => {
    if (place) {
      return {
        ...place,
        id: placeId || place.id,
        lat: lat !== undefined ? lat : (place as PlaceLocation).lat ?? (place as Place).lat,
        lng: lng !== undefined ? lng : (place as PlaceLocation).lng ?? (place as Place).lng,
        mapsUrl:
          mapsUrl !== undefined
            ? mapsUrl || undefined
            : (place as Place).mapsUrl ||
              (place as PlaceLocation).metadata?.mapsUrl ||
              (place as PlaceLocation).originalPlace?.mapsUrl,
      };
    }
    if (placeId || lat !== undefined || lng !== undefined || mapsUrl !== undefined) {
      return {
        id: placeId || '',
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        mapsUrl: mapsUrl || undefined,
      };
    }
    return null;
  }, [place, placeId, lat, lng, mapsUrl]);

  const availability = React.useMemo(
    () =>
      getPlaceMapAvailability(effectiveInput, {
        allowCoordinateGoogleFallback,
      }),
    [effectiveInput, allowCoordinateGoogleFallback]
  );

  const resolvedId = (placeId || effectiveInput?.id || '').trim();

  const handleInternalMapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!availability.internalMap || !resolvedId) return;
    if (onOpenInternalMap && availability.lat !== null && availability.lng !== null) {
      onOpenInternalMap(resolvedId, availability.lat, availability.lng);
    }
    if (onAfterInternalMapClick) {
      onAfterInternalMapClick();
    }
    openInternalDigitalMap(resolvedId, availability.lat, availability.lng);
  };

  const handleGoogleMapsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!availability.googleMaps || !availability.googleMapsUrl) return;
    openGoogleMapsUrl(availability.googleMapsUrl);
  };

  // Trường hợp F (TEST 4): Chưa có cả lat/lng lẫn mapsUrl -> Hiện badge "Chưa có vị trí"
  if (!availability.internalMap && !availability.googleMaps) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-lg font-medium select-none ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-[12px]'
        } ${className}`}
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px dashed rgba(255, 255, 255, 0.14)',
          color: '#7E8694',
        }}
        title="Địa điểm này chưa cập nhật tọa độ Bản đồ số và chưa có link Google Maps"
      >
        <MapPinOff className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        <span>Chưa có vị trí</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* A / C / E: Có tọa độ hợp lệ trên Bản đồ số nội bộ */}
      {availability.internalMap ? (
        <button
          type="button"
          onClick={handleInternalMapClick}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-bold transition-all active:scale-[0.98] cursor-pointer ${
            compact ? 'px-2.5 py-1.5 text-[11.5px]' : 'px-3 py-2 text-[12.5px]'
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(229, 184, 92, 0.22), rgba(212, 160, 56, 0.14))',
            border: '1px solid rgba(229, 184, 92, 0.55)',
            color: '#F4CE74',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.22)',
          }}
          title="Mở Bản đồ số XuanHoaCoGi và bay tới đúng vị trí địa điểm"
        >
          <MapIcon className={compact ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
          {showLabels && <span>🗺 Bản đồ số</span>}
        </button>
      ) : (
        /* D (TEST 3): Chỉ có Google Maps nhưng chưa định vị trên Bản đồ số */
        !hideUnlocatedBadge && (
          <span
            className={`inline-flex items-center justify-center gap-1 rounded-lg font-medium select-none cursor-not-allowed opacity-65 ${
              compact ? 'px-2 py-1.5 text-[11px]' : 'px-2.5 py-2 text-[11.5px]'
            }`}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.14)',
              color: '#8B93A1',
            }}
            title="Địa điểm chưa được ghim tọa độ trên Bản đồ số nội bộ"
          >
            <MapPinOff className="w-3 h-3 shrink-0" />
            {showLabels && <span>Chưa định vị</span>}
          </span>
        )
      )}

      {/* B / C / D: Có link Google Maps hợp lệ (Hiển thị song song cùng Bản đồ số nếu có cả hai) */}
      {availability.googleMaps && availability.googleMapsUrl && (
        <button
          type="button"
          onClick={handleGoogleMapsClick}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all active:scale-[0.98] hover:bg-white/[0.08] cursor-pointer ${
            compact ? 'px-2.5 py-1.5 text-[11.5px]' : 'px-3 py-2 text-[12.5px]'
          }`}
          style={{
            background: 'rgba(56, 189, 248, 0.10)',
            border: '1px solid rgba(56, 189, 248, 0.38)',
            color: '#7DD3FC',
          }}
          title={
            availability.googleUrlSource === 'coordinates'
              ? 'Mở vị trí trên Google Maps (từ tọa độ đã xác minh)'
              : 'Mở đúng link Google Maps gốc của địa điểm'
          }
        >
          <Globe className={compact ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
          {showLabels && <span>🌐 Google Maps</span>}
        </button>
      )}
    </div>
  );
}
