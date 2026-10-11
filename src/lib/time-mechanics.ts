import { Food } from './foods';
import { Place } from './places-xuanhoa';

export type MealSession = 'all' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

export interface SessionInfo {
  id: MealSession;
  label: string;
  timeRange: string;
  greeting: string;
  description: string;
}

export const MEAL_SESSIONS: SessionInfo[] = [
  {
    id: 'morning',
    label: 'Buổi Sáng',
    timeRange: '05:00 - 10:00',
    greeting: 'Bữa sáng & Cà phê tràn năng lượng',
    description: 'Phở bò gia truyền, Bánh cuốn Ngọc Ánh, Bún bò Anh Toàn, Bún riêu Bà Mai, Bánh mì Bơ Ú, Sủi cảo Tiêu Lầu, Cà phê phin / Cà phê muối 1975',
  },
  {
    id: 'noon',
    label: 'Buổi Trưa',
    timeRange: '10:00 - 14:00',
    greeting: 'Bữa trưa tiếp sức no bụng',
    description: 'Cơm tấm 82, Cơm rang dưa bò/kim chi 68 (Bà Thu), Bún chả Mẹ Sóc, Bún đậu Thơ Còii, Lẩu bò khế & Bánh xèo Cuốn Mộc, Mì quảng, Mì cay, Trà sâm dứa mát lạnh',
  },
  {
    id: 'afternoon',
    label: 'Xế Chiều',
    timeRange: '14:00 - 17:30',
    greeting: 'Ăn vặt & Trà chiều giải nhiệt',
    description: 'Bánh mì Bơ Ú, Bánh gà Gamitra, Kem dừa, Xôi cốm sen dừa 185, Xôi xoài / Xôi mít, Cuốn bơ xoài Cuốn Mộc, Trà sữa TocoToco / S.OH, Nem chua rán',
  },
  {
    id: 'evening',
    label: 'Buổi Tối',
    timeRange: '17:30 - 21:30',
    greeting: 'Bữa tối quây quần & Bàn tiệc lẩu nướng',
    description: 'Lẩu nướng Beef88, Má đào cháy tỏi Xuho Bistro, Thịt trâu Phi Xuyên, Lẩu riêu cua / bò nhúng khế, Bún đậu, Hàu nướng phô mai, Mì cay RUBY',
  },
  {
    id: 'night',
    label: 'Cú Đêm',
    timeRange: '21:30 - 05:00',
    greeting: 'Ăn đêm ấm bụng & Ship tận nơi',
    description: 'Cháo sườn nóng hổi, Bánh mì đêm, Ốc luộc mắm gừng, Chân gà sả tắc, Cơm rang kim chi / dưa bò ship tận nơi, Trà chanh 1L',
  },
];

export function getLiveMealSession(): MealSession {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  // 05:00 - 10:00 (300p - 600p): Sáng
  if (mins >= 300 && mins < 600) return 'morning';
  // 10:00 - 14:00 (600p - 840p): Trưa
  if (mins >= 600 && mins < 840) return 'noon';
  // 14:00 - 17:30 (840p - 1050p): Xế Chiều
  if (mins >= 840 && mins < 1050) return 'afternoon';
  // 17:30 - 21:30 (1050p - 1290p): Buổi Tối
  if (mins >= 1050 && mins < 1290) return 'evening';
  // 21:30 - 04:59 (1290p trở đi hoặc < 300p): Cú Đêm
  return 'night';
}

/**
 * LỌC MÓN ĂN THEO KHUNG GIỜ ("Hôm Nay Ăn Gì")
 * Tuyệt đối không chứa đồ uống, không chứa món tráng miệng vào bữa sáng,
 * khớp chính xác món theo từng khung giờ thực tế tại Xuân Hòa.
 */
