import React, { useState, useEffect, useMemo } from 'react';
import {
  Place,
  getPlaceAmenity,
  getPlaceShortDistance,
  getPlacePerPersonText,
  Review,
} from '@/lib/places-xuanhoa';
import {
  X,
  MapPin,
  Phone,
  Star,
  Sparkles,
  UtensilsCrossed,
  ShieldCheck,
  DollarSign,
  Search,
  ChevronDown,
  Bike,
  Wind,
  Flame,
  Compass,
  MessageSquare,
  Send,
  Camera,
  Clock,
} from 'lucide-react';
import { formatTypography, cleanDishDisplayTitle } from '@/lib/utils';
import { getLocalReviews, saveLocalReview } from '@/lib/reviews-storage';
import { UserAuthProfile } from '@/lib/auth';
import { GoogleGIcon } from './GoogleGIcon';
import { MapActionButtons } from './MapActionButtons';
import {
  getPlaceDisplayTypeBadge,
  isEntertainmentOrServicePlace,
} from '@/lib/place-map-utils';

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

type InPlaceMenuFilter = 'all' | 'an' | 'nhau' | 'uong';

function classifyMenuItemType(name: string, tag?: string, desc?: string): 'an' | 'nhau' | 'uong' {
  const text = `${name} ${tag || ''} ${desc || ''}`.toLowerCase();
  if (
    text.includes('trà') ||
    text.includes('cafe') ||
    text.includes('cà phê') ||
    text.includes('phê ') ||
    text.includes('bạc xỉu') ||
    text.includes('sữa') ||
    text.includes('nước ép') ||
    text.includes('sinh tố') ||
    text.includes('coca') ||
    text.includes('cola') ||
    text.includes('bò húc') ||
    text.includes('sting') ||
    text.includes('7up') ||
    text.includes('matcha') ||
    text.includes('cacao') ||
    text.includes('milo') ||
    text.includes('chè') ||
    text.includes('tào phớ') ||
    text.includes('đồ uống') ||
    text.includes('giải nhiệt') ||
    text.includes('giải khát')
  ) {
    return 'uong';
  }
  if (
    text.includes('lẩu') ||
    text.includes('nướng') ||
    text.includes('bia') ||
    text.includes('rượu') ||
    text.includes('nhậu') ||
    text.includes('ốc') ||
    text.includes('trâu') ||
    text.includes('ngựa') ||
    text.includes('dồi') ||
    text.includes('nầm') ||
    text.includes('bò tảng') ||
    text.includes('chảo gang') ||
    text.includes('hải sản') ||
    text.includes('mẹt')
  ) {
    return 'nhau';
  }
  return 'an';
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
  authUser = null,
  onOpenLogin,
}: PlaceModalProps) {
  const [currentPlace, setCurrentPlace] = useState<Place | null>(place);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuFilter, setMenuFilter] = useState<InPlaceMenuFilter>('all');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newRating, setNewRating] = useState<number>(5);
  const [newComment, setNewComment] = useState<string>('');
  const [newPhoto, setNewPhoto] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (place) {
      setCurrentPlace(place);
      setIsReviewOpen(false);
      setMenuSearch('');
      setMenuFilter('all');
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

  const safeMenu = activePlace?.menu || [];
  const isNonFoodVenue = isEntertainmentOrServicePlace(activePlace);
  const isCivicLandmark = Boolean(activePlace?.id?.startsWith('osm_'));

  const availableMenuCategories = useMemo(() => {
    const counts = { an: 0, nhau: 0, uong: 0 };
    for (const item of safeMenu) {
      const cat = classifyMenuItemType(item.name, item.tag, item.description);
      counts[cat]++;
    }
    return counts;
  }, [safeMenu]);

  const displayMenu = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();
    return safeMenu.filter((m) => {
      if (!isNonFoodVenue && menuFilter !== 'all') {
        const cat = classifyMenuItemType(m.name, m.tag, m.description);
        if (cat !== menuFilter) return false;
      }
      if (!query) return true;
      return (
        m.name.toLowerCase().includes(query) ||
        (m.tag && m.tag.toLowerCase().includes(query)) ||
        (m.description && m.description.toLowerCase().includes(query))
      );
    });
  }, [safeMenu, menuSearch, menuFilter, isNonFoodVenue]);

  if (!place || !isOpen || !activePlace) return null;

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
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
    setReviews((prev) => [created, ...prev]);
    setNewComment('');
    setSelectedTags([]);
    setNewPhoto('');
    setReviewSuccess(true);
    setTimeout(() => setReviewSuccess(false), 4000);
  };

  const typeBadge = getPlaceDisplayTypeBadge(activePlace);
  const amenity = getPlaceAmenity(activePlace);
  const shortDist = getPlaceShortDistance(activePlace);
  const perPerson = getPlacePerPersonText(activePlace);

  const rawImgUrl = activePlace.imageUrl || 'ai_studio_dish_com_rang_68_1.jpg';
  const imgUrl =
    rawImgUrl.startsWith('http') || rawImgUrl.startsWith('/') || rawImgUrl.startsWith('data:')
      ? rawImgUrl
      : `/${rawImgUrl}`;

  const handleCall = () => {
    if (activePlace.phone) {
      const cleanPhone = activePlace.phone.split(/[-·,/]/)[0].replace(/[^0-9]/g, '');
      window.location.href = `tel:${cleanPhone}`;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container golden-passport-modal" onClick={(e) => e.stopPropagation()}>
        {/* VIP Top Ribbon */}
        <div className="golden-passport-ribbon">
          <div className="golden-ribbon-inner">
            <span className="golden-ribbon-star">★</span>
            <span className="golden-ribbon-text">
              <span className="hidden sm:inline">BẢN ĐỒ SỐ &amp; QUÁN XÁ XUÂN HÒA · </span>
              THÔNG TIN XÁC THỰC
            </span>
            <span className="golden-ribbon-star">★</span>
          </div>
        </div>

        {/* Hero Visual Card */}
        <div className="modal-hero-cover" style={{ backgroundImage: `url(${imgUrl})` }}>
          <div className="modal-hero-overlay" />

          <div className="modal-hero-top-bar">
            <div className="modal-hero-top-tags">
              {!isCivicLandmark && (
                <span className="badge-tag rating">
                  <Star size={12} fill="#FFB800" color="#FFB800" /> {activePlace.rating} (
                  {activePlace.reviewCount})
                </span>
              )}
              <span className="badge-tag style-group">{typeBadge}</span>
            </div>

            <button className="modal-close-btn" onClick={onClose} aria-label="Đóng" type="button">
              <X size={17} />
            </button>
          </div>

          <div className="modal-hero-bottom-title">
            <h2 className="modal-title golden-title">{formatTypography(activePlace.name)}</h2>
          </div>
        </div>

        {/* Modal Body Content */}
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
              <span>
                {activePlace.openHours ? `Giờ: ${activePlace.openHours}` : 'Đang mở cửa'}
              </span>
            </span>
            {!isCivicLandmark && (
              <span
                className="badge-tag amenity-tag font-bold inline-flex items-center gap-1.5"
                style={{ borderColor: amenity.badgeColor, color: amenity.badgeColor }}
              >
                {renderAmenityIcon(amenity.id, 12)}
                <span>{amenity.label}</span>
              </span>
            )}
          </div>

          {/* Lời tựa quán */}
          {activePlace.tagline && <p className="modal-tagline">&ldquo;{activePlace.tagline}&rdquo;</p>}

          {/* Địa chỉ quán */}
          <p className="modal-address">
            <MapPin size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <span>{formatTypography(activePlace.address)}</span>
          </p>

          {/* ==============================================================
              KHU VỰC DUAL MAP ACTION + GỌI ĐIỆN (MỤC 15 & 25)
              [🗺 Bản đồ số]  [🌐 Google Maps]  [☎ Gọi]
              ============================================================== */}
          <div
            className="my-3 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(229, 184, 92, 0.28)',
            }}
          >
            <MapActionButtons
              place={activePlace}
              onOpenInternalMap={() => onClose()}
            />

            {activePlace.phone ? (
              <button
                type="button"
                onClick={handleCall}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold transition-all active:scale-[0.98] cursor-pointer"
                style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  color: '#6EE7B7',
                }}
                title={`Gọi ngay: ${activePlace.phone}`}
              >
                <Phone size={14} className="shrink-0" />
                <span>☎ Gọi {activePlace.phone}</span>
              </button>
            ) : (
              !isCivicLandmark && (
                <span className="text-[11.5px] text-slate-400 px-2 py-1">Chưa có SĐT</span>
              )
            )}
          </div>

          {/* 3 TỌA ĐỘ TRỌNG YẾU (Hoặc Thông tin Dịch vụ cho Quán Vui chơi / Dịch vụ - Mục 27) */}
          {!isCivicLandmark && (
            <div className="golden-coords-grid">
              {/* 1. Loại hình / Dịch vụ hoặc Cự ly */}
              <div className="golden-coord-card">
                <div className="coord-card-head">
                  <MapPin size={15} className="text-amber-400" />
                  <span className="coord-card-label">
                    {isNonFoodVenue ? 'DỊCH VỤ CHÍNH' : 'CỰ LY THỰC TẾ'}
                  </span>
                </div>
                <strong className="coord-card-value">
                  {isNonFoodVenue ? typeBadge : shortDist}
                </strong>
                <span className="coord-card-sub">
                  {isNonFoodVenue
                    ? shortDist
                    : activePlace.zone === 'dhsp2'
                    ? 'Cụm ĐH Sư Phạm Hà Nội 2'
                    : activePlace.zone === 'center'
                    ? 'Khu trung tâm P. Xuân Hòa'
                    : 'Khu vực phụ cận'}
                </span>
              </div>

              {/* 2. Giờ mở cửa / Tiện ích */}
              <div className="golden-coord-card">
                <div className="coord-card-head">
                  <span className="text-amber-400">
                    {isNonFoodVenue ? <Clock size={15} /> : renderAmenityIcon(amenity.id, 16)}
                  </span>
                  <span className="coord-card-label">
                    {isNonFoodVenue ? 'GIỜ HOẠT ĐỘNG' : 'TIỆN ÍCH QUÁN'}
                  </span>
                </div>
                <strong className="coord-card-value" style={{ color: amenity.badgeColor }}>
                  {isNonFoodVenue ? activePlace.openHours || '08:00 - 24:00' : amenity.label}
                </strong>
                <span className="coord-card-sub">
                  {activePlace.serviceMode === 'delivery_only'
                    ? 'Bếp chuyên ship tận nơi'
                    : activePlace.serviceMode === 'both'
                    ? 'Phục vụ tại chỗ & ship'
                    : 'Phục vụ trực tiếp tại chỗ'}
                </span>
              </div>

              {/* 3. Giá / Tầm giá */}
              <div className="golden-coord-card">
                <div className="coord-card-head">
                  <DollarSign size={15} className="text-emerald-400" />
                  <span className="coord-card-label">
                    {isNonFoodVenue ? 'MỨC GIÁ' : 'TẦM GIÁ / NGƯỜI'}
                  </span>
                </div>
                <strong className="coord-card-value text-amber-300">
                  {isNonFoodVenue ? activePlace.priceRange || perPerson : perPerson}
                </strong>
                <span className="coord-card-sub">Niêm yết: {activePlace.priceRange}</span>
              </div>
            </div>
          )}

          {/* HÌNH ẢNH BẢNG GIÁ VÉ & MENU THỰC TẾ CỦA HAPPI KID */}
          {(activePlace.id === 'khu-vui-choi-happi-kid' ||
            activePlace.id === 'happi-kid-coffee') && (
            <div className="mt-3 mb-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/25">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  Bảng Giá Vé Khu Vui Chơi &amp; Menu Thực Tế Happi Kid
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Combo Vé + Trà sữa chỉ +19k
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <a
                  href="/happi_kid_ticket_real.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block rounded-lg overflow-hidden border border-white/15 bg-black/40"
                >
                  <img
                    src="/happi_kid_ticket_real.jpg"
                    alt="Bảng Giá Vé Khu Vui Chơi Happi Kid"
                    loading="lazy"
                    className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="p-1.5 text-center bg-black/75 text-[11px] font-semibold text-amber-200">
                    🎈 Bảng Giá Vé Happi Kid (T2: 39k | Thường: 55k | Cuối tuần: 65k)
                  </div>
                </a>
                <a
                  href="/happi_kid_menu_real.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block rounded-lg overflow-hidden border border-white/15 bg-black/40"
                >
                  <img
                    src="/happi_kid_menu_real.jpg"
                    alt="Menu Đồ Uống Happi Kid Coffee"
                    loading="lazy"
                    className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="p-1.5 text-center bg-black/75 text-[11px] font-semibold text-amber-200">
                    🧋 Menu Đồ Uống &amp; Cà Phê Phin Phê Happi Kid Coffee
                  </div>
                </a>
              </div>
            </div>
          )}

          {/* ==============================================================
              TRONG QUÁN CÓ GÌ? (MỤC 28)
              Search trong quán: "Tìm món trong quán…"
              Filter: [ Ăn ] [ Nhậu ] [ Uống ]
              Danh sách món / dịch vụ + giá
              ============================================================== */}
          {!isCivicLandmark && safeMenu.length > 0 && (
            <div className="golden-menu-dropdown mt-3">
              <div className="flex flex-col gap-2.5 pb-3 border-b border-white/10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed size={14} className="text-amber-400" />
                    <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                      {isNonFoodVenue
                        ? `Bảng Dịch Vụ & Giá Niêm Yết (${displayMenu.length})`
                        : `Trong quán có gì? (${displayMenu.length}/${safeMenu.length} món)`}
                    </span>
                  </div>

                  {/* Filter [ Ăn ] [ Nhậu ] [ Uống ] cho quán ăn/uống (Mục 28) */}
                  {!isNonFoodVenue && (
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: 'all', label: 'Tất cả', show: true },
                          { id: 'an', label: 'Ăn', show: availableMenuCategories.an > 0 },
                          { id: 'nhau', label: 'Nhậu', show: availableMenuCategories.nhau > 0 },
                          { id: 'uong', label: 'Uống', show: availableMenuCategories.uong > 0 },
                        ] as const
                      )
                        .filter((tab) => tab.show)
                        .map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setMenuFilter(tab.id)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer"
                            style={{
                              background:
                                menuFilter === tab.id
                                  ? 'rgba(229, 184, 92, 0.22)'
                                  : 'rgba(255, 255, 255, 0.05)',
                              border:
                                menuFilter === tab.id
                                  ? '1px solid rgba(229, 184, 92, 0.55)'
                                  : '1px solid rgba(255, 255, 255, 0.1)',
                              color: menuFilter === tab.id ? '#F4CE74' : '#9CA3AF',
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Search trong quán: "Tìm món trong quán…" */}
                <div className="golden-menu-search w-full">
                  <Search size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder={
                      isNonFoodVenue ? 'Tìm dịch vụ trong quán…' : 'Tìm món trong quán…'
                    }
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="golden-menu-search-input w-full"
                  />
                  {menuSearch && (
                    <button
                      type="button"
                      onClick={() => setMenuSearch('')}
                      className="text-slate-400 hover:text-white text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="golden-menu-list mt-2">
                {displayMenu.map((item) => (
                  <div key={item.id} className="golden-menu-row">
                    <div className="golden-menu-row-left">
                      <span className="golden-menu-dish-name">
                        {formatTypography(cleanDishDisplayTitle(item.name))}
                      </span>
                      {item.tag && <span className="golden-menu-dish-tag">{item.tag}</span>}
                      {item.serviceTag === 'ship' && (
                        <span className="dish-service-tag ship text-[10px] py-0.5 px-1.5 inline-flex items-center gap-1">
                          <Bike size={10} className="text-sky-400" /> Ship
                        </span>
                      )}
                      {item.serviceTag === 'both' && (
                        <span className="dish-service-tag both text-[10px] py-0.5 px-1.5 inline-flex items-center gap-1">
                          <Bike size={10} className="text-sky-400" /> Ship &amp; Quán
                        </span>
                      )}
                      {item.serviceTag === 'dine_in' && (
                        <span className="dish-service-tag dine text-[10px] py-0.5 px-1.5 inline-flex items-center gap-1">
                          <UtensilsCrossed size={10} className="text-amber-400" /> Tại chỗ
                        </span>
                      )}
                      {item.description && (
                        <p className="golden-menu-dish-desc">{item.description}</p>
                      )}
                    </div>
                    {item.price > 0 && (
                      <strong className="golden-menu-dish-price">{item.price}.000đ</strong>
                    )}
                  </div>
                ))}
                {displayMenu.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    Không tìm thấy kết quả phù hợp với &ldquo;{menuSearch}&rdquo;.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nút Góp Ý & Feedback */}
          {!isCivicLandmark && (
            <div className="mt-3">
              <button
                type="button"
                className={`golden-grid-btn feedback-toggle-btn w-full justify-center ${
                  isReviewOpen ? 'active' : ''
                }`}
                onClick={() => setIsReviewOpen(!isReviewOpen)}
              >
                <MessageSquare size={15} className="shrink-0" />
                <span className="truncate">
                  {isReviewOpen ? 'Đóng Góp Ý' : `Góp Ý & Đánh Giá Thực Khách (${reviews.length})`}
                </span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform duration-200 ${
                    isReviewOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          )}

          {/* KHU VỰC ĐÁNH GIÁ & GÓP Ý QUÁN */}
          {isReviewOpen && (
            <div className="golden-menu-dropdown animate-fadeIn place-reviews-dropdown mt-2">
              <div className="golden-menu-header">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-amber-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                    Góp Ý &amp; Đánh Giá Cho Quán ({reviews.length})
                  </span>
                </div>
              </div>

              {!authUser || !authUser.isLoggedIn ? (
                <div className="guest-review-gate-box">
                  <p className="guest-review-gate-text">
                    🔒 Đăng nhập tài khoản Google để gửi nhận xét, bình chọn sao và tải ảnh
                    feedback trực tiếp cho quán nhé!
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

                  <div className="quick-tags-picker">
                    <span className="quick-tags-label">Cảm nhận nhanh:</span>
                    <div className="quick-tags-list">
                      {QUICK_PLACE_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={`quick-tag-chip ${
                            selectedTags.includes(tag) ? 'active' : ''
                          }`}
                          onClick={() => handleToggleTag(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    className="place-review-textarea"
                    placeholder="Nhận xét hương vị, chất lượng phục vụ để feedback cho quán..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    maxLength={300}
                    required
                  />

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
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="place-review-form-footer">
                    <button
                      type="submit"
                      className="place-review-submit-btn w-full justify-center"
                    >
                      <Send size={13} />
                      <span>Gửi Góp Ý Cho Quán</span>
                    </button>
                  </div>

                  {reviewSuccess && (
                    <div className="place-review-success-msg">
                      ✓ Đã gửi đánh giá thành công! Cảm ơn bạn đã đóng góp cho Xuân Hòa.
                    </div>
                  )}
                </form>
              )}

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
                          <div className="review-card-stars">
                            {'★'.repeat(rev.rating || 5)}
                          </div>
                          <span className="review-card-meta-dot">·</span>
                          <span className="review-card-date">{rev.date}</span>
                        </div>
                      </div>
                    </div>
                    {rev.tags && rev.tags.length > 0 && (
                      <div className="review-card-tags-row">
                        {rev.tags.map((t) => (
                          <span key={t} className="review-card-tag-pill">
                            {t}
                          </span>
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
                    Chưa có đánh giá nào. Hãy là người đầu tiên gửi feedback nhé!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GHI CHÚ GIAO HÀNG & PHỤC VỤ */}
          {activePlace.deliveryNote && (
            <div className="modal-delivery-notice golden-delivery-notice mt-3">
              <span className="notice-icon">
                <Bike size={15} className="text-sky-400" />
              </span>
              <span className="notice-text">{activePlace.deliveryNote}</span>
            </div>
          )}
        </div>

        {/* STICKY BOTTOM ACTION BAR (Mục 18, 19, 20): Luôn hiển thị Bản đồ số / Google Maps / Gọi điện */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 25,
            padding: '10px 14px',
            background: 'rgba(13, 17, 25, 0.96)',
            borderTop: '1px solid rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <MapActionButtons
            place={activePlace}
            compact
            onOpenInternalMap={() => onClose()}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            {activePlace.phone && (
              <button
                type="button"
                onClick={handleCall}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 11px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.16)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  color: '#34D399',
                  cursor: 'pointer',
                }}
              >
                <Phone size={12} />
                <span>☎ Gọi</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#CBD5E1',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
