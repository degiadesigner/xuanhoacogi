import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, MoreHorizontal, Search, X } from 'lucide-react';
import {
  BOTTOM_SHEET_CATEGORY_SECTIONS,
  QUICK_CATEGORY_BAR_ITEMS,
  doesPlaceMatchQuickFilter,
  getActiveFilterDisplayMeta,
  renderRegistryIcon,
  type LucideRegistryIconName,
} from '@/lib/map/map-category-registry';
import type { PlaceLocation } from '@/lib/map/map-types';

interface MapQuickCategoryBarProps {
  /** Bộ lọc đang bật (`null` = Mặc định chỉ hiện địa danh chính, tắt toàn bộ quán) */
  activeFilterId: string | null;
  onSelectFilter: (filterId: string | null) => void;
  places?: PlaceLocation[];
  className?: string;
}

interface CompactAccordionItem {
  id: string;
  label: string;
  fullLabel?: string;
  iconName: LucideRegistryIconName;
  keywords?: string[];
}

interface CompactAccordionGroup {
  id: string;
  title: string;
  iconName: LucideRegistryIconName;
  items: CompactAccordionItem[];
}

/**
 * 9 NHÓM ACCORDION THEO ĐÚNG THỨ TỰ ƯU TIÊN BẢN ĐỒ:
 * 1. Địa danh & Công cộng -> 2. Giáo dục -> 3. Y tế -> 4. Hành chính ->
 * 5. Ăn uống -> 6. Vui chơi -> 7. Mua sắm -> 8. Xe & Di chuyển -> 9. Dịch vụ
 * (Sử dụng nguyên vẹn các categoryId/subcategoryId có sẵn trong taxonomy, không sửa logic lọc)
 */