export function isFoodSuitableForSession(food: Food, session: MealSession): boolean {
  if (session === 'all') return true;

  const name = food.name.toLowerCase();
  const sub = food.sub.toLowerCase();
  const customId = (food.customId || '').toLowerCase();

  // 1. TUYỆT ĐỐI LOẠI BỎ ĐỒ UỐNG RA KHỎI "ĂN GÌ"
  if (
    customId.startsWith('drink_') ||
    customId === 'dish_cuonmoc_sam_dua' ||
    name.includes('trà sâm dứa') ||
    name.includes('nước mía') ||
    name.includes('cà phê') ||
    name.includes('cafe') ||
    name.includes('trà tắc') ||
    name.includes('trà sữa') ||
    name.includes('sinh tố') ||
    name.includes('sữa chua lắc') ||
    name.includes('sữa tươi') ||
    name.includes('bia hơi') ||
    name.includes('thùng bia')
  ) {
    return false;
  }

  // 2. BUỔI SÁNG (05:00 - 10:30): Món ăn sáng truyền thống: Phở, Bánh cuốn, Bánh mì, Bún riêu/bò, Cháo, Sủi cảo
  if (session === 'morning') {
    // Cuốn Mộc mở từ 09:30/10:00 -> Không hiển thị món Cuốn Mộc vào bữa sáng
    if (customId.startsWith('dish_cuonmoc_') || sub.includes('cuốn mộc') || name.includes('cuốn mộc')) {
      return false;
    }

    // Tuyệt đối loại trừ món nhậu, lẩu, ốc, nầm sườn, hải sản, mì cay nồng, ăn vặt chiên, tráng miệng xôi ngọt
    if (
      name.includes('lẩu') ||
      name.includes('nướng') ||
      name.includes('bbq') ||
      name.includes('bò lúc lắc') ||
      name.includes('bò né') ||
      name.includes('ốc') ||
      name.includes('hàu') ||
      name.includes('ngao') ||
      name.includes('hải sản') ||
      name.includes('mực') ||
      name.includes('tôm sú') ||
      name.includes('cá lăng') ||
      name.includes('cá tầm') ||
      name.includes('thịt trâu') ||
      name.includes('trâu') ||
      name.includes('thịt thỏ') ||
      name.includes('thịt dê') ||
      name.includes('mẹt gà') ||
      name.includes('mẹt lợn') ||
      name.includes('gà không lối thoát') ||
      name.includes('gà chọi') ||
      name.includes('chim câu') ||
      name.includes('lợn mán') ||
      name.includes('nhựa mận') ||
      name.includes('má đào') ||
      name.includes('tóp mỡ') ||
      name.includes('lòng non') ||
      name.includes('chân gà') ||
      name.includes('cánh gà') ||
      name.includes('bánh xèo') ||
      name.includes('nem lụi') ||
      name.includes('nem nướng') ||
      name.includes('nem chua rán') ||
      name.includes('nem phô mai') ||
      name.includes('bánh gà') ||
      name.includes('khoai') ||
      name.includes('lạp xưởng') ||
      name.includes('mẹt ăn vặt') ||
      name.includes('takoyaki') ||
      name.includes('mì cay') ||
      name.includes('mì xào') ||
      name.includes('mì trộn') ||
      name.includes('cơm tấm') ||
      name.includes('cơm rang') ||
      name.includes('cơm suất') ||
      name.includes('cơm sườn') ||
      name.includes('bún chả') ||
      name.includes('bún đậu') ||
      name.includes('bún trộn') ||
      name.includes('bún thịt nướng') ||
      name.includes('phở cuốn') ||
      name.includes('cuốn tôm') ||
      name.includes('cuốn bơ') ||
      name.includes('cuốn nem') ||
      name.includes('cuốn bắc bộ') ||
      name.includes('nộm') ||
      name.includes('gỏi') ||
      name.includes('kem') ||
      name.includes('chè') ||
      name.includes('tào phớ') ||
      name.includes('bánh đúc') ||
      name.includes('xôi xoài') ||
      name.includes('xôi mít') ||
      name.includes('xôi cốm') ||
      name.includes('xôi chim')
    ) {
      return false;
    }

    return (
      (name.includes('phở') && !name.includes('phở cuốn')) ||
      name.includes('bánh cuốn') ||
      name.includes('bánh mì') ||
      name.includes('bún bò') ||
      name.includes('bún riêu') ||
      name.includes('bún cua') ||
      name.includes('bún mọc') ||
      name.includes('bún cá') ||
      name.includes('cháo') ||
      name.includes('hủ tiếu') ||
      (name.includes('miến') && !name.includes('miến trộn')) ||
      name.includes('sủi cảo') ||
      (name.includes('xôi') && !name.includes('xoài') && !name.includes('mít') && !name.includes('cốm') && !name.includes('chim')) ||
      sub.includes('sáng')
    );
  }

  // 3. BUỔI TRƯA (10:30 - 14:00): Bữa trưa năng lượng no bụng
  if (session === 'noon') {
    // Loại bỏ đồ ăn vặt xế chiều thuần túy & tráng miệng ngọt nhẹ
    if (
      name.includes('kem') ||
      name.includes('chè') ||
      name.includes('tào phớ') ||
      name.includes('sữa chua') ||
      name.includes('xôi cốm') ||
      name.includes('khoai lang kén') ||
      name.includes('bánh đúc nóng')
    ) {
      return false;
    }

    return (
      name.includes('cơm') ||
      name.includes('bún chả') ||
      name.includes('bún đậu') ||
      name.includes('bún bò') ||
      name.includes('bún riêu') ||
      name.includes('bún cua') ||
      name.includes('bún cá') ||
      name.includes('bún trộn') ||
      name.includes('bún thịt nướng') ||
      name.includes('mì quảng') ||
      name.includes('mì cay') ||
      name.includes('mì xào') ||
      name.includes('mì trộn') ||
      name.includes('phở') ||
      name.includes('bánh mì') ||
      name.includes('sủi cảo') ||
      name.includes('bánh xèo') ||
      name.includes('lẩu bò nhúng khế') ||
      name.includes('cuốn tôm thịt') ||
      name.includes('phở cuốn') ||
      name.includes('gà không lối thoát') ||
      customId.startsWith('dish_cuonmoc_') ||
      sub.includes('trưa')
    );
  }

  // 4. BUỔI CHIỀU (14:00 - 17:30): Món ăn xế nhẹ nhàng, êm dịu cho dạ dày
  if (session === 'afternoon') {
    // Loại bỏ đồ ăn no nặng bụng: cơm đĩa lớn, lẩu lớn, mẹt cỗ thịt
    if (
      name.includes('cơm tấm') ||
      name.includes('cơm suất') ||
      name.includes('bún chả') ||
      name.includes('bún đậu') ||
      name.includes('bún bò') ||
      name.includes('bún riêu') ||
      name.includes('phở bò') ||
      name.includes('lẩu bò nhúng khế') ||
      name.includes('lẩu') ||
      name.includes('mẹt gà') ||
      name.includes('mẹt lợn') ||
      name.includes('gà không lối thoát') ||
      name.includes('gà chọi') ||
      name.includes('thịt trâu') ||
      name.includes('cá lăng') ||
      food.price >= 75
    ) {
      return false;
    }

    return (
      name.includes('bánh mì') ||
      name.includes('bánh đúc') ||
      name.includes('kem') ||
      name.includes('xôi cốm') ||
      name.includes('xôi xoài') ||
      name.includes('xôi mít') ||
      name.includes('khoai') ||
      name.includes('nem chua rán') ||
      name.includes('nem phô mai') ||
      name.includes('bánh gà') ||
      name.includes('lạp xưởng') ||
      name.includes('mẹt ăn vặt') ||
      name.includes('phở cuốn') ||
      name.includes('cuốn bơ xoài') ||
      name.includes('cuốn nem mộc') ||
      name.includes('cuốn tôm thịt') ||
      name.includes('cuốn tôm bơ') ||
      name.includes('bánh xèo trứng chảy') ||
      name.includes('bánh xèo mực babi') ||
      name.includes('chè') ||
      name.includes('tào phớ') ||
      name.includes('sữa chua') ||
      name.includes('cá viên') ||
      name.includes('takoyaki') ||
      sub.includes('chiều') ||
      sub.includes('vặt')
    );
  }

  // 5. BUỔI TỐI (17:30 - 21:30): Bữa tối quây quần, bàn tiệc lẩu nướng, quán nhậu, mì cay, cơm gia đình
  if (session === 'evening') {
    if (name.includes('bánh cuốn') || name.includes('xôi cốm')) {
      return false;
    }

    return (
      name.includes('lẩu') ||
      name.includes('nướng') ||
      name.includes('mì cay') ||
      name.includes('mì xào') ||
      name.includes('mì trộn') ||
      name.includes('bún đậu') ||
      name.includes('bún chả') ||
      name.includes('nem lụi') ||
      name.includes('bánh xèo') ||
      name.includes('cơm rang') ||
      name.includes('cơm tấm') ||
      name.includes('cơm') ||
      name.includes('phở') ||
      name.includes('bún') ||
      name.includes('mẹt') ||
      name.includes('gà') ||
      name.includes('chân gà') ||
      name.includes('cánh gà') ||
      name.includes('nộm bò') ||
      name.includes('sủi cảo') ||
      name.includes('bánh mì') ||
      customId.startsWith('dish_cuonmoc_') ||
      food.price >= 25
    );
  }

  // 6. CÚ ĐÊM KTX (21:30 - 05:00): Cứu đói đêm khuya, đặt ship tận sảnh KTX, đồ ăn đêm & lai rai
  if (session === 'night') {
    // Loại trừ bàn tiệc lớn cồng kềnh > 250k và món ăn sáng
    if (food.price > 250 || name.includes('bánh cuốn') || name.includes('xôi cốm')) {
      return false;
    }

    return (
      name.includes('cháo') ||
      name.includes('bánh mì') ||
      name.includes('cơm rang') ||
      name.includes('kim chi') ||
      name.includes('bún trộn') ||
      name.includes('mì cay') ||
      name.includes('mì xào') ||
      name.includes('mì trộn') ||
      name.includes('chân gà') ||
      name.includes('cánh gà') ||
      name.includes('nem chua rán') ||
      name.includes('nem phô mai') ||
      name.includes('ốc') ||
      name.includes('hàu') ||
      name.includes('trứng cút lộn') ||
      name.includes('bún đậu') ||
      name.includes('bún bò') ||
      name.includes('phở') ||
      name.includes('sủi cảo') ||
      sub.includes('đêm') ||
      sub.includes('ship') ||
      food.price <= 85
    );
  }

  return true;
}

