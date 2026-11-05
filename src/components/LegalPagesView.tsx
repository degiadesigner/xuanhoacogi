'use client';

import React, { useEffect, useState } from 'react';
import {
  Shield,
  FileText,
  Users,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Download,
  Send,
  Clock,
  Info,
  X,
} from 'lucide-react';
import {
  LegalPageSlug,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_COMMUNITY_VERSION,
  CURRENT_POLICY_EFFECTIVE_DATE,
  INITIAL_POLICY_CHANGELOG,
  PENDING_OWNER_LEGAL_FIELDS,
  DATA_RIGHTS_REQUEST_TYPE_LABELS,
  DataRightsRequestType,
  getActivePolicyMetadata,
  getStoredConsentRecord,
  submitDataRightsRequestViaBackend,
  updateOrWithdrawConsentViaBackend,
  ConsentPurposeKey,
} from '../lib/legal-compliance';
import { getStoredAuthUser, UserAuthProfile } from '../lib/auth';

interface LegalPagesViewProps {
  activeSlug: LegalPageSlug;
  onSelectSlug: (slug: LegalPageSlug) => void;
  onBackToApp?: () => void;
  embeddedInModal?: boolean;
  onCloseModal?: () => void;
}

const SLUG_META: Record<
  LegalPageSlug,
  {
    title: string;
    shortLabel: string;
    seoTitle: string;
    seoDescription: string;
    urlPath: string;
  }
> = {
  terms: {
    title: 'Điều Khoản Sử Dụng Dịch Vụ',
    shortLabel: 'Điều khoản sử dụng',
    seoTitle: 'Điều Khoản Sử Dụng — Xuân Hòa Có Gì (XUHO City)',
    seoDescription:
      'Điều khoản sử dụng cổng thông tin địa điểm ẩm thực, dịch vụ và bản đồ số Xuân Hòa Có Gì (xuanhoacogi.com).',
    urlPath: '/terms',
  },
  privacy: {
    title: 'Chính Sách Bảo Mật & Thông Báo Xử Lý Dữ Liệu Cá Nhân',
    shortLabel: 'Chính sách bảo mật',
    seoTitle: 'Chính Sách Bảo Mật & Dữ Liệu Cá Nhân — Xuân Hòa Có Gì (XUHO City)',
    seoDescription:
      'Chính sách bảo vệ dữ liệu cá nhân theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP tại xuanhoacogi.com.',
    urlPath: '/privacy',
  },
  'community-guidelines': {
    title: 'Tiêu Chuẩn & Quy Định Cộng Đồng',
    shortLabel: 'Quy định cộng đồng',
    seoTitle: 'Quy Định Cộng Đồng — Xuân Hòa Có Gì (XUHO City)',
    seoDescription:
      'Quy tắc ứng xử, đăng tải đánh giá, đề xuất địa điểm và quy trình báo cáo vi phạm trên cộng đồng Xuân Hòa Có Gì.',
    urlPath: '/community-guidelines',
  },
  'data-rights': {
    title: 'Trung Tâm Quyền Dữ Liệu Cá Nhân',
    shortLabel: 'Quyền dữ liệu cá nhân',
    seoTitle: 'Quyền Dữ Liệu Cá Nhân — Xuân Hòa Có Gì (XUHO City)',
    seoDescription:
      'Thực hiện quyền xem, đính chính, rút lại sự đồng ý, hạn chế xử lý, xuất hoặc yêu cầu xóa dữ liệu cá nhân tại xuanhoacogi.com.',
    urlPath: '/data-rights',
  },
};