const COMPACT_ACCORDION_GROUPS: CompactAccordionGroup[] = [
  {
    id: 'grp_landmark_public',
    title: 'Địa danh & Công cộng',
    iconName: 'Compass',
    items: [
      { id: 'landmark', label: 'Địa danh', fullLabel: 'Địa danh nổi bật', iconName: 'Compass', keywords: ['địa danh', 'biểu tượng', 'điểm tham quan'] },
      { id: 'square', label: 'Quảng trường', iconName: 'Compass', keywords: ['quảng trường', 'sân vận động'] },
      { id: 'lake', label: 'Hồ', iconName: 'Waves', keywords: ['hồ', 'đại lải', 'lập đinh'] },
      { id: 'bridge', label: 'Cầu', iconName: 'Milestone', keywords: ['cầu', 'xuân phương', 'cà lồ'] },
      { id: 'park', label: 'Công viên', iconName: 'Trees', keywords: ['công viên', 'vườn hoa', 'cây xanh'] },
      { id: 'market', label: 'Chợ', iconName: 'ShoppingBasket', keywords: ['chợ', 'chợ xuân hòa'] },
      { id: 'post_office', label: 'Bưu điện', iconName: 'Mail', keywords: ['bưu điện', 'bưu cục', 'chuyển phát'] },
    ],
  },
  {
    id: 'grp_education',
    title: 'Giáo dục',
    iconName: 'GraduationCap',
    items: [
      { id: 'education', label: 'Trường học', fullLabel: 'Tất cả trường học', iconName: 'GraduationCap', keywords: ['trường học', 'giáo dục'] },
      { id: 'university', label: 'Đại học', fullLabel: 'Đại học / Học viện', iconName: 'GraduationCap', keywords: ['đại học', 'đhsp2', 'kiến trúc'] },
      { id: 'college', label: 'Cao đẳng', fullLabel: 'Cao đẳng / Trung cấp', iconName: 'GraduationCap', keywords: ['cao đẳng', 'trung cấp', 'cơ điện'] },
      { id: 'high_school', label: 'THPT', fullLabel: 'Trường THPT (Cấp 3)', iconName: 'School', keywords: ['thpt', 'cấp 3'] },
      { id: 'secondary_school', label: 'THCS', fullLabel: 'Trường THCS (Cấp 2)', iconName: 'School', keywords: ['thcs', 'cấp 2'] },
      { id: 'primary_school', label: 'Tiểu học', fullLabel: 'Trường Tiểu học (Cấp 1)', iconName: 'School', keywords: ['tiểu học', 'cấp 1'] },
      { id: 'kindergarten', label: 'Mầm non', fullLabel: 'Trường Mầm non / Mẫu giáo', iconName: 'Baby', keywords: ['mầm non', 'mẫu giáo', 'nhà trẻ'] },
    ],
  },
  {
    id: 'grp_health',
    title: 'Y tế',
    iconName: 'Hospital',
    items: [
      { id: 'hospital', label: 'Bệnh viện', fullLabel: 'Y tế / Bệnh viện', iconName: 'Hospital', keywords: ['bệnh viện', 'đa khoa', 'y tế'] },
      { id: 'clinic', label: 'Phòng khám', fullLabel: 'Phòng khám / Nha khoa', iconName: 'Stethoscope', keywords: ['phòng khám', 'nha khoa', 'bác sĩ'] },
      { id: 'pharmacy', label: 'Nhà thuốc', fullLabel: 'Nhà thuốc / Hiệu thuốc', iconName: 'Pill', keywords: ['nhà thuốc', 'hiệu thuốc', 'dược'] },
      { id: 'health_station', label: 'Trạm y tế', fullLabel: 'Trạm y tế phường', iconName: 'HeartPulse', keywords: ['trạm y tế'] },
    ],
  },
  {
    id: 'grp_government',
    title: 'Hành chính',
    iconName: 'Landmark',
    items: [
      { id: 'government', label: 'UBND / Cơ quan', fullLabel: 'UBND / Cơ quan hành chính', iconName: 'Landmark', keywords: ['ubnd', 'cơ quan', 'hành chính', 'đảng ủy'] },
      { id: 'police', label: 'Công an', fullLabel: 'Công an phường / An ninh', iconName: 'Shield', keywords: ['công an', 'an ninh', 'cảnh sát'] },
      { id: 'public_service', label: 'Dịch vụ công', fullLabel: 'Dịch vụ công / Một cửa', iconName: 'Building2', keywords: ['dịch vụ công', 'một cửa', 'điện lực'] },
      { id: 'cultural_center', label: 'Nhà văn hóa', fullLabel: 'Nhà văn hóa / Hội trường', iconName: 'Landmark', keywords: ['nhà văn hóa', 'hội trường'] },
    ],
  },
  {
    id: 'grp_food',
    title: 'Ăn uống',
    iconName: 'Utensils',
    items: [
      { id: 'local_food', label: 'Quán ăn', iconName: 'Utensils', keywords: ['quán ăn', 'ăn uống', 'nhà hàng'] },
      { id: 'noodle', label: 'Bún / Phở', iconName: 'Soup', keywords: ['bún', 'phở', 'mì', 'miến'] },
      { id: 'rice', label: 'Cơm / Suất ăn', iconName: 'UtensilsCrossed', keywords: ['cơm', 'suất ăn', 'cơm bình dân'] },
      { id: 'street_food', label: 'Ăn vặt', iconName: 'Sandwich', keywords: ['ăn vặt', 'bánh mì', 'đồ ăn nhanh', 'gà rán'] },
      { id: 'cafe', label: 'Cafe', iconName: 'Coffee', keywords: ['cafe', 'cà phê', 'trà chanh'] },
      { id: 'milk_tea', label: 'Trà sữa', iconName: 'CupSoda', keywords: ['trà sữa', 'nước ép', 'sinh tố'] },
      { id: 'pub', label: 'Quán nhậu / Bia', fullLabel: 'Quán nhậu / Bia / Lẩu nướng', iconName: 'Beer', keywords: ['quán nhậu', 'bia', 'lẩu', 'nướng'] },
    ],
  },
  {
    id: 'grp_entertainment',
    title: 'Vui chơi',
    iconName: 'Gamepad2',
    items: [
      { id: 'billiards', label: 'Bi-a', iconName: 'CircleDot', keywords: ['bi-a', 'billiards'] },
      { id: 'gaming', label: 'Gaming / Net', iconName: 'Gamepad2', keywords: ['gaming', 'quán net', 'cyber', 'ps5'] },
      { id: 'karaoke', label: 'Karaoke', iconName: 'Mic2', keywords: ['karaoke', 'phòng hát'] },
      { id: 'sports', label: 'Thể thao', fullLabel: 'Thể thao / Sân bóng / Vui chơi', iconName: 'Trophy', keywords: ['thể thao', 'sân bóng', 'cầu lông', 'gym', 'bể bơi'] },
    ],
  },
  {
    id: 'grp_shopping',
    title: 'Mua sắm',
    iconName: 'ShoppingBag',
    items: [
      { id: 'supermarket', label: 'Siêu thị', fullLabel: 'Siêu thị / Cửa hàng tiện lợi', iconName: 'Store', keywords: ['siêu thị', 'winmart', 'tiện lợi'] },
      { id: 'grocery', label: 'Tạp hóa', iconName: 'ShoppingBag', keywords: ['tạp hóa', 'bách hóa'] },
      { id: 'phone_shop', label: 'Điện thoại', fullLabel: 'Điện thoại / Điện máy', iconName: 'Smartphone', keywords: ['điện thoại', 'điện máy', 'phụ kiện', 'laptop'] },
      { id: 'fashion', label: 'Thời trang', iconName: 'Shirt', keywords: ['thời trang', 'quần áo', 'giày dép'] },
    ],
  },
  {
    id: 'grp_transport',
    title: 'Xe & Di chuyển',
    iconName: 'Fuel',
    items: [
      { id: 'fuel_station', label: 'Cây xăng', iconName: 'Fuel', keywords: ['cây xăng', 'trạm xăng', 'đổ xăng'] },
      { id: 'ev_charging', label: 'Trạm sạc', fullLabel: 'Trạm sạc xe điện', iconName: 'Zap', keywords: ['trạm sạc', 'xe điện', 'vinfast'] },
      { id: 'motorbike_repair', label: 'Sửa xe', fullLabel: 'Sửa xe máy / Gara ô tô', iconName: 'Wrench', keywords: ['sửa xe', 'vá xe', 'gara', 'rửa xe'] },
      { id: 'parking', label: 'Bãi gửi xe', fullLabel: 'Bãi gửi xe / Điểm xe buýt', iconName: 'ParkingCircle', keywords: ['bãi gửi xe', 'đỗ xe', 'xe buýt'] },
    ],
  },
  {
    id: 'grp_service',
    title: 'Dịch vụ',
    iconName: 'Briefcase',
    items: [
      { id: 'bank', label: 'Ngân hàng / ATM', iconName: 'Building2', keywords: ['ngân hàng', 'atm', 'rút tiền'] },
      { id: 'hotel', label: 'Khách sạn', fullLabel: 'Khách sạn / Nhà nghỉ', iconName: 'BedDouble', keywords: ['khách sạn', 'nhà nghỉ', 'homestay'] },
      { id: 'barber', label: 'Tóc / Làm đẹp', fullLabel: 'Cắt tóc / Salon / Spa', iconName: 'Scissors', keywords: ['cắt tóc', 'salon', 'spa', 'làm đẹp', 'nail'] },
      { id: 'other_service', label: 'Dịch vụ khác', fullLabel: 'Giặt là / Sửa chữa / Dịch vụ khác', iconName: 'Briefcase', keywords: ['giặt là', 'sửa chữa', 'in ấn', 'photocopy', 'dịch vụ'] },
    ],
  },
];

