import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  ArrowRight, 
  Users, 
  Globe, 
  Heart, 
  RotateCw, 
  Compass, 
  MessageSquare
} from 'lucide-react';

interface ComingSoonViewProps {
  onGoToSpin: () => void;
  onGoToDishes?: () => void;
  onGoToPlaces?: () => void;
}

const CLASSIFIED_SNEAK_PEEKS = [
  {
    codeName: 'TỌA ĐỘ #XH-01',
    maskedDish: 'B**h X*o N*ng Gi*n',
    maskedPlace: 'Quán C* H*** (KĐT Xuân Hòa)',
    category: 'Ăn Chiều & Tối',
    distance: 'Cách ĐHSP2: ~320m',
    rarity: 'COVERT // CỰC PHẨM',
    hint: '“Vỏ bánh tráng mỏng vàng nghệ thơm nức, nhân tôm thịt tươi rói kèm nem lụi nướng sả và nước chấm chua ngọt gia truyền.”',
    image: '/dish_banh_xeo_co_hien.webp',
  },
  {
    codeName: 'TỌA ĐỘ #XH-02',
    maskedDish: 'C*m R*ng Th*p C*m Gi*n',
    maskedPlace: 'Quán W*n (Nguyễn Văn Linh)',
    category: 'Bữa Trưa & Tối',
    distance: 'Cách ĐHSP2: ~200m',
    rarity: 'SPECIAL // ĐẶC BIỆT',
    hint: '“Cơm rang hạt giòn rụm đảo cùng lạp xưởng, ngô ngọt, cà rốt và trứng vàng ươm mức giá bình dân vừa túi tiền.”',
    image: '/dish_qw_com_rang_thap_cam.webp',
  },
  {
    codeName: 'TỌA ĐỘ #XH-03',
    maskedDish: 'Đ*i G* L*c Ph* M*i Gi*n R*m',
    maskedPlace: 'Mr T** (Ngõ KTX)',
    category: 'Ăn Vặt & Bữa Trưa',
    distance: 'Cách KTX SP2: ~90m',
    rarity: 'RARE // QUÝ HIẾM',
    hint: '“Đùi gà chiên lớp vỏ vảy xù giòn tan rụm thịt mềm ngọt mọng nước, phủ đẫm lớp phô mai cam óng béo ngậy.”',
    image: '/dish_dui_ga_lac_pho_mai_mr_tea.webp',
  },
  {
    codeName: 'TỌA ĐỘ #XH-04',
    maskedDish: 'C*m R*ng D*a Th*m B*i',
    maskedPlace: 'Cu*n M*c (Nguyễn Văn Linh)',
    category: 'Món Độc Bản',
    distance: 'Cách Giảng đường E: ~250m',
    rarity: 'COVERT // CỰC PHẨM',
    hint: '“Cơm chiên trái dứa thơm lừng trong nửa quả dứa tươi, hạt cơm vàng nghệ tơi xốp, tôm thịt, lạp xưởng và hạt điều bùi béo.”',
    image: '/dish_cuonmoc_com_rang_dua.webp',
  },
  {
    codeName: 'TỌA ĐỘ #XH-05',
    maskedDish: 'Tr* Đ*o C*m S* Si*u To',
    maskedPlace: 'Tiệm Z**n (Cổng Trường)',
    category: 'Giải Khát Tụ Tập',
    distance: 'Cách ĐHSP2: ~150m',
    rarity: 'RARE // QUÝ HIẾM',
    hint: '“Cốc khổng lồ 1 Lít thơm nồng mùi sả tươi, cam vàng mọng nước cùng những lát đào giòn sần sật mát lạnh sảng khoái.”',
    image: '/dish_tra_dao_cam_sa_zian.webp',
  },
];

// Target Launch Time: Chủ Nhật 11.10.2026 lúc đúng 11:11:11s (Giờ Việt Nam UTC+7)
const TARGET_LAUNCH_TIMESTAMP = new Date('2026-10-11T11:11:11+07:00').getTime();

