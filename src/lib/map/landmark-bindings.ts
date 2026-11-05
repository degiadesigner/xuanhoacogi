import { PlaceLocation } from './map-types';
import {
  XuanHoaMasterDataset as MasterGeographyDataset,
  MasterBuildingRecord,
} from './xuanhoa-master-data';
import { getElevationAtLngLat } from './xuanhoa-elevation';
import { haversineDistanceMeters, saveLandmarkOrPlaceFromMap } from './map-data';
import { isAdminAuthenticated, resolvePlaceOrPendingProposalCoordinates } from '../admin-store';
import { City3DOrigin, lngLatToLocal } from '../../components/map/city3d/city3d-shared';
import { getRealtimeDb, getFirebaseAuth, ref, onValue } from '../firebase';
import { set } from 'firebase/database';

/**
 * CHẾ ĐỘ HIỂN THỊ MÔ HÌNH 3D THEO TRẠNG THÁI ĐỊA DANH (Phần 27)
 * - `follow_place`: Nếu Place đang ẩn/xóa thì ẩn model 3D theo Place (mặc định).
 * - `always`: Luôn hiện model 3D bất kể trạng thái Place.
 * - `manual`: Ẩn/hiện thủ công theo cờ `visible` của Admin.
 */
export type LandmarkModelVisibilityMode = 'follow_place' | 'always' | 'manual';

/**
 * ĐIỂM NEO CHỈNH SỬA TRỰC TIẾP TRÊN MÔ HÌNH LANDMARK (Phần 25)
 * Cho phép Admin căn góc công trình (VD: mái vòm tròn Nhà Trắng) hoặc căn theo 3 điểm A–B–C
 * thay vì chỉ căn bằng tâm mô hình.
 */
export interface LandmarkEditAnchors {
  primaryCorner: { x: number; z: number; label: string };
  frontageA: { x: number; z: number; label: string };
  frontageB: { x: number; z: number; label: string };
  footprintPolygon: Array<{ x: number; z: number }>;
}

/**
 * DATA SCHEMA CHO LANDMARK BINDING (Phần 12)
 * Liên kết chặt chẽ từng mô hình Landmark 3D với `Place` và/hoặc `MasterBuildingRecord` thật.
 */
export interface LandmarkBindingRecord {
  landmarkId: string;
  label: string;
  placeId: string;
  buildingId?: string;
  anchorType: 'place' | 'building';
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotationY: number;
  scale: number;
  visible: boolean;
  modelVisibilityMode: LandmarkModelVisibilityMode;
  updatedAt: number;
  updatedBy?: string;
  notes?: string;
  editAnchors?: LandmarkEditAnchors;
}

/**
 * LOG AUDIT MỖI LẦN DI CHUYỂN ĐỊA DANH HOẶC CĂN MÔ HÌNH 3D (Phần 47)
 */
export interface LandmarkAuditLogEntry {
  id: string;
  placeId: string;
  landmarkId?: string;
  placeName: string;
  actionType: 'move_place' | 'align_model' | 'snap_building' | 'align_rotation' | 'reset_default' | 'undo';
  oldLat?: number | null;
  oldLng?: number | null;
  newLat?: number | null;
  newLng?: number | null;
  movedMeters?: number;
  oldOffset?: { offsetX: number; offsetY: number; offsetZ: number; rotationY: number; scale: number };
  newOffset?: { offsetX: number; offsetY: number; offsetZ: number; rotationY: number; scale: number };
  updatedBy: string;
  updatedAt: number;
}

/**
 * Lịch sử 1 bước Hoàn tác (Undo) cho cả Mode A (Di chuyển địa danh) và Mode B (Căn mô hình 3D) (Phần 29)
 */
export interface LandmarkUndoSnapshot {
  placeId: string;
  landmarkId?: string;
  mode: 'mode_a_place' | 'mode_b_model';
  previousPlaceCoords?: {
    lat: number;
    lng: number;
    name: string;
    category: PlaceLocation['category'];
    address: string;
    phone?: string;
    openHours?: string;
    tagline?: string;
  };
  previousBinding?: LandmarkBindingRecord;
  savedAt: number;
}

const BINDINGS_STORAGE_KEY = 'xuanhoa_landmark_bindings_v1';
const AUDIT_STORAGE_KEY = 'xuanhoa_landmark_audit_logs_v1';
export const LANDMARK_BINDINGS_SYNC_EVENT = 'xuanhoa_landmark_bindings_sync';

/**
 * DANH SÁCH BINDING MẶC ĐỊNH ĐÃ CHUẨN HÓA CHO TOÀN BỘ LANDMARK 3D (Phần 25)
 * Không còn bất kỳ tọa độ hard-coded độc lập nào trong `city3d-landmarks.ts`.
 */
