import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Food } from '@/lib/foods';
import { FoodImage } from './FoodImage';
import { getSpotsForDish } from '@/lib/dish-places';
import { getExpForRarity } from '@/lib/user-exp';
import { 
  Share2, Check, MapPin, Phone, Navigation, X, Sparkles, Zap, Bike, 
  UtensilsCrossed, MessageSquare, Send, Star, ChevronDown, Camera, Image as ImageIcon, Edit3 
} from 'lucide-react';
import { formatTypography, cleanDishDisplayTitle } from '@/lib/utils';
import { UserAuthProfile } from '@/lib/auth';
import { GoogleGIcon } from './GoogleGIcon';
import { getLocalDishReviews, saveLocalDishReview, DishReview } from '@/lib/reviews-storage';

interface WinnerDialogProps {
  food: Food | null;
  isOpen: boolean;
  onClose: () => void;
  onSpinAgain?: () => void;
  allActiveFoods?: Food[];
  onSelectFood?: (food: Food) => void;
  authUser?: UserAuthProfile | null;
  onOpenLogin?: () => void;
}

const rarityLabels = [
  'PHẨM CẤP · PHỔ THÔNG',
  'PHẨM CẤP · ĐẶC BIỆT',
  'PHẨM CẤP · QUÝ HIẾM',
  'PHẨM CẤP · CỰC HIẾM',
  'PHẨM CẤP · HUYỀN THOẠI',
];

const rarityColors = ['#10B981', '#F59E0B', '#A855F7', '#F97316', '#EF4444'];

const QUICK_DISH_TAGS = [
  '🤤 Đậm đà chuẩn vị',
  '🍲 Đầy đặn no căng',
  '🔥 Nóng hổi thơm lừng',
  '💸 Giá sinh viên',
  '🥓 Topping ngập tràn',
  '🌿 Nguyên liệu tươi sạch',
];

const RATING_LABELS: Record<number, string> = {
  5: 'Cực kỳ xuất sắc (5/5)',
  4: 'Rất ngon & vừa miệng (4/5)',
  3: 'Bình thường, tạm ổn (3/5)',
  2: 'Chưa hợp vị lắm (2/5)',
  1: 'Cần cải thiện (1/5)',
};

