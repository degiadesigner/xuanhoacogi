import React from 'react';
import {
  Utensils,
  UtensilsCrossed,
  Soup,
  Sandwich,
  Flame,
  Fish,
  Pizza,
  Coffee,
  CupSoda,
  GlassWater,
  Beer,
  CircleDot,
  Gamepad2,
  Mic2,
  FerrisWheel,
  Trophy,
  Fuel,
  Zap,
  Wrench,
  ParkingCircle,
  Bus,
  Hospital,
  Stethoscope,
  Pill,
  HeartPulse,
  GraduationCap,
  School,
  Baby,
  BookOpen,
  Landmark,
  Shield,
  Mail,
  Building2,
  Store,
  ShoppingBag,
  ShoppingBasket,
  Shirt,
  Monitor,
  Smartphone,
  CreditCard,
  BedDouble,
  Sparkles,
  Scissors,
  Briefcase,
  Compass,
  Milestone,
  Waves,
  Trees,
  Mountain,
  HelpCircle,
  MapPin,
} from 'lucide-react';
import type { MapCategoryKey } from './map-types';

/**
 * BẢNG MÀU THỐNG NHẤT (PHẦN 4, 26–28, 31–32)
 * Monochrome + Brand Emerald Accent — Không dùng mỗi danh mục một màu cầu vồng.
 */
export const MAP_UI_PALETTE = {
  primaryAccent: '#059669',
  primaryAccentLight: '#10B981',
  primaryAccentSoft: '#ECFDF5',
  primaryAccentBorder: '#059669',
  secondaryDark: '#0F172A',
  secondarySlate: '#1E293B',
  neutralSurface: '#FFFFFF',
  neutralWarmBg: '#F8FAFC',
  neutralMutedBg: '#F1F5F9',
  neutralBorder: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
} as const;

/**
 * DANH SÁCH 11 NHÓM CHA (PARENT CATEGORIES) + CHƯA PHÂN LOẠI (PHẦN 11 & 53)
 */
export type MapParentCategoryId =
  | 'food'
  | 'drink'
  | 'night_food'
  | 'entertainment'
  | 'transport'
  | 'health'
  | 'education'
  | 'public'
  | 'shopping'
  | 'service'
  | 'landmark'
  | 'uncategorized';

/**
 * DANH SÁCH TOÀN BỘ SUBCATEGORY CHI TIẾT (PHẦN 12–22 & 53)
 */
export type MapSubcategoryId =
  // 12. Ăn uống (food)
  | 'restaurant'
  | 'local_food'
  | 'street_food'
  | 'noodle'
  | 'rice'
  | 'banh_mi'
  | 'hotpot'
  | 'grill'
  | 'seafood'
  | 'fast_food'
  // 13. Đồ uống (drink)
  | 'cafe'
  | 'milk_tea'
  | 'tea'
  | 'juice'
  | 'beverage'
  // 14. Nhậu (night_food)
  | 'pub'
  | 'beer'
  | 'beer_garden'
  | 'grill_pub'
  | 'hotpot_pub'
  // 15. Vui chơi (entertainment)
  | 'billiards'
  | 'gaming'
  | 'karaoke'
  | 'kids_playground'
  | 'sports'
  | 'entertainment_center'
  // 16. Xe & Di chuyển (transport)
  | 'fuel_station'
  | 'ev_charging'
  | 'motorbike_repair'
  | 'car_repair'
  | 'parking'
  | 'bus_station'
  // 17. Sức khỏe (health)
  | 'hospital'
  | 'clinic'
  | 'pharmacy'
  | 'health_station'
  | 'dental'
  // 18. Giáo dục (education)
  | 'university'
  | 'college'
  | 'high_school'
  | 'secondary_school'
  | 'primary_school'
  | 'kindergarten'
  | 'education_center'
  // 19. Hành chính / Công cộng (public)
  | 'government'
  | 'police'
  | 'post_office'
  | 'public_service'
  | 'cultural_center'
  // 20. Mua sắm (shopping)
  | 'supermarket'
  | 'grocery'
  | 'market'
  | 'fashion'
  | 'electronics'
  | 'phone_shop'
  | 'convenience_store'
  // 21. Dịch vụ (service)
  | 'bank'
  | 'atm'
  | 'hotel'
  | 'beauty'
  | 'barber'
  | 'laundry'
  | 'repair_service'
  | 'other_service'
  // 22. Địa danh (landmark)
  | 'landmark'
  | 'square'
  | 'bridge'
  | 'lake'
  | 'park'
  | 'religious'
  | 'tourist_attraction'
  // Fallback (Phần 53)
  | 'uncategorized';

export type LucideRegistryIconName =
  | 'Utensils'
  | 'UtensilsCrossed'
  | 'Soup'
  | 'Sandwich'
  | 'Flame'
  | 'Fish'
  | 'Pizza'
  | 'Coffee'
  | 'CupSoda'
  | 'GlassWater'
  | 'Beer'
  | 'CircleDot'
  | 'Gamepad2'
  | 'Mic2'
  | 'FerrisWheel'
  | 'Trophy'
  | 'Fuel'
  | 'Zap'
  | 'Wrench'
  | 'ParkingCircle'
  | 'Bus'
  | 'Hospital'
  | 'Stethoscope'
  | 'Pill'
  | 'HeartPulse'
  | 'GraduationCap'
  | 'School'
  | 'Baby'
  | 'BookOpen'
  | 'Landmark'
  | 'Shield'
  | 'Mail'
  | 'Building2'
  | 'Store'
  | 'ShoppingBag'
  | 'ShoppingBasket'
  | 'Shirt'
  | 'Monitor'
  | 'Smartphone'
  | 'CreditCard'
  | 'BedDouble'
  | 'Sparkles'
  | 'Scissors'
  | 'Briefcase'
  | 'Compass'
  | 'Milestone'
  | 'Waves'
  | 'Trees'
  | 'Mountain'
  | 'HelpCircle'
  | 'MapPin';

export interface MapParentCategoryMeta {
  id: MapParentCategoryId;
  label: string;
  shortLabel: string;
  iconName: LucideRegistryIconName;
  defaultSubcategoryId: MapSubcategoryId;
  legacyCategory: Exclude<MapCategoryKey, 'all' | 'game_asset'>;
  isDefaultCoreGroup: boolean;
}

export interface MapSubcategoryMeta {
  id: MapSubcategoryId;
  parentId: MapParentCategoryId;
  label: string;
  shortLabel: string;
  iconName: LucideRegistryIconName;
  legacyCategory: Exclude<MapCategoryKey, 'all' | 'game_asset'>;
  /** Các từ khóa để tìm kiếm nhanh trong Admin & Search */
  searchKeywords: string[];
  /** Có phải địa danh lõi hiển thị mặc định khi mở bản đồ không (Phần 5, 29–30) */
  showByDefault: boolean;
}

/**
 * DANH MỤC CHA (PARENT CATEGORIES) — PHẦN 11
 */
export const MAP_PARENT_CATEGORIES: MapParentCategoryMeta[] = [
  {
    id: 'food',
    label: 'Ăn uống',
    shortLabel: 'Ăn uống',
    iconName: 'Utensils',
    defaultSubcategoryId: 'local_food',
    legacyCategory: 'food',
    isDefaultCoreGroup: false,
  },
  {
    id: 'drink',
    label: 'Đồ uống',
    shortLabel: 'Đồ uống',
    iconName: 'Coffee',
    defaultSubcategoryId: 'cafe',
    legacyCategory: 'cafe',
    isDefaultCoreGroup: false,
  },
  {
    id: 'night_food',
    label: 'Nhậu & Lẩu đêm',
    shortLabel: 'Nhậu',
    iconName: 'Beer',
    defaultSubcategoryId: 'pub',
    legacyCategory: 'pub',
    isDefaultCoreGroup: false,
  },
  {
    id: 'entertainment',
    label: 'Vui chơi & Giải trí',
    shortLabel: 'Vui chơi',
    iconName: 'Gamepad2',
    defaultSubcategoryId: 'billiards',
    legacyCategory: 'entertainment',
    isDefaultCoreGroup: false,
  },
  {
    id: 'transport',
    label: 'Xe & Di chuyển',
    shortLabel: 'Xe & Xăng',
    iconName: 'Fuel',
    defaultSubcategoryId: 'fuel_station',
    legacyCategory: 'service',
    isDefaultCoreGroup: false,
  },
  {
    id: 'shopping',
    label: 'Mua sắm',
    shortLabel: 'Mua sắm',
    iconName: 'ShoppingBag',
    defaultSubcategoryId: 'supermarket',
    legacyCategory: 'supermarket',
    isDefaultCoreGroup: false,
  },
  {
    id: 'service',
    label: 'Dịch vụ',
    shortLabel: 'Dịch vụ',
    iconName: 'Sparkles',
    defaultSubcategoryId: 'other_service',
    legacyCategory: 'service',
    isDefaultCoreGroup: false,
  },
  {
    id: 'health',
    label: 'Sức khỏe & Y tế',
    shortLabel: 'Sức khỏe',
    iconName: 'Hospital',
    defaultSubcategoryId: 'pharmacy',
    legacyCategory: 'public',
    isDefaultCoreGroup: true,
  },
  {
    id: 'education',
    label: 'Giáo dục & Trường học',
    shortLabel: 'Giáo dục',
    iconName: 'GraduationCap',
    defaultSubcategoryId: 'university',
    legacyCategory: 'school',
    isDefaultCoreGroup: true,
  },
  {
    id: 'public',
    label: 'Hành chính & Công cộng',
    shortLabel: 'Hành chính',
    iconName: 'Landmark',
    defaultSubcategoryId: 'government',
    legacyCategory: 'public',
    isDefaultCoreGroup: true,
  },
  {
    id: 'landmark',
    label: 'Địa danh',
    shortLabel: 'Địa danh',
    iconName: 'Compass',
    defaultSubcategoryId: 'landmark',
    legacyCategory: 'public',
    isDefaultCoreGroup: true,
  },
  {
    id: 'uncategorized',
    label: 'Chưa phân loại',
    shortLabel: 'Chưa phân loại',
    iconName: 'HelpCircle',
    defaultSubcategoryId: 'uncategorized',
    legacyCategory: 'service',
    isDefaultCoreGroup: false,
  },
];