export const DEFAULT_LANDMARK_BINDINGS: Record<string, LandmarkBindingRecord> = {
  hpu2_a1: {
    landmarkId: 'hpu2_a1',
    label: 'Khu Hiệu bộ A1–A3 (ĐHSP Hà Nội 2)',
    placeId: 'osm_building_a1_dhsp2',
    buildingId: 'bldg_osm_way_1080000072',
    anchorType: 'place',
    offsetX: -12.0,
    offsetY: 0,
    offsetZ: 6.5,
    rotationY: -0.7854,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  dh_kien_truc: {
    landmarkId: 'dh_kien_truc',
    label: 'ĐH Kiến trúc Hà Nội (CS Xuân Hòa)',
    placeId: 'osm_way_1079368029',
    buildingId: 'bldg_osm_way_1079368029',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: -0.76,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  quang_truong_chim_xanh: {
    landmarkId: 'quang_truong_chim_xanh',
    label: 'Quảng trường Con Chim Xanh',
    placeId: 'osm_landmark_quang_truong_chim_xanh',
    anchorType: 'place',
    offsetX: -8.5,
    offsetY: 0,
    offsetZ: 8.5,
    rotationY: 2.3562,
    scale: 0.48,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  nha_trang_xuan_hoa: {
    landmarkId: 'nha_trang_xuan_hoa',
    label: 'Nhà Trắng Xuân Hòa',
    placeId: 'osm_landmark_nha_trang_xuan_hoa',
    buildingId: 'bldg_osm_way_662917177',
    anchorType: 'place',
    offsetX: 6.5,
    offsetY: 0,
    offsetZ: -10.5,
    rotationY: 1.0,
    scale: 0.92,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
    editAnchors: {
      primaryCorner: { x: -10, z: 5, label: 'Góc bo tròn mái vòm vàng' },
      frontageA: { x: 22.2, z: 6.2, label: 'Mặt tiền cánh chính (Phố Lê Xoay)' },
      frontageB: { x: -12.2, z: -16, label: 'Mặt tiền cánh phụ (Nguyễn Văn Linh)' },
      footprintPolygon: [
        { x: -12.2, z: -16 },
        { x: 22.2, z: -16 },
        { x: 22.2, z: 6.2 },
        { x: -6.5, z: 6.2 },
        { x: -10, z: 9.8 },
        { x: -13.4, z: 8.4 },
        { x: -14.8, z: 5 },
        { x: -12.2, z: 1.5 },
      ],
    },
  },
  vong_tron_1: {
    landmarkId: 'vong_tron_1',
    label: 'Vòng tròn 1',
    placeId: 'osm_landmark_vong_tron_1',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  vong_tron_2: {
    landmarkId: 'vong_tron_2',
    label: 'Vòng tròn 2',
    placeId: 'osm_landmark_vong_tron_2',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: -0.7854,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  nui_than_lan: {
    landmarkId: 'nui_than_lan',
    label: 'Núi Thằn Lằn & Di tích Bốt Pháp',
    placeId: 'osm_landmark_nui_than_lan',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  gate_ubnd_xuan_hoa: {
    landmarkId: 'gate_ubnd_xuan_hoa',
    label: 'Cổng & Sân nghi lễ UBND Phường Xuân Hòa',
    placeId: 'osm_civic_ubnd_xuan_hoa',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 8.5,
    rotationY: -0.76,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  gate_cho_xuan_hoa: {
    landmarkId: 'gate_cho_xuan_hoa',
    label: 'Cổng Chợ Xuân Hòa',
    placeId: 'osm_market_cho_xuan_hoa',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 9.0,
    rotationY: 0.45,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  xuanhoa_primary_school: {
    landmarkId: 'xuanhoa_primary_school',
    label: 'Trường Tiểu học Xuân Hòa',
    placeId: 'osm_way_1079368030',
    buildingId: 'bldg_osm_way_1289786132',
    anchorType: 'place',
    offsetX: 1.5,
    offsetY: 0,
    offsetZ: -1.0,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  xuanhoa_secondary_school: {
    landmarkId: 'xuanhoa_secondary_school',
    label: 'Trường THCS Xuân Hòa',
    placeId: 'osm_way_662917176',
    buildingId: 'bldg_osm_way_1289786126',
    anchorType: 'place',
    offsetX: -2.0,
    offsetY: 0,
    offsetZ: -3.0,
    rotationY: -0.065,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  xuanhoa_high_school: {
    landmarkId: 'xuanhoa_high_school',
    label: 'Trường THPT Xuân Hòa',
    placeId: 'osm_way_662917178',
    buildingId: 'bldg_osm_way_662917178',
    anchorType: 'place',
    offsetX: 3.0,
    offsetY: 0,
    offsetZ: -16.5,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  chua_hien_luong: {
    landmarkId: 'chua_hien_luong',
    label: 'Chùa Hiền Lương',
    placeId: 'xh_landmark_chua_hien_luong',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  chua_an_hoa: {
    landmarkId: 'chua_an_hoa',
    label: 'Chùa An Hòa',
    placeId: 'xh_landmark_chua_an_hoa',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  mam_non_xuan_hoa: {
    landmarkId: 'mam_non_xuan_hoa',
    label: 'Trường Mầm non Xuân Hòa',
    placeId: 'xh_landmark_mam_non_xuan_hoa',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
  nha_minh_huong: {
    landmarkId: 'nha_minh_huong',
    label: 'Nhà Minh Hường',
    placeId: 'xh_landmark_nha_minh_huong',
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: 1730000000000,
    updatedBy: 'system_seed',
  },
};

const LEGACY_PENDING_PLACE_ID_MIGRATION: Record<string, string> = {
  pending_place_chua_hien_luong: 'xh_landmark_chua_hien_luong',
  pending_place_chua_an_hoa: 'xh_landmark_chua_an_hoa',
  pending_place_mam_non_xuan_hoa: 'xh_landmark_mam_non_xuan_hoa',
  pending_place_nha_minh_huong: 'xh_landmark_nha_minh_huong',
};

export interface Twelve3DLandmarkOption {
  landmarkId: string;
  placeId: string;
  label: string;
  defaultLat: number;
  defaultLng: number;
}

/**
 * DANH SÁCH 12 LANDMARK 3D CHÍNH THỨC TRÊN SA BÀN 3D ĐỂ ADMIN CĂN CHỈNH NHANH
 */
export const TWELVE_3D_LANDMARKS_LIST: Twelve3DLandmarkOption[] = [
  {
    landmarkId: 'hpu2_a1',
    placeId: 'osm_building_a1_dhsp2',
    label: '1. Khu Hiệu bộ A1–A3 (ĐHSP Hà Nội 2)',
    defaultLat: 21.281344,
    defaultLng: 105.726226,
  },
  {
    landmarkId: 'vong_tron_2',
    placeId: 'osm_landmark_vong_tron_2',
    label: '2. Vòng tròn 2',
    defaultLat: 21.281565,
    defaultLng: 105.725,
  },
  {
    landmarkId: 'quang_truong_chim_xanh',
    placeId: 'osm_landmark_quang_truong_chim_xanh',
    label: '3. Quảng trường Con Chim Xanh',
    defaultLat: 21.28078,
    defaultLng: 105.7257,
  },
  {
    landmarkId: 'nha_trang_xuan_hoa',
    placeId: 'osm_landmark_nha_trang_xuan_hoa',
    label: '4. Nhà Trắng Xuân Hòa',
    defaultLat: 21.278175,
    defaultLng: 105.729275,
  },
  {
    landmarkId: 'vong_tron_1',
    placeId: 'osm_landmark_vong_tron_1',
    label: '5. Vòng tròn 1 Nguyễn Văn Linh',
    defaultLat: 21.277632,
    defaultLng: 105.729416,
  },
  {
    landmarkId: 'xuanhoa_primary_school',
    placeId: 'osm_way_1079368030',
    label: '6. Trường Tiểu học Xuân Hòa',
    defaultLat: 21.282057,
    defaultLng: 105.727521,
  },
  {
    landmarkId: 'xuanhoa_secondary_school',
    placeId: 'osm_way_662917176',
    label: '7. Trường THCS Xuân Hòa',
    defaultLat: 21.282025,
    defaultLng: 105.72646,
  },
  {
    landmarkId: 'xuanhoa_high_school',
    placeId: 'osm_way_662917178',
    label: '8. Trường THPT Xuân Hòa',
    defaultLat: 21.279711,
    defaultLng: 105.73068,
  },
  {
    landmarkId: 'chua_hien_luong',
    placeId: 'xh_landmark_chua_hien_luong',
    label: '9. Chùa Hiền Lương',
    defaultLat: 21.285617,
    defaultLng: 105.717546,
  },
  {
    landmarkId: 'chua_an_hoa',
    placeId: 'xh_landmark_chua_an_hoa',
    label: '10. Chùa An Hòa',
    defaultLat: 21.289193,
    defaultLng: 105.713308,
  },
  {
    landmarkId: 'mam_non_xuan_hoa',
    placeId: 'xh_landmark_mam_non_xuan_hoa',
    label: '11. Trường Mầm non Xuân Hòa',
    defaultLat: 21.2864,
    defaultLng: 105.721858,
  },
  {
    landmarkId: 'nha_minh_huong',
    placeId: 'xh_landmark_nha_minh_huong',
    label: '12. Nhà Minh Hường',
    defaultLat: 21.285862,
    defaultLng: 105.717861,
  },
];

let memoryBindingsCache: Record<string, LandmarkBindingRecord> | null = null;
let cloudBindingsCache: Record<string, Partial<LandmarkBindingRecord>> = {};
let cloudBindingsLoaded = false;
let cloudBindingsSubscribed = false;
const undoSnapshotsByPlaceId = new Map<string, LandmarkUndoSnapshot>();

export const LANDMARK_BINDINGS_RTDB_PATH = 'xuanhoa_admin/global_state/landmarkBindings';

export function sanitizeBindingForCloud(record: LandmarkBindingRecord): Record<string, unknown> {
  const cloudAnchorType = record.anchorType === 'building' ? 'world' : 'place';
  const cloudVisibilityMode =
    record.modelVisibilityMode === 'always'
      ? 'always'
      : record.modelVisibilityMode === 'manual'
      ? record.visible
        ? 'always'
        : 'hidden'
      : 'follow_place';

  const payload: Record<string, unknown> = {
    landmarkId: String(record.landmarkId).slice(0, 128),
    label: String(record.label || record.landmarkId).slice(0, 200),
    placeId: String(record.placeId || record.landmarkId).slice(0, 128),
    anchorType: cloudAnchorType,
    offsetX: Math.max(-2000, Math.min(2000, Number(Number(record.offsetX || 0).toFixed(2)))),
    offsetY: Math.max(-200, Math.min(200, Number(Number(record.offsetY || 0).toFixed(2)))),
    offsetZ: Math.max(-2000, Math.min(2000, Number(Number(record.offsetZ || 0).toFixed(2)))),
    rotationY: Math.max(-6.5, Math.min(6.5, Number(Number(record.rotationY || 0).toFixed(4)))),
    scale: Number(Math.max(0.25, Math.min(3.5, Number(record.scale || 1))).toFixed(2)),
    visible: Boolean(record.visible),
    modelVisibilityMode: cloudVisibilityMode,
    updatedAt: Number(record.updatedAt || Date.now()),
  };
  if (record.updatedBy) {
    payload.updatedBy = String(record.updatedBy).slice(0, 180);
  }
  const existingRawNotes = typeof record.notes === 'string' ? record.notes.trim() : '';
  let existingUserNotes = existingRawNotes;
  if (existingRawNotes.startsWith('{')) {
    try {
      const parsed = JSON.parse(existingRawNotes) as Record<string, unknown>;
      if (
        parsed &&
        typeof parsed === 'object' &&
        ('buildingId' in parsed || 'anchorType' in parsed || 'modelVisibilityMode' in parsed || 'userNotes' in parsed)
      ) {
        existingUserNotes = typeof parsed.userNotes === 'string' ? parsed.userNotes : '';
      }
    } catch {
      // plain text notes starting with {
    }
  }

  const metaNotes: Record<string, string> = {};
  if (record.buildingId) {
    metaNotes.buildingId = String(record.buildingId).slice(0, 160);
  }
  if (record.anchorType === 'building') {
    metaNotes.anchorType = 'building';
  }
  if (record.modelVisibilityMode === 'manual') {
    metaNotes.modelVisibilityMode = 'manual';
  }
  if (Object.keys(metaNotes).length > 0) {
    if (existingUserNotes) {
      metaNotes.userNotes = existingUserNotes.slice(0, 650);
    }
    payload.notes = JSON.stringify(metaNotes).slice(0, 1000);
  } else if (existingUserNotes) {
    payload.notes = existingUserNotes.slice(0, 1000);
  }
  return payload;
}

export async function syncLandmarkBindingRecordToCloudAsync(
  record: LandmarkBindingRecord
): Promise<{ cloudSaved: boolean; error?: string }> {
  if (typeof window === 'undefined') {
    return { cloudSaved: false, error: 'Môi trường không hỗ trợ trình duyệt.' };
  }
  try {
    const rtdb = getRealtimeDb();
    if (!rtdb) {
      return { cloudSaved: false, error: 'Chưa kết nối được Firebase Realtime Database.' };
    }
    const payload = sanitizeBindingForCloud(record);
    await set(ref(rtdb, `${LANDMARK_BINDINGS_RTDB_PATH}/${record.landmarkId}`), payload);
    return { cloudSaved: true };
  } catch (err: any) {
    const rawCode = String(err?.code || err?.message || 'PERMISSION_DENIED');
    const authUser = getFirebaseAuth()?.currentUser;
    if (rawCode.toUpperCase().includes('PERMISSION_DENIED')) {
      if (!authUser) {
        return {
          cloudSaved: false,
          error:
            'PERMISSION_DENIED (Chưa có phiên Firebase Auth — vui lòng đăng nhập Google bằng tài khoản Founder/Admin để lưu đám mây)',
        };
      }
      return {
        cloudSaved: false,
        error: `PERMISSION_DENIED (Tài khoản ${authUser.email || authUser.uid} không có quyền ghi nhánh landmarkBindings/${record.landmarkId})`,
      };
    }
    return { cloudSaved: false, error: rawCode };
  }
}

function syncLandmarkBindingRecordToCloud(record: LandmarkBindingRecord): void {
  void syncLandmarkBindingRecordToCloudAsync(record);
}

function ensureLandmarkBindingsCloudListener(): void {
  if (cloudBindingsSubscribed || typeof window === 'undefined') return;
  const rtdb = getRealtimeDb();
  if (!rtdb) return;
  cloudBindingsSubscribed = true;
  try {
    onValue(
      ref(rtdb, LANDMARK_BINDINGS_RTDB_PATH),
      (snap) => {
        const val = snap.val();
        cloudBindingsLoaded = true;
        cloudBindingsCache =
          val && typeof val === 'object'
            ? (val as Record<string, Partial<LandmarkBindingRecord>>)
            : {};
        // Đồng bộ ngay cấu hình chuẩn từ Firebase xuống bộ đệm localStorage
        // để localStorage chỉ là cache đọc nhanh và KHÔNG BAO GIỜ ghi đè cấu hình mới hơn trên Firebase!
        const authoritative = cloneDefaultBindings();
        applyBindingOverrideMap(authoritative, cloudBindingsCache, false);
        memoryBindingsCache = authoritative;
        if (window.localStorage) {
          try {
            window.localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(authoritative));
          } catch {
            // ignore
          }
        }
        window.dispatchEvent(new CustomEvent(LANDMARK_BINDINGS_SYNC_EVENT));
        window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync'));
      },
      () => {
        // ignore read error if offline
      }
    );
  } catch {
    // ignore
  }
}

export function cloneDefaultBindings(): Record<string, LandmarkBindingRecord> {
  const out: Record<string, LandmarkBindingRecord> = {};
  for (const [k, v] of Object.entries(DEFAULT_LANDMARK_BINDINGS)) {
    out[k] = { ...v };
  }
  return out;
}

export function applyBindingOverrideMap(
  merged: Record<string, LandmarkBindingRecord>,
  sourceMap: Record<string, Partial<LandmarkBindingRecord>>,
  onlyIfNewer = false
): void {
  for (const [id, ov] of Object.entries(sourceMap || {})) {
    if (!ov || id === 'gate_thpt_xuan_hoa') continue;
    const base = merged[id] || {
      landmarkId: id,
      label: ov.label || id,
      placeId: ov.placeId || id,
      anchorType: 'place' as const,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotationY: 0,
      scale: 1,
      visible: true,
      modelVisibilityMode: 'follow_place' as const,
      updatedAt: 0,
    };
    if (onlyIfNewer && Number(ov.updatedAt || 0) <= Number(base.updatedAt || 0)) {
      continue;
    }
    // Tự động nâng cấp cấu hình Nhà Trắng cũ (offsetX=0, rotationY=-0.18) sang góc căn chuẩn mặt đường mới
    if (
      id === 'nha_trang_xuan_hoa' &&
      Number(ov.offsetX ?? 0) === 0 &&
      Number(ov.offsetZ ?? 0) === 0 &&
      Math.abs(Number(ov.rotationY ?? -0.18) - -0.18) < 0.02
    ) {
      continue;
    }
    const rawPlaceId = ov.placeId || base.placeId;
    const canonicalPlaceId = LEGACY_PENDING_PLACE_ID_MIGRATION[rawPlaceId] || rawPlaceId;
    const rawOv = ov as Record<string, unknown>;
    let parsedNotes: Record<string, string> = {};
    let isMetaNotesEnvelope = false;
    if (typeof rawOv.notes === 'string' && rawOv.notes.startsWith('{')) {
      try {
        const candidate = JSON.parse(rawOv.notes);
        if (
          candidate &&
          typeof candidate === 'object' &&
          ('buildingId' in candidate ||
            'anchorType' in candidate ||
            'modelVisibilityMode' in candidate ||
            'userNotes' in candidate)
        ) {
          parsedNotes = candidate as Record<string, string>;
          isMetaNotesEnvelope = true;
        }
      } catch {
        // ignore invalid notes json
      }
    }
    const resolvedBuildingId =
      (typeof ov.buildingId === 'string' && ov.buildingId) ||
      parsedNotes.buildingId ||
      base.buildingId;
    const rawAnchor = String(
      parsedNotes.anchorType || ov.anchorType || base.anchorType
    );
    const resolvedAnchorType: 'place' | 'building' =
      rawAnchor === 'building' || (rawAnchor === 'world' && Boolean(resolvedBuildingId))
        ? 'building'
        : 'place';
    const rawVisMode = String(
      parsedNotes.modelVisibilityMode || ov.modelVisibilityMode || base.modelVisibilityMode
    );
    const resolvedVisMode: LandmarkModelVisibilityMode =
      rawVisMode === 'manual' || rawVisMode === 'hidden'
        ? 'manual'
        : rawVisMode === 'always'
        ? 'always'
        : 'follow_place';
    const resolvedUserNotes = isMetaNotesEnvelope
      ? parsedNotes.userNotes || base.notes
      : typeof rawOv.notes === 'string'
      ? rawOv.notes
      : base.notes;

    const nextRecord: LandmarkBindingRecord = {
      ...base,
      ...ov,
      landmarkId: id,
      placeId: canonicalPlaceId,
      buildingId: resolvedBuildingId,
      anchorType: resolvedAnchorType,
      modelVisibilityMode: resolvedVisMode,
      offsetX: Number.isFinite(Number(ov.offsetX)) ? Number(ov.offsetX) : base.offsetX,
      offsetY: Number.isFinite(Number(ov.offsetY)) ? Number(ov.offsetY) : base.offsetY,
      offsetZ: Number.isFinite(Number(ov.offsetZ)) ? Number(ov.offsetZ) : base.offsetZ,
      rotationY: Number.isFinite(Number(ov.rotationY)) ? Number(ov.rotationY) : base.rotationY,
      scale: Number.isFinite(Number(ov.scale)) ? Math.max(0.25, Math.min(3.5, Number(ov.scale))) : base.scale,
      updatedAt: Number.isFinite(Number(ov.updatedAt)) ? Number(ov.updatedAt) : base.updatedAt,
    };
    if (resolvedUserNotes !== undefined) {
      nextRecord.notes = resolvedUserNotes;
    } else {
      delete nextRecord.notes;
    }
    merged[id] = nextRecord;
  }
}

/**
 * Đọc toàn bộ Landmark Bindings hiện tại:
 * - Khi Firebase RTDB đã kết nối (`cloudBindingsLoaded === true`): Firebase là nguồn sự thật duy nhất (Local Storage chỉ là bộ đệm).
 * - Khi chưa nhận phản hồi đầu tiên từ Firebase hoặc đang ngoại tuyến: đọc từ bộ đệm Local Storage nhưng ưu tiên mọi bản ghi từ `cloudBindingsCache`.
 */
export function getLandmarkBindings(): Record<string, LandmarkBindingRecord> {
  if (typeof window === 'undefined' && memoryBindingsCache) {
    return memoryBindingsCache;
  }
  ensureLandmarkBindingsCloudListener();
  const merged = cloneDefaultBindings();
  if (cloudBindingsLoaded) {
    applyBindingOverrideMap(merged, cloudBindingsCache, false);
  } else {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(BINDINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, Partial<LandmarkBindingRecord>>;
          applyBindingOverrideMap(merged, parsed, true);
        }
      } catch {
        // ignore storage errors
      }
    }
    if (Object.keys(cloudBindingsCache).length > 0) {
      applyBindingOverrideMap(merged, cloudBindingsCache, false);
    }
  }
  memoryBindingsCache = merged;
  return merged;
}

function persistLandmarkBindings(
  next: Record<string, LandmarkBindingRecord>,
  changedRecord?: LandmarkBindingRecord,
  syncCloud = true
): void {
  memoryBindingsCache = next;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  if (changedRecord) {
    cloudBindingsCache[changedRecord.landmarkId] = { ...changedRecord };
    if (syncCloud) {
      syncLandmarkBindingRecordToCloud(changedRecord);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LANDMARK_BINDINGS_SYNC_EVENT));
    window.dispatchEvent(new CustomEvent('xuanhoa_admin_sync'));
  }
}

/**
 * Tìm Landmark Binding gắn với một `placeId` (hoặc tạo binding ảo trên bộ nhớ nếu địa điểm chưa có model custom riêng)
 */
export function getLandmarkBindingByPlaceId(placeId?: string | null): LandmarkBindingRecord | null {
  if (!placeId) return null;
  const all = getLandmarkBindings();
  for (const record of Object.values(all)) {
    if (record.placeId === placeId || record.landmarkId === placeId) {
      return record;
    }
  }
  // Cho phép liên kết các tòa nhà thuộc ĐHSP Hà Nội 2 về Khu Hiệu bộ A1 nếu chọn Hội trường 14-8
  if (placeId === 'osm_way_1080000083') {
    return all.hpu2_a1 || null;
  }
  return null;
}

/**
 * Lấy hoặc khởi tạo một LandmarkBindingRecord cho bất kỳ Place nào khi Admin mở Mode B ("Căn mô hình 3D")
 */
export function getOrCreateLandmarkBindingForPlace(
  place: Pick<PlaceLocation, 'id' | 'name' | 'metadata'>
): LandmarkBindingRecord {
  const existing = getLandmarkBindingByPlaceId(place.id);
  if (existing) return existing;

  const osmRaw = place.metadata?.osmId || '';
  const osmWayMatch = osmRaw.match(/way\/(\d+)/);
  const inferredBuildingId = osmWayMatch ? `bldg_osm_way_${osmWayMatch[1]}` : undefined;

  return {
    landmarkId: `custom_bind_${place.id}`,
    label: place.name,
    placeId: place.id,
    buildingId: inferredBuildingId,
    anchorType: 'place',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: Date.now(),
  };
}

/**
 * Ghi log Audit cho thao tác di chuyển địa danh hoặc căn chỉnh mô hình 3D (Phần 47)
 */
export function appendLandmarkAuditLog(entry: Omit<LandmarkAuditLogEntry, 'id' | 'updatedAt'>): LandmarkAuditLogEntry {
  const fullEntry: LandmarkAuditLogEntry = {
    ...entry,
    id: `lmaudit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    updatedAt: Date.now(),
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
      const list: LandmarkAuditLogEntry[] = raw ? JSON.parse(raw) : [];
      list.unshift(fullEntry);
      window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(list.slice(0, 120)));
    } catch {
      // ignore
    }
  }
  return fullEntry;
}

export function getLandmarkAuditLogs(limit = 30): LandmarkAuditLogEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as LandmarkAuditLogEntry[];
    return Array.isArray(list) ? list.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export interface LandmarkCloudSaveResult {
  ok: boolean;
  cloudSaved: boolean;
  record: LandmarkBindingRecord;
  error?: string;
}

function buildNextLandmarkBindingRecord(
  current: LandmarkBindingRecord,
  patch: Partial<LandmarkBindingRecord>,
  updatedBy: string
): LandmarkBindingRecord {
  return {
    ...current,
    ...patch,
    landmarkId: current.landmarkId,
    placeId: current.placeId,
    offsetX: Number(
      (patch.offsetX !== undefined ? patch.offsetX : current.offsetX).toFixed(2)
    ),
    offsetY: Number(
      (patch.offsetY !== undefined ? patch.offsetY : current.offsetY).toFixed(2)
    ),
    offsetZ: Number(
      (patch.offsetZ !== undefined ? patch.offsetZ : current.offsetZ).toFixed(2)
    ),
    rotationY: Number(
      (patch.rotationY !== undefined ? patch.rotationY : current.rotationY).toFixed(4)
    ),
    scale: Number(
      Math.max(0.25, Math.min(3.5, patch.scale !== undefined ? patch.scale : current.scale)).toFixed(2)
    ),
    visible: patch.visible !== undefined ? Boolean(patch.visible) : current.visible,
    modelVisibilityMode:
      patch.modelVisibilityMode !== undefined
        ? patch.modelVisibilityMode
        : current.modelVisibilityMode,
    updatedAt: Date.now(),
    updatedBy,
  };
}

/**
 * Lưu chỉnh sửa Mode B ("Căn mô hình 3D") lên Firebase RTDB có xác nhận thật (Không báo thành công giả khi Firebase lỗi!)
 */
export async function saveLandmarkBindingOverrideAsync(
  placeId: string,
  placeName: string,
  patch: Partial<LandmarkBindingRecord>,
  updatedBy = 'admin',
  actionType: LandmarkAuditLogEntry['actionType'] = 'align_model',
  recordUndo = true
): Promise<LandmarkCloudSaveResult> {
  const current =
    getLandmarkBindingByPlaceId(placeId) ||
    getOrCreateLandmarkBindingForPlace({ id: placeId, name: placeName, metadata: {} });

  if (!isAdminAuthenticated()) {
    return {
      ok: false,
      cloudSaved: false,
      record: current,
      error: 'PERMISSION_DENIED: Chỉ Admin mới có quyền chỉnh sửa cấu hình mô hình 3D.',
    };
  }

  const nextRecord = buildNextLandmarkBindingRecord(current, patch, updatedBy);
  const cloudRes = await syncLandmarkBindingRecordToCloudAsync(nextRecord);
  if (!cloudRes.cloudSaved) {
    // Khôi phục lại cache theo nguồn sự thật Firebase khi ghi thất bại
    memoryBindingsCache = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LANDMARK_BINDINGS_SYNC_EVENT));
    }
    return {
      ok: false,
      cloudSaved: false,
      record: current,
      error: cloudRes.error || 'Không thể lưu cấu hình lên Firebase RTDB.',
    };
  }

  if (recordUndo) {
    undoSnapshotsByPlaceId.set(placeId, {
      placeId,
      landmarkId: current.landmarkId,
      mode: 'mode_b_model',
      previousBinding: { ...current },
      savedAt: Date.now(),
    });
  }

  const all = { ...getLandmarkBindings() };
  all[nextRecord.landmarkId] = nextRecord;
  persistLandmarkBindings(all, nextRecord, false);

  appendLandmarkAuditLog({
    placeId,
    landmarkId: nextRecord.landmarkId,
    placeName,
    actionType,
    oldOffset: {
      offsetX: current.offsetX,
      offsetY: current.offsetY,
      offsetZ: current.offsetZ,
      rotationY: current.rotationY,
      scale: current.scale,
    },
    newOffset: {
      offsetX: nextRecord.offsetX,
      offsetY: nextRecord.offsetY,
      offsetZ: nextRecord.offsetZ,
      rotationY: nextRecord.rotationY,
      scale: nextRecord.scale,
    },
    updatedBy,
  });

  return {
    ok: true,
    cloudSaved: true,
    record: nextRecord,
  };
}

/**
 * Lưu chỉnh sửa Mode B ("Căn mô hình 3D") và tự động lưu Snapshot 1-step Undo (Phần 29)
 */
export function saveLandmarkBindingOverride(
  placeId: string,
  placeName: string,
  patch: Partial<LandmarkBindingRecord>,
  updatedBy = 'admin',
  actionType: LandmarkAuditLogEntry['actionType'] = 'align_model',
  recordUndo = true
): LandmarkBindingRecord {
  if (!isAdminAuthenticated()) {
    throw new Error('PERMISSION_DENIED: Chỉ Admin mới có quyền chỉnh sửa cấu hình mô hình 3D.');
  }
  const all = { ...getLandmarkBindings() };
  const current =
    getLandmarkBindingByPlaceId(placeId) ||
    getOrCreateLandmarkBindingForPlace({ id: placeId, name: placeName, metadata: {} });

  if (recordUndo) {
    undoSnapshotsByPlaceId.set(placeId, {
      placeId,
      landmarkId: current.landmarkId,
      mode: 'mode_b_model',
      previousBinding: { ...current },
      savedAt: Date.now(),
    });
  }

  const nextRecord = buildNextLandmarkBindingRecord(current, patch, updatedBy);
  all[nextRecord.landmarkId] = nextRecord;
  persistLandmarkBindings(all, nextRecord, true);

  appendLandmarkAuditLog({
    placeId,
    landmarkId: nextRecord.landmarkId,
    placeName,
    actionType,
    oldOffset: {
      offsetX: current.offsetX,
      offsetY: current.offsetY,
      offsetZ: current.offsetZ,
      rotationY: current.rotationY,
      scale: current.scale,
    },
    newOffset: {
      offsetX: nextRecord.offsetX,
      offsetY: nextRecord.offsetY,
      offsetZ: nextRecord.offsetZ,
      rotationY: nextRecord.rotationY,
      scale: nextRecord.scale,
    },
    updatedBy,
  });

  return nextRecord;
}

/**
 * Khôi phục cấu hình mô hình 3D về mặc định ban đầu (Mode B) kèm xác nhận ghi Firebase RTDB
 */
export async function resetLandmarkBindingToDefaultAsync(
  placeId: string,
  placeName: string,
  updatedBy = 'admin'
): Promise<LandmarkCloudSaveResult> {
  const current =
    getLandmarkBindingByPlaceId(placeId) ||
    getOrCreateLandmarkBindingForPlace({ id: placeId, name: placeName, metadata: {} });

  if (!isAdminAuthenticated()) {
    return {
      ok: false,
      cloudSaved: false,
      record: current,
      error: 'PERMISSION_DENIED: Chỉ Admin mới có quyền khôi phục cấu hình mô hình 3D.',
    };
  }

  const defaultBind = DEFAULT_LANDMARK_BINDINGS[current.landmarkId];
  const resetRec: LandmarkBindingRecord = defaultBind
    ? {
        ...defaultBind,
        updatedAt: Date.now(),
        updatedBy,
      }
    : {
        ...current,
        anchorType: 'place',
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        rotationY: 0,
        scale: 1,
        visible: true,
        modelVisibilityMode: 'follow_place',
        updatedAt: Date.now(),
        updatedBy,
      };

  const cloudRes = await syncLandmarkBindingRecordToCloudAsync(resetRec);
  if (!cloudRes.cloudSaved) {
    memoryBindingsCache = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LANDMARK_BINDINGS_SYNC_EVENT));
    }
    return {
      ok: false,
      cloudSaved: false,
      record: current,
      error: cloudRes.error || 'Không thể lưu cấu hình mặc định lên Firebase RTDB.',
    };
  }

  undoSnapshotsByPlaceId.set(placeId, {
    placeId,
    landmarkId: current.landmarkId,
    mode: 'mode_b_model',
    previousBinding: { ...current },
    savedAt: Date.now(),
  });

  const all = { ...getLandmarkBindings() };
  all[current.landmarkId] = resetRec;
  persistLandmarkBindings(all, resetRec, false);
  appendLandmarkAuditLog({
    placeId,
    landmarkId: current.landmarkId,
    placeName,
    actionType: 'reset_default',
    updatedBy,
  });

  return {
    ok: true,
    cloudSaved: true,
    record: resetRec,
  };
}

/**
 * Khôi phục cấu hình mô hình 3D về mặc định ban đầu (Mode B)
 */
export function resetLandmarkBindingToDefault(
  placeId: string,
  placeName: string,
  updatedBy = 'admin'
): LandmarkBindingRecord | null {
  if (!isAdminAuthenticated()) {
    throw new Error('PERMISSION_DENIED: Chỉ Admin mới có quyền khôi phục cấu hình mô hình 3D.');
  }
  const current = getLandmarkBindingByPlaceId(placeId);
  if (!current) return null;

  undoSnapshotsByPlaceId.set(placeId, {
    placeId,
    landmarkId: current.landmarkId,
    mode: 'mode_b_model',
    previousBinding: { ...current },
    savedAt: Date.now(),
  });

  const all = { ...getLandmarkBindings() };
  const defaultBind = DEFAULT_LANDMARK_BINDINGS[current.landmarkId];
  if (defaultBind) {
    all[current.landmarkId] = {
      ...defaultBind,
      updatedAt: Date.now(),
      updatedBy,
    };
  } else {
    all[current.landmarkId] = {
      ...current,
      anchorType: 'place',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotationY: 0,
      scale: 1,
      visible: true,
      modelVisibilityMode: 'follow_place',
      updatedAt: Date.now(),
      updatedBy,
    };
  }

  persistLandmarkBindings(all, all[current.landmarkId], true);
  appendLandmarkAuditLog({
    placeId,
    landmarkId: current.landmarkId,
    placeName,
    actionType: 'reset_default',
    updatedBy,
  });
  return all[current.landmarkId];
}

/**
 * Lưu vị trí địa lý mới của Địa danh (Mode A — "Di chuyển địa danh") kèm Snapshot Undo & Audit Log (Phần 15, 29, 30, 47).
 * Khi hàm này chạy:
 * - `place.lat` và `place.lng` được cập nhật với `coordinateSource = 'admin_verified'`
 * - Ghim 2D, ghim 3D, nhãn, popup, route target VÀ model 3D gắn với `placeId` tự động dịch chuyển theo đúng vector địa lý mới!
 */
export function executeAdminMovePlaceWithBindingSync(params: {
  place: PlaceLocation;
  newLat: number;
  newLng: number;
  updatedBy?: string;
}): {
  oldLat: number | null;
  oldLng: number | null;
  newLat: number;
  newLng: number;
  movedMeters: number;
} {
  const { place, newLat, newLng, updatedBy = 'admin' } = params;
  const oldLat = place.lat;
  const oldLng = place.lng;
  const cleanLat = Number(newLat.toFixed(6));
  const cleanLng = Number(newLng.toFixed(6));

  const movedMeters =
    oldLat !== null && oldLng !== null
      ? haversineDistanceMeters(oldLat, oldLng, cleanLat, cleanLng)
      : 0;

  if (oldLat !== null && oldLng !== null) {
    const bind = getLandmarkBindingByPlaceId(place.id);
    undoSnapshotsByPlaceId.set(place.id, {
      placeId: place.id,
      landmarkId: bind?.landmarkId,
      mode: 'mode_a_place',
      previousPlaceCoords: {
        lat: oldLat,
        lng: oldLng,
        name: place.name,
        category: place.category,
        address: place.address,
        phone: place.phone,
        openHours: place.openHours,
        tagline: place.metadata?.subType,
      },
      previousBinding: bind ? { ...bind } : undefined,
      savedAt: Date.now(),
    });
  }

  // Nếu trước đó Landmark đang neo cứng vào `building` (`anchorType === 'building'`),
  // chuyển `anchorType` về `'place'` để mô hình 3D đi theo đúng tọa độ địa danh vừa dời!
  const existingBinding = getLandmarkBindingByPlaceId(place.id);
  if (existingBinding && existingBinding.anchorType === 'building') {
    const all = { ...getLandmarkBindings() };
    all[existingBinding.landmarkId] = {
      ...existingBinding,
      anchorType: 'place',
      updatedAt: Date.now(),
      updatedBy,
    };
    persistLandmarkBindings(all, all[existingBinding.landmarkId]);
  }

  saveLandmarkOrPlaceFromMap({
    id: place.id,
    name: place.name,
    category: place.category,
    address: place.address,
    phone: place.phone,
    openHours: place.openHours,
    tagline: place.metadata?.subType,
    lat: cleanLat,
    lng: cleanLng,
    mapsUrl: `${cleanLat}, ${cleanLng}`,
  });

  appendLandmarkAuditLog({
    placeId: place.id,
    landmarkId: existingBinding?.landmarkId,
    placeName: place.name,
    actionType: 'move_place',
    oldLat,
    oldLng,
    newLat: cleanLat,
    newLng: cleanLng,
    movedMeters,
    updatedBy,
  });

  return {
    oldLat,
    oldLng,
    newLat: cleanLat,
    newLng: cleanLng,
    movedMeters,
  };
}

/**
 * Kiểm tra xem một địa danh có thao tác vừa lưu có thể Hoàn tác (Undo 1 bước) hay không (Phần 29)
 */
export function getLandmarkUndoSnapshot(placeId?: string | null): LandmarkUndoSnapshot | null {
  if (!placeId) return null;
  return undoSnapshotsByPlaceId.get(placeId) || null;
}

/**
 * Thực thi Hoàn tác 1 bước (Undo) cho Mode A (Di chuyển địa danh) hoặc Mode B (Căn mô hình 3D) (Phần 29)
 */
export function undoLastLandmarkOrPlaceAction(
  placeId: string,
  placeName: string,
  updatedBy = 'admin'
): { mode: 'mode_a_place' | 'mode_b_model'; restoredLat?: number; restoredLng?: number } | null {
  const snap = undoSnapshotsByPlaceId.get(placeId);
  if (!snap) return null;
  undoSnapshotsByPlaceId.delete(placeId);

  if (snap.mode === 'mode_a_place' && snap.previousPlaceCoords) {
    const prev = snap.previousPlaceCoords;
    saveLandmarkOrPlaceFromMap({
      id: placeId,
      name: prev.name,
      category: prev.category,
      address: prev.address,
      phone: prev.phone,
      openHours: prev.openHours,
      tagline: prev.tagline,
      lat: prev.lat,
      lng: prev.lng,
      mapsUrl: `${prev.lat}, ${prev.lng}`,
    });
    if (snap.previousBinding) {
      const all = { ...getLandmarkBindings() };
      all[snap.previousBinding.landmarkId] = { ...snap.previousBinding, updatedAt: Date.now() };
      persistLandmarkBindings(all, all[snap.previousBinding.landmarkId]);
    }
    appendLandmarkAuditLog({
      placeId,
      landmarkId: snap.landmarkId,
      placeName,
      actionType: 'undo',
      newLat: prev.lat,
      newLng: prev.lng,
      updatedBy,
    });
    return {
      mode: 'mode_a_place',
      restoredLat: prev.lat,
      restoredLng: prev.lng,
    };
  }

  if (snap.mode === 'mode_b_model' && snap.previousBinding) {
    const all = { ...getLandmarkBindings() };
    all[snap.previousBinding.landmarkId] = {
      ...snap.previousBinding,
      updatedAt: Date.now(),
      updatedBy,
    };
    persistLandmarkBindings(all, all[snap.previousBinding.landmarkId]);
    appendLandmarkAuditLog({
      placeId,
      landmarkId: snap.previousBinding.landmarkId,
      placeName,
      actionType: 'undo',
      newOffset: {
        offsetX: snap.previousBinding.offsetX,
        offsetY: snap.previousBinding.offsetY,
        offsetZ: snap.previousBinding.offsetZ,
        rotationY: snap.previousBinding.rotationY,
        scale: snap.previousBinding.scale,
      },
      updatedBy,
    });
    return {
      mode: 'mode_b_model',
    };
  }

  return null;
}

/**
 * Tính góc xoay mặt tiền chính (`rotationY` trong Three.js) từ cạnh dài nhất của đa giác footprint tòa nhà (Phần 23)
 */
export function computeBuildingDominantRotationY(
  building: MasterBuildingRecord,
  origin: City3DOrigin
): number {
  const ring = building.ringLngLat;
  if (!ring || ring.length < 3) return 0;

  let maxLenSq = -1;
  let bestDx = 1;
  let bestDz = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = lngLatToLocal(origin, ring[i][0], ring[i][1]);
    const [x2, y2] = lngLatToLocal(origin, ring[i + 1][0], ring[i + 1][1]);
    const z1 = -y1;
    const z2 = -y2;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq > maxLenSq) {
      maxLenSq = lenSq;
      bestDx = dx;
      bestDz = dz;
    }
  }

  // Pháp tuyến vuông góc với cạnh mặt tiền dài nhất
  const normalAngle = Math.atan2(bestDx, bestDz);
  return Number(normalAngle.toFixed(4));
}

export interface SnapBuildingPreviewResult {
  building: MasterBuildingRecord;
  distanceMeters: number;
  suggestedOffsetX: number;
  suggestedOffsetZ: number;
  suggestedRotationY: number;
}

/**
 * Xem trước thông tin Snap vào công trình (footprint OSM/Master) gần nhất (Phần 22 & 23).
 * Không tự động ghi đè ngầm — trả về preview để Admin xem Building ID, khoảng cách và bấm Xác nhận!
 */
export function previewSnapLandmarkToNearestBuilding(params: {
  place: PlaceLocation;
  masterDataset: MasterGeographyDataset | null;
  origin: City3DOrigin;
}): SnapBuildingPreviewResult | null {
  const { place, masterDataset, origin } = params;
  if (!masterDataset || place.lat === null || place.lng === null) return null;

  const buildings = masterDataset.buildings || [];
  if (buildings.length === 0) return null;

  let bestBuilding: MasterBuildingRecord | null = null;
  let minMeters = Infinity;

  const existingBind = getLandmarkBindingByPlaceId(place.id);
  const osmRaw = place.metadata?.osmId || '';
  const osmWayMatch = osmRaw.match(/way\/(\d+)/);
  const directWayId = osmWayMatch ? Number(osmWayMatch[1]) : null;

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const [bLng, bLat] = b.centroidLngLat;
    const dMeters = haversineDistanceMeters(place.lat, place.lng, bLat, bLng);

    // Ưu tiên nhẹ cho building trùng osmWayId nếu nằm trong bán kính hợp lý (< 90m)
    const isDirectMatch =
      (directWayId !== null && b.osmWayId === directWayId) ||
      (existingBind?.buildingId && b.id === existingBind.buildingId);

    const effectiveDist = isDirectMatch && dMeters < 90 ? dMeters * 0.4 : dMeters;
    if (effectiveDist < minMeters && dMeters <= 180) {
      minMeters = effectiveDist;
      bestBuilding = b;
    }
  }

  if (!bestBuilding) return null;

  const [bLng, bLat] = bestBuilding.centroidLngLat;
  const exactMeters = haversineDistanceMeters(place.lat, place.lng, bLat, bLng);

  const [placeX, placeY] = lngLatToLocal(origin, place.lng, place.lat);
  const [bldgX, bldgY] = lngLatToLocal(origin, bLng, bLat);
  const placeZ = -placeY;
  const bldgZ = -bldgY;

  const suggestedOffsetX = Number((bldgX - placeX).toFixed(2));
  const suggestedOffsetZ = Number((bldgZ - placeZ).toFixed(2));
  const suggestedRotationY = computeBuildingDominantRotationY(bestBuilding, origin);

  return {
    building: bestBuilding,
    distanceMeters: exactMeters,
    suggestedOffsetX,
    suggestedOffsetZ,
    suggestedRotationY,
  };
}

export interface ResolvedLandmarkWorldTransform {
  landmarkId: string;
  placeId: string;
  anchorLng: number;
  anchorLat: number;
  anchorWorldX: number;
  anchorWorldY: number;
  anchorWorldZ: number;
  modelWorldX: number;
  modelWorldY: number;
  modelWorldZ: number;
  rotationY: number;
  scale: number;
  visible: boolean;
  binding: LandmarkBindingRecord;
}

/**
 * TÍNH VỊ TRÍ THẾ GIỚI 3D CỦA LANDMARK TỪ ANCHOR (PLACE / BUILDING) + OFFSET (Phần 13, 24, 27)
 * Đảm bảo:
 * - Khi `place.lat / place.lng` thay đổi -> `anchorWorldX/Z` tự động đổi -> model 3D tự động đi theo!
 * - Khi chỉnh `offsetX / offsetY / offsetZ` -> chỉ model 3D dịch tinh chỉnh, không đổi `place.lat / place.lng`!
 * - Độ cao mặt đất `modelWorldY = terrainElevation(anchor) + offsetY` (riêng Núi Thằn Lằn giữ base Y = 0 + offsetY vì tự dựng địa hình đồi).
 */
export function resolveLandmarkWorldTransform(params: {
  landmarkId: string;
  origin: City3DOrigin;
  placesById: Map<string, PlaceLocation>;
  fallbackLngLat: [number, number];
  masterDataset?: MasterGeographyDataset | null;
  overrideBinding?: Partial<LandmarkBindingRecord> | null;
  isTerrainBaseZero?: boolean;
}): ResolvedLandmarkWorldTransform {
  const {
    landmarkId,
    origin,
    placesById,
    fallbackLngLat,
    masterDataset,
    overrideBinding,
    isTerrainBaseZero = false,
  } = params;

  const allBindings = getLandmarkBindings();
  const baseBinding =
    allBindings[landmarkId] ||
    DEFAULT_LANDMARK_BINDINGS[landmarkId] || {
      landmarkId,
      label: landmarkId,
      placeId: landmarkId,
      anchorType: 'place',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotationY: 0,
      scale: 1,
      visible: true,
      modelVisibilityMode: 'follow_place',
      updatedAt: 0,
    };

  const binding: LandmarkBindingRecord = overrideBinding
    ? { ...baseBinding, ...overrideBinding }
    : baseBinding;

  const boundPlace = placesById.get(binding.placeId);
  const pendingOrPlaceCoord =
    !boundPlace || boundPlace.lng === null || boundPlace.lat === null
      ? resolvePlaceOrPendingProposalCoordinates(binding.placeId)
      : null;

  let anchorLng = fallbackLngLat[0];
  let anchorLat = fallbackLngLat[1];

  if (binding.anchorType === 'building' && binding.buildingId && masterDataset) {
    const matchedBldg = masterDataset.buildings.find(
      (b: MasterBuildingRecord) => b.id === binding.buildingId
    );
    if (matchedBldg) {
      anchorLng = matchedBldg.centroidLngLat[0];
      anchorLat = matchedBldg.centroidLngLat[1];
    } else if (boundPlace && boundPlace.lng !== null && boundPlace.lat !== null) {
      anchorLng = boundPlace.lng;
      anchorLat = boundPlace.lat;
    } else if (pendingOrPlaceCoord) {
      anchorLng = pendingOrPlaceCoord.lng;
      anchorLat = pendingOrPlaceCoord.lat;
    }
  } else if (boundPlace && boundPlace.lng !== null && boundPlace.lat !== null) {
    anchorLng = boundPlace.lng;
    anchorLat = boundPlace.lat;
  } else if (pendingOrPlaceCoord) {
    anchorLng = pendingOrPlaceCoord.lng;
    anchorLat = pendingOrPlaceCoord.lat;
  }

  const [ax, ay] = lngLatToLocal(origin, anchorLng, anchorLat);
  const anchorWorldX = ax;
  const anchorWorldZ = -ay;
  const terrainElev = getElevationAtLngLat(anchorLng, anchorLat);
  const anchorWorldY = isTerrainBaseZero ? 0 : terrainElev;

  const modelWorldX = anchorWorldX + binding.offsetX;
  const modelWorldZ = anchorWorldZ + binding.offsetZ;

  // Lấy độ cao địa hình ngay tại vị trí đặt model để không bao giờ chìm hay bay lơ lửng (Phần 24)
  const modelLng = origin.lng + modelWorldX / origin.kx;
  const modelLat = origin.lat + -modelWorldZ / origin.ky;
  const modelGroundElev = isTerrainBaseZero ? 0 : getElevationAtLngLat(modelLng, modelLat);
  const modelWorldY = modelGroundElev + binding.offsetY;

  // Xét chế độ ẩn/hiện model theo trạng thái Place (Phần 27)
  let isModelVisible = true;
  if (binding.modelVisibilityMode === 'always') {
    isModelVisible = true;
  } else if (binding.modelVisibilityMode === 'manual') {
    isModelVisible = binding.visible;
  } else {
    // 'follow_place'
    const placeVisible = boundPlace
      ? boundPlace.coordinateVerified &&
        boundPlace.lat !== null &&
        boundPlace.lng !== null &&
        boundPlace.visibilityStatus !== 'hidden' &&
        boundPlace.visibilityStatus !== 'deleted' &&
        boundPlace.visibilityStatus !== 'blocked'
      : pendingOrPlaceCoord
      ? pendingOrPlaceCoord.status !== 'rejected' && pendingOrPlaceCoord.status !== 'cancelled'
      : true;
    isModelVisible = binding.visible && placeVisible;
  }

  return {
    landmarkId,
    placeId: binding.placeId,
    anchorLng,
    anchorLat,
    anchorWorldX,
    anchorWorldY,
    anchorWorldZ,
    modelWorldX,
    modelWorldY,
    modelWorldZ,
    rotationY: binding.rotationY,
    scale: binding.scale,
    visible: isModelVisible,
    binding,
  };
}

/**
 * DANH SÁCH EDIT ANCHORS & ĐA GIÁC FOOTPRINT CHO TỪNG LANDMARK (Phần 20, 21, 24, 25)
 */
export const LANDMARK_EDIT_ANCHORS_MAP: Record<string, LandmarkEditAnchors> = {
  nha_trang_xuan_hoa: {
    primaryCorner: { x: -10, z: 5, label: 'Góc bo tròn mái vòm vàng' },
    frontageA: { x: 22.2, z: 6.2, label: 'Cánh mặt tiền chính (Phố Lê Xoay)' },
    frontageB: { x: -12.2, z: -16, label: 'Cánh mặt tiền phụ (Nguyễn Văn Linh)' },
    footprintPolygon: [
      { x: -12.2, z: -16 },
      { x: 22.2, z: -16 },
      { x: 22.2, z: 6.2 },
      { x: -6.5, z: 6.2 },
      { x: -10, z: 9.8 },
      { x: -13.4, z: 8.4 },
      { x: -14.8, z: 5 },
      { x: -12.2, z: 1.5 },
    ],
  },
  hpu2_a1: {
    primaryCorner: { x: -24, z: 18, label: 'Góc sảnh cổng ĐHSP Hà Nội 2' },
    frontageA: { x: 24, z: 18, label: 'Mặt tiền Nguyễn Văn Linh' },
    frontageB: { x: -24, z: -18, label: 'Cánh bên khuôn viên' },
    footprintPolygon: [
      { x: -24, z: -18 },
      { x: 24, z: -18 },
      { x: 24, z: 18 },
      { x: -24, z: 18 },
    ],
  },
  dh_kien_truc: {
    primaryCorner: { x: -7, z: 8, label: 'Góc cổng Số 34 Nguyễn Văn Linh' },
    frontageA: { x: 7, z: 8, label: 'Mặt tiền Nguyễn Văn Linh' },
    frontageB: { x: -7, z: -9, label: 'Cánh bên giảng đường' },
    footprintPolygon: [
      { x: -9, z: -10.5 },
      { x: 9, z: -10.5 },
      { x: 9, z: 10.5 },
      { x: -9, z: 10.5 },
    ],
  },
  quang_truong_chim_xanh: {
    primaryCorner: { x: 0, z: 14, label: 'Mũi hướng quảng trường' },
    frontageA: { x: 14, z: 0, label: 'Trục Đông quảng trường' },
    frontageB: { x: -14, z: 0, label: 'Trục Tây quảng trường' },
    footprintPolygon: [
      { x: 0, z: 15 },
      { x: 10.6, z: 10.6 },
      { x: 15, z: 0 },
      { x: 10.6, z: -10.6 },
      { x: 0, z: -15 },
      { x: -10.6, z: -10.6 },
      { x: -15, z: 0 },
      { x: -10.6, z: 10.6 },
    ],
  },
  vong_tron_1: {
    primaryCorner: { x: 0, z: 11, label: 'Điểm hướng Nam vòng xuyến' },
    frontageA: { x: 11, z: 0, label: 'Hướng Đông (Trường Chinh)' },
    frontageB: { x: 0, z: -11, label: 'Hướng Bắc (Lê Xoay)' },
    footprintPolygon: [
      { x: 0, z: 11.5 },
      { x: 8.1, z: 8.1 },
      { x: 11.5, z: 0 },
      { x: 8.1, z: -8.1 },
      { x: 0, z: -11.5 },
      { x: -8.1, z: -8.1 },
      { x: -11.5, z: 0 },
      { x: -8.1, z: 8.1 },
    ],
  },
  vong_tron_2: {
    primaryCorner: { x: 0, z: 14, label: 'Mũi đảo giao thông' },
    frontageA: { x: 8, z: 0, label: 'Cạnh phải dải phân cách' },
    frontageB: { x: 0, z: -14, label: 'Đuôi đảo giao thông' },
    footprintPolygon: [
      { x: -8, z: -15 },
      { x: 8, z: -15 },
      { x: 8, z: 15 },
      { x: -8, z: 15 },
    ],
  },
  xuanhoa_primary_school: {
    primaryCorner: { x: 5, z: 34, label: 'Cổng chính Trường Tiểu học Xuân Hòa (Phố Kim Đồng)' },
    frontageA: { x: 27, z: 34, label: 'Tường rào mặt tiền Đông (Phố Kim Đồng)' },
    frontageB: { x: -27, z: 34, label: 'Tường rào mặt tiền Tây (Phố Kim Đồng)' },
    footprintPolygon: [
      { x: -29, z: -36 },
      { x: 29, z: -36 },
      { x: 29, z: 36 },
      { x: -29, z: 36 },
    ],
  },
  xuanhoa_secondary_school: {
    primaryCorner: { x: 7, z: 34, label: 'Cổng chính Trường THCS Xuân Hòa (Phố Kim Đồng)' },
    frontageA: { x: 27, z: 34, label: 'Tường rào mặt tiền Đông (Phố Kim Đồng)' },
    frontageB: { x: -27, z: 34, label: 'Tường rào mặt tiền Tây (Phố Kim Đồng)' },
    footprintPolygon: [
      { x: -29, z: -36 },
      { x: 29, z: -36 },
      { x: 29, z: 36 },
      { x: -29, z: 36 },
    ],
  },
  xuanhoa_high_school: {
    primaryCorner: { x: 0, z: 66.0, label: 'Cổng chính Trường THPT Xuân Hòa' },
    frontageA: { x: 58.0, z: 66.0, label: 'Tường rào mặt tiền Đông Nam' },
    frontageB: { x: -58.0, z: 66.0, label: 'Tường rào mặt tiền Tây Nam' },
    footprintPolygon: [
      { x: -59, z: -66 },
      { x: 59, z: -66 },
      { x: 59, z: 66 },
      { x: -59, z: 66 },
    ],
  },
  chua_hien_luong: {
    primaryCorner: { x: 0, z: 19.0, label: 'Cổng Tam quan Chùa Hiền Lương' },
    frontageA: { x: 17.0, z: 19.0, label: 'Tường rào mặt tiền Đông' },
    frontageB: { x: -17.0, z: 19.0, label: 'Tường rào mặt tiền Tây' },
    footprintPolygon: [
      { x: -17, z: -19.5 },
      { x: 17, z: -19.5 },
      { x: 17, z: 19.5 },
      { x: -17, z: 19.5 },
    ],
  },
  chua_an_hoa: {
    primaryCorner: { x: 0, z: 23.4, label: 'Cổng Tam quan Chùa An Hòa' },
    frontageA: { x: 24.0, z: 23.4, label: 'Tường rào mặt tiền Đông' },
    frontageB: { x: -24.0, z: 23.4, label: 'Tường rào mặt tiền Tây' },
    footprintPolygon: [
      { x: -24, z: -40.5 },
      { x: 24, z: -40.5 },
      { x: 24, z: 24 },
      { x: -24, z: 24 },
    ],
  },
  mam_non_xuan_hoa: {
    primaryCorner: { x: 0, z: 23.3, label: 'Cổng vòm Trường Mầm non Xuân Hòa' },
    frontageA: { x: 24.0, z: 23.3, label: 'Hàng rào mặt tiền Đông' },
    frontageB: { x: -24.0, z: 23.3, label: 'Hàng rào mặt tiền Tây' },
    footprintPolygon: [
      { x: -24, z: -33.5 },
      { x: 24, z: -33.5 },
      { x: 24, z: 23.5 },
      { x: -24, z: 23.5 },
    ],
  },
  nha_minh_huong: {
    primaryCorner: { x: -1.0, z: 15.1, label: 'Cổng hoa giấy Nhà Minh Hường' },
    frontageA: { x: 12.5, z: 15.1, label: 'Tường rào mặt tiền phải' },
    frontageB: { x: -10.5, z: 15.1, label: 'Tường rào mặt tiền trái (Cây khế)' },
    footprintPolygon: [
      { x: -10.5, z: -25.5 },
      { x: 12.5, z: -25.5 },
      { x: 12.5, z: 15.5 },
      { x: -10.5, z: 15.5 },
    ],
  },
};

export function getLandmarkEditAnchors(landmarkId?: string | null): LandmarkEditAnchors {
  if (landmarkId && LANDMARK_EDIT_ANCHORS_MAP[landmarkId]) {
    return LANDMARK_EDIT_ANCHORS_MAP[landmarkId];
  }
  return {
    primaryCorner: { x: -8, z: 8, label: 'Góc chính công trình' },
    frontageA: { x: 8, z: 8, label: 'Cạnh mặt tiền A' },
    frontageB: { x: -8, z: -8, label: 'Cạnh mặt tiền B' },
    footprintPolygon: [
      { x: -9, z: -9 },
      { x: 9, z: -9 },
      { x: 9, z: 9 },
      { x: -9, z: 9 },
    ],
  };
}

/**
 * Biến đổi một điểm local `(lx, lz)` của model sang tọa độ thế giới `(wx, wz)`
 */
export function localModelPointToWorld(
  lx: number,
  lz: number,
  modelWorldX: number,
  modelWorldZ: number,
  rotationY: number,
  scale: number
): { x: number; z: number } {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return {
    x: modelWorldX + scale * (lx * c + lz * s),
    z: modelWorldZ + scale * (-lx * s + lz * c),
  };
}

/**
 * SNAP CORNER: Đặt đúng `primaryCorner` (VD: tâm góc bo tròn mái vòm Nhà Trắng) trùng khít vào điểm `targetCornerWorld` (Phần 24)
 */
export function computeCornerSnapAlignment(params: {
  targetCornerWorld: { x: number; z: number };
  anchorWorld: { x: number; z: number };
  rotationY: number;
  scale: number;
  editAnchors: LandmarkEditAnchors;
}): { offsetX: number; offsetZ: number } {
  const { targetCornerWorld, anchorWorld, rotationY, scale, editAnchors } = params;
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  const cx = editAnchors.primaryCorner.x;
  const cz = editAnchors.primaryCorner.z;
  const rotatedCornerDX = scale * (cx * c + cz * s);
  const rotatedCornerDZ = scale * (-cx * s + cz * c);

  const modelWorldX = targetCornerWorld.x - rotatedCornerDX;
  const modelWorldZ = targetCornerWorld.z - rotatedCornerDZ;

  return {
    offsetX: Number((modelWorldX - anchorWorld.x).toFixed(2)),
    offsetZ: Number((modelWorldZ - anchorWorld.z).toFixed(2)),
  };
}

/**
 * CHẾ ĐỘ CĂN THEO 3 ĐIỂM A–B–C (Phần 2):
 * - Điểm A: Vị trí đặt góc công trình quan trọng (`primaryCorner`, VD: góc mái vòm vàng Nhà Trắng)
 * - Điểm B: Điểm định hướng dọc cạnh mặt tiền thứ nhất (`frontageA`)
 * - Điểm C (tùy chọn): Điểm định hướng dọc cạnh mặt tiền thứ hai (`frontageB`)
 * Tự động tính chính xác `offsetX`, `offsetZ`, `rotationY` để góc công trình bám đúng Điểm A và hai cánh bám theo AB, AC!
 */
export function computeThreePointAlignment(params: {
  pointA: { x: number; z: number };
  pointB: { x: number; z: number };
  pointC?: { x: number; z: number } | null;
  anchorWorld: { x: number; z: number };
  scale: number;
  editAnchors: LandmarkEditAnchors;
}): { offsetX: number; offsetZ: number; rotationY: number } {
  const { pointA, pointB, pointC, anchorWorld, scale, editAnchors } = params;
  const corner = editAnchors.primaryCorner;
  const frontA = editAnchors.frontageA;
  const frontB = editAnchors.frontageB;

  // Vector mặt tiền A trong hệ tọa độ local của model (x, -z)
  const localAx = frontA.x - corner.x;
  const localAz = frontA.z - corner.z;
  const localAngleA = Math.atan2(-localAz, localAx);

  // Vector AB trên mặt đất thế giới (x, -z)
  const worldABx = pointB.x - pointA.x;
  const worldABz = pointB.z - pointA.z;
  const worldAngleAB = Math.atan2(-worldABz, worldABx);

  let rotA = worldAngleAB - localAngleA;

  if (pointC) {
    const localBx = frontB.x - corner.x;
    const localBz = frontB.z - corner.z;
    const localAngleB = Math.atan2(-localBz, localBx);

    const worldACx = pointC.x - pointA.x;
    const worldACz = pointC.z - pointA.z;
    const worldAngleAC = Math.atan2(-worldACz, worldACx);

    const rotB = worldAngleAC - localAngleB;

    // Kiểm tra trường hợp Admin chấm ngược thứ tự B và C (B là cánh phụ, C là cánh chính)
    const diffDirect = Math.abs(Math.atan2(Math.sin(rotA - rotB), Math.cos(rotA - rotB)));
    const rotASwapped = worldAngleAC - localAngleA;
    const rotBSwapped = worldAngleAB - localAngleB;
    const diffSwapped = Math.abs(
      Math.atan2(Math.sin(rotASwapped - rotBSwapped), Math.cos(rotASwapped - rotBSwapped))
    );

    if (diffSwapped + 0.15 < diffDirect) {
      rotA = Math.atan2(
        Math.sin(rotASwapped) + Math.sin(rotBSwapped),
        Math.cos(rotASwapped) + Math.cos(rotBSwapped)
      );
    } else {
      rotA = Math.atan2(Math.sin(rotA) + Math.sin(rotB), Math.cos(rotA) + Math.cos(rotB));
    }
  }

  const rotationY = Number(rotA.toFixed(4));
  const snapped = computeCornerSnapAlignment({
    targetCornerWorld: pointA,
    anchorWorld,
    rotationY,
    scale,
    editAnchors,
  });

  return {
    offsetX: snapped.offsetX,
    offsetZ: snapped.offsetZ,
    rotationY,
  };
}

