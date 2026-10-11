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

interface SettingsMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  sound: boolean;
  onToggleSound: () => void;
  onOpenGuide: () => void;
  onOpenAbout: () => void;
}

export function SettingsMenuModal({
  isOpen,
  onClose,
  sound,
  onToggleSound,
  onOpenGuide,
  onOpenAbout,
}: SettingsMenuModalProps) {
  const [activeSubModal, setActiveSubModal] = useState<'none' | 'language' | 'contact'>('none');
  const [currentLang, setCurrentLang] = useState<'vi' | 'en'>('vi');

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
              <h2 className="settings-menu-title">Menu</h2>
              <button 
                type="button"
                className="settings-menu-close-btn"
                onClick={handleClose}
                aria-label="Đóng menu"
              >
                <X size={18} />
              </button>
            </div>

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
                <span className="settings-menu-label">Ngôn ngữ</span>
              </button>

              {/* Ô 2: Âm lượng (Bấm vào toggle tắt/bật lập tức) */}
              <button 
                type="button"
                className={`settings-menu-card ${!sound ? 'muted' : ''}`}
                onClick={onToggleSound}
                title={sound ? 'Bấm để tắt âm thanh' : 'Bấm để bật âm thanh 100%'}
              >
                <div className="settings-menu-icon">
                  {sound ? <Volume2 size={24} /> : <VolumeX size={24} className="text-amber-400" />}
                </div>
                <span className="settings-menu-label">
                  {sound ? 'Âm lượng - 100%' : 'Âm lượng - Tắt'}
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
                <span className="settings-menu-label">Hướng dẫn</span>
              </button>

              {/* Ô 4: Liên hệ với chúng tôi (ngắt dòng chuẩn 2 hàng, không rớt lẻ chữ "tôi") */}
              <button 
                type="button"
                className="settings-menu-card"
                onClick={() => setActiveSubModal('contact')}
                title="Liên hệ với chúng tôi"
              >
                <div className="settings-menu-icon">
                  <MessageSquare size={24} className="text-amber-400" />
                </div>
                <span className="settings-menu-label settings-menu-label-contact">
                  Liên hệ với<br />chúng tôi
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
              <h2 className="settings-menu-title settings-menu-title-centered">Chọn Ngôn Ngữ</h2>
              <button 
                type="button"
                className="settings-menu-close-btn"
                onClick={handleClose}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-lang-body">
              <div className="lang-options-list">
                <button 
                  type="button"
                  className={`lang-option-btn ${currentLang === 'vi' ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentLang('vi');
                    setActiveSubModal('none');
                  }}
                >
                  <span>🇻🇳 Tiếng Việt (Xuân Hòa Bản Địa)</span>
                  {currentLang === 'vi' && <Check size={16} className="text-amber-400" />}
                </button>
                <button 
                  type="button"
                  className={`lang-option-btn ${currentLang === 'en' ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentLang('en');
                    setActiveSubModal('none');
                  }}
                >
                  <span>🇬🇧 English (International)</span>
                  {currentLang === 'en' && <Check size={16} className="text-amber-400" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
