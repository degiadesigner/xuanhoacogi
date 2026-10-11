'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Languages, 
  Volume2, 
  VolumeX, 
  Heart, 
  BookOpen, 
  Check,
  ExternalLink
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
  const [activeSubModal, setActiveSubModal] = useState<'none' | 'language'>('none');
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

  if (!isOpen) return null;

  return (
    <div className="settings-menu-overlay" onClick={onClose}>
      <div 
        className="settings-menu-modal settings-menu-modal-compact"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt hệ thống"
      >
        {/* Header Modal chuẩn phong cách Trưa Nay Ăn Gì */}
        <div className="settings-menu-header">
          <h2 className="settings-menu-title">Menu</h2>
          <button 
            type="button"
            className="settings-menu-close-btn"
            onClick={onClose}
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lưới 4 ô chức năng cân đối 2x2 tinh gọn */}
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
              onClose();
            }}
          >
            <div className="settings-menu-icon">
              <BookOpen size={24} />
            </div>
            <span className="settings-menu-label">Hướng dẫn</span>
          </button>

          {/* Ô 4: Cộng đồng -> Dẫn link trực tiếp đến GR Trà Đá XuHo */}
          <button 
            type="button"
            className="settings-menu-card"
            onClick={() => {
              window.open('https://www.facebook.com/groups/397463820097107', '_blank');
              onClose();
            }}
            title="Dẫn link trực tiếp đến Group Trà Đá XuHo"
          >
            <div className="settings-menu-icon">
              <Heart size={24} className="text-rose-400" />
            </div>
            <span className="settings-menu-label">GR Trà Đá XuHo</span>
          </button>
        </div>

        {/* ================= SUB-MODAL: NGÔN NGỮ ================= */}
        {activeSubModal === 'language' && (
          <div className="settings-submodal-overlay" onClick={() => setActiveSubModal('none')}>
            <div className="settings-submodal-content" onClick={(e) => e.stopPropagation()}>
              <div className="settings-submodal-header">
                <h3>Chọn Ngôn Ngữ</h3>
                <button type="button" onClick={() => setActiveSubModal('none')}><X size={16} /></button>
              </div>
              <div className="settings-submodal-body">
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
          </div>
        )}
      </div>
    </div>
  );
}