/**
 * LỌC ĐỒ UỐNG THEO KHUNG GIỜ ("Hôm Nay Uống Gì")
 * Buổi sáng: Cà phê phin, cà phê muối, trà đào cam sả (Tuyệt đối KHÔNG trà sâm dứa mát lạnh lẩu cuốn, KHÔNG trà sữa ngấy)
 * Buổi trưa: Trà sâm dứa mát lạnh Cuốn Mộc (giải ngấy sau ăn trưa), trà tắc, nước mía, trà xoài
 * Buổi chiều: Full trà sữa, sinh tố bơ dừa non, trà trái cây nhiệt đới, sữa chua lắc
 * Buổi tối & đêm: Trà chanh 1L vỉa hè chém gió, trà quất, cafe đêm, trà sâm dứa sau tiệc
 */
export function isDrinkSuitableForSession(drink: Food, session: MealSession): boolean {
  if (session === 'all') return true;

  const name = drink.name.toLowerCase();
  const customId = (drink.customId || '').toLowerCase();

  // 1. BUỔI SÁNG (05:00 - 10:30): Cà phê tỉnh táo, trà thanh tao ấm bụng
  if (session === 'morning') {
    // Tuyệt đối loại trừ trà sâm dứa mát lạnh sau lẩu, trà sữa ngấy, nước mía vỉa hè
    if (
      customId === 'dish_cuonmoc_sam_dua' ||
      name.includes('sâm dứa') ||
      name.includes('trà sữa') ||
      name.includes('trân châu') ||
      name.includes('nước mía') ||
      name.includes('bia')
    ) {
      return false;
    }

    return (
      name.includes('cà phê') ||
      name.includes('cafe') ||
      name.includes('bạc xỉu') ||
      name.includes('phin kem trứng') ||
      name.includes('trà đào') ||
      name.includes('cam ép') ||
      name.includes('nước ép') ||
      name.includes('ép cam') ||
      name.includes('ép cóc') ||
      name.includes('sen vàng') ||
      name.includes('gạo rang') ||
      name.includes('quýt hoa nhài') ||
      name.includes('tàu hũ') ||
      name.includes('sữa hạt') ||
      name.includes('sữa chua') ||
      name.includes('trà hoa') ||
      name.includes('chè đậu đỏ')
    );
  }

  // 2. BUỔI TRƯA (10:30 - 14:00): Giải nhiệt sau bữa trưa, trà sâm dứa Cuốn Mộc giải ngấy
  if (session === 'noon') {
    return (
      customId === 'dish_cuonmoc_sam_dua' ||
      name.includes('sâm dứa') ||
      name.includes('trà tắc') ||
      name.includes('nước mía') ||
      name.includes('trà xoài') ||
      name.includes('trà đào') ||
      name.includes('cà phê') ||
      name.includes('cafe') ||
      name.includes('bơ sữa') ||
      name.includes('sữa chua') ||
      name.includes('trà sữa')
    );
  }

  // 3. BUỔI CHIỀU (14:00 - 17:30): Giờ vàng trà sữa Đài Loan & trà trái cây
  if (session === 'afternoon') {
    return (
      name.includes('trà sữa') ||
      name.includes('matcha') ||
      name.includes('cheese') ||
      name.includes('bơ sữa') ||
      name.includes('sữa chua') ||
      name.includes('trà đào') ||
      name.includes('trà xoài') ||
      name.includes('trà chanh') ||
      name.includes('cà phê') ||
      name.includes('nước mía')
    );
  }

  // 4. BUỔI TỐI (17:30 - 21:30): Trà chanh vỉa hè chém gió, cafe chill, trà sữa, trà sâm dứa
  if (session === 'evening') {
    return (
      name.includes('trà chanh') ||
      name.includes('trà tắc') ||
      name.includes('sâm dứa') ||
      name.includes('trà sữa') ||
      name.includes('cà phê') ||
      name.includes('cafe') ||
      name.includes('nước mía') ||
      name.includes('trà xoài')
    );
  }

  // 5. CÚ ĐÊM KTX (21:30 - 05:00): Trà chanh 1L vỉa hè chém gió đêm, trà quất, cafe đêm tỉnh ngủ, nước mía
  if (session === 'night') {
    return (
      name.includes('trà chanh') ||
      name.includes('trà tắc') ||
      name.includes('cà phê') ||
      name.includes('cafe') ||
      name.includes('nước mía') ||
      name.includes('trà sữa')
    );
  }

  return true;
}

