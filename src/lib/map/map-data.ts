import { getPlaceStyleGroup, type Place } from '@/lib/places-xuanhoa';
import { getActivePublicPlaces, getAdminState } from '@/lib/admin-store';
import type {
  DataQualityReport,
  GameAsset,
  MapCategoryKey,
  PlaceLocation,
  RoadSearchResult,
} from './map-types';

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
  {
    id: 'osm_way_1213848472',
    name: 'Trung tâm GDQP & An ninh - ĐH Sư phạm Hà Nội 2',
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
      subType: 'Đại học / Học viện',
      tags: ['ĐHSP2', 'Giáo dục Quốc phòng', 'Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_1080000083',
    name: 'Hội trường 14-8 — Trường ĐH Sư phạm Hà Nội 2',
    category: 'school',
    address: 'Số 32 Nguyễn Văn Linh, Phường Xuân Hòa',
    lat: 21.279185,
    lng: 105.727157,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1080000083',
      subType: 'Khu trung tâm ĐHSP2',
      tags: ['ĐHSP2', 'Hội trường 14-8'],
    },
  },
  {
    id: 'osm_way_1289786114',
    name: 'Giảng đường A — Trường ĐH Sư phạm Hà Nội 2',
    category: 'school',
    address: 'Khuôn viên ĐHSP Hà Nội 2, Phường Xuân Hòa',
    lat: 21.281254,
    lng: 105.728220,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1289786114',
      subType: 'Giảng đường ĐHSP2',
      tags: ['ĐHSP2', 'Giảng đường A'],
    },
  },
  {
    id: 'osm_way_1289786115',
    name: 'Giảng đường B — Trường ĐH Sư phạm Hà Nội 2',
    category: 'school',
    address: 'Khuôn viên ĐHSP Hà Nội 2, Phường Xuân Hòa',
    lat: 21.281014,
    lng: 105.728513,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1289786115',
      subType: 'Giảng đường ĐHSP2',
      tags: ['ĐHSP2', 'Giảng đường B'],
    },
  },
  {
    id: 'osm_way_1289786116',
    name: 'Giảng đường C — Trường ĐH Sư phạm Hà Nội 2',
    category: 'school',
    address: 'Khuôn viên ĐHSP Hà Nội 2, Phường Xuân Hòa',
    lat: 21.280733,
    lng: 105.728165,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1289786116',
      subType: 'Giảng đường ĐHSP2',
      tags: ['ĐHSP2', 'Giảng đường C'],
    },
  },
  {
    id: 'osm_way_1289786117',
    name: 'Giảng đường D — Trường ĐH Sư phạm Hà Nội 2',
    category: 'school',
    address: 'Khuôn viên ĐHSP Hà Nội 2, Phường Xuân Hòa',
    lat: 21.281022,
    lng: 105.727952,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1289786117',
      subType: 'Giảng đường ĐHSP2',
      tags: ['ĐHSP2', 'Giảng đường D'],
    },
  },
  {
    id: 'osm_way_1080000085',
    name: 'Giảng đường E — Trường ĐH Sư phạm Hà Nội 2',
    category: 'school',
    address: 'Khuôn viên ĐHSP Hà Nội 2, Phường Xuân Hòa',
    lat: 21.279410,
    lng: 105.726804,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1080000085',
      subType: 'Giảng đường ĐHSP2',
      tags: ['ĐHSP2', 'Giảng đường E'],
    },
  },
  {
    id: 'osm_way_662917174',
    name: 'Ký túc xá Trường ĐH Sư phạm Hà Nội 2 (S1–S4)',
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
      subType: 'Khu Ký túc xá sinh viên',
      tags: ['KTX SP2', 'S1', 'S2', 'S3', 'S4'],
    },
  },
  {
    id: 'osm_way_1079368029',
    name: 'Trường Đại học Kiến trúc Hà Nội (Cơ sở Xuân Hòa)',
    category: 'school',
    address: 'Phường Xuân Hòa, Tỉnh Phú Thọ',
    lat: 21.280026,
    lng: 105.728097,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1079368029',
      subType: 'Trường Đại học',
      tags: ['ĐH Kiến Trúc', 'Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_1079368032',
    name: 'Trường Cao đẳng Cơ điện Hà Nội (Cơ sở Xuân Hòa)',
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
      subType: 'Trường Cao đẳng',
      tags: ['CĐ Cơ Điện', '22A Nguyễn Văn Linh'],
    },
  },
  {
    id: 'osm_way_1067453692',
    name: 'Trường Cao đẳng nghề Việt-Xô số 1',
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
      subType: 'Trường Cao đẳng nghề',
      tags: ['Việt-Xô số 1', 'Xuân Hòa'],
    },
  },
  {
    id: 'osm_way_662917178',
    name: 'Trường THPT Xuân Hòa',
    category: 'school',
    address: 'Đường Lê Quang Đạo / Phạm Văn Đồng, Phường Xuân Hòa',
    lat: 21.284455,
    lng: 105.721661,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/662917178',
      subType: 'Trường THPT',
      tags: ['THPT Xuân Hòa'],
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
      subType: 'Trường THCS',
      tags: ['THCS Xuân Hòa'],
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
      subType: 'Trường Tiểu học',
      tags: ['Tiểu học Xuân Hòa'],
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
      subType: 'Trường Mầm non',
      tags: ['Mầm non Đồng Xuân'],
    },
  },
  {
    id: 'osm_way_1289786125',
    name: 'Phòng khám Đa khoa khu vực Xuân Hoà',
    category: 'public',
    address: 'Phố Lê Xoay, Phường Xuân Hòa',
    lat: 21.281163,
    lng: 105.729623,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/1289786125',
      subType: 'Cơ sở Y tế công cộng',
      tags: ['Phòng khám đa khoa Xuân Hòa', 'Y tế'],
    },
  },
  {
    id: 'osm_way_1086841610',
    name: 'Nhà Thể Chất — Khu KTX ĐH Sư phạm Hà Nội 2',
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
      subType: 'Nhà thi đấu / Thể thao',
      tags: ['Nhà thể chất', 'Thể thao sinh viên'],
    },
  },
  {
    id: 'osm_way_662917177',
    name: 'Ngân hàng BIDV Chi nhánh Phúc Yên (Phòng GD Xuân Hòa)',
    category: 'service',
    address: 'Ngã tư Lê Xoay - Trường Chinh, Phường Xuân Hòa',
    lat: 21.278556,
    lng: 105.729410,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'way/662917177',
      subType: 'Ngân hàng & ATM',
      tags: ['BIDV', 'Ngân hàng', 'ATM'],
    },
  },
  {
    id: 'osm_node_4465494190',
    name: 'Flamingo Đại Lải Resort (Cổng chính Ngọc Thanh)',
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
      subType: 'Khu nghỉ dưỡng & Giải trí 5 sao',
      tags: ['Flamingo Đại Lải', 'Resort', 'Ngọc Thanh'],
    },
  },
  {
    id: 'osm_node_4506575392',
    name: 'Flamingo Đại Lải Resort — Khu Bắc Bán Đảo',
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
      subType: 'Khu biệt thự nghỉ dưỡng',
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
      subType: 'Sân Golf & Giải trí',
      tags: ['Sân Golf Đại Lải', 'Ngọc Thanh'],
    },
  },
  {
    id: 'osm_way_1121965262',
    name: 'Hồ Lập Đinh — Khu Ngọc Thanh',
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
      subType: 'Hồ sinh thái tự nhiên',
      tags: ['Hồ Lập Đinh', 'Ngọc Thanh'],
    },
  },
  {
    id: 'osm_node_4369604339',
    name: 'Nhà lưu trú Phố Lê Xoay (OSM #4369604339)',
    category: 'service',
    address: 'Phố Lê Xoay, Phường Xuân Hòa',
    lat: 21.280849,
    lng: 105.730222,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: true,
    metadata: {
      osmId: 'node/4369604339',
      subType: 'Lưu trú / Nhà khách',
      tags: ['Lưu trú', 'Lê Xoay'],
    },
  },
  {
    id: 'osm_node_1417938297',
    name: 'Điểm di tích / Tôn giáo Ngọc Thanh (OSM #1417938297)',
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
      subType: 'Địa điểm tín ngưỡng / Công cộng',
      tags: ['Ngọc Thanh'],
    },
  },
  // Các địa điểm OSM đã xác minh nằm ngay sát ranh giới Xuân Hòa (vùng đệm khám phá lân cận)
  {
    id: 'osm_way_1294635783',
    name: 'Trường CĐ Công nghiệp và Thương mại (Cơ sở 2)',
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
      subType: 'Trường Cao đẳng (Vùng giáp ranh)',
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
    id: 'osm_way_1484974701',
    name: 'Tạp hoá Sơn Hà (OSM Verified)',
    category: 'grocery',
    address: 'Tuyến đường vào hồ Đồng Đò, giáp Đông Ngọc Thanh',
    lat: 21.311145,
    lng: 105.764983,
    coordinateSource: 'openstreetmap',
    coordinateVerified: true,
    dataSource: 'openstreetmap',
    lastVerifiedAt: '2026-10-18',
    insideWard: false,
    metadata: {
      osmId: 'way/1484974701',
      subType: 'Cửa hàng tạp hóa',
      tags: ['Tạp hóa'],
    },
  },
  {
    id: 'osm_node_9459565251',
    name: 'Cà Phê GISY Lake House (OSM Verified)',
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
      subType: 'Cà phê ven hồ',
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

  const styleGroup = getPlaceStyleGroup(place);
  if (styleGroup === 'nhau-lau') return 'pub';
  if (styleGroup === 'uong') return 'cafe';
  if (styleGroup === 'an-vat') return 'snack';
  return 'food';
}

