/**
 * GIAI ĐOẠN 2 — HỆ THỐNG KIẾN TRÚC NGỮ CẢNH & CÂY XANH (BUILDING & VEGETATION ARCHETYPE SYSTEM)
 * Phong cách: "REAL XUÂN HÒA + CUTE PREMIUM PASTEL + DIGITAL CITY"
 *
 * Nguyên tắc:
 * - CẤM thay đổi footprint công trình.
 * - KHÓA chiều cao thật / OSM / GĐ1 (chỉ suy luận hoặc thêm biến thiên thẩm mỹ vi mô ±3% khi không có height thật).
 * - Tất cả màu tường, màu mái, kiểu mái, tỉ lệ mặt đứng, hộp kỹ thuật mái, ban công/mái hiên đều tất định (deterministic)
 *   theo (zoneCode, buildingType, levels, height, areaSqm, aspectRatio, isOsm, name, stableId).
 */

export type BuildingArchetypeId =
  | 'shophouse_center'
  | 'residential_low'
  | 'garden_suburban'
  | 'villa'
  | 'school_campus'
  | 'civic_admin'
  | 'commercial_shop'
  | 'industrial_warehouse'
  | 'resort_hospitality'
  | 'landmark_custom';

/**
 * 5 kiểu mái chuẩn Giai đoạn 2:
 * 0 = flat (mái bằng có gờ tường chắn mái / sân thượng)
 * 1 = gabled (mái dốc 2 chiều truyền thống / nhà dân)
 * 2 = hipped (mái dốc 4 chiều / trường học / hành chính / biệt thự)
 * 3 = pyramidal (mái chóp 4 mặt cân đối / pavilion / villa vuông)
 * 4 = low_slope_parapet (mái dốc nhẹ ẩn sau parapet hiện đại / thương mại / công nghiệp)
 */
export type RoofTypeCode = 0 | 1 | 2 | 3 | 4;

export type RoofTypeName =
  | 'flat'
  | 'gabled'
  | 'hipped'
  | 'pyramidal'
  | 'low_slope_parapet';

export const ROOF_TYPE_CODE_TO_NAME: Record<RoofTypeCode, RoofTypeName> = {
  0: 'flat',
  1: 'gabled',
  2: 'hipped',
  3: 'pyramidal',
  4: 'low_slope_parapet',
};

export interface ArchetypeSpec {
  id: BuildingArchetypeId;
  label: string;
  floorHeight: number;
  /** Tỉ lệ chiều cao tầng trệt so với các tầng trên */
  groundFloorRatio: number;
  /** Xác suất có mái theo thứ tự [flat, gabled, hipped, pyramidal, low_slope_parapet] (tổng = 100) */
  roofWeights: [number, number, number, number, number];
  /** Danh sách chỉ số màu tường ưu tiên trong WALL_PALETTE */
  wallPaletteIndices: number[];
  /** Danh sách chỉ số màu mái ưu tiên trong ROOF_PALETTE */
  roofPaletteIndices: number[];
  /** Nhịp cửa sổ ngang (mét mỗi ô cửa) */
  windowRhythmMeters: number;
  /** Xác suất có ban công nhẹ (0..1) */
  balconyProbability: number;
  /** Xác suất có mái hiên tầng 1 (0..1) */
  awningProbability: number;
  /** Chiều cao gờ parapet trên mái (mét) */
  parapetHeight: number;
  /** Xác suất có tum thang / hộp kỹ thuật nhỏ trên mái bằng (0..1) */
  topBoxProbability: number;
  /** Mật độ cây xanh quanh công trình (0..1) */
  vegetationDensity: number;
}

/**
 * 10 Building Archetypes chuẩn Xuân Hòa Giai đoạn 2
 */
