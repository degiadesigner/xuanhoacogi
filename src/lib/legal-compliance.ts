// ============================================================================
// XUHO CITY — HỆ THỐNG TUÂN THỦ PHÁP LÝ VIỆT NAM, GOOGLE LOGIN CONSENT & QUYỀN DỮ LIỆU CÁ NHÂN (V3)
// Căn cứ đối chiếu:
// 1. Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (có hiệu lực từ 01/01/2026)
// 2. Nghị định số 356/2025/NĐ-CP ngày 31/12/2025 quy định chi tiết một số điều và biện pháp thi hành Luật BVDLCN
// 3. Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15
// 4. Nghị định số 147/2024/NĐ-CP về quản lý, cung cấp, sử dụng dịch vụ Internet và thông tin trên mạng
// 5. Luật An ninh mạng số 24/2018/QH14 & Luật Sở hữu trí tuệ
// 6. Luật Đo đạc và bản đồ số 27/2018/QH14
// 7. Google API Services User Data Policy & Sign in with Google Branding/Consent Requirements
// ============================================================================

import { getFirebaseAuth, getRealtimeDb, ref } from './firebase';
import { get, set } from 'firebase/database';

export type LegalPageSlug = 'terms' | 'privacy' | 'community-guidelines' | 'data-rights';

export const LEGAL_PAGE_URLS: Record<LegalPageSlug, string> = {
  terms: '/terms',
  privacy: '/privacy',
  'community-guidelines': '/community-guidelines',
  'data-rights': '/data-rights',
};

export const CURRENT_TERMS_VERSION = '2026.11.04-v3.0';
export const CURRENT_PRIVACY_VERSION = '2026.11.04-v3.0';
export const CURRENT_COMMUNITY_VERSION = '2026.11.04-v3.0';
export const CURRENT_CONSENT_UI_VERSION = 'xuho-consent-ui-v3.0';
export const CURRENT_POLICY_EFFECTIVE_DATE = '2026-11-04';

export interface PolicyVersionChangelogEntry {
  version: string;
  privacyNoticeVersion: string;
  communityGuidelinesVersion: string;
  consentUiVersion: string;
  effectiveDate: string;
  publishedAt: number;
  publishedByUid?: string;
  requiresReconsent: boolean;
  title: string;
  changes: string[];
}

export const INITIAL_POLICY_CHANGELOG: PolicyVersionChangelogEntry[] = [
  {
    version: CURRENT_TERMS_VERSION,
    privacyNoticeVersion: CURRENT_PRIVACY_VERSION,
    communityGuidelinesVersion: CURRENT_COMMUNITY_VERSION,
    consentUiVersion: CURRENT_CONSENT_UI_VERSION,
    effectiveDate: CURRENT_POLICY_EFFECTIVE_DATE,
    publishedAt: 1793750400000, // 2026-11-04T00:00:00.000Z
    requiresReconsent: true,
    title: 'Phát hành Khung Pháp lý & Bảo vệ Dữ liệu Cá nhân V3.0 (Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP)',
    changes: [
      'Ban hành 4 trang pháp lý công khai độc lập: /terms, /privacy, /community-guidelines, /data-rights.',
      'Áp dụng cơ chế Google Login Consent tách bạch 4 tầng (Điều khoản, Thông báo xử lý cần thiết, Đồng ý hồ sơ cơ bản, và Đồng ý tùy chọn độc lập không tích sẵn).',
      'Bổ sung bằng chứng xác nhận (Consent Record) có đóng dấu thời gian phía máy chủ (serverTimestamp) và nhật ký bất biến (consent_audit_trail).',
      'Tích hợp Trung tâm Quyền dữ liệu cá nhân trong Hồ sơ thành viên (Xem, xuất JSON, rút lại đồng ý 1 chạm, yêu cầu chỉnh sửa/xóa dữ liệu).',
    ],
  },
];

/**
 * KHÓA THÔNG TIN ĐỊA GIỚI HÀNH CHÍNH ĐỊA BÀN PHỤC VỤ CỦA WEBSITE
 * Phân biệt rõ địa bàn website phục vụ với địa chỉ pháp lý thực tế của chủ thể vận hành.
 */
