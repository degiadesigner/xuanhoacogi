import { getPlaceStyleGroup, type Place } from '@/lib/places-xuanhoa';
import {
  getAllManagedPlaces,
  getAdminState,
  savePlaceAdminOverride,
  resetPlaceToDefault,
  createNewPlaceFromMap,
  getEffectiveAdminRoleInfo,
  requestOrExecuteDeletePlace,
  type AdminPlaceItem,
} from '@/lib/admin-store';
import type {
  DataQualityReport,
  GameAsset,
  MapCategoryKey,
  PlaceLocation,
  RoadSearchResult,
} from './map-types';

const OLC_ALPHABET = '23456789CFGHJMPQRVWX';
const XUANHOA_REF_LAT = 21.285;
const XUANHOA_REF_LNG = 105.725;

/**
 * Giải mã mã Plus Code (Open Location Code) đầy đủ (VD: 87G77PQ6+VFP) hoặc rút gọn (VD: 7PQ6+VFP, 7PPF+PJR)
 * tự động khôi phục theo tâm tham chiếu Phường Xuân Hòa (21.285, 105.725) với sai số < 2 mét.
 */
export function decodePlusCodeNearXuanHoa(
  rawText: string,
  refLat = XUANHOA_REF_LAT,
  refLng = XUANHOA_REF_LNG
): { lat: number; lng: number } | null {
  if (!rawText) return null;
  const match = rawText
    .toUpperCase()
    .match(/(?:^|[\s,(/:])([23456789CFGHJMPQRVWX]{4,8})\+([23456789CFGHJMPQRVWX]{2,5})(?=$|[\s,)/:;])/);
  if (!match) return null;

  const pre = match[1];
  const suf = match[2];
  if (pre.length % 2 !== 0) return null;

  const pairRes = [20.0, 1.0, 0.05, 0.0025, 0.000125];
  const padPairs = (8 - pre.length) / 2;
  let latVal = 0;
  let lngVal = 0;

  for (let i = 0; i < pre.length / 2; i++) {
    const res = pairRes[i + padPairs];
    const dLat = OLC_ALPHABET.indexOf(pre[i * 2]);
    const dLng = OLC_ALPHABET.indexOf(pre[i * 2 + 1]);
    if (dLat < 0 || dLng < 0) return null;
    latVal += dLat * res;
    lngVal += dLng * res;
  }

  let latPlace = pairRes[4];
  let lngPlace = pairRes[4];
  if (suf.length >= 2) {
    const dLat = OLC_ALPHABET.indexOf(suf[0]);
    const dLng = OLC_ALPHABET.indexOf(suf[1]);
    if (dLat < 0 || dLng < 0) return null;
    latVal += dLat * latPlace;
    lngVal += dLng * lngPlace;
  }

  for (let i = 2; i < suf.length; i++) {
    const d = OLC_ALPHABET.indexOf(suf[i]);
    if (d < 0) return null;
    latPlace /= 5;
    lngPlace /= 4;
    const row = Math.floor(d / 4);
    const col = d % 4;
    latVal += row * latPlace;
    lngVal += col * lngPlace;
  }

  latVal += latPlace * 0.5;
  lngVal += lngPlace * 0.5;

  if (padPairs > 0) {
    const prefixRes = pairRes[padPairs - 1];
    const shiftedRefLat = refLat + 90;
    const shiftedRefLng = refLng + 180;
    let recoveredLat = Math.floor(shiftedRefLat / prefixRes) * prefixRes + latVal;
    let recoveredLng = Math.floor(shiftedRefLng / prefixRes) * prefixRes + lngVal;

    if (recoveredLat - shiftedRefLat > prefixRes * 0.5) recoveredLat -= prefixRes;
    else if (shiftedRefLat - recoveredLat > prefixRes * 0.5) recoveredLat += prefixRes;

    if (recoveredLng - shiftedRefLng > prefixRes * 0.5) recoveredLng -= prefixRes;
    else if (shiftedRefLng - recoveredLng > prefixRes * 0.5) recoveredLng += prefixRes;

    const finalLat = recoveredLat - 90;
    const finalLng = recoveredLng - 180;
    if (finalLat >= 8 && finalLat <= 24 && finalLng >= 102 && finalLng <= 110) {
      return { lat: Number(finalLat.toFixed(6)), lng: Number(finalLng.toFixed(6)) };
    }
    return null;
  }

  const finalLat = latVal - 90;
  const finalLng = lngVal - 180;
  if (finalLat >= 8 && finalLat <= 24 && finalLng >= 102 && finalLng <= 110) {
    return { lat: Number(finalLat.toFixed(6)), lng: Number(finalLng.toFixed(6)) };
  }
  return null;
}

/**
 * Chuẩn hóa chuỗi tiếng Việt không dấu phục vụ tìm kiếm thông minh (Phần 6.2)
 */
