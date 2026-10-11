import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Chuẩn hóa ngắt dòng typographic tiếng Việt, triệt tiêu lỗi rớt từ cụt ngủn (orphan/widow)
 * Giữ nguyên các cụm danh từ riêng như 'Cô Hiền', 'Bà Thu', 'Mr Tea', 'Lê La'...
 * và liên kết từ cuối cùng của tiêu đề với từ liền trước bằng non-breaking space (\u00A0)
 */
export function formatTypography(text?: string): string {
  if (!text || typeof text !== 'string') return text || '';
  
  // 1. Bảo vệ các cụm từ riêng / tên quán Xuân Hòa không bao giờ bị đứt đôi
  let s = text
    .replace(/\b(Cô)\s+(Hiền)\b/gi, '$1\u00A0$2')
    .replace(/\b(Bà)\s+(Thu)\b/gi, '$1\u00A0$2')
    .replace(/\b(Chị)\s+(Béo)\b/gi, '$1\u00A0$2')
    .replace(/\b(Mẹ)\s+(Tít|Sóc)\b/gi, '$1\u00A0$2')
    .replace(/\b(Mr)\s+(Tea)\b/gi, '$1\u00A0$2')
    .replace(/\b(Lê)\s+(La)\b/gi, '$1\u00A0$2')
    .replace(/\b(Dủ)\s+(Dẻ)\b/gi, '$1\u00A0$2')
    .replace(/\b(Xuân)\s+(Hòa)\b/gi, '$1\u00A0$2')
    .replace(/\b(Bảo)\s+(Châu)\b/gi, '$1\u00A0$2')
    .replace(/\b(Thủy)\s+(Béo)\b/gi, '$1\u00A0$2')
    .replace(/\b(Thọ)\s+(Còi)\b/gi, '$1\u00A0$2')
    .replace(/\b(Kim)\s+(Ngọc)\b/gi, '$1\u00A0$2')
    .replace(/\b(Hà)\s+(Khẩu)\b/gi, '$1\u00A0$2')
    .replace(/\b(Nguyễn)\s+(Văn)\s+(Linh)\b/gi, '$1\u00A0$2\u00A0$3')
    .replace(/\b(Trường)\s+(Chinh)\b/gi, '$1\u00A0$2');

  // 2. Chống rớt chữ cuối dòng (typographic widow prevention) cho tiêu đề / tên ngắn
  if (s.length < 50 && !/[)\]>•]$/.test(s)) {
    s = s.replace(/(\s+)([^\s]+)$/, '\u00A0$2');
  }

  return s;
}

/**
 * Phân loại món ăn ngắn gọn, thanh lịch (chuẩn phong cách Trưa Nay Ăn Gì)
 * Ví dụ: 'Bún, phở & mì', 'Cơm & xôi', 'Lẩu & cháo', 'Bánh mì & cuốn', 'Nướng & chiên', 'Ăn vặt & tráng miệng', 'Đồ uống & trà'...
 */