export const MAP_PARENT_CATEGORY_BY_ID: Record<MapParentCategoryId, MapParentCategoryMeta> =
  MAP_PARENT_CATEGORIES.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<MapParentCategoryId, MapParentCategoryMeta>
  );

/**
 * REGISTRY THỐNG NHẤT TOÀN BỘ SUBCATEGORY (PHẦN 10, 12–22, 24–25)
 * Dùng chung cho Bản đồ 2D, Bản đồ 3D, Admin Quản lý Maps, Tìm kiếm và Quán Xá.
 */
export const MAP_CATEGORY_REGISTRY: Record<MapSubcategoryId, MapSubcategoryMeta> = {
  // ================= 12. ĂN UỐNG (food) =================
  restaurant: {
    id: 'restaurant',
    parentId: 'food',
    label: 'Nhà hàng',
    shortLabel: 'Nhà hàng',
    iconName: 'Utensils',
    legacyCategory: 'food',
    searchKeywords: ['nhà hàng', 'ẩm thực', 'restaurant'],
    showByDefault: false,
  },
  local_food: {
    id: 'local_food',
    parentId: 'food',
    label: 'Quán ăn',
    shortLabel: 'Quán ăn',
    iconName: 'Utensils',
    legacyCategory: 'food',
    searchKeywords: ['quán ăn', 'ăn chính', 'đồ ăn'],
    showByDefault: false,
  },
  street_food: {
    id: 'street_food',
    parentId: 'food',
    label: 'Ăn vặt',
    shortLabel: 'Ăn vặt',
    iconName: 'Sandwich',
    legacyCategory: 'snack',
    searchKeywords: ['ăn vặt', 'xiên bẩn', 'nem chua', 'bánh tráng', 'chè'],
    showByDefault: false,
  },
  noodle: {
    id: 'noodle',
    parentId: 'food',
    label: 'Bún / Phở / Mì',
    shortLabel: 'Bún & Phở',
    iconName: 'Soup',
    legacyCategory: 'food',
    searchKeywords: ['bún', 'phở', 'mì', 'miến', 'bánh đa', 'hủ tiếu'],
    showByDefault: false,
  },
  rice: {
    id: 'rice',
    parentId: 'food',
    label: 'Cơm / Suất ăn',
    shortLabel: 'Quán cơm',
    iconName: 'UtensilsCrossed',
    legacyCategory: 'food',
    searchKeywords: ['cơm', 'cơm bình dân', 'cơm rang', 'cơm tấm', 'suất ăn'],
    showByDefault: false,
  },
  banh_mi: {
    id: 'banh_mi',
    parentId: 'food',
    label: 'Bánh mì',
    shortLabel: 'Bánh mì',
    iconName: 'Sandwich',
    legacyCategory: 'food',
    searchKeywords: ['bánh mì', 'bánh mỳ', 'bánh mì chảo', 'bánh mì sốt vang'],
    showByDefault: false,
  },
  hotpot: {
    id: 'hotpot',
    parentId: 'food',
    label: 'Lẩu',
    shortLabel: 'Quán lẩu',
    iconName: 'Flame',
    legacyCategory: 'food',
    searchKeywords: ['lẩu', 'hotpot'],
    showByDefault: false,
  },
  grill: {
    id: 'grill',
    parentId: 'food',
    label: 'Nướng',
    shortLabel: 'Đồ nướng',
    iconName: 'Flame',
    legacyCategory: 'food',
    searchKeywords: ['nướng', 'bbq', 'thịt nướng'],
    showByDefault: false,
  },
  seafood: {
    id: 'seafood',
    parentId: 'food',
    label: 'Hải sản',
    shortLabel: 'Hải sản',
    iconName: 'Fish',
    legacyCategory: 'food',
    searchKeywords: ['hải sản', 'ốc', 'cá'],
    showByDefault: false,
  },
  fast_food: {
    id: 'fast_food',
    parentId: 'food',
    label: 'Đồ ăn nhanh',
    shortLabel: 'Đồ ăn nhanh',
    iconName: 'Pizza',
    legacyCategory: 'snack',
    searchKeywords: ['đồ ăn nhanh', 'gà rán', 'pizza', 'burger', 'fastfood'],
    showByDefault: false,
  },

  // ================= 13. ĐỒ UỐNG (drink) =================
  cafe: {
    id: 'cafe',
    parentId: 'drink',
    label: 'Cafe',
    shortLabel: 'Cafe',
    iconName: 'Coffee',
    legacyCategory: 'cafe',
    searchKeywords: ['cafe', 'cà phê', 'coffee'],
    showByDefault: false,
  },
  milk_tea: {
    id: 'milk_tea',
    parentId: 'drink',
    label: 'Trà sữa',
    shortLabel: 'Trà sữa',
    iconName: 'CupSoda',
    legacyCategory: 'cafe',
    searchKeywords: ['trà sữa', 'milk tea', 'mixue', 'boba'],
    showByDefault: false,
  },
  tea: {
    id: 'tea',
    parentId: 'drink',
    label: 'Trà chanh / Trà đá',
    shortLabel: 'Trà chanh',
    iconName: 'Coffee',
    legacyCategory: 'cafe',
    searchKeywords: ['trà chanh', 'trà đá', 'tiệm trà'],
    showByDefault: false,
  },
  juice: {
    id: 'juice',
    parentId: 'drink',
    label: 'Nước ép / Sinh tố',
    shortLabel: 'Nước ép',
    iconName: 'GlassWater',
    legacyCategory: 'cafe',
    searchKeywords: ['nước ép', 'sinh tố', 'nước mía', 'hoa quả dầm'],
    showByDefault: false,
  },
  beverage: {
    id: 'beverage',
    parentId: 'drink',
    label: 'Đồ uống khác',
    shortLabel: 'Đồ uống',
    iconName: 'CupSoda',
    legacyCategory: 'cafe',
    searchKeywords: ['đồ uống', 'giải khát', 'nước ngọt'],
    showByDefault: false,
  },

  // ================= 14. NHẬU (night_food) =================
  pub: {
    id: 'pub',
    parentId: 'night_food',
    label: 'Quán nhậu',
    shortLabel: 'Quán nhậu',
    iconName: 'Beer',
    legacyCategory: 'pub',
    searchKeywords: ['quán nhậu', 'nhậu', 'mồi nhậu'],
    showByDefault: false,
  },
  beer: {
    id: 'beer',
    parentId: 'night_food',
    label: 'Bia hơi / Beer club',
    shortLabel: 'Bia hơi',
    iconName: 'Beer',
    legacyCategory: 'pub',
    searchKeywords: ['bia', 'bia hơi', 'bia tươi', 'beer club'],
    showByDefault: false,
  },
  beer_garden: {
    id: 'beer_garden',
    parentId: 'night_food',
    label: 'Beer garden',
    shortLabel: 'Beer garden',
    iconName: 'Beer',
    legacyCategory: 'pub',
    searchKeywords: ['beer garden', 'vườn bia'],
    showByDefault: false,
  },
  grill_pub: {
    id: 'grill_pub',
    parentId: 'night_food',
    label: 'Lẩu nướng nhậu',
    shortLabel: 'Lẩu nướng',
    iconName: 'Flame',
    legacyCategory: 'pub',
    searchKeywords: ['lẩu nướng', 'nướng nhậu', 'nhậu đêm'],
    showByDefault: false,
  },
  hotpot_pub: {
    id: 'hotpot_pub',
    parentId: 'night_food',
    label: 'Lẩu đêm',
    shortLabel: 'Lẩu đêm',
    iconName: 'Soup',
    legacyCategory: 'pub',
    searchKeywords: ['lẩu đêm', 'ăn đêm', 'nhậu khuya'],
    showByDefault: false,
  },

  // ================= 15. VUI CHƠI (entertainment) =================
  billiards: {
    id: 'billiards',
    parentId: 'entertainment',
    label: 'Bi-a',
    shortLabel: 'Bi-a',
    iconName: 'CircleDot',
    legacyCategory: 'billiards',
    searchKeywords: ['bi-a', 'bia club', 'billiards', 'billiard', 'clb bi-a'],
    showByDefault: false,
  },
  gaming: {
    id: 'gaming',
    parentId: 'entertainment',
    label: 'Quán net / Gaming',
    shortLabel: 'Gaming / Net',
    iconName: 'Gamepad2',
    legacyCategory: 'game',
    searchKeywords: ['game', 'gaming', 'quán net', 'cyber', 'ps5', 'playstation'],
    showByDefault: false,
  },
  karaoke: {
    id: 'karaoke',
    parentId: 'entertainment',
    label: 'Karaoke',
    shortLabel: 'Karaoke',
    iconName: 'Mic2',
    legacyCategory: 'entertainment',
    searchKeywords: ['karaoke', 'hát', 'phòng hát', 'k-box'],
    showByDefault: false,
  },
  kids_playground: {
    id: 'kids_playground',
    parentId: 'entertainment',
    label: 'Khu vui chơi trẻ em',
    shortLabel: 'Khu vui chơi',
    iconName: 'FerrisWheel',
    legacyCategory: 'entertainment',
    searchKeywords: ['khu vui chơi', 'trẻ em', 'kids'],
    showByDefault: false,
  },
  sports: {
    id: 'sports',
    parentId: 'entertainment',
    label: 'Thể thao / Sân bóng',
    shortLabel: 'Thể thao',
    iconName: 'Trophy',
    legacyCategory: 'entertainment',
    searchKeywords: ['thể thao', 'sân bóng', 'cầu lông', 'pickleball', 'gym', 'bể bơi'],
    showByDefault: false,
  },
  entertainment_center: {
    id: 'entertainment_center',
    parentId: 'entertainment',
    label: 'Giải trí khác',
    shortLabel: 'Giải trí',
    iconName: 'Gamepad2',
    legacyCategory: 'entertainment',
    searchKeywords: ['vui chơi', 'giải trí'],
    showByDefault: false,
  },

  // ================= 16. XE & DI CHUYỂN (transport) =================
  fuel_station: {
    id: 'fuel_station',
    parentId: 'transport',
    label: 'Cây xăng',
    shortLabel: 'Cây xăng',
    iconName: 'Fuel',
    legacyCategory: 'service',
    searchKeywords: ['cây xăng', 'xăng', 'trạm xăng', 'petrolimex', 'đổ xăng', 'nhiên liệu'],
    showByDefault: false,
  },
  ev_charging: {
    id: 'ev_charging',
    parentId: 'transport',
    label: 'Trạm sạc điện',
    shortLabel: 'Trạm sạc',
    iconName: 'Zap',
    legacyCategory: 'service',
    searchKeywords: ['trạm sạc', 'sạc điện', 'vinfast', 'xe điện'],
    showByDefault: false,
  },
  motorbike_repair: {
    id: 'motorbike_repair',
    parentId: 'transport',
    label: 'Sửa xe máy',
    shortLabel: 'Sửa xe',
    iconName: 'Wrench',
    legacyCategory: 'service',
    searchKeywords: ['sửa xe', 'sửa xe máy', 'vá xe', 'bảo dưỡng xe', 'honda', 'yamaha'],
    showByDefault: false,
  },
  car_repair: {
    id: 'car_repair',
    parentId: 'transport',
    label: 'Gara ô tô',
    shortLabel: 'Gara ô tô',
    iconName: 'Wrench',
    legacyCategory: 'service',
    searchKeywords: ['gara', 'ô tô', 'rửa xe', 'sửa ô tô'],
    showByDefault: false,
  },
  parking: {
    id: 'parking',
    parentId: 'transport',
    label: 'Bãi gửi xe',
    shortLabel: 'Bãi đỗ xe',
    iconName: 'ParkingCircle',
    legacyCategory: 'service',
    searchKeywords: ['bãi xe', 'gửi xe', 'đỗ xe', 'parking'],
    showByDefault: false,
  },
  bus_station: {
    id: 'bus_station',
    parentId: 'transport',
    label: 'Bến xe / Điểm xe buýt',
    shortLabel: 'Điểm buýt',
    iconName: 'Bus',
    legacyCategory: 'public',
    searchKeywords: ['bến xe', 'xe buýt', 'bus', 'trạm dừng'],
    showByDefault: false,
  },

  // ================= 17. SỨC KHỎE (health) =================
  hospital: {
    id: 'hospital',
    parentId: 'health',
    label: 'Bệnh viện',
    shortLabel: 'Bệnh viện',
    iconName: 'Hospital',
    legacyCategory: 'public',
    searchKeywords: ['bệnh viện', 'đa khoa', 'cấp cứu'],
    showByDefault: true,
  },
  clinic: {
    id: 'clinic',
    parentId: 'health',
    label: 'Phòng khám',
    shortLabel: 'Phòng khám',
    iconName: 'Stethoscope',
    legacyCategory: 'service',
    searchKeywords: ['phòng khám', 'bác sĩ', 'siêu âm', 'xét nghiệm'],
    showByDefault: false,
  },
  pharmacy: {
    id: 'pharmacy',
    parentId: 'health',
    label: 'Hiệu thuốc',
    shortLabel: 'Hiệu thuốc',
    iconName: 'Pill',
    legacyCategory: 'service',
    searchKeywords: ['hiệu thuốc', 'nhà thuốc', 'quầy thuốc', 'dược', 'long châu'],
    showByDefault: false,
  },
  health_station: {
    id: 'health_station',
    parentId: 'health',
    label: 'Trạm y tế',
    shortLabel: 'Trạm y tế',
    iconName: 'HeartPulse',
    legacyCategory: 'public',
    searchKeywords: ['trạm y tế', 'y tế phường'],
    showByDefault: true,
  },
  dental: {
    id: 'dental',
    parentId: 'health',
    label: 'Nha khoa',
    shortLabel: 'Nha khoa',
    iconName: 'Stethoscope',
    legacyCategory: 'service',
    searchKeywords: ['nha khoa', 'răng hàm mặt', 'nhổ răng'],
    showByDefault: false,
  },

  // ================= 18. GIÁO DỤC (education) =================
  university: {
    id: 'university',
    parentId: 'education',
    label: 'Đại học',
    shortLabel: 'Đại học',
    iconName: 'GraduationCap',
    legacyCategory: 'school',
    searchKeywords: ['đại học', 'đhsp2', 'kiến trúc', 'giảng đường'],
    showByDefault: true,
  },
  college: {
    id: 'college',
    parentId: 'education',
    label: 'Cao đẳng',
    shortLabel: 'Cao đẳng',
    iconName: 'GraduationCap',
    legacyCategory: 'school',
    searchKeywords: ['cao đẳng', 'trung cấp', 'cơ điện', 'trường nghề'],
    showByDefault: true,
  },
  high_school: {
    id: 'high_school',
    parentId: 'education',
    label: 'Trường THPT',
    shortLabel: 'THPT',
    iconName: 'School',
    legacyCategory: 'school',
    searchKeywords: ['thpt', 'cấp 3', 'trung học phổ thông'],
    showByDefault: true,
  },
  secondary_school: {
    id: 'secondary_school',
    parentId: 'education',
    label: 'Trường THCS',
    shortLabel: 'THCS',
    iconName: 'School',
    legacyCategory: 'school',
    searchKeywords: ['thcs', 'cấp 2', 'trung học cơ sở'],
    showByDefault: true,
  },
  primary_school: {
    id: 'primary_school',
    parentId: 'education',
    label: 'Trường Tiểu học',
    shortLabel: 'Tiểu học',
    iconName: 'School',
    legacyCategory: 'school',
    searchKeywords: ['tiểu học', 'cấp 1'],
    showByDefault: true,
  },
  kindergarten: {
    id: 'kindergarten',
    parentId: 'education',
    label: 'Trường Mầm non',
    shortLabel: 'Mầm non',
    iconName: 'Baby',
    legacyCategory: 'school',
    searchKeywords: ['mầm non', 'mẫu giáo', 'nhà trẻ'],
    showByDefault: false,
  },
  education_center: {
    id: 'education_center',
    parentId: 'education',
    label: 'Trung tâm đào tạo',
    shortLabel: 'Trung tâm',
    iconName: 'BookOpen',
    legacyCategory: 'school',
    searchKeywords: ['trung tâm', 'ngoại ngữ', 'tiếng anh', 'đào tạo', 'sát hạch'],
    showByDefault: false,
  },

  // ================= 19. HÀNH CHÍNH / CÔNG CỘNG (public) =================
  government: {
    id: 'government',
    parentId: 'public',
    label: 'UBND / Cơ quan nhà nước',
    shortLabel: 'Cơ quan',
    iconName: 'Landmark',
    legacyCategory: 'public',
    searchKeywords: ['ubnd', 'đảng ủy', 'hđnd', 'hành chính', 'trụ sở'],
    showByDefault: true,
  },
  police: {
    id: 'police',
    parentId: 'public',
    label: 'Công an',
    shortLabel: 'Công an',
    iconName: 'Shield',
    legacyCategory: 'public',
    searchKeywords: ['công an', 'an ninh', 'cảnh sát'],
    showByDefault: true,
  },
  post_office: {
    id: 'post_office',
    parentId: 'public',
    label: 'Bưu điện',
    shortLabel: 'Bưu điện',
    iconName: 'Mail',
    legacyCategory: 'public',
    searchKeywords: ['bưu điện', 'bưu cục', 'viettel post', 'chuyển phát'],
    showByDefault: true,
  },
  public_service: {
    id: 'public_service',
    parentId: 'public',
    label: 'Dịch vụ công',
    shortLabel: 'Dịch vụ công',
    iconName: 'Building2',
    legacyCategory: 'public',
    searchKeywords: ['dịch vụ công', 'một cửa', 'điện lực', 'cấp nước'],
    showByDefault: true,
  },
  cultural_center: {
    id: 'cultural_center',
    parentId: 'public',
    label: 'Nhà văn hóa',
    shortLabel: 'Nhà văn hóa',
    iconName: 'Landmark',
    legacyCategory: 'public',
    searchKeywords: ['nhà văn hóa', 'hội trường', 'thư viện', 'trung tâm văn hóa'],
    showByDefault: true,
  },

  // ================= 20. MUA SẮM (shopping) =================
  supermarket: {
    id: 'supermarket',
    parentId: 'shopping',
    label: 'Siêu thị',
    shortLabel: 'Siêu thị',
    iconName: 'Store',
    legacyCategory: 'supermarket',
    searchKeywords: ['siêu thị', 'winmart', 'lan chi', 'aloha'],
    showByDefault: false,
  },
  grocery: {
    id: 'grocery',
    parentId: 'shopping',
    label: 'Tạp hóa',
    shortLabel: 'Tạp hóa',
    iconName: 'ShoppingBag',
    legacyCategory: 'grocery',
    searchKeywords: ['tạp hóa', 'bách hóa', 'tự chọn'],
    showByDefault: false,
  },
  market: {
    id: 'market',
    parentId: 'shopping',
    label: 'Chợ',
    shortLabel: 'Chợ',
    iconName: 'ShoppingBasket',
    legacyCategory: 'public',
    searchKeywords: ['chợ', 'chợ xuân hòa', 'chợ sinh viên'],
    showByDefault: true,
  },
  fashion: {
    id: 'fashion',
    parentId: 'shopping',
    label: 'Thời trang',
    shortLabel: 'Thời trang',
    iconName: 'Shirt',
    legacyCategory: 'service',
    searchKeywords: ['thời trang', 'quần áo', 'giày dép', 'shop quần áo'],
    showByDefault: false,
  },
  electronics: {
    id: 'electronics',
    parentId: 'shopping',
    label: 'Điện máy',
    shortLabel: 'Điện máy',
    iconName: 'Monitor',
    legacyCategory: 'phone',
    searchKeywords: ['điện máy', 'tivi', 'tủ lạnh', 'máy tính', 'laptop'],
    showByDefault: false,
  },
  phone_shop: {
    id: 'phone_shop',
    parentId: 'shopping',
    label: 'Điện thoại / Phụ kiện',
    shortLabel: 'Điện thoại',
    iconName: 'Smartphone',
    legacyCategory: 'phone',
    searchKeywords: ['điện thoại', 'di động', 'iphone', 'samsung', 'phụ kiện', 'ép kính', 'sim'],
    showByDefault: false,
  },
  convenience_store: {
    id: 'convenience_store',
    parentId: 'shopping',
    label: 'Cửa hàng tiện lợi',
    shortLabel: 'Tiện lợi',
    iconName: 'ShoppingBag',
    legacyCategory: 'supermarket',
    searchKeywords: ['cửa hàng tiện lợi', 'circle k', 'winmart+'],
    showByDefault: false,
  },

  // ================= 21. DỊCH VỤ (service) =================
  bank: {
    id: 'bank',
    parentId: 'service',
    label: 'Ngân hàng',
    shortLabel: 'Ngân hàng',
    iconName: 'Building2',
    legacyCategory: 'service',
    searchKeywords: ['ngân hàng', 'bank', 'agribank', 'vietinbank', 'bidv', 'vietcombank', 'mbbank'],
    showByDefault: false,
  },
  atm: {
    id: 'atm',
    parentId: 'service',
    label: 'Cây ATM',
    shortLabel: 'ATM',
    iconName: 'CreditCard',
    legacyCategory: 'service',
    searchKeywords: ['atm', 'rút tiền'],
    showByDefault: false,
  },
  hotel: {
    id: 'hotel',
    parentId: 'service',
    label: 'Khách sạn / Nhà nghỉ',
    shortLabel: 'Lưu trú',
    iconName: 'BedDouble',
    legacyCategory: 'service',
    searchKeywords: ['khách sạn', 'nhà nghỉ', 'homestay', 'resort', 'lưu trú'],
    showByDefault: false,
  },
  beauty: {
    id: 'beauty',
    parentId: 'service',
    label: 'Spa / Làm đẹp',
    shortLabel: 'Làm đẹp',
    iconName: 'Sparkles',
    legacyCategory: 'service',
    searchKeywords: ['spa', 'làm đẹp', 'nail', 'nối mi', 'thẩm mỹ', 'gội đầu'],
    showByDefault: false,
  },
  barber: {
    id: 'barber',
    parentId: 'service',
    label: 'Cắt tóc / Salon',
    shortLabel: 'Tóc / Salon',
    iconName: 'Scissors',
    legacyCategory: 'service',
    searchKeywords: ['cắt tóc', 'salon tóc', 'barber', 'hair', 'uốn tóc'],
    showByDefault: false,
  },
  laundry: {
    id: 'laundry',
    parentId: 'service',
    label: 'Giặt là',
    shortLabel: 'Giặt là',
    iconName: 'Shirt',
    legacyCategory: 'service',
    searchKeywords: ['giặt là', 'giặt khô', 'laundry'],
    showByDefault: false,
  },
  repair_service: {
    id: 'repair_service',
    parentId: 'service',
    label: 'Sửa chữa dân dụng',
    shortLabel: 'Sửa chữa',
    iconName: 'Wrench',
    legacyCategory: 'service',
    searchKeywords: ['sửa chữa', 'điện lạnh', 'điện nước', 'khóa'],
    showByDefault: false,
  },
  other_service: {
    id: 'other_service',
    parentId: 'service',
    label: 'Dịch vụ khác',
    shortLabel: 'Dịch vụ',
    iconName: 'Briefcase',
    legacyCategory: 'service',
    searchKeywords: ['dịch vụ', 'tiện ích', 'in ấn', 'photocopy', 'chụp ảnh'],
    showByDefault: false,
  },

  // ================= 22. ĐỊA DANH (landmark) =================
  landmark: {
    id: 'landmark',
    parentId: 'landmark',
    label: 'Địa danh nổi bật',
    shortLabel: 'Địa danh',
    iconName: 'Landmark',
    legacyCategory: 'public',
    searchKeywords: ['địa danh', 'biểu tượng', 'cổng trường', 'nhà trắng'],
    showByDefault: true,
  },
  square: {
    id: 'square',
    parentId: 'landmark',
    label: 'Quảng trường',
    shortLabel: 'Quảng trường',
    iconName: 'Compass',
    legacyCategory: 'public',
    searchKeywords: ['quảng trường', 'chim xanh', 'sân vận động'],
    showByDefault: true,
  },
  bridge: {
    id: 'bridge',
    parentId: 'landmark',
    label: 'Cầu',
    shortLabel: 'Cầu',
    iconName: 'Milestone',
    legacyCategory: 'public',
    searchKeywords: ['cầu', 'cầu xuân phương', 'cầu cà lồ'],
    showByDefault: true,
  },
  lake: {
    id: 'lake',
    parentId: 'landmark',
    label: 'Hồ',
    shortLabel: 'Hồ',
    iconName: 'Waves',
    legacyCategory: 'public',
    searchKeywords: ['hồ', 'hồ đại lải', 'hồ lập đinh'],
    showByDefault: true,
  },
  park: {
    id: 'park',
    parentId: 'landmark',
    label: 'Công viên',
    shortLabel: 'Công viên',
    iconName: 'Trees',
    legacyCategory: 'public',
    searchKeywords: ['công viên', 'vườn hoa', 'cây xanh'],
    showByDefault: true,
  },
  religious: {
    id: 'religious',
    parentId: 'landmark',
    label: 'Đền / Chùa / Nhà thờ',
    shortLabel: 'Tâm linh',
    iconName: 'Landmark',
    legacyCategory: 'public',
    searchKeywords: ['chùa', 'đền', 'đình', 'nhà thờ', 'miếu'],
    showByDefault: true,
  },
  tourist_attraction: {
    id: 'tourist_attraction',
    parentId: 'landmark',
    label: 'Điểm tham quan',
    shortLabel: 'Tham quan',
    iconName: 'Mountain',
    legacyCategory: 'public',
    searchKeywords: ['núi thằn lằn', 'bốt pháp', 'di tích', 'tham quan', 'du lịch'],
    showByDefault: true,
  },

  // ================= FALLBACK (Phần 53) =================
  uncategorized: {
    id: 'uncategorized',
    parentId: 'uncategorized',
    label: 'Chưa phân loại',
    shortLabel: 'Chưa phân loại',
    iconName: 'HelpCircle',
    legacyCategory: 'service',
    searchKeywords: ['chưa phân loại', 'khác'],
    showByDefault: false,
  },
};