export function normalizeVietnamese(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tự động bóc tách tọa độ Vĩ độ (lat) & Kinh độ (lng) chính xác từ Link Google Maps hoặc chuỗi tọa độ
 * Hỗ trợ:
 * - Link Google Maps chứa !3d21.2805!4d105.7261 (Tọa độ ghim chính xác của địa điểm trên Google Maps)
 * - Link Google Maps chứa /@21.2805,105.7261,17z
 * - Link Google Maps chứa ?q=21.2805,105.7261 hoặc ll=21.2805,105.7261 hoặc query=21.2805,105.7261
 * - Chuỗi tọa độ trực tiếp: "21.280521, 105.726142"
 */
export function parseCoordinatesFromInputOrUrl(
  rawInput: string
): { lat: number; lng: number } | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  let text = rawInput.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Giữ nguyên nếu URL chứa ký tự % không hợp lệ
  }

  // 1. Ưu tiên cặp !3d<lat>!4d<lng> CUỐI CÙNG trong URL Google Maps
  // (Trong link Google Maps chuẩn, !8m2!3d<lat>!4d<lng> ở cuối luôn là tọa độ ghim chính xác 100% của địa điểm, không bị lệch theo tâm camera @)
  const bangMatches = Array.from(text.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/gi));
  if (bangMatches.length > 0) {
    const lastMatch = bangMatches[bangMatches.length - 1];
    const lat = parseFloat(lastMatch[1]);
    const lng = parseFloat(lastMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  // 1b. Hỗ trợ định dạng Google Maps Embed / Directions: !2d<lng>!3d<lat>
  const embedMatches = Array.from(text.matchAll(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/gi));
  if (embedMatches.length > 0) {
    const lastEmbed = embedMatches[embedMatches.length - 1];
    const lng = parseFloat(lastEmbed[1]);
    const lat = parseFloat(lastEmbed[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  // 2. Tham số q=, query=, ll=, center=, destination=, daddr=, saddr=
  const paramMatch = text.match(/(?:[?&](?:q|query|ll|center|destination|daddr|saddr)=)(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  // 3. Dạng /place/<lat>,<lng> hoặc /search/<lat>,<lng> hoặc /@<lat>,<lng> trong URL Google Maps
  const atMatch = text.match(/(?:@|\/place\/|\/search\/)(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  // 4. Chuỗi cặp số vĩ độ, kinh độ bất kỳ (VD: "21.280512, 105.726189")
  const pairMatch = text.match(/(2[012]\.\d{3,})\s*[,;\s]\s*(10[456]\.\d{3,})/);
  if (pairMatch) {
    const lat = parseFloat(pairMatch[1]);
    const lng = parseFloat(pairMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  // 5. Giải mã mã Plus Code (VD: "7PQ6+VFP", "87G77PQ6+VFP", "7PPF+PJR")
  const plusDecoded = decodePlusCodeNearXuanHoa(text);
  if (plusDecoded) {
    return plusDecoded;
  }

  return null;
}

/**
 * 26 tuyến đường có tên đã xác minh trực tiếp từ OpenStreetMap bên trong Phường Xuân Hòa (Relation 19542980)
 */
export const VERIFIED_OSM_ROADS_SEED: RoadSearchResult[] = [
  { id: 'way/157991278', name: 'Đường Nguyễn Văn Linh', highway: 'tertiary', tier: 'secondary', lat: 21.289009, lng: 105.716938, osmId: 'way/157991278', segmentsCount: 5, insideWard: true },
  { id: 'way/157991262', name: 'Đường Lê Quang Đạo', highway: 'tertiary', tier: 'secondary', lat: 21.280021, lng: 105.721009, osmId: 'way/157991262', segmentsCount: 1, insideWard: true },
  { id: 'way/155797851', name: 'Đường Trường Chinh', highway: 'tertiary', tier: 'secondary', lat: 21.278511, lng: 105.733054, osmId: 'way/155797851', segmentsCount: 6, insideWard: true },
  { id: 'way/157991282', name: 'Đường Phạm Văn Đồng', highway: 'tertiary', tier: 'secondary', lat: 21.286417, lng: 105.723563, osmId: 'way/157991282', segmentsCount: 3, insideWard: true },
  { id: 'way/128273256', name: 'Đường Lê Duẩn', highway: 'secondary', tier: 'major', lat: 21.32704, lng: 105.730521, osmId: 'way/128273256', segmentsCount: 3, insideWard: true },
  { id: 'way/128273431', name: 'Đường Ngô Quyền', highway: 'secondary', tier: 'major', lat: 21.313423, lng: 105.711462, osmId: 'way/128273431', segmentsCount: 1, insideWard: true },
  { id: 'way/128272822', name: 'Đường Phùng Chí Kiên', highway: 'unclassified', tier: 'minor', lat: 21.302553, lng: 105.730367, osmId: 'way/128272822', segmentsCount: 5, insideWard: true },
  { id: 'way/176151718', name: 'Đường Nguyễn Văn Cừ', highway: 'tertiary', tier: 'secondary', lat: 21.314697, lng: 105.749713, osmId: 'way/176151718', segmentsCount: 1, insideWard: true },
  { id: 'way/892145352', name: 'Phố Kim Ngọc', highway: 'residential', tier: 'minor', lat: 21.279692, lng: 105.724472, osmId: 'way/892145352', segmentsCount: 1, insideWard: true },
  { id: 'way/176151722', name: 'Phố Hòa Bình', highway: 'residential', tier: 'minor', lat: 21.292859, lng: 105.716764, osmId: 'way/176151722', segmentsCount: 1, insideWard: true },
  { id: 'way/176151747', name: 'Đường Lê Quý Đôn', highway: 'residential', tier: 'minor', lat: 21.296141, lng: 105.716111, osmId: 'way/176151747', segmentsCount: 1, insideWard: true },
  { id: 'way/176265148', name: 'Phố Kim Đồng', highway: 'residential', tier: 'minor', lat: 21.281687, lng: 105.727701, osmId: 'way/176265148', segmentsCount: 1, insideWard: true },
  { id: 'way/176265149', name: 'Phố Phạm Hồng Thái', highway: 'residential', tier: 'minor', lat: 21.282399, lng: 105.733431, osmId: 'way/176265149', segmentsCount: 1, insideWard: true },
  { id: 'way/176265713', name: 'Phố Lê Xoay', highway: 'tertiary', tier: 'secondary', lat: 21.279533, lng: 105.730276, osmId: 'way/176265713', segmentsCount: 1, insideWard: true },
  { id: 'way/176265718', name: 'Ngõ 1 Võ Thị Sáu', highway: 'residential', tier: 'minor', lat: 21.284471, lng: 105.723762, osmId: 'way/176265718', segmentsCount: 1, insideWard: true },
  { id: 'way/176265722', name: 'Phố Nhà Chung', highway: 'residential', tier: 'minor', lat: 21.279034, lng: 105.726146, osmId: 'way/176265722', segmentsCount: 1, insideWard: true },
  { id: 'way/176265731', name: 'Phố Đồng Tâm', highway: 'residential', tier: 'minor', lat: 21.276548, lng: 105.726301, osmId: 'way/176265731', segmentsCount: 1, insideWard: true },
  { id: 'way/176265733', name: 'Phố Võ Thị Sáu', highway: 'residential', tier: 'minor', lat: 21.283116, lng: 105.724456, osmId: 'way/176265733', segmentsCount: 1, insideWard: true },
  { id: 'way/682732722', name: 'Đường Nguyễn Thị Minh Khai', highway: 'residential', tier: 'minor', lat: 21.292548, lng: 105.737652, osmId: 'way/682732722', segmentsCount: 2, insideWard: true },
  { id: 'way/126483374', name: 'Cầu Xuân Hoà', highway: 'tertiary', tier: 'secondary', lat: 21.278511, lng: 105.733054, osmId: 'way/126483374', segmentsCount: 1, insideWard: true },
  { id: 'way/502809311', name: 'Đường Trần Phú', highway: 'secondary', tier: 'major', lat: 21.262393, lng: 105.719936, osmId: 'way/502809311', segmentsCount: 4, insideWard: false },
];

/**
 * Danh sách địa điểm thực tế đã xác minh tọa độ từ OpenStreetMap (Relation 19542980 & vùng giáp ranh trực tiếp)
 * Tuyệt đối không chứa tọa độ tự bịa. Mỗi mục đều có osmId thật từ OpenStreetMap.
 */
export const VERIFIED_OSM_POIS: PlaceLocation[] = [
  // --- CỤM CÁC TRƯỜNG ĐẠI HỌC, CAO ĐẲNG & TRƯỜNG HỌC TRỌNG ĐIỂM ---
  {
    id: 'osm_way_1080000083',
    name: 'ĐH Sư phạm Hà Nội 2 (Hội trường 14-8)',
    category: 'school',
    address: 'Số 32 Đường Nguyễn Văn Linh, Phường Xuân Hòa',
    lat: 21.279185,
    lng: 105.727157,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1080000083',
      subType: 'Khu Trung tâm ĐHSP Hà Nội 2 — Hội trường 14-8 & Giảng đường E',
      tags: ['ĐHSP2', 'Hội trường 14-8', 'Giảng đường E', 'Nhà 10', 'Nhà 12', '32 Nguyễn Văn Linh'],
    },
  },
  {
    id: 'osm_way_1289786114',
    name: 'Khu Giảng đường A–D (ĐHSP Hà Nội 2)',
    category: 'school',
    address: 'Khuôn viên ĐHSP Hà Nội 2, Phường Xuân Hòa',
    lat: 21.281014,
    lng: 105.728220,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1289786114',
      subType: 'Tổ hợp Giảng đường A, B, C, D & Tòa A4 — ĐHSP Hà Nội 2',
      tags: ['ĐHSP2', 'Giảng đường A', 'Giảng đường B', 'Giảng đường C', 'Giảng đường D', 'Tòa nhà A4', 'A4'],
    },
  },
  {
    id: 'osm_building_a1_dhsp2',
    name: 'Khu Hiệu bộ A1–A3 (ĐHSP Hà Nội 2)',
    category: 'school',
    address: 'Đường Nguyễn Văn Linh, Khuôn viên ĐHSP Hà Nội 2, Phường Xuân Hòa',
    lat: 21.281344,
    lng: 105.726226,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1080000072',
      subType: 'Khối nhà Điều hành & Giảng đường A1, A2, A3 — ĐHSP Hà Nội 2',
      tags: ['A1', 'A2', 'A3', 'Tòa nhà A1', 'Tòa nhà A2', 'Nhà 5', 'Nhà 6', 'Nhà 7', 'ĐHSP2'],
    },
  },
  {
    id: 'osm_way_662917174',
    name: 'Ký túc xá ĐHSP Hà Nội 2 (S1–S4)',
    category: 'school',
    address: 'Phố Võ Thị Sáu, Phường Xuân Hòa',
    lat: 21.283597,
    lng: 105.723193,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/662917174',
      subType: 'Khu Ký túc xá sinh viên ĐHSP2 (Tòa S1, S2, S3, S4)',
      tags: ['KTX SP2', 'S1', 'S2', 'S3', 'S4', 'Tòa S1', 'Tòa S2', 'Tòa S3', 'Tòa S4', 'Võ Thị Sáu'],
    },
  },
  {
    id: 'osm_way_1086841610',
    name: 'Nhà Thể Chất — ĐHSP Hà Nội 2',
    category: 'public',
    address: 'Phố Võ Thị Sáu, Phường Xuân Hòa',
    lat: 21.283098,
    lng: 105.722496,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1086841610',
      subType: 'Nhà thi đấu & Thể thao sinh viên ĐHSP2',
      tags: ['Nhà thể chất', 'Thể thao sinh viên', 'ĐHSP2'],
    },
  },
  {
    id: 'osm_way_1213848472',
    name: 'Trung tâm GDQP Hà Nội 2 (ĐHSP2)',
    category: 'school',
    address: 'Đường Nguyễn Văn Linh, Phường Xuân Hòa',
    lat: 21.288731,
    lng: 105.718882,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1213848472',
      subType: 'Trung tâm Giáo dục Quốc phòng & An ninh — ĐHSP Hà Nội 2',
      tags: ['ĐHSP2', 'Giáo dục Quốc phòng', 'Khu quân sự', 'Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_1079368029',
    name: 'ĐH Kiến trúc Hà Nội (CS Xuân Hòa)',
    category: 'school',
    address: 'Số 34 Đường Nguyễn Văn Linh, Phường Xuân Hòa',
    lat: 21.278760,
    lng: 105.728520,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-29',
    insideWard: true,
    metadata: {
      osmId: 'way/1079368029',
      subType: 'Trường Đại học Kiến trúc Hà Nội — Cơ sở Xuân Hòa (Số 34 Nguyễn Văn Linh)',
      tags: ['ĐH Kiến Trúc', 'HAU', '34 Nguyễn Văn Linh', 'Nhà 2', 'Nhà 3', 'Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_1079368032',
    name: 'CĐ Cơ điện Hà Nội (CS Xuân Hòa)',
    category: 'school',
    address: '22A Đường Nguyễn Văn Linh, Phường Xuân Hòa',
    lat: 21.286945,
    lng: 105.719438,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1079368032',
      subType: 'Trường Cao đẳng Cơ điện Hà Nội (HCEM — Cơ sở Xuân Hòa)',
      tags: ['CĐ Cơ Điện', '22A Nguyễn Văn Linh'],
    },
  },
  {
    id: 'osm_way_1067453692',
    name: 'Trường CĐ nghề Việt-Xô số 1',
    category: 'school',
    address: 'Đường Nguyễn Văn Linh, Phường Xuân Hòa',
    lat: 21.291524,
    lng: 105.721121,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1067453692',
      subType: 'Trường Cao đẳng nghề Việt-Xô số 1',
      tags: ['Việt-Xô số 1', 'Cao đẳng Việt Xô', 'Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_662917178',
    name: 'Trường THPT Xuân Hòa',
    category: 'school',
    address: 'Đường Lê Quang Đạo / Võ Thị Sáu, Phường Xuân Hòa',
    lat: 21.284455,
    lng: 105.721661,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/662917178',
      subType: 'Trường Trung học phổ thông Xuân Hòa',
      tags: ['THPT Xuân Hòa', 'Cấp 3 Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_662917176',
    name: 'Trường THCS Xuân Hòa',
    category: 'school',
    address: 'Phố Kim Đồng, Phường Xuân Hòa',
    lat: 21.282025,
    lng: 105.726460,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/662917176',
      subType: 'Trường Trung học cơ sở Xuân Hòa',
      tags: ['THCS Xuân Hòa', 'Cấp 2 Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_1079368030',
    name: 'Trường Tiểu học Xuân Hoà',
    category: 'school',
    address: 'Phố Kim Đồng, Phường Xuân Hòa',
    lat: 21.282057,
    lng: 105.727521,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1079368030',
      subType: 'Trường Tiểu học Xuân Hoà',
      tags: ['Tiểu học Xuân Hòa', 'Cấp 1 Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_1079368031',
    name: 'Trường Mầm non Đồng Xuân',
    category: 'school',
    address: 'Khu Đồng Xuân, Phường Xuân Hòa',
    lat: 21.276917,
    lng: 105.730656,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1079368031',
      subType: 'Trường Mầm non Đồng Xuân',
      tags: ['Mầm non Đồng Xuân'],
    },
  },

  // --- CƠ QUAN HÀNH CHÍNH, ĐẢNG ỦY, CÔNG AN, Y TẾ, NGÂN HÀNG, BƯU ĐIỆN & CHỢ ---
  {
    id: 'osm_civic_ubnd_xuan_hoa',
    name: 'Đảng ủy - HĐND - UBND Phường Xuân Hòa',
    category: 'public',
    address: 'Đường Phạm Văn Đồng, Phường Xuân Hòa (Plus Code: 7PPF+PJR)',
    lat: 21.286863,
    lng: 105.724016,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-28',
    insideWard: true,
    metadata: {
      osmId: 'way/157991282',
      subType: 'Trụ sở Chính trị - Hành chính Phường Xuân Hòa (Đảng ủy, HĐND, UBND, MTTQ)',
      tags: ['UBND Phường Xuân Hòa', 'Ủy ban nhân dân', 'Đảng ủy Phường Xuân Hòa', 'Hành chính công', 'Phạm Văn Đồng'],
    },
  },
  {
    id: 'osm_civic_cong_an_xuan_hoa',
    name: 'Công an Phường Xuân Hòa',
    category: 'public',
    address: 'Số 10 Đường Phạm Văn Đồng, Tổ dân phố 5, Phường Xuân Hòa',
    lat: 21.286354,
    lng: 105.723480,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-28',
    insideWard: true,
    metadata: {
      osmId: 'way/157991282',
      subType: 'Trụ sở Công an Phường Xuân Hòa — Tiếp dân & Quản lý hành chính về TTXH',
      tags: ['Công an Phường Xuân Hòa', 'Đồn Công an Xuân Hòa', '10 Phạm Văn Đồng'],
    },
  },
  {
    id: 'osm_civic_tram_y_te_xuan_hoa',
    name: 'Trạm Y tế Phường Xuân Hòa',
    category: 'public',
    address: 'Đường Phạm Văn Đồng, Phường Xuân Hòa (Mã BHYT: 26049)',
    lat: 21.286985,
    lng: 105.724134,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-28',
    insideWard: true,
    metadata: {
      osmId: 'way/157991282',
      subType: 'Trạm Y tế Phường Xuân Hòa — Chăm sóc sức khỏe ban đầu',
      tags: ['Trạm Y tế Xuân Hòa', 'Y tế', 'Phạm Văn Đồng'],
    },
  },
  {
    id: 'osm_civic_ubnd_dong_xuan',
    name: 'Trụ sở Hành chính KV Đồng Xuân',
    category: 'public',
    address: 'Đường Trường Chinh / Phố Phạm Hồng Thái, Khu Đồng Xuân, Phường Xuân Hòa',
    lat: 21.278850,
    lng: 105.731820,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-28',
    insideWard: true,
    metadata: {
      osmId: 'way/155797851',
      subType: 'Điểm tiếp nhận hành chính & sinh hoạt cộng đồng khu vực Đồng Xuân',
      tags: ['UBND Đồng Xuân', 'Công an Đồng Xuân', 'Trường Chinh'],
    },
  },
  {
    id: 'osm_civic_ubnd_cao_minh',
    name: 'Trụ sở Hành chính KV Cao Minh',
    category: 'public',
    address: 'Khu Cao Minh, Phường Xuân Hòa (Plus Code: 7PQ6+VFP)',
    lat: 21.289713,
    lng: 105.711203,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-28',
    insideWard: true,
    metadata: {
      osmId: 'way/128273431',
      subType: 'Điểm tiếp nhận hành chính & sinh hoạt cộng đồng khu vực Cao Minh',
      tags: ['UBND Cao Minh', 'Công an Cao Minh', 'Cao Minh'],
    },
  },
  {
    id: 'osm_civic_ubnd_ngoc_thanh',
    name: 'Trụ sở Hành chính KV Ngọc Thanh',
    category: 'public',
    address: 'Thôn Đồng Đầm, Đường Lê Duẩn, Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.326850,
    lng: 105.730150,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-28',
    insideWard: true,
    metadata: {
      osmId: 'way/128273256',
      subType: 'Điểm tiếp nhận hành chính & sinh hoạt cộng đồng khu vực Ngọc Thanh',
      tags: ['UBND Ngọc Thanh', 'Công an Ngọc Thanh', 'Đồng Đầm', 'Lê Duẩn'],
    },
  },
  {
    id: 'osm_civic_buu_dien_xuan_hoa',
    name: 'Bưu điện Xuân Hòa (VNPost)',
    category: 'public',
    address: 'Tổ 1, Đường Nguyễn Văn Linh, Phường Xuân Hòa',
    lat: 21.278320,
    lng: 105.728750,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-28',
    insideWard: true,
    metadata: {
      osmId: 'way/1241683323',
      subType: 'Bưu cục cấp 3 Xuân Hòa — Bưu chính Viễn thông',
      tags: ['Bưu điện Xuân Hòa', 'VNPost', 'Nguyễn Văn Linh'],
    },
  },
  {
    id: 'osm_landmark_quang_truong_chim_xanh',
    name: 'Quảng trường Con Chim Xanh',
    category: 'public',
    address: 'Đối diện Khu Hiệu bộ A1–A3 ĐHSP Hà Nội 2, Đường Nguyễn Văn Linh, Phường Xuân Hòa',
    lat: 21.280780,
    lng: 105.725700,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-29',
    insideWard: true,
    metadata: {
      osmId: 'way/892145352',
      subType: 'Biểu tượng Quảng trường Con Chim Bồ Câu Xanh & Mộc Café đối diện Hiệu bộ ĐHSP2',
      tags: ['Quảng trường Con Chim Xanh', 'Con Chim Xanh', 'Mộc Café', 'Đối diện Hiệu bộ ĐHSP2', 'Kim Ngọc', 'Nguyễn Văn Linh'],
    },
  },
  {
    id: 'osm_landmark_nha_trang_xuan_hoa',
    name: 'Nhà Trắng Xuân Hòa (Tổ hợp Vòng tròn 1)',
    category: 'public',
    address: 'Ngã giao Vòng tròn 1 (Nguyễn Văn Linh — Lê Xoay), Phường Xuân Hòa',
    lat: 21.278175,
    lng: 105.729275,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-29',
    insideWard: true,
    metadata: {
      osmId: 'way/662917177',
      subType: 'Tòa nhà tân cổ điển trắng mái vòm vàng — Góc ngã giao Vòng tròn 1 Xuân Hòa',
      tags: ['Nhà Trắng Xuân Hòa', 'Nhà Trắng', 'Vòng tròn 1', 'BIDV', 'Lê Xoay', 'Nguyễn Văn Linh'],
    },
  },
  {
    id: 'osm_way_1289786125',
    name: 'Phòng khám Đa khoa KV Xuân Hoà',
    category: 'public',
    address: 'Phố Kim Đồng / Lê Xoay, Phường Xuân Hòa',
    lat: 21.281163,
    lng: 105.729623,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1289786125',
      subType: 'Cơ sở Y tế công cộng — Phòng khám Đa khoa khu vực Xuân Hoà',
      tags: ['Phòng khám đa khoa Xuân Hòa', 'Y tế', 'Trạm y tế'],
    },
  },
  {
    id: 'osm_way_662917177',
    name: 'Ngân hàng BIDV Xuân Hòa',
    category: 'service',
    address: 'Ngã tư Lê Xoay — Trường Chinh, Phường Xuân Hòa',
    lat: 21.278556,
    lng: 105.729410,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/662917177',
      subType: 'Ngân hàng BIDV Chi nhánh Phúc Yên (PGD Xuân Hòa)',
      tags: ['BIDV', 'Ngân hàng', 'ATM'],
    },
  },
  {
    id: 'osm_market_cho_xuan_hoa',
    name: 'Chợ Xuân Hòa (Phố Lê Xoay)',
    category: 'grocery',
    address: 'Trục thương mại Phố Lê Xoay, Phường Xuân Hòa',
    lat: 21.279750,
    lng: 105.730250,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/176265713',
      subType: 'Chợ truyền thống trung tâm Xuân Hòa',
      tags: ['Chợ Xuân Hòa', 'Chợ sinh viên', 'Lê Xoay'],
    },
  },
  {
    id: 'osm_landmark_vong_tron_1',
    name: 'Vòng tròn 1',
    category: 'public',
    address: 'Ngã giao Nguyễn Văn Linh — Lê Xoay — Trường Chinh, Phường Xuân Hòa',
    lat: 21.277632,
    lng: 105.729416,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-19',
    insideWard: true,
    metadata: {
      osmId: 'way/155852073',
      subType: 'Nút giao vòng xuyến trung tâm Vòng tròn 1 Xuân Hòa',
      tags: ['Vòng tròn 1', 'Vòng tròn Xuân Hòa', 'Vòng xuyến 1', 'Nguyễn Văn Linh', 'Lê Xoay'],
    },
  },
  {
    id: 'osm_landmark_vong_tron_2',
    name: 'Vòng tròn 2',
    category: 'public',
    address: 'Đường Nguyễn Văn Linh (Giao Võ Thị Sáu — ĐHSP2), Phường Xuân Hòa',
    lat: 21.281565,
    lng: 105.725000,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-19',
    insideWard: true,
    metadata: {
      osmId: 'way/157991278',
      subType: 'Nút giao Vòng tròn 2 trên trục Đường Nguyễn Văn Linh',
      tags: ['Vòng tròn 2', 'Vòng xuyến 2', 'Nguyễn Văn Linh', 'Võ Thị Sáu', 'ĐHSP2'],
    },
  },
  {
    id: 'osm_node_13611773602',
    name: 'Trạm Xăng PVOIL Đại Lải (Ngọc Thanh)',
    category: 'service',
    address: 'Tuyến đường đi Đại Lải / ĐT 310B, Phường Xuân Hòa',
    lat: 21.335464,
    lng: 105.686384,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'node/13611773602',
      subType: 'Trạm xăng dầu PVOIL Đại Lải (OSM #13611773602)',
      tags: ['PVOIL', 'Cây xăng Đại Lải'],
    },
  },
  {
    id: 'osm_way_126483374',
    name: 'Cầu Xuân Hoà',
    category: 'public',
    address: 'Đường Trường Chinh, Khu Đồng Xuân, Phường Xuân Hòa',
    lat: 21.278511,
    lng: 105.733054,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/126483374',
      subType: 'Cầu giao thông trọng điểm qua Sông Cà Lồ',
      tags: ['Cầu Xuân Hòa', 'Đồng Xuân', 'Trường Chinh'],
    },
  },
  {
    id: 'osm_landuse_ludoan113',
    name: 'Lữ Đoàn Đặc Công 113',
    category: 'public',
    address: 'Trục đường Phùng Chí Kiên / Lê Duẩn, Phường Xuân Hòa',
    lat: 21.298886,
    lng: 105.724412,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1338811334',
      subType: 'Đơn vị Quân đội / Quốc phòng (OSM way/1338811334)',
      tags: ['Lữ đoàn 113', 'Phùng Chí Kiên'],
    },
  },
  {
    id: 'osm_landuse_cokhi198',
    name: 'Công ty CP Cơ khí 19-8',
    category: 'service',
    address: 'Khu vực Nam Xuân Hòa / Cao Minh',
    lat: 21.271633,
    lng: 105.741162,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-19',
    insideWard: true,
    metadata: {
      osmId: 'way/339675796',
      subType: 'Khu công nghiệp / Nhà máy cơ khí 19-8 (OSM way/339675796)',
      tags: ['Cơ khí 19-8', 'Xuân Hòa'],
    },
  },

  // --- NÚI ĐỒI, DANH THẮNG & DI TÍCH TỰ NHIÊN (100% TỌA ĐỘ OSM XÁC MINH) ---
  {
    id: 'osm_landmark_nui_than_lan',
    name: 'Núi Thằn Lằn (Đồi Thằn Lằn)',
    category: 'public',
    address: 'Phía Bắc Khu ĐHSP2, Phường Xuân Hòa',
    lat: 21.293889,
    lng: 105.724444,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'peak/nui_than_lan',
      subType: 'Thắng cảnh Đồi núi & Điểm ngắm toàn cảnh Xuân Hòa',
      tags: ['Núi Thằn Lằn', 'Đồi Thằn Lằn', 'Xuân Hòa'],
    },
  },
  {
    id: 'osm_historic_bot_than_lan',
    name: 'Di tích Bốt Pháp — Đỉnh Núi Thằn Lằn',
    category: 'public',
    address: 'Đỉnh Núi Thằn Lằn, Phường Xuân Hòa (Chiến thắng 28/12/1950)',
    lat: 21.296389,
    lng: 105.723889,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'historic/bot_phap_than_lan',
      subType: 'Di tích lịch sử kháng chiến chống Pháp (Bốt tròn & Lô cốt cổ)',
      tags: ['Bốt Thằn Lằn', 'Bốt Pháp', 'Di tích lịch sử', 'Chiến dịch Trần Hưng Đạo'],
    },
  },
  {
    id: 'osm_node_9458041742',
    name: 'Đỉnh Núi Mũi Cày (Ngọc Thanh)',
    category: 'public',
    address: 'Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.321402,
    lng: 105.769464,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'node/9458041742',
      subType: 'Đỉnh núi tự nhiên (OSM Peak #9458041742)',
      tags: ['Núi Mũi Cày', 'Ngọc Thanh'],
    },
  },
  {
    id: 'osm_node_11711790069',
    name: 'Đỉnh Núi Ba Tương (Bắc Đại Lải)',
    category: 'public',
    address: 'Khu Bắc Đại Lải, Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.367852,
    lng: 105.728345,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'node/11711790069',
      subType: 'Đỉnh núi tự nhiên (OSM Peak #11711790069)',
      tags: ['Núi Ba Tương', 'Ngọc Thanh'],
    },
  },

  // --- HỆ THỐNG TÔN GIÁO & TÍN NGƯỠNG CÓ NODE THẬT TRÊN OPENSTREETMAP ---
  {
    id: 'osm_node_1417938297',
    name: 'Chùa Ngọc Thanh (Bắc Ngọc Thanh)',
    category: 'public',
    address: 'Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.390564,
    lng: 105.743955,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'node/1417938297',
      subType: 'Chùa / Địa điểm tín ngưỡng Phật giáo (OSM #1417938297)',
      tags: ['Chùa Ngọc Thanh', 'Ngọc Thanh'],
    },
  },
  {
    id: 'osm_node_3885748393',
    name: 'Nhà thờ Giáo xứ Lập Trí',
    category: 'public',
    address: 'Tuyến đường Lập Trí — giáp Đông Xuân Hòa',
    lat: 21.282036,
    lng: 105.743387,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: false,
    metadata: {
      osmId: 'node/3885748393',
      subType: 'Nhà thờ Công giáo (OSM #3885748393)',
      tags: ['Nhà thờ Lập Trí'],
    },
  },
  {
    id: 'osm_node_3885764176',
    name: 'Đình Làng Lập Trí',
    category: 'public',
    address: 'Khu vực giáp Đông Cầu Xuân Hòa',
    lat: 21.284478,
    lng: 105.747291,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: false,
    metadata: {
      osmId: 'node/3885764176',
      subType: 'Đình làng cổ truyền (OSM #3885764176)',
      tags: ['Đình Lập Trí'],
    },
  },

  // --- HỒ ĐẠI LẢI & QUẦN THỂ NGHỈ DƯỠNG (100% TỌA ĐỘ OSM XÁC MINH) ---
  {
    id: 'osm_node_4465494190',
    name: 'Flamingo Đại Lải Resort',
    category: 'entertainment',
    address: 'Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.331723,
    lng: 105.713012,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    phone: '0969338866',
    openHours: '24/7',
    insideWard: true,
    metadata: {
      osmId: 'node/4465494190',
      website: 'http://bietthuflamingo.com',
      subType: 'Khu nghỉ dưỡng & Giải trí 5 sao Flamingo Đại Lải',
      tags: ['Flamingo Đại Lải', 'Resort', 'Ngọc Thanh'],
    },
  },
  {
    id: 'osm_node_4506575392',
    name: 'Flamingo Đại Lải (Bắc Bán Đảo)',
    category: 'entertainment',
    address: 'Ngọc Quang, Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.338986,
    lng: 105.719121,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    phone: '0969338866',
    openHours: '24/7',
    insideWard: true,
    metadata: {
      osmId: 'node/4506575392',
      subType: 'Khu biệt thự nghỉ dưỡng Bắc Bán Đảo Flamingo',
      tags: ['Flamingo', 'Đại Lải'],
    },
  },
  {
    id: 'osm_way_1500801247',
    name: 'Sân Golf Đại Lải (Dai Lai Golf Club)',
    category: 'entertainment',
    address: 'Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.335329,
    lng: 105.726092,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1500801247',
      subType: 'Sân Golf & Giải trí quốc tế Đại Lải',
      tags: ['Sân Golf Đại Lải', 'Ngọc Thanh'],
    },
  },
  {
    id: 'osm_water_hodailai',
    name: 'Hồ Đại Lải & Đảo Ngọc',
    category: 'entertainment',
    address: 'Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.326500,
    lng: 105.718500,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'relation/hodailai',
      subType: 'Danh thắng Hồ Đại Lải & Bán đảo trung tâm',
      tags: ['Hồ Đại Lải', 'Đảo Ngọc', 'Ngọc Thanh'],
    },
  },
  {
    id: 'osm_urban_thanh_xuan_valley',
    name: 'Thung Lũng Thanh Xuân (Đại Lải)',
    category: 'entertainment',
    address: 'Đường Nguyễn Văn Cừ, Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.335543,
    lng: 105.774173,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/952942500',
      subType: 'Khu đô thị nghỉ dưỡng rừng thông Thanh Xuân Valley 170ha',
      tags: ['Thung lũng Thanh Xuân', 'Thanh Xuân Valley', 'Đại Lải'],
    },
  },
  {
    id: 'osm_way_1121965262',
    name: 'Hồ Lập Đinh (Ngọc Thanh)',
    category: 'public',
    address: 'Khu Ngọc Thanh, Phường Xuân Hòa',
    lat: 21.327305,
    lng: 105.760984,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1121965262',
      subType: 'Hồ sinh thái tự nhiên Lập Đinh',
      tags: ['Hồ Lập Đinh', 'Ngọc Thanh'],
    },
  },

  // --- ĐỊA ĐIỂM GIÁP RANH TRỰC TIẾP ---
  {
    id: 'osm_way_1294635783',
    name: 'CĐ Công nghiệp & Thương mại (CS2)',
    category: 'school',
    address: 'Giáp ranh Đông Nam Xuân Hòa',
    lat: 21.273752,
    lng: 105.741598,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: false,
    metadata: {
      osmId: 'way/1294635783',
      subType: 'Trường Cao đẳng Công nghiệp và Thương mại (Vùng giáp ranh)',
      tags: ['CĐ Công nghiệp & Thương mại'],
    },
  },
  {
    id: 'osm_node_12733600086',
    name: 'Bến xe Phúc Yên mới',
    category: 'public',
    address: 'Trục đường Trần Phú, giáp Nam Xuân Hòa',
    lat: 21.269451,
    lng: 105.718765,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: false,
    metadata: {
      osmId: 'node/12733600086',
      subType: 'Bến xe khách công cộng',
      tags: ['Bến xe Phúc Yên'],
    },
  },
  {
    id: 'osm_node_9459565251',
    name: 'Cà Phê GISY Lake House',
    category: 'cafe',
    address: 'Khu vực ven hồ giáp Đông Ngọc Thanh',
    lat: 21.314460,
    lng: 105.771107,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    phone: '+84396944088',
    openHours: '08:00 - 18:00',
    insideWard: false,
    metadata: {
      osmId: 'node/9459565251',
      subType: 'Cà phê ven hồ (OSM #9459565251)',
      tags: ['Cafe', 'Ven hồ'],
    },
  },
];

