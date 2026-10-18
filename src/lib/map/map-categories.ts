import type { MapCategoryKey } from './map-types';

export interface MapCategoryDefinition {
  id: MapCategoryKey;
  label: string;
  shortLabel: string;
  description: string;
  /** Màu nền marker (xanh mint / xanh ngọc / pastel đồng bộ với viền tím đậm #403064) */
  markerBg: string;
  /** Màu nền pill / badge nhẹ */
  badgeBg: string;
  /** Màu chữ trên badge */
  badgeText: string;
  /** Tên icon Lucide tương ứng */
  iconName:
    | 'Compass'
    | 'UtensilsCrossed'
    | 'Coffee'
    | 'Sparkles'
    | 'Flame'
    | 'CircleDot'
    | 'Gamepad2'
    | 'Music'
    | 'Smartphone'
    | 'ShoppingBag'
    | 'Store'
    | 'Wrench'
    | 'GraduationCap'
    | 'Landmark'
    | 'Castle';
}

export const MAP_CATEGORIES: MapCategoryDefinition[] = [
  {
    id: 'all',
    label: 'Tất cả địa điểm',
    shortLabel: 'Tất cả',
    description: 'Toàn bộ địa điểm đã xác minh trên bản đồ Xuân Hòa',
    markerBg: '#39B980',
    badgeBg: '#E6F7EF',
    badgeText: '#1D7A52',
    iconName: 'Compass',
  },
  {
    id: 'food',
    label: 'Quán ăn',
    shortLabel: 'Quán ăn',
    description: 'Cơm sinh viên, bún, phở, bún chả, bánh mì nóng',
    markerBg: '#39B980',
    badgeBg: '#E6F7EF',
    badgeText: '#1D7A52',
    iconName: 'UtensilsCrossed',
  },
  {
    id: 'cafe',
    label: 'Cà phê và trà',
    shortLabel: 'Cà phê & Trà',
    description: 'Quán cafe chill, trà chanh, trà sữa quanh trường & hồ',
    markerBg: '#2EB89A',
    badgeBg: '#E4F7F3',
    badgeText: '#196E5B',
    iconName: 'Coffee',
  },
  {
    id: 'snack',
    label: 'Ăn vặt',
    shortLabel: 'Ăn vặt',
    description: 'Bánh tráng, nem nướng, chè, gà rán, xiên que',
    markerBg: '#46C389',
    badgeBg: '#E9F8F0',
    badgeText: '#20754E',
    iconName: 'Sparkles',
  },
  {
    id: 'pub',
    label: 'Nhà hàng và quán nhậu',
    shortLabel: 'Nhà hàng & Nhậu',
    description: 'Lẩu nướng, ốc đêm, bia hơi, đặc sản trâu/gà/hải sản',
    markerBg: '#34A88E',
    badgeBg: '#E3F5F0',
    badgeText: '#1B6655',
    iconName: 'Flame',
  },
  {
    id: 'billiards',
    label: 'Bi-a',
    shortLabel: 'Bi-a',
    description: 'Câu lạc bộ Billiards & Pool tại Xuân Hòa',
    markerBg: '#2EA89C',
    badgeBg: '#E3F6F4',
    badgeText: '#1A6860',
    iconName: 'CircleDot',
  },
  {
    id: 'game',
    label: 'Game/Cyber',
    shortLabel: 'Game/Cyber',
    description: 'Phòng máy Cyber Game, eSports, PlayStation',
    markerBg: '#38B2AC',
    badgeBg: '#E6FFFA',
    badgeText: '#234E52',
    iconName: 'Gamepad2',
  },
  {
    id: 'entertainment',
    label: 'Karaoke và giải trí',
    shortLabel: 'Giải trí & Resort',
    description: 'Khu nghỉ dưỡng Đại Lải, sân golf, khu vui chơi, karaoke',
    markerBg: '#39B980',
    badgeBg: '#E6F7EF',
    badgeText: '#1D7A52',
    iconName: 'Music',
  },
  {
    id: 'phone',
    label: 'Điện thoại và công nghệ',
    shortLabel: 'Điện thoại & CN',
    description: 'Cửa hàng điện thoại, phụ kiện, sửa chữa máy tính',
    markerBg: '#319795',
    badgeBg: '#E6FFFA',
    badgeText: '#234E52',
    iconName: 'Smartphone',
  },
  {
    id: 'grocery',
    label: 'Tạp hóa và cửa hàng tiện lợi',
    shortLabel: 'Tạp hóa',
    description: 'Tạp hóa dân sinh, cửa hàng tiện lợi',
    markerBg: '#48BB78',
    badgeBg: '#F0FFF4',
    badgeText: '#22543D',
    iconName: 'ShoppingBag',
  },
  {
    id: 'supermarket',
    label: 'Siêu thị và mua sắm',
    shortLabel: 'Siêu thị & Mua sắm',
    description: 'Siêu thị, chợ truyền thống, thời trang & mua sắm',
    markerBg: '#38A169',
    badgeBg: '#F0FFF4',
    badgeText: '#22543D',
    iconName: 'Store',
  },
  {
    id: 'service',
    label: 'Dịch vụ',
    shortLabel: 'Dịch vụ',
    description: 'Ngân hàng, lưu trú, nhà nghỉ, trạm xăng, dịch vụ dân sinh',
    markerBg: '#2C9A82',
    badgeBg: '#E6F6F2',
    badgeText: '#1B5E4F',
    iconName: 'Wrench',
  },
  {
    id: 'school',
    label: 'Trường học',
    shortLabel: 'Trường học',
    description: 'ĐH Sư phạm Hà Nội 2, ĐH Kiến trúc, CĐ Cơ điện, CĐ Việt-Xô, THPT, THCS, Tiểu học',
    markerBg: '#39B980',
    badgeBg: '#E6F7EF',
    badgeText: '#1D7A52',
    iconName: 'GraduationCap',
  },
  {
    id: 'public',
    label: 'Địa điểm công cộng',
    shortLabel: 'Công cộng',
    description: 'Y tế, nhà thể chất, cơ quan hành chính, di tích, hồ nước',
    markerBg: '#2F9E8F',
    badgeBg: '#E5F6F3',
    badgeText: '#1A5E55',
    iconName: 'Landmark',
  },
  {
    id: 'game_asset',
    label: 'Tài sản game (Demo)',
    shortLabel: 'Tài sản Game',
    description: 'Lớp lô đất & cửa hàng ảo XUHO CITY (Dữ liệu Demo tách biệt)',
    markerBg: '#7C5DFA',
    badgeBg: '#F1EEFF',
    badgeText: '#403064',
    iconName: 'Castle',
  },
];

export const MAP_CATEGORY_BY_ID: Record<MapCategoryKey, MapCategoryDefinition> =
  MAP_CATEGORIES.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<MapCategoryKey, MapCategoryDefinition>);
