import React from 'react';
import {
  Place,
  getPlaceShortDistance,
  getPlacePerPersonText,
  getPlaceHonorBadge,
  getPlaceStyleGroup,
  getPlaceSignboardLines,
} from '@/lib/places-xuanhoa';
import {
  Star,
  MapPin,
  Sparkles,
  Navigation,
  Tent,
  Beer,
  Coffee,
  Flame,
  Soup,
  UtensilsCrossed,
  Utensils,
  Bike,
  Store,
} from 'lucide-react';
import { formatTypography } from '@/lib/utils';
import { getPlaceDisplayTypeBadge } from '@/lib/place-map-utils';
import { resolvePlaceContentProfile } from '@/lib/map/map-category-registry';

export interface PlaceCardProps {
  place: Place;
  onClick?: () => void;
  isReel?: boolean;
  slot?: number;
  sectorTag?: string;
  matchedDishHighlight?: string | null;
  eagerImage?: boolean;
}

function renderPlaceCategoryIcon(place: Place, size = 18) {
  if (place.id === 'tram-du-de') return <Tent size={size} className="text-[#E5B85C]" />;
  if (getPlaceStyleGroup(place) === 'vui-choi') return <Sparkles size={size} className="text-[#E5B85C]" />;
  if (place.category === 'pub') return <Beer size={size} className="text-[#E5B85C]" />;
  if (
    place.category === 'cafe' ||
    (place.tags || []).some(
      (t) =>
        t.toLowerCase().includes('trà') ||
        t.toLowerCase().includes('cafe') ||
        t.toLowerCase().includes('matcha')
    )
  ) {
    return <Coffee size={size} className="text-[#E5B85C]" />;
  }
  if (
    (place.tags || []).some(
      (t) =>
        t.toLowerCase().includes('ăn vặt') ||
        t.toLowerCase().includes('bánh mì') ||
        t.toLowerCase().includes('bánh tráng') ||
        t.toLowerCase().includes('chè')
    )
  ) {
    return <Flame size={size} className="text-[#E5B85C]" />;
  }
  if (place.name.toLowerCase().includes('phở') || place.name.toLowerCase().includes('bún'))
    return <Soup size={size} className="text-[#E5B85C]" />;
  if (place.category === 'restaurant')
    return <UtensilsCrossed size={size} className="text-[#E5B85C]" />;
  return <Utensils size={size} className="text-[#E5B85C]" />;
}

function getPlaceShortAddress(place: Place): string {
  const addr = place.address || '';
  if (addr.includes('Bá Thiện') || addr.includes('Bình Xuyên')) return 'KCN Bá Thiện 2';
  if (addr.includes('Cổng chào') || addr.includes('Tuấn Hiền')) return 'Cổng chào Xuân Hòa';
  if (addr.includes('Vòng tròn') || addr.includes('Xuho') || addr.includes('Salty Name'))
    return 'Vòng tròn Xuho';
  if (addr.includes('VinFast') || addr.includes('KĐT Xuân Hoà')) return 'KĐT Xuân Hoà';
  const parts = addr.split(',');
  return parts[0].trim();
}

/**
 * Hiển thị chuẩn đồng bộ 3 cấp: Loại chi tiết · Tag bổ sung (VD: "Ăn vặt · Ăn đêm · Có giao hàng")
 */
function getPrimaryShortCategory(place: Place, sectorTag?: string): { primary: string; extraCount: number } {
  const taxonomyLine = getPlaceDisplayTypeBadge(place, sectorTag);
  return {
    primary: taxonomyLine || 'Quán Xuân Hòa',
    extraCount: 0,
  };
}

/**
 * Mục 14 & 44: Một cụm ngắn gọn cho khoảng cách / khu vực (~300m hoặc Xuân Hòa)
 */
