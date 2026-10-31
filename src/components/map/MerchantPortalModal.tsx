import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Store,
  KeyRound,
  MapPin,
  Crosshair,
  Navigation,
  Clock,
  Phone,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Send,
  Plus,
  Trash2,
  ShieldCheck,
  Sparkles,
  LogIn,
  UtensilsCrossed,
  Bell,
  Check,
  XCircle,
  Eye,
  Lock,
  Download,
} from 'lucide-react';
import type { UserAuthProfile } from '@/lib/auth';
import type { Place } from '@/lib/places-xuanhoa';
import {
  AdminPlaceItem,
  CustomMenuEntry,
  MerchantPendingSubmission,
  getAllManagedPlaces,
  getAdminState,
  getOrGenerateMerchantCode,
  verifyAndClaimPlaceWithCode,
  getClaimedPlacesForUser,
  submitMerchantPlaceUpdate,
  updateMerchantLiveStatus,
  getAllMerchantSubmissions,
  approveMerchantSubmission,
  rejectMerchantSubmission,
  assignMerchantOwnerByEmail,
  approveAllPendingMerchantSubmissions,
  isMapManagerAuthenticated,
  createNewPlaceFromMap,
  MAP_MANAGER_MASTER_CODE,
} from '@/lib/admin-store';
import { parseCoordinatesFromInputOrUrl } from '@/lib/map/map-data';
import { MAP_CATEGORIES } from '@/lib/map/map-categories';
import { renderCategoryIcon } from './MapCategoryPanel';
import { triggerFeedback } from '@/lib/ui-feedback';

interface MerchantPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: UserAuthProfile | null | undefined;
  isAdminUser: boolean;
  onOpenLogin?: () => void;
  initialTab?: 'merchant' | 'create_new' | 'admin_approvals' | 'admin_codes';
  initialClaimCode?: string | null;
  pickedMapCoords?: { placeId?: string; lat: number; lng: number } | null;
  onStartPickOnMap: (placeId: string, placeName: string) => void;
  onFlyToCoordinates: (lat: number, lng: number, zoom?: number, label?: string) => void;
  onDataChanged: () => void;
}

