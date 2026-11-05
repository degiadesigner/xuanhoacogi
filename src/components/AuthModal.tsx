'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Shield, FileText, Lock, AlertCircle, ExternalLink } from 'lucide-react';
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
  clearAuthUser,
  UserAuthProfile,
} from '../lib/auth';
import {
  LegalPageSlug,
  getActivePolicyMetadata,
  getStoredConsentRecord,
  hasValidCurrentConsent,
  syncUserConsentFromCloud,
  submitVerifiableConsentViaBackend,
} from '../lib/legal-compliance';
import { LegalPagesView } from './LegalPagesView';

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
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState<string>('');

  // Drawer đọc toàn văn tài liệu pháp lý ngay trong modal mà không mất phiên đăng nhập
  const [readingLegalSlug, setReadingLegalSlug] = useState<LegalPageSlug | null>(null);

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
  const [residentType, setResidentType] = useState<UserResidentType>(
    existingUser?.residentType || 'student_sp2'
  );
  const [filterByTaste, setFilterByTaste] = useState<boolean>(
    existingUser?.filterByTaste ?? true
  );
  const [tastePreferences, setTastePreferences] = useState<string[]>(
    existingUser?.tastePreferences || ['lau_nuong', 'tra_sua']
  );
  const [gender, setGender] = useState<'male' | 'female'>(
    existingUser?.gender === 'female' ? 'female' : 'male'
  );
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    existingUser?.avatarId || (existingUser?.gender === 'female' ? 'f_ty' : 'm_ty')
  );

  // ==========================================================================
  // TRẠNG THÁI XÁC NHẬN PHÁP LÝ & ĐỒNG Ý DỮ LIỆU CÁ NHÂN (4 TẦNG TÁCH BIỆT A, B, C, D)
  // Các lựa chọn tùy chọn (D) TUYỆT ĐỐI KHÔNG TÍCH SẴN (false mặc định)
  // ==========================================================================
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [essentialDataNoticeAck, setEssentialDataNoticeAck] = useState<boolean>(false);
  const [coreProfileConsent, setCoreProfileConsent] = useState<boolean>(false);

  // D. Các đồng ý tùy chọn độc lập (Mặc định = false, không tích sẵn)
  const [optionalTastePersonalization, setOptionalTastePersonalization] = useState<boolean>(false);
  const [optionalAnalytics, setOptionalAnalytics] = useState<boolean>(false);
  const [optionalMarketing, setOptionalMarketing] = useState<boolean>(false);

  const activePolicy = getActivePolicyMetadata();

  useEffect(() => {
    if (isOpen) {
      setConsentError('');
      setReadingLegalSlug(null);
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

        const existingConsent = getStoredConsentRecord(existingUser.uid, existingUser.email);
        const alreadyValid = hasValidCurrentConsent(existingUser.uid, existingUser.email);
        setTermsAccepted(alreadyValid ? true : false);
        setEssentialDataNoticeAck(alreadyValid ? true : false);
        setCoreProfileConsent(alreadyValid ? true : false);
        setOptionalTastePersonalization(
          existingConsent?.purposes?.optional_taste_phone?.status === 'granted'
        );
        setOptionalAnalytics(
          existingConsent?.purposes?.optional_analytics?.status === 'granted'
        );
        setOptionalMarketing(
          existingConsent?.purposes?.optional_marketing?.status === 'granted'
        );
      } else {
        setStep(1);
        setNickname('');
        setPhone('');
        setResidentType('student_sp2');
        setFilterByTaste(true);
        setTastePreferences(['lau_nuong', 'tra_sua']);
        setGender('male');
        setSelectedAvatarId('m_ty');
        // Reset toàn bộ trạng thái consent về false (không tích sẵn)
        setTermsAccepted(false);
        setEssentialDataNoticeAck(false);
        setCoreProfileConsent(false);
        setOptionalTastePersonalization(false);
        setOptionalAnalytics(false);
        setOptionalMarketing(false);
      }
      setLoading(false);
    }
  }, [isOpen, existingUser]);

  // Đóng modal bằng phím ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (readingLegalSlug) {
          setReadingLegalSlug(null);
          return;
        }
        handleDismissModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, readingLegalSlug, step, tempGoogleData, termsAccepted, essentialDataNoticeAck, coreProfileConsent]);

  if (!isOpen) return null;

  // Xử lý Bước 1: Bấm Tiếp tục với Google
  // Không coi việc bấm Đăng nhập Google là đồng ý vô điều kiện cho mọi hoạt động xử lý dữ liệu.
  // Nếu đã có Consent Record hợp lệ cho phiên bản chính sách hiện tại -> cho vào thẳng không hỏi lại.
  const handleGoogleLogin = async () => {
    setLoading(true);
    setConsentError('');
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

      // Kiểm tra xem tài khoản này đã có bản ghi xác nhận còn hiệu lực trên Cloud/Local chưa
      await syncUserConsentFromCloud(savedProfile.uid || data.uid, savedProfile.email || data.email);
      const validConsent = hasValidCurrentConsent(
        savedProfile.uid || data.uid,
        savedProfile.email || data.email
      );

      if (validConsent && savedProfile.isFirstTimeSetupDone) {
        const confirmedProfile: UserAuthProfile = {
          ...savedProfile,
          consentConfirmedVersion: activePolicy.version,
        };
        saveAuthUser(confirmedProfile);
        onSuccess(confirmedProfile);
        onClose();
        return;
      }

      const existingConsent = getStoredConsentRecord(
        savedProfile.uid || data.uid,
        savedProfile.email || data.email
      );
      setTermsAccepted(validConsent);
      setEssentialDataNoticeAck(validConsent);
      setCoreProfileConsent(validConsent);
      setOptionalTastePersonalization(
        existingConsent?.purposes?.optional_taste_phone?.status === 'granted'
      );
      setOptionalAnalytics(
        existingConsent?.purposes?.optional_analytics?.status === 'granted'
      );
      setOptionalMarketing(
        existingConsent?.purposes?.optional_marketing?.status === 'granted'
      );

      setStep(2); // Chuyển sang Bước 2: Onboarding & Xác nhận quyền dữ liệu
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
        ? prev.length > 1
          ? prev.filter(id => id !== prefId)
          : prev
        : [...prev, prefId]
    );
  };

  const currentAvatars = gender === 'female' ? FEMALE_ZODIAC_AVATARS : MALE_ZODIAC_AVATARS;

  // Xử lý Bước 2: Lưu bằng chứng xác nhận (Consent Record) & Hoàn tất thiết lập
  const finalizeOnboardingWithConsent = async (forceDeclineAllOptional = false) => {
    setConsentError('');
    const finalTerms = forceDeclineAllOptional ? true : termsAccepted;
    const finalNotice = forceDeclineAllOptional ? true : essentialDataNoticeAck;
    const finalCore = forceDeclineAllOptional ? true : coreProfileConsent;

    if (!finalTerms || !finalNotice || !finalCore) {
      setConsentError(
        'Vui lòng tích xác nhận Mục A (Điều khoản sử dụng), Mục B (Đã đọc Thông báo xử lý dữ liệu thiết yếu) và Mục C (Đồng ý tạo hồ sơ cơ bản) trước khi kích hoạt tài khoản. Các mục ở Phần D là tùy chọn và không bắt buộc.'
      );
      return;
    }

    const finalOptTaste = forceDeclineAllOptional ? false : optionalTastePersonalization;
    const finalOptAnalytics = forceDeclineAllOptional ? false : optionalAnalytics;
    const finalOptMarketing = forceDeclineAllOptional ? false : optionalMarketing;

    setConsentSubmitting(true);
    try {
      const targetUid = tempGoogleData.uid || existingUser?.uid || 'guest_' + Date.now();
      const targetEmail = (tempGoogleData.email || existingUser?.email || 'thuckhach.xuanhoa@gmail.com')
        .trim()
        .toLowerCase();

      // 1. Lưu bằng chứng xác nhận (Verifiable Consent Record) lên Backend & RTDB trước
      await submitVerifiableConsentViaBackend({
        uid: targetUid,
        email: targetEmail,
        termsAccepted: finalTerms,
        essentialDataNoticeAck: finalNotice,
        coreProfileConsent: finalCore,
        optionalTastePersonalization: finalOptTaste,
        optionalAnalytics: finalOptAnalytics,
        optionalMarketing: finalOptMarketing,
      });

      // 2. Tạo hồ sơ người dùng (chỉ lưu SĐT & khẩu vị cá nhân hóa nếu người dùng đồng ý mục tùy chọn D1)
      const chosenAvatar = getMascotById(selectedAvatarId);
      const finalNickname = nickname.trim() || tempGoogleData.displayName || 'Thực Khách';

      const userProfile: UserAuthProfile = {
        isLoggedIn: true,
        uid: targetUid,
        email: targetEmail,
        displayName: tempGoogleData.displayName || finalNickname,
        nickname: finalNickname,
        gender,
        phone: finalOptTaste ? phone.trim() : '',
        residentType,
        tastePreferences: finalOptTaste ? tastePreferences : [],
        filterByTaste: finalOptTaste ? filterByTaste : false,
        avatar: chosenAvatar.emoji,
        avatarId: chosenAvatar.id,
        photoURL: tempGoogleData.photoURL,
        hasCompletedProfile: true,
        isFirstTimeSetupDone: true,
        consentConfirmedVersion: activePolicy.version,
        createdAt: existingUser?.createdAt || Date.now(),
      };

      saveAuthUser(userProfile);
      onSuccess(userProfile);
      onClose();
    } finally {
      setConsentSubmitting(false);
    }
  };

  // Nếu người dùng bấm dấu X đóng ở Bước 2:
  // Nếu đã có consent hợp lệ từ trước (đang sửa hồ sơ) -> chỉ đóng modal.
  // Nếu chưa xác nhận consent lần đầu -> hỏi hoặc hủy kích hoạt tài khoản để không lưu dữ liệu khi chưa có sự đồng ý.
  const handleDismissModal = () => {
    if (readingLegalSlug) {
      setReadingLegalSlug(null);
      return;
    }
    if (step === 2) {
      const targetUid = tempGoogleData.uid || existingUser?.uid;
      const targetEmail = tempGoogleData.email || existingUser?.email;
      if (hasValidCurrentConsent(targetUid, targetEmail)) {
        onClose();
        return;
      }
      // Người dùng đóng modal trước khi xác nhận điều khoản/đồng ý -> đăng xuất phiên tạm thời, không tự động lưu hồ sơ trái phép
      clearAuthUser();
      onClose();
      return;
    }
    onClose();
  };

  // Nếu người dùng đang mở toàn văn Điều khoản / Chính sách bảo mật ngay trong modal
  if (readingLegalSlug) {
    return (
      <div className="auth-modal-overlay" onClick={() => setReadingLegalSlug(null)}>
        <div
          className="w-full max-w-3xl mx-auto my-4 px-2"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <LegalPagesView
            activeSlug={readingLegalSlug}
            onSelectSlug={slug => setReadingLegalSlug(slug)}
            embeddedInModal={true}
            onCloseModal={() => setReadingLegalSlug(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-modal-overlay" onClick={handleDismissModal}>
      <div
        className={`auth-modal-container ${
          step === 2 ? 'auth-modal-container-zodiac' : 'auth-modal-container-step1'
        }`}
        onClick={e => e.stopPropagation()}
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
            BƯỚC 1: ĐĂNG NHẬP GOOGLE & THÔNG BÁO MINH BẠCH TRƯỚC ĐĂNG NHẬP
            ============================================================== */}
        {step === 1 && (
          <div className="auth-step-1-content">
            <div className="auth-google-icon-badge">
              <GoogleGIcon size={28} />
            </div>

            <h3 className="auth-modal-title">Đăng nhập Xuân Hòa Có Gì</h3>
            <p className="auth-modal-subtitle">
              {customNotice ||
                'Kết nối tài khoản Google để đồng bộ hồ sơ thực khách & đóng góp địa điểm'}
            </p>

            <button
              type="button"
              data-testid="google-login-cta-btn"
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

            <div className="auth-step1-security-hint space-y-2 mt-3">
              <span className="block text-[11px] text-slate-300">
                🔒 Chỉ yêu cầu phạm vi cơ bản (<code>openid</code>, <code>email</code>, <code>profile</code>). Không truy cập Gmail, Drive hay Danh bạ.
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Việc bấm <strong>Tiếp tục với Google</strong> chỉ thực hiện xác thực danh tính; bạn sẽ xem và xác nhận{' '}
                <button
                  type="button"
                  data-testid="step1-open-terms-link"
                  onClick={() => setReadingLegalSlug('terms')}
                  className="text-amber-400 hover:underline font-semibold"
                >
                  Điều khoản sử dụng
                </button>
                ,{' '}
                <button
                  type="button"
                  data-testid="step1-open-privacy-link"
                  onClick={() => setReadingLegalSlug('privacy')}
                  className="text-amber-400 hover:underline font-semibold"
                >
                  Chính sách bảo mật
                </button>{' '}
                và{' '}
                <button
                  type="button"
                  data-testid="step1-open-data-rights-link"
                  onClick={() => setReadingLegalSlug('data-rights')}
                  className="text-amber-400 hover:underline font-semibold"
                >
                  Quyền dữ liệu cá nhân
                </button>{' '}
                trước khi kích hoạt tài khoản.
              </p>
            </div>
          </div>
        )}

        {/* ==============================================================
            BƯỚC 2: HỒ SƠ THỰC KHÁCH + MÀN HÌNH ONBOARDING / GOOGLE LOGIN CONSENT
            ============================================================== */}
        {step === 2 && (
          <div className="auth-step-2-content">
            <div className="auth-step-2-header">
              <h3 className="auth-modal-title">Hồ Sơ &amp; Quyền Riêng Tư Thực Khách</h3>
              <p className="auth-modal-subtitle">
                Thiết lập hồ sơ và tùy chọn quyền dữ liệu cá nhân (Phiên bản {activePolicy.version})
              </p>

              {/* Huy hiệu tài khoản Google đã kết nối */}
              <div className="auth-connected-account-badge">
                <div className="flex items-center gap-2 overflow-hidden">
                  <GoogleGIcon size={18} />
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[10.5px] text-slate-400 font-medium">
                      Tài khoản Google đã xác thực:
                    </span>
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
              {/* 1. Hàng 2 cột: Biệt danh & Số điện thoại (Tùy chọn) */}
              <div className="auth-fields-row-2col">
                <div className="auth-field-group">
                  <label className="auth-field-label">
                    Biệt danh hiển thị <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    className="auth-nickname-input"
                    placeholder="VD: Cún K48, Hùng Trưng Nhị..."
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    maxLength={24}
                    autoFocus
                  />
                </div>

                <div className="auth-field-group">
                  <label className="auth-field-label">
                    Số điện thoại (Tùy chọn · Cần bật D1)
                  </label>
                  <input
                    type="tel"
                    className="auth-nickname-input"
                    placeholder="Không bắt buộc (VD: 0988...)"
                    value={phone}
                    onChange={e => {
                      setPhone(e.target.value);
                      if (e.target.value.trim().length > 0 && !optionalTastePersonalization) {
                        setOptionalTastePersonalization(true);
                      }
                    }}
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

              {/* 3. Lưới 12 Con Giáp */}
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
                  {currentAvatars.map(mascot => {
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

              {/* 4. Nhóm Thực Khách */}
              <div className="auth-field-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="auth-field-label mb-0">Bạn là thực khách</label>
                  <span className="text-[11px] font-semibold text-amber-400">
                    {RESIDENT_TYPE_OPTIONS.find(r => r.id === residentType)?.label}
                  </span>
                </div>

                <div className="auth-resident-grid">
                  {RESIDENT_TYPE_OPTIONS.map(opt => {
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

              {/* 5. Khẩu vị & Sở thích */}
              <div className="auth-field-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="auth-field-label mb-0">
                    Khẩu vị &amp; Sở thích ẩm thực (Tùy chọn)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Đã chọn <strong className="text-amber-400">{tastePreferences.length}</strong> gu
                  </span>
                </div>

                <div className="auth-taste-tags-wrap">
                  {TASTE_PREFERENCES_OPTIONS.map(opt => {
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
                        {isChecked && (
                          <Check size={11} className="ml-1 text-amber-400 inline" strokeWidth={3} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ============================================================
                  6. KHỐI GOOGLE LOGIN CONSENT PASTEL PREMIUM (PHẦN C & D)
                  Phân biệt rõ A, B, C và D (Tùy chọn không tích sẵn)
                  ============================================================ */}
              <div
                data-testid="google-consent-onboarding-box"
                className="rounded-2xl bg-[#FFFDF8] text-slate-800 border-2 border-amber-300/80 p-3.5 sm:p-4 space-y-3 shadow-sm mt-2"
              >
                <div className="flex items-center justify-between gap-2 border-b border-amber-200/70 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Shield size={16} className="text-amber-700 shrink-0" />
                    <span className="text-xs font-extrabold text-slate-900">
                      Xác nhận Điều khoản &amp; Bảo vệ Dữ liệu Cá nhân (Luật 91/2025/QH15)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                    {activePolicy.version}
                  </span>
                </div>

                {/* Liên kết mở toàn văn mà không mất phiên đăng nhập */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-500 font-medium">Xem toàn văn:</span>
                  <button
                    type="button"
                    data-testid="consent-open-terms-btn"
                    onClick={() => setReadingLegalSlug('terms')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 font-semibold transition"
                  >
                    <FileText size={11} />
                    <span>Điều khoản (/terms)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="consent-open-privacy-btn"
                    onClick={() => setReadingLegalSlug('privacy')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 font-semibold transition"
                  >
                    <Lock size={11} />
                    <span>Bảo mật (/privacy)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="consent-open-community-btn"
                    onClick={() => setReadingLegalSlug('community-guidelines')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 font-semibold transition"
                  >
                    <span>Quy định cộng đồng</span>
                  </button>
                  <button
                    type="button"
                    data-testid="consent-open-data-rights-btn"
                    onClick={() => setReadingLegalSlug('data-rights')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 font-semibold transition"
                  >
                    <span>Quyền dữ liệu (/data-rights)</span>
                  </button>
                </div>

                {/* PHẦN A, B, C: Xác nhận cần thiết để kích hoạt tài khoản */}
                <div className="space-y-2 bg-white rounded-xl border border-amber-200/80 p-3">
                  <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">
                    Phần 1 — Xác nhận cần thiết để kích hoạt tài khoản
                  </div>

                  {/* A. Điều khoản sử dụng */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-800 leading-snug">
                    <input
                      type="checkbox"
                      data-testid="consent-checkbox-terms"
                      checked={termsAccepted}
                      onChange={e => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>A. Xác nhận Điều khoản sử dụng:</strong> Tôi đã đọc và đồng ý tuân thủ{' '}
                      <button
                        type="button"
                        onClick={() => setReadingLegalSlug('terms')}
                        className="text-amber-700 font-semibold underline"
                      >
                        Điều khoản sử dụng
                      </button>{' '}
                      và{' '}
                      <button
                        type="button"
                        onClick={() => setReadingLegalSlug('community-guidelines')}
                        className="text-amber-700 font-semibold underline"
                      >
                        Quy định cộng đồng
                      </button>{' '}
                      của Xuân Hòa Có Gì.
                    </span>
                  </label>

                  {/* B. Thông báo xử lý dữ liệu cần thiết */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-800 leading-snug">
                    <input
                      type="checkbox"
                      data-testid="consent-checkbox-notice"
                      checked={essentialDataNoticeAck}
                      onChange={e => setEssentialDataNoticeAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>B. Thông báo xử lý dữ liệu thiết yếu:</strong> Tôi đã được thông báo về việc hệ thống xử lý mã định danh Google Auth (<code>uid</code>, <code>email</code>, <code>displayName</code>) để xác thực đăng nhập, phân quyền và bảo vệ an ninh tài khoản theo{' '}
                      <button
                        type="button"
                        onClick={() => setReadingLegalSlug('privacy')}
                        className="text-amber-700 font-semibold underline"
                      >
                        Chính sách bảo mật
                      </button>
                      .
                    </span>
                  </label>

                  {/* C. Đồng ý riêng cho hồ sơ cơ bản & đóng góp */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-800 leading-snug">
                    <input
                      type="checkbox"
                      data-testid="consent-checkbox-core-profile"
                      checked={coreProfileConsent}
                      onChange={e => setCoreProfileConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>C. Đồng ý dữ liệu Hồ sơ cơ bản &amp; Đóng góp:</strong> Tôi đồng ý cho phép lưu trữ và hiển thị biệt danh, linh vật đại diện, nhóm thực khách và các đánh giá/đề xuất địa điểm do tôi chủ động gửi lên.
                    </span>
                  </label>
                </div>

                {/* PHẦN D: Các lựa chọn tùy chọn (Không tích sẵn, tách biệt từng mục đích) */}
                <div className="space-y-2 bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      Phần 2 — Đồng ý tùy chọn (Không bắt buộc · Không tích sẵn)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Có thể từ chối hoặc rút lại bất cứ lúc nào
                    </span>
                  </div>

                  {/* D1. Cá nhân hóa khẩu vị & SĐT */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 leading-snug">
                    <input
                      type="checkbox"
                      data-testid="consent-checkbox-optional-taste"
                      checked={optionalTastePersonalization}
                      onChange={e => setOptionalTastePersonalization(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>D1. Cá nhân hóa Khẩu vị &amp; Lưu SĐT liên hệ (Tùy chọn):</strong> Đồng ý lưu sở thích khẩu vị và số điện thoại (nếu có nhập) để cá nhân hóa gợi ý món ăn trên vòng quay.
                    </span>
                  </label>

                  {/* D2. Phân tích thống kê không thiết yếu */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 leading-snug">
                    <input
                      type="checkbox"
                      data-testid="consent-checkbox-optional-analytics"
                      checked={optionalAnalytics}
                      onChange={e => setOptionalAnalytics(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>D2. Phân tích trải nghiệm không thiết yếu (Tùy chọn):</strong> Đồng ý cho phép ghi nhận thống kê lượt tương tác ẩn danh nhằm cải thiện chất lượng bản đồ và danh mục món ăn.
                    </span>
                  </label>

                  {/* D3. Thông báo sự kiện & bản tin */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 leading-snug">
                    <input
                      type="checkbox"
                      data-testid="consent-checkbox-optional-marketing"
                      checked={optionalMarketing}
                      onChange={e => setOptionalMarketing(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong>D3. Nhận thông báo địa điểm mới &amp; sự kiện (Tùy chọn):</strong> Đồng ý nhận thông báo qua email khi có quán mới hoặc sự kiện cộng đồng tại Xuân Hòa.
                    </span>
                  </label>
                </div>

                {consentError && (
                  <div
                    data-testid="auth-consent-error-banner"
                    className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{consentError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 7. Nhóm nút hành động minh bạch, không ép buộc đồng ý tùy chọn */}
            <div className="space-y-2 mt-3">
              <button
                type="button"
                data-testid="auth-consent-submit-btn"
                disabled={consentSubmitting}
                className="auth-submit-btn"
                onClick={() => finalizeOnboardingWithConsent(false)}
              >
                {consentSubmitting
                  ? 'Đang lưu bằng chứng xác nhận...'
                  : 'Xác nhận & Hoàn tất lưu hồ sơ'}
              </button>

              <button
                type="button"
                data-testid="auth-consent-decline-optional-btn"
                disabled={consentSubmitting}
                onClick={() => {
                  setTermsAccepted(true);
                  setEssentialDataNoticeAck(true);
                  setCoreProfileConsent(true);
                  setOptionalTastePersonalization(false);
                  setOptionalAnalytics(false);
                  setOptionalMarketing(false);
                  finalizeOnboardingWithConsent(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-600/60 text-xs font-semibold transition"
              >
                Chỉ xác nhận A, B, C &amp; Từ chối toàn bộ mục tùy chọn (D1, D2, D3)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