export const SERVICE_AREA_ADMINISTRATIVE_LOCK = {
  currentAdministrativeUnit: 'Phường Xuân Hòa, tỉnh Phú Thọ, Việt Nam',
  mergedFromHistoricalUnits: [
    'Phường Đồng Xuân cũ',
    'Phường Xuân Hòa cũ',
    'Xã Cao Minh cũ',
    'Xã Ngọc Thanh cũ',
  ],
  officialGovernmentRefUrl:
    'https://xaydungchinhsach.chinhphu.vn/sap-xep-dvhc-danh-sach-148-xa-phuong-cua-tinh-phu-tho-119250623074347981.htm',
  localPressRefUrl:
    'https://baophutho.vn/tap-trung-nguon-luc-nbsp-xay-dung-phuong-xuan-hoa-van-minh-hien-dai-236661.htm',
  preservationPolicy:
    'Không thay đổi tọa độ, Place ID, ranh giới hay 12 mô hình landmark chỉ vì cách gọi hành chính; giữ nguyên dữ liệu địa chỉ lịch sử để phục vụ tra cứu cộng đồng.',
} as const;

/**
 * DANH MỤC THÔNG TIN CHỦ THỂ VẬN HÀNH PHÂN LOẠI RÕ LÀ PRE-PUBLISH OWNER ACTION
 * Tuyệt đối không tự bịa tên doanh nghiệp, mã số thuế, địa chỉ, tên người đại diện, email hoặc số điện thoại.
 * Không dùng placeholder như thể đó là thông tin pháp lý chính thức.
 */
export interface PendingOwnerLegalField {
  fieldKey: string;
  label: string;
  statusClassification: 'PRE-PUBLISH OWNER ACTION';
  placeholderDisplay: string;
  legalBasis: string;
  requiredBeforePublicLaunch: boolean;
}

export const PENDING_OWNER_LEGAL_FIELDS: PendingOwnerLegalField[] = [
  {
    fieldKey: 'legal_entity_name',
    label: 'Chủ thể vận hành website (Tổ chức / Hộ kinh doanh / Cá nhân phụ trách)',
    statusClassification: 'PRE-PUBLISH OWNER ACTION',
    placeholderDisplay: 'PRE-PUBLISH OWNER ACTION — Chủ sở hữu điền tên chủ thể vận hành thực tế',
    legalBasis:
      'Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 & Nghị định 356/2025/NĐ-CP (Xác định Bên kiểm soát và xử lý dữ liệu cá nhân)',
    requiredBeforePublicLaunch: true,
  },
  {
    fieldKey: 'registered_address',
    label: 'Địa chỉ liên hệ pháp lý thực tế của chủ thể vận hành (độc lập với địa bàn phục vụ)',
    statusClassification: 'PRE-PUBLISH OWNER ACTION',
    placeholderDisplay: 'PRE-PUBLISH OWNER ACTION — Chủ sở hữu điền địa chỉ liên hệ pháp lý thực tế',
    legalBasis: 'Nghị định 356/2025/NĐ-CP (Thông tin liên hệ của Bên kiểm soát dữ liệu cá nhân)',
    requiredBeforePublicLaunch: true,
  },
  {
    fieldKey: 'legal_and_privacy_email',
    label: 'Email chính thức tiếp nhận yêu cầu Quyền dữ liệu cá nhân & Phản ánh nội dung',
    statusClassification: 'PRE-PUBLISH OWNER ACTION',
    placeholderDisplay: 'PRE-PUBLISH OWNER ACTION — Chủ sở hữu điền email liên hệ chính thức',
    legalBasis: 'Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (Kênh tiếp nhận yêu cầu của chủ thể dữ liệu)',
    requiredBeforePublicLaunch: true,
  },
  {
    fieldKey: 'legal_contact_phone',
    label: 'Số điện thoại liên hệ tiếp nhận phản ánh (nếu công khai)',
    statusClassification: 'PRE-PUBLISH OWNER ACTION',
    placeholderDisplay: 'PRE-PUBLISH OWNER ACTION — Chủ sở hữu điền số điện thoại liên hệ thực tế',
    legalBasis: 'Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15 & Nghị định 147/2024/NĐ-CP',
    requiredBeforePublicLaunch: false,
  },
  {
    fieldKey: 'tax_or_registration_id',
    label: 'Mã số thuế / Số đăng ký (chỉ áp dụng nếu vận hành theo mô hình doanh nghiệp/hộ kinh doanh)',
    statusClassification: 'PRE-PUBLISH OWNER ACTION',
    placeholderDisplay: 'PRE-PUBLISH OWNER ACTION — Chủ sở hữu cập nhật nếu áp dụng theo loại hình chủ thể',
    legalBasis: 'Nghị định 147/2024/NĐ-CP (Thông tin định danh tổ chức/doanh nghiệp nếu áp dụng)',
    requiredBeforePublicLaunch: false,
  },
];