export function ComingSoonView({ onGoToSpin }: ComingSoonViewProps) {
  // Countdown Timer chính xác theo thời gian thực
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft());

  function calculateTimeLeft() {
    const now = new Date().getTime();
    const diff = TARGET_LAUNCH_TIMESTAMP - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sneak Peek Dish Selector
  const [peekIdx, setPeekIdx] = useState(0);
  const [isChanging, setIsChanging] = useState(false);
  const activePeek = CLASSIFIED_SNEAK_PEEKS[peekIdx];

  const handleNextPeek = () => {
    setIsChanging(true);
    setTimeout(() => {
      setPeekIdx((prev) => (prev + 1) % CLASSIFIED_SNEAK_PEEKS.length);
      setIsChanging(false);
    }, 250);
  };

  // Scrollytelling: Hiệu ứng cuộn nhả chữ mượt mà
  const storyRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('story-visible');
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    storyRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-14 space-y-20 selection:bg-amber-400 selection:text-black relative">
      
      {/* Background Chiều Sâu 3D: Nền Đen Onyx với Hào Quang Vàng Champagne Tỏa Ra Từ Tâm */}
      <div 
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 75% 50% at 50% 28%, rgba(212, 175, 55, 0.16) 0%, rgba(180, 130, 35, 0.05) 45%, transparent 75%),
            radial-gradient(ellipse 65% 40% at 50% 78%, rgba(212, 175, 55, 0.08) 0%, transparent 65%),
            radial-gradient(circle at 50% 50%, transparent 45%, rgba(3, 4, 6, 0.85) 100%)
          `
        }}
      />

      {/* TOP MINIMAL STATUS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#10131B]/90 border border-white/10 backdrop-blur-md shadow-lg shadow-black/40">
        <button
          onClick={onGoToSpin}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-all border border-white/10 hover:border-amber-400/40 w-fit"
        >
          <ArrowLeft size={14} className="text-amber-400" />
          <span>Vào Thử Phòng Lab (Beta)</span>
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-300 font-medium">Chuyên trị bệnh &ldquo;Ăn gì cũng được&rdquo;</span>
        </div>
      </div>

      {/* HERO SECTION (ĐÃ FIX TRIỆT ĐỂ CHÈN CHỮ, PHONG CÁCH QUIET LUXURY SANG TRỌNG) */}
      <section className="text-center space-y-8 pt-4">
        
        {/* Tag Pill phân tách rõ ràng */}
        <div>
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-mono tracking-widest uppercase">
            THỜI KHẮC KHAI MỞ // 2026
          </span>
        </div>

        {/* Tiêu đề H1 chữ trắng trang nhã, không đè vạch, không màu mè */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white uppercase leading-tight">
          Cỗ Máy Ẩm Thực Bí Mật <br className="hidden sm:inline" />
          Sắp Khai Mở Tại Xuân Hòa
        </h1>

        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
          Chấm dứt 30 phút mệt mỏi với câu hỏi kinh điển <strong className="text-white font-semibold">&ldquo;Trưa nay ăn gì?&rdquo;</strong>.
          Một giải pháp chọn món khách quan, 37+ tọa độ có thật quanh ĐHSP2, hotline gọi trực tiếp tới chủ quán mà không qua trung gian.
        </p>

        {/* COUNTDOWN TIMER CHUẨN XÁC: 11.10.2026 ĐÚNG 11:11:11s (HÀO QUANG VÀNG SANG TRỌNG) */}
        <div className="max-w-xl mx-auto space-y-3 pt-2 relative">
          {/* Lớp hào quang vàng tỏa tròn từ tâm sau hộp đồng hồ */}
          <div 
            className="absolute -inset-4 rounded-3xl pointer-events-none -z-10"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(212, 175, 55, 0.22) 0%, rgba(212, 175, 55, 0.05) 50%, transparent 70%)',
              filter: 'blur(20px)'
            }}
          />

          <div className="p-5 sm:p-7 rounded-2xl bg-gradient-to-b from-[#121622] to-[#0A0C11] border border-amber-400/25 shadow-2xl backdrop-blur-md">
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-5xl font-mono font-bold text-white tracking-tight">
                  {String(timeLeft.days).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-1.5">NGÀY</span>
              </div>
              <div className="flex flex-col items-center border-l border-white/5">
                <span className="text-3xl sm:text-5xl font-mono font-bold text-white tracking-tight">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-1.5">GIỜ</span>
              </div>
              <div className="flex flex-col items-center border-l border-white/5">
                <span className="text-3xl sm:text-5xl font-mono font-bold text-white tracking-tight">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-1.5">PHÚT</span>
              </div>
              <div className="flex flex-col items-center border-l border-white/5">
                <span className="text-3xl sm:text-5xl font-mono font-bold text-amber-400 tracking-tight">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-1.5">GIÂY</span>
              </div>
            </div>
          </div>

          {/* Dòng mốc thời gian khẳng định chính thức */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-300 font-mono">
            ★ Khai mở chính thức: <strong className="text-amber-400 font-bold">Chủ Nhật 11.10.2026 &mdash; Đúng 11:11:11s</strong>
          </div>
        </div>
      </section>

      {/* CINEMATIC SCROLLYTELLING (KÉO XUỐNG CHỮ LƯỚT RA MƯỢT MÀ) */}
      <section className="max-w-3xl mx-auto space-y-10 pt-4">
        
        <div 
          ref={(el) => { storyRefs.current[0] = el; }} 
          className="text-center space-y-2 opacity-20 translate-y-6 blur-[3px] transition-all duration-700 ease-out [&.story-visible]:opacity-100 [&.story-visible]:translate-y-0 [&.story-visible]:filter-none"
        >
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold">CÂU CHUYỆN THỰC ĐỊA</span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">Tại Sao Cỗ Máy Này Ra Đời?</h2>
          <p className="text-xs text-slate-400">Cuộn xuống từ từ để đọc câu chuyện thực tế</p>
        </div>

        {/* Hồi I */}
        <div 
          ref={(el) => { storyRefs.current[1] = el; }}
          className="p-6 sm:p-8 rounded-2xl bg-[#10131B]/80 border border-white/10 space-y-3 opacity-20 translate-y-6 blur-[3px] transition-all duration-700 ease-out [&.story-visible]:opacity-100 [&.story-visible]:translate-y-0 [&.story-visible]:filter-none hover:border-amber-400/30"
        >
          <div className="text-xs font-mono text-amber-400 font-semibold tracking-wider">HỒI 1 // 11:15 TRƯA TẠI CỔNG ĐHSP2</div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            Tiếng chuông hết tiết và bi kịch bắt đầu.
          </h3>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            Chuông reo. Cả nhóm bước ra khỏi giảng đường. Một câu hỏi quen thuộc vang lên phá tan bầu không khí vui vẻ:
            <span className="text-amber-300 italic block mt-2 text-base">&ldquo;Trưa nay ăn gì chúng mày ơi?&rdquo;</span>
          </p>
        </div>

        {/* Hồi II */}
        <div 
          ref={(el) => { storyRefs.current[2] = el; }}
          className="p-6 sm:p-8 rounded-2xl bg-[#10131B]/80 border border-white/10 space-y-3 opacity-20 translate-y-6 blur-[3px] transition-all duration-700 ease-out [&.story-visible]:opacity-100 [&.story-visible]:translate-y-0 [&.story-visible]:filter-none hover:border-amber-400/30"
        >
          <div className="text-xs font-mono text-amber-400 font-semibold tracking-wider">HỒI 2 // LỜI NÓI DỐI MANG TÊN &ldquo;GÌ CŨNG ĐƯỢC&rdquo;</div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            Vòng lặp từ chối bất tận.
          </h3>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal space-y-1.5">
            <span className="block">&bull; &ldquo;Ăn bún đậu ngõ KTX nhé?&rdquo; &mdash; <em className="text-slate-400">&ldquo;Thôi, chiều có tiết sợ ám mùi.&rdquo;</em></span>
            <span className="block">&bull; &ldquo;Thế cơm gà xối mỡ?&rdquo; &mdash; <em className="text-slate-400">&ldquo;Hôm qua vừa ăn xong ngấy lắm.&rdquo;</em></span>
            <span className="block">&bull; &ldquo;Hay ra quán lẩu?&rdquo; &mdash; <em className="text-slate-400">&ldquo;Cuối tháng rồi tiền đâu mà ăn lẩu.&rdquo;</em></span>
          </p>
          <p className="text-xs text-slate-400 pt-2 italic">
            Nửa tiếng trôi qua. Bụng đói lả. Tình bạn 4 năm bắt đầu lung lay chỉ vì không chốt được quán cơm trưa.
          </p>
        </div>

        {/* Hồi III */}
        <div 
          ref={(el) => { storyRefs.current[3] = el; }}
          className="p-6 sm:p-8 rounded-2xl bg-[#10131B]/80 border border-white/10 space-y-3 opacity-20 translate-y-6 blur-[3px] transition-all duration-700 ease-out [&.story-visible]:opacity-100 [&.story-visible]:translate-y-0 [&.story-visible]:filter-none hover:border-amber-400/30"
        >
          <div className="text-xs font-mono text-amber-400 font-semibold tracking-wider">HỒI 3 // SỰ XUẤT HIỆN CỦA SỐ PHẬN</div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            Không KOL quảng cáo dắt mũi. Trao quyền cho Vận Mệnh.
          </h3>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            Chúng tôi quyết định chấm dứt điều vô lý này.
            <strong className="text-white"> Xuân Hòa Có Gì</strong> không thuê reviewer nhận tiền nói khéo.
            Đúng <strong>1 cú click</strong>, thanh quay eSports trượt xé gió và chốt hạ món ăn trong 3 giây.
            Mức giá rõ ràng minh bạch, hotline gọi thẳng tới chủ quán nhận ship tận nơi nhanh chóng. 
            Không ai phải cãi vã, vì đó là <em>ý trời!</em>
          </p>
        </div>

      </section>

      {/* SNEAK PEEK (TỌA ĐỘ NỬA KÍN NỬA HỞ - SANG TRỌNG & BÍ ẨN) */}
      <section 
        ref={(el) => { storyRefs.current[4] = el; }}
        className="p-6 sm:p-8 rounded-3xl bg-[#10131B]/90 border border-white/10 space-y-6 shadow-xl opacity-20 translate-y-6 blur-[3px] transition-all duration-700 ease-out [&.story-visible]:opacity-100 [&.story-visible]:translate-y-0 [&.story-visible]:filter-none"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider font-semibold">TỌA ĐỘ ẨM THỰC // NỬA KÍN NỬA HỞ</span>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">Đoán Thử Một Quán Ruột</h2>
            <p className="text-xs text-slate-400">Hình ảnh và danh tính được làm mờ nhẹ. Bạn có nhận ra quán quen này?</p>
          </div>
          <button 
            onClick={handleNextPeek} 
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs transition-all hover:border-amber-400/40 whitespace-nowrap"
          >
            <RotateCw size={13} className="text-amber-400" />
            <span>Đổi Món Khác</span>
          </button>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 items-center transition-opacity duration-300 ${isChanging ? 'opacity-30' : 'opacity-100'}`}>
          <div className="md:col-span-5 relative rounded-2xl overflow-hidden aspect-video md:aspect-square bg-black border border-white/10">
            <img 
              src={activePeek.image} 
              alt={activePeek.maskedDish} 
              className="w-full h-full object-cover filter blur-[7px] brightness-[0.8] transition-all"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-between p-4">
              <span className="self-start px-2 py-0.5 rounded bg-black/80 border border-amber-400/40 font-mono text-[10px] text-amber-300">
                {activePeek.codeName}
              </span>
              <div className="text-[10px] font-mono text-slate-300 text-center bg-black/70 py-1 rounded border border-white/5">
                MỞ KHÓA 100% VÀO 11:11:11s (11.10.2026)
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                <span>ĐHSP2</span>
                <span>{peekIdx + 1} / {CLASSIFIED_SNEAK_PEEKS.length}</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 space-y-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-400/30 text-amber-300">
              {activePeek.rarity}
            </span>

            <div>
              <h3 className="text-2xl font-black text-white tracking-wide">{activePeek.maskedDish}</h3>
              <div className="text-xs text-amber-400 font-mono mt-0.5 font-semibold">{activePeek.maskedPlace}</div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-slate-300 text-xs sm:text-sm leading-relaxed font-serif italic">
              {activePeek.hint}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono text-slate-400 pt-1">
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                <span className="text-[10px] text-slate-500 block">KHOẢNG CÁCH</span>
                <span className="text-slate-200">{activePeek.distance}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                <span className="text-[10px] text-slate-500 block">HOTLINE BẾP</span>
                <span className="text-slate-200">09xx.xxx.876</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KHU VỰC: ỦNG HỘ TÁC GIẢ & CỘNG ĐỒNG "TRÀ ĐÁ XUHO" */}
      <section 
        ref={(el) => { storyRefs.current[5] = el; }}
        className="space-y-10 opacity-20 translate-y-6 blur-[3px] transition-all duration-700 ease-out [&.story-visible]:opacity-100 [&.story-visible]:translate-y-0 [&.story-visible]:filter-none"
      >
        <div className="text-center space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold">KẾT NỐI TRUYỀN THÔNG &amp; NGƯỜI THỰC VIỆC THỰC</span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
            Ủng Hộ Tác Giả &amp; Gia Nhập Trà Đá XuHo
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Dự án phi lợi nhuận được xây dựng vì tình yêu với ẩm thực sinh viên và khu phố Xuân Hòa. Hãy bấm theo dõi để cùng chúng tôi đồng hành!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* 1. Facebook Cá Nhân Tác Giả */}
          <div className="p-6 rounded-2xl bg-[#10131B]/80 border border-white/10 flex flex-col justify-between space-y-5 hover:border-amber-400/30 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400">
                <Users size={18} />
              </div>
              <div className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">NGƯỜI PHÁT TRIỂN DỰ ÁN</div>
              <h3 className="text-lg font-bold text-white">Facebook Cá Nhân MinhTT</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kết nối trực tiếp cùng tác giả. Góp ý bổ sung quán ăn ruột của bạn hoặc cùng thảo luận về công nghệ đằng sau cỗ máy.
              </p>
            </div>
            <a 
              href="https://www.facebook.com/minhttvp" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs text-center transition-all block"
            >
              Theo Dõi Trang Cá Nhân &rarr;
            </a>
          </div>

          {/* 2. Cộng Đồng Trà Đá XuHo */}
          <div className="p-6 rounded-2xl bg-[#10131B]/80 border border-amber-500/30 flex flex-col justify-between space-y-5 shadow-lg shadow-amber-500/5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <MessageSquare size={18} />
              </div>
              <div className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">CỘNG ĐỒNG CHÍNH THỨC</div>
              <h3 className="text-lg font-bold text-white">Group &ldquo;Trà Đá XuHo&rdquo;</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Nơi tụ tập của sinh viên ĐHSP2 và cư dân Xuân Hòa: Chém gió, rủ kèo lẩu nướng đêm muộn, chia sẻ quán ngon và cảnh báo quán dở.
              </p>
            </div>
            <a 
              href="https://www.facebook.com/groups/397463820097107" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs text-center transition-all block shadow-md shadow-amber-400/20"
            >
              Gia Nhập Trà Đá XuHo &rarr;
            </a>
          </div>

          {/* 3. Fanpage Truyền Thông */}
          <div className="p-6 rounded-2xl bg-[#10131B]/80 border border-white/10 flex flex-col justify-between space-y-5 hover:border-amber-400/30 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400">
                <Globe size={18} />
              </div>
              <div className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">TRUYỀN THÔNG &amp; TIN TỨC</div>
              <h3 className="text-lg font-bold text-white">Fanpage Xuân Hòa Có Gì</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kênh cập nhật tiến độ Giờ G (11:11:11s ngày 11.10.2026), các đợt phát voucher mở hòm và tọa độ quán mới được bổ sung.
              </p>
            </div>
            <a 
              href="https://www.facebook.com/xuanhoacogi" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs text-center transition-all block"
            >
              Bấm Theo Dõi Fanpage &rarr;
            </a>
          </div>

        </div>

        {/* Lời tri ân từ tác giả */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Heart size={13} className="text-amber-400" />
            <span>LỜI CẢM ƠN TỪ TÁC GIẢ</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            &ldquo;Sự ủng hộ, lượt theo dõi và chia sẻ của các bạn chính là động lực lớn nhất để tôi tiếp tục hoàn thiện cỗ máy này trước giờ khai mở. Hẹn gặp mọi người vào <strong>11:11:11s Chủ Nhật này!</strong>&rdquo;
          </p>
          <div className="text-xs font-mono text-amber-400 pt-1">&mdash; MinhTT (Founder)</div>
        </div>

      </section>

      {/* FOOTER CALL-TO-ACTION */}
      <div className="text-center pt-2 pb-8 space-y-3 border-t border-white/5">
        <p className="text-xs text-slate-400">
          Muốn mở thử phòng lab vòng quay chọn món ngay bây giờ?
        </p>
        <button
          onClick={onGoToSpin}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider border border-white/10 hover:border-amber-400/40 transition-all"
        >
          <span>Khám Phá Phòng Lab Vòng Quay Demo</span>
          <ArrowRight size={14} className="text-amber-400" />
        </button>
      </div>

    </div>
  );
}