function getCompactLocationText(place: Place): string {
  const rawDist = getPlaceShortDistance(place) || place.distance || '';
  const meterMatch = rawDist.match(/~?\d+\s*(?:m|km)/i);
  if (meterMatch) {
    const token = meterMatch[0].replace(/\s+/g, '');
    return token.startsWith('~') ? token : `~${token}`;
  }
  if (rawDist.toLowerCase().includes('kđt') || (place.address || '').toLowerCase().includes('kđt')) {
    return 'Xuân Hòa';
  }
  return 'Xuân Hòa';
}

/**
 * Mục 15 & 43: Giá ngắn gọn 1 dòng (VD: 20k–35k, Từ 55k, 60k/giờ), hoặc nhãn chuẩn theo ContentProfile
 */
function getCompactPriceLabel(place: Place): string {
  const profile = resolvePlaceContentProfile({
    subcategoryId: place.subcategoryId,
    parentCategoryId: place.parentCategoryId,
    contentProfile: place.contentProfile,
    catalogMode: place.catalogMode,
    catalogEnabled: place.catalogEnabled,
  });

  if (profile.forbidsMenuAndOrdering) {
    if (profile.contentProfile === 'government') return 'Cơ quan hành chính';
    if (profile.contentProfile === 'education') return place.educationLevel || 'Trường học';
    return 'Địa danh Xuân Hòa';
  }

  if (place.id?.startsWith('osm_') || (place.minPrice === 0 && place.maxPrice === 0)) {
    return 'Công cộng';
  }

  if (profile.contentProfile === 'retail') {
    return profile.catalogEnabled ? 'Sản phẩm & Phụ kiện' : 'Cửa hàng bán lẻ';
  }

  const raw = (place.priceRange || '').trim();
  if (raw.toLowerCase().includes('/giờ') || raw.toLowerCase().includes('/h')) {
    if (place.minPrice > 0 && place.maxPrice > place.minPrice) {
      return `${place.minPrice}k–${place.maxPrice}k/giờ`;
    }
    if (place.minPrice > 0) return `${place.minPrice}k/giờ`;
  }
  if (place.id === 'khu-vui-choi-happi-kid') {
    return 'Từ 39k';
  }
  if (place.minPrice > 0 && place.maxPrice > 0) {
    if (place.minPrice === place.maxPrice) {
      return `${place.minPrice}k`;
    }
    return `${place.minPrice}k–${place.maxPrice}k`;
  }
  if (raw) {
    return raw
      .replace(/\.000\s*đ/gi, 'k')
      .replace(/\/người|\/vé|\/suất|\/cốc|\/bát/gi, '')
      .replace(/~/g, '')
      .replace(/\s*-\s*/g, '–')
      .trim();
  }
  return '25k–50k';
}