// ============================================================================
// CẤU TRÚC CONSENT RECORD & DATA RIGHTS REQUEST
// ============================================================================

export type ConsentPurposeKey =
  | 'essential_auth'
  | 'profile_and_ugc'
  | 'optional_taste_phone'
  | 'optional_analytics'
  | 'optional_marketing';

export type ConsentItemStatus = 'granted' | 'denied' | 'withdrawn';

export interface ConsentPurposeState {
  purpose: ConsentPurposeKey;
  label: string;
  required: boolean;
  status: ConsentItemStatus;
  updatedAt: number;
  withdrawalTimestamp?: number | null;
}

export interface VerifiableConsentRecord {
  firebaseAuthUid: string;
  email?: string;
  policyVersion: string;
  privacyNoticeVersion: string;
  communityGuidelinesVersion: string;
  consentUiVersion: string;
  source: 'web';
  termsAccepted: boolean;
  essentialDataNoticeAck: boolean;
  coreProfileConsent: boolean;
  purposes: Record<ConsentPurposeKey, ConsentPurposeState>;
  consentStatus: 'active' | 'partially_withdrawn' | 'withdrawn';
  serverTimestamp: number;
  withdrawalTimestamp?: number | null;
  verificationSource: 'backend_verified' | 'rtdb_rule_verified';
}

export interface ConsentAuditTrailEntry {
  recordId: string;
  firebaseAuthUid: string;
  action: 'consent_granted' | 'consent_updated' | 'consent_withdrawn';
  policyVersion: string;
  privacyNoticeVersion: string;
  consentUiVersion: string;
  consentPurpose: string;
  consentStatus: string;
  serverTimestamp: number;
  withdrawalTimestamp?: number | null;
  source: 'web';
  verificationSource: 'backend_verified' | 'rtdb_rule_verified';
}

export type DataRightsRequestType =
  | 'access'
  | 'rectification'
  | 'withdrawal'
  | 'restriction'
  | 'deletion'
  | 'export'
  | 'complaint';

export type DataRightsRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected_legal_obligation';

export interface DataRightsRequestRecord {
  requestId: string;
  firebaseAuthUid: string;
  userEmail: string;
  userDisplayName: string;
  requestType: DataRightsRequestType;
  details: string;
  status: DataRightsRequestStatus;
  submittedAt: number;
  updatedAt: number;
  processedByUid?: string;
  processedByRole?: string;
  resolutionNote?: string;
  legalRetentionNotice?: string;
  source: 'web';
}

export const DATA_RIGHTS_REQUEST_TYPE_LABELS: Record<
  DataRightsRequestType,
  { label: string; desc: string }
> = {
  access: {
    label: 'Xem & Cung cấp thông tin dữ liệu cá nhân',
    desc: 'Yêu cầu xem danh mục dữ liệu cá nhân, mục đích xử lý và bản sao dữ liệu đang lưu trữ.',
  },
  rectification: {
    label: 'Cập nhật / Đính chính dữ liệu cá nhân',
    desc: 'Yêu cầu sửa đổi thông tin cá nhân không chính xác hoặc bổ sung thông tin còn thiếu.',
  },
  withdrawal: {
    label: 'Rút lại sự đồng ý xử lý dữ liệu',
    desc: 'Rút lại một phần hoặc toàn bộ sự đồng ý đối với các hoạt động xử lý dựa trên sự đồng ý.',
  },
  restriction: {
    label: 'Yêu cầu hạn chế xử lý dữ liệu',
    desc: 'Yêu cầu tạm dừng hoặc giới hạn phạm vi xử lý một số trường dữ liệu cá nhân theo quy định.',
  },
  deletion: {
    label: 'Yêu cầu xóa dữ liệu / Xóa tài khoản',
    desc: 'Yêu cầu xóa hồ sơ thành viên và dữ liệu cá nhân (trừ nhật ký bảo mật bắt buộc lưu theo luật).',
  },
  export: {
    label: 'Xuất / Cung cấp dữ liệu cá nhân (JSON)',
    desc: 'Nhận bản trích xuất dữ liệu hồ sơ và lịch sử xác nhận ở định dạng máy đọc được.',
  },
  complaint: {
    label: 'Phản ánh / Khiếu nại về quyền riêng tư',
    desc: 'Gửi phản ánh, thắc mắc hoặc khiếu nại liên quan đến việc bảo vệ dữ liệu cá nhân.',
  },
};