export const MerchantPortalModal: React.FC<MerchantPortalModalProps> = ({
  isOpen,
  onClose,
  authUser,
  isAdminUser,
  onOpenLogin,
  initialTab = 'merchant',
  initialClaimCode = null,
  pickedMapCoords,
  onStartPickOnMap,
  onFlyToCoordinates,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<
    'merchant' | 'create_new' | 'admin_approvals' | 'admin_codes'
  >(initialTab);
  const [claimCodeInput, setClaimCodeInput] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [justSavedEmailId, setJustSavedEmailId] = useState<string | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  // Form chỉnh sửa của Chủ quán / Quản lý Maps
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editOpenHours, setEditOpenHours] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editMinPrice, setEditMinPrice] = useState<number>(25);
  const [editMaxPrice, setEditMaxPrice] = useState<number>(60);
  const [editServiceMode, setEditServiceMode] = useState<Place['serviceMode']>('both');
  const [editDeliveryNote, setEditDeliveryNote] = useState('');
  const [editSigName, setEditSigName] = useState('');
  const [editSigPrice, setEditSigPrice] = useState<number>(35);
  const [editLat, setEditLat] = useState<string>('');
  const [editLng, setEditLng] = useState<string>('');
  const [editMapsLinkInput, setEditMapsLinkInput] = useState<string>('');
  const [gpsDistanceMeters, setGpsDistanceMeters] = useState<number | null>(null);
  const [isGettingGps, setIsGettingGps] = useState(false);

  // Form Tạo Địa Điểm Mới theo Danh Mục (Dành cho Quản lý Maps & Admin)
  const [newPlaceCategory, setNewPlaceCategory] = useState<string>('food');
  const [newPlaceName, setNewPlaceName] = useState<string>('');
  const [newPlaceAddress, setNewPlaceAddress] = useState<string>('');
  const [newPlacePhone, setNewPlacePhone] = useState<string>('');
  const [newPlaceHours, setNewPlaceHours] = useState<string>('07:00 - 22:00');
  const [newPlaceMapsLink, setNewPlaceMapsLink] = useState<string>('');
  const [newPlaceLat, setNewPlaceLat] = useState<string>('');
  const [newPlaceLng, setNewPlaceLng] = useState<string>('');
  const [newPlaceSigDish, setNewPlaceSigDish] = useState<string>('');
  const [newPlaceSigPrice, setNewPlaceSigPrice] = useState<number>(35);

  // Live Status
  const [liveStatus, setLiveStatus] = useState<'open_normal' | 'busy_hot' | 'closed_today'>(
    'open_normal'
  );
  const [liveStatusNote, setLiveStatusNote] = useState('');

  // Menu của quán
  const [editMenu, setEditMenu] = useState<CustomMenuEntry[]>([]);
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishCategory, setNewDishCategory] = useState('');

  // Tìm kiếm quán & Gán nhanh Gmail trong tab Cấp Mã Code của Admin
  const [adminCodeSearch, setAdminCodeSearch] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [directEmailInputs, setDirectEmailInputs] = useState<Record<string, string>>({});

  const isMapManagerUser = useMemo(
    () => isMapManagerAuthenticated(authUser),
    [authUser, refreshKey, isOpen]
  );
  const canManageAllPlaces = isAdminUser || isMapManagerUser;

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Tự động điền và kích hoạt mã khi Chủ quán bấm vào Link Nhận Quán 1 Chạm (?claim=XH-XXXX)
  useEffect(() => {
    if (!isOpen || !initialClaimCode) return;
    const clean = initialClaimCode.trim().toUpperCase();
    if (!clean) return;
    setClaimCodeInput(clean);
    const res = verifyAndClaimPlaceWithCode(clean, authUser);
    if (res.ok) {
      triggerFeedback('approve');
      setRefreshKey((k) => k + 1);
      onDataChanged();
      if (res.placeItem) {
        setSelectedPlaceId(res.placeItem.place.id);
      }
      setFeedback({
        type: 'success',
        text: `${res.message}`,
      });
    }
  }, [isOpen, initialClaimCode, authUser?.isLoggedIn, authUser?.email]);

  const adminState = useMemo(() => getAdminState(), [refreshKey, isOpen]);
  const allManagedPlaces = useMemo(() => getAllManagedPlaces(), [refreshKey, isOpen]);
  const allSubmissions = useMemo(() => getAllMerchantSubmissions(), [refreshKey, isOpen]);
  const pendingSubmissions = useMemo(
    () => allSubmissions.filter((s) => s.status === 'pending'),
    [allSubmissions]
  );

  const claimedPlaces = useMemo(() => {
    if (authUser?.email) {
      const list = getClaimedPlacesForUser(authUser.email);
      if (list.length > 0) return list;
    }
    if (authUser?.merchantPlaceId) {
      const found = allManagedPlaces.find((p) => p.place.id === authUser.merchantPlaceId);
      if (found) return [found];
    }
    return [];
  }, [authUser?.email, authUser?.merchantPlaceId, allManagedPlaces, refreshKey, isOpen]);

  // Tự động chọn quán đầu tiên mà chủ quán đã kích hoạt mã (hoặc quán đầu tiên cho Quản lý Maps / Admin)
  useEffect(() => {
    if (claimedPlaces.length > 0 && !selectedPlaceId) {
      setSelectedPlaceId(claimedPlaces[0].place.id);
    } else if (canManageAllPlaces && !selectedPlaceId && allManagedPlaces.length > 0) {
      setSelectedPlaceId(allManagedPlaces[0].place.id);
    }
  }, [claimedPlaces, selectedPlaceId, canManageAllPlaces, allManagedPlaces]);

  const activeMerchantPlace: AdminPlaceItem | null = useMemo(() => {
    if (!selectedPlaceId) {
      return claimedPlaces[0] || (canManageAllPlaces ? allManagedPlaces[0] || null : null);
    }
    return (
      claimedPlaces.find((p) => p.place.id === selectedPlaceId) ||
      (canManageAllPlaces
        ? allManagedPlaces.find((p) => p.place.id === selectedPlaceId) || null
        : null)
    );
  }, [selectedPlaceId, claimedPlaces, canManageAllPlaces, allManagedPlaces]);

  // Khi chuyển quán đang chọn, nạp thông tin hiện tại (hoặc bản đang chờ duyệt nếu có) vào form
  useEffect(() => {
    if (!activeMerchantPlace) return;
    const p = activeMerchantPlace.place;
    const ov = adminState.places?.[p.id];
    const pendingSub = adminState.merchantSubmissions?.[`sub_${p.id}`];

    if (pendingSub && pendingSub.status === 'pending') {
      const prop = pendingSub.proposed;
      setEditName(prop.name);
      setEditPhone(prop.phone);
      setEditOpenHours(prop.openHours);
      setEditAddress(prop.address);
      setEditTagline(prop.tagline || p.tagline || '');
      setEditMinPrice(prop.minPrice ?? p.minPrice);
      setEditMaxPrice(prop.maxPrice ?? p.maxPrice);
      setEditServiceMode(prop.serviceMode || p.serviceMode);
      setEditDeliveryNote(prop.deliveryNote || p.deliveryNote || '');
      setEditSigName(prop.signatureDishName || p.signatureDish?.name || '');
      setEditSigPrice(prop.signatureDishPrice ?? p.signatureDish?.price ?? 35);
      setEditLat(prop.lat !== null ? String(prop.lat) : ov?.lat ? String(ov.lat) : '');
      setEditLng(prop.lng !== null ? String(prop.lng) : ov?.lng ? String(ov.lng) : '');
      setEditMenu(prop.customMenu || activeMerchantPlace.fullMenu);
    } else {
      setEditName(p.name);
      setEditPhone(p.phone || '');
      setEditOpenHours(p.openHours || '07:00 - 22:00');
      setEditAddress(p.address || '');
      setEditTagline(p.tagline || '');
      setEditMinPrice(p.minPrice || 25);
      setEditMaxPrice(p.maxPrice || 60);
      setEditServiceMode(p.serviceMode || 'both');
      setEditDeliveryNote(p.deliveryNote || '');
      setEditSigName(p.signatureDish?.name || '');
      setEditSigPrice(p.signatureDish?.price || 35);
      setEditLat(typeof ov?.lat === 'number' ? String(ov.lat) : '');
      setEditLng(typeof ov?.lng === 'number' ? String(ov.lng) : '');
      setEditMenu(activeMerchantPlace.fullMenu.map((m) => ({ ...m })));
    }

    setEditMapsLinkInput(ov?.mapsUrl || p.mapsUrl || '');
    setLiveStatus(ov?.liveStatus || 'open_normal');
    setLiveStatusNote(ov?.liveStatusNote || '');
    setHasUnsavedChanges(false);
  }, [activeMerchantPlace?.place.id]);

  // Nhận tọa độ vừa chấm trực tiếp trên bản đồ (cho cả Quán đang sửa hoặc Địa điểm đang tạo mới)
  useEffect(() => {
    if (pickedMapCoords && Number.isFinite(pickedMapCoords.lat) && Number.isFinite(pickedMapCoords.lng)) {
      if (pickedMapCoords.placeId === '__new_place__') {
        setNewPlaceLat(String(pickedMapCoords.lat));
        setNewPlaceLng(String(pickedMapCoords.lng));
        setActiveTab('create_new');
        setFeedback({
          type: 'success',
          text: `📍 Đã lấy tọa độ trên bản đồ (${pickedMapCoords.lat}, ${pickedMapCoords.lng}) cho địa điểm mới. Hãy bấm "Lưu & Hiển thị ngay" bên dưới!`,
        });
        return;
      }

      setEditLat(String(pickedMapCoords.lat));
      setEditLng(String(pickedMapCoords.lng));
      setHasUnsavedChanges(false);
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3500);
      setRefreshKey((k) => k + 1);
      setFeedback({
        type: 'success',
        text: `✅ Đã lưu vị trí mặt tiền (${pickedMapCoords.lat}, ${pickedMapCoords.lng}) và hiển thị trên Bản đồ số!`,
        actionLabel: '🗺️ Xem trên Bản đồ',
        onAction: () => {
          triggerFeedback('pin');
          onFlyToCoordinates(
            pickedMapCoords.lat,
            pickedMapCoords.lng,
            17.2,
            editName || activeMerchantPlace?.place.name || 'Vị trí quán'
          );
          onClose();
        },
      });
    }
  }, [pickedMapCoords]);

  const currentPendingForActivePlace: MerchantPendingSubmission | undefined =
    activeMerchantPlace
      ? adminState.merchantSubmissions?.[`sub_${activeMerchantPlace.place.id}`]
      : undefined;

  const filteredAdminPlaces = useMemo(() => {
    const q = adminCodeSearch.trim().toLowerCase();
    if (!q) return allManagedPlaces;
    return allManagedPlaces.filter((item) => {
      const code = getOrGenerateMerchantCode(item.place.id, false).toLowerCase();
      const ov = adminState.places?.[item.place.id];
      return (
        item.place.name.toLowerCase().includes(q) ||
        item.place.address.toLowerCase().includes(q) ||
        code.includes(q) ||
        (ov?.claimedByEmail || '').toLowerCase().includes(q)
      );
    });
  }, [allManagedPlaces, adminCodeSearch, adminState.places]);

  if (!isOpen) return null;

  const handleClaimWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = verifyAndClaimPlaceWithCode(claimCodeInput, authUser);
    if (!res.ok) {
      triggerFeedback('warn');
      setFeedback({ type: 'error', text: res.message });
      return;
    }
    triggerFeedback('approve');
    setClaimCodeInput('');
    setRefreshKey((k) => k + 1);
    onDataChanged();
    if (res.placeItem) {
      setSelectedPlaceId(res.placeItem.place.id);
    }
    setFeedback({ type: 'success', text: res.message });
  };

  const handleUseStandingGps = () => {
    triggerFeedback('pin');
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setFeedback({
        type: 'error',
        text: 'Trình duyệt của bạn không hỗ trợ định vị GPS.',
      });
      return;
    }
    setIsGettingGps(true);
    setFeedback(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGettingGps(false);
        triggerFeedback('approve');
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setEditLat(String(lat));
        setEditLng(String(lng));
        setGpsDistanceMeters(0);
        setHasUnsavedChanges(true);
        onFlyToCoordinates(lat, lng, 17.2, editName || 'Vị trí quán của bạn');
        setFeedback({
          type: 'success',
          text: `📱 Đã lấy chính xác tọa độ GPS nơi bạn đang đứng (${lat}, ${lng})!`,
        });
      },
      () => {
        setIsGettingGps(false);
        triggerFeedback('warn');
        setFeedback({
          type: 'error',
          text: 'Không lấy được GPS tự động. Bạn hãy bấm nút "Chấm vị trí trên Bản đồ" ngay bên cạnh!',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveLiveStatusNow = (
    nextStatus: 'open_normal' | 'busy_hot' | 'closed_today',
    noteText = liveStatusNote
  ) => {
    if (!activeMerchantPlace) return;
    try {
      triggerFeedback('success');
      setLiveStatus(nextStatus);
      updateMerchantLiveStatus(
        activeMerchantPlace.place.id,
        authUser,
        nextStatus,
        noteText
      );
      setRefreshKey((k) => k + 1);
      onDataChanged();
      const statusLabel =
        nextStatus === 'open_normal'
          ? '🟢 Đang mở bán bình thường'
          : nextStatus === 'busy_hot'
          ? '🔥 Quán đang đông / Món mới'
          : '🟡 Hôm nay tạm nghỉ';
      setFeedback({
        type: 'success',
        text: `⚡ Đã bật trạng thái "${statusLabel}" lên Bản đồ tức thì!`,
      });
    } catch (err: any) {
      triggerFeedback('warn');
      setFeedback({
        type: 'error',
        text: err?.message || 'Lỗi cập nhật trạng thái.',
      });
    }
  };

  const handleSubmitForApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMerchantPlace) return;
    try {
      const parsedLat = editLat.trim() ? parseFloat(editLat) : null;
      const parsedLng = editLng.trim() ? parseFloat(editLng) : null;

      if ((parsedLat !== null && !Number.isFinite(parsedLat)) || (parsedLng !== null && !Number.isFinite(parsedLng))) {
        triggerFeedback('warn');
        setFeedback({
          type: 'error',
          text: 'Tọa độ định vị chưa hợp lệ. Hãy bấm "Chấm vị trí trên Bản đồ" hoặc "Lấy GPS nơi đang đứng".',
        });
        return;
      }

      submitMerchantPlaceUpdate(activeMerchantPlace.place.id, authUser, {
        name: editName,
        phone: editPhone,
        openHours: editOpenHours,
        address: editAddress,
        tagline: editTagline,
        minPrice: Number(editMinPrice) || 25,
        maxPrice: Number(editMaxPrice) || 60,
        serviceMode: editServiceMode,
        deliveryNote: editDeliveryNote,
        signatureDishName: editSigName,
        signatureDishPrice: Number(editSigPrice) || 35,
        customMenu: editMenu,
        lat: parsedLat,
        lng: parsedLng,
        gpsDistanceMeters,
      });

      triggerFeedback('approve');
      setRefreshKey((k) => k + 1);
      onDataChanged();
      setHasUnsavedChanges(false);
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3500);
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

      setFeedback({
        type: 'success',
        text: `✅ Đã lưu thông tin & vị trí của "${editName}" lên Bản đồ số thành công!`,
        actionLabel:
          parsedLat !== null && parsedLng !== null
            ? '🗺️ Xem vị trí trên Bản đồ'
            : isAdminUser
            ? 'Chuyển sang Duyệt Quán'
            : undefined,
        onAction:
          parsedLat !== null && parsedLng !== null
            ? () => {
                triggerFeedback('pin');
                onFlyToCoordinates(parsedLat, parsedLng, 17.2, editName);
                onClose();
              }
            : isAdminUser
            ? () => {
                triggerFeedback('tap');
                setActiveTab('admin_approvals');
              }
            : undefined,
      });
    } catch (err: any) {
      triggerFeedback('warn');
      setFeedback({
        type: 'error',
        text: err?.message || 'Không thể gửi yêu cầu cập nhật.',
      });
    }
  };

  const handleCopyCode = (placeId: string, placeName: string, withFullGuide = false) => {
    triggerFeedback('success');
    const code = getOrGenerateMerchantCode(placeId, false, placeName);
    const baseUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://xuanhoacogi.com/';
    const magicClaimLink = `${baseUrl}#/ban-do?claim=${encodeURIComponent(code)}`;

    const textToCopy = withFullGuide
      ? `🏪 CẤP QUYỀN CHỦ QUÁN "${placeName}" TRÊN XUÂN HÒA CÓ GÌ:\n👉 Anh/chị chỉ cần bấm vào link này và Đăng nhập Gmail là nhận quyền quản lý quán ngay (1 chạm, không cần gõ mã):\n${magicClaimLink}\n\n🔑 (Mã dự phòng của quán: ${code})`
      : code;

    navigator.clipboard?.writeText(textToCopy);
    setCopiedCodeId(withFullGuide ? `${placeId}_guide` : placeId);
    setFeedback({
      type: 'success',
      text: withFullGuide
        ? `📲 Đã copy Link Nhận Quán 1 Chạm của "${placeName}" để gửi Zalo!`
        : `🔑 Đã copy mã "${code}" của "${placeName}"!`,
    });
    setTimeout(() => setCopiedCodeId(null), 2200);
  };

  return (
    <div
      className="xuho-merchant-light-modal fixed inset-0 z-[120] bg-[#F8F5EE]/65 backdrop-blur-xs flex items-center justify-center p-2.5 pb-16 sm:p-4"
    >
      <style>{`
        .xuho-merchant-light-modal select,
        .xuho-merchant-light-modal select option,
        .xuho-merchant-light-modal input,
        .xuho-merchant-light-modal textarea {
          color-scheme: light !important;
          background-color: #FFFDF9 !important;
          color: #1E293B !important;
        }
      `}</style>
      <div
        className="w-full max-w-2xl max-h-[82vh] sm:max-h-[88vh] flex flex-col rounded-3xl bg-[#FFFDF9] border-2 border-[#39B980] shadow-[0_20px_60px_rgba(29,122,82,0.22)] overflow-hidden text-[#1E293B]"
        onClick={(e) => e.stopPropagation()}
        style={{
          colorScheme: 'light',
          fontFamily:
            "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* HEADER */}
        <div className="px-4 sm:px-5 py-3 bg-[#F8F5EE] border-b-2 border-[#E5DEC9] flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-[#39B980] border-2 border-[#403064] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Store size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-[#2D2246] truncate">
                {activeMerchantPlace
                  ? `Nick Quán: ${activeMerchantPlace.place.name}`
                  : 'Cổng Chủ Quán & Xác Thực Mã Code'}
              </h2>
              <p className="text-[11px] text-[#65587F] truncate">
                {activeMerchantPlace
                  ? 'Tài khoản chính chủ của Quán • Cắm định vị & Cập nhật giá món'
                  : 'Đăng nhập Gmail • Nhập mã Admin cấp để nhận quyền Nick Quán'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-full bg-[#FFFDF9] hover:bg-[#F1ECE1] border border-[#403064]/30 text-[#403064] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* THANH CHUYỂN TAB — CÂN ĐỐI, KHÔNG THANH CUỘN NGANG */}
        <div
          className={`px-3 sm:px-5 py-2 bg-[#F3EFE6] border-b border-[#E5DEC9] grid gap-1.5 shrink-0 ${
            isAdminUser
              ? 'grid-cols-2 sm:grid-cols-4'
              : isMapManagerUser
              ? 'grid-cols-2'
              : 'grid-cols-1'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              triggerFeedback('tap');
              setActiveTab('merchant');
            }}
            className="h-9 px-2 rounded-xl text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border whitespace-nowrap truncate"
            style={{
              backgroundColor: activeTab === 'merchant' ? '#403064' : '#FFFDF9',
              borderColor: '#403064',
              color: activeTab === 'merchant' ? '#FFFFFF' : '#403064',
            }}
          >
            <Store size={13} className="shrink-0" />
            <span className="truncate">
              {canManageAllPlaces ? 'Cập nhật Quán' : 'Quán của tôi'}
            </span>
          </button>

          {canManageAllPlaces && (
            <button
              type="button"
              onClick={() => {
                triggerFeedback('tap');
                setActiveTab('create_new');
              }}
              className="h-9 px-2 rounded-xl text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border whitespace-nowrap truncate"
              style={{
                backgroundColor: activeTab === 'create_new' ? '#39B980' : '#E6F7EF',
                borderColor: '#047857',
                color: activeTab === 'create_new' ? '#FFFFFF' : '#047857',
              }}
            >
              <Plus size={13} className="shrink-0" />
              <span className="truncate">Thêm Địa Điểm</span>
            </button>
          )}

          {isAdminUser && (
            <>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  setActiveTab('admin_approvals');
                }}
                className="h-9 px-2 rounded-xl text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border whitespace-nowrap"
                style={{
                  backgroundColor:
                    activeTab === 'admin_approvals'
                      ? '#403064'
                      : pendingSubmissions.length > 0
                      ? '#FEF3C7'
                      : '#FFFDF9',
                  borderColor: '#403064',
                  color:
                    activeTab === 'admin_approvals'
                      ? '#FFFFFF'
                      : pendingSubmissions.length > 0
                      ? '#92400E'
                      : '#403064',
                }}
              >
                <Bell size={13} className="shrink-0" />
                <span>Duyệt ({pendingSubmissions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  setActiveTab('admin_codes');
                }}
                className="h-9 px-2 rounded-xl text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border whitespace-nowrap"
                style={{
                  backgroundColor: activeTab === 'admin_codes' ? '#403064' : '#FFFDF9',
                  borderColor: '#403064',
                  color: activeTab === 'admin_codes' ? '#FFFFFF' : '#403064',
                }}
              >
                <KeyRound size={13} className="shrink-0" />
                <span>Mã Code ({allManagedPlaces.length})</span>
              </button>
            </>
          )}
        </div>

        {/* THANH PHẢN HỒI NỔI CỐ ĐỊNH NGAY DƯỚI TAB — LUÔN NHÌN THẤY DÙ ĐANG CUỘN Ở ĐÂU */}
        {feedback && (
          <div
            className="mx-3.5 sm:mx-5 mt-2.5 p-2.5 sm:p-3 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold shadow-md shrink-0"
            style={{
              backgroundColor:
                feedback.type === 'error'
                  ? '#FEF2F2'
                  : feedback.type === 'success'
                  ? '#E6F7EF'
                  : '#FEF3C7',
              borderColor:
                feedback.type === 'error'
                  ? '#EF4444'
                  : feedback.type === 'success'
                  ? '#39B980'
                  : '#F59E0B',
              color:
                feedback.type === 'error'
                  ? '#991B1B'
                  : feedback.type === 'success'
                  ? '#1D7A52'
                  : '#92400E',
            }}
          >
            <span className="flex-1 min-w-0 leading-snug">{feedback.text}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {feedback.actionLabel && feedback.onAction && (
                <button
                  type="button"
                  onClick={feedback.onAction}
                  className="px-2.5 py-1 rounded-xl bg-[#403064] hover:bg-[#533E80] active:scale-95 transition-transform text-white text-[11px] font-extrabold whitespace-nowrap cursor-pointer"
                >
                  {feedback.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="p-1 rounded-lg hover:bg-black/5 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* BODY */}
        <div
          ref={bodyScrollRef}
          className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 text-xs flex-1"
        >
          {/* ================================================================= */}
          {/* TAB 1: DÀNH CHO CHỦ QUÁN / QUẢN LÝ MAPS (CẮM GHIM & CẬP NHẬT)     */}
          {/* ================================================================= */}
          {activeTab === 'merchant' && (
            <>
              <div className="space-y-3.5">
                {/* THẺ ĐỊNH DANH CHỦ QUÁN + Ô NHẬP MÃ CODE */}
                <div className="p-3 rounded-2xl bg-[#F8F5EE] border-2 border-[#39B980] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-10 h-10 rounded-2xl bg-[#E6F7EF] border-2 border-[#39B980] flex items-center justify-center text-lg shrink-0">
                      <span>{isMapManagerUser && !isAdminUser ? '🗺️' : '🏪'}</span>
                      {(claimedPlaces.length > 0 || canManageAllPlaces) && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#39B980] border border-[#047857] text-white flex items-center justify-center text-[9px] font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      {claimedPlaces.length > 0 ? (
                        <>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-[#39B980] text-white text-[10px] font-extrabold">
                              ✓ TÀI KHOẢN CHỦ QUÁN
                            </span>
                            {authUser?.email && (
                              <span className="text-[11px] text-[#475569] font-semibold truncate">
                                ({authUser.email})
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-extrabold text-[#1E293B] truncate mt-0.5">
                            {claimedPlaces[0].place.name}
                          </div>
                        </>
                      ) : isAdminUser ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] text-[10px] font-extrabold">
                              QUẢN TRỊ VIÊN
                            </span>
                          </div>
                          <div className="text-xs font-extrabold text-[#1E293B] truncate mt-0.5">
                            Chọn quán bên dưới hoặc bấm "+ Thêm Địa Điểm" để ghim mới
                          </div>
                        </>
                      ) : isMapManagerUser ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-[#E6F7EF] border border-[#39B980] text-[#047857] text-[10px] font-extrabold">
                              🗺️ QUẢN LÝ MAPS & ĐỊNH VỊ
                            </span>
                          </div>
                          <div className="text-xs font-extrabold text-[#1E293B] truncate mt-0.5">
                            Cập nhật định vị các quán hoặc bấm "+ Thêm Địa Điểm" theo danh mục
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[11px] text-[#475569] font-semibold">
                            {authUser?.email
                              ? `Tài khoản: ${authUser.email}`
                              : 'Nhập mã định danh quán được cấp để quản lý thông tin:'}
                          </div>
                          <div className="font-extrabold text-[#1E293B] flex items-center gap-1.5 mt-0.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-[#39B980]" />
                            <span>
                              {authUser?.email || 'Chưa liên kết mã quán'}
                            </span>
                            {!authUser?.isLoggedIn && onOpenLogin && (
                              <button
                                type="button"
                                onClick={() => {
                                  triggerFeedback('tap');
                                  onClose();
                                  onOpenLogin();
                                }}
                                className="ml-1 px-2 py-0.5 rounded-lg bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] text-[10px] font-extrabold cursor-pointer"
                              >
                                Liên kết tài khoản
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleClaimWithCode} className="flex items-center gap-1.5 shrink-0">
                    <div className="relative flex-1 sm:w-40">
                      <KeyRound
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#047857]"
                      />
                      <input
                        type="text"
                        value={claimCodeInput}
                        onChange={(e) => setClaimCodeInput(e.target.value.toUpperCase())}
                        placeholder={
                          claimedPlaces.length > 0 ? 'Mã quán khác...' : 'Nhập mã XH-...'
                        }
                        className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-[#FFFDF9] border-2 border-[#39B980] font-mono text-xs font-extrabold uppercase text-[#1E293B] focus:outline-none focus:border-[#047857]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] active:scale-95 transition-transform text-white border-2 border-[#047857] font-extrabold text-xs whitespace-nowrap cursor-pointer"
                    >
                      {claimedPlaces.length > 0 ? 'Thêm mã' : 'Xác nhận'}
                    </button>
                  </form>
                </div>

                {/* Nếu chưa kích hoạt quán nào */}
                {!activeMerchantPlace ? (
                  <div className="p-5 rounded-3xl bg-[#FFFDF9] border border-[#CBD5E1] text-center space-y-2">
                    <KeyRound size={26} className="mx-auto text-[#047857]" />
                    <h3 className="text-sm font-extrabold text-[#1E293B]">
                      Chưa liên kết thông tin quán
                    </h3>
                    <p className="text-xs text-[#475569] max-w-md mx-auto leading-relaxed">
                      Vui lòng nhập Mã định danh quán được cung cấp vào ô phía trên để kết nối vị trí trên bản đồ, cập nhật giờ mở cửa và thực đơn.
                    </p>
                  </div>
                ) : (
                    /* ĐÃ MỞ KHÓA QUÁN -> HIỆN TOÀN BỘ CÔNG CỤ CẮM ĐỊNH VỊ & CHỈNH SỬA QUÁN */
                    <div className="space-y-3.5">
                      {/* Nếu chủ quán có nhiều hơn 1 quán (hoặc là Admin / Quản lý Maps) */}
                      {(claimedPlaces.length > 1 || canManageAllPlaces) && (
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[#403064] shrink-0">
                            Quán đang chọn:
                          </span>
                          <select
                            value={activeMerchantPlace.place.id}
                            onChange={(e) => {
                              triggerFeedback('tap');
                              setSelectedPlaceId(e.target.value);
                            }}
                            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#F8F5EE] border-2 border-[#403064] font-extrabold text-[#2D2246] truncate cursor-pointer"
                          >
                            {(canManageAllPlaces ? allManagedPlaces : claimedPlaces).map((item) => (
                              <option key={item.place.id} value={item.place.id}>
                                {item.place.name} — {item.place.address}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Trạng thái đã lưu trên bản đồ */}
                      {currentPendingForActivePlace && (
                        <div
                          className="p-3 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-2"
                          style={{
                            backgroundColor:
                              currentPendingForActivePlace.status === 'rejected'
                                ? '#FEF2F2'
                                : '#E6F7EF',
                            borderColor:
                              currentPendingForActivePlace.status === 'rejected'
                                ? '#EF4444'
                                : '#39B980',
                          }}
                        >
                          <div className="min-w-0">
                            <div className="font-extrabold text-[#047857]">
                              {currentPendingForActivePlace.status === 'rejected'
                                ? `❌ Chưa được duyệt: ${currentPendingForActivePlace.reviewNote || ''}`
                                : '✅ Đã lưu & hiển thị vị trí quán trên Bản đồ số'}
                            </div>
                            <div className="text-[11px] text-[#475569] mt-0.5">
                              Cập nhật lúc:{' '}
                              {new Date(currentPendingForActivePlace.submittedAt).toLocaleString(
                                'vi-VN'
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {currentPendingForActivePlace.proposed.lat !== null &&
                              currentPendingForActivePlace.proposed.lng !== null && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerFeedback('pin');
                                    onFlyToCoordinates(
                                      currentPendingForActivePlace.proposed.lat!,
                                      currentPendingForActivePlace.proposed.lng!,
                                      17.2,
                                      currentPendingForActivePlace.proposed.name
                                    );
                                    onClose();
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-[#FFFDF9] hover:bg-[#D1F2E3] active:scale-95 transition-transform text-[#047857] font-extrabold border border-[#39B980] shrink-0 whitespace-nowrap cursor-pointer text-[11px]"
                                >
                                  🗺️ Xem trên Bản đồ
                                </button>
                              )}

                            {isAdminUser && currentPendingForActivePlace.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => {
                                  triggerFeedback('approve');
                                  approveMerchantSubmission(currentPendingForActivePlace.id);
                                  setRefreshKey((k) => k + 1);
                                  onDataChanged();
                                  setFeedback({
                                    type: 'success',
                                    text: '✅ Đã xác nhận duyệt bản cập nhật này!',
                                  });
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] active:scale-95 transition-transform text-white font-extrabold border border-[#047857] shrink-0 whitespace-nowrap cursor-pointer shadow-xs text-[11px]"
                              >
                                ✓ Xác nhận duyệt
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* BƯỚC 1: Ô CẮM ĐỊNH VỊ BẢN ĐỒ SỐ (HỖ TRỢ DÁN LINK GOOGLE MAPS HOẶC CHẤM TRỰC TIẾP) */}
                      <div className="p-3.5 rounded-2xl bg-[#E6F7EF]/65 border-2 border-[#39B980] space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#39B980] text-white text-[10px] font-extrabold">
                            <MapPin size={11} /> 1. ĐỊNH VỊ QUÁN TRÊN BẢN ĐỒ
                          </span>

                          {editLat && editLng ? (
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#FFFDF9] border border-[#39B980] text-[11px] font-extrabold text-[#1D7A52] font-mono whitespace-nowrap">
                              ✅ Đã ghim: {Number(editLat).toFixed(5)}, {Number(editLng).toFixed(5)}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#FEF3C7] border border-[#F59E0B] text-[11px] font-bold text-[#92400E] whitespace-nowrap">
                              ⚠️ Chưa định vị
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              triggerFeedback('pin');
                              onStartPickOnMap(
                                activeMerchantPlace.place.id,
                                activeMerchantPlace.place.name
                              );
                            }}
                            className="py-2.5 px-3 rounded-xl bg-[#403064] hover:bg-[#533E80] active:scale-95 transition-transform text-white border-2 border-[#403064] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
                          >
                            <Crosshair size={14} className="text-[#39B980] shrink-0" />
                            <span>🎯 Chấm vị trí trên Bản đồ</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleUseStandingGps}
                            disabled={isGettingGps}
                            className="py-2.5 px-3 rounded-xl bg-[#FFFDF9] hover:bg-[#E6F7EF] active:scale-95 transition-transform text-[#1D7A52] border-2 border-[#403064] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
                          >
                            <Navigation size={14} className="shrink-0" />
                            <span>
                              {isGettingGps
                                ? '⏳ Đang lấy GPS...'
                                : '📱 Lấy GPS nơi đang đứng'}
                            </span>
                          </button>
                        </div>

                        {/* Ô dán Link Google Maps hoặc tọa độ tự động bóc tách lat/lng */}
                        <div className="pt-1">
                          <input
                            type="text"
                            value={editMapsLinkInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditMapsLinkInput(val);
                              const parsed = parseCoordinatesFromInputOrUrl(val);
                              if (parsed) {
                                triggerFeedback('pin');
                                setEditLat(String(parsed.lat));
                                setEditLng(String(parsed.lng));
                                setHasUnsavedChanges(true);
                                setFeedback({
                                  type: 'success',
                                  text: `📍 Đã tự động lấy tọa độ từ Link Maps (${parsed.lat}, ${parsed.lng})! Hãy bấm Lưu bên dưới.`,
                                });
                              }
                            }}
                            placeholder="Hoặc dán Link Google Maps / tọa độ (VD: 21.2805, 105.7261)..."
                            className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#39B980] text-[11px] font-semibold text-[#1E293B]"
                          />
                        </div>
                      </div>

                      {/* BƯỚC 2: TRẠNG THÁI HÔM NAY & THÔNG TIN CƠ BẢN CỦA QUÁN */}
                      <form onSubmit={handleSubmitForApproval} className="space-y-3.5">
                        <div className="p-3.5 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-[#E5DEC9] pb-2">
                            <span className="font-extrabold text-[#403064] flex items-center gap-1.5">
                              <Sparkles size={14} className="text-[#39B980]" />
                              <span>2. Trạng thái hôm nay & Thông tin liên hệ</span>
                            </span>
                            <span className="text-[10px] font-bold text-[#65587F]">
                              Bấm trạng thái để bật ngay
                            </span>
                          </div>

                          {/* Gạt trạng thái mở bán tức thì */}
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                {
                                  id: 'open_normal',
                                  label: '🟢 Đang mở',
                                },
                                {
                                  id: 'busy_hot',
                                  label: '🔥 Đông / Mới',
                                },
                                {
                                  id: 'closed_today',
                                  label: '🟡 Tạm nghỉ',
                                },
                              ] as const
                            ).map((st) => {
                              const active = liveStatus === st.id;
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => handleSaveLiveStatusNow(st.id)}
                                  className="py-2 px-1.5 rounded-xl border-2 font-extrabold text-[11px] active:scale-95 transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1"
                                  style={{
                                    backgroundColor: active ? '#403064' : '#FFFDF9',
                                    borderColor: '#403064',
                                    color: active ? '#FFFFFF' : '#2D2246',
                                  }}
                                >
                                  <span>{st.label}</span>
                                  {active && <span className="text-[#39B980]">✓</span>}
                                </button>
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block font-bold text-[#403064] mb-1">
                                Tên Quán
                              </label>
                              <input
                                type="text"
                                required
                                value={editName}
                                onChange={(e) => {
                                  setEditName(e.target.value);
                                  setHasUnsavedChanges(true);
                                }}
                                className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-[#403064] mb-1">
                                <Phone size={11} className="inline mr-1" />
                                Số điện thoại liên hệ
                              </label>
                              <input
                                type="text"
                                value={editPhone}
                                onChange={(e) => {
                                  setEditPhone(e.target.value);
                                  setHasUnsavedChanges(true);
                                }}
                                placeholder="VD: 0988123456"
                                className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-[#403064] mb-1">
                                <Clock size={11} className="inline mr-1" />
                                Giờ mở cửa - đóng cửa
                              </label>
                              <input
                                type="text"
                                value={editOpenHours}
                                onChange={(e) => {
                                  setEditOpenHours(e.target.value);
                                  setHasUnsavedChanges(true);
                                }}
                                placeholder="VD: 06:30 - 22:00"
                                className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-[#403064] mb-1">
                                Hình thức phục vụ
                              </label>
                              <select
                                value={editServiceMode}
                                onChange={(e) => {
                                  triggerFeedback('tap');
                                  setEditServiceMode(e.target.value as Place['serviceMode']);
                                  setHasUnsavedChanges(true);
                                }}
                                className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold cursor-pointer"
                              >
                                <option value="both">Ăn tại quán & Có nhận Ship</option>
                                <option value="dine_in_only">Chỉ phục vụ tại quán</option>
                                <option value="delivery_only">Chỉ giao hàng (Ship)</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block font-bold text-[#403064] mb-1">
                                Địa chỉ cụ thể
                              </label>
                              <input
                                type="text"
                                value={editAddress}
                                onChange={(e) => {
                                  setEditAddress(e.target.value);
                                  setHasUnsavedChanges(true);
                                }}
                                className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* BƯỚC 3: BẢNG GIÁ CÁC MÓN CÓ SẴN CỦA QUÁN (CHỈ CHỈNH GIÁ & CÒN/HẾT MÓN) */}
                        <div className="p-3.5 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-extrabold text-[#403064] flex items-center gap-1.5">
                              <UtensilsCrossed size={14} className="text-[#39B980]" />
                              <span>3. Món ăn của Quán ({editMenu.length} món)</span>
                            </span>
                            <span className="text-[10px] font-semibold text-[#65587F]">
                              Chỉnh giá (.000đ) hoặc Còn / Hết món
                            </span>
                          </div>

                          <div className="max-h-48 overflow-y-auto divide-y divide-[#E5DEC9] rounded-xl bg-[#FFFDF9] border border-[#E5DEC9]">
                            {editMenu.map((dish, idx) => (
                              <div
                                key={dish.id || idx}
                                className="px-3 py-2 flex items-center justify-between gap-2"
                              >
                                <span className="flex-1 min-w-0 font-bold text-[#2D2246] truncate">
                                  {dish.name}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    type="number"
                                    value={dish.price}
                                    onChange={(e) => {
                                      const next = [...editMenu];
                                      next[idx] = {
                                        ...next[idx],
                                        price: Number(e.target.value),
                                      };
                                      setEditMenu(next);
                                      setHasUnsavedChanges(true);
                                    }}
                                    className="w-14 px-2 py-1 rounded-lg bg-[#F8F5EE] border border-[#D8CFC0] text-right font-extrabold text-[#1D7A52]"
                                  />
                                  <span className="text-[11px] font-bold text-[#65587F]">.000đ</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerFeedback('tap');
                                      const next = [...editMenu];
                                      next[idx] = {
                                        ...next[idx],
                                        isLocked: !next[idx].isLocked,
                                      };
                                      setEditMenu(next);
                                      setHasUnsavedChanges(true);
                                    }}
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold border active:scale-95 transition-transform whitespace-nowrap cursor-pointer"
                                    style={{
                                      backgroundColor: dish.isLocked ? '#FEF3C7' : '#E6F7EF',
                                      borderColor: dish.isLocked ? '#F59E0B' : '#39B980',
                                      color: dish.isLocked ? '#92400E' : '#1D7A52',
                                    }}
                                  >
                                    {dish.isLocked ? '⏳ Tạm hết' : '✓ Còn món'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="sticky -bottom-3.5 sm:-bottom-5 z-20 flex items-center gap-2 pt-2.5 pb-1 bg-[#FFFDF9]/95 backdrop-blur-xs border-t border-[#E5DEC9]">
                          <button
                            type="button"
                            onClick={() => {
                              triggerFeedback('tap');
                              onClose();
                            }}
                            className="px-4 py-2.5 rounded-xl bg-[#F1ECE1] hover:bg-[#E5DEC9] active:scale-95 transition-transform text-[#403064] font-bold whitespace-nowrap cursor-pointer"
                          >
                            Đóng
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-2.5 px-4 rounded-xl text-white border-2 border-[#047857] font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all whitespace-nowrap cursor-pointer"
                            style={{
                              backgroundColor: justSubmitted
                                ? '#047857'
                                : hasUnsavedChanges
                                ? '#10B981'
                                : '#39B980',
                            }}
                          >
                            {justSubmitted ? (
                              <>
                                <CheckCircle2 size={15} />
                                <span>ĐÃ LƯU CẬP NHẬT THÀNH CÔNG!</span>
                              </>
                            ) : (
                              <>
                                <Send size={14} />
                                <span>
                                  {hasUnsavedChanges
                                    ? '✨ Lưu & Cập Nhật Lên Bản Đồ Ngay'
                                    : 'Lưu & Cập Nhật Lên Bản Đồ'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
            </>
          )}

          {/* ================================================================= */}
          {/* TAB 1B: THÊM ĐỊA ĐIỂM MỚI THEO DANH MỤC (QUẢN LÝ MAPS & ADMIN)    */}
          {/* ================================================================= */}
          {activeTab === 'create_new' && canManageAllPlaces && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const parsedFromLink = parseCoordinatesFromInputOrUrl(newPlaceMapsLink);
                  const finalLat = newPlaceLat.trim()
                    ? parseFloat(newPlaceLat)
                    : parsedFromLink?.lat ?? NaN;
                  const finalLng = newPlaceLng.trim()
                    ? parseFloat(newPlaceLng)
                    : parsedFromLink?.lng ?? NaN;

                  if (!Number.isFinite(finalLat) || !Number.isFinite(finalLng)) {
                    triggerFeedback('warn');
                    setFeedback({
                      type: 'error',
                      text: 'Vui lòng dán Link Google Maps có tọa độ hoặc bấm "🎯 Chấm vị trí trên Bản đồ" trước khi lưu.',
                    });
                    return;
                  }

                  const created = createNewPlaceFromMap(authUser, {
                    name: newPlaceName,
                    mapCategory: newPlaceCategory,
                    address: newPlaceAddress,
                    phone: newPlacePhone,
                    openHours: newPlaceHours,
                    lat: finalLat,
                    lng: finalLng,
                    mapsUrl: newPlaceMapsLink,
                    signatureDishName: newPlaceSigDish,
                    signatureDishPrice: newPlaceSigPrice,
                  });

                  triggerFeedback('approve');
                  setRefreshKey((k) => k + 1);
                  onDataChanged();
                  setSelectedPlaceId(created.place.id);
                  setNewPlaceName('');
                  setNewPlaceAddress('');
                  setNewPlacePhone('');
                  setNewPlaceMapsLink('');
                  setNewPlaceLat('');
                  setNewPlaceLng('');
                  setNewPlaceSigDish('');

                  setFeedback({
                    type: 'success',
                    text: `✅ Đã tạo & ghim "${created.place.name}" lên Bản đồ số thành công! Admin có thể kiểm soát và nâng cấp ảnh / thực đơn bất cứ lúc nào.`,
                    actionLabel: '🗺️ Bay tới vị trí vừa tạo',
                    onAction: () => {
                      triggerFeedback('pin');
                      onFlyToCoordinates(finalLat, finalLng, 17.2, created.place.name);
                      onClose();
                    },
                  });
                } catch (err: any) {
                  triggerFeedback('warn');
                  setFeedback({
                    type: 'error',
                    text: err?.message || 'Không thể tạo địa điểm mới.',
                  });
                }
              }}
              className="space-y-3.5"
            >
              {/* 1. CHỌN TAG DANH MỤC ĐỊA ĐIỂM */}
              <div className="p-3.5 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] space-y-2.5">
                <div className="font-extrabold text-[#2D2246] flex items-center justify-between">
                  <span>1. Chọn Danh mục (Tag) hiển thị trên Bản đồ</span>
                  <span className="text-[10.5px] text-[#047857] font-bold">
                    13 nhóm danh mục chuẩn
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {MAP_CATEGORIES.filter((c) => c.id !== 'all' && c.id !== 'game_asset').map(
                    (cat) => {
                      const active = newPlaceCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            triggerFeedback('tap');
                            setNewPlaceCategory(cat.id);
                          }}
                          className="p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                          style={{
                            backgroundColor: active ? '#403064' : '#FFFDF9',
                            borderColor: active ? '#403064' : '#D8CFC0',
                            color: active ? '#FFFFFF' : '#1E293B',
                          }}
                        >
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: cat.markerBg }}
                          >
                            {renderCategoryIcon(cat.iconName, 13)}
                          </span>
                          <span className="font-bold text-[11px] truncate">
                            {cat.id === 'public' ? 'Hành chính / Công cộng' : cat.shortLabel}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 2. ĐỊNH VỊ TỌA ĐỘ: DÁN LINK GOOGLE MAPS HOẶC CHẤM TRÊN BẢN ĐỒ */}
              <div className="p-3.5 rounded-2xl bg-[#E6F7EF]/65 border-2 border-[#39B980] space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#39B980] text-white text-[10px] font-extrabold">
                    <MapPin size={11} /> 2. VỊ TRÍ ĐỊNH VỊ (LINK MAPS HOẶC CẮM GHIM)
                  </span>
                  {newPlaceLat && newPlaceLng ? (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#FFFDF9] border border-[#39B980] text-[11px] font-extrabold text-[#1D7A52] font-mono">
                      ✅ Tọa độ: {Number(newPlaceLat).toFixed(5)}, {Number(newPlaceLng).toFixed(5)}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#FEF3C7] border border-[#F59E0B] text-[11px] font-bold text-[#92400E]">
                      Chưa chọn tọa độ
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#047857] mb-1 text-[11px]">
                    Dán Link Google Maps hoặc Tọa độ (tự động nhận diện Vĩ độ, Kinh độ):
                  </label>
                  <input
                    type="text"
                    value={newPlaceMapsLink}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewPlaceMapsLink(val);
                      const parsed = parseCoordinatesFromInputOrUrl(val);
                      if (parsed) {
                        triggerFeedback('pin');
                        setNewPlaceLat(String(parsed.lat));
                        setNewPlaceLng(String(parsed.lng));
                      }
                    }}
                    placeholder="Dán link Google Maps hoặc nhập VD: 21.280512, 105.726189"
                    className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#39B980] font-semibold text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerFeedback('pin');
                      onStartPickOnMap(
                        '__new_place__',
                        newPlaceName.trim() || 'Địa điểm mới đang thêm'
                      );
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#403064] hover:bg-[#533E80] active:scale-95 transition-transform text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Crosshair size={14} className="text-[#39B980]" />
                    <span>🎯 Chấm vị trí trên Bản đồ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
                      setIsGettingGps(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setIsGettingGps(false);
                          triggerFeedback('approve');
                          const lat = Number(pos.coords.latitude.toFixed(6));
                          const lng = Number(pos.coords.longitude.toFixed(6));
                          setNewPlaceLat(String(lat));
                          setNewPlaceLng(String(lng));
                        },
                        () => setIsGettingGps(false),
                        { enableHighAccuracy: true, timeout: 10000 }
                      );
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#FFFDF9] hover:bg-[#E6F7EF] active:scale-95 transition-transform text-[#1D7A52] border-2 border-[#403064] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Navigation size={14} />
                    <span>{isGettingGps ? '⏳ Đang lấy GPS...' : '📱 Lấy GPS nơi đang đứng'}</span>
                  </button>
                </div>
              </div>

              {/* 3. THÔNG TIN CƠ BẢN CỦA ĐỊA ĐIỂM MỚI */}
              <div className="p-3.5 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#403064] mb-1">
                    Tên Quán / Đơn vị hành chính / Địa điểm *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPlaceName}
                    onChange={(e) => setNewPlaceName(e.target.value)}
                    placeholder="VD: UBND Phường Xuân Hòa / Phở Bò Gia Truyền..."
                    className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#403064] mb-1">
                    Địa chỉ cụ thể *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPlaceAddress}
                    onChange={(e) => setNewPlaceAddress(e.target.value)}
                    placeholder="VD: Số 10 Đường Phạm Văn Đồng, Phường Xuân Hòa"
                    className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#403064] mb-1">
                    Số điện thoại (nếu có)
                  </label>
                  <input
                    type="text"
                    value={newPlacePhone}
                    onChange={(e) => setNewPlacePhone(e.target.value)}
                    placeholder="VD: 0988123456"
                    className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#403064] mb-1">
                    Giờ mở cửa / Làm việc
                  </label>
                  <input
                    type="text"
                    value={newPlaceHours}
                    onChange={(e) => setNewPlaceHours(e.target.value)}
                    placeholder="VD: 07:00 - 22:00"
                    className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#403064] mb-1">
                    Món đặc trưng / Ghi chú chính
                  </label>
                  <input
                    type="text"
                    value={newPlaceSigDish}
                    onChange={(e) => setNewPlaceSigDish(e.target.value)}
                    placeholder="VD: Cơm rang dưa bò / Trụ sở hành chính công..."
                    className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#403064] mb-1">
                    Giá tham khảo (.000đ)
                  </label>
                  <input
                    type="number"
                    value={newPlaceSigPrice}
                    onChange={(e) => setNewPlaceSigPrice(Number(e.target.value) || 35)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#403064] font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] active:scale-95 transition-transform text-white border-2 border-[#047857] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Lưu & Hiển Thị Ngay Lên Bản Đồ Số</span>
              </button>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB 2: ADMIN DUYỆT THAY ĐỔI TỪ CHỦ QUÁN (GỌN, CÂN ĐỐI, RÕ RÀNG)   */}
          {/* ================================================================= */}
          {activeTab === 'admin_approvals' && isAdminUser && (
            <div className="space-y-3">
              {/* THANH TỔNG QUAN & NÚT DUYỆT NHANH GỌN GÀNG */}
              <div className="p-3 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="font-extrabold text-[#2D2246] text-xs sm:text-sm">
                    Danh sách cập nhật từ Chủ quán & Quản lý Maps
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/40 text-[#92400E] text-[11px] font-extrabold whitespace-nowrap">
                    {pendingSubmissions.length} chờ duyệt
                  </span>
                </div>

                {pendingSubmissions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerFeedback('approve');
                      const count = approveAllPendingMerchantSubmissions();
                      setRefreshKey((k) => k + 1);
                      onDataChanged();
                      setFeedback({
                        type: 'success',
                        text: `⚡ Đã xác nhận duyệt toàn bộ ${count} cập nhật lên Bản đồ số!`,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] active:scale-95 transition-transform text-white border-2 border-[#403064] font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-xs whitespace-nowrap cursor-pointer"
                  >
                    <Check size={13} className="shrink-0" />
                    <span>Duyệt tất cả ({pendingSubmissions.length})</span>
                  </button>
                )}
              </div>

              {allSubmissions.length === 0 ? (
                <div className="p-7 text-center rounded-2xl bg-[#F8F5EE] border border-dashed border-[#D8CFC0] text-[#65587F]">
                  Hiện chưa có bản cập nhật mới nào từ Chủ quán hoặc Quản lý Maps.
                </div>
              ) : (
                <div className="space-y-3">
                  {allSubmissions.map((sub) => {
                    const isPending = sub.status === 'pending';
                    return (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-2xl border-2 space-y-2.5 transition-all"
                        style={{
                          backgroundColor: isPending
                            ? '#FFFDF9'
                            : sub.status === 'approved'
                            ? '#F2FBF7'
                            : '#F8F5EE',
                          borderColor: isPending
                            ? '#403064'
                            : sub.status === 'approved'
                            ? '#39B980'
                            : '#D8CFC0',
                        }}
                      >
                        {/* HÀNG TIÊU ĐỀ QUÁN + TRẠNG THÁI */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-extrabold text-[#2D2246] truncate">
                              🏪 {sub.proposed.name}
                            </h4>
                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[#65587F] mt-0.5">
                              <span className="font-semibold text-[#403064]">
                                {sub.merchantEmail}
                              </span>
                              <span>•</span>
                              <span className="px-1.5 py-0.2 rounded bg-[#F3EFE6] border border-[#D8CFC0] font-mono text-[10px] font-bold text-[#403064]">
                                {sub.claimCodeUsed}
                              </span>
                            </div>
                          </div>

                          <span
                            className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold shrink-0 whitespace-nowrap"
                            style={{
                              backgroundColor:
                                sub.status === 'pending'
                                  ? '#FEF3C7'
                                  : sub.status === 'approved'
                                  ? '#39B980'
                                  : '#FEE2E2',
                              color:
                                sub.status === 'pending'
                                  ? '#92400E'
                                  : sub.status === 'approved'
                                  ? '#FFFFFF'
                                  : '#991B1B',
                            }}
                          >
                            {sub.status === 'pending'
                              ? '⏳ Chờ duyệt'
                              : sub.status === 'approved'
                              ? '✅ Đã duyệt lên Bản đồ'
                              : '❌ Từ chối'}
                          </span>
                        </div>

                        {/* NÚT XEM VỊ TRÍ TRÊN BẢN ĐỒ + ĐỊA CHỈ */}
                        <div className="p-2.5 rounded-xl bg-[#F8F5EE] border border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="text-[11px] text-[#2D2246] min-w-0">
                            <span className="text-[#65587F] font-semibold">Địa chỉ: </span>
                            <strong className="break-words">{sub.proposed.address}</strong>
                          </div>

                          {sub.proposed.lat !== null && sub.proposed.lng !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerFeedback('pin');
                                onFlyToCoordinates(
                                  sub.proposed.lat!,
                                  sub.proposed.lng!,
                                  17.2,
                                  `📍 Vị trí Quán: ${sub.proposed.name}`
                                );
                                onClose();
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#EDE9FE] hover:bg-[#DDD6FE] active:scale-95 transition-transform text-[#403064] border border-[#403064] font-extrabold text-[11px] flex items-center justify-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>Xem ghim trên Bản đồ</span>
                            </button>
                          )}
                        </div>

                        {/* BẢNG ĐỐI CHIẾU 2 CỘT CÂN ĐỐI (TRƯỚC ĐÓ <-> ĐỀ XUẤT MỚI) */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-[#F8F5EE] border border-[#E5DEC9] space-y-1">
                            <div className="font-extrabold text-[#65587F] uppercase text-[9.5px] tracking-wide border-b border-[#E5DEC9] pb-1">
                              Trước đó
                            </div>
                            <div className="truncate">
                              <span className="text-[#65587F]">Giờ: </span>
                              <strong>{sub.previous.openHours || 'Chưa rõ'}</strong>
                            </div>
                            <div className="truncate">
                              <span className="text-[#65587F]">SĐT: </span>
                              <strong>{sub.previous.phone || 'Chưa có'}</strong>
                            </div>
                            <div className="truncate">
                              <span className="text-[#65587F]">Định vị: </span>
                              <strong className="font-mono text-[10.5px]">
                                {sub.previous.lat !== null
                                  ? `${Number(sub.previous.lat).toFixed(4)}, ${Number(sub.previous.lng).toFixed(4)}`
                                  : 'Chưa có'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#65587F]">Menu: </span>
                              <strong>{sub.previous.menuCount} món</strong>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#E6F7EF]/60 border border-[#39B980] space-y-1">
                            <div className="font-extrabold text-[#1D7A52] uppercase text-[9.5px] tracking-wide border-b border-[#39B980]/30 pb-1">
                              Thông tin cập nhật
                            </div>
                            <div className="truncate">
                              <span className="text-[#1D7A52]">Giờ: </span>
                              <strong>{sub.proposed.openHours}</strong>
                            </div>
                            <div className="truncate">
                              <span className="text-[#1D7A52]">SĐT: </span>
                              <strong>{sub.proposed.phone || 'Chưa có'}</strong>
                            </div>
                            <div className="truncate">
                              <span className="text-[#1D7A52]">Định vị: </span>
                              <strong className="font-mono text-[10.5px] text-[#1D7A52]">
                                {sub.proposed.lat !== null
                                  ? `${Number(sub.proposed.lat).toFixed(4)}, ${Number(sub.proposed.lng).toFixed(4)}`
                                  : 'Giữ nguyên'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#1D7A52]">Menu: </span>
                              <strong>
                                {sub.proposed.customMenu?.length || sub.previous.menuCount} món
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* NÚT HÀNH ĐỘNG 1 HÀNG CÂN ĐỐI */}
                        {isPending ? (
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                triggerFeedback('warn');
                                rejectMerchantSubmission(sub.id);
                                setRefreshKey((k) => k + 1);
                                onDataChanged();
                                setFeedback({
                                  type: 'info',
                                  text: `Đã từ chối yêu cầu cập nhật của quán "${sub.proposed.name}".`,
                                });
                              }}
                              className="px-3.5 py-2.5 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] active:scale-95 transition-transform text-[#991B1B] border border-[#EF4444]/40 font-extrabold text-xs flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <XCircle size={14} />
                              <span>Từ chối</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                triggerFeedback('approve');
                                approveMerchantSubmission(sub.id);
                                setRefreshKey((k) => k + 1);
                                onDataChanged();
                                setFeedback({
                                  type: 'success',
                                  text: `✅ Đã duyệt "${sub.proposed.name}"! Quán đã được ghim lên Bản đồ số.`,
                                  actionLabel:
                                    sub.proposed.lat !== null && sub.proposed.lng !== null
                                      ? '🗺️ Xem trên Bản đồ'
                                      : undefined,
                                  onAction:
                                    sub.proposed.lat !== null && sub.proposed.lng !== null
                                      ? () => {
                                          triggerFeedback('pin');
                                          onFlyToCoordinates(
                                            sub.proposed.lat!,
                                            sub.proposed.lng!,
                                            17.2,
                                            `📍 Đã duyệt: ${sub.proposed.name}`
                                          );
                                          onClose();
                                        }
                                      : undefined,
                                });
                              }}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] active:scale-95 transition-transform text-white border-2 border-[#403064] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                            >
                              <Check size={14} className="shrink-0" />
                              <span>Duyệt & Cập nhật Bản đồ</span>
                            </button>
                          </div>
                        ) : (
                          sub.status === 'approved' &&
                          sub.proposed.lat !== null &&
                          sub.proposed.lng !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerFeedback('pin');
                                onFlyToCoordinates(
                                  sub.proposed.lat!,
                                  sub.proposed.lng!,
                                  17.2,
                                  `📍 Đã duyệt: ${sub.proposed.name}`
                                );
                                onClose();
                              }}
                              className="w-full py-2 px-3 rounded-xl bg-[#E6F7EF] hover:bg-[#D1F2E3] active:scale-95 transition-transform text-[#1D7A52] border border-[#39B980] font-extrabold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <MapPin size={13} />
                              <span>🗺️ Đã ghim thành công • Bấm để bay tới vị trí Quán trên Bản đồ</span>
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: ADMIN CẤP QUYỀN CHỦ QUÁN & QUẢN LÝ MAPS                    */}
          {/* ================================================================= */}
          {activeTab === 'admin_codes' && isAdminUser && (
            <div className="space-y-3">
              {/* THẺ MÃ QUẢN LÝ MAPS CHUYÊN BIỆT */}
              <div className="p-3 rounded-2xl bg-[#E6F7EF] border-2 border-[#39B980] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-extrabold text-[#047857] flex items-center gap-1.5">
                    <span>🗺️ Mã Quản lý Maps & Cộng tác viên Định vị</span>
                    <span className="px-2 py-0.5 rounded-lg bg-[#FFFDF9] border border-[#39B980] font-mono text-xs font-black text-[#047857]">
                      {MAP_MANAGER_MASTER_CODE}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1D7A52] mt-0.5">
                    Người nhập mã này được vào Bản đồ, chỉnh định vị các quán và thêm địa điểm mới theo danh mục (không có quyền xóa dữ liệu).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('success');
                    navigator.clipboard?.writeText(MAP_MANAGER_MASTER_CODE);
                    setFeedback({
                      type: 'success',
                      text: `🗺️ Đã sao chép Mã Quản lý Maps: ${MAP_MANAGER_MASTER_CODE}`,
                    });
                  }}
                  className="px-3 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white font-extrabold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Sao chép mã Maps</span>
                </button>
              </div>

              <datalist id="merchant-member-emails-datalist">
                {Object.values(adminState.members || {}).map((m) => (
                  <option key={m.email} value={m.email}>
                    {m.nickname || m.displayName} ({m.email})
                  </option>
                ))}
              </datalist>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[#475569]">
                    Danh sách Mã định danh cấp cho Chủ quán ({allManagedPlaces.length} quán)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerFeedback('success');
                      const lines = allManagedPlaces.map((item, idx) => {
                        const c = getOrGenerateMerchantCode(item.place.id, false);
                        return `${idx + 1}. ${item.place.name} — Mã: ${c} (${item.place.address || 'Xuân Hòa'})`;
                      });
                      const fullText = `DANH SÁCH MÃ ĐỊNH DANH CHỦ QUÁN — BẢN ĐỒ SỐ XUÂN HÒA\n\n${lines.join('\n')}`;
                      navigator.clipboard?.writeText(fullText);
                      setFeedback({
                        type: 'success',
                        text: `✅ Đã sao chép toàn bộ ${allManagedPlaces.length} quán kèm Mã định danh chuẩn vào bộ nhớ tạm.`,
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[#E6F7EF] hover:bg-[#D1F2E3] active:scale-95 transition-transform text-[#047857] border border-[#39B980] font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Copy size={12} />
                    <span>Sao chép toàn bộ danh sách</span>
                  </button>
                  <a
                    href="/Danh_Sach_86_Quan_Va_Ma_Code_XuanHoaCoGi.xlsx"
                    download="Danh_Sach_Quan_Va_Ma_Code_XuanHoaCoGi.xlsx"
                    onClick={() => triggerFeedback('success')}
                    className="px-2.5 py-1.5 rounded-xl bg-[#047857] hover:bg-[#065F46] active:scale-95 transition-transform text-white border border-[#047857] font-extrabold text-[11px] flex items-center gap-1 cursor-pointer no-underline"
                  >
                    <Download size={12} />
                    <span>Xuất file Excel (.xlsx)</span>
                  </a>
                </div>
                <input
                  type="text"
                  value={adminCodeSearch}
                  onChange={(e) => setAdminCodeSearch(e.target.value)}
                  placeholder="Tìm tên quán, địa chỉ, mã..."
                  className="px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#CBD5E1] font-bold text-xs sm:w-60"
                />
              </div>

              <div className="max-h-[54vh] overflow-y-auto divide-y divide-[#E5DEC9] rounded-2xl border-2 border-[#403064] bg-[#FFFDF9]">
                {filteredAdminPlaces.map((item) => {
                  const p = item.place;
                  const ov = adminState.places?.[p.id];
                  const code = getOrGenerateMerchantCode(p.id, false);
                  const isCoordVerified = Boolean(ov?.coordinateVerified && ov?.lat && ov?.lng);
                  const emailDraft =
                    directEmailInputs[p.id] !== undefined
                      ? directEmailInputs[p.id]
                      : ov?.claimedByEmail || '';

                  return (
                    <div
                      key={p.id}
                      className="p-3 hover:bg-[#F8F5EE] flex flex-col gap-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-[#2D2246]">{p.name}</span>
                            {isCoordVerified ? (
                              <span className="px-2 py-0.5 rounded-md bg-[#E6F7EF] text-[#1D7A52] text-[10px] font-bold">
                                📍 Đã có định vị
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold">
                                Chưa cắm định vị
                              </span>
                            )}
                            {ov?.claimedByEmail && (
                              <span className="px-2 py-0.5 rounded-md bg-[#EDE9FE] text-[#403064] text-[10px] font-bold">
                                👑 Chủ quán: {ov.claimedByEmail}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#65587F] truncate mt-0.5">
                            {p.address}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <span className="px-2.5 py-1.5 rounded-xl bg-[#F3EFE6] border border-[#403064] font-mono text-xs font-black text-[#403064] whitespace-nowrap">
                            {code}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyCode(p.id, p.name, true)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] active:scale-95 transition-transform text-white border border-[#403064] font-extrabold text-[11px] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                            title="Copy Link Nhận Quán 1 Chạm để gửi Zalo cho chủ quán (Chủ quán bấm vào link là nhận quán luôn)"
                          >
                            <Copy size={12} className="shrink-0" />
                            <span>
                              {copiedCodeId === `${p.id}_guide`
                                ? '✓ Đã copy Link!'
                                : '📲 Copy Link 1 Chạm'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyCode(p.id, p.name, false)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#403064] hover:bg-[#533E80] active:scale-95 transition-transform text-white font-bold text-[11px] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                          >
                            <Copy size={12} className="shrink-0" />
                            <span>{copiedCodeId === p.id ? '✓ Đã copy!' : 'Mã'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              triggerFeedback('tap');
                              const nextCode = getOrGenerateMerchantCode(p.id, true, p.name);
                              setRefreshKey((k) => k + 1);
                              onDataChanged();
                              setFeedback({
                                type: 'info',
                                text: `🔄 Đã cấp mã mới cho "${p.name}": ${nextCode} (Đã hủy liên kết Gmail cũ nếu có).`,
                              });
                            }}
                            className="p-1.5 rounded-xl bg-[#F1ECE1] hover:bg-[#E5DEC9] active:scale-95 transition-transform text-[#403064] shrink-0 cursor-pointer"
                            title="Đổi mã code mới & Thu hồi quyền Gmail cũ"
                          >
                            <RefreshCw size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Dòng gán thẳng Gmail Chủ Quán 1 chạm (Không cần mã) */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="email"
                          list="merchant-member-emails-datalist"
                          value={emailDraft}
                          onChange={(e) =>
                            setDirectEmailInputs((prev) => ({
                              ...prev,
                              [p.id]: e.target.value,
                            }))
                          }
                          placeholder="Gán thẳng Gmail chủ quán (VD: tenchuquan@gmail.com)..."
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-[#F8F5EE] border border-[#D8CFC0] text-[11px] font-semibold text-[#2D2246]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            triggerFeedback('approve');
                            const clean = (emailDraft || '').trim().toLowerCase();
                            assignMerchantOwnerByEmail(p.id, clean, p.name);
                            setRefreshKey((k) => k + 1);
                            onDataChanged();
                            setJustSavedEmailId(p.id);
                            setTimeout(() => setJustSavedEmailId(null), 2000);
                            setFeedback({
                              type: 'success',
                              text: clean
                                ? `👑 Đã gán thẳng quyền Chủ Quán "${p.name}" cho Gmail: ${clean}!`
                                : `🔓 Đã gỡ quyền Chủ Quán của "${p.name}".`,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl border border-[#403064] font-extrabold text-[11px] active:scale-95 transition-all whitespace-nowrap cursor-pointer shrink-0"
                          style={{
                            backgroundColor:
                              justSavedEmailId === p.id ? '#39B980' : '#EDE9FE',
                            color: justSavedEmailId === p.id ? '#FFFFFF' : '#403064',
                          }}
                        >
                          {justSavedEmailId === p.id
                            ? '✓ Đã gán!'
                            : emailDraft.trim()
                            ? 'Gán Gmail'
                            : 'Gỡ Gmail'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