export const ALL_MAP_SUBCATEGORIES: MapSubcategoryMeta[] = Object.values(MAP_CATEGORY_REGISTRY);

export const MAP_SUBCATEGORIES_BY_PARENT: Record<MapParentCategoryId, MapSubcategoryMeta[]> =
  MAP_PARENT_CATEGORIES.reduce(
    (acc, parent) => {
      acc[parent.id] = ALL_MAP_SUBCATEGORIES.filter((sub) => sub.parentId === parent.id);
      return acc;
    },
    {} as Record<MapParentCategoryId, MapSubcategoryMeta[]>
  );

export function getSubcategoriesByParent(parentId: MapParentCategoryId | string): MapSubcategoryMeta[] {
  if (parentId in MAP_SUBCATEGORIES_BY_PARENT) {
    return MAP_SUBCATEGORIES_BY_PARENT[parentId as MapParentCategoryId];
  }
  return ALL_MAP_SUBCATEGORIES;
}

export function getDefaultSectorTagForSubcategory(sub: MapSubcategoryMeta): string {
  if (sub.parentId === 'public' || sub.parentId === 'landmark' || sub.parentId === 'education' || sub.parentId === 'health') {
    return 'dia-danh';
  }
  if (sub.id === 'billiards' || sub.id === 'gaming') return 'bia-game';
  if (sub.parentId === 'entertainment') return 'an-choi';
  if (sub.id === 'phone_shop' || sub.id === 'electronics') return 'dien-thoai';
  if (sub.parentId === 'night_food') return 'nhau-lau';
  if (sub.parentId === 'drink') return 'uong';
  if (sub.id === 'street_food' || sub.id === 'fast_food' || sub.id === 'banh_mi') return 'an-vat';
  if (sub.parentId === 'food') return 'an-chinh';
  return 'dich-vu';
}

