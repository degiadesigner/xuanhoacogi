import { Food } from './foods';

export interface SpotInfo {
  name: string;
  address: string;
  phone: string;
  mapsQuery: string;
  mapsUrl?: string;
  verified?: boolean;
  notes?: string;
  menuHighlights?: string[];
  serviceMode?: 'both' | 'delivery_only' | 'dine_in_only';
  deliveryNote?: string;
}

// Danh bạ quán thực tế tại Xuân Hòa theo từng nhóm món
export const xuanHoaSpots: Record<string, SpotInfo> = {
  // Lẩu Nướng 1968 (Buffet Nướng 134k & Bánh Mì Chảo - Quảng trường Con Chim Xanh)
  lau_nuong_1968: {
    name: 'Lẩu Nướng 1968 (Buffet Nướng 134k & Bánh Mì Chảo)',
    address: 'Quảng trường Con Chim Xanh (Cổng phụ đối diện 19 Kim Ngọc), P. Xuân Hòa',
    phone: '0855 222 212',
    mapsQuery: 'Quảng trường Con Chim Xanh Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship Bánh mì chảo nóng giòn, set nướng lẩu quanh Xuân Hòa · Hotline 0855 222 212',
    notes: 'Quán đối tác xác thực 2026 · Hotline 0855 222 212 · Địa chỉ: Quảng trường Con Chim Xanh (Cổng phụ đối diện 19 Kim Ngọc) · Nổi tiếng Buffet nướng 134k nướng chảo gang bơ thơm lừng ngập thịt bò tảng nầm nướng (+15k đồ uống không giới hạn), Bánh mì chảo đặc biệt 33k/xuất giòn rụm đẫm pate trứng ốp sốt đậm đà, combo nướng phomai kéo sợi, lẩu hải sản, lẩu ếch măng cay.',
    menuHighlights: [
      'Buffet nướng 134k: Bò tảng, nầm nướng, ba chỉ heo, ba chỉ cuộn nấm, bắp bò, sụn, mề gà, gà, dồi sụn, viên chiên, ngô khoai kim chi',
      'Bánh mì chảo đặc biệt 1968: 33.000đ/xuất (Pate béo ngậy, trứng ốp lòng đào, xúc xích, sốt đậm đà bánh mì giòn)',
      'Combo nướng chảo gang phomai: 189k - 289k - 389k',
      'Combo nướng chảo gang thường: 179k - 279k - 379k',
      'Lẩu hải sản / Lẩu thập cẩm: 300k - 400k - 500k',
      'Lẩu ếch măng cay: 185k - 285k - 385k',
      'Đồ uống buffet refill thả ga: +15k/người (Trà chanh, nước cam, Cocca, 7Up)'
    ]
  },

  // Lẩu Ngựa Tây Bắc (Đối tác ẩm thực Tây Bắc 2026 - Hotline 0963 047 022)
  lau_ngua_tay_bac: {
    name: 'Lẩu Ngựa Tây Bắc',
    address: 'Cách ban cơ yếu 951 đường Lê Duẩn miếu gỗ 200m, P. Xuân Hòa, TP. Phúc Yên, Vĩnh Phúc',
    phone: '0963 047 022',
    mapsQuery: 'Ban cơ yếu 951 Lê Duẩn Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ ăn tại quán (9h - 23h) & Nhận ship lẩu, mẹt ngựa, đồ nhậu tận nơi quanh Xuân Hòa · Hotline 0963 047 022',
    notes: 'Quán đặc sản Lẩu Ngựa Tây Bắc nức tiếng Xuân Hòa · Hotline 0963 047 022 · Giờ mở cửa: 09:00 - 23:00 tất cả các ngày trong tuần · Địa chỉ: Cách ban cơ yếu 951 đường Lê Duẩn miếu gỗ 200m, Xuân Hòa · Đầy đủ 19 món đặc sản ngựa: Ngựa nướng bản gang, nướng than hoa, nướng tảng, chao tỏi, xào lăn, hấp, tái chanh, xào dấm, xào măng, lòng xào dứa, giò ngựa, nộm ngũ sắc, xôi, cháo, tiết canh, Lẩu ngựa thắng cố, Ngựa nhúng mẻ kèm Lẩu gà & Lẩu ếch tươi ngon.',
    menuHighlights: [
      'Ngựa nướng bản gang: 235.000đ (Bestseller)',
      'Lẩu ngựa thắng cố Tây Bắc: 350.000đ - 600.000đ',
      'Ngựa nhúng mẻ: 350.000đ - 600.000đ',
      'Ngựa nướng tảng / Nướng than hoa: 175.000đ',
      'Ngựa chao tỏi / Ngựa xào lăn / Ngựa hấp: 175.000đ',
      'Ngựa tái chanh / Xào dấm / Xào măng: 175.000đ',
      'Lòng xào dứa: 175.000đ | Giò ngựa: 85.000đ',
      'Nộm ngựa ngũ sắc: 135.000đ | Xôi ngựa: 105.000đ',
      'Cháo ngựa: 85.000đ | Tiết canh ngựa: 30.000đ',
      'Lẩu gà tươi thả đồi: 300.000đ | Lẩu ếch măng cay: 300.000đ'
    ]
  },

  // ZUN Food & Tea (Đường Lê Quang Đạo, Khu đô thị Xuân Hòa - Hotline 0392 716 756)
  zun_food_tea: {
    name: 'ZUN Food & Tea',
    address: 'Đường Lê Quang Đạo, Khu đô thị Xuân Hòa, P. Xuân Hòa, TP. Phúc Yên, Vĩnh Phúc',
    phone: '0392 716 756',
    mapsQuery: 'Khu đô thị Xuân Hòa Phúc Yên Vĩnh Phúc',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Ăn tại quán & Nhận ship đồ ăn vặt, mì cay, trà sữa quanh KĐT Xuân Hòa · Hotline 0392 716 756 (FB: Thuỳ Dung, Mì mang về +2k hộp/suất)',
    notes: 'Quán ăn vặt & trà sữa ZUN Food & Tea · Đường Lê Quang Đạo, KĐT Xuân Hòa · Hotline 0392 716 756 (FB: Thuỳ Dung) · Menu trọn gói 37 món: Mì tương đen 45k, Bánh đúc nóng 30k, Kimbap thường/chiên 25k-30k, Bún trộn xúc xích/lạp xưởng/nem nướng/bò 30k-45k, Cơm trộn trứng/thịt băm/bò 35k-49k, Mì cay 7 cấp độ xúc xích/sụn/bò/hải sản/thập cẩm 40k-55k, Khoai tây chiên/lắc phô mai, Nem chua rán, Trà đào cam sả, Trà xoài macchiato, Ô long kem cheese, Trà sữa trân châu, Cafe muối & Bạc xỉu.',
    menuHighlights: [
      'Mì tương đen: 45.000đ (Bestseller)',
      'Bánh đúc nóng: 30.000đ | Kimbap chiên giòn: 30.000đ',
      'Bún trộn bò: 45.000đ | Bún trộn nem nướng: 40.000đ | Bún trộn lạp xưởng: 35.000đ',
      'Cơm trộn bò trứng ốp: 49.000đ | Cơm trộn thịt băm trứng ốp: 43.000đ',
      'Mì cay thập cẩm: 55.000đ | Mì cay hải sản: 50.000đ | Mì cay bò/sụn: 45.000đ',
      'Khoai tây lắc phô mai: 30.000đ | Nem chua rán: 30.000đ',
      'Trà đào cam sả: 30.000đ | Trà xoài macchiato: 30.000đ | Ô long kem cheese: 30.000đ',
      'Hồng trà dừa nướng: 33.000đ | Sữa tươi trân châu đường đen: 30.000đ',
      'Cà phê muối: 30.000đ | Cà phê bạc xỉu: 30.000đ'
    ]
  },

  // Mỳ Gà Tần Linh Dương (Cạnh nhà nghỉ Q2, Lê Quang Đạo - Hotline 0961 564 396 · 0964 162 235)
  // Bếp Nhà Bống (Số 4A Ngõ 3 Phố Kim Đồng - Hotline 0812 516 606)
  bep_nha_bong: {
    name: 'Bếp Nhà Bống (Cơm Tấm Sườn Nướng)',
    address: 'Số 4A Ngõ 3 Phố Kim Đồng, P. Xuân Hòa, TP. Phúc Yên, Vĩnh Phúc',
    phone: '0812 516 606',
    mapsQuery: '4A Ngõ 3 Kim Đồng Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Ăn tại quán & Nhận ship Cơm tấm sườn nướng nóng hổi tận nơi quanh Xuân Hòa (10h-13h & 18h-20h) · Hotline 0812 516 606',
    notes: 'Quán Bếp Nhà Bống tại Số 4A Ngõ 3 Phố Kim Đồng, Xuân Hòa · Hotline 0812 516 606 · Giờ mở cửa: 10:00 - 13:00 và 18:00 - 20:00 · Khẩu hiệu: "Thấy là muốn - Nghĩ là thèm! Cơm Tấm Sườn Nướng chỉ 30k" · Menu đầy đủ: Cơm tấm sườn nướng 30k, Cơm tấm gà nướng má đùi 30k, Cơm tấm sườn bì 35k, Cơm tấm sườn chả trứng 35k, Cơm tấm sườn bì chả trứng 40k, Topping chả trứng/trứng ốp/bì 5k, Gà popcorn 35k, Cá mờm rim mắm tỏi 40k, Pate gan 40k, Thịt chưng mắm tép 50k, Trà chanh, Trà tắc, Trà đào, Tắc xí muội, Sữa chua, Sữa đậu.',
    menuHighlights: [
      'Cơm tấm sườn nướng than hoa: 30.000đ (Bestseller)',
      'Cơm tấm gà nướng má đùi: 30.000đ | Cơm tấm sườn bì: 35.000đ',
      'Cơm tấm sườn chả trứng: 35.000đ | Cơm tấm sườn bì chả trứng đặc biệt: 40.000đ',
      'Gà popcorn giòn rụm: 35.000đ | Cá mờm rim mắm tỏi: 40.000đ',
      'Thịt chưng mắm tép gia truyền: 50.000đ | Pate gan nhà làm: 40.000đ',
      'Tắc xí muội: 10.000đ | Trà tắc / Trà chanh / Trà đào: 10.000đ',
      'Sữa chua: 6.000đ | Sữa đậu nành: 8.000đ'
    ]
  },

  my_ga_tan_linh_duong: {
    name: 'Mỳ Gà Tần Linh Dương (Giáp Năm CS2)',
    address: 'Cạnh nhà nghỉ Q2, Đường Lê Quang Đạo, P. Xuân Hòa, TP. Phúc Yên, Vĩnh Phúc',
    phone: '0961 564 396 · 0964 162 235',
    mapsQuery: 'Lê Quang Đạo Xuân Hòa Phúc Yên Vĩnh Phúc',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Ăn tại quán & Nhận ship Mỳ gà tần, cháo chim câu, ốc đốt tận nơi quanh Xuân Hòa · Hotline 0961 564 396 · 0964 162 235',
    notes: 'Quán Mỳ Gà Tần Linh Dương (Giáp Năm Cơ Sở 2) cạnh nhà nghỉ Q2 đường Lê Quang Đạo · Hotline 0961 564 396 - 0964 162 235 · Giờ mở cửa: 06:00 - 23:00 hàng ngày · Đầy đủ 25 món: Mỳ gà tần 35k, Mỳ ốc 35k, Mỳ trứng non 35k, Mỳ kê gà 75k, Mỳ full topping 75k, Mỳ gà đen 100k, Mỳ full đặc biệt 110k, Cháo thịt sáng 20k, Cháo gà tần 40k, Cháo ốc 40k, Cháo gà đen 100k, Cháo chim câu 160k, Ốc tiết ngải 30k, Đùi gà tần 30k, Gà ác tần 90k, Chim câu tần 150k, Trứng non kê gà tần 70k, Trứng vịt lộn 8k, Trứng ngải cứu 10k, Trứng tiết ngải 15k, Trứng non tiết ngải 30k, Trứng rán ngải 30k, Trứng rán ốc 50k, Ốc đốt (Ốc, Kê, Trứng non) 120k, Trà quất 10k, Bia SaiGon 15k, Rượu ổi 30k.',
    menuHighlights: [
      'Mỳ gà tần ngải cứu thuốc bắc: 35.000đ (Bestseller)',
      'Mỳ trứng non / Mỳ ốc: 35.000đ | Mỳ kê gà / Mỳ full topping: 75.000đ',
      'Mỳ gà đen (gà ác tiềm): 100.000đ | Mỳ full đặc biệt: 110.000đ',
      'Cháo chim câu bồ câu: 160.000đ | Cháo gà đen: 100.000đ | Cháo gà tần: 40.000đ | Cháo thịt sáng: 20.000đ',
      'Ốc đốt giấy bạc (Ốc, Kê, Trứng non): 120.000đ',
      'Gà ác tần thuốc bắc nguyên con: 90.000đ | Chim câu tần: 150.000đ',
      'Đùi gà tần: 30.000đ | Ốc tiết ngải: 30.000đ | Trứng non kê gà tần: 70.000đ',
      'Trứng rán ốc: 50.000đ | Trứng rán ngải: 30.000đ | Trứng non tiết ngải: 30.000đ',
      'Trà quất: 10.000đ | Bia SaiGon: 15.000đ | Rượu ổi ngâm: 30.000đ'
    ]
  },

  // 1. Trà Sữa & Mì Cay Ăn Vặt RUBY (Đối tác xác thực 2026 - 14 Nguyễn Văn Linh)
  ruby_quan: {
    name: 'Trà Sữa & Mì Cay Ăn Vặt RUBY',
    address: '14 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0336 109 769',
    mapsQuery: '14 Nguyễn Văn Linh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship đồ ăn quanh Xuân Hòa (Freeship < 2km: XUHO, KTX, QUÂN SỰ) · Hotline 0336 109 769',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Hotline 0336 109 769 (Freeship < 2km: XUHO, KTX, QUÂN SỰ) · Đầy đủ mì cay 7 cấp độ, mì xào thập cẩm/bò, mì trộn xúc xích/cay, mẹt ăn vặt lớn nhỏ, nem tai giòn, viên chiên mắm tỏi, hồng trà sữa, trà măng cụt, trà sữa kem dừa nướng, cafe & sữa chua hoa quả.',
    menuHighlights: [
      'Mì cay thập cẩm / Mì cay bò (Cấp độ 0-7): 42.000đ',
      'Mì cay thanh cua: 40.000đ | Mì cay xúc xích/cá viên/chả mực: 32.000đ',
      'Mì xào thập cẩm: 42.000đ | Mì xào bò: 35.000đ | Mì xào xúc xích: 32.000đ',
      'Mì trộn cay bò: 35.000đ | Mì trộn cay: 32.000đ | Mì trộn xúc xích: 30.000đ',
      'Mẹt ăn vặt lớn: 100.000đ | Mẹt ăn vặt nhỏ: 50.000đ',
      'Viên chiên mắm tỏi: 40.000đ | Nem tai giòn: 45.000đ | Nem chua rán: 30.000đ',
      'Khoai tây lắc / Bánh gạo lắc: 25.000đ | Khoai lang kén: 25.000đ',
      'Dồi sụn: 15.000đ | Lạp xưởng nướng đá Hà Khẩu: 15.000đ',
      'Hồng trà sữa: 20k - 25k | Trà sữa kem dừa nướng: 25k - 30k',
      'Trà đào cam sả / Sen vàng: 22k - 27k | Trà măng cụt / Xoài kem mặn: 25k - 30k',
      'Cafe muối / Bạc xỉu / Cafe dừa non: 25.000đ | Matcha: 22k - 27k'
    ]
  },

  // 2. Tiệm Mẹ Tít - Xôi Cốm Sen Dừa & Trà Sữa (185 Nguyễn Văn Linh)
  xoi_com_185: {
    name: 'Tiệm Mẹ Tít - Xôi Cốm Sen Dừa & Trà Sữa',
    address: '185 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0343 475 672',
    mapsQuery: '185 Nguyễn Văn Linh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship xôi cốm lá sen nóng hổi, trà sữa cốm & trà tươi tận nơi 24/7 (Grab/ShopeeFood) · Hotline 0343 475 672',
    notes: 'Tiệm Mẹ Tít · 185 Nguyễn Văn Linh, P. Xuân Hòa · Hotline 0343 475 672 · Chủ nhân món đặc sản Xôi Cốm Sen Dừa gia truyền Xuân Hòa nức tiếng bọc lá sen 60k, kết hợp menu Trà & Trà Sữa hoa quả tươi 100% không dùng syrup hóa chất: Ôlong cốm yến mạch 40k, Cốm lá nếp 45k, Bơ già dừa non 40k, Cafe muối 30k, Việt quất lắc sữa 30k, Nước ép mix tươi 35k.',
    menuHighlights: [
      'Xôi cốm sen dừa hộp 250gr lá sen: 60.000đ (Đặc sản gia truyền)',
      'Ôlong cốm yến mạch: 40.000đ (Signature Trà sữa cốm)',
      'Cốm lá nếp: 45.000đ | Lục long: 35.000đ',
      'Bơ già dừa non: 40.000đ | Mây trắng lá nếp: 40.000đ',
      'Thanh nhài dẻ cười: 35.000đ | Trà mãng cầu chanh leo: 40.000đ',
      'Cafe muối béo ngậy: 30.000đ | Bạc xỉu: 30.000đ',
      'Việt quất lắc sữa / Sữa tươi caramel: 30.000đ',
      'Hồng trà sữa / Thái xanh sữa: 35.000đ',
      'Trà chanh nhài / Hồng trà kim quất: 15.000đ',
      'Nước ép tươi mix (Cam, carot, dứa, táo): 35.000đ'
    ]
  },

  // 3. S.OH Milk Tea Taiwan & Coffee (Đối tác xác thực 2026 - Ngõ 9 Nguyễn Văn Linh)
  soh_tea: {
    name: 'S.OH Milk Tea Taiwan & Coffee',
    address: 'Ngõ 9 Nguyễn Văn Linh (đối diện Winmart), P. Xuân Hòa',
    phone: '0987 054 322',
    mapsQuery: 'S.OH Tea Ngõ 9 Nguyễn Văn Linh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Freeship đơn đồ uống khu vực Xuân Hòa · Hotline 0987 054 322 - 0983 613 927',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Hotline 0987 054 322 - 0983 613 927 (Freeship Xuân Hòa) · Đầy đủ trà sữa kem bơ nướng Đài Loan, trà kem cheese, cà phê dừa dầm nướng, sinh tố bơ sáp, mỳ cay tokbokki phô mai & gà lắc.',
    menuHighlights: [
      'Trà sữa kem bơ nướng (Best Seller): 35.000đ',
      'Hồng trà sữa truyền thống Taiwan: 25.000đ',
      'Trà sáp kem dừa nướng / Lục trà quất quýt: 30.000đ',
      'Trà kem cheese (Hồng trà, Ô long lài, Matcha): 30.000đ - 35.000đ',
      'Cà phê sữa dừa dầm nướng / Bạc xỉu: 25.000đ - 35.000đ',
      'Sinh tố Bơ sáp / Xoài: 35.000đ | Trà hoa quả nhiệt đới: 35.000đ',
      'Mỳ cay Tokbokki phô mai / Mỳ cay bò, hải sản: 50.000đ - 55.000đ',
      'Gà lắc giòn / Nem chua rán đĩa to / Khoai lắc: 30.000đ - 35.000đ'
    ]
  },

  // 4. Bánh Mì Bơ Ú (Đối tác xác thực 2026 - Bánh mì & Ăn nhẹ)
  banh_mi_bo_u: {
    name: 'Bánh Mì Bơ Ú - Giòn Rụm Béo Thơm',
    address: '109 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0356 037 811',
    mapsQuery: '109 Nguyễn Văn Linh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship bánh mì nóng giòn tận nơi quanh Xuân Hòa',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Giòn rụm vỏ - Béo thơm bơ - Ngon khó cưỡng · Chuyên bánh mì bơ ú siêu thịt, heo quay xá xíu, heo quay gà xé, sốt bơ trứng vàng ươm & nước sốt gia truyền.',
    menuHighlights: [
      'Bơ Ú Siêu thịt (Best Seller): 50.000đ',
      'Bơ Ú Heo quay xá xíu (Signature): 45.000đ',
      'Bơ Ú Heo quay gà xé (Signature): 45.000đ',
      'Bơ Ú Xá xíu / Gà xé: 35.000đ',
      'Bơ Ú Pate bơ ruốc: 20.000đ',
      'Topping thêm: Bơ trứng (7k - 30k) | Pate Bơ Ú (8k - 30k)',
      'Hộp hành phi giòn / Nước sốt bơ Ú: 7.000đ - 8.000đ',
      'Trà chanh / Trà quất / Coca: 15.000đ | Trà sữa Đài Loan: 25.000đ'
    ]
  },

  // 5. Quán Bún Anh Toàn (Đối tác xác thực 2026 - Bún Bò & Cua Riêu)
  bun_anh_toan: {
    name: 'Quán Bún Anh Toàn - Bún Bò & Cua Riêu',
    address: 'Đối diện 11 Kim Ngọc, P. Xuân Hòa',
    phone: '0972 500 326',
    mapsQuery: 'Bún Anh Toàn 11 Kim Ngọc Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Có ship bún nóng tận nơi & phục vụ tại quán',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Ngon từ sợi bún - Đậm đà hương vị · Chuyên bún bò Huế, bún riêu thập cẩm, bún cua mọc bò & bún cá măng cay.',
    menuHighlights: [
      'Bún bò Huế / Bún bò chín / Tái: 35.000đ',
      'Bún riêu cua thập cẩm / Riêu đặc biệt: 30.000đ - 35.000đ',
      'Bún cua bò / Bún cua mọc: 30.000đ - 35.000đ',
      'Bún cá / Bún ốc mọc: 30.000đ',
      'Bún cua đậu bình dân: 25.000đ',
      'Bún trộn bò / Nem lụi Huế: 35.000đ',
      'Chả chan / Chả chấm thịt nướng: 30.000đ'
    ]
  },

  // 6. Bún Đậu & Nem Nướng Thơ Còii (Đối tác xác thực 2026)
  tho_coii: {
    name: 'Bún Đậu & Nem Nướng Thơ Còii',
    address: 'Khu vực ĐH Sư Phạm 2, P. Xuân Hòa',
    phone: '0989 294 963',
    mapsQuery: 'Bún Đậu Nem Nướng Thơ Còii Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship mẹt bún đậu, nem nướng tận nơi',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Đầy đủ mẹt bún đậu, nem nướng Nha Trang, đồ ăn vặt & nước uống.',
    menuHighlights: [
      'Bún đậu thập cẩm: 45.000đ',
      'Nem nướng Nha Trang: 35.000đ',
      'Bún đậu thường: 25.000đ',
      'Bún đậu chân giò/nem/dồi/chả cốm: 30.000đ',
      'Combo 2 người: 80.000đ | Combo đặc biệt: 100.000đ',
      'Nem chua rán: 30.000đ/đĩa | Trà chanh/quất: 10.000đ'
    ]
  },

  // 7. Quán Thúy Béo - Bánh Mì Sài Gòn & Trà Tắc (Đối tác xác thực 2026 - 122 Nguyễn Văn Linh)
  thuy_beo: {
    name: 'Quán Thúy Béo - Bánh Mì Sài Gòn & Trà Tắc',
    address: '122 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0398 877 486',
    mapsQuery: '122 Nguyễn Văn Linh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship bánh mì nóng giòn & trà tắc xí muội tận nơi quanh Xuân Hòa - Hotline: 0398 877 486',
    notes: 'Quán đối tác xác thực MinhTT 2026 · 122 Nguyễn Văn Linh · Bánh mì Sài Gòn đặc biệt, pate chả trứng, xá xíu, chả cá nóng ép vỉ & trà tắc xí muội giải nhiệt.',
    menuHighlights: [
      'Bánh mì Sài Gòn đặc biệt (pate chả trứng): 30.000đ',
      'Bánh mì chả cá nóng Sài Gòn ép vỉ: 25.000đ',
      'Bánh mì thịt nướng sả Sài Gòn: 30.000đ',
      'Bánh mì trứng ốp la pate bơ thơm: 20.000đ',
      'Trà tắc xí muội đá mát lạnh: 15.000đ'
    ]
  },

  // 8. Quán Ốc Ngon - Dốc Chợ Xuân Hòa (Đối tác xác thực 2026)
  quan_oc_ngon: {
    name: 'Quán Ốc Ngon - Dốc Chợ Xuân Hòa',
    address: 'Dốc Chợ Xuân Hòa, P. Xuân Hòa',
    phone: '0978 484 978',
    mapsQuery: 'Dốc Chợ Xuân Hòa Quán Ốc Ngon',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship ốc nóng, lẩu ốc & đồ nhậu đêm tận nơi',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Thiên đường ốc đồng, ốc mít, ốc hương sốt trứng muối hoàng kim, ốc móng tay, hàu nướng mỡ hành, lẩu ốc chua cay & đồ nướng nhậu đêm.',
    menuHighlights: [
      'Ốc hương sốt trứng muối / bơ tỏi / me cay: 120.000đ',
      'Ốc mít / nhồi hấp xả, hấp Thái, sốt bơ tỏi: 60.000đ',
      'Ốc móng tay hấp xả / xào rau muống bơ tỏi: 60.000đ',
      'Ốc đồng luộc xả / xào mắm gừng / xào cay: 35.000đ - 40.000đ',
      'Hàu ăn gỏi / nướng mỡ hành: 10.000đ/c | Nướng phô mai: 13.000đ/c',
      'Ngao hấp xả / hấp Thái chua cay / sốt trứng muối: 45.000đ - 50.000đ',
      'Đồ nướng: Mực nướng, bạch tuộc, càng ghẹ (120k) | Nầm lợn, ba chỉ (100k)',
      'Lẩu ốc chua cay / Lẩu Thái / Lẩu cháo thập cẩm: 250.000đ/nồi',
      'Chân cánh gà chiên mắm / rang muối: 15.000đ - 70.000đ'
    ]
  },

  // 8b. Quán Ốc 2000 - Số 3 Kim Ngọc (Đối tác xác thực 2026)
  oc_2000: {
    name: 'Quán Ốc 2000 - Ốc & Ăn Vặt Kim Ngọc',
    address: 'Số 3 Kim Ngọc, P. Xuân Hòa, Phú Thọ',
    phone: '0981 769 132',
    mapsQuery: 'Số 3 Kim Ngọc Xuân Hòa Quán Ốc 2000',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship ốc luộc, ốc xào me, ngao, chân gà & cơm mì quanh Xuân Hòa (11h sáng - 11h30 tối) · Hotline 0981 769 132',
    notes: 'Quán ốc xác thực MinhTT 2026 · Số 3 Kim Ngọc, P. Xuân Hòa, Phú Thọ · Hotline 0981 769 132 · Giờ mở cửa: 11:00 - 23:30 (11h sáng tới 11h30 tối) · Ăn thả ga không lo về giá · Đầy đủ ốc nhỏ, ốc mít xào me, ngao hấp thái, ốc hương trứng muối, hàu nướng phô mai, chân gà chiên mắm, cút xào me & cơm rang mì xào hải sản.',
    menuHighlights: [
      'Ốc mít xào me: 80.000đ (Best Seller số 1 Quán Ốc 2000)',
      'Ngao trắng hấp thái: 40.000đ (Best Seller)',
      'Ốc hương sốt trứng muối: 140.000đ (Best Seller hoàng kim)',
      'Hàu nướng phô mai: 12.000đ/con (Best Seller)',
      'Chân gà chiên mắm: 55.000đ/đĩa (Best Seller mồi nhậu)',
      'Cơm rang hải sản: 45.000đ (Best Seller no nê)',
      'Mì xào hải sản: 45.000đ (Best Seller)',
      'Ốc nhỏ hấp xả/thái (35k) | Xào me/cay (40k)',
      'Ốc mít hấp xả/thái: 70k | Ốc lẫn hấp: 50k',
      'Hàu nướng mỡ hành: 10k | Cháo hải sản: 35k',
      'Chân gà sả tắc / Sốt thái: 35k - 50k | Cút xào me: 45k'
    ]
  },

  // 8c. Bánh Mì Nướng Muối Ớt Ngọc Quý (Đối tác xác thực 2026 - 181 Nguyễn Văn Linh)
  bm_ngoc_quy: {
    name: 'Bánh Mì Nướng Muối Ớt Ngọc Quý',
    address: '181 Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0963 070 046',
    mapsQuery: '181 Nguyễn Văn Linh Xuân Hòa Bánh Mì Nướng Muối Ớt',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship Bánh mì nướng muối ớt, bánh tráng, trà chanh tận nơi quanh ĐHSP2 · Hotline 0963 070 046',
    notes: 'Quán đối tác xác thực 2026 · 181 Nguyễn Văn Linh, P. Xuân Hòa · Hotline 0963 070 046 · Wifi: Lan Hương (Pass: 0368.308.381) · Thiên đường ăn vặt sinh viên ĐHSP2: Bánh mì nướng muối ớt full topping 20k giòn rụm đẫm mỡ hành ruốc xúc xích trứng cút, bánh mì sốt bơ mật ong 10k, thịt xiên 12k, bánh tráng trộn 20k, bánh tráng cuộn 25k, đồ ăn vặt 10k-40k, trà trái cây 10k.',
    menuHighlights: [
      'Bánh mì nướng muối ớt (Full topping): 20.000đ (Best Seller số 1)',
      'Bánh mì nướng muối ớt thường: 15.000đ (Best Seller)',
      'Bánh mì sốt bơ mật ong: 10.000đ (Best Seller)',
      'Thịt xiên nướng than hoa: 12.000đ (Best Seller)',
      'Bánh tráng trộn bò khô trứng cút: 20.000đ (Best Seller)',
      'Bánh tráng cuộn sốt bơ: 25.000đ (Best Seller)',
      'Khoai tây lắc phomai (25k) | Khoai lang kén (20k)',
      'Nem chua rán (40k) | Khoai môn lệ phố (40k)',
      'Hotdog phomai (15k) | Phomai que (40k) | Bánh gà phomai (35k)',
      'Xúc xích (10k) | Lạp xưởng (15k) | Viên chiên (30k)',
      'Trà chanh / quất / đào / táo / dâu / vải / xoài: 10.000đ (Size to: 15.000đ)',
      'Cacao / Matcha sữa tươi: 20.000đ | Milo / Fami / Sữa đậu: 10.000đ'
    ]
  },

  // 8d. Quán Cát Tiên - Trà Bí Đao & Trà Sữa Nướng (82 Nguyễn Văn Linh)
  cat_tien: {
    name: 'Quán Cát Tiên - Trà Bí Đao & Trà Sữa Nướng',
    address: '82 Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0981 091 938',
    mapsQuery: '82 Nguyễn Văn Linh Xuân Hòa Trà Bí Đao Cát Tiên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship Trà bí đao, Trà sữa nướng, Tàu hũ tận nơi quanh ĐHSP2 · Hotline 0981 091 938',
    notes: 'Quán Cát Tiên - Tươi trẻ mỗi ngày · 82 Nguyễn Văn Linh, P. Xuân Hòa · Hotline 0981 091 938 · Thiên đường trà giải nhiệt sinh viên ĐHSP2: Trà sữa kem trứng dừa nướng 35k-40k, Trà bí đao hạt chia kem mặn 15k-25k, Trà hoa quả tươi 100% (Dưa lưới Cát Tiên, Dâu tây, Đào dầm), Tàu hũ kem trứng dừa nướng 35k, Socola bơ lạc & đầy đủ topping.',
    menuHighlights: [
      'Trà sữa kem trứng dừa nướng: 35.000đ - 40.000đ (Best Seller số 1)',
      'Trà bí đao Cát Tiên / Kem mặn: 25.000đ (Best Seller)',
      'Trà dưa lưới Cát Tiên hạt chia: 25.000đ (Best Seller hoa quả tươi)',
      'Trà dâu tây thạch thủy tinh: 28.000đ (Best Seller)',
      'Trà đào dầm thạch đào: 25.000đ (Best Seller)',
      'Tàu hũ kem trứng dừa nướng / socola: 35.000đ (Best Seller)',
      'Trà sữa trân châu đường đen: 28.000đ - 35.000đ',
      'Trà sữa kem cheese / Kem trứng nướng: 29.000đ - 35.000đ',
      'Trà bí đao hạt chia thạch sương sáo/lá nếp: 15.000đ - 20.000đ',
      'Tàu hũ trân châu đường đen: 25.000đ | Socola bơ lạc: 15.000đ - 25.000đ'
    ]
  },

  // 8e. Quán Thi Lan Tea - Bánh Mỳ & Ăn Vặt (Đầu ngõ Kim Ngọc)
  thi_lan_tea: {
    name: 'Quán Thi Lan Tea (Bánh Mỳ & Ăn Vặt)',
    address: 'Đầu ngõ Kim Ngọc, P. Xuân Hòa',
    phone: '0979 681 885',
    mapsQuery: 'Đầu ngõ Kim Ngọc Xuân Hòa Bánh Mỳ Thi Lan Tea',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship Bánh mỳ muối ớt sốt bơ vàng, thịt xiên nướng, bánh mỳ que tận nơi quanh Xuân Hòa · Hotline 0979 681 885',
    notes: 'Quán Thi Lan Tea · Đầu ngõ Kim Ngọc, P. Xuân Hòa · Hotline 0979 681 885 · Wifi: Thi Lan 6G (Pass: Camonquykhach) · Thiên đường ăn vặt nướng than hoa: Bánh mỳ muối ớt sốt bơ vàng 25k-35k đĩa đầy đặn thơm nức bơ béo ngậy, thịt xiên nướng than hoa 10k/xiên vàng óng đậm đà, bánh mỳ thập cẩm cắt 35k, bánh mỳ que Hải Phòng 40k/chục (4k/cái), bánh mỳ thịt nướng 15k, lạp xưởng nướng đá 15k, dồi sụn 10k, bánh mỳ bơ mật ong vàng ruốc 10k.',
    menuHighlights: [
      'Bánh mỳ muối ớt sốt bơ vàng: 25.000đ - 35.000đ (Best Seller số 1)',
      'Thịt xiên nướng than hoa: 10.000đ/xiên (Best Seller)',
      'Bánh mỳ thập cẩm cắt: 35.000đ/suất (Best Seller)',
      'Bánh mỳ que Hải Phòng: 40.000đ/chục (4.000đ/cái) (Best Seller)',
      'Bánh mỳ thịt nướng: 15.000đ (Best Seller)',
      'Lạp xưởng nướng đá: 15.000đ/cái (Best Seller)',
      'Bánh mỳ bơ mật ong vàng ruốc: 10.000đ',
      'Bánh mỳ xá xíu: 15.000đ | Bánh mỳ thịt bằm: 10.000đ',
      'Dồi sụn nướng: 10.000đ | Xúc xích nướng: 8.000đ - 12.000đ',
      'Bì nướng: 7.000đ | Bánh mỳ nướng: 6.000đ'
    ]
  },

  // 8f. Xiên Nướng Trung Hoa (KCN Bá Thiện 2, Bình Xuyên)
  xien_nuong_trung_hoa: {
    name: 'Xiên Nướng Trung Hoa (KCN Bá Thiện 2)',
    address: 'Khu công nghiệp Bá Thiện 2, Huyện Bình Xuyên, Tỉnh Vĩnh Phúc',
    phone: '0386 126 065',
    mapsQuery: 'Khu công nghiệp Bá Thiện 2 Bình Xuyên Vĩnh Phúc Xiên Nướng Trung Hoa',
    mapsUrl: 'https://maps.app.goo.gl/KeefsfcCKvvYCuMZA?g_st=ic',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship Xiên nướng Chuanr, hải sản nướng, nộm kiểu Trung tận nơi · Hotline 0386 126 065',
    notes: 'Xiên Nướng Trung Hoa · Hương vị Trung Hoa đậm đà khó quên · KCN Bá Thiện 2, Bình Xuyên, Vĩnh Phúc · Hotline 0386 126 065 · Wifi: Xiên Nướng Trung Hoa (Pass: 88888889) · Đại tiệc xiên nướng than hoa Chuanr thơm lừng cay tê: Xiên bò củ quả 25k, cánh gà nướng sốt cay 35k, mực nguyên con 35k, tuộc baby 25k, hàu nướng mỡ hành phô mai 15k, sườn lợn 30k, nộm cải thảo & đậu bắp kiểu Trung 30k, bia Trung Quốc & trà thảo mộc Vương Lão Cát.',
    menuHighlights: [
      'Xiên thịt bò củ quả (牛肉串): 25.000đ (Best Seller số 1)',
      'Cánh gà nướng sốt cay Trung Hoa: 35.000đ (Best Seller)',
      'Mực nguyên con nướng sa tế: 35.000đ (Best Seller)',
      'Tuộc baby / Tuộc sữa nguyên con: 25.000đ - 30.000đ (Best Seller)',
      'Hàu nướng mỡ hành phô mai: 15.000đ (Best Seller)',
      'Thịt ba chỉ nướng tê cay: 25.000đ | Sườn lợn nướng: 30.000đ',
      'Nộm cải thảo kiểu Trung: 30.000đ | Nộm đậu bắp kiểu Trung: 30.000đ',
      'Đậu nướng sốt cay: 15.000đ | Lạp xưởng nướng Trung Hoa: 15.000đ',
      'Chân giò nướng nguyên chiếc: 100.000đ',
      'Trà thảo mộc Trung (Vương Lão Cát / Gia Đa Bảo): 20.000đ',
      'Bia Trung Quốc: 20.000đ | Nước ngọt Khang Sư Phụ: 30.000đ'
    ]
  },

  // 8g. Chè Xuân Mai - Quán Chè Ngon Ít Ngọt 10k (35 Nguyễn Văn Linh)
  che_xuan_mai: {
    name: 'Chè Xuân Mai - Quán Chè Ngon Ít Ngọt',
    address: '35 Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0981 053 698',
    mapsQuery: '35 Nguyễn Văn Linh Xuân Hòa Chè Xuân Mai',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship chè mát lạnh, chè thập cẩm 10k tận nơi quanh ĐHSP2 · Hotline 0981 053 698',
    notes: 'Quán Chè Xuân Mai · Ngon - Ít Ngọt · 35 Nguyễn Văn Linh, P. Xuân Hòa · Hotline: 0981 053 698 · Chuyên các món chè truyền thống thanh mát chuẩn tiêu chí Ngon Ít Ngọt tốt cho sức khỏe giá chỉ từ 10k: Chè thập cẩm Xuân Mai 10k đầy đặn đỗ đỏ ngô ngọt thạch lá nếp cốt dừa béo ngậy, Chè bưởi An Giang giòn sần sật 10k-15k, Chè khoai dẻo dẻo quánh, Chè dừa dầm Hải Phòng 15k, Chè bơ cốt dừa, Chè sầu riêng thạch ngọc trai 20k.',
    menuHighlights: [
      'Chè thập cẩm Xuân Mai (Ngon Ít Ngọt): 10.000đ (Best Seller số 1)',
      'Chè bưởi An Giang cốt dừa: 10.000đ - 15.000đ (Best Seller)',
      'Chè khoai dẻo cốt dừa: 10.000đ - 15.000đ (Best Seller)',
      'Chè đậu đỏ cốt dừa: 10.000đ (Best Seller)',
      'Chè dừa dầm Hải Phòng: 15.000đ',
      'Chè ngô non cốt dừa: 10.000đ | Chè sương sáo hạt é: 10.000đ',
      'Chè bơ sáp cốt dừa: 15.000đ | Chè sầu riêng ngọc trai: 20.000đ',
      'Sữa chua thạch hoa quả dầm đá: 15.000đ',
      'Tào phớ thạch găng hạt sen: 10.000đ'
    ]
  },

  // 8h. Quán Nhật Hạ - Buffet Nem Nướng 19k (Số 9 Đồng Tâm)
  nhat_ha: {
    name: 'Quán Nhật Hạ - Buffet Nem Nướng',
    address: 'Số 9 Đồng Tâm, P. Xuân Hòa',
    phone: '',
    mapsQuery: 'Số 9 Đồng Tâm Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship mẹt nem nướng tận nơi quanh ĐHSP2 & KTX Xuân Hòa',
    notes: 'Quán Nhật Hạ · Số 9 Đồng Tâm, P. Xuân Hòa · Siêu phẩm Buffet Nem Nướng Nha Trang giá sinh viên thần thánh: Buffet nem nướng 19k khung giờ vàng (15h - 17h30), Buffet nem nướng 39k no căng rốn (17h31 - 23h). Đầy đủ nem nướng than hoa vàng rụm, ram chiên giòn, xoài non, dưa chuột, nộm chua, rau sống tươi xanh, bánh tráng, phở sợi và sốt chấm tương đậu gan nếp sánh béo ấm nóng.',
    menuHighlights: [
      'Buffet nem nướng giờ vàng sinh viên (15h - 17h30): 19.000đ (Best Seller số 1)',
      'Buffet nem nướng buổi tối no căng (17h31 - 23h): 39.000đ (Best Seller)',
      'Mẹt nem nướng Nha Trang gọi riêng: 35.000đ',
      'Ram bắp chiên giòn rụm gọi thêm: 15.000đ',
      'Xiên nem lụi nướng than hoa gọi thêm: 8.000đ/xiên',
      'Trà tắc nha đam / Trà đào mát lạnh: 10.000đ - 12.000đ'
    ]
  },

  // 8i. Quán Bia Sài Gòn Tuấn Hiền (Cổng chào Xuân Hòa)
  tuan_hien_beer: {
    name: 'Quán Bia Sài Gòn Tuấn Hiền',
    address: 'Cổng chào Xuân Hòa, Đ. Trường Chinh, P. Xuân Hòa',
    phone: '0876 914 333',
    mapsQuery: 'Cổng chào Xuân Hòa Trường Chinh Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Ship 24/7 freeship quanh Xuân Hòa, Phúc Yên · Hotline 0876 914 333 - 087 6714 222',
    notes: 'Quán Bia Sài Gòn Tuấn Hiền · Cổng chào Xuân Hòa (đường Trường Chinh) · Hotline 0876 914 333 - 087 6714 222 (Ship 24/7) · Chuyên bia hơi Sài Gòn mát lạnh và đại tiệc mồi nhậu bình dân: ba chỉ quay giòn bì, dồi sụn nướng than, nộm tai heo hoa chuối, lòng xào dưa, mực khô nướng, trâu gác bếp, cá chỉ vàng, đậu tẩm hành nóng giòn.',
    menuHighlights: [
      'Bia hơi Sài Gòn tươi mát: 15.000đ (Best Seller số 1)',
      'Ba chỉ quay giòn bì: 75.000đ (Best Seller)',
      'Dồi sụn nướng than hoa: 60.000đ (Best Seller)',
      'Nộm tai heo hoa chuối: 50.000đ (Best Seller)',
      'Lòng xào dưa chua: 60.000đ (Best Seller)',
      'Mực khô nướng than hoa / Thịt trâu gác bếp: 120.000đ - 150.000đ',
      'Đậu tẩm hành / Mướp đắng ruốc đá / Trứng rán lá mơ: 30.000đ - 35.000đ',
      'Vịt quay giòn da / Gà luộc nguyên con: 160.000đ - 180.000đ'
    ]
  },

  // 8j. Tiệm Bánh A Salty Name (Vòng tròn Xuho)
  a_salty_name_bakery: {
    name: 'Tiệm Bánh A Salty Name - Bento & Cheesecake',
    address: 'Vòng tròn Xuân Hòa, P. Xuân Hòa',
    phone: '0565 220 023',
    mapsQuery: 'Vòng tròn Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Trả bánh sau 17h30 ngày thường · Freeship bán kính 3km từ vòng tròn Xuho · Hotline 0565 220 023',
    notes: 'Tiệm Bánh A Salty Name · a salty name - a sweet bite · Vòng tròn Xuân Hòa · Hotline 0565 220 023 · Chuyên bánh Bento trang trí nghệ thuật, Lime & Oreo Cheesecake, Fudgy Brownie socola đậm đặc, bánh Whipping quả mọng và Chocomint.',
    menuHighlights: [
      'Oreo Cheesecake (Slide - Bento): 65.000đ - 140.000đ (Best Seller)',
      'Lime Cheesecake chanh thanh mát: 65.000đ - 140.000đ (Best Seller)',
      'Fudgy Brownie socola đậm đặc: 60.000đ (Best Seller)',
      'Bánh Whipping quả mọng: 65.000đ - 140.000đ (Best Seller)',
      'Chocomint bạc hà socola: 55.000đ - 130.000đ',
      'Bánh chuối double socola Bento: 55.000đ',
      'Trà Olong nhài nhãn thanh khiết: 65.000đ - 140.000đ'
    ]
  },

  // 8k. Thanh Hằng Gateaux (16 Kim Ngọc)
  thanh_hang_gateaux: {
    name: 'Thanh Hằng Gateaux - 16 Kim Ngọc',
    address: '16 Kim Ngọc, P. Xuân Hòa',
    phone: '0912 719 710',
    mapsQuery: '16 Kim Ngọc Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận đặt bánh sinh nhật theo yêu cầu & ship tận nơi Xuân Hòa · Hotline 0912 719 710',
    notes: 'Thanh Hằng Gateaux · Địa chỉ mới: 16 Kim Ngọc, P. Xuân Hòa · Hotline 0912 719 710 · Tiệm bánh ngọt & bánh sinh nhật cao cấp lâu năm uy tín: Bánh sinh nhật Gateaux trang trí hoa quả tươi và socola, Sweet Dessert Cheesecake, Mousse chanh dây, Tiramisu truyền thống, Bông lan trứng muối sốt phô mai.',
    menuHighlights: [
      'Bánh kem sinh nhật Gateaux Thanh Hằng: 150.000đ - 250.000đ (Best Seller)',
      'Sweet Dessert Cheesecake: 50.000đ (Best Seller)',
      'Bánh Mousse chanh dây hoa quả: 45.000đ',
      'Bánh Tiramisu truyền thống cacao: 50.000đ',
      'Bánh bông lan trứng muối phô mai: 65.000đ',
      'Bánh sừng bò Croissant bơ tỏi: 25.000đ',
      'Bánh Red Velvet kem cheese: 45.000đ'
    ]
  },

  // 8l. Quán Bánh Tráng 55 Nguyễn Văn Linh
  banh_trang_55_nvl: {
    name: 'Quán Bánh Tráng - 55 Nguyễn Văn Linh',
    address: '55 Nguyễn Văn Linh, P. Xuân Hòa',
    phone: 'Đang cập nhật',
    mapsQuery: '55 Nguyễn Văn Linh Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Bán tại quán & Ship tận nơi quanh Xuân Hòa từ 8h00 - 22h00',
    notes: 'Quán Bánh Tráng 55 Nguyễn Văn Linh · Mở bán từ 8h00 đến 22h00 · Chuyên các món bánh tráng Sài Gòn & Tây Ninh chuẩn vị: Bánh tráng cuộn bơ, bánh tráng trộn phơi sương tóp mỡ, bánh tráng nướng Đà Lạt, bánh tráng cuốn lòng đào, bánh tráng chấm muối kẹo ly, bắp xào tép bơ.',
    menuHighlights: [
      'Bánh tráng cuộn bơ: 25.000đ (Best Seller)',
      'Bánh tráng trộn PS tóp mỡ: 30.000đ (Best Seller)',
      'Bánh tráng nướng Đà Lạt: 25.000đ (Best Seller)',
      'Bánh tráng PS cuộn lòng đào: 30.000đ (Best Seller)',
      'Bánh tráng chấm muối kẹo ly: 25.000đ (Best Seller)',
      'Bánh tráng nướng phô mai: 30.000đ',
      'Bắp xào tép bơ / Bánh trứng cút nướng: 20.000đ - 25.000đ',
      'Trà tắc / Trà chanh mát lạnh: 10.000đ'
    ]
  },

  // 8m. Nhà Hàng Sân Bia 247 (78 Trường Chinh)
  san_bia_247: {
    name: 'Nhà Hàng Sân Bia 247',
    address: '78 Trường Chinh, P. Xuân Hòa',
    phone: '035.685.3456',
    mapsQuery: '78 Trường Chinh Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ bàn tiệc & Ship mồi nhậu, lẩu nướng tận nơi · Hotline 035.685.3456',
    notes: 'Nhà Hàng Sân Bia 247 · 78 Trường Chinh, P. Xuân Hòa · Hotline 035.685.3456 · Điểm hẹn liên hoan, nhậu lẩu đỉnh cao với bia tươi mát lạnh, má đào cháy tỏi bản gang, tháp sườn chua cay, nõn đuôi chiên móc mật, nem ngựa Bắc Giang, lẩu tôm bầu, tôm sông nướng than hoa.',
    menuHighlights: [
      'Má đào cháy tỏi bản gang: 129.000đ (Best Seller số 1)',
      'Tháp sườn chua cay khổng lồ: 179.000đ (Best Seller)',
      'Nõn đuôi chiên móc mật: 119.000đ (Best Seller)',
      'Nem ngựa (Đặc sản Bắc Giang): 89.000đ (Đặc sản)',
      'Tóp mỡ Triều Khúc xóc mắm tỏi: 119.000đ (Best Seller)',
      'Lẩu tôm bầu đặc sản: 599.000đ (Đặc sản)',
      'Lẩu Thái tôm rum chua cay: 399.000đ (Hay gọi)',
      'Tôm sông nướng than hoa: 179.000đ | Tràng trứng cháy tỏi: 119.000đ'
    ]
  },

  // 8n. Nhung's Corner (47 Kim Ngọc)
  nhungs_corner: {
    name: "Nhung's Corner - Mì Cay 7 Cấp Độ & Trà Sữa",
    address: '47 Kim Ngọc, P. Xuân Hòa',
    phone: '0984 377 721',
    mapsQuery: '47 Kim Ngọc Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Ăn tại quán & Nhận ship mì cay, trà sữa, cafe tận nơi quanh Xuân Hòa · Hotline 0984 377 721',
    notes: "Nhung's Corner · 47 Kim Ngọc, P. Xuân Hòa · Hotline 0984 377 721 · Ăn là ghiền - Uống là mê! Thiên đường mì cay 7 cấp độ niêu đất nóng hổi, tokbokki phô mai béo ngậy, matcha giòn Cold Whisk, trà sữa Hokkaido trân châu, cafe muối và trà hoa quả nhiệt đới tươi mát.",
    menuHighlights: [
      'Mì cay bò Mỹ chuẩn vị Hàn Quốc: 45.000đ (Bestseller)',
      'Mì cay hải sản tôm mực kim châm: 49.000đ (Bán chạy)',
      'Mì thập cẩm đặc biệt 7 cấp độ: 55.000đ',
      'Mì sụn giòn cay nồng: 39.000đ | Mì bò: 40.000đ',
      'Tokbokki chả cá phô mai dẻo dai: 40.000đ',
      'Cold Whisk (Matcha giòn) béo ngậy: 35.000đ (Must try)',
      'Trà sữa Hokkaido trân châu: 30.000đ (Bestseller)',
      'Matcha sữa dừa thơm béo: 25.000đ | Sinh tố bơ: 25.000đ',
      'Cafe muối kem béo sánh mịn: 25.000đ | Bạc xỉu: 25.000đ',
      'Sữa tươi trân châu đường đen: 35.000đ | Trà dâu: 25.000đ'
    ]
  },

  // 8o. Vành Đai Quán (Đường Lê Quang Đạo)
  vanh_dai_quan: {
    name: 'Vành Đai Quán - Đậm Mồi, Đậm Bia, Đậm Tình',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa',
    phone: '0977 828 405',
    mapsQuery: 'Đường Lê Quang Đạo Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ bàn tiệc tại quán & Nhận ship mồi nhậu, lẩu tận nơi · Hotline 0977 828 405',
    notes: 'Vành Đai Quán · Đường Lê Quang Đạo, P. Xuân Hòa · Hotline 0977 828 405 · Đậm Mồi - Đậm Bia - Đậm Tình! Điểm hẹn nhậu lẩu đỉnh cao với bia tháp 85k, má đào cháy tỏi, nầm heo cháy tiêu, tôm sốt trứng muối, ba chỉ chao giềng, lẩu riêu cua bắp bò & lẩu tôm bầu.',
    menuHighlights: [
      'Má đào cháy tỏi bản gang: 150.000đ (Best Seller số 1)',
      'Nầm heo cháy tiêu thơm lừng: 150.000đ (Best Seller)',
      'Tôm sốt trứng muối béo ngậy: 200.000đ (Best Seller)',
      'Ba chỉ chao giềng thơm giòn: 130.000đ (Best Seller)',
      'Ốc hương sốt trứng muối: 200.000đ (Đặc sản)',
      'Lẩu riêu cua bắp bò: 350.000đ (Đại tiệc lẩu)',
      'Lẩu tôm bầu thanh ngọt: 350.000đ (Đặc sản)',
      'Bia tháp tươi mát lạnh: 85.000đ/tháp | Bia cốc: 9k',
      'Nộm bò khế pháo: 150.000đ | Tóp mỡ dưa chua: 130.000đ'
    ]
  },

  // 8p. Tiệm Cơm Nhà Lê Huyền (Chân dốc KTX Sinh Viên - Nguyễn Văn Linh)
  tiem_le_huyen: {
    name: 'Tiệm Cơm Nhà Lê Huyền - Ngon Như Nhà, Ấm Như Tình Thân',
    address: 'Chân dốc KTX Sinh Viên, Đường Nguyễn Văn Linh, P. Xuân Hòa, TP. Phúc Yên, Vĩnh Phúc',
    phone: '0965 924 229',
    mapsQuery: 'Doc KTX Sinh Vien Nguyen Van Linh Xuan Hoa Phuc Yen',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Mở cửa 10:00 - 20:00 · Chân dốc KTX Sinh Viên, Nguyễn Văn Linh · Hotline 0965 924 229 · Phục vụ tại quán & Nhận ship quanh KTX sinh viên và toàn Xuân Hòa',
    notes: 'Tiệm Cơm Nhà Lê Huyền · Chân dốc KTX Sinh Viên, Đường Nguyễn Văn Linh, Xuân Hòa · Mở cửa 10h - 20h · Hotline 0965 924 229 · Ngon như nhà - Ấm như tình thân! Phục vụ cơm sườn chua ngọt 50k, cơm trứng thịt băm 45k, cơm trứng xúc xích 35k, kimbap chiên 30k, kimbap thường 25k, cơm nắm 10k, đồ ăn vặt & nước ép hoa quả tươi, soda mát lạnh.',
    menuHighlights: [
      'Cơm sườn chua ngọt: 50.000đ (Bestseller)',
      'Cơm trứng thịt băm rán: 45.000đ (Cơm nhà ấm bụng)',
      'Cơm trứng xúc xích sốt chua ngọt: 35.000đ (Bình dân)',
      'Kimbap chiên giòn rụm: 30.000đ (Bán chạy)',
      'Kimbap thường truyền thống: 25.000đ',
      'Cơm nắm: 10.000đ',
      'Khoai môn lệ phố: 40.000đ | Nem chua vỏ giòn: 40.000đ',
      'Khoai tây chiên: 35.000đ | Khoai tây lắc phômai: 35.000đ',
      'Xúc xích rán: 10.000đ/cái',
      'Nước ép hoa quả (Cam, Dưa hấu, Dứa, Cà rốt, Táo, Xoài): 20k (M) / 25k (L)',
      'Nước ép Mix (Cam Cà Rốt, Dứa Cam, Táo Dứa): 20k (M) / 25k (L)',
      'Soda hoa quả tươi (Dâu, Việt quất, Nho, Dưa lưới, Me, Dưa hấu, Đào): 10k (M) / 15k (L)',
      'Trà chanh / Trà quất Thái Xanh: 10k (M) / 15k (L)'
    ]
  },

  // 8q. Canteen Kí Túc Xá - Trung Tâm Nội Trú Sư Phạm 2 (Ngõ 10 Nguyễn Văn Linh)
  canteen_ktx_sp2: {
    name: 'Canteen Kí Túc Xá - Trung Tâm Nội Trú Sư Phạm 2',
    address: 'Trung tâm nội trú Sư phạm 2, Ngõ 10 Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0967 796 560',
    mapsQuery: 'Ngo 10 Nguyen Van Linh Xuan Hoa Phuc Yen',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại Canteen & Ship tận phòng KTX / lớp học · Hotline 0967 796 560 · Ngõ 10 Nguyễn Văn Linh',
    notes: 'Canteen Kí Túc Xá · Trung tâm nội trú Sư phạm 2, Ngõ 10 Nguyễn Văn Linh, P. Xuân Hòa · Hotline 0967 796 560 · "Đói thì ăn, nghĩ gì lâu! Ngon - Rẻ - Ăn xong lại thèm!" Chuyên mỳ cay xúc xích/bò/hải sản/thập cẩm 35k - 45k, mỳ trộn Indomie 25k, xiên que chiên mắm tỏi 20k - 50k, khoai tây lắc phômai 15k, lẩu xiên que KTX, trà đào 9k, trà bí đao 15k.',
    menuHighlights: [
      'Mỳ cay thập cẩm: 45.000đ (Bestseller)',
      'Mỳ cay bò / hải sản: 45.000đ | Mỳ cay xúc xích: 35.000đ',
      'Mỳ trộn Indomie: 25.000đ ("Trộn một phát, mê một đời!")',
      'Xiên que chiên mắm tỏi: 20k - 50k (Ngon xoắn lưỡi)',
      'Xiên que chiên tự chọn: 3k - 10k/xiên',
      'Khoai tây lắc phômai: 15.000đ',
      'Lẩu xiên que KTX: 3k - 10k/xiên (Nước súp đậm đà chuẩn vị KTX)',
      'Thêm cá viên lẩu: 10.000đ',
      'Trà đào mát lạnh: Chỉ từ 9.000đ',
      'Trà bí đao thanh nhiệt: Chỉ từ 15.000đ'
    ]
  },

  // 8r. Quán Dừa Khả Do (Số 18 Khả Do, P. Nam Viêm, TP. Phúc Yên)
  quan_dua_kha_do: {
    name: 'Quán Dừa Khả Do',
    address: 'Số 18 Khả Do, P. Nam Viêm, TP. Phúc Yên, Vĩnh Phúc',
    phone: '0378 457 263',
    mapsQuery: '18 Kha Do Nam Viem Phuc Yen Vinh Phuc',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship tận nơi quanh Phúc Yên & Xuân Hòa qua hotline 0378 457 263 · 13k/quả dừa tại quán, 15k/quả nếu ship',
    notes: 'Quán Dừa Khả Do · Số 18 Khả Do, Phúc Yên · Hotline 0378 457 263 · Chuyên dừa tươi ngọt lịm nguyên quả (13k/quả tại quán, 15k/quả nếu ship), trứng gà/trứng vịt tươi sạch (25k/10 quả) và bánh đa nướng giòn rụm bùi thơm (25k/2 chiếc).',
    menuHighlights: [
      'Dừa tươi nguyên quả: 13.000đ/quả (15.000đ/quả nếu ship)',
      'Trứng tươi sạch: 25.000đ / 10 quả (Trứng gà / trứng vịt tươi ngon)',
      'Bánh đa nướng: 25.000đ / 2 chiếc (Bánh đa nướng giòn thơm bùi ngậy)'
    ]
  },

  // 8s. Bún Bò Huế 102 Nguyễn Văn Linh
  bun_bo_hue_102: {
    name: 'Bún Bò Huế 102 Nguyễn Văn Linh',
    address: '102 Đường Nguyễn Văn Linh, P. Xuân Hòa, TP. Phúc Yên, Vĩnh Phúc',
    phone: '0358 299 789 - 0979 666 839',
    mapsQuery: '102 Nguyen Van Linh Xuan Hoa Phuc Yen Vinh Phuc',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Mở cửa: 07h-12h & 18h-20h · Phục vụ tại quán & Nhận ship quanh Xuân Hòa qua hotline 0358 299 789 - 0979 666 839',
    notes: 'Bún Bò Huế 102 Nguyễn Văn Linh · Hotline 0358 299 789 - 0979 666 839 · Mở cửa 7h-12h & 18h-20h · Nước dùng chuẩn vị Huế thơm lừng sả ruốc, ngọt thanh xương hầm. Đầy đặn móng giò, bò tái, nạm, chả cua, chả mọc, giò lụa, tiết.',
    menuHighlights: [
      'Bún bò Huế (Móng giò, chả cua, chả mọc, nạm, tiết): 40.000đ',
      'Bún bò Huế đặc biệt (Móng giò, bò tái, nạm, chả cua, chả mọc, tiết): 50.000đ (Bestseller)',
      'Bún bò Huế không móng (Nạm, chả cua, chả mọc, giò lụa, tiết): 35.000đ',
      'Bún bò chín (Chỉ bò chín): 35.000đ',
      'Bún bò tái (Chỉ bò tái mềm ngọt): 40.000đ',
      'Bún cua mọc (Chả cua, chả mọc, giò lụa): 35.000đ'
    ]
  },

  // 9. Nhà Hàng Thịt Trâu Gió Đồng (Đối tác ăn nhậu 2026)
  trau_gio_dong: {
    name: 'Nhà Hàng Thịt Trâu Gió Đồng',
    address: 'Số 9 Đường Trường Chinh, P. Xuân Hòa',
    phone: '0945 876 699',
    mapsQuery: 'Số 9 Trường Chinh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ ăn tại nhà hàng & nhận ship lẩu, món trâu chín tận nơi',
    notes: 'Quán đối tác ăn nhậu 2026 · Hotline 0945 876 699 · Số 9 Đường Trường Chinh, P. Xuân Hòa · Chuyên đặc sản thịt trâu tươi nướng tảng, trâu nhúng mẻ, bít tết trâu, trâu xào măng trúc, thắng cố, lẩu trâu & cá lăng, gà hấp.',
    menuHighlights: [
      'Trâu nướng tảng / Nướng khổ dày: 300.000đ',
      'Trâu nhúng mẻ (Signature): 237.000đ',
      'Bít tết trâu Gió Đồng: 196.000đ',
      'Trâu xào măng trúc: 185.000đ',
      'Thắng cố trâu: 85.000đ | Sốt vang trâu: 95.000đ',
      'Trâu tái chanh: 247.000đ | Trâu nướng lá lốt: 237.000đ',
      'Bắp trâu hấp / luộc: 195.000đ | Đuôi trâu hầm: 215.000đ',
      'Lẩu trâu thập cẩm: 720.000đ | Lẩu trâu nhúng mẻ: 770.000đ',
      'Gà hấp / rang muối / nướng (con)',
      'Cá lăng / Cá trắm giòn / Cá chép giòn (kg/con)',
      'Bia Tiger chai: 26.000đ | Bia Sài Gòn lon: 23.000đ'
    ]
  },

  // 10. Lẩu Nướng Bà Mười (Đối tác xác thực 2026 - Lẩu nướng sinh viên SP2)
  lau_nuong_ba_muoi: {
    name: 'Lẩu Nướng Bà Mười',
    address: 'Đối diện Cổng Hiệu Bộ ĐH Sư Phạm Hà Nội 2, P. Xuân Hòa',
    phone: '0967 652 522',
    mapsQuery: 'Lẩu Nướng Bà Mười Cổng Hiệu Bộ Sư Phạm 2 Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & nhận ship lẩu ếch măng cay, set nướng tận nơi',
    notes: 'Quán đối tác xác thực 2026 · Hotline 0967 652 522 · Slogan "Ngon Rẻ Nghĩ là mê!" · Nổi tiếng lẩu ếch măng cay, set nướng thập cẩm chảo gang, ếch rang muối, nầm nướng & đồ nhậu sinh viên.',
    menuHighlights: [
      'Lẩu ếch măng cay (Best Seller): 189.000đ - 289.000đ - 389.000đ',
      'Set nướng thập cẩm chảo gang: 169.000đ - 269.000đ - 369.000đ',
      'Lẩu Thái chua cay (189k - 389k) / Lẩu hải sản (219k - 419k)',
      'Ếch rang muối / chiên mắm / sốt me cay / xào chua ngọt: 110.000đ',
      'Nướng đĩa: 45k (Chân gà, cánh gà, sụn) - 65k - 95k (Ba chỉ, nầm heo, bò ta, tôm, mực, dạ dày)',
      'Nộm chân gà: 65.000đ | Nộm sứa: 60.000đ | Nộm củ quả: 55.000đ',
      'Chân gà / Cánh gà chiên mắm / rang muối: 100.000đ | Gà đĩa: 120.000đ',
      'Tôm / Mực hấp bia: 120.000đ | Đậu tẩm hành: 40.000đ | Nem chua: 45.000đ',
      'Rượu (Nếp, Mơ, Táo mèo, Ngô): 60.000đ/chai | Bia lon: 17.000đ | Trà quất/chanh: 10.000đ'
    ]
  },

  // Bún đậu Cổng Sau Sư Phạm 2
  bun_dau_sp2: {
    name: 'Bún Đậu Mẹt Cổng Sau SP2',
    address: 'Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0984 555 666',
    mapsQuery: 'Bún đậu cổng Sư Phạm 2 Nguyễn Văn Linh Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Nhận ship bún đậu quanh cổng trường SP2',
  },
  // Bún đậu Phố Nhỏ
  bun_dau_pho_nho: {
    name: 'Bún Đậu Phố Nhỏ Lê Quang Đạo',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa',
    phone: '0912 888 777',
    mapsQuery: 'Bún đậu Lê Quang Đạo Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Nhận ship mẹt bún đậu tận nơi',
  },
  // Bánh Mì Kebab Sư Phạm 2
  banh_mi_kebab_sp2: {
    name: 'Bánh Mì Kebab Cổng ĐH Sư Phạm 2',
    address: 'Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0987 654 321',
    mapsQuery: 'Bánh mì Doner Kebab Nguyễn Văn Linh Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Nhận ship bánh mì Kebab tận nơi',
  },
  // Ốc Đêm Hồ Đại Lải
  oc_dem_dai_lai: {
    name: 'Quán Ốc & Mồi Nhắm Đêm Ven Hồ Đại Lải',
    address: 'Đường ven Hồ Đại Lải, P. Xuân Hòa',
    phone: '0912 345 999',
    mapsQuery: 'Quán ốc Đại Lải Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Có nhận ship đồ nhắm & ốc đêm quanh hồ',
  },
  // Bò kho, bò né, chảo
  bo_kho_88: {
    name: 'Bò Né & Bánh Mì Chảo 88',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa',
    phone: '0915 234 567',
    mapsQuery: 'Bánh mì chảo bò sốt vang Lê Quang Đạo Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Nhận ship bò né & bánh mì chảo nóng hổi',
  },
  // Phở bò, bún, miến
  pho_bo_xuan_hoa: {
    name: 'Phở Bò Gia Truyền Phố Xuân Hòa',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa',
    phone: '0973 456 789',
    mapsQuery: 'Phở bò Lê Quang Đạo Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Nhận ship phở nóng đóng hộp giữ nhiệt',
  },
  // Cơm tấm, cơm rang, cơm suất
  com_68: {
    name: 'Cơm Suất & Cơm Rang Sinh Viên 68',
    address: '68 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0961 888 999',
    mapsQuery: 'Cơm sinh viên 68 Nguyễn Văn Linh Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Nhận ship cơm suất sinh viên tận nơi',
  },
  // Bún chả
  bun_cha_xuan_hoa: {
    name: 'Bún Chả Than Hoa Lê Quang Đạo',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa',
    phone: '0973 456 789',
    mapsQuery: 'Bún chả than hoa Lê Quang Đạo Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Nhận ship bún chả nóng tận nơi',
  },
  // Lẩu nướng, riêu cua
  lau_cuong_duong: {
    name: 'Lẩu Cường Dương - Lẩu Riêu Cua Bắp Bò',
    address: '58 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0979 555 888',
    mapsQuery: 'Lẩu Cường Dương 58 Nguyễn Văn Linh Xuân Hòa',
    serviceMode: 'both',
    deliveryNote: 'Nhận ship lẩu riêu cua bắp bò tận nhà',
  },
  // 11. Nhà Hàng Đặc Sản Thịt Trâu Phi Xuyên (Đối tác xác thực 2026)
  trau_phi_xuyen: {
    name: 'Nhà Hàng Đặc Sản Thịt Trâu Phi Xuyên',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa',
    phone: '0915 266 996',
    mapsQuery: 'Nhà Hàng Thịt Trâu Phi Xuyên Lê Quang Đạo Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ ăn tại nhà hàng & nhận ship món chín tận nơi',
    notes: 'Quán đối tác đặc sản thịt trâu nức tiếng Xuân Hòa · Hotline 0915 266 996 · Đường Lê Quang Đạo, P. Xuân Hòa · Chuyên đặc sản thịt trâu cháy tỏi, khấu nhục trâu, trâu nướng khổ dày, trâu nhúng mẻ, trâu xào răm tỏi, thắng cố, sốt vang & lẩu lòng trâu.',
    menuHighlights: [
      'Thịt trâu cháy tỏi: 200.000đ (Signature)',
      'Khấu nhục trâu: 180.000đ (Đặc sản gia truyền)',
      'Thịt trâu nướng khổ dày: 300.000đ - 400.000đ',
      'Trâu nhúng mẻ: 180.000đ | Lẩu nhúng mẻ: 600.000đ - 1.000.000đ',
      'Thịt trâu xào răm tỏi: 180.000đ | Trâu xào măng trúc: 170.000đ',
      'Thắng cố trâu: 100.000đ | Sốt vang trâu: 100.000đ',
      'Cuống tim xào / Xách xào: 200.000đ | Đuôi hầm: 190.000đ',
      'Lẩu lòng trâu: 500.000đ - 600.000đ | Lẩu thập cẩm: 600.000đ - 1.000.000đ',
      'Gà hấp / luộc / quay / rang muối',
      'Bia Hà Nội, Bia Sài Gòn, Bia Tiger, các loại rượu'
    ]
  },
  // 12. Nhà Hàng Lợn Gà Mẹt Xuyên Phi (Đối tác xác thực 2026)
  lon_ga_xuyen_phi: {
    name: 'Nhà Hàng Lợn Gà Mẹt Xuyên Phi',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa',
    phone: '0973 669 179',
    mapsQuery: 'Nhà Hàng Lợn Gà Mẹt Xuyên Phi Lê Quang Đạo Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại nhà hàng & nhận ship mẹt gà, mẹt lợn tận nơi',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Hotline 0973 669 179 · Đường Lê Quang Đạo, P. Xuân Hòa · Chuyên mẹt gà 7-9 món, mẹt lợn mán, mẹt gà lợn thập cẩm, gà nguyên con (không lối thoát, nướng than hoa, hấp lá chanh), lợn mán các món & gà chọi đủ món.',
    menuHighlights: [
      'Mẹt gà 7 món (Quay, hấp, rang muối, nộm, chiên giòn, chân gà chiên mắm, xôi): 600.000đ',
      'Mẹt gà 9 món (+ Gà xào sả ớt, lòng mề xào): 700.000đ',
      'Mẹt lợn mán (Nướng, hấp, xào, rang muối, lòng dồi, nhựa mận, xôi, canh, khoai): Từ 700k đến 1.000k',
      'Mẹt gà + lợn thập cẩm: Từ 700k đến 1.000k',
      'Gà không lối thoát (nguyên con): 450.000đ',
      'Gà nguyên con (Hấp lá chanh 260k, Nướng/Quay/Rang muối/Chiên mắm/Xào sả ớt/Xào gừng/Chua ngọt): 270.000đ',
      'Lợn mán các món: Mán nướng/hấp/xào/rang muối (150.000đ), Lòng dồi (120.000đ), Nhựa mận (120.000đ), Canh xương (60.000đ)',
      'Gà chọi đủ món (10 món chế biến theo yêu cầu): 260.000đ/kg',
      'Món đặt trước: Dê núi, Ba ba, Cá tầm, Cá lăng, Cá ngạnh'
    ]
  },

  // 13. Mỳ Cay Seoul HH (Đối tác xác thực 2026)
  my_cay_seoul: {
    name: 'Mỳ Cay Seoul HH',
    address: '48B Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0974 372 523',
    mapsQuery: 'Mỳ Cay Seoul 48B Nguyễn Văn Linh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship mỳ cay 7 cấp độ, tokbokki, gà bó lắc & lẩu tận nơi',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Hotline 0974 372 523 · 48B Nguyễn Văn Linh, P. Xuân Hòa · Chuyên mỳ kim chi, mỳ lẩu Thái 7 cấp độ, lẩu kim chi, lẩu Thái, gà bó lắc, tokbokki, cơm trộn & trà hoa quả giải nhiệt.',
    menuHighlights: [
      'Mỳ kim chi / Lẩu Thái thập cẩm (Cấp độ 0-7): 55.000đ',
      'Mỳ kim chi / Lẩu Thái bò Mỹ cuộn nấm kim châm: 55.000đ',
      'Mỳ kim chi / Lẩu Thái hải sản / sườn sụn / bò Mỹ: 50.000đ',
      'Mỳ kim chi / Lẩu Thái bạch tuộc tươi: 52.000đ',
      'Tokbokki phô mai kéo sợi / Tokbokki thập cẩm: 50.000đ',
      'Cơm trộn bò / gà / thập cẩm: 45.000đ - 50.000đ',
      'Gà bó lắc (Set 2 người 200k, Set 4 người 350k, Set 6 người 500k)',
      'Lẩu Thái / Lẩu kim chi gia đình: 230.000đ - 280.000đ',
      'Trà đào cam sả / Trà hoa quả / Quất lắc sữa: 25.000đ',
      'Rượu Soju Hàn Quốc: 65.000đ | Bia các loại: 20.000đ'
    ]
  },

  // 14. Nhà Hàng 468 - Cơ Sở Xuân Hòa (Đối tác xác thực 2026)
  nha_hang_468: {
    name: 'Nhà Hàng 468 - Cơ Sở Xuân Hòa',
    address: 'Đường Lê Quang Đạo (Vành Đai), P. Xuân Hòa',
    phone: '0866 999 468',
    mapsQuery: 'Nhà Hàng 468 Lê Quang Đạo Vành Đai Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship lẩu riêu cua bắp bò, lẩu tôm bầu, gà nướng lu & đồ nướng hấp tận nơi',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Hotline 0866.999.468 · Đường Lê Quang Đạo (Vành Đai), P. Xuân Hòa · Chuyên lẩu riêu cua bắp bò, lẩu tôm bầu, lẩu cá tầm, lẩu hải sản, gà nướng lu nguyên con, đồ nướng hấp & cơm canh gia đình.',
    menuHighlights: [
      'Lẩu riêu cua bắp bò: 400.000đ - 550.000đ (Best Seller)',
      'Lẩu tôm bầu (Đặc sản thanh ngọt): 550.000đ',
      'Lẩu hải sản / Lẩu Thái / Lẩu đuôi bò: 400.000đ - 550.000đ',
      'Lẩu cá tầm Sapa / Lẩu thập cẩm: 550.000đ',
      'Gà nướng lu da giòn (nguyên con): 190.000đ/con (Signature)',
      'Gà chiên mắm / rang muối / sốt chua ngọt / hấp: 190.000đ/con',
      'Mực nướng / hấp: 150.000đ | Cá tầm nướng sa tế: 200.000đ',
      'Nầm nướng / Bò nướng / Bạch tuộc nướng: 120.000đ/đĩa',
      'Mẹt lẩu cua / Mẹt hải sản gọi thêm: 300.000đ',
      'Bia Hà Nội / Bia Sài Gòn / Bia Ken chai / Tiger Bạc'
    ]
  },

  // Thỏ, gà đồi
  khanh_huong: {
    name: 'Nhà Hàng Khanh Hương - Thịt Thỏ & Gà Đồi',
    address: 'Gần trung tâm P. Xuân Hòa',
    phone: '0988 234 567',
    mapsQuery: 'Nhà hàng Khanh Hương Xuân Hòa',
    serviceMode: 'dine_in_only',
    deliveryNote: '🥢 Phục vụ trực tiếp tại nhà hàng',
  },
  // Thủy hải sản, lươn ếch đồng quê
  binh_nam: {
    name: 'Nhà Hàng Bình Năm - Lẩu & Thủy Hải Sản',
    address: 'Số 2 Đường Nguyễn Văn Linh (Khu Bách Hóa), P. Xuân Hòa',
    phone: '0913 289 123',
    mapsQuery: 'Nhà hàng Bình Năm số 2 Nguyễn Văn Linh Xuân Hòa',
  },
  // Quán nhậu, bia hơi đêm
  nhau_1993: {
    name: 'Quán Nhậu 1993 - KĐT Đồng Sơn',
    address: 'Khu đô thị Đồng Sơn, P. Xuân Hòa',
    phone: '0912 345 678',
    mapsQuery: 'Quán nhậu 1993 Đồng Sơn Xuân Hòa',
  },
  // Sủi cảo, mì vịt tiềm
  tieu_lau_quan: {
    name: 'Tiểu Lầu Quán - Sủi Cảo & Mì Vịt Tiềm',
    address: 'Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0975 666 333',
    mapsQuery: 'Tiểu Lầu Quán Nguyễn Văn Linh Xuân Hòa',
  },
  // Trà sữa TocoToco
  tocotoco: {
    name: 'TocoToco 206 Nguyễn Văn Linh',
    address: '206 Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0211 628 888',
    mapsQuery: 'TocoToco 206 Nguyễn Văn Linh Xuân Hòa',
  },
  // Cafe view hồ
  cafe_dai_lai: {
    name: 'Gió Đại Lải - Cafe & Check-in Hồ',
    address: 'Đường ven hồ Đại Lải, P. Xuân Hòa',
    phone: '0904 999 111',
    mapsQuery: 'Cafe hồ Đại Lải Xuân Hòa',
  },
  // Pizza, gà rán, burger
  pizza_fastfood: {
    name: 'Pizza & Burger Xuân Hòa',
    address: 'Đường Trường Chinh, P. Xuân Hòa',
    phone: '0989 112 233',
    mapsQuery: 'Pizza Trường Chinh Xuân Hòa',
  },
  // Thời trang
  fashion_360: {
    name: 'Tiệm Thời Trang Sinh Viên 360',
    address: 'Ngõ 8 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0981 777 666',
    mapsQuery: 'Shop thời trang Nguyễn Văn Linh Xuân Hòa',
  },

  // 13. Tiệm Mẹ Sóc - Bún Chả Nướng & Đồ Ăn Ship Tận Nơi
  tiem_me_soc: {
    name: 'Tiệm Mẹ Sóc - Bún Chả Nướng & Bếp Ship',
    address: 'Khu nội thị P. Xuân Hòa (Chuyên bếp ship)',
    phone: '0978 732 289',
    mapsQuery: 'Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'delivery_only',
    deliveryNote: 'Nhận ship bún chả & đồ ăn tận nơi quanh khu vực Xuân Hòa - Hotline: 0978 732 289',
    notes: 'Quán chuyên bán mang về & ship tận nơi. Bún chả nướng than hoa, nem rán giòn rụm, thịt xiên nướng than & trà tắc khổng lồ. Gọi là ship ngay!',
    menuHighlights: [
      'Bún chả nướng than hoa: 35.000đ (Suất chuẩn)',
      'Bún chả nướng đặc biệt: 45.000đ (Thêm nem + chả)',
      'Nem rán giòn rụm: 8.000đ/chiếc',
      'Thịt xiên nướng than: 10.000đ/xiên',
      'Trà tắc / Trà quất khổng lồ: 12.000đ/cốc'
    ]
  },

  // 14. Nhà Hàng Trang Hải Sản - Lẩu & Hải Sản Tươi Sống
  trang_hai_san: {
    name: 'Nhà Hàng Trang Hải Sản',
    address: 'Khu Đô Thị Sinh Viên (ngay Đồn Công An), P. Xuân Hòa',
    phone: '0982 620 678',
    mapsQuery: 'Khu Đô Thị Sinh Viên Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship lẩu hải sản, hải sản tươi sống chế biến tận nơi & phục vụ tại bàn',
    notes: 'Nhà hàng hải sản tươi sống uy tín Xuân Hòa · Chuyên các combo lẩu cua đồng/Thái, tôm sú bơi bể, cua Cà Mau, mực ống, cá tầm, cá song.',
    menuHighlights: [
      'Combo lẩu Cua Đồng / Thái chua cay: 380.000đ',
      'Combo Hải Sản tươi sống (4-5 người): 680.000đ',
      'Combo Hải Sản đậm đà (6-8 người): 980.000đ',
      'Combo Hải Sản thượng hạng (8-10 người): 1.180.000đ',
      'Tôm sú bơi bể / Mực ống nhảy: 500k - 750k/kg',
      'Cua thịt / Cua gạch Cà Mau: 750k - 850k/kg'
    ]
  },

  // 15. Ăn Vặt Gamitra - Bánh Gà & Trà Sữa (Đối tác xác thực 2026 - Bánh gà, Nem phô mai & Gà rán)
  gamitra_xuan_hoa: {
    name: 'Ăn Vặt Gamitra - Bánh Gà & Trà Sữa',
    address: 'Ki-ốt 10 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0867 192 866',
    mapsQuery: 'Gamitra Ki-ốt 10 Nguyễn Văn Linh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Giao hàng tận nơi · Nhận ship đồ ăn vặt & trà sữa tận cổng trường / ký túc xá - Hotline: 0867 192 866',
    notes: 'Quán ăn vặt chuẩn thương hiệu Gamitra tại Xuân Hòa · Chuyên bánh gà giòn rụm 10k, nem chua phô mai kéo sợi, bánh đồng xu, gà rán KFC, trà chanh, trà bí đao hạt chia.',
    menuHighlights: [
      'Combo 1 (2 Bánh gà + 1 Trà chanh): 29.000đ',
      'Combo 2 (2 Bánh gà + 1 Trà bí đao hạt chia): 35.000đ',
      'Combo 3 (1 Bánh đồng xu + 1 Trà chanh): 32.000đ',
      'Combo 5 (1 Đùi gà + Khoai lắc phô mai + Trà chanh): 69.000đ',
      'Combo 7 (1 Đùi gà + 1 Cánh gà + Khoai chiên + Trà chanh): 99.000đ',
      'Bánh gà chiên giòn: 10.000đ | Bánh đồng xu phô mai: 25.000đ',
      'Nem chua phô mai kéo sợi: 55.000đ',
      'Bánh mì pate đặc biệt: 35.000đ | Hamburger gà: 25.000đ'
    ]
  },

  // 16. Quán Chim Lan Anh - Đặc Sản Chim & Lẩu (Đối tác xác thực 2026 - Chim quay & Xôi chim)
  quan_chim_lan_anh: {
    name: 'Quán Chim Lan Anh - Đặc Sản Chim & Lẩu',
    address: 'Số 9 Đường Kim Ngọc, P. Xuân Hòa',
    phone: '0374 585 970',
    mapsQuery: 'Số 9 Kim Ngọc Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship chim quay nóng hổi, xôi chim bọc chiên giòn & set lẩu tận nhà · Hotline 0374 585 970 - 0338 671 868',
    notes: 'Đặc sản chim bồ câu, chim sẻ, xôi chim tim trứng non và lẩu chim cua sen / thạch bì độc đáo tại Xuân Hòa. Không gian ấm cúng, phục vụ tận tình.',
    menuHighlights: [
      'Chim quay to (set 5 con): 150.000đ (30k/con)',
      'Chim quay nhỏ (set 10 con): 200.000đ (20k/con)',
      'Chim câu quay / Hấp lá chanh: 100.000đ/con',
      'Xôi chim tim trứng non chiên giòn: 125.000đ',
      'Xôi chim tim trứng non: 50.000đ - 150.000đ',
      'Cháo chim kê tim trứng non: 120.000đ',
      'Chim câu / Gà ác tiềm thuốc bắc hạt sen: 110.000đ - 140.000đ',
      'Lẩu Chim Câu Cua Sen / Thạch Bì: 320.000đ - 450.000đ',
      'Kê chim nhúng lẩu / Tim trứng non: 100.000đ - 450.000đ'
    ]
  },

  // 17. Bánh Cuốn Tráng Tay Nhà Ngọc Ánh (Đối tác xác thực 2026 - 50 Trường Chinh)
  banh_cuon_ngoc_anh: {
    name: 'Bánh Cuốn Tráng Tay Nhà Ngọc Ánh',
    address: '50 Đường Trường Chinh, P. Xuân Hòa',
    phone: '0343 875 899',
    mapsQuery: '50 Trường Chinh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship bánh cuốn nóng tráng tay & chả nướng than hoa tận nơi - Hotline: 0343 875 899',
    notes: 'Quán bánh cuốn tráng tay lâu năm uy tín tại 50 Trường Chinh · Bánh tráng mỏng mềm mướt, hành phi giòn tan, bát chả nướng than hoa đậm đà nóng hổi, bún chấm và trứng vịt lộn.',
    menuHighlights: [
      'Bánh cuốn tráng tay chả nướng than hoa: 30.000đ',
      'Bánh cuốn thịt băm mộc nhĩ: 25.000đ',
      'Bánh cuốn trứng lòng đào tráng tay: 30.000đ',
      'Bún chấm chả nướng than hoa: 35.000đ',
      'Chả nướng than hoa thêm: 15.000đ/bát',
      'Trứng vịt lộn nóng: 10.000đ/quả'
    ]
  },

  // 18. Xoài Corner - Trà Trái Cây, Trà Sữa & Mỳ Cay (Đối tác xác thực 2026 - Mỳ cay thố đất & Bơ dừa non)
  xoai_corner: {
    name: 'Xoài Corner - Trà Trái Cây & Mỳ Cay',
    address: 'P. Xuân Hòa, Phúc Yên (Chuyên ship XUHO & sinh viên ĐHSP2)',
    phone: '0965 650 231',
    mapsQuery: 'Xoài Corner Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship mỳ cay thố đất & đồ uống tận KTX, trường học toàn Xuân Hòa - Hotline: 0965 650 231 - 0982 631 834',
    notes: 'Tươi từng ngụm - Mát cả ngày! Quán chuyên các loại trà trái cây nguyên chất, mỳ cay thố đất thơm ngon đậm đà, nước ép hoa quả tươi và bơ sữa dừa non.',
    menuHighlights: [
      'Mỳ cay Thập cẩm thố đất: 55.000đ',
      'Mỳ cay Hải sản: 50.000đ | Mỳ cay Bò / Sườn sụn: 45.000đ',
      'Mỳ cay Xúc xích: 40.000đ',
      'Bơ Sữa Dừa Non (Bestseller): 30.000đ - 35.000đ',
      'Trà Xoài tươi mát: 20.000đ - 25.000đ',
      'Trà Quất / Trà Chanh / Trà Bí Đao: 10.000đ - 20.000đ',
      'Trà Sữa Thái Xanh / Thái Đỏ / Khoai Môn: 20.000đ - 30.000đ',
      'Nước ép tươi Cam / Táo / Ổi / Dứa / Dưa Hấu: 20.000đ - 30.000đ',
      'Nước ép Mix Detox / Mix Tropical: 35.000đ - 40.000đ'
    ]
  },

  // 19. Tiệm Nhà Mẹ Béo - Bún Miến Trộn & Bếp Ship (Đối tác xác thực 2026 - 252E Nguyễn Văn Linh)
  tiem_nha_me_beo: {
    name: 'Tiệm Nhà Mẹ Béo - Bún Miến Trộn & Bếp Ship',
    address: 'Đối diện số nhà 252E Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0973 553 762',
    mapsQuery: '252E Nguyễn Văn Linh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Bếp bán online & nhận ship tận nơi quanh Xuân Hòa - Hotline: 0973 553 762',
    notes: 'Ngon sạch - Trọn vẹn - Mẹ nấu con yên tâm! Chuyên các món bún trộn, miến trộn, bún gạo lứt trộn full topping đẫm thịt gà xé, bò viên, trứng cút; mỳ tôm trộn sốt phô mai béo ngậy kèm trứng lòng đào.',
    menuHighlights: [
      'Bún trộn Nước tương full topping: 35.000đ',
      'Miến trộn Nước tương full topping: 35.000đ',
      'Bún gạo lứt trộn Nước tương full topping: 35.000đ',
      'Mỳ tôm trộn sốt phô mai (xúc xích, bò viên): 25.000đ',
      'Mỳ tôm trộn full topping (trứng lòng đào + phô mai): 30.000đ',
      'Nước ép tươi Dưa hấu / Xoài / Dứa / Dưa vàng: 20.000đ - 25.000đ',
      'Nước dừa hạt sen thanh mát / Nước cam vắt: 20.000đ',
      'Cafe muối béo mặn / Bạc xỉu: 25.000đ | Trà chanh ủn: 20.000đ'
    ]
  },

  // 20. Tiệm Trà Thanh Thanh - Trà Tự Nhiên, Trà Mix Vị & Sữa Chua Lắc (Đối tác xác thực 2026)
  tiem_tra_thanh_thanh: {
    name: 'Tiệm Trà Thanh Thanh - Trà Tự Nhiên & Sữa Chua Lắc',
    address: 'Khu vực ĐHSP2 & Kim Ngọc, P. Xuân Hòa',
    phone: '0344 547 198',
    mapsQuery: 'Tiệm Trà Thanh Thanh Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship trà hoa quả & sữa chua lắc tận KTX ĐHSP2 - Hotline: 0344 547 198',
    notes: 'Trà tự nhiên mát lành 100%! Chuyên trà đào cam sả, trà xoài chanh leo, trà quất lắc sữa, sữa tươi / sữa chua lắc các vị hoa quả và trà chanh / quất / bí đao khổng lồ Big Size 1 Lít.',
    menuHighlights: [
      'Trà đào cam sả / Trà xoài chanh leo: 20.000đ',
      'Trà quất lắc sữa thơm béo: 15.000đ',
      'Trà mix vị (chanh dâu tây, dưa lưới, táo xanh, ổi hồng): 15.000đ',
      'Trà chanh / quất / bí đao hạt chia / me đá: 10.000đ',
      'Sữa tươi / Sữa chua lắc hoa quả (Đào, Việt quất, Xoài, Ổi): 20.000đ',
      'Thanh Thanh Big Size 1 Lít (Trà chanh, quất, bí đao): 15.000đ/Lít',
      'Topping Thạch nha đam / Trân châu sương sáo: 5.000đ'
    ]
  },

  // 21. Xuho Bistro - Quán Nhậu Nhà Táo (Đối tác xác thực 2026 - 36-38 Điện Biên)
  xuho_bistro: {
    name: 'Xuho Bistro - Quán Nhậu Nhà Táo',
    address: '36 - 38 Đường Điện Biên, P. Xuân Hòa',
    phone: '0985 289 636',
    mapsQuery: '36 Điện Biên Xuân Hòa Xuho Bistro',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship mồi nhậu nóng hổi, lẩu nướng & liên hoan tiệc · Hotline 0985 289 636 - 0962 352 335',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Hotline 0985 289 636 - 0962 352 335 · 36-38 Điện Biên, P. Xuân Hòa · Tụ điểm ẩm thực nhậu bén, má đào cháy tỏi/tiêu xanh, trâu tươi nướng tảng cháy tỏi, tóp mỡ dưa chua, chim câu nướng mật ong, cá chép giòn xào nấm & cá lăng đủ món.',
    menuHighlights: [
      'Má đào cháy tỏi / Cháy tiêu xanh xèo xèo: 150.000đ (Signature)',
      'Tóp mỡ dưa chua giòn rụm: 100.000đ | Tóp mỡ chiên: 90.000đ',
      'Trâu cháy tỏi / Cháy tiêu xanh / Chao vừng / Nướng tảng: 160.000đ',
      'Trâu nhúng mẻ / Xào măng trúc: 150.000đ | Trâu xào muống: 120.000đ',
      'Chim câu nướng mật ong: 170.000đ/con | Xào phồng tôm: 120.000đ',
      'Ếch rang muối / Xào măng cay / Chiên mắm: 130.000đ',
      'Mực nhảy hấp bia sả: 220.000đ | Mực xào cần tỏi: 190.000đ',
      'Cá chép giòn xào nấm: 180.000đ | Cá lăng đủ món: 400.000đ/kg',
      'Nộm bò/trâu kéo pháo: 120.000đ | Nộm hoa chuối tai heo: 80.000đ',
      'Nem bùi: 30.000đ | Thịt chua: 50.000đ | Cơm rang dưa bò: 80.000đ',
      'Bia Hà Nội, Bia Sài Gòn, Bia Tiger mát lạnh'
    ]
  },

  // 22. Quán Bún Riêu Cua Bà Mai (Lê Quang Đạo)
  bun_rieu_ba_mai: {
    name: 'Quán Bún Riêu Cua Bà Mai',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa',
    phone: '0973 456 789',
    mapsQuery: 'Bún Riêu Cua Bà Mai Lê Quang Đạo Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship bún riêu cua nóng hổi buổi sáng & trưa',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Đặc sản bún riêu cua đồng tóp mỡ, bắp bò sườn sụn thơm lừng giấm bỗng.',
    menuHighlights: [
      'Bún riêu cua tóp mỡ mọc giòn: 30.000đ',
      'Bún riêu cua bắp bò sườn sụn: 40.000đ',
      'Bún ốc chuối đậu chua thanh: 35.000đ',
      'Quẩy giòn ăn kèm: 10.000đ'
    ]
  },

  // 23. Cơm Tấm Sài Gòn & Bún Thịt Nướng 82 (Trần Phú)
  com_tam_xuan_hoa: {
    name: 'Cơm Tấm Sài Gòn & Bún Thịt Nướng 82',
    address: 'Đường Trần Phú, P. Xuân Hòa',
    phone: '0983 234 890',
    mapsQuery: 'Cơm Tấm Sài Gòn 82 Trần Phú Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship cơm tấm nóng hổi tận nơi',
    notes: 'Quán đối tác xác thực MinhTT 2026 · Cơm tấm sườn nướng than hoa mật ong, chả trứng, bì thái sợi và nước mắm kẹo.',
    menuHighlights: [
      'Cơm tấm sườn bì chả nướng: 40.000đ',
      'Cơm tấm sườn nướng đặc biệt: 45.000đ',
      'Bún thịt nướng chả giò giòn rụm: 35.000đ',
      'Canh khổ qua nhồi thịt: 15.000đ'
    ]
  },

  // 24. Tiệm Cafe & Trà Chanh 1975 (Trần Phú)
  cafe_1975: {
    name: 'Tiệm Cafe & Trà Chanh 1975',
    address: 'Đường Trần Phú, P. Xuân Hòa',
    phone: '0983 234 890',
    mapsQuery: 'Cafe 1975 Trần Phú Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship cafe & trà mát lạnh quanh Xuân Hòa',
    notes: 'Không gian hoài niệm 1975 · Cà phê muối béo ngậy, cà phê cốt dừa đá tuyết, trà chanh đào giã tay thanh nhiệt.',
    menuHighlights: [
      'Cà phê muối béo ngậy 1975: 25.000đ',
      'Cà phê cốt dừa đá tuyết: 30.000đ',
      'Trà chanh đào giã tay: 18.000đ',
      'Bạc xỉu ba tầng: 25.000đ'
    ]
  },

  // 25. Beef88 - Lẩu Nướng Bò Úc (Đường Lê Quang Đạo - Đối Diện Nhà Nghỉ Q2)
  beef88: {
    name: 'Beef88 - Lẩu Nướng Bò Úc',
    address: 'Đường Lê Quang Đạo, P. Xuân Hòa (Đối Diện Nhà Nghỉ Q2)',
    phone: '0832.56.3838',
    mapsQuery: 'Lê Quang Đạo Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship lẩu nướng tận nhà & phục vụ tại quán điều hòa · Hotline 0832.56.3838',
    notes: 'Quán đối tác xác thực 2026 · Hotline 0832.56.3838 · Chuyên lẩu nướng bò Úc tươi thượng hạng, sốt ướp đậm đà, không gian điều hòa mát mẻ đối diện nhà nghỉ Q2 đường Lê Quang Đạo. Các combo nướng & lẩu từ 3-6 người siêu ưu đãi.',
    menuHighlights: [
      'Combo nướng Bò Úc 2-3 người: 369.000đ (Giá gốc 430k)',
      'Combo nướng Bò Úc 4-5 người: 559.000đ (Giá gốc 610k)',
      'Combo lẩu Bò Úc 3-4 người: 469.000đ (Giá gốc 600k)',
      'Combo lẩu Bò Úc 5-6 người: 639.000đ (Giá gốc 800k)',
      'Đĩa Bò Úc sốt nướng đặc biệt: 120.000đ',
      'Ba chỉ bò Úc cuộn nấm kim châm: 110.000đ',
      'Nầm bò nướng sốt me: 110.000đ',
      'Cơm chiên dưa bò kim chi: 50.000đ'
    ]
  },

  // 26. Cuốn Mộc - Lẩu Bò Nhúng Khế & Bánh Xèo (Đối tác xác thực 2026 - 48 Nguyễn Văn Linh)
  cuon_moc: {
    name: 'Cuốn Mộc - Lẩu Bò Nhúng Khế & Bánh Xèo',
    address: '48 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0988 642 233',
    mapsQuery: 'Cuốn Mộc 48 Nguyễn Văn Linh Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship lẩu, cuốn, bánh xèo quanh Xuân Hòa · Hotline 0988 642 233',
    notes: 'Quán đối tác xác thực 2026 · 48 Nguyễn Văn Linh · Rau tươi mỗi ngày · Lẩu bò nhúng khế thanh mát chua thanh ngọt dịu, mẹt bánh xèo 3 vị, mẹt bánh xèo 4 vị, các loại cuốn thanh mát (phở cuốn bò, cuốn bơ xoài, cuốn nem mộc, cuốn tôm thịt), nộm bò muống chẻ, mì quảng & xôi mít xôi xoài dẻo ngọt.',
    menuHighlights: [
      'Lẩu bò nhúng khế đặc sản Cuốn Mộc: 350.000đ - 599.000đ',
      'Mẹt cuốn nem lụi (Set 6 nem - 12 cuốn): 79.000đ',
      'Mẹt bánh xèo tiến cung (3 vị): 85.000đ',
      'Mẹt bánh xèo hoàng hậu (4 vị): 109.000đ',
      'Bánh xèo trứng chảy lòng đào: 25.000đ | Bánh xèo tôm thịt / bò: 35.000đ',
      'Phở cuốn bò xào rau thơm: 7.000đ/chiếc | Cuốn bơ xoài: 10.000đ/chiếc',
      'Cuốn nem mộc: 10.000đ/chiếc | Cuốn tôm thịt / tôm bơ: 12.000đ/chiếc',
      'Nộm bò tươi muống chẻ: 79.000đ | Nộm bò kéo pháo: 85.000đ',
      'Gỏi chân gà sốt Thái rút xương: 55.000đ | Cánh gà chiên mắm: 85.000đ',
      'Mì quảng bò / gà xé trứng cút: 55.000đ | Bún trộn nem nướng: 35.000đ',
      'Cơm rang dứa thơm bùi: 35.000đ | Mì xào bò rau cải: 45.000đ',
      'Xôi mít / Xôi xoài cốt dừa: 35.000đ - 39.000đ',
      'Trà sâm dứa đá lạnh giải nhiệt: 5.000đ'
    ]
  },

  // 27. Bếp Vũ Quỳnh Chi - Bán Ship Online (Tổ dân phố Hiển Lễ, P. Xuân Hòa)
  vu_quynh_chi: {
    name: 'Vũ Quỳnh Chi - Bán Ship Online',
    address: 'Tổ dân phố Hiển Lễ, P. Xuân Hòa (Bếp ship online)',
    phone: '0368 329 586',
    mapsQuery: 'Tổ dân phố Hiển Lễ Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'delivery_only',
    deliveryNote: 'Chuyên bán ship online tận nơi quanh Xuân Hòa · Hotline 0368 329 586',
    notes: 'Quán bán ship online không có quán ngồi tại chỗ · Hotline 0368 329 586 · Chuyên Kimbap cuộn rong biển truyền thống giá 30k & Mỳ trộn full topping trứng lòng đào, xúc xích, ngô ngọt giá 25k.',
    menuHighlights: [
      'Kimbap cuộn truyền thống: 30.000đ/hộp',
      'Mỳ trộn full topping (trứng lòng đào, xúc xích, ngô ngọt): 25.000đ/bát'
    ]
  },

  // 28. MATCHA HOUSE - Trà & Trà Sữa Online (Freeship từ 1 cốc tới 2h sáng)
  matcha_house: {
    name: 'Matcha House - Freeship Tới 2h Sáng',
    address: 'Khu vực P. Xuân Hòa (Bán online tận nơi)',
    phone: '0968 530 605',
    mapsQuery: 'Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'delivery_only',
    deliveryNote: 'Nhận freeship từ 1 cốc tới 2h sáng · Bán online quanh Xuân Hòa · Hotline 0968 530 605',
    notes: 'Quán bán online chuyên đồ uống matcha đậm vị, trà sữa, trà trái cây và kem dừa/phô mai · Hotline 0968 530 605 · Nhận freeship từ 1 cốc xuyên đêm tới 2h sáng quanh khu vực Xuân Hòa, ĐHSP2, KTX, Quân sự.',
    menuHighlights: [
      'Matcha OREO Phô Mai Tan Chảy (Best Seller): 38.000đ - 45.000đ',
      'Matcha Latte: 25.000đ - 30.000đ | Matcha Kem Dừa: 30.000đ - 35.000đ',
      'Matcha Cold Whisk: 28.000đ - 35.000đ | Matcha OREO Vụn Bánh: 32.000đ - 38.000đ',
      'Trà Sữa Kem Trứng Dừa Nướng: 28.000đ - 35.000đ | Hồng Trà Sữa Đậm Vị: 22.000đ - 28.000đ',
      'Trà Tắc / Trà Chanh: 10.000đ - 15.000đ | Trà Trái Cây: 25.000đ'
    ]
  },

  // 29. Tiệm Tào Phớ Chị Béo - Dãy ẩm thực KTX nhà 14 cũ (Đối diện Coffee Cỏ May)
  tao_pho_chi_beo: {
    name: 'Tiệm Tào Phớ Chị Béo',
    address: 'Dãy ẩm thực KTX nhà 14 cũ (đối diện Coffee Cỏ May), ĐHSP2, P. Xuân Hòa',
    phone: '0963 349 795',
    mapsQuery: 'Dãy ẩm thực KTX nhà 14 ĐHSP2 Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship tận nơi KTX, Giảng đường E & quanh ĐHSP2 · Hotline 0963 349 795',
    notes: 'Quán đối tác ẩm thực KTX ĐHSP2 · Hotline 0963 349 795 (Fb: Nguyễn Huyền) · Chuyên tào phớ mềm mượt nước đường hoa nhài, tào phớ thạch găng xanh mát, đậu xanh thạch găng, sữa chua nếp cẩm & sữa hạt nguyên chất.',
    menuHighlights: [
      'Tào phớ thạch găng mát lạnh: 18.000đ (Best Seller)',
      'Tào phớ truyền thống nước đường hoa nhài: 12.000đ',
      'Thạch găng mix: 15.000đ | Đậu xanh thạch găng: 20.000đ',
      'Sữa chua nếp cẩm dẻo thơm: 25.000đ',
      'Sữa hạt nguyên chất: 15.000đ - 20.000đ | Đậu xanh rau má: 25.000đ'
    ]
  },

  // 30. Bếp Thanh - 27 Đồng Tâm, Phường Xuân Hòa
  bep_thanh: {
    name: 'Bếp Thanh',
    address: '27 Đồng Tâm, P. Xuân Hòa',
    phone: '0986 552 372',
    mapsQuery: '27 Đồng Tâm Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship mì lẩu cốc, bún trộn nước tương, bánh đúc nóng & cháo gà tận nơi · Hotline 0986 552 372',
    notes: 'Bếp Thanh - 27 Đồng Tâm, P. Xuân Hòa · Hotline 0986 552 372 (FB: Thanh Đinh) · Chuyên mì lẩu cốc 25k/35k, bún trộn nước tương, mì trộn Indomie, bánh đúc nóng Hà Nội 20k/25k & cháo gà đậu xanh.',
    menuHighlights: [
      'Mì lẩu cốc: 25.000đ - 35.000đ (Best Seller)',
      'Bún trộn nước tương: 25.000đ - 35.000đ',
      'Mì trộn Indomie: 25.000đ - 35.000đ',
      'Bánh đúc nóng Hà Nội: 20.000đ - 25.000đ',
      'Cháo gà đậu xanh: 20.000đ - 25.000đ'
    ]
  },

  // 31. Trà Chanh ZIAN - Đối diện bến xe buýt 95 (Cạnh Café Caramel)
  tra_chanh_zian: {
    name: 'Trà Chanh ZIAN',
    address: 'Đối diện bến xe buýt 95 (Cạnh Café Caramel), P. Xuân Hòa',
    phone: '0332 298 889',
    mapsQuery: 'Bến xe buýt 95 Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Cả bán tại quán cả nhận ship tận nơi ĐHSP2 & quanh Xuân Hòa · Hotline 0332 298 889',
    notes: 'Trà Chanh ZIAN - Đối diện bến xe buýt 95 (Cạnh Café Caramel), P. Xuân Hòa · Hotline 0332 298 889 (Fb: Vũ Thủy) · Chuyên trà chanh siêu to 23k, trà quất siêu to, trà đào cam sả, cà phê muối 28k, sữa tươi trân châu đường đen, phindi, mojito & đồ ăn vặt.',
    menuHighlights: [
      'Trà chanh siêu to khổng lồ: 23.000đ (Best Seller)',
      'Trà quất siêu to: 23.000đ',
      'Trà đào cam sả: 25.000đ',
      'Cà phê muối béo ngậy: 28.000đ',
      'Sữa tươi trân châu đường đen: 25.000đ',
      'Sữa chua lắc dâu tây: 25.000đ',
      'Khô gà lá chanh / Khô bò: 20.000đ - 25.000đ'
    ]
  },

  // 32. Mr Tea - Food & Drink (Cổng Ký Túc Xá Sư Phạm Hà Nội 2)
  mr_tea: {
    name: 'Mr Tea - Food & Drink',
    address: 'Cổng Ký Túc Xá Sư Phạm Hà Nội 2, P. Xuân Hòa',
    phone: '0968 025 520',
    mapsQuery: 'Cổng Ký Túc Xá ĐH Sư Phạm Hà Nội 2 Xuân Hòa',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Nhận ship cơm gà viên, đùi gà, tokbokki & trà sữa KTX ĐHSP2 (19h-22h & cả ngày) · Hotline 0968 025 520',
    notes: 'Mr Tea Food & Drink · Cổng KTX ĐHSP Hà Nội 2 · Hotline 0968.025.520 (Fb: Mai Hương) · WiFi: Mr Tea (Pass: 12345678) · Thiên đường ẩm thực sinh viên với cơm gà viên lắc vị 45k, đùi gà giòn 45k-48k, bánh gà 20k-25k, tokbokki, mì cay 7 cấp độ, trà sữa bơ đặc biệt 40k & trà hoa quả tươi.',
    menuHighlights: [
      'Cơm gà viên lắc vị (Phô mai / Rong biển / Bơ tỏi / BBQ): 45.000đ (Best Seller)',
      'Cơm gà viên mix sốt (Cay Hàn / Phô mai / Kem / Chua ngọt): 45.000đ',
      'Đùi gà chiên giòn / Lắc phô mai: 45.000đ - 48.000đ',
      'Gà viên lắc vị / Mix sốt: 25.000đ - 40.000đ',
      'Bánh gà chiên giòn / Lắc phô mai: 20.000đ - 25.000đ',
      'Tokbokki mix sốt / Rabokki: 35.000đ - 60.000đ',
      'Mì cay Hàn Quốc 7 cấp độ / Mì Thái: 35.000đ - 55.000đ',
      'Trà sữa bơ đặc biệt: 40.000đ (Signature Drink)',
      'Trà hoa quả tươi / Trà chanh / Trà sữa gạo rang: 10.000đ - 35.000đ'
    ]
  },

  // 33. Tiệm Lan Phương - Trà Sữa & Bánh Tráng (512 Trường Chinh)
  tiem_lan_phuong: {
    name: 'Tiệm Lan Phương - Trà Sữa & Bánh Tráng',
    address: '512 Trường Chinh, P. Xuân Hòa',
    phone: '0335 728 564',
    mapsQuery: '512 Trường Chinh Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Bán tại quán & Nhận ship bánh tráng cuộn, bánh mì muối ớt & trà sữa tận nơi quanh Xuân Hòa · Hotline 0335 728 564 - 0364 963 502',
    notes: 'Tiệm Lan Phương · 512 Trường Chinh, P. Xuân Hòa · Hotline 0335 728 564 - 0364 963 502 (Fb: Tiệm Lan Phương) · Tụ điểm ăn vặt quen thuộc với bánh tráng cuộn sốt bơ mix 25k-50k, bánh tráng nướng Đà Lạt 20k, bánh mì nướng muối ớt sốt bơ cay 20k-40k, trà sữa trân châu đường đen 25k, sữa chua lắc, trà hoa quả nhiệt đới, matcha latte & viên chiên.',
    menuHighlights: [
      'Bánh tráng cuộn sốt bơ mix (Thập cẩm): 25.000đ - 50.000đ (Best Seller)',
      'Bánh tráng nướng Đà Lạt giòn rụm: 20.000đ',
      'Bánh tráng trộn đặc biệt: 20.000đ',
      'Bánh mì nướng muối ớt sốt bơ cay: 20.000đ - 40.000đ',
      'Trà sữa trân châu đường đen: 25.000đ - 30.000đ',
      'Hồng trà sữa: 20.000đ - 25.000đ',
      'Trà hoa quả nhiệt đới / Trà đào cam sả: 25.000đ - 30.000đ',
      'Sữa chua lắc dâu tây / việt quất: 20.000đ - 25.000đ',
      'Matcha Latte kem muối: 28.000đ - 35.000đ',
      'Gà cay ngọt / Viên chiên / Khoai lắc phô mai: 25.000đ - 50.000đ'
    ]
  },

  // 34. Quán GoKy - Chè Khoai Dẻo & Milo Dầm (Đường Nguyễn Văn Linh)
  goky_xuan_hoa: {
    name: 'Quán GoKy - Chè Khoai Dẻo & Milo Dầm',
    address: 'Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0978 686 288',
    mapsQuery: 'Nguyễn Văn Linh Xuân Hòa Phúc Yên',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship chè khoai dẻo, milo dầm, bánh đúc nóng KTX ĐHSP2 & quanh Xuân Hòa',
    notes: 'Quán GoKy · Đường Nguyễn Văn Linh, P. Xuân Hòa · Biển vàng nổi bật · Chuyên chè khoai dẻo 15k-20k, chè khoai dẻo caramen 20k-25k, chè hoa quả, milo dầm trân châu / kem trứng 20k-25k, cacao dầm, sữa chua mít, tàu hũ hoa nhài, bánh đúc nóng & trà chanh.',
    menuHighlights: [
      'Chè khoai dẻo truyền thống: 15.000đ - 20.000đ (Best Seller)',
      'Chè khoai dẻo caramen: 20.000đ - 25.000đ',
      'Milo dầm trân châu / caramen: 20.000đ - 25.000đ',
      'Milo dầm kem trứng béo ngậy: 25.000đ',
      'Chè khoai sợi dừa: 15.000đ - 20.000đ',
      'Chè đỗ đen sương sáo / Đậu đỏ cốt dừa: 15.000đ - 20.000đ',
      'Tàu hũ hoa nhài: 15.000đ | Sữa chua mít: 20.000đ',
      'Bánh đúc nóng Hà Nội: 15.000đ - 20.000đ',
      'Trà chanh vỉa hè: 10.000đ - 15.000đ'
    ]
  },

  // 35. Trạm Dủ Dẻ Chạm - Cafe & Camping Chill (Ban Quản Lý KĐT Xuân Hòa)
  tram_du_de: {
    name: 'Trạm Dủ Dẻ Chạm',
    address: 'Ban Quản Lý KĐT Xuân Hòa, P. Xuân Hòa',
    phone: '038 516 5993',
    mapsQuery: 'Ban Quan Ly KDT Xuan Hoa Phuong Xuan Hoa Phuc Yen',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Không gian chill camping ngoài trời & Nhận ship đồ uống, đồ ăn vặt tận nơi quanh KĐT Xuân Hòa, ĐHSP2 · Hotline 038 516 5993',
    notes: 'Trạm Dủ Dẻ Chạm · Ban Quản Lý KĐT Xuân Hòa, P. Xuân Hòa · Hotline 038 516 5993 · Không gian camping ngoài trời độc đáo với 7 trạm menu đầy đủ 53 món: Trà Dủ Dẻ signature 35k, Mochi kéo sợi 35k, Ô Long Dẻ Cười 45k, Trà Mơ Má Đào 43k, Trà Me Dừa Đắc 45k, Trà Hồng Mật hoa mây 48k, Sen Dừa Matcha 45k, Coco Mít 40k, Sen Dừa Lạnh 45k, Bánh Bao Phomai Gà Nấm 22k, Nem Chua Rán 35k & đồ uống ấm áp.',
    menuHighlights: [
      'Trà Dủ Dẻ Đặc Biệt: 35.000đ (Signature)',
      'Trà sữa Mochi kéo sợi: 35.000đ (Hot Trend)',
      'Trà Mơ Má Đào: 43.000đ | Trà Me Dừa Đắc: 45.000đ',
      'Ô Long Dẻ Cười: 45.000đ | Ô Long Nhài Cốm: 45.000đ',
      'Trà Hồng Mật (Trà hoa mây): 48.000đ',
      'Sen Dừa Matcha: 45.000đ | Sen Dừa Lạnh: 45.000đ',
      'Coco Mít: 40.000đ | Coco Matcha: 45.000đ',
      'Café kem muối / Café kem trứng: 33.000đ',
      'Bánh bao Phomai gà nấm: 22.000đ | Bánh bao thịt trứng: 20.000đ',
      'Nem chua rán: 35.000đ | Mix viên chiên tôm cá mực: 35.000đ',
      'Ép cóc xí muội: 40.000đ | Trà ổi Ruby: 45.000đ',
      'Khoai môn kiều mạch: 40.000đ | Nhài chanh xí muội: 40.000đ'
    ]
  },

  // 36. Lê La Cafee - Cà Phê, Trà Sữa & Đồ Uống Chill (KĐT Mới Xuân Hòa)
  // 37. Quán Đậu Ơi - Bún Đậu & Cơm Trộn (47 Kim Ngọc)
  // 38. Bánh Xèo Cô Hiền - Nem Lụi & Chè Miền Trung (90 Nguyễn Văn Linh)
    co_hien: {
    name: 'Bánh Xèo Cô Hiền',
    address: '90 Đường Nguyễn Văn Linh, P. Xuân Hòa',
    phone: '0359 637 876',
    mapsQuery: '90 Nguyen Van Linh Xuan Hoa Phuc Yen',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Mở cửa 09:00 - 22:00 & Nhận ship bánh xèo nóng giòn, nem lụi, chè, ăn vặt tận nơi quanh ĐHSP2 · ĐT/Zalo 0359 637 876',
    notes: 'Bánh Xèo Cô Hiền · 90 Nguyễn Văn Linh, P. Xuân Hòa · Hotline/Zalo: 0359 637 876 · Giờ mở cửa: 09:00 - 22:00. Đặc sản miền Trung: Bánh xèo 35k/suất 2 cái, thêm nhân 45k, Nem lụi miền Trung 60k mẹt bún rau, Bánh tôm cuốn rế 50k, Lạp xưởng Hà Khẩu 20k, Chè thập cẩm 20k, Khoai môn lệ phố 50k, Nem chua rán 50k, Khoai lang kén 35k, Trà quất nha đam 20k.',
    menuHighlights: [
      'Bánh xèo miền Trung (1 suất 2 cái): 35.000đ (Best Seller)',
      'Bánh xèo thêm nhân (1 suất 2 cái): 45.000đ',
      'Nem lụi miền Trung (Mẹt bún cuốn): 60.000đ (Signature)',
      'Bánh tôm cuốn rế giòn tan: 50.000đ',
      'Chè thập cẩm miền Trung: 20.000đ',
      'Lạp xưởng Hà Khẩu nướng đá: 20.000đ / cái',
      'Khoai môn lệ phố / Nem chua rán: 50.000đ',
      'Khoai lang kén: 35.000đ',
      'Tôm cá bò viên chiên: 40.000đ',
      'Trà quất nha đam / Trà chanh nha đam: 20.000đ'
    ]
  },

  tra_chanh_bao_chau: {
    name: 'Trà Chanh Bảo Châu',
    address: '122 Đường Trường Chinh, P. Xuân Hòa',
    phone: '0975 481 996',
    mapsQuery: '122 Truong Chinh Xuan Hoa Phuc Yen',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Vừa bán tại chỗ vừa ship tận nơi siêu tốc quanh ĐHSP2, Xuân Hòa · Hotline 0975 481 996',
    notes: 'Trà Chanh Bảo Châu · 122 Trường Chinh, P. Xuân Hòa · Hotline 0975 481 996 · Cam kết 100% nguyên liệu tự nhiên tươi mới mỗi ngày. Trà chanh thanh mát 15k/cốc, Trà đào giòn ngọt 25k/cốc, Trà đào cam sả 28k, Trà tắc xí muội 15k, nem chua rán, hướng dương cắn lai rai.',
    menuHighlights: [
      'Trà chanh thanh mát Bảo Châu: 15.000đ / cốc (Best Seller)',
      'Trà đào thanh mát Bảo Châu: 25.000đ / cốc (Signature)',
      'Trà chanh khổng lồ Size L: 20.000đ',
      'Trà đào cam sả Bảo Châu: 28.000đ',
      'Trà tắc xí muội thảo mộc: 15.000đ',
      'Cà phê đen đá / nâu đá: 15.000đ - 18.000đ',
      'Hướng dương rang mộc / vị dừa: 15.000đ',
      'Nem chua rán giòn rụm: 30.000đ'
    ]
  },

  dau_oi: {
    name: 'Quán Đậu Ơi - Bún Đậu & Cơm Trộn',
    address: '47 Đường Kim Ngọc, P. Xuân Hòa',
    phone: '0338 499 255',
    mapsQuery: '47 Kim Ngoc Phuong Xuan Hoa Phuc Yen',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Phục vụ tại quán & Nhận ship mẹt bún đậu, cơm trộn nóng hổi tận nơi quanh KTX ĐHSP2 · Hotline 0338 499 255',
    notes: 'Quán Đậu Ơi · 47 Kim Ngọc, P. Xuân Hòa · Hotline 0338 499 255 · Tụ điểm ẩm thực bình dân sinh viên nổi tiếng: Mẹt bún đậu mắm tôm đầy đủ chân giò, nem rán, dồi sụn, chả cốm 20k-45k, Cơm trộn Hàn Quốc thố đá 40k-50k, Cơm tỏi gà, cơm dưa bò, cơm sườn & buffet nước ngọt giải ngấy.',
    menuHighlights: [
      'Bún đậu đặc biệt (Full topping): 45.000đ (Signature)',
      'Cơm trộn Hàn Quốc thố đá: 40.000đ (Hot)',
      'Cơm trộn Hàn Quốc 2 người: 50.000đ',
      'Cơm tỏi gà / Cơm sườn: 40.000đ',
      'Cơm gà chua ngọt / Cơm dưa bò: 35.000đ',
      'Bún đậu chân giò / Nem rán / Dồi sụn: 35.000đ',
      'Bún đậu thường: 20.000đ',
      'Buffet nước ngọt: 15.000đ'
    ]
  },

  le_la_cafe: {
    name: 'Lê La Cafee',
    address: 'Khu Đô Thị Mới Xuân Hòa (cạnh TT Tiếng Anh Diamond), P. Xuân Hòa',
    phone: '0819 060 596',
    mapsQuery: 'Khu Do Thi Moi Xuan Hoa Phuong Xuan Hoa Phuc Yen',
    verified: true,
    serviceMode: 'both',
    deliveryNote: 'Không gian cafe thoáng đãng & Nhận ship đồ uống tận nơi quanh KĐT Mới và ĐHSP2 · Hotline 0819 060 596 · 0393 465 896',
    notes: 'Lê La Cafee · Khu Đô Thị Mới Xuân Hòa (Cạnh TT Tiếng Anh Diamond) · Hotline 0819 060 596 · 0393 465 896 · Thực đơn đầy đủ 34 món Cà phê truyền thống & Pha máy: Cà phê muối béo ngậy 35k, Phin kem trứng vụn dừa nướng 38k, Matcha kem cheese 40k, Matcha sữa hạt 35k, Shan Mật 30k-35k, Olong gạo rang 30k-35k, Gạo rang kem dẻo 35k-40k, Trà sữa kem trứng dừa nướng 35k-40k, Olong sen vàng 45k, Sen vàng nếp thơm 45k, Trà quýt hoa nhài 37k, Trà vải hoa hồng 37k, Trà lựu ngọc trai 37k, Trà thạch đào 40k & nước ép tươi.',
    menuHighlights: [
      'Phin Kem Trứng Vụn Dừa Nướng: 38.000đ (Signature)',
      'Cà phê muối béo ngậy: 35.000đ',
      'Matcha kem cheese: 40.000đ | Matcha sữa hạt: 35.000đ',
      'Shan Mật trà sữa đậm vị: 30.000đ - 35.000đ',
      'Olong gạo rang: 30.000đ - 35.000đ | Gạo rang kem dẻo: 35.000đ - 40.000đ',
      'Trà sữa kem trứng dừa nướng: 35.000đ - 40.000đ',
      'Hồng trà kem phô mai: 35.000đ - 40.000đ',
      'Olong sen vàng / Sen vàng nếp thơm: 45.000đ',
      'Trà quýt hoa nhài / Trà vải hoa hồng: 37.000đ',
      'Trà lựu ngọc trai: 37.000đ | Trà thạch đào: 40.000đ',
      'Cà phê sữa máy Espresso / Latte: 35.000đ - 40.000đ',
      'Ép cam dứa tươi mát / Ép dưa hấu: 35.000đ - 40.000đ'
    ]
  }
};;

