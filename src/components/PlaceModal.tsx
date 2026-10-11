import React, { useState, useEffect, useMemo } from 'react';
import { 
  Place, 
  getPlaceStyleGroup, 
  getPlaceStyleLabel,
  getPlaceAmenity,
  getPlaceShortDistance,
  getPlacePerPersonText
} from '@/lib/places-xuanhoa';
import { 
  X, MapPin, Phone, Star, Sparkles, Navigation, RotateCw, UtensilsCrossed, 
  ShieldCheck, DollarSign, Search, ChevronDown, Bike, Wind, Flame, Compass 
} from 'lucide-react';
import { formatTypography, cleanDishDisplayTitle } from '@/lib/utils';

function renderAmenityIcon(id: string, size = 14) {
  switch (id) {
    case 'bep-ship':
      return <Bike size={size} />;
    case 'dieu-hoa':
      return <Wind size={size} />;
    case 'nhau-xom':
      return <Flame size={size} />;
    case 'via-he':
    default:
      return <Compass size={size} />;
  }
}

interface PlaceModalProps {
  place: Place | null;
  isOpen: boolean;
  onClose: () => void;
  onSpinAgain?: () => void;
  allPlaces?: Place[];
  onSelectPlace?: (place: Place) => void;
}

export function PlaceModal({ 
  place, 
  isOpen, 
  onClose, 
  onSpinAgain, 
}: PlaceModalProps) {
  if (!place || !isOpen) return null;

  const [currentPlace, setCurrentPlace] = useState<Place>(place);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');

  // Sync when prop place changes
  useEffect(() => {
    if (place) {
      setCurrentPlace(place);
      setIsMenuOpen(false);
      setMenuSearch('');
    }
  }, [place]);

  const activePlace = currentPlace || place;
  const currentStyle = getPlaceStyleGroup(activePlace);
  const currentStyleLabel = getPlaceStyleLabel(currentStyle);
  const amenity = getPlaceAmenity(activePlace);
  const shortDist = getPlaceShortDistance(activePlace);
  const perPerson = getPlacePerPersonText(activePlace);

  const imgUrl = activePlace.imageUrl.startsWith('http') || activePlace.imageUrl.startsWith('/') 
    ? activePlace.imageUrl 
    : `/${activePlace.imageUrl}`;

  // Filtered menu
  const displayMenu = useMemo(() => {
    if (!menuSearch.trim()) return activePlace.menu;
    const query = menuSearch.trim().toLowerCase();
    return activePlace.menu.filter(m => 
      m.name.toLowerCase().includes(query) || 
      (m.tag && m.tag.toLowerCase().includes(query)) ||
      (m.description && m.description.toLowerCase().includes(query))
    );
  }, [activePlace.menu, menuSearch]);

  const handleCall = () => {
    if (activePlace.phone) {
      const cleanPhone = activePlace.phone.replace(/[^0-9]/g, '');
      window.location.href = `tel:${cleanPhone}`;
    }
  };

  const handleMaps = () => {
    const url = activePlace.mapsUrl || (activePlace.mapsQuery.startsWith('http') ? activePlace.mapsQuery : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePlace.mapsQuery + (activePlace.mapsQuery.includes('Vĩnh Phúc') ? '' : ' Xuân Hòa'))}`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSpinAgain = () => {
    onClose();
    if (onSpinAgain) {
      setTimeout(() => onSpinAgain(), 150);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container golden-passport-modal" onClick={e => e.stopPropagation()}>
        {/* VIP Top Ribbon */}
        <div className="golden-passport-ribbon">
          <div className="golden-ribbon-inner">
            <span className="golden-ribbon-star">★</span>
            <span className="golden-ribbon-text">TẤM THẺ TỌA ĐỘ VÀNG XUÂN HÒA · BẢO CHỨNG THỰC TẾ 2026</span>
            <span className="golden-ribbon-star">★</span>
          </div>
        </div>

        {/* Hero Header */}
        <div 
          className="modal-hero golden-hero" 
          style={{ backgroundImage: `linear-gradient(to bottom, rgba(14, 16, 21, 0.45) 0%, rgba(14, 16, 21, 0.95) 100%), url(${imgUrl})` }}
        >
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
          
          <div className="modal-hero-content">
            <div className="modal-tags">
              <span className="badge-tag verified">
                <ShieldCheck size={12} className="inline mr-1 text-emerald-400" />
                Xuân Hòa Xác Thực
              </span>
              <span className="badge-tag style-group">
                {currentStyleLabel}
              </span>
              <span 
                className="badge-tag amenity-tag font-bold inline-flex items-center gap-1.5"
                style={{ borderColor: amenity.badgeColor, color: amenity.badgeColor }}
              >
                {renderAmenityIcon(amenity.id, 12)}
                <span>{amenity.label}</span>
              </span>
              <span className="badge-tag open-status font-bold text-emerald-400 border-emerald-500/40 inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{activePlace.openHours ? `Mở cửa (${activePlace.openHours})` : 'Đang mở cửa'}</span>
              </span>
              <span className="badge-tag rating">
                <Star size={12} fill="#FFB800" color="#FFB800" /> {activePlace.rating} ({activePlace.reviewCount} đánh giá)
              </span>
            </div>
            
            <h2 className="modal-title golden-title">{formatTypography(activePlace.name)}</h2>
            <p className="modal-tagline">"{activePlace.tagline}"</p>
            <p className="modal-address">
              <MapPin size={14} className="text-amber-400 shrink-0" /> 
              <span>{formatTypography(activePlace.address)}</span>
            </p>
          </div>
        </div>

        {/* 3 TỌA ĐỘ TRỌNG YẾU (Golden 3-Metrics Grid) */}
        <div className="golden-coords-grid">
          {/* 1. Cự ly */}
          <div className="golden-coord-card">
            <div className="coord-card-head">
              <MapPin size={15} className="text-amber-400" />
              <span className="coord-card-label">CỰ LY THỰC TẾ</span>
            </div>
            <strong className="coord-card-value">{shortDist}</strong>
            <span className="coord-card-sub">
              {activePlace.zone === 'dhsp2' ? 'Cụm ĐH Sư Phạm Hà Nội 2' : activePlace.zone === 'center' ? 'Khu trung tâm P. Xuân Hòa' : 'Khu vực phụ cận'}
            </span>
          </div>

          {/* 2. Tiện ích quán */}
          <div className="golden-coord-card">
            <div className="coord-card-head">
              <span className="text-amber-400">{renderAmenityIcon(amenity.id, 16)}</span>
              <span className="coord-card-label">TIỆN ÍCH QUÁN</span>
            </div>
            <strong className="coord-card-value" style={{ color: amenity.badgeColor }}>
              {amenity.label}
            </strong>
            <span className="coord-card-sub">
              {activePlace.serviceMode === 'delivery_only' 
                ? 'Bếp chuyên ship tận nơi' 
                : activePlace.serviceMode === 'both' 
                ? 'Phục vụ tại quán & ship' 
                : 'Thưởng thức tại quán'}
            </span>
          </div>

          {/* 3. Tầm giá / người */}
          <div className="golden-coord-card">
            <div className="coord-card-head">
              <DollarSign size={15} className="text-emerald-400" />
              <span className="coord-card-label">TẦM GIÁ / NGƯỜI</span>
            </div>
            <strong className="coord-card-value text-amber-300">{perPerson}</strong>
            <span className="coord-card-sub">Niêm yết: {activePlace.priceRange}</span>
          </div>
        </div>

        {/* MÓN TỦ BẮT BUỘC THỬ (Signature Spotlight) */}
        {activePlace.signatureDish && (
          <div className="golden-signature-banner">
            <div className="golden-sig-badge">
              <Sparkles size={13} className="text-amber-400 inline mr-1" />
              <span>MÓN TỦ BẮT BUỘC THỬ TẠI QUÁN</span>
            </div>
            <div className="golden-sig-content">
              <div className="golden-sig-left">
                <h3 className="golden-sig-name">{formatTypography(activePlace.signatureDish.name)}</h3>
                {activePlace.signatureDish.description && (
                  <p className="golden-sig-desc">{activePlace.signatureDish.description}</p>
                )}
              </div>
              <div className="golden-sig-right">
                <span className="golden-sig-price">{activePlace.signatureDish.price}.000đ</span>
                <span className="golden-sig-tag">{activePlace.signatureDish.tag || 'Đặc sản bán chạy'}</span>
              </div>
            </div>
          </div>
        )}

        {/* BỘ TIỆN ÍCH 1-CHẠM: GRID 2X2 CÂN XỨNG TUYỆT ĐỐI */}
        <div className="golden-1touch-grid">
          {/* Nút 1: Gọi điện thoại */}
          {activePlace.phone ? (
            <a 
              href={`tel:${activePlace.phone.replace(/[^0-9]/g, '')}`} 
              className="golden-grid-btn call"
              title={`Bấm gọi hotline ${activePlace.phone}`}
              onClick={(e) => {
                e.preventDefault();
                handleCall();
              }}
            >
              <Phone size={15} className="shrink-0" /> 
              <span className="truncate">Gọi Quán: {activePlace.phone}</span>
            </a>
          ) : (
            <button 
              type="button" 
              className="golden-grid-btn disabled"
              disabled
            >
              <Phone size={15} className="shrink-0 opacity-50" />
              <span className="truncate">Chưa có Hotline</span>
            </button>
          )}

          {/* Nút 2: Google Maps */}
          <a 
            href={activePlace.mapsUrl || (activePlace.mapsQuery.startsWith('http') ? activePlace.mapsQuery : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePlace.mapsQuery + (activePlace.mapsQuery.includes('Vĩnh Phúc') ? '' : ' Xuân Hòa'))}`)}
            target="_blank" 
            rel="noopener noreferrer"
            className="golden-grid-btn map"
            title="Mở Google Maps chỉ đường trực tiếp"
            onClick={(e) => {
              e.preventDefault();
              handleMaps();
            }}
          >
            <Navigation size={15} className="shrink-0" /> 
            <span className="truncate">Chỉ Đường Google Maps</span>
          </a>

          {/* Nút 3: Xem Thực Đơn (Xổ xuống) */}
          <button
            type="button"
            className={`golden-grid-btn menu ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title={isMenuOpen ? "Đóng danh sách thực đơn" : "Xem danh sách thực đơn niêm yết"}
          >
            <UtensilsCrossed size={15} className="shrink-0" />
            <span className="truncate">
              {isMenuOpen ? `Đóng Menu (${activePlace.menu.length})` : `Xem Menu (${activePlace.menu.length} món)`}
            </span>
            <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Nút 4: Quay Quán Khác */}
          <button 
            type="button"
            className="golden-grid-btn spin"
            onClick={handleSpinAgain}
            title="Quay tiếp quán khác trên vòng quay"
          >
            <RotateCw size={15} className="shrink-0" /> 
            <span className="truncate">Quay Quán Khác</span>
          </button>
        </div>

        {/* THỰC ĐƠN XỔ XUỐNG KHI BẤM "XEM MENU" */}
        {isMenuOpen && (
          <div className="golden-menu-dropdown animate-fadeIn">
            <div className="golden-menu-header">
              <div className="flex items-center gap-2">
                <UtensilsCrossed size={14} className="text-amber-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                  Thực Đơn Niêm Yết ({activePlace.menu.length} món)
                </span>
              </div>
              {activePlace.menu.length > 5 && (
                <div className="golden-menu-search">
                  <Search size={12} className="text-slate-400 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Tìm món nhanh..." 
                    value={menuSearch}
                    onChange={e => setMenuSearch(e.target.value)}
                    className="golden-menu-search-input"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="golden-menu-list">
              {displayMenu.map(item => (
                <div key={item.id} className="golden-menu-row">
                  <div className="golden-menu-row-left">
                    <span className="golden-menu-dish-name">{formatTypography(cleanDishDisplayTitle(item.name))}</span>
                    {item.tag && <span className="golden-menu-dish-tag">{item.tag}</span>}
                    {item.serviceTag === 'ship' && (
                      <span className="dish-service-tag ship text-[10px] py-0.5 px-1.5 inline-flex items-center gap-1">
                        <Bike size={10} className="text-sky-400" /> Ship
                      </span>
                    )}
                    {item.serviceTag === 'both' && (
                      <span className="dish-service-tag both text-[10px] py-0.5 px-1.5 inline-flex items-center gap-1">
                        <Bike size={10} className="text-sky-400" /> Ship & Quán
                      </span>
                    )}
                    {item.serviceTag === 'dine_in' && (
                      <span className="dish-service-tag dine text-[10px] py-0.5 px-1.5 inline-flex items-center gap-1">
                        <UtensilsCrossed size={10} className="text-amber-400" /> Tại Quán
                      </span>
                    )}
                    {item.description && (
                      <p className="golden-menu-dish-desc">{item.description}</p>
                    )}
                  </div>
                  <strong className="golden-menu-dish-price">{item.price}.000đ</strong>
                </div>
              ))}
              {displayMenu.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Không tìm thấy món "{menuSearch}" trong thực đơn quán.
                </div>
              )}
            </div>
          </div>
        )}

        {/* GHI CHÚ GIAO HÀNG & PHỤC VỤ (Delivery Note) */}
        {activePlace.deliveryNote && (
          <div className="modal-delivery-notice golden-delivery-notice">
            <span className="notice-icon"><Bike size={15} className="text-sky-400" /></span>
            <span className="notice-text">{activePlace.deliveryNote}</span>
          </div>
        )}
      </div>
    </div>
  );
}
