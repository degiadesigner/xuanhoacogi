import React from 'react';
import { 
  Place, 
  getPlaceAmenity, 
  getPlaceShortDistance, 
  getPlacePerPersonText,
  getPlaceHonorBadge,
  getPlaceSignboardLines
} from '@/lib/places-xuanhoa';
import { 
  Star, MapPin, Sparkles, Navigation, Tent, Beer, Coffee, Flame, 
  Soup, UtensilsCrossed, Utensils, Bike, Wind, Compass 
} from 'lucide-react';
import { formatTypography } from '@/lib/utils';

interface PlaceCardProps {
  place: Place;
  onClick?: () => void;
  isReel?: boolean;
  slot?: number;
}

function renderPlaceCategoryIcon(place: Place) {
  if (place.id === 'tram-du-de') return <Tent size={18} className="text-amber-400" />;
  if (place.category === 'pub') return <Beer size={18} className="text-amber-400" />;
  if (
    place.category === 'cafe' || 
    place.tags.some(t => t.toLowerCase().includes('trà') || t.toLowerCase().includes('cafe') || t.toLowerCase().includes('matcha'))
  ) {
    return <Coffee size={18} className="text-amber-400" />;
  }
  if (
    place.tags.some(t => t.toLowerCase().includes('ăn vặt') || t.toLowerCase().includes('bánh mì') || t.toLowerCase().includes('bánh tráng') || t.toLowerCase().includes('chè'))
  ) {
    return <Flame size={18} className="text-amber-400" />;
  }
  if (place.name.toLowerCase().includes('phở') || place.name.toLowerCase().includes('bún')) return <Soup size={18} className="text-amber-400" />;
  if (place.category === 'restaurant') return <UtensilsCrossed size={18} className="text-amber-400" />;
  return <Utensils size={18} className="text-amber-400" />;
}

function renderAmenityIcon(id: string) {
  switch (id) {
    case 'bep-ship':
      return <Bike size={11} className="inline mr-1" />;
    case 'dieu-hoa':
      return <Wind size={11} className="inline mr-1" />;
    case 'nhau-xom':
      return <Flame size={11} className="inline mr-1" />;
    case 'via-he':
    default:
      return <Compass size={11} className="inline mr-1" />;
  }
}

function getPlaceShortAddress(place: Place): string {
  const addr = place.address || '';
  if (addr.includes('Bá Thiện') || addr.includes('Bình Xuyên')) return 'KCN Bá Thiện 2';
  if (addr.includes('Cổng chào') || addr.includes('Tuấn Hiền')) return 'Cổng chào Xuân Hòa';
  if (addr.includes('Vòng tròn') || addr.includes('Xuho') || addr.includes('Salty Name')) return 'Vòng tròn Xuho';
  if (addr.includes('16') && addr.includes('Kim Ngọc')) return '16 Kim Ngọc';
  if (addr.includes('Đầu ngõ Kim Ngọc') || addr.includes('ngõ Kim Ngọc')) return 'Đầu ngõ Kim Ngọc';
  if (addr.includes('Số 3') && addr.includes('Kim Ngọc')) return 'Số 3 Kim Ngọc';
  if (addr.includes('47') && addr.includes('Kim Ngọc')) return '47 Kim Ngọc';
  if (addr.includes('11') && addr.includes('Kim Ngọc')) return '11 Kim Ngọc';
  if (addr.includes('Số 9') && addr.includes('Kim Ngọc')) return 'Số 9 Kim Ngọc';
  if (addr.includes('55') && addr.includes('Nguyễn Văn Linh')) return '55 Nguyễn Văn Linh';
  if (addr.includes('90') && addr.includes('Nguyễn Văn Linh')) return '90 Nguyễn Văn Linh';
  if (addr.includes('185')) return '185 Nguyễn Văn Linh';
  if (addr.includes('78') && addr.includes('Trường Chinh')) return '78 Trường Chinh';
  if (addr.includes('122') && addr.includes('Trường Chinh')) return '122 Trường Chinh';
  if (addr.includes('512')) return '512 Trường Chinh';
  if (addr.includes('27 Đồng Tâm')) return '27 Đồng Tâm';
  if (addr.includes('9 Đồng Tâm') || (addr.includes('Số 9') && addr.includes('Đồng Tâm'))) return 'Số 9 Đồng Tâm';
  if (addr.includes('Diamond')) return 'KĐT Mới (Diamond)';
  if (addr.includes('Ban Quản Lý')) return 'Ban Quản Lý KĐT';
  if (addr.includes('xe buýt 95') || addr.includes('95')) return 'Đối diện xe buýt 95';
  if (addr.includes('Dốc KTX') || addr.includes('Dốc ktx')) return 'Dốc KTX Nguyễn Văn Linh';
  if (addr.includes('Cổng Ký Túc Xá') || addr.includes('KTX')) return 'Cổng KTX ĐHSP2';
  if (addr.includes('109 Nguyễn Văn Linh')) return '109 Nguyễn Văn Linh';
  if (addr.includes('122 Nguyễn Văn Linh')) return '122 Nguyễn Văn Linh';
  if (addr.includes('48 Nguyễn Văn Linh')) return '48 Nguyễn Văn Linh';
  if (addr.includes('48B Nguyễn Văn Linh')) return '48B Nguyễn Văn Linh';
  if (addr.includes('206 Nguyễn Văn Linh')) return '206 Nguyễn Văn Linh';
  if (addr.includes('50 Trường Chinh')) return '50 Trường Chinh';
  if (addr.includes('36 - 38 Điện Biên') || addr.includes('Điện Biên')) return '36-38 Điện Biên';
  if (addr.includes('Lê Quang Đạo')) return 'Lê Quang Đạo';
  if (addr.includes('Trần Phú')) return 'Trần Phú';
  if (addr.includes('Dốc Chợ')) return 'Dốc Chợ Xuân Hòa';
  if (addr.includes('Hiển Lễ')) return 'Hiển Lễ (Bếp Ship)';
  if (addr.includes('88-90') || addr.includes('Võ Thị Sáu')) return '88-90 Võ Thị Sáu';
  if (addr.includes('275')) return '275 Nguyễn Văn Linh';
  if (addr.includes('ngõ 5') || addr.includes('02 ngõ 5')) return '02 ngõ 5 Nguyễn Văn Linh';
  
  const parts = addr.split(',');
  return parts[0].trim();
}

