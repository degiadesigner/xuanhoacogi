import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  ShieldCheck, 
  Sparkles, 
  Send, 
  Check, 
  Store, 
  UtensilsCrossed, 
  Dices,
  Users,
  Globe,
  ExternalLink,
  Zap,
  MapPin
} from 'lucide-react';

interface AboutViewProps {
  onGoToSpin: () => void;
  onGoToDishes: () => void;
  onGoToPlaces: () => void;
}

export function AboutView({
  onGoToSpin,
  onGoToDishes,
  onGoToPlaces,
}: AboutViewProps) {
  const [formSent, setFormSent] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeNote, setPlaceNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeName.trim()) return;
    setFormSent(true);
    setTimeout(() => {
      setPlaceName('');
      setPlaceAddress('');
      setPlaceNote('');
    }, 2000);
  };

  return (
    <div className="about-page-container">
      {/* Sleek, Synchronized Header Bar */}
      <div className="catalog-header-bar">
        <div className="catalog-header-top-row">
          <button className="catalog-back-pill-btn" onClick={onGoToSpin} title="Quay lại vòng quay">
            <ArrowLeft size={15} />
            <span>Về Vòng Quay</span>
          </button>

          <div className="catalog-header-title-col">
            <h1 className="catalog-title-main">
              GIỚI THIỆU <span>XUÂN HÒA CÓ GÌ</span>
            </h1>
            <p className="catalog-title-sub">
              Nền tảng ẩm thực phi lợi nhuận &amp; cẩm nang giải cứu cơn đói quanh ĐH Sư Phạm Hà Nội 2
            </p>
            <div className="catalog-header-badges-row">
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Heart size={12} className="text-amber-400" />
                <span>100% Phi Lợi Nhuận</span>
              </span>
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-400" />
                <span>Quán Xá Xác Thực Thật</span>
              </span>
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Zap size={12} className="text-amber-400" />
                <span>Chốt Kèo Dứt Khoát</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="catalog-header-places-btn" onClick={onGoToDishes} title="Khám phá thực đơn">
              <UtensilsCrossed size={14} className="text-amber-400" />
              <span>300+ Món</span>
            </button>
            <button className="catalog-header-places-btn" onClick={onGoToPlaces} title="Danh bạ quán">
              <Store size={14} className="text-amber-400" />
              <span>50+ Quán</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid: 2 Columns - Compact, Organized & Professional */}
      <div className="about-bento-grid">
        {/* Left Column: Sứ mệnh & Đội ngũ sáng lập */}
        <div className="about-bento-col">
          {/* Card 1: Câu chuyện & Giá trị cốt lõi */}
          <div className="about-card-panel">
            <div className="about-panel-header">
              <h2>Câu Chuyện &amp; Sứ Mệnh Dự Án</h2>
              <span className="about-panel-badge">Sứ Mệnh</span>
            </div>
            
            <p className="about-panel-lead">
              &ldquo;Trưa nay ăn gì?&rdquo;, &ldquo;Tối nay nhậu quán nào?&rdquo; — Câu hỏi muôn thuở lặp đi lặp lại khiến các nhóm bạn bè, đồng nghiệp, gia đình hay khách du lịch tốn hàng chục phút đắn đo nhưng cuối cùng vẫn rơi vào bế tắc.
            </p>
            
            <p className="about-panel-text">
              <strong>Xuân Hòa Có Gì</strong> được xây dựng nhằm giải quyết triệt để sự đắn đo bằng vòng quay ngẫu nhiên công bằng, đồng thời là cẩm nang tra cứu 300+ món ăn và 50+ quán xá chuẩn vị tại Phường Xuân Hòa.
            </p>

            <div className="about-core-values">
              <div className="core-value-item">
                <Dices size={16} className="text-amber-400 shrink-0" />
                <div>
                  <strong>Chốt kèo dứt khoát:</strong>
                  <span> Vòng quay 1-chạm, nói không với đùn đẩy &ldquo;ăn gì cũng được&rdquo;.</span>
                </div>
              </div>
              <div className="core-value-item">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <strong>100% Xác thực:</strong>
                  <span> Tồn tại thật, đầy đủ địa chỉ, hotline, thực đơn và chỉ đường Google Maps.</span>
                </div>
              </div>
              <div className="core-value-item">
                <Heart size={16} className="text-rose-400 shrink-0" />
                <div>
                  <strong>Phi lợi nhuận:</strong>
                  <span> Dành tặng người dân bản địa, sinh viên &amp; du khách ghé thăm Xuân Hòa, miễn phí 100%, không quảng cáo phiền toái.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Founder Profile (Tích hợp liền mạch, không trùng lặp) */}
          <div className="about-card-panel">
            <div className="about-panel-header">
              <h2>Đội Ngũ Vận Hành &amp; Bản Quyền</h2>
              <span className="about-panel-badge founder">Sáng Lập</span>
            </div>

            <div className="about-founder-compact">
              <div className="founder-avatar-box">
                <img 
                  src="/brand/brand-icon-mark.webp" 
                  alt="MinhTT" 
                  className="founder-avatar-img"
                />
              </div>

              <div className="founder-details">
                <div className="founder-name-row">
                  <h3>MinhTT</h3>
                  <span className="founder-title-pill">Founder &amp; Food Curator</span>
                </div>
                <p className="founder-bio">
                  Phụ trách kiến trúc hệ thống, thuật toán vòng quay và tuyển chọn dữ liệu thực tế tại Xuân Hòa.
                </p>
                <div className="founder-actions-row">
                  <a 
                    href="https://www.facebook.com/minhttvp/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="founder-fb-btn"
                  >
                    <span>Facebook cá nhân</span>
                    <ExternalLink size={12} />
                  </a>
                  <span className="founder-location-tag inline-flex items-center gap-1">
                    <MapPin size={12} className="text-amber-400" /> Phúc Yên, Vĩnh Phúc
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Kênh truyền thông & Gợi ý quán mới */}
        <div className="about-bento-col">
          {/* Card 3: Kênh truyền thông chính thức */}
          <div className="about-card-panel">
            <div className="about-panel-header">
              <h2>Kênh Truyền Thông Chính Thức</h2>
              <span className="about-panel-badge channels">Cộng Đồng</span>
            </div>
            <p className="about-panel-sub">
              Theo dõi và tham gia các kênh chính thức để cập nhật quán mới, deal hot và giao lưu cùng cộng đồng:
            </p>

            <div className="about-channel-items">
              {/* Fanpage */}
              <div className="about-channel-row">
                <div className="channel-icon-avatar page">
                  <Globe size={18} className="text-blue-400" />
                </div>
                <div className="channel-row-content">
                  <div className="channel-row-top">
                    <strong>Xuân Hòa Có Gì</strong>
                    <span className="channel-mini-tag page">Fanpage</span>
                  </div>
                  <p>Tin tức món ngon, review quán xá &amp; địa điểm hot quanh trường SP2.</p>
                </div>
                <a 
                  href="https://www.facebook.com/xuanhoacogi" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="channel-link-icon-btn page"
                  title="Truy cập Fanpage"
                >
                  <span>Truy Cập</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              {/* Group Trà Đá Xuho */}
              <div className="about-channel-row">
                <div className="channel-icon-avatar group">
                  <Users size={18} className="text-amber-400" />
                </div>
                <div className="channel-row-content">
                  <div className="channel-row-top">
                    <strong>Trà Đá Xuho</strong>
                    <span className="channel-mini-tag group">Group Giao Lưu</span>
                  </div>
                  <p>Cộng đồng giao lưu ẩm thực Xuân Hòa — chia sẻ quán ngon, tìm bạn ăn, hỏi địa chỉ uy tín.</p>
                </div>
                <a 
                  href="https://www.facebook.com/groups/397463820097107" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="channel-link-icon-btn group"
                  title="Tham gia Group Trà Đá Xuho"
                >
                  <span>Tham Gia</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>

          {/* Card 4: Form đề xuất quán ăn mới (Gọn gàng, ngăn nắp) */}
          <div className="about-card-panel">
            <div className="about-panel-header">
              <h2>Gợi Ý Quán Ăn Mới</h2>
              <span className="about-panel-badge contribute">Đóng Góp</span>
            </div>
            <p className="about-panel-sub">
              Biết quán ngon hoặc món tủ nào chưa có trên web? Gửi ngay để ban quản trị bổ sung:
            </p>

            {formSent ? (
              <div className="about-form-success-compact">
                <Check size={20} className="text-emerald-400 shrink-0" />
                <div>
                  <h4>Đã tiếp nhận thông tin!</h4>
                  <p>Cảm ơn bạn. Ban quản trị sẽ xác minh và cập nhật lên hệ thống sớm nhất.</p>
                </div>
              </div>
            ) : (
              <form className="about-mini-form" onSubmit={handleSubmit}>
                <div className="mini-form-row">
                  <div className="mini-form-group">
                    <label htmlFor="suggest-name">Tên quán / Món <span className="text-amber-400">*</span></label>
                    <input
                      id="suggest-name"
                      type="text"
                      required
                      placeholder="VD: Bún Chả 36, Ốc Đêm..."
                      value={placeName}
                      onChange={(e) => setPlaceName(e.target.value)}
                    />
                  </div>
                  <div className="mini-form-group">
                    <label htmlFor="suggest-address">Vị trí</label>
                    <input
                      id="suggest-address"
                      type="text"
                      placeholder="VD: Cổng KTX ĐHSP2..."
                      value={placeAddress}
                      onChange={(e) => setPlaceAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mini-form-group">
                  <label htmlFor="suggest-note">Ghi chú thêm</label>
                  <input
                    id="suggest-note"
                    type="text"
                    placeholder="Món tủ ngon nhất, khoảng giá..."
                    value={placeNote}
                    onChange={(e) => setPlaceNote(e.target.value)}
                  />
                </div>

                <button type="submit" className="mini-form-submit-btn">
                  <Send size={14} />
                  <span>Gửi Gợi Ý Quán Mới</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
