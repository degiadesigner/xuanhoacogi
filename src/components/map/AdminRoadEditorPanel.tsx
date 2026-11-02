import React, { useState, useEffect, useMemo } from 'react';
import {
  Route,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  PenTool,
  Scissors,
  GitMerge,
  Undo2,
  X,
  Check,
  Navigation,
  ShieldCheck,
  Move,
  Plus,
  Trash2,
  Eye,
} from 'lucide-react';
import {
  type RoadRecord,
  type RoadHierarchyClass,
  type RoadType,
  type RoadVerificationStatus,
  type RoadAuditIssue,
  ROAD_CLASS_LABELS,
  ROAD_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  mapRoadClassToDefaultRoadType,
  saveAdminRoadOverride,
  createOrRedrawAdminRoad,
  splitAdminRoadSegment,
  snapAlleyGeometryToParentRoad,
  computePolylineLengthMeters,
  parseParentRoadFromAlleyName,
  moveRoadVertex,
  insertRoadVertexAtSegmentMidpoint,
  deleteRoadVertex,
} from '@/lib/map/xuanhoa-road-overrides';

interface AdminRoadEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRoad: RoadRecord | null;
  allRoadsMap: Map<string, RoadRecord>;
  auditIssues: RoadAuditIssue[];
  isDrawingMode: boolean;
  drawingPoints: [number, number][];
  isRedrawingExisting: boolean;
  isMergingSecondRoad: boolean;
  onStartDrawNewAlley: () => void;
  onStartRedrawSelectedRoad: () => void;
  onUndoLastDrawPoint: () => void;
  onCancelDrawing: () => void;
  onStartMergeMode: () => void;
  onCancelMergeMode: () => void;
  onSelectRoadById: (roadId: string, flyTo?: boolean) => void;
  onFlyToLngLat: (lng: number, lat: number, zoom?: number) => void;
  onNotifyToast?: (msg: string) => void;
  /** Optional live node-editing state synced with 2D Canvas */
  draftGeometry?: [number, number][] | null;
  selectedVertexIndex?: number;
  onChangeDraftGeometry?: (
    geom: [number, number][] | null,
    selectedVertexIdx?: number
  ) => void;
}