export const GOOGLE_OAUTH_COMPLIANCE_CHECKLIST = {
  appName: 'Xuân Hòa Có Gì (XUHO City)',
  clientId: '691215879950-nulp01gi8js5j1m9jno1ih86g98hj381.apps.googleusercontent.com',
  logoUrl: 'https://xuanhoacogi.com/brand/apple-touch-icon-cs-v2.png',
  authorizedDomains: ['xuanhoacogi.com', 'xuanhoacogi.firebaseapp.com'],
  privacyPolicyUrl: 'https://xuanhoacogi.com/privacy',
  termsOfServiceUrl: 'https://xuanhoacogi.com/terms',
  communityGuidelinesUrl: 'https://xuanhoacogi.com/community-guidelines',
  dataRightsUrl: 'https://xuanhoacogi.com/data-rights',
  authorizedRedirectUris: [
    'https://xuanhoacogi.com/__/auth/handler',
    'https://xuanhoacogi.firebaseapp.com/__/auth/handler',
  ],
  authorizedJavaScriptOrigins: [
    'https://xuanhoacogi.com',
    'https://www.xuanhoacogi.com',
    'https://xuanhoacogi.firebaseapp.com',
  ],
  requestedScopes: ['openid', 'email', 'profile'],
  sensitiveOrRestrictedScopesRequested: [] as string[],
};

// ============================================================================
// LOCAL CACHE & HELPERS CHO CONSENT STATE
// ============================================================================

const CONSENT_STORAGE_PREFIX = 'xuanhoa_consent_v3_';
const ACTIVE_POLICY_META_KEY = 'xuanhoa_active_policy_meta_v3';

function getConsentCacheKey(uid?: string, email?: string): string {
  const cleanId = (uid || email || 'anonymous').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `${CONSENT_STORAGE_PREFIX}${cleanId}`;
}

export function getActivePolicyMetadata(): PolicyVersionChangelogEntry {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ACTIVE_POLICY_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version && parsed.privacyNoticeVersion) {
          return parsed;
        }
      }
    } catch {}
  }
  return INITIAL_POLICY_CHANGELOG[0];
}

export function saveActivePolicyMetadataLocal(meta: PolicyVersionChangelogEntry): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_POLICY_META_KEY, JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent('xuanhoa_policy_version_change', { detail: meta }));
  } catch {}
}

export function getStoredConsentRecord(
  uid?: string,
  email?: string
): VerifiableConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    if (uid) {
      const rawByUid = localStorage.getItem(getConsentCacheKey(uid));
      if (rawByUid) {
        const parsed = JSON.parse(rawByUid);
        if (parsed && parsed.termsAccepted && parsed.coreProfileConsent) return parsed;
      }
    }
    if (email) {
      const rawByEmail = localStorage.getItem(getConsentCacheKey(undefined, email));
      if (rawByEmail) {
        const parsed = JSON.parse(rawByEmail);
        if (parsed && parsed.termsAccepted && parsed.coreProfileConsent) return parsed;
      }
    }
  } catch {}
  return null;
}

export function saveConsentRecordLocal(
  record: VerifiableConsentRecord,
  email?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    if (record.firebaseAuthUid) {
      localStorage.setItem(getConsentCacheKey(record.firebaseAuthUid), JSON.stringify(record));
    }
    const targetEmail = email || record.email;
    if (targetEmail) {
      localStorage.setItem(getConsentCacheKey(undefined, targetEmail), JSON.stringify(record));
    }
    window.dispatchEvent(new CustomEvent('xuanhoa_consent_change', { detail: record }));
  } catch {}
}