const PlaceCardInner: React.FC<PlaceCardProps> = ({
  place,
  onClick,
  isReel = false,
  slot,
  sectorTag,
  matchedDishHighlight,
}) => {
  if (isReel) {
    const honorBadge = getPlaceHonorBadge(place);
    const shortDist = getPlaceShortDistance(place);
    const perPerson = getPlacePerPersonText(place);
    const shortAddr = getPlaceShortAddress(place);

    return (
      <div
        className="reel-place-card brand-signboard-card"
        onClick={onClick}
        style={{
          position: 'absolute',
          top: 7,
          left: (slot ?? 0) * 260,
          borderColor: honorBadge.color || '#F59E0B',
        }}
      >
        <div className="signboard-top-row">
          <span
            className="signboard-badge"
            style={{
              backgroundColor: honorBadge.bg,
              color: honorBadge.color,
              borderColor: honorBadge.border,
            }}
          >
            {honorBadge.label}
          </span>
          <span className="signboard-dist-badge">
            <MapPin size={10} className="inline mr-0.5 text-amber-400" />
            {shortDist}
          </span>
        </div>

        <div className="signboard-center-area">
          <div className="signboard-icon-disc">{renderPlaceCategoryIcon(place)}</div>

          <h3 className="signboard-brand-name" title={place.name}>
            {formatTypography(place.name)}
          </h3>

          <p className="signboard-tagline" title={place.tagline}>
            {place.tagline}
          </p>
        </div>

        <div className="signboard-bottom-row">
          <div className="signboard-address-tag">
            <Navigation size={10} className="inline mr-1 text-slate-400 shrink-0" />
            <span className="truncate">{shortAddr}</span>
          </div>
          <div className="signboard-meta-row">
            <span className="signboard-price">{perPerson}</span>
            <span className="signboard-status">
              {place.serviceMode === 'delivery_only' ? (
                <span className="inline-flex items-center gap-1 text-sky-400 font-semibold">
                  <Bike size={11} />
                  <span>Chuyên ship</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Mở cửa</span>
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // COMPACT 2-COLUMN DISCOVERY CARD VỚI BIỂN QUÁN ĐỒNG BỘ 100%
  // Click cả card -> Mở PlaceModal Detail View đầy đủ thông tin + Dual Map
  // ============================================================================
  const signboard = getPlaceSignboardLines(place);
  const { primary: categoryName, extraCount } = getPrimaryShortCategory(place, sectorTag);
  const locationText = getCompactLocationText(place);
  const priceText = getCompactPriceLabel(place);
  const rawRating = Number(place.rating || 4.9);
  const displayRating = Number.isInteger(rawRating)
    ? String(rawRating)
    : rawRating.toFixed(2).replace(/0$/, '');

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`Xem chi tiết ${place.name}`}
      className="xh-compact-place-card group"
    >
      {/* 1. BIỂN HIỆU QUÁN ĐỒNG BỘ 100% (Minimalist Luxury Signboard Banner) */}
      <div className="xh-compact-card-media">
        <div className="place-signboard-banner">
          <div className="signboard-plaque">
            <div className="signboard-inner-border">
              <h4 className="signboard-brand-primary">{signboard.line1}</h4>
              {signboard.line2 && (
                <span className="signboard-brand-secondary">{signboard.line2}</span>
              )}
            </div>
          </div>
        </div>

        {/* Rating nhỏ gọn ở góc phải dưới biển hiệu: ★ 5 (64) */}
        <div className="xh-compact-rating-badge">
          <Star size={10} fill="#F59E0B" color="#F59E0B" className="shrink-0" />
          <span>{displayRating}</span>
          {place.reviewCount > 0 && (
            <span className="xh-compact-rating-count">({place.reviewCount})</span>
          )}
        </div>
      </div>

      {/* 2. NỘI DUNG TỐI GIẢN (Tên + Category · Khoảng cách + Giá - Mục 8, 11, 13, 14, 15) */}
      <div className="xh-compact-card-body">
        {/* LEVEL 1: Tên quán (tối đa 2 dòng, cố định chiều cao đồng đều - Mục 11 & 26) */}
        <h3 className="xh-compact-card-title" title={place.name}>
          {formatTypography(place.name)}
        </h3>

        {/* LEVEL 3: Category chính · Khoảng cách / Khu vực (Mục 13 & 14) */}
        <div className="xh-compact-card-meta">
          <span className="xh-compact-meta-cat">
            {categoryName}
            {extraCount > 0 ? ` +${extraCount}` : ''}
          </span>
          <span className="xh-compact-meta-dot">·</span>
          <span className="xh-compact-meta-dist">{locationText}</span>
        </div>

        {/* LEVEL 4: Giá ngắn gọn + Trạng thái mở / Món khớp tìm kiếm (Mục 15, 43, 45) */}
        <div className="xh-compact-card-footer">
          <span className="xh-compact-card-price">{priceText}</span>

          {matchedDishHighlight ? (
            <span className="xh-compact-dish-match" title={`Có bán: ${matchedDishHighlight}`}>
              {matchedDishHighlight.split('(')[0].trim()}
            </span>
          ) : (
            <span className="xh-compact-open-dot" title={place.openHours || 'Đang mở cửa'}>
              <span className="xh-open-indicator" />
              <span>Đang mở</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export const PlaceCard = React.memo(PlaceCardInner);