export const AdminRoadEditorPanel: React.FC<AdminRoadEditorPanelProps> = ({
  isOpen,
  onClose,
  selectedRoad,
  allRoadsMap,
  auditIssues,
  isDrawingMode,
  drawingPoints,
  isRedrawingExisting,
  isMergingSecondRoad,
  onStartDrawNewAlley,
  onStartRedrawSelectedRoad,
  onUndoLastDrawPoint,
  onCancelDrawing,
  onStartMergeMode,
  onCancelMergeMode,
  onSelectRoadById,
  onFlyToLngLat,
  onNotifyToast,
  draftGeometry: externalDraftGeometry,
  selectedVertexIndex: externalSelectedVertexIndex,
  onChangeDraftGeometry,
}) => {
  const [activeTab, setActiveTab] = useState<'inspect' | 'geometry' | 'draw' | 'audit'>('inspect');

  // State cho Quick Admin Edit (Mục 20)
  const [editName, setEditName] = useState('');
  const [editRoadClass, setEditRoadClass] = useState<RoadHierarchyClass>('alley');
  const [editRoadType, setEditRoadType] = useState<RoadType>('alley');
  const [editParentRoad, setEditParentRoad] = useState('');
  const [editLocked, setEditLocked] = useState(true);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  const classSelectRef = React.useRef<HTMLSelectElement | null>(null);

  // State cho Chỉnh sửa trực tiếp hình học đường (Mục 21: kéo node / thêm node / xóa node / tách đoạn / undo)
  const [localDraftGeom, setLocalDraftGeom] = useState<[number, number][] | null>(null);
  const [geomHistory, setGeomHistory] = useState<[number, number][][]>([]);
  const [localVertexIdx, setLocalVertexIdx] = useState<number>(0);
  const [isPreviewingGeom, setIsPreviewingGeom] = useState<boolean>(false);

  const activeDraftGeom =
    externalDraftGeometry !== undefined ? externalDraftGeometry : localDraftGeom;
  const activeVertexIdx =
    externalSelectedVertexIndex !== undefined ? externalSelectedVertexIndex : localVertexIdx;

  const updateDraftGeom = (
    nextGeom: [number, number][] | null,
    nextVertexIdx = activeVertexIdx,
    pushUndo = true
  ) => {
    if (pushUndo && activeDraftGeom && nextGeom) {
      setGeomHistory((prev) => [...prev.slice(-19), activeDraftGeom]);
    }
    setLocalDraftGeom(nextGeom);
    setLocalVertexIdx(nextVertexIdx);
    onChangeDraftGeometry?.(nextGeom, nextVertexIdx);
  };

  // State cho tab Vẽ ngõ trực tiếp
  const [drawName, setDrawName] = useState('Ngõ 29 Nguyễn Văn Linh');
  const [drawRoadClass, setDrawRoadClass] = useState<RoadHierarchyClass>('alley');
  const [drawRoadType, setDrawRoadType] = useState<RoadType>('alley');
  const [drawParentRoad, setDrawParentRoad] = useState('Đường Nguyễn Văn Linh');

  useEffect(() => {
    if (selectedRoad) {
      setEditName(selectedRoad.name || '');
      setEditRoadClass(selectedRoad.roadClass || 'local');
      setEditRoadType(selectedRoad.roadType || 'local_road');
      setEditParentRoad(
        selectedRoad.parentRoad ||
          parseParentRoadFromAlleyName(selectedRoad.name || '') ||
          ''
      );
      setEditLocked(Boolean(selectedRoad.locked));
      setGeomHistory([]);
      setIsPreviewingGeom(false);
      if (activeTab === 'geometry') {
        updateDraftGeom(
          selectedRoad.geometry.map((pt) => [pt[0], pt[1]]),
          0,
          false
        );
      } else {
        updateDraftGeom(null, 0, false);
        if (!isDrawingMode) {
          setActiveTab('inspect');
        }
      }
    }
  }, [selectedRoad?.roadId]);

  useEffect(() => {
    if (isDrawingMode) {
      setActiveTab('draw');
      if (isRedrawingExisting && selectedRoad) {
        setDrawName(selectedRoad.name || '');
        setDrawRoadClass(selectedRoad.roadClass || 'alley');
        setDrawRoadType(selectedRoad.roadType || 'alley');
        setDrawParentRoad(selectedRoad.parentRoad || '');
      }
    }
  }, [isDrawingMode, isRedrawingExisting, selectedRoad]);

  // Thống kê phân cấp 5 bậc toàn phường (Mục 19 & 28)
  const hierarchyCounts = useMemo(() => {
    const counts = {
      total: 0,
      major: 0,
      arterial: 0,
      local: 0,
      alley: 0,
      access: 0,
      verified: 0,
    };
    for (const r of allRoadsMap.values()) {
      if (r.deleted) continue;
      counts.total++;
      const rc = r.roadClass || 'local';
      if (counts[rc] !== undefined) counts[rc]++;
      if (r.verified) counts.verified++;
    }
    return counts;
  }, [allRoadsMap]);

  // Danh sách đường chính để snap hình học (không đoán tên)
  const parentRoadList = useMemo(() => {
    const res: { roadId: string; name: string; geometry: [number, number][] }[] = [];
    for (const r of allRoadsMap.values()) {
      if (
        (r.roadClass === 'major' ||
          r.roadClass === 'arterial' ||
          r.roadType === 'road' ||
          r.roadType === 'street') &&
        r.name &&
        r.verificationStatus === 'verified'
      ) {
        res.push({ roadId: r.roadId, name: r.name, geometry: r.geometry });
      }
    }
    return res;
  }, [allRoadsMap]);

  const snapPreview = useMemo(() => {
    if (!isDrawingMode || drawingPoints.length < 2) return null;
    return snapAlleyGeometryToParentRoad(drawingPoints, parentRoadList, 18);
  }, [isDrawingMode, drawingPoints, parentRoadList]);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setStatusFeedback(msg);
    onNotifyToast?.(msg);
    setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleSaveRenameAndMeta = () => {
    if (!selectedRoad) return;
    const cleanName = editName.trim();
    const resolvedParent =
      editParentRoad.trim() || parseParentRoadFromAlleyName(cleanName) || null;
    const nextStatus: RoadVerificationStatus = cleanName ? 'verified' : 'unverified';

    saveAdminRoadOverride(selectedRoad.roadId, {
      name: cleanName,
      roadClass: editRoadClass,
      roadType: editRoadType,
      parentRoad: resolvedParent,
      source: 'local_verified',
      nameSource: 'local_verified',
      verified: Boolean(cleanName),
      verificationStatus: nextStatus,
      locked: editLocked,
    });
    showFeedback(
      `Đã lưu "${cleanName || '(Không tên)'}" [${editRoadClass}] vào ${selectedRoad.roadId}`
    );
  };

  const handleQuickChangeClass = (nextClass: RoadHierarchyClass) => {
    setEditRoadClass(nextClass);
    const nextType = mapRoadClassToDefaultRoadType(nextClass, editName);
    setEditRoadType(nextType);
    if (selectedRoad) {
      saveAdminRoadOverride(selectedRoad.roadId, {
        name: editName.trim(),
        roadClass: nextClass,
        roadType: nextType,
        parentRoad: editParentRoad.trim() || selectedRoad.parentRoad || null,
        verificationStatus: selectedRoad.verificationStatus,
        locked: editLocked,
      });
      showFeedback(`Đã đổi cấp ${selectedRoad.roadId} sang "${nextClass}" (${nextType})`);
    }
  };

  const handleVerifyRoad = () => {
    if (!selectedRoad) return;
    const cleanName = editName.trim() || selectedRoad.name.trim();
    const resolvedParent =
      editParentRoad.trim() ||
      selectedRoad.parentRoad ||
      parseParentRoadFromAlleyName(cleanName) ||
      null;

    saveAdminRoadOverride(selectedRoad.roadId, {
      name: cleanName,
      roadClass: editRoadClass,
      roadType: editRoadType,
      parentRoad: resolvedParent,
      source: 'local_verified',
      nameSource: 'local_verified',
      verified: true,
      verificationStatus: 'verified',
      locked: true,
    });
    setEditLocked(true);
    showFeedback(`Đã xác minh ${selectedRoad.roadId} (${cleanName || 'Đã khóa xác minh'})`);
  };

  const handleMarkUnverified = () => {
    if (!selectedRoad) return;
    saveAdminRoadOverride(selectedRoad.roadId, {
      name: editName.trim(),
      roadClass: editRoadClass,
      roadType: editRoadType,
      parentRoad: editParentRoad.trim() || null,
      verified: false,
      verificationStatus: 'needs_review',
      locked: false,
    });
    setEditLocked(false);
    showFeedback(`Đã chuyển ${selectedRoad.roadId} sang trạng thái "Cần rà soát"`);
  };

  const handleToggleLock = () => {
    if (!selectedRoad) return;
    const nextLocked = !editLocked;
    setEditLocked(nextLocked);
    saveAdminRoadOverride(selectedRoad.roadId, {
      locked: nextLocked,
    });
    showFeedback(
      nextLocked
        ? `Đã khóa xác minh ${selectedRoad.roadId} (chống ghi đè từ OSM/Google)`
        : `Đã mở khóa ${selectedRoad.roadId}`
    );
  };

  // Mục 21: Bắt đầu chế độ Chỉnh sửa trực tiếp Geometry (Node Editor)
  const handleStartDirectGeometryEdit = () => {
    if (!selectedRoad) return;
    const clone = selectedRoad.geometry.map((pt) => [pt[0], pt[1]] as [number, number]);
    setGeomHistory([]);
    setIsPreviewingGeom(false);
    updateDraftGeom(clone, 0, false);
    setActiveTab('geometry');
    showFeedback(
      `Đang chỉnh geometry ${selectedRoad.roadId}: Kéo trực tiếp các điểm tròn trên bản đồ hoặc thêm/xóa node.`
    );
  };

  const handleInsertVertex = () => {
    if (!activeDraftGeom || activeDraftGeom.length < 2) return;
    const segIdx = Math.min(activeVertexIdx, activeDraftGeom.length - 2);
    const next = insertRoadVertexAtSegmentMidpoint(activeDraftGeom, segIdx);
    updateDraftGeom(next, segIdx + 1, true);
    showFeedback(`Đã chèn thêm node #${segIdx + 2} vào giữa đoạn.`);
  };

  const handleDeleteVertex = () => {
    if (!activeDraftGeom || activeDraftGeom.length <= 2) {
      showFeedback('Đoạn đường cần tối thiểu 2 node đầu/cuối.');
      return;
    }
    const next = deleteRoadVertex(activeDraftGeom, activeVertexIdx);
    const nextIdx = Math.max(0, Math.min(activeVertexIdx, next.length - 1));
    updateDraftGeom(next, nextIdx, true);
    showFeedback(`Đã xóa node #${activeVertexIdx + 1}.`);
  };

  const handleNudgeVertex = (dLngMeters: number, dLatMeters: number) => {
    if (!activeDraftGeom || activeDraftGeom.length < 2) return;
    const cur = activeDraftGeom[activeVertexIdx] || activeDraftGeom[0];
    const nextLng = cur[0] + dLngMeters / 103480;
    const nextLat = cur[1] + dLatMeters / 110720;
    const next = moveRoadVertex(activeDraftGeom, activeVertexIdx, [nextLng, nextLat]);
    updateDraftGeom(next, activeVertexIdx, true);
  };

  const handleUndoGeomStep = () => {
    if (geomHistory.length === 0) return;
    const prev = geomHistory[geomHistory.length - 1];
    setGeomHistory((h) => h.slice(0, -1));
    updateDraftGeom(prev, Math.min(activeVertexIdx, prev.length - 1), false);
    showFeedback('Đã hoàn tác (Undo) bước chỉnh node.');
  };

  const handleCancelGeometryEdit = () => {
    setGeomHistory([]);
    setIsPreviewingGeom(false);
    updateDraftGeom(null, 0, false);
    setActiveTab('inspect');
    showFeedback('Đã hủy chỉnh sửa geometry.');
  };

  const handlePreviewGeometryEdit = () => {
    if (!activeDraftGeom || activeDraftGeom.length < 2) return;
    setIsPreviewingGeom((prev) => !prev);
    const c = activeDraftGeom[activeVertexIdx] || activeDraftGeom[0];
    onFlyToLngLat(c[0], c[1], 17.5);
    showFeedback('Đang xem trước (Preview) hình học đường mới trên bản đồ.');
  };

  const handleSaveGeometryEdit = () => {
    if (!selectedRoad || !activeDraftGeom || activeDraftGeom.length < 2) return;
    saveAdminRoadOverride(selectedRoad.roadId, {
      name: editName.trim() || selectedRoad.name,
      roadClass: editRoadClass,
      roadType: editRoadType,
      parentRoad: editParentRoad.trim() || selectedRoad.parentRoad,
      geometry: activeDraftGeom,
      geometrySource: 'local_verified',
      source: 'local_verified',
      nameSource: 'local_verified',
      verified: Boolean(editName.trim() || selectedRoad.name),
      verificationStatus: editName.trim() || selectedRoad.name ? 'verified' : selectedRoad.verificationStatus,
      locked: true,
    });
    setGeomHistory([]);
    setIsPreviewingGeom(false);
    updateDraftGeom(null, 0, false);
    setActiveTab('inspect');
    showFeedback(
      `Đã lưu geometry mới (${activeDraftGeom.length} node) cho ${selectedRoad.roadId}!`
    );
  };

  const handleSplitRoad = () => {
    if (!selectedRoad) return;
    const splitIdx =
      activeTab === 'geometry' &&
      activeVertexIdx > 0 &&
      activeDraftGeom &&
      activeVertexIdx < activeDraftGeom.length - 1
        ? activeVertexIdx
        : undefined;
    const res = splitAdminRoadSegment(
      activeDraftGeom ? { ...selectedRoad, geometry: activeDraftGeom } : selectedRoad,
      splitIdx
    );
    if (!res) {
      showFeedback('Đoạn đường quá ngắn, không thể tách thêm.');
      return;
    }
    updateDraftGeom(null, 0, false);
    setActiveTab('inspect');
    showFeedback(
      `Đã tách thành ${res.firstSegment.roadId} và ${res.secondSegment.roadId}`
    );
  };

  const handleFinishDrawing = () => {
    if (drawingPoints.length < 2) {
      showFeedback('Vui lòng chấm ít nhất 2 điểm dọc tim ngõ trên bản đồ.');
      return;
    }
    const cleanName = drawName.trim();
    if (!cleanName) {
      showFeedback('Vui lòng nhập Tên ngõ / đường trước khi hoàn tất.');
      return;
    }

    const snapped = snapAlleyGeometryToParentRoad(drawingPoints, parentRoadList, 18);
    const finalGeom = snapped.snappedGeometry;
    const finalParent =
      drawParentRoad.trim() ||
      snapped.snappedParentRoadName ||
      parseParentRoadFromAlleyName(cleanName) ||
      null;

    const targetRoadId =
      isRedrawingExisting && selectedRoad ? selectedRoad.roadId : undefined;

    const saved = createOrRedrawAdminRoad({
      roadId: targetRoadId,
      name: cleanName,
      roadType: drawRoadType,
      parentRoad: finalParent,
      parentRoadId: snapped.snappedParentRoadId,
      geometry: finalGeom,
      locked: true,
    });

    onCancelDrawing();
    onSelectRoadById(saved.roadId, true);
    setActiveTab('inspect');
    showFeedback(
      `Đã lưu ngõ "${cleanName}" (${saved.roadId}) với ${finalGeom.length} điểm tim đường.`
    );
  };

  const handleAssignIssueCandidate = (issue: RoadAuditIssue) => {
    const targetId = issue.candidateRoadId || issue.roadId;
    const targetRec = allRoadsMap.get(targetId);
    if (!targetRec) {
      showFeedback(`Không tìm thấy đoạn đường ${targetId}`);
      return;
    }
    if (issue.roadId && issue.roadId !== targetId) {
      saveAdminRoadOverride(issue.roadId, {
        deleted: true,
        verificationStatus: 'verified',
      });
    }
    saveAdminRoadOverride(targetId, {
      name: issue.name,
      roadClass: issue.roadClass || 'alley',
      roadType: issue.roadType || 'alley',
      parentRoad: issue.parentRoad || parseParentRoadFromAlleyName(issue.name),
      source: 'local_verified',
      nameSource: 'local_verified',
      verified: true,
      verificationStatus: 'verified',
      locked: true,
    });
    onSelectRoadById(targetId, true);
    setActiveTab('inspect');
    showFeedback(`Đã gán & xác minh "${issue.name}" vào ${targetId}`);
  };

  return (
    <div
      data-testid="admin-road-editor-panel"
      className="fixed bottom-14 left-2 right-2 sm:left-auto sm:right-4 sm:bottom-16 sm:w-[400px] z-40 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl border border-slate-700/90 shadow-2xl overflow-hidden text-xs"
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Route size={15} className="text-emerald-400 shrink-0" />
          <div className="font-bold text-[12.5px] truncate">
            Chuẩn hóa Đường & Ngõ Xuân Hòa
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              updateDraftGeom(null, 0, false);
              setActiveTab('inspect');
            }}
            className={`px-2 py-1 rounded-lg font-semibold text-[11px] cursor-pointer transition ${
              activeTab === 'inspect' || activeTab === 'geometry'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Đoạn chọn
          </button>
          <button
            type="button"
            onClick={() => {
              updateDraftGeom(null, 0, false);
              setActiveTab('draw');
              if (!isDrawingMode) onStartDrawNewAlley();
            }}
            className={`px-2 py-1 rounded-lg font-semibold text-[11px] cursor-pointer transition ${
              activeTab === 'draw'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Vẽ ngõ
          </button>
          <button
            type="button"
            onClick={() => {
              updateDraftGeom(null, 0, false);
              setActiveTab('audit');
            }}
            data-testid="road-editor-tab-audit"
            className={`px-2 py-1 rounded-lg font-semibold text-[11px] cursor-pointer transition flex items-center gap-1 ${
              activeTab === 'audit'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>Cần rà soát</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold">
              {auditIssues.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              updateDraftGeom(null, 0, false);
              onClose();
            }}
            aria-label="Đóng công cụ chỉnh đường ngõ"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {statusFeedback && (
        <div className="px-3 py-1.5 bg-emerald-900/80 border-b border-emerald-700/60 text-emerald-200 text-[11px] font-medium flex items-center gap-1.5">
          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
          <span className="truncate">{statusFeedback}</span>
        </div>
      )}

      {/* Body */}
      <div className="p-3 max-h-[56vh] overflow-y-auto space-y-2.5">
        {activeTab === 'inspect' && (
          <>
            {!selectedRoad ? (
              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 text-slate-300 space-y-2">
                <div className="font-semibold text-white">
                  Chạm trực tiếp vào một đoạn đường / ngõ trên bản đồ
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Hệ thống phân cấp 5 bậc (<code className="text-amber-300">major</code>,{' '}
                  <code className="text-amber-200">arterial</code>,{' '}
                  <code className="text-slate-200">local</code>,{' '}
                  <code className="text-emerald-300">alley</code>,{' '}
                  <code className="text-slate-400">access</code>) gắn chặt theo{' '}
                  <code className="text-emerald-300">roadId</code>.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectRoadById('way/176151686', true);
                    }}
                    data-testid="quick-select-candidate-ngo29"
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-semibold text-[11px] hover:bg-emerald-500/30 cursor-pointer"
                  >
                    Tới Ngõ 29 Nguyễn Văn Linh (way/176151686)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('draw');
                      onStartDrawNewAlley();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-500 cursor-pointer flex items-center gap-1"
                  >
                    <PenTool size={12} />
                    <span>Vẽ ngõ mới</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Mục 20: Quick Admin Edit Summary Card */}
                <div
                  data-testid="quick-admin-road-card"
                  className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-emerald-300 font-semibold truncate">
                      ID: {selectedRoad.roadId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        selectedRoad.verificationStatus === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : selectedRoad.verificationStatus === 'rejected'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {VERIFICATION_STATUS_LABELS[selectedRoad.verificationStatus]}
                    </span>
                  </div>

                  {/* 4 thông tin cốt lõi theo Mục 20: Tên / Class / Nguồn / Verified */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] bg-slate-900/60 rounded-lg p-2 border border-slate-700/60">
                    <div className="truncate">
                      <span className="text-slate-400">Tên: </span>
                      <strong className="text-white">
                        {selectedRoad.name || '(Không tên)'}
                      </strong>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-400">Class: </span>
                      <strong className="text-amber-300 uppercase">
                        {selectedRoad.roadClass || 'local'}
                      </strong>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-400">Nguồn: </span>
                      <strong className="text-emerald-300">
                        {selectedRoad.source || selectedRoad.nameSource}
                      </strong>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-400">Verified: </span>
                      <strong
                        className={
                          selectedRoad.verified ? 'text-emerald-400' : 'text-amber-300'
                        }
                      >
                        {selectedRoad.verified ? 'true' : 'false'}
                      </strong>
                    </div>
                  </div>

                  {/* 4 nút Quick Action theo Mục 20: [Sửa tên] [Đổi cấp] [Chỉnh geometry] [Xác minh] */}
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    <button
                      type="button"
                      data-testid="quick-action-rename-btn"
                      onClick={() => nameInputRef.current?.focus()}
                      className="h-7 px-1.5 rounded-lg bg-slate-700/90 hover:bg-slate-600 text-white font-semibold text-[10.5px] cursor-pointer truncate"
                    >
                      Sửa tên
                    </button>
                    <button
                      type="button"
                      data-testid="quick-action-class-btn"
                      onClick={() => classSelectRef.current?.focus()}
                      className="h-7 px-1.5 rounded-lg bg-slate-700/90 hover:bg-slate-600 text-amber-200 font-semibold text-[10.5px] cursor-pointer truncate"
                    >
                      Đổi cấp
                    </button>
                    <button
                      type="button"
                      data-testid="quick-action-geometry-btn"
                      onClick={handleStartDirectGeometryEdit}
                      className="h-7 px-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white font-semibold text-[10.5px] cursor-pointer truncate"
                    >
                      Chỉnh geometry
                    </button>
                    <button
                      type="button"
                      data-testid="quick-action-verify-btn"
                      onClick={handleVerifyRoad}
                      className="h-7 px-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10.5px] cursor-pointer truncate"
                    >
                      Xác minh
                    </button>
                  </div>

                  {selectedRoad.rejectedName && (
                    <div className="text-[10.5px] text-rose-300 bg-rose-950/60 border border-rose-800/60 rounded-lg px-2 py-1">
                      Đã gỡ tên gắn sai trước đây: <strong>{selectedRoad.rejectedName}</strong>
                    </div>
                  )}
                </div>

                {isMergingSecondRoad ? (
                  <div className="p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-500/60 space-y-2">
                    <div className="font-semibold text-indigo-200">
                      Đang ở chế độ Nối đoạn (Merge)
                    </div>
                    <p className="text-[11px] text-indigo-300">
                      Hãy chạm vào đoạn đường thứ 2 liền kề với{' '}
                      <strong>{selectedRoad.roadId}</strong> trên bản đồ để nối thành 1 đoạn.
                    </p>
                    <button
                      type="button"
                      onClick={onCancelMergeMode}
                      className="px-2.5 py-1 rounded-lg bg-slate-700 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Hủy nối đoạn
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Form chỉnh sửa Tên, Cấp đường (5 bậc), Loại đường, Đường chính */}
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10.5px] text-slate-400 font-semibold mb-1">
                          Tên đường / ngõ (để trống nếu chưa có tên xác minh)
                        </label>
                        <input
                          ref={nameInputRef}
                          type="text"
                          data-testid="road-editor-name-input"
                          value={editName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditName(val);
                            const autoParent = parseParentRoadFromAlleyName(val);
                            if (autoParent && !editParentRoad) {
                              setEditParentRoad(autoParent);
                            }
                          }}
                          placeholder="VD: Ngõ 29 Nguyễn Văn Linh"
                          className="w-full h-8.5 px-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-[12px] font-medium focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10.5px] text-slate-400 font-semibold mb-1">
                            Cấp đường 5 bậc (Class)
                          </label>
                          <select
                            ref={classSelectRef}
                            data-testid="road-editor-class-select"
                            value={editRoadClass}
                            onChange={(e) =>
                              handleQuickChangeClass(e.target.value as RoadHierarchyClass)
                            }
                            className="w-full h-8.5 px-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-[11px] focus:outline-none focus:border-emerald-400"
                          >
                            {(Object.keys(ROAD_CLASS_LABELS) as RoadHierarchyClass[]).map(
                              (rc) => (
                                <option key={rc} value={rc}>
                                  {ROAD_CLASS_LABELS[rc]}
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10.5px] text-slate-400 font-semibold mb-1">
                            Loại chi tiết (roadType)
                          </label>
                          <select
                            data-testid="road-editor-type-select"
                            value={editRoadType}
                            onChange={(e) => setEditRoadType(e.target.value as RoadType)}
                            className="w-full h-8.5 px-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-[11px] focus:outline-none focus:border-emerald-400"
                          >
                            {(Object.keys(ROAD_TYPE_LABELS) as RoadType[]).map((rt) => (
                              <option key={rt} value={rt}>
                                {ROAD_TYPE_LABELS[rt]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] text-slate-400 font-semibold mb-1">
                          Đường chính kết nối (parentRoad)
                        </label>
                        <input
                          type="text"
                          data-testid="road-editor-parent-input"
                          value={editParentRoad}
                          onChange={(e) => setEditParentRoad(e.target.value)}
                          placeholder="VD: Đường Nguyễn Văn Linh"
                          className="w-full h-8.5 px-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-[11.5px] focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* Hàng nút thao tác chính */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        type="button"
                        data-testid="road-editor-save-btn"
                        onClick={handleSaveRenameAndMeta}
                        className="h-8 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11.5px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check size={13} />
                        <span>Lưu thay đổi</span>
                      </button>

                      <button
                        type="button"
                        data-testid="road-editor-verify-btn"
                        onClick={handleVerifyRoad}
                        className="h-8 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11.5px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck size={13} />
                        <span>Xác minh</span>
                      </button>

                      <button
                        type="button"
                        data-testid="road-editor-unverify-btn"
                        onClick={handleMarkUnverified}
                        className="h-8 px-2 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white font-semibold text-[11.5px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <AlertTriangle size={13} />
                        <span>Cần rà soát</span>
                      </button>
                    </div>

                    {/* Hàng nút thao tác hình học & khóa xác minh */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={handleStartDirectGeometryEdit}
                        className="h-8 px-1.5 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/60 text-indigo-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Move size={12} />
                        <span>Sửa node</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSplitRoad}
                        className="h-8 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Scissors size={12} />
                        <span>Tách đoạn</span>
                      </button>

                      <button
                        type="button"
                        onClick={onStartMergeMode}
                        className="h-8 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <GitMerge size={12} />
                        <span>Nối đoạn</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleLock}
                        title="Khóa không cho đồng bộ tự động ghi đè"
                        className={`h-8 px-1.5 rounded-lg border font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer ${
                          editLocked
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                            : 'bg-slate-800 border-slate-600 text-slate-300'
                        }`}
                      >
                        {editLocked ? <Lock size={12} /> : <Unlock size={12} />}
                        <span>{editLocked ? 'Đã khóa' : 'Khóa'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Mục 21: Chế độ Chỉnh sửa trực tiếp hình học đường (Kéo node / Thêm node / Xóa node / Tách đoạn / Undo / Preview / Lưu / Hủy) */}
        {activeTab === 'geometry' && selectedRoad && activeDraftGeom && (
          <div data-testid="direct-geometry-editor" className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-950/75 border border-indigo-500/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-200 text-[12px]">
                  Chỉnh Geometry: {selectedRoad.roadId}
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-bold text-[10.5px]">
                  {activeDraftGeom.length} node •{' '}
                  {Math.round(computePolylineLengthMeters(activeDraftGeom))}m
                </span>
              </div>
              <p className="text-[11px] text-indigo-100/85 leading-snug">
                Kéo trực tiếp các điểm node tròn trên bản đồ 2D, bấm dấu (+) giữa đoạn để chèn node, hoặc tinh chỉnh từng node bên dưới.
              </p>
            </div>

            {/* Chọn node đang thao tác */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {activeDraftGeom.map((pt, idx) => (
                <button
                  key={idx}
                  type="button"
                  data-testid={`geom-node-btn-${idx}`}
                  onClick={() => updateDraftGeom(activeDraftGeom, idx, false)}
                  className={`px-2 py-1 rounded-lg text-[10.5px] font-bold shrink-0 cursor-pointer border ${
                    idx === activeVertexIdx
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Node #{idx + 1}
                </button>
              ))}
            </div>

            {/* Tọa độ & nút dịch chuyển tinh (Nudge ±1m) cho node đang chọn */}
            {activeDraftGeom[activeVertexIdx] && (
              <div className="p-2 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-2">
                <div className="text-[10.5px] font-mono text-slate-300">
                  Node #{activeVertexIdx + 1}:{' '}
                  {activeDraftGeom[activeVertexIdx][1].toFixed(6)},{' '}
                  {activeDraftGeom[activeVertexIdx][0].toFixed(6)}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="nudge-node-west"
                    onClick={() => handleNudgeVertex(-1.5, 0)}
                    className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold cursor-pointer"
                    title="Dịch sang Tây 1.5m"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    data-testid="nudge-node-north"
                    onClick={() => handleNudgeVertex(0, 1.5)}
                    className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold cursor-pointer"
                    title="Dịch lên Bắc 1.5m"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    data-testid="nudge-node-south"
                    onClick={() => handleNudgeVertex(0, -1.5)}
                    className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold cursor-pointer"
                    title="Dịch xuống Nam 1.5m"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    data-testid="nudge-node-east"
                    onClick={() => handleNudgeVertex(1.5, 0)}
                    className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold cursor-pointer"
                    title="Dịch sang Đông 1.5m"
                  >
                    →
                  </button>
                </div>
              </div>
            )}

            {/* Công cụ Node: Thêm node / Xóa node / Tách đoạn / Undo / Vẽ lại từ đầu */}
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                data-testid="geom-add-node-btn"
                onClick={handleInsertVertex}
                className="h-8 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-emerald-300 font-semibold text-[10.5px] flex items-center justify-center gap-0.5 cursor-pointer"
              >
                <Plus size={12} />
                <span>Thêm node</span>
              </button>
              <button
                type="button"
                data-testid="geom-delete-node-btn"
                onClick={handleDeleteVertex}
                disabled={activeDraftGeom.length <= 2}
                className="h-8 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 text-rose-300 font-semibold text-[10.5px] flex items-center justify-center gap-0.5 cursor-pointer"
              >
                <Trash2 size={12} />
                <span>Xóa node</span>
              </button>
              <button
                type="button"
                data-testid="geom-split-btn"
                onClick={handleSplitRoad}
                className="h-8 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sky-300 font-semibold text-[10.5px] flex items-center justify-center gap-0.5 cursor-pointer"
              >
                <Scissors size={12} />
                <span>Tách đoạn</span>
              </button>
              <button
                type="button"
                data-testid="geom-undo-btn"
                onClick={handleUndoGeomStep}
                disabled={geomHistory.length === 0}
                className="h-8 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 text-amber-200 font-semibold text-[10.5px] flex items-center justify-center gap-0.5 cursor-pointer"
              >
                <Undo2 size={12} />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateDraftGeom(null, 0, false);
                  onStartRedrawSelectedRoad();
                }}
                className="h-8 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-[10.5px] flex items-center justify-center gap-0.5 cursor-pointer"
              >
                <PenTool size={11} />
                <span>Vẽ lại</span>
              </button>
            </div>

            {/* 3 nút bắt buộc theo Mục 21: [Hủy] [Preview] [Lưu] */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                data-testid="geom-cancel-btn"
                onClick={handleCancelGeometryEdit}
                className="h-8.5 px-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-semibold text-[11.5px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>Hủy</span>
              </button>
              <button
                type="button"
                data-testid="geom-preview-btn"
                onClick={handlePreviewGeometryEdit}
                className={`h-8.5 px-2 rounded-lg border font-semibold text-[11.5px] flex items-center justify-center gap-1 cursor-pointer ${
                  isPreviewingGeom
                    ? 'bg-sky-600 border-sky-400 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-sky-300'
                }`}
              >
                <Eye size={13} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                data-testid="geom-save-btn"
                onClick={handleSaveGeometryEdit}
                className="h-8.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11.5px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check size={13} />
                <span>Lưu</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'draw' && (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-600/50 space-y-1">
              <div className="font-semibold text-emerald-200 flex items-center justify-between">
                <span>
                  {isRedrawingExisting && selectedRoad
                    ? `Vẽ lại tim đường: ${selectedRoad.roadId}`
                    : 'Chế độ Vẽ ngõ trực tiếp (A → B → C...)'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10.5px] font-bold">
                  {drawingPoints.length} điểm
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/80">
                Chạm liên tiếp dọc theo tim ngõ trên bản đồ. Điểm đầu/cuối cách đường chính ≤ 18m sẽ tự động snap hình học vào cạnh đường chính.
              </p>
              {snapPreview?.snappedParentRoadName && (
                <div className="text-[10.5px] text-sky-300 font-semibold pt-0.5">
                  ✓ Đã snap hình học điểm đầu vào: {snapPreview.snappedParentRoadName} (cách{' '}
                  {snapPreview.snapDistanceMeters}m)
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[10.5px] text-slate-400 font-semibold mb-1">
                  Tên ngõ mới
                </label>
                <input
                  type="text"
                  data-testid="draw-alley-name-input"
                  value={drawName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDrawName(v);
                    const p = parseParentRoadFromAlleyName(v);
                    if (p) setDrawParentRoad(p);
                  }}
                  placeholder="VD: Ngõ 29 Nguyễn Văn Linh"
                  className="w-full h-9 px-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-[12px] font-medium focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10.5px] text-slate-400 font-semibold mb-1">
                    Cấp đường (Class)
                  </label>
                  <select
                    value={drawRoadClass}
                    onChange={(e) => {
                      const rc = e.target.value as RoadHierarchyClass;
                      setDrawRoadClass(rc);
                      setDrawRoadType(mapRoadClassToDefaultRoadType(rc, drawName));
                    }}
                    className="w-full h-9 px-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-[11px]"
                  >
                    {(Object.keys(ROAD_CLASS_LABELS) as RoadHierarchyClass[]).map((rc) => (
                      <option key={rc} value={rc}>
                        {ROAD_CLASS_LABELS[rc]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] text-slate-400 font-semibold mb-1">
                    Đường chính (parentRoad)
                  </label>
                  <input
                    type="text"
                    value={drawParentRoad}
                    onChange={(e) => setDrawParentRoad(e.target.value)}
                    placeholder="VD: Đường Nguyễn Văn Linh"
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-[11.5px]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={onUndoLastDrawPoint}
                disabled={drawingPoints.length === 0}
                className="h-8 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Undo2 size={13} />
                <span>Undo điểm</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onCancelDrawing();
                  setActiveTab('inspect');
                }}
                className="h-8 px-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>Hủy</span>
              </button>

              <button
                type="button"
                data-testid="draw-alley-finish-btn"
                onClick={handleFinishDrawing}
                className="h-8 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11.5px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check size={13} />
                <span>Hoàn tất</span>
              </button>
            </div>
          </div>
        )}

        {/* Mục 19: Road QA Panel gọn, chỉ hiện mục Cần rà soát thực sự */}
        {activeTab === 'audit' && (
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
              <div className="text-[11px] font-bold text-emerald-300">
                Tổng quan mạng lưới đường Phường Xuân Hòa ({hierarchyCounts.total} đoạn)
              </div>
              <div className="grid grid-cols-5 gap-1 text-[10px] text-center pt-0.5">
                <div className="rounded bg-slate-900/80 py-1 border border-slate-700/60">
                  <div className="text-amber-300 font-bold">{hierarchyCounts.major}</div>
                  <div className="text-slate-400">Major</div>
                </div>
                <div className="rounded bg-slate-900/80 py-1 border border-slate-700/60">
                  <div className="text-amber-200 font-bold">{hierarchyCounts.arterial}</div>
                  <div className="text-slate-400">Arterial</div>
                </div>
                <div className="rounded bg-slate-900/80 py-1 border border-slate-700/60">
                  <div className="text-slate-200 font-bold">{hierarchyCounts.local}</div>
                  <div className="text-slate-400">Local</div>
                </div>
                <div className="rounded bg-slate-900/80 py-1 border border-slate-700/60">
                  <div className="text-emerald-300 font-bold">{hierarchyCounts.alley}</div>
                  <div className="text-slate-400">Alley</div>
                </div>
                <div className="rounded bg-slate-900/80 py-1 border border-slate-700/60">
                  <div className="text-slate-400 font-bold">{hierarchyCounts.access}</div>
                  <div className="text-slate-500">Access</div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 font-medium">
              Mục cần rà soát ({auditIssues.length}):
            </div>

            {auditIssues.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 text-emerald-300 text-[11.5px]">
                ✓ Mạng lưới đường & ngõ Xuân Hòa đã chuẩn hóa sạch sẽ, không có lỗi hình học hay tên ngõ xung đột.
              </div>
            ) : (
              <div className="space-y-2">
                {auditIssues.map((issue) => (
                  <div
                    key={issue.id}
                    data-testid={`audit-issue-${issue.roadId}`}
                    className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-amber-300 text-[12px]">
                        {issue.name}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                        {issue.roadId}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {issue.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const targetId = issue.candidateRoadId || issue.roadId;
                          onSelectRoadById(targetId, true);
                          onFlyToLngLat(issue.center[0], issue.center[1], 18);
                          setActiveTab('inspect');
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation size={11} />
                        <span>Bay tới kiểm tra</span>
                      </button>

                      {issue.issueType === 'pending_review_alley' && issue.candidateRoadId && (
                        <button
                          type="button"
                          data-testid={`confirm-candidate-${issue.candidateRoadId}`}
                          onClick={() => handleAssignIssueCandidate(issue)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Check size={11} />
                          <span>Xác nhận vào {issue.candidateRoadId}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
