'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Edit3,
  LogOut,
  Sparkles,
  Mail,
  Phone,
  Shield,
  Download,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';
import {
  UserAuthProfile,
  MASCOT_AVATARS,
  TASTE_PREFERENCES_OPTIONS,
  getResidentTypeInfo,
  saveAuthUser,
} from '../lib/auth';
import { UserGourmetProfile } from '../lib/user-exp';
import { getFoodHistory, FoodHistoryItem } from '../lib/food-history';
import {
  LegalPageSlug,
  ConsentPurposeKey,
  DataRightsRequestType,
  DATA_RIGHTS_REQUEST_TYPE_LABELS,
  getActivePolicyMetadata,
  getStoredConsentRecord,
  updateOrWithdrawConsentViaBackend,
  submitDataRightsRequestViaBackend,
} from '../lib/legal-compliance';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAuthProfile;
  profile: UserGourmetProfile;
  onEditProfile: () => void;
  onSignOut: () => void;
  onOpenScoreboard?: () => void;
  onNavigateLegalPage?: (slug: LegalPageSlug) => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  profile,
  onEditProfile,
  onSignOut,
  onOpenScoreboard,
  onNavigateLegalPage,
}: UserProfileModalProps) {
  const [history, setHistory] = useState<FoodHistoryItem[]>([]);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState<boolean>(false);
  const [consentRecord, setConsentRecord] = useState(() =>
    getStoredConsentRecord(user?.uid, user?.email)
  );
  const [privacyNoticeMsg, setPrivacyNoticeMsg] = useState<string>('');
  const [showRequestForm, setShowRequestForm] = useState<boolean>(false);
  const [requestType, setRequestType] = useState<DataRightsRequestType>('deletion');
  const [requestDetails, setRequestDetails] = useState<string>('');
  const [submittingReq, setSubmittingReq] = useState<boolean>(false);

  const activePolicy = getActivePolicyMetadata();

  useEffect(() => {
    if (isOpen) {
      setHistory(getFoodHistory());
      setConsentRecord(getStoredConsentRecord(user?.uid, user?.email));
      setPrivacyNoticeMsg('');
    }
  }, [isOpen, user?.uid, user?.email]);

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

  const currentMascot =
    MASCOT_AVATARS.find(m => m.id === user.avatarId) || MASCOT_AVATARS[0];
  const expPercentage = Math.round(profile.progressPercent || 0);

  const genderLabel =
    user.gender === 'female' ? '👧 Nữ' : user.gender === 'other' ? '🐱 Khác' : '👦 Nam';

  const userTasteLabels = (user.tastePreferences || [])
    .map(id => TASTE_PREFERENCES_OPTIONS.find(t => t.id === id))
    .filter(Boolean);

  const handleToggleConsentPurpose = async (purpose: ConsentPurposeKey) => {
    if (!user.uid && !user.email) return;
    const currentStatus = consentRecord?.purposes?.[purpose]?.status;
    const nextStatus = currentStatus === 'granted' ? 'withdrawn' : 'granted';
    const res = await updateOrWithdrawConsentViaBackend({
      uid: user.uid || 'guest',
      email: user.email,
      purpose,
      nextStatus,
    });
    if (res.record) {
      setConsentRecord(res.record);
    }
    setPrivacyNoticeMsg(res.message);
  };

  const handleExportProfileJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      policyVersion: consentRecord?.policyVersion || activePolicy.version,
      profileData: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        nickname: user.nickname,
        gender: user.gender,
        phone: user.phone || null,
        residentType: user.residentType,
        tastePreferences: user.tastePreferences || [],
        createdAt: user.createdAt,
      },
      consentRecord: consentRecord || null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xuanhoacogi-profile-${user.uid || 'member'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPrivacyNoticeMsg('Đã trích xuất tệp dữ liệu hồ sơ cá nhân (JSON).');
  };

  const handleSubmitProfileDataRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestDetails.trim() || requestDetails.trim().length < 5) {
      setPrivacyNoticeMsg('Vui lòng nhập nội dung yêu cầu cụ thể (tối thiểu 5 ký tự).');
      return;
    }
    setSubmittingReq(true);
    try {
      const res = await submitDataRightsRequestViaBackend({
        uid: user.uid || 'guest',
        email: user.email || 'thuckhach.xuanhoa@gmail.com',
        displayName: user.displayName || user.nickname || 'Thực Khách',
        requestType,
        details: requestDetails.trim(),
      });
      setPrivacyNoticeMsg(res.message);
      if (res.ok) {
        setRequestDetails('');
        setShowRequestForm(false);
      }
    } finally {
      setSubmittingReq(false);
    }
  };

  const openLegalSlug = (slug: LegalPageSlug) => {
    onClose();
    if (onNavigateLegalPage) {
      onNavigateLegalPage(slug);
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/${slug}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div
        className="auth-modal-container user-profile-card-modal"
        onClick={e => e.stopPropagation()}
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

        <div className="user-profile-header">
          <div
            className="user-profile-avatar-large"
            style={{
              background: currentMascot.bgGradient,
            }}
          >
            <span className="user-profile-avatar-emoji">{user.avatar || '🐱'}</span>
            <div className="user-profile-gender-badge">{genderLabel.split(' ')[0]}</div>
          </div>

          <div className="user-profile-title-col">
            <h3 className="user-profile-nickname">{user.nickname}</h3>
            <div className="user-profile-email-row">
              <Mail size={12} className="text-slate-400" />
              <span className="user-profile-email-text">
                {user.email || 'thuckhach.xuanhoa@gmail.com'}
              </span>
            </div>
            {user.phone && (
              <div className="user-profile-email-row">
                <Phone size={12} className="text-amber-400" />
                <span className="user-profile-email-text text-amber-300 font-medium">
                  {user.phone}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <span className="user-profile-gender-tag">{genderLabel}</span>
              <span className="user-profile-gender-tag text-amber-300 border-amber-500/40 bg-amber-500/10">
                {currentMascot.name}
              </span>
              <span className="user-profile-gender-tag text-sky-300 border-sky-500/40 bg-sky-500/10">
                {getResidentTypeInfo(user.residentType).label}
              </span>
            </div>
          </div>
        </div>

        {/* Khẩu vị & Gu ẩm thực */}
        <div className="user-profile-taste-box">
          <div className="flex items-center justify-between mb-1.5">
            <span className="user-profile-taste-title mb-0">🎯 Lọc Theo Gu Ẩm Thực:</span>
            <button
              type="button"
              className={`auth-switch-btn ${user.filterByTaste !== false ? 'active' : ''}`}
              onClick={() => {
                saveAuthUser({
                  ...user,
                  filterByTaste: user.filterByTaste === false ? true : false,
                });
              }}
              role="switch"
              aria-checked={user.filterByTaste !== false}
              title="Bật/Tắt chế độ lọc theo gu ẩm thực"
            >
              <span className="auth-switch-thumb" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            {user.filterByTaste !== false
              ? '🟢 Đang BẬT: Vòng quay ưu tiên các món theo khẩu vị bạn đã chọn'
              : '⚪ Đang TẮT: Khám phá tất cả các món không giới hạn'}
          </p>
          {userTasteLabels.length > 0 && (
            <div className="user-profile-taste-tags">
              {userTasteLabels.map(taste => (
                <span key={taste!.id} className="user-profile-taste-pill">
                  {taste!.emoji} {taste!.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Khối Cấp Độ Ẩm Thực & Tiến trình EXP */}
        <div
          className="user-profile-exp-card"
          onClick={() => {
            onClose();
            onOpenScoreboard?.();
          }}
          style={{ cursor: 'pointer' }}
          title="Bấm để xem Bảng Điểm Thực Khách & Lộ Trình 50 Cấp Độ"
        >
          <div className="user-profile-level-row">
            <div className="flex items-center gap-2">
              <span className="user-profile-level-tag">CẤP {profile.level}</span>
              <span className="user-profile-tier-name">
                {profile.badge ? `${profile.badge} ` : ''}
                {profile.title}
              </span>
            </div>
            <span className="user-profile-exp-ratio">
              {profile.dishesCount || 1} / {profile.nextLevelDishes || 4} món ăn
            </span>
          </div>

          <div className="user-profile-progress-track">
            <div
              className="user-profile-progress-fill"
              style={{ width: `${expPercentage}%` }}
            />
          </div>

          <div className="user-profile-spins-meta">
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles size={12} className="text-amber-400" />
              Đã mở hộp: <strong className="text-slate-200">{profile.spinsCount} lượt</strong>
            </span>
            <span className="text-amber-400 font-semibold">
              {expPercentage}% · Xem Bảng Điểm 🏆
            </span>
          </div>
        </div>

        {/* ================================================================
            PHẦN E — QUYỀN RIÊNG TƯ & DỮ LIỆU CÁ NHÂN TRONG HỒ SƠ THÀNH VIÊN
            ================================================================ */}
        <div
          data-testid="profile-privacy-data-rights-section"
          className="my-3 rounded-2xl bg-slate-900/90 border border-amber-500/30 p-3.5 text-left space-y-2.5"
        >
          <button
            type="button"
            data-testid="profile-privacy-toggle-btn"
            onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
            className="w-full flex items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-300">
                  Quyền riêng tư &amp; Dữ liệu cá nhân
                </div>
                <div className="text-[10.5px] text-slate-400">
                  Chính sách đã xác nhận: {consentRecord?.policyVersion || activePolicy.version} · Rút đồng ý / Xuất hoặc xóa dữ liệu
                </div>
              </div>
            </div>
            {isPrivacyExpanded ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </button>

          {isPrivacyExpanded && (
            <div className="pt-2.5 border-t border-slate-700/80 space-y-3 text-xs">
              {/* 1. Xem chính sách đã xác nhận */}
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <div className="font-semibold text-slate-200">1. Chính sách đã xác nhận:</div>
                <div className="text-[11px] text-slate-300">
                  Phiên bản Điều khoản: <code>{consentRecord?.policyVersion || activePolicy.version}</code> · Thông báo bảo mật: <code>{consentRecord?.privacyNoticeVersion || activePolicy.privacyNoticeVersion}</code>
                </div>
                {consentRecord?.serverTimestamp && (
                  <div className="text-[10.5px] text-slate-400">
                    Thời điểm xác nhận: {new Date(consentRecord.serverTimestamp).toLocaleString('vi-VN')} ({consentRecord.verificationSource})
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openLegalSlug('terms')}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Điều khoản (/terms)
                  </button>
                  <button
                    type="button"
                    onClick={() => openLegalSlug('privacy')}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Bảo mật (/privacy)
                  </button>
                  <button
                    type="button"
                    onClick={() => openLegalSlug('community-guidelines')}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Quy định cộng đồng
                  </button>
                  <button
                    type="button"
                    onClick={() => openLegalSlug('data-rights')}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Trung tâm quyền dữ liệu (/data-rights)
                  </button>
                </div>
              </div>

              {/* 2. Kiểm tra & Bật/tắt hoặc rút lại các đồng ý tùy chọn */}
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-200">
                  2. Quản lý các đồng ý tùy chọn (Bật/Tắt hoặc Rút lại):
                </div>
                {(
                  [
                    {
                      key: 'optional_taste_phone',
                      label: 'Cá nhân hóa khẩu vị & lưu SĐT liên hệ',
                    },
                    {
                      key: 'optional_analytics',
                      label: 'Phân tích thống kê trải nghiệm không thiết yếu',
                    },
                    {
                      key: 'optional_marketing',
                      label: 'Nhận thông báo sự kiện & địa điểm mới',
                    },
                  ] as const
                ).map(item => {
                  const st = consentRecord?.purposes?.[item.key]?.status || 'denied';
                  const isGranted = st === 'granted';
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/70 border border-slate-700/80"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-200 truncate">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Trạng thái:{' '}
                          <span className={isGranted ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                            {isGranted ? 'Đang đồng ý' : st === 'withdrawn' ? 'Đã rút lại' : 'Chưa bật'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`profile-consent-toggle-${item.key}`}
                        onClick={() => handleToggleConsentPurpose(item.key)}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 transition ${
                          isGranted
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        }`}
                      >
                        {isGranted ? 'Rút lại đồng ý' : 'Bật đồng ý'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 3. Xem/Xuất dữ liệu hồ sơ & Gửi yêu cầu sửa/xóa tài khoản */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  data-testid="profile-export-data-btn"
                  onClick={handleExportProfileJson}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold"
                >
                  <Download size={12} />
                  <span>Xuất dữ liệu hồ sơ (JSON)</span>
                </button>

                <button
                  type="button"
                  data-testid="profile-open-data-request-form-btn"
                  onClick={() => setShowRequestForm(!showRequestForm)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-semibold"
                >
                  <Trash2 size={12} />
                  <span>Yêu cầu sửa / xóa dữ liệu hoặc tài khoản</span>
                </button>
              </div>

              {showRequestForm && (
                <form
                  onSubmit={handleSubmitProfileDataRequest}
                  className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 space-y-2"
                >
                  <select
                    data-testid="profile-data-request-type-select"
                    value={requestType}
                    onChange={e => setRequestType(e.target.value as DataRightsRequestType)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-[11px] text-slate-200"
                  >
                    {(Object.keys(DATA_RIGHTS_REQUEST_TYPE_LABELS) as DataRightsRequestType[]).map(k => (
                      <option key={k} value={k}>
                        {DATA_RIGHTS_REQUEST_TYPE_LABELS[k].label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    data-testid="profile-data-request-details-input"
                    rows={2}
                    value={requestDetails}
                    onChange={e => setRequestDetails(e.target.value)}
                    placeholder="Mô tả yêu cầu của bạn (VD: Xóa tài khoản & dữ liệu cá nhân khỏi hệ thống)..."
                    className="w-full rounded-lg bg-slate-900 border border-slate-600 px-2.5 py-1.5 text-[11px] text-slate-200"
                  />
                  <button
                    type="submit"
                    disabled={submittingReq}
                    data-testid="profile-data-request-submit-btn"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px]"
                  >
                    <Send size={11} />
                    <span>{submittingReq ? 'Đang gửi...' : 'Gửi yêu cầu tới Bộ phận phụ trách'}</span>
                  </button>
                </form>
              )}

              {privacyNoticeMsg && (
                <div
                  data-testid="profile-privacy-feedback-msg"
                  className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px]"
                >
                  {privacyNoticeMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lịch sử món đã ăn / đã quay lưu lại */}
        <div className="user-profile-history-section">
          <div className="user-profile-history-header">
            <span className="user-profile-history-title">
              🍲 Món Đã Ăn &amp; Mở Gần Đây ({history.length})
            </span>
          </div>
          {history.length > 0 ? (
            <div className="user-profile-history-list">
              {history.slice(0, 4).map(item => (
                <div key={item.id} className="user-profile-history-item">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="user-profile-history-img"
                  />
                  <div className="user-profile-history-info">
                    <span className="user-profile-history-name truncate">{item.name}</span>
                    <span className="user-profile-history-meta">
                      {item.price}.000đ {item.placeName ? `· ${item.placeName}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="user-profile-history-empty">
              Chưa có món trong lịch sử. Hãy quay hòm để tự động lưu các món đã ăn nhé!
            </p>
          )}
        </div>

        {/* 2 Nút Hành động */}
        <div className="user-profile-actions-row">
          <button
            type="button"
            className="user-profile-edit-btn"
            onClick={() => {
              onClose();
              onEditProfile();
            }}
          >
            <Edit3 size={15} />
            <span>Sửa hồ sơ &amp; Avatar</span>
          </button>

          <button
            type="button"
            className="user-profile-logout-btn"
            onClick={() => {
              onClose();
              onSignOut();
            }}
          >
            <LogOut size={15} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </div>
  );
}