/**
 * LỌC MÓN NHẬU THEO KHUNG GIỜ ("Hôm Nay Nhậu Gì")
 * Buổi sáng: Món lai rai nhẹ, không lẩu nướng nặng hay bia hơi sáng sớm
 * Buổi trưa: Lẩu bò nhúng khế, lẩu trâu, gà hấp lá chanh, cá lăng nướng, bia hơi tiếp khách
 * Buổi chiều: Lai rai xế: ốc hương trứng muối, ốc mít mắm gừng, chân gà sốt Thái, cánh gà chiên mắm
 * Buổi tối: 100% tất cả món nhậu bàn tiệc lẩu nướng tối
 * Cú đêm KTX: Ốc đêm, chân gà, hàu nướng, tóp mỡ, nem chua rán, bia hơi đêm
 */
export function isNhauSuitableForSession(food: Food, session: MealSession): boolean {
  if (session === 'all') return true;

  const name = food.name.toLowerCase();

  // 1. BUỔI SÁNG (05:00 - 10:00): Không mở tiệc lẩu nướng bia bọt sáng
  if (session === 'morning') {
    if (
      name.includes('lẩu') ||
      name.includes('nướng') ||
      name.includes('combo') ||
      name.includes('bia') ||
      name.includes('ốc') ||
      name.includes('hàu') ||
      name.includes('mực nhảy') ||
      name.includes('mẹt gà') ||
      name.includes('mẹt lợn') ||
      name.includes('trâu cháy') ||
      name.includes('má đào') ||
      name.includes('tóp mỡ')
    ) {
      return false;
    }
    return (
      name.includes('nộm') ||
      name.includes('chim câu quay') ||
      name.includes('ngô nếp') ||
      name.includes('xôi chim') ||
      name.includes('gà ta hấp')
    );
  }

  // 2. BUỔI TRƯA (10:00 - 14:00): Tiệc liên hoan trưa & tiếp khách
  if (session === 'noon') {
    return (
      name.includes('lẩu bò nhúng khế') ||
      name.includes('lẩu riêu cua') ||
      name.includes('lẩu cá tầm') ||
      name.includes('trâu') ||
      name.includes('gà') ||
      name.includes('cá lăng') ||
      name.includes('chim câu') ||
      name.includes('mẹt') ||
      name.includes('lợn mán') ||
      name.includes('nộm') ||
      name.includes('cánh gà') ||
      name.includes('má đào') ||
      name.includes('tóp mỡ') ||
      name.includes('bia') ||
      name.includes('ba chỉ')
    );
  }

  // 3. BUỔI CHIỀU (14:00 - 17:30): Lai rai xế chiều nhẹ nhàng
  if (session === 'afternoon') {
    return (
      name.includes('ốc') ||
      name.includes('hàu') ||
      name.includes('chân gà') ||
      name.includes('cánh gà') ||
      name.includes('gỏi') ||
      name.includes('nộm') ||
      name.includes('ngô nếp') ||
      name.includes('chim câu') ||
      name.includes('tóp mỡ') ||
      name.includes('má đào') ||
      name.includes('ba chỉ')
    );
  }

  // 4. BUỔI TỐI (17:30 - 21:30): 100% full bàn tiệc lẩu nướng & nhậu tối
  if (session === 'evening') {
    return true;
  }

  // 5. CÚ ĐÊM KTX (21:30 - 05:00): Lai rai nhậu đêm: ốc, chân gà, hàu, mực nướng, tóp mỡ, nem chua rán, bia hơi đêm
  if (session === 'night') {
    return (
      name.includes('ốc') ||
      name.includes('hàu') ||
      name.includes('chân gà') ||
      name.includes('cánh gà') ||
      name.includes('tóp mỡ') ||
      name.includes('nem chua rán') ||
      name.includes('nem lụi') ||
      name.includes('mực') ||
      name.includes('nướng') ||
      name.includes('nộm') ||
      name.includes('bia')
    );
  }

  return true;
}

