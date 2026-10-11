import React, { useState, useMemo } from 'react';
import { Food } from '@/lib/foods';
import { FoodImage } from './FoodImage';
import { getSpotsForDish } from '@/lib/dish-places';
import { getExpForRarity } from '@/lib/user-exp';
import { Share2, Check, MapPin, Phone, Navigation, X, Sparkles, Zap, Bike, UtensilsCrossed } from 'lucide-react';
import { formatTypography, cleanDishDisplayTitle } from '@/lib/utils';

interface WinnerDialogProps {
  food: Food | null;
  isOpen: boolean;
  onClose: () => void;
  onSpinAgain?: () => void;
  allActiveFoods?: Food[];
  onSelectFood?: (food: Food) => void;
}

const rarityLabels = [
  'PHẨM CẤP · PHỔ THÔNG',
  'PHẨM CẤP · ĐẶC BIỆT',
  'PHẨM CẤP · QUÝ HIẾM',
  'PHẨM CẤP · CỰC HIẾM',
  'PHẨM CẤP · HUYỀN THOẠI',
];

const rarityColors = ['#10B981', '#F59E0B', '#A855F7', '#F97316', '#EF4444'];

export function WinnerDialog({ 
  food, 
  isOpen, 
  onClose, 
}: WinnerDialogProps) {
  if (!food || !isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [selectedSpotIndex, setSelectedSpotIndex] = useState(0);
  const spots = useMemo(() => (food ? getSpotsForDish(food) : []), [food]);
  const spot = spots[selectedSpotIndex] || spots[0];

  React.useEffect(() => {
    setSelectedSpotIndex(0);
  }, [food]);

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

        {/* Thưởng EXP theo cấp độ mở hòm */}
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
                <strong>JACKPOT: +80 EXP (NỔ HŨ HUYỀN THOẠI)</strong>
              </>
            ) : (
              <>
                <Zap size={11} className="inline mr-1" />
                {expReward.label}
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

        {/* Thông tin ĐÚNG QUÁN BÁN MÓN NÀY */}
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

            {/* Địa chỉ & Hotline */}
            <div className="restaurant-meta-center">
              <div className="restaurant-address">
                <MapPin size={13} className="text-amber-400 shrink-0" />
                <span>{formatTypography(spot.address)}</span>
              </div>
              {spot.phone && (
                <div className="restaurant-phone">
                  <Phone size={13} className="text-emerald-400 shrink-0" />
                  <span>Hotline / Đặt món: <strong>{spot.phone}</strong></span>
                </div>
              )}
              {spot.deliveryNote && (
                <div className="text-xs text-sky-300/90 mt-1 text-center font-medium flex items-center justify-center gap-1.5">
                  <Bike size={13} className="text-sky-400 shrink-0" />
                  <span>{spot.deliveryNote}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3 Nút thao tác: Google Maps, Gọi Quán (ĐÚNG 1 ICON PHONE), Chia Sẻ */}
        {spot && (
          <div className="winner-actions-trio">
            {/* Google Maps Chỉ Đường */}
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
              {/* Gọi điện quán - Vector icon Phone, cân đối không bao giờ rớt dòng số điện thoại */}
              {spot.phone && (
                <a
                  href={`tel:${spot.phone.replace(/\s+/g, '')}`}
                  className={`action-btn-secondary ${spot.serviceMode === 'delivery_only' ? 'delivery-btn' : 'call'} flex-1 min-w-0`}
                  title={`${spot.serviceMode === 'delivery_only' ? 'Đặt Ship' : 'Gọi Quán'}: ${spot.phone}`}
                >
                  <Phone size={14} className="shrink-0 text-amber-400" />
                  <span className="truncate whitespace-nowrap text-xs font-semibold">
                    {spot.serviceMode === 'delivery_only' ? 'Đặt Ship' : 'Gọi Quán'}: <span className="font-mono text-amber-300 font-bold whitespace-nowrap">{spot.phone}</span>
                  </span>
                </a>
              )}

              {/* Chia sẻ */}
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
      </div>
    </div>
  );
}