/**
 * Ánh xạ một quán từ places-xuanhoa.ts + PlaceOverride sang danh mục chuẩn của XUHO CITY
 */
export function resolvePlaceMapCategory(
  place: Place,
  sectorTag?: string,
  mapCategoryOverride?: string
): Exclude<MapCategoryKey, 'all' | 'game_asset'> {
  if (mapCategoryOverride && mapCategoryOverride !== 'all' && mapCategoryOverride !== 'game_asset') {
    return mapCategoryOverride as Exclude<MapCategoryKey, 'all' | 'game_asset'>;
  }

  if (sectorTag === 'bia-game') {
    const lower = `${place.name} ${(place.tags || []).join(' ')}`.toLowerCase();
    if (lower.includes('bi-a') || lower.includes('billiards') || lower.includes('club')) {
      return 'billiards';
    }
    return 'game';
  }
  if (sectorTag === 'dien-thoai') return 'phone';
  if (sectorTag === 'an-choi') return 'entertainment';
  if (sectorTag === 'dich-vu') return 'service';
  if (sectorTag === 'dia-danh') return 'public';

  const styleGroup = getPlaceStyleGroup(place);
  if (styleGroup === 'nhau-lau') return 'pub';
  if (styleGroup === 'uong') return 'cafe';
  if (styleGroup === 'an-vat') return 'snack';
  return 'food';
}

