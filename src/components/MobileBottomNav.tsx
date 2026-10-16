'use client';

import React from 'react';
import { 
  RotateCw, 
  UtensilsCrossed, 
  Store, 
  User,
  Settings
} from 'lucide-react';
import { AppView } from '../app/page';
import { UserAuthProfile } from '../lib/auth';

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenScoreboard: () => void;
  onOpenSettings?: () => void;
  onOpenLogin: () => void;
  onOpenProfile: () => void;
  authUser?: UserAuthProfile | null;
  level: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenScoreboard,
  onOpenSettings,
  onOpenLogin,
  onOpenProfile,
  authUser,
  level,
}) => {
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignore haptics error on unsupported devices
      }
    }
  };

  const isLoggedIn = !!(authUser && authUser.isLoggedIn);

  return (
    <nav 
      className="mobile-bottom-nav-dock" 
      aria-label="Thanh điều hướng di động"
    >
      <div className="mobile-dock-inner">
        {/* 1. Nút Vòng Quay (Home/Spin) */}
        <button
          type="button"
          className={`mobile-dock-tab ${currentView === 'spin' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic();
            onNavigate('spin');
          }}
          aria-label="Quay Món"
        >
          <div className="mobile-dock-icon-wrap">
            <RotateCw size={20} className={currentView === 'spin' ? 'text-amber-400 rotate-icon' : 'text-slate-400'} />
          </div>
          <span className="mobile-dock-label">Quay Món</span>
        </button>

        {/* 2. Nút Danh Mục Món Ăn */}
        <button
          type="button"
          className={`mobile-dock-tab ${currentView === 'dishes' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic();
            onNavigate('dishes');
          }}
          aria-label="Khám Phá Món"
        >
          <div className="mobile-dock-icon-wrap">
            <UtensilsCrossed size={20} className={currentView === 'dishes' ? 'text-amber-400' : 'text-slate-400'} />
          </div>
          <span className="mobile-dock-label">Món Ngon</span>
        </button>

        {/* 3. Nút Quán Ăn */}
        <button
          type="button"
          className={`mobile-dock-tab ${currentView === 'places' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic();
            onNavigate('places');
          }}
          aria-label="Quán Ăn Xuân Hòa"
        >
          <div className="mobile-dock-icon-wrap">
            <Store size={20} className={currentView === 'places' ? 'text-amber-400' : 'text-slate-400'} />
          </div>
          <span className="mobile-dock-label">Quán Xá</span>
        </button>

        {/* 4. Nút Đăng Nhập / Tài Khoản (Thay thế vào vị trí bảng điểm) */}
        {!isLoggedIn ? (
          <button
            type="button"
            className="mobile-dock-tab"
            onClick={() => {
              triggerHaptic();
              onOpenLogin();
            }}
            aria-label="Đăng Nhập Tài Khoản"
          >
            <div className="mobile-dock-icon-wrap">
              <User size={20} className="text-amber-400" />
            </div>
            <span className="mobile-dock-label text-amber-300 font-extrabold">Đăng Nhập</span>
          </button>
        ) : (
          <button
            type="button"
            className="mobile-dock-tab"
            onClick={() => {
              triggerHaptic();
              onOpenProfile();
            }}
            aria-label="Hồ Sơ Cá Nhân"
          >
            <div className="mobile-dock-icon-wrap">
              <span className="text-lg leading-none">{authUser.avatar || '🐱'}</span>
            </div>
            <span className="mobile-dock-label truncate max-w-[56px] text-amber-300 font-extrabold">
              {authUser.nickname || 'Tài Khoản'}
            </span>
          </button>
        )}

        {/* 5. Nút Cài Đặt (Trả lại vị trí góc phải cho cài đặt) */}
        <button
          type="button"
          className="mobile-dock-tab"
          onClick={() => {
            triggerHaptic();
            if (onOpenSettings) onOpenSettings();
          }}
          aria-label="Cài Đặt Hệ Thống"
        >
          <div className="mobile-dock-icon-wrap">
            <Settings size={20} className="text-slate-400" />
          </div>
          <span className="mobile-dock-label">Cài Đặt</span>
        </button>
      </div>
    </nav>
  );
};