/**
 * DANH SÁCH QUICK CATEGORY BAR Ở ĐÁY MÀN HÌNH (PHẦN 7–9 & 35)
 * Configurable — không hardcode trong JSX.
 */
export interface QuickCategoryBarItem {
  id: string;
  label: string;
  iconName: LucideRegistryIconName;
  /** Khớp theo danh sách Parent Category hoặc Subcategory */
  matchParents?: MapParentCategoryId[];
  matchSubcategories?: MapSubcategoryId[];
}

export const QUICK_CATEGORY_BAR_ITEMS: QuickCategoryBarItem[] = [
  {
    id: 'food',
    label: 'Ăn uống',
    iconName: 'Utensils',
    matchParents: ['food', 'night_food'],
  },
  {
    id: 'cafe',
    label: 'Cafe',
    iconName: 'Coffee',
    matchParents: ['drink'],
    matchSubcategories: ['cafe', 'milk_tea', 'tea', 'juice', 'beverage'],
  },
  {
    id: 'billiards',
    label: 'Bi-a',
    iconName: 'CircleDot',
    matchSubcategories: ['billiards'],
  },
  {
    id: 'entertainment',
    label: 'Vui chơi',
    iconName: 'Gamepad2',
    matchParents: ['entertainment'],
    matchSubcategories: ['gaming', 'karaoke', 'kids_playground', 'sports', 'entertainment_center', 'billiards'],
  },
];