export const BUILDING_ARCHETYPES: Record<BuildingArchetypeId, ArchetypeSpec> = {
  shophouse_center: {
    id: 'shophouse_center',
    label: 'Nhà phố trung tâm',
    floorHeight: 3.5,
    groundFloorRatio: 1.22,
    roofWeights: [48, 12, 10, 0, 30],
    wallPaletteIndices: [0, 2, 1, 8, 5], // kem ấm, trắng ngà, vàng bơ nhạt, be cát, đào phấn
    roofPaletteIndices: [6, 0, 4, 2, 1], // bê tông sáng, đỏ ngói ấm, xám đá, xanh xám dịu, nâu đỏ
    windowRhythmMeters: 2.6,
    balconyProbability: 0.72,
    awningProbability: 0.65,
    parapetHeight: 0.55,
    topBoxProbability: 0.42,
    vegetationDensity: 0.25,
  },
  residential_low: {
    id: 'residential_low',
    label: 'Nhà dân thấp tầng',
    floorHeight: 3.3,
    groundFloorRatio: 1.12,
    roofWeights: [28, 38, 22, 2, 10],
    wallPaletteIndices: [0, 2, 8, 1, 7], // kem ấm, trắng ngà, be cát, vàng nhạt, xanh sage nhạt
    roofPaletteIndices: [0, 1, 6, 2, 4], // ngói đỏ đất nung, nâu đỏ, bê tông sáng, xanh xám, xám nhạt
    windowRhythmMeters: 2.9,
    balconyProbability: 0.45,
    awningProbability: 0.25,
    parapetHeight: 0.42,
    topBoxProbability: 0.24,
    vegetationDensity: 0.48,
  },
  garden_suburban: {
    id: 'garden_suburban',
    label: 'Nhà vườn / ngoại vi',
    floorHeight: 3.2,
    groundFloorRatio: 1.08,
    roofWeights: [12, 46, 32, 6, 4],
    wallPaletteIndices: [0, 8, 2, 7, 1], // kem ấm, be, trắng ngà, xanh bạc hà dịu, vàng kem
    roofPaletteIndices: [0, 1, 3, 4], // ngói đỏ ấm, nâu đất, xanh rêu dịu, xám đá
    windowRhythmMeters: 3.2,
    balconyProbability: 0.22,
    awningProbability: 0.18,
    parapetHeight: 0.3,
    topBoxProbability: 0.08,
    vegetationDensity: 0.78,
  },
  villa: {
    id: 'villa',
    label: 'Villa / Biệt thự sinh thái',
    floorHeight: 3.6,
    groundFloorRatio: 1.18,
    roofWeights: [10, 14, 52, 20, 4],
    wallPaletteIndices: [2, 0, 8, 6], // trắng kem sang trọng, kem ấm, be sáng, xanh sương nhạt
    roofPaletteIndices: [4, 2, 1, 0, 7], // xám đá slate, xanh xám Pháp, nâu trầm, đỏ ngói ấm, xanh ngọc trầm
    windowRhythmMeters: 3.4,
    balconyProbability: 0.68,
    awningProbability: 0.3,
    parapetHeight: 0.45,
    topBoxProbability: 0.05,
    vegetationDensity: 0.85,
  },
  school_campus: {
    id: 'school_campus',
    label: 'Trường học / Campus ĐH',
    floorHeight: 3.8,
    groundFloorRatio: 1.18,
    roofWeights: [20, 10, 52, 2, 16],
    wallPaletteIndices: [0, 1, 2, 8, 5], // kem sáng, vàng kem học đường, trắng ngà, be ấm, cam đào dịu
    roofPaletteIndices: [0, 1, 6, 4], // ngói đỏ truyền thống, ngói nâu đỏ, bê tông sáng, xám đá
    windowRhythmMeters: 2.8,
    balconyProbability: 0.55, // hành lang lầu
    awningProbability: 0.4,  // sảnh đón
    parapetHeight: 0.68,
    topBoxProbability: 0.25,
    vegetationDensity: 0.72,
  },
  civic_admin: {
    id: 'civic_admin',
    label: 'Công trình hành chính / công cộng',
    floorHeight: 3.9,
    groundFloorRatio: 1.25,
    roofWeights: [16, 6, 58, 8, 12],
    wallPaletteIndices: [1, 0, 2, 8, 4], // vàng kem công sở, kem ấm, trắng ngà, be sáng, hồng đất nhạt
    roofPaletteIndices: [0, 1, 4, 6], // ngói đỏ tươi ấm, nâu đỏ, xám đá, bê tông
    windowRhythmMeters: 2.7,
    balconyProbability: 0.5,
    awningProbability: 0.55,
    parapetHeight: 0.75,
    topBoxProbability: 0.18,
    vegetationDensity: 0.55,
  },
  commercial_shop: {
    id: 'commercial_shop',
    label: 'Thương mại / dịch vụ / cửa hàng',
    floorHeight: 3.7,
    groundFloorRatio: 1.28,
    roofWeights: [36, 6, 12, 4, 42],
    wallPaletteIndices: [2, 0, 6, 5, 8], // trắng sáng, kem ấm, xanh pastel thương mại, cam đào, be
    roofPaletteIndices: [6, 2, 4, 7, 0], // bê tông sáng, xanh dương dịu, xám đá, xanh ngọc, đỏ ấm
    windowRhythmMeters: 2.5,
    balconyProbability: 0.5,
    awningProbability: 0.82,
    parapetHeight: 0.65,
    topBoxProbability: 0.48,
    vegetationDensity: 0.3,
  },
  industrial_warehouse: {
    id: 'industrial_warehouse',
    label: 'Nhà xưởng / kho bãi / dịch vụ kỹ thuật',
    floorHeight: 4.5,
    groundFloorRatio: 1.0,
    roofWeights: [10, 26, 4, 0, 60],
    wallPaletteIndices: [3, 2, 6, 8], // xám ấm sáng, trắng ngà, xanh xám nhạt, be xám
    roofPaletteIndices: [2, 3, 4, 6], // xanh dương dịu, xanh lá dịu, xám sáng, bê tông
    windowRhythmMeters: 4.2,
    balconyProbability: 0.0,
    awningProbability: 0.35,
    parapetHeight: 0.48,
    topBoxProbability: 0.12,
    vegetationDensity: 0.2,
  },
  resort_hospitality: {
    id: 'resort_hospitality',
    label: 'Resort / lưu trú / ven hồ',
    floorHeight: 3.5,
    groundFloorRatio: 1.18,
    roofWeights: [14, 16, 46, 18, 6],
    wallPaletteIndices: [2, 0, 8, 5, 7], // trắng kem, kem ấm, be cát, đào ấm, xanh trà
    roofPaletteIndices: [1, 4, 7, 0], // nâu gỗ/đất nung, xám slate, xanh ngọc hồ, đỏ đất nung
    windowRhythmMeters: 3.1,
    balconyProbability: 0.78,
    awningProbability: 0.48,
    parapetHeight: 0.45,
    topBoxProbability: 0.08,
    vegetationDensity: 0.88,
  },
  landmark_custom: {
    id: 'landmark_custom',
    label: 'Công trình điểm nhấn (Landmark)',
    floorHeight: 4.0,
    groundFloorRatio: 1.25,
    roofWeights: [18, 8, 52, 10, 12],
    wallPaletteIndices: [2, 0, 1, 8],
    roofPaletteIndices: [0, 1, 4, 6],
    windowRhythmMeters: 2.8,
    balconyProbability: 0.6,
    awningProbability: 0.6,
    parapetHeight: 0.8,
    topBoxProbability: 0.2,
    vegetationDensity: 0.65,
  },
};

