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
            : 'settings-menu-modal-compact'
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
              <h2 className="settings-menu-title">{t.menu_title}</h2>
              <button 
                type="button"
                className="settings-menu-close-btn"
                onClick={handleClose}
                aria-label={t.close}
              >
                <X size={18} />
              </button>
            </div>

            {/* ================= THẺ BỘ LỌC THEO GU ẨM THỰC ================= */}
            {authUser && authUser.isLoggedIn ? (
              <div className="settings-taste-filter-card">
                <div className="settings-taste-filter-left">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base">🎯</span>
                    <strong className="text-xs font-bold text-white">Lọc Theo Gu Của Bạn</strong>
                    <span className="settings-resident-chip">
                      {getResidentTypeInfo(authUser.residentType).label.split(' ')[0]} {getResidentTypeInfo(authUser.residentType).label.replace(/^[^\s]+\s*/, '')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 m-0">
                    {authUser.filterByTaste !== false
                      ? '🟢 Đang BẬT: Vòng quay ưu tiên các món bạn yêu thích'
                      : '⚪ Đang TẮT: Khám phá tất cả các món không giới hạn'}
                  </p>
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
            ) : (
              <div 
                className="settings-taste-filter-card guest" 
                onClick={() => {
                  handleClose();
                  onOpenLogin?.();
                }}
                title="Bấm để đăng nhập và thiết lập khẩu vị theo gu"
              >
                <div className="settings-taste-filter-left">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base">🎯</span>
                    <strong className="text-xs font-bold text-white">Lọc Theo Gu Ẩm Thực</strong>
                    <span className="settings-guest-chip">Cần đăng nhập</span>
                  </div>
                  <p className="text-[11px] text-slate-400 m-0">
                    Đăng nhập để chọn nhóm thực khách (SV / Bản địa) &amp; bật lọc theo gu
                  </p>
                </div>
                <button type="button" className="settings-quick-login-btn">
                  Đăng nhập
                </button>
              </div>
            )}

            <div className="settings-menu-grid settings-menu-grid-2x2">
              {/* Ô 1: Ngôn ngữ */}
              <button 
                type="button"
                className="settings-menu-card"
                onClick={() => setActiveSubModal('language')}
              >
                <div className="settings-menu-icon">
                  <Languages size={24} />
                </div>
                <span className="settings-menu-label">{t.menu_language}</span>
              </button>

              {/* Ô 2: Âm lượng (Bấm vào toggle tắt/bật lập tức) */}
              <button 
                type="button"
                className={`settings-menu-card ${!sound ? 'muted' : ''}`}
                onClick={onToggleSound}
                title={sound ? (lang === 'vi' ? 'Bấm để tắt âm thanh' : 'Click to mute') : (lang === 'vi' ? 'Bấm để bật âm thanh 100%' : 'Click to unmute')}
              >
                <div className="settings-menu-icon">
                  {sound ? <Volume2 size={24} /> : <VolumeX size={24} className="text-amber-400" />}
                </div>
                <span className="settings-menu-label">
                  {sound ? t.menu_sound_on : t.menu_sound_off}
                </span>
              </button>

              {/* Ô 3: Hướng dẫn */}
              <button 
                type="button"
                className="settings-menu-card"
                onClick={() => {
                  onOpenGuide();
                  handleClose();
                }}
              >
                <div className="settings-menu-icon">
                  <BookOpen size={24} />
                </div>
                <span className="settings-menu-label">{t.menu_guide}</span>
              </button>

              {/* Ô 4: Liên hệ với chúng tôi */}
              <button 
                type="button"
                className="settings-menu-card"
                onClick={() => setActiveSubModal('contact')}
                title={t.menu_contact}
              >
                <div className="settings-menu-icon">
                  <MessageSquare size={24} className="text-amber-400" />
                </div>
                <span className="settings-menu-label settings-menu-label-contact">
                  {lang === 'vi' ? (
                    <>
                      <span>Liên hệ với</span>
                      <span>chúng tôi</span>
                    </>
                  ) : (
                    t.menu_contact
                  )}
                </span>
              </button>
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
                  <span>{t.lang_vi}</span>
                  {lang === 'vi' && <Check size={16} className="text-amber-400" />}
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
                  <span>{t.lang_en}</span>
                  {lang === 'en' && <Check size={16} className="text-amber-400" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
