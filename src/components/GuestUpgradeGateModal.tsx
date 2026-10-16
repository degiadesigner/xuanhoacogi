'use client';

import React, { useEffect } from 'react';
import { X, Sparkles, BookOpen, MessageSquare, Award, ArrowRight } from 'lucide-react';
import { GoogleGIcon } from './GoogleGIcon';

interface GuestUpgradeGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
}

export function GuestUpgradeGateModal({
  isOpen,
  onClose,
  onOpenLogin,
}: GuestUpgradeGateModalProps) {
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

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div 
        className="auth-modal-container guest-gate-modal-container"
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

        <div className="guest-gate-header">
          <div className="guest-gate-badge-row">
            <span className="guest-gate-current-badge">🥉 Cấp 1: 3/3 Món Ăn (Tối đa Khách Vãng Lai)</span>
            <span className="guest-gate-arrow"><ArrowRight size={14} /></span>
            <span className="guest-gate-next-badge">🥈 Cấp 2: Tín Đồ Ăn Vặt (Từ 4 món)</span>
          </div>

          <h3 className="guest-gate-title">🎉 Chúc mừng bạn đã đạt tối đa 3 món Cấp 1!</h3>
          <p className="guest-gate-subtitle">
            Cấp 1 là giới hạn trải nghiệm dành cho Khách Vãng Lai. Hãy đăng nhập tài khoản Google để mở khóa toàn bộ quyền lợi thực khách:
          </p>
        </div>

        {/* 3 Lợi ích khi đăng nhập */}
        <div className="guest-gate-perks-list">
          <div className="guest-gate-perk-item">
            <div className="guest-gate-perk-icon gold">
              <Sparkles size={18} />
            </div>
            <div className="guest-gate-perk-content">
              <strong>Thăng cấp Cấp 2+ &amp; Mở rộng bộ sưu tập món không giới hạn</strong>
              <p>Mở khóa hơn 150+ món ăn thực tế tại Xuân Hòa, lộ trình 50 cấp độ sành ăn và linh vật 3D độc quyền.</p>
            </div>
          </div>

          <div className="guest-gate-perk-item">
            <div className="guest-gate-perk-icon blue">
              <BookOpen size={18} />
            </div>
            <div className="guest-gate-perk-content">
              <strong>Tự động lưu lịch sử các món đã ăn & Quán ruột</strong>
              <p>Không sợ quên quán ngon, lưu lại danh mục món ăn đã thưởng thức và quán yêu thích.</p>
            </div>
          </div>

          <div className="guest-gate-perk-item">
            <div className="guest-gate-perk-icon emerald">
              <MessageSquare size={18} />
            </div>
            <div className="guest-gate-perk-content">
              <strong>Đánh giá, bình luận & Gửi ảnh feedback cho quán</strong>
              <p>Trực tiếp gửi phản hồi chất lượng món ăn, dịch vụ và ảnh thực tế để feedback cho chủ quán.</p>
            </div>
          </div>
        </div>

        {/* 2 Nút hành động */}
        <div className="guest-gate-actions">
          <button
            type="button"
            className="auth-google-cta-btn"
            onClick={() => {
              onClose();
              onOpenLogin();
            }}
          >
            <GoogleGIcon size={20} />
            <span>Tiếp tục với Google để Lên Cấp 2</span>
          </button>

          <button
            type="button"
            className="guest-gate-later-btn"
            onClick={onClose}
          >
            Để sau (Tiếp tục ở Cấp 1)
          </button>
        </div>
      </div>
    </div>
  );
}
