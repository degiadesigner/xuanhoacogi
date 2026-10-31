'use client';

import React from 'react';
import { RotateCw, Store, Map, Settings } from 'lucide-react';
import { AppView } from '../app/page';
import { UserAuthProfile } from '../lib/auth';
import { Language, translations } from '../lib/i18n';

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenMap?: () => void;
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
  onOpenMap,
  onOpenSettings,
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

  const t = translations[lang] || translations.vi;

  return (
    <nav className="mobile-bottom-nav-dock" aria-label="Thanh điều hướng di động">
      <div className="mobile-dock-inner grid grid-cols-4 w-full">
        {/* 1. Quay Món */}
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
            <RotateCw
              size={20}
              style={{ color: currentView === 'spin' ? '#E5B85C' : '#8E96A4' }}
              className={currentView === 'spin' ? 'rotate-icon' : ''}
            />
          </div>
          <span
            className="mobile-dock-label"
            style={{ color: currentView === 'spin' ? '#E5B85C' : '#8E96A4' }}
          >
            {t.dock_spin}
          </span>
        </button>

        {/* 2. Quán Xá */}
        <button
          type="button"
          className={`mobile-dock-tab ${currentView === 'places' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic();
            onNavigate('places');
          }}
          aria-label={t.dock_places}
        >
          <div className="mobile-dock-icon-wrap">
            <Store
              size={20}
              style={{ color: currentView === 'places' ? '#E5B85C' : '#8E96A4' }}
            />
          </div>
          <span
            className="mobile-dock-label"
            style={{ color: currentView === 'places' ? '#E5B85C' : '#8E96A4' }}
          >
            {t.dock_places}
          </span>
        </button>

        {/* 3. Bản Đồ Số */}
        <button
          type="button"
          className={`mobile-dock-tab ${currentView === 'map' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic();
            if (onOpenMap) onOpenMap();
            else onNavigate('map');
          }}
          aria-label={lang === 'en' ? 'Digital Map' : 'Bản Đồ Số'}
        >
          <div className="mobile-dock-icon-wrap">
            <Map
              size={20}
              style={{ color: currentView === 'map' ? '#E5B85C' : '#8E96A4' }}
            />
          </div>
          <span
            className="mobile-dock-label"
            style={{ color: currentView === 'map' ? '#E5B85C' : '#8E96A4' }}
          >
            {lang === 'en' ? 'Digital Map' : 'Bản Đồ Số'}
          </span>
        </button>

        {/* 4. Cài Đặt */}
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
            <Settings size={20} style={{ color: '#8E96A4' }} />
          </div>
          <span className="mobile-dock-label" style={{ color: '#8E96A4' }}>
            {t.dock_settings}
          </span>
        </button>
      </div>
    </nav>
  );
};