export function getSpotForDish(dishName: string): SpotInfo {
  const name = dishName.toLowerCase();

  // Bánh Xèo Cô Hiền: Bánh xèo, nem lụi, chè miền trung 90 Nguyễn Văn Linh
  if (
    name.includes('cô hiền') ||
    name.includes('co hien') ||
    (name.includes('90') && name.includes('nguyễn văn linh')) ||
    (name.includes('bánh xèo') && !name.includes('cuốn mộc') && !name.includes('tiến cung')) ||
    (name.includes('chè bưởi') && name.includes('cô hiền'))
  ) {
    return xuanHoaSpots.co_hien;
  }

    // Quán Đậu Ơi: Bún đậu 47 Kim Ngọc, Cơm trộn Hàn Quốc, Cơm tỏi gà, Đậu Ơi
  if (
    name.includes('đậu ơi') ||
    name.includes('dau oi') ||
    (name.includes('kim ngọc') && (name.includes('47') || name.includes('bún đậu') || name.includes('cơm trộn'))) ||
    (name.includes('cơm trộn') && (name.includes('hàn quốc') || name.includes('thố đá') || name.includes('đậu ơi'))) ||
    name.includes('cơm tỏi gà')
  ) {
    return xuanHoaSpots.dau_oi;
  }

    // Lê La Cafee: Cà phê muối, phin kem trứng, matcha kem cheese, shan mật, gạo rang, sen vàng, quýt nhài, vải hồng, lựu ngọc trai
  if (
    name.includes('lê la') ||
    name.includes('le la') ||
    name.includes('diamond') ||
    (name.includes('kđt mới') && name.includes('xuân hòa')) ||
    (name.includes('phin') && name.includes('kem trứng')) ||
    name.includes('shan mật') ||
    name.includes('gạo rang kem dẻo') ||
    name.includes('olong gạo rang') ||
    name.includes('quýt hoa nhài') ||
    name.includes('vải hoa hồng') ||
    name.includes('lựu ngọc trai') ||
    name.includes('sen vàng nếp thơm') ||
    name.includes('thạch đào') ||
    name.includes('cà phê sữa máy') ||
    name.includes('matcha sữa hạt') ||
    (name.includes('matcha') && name.includes('cheese')) ||
    (name.includes('sen vàng') && (name.includes('oolong') || name.includes('tây thơm') || name.includes('lê la'))) ||
    (name.includes('dừa nướng') && name.includes('kem trứng') && !name.includes('dủ dẻ')) ||
    (name.includes('gạo rang') && name.includes('kem béo')) ||
    (name.includes('milo') && name.includes('kem trứng') && !name.includes('goky'))
  ) {
    return xuanHoaSpots.le_la_cafe;
  }

  // Trạm Dủ Dẻ Chạm: Trà dủ dẻ, mochi kéo sợi, dẻ cười, mơ má đào, me dừa đắc, trà hồng mật, bánh bao phomai gà nấm, kđt xuân hòa
  if (
    name.includes('dủ dẻ') ||
    name.includes('du de') ||
    name.includes('mochi kéo sợi') ||
    (name.includes('trạm') && name.includes('chạm')) ||
    name.includes('mơ má đào') ||
    name.includes('me dừa đắc') ||
    name.includes('trà hồng mật') ||
    name.includes('trà hoa mây') ||
    name.includes('dẻ cười') ||
    name.includes('nhài cốm') ||
    name.includes('sen dừa matcha') ||
    name.includes('coco mít') ||
    name.includes('sen dừa lạnh') ||
    name.includes('coco matcha') ||
    name.includes('ép cóc xí muội') ||
    name.includes('trà ổi ruby') ||
    name.includes('nhãn dừa nhiệt đới') ||
    name.includes('bánh bao phomai gà nấm') ||
    (name.includes('bánh bao') && name.includes('thịt trứng lạp xưởng')) ||
    name.includes('bạc xỉu hạnh nhân') ||
    name.includes('khoai môn kiều mạch') ||
    name.includes('nhài chanh xí muội') ||
    name.includes('sữa chua thạch trà') ||
    (name.includes('trà sữa') && name.includes('mochi')) ||
    (name.includes('kđt') && name.includes('xuân hòa') && !name.includes('mới'))
  ) {
    return xuanHoaSpots.tram_du_de;
  }

  // Quán GoKy: Chè khoai dẻo, Milo dầm, Cacao dầm, Chè caramen, GoKy
  if (
    name.includes('goky') ||
    name.includes('khoai dẻo') ||
    name.includes('milo dầm') ||
    name.includes('cacao dầm') ||
    (name.includes('chè') && (name.includes('khoai') || name.includes('sợi dừa') || name.includes('goky')))
  ) {
    return xuanHoaSpots.goky_xuan_hoa;
  }

  // Chè Xuân Mai (35 Nguyễn Văn Linh): Chè thập cẩm 10k, chè bưởi, chè khoai dẻo, ít ngọt
  if (
    name.includes('xuân mai') ||
    name.includes('xuan mai') ||
    (name.includes('35') && name.includes('nguyễn văn linh')) ||
    (name.includes('chè') && name.includes('ít ngọt')) ||
    (name.includes('chè thập cẩm') && name.includes('10k'))
  ) {
    return xuanHoaSpots.che_xuan_mai;
  }

  // Quán Nhật Hạ (Số 9 Đồng Tâm): Buffet nem nướng 19k (15h-17h30), Buffet nem nướng 39k (17h31-23h)
  if (
    name.includes('nhật hạ') ||
    name.includes('nhat ha') ||
    (name.includes('buffet nem nướng') || name.includes('buffet nem nuong')) ||
    (name.includes('nem nướng') && (name.includes('đồng tâm') || name.includes('19k') || name.includes('39k'))) ||
    (name.includes('9') && name.includes('đồng tâm'))
  ) {
    return xuanHoaSpots.nhat_ha;
  }

  // Quán Bia Sài Gòn Tuấn Hiền (Cổng chào Xuân Hòa): Bia hơi Sài Gòn, Ba chỉ quay giòn bì, Dồi sụn nướng, Nộm tai heo
  if (
    name.includes('tuấn hiền') ||
    name.includes('tuan hien') ||
    (name.includes('bia') && (name.includes('sài gòn') || name.includes('cổng chào'))) ||
    (name.includes('ba chỉ quay') && name.includes('giòn bì')) ||
    (name.includes('nộm tai heo') && name.includes('hoa chuối'))
  ) {
    return xuanHoaSpots.tuan_hien_beer;
  }

  // Tiệm Bánh A Salty Name (Vòng tròn Xuho): Bento Cake, Lime & Oreo Cheesecake, Fudgy Brownie, Chocomint
  if (
    name.includes('salty name') ||
    name.includes('chocomint') ||
    name.includes('fudgy brownie') ||
    name.includes('lime cheesecake') ||
    name.includes('oreo cheesecake') ||
    name.includes('whipping quả mọng') ||
    (name.includes('bento') && (name.includes('cake') || name.includes('bánh')))
  ) {
    return xuanHoaSpots.a_salty_name_bakery;
  }

  // Thanh Hằng Gateaux (16 Kim Ngọc): Bánh kem sinh nhật, Gateaux, Cheesecake dessert
  if (
    name.includes('thanh hằng') ||
    name.includes('thanhhang') ||
    (name.includes('gateaux') && name.includes('kim ngọc')) ||
    (name.includes('bánh sinh nhật') && name.includes('thanh hằng'))
  ) {
    return xuanHoaSpots.thanh_hang_gateaux;
  }

  // Quán Bánh Tráng 55 Nguyễn Văn Linh: Bánh tráng cuộn bơ, bánh tráng trộn PS tóp mỡ, bánh tráng nướng Đà Lạt, bánh tráng chấm muối kẹo ly
  if (
    (name.includes('bánh tráng') && (name.includes('55') || name.includes('nguyễn văn linh') || name.includes('cuộn bơ') || name.includes('phơi sương') || name.includes('muối kẹo') || name.includes('lòng đào') || name.includes('tóp mỡ'))) ||
    name.includes('55 nguyễn văn linh') ||
    name.includes('55 nvl')
  ) {
    return xuanHoaSpots.banh_trang_55_nvl;
  }

  // Nhà Hàng Sân Bia 247 (78 Trường Chinh): Má đào cháy tỏi bản gang, Tháp sườn chua cay, Nõn đuôi móc mật, Nem ngựa Bắc Giang, Lẩu tôm bầu
  if (
    name.includes('sân bia 247') ||
    name.includes('san bia 247') ||
    name.includes('sân bia') ||
    (name.includes('78') && name.includes('trường chinh')) ||
    (name.includes('má đào') && name.includes('cháy tỏi')) ||
    name.includes('tháp sườn') ||
    name.includes('nõn đuôi chiên móc mật') ||
    name.includes('nem ngựa') ||
    name.includes('lẩu tôm bầu') ||
    name.includes('tôm rum')
  ) {
    return xuanHoaSpots.san_bia_247;
  }

  // Nhung's Corner (47 Kim Ngọc): Mì cay 7 cấp độ, Tokbokki, Cold Whisk matcha giòn, Trà sữa Hokkaido
  if (
    name.includes("nhung's corner") ||
    name.includes('nhungs corner') ||
    name.includes('nhung corner') ||
    (name.includes('47') && name.includes('kim ngọc')) ||
    name.includes('cold whisk') ||
    name.includes('matcha giòn') ||
    name.includes('hokkaido') ||
    name.includes('matcha sữa dừa') ||
    (name.includes('mì cay') && (name.includes('bò mỹ') || name.includes('hàn quốc')) && !name.includes('ruby') && !name.includes('seoul'))
  ) {
    return xuanHoaSpots.nhungs_corner;
  }

  // Vành Đai Quán (Đường Lê Quang Đạo): Đậm Mồi - Đậm Bia - Đậm Tình, Má đào cháy tỏi, Nầm heo cháy tiêu, Tôm sốt trứng muối, Lẩu riêu cua
  if (
    name.includes('vành đai quán') ||
    name.includes('vanh dai quan') ||
    name.includes('vành đai') ||
    name.includes('vanh dai') ||
    name.includes('nầm heo cháy tiêu') ||
    name.includes('ba chỉ chao giềng') ||
    name.includes('bò khế pháo') ||
    name.includes('dải chao tỏi') ||
    name.includes('đậm mồi') ||
    name.includes('tháp 85k') ||
    (name.includes('lê quang đạo') && (name.includes('bia') || name.includes('má đào') || name.includes('lẩu'))) ||
    (name.includes('má đào cháy tỏi') && name.includes('vành đai')) ||
    (name.includes('lẩu riêu cua') && name.includes('vành đai')) ||
    (name.includes('tôm sốt trứng muối') && name.includes('vành đai'))
  ) {
    return xuanHoaSpots.vanh_dai_quan;
  }

  // Tiệm Cơm Nhà Lê Huyền (Chân dốc KTX Sinh Viên - Nguyễn Văn Linh)
  if (
    name.includes('lê huyền') ||
    name.includes('le huyen') ||
    name.includes('tiệm cơm nhà lê huyền') ||
    name.includes('tiệm nhà lê huyền') ||
    name.includes('tiem com nha le huyen') ||
    (name.includes('chân dốc ktx') && (name.includes('cơm') || name.includes('kimbap') || name.includes('soda') || name.includes('nước ép'))) ||
    (name.includes('dốc ktx') && name.includes('nguyễn văn linh') && (name.includes('cơm') || name.includes('kimbap') || name.includes('soda') || name.includes('nước ép')))
  ) {
    return xuanHoaSpots.tiem_le_huyen;
  }

  // Canteen Kí Túc Xá - Trung Tâm Nội Trú Sư Phạm 2 (Ngõ 10 Nguyễn Văn Linh)
  if (
    name.includes('canteen') ||
    name.includes('trung tâm nội trú') ||
    name.includes('trung tam noi tru') ||
    name.includes('ngõ 10 nguyễn văn linh') ||
    name.includes('ngõ 10 nvl') ||
    name.includes('0967796560') ||
    name.includes('0967 796 560') ||
    (name.includes('kí túc xá') && (name.includes('canteen') || name.includes('mì cay') || name.includes('mỳ cay') || name.includes('mì trộn') || name.includes('mỳ trộn') || name.includes('xiên que'))) ||
    (name.includes('ktx') && (name.includes('canteen') || name.includes('mì trộn indomie') || name.includes('mỳ trộn indomie') || name.includes('trà đào 9k'))) ||
    name.includes('indomie')
  ) {
    return xuanHoaSpots.canteen_ktx_sp2;
  }

  // Quán Dừa Khả Do (Số 18 Khả Do, TP. Phúc Yên)
  if (
    name.includes('khả do') ||
    name.includes('kha do') ||
    name.includes('0378457263') ||
    name.includes('0378 457 263') ||
    (name.includes('dừa tươi') && (name.includes('nguyên quả') || name.includes('13k') || name.includes('15k'))) ||
    (name.includes('trứng tươi') && name.includes('10 quả')) ||
    (name.includes('bánh đa') && name.includes('2 chiếc'))
  ) {
    return xuanHoaSpots.quan_dua_kha_do;
  }

  // Bún Bò Huế 102 Nguyễn Văn Linh
  if (
    name.includes('102 nguyễn văn linh') ||
    name.includes('102 nvl') ||
    name.includes('0358299789') ||
    name.includes('0358 299 789') ||
    name.includes('0979666839') ||
    name.includes('0979 666 839') ||
    (name.includes('bún bò huế') && (name.includes('không móng') || name.includes('bò chín') || name.includes('bò tái') || name.includes('102'))) ||
    (name.includes('bún cua mọc') && name.includes('102'))
  ) {
    return xuanHoaSpots.bun_bo_hue_102;
  }

  // Xiên Nướng Trung Hoa (KCN Bá Thiện 2, Bình Xuyên): Xiên thịt bò củ quả, cánh gà nướng cay, mực nguyên con, nộm cải thảo kiểu Trung
  if (
    name.includes('xiên nướng trung hoa') ||
    name.includes('trung hoa') ||
    name.includes('bá thiện') ||
    name.includes('ba thien') ||
    name.includes('bình xuyên') ||
    name.includes('vương lão cát') ||
    name.includes('gia đa bảo') ||
    name.includes('khang sư phụ') ||
    name.includes('nộm cải thảo kiểu trung') ||
    name.includes('nộm đậu bắp kiểu trung') ||
    name.includes('bò củ quả') ||
    (name.includes('cánh gà') && name.includes('sốt cay') && name.includes('trung')) ||
    (name.includes('tuộc') && name.includes('trung hoa'))
  ) {
    return xuanHoaSpots.xien_nuong_trung_hoa;
  }

  // Quán Thi Lan Tea (Đầu ngõ Kim Ngọc): Bánh mỳ muối ớt sốt bơ vàng, Thịt xiên nướng, Bánh mỳ que Hải Phòng, Bánh mỳ thập cẩm cắt
  if (
    name.includes('thi lan') ||
    name.includes('thị lan') ||
    name.includes('sốt bơ vàng') ||
    name.includes('bánh mỳ que') ||
    name.includes('bánh mì que') ||
    name.includes('thập cẩm cắt') ||
    (name.includes('kim ngọc') && (name.includes('bánh mỳ') || name.includes('bánh mì') || name.includes('thịt xiên'))) ||
    (name.includes('thịt xiên nướng') && name.includes('thi lan')) ||
    (name.includes('bánh mì thịt nướng') && name.includes('thi lan'))
  ) {
    return xuanHoaSpots.thi_lan_tea;
  }

  // Bánh Mì Nướng Muối Ớt Ngọc Quý (181 Nguyễn Văn Linh): Bánh mì nướng muối ớt full topping, bánh tráng trộn, 181 nguyễn văn linh
  if (
    name.includes('ngọc quý') ||
    name.includes('ngoc quy') ||
    (name.includes('181') && name.includes('nguyễn văn linh')) ||
    (name.includes('bánh mì nướng muối ớt') && !name.includes('lan phương')) ||
    (name.includes('bánh mì muối ớt') && !name.includes('lan phương')) ||
    (name.includes('bánh tráng trộn') && !name.includes('lan phương')) ||
    (name.includes('bánh mì sốt bơ') && !name.includes('lan phương'))
  ) {
    return xuanHoaSpots.bm_ngoc_quy;
  }

  // Quán Cát Tiên (82 Nguyễn Văn Linh): Trà bí đao, Trà sữa kem trứng dừa nướng, Trà dưa lưới, Tàu hũ, Cát Tiên
  if (
    name.includes('cát tiên') ||
    name.includes('cat tien') ||
    (name.includes('82') && name.includes('nguyễn văn linh')) ||
    (name.includes('trà bí đao') && (name.includes('hạt chia') || name.includes('kem mặn') || name.includes('thạch'))) ||
    (name.includes('trà dưa lưới') && !name.includes('thanh thanh')) ||
    (name.includes('tàu hũ') && (name.includes('kem trứng') || name.includes('socola') || name.includes('dừa nướng'))) ||
    (name.includes('socola bơ lạc')) ||
    (name.includes('trà sữa') && name.includes('dừa nướng') && !name.includes('lê la') && !name.includes('soh'))
  ) {
    return xuanHoaSpots.cat_tien;
  }

  // Tiệm Lan Phương: Bánh tráng cuộn, Bánh tráng nướng, Bánh mì muối ớt, 512 Trường Chinh
  if (
    name.includes('lan phương') ||
    name.includes('512 trường chinh') ||
    name.includes('bánh tráng cuộn') ||
    (name.includes('bánh tráng') && (name.includes('sốt bơ') || name.includes('mix') || name.includes('nướng') || name.includes('trộn'))) ||
    name.includes('bánh mì nướng muối ớt') ||
    name.includes('bánh mì muối ớt') ||
    (name.includes('trà sữa') && name.includes('lan phương'))
  ) {
    return xuanHoaSpots.tiem_lan_phuong;
  }

  // Mr Tea: Cơm gà viên, đùi gà, gà viên lắc vị, bánh gà mr tea, trà sữa bơ
  if (
    name.includes('mr tea') ||
    name.includes('mr.tea') ||
    name.includes('cơm gà viên') ||
    name.includes('gà viên lắc') ||
    (name.includes('bánh gà') && (name.includes('mr tea') || name.includes('ktx'))) ||
    (name.includes('trà sữa') && name.includes('bơ') && name.includes('mr')) ||
    (name.includes('cơm gà') && name.includes('lắc vị'))
  ) {
    return xuanHoaSpots.mr_tea;
  }

  // Trà Chanh ZIAN: Trà chanh siêu to, trà quất siêu to, cà phê muối, đối diện bến xe buýt 95
  if (
    name.includes('zian') ||
    name.includes('siêu to') ||
    (name.includes('trà chanh') && (name.includes('zian') || name.includes('xe buýt 95') || name.includes('khổng lồ'))) ||
    name.includes('phindi') ||
    (name.includes('trà đào cam sả') && name.includes('zian'))
  ) {
    return xuanHoaSpots.tra_chanh_zian;
  }

  // Bếp Thanh: Mì lẩu cốc, Bún trộn nước tương, Bánh đúc nóng, Cháo gà đậu xanh, Indomie
  if (
    name.includes('bếp thanh') ||
    name.includes('mì lẩu cốc') ||
    name.includes('bún trộn nước tương') ||
    (name.includes('bánh đúc') && (name.includes('hà nội') || name.includes('bếp thanh') || name.includes('nóng'))) ||
    (name.includes('cháo gà') && name.includes('đậu xanh')) ||
    (name.includes('indomie') && name.includes('trộn'))
  ) {
    return xuanHoaSpots.bep_thanh;
  }

  // Tào Phớ Chị Béo: Tào phớ, thạch găng, sữa chua nếp cẩm KTX 14 cũ
  if (
    name.includes('chị béo') ||
    name.includes('tào phớ') ||
    name.includes('thạch găng') ||
    (name.includes('nếp cẩm') && name.includes('sữa chua'))
  ) {
    return xuanHoaSpots.tao_pho_chi_beo;
  }

  // Matcha House: Matcha Latte, Matcha Oreo phô mai, Trà sữa freeship tới 2h sáng
  if (
    name.includes('matcha house') ||
    (name.includes('matcha') && (name.includes('oreo') || name.includes('mây muối') || name.includes('kem dừa') || name.includes('cold whisk') || name.includes('jasmine')))
  ) {
    return xuanHoaSpots.matcha_house;
  }

  // Vũ Quỳnh Chi: Kimbap cuộn, Mỳ trộn full topping ship online
  if (
    name.includes('vũ quỳnh chi') ||
    name.includes('hiển lễ') ||
    name.includes('kimbap')
  ) {
    return xuanHoaSpots.vu_quynh_chi;
  }

  // Cuốn Mộc - 48 Nguyễn Văn Linh (Lẩu bò nhúng khế, Bánh xèo, Các loại cuốn, Mì quảng)
  if (
    name.includes('cuốn mộc') ||
    name.includes('bò nhúng khế') ||
    name.includes('tiến cung') ||
    name.includes('hoàng hậu') ||
    name.includes('phở cuốn tươi') ||
    name.includes('cuốn nem mộc') ||
    name.includes('cuốn bơ xoài') ||
    name.includes('cuốn tôm bơ') ||
    name.includes('cuốn bắc bộ') ||
    name.includes('muống chẻ') ||
    name.includes('mì quảng') ||
    name.includes('cơm rang dứa') ||
    name.includes('xôi mít') ||
    name.includes('xôi xoài') ||
    name.includes('sâm dứa')
  ) {
    return xuanHoaSpots.cuon_moc;
  }

  // Beef88 - Lẩu Nướng Bò Úc (Đường Lê Quang Đạo - Đối diện Nhà Nghỉ Q2)
  if (
    name.includes('beef88') ||
    name.includes('bò úc') ||
    name.includes('nướng bò') ||
    name.includes('lẩu bò úc') ||
    name.includes('cuộn nấm kim châm') ||
    name.includes('nhà nghỉ q2')
  ) {
    return xuanHoaSpots.beef88;
  }

  // Lợn gà mẹt Xuyên Phi (Mẹt gà 7-9 món, Mẹt lợn mán, Gà không lối thoát, Gà chọi đủ món, Cá lăng nướng)
  if (
    name.includes('xuyên phi') ||
    name.includes('mẹt gà') ||
    name.includes('mẹt lợn') ||
    name.includes('lợn mán') ||
    name.includes('không lối thoát') ||
    name.includes('gà chọi') ||
    name.includes('cá lăng') ||
    name.includes('nhựa mận')
  ) {
    return xuanHoaSpots.lon_ga_xuyen_phi;
  }

  // Thịt trâu đặc sản độc quyền Phi Xuyên (Cháy tỏi, Khấu nhục, Xào răm tỏi)
  if (
    name.includes('phi xuyên') ||
    name.includes('cháy tỏi') ||
    name.includes('khấu nhục') ||
    name.includes('răm tỏi')
  ) {
    return xuanHoaSpots.trau_phi_xuyen;
  }

  // Thịt trâu đặc sản Gió Đồng (Bít tết trâu)
  if (name.includes('gió đồng')) {
    return xuanHoaSpots.trau_gio_dong;
  }

  // ZUN Food & Tea: Lê Quang Đạo, KĐT Xuân Hòa (Hotline 0392 716 756)
  if (
    name.includes('zun') ||
    name.includes('0392716756') ||
    name.includes('0392 716 756') ||
    name.includes('thuỳ dung') ||
    name.includes('thuy dung') ||
    (name.includes('lê quang đạo') && (name.includes('tea') || name.includes('food') || name.includes('mì tương đen')))
  ) {
    return xuanHoaSpots.zun_food_tea;
  }

  // Bếp Nhà Bống (Kim Đồng): Cơm tấm sườn nướng 30k, gà nướng, sườn bì chả, cá mờm rim, thịt chưng mắm tép
  if (
    name.includes('bếp nhà bống') ||
    name.includes('bep nha bong') ||
    name.includes('nhà bống') ||
    name.includes('nha bong') ||
    name.includes('0812516606') ||
    name.includes('0812 516 606') ||
    (name.includes('kim đồng') && (name.includes('cơm tấm') || name.includes('sườn'))) ||
    name.includes('cơm tấm sườn') ||
    name.includes('sườn bì chả') ||
    name.includes('cá mờm rim') ||
    name.includes('thịt chưng mắm tép')
  ) {
    return xuanHoaSpots.bep_nha_bong;
  }

  // Mỳ Gà Tần Linh Dương (Giáp Năm CS2): Mỳ gà tần, gà ác, cháo chim câu, ốc đốt, trứng non ngải cứu
  if (
    name.includes('linh dương') ||
    name.includes('linh duong') ||
    name.includes('giáp năm') ||
    name.includes('giap nam') ||
    name.includes('0961564396') ||
    name.includes('0961 564 396') ||
    name.includes('0964162235') ||
    name.includes('0964 162 235') ||
    name.includes('ốc đốt') ||
    name.includes('oc dot') ||
    (name.includes('gà tần') && !name.includes('vành đai')) ||
    (name.includes('gà đen') && !name.includes('vành đai')) ||
    (name.includes('gà ác') && (name.includes('tần') || name.includes('tiềm'))) ||
    (name.includes('chim câu') && (name.includes('tần') || name.includes('cháo'))) ||
    (name.includes('mỳ') && (name.includes('gà tần') || name.includes('trứng non') || name.includes('kê gà')))
  ) {
    return xuanHoaSpots.my_ga_tan_linh_duong;
  }

  // Lẩu Ngựa Tây Bắc: Đặc sản ngựa Tây Bắc, thắng cố, ngựa nhúng mẻ, ngựa nướng, lẩu gà, lẩu ếch
  if (
    name.includes('ngựa') ||
    name.includes('ngua') ||
    name.includes('0963047022') ||
    name.includes('0963 047 022') ||
    name.includes('miếu gỗ') ||
    name.includes('ban cơ yếu') ||
    (name.includes('tây bắc') && (name.includes('lẩu') || name.includes('thắng cố') || name.includes('ngựa')))
  ) {
    return xuanHoaSpots.lau_ngua_tay_bac;
  }

  // Món thịt trâu chung (Nướng tảng, Nhúng mẻ, Thắng cố, Xào măng trúc)
  if (
    name.includes('trâu') ||
    name.includes('thắng cố') ||
    (name.includes('nhúng mẻ') && !name.includes('ốc'))
  ) {
    return xuanHoaSpots.trau_phi_xuyen;
  }

  // Lẩu nướng 1968: Buffet nướng 134k, Bánh mì chảo 33k, Lẩu hải sản, lẩu ếch 1968, Con Chim Xanh, 19 Kim Ngọc
  if (
    name.includes('1968') ||
    name.includes('chim xanh') ||
    name.includes('kim ngọc') ||
    name.includes('0855222212') ||
    name.includes('0855 222 212') ||
    (name.includes('buffet') && name.includes('134')) ||
    (name.includes('bánh mì chảo') && (name.includes('1968') || name.includes('33k') || name.includes('chim xanh')))
  ) {
    return xuanHoaSpots.lau_nuong_1968;
  }

  // Lẩu nướng Bà Mười: Lẩu ếch măng cay, nướng chảo gang, ếch rang muối
  if (
    name.includes('bà mười') ||
    name.includes('lẩu ếch') ||
    name.includes('nướng chảo') ||
    (name.includes('ếch') && name.includes('măng')) ||
    (name.includes('ếch') && name.includes('muối'))
  ) {
    return xuanHoaSpots.lau_nuong_ba_muoi;
  }

  // Tiệm Mẹ Tít: Xôi cốm sen dừa, ôlong cốm, cốm lá nếp, bơ già dừa non, mẹ tít, 185 Nguyễn Văn Linh
  if (
    name.includes('tiệm mẹ tít') ||
    name.includes('mẹ tít') ||
    name.includes('me tit') ||
    name.includes('xôi cốm') ||
    (name.includes('xôi') && name.includes('sen')) ||
    name.includes('185 nguyễn văn linh') ||
    name.includes('0343475672') ||
    name.includes('0343 475 672') ||
    (name.includes('ôlong') && name.includes('cốm')) ||
    (name.includes('olong') && name.includes('cốm')) ||
    name.includes('cốm lá nếp') ||
    name.includes('bơ già dừa non') ||
    name.includes('thanh nhài dẻ cười') ||
    name.includes('mây trắng lá nếp')
  ) {
    return xuanHoaSpots.xoi_com_185;
  }

  // Nhà Hàng 468 Xuân Hòa: Lẩu riêu cua bắp bò, lẩu tôm bầu, cá tầm, gà nướng lu
  if (
    name.includes('468') ||
    name.includes('tôm bầu') ||
    name.includes('gà nướng lu')
  ) {
    return xuanHoaSpots.nha_hang_468;
  }

  // Mỳ cay Seoul HH - 48B Nguyễn Văn Linh: Mỳ kim chi, mỳ lẩu Thái, Tokbokki, Cơm trộn, Gà bó lắc
  if (
    name.includes('seoul') ||
    name.includes('mỳ kim chi') ||
    name.includes('mỳ lẩu thái') ||
    name.includes('tokbokki') ||
    name.includes('gà bó lắc') ||
    name.includes('gà lắc') ||
    name.includes('cơm trộn') ||
    name.includes('bibimbap') ||
    (name.includes('mỳ cay') && !name.includes('ruby'))
  ) {
    return xuanHoaSpots.my_cay_seoul;
  }

  // Quán Chim Lan Anh: Chim quay, chim sẻ, chim câu quay/hấp, xôi chim tim trứng non, lẩu chim câu cua sen thạch bì
  if (
    name.includes('lan anh') ||
    name.includes('xôi chim') ||
    name.includes('cháo chim') ||
    name.includes('chim câu') ||
    name.includes('bồ câu') ||
    name.includes('kê chim') ||
    name.includes('thạch bì') ||
    name.includes('cua sen') ||
    (name.includes('chim') && (name.includes('quay') || name.includes('hấp') || name.includes('lẩu') || name.includes('tiềm') || name.includes('sẻ')))
  ) {
    return xuanHoaSpots.quan_chim_lan_anh;
  }

  // Xuho Bistro - Quán Nhậu Nhà Táo: Má đào cháy tỏi, tóp mỡ dưa chua, trâu cháy tiêu xanh, mực nhảy, cá chép giòn...
  if (
    name.includes('xuho bistro') ||
    name.includes('nhà táo') ||
    name.includes('má đào') ||
    name.includes('tóp mỡ') ||
    name.includes('trâu cháy') ||
    name.includes('trâu chao vừng') ||
    name.includes('trâu cuốn cải') ||
    name.includes('cá chép giòn') ||
    name.includes('mực nhảy') ||
    name.includes('nem bùi') ||
    name.includes('thịt chua') ||
    name.includes('kéo pháo')
  ) {
    return xuanHoaSpots.xuho_bistro;
  }

  // Ăn Vặt Gamitra: Bánh gà, bánh đồng xu phô mai, nem chua phô mai Trần Công Châu, hamburger gà, combo gà rán
  if (
    name.includes('gamitra') ||
    name.includes('bánh gà') ||
    name.includes('bánh đồng xu') ||
    name.includes('nem chua phô mai') ||
    (name.includes('bí đao') && name.includes('hạt chia')) ||
    name.includes('hamburger gà')
  ) {
    return xuanHoaSpots.gamitra_xuan_hoa;
  }

  // Bánh cuốn tráng tay nhà Ngọc Ánh (50 Trường Chinh)
  if (
    name.includes('ngọc ánh') ||
    name.includes('bánh cuốn') ||
    (name.includes('bún chấm') && name.includes('chả nướng'))
  ) {
    return xuanHoaSpots.banh_cuon_ngoc_anh;
  }

  // Xoài Corner: Mỳ cay Xoài Corner, Trà Xoài, Bơ sữa dừa non, nước ép mix tropical, sâu tây
  if (
    name.includes('xoài corner') ||
    name.includes('bơ sữa dừa non') ||
    name.includes('trà xoài') ||
    name.includes('sâu tây') ||
    (name.includes('mỳ cay') && name.includes('xoài'))
  ) {
    return xuanHoaSpots.xoai_corner;
  }

  // Tiệm Nhà Mẹ Béo: Bún trộn, miến trộn, bún gạo lứt, mỳ tôm trộn phô mai, mẹ béo, trà chanh ủn
  if (
    name.includes('mẹ béo') ||
    name.includes('bún gạo lứt') ||
    name.includes('bún trộn') ||
    name.includes('miến trộn') ||
    (name.includes('mỳ tôm trộn') && name.includes('phô mai')) ||
    name.includes('trà chanh ủn')
  ) {
    return xuanHoaSpots.tiem_nha_me_beo;
  }

  // Tiệm Trà Thanh Thanh: Trà tự nhiên, trà mix vị, sữa chua lắc, trà chanh khổng lồ 1L, thanh thanh
  if (
    name.includes('thanh thanh') ||
    name.includes('sữa chua lắc') ||
    name.includes('lắc sữa') ||
    name.includes('quất lắc sữa') ||
    name.includes('trà chanh 1l') ||
    name.includes('trà bí đao 1l') ||
    name.includes('1 lít') ||
    name.includes('1l')
  ) {
    return xuanHoaSpots.tiem_tra_thanh_thanh;
  }

  // Mì cay, Mì trộn, Mì xào, Đồ ăn vặt (Khoai tây lắc, Khoai lang kén, Lạp xưởng nướng đá, Mẹt ăn vặt) -> RUBY 14 Nguyễn Văn Linh
  if (
    name.includes('mì cay') || 
    name.includes('mì trộn') || 
    name.includes('khoai lang kén') || 
    name.includes('khoai tây lắc') || 
    name.includes('lạp xưởng nướng đá') || 
    name.includes('bánh gạo lắc') || 
    name.includes('mẹt ăn vặt') ||
    (name.includes('mì xào') && name.includes('ruby'))
  ) {
    return xuanHoaSpots.ruby_quan;
  }

  // Đồ uống: Trà sữa kem dừa nướng, Trà sen vàng -> RUBY hoặc S.OH
  if (name.includes('dừa nướng') || name.includes('trà sen vàng') || name.includes('matcha')) {
    return xuanHoaSpots.ruby_quan;
  }

  // Đồ uống: Trà sữa kem bơ nướng, Kem cheese, Cà phê sữa dừa dầm nướng, Trà đào cam sả, Nước ép -> S.OH
  if (
    name.includes('trà sữa') || 
    name.includes('kem bơ') || 
    name.includes('kem cheese') || 
    name.includes('hồng trà') || 
    name.includes('cà phê') || 
    name.includes('cafe') || 
    name.includes('bạc xỉu') || 
    name.includes('sinh tố') || 
    name.includes('nước ép') || 
    name.includes('trà đào') || 
    name.includes('trà hoa quả') || 
    name.includes('nước dừa') || 
    name.includes('trà sáp') || 
    name.includes('lục trà') ||
    name.includes('soda')
  ) {
    return xuanHoaSpots.soh_tea;
  }

  // Quán Thúy Béo: Bánh mì Sài Gòn, Bánh mì chả cá, Trà tắc xí muội (122 Nguyễn Văn Linh)
  if (
    name.includes('thúy béo') ||
    name.includes('thuy beo') ||
    name.includes('chả cá sài gòn') ||
    name.includes('bánh mì sài gòn') ||
    name.includes('trà tắc') ||
    (name.includes('trà chanh') && !name.includes('thanh thanh') && !name.includes('1l'))
  ) {
    return xuanHoaSpots.thuy_beo;
  }

  // Bún bò Huế, Bún riêu, Bún cá, Bún cua, Bún mọc, Bún ốc -> Quán Bún Anh Toàn
  if (
    name.includes('bún bò') || 
    name.includes('bún riêu') || 
    name.includes('bún cua') || 
    name.includes('bún mọc') || 
    name.includes('bún cá') || 
    name.includes('riêu đặc biệt') || 
    name.includes('mọc') ||
    name.includes('nem lụi') ||
    name.includes('chả chan') ||
    name.includes('chả chấm')
  ) {
    return xuanHoaSpots.bun_anh_toan;
  }

  // Bánh mì: Bơ Ú (Bơ Béo), Thúy Béo, Kebab
  if (
    name.includes('bơ ú') || 
    name.includes('bơ béo') || 
    name.includes('bánh mì bơ') || 
    name.includes('bánh mỳ bơ') || 
    name.includes('siêu thịt') || 
    (name.includes('bánh mì') && name.includes('heo quay')) ||
    (name.includes('bánh mỳ') && name.includes('heo quay'))
  ) {
    return xuanHoaSpots.banh_mi_bo_u;
  }
  if (name.includes('bánh mì') || name.includes('bánh mỳ')) {
    return xuanHoaSpots.banh_mi_bo_u;
  }

  // Bún đậu, nem nướng -> Thơ Còii
  if (name.includes('bún đậu') || name.includes('nem nướng')) {
    return xuanHoaSpots.tho_coii;
  }

  // Ốc 2000 Kim Ngọc
  if (name.includes('ốc 2000') || name.includes('kim ngọc')) {
    return xuanHoaSpots.oc_2000;
  }

  // Ốc, hàu, ngao -> Quán Ốc Ngon Dốc Chợ
  if (name.includes('ốc') || name.includes('hàu') || name.includes('ngao')) {
    return xuanHoaSpots.quan_oc_ngon;
  }

  // Kem, sữa chua, chè
  if (name.includes('kem dừa') || name.includes('kem') || name.includes('sữa chua')) {
    return xuanHoaSpots.ruby_quan;
  }

  // Nem chua rán -> RUBY hoặc Thơ Còii
  if (name.includes('nem chua')) {
    return xuanHoaSpots.ruby_quan;
  }

  // Bò kho, bò né, chảo
  if (name.includes('bò kho') || name.includes('bò né') || name.includes('bánh mì chảo') || name.includes('bò sốt vang')) {
    return xuanHoaSpots.bo_kho_88;
  }

  // Sủi cảo, mì vịt tiềm
  if (name.includes('sủi cảo') || name.includes('há cảo') || name.includes('vằn thắn')) {
    return xuanHoaSpots.tieu_lau_quan;
  }

  // Trâu, bò đặc sản
  if (name.includes('trâu') || name.includes('bít tết') || name.includes('bò lúc lắc')) {
    return xuanHoaSpots.trau_phi_xuyen;
  }

  // Thịt thỏ, gà đồi
  if (name.includes('thỏ') || name.includes('gà đồi') || name.includes('gà hấp')) {
    return xuanHoaSpots.khanh_huong;
  }

  // Lẩu nướng, riêu cua
  if (name.includes('lẩu') || name.includes('sườn nướng') || name.includes('ếch')) {
    return xuanHoaSpots.lau_cuong_duong;
  }

  // Cơm rang, cơm tấm, cơm suất
  if (name.includes('cơm')) {
    return xuanHoaSpots.com_68;
  }

  // Bún chả
  if (name.includes('bún chả')) {
    return xuanHoaSpots.bun_cha_xuan_hoa;
  }

  // Phở bò, phở gà, hủ tiếu
  if (name.includes('phở') || name.includes('hủ tiếu')) {
    return xuanHoaSpots.pho_bo_xuan_hoa;
  }

  // Pizza, gà rán, burger
  if (name.includes('pizza') || name.includes('burger') || name.includes('gà rán')) {
    return xuanHoaSpots.pizza_fastfood;
  }

  // Bia hơi, quán nhậu
  if (name.includes('bia') || name.includes('nhậu') || name.includes('mực') || name.includes('chân gà')) {
    return xuanHoaSpots.nhau_1993;
  }

  // Thời trang
  if (name.includes('áo') || name.includes('quần') || name.includes('váy') || name.includes('blazer') || name.includes('sơ mi')) {
    return xuanHoaSpots.fashion_360;
  }

  // Mặc định
  return xuanHoaSpots.com_68;
}

