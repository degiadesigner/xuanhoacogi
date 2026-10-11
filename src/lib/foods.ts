import { priceRarity } from './case-mechanics';

export type Food = {
  customId?: string;
  customImage?: string;
  name: string;
  sub: string;
  price: number;
  rarity: number;
  image: number;
  veg?: boolean;
  quip: string;
  kind?: string;
  category?: string;
  meals?: string[];
  iconEmoji?: string;
};

// Approximate lunch portion prices in thousands of VND, not restaurant quotes.
export const foods: Food[] = [
  {
    "name": "Cơm tấm",
    "sub": "Sườn bì chả • Việt Nam",
    "price": 70,
    "image": 0,
    "quip": "Sườn có thể gãy. Kèo này thì không."
  },
  {
    "name": "Phở bò",
    "sub": "Tái nạm • Việt Nam",
    "price": 70,
    "image": 1,
    "quip": "Đời có thể nhạt. Nước phở thì không."
  },
  {
    "name": "Bánh mì",
    "sub": "Thịt nướng • Việt Nam",
    "price": 25,
    "image": 2,
    "quip": "Vũ khí cận chiến của dân văn phòng."
  },
  {
    "name": "Bún chả",
    "sub": "Chả nướng • Việt Nam",
    "price": 50,
    "image": 3,
    "quip": "Một pha gắp chả đi vào lòng người."
  },
  {
    "name": "Sushi cá hồi",
    "sub": "Cá hồi • Nhật Bản",
    "price": 150,
    "image": 4,
    "quip": "Legendary drop. Ví bạn vừa disconnect."
  },
  {
    "name": "Pizza",
    "sub": "Phô mai • Ý",
    "price": 100,
    "image": 5,
    "quip": "Một miếng cho bạn. Phần còn lại cũng vậy."
  },
  {
    "name": "Gà rán",
    "sub": "Giòn cay • Quốc tế",
    "price": 65,
    "image": 6,
    "quip": "Winner winner, chicken lunch."
  },
  {
    "name": "Cơm chay",
    "sub": "Đậu hũ & rau • Việt Nam",
    "price": 35,
    "image": 7,
    "quip": "Ăn chay nhưng chiến hết mình.",
    "veg": true
  },
  {
    "name": "Bibimbap",
    "sub": "Cơm trộn • Hàn Quốc",
    "price": 65,
    "image": 8,
    "quip": "Trộn cơm. Đừng trộn deadline."
  },
  {
    "name": "Cơm gà Hội An",
    "sub": "Món ăn trưa",
    "price": 45,
    "image": 9,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún bò Huế",
    "sub": "Món ăn trưa",
    "price": 50,
    "image": 10,
    "quip": "",
    "veg": false
  },
  {
    "name": "Hủ tiếu",
    "sub": "Món ăn trưa",
    "price": 60,
    "image": 11,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì Quảng",
    "sub": "Món ăn trưa",
    "price": 50,
    "image": 12,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún thịt nướng",
    "sub": "Món ăn trưa",
    "price": 40,
    "image": 13,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bánh cuốn",
    "sub": "Món ăn trưa",
    "price": 35,
    "image": 14,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún đậu mắm tôm",
    "sub": "Món ăn trưa",
    "price": 55,
    "image": 15,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm rang dưa bò",
    "sub": "Món ăn trưa",
    "price": 50,
    "image": 16,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bò lúc lắc",
    "sub": "Món ăn trưa",
    "price": 85,
    "image": 17,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bánh xèo",
    "sub": "Món ăn trưa",
    "price": 50,
    "image": 18,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bánh đa cua",
    "sub": "Món ăn trưa",
    "price": 45,
    "image": 19,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì xào bò",
    "sub": "Món ăn trưa",
    "price": 60,
    "image": 20,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún cá",
    "sub": "Món ăn trưa",
    "price": 55,
    "image": 21,
    "quip": "",
    "veg": false
  },
  {
    "name": "Gỏi cuốn",
    "sub": "Món ăn trưa",
    "price": 35,
    "image": 22,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cháo sườn",
    "sub": "Món ăn trưa",
    "price": 40,
    "image": 23,
    "quip": "",
    "veg": false
  },
  {
    "name": "Ramen",
    "sub": "Món ăn trưa",
    "price": 120,
    "image": 24,
    "quip": "",
    "veg": false
  },
  {
    "name": "Udon",
    "sub": "Món ăn trưa",
    "price": 85,
    "image": 25,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm cà ri Nhật",
    "sub": "Món ăn trưa",
    "price": 90,
    "image": 26,
    "quip": "",
    "veg": false
  },
  {
    "name": "Tteokbokki",
    "sub": "Món ăn trưa",
    "price": 40,
    "image": 27,
    "quip": "",
    "veg": false
  },
  {
    "name": "Burger bò",
    "sub": "Món ăn trưa",
    "price": 65,
    "image": 28,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì Ý bò bằm",
    "sub": "Món ăn trưa",
    "price": 80,
    "image": 29,
    "quip": "",
    "veg": false
  },
  {
    "name": "Pad Thai",
    "sub": "Món ăn trưa",
    "price": 75,
    "image": 30,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì Tom Yum",
    "sub": "Món ăn trưa",
    "price": 60,
    "image": 31,
    "quip": "",
    "veg": false
  },
  {
    "name": "Lẩu nấm chay",
    "sub": "Chay",
    "price": 120,
    "image": 32,
    "quip": "",
    "veg": true
  },
  {
    "name": "Mì nấm chay",
    "sub": "Chay",
    "price": 40,
    "image": 33,
    "quip": "",
    "veg": true
  },
  {
    "name": "Bánh mì chay",
    "sub": "Chay",
    "price": 25,
    "image": 34,
    "quip": "",
    "veg": true
  },
  {
    "name": "Gỏi cuốn chay",
    "sub": "Chay",
    "price": 35,
    "image": 35,
    "quip": "",
    "veg": true
  },
  {
    "name": "Cơm bình dân",
    "sub": "Chọn món mặn, rau & canh",
    "price": 40,
    "image": 36,
    "quip": ""
  },
  {
    "name": "Cơm gà xối mỡ",
    "sub": "Phần ăn trưa / người",
    "price": 60,
    "image": 39,
    "quip": ""
  },
  {
    "name": "Bún riêu",
    "sub": "Phần ăn trưa / người",
    "price": 45,
    "image": 42,
    "quip": ""
  },
  {
    "name": "Bánh canh cua",
    "sub": "Phần ăn trưa / người",
    "price": 65,
    "image": 43,
    "quip": ""
  },
  {
    "name": "Bò né",
    "sub": "Phần ăn trưa / người",
    "price": 75,
    "image": 44,
    "quip": ""
  },
  {
    "name": "Cơm gà teriyaki",
    "sub": "Phần ăn trưa / người",
    "price": 85,
    "image": 45,
    "quip": ""
  },
  {
    "name": "Cơm heo chiên xù",
    "sub": "Phần ăn trưa / người",
    "price": 95,
    "image": 46,
    "quip": ""
  },
  {
    "name": "Cơm chiên hải sản",
    "sub": "Phần ăn trưa / người",
    "price": 85,
    "image": 47,
    "quip": ""
  },
  {
    "name": "Mì vịt tiềm",
    "sub": "Phần ăn trưa / người",
    "price": 95,
    "image": 48,
    "quip": ""
  },
  {
    "name": "Kimbap",
    "sub": "Phần ăn trưa / người",
    "price": 55,
    "image": 49,
    "quip": ""
  },
  {
    "name": "Mì trộn Hàn Quốc",
    "sub": "Phần ăn trưa / người",
    "price": 60,
    "image": 50,
    "quip": ""
  },
  {
    "name": "Salad ức gà",
    "sub": "Phần ăn trưa / người",
    "price": 85,
    "image": 51,
    "quip": ""
  },
  {
    "name": "Mì Ý sốt kem bacon",
    "sub": "Phần ăn trưa / người",
    "price": 115,
    "image": 52,
    "quip": ""
  },
  {
    "name": "Lasagna bò",
    "sub": "Phần ăn trưa / người",
    "price": 160,
    "image": 53,
    "quip": ""
  },
  {
    "name": "Burger bò phô mai & khoai tây",
    "sub": "Phần ăn trưa / người",
    "price": 120,
    "image": 54,
    "quip": ""
  },
  {
    "name": "Pizza pepperoni",
    "sub": "Phần ăn trưa / người",
    "price": 140,
    "image": 55,
    "quip": ""
  },
  {
    "name": "Cơm bò gyudon",
    "sub": "Phần ăn trưa / người",
    "price": 90,
    "image": 56,
    "quip": ""
  },
  {
    "name": "Cơm cá saba nướng",
    "sub": "Phần ăn trưa / người",
    "price": 125,
    "image": 57,
    "quip": ""
  },
  {
    "name": "Mì soba Nhật",
    "sub": "Phần ăn trưa / người",
    "price": 110,
    "image": 58,
    "quip": ""
  },
  {
    "name": "Cơm cà ri Thái",
    "sub": "Phần ăn trưa / người",
    "price": 110,
    "image": 59,
    "quip": ""
  },
  {
    "name": "Salad cá ngừ",
    "sub": "Phần ăn trưa / người",
    "price": 110,
    "image": 60,
    "quip": ""
  },
  {
    "name": "Salad quinoa đậu gà",
    "sub": "Phần ăn trưa / người",
    "price": 115,
    "image": 61,
    "quip": "",
    "veg": true
  },
  {
    "name": "Bò bít tết",
    "sub": "Phần ăn trưa / người",
    "price": 180,
    "image": 62,
    "quip": ""
  },
  {
    "name": "Cá hồi áp chảo",
    "sub": "Phần ăn trưa / người",
    "price": 190,
    "image": 63,
    "quip": ""
  },
  {
    "name": "Cơm lươn Nhật",
    "sub": "Phần ăn trưa / người",
    "price": 180,
    "image": 64,
    "quip": ""
  },
  {
    "name": "Cơm bò nướng Hàn",
    "sub": "Phần ăn trưa / người",
    "price": 150,
    "image": 65,
    "quip": ""
  },
  {
    "name": "Cơm cá hồi teriyaki",
    "sub": "Phần ăn trưa / người",
    "price": 150,
    "image": 66,
    "quip": ""
  },
  {
    "name": "Poke cá hồi",
    "sub": "Phần ăn trưa / người",
    "price": 160,
    "image": 67,
    "quip": ""
  },
  {
    "name": "Sườn nướng BBQ",
    "sub": "Kèm cơm hoặc khoai tây • Phần một người",
    "price": 230,
    "image": 68,
    "quip": ""
  },
  {
    "name": "Pizza hải sản",
    "sub": "Phần ăn trưa / người",
    "price": 160,
    "image": 69,
    "quip": ""
  },
  {
    "name": "Mì Ý hải sản",
    "sub": "Phần ăn trưa / người",
    "price": 160,
    "image": 70,
    "quip": ""
  },
  {
    "name": "Lẩu bò cá nhân",
    "sub": "Phần ăn trưa / người",
    "price": 160,
    "image": 71,
    "quip": ""
  },
  {
    "name": "Phở gà",
    "sub": "Tô thường • Việt Nam",
    "price": 55,
    "image": 72,
    "quip": "",
    "veg": false
  },
  {
    "name": "Phở cuốn",
    "sub": "Phần 10 cuốn • Việt Nam",
    "price": 70,
    "image": 73,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún mọc",
    "sub": "Tô thường • Việt Nam",
    "price": 60,
    "image": 74,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún măng vịt",
    "sub": "Tô có thịt vịt • Việt Nam",
    "price": 60,
    "image": 75,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún bò Nam Bộ",
    "sub": "Bún trộn bò • Việt Nam",
    "price": 70,
    "image": 76,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún mắm",
    "sub": "Tô hải sản • Việt Nam",
    "price": 65,
    "image": 77,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bún chay",
    "sub": "Đậu hũ & rau • Việt Nam",
    "price": 35,
    "image": 78,
    "quip": "",
    "veg": true
  },
  {
    "name": "Bánh canh giò heo",
    "sub": "Tô thường • Việt Nam",
    "price": 55,
    "image": 79,
    "quip": "",
    "veg": false
  },
  {
    "name": "Miến gà",
    "sub": "Tô thường • Việt Nam",
    "price": 55,
    "image": 80,
    "quip": "",
    "veg": false
  },
  {
    "name": "Miến lươn",
    "sub": "Tô thường • Việt Nam",
    "price": 65,
    "image": 81,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cháo vịt",
    "sub": "Phần có thịt vịt • Việt Nam",
    "price": 55,
    "image": 82,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cháo lòng",
    "sub": "Phần có lòng • Việt Nam",
    "price": 40,
    "image": 83,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bánh hỏi heo quay",
    "sub": "Một phần • Việt Nam",
    "price": 50,
    "image": 84,
    "quip": "",
    "veg": false
  },
  {
    "name": "Nem nướng",
    "sub": "Phần cuốn đủ bữa • Việt Nam",
    "price": 55,
    "image": 85,
    "quip": "",
    "veg": false
  },
  {
    "name": "Dimsum",
    "sub": "Khoảng 3 xửng / người",
    "price": 130,
    "image": 86,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì hoành thánh",
    "sub": "Tô mì & hoành thánh",
    "price": 60,
    "image": 87,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì bò Đài Loan",
    "sub": "Bò hầm & mì • Đài Loan",
    "price": 85,
    "image": 88,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì xào giòn",
    "sub": "Hải sản & rau củ",
    "price": 80,
    "image": 89,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm niêu Singapore",
    "sub": "Một niêu / người",
    "price": 85,
    "image": 90,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm gà Hải Nam",
    "sub": "Gà luộc & cơm thơm",
    "price": 75,
    "image": 91,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm gà trứng Nhật",
    "sub": "Oyakodon • Nhật Bản",
    "price": 100,
    "image": 92,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm tempura",
    "sub": "Tendon • Nhật Bản",
    "price": 130,
    "image": 93,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì cay Hàn Quốc",
    "sub": "Một tô • Hàn Quốc",
    "price": 75,
    "image": 94,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì tương đen",
    "sub": "Jajangmyeon • Hàn Quốc",
    "price": 60,
    "image": 95,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì lạnh Hàn Quốc",
    "sub": "Naengmyeon • Hàn Quốc",
    "price": 95,
    "image": 96,
    "quip": "",
    "veg": false
  },
  {
    "name": "Canh kimchi kèm cơm",
    "sub": "Kimchi jjigae • Hàn Quốc",
    "price": 70,
    "image": 97,
    "quip": "",
    "veg": false
  },
  {
    "name": "Canh đậu hũ non kèm cơm",
    "sub": "Sundubu jjigae • Hàn Quốc",
    "price": 70,
    "image": 98,
    "quip": "",
    "veg": false
  },
  {
    "name": "Gà phô mai Hàn Quốc",
    "sub": "Phần một người",
    "price": 120,
    "image": 99,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm chiên kimchi",
    "sub": "Kimchi bokkeumbap • Hàn Quốc",
    "price": 65,
    "image": 100,
    "quip": "",
    "veg": false
  },
  {
    "name": "Lẩu Thái một người",
    "sub": "Kèm bún hoặc mì",
    "price": 130,
    "image": 101,
    "quip": "",
    "veg": false
  },
  {
    "name": "Lẩu sukiyaki một người",
    "sub": "Thịt, rau & mì • Nhật Bản",
    "price": 220,
    "image": 102,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cà ri Ấn Độ & naan",
    "sub": "Cà ri gà kèm bánh naan",
    "price": 220,
    "image": 103,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm biryani",
    "sub": "Cơm gia vị & gà • Ấn Độ",
    "price": 190,
    "image": 104,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bánh xèo Nhật",
    "sub": "Okonomiyaki • Nhật Bản",
    "price": 90,
    "image": 105,
    "quip": "",
    "veg": false
  },
  {
    "name": "Sandwich",
    "sub": "Phần bánh kẹp đủ bữa",
    "price": 80,
    "image": 106,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bánh mì kebab",
    "sub": "Doner kebab • Thổ Nhĩ Kỳ",
    "price": 35,
    "image": 107,
    "quip": "",
    "veg": false
  },
  {
    "name": "Bánh cuộn gà",
    "sub": "Chicken wrap",
    "price": 80,
    "image": 108,
    "quip": "",
    "veg": false
  },
  {
    "name": "Burrito",
    "sub": "Cuộn cơm, đậu & thịt • Mexico",
    "price": 150,
    "image": 109,
    "quip": "",
    "veg": false
  },
  {
    "name": "Taco",
    "sub": "Phần 3 bánh • Mexico",
    "price": 150,
    "image": 110,
    "quip": "",
    "veg": false
  },
  {
    "name": "Quesadilla",
    "sub": "Phô mai & gà • Mexico",
    "price": 140,
    "image": 111,
    "quip": "",
    "veg": false
  },
  {
    "name": "Fish & chips",
    "sub": "Cá chiên & khoai tây",
    "price": 170,
    "image": 112,
    "quip": "",
    "veg": false
  },
  {
    "name": "Gà nướng kèm khoai tây",
    "sub": "Phần một người",
    "price": 140,
    "image": 113,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mac & cheese",
    "sub": "Nui phô mai • Phần chính",
    "price": 150,
    "image": 114,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì Ý pesto",
    "sub": "Húng quế & gà • Ý",
    "price": 170,
    "image": 115,
    "quip": "",
    "veg": false
  },
  {
    "name": "Mì Ý cá hồi",
    "sub": "Sốt kem cá hồi • Ý",
    "price": 230,
    "image": 116,
    "quip": "",
    "veg": false
  },
  {
    "name": "Cơm risotto",
    "sub": "Cơm Ý • Phần chính",
    "price": 260,
    "image": 117,
    "quip": "",
    "veg": false
  },
  {
    "name": "Gnocchi",
    "sub": "Bánh khoai tây kiểu Ý",
    "price": 130,
    "image": 118,
    "quip": "",
    "veg": false
  },
  {
    "name": "Falafel kèm pita",
    "sub": "Đậu gà, rau & bánh pita",
    "price": 90,
    "image": 119,
    "quip": "",
    "veg": true
  },
  {
    "name": "Nui xào bò",
    "sub": "Nui, bò & rau • Việt Nam",
    "price": 50,
    "image": 120,
    "quip": "Nui deadline lại. Ăn trước đã."
  },
  {
    "name": "Cháo gà",
    "sub": "Gà xé & hành tiêu • Việt Nam",
    "price": 45,
    "image": 121,
    "quip": "Một bát hồi máu giữa giờ làm."
  },
  {
    "name": "Bò kho bánh mì",
    "sub": "Bò hầm & bánh mì • Việt Nam",
    "price": 65,
    "image": 122,
    "quip": "Chấm bánh mì. Đừng chấm công muộn."
  },
  {
    "name": "Xôi mặn",
    "sub": "Gà, thịt hoặc chả • Việt Nam",
    "price": 35,
    "image": 123,
    "quip": "Dẻo dai đến hết ca chiều."
  },
  {
    "name": "Bánh mì chảo",
    "sub": "Pate, trứng ốp, xúc xích • Lẩu Nướng 1968 (33k) & Bò Né 88",
    "price": 45,
    "image": 124,
    "quip": "Nóng hơn cả nhóm chat công ty."
  },
  {
    "name": "Cơm xá xíu",
    "sub": "Thịt xá xíu & cơm • Món Hoa",
    "price": 55,
    "image": 125,
    "quip": "Xá xíu một chút. No cả buổi."
  },
  {
    "name": "Cơm vịt quay",
    "sub": "Vịt quay & cơm • Món Hoa",
    "price": 75,
    "image": 126,
    "quip": "Da giòn. Tinh thần cũng lên."
  },
  {
    "name": "Mì xá xíu",
    "sub": "Mì trứng & thịt xá xíu • Món Hoa",
    "price": 65,
    "image": 127,
    "quip": "Sợi mì dài hơn thời gian nghỉ trưa."
  },
  {
    "name": "Mì udon xào",
    "sub": "Hải sản & rau • Nhật Bản",
    "price": 150,
    "image": 128,
    "quip": "Sợi to. Kèo thơm."
  },
  {
    "name": "Burger gà & khoai tây",
    "sub": "Gà giòn & khoai tây • Quốc tế",
    "price": 80,
    "image": 129,
    "quip": "Cắn một phát. Hết phân vân."
  },
  {
    "name": "Mì Ý sốt cà chua & phô mai",
    "sub": "Cà chua & mascarpone • Ý",
    "price": 170,
    "image": 130,
    "quip": "Sốt cà chua cứu một ngày nhạt nhẽo."
  },
  {
    "name": "Miến xào",
    "sub": "Thịt & rau • Việt Nam",
    "price": 55,
    "image": 131,
    "quip": "Miến này không phải miếng mồi deadline."
  },
  {
    "name": "Cà phê đen đá",
    "sub": "Cà phê phin & đá • Một ly",
    "price": 25,
    "image": 132,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Cà phê sữa đá",
    "sub": "Cà phê phin & sữa đặc • Một ly",
    "price": 30,
    "image": 133,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Bạc xỉu",
    "sub": "Nhiều sữa, chút cà phê • Một ly",
    "price": 30,
    "image": 134,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Latte",
    "sub": "Espresso & sữa tươi • Một ly",
    "price": 55,
    "image": 135,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Trà sữa trân châu",
    "sub": "Trà sữa & trân châu bột năng • Một ly",
    "price": 35,
    "image": 136,
    "quip": "",
    "category": "milk-tea"
  },
  {
    "name": "Trà sữa ô long",
    "sub": "Trà ô long & sữa • Một ly",
    "price": 35,
    "image": 137,
    "quip": "",
    "category": "milk-tea"
  },
  {
    "name": "Matcha latte",
    "sub": "Trà xanh matcha & sữa • Một ly",
    "price": 40,
    "image": 138,
    "quip": "",
    "category": "milk-tea"
  },
  {
    "name": "Trà sữa Thái",
    "sub": "Trà Thái & sữa đặc • Một ly",
    "price": 30,
    "image": 139,
    "quip": "",
    "category": "milk-tea"
  },
  {
    "name": "Trà đào cam sả",
    "sub": "Trà, đào, cam & sả • Một ly",
    "price": 35,
    "image": 140,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Trà vải",
    "sub": "Trà & vải • Một ly",
    "price": 30,
    "image": 141,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Trà chanh",
    "sub": "Trà & chanh tươi • Một ly",
    "price": 20,
    "image": 142,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Trà tắc",
    "sub": "Trà & tắc tươi • Một ly",
    "price": 20,
    "image": 143,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Nước ép cam",
    "sub": "Cam ép • Một ly",
    "price": 30,
    "image": 144,
    "quip": "",
    "category": "juice"
  },
  {
    "name": "Nước ép dưa hấu",
    "sub": "Dưa hấu ép • Một ly",
    "price": 30,
    "image": 145,
    "quip": "",
    "category": "juice"
  },
  {
    "name": "Nước ép dứa",
    "sub": "Dứa ép • Một ly",
    "price": 30,
    "image": 146,
    "quip": "",
    "category": "juice"
  },
  {
    "name": "Nước ép ổi",
    "sub": "Ổi ép • Một ly",
    "price": 30,
    "image": 147,
    "quip": "",
    "category": "juice"
  },
  {
    "name": "Sinh tố bơ",
    "sub": "Bơ xay & sữa • Một ly",
    "price": 35,
    "image": 148,
    "quip": "",
    "category": "smoothie"
  },
  {
    "name": "Sinh tố xoài",
    "sub": "Xoài xay & sữa • Một ly",
    "price": 35,
    "image": 149,
    "quip": "",
    "category": "smoothie"
  },
  {
    "name": "Sinh tố dâu",
    "sub": "Dâu tây xay & sữa • Một ly",
    "price": 40,
    "image": 150,
    "quip": "",
    "category": "smoothie"
  },
  {
    "name": "Sinh tố chuối",
    "sub": "Chuối xay & sữa • Một ly",
    "price": 35,
    "image": 151,
    "quip": "",
    "category": "smoothie"
  },
  {
    "name": "Nước dừa",
    "sub": "Nước dừa tươi • Một phần",
    "price": 25,
    "image": 152,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Nước mía",
    "sub": "Mía ép & đá • Một ly",
    "price": 20,
    "image": 153,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Sữa đậu nành",
    "sub": "Đậu nành nấu • Một ly",
    "price": 15,
    "image": 154,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Nước sâm",
    "sub": "Nước thảo mộc thanh mát • Một ly",
    "price": 20,
    "image": 155,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Bánh tráng trộn",
    "sub": "Bánh tráng, khô bò & trứng cút • Một phần",
    "price": 30,
    "image": 156,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Cá viên chiên",
    "sub": "Cá viên chiên kèm tương • Một phần",
    "price": 30,
    "image": 157,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Nem chua rán",
    "sub": "Nem rán giòn • Phần 5 chiếc",
    "price": 40,
    "image": 158,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Khoai tây chiên",
    "sub": "Khoai tây chiên giòn • Một phần",
    "price": 30,
    "image": 159,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Takoyaki",
    "sub": "Bánh bạch tuộc • Phần 6 viên",
    "price": 35,
    "image": 160,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh flan",
    "sub": "Caramen trứng sữa • Một bánh",
    "price": 15,
    "image": 161,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè đậu đen",
    "sub": "Đậu đen & nước cốt dừa • Một chén",
    "price": 30,
    "image": 162,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh trứng nướng",
    "sub": "Vỏ bánh giòn & nhân trứng sữa • Một bánh",
    "price": 25,
    "image": 163,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh cheesecake",
    "sub": "Bánh phô mai & quả mọng • Một lát",
    "price": 80,
    "image": 164,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Trái cây dầm",
    "sub": "Trái cây tươi & sữa chua • Một phần",
    "price": 40,
    "image": 165,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Sữa chua nếp cẩm",
    "sub": "Sữa chua & nếp cẩm • Một hũ",
    "price": 20,
    "image": 166,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Hạt điều rang",
    "sub": "Hạt điều rang giòn • Phần nhỏ 60 g",
    "price": 40,
    "image": 167,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Cơm đậu hũ Mapo",
    "sub": "Đậu hũ, thịt heo băm, sốt tê cay và cơm • Trung Quốc",
    "price": 80,
    "image": 168,
    "quip": "Tê cay vừa đủ để quên câu hỏi ăn gì.",
    "veg": false,
    "kind": "food",
    "category": "rice"
  },
  {
    "name": "Cơm gà Kung Pao",
    "sub": "Gà xào đậu phộng, ớt khô, hành và cơm • Trung Quốc",
    "price": 95,
    "image": 169,
    "quip": "Gà, đậu phộng và một bữa trưa có đáp án.",
    "veg": false,
    "kind": "food",
    "category": "rice"
  },
  {
    "name": "Mì Dan Dan Tứ Xuyên",
    "sub": "Mì lúa mì, thịt heo băm, cải muối và dầu ớt • Trung Quốc",
    "price": 160,
    "image": 170,
    "quip": "Trộn đều rồi để đũa quyết định.",
    "veg": false,
    "kind": "food",
    "category": "noodles"
  },
  {
    "name": "Cháo thịt nạc trứng bắc thảo",
    "sub": "Cháo gạo, thịt heo nạc, trứng bắc thảo và gừng • Trung Quốc",
    "price": 50,
    "image": 171,
    "quip": "Một bát cháo ấm cho ngày cần chậm lại.",
    "veg": false,
    "kind": "food",
    "category": "hotpot"
  },
  {
    "name": "Cơm heo xào cay Jeyuk",
    "sub": "Thịt heo xào tương ớt, hành tây và cơm • Hàn Quốc",
    "price": 100,
    "image": 172,
    "quip": "Bữa trưa cay một chút, đỡ nhạt một ngày.",
    "veg": false,
    "kind": "food",
    "category": "rice"
  },
  {
    "name": "Gà hầm sâm Samgyetang",
    "sub": "Gà non nhồi gạo nếp, nhân sâm, tỏi và táo tàu • Hàn Quốc",
    "price": 250,
    "image": 173,
    "quip": "Gà hầm nóng hổi, cứ thong thả thưởng thức.",
    "veg": false,
    "kind": "food",
    "category": "hotpot"
  },
  {
    "name": "Canh sườn bò Galbitang kèm cơm",
    "sub": "Sườn bò hầm củ cải, hành lá và cơm trắng • Hàn Quốc",
    "price": 270,
    "image": 174,
    "quip": "Canh nóng, cơm trắng, bữa này đã đủ.",
    "veg": false,
    "kind": "food",
    "category": "hotpot"
  },
  {
    "name": "Mì Kalguksu hải sản",
    "sub": "Mì cắt dao, nghêu, tôm và nước dùng hải sản • Hàn Quốc",
    "price": 150,
    "image": 175,
    "quip": "Mì tươi và vị biển trong một tô.",
    "veg": false,
    "kind": "food",
    "category": "noodles"
  },
  {
    "name": "Cơm cuộn trứng Omurice",
    "sub": "Cơm chiên gà bọc trứng, sốt cà chua • Nhật Bản",
    "price": 75,
    "image": 176,
    "quip": "Mở lớp trứng, gặp cơm gà bên trong.",
    "veg": false,
    "kind": "food",
    "category": "rice"
  },
  {
    "name": "Cơm heo xào gừng Shogayaki",
    "sub": "Heo áp chảo sốt gừng, bắp cải và cơm • Nhật Bản",
    "price": 80,
    "image": 177,
    "quip": "Thơm gừng rồi, đến giờ nghỉ trưa thôi.",
    "veg": false,
    "kind": "food",
    "category": "rice"
  },
  {
    "name": "Cơm thịt băm Hambagu",
    "sub": "Thịt bò, heo băm áp chảo, sốt nâu và cơm • Nhật Bản",
    "price": 120,
    "image": 178,
    "quip": "Thịt mềm, sốt nâu, cơm trắng chờ sẵn.",
    "veg": false,
    "kind": "food",
    "category": "rice"
  },
  {
    "name": "Cơm trà cá hồi Ochazuke",
    "sub": "Cơm chan trà và dashi, cá hồi chín, rong biển • Nhật Bản",
    "price": 100,
    "image": 179,
    "quip": "Cơm chan trà, một bữa nhẹ nhàng.",
    "veg": false,
    "kind": "food",
    "category": "rice"
  },
  {
    "name": "Masala dosa",
    "sub": "Bánh gạo đậu nhân khoai tây, sambar và chutney • Nam Ấn Độ",
    "price": 115,
    "image": 180,
    "quip": "Bánh giòn ôm khoai tây thơm gia vị.",
    "veg": true,
    "kind": "food",
    "category": "bread"
  },
  {
    "name": "Chole bhature",
    "sub": "Đậu gà nấu gia vị, 2 bánh bhature chiên • Bắc Ấn Độ",
    "price": 165,
    "image": 181,
    "quip": "Bẻ bánh, chấm đậu gà, hết phân vân.",
    "veg": true,
    "kind": "food",
    "category": "bread"
  },
  {
    "name": "Palak paneer kèm cơm",
    "sub": "Phô mai paneer sốt cải bó xôi, cơm basmati • Bắc Ấn Độ",
    "price": 200,
    "image": 182,
    "quip": "Xanh màu cải bó xôi, béo vị paneer.",
    "veg": true,
    "kind": "food",
    "category": "rice"
  },
  {
    "name": "Gà tandoori kèm naan",
    "sub": "Gà nướng ướp sữa chua, gia vị, bánh naan • Bắc Ấn Độ",
    "price": 220,
    "image": 183,
    "quip": "Gà thơm lò nướng, xé naan ăn cùng.",
    "veg": false,
    "kind": "food",
    "category": "grill"
  },
  {
    "name": "Bánh tráng nướng",
    "sub": "Trứng, xúc xích & hành • Một bánh",
    "price": 25,
    "image": 300,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh tráng cuốn",
    "sub": "Bánh tráng, khô bò & trứng cút • Một phần",
    "price": 30,
    "image": 301,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh tráng bơ",
    "sub": "Bánh tráng, sốt bơ & ruốc • Một phần",
    "price": 25,
    "image": 302,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bột chiên",
    "sub": "Bột chiên trứng & đu đủ bào • Một đĩa nhỏ",
    "price": 35,
    "image": 303,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Há cảo tôm",
    "sub": "Há cảo hấp nhân tôm • Phần 5 viên",
    "price": 35,
    "image": 304,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Sủi cảo chiên",
    "sub": "Vỏ giòn, nhân thịt • Phần 5 chiếc",
    "price": 35,
    "image": 305,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh gối",
    "sub": "Nhân thịt, miến & mộc nhĩ • Hai bánh",
    "price": 30,
    "image": 306,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh rán mặn",
    "sub": "Vỏ nếp giòn, nhân thịt • Ba bánh",
    "price": 25,
    "image": 307,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh giò",
    "sub": "Bột gạo, thịt băm & mộc nhĩ • Một bánh",
    "price": 25,
    "image": 308,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh đúc nóng",
    "sub": "Bánh đúc mềm, thịt băm & hành phi • Một bát",
    "price": 25,
    "image": 309,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh bèo",
    "sub": "Bánh bèo tôm chấy & mỡ hành • Phần 6 chén",
    "price": 35,
    "image": 310,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh bột lọc",
    "sub": "Bánh bột lọc nhân tôm thịt • Phần 6 chiếc",
    "price": 35,
    "image": 311,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh nậm",
    "sub": "Bột gạo, tôm thịt gói lá • Phần 4 bánh",
    "price": 25,
    "image": 312,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bánh khọt",
    "sub": "Bánh giòn nhân tôm & rau sống • Phần 6 bánh",
    "price": 30,
    "image": 313,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bắp xào tôm khô",
    "sub": "Bắp, tôm khô & hành lá • Một ly",
    "price": 30,
    "image": 314,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bắp nướng mỡ hành",
    "sub": "Bắp nướng thơm & hành lá • Một trái",
    "price": 15,
    "image": 315,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Bắp luộc",
    "sub": "Bắp luộc nóng • Một trái",
    "price": 12,
    "image": 316,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Khoai lang nướng",
    "sub": "Khoai lang nướng nguyên củ • Một củ",
    "price": 20,
    "image": 317,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Khoai lang kén",
    "sub": "Khoai lang viên chiên giòn • Một phần",
    "price": 25,
    "image": 318,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Phô mai que",
    "sub": "Phô mai tẩm bột chiên • Phần 3 que",
    "price": 50,
    "image": 319,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Xúc xích nướng",
    "sub": "Xúc xích nướng kèm tương • Hai cây",
    "price": 25,
    "image": 320,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Chân gà sả tắc",
    "sub": "Chân gà ngâm sả, tắc & ớt • Một phần",
    "price": 80,
    "image": 321,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Chân gà nướng",
    "sub": "Chân gà nướng sa tế • Phần 4 chiếc",
    "price": 90,
    "image": 322,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Trứng cút lộn xào me",
    "sub": "Trứng cút lộn, sốt me & rau răm • Một phần",
    "price": 30,
    "image": 323,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Ốc luộc",
    "sub": "Ốc hấp sả, chấm mắm gừng • Một phần nhỏ",
    "price": 40,
    "image": 324,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Ốc xào dừa",
    "sub": "Ốc len xào nước cốt dừa • Một phần nhỏ",
    "price": 50,
    "image": 325,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Sò điệp nướng mỡ hành",
    "sub": "Sò điệp, hành lá & đậu phộng • Phần 4 con",
    "price": 50,
    "image": 326,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Khô gà lá chanh",
    "sub": "Khô gà xé cay nhẹ • Phần nhỏ 50 g",
    "price": 30,
    "image": 327,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Khô bò sợi",
    "sub": "Khô bò xé sợi • Phần nhỏ 50 g",
    "price": 45,
    "image": 328,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Mực rim me",
    "sub": "Mực khô rim chua ngọt • Phần nhỏ 50 g",
    "price": 30,
    "image": 329,
    "quip": "",
    "kind": "snack",
    "category": "snack-savoury"
  },
  {
    "name": "Chuối chiên",
    "sub": "Chuối ép chiên giòn • Hai bánh",
    "price": 20,
    "image": 330,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh cam",
    "sub": "Vỏ mè, nhân đậu xanh • Phần 3 bánh",
    "price": 25,
    "image": 331,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh tiêu",
    "sub": "Bánh tiêu phủ mè • Hai bánh",
    "price": 20,
    "image": 332,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh bò hấp",
    "sub": "Bánh bò mềm & nước cốt dừa • Một phần",
    "price": 20,
    "image": 333,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh bò nướng",
    "sub": "Bánh bò lá dứa nướng • Hai lát",
    "price": 25,
    "image": 334,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh da lợn",
    "sub": "Lá dứa, đậu xanh & cốt dừa • Một phần",
    "price": 20,
    "image": 335,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh khoai mì nướng",
    "sub": "Khoai mì & nước cốt dừa • Hai lát",
    "price": 25,
    "image": 336,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh chuối hấp",
    "sub": "Chuối hấp, cốt dừa & mè • Một phần",
    "price": 20,
    "image": 337,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh su kem",
    "sub": "Bánh su nhân kem sữa • Phần 4 bánh",
    "price": 25,
    "image": 338,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bông lan trứng muối",
    "sub": "Bông lan, trứng muối & chà bông • Một hộp nhỏ",
    "price": 40,
    "image": 339,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè bưởi",
    "sub": "Cùi bưởi, đậu xanh & cốt dừa • Một ly",
    "price": 25,
    "image": 340,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè Thái",
    "sub": "Mít, thạch & sữa dừa • Một ly",
    "price": 35,
    "image": 341,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè ba màu",
    "sub": "Đậu đỏ, đậu xanh & thạch lá dứa • Một ly",
    "price": 30,
    "image": 342,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè đậu xanh",
    "sub": "Đậu xanh nấu mềm & cốt dừa • Một chén",
    "price": 25,
    "image": 343,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè đậu đỏ",
    "sub": "Đậu đỏ & nước cốt dừa • Một ly",
    "price": 25,
    "image": 344,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè trôi nước",
    "sub": "Viên nếp nhân đậu xanh & nước gừng • Một chén",
    "price": 25,
    "image": 345,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè khoai dẻo",
    "sub": "Khoai dẻo, thạch & sữa dừa • Một chén",
    "price": 30,
    "image": 346,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Chè sương sa hạt lựu",
    "sub": "Thạch, hạt lựu & đậu xanh • Một ly",
    "price": 30,
    "image": 347,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Tào phớ",
    "sub": "Tàu hũ mềm & nước đường gừng • Một chén",
    "price": 15,
    "image": 348,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Sữa chua mít",
    "sub": "Sữa chua, mít & thạch • Một chén",
    "price": 25,
    "image": 349,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Kem dừa",
    "sub": "Kem dừa, dừa sợi & đậu phộng • Một phần",
    "price": 35,
    "image": 350,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Kem xôi",
    "sub": "Xôi lá dứa & kem dừa • Một chén",
    "price": 30,
    "image": 351,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Kem chuối",
    "sub": "Chuối, cốt dừa & đậu phộng • Một miếng",
    "price": 15,
    "image": 352,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Bánh đúc lá dứa",
    "sub": "Bánh đúc ngọt, cốt dừa & nước đường • Một phần",
    "price": 25,
    "image": 353,
    "quip": "",
    "kind": "snack",
    "category": "snack-sweet"
  },
  {
    "name": "Đậu phộng rang",
    "sub": "Đậu phộng rang muối • Phần nhỏ 50 g",
    "price": 15,
    "image": 354,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Hạt hướng dương",
    "sub": "Hạt hướng dương rang • Phần nhỏ 50 g",
    "price": 15,
    "image": 355,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Hạt bí rang",
    "sub": "Hạt bí rang giòn • Phần nhỏ 50 g",
    "price": 20,
    "image": 356,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Hạt dẻ rang",
    "sub": "Hạt dẻ rang nóng • Phần nhỏ 100 g",
    "price": 25,
    "image": 357,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Rong biển sấy",
    "sub": "Rong biển sấy giòn vị muối • Một gói nhỏ",
    "price": 20,
    "image": 358,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Đậu nành rang",
    "sub": "Đậu nành rang giòn • Phần nhỏ 50 g",
    "price": 15,
    "image": 359,
    "quip": "",
    "kind": "snack",
    "category": "snack-light"
  },
  {
    "name": "Dưa hấu",
    "sub": "Dưa hấu tươi cắt miếng • Phần 250 g",
    "price": 20,
    "image": 360,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Dưa lưới",
    "sub": "Dưa lưới tươi cắt miếng • Phần 200 g",
    "price": 30,
    "image": 361,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Ổi",
    "sub": "Ổi tươi cắt miếng • Phần 200 g",
    "price": 20,
    "image": 362,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Xoài chín",
    "sub": "Xoài chín cắt miếng • Phần 200 g",
    "price": 25,
    "image": 363,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Cóc",
    "sub": "Cóc tươi gọt vỏ • Phần 200 g",
    "price": 20,
    "image": 364,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Thơm (dứa)",
    "sub": "Thơm tươi cắt miếng, còn gọi là khóm • Phần 200 g",
    "price": 30,
    "image": 365,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Bưởi",
    "sub": "Bưởi bóc múi • Phần 200 g",
    "price": 30,
    "image": 366,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Cam",
    "sub": "Cam tươi cắt múi • Một trái",
    "price": 20,
    "image": 367,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Quýt",
    "sub": "Quýt bóc vỏ • Phần 2 trái",
    "price": 20,
    "image": 368,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Thanh long",
    "sub": "Thanh long tươi cắt miếng • Phần 200 g",
    "price": 20,
    "image": 369,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Đu đủ",
    "sub": "Đu đủ chín cắt miếng • Phần 200 g",
    "price": 35,
    "image": 370,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Chuối",
    "sub": "Chuối chín • Hai trái nhỏ",
    "price": 10,
    "image": 371,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Mít",
    "sub": "Mít bóc múi, bỏ hạt • Phần 150 g",
    "price": 30,
    "image": 372,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Sầu riêng",
    "sub": "Cơm sầu riêng tách múi • Phần 150 g",
    "price": 65,
    "image": 373,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Măng cụt",
    "sub": "Măng cụt tươi • Phần 250 g",
    "price": 35,
    "image": 374,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Chôm chôm",
    "sub": "Chôm chôm tươi • Phần 250 g",
    "price": 25,
    "image": 375,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Nhãn",
    "sub": "Nhãn tươi • Phần 250 g",
    "price": 25,
    "image": 376,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Vải",
    "sub": "Vải tươi • Phần 250 g",
    "price": 30,
    "image": 377,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Mãng cầu ta (na)",
    "sub": "Na chín tách miếng • Một trái",
    "price": 25,
    "image": 378,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Sapoche",
    "sub": "Hồng xiêm chín cắt miếng • Phần 200 g",
    "price": 35,
    "image": 379,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Vú sữa",
    "sub": "Vú sữa chín • Một trái",
    "price": 25,
    "image": 380,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Nho",
    "sub": "Nho tươi • Phần 200 g",
    "price": 35,
    "image": 381,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Táo",
    "sub": "Táo tươi cắt miếng • Một trái",
    "price": 25,
    "image": 382,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Roi (mận miền Nam)",
    "sub": "Roi tươi cắt miếng • Phần 200 g",
    "price": 25,
    "image": 383,
    "quip": "",
    "kind": "snack",
    "category": "snack-fruit"
  },
  {
    "name": "Đậu tẩm hành",
    "sub": "Đậu rán phủ hành lá • Một đĩa",
    "price": 60,
    "image": 400,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Tóp mỡ xào dưa",
    "sub": "Tóp mỡ & dưa cải chua • Một đĩa",
    "price": 120,
    "image": 401,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Dưa chuột",
    "sub": "Dưa chuột tươi thái miếng • Một đĩa",
    "price": 20,
    "image": 402,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Lạc rang",
    "sub": "Lạc rang giòn • Một đĩa nhỏ",
    "price": 20,
    "image": 403,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Nem chua rán",
    "sub": "Nem rán giòn • Phần 5 chiếc",
    "price": 40,
    "image": 404,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Chân gà sả tắc",
    "sub": "Chân gà, sả & tắc • Một phần",
    "price": 80,
    "image": 405,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Ngô chiên",
    "sub": "Ngô ngọt chiên giòn • Một đĩa",
    "price": 45,
    "image": 406,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Khoai tây chiên",
    "sub": "Khoai tây chiên giòn • Một đĩa",
    "price": 45,
    "image": 407,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Mực khô nướng xé",
    "sub": "Mực khô nướng xé sợi • Một phần",
    "price": 120,
    "image": 408,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Lòng xào dưa",
    "sub": "Lòng heo & dưa cải chua • Một đĩa",
    "price": 150,
    "image": 409,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Sụn gà rang muối",
    "sub": "Sụn gà giòn & muối rang • Một đĩa",
    "price": 130,
    "image": 410,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Gỏi xoài khô bò",
    "sub": "Xoài xanh, khô bò & rau thơm • Một đĩa",
    "price": 40,
    "image": 411,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Má đào cháy tỏi",
    "sub": "Thịt má heo áp chảo với tỏi • Một phần",
    "price": 145,
    "image": 412,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Gà chiên mắm",
    "sub": "Gà chiên áo nước mắm tỏi • Một phần",
    "price": 130,
    "image": 413,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Sụn gà chiên mắm",
    "sub": "Sụn gà giòn sốt nước mắm • Một phần",
    "price": 130,
    "image": 414,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Chân gà sốt Thái",
    "sub": "Chân gà trộn sốt chua cay • Một phần",
    "price": 90,
    "image": 415,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Lòng gà xào mướp",
    "sub": "Lòng gà xào cùng mướp hương • Một phần",
    "price": 120,
    "image": 416,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Dạ dày cháy tỏi",
    "sub": "Dạ dày heo giòn xóc tỏi • Một phần",
    "price": 180,
    "image": 417,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Dồi sụn nướng",
    "sub": "Dồi heo có sụn nướng thơm • Một phần",
    "price": 120,
    "image": 418,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Tai heo bóp thính",
    "sub": "Tai heo thái mỏng, thính & rau thơm • Một phần",
    "price": 100,
    "image": 419,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Ba chỉ rang riềng",
    "sub": "Ba chỉ heo rang thơm riềng • Một phần",
    "price": 130,
    "image": 420,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Ba chỉ nướng riềng mẻ",
    "sub": "Ba chỉ heo ướp riềng mẻ nướng • Một phần",
    "price": 150,
    "image": 421,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Bò lúc lắc",
    "sub": "Bò áp chảo cùng hành & ớt chuông • Một phần",
    "price": 160,
    "image": 422,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Gân bò cháy tỏi",
    "sub": "Gân bò giòn xóc tỏi • Một phần",
    "price": 130,
    "image": 423,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Bò xào cần",
    "sub": "Thịt bò xào cùng rau cần • Một phần",
    "price": 150,
    "image": 424,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Ếch xào sả ớt",
    "sub": "Thịt ếch xào sả & ớt • Một phần",
    "price": 130,
    "image": 425,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Ếch chiên bơ",
    "sub": "Thịt ếch chiên giòn xóc bơ • Một phần",
    "price": 135,
    "image": 426,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Vịt cháy tỏi",
    "sub": "Thịt vịt áp chảo cùng tỏi • Một phần",
    "price": 130,
    "image": 427,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Lưỡi vịt rang muối",
    "sub": "Lưỡi vịt giòn xóc muối rang • Một phần",
    "price": 125,
    "image": 428,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Chim câu quay",
    "sub": "Chim bồ câu quay vàng • Một con",
    "price": 170,
    "image": 429,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Rau muống xào tỏi",
    "sub": "Rau muống xanh giòn xào tỏi • Một đĩa",
    "price": 50,
    "image": 430,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Ngọn su su xào tỏi",
    "sub": "Ngọn su su non xào tỏi • Một đĩa",
    "price": 65,
    "image": 431,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Rau củ luộc chấm kho quẹt",
    "sub": "Rau củ & kho quẹt tôm khô tóp mỡ • Một đĩa",
    "price": 80,
    "image": 432,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Đậu hũ chiên sả",
    "sub": "Đậu hũ chiên giòn xóc sả • Một đĩa",
    "price": 50,
    "image": 433,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Cà tím nướng mỡ hành",
    "sub": "Cà tím nướng phủ mỡ hành • Một đĩa",
    "price": 50,
    "image": 434,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Cải thìa xào nấm",
    "sub": "Cải thìa xanh xào cùng nấm • Một đĩa",
    "price": 80,
    "image": 435,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Đậu bắp nướng",
    "sub": "Đậu bắp nướng xém cạnh • Một đĩa",
    "price": 50,
    "image": 436,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-vegetables"
  },
  {
    "name": "Nộm xoài tép khô",
    "sub": "Xoài xanh, tép khô & rau thơm • Một đĩa",
    "price": 80,
    "image": 437,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Nghêu hấp sả",
    "sub": "Nghêu hấp thơm sả • Một phần",
    "price": 70,
    "image": 438,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Hàu sữa nướng mỡ hành",
    "sub": "Hàu nướng phủ mỡ hành • Phần 5 con",
    "price": 70,
    "image": 439,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Ốc móng tay xào rau muống",
    "sub": "Ốc móng tay xào rau muống & tỏi • Một phần",
    "price": 75,
    "image": 440,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Ốc len xào dừa",
    "sub": "Ốc len nấu nước cốt dừa • Một phần",
    "price": 110,
    "image": 441,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Sò huyết xào me",
    "sub": "Sò huyết xào sốt me chua ngọt • Một phần",
    "price": 110,
    "image": 442,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Sò điệp nướng mỡ hành",
    "sub": "Sò điệp nướng phủ mỡ hành • Một phần",
    "price": 70,
    "image": 443,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Tôm nướng muối ớt",
    "sub": "Tôm nướng với muối & ớt • Một phần",
    "price": 115,
    "image": 444,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Mực hấp gừng sả",
    "sub": "Mực hấp gừng & sả • Một phần",
    "price": 150,
    "image": 445,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-meat"
  },
  {
    "name": "Mực trứng chiên lá lốt",
    "sub": "Mực trứng chiên cùng lá lốt • Một phần",
    "price": 150,
    "image": 446,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Râu mực chiên mắm",
    "sub": "Râu mực chiên sốt nước mắm • Một phần",
    "price": 140,
    "image": 447,
    "quip": "",
    "kind": "nhau",
    "category": "nhau-fried"
  },
  {
    "name": "Espresso",
    "sub": "Cà phê espresso • Một ly",
    "price": 35,
    "image": 500,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Americano",
    "sub": "Espresso & nước • Một ly",
    "price": 40,
    "image": 501,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Cappuccino",
    "sub": "Espresso & bọt sữa • Một ly",
    "price": 55,
    "image": 502,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Cà phê ủ lạnh",
    "sub": "Cà phê ủ lạnh • Một ly",
    "price": 45,
    "image": 503,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Cà phê trứng",
    "sub": "Cà phê & kem trứng • Một ly",
    "price": 40,
    "image": 504,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Cà phê muối",
    "sub": "Cà phê & kem muối • Một ly",
    "price": 30,
    "image": 505,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Cà phê cốt dừa",
    "sub": "Cà phê & cốt dừa • Một ly",
    "price": 45,
    "image": 506,
    "quip": "",
    "category": "coffee"
  },
  {
    "name": "Trà sữa trà xanh",
    "sub": "Trà xanh & sữa • Một ly",
    "price": 35,
    "image": 507,
    "quip": "",
    "category": "milk-tea"
  },
  {
    "name": "Trà sữa khoai môn",
    "sub": "Khoai môn & trà sữa • Một ly",
    "price": 35,
    "image": 508,
    "quip": "",
    "category": "milk-tea"
  },
  {
    "name": "Trà sữa lài",
    "sub": "Trà lài & sữa • Một ly",
    "price": 35,
    "image": 509,
    "quip": "",
    "category": "milk-tea"
  },
  {
    "name": "Hồng trà",
    "sub": "Hồng trà nguyên vị • Một ly",
    "price": 20,
    "image": 510,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Trà xanh",
    "sub": "Trà xanh nguyên vị • Một ly",
    "price": 20,
    "image": 511,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Trà ô long",
    "sub": "Trà ô long nguyên vị • Một ly",
    "price": 25,
    "image": 512,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Trà nhãn sen",
    "sub": "Trà, nhãn & hạt sen • Một ly",
    "price": 35,
    "image": 513,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Trà xoài",
    "sub": "Trà & xoài • Một ly",
    "price": 35,
    "image": 514,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Trà mãng cầu",
    "sub": "Trà & mãng cầu • Một ly",
    "price": 35,
    "image": 515,
    "quip": "",
    "category": "tea"
  },
  {
    "name": "Hojicha latte",
    "sub": "Trà rang hojicha & sữa • Một ly",
    "price": 45,
    "image": 516,
    "quip": "",
    "category": "matcha-cocoa"
  },
  {
    "name": "Matcha latte dâu",
    "sub": "Matcha, dâu & sữa • Một ly",
    "price": 45,
    "image": 517,
    "quip": "",
    "category": "matcha-cocoa"
  },
  {
    "name": "Cacao sữa",
    "sub": "Cacao & sữa • Một ly",
    "price": 30,
    "image": 518,
    "quip": "",
    "category": "matcha-cocoa"
  },
  {
    "name": "Cacao kem muối",
    "sub": "Cacao & kem muối • Một ly",
    "price": 40,
    "image": 519,
    "quip": "",
    "category": "matcha-cocoa"
  },
  {
    "name": "Nước ép cà rốt",
    "sub": "Cà rốt ép • Một ly",
    "price": 30,
    "image": 520,
    "quip": "",
    "category": "juice"
  },
  {
    "name": "Nước ép táo",
    "sub": "Táo ép • Một ly",
    "price": 35,
    "image": 521,
    "quip": "",
    "category": "juice"
  },
  {
    "name": "Nước ép bưởi",
    "sub": "Bưởi ép • Một ly",
    "price": 35,
    "image": 522,
    "quip": "",
    "category": "juice"
  },
  {
    "name": "Nước ép cóc",
    "sub": "Cóc ép • Một ly",
    "price": 30,
    "image": 523,
    "quip": "",
    "category": "juice"
  },
  {
    "name": "Sinh tố mãng cầu",
    "sub": "Mãng cầu xay & sữa • Một ly",
    "price": 35,
    "image": 524,
    "quip": "",
    "category": "smoothie"
  },
  {
    "name": "Sinh tố sapoche",
    "sub": "Sapoche xay & sữa • Một ly",
    "price": 35,
    "image": 525,
    "quip": "",
    "category": "smoothie"
  },
  {
    "name": "Sinh tố dưa gang",
    "sub": "Dưa gang xay & sữa • Một ly",
    "price": 30,
    "image": 526,
    "quip": "",
    "category": "smoothie"
  },
  {
    "name": "Sữa tươi trân châu đường đen",
    "sub": "Sữa tươi & trân châu đường đen • Một ly",
    "price": 35,
    "image": 527,
    "quip": "",
    "category": "milk"
  },
  {
    "name": "Sữa hạt sen mè đen",
    "sub": "Hạt sen & mè đen • Một ly",
    "price": 25,
    "image": 528,
    "quip": "",
    "category": "milk"
  },
  {
    "name": "Sữa đậu xanh cốt dừa",
    "sub": "Đậu xanh & cốt dừa • Một ly",
    "price": 25,
    "image": 529,
    "quip": "",
    "category": "milk"
  },
  {
    "name": "Sữa chua đá",
    "sub": "Sữa chua & đá • Một ly",
    "price": 25,
    "image": 530,
    "quip": "",
    "category": "yogurt"
  },
  {
    "name": "Sữa chua việt quất",
    "sub": "Sữa chua & việt quất • Một ly",
    "price": 35,
    "image": 531,
    "quip": "",
    "category": "yogurt"
  },
  {
    "name": "Sữa chua chanh dây",
    "sub": "Sữa chua & chanh dây • Một ly",
    "price": 35,
    "image": 532,
    "quip": "",
    "category": "yogurt"
  },
  {
    "name": "Nước rau má",
    "sub": "Rau má xay lọc • Một ly",
    "price": 20,
    "image": 533,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Rau má đậu xanh",
    "sub": "Rau má & đậu xanh • Một ly",
    "price": 25,
    "image": 534,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Nước chanh",
    "sub": "Chanh tươi & nước • Một ly",
    "price": 20,
    "image": 535,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Nước chanh muối",
    "sub": "Chanh muối & nước • Một ly",
    "price": 20,
    "image": 536,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Nước mơ",
    "sub": "Mơ ngâm & nước • Một ly",
    "price": 25,
    "image": 537,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Nước sấu",
    "sub": "Sấu ngâm & nước • Một ly",
    "price": 25,
    "image": 538,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Sâm bí đao",
    "sub": "Bí đao nấu • Một ly",
    "price": 20,
    "image": 539,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Nước chanh dây",
    "sub": "Chanh dây & nước • Một ly",
    "price": 25,
    "image": 540,
    "quip": "",
    "category": "refreshments"
  },
  {
    "name": "Sô cô la đá xay",
    "sub": "Sô cô la xay đá • Một ly",
    "price": 45,
    "image": 541,
    "quip": "",
    "category": "blended"
  },
  {
    "name": "Bánh quy kem đá xay",
    "sub": "Bánh quy & kem xay đá • Một ly",
    "price": 45,
    "image": 542,
    "quip": "",
    "category": "blended"
  },
  {
    "name": "Matcha đá xay",
    "sub": "Matcha & sữa xay đá • Một ly",
    "price": 45,
    "image": 543,
    "quip": "",
    "category": "blended"
  },
  {
    "name": "Soda chanh",
    "sub": "Soda & chanh • Một ly",
    "price": 30,
    "image": 544,
    "quip": "",
    "category": "soda"
  },
  {
    "name": "Soda dâu",
    "sub": "Soda & dâu • Một ly",
    "price": 30,
    "image": 545,
    "quip": "",
    "category": "soda"
  },
  {
    "name": "Soda việt quất",
    "sub": "Soda & việt quất • Một ly",
    "price": 30,
    "image": 546,
    "quip": "",
    "category": "soda"
  },
  {
    "name": "Nước lọc đóng chai",
    "sub": "Nước uống đóng chai • Chai 500 ml",
    "price": 10,
    "image": 547,
    "quip": "",
    "category": "soda"
  },
  {
    "name": "Bánh mì trứng",
    "sub": "Trứng ốp la, dưa leo và đồ chua • Một phần / người",
    "price": 25,
    "image": 600,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "bread",
    "meals": [
      "breakfast",
      "night"
    ]
  },
  {
    "name": "Xôi xéo",
    "sub": "Nếp, đậu xanh và hành phi • Một phần / người",
    "price": 25,
    "image": 601,
    "quip": "",
    "veg": true,
    "kind": "food",
    "category": "rice",
    "meals": [
      "breakfast"
    ]
  },
  {
    "name": "Xôi bắp",
    "sub": "Nếp, bắp, đậu xanh và hành phi • Một phần / người",
    "price": 25,
    "image": 602,
    "quip": "",
    "veg": true,
    "kind": "food",
    "category": "rice",
    "meals": [
      "breakfast"
    ]
  },
  {
    "name": "Xôi đậu xanh",
    "sub": "Nếp đậu xanh, muối mè đậu phộng • Một phần / người",
    "price": 20,
    "image": 603,
    "quip": "",
    "veg": true,
    "kind": "food",
    "category": "rice",
    "meals": [
      "breakfast"
    ]
  },
  {
    "name": "Bánh bao nhân thịt",
    "sub": "Thịt heo, nấm và trứng • Một phần / người",
    "price": 25,
    "image": 604,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "bread",
    "meals": [
      "breakfast",
      "night"
    ]
  },
  {
    "name": "Bánh giò nóng",
    "sub": "Bột gạo, thịt heo băm và mộc nhĩ • Một phần / người",
    "price": 25,
    "image": 605,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "bread",
    "meals": [
      "breakfast",
      "night"
    ]
  },
  {
    "name": "Bánh ướt chả lụa",
    "sub": "Bánh ướt, chả lụa, rau và nước mắm • Một phần / người",
    "price": 35,
    "image": 606,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "bread",
    "meals": [
      "breakfast"
    ]
  },
  {
    "name": "Bánh bao chay",
    "sub": "Rau củ và nấm, không thịt • Một phần / người",
    "price": 20,
    "image": 607,
    "quip": "",
    "veg": true,
    "kind": "food",
    "category": "bread",
    "meals": [
      "breakfast",
      "night"
    ]
  },
  {
    "name": "Cháo trắng ăn kèm",
    "sub": "Cháo trắng, trứng muối và thịt kho • Một phần / người",
    "price": 40,
    "image": 608,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "night"
    ]
  },
  {
    "name": "Cháo ếch",
    "sub": "Cháo trắng kèm ếch kho trong niêu • Một phần / người",
    "price": 65,
    "image": 609,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "night"
    ]
  },
  {
    "name": "Miến ngan",
    "sub": "Miến, thịt ngan và măng • Một phần / người",
    "price": 55,
    "image": 610,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "noodles",
    "meals": [
      "night"
    ]
  },
  {
    "name": "Mì trộn trứng xúc xích",
    "sub": "Mì trộn kiểu Indomie, trứng và xúc xích • Một phần / người",
    "price": 40,
    "image": 611,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "noodles",
    "meals": [
      "night"
    ]
  },
  {
    "name": "Lẩu Thái hải sản",
    "sub": "Tôm, mực, rau và nước lẩu chua cay • Giá / người khi ăn nhóm 2–4 người",
    "price": 180,
    "image": 612,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Lẩu bò ăn nhóm",
    "sub": "Thịt bò, rau và nấm • Giá / người khi ăn nhóm 2–4 người",
    "price": 160,
    "image": 613,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Lẩu gà lá é",
    "sub": "Gà, măng và lá é • Giá / người khi ăn nhóm 2–4 người",
    "price": 150,
    "image": 614,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Lẩu riêu cua bắp bò",
    "sub": "Riêu cua, bắp bò, đậu hũ và bún • Giá / người khi ăn nhóm 2–4 người",
    "price": 180,
    "image": 615,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Lẩu cá",
    "sub": "Cá, cà chua, rau và bún • Giá / người khi ăn nhóm 2–4 người",
    "price": 150,
    "image": 616,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Lẩu dê",
    "sub": "Thịt dê, khoai môn và rau • Giá / người khi ăn nhóm 2–4 người",
    "price": 200,
    "image": 617,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Nướng Hàn Quốc",
    "sub": "Thịt bò, heo, rau cuốn và kimchi • Giá / người khi ăn nhóm 2–4 người",
    "price": 250,
    "image": 618,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "grill",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Nướng Nhật Yakiniku",
    "sub": "Thịt bò nướng và rau nấm • Giá / người khi ăn nhóm 2–4 người",
    "price": 300,
    "image": 619,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "grill",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Buffet lẩu",
    "sub": "Lẩu và các món nhúng tự chọn • Suất buffet / người",
    "price": 250,
    "image": 620,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "hotpot",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Buffet nướng",
    "sub": "Bò tảng, nầm nướng, ba chỉ 134k • Lẩu Nướng 1968 Con Chim Xanh",
    "price": 300,
    "image": 621,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "grill",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Hải sản hấp nướng",
    "sub": "Tôm, mực, nghêu và sò • Giá / người khi ăn nhóm 2–4 người",
    "price": 250,
    "image": 622,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "grill",
    "meals": [
      "dinner"
    ]
  },
  {
    "name": "Gà mẹt",
    "sub": "Gà, xôi, rau và đồ ăn kèm • Giá / người khi ăn nhóm 2–4 người",
    "price": 150,
    "image": 623,
    "quip": "",
    "veg": false,
    "kind": "food",
    "category": "grill",
    "meals": [
      "dinner"
    ]
  }
].map(food => ({
  ...food,
  rarity: priceRarity(food.price)
}));