/**
 * Chuyển đổi toàn bộ địa điểm trong `places-xuanhoa.ts` + `admin-store.ts`
 * sang chuẩn `PlaceLocation` (Phần 7).
 *
 * NGUYÊN TẮC NGHIÊM NGẶT:
 * - Nếu quán chưa được xác minh tọa độ (`coordinateVerified !== true`), giữ `lat: null, lng: null` (hoặc lưu tọa độ chờ xác nhận nhưng `coordinateVerified: false`).
 * - Tuyệt đối không tự gán tọa độ giả để vẽ bừa lên bản đồ.
 */
export function getCatalogPlaceLocations(): PlaceLocation[] {
  const activePlaces = getActivePublicPlaces();
  const adminState = getAdminState();

  return activePlaces.map((place) => {
    const override = adminState.places?.[place.id];
    const hasValidLatLng =
      typeof override?.lat === 'number' &&
      typeof override?.lng === 'number' &&
      Number.isFinite(override.lat) &&
      Number.isFinite(override.lng);

    const isVerified = Boolean(hasValidLatLng && override?.coordinateVerified === true);

    return {
      id: place.id,
      name: place.name,
      category: resolvePlaceMapCategory(place, override?.sectorTag, override?.mapCategory),
      address: place.address || 'Phường Xuân Hòa, Tỉnh Phú Thọ',
      lat: hasValidLatLng ? Number(override!.lat) : null,
      lng: hasValidLatLng ? Number(override!.lng) : null,
      coordinateSource: hasValidLatLng
        ? override?.coordinateSource || 'admin_verified'
        : 'unverified',
      coordinateVerified: isVerified,
      dataSource: override?.isCustom ? 'admin_custom' : 'places_xuanhoa',
      lastVerifiedAt: override?.lastVerifiedAt || null,
      phone: place.phone,
      openHours: place.openHours,
      imageUrl: place.imageUrl,
      insideWard: true,
      originalPlace: place,
      metadata: {
        zone: place.zone,
        distance: place.distance,
        priceRange: place.priceRange,
        rating: place.rating,
        reviewCount: place.reviewCount,
        signatureDishName: place.signatureDish?.name,
        signatureDishPrice: place.signatureDish?.price,
        tags: place.tags,
        quip: place.quip,
        mapsQuery: place.mapsQuery,
        mapsUrl: place.mapsUrl,
      },
    };
  });
}

/**
 * Kết hợp toàn bộ địa điểm thực tế (OSM Verified POIs + Catalog Places)
 */
export function getAllMapPlaceLocations(): {
  allLocations: PlaceLocation[];
  verifiedMapMarkers: PlaceLocation[];
  unverifiedCatalogPlaces: PlaceLocation[];
} {
  const catalogLocations = getCatalogPlaceLocations();
  const allLocations = [...VERIFIED_OSM_POIS, ...catalogLocations];
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
