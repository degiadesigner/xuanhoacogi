/**
 * Hệ thống Quản lý, Xác minh & Chỉnh sửa Đường / Ngõ / Ngách Xuân Hòa (Single Source of Truth 2D + 3D)
 *
 * Nguyên tắc cốt lõi:
 * 1. Tách biệt hoàn toàn Tên đường (name, nameSource) và Hình học đường (geometry, geometrySource) theo roadId.
 * 2. KHÔNG ĐƯỢC ĐOÁN TÊN NGÕ THEO CON ĐƯỜNG GẦN NHẤT (Nearest-road heuristic bị cấm tự động gắn tên).
 * 3. Priority nguồn dữ liệu:
 *    local_verified (1) > admin_verified (2) > cadastral (3) > google_maps (4) > osm (5) > public_address (6) > inferred (7).
 *    inferred KHÔNG BAO GIỜ tự hiển thị tên ngõ như dữ liệu chính thức.
 * 4. local_verified + verificationStatus="verified" (hoặc locked=true) luôn thắng mọi bản cập nhật ngoài (OSM/Google).
 */

export type RoadHierarchyClass =
  | 'major'
  | 'arterial'
  | 'local'
  | 'alley'
  | 'access';

export type RoadType =
  | 'road'
  | 'street'
  | 'local_road'
  | 'alley'
  | 'lane'
  | 'path'
  | 'service_road'
  | 'access_road';

export type RoadNameSource =
  | 'local_verified'
  | 'admin_verified'
  | 'cadastral'
  | 'google_maps'
  | 'osm'
  | 'legal_other'
  | 'public_address'
  | 'inferred'
  | 'unverified';

export type RoadGeometrySource =
  | 'local_verified'
  | 'admin_drawn'
  | 'cadastral'
  | 'google_maps'
  | 'osm';

export type RoadVerificationStatus =
  | 'verified'
  | 'candidate'
  | 'needs_review'
  | 'rejected'
  | 'unverified';

export interface RoadRecord {
  roadId: string;
  name: string;
  roadClass: RoadHierarchyClass;
  roadType: RoadType;
  parentRoadId: string | null;
  parentRoad: string | null;
  geometry: [number, number][];

  source: RoadNameSource;
  nameSource: RoadNameSource;
  geometrySource: RoadGeometrySource;

  verified: boolean;
  confidence: number;
  verificationStatus: RoadVerificationStatus;
  locked: boolean;

  verifiedBy: string | null;
  verifiedAt: string | null;

  rejectedName?: string | null;
  candidateRoadId?: string | null;
  note?: string | null;
  widthM?: number;
  deleted?: boolean;
}

export interface RoadOverridePatch {
  roadId: string;
  name?: string;
  roadClass?: RoadHierarchyClass;
  roadType?: RoadType;
  parentRoadId?: string | null;
  parentRoad?: string | null;
  geometry?: [number, number][];
  source?: RoadNameSource;
  nameSource?: RoadNameSource;
  geometrySource?: RoadGeometrySource;
  verified?: boolean;
  confidence?: number;
  verificationStatus?: RoadVerificationStatus;
  locked?: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  rejectedName?: string | null;
  candidateRoadId?: string | null;
  note?: string | null;
  widthM?: number;
  deleted?: boolean;
  isCustomRoad?: boolean;
}

export interface RoadAuditIssue {
  id: string;
  roadId: string;
  candidateRoadId?: string | null;
  name: string;
  roadClass?: RoadHierarchyClass;
  roadType: RoadType;
  parentRoad: string | null;
  issueType:
    | 'pending_review_alley'
    | 'rejected_wrong_association'
    | 'unconnected_to_parent'
    | 'duplicate_distant_alley'
    | 'disconnected_same_name_segments'
    | 'missing_parent_road'
    | 'abnormal_geometry';
  severity: 'high' | 'medium' | 'low';
  description: string;
  center: [number, number];
  verificationStatus: RoadVerificationStatus;
}

export const ROAD_OVERRIDES_STORAGE_KEY = 'xuanhoa_road_overrides_v3';
export const ROAD_OVERRIDES_UPDATED_EVENT = 'xuanhoa_road_overrides_updated';

export const ROAD_NAME_SOURCE_PRIORITY: Record<RoadNameSource, number> = {
  local_verified: 1,
  admin_verified: 2,
  cadastral: 3,
  osm: 4,
  google_maps: 5,
  legal_other: 6,
  public_address: 7,
  unverified: 8,
  inferred: 9,
};

export const ROAD_CLASS_LABELS: Record<RoadHierarchyClass, string> = {
  major: 'Cấp 1 — Đường lớn (Major)',
  arterial: 'Cấp 2 — Trục phố chính (Arterial)',
  local: 'Cấp 3 — Đường dân sinh (Local)',
  alley: 'Cấp 4 — Ngõ / Ngách (Alley)',
  access: 'Cấp 5 — Lối nội bộ / Đường mòn (Access)',
};

export const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  road: 'Đường lớn (Road)',
  street: 'Phố / Đường (Street)',
  local_road: 'Đường dân sinh (Local Road)',
  alley: 'Ngõ (Alley)',
  lane: 'Ngách / Hẻm (Lane)',
  service_road: 'Đường nội bộ (Service Road)',
  access_road: 'Lối tiếp cận (Access Road)',
  path: 'Lối đi bộ / Đường mòn (Path)',
};

export const VERIFICATION_STATUS_LABELS: Record<RoadVerificationStatus, string> = {
  verified: 'Đã xác minh',
  candidate: 'Ứng viên',
  needs_review: 'Cần rà soát',
  rejected: 'Đã gỡ gắn sai (Khóa)',
  unverified: 'Chưa xác minh',
};

/**
 * Override mặc định bắt buộc theo Audit (Mục 27):
 * 1. Gỡ bỏ hoàn toàn và khóa (rejected + locked) đoạn đường phía Nam từng bị gắn nhầm "Ngõ 29 Nguyễn Văn Linh"
 *    (xh_road_ngo_29_nguyen_van_linh / gmaps/way_3114 / gmaps/way_3112).
 * 2. Xác minh local_verified nhánh phía Bắc way/176151686 ([105.717687, 21.285617] -> [105.718375, 21.285894])
 *    nối trực tiếp vào Đường Nguyễn Văn Linh (way/157991278) là "Ngõ 29 Nguyễn Văn Linh".
 */