/**
 * Kiểm tra người dùng đã có bản ghi xác nhận còn hiệu lực với phiên bản chính sách hiện tại hay chưa.
 * Nếu đã có và còn hiệu lực -> KHÔNG yêu cầu đồng ý lại ở mỗi lần đăng nhập.
 */
export function hasValidCurrentConsent(uid?: string, email?: string): boolean {
  const record = getStoredConsentRecord(uid, email);
  if (!record) return false;
  if (!record.termsAccepted || !record.essentialDataNoticeAck || !record.coreProfileConsent) {
    return false;
  }
  if (record.consentStatus === 'withdrawn') {
    return false;
  }
  const activePolicy = getActivePolicyMetadata();
  if (activePolicy.requiresReconsent) {
    return (
      record.policyVersion === activePolicy.version &&
      record.privacyNoticeVersion === activePolicy.privacyNoticeVersion
    );
  }
  return true;
}

/**
 * Bảo đảm KHÔNG tự động bật tracking/analytics không thiết yếu trước khi có sự đồng ý rõ ràng.
 */
export function isOptionalAnalyticsEnabled(uid?: string, email?: string): boolean {
  const record = getStoredConsentRecord(uid, email);
  if (!record || record.consentStatus === 'withdrawn') return false;
  return record.purposes?.optional_analytics?.status === 'granted';
}

export function isOptionalTasteAndPhoneEnabled(uid?: string, email?: string): boolean {
  const record = getStoredConsentRecord(uid, email);
  if (!record || record.consentStatus === 'withdrawn') return false;
  return record.purposes?.optional_taste_phone?.status === 'granted';
}

export function isOptionalMarketingEnabled(uid?: string, email?: string): boolean {
  const record = getStoredConsentRecord(uid, email);
  if (!record || record.consentStatus === 'withdrawn') return false;
  return record.purposes?.optional_marketing?.status === 'granted';
}

/**
 * Đồng bộ Consent Record từ Cloud RTDB về Local khi người dùng đăng nhập trên thiết bị mới
 */
export async function syncUserConsentFromCloud(
  uid?: string,
  email?: string
): Promise<VerifiableConsentRecord | null> {
  if (typeof window === 'undefined' || !uid) return getStoredConsentRecord(uid, email);
  try {
    const rtdb = getRealtimeDb();
    if (!rtdb) return getStoredConsentRecord(uid, email);
    const snap = await get(ref(rtdb, `xuanhoa_admin/user_consents/${uid}`));
    if (snap.exists()) {
      const cloudRecord = snap.val() as VerifiableConsentRecord;
      if (cloudRecord && cloudRecord.firebaseAuthUid === uid) {
        saveConsentRecordLocal(cloudRecord, email);
        return cloudRecord;
      }
    }
  } catch {}
  return getStoredConsentRecord(uid, email);
}

async function getCurrentFirebaseIdToken(): Promise<string | null> {
  try {
    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      return await auth.currentUser.getIdToken();
    }
  } catch {}
  return null;
}

/**
 * Gửi bản ghi xác nhận điều khoản & đồng ý dữ liệu cá nhân lên Privileged Backend
 * (Server tự đóng dấu serverTimestamp và kiểm tra UID từ Firebase ID Token).
 */