export function LegalPagesView({
  activeSlug,
  onSelectSlug,
  onBackToApp,
  embeddedInModal = false,
  onCloseModal,
}: LegalPagesViewProps) {
  const [authUser, setAuthUser] = useState<UserAuthProfile | null>(() => getStoredAuthUser());
  const [activePolicy, setActivePolicy] = useState(() => getActivePolicyMetadata());
  const [consentRecord, setConsentRecord] = useState(() =>
    getStoredConsentRecord(authUser?.uid, authUser?.email)
  );

  // Form gửi yêu cầu Quyền dữ liệu cá nhân trên trang /data-rights
  const [reqType, setReqType] = useState<DataRightsRequestType>('access');
  const [reqDetails, setReqDetails] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqFeedback, setReqFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const u = getStoredAuthUser();
    setAuthUser(u);
    setConsentRecord(getStoredConsentRecord(u?.uid, u?.email));
    setActivePolicy(getActivePolicyMetadata());
  }, [activeSlug]);

  // Cập nhật SEO Title & Meta Description khi xem trang độc lập
  useEffect(() => {
    if (embeddedInModal || typeof document === 'undefined') return;
    const meta = SLUG_META[activeSlug] || SLUG_META.terms;
    const prevTitle = document.title;
    document.title = meta.seoTitle;
    const descEl = document.querySelector('meta[name="description"]');
    const prevDesc = descEl?.getAttribute('content') || '';
    if (descEl) {
      descEl.setAttribute('content', meta.seoDescription);
    }
    return () => {
      document.title = prevTitle;
      if (descEl && prevDesc) {
        descEl.setAttribute('content', prevDesc);
      }
    };
  }, [activeSlug, embeddedInModal]);

  const handleToggleOptionalConsent = async (purpose: ConsentPurposeKey) => {
    if (!authUser?.uid) return;
    const currentStatus = consentRecord?.purposes?.[purpose]?.status;
    const nextStatus = currentStatus === 'granted' ? 'withdrawn' : 'granted';
    const res = await updateOrWithdrawConsentViaBackend({
      uid: authUser.uid,
      email: authUser.email,
      purpose,
      nextStatus,
    });
    if (res.record) {
      setConsentRecord(res.record);
    }
    setReqFeedback({ ok: res.ok, text: res.message });
  };

  const handleExportPersonalDataJson = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      platform: 'https://xuanhoacogi.com',
      policyVersion: activePolicy.version,
      userProfile: authUser
        ? {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            nickname: authUser.nickname,
            gender: authUser.gender,
            residentType: authUser.residentType,
            phone: authUser.phone || null,
            tastePreferences: authUser.tastePreferences || [],
            createdAt: authUser.createdAt,
          }
        : null,
      consentRecord: consentRecord || null,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xuanhoacogi-data-export-${authUser?.uid || 'guest'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmitDataRightsForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser?.uid || !authUser?.email) {
      setReqFeedback({
        ok: false,
        text: 'Vui lòng đăng nhập tài khoản Google để hệ thống xác thực chính xác chủ thể dữ liệu trước khi gửi yêu cầu trực tuyến.',
      });
      return;
    }
    if (!reqDetails.trim() || reqDetails.trim().length < 5) {
      setReqFeedback({
        ok: false,
        text: 'Vui lòng mô tả cụ thể nội dung yêu cầu (ít nhất 5 ký tự).',
      });
      return;
    }
    setReqSubmitting(true);
    setReqFeedback(null);
    try {
      const res = await submitDataRightsRequestViaBackend({
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName || authUser.nickname || authUser.email,
        requestType: reqType,
        details: reqDetails.trim(),
      });
      setReqFeedback({ ok: res.ok, text: res.message });
      if (res.ok) {
        setReqDetails('');
      }
    } finally {
      setReqSubmitting(false);
    }
  };

  return (
    <div
      data-testid={`legal-page-${activeSlug}`}
      className={
        embeddedInModal
          ? 'w-full max-h-[82vh] overflow-y-auto bg-[#FDFBF7] text-slate-800 rounded-2xl border border-amber-200/80 shadow-2xl p-4 sm:p-6'
          : 'min-h-screen bg-gradient-to-b from-[#FAF6EE] via-[#FDFBF7] to-[#F4EFE4] text-slate-800 py-6 px-3 sm:px-6'
      }
    >
      <div className={embeddedInModal ? 'w-full' : 'max-w-4xl mx-auto'}>
        {/* Thanh điều hướng đầu trang */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-amber-200/70">
          <div className="flex items-center gap-2.5">
            {!embeddedInModal && onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                data-testid="legal-back-to-app-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-slate-700 border border-amber-200/80 text-xs font-semibold shadow-sm transition"
              >
                <ArrowLeft size={14} />
                <span>Quay lại Xuân Hòa Có Gì</span>
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/80 text-amber-900 border border-amber-300/60 text-[11px] font-semibold">
              <Shield size={12} className="text-amber-700" />
              Phiên bản chính sách: {activePolicy.version} · Hiệu lực: {activePolicy.effectiveDate}
            </span>
          </div>

          {embeddedInModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              data-testid="legal-modal-close-btn"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold"
            >
              <X size={14} />
              <span>Đóng & Quay lại màn hình xác nhận</span>
            </button>
          )}
        </div>

        {/* Các tab chuyển nhanh giữa 4 trang pháp lý */}
        <nav
          aria-label="Điều hướng tài liệu pháp lý"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6"
        >
          {(
            [
              { slug: 'terms', icon: FileText, label: '1. Điều khoản sử dụng', path: '/terms' },
              { slug: 'privacy', icon: Lock, label: '2. Chính sách bảo mật', path: '/privacy' },
              {
                slug: 'community-guidelines',
                icon: Users,
                label: '3. Quy định cộng đồng',
                path: '/community-guidelines',
              },
              {
                slug: 'data-rights',
                icon: Shield,
                label: '4. Quyền dữ liệu cá nhân',
                path: '/data-rights',
              },
            ] as const
          ).map(item => {
            const Icon = item.icon;
            const isActive = activeSlug === item.slug;
            return (
              <button
                key={item.slug}
                type="button"
                data-testid={`legal-nav-${item.slug}`}
                onClick={() => onSelectSlug(item.slug)}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                  isActive
                    ? 'bg-amber-600 text-white border-amber-700 shadow-md'
                    : 'bg-white/90 hover:bg-amber-50/80 text-slate-700 border-amber-200/70'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Icon size={14} />
                  <span>{item.label}</span>
                </div>
                <span
                  className={`text-[10px] mt-0.5 font-mono ${
                    isActive ? 'text-amber-100' : 'text-slate-400'
                  }`}
                >
                  {item.path}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Thông báo minh bạch về các trường thông tin pháp nhân cần chủ website bổ sung */}
        <div
          data-testid="legal-owner-pending-fields-banner"
          className="mb-6 rounded-2xl bg-amber-50/90 border border-amber-300/80 p-4 text-xs text-amber-950"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold text-amber-900">
                Phân loại trạng thái thông tin chủ thể vận hành (PRE-PUBLISH OWNER ACTION):
              </p>
              <p className="leading-relaxed text-amber-900/90">
                Tài liệu này được thiết lập theo khung <strong>Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15</strong>,{' '}
                <strong>Nghị định số 356/2025/NĐ-CP</strong>, <strong>Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15</strong> và{' '}
                <strong>Nghị định số 147/2024/NĐ-CP</strong>. Hệ thống tách biệt rõ <strong>địa bàn website phục vụ</strong> (Phường Xuân Hòa, tỉnh Phú Thọ — thành lập từ Phường Đồng Xuân cũ, Phường Xuân Hòa cũ, Xã Cao Minh cũ, Xã Ngọc Thanh cũ; giữ nguyên dữ liệu địa chỉ lịch sử để tra cứu) với <strong>địa chỉ pháp lý thực tế của chủ thể vận hành</strong>. Các mục gắn nhãn{' '}
                <code className="px-1.5 py-0.5 rounded bg-amber-200/70 font-mono text-[11px]">
                  PRE-PUBLISH OWNER ACTION
                </code>{' '}
                dưới đây là những thông tin liên hệ thực tế mà Chủ sở hữu website cần điền theo mô hình hoạt động trước khi hoàn tất công bố pháp lý.
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================
            TRANG 1: ĐIỀU KHOẢN SỬ DỤNG (/terms)
            ================================================================ */}
        {activeSlug === 'terms' && (
          <article className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-5 sm:p-8 space-y-6 text-sm leading-relaxed">
            <header className="border-b border-slate-100 pb-4">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-700 font-semibold">
                URL công khai: https://xuanhoacogi.com/terms · Phiên bản {CURRENT_TERMS_VERSION}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                1. ĐIỀU KHOẢN SỬ DỤNG DỊCH VỤ (TERMS OF SERVICE)
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Ngày có hiệu lực: {CURRENT_POLICY_EFFECTIVE_DATE} · Áp dụng cho website{' '}
                <strong>https://xuanhoacogi.com</strong> và hệ thống Bản đồ số 2D/3D XUHO City.
              </p>
            </header>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1.1. Phạm vi dịch vụ</h2>
              <p>
                <strong>Xuân Hòa Có Gì (XUHO City)</strong> là cổng thông tin tra cứu địa điểm ẩm thực, quán xá, tiện ích đời sống và bản đồ minh họa không gian 2D/3D tại khu vực Phường Xuân Hòa, tỉnh Phú Thọ (khu vực Đại học Sư phạm Hà Nội 2 và vùng lân cận).
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  Website cung cấp công cụ gợi ý món ăn ngẫu nhiên, danh mục quán ăn, bản đồ tra cứu đường đi và mô hình 3D tham khảo các công trình tiêu biểu tại địa phương.
                </li>
                <li>
                  Website <strong>không phải</strong> là sàn giao dịch thương mại điện tử trung gian thanh toán, không thu phí đặt cọc hay bán hàng trực tuyến thay cho các quán ăn.
                </li>
                <li>
                  Đường ranh giới và các vùng màu trên bản đồ số mang tính chất minh họa phạm vi tra cứu dịch vụ cộng đồng, <strong>không thay thế</strong> bản đồ địa giới hành chính chính thức hay bản đồ quy hoạch được cơ quan nhà nước có thẩm quyền phê duyệt theo Luật Đo đạc và bản đồ 2018.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1.2. Quyền và trách nhiệm của người dùng</h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  <strong>Quyền của người dùng:</strong> Được tra cứu miễn phí danh mục món ăn, địa điểm và bản đồ số mà không bắt buộc đăng nhập; được tự do lựa chọn đồng ý hoặc từ chối các mục đích xử lý dữ liệu tùy chọn khi đăng nhập tài khoản; được thực hiện đầy đủ các quyền của chủ thể dữ liệu cá nhân theo Luật số 91/2025/QH15.
                </li>
                <li>
                  <strong>Trách nhiệm của người dùng:</strong> Cung cấp thông tin trung thực khi tham gia đánh giá hoặc đề xuất chỉnh sửa địa điểm; tự bảo mật thiết bị và tài khoản đăng nhập của mình; không sử dụng công cụ tự động (bot, scraper) gây quá tải hạ tầng máy chủ hoặc can thiệp trái phép vào Firebase / Cloudflare Workers của hệ thống.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1.3. Quy định về tài khoản và phân quyền</h2>
              <p>
                Hệ thống vận hành theo mô hình phân quyền xác thực phía máy chủ gồm: <strong>Khách (Guest)</strong>, <strong>Thành viên (User)</strong>, <strong>Quản lý đề xuất (Manager)</strong> và <strong>Quản trị viên / Sáng lập viên (Admin / Founder)</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  Thành viên đăng nhập thông qua <strong>Google OAuth 2.0 (Sign in with Google)</strong> với phạm vi quyền tối thiểu (<code>openid</code>, <code>email</code>, <code>profile</code>).
                </li>
                <li>
                  Mọi hành vi mạo danh quản trị viên, giả mạo mã định danh (UID) hoặc cố tình vượt rào kiểm soát truy cập đều bị từ chối tự động bởi quy tắc bảo mật máy chủ và bị khóa tài khoản.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                1.4. Nội dung do người dùng đóng góp & Trách nhiệm khi đăng địa điểm sai
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  Khi gửi nhận xét, đánh giá sao hoặc đề xuất tạo mới/cập nhật tọa độ địa điểm, người đóng góp cam kết thông tin dựa trên trải nghiệm thực tế và không cố ý cung cấp tọa độ sai lệch, thông tin bịa đặt nhằm hạ uy tín hoặc trục lợi.
                </li>
                <li>
                  <strong>Trách nhiệm khi đăng địa điểm sai:</strong> Mọi đề xuất địa điểm của Manager hoặc đóng góp từ cộng đồng đều phải qua quy trình kiểm duyệt của Admin trước khi hiển thị chính thức. Người cố tình gửi thông tin gian dối, ghim sai vị trí trụ sở cơ quan, trường học, cơ sở tôn giáo hoặc hộ kinh doanh sẽ bị thu hồi quyền đóng góp, gỡ bỏ nội dung và chịu trách nhiệm trước pháp luật nếu gây thiệt hại cho bên thứ ba.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                1.5. Quyền báo cáo, ẩn hoặc gỡ nội dung vi phạm
              </h2>
              <p>
                Chủ cơ sở kinh doanh và người dùng có quyền gửi yêu cầu đính chính thông tin quán, báo cáo đánh giá sai sự thật hoặc yêu cầu gỡ bỏ hình ảnh/thông tin vi phạm thông qua mục <button type="button" onClick={() => onSelectSlug('data-rights')} className="text-amber-700 font-semibold underline">/data-rights</button>. Ban quản trị có quyền tạm ẩn hoặc gỡ bỏ ngay các nội dung vi phạm pháp luật hoặc Tiêu chuẩn cộng đồng.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                1.6. Quyền sở hữu trí tuệ & Quy định về vật phẩm mô phỏng 3D
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  Mã nguồn giao diện, cấu trúc mô hình 3D kiến trúc đặc trưng (như các công trình landmark 3D trên bản đồ) và thiết kế mỹ thuật thuộc bản quyền của đội ngũ phát triển Xuân Hòa Có Gì. Dữ liệu nền địa lý mở tuân thủ giấy phép ghi công tương ứng (OpenStreetMap ODbL).
                </li>
                <li>
                  Các đơn vị điểm thưởng/kinh nghiệm (<code>EXP</code>, <code>XU</code>) hoặc mô phỏng 3D trong chuyên mục thử nghiệm chỉ phục vụ mục đích giải trí trong phạm vi ứng dụng, <strong>không phải là tài sản ảo có giá trị quy đổi ra tiền mặt, thẻ thanh toán hay bất động sản thực tế</strong> theo Nghị định 147/2024/NĐ-CP.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                1.7. Giới hạn trách nhiệm phù hợp theo pháp luật Việt Nam
              </h2>
              <p>
                Thông tin giờ mở cửa, mức giá tham khảo và thực đơn của các quán ăn tại Xuân Hòa có thể thay đổi theo thực tế vận hành của từng hộ kinh doanh. Ban quản trị nỗ lực cập nhật thường xuyên nhưng không chịu trách nhiệm thay cho chất lượng vệ sinh an toàn thực phẩm hay giao dịch dân sự trực tiếp giữa thực khách và chủ quán.{' '}
                <strong>
                  Không điều khoản nào trong văn bản này loại trừ hoặc hạn chế các quyền lợi bắt buộc của người tiêu dùng và chủ thể dữ liệu cá nhân theo Luật Bảo vệ quyền lợi người tiêu dùng 2023 và Luật Bảo vệ dữ liệu cá nhân 2025.
                </strong>
              </p>
            </section>
          </article>
        )}

        {/* ================================================================
            TRANG 2: CHÍNH SÁCH BẢO MẬT (/privacy)
            ================================================================ */}
        {activeSlug === 'privacy' && (
          <article className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-5 sm:p-8 space-y-6 text-sm leading-relaxed">
            <header className="border-b border-slate-100 pb-4">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-700 font-semibold">
                URL công khai: https://xuanhoacogi.com/privacy · Phiên bản {CURRENT_PRIVACY_VERSION}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                2. CHÍNH SÁCH BẢO MẬT & THÔNG BÁO XỬ LÝ DỮ LIỆU CÁ NHÂN
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Thiết lập theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, Nghị định số 356/2025/NĐ-CP và Chính sách Dữ liệu Người dùng của Google API Services.
              </p>
            </header>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                2.1. Danh tính và thông tin liên hệ của Bên kiểm soát và xử lý dữ liệu cá nhân
              </h2>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs">
                {PENDING_OWNER_LEGAL_FIELDS.map(field => (
                  <div key={field.fieldKey} className="flex flex-col sm:flex-row sm:items-baseline gap-1 border-b border-slate-200/60 pb-2 last:border-none last:pb-0">
                    <span className="font-bold text-slate-800 sm:w-64 shrink-0">{field.label}:</span>
                    <div className="flex-1">
                      <span className="font-mono text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded">
                        {field.placeholderDisplay}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Căn cứ: {field.legalBasis}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                2.2. Phân loại dữ liệu cá nhân được xử lý, mục đích và cơ sở pháp lý tương ứng
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-amber-50/80 text-slate-800">
                      <th className="border border-slate-200 p-2.5 text-left">Nhóm dữ liệu</th>
                      <th className="border border-slate-200 p-2.5 text-left">Trường dữ liệu cụ thể</th>
                      <th className="border border-slate-200 p-2.5 text-left">Mục đích xử lý</th>
                      <th className="border border-slate-200 p-2.5 text-left">Cơ sở xử lý (Luật 91/2025/QH15)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-semibold">
                        1. Xác thực Google / Firebase Auth (Thiết yếu)
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        <code>uid</code> (Firebase Auth UID), <code>email</code>, <code>displayName</code>, <code>photoURL</code>
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Định danh tài khoản đăng nhập, duy trì phiên làm việc an toàn, kiểm soát phân quyền và chống giả mạo.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Thực hiện thỏa thuận cung cấp dịch vụ theo yêu cầu của chủ thể dữ liệu & Thông báo xử lý minh bạch.
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-semibold">
                        2. Hồ sơ thành viên & Đóng góp cộng đồng
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Biệt danh (<code>nickname</code>), Giới tính hiển thị, Linh vật 12 con giáp (<code>avatarId</code>), Nhóm thực khách (<code>residentType</code>), nội dung đánh giá sao & đề xuất địa điểm.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Hiển thị hồ sơ thành viên, ghi nhận đánh giá quán ăn và xử lý đề xuất cập nhật bản đồ.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Sự đồng ý rõ ràng, tách biệt của chủ thể dữ liệu (<code>coreProfileConsent</code>).
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-semibold">
                        3. Tùy chọn Cá nhân hóa khẩu vị & Số điện thoại
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Số điện thoại (<code>phone</code> — không bắt buộc), Sở thích khẩu vị (<code>tastePreferences</code>).
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Ưu tiên gợi ý món ăn hợp gu trên vòng quay và liên hệ xác minh khi người dùng có yêu cầu hỗ trợ.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Sự đồng ý tùy chọn độc lập (<code>optional_taste_phone</code> — mặc định không tích sẵn, có thể rút lại bất cứ lúc nào).
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-semibold">
                        4. Dữ liệu Quản trị (Admin / Manager / Founder)
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        <code>actorUid</code>, <code>actorRole</code>, thời điểm xác thực (<code>auth_time</code>), phiên bản phiên (<code>sessionEpoch</code>), nhật ký thao tác (<code>auditLogs</code>).
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Kiểm soát an ninh phân quyền, truy vết lịch sử phê duyệt tọa độ và bảo vệ hệ thống trước truy cập trái phép.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Nghĩa vụ bảo đảm an ninh mạng & lợi ích hợp pháp trong vận hành an toàn hệ thống.
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-semibold">
                        5. Vị trí định vị trên trình duyệt (GPS)
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Tọa độ tạm thời từ <code>navigator.geolocation</code> khi người dùng bấm nút định vị trên bản đồ.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Tính khoảng cách và chỉ đường từ vị trí hiện tại tới địa điểm trên thiết bị của người dùng.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Chỉ xử lý cục bộ trên bộ nhớ tạm (RAM) của trình duyệt khi người dùng cấp quyền trên trình duyệt; <strong>không gửi hay lưu trữ tọa độ GPS thời gian thực lên máy chủ</strong>.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                2.3. Cam kết tuân thủ Chính sách Dữ liệu Người dùng của Google OAuth
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  Ứng dụng chỉ yêu cầu 3 phạm vi cơ bản: <code>openid</code>, <code>email</code>, <code>profile</code>. Tuyệt đối <strong>không yêu cầu</strong> quyền đọc Gmail, Google Drive, Danh bạ (Contacts), Lịch hay bất kỳ phạm vi nhạy cảm/hạn chế nào.
                </li>
                <li>
                  Hệ thống <strong>không lưu trữ</strong> Google Access Token, Refresh Token hoặc mật khẩu của người dùng vào cơ sở dữ liệu hay nhật ký xác nhận (Consent Log).
                </li>
                <li>
                  Dữ liệu nhận từ Google Sign-In không bao giờ được bán, cho thuê hoặc chuyển giao cho bên thứ ba phục vụ quảng cáo mục tiêu.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                2.4. Cookie, Lưu trữ cục bộ (LocalStorage) & Phân tích truy cập
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  <strong>Lưu trữ thiết yếu:</strong> Hệ thống sử dụng <code>localStorage</code> (<code>xuanhoa_auth_user_v1</code>, <code>xuanhoa_consent_v3_*</code>) và cookie phiên xác thực (<code>xuanhoa_auth_cookie_v1</code>) để giữ trạng thái đăng nhập và ghi nhớ lựa chọn quyền riêng tư của bạn.
                </li>
                <li>
                  <strong>Không tự động bật theo dõi (No Pre-Consent Tracking):</strong> Mọi hoạt động thống kê trải nghiệm không thiết yếu đều bị tắt mặc định và chỉ được kích hoạt khi người dùng chủ động bật tùy chọn <code>optional_analytics</code>.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                2.5. Nhà cung cấp dịch vụ hạ tầng & Truyền dữ liệu xuyên biên giới
              </h2>
              <p>
                Để vận hành website ổn định và bảo mật, hệ thống sử dụng hạ tầng kỹ thuật của các nhà cung cấp đạt chuẩn bảo mật quốc tế:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  <strong>Google Firebase (Google LLC):</strong> Cung cấp dịch vụ xác thực <em>Firebase Authentication</em> và cơ sở dữ liệu thời gian thực <em>Firebase Realtime Database</em> (dự án <code>xuanhoacogi</code>).
                </li>
                <li>
                  <strong>Cloudflare, Inc.:</strong> Cung cấp dịch vụ phân phối nội dung (CDN), tường lửa ứng dụng web (WAF), bảo vệ DDoS và môi trường thực thi <em>Cloudflare Workers</em> tại tên miền <code>xuanhoacogi.com</code>.
                </li>
                <li>
                  <strong>Nghĩa vụ truyền dữ liệu xuyên biên giới:</strong> Do các cụm máy chủ của Google Firebase và Cloudflare có thể đặt ngoài lãnh thổ Việt Nam, việc lưu trữ dữ liệu tuân thủ cơ chế mã hóa đường truyền (TLS 1.3), kiểm soát truy cập theo UID và nghĩa vụ lập/cập nhật Hồ sơ đánh giá tác động chuyển dữ liệu cá nhân xuyên biên giới theo Luật số 91/2025/QH15 và Nghị định số 356/2025/NĐ-CP.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                2.6. Thời gian lưu trữ, Tiêu chí xóa & Quy trình ứng phó sự cố
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  <strong>Thời gian lưu trữ:</strong> Dữ liệu hồ sơ thành viên được lưu trữ trong suốt thời gian tài khoản đang hoạt động hoặc cho đến khi người dùng gửi yêu cầu xóa tài khoản/rút lại sự đồng ý.
                </li>
                <li>
                  <strong>Trường hợp lưu trữ theo nghĩa vụ pháp lý:</strong> Khi người dùng yêu cầu xóa tài khoản, thông tin hồ sơ cá nhân (email hiển thị, biệt danh, SĐT, sở thích) sẽ được xóa hoặc ẩn danh hóa; riêng các bản ghi bằng chứng xác nhận (<code>consent_audit_trail</code>) và nhật ký an ninh mạng (<code>auditLogs</code>) được giữ lại ở mức tối thiểu cần thiết để chứng minh sự tuân thủ pháp luật theo Nghị định 356/2025/NĐ-CP và Luật An ninh mạng.
                </li>
                <li>
                  <strong>Bảo vệ dữ liệu & Ứng phó sự cố:</strong> Khi phát hiện dấu hiệu xâm nhập hoặc rò rỉ dữ liệu, Primary Founder có công cụ khóa khẩn cấp tài khoản dự phòng, thu hồi toàn bộ phiên đăng nhập (Session Epoch Revocation) ngay lập tức và thực hiện thông báo sự cố trong thời hạn luật định (72 giờ).
                </li>
              </ul>
            </section>
          </article>
        )}

        {/* ================================================================
            TRANG 3: QUY ĐỊNH CỘNG ĐỒNG (/community-guidelines)
            ================================================================ */}
        {activeSlug === 'community-guidelines' && (
          <article className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-5 sm:p-8 space-y-6 text-sm leading-relaxed">
            <header className="border-b border-slate-100 pb-4">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-700 font-semibold">
                URL công khai: https://xuanhoacogi.com/community-guidelines · Phiên bản {CURRENT_COMMUNITY_VERSION}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                3. TIÊU CHUẨN & QUY ĐỊNH CỘNG ĐỒNG (COMMUNITY GUIDELINES)
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Xây dựng môi trường đánh giá ẩm thực và bản đồ số Xuân Hòa văn minh, trung thực và tôn trọng pháp luật.
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                <h2 className="font-bold text-rose-900 text-sm">
                  3.1. Không đăng thông tin giả mạo hoặc sai sự thật
                </h2>
                <p className="text-xs text-rose-900/90">
                  Nghiêm cấm tạo địa điểm ảo không tồn tại, ghim sai tọa độ cố ý, bịa đặt sự việc nhằm bôi nhọ danh dự hoặc tăng/hạ điểm đánh giá ảo (seeding gian lận) trái với Điều 10 Luật Bảo vệ quyền lợi người tiêu dùng 2023.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                <h2 className="font-bold text-rose-900 text-sm">
                  3.2. Không đăng hình ảnh vi phạm bản quyền
                </h2>
                <p className="text-xs text-rose-900/90">
                  Không sao chép trái phép hình ảnh độc quyền, nhãn hiệu hoặc tư liệu của cá nhân/tổ chức khác mà không có sự cho phép hoặc trích dẫn nguồn hợp pháp theo Luật Sở hữu trí tuệ.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                <h2 className="font-bold text-rose-900 text-sm">
                  3.3. Không tiết lộ dữ liệu cá nhân của người khác trái phép (Doxxing)
                </h2>
                <p className="text-xs text-rose-900/90">
                  Tuyệt đối không đăng số điện thoại cá nhân, địa chỉ nhà riêng, ảnh chụp mặt cá nhân hoặc thông tin đời tư của người khác trong phần bình luận/mô tả địa điểm khi chưa được sự đồng ý của họ (Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                <h2 className="font-bold text-rose-900 text-sm">
                  3.4. Không giả mạo chủ địa điểm hoặc cơ quan nhà nước
                </h2>
                <p className="text-xs text-rose-900/90">
                  Không mạo danh chủ quán ăn, ban giám hiệu trường học, cơ quan hành chính hoặc quản trị viên hệ thống để phát ngôn, thu thập thông tin hay yêu cầu chuyển khoản.
                </p>
              </div>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                3.5. Không quấy rối, xúc phạm, kích động hoặc phát tán spam
              </h2>
              <p>
                Mọi bình luận sử dụng ngôn từ thù ghét, xúc phạm nhân phẩm, phân biệt vùng miền, quảng cáo cờ bạc, tín dụng đen hoặc đường dẫn độc hại đều bị chặn và xóa bỏ ngay lập tức.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                3.6. Quy trình báo cáo và xử lý vi phạm minh bạch
              </h2>
              <ol className="list-decimal pl-5 space-y-1.5 text-slate-700">
                <li>
                  <strong>Bước 1 — Tiếp nhận báo cáo:</strong> Người dùng hoặc chủ cơ sở gửi yêu cầu phản ánh qua trang <button type="button" onClick={() => onSelectSlug('data-rights')} className="text-amber-700 font-semibold underline">/data-rights</button> hoặc kênh liên hệ chính thức, nêu rõ tên địa điểm/đánh giá và lý do báo cáo.
                </li>
                <li>
                  <strong>Bước 2 — Tạm ẩn khẩn cấp (nếu có dấu hiệu xâm phạm quyền riêng tư/pháp luật):</strong> Admin tạm ẩn nội dung bị báo cáo trong vòng 24 giờ để xác minh.
                </li>
                <li>
                  <strong>Bước 3 — Xác minh & Phản hồi:</strong> Đối chiếu lịch sử tọa độ (<code>coordinate_history</code>), nhật ký đề xuất (<code>placeProposals</code>) và phản hồi kết quả xử lý; khóa tài khoản (<code>muted</code> / <code>banned</code> / <code>locked_uids</code>) đối với người dùng tái phạm.
                </li>
              </ol>
            </section>
          </article>
        )}

        {/* ================================================================
            TRANG 4: QUYỀN DỮ LIỆU CÁ NHÂN (/data-rights)
            ================================================================ */}
        {activeSlug === 'data-rights' && (
          <article className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-5 sm:p-8 space-y-6 text-sm leading-relaxed">
            <header className="border-b border-slate-100 pb-4">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-700 font-semibold">
                URL công khai: https://xuanhoacogi.com/data-rights · Luật BVDLCN 91/2025/QH15 & NĐ 356/2025/NĐ-CP
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                4. TRUNG TÂM QUYỀN DỮ LIỆU CÁ NHÂN (PERSONAL DATA RIGHTS CENTER)
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Thực thi trực tiếp các quyền của chủ thể dữ liệu cá nhân: Xem, Cập nhật, Rút lại sự đồng ý, Yêu cầu xóa/hạn chế xử lý, Xuất dữ liệu và Gửi khiếu nại.
              </p>
            </header>

            {/* Bảng tóm tắt 6 quyền của chủ thể dữ liệu */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70">
                <h3 className="font-bold text-slate-900 text-xs">1. Quyền được biết & Xem dữ liệu cá nhân</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Xem toàn bộ thông tin hồ sơ, mục đích xử lý, phiên bản chính sách đã xác nhận và thời điểm xác nhận.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70">
                <h3 className="font-bold text-slate-900 text-xs">2. Quyền cập nhật, đính chính dữ liệu</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Chủ động sửa biệt danh, linh vật, nhóm cư dân, số điện thoại trực tiếp trong Hồ sơ hoặc gửi yêu cầu đính chính.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70">
                <h3 className="font-bold text-slate-900 text-xs">3. Quyền rút lại sự đồng ý (1 chạm)</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Bật/tắt hoặc rút lại sự đồng ý đối với từng mục đích tùy chọn bất cứ lúc nào mà không làm mất quyền sử dụng các tính năng cơ bản.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70">
                <h3 className="font-bold text-slate-900 text-xs">4. Quyền yêu cầu xóa hoặc hạn chế xử lý</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Yêu cầu xóa tài khoản/hồ sơ hoặc tạm dừng xử lý dữ liệu trong phạm vi pháp luật cho phép.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70">
                <h3 className="font-bold text-slate-900 text-xs">5. Quyền xuất / cung cấp dữ liệu (JSON)</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Tải xuống ngay lập tức bản sao dữ liệu hồ sơ và bằng chứng xác nhận chính sách ở định dạng chuẩn JSON.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70">
                <h3 className="font-bold text-slate-900 text-xs">6. Thông báo lưu trữ theo nghĩa vụ pháp lý</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Các bản ghi nhật ký bảo mật (<code>auditLogs</code>) và lịch sử bằng chứng xác nhận (<code>consent_audit_trail</code>) được lưu giữ theo nghĩa vụ pháp lý bắt buộc và không thể bị xóa trái phép.
                </p>
              </div>
            </section>

            {/* Bảng điều khiển nhanh nếu người dùng đã đăng nhập */}
            <section className="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Trạng thái Dữ liệu & Đồng ý hiện tại của bạn
                  </h2>
                  <p className="text-xs text-slate-500">
                    {authUser?.isLoggedIn
                      ? `Đang đăng nhập: ${authUser.email} (UID: ${authUser.uid})`
                      : 'Bạn đang truy cập với tư cách Khách (chưa đăng nhập Google).'}
                  </p>
                </div>
                {authUser?.isLoggedIn && (
                  <button
                    type="button"
                    data-testid="data-rights-export-json-btn"
                    onClick={handleExportPersonalDataJson}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm"
                  >
                    <Download size={14} />
                    <span>Tải xuất dữ liệu cá nhân (JSON)</span>
                  </button>
                )}
              </div>

              {authUser?.isLoggedIn && consentRecord && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="text-xs text-slate-600 flex flex-wrap gap-3">
                    <span>
                      Phiên bản đã xác nhận: <strong>{consentRecord.policyVersion}</strong>
                    </span>
                    <span>
                      Thời điểm máy chủ ghi nhận:{' '}
                      <strong>{new Date(consentRecord.serverTimestamp).toLocaleString('vi-VN')}</strong>
                    </span>
                    <span>
                      Trạng thái: <strong className="uppercase text-emerald-700">{consentRecord.consentStatus}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                    {(
                      [
                        {
                          key: 'optional_taste_phone',
                          title: 'Tùy chọn SĐT & Khẩu vị',
                        },
                        {
                          key: 'optional_analytics',
                          title: 'Tùy chọn Phân tích trải nghiệm',
                        },
                        {
                          key: 'optional_marketing',
                          title: 'Tùy chọn Thông báo sự kiện',
                        },
                      ] as const
                    ).map(item => {
                      const status = consentRecord.purposes?.[item.key]?.status || 'denied';
                      const isGranted = status === 'granted';
                      return (
                        <div
                          key={item.key}
                          className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-800">{item.title}</div>
                            <div className="text-[11px] text-slate-500">
                              Trạng thái:{' '}
                              <span
                                className={
                                  isGranted ? 'text-emerald-700 font-semibold' : 'text-slate-500 font-semibold'
                                }
                              >
                                {isGranted ? 'Đang bật (Granted)' : status === 'withdrawn' ? 'Đã rút lại (Withdrawn)' : 'Từ chối (Denied)'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            data-testid={`data-rights-toggle-${item.key}`}
                            onClick={() => handleToggleOptionalConsent(item.key)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                              isGranted
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isGranted ? 'Rút lại' : 'Bật đồng ý'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Biểu mẫu gửi Yêu cầu Quyền Dữ liệu Cá nhân */}
            <section className="rounded-2xl bg-amber-50/40 border border-amber-200/80 p-4 sm:p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Send size={15} className="text-amber-700" />
                <span>Gửi Yêu Cầu Thực Hiện Quyền Dữ Liệu Cá Nhân / Phản Ánh Vi Phạm</span>
              </h2>

              <form onSubmit={handleSubmitDataRightsForm} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Loại yêu cầu quyền dữ liệu cá nhân:
                  </label>
                  <select
                    data-testid="data-rights-request-type-select"
                    value={reqType}
                    onChange={e => setReqType(e.target.value as DataRightsRequestType)}
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                  >
                    {(Object.keys(DATA_RIGHTS_REQUEST_TYPE_LABELS) as DataRightsRequestType[]).map(k => (
                      <option key={k} value={k}>
                        {DATA_RIGHTS_REQUEST_TYPE_LABELS[k].label} — {DATA_RIGHTS_REQUEST_TYPE_LABELS[k].desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nội dung chi tiết yêu cầu / Thông tin cần chỉnh sửa hoặc xóa:
                  </label>
                  <textarea
                    data-testid="data-rights-request-details-input"
                    rows={3}
                    value={reqDetails}
                    onChange={e => setReqDetails(e.target.value)}
                    placeholder="Nhập nội dung cụ thể yêu cầu của bạn (ví dụ: Yêu cầu xóa số điện thoại khỏi hồ sơ, hoặc yêu cầu cung cấp bản sao dữ liệu...)"
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-slate-800"
                  />
                </div>

                {reqFeedback && (
                  <div
                    data-testid="data-rights-feedback-msg"
                    className={`p-3 rounded-xl text-xs font-medium border ${
                      reqFeedback.ok
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {reqFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={reqSubmitting}
                  data-testid="data-rights-submit-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  <Send size={13} />
                  <span>{reqSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu xác thực'}</span>
                </button>
              </form>
            </section>
          </article>
        )}

        {/* Lịch sử phiên bản chính sách (Changelog) hiển thị cuối mọi trang pháp lý */}
        <section className="mt-6 bg-white/90 rounded-2xl border border-amber-200/70 p-4 sm:p-5 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Clock size={14} className="text-amber-700" />
            <span>Nhật ký Phiên bản Chính sách (Policy Version & Changelog)</span>
          </div>
          {INITIAL_POLICY_CHANGELOG.map(entry => (
            <div key={entry.version} className="border-l-2 border-amber-400 pl-3 py-1 space-y-1">
              <div className="font-semibold text-slate-800">
                Phiên bản <code>{entry.version}</code> — Ngày hiệu lực: {entry.effectiveDate} —{' '}
                <span className="text-amber-800">{entry.title}</span>
              </div>
              <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                {entry.changes.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