export const DEFAULT_SEED_ROAD_OVERRIDES: Record<string, RoadOverridePatch> = {
  xh_road_ngo_29_nguyen_van_linh: {
    roadId: 'xh_road_ngo_29_nguyen_van_linh',
    name: '',
    rejectedName: 'Ngõ 29 Nguyễn Văn Linh',
    roadClass: 'local',
    roadType: 'local_road',
    parentRoadId: 'way/157991278',
    parentRoad: 'Đường Nguyễn Văn Linh',
    source: 'inferred',
    nameSource: 'inferred',
    geometrySource: 'google_maps',
    verified: false,
    confidence: 0,
    verificationStatus: 'rejected',
    locked: true,
    verifiedBy: 'local_resident_feedback',
    verifiedAt: '2026-11-02T10:15:00.000Z',
    note: 'Đoạn đường phía Nam bị heuristic bounding-box gắn nhầm tên Ngõ 29 Nguyễn Văn Linh. Đã gỡ tên và khóa chống tự khôi phục.',
  },
  'gmaps/way_3114': {
    roadId: 'gmaps/way_3114',
    name: '',
    rejectedName: 'Ngõ 29 Nguyễn Văn Linh',
    roadClass: 'local',
    roadType: 'local_road',
    parentRoadId: 'way/157991278',
    parentRoad: 'Đường Nguyễn Văn Linh',
    source: 'inferred',
    nameSource: 'inferred',
    geometrySource: 'google_maps',
    verified: false,
    confidence: 0,
    verificationStatus: 'rejected',
    locked: true,
    verifiedBy: 'local_resident_feedback',
    verifiedAt: '2026-11-02T10:15:00.000Z',
  },
  'gmaps/way_3112': {
    roadId: 'gmaps/way_3112',
    name: '',
    rejectedName: 'Ngõ 29 Nguyễn Văn Linh',
    roadClass: 'local',
    roadType: 'local_road',
    parentRoadId: 'way/157991278',
    parentRoad: 'Đường Nguyễn Văn Linh',
    source: 'inferred',
    nameSource: 'inferred',
    geometrySource: 'google_maps',
    verified: false,
    confidence: 0,
    verificationStatus: 'rejected',
    locked: true,
    verifiedBy: 'local_resident_feedback',
    verifiedAt: '2026-11-02T10:15:00.000Z',
  },
  'way/176151686': {
    roadId: 'way/176151686',
    name: 'Ngõ 29 Nguyễn Văn Linh',
    roadClass: 'alley',
    roadType: 'alley',
    parentRoadId: 'way/157991278',
    parentRoad: 'Đường Nguyễn Văn Linh',
    geometry: [
      [105.717687, 21.285617],
      [105.7178, 21.285691],
      [105.718035, 21.285774],
      [105.718375, 21.285894],
    ],
    source: 'local_verified',
    nameSource: 'local_verified',
    geometrySource: 'osm',
    verified: true,
    confidence: 1.0,
    verificationStatus: 'verified',
    locked: true,
    verifiedBy: 'local_resident_feedback',
    verifiedAt: '2026-11-02T10:15:00.000Z',
    note: 'Đã xác minh thực địa Ngõ 29 Nguyễn Văn Linh nằm tại nhánh phía Bắc (way/176151686) nối trực tiếp vào Đường Nguyễn Văn Linh đối diện Phố Cù Chính Lan.',
  },
};

const M_PER_DEG_LAT = 110720;
const M_PER_DEG_LNG = 103480;

export function distMetersLngLat(a: [number, number], b: [number, number]): number {
  const dx = (a[0] - b[0]) * M_PER_DEG_LNG;
  const dy = (a[1] - b[1]) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

export function computePolylineLengthMeters(coords: [number, number][]): number {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += distMetersLngLat(coords[i - 1], coords[i]);
  }
  return total;
}

export function computePolylineCenter(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [105.718, 21.2857];
  if (coords.length === 1) return coords[0];
  const totalLen = computePolylineLengthMeters(coords);
  if (totalLen <= 0.01) return coords[Math.floor(coords.length / 2)];
  const half = totalLen / 2;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = distMetersLngLat(coords[i - 1], coords[i]);
    if (acc + seg >= half && seg > 0) {
      const t = (half - acc) / seg;
      return [
        Number((coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t).toFixed(6)),
        Number((coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t).toFixed(6)),
      ];
    }
    acc += seg;
  }
  return coords[Math.floor(coords.length / 2)];
}

export function normalizeRoadHierarchyClass(params: {
  explicitRoadClass?: string;
  roadType?: string;
  highway?: string;
  tier?: string;
  name?: string;
}): RoadHierarchyClass {
  const { explicitRoadClass, roadType, highway = '', tier = '', name = '' } = params;
  const n = (name || '').trim();
  if (
    explicitRoadClass === 'major' ||
    explicitRoadClass === 'arterial' ||
    explicitRoadClass === 'local' ||
    explicitRoadClass === 'alley' ||
    explicitRoadClass === 'access'
  ) {
    return explicitRoadClass;
  }
  if (explicitRoadClass === 'secondary') return 'arterial';
  if (/^(Ngõ|Ngách|Hẻm)\s+/i.test(n) || roadType === 'alley' || roadType === 'lane' || tier === 'alley') {
    return 'alley';
  }
  if (
    roadType === 'road' ||
    tier === 'major' ||
    highway === 'motorway' ||
    highway === 'trunk' ||
    highway === 'primary' ||
    highway === 'secondary'
  ) {
    return 'major';
  }
  if (tier === 'secondary' || highway === 'tertiary') {
    return 'arterial';
  }
  if (
    roadType === 'path' ||
    roadType === 'service_road' ||
    roadType === 'access_road' ||
    tier === 'access' ||
    highway === 'service' ||
    highway === 'track' ||
    highway === 'path' ||
    highway === 'footway' ||
    highway === 'cycleway' ||
    highway === 'steps'
  ) {
    return 'access';
  }
  return 'local';
}

export function inferRoadTypeFromProps(
  name: string,
  highway: string,
  roadClass?: string,
  explicitRoadType?: string
): RoadType {
  if (
    explicitRoadType === 'road' ||
    explicitRoadType === 'street' ||
    explicitRoadType === 'local_road' ||
    explicitRoadType === 'alley' ||
    explicitRoadType === 'lane' ||
    explicitRoadType === 'path' ||
    explicitRoadType === 'service_road' ||
    explicitRoadType === 'access_road'
  ) {
    return explicitRoadType;
  }
  const n = (name || '').trim().toLowerCase();
  if (/^(ngách|hẻm)\b/i.test(n)) return 'lane';
  if (/^ngõ\b/i.test(n) || roadClass === 'alley') return 'alley';
  if (roadClass === 'major' || highway === 'primary' || highway === 'secondary' || highway === 'trunk' || highway === 'motorway') {
    return 'road';
  }
  if (roadClass === 'arterial' || roadClass === 'secondary' || highway === 'tertiary') {
    return 'street';
  }
  if (/^(phố|đường)\b/i.test(n)) {
    return 'street';
  }
  if (highway === 'footway' || highway === 'path' || highway === 'pedestrian' || highway === 'steps' || highway === 'cycleway') {
    return 'path';
  }
  if (highway === 'track') {
    return 'access_road';
  }
  if (highway === 'service' || roadClass === 'access') {
    return 'service_road';
  }
  // Mục 3: Nếu chưa chắc là Ngõ hay Đường nhánh -> giữ trung tính local_road, tuyệt đối không ép thành alley!
  return 'local_road';
}

export function mapRoadTypeToRoadClass(
  roadType: RoadType,
  fallbackClass?: string
): RoadHierarchyClass {
  if (
    fallbackClass === 'major' ||
    fallbackClass === 'arterial' ||
    fallbackClass === 'local' ||
    fallbackClass === 'alley' ||
    fallbackClass === 'access'
  ) {
    if (roadType === 'alley' || roadType === 'lane') return 'alley';
    if (roadType === 'road') return 'major';
    if (roadType === 'path' || roadType === 'service_road' || roadType === 'access_road') return 'access';
    if (roadType === 'local_road') return 'local';
    return fallbackClass;
  }
  if (roadType === 'road') return 'major';
  if (roadType === 'street') return fallbackClass === 'secondary' ? 'arterial' : 'arterial';
  if (roadType === 'local_road') return 'local';
  if (roadType === 'alley' || roadType === 'lane') return 'alley';
  return 'access';
}