// Lấy danh sách quán bán món này tại Xuân Hòa (quán chính xác đầu tiên, sau đó là các quán cùng bán món này)
export function getSpotsForDish(dishInput: Food | string): SpotInfo[] {
  let name = '';
  let customId = '';
  let sub = '';

  if (typeof dishInput === 'string') {
    name = dishInput.toLowerCase();
  } else if (dishInput) {
    name = dishInput.name.toLowerCase();
    customId = (dishInput.customId || '').toLowerCase();
    sub = (dishInput.sub || '').toLowerCase();
  }

  if (name.includes('bánh xèo') || name.includes('banh xeo')) {
    if (customId.includes('co_hien') || sub.includes('cô hiền') || sub.includes('90 nguyễn văn linh')) return [xuanHoaSpots.co_hien, xuanHoaSpots.cuon_moc];
    if (customId.includes('cuonmoc') || sub.includes('cuốn mộc')) return [xuanHoaSpots.cuon_moc, xuanHoaSpots.co_hien];
    return [xuanHoaSpots.co_hien, xuanHoaSpots.cuon_moc];
  }

  if (name.includes('nem lụi') || name.includes('nem lui')) {
    if (customId.includes('co_hien') || sub.includes('cô hiền')) return [xuanHoaSpots.co_hien, xuanHoaSpots.cuon_moc, xuanHoaSpots.tho_coii];
    return [xuanHoaSpots.co_hien, xuanHoaSpots.cuon_moc, xuanHoaSpots.tho_coii];
  }

    if (name.includes('bún đậu') || name.includes('bun dau')) {
    if (customId.includes('dau_oi') || sub.includes('đậu ơi') || sub.includes('47 kim ngọc')) return [xuanHoaSpots.dau_oi, xuanHoaSpots.tho_coii];
    if (customId.includes('tho_coii') || sub.includes('thơ còii')) return [xuanHoaSpots.tho_coii, xuanHoaSpots.dau_oi];
    return [xuanHoaSpots.dau_oi, xuanHoaSpots.tho_coii];
  }

  if (name.includes('cơm trộn') || name.includes('com tron')) {
    if (customId.includes('dau_oi') || sub.includes('đậu ơi') || sub.includes('47 kim ngọc')) return [xuanHoaSpots.dau_oi, xuanHoaSpots.seoul_food];
    return [xuanHoaSpots.dau_oi, xuanHoaSpots.seoul_food];
  }

    // Món đồ uống chung có mặt tại cả Lê La Cafee & Trạm Dủ Dẻ Chạm (Trùng tên)
  if (name.includes('cà phê muối') || name.includes('cafe kem muối')) {
    if (customId.includes('le_la') || sub.includes('lê la')) return [xuanHoaSpots.le_la_cafe, xuanHoaSpots.tram_du_de];
    if (customId.includes('du_de') || sub.includes('dủ dẻ')) return [xuanHoaSpots.tram_du_de, xuanHoaSpots.le_la_cafe];
    return [xuanHoaSpots.le_la_cafe, xuanHoaSpots.tram_du_de, xuanHoaSpots.xoi_com_185, xuanHoaSpots.tra_chanh_zian];
  }

  if (name.includes('trà đào cam sả') || name.includes('trà đào cam xả')) {
    if (customId.includes('le_la') || sub.includes('lê la')) return [xuanHoaSpots.le_la_cafe, xuanHoaSpots.tram_du_de];
    if (customId.includes('du_de') || sub.includes('dủ dẻ')) return [xuanHoaSpots.tram_du_de, xuanHoaSpots.le_la_cafe];
    return [xuanHoaSpots.tram_du_de, xuanHoaSpots.le_la_cafe, xuanHoaSpots.tra_chanh_zian];
  }

  if (name.includes('bạc xỉu') && !name.includes('hạnh nhân')) {
    if (customId.includes('le_la') || sub.includes('lê la')) return [xuanHoaSpots.le_la_cafe, xuanHoaSpots.tram_du_de];
    return [xuanHoaSpots.le_la_cafe, xuanHoaSpots.tram_du_de, xuanHoaSpots.soh_tea];
  }

  if (name.includes('trà sữa kem trứng dừa nướng')) {
    if (customId.includes('le_la') || sub.includes('lê la')) return [xuanHoaSpots.le_la_cafe, xuanHoaSpots.tram_du_de];
    return [xuanHoaSpots.le_la_cafe, xuanHoaSpots.tram_du_de, xuanHoaSpots.ruby_quan];
  }

  if (name.includes('sữa chua yến mạch')) {
    return [xuanHoaSpots.le_la_cafe, xuanHoaSpots.tram_du_de];
  }

  if (name.includes('ép dứa') || name.includes('ép cam') || name.includes('ép dưa hấu')) {
    return [xuanHoaSpots.tram_du_de, xuanHoaSpots.le_la_cafe, xuanHoaSpots.xoi_com_185];
  }

    // 1. Phân giải chính xác qua customId & sub của món
  if (
    customId.includes('le_la') ||
    sub.includes('lê la') ||
    name.includes('lê la') ||
    name.includes('le la') ||
    name.includes('diamond') ||
    (name.includes('matcha') && name.includes('cheese')) ||
    (name.includes('sen vàng') && (name.includes('oolong') || name.includes('tây thơm')))
  ) {
    return [xuanHoaSpots.le_la_cafe];
  }

  if (
    customId.includes('du_de') ||
    sub.includes('dủ dẻ') ||
    name.includes('dủ dẻ') ||
    name.includes('du de') ||
    name.includes('mochi kéo sợi') ||
    (name.includes('trạm') && name.includes('chạm'))
  ) {
    return [xuanHoaSpots.tram_du_de];
  }

  if (
    customId.includes('goky') ||
    sub.includes('goky') ||
    name.includes('goky') ||
    name.includes('khoai dẻo') ||
    name.includes('milo dầm') ||
    name.includes('cacao dầm')
  ) {
    return [xuanHoaSpots.goky_xuan_hoa];
  }

  if (
    customId.includes('xuan_mai') ||
    sub.includes('xuân mai') ||
    name.includes('xuân mai') ||
    (name.includes('chè') && name.includes('35 nguyễn văn linh')) ||
    (name.includes('chè thập cẩm') && name.includes('ít ngọt'))
  ) {
    return [xuanHoaSpots.che_xuan_mai];
  }

  if (
    customId.includes('nhat_ha') ||
    sub.includes('nhật hạ') ||
    name.includes('nhật hạ') ||
    sub.includes('9 đồng tâm') ||
    name.includes('buffet nem nướng') ||
    name.includes('buffet nem nuong')
  ) {
    return [xuanHoaSpots.nhat_ha];
  }

  if (
    customId.includes('tuan_hien') ||
    sub.includes('tuấn hiền') ||
    name.includes('tuấn hiền') ||
    (name.includes('bia') && name.includes('sài gòn')) ||
    (name.includes('ba chỉ quay') && name.includes('giòn bì')) ||
    (name.includes('dồi sụn') && name.includes('tuấn hiền'))
  ) {
    return [xuanHoaSpots.tuan_hien_beer];
  }

  if (
    customId.includes('salty_name') ||
    sub.includes('salty name') ||
    name.includes('salty name') ||
    name.includes('fudgy brownie') ||
    name.includes('chocomint') ||
    (name.includes('cheesecake') && (name.includes('lime') || name.includes('oreo')))
  ) {
    return [xuanHoaSpots.a_salty_name_bakery];
  }

  if (
    customId.includes('thanh_hang') ||
    sub.includes('thanh hằng') ||
    name.includes('thanh hằng') ||
    sub.includes('16 kim ngọc') ||
    name.includes('gateaux thanh hằng')
  ) {
    return [xuanHoaSpots.thanh_hang_gateaux];
  }

  if (
    customId.includes('bt55') ||
    customId.includes('banh_trang_55') ||
    sub.includes('55 nguyễn văn linh') ||
    sub.includes('55 nvl') ||
    name.includes('55 nguyễn văn linh') ||
    (name.includes('bánh tráng') && (name.includes('phơi sương') || name.includes('cuộn bơ') || name.includes('lòng đào') || name.includes('muối kẹo ly') || name.includes('tóp mỡ')))
  ) {
    return [xuanHoaSpots.banh_trang_55_nvl];
  }

  if (
    customId.includes('sb247') ||
    customId.includes('san_bia') ||
    sub.includes('sân bia 247') ||
    sub.includes('78 trường chinh') ||
    name.includes('sân bia 247') ||
    name.includes('má đào cháy tỏi') ||
    name.includes('tháp sườn chua cay') ||
    name.includes('nem ngựa') ||
    name.includes('lẩu tôm bầu')
  ) {
    return [xuanHoaSpots.san_bia_247];
  }

  if (
    customId.includes('nhungs_corner') ||
    customId.includes('nhung_corner') ||
    sub.includes("nhung's corner") ||
    sub.includes('nhung corner') ||
    sub.includes('47 kim ngọc') ||
    name.includes("nhung's corner") ||
    name.includes('cold whisk') ||
    name.includes('matcha giòn') ||
    (name.includes('hokkaido') && (name.includes('trà sữa') || name.includes('nhung'))) ||
    name.includes('matcha sữa dừa')
  ) {
    return [xuanHoaSpots.nhungs_corner];
  }

  if (
    customId.includes('vdq') ||
    customId.includes('vanh_dai') ||
    sub.includes('vành đai') ||
    sub.includes('vanh dai') ||
    name.includes('vành đai quán') ||
    name.includes('vanh dai quan') ||
    name.includes('nầm heo cháy tiêu') ||
    name.includes('ba chỉ chao giềng') ||
    name.includes('bò khế pháo') ||
    name.includes('dải chao tỏi')
  ) {
    return [xuanHoaSpots.vanh_dai_quan];
  }

  if (
    customId.includes('_lh_') ||
    customId.includes('le_huyen') ||
    sub.includes('lê huyền') ||
    sub.includes('le huyen') ||
    name.includes('lê huyền') ||
    name.includes('le huyen') ||
    (sub.includes('dốc ktx') && sub.includes('nguyễn văn linh')) ||
    (name.includes('chân dốc ktx') && (name.includes('cơm') || name.includes('kimbap') || name.includes('soda') || name.includes('nước ép')))
  ) {
    return [xuanHoaSpots.tiem_le_huyen];
  }

  if (
    customId.includes('canteen') ||
    sub.includes('canteen') ||
    name.includes('canteen') ||
    sub.includes('nội trú') ||
    sub.includes('ngõ 10') ||
    sub.includes('0967') ||
    name.includes('indomie')
  ) {
    return [xuanHoaSpots.canteen_ktx_sp2];
  }

  if (
    customId.includes('kha_do') ||
    customId.includes('dua_kha_do') ||
    sub.includes('khả do') ||
    sub.includes('kha do') ||
    sub.includes('0378 457 263') ||
    sub.includes('0378457263') ||
    (name.includes('dừa tươi') && sub.includes('khả do'))
  ) {
    return [xuanHoaSpots.quan_dua_kha_do];
  }

  if (
    customId.includes('bbh_102') ||
    customId.includes('bun_bo_102') ||
    sub.includes('102 nguyễn văn linh') ||
    sub.includes('102 nvl') ||
    sub.includes('0358 299 789') ||
    sub.includes('0979 666 839') ||
    (name.includes('bún bò huế') && sub.includes('102'))
  ) {
    return [xuanHoaSpots.bun_bo_hue_102];
  }

  if (
    customId.includes('zun') ||
    sub.includes('zun') ||
    sub.includes('0392 716 756') ||
    sub.includes('0392716756') ||
    name.includes('zun')
  ) {
    return [xuanHoaSpots.zun_food_tea];
  }

  if (
    customId.includes('bepnhabong') ||
    customId.includes('bep_nha_bong') ||
    sub.includes('bếp nhà bống') ||
    sub.includes('bep nha bong') ||
    sub.includes('0812 516 606') ||
    sub.includes('0812516606') ||
    name.includes('bếp nhà bống')
  ) {
    return [xuanHoaSpots.bep_nha_bong];
  }

  if (
    customId.includes('linhduong') ||
    sub.includes('linh dương') ||
    sub.includes('linh duong') ||
    sub.includes('0961 564 396') ||
    sub.includes('0964 162 235') ||
    sub.includes('0961564396') ||
    sub.includes('0964162235') ||
    name.includes('linh dương')
  ) {
    return [xuanHoaSpots.my_ga_tan_linh_duong];
  }

  if (
    customId.includes('xien_trung_hoa') ||
    customId.includes('trung_hoa') ||
    sub.includes('trung hoa') ||
    sub.includes('bá thiện') ||
    name.includes('xiên nướng trung hoa') ||
    name.includes('bá thiện') ||
    (name.includes('trung hoa') && (name.includes('nướng') || name.includes('xiên') || name.includes('mực') || name.includes('nộm')))
  ) {
    return [xuanHoaSpots.xien_nuong_trung_hoa];
  }

  if (
    customId.includes('thilan') ||
    customId.includes('thi_lan') ||
    sub.includes('thi lan') ||
    sub.includes('thị lan') ||
    name.includes('thi lan') ||
    name.includes('thị lan') ||
    name.includes('sốt bơ vàng') ||
    name.includes('bánh mỳ que') ||
    name.includes('bánh mì que') ||
    name.includes('thập cẩm cắt')
  ) {
    return [xuanHoaSpots.thi_lan_tea];
  }

  if (
    customId.includes('ngoc_quy') ||
    sub.includes('ngọc quý') ||
    name.includes('ngọc quý') ||
    (name.includes('181') && name.includes('nguyễn văn linh')) ||
    (name.includes('bánh mì nướng muối ớt') && !name.includes('lan phương')) ||
    (name.includes('bánh mì muối ớt') && !name.includes('lan phương')) ||
    (name.includes('bánh tráng trộn') && !name.includes('lan phương'))
  ) {
    return [xuanHoaSpots.bm_ngoc_quy];
  }

  if (
    customId.includes('cat_tien') ||
    sub.includes('cát tiên') ||
    name.includes('cát tiên') ||
    (name.includes('82') && name.includes('nguyễn văn linh')) ||
    (name.includes('trà bí đao') && (name.includes('hạt chia') || name.includes('kem mặn') || name.includes('thạch'))) ||
    (name.includes('tàu hũ') && (name.includes('kem trứng') || name.includes('socola') || name.includes('dừa nướng'))) ||
    (name.includes('trà dưa lưới') && !name.includes('thanh thanh')) ||
    (name.includes('socola bơ lạc'))
  ) {
    return [xuanHoaSpots.cat_tien];
  }

  if (
    customId.includes('lan_phuong') ||
    sub.includes('lan phương') ||
    name.includes('lan phương') ||
    name.includes('512 trường chinh') ||
    name.includes('bánh tráng cuộn') ||
    (name.includes('bánh tráng') && (name.includes('sốt bơ') || name.includes('mix') || name.includes('nướng') || name.includes('trộn'))) ||
    name.includes('bánh mì nướng muối ớt') ||
    name.includes('bánh mì muối ớt')
  ) {
    return [xuanHoaSpots.tiem_lan_phuong];
  }

  if (
    customId.includes('mr_tea') ||
    sub.includes('mr tea') ||
    name.includes('mr tea') ||
    name.includes('cơm gà viên') ||
    name.includes('gà viên lắc') ||
    (name.includes('bánh gà') && (name.includes('mr tea') || name.includes('ktx'))) ||
    (name.includes('trà sữa') && name.includes('bơ') && name.includes('mr'))
  ) {
    return [xuanHoaSpots.mr_tea];
  }

  if (
    customId.includes('zian') ||
    sub.includes('zian') ||
    name.includes('zian') ||
    name.includes('trà chanh siêu to') ||
    name.includes('trà quất siêu to')
  ) {
    return [xuanHoaSpots.tra_chanh_zian];
  }

  if (
    customId.includes('bep_thanh') ||
    sub.includes('bếp thanh') ||
    name.includes('bếp thanh') ||
    name.includes('mì lẩu cốc') ||
    name.includes('bún trộn nước tương') ||
    name.includes('cháo gà đậu xanh') ||
    (name.includes('bánh đúc nóng') && (name.includes('hà nội') || name.includes('bếp thanh')))
  ) {
    return [xuanHoaSpots.bep_thanh];
  }

  if (
    customId.includes('tao_pho') ||
    customId.includes('thach_gang') ||
    sub.includes('chị béo') ||
    name.includes('chị béo') ||
    name.includes('tào phớ') ||
    name.includes('thạch găng')
  ) {
    return [xuanHoaSpots.tao_pho_chi_beo];
  }

  if (
    customId.includes('matcha_house') ||
    sub.includes('matcha house') ||
    name.includes('matcha house')
  ) {
    return [xuanHoaSpots.matcha_house];
  }

  if (
    customId.includes('vu_quynh_chi') || 
    sub.includes('vũ quỳnh chi') || 
    sub.includes('hiển lễ') || 
    name.includes('vũ quỳnh chi') || 
    name.includes('kimbap')
  ) {
    return [xuanHoaSpots.vu_quynh_chi];
  }

  if (customId.includes('cuonmoc') || customId.includes('cuon_moc') || sub.includes('cuốn mộc')) {
    return [xuanHoaSpots.cuon_moc];
  }

  if (customId.includes('ruby')) {
    if (name.includes('mì cay') || name.includes('mỳ cay')) {
      return [xuanHoaSpots.ruby_quan, xuanHoaSpots.my_cay_seoul, xuanHoaSpots.xoai_corner];
    }
    return [xuanHoaSpots.ruby_quan];
  }

  if (customId.includes('anhtoan') || sub.includes('anh toàn')) {
    return [xuanHoaSpots.bun_anh_toan, xuanHoaSpots.bun_rieu_ba_mai, xuanHoaSpots.pho_bo_xuan_hoa];
  }

  if (customId.includes('me_soc') || sub.includes('mẹ sóc')) {
    return [xuanHoaSpots.tiem_me_soc, xuanHoaSpots.bun_cha_xuan_hoa];
  }

  if (customId.includes('bun_cha') || (name.includes('bún chả') && sub.includes('lê quang đạo'))) {
    return [xuanHoaSpots.bun_cha_xuan_hoa, xuanHoaSpots.tiem_me_soc];
  }

  if (customId.includes('bun_rieu') || sub.includes('bà mai')) {
    return [xuanHoaSpots.bun_rieu_ba_mai, xuanHoaSpots.bun_anh_toan];
  }

  if (customId.includes('pho_bo') || (name.includes('phở') && sub.includes('xuân hòa'))) {
    return [xuanHoaSpots.pho_bo_xuan_hoa, xuanHoaSpots.bun_anh_toan];
  }

  if (customId.includes('com_tam') || sub.includes('cơm tấm 82')) {
    return [xuanHoaSpots.com_tam_xuan_hoa, xuanHoaSpots.com_68];
  }

  if (customId.includes('com_rang') || sub.includes('cơm 68')) {
    return [xuanHoaSpots.com_68, xuanHoaSpots.com_tam_xuan_hoa];
  }

  if (customId.includes('sui_cao') || sub.includes('tiểu lầu')) {
    return [xuanHoaSpots.tieu_lau_quan];
  }

  if (customId.includes('bun_dau') || sub.includes('thơ còii')) {
    return [xuanHoaSpots.tho_coii];
  }

  if (customId.includes('bou') || customId.includes('bo_u') || sub.includes('bơ ú')) {
    return [xuanHoaSpots.banh_mi_bo_u, xuanHoaSpots.thuy_beo];
  }

  if (customId.includes('thuybeo') || sub.includes('thúy béo') || sub.includes('122 nguyễn văn linh')) {
    return [xuanHoaSpots.thuy_beo, xuanHoaSpots.banh_mi_bo_u];
  }

  if (customId.includes('seoul') || sub.includes('seoul')) {
    return [xuanHoaSpots.my_cay_seoul, xuanHoaSpots.ruby_quan, xuanHoaSpots.xoai_corner];
  }

  if (customId.includes('gamitra') || sub.includes('gamitra')) {
    return [xuanHoaSpots.gamitra_xuan_hoa, xuanHoaSpots.ruby_quan];
  }

  if (customId.includes('bc_') || sub.includes('ngọc ánh') || sub.includes('50 trường chinh')) {
    return [xuanHoaSpots.banh_cuon_ngoc_anh];
  }

  if (customId.includes('xc_') || sub.includes('xoài corner')) {
    return [xuanHoaSpots.xoai_corner, xuanHoaSpots.ruby_quan, xuanHoaSpots.soh_tea];
  }

  if (customId.includes('me_beo') || sub.includes('mẹ béo') || sub.includes('252e')) {
    return [xuanHoaSpots.tiem_nha_me_beo, xuanHoaSpots.ruby_quan];
  }

  if (
    customId.includes('xoi_com') ||
    customId.includes('me_tit') ||
    sub.includes('mẹ tít') ||
    sub.includes('185') ||
    name.includes('mẹ tít') ||
    name.includes('tiệm mẹ tít') ||
    name.includes('xôi cốm') ||
    name.includes('ôlong cốm')
  ) {
    return [xuanHoaSpots.xoi_com_185];
  }

  if (customId.includes('soh') || sub.includes('s.oh')) {
    return [xuanHoaSpots.soh_tea, xuanHoaSpots.ruby_quan, xuanHoaSpots.tiem_tra_thanh_thanh];
  }

  if (customId.includes('thanhthanh') || sub.includes('thanh thanh')) {
    return [xuanHoaSpots.tiem_tra_thanh_thanh, xuanHoaSpots.soh_tea, xuanHoaSpots.ruby_quan];
  }

  if (customId.includes('tocotoco') || sub.includes('tocotoco') || sub.includes('206')) {
    return [xuanHoaSpots.tocotoco, xuanHoaSpots.soh_tea, xuanHoaSpots.ruby_quan];
  }

  if (customId.includes('cafe_1975') || sub.includes('1975')) {
    return [xuanHoaSpots.cafe_1975, xuanHoaSpots.soh_tea];
  }

  if (customId.includes('xuho_bistro') || sub.includes('xuho bistro') || sub.includes('nhà táo')) {
    return [xuanHoaSpots.xuho_bistro, xuanHoaSpots.quan_chim_lan_anh, xuanHoaSpots.trau_phi_xuyen];
  }

  if (customId.includes('lan_anh') || customId.includes('chim_') || sub.includes('lan anh')) {
    return [xuanHoaSpots.quan_chim_lan_anh, xuanHoaSpots.xuho_bistro];
  }

  if (customId.includes('xuyen_phi') || customId.includes('met_ga') || customId.includes('met_lon') || sub.includes('xuyên phi')) {
    return [xuanHoaSpots.lon_ga_xuyen_phi, xuanHoaSpots.khanh_huong];
  }

  if (customId.includes('trau_') || sub.includes('phi xuyên') || sub.includes('gió đồng')) {
    return [xuanHoaSpots.trau_phi_xuyen, xuanHoaSpots.trau_gio_dong];
  }

  if (customId.includes('beef88') || sub.includes('beef88') || sub.includes('nhà nghỉ q2')) {
    return [xuanHoaSpots.beef88, xuanHoaSpots.lau_nuong_ba_muoi, xuanHoaSpots.xuho_bistro];
  }

  if (customId.includes('bamuoi') || sub.includes('bà mười')) {
    return [xuanHoaSpots.lau_nuong_ba_muoi, xuanHoaSpots.lau_cuong_duong];
  }

  if (customId.startsWith('dish_oc2000_') || customId.startsWith('drink_oc2000_') || sub.includes('ốc 2000') || sub.includes('kim ngọc')) {
    return [xuanHoaSpots.oc_2000];
  }

  if ((customId.startsWith('dish_oc_') || customId === 'dish_oc_mong_tay' || customId === 'dish_lau_oc_ngon' || sub.includes('dốc chợ')) && !customId.includes('cuonmoc')) {
    return [xuanHoaSpots.quan_oc_ngon];
  }

  if (customId.includes('trang_hai_san') || sub.includes('trang hải sản')) {
    return [xuanHoaSpots.trang_hai_san, xuanHoaSpots.quan_oc_ngon];
  }

  if (customId.includes('lau_cuong_duong') || sub.includes('cường dương')) {
    return [xuanHoaSpots.lau_cuong_duong, xuanHoaSpots.lau_nuong_ba_muoi];
  }

  if (customId.includes('khanh_huong') || sub.includes('khanh hương')) {
    return [xuanHoaSpots.khanh_huong, xuanHoaSpots.lon_ga_xuyen_phi];
  }

  if (customId.includes('binh_nam') || sub.includes('bình năm')) {
    return [xuanHoaSpots.binh_nam, xuanHoaSpots.xuho_bistro];
  }

  if (customId.includes('bia_hoi') || name.includes('bia hơi')) {
    return [xuanHoaSpots.nhau_1993, xuanHoaSpots.xuho_bistro];
  }

  if (customId === 'drink_4' || (name.includes('nâu đá') && sub.includes('xuân hòa'))) {
    return [xuanHoaSpots.cafe_1975, xuanHoaSpots.soh_tea];
  }

  if (customId === 'drink_6' || name.includes('nước mía')) {
    return [xuanHoaSpots.tiem_tra_thanh_thanh, xuanHoaSpots.thuy_beo];
  }

  // 2. Keyword fallback bảo đảm độ chính xác cao
  if (name.includes('mì cay') || name.includes('mỳ cay')) {
    return [xuanHoaSpots.ruby_quan, xuanHoaSpots.my_cay_seoul, xuanHoaSpots.xoai_corner];
  }

  if (name.includes('bún bò') || name.includes('bún riêu')) {
    return [xuanHoaSpots.bun_anh_toan, xuanHoaSpots.bun_rieu_ba_mai, xuanHoaSpots.pho_bo_xuan_hoa];
  }

  if (name.includes('bún chả')) {
    return [xuanHoaSpots.tiem_me_soc, xuanHoaSpots.bun_cha_xuan_hoa];
  }

  if (name.includes('phở')) {
    return [xuanHoaSpots.pho_bo_xuan_hoa, xuanHoaSpots.bun_anh_toan];
  }

  if (name.includes('cơm tấm')) {
    return [xuanHoaSpots.com_tam_xuan_hoa, xuanHoaSpots.com_68];
  }

  if (name.includes('cơm rang') || name.includes('cơm sườn')) {
    return [xuanHoaSpots.com_68, xuanHoaSpots.com_tam_xuan_hoa];
  }

  if (name.includes('bánh mì') || name.includes('bánh mỳ')) {
    return [xuanHoaSpots.banh_mi_bo_u, xuanHoaSpots.thuy_beo];
  }

  if (
    customId.includes('ngua') ||
    customId.includes('tay_bac') ||
    sub.includes('lẩu ngựa') ||
    sub.includes('ngựa') ||
    sub.includes('tây bắc') ||
    sub.includes('0963047022') ||
    sub.includes('0963 047 022') ||
    sub.includes('miếu gỗ') ||
    sub.includes('ban cơ yếu') ||
    name.includes('ngựa') ||
    name.includes('ngua')
  ) {
    return [xuanHoaSpots.lau_ngua_tay_bac, xuanHoaSpots.trau_phi_xuyen, xuanHoaSpots.trau_gio_dong];
  }

  if (name.includes('trâu') || name.includes('thắng cố')) {
    return [xuanHoaSpots.trau_phi_xuyen, xuanHoaSpots.trau_gio_dong];
  }

  if (name.includes('chim câu') || name.includes('xôi chim')) {
    return [xuanHoaSpots.quan_chim_lan_anh, xuanHoaSpots.xuho_bistro];
  }

  if (name.includes('ốc') || name.includes('hàu')) {
    return [xuanHoaSpots.quan_oc_ngon];
  }

  if (name.includes('trà sữa') || name.includes('kem dừa') || name.includes('kem bơ')) {
    return [xuanHoaSpots.soh_tea, xuanHoaSpots.ruby_quan, xuanHoaSpots.tiem_tra_thanh_thanh, xuanHoaSpots.tocotoco];
  }

  if (name.includes('trà đào') || name.includes('trà chanh') || name.includes('trà xoài') || name.includes('trà tắc')) {
    return [xuanHoaSpots.tiem_tra_thanh_thanh, xuanHoaSpots.ruby_quan, xuanHoaSpots.soh_tea, xuanHoaSpots.xoai_corner];
  }

  return [getSpotForDish(name)];
}

