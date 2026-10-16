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
  ShieldCheck, DollarSign, Search, ChevronDown, Bike, Wind, Flame, Compass,
  MessageSquare, Send, Camera
} from 'lucide-react';
import { formatTypography, cleanDishDisplayTitle } from '@/lib/utils';
import { Review } from '@/lib/places-xuanhoa';
import { getLocalReviews, saveLocalReview } from '@/lib/reviews-storage';
import { UserAuthProfile } from '@/lib/auth';
import { GoogleGIcon } from './GoogleGIcon';

const QUICK_PLACE_TAGS = [
  '😋 Đồ ăn tươi ngon',
  '⚡ Phục vụ nhanh',
  '💰 Giá sinh viên',
  '❄️ Điều hòa mát rượi',
  '🛵 Ship đúng giờ',
  '🧹 Quán sạch sẽ',
];

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
  authUser?: UserAuthProfile | null;
  onOpenLogin?: () => void;
}

export function PlaceModal({ 
  place, 
  isOpen, 
  onClose, 
  onSpinAgain, 
  authUser = null,
  onOpenLogin,
}: PlaceModalProps) {
  if (!place || !isOpen) return null;

  const [currentPlace, setCurrentPlace] = useState<Place>(place);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newRating, setNewRating] = useState<number>(5);
  const [newComment, setNewComment] = useState<string>('');
  const [newPhoto, setNewPhoto] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync when prop place changes
  useEffect(() => {
    if (place) {
      setCurrentPlace(place);
      setIsMenuOpen(false);
      setIsReviewOpen(false);
      setMenuSearch('');
      setReviewSuccess(false);
      setSelectedTags([]);
      setNewPhoto('');
    }
  }, [place]);

  const activePlace = currentPlace || place;

  useEffect(() => {
    if (activePlace?.id) {
      setReviews(getLocalReviews(activePlace.id));
    }
  }, [activePlace?.id]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 500;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setNewPhoto(compressed);
        }
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !activePlace) return;
    if (!authUser || !authUser.isLoggedIn) {
      onOpenLogin?.();
      return;
    }
    const created = saveLocalReview(activePlace.id, {
      author: authUser.nickname || authUser.displayName || 'Thực khách',
      avatar: authUser.avatar || '🐱',
      rating: newRating,
      content: newComment.trim(),
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      photo: newPhoto.trim() || undefined,
      isVerified: true,
    });
    setReviews(prev => [created, ...prev]);
    setNewComment('');
    setSelectedTags([]);
    setNewPhoto('');
    setReviewSuccess(true);
    setTimeout(() => setReviewSuccess(false), 4000);
  };
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
      const cleanPhone = activePlace.phone.split(/[-·,/]/)[0].replace(/[^0-9]/g, '');
      window.location.href = `tel:${cleanPhone}`;
    }
  };

  const handleMaps = () => {
    const url = activePlace.mapsUrl || (activePlace.mapsQuery.startsWith('http') ? activePlace.mapsQuery : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePlace.mapsQuery + (activePlace.mapsQuery.includes('Phú Thọ') ? '' : ' Xuân Hòa'))}`);
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
            <span className="golden-ribbon-text">
              <span className="hidden sm:inline">TẤM THẺ TỌA ĐỘ VÀNG XUÂN HÒA · </span>BẢO CHỨNG THỰC TẾ 2026
            </span>
            <span className="golden-ribbon-star">★</span>
          </div>
        </div>

        {/* Hero Visual Card (Chỉ chứa ảnh + gradient + Tags & Nút Đóng tách bạch) */}
        <div 
          className="modal-hero-cover" 
          style={{ backgroundImage: `url(${imgUrl})` }}
        >
          <div className="modal-hero-overlay" />
          
          {/* Top Bar inside Image: Tags bên trái, Nút đóng bên phải */}
          <div className="modal-hero-top-bar">
            <div className="modal-hero-top-tags">
              <span className="badge-tag rating">
                <Star size={12} fill="#FFB800" color="#FFB800" /> {activePlace.rating} ({activePlace.reviewCount})
              </span>
              <span className="badge-tag style-group">
                {currentStyleLabel}
              </span>
            </div>
            
            <button className="modal-close-btn" onClick={onClose} aria-label="Đóng" type="button">
              <X size={17} />
            </button>
          </div>

          {/* Bottom of Image: Tiêu đề quán nổi bật */}
          <div className="modal-hero-bottom-title">
            <h2 className="modal-title golden-title">{formatTypography(activePlace.name)}</h2>
          </div>
        </div>

        {/* Modal Body Content: Toàn bộ thông tin chữ hiển thị trên nền tối chuẩn, không bao giờ bị đè chữ */}
        <div className="modal-body-content">
          {/* Hàng nhãn chứng thực & giờ mở cửa */}
          <div className="modal-status-row">
            <span className="badge-tag verified">
              <ShieldCheck size={12} className="inline mr-1 text-emerald-400" />
              Xuân Hòa Xác Thực
            </span>
            <span className="badge-tag open-status font-bold text-emerald-400 border-emerald-500/40 inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{activePlace.openHours ? `Mở cửa: ${activePlace.openHours}` : 'Đang mở cửa'}</span>
            </span>
            <span 
              className="badge-tag amenity-tag font-bold inline-flex items-center gap-1.5"
              style={{ borderColor: amenity.badgeColor, color: amenity.badgeColor }}
            >
              {renderAmenityIcon(amenity.id, 12)}
              <span>{amenity.label}</span>
            </span>
          </div>
          
          {/* Lời tựa quán */}
          <p className="modal-tagline">"{activePlace.tagline}"</p>
          
          {/* Địa chỉ quán */}
          <p className="modal-address">
            <MapPin size={14} className="text-amber-400 shrink-0 mt-0.5" /> 
            <span>{formatTypography(activePlace.address)}</span>
          </p>

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

        {/* ==============================================================
            PHÂN BIỆT KHÁCH VÃNG LAI VS ĐÃ ĐĂNG NHẬP
            Khách vãng lai: Khóa thông tin hotline, Google maps, thực đơn
            Đã đăng nhập: Mở khóa đầy đủ bộ tiện ích 2x2, thực đơn và feedback
            ============================================================== */}
        {!authUser || !authUser.isLoggedIn ? (
          <div className="guest-spot-lock-card place-lock-card">
            <div className="lock-icon-badge">🔒</div>
            <h4 className="lock-title">Mở khóa thông tin liên hệ &amp; Thực đơn quán</h4>
            <p className="lock-desc">
              Bạn đang ở chế độ <strong>Khách Vãng Lai</strong> (chỉ trải nghiệm quay thử). Hãy đăng nhập tài khoản Google để xem địa chỉ chính xác, hotline gọi điện, toàn bộ thực đơn và gửi feedback cho quán nhé!
            </p>
            <button
              type="button"
              className="auth-google-cta-btn guest-unlock-btn"
              onClick={() => {
                onClose();
                onOpenLogin?.();
              }}
            >
              <GoogleGIcon size={18} />
              <span>Đăng nhập để xem đầy đủ Quán</span>
            </button>
          </div>
        ) : (
          <>
            {/* BỘ TIỆN ÍCH 1-CHẠM: GRID 2X2 CÂN XỨNG TUYỆT ĐỐI */}
            <div className="golden-1touch-grid">
          {/* Nút 1: Gọi điện thoại */}
          {activePlace.phone ? (
            <a 
              href={`tel:${activePlace.phone.split(/[-·,/]/)[0].replace(/[^0-9]/g, '')}`} 
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
            href={activePlace.mapsUrl || (activePlace.mapsQuery.startsWith('http') ? activePlace.mapsQuery : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePlace.mapsQuery + (activePlace.mapsQuery.includes('Phú Thọ') ? '' : ' Xuân Hòa'))}`)}
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
            onClick={() => {
              setIsMenuOpen(!isMenuOpen);
              if (!isMenuOpen) setIsReviewOpen(false);
            }}
            title={isMenuOpen ? "Đóng danh sách thực đơn" : "Xem danh sách thực đơn niêm yết"}
          >
            <UtensilsCrossed size={15} className="shrink-0" />
            <span className="truncate">
              {isMenuOpen ? `Đóng Menu (${activePlace.menu.length})` : `Xem Menu (${activePlace.menu.length})`}
            </span>
            <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Nút 4: Góp Ý & Feedback (Xổ xuống) */}
          <button
            type="button"
            className={`golden-grid-btn feedback-toggle-btn ${isReviewOpen ? 'active' : ''}`}
            onClick={() => {
              setIsReviewOpen(!isReviewOpen);
              if (!isReviewOpen) setIsMenuOpen(false);
            }}
            title="Đánh giá & Gửi feedback thực tế cho quán"
          >
            <MessageSquare size={15} className="shrink-0" />
            <span className="truncate">
              {isReviewOpen ? 'Đóng Góp Ý' : `Góp Ý & Feedback (${reviews.length})`}
            </span>
            <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${isReviewOpen ? 'rotate-180' : ''}`} />
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

        {/* KHU VỰC ĐÁNH GIÁ & GÓP Ý QUÁN CHO KHÁCH & NGƯỜI DÙNG */}
        {isReviewOpen && (
          <div className="golden-menu-dropdown animate-fadeIn place-reviews-dropdown">
            <div className="golden-menu-header">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-amber-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                  Góp Ý &amp; Đánh Giá Cho Quán ({reviews.length})
                </span>
              </div>
            </div>

            {/* FORM GỬI ĐÁNH GIÁ HOẶC THÔNG BÁO CHO KHÁCH VÃNG LAI */}
            {!authUser || !authUser.isLoggedIn ? (
              <div className="guest-review-gate-box">
                <p className="guest-review-gate-text">
                  🔒 <strong>Chế độ Khách Vãng Lai:</strong> Đăng nhập tài khoản Google để gửi nhận xét, bình chọn sao và tải ảnh feedback trực tiếp cho quán nhé!
                </p>
                <button
                  type="button"
                  className="auth-google-cta-btn guest-review-btn"
                  onClick={() => {
                    onClose();
                    onOpenLogin?.();
                  }}
                >
                  <GoogleGIcon size={16} />
                  <span>Đăng nhập để gửi Feedback</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="place-review-form">
                <div className="place-review-form-header">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{authUser.avatar || '🐱'}</span>
                    <strong className="text-xs text-white">{authUser.nickname}</strong>
                    <span className="verified-badge-mini">✓ Đã ghé quán</span>
                  </div>
                  {/* Rating stars */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className={`star-select-btn ${star <= newRating ? 'active' : ''}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick tags picker */}
                <div className="quick-tags-picker">
                  <span className="quick-tags-label">Cảm nhận nhanh:</span>
                  <div className="quick-tags-list">
                    {QUICK_PLACE_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`quick-tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                        onClick={() => handleToggleTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className="place-review-textarea"
                  placeholder="Nhận xét hương vị, chất lượng món ăn, phục vụ để feedback cho quán..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  maxLength={300}
                  required
                />

                {/* Upload ảnh thực tế */}
                <div className="review-photo-row">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleFileUpload} 
                  />
                  <button
                    type="button"
                    className="photo-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Tải ảnh đĩa thức ăn hoặc không gian quán thực tế"
                  >
                    <Camera size={13} />
                    <span>{newPhoto ? 'Đổi ảnh chụp' : 'Đính kèm ảnh thực tế (Tùy chọn)'}</span>
                  </button>

                  {newPhoto && (
                    <div className="photo-preview-box">
                      <img src={newPhoto} alt="Xem trước" className="photo-preview-thumb" />
                      <button 
                        type="button" 
                        className="remove-photo-btn"
                        onClick={() => setNewPhoto('')}
                        title="Xóa ảnh"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="place-review-form-footer">
                  <button type="submit" className="place-review-submit-btn w-full justify-center">
                    <Send size={13} />
                    <span>Gửi Góp Ý Cho Quán</span>
                  </button>
                </div>

                {reviewSuccess && (
                  <div className="place-review-success-msg">
                    ✓ Đã gửi đánh giá thành công! Cảm ơn bạn đã đóng góp cho quán ăn Xuân Hòa.
                  </div>
                )}
              </form>
            )}

            {/* DANH SÁCH CÁC ĐÁNH GIÁ HIỆN CÓ */}
            <div className="place-reviews-list">
              {reviews.map((rev) => (
                <div key={rev.id} className="place-review-item">
                  <div className="review-card-header">
                    <div className="review-card-avatar-wrap">
                      <span>{rev.avatar || '👤'}</span>
                    </div>
                    <div className="review-card-main-col">
                      <div className="review-card-author-row">
                        <span className="review-card-author-name">{rev.author}</span>
                      </div>
                      <div className="review-card-sub-meta">
                        <div className="review-card-stars" aria-label={`${rev.rating || 5} sao`}>
                          {'★'.repeat(rev.rating || 5)}
                        </div>
                        <span className="review-card-meta-dot">·</span>
                        <span className="review-card-date">{rev.date}</span>
                      </div>
                    </div>
                  </div>
                  {rev.tags && rev.tags.length > 0 && (
                    <div className="review-card-tags-row">
                      {rev.tags.map(t => (
                        <span key={t} className="review-card-tag-pill">{t}</span>
                      ))}
                    </div>
                  )}
                  <p className="place-review-content">{rev.content}</p>
                  {rev.photo && (
                    <img src={rev.photo} alt="Ảnh đánh giá" className="place-review-photo" />
                  )}
                </div>
              ))}
              {reviews.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Chưa có đánh giá nào cho quán này. Hãy là người đầu tiên gửi feedback nhé!
                </div>
              )}
            </div>
          </div>
        )}
          </>
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
    </div>
  );
}