export function mapRoadClassToDefaultRoadType(roadClass: RoadHierarchyClass, currentName = ''): RoadType {
  if (roadClass === 'major') return 'road';
  if (roadClass === 'arterial') return 'street';
  if (roadClass === 'local') return /^(Phố|Đường)\b/i.test(currentName.trim()) ? 'street' : 'local_road';
  if (roadClass === 'alley') return /^Ngách\b/i.test(currentName.trim()) ? 'lane' : 'alley';
  return 'access_road';
}

/**
 * Rút trích tên đường chính từ tên Ngõ/Ngách nếu Admin nhập dạng "Ngõ 29 Nguyễn Văn Linh"
 * (Đây là phân tích cú pháp chuỗi từ tên chính thức do Admin nhập, KHÔNG phải đoán theo tọa độ).
 */
export function parseParentRoadFromAlleyName(name: string): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?:Ngách\s+[0-9A-Za-z/-]+\s+)?Ngõ\s+[0-9A-Za-z/-]+\s+(.+)$/i);
  if (!match) return null;
  const parentRaw = match[1].trim();
  if (!parentRaw) return null;
  if (/^(Đường|Phố)\b/i.test(parentRaw)) return parentRaw;
  return `Đường ${parentRaw}`;
}

/**
 * Rút gọn tên ngõ theo mức zoom (Section 11 & 12):
 * - Zoom xa: ẩn hoàn toàn tên ngõ
 * - Zoom gần vừa + đoạn rất ngắn: hiển thị dạng ngắn "Ngõ 29"
 * - Zoom gần: hiển thị đầy đủ "Ngõ 29 Nguyễn Văn Linh"
 */
export function getShortAlleyLabel(fullName: string): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return '';
  const laneMatch = trimmed.match(/^(Ngách\s+[0-9A-Za-z/-]+(?:\s+Ngõ\s+[0-9A-Za-z/-]+)?)/i);
  if (laneMatch) return laneMatch[1].trim();
  const alleyMatch = trimmed.match(/^(Ngõ\s+[0-9A-Za-z/-]+)/i);
  if (alleyMatch) return alleyMatch[1].trim();
  return trimmed;
}

export function formatRoadLabelForZoom(params: {
  name: string;
  roadClass?: RoadHierarchyClass | string;
  roadType: RoadType;
  verificationStatus: RoadVerificationStatus;
  nameSource: RoadNameSource;
  segmentLengthM: number;
  zoom?: number;
  cameraDistM?: number;
  isSelectedOrHighlighted?: boolean;
}): string {
  const {
    name,
    roadClass,
    roadType,
    verificationStatus,
    nameSource,
    segmentLengthM,
    zoom = 16.5,
    cameraDistM,
    isSelectedOrHighlighted = false,
  } = params;

  const trimmed = (name || '').trim();
  if (!trimmed) return '';

  // Mục 5 & 14: Không có tên xác thực thì KHÔNG hiện label. Inferred không bao giờ hiện như dữ liệu chính thức.
  if (
    verificationStatus === 'rejected' ||
    verificationStatus === 'needs_review' ||
    verificationStatus === 'unverified' ||
    nameSource === 'inferred'
  ) {
    return '';
  }

  const isAlleyLike =
    roadClass === 'alley' ||
    roadClass === 'access' ||
    roadType === 'alley' ||
    roadType === 'lane' ||
    roadType === 'path' ||
    roadType === 'service_road' ||
    roadType === 'access_road' ||
    /^(ngõ|ngách|hẻm)\b/i.test(trimmed);

  if (isSelectedOrHighlighted) {
    return trimmed;
  }

  // Chế độ 3D dùng khoảng cách camera (mét)
  if (typeof cameraDistM === 'number') {
    if (isAlleyLike) {
      if (segmentLengthM < 18 && cameraDistM > 220) return '';
      if (cameraDistM > 560) return '';
      if (cameraDistM > 360 && segmentLengthM < 45) return getShortAlleyLabel(trimmed);
      return trimmed;
    }
    if (roadClass === 'local' && cameraDistM > 950) return '';
    if (roadClass === 'arterial' && cameraDistM > 1800) return '';
    if (segmentLengthM < 25 && cameraDistM > 450) return '';
    return trimmed;
  }

  // Chế độ 2D dùng mức zoom MapLibre (Mục 11 — LABEL LOD)
  if (isAlleyLike) {
    if (zoom < 15.2) return '';
    if (segmentLengthM < 20 && zoom < 16.8) return '';
    if (zoom < 15.8 && segmentLengthM < 45) return getShortAlleyLabel(trimmed);
    return trimmed;
  }

  if (roadClass === 'local' && zoom < 14.2) return '';
  if ((roadClass === 'arterial' || roadClass === 'secondary') && zoom < 13.2) return '';
  if (segmentLengthM < 25 && zoom < 15.8) return '';
  return trimmed;
}

/**
 * Đọc toàn bộ bản ghi override từ localStorage (kết hợp với DEFAULT_SEED_ROAD_OVERRIDES).
 */
export function loadRoadOverridesMap(): Record<string, RoadOverridePatch> {
  const merged: Record<string, RoadOverridePatch> = {
    ...DEFAULT_SEED_ROAD_OVERRIDES,
  };
  if (typeof window === 'undefined') return merged;

  try {
    const raw = window.localStorage.getItem(ROAD_OVERRIDES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, RoadOverridePatch>;
      if (parsed && typeof parsed === 'object') {
        for (const [roadId, patch] of Object.entries(parsed)) {
          if (!patch || typeof patch !== 'object') continue;
          merged[roadId] = {
            ...(merged[roadId] || {}),
            ...patch,
            roadId,
          };
        }
      }
    }
  } catch {
    // Ignore storage read error
  }

  return merged;
}

export function saveRoadOverridesMap(
  map: Record<string, RoadOverridePatch>,
  changedRoadIds?: string[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ROAD_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent(ROAD_OVERRIDES_UPDATED_EVENT, {
        detail: {
          changedRoadIds: changedRoadIds || Object.keys(map),
          timestamp: Date.now(),
        },
      })
    );
  } catch {
    // Ignore storage write error
  }
}

/**
 * Lưu hoặc cập nhật một bản ghi override cho roadId cụ thể.
 * Khi Admin lưu:
 * - nameSource = "local_verified"
 * - verificationStatus = "verified" (trừ khi Admin chủ động chọn "needs_review" / "rejected" / "unverified")
 */
