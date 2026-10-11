import { foods, type Food } from './foods';

const getFood = (id: number): Food | undefined => foods.find(f => f.image === id);

/**
 * KHO LƯU TRỮ MÓN ĂN CHƯA CÓ QUÁN BÁN TẠI XUÂN HÒA (WAREHOUSE POOL)
 * 
 * Lưu trữ nguyên vẹn các món ăn tổng hợp, quốc tế hoặc món chưa có đối tác/quán ăn
 * xác thực bán tại Phường Xuân Hòa.
 * Khi có quán ăn mới tại Xuân Hòa mở bán món nào, có thể lôi món đó ra khỏi kho
 * hoặc tạo mới liên kết với quán.
 * 
 * Quy định: TẤT CẢ các món trong kho này KHÔNG hiển thị ở menu đề xuất hay vòng quay
 * cho đến khi được gán cho một quán xác thực cụ thể.
 */

// 1. Món ăn bữa chính chưa có quán bán tại Xuân Hòa
export const warehouseMealIds = [
  7,   // Cơm chay
  8,   // Bibimbap cơm trộn tổng hợp
  9,   // Cơm gà Hội An
  11,  // Hủ tiếu Nam Vang
  12,  // Mì Quảng
  13,  // Bún thịt nướng miền Nam
  18,  // Bánh xèo miền Tây
  19,  // Bánh đa cua Hải Phòng
  23,  // Cháo sườn nóng
  36,  // Cơm bình dân tự chọn
  39,  // Cơm gà xối mỡ
  43,  // Bánh canh cua
  44,  // Bò né chảo gang
  47,  // Cơm chiên hải sản
  72,  // Phở gà đồi
  75,  // Bún măng vịt
  76,  // Bún bò Nam Bộ
  77,  // Bún mắm hải sản
  79,  // Bánh canh giò heo
  80,  // Miến gà
  81,  // Miến lươn
  87,  // Mì hoành thánh
  90,  // Cơm niêu Singapore
  91,  // Cơm gà Hải Nam
  107, // Bánh mì kebab SP2
  122, // Bò kho bánh mì
  131, // Miến xào bò
  168, // Cơm đậu hũ Mapo
  169, // Cơm gà Kung Pao
  170, // Mì Dan Dan Tứ Xuyên
  600, // Bánh mì trứng
  601, // Xôi xéo
  602, // Xôi bắp
  603, // Xôi mặn
];

// 2. Món ăn vặt xế chiều chưa có quán bán tại Xuân Hòa
export const warehouseAfternoonSnackIds = [
  156, // Bánh tráng trộn
  160, // Takoyaki bánh bạch tuộc
  300, // Bánh tráng nướng
  301, // Bánh tráng cuốn
  302, // Bánh tráng bơ
  303, // Bột chiên trứng
  304, // Há cảo tôm
  305, // Sủi cảo chiên
  306, // Bánh gối
  307, // Bánh rán mặn
  308, // Bánh giò nóng
  350, // Chè bưởi
  351, // Chè thái sầu riêng
  352, // Tào phớ đường phèn
  353, // Sữa chua dẻo trân châu
];

// 3. Món nhậu & lẩu nướng chung chưa có quán bán tại Xuân Hòa (IDs 400 đến 447)
export const warehouseNhauIds = [
  32,  // Lẩu nấm tươi
  68,  // Sườn nướng BBQ tảng lớn
  71,  // Lẩu bò bắp hoa
  101, // Lẩu Thái chua cay chung
  102, // Lẩu sukiyaki bò Mỹ
  113, // Gà nướng than hoa chung
  ...Array.from({ length: 48 }, (_, i) => 400 + i),
];

// 4. Đồ uống chung chưa có quán bán tại Xuân Hòa (IDs 132-155 và 500-547)
export const warehouseDrinkIds = [
  ...Array.from({ length: 24 }, (_, i) => 132 + i),
  ...Array.from({ length: 48 }, (_, i) => 500 + i),
];

/**
 * Danh sách toàn bộ món ăn lưu trong kho
 */
export const warehouseFoods: Food[] = [
  ...(warehouseMealIds.map(getFood).filter(Boolean) as Food[]),
  ...(warehouseAfternoonSnackIds.map(getFood).filter(Boolean) as Food[]),
  ...(warehouseNhauIds.map(getFood).filter(Boolean) as Food[]),
  ...(warehouseDrinkIds.map(getFood).filter(Boolean) as Food[]),
];

/**
 * Tìm kiếm món ăn trong kho theo tên
 */
export function findInWarehouse(nameQuery: string): Food[] {
  const q = nameQuery.toLowerCase().trim();
  return warehouseFoods.filter(f => f.name.toLowerCase().includes(q));
}