/**
 * LỌC QUÁN ĂN THEO KHUNG GIỜ ("Chọn Quán")
 * Khớp chuẩn giờ mở cửa & phong cách quán thực tế tại Phường Xuân Hòa
 */
export function isPlaceSuitableForSession(place: Place, session: MealSession): boolean {
  if (session === 'all') return true;

  // 1. BUỔI SÁNG (05:00 - 10:00): Chỉ hiển thị quán phục vụ ăn sáng & cà phê sáng
  if (session === 'morning') {
    const morningExcludedIds = [
      'cuon-moc-xuan-hoa',
      'beef88-xuan-hoa',
      'xuho-bistro',
      'quan-oc-ngon',
      'lau-nuong-ba-muoi',
      'trau-phi-xuyen',
      'trau-gio-dong',
      'lon-ga-xuyen-phi',
      'trang-hai-san',
      'lau-cuong-duong',
      'nha-hang-khanh-huong',
      'nha-hang-binh-nam',
      'nha-hang-468',
      'quan-chim-lan-anh',
      'my-cay-seoul',
      'ruby-quan',
      'xoai-corner',
      'tho-coii',
      'tiem-me-soc',
      'com-rang-nguyen-van-linh',
      'com-tam-xuan-hoa',
      'bun-cha-xuan-hoa',
    ];
    if (morningExcludedIds.includes(place.id)) return false;

    return Boolean(
      place.mealSessions?.includes('morning') ||
      place.id === 'pho-bo-xuan-hoa' ||
      place.id === 'banh-cuon-ngoc-anh' ||
      place.id === 'bun-rieu-ba-mai' ||
      place.id === 'bun-anh-toan' ||
      place.id === 'banh-mi-bo-u' ||
      place.id === 'thuy-beo' ||
      place.id === 'sui-cao-tieu-lau-quan' ||
      place.id === 'cafe-1975-xuan-hoa' ||
      place.id === 'tiem-tra-thanh-thanh'
    );
  }

  // 2. BUỔI TRƯA (10:00 - 14:00): Các quán mở bán cơm, bún, cuốn, lẩu trưa
  if (session === 'noon') {
    return Boolean(
      place.mealSessions?.includes('lunch') ||
      place.category === 'restaurant' ||
      place.category === 'fast_food'
    );
  }

  // 3. BUỔI CHIỀU (14:00 - 17:30): Quán ăn vặt, trà sữa, bánh mì, ốc xế
  if (session === 'afternoon') {
    return Boolean(
      place.mealSessions?.includes('afternoon') ||
      place.mealSessions?.includes('drink') ||
      place.category === 'cafe'
    );
  }

  // 4. BUỔI TỐI (17:30 - 21:30): Quán lẩu nướng, quán nhậu, nhà hàng tối
  if (session === 'evening') {
    return Boolean(
      place.mealSessions?.includes('dinner') ||
      place.category === 'pub' ||
      place.category === 'restaurant'
    );
  }

  // 5. CÚ ĐÊM KTX (21:30 - 05:00): Quán mở đêm, quán ốc, cháo đêm, quán ship đêm tận sảnh KTX
  if (session === 'night') {
    return Boolean(
      place.mealSessions?.includes('late') ||
      place.id === 'com-rang-nguyen-van-linh' ||
      place.id === 'com-rang-dua-bo-68' ||
      place.id === 'beef88-xuan-hoa' ||
      place.id === 'quan-oc-ngon' ||
      place.id === 'tiem-tra-chanh-1l-xuan-hoa' ||
      place.id === 'tiem-tra-thanh-thanh'
    );
  }

  return true;
}
