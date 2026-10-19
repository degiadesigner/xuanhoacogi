'use client';

import React from 'react';
import { 
  RotateCw, 
  UtensilsCrossed, 
  Store, 
  Map,
  User,
  Settings
} from 'lucide-react';
import { AppView } from '../app/page';
import { UserAuthProfile } from '../lib/auth';

import { Language, translations } from '../lib/i18n';

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenScoreboard: () => void;
  onOpenSettings?: () => void;
  onOpenLogin: () => void;
  onOpenProfile: () => void;
  authUser?: UserAuthProfile | null;
  level: number;
  lang?: Language;
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
  lang = 'vi',
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
  const t = translations[lang] || translations.vi;

  return (
    <nav 
      className="mobile-bottom-nav-dock" 
      aria-label="Thanh điều hướng di động"
    >
      <div className="mobile-dock-inner">
        {/* 1. Nút Vòng Quay (Quay Món) */}
        <button
          type="button"
          className={`mobile-dock-tab ${currentView === 'spin' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic();
            onNavigate('spin');
          }}
          aria-label={t.dock_spin}
        >
          <div className="mobile-dock-icon-wrap">
            <RotateCw size={20} className={currentView === 'spin' ? 'text-amber-400 rotate-icon' : 'text-slate-400'} />
          </div>
          <span className="mobile-dock-label">{t.dock_spin}</span>
        </button>

        {/* 2. Nút Bản Đồ Số */}
        <button
          type="button"
          className={`mobile-dock-tab ${currentView === 'map' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic();
            onNavigate('map');
          }}
          aria-label={lang === 'en' ? 'Digital Map' : 'Bản Đồ Số'}
        >
          <div className="mobile-dock-icon-wrap">
            <Map size={20} className={currentView === 'map' ? 'text-amber-400' : 'text-slate-400'} />
          </div>
          <span className="mobile-dock-label">{lang === 'en' ? 'Digital Map' : 'Bản Đồ Số'}</span>
        </button>

        {/* 3. Nút Cài Đặt */}
        <button
          type="button"
          className="mobile-dock-tab"
          onClick={() => {
            triggerHaptic();
            if (onOpenSettings) onOpenSettings();
          }}
          aria-label={t.dock_settings}
        >
          <div className="mobile-dock-icon-wrap">
            <Settings size={20} className="text-slate-400" />
          </div>
          <span className="mobile-dock-label">{t.dock_settings}</span>
        </button>
      </div>
    </nav>
  );
};