/**
 * CẤU TRÚC NHÓM TRONG BOTTOM SHEET "BẠN MUỐN TÌM GÌ?" (PHẦN 36–37)
 */
export interface BottomSheetCategorySection {
  id: string;
  title: string;
  items: Array<{
    id: string;
    label: string;
    iconName: LucideRegistryIconName;
    matchParents?: MapParentCategoryId[];
    matchSubcategories?: MapSubcategoryId[];
  }>;
}

export const BOTTOM_SHEET_CATEGORY_SECTIONS: BottomSheetCategorySection[] = [
  {
    id: 'sec_food_drink',
    title: 'Ăn uống',
    items: [
      { id: 'local_food', label: 'Quán ăn', iconName: 'Utensils', matchParents: ['food'] },
      { id: 'noodle', label: 'Bún / Phở', iconName: 'Soup', matchSubcategories: ['noodle'] },
      { id: 'rice', label: 'Cơm / Suất ăn', iconName: 'UtensilsCrossed', matchSubcategories: ['rice'] },
      { id: 'street_food', label: 'Ăn vặt', iconName: 'Sandwich', matchSubcategories: ['street_food', 'banh_mi', 'fast_food'] },
      { id: 'cafe', label: 'Cafe', iconName: 'Coffee', matchSubcategories: ['cafe', 'tea'] },
      { id: 'milk_tea', label: 'Trà sữa', iconName: 'CupSoda', matchSubcategories: ['milk_tea', 'juice', 'beverage'] },
      { id: 'pub', label: 'Quán nhậu / Bia', iconName: 'Beer', matchParents: ['night_food'], matchSubcategories: ['pub', 'beer', 'beer_garden', 'grill_pub', 'hotpot_pub', 'hotpot', 'grill'] },
    ],
  },
  {
    id: 'sec_entertainment',
    title: 'Vui chơi',
    items: [
      { id: 'billiards', label: 'Bi-a', iconName: 'CircleDot', matchSubcategories: ['billiards'] },
      { id: 'gaming', label: 'Gaming / Net', iconName: 'Gamepad2', matchSubcategories: ['gaming'] },
      { id: 'karaoke', label: 'Karaoke', iconName: 'Mic2', matchSubcategories: ['karaoke'] },
      { id: 'sports', label: 'Thể thao', iconName: 'Trophy', matchSubcategories: ['sports', 'kids_playground', 'entertainment_center'] },
    ],
  },
  {
    id: 'sec_shopping',
    title: 'Mua sắm',
    items: [
      { id: 'supermarket', label: 'Siêu thị', iconName: 'Store', matchSubcategories: ['supermarket', 'convenience_store'] },
      { id: 'grocery', label: 'Tạp hóa', iconName: 'ShoppingBag', matchSubcategories: ['grocery'] },
      { id: 'market', label: 'Chợ', iconName: 'ShoppingBasket', matchSubcategories: ['market'] },
      { id: 'phone_shop', label: 'Điện thoại', iconName: 'Smartphone', matchSubcategories: ['phone_shop', 'electronics'] },
      { id: 'fashion', label: 'Thời trang', iconName: 'Shirt', matchSubcategories: ['fashion'] },
    ],
  },
  {
    id: 'sec_transport',
    title: 'Xe & di chuyển',
    items: [
      { id: 'fuel_station', label: 'Cây xăng', iconName: 'Fuel', matchSubcategories: ['fuel_station'] },
      { id: 'motorbike_repair', label: 'Sửa xe', iconName: 'Wrench', matchSubcategories: ['motorbike_repair', 'car_repair'] },
      { id: 'parking', label: 'Bãi gửi xe', iconName: 'ParkingCircle', matchSubcategories: ['parking', 'bus_station'] },
      { id: 'ev_charging', label: 'Trạm sạc', iconName: 'Zap', matchSubcategories: ['ev_charging'] },
    ],
  },
  {
    id: 'sec_health',
    title: 'Sức khỏe',
    items: [
      { id: 'pharmacy', label: 'Hiệu thuốc', iconName: 'Pill', matchSubcategories: ['pharmacy'] },
      { id: 'clinic', label: 'Phòng khám', iconName: 'Stethoscope', matchSubcategories: ['clinic', 'dental'] },
      { id: 'hospital', label: 'Y tế / Bệnh viện', iconName: 'Hospital', matchSubcategories: ['hospital', 'health_station'] },
    ],
  },
  {
    id: 'sec_education_public',
    title: 'Giáo dục & Hành chính',
    items: [
      { id: 'education', label: 'Trường học', iconName: 'GraduationCap', matchParents: ['education'] },
      { id: 'government', label: 'Cơ quan / UBND', iconName: 'Landmark', matchSubcategories: ['government', 'public_service', 'cultural_center'] },
      { id: 'police', label: 'Công an', iconName: 'Shield', matchSubcategories: ['police'] },
      { id: 'post_office', label: 'Bưu điện', iconName: 'Mail', matchSubcategories: ['post_office'] },
    ],
  },
  {
    id: 'sec_service_landmark',
    title: 'Dịch vụ & Địa danh',
    items: [
      { id: 'bank', label: 'Ngân hàng / ATM', iconName: 'Building2', matchSubcategories: ['bank', 'atm'] },
      { id: 'hotel', label: 'Khách sạn', iconName: 'BedDouble', matchSubcategories: ['hotel'] },
      { id: 'barber', label: 'Tóc / Làm đẹp', iconName: 'Scissors', matchSubcategories: ['barber', 'beauty'] },
      { id: 'other_service', label: 'Dịch vụ khác', iconName: 'Briefcase', matchSubcategories: ['laundry', 'repair_service', 'other_service'] },
      { id: 'landmark', label: 'Địa danh', iconName: 'Compass', matchParents: ['landmark'] },
    ],
  },
];

/**
 * RENDER ICON VECTOR LUCIDE THỐNG NHẤT (PHẦN 2, 3, 24)
 * Stroke: 1.5px - 1.75px (mặc định 1.65px), outline/line style, round cap/join, tuyệt đối không emoji.
 */
export function renderRegistryIcon(
  iconName: LucideRegistryIconName | string,
  sizeOrOpts:
    | number
    | { size?: number; strokeWidth?: number; className?: string } = 17,
  strokeWidthOrClassName: number | string = 1.65,
  classNameArg = ''
): React.ReactNode {
  const isObj = typeof sizeOrOpts === 'object' && sizeOrOpts !== null;
  const size = isObj ? (sizeOrOpts.size ?? 17) : sizeOrOpts;
  const strokeWidth = isObj
    ? (sizeOrOpts.strokeWidth ?? 1.65)
    : typeof strokeWidthOrClassName === 'number'
      ? strokeWidthOrClassName
      : 1.65;
  const className = isObj
    ? (sizeOrOpts.className ?? '')
    : typeof strokeWidthOrClassName === 'string'
      ? strokeWidthOrClassName
      : classNameArg;
  const props = {
    size,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: `shrink-0 ${className}`.trim(),
  };

  switch (iconName) {
    case 'Utensils':
    case 'utensils':
      return <Utensils {...props} />;
    case 'UtensilsCrossed':
      return <UtensilsCrossed {...props} />;
    case 'Soup':
    case 'soup':
      return <Soup {...props} />;
    case 'Sandwich':
      return <Sandwich {...props} />;
    case 'Flame':
      return <Flame {...props} />;
    case 'Fish':
      return <Fish {...props} />;
    case 'Pizza':
      return <Pizza {...props} />;
    case 'Coffee':
    case 'coffee':
      return <Coffee {...props} />;
    case 'CupSoda':
      return <CupSoda {...props} />;
    case 'GlassWater':
      return <GlassWater {...props} />;
    case 'Beer':
    case 'beer':
      return <Beer {...props} />;
    case 'CircleDot':
    case 'billiards':
      return <CircleDot {...props} />;
    case 'Gamepad2':
    case 'gamepad':
      return <Gamepad2 {...props} />;
    case 'Mic2':
    case 'party':
      return <Mic2 {...props} />;
    case 'FerrisWheel':
      return <FerrisWheel {...props} />;
    case 'Trophy':
      return <Trophy {...props} />;
    case 'Fuel':
      return <Fuel {...props} />;
    case 'Zap':
      return <Zap {...props} />;
    case 'Wrench':
      return <Wrench {...props} />;
    case 'ParkingCircle':
      return <ParkingCircle {...props} />;
    case 'Bus':
      return <Bus {...props} />;
    case 'Hospital':
      return <Hospital {...props} />;
    case 'Stethoscope':
      return <Stethoscope {...props} />;
    case 'Pill':
      return <Pill {...props} />;
    case 'HeartPulse':
      return <HeartPulse {...props} />;
    case 'GraduationCap':
    case 'school':
      return <GraduationCap {...props} />;
    case 'School':
      return <School {...props} />;
    case 'Baby':
      return <Baby {...props} />;
    case 'BookOpen':
      return <BookOpen {...props} />;
    case 'Landmark':
    case 'landmark':
      return <Landmark {...props} />;
    case 'Shield':
      return <Shield {...props} />;
    case 'Mail':
      return <Mail {...props} />;
    case 'Building2':
      return <Building2 {...props} />;
    case 'Store':
    case 'store':
      return <Store {...props} />;
    case 'ShoppingBag':
    case 'shopping-bag':
      return <ShoppingBag {...props} />;
    case 'ShoppingBasket':
      return <ShoppingBasket {...props} />;
    case 'Shirt':
      return <Shirt {...props} />;
    case 'Monitor':
      return <Monitor {...props} />;
    case 'Smartphone':
    case 'smartphone':
      return <Smartphone {...props} />;
    case 'CreditCard':
      return <CreditCard {...props} />;
    case 'BedDouble':
      return <BedDouble {...props} />;
    case 'Sparkles':
    case 'sparkles':
      return <Sparkles {...props} />;
    case 'Scissors':
      return <Scissors {...props} />;
    case 'Briefcase':
      return <Briefcase {...props} />;
    case 'Compass':
      return <Compass {...props} />;
    case 'Milestone':
      return <Milestone {...props} />;
    case 'Waves':
      return <Waves {...props} />;
    case 'Trees':
      return <Trees {...props} />;
    case 'Mountain':
      return <Mountain {...props} />;
    case 'HelpCircle':
      return <HelpCircle {...props} />;
    default:
      return <MapPin {...props} />;
  }
}