export function getFoodCategoryLabel(food: { name: string; sub?: string; kind?: string; category?: string }): string {
  const name = (food.name || '').toLowerCase();
  
  if (name.includes('bún') || name.includes('phở') || name.includes('mì') || name.includes('mỳ') || name.includes('miến') || name.includes('hủ tiếu') || name.includes('bánh đa')) {
    return 'Bún, phở & mì';
  }
  if (name.includes('cơm') || name.includes('xôi')) {
    return 'Cơm & xôi';
  }
  if (name.includes('cháo') || name.includes('lẩu') || name.includes('súp')) {
    return 'Lẩu & cháo';
  }
  if (name.includes('bánh mì') || name.includes('bánh mỳ') || name.includes('cuốn') || name.includes('kimbap') || name.includes('bánh xèo') || name.includes('bánh hỏi') || name.includes('bánh bao') || name.includes('burger')) {
    return 'Bánh mì & cuốn';
  }
  if (name.includes('nướng') || name.includes('chiên') || name.includes('bbq') || name.includes('quay') || name.includes('rán')) {
    if (name.includes('nem chua rán') || name.includes('khoai tây')) return 'Ăn vặt & tráng miệng';
    return 'Nướng & chiên';
  }
  if (name.includes('trà') || name.includes('cà phê') || name.includes('cafe') || name.includes('sinh tố') || name.includes('nước ép') || name.includes('soda') || name.includes(' ép') || name.includes('sữa') || name.includes('milo') || name.includes('latte') || name.includes('matcha')) {
    return 'Đồ uống & trà';
  }
  if (name.includes('bia') || name.includes('nhậu') || name.includes('rượu')) {
    return 'Bia & mồi nhậu';
  }
  if (name.includes('ốc') || name.includes('hải sản') || name.includes('hàu') || name.includes('tôm') || name.includes('mực') || name.includes('càng ghẹ')) {
    return 'Ốc & hải sản';
  }
  if (name.includes('chè') || name.includes('kem') || name.includes('khoai') || name.includes('bánh gà') || name.includes('tokbokki') || name.includes('tào phớ') || name.includes('nem chua') || name.includes('sữa chua') || name.includes('caramen') || name.includes('bánh ngọt') || name.includes('gateaux') || name.includes('xúc xích') || name.includes('xiên que')) {
    return 'Ăn vặt & tráng miệng';
  }
  if (name.includes('chân gà') || name.includes('cánh gà') || name.includes('dồi sụn') || name.includes('tóp mỡ') || name.includes('tai heo') || name.includes('má đào')) {
    return 'Món nhậu & lai rai';
  }
  if (name.includes('salad') || name.includes('nộm') || name.includes('gỏi')) {
    return 'Salad & món nhẹ';
  }
  if (name.includes('pizza') || name.includes('pasta') || name.includes('spaghetti')) {
    return 'Pizza & pasta';
  }
  if (food.kind) return food.kind;
  return 'Món ngon Xuân Hòa';
}

