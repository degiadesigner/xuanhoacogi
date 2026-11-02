import type { MapCategoryKey } from './map-types';

export interface MapCategoryConfig {
  id: MapCategoryKey;
  label: string;
  shortLabel: string;
  iconName: string;
  accentHex: string;
  softBgHex: string;
  markerBg: string;
  markerBorder: string;
  description: string;
}

export type MapCategoryDefinition = MapCategoryConfig;

/**
 * BẢNG DANH MỤC TƯƠNG THÍCH NGƯỢC — SỬ DỤNG HỆ MÀU MONOCHROME / BRAND EMERALD ACCENT (PHẦN 4, 26–28)
 * Không dùng mỗi category một màu cầu vồng.
 * - Core Landmarks (public, school): Nền Emerald thương hiệu (#059669), icon trắng.
 * - Business Markers: Nền trắng (#FFFFFF), viền mảnh Emerald (#059669), icon đậm (#059669 / #0F172A).
 */
export const MAP_CATEGORIES: MapCategoryConfig[] = [
  {
    id: 'all',
    label: 'Tất cả địa điểm',
    shortLabel: 'Tất cả',
    iconName: 'compass',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#059669',
    markerBorder: '#059669',
    description: 'Toàn bộ địa điểm đã xác minh trong Phường Xuân Hòa',
  },
  {
    id: 'public',
    label: 'Hành chính & Công cộng',
    shortLabel: 'Cơ quan',
    iconName: 'landmark',
    accentHex: '#059669',
    softBgHex: '#ECFDF5',
    markerBg: '#059669',
    markerBorder: '#FFFFFF',
    description: 'UBND Phường Xuân Hòa, Công an, Bưu điện, Trạm Y tế, Chợ Xuân Hòa',
  },
  {
    id: 'school',
    label: 'Giáo dục & Trường học',
    shortLabel: 'Trường học',
    iconName: 'school',
    accentHex: '#059669',
    softBgHex: '#ECFDF5',
    markerBg: '#059669',
    markerBorder: '#FFFFFF',
    description: 'ĐHSP Hà Nội 2, ĐH Kiến trúc, CĐ Cơ điện, THPT Xuân Hòa, Tiểu học & THCS',
  },
  {
    id: 'food',
    label: 'Ăn uống',
    shortLabel: 'Ăn uống',
    iconName: 'utensils',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Nhà hàng, Quán ăn, Bún, Phở, Cơm, Bánh mì, Lẩu, Nướng',
  },
  {
    id: 'pub',
    label: 'Nhậu & Bia',
    shortLabel: 'Quán nhậu',
    iconName: 'beer',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Quán nhậu, Bia hơi, Beer club, Lẩu nướng đêm',
  },
  {
    id: 'cafe',
    label: 'Cafe & Đồ uống',
    shortLabel: 'Cafe',
    iconName: 'coffee',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Quán Cafe, Trà sữa, Trà chanh, Nước ép & Sinh tố',
  },
  {
    id: 'snack',
    label: 'Ăn vặt & Đồ ăn nhanh',
    shortLabel: 'Ăn vặt',
    iconName: 'soup',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Quán ăn vặt, Nem chua rán, Bánh mì, Chè, Gà rán',
  },
  {
    id: 'billiards',
    label: 'Bi-a (Billiards)',
    shortLabel: 'Bi-a',
    iconName: 'billiards',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Câu lạc bộ Bi-a, Billiards Club tại Xuân Hòa',
  },
  {
    id: 'game',
    label: 'Quán net & Gaming',
    shortLabel: 'Gaming',
    iconName: 'gamepad',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Cyber Game, Quán Net, PS5 & Khu trò chơi điện tử',
  },
  {
    id: 'entertainment',
    label: 'Vui chơi & Giải trí',
    shortLabel: 'Vui chơi',
    iconName: 'party',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Karaoke, Sân bóng, Thể thao, Khu vui chơi tại Xuân Hòa',
  },
  {
    id: 'phone',
    label: 'Điện thoại & Điện máy',
    shortLabel: 'Điện thoại',
    iconName: 'smartphone',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Cửa hàng điện thoại, sửa chữa, phụ kiện & điện máy',
  },
  {
    id: 'grocery',
    label: 'Tạp hóa & Mua sắm',
    shortLabel: 'Tạp hóa',
    iconName: 'shopping-bag',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Cửa hàng tạp hóa, bách hóa tổng hợp & tiện ích',
  },
  {
    id: 'supermarket',
    label: 'Siêu thị & Tiện lợi',
    shortLabel: 'Siêu thị',
    iconName: 'store',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Siêu thị, WinMart+, Trung tâm mua sắm & Cửa hàng tiện lợi',
  },
  {
    id: 'service',
    label: 'Xe, Sức khỏe & Dịch vụ',
    shortLabel: 'Dịch vụ',
    iconName: 'sparkles',
    accentHex: '#059669',
    softBgHex: '#F8FAFC',
    markerBg: '#FFFFFF',
    markerBorder: '#059669',
    description: 'Cây xăng, Sửa xe, Hiệu thuốc, Ngân hàng, Khách sạn, Tóc & Spa',
  },
  {
    id: 'game_asset',
    label: 'Tài sản Game (Demo)',
    shortLabel: 'Game Demo',
    iconName: 'gamepad',
    accentHex: '#0F172A',
    softBgHex: '#F1F5F9',
    markerBg: '#0F172A',
    markerBorder: '#FFFFFF',
    description: 'Lớp mô phỏng bất động sản số',
  },
];

export const MAP_CATEGORY_BY_ID: Record<MapCategoryKey, MapCategoryConfig> = MAP_CATEGORIES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<MapCategoryKey, MapCategoryConfig>
);
