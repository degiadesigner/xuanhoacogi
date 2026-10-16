'use client';

import React, { useEffect, useState } from 'react';
import { 
  X, 
  Sparkles, 
  Award, 
  Lock, 
  CheckCircle2, 
  Zap, 
  ArrowRight, 
  Trophy,
  ChevronDown,
  ChevronUp,
  BookOpen,
  UtensilsCrossed,
  Dices,
  MessageSquare,
  Home
} from 'lucide-react';
import { UserGourmetProfile, LEVEL_TIERS, MAX_LEVEL, getMinDishesForLevel } from '../lib/user-exp';
import { UserAuthProfile, getResidentTypeInfo } from '../lib/auth';
import { getUserReviewsStats, UserReviewStats } from '../lib/reviews-storage';
import { GoogleGIcon } from './GoogleGIcon';

interface GourmetScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserGourmetProfile;
  authUser?: UserAuthProfile | null;
  onOpenLogin: () => void;
  onContinueSpinning: () => void;
}

export const TIER_PERKS: Record<string, string> = {
  'Tân Khách Xuân Hòa': 'Trải nghiệm mở hòm ngẫu nhiên · Khách vãng lai tối đa 3 món',
  'Tín Đồ Ăn Vặt': 'Lưu lịch sử món đã ăn không giới hạn · Mở khóa Cấp 2+',
  'Thực Khách Quen Mặt': 'Gửi đánh giá feedback có ảnh chân thực cho các quán ăn',
  'Sành Ăn ĐHSP2': 'Mở khóa bộ sưu tập quán ruột sinh viên & giá ưu đãi',
  'Thổ Địa Quán Xá': 'Mở khóa tọa độ vàng & danh bạ hotline chuẩn xác 100%',
  'Chuyên Gia Ẩm Thực Phúc Yên': 'Huy hiệu chuyên gia thẩm định món ăn độc quyền',
  'Trùm Ẩm Thực Xuân Hòa': 'Vinh danh trên Bảng Vàng Thực Khách toàn hệ thống',
  'Đại Cao Thủ Bếp Vương': 'Đặc quyền đề xuất quán ăn mới vào bản đồ Xuân Hòa',
  'Huyền Thoại Ẩm Thực Phú Thọ': 'Danh hiệu tối thượng · Đỉnh cao sành ăn huyền thoại',
};