// Lấy danh sách 2-3 quán cùng phong cách ẩm thực tại Xuân Hòa (loại trừ quán đang chọn)
export function getSimilarSpotsForDish(dishInput: Food | string, primarySpot?: SpotInfo): SpotInfo[] {
  let name = '';
  let customId = '';
  let sub = '';

  if (typeof dishInput === 'string') {
    name = dishInput.toLowerCase();
  } else if (dishInput) {
    name = dishInput.name.toLowerCase();
    customId = (dishInput.customId || '').toLowerCase();
    sub = (dishInput.sub || '').toLowerCase();
  }

  const allText = `${name} ${customId} ${sub}`;

  // 1. Nhóm Nhậu & Lẩu Nướng (Bò Úc, trâu, chim, ếch, mẹt gà, lợn mán, má đào, tóp mỡ, hải sản, ốc, lẩu riêu)
  if (
    allText.includes('vành đai') || allText.includes('vanh dai') || allText.includes('đậm mồi') || allText.includes('nầm heo') ||
    allText.includes('bò úc') || allText.includes('beef88') ||
    allText.includes('trâu') || allText.includes('chim') || allText.includes('mẹt gà') || 
    allText.includes('lợn mán') || allText.includes('má đào') || allText.includes('tóp mỡ') || 
    allText.includes('lẩu') || allText.includes('ốc') || allText.includes('hải sản') || 
    allText.includes('bia') || allText.includes('nướng chảo') || allText.includes('xuho') ||
    allText.includes('sân bia') || allText.includes('tháp sườn') || allText.includes('nem ngựa') ||
    allText.includes('trung hoa') || allText.includes('bá thiện') || allText.includes('xiên nướng') ||
    allText.includes('tuấn hiền') || allText.includes('ba chỉ quay') || allText.includes('dồi sụn') ||
    allText.includes('lan anh') || allText.includes('xuyên phi') || allText.includes('bà mười') ||
    allText.includes('cường dương') || allText.includes('bình năm') || allText.includes('khanh hương') ||
    allText.includes('ngựa') || allText.includes('ngua') || allText.includes('tây bắc') || allText.includes('thắng cố')
  ) {
    const nhanGroup = [
      xuanHoaSpots.lau_ngua_tay_bac,
      xuanHoaSpots.vanh_dai_quan,
      xuanHoaSpots.san_bia_247,
      xuanHoaSpots.tuan_hien_beer,
      xuanHoaSpots.xien_nuong_trung_hoa,
      xuanHoaSpots.lau_nuong_1968,
      xuanHoaSpots.beef88,
      xuanHoaSpots.xuho_bistro,
      xuanHoaSpots.quan_chim_lan_anh,
      xuanHoaSpots.trau_phi_xuyen,
      xuanHoaSpots.lau_nuong_ba_muoi,
      xuanHoaSpots.quan_oc_ngon,
      xuanHoaSpots.oc_2000,
      xuanHoaSpots.trang_hai_san,
      xuanHoaSpots.lau_cuong_duong,
      xuanHoaSpots.lon_ga_xuyen_phi,
      xuanHoaSpots.binh_nam,
      xuanHoaSpots.trau_gio_dong,
    ];
    return nhanGroup.filter(s => !primarySpot || s.name !== primarySpot.name).slice(0, 3);
  }

  // 2. Nhóm Cafe & Đồ Uống (Tiệm Mẹ Tít, Lê La Cafee, Trạm Dủ Dẻ Chạm, GoKy, Lan Phương, Mr Tea, Trà chanh ZIAN, trà sữa, trà trái cây, matcha, cafe, sữa chua lắc, nước mía)
  if (
    allText.includes('mẹ tít') || allText.includes('me tit') ||
    allText.includes('lê la') || allText.includes('le la') || allText.includes('diamond') ||
    allText.includes('dủ dẻ') || allText.includes('du de') || allText.includes('mochi') ||
    allText.includes('goky') || allText.includes('khoai dẻo') || allText.includes('milo dầm') ||
    allText.includes('lan phương') || allText.includes('512 trường chinh') ||
    allText.includes('mr tea') || allText.includes('zian') || allText.includes('siêu to') ||
    allText.includes('trà') || allText.includes('matcha') || allText.includes('cà phê') || allText.includes('cafe') || 
    allText.includes('sữa chua') || allText.includes('sinh tố') || allText.includes('nước mía') ||
    allText.includes('bơ sữa') || allText.includes('soh') || allText.includes('thanh thanh') ||
    allText.includes('chè') || allText.includes('xuân mai') ||
    allText.includes("nhung's corner") || allText.includes('cold whisk') || allText.includes('matcha giòn') || allText.includes('hokkaido') ||
    allText.includes('bánh ngọt') || allText.includes('cheesecake') || allText.includes('gateaux') || allText.includes('bento') ||
    allText.includes('tocotoco') || allText.includes('1975') || allText.includes('matcha house')
  ) {
    const drinkGroup = [
      xuanHoaSpots.nhungs_corner,
      xuanHoaSpots.thanh_hang_gateaux,
      xuanHoaSpots.a_salty_name_bakery,
      xuanHoaSpots.che_xuan_mai,
      xuanHoaSpots.cat_tien,
      xuanHoaSpots.xoi_com_185,
      xuanHoaSpots.le_la_cafe,
      xuanHoaSpots.tram_du_de,
      xuanHoaSpots.goky_xuan_hoa,
      xuanHoaSpots.tiem_lan_phuong,
      xuanHoaSpots.mr_tea,
      xuanHoaSpots.tra_chanh_zian,
      xuanHoaSpots.matcha_house,
      xuanHoaSpots.soh_tea,
      xuanHoaSpots.tiem_tra_thanh_thanh,
      xuanHoaSpots.ruby_quan,
      xuanHoaSpots.tocotoco,
      xuanHoaSpots.cafe_1975,
      xuanHoaSpots.xoai_corner,
      xuanHoaSpots.zun_food_tea,
    ];
    return drinkGroup.filter(s => !primarySpot || s.name !== primarySpot.name).slice(0, 3);
  }

  // 3. Nhóm Ăn Vặt & Mì Cay
  if (
    allText.includes('zun') || allText.includes('mì tương đen') ||
    allText.includes('dủ dẻ') || allText.includes('du de') ||
    allText.includes('goky') || allText.includes('khoai dẻo') || allText.includes('milo dầm') ||
    allText.includes('lan phương') || allText.includes('bánh tráng') || allText.includes('muối ớt') ||
    allText.includes('mr tea') || allText.includes('cơm gà') || allText.includes('gà viên') ||
    allText.includes('zian') ||
    allText.includes("nhung's corner") || allText.includes('nhung corner') ||
    allText.includes('bếp thanh') || allText.includes('mì lẩu cốc') ||
    allText.includes('tào phớ') || allText.includes('thạch găng') || allText.includes('chị béo') ||
    allText.includes('mì cay') || allText.includes('mỳ cay') || allText.includes('mì xào') || 
    allText.includes('mì trộn') || allText.includes('ăn vặt') || allText.includes('nem chua') || 
    allText.includes('bánh gà') || allText.includes('khoai') || allText.includes('viên chiên') || 
    allText.includes('dồi sụn') || allText.includes('lạp xưởng') || allText.includes('bánh mì') || 
    allText.includes('bánh mỳ') || allText.includes('tokbokki') || allText.includes('gamitra') || 
    allText.includes('thi lan') || allText.includes('thị lan') || allText.includes('sốt bơ vàng') || allText.includes('bánh mỳ que') ||
    allText.includes('chè') || allText.includes('xuân mai') ||
    allText.includes('nhật hạ') || allText.includes('nem nướng') ||
    allText.includes('bánh ngọt') || allText.includes('cheesecake') || allText.includes('gateaux') || allText.includes('bento') ||
    allText.includes('bơ ú') || allText.includes('thúy béo')
  ) {
    const snackGroup = [
      xuanHoaSpots.zun_food_tea,
      xuanHoaSpots.nhungs_corner,
      xuanHoaSpots.banh_trang_55_nvl,
      xuanHoaSpots.thanh_hang_gateaux,
      xuanHoaSpots.a_salty_name_bakery,
      xuanHoaSpots.nhat_ha,
      xuanHoaSpots.che_xuan_mai,
      xuanHoaSpots.thi_lan_tea,
      xuanHoaSpots.bm_ngoc_quy,
      xuanHoaSpots.tram_du_de,
      xuanHoaSpots.goky_xuan_hoa,
      xuanHoaSpots.tiem_lan_phuong,
      xuanHoaSpots.mr_tea,
      xuanHoaSpots.bep_thanh,
      xuanHoaSpots.tao_pho_chi_beo,
      xuanHoaSpots.ruby_quan,
      xuanHoaSpots.my_cay_seoul,
      xuanHoaSpots.xoai_corner,
      xuanHoaSpots.gamitra_xuan_hoa,
      xuanHoaSpots.banh_mi_bo_u,
      xuanHoaSpots.thuy_beo,
    ];
    return snackGroup.filter(s => !primarySpot || s.name !== primarySpot.name).slice(0, 3);
  }

  // 4. Nhóm Cơm & Bún Phở (Bún bò, bún riêu, bún chả, bún đậu, phở bò, cơm tấm, cơm rang, sủi cảo, bánh cuốn, xôi cốm, bánh đúc, cháo gà, cơm gà viên)
  const mainDishGroup = [
    xuanHoaSpots.mr_tea,
    xuanHoaSpots.bep_thanh,
    xuanHoaSpots.bun_anh_toan,
    xuanHoaSpots.bun_rieu_ba_mai,
    xuanHoaSpots.tiem_me_soc,
    xuanHoaSpots.bun_cha_xuan_hoa,
    xuanHoaSpots.pho_bo_xuan_hoa,
    xuanHoaSpots.com_tam_xuan_hoa,
    xuanHoaSpots.com_68,
    xuanHoaSpots.tieu_lau_quan,
    xuanHoaSpots.tho_coii,
    xuanHoaSpots.banh_cuon_ngoc_anh,
    xuanHoaSpots.tiem_nha_me_beo,
    xuanHoaSpots.xoi_com_185,
  ];
  return mainDishGroup.filter(s => !primarySpot || s.name !== primarySpot.name).slice(0, 3);
}

