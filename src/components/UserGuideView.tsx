import React from 'react';
import { 
  ArrowLeft, 
  Dices, 
  UtensilsCrossed, 
  Store, 
  Sparkles, 
  Smartphone, 
  HelpCircle, 
  Compass, 
  Award, 
  Clock, 
  Wallet, 
  MapPin, 
  Volume2, 
  Share2, 
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Target
} from 'lucide-react';

interface UserGuideViewProps {
  onGoToSpin: () => void;
  onGoToDishes: () => void;
  onGoToPlaces: () => void;
  onGoToAbout: () => void;
}

export function UserGuideView({
  onGoToSpin,
  onGoToDishes,
  onGoToPlaces,
  onGoToAbout,
}: UserGuideViewProps) {
  return (
    <div className="guide-page-container">
      {/* Sleek, Synchronized Header Bar */}
      <div className="catalog-header-bar">
        <div className="catalog-header-top-row">
          <button className="catalog-back-pill-btn" onClick={onGoToSpin} title="Quay lại vòng quay">
            <ArrowLeft size={15} />
            <span>Về Vòng Quay</span>
          </button>

          <div className="catalog-header-title-col">
            <h1 className="catalog-title-main">
              HƯỚNG DẪN <span>SỬ DỤNG</span>
            </h1>
            <p className="catalog-title-sub">
              Bí kíp làm chủ mọi tính năng của nền tảng ẩm thực Xuân Hòa Có Gì
            </p>
            <div className="catalog-header-badges-row">
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <BookOpen size={12} className="text-amber-400" />
                <span>4 Thao Tác Trong 10 Giây</span>
              </span>
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Target size={12} className="text-emerald-400" />
                <span>Vòng Quay Chốt Kèo</span>
              </span>
              <span className="header-tag-pill inline-flex items-center gap-1.5">
                <Compass size={12} className="text-sky-400" />
                <span>Bản Đồ &amp; Hotline Thật</span>
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

      {/* Guide Content Sections */}
      <div className="guide-sections-wrapper">
        {/* Section 1: Quick Start in 4 Steps */}
        <section className="guide-card-section">
          <div className="guide-section-header">
            <div className="guide-step-number">01</div>
            <div>
              <h2>Bắt Đầu Nhanh Trong 10 Giây</h2>
              <p>Chỉ với 4 thao tác cực kỳ đơn giản để chấm dứt căn bệnh &ldquo;Ăn gì cũng được&rdquo;.</p>
            </div>
          </div>

          <div className="guide-steps-grid">
            <div className="guide-step-card">
              <div className="step-badge">Bước 1</div>
              <div className="step-icon-wrap">
                <Clock size={24} className="text-amber-400" />
              </div>
              <h3>Chọn Bữa Ăn Theo Giờ</h3>
              <p>
                Hệ thống tự động đồng bộ theo giờ thực tế của bạn (Sáng, Trưa, Xế chiều, Tối hoặc Ăn đêm). Bạn có thể bấm chọn bữa thủ công nếu muốn.
              </p>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Bước 2</div>
              <div className="step-icon-wrap">
                <Wallet size={24} className="text-emerald-400" />
              </div>
              <h3>Chọn Ngân Sách Ví Tiền</h3>
              <p>
                Chọn mức giá phù hợp với túi tiền hôm nay (Dưới 35k bình dân, 50k no nê, 70k ăn ngon hoặc bàn tiệc lẩu nướng nhóm).
              </p>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Bước 3</div>
              <div className="step-icon-wrap">
                <Dices size={24} className="text-amber-300" />
              </div>
              <h3>Bấm Nút Quay Vàng Kim</h3>
              <p>
                Nhấn <strong>QUAY CHỌN MÓN</strong> (hoặc <strong>QUAY CHỌN QUÁN</strong>). Vòng quay CS:GO mượt mà sẽ cuộn ngẫu nhiên và chọn ra kết quả định mệnh.
              </p>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Bước 4</div>
              <div className="step-icon-wrap">
                <MapPin size={24} className="text-red-400" />
              </div>
              <h3>Xem Quán &amp; Chốt Kèo</h3>
              <p>
                Nhận kết quả kèm địa chỉ quán bán thực tế tại Xuân Hòa, hotline ship đồ ăn và nút mở Google Maps để dẫn đường trực tiếp.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Mode Dish vs Mode Place */}
        <section className="guide-card-section">
          <div className="guide-section-header">
            <div className="guide-step-number">02</div>
            <div>
              <h2>2 Chế Độ: Quay Chọn Món vs Quay Chọn Quán</h2>
              <p>Tùy theo nhu cầu thực tế của bạn và nhóm bạn hôm nay.</p>
            </div>
          </div>

          <div className="guide-compare-grid">
            <div className="compare-card">
              <div className="compare-header">
                <UtensilsCrossed size={22} className="text-amber-400" />
                <h3>Chế Độ: Quay Chọn Món</h3>
              </div>
              <p className="compare-desc">
                Dành cho khi bạn đang đói nhưng <strong>chưa biết nên ăn món gì</strong> (Phở bò, Cơm tấm, Bún đậu mắm tôm, Mì cay, Xôi cốm...).
              </p>
              <ul className="compare-list">
                <li><CheckCircle2 size={16} className="text-emerald-400" /> Kho dữ liệu hơn 300+ món ăn thực tế xác thực tại Xuân Hòa.</li>
                <li><CheckCircle2 size={16} className="text-emerald-400" /> Lọc theo bữa (Ăn sáng, Ăn trưa, Ăn tối, Ăn đêm, Đồ uống, Món nhậu).</li>
                <li><CheckCircle2 size={16} className="text-emerald-400" /> Mỗi món trúng thưởng đều hiển thị quán bán uy tín quanh ĐH Sư Phạm 2.</li>
              </ul>
            </div>

            <div className="compare-card">
              <div className="compare-header">
                <Store size={22} className="text-purple-400" />
                <h3>Chế Độ: Quay Chọn Quán</h3>
              </div>
              <p className="compare-desc">
                Dành cho khi đã có người đi cùng và cần <strong>tìm quán ăn, quán nhậu, quán lẩu nướng hay cafe</strong> uy tín để ghé.
              </p>
              <ul className="compare-list">
                <li><CheckCircle2 size={16} className="text-emerald-400" /> Danh bạ 50+ địa điểm ẩm thực xác thực quanh trường ĐHSP Hà Nội 2.</li>
                <li><CheckCircle2 size={16} className="text-emerald-400" /> Lọc theo kèo tụ tập: Lai rai bạn bè, Sinh nhật, Gia đình, Quán đêm...</li>
                <li><CheckCircle2 size={16} className="text-emerald-400" /> Có sẵn menu chi tiết, khoảng giá mỗi người, hotline và review thực tế.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: EXP & Gourmet Level System */}
        <section className="guide-card-section">
          <div className="guide-section-header">
            <div className="guide-step-number">03</div>
            <div>
              <h2>Hệ Thống EXP &amp; Cấp Bậc Sành Ăn</h2>
              <p>Tích lũy kinh nghiệm mỗi khi quay để thăng cấp danh hiệu ẩm thực Xuân Hòa.</p>
            </div>
          </div>

          <div className="guide-exp-box">
            <div className="exp-intro">
              <Award size={32} className="text-amber-400" />
              <div>
                <h4>Quay càng nhiều — Cấp càng cao!</h4>
                <p>Mỗi lượt quay thành công sẽ mang về cho bạn điểm EXP tương ứng với độ hiếm của món/quán:</p>
              </div>
            </div>

            <div className="exp-tiers-grid">
              <div className="tier-card tier-blue">
                <span className="tier-label">Bình dân</span>
                <span className="tier-exp">+10 EXP</span>
                <span className="tier-note">&lt; 35.000đ</span>
              </div>
              <div className="tier-card tier-purple">
                <span className="tier-label">Ăn ngon</span>
                <span className="tier-exp">+20 EXP</span>
                <span className="tier-note">35k - 65k</span>
              </div>
              <div className="tier-card tier-pink">
                <span className="tier-label">Đặc sản</span>
                <span className="tier-exp">+30 EXP</span>
                <span className="tier-note">65k - 120k</span>
              </div>
              <div className="tier-card tier-red">
                <span className="tier-label">Bàn tiệc</span>
                <span className="tier-exp">+40 EXP</span>
                <span className="tier-note">120k - 250k</span>
              </div>
              <div className="tier-card tier-gold">
                <span className="tier-label">Đại tiệc</span>
                <span className="tier-exp">+50 EXP</span>
                <span className="tier-note">&gt; 250.000đ</span>
              </div>
            </div>

            <div className="rank-progression">
              <strong>Bảng Danh Hiệu:</strong>
              <div className="rank-chips">
                <span className="rank-chip">Cấp 1-4: Người Mới Khám Phá</span>
                <ChevronRight size={14} className="text-slate-500" />
                <span className="rank-chip">Cấp 5-9: Khách Quen Xuân Hòa</span>
                <ChevronRight size={14} className="text-slate-500" />
                <span className="rank-chip">Cấp 10-14: Thổ Địa Sành Ăn</span>
                <ChevronRight size={14} className="text-slate-500" />
                <span className="rank-chip">Cấp 15+: Vua Ẩm Thực Xuân Hòa</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Install PWA / Add to Home Screen */}
        <section className="guide-card-section">
          <div className="guide-section-header">
            <div className="guide-step-number">04</div>
            <div>
              <h2>Cài Đặt Lên Màn Hình Điện Thoại (Mở Nhanh Như App)</h2>
              <p>Không cần tải file nặng từ App Store, cài trực tiếp trong 5 giây.</p>
            </div>
          </div>

          <div className="guide-install-grid">
            <div className="install-card">
              <div className="install-card-title">
                <Smartphone size={20} className="text-amber-400" />
                <h3>Dành cho iPhone &amp; iPad (Safari)</h3>
              </div>
              <ol className="install-steps-list">
                <li>Mở trình duyệt <strong>Safari</strong> và truy cập website.</li>
                <li>Bấm vào biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh công cụ dưới đáy.</li>
                <li>Cuộn xuống chọn <strong>&ldquo;Thêm vào Màn hình chính&rdquo; (Add to Home Screen)</strong>.</li>
                <li>Bấm <strong>&ldquo;Thêm&rdquo; (Add)</strong> ở góc trên bên phải. Xong!</li>
              </ol>
            </div>

            <div className="install-card">
              <div className="install-card-title">
                <Smartphone size={20} className="text-emerald-400" />
                <h3>Dành cho Android (Google Chrome)</h3>
              </div>
              <ol className="install-steps-list">
                <li>Mở trình duyệt <strong>Chrome</strong> và truy cập website.</li>
                <li>Bấm vào biểu tượng <strong>Menu 3 chấm (⋮)</strong> ở góc trên bên phải.</li>
                <li>Chọn mục <strong>&ldquo;Cài đặt ứng dụng&rdquo;</strong> hoặc <strong>&ldquo;Thêm vào màn hình chính&rdquo;</strong>.</li>
                <li>Xác nhận bấm <strong>Cài đặt</strong>. Biểu tượng website sẽ xuất hiện trên màn hình!</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Section 5: FAQ & Tips */}
        <section className="guide-card-section">
          <div className="guide-section-header">
            <div className="guide-step-number">05</div>
            <div>
              <h2>Câu Hỏi Thường Gặp (FAQ)</h2>
              <p>Những điều bạn có thể thắc mắc khi sử dụng website.</p>
            </div>
          </div>

          <div className="guide-faq-list">
            <div className="faq-item">
              <h4>Website có thu phí người dùng hay quán ăn không?</h4>
              <p>
                Hoàn toàn <strong>MIỄN PHÍ 100%</strong>. Website phi lợi nhuận phục vụ người dân địa phương, sinh viên và khách du lịch ghé thăm Phường Xuân Hòa.
              </p>
            </div>

            <div className="faq-item">
              <h4>Nếu quay ra món mình không thích thì sao?</h4>
              <p>
                Chỉ cần bấm nút <strong>QUAY TIẾP</strong>! Bạn cũng có thể mở danh sách <em>Gợi ý món khác</em> trong hộp thoại trúng thưởng để đổi món ngay.
              </p>
            </div>

            <div className="faq-item">
              <h4>Dữ liệu quán và món ăn có chính xác không?</h4>
              <p>
                100% các quán, địa chỉ và thực đơn đều được nhóm phát triển khảo sát và cập nhật thực tế tại các tuyến đường Nguyễn Văn Linh, Trần Phú, Lê Hồng Phong, Trường Chinh, khu vực trường ĐHSP2 và khắp Xuân Hòa.
              </p>
            </div>

            <div className="faq-item">
              <h4>Tôi muốn đóng góp thêm quán mới thì làm thế nào?</h4>
              <p>
                Bạn có thể xem mục <button className="guide-link-btn" onClick={onGoToAbout}>Giới thiệu về chúng tôi</button> để gửi đề xuất bổ sung quán ăn yêu thích vào danh bạ.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