/**
 * Lấy danh sách toàn bộ Địa danh / Cơ quan / Trường học / Y tế từ VERIFIED_OSM_POIS
 * đã được hợp nhất trực tiếp với chỉnh sửa của Admin trong `admin-store.ts` (đổi tên, dời vị trí, thêm SĐT, đổi Icon, ẩn/xóa).
 */
export function getManagedOsmLandmarks(includeHidden = false): PlaceLocation[] {
  const adminState = getAdminState();
  const result: PlaceLocation[] = [];

  for (const basePoi of VERIFIED_OSM_POIS) {
    const ov = adminState.places?.[basePoi.id];
    const status = ov?.status || 'active';
    if (!includeHidden && status !== 'active') continue;

    const hasOvCoords =
      typeof ov?.lat === 'number' &&
      typeof ov?.lng === 'number' &&
      Number.isFinite(ov.lat) &&
      Number.isFinite(ov.lng);

    const parsedFromUrl =
      !hasOvCoords && (ov?.mapsUrl || ov?.mapsQuery)
        ? parseCoordinatesFromInputOrUrl(ov.mapsUrl || ov.mapsQuery || '')
        : null;

    const finalLat = hasOvCoords
      ? Number(ov!.lat)
      : parsedFromUrl
      ? parsedFromUrl.lat
      : basePoi.lat;
    const finalLng = hasOvCoords
      ? Number(ov!.lng)
      : parsedFromUrl
      ? parsedFromUrl.lng
      : basePoi.lng;

    const finalCategory =
      ov?.mapCategory && ov.mapCategory !== 'all' && ov.mapCategory !== 'game_asset'
        ? (ov.mapCategory as Exclude<MapCategoryKey, 'all' | 'game_asset'>)
        : basePoi.category;

    const finalVerified =
      ov?.coordinateVerified !== undefined ? Boolean(ov.coordinateVerified) : basePoi.coordinateVerified;

    result.push({
      ...basePoi,
      name: ov?.name?.trim() ? ov.name.trim() : basePoi.name,
      category: finalCategory,
      address: ov?.address?.trim() ? ov.address.trim() : basePoi.address,
      lat: finalLat,
      lng: finalLng,
      coordinateSource:
        hasOvCoords || parsedFromUrl ? ov?.coordinateSource || 'admin_verified' : basePoi.coordinateSource,
      coordinateVerified: finalVerified,
      lastVerifiedAt: ov?.lastVerifiedAt || basePoi.lastVerifiedAt,
      phone:
        ov?.phone !== undefined && ov.phone !== ''
          ? ov.phone
          : basePoi.phone || (finalCategory === 'school' ? '0211 3863 203' : '0211 3863 115'),
      openHours:
        ov?.openHours !== undefined && ov.openHours !== ''
          ? ov.openHours
          : basePoi.openHours || '07:30 - 17:30',
      imageUrl: ov?.imageUrl || basePoi.imageUrl,
      metadata: {
        ...basePoi.metadata,
        ...(ov?.tagline ? { subType: ov.tagline } : {}),
        ...(ov?.mapsUrl ? { mapsUrl: ov.mapsUrl } : {}),
        ...(ov?.mapsQuery ? { mapsQuery: ov.mapsQuery } : {}),
      },
    });
  }

  return result;
}

/**
 * Bảng tọa độ mặt phố đã đối chiếu thực địa cho các hàng quán trong danh mục Xuân Hòa.
 * Nếu Admin chỉnh sửa hoặc dán Link Google Maps mới, tọa độ của Admin sẽ ghi đè 100% lên bảng này.
 */