export function saveAdminRoadOverride(
  roadId: string,
  patch: Partial<RoadOverridePatch>,
  verifiedBy = 'admin'
): RoadOverridePatch {
  const all = loadRoadOverridesMap();
  const prev = all[roadId] || { roadId };
  const nextStatus: RoadVerificationStatus =
    patch.verificationStatus ?? prev.verificationStatus ?? 'verified';
  const nextName = patch.name !== undefined ? patch.name.trim() : prev.name ?? '';
  const nextRoadClass: RoadHierarchyClass =
    patch.roadClass ??
    prev.roadClass ??
    normalizeRoadHierarchyClass({
      roadType: patch.roadType || prev.roadType,
      name: nextName,
    });
  const nextRoadType: RoadType =
    patch.roadType ??
    prev.roadType ??
    mapRoadClassToDefaultRoadType(nextRoadClass, nextName);
  const nextParentRoad =
    patch.parentRoad !== undefined
      ? patch.parentRoad
      : prev.parentRoad ?? parseParentRoadFromAlleyName(nextName);
  const nextNameSource: RoadNameSource = patch.nameSource ?? patch.source ?? 'local_verified';
  const nextVerified =
    patch.verified !== undefined
      ? patch.verified
      : nextStatus === 'verified' && nextNameSource !== 'inferred';

  const updated: RoadOverridePatch = {
    ...prev,
    ...patch,
    roadId,
    name: nextName,
    roadClass: nextRoadClass,
    roadType: nextRoadType,
    parentRoad: nextParentRoad || null,
    source: nextNameSource,
    nameSource: nextNameSource,
    geometrySource:
      patch.geometry !== undefined
        ? patch.geometrySource ?? 'local_verified'
        : prev.geometrySource ?? 'osm',
    verified: nextVerified,
    confidence: nextStatus === 'verified' ? 1.0 : patch.confidence ?? prev.confidence ?? 0.5,
    verificationStatus: nextStatus,
    locked: patch.locked !== undefined ? patch.locked : prev.locked ?? nextStatus === 'verified',
    verifiedBy: nextStatus === 'verified' ? verifiedBy : patch.verifiedBy ?? prev.verifiedBy ?? null,
    verifiedAt:
      nextStatus === 'verified'
        ? new Date().toISOString()
        : patch.verifiedAt ?? prev.verifiedAt ?? null,
  };

  all[roadId] = updated;

  if (
    nextStatus === 'verified' &&
    nextName.toLowerCase() === 'ngõ 29 nguyễn văn linh' &&
    roadId !== 'pending_review_ngo_29_nguyen_van_linh'
  ) {
    all.pending_review_ngo_29_nguyen_van_linh = {
      ...(all.pending_review_ngo_29_nguyen_van_linh || {
        roadId: 'pending_review_ngo_29_nguyen_van_linh',
      }),
      deleted: true,
      verificationStatus: 'verified',
      candidateRoadId: roadId,
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    };
  }

  saveRoadOverridesMap(all, [roadId]);
  return updated;
}

/**
 * Các hàm chỉnh sửa trực tiếp các node (đỉnh) của đoạn đường trên bản đồ (Mục 21 — Direct Geometry Edit):
 * - moveRoadVertex: kéo trực tiếp một node sang tọa độ mới
 * - insertRoadVertexAtSegmentMidpoint: chèn thêm 1 node vào trung điểm của cạnh
 * - deleteRoadVertex: xóa 1 node (giữ tối thiểu 2 node đầu/cuối)
 */
export function moveRoadVertex(
  geometry: [number, number][],
  vertexIndex: number,
  newLngLat: [number, number]
): [number, number][] {
  if (!geometry || geometry.length < 2) return geometry || [];
  return geometry.map((pt, idx) =>
    idx === vertexIndex
      ? [Number(newLngLat[0].toFixed(6)), Number(newLngLat[1].toFixed(6))]
      : [pt[0], pt[1]]
  );
}

export function insertRoadVertexAtSegmentMidpoint(
  geometry: [number, number][],
  segmentStartIndex: number
): [number, number][] {
  if (!geometry || geometry.length < 2) return geometry || [];
  const idx = Math.max(0, Math.min(geometry.length - 2, segmentStartIndex));
  const a = geometry[idx];
  const b = geometry[idx + 1];
  const mid: [number, number] = [
    Number(((a[0] + b[0]) * 0.5).toFixed(6)),
    Number(((a[1] + b[1]) * 0.5).toFixed(6)),
  ];
  return [...geometry.slice(0, idx + 1), mid, ...geometry.slice(idx + 1)];
}

export function deleteRoadVertex(
  geometry: [number, number][],
  vertexIndex: number
): [number, number][] {
  if (!geometry || geometry.length <= 2) return geometry || [];
  if (vertexIndex < 0 || vertexIndex >= geometry.length) return geometry;
  return geometry.filter((_, idx) => idx !== vertexIndex);
}

/**
 * Bảo vệ dữ liệu local_verified và locked=true trước mọi đợt đồng bộ từ OSM/Google bên ngoài (Sections 3, 4, 20).
 */
export function mergeExternalRoadWithLocalProtection(
  existingRecord: RoadRecord,
  incomingExternal: Partial<RoadRecord>
): RoadRecord {
  // Nếu đã locked hoặc là local_verified + verified -> tuyệt đối không cho nguồn ngoài ghi đè tên/hình học
  if (
    existingRecord.locked ||
    (existingRecord.nameSource === 'local_verified' &&
      existingRecord.verificationStatus === 'verified') ||
    existingRecord.verificationStatus === 'rejected'
  ) {
    return existingRecord;
  }

  const incomingSource = incomingExternal.nameSource || 'osm';
  // Không bao giờ cho phép nguồn inferred tự gắn tên ngõ
  if (incomingSource === 'inferred') {
    return existingRecord;
  }

  const existingPrio = ROAD_NAME_SOURCE_PRIORITY[existingRecord.nameSource] ?? 99;
  const incomingPrio = ROAD_NAME_SOURCE_PRIORITY[incomingSource] ?? 99;

  if (incomingPrio > existingPrio && existingRecord.name) {
    return existingRecord;
  }

  return {
    ...existingRecord,
    ...incomingExternal,
    roadId: existingRecord.roadId,
  };
}

/**
 * Snap hình học điểm đầu/cuối của ngõ mới vẽ vào đường chính (Section 9):
 * CHỈ snap tọa độ hình học, tuyệt đối KHÔNG tự suy diễn tên ngõ từ kết quả snap.
 */
export function snapAlleyGeometryToParentRoad(
  alleyPoints: [number, number][],
  parentRoadGeometries: { roadId: string; name: string; geometry: [number, number][] }[],
  maxSnapMeters = 18
): {
  snappedGeometry: [number, number][];
  snappedParentRoadId: string | null;
  snappedParentRoadName: string | null;
  snapDistanceMeters: number | null;
} {
  if (!alleyPoints || alleyPoints.length < 2) {
    return {
      snappedGeometry: alleyPoints || [],
      snappedParentRoadId: null,
      snappedParentRoadName: null,
      snapDistanceMeters: null,
    };
  }

  const copy: [number, number][] = alleyPoints.map((pt) => [pt[0], pt[1]]);
  let bestEndpointIdx: 0 | number = 0;
  let bestProjectedPt: [number, number] | null = null;
  let bestDist = Infinity;
  let bestRoadId: string | null = null;
  let bestRoadName: string | null = null;

  const endpoints: [number, [number, number]][] = [
    [0, copy[0]],
    [copy.length - 1, copy[copy.length - 1]],
  ];

  for (const [epIdx, ep] of endpoints) {
    for (const parent of parentRoadGeometries) {
      const coords = parent.geometry;
      if (!coords || coords.length < 2) continue;
      for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1];
        const b = coords[i];
        const vx = (b[0] - a[0]) * M_PER_DEG_LNG;
        const vy = (b[1] - a[1]) * M_PER_DEG_LAT;
        const wx = (ep[0] - a[0]) * M_PER_DEG_LNG;
        const wy = (ep[1] - a[1]) * M_PER_DEG_LAT;
        const len2 = vx * vx + vy * vy;
        const t = len2 > 1e-6 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
        const projLng = Number((a[0] + (b[0] - a[0]) * t).toFixed(6));
        const projLat = Number((a[1] + (b[1] - a[1]) * t).toFixed(6));
        const d = distMetersLngLat(ep, [projLng, projLat]);
        if (d < bestDist) {
          bestDist = d;
          bestEndpointIdx = epIdx;
          bestProjectedPt = [projLng, projLat];
          bestRoadId = parent.roadId;
          bestRoadName = parent.name;
        }
      }
    }
  }

  if (bestProjectedPt && bestDist <= maxSnapMeters) {
    copy[bestEndpointIdx] = bestProjectedPt;
    return {
      snappedGeometry: copy,
      snappedParentRoadId: bestRoadId,
      snappedParentRoadName: bestRoadName,
      snapDistanceMeters: Number(bestDist.toFixed(2)),
    };
  }

  return {
    snappedGeometry: copy,
    snappedParentRoadId: null,
    snappedParentRoadName: null,
    snapDistanceMeters: null,
  };
}