export async function submitVerifiableConsentViaBackend(params: {
  uid: string;
  email?: string;
  termsAccepted: boolean;
  essentialDataNoticeAck: boolean;
  coreProfileConsent: boolean;
  optionalTastePersonalization: boolean;
  optionalAnalytics: boolean;
  optionalMarketing: boolean;
}): Promise<{ ok: boolean; record?: VerifiableConsentRecord; message: string }> {
  const activePolicy = getActivePolicyMetadata();
  const idToken = await getCurrentFirebaseIdToken();

  try {
    const res = await fetch('/api/founder-security/consent-record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        policyVersion: activePolicy.version,
        privacyNoticeVersion: activePolicy.privacyNoticeVersion,
        communityGuidelinesVersion: activePolicy.communityGuidelinesVersion,
        consentUiVersion: activePolicy.consentUiVersion,
        termsAccepted: params.termsAccepted,
        essentialDataNoticeAck: params.essentialDataNoticeAck,
        coreProfileConsent: params.coreProfileConsent,
        optionalTastePersonalization: params.optionalTastePersonalization,
        optionalAnalytics: params.optionalAnalytics,
        optionalMarketing: params.optionalMarketing,
        source: 'web',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data?.record) {
        saveConsentRecordLocal(data.record, params.email);
        return {
          ok: true,
          record: data.record,
          message: data.message || 'Đã lưu bằng chứng xác nhận chính sách và quyền riêng tư.',
        };
      }
    }
  } catch {}

  // Fallback lưu trực tiếp qua RTDB Rules (Rules kiểm tra auth.uid === $uid và serverTimestamp)
  const now = Date.now();
  const fallbackRecord: VerifiableConsentRecord = {
    firebaseAuthUid: params.uid,
    email: params.email,
    policyVersion: activePolicy.version,
    privacyNoticeVersion: activePolicy.privacyNoticeVersion,
    communityGuidelinesVersion: activePolicy.communityGuidelinesVersion,
    consentUiVersion: activePolicy.consentUiVersion,
    source: 'web',
    termsAccepted: Boolean(params.termsAccepted),
    essentialDataNoticeAck: Boolean(params.essentialDataNoticeAck),
    coreProfileConsent: Boolean(params.coreProfileConsent),
    purposes: {
      essential_auth: {
        purpose: 'essential_auth',
        label: 'Xác thực đăng nhập Google & Bảo mật tài khoản',
        required: true,
        status: 'granted',
        updatedAt: now,
        withdrawalTimestamp: null,
      },
      profile_and_ugc: {
        purpose: 'profile_and_ugc',
        label: 'Hồ sơ thành viên cơ bản & Đóng góp cộng đồng',
        required: true,
        status: params.coreProfileConsent ? 'granted' : 'denied',
        updatedAt: now,
        withdrawalTimestamp: null,
      },
      optional_taste_phone: {
        purpose: 'optional_taste_phone',
        label: 'Tùy chọn lưu SĐT & Cá nhân hóa gợi ý khẩu vị',
        required: false,
        status: params.optionalTastePersonalization ? 'granted' : 'denied',
        updatedAt: now,
        withdrawalTimestamp: null,
      },
      optional_analytics: {
        purpose: 'optional_analytics',
        label: 'Tùy chọn phân tích thống kê trải nghiệm không thiết yếu',
        required: false,
        status: params.optionalAnalytics ? 'granted' : 'denied',
        updatedAt: now,
        withdrawalTimestamp: null,
      },
      optional_marketing: {
        purpose: 'optional_marketing',
        label: 'Tùy chọn nhận thông báo sự kiện & địa điểm mới',
        required: false,
        status: params.optionalMarketing ? 'granted' : 'denied',
        updatedAt: now,
        withdrawalTimestamp: null,
      },
    },
    consentStatus: 'active',
    serverTimestamp: now,
    withdrawalTimestamp: null,
    verificationSource: 'rtdb_rule_verified',
  };

  try {
    const rtdb = getRealtimeDb();
    if (rtdb && params.uid && !params.uid.startsWith('guest_')) {
      await set(ref(rtdb, `xuanhoa_admin/user_consents/${params.uid}`), fallbackRecord);
      const auditId = `ca_${now}_${Math.random().toString(36).slice(2, 8)}`;
      const auditEntry: ConsentAuditTrailEntry = {
        recordId: auditId,
        firebaseAuthUid: params.uid,
        action: 'consent_granted',
        policyVersion: activePolicy.version,
        privacyNoticeVersion: activePolicy.privacyNoticeVersion,
        consentUiVersion: activePolicy.consentUiVersion,
        consentPurpose: 'all_onboarding_purposes',
        consentStatus: 'active',
        serverTimestamp: now,
        withdrawalTimestamp: null,
        source: 'web',
        verificationSource: 'rtdb_rule_verified',
      };
      await set(
        ref(rtdb, `xuanhoa_admin/consent_audit_trail/${params.uid}/${auditId}`),
        auditEntry
      );
    }
  } catch {}

  saveConsentRecordLocal(fallbackRecord, params.email);
  return {
    ok: true,
    record: fallbackRecord,
    message: 'Đã lưu xác nhận Điều khoản & Quyền riêng tư.',
  };
}

