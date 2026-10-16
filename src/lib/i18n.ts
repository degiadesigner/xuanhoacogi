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
    spin_btn: 'SPIN NOW',
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