/**
 * Tạo mới hoặc vẽ lại (Redraw) một ngõ/đường do Admin thực hiện trực tiếp trên bản đồ (Sections 8 & 9).
 */
export function createOrRedrawAdminRoad(params: {
  roadId?: string;
  name: string;
  roadType: RoadType;
  parentRoad?: string | null;
  parentRoadId?: string | null;
  geometry: [number, number][];
  locked?: boolean;
  verifiedBy?: string;
}): RoadOverridePatch {
  const targetRoadId =
    params.roadId && params.roadId.trim()
      ? params.roadId.trim()
      : `xh_admin_road_${Date.now()}`;
  const cleanName = params.name.trim();
  const inferredParent = params.parentRoad?.trim() || parseParentRoadFromAlleyName(cleanName);

  return saveAdminRoadOverride(
    targetRoadId,
    {
      roadId: targetRoadId,
      name: cleanName,
      roadType: params.roadType,
      parentRoad: inferredParent || null,
      parentRoadId: params.parentRoadId || null,
      geometry: params.geometry,
      nameSource: 'local_verified',
      geometrySource: 'local_verified',
      confidence: 1.0,
      verificationStatus: 'verified',
      locked: params.locked ?? true,
      isCustomRoad: !params.roadId,
    },
    params.verifiedBy || 'admin'
  );
}

/**
 * Tách một đoạn đường (Split segment) tại đỉnh ở giữa hoặc vị trí gần điểm chọn (Section 7).
 */
export function splitAdminRoadSegment(
  record: RoadRecord,
  splitVertexIndex?: number
): { firstSegment: RoadOverridePatch; secondSegment: RoadOverridePatch } | null {
  const coords = record.geometry;
  if (!coords || coords.length < 2) return null;

  let workingCoords = coords.map((pt) => [pt[0], pt[1]] as [number, number]);
  if (workingCoords.length === 2) {
    const mid: [number, number] = [
      Number(((workingCoords[0][0] + workingCoords[1][0]) / 2).toFixed(6)),
      Number(((workingCoords[0][1] + workingCoords[1][1]) / 2).toFixed(6)),
    ];
    workingCoords = [workingCoords[0], mid, workingCoords[1]];
  }

  const idx =
    typeof splitVertexIndex === 'number' &&
    splitVertexIndex > 0 &&
    splitVertexIndex < workingCoords.length - 1
      ? splitVertexIndex
      : Math.floor(workingCoords.length / 2);

  const coordsA = workingCoords.slice(0, idx + 1);
  const coordsB = workingCoords.slice(idx);

  const firstSegment = saveAdminRoadOverride(record.roadId, {
    name: record.name,
    roadType: record.roadType,
    parentRoad: record.parentRoad,
    parentRoadId: record.parentRoadId,
    geometry: coordsA,
    verificationStatus: record.verificationStatus,
    locked: record.locked,
  });

  const secondRoadId = `${record.roadId}_part2_${Date.now().toString().slice(-4)}`;
  const secondSegment = saveAdminRoadOverride(secondRoadId, {
    roadId: secondRoadId,
    name: record.name,
    roadType: record.roadType,
    parentRoad: record.parentRoad,
    parentRoadId: record.parentRoadId,
    geometry: coordsB,
    verificationStatus: record.verificationStatus,
    locked: record.locked,
    isCustomRoad: true,
  });

  return { firstSegment, secondSegment };
}

/**
 * Nối hai đoạn đường liền kề thành một đoạn thống nhất (Merge segments — Section 7).
 */
export function mergeAdminRoadSegments(
  primaryRecord: RoadRecord,
  secondaryRecord: RoadRecord
): RoadOverridePatch | null {
  const a = primaryRecord.geometry;
  const b = secondaryRecord.geometry;
  if (!a || a.length < 2 || !b || b.length < 2) return null;

  const dEndStart = distMetersLngLat(a[a.length - 1], b[0]);
  const dEndEnd = distMetersLngLat(a[a.length - 1], b[b.length - 1]);
  const dStartStart = distMetersLngLat(a[0], b[0]);
  const dStartEnd = distMetersLngLat(a[0], b[b.length - 1]);

  const minD = Math.min(dEndStart, dEndEnd, dStartStart, dStartEnd);
  let mergedCoords: [number, number][] = [];

  if (minD === dEndStart) {
    mergedCoords = [...a, ...(dEndStart < 1.5 ? b.slice(1) : b)];
  } else if (minD === dEndEnd) {
    const revB = [...b].reverse();
    mergedCoords = [...a, ...(dEndEnd < 1.5 ? revB.slice(1) : revB)];
  } else if (minD === dStartEnd) {
    mergedCoords = [...b, ...(dStartEnd < 1.5 ? a.slice(1) : a)];
  } else {
    const revA = [...a].reverse();
    mergedCoords = [...revA, ...(dStartStart < 1.5 ? b.slice(1) : b)];
  }

  const all = loadRoadOverridesMap();
  all[secondaryRecord.roadId] = {
    ...(all[secondaryRecord.roadId] || { roadId: secondaryRecord.roadId }),
    deleted: true,
  };
  saveRoadOverridesMap(all, [primaryRecord.roadId, secondaryRecord.roadId]);

  return saveAdminRoadOverride(primaryRecord.roadId, {
    name: primaryRecord.name || secondaryRecord.name,
    roadType: primaryRecord.roadType,
    parentRoad: primaryRecord.parentRoad || secondaryRecord.parentRoad,
    parentRoadId: primaryRecord.parentRoadId || secondaryRecord.parentRoadId,
    geometry: mergedCoords,
    verificationStatus: 'verified',
    locked: true,
  });
}

/**
 * Áp dụng toàn bộ overrides vào GeoJSON features của `xuanhoa-roads.geojson`
 * để cả 2D (MapLibre) và 3D (Three.js Worker) dùng chung đúng một nguồn `roadId + roadClass + geometry + name`.
 */