export const MapQuickCategoryBar: React.FC<MapQuickCategoryBarProps> = ({
  activeFilterId,
  onSelectFilter,
  places = [],
  className = '',
}) => {
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [sheetQuery, setSheetQuery] = useState('');
  // Mặc định chỉ mở nhóm đầu tiên ("Địa danh & Công cộng") để giao diện gọn gàng
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([
    COMPACT_ACCORDION_GROUPS[0].id,
  ]);

  // Khi mở popup, nếu đang có danh mục active thuộc nhóm nào thì đảm bảo nhóm đó cũng mở
  useEffect(() => {
    if (!isMoreSheetOpen) return;
    if (!activeFilterId) {
      setExpandedGroupIds([COMPACT_ACCORDION_GROUPS[0].id]);
      return;
    }
    const matchingGroup = COMPACT_ACCORDION_GROUPS.find((grp) =>
      grp.items.some((it) => it.id === activeFilterId)
    );
    if (matchingGroup) {
      setExpandedGroupIds((prev) =>
        prev.includes(matchingGroup.id) ? prev : [matchingGroup.id]
      );
    }
  }, [isMoreSheetOpen, activeFilterId]);

  // Kiểm tra xem bộ lọc đang bật có nằm ngoài 6 nút mặc định không (VD: chọn từ Popup "Thêm")
  const extraActiveMeta = useMemo(() => {
    if (!activeFilterId) return null;
    const inQuick = QUICK_CATEGORY_BAR_ITEMS.some((q) => q.id === activeFilterId);
    if (inQuick) return null;
    return getActiveFilterDisplayMeta(activeFilterId);
  }, [activeFilterId]);

  // Đếm số địa điểm đã định vị khớp với từng danh mục con & từng nhóm accordion
  const { itemCounts, groupCounts } = useMemo(() => {
    const iMap = new Map<string, number>();
    const gMap = new Map<string, number>();

    const verified = places.filter(
      (p) =>
        p.coordinateVerified &&
        p.lat !== null &&
        p.lng !== null &&
        (!p.visibilityStatus || p.visibilityStatus === 'visible')
    );

    for (const q of QUICK_CATEGORY_BAR_ITEMS) {
      iMap.set(
        q.id,
        verified.filter((p) => doesPlaceMatchQuickFilter(p, q.id)).length
      );
    }
    for (const sec of BOTTOM_SHEET_CATEGORY_SECTIONS) {
      for (const item of sec.items) {
        if (!iMap.has(item.id)) {
          iMap.set(
            item.id,
            verified.filter((p) => doesPlaceMatchQuickFilter(p, item.id)).length
          );
        }
      }
    }
    for (const grp of COMPACT_ACCORDION_GROUPS) {
      for (const item of grp.items) {
        if (!iMap.has(item.id)) {
          iMap.set(
            item.id,
            verified.filter((p) => doesPlaceMatchQuickFilter(p, item.id)).length
          );
        }
      }
      const groupUniqueMatches = verified.filter((p) =>
        grp.items.some((it) => doesPlaceMatchQuickFilter(p, it.id))
      ).length;
      gMap.set(grp.id, groupUniqueMatches);
    }

    return { itemCounts: iMap, groupCounts: gMap };
  }, [places]);

  // Khi người dùng nhập từ khóa tìm kiếm: bỏ qua trạng thái accordion, trả về danh sách phẳng các danh mục khớp
  const flatSearchResults = useMemo(() => {
    const q = sheetQuery.trim().toLowerCase();
    if (!q) return null;
    const seen = new Set<string>();
    const results: Array<CompactAccordionItem & { groupTitle: string }> = [];

    for (const grp of COMPACT_ACCORDION_GROUPS) {
      const groupMatches = grp.title.toLowerCase().includes(q);
      for (const it of grp.items) {
        if (seen.has(it.id)) continue;
        const labelMatches =
          it.label.toLowerCase().includes(q) ||
          (it.fullLabel && it.fullLabel.toLowerCase().includes(q)) ||
          (it.keywords && it.keywords.some((kw) => kw.toLowerCase().includes(q)));
        if (labelMatches || groupMatches) {
          seen.add(it.id);
          results.push({ ...it, groupTitle: grp.title });
        }
      }
    }
    return results;
  }, [sheetQuery]);

  const handleToggleQuickChip = (id: string) => {
    if (activeFilterId === id) {
      onSelectFilter(null);
    } else {
      onSelectFilter(id);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <>
      {/* THANH DANH MỤC NHANH NGAY DƯỚI Ô SEARCH (4 SHORTCUT PHỔ BIẾN + NÚT [THÊM] LUÔN HIỆN Ở CUỐI) */}
      <div
        data-testid="map-quick-category-bar"
        className={`pointer-events-auto w-full flex items-center justify-start gap-1.5 ${className}`}
      >
        <div
          role="toolbar"
          aria-label="Danh mục tìm kiếm nhanh trên bản đồ"
          className="flex items-center flex-nowrap gap-1.5 overflow-x-auto no-scrollbar min-w-0 py-0.5"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Nếu đang chọn 1 danh mục mở rộng từ mục "Thêm", hiển thị chip đang bật ở đầu thanh */}
          {extraActiveMeta && (
            <button
              type="button"
              onClick={() => onSelectFilter(null)}
              data-testid={`quick-cat-active-${extraActiveMeta.id}`}
              className="h-8 px-2.5 rounded-[10px] bg-[#059669] text-white border border-[#059669] shadow-[0_2px_6px_rgba(5,150,105,0.2)] text-[12px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
            >
              {renderRegistryIcon(extraActiveMeta.iconName, 15, 1.65)}
              <span className="whitespace-nowrap">{extraActiveMeta.label}</span>
              <X size={12} strokeWidth={1.75} className="ml-0.5 opacity-85" />
            </button>
          )}

          {QUICK_CATEGORY_BAR_ITEMS.map((item) => {
            const isActive = activeFilterId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`quick-cat-${item.id}`}
                onClick={() => handleToggleQuickChip(item.id)}
                className={`h-8 px-2 sm:px-2.5 rounded-[10px] text-[11.5px] sm:text-[12px] font-medium flex items-center gap-1 sm:gap-1.5 shrink-0 cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-[#059669] text-white border-[#059669] shadow-[0_2px_6px_rgba(5,150,105,0.2)] font-semibold'
                    : 'bg-white/96 hover:bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] shadow-[0_2px_6px_rgba(15,23,42,0.05)]'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-[#059669]'}>
                  {renderRegistryIcon(item.iconName, 14, 1.65)}
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Nút [Thêm] luôn visible ở cuối */}
        <button
          type="button"
          data-testid="quick-cat-more"
          onClick={() => setIsMoreSheetOpen(true)}
          className={`h-8 px-2 sm:px-2.5 rounded-[10px] text-[11.5px] sm:text-[12px] font-medium flex items-center gap-1 sm:gap-1.5 shrink-0 cursor-pointer transition-all border ${
            isMoreSheetOpen
              ? 'bg-[#0F172A] text-white border-[#0F172A]'
              : 'bg-white/96 hover:bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] shadow-[0_2px_6px_rgba(15,23,42,0.05)]'
          }`}
        >
          <MoreHorizontal
            size={14}
            strokeWidth={1.65}
            className={isMoreSheetOpen ? 'text-white' : 'text-[#475569]'}
          />
          <span className="whitespace-nowrap">Thêm</span>
        </button>
      </div>

      {/* POPUP "BẠN MUỐN TÌM GÌ?" — COMPACT ACCORDION */}
      {isMoreSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/35 flex items-center justify-center p-3 pointer-events-auto"
          onClick={() => setIsMoreSheetOpen(false)}
        >
          <div
            role="dialog"
            data-testid="map-category-bottom-sheet"
            aria-label="Bạn muốn tìm gì?"
            onClick={(e) => e.stopPropagation()}
            className="w-[calc(100vw-24px)] max-w-[420px] max-h-[78dvh] rounded-[16px] bg-white border border-[#E2E8F0] shadow-[0_12px_32px_rgba(15,23,42,0.14)] flex flex-col overflow-hidden"
          >
            {/* Header sticky */}
            <div className="shrink-0 px-3.5 py-2.5 border-b border-[#F1F5F9] flex items-center justify-between gap-2 bg-white">
              <h2 className="text-[14px] font-semibold text-[#0F172A] tracking-tight truncate">
                Bạn muốn tìm gì?
              </h2>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeFilterId && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectFilter(null);
                      setIsMoreSheetOpen(false);
                    }}
                    className="h-7 px-2.5 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] text-[11px] font-semibold cursor-pointer transition whitespace-nowrap"
                  >
                    Mặc định
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMoreSheetOpen(false)}
                  aria-label="Đóng bảng danh mục"
                  className="w-7 h-7 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] flex items-center justify-center cursor-pointer transition"
                >
                  <X size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Ô Search sticky ở trên cùng */}
            <div className="shrink-0 px-3.5 py-2 border-b border-[#F1F5F9] bg-[#F8FAFC]/70">
              <div className="relative flex items-center">
                <Search
                  size={15}
                  strokeWidth={1.65}
                  className="absolute left-2.5 text-[#64748B] pointer-events-none"
                />
                <input
                  type="text"
                  value={sheetQuery}
                  onChange={(e) => setSheetQuery(e.target.value)}
                  placeholder="Tìm danh mục..."
                  className="w-full h-[36px] pl-8 pr-7 rounded-[9px] bg-white border border-[#E2E8F0] text-[12.5px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#059669]"
                />
                {sheetQuery && (
                  <button
                    type="button"
                    onClick={() => setSheetQuery('')}
                    aria-label="Xóa từ khóa"
                    className="absolute right-2 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  >
                    <X size={14} strokeWidth={1.65} />
                  </button>
                )}
              </div>
            </div>

            {/* Nội dung cuộn bên trong: Khi có từ khóa search -> hiện thẳng kết quả; Khi không -> hiện Accordion */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-[#F1F5F9]">
              {flatSearchResults !== null ? (
                <div className="p-3">
                  {flatSearchResults.length === 0 ? (
                    <div className="py-6 text-center text-[12px] text-[#64748B]">
                      Không tìm thấy danh mục phù hợp
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {flatSearchResults.map((it) => {
                        const isSelected = activeFilterId === it.id;
                        const cnt = itemCounts.get(it.id) ?? 0;
                        return (
                          <button
                            key={it.id}
                            type="button"
                            title={it.fullLabel || it.label}
                            data-testid={`sheet-cat-${it.id}`}
                            onClick={() => {
                              onSelectFilter(isSelected ? null : it.id);
                              setIsMoreSheetOpen(false);
                            }}
                            className={`h-[39px] px-2.5 rounded-[9px] border flex items-center justify-between gap-1.5 cursor-pointer transition-colors min-w-0 ${
                              isSelected
                                ? 'bg-[#ECFDF5] border-[#059669] text-[#059669] font-semibold'
                                : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] border-[#E2E8F0] text-[#0F172A] font-medium'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="text-[#059669] shrink-0">
                                {renderRegistryIcon(it.iconName, 16, 1.65)}
                              </span>
                              <span className="text-[12.5px] whitespace-nowrap overflow-hidden text-ellipsis">
                                {it.label}
                              </span>
                            </span>
                            {cnt > 0 && (
                              <span
                                className={`text-[10.5px] shrink-0 font-medium ${
                                  isSelected ? 'text-[#059669]' : 'text-[#64748B]'
                                }`}
                              >
                                {cnt}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                COMPACT_ACCORDION_GROUPS.map((grp) => {
                  const isOpen = expandedGroupIds.includes(grp.id);
                  const grpCount = groupCounts.get(grp.id) ?? 0;
                  const hasSelectedChild = grp.items.some(
                    (it) => it.id === activeFilterId
                  );

                  return (
                    <div key={grp.id} data-testid={`accordion-group-${grp.id}`}>
                      {/* Header Accordion: cao 42px, 1 hàng gọn */}
                      <button
                        type="button"
                        data-testid={`accordion-header-${grp.id}`}
                        aria-expanded={isOpen}
                        onClick={() => handleToggleGroup(grp.id)}
                        className={`w-full h-[42px] px-3.5 flex items-center justify-between gap-2 cursor-pointer transition-colors select-none ${
                          hasSelectedChild
                            ? 'bg-[#ECFDF5]/45 text-[#059669]'
                            : 'bg-white hover:bg-[#F8FAFC] text-[#0F172A]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[#059669] shrink-0">
                            {renderRegistryIcon(grp.iconName, 16, 1.65)}
                          </span>
                          <span className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                            {grp.title}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {grpCount > 0 && (
                            <span className="text-[11px] font-medium text-[#64748B]">
                              {grpCount}
                            </span>
                          )}
                          <ChevronRight
                            size={15}
                            strokeWidth={1.75}
                            className={`text-[#64748B] transition-transform duration-150 ease-out ${
                              isOpen ? 'rotate-90 text-[#0F172A]' : ''
                            }`}
                          />
                        </span>
                      </button>

                      {/* Danh mục con: Grid 2 cột, compact tile cao 39px, không rớt dòng */}
                      {isOpen && (
                        <div className="px-3.5 pb-3 pt-1 bg-white transition-all duration-150 ease-out">
                          <div className="grid grid-cols-2 gap-1.5">
                            {grp.items.map((it) => {
                              const isSelected = activeFilterId === it.id;
                              const cnt = itemCounts.get(it.id) ?? 0;
                              return (
                                <button
                                  key={it.id}
                                  type="button"
                                  title={it.fullLabel || it.label}
                                  data-testid={`sheet-cat-${it.id}`}
                                  onClick={() => {
                                    onSelectFilter(isSelected ? null : it.id);
                                    setIsMoreSheetOpen(false);
                                  }}
                                  className={`h-[39px] px-2.5 rounded-[9px] border flex items-center justify-between gap-1.5 cursor-pointer transition-colors min-w-0 ${
                                    isSelected
                                      ? 'bg-[#ECFDF5] border-[#059669] text-[#059669] font-semibold'
                                      : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] border-[#E2E8F0] text-[#0F172A] font-medium'
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="text-[#059669] shrink-0">
                                      {renderRegistryIcon(it.iconName, 16, 1.65)}
                                    </span>
                                    <span className="text-[12.5px] whitespace-nowrap overflow-hidden text-ellipsis">
                                      {it.label}
                                    </span>
                                  </span>
                                  {cnt > 0 && (
                                    <span
                                      className={`text-[10.5px] shrink-0 font-medium ${
                                        isSelected
                                          ? 'text-[#059669]'
                                          : 'text-[#64748B]'
                                      }`}
                                    >
                                      {cnt}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
