'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Languages, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  Check,
  ExternalLink,
  MessageSquare,
  User,
  Compass,
  Users,
  ArrowLeft
} from 'lucide-react';
import { Language, getStoredLanguage, saveLanguage, translations } from '../lib/i18n';
import { UserAuthProfile, getResidentTypeInfo } from '../lib/auth';

interface SettingsMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  sound: boolean;
  onToggleSound: () => void;
  onOpenGuide: () => void;
  onOpenAbout: () => void;
  currentLang?: Language;
  onChangeLang?: (lang: Language) => void;
  authUser?: UserAuthProfile | null;
  onToggleTasteFilter?: () => void;
  onOpenLogin?: () => void;
  onOpenProfile?: () => void;
}

export function SettingsMenuModal({
  isOpen,
  onClose,
  sound,
  onToggleSound,
  onOpenGuide,
  onOpenAbout,
  currentLang,
  onChangeLang,
  authUser,
  onToggleTasteFilter,
  onOpenLogin,
  onOpenProfile,
}: SettingsMenuModalProps) {
  const [activeSubModal, setActiveSubModal] = useState<'none' | 'language' | 'contact'>('none');
  const [lang, setLang] = useState<Language>(() => currentLang || getStoredLanguage());

  useEffect(() => {
    if (currentLang) {
      setLang(currentLang);
    } else {
      setLang(getStoredLanguage());
    }
  }, [currentLang, isOpen]);

  const t = translations[lang] || translations.vi;

  // Đóng bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSubModal !== 'none') {
          setActiveSubModal('none');
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeSubModal, onClose]);

  const handleClose = () => {
    setActiveSubModal('none');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-menu-overlay" onClick={handleClose}>
      <div 
        className={`settings-menu-modal ${
          activeSubModal === 'contact' 
            ? 'settings-menu-modal-contact' 
            : activeSubModal === 'language' 
            ? 'settings-menu-modal-lang' 
            : 'settings-menu-modal-luxury'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt hệ thống"
      >
        {/* ================= VIEW 1: MENU CHÍNH (2x2 Grid) ================= */}
        {activeSubModal === 'none' && (
          <>
            <div className="settings-menu-header">
              <div className="settings-header-title-wrap">
                <span className="settings-header-icon-pill">⚙️</span>
                <h2 className="settings-menu-title">{t.settings_title || t.menu_title}</h2>
              </div>
              <button 
                type="button"
                className="settings-menu-close-btn"
                onClick={handleClose}
                aria-label={t.close}
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-menu-body">
              {/* ================= THẺ BỘ LỌC THEO GU ẨM THỰC ================= */}
              {authUser && authUser.isLoggedIn ? (
                <div className="settings-taste-filter-card">
                  {/* Hàng trên: Icon + Tiêu đề + Trạng thái + Toggle */}
                  <div className="settings-taste-card-top">
                    <div className="settings-taste-card-title-group">
                      <div className="settings-taste-icon-box">🎯</div>
                      <div className="settings-taste-text-col">
                        <div className="settings-taste-title-row">
                          <strong className="settings-taste-title">{t.taste_filter_title}</strong>
                          <span className={`settings-taste-status-tag ${authUser.filterByTaste !== false ? 'active' : ''}`}>
                            {authUser.filterByTaste !== false ? `● ${t.taste_filter_active}` : `○ ${t.taste_filter_inactive}`}
                          </span>
                        </div>
                        <span className="settings-taste-desc">
                          {authUser.filterByTaste !== false
                            ? t.taste_filter_desc_on
                            : t.taste_filter_desc_off}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`auth-switch-btn ${authUser.filterByTaste !== false ? 'active' : ''}`}
                      onClick={() => onToggleTasteFilter && onToggleTasteFilter()}
                      role="switch"
                      aria-checked={authUser.filterByTaste !== false}
                      title="Bật/Tắt chế độ lọc theo gu ẩm thực"
                    >
                      <span className="auth-switch-thumb" />
                    </button>
                  </div>

                  {/* Hàng dưới: Nhóm thực khách & Nút sửa hồ sơ */}
                  <div className="settings-taste-card-footer">
                    <div className="settings-taste-profile-pill">
                      <span>{getResidentTypeInfo(authUser.residentType).emoji}</span>
                      <span>{getResidentTypeInfo(authUser.residentType).label}</span>
                    </div>

                    {onOpenProfile && (
                      <button 
                        type="button" 
                        onClick={() => {
                          handleClose();
                          onOpenProfile();
                        }}
                        className="settings-taste-edit-btn"
                      >
                        {t.taste_filter_edit_btn}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div 
                  className="settings-taste-filter-card guest" 
                  onClick={() => {
                    handleClose();
                    onOpenLogin?.();
                  }}
                  title="Bấm để đăng nhập và thiết lập khẩu vị theo gu"
                >
                  <div className="settings-taste-card-top">
                    <div className="settings-taste-card-title-group">
                      <div className="settings-taste-icon-box">🎯</div>
                      <div className="settings-taste-text-col">
                        <strong className="settings-taste-title">{t.taste_filter_title}</strong>
                        <span className="settings-taste-desc">
                          {t.taste_filter_guest_desc}
                        </span>
                      </div>
                    </div>
                    <button type="button" className="settings-taste-login-pill">
                      {t.taste_filter_guest_btn} →
                    </button>
                  </div>
                </div>
              )}

              {/* ================= 4 Ô CHỨC NĂNG 2X2 SANG TRỌNG ================= */}
              <div className="settings-menu-grid-luxury">
                {/* Ô 1: Ngôn ngữ */}
                <button 
                  type="button"
                  className="settings-luxury-card"
                  onClick={() => setActiveSubModal('language')}
                >
                  <div className="settings-luxury-card-head">
                    <div className="settings-luxury-icon-wrap">
                      <Languages size={19} />
                    </div>
                    <span className="settings-luxury-badge">{lang === 'vi' ? '🇻🇳 VN' : '🇬🇧 EN'}</span>
                  </div>
                  <div className="settings-luxury-card-info">
                    <strong className="settings-luxury-label">{t.menu_language}</strong>
                    <span className="settings-luxury-sublabel">{lang === 'vi' ? 'Tiếng Việt' : 'English'}</span>
                  </div>
                </button>

                {/* Ô 2: Âm lượng */}
                <button 
                  type="button"
                  className={`settings-luxury-card ${!sound ? 'muted' : ''}`}
                  onClick={onToggleSound}
                  title={sound ? (lang === 'vi' ? 'Bấm để tắt âm thanh' : 'Click to mute') : (lang === 'vi' ? 'Bấm để bật âm thanh' : 'Click to unmute')}
                >
                  <div className="settings-luxury-card-head">
                    <div className="settings-luxury-icon-wrap">
                      {sound ? <Volume2 size={19} /> : <VolumeX size={19} className="text-amber-400" />}
                    </div>
                    <span className={`settings-luxury-badge ${sound ? 'active' : 'muted'}`}>
                      {sound ? '100%' : 'OFF'}
                    </span>
                  </div>
                  <div className="settings-luxury-card-info">
                    <strong className="settings-luxury-label">{t.menu_sound}</strong>
                    <span className="settings-luxury-sublabel">{sound ? t.menu_sound_active : t.menu_sound_muted}</span>
                  </div>
                </button>

                {/* Ô 3: Hướng dẫn */}
                <button 
                  type="button"
                  className="settings-luxury-card"
                  onClick={() => {
                    onOpenGuide();
                    handleClose();
                  }}
                >
                  <div className="settings-luxury-card-head">
                    <div className="settings-luxury-icon-wrap">
                      <BookOpen size={19} />
                    </div>
                    <span className="settings-luxury-badge">{t.menu_guide_badge}</span>
                  </div>
                  <div className="settings-luxury-card-info">
                    <strong className="settings-luxury-label">{t.menu_guide}</strong>
                    <span className="settings-luxury-sublabel">User Guide</span>
                  </div>
                </button>

                {/* Ô 4: Liên hệ với chúng tôi */}
                <button 
                  type="button"
                  className="settings-luxury-card"
                  onClick={() => setActiveSubModal('contact')}
                  title={t.menu_contact}
                >
                  <div className="settings-luxury-card-head">
                    <div className="settings-luxury-icon-wrap">
                      <MessageSquare size={19} className="text-amber-400" />
                    </div>
                    <span className="settings-luxury-badge">{t.menu_contact_badge}</span>
                  </div>
                  <div className="settings-luxury-card-info">
                    <strong className="settings-luxury-label">{t.menu_contact}</strong>
                    <span className="settings-luxury-sublabel">Social & Support</span>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= VIEW 2: LIÊN HỆ VỚI CHÚNG TÔI ================= */}
        {activeSubModal === 'contact' && (
          <div className="settings-subview-wrapper">
            <div className="settings-menu-header">
              <button 
                type="button" 
                className="settings-menu-back-btn" 
                onClick={() => setActiveSubModal('none')}
                title="Quay lại Menu"
                aria-label="Quay lại Menu"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="settings-menu-title settings-menu-title-centered">Liên Hệ Với Chúng Tôi</h2>
              <button 
                type="button"
                className="settings-menu-close-btn"
                onClick={handleClose}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-contact-body">
              <div className="contact-options-list">
                {/* 1. Trang cá nhân: MinhTT */}
                <a 
                  href="https://www.facebook.com/minhttvp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-option-card"
                  title="Mở Facebook cá nhân Founder MinhTT"
                >
                  <div className="contact-option-icon contact-icon-founder">
                    <User size={20} />
                  </div>
                  <div className="contact-option-info">
                    <div className="contact-option-title-row">
                      <span className="contact-option-name">Trang cá nhân</span>
                      <span className="contact-badge contact-badge-founder">Founder</span>
                    </div>
                    <span className="contact-option-desc">MinhTT (Người sáng lập)</span>
                  </div>
                  <ExternalLink size={16} className="contact-external-icon" />
                </a>

                {/* 2. Fanpage: Xuân Hòa Có Gì */}
                <a 
                  href="https://www.facebook.com/xuanhoacogi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-option-card"
                  title="Mở Fanpage Xuân Hòa Có Gì"
                >
                  <div className="contact-option-icon contact-icon-page">
                    <Compass size={20} />
                  </div>
                  <div className="contact-option-info">
                    <div className="contact-option-title-row">
                      <span className="contact-option-name">Fanpage chính thức</span>
                      <span className="contact-badge contact-badge-page">Trang</span>
                    </div>
                    <span className="contact-option-desc">Xuân Hòa Có Gì</span>
                  </div>
                  <ExternalLink size={16} className="contact-external-icon" />
                </a>

                {/* 3. Group: GR Trà Đá XuHo */}
                <a 
                  href="https://www.facebook.com/groups/397463820097107"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-option-card"
                  title="Tham gia Group Trà Đá XuHo"
                >
                  <div className="contact-option-icon contact-icon-group">
                    <Users size={20} />
                  </div>
                  <div className="contact-option-info">
                    <div className="contact-option-title-row">
                      <span className="contact-option-name">Group cộng đồng</span>
                      <span className="contact-badge contact-badge-group">Nhóm</span>
                    </div>
                    <span className="contact-option-desc">GR Trà Đá XuHo</span>
                  </div>
                  <ExternalLink size={16} className="contact-external-icon" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 3: CHỌN NGÔN NGỮ ================= */}
        {activeSubModal === 'language' && (
          <div className="settings-subview-wrapper">
            <div className="settings-menu-header">
              <button 
                type="button" 
                className="settings-menu-back-btn" 
                onClick={() => setActiveSubModal('none')}
                title="Quay lại Menu"
                aria-label="Quay lại Menu"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="settings-menu-title settings-menu-title-centered">{t.lang_modal_title}</h2>
              <button 
                type="button"
                className="settings-menu-close-btn"
                onClick={handleClose}
                aria-label={t.close}
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-lang-body">
              <div className="lang-options-list">
                <button 
                  type="button"
                  className={`lang-option-btn ${lang === 'vi' ? 'active' : ''}`}
                  onClick={() => {
                    setLang('vi');
                    saveLanguage('vi');
                    onChangeLang?.('vi');
                    setActiveSubModal('none');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇻🇳</span>
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-sm text-white">Tiếng Việt</span>
                      <span className="text-[11px] text-slate-400">Xuân Hòa Bản Địa</span>
                    </div>
                  </div>
                  {lang === 'vi' && <Check size={18} className="text-amber-400" strokeWidth={3} />}
                </button>
                <button 
                  type="button"
                  className={`lang-option-btn ${lang === 'en' ? 'active' : ''}`}
                  onClick={() => {
                    setLang('en');
                    saveLanguage('en');
                    onChangeLang?.('en');
                    setActiveSubModal('none');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇬🇧</span>
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-sm text-white">English</span>
                      <span className="text-[11px] text-slate-400">International (Global)</span>
                    </div>
                  </div>
                  {lang === 'en' && <Check size={18} className="text-amber-400" strokeWidth={3} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