export function applyRoadOverridesToGeoJSONFeatures(rawFeatures: any[]): {
  features: any[];
  recordsById: Map<string, RoadRecord>;
} {
  const overrides = loadRoadOverridesMap();
  const recordsById = new Map<string, RoadRecord>();
  const outFeatures: any[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < (rawFeatures || []).length; i++) {
    const f = rawFeatures[i];
    if (!f || f.geometry?.type !== 'LineString' || !Array.isArray(f.geometry.coordinates)) {
      continue;
    }

    const props = f.properties || {};
    const roadId = String(props.roadId || props.id || props.osmId || `xh_road_${i}`);
    const ov = overrides[roadId];

    if (ov?.deleted) {
      seenIds.add(roadId);
      continue;
    }

    const rawCoords: [number, number][] = (ov?.geometry || f.geometry.coordinates).map(
      (pt: number[]) => [Number(pt[0]), Number(pt[1])] as [number, number]
    );
    if (rawCoords.length < 2) continue;

    let name = ov?.name !== undefined ? ov.name : String(props.name || '').trim();
    let verificationStatus: RoadVerificationStatus =
      ov?.verificationStatus ||
      (props.verificationStatus as RoadVerificationStatus) ||
      (name ? 'verified' : 'unverified');
    let nameSource: RoadNameSource =
      ov?.nameSource ||
      ov?.source ||
      (props.nameSource as RoadNameSource) ||
      (props.source === 'local_verified'
        ? 'local_verified'
        : name
          ? 'osm'
          : 'unverified');

    // Chặn tuyệt đối trường hợp Ngõ 29 Nguyễn Văn Linh tự động xuất hiện lại trên đoạn đường sai phía Nam (Mục 27)
    if (
      roadId === 'xh_road_ngo_29_nguyen_van_linh' ||
      roadId === 'gmaps/way_3114' ||
      roadId === 'gmaps/way_3112'
    ) {
      if (!ov || ov.verificationStatus === 'rejected') {
        name = '';
        verificationStatus = 'rejected';
        nameSource = 'inferred';
      }
    }

    // Nguyên tắc 3 & 14: inferred không bao giờ được tự động hiển thị như dữ liệu chính thức
    if (nameSource === 'inferred' && verificationStatus === 'verified') {
      verificationStatus = 'needs_review';
    }

    const highway = String(props.highway || 'residential');
    const roadClass = normalizeRoadHierarchyClass({
      explicitRoadClass: ov?.roadClass || props.roadClass,
      roadType: ov?.roadType || props.roadType,
      highway,
      tier: props.tier,
      name,
    });
    const roadType =
      ov?.roadType ||
      inferRoadTypeFromProps(name, highway, roadClass, props.roadType);
    const parentRoad =
      ov?.parentRoad !== undefined
        ? ov.parentRoad
        : props.parentRoad || parseParentRoadFromAlleyName(name) || null;
    const parentRoadId =
      ov?.parentRoadId !== undefined ? ov.parentRoadId : props.parentRoadId || null;
    const geometrySource: RoadGeometrySource =
      ov?.geometrySource ||
      (props.geometrySource as RoadGeometrySource) ||
      (props.source === 'google_maps_labeled' ? 'google_maps' : 'osm');
    const locked = Boolean(ov?.locked ?? props.locked ?? nameSource === 'local_verified');
    const verified = verificationStatus === 'verified' && nameSource !== 'inferred';
    const confidence =
      typeof ov?.confidence === 'number'
        ? ov.confidence
        : typeof props.confidence === 'number'
          ? props.confidence
          : verified
            ? 1.0
            : 0.5;
    const segLenM = computePolylineLengthMeters(rawCoords);

    // Tên hiển thị trên bản đồ công khai: chỉ hiện khi verified === true (Mục 5 & 13)
    const publicDisplayName = verified ? name : '';
    const shortDisplayName = publicDisplayName ? getShortAlleyLabel(publicDisplayName) : '';
    const tier =
      roadClass === 'major'
        ? 'major'
        : roadClass === 'arterial'
          ? 'secondary'
          : roadClass === 'local'
            ? 'minor'
            : roadClass === 'alley'
              ? 'alley'
              : 'access';

    const record: RoadRecord = {
      roadId,
      name,
      roadClass,
      roadType,
      parentRoadId,
      parentRoad,
      geometry: rawCoords,
      source: nameSource,
      nameSource,
      geometrySource,
      verified,
      confidence,
      verificationStatus,
      locked,
      verifiedBy: ov?.verifiedBy ?? props.verifiedBy ?? null,
      verifiedAt: ov?.verifiedAt ?? props.verifiedAt ?? null,
      rejectedName: ov?.rejectedName ?? props.rejectedName ?? null,
      candidateRoadId: ov?.candidateRoadId ?? null,
      note: ov?.note ?? null,
      widthM: ov?.widthM ?? props.width ?? props.widthM,
    };

    recordsById.set(roadId, record);
    seenIds.add(roadId);

    outFeatures.push({
      type: 'Feature',
      properties: {
        ...props,
        id: roadId,
        roadId,
        osmId: roadId,
        name: publicDisplayName,
        rawName: name,
        shortName: shortDisplayName,
        roadClass,
        roadType,
        tier,
        parentRoad: parentRoad || '',
        parentRoadId: parentRoadId || '',
        source: nameSource,
        nameSource,
        geometrySource,
        verified,
        confidence,
        verificationStatus,
        locked,
        verifiedBy: record.verifiedBy || '',
        verifiedAt: record.verifiedAt || '',
        rejectedName: record.rejectedName || '',
        lengthM: Number(segLenM.toFixed(1)),
      },
      geometry: {
        type: 'LineString',
        coordinates: rawCoords,
      },
    });
  }

  // Thêm các đoạn đường/ngõ do Admin vẽ mới (isCustomRoad) chưa có trong file GeoJSON gốc
  for (const [roadId, ov] of Object.entries(overrides)) {
    if (seenIds.has(roadId) || ov.deleted) continue;
    if (roadId === 'pending_review_ngo_29_nguyen_van_linh') continue;
    if (!ov.geometry || ov.geometry.length < 2) continue;

    const name = (ov.name || '').trim();
    const roadType: RoadType = ov.roadType || 'alley';
    const roadClass: RoadHierarchyClass =
      ov.roadClass || mapRoadTypeToRoadClass(roadType, 'alley');
    const verificationStatus: RoadVerificationStatus = ov.verificationStatus || 'verified';
    const nameSource: RoadNameSource = ov.nameSource || ov.source || 'local_verified';
    const geometrySource: RoadGeometrySource = ov.geometrySource || 'local_verified';
    const parentRoad = ov.parentRoad || parseParentRoadFromAlleyName(name) || null;
    const parentRoadId = ov.parentRoadId || null;
    const locked = Boolean(ov.locked ?? true);
    const verified = verificationStatus === 'verified' && nameSource !== 'inferred';
    const segLenM = computePolylineLengthMeters(ov.geometry);
    const publicDisplayName = verified ? name : '';
    const shortDisplayName = publicDisplayName ? getShortAlleyLabel(publicDisplayName) : '';
    const tier =
      roadClass === 'major'
        ? 'major'
        : roadClass === 'arterial'
          ? 'secondary'
          : roadClass === 'local'
            ? 'minor'
            : roadClass === 'alley'
              ? 'alley'
              : 'access';

    const record: RoadRecord = {
      roadId,
      name,
      roadClass,
      roadType,
      parentRoadId,
      parentRoad,
      geometry: ov.geometry,
      source: nameSource,
      nameSource,
      geometrySource,
      verified,
      confidence: ov.confidence ?? 1.0,
      verificationStatus,
      locked,
      verifiedBy: ov.verifiedBy ?? 'admin',
      verifiedAt: ov.verifiedAt ?? null,
      candidateRoadId: ov.candidateRoadId ?? null,
      note: ov.note ?? null,
      widthM: ov.widthM ?? 4,
    };

    recordsById.set(roadId, record);

    outFeatures.push({
      type: 'Feature',
      properties: {
        id: roadId,
        roadId,
        osmId: roadId,
        name: publicDisplayName,
        rawName: name,
        shortName: shortDisplayName,
        highway: roadClass === 'major' ? 'secondary' : roadClass === 'arterial' ? 'tertiary' : roadClass === 'local' ? 'residential' : 'service',
        roadClass,
        roadType,
        tier,
        widthM: ov.widthM ?? 4,
        parentRoad: parentRoad || '',
        parentRoadId: parentRoadId || '',
        source: nameSource,
        nameSource,
        geometrySource,
        verified,
        confidence: record.confidence,
        verificationStatus,
        locked,
        verifiedBy: record.verifiedBy || '',
        verifiedAt: record.verifiedAt || '',
        lengthM: Number(segLenM.toFixed(1)),
      },
      geometry: {
        type: 'LineString',
        coordinates: ov.geometry,
      },
    });
  }

  return { features: outFeatures, recordsById };
}

