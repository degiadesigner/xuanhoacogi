import React, { useEffect, useMemo, useState } from 'react';
import {
  Move,
  Box,
  RotateCcw,
  RotateCw,
  Check,
  X,
  Compass,
  Building2,
  Undo2,
  Eye,
  EyeOff,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Maximize2,
  SlidersHorizontal,
  GitCommitHorizontal,
} from 'lucide-react';
import { PlaceLocation } from '../../lib/map/map-types';
import { haversineDistanceMeters } from '../../lib/map/map-data';
import { XuanHoaMasterDataset as MasterGeographyDataset } from '../../lib/map/xuanhoa-master-data';
import { City3DOrigin } from './city3d/city3d-shared';
import {
  DEFAULT_LANDMARK_BINDINGS,
  LandmarkBindingRecord,
  LandmarkModelVisibilityMode,
  TWELVE_3D_LANDMARKS_LIST,
  Twelve3DLandmarkOption,
  getOrCreateLandmarkBindingForPlace,
  saveLandmarkBindingOverrideAsync,
  resetLandmarkBindingToDefaultAsync,
  executeAdminMovePlaceWithBindingSync,
  getLandmarkUndoSnapshot,
  undoLastLandmarkOrPlaceAction,
  previewSnapLandmarkToNearestBuilding,
  getLandmarkEditAnchors,
} from '../../lib/map/landmark-bindings';

export type DirectEditSubTool =
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'pick_corner'
  | 'three_point';

export interface LandmarkAdminControlsProps {
  place: PlaceLocation | null;
  mapMode: '2d' | '3d';
  activeMode: 'mode_a_place' | 'mode_b_model' | null;
  onChangeActiveMode: (mode: 'mode_a_place' | 'mode_b_model' | null) => void;
  /** Tọa độ mới đang được Admin chọn thử trên bản đồ (Mode A) trước khi bấm Lưu */
  pendingPlaceLatLng: { lat: number; lng: number } | null;
  onChangePendingPlaceLatLng: (coords: { lat: number; lng: number } | null) => void;
  /** Bản vá preview trực tiếp cho mô hình 3D (Mode B) trước khi bấm Lưu */
  previewBindingPatch: Partial<LandmarkBindingRecord> | null;
  onChangePreviewBindingPatch: (patch: Partial<LandmarkBindingRecord> | null) => void;
  masterDataset?: MasterGeographyDataset | null;
  origin3D?: City3DOrigin | null;
  adminIdentifier?: string;
  onSaved?: (message: string, newCoords?: { lat: number; lng: number }) => void;
  /** Công cụ con trong chế độ Direct Edit 3D (Phần 3–7) */
  subTool?: DirectEditSubTool;
  onChangeSubTool?: (tool: DirectEditSubTool) => void;
  /** Bước snap góc xoay (0 = Tự do, 5, 15, 45, 90) */
  rotateSnapDeg?: number;
  onChangeRotateSnapDeg?: (deg: number) => void;
  /** Trạng thái căn 3 điểm A-B-C (Phần 2) */
  threePointState?: {
    pointA: [number, number] | null;
    pointB: [number, number] | null;
    pointC: [number, number] | null;
  };
  onClearThreePoint?: () => void;
  /** Khi bấm Căn mô hình 3D từ bản đồ 2D -> tự chuyển sang 3D Direct Edit */
  onRequestOpen3DDirectEdit?: () => void;
  /** Chuyển nhanh giữa 12 Landmark 3D ngay trong thanh Direct Edit */
  onSelectLandmarkOption?: (opt: Twelve3DLandmarkOption) => void;
  /** Chế độ hiển thị: 'card_buttons' (trong popup địa danh) hoặc 'floating_toolbar' (thanh công cụ nổi dưới đáy) */
  variant?: 'card_buttons' | 'floating_toolbar';
}

const DEFAULT_ORIGIN: City3DOrigin = {
  lng: 105.7262,
  lat: 21.2812,
  kx: 103780,
  ky: 110720,
};

