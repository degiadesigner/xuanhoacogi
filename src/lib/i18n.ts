// Quản lý đa ngôn ngữ (Tiếng Việt & Tiếng Anh, mặc định: Tiếng Việt)
'use client';

import { useState, useEffect } from 'react';

export type Language = 'vi' | 'en';

const LANG_STORAGE_KEY = 'xuanhoa_language_v1';

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'vi';
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'vi') return saved;
  } catch {}
  return 'vi';
}

export function saveLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent('xuanhoa_lang_change', { detail: lang }));
  } catch {}
}

export const translations = {
  vi: {
    brand_domain: 'XUÂNHÒACÓGÌ',
    brand_suffix: '.COM',
    brand_tagline: 'Chuyên trị: “Ăn gì cũng được”',
    login: 'Đăng nhập',
    logout: 'Đăng xuất',
    guest: 'Khách Vãng Lai',
    level: 'Cấp',
    tier: 'Bậc',
    points: 'điểm',
    dishes_collected: 'món ăn',
    dishes_unit: 'món',
    spins_unit: 'lượt',
    spins_opened: 'Đã mở:',
    spins_count_label: 'lượt quay',
    spin_dish_tab: 'QUAY CHỌN MÓN',
    spin_dish_sub: '150+ món ngon · Lọc món theo bữa & ví tiền',
    spin_place_tab: 'QUAY CHỌN QUÁN',
    spin_place_sub: '86+ quán thực tế · Lọc theo khung giờ & sở thích',
    today_eat: 'Hôm Nay Ăn Gì',
    today_pub: 'Hôm Nay Nhậu Gì',
    today_drink: 'Hôm Nay Uống Gì',
    session_label: 'KHUNG GIỜ:',
    session_morning: 'Sáng',
    session_noon: 'Trưa',
    session_afternoon: 'Xế Chiều',
    session_evening: 'Tối',
    session_night: 'Cú Đêm',
    session_all_day: 'Cả ngày',
    price_all: 'Giá: Tất cả',
    spin_btn: 'QUAY TIẾP',
    spinning_btn: 'ĐANG QUAY...',
    inventory_title: 'Trong kho có gì?',
    inventory_all_dishes: 'Tất cả món',
    inventory_unique_dishes: 'Món độc bản',
    inventory_dish_desc_unique: 'Mỗi món đại diện 1 lần duy nhất (không trùng lặp) · Bấm vào món để xem các quán ở Xuân Hòa',
    inventory_dish_desc_all: 'Hiển thị danh sách đầy đủ theo từng quán tại Xuân Hòa',
    inventory_place_title: 'DANH SÁCH ĐỊA ĐIỂM XÁC THỰC',
    inventory_place_desc: 'Bấm vào quán để xem địa chỉ, hotline, Google Maps và thực đơn đầy đủ',
    footer_dishes: 'Khám phá món',
    footer_places: 'Quán ăn',
    footer_guide: 'Cách sử dụng',
    footer_about: 'Giới thiệu',
    menu_title: 'Menu Cài Đặt',
    menu_language: 'Ngôn ngữ',
    menu_sound: 'Âm lượng',
    menu_sound_on: 'Âm lượng - 100%',
    menu_sound_off: 'Âm lượng - Tắt',
    menu_guide: 'Hướng dẫn',
    menu_contact: 'Liên hệ với chúng tôi',
    lang_modal_title: 'Chọn Ngôn Ngữ',
    lang_vi: '🇻🇳 Tiếng Việt (Xuân Hòa Bản Địa)',
    lang_en: '🇬🇧 English (International)',
    scorecard_title: 'Bảng Điểm Thực Khách',
    scorecard_desc: 'Sổ Điểm Ẩm Thực Xuân Hòa · Hệ Thống 50 Cấp Độ & 9 Bậc Danh Hiệu',
    scorecard_current: 'Điểm hiện tại',
    scorecard_next: 'Cần đạt cấp tiếp theo',
    scorecard_remaining: 'Còn thiếu',
    scorecard_history_dishes: 'món đã mở',
    scorecard_completed: 'hoàn thành',
    scorecard_view_details: 'Bấm xem Bảng Điểm Chi Tiết',
    scorecard_ladder_title: 'Lộ Trình 9 Bậc Danh Hiệu Ẩm Thực',
    scorecard_unlocked: 'Đã đạt',
    scorecard_current_tag: 'Hiện tại',
    scorecard_locked: 'Chưa mở',
    scorecard_guest_notice: 'Bạn đang là Khách Vãng Lai (tối đa 3 món). Hãy đăng nhập để lưu trữ không giới hạn!',
    scorecard_login_btn: 'Đăng nhập để tích điểm',
    scorecard_keep_spinning: 'Quay tiếp để tích điểm',
    // Settings & Taste Filter
    settings_title: 'Cài Đặt Hệ Thống',
    taste_filter_title: 'Lọc Theo Gu Ẩm Thực',
    taste_filter_active: 'Đang Bật',
    taste_filter_inactive: 'Đang Tắt',
    taste_filter_desc_on: 'Vòng quay ưu tiên các món ngon hợp khẩu vị của bạn',
    taste_filter_desc_off: 'Khám phá ngẫu nhiên tất cả các món (Ăn gì cũng được)',
    taste_filter_guest_desc: 'Đăng nhập để chọn nhóm thực khách (SV / Bản địa) & gợi ý chuẩn gu',
    taste_filter_guest_btn: 'Đăng nhập',
    taste_filter_edit_btn: 'Sửa gu ẩm thực ✎',
    taste_filter_nav_btn: 'Lọc theo gu',
    
    // Quick Actions
    menu_sound_active: 'Bật (100%)',
    menu_sound_muted: 'Tắt tiếng',
    menu_guide_badge: 'Mẹo hay',
    menu_contact_badge: 'Hỗ trợ',

    // Mobile Dock
    dock_spin: 'Quay Món',
    dock_dishes: 'Món Ngon',
    dock_places: 'Quán Xá',
    dock_login: 'Đăng Nhập',
    dock_profile: 'Tài Khoản',
    dock_settings: 'Cài Đặt',

    // Header & Badges
    header_total_spins: 'Tổng lượt quay',
    header_level: 'Cấp',
    header_scoreboard: 'Bảng điểm',
    header_all: 'Tất cả',
    
    // Wheel Spin actions
    spin_food_cta: 'QUAY CHỌN MÓN',
    spin_place_cta: 'QUAY CHỌN QUÁN',
    spin_again_cta: 'QUAY TIẾP',
    spin_rolling_cta: 'ĐANG QUAY...',

    // Catalog Filters
    catalog_filter_all: 'Tất cả',
    catalog_filter_all_areas: 'Mọi khu vực',
    catalog_filter_all_types: 'Mọi hình thức',
    catalog_filter_top_rated: 'Sao cao nhất',
    search_dishes_placeholder: 'Tìm kiếm món ăn ngon...',
    search_places_placeholder: 'Tìm kiếm quán ăn...',
    // Sub-filters: Pub
    pub_filter_label: 'Kèo nhậu:',
    pub_all: 'Tất cả',
    pub_hotpot_grill: 'Lẩu & Nướng',
    pub_snails_seafood: 'Ốc & Hải Sản',
    pub_beer_bites: 'Bia & Mồi',
    pub_casual: 'Nhậu bình dân',

    // Sub-filters: Drinks
    drink_filter_label: 'Đồ uống:',
    drink_all: 'Tất cả',
    drink_milktea: 'Trà sữa',
    drink_coffee: 'Cà phê',
    drink_fruittea: 'Trà trái cây',
    drink_juice: 'Nước ép & Sinh tố',

    // Place categories
    place_cat_all: 'Tất Cả Quán',
    place_cat_rice_noodles: 'Quán Cơm & Bún Phở',
    place_cat_pub_grill: 'Quán Nhậu & Lẩu Nướng',
    place_cat_cafe_drinks: 'Cafe & Đồ Uống',
    place_cat_street_snacks: 'Quán Ăn Vặt',

    // Mobile pills
    mobile_mode_dishes: 'Chọn Món',
    mobile_mode_places: 'Chọn Quán',
    mobile_cat_food: 'Món Ăn',
    mobile_cat_pub: 'Kèo Nhậu',
    mobile_cat_drink: 'Đồ Uống',
    mobile_place_all: 'Tất Cả',
    mobile_place_rice_pho: 'Cơm & Phở',
    mobile_place_pub: 'Nhậu',
    mobile_place_cafe: 'Cafe',

    // Taste filter pill labels
    taste_pill_on: 'Gu của tôi: BẬT',
    taste_pill_off: 'Gu của tôi: TẮT',
    taste_mobile_on: 'Gu: BẬT',
    taste_mobile_off: 'Gu: TẮT',
    taste_mobile_guest: 'Theo gu',

    // Dropdown labels
    budget_title: 'CHỌN MỨC NGÂN SÁCH',
    price_prefix: 'Giá:',
    budget_all: 'Tất cả mức giá',
    budget_under35: '≤ 35.000đ (Bình dân)',
    budget_under50: '≤ 50.000đ (Tiêu chuẩn)',
    budget_under75: '≤ 75.000đ (Khá)',
    budget_under100: '≤ 100.000đ (Lẩu/Nhậu)',
    budget_above150: '≥ 150.000đ (Đặc sản)',
    budget_custom: 'Tự nhập giá...',

    session_title: 'KHUNG GIỜ PHỤC VỤ',
    session_prefix: 'Giờ:',

    keo_title: 'KÈO ĐI ĂN TẠI XUÂN HÒA',
    keo_prefix: 'Kèo:',
    keo_all: 'Tất cả kèo ăn uống',
    keo_dating: 'Hẹn hò & 2 người',
    keo_solo: 'Ăn nhanh & 1 người',
    keo_group: 'Nhóm bạn & Gia đình',
    keo_ship: 'Gọi ship tận nơi',

    map_coming_soon: 'Bản Đồ Số (Đang phát triển)',
    toast_map_title: 'Bản đồ Số : Sắp ra mắt',
    close: 'Đóng',
    back: 'Quay lại',
  },
  en: {
    brand_domain: 'XUANHOACOGI',
    brand_suffix: '.COM',
    brand_tagline: 'Curing: "Anything is fine"',
    login: 'Sign In',
    logout: 'Sign Out',
    guest: 'Guest Explorer',
    level: 'Lvl',
    tier: 'Tier',
    points: 'pts',
    dishes_collected: 'dishes',
    dishes_unit: 'dishes',
    spins_unit: 'spins',
    spins_opened: 'Opened:',
    spins_count_label: 'spins',
    spin_dish_tab: 'SPIN FOR DISH',
    spin_dish_sub: '150+ dishes · Filter by meal & budget',
    spin_place_tab: 'SPIN FOR PLACE',
    spin_place_sub: '86+ verified spots · Filter by time & vibes',
    today_eat: "Today's Food",
    today_pub: "Today's Pub & Grill",
    today_drink: "Today's Drinks",
    session_label: 'TIMING:',
    session_morning: 'Morning',
    session_noon: 'Noon',
    session_afternoon: 'Afternoon',
    session_evening: 'Evening',
    session_night: 'Late Night',
    session_all_day: 'All Day',
    price_all: 'Price: All',
    spin_btn: 'SPIN AGAIN',
    spinning_btn: 'SPINNING...',
    inventory_title: "What's in stock?",
    inventory_all_dishes: 'All Dishes',
    inventory_unique_dishes: 'Unique Dishes',
    inventory_dish_desc_unique: 'Each unique concept represented once · Click to explore local spots in Xuan Hoa',
    inventory_dish_desc_all: 'Showing complete menu items across all verified restaurants',
    inventory_place_title: 'VERIFIED PLACES DIRECTORY',
    inventory_place_desc: 'Click on a place to view address, hotline, Google Maps and full menu',
    footer_dishes: 'Discover Dishes',
    footer_places: 'Places',
    footer_guide: 'User Guide',
    footer_about: 'About Us',
    menu_title: 'Settings Menu',
    menu_language: 'Language',
    menu_sound: 'Sound FX',
    menu_sound_on: 'Sound - 100%',
    menu_sound_off: 'Sound - Muted',
    menu_guide: 'Guide',
    menu_contact: 'Contact Us',
    lang_modal_title: 'Select Language',
    lang_vi: '🇻🇳 Vietnamese (Native XuHo)',
    lang_en: '🇬🇧 English (International)',
    scorecard_title: 'Gourmet Scorecard',
    scorecard_desc: 'Xuan Hoa Food Odyssey · 50 Levels & 9 Grand Tiers Ladder',
    scorecard_current: 'Current Score',
    scorecard_next: 'Next Level Target',
    scorecard_remaining: 'Remaining',
    scorecard_history_dishes: 'dishes unlocked',
    scorecard_completed: 'completed',
    scorecard_view_details: 'Click to view Full Scorecard',
    scorecard_ladder_title: 'The 9 Gourmet Mastery Tiers Ladder',
    scorecard_unlocked: 'Unlocked',
    scorecard_current_tag: 'Current',
    scorecard_locked: 'Locked',
    scorecard_guest_notice: 'You are a Guest Explorer (capped at 3 dishes). Sign in to unlock unlimited progression!',
    scorecard_login_btn: 'Sign in to level up',
    scorecard_keep_spinning: 'Spin more to level up',

    // Settings & Taste Filter
    settings_title: 'Settings',
    taste_filter_title: 'Taste-Based Filter',
    taste_filter_active: 'Active',
    taste_filter_inactive: 'Inactive',
    taste_filter_desc_on: 'Spin prioritizes dishes tailored to your taste preferences',
    taste_filter_desc_off: 'Explore all dishes randomly without restrictions',
    taste_filter_guest_desc: 'Sign in to customize taste profile & enjoy tailored recommendations',
    taste_filter_guest_btn: 'Sign In',
    taste_filter_edit_btn: 'Edit taste ✎',
    taste_filter_nav_btn: 'Taste Filter',
    
    // Quick Actions
    menu_sound_active: 'On (100%)',
    menu_sound_muted: 'Muted',
    menu_guide_badge: 'Tips',
    menu_contact_badge: 'Help',

    // Mobile Dock
    dock_spin: 'Spin',
    dock_dishes: 'Dishes',
    dock_places: 'Places',
    dock_login: 'Sign In',
    dock_profile: 'Profile',
    dock_settings: 'Settings',

    // Header & Badges
    header_total_spins: 'Total spins',
    header_level: 'Lvl',
    header_scoreboard: 'Scoreboard',
    header_all: 'All',
    
    // Wheel Spin actions
    spin_food_cta: 'SPIN FOOD',
    spin_place_cta: 'SPIN PLACE',
    spin_again_cta: 'SPIN AGAIN',
    spin_rolling_cta: 'SPINNING...',

    // Catalog Filters
    catalog_filter_all: 'All',
    catalog_filter_all_areas: 'All Areas',
    catalog_filter_all_types: 'All Types',
    catalog_filter_top_rated: 'Top Rated',
    search_dishes_placeholder: 'Search delicious dishes...',
    search_places_placeholder: 'Search food places...',

    // Sub-filters: Pub
    pub_filter_label: 'Vibe:',
    pub_all: 'All',
    pub_hotpot_grill: 'Hotpot & Grill',
    pub_snails_seafood: 'Snails & Seafood',
    pub_beer_bites: 'Beer & Bites',
    pub_casual: 'Casual Drinking',

    // Sub-filters: Drinks
    drink_filter_label: 'Drinks:',
    drink_all: 'All',
    drink_milktea: 'Milk Tea',
    drink_coffee: 'Coffee',
    drink_fruittea: 'Fruit Tea',
    drink_juice: 'Juice & Smoothies',

    // Place categories
    place_cat_all: 'All Places',
    place_cat_rice_noodles: 'Rice & Noodles',
    place_cat_pub_grill: 'Pub & Grill',
    place_cat_cafe_drinks: 'Cafe & Drinks',
    place_cat_street_snacks: 'Street Snacks',

    // Mobile pills
    mobile_mode_dishes: 'Dishes',
    mobile_mode_places: 'Places',
    mobile_cat_food: 'Dishes',
    mobile_cat_pub: 'Pub & BBQ',
    mobile_cat_drink: 'Drinks',
    mobile_place_all: 'All',
    mobile_place_rice_pho: 'Rice & Pho',
    mobile_place_pub: 'Pub',
    mobile_place_cafe: 'Cafe',

    // Taste filter pill labels
    taste_pill_on: 'Taste Filter: ON',
    taste_pill_off: 'Taste Filter: OFF',
    taste_mobile_on: 'Taste: ON',
    taste_mobile_off: 'Taste: OFF',
    taste_mobile_guest: 'Taste',

    // Dropdown labels
    budget_title: 'SELECT BUDGET LEVEL',
    price_prefix: 'Price:',
    budget_all: 'All budgets',
    budget_under35: '≤ 35k (Budget)',
    budget_under50: '≤ 50k (Standard)',
    budget_under75: '≤ 75k (Comfort)',
    budget_under100: '≤ 100k (Feast / BBQ)',
    budget_above150: '≥ 150k (Specialties)',
    budget_custom: 'Custom price...',

    session_title: 'SERVICE TIMING',
    session_prefix: 'Time:',

    keo_title: 'DINING OCCASION & VIBE',
    keo_prefix: 'Occasion:',
    keo_all: 'All dining occasions',
    keo_dating: 'Dating & Couples (2 pax)',
    keo_solo: 'Quick Bite & Solo',
    keo_group: 'Friends & Family',
    keo_ship: 'Delivery / Takeout',

    map_coming_soon: 'Digital Map (Coming soon)',
    toast_map_title: 'Digital Map: Coming soon',
    close: 'Close',
    back: 'Back',
  }
};