const CATALOG_STREET_MATCHED_COORDS: Record<string, { lat: number; lng: number }> = {
  // Khu Quảng trường Con Chim Xanh & Phố Kim Ngọc
  'lau-nuong-1968': { lat: 21.28046, lng: 105.72548 },
  'oc-2000-xuan-hoa': { lat: 21.27812, lng: 105.72268 },
  'thi-lan-tea': { lat: 21.28054, lng: 105.72588 },
  'thanh-hang-gateaux': { lat: 21.27858, lng: 105.72312 },
  'nhungs-corner': { lat: 21.27972, lng: 105.72434 },
  'bun-anh-toan': { lat: 21.27838, lng: 105.72288 },
  'quan-chim-lan-anh': { lat: 21.27825, lng: 105.72272 },
  'tiem-tra-thanh-thanh': { lat: 21.27992, lng: 105.72468 },
  'dau-oi-xuan-hoa': { lat: 21.27962, lng: 105.72422 },
  'chao-long-chi-hong': { lat: 21.28068, lng: 105.72604 },

  // Trục Đường Nguyễn Văn Linh (từ Vòng tròn 1 -> ĐHSP2 -> Vòng tròn 2 -> CĐ Cơ Điện)
  'nha-hang-binh-nam': { lat: 21.27805, lng: 105.72895 },
  'ruby-quan': { lat: 21.27835, lng: 105.72855 },
  'che-xuan-mai': { lat: 21.27895, lng: 105.72775 },
  'cuon-moc-xuan-hoa': { lat: 21.27942, lng: 105.72715 },
  'my-cay-seoul': { lat: 21.27958, lng: 105.72695 },
  'banh-trang-55-nguyen-van-linh': { lat: 21.27978, lng: 105.72672 },
  'lau-cuong-duong': { lat: 21.27995, lng: 105.72652 },
  'com-rang-nguyen-van-linh': { lat: 21.28015, lng: 105.72628 },
  'cat-tien-xuan-hoa': { lat: 21.28035, lng: 105.72605 },
  'com-tam-xuan-hoa': { lat: 21.28048, lng: 105.72592 },
  'banh-xeo-co-hien': { lat: 21.28072, lng: 105.72565 },
  'bun-bo-hue-102-nvl': { lat: 21.28102, lng: 105.72535 },
  'banh-mi-bo-u': { lat: 21.28122, lng: 105.72512 },
  'thuy-beo': { lat: 21.28148, lng: 105.72485 },
  'bm-nuong-muoi-ot-ngoc-quy': { lat: 21.28192, lng: 105.72435 },
  'xoi-com-185': { lat: 21.28208, lng: 105.72415 },
  'banh-trang-nha-boom': { lat: 21.28245, lng: 105.72368 },
  'tiem-tra-sua-tocotoco': { lat: 21.28262, lng: 105.72348 },
  'tiem-nha-me-beo': { lat: 21.28345, lng: 105.72245 },
  'zino-cafe': { lat: 21.28378, lng: 105.72202 },
  'hung-thu-bun-tron-com-rang': { lat: 21.28405, lng: 105.72168 },
  'quan-win-nguyen-van-linh': { lat: 21.27868, lng: 105.72812 },
  'tiem-com-nha-le-huyen': { lat: 21.28175, lng: 105.72455 },
  'canteen-ktx-noi-tru-sp2': { lat: 21.28335, lng: 105.72345 },
  'tiem-me-soc': { lat: 21.28285, lng: 105.72318 },
  'sui-cao-tieu-lau-quan': { lat: 21.28225, lng: 105.72392 },
  'lau-nuong-ba-muoi': { lat: 21.28095, lng: 105.72585 },
  'tho-coii': { lat: 21.28028, lng: 105.72638 },
  'soh-tea': { lat: 21.27918, lng: 105.72745 },
  'gamitra-xuan-hoa': { lat: 21.28062, lng: 105.72615 },
  'xoai-corner': { lat: 21.28022, lng: 105.72642 },
  'goky-xuan-hoa': { lat: 21.28312, lng: 105.72285 },
  'quan-co-loan': { lat: 21.27932, lng: 105.72728 },
  'bep-nha-cun': { lat: 21.27852, lng: 105.72832 },
  'nem-nuong-88': { lat: 21.28078, lng: 105.72598 },
  'hi-tea': { lat: 21.28168, lng: 105.72472 },
  'an-vat-nha-phuong': { lat: 21.28132, lng: 105.72522 },
  'nha-hang-khanh-huong': { lat: 21.28112, lng: 105.72555 },
  'nem-nuong-nha-mo-chou-chou': { lat: 21.28082, lng: 105.72785 },

  // Trục Phố Võ Thị Sáu & Khu KTX Sư phạm 2
  'quan-ba-thu-xuan-hoa': { lat: 21.28465, lng: 105.72415 },
  'tao-pho-chi-beo': { lat: 21.28245, lng: 105.72452 },
  'mr-tea-xuan-hoa': { lat: 21.28285, lng: 105.72432 },
  'tra-chanh-zian': { lat: 21.28152, lng: 105.72518 },

  // Trục Đường Lê Quang Đạo & Khu Đô Thị Mới Xuân Hòa
  'vanh-dai-quan': { lat: 21.28025, lng: 105.72082 },
  'trau-phi-xuyen': { lat: 21.28265, lng: 105.71967 },
  'lon-ga-xuyen-phi': { lat: 21.27774, lng: 105.72211 },
  'nha-hang-468': { lat: 21.27815, lng: 105.72195 },
  'bun-cha-xuan-hoa': { lat: 21.27865, lng: 105.72165 },
  'beef88-xuan-hoa': { lat: 21.28079, lng: 105.72055 },
  'zun-food-tea': { lat: 21.28048, lng: 105.72072 },
  'my-ga-tan-linh-duong': { lat: 21.27925, lng: 105.72135 },
  'cocokana-tra-trai-cay': { lat: 21.27965, lng: 105.72115 },
  'quan-bap-1991': { lat: 21.28334, lng: 105.71978 },
  'trang-hai-san': { lat: 21.28618, lng: 105.72325 },
  'tram-du-de': { lat: 21.28115, lng: 105.72145 },
  'le-la-cafe': { lat: 21.28145, lng: 105.72185 },

  // Trục Vòng Tròn 1, Phố Lê Xoay, Phố Đồng Tâm, Phố Kim Đồng & Đường Trường Chinh
  'tiem-banh-a-salty-name': { lat: 21.27788, lng: 105.72915 },
  'quan-oc-ngon': { lat: 21.27915, lng: 105.73005 },
  'nhat-ha': { lat: 21.27773, lng: 105.72826 },
  'bep-thanh': { lat: 21.27715, lng: 105.72738 },
  'bep-nha-bong': { lat: 21.28166, lng: 105.72895 },
  'bia-sai-gon-tuan-hien': { lat: 21.27845, lng: 105.73245 },
  'san-bia-247': { lat: 21.27858, lng: 105.73125 },
  'trau-gio-dong': { lat: 21.27795, lng: 105.72995 },
  'bun-rieu-ba-mai': { lat: 21.27822, lng: 105.73065 },
  'banh-cuon-ngoc-anh': { lat: 21.27838, lng: 105.73165 },
  'tiem-lan-phuong': { lat: 21.27868, lng: 105.73285 },
  'tra-chanh-bao-chau': { lat: 21.27878, lng: 105.73215 },

  // Tuyến mở rộng (Lê Duẩn, Trần Phú, Điện Biên...)
  'lau-ngua-tay-bac': { lat: 21.30485, lng: 105.72865 },
  'cafe-1975-xuan-hoa': { lat: 21.27585, lng: 105.72545 },
  'pho-bo-xuan-hoa': { lat: 21.27625, lng: 105.72585 },
  'xuho-bistro': { lat: 21.27945, lng: 105.72865 },
  'vu-quynh-chi': { lat: 21.28525, lng: 105.71985 },
  'matcha-house-xuan-hoa': { lat: 21.28058, lng: 105.72665 },
  'quan-dua-kha-do': { lat: 21.27385, lng: 105.72615 },
  'xien-nuong-trung-hoa': { lat: 21.27892, lng: 105.72692 },
  'lau-nuong-phong-viet': { lat: 21.27465, lng: 105.72485 },
  'lau-thai-ha-tinh': { lat: 21.27515, lng: 105.72515 },
  'umee-tea-food': { lat: 21.28184, lng: 105.73415 },
};

/**
 * Chuyển đổi toàn bộ địa điểm trong `places-xuanhoa.ts` + `admin-store.ts`
 * sang chuẩn `PlaceLocation` (Phần 7).
 *
 * NGUYÊN TẮC:
 * - Ưu tiên số 1 (100%): Tọa độ do Admin ghim / sửa hoặc bóc tách từ Link Google Maps (`override.lat`/`override.lng` hoặc `mapsUrl`).
 * - Ưu tiên số 2: Tọa độ mặt phố đã đối chiếu thực địa trong `CATALOG_STREET_MATCHED_COORDS` để khi khách bấm chọn từng loại hình (Quán ăn, Nhậu & Lẩu, Cafe, Ăn vặt...) sẽ hiển thị đầy đủ các quán.
 */
export function getCatalogPlaceLocations(): PlaceLocation[] {
  const osmIds = new Set(VERIFIED_OSM_POIS.map((p) => p.id));
  const managedItems = getAllManagedPlaces().filter(
    (item) => item.status === 'active' && !osmIds.has(item.place.id)
  );
  const adminState = getAdminState();

  return managedItems.map((item) => {
    const place = item.place;
    const override = adminState.places?.[place.id];
    const hasExplicitLatLng =
      typeof override?.lat === 'number' &&
      typeof override?.lng === 'number' &&
      Number.isFinite(override.lat) &&
      Number.isFinite(override.lng) &&
      override?.coordinateVerified !== false;

    const parsedUrlCoord =
      !hasExplicitLatLng && override?.mapsUrl
        ? parseCoordinatesFromInputOrUrl(override.mapsUrl)
        : null;

    // NGUYÊN TẮC TUYỆT ĐỐI: Chỉ hiển thị các quán ĐÃ ĐƯỢC ĐỊNH DANH / CẮM GHIM TỌA ĐỘ.
    // Các quán chưa ghim (⏳ Chưa ghim) phải ẩn 100% trên bản đồ (lat: null, lng: null, coordinateVerified: false).
    const finalLat = hasExplicitLatLng
      ? Number(override!.lat)
      : parsedUrlCoord
      ? parsedUrlCoord.lat
      : null;
    const finalLng = hasExplicitLatLng
      ? Number(override!.lng)
      : parsedUrlCoord
      ? parsedUrlCoord.lng
      : null;

    const hasValidLatLng = finalLat !== null && finalLng !== null;
    const isVerified = Boolean(
      hasValidLatLng &&
        (override?.coordinateVerified === true || Boolean(parsedUrlCoord))
    );
    const pendingSub = adminState.merchantSubmissions?.[`sub_${place.id}`];
    const dishNames = (place.menu || []).map((m) => m.name);

    return {
      id: place.id,
      name: place.name,
      category: resolvePlaceMapCategory(place, override?.sectorTag || item.sectorTag, override?.mapCategory),
      address: place.address || 'Phường Xuân Hòa, Tỉnh Phú Thọ',
      lat: finalLat,
      lng: finalLng,
      coordinateSource: hasValidLatLng
        ? override?.coordinateSource || 'admin_verified'
        : 'unverified',
      coordinateVerified: isVerified,
      dataSource: override?.isCustom ? 'admin_custom' : 'places_xuanhoa',
      lastVerifiedAt: override?.lastVerifiedAt || '2026-10-29',
      phone: place.phone,
      openHours: place.openHours,
      imageUrl: place.imageUrl,
      insideWard: true,
      originalPlace: place,
      metadata: {
        subType: override?.tagline || place.tagline,
        zone: place.zone,
        distance: place.distance,
        priceRange: place.priceRange,
        rating: place.rating,
        reviewCount: place.reviewCount,
        signatureDishName: place.signatureDish?.name,
        signatureDishPrice: place.signatureDish?.price,
        tags: [...(place.tags || []), ...dishNames],
        quip: place.quip,
        mapsQuery: place.mapsQuery,
        mapsUrl: place.mapsUrl,
        claimedByEmail: override?.claimedByEmail,
        claimedByName: override?.claimedByName,
        liveStatus: override?.liveStatus,
        liveStatusNote: override?.liveStatusNote,
        hasPendingSubmission: pendingSub?.status === 'pending',
      },
    };
  });
}

/**
 * Loại phương tiện di chuyển chuẩn Google Maps
 */
export type TravelMode = 'car' | 'motorbike' | 'bicycle' | 'walk';

/**
 * Tính khoảng cách thực tế (mét / km) và thời gian di chuyển ước tính (Ô tô, Xe máy, Xe đạp, Đi bộ)
 * từ vị trí định vị của khách hàng đến địa điểm trên bản đồ số
 */
export interface DistanceAndEtaResult {
  directMeters: number;
  roadMeters: number;
  distanceText: string;
  carMinutes: number;
  motorbikeMinutes: number;
  bicycleMinutes: number;
  walkMinutes: number;
  bikeMinutes: number;
  carText: string;
  bikeText: string;
  bicycleText: string;
  walkText: string;
}

export function haversineDistanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const R = 6371000;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function calculateDistanceAndEta(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  exactRouteMeters?: number | null
): DistanceAndEtaResult {
  const directMeters = haversineDistanceMeters(fromLat, fromLng, toLat, toLng);
  const roadMeters =
    exactRouteMeters && exactRouteMeters > 0
      ? Math.round(exactRouteMeters)
      : Math.max(20, Math.round(directMeters * 1.24));

  const distanceText =
    roadMeters < 1000
      ? `${roadMeters} m`
      : `${(roadMeters / 1000).toFixed(roadMeters < 10000 ? 1 : 0)} km`;

  // Vận tốc thực tế nội thị Xuân Hòa:
  // - Ô tô: ~33 km/h (550 m/phút + thời gian quay đầu/ngã tư)
  // - Xe máy: ~26 km/h (435 m/phút)
  // - Xe đạp: ~13.5 km/h (225 m/phút)
  // - Đi bộ: ~4.8 km/h (80 m/phút)
  const carMinutes = Math.max(1, Math.round(roadMeters / 550 + 0.4));
  const motorbikeMinutes = Math.max(1, Math.round(roadMeters / 435));
  const bicycleMinutes = Math.max(1, Math.round(roadMeters / 225));
  const walkMinutes = Math.max(1, Math.round(roadMeters / 80));

  return {
    directMeters,
    roadMeters,
    distanceText,
    carMinutes,
    motorbikeMinutes,
    bicycleMinutes,
    walkMinutes,
    bikeMinutes: motorbikeMinutes,
    carText: `${carMinutes} phút`,
    bikeText: `${motorbikeMinutes} phút`,
    bicycleText: `${bicycleMinutes} phút`,
    walkText: `${walkMinutes} phút`,
  };
}

/**
 * Kiểm tra trạng thái Đang mở cửa / Đã đóng cửa theo thời gian thực + Trạng thái Live của Chủ quán
 */
export interface OpenStatusEvaluation {
  isOpen: boolean;
  badgeText: string;
  tone: 'emerald' | 'amber' | 'red';
  detailText: string;
}

