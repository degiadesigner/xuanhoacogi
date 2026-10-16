'use client';

import React, { useEffect, useState } from 'react';
import { X, Edit3, LogOut, Award, Sparkles, Mail, UtensilsCrossed, Phone } from 'lucide-react';
import { UserAuthProfile, MASCOT_AVATARS, TASTE_PREFERENCES_OPTIONS, getResidentTypeInfo, saveAuthUser } from '../lib/auth';
import { UserGourmetProfile } from '../lib/user-exp';
import { getFoodHistory, FoodHistoryItem } from '../lib/food-history';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAuthProfile;
  profile: UserGourmetProfile;
  onEditProfile: () => void;
  onSignOut: () => void;
  onOpenScoreboard?: () => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  profile,
  onEditProfile,
  onSignOut,
  onOpenScoreboard,
}: UserProfileModalProps) {
  const [history, setHistory] = useState<FoodHistoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(getFoodHistory());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentMascot = MASCOT_AVATARS.find(m => m.id === user.avatarId) || MASCOT_AVATARS[0];
  const expPercentage = Math.round(profile.progressPercent || 0);

  const genderLabel = user.gender === 'female' ? '👧 Nữ' : user.gender === 'other' ? '🐱 Khác' : '👦 Nam';

  // Lấy các nhãn sở thích ẩm thực
  const userTasteLabels = (user.tastePreferences || [])
    .map(id => TASTE_PREFERENCES_OPTIONS.find(t => t.id === id))
    .filter(Boolean);

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div 
        className="auth-modal-container user-profile-card-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button 
          type="button"
          className="auth-modal-close-btn"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X size={18} />
        </button>

        <div className="user-profile-header">
          {/* Avatar tròn 3D nổi bật */}
          <div 
            className="user-profile-avatar-large"
            style={{ background: currentMascot.bgGradient }}
          >
            <span className="user-profile-avatar-emoji">{user.avatar || '🐱'}</span>
            <div className="user-profile-gender-badge">{genderLabel.split(' ')[0]}</div>
          </div>

          <div className="user-profile-title-col">
            <h3 className="user-profile-nickname">{user.nickname}</h3>
            <div className="user-profile-email-row">
              <Mail size={12} className="text-slate-400" />
              <span className="user-profile-email-text">{user.email || 'thuckhach.xuanhoa@gmail.com'}</span>
            </div>
            {user.phone && (
              <div className="user-profile-email-row">
                <Phone size={12} className="text-amber-400" />
                <span className="user-profile-email-text text-amber-300 font-medium">{user.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <span className="user-profile-gender-tag">{genderLabel}</span>
              <span className="user-profile-gender-tag text-amber-300 border-amber-500/40 bg-amber-500/10">
                {currentMascot.name}
              </span>
              <span className="user-profile-gender-tag text-sky-300 border-sky-500/40 bg-sky-500/10">
                {getResidentTypeInfo(user.residentType).label}
              </span>
            </div>
          </div>
        </div>

        {/* Khẩu vị & Gu ẩm thực */}
        <div className="user-profile-taste-box">
          <div className="flex items-center justify-between mb-1.5">
            <span className="user-profile-taste-title mb-0">🎯 Lọc Theo Gu Ẩm Thực:</span>
            <button
              type="button"
              className={`auth-switch-btn ${user.filterByTaste !== false ? 'active' : ''}`}
              onClick={() => {
                saveAuthUser({
                  ...user,
                  filterByTaste: user.filterByTaste === false ? true : false,
                });
              }}
              role="switch"
              aria-checked={user.filterByTaste !== false}
              title="Bật/Tắt chế độ lọc theo gu ẩm thực"
            >
              <span className="auth-switch-thumb" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            {user.filterByTaste !== false
              ? '🟢 Đang BẬT: Vòng quay ưu tiên các món theo khẩu vị bạn đã chọn'
              : '⚪ Đang TẮT: Khám phá tất cả các món không giới hạn'}
          </p>
          {userTasteLabels.length > 0 && (
            <div className="user-profile-taste-tags">
              {userTasteLabels.map((taste) => (
                <span key={taste!.id} className="user-profile-taste-pill">
                  {taste!.emoji} {taste!.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Khối Cấp Độ Ẩm Thực & Tiến trình EXP */}
        <div 
          className="user-profile-exp-card"
          onClick={() => {
            onClose();
            onOpenScoreboard?.();
          }}
          style={{ cursor: 'pointer' }}
          title="Bấm để xem Bảng Điểm Thực Khách & Lộ Trình 50 Cấp Độ"
        >
          <div className="user-profile-level-row">
            <div className="flex items-center gap-2">
              <span className="user-profile-level-tag">CẤP {profile.level}</span>
              <span className="user-profile-tier-name">{profile.badge ? `${profile.badge} ` : ''}{profile.title}</span>
            </div>
            <span className="user-profile-exp-ratio">
              {profile.dishesCount || 1} / {profile.nextLevelDishes || 4} món ăn
            </span>
          </div>

          {/* Thanh tiến trình */}
          <div className="user-profile-progress-track">
            <div 
              className="user-profile-progress-fill"
              style={{ width: `${expPercentage}%` }}
            />
          </div>

          <div className="user-profile-spins-meta">
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles size={12} className="text-amber-400" />
              Đã mở hộp: <strong className="text-slate-200">{profile.spinsCount} lượt</strong>
            </span>
            <span className="text-amber-400 font-semibold">{expPercentage}% · Xem Bảng Điểm 🏆</span>
          </div>
        </div>

        {/* Lịch sử món đã ăn / đã quay lưu lại */}
        <div className="user-profile-history-section">
          <div className="user-profile-history-header">
            <span className="user-profile-history-title">🍲 Món Đã Ăn &amp; Mở Gần Đây ({history.length})</span>
          </div>
          {history.length > 0 ? (
            <div className="user-profile-history-list">
              {history.slice(0, 4).map(item => (
                <div key={item.id} className="user-profile-history-item">
                  <img src={item.image} alt={item.name} className="user-profile-history-img" />
                  <div className="user-profile-history-info">
                    <span className="user-profile-history-name truncate">{item.name}</span>
                    <span className="user-profile-history-meta">{item.price}.000đ {item.placeName ? `· ${item.placeName}` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="user-profile-history-empty">Chưa có món trong lịch sử. Hãy quay hòm để tự động lưu các món đã ăn nhé!</p>
          )}
        </div>

        {/* 2 Nút Hành động */}
        <div className="user-profile-actions-row">
          <button
            type="button"
            className="user-profile-edit-btn"
            onClick={() => {
              onClose();
              onEditProfile();
            }}
          >
            <Edit3 size={15} />
            <span>Sửa hồ sơ &amp; Avatar</span>
          </button>

          <button
            type="button"
            className="user-profile-logout-btn"
            onClick={() => {
              onClose();
              onSignOut();
            }}
          >
            <LogOut size={15} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </div>
  );
}