export const LandmarkAdminControls: React.FC<LandmarkAdminControlsProps> = ({
  place,
  mapMode,
  activeMode,
  onChangeActiveMode,
  pendingPlaceLatLng,
  onChangePendingPlaceLatLng,
  previewBindingPatch,
  onChangePreviewBindingPatch,
  masterDataset = null,
  origin3D = null,
  adminIdentifier = 'admin',
  onSaved,
  subTool = 'translate',
  onChangeSubTool,
  rotateSnapDeg = 0,
  onChangeRotateSnapDeg,
  threePointState,
  onClearThreePoint,
  onRequestOpen3DDirectEdit,
  onSelectLandmarkOption,
  variant = 'card_buttons',
}) => {
  const effectiveOrigin = origin3D || DEFAULT_ORIGIN;

  const [stepMeters, setStepMeters] = useState<1 | 5>(1);
  const [showFineTune, setShowFineTune] = useState(false);
  const [versionTick, setVersionTick] = useState(0);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [cloudSaveError, setCloudSaveError] = useState<string | null>(null);

  const baseBinding = useMemo(
    () =>
      place
        ? getOrCreateLandmarkBindingForPlace(place)
        : {
            landmarkId: '',
            label: 'Chưa chọn công trình 3D',
            placeId: '',
            anchorType: 'place' as const,
            offsetX: 0,
            offsetY: 0,
            offsetZ: 0,
            rotationY: 0,
            scale: 1,
            visible: true,
            modelVisibilityMode: 'follow_place' as const,
            updatedAt: 0,
          },
    [place?.id, place?.name, versionTick]
  );

  const workingBinding: LandmarkBindingRecord = useMemo(
    () => ({
      ...baseBinding,
      ...(previewBindingPatch || {}),
    }),
    [baseBinding, previewBindingPatch]
  );

  const editAnchors = useMemo(
    () => getLandmarkEditAnchors(workingBinding.landmarkId),
    [workingBinding.landmarkId]
  );

  const undoSnapshot = useMemo(
    () => (place ? getLandmarkUndoSnapshot(place.id) : null),
    [place?.id, versionTick, activeMode]
  );

  useEffect(() => {
    setShowFineTune(false);
    setCloudSaveError(null);
  }, [place?.id, activeMode]);

  const movedDistanceMeters = useMemo(() => {
    if (!place || !pendingPlaceLatLng || place.lat === null || place.lng === null) return 0;
    return haversineDistanceMeters(
      place.lat,
      place.lng,
      pendingPlaceLatLng.lat,
      pendingPlaceLatLng.lng
    );
  }, [place?.lat, place?.lng, pendingPlaceLatLng]);

  const nudgePlaceCoordsByMeters = (dEastMeters: number, dNorthMeters: number) => {
    const baseLat = pendingPlaceLatLng ? pendingPlaceLatLng.lat : place?.lat ?? effectiveOrigin.lat;
    const baseLng = pendingPlaceLatLng ? pendingPlaceLatLng.lng : place?.lng ?? effectiveOrigin.lng;
    const nextLat = Number((baseLat + dNorthMeters / effectiveOrigin.ky).toFixed(6));
    const nextLng = Number((baseLng + dEastMeters / effectiveOrigin.kx).toFixed(6));
    onChangePendingPlaceLatLng({ lat: nextLat, lng: nextLng });
  };

  const updateModelPatch = (partial: Partial<LandmarkBindingRecord>) => {
    setCloudSaveError(null);
    const merged: Partial<LandmarkBindingRecord> = {
      offsetX: workingBinding.offsetX,
      offsetY: workingBinding.offsetY,
      offsetZ: workingBinding.offsetZ,
      rotationY: workingBinding.rotationY,
      scale: workingBinding.scale,
      anchorType: workingBinding.anchorType,
      buildingId: workingBinding.buildingId,
      visible: workingBinding.visible,
      modelVisibilityMode: workingBinding.modelVisibilityMode,
      ...partial,
    };
    onChangePreviewBindingPatch(merged);
  };

  const handleConfirmMovePlace = () => {
    if (!place || !pendingPlaceLatLng) {
      onChangeActiveMode(null);
      return;
    }
    const res = executeAdminMovePlaceWithBindingSync({
      place,
      newLat: pendingPlaceLatLng.lat,
      newLng: pendingPlaceLatLng.lng,
      updatedBy: adminIdentifier,
    });
    onChangePendingPlaceLatLng(null);
    onChangeActiveMode(null);
    setVersionTick((v) => v + 1);
    onSaved?.(
      `Đã di chuyển "${place.name}" sang (${res.newLat}, ${res.newLng}) — dịch ${res.movedMeters}m. Ghim 2D/3D & Model 3D đã đồng bộ!`,
      { lat: res.newLat, lng: res.newLng }
    );
  };

  const handleCancelMovePlace = () => {
    onChangePendingPlaceLatLng(null);
    onChangeActiveMode(null);
  };

  const handleSaveModelAlignment = async () => {
    if (!place || isSavingCloud) return;
    setIsSavingCloud(true);
    setCloudSaveError(null);
    try {
      const res = await saveLandmarkBindingOverrideAsync(
        place.id,
        place.name,
        workingBinding,
        adminIdentifier,
        'align_model',
        true
      );
      if (!res.ok || !res.cloudSaved) {
        const errText = `Không ghi được lên Firebase (${res.error || 'PERMISSION_DENIED'}). Cấu hình chưa được đồng bộ đám mây!`;
        setCloudSaveError(errText);
        onSaved?.(`❌ ${errText}`);
        return;
      }
      const saved = res.record;
      onChangePreviewBindingPatch(null);
      onClearThreePoint?.();
      onChangeActiveMode(null);
      setVersionTick((v) => v + 1);
      onSaved?.(
        `Đã lưu lên Firebase căn mô hình 3D "${place.name}" (Offset X=${saved.offsetX}m, Y=${saved.offsetY}m, Z=${saved.offsetZ}m, Xoay=${Math.round(
          (saved.rotationY * 180) / Math.PI
        )}°, Scale=${saved.scale.toFixed(2)}x, Hiển thị=${saved.visible ? 'Hiện' : 'Ẩn'}). Tọa độ địa danh giữ nguyên!`
      );
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleCancelModelAlignment = () => {
    setCloudSaveError(null);
    onChangePreviewBindingPatch(null);
    onClearThreePoint?.();
    onChangeActiveMode(null);
  };

  const handleSnapEdgeAndRotation = () => {
    if (!place) return;
    const preview = previewSnapLandmarkToNearestBuilding({
      place,
      masterDataset,
      origin: effectiveOrigin,
    });
    if (preview) {
      updateModelPatch({
        rotationY: preview.suggestedRotationY,
        buildingId: preview.building.id,
      });
    } else {
      onSaved?.('Không tìm thấy cạnh đường / công trình gần đây để snap hướng.');
    }
  };

  const handleSnapIntoBuildingFootprint = () => {
    if (!place) return;
    const preview = previewSnapLandmarkToNearestBuilding({
      place,
      masterDataset,
      origin: effectiveOrigin,
    });
    if (preview) {
      updateModelPatch({
        offsetX: preview.suggestedOffsetX,
        offsetZ: preview.suggestedOffsetZ,
        rotationY: preview.suggestedRotationY,
        buildingId: preview.building.id,
      });
    } else {
      onSaved?.('Không tìm thấy footprint công trình nào trong bán kính 180m.');
    }
  };

  const handleUndo = () => {
    if (!place) return;
    const res = undoLastLandmarkOrPlaceAction(place.id, place.name, adminIdentifier);
    onChangePendingPlaceLatLng(null);
    onChangePreviewBindingPatch(null);
    onClearThreePoint?.();
    setVersionTick((v) => v + 1);
    if (res) {
      onSaved?.(
        res.mode === 'mode_a_place'
          ? `Đã hoàn tác di chuyển địa danh "${place.name}" về (${res.restoredLat}, ${res.restoredLng}).`
          : `Đã hoàn tác căn chỉnh mô hình 3D "${place.name}".`,
        res.restoredLat && res.restoredLng
          ? { lat: res.restoredLat, lng: res.restoredLng }
          : undefined
      );
    }
  };

  const handleResetDefault = async () => {
    if (!place || isSavingCloud) return;
    setCloudSaveError(null);
    const defaultBind = DEFAULT_LANDMARK_BINDINGS[workingBinding.landmarkId];
    const targetPatch: Partial<LandmarkBindingRecord> = defaultBind
      ? {
          anchorType: defaultBind.anchorType,
          offsetX: defaultBind.offsetX,
          offsetY: defaultBind.offsetY,
          offsetZ: defaultBind.offsetZ,
          rotationY: defaultBind.rotationY,
          scale: defaultBind.scale,
          visible: defaultBind.visible,
          modelVisibilityMode: defaultBind.modelVisibilityMode,
        }
      : {
          anchorType: 'place',
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
          rotationY: 0,
          scale: 1,
          visible: true,
          modelVisibilityMode: 'follow_place',
        };
    onChangePreviewBindingPatch(targetPatch);
    onClearThreePoint?.();
    setIsSavingCloud(true);
    try {
      const res = await resetLandmarkBindingToDefaultAsync(place.id, place.name, adminIdentifier);
      if (!res.ok || !res.cloudSaved) {
        const errText = `Không ghi được mặc định lên Firebase (${res.error || 'PERMISSION_DENIED'}).`;
        setCloudSaveError(errText);
        onSaved?.(`❌ ${errText}`);
        return;
      }
      setVersionTick((v) => v + 1);
      onSaved?.(`Đã khôi phục mặc định mô hình 3D "${place.name}" trên Firebase!`);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const rotDegrees = Math.round((workingBinding.rotationY * 180) / Math.PI);

  // ============================================================================
  // VARIANT 1: NÚT TRONG THẺ ĐỊA DANH (CARD BUTTONS) — BẤM LÀ ĐÓNG POPUP & VÀO DIRECT EDIT
  // ============================================================================
  if (variant === 'card_buttons') {
    if (!place) return null;
    return (
      <div
        data-testid="landmark-admin-controls"
        className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/90 p-2 text-slate-800"
      >
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Chỉnh trực tiếp trên bản đồ
          </span>
          {undoSnapshot && (
            <button
              type="button"
              data-testid="landmark-undo-btn"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Hoàn tác 1 bước vừa lưu"
            >
              <Undo2 className="w-3 h-3" />
              Hoàn tác
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="admin-mode-a-btn"
            onClick={() => {
              onChangePreviewBindingPatch(null);
              onChangeActiveMode('mode_a_place');
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white hover:bg-emerald-50 text-slate-800 border border-slate-200 hover:border-emerald-300 px-2.5 py-1.5 text-[11.5px] font-semibold transition cursor-pointer shadow-2xs"
          >
            <Move className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Di chuyển địa danh</span>
          </button>

          <button
            type="button"
            data-testid="admin-mode-b-btn"
            onClick={() => {
              onChangePendingPlaceLatLng(null);
              if (mapMode === '2d' && onRequestOpen3DDirectEdit) {
                onRequestOpen3DDirectEdit();
              } else {
                onChangeActiveMode('mode_b_model');
              }
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white hover:bg-blue-50 text-slate-800 border border-slate-200 hover:border-blue-300 px-2.5 py-1.5 text-[11.5px] font-semibold transition cursor-pointer shadow-2xs"
          >
            <Box className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Căn mô hình 3D</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VARIANT 2: FLOATING DIRECT EDIT TOOLBAR (THAY THẾ THANH ADMIN DƯỚI ĐÁY)
  // ============================================================================
  if (activeMode === 'mode_a_place') {
    if (!place) return null;
    return (
      <div
        data-testid="landmark-mode-a-panel"
        className="w-full max-w-xl mx-auto rounded-2xl border border-emerald-500/40 bg-[#0F172A]/95 text-white shadow-[0_12px_36px_rgba(15,23,42,0.38)] backdrop-blur-md p-2.5 space-y-2 pointer-events-auto"
      >
        {/* Hàng trên: Trạng thái & Khoảng cách trực tiếp */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Move className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Di chuyển địa danh: {place.name}</span>
            </div>
            <div className="text-[10.5px] text-slate-300 truncate mt-0.5">
              {pendingPlaceLatLng ? (
                <span>
                  <span className="font-mono text-slate-400" data-testid="mode-a-old-coords">
                    {place.lat?.toFixed(5)}, {place.lng?.toFixed(5)}
                  </span>
                  {' → '}
                  <span className="font-mono font-bold text-emerald-300" data-testid="mode-a-new-coords">
                    {pendingPlaceLatLng.lat.toFixed(5)}, {pendingPlaceLatLng.lng.toFixed(5)}
                  </span>
                </span>
              ) : (
                <span>
                  {mapMode === '3d'
                    ? 'Chạm hoặc kéo trực tiếp trên mặt đất 3D để đặt vị trí mới'
                    : 'Chạm trực tiếp trên bản đồ 2D để đặt vị trí mới'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {pendingPlaceLatLng && (
              <span
                data-testid="mode-a-distance-meters"
                className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10.5px] font-bold text-emerald-300 whitespace-nowrap"
              >
                {movedDistanceMeters} m
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowFineTune((v) => !v)}
              className={`h-7 px-2 rounded-lg text-[10.5px] font-semibold border transition cursor-pointer flex items-center gap-1 ${
                showFineTune
                  ? 'bg-slate-700 text-white border-slate-500'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Tinh chỉnh</span>
            </button>
          </div>
        </div>

        {/* Ngăn tinh chỉnh phụ (ẩn mặc định để gọn) */}
        {showFineTune && (
          <div className="flex items-center justify-between gap-1.5 rounded-xl bg-slate-800/90 px-2.5 py-1.5 border border-slate-700 text-[11px]">
            <span className="text-slate-300 font-medium">Dịch nhanh:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="mode-a-nudge-west"
                onClick={() => nudgePlaceCoordsByMeters(-10, 0)}
                className="rounded bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[10.5px] font-semibold cursor-pointer"
              >
                ← 10m
              </button>
              <button
                type="button"
                data-testid="mode-a-nudge-east"
                onClick={() => nudgePlaceCoordsByMeters(10, 0)}
                className="rounded bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[10.5px] font-semibold cursor-pointer"
              >
                10m →
              </button>
              <button
                type="button"
                data-testid="mode-a-nudge-north"
                onClick={() => nudgePlaceCoordsByMeters(0, 10)}
                className="rounded bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[10.5px] font-semibold cursor-pointer"
              >
                ↑ 10m
              </button>
              <button
                type="button"
                data-testid="mode-a-nudge-south"
                onClick={() => nudgePlaceCoordsByMeters(0, -10)}
                className="rounded bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[10.5px] font-semibold cursor-pointer"
              >
                ↓ 10m
              </button>
              <button
                type="button"
                data-testid="mode-a-nudge-50m"
                onClick={() => nudgePlaceCoordsByMeters(35.35, 35.35)}
                className="rounded bg-emerald-700/80 hover:bg-emerald-600 px-2 py-1 text-[10.5px] font-bold text-white cursor-pointer"
              >
                +50m
              </button>
            </div>
          </div>
        )}

        {/* Thanh nút chính: Hủy | Xác nhận vị trí */}
        <div
          data-testid="mode-a-confirm-box"
          className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800"
        >
          <button
            type="button"
            data-testid="mode-a-cancel-btn"
            onClick={handleCancelMovePlace}
            className="h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5" />
            <span>Hủy</span>
          </button>

          <div className="text-[10.5px] text-slate-400 hidden sm:block">
            Pin 2D + Pin 3D + Nhãn + Model đi cùng nhau
          </div>

          <button
            type="button"
            data-testid="mode-a-save-btn"
            disabled={!pendingPlaceLatLng}
            onClick={handleConfirmMovePlace}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm cursor-pointer transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Xác nhận vị trí</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE B: FLOATING DIRECT EDIT 3D TOOLBAR (CHẠM -> KÉO -> XOAY -> SCALE -> OK/HỦY)
  // ============================================================================
  if (activeMode === 'mode_b_model') {
    if (!place) {
      return (
        <div
          data-testid="landmark-mode-b-panel"
          className="w-full max-w-xl mx-auto rounded-2xl border border-blue-500/40 bg-[#0F172A]/95 text-white shadow-[0_12px_36px_rgba(15,23,42,0.42)] backdrop-blur-md p-2.5 sm:p-3 space-y-2 pointer-events-auto"
        >
          <div
            data-testid="landmark-mode-b-empty-prompt"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Box className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-blue-200">
                Chọn công trình 3D để căn chỉnh (hoặc chạm trực tiếp vào mô hình 3D trên bản đồ):
              </span>
            </div>
            <button
              type="button"
              data-testid="mode-b-cancel-btn"
              onClick={handleCancelModelAlignment}
              className="h-7 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-semibold text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Đóng</span>
            </button>
          </div>
          {onSelectLandmarkOption && (
            <div className="flex items-center gap-2">
              <select
                data-testid="mode-b-landmark-select"
                value=""
                onChange={(e) => {
                  const chosen = TWELVE_3D_LANDMARKS_LIST.find(
                    (item) => item.landmarkId === e.target.value
                  );
                  if (chosen) {
                    setCloudSaveError(null);
                    onChangePreviewBindingPatch(null);
                    onSelectLandmarkOption(chosen);
                  }
                }}
                className="w-full rounded-xl bg-slate-800 border border-blue-500/60 px-2.5 py-2 text-xs font-bold text-blue-200 cursor-pointer"
              >
                <option value="">-- Chọn 1 trong 12 công trình 3D để bắt đầu căn chỉnh --</option>
                {TWELVE_3D_LANDMARKS_LIST.map((item, idx) => (
                  <option key={item.landmarkId} value={item.landmarkId}>
                    {idx + 1}. {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      );
    }

    const nextThreePtLabel = !threePointState?.pointA
      ? 'Chạm Điểm A (Góc công trình / Mái vòm)'
      : !threePointState?.pointB
      ? 'Chạm Điểm B (Hướng mặt tiền thứ 1)'
      : !threePointState?.pointC
      ? 'Chạm Điểm C (Hướng mặt tiền thứ 2)'
      : 'Đã căn xong 3 điểm A–B–C (Chạm lại để chọn mới)';

    return (
      <div
        data-testid="landmark-mode-b-panel"
        className="w-full max-w-2xl mx-auto rounded-2xl border border-blue-500/40 bg-[#0F172A]/95 text-white shadow-[0_12px_36px_rgba(15,23,42,0.42)] backdrop-blur-md p-2 sm:p-2.5 space-y-1.5 sm:space-y-2 pointer-events-auto overflow-hidden"
      >
        {/* Banner báo lỗi khi ghi Firebase thất bại — không bao giờ báo lưu thành công giả */}
        {cloudSaveError && (
          <div
            data-testid="mode-b-save-error"
            className="rounded-xl bg-rose-500/20 border border-rose-400/60 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 flex items-center justify-between gap-2"
          >
            <span className="min-w-0 flex-1">⚠️ {cloudSaveError}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="mode-b-retry-save-btn"
                disabled={isSavingCloud}
                onClick={handleSaveModelAlignment}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 px-2 py-0.5 text-[10.5px] font-bold text-white cursor-pointer"
              >
                Thử lưu lại
              </button>
              <button
                type="button"
                onClick={() => setCloudSaveError(null)}
                className="text-[10.5px] underline text-rose-300 shrink-0 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* Dòng 1: Chọn nhanh 12 Landmark + Thông số Live & Các chế độ Căn Nhanh */}
        <div className="flex flex-wrap items-center justify-between gap-1 px-0.5">
          <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-1.5 text-[11px] min-w-0">
            {onSelectLandmarkOption ? (
              <select
                data-testid="mode-b-landmark-select"
                value={workingBinding.landmarkId}
                onChange={(e) => {
                  const chosen = TWELVE_3D_LANDMARKS_LIST.find(
                    (item) => item.landmarkId === e.target.value
                  );
                  if (chosen) {
                    setCloudSaveError(null);
                    onChangePreviewBindingPatch(null);
                    onSelectLandmarkOption(chosen);
                  }
                }}
                className="max-w-[145px] sm:max-w-[195px] rounded-lg bg-slate-800 border border-blue-500/50 px-1.5 py-0.5 text-[11px] font-bold text-blue-300 truncate cursor-pointer"
                title="Chọn bất kỳ 1 trong 12 công trình 3D để căn chỉnh"
              >
                {TWELVE_3D_LANDMARKS_LIST.map((item, idx) => (
                  <option key={item.landmarkId} value={item.landmarkId}>
                    {idx + 1}. {item.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-blue-400 truncate max-w-[125px] sm:max-w-[200px]">
                {place.name}
              </span>
            )}
            <div className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg bg-slate-800/90 border border-slate-700 px-1.5 sm:px-2 py-0.5 font-mono text-[10px] sm:text-[10.5px] text-slate-200 shrink-0">
              <span>
                X:<strong data-testid="mode-b-offset-x">{workingBinding.offsetX}m</strong>
              </span>
              <span className="text-slate-600">·</span>
              <span>
                Z:<strong data-testid="mode-b-offset-z">{workingBinding.offsetZ}m</strong>
              </span>
              <span className="text-slate-600">·</span>
              <span>
                Y:<strong data-testid="mode-b-offset-y">{workingBinding.offsetY}m</strong>
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong data-testid="mode-b-rotation">{rotDegrees}°</strong>
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong data-testid="mode-b-scale">{workingBinding.scale.toFixed(2)}x</strong>
              </span>
            </div>
          </div>

          {/* Các nút hỗ trợ căn thông minh (Phần 2, 23, 24) + Bật/tắt hiển thị */}
          <div className="flex items-center gap-1 w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              data-testid="mode-b-toggle-visible-btn"
              onClick={() => {
                const nextVisible = !workingBinding.visible;
                updateModelPatch({
                  visible: nextVisible,
                  modelVisibilityMode: nextVisible
                    ? workingBinding.modelVisibilityMode === 'manual'
                      ? 'follow_place'
                      : workingBinding.modelVisibilityMode
                    : 'manual',
                });
              }}
              className={`h-6 sm:h-7 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[10.5px] font-semibold border whitespace-nowrap flex items-center gap-1 cursor-pointer transition ${
                workingBinding.visible
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-rose-500/25 text-rose-200 border-rose-400/60 hover:bg-rose-500/35'
              }`}
              title="Bật / tắt hiển thị mô hình 3D"
            >
              {workingBinding.visible ? (
                <>
                  <Eye className="w-3 h-3 shrink-0" />
                  <span data-testid="mode-b-visible-state">Hiện</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 shrink-0" />
                  <span data-testid="mode-b-visible-state">Ẩn</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="mode-b-tool-corner"
              onClick={() =>
                onChangeSubTool?.(subTool === 'pick_corner' ? 'translate' : 'pick_corner')
              }
              className={`h-6 sm:h-7 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[10.5px] font-semibold border whitespace-nowrap flex items-center gap-1 cursor-pointer transition ${
                subTool === 'pick_corner'
                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
              title={`Chạm 1 điểm trên mặt đất để đặt ${editAnchors.primaryCorner.label} vào đúng điểm đó`}
            >
              <Crosshair className="w-3 h-3 shrink-0" />
              <span>
                Đặt góc<span className="hidden sm:inline"> tại đây</span>
              </span>
            </button>

            <button
              type="button"
              data-testid="mode-b-tool-three-point"
              onClick={() => {
                if (subTool === 'three_point') {
                  onChangeSubTool?.('translate');
                } else {
                  onClearThreePoint?.();
                  onChangeSubTool?.('three_point');
                }
              }}
              className={`h-6 sm:h-7 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[10.5px] font-semibold border whitespace-nowrap flex items-center gap-1 cursor-pointer transition ${
                subTool === 'three_point'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
              }`}
              title="Căn theo 3 điểm: A (góc chính) -> B (hướng mặt tiền 1) -> C (hướng mặt tiền 2)"
            >
              <GitCommitHorizontal className="w-3 h-3 shrink-0" />
              <span>Căn 3 điểm A-B-C</span>
            </button>

            <button
              type="button"
              data-testid="mode-b-align-rotation-btn"
              onClick={handleSnapEdgeAndRotation}
              className="h-6 sm:h-7 px-1.5 sm:px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[10px] sm:text-[10.5px] font-semibold whitespace-nowrap flex items-center gap-1 cursor-pointer transition"
              title="Tự động xoay song song với cạnh mặt đường / tòa nhà gần nhất"
            >
              <Compass className="w-3 h-3 shrink-0" />
              <span>
                Snap<span className="hidden sm:inline"> cạnh</span> đường
              </span>
            </button>

            <button
              type="button"
              data-testid="mode-b-toggle-fine-tune"
              onClick={() => setShowFineTune((v) => !v)}
              className={`h-6 sm:h-7 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[10.5px] font-semibold border whitespace-nowrap flex items-center gap-1 cursor-pointer transition ${
                showFineTune
                  ? 'bg-slate-700 text-white border-slate-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Mở bảng tinh chỉnh từng mét / độ"
            >
              <SlidersHorizontal className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Hướng dẫn ngữ cảnh theo công cụ đang chọn */}
        {subTool === 'pick_corner' && (
          <div className="rounded-xl bg-amber-500/20 border border-amber-400/50 px-2.5 py-1 text-[11px] font-semibold text-amber-200 flex items-center justify-between">
            <span>
              Chạm vào góc giao đường trên bản đồ để đặt <strong>{editAnchors.primaryCorner.label}</strong> vào đúng điểm đó.
            </span>
            <button
              type="button"
              onClick={() => onChangeSubTool?.('translate')}
              className="text-[10.5px] underline text-amber-300 ml-2 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {subTool === 'three_point' && (
          <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 flex items-center justify-between gap-2">
            <span>🎯 {nextThreePtLabel}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onClearThreePoint?.()}
                className="rounded bg-emerald-900/70 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-800 cursor-pointer"
              >
                Chọn lại A-B-C
              </button>
            </div>
          </div>
        )}

        {/* Tùy chọn phụ khi đang ở chế độ Xoay hoặc Scale */}
        {subTool === 'rotate' && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/85 px-2.5 py-1 border border-slate-700 text-[10.5px]">
            <span className="text-slate-300">
              Kéo vòng tròn vàng quanh công trình để xoay trực tiếp:
            </span>
            <div className="flex items-center gap-1">
              {[
                { deg: 0, label: 'Tự do' },
                { deg: 5, label: '5°' },
                { deg: 15, label: '15°' },
                { deg: 45, label: '45°' },
                { deg: 90, label: '90°' },
              ].map((item) => (
                <button
                  key={item.deg}
                  type="button"
                  onClick={() => onChangeRotateSnapDeg?.(item.deg)}
                  className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                    rotateSnapDeg === item.deg
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {subTool === 'scale' && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/85 px-2.5 py-1 border border-slate-700 text-[10.5px]">
            <span className="text-slate-300">
              Kéo trên mặt đất để thu phóng đồng đều (Uniform Scale):
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="mode-b-scale-down-btn"
                onClick={() =>
                  updateModelPatch({
                    scale: Math.max(0.25, Number((workingBinding.scale - 0.05).toFixed(2))),
                  })
                }
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-bold text-white cursor-pointer"
              >
                -0.05
              </button>
              <button
                type="button"
                data-testid="mode-b-scale-reset-btn"
                onClick={() => updateModelPatch({ scale: 1.0 })}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-semibold text-slate-200 cursor-pointer"
              >
                1.0x
              </button>
              <button
                type="button"
                data-testid="mode-b-scale-up-btn"
                onClick={() =>
                  updateModelPatch({
                    scale: Math.min(3.5, Number((workingBinding.scale + 0.05).toFixed(2))),
                  })
                }
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-bold text-white cursor-pointer"
              >
                +0.05
              </button>
            </div>
          </div>
        )}

        {/* Ngăn Tinh chỉnh số học (ẩn mặc định, mở khi bấm icon Sliders) */}
        {showFineTune && (
          <div className="rounded-xl bg-slate-800/95 border border-slate-700 p-2 space-y-1.5 text-[10.5px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">Bước dịch:</span>
                <button
                  type="button"
                  onClick={() => setStepMeters(1)}
                  className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                    stepMeters === 1 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  1m
                </button>
                <button
                  type="button"
                  onClick={() => setStepMeters(5)}
                  className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                    stepMeters === 5 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  5m
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="mode-b-left-btn"
                  onClick={() =>
                    updateModelPatch({ offsetX: Number((workingBinding.offsetX - stepMeters).toFixed(2)) })
                  }
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer"
                  title="Dịch trái (-X)"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="mode-b-right-btn"
                  onClick={() =>
                    updateModelPatch({ offsetX: Number((workingBinding.offsetX + stepMeters).toFixed(2)) })
                  }
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer"
                  title="Dịch phải (+X)"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="mode-b-up-btn"
                  onClick={() =>
                    updateModelPatch({ offsetZ: Number((workingBinding.offsetZ - stepMeters).toFixed(2)) })
                  }
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer"
                  title="Dịch Bắc (-Z)"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="mode-b-down-btn"
                  onClick={() =>
                    updateModelPatch({ offsetZ: Number((workingBinding.offsetZ + stepMeters).toFixed(2)) })
                  }
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer"
                  title="Dịch Nam (+Z)"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="mode-b-shift-10m-btn"
                  onClick={() =>
                    updateModelPatch({ offsetX: Number((workingBinding.offsetX + 10).toFixed(2)) })
                  }
                  className="px-1.5 py-0.5 rounded bg-blue-600/80 hover:bg-blue-600 font-bold text-white cursor-pointer"
                >
                  +10m
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="mode-b-rot-ccw-btn"
                  onClick={() =>
                    updateModelPatch({
                      rotationY: Number((workingBinding.rotationY - (5 * Math.PI) / 180).toFixed(4)),
                    })
                  }
                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-bold cursor-pointer"
                >
                  -5°
                </button>
                <button
                  type="button"
                  data-testid="mode-b-rot-cw-btn"
                  onClick={() =>
                    updateModelPatch({
                      rotationY: Number((workingBinding.rotationY + (5 * Math.PI) / 180).toFixed(4)),
                    })
                  }
                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-bold cursor-pointer"
                >
                  +5°
                </button>
                <button
                  type="button"
                  data-testid="mode-b-snap-building-btn"
                  onClick={handleSnapIntoBuildingFootprint}
                  className="px-2 py-0.5 rounded bg-indigo-600/80 hover:bg-indigo-600 font-semibold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Building2 className="w-3 h-3" />
                  <span>Snap lô đất</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/80">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Cao độ Y ({workingBinding.offsetY}m):</span>
                <button
                  type="button"
                  data-testid="mode-b-y-down-btn"
                  onClick={() =>
                    updateModelPatch({ offsetY: Number((workingBinding.offsetY - 0.5).toFixed(2)) })
                  }
                  className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-bold cursor-pointer"
                >
                  -0.5m
                </button>
                <button
                  type="button"
                  data-testid="mode-b-y-up-btn"
                  onClick={() =>
                    updateModelPatch({ offsetY: Number((workingBinding.offsetY + 0.5).toFixed(2)) })
                  }
                  className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-bold cursor-pointer"
                >
                  +0.5m
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-slate-400" />
                <select
                  data-testid="mode-b-visibility-mode-select"
                  value={workingBinding.modelVisibilityMode}
                  onChange={(e) =>
                    updateModelPatch({
                      modelVisibilityMode: e.target.value as LandmarkModelVisibilityMode,
                    })
                  }
                  className="rounded bg-slate-700 border border-slate-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                >
                  <option value="follow_place">Theo trạng thái Địa danh</option>
                  <option value="always">Luôn hiện Model 3D</option>
                  <option value="manual">Ẩn/Hiện thủ công</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Dòng 2 (THANH CÔNG CỤ CHÍNH — Phần 7): Hủy | Di chuyển | Xoay | Scale | Reset | ✓ Hoàn tất */}
        <div
          data-testid="direct-edit-toolbar"
          className="flex items-center justify-between gap-1 sm:gap-1.5 pt-1 border-t border-slate-800"
        >
          <button
            type="button"
            data-testid="mode-b-cancel-btn"
            disabled={isSavingCloud}
            onClick={handleCancelModelAlignment}
            className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-[11px] sm:text-xs font-semibold text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5 shrink-0" />
            <span>Hủy</span>
          </button>

          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900/90 p-0.5 sm:p-1 rounded-xl border border-slate-800 min-w-0">
            <button
              type="button"
              data-testid="mode-b-tool-translate"
              onClick={() => onChangeSubTool?.('translate')}
              className={`h-7 px-1.5 sm:px-2.5 rounded-lg text-[10.5px] sm:text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer transition whitespace-nowrap ${
                subTool === 'translate'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Move className="hidden sm:block w-3.5 h-3.5 shrink-0" />
              <span>Di chuyển</span>
            </button>

            <button
              type="button"
              data-testid="mode-b-tool-rotate"
              onClick={() => onChangeSubTool?.('rotate')}
              className={`h-7 px-1.5 sm:px-2.5 rounded-lg text-[10.5px] sm:text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer transition whitespace-nowrap ${
                subTool === 'rotate'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <RotateCw className="hidden sm:block w-3.5 h-3.5 shrink-0" />
              <span>Xoay</span>
            </button>

            <button
              type="button"
              data-testid="mode-b-tool-scale"
              onClick={() => onChangeSubTool?.('scale')}
              className={`h-7 px-1.5 sm:px-2.5 rounded-lg text-[10.5px] sm:text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer transition whitespace-nowrap ${
                subTool === 'scale'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Maximize2 className="hidden sm:block w-3.5 h-3.5 shrink-0" />
              <span>Scale</span>
            </button>

            <button
              type="button"
              data-testid="mode-b-reset-btn"
              disabled={isSavingCloud}
              onClick={handleResetDefault}
              className="h-7 px-1.5 sm:px-2.5 rounded-lg text-[10.5px] sm:text-[11.5px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
              title="Reset về vị trí mặc định chuẩn"
            >
              <RotateCcw className="hidden sm:block w-3.5 h-3.5 shrink-0" />
              <span>Reset</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="mode-b-save-btn"
            disabled={isSavingCloud}
            onClick={handleSaveModelAlignment}
            className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[11px] sm:text-xs font-bold text-white flex items-center gap-1 shrink-0 shadow-sm cursor-pointer transition"
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{isSavingCloud ? 'Đang lưu...' : 'Hoàn tất'}</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