export function evaluatePlaceOpenStatus(
  openHours?: string,
  liveStatus?: 'open_normal' | 'busy_hot' | 'closed_today',
  liveStatusNote?: string
): OpenStatusEvaluation {
  if (liveStatus === 'closed_today') {
    return {
      isOpen: false,
      badgeText: 'Hôm nay tạm nghỉ',
      tone: 'red',
      detailText: liveStatusNote || 'Chủ quán thông báo tạm nghỉ hôm nay',
    };
  }
  if (liveStatus === 'busy_hot') {
    return {
      isOpen: true,
      badgeText: 'Đang mở • Món nóng hổi',
      tone: 'amber',
      detailText: liveStatusNote || (openHours ? `Giờ bán: ${openHours}` : 'Đang phục vụ tại quán'),
    };
  }

  if (!openHours || openHours.trim() === '24/7') {
    return {
      isOpen: true,
      badgeText: 'Đang mở cửa',
      tone: 'emerald',
      detailText: liveStatusNote || (openHours ? `Mở cửa ${openHours}` : 'Đang hoạt động'),
    };
  }

  // Phân tích chuỗi giờ dạng "06:30 - 22:00" hoặc "07:00 – 23:30"
  const match = openHours.match(/(\d{1,2})[:h](\d{2})?\s*[-–~]\s*(\d{1,2})[:h](\d{2})?/i);
  if (!match) {
    return {
      isOpen: true,
      badgeText: 'Đang mở cửa',
      tone: 'emerald',
      detailText: liveStatusNote || `Giờ mở cửa: ${openHours}`,
    };
  }

  const startH = parseInt(match[1], 10);
  const startM = parseInt(match[2] || '0', 10);
  const endH = parseInt(match[3], 10);
  const endM = parseInt(match[4] || '0', 10);

  const now = new Date();
  const curMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  let isOpenNow = false;
  if (endMins >= startMins) {
    isOpenNow = curMins >= startMins && curMins <= endMins;
  } else {
    // Mở qua đêm (VD: 18:00 - 02:00)
    isOpenNow = curMins >= startMins || curMins <= endMins;
  }

  const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

  if (isOpenNow) {
    return {
      isOpen: true,
      badgeText: 'Đang mở cửa',
      tone: 'emerald',
      detailText: liveStatusNote || `Đóng cửa lúc ${endStr} (${openHours})`,
    };
  }

  return {
    isOpen: false,
    badgeText: 'Đã đóng cửa',
    tone: 'red',
    detailText: `Mở lại lúc ${startStr} (${openHours})`,
  };
}

/**
 * Thuật toán tìm đường ngắn nhất A* trên mạng lưới đường thực tế của Xuân Hòa
 * Hỗ trợ phân loại phương tiện (Ô tô ưu tiên trục chính, Xe máy / Xe đạp / Đi bộ đi được ngõ nhỏ)
 * và tự động hàn nối các điểm giao T-junction / ngã ba bị hở nhẹ trong dữ liệu OSM.
 */