export function useI18n() {
  const [lang, setLangState] = useState<Language>(() => getStoredLanguage());

  useEffect(() => {
    const handleLangChange = (e: any) => {
      setLangState(e.detail || getStoredLanguage());
    };
    window.addEventListener('xuanhoa_lang_change', handleLangChange);
    return () => window.removeEventListener('xuanhoa_lang_change', handleLangChange);
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLangState(newLang);
    saveLanguage(newLang);
  };

  const t = (key: keyof typeof translations['vi']) => {
    return translations[lang]?.[key] || translations['vi'][key] || key;
  };

  return { lang, changeLanguage, t };
}

import type { Food } from './foods';

export const copy = {
  vi: {
    tiers: ['QUỐC DÂN', 'HIẾM', 'CỰC PHẨM', 'TỐI MẬT', '★ ĐẶC BIỆT'],
    lunchDish: 'Món ăn trưa', vegetarianDish: 'Chay',
  },
  en: {
    tiers: ['MIL-SPEC', 'RESTRICTED', 'CLASSIFIED', 'COVERT', '★ SPECIAL ITEM'],
    lunchDish: 'Lunch dish', vegetarianDish: 'Vegetarian',
  },
} as const;

export function foodName(food: Food, language: Language) {
  return food.name;
}

export function foodSubtitle(food: Food, language: Language) {
  if (language === 'vi') return food.sub;
  return food.veg ? copy.en.vegetarianDish : copy.en.lunchDish;
}

export function priceLabel(thousands: number | string, language: Language, approximate = false) {
  const value = Number(thousands) * 1000;
  const formatted = language === 'en' ? `₫${new Intl.NumberFormat('en-US').format(value)}` : `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
  return `${approximate ? '~' : ''}${formatted}`;
}