/**
 * PHÂN LOẠI & MIGRATE ĐỊA ĐIỂM HIỆN CÓ SANG TAXONOMY 2 CẤP (PHẦN 52 & 53)
 * - Không làm mất bất kỳ địa điểm, ID hay tọa độ nào.
 * - Tách bạch hoàn toàn: Cây xăng (`fuel_station`), Bi-a (`billiards`), Bia/Quán nhậu (`beer`/`pub`),
 *   Điện thoại (`phone_shop`), Hiệu thuốc (`pharmacy`), Ngân hàng (`bank`), Trường học (`university`...), Cơ quan (`government`...).
 */
export function resolvePlaceTaxonomy(input: {
  id?: string;
  name?: string;
  address?: string;
  tagline?: string;
  subType?: string;
  tags?: string[];
  sectorTag?: string;
  mapCategory?: string;
  category?: string;
  parentCategoryId?: string;
  subcategoryId?: string;
  showByDefault?: boolean;
  explicitParentId?: string;
  explicitSubcategoryId?: string;
  explicitShowByDefault?: boolean;
  dataSource?: string;
}): {
  parentCategoryId: MapParentCategoryId;
  subcategoryId: MapSubcategoryId;
  legacyCategory: Exclude<MapCategoryKey, 'all' | 'game_asset'>;
  showByDefault: boolean;
} {
  const effectiveSubId = input.explicitSubcategoryId || input.subcategoryId;
  const effectiveShowByDefault =
    typeof input.explicitShowByDefault === 'boolean'
      ? input.explicitShowByDefault
      : input.showByDefault;
  // 1. Nếu Admin đã lưu subcategoryId hợp lệ thì ưu tiên tuyệt đối
  if (
    effectiveSubId &&
    effectiveSubId in MAP_CATEGORY_REGISTRY
  ) {
    const subMeta = MAP_CATEGORY_REGISTRY[effectiveSubId as MapSubcategoryId];
    return {
      parentCategoryId: subMeta.parentId,
      subcategoryId: subMeta.id,
      legacyCategory: subMeta.legacyCategory,
      showByDefault:
        typeof effectiveShowByDefault === 'boolean'
          ? effectiveShowByDefault
          : subMeta.showByDefault,
    };
  }

  // Nếu mapCategory đang lưu trực tiếp một SubcategoryId mới
  if (input.mapCategory && input.mapCategory in MAP_CATEGORY_REGISTRY) {
    const subMeta = MAP_CATEGORY_REGISTRY[input.mapCategory as MapSubcategoryId];
    return {
      parentCategoryId: subMeta.parentId,
      subcategoryId: subMeta.id,
      legacyCategory: subMeta.legacyCategory,
      showByDefault:
        typeof effectiveShowByDefault === 'boolean'
          ? effectiveShowByDefault
          : subMeta.showByDefault,
    };
  }

  const nameLower = (input.name || '').toLowerCase();
  const subLower = `${input.subType || ''} ${input.tagline || ''}`.toLowerCase();
  const tagsLower = (input.tags || []).join(' ').toLowerCase();
  const haystack = `${nameLower} ${subLower} ${tagsLower}`.trim();
  const mapCat = (input.mapCategory || input.category || '').toLowerCase();
  const sector = (input.sectorTag || '').toLowerCase();

  const pickSub = (subId: MapSubcategoryId) => {
    const meta = MAP_CATEGORY_REGISTRY[subId];
    return {
      parentCategoryId: meta.parentId,
      subcategoryId: meta.id,
      legacyCategory: meta.legacyCategory,
      showByDefault:
        typeof effectiveShowByDefault === 'boolean'
          ? effectiveShowByDefault
          : meta.showByDefault,
    };
  };

  // 2. XE & DI CHUYỂN (Cây xăng, Trạm sạc, Sửa xe, Bãi đỗ xe, Bến xe)
  if (
    haystack.includes('cây xăng') ||
    haystack.includes('trạm xăng') ||
    haystack.includes('xăng dầu') ||
    haystack.includes('petrolimex') ||
    haystack.includes('pvoil') ||
    /\bxăng\b/i.test(nameLower)
  ) {
    return pickSub('fuel_station');
  }
  if (haystack.includes('trạm sạc') || haystack.includes('sạc xe điện')) {
    return pickSub('ev_charging');
  }
  if (
    haystack.includes('gara') ||
    haystack.includes('sửa chữa ô tô') ||
    haystack.includes('nội thất ô tô')
  ) {
    return pickSub('car_repair');
  }
  if (
    haystack.includes('sửa xe') ||
    haystack.includes('xe máy') ||
    haystack.includes('phụ tùng xe') ||
    haystack.includes('head honda') ||
    haystack.includes('yamaha town')
  ) {
    return pickSub('motorbike_repair');
  }
  if (haystack.includes('bãi đỗ xe') || haystack.includes('bãi gửi xe') || haystack.includes('nhà xe')) {
    return pickSub('parking');
  }
  if (haystack.includes('bến xe') || haystack.includes('trạm xe buýt') || haystack.includes('điểm dừng xe buýt')) {
    return pickSub('bus_station');
  }

  // 3. ĐỊA DANH / CÔNG CỘNG / Y TẾ / GIÁO DỤC
  // QUAN TRỌNG: Chỉ xét dựa trên TÊN ĐỊA ĐIỂM (`nameLower`) và `mapCat` công cộng,
  // KHÔNG xét `tagline`/`tags` vì rất nhiều quán ăn sinh viên có tagline "gần ĐHSP Hà Nội 2", "cổng Ký túc xá", "gần Quảng trường Con Chim Xanh".
  const isCommercialShopName =
    nameLower.includes('quán ') ||
    nameLower.startsWith('quán') ||
    nameLower.includes('tiệm ') ||
    nameLower.startsWith('tiệm') ||
    nameLower.includes('bánh ') ||
    nameLower.includes('bún ') ||
    nameLower.includes('phở ') ||
    nameLower.includes('cơm ') ||
    nameLower.includes('lẩu ') ||
    nameLower.includes('nướng ') ||
    nameLower.includes('chè ') ||
    nameLower.includes('trà ') ||
    nameLower.includes('cafe') ||
    nameLower.includes('cà phê') ||
    nameLower.includes('coffee') ||
    nameLower.includes('bi-a') ||
    nameLower.includes('billiards') ||
    nameLower.includes('nhà hàng') ||
    nameLower.includes('ăn vặt') ||
    nameLower.includes('tạp hóa') ||
    nameLower.includes('siêu thị');

  if (!isCommercialShopName) {
    if (
      nameLower.includes('quảng trường') ||
      nameLower.includes('con chim xanh')
    ) {
      return pickSub('square');
    }
    if (nameLower.startsWith('cầu ') || nameLower.includes('cầu xuân') || nameLower.includes('cầu cà lồ')) {
      return pickSub('bridge');
    }
    if (nameLower.startsWith('hồ ') || nameLower.includes('hồ đại lải') || nameLower.includes('hồ lập đinh')) {
      return pickSub('lake');
    }
    if (nameLower.startsWith('công viên') || nameLower.startsWith('vườn hoa')) {
      return pickSub('park');
    }
    if (
      nameLower.startsWith('chùa ') ||
      nameLower.startsWith('đền ') ||
      nameLower.startsWith('đình ') ||
      nameLower.startsWith('nhà thờ')
    ) {
      return pickSub('religious');
    }
    if (
      nameLower.includes('núi thằn lằn') ||
      nameLower.includes('bốt pháp') ||
      nameLower.includes('nhà trắng xuân hòa')
    ) {
      return pickSub('landmark');
    }
    if (
      nameLower.includes('ubnd') ||
      nameLower.includes('đảng ủy') ||
      nameLower.includes('hđnd') ||
      nameLower.includes('trụ sở hành chính') ||
      nameLower.includes('chi cục thuế') ||
      nameLower.includes('kho bạc')
    ) {
      return pickSub('government');
    }
    if (nameLower.includes('công an') || nameLower.includes('cảnh sát')) {
      return pickSub('police');
    }
    if (
      nameLower.includes('bưu điện') ||
      nameLower.includes('bưu cục') ||
      nameLower.includes('viettel post') ||
      nameLower.includes('giao hàng tiết kiệm')
    ) {
      return pickSub('post_office');
    }
    if (
      nameLower.includes('nhà văn hóa') ||
      nameLower.includes('trung tâm văn hóa') ||
      nameLower.includes('hội trường') ||
      nameLower.includes('thư viện')
    ) {
      return pickSub('cultural_center');
    }

    // Y TẾ / SỨC KHỎE
    if (nameLower.includes('bệnh viện') || nameLower.includes('trung tâm y tế')) {
      return pickSub('hospital');
    }
    if (nameLower.includes('trạm y tế')) {
      return pickSub('health_station');
    }
    if (
      nameLower.includes('nhà thuốc') ||
      nameLower.includes('hiệu thuốc') ||
      nameLower.includes('quầy thuốc') ||
      nameLower.includes('dược phẩm') ||
      nameLower.includes('long châu') ||
      nameLower.includes('pharmacity')
    ) {
      return pickSub('pharmacy');
    }
    if (nameLower.includes('nha khoa') || nameLower.includes('răng hàm mặt')) {
      return pickSub('dental');
    }
    if (nameLower.includes('phòng khám') || mapCat === 'medical') {
      return pickSub('clinic');
    }

    // GIÁO DỤC
    if (
      nameLower.includes('đại học') ||
      nameLower.startsWith('đh ') ||
      nameLower.includes('đh kiến trúc') ||
      nameLower.includes('đhsp') ||
      nameLower.includes('học viện') ||
      nameLower.includes('giảng đường') ||
      nameLower.includes('khu hiệu bộ') ||
      nameLower.includes('ký túc xá')
    ) {
      return pickSub('university');
    }
    if (
      nameLower.includes('cao đẳng') ||
      nameLower.startsWith('cđ ') ||
      nameLower.includes('trung cấp') ||
      nameLower.includes('trường nghề')
    ) {
      return pickSub('college');
    }
    if (nameLower.includes('thpt') || nameLower.includes('trung học phổ thông')) {
      return pickSub('high_school');
    }
    if (nameLower.includes('thcs') || nameLower.includes('trung học cơ sở')) {
      return pickSub('secondary_school');
    }
    if (nameLower.includes('tiểu học')) {
      return pickSub('primary_school');
    }
    if (nameLower.includes('mầm non') || nameLower.includes('mẫu giáo')) {
      return pickSub('kindergarten');
    }
    if (
      nameLower.includes('trung tâm giáo dục') ||
      nameLower.includes('trung tâm ngoại ngữ') ||
      nameLower.includes('trung tâm đào tạo') ||
      nameLower.includes('sát hạch') ||
      mapCat === 'school'
    ) {
      return pickSub('education_center');
    }
  }

  // 4. VUI CHƠI & GIẢI TRÍ — TÁCH RÕ BI-A vs BIA (Phần 52)
  if (
    mapCat === 'billiards' ||
    haystack.includes('bi-a') ||
    haystack.includes('billiards') ||
    haystack.includes('billiard') ||
    haystack.includes('bi a') ||
    /\bbia\s+\d+\s*club\b/i.test(nameLower) ||
    /\bclb\s+bia\b/i.test(nameLower)
  ) {
    return pickSub('billiards');
  }
  if (
    mapCat === 'game' ||
    haystack.includes('cyber') ||
    haystack.includes('gaming') ||
    haystack.includes('quán net') ||
    haystack.includes('internet') ||
    haystack.includes('ps5') ||
    haystack.includes('playstation') ||
    haystack.includes('esport')
  ) {
    return pickSub('gaming');
  }
  if (haystack.includes('karaoke') || haystack.includes('k-box') || haystack.includes('phòng hát')) {
    return pickSub('karaoke');
  }
  if (haystack.includes('khu vui chơi') || haystack.includes('kids')) {
    return pickSub('kids_playground');
  }
  if (
    haystack.includes('sân bóng') ||
    haystack.includes('cầu lông') ||
    haystack.includes('pickleball') ||
    haystack.includes('bể bơi') ||
    haystack.includes('phòng gym') ||
    haystack.includes('fitness') ||
    haystack.includes('yoga') ||
    haystack.includes('bóng bàn')
  ) {
    return pickSub('sports');
  }
  if (mapCat === 'entertainment' || sector === 'an-choi' || sector === 'bia-game') {
    return pickSub('entertainment_center');
  }

  // 5. MUA SẮM (Chợ, Siêu thị, Tạp hóa, Điện thoại, Điện máy, Thời trang)
  if (nameLower.startsWith('chợ ') || haystack.includes('chợ xuân hòa') || haystack.includes('chợ sinh viên')) {
    return pickSub('market');
  }
  if (
    mapCat === 'phone' ||
    sector === 'dien-thoai' ||
    haystack.includes('điện thoại') ||
    haystack.includes('di động') ||
    haystack.includes('iphone') ||
    haystack.includes('apple') ||
    haystack.includes('mobile') ||
    haystack.includes('fpt shop') ||
    haystack.includes('thế giới di động') ||
    haystack.includes('phụ kiện điện thoại')
  ) {
    return pickSub('phone_shop');
  }
  if (haystack.includes('điện máy') || haystack.includes('máy tính') || haystack.includes('laptop')) {
    return pickSub('electronics');
  }
  if (haystack.includes('winmart+') || haystack.includes('circle k') || haystack.includes('tiện lợi')) {
    return pickSub('convenience_store');
  }
  if (
    mapCat === 'supermarket' ||
    haystack.includes('siêu thị') ||
    haystack.includes('winmart') ||
    haystack.includes('lan chi') ||
    haystack.includes('aloha')
  ) {
    return pickSub('supermarket');
  }
  if (mapCat === 'grocery' || haystack.includes('tạp hóa') || haystack.includes('bách hóa') || haystack.includes('tự chọn')) {
    return pickSub('grocery');
  }
  if (haystack.includes('thời trang') || haystack.includes('quần áo') || haystack.includes('giày dép')) {
    return pickSub('fashion');
  }

  // 6. DỊCH VỤ (Ngân hàng, ATM, Khách sạn, Tóc, Spa, Giặt là)
  if (
    haystack.includes('ngân hàng') ||
    haystack.includes('agribank') ||
    haystack.includes('vietinbank') ||
    haystack.includes('vietcombank') ||
    haystack.includes('bidv') ||
    haystack.includes('techcombank') ||
    haystack.includes('mbbank')
  ) {
    return pickSub('bank');
  }
  if (/\batm\b/i.test(haystack)) {
    return pickSub('atm');
  }
  if (
    haystack.includes('khách sạn') ||
    haystack.includes('nhà nghỉ') ||
    haystack.includes('homestay') ||
    haystack.includes('resort') ||
    haystack.includes('hotel')
  ) {
    return pickSub('hotel');
  }
  if (
    haystack.includes('cắt tóc') ||
    haystack.includes('salon tóc') ||
    haystack.includes('hair') ||
    haystack.includes('barber') ||
    haystack.includes('tóc nam') ||
    haystack.includes('tóc nữ')
  ) {
    return pickSub('barber');
  }
  if (
    haystack.includes('spa') ||
    haystack.includes('thẩm mỹ') ||
    haystack.includes('nail') ||
    haystack.includes('làm đẹp') ||
    haystack.includes('gội đầu dưỡng sinh')
  ) {
    return pickSub('beauty');
  }
  if (haystack.includes('giặt là') || haystack.includes('giặt khô')) {
    return pickSub('laundry');
  }

  // 7. NHẬU & LẨU ĐÊM (night_food) — Tách rõ khỏi Bi-a
  if (haystack.includes('beer garden') || haystack.includes('vườn bia')) {
    return pickSub('beer_garden');
  }
  if (
    haystack.includes('bia hơi') ||
    haystack.includes('bia tươi') ||
    haystack.includes('bia hà nội') ||
    haystack.includes('beer club') ||
    /\bbia\b/i.test(nameLower)
  ) {
    return pickSub('beer');
  }
  if (haystack.includes('lẩu nướng') || (haystack.includes('lẩu') && haystack.includes('nướng'))) {
    return pickSub('grill_pub');
  }
  if (haystack.includes('lẩu đêm') || haystack.includes('nhậu đêm')) {
    return pickSub('hotpot_pub');
  }
  if (mapCat === 'pub' || sector === 'nhau-lau' || haystack.includes('quán nhậu') || haystack.includes('nhậu')) {
    return pickSub('pub');
  }

  // 8. ĐỒ UỐNG (drink)
  if (
    haystack.includes('trà sữa') ||
    haystack.includes('mixue') ||
    haystack.includes('tocotoco') ||
    haystack.includes('dingtea') ||
    haystack.includes('boba')
  ) {
    return pickSub('milk_tea');
  }
  if (haystack.includes('trà chanh') || haystack.includes('trà đá') || haystack.includes('tiệm trà')) {
    return pickSub('tea');
  }
  if (haystack.includes('nước ép') || haystack.includes('sinh tố') || haystack.includes('nước mía')) {
    return pickSub('juice');
  }
  if (
    mapCat === 'cafe' ||
    sector === 'uong' ||
    haystack.includes('cafe') ||
    haystack.includes('cà phê') ||
    haystack.includes('coffee')
  ) {
    return pickSub('cafe');
  }

  // 9. ĂN UỐNG (food)
  if (haystack.includes('bánh mì') || haystack.includes('bánh mỳ')) {
    return pickSub('banh_mi');
  }
  if (
    haystack.includes('bún') ||
    haystack.includes('phở') ||
    haystack.includes('miến') ||
    haystack.includes('bánh đa') ||
    haystack.includes('mì cay') ||
    haystack.includes('mì vằn thắn') ||
    haystack.includes('hủ tiếu')
  ) {
    return pickSub('noodle');
  }
  if (
    haystack.includes('cơm ') ||
    nameLower.startsWith('cơm') ||
    haystack.includes('suất ăn')
  ) {
    return pickSub('rice');
  }
  if (haystack.includes('lẩu')) {
    return pickSub('hotpot');
  }
  if (haystack.includes('nướng') || haystack.includes('bbq')) {
    return pickSub('grill');
  }
  if (haystack.includes('hải sản') || haystack.includes('ốc ')) {
    return pickSub('seafood');
  }
  if (
    haystack.includes('gà rán') ||
    haystack.includes('pizza') ||
    haystack.includes('kfc') ||
    haystack.includes('lotteria') ||
    haystack.includes('fastfood')
  ) {
    return pickSub('fast_food');
  }
  if (
    mapCat === 'snack' ||
    sector === 'an-vat' ||
    haystack.includes('ăn vặt') ||
    haystack.includes('nem chua') ||
    haystack.includes('bánh tráng') ||
    haystack.includes('xiên') ||
    haystack.includes('chè ')
  ) {
    return pickSub('street_food');
  }
  if (haystack.includes('nhà hàng') || haystack.includes('ẩm thực')) {
    return pickSub('restaurant');
  }
  if (mapCat === 'food' || sector === 'an-chinh') {
    return pickSub('local_food');
  }

  // 10. Hậu kiểm theo mapCategory cũ
  if (mapCat === 'public') {
    return pickSub('government');
  }
  if (mapCat === 'service' || sector === 'dich-vu') {
    return pickSub('other_service');
  }

  return pickSub('uncategorized');
}