export function GourmetScoreboardModal({
  isOpen,
  onClose,
  profile,
  authUser,
  onOpenLogin,
  onContinueSpinning,
}: GourmetScoreboardModalProps) {
  // 1. TẤT CẢ CÁC REACT HOOKS PHẢI ĐƯỢC GỌI Ở ĐẦU COMPONENT (TUYỆT ĐỐI KHÔNG ĐỂ SAU IF EARLY RETURN)
  const [showDetails, setShowDetails] = useState(false);
  const [reviewStats, setReviewStats] = useState<UserReviewStats>({
    placeReviewsCount: 0,
    dishReviewsCount: 0,
    totalReviews: 0,
  });

  useEffect(() => {
    if (isOpen) {
      const stats = getUserReviewsStats(authUser?.nickname);
      setReviewStats(stats);
    }
  }, [isOpen, authUser?.nickname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 2. CHỈ RETURN NULL KHI KHÔNG MỞ, SAU KHI ĐÃ GỌI ĐỦ TẤT CẢ HOOKS
  if (!isOpen) return null;

  const isGuest = !authUser || !authUser.isLoggedIn;
  const dishesNeeded = Math.max(0, profile.nextLevelDishes - profile.dishesCount);
  const expPercent = Math.min(100, Math.max(0, profile.progressPercent || 0));
  const residentInfo = authUser?.residentType ? getResidentTypeInfo(authUser.residentType) : null;

  return (
    <div className="scoreboard-modal-overlay" onClick={onClose}>
      <div 
        className="scoreboard-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Bảng điểm thực khách"
      >
        {/* Nút đóng X góc trên: Trở về màn hình chính */}
        <button 
          type="button" 
          className="scoreboard-close-btn"
          onClick={onClose}
          title="Trở về màn hình chính"
          aria-label="Trở về màn hình chính"
        >
          <X size={18} />
        </button>

        {/* Header Modal */}
        <div className="scoreboard-modal-header">
          <div className="scoreboard-header-icon-wrap">
            <Trophy size={24} className="text-amber-400" />
          </div>
          <div>
            <h2 className="scoreboard-modal-title">BẢNG ĐIỂM THỰC KHÁCH</h2>
            <p className="scoreboard-modal-subtitle">
              Sổ Điểm Ẩm Thực Xuân Hòa · Lộ trình 50 Cấp Độ &amp; 9 Bậc Danh Hiệu Sành Ăn
            </p>
          </div>
        </div>

        {/* THẺ ĐIỂM CÁ NHÂN HIỆN TẠI (SCORECARD HERO) */}
        <div className="scoreboard-hero-card">
          <div className="scoreboard-hero-top">
            <div className="scoreboard-user-info">
              <div className="scoreboard-user-avatar">
                {authUser?.avatar || (isGuest ? '🎒' : '🐱')}
              </div>
              <div className="scoreboard-user-text">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="scoreboard-user-name">
                    {authUser?.nickname || 'Khách Vãng Lai'}
                  </span>
                  {isGuest ? (
                    <span className="scoreboard-guest-badge">Chưa đăng nhập</span>
                  ) : residentInfo ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/35">
                      {residentInfo.emoji} {residentInfo.label}
                    </span>
                  ) : null}
                </div>
                <div className="scoreboard-tier-tag">
                  <span className="text-base mr-1">{profile.badge || '🥉'}</span>
                  <span>CẤP {profile.level}: {profile.title}</span>
                </div>
              </div>
            </div>

            <div className="scoreboard-exp-pill-compact">
              <Sparkles size={14} className="text-amber-400" />
              <span>{profile.dishesCount} / {profile.nextLevelDishes} món ({profile.exp} EXP)</span>
            </div>
          </div>

          {/* Thanh Tiến Trình Điểm Trực Quan (Thanh Kéo Điểm EXP Lớn) */}
          <div className="scoreboard-progress-wrap">
            <div className="scoreboard-progress-track">
              <div 
                className="scoreboard-progress-fill" 
                style={{ width: `${expPercent}%` }}
              />
            </div>
            <div className="scoreboard-progress-labels">
              <span>Cấp {profile.level} ({profile.currentLevelMinDishes} món)</span>
              <span className="text-amber-400 font-extrabold text-xs">{expPercent}% hoàn thành</span>
              <span>Cấp {profile.level < MAX_LEVEL ? profile.level + 1 : MAX_LEVEL} ({profile.nextLevelDishes} món)</span>
            </div>
          </div>

          {/* 4 Chỉ số điểm số & hoạt động nổi bật */}
          <div className="scoreboard-metrics-grid mt-4">
            {/* 1. Món đã khám phá */}
            <div className="scoreboard-metric-box">
              <span className="scoreboard-metric-label flex items-center gap-1">
                <UtensilsCrossed size={12} className="text-amber-400" /> MÓN ĐÃ MỞ
              </span>
              <strong className="scoreboard-metric-val text-amber-300">
                {profile.dishesCount} <small className="text-xs text-slate-400 font-normal">món</small>
              </strong>
              <span className="scoreboard-metric-sub">{profile.exp} EXP tích lũy</span>
            </div>

            {/* 2. Tổng lượt quay đã mở */}
            <div className="scoreboard-metric-box">
              <span className="scoreboard-metric-label flex items-center gap-1">
                <Dices size={12} className="text-sky-400" /> ĐÃ MỞ QUAY
              </span>
              <strong className="scoreboard-metric-val text-sky-300">
                {profile.spinsCount} <small className="text-xs text-slate-400 font-normal">lượt</small>
              </strong>
              <span className="scoreboard-metric-sub">Vòng quay Roulette</span>
            </div>

            {/* 3. Đánh giá đã gửi */}
            <div className="scoreboard-metric-box">
              <span className="scoreboard-metric-label flex items-center gap-1">
                <MessageSquare size={12} className="text-emerald-400" /> ĐÃ ĐÁNH GIÁ
              </span>
              <strong className="scoreboard-metric-val text-emerald-300">
                {reviewStats.totalReviews} <small className="text-xs text-slate-400 font-normal">lượt</small>
              </strong>
              <span className="scoreboard-metric-sub">
                {reviewStats.dishReviewsCount} món · {reviewStats.placeReviewsCount} quán
              </span>
            </div>

            {/* 4. Còn thiếu để lên cấp */}
            <div className="scoreboard-metric-box">
              <span className="scoreboard-metric-label flex items-center gap-1">
                <Award size={12} className="text-purple-400" /> MỤC TIÊU CẤP {profile.level < MAX_LEVEL ? profile.level + 1 : MAX_LEVEL}
              </span>
              <strong className="scoreboard-metric-val text-purple-300">
                {profile.level >= MAX_LEVEL ? 'MAX' : `${dishesNeeded}`} <small className="text-xs text-slate-400 font-normal">{profile.level >= MAX_LEVEL ? '' : 'món'}</small>
              </strong>
              <span className="scoreboard-metric-sub">
                {profile.level >= MAX_LEVEL ? 'Đỉnh cao danh hiệu' : `để lên Cấp ${profile.level + 1}`}
              </span>
            </div>
          </div>

          {/* Cảnh báo khách vãng lai nếu chưa đăng nhập */}
          {isGuest && (
            <div className="scoreboard-guest-banner">
              <div className="scoreboard-guest-banner-left">
                <span className="text-amber-400 text-lg mr-2">⚠️</span>
                <span>
                  Khách vãng lai tối đa <strong>Cấp 1 (3/3 món)</strong>. Đăng nhập Google để lưu trữ không giới hạn và nhận huy hiệu danh giá!
                </span>
              </div>
              <button 
                type="button" 
                className="scoreboard-guest-login-btn"
                onClick={() => {
                  onClose();
                  onOpenLogin();
                }}
              >
                <GoogleGIcon size={14} />
                <span>Đăng nhập</span>
              </button>
            </div>
          )}
        </div>

        {/* NÚT BẬT/TẮT HƯỚNG DẪN & CHI TIẾT TÍNH ĐIỂM */}
        <div className="scoreboard-toggle-wrap">
          <button
            type="button"
            className={`scoreboard-toggle-details-btn ${showDetails ? 'expanded' : ''}`}
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
          >
            <div className="scoreboard-toggle-btn-left">
              <BookOpen size={16} className="text-amber-400" />
              <span className="font-bold">
                {showDetails ? 'Ẩn bớt hướng dẫn & chi tiết' : 'Xem chi tiết các thông số & quy tắc tính điểm EXP'}
              </span>
            </div>
            <div className="scoreboard-toggle-btn-right">
              {showDetails ? (
                <ChevronUp size={18} className="text-amber-400" />
              ) : (
                <ChevronDown size={18} className="text-amber-400" />
              )}
            </div>
          </button>
        </div>

        {/* PHẦN CHI TIẾT MỞ RỘNG: THỐNG KÊ HOẠT ĐỘNG + HƯỚNG DẪN TÍCH LŨY EXP + LỘ TRÌNH 9 BẬC */}
        {showDetails && (
          <div className="scoreboard-details-expand-wrap">
            {/* 1. THỐNG KÊ CHI TIẾT CÁC HOẠT ĐỘNG CỦA TÀI KHOẢN */}
            <div className="scoreboard-exp-rules-card">
              <div className="scoreboard-exp-rules-header">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed size={16} className="text-amber-400" />
                  <h4 className="scoreboard-exp-rules-title">THỐNG KÊ HOẠT ĐỘNG ẨM THỰC THỰC TẾ</h4>
                </div>
                <span className="scoreboard-exp-rules-badge">Chi tiết tài khoản</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center py-2">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-xs text-slate-400">Món trong bộ sưu tập</div>
                  <div className="text-base font-extrabold text-amber-300 font-mono mt-0.5">{profile.dishesCount} món</div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-xs text-slate-400">Lượt quay Roulette</div>
                  <div className="text-base font-extrabold text-sky-300 font-mono mt-0.5">{profile.spinsCount} lần</div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-xs text-slate-400">Đánh giá món ăn</div>
                  <div className="text-base font-extrabold text-emerald-300 font-mono mt-0.5">{reviewStats.dishReviewsCount} bài</div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-xs text-slate-400">Nhận xét quán ăn</div>
                  <div className="text-base font-extrabold text-purple-300 font-mono mt-0.5">{reviewStats.placeReviewsCount} quán</div>
                </div>
              </div>
            </div>

            {/* 2. HƯỚNG DẪN TÍCH LŨY ĐIỂM (EXP) */}
            <div className="scoreboard-exp-rules-card">
              <div className="scoreboard-exp-rules-header">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-400" />
                  <h4 className="scoreboard-exp-rules-title">QUY TẮC TÍCH LŨY ĐIỂM (EXP)</h4>
                </div>
                <span className="scoreboard-exp-rules-badge">Công thức thăng cấp</span>
              </div>
              <div className="scoreboard-rules-grid">
                <div className="scoreboard-rule-item">
                  <span className="scoreboard-rule-tag">+6 EXP</span>
                  <span className="scoreboard-rule-desc">Mỗi lượt mở hòm quay món ngẫu nhiên</span>
                </div>
                <div className="scoreboard-rule-item">
                  <span className="scoreboard-rule-tag">+12 EXP</span>
                  <span className="scoreboard-rule-desc">Gửi đánh giá &amp; nhận xét quán ăn hoặc món ăn</span>
                </div>
                <div className="scoreboard-rule-item">
                  <span className="scoreboard-rule-tag">+20 EXP</span>
                  <span className="scoreboard-rule-desc">Mở khóa thành công món ăn mới chưa từng thử</span>
                </div>
                <div className="scoreboard-rule-item">
                  <span className="scoreboard-rule-tag">+35 EXP</span>
                  <span className="scoreboard-rule-desc">Chia sẻ quán / món ngon cùng bạn bè</span>
                </div>
                <div className="scoreboard-rule-item highlight">
                  <span className="scoreboard-rule-tag bonus">+80 EXP</span>
                  <span className="scoreboard-rule-desc">Thăng bậc danh hiệu &amp; nhận huy hiệu vinh danh</span>
                </div>
              </div>
            </div>

            {/* 3. DANH SÁCH 9 BẬC ẨM THỰC & ĐẶC QUYỀN MỞ KHÓA */}
            <div className="scoreboard-ladder-section">
              <div className="scoreboard-ladder-header">
                <h3 className="scoreboard-ladder-title">
                  <Award size={18} className="text-amber-400 inline mr-1.5" />
                  LỘ TRÌNH 9 BẬC THỰC KHÁCH &amp; ĐẶC QUYỀN
                </h3>
                <span className="scoreboard-ladder-hint">
                  Tối đa 50 Cấp Độ
                </span>
              </div>

              <div className="scoreboard-tiers-list">
                {LEVEL_TIERS.map((tier, idx) => {
                  const minDishes = getMinDishesForLevel(tier.minLevel);
                  const maxDishes = tier.maxLevel === 50 ? 400 : getMinDishesForLevel(tier.maxLevel + 1) - 1;
                  const isUnlocked = profile.level > tier.maxLevel;
                  const isCurrent = profile.level >= tier.minLevel && profile.level <= tier.maxLevel;
                  const perk = TIER_PERKS[tier.title] || 'Đặc quyền ẩm thực độc quyền';

                  return (
                    <div 
                      key={tier.title} 
                      className={`scoreboard-tier-row ${
                        isCurrent ? 'current' : isUnlocked ? 'unlocked' : 'locked'
                      }`}
                    >
                      <div className="scoreboard-tier-badge-col">
                        <span className="scoreboard-tier-badge-icon">{tier.badge}</span>
                        <span className="scoreboard-tier-rank-text">BẬC {idx + 1}</span>
                      </div>

                      <div className="scoreboard-tier-content-col">
                        <div className="scoreboard-tier-title-row">
                          <strong className="scoreboard-tier-name">{tier.title}</strong>
                          <span className="scoreboard-tier-level-range">
                            Cấp {tier.minLevel} - {tier.maxLevel} ({minDishes} - {maxDishes}+ món)
                          </span>
                        </div>
                        <p className="scoreboard-tier-perk">{perk}</p>
                      </div>

                      <div className="scoreboard-tier-status-col">
                        {isCurrent ? (
                          <span className="scoreboard-status-chip current">
                            <Sparkles size={11} className="inline mr-1" />
                            Đang ở bậc này
                          </span>
                        ) : isUnlocked ? (
                          <span className="scoreboard-status-chip unlocked">
                            <CheckCircle2 size={12} className="inline mr-1" />
                            Đã đạt
                          </span>
                        ) : (
                          <span className="scoreboard-status-chip locked">
                            <Lock size={11} className="inline mr-1" />
                            Chưa mở
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NÚT THU GỌN VỀ BẢNG ĐIỂM */}
            <div className="scoreboard-collapse-bottom-wrap">
              <button
                type="button"
                className="scoreboard-collapse-bottom-btn"
                onClick={() => setShowDetails(false)}
              >
                <ChevronUp size={16} />
                <span>Thu gọn chi tiết, trở về bảng điểm</span>
              </button>
            </div>
          </div>
        )}

        {/* Nút Hành Động Dưới Cùng: Có nút trở về màn hình chính rõ ràng */}
        <div className="scoreboard-footer-actions">
          {isGuest ? (
            <button 
              type="button" 
              className="scoreboard-action-btn primary"
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
            >
              <GoogleGIcon size={16} />
              <span>Đăng nhập để thăng cấp</span>
            </button>
          ) : (
            <button 
              type="button" 
              className="scoreboard-action-btn primary"
              onClick={() => {
                onClose();
                onContinueSpinning();
              }}
            >
              <Sparkles size={16} />
              <span>Tiếp tục quay chọn món</span>
            </button>
          )}

          {/* Nút Đóng trở về màn hình chính */}
          <button 
            type="button" 
            className="scoreboard-action-btn secondary"
            onClick={onClose}
            title="Đóng bảng điểm và quay lại màn hình chính"
          >
            <Home size={15} />
            <span>Trở về màn hình chính</span>
          </button>
        </div>
      </div>
    </div>
  );
}