/**
 * Hệ thống phát hiện Ngõ/Đường nghi ngờ đưa vào danh sách "Cần rà soát" cho Admin (Mục 19 — Road QA Panel):
 * Chỉ hiện các mục thực sự cần rà soát:
 * - Đường/ngõ đang ở trạng thái `needs_review`
 * - Tên ngõ không nối vào đường chính (`unconnected_to_parent`)
 * - Trùng tên ngõ ở khoảng cách xa nhau (`duplicate_distant_alley`)
 * - Ngõ có tên nhưng thiếu `parentRoad` (`missing_parent_road`)
 * - Đoạn từng bị gắn nhầm đã khóa (`rejected_wrong_association` — chỉ giữ 1 bản ghi đối chứng gọn gàng)
 */
export function auditAllRoadRecords(
  recordsById: Map<string, RoadRecord>
): RoadAuditIssue[] {
  const issues: RoadAuditIssue[] = [];
  const parentRoadsByName = new Map<string, RoadRecord[]>();
  const alleysByName = new Map<string, RoadRecord[]>();

  for (const rec of recordsById.values()) {
    if (rec.deleted) continue;

    if (rec.verificationStatus === 'needs_review') {
      issues.push({
        id: `issue_needs_review_${rec.roadId}`,
        roadId: rec.roadId,
        candidateRoadId: rec.candidateRoadId || rec.roadId,
        name: rec.name || '(Chưa đặt tên)',
        roadClass: rec.roadClass,
        roadType: rec.roadType,
        parentRoad: rec.parentRoad,
        issueType: 'pending_review_alley',
        severity: 'high',
        description:
          rec.note ||
          `Tuyến "${rec.name || rec.roadId}" đang ở trạng thái Cần rà soát chờ Admin xác minh.`,
        center: computePolylineCenter(rec.geometry),
        verificationStatus: 'needs_review',
      });
    }

    const cleanName = rec.name.trim();
    if (!cleanName) continue;

    if (rec.roadClass === 'major' || rec.roadClass === 'arterial' || rec.roadType === 'road' || rec.roadType === 'street') {
      const key = cleanName.toLowerCase();
      const arr = parentRoadsByName.get(key) || [];
      arr.push(rec);
      parentRoadsByName.set(key, arr);
    }

    if (rec.roadClass === 'alley' || rec.roadType === 'alley' || rec.roadType === 'lane') {
      const key = cleanName.toLowerCase();
      const arr = alleysByName.get(key) || [];
      arr.push(rec);
      alleysByName.set(key, arr);

      if (!rec.parentRoad) {
        issues.push({
          id: `issue_missing_parent_${rec.roadId}`,
          roadId: rec.roadId,
          name: cleanName,
          roadClass: rec.roadClass,
          roadType: rec.roadType,
          parentRoad: null,
          issueType: 'missing_parent_road',
          severity: 'medium',
          description: `Ngõ "${cleanName}" (${rec.roadId}) chưa được khai báo đường chính (parentRoad).`,
          center: computePolylineCenter(rec.geometry),
          verificationStatus: rec.verificationStatus,
        });
      }
    }
  }

  // Kiểm tra khoảng cách nối vào đường chính (sau khi đã gom đủ parentRoadsByName)
  for (const [, group] of alleysByName.entries()) {
    for (const rec of group) {
      if (!rec.parentRoad) continue;
      const pKey = rec.parentRoad.trim().toLowerCase();
      const pCandidates =
        parentRoadsByName.get(pKey) ||
        parentRoadsByName.get(`đường ${pKey}`) ||
        parentRoadsByName.get(`phố ${pKey}`) ||
        [];
      if (pCandidates.length > 0) {
        let minTouchDist = Infinity;
        for (const pt of [rec.geometry[0], rec.geometry[rec.geometry.length - 1]]) {
          for (const pRec of pCandidates) {
            for (const pPt of pRec.geometry) {
              const d = distMetersLngLat(pt, pPt);
              if (d < minTouchDist) minTouchDist = d;
            }
          }
        }
        const maxAllowed = rec.roadType === 'lane' ? 260 : 65;
        if (minTouchDist > maxAllowed) {
          issues.push({
            id: `issue_unconnected_${rec.roadId}`,
            roadId: rec.roadId,
            name: rec.name.trim(),
            roadClass: rec.roadClass,
            roadType: rec.roadType,
            parentRoad: rec.parentRoad,
            issueType: 'unconnected_to_parent',
            severity: 'high',
            description: `"${rec.name.trim()}" cách đường chính "${rec.parentRoad}" ${Math.round(minTouchDist)}m (không chạm/nối trực tiếp).`,
            center: computePolylineCenter(rec.geometry),
            verificationStatus: rec.verificationStatus,
          });
        }
      }
    }
  }

  // Kiểm tra trùng tên ngõ ở khoảng cách xa nhau (> 85m mà không nối nhau)
  for (const [, group] of alleysByName.entries()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        let minEndpointDist = Infinity;
        for (const pa of [a.geometry[0], a.geometry[a.geometry.length - 1]]) {
          for (const pb of [b.geometry[0], b.geometry[b.geometry.length - 1]]) {
            const d = distMetersLngLat(pa, pb);
            if (d < minEndpointDist) minEndpointDist = d;
          }
        }
        if (minEndpointDist > 85) {
          issues.push({
            id: `issue_dup_${a.roadId}_${b.roadId}`,
            roadId: a.roadId,
            name: a.name,
            roadClass: a.roadClass,
            roadType: a.roadType,
            parentRoad: a.parentRoad,
            issueType: 'duplicate_distant_alley',
            severity: 'high',
            description: `Trùng tên "${a.name}" trên 2 đoạn cách xa nhau ${Math.round(minEndpointDist)}m (${a.roadId} và ${b.roadId}).`,
            center: computePolylineCenter(a.geometry),
            verificationStatus: a.verificationStatus,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Tìm đoạn đường (RoadRecord) gần điểm click (lng, lat) nhất trên bản đồ 2D hoặc 3D
 * Chỉ phục vụ Admin chọn đoạn đường để kiểm tra / đổi tên / xác minh, KHÔNG BAO GIỜ tự động gắn tên.
 */
export function findNearestRoadAtLngLat(
  recordsById: Map<string, RoadRecord>,
  lng: number,
  lat: number,
  maxDistMeters = 24
): { record: RoadRecord; distanceMeters: number } | null {
  let bestRecord: RoadRecord | null = null;
  let bestDist = Infinity;

  for (const rec of recordsById.values()) {
    if (rec.deleted || !rec.geometry || rec.geometry.length < 2) continue;
    const coords = rec.geometry;
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1];
      const b = coords[i];
      const vx = (b[0] - a[0]) * M_PER_DEG_LNG;
      const vy = (b[1] - a[1]) * M_PER_DEG_LAT;
      const wx = (lng - a[0]) * M_PER_DEG_LNG;
      const wy = (lat - a[1]) * M_PER_DEG_LAT;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 1e-6 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
      const projLng = a[0] + (b[0] - a[0]) * t;
      const projLat = a[1] + (b[1] - a[1]) * t;
      const d = distMetersLngLat([lng, lat], [projLng, projLat]);
      if (d < bestDist) {
        bestDist = d;
        bestRecord = rec;
      }
    }
  }

  if (bestRecord && bestDist <= maxDistMeters) {
    return {
      record: bestRecord,
      distanceMeters: Number(bestDist.toFixed(2)),
    };
  }
  return null;
}

/**
 * Tạo danh sách RoadSearchResult thống nhất cho thanh Search
 */
export function buildUnifiedSearchableRoads(
  recordsById: Map<string, RoadRecord>,
  fallbackSeed: any[] = []
): any[] {
  const byKey = new Map<string, any>();

  for (const rec of recordsById.values()) {
    if (rec.deleted || !rec.name || !rec.name.trim()) continue;
    if (rec.verificationStatus === 'rejected' || rec.nameSource === 'inferred') continue;

    const cleanName = rec.name.trim();
    const key = `${cleanName.toLowerCase()}__${rec.verificationStatus}`;
    const center = computePolylineCenter(rec.geometry);
    const tier =
      rec.roadClass === 'major'
        ? 'major'
        : rec.roadClass === 'arterial'
          ? 'secondary'
          : rec.roadClass === 'alley'
            ? 'alley'
            : 'minor';

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        id: rec.roadId,
        roadId: rec.roadId,
        name: cleanName,
        highway: rec.roadClass === 'alley' ? 'service' : 'residential',
        tier,
        roadClass: rec.roadClass,
        roadType: rec.roadType,
        parentRoad: rec.parentRoad,
        parentRoadId: rec.parentRoadId,
        source: rec.source,
        nameSource: rec.nameSource,
        geometrySource: rec.geometrySource,
        verified: rec.verified,
        verificationStatus: rec.verificationStatus,
        locked: rec.locked,
        candidateRoadId: rec.candidateRoadId,
        geometry: rec.geometry,
        lat: center[1],
        lng: center[0],
        osmId: rec.roadId,
        segmentsCount: 1,
        insideWard: true,
      });
    } else {
      existing.segmentsCount += 1;
    }
  }

  for (const seed of fallbackSeed) {
    if (!seed || !seed.name) continue;
    const k = `${String(seed.name).trim().toLowerCase()}__verified`;
    if (!byKey.has(k)) {
      byKey.set(k, {
        ...seed,
        roadId: seed.roadId || seed.osmId || seed.id,
        verificationStatus: seed.verificationStatus || 'verified',
        nameSource: seed.nameSource || 'osm',
      });
    }
  }

  return Array.from(byKey.values());
}