/**
 * KIỂM TRA XEM ĐỊA ĐIỂM CÓ PHẢI CORE LANDMARK HIỂN THỊ MẶC ĐỊNH KHI MỞ BẢN ĐỒ KHÔNG (PHẦN 5, 29–30, 51)
 */
export function isDefaultVisibleMapLandmark(place: {
  id?: string;
  name?: string;
  category?: string;
  parentCategoryId?: string;
  subcategoryId?: string;
  showByDefault?: boolean;
  dataSource?: string;
}): boolean {
  if (typeof place.showByDefault === 'boolean') {
    return place.showByDefault;
  }
  if (place.subcategoryId && place.subcategoryId in MAP_CATEGORY_REGISTRY) {
    return MAP_CATEGORY_REGISTRY[place.subcategoryId as MapSubcategoryId].showByDefault;
  }
  const resolved = resolvePlaceTaxonomy({
    id: place.id,
    name: place.name,
    category: place.category,
    dataSource: place.dataSource,
  });
  return resolved.showByDefault;
}

/**
 * KIỂM TRA XEM MỘT ĐỊA ĐIỂM CÓ KHỚP VỚI BỘ LỌC QUICK CATEGORY / SUBCATEGORY ĐANG CHỌN KHÔNG (PHẦN 34–38)
 */