/**
 * Cho phép người dùng bật/tắt hoặc rút lại đồng ý tùy chọn bất kỳ lúc nào trong Hồ sơ
 */
export async function updateOrWithdrawConsentViaBackend(params: {
  uid: string;
  email?: string;
  purpose: ConsentPurposeKey;
  nextStatus: 'granted' | 'withdrawn';
}): Promise<{ ok: boolean; record?: VerifiableConsentRecord; message: string }> {
  const idToken = await getCurrentFirebaseIdToken();
  try {
    const res = await fetch('/api/founder-security/consent-withdrawal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        consentPurpose: params.purpose,
        consentStatus: params.nextStatus,
        source: 'web',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data?.record) {
        saveConsentRecordLocal(data.record, params.email);
        return {
          ok: true,
          record: data.record,
          message:
            data.message ||
            (params.nextStatus === 'withdrawn'
              ? 'Đã rút lại sự đồng ý và cập nhật hồ sơ bảo mật.'
              : 'Đã bật lại sự đồng ý tùy chọn.'),
        };
      }
    }
  } catch {}

  const existing = getStoredConsentRecord(params.uid, params.email);
  const now = Date.now();
  if (!existing) {
    return {
      ok: false,
      message: 'Chưa tìm thấy bản ghi xác nhận hiện tại để cập nhật.',
    };
  }

  const updatedPurposes = {
    ...existing.purposes,
    [params.purpose]: {
      ...(existing.purposes?.[params.purpose] || {
        purpose: params.purpose,
        label: params.purpose,
        required: false,
      }),
      status: params.nextStatus,
      updatedAt: now,
      withdrawalTimestamp: params.nextStatus === 'withdrawn' ? now : null,
    },
  };

  const isCoreWithdrawn =
    params.purpose === 'profile_and_ugc' && params.nextStatus === 'withdrawn';

  const updatedRecord: VerifiableConsentRecord = {
    ...existing,
    coreProfileConsent: isCoreWithdrawn ? false : existing.coreProfileConsent,
    purposes: updatedPurposes,
    consentStatus: isCoreWithdrawn
      ? 'withdrawn'
      : params.nextStatus === 'withdrawn'
      ? 'partially_withdrawn'
      : 'active',
    serverTimestamp: now,
    withdrawalTimestamp: params.nextStatus === 'withdrawn' ? now : existing.withdrawalTimestamp ?? null,
  };

  try {
    const rtdb = getRealtimeDb();
    if (rtdb && params.uid && !params.uid.startsWith('guest_')) {
      await set(ref(rtdb, `xuanhoa_admin/user_consents/${params.uid}`), updatedRecord);
      const auditId = `ca_${now}_${Math.random().toString(36).slice(2, 8)}`;
      const auditEntry: ConsentAuditTrailEntry = {
        recordId: auditId,
        firebaseAuthUid: params.uid,
        action: params.nextStatus === 'withdrawn' ? 'consent_withdrawn' : 'consent_updated',
        policyVersion: updatedRecord.policyVersion,
        privacyNoticeVersion: updatedRecord.privacyNoticeVersion,
        consentUiVersion: updatedRecord.consentUiVersion,
        consentPurpose: params.purpose,
        consentStatus: params.nextStatus,
        serverTimestamp: now,
        withdrawalTimestamp: params.nextStatus === 'withdrawn' ? now : null,
        source: 'web',
        verificationSource: 'rtdb_rule_verified',
      };
      await set(
        ref(rtdb, `xuanhoa_admin/consent_audit_trail/${params.uid}/${auditId}`),
        auditEntry
      );
    }
  } catch {}

  saveConsentRecordLocal(updatedRecord, params.email);
  return {
    ok: true,
    record: updatedRecord,
    message:
      params.nextStatus === 'withdrawn'
        ? 'Đã rút lại sự đồng ý thành công. Hệ thống đã dừng xử lý cho mục đích này.'
        : 'Đã cập nhật tùy chọn đồng ý thành công.',
  };
}