export interface ResolvedBuildingStyle {
  archetype: BuildingArchetypeId;
  roofType: RoofTypeCode;
  roofTypeName: RoofTypeName;
  wallIdx: number;
  roofIdx: number;
  parapetHeight: number;
  hasTopBox: boolean;
  hasAwning: boolean;
  hasBalcony: boolean;
  /** Cờ màu mái/tường mềm hơn cho 2D */
  semantic2DCategory: 'civic' | 'education' | 'commercial' | 'villa' | 'industrial' | 'residential';
}

/**
 * Hàm băm tất định (deterministic hash) 32-bit
 */
export function hashBuildingSeed(seed: number): number {
  let x = (seed | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * Phân loại Archetype công trình dựa trên vùng quy hoạch (zoneCode), diện tích, tỉ lệ cạnh, số tầng, tên và nguồn OSM.
 */
export function resolveBuildingArchetypeStyle(params: {
  zoneIdx: number;
  zoneCode?: string;
  levels: number;
  height: number;
  areaSqm: number;
  aspectRatio: number;
  isOsm: boolean;
  hasName: boolean;
  name?: string;
  rawWallIdx: number;
  rawRoofKey: number;
  stableSeed: number;
}): ResolvedBuildingStyle {
  const {
    zoneIdx,
    zoneCode = '',
    levels,
    areaSqm,
    aspectRatio,
    isOsm,
    hasName,
    name = '',
    stableSeed,
  } = params;

  const h = hashBuildingSeed(stableSeed);
  const h2 = hashBuildingSeed(stableSeed + 0x517cc1b7);
  const nameLower = name.toLowerCase();

  let archetype: BuildingArchetypeId = 'residential_low';

  // 1. Kiểm tra theo tên công trình (nếu có tên thật)
  if (hasName && nameLower) {
    if (
      nameLower.includes('hội trường 14-8') ||
      nameLower.includes('nhà trắng') ||
      nameLower.includes('quảng trường') ||
      nameLower.includes('di tích') ||
      nameLower.includes('đình ') ||
      nameLower.includes('chùa ') ||
      nameLower.includes('đền ') ||
      nameLower.includes('nhà thờ')
    ) {
      archetype = 'landmark_custom';
    } else if (
      nameLower.includes('đại học') ||
      nameLower.includes('trường') ||
      nameLower.includes('giảng đường') ||
      nameLower.includes('ký túc xá') ||
      nameLower.includes('thư viện') ||
      nameLower.includes('hội trường') ||
      nameLower.includes('khoa ') ||
      nameLower.includes('viện ') ||
      nameLower.includes('cao đẳng') ||
      nameLower.includes('tiểu học') ||
      nameLower.includes('thcs') ||
      nameLower.includes('thpt') ||
      nameLower.includes('mầm non')
    ) {
      archetype = 'school_campus';
    } else if (
      nameLower.includes('ubnd') ||
      nameLower.includes('ủy ban') ||
      nameLower.includes('công an') ||
      nameLower.includes('trạm y tế') ||
      nameLower.includes('phòng khám') ||
      nameLower.includes('bệnh viện') ||
      nameLower.includes('bưu điện') ||
      nameLower.includes('nhà văn hóa') ||
      nameLower.includes('cơ quan') ||
      nameLower.includes('quân sự') ||
      nameLower.includes('trung tâm')
    ) {
      archetype = 'civic_admin';
    } else if (
      nameLower.includes('resort') ||
      nameLower.includes('flamingo') ||
      nameLower.includes('khách sạn') ||
      nameLower.includes('hotel') ||
      nameLower.includes('homestay') ||
      nameLower.includes('villa') ||
      nameLower.includes('biệt thự')
    ) {
      archetype = nameLower.includes('villa') || nameLower.includes('biệt thự') ? 'villa' : 'resort_hospitality';
    } else if (
      nameLower.includes('chợ') ||
      nameLower.includes('siêu thị') ||
      nameLower.includes('cửa hàng') ||
      nameLower.includes('ngân hàng') ||
      nameLower.includes('nhà hàng') ||
      nameLower.includes('cafe') ||
      nameLower.includes('cà phê') ||
      nameLower.includes('billiards') ||
      nameLower.includes('bi-a') ||
      nameLower.includes('karaoke')
    ) {
      archetype = 'commercial_shop';
    } else if (
      nameLower.includes('nhà máy') ||
      nameLower.includes('xưởng') ||
      nameLower.includes('công ty') ||
      nameLower.includes('kho ') ||
      nameLower.includes('gara')
    ) {
      archetype = 'industrial_warehouse';
    }
  } else {
    // 2. Phân loại theo Khu vực (zoneIdx / zoneCode) + Hình học footprint + Số tầng
    // Mapping zoneCodes từ xuanhoa-city3d-meta.json:
    // 0: trung-tam-xuan-hoa
    // 1: dong-xuan
    // 2: cao-minh
    // 3: ngoc-thanh
    // 4: dai-lai-sinh-thai
    // 5: campus-truong-hoc
    // 6: hanh-chinh
    // 7: khu-dan-cu
    // 8: cong-nghiep
    // 9: nong-nghiep-rung
    const zCode = zoneCode || [
      'trung-tam-xuan-hoa',
      'dong-xuan',
      'cao-minh',
      'ngoc-thanh',
      'dai-lai-sinh-thai',
      'campus-truong-hoc',
      'hanh-chinh',
      'khu-dan-cu',
      'cong-nghiep',
      'nong-nghiep-rung',
    ][zoneIdx] || 'khu-dan-cu';

    if (zCode === 'campus-truong-hoc') {
      if (areaSqm >= 210 || levels >= 3 || isOsm) {
        archetype = 'school_campus';
      } else {
        archetype = 'shophouse_center';
      }
    } else if (zCode === 'hanh-chinh') {
      if (areaSqm >= 180 || levels >= 3 || isOsm) {
        archetype = 'civic_admin';
      } else {
        archetype = 'shophouse_center';
      }
    } else if (zCode === 'cong-nghiep') {
      if (areaSqm >= 240) {
        archetype = 'industrial_warehouse';
      } else {
        archetype = 'commercial_shop';
      }
    } else if (zCode === 'dai-lai-sinh-thai') {
      if (areaSqm >= 260) {
        archetype = 'resort_hospitality';
      } else if (areaSqm >= 120 && aspectRatio < 2.2) {
        archetype = 'villa';
      } else {
        archetype = 'garden_suburban';
      }
    } else if (zCode === 'ngoc-thanh' || zCode === 'nong-nghiep-rung') {
      if (areaSqm >= 170 && aspectRatio < 2.0 && (h % 100) < 42) {
        archetype = 'villa';
      } else if (areaSqm >= 340 && aspectRatio >= 2.2) {
        archetype = 'industrial_warehouse';
      } else {
        archetype = 'garden_suburban';
      }
    } else if (zCode === 'cao-minh') {
      if (areaSqm >= 380 && aspectRatio >= 2.1) {
        archetype = 'industrial_warehouse';
      } else if (levels >= 3 && aspectRatio >= 1.8 && areaSqm <= 165) {
        archetype = 'shophouse_center';
      } else if ((h % 100) < 55) {
        archetype = 'garden_suburban';
      } else {
        archetype = 'residential_low';
      }
    } else if (zCode === 'trung-tam-xuan-hoa') {
      if (areaSqm >= 420 && isOsm) {
        archetype = (h % 2 === 0) ? 'civic_admin' : 'commercial_shop';
      } else if (areaSqm >= 240 && levels >= 3) {
        archetype = 'commercial_shop';
      } else if (levels >= 3 || (aspectRatio >= 1.65 && areaSqm <= 170)) {
        archetype = 'shophouse_center';
      } else {
        archetype = 'residential_low';
      }
    } else if (zCode === 'dong-xuan') {
      if (areaSqm >= 320 && isOsm) {
        archetype = 'commercial_shop';
      } else if (levels >= 3 && (aspectRatio >= 1.6 || (h % 100) < 62)) {
        archetype = 'shophouse_center';
      } else if (areaSqm >= 175 && aspectRatio < 1.75 && (h % 100) < 28) {
        archetype = 'villa';
      } else {
        archetype = 'residential_low';
      }
    } else {
      // khu-dan-cu mặc định
      if (areaSqm >= 480) {
        archetype = isOsm ? 'school_campus' : 'industrial_warehouse';
      } else if (levels >= 3 && aspectRatio >= 1.7 && areaSqm <= 160) {
        archetype = 'shophouse_center';
      } else if (areaSqm >= 180 && aspectRatio < 1.65 && levels >= 2 && (h % 100) < 25) {
        archetype = 'villa';
      } else if (levels <= 2 && (h % 100) < 35) {
        archetype = 'garden_suburban';
      } else {
        archetype = 'residential_low';
      }
    }
  }

  const spec = BUILDING_ARCHETYPES[archetype];

  // 3. Chọn kiểu mái trong 5 loại dựa trên trọng số của Archetype + hình học footprint
  let roofType: RoofTypeCode = 0;
  if (areaSqm < 28) {
    roofType = 0; // Khối phụ nhỏ luôn mái bằng gọn
  } else if (archetype === 'villa' && aspectRatio < 1.38 && areaSqm >= 75 && areaSqm <= 260) {
    roofType = (h % 100) < 55 ? 3 : 2; // Villa gần vuông ưu tiên mái chóp pyramidal (3) hoặc hipped (2)
  } else {
    const roll = h % 100;
    let acc = 0;
    for (let code = 0 as RoofTypeCode; code <= 4; code = (code + 1) as RoofTypeCode) {
      acc += spec.roofWeights[code];
      if (roll < acc) {
        roofType = code;
        break;
      }
    }
    // Nhà quá hẹp ngang hoặc quá lớn diện tích thì tránh mái nhọn quá cao
    if ((roofType === 1 || roofType === 3) && areaSqm > 520) {
      roofType = 4; // low_slope_parapet
    }
  }

  // 4. Chọn màu tường & màu mái hài hòa trong bảng màu của Archetype
  const wallIdx = spec.wallPaletteIndices[h % spec.wallPaletteIndices.length] ?? 0;
  let roofIdx = spec.roofPaletteIndices[h2 % spec.roofPaletteIndices.length] ?? 0;
  if (roofType === 0) {
    // Mái bằng ưu tiên màu bê tông sáng (6) hoặc xám đá nhạt (4)
    roofIdx = (h2 % 100) < 72 ? 6 : 4;
  }

  // 5. Các chi tiết kiến trúc phụ trợ
  const hasTopBox =
    roofType === 0 &&
    levels >= 3 &&
    areaSqm >= 52 &&
    areaSqm <= 280 &&
    ((h >>> 8) % 100) < spec.topBoxProbability * 100;

  const hasAwning =
    levels >= 2 &&
    areaSqm >= 38 &&
    ((h >>> 12) % 100) < spec.awningProbability * 100;

  const hasBalcony =
    levels >= 2 &&
    ((h >>> 16) % 100) < spec.balconyProbability * 100;

  let semantic2DCategory: ResolvedBuildingStyle['semantic2DCategory'] = 'residential';
  if (archetype === 'civic_admin' || archetype === 'landmark_custom') {
    semantic2DCategory = 'civic';
  } else if (archetype === 'school_campus') {
    semantic2DCategory = 'education';
  } else if (archetype === 'commercial_shop' || archetype === 'shophouse_center') {
    semantic2DCategory = 'commercial';
  } else if (archetype === 'villa' || archetype === 'resort_hospitality') {
    semantic2DCategory = 'villa';
  } else if (archetype === 'industrial_warehouse') {
    semantic2DCategory = 'industrial';
  }

  return {
    archetype,
    roofType,
    roofTypeName: ROOF_TYPE_CODE_TO_NAME[roofType],
    wallIdx,
    roofIdx,
    parapetHeight: spec.parapetHeight,
    hasTopBox,
    hasAwning,
    hasBalcony,
    semantic2DCategory,
  };
}

/**
 * 7 Archetype cây xanh (Section K) dùng InstancedMesh
 * 0: broadleaf_street (Cây bóng mát vỉa hè phố trung tâm)
 * 1: conifer (Thông / tùng sinh thái đồi Ngọc Thanh - Đại Lải - Đồi Thằn Lằn)
 * 2: broadleaf_large (Cây cổ thụ tán rộng công viên / quảng trường)
 * 3: campus_tree (Cây hàng lối khuôn viên ĐHSP Hà Nội 2 / trường học)
 * 4: forest_tree (Cây rừng tự nhiên ven đồi)
 * 5: resort_ornamental (Cây cảnh quan resort / ven hồ Đại Lải)
 * 6: shrub_low (Bụi cây thấp / tiểu cảnh sân vườn)
 */
export type TreeArchetypeCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function resolveTreeArchetype(params: {
  x: number;
  z: number;
  groundY: number;
  seed: number;
}): {
  archetype: TreeArchetypeCode;
  scale: number;
  rotY: number;
  colorIdx: number;
} {
  const { x, z, groundY, seed } = params;
  const h = hashBuildingSeed(seed);
  const distFromCenter = Math.hypot(x, z);

  // Khu vực đồi cao hoặc phía Bắc/Đông Bắc (Ngọc Thanh, Đại Lải, Đồi Thằn Lằn)
  const isHillOrForest = groundY > 6.5 || z < -1200 || x > 1400;
  // Khu vực ven hồ Đại Lải (phía Đông / Đông Nam hoặc Bắc hồ)
  const isResortZone = x > 950 && z > -900 && z < 900;
  // Khu vực trung tâm & khuôn viên trường ĐHSP2
  const isCampusOrCenter = distFromCenter < 950;

  let archetype: TreeArchetypeCode = 0;
  const roll = h % 100;

  if (isHillOrForest) {
    if (roll < 36) archetype = 1; // conifer
    else if (roll < 78) archetype = 4; // forest_tree
    else if (roll < 90) archetype = 2; // broadleaf_large
    else archetype = 6; // shrub_low
  } else if (isResortZone) {
    if (roll < 34) archetype = 5; // resort_ornamental
    else if (roll < 58) archetype = 1; // conifer
    else if (roll < 82) archetype = 2; // broadleaf_large
    else archetype = 6; // shrub_low
  } else if (isCampusOrCenter) {
    if (roll < 38) archetype = 3; // campus_tree
    else if (roll < 72) archetype = 0; // broadleaf_street
    else if (roll < 88) archetype = 2; // broadleaf_large
    else archetype = 6; // shrub_low
  } else {
    if (roll < 42) archetype = 0; // broadleaf_street
    else if (roll < 68) archetype = 2; // broadleaf_large
    else if (roll < 84) archetype = 4; // forest_tree
    else archetype = 6; // shrub_low
  }

  // Tỉ lệ kích thước tự nhiên nhưng gọn gàng theo từng loại cây
  const unit = ((h >>> 8) % 1000) / 1000;
  let scale = 0.85 + unit * 0.55;
  if (archetype === 2) scale = 1.05 + unit * 0.55; // broadleaf_large
  else if (archetype === 3) scale = 0.95 + unit * 0.35; // campus_tree đều đặn
  else if (archetype === 5) scale = 0.88 + unit * 0.42; // resort_ornamental
  else if (archetype === 6) scale = 0.55 + unit * 0.35; // shrub_low

  const rotY = (((h >>> 16) % 628) / 100);
  const colorIdx = (h >>> 20) % 7;

  return {
    archetype,
    scale,
    rotY,
    colorIdx,
  };
}