/**
 * Dựng danh sách RoadLabel3D trực tiếp từ Map<string, RoadRecord> và City3DOrigin
 * để Bản đồ 3D cập nhật nhãn đường/ngõ tức thì khi Admin sửa mà không cần khởi động lại Worker.
 */
export function build3DRoadLabelsFromRecords(
  recordsById: Map<string, RoadRecord>,
  origin: { lng: number; lat: number; kx: number; ky: number },
  getElevationAtLocalFn?: (x: number, y: number) => number
): any[] {
  const rawRoadByName = new Map<string, any[]>();
  const tierOrder: Record<string, number> = { major: 1, secondary: 2, minor: 3, alley: 4 };

  for (const rec of recordsById.values()) {
    if (rec.deleted) continue;
    if (rec.verificationStatus !== 'verified' || rec.nameSource === 'inferred') continue;
    const name = (rec.name || '').trim();
    if (!name || /^(Đường mòn|Dốc |Hai Con|Thiên Phú Lâm Loop|Dong Do)/i.test(name)) continue;

    const coords = rec.geometry;
    if (!coords || coords.length < 2) continue;

    const pts: number[] = [];
    for (const [lng, lat] of coords) {
      pts.push((lng - origin.lng) * origin.kx, (lat - origin.lat) * origin.ky);
    }

    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < pts.length / 2 - 1; i++) {
      const l = Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
      segLens.push(l);
      totalLen += l;
    }

    const isNamedAlley =
      rec.roadClass === 'alley' ||
      rec.roadType === 'alley' ||
      rec.roadType === 'lane' ||
      /^(Ngõ|Ngách|Hẻm)\s+/i.test(name);
    if (totalLen < (isNamedAlley ? 16 : 30)) continue;

    const tier: 'major' | 'secondary' | 'minor' | 'alley' =
      rec.roadClass === 'major'
        ? 'major'
        : rec.roadClass === 'arterial'
          ? 'secondary'
          : isNamedAlley
            ? 'alley'
            : 'minor';

    const step = tier === 'major' ? 320 : tier === 'secondary' ? 240 : tier === 'minor' ? 185 : 150;
    const targets: number[] = [];
    if (totalLen < step * 1.3) {
      targets.push(totalLen * 0.5);
    } else {
      for (let d = step * 0.55; d <= totalLen - step * 0.35; d += step) targets.push(d);
    }

    const groupKey = isNamedAlley ? `${name}__${rec.roadId}` : name;
    let list = rawRoadByName.get(groupKey);
    if (!list) rawRoadByName.set(groupKey, (list = []));

    for (const td of targets) {
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        const sl = segLens[i];
        if (acc + sl >= td || i === segLens.length - 1) {
          const t = sl > 0 ? Math.max(0, Math.min(1, (td - acc) / sl)) : 0.5;
          const x1 = pts[i * 2],
            y1 = pts[i * 2 + 1],
            x2 = pts[i * 2 + 2],
            y2 = pts[i * 2 + 3];
          const px = x1 + (x2 - x1) * t;
          const py = y1 + (y2 - y1) * t;
          const l = Math.hypot(x2 - x1, y2 - y1) || 1;
          const elev = getElevationAtLocalFn ? getElevationAtLocalFn(px, py) : 0;
          list.push({
            roadId: rec.roadId,
            name,
            shortName: getShortAlleyLabel(name),
            roadClass: rec.roadClass,
            roadType: rec.roadType,
            parentRoad: rec.parentRoad || undefined,
            source: rec.nameSource,
            nameSource: rec.nameSource,
            verificationStatus: rec.verificationStatus,
            confidence: rec.confidence,
            segmentLengthM: Number(totalLen.toFixed(1)),
            x: px,
            z: -py,
            y: elev + 0.38,
            dx: (x2 - x1) / l,
            dz: -(y2 - y1) / l,
            tier,
          });
          break;
        }
        acc += sl;
      }
    }
  }

  const roadLabels: any[] = [];
  for (const [, cands] of rawRoadByName) {
    const kept: any[] = [];
    for (const c of cands) {
      if (!kept.some((k) => Math.hypot(c.x - k.x, c.z - k.z) < 120)) {
        kept.push(c);
        roadLabels.push(c);
      }
    }
  }
  roadLabels.sort((a, b) => (tierOrder[a.tier] || 3) - (tierOrder[b.tier] || 3));
  return roadLabels;
}