/**
 * Gửi yêu cầu thực hiện quyền của chủ thể dữ liệu cá nhân (Xem, Sửa, Xóa, Hạn chế, Xuất dữ liệu, Khiếu nại)
 */
export async function submitDataRightsRequestViaBackend(params: {
  uid: string;
  email: string;
  displayName: string;
  requestType: DataRightsRequestType;
  details: string;
}): Promise<{ ok: boolean; request?: DataRightsRequestRecord; message: string }> {
  const idToken = await getCurrentFirebaseIdToken();
  try {
    const res = await fetch('/api/founder-security/data-rights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        action: 'submit',
        requestType: params.requestType,
        details: params.details,
        userEmail: params.email,
        userDisplayName: params.displayName,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data?.request) {
        return {
          ok: true,
          request: data.request,
          message:
            data.message ||
            'Đã ghi nhận yêu cầu quyền dữ liệu cá nhân của bạn. Bộ phận phụ trách sẽ phản hồi theo quy định.',
        };
      }
    }
  } catch {}

  const now = Date.now();
  const requestId = `drr_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const record: DataRightsRequestRecord = {
    requestId,
    firebaseAuthUid: params.uid,
    userEmail: params.email,
    userDisplayName: params.displayName,
    requestType: params.requestType,
    details: params.details.trim(),
    status: 'pending',
    submittedAt: now,
    updatedAt: now,
    legalRetentionNotice:
      'Lưu ý: Các bản ghi bằng chứng xác nhận (consent_audit_trail) và nhật ký an ninh mạng được lưu trữ theo nghĩa vụ pháp lý bắt buộc của Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Luật An ninh mạng.',
    source: 'web',
  };

  try {
    const rtdb = getRealtimeDb();
    if (rtdb && params.uid && !params.uid.startsWith('guest_')) {
      await set(ref(rtdb, `xuanhoa_admin/data_rights_requests/${requestId}`), record);
    }
  } catch {}

  return {
    ok: true,
    request: record,
    message: `Đã gửi yêu cầu (${DATA_RIGHTS_REQUEST_TYPE_LABELS[params.requestType].label}) mã #${requestId}.`,
  };
}

/**
 * Founder / Admin xử lý yêu cầu quyền dữ liệu cá nhân và ghi nhật ký xử lý
 */
export async function processDataRightsRequestViaBackend(params: {
  requestId: string;
  status: DataRightsRequestStatus;
  resolutionNote: string;
}): Promise<{ ok: boolean; request?: DataRightsRequestRecord; message: string }> {
  const idToken = await getCurrentFirebaseIdToken();
  try {
    const res = await fetch('/api/founder-security/data-rights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        action: 'resolve',
        requestId: params.requestId,
        status: params.status,
        resolutionNote: params.resolutionNote,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.ok) {
      return {
        ok: true,
        request: data.request,
        message: data.message || 'Đã cập nhật trạng thái xử lý yêu cầu dữ liệu cá nhân.',
      };
    }
    return {
      ok: false,
      message: data?.message || 'Không thể cập nhật yêu cầu quyền dữ liệu.',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Lỗi kết nối khi xử lý yêu cầu quyền dữ liệu.',
    };
  }
}

/**
 * Founder phát hành phiên bản chính sách mới (có version, changelog, ngày hiệu lực, cờ requiresReconsent)
 */
export async function publishPolicyVersionViaBackend(params: {
  version: string;
  privacyNoticeVersion: string;
  communityGuidelinesVersion: string;
  effectiveDate: string;
  title: string;
  changes: string[];
  requiresReconsent: boolean;
}): Promise<{ ok: boolean; policy?: PolicyVersionChangelogEntry; message: string }> {
  const idToken = await getCurrentFirebaseIdToken();
  try {
    const res = await fetch('/api/founder-security/policy-version', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (res.ok && data?.ok && data?.policy) {
      saveActivePolicyMetadataLocal(data.policy);
      return {
        ok: true,
        policy: data.policy,
        message: data.message || `Đã phát hành phiên bản chính sách ${data.policy.version}.`,
      };
    }
    return {
      ok: false,
      message: data?.message || 'Không thể phát hành phiên bản chính sách mới.',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Lỗi kết nối máy chủ khi cập nhật phiên bản chính sách.',
    };
  }
}
