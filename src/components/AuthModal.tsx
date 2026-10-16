'use client';

import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { GoogleGIcon } from './GoogleGIcon';
import { 
  MALE_ZODIAC_AVATARS,
  FEMALE_ZODIAC_AVATARS,
  TASTE_PREFERENCES_OPTIONS,
  RESIDENT_TYPE_OPTIONS,
  UserResidentType,
  getMascotById,
  signInWithGoogleService, 
  createOrUpdateAuthUserFromGoogle,
  saveAuthUser, 
  UserAuthProfile 
} from '../lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserAuthProfile) => void;
  initialStep?: 1 | 2;
  existingUser?: UserAuthProfile | null;
  customNotice?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialStep = 1,
  existingUser = null,
  customNotice,
}: AuthModalProps) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [loading, setLoading] = useState(false);

  // Dữ liệu tạm thời từ Google và Form thiết lập
  const [tempGoogleData, setTempGoogleData] = useState<{
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  }>({
    uid: existingUser?.uid || '',
    email: existingUser?.email || '',
    displayName: existingUser?.displayName || '',
    photoURL: existingUser?.photoURL,
  });

  const [nickname, setNickname] = useState<string>(existingUser?.nickname || '');
  const [phone, setPhone] = useState<string>(existingUser?.phone || '');
  const [residentType, setResidentType] = useState<UserResidentType>(existingUser?.residentType || 'student_sp2');
  const [filterByTaste, setFilterByTaste] = useState<boolean>(existingUser?.filterByTaste ?? true);
  const [tastePreferences, setTastePreferences] = useState<string[]>(existingUser?.tastePreferences || ['lau_nuong', 'tra_sua']);
  const [gender, setGender] = useState<'male' | 'female'>((existingUser?.gender === 'female' ? 'female' : 'male'));
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    existingUser?.avatarId || (existingUser?.gender === 'female' ? 'f_ty' : 'm_ty')
  );

  useEffect(() => {
    if (isOpen) {
      if (existingUser) {
        setStep(2);
        setNickname(existingUser.nickname || existingUser.displayName || '');
        setPhone(existingUser.phone || '');
        setResidentType(existingUser.residentType || 'student_sp2');
        setFilterByTaste(existingUser.filterByTaste ?? true);
        setTastePreferences(existingUser.tastePreferences || ['lau_nuong', 'tra_sua']);
        const g = existingUser.gender === 'female' ? 'female' : 'male';
        setGender(g);
        setSelectedAvatarId(existingUser.avatarId || (g === 'female' ? 'f_ty' : 'm_ty'));
        setTempGoogleData({
          uid: existingUser.uid || '',
          email: existingUser.email || '',
          displayName: existingUser.displayName || '',
          photoURL: existingUser.photoURL,
        });
      } else {
        setStep(1);
        setNickname('');
        setPhone('');
        setResidentType('student_sp2');
        setFilterByTaste(true);
        setTastePreferences(['lau_nuong', 'tra_sua']);
        setGender('male');
        setSelectedAvatarId('m_ty');
      }
      setLoading(false);
    }
  }, [isOpen, existingUser]);

  // Đóng modal bằng phím ESC
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

  // Xử lý Bước 1: Bấm Tiếp tục với Google (Mở tài khoản Google thật & Lưu đăng nhập ngay lập tức)
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const data = await signInWithGoogleService();
      const savedProfile = createOrUpdateAuthUserFromGoogle(data);
      setTempGoogleData(data);
      setNickname(savedProfile.nickname || data.displayName || 'Thực Khách');
      setPhone(savedProfile.phone || '');
      setResidentType(savedProfile.residentType || 'student_sp2');
      setFilterByTaste(savedProfile.filterByTaste ?? true);
      setTastePreferences(savedProfile.tastePreferences || ['lau_nuong', 'tra_sua']);
      const g = savedProfile.gender === 'female' ? 'female' : 'male';
      setGender(g);
      setSelectedAvatarId(savedProfile.avatarId || (g === 'female' ? 'f_ty' : 'm_ty'));
      onSuccess(savedProfile);
      setStep(2); // Chuyển sang Bước 2: Thiết lập nhanh
    } catch (err: any) {
      console.warn('Lỗi hoặc hủy đăng nhập Google:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  // Đổi giới tính -> cập nhật avatar tương ứng
  const handleSelectGender = (newGender: 'male' | 'female') => {
    setGender(newGender);
    if (newGender === 'male' && selectedAvatarId.startsWith('f_')) {
      setSelectedAvatarId('m_' + selectedAvatarId.replace('f_', ''));
    } else if (newGender === 'female' && selectedAvatarId.startsWith('m_')) {
      setSelectedAvatarId('f_' + selectedAvatarId.replace('m_', ''));
    }
  };

  // Bật/tắt sở thích khẩu vị
  const handleTogglePreference = (prefId: string) => {
    setTastePreferences(prev => 
      prev.includes(prefId)
        ? (prev.length > 1 ? prev.filter(id => id !== prefId) : prev) // Giữ lại ít nhất 1 sở thích
        : [...prev, prefId]
    );
  };

  // Danh sách 12 con giáp hiển thị theo giới tính đã chọn
  const currentAvatars = gender === 'female' ? FEMALE_ZODIAC_AVATARS : MALE_ZODIAC_AVATARS;

  // Xử lý Bước 2: Hoàn tất thiết lập
  const handleCompleteSetup = () => {
    const chosenAvatar = getMascotById(selectedAvatarId);
    const finalNickname = nickname.trim() || tempGoogleData.displayName || 'Thực Khách';

    const userProfile: UserAuthProfile = {
      isLoggedIn: true,
      uid: tempGoogleData.uid || 'guest_' + Date.now(),
      email: tempGoogleData.email || 'thuckhach.xuanhoa@gmail.com',
      displayName: tempGoogleData.displayName || finalNickname,
      nickname: finalNickname,
      gender,
      phone: phone.trim(),
      residentType,
      tastePreferences,
      filterByTaste,
      avatar: chosenAvatar.emoji,
      avatarId: chosenAvatar.id,
      photoURL: tempGoogleData.photoURL,
      hasCompletedProfile: true,
      isFirstTimeSetupDone: true,
      createdAt: existingUser?.createdAt || Date.now(),
    };

    saveAuthUser(userProfile);
    onSuccess(userProfile);
    onClose();
  };

  // Nếu người dùng bấm dấu X đóng ở Bước 2 (sau khi đã kết nối Gmail), vẫn tự động lưu lại hồ sơ đã đăng nhập
  const handleDismissModal = () => {
    if (step === 2 && tempGoogleData.email) {
      handleCompleteSetup();
      return;
    }
    onClose();
  };

  return (
    <div className="auth-modal-overlay" onClick={handleDismissModal}>
      <div 
        className={`auth-modal-container ${step === 2 ? 'auth-modal-container-zodiac' : 'auth-modal-container-step1'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Nút đóng modal */}
        <button 
          type="button"
          className="auth-modal-close-btn"
          onClick={handleDismissModal}
          aria-label="Đóng"
        >
          <X size={18} />
        </button>

        {/* ==============================================================
            BƯỚC 1: ĐĂNG NHẬP GOOGLE DUY NHẤT & CHUẨN XỊN
            ============================================================== */}
        {step === 1 && (
          <div className="auth-step-1-content">
            <div className="auth-google-icon-badge">
              <GoogleGIcon size={28} />
            </div>

            <h3 className="auth-modal-title">Đăng nhập tài khoản</h3>
            <p className="auth-modal-subtitle">
              {customNotice || 'Kết nối tài khoản Google để đồng bộ hồ sơ & đánh giá thực khách'}
            </p>

            <button
              type="button"
              className="auth-google-cta-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <div className="auth-btn-spinner" />
              ) : (
                <>
                  <GoogleGIcon size={20} />
                  <span>Tiếp tục với Google</span>
                </>
              )}
            </button>

            <div className="auth-step1-security-hint">
              <span>🔒 Đăng nhập trực tiếp qua Google OAuth 2.0 an toàn</span>
            </div>
          </div>
        )}

        {/* ==============================================================
            BƯỚC 2: THIẾT LẬP 12 CON GIÁP NAM & NỮ, SĐT, KHẨU VỊ SỞ THÍCH
            ============================================================== */}
        {step === 2 && (
          <div className="auth-step-2-content">
            <div className="auth-step-2-header">
              <h3 className="auth-modal-title">Hồ Sơ Thực Khách</h3>
              <p className="auth-modal-subtitle">Hoàn thiện thông tin để nhận ưu đãi quán &amp; gợi ý món chuẩn gu</p>

              {/* Huy hiệu tài khoản Google đã kết nối */}
              <div className="auth-connected-account-badge">
                <div className="flex items-center gap-2 overflow-hidden">
                  <GoogleGIcon size={18} />
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[10.5px] text-slate-400 font-medium">Tài khoản Google đã kết nối:</span>
                    <span className="text-[12.5px] text-amber-400 font-bold truncate">
                      {tempGoogleData.email || 'thuckhach.xuanhoa@gmail.com'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="text-[11px] text-slate-400 hover:text-amber-400 underline ml-2 whitespace-nowrap"
                  title="Đổi sang tài khoản khác"
                >
                  Đổi tài khoản
                </button>
              </div>
            </div>

            <div className="auth-form-fields">
              {/* 1. Hàng 2 cột: Biệt danh & Số điện thoại */}
              <div className="auth-fields-row-2col">
                <div className="auth-field-group">
                  <label className="auth-field-label">Biệt danh của bạn <span className="text-amber-400">*</span></label>
                  <input 
                    type="text"
                    className="auth-nickname-input"
                    placeholder="VD: Cún K48, Hùng Trưng Nhị..."
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={24}
                    autoFocus
                  />
                </div>

                <div className="auth-field-group">
                  <label className="auth-field-label">Số điện thoại (SĐT)</label>
                  <input 
                    type="tel"
                    className="auth-nickname-input"
                    placeholder="VD: 0988 123 456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={15}
                  />
                </div>
              </div>

              {/* 2. Giới tính (Nam / Nữ) */}
              <div className="auth-field-group">
                <label className="auth-field-label">Giới tính &amp; Bộ sưu tập 12 Con Giáp</label>
                <div className="auth-gender-pills-row">
                  <button
                    type="button"
                    className={`auth-gender-pill ${gender === 'male' ? 'active' : ''}`}
                    onClick={() => handleSelectGender('male')}
                  >
                    <span>👦 Nam</span>
                    <span className="auth-gender-sub">12 Con Giáp Soái Ca</span>
                  </button>
                  <button
                    type="button"
                    className={`auth-gender-pill ${gender === 'female' ? 'active' : ''}`}
                    onClick={() => handleSelectGender('female')}
                  >
                    <span>👧 Nữ</span>
                    <span className="auth-gender-sub">12 Con Giáp Kiều Diễm</span>
                  </button>
                </div>
              </div>

              {/* 3. Lưới 12 Con Giáp Đẳng Cấp */}
              <div className="auth-field-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="auth-field-label mb-0">
                    Linh vật 12 Con Giáp ({gender === 'male' ? 'Nam' : 'Nữ'})
                  </label>
                  <span className="text-[11px] font-semibold text-amber-400">
                    {getMascotById(selectedAvatarId).name} · {getMascotById(selectedAvatarId).tagline}
                  </span>
                </div>

                <div className="auth-zodiac-grid">
                  {currentAvatars.map((mascot) => {
                    const isSelected = selectedAvatarId === mascot.id;
                    return (
                      <button
                        key={mascot.id}
                        type="button"
                        className={`auth-zodiac-card ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedAvatarId(mascot.id)}
                        title={`${mascot.zodiac}: ${mascot.name} (${mascot.tagline})`}
                      >
                        <div 
                          className="auth-zodiac-avatar-circle"
                          style={{ background: mascot.bgGradient }}
                        >
                          <span className="auth-zodiac-emoji">{mascot.emoji}</span>
                          <span className="auth-zodiac-badge-pill">{mascot.zodiac}</span>
                          {isSelected && (
                            <div className="auth-zodiac-check-badge">
                              <Check size={11} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="auth-zodiac-info">
                          <strong className="auth-zodiac-name">{mascot.name}</strong>
                          <span className="auth-zodiac-tagline">{mascot.tagline}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Nhóm Thực Khách (Sinh viên / Bản địa / Đi làm / Du lịch) */}
              <div className="auth-field-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="auth-field-label mb-0">
                    Bạn là thực khách
                  </label>
                  <span className="text-[11px] font-semibold text-amber-400">
                    {RESIDENT_TYPE_OPTIONS.find(r => r.id === residentType)?.label}
                  </span>
                </div>

                <div className="auth-resident-grid">
                  {RESIDENT_TYPE_OPTIONS.map((opt) => {
                    const isSelected = residentType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`auth-resident-card ${isSelected ? 'active' : ''}`}
                        onClick={() => setResidentType(opt.id)}
                      >
                        <div className="auth-resident-icon">{opt.emoji}</div>
                        <div className="auth-resident-text">
                          <strong className="auth-resident-title">{opt.label}</strong>
                          <span className="auth-resident-sub">{opt.sublabel}</span>
                        </div>
                        {isSelected && (
                          <div className="auth-resident-check">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Khẩu vị & Sở thích (Multi-select) */}
              <div className="auth-field-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="auth-field-label mb-0">
                    Khẩu vị &amp; Sở thích ẩm thực
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Đã chọn <strong className="text-amber-400">{tastePreferences.length}</strong> gu
                  </span>
                </div>

                <div className="auth-taste-tags-wrap">
                  {TASTE_PREFERENCES_OPTIONS.map((opt) => {
                    const isChecked = tastePreferences.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`auth-taste-tag-btn ${isChecked ? 'active' : ''}`}
                        onClick={() => handleTogglePreference(opt.id)}
                      >
                        <span className="mr-1">{opt.emoji}</span>
                        <span>{opt.label}</span>
                        {isChecked && <Check size={11} className="ml-1 text-amber-400 inline" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Công Tắc Bộ Lọc Theo Gu (Bật / Tắt) */}
              <div className="auth-field-group auth-taste-filter-toggle-box">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="auth-filter-toggle-title">
                      🎯 Bộ lọc theo gu ẩm thực của tôi
                    </span>
                    <span className="auth-filter-toggle-desc">
                      {filterByTaste 
                        ? 'Đang BẬT: Vòng quay ưu tiên các món hợp khẩu vị bạn đã chọn' 
                        : 'Đang TẮT: Khám phá tất cả các món không giới hạn (Ăn gì cũng được)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`auth-switch-btn ${filterByTaste ? 'active' : ''}`}
                    onClick={() => setFilterByTaste(!filterByTaste)}
                    role="switch"
                    aria-checked={filterByTaste}
                    title="Bật/Tắt lọc món theo gu ẩm thực"
                  >
                    <span className="auth-switch-thumb" />
                  </button>
                </div>
              </div>
            </div>

            {/* 7. Nút: [ Hoàn tất ] */}
            <button
              type="button"
              className="auth-submit-btn"
              onClick={handleCompleteSetup}
            >
              Hoàn tất lưu hồ sơ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