export function PlaceCard({ place, onClick, isReel = false, slot }: PlaceCardProps) {
  const honorBadge = getPlaceHonorBadge(place);
  const signboard = getPlaceSignboardLines(place);
  const imgUrl = place.imageUrl.startsWith('http') || place.imageUrl.startsWith('/') ? place.imageUrl : `/${place.imageUrl}`;
  const amenity = getPlaceAmenity(place);
  const shortDist = getPlaceShortDistance(place);
  const perPerson = getPlacePerPersonText(place);

  if (isReel) {
    const shortAddr = getPlaceShortAddress(place);

    return (
      <div 
        className="reel-place-card brand-signboard-card"
        onClick={onClick}
        style={{
          position: 'absolute',
          top: 7,
          left: (slot ?? 0) * 260,
          borderColor: honorBadge.color || '#F59E0B'
        }}
      >
        {/* Top Badges Row */}
        <div className="signboard-top-row">
          <span 
            className="signboard-badge"
            style={{ 
              backgroundColor: honorBadge.bg, 
              color: honorBadge.color,
              borderColor: honorBadge.border
            }}
          >
            {honorBadge.label}
          </span>
          <span className="signboard-dist-badge">
            <MapPin size={10} className="inline mr-0.5 text-amber-400" />
            {shortDist}
          </span>
        </div>

        {/* Central Signboard: Logo Icon & Distinct Typography Name */}
        <div className="signboard-center-area">
          <div className="signboard-icon-disc">
            {renderPlaceCategoryIcon(place)}
          </div>

          <h3 className="signboard-brand-name" title={place.name}>
            {formatTypography(place.name)}
          </h3>

          <p className="signboard-tagline" title={place.tagline}>
            {place.tagline}
          </p>
        </div>

        {/* Bottom Details Row */}
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

  return (
    <div className="grid-place-card" onClick={onClick}>
      <div className="grid-card-img-wrap">
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
        <div className="grid-card-rating">
          <Star size={12} fill="#FFB800" color="#FFB800" />
          <span>{place.rating}</span>
          <span className="text-xs opacity-75">({place.reviewCount})</span>
        </div>
      </div>

      <div className="grid-card-content">
        <div className="grid-card-tags">
          {/* Tiện ích quán badge */}
          <span 
            className="tag-chip font-semibold inline-flex items-center"
            style={{ borderColor: amenity.badgeColor, color: amenity.badgeColor }}
          >
            {renderAmenityIcon(amenity.id)}
            {amenity.label.split(' ')[0]} {amenity.label.split(' ')[1] || ''}
          </span>

          {place.serviceMode === 'delivery_only' && (
            <span className="tag-chip service-delivery inline-flex items-center gap-1">
              <Bike size={11} className="text-sky-400" /> Chuyên Ship
            </span>
          )}
          {place.serviceMode === 'both' && (
            <span className="tag-chip service-both inline-flex items-center gap-1">
              <Bike size={11} className="text-sky-400" /> Ship & Quán
            </span>
          )}
          {place.serviceMode === 'dine_in_only' && (
            <span className="tag-chip service-dine inline-flex items-center gap-1">
              <UtensilsCrossed size={11} className="text-amber-400" /> Tại Quán
            </span>
          )}
          {place.tags.slice(0, 1).map(tag => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
          <span className="dist-chip"><MapPin size={11} /> {shortDist}</span>
        </div>

        <h3 className="grid-place-title">{formatTypography(place.name)}</h3>
        <p className="grid-place-tagline">{place.tagline}</p>

        <div className="grid-signature-box">
          <span className="sig-label">Món tủ nổi tiếng:</span>
          <div className="sig-row">
            <strong className="sig-name">{formatTypography(place.signatureDish.name)}</strong>
            <span className="sig-price">~{place.signatureDish.price}k</span>
          </div>
        </div>

        <div className="grid-card-bottom">
          <div className="flex flex-col text-left">
            <span className="text-[11px] text-slate-400">Tầm giá / người:</span>
            <strong className="text-amber-400 text-xs font-bold">{perPerson}</strong>
          </div>
          <button className="btn-view-details">
            Xem Tọa Độ Vàng →
          </button>
        </div>
      </div>
    </div>
  );
}