export function doesPlaceMatchQuickFilter(
  place: {
    category?: string;
    parentCategoryId?: string;
    subcategoryId?: string;
    name?: string;
    metadata?: { subType?: string; tags?: string[]; sectorTag?: string };
  },
  activeFilterId: string | null
): boolean {
  if (!activeFilterId || activeFilterId === 'none') return false;
  if (activeFilterId === 'all') return true;

  const resolved =
    place.parentCategoryId &&
    place.parentCategoryId in MAP_PARENT_CATEGORY_BY_ID &&
    place.subcategoryId &&
    place.subcategoryId in MAP_CATEGORY_REGISTRY
      ? {
          parentCategoryId: place.parentCategoryId as MapParentCategoryId,
          subcategoryId: place.subcategoryId as MapSubcategoryId,
        }
      : resolvePlaceTaxonomy({
          name: place.name,
          subType: place.metadata?.subType,
          tags: place.metadata?.tags,
          sectorTag: place.metadata?.sectorTag,
          category: place.category,
        });

  // 1. Kiểm tra nếu activeFilterId là một item trong QUICK_CATEGORY_BAR_ITEMS
  const quickItem = QUICK_CATEGORY_BAR_ITEMS.find((q) => q.id === activeFilterId);
  if (quickItem) {
    if (
      quickItem.matchSubcategories &&
      quickItem.matchSubcategories.includes(resolved.subcategoryId)
    ) {
      return true;
    }
    if (
      quickItem.matchParents &&
      quickItem.matchParents.includes(resolved.parentCategoryId)
    ) {
      return true;
    }
    return false;
  }

  // 2. Kiểm tra nếu activeFilterId là một item trong BOTTOM_SHEET_CATEGORY_SECTIONS
  for (const sec of BOTTOM_SHEET_CATEGORY_SECTIONS) {
    const sheetItem = sec.items.find((it) => it.id === activeFilterId);
    if (sheetItem) {
      if (
        sheetItem.matchSubcategories &&
        sheetItem.matchSubcategories.includes(resolved.subcategoryId)
      ) {
        return true;
      }
      if (
        sheetItem.matchParents &&
        sheetItem.matchParents.includes(resolved.parentCategoryId)
      ) {
        return true;
      }
      return false;
    }
  }

  // 3. Kiểm tra trực tiếp theo SubcategoryId hoặc ParentCategoryId hoặc LegacyCategory
  if (resolved.subcategoryId === activeFilterId) return true;
  if (resolved.parentCategoryId === activeFilterId) return true;
  if (place.category === activeFilterId) return true;

  return false;
}

/**
 * LẤY METADATA HIỂN THỊ CHUẨN (LABEL, SHORT LABEL, ICON) CHO BẤT KỲ ĐỊA ĐIỂM NÀO (PHẦN 10, 24–25)
 */
export function getPlaceTaxonomyMeta(place: {
  id?: string;
  name?: string;
  category?: string;
  parentCategoryId?: string;
  subcategoryId?: string;
  showByDefault?: boolean;
  dataSource?: string;
  metadata?: { subType?: string; tags?: string[]; sectorTag?: string };
}): {
  parentMeta: MapParentCategoryMeta;
  subMeta: MapSubcategoryMeta;
  parent: MapParentCategoryMeta;
  subcategory: MapSubcategoryMeta;
  iconName: LucideRegistryIconName;
  showByDefault: boolean;
} {
  const resolved =
    place.subcategoryId && place.subcategoryId in MAP_CATEGORY_REGISTRY
      ? {
          parentCategoryId: MAP_CATEGORY_REGISTRY[place.subcategoryId as MapSubcategoryId].parentId,
          subcategoryId: place.subcategoryId as MapSubcategoryId,
          showByDefault:
            typeof place.showByDefault === 'boolean'
              ? place.showByDefault
              : MAP_CATEGORY_REGISTRY[place.subcategoryId as MapSubcategoryId].showByDefault,
        }
      : resolvePlaceTaxonomy({
          id: place.id,
          name: place.name,
          subType: place.metadata?.subType,
          tags: place.metadata?.tags,
          sectorTag: place.metadata?.sectorTag,
          category: place.category,
          explicitShowByDefault: place.showByDefault,
          dataSource: place.dataSource,
        });

  const subMeta =
    MAP_CATEGORY_REGISTRY[resolved.subcategoryId] || MAP_CATEGORY_REGISTRY.uncategorized;
  const parentMeta =
    MAP_PARENT_CATEGORY_BY_ID[resolved.parentCategoryId] ||
    MAP_PARENT_CATEGORY_BY_ID.uncategorized;

  return {
    parentMeta,
    subMeta,
    parent: parentMeta,
    subcategory: subMeta,
    iconName: subMeta.iconName,
    showByDefault: resolved.showByDefault,
  };
}

/**
 * TÌM KIẾM NHANH SUBCATEGORY TRONG ADMIN KHI GÕ TỪ KHÓA (PHẦN 23)
 * VD: Gõ "xăng" -> Cây xăng, "bi-a" -> Bi-a, "bia" -> Bia hơi / Quán nhậu
 */
export function searchSubcategoriesByQuery(query: string): MapSubcategoryMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_MAP_SUBCATEGORIES;

  return ALL_MAP_SUBCATEGORIES.filter((sub) => {
    const parent = MAP_PARENT_CATEGORY_BY_ID[sub.parentId];
    if (sub.label.toLowerCase().includes(q)) return true;
    if (sub.shortLabel.toLowerCase().includes(q)) return true;
    if (parent && parent.label.toLowerCase().includes(q)) return true;
    return sub.searchKeywords.some((kw) => kw.toLowerCase().includes(q));
  });
}

/**
 * LẤY NHÃN HIỂN THỊ CHO MỘT QUICK FILTER ID ĐANG BẬT
 */
export function getActiveFilterDisplayMeta(filterId: string | null): {
  id: string;
  label: string;
  iconName: LucideRegistryIconName;
} | null {
  if (!filterId || filterId === 'none') return null;
  if (filterId === 'all') {
    return { id: 'all', label: 'Tất cả địa điểm', iconName: 'MapPin' };
  }
  const quick = QUICK_CATEGORY_BAR_ITEMS.find((q) => q.id === filterId);
  if (quick) {
    return { id: quick.id, label: quick.label, iconName: quick.iconName };
  }
  for (const sec of BOTTOM_SHEET_CATEGORY_SECTIONS) {
    const item = sec.items.find((it) => it.id === filterId);
    if (item) {
      return { id: item.id, label: item.label, iconName: item.iconName };
    }
  }
  if (filterId in MAP_CATEGORY_REGISTRY) {
    const sub = MAP_CATEGORY_REGISTRY[filterId as MapSubcategoryId];
    return { id: sub.id, label: sub.label, iconName: sub.iconName };
  }
  if (filterId in MAP_PARENT_CATEGORY_BY_ID) {
    const par = MAP_PARENT_CATEGORY_BY_ID[filterId as MapParentCategoryId];
    return { id: par.id, label: par.label, iconName: par.iconName };
  }
  return null;
}