// Lấy 2-3 món ăn gợi ý tương đương với giá tiền (thấp hơn, ngang bằng, hoặc cao hơn một chút)
export function getRelatedDishes(food: Food, activeFoods: Food[]): Food[] {
  if (!food || !activeFoods || activeFoods.length <= 1) return [];

  const text = `${food.name} ${food.customId || ''} ${food.sub || ''}`.toLowerCase();

  // Xác định dòng ẩm thực
  const isNhau = text.includes('bò úc') || text.includes('beef88') || text.includes('trâu') || text.includes('chim') || text.includes('mẹt gà') || text.includes('lợn mán') || text.includes('má đào') || text.includes('tóp mỡ') || text.includes('lẩu') || text.includes('ốc') || text.includes('hải sản') || text.includes('bia') || text.includes('ếch') || text.includes('ngựa') || text.includes('ngua') || text.includes('thắng cố');
  const isDrink = text.includes('trà') || text.includes('cà phê') || text.includes('cafe') || text.includes('sữa') || text.includes('sinh tố') || text.includes('nước mía');
  const isMiCayOrSnack = text.includes('mì cay') || text.includes('mỳ cay') || text.includes('mì xào') || text.includes('mì trộn') || text.includes('khoai') || text.includes('nem chua') || text.includes('bánh gà') || text.includes('viên chiên') || text.includes('dồi sụn') || text.includes('lạp xưởng') || text.includes('tokbokki');
  const isBanhMi = text.includes('bánh mì') || text.includes('bánh mỳ') || text.includes('bơ ú') || text.includes('pate');
  const isBunPho = text.includes('bún') || text.includes('phở') || text.includes('sủi cảo') || text.includes('bánh cuốn') || text.includes('xôi cốm');
  const isCom = text.includes('cơm');

  const pool = activeFoods.filter(f => f.name !== food.name && (!food.customId || f.customId !== food.customId));

  // Lọc các món cùng dòng ẩm thực
  const matched = pool.filter(f => {
    const fText = `${f.name} ${f.customId || ''} ${f.sub || ''}`.toLowerCase();
    if (isNhau) {
      return fText.includes('bò úc') || fText.includes('beef88') || fText.includes('trâu') || fText.includes('chim') || fText.includes('mẹt gà') || fText.includes('lợn mán') || fText.includes('má đào') || fText.includes('tóp mỡ') || fText.includes('lẩu') || fText.includes('ốc') || fText.includes('hải sản') || fText.includes('bia') || fText.includes('ếch') || fText.includes('ngựa') || fText.includes('ngua') || fText.includes('thắng cố');
    }
    if (isDrink) {
      return fText.includes('trà') || fText.includes('cà phê') || fText.includes('cafe') || fText.includes('sữa') || fText.includes('sinh tố') || fText.includes('nước mía');
    }
    if (isMiCayOrSnack) {
      return fText.includes('mì cay') || fText.includes('mỳ cay') || fText.includes('mì xào') || fText.includes('mì trộn') || fText.includes('khoai') || fText.includes('nem chua') || fText.includes('bánh gà') || fText.includes('viên chiên') || fText.includes('dồi sụn') || fText.includes('lạp xưởng') || fText.includes('tokbokki');
    }
    if (isBanhMi) {
      return fText.includes('bánh mì') || fText.includes('bánh mỳ') || fText.includes('bơ ú') || fText.includes('bánh cuốn');
    }
    if (isCom) {
      return fText.includes('cơm');
    }
    if (isBunPho) {
      return fText.includes('bún') || fText.includes('phở') || fText.includes('sủi cảo') || fText.includes('bánh cuốn') || fText.includes('xôi cốm');
    }
    return false;
  });

  // Nếu trong cùng dòng ẩm thực có >= 3 món thì ưu tiên, ngược lại lấy pool toàn bộ
  const candidatePool = matched.length >= 3 ? matched : pool;

  // Phân chia thành 3 nhóm theo giá so với food.price:
  // 1. Nhóm giá thấp hơn (tiết kiệm hơn: price < food.price)
  const lowerCandidates = candidatePool
    .filter(f => f.price < food.price)
    .sort((a, b) => Math.abs((food.price - a.price) - 10) - Math.abs((food.price - b.price) - 10));

  // 2. Nhóm ngang giá hoặc gần sát (price gần bằng food.price)
  const equalCandidates = candidatePool
    .filter(f => Math.abs(f.price - food.price) <= 5)
    .sort((a, b) => Math.abs(a.price - food.price) - Math.abs(b.price - food.price));

  // 3. Nhóm giá cao hơn (nâng tầm: price > food.price)
  const higherCandidates = candidatePool
    .filter(f => f.price > food.price)
    .sort((a, b) => Math.abs((a.price - food.price) - 10) - Math.abs((b.price - food.price) - 10));

  const result: Food[] = [];

  // Lấy 1 món giá thấp hơn (nếu có)
  if (lowerCandidates.length > 0) {
    result.push(lowerCandidates[0]);
  }

  // Lấy 1 món ngang giá (nếu có và chưa chọn)
  const equalPick = equalCandidates.find(f => !result.some(r => r.name === f.name));
  if (equalPick) {
    result.push(equalPick);
  }

  // Lấy 1 món giá cao hơn (nếu có và chưa chọn)
  const higherPick = higherCandidates.find(f => !result.some(r => r.name === f.name));
  if (higherPick) {
    result.push(higherPick);
  }

  // Nếu chưa đủ 3 món (ví dụ món hiện tại quá rẻ hoặc quá đắt), bù thêm các món gần giá nhất
  if (result.length < 3) {
    const remaining = candidatePool
      .filter(f => !result.some(r => r.name === f.name))
      .sort((a, b) => Math.abs(a.price - food.price) - Math.abs(b.price - food.price));

    for (const item of remaining) {
      if (result.length >= 3) break;
      result.push(item);
    }
  }

  // Sắp xếp thứ tự giá tăng dần: [Thấp hơn -> Ngang giá -> Cao hơn]
  return result.sort((a, b) => a.price - b.price);
}