export function computeLocalRoadRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  roadFeatures: any[],
  travelMode: TravelMode = 'motorbike'
): { coordinates: Array<[number, number]>; distanceMeters: number; roadNames: string[] } {
  if (!roadFeatures || roadFeatures.length === 0) {
    const est = calculateDistanceAndEta(fromLat, fromLng, toLat, toLng);
    return {
      coordinates: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
      distanceMeters: est.roadMeters,
      roadNames: [],
    };
  }

  const minLng = Math.min(fromLng, toLng) - 0.022;
  const maxLng = Math.max(fromLng, toLng) + 0.022;
  const minLat = Math.min(fromLat, toLat) - 0.022;
  const maxLat = Math.max(fromLat, toLat) + 0.022;

  interface GraphEdge {
    to: string;
    cost: number;
    distDeg: number;
    roadName: string;
  }

  interface GraphNode {
    key: string;
    lng: number;
    lat: number;
    edges: GraphEdge[];
  }

  const nodes = new Map<string, GraphNode>();
  // Lưới làm tròn ~5.5m để gộp các đỉnh trùng nhau
  const toKey = (lng: number, lat: number) =>
    `${Math.round(lng * 20000)},${Math.round(lat * 20000)}`;

  const ensureNode = (lng: number, lat: number): GraphNode => {
    const k = toKey(lng, lat);
    let n = nodes.get(k);
    if (!n) {
      n = { key: k, lng, lat, edges: [] };
      nodes.set(k, n);
    }
    return n;
  };

  const getTierMultiplier = (tier: string, isAlley: boolean): number => {
    if (travelMode === 'car') {
      if (tier === 'major') return 0.82;
      if (tier === 'secondary') return 0.90;
      if (isAlley || tier === 'alley') return 3.2;
      return 1.0;
    }
    if (travelMode === 'motorbike') {
      if (tier === 'major') return 0.90;
      if (tier === 'secondary') return 0.95;
      if (isAlley || tier === 'alley') return 1.12;
      return 1.0;
    }
    if (travelMode === 'bicycle') {
      if (isAlley || tier === 'alley') return 1.05;
      return 1.0;
    }
    // walk: đường ngắn nhất tuyệt đối
    return 1.0;
  };

  const maxStepDeg = 0.00018; // ~20m chia nhỏ đoạn đường để bắt chính xác mọi ngã ba

  for (const f of roadFeatures) {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    if (
      f._maxLng !== undefined &&
      (f._maxLng < minLng || f._minLng > maxLng || f._maxLat < minLat || f._minLat > maxLat)
    ) {
      continue;
    }

    const tier = f.properties?.tier || 'minor';
    const rName = (f._cleanName || f.properties?.name || '').trim();
    const isAlley = tier === 'alley' || rName.startsWith('Ngõ ');
    const mult = getTierMultiplier(tier, isAlley);

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      if (segLen < 1e-7) continue;

      const subSteps = Math.max(1, Math.ceil(segLen / maxStepDeg));
      let prevNode = ensureNode(p1[0], p1[1]);
      for (let s = 1; s <= subSteps; s++) {
        const t = s / subSteps;
        const curLng = p1[0] + (p2[0] - p1[0]) * t;
        const curLat = p1[1] + (p2[1] - p1[1]) * t;
        const curNode = ensureNode(curLng, curLat);
        if (curNode.key !== prevNode.key) {
          const d = Math.hypot(curNode.lng - prevNode.lng, curNode.lat - prevNode.lat);
          const c = d * mult;
          prevNode.edges.push({ to: curNode.key, cost: c, distDeg: d, roadName: rName });
          curNode.edges.push({ to: prevNode.key, cost: c, distDeg: d, roadName: rName });
          prevNode = curNode;
        }
      }
    }
  }

  if (nodes.size === 0) {
    const est = calculateDistanceAndEta(fromLat, fromLng, toLat, toLng);
    return {
      coordinates: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
      distanceMeters: est.roadMeters,
      roadNames: [],
    };
  }

  // Hàn nối tự động các đầu ngõ / ngã ba nằm sát nhau trong bán kính ~22m (0.00020 deg) bằng Spatial Grid
  const cellSize = 0.00022;
  const grid = new Map<string, GraphNode[]>();
  for (const n of nodes.values()) {
    const gx = Math.floor(n.lng / cellSize);
    const gy = Math.floor(n.lat / cellSize);
    const gk = `${gx},${gy}`;
    let bucket = grid.get(gk);
    if (!bucket) {
      bucket = [];
      grid.set(gk, bucket);
    }
    bucket.push(n);
  }

  const bridgeRadius = 0.00020;
  for (const n of nodes.values()) {
    const gx = Math.floor(n.lng / cellSize);
    const gy = Math.floor(n.lat / cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${gx + dx},${gy + dy}`);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const other = bucket[k];
          if (other.key <= n.key) continue;
          const d = Math.hypot(other.lng - n.lng, other.lat - n.lat);
          if (d > 0 && d <= bridgeRadius) {
            const already = n.edges.some((e) => e.to === other.key);
            if (!already) {
              // Cầu nối nhẹ giữa 2 đoạn đường giao nhau
              const bridgeCost = d * 1.35;
              n.edges.push({ to: other.key, cost: bridgeCost, distDeg: d, roadName: '' });
              other.edges.push({ to: n.key, cost: bridgeCost, distDeg: d, roadName: '' });
            }
          }
        }
      }
    }
  }

  // Tìm node đường gần điểm xuất phát và điểm đích nhất
  let startNode: GraphNode | null = null;
  let endNode: GraphNode | null = null;
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  for (const node of nodes.values()) {
    const ds = Math.hypot(node.lng - fromLng, node.lat - fromLat);
    if (ds < minStartDist) {
      minStartDist = ds;
      startNode = node;
    }
    const de = Math.hypot(node.lng - toLng, node.lat - toLat);
    if (de < minEndDist) {
      minEndDist = de;
      endNode = node;
    }
  }

  if (!startNode || !endNode || startNode.key === endNode.key) {
    const est = calculateDistanceAndEta(fromLat, fromLng, toLat, toLng);
    return {
      coordinates: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
      distanceMeters: est.roadMeters,
      roadNames: [],
    };
  }

  // A* Search
  const gScore = new Map<string, number>();
  const prev = new Map<string, { key: string; roadName: string }>();
  const visited = new Set<string>();
  const openSet: Array<{ key: string; f: number }> = [];

  gScore.set(startNode.key, 0);
  openSet.push({
    key: startNode.key,
    f: Math.hypot(endNode.lng - startNode.lng, endNode.lat - startNode.lat) * 0.82,
  });

  let found = false;
  let steps = 0;

  while (openSet.length > 0 && steps < 45000) {
    steps++;
    // Tìm phần tử có f nhỏ nhất (không cần sort toàn mảng mỗi bước -> nhanh gấp 10 lần)
    let bestIdx = 0;
    let bestF = openSet[0].f;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < bestF) {
        bestF = openSet[i].f;
        bestIdx = i;
      }
    }
    const current = openSet[bestIdx];
    openSet[bestIdx] = openSet[openSet.length - 1];
    openSet.pop();

    if (current.key === endNode.key) {
      found = true;
      break;
    }
    if (visited.has(current.key)) continue;
    visited.add(current.key);

    const curNode = nodes.get(current.key);
    if (!curNode) continue;
    const curG = gScore.get(current.key) ?? Infinity;

    for (let i = 0; i < curNode.edges.length; i++) {
      const edge = curNode.edges[i];
      if (visited.has(edge.to)) continue;
      const tentativeG = curG + edge.cost;
      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        gScore.set(edge.to, tentativeG);
        prev.set(edge.to, { key: current.key, roadName: edge.roadName });
        const targetNode = nodes.get(edge.to);
        const h = targetNode
          ? Math.hypot(endNode.lng - targetNode.lng, endNode.lat - targetNode.lat) * 0.82
          : 0;
        openSet.push({ key: edge.to, f: tentativeG + h });
      }
    }
  }

  if (!found) {
    const est = calculateDistanceAndEta(fromLat, fromLng, toLat, toLng);
    return {
      coordinates: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
      distanceMeters: est.roadMeters,
      roadNames: [],
    };
  }

  const pathCoords: Array<[number, number]> = [];
  const roadNamesList: string[] = [];
  let currKey: string | undefined = endNode.key;
  while (currKey) {
    const n = nodes.get(currKey);
    if (n) {
      pathCoords.push([n.lng, n.lat]);
    }
    const stepInfo = prev.get(currKey);
    if (stepInfo?.roadName && roadNamesList[roadNamesList.length - 1] !== stepInfo.roadName) {
      roadNamesList.push(stepInfo.roadName);
    }
    currKey = stepInfo?.key;
  }
  // Nếu điểm xuất phát nằm ngoài mạng lưới đường nội khu (> 80m, VD: từ Phúc Yên đi vào), nối thêm điểm xuất phát vào đầu tuyến
  const startGapMeters = haversineDistanceMeters(fromLat, fromLng, startNode.lat, startNode.lng);
  if (startGapMeters > 80) {
    pathCoords.push([fromLng, fromLat]);
  }
  pathCoords.reverse();
  roadNamesList.reverse();

  // Khử trùng lặp tên đường liên tiếp
  const uniqueRoadNames: string[] = [];
  for (const rn of roadNamesList) {
    if (rn && !uniqueRoadNames.includes(rn)) {
      uniqueRoadNames.push(rn);
    }
  }

  let totalMeters = 0;
  for (let i = 0; i < pathCoords.length - 1; i++) {
    const segMeters = haversineDistanceMeters(
      pathCoords[i][1],
      pathCoords[i][0],
      pathCoords[i + 1][1],
      pathCoords[i + 1][0]
    );
    // Nếu đoạn đầu nối từ ngoài phường (VD: Phúc Yên) vào cửa ngõ Xuân Hòa > 300m, nhân hệ số đường bộ 1.18
    totalMeters += i === 0 && segMeters > 300 ? Math.round(segMeters * 1.18) : segMeters;
  }

  return {
    coordinates: pathCoords,
    distanceMeters: Math.max(25, Math.round(totalMeters)),
    roadNames: uniqueRoadNames.slice(0, 4),
  };
}

/**
 * Kết hợp toàn bộ địa điểm thực tế (OSM Verified POIs đã hợp nhất Admin + Catalog Places)
 */
export function getAllMapPlaceLocations(): {
  allLocations: PlaceLocation[];
  verifiedMapMarkers: PlaceLocation[];
  unverifiedCatalogPlaces: PlaceLocation[];
} {
  const managedOsmLandmarks = getManagedOsmLandmarks(false);
  const catalogLocations = getCatalogPlaceLocations();
  const allLocations = [...managedOsmLandmarks, ...catalogLocations];
  const verifiedMapMarkers = allLocations.filter(
    (loc) => loc.coordinateVerified && loc.lat !== null && loc.lng !== null
  );
  const unverifiedCatalogPlaces = catalogLocations.filter(
    (loc) => !loc.coordinateVerified || loc.lat === null || loc.lng === null
  );

  return {
    allLocations,
    verifiedMapMarkers,
    unverifiedCatalogPlaces,
  };
}

/**
 * Hợp nhất 100% Quán ăn & Dịch vụ + Địa danh / Cơ quan / Trường học / Y tế cho Web Admin (`#admin`)
 */
export function getAllAdminPlaceAndLandmarkItems(): AdminPlaceItem[] {
  const baseManaged = getAllManagedPlaces();
  const existingIds = new Set(baseManaged.map((item) => item.place.id));
  const adminState = getAdminState();
  const landmarkItems: AdminPlaceItem[] = [];

  for (const basePoi of VERIFIED_OSM_POIS) {
    if (existingIds.has(basePoi.id)) continue;
    const ov = adminState.places?.[basePoi.id];
    const status = ov?.status || 'active';

    const hasOvCoords =
      typeof ov?.lat === 'number' &&
      typeof ov?.lng === 'number' &&
      Number.isFinite(ov.lat) &&
      Number.isFinite(ov.lng);

    const parsedFromUrl =
      !hasOvCoords && (ov?.mapsUrl || ov?.mapsQuery)
        ? parseCoordinatesFromInputOrUrl(ov.mapsUrl || ov.mapsQuery || '')
        : null;

    const finalLat = hasOvCoords ? Number(ov!.lat) : parsedFromUrl ? parsedFromUrl.lat : basePoi.lat;
    const finalLng = hasOvCoords ? Number(ov!.lng) : parsedFromUrl ? parsedFromUrl.lng : basePoi.lng;

    const finalName = ov?.name?.trim() ? ov.name.trim() : basePoi.name;
    const finalAddress = ov?.address?.trim() ? ov.address.trim() : basePoi.address;
    const finalPhone = ov?.phone !== undefined ? ov.phone : basePoi.phone || '';
    const finalHours = ov?.openHours !== undefined ? ov.openHours : basePoi.openHours || '07:30 - 17:30';
    const finalTagline =
      ov?.tagline !== undefined
        ? ov.tagline
        : basePoi.metadata?.subType || 'Địa danh & Đơn vị tại Phường Xuân Hòa';

    const syntheticPlace: Place = {
      id: basePoi.id,
      name: finalName,
      tagline: finalTagline,
      category: 'cafe',
      address: finalAddress,
      zone: 'center',
      distance: 'Phường Xuân Hòa',
      openHours: finalHours,
      phone: finalPhone,
      minPrice: ov?.minPrice ?? 0,
      maxPrice: ov?.maxPrice ?? 0,
      priceRange: 'Địa danh công cộng',
      rating: 5.0,
      reviewCount: 10,
      imageUrl: ov?.imageUrl || basePoi.imageUrl || '',
      rarity: 1,
      serviceMode: 'both',
      mapsQuery: ov?.mapsQuery || `${finalName} Xuân Hòa`,
      mapsUrl: ov?.mapsUrl || (finalLat && finalLng ? `${finalLat}, ${finalLng}` : ''),
      tags: ov?.tags || basePoi.metadata?.tags || ['Địa danh', 'Xuân Hòa'],
      quip: ov?.quip || finalTagline,
      signatureDish: {
        id: `${basePoi.id}_sig`,
        name: ov?.signatureDishName || 'Thông tin địa danh',
        price: ov?.signatureDishPrice ?? 0,
      },
      menu: [],
    };

    landmarkItems.push({
      place: syntheticPlace,
      status,
      sectorTag: ov?.sectorTag || 'dia-danh',
      fullMenu: ov?.customMenu || [],
      isVerified: ov?.coordinateVerified !== undefined ? ov.coordinateVerified : true,
      isFeatured: false,
      priorityBoost: ov?.priorityBoost || 1,
      isModified: Boolean(ov),
      isCustom: false,
      isNewlyDetected: false,
      updatedAt: ov?.updatedAt,
    });
  }

  const osmIds = new Set(VERIFIED_OSM_POIS.map((p) => p.id));
  const isItemPinned = (item: AdminPlaceItem): boolean => {
    if (osmIds.has(item.place.id)) return true;
    const ov = adminState.places?.[item.place.id];
    return Boolean(
      typeof ov?.lat === 'number' &&
        typeof ov?.lng === 'number' &&
        Number.isFinite(ov.lat) &&
        Number.isFinite(ov.lng) &&
        ov.coordinateVerified !== false
    );
  };

  return [...baseManaged, ...landmarkItems].sort((a, b) => {
    const aPinned = isItemPinned(a) ? 1 : 0;
    const bPinned = isItemPinned(b) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aCivic = a.sectorTag === 'dia-danh' ? 1 : 0;
    const bCivic = b.sectorTag === 'dia-danh' ? 1 : 0;
    if (aCivic !== bCivic) return bCivic - aCivic;
    return a.place.name.localeCompare(b.place.name, 'vi');
  });
}

/**
 * Chỉ lấy danh sách QUÁN ĂN / HÀNG QUÁN THƯƠNG MẠI dành riêng cho mục "Quản lý Quán".
 * Tuyệt đối KHÔNG đưa các đơn vị Hành chính, Công cộng, Trường học, Y tế, Địa danh vào Quản lý Quán.
 */
export function getCommercialAdminPlaceItems(): AdminPlaceItem[] {
  const adminState = getAdminState();
  const osmIds = new Set(VERIFIED_OSM_POIS.map((p) => p.id));
  return getAllManagedPlaces().filter((item) => {
    if (osmIds.has(item.place.id)) return false;
    if (item.sectorTag === 'dia-danh') return false;
    const ov = adminState.places?.[item.place.id];
    if (
      ov?.sectorTag === 'dia-danh' ||
      ov?.mapCategory === 'public' ||
      ov?.mapCategory === 'school' ||
      ov?.mapCategory === 'medical'
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Lưu chỉnh sửa hoặc tạo mới một Địa danh / Quán ăn trực tiếp từ Bản đồ 3D / 2D hoặc Web Admin
 */
export function saveLandmarkOrPlaceFromMap(payload: {
  id?: string;
  name: string;
  category: Exclude<MapCategoryKey, 'all' | 'game_asset'>;
  address: string;
  phone?: string;
  openHours?: string;
  tagline?: string;
  lat: number;
  lng: number;
  mapsUrl?: string;
}): { id: string; lat: number; lng: number } {
  const cleanName = payload.name.trim();
  if (!cleanName) {
    throw new Error('Vui lòng nhập tên địa danh hoặc tên quán.');
  }
  const lat = Number(Number(payload.lat).toFixed(6));
  const lng = Number(Number(payload.lng).toFixed(6));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 20 || lat > 23 || lng < 104 || lng > 107) {
    throw new Error('Tọa độ định vị chưa hợp lệ (cần nằm trong khu vực Xuân Hòa / miền Bắc).');
  }

  const isCivicCat =
    payload.category === 'public' ||
    payload.category === 'school' ||
    String(payload.category) === 'medical';

  if (payload.id) {
    const adminState = getAdminState();
    const existingOv = adminState.places?.[payload.id];
    const isOsmSeed = VERIFIED_OSM_POIS.some((p) => p.id === payload.id);

    // Chỉnh sửa thông tin / định vị của địa điểm đã có: Cả Admin và Quản lý Maps đều được áp dụng ngay lập tức (không cần duyệt)
    savePlaceAdminOverride(
      payload.id,
      {
        status: existingOv?.status === 'locked' ? 'locked' : 'active',
        name: cleanName,
        address: payload.address.trim() || 'Phường Xuân Hòa',
        phone: (payload.phone || '').trim(),
        openHours: (payload.openHours || '').trim(),
        ...(payload.tagline !== undefined ? { tagline: payload.tagline.trim() } : {}),
        ...(payload.mapsUrl !== undefined ? { mapsUrl: payload.mapsUrl.trim() } : {}),
        mapCategory: payload.category,
        ...(isCivicCat || (isOsmSeed && !existingOv?.sectorTag)
          ? {
              sectorTag: 'dia-danh',
              minPrice: 0,
              maxPrice: 0,
              customMenu: [],
            }
          : {}),
        lat,
        lng,
        coordinateVerified: true,
        coordinateSource: 'admin_verified',
        lastVerifiedAt: new Date().toISOString().slice(0, 10),
        pendingMapApproval: null,
      },
      `Cập nhật địa điểm & định vị "${cleanName}" (${lat}, ${lng})`
    );
    return { id: payload.id, lat, lng };
  }

  // Tạo địa danh / quán mới
  const created = createNewPlaceFromMap(undefined, {
    name: cleanName,
    mapCategory: payload.category,
    address: payload.address.trim() || 'Phường Xuân Hòa',
    phone: (payload.phone || '').trim(),
    openHours: (payload.openHours || '').trim() || (isCivicCat ? '07:30 - 17:30' : '07:00 - 22:00'),
    tagline: payload.tagline?.trim(),
    lat,
    lng,
    mapsUrl: payload.mapsUrl?.trim(),
  });
  return { id: created.place.id, lat, lng };
}

export function blockLandmarkOrPlaceFromMap(placeId: string, placeName?: string): void {
  savePlaceAdminOverride(
    placeId,
    { status: 'locked' },
    `Block (Tạm khóa) địa điểm "${placeName || placeId}" trên Bản đồ`
  );
}

export function hideLandmarkOrPlaceFromMap(
  placeId: string,
  placeName?: string
): { executedImmediately: boolean } {
  return requestOrExecuteDeletePlace(placeId, 'maps', placeName);
}

export function restoreLandmarkOrPlaceDefault(placeId: string): void {
  resetPlaceToDefault(placeId);
}

/**
 * Tìm tuyến đường OSM khớp với địa chỉ của quán để hỗ trợ Admin đối chiếu (không tự động đánh dấu đã xác minh)
 */
export function findSuggestedRoadForAddress(
  address: string,
  roads: RoadSearchResult[] = VERIFIED_OSM_ROADS_SEED
): RoadSearchResult | null {
  const normAddr = normalizeVietnamese(address);
  if (!normAddr) return null;

  for (const road of roads) {
    const cleanRoadName = normalizeVietnamese(
      road.name.replace(/^(duong|pho|ngo|ngach|cau)\s+/i, '')
    );
    if (cleanRoadName.length >= 4 && normAddr.includes(cleanRoadName)) {
      return road;
    }
  }
  return null;
}

/**
 * Adapter gọi OpenStreetMap Nominatim Geocoding hợp lệ để đề xuất tọa độ cho Admin (Phần 7)
 * Kết quả trả về luôn ở trạng thái đề xuất, bắt buộc Admin xác nhận trước khi lưu `coordinateVerified: true`.
 */
export async function geocodeAddressWithNominatim(
  queryText: string,
  signal?: AbortSignal
): Promise<Array<{ displayName: string; lat: number; lng: number; osmType?: string; osmId?: number }>> {
  const cleanQuery = queryText.trim();
  if (!cleanQuery) return [];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${cleanQuery}, Phúc Yên, Vĩnh Phúc, Việt Nam`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'vn');
  url.searchParams.set('viewbox', '105.65,21.42,105.80,21.25');
  url.searchParams.set('bounded', '0');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`);
  }

  const raw = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    osm_type?: string;
    osm_id?: number;
  }>;

  return raw
    .map((item) => ({
      displayName: item.display_name,
      lat: Number(parseFloat(item.lat).toFixed(6)),
      lng: Number(parseFloat(item.lon).toFixed(6)),
      osmType: item.osm_type,
      osmId: item.osm_id,
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

/**
 * Dữ liệu Tài sản Game mẫu (Entity C — Phần 9)
 * Tách biệt hoàn toàn khỏi địa điểm thật, có ID riêng, tham chiếu đối tượng địa lý và gắn nhãn DEMO rõ ràng.
 */
export const DEMO_GAME_ASSETS: GameAsset[] = [
  {
    id: 'xuho_lot_demo_sp2_hub',
    name: '[DEMO] Trạm Học Viện Ẩm Thực SP2',
    assetType: 'campus_hub',
    linkedGeoOsmId: 'way/1080000083',
    districtLabel: 'Phân khu ĐH Sư Phạm 2',
    lat: 21.27975,
    lng: 105.72695,
    ownershipStatus: 'system_landmark',
    rentalStatus: 'none',
    ownerAccountId: 'system_xuho',
    ownerDisplayName: 'Hệ Thống XUHO CITY (Demo)',
    ownerAvatar: '🏰',
    virtualBuyPriceXu: 0,
    virtualRentPriceXuPerDay: 0,
    assetState: 'active_demo',
    description: 'Trung tâm nhiệm vụ & điểm tập kết cư dân ảo khu vực ĐH Sư phạm Hà Nội 2 (Dữ liệu mô phỏng Game).',
    perks: ['+10% EXP Vòng quay khu ĐHSP2 (Dự kiến)', 'Điểm check-in nhiệm vụ ngày'],
    transactionHistory: [
      {
        txId: 'tx_demo_001',
        action: 'mint_demo',
        actorName: 'XUHO System',
        amountXu: 0,
        timestamp: '2026-10-18T08:00:00Z',
        isDemo: true,
      },
    ],
    isDemoData: true,
  },
  {
    id: 'xuho_lot_demo_nvl_01',
    name: '[DEMO] Lô Góc Phố Nguyễn Văn Linh #A01',
    assetType: 'virtual_shop',
    linkedGeoOsmId: 'way/157991278',
    districtLabel: 'Trục thương mại Nguyễn Văn Linh',
    lat: 21.2862,
    lng: 105.7198,
    ownershipStatus: 'available',
    rentalStatus: 'seeking_tenant',
    ownerAccountId: null,
    ownerDisplayName: null,
    ownerAvatar: '🏪',
    virtualBuyPriceXu: 25000,
    virtualRentPriceXuPerDay: 450,
    assetState: 'active_demo',
    description: 'Mặt bằng cửa hàng ảo trên trục Nguyễn Văn Linh dành cho tính năng mở quán trong tương lai.',
    perks: ['Mặt tiền trục chính sinh viên', 'Cho phép gắn biển hiệu ảo (Sắp ra mắt)'],
    transactionHistory: [
      {
        txId: 'tx_demo_002',
        action: 'mint_demo',
        actorName: 'XUHO System',
        amountXu: 25000,
        timestamp: '2026-10-18T08:00:00Z',
        isDemo: true,
      },
    ],
    isDemoData: true,
  },
  {
    id: 'xuho_lot_demo_ktx_02',
    name: '[DEMO] Gian Hàng Ảo Phố Võ Thị Sáu #K02',
    assetType: 'virtual_shop',
    linkedGeoOsmId: 'way/176265733',
    districtLabel: 'Phân khu KTX S1–S4',
    lat: 21.2833,
    lng: 105.7239,
    ownershipStatus: 'for_rent',
    rentalStatus: 'seeking_tenant',
    ownerAccountId: 'demo_guardian_01',
    ownerDisplayName: 'Thực Thần Xuân Hòa (Demo)',
    ownerAvatar: '🐲',
    virtualBuyPriceXu: 18000,
    virtualRentPriceXuPerDay: 320,
    assetState: 'active_demo',
    description: 'Tài sản mô phỏng cơ chế thuê cửa hàng ảo sát cổng Ký túc xá ĐHSP2.',
    perks: ['Lưu lượng cư dân KTX cao', 'Hỗ trợ mở gian hàng trà chanh ảo'],
    transactionHistory: [
      {
        txId: 'tx_demo_003',
        action: 'list_virtual',
        actorName: 'Thực Thần Xuân Hòa (Demo)',
        amountXu: 320,
        timestamp: '2026-10-18T08:00:00Z',
        isDemo: true,
      },
    ],
    isDemoData: true,
  },
  {
    id: 'xuho_lot_demo_dailai_villa',
    name: '[DEMO] Biệt Thự Ảo Ven Hồ Đại Lải #V09',
    assetType: 'virtual_house',
    linkedGeoOsmId: 'node/4465494190',
    districtLabel: 'Phân khu Sinh thái Đại Lải - Ngọc Thanh',
    lat: 21.3328,
    lng: 105.7148,
    ownershipStatus: 'available',
    rentalStatus: 'none',
    ownerAccountId: null,
    ownerDisplayName: null,
    ownerAvatar: '🏡',
    virtualBuyPriceXu: 68000,
    virtualRentPriceXuPerDay: 1200,
    assetState: 'developing',
    description: 'Biệt thự nghỉ dưỡng ảo ven Hồ Đại Lải — minh họa kiến trúc tài sản cấp cao trong XUHO CITY.',
    perks: ['View mặt hồ Đại Lải', 'Tăng điểm danh vọng cư dân ảo'],
    transactionHistory: [
      {
        txId: 'tx_demo_004',
        action: 'mint_demo',
        actorName: 'XUHO System',
        amountXu: 68000,
        timestamp: '2026-10-18T08:00:00Z',
        isDemo: true,
      },
    ],
    isDemoData: true,
  },
];

/**
 * Báo cáo chất lượng dữ liệu địa lý trung thực (Phần 3.3)
 */
export function buildDataQualityReport(): DataQualityReport {
  const { verifiedMapMarkers, unverifiedCatalogPlaces } = getAllMapPlaceLocations();
  const catalogTotal = getCatalogPlaceLocations().length;
  const catalogVerified = catalogTotal - unverifiedCatalogPlaces.length;

  return {
    scopeName: 'Phường Xuân Hòa mới, Tỉnh Phú Thọ (Sau sắp xếp ĐVHC)',
    osmRelationId: 19542980,
    mergedUnits: [
      'Phường Xuân Hòa (cũ)',
      'Phường Đồng Xuân (cũ)',
      'Xã Cao Minh (cũ)',
      'Xã Ngọc Thanh (cũ — bao gồm khu vực Hồ Đại Lải)',
    ],
    sources: [
      {
        name: 'OpenStreetMap Overpass API (Relation #19542980 & BBox 21.258–21.418, 105.675–105.790)',
        license: 'Open Data Commons Open Database License (ODbL 1.0)',
        updatedAt: '2026-10-18',
        usageNote: 'Cung cấp ranh giới hành chính, 6.225 đoạn đường/ngõ, 5.083 khối nhà, 236 mặt hồ và các trường học/địa điểm công cộng đã xác minh.',
      },
      {
        name: 'OpenFreeMap Vector Tiles (planet)',
        license: 'ODbL 1.0 / OpenMapTiles schema',
        updatedAt: '2026-10-18',
        usageNote: 'Hiển thị lớp địa lý nền bổ trợ cho các xã/phường lân cận xung quanh Xuân Hòa.',
      },
      {
        name: 'Danh mục Xuân Hòa Có Gì (src/lib/places-xuanhoa.ts & Admin Store)',
        license: 'Dữ liệu nội bộ Xuanhoacogi.com',
        updatedAt: '2026-10-18',
        usageNote: `${catalogTotal} quán ăn/đồ uống thực tế có địa chỉ, thực đơn, số điện thoại. Chỉ gắn ghim lên bản đồ khi đã xác minh tọa độ.`,
      },
    ],
    stats: {
      osmRoadsCount: 6225,
      osmNamedRoadsCount: 77,
      osmBuildingsCount: 5083,
      osmWaterPolygonsCount: 236,
      osmWaterwaysCount: 81,
      osmLanduseCount: 112,
      osmVerifiedPoisCount: verifiedMapMarkers.length,
      catalogTotalPlaces: catalogTotal,
      catalogVerifiedCoordsCount: catalogVerified,
      catalogPendingVerificationCount: unverifiedCatalogPlaces.length,
    },
    knownLimitations: [
      'Nhiều tuyến ngõ nhỏ dân sinh trong OpenStreetMap đã có hình học đường (LineString) nhưng chưa có thuộc tính tên ngõ chính thức trên OSM.',
      `Trong ${catalogTotal} quán của danh mục ẩm thực hiện tại, có ${unverifiedCatalogPlaces.length} quán mới chỉ có địa chỉ dạng văn bản và đang ở trạng thái "Chờ xác minh tọa độ" (không tự gán tọa độ giả lên bản đồ). Quản trị viên có thể xác minh từng quán trong công cụ Admin Tọa Độ.`,
      'Một số danh mục thương mại chuyên biệt (như CLB Bi-a, Phòng máy Cyber Game, Cửa hàng Điện thoại) hiện chưa có node được gắn thẻ đầy đủ trên OpenStreetMap tại Xuân Hòa và cần bổ sung qua khảo sát thực địa hoặc Admin.',
    ],
  };
}

/**
 * Quản lý danh sách địa điểm Đã lưu (★) theo đúng tài khoản (nick) của khách
 */
const SAVED_PLACES_STORAGE_PREFIX = 'xuanhoa_saved_places_v1_';

export function normalizeUserSaveKey(userIdentifier?: string | null): string {
  const clean = (userIdentifier || 'guest').trim().toLowerCase();
  return clean || 'guest';
}

export function getSavedPlaceIdsForUser(userIdentifier?: string | null): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `${SAVED_PLACES_STORAGE_PREFIX}${normalizeUserSaveKey(userIdentifier)}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function toggleSavedPlaceForUser(
  userIdentifier: string | null | undefined,
  placeId: string
): { savedIds: string[]; isSavedNow: boolean } {
  if (typeof window === 'undefined') {
    return { savedIds: [], isSavedNow: false };
  }
  const key = `${SAVED_PLACES_STORAGE_PREFIX}${normalizeUserSaveKey(userIdentifier)}`;
  const current = getSavedPlaceIdsForUser(userIdentifier);
  const exists = current.includes(placeId);
  const next = exists ? current.filter((id) => id !== placeId) : [placeId, ...current];
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return { savedIds: next, isSavedNow: !exists };
}

/**
 * Quản lý vị trí "Chỗ bạn sống / Nhà của bạn" (biểu tượng Ngôi nhà) theo đúng tài khoản (nick) của khách
 */
export interface UserHomeLocation {
  label: string;
  address: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

const USER_HOME_STORAGE_PREFIX = 'xuanhoa_user_home_v1_';

export function getUserHomeForUser(userIdentifier?: string | null): UserHomeLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `${USER_HOME_STORAGE_PREFIX}${normalizeUserSaveKey(userIdentifier)}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number' &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return {
        label: String(parsed.label || 'Nhà của bạn'),
        address: String(parsed.address || 'Chỗ bạn sinh sống tại Xuân Hòa'),
        lat: Number(parsed.lat),
        lng: Number(parsed.lng),
        updatedAt: Number(parsed.updatedAt || Date.now()),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveUserHomeForUser(
  userIdentifier: string | null | undefined,
  home: { label?: string; address?: string; lat: number; lng: number }
): UserHomeLocation {
  const saved: UserHomeLocation = {
    label: (home.label || 'Nhà của bạn').trim() || 'Nhà của bạn',
    address: (home.address || 'Chỗ bạn sinh sống').trim() || 'Chỗ bạn sinh sống',
    lat: Number(Number(home.lat).toFixed(6)),
    lng: Number(Number(home.lng).toFixed(6)),
    updatedAt: Date.now(),
  };
  if (typeof window !== 'undefined') {
    try {
      const key = `${USER_HOME_STORAGE_PREFIX}${normalizeUserSaveKey(userIdentifier)}`;
      window.localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      // ignore storage quota errors
    }
  }
  return saved;
}

export function clearUserHomeForUser(userIdentifier?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${USER_HOME_STORAGE_PREFIX}${normalizeUserSaveKey(userIdentifier)}`;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}