export function WinnerDialog({ 
  food, 
  isOpen, 
  onClose,
  authUser,
  onOpenLogin,
}: WinnerDialogProps) {
  if (!food || !isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [selectedSpotIndex, setSelectedSpotIndex] = useState(0);
  const spots = useMemo(() => (food ? getSpotsForDish(food) : []), [food]);
  const spot = spots[selectedSpotIndex] || spots[0];

  // Dish Reviews State
  const foodKey = food.customId || `${food.name}-${food.price}`;
  const [reviews, setReviews] = useState<DishReview[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newPhoto, setNewPhoto] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avgRating = useMemo(() => {
    if (!reviews.length) return '5.0';
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  useEffect(() => {
    setSelectedSpotIndex(0);
    setIsReviewOpen(false);
    if (foodKey) {
      setReviews(getLocalDishReviews(foodKey));
    }
  }, [foodKey]);

  const handleShare = async () => {
    const dishTitle = cleanDishDisplayTitle(food.name);
    const text = spot 
      ? `Hôm nay mình quay trúng món: ${dishTitle} (${food.price}.000đ) tại ${spot.name} ở Xuân Hòa! Cùng thử tại: ${window.location.href}`
      : `Hôm nay mình quay trúng món: ${dishTitle} (${food.price}.000đ) ở Xuân Hòa! Cùng thử tại: ${window.location.href}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Xuân Hòa Có Gì', text, url: window.location.href });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

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
        // Nén ảnh nhẹ nhàng trên Canvas để không tốn bộ nhớ
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
    if (!newComment.trim() || !food) return;
    if (!authUser || !authUser.isLoggedIn) {
      onOpenLogin?.();
      return;
    }

    const created = saveLocalDishReview(foodKey, {
      foodId: foodKey,
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
    setIsFormOpen(false);
    setTimeout(() => setReviewSuccess(false), 4000);
  };

  const rarityName = rarityLabels[food.rarity] || rarityLabels[0];
  const rarityColor = rarityColors[food.rarity] || '#D4AF37';
  const expReward = getExpForRarity(food.rarity);

  return (
    <div className="winner-backdrop" onClick={onClose}>
      <div 
        className="winner-card-container winner-case-opening" 
        onClick={e => e.stopPropagation()}
        style={{
          boxShadow: `0 0 60px rgba(0, 0, 0, 0.95), 0 0 35px ${rarityColor}35`,
          borderColor: `${rarityColor}66`
        }}
      >
        {/* Nút đóng X góc trên */}
        <button 
          className="winner-close-btn" 
          onClick={onClose} 
          aria-label="Đóng"
          title="Đóng"
        >
          <X size={18} />
        </button>

        {/* Top rarity & tag - Chuẩn chất mở hòm */}
        <div 
          className="winner-header-tag" 
          style={{ 
            color: rarityColor,
            textShadow: `0 0 12px ${rarityColor}88`
          }}
        >
          <Sparkles size={13} className="inline mr-1" />
          {rarityName}
        </div>

        {/* Tên Món */}
        <h2 className="winner-dish-title">{formatTypography(cleanDishDisplayTitle(food.name))}</h2>

        {/* Giá tham khảo */}
        <div className="winner-price-row">
          <span>Giá tham khảo · <strong>{food.price}.000đ</strong> / người</span>
        </div>

        {/* Thưởng Cấp độ / Bộ sưu tập món ăn */}
        <div className="winner-exp-badge-wrap">
          <span 
            className={`winner-exp-chip ${expReward.isJackpot ? 'jackpot' : ''}`}
            style={{ 
              borderColor: `${expReward.color}80`, 
              color: expReward.color,
              boxShadow: expReward.isJackpot ? `0 0 15px ${expReward.color}60` : undefined
            }}
          >
            {expReward.isJackpot ? (
              <>
                <Sparkles size={12} className="inline mr-1 text-amber-300 animate-spin" />
                <strong>JACKPOT: +1 MÓN HUYỀN THOẠI</strong>
              </>
            ) : (
              <>
                <Zap size={11} className="inline mr-1" />
                +1 Món Vào Bộ Sưu Tập Thực Khách
              </>
            )}
          </span>
        </div>

        {/* Ảnh món ăn trung tâm - Khung tròn glow đúng chất mở hòm */}
        <div className="winner-food-art-wrap">
          <div 
            className="winner-art-halo" 
            style={{ 
              background: `radial-gradient(circle, ${rarityColor}45 0%, ${rarityColor}15 50%, transparent 70%)` 
            }} 
          />
          <div 
            className="winner-food-frame"
            style={{
              borderColor: rarityColor,
              boxShadow: `0 0 25px ${rarityColor}55, 0 8px 24px rgba(0,0,0,0.8)`
            }}
          >
            <FoodImage food={food} size="xl" />
          </div>
        </div>

        {/* Lời bình món nếu có */}
        {food.quip && (
          <p className="winner-quip">
            "{food.quip}"
          </p>
        )}

        {/* Ghi chú minh họa */}
        <p className="winner-illustration-note">
          * Lưu ý: Hình ảnh mang tính chất minh họa cho món ăn. Quý khách vui lòng liên hệ quán để đặt món.
        </p>

        {/* ==============================================================
            PHÂN BIỆT KHÁCH VÃNG LAI VS ĐÃ ĐĂNG NHẬP
            Khách vãng lai: Khóa thông tin quán & địa chỉ, chỉ cho quay
            Đã đăng nhập: Mở khóa đầy đủ quán, hotline, Google Maps & Đánh giá
            ============================================================== */}
        {!authUser || !authUser.isLoggedIn ? (
          <div className="guest-spot-lock-card">
            <div className="lock-icon-badge">🔒</div>
            <h4 className="lock-title">Món này của quán nào tại Xuân Hòa?</h4>
            <p className="lock-desc">
              Bạn đang ở chế độ <strong>Khách Vãng Lai</strong> (chỉ trải nghiệm quay thử). Hãy đăng nhập tài khoản Google để mở khóa xem quán bán, hotline đặt ship &amp; chỉ đường Google Maps nhé!
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
              <span>Đăng nhập để xem Quán &amp; Địa chỉ</span>
            </button>
          </div>
        ) : (
          <>
            {/* THÔNG TIN QUÁN (Dành cho người đã đăng nhập) */}
            {spot && (
              <div className="winner-restaurant-box">
                {spots.length > 1 && (
                  <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                      Có tại <strong>{spots.length} quán</strong> ở Xuân Hòa · Bấm để chọn quán:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                      {spots.map((s, idx) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => setSelectedSpotIndex(idx)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: idx === selectedSpotIndex ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                            color: idx === selectedSpotIndex ? '#fde047' : '#cbd5e1',
                            border: idx === selectedSpotIndex ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          {s.name.split(' - ')[0].split(' • ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="restaurant-badges-center">
                  <span className={`restaurant-badge ${spot.verified ? 'verified' : ''}`}>
                    {spot.verified ? '★ ĐỐI TÁC XÁC THỰC' : 'ĐỊA ĐIỂM GỢI Ý'}
                  </span>
                  {spot.serviceMode === 'delivery_only' ? (
                    <span className="winner-spot-badge delivery inline-flex items-center gap-1">
                      <Bike size={12} className="text-sky-400" />
                      <span>{spot.deliveryNote?.includes('2h') ? 'Freeship Từ 1 Cốc Tới 2h Sáng' : 'Chuyên Ship Quanh XuHo'}</span>
                    </span>
                  ) : spot.serviceMode === 'dine_in_only' ? (
                    <span className="winner-spot-badge dine inline-flex items-center gap-1">
                      <UtensilsCrossed size={12} className="text-amber-400" />
                      <span>Phục Vụ Tại Quán</span>
                    </span>
                  ) : (
                    <span className="winner-spot-badge both inline-flex items-center gap-1">
                      <Bike size={12} className="text-sky-400" />
                      <span>Có Ship & Phục Vụ Tại Quán</span>
                    </span>
                  )}
                </div>

                {/* Tên Quán */}
                <h4 className="restaurant-name-centered">{formatTypography(spot.name)}</h4>

                {/* Địa chỉ & Tiện ích Ship */}
                <div className="restaurant-meta-center">
                  <div className="restaurant-address">
                    <MapPin size={13} className="text-amber-400 shrink-0" />
                    <span>{formatTypography(spot.address)}</span>
                  </div>
                  {spot.deliveryNote && (
                    <div className="text-xs text-sky-300/90 mt-1 text-center font-medium flex items-center justify-center gap-1.5">
                      <Bike size={13} className="text-sky-400 shrink-0" />
                      <span>
                        {spot.deliveryNote.replace(/[·•-]?\s*(Hotline|SĐT|ĐT|Liên hệ)[\s:]*([0-9\s.-]+)/gi, '').trim()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3 Nút thao tác: Google Maps, Gọi Quán, Chia Sẻ */}
            {spot && (
              <div className="winner-actions-trio">
                <a
                  href={spot.mapsUrl || (spot.mapsQuery && spot.mapsQuery.startsWith('http') ? spot.mapsQuery : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.mapsQuery || spot.name + ' Xuân Hòa')}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="action-btn-primary maps"
                >
                  <Navigation size={16} />
                  <span>Chỉ đường Google Maps</span>
                </a>

                <div className="flex gap-2 w-full">
                  {spot.phone && (
                    <a
                      href={`tel:${spot.phone.split(/[-·,/]/)[0].replace(/[^0-9]/g, '')}`}
                      className={`action-btn-secondary ${spot.serviceMode === 'delivery_only' ? 'delivery-btn' : 'call'} flex-1 min-w-0`}
                      title={`${spot.serviceMode === 'delivery_only' ? 'Đặt Ship' : 'Gọi Quán'}: ${spot.phone}`}
                    >
                      <Phone size={14} className="shrink-0 text-amber-400" />
                      <span className="truncate whitespace-nowrap text-xs font-semibold">
                        {spot.serviceMode === 'delivery_only' ? 'Đặt Ship' : 'Gọi Quán'}: <span className="font-mono text-amber-300 font-bold whitespace-nowrap">{spot.phone}</span>
                      </span>
                    </a>
                  )}

                  <button 
                    className="action-btn-secondary share shrink-0 px-3.5" 
                    onClick={handleShare}
                    title="Sao chép liên kết chia sẻ"
                  >
                    {copied ? <Check size={14} className="text-emerald-400 shrink-0" /> : <Share2 size={14} className="shrink-0" />}
                    <span className="whitespace-nowrap">{copied ? 'Đã sao chép' : 'Chia sẻ'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* HỆ THỐNG ĐÁNH GIÁ MÓN ĂN CHUẨN MỰC - CÂN ĐỐI TUYỆT ĐỐI */}
            <div className="dish-review-section-wrap">
              <button
                type="button"
                className={`dish-review-toggle-btn ${isReviewOpen ? 'active' : ''}`}
                onClick={() => setIsReviewOpen(!isReviewOpen)}
              >
                <div className="flex items-center gap-2">
                  <Star size={15} className="text-amber-400 fill-amber-400" />
                  <span className="font-bold text-white text-[13px]">Đánh Giá Thực Khách</span>
                  <span className="dish-review-count-badge">
                    {reviews.length > 0 ? `⭐ ${avgRating} (${reviews.length})` : '⭐ Chưa có đánh giá (0)'}
                  </span>
                </div>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isReviewOpen ? 'rotate-180' : ''}`} />
              </button>

              {isReviewOpen && (
                <div className="dish-reviews-dropdown animate-fadeIn">
                  {/* 1. THANH TỔNG QUAN ĐIỂM SỐ CÂN ĐỐI */}
                  <div className="review-system-header">
                    {reviews.length === 0 ? (
                      <div className="review-stat-summary">
                        <div className="review-score-big">5.0</div>
                        <div className="review-stars-col">
                          <div className="review-stars-row">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} size={14} className="text-amber-400 fill-amber-400" />
                            ))}
                          </div>
                          <div className="review-meta-text">
                            <span className="review-meta-count">0 nhận xét thực tế</span>
                            <span className="review-meta-bullet">·</span>
                            <span className="text-amber-300 font-medium">Chờ bạn đánh giá</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="review-stat-summary">
                        <div className="review-score-big">{avgRating}</div>
                        <div className="review-stars-col">
                          <div className="review-stars-row">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star 
                                key={s} 
                                size={14} 
                                className={s <= Math.round(Number(avgRating)) ? "text-amber-400 fill-amber-400" : "text-slate-600"} 
                              />
                            ))}
                          </div>
                          <div className="review-meta-text">
                            <span className="review-meta-count">{reviews.length} nhận xét thực tế</span>
                            <span className="review-meta-bullet">·</span>
                            <span className="review-meta-satisfaction">100% hài lòng</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`review-write-cta-btn ${isFormOpen ? 'active' : ''}`}
                      onClick={() => {
                        if (!authUser || !authUser.isLoggedIn) {
                          onOpenLogin?.();
                          return;
                        }
                        setIsFormOpen(!isFormOpen);
                      }}
                    >
                      {isFormOpen ? (
                        <>
                          <X size={13} />
                          <span>Đóng Form</span>
                        </>
                      ) : (
                        <>
                          <Edit3 size={13} />
                          <span>Viết Đánh Giá</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 2. FORM VIẾT ĐÁNH GIÁ (GỌN GÀNG, CÂN ĐỐI, ĐẲNG CẤP) */}
                  {isFormOpen && (
                    <form onSubmit={handleSubmitReview} className="review-editor-form animate-fadeIn">
                      {/* Hàng 1: User & Rating Picker */}
                      <div className="review-editor-top">
                        <div className="review-user-badge">
                          <span className="review-user-avatar">{authUser?.avatar || '👤'}</span>
                          <span className="review-user-name">{authUser?.nickname || authUser?.displayName || 'Thực khách'}</span>
                          <span className="review-verified-pill">✓ Đã ăn món</span>
                        </div>

                        <div className="review-star-picker-wrap">
                          <div className="review-star-picker">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setNewRating(star)}
                                className={`review-star-btn ${star <= newRating ? 'active' : ''}`}
                                title={`${star} sao`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                          <span className="review-rating-hint">{RATING_LABELS[newRating]}</span>
                        </div>
                      </div>

                      {/* Hàng 2: Quick tags */}
                      <div className="review-quick-tags-section">
                        <span className="review-section-subtitle">Cảm nhận nhanh:</span>
                        <div className="review-quick-tags-wrap">
                          {QUICK_DISH_TAGS.map((tag) => {
                            const isSelected = selectedTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                className={`review-quick-tag-chip ${isSelected ? 'active' : ''}`}
                                onClick={() => handleToggleTag(tag)}
                              >
                                <span>{tag}</span>
                                {isSelected && <Check size={11} strokeWidth={3} className="ml-1 text-amber-400 inline" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hàng 3: Textarea */}
                      <textarea
                        className="review-textarea"
                        placeholder="Cảm nhận thực tế của bạn về hương vị, độ ngon và khẩu phần món ăn này..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={2}
                        maxLength={300}
                        required
                      />

                      {/* Hàng 4: Actions (Ảnh + Submit) */}
                      <div className="review-editor-actions">
                        <div className="review-upload-col">
                          <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleFileUpload} 
                          />
                          <button
                            type="button"
                            className="review-photo-btn"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Camera size={13} />
                            <span>{newPhoto ? 'Đổi ảnh chụp' : 'Đính kèm ảnh thực tế'}</span>
                          </button>

                          {newPhoto && (
                            <div className="review-photo-preview">
                              <img src={newPhoto} alt="Xem trước" />
                              <button 
                                type="button" 
                                className="review-remove-photo-btn"
                                onClick={() => setNewPhoto('')}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>

                        <button type="submit" className="review-submit-cta">
                          <Send size={13} />
                          <span>Gửi Đánh Giá</span>
                        </button>
                      </div>

                      {reviewSuccess && (
                        <div className="review-success-banner">
                          ✓ Đã đăng đánh giá món ăn thành công! Cảm ơn nhận xét của bạn.
                        </div>
                      )}
                    </form>
                  )}

                  {/* 3. DANH SÁCH NHẬN XÉT THỰC TẾ - CÂN ĐỐI TUYỆT ĐỐI */}
                  <div className="review-cards-feed">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="review-card-item">
                        <div className="review-card-header">
                          <div className="review-card-avatar-wrap">
                            <span>{rev.avatar || '👤'}</span>
                          </div>
                          <div className="review-card-main-col">
                            <div className="review-card-author-row">
                              <span className="review-card-author-name">{rev.author}</span>
                              {rev.isVerified && (
                                <span className="review-card-verified-tag">✓ Đã thử</span>
                              )}
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

                        {/* TAGS RIÊNG BIỆT - KHÔNG BAO GIỜ BỊ DÍNH CHỮ */}
                        {rev.tags && rev.tags.length > 0 && (
                          <div className="review-card-tags-row">
                            {rev.tags.map((t) => (
                              <span key={t} className="review-card-tag-pill">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="review-card-text">{rev.content}</p>

                        {rev.photo && (
                          <div className="review-card-photo-wrap">
                            <img src={rev.photo} alt="Ảnh thực tế món ăn" className="review-card-photo" />
                          </div>
                        )}
                      </div>
                    ))}

                    {reviews.length === 0 && (
                      <div className="review-empty-state">
                        Chưa có nhận xét nào cho món này. Hãy bấm &ldquo;Viết Đánh Giá&rdquo; để là người đầu tiên chia sẻ cảm nhận nhé!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