const SHOP_NAMES_TO_STRIP = [
  'Canteen Kí Túc Xá Sư Phạm 2', 'Canteen Kí Túc Xá SP2', 'Canteen KTX Sư Phạm 2', 'Canteen KTX SP2',
  'Canteen Kí Túc Xá', 'Canteen KTX', 'Canteen SP2', 'Canteen ĐHSP2', 'Canteen',
  'Tiệm Cơm Nhà Lê Huyền', 'Tiệm Nhà Lê Huyền', 'Tiệm Lê Huyền', 'Lê Huyền',
  'Xiên Nướng Trung Hoa Bá Thiện 2', 'Xiên Nướng Trung Hoa',
  'Bia Sài Gòn Tuấn Hiền', 'Bia Tuấn Hiền', 'Tuấn Hiền',
  'Nhà Hàng Sân Bia 247', 'Sân Bia 247',
  'Thanh Hằng Gateaux 16 Kim Ngọc', 'Thanh Hằng Gateaux', 'Thành Hằng', 'Thanh Hằng',
  'Tiệm Bánh A Salty Name', 'A Salty Name',
  'Tiệm Lan Phương', 'Lan Phương',
  'Bánh Mì Ngọc Quý', 'Ngọc Quý',
  'Vành Đai Quán', 'Vành Đai',
  'Quán Ốc 2000 Số 3 Kim Ngọc', 'Quán Ốc 2000', 'Quán Ốc Ngon Dốc Chợ', 'Ốc 2000',
  'Nhung\'s Corner', 'Nhung’s Corner', 'Nhung\'s',
  'Quán Bà Thu', 'Bà Thụ', 'Bà Thu', 'Bà Mai', 'Bà Thơ', 'Bà Mười',
  'Quán Chim Lan Anh', 'Lan Anh',
  'Quán Cát Tiên', 'Cát Tiên',
  'Tiệm Mẹ Tít', 'Mẹ Tít',
  'Tiệm Mẹ Sóc', 'Mẹ Sóc',
  'Tiệm Nhà Mẹ Béo', 'Chị Béo', 'Mẹ Béo',
  'Tiểu Lầu Quán', 'Tiểu Lầu',
  'Quán Nhật Hạ', 'Nhật Hạ',
  'Chè Xuân Mai', 'Xuân Mai',
  'Bún Anh Toàn', 'Anh Toàn',
  'Bếp Thanh',
  'Bảo Châu (122 Trường Chinh)', 'Bảo Châu',
  'Thọ Còi', 'Thơ Còii', 'Thơ Còi',
  'Hải Đăng',
  'Gamitra',
  'Beef88 Lê Quang Đạo', 'Beef88', 'Beef 88',
  'Quán GoKy', 'GoKy', 'Goky',
  'ZIAN', 'Zian',
  'Mr Tea Food & Drink', 'Mr Tea', 'Mr. Tea',
  'Đậu Ơi',
  'Vũ Quỳnh Chi',
  'Thi Lan Tea',
  'Hùng Thu',
  'Quán Win',
  'Lẩu Nướng 1968', '1968',
  'Quán Bánh Tráng 55 Nguyễn Văn Linh', 'Quán Bánh Tráng 55', 'Quán 55 Nguyễn Văn Linh', '55 Nguyễn Văn Linh', '55 NVL',
  'Trạm Dủ Dẻ Chạm', 'Trạm Dủ Dẻ', 'Dủ Dẻ Chạm', 'Dủ Dẻ',
  'Cuốn Mộc',
  'Xoài Corner',
  'Phi Xuyên', 'Gió Đồng',
  'S.OH Tea', 'S.OH',
  'Seoul HH',
  'Khanh Hương',
  'Lẩu Cường Dương', 'Cường Dương',
  'Cô Hiền',
  'Quán Dừa Khả Do', 'Dừa Khả Do',
  'Bún Bò Huế 102 Nguyễn Văn Linh', '102 Nguyễn Văn Linh', '102 NVL',
  'Cơm 68',
  'Cơm Tấm 82',
  '1975 Cà Phê', 'Cafe 1975'
].sort((a, b) => b.length - a.length);

/**
 * Tinh giản 100% tên món ăn: loại bỏ hoàn toàn tên quán, địa chỉ dính kèm để tên món ngắn gọn, tinh tế
 */
export function cleanDishDisplayTitle(name: string): string {
  if (!name) return '';
  let res = name;

  // Xử lý tiền tố đặc biệt
  if (/^Bơ Ú\s+/i.test(res)) {
    res = res.replace(/^Bơ Ú\s+/i, 'Bánh mì ');
  }

  // Loại bỏ hậu tố thương hiệu ở cuối
  res = res.replace(/\s+RUBY\s*$/i, '');
  res = res.replace(/Lẩu xiên que KTX/gi, 'Lẩu xiên que');
  res = res.replace(/\s*\(122 Trường Chinh\)/gi, '');
  res = res.replace(/\s+16 Kim Ngọc/gi, '');
  res = res.replace(/Trà Dủ Dẻ đặc biệt/gi, 'Trà đặc biệt');

  // Loại bỏ từng tên quán
  for (const shop of SHOP_NAMES_TO_STRIP) {
    const escaped = shop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s+|[-–—/•(])(${escaped})(?=$|\\s+|[-–—/•):])`, 'gi');
    res = res.replace(regex, (match, prefix) => (prefix === '(' ? '(' : ' '));
  }

  // Dọn dẹp khoảng trắng, dấu phân cách mồ côi
  res = res
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s*[-–—/•]\s*$/, '')
    .replace(/^\s*[-–—/•]\s*/, '')
    .replace(/\s+[-–—]\s+/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  res = res.replace(/\s+Quán\s*$/gi, '').trim();

  if (!res || res.length < 2) return name;
  return res;
}


