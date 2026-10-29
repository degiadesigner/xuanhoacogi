import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  X,
  Crosshair,
  Search as SearchIcon,
  Store,
  Bell,
  Navigation,
  KeyRound,
  Lock,
  Unlock,
  Eye,
  LogIn,
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  Settings,
} from 'lucide-react';
import type { Place } from '@/lib/places-xuanhoa';
import type { UserAuthProfile } from '@/lib/auth';
import {
  isAdminAuthenticated,
  isMapManagerAuthenticated,
  updatePlaceCoordinates,
  clearPlaceCoordinates,
  getAllMerchantSubmissions,
  getClaimedPlacesForUser,
  getAllManagedPlaces,
  getDigitalMapAccessStatus,
  setMapAccessMode,
  verifyAndClaimPlaceWithCode,
  getOrGenerateMerchantCode,
} from '@/lib/admin-store';
import { triggerFeedback } from '@/lib/ui-feedback';
import { PlaceModal } from '@/components/PlaceModal';
import type {
  GameAsset,
  MapAreaPreset,
  MapCategoryKey,
  MapLayerVisibility,
  PlaceLocation,
  RoadSearchResult,
} from '@/lib/map/map-types';
import { MAP_CATEGORY_BY_ID } from '@/lib/map/map-categories';
import {
  DEFAULT_LAYER_VISIBILITY,
  MAP_DATA_SOURCE_CONFIG,
  XUHO_PASTEL_THEME,
  XUANHOA_DEFAULT_CENTER,
  XUANHOA_MAX_BOUNDS,
  buildXuhoPastelMapStyle,
} from '@/lib/map/map-config';
import {
  DEMO_GAME_ASSETS,
  VERIFIED_OSM_POIS,
  VERIFIED_OSM_ROADS_SEED,
  buildDataQualityReport,
  calculateDistanceAndEta,
  computeLocalRoadRoute,
  evaluatePlaceOpenStatus,
  findSuggestedRoadForAddress,
  geocodeAddressWithNominatim,
  getAllMapPlaceLocations,
  getSavedPlaceIdsForUser,
  toggleSavedPlaceForUser,
  getUserHomeForUser,
  saveUserHomeForUser,
  clearUserHomeForUser,
  haversineDistanceMeters,
  parseCoordinatesFromInputOrUrl,
  saveLandmarkOrPlaceFromMap,
  hideLandmarkOrPlaceFromMap,
  restoreLandmarkOrPlaceDefault,
  type DistanceAndEtaResult,
  type TravelMode,
  type UserHomeLocation,
} from '@/lib/map/map-data';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { MapCategoryPanel, renderCategoryIcon } from '@/components/map/MapCategoryPanel';
import { MapPlacePopup } from '@/components/map/MapPlacePopup';
import { MapControls } from '@/components/map/MapControls';
import { City3DView } from '@/components/map/city3d/City3DView';
import { GameAssetLayer } from '@/components/map/GameAssetLayer';
import { MerchantPortalModal } from '@/components/map/MerchantPortalModal';

interface DigitalMapViewProps {
  onBackToHome: () => void;
  authUser?: UserAuthProfile | null;
  onOpenLogin?: () => void;
}

interface ScreenClusterItem {
  id: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  primary: PlaceLocation;
  members: PlaceLocation[];
}

interface RoadLabelAnchor {
  name: string;
  tier: string;
  isAlley: boolean;
  halfW: number;
  roadSpanDeg: number;
  lng: number;
  lat: number;
  dirLng: number;
  dirLat: number;
}

interface LoadedGeoLayers {
  boundary: any[];
  landuse: any[];
  water: any[];
  waterways: any[];
  roads: any[];
  roadsMajor: any[];
  roadsSecondary: any[];
  roadsMinor: any[];
  roadsAlley: any[];
  buildings: any[];
  landmarkBuildings: any[];
  regularBuildings: any[];
  placeLabels: any[];
  roadLabelAnchors?: RoadLabelAnchor[];
}

export const DigitalMapView: React.FC<DigitalMapViewProps> = ({
  onBackToHome,
  authUser = null,
  onOpenLogin,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const vectorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const markerOverlayRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const geoLayersRef = useRef<LoadedGeoLayers | null>(null);
  const canvasDimsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const isInteractingRef = useRef<boolean>(false);
  const hasUserInteractedRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  // Refs khóa cứng 100% tọa độ Marker DOM theo từng frame của MapLibre (0 độ trễ, 0 nhảy vị trí!)
  const markerElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const markerLabelElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const gameAssetElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const userMarkerElRef = useRef<HTMLDivElement | null>(null);
  const userHomeMarkerElRef = useRef<HTMLDivElement | null>(null);
  const filteredVerifiedMarkersRef = useRef<PlaceLocation[]>([]);
  const userCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const userHomeRef = useRef<UserHomeLocation | null>(null);
  const selectedPlaceIdRef = useRef<string | null>(null);
  const hoveredPlaceIdRef = useRef<string | null>(null);

  // Chế độ Tiêu điểm 3D (Spotlight 3D Focus)
  const focusTargetRef = useRef<{
    lat: number;
    lng: number;
    radiusDeg: number;
    label: string;
  }>({
    lat: XUANHOA_DEFAULT_CENTER.lat,
    lng: XUANHOA_DEFAULT_CENTER.lng,
    radiusDeg: 0.0085,
    label: '🎓 Khu ĐH Sư Phạm 2',
  });
  const [focusZoneLabel, setFocusZoneLabel] = useState<string>('🎓 Khu ĐH Sư Phạm 2');
  const highlightedRoadNameRef = useRef<string>('');

  // Trạng thái bản đồ & kết nối (Phần 12)
  const [isMapLoading, setIsMapLoading] = useState<boolean>(true);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  userCoordsRef.current = userCoords;

  // Dữ liệu địa điểm & đường phố thực tế
  const [syncTick, setSyncTick] = useState<number>(0);
  const [osmRoads, setOsmRoads] = useState<RoadSearchResult[]>(VERIFIED_OSM_ROADS_SEED);
  const [osmRoadMatchedCatalog, setOsmRoadMatchedCatalog] = useState<
    Record<string, { lat: number; lng: number; roadName: string; osmId: string }>
  >({});
  const [selectedCategories, setSelectedCategories] = useState<MapCategoryKey[]>(['public', 'school']);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState<boolean>(false);
  const [isCategoryDropdown2DOpen, setIsCategoryDropdown2DOpen] = useState<boolean>(false);
  const [isSavedDropdown2DOpen, setIsSavedDropdown2DOpen] = useState<boolean>(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState<boolean>(true);

  // Định danh tài khoản (nick) hiện tại để lưu địa điểm yêu thích (★) riêng cho từng nick
  const userAccountKey = useMemo(
    () => authUser?.email || authUser?.nickname || authUser?.displayName || 'guest',
    [authUser?.email, authUser?.nickname, authUser?.displayName]
  );
  const userAccountLabel = useMemo(
    () => authUser?.nickname || authUser?.displayName || authUser?.email || 'Tài khoản của bạn',
    [authUser?.nickname, authUser?.displayName, authUser?.email]
  );
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>(() =>
    getSavedPlaceIdsForUser(authUser?.email || authUser?.nickname || authUser?.displayName || 'guest')
  );
  const [userHome, setUserHome] = useState<UserHomeLocation | null>(() =>
    getUserHomeForUser(authUser?.email || authUser?.nickname || authUser?.displayName || 'guest')
  );
  userHomeRef.current = userHome;

  // Trạng thái Hộp thoại "Chỗ bạn sinh sống (Nhà của bạn)" khi ấn vào biểu tượng Ngôi nhà
  const [homeModalMode, setHomeModalMode] = useState<'closed' | 'view' | 'edit' | 'picking'>('closed');
  const [homeLabelInput, setHomeLabelInput] = useState<string>('Nhà của bạn');
  const [homeAddressInput, setHomeAddressInput] = useState<string>('');
  const [homeMapsInput, setHomeMapsInput] = useState<string>('');
  const [homeLatInput, setHomeLatInput] = useState<string>('');
  const [homeLngInput, setHomeLngInput] = useState<string>('');
  const [homeFeedback, setHomeFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSavedPlaceIds(getSavedPlaceIdsForUser(userAccountKey));
    setUserHome(getUserHomeForUser(userAccountKey));
  }, [userAccountKey, syncTick]);

  // Tự động thu gọn bảng báo "Đang vào Bản đồ số Phường Xuân Hòa" sau 1.1 giây khi đã tải xong
  useEffect(() => {
    if (!isMapLoading) {
      const t = window.setTimeout(() => setShowWelcomeBanner(false), 950);
      return () => window.clearTimeout(t);
    }
  }, [isMapLoading]);

  const handleToggleSavePlace = useCallback(
    (place: PlaceLocation) => {
      triggerFeedback('tap');
      const res = toggleSavedPlaceForUser(userAccountKey, place.id);
      setSavedPlaceIds(res.savedIds);
      setLocationNotice(
        res.isSavedNow
          ? `★ Đã lưu "${place.name}" vào danh sách của ${userAccountLabel}`
          : `Đã bỏ lưu "${place.name}"`
      );
      window.setTimeout(() => setLocationNotice(null), 2800);
    },
    [userAccountKey, userAccountLabel]
  );
  const [layerVisibility, setLayerVisibility] = useState<MapLayerVisibility>(
    DEFAULT_LAYER_VISIBILITY
  );
  const layerVisibilityRef = useRef<MapLayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  layerVisibilityRef.current = layerVisibility;
  // Mặc định mở chế độ phẳng 2D (như Google Maps) để kéo vuốt nhẹ tênh 60fps và căn đường/cắm ghim chính xác tuyệt đối; người dùng có thể bấm nút 3D bất cứ lúc nào
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const is3DModeRef = useRef<boolean>(false);
  is3DModeRef.current = is3DMode;
  const [activePresetId, setActivePresetId] = useState<string>('dhsp2');

  // Địa điểm / Cụm / Tài sản Game đang chọn
  const [selectedPlace, setSelectedPlace] = useState<PlaceLocation | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  selectedPlaceIdRef.current = selectedPlace?.id || null;
  hoveredPlaceIdRef.current = hoveredPlaceId;
  const [clusterSelectionList, setClusterSelectionList] = useState<PlaceLocation[] | null>(null);
  const [selectedGameAsset, setSelectedGameAsset] = useState<GameAsset | null>(null);
  const [modalPlace, setModalPlace] = useState<Place | null>(null);

  // Sa Bàn 3D Toàn Phường (37.787 công trình, mái ngói, instanced trees, bóng nắng thời gian thực)
  const [isCity3DOpen, setIsCity3DOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('3d') === '1' ||
      window.location.hash.includes('3d=1') ||
      window.location.hash.includes('map3d') ||
      window.location.hash.includes('3d'))
  );
  // Mặc định chỉ hiển thị Cơ quan hành chính & Khu học giảng đường, khi bấm vào từng loại hình mới hiện hàng quán loại đó
  const [showCommercialShops, setShowCommercialShops] = useState<boolean>(false);

  // Báo cáo chất lượng dữ liệu & Công cụ Admin chỉnh sửa / thêm mới địa danh, trụ sở, quán ăn
  const [isDataQualityOpen, setIsDataQualityOpen] = useState<boolean>(false);
  const [isAdminCoordModalOpen, setIsAdminCoordModalOpen] = useState<boolean>(false);
  const [isAdminCreatingNew, setIsAdminCreatingNew] = useState<boolean>(false);
  const [adminTargetPlace, setAdminTargetPlace] = useState<PlaceLocation | null>(null);
  const [adminEditName, setAdminEditName] = useState<string>('');
  const [adminEditCategory, setAdminEditCategory] = useState<Exclude<MapCategoryKey, 'all' | 'game_asset'>>('public');
  const [adminEditAddress, setAdminEditAddress] = useState<string>('');
  const [adminEditTagline, setAdminEditTagline] = useState<string>('');
  const [adminEditPhone, setAdminEditPhone] = useState<string>('');
  const [adminEditHours, setAdminEditHours] = useState<string>('07:30 - 17:30');
  const [adminMapsUrlInput, setAdminMapsUrlInput] = useState<string>('');
  const [adminLatInput, setAdminLatInput] = useState<string>('');
  const [adminLngInput, setAdminLngInput] = useState<string>('');
  const [adminCoordSource, setAdminCoordSource] = useState<
    'admin_verified' | 'nominatim_geocoded' | 'openstreetmap'
  >('admin_verified');
  const [isPickingOnMap, setIsPickingOnMap] = useState<boolean>(false);
  const [nominatimSuggestions, setNominatimSuggestions] = useState<
    Array<{ displayName: string; lat: number; lng: number }>
  >([]);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  // Cổng Chủ Quán Tự Ghim Bản Đồ & Admin Duyệt + Tuyến đường chỉ dẫn trên Bản đồ
  const [isMerchantPortalOpen, setIsMerchantPortalOpen] = useState<boolean>(false);
  const [merchantPortalTab, setMerchantPortalTab] = useState<
    'merchant' | 'create_new' | 'admin_approvals' | 'admin_codes'
  >('merchant');
  const [merchantPickingForPlace, setMerchantPickingForPlace] = useState<{
    placeId: string;
    placeName: string;
  } | null>(null);
  const merchantPickingRef = useRef<typeof merchantPickingForPlace>(null);
  merchantPickingRef.current = merchantPickingForPlace;
  const liveCoordTopBadgeRef = useRef<HTMLSpanElement | null>(null);
  const liveCoordBottomBadgeRef = useRef<HTMLDivElement | null>(null);
  const pinColumnRef = useRef<HTMLDivElement | null>(null);

  const [livePickCoords, setLivePickCoords] = useState<{ lat: number; lng: number }>({
    lat: XUANHOA_DEFAULT_CENTER.lat,
    lng: XUANHOA_DEFAULT_CENTER.lng,
  });
  const [isPinLifted, setIsPinLifted] = useState<boolean>(false);
  const [merchantPickedCoords, setMerchantPickedCoords] = useState<{
    placeId: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [activeRoute, setActiveRoute] = useState<{
    targetPlace: PlaceLocation;
    travelMode: TravelMode;
    originCoords: { lat: number; lng: number };
    pathLngLat: [number, number][];
    totalDistanceMeters: number;
    remainingDistanceMeters: number;
    eta: DistanceAndEtaResult;
    roadNames: string[];
    originLabel: string;
    progressIndex: number;
    currentPos: [number, number];
    hasArrived: boolean;
    isInfoExpanded: boolean;
  } | null>(null);
  const activeRouteRef = useRef<typeof activeRoute>(null);
  activeRouteRef.current = activeRoute;

  const [cameraVersion, setCameraVersion] = useState<number>(0);
  const [currentZoom, setCurrentZoom] = useState<number>(XUANHOA_DEFAULT_CENTER.zoom);

  const isAdminUser = useMemo(() => isAdminAuthenticated(authUser), [authUser, syncTick]);
  const isMapManagerUser = useMemo(
    () => isMapManagerAuthenticated(authUser),
    [authUser, syncTick]
  );
  const mapAccessStatus = useMemo(
    () => getDigitalMapAccessStatus(authUser),
    [authUser, syncTick]
  );
  const pendingApprovalCount = useMemo(
    () => getAllMerchantSubmissions().filter((s) => s.status === 'pending').length,
    [syncTick]
  );
  const claimedMerchantList = useMemo(
    () => (authUser?.email ? getClaimedPlacesForUser(authUser.email) : []),
    [authUser?.email, syncTick]
  );
  const primaryMerchantPlace =
    claimedMerchantList[0] || mapAccessStatus.claimedPlace || null;
  const hasClaimedPlaces = Boolean(primaryMerchantPlace);
  const claimedPlaceName = primaryMerchantPlace?.place.name || null;
  const claimedPlaceCode = useMemo(() => {
    if (authUser?.merchantVerifiedCode) return authUser.merchantVerifiedCode;
    if (primaryMerchantPlace) return getOrGenerateMerchantCode(primaryMerchantPlace.place.id, false);
    return null;
  }, [authUser?.merchantVerifiedCode, primaryMerchantPlace, syncTick]);

  const [urlClaimCode, setUrlClaimCode] = useState<string | null>(null);
  const [gateCodeInput, setGateCodeInput] = useState<string>('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateSuccess, setGateSuccess] = useState<string | null>(null);
  const [previewGuestLock, setPreviewGuestLock] = useState<boolean>(false);

  const activateCodeImmediately = (codeToUse: string) => {
    setGateError(null);
    setGateSuccess(null);

    const res = verifyAndClaimPlaceWithCode(codeToUse, authUser);
    if (!res.ok) {
      triggerFeedback('warn');
      setGateError(res.message);
      return;
    }

    triggerFeedback('approve');
    setGateSuccess(res.message);
    setPreviewGuestLock(false);
    setSyncTick((t) => t + 1);
    const clean = codeToUse.trim().toUpperCase();
    setGateCodeInput(clean);
    setUrlClaimCode(clean);
    setMerchantPortalTab(res.isMapManager ? 'create_new' : 'merchant');
    setIsMerchantPortalOpen(true);
    setLocationNotice(
      res.isMapManager
        ? `🗺️ Đã kích hoạt quyền Quản lý Maps (${clean}). Bạn có thể tạo địa điểm mới hoặc cập nhật định vị toàn khu vực.`
        : `🏪 Đã xác thực quyền quản lý quán "${res.placeItem?.place.name}" (${clean}).`
    );
  };

  const handleActivateCodeAtGate = (e: React.FormEvent) => {
    e.preventDefault();
    activateCodeImmediately(gateCodeInput);
  };

  // Tự động mở Cổng Chủ Quán hoặc Chế độ Ghim/Bay tới vị trí nếu chuyển từ Trang Admin hoặc Link Zalo sang
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkClaimParam = () => {
      const hash = window.location.hash || '';
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const params = new URLSearchParams(hash.slice(qIdx + 1));
        const claim = params.get('claim');
        if (claim) {
          const clean = claim.trim().toUpperCase();
          setUrlClaimCode(clean);
          setGateCodeInput(clean);
          setMerchantPortalTab('merchant');
          setIsMerchantPortalOpen(true);
          return;
        }

        const pickId = params.get('pick');
        if (pickId) {
          const all = getAllManagedPlaces();
          const found = all.find((p) => p.place.id === pickId);
          const pName = params.get('pickName') || found?.place.name || 'Quán của bạn';
          setIsMerchantPortalOpen(false);
          setMerchantPickingForPlace({ placeId: pickId, placeName: pName });
          return;
        }

        const flyLat = parseFloat(params.get('flyLat') || '');
        const flyLng = parseFloat(params.get('flyLng') || '');
        if (!Number.isNaN(flyLat) && !Number.isNaN(flyLng)) {
          const flyLabel = params.get('flyLabel') || '📍 Vị trí Quán trên Bản đồ';
          setIsMerchantPortalOpen(false);
          setTimeout(() => {
            const map = mapInstanceRef.current;
            if (map) {
              map.flyTo({ center: [flyLng, flyLat], zoom: 17.2, duration: 900 });
            }
            setLocationNotice(flyLabel);
          }, 250);
          return;
        }
      }
      if (hash.startsWith('#/chu-quan') || hash.startsWith('#/merchant')) {
        setMerchantPortalTab('merchant');
        setIsMerchantPortalOpen(true);
      }
    };
    checkClaimParam();
    window.addEventListener('hashchange', checkClaimParam);
    return () => window.removeEventListener('hashchange', checkClaimParam);
  }, []);

  // Lắng nghe thay đổi từ Admin Store & Trạng thái mạng
  useEffect(() => {
    const handleSync = () => setSyncTick((t) => t + 1);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('xuanhoa_admin_sync', handleSync);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('xuanhoa_admin_sync', handleSync);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hàm vẽ trực tiếp dữ liệu địa lý OpenStreetMap thật (2D & 3D Spotlight) lên Vector Canvas đồng bộ 1:1 với MapLibre GL
  const renderSynchronizedVectorGeography = useCallback(() => {
    const map = mapInstanceRef.current;
    const canvas = vectorCanvasRef.current;
    const geo = geoLayersRef.current;
    const vis = layerVisibilityRef.current;
    const mode3D = is3DModeRef.current;
    const isMoving = isInteractingRef.current;
    const focus = focusTargetRef.current;
    const highlightedRoad = highlightedRoadNameRef.current;
    if (!map || !canvas || !geo) return;

    const CANVAS_FONT_STACK =
      '"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const cleanCanvasText = (raw: string) =>
      raw
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (canvasDimsRef.current.width <= 0 || canvasDimsRef.current.height <= 0) {
      const mapCanvas = map.getCanvas();
      canvasDimsRef.current = {
        width: mapCanvas?.clientWidth || canvas.clientWidth || 1200,
        height: mapCanvas?.clientHeight || canvas.clientHeight || 800,
      };
    }
    const width = canvasDimsRef.current.width;
    const height = canvasDimsRef.current.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.2);

    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Nền kem ấm chuẩn Premium Cute Pastel (#F8F5EE)
    ctx.fillStyle = XUHO_PASTEL_THEME.uiBg;
    ctx.fillRect(0, 0, width, height);

    const bounds = map.getBounds();
    const minLng = bounds.getWest() - 0.0018;
    const maxLng = bounds.getEast() + 0.0018;
    const minLat = bounds.getSouth() - 0.0018;
    const maxLat = bounds.getNorth() + 0.0018;
    const zoom = map.getZoom();

    // Siêu tối ưu phép chiếu 60FPS: Ở chế độ phẳng 2D (pitch = 0, bearing = 0), chỉ gọi map.project đúng 2 lần/frame rồi tính tọa độ màn hình bằng 1 phép nhân cộng số thực (nhanh gấp 50 lần, 0 cấp phát bộ nhớ!)
    const isFlat2D = map.getPitch() < 0.8 && Math.abs(map.getBearing()) < 0.5;
    const refLng = XUANHOA_DEFAULT_CENTER.lng;
    const refLat = XUANHOA_DEFAULT_CENTER.lat;
    const pRef0 = map.project([refLng, refLat]);
    const pRef1 = map.project([refLng + 0.01, refLat + 0.01]);
    const scaleX = (pRef1.x - pRef0.x) * 100;
    const scaleY = (pRef1.y - pRef0.y) * 100;
    const refX = pRef0.x;
    const refY = pRef0.y;

    const projPt = (lng: number, lat: number): { x: number; y: number } => {
      if (isFlat2D) {
        return {
          x: refX + (lng - refLng) * scaleX,
          y: refY + (lat - refLat) * scaleY,
        };
      }
      return map.project([lng, lat]);
    };

    const isFeatureInView = (f: any) => {
      if (f._maxLng !== undefined) {
        return (
          f._maxLng >= minLng &&
          f._minLng <= maxLng &&
          f._maxLat >= minLat &&
          f._minLat <= maxLat
        );
      }
      return true;
    };

    const isRingInView = (ring: number[][]) => {
      for (let i = 0; i < ring.length; i++) {
        const pt = ring[i];
        if (pt[0] >= minLng && pt[0] <= maxLng && pt[1] >= minLat && pt[1] <= maxLat) {
          return true;
        }
      }
      return false;
    };

    const traceCoords = (coords: number[][], close = false) => {
      if (coords.length < 2) return;
      ctx.beginPath();
      if (isFlat2D) {
        ctx.moveTo(refX + (coords[0][0] - refLng) * scaleX, refY + (coords[0][1] - refLat) * scaleY);
        for (let i = 1; i < coords.length; i++) {
          ctx.lineTo(refX + (coords[i][0] - refLng) * scaleX, refY + (coords[i][1] - refLat) * scaleY);
        }
      } else {
        for (let i = 0; i < coords.length; i++) {
          const p = map.project([coords[i][0], coords[i][1]]);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
      }
      if (close) ctx.closePath();
    };

    // Định nghĩa 6 Khu Đô Thị thực tế tại Xuân Hòa
    const urbanZones = [
      {
        name: 'KĐT MỚI TÂY XUÂN HÒA',
        center: [105.7186, 21.2793],
        ring: [
          [105.7156, 21.2764],
          [105.7209, 21.2772],
          [105.7207, 21.2823],
          [105.7158, 21.2816],
          [105.7156, 21.2764],
        ],
      },
      {
        name: 'KĐT TRUNG TÂM LÊ QUANG ĐẠO',
        center: [105.7224, 21.2782],
        ring: [
          [105.7212, 21.2742],
          [105.7239, 21.2745],
          [105.7236, 21.2816],
          [105.7211, 21.2814],
          [105.7212, 21.2742],
        ],
      },
      {
        name: 'KĐT PHÂN LÔ NAM LÊ QUANG ĐẠO',
        center: [105.7233, 21.2722],
        ring: [
          [105.7220, 21.2685],
          [105.7246, 21.2688],
          [105.7244, 21.2756],
          [105.7218, 21.2754],
          [105.7220, 21.2685],
        ],
      },
      {
        name: 'KĐT PHỐ NHÀ CHUNG — ĐỒNG TÂM',
        center: [105.7266, 21.2768],
        ring: [
          [105.7241, 21.2752],
          [105.7301, 21.2756],
          [105.7298, 21.2784],
          [105.7240, 21.2781],
          [105.7241, 21.2752],
        ],
      },
      {
        name: 'KĐT SINH THÁI VEN SÔNG CÀ LỒ',
        center: [105.7278, 21.2712],
        ring: [
          [105.7248, 21.2676],
          [105.7316, 21.2684],
          [105.7312, 21.2748],
          [105.7248, 21.2745],
          [105.7248, 21.2676],
        ],
      },
      {
        name: 'KĐT ĐỒNG XUÂN — LÊ XOAY',
        center: [105.7315, 21.2798],
        ring: [
          [105.7292, 21.2778],
          [105.7340, 21.2778],
          [105.7340, 21.2820],
          [105.7292, 21.2820],
          [105.7292, 21.2778],
        ],
      },
    ];

    // 2. Lớp Công viên, Khuôn viên Trường học, Khu Đô Thị & Sinh thái (OSM Landuse)
    if (vis.waterAndParks) {
      for (const uz of urbanZones) {
        if (!isRingInView(uz.ring)) continue;
        traceCoords(uz.ring, true);
        const isFocusedUz =
          Math.hypot(uz.center[0] - focus.lng, uz.center[1] - focus.lat) <= focus.radiusDeg;
        ctx.fillStyle = isFocusedUz
          ? 'rgba(255, 236, 188, 0.45)'
          : 'rgba(246, 237, 216, 0.25)';
        ctx.fill();
        ctx.strokeStyle = isFocusedUz
          ? 'rgba(217, 155, 38, 0.65)'
          : 'rgba(217, 155, 38, 0.28)';
        ctx.lineWidth = isFocusedUz ? 1.5 : 1.0;
        ctx.stroke();
      }

      for (const f of geo.landuse) {
        if (!isFeatureInView(f)) continue;
        const ring = f.geometry?.coordinates?.[0];
        if (!ring) continue;
        traceCoords(ring, true);
        const kind = f.properties?.kind;
        if (kind === 'green') {
          ctx.fillStyle = '#DCECD3';
          ctx.strokeStyle = '#C2DEC0';
        } else if (kind === 'campus') {
          ctx.fillStyle = '#EFE9D8';
          ctx.strokeStyle = '#D6CBB3';
        } else if (kind === 'resort') {
          ctx.fillStyle = '#D8EFE5';
          ctx.strokeStyle = '#B4DFCE';
        } else {
          ctx.fillStyle = '#F0ECE1';
          ctx.strokeStyle = '#E2DDD0';
        }
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Vòng hào quang Tiêu điểm 3D (Spotlight Ring) dưới mặt đất cho khu phố đang chọn
      if (mode3D && zoom >= 13.5) {
        const fp = map.project([focus.lng, focus.lat]);
        const edgePt = map.project([focus.lng + focus.radiusDeg, focus.lat]);
        const rPx = Math.max(60, Math.hypot(edgePt.x - fp.x, edgePt.y - fp.y));
        if (fp.x > -rPx && fp.x < width + rPx && fp.y > -rPx && fp.y < height + rPx) {
          ctx.save();
          ctx.strokeStyle = 'rgba(57, 185, 128, 0.28)';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.ellipse(fp.x, fp.y, rPx, rPx * 0.78, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 3. Lớp Sông suối & Mặt hồ thực tế (Hồ Đại Lải, Sông Cà Lồ, Hồ Lập Đinh...)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const f of geo.waterways) {
        if (!isFeatureInView(f)) continue;
        const coords = f.geometry?.coordinates;
        if (!coords) continue;
        traceCoords(coords, false);
        ctx.strokeStyle = '#9ED8F0';
        ctx.lineWidth = Math.max(1.8, (zoom - 10) * 1.1);
        ctx.stroke();
      }

      for (const f of geo.water) {
        if (!isFeatureInView(f)) continue;
        const ring = f.geometry?.coordinates?.[0];
        if (!ring) continue;
        traceCoords(ring, true);
        ctx.fillStyle = '#9ADAF2';
        ctx.fill();
        ctx.strokeStyle = '#C6EEFC';
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.strokeStyle = '#65B2D1';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }

      // 3b. Mô hình địa hình 3D Núi Thằn Lằn
      const nuiThanLanTiers = [
        {
          fill: '#CBE4BE',
          stroke: '#A8CFA0',
          lift: mode3D ? 4 : 0,
          ring: [
            [105.7212, 21.2908],
            [105.7248, 21.2902],
            [105.7278, 21.2925],
            [105.7276, 21.2966],
            [105.7254, 21.2988],
            [105.7222, 21.2984],
            [105.7204, 21.2952],
            [105.7212, 21.2908],
          ],
        },
        {
          fill: '#B8DAA8',
          stroke: '#91C188',
          lift: mode3D ? 10 : 0,
          ring: [
            [105.7222, 21.2918],
            [105.7250, 21.2915],
            [105.7267, 21.2934],
            [105.7265, 21.2964],
            [105.7248, 21.2979],
            [105.7226, 21.2975],
            [105.7215, 21.2948],
            [105.7222, 21.2918],
          ],
        },
        {
          fill: '#A3CE93',
          stroke: '#7AB270',
          lift: mode3D ? 17 : 0,
          ring: [
            [105.7230, 21.2930],
            [105.7249, 21.2928],
            [105.7258, 21.2945],
            [105.7256, 21.2965],
            [105.7243, 21.2973],
            [105.7230, 21.2968],
            [105.7225, 21.2948],
            [105.7230, 21.2930],
          ],
        },
      ];

      if (isRingInView(nuiThanLanTiers[0].ring)) {
        for (const tier of nuiThanLanTiers) {
          ctx.beginPath();
          for (let i = 0; i < tier.ring.length; i++) {
            const p = map.project([tier.ring[i][0], tier.ring[i][1]]);
            const py = p.y - tier.lift;
            if (i === 0) ctx.moveTo(p.x, py);
            else ctx.lineTo(p.x, py);
          }
          ctx.closePath();
          ctx.fillStyle = tier.fill;
          ctx.fill();
          ctx.strokeStyle = tier.stroke;
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }
      }
    }

    // 4. Lớp Đường phố phân cấp nghiêm ngặt theo mức Zoom (Sử dụng Path2D gốc của trình duyệt + tách nhóm đường sẵn -> 0 cấp phát mảng, 60fps tuyệt đối!)
    if (vis.baseGeography) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Hiển thị rõ cả đường nhánh và ngõ nhỏ trên toàn phường (kể cả vùng xa trung tâm Cao Minh, Ngọc Thanh, Đồng Xuân)
      const minAlleyZoom = isMoving ? 14.5 : 13.5;
      const wAlley = zoom < minAlleyZoom ? 0 : Math.max(1.5, Math.pow(1.4, zoom - 13.6));
      const wMinor = zoom < 12.5 ? 0 : Math.max(2.3, Math.pow(1.45, zoom - 12.0));
      const wSecondary = Math.max(3.6, Math.pow(1.48, zoom - 10.6));
      const wMajor = Math.max(4.8, Math.pow(1.5, zoom - 10.2));

      const buildRoadPath = (roadList: any[]): Path2D | null => {
        if (!roadList || roadList.length === 0) return null;
        let hasAny = false;
        const path = new Path2D();
        if (isFlat2D) {
          for (let i = 0; i < roadList.length; i++) {
            const f = roadList[i];
            if (
              f._maxLng < minLng ||
              f._minLng > maxLng ||
              f._maxLat < minLat ||
              f._minLat > maxLat
            ) {
              continue;
            }
            const coords = f.geometry?.coordinates;
            if (!coords || coords.length < 2) continue;
            hasAny = true;
            path.moveTo(
              refX + (coords[0][0] - refLng) * scaleX,
              refY + (coords[0][1] - refLat) * scaleY
            );
            for (let j = 1; j < coords.length; j++) {
              path.lineTo(
                refX + (coords[j][0] - refLng) * scaleX,
                refY + (coords[j][1] - refLat) * scaleY
              );
            }
          }
        } else {
          for (let i = 0; i < roadList.length; i++) {
            const f = roadList[i];
            if (!isFeatureInView(f)) continue;
            const coords = f.geometry?.coordinates;
            if (!coords || coords.length < 2) continue;
            hasAny = true;
            const p0 = map.project([coords[0][0], coords[0][1]]);
            path.moveTo(p0.x, p0.y);
            for (let j = 1; j < coords.length; j++) {
              const pj = map.project([coords[j][0], coords[j][1]]);
              path.lineTo(pj.x, pj.y);
            }
          }
        }
        return hasAny ? path : null;
      };

      const pathMajor = buildRoadPath(geo.roadsMajor);
      const pathSecondary = buildRoadPath(geo.roadsSecondary);
      const pathMinor = wMinor > 0 ? buildRoadPath(geo.roadsMinor) : null;
      const pathAlley = wAlley > 0 ? buildRoadPath(geo.roadsAlley) : null;

      let pathHighlighted: Path2D | null = null;
      if (highlightedRoad) {
        const hlList = geo.roads.filter(
          (f: any) => f._cleanName && highlightedRoad.includes(f._cleanName)
        );
        pathHighlighted = buildRoadPath(hlList);
      }

      // Tâm Vòng tròn 2 trên trục Đường Nguyễn Văn Linh (Giao Võ Thị Sáu - ĐHSP2)
      const vt2Lng = 105.725000;
      const vt2Lat = 21.281565;
      const isVt2InView =
        vt2Lng >= minLng && vt2Lng <= maxLng && vt2Lat >= minLat && vt2Lat <= maxLat;
      const vt2Pt = isVt2InView ? projPt(vt2Lng, vt2Lat) : null;
      const vt2RadiusPx = zoom >= 13.2 ? Math.max(4.5, Math.pow(1.48, zoom - 11.4)) : 0;

      // 4a. Vẽ viền đường (Casing) gộp theo từng cấp đường bằng Path2D gốc
      if (pathAlley) {
        ctx.strokeStyle = '#C9C0B0';
        ctx.lineWidth = Math.max(1.7, wAlley) + 1.3;
        ctx.stroke(pathAlley);
      }
      if (pathMinor) {
        ctx.strokeStyle = '#C4BBA9';
        ctx.lineWidth = Math.max(2.3, wMinor) + 1.8;
        ctx.stroke(pathMinor);
      }
      if (pathSecondary) {
        ctx.strokeStyle = '#D8BA70';
        ctx.lineWidth = wSecondary + 2.2;
        ctx.stroke(pathSecondary);
      }
      if (vt2Pt && vt2RadiusPx > 0) {
        ctx.beginPath();
        ctx.arc(vt2Pt.x, vt2Pt.y, vt2RadiusPx, 0, Math.PI * 2);
        ctx.strokeStyle = '#D8BA70';
        ctx.lineWidth = wSecondary + 2.4;
        ctx.stroke();
      }
      if (pathMajor) {
        ctx.strokeStyle = '#D5AC52';
        ctx.lineWidth = wMajor + 2.6;
        ctx.stroke(pathMajor);
      }

      // 4b. Vẽ lòng đường (Road Fill) gộp theo từng cấp đường
      if (pathAlley) {
        ctx.strokeStyle = '#FDFBF7';
        ctx.lineWidth = wAlley;
        ctx.stroke(pathAlley);
      }
      if (pathMinor) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = wMinor;
        ctx.stroke(pathMinor);
      }
      if (pathSecondary) {
        ctx.strokeStyle = '#FFF0B5';
        ctx.lineWidth = wSecondary;
        ctx.stroke(pathSecondary);
      }
      if (vt2Pt && vt2RadiusPx > 0) {
        ctx.beginPath();
        ctx.arc(vt2Pt.x, vt2Pt.y, vt2RadiusPx, 0, Math.PI * 2);
        ctx.fillStyle = '#F8F5EE';
        ctx.fill();
        ctx.strokeStyle = '#FFF0B5';
        ctx.lineWidth = wSecondary;
        ctx.stroke();
        if (vt2RadiusPx >= 7) {
          ctx.beginPath();
          ctx.arc(vt2Pt.x, vt2Pt.y, Math.max(2.2, vt2RadiusPx - wSecondary * 0.55), 0, Math.PI * 2);
          ctx.fillStyle = '#DCECD3';
          ctx.fill();
          ctx.strokeStyle = '#D8BA70';
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }
      if (pathMajor) {
        ctx.strokeStyle = '#FFE688';
        ctx.lineWidth = wMajor;
        ctx.stroke(pathMajor);
      }
      if (pathHighlighted) {
        ctx.strokeStyle = '#39B980';
        ctx.lineWidth = Math.max(5.5, wSecondary + 2);
        ctx.stroke(pathHighlighted);
        ctx.strokeStyle = '#E6F7EF';
        ctx.lineWidth = Math.max(2.6, wMinor);
        ctx.stroke(pathHighlighted);
      }

      // 4c. Vạch kẻ tim đường nét đứt cho đường trục chính khi dừng kéo & zoom gần
      if (!isMoving && zoom >= 14.5) {
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#E09F3E';
        ctx.lineWidth = 1.15;
        if (pathMajor) ctx.stroke(pathMajor);
        if (pathSecondary) ctx.stroke(pathSecondary);
        ctx.restore();
      }

      // 4c-route. Vẽ tuyến đường dẫn đường Google Maps-style từ vị trí người dùng đến địa chỉ đã chọn
      const route = activeRouteRef.current;
      if (route && route.pathLngLat && route.pathLngLat.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const pIdx = Math.min(
          Math.max(0, route.progressIndex || 0),
          route.pathLngLat.length - 1
        );
        const travelledCoords = route.pathLngLat.slice(0, pIdx + 1);
        const remainingCoords = route.pathLngLat.slice(pIdx);

        // Đoạn đường đã đi qua (màu xám xanh nhẹ giống Google Maps)
        if (travelledCoords.length >= 2) {
          traceCoords(travelledCoords, false);
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 6.5;
          ctx.stroke();
        }

        // Đoạn đường còn lại phía trước (xanh dương nổi bật chuẩn Google Maps)
        const activeSegment = remainingCoords.length >= 2 ? remainingCoords : route.pathLngLat;
        traceCoords(activeSegment, false);
        ctx.strokeStyle = route.hasArrived ? '#059669' : '#1E3A8A';
        ctx.lineWidth = 9.5;
        ctx.stroke();

        traceCoords(activeSegment, false);
        ctx.strokeStyle = route.hasArrived ? '#10B981' : '#3B82F6';
        ctx.lineWidth = 5.5;
        ctx.stroke();

        // Vạch hướng đi ở tâm đường
        ctx.setLineDash([7, 7]);
        traceCoords(activeSegment, false);
        ctx.strokeStyle = '#EFF6FF';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.setLineDash([]);

        // Điểm xuất phát, Vị trí đang di chuyển & Điểm đích
        const startPt = map.project(route.pathLngLat[0]);
        const endPt = map.project(route.pathLngLat[route.pathLngLat.length - 1]);
        const curLngLat = route.currentPos || route.pathLngLat[pIdx] || route.pathLngLat[0];
        const curPt = map.project(curLngLat);

        ctx.fillStyle = '#64748B';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(startPt.x, startPt.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Điểm đích
        ctx.fillStyle = route.hasArrived ? '#10B981' : '#EF4444';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(endPt.x, endPt.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Chấm xanh GPS đang di chuyển trên tuyến đường
        ctx.fillStyle = 'rgba(59, 130, 246, 0.24)';
        ctx.beginPath();
        ctx.arc(curPt.x, curPt.y, 13, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2563EB';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(curPt.x, curPt.y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      // 4d. Cây xanh 3D Pastel & Bốt Pháp trên đỉnh Núi Thằn Lằn
      if (mode3D && vis.waterAndParks && zoom >= 14.2) {
        const treeScale = Math.min(1.4, Math.max(0.65, (zoom - 13.4) * 0.42));
        const draw3DTree = (tx: number, ty: number, scale = treeScale) => {
          if (tx < -16 || tx > width + 16 || ty < -16 || ty > height + 16) return;
          if (!isMoving) {
            ctx.fillStyle = 'rgba(64, 48, 100, 0.13)';
            ctx.beginPath();
            ctx.ellipse(
              tx + 2.4 * scale,
              ty + 1.4 * scale,
              4.2 * scale,
              2.4 * scale,
              0,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }

          ctx.fillStyle = '#8D6E63';
          ctx.fillRect(
            tx - 1.0 * scale,
            ty - 4.2 * scale,
            2.0 * scale,
            4.5 * scale
          );

          ctx.fillStyle = '#4CAF7A';
          ctx.beginPath();
          ctx.arc(tx, ty - 6.2 * scale, 4.3 * scale, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#6EE7B7';
          ctx.beginPath();
          ctx.arc(
            tx - 0.9 * scale,
            ty - 7.8 * scale,
            3.0 * scale,
            0,
            Math.PI * 2
          );
          ctx.fill();
        };

        for (let idx = 0; idx < geo.landuse.length; idx++) {
          const f = geo.landuse[idx];
          if (!isFeatureInView(f)) continue;
          // Chỉ hiện cây 3D trong vùng tiêu điểm đang chọn hoặc công viên lớn để gọn gàng
          const distFocus = Math.hypot((f._midLng || 0) - focus.lng, (f._midLat || 0) - focus.lat);
          if (distFocus > focus.radiusDeg * 1.45) continue;
          const kind = f.properties?.kind;
          if (kind !== 'green' && kind !== 'campus' && kind !== 'resort') continue;
          const ring = f.geometry?.coordinates?.[0];
          if (!ring || ring.length < 4) continue;
          const step = Math.max(3, Math.floor(ring.length / 6));
          for (let i = 0; i < ring.length - 1; i += step) {
            const c = ring[i];
            const p = map.project([c[0], c[1]]);
            draw3DTree(p.x, p.y);
          }
        }

        // Cây rừng trên sườn Núi Thằn Lằn + Mô hình 3D Di tích Bốt Pháp
        const nuiThanLanTrees = [
          [105.7235, 21.2925],
          [105.7248, 21.2932],
          [105.7232, 21.2942],
          [105.7252, 21.2948],
          [105.7236, 21.2955],
          [105.7249, 21.2958],
          [105.7231, 21.2966],
          [105.7246, 21.2970],
        ];
        for (const tc of nuiThanLanTrees) {
          if (tc[0] < minLng || tc[0] > maxLng || tc[1] < minLat || tc[1] > maxLat) continue;
          const p = map.project([tc[0], tc[1]]);
          draw3DTree(p.x, p.y - (mode3D ? 14 : 0), treeScale * 1.1);
        }

        const botLng = 105.723889;
        const botLat = 21.296389;
        if (botLng >= minLng && botLng <= maxLng && botLat >= minLat && botLat <= maxLat) {
          const bp = map.project([botLng, botLat]);
          const baseLift = mode3D ? 18 : 0;
          const bx = bp.x;
          const by = bp.y - baseLift;
          const s = Math.max(0.85, Math.min(1.8, (zoom - 12.5) * 0.35));

          ctx.fillStyle = 'rgba(64, 48, 100, 0.28)';
          ctx.beginPath();
          ctx.ellipse(bx + 4 * s, by + 2 * s, 12 * s, 6 * s, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#9E9382';
          ctx.strokeStyle = '#5C5346';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.rect(bx - 10 * s, by - 12 * s, 20 * s, 12 * s);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#B8AC99';
          ctx.beginPath();
          ctx.rect(bx - 7 * s, by - 22 * s, 14 * s, 10 * s);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#3E362E';
          ctx.fillRect(bx - 4.5 * s, by - 18.5 * s, 3 * s, 2.2 * s);
          ctx.fillRect(bx + 1.5 * s, by - 18.5 * s, 3 * s, 2.2 * s);
          ctx.beginPath();
          ctx.arc(bx, by - 4 * s, 3.2 * s, Math.PI, 0);
          ctx.lineTo(bx + 3.2 * s, by);
          ctx.lineTo(bx - 3.2 * s, by);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#8C7D6B';
          ctx.fillRect(bx - 8 * s, by - 25 * s, 16 * s, 3.2 * s);
          ctx.strokeRect(bx - 8 * s, by - 25 * s, 16 * s, 3.2 * s);
        }
      }

      // 5. Lớp Công trình Thực tế OpenStreetMap (Siêu tối ưu Path2D gộp 1 lệnh vẽ khi ở 2D hoặc đang kéo bản đồ -> 0 giật lag!)
      const baseExtrude = mode3D
        ? Math.max(0, Math.min(28, Math.pow(1.55, zoom - 12.8) * 2.9))
        : 0;

      if (vis.buildings && zoom >= 13.5) {
        const useFastBatched2D = !mode3D || baseExtrude < 1.5 || isMoving;

        if (useFastBatched2D) {
          const buildFootprintPath = (bldList: any[]): Path2D | null => {
            if (!bldList || bldList.length === 0) return null;
            let hasAny = false;
            const path = new Path2D();
            if (isFlat2D) {
              for (let idx = 0; idx < bldList.length; idx++) {
                const f = bldList[idx];
                if (
                  f._maxLng < minLng ||
                  f._minLng > maxLng ||
                  f._maxLat < minLat ||
                  f._minLat > maxLat
                ) {
                  continue;
                }
                const ring = f.geometry?.coordinates?.[0];
                if (!ring || ring.length < 3) continue;
                hasAny = true;
                path.moveTo(
                  refX + (ring[0][0] - refLng) * scaleX,
                  refY + (ring[0][1] - refLat) * scaleY
                );
                for (let i = 1; i < ring.length; i++) {
                  path.lineTo(
                    refX + (ring[i][0] - refLng) * scaleX,
                    refY + (ring[i][1] - refLat) * scaleY
                  );
                }
                path.closePath();
              }
            } else {
              for (let idx = 0; idx < bldList.length; idx++) {
                const f = bldList[idx];
                if (!isFeatureInView(f)) continue;
                const ring = f.geometry?.coordinates?.[0];
                if (!ring || ring.length < 3) continue;
                hasAny = true;
                const p0 = map.project([ring[0][0], ring[0][1]]);
                path.moveTo(p0.x, p0.y);
                for (let i = 1; i < ring.length; i++) {
                  const pi = map.project([ring[i][0], ring[i][1]]);
                  path.lineTo(pi.x, pi.y);
                }
                path.closePath();
              }
            }
            return hasAny ? path : null;
          };

          // Chỉ vẽ các nhà dân nhỏ khi zoom >= 14.8 (và khi đang kéo thì cần zoom >= 15.3)
          const showRegularBlds = zoom >= (isMoving ? 15.3 : 14.8);
          if (showRegularBlds) {
            const regPath = buildFootprintPath(geo.regularBuildings);
            if (regPath) {
              ctx.fillStyle = 'rgba(232, 225, 211, 0.72)';
              ctx.fill(regPath);
              if (!isMoving && zoom >= 15.2) {
                ctx.strokeStyle = 'rgba(190, 180, 162, 0.52)';
                ctx.lineWidth = 0.7;
                ctx.stroke(regPath);
              }
            }
          }

          const landmarkPath = buildFootprintPath(geo.landmarkBuildings);
          if (landmarkPath) {
            ctx.fillStyle = 'rgba(245, 222, 179, 0.85)';
            ctx.fill(landmarkPath);
            ctx.strokeStyle = 'rgba(184, 137, 70, 0.65)';
            ctx.lineWidth = 0.9;
            ctx.stroke(landmarkPath);
          }
        } else {
          // Chế độ 3D khi đã dừng kéo (!isMoving): Dựng khối 3D mượt mà
          const sourceBlds = zoom < 14.8 ? geo.landmarkBuildings : geo.buildings;
          const projectedBuildings: Array<{
            pts: Array<{ x: number; y: number }>;
            maxY: number;
            cx: number;
            cy: number;
            extrudePx: number;
            levels: number;
            isLandmark: boolean;
            isHighlightedZone: boolean;
            name: string;
          }> = [];

          for (let idx = 0; idx < sourceBlds.length; idx++) {
            const f = sourceBlds[idx];
            if (!isFeatureInView(f)) continue;
            const ring = f.geometry?.coordinates?.[0];
            if (!ring || ring.length < 3) continue;

            const bName = f._cleanName || '';
            const isLandmark = Boolean(bName);
            const bLng = f._midLng || ring[0][0];
            const bLat = f._midLat || ring[0][1];
            const distToFocus = Math.hypot(bLng - focus.lng, bLat - focus.lat);
            const isHighlightedZone = distToFocus <= focus.radiusDeg;

            const levels =
              Number(f.properties?.['building:levels']) || (isLandmark ? 4.0 : 2.6);

            const extrudePx = baseExtrude * (0.68 + Math.min(levels, 6) * 0.22);

            const pts: Array<{ x: number; y: number }> = [];
            let maxY = -Infinity;
            let sumX = 0;
            let sumY = 0;
            for (let i = 0; i < ring.length; i++) {
              const p = projPt(ring[i][0], ring[i][1]);
              pts.push({ x: p.x, y: p.y });
              if (p.y > maxY) maxY = p.y;
              sumX += p.x;
              sumY += p.y;
            }

            if (pts.length >= 3) {
              const first = pts[0];
              const last = pts[pts.length - 1];
              if (Math.hypot(first.x - last.x, first.y - last.y) > 0.5) {
                pts.push({ x: first.x, y: first.y });
              }
            }

            projectedBuildings.push({
              pts,
              maxY,
              cx: sumX / pts.length,
              cy: sumY / pts.length,
              extrudePx,
              levels: Math.max(2, Math.round(levels)),
              isLandmark,
              isHighlightedZone,
              name: bName,
            });
          }

          projectedBuildings.sort((a, b) => a.maxY - b.maxY);

          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';

          for (let bIdx = 0; bIdx < projectedBuildings.length; bIdx++) {
            const b = projectedBuildings[bIdx];
            const { pts, extrudePx, levels, isLandmark, isHighlightedZone, cx, cy } = b;
            if (pts.length < 3) continue;

            if (zoom >= 14.2) {
              const shadowDx = Math.max(2.2, extrudePx * 0.32);
              const shadowDy = Math.max(1.8, extrudePx * 0.20);
              ctx.fillStyle = 'rgba(78, 66, 98, 0.18)';
              ctx.beginPath();
              for (let i = 0; i < pts.length; i++) {
                if (i === 0) ctx.moveTo(pts[i].x + shadowDx, pts[i].y + shadowDy);
                else ctx.lineTo(pts[i].x + shadowDx, pts[i].y + shadowDy);
              }
              ctx.closePath();
              ctx.fill();
            }

            ctx.fillStyle = isLandmark ? '#D9B072' : '#C8BFA9';
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
              if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
              else ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.closePath();
            ctx.fill();

            const wallSegments: Array<{
              p1: { x: number; y: number };
              p2: { x: number; y: number };
              midY: number;
              len: number;
            }> = [];

            for (let i = 0; i < pts.length - 1; i++) {
              const p1 = pts[i];
              const p2 = pts[i + 1];
              const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
              if (len < 0.8) continue;
              wallSegments.push({
                p1,
                p2,
                midY: (p1.y + p2.y) * 0.5,
                len,
              });
            }

            wallSegments.sort((wA, wB) => wA.midY - wB.midY);

            for (let wIdx = 0; wIdx < wallSegments.length; wIdx++) {
              const { p1, p2, midY, len } = wallSegments[wIdx];
              const dx = p2.x - p1.x;
              const lightFactor = dx / (len || 1);
              let wallFill: string;
              if (isLandmark) {
                wallFill =
                  lightFactor > 0.25
                    ? '#F6D7A4'
                    : lightFactor > -0.25
                    ? '#E8C287'
                    : '#CFA363';
              } else if (isHighlightedZone) {
                wallFill =
                  lightFactor > 0.25
                    ? '#EFE5D4'
                    : lightFactor > -0.25
                    ? '#E2D6C3'
                    : '#CCC0AC';
              } else {
                wallFill =
                  lightFactor > 0.25
                    ? '#E8E0D2'
                    : lightFactor > -0.25
                    ? '#DBD1C0'
                    : '#C5B9A4';
              }

              const wallStroke = isLandmark ? '#B88946' : '#ADA089';

              ctx.fillStyle = wallFill;
              ctx.strokeStyle = wallStroke;
              ctx.lineWidth = zoom >= 15.0 ? 0.85 : 0.55;

              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.lineTo(p2.x, p2.y - extrudePx);
              ctx.lineTo(p1.x, p1.y - extrudePx);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              if (zoom >= 15.4 && extrudePx >= 7.5 && len >= 9 && midY >= cy - 2) {
                ctx.strokeStyle = isLandmark
                  ? 'rgba(138, 92, 34, 0.34)'
                  : 'rgba(105, 94, 78, 0.28)';
                ctx.lineWidth = 0.65;
                for (let lv = 1; lv < levels; lv++) {
                  const hOffset = extrudePx * (lv / levels);
                  ctx.beginPath();
                  ctx.moveTo(p1.x, p1.y - hOffset);
                  ctx.lineTo(p2.x, p2.y - hOffset);
                  ctx.stroke();
                }
              }
            }

            // Mái nhà 3D
            ctx.fillStyle = isLandmark ? '#FFEAC2' : '#F4F0E6';
            ctx.strokeStyle = isLandmark ? '#9E6E28' : '#9E927B';
            ctx.lineWidth = zoom >= 15.0 ? 1.1 : 0.75;
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
              const rx = pts[i].x;
              const ry = pts[i].y - extrudePx;
              if (i === 0) ctx.moveTo(rx, ry);
              else ctx.lineTo(rx, ry);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      // 6. Ranh giới hành chính Phường Xuân Hòa mới (Relation #19542980)
      if (vis.wardBoundary) {
        for (const f of geo.boundary) {
          const ring = f.geometry?.coordinates?.[0];
          if (!ring) continue;
          traceCoords(ring, true);
          ctx.save();
          ctx.strokeStyle = 'rgba(57, 185, 128, 0.32)';
          ctx.lineWidth = 7;
          ctx.stroke();

          ctx.setLineDash([8, 5]);
          ctx.strokeStyle = '#403064';
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Hệ thống kiểm tra va chạm nhãn 2 chiều chuẩn Google Maps (AABB + Khoảng cách)
      const placedLabelBoxes: Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        cx: number;
        cy: number;
        r: number;
      }> = [];

      const reserveLabelBox = (
        cx: number,
        cy: number,
        halfW: number,
        halfH: number,
        minR: number
      ) => {
        placedLabelBoxes.push({
          x1: cx - halfW,
          y1: cy - halfH,
          x2: cx + halfW,
          y2: cy + halfH,
          cx,
          cy,
          r: minR,
        });
      };

      const canPlaceLabel = (
        cx: number,
        cy: number,
        halfW: number,
        halfH: number,
        minR: number
      ) => {
        const x1 = cx - halfW;
        const x2 = cx + halfW;
        const y1 = cy - halfH;
        const y2 = cy + halfH;
        for (let i = 0; i < placedLabelBoxes.length; i++) {
          const b = placedLabelBoxes[i];
          if (Math.hypot(cx - b.cx, cy - b.cy) < Math.max(minR, b.r)) return false;
          if (!(x2 < b.x1 || x1 > b.x2 || y2 < b.y1 || y1 > b.y2)) return false;
        }
        placedLabelBoxes.push({ x1, y1, x2, y2, cx, cy, r: minR });
        return true;
      };

      // 6a. ĐỊNH VỊ TRƯỚC CÁC GHIM ĐỊA ĐIỂM (DOM MARKERS) & ĐĂNG KÝ VÙNG CẤM ĐÈ CHỮ
      // Nhờ bước này chạy trước, tên đường và nhãn mái nhà không bao giờ bị vẽ đè dưới chân ghim quán hay biển tên địa điểm!
      const isMobileScreen = width < 640;
      const topSafeZoneY = isMobileScreen ? 102 : 66;
      const bottomSafeZoneY = height - (isMobileScreen ? 42 : 28);
      const placedPinLabelCenters: Array<{ x: number; y: number }> = [];
      const activeMarkers = filteredVerifiedMarkersRef.current;
      const selId = selectedPlaceIdRef.current;
      const hovId = hoveredPlaceIdRef.current;

      for (let i = 0; i < activeMarkers.length; i++) {
        const loc = activeMarkers[i];
        const el = markerElsRef.current.get(loc.id);
        if (!el || loc.lat === null || loc.lng === null) continue;

        const pt = projPt(loc.lng, loc.lat);
        const isBuildingPin =
          loc.insideWard &&
          (loc.category === 'school' ||
            loc.id.includes('way_') ||
            loc.id.includes('building_'));
        const pinLift = mode3D && isBuildingPin ? baseExtrude * 1.12 : 0;
        const px = pt.x;
        const py = pt.y - pinLift;

        if (px < -80 || px > width + 80 || py < -80 || py > height + 80) {
          if (el.style.display !== 'none') el.style.display = 'none';
          continue;
        }

        if (el.style.display !== 'block') el.style.display = 'block';
        el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;

        // Khóa vùng icon tròn (28x28px) để chữ tên đường không vẽ xuyên qua nút ghim (VD: Vòng tròn 2)
        reserveLabelBox(px, py, 20, 20, 24);

        const labelEl = markerLabelElsRef.current.get(loc.id);
        if (labelEl) {
          let isPillVisible = labelEl.style.display === 'block';
          if (!isMoving) {
            const isSelectedOrHovered = loc.id === selId || loc.id === hovId;
            const inSafeVerticalBand = py >= topSafeZoneY && py <= bottomSafeZoneY;
            const minZoomForAutoLabel = isMobileScreen ? 15.6 : 14.9;
            const minLabelSpacing = isMobileScreen ? 108 : 96;

            let shouldShowLabel = false;
            if (isSelectedOrHovered) {
              shouldShowLabel = true;
              placedPinLabelCenters.push({ x: px, y: py - 24 });
            } else if (
              zoom >= minZoomForAutoLabel &&
              inSafeVerticalBand &&
              px >= 54 &&
              px <= width - 54
            ) {
              const collides = placedPinLabelCenters.some(
                (c) => Math.abs(px - c.x) < minLabelSpacing && Math.abs(py - 24 - c.y) < 30
              );
              if (!collides) {
                shouldShowLabel = true;
                placedPinLabelCenters.push({ x: px, y: py - 24 });
              }
            }

            const targetDisplay = shouldShowLabel ? 'block' : 'none';
            if (labelEl.style.display !== targetDisplay) {
              labelEl.style.display = targetDisplay;
            }
            isPillVisible = shouldShowLabel;
          }

          if (isPillVisible) {
            const pillHalfW = Math.min(96, loc.name.length * 3.1 + 14);
            reserveLabelBox(px, py - 24, pillHalfW, 14, 28);
          }
        }
      }

      if (vis.gameAssets) {
        for (let i = 0; i < DEMO_GAME_ASSETS.length; i++) {
          const asset = DEMO_GAME_ASSETS[i];
          const el = gameAssetElsRef.current.get(asset.id);
          if (!el) continue;
          const pt = projPt(asset.lng, asset.lat);
          if (pt.x < -80 || pt.x > width + 80 || pt.y < -80 || pt.y > height + 80) {
            if (el.style.display !== 'none') el.style.display = 'none';
          } else {
            if (el.style.display !== 'block') el.style.display = 'block';
            el.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
          }
        }
      }

      if (userMarkerElRef.current && (userCoordsRef.current || activeRouteRef.current) && vis.userLocation) {
        const activePos = activeRouteRef.current?.currentPos;
        const uLng = activePos ? activePos[0] : userCoordsRef.current!.lng;
        const uLat = activePos ? activePos[1] : userCoordsRef.current!.lat;
        const pt = projPt(uLng, uLat);
        if (userMarkerElRef.current.style.display !== 'block') {
          userMarkerElRef.current.style.display = 'block';
        }
        userMarkerElRef.current.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
      } else if (userMarkerElRef.current) {
        if (userMarkerElRef.current.style.display !== 'none') {
          userMarkerElRef.current.style.display = 'none';
        }
      }

      if (userHomeMarkerElRef.current && userHomeRef.current) {
        const pt = projPt(userHomeRef.current.lng, userHomeRef.current.lat);
        if (userHomeMarkerElRef.current.style.display !== 'block') {
          userHomeMarkerElRef.current.style.display = 'block';
        }
        userHomeMarkerElRef.current.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
      } else if (userHomeMarkerElRef.current) {
        if (userHomeMarkerElRef.current.style.display !== 'none') {
          userHomeMarkerElRef.current.style.display = 'none';
        }
      }

      // 6b. Nhãn phụ ký hiệu tòa nhà nội khu (S1, S2, A1, Giảng đường A...) — chỉ hiện khi zoom thật gần (>= 16.4) và không trùng ghim
      if (!isMoving && zoom >= 16.4 && vis.buildings && geo.landmarkBuildings) {
        ctx.font = `700 9.5px ${CANVAS_FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < geo.landmarkBuildings.length; i++) {
          const f = geo.landmarkBuildings[i];
          if (!isFeatureInView(f)) continue;
          const cleanName = f._cleanName || '';
          if (!cleanName) continue;
          // Chỉ hiện mã tòa ngắn (S1-S4, A1-A3, Giảng đường...) để không lặp lại tên trường đã có ghim
          if (cleanName.length > 13 && !cleanName.startsWith('Giảng đường')) continue;
          const pt = projPt(f._midLng, f._midLat);
          const ry = mode3D ? pt.y - baseExtrude * 1.4 : pt.y;
          const bHalfW = cleanName.length * 3.0 + 6;
          if (!canPlaceLabel(pt.x, ry, bHalfW, 10, 42)) continue;
          ctx.strokeStyle = '#FFFDF9';
          ctx.lineWidth = 3.0;
          ctx.strokeText(cleanName, pt.x, ry);
          ctx.fillStyle = '#5F6368';
          ctx.fillText(cleanName, pt.x, ry);
        }
      }

      const drawCanvasPillBadge = (
        cx: number,
        cy: number,
        text: string,
        bgColor: string,
        borderColor: string,
        textColor: string
      ) => {
        const tw = text.length * 6.0;
        const padX = 7;
        const pillW = tw + padX * 2;
        const pillH = 19;
        const rx = cx - pillW * 0.5;
        const ry = cy - pillH * 0.5;
        const rad = 8;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(rx + rad, ry);
        ctx.lineTo(rx + pillW - rad, ry);
        ctx.quadraticCurveTo(rx + pillW, ry, rx + pillW, ry + rad);
        ctx.lineTo(rx + pillW, ry + pillH - rad);
        ctx.quadraticCurveTo(rx + pillW, ry + pillH, rx + pillW - rad, ry + pillH);
        ctx.lineTo(rx + rad, ry + pillH);
        ctx.quadraticCurveTo(rx, ry + pillH, rx, ry + pillH - rad);
        ctx.lineTo(rx, ry + rad);
        ctx.quadraticCurveTo(rx, ry, rx + rad, ry);
        ctx.closePath();

        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.fillText(text, cx, cy + 0.5);
        ctx.restore();
      };

      // 6c. Nhãn 6 Khu Đô Thị trên nền Canvas (Chỉ vẽ khi người dùng TẮT lớp Ghim Icon)
      if (!vis.realPois && zoom >= 14.2) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${zoom >= 15.4 ? 10.2 : 9.5}px ${CANVAS_FONT_STACK}`;
        for (const uz of urbanZones) {
          const [uLng, uLat] = uz.center;
          if (uLng < minLng || uLng > maxLng || uLat < minLat || uLat > maxLat) continue;
          const pt = projPt(uLng, uLat);
          if (pt.x < -80 || pt.x > width + 80 || pt.y < -40 || pt.y > height + 40) continue;

          const labelText = uz.name;
          const halfW = labelText.length * 3.3 + 14;
          if (!canPlaceLabel(pt.x, pt.y, halfW, 15, 110)) continue;

          drawCanvasPillBadge(
            pt.x,
            pt.y,
            labelText,
            'rgba(255, 253, 249, 0.94)',
            '#D99B26',
            '#8C4A08'
          );
        }
      }

      // 7. HỆ THỐNG NHÃN TÊN ĐƯỜNG CHUẨN GOOGLE MAPS (Phân cấp theo mức Zoom + Khoảng cách lặp thông minh + Ưu tiên tâm màn hình)
      const roadAnchors = geo.roadLabelAnchors || [];
      if (zoom >= 12.8 && roadAnchors.length > 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Font chuẩn Google Maps: mảnh gọn (600 SemiBold / 500 Medium), kích thước co giãn theo bề rộng lòng đường ở từng mức zoom
        const fontSizeMajor = zoom >= 16.2 ? 11.5 : zoom >= 15.0 ? 10.6 : 9.8;
        const fontSizeMinor = zoom >= 16.2 ? 10.6 : zoom >= 15.2 ? 10.0 : 9.4;
        const fontSizeAlley = zoom >= 16.6 ? 10.0 : 9.3;

        const fontMajor = `600 ${fontSizeMajor}px ${CANVAS_FONT_STACK}`;
        const fontMinor = `600 ${fontSizeMinor}px ${CANVAS_FONT_STACK}`;
        const fontAlley = `500 ${fontSizeAlley}px ${CANVAS_FONT_STACK}`;
        let currentFont = '';

        const pxPerDeg = Math.hypot(scaleX, scaleY) * 0.7071;
        const viewCenterX = width * 0.5;
        const viewCenterY = height * 0.5;

        // Lọc các điểm neo đang nằm trong khung nhìn và thỏa mãn cấp độ Zoom của Google Maps
        const visibleCandidates: Array<{
          anchor: RoadLabelAnchor;
          x: number;
          y: number;
          isHighlighted: boolean;
          tierRank: number;
          distCenterSq: number;
        }> = [];

        for (let i = 0; i < roadAnchors.length; i++) {
          const anchor = roadAnchors[i];
          if (
            anchor.lng < minLng ||
            anchor.lng > maxLng ||
            anchor.lat < minLat ||
            anchor.lat > maxLat
          ) {
            continue;
          }

          const name = anchor.name;
          const tier = anchor.tier;
          const isAlley = anchor.isAlley;
          const isHighlighted = Boolean(highlightedRoad && highlightedRoad.includes(name));

          if (!isHighlighted) {
            // Phân tầng hiển thị theo mức Zoom đúng chuẩn Google Maps:
            // - Zoom < 13.5: chỉ hiện trục quốc lộ/đại lộ lớn (Nguyễn Văn Linh, Hùng Vương...)
            // - Zoom 13.5 -> 14.55: hiện thêm trục chính cấp phường (Phạm Văn Đồng, Kim Ngọc, Lê Thái Tổ...)
            // - Zoom 14.55 -> 15.75: hiện thêm các phố nội khu (Võ Thị Sáu, Kim Đồng, Lê Quang Đạo...)
            // - Zoom >= 15.75: mới hiện tên các Ngõ / Ngách nhỏ để bản đồ không bao giờ bị rối
            if (zoom < 12.8 && tier !== 'major') continue;
            if (zoom < 13.8 && tier !== 'major' && tier !== 'secondary') continue;
            if (zoom < (isMoving ? 15.2 : 14.7) && isAlley) continue;

            // Kiểm tra chiều dài con đường trên màn hình phải đủ dài hơn chữ thì mới hiện tên
            const roadScreenLenPx = anchor.roadSpanDeg * pxPerDeg;
            if (roadScreenLenPx < anchor.halfW * 2.15) continue;
          }

          const ptCenter = projPt(anchor.lng, anchor.lat);
          // Chừa lề an toàn để chữ tên đường không bị cắt cụt ở mép màn hình
          if (
            ptCenter.x < anchor.halfW + 16 ||
            ptCenter.x > width - anchor.halfW - 16 ||
            ptCenter.y < 48 ||
            ptCenter.y > height - 32
          ) {
            continue;
          }

          const tierRank = isHighlighted
            ? 0
            : tier === 'major'
            ? 1
            : tier === 'secondary'
            ? 2
            : !isAlley
            ? 3
            : 4;
          const dx = ptCenter.x - viewCenterX;
          const dy = ptCenter.y - viewCenterY;

          visibleCandidates.push({
            anchor,
            x: ptCenter.x,
            y: ptCenter.y,
            isHighlighted,
            tierRank,
            distCenterSq: dx * dx + dy * dy,
          });
        }

        // Sắp xếp ưu tiên: cấp đường quan trọng trước -> điểm neo gần tâm màn hình người dùng đang nhìn trước
        visibleCandidates.sort((a, b) => {
          if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
          return a.distCenterSq - b.distCenterSq;
        });

        // Kiểm soát khoảng cách lặp lại của CÙNG MỘT TÊN ĐƯỜNG trên màn hình (Google Maps symbol-spacing: 450px - 560px)
        const placedSameRoadPts = new Map<string, Array<{ x: number; y: number }>>();

        for (let i = 0; i < visibleCandidates.length; i++) {
          const { anchor, x, y, isHighlighted } = visibleCandidates[i];
          const name = anchor.name;
          const tier = anchor.tier;
          const isAlley = anchor.isAlley;
          const isArterial = tier === 'major' || tier === 'secondary';

          // Khoảng cách tối thiểu giữa 2 nhãn của CÙNG 1 CON ĐƯỜNG trên màn hình:
          // - Đường trục dài (Nguyễn Văn Linh, Phạm Văn Đồng, Kim Ngọc): cách nhau ít nhất 460px - 540px (tối đa 1-2 nhãn/màn hình, không bao giờ lặp 6-7 lần!)
          // - Phố nhánh & Ngõ (Võ Thị Sáu, Kim Đồng...): cách nhau ít nhất 520px (chỉ hiện đúng 1 nhãn gọn gàng trên màn hình!)
          const minSameRoadDistPx = isHighlighted
            ? 320
            : isArterial
            ? zoom >= 16.2
              ? 450
              : 520
            : zoom >= 16.5
            ? 460
            : 540;

          const existingSameRoad = placedSameRoadPts.get(name);
          if (
            existingSameRoad &&
            existingSameRoad.some(
              (pt) => Math.hypot(x - pt.x, y - pt.y) < minSameRoadDistPx
            )
          ) {
            continue;
          }

          // Khoảng cách tối thiểu giữa các nhãn khác nhau để mặt bản đồ thoáng đãng
          const minOtherLabelDistPx = isHighlighted
            ? 75
            : zoom >= 16.2
            ? 115
            : zoom >= 15.0
            ? 135
            : 155;

          if (!canPlaceLabel(x, y, anchor.halfW, 13, minOtherLabelDistPx)) continue;

          if (existingSameRoad) {
            existingSameRoad.push({ x, y });
          } else {
            placedSameRoadPts.set(name, [{ x, y }]);
          }

          const ptDir = projPt(
            anchor.lng + (anchor.dirLng || 0.0005),
            anchor.lat + (anchor.dirLat || 0)
          );

          const targetFont = isAlley ? fontAlley : isArterial ? fontMajor : fontMinor;
          if (currentFont !== targetFont) {
            ctx.font = targetFont;
            currentFont = targetFont;
          }

          let angle = Math.atan2(ptDir.y - y, ptDir.x - x);
          if (angle > Math.PI / 2) angle -= Math.PI;
          if (angle < -Math.PI / 2) angle += Math.PI;

          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          // Bảng màu chữ đường phố chuẩn Google Maps: dịu mắt, hòa quyện vào nền đường chứ không đậm gắt
          ctx.strokeStyle = isHighlighted
            ? '#39B980'
            : isArterial
            ? 'rgba(255, 253, 248, 0.95)'
            : 'rgba(255, 255, 255, 0.95)';
          ctx.lineWidth = isHighlighted ? 3.8 : isArterial ? 3.2 : 2.8;
          ctx.strokeText(name, 0, 0);
          ctx.fillStyle = isHighlighted
            ? '#114B32'
            : isArterial
            ? '#4A3F35'
            : isAlley
            ? '#70757A'
            : '#5F6368';
          ctx.fillText(name, 0, 0);
          ctx.restore();
        }
      }

      // 8. Nhãn mặt hồ lớn (Hồ Đại Lải, Hồ Lập Đinh...)
      if (zoom >= 12.2 && vis.waterAndParks && !vis.realPois) {
        ctx.font = `700 11px ${CANVAS_FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const seenWaterNames = new Set<string>();
        for (const f of geo.water) {
          if (!isFeatureInView(f)) continue;
          const wName = f._cleanName || '';
          if (!wName || seenWaterNames.has(wName)) continue;
          seenWaterNames.add(wName);
          const pt = projPt(f._midLng, f._midLat);
          if (pt.x < -80 || pt.x > width + 80 || pt.y < -40 || pt.y > height + 40) continue;
          drawCanvasPillBadge(
            pt.x,
            pt.y,
            wName,
            'rgba(240, 250, 255, 0.92)',
            '#5EAED0',
            '#18557A'
          );
        }
      }
    }

    ctx.restore();
  }, []);

  // Hàm yêu cầu vẽ lại Canvas qua requestAnimationFrame (chống giật lag 100%)
  const scheduleCanvasRender = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      renderSynchronizedVectorGeography();
    });
  }, [renderSynchronizedVectorGeography]);

  // Đảm bảo ngay khi bộ font tiếng Việt 'Be Vietnam Pro' tải xong, Canvas tự động vẽ lại sắc nét 100%
  useEffect(() => {
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      (document as any).fonts.ready
        .then(() => {
          scheduleCanvasRender();
        })
        .catch(() => {});
    }
  }, [scheduleCanvasRender]);

  // Tải toàn bộ dữ liệu địa lý OpenStreetMap đã xác minh từ public/geo/ + Lọc phẳng 2D ngoài Xuân Hòa + Khởi tạo Khu Đô Thị gọn gàng
  useEffect(() => {
    const controller = new AbortController();
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

    Promise.all([
      fetch(`${base}/geo/xuanhoa-boundary.geojson`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/geo/xuanhoa-landuse.geojson`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/geo/xuanhoa-water.geojson`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/geo/xuanhoa-waterways.geojson`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/geo/xuanhoa-roads.geojson`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/geo/xuanhoa-buildings.geojson`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/geo/xuanhoa-places-labels.geojson`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/geo/xuanhoa-osm-verified-pois.json`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/geo/xuanhoa-catalog-osm-matched.json`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
    ])
      .then(
        ([
          boundary,
          landuse,
          water,
          waterways,
          roads,
          buildings,
          placeLabels,
          verifiedPoisData,
          matchedCatalog,
        ]) => {
          const boundaryFeatures: any[] = boundary?.features || [];
          const wardRing: number[][] = boundaryFeatures[0]?.geometry?.coordinates?.[0] || [];

          // Hàm kiểm tra điểm nằm trong ranh giới hành chính Phường Xuân Hòa
          const isPointInsideXuanHoa = (lng: number, lat: number) => {
            if (!wardRing || wardRing.length < 3) return true;
            let inside = false;
            for (let i = 0, j = wardRing.length - 1; i < wardRing.length; j = i++) {
              const xi = wardRing[i][0],
                yi = wardRing[i][1];
              const xj = wardRing[j][0],
                yj = wardRing[j][1];
              const intersect =
                yi > lat !== yj > lat &&
                lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-9) + xi;
              if (intersect) inside = !inside;
            }
            return inside;
          };

          const rawLanduse: any[] = landuse?.features || [];
          const rawWater: any[] = water?.features || [];
          const rawWaterways: any[] = waterways?.features || [];
          const rawRoads: any[] = roads?.features || [];
          const allRawBuildings: any[] = buildings?.features || [];

          const indexRingFeature = (f: any, ring: number[][]) => {
            if (!ring || ring.length === 0) return;
            let minX = Infinity,
              maxX = -Infinity,
              minY = Infinity,
              maxY = -Infinity;
            for (let i = 0; i < ring.length; i++) {
              const x = ring[i][0];
              const y = ring[i][1];
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
            f._minLng = minX;
            f._maxLng = maxX;
            f._minLat = minY;
            f._maxLat = maxY;
            f._midLng = (minX + maxX) * 0.5;
            f._midLat = (minY + maxY) * 0.5;
          };

          const cleanGeoText = (raw: string) =>
            String(raw || '')
              .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\r\n\t]+/gu, ' ')
              .replace(/\s{2,}/g, ' ')
              .trim();

          for (const f of rawLanduse) indexRingFeature(f, f.geometry?.coordinates?.[0]);
          for (const f of rawWater) {
            indexRingFeature(f, f.geometry?.coordinates?.[0]);
            f._cleanName = cleanGeoText(f.properties?.name || '');
          }
          for (const f of rawWaterways) indexRingFeature(f, f.geometry?.coordinates);

          const roadsMajor: any[] = [];
          const roadsSecondary: any[] = [];
          const roadsMinor: any[] = [];
          const roadsAlley: any[] = [];

          for (const f of rawRoads) {
            indexRingFeature(f, f.geometry?.coordinates);
            f._cleanName = cleanGeoText(f.properties?.name || '');
            const t = f.properties?.tier || 'minor';
            if (t === 'major') roadsMajor.push(f);
            else if (t === 'secondary') roadsSecondary.push(f);
            else if (t === 'minor') roadsMinor.push(f);
            else roadsAlley.push(f);
          }

          // LỌC SẠCH CÁC TÒA NHÀ NGOÀI PHƯỜNG XUÂN HÒA & TÁCH NHÓM NHÀ CHÍNH / NHÀ DÂN
          const rawBuildings: any[] = [];
          const landmarkBuildings: any[] = [];
          const regularBuildings: any[] = [];

          for (const f of allRawBuildings) {
            const ring: number[][] = f.geometry?.coordinates?.[0];
            indexRingFeature(f, ring);
            const mLng = f._midLng;
            const mLat = f._midLat;
            if (!mLng || !mLat || !ring) continue;
            if (!isPointInsideXuanHoa(mLng, mLat)) continue;
            const cleanBName = cleanGeoText(f.properties?.name || '');
            f._cleanName = cleanBName;
            rawBuildings.push(f);
            if (cleanBName) {
              landmarkBuildings.push(f);
            } else {
              regularBuildings.push(f);
            }
          }

          // Chuẩn bị hệ thống điểm neo nhãn tên đường chuẩn Google Maps:
          // - Tính tổng chiều dài thực của từng tên đường (roadSpanDeg)
          // - Chỉ đặt điểm neo trên các đoạn thẳng (loại bỏ khúc cua gấp > 23 độ để chữ không bị gãy góc)
          const samplePointAtDist = (
            coords: number[][],
            segLens: number[],
            targetDist: number
          ) => {
            let acc = 0;
            for (let i = 0; i < segLens.length; i++) {
              if (acc + segLens[i] >= targetDist || i === segLens.length - 1) {
                const t =
                  segLens[i] > 0
                    ? Math.max(0, Math.min(1, (targetDist - acc) / segLens[i]))
                    : 0.5;
                return {
                  lng: coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
                  lat: coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t,
                  dirLng: coords[i + 1][0] - coords[i][0],
                  dirLat: coords[i + 1][1] - coords[i][1],
                };
              }
              acc += segLens[i];
            }
            return {
              lng: coords[0][0],
              lat: coords[0][1],
              dirLng: coords[coords.length - 1][0] - coords[0][0],
              dirLat: coords[coords.length - 1][1] - coords[0][1],
            };
          };

          const sampleStraightAnchor = (
            coords: number[][],
            segLens: number[],
            totalLen: number,
            targetDist: number
          ) => {
            const ptMid = samplePointAtDist(coords, segLens, targetDist);
            const span = Math.min(0.00024, totalLen * 0.35);
            if (span < 0.00006) return ptMid;
            const ptBefore = samplePointAtDist(
              coords,
              segLens,
              Math.max(0, targetDist - span)
            );
            const ptAfter = samplePointAtDist(
              coords,
              segLens,
              Math.min(totalLen, targetDist + span)
            );
            const v1x = ptMid.lng - ptBefore.lng;
            const v1y = ptMid.lat - ptBefore.lat;
            const v2x = ptAfter.lng - ptMid.lng;
            const v2y = ptAfter.lat - ptMid.lat;
            const len1 = Math.hypot(v1x, v1y);
            const len2 = Math.hypot(v2x, v2y);
            if (len1 > 1e-7 && len2 > 1e-7) {
              const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
              // Nếu đoạn đường tại điểm này cua gấp hơn ~23 độ -> bỏ qua để chữ không bị vắt ngang góc cua
              if (cosAngle < 0.92) return null;
            }
            return {
              lng: ptMid.lng,
              lat: ptMid.lat,
              dirLng: ptAfter.lng - ptBefore.lng,
              dirLat: ptAfter.lat - ptBefore.lat,
            };
          };

          const totalRoadSpanByName = new Map<string, number>();
          for (const f of rawRoads) {
            const rName = f._cleanName || '';
            const coords = f.geometry?.coordinates;
            if (!rName || !coords || coords.length < 2) continue;
            let totalLen = 0;
            const segLens: number[] = [];
            for (let i = 0; i < coords.length - 1; i++) {
              const l = Math.hypot(
                coords[i + 1][0] - coords[i][0],
                coords[i + 1][1] - coords[i][1]
              );
              segLens.push(l);
              totalLen += l;
            }
            f._roadGeomLen = totalLen;
            f._segLens = segLens;
            totalRoadSpanByName.set(
              rName,
              (totalRoadSpanByName.get(rName) || 0) + totalLen
            );
          }

          const rawAnchorsByName = new Map<string, RoadLabelAnchor[]>();
          const stepDeg = 0.00105; // ~115m mỗi điểm neo ứng viên dọc theo con đường

          for (const f of rawRoads) {
            const rName = f._cleanName || '';
            const coords = f.geometry?.coordinates;
            const totalLen: number = f._roadGeomLen || 0;
            const segLens: number[] = f._segLens || [];
            if (!rName || !coords || coords.length < 2 || totalLen < 0.00048) continue;

            const tier = f.properties?.tier || 'minor';
            const isAlley = tier === 'alley' || rName.startsWith('Ngõ ');
            const halfW = rName.length * 3.05 + 8;
            const roadSpanDeg = Math.max(
              totalLen,
              totalRoadSpanByName.get(rName) || totalLen
            );
            const list = rawAnchorsByName.get(rName) || [];

            if (totalLen < stepDeg * 1.35) {
              const pt = sampleStraightAnchor(coords, segLens, totalLen, totalLen * 0.5);
              if (pt) {
                list.push({
                  name: rName,
                  tier,
                  isAlley,
                  halfW,
                  roadSpanDeg,
                  lng: pt.lng,
                  lat: pt.lat,
                  dirLng: pt.dirLng,
                  dirLat: pt.dirLat,
                });
              }
            } else {
              for (
                let d = stepDeg * 0.55;
                d <= totalLen - stepDeg * 0.35;
                d += stepDeg
              ) {
                const pt = sampleStraightAnchor(coords, segLens, totalLen, d);
                if (pt) {
                  list.push({
                    name: rName,
                    tier,
                    isAlley,
                    halfW,
                    roadSpanDeg,
                    lng: pt.lng,
                    lat: pt.lat,
                    dirLng: pt.dirLng,
                    dirLat: pt.dirLat,
                  });
                }
              }
            }

            rawAnchorsByName.set(rName, list);
          }

          // Khử trùng lặp giữa 2 làn đường đôi song song trong bán kính ~90m
          const roadLabelAnchors: RoadLabelAnchor[] = [];
          for (const [, candidates] of rawAnchorsByName.entries()) {
            const accepted: RoadLabelAnchor[] = [];
            for (const cand of candidates) {
              const tooClose = accepted.some(
                (a) => Math.hypot(cand.lng - a.lng, cand.lat - a.lat) < 0.00082
              );
              if (!tooClose) {
                accepted.push(cand);
                roadLabelAnchors.push(cand);
              }
            }
          }

          const tierPriority: Record<string, number> = {
            major: 1,
            secondary: 2,
            minor: 3,
            alley: 4,
          };
          roadLabelAnchors.sort(
            (a, b) => (tierPriority[a.tier] || 3) - (tierPriority[b.tier] || 3)
          );

          geoLayersRef.current = {
            boundary: boundaryFeatures,
            landuse: rawLanduse,
            water: rawWater,
            waterways: rawWaterways,
            roads: rawRoads,
            roadsMajor,
            roadsSecondary,
            roadsMinor,
            roadsAlley,
            buildings: rawBuildings,
            landmarkBuildings,
            regularBuildings,
            placeLabels: placeLabels?.features || [],
            roadLabelAnchors,
          };

          if (verifiedPoisData && Array.isArray(verifiedPoisData.namedRoads)) {
            const baseNamed = verifiedPoisData.namedRoads.map((r: any, idx: number) => ({
              id: r.osmId || `road_${idx}`,
              name: r.name,
              highway: r.highway || 'residential',
              tier: r.tier || 'minor',
              lat: Number(r.lat),
              lng: Number(r.lng),
              osmId: r.osmId || '',
              segmentsCount: r.segmentsCount || 1,
              insideWard: Boolean(r.insideWard),
            }));
            setOsmRoads(baseNamed);
          }

          if (matchedCatalog && typeof matchedCatalog === 'object') {
            setOsmRoadMatchedCatalog(
              matchedCatalog as Record<
                string,
                { lat: number; lng: number; roadName: string; osmId: string }
              >
            );
          }

          setIsMapLoading(false);
          setCameraVersion((v) => v + 1);
          scheduleCanvasRender();
        }
      )
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.error('Failed loading geo layers:', err);
          setIsMapLoading(false);
        }
      });

    return () => controller.abort();
  }, [scheduleCanvasRender]);

  // Hiển thị toàn bộ các vị trí đã xác minh tọa độ (gồm mốc địa danh OSM thật + các quán đã được Chủ quán ghim & Admin duyệt)
  const { verifiedMapMarkers, unverifiedCatalogPlaces } = useMemo(() => {
    const base = getAllMapPlaceLocations();
    return {
      verifiedMapMarkers: base.verifiedMapMarkers,
      unverifiedCatalogPlaces: base.unverifiedCatalogPlaces,
    };
  }, [syncTick]);

  const dataQualityReport = useMemo(() => {
    const baseReport = buildDataQualityReport();
    return {
      ...baseReport,
      stats: {
        ...baseReport.stats,
        osmVerifiedPoisCount: verifiedMapMarkers.length,
        catalogVerifiedCoordsCount:
          baseReport.stats.catalogTotalPlaces - unverifiedCatalogPlaces.length,
        catalogPendingVerificationCount: unverifiedCatalogPlaces.length,
      },
    };
  }, [verifiedMapMarkers.length, unverifiedCatalogPlaces.length, syncTick]);

  // Danh sách các địa điểm đã được lưu (★) của tài khoản hiện tại
  const savedPlaceObjects = useMemo(
    () => verifiedMapMarkers.filter((loc) => savedPlaceIds.includes(loc.id)),
    [verifiedMapMarkers, savedPlaceIds]
  );

  // Lọc danh sách marker đã xác minh theo danh mục đang bật (mặc định auto bật Hành chính + Trường học; nếu tắt "Hiện ghim định vị" thì không hiện ghim nào ngoài địa điểm đang chọn)
  const filteredVerifiedMarkers = useMemo(() => {
    if (!layerVisibility.realPois) {
      return selectedPlace
        ? verifiedMapMarkers.filter((loc) => loc.id === selectedPlace.id)
        : [];
    }
    return verifiedMapMarkers.filter((loc) => {
      if (selectedPlace?.id === loc.id) return true;
      if (savedPlaceIds.includes(loc.id)) return true;
      if (selectedCategories.includes('all')) return true;
      return selectedCategories.includes(loc.category);
    });
  }, [
    verifiedMapMarkers,
    selectedCategories,
    layerVisibility.realPois,
    selectedPlace,
    savedPlaceIds,
  ]);

  // Đồng bộ danh sách marker đã lọc vào ref để vòng lặp 60fps khóa tọa độ chính xác tuyệt đối
  useEffect(() => {
    filteredVerifiedMarkersRef.current = filteredVerifiedMarkers;
    scheduleCanvasRender();
  }, [filteredVerifiedMarkers, scheduleCanvasRender]);

  // Đồng bộ lại thẻ selectedPlace đang mở ngay khi Admin lưu chỉnh sửa tên / địa chỉ / tọa độ
  useEffect(() => {
    if (!selectedPlace) return;
    const updated = verifiedMapMarkers.find((p) => p.id === selectedPlace.id);
    if (updated) {
      setSelectedPlace(updated);
    }
  }, [verifiedMapMarkers, selectedPlace?.id]);

  useEffect(() => {
    selectedPlaceIdRef.current = selectedPlace?.id || null;
    hoveredPlaceIdRef.current = hoveredPlaceId;
    scheduleCanvasRender();
  }, [selectedPlace, hoveredPlaceId, scheduleCanvasRender]);

  useEffect(() => {
    userCoordsRef.current = userCoords;
    scheduleCanvasRender();
  }, [userCoords, scheduleCanvasRender]);

  // Khởi tạo MapLibre GL JS (Tối ưu 60 FPS: Khóa 1:1 vị trí từng ghim địa điểm vào đúng tọa độ [lng, lat] trên từng khung hình)
  const initMap = useCallback(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    setMapLoadError(null);
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: buildXuhoPastelMapStyle(base),
        center: [XUANHOA_DEFAULT_CENTER.lng, XUANHOA_DEFAULT_CENTER.lat],
        zoom: XUANHOA_DEFAULT_CENTER.zoom,
        pitch: is3DModeRef.current ? 42 : 0,
        bearing: 0,
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 55,
        minZoom: 11.2,
        maxZoom: 19.2,
        maxBounds: XUANHOA_MAX_BOUNDS,
        attributionControl: false,
      });

      const handleUserInteractionStart = () => {
        hasUserInteractedRef.current = true;
      };

      const handleCameraMove = () => {
        isInteractingRef.current = true;
        if (merchantPickingRef.current) {
          const c = map.getCenter();
          const coordText = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
          if (liveCoordTopBadgeRef.current) {
            liveCoordTopBadgeRef.current.textContent = coordText;
          }
          if (liveCoordBottomBadgeRef.current) {
            liveCoordBottomBadgeRef.current.textContent = coordText;
          }
          if (pinColumnRef.current) {
            pinColumnRef.current.style.transform = 'translateY(-10px) scale(1.12)';
          }
        }
        scheduleCanvasRender();
      };

      const handleResize = () => {
        const mapCanvas = map.getCanvas();
        if (mapCanvas) {
          canvasDimsRef.current = {
            width: mapCanvas.clientWidth || 1200,
            height: mapCanvas.clientHeight || 800,
          };
        }
        handleCameraSettle();
      };

      const handleCameraSettle = () => {
        isInteractingRef.current = false;
        if (pinColumnRef.current) {
          pinColumnRef.current.style.transform = 'translateY(0px) scale(1)';
        }
        if (merchantPickingRef.current) {
          setIsPinLifted(false);
          const c = map.getCenter();
          setLivePickCoords({
            lat: Number(c.lat.toFixed(6)),
            lng: Number(c.lng.toFixed(6)),
          });
        }
        setCurrentZoom(map.getZoom());
        scheduleCanvasRender();
      };

      map.on('mousedown', handleUserInteractionStart);
      map.on('touchstart', handleUserInteractionStart);
      map.on('wheel', handleUserInteractionStart);
      map.on('load', handleResize);
      map.on('move', handleCameraMove);
      map.on('moveend', handleCameraSettle);
      map.on('resize', handleResize);
      map.on('error', () => {});

      mapInstanceRef.current = map;
      handleResize();

      return () => {
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (err: any) {
      setIsMapLoading(false);
      setMapLoadError(
        err?.message ||
          'Không thể khởi tạo bộ dựng bản đồ trên thiết bị này. Vui lòng thử tải lại.'
      );
    }
  }, [scheduleCanvasRender]);

  useEffect(() => {
    const cleanup = initMap();
    return () => {
      if (cleanup) cleanup();
    };
  }, [initMap]);

  useEffect(() => {
    scheduleCanvasRender();
  }, [layerVisibility, is3DMode, scheduleCanvasRender]);

  const handleToggle3DMode = useCallback(() => {
    triggerFeedback('tap');
    setIs3DMode((prev) => {
      const next = !prev;
      is3DModeRef.current = next;
      const map = mapInstanceRef.current;
      if (map) {
        map.easeTo({
          pitch: next ? 42 : 0,
          bearing: 0,
          duration: 380,
        });
      }
      scheduleCanvasRender();
      return next;
    });
  }, [scheduleCanvasRender]);

  // Xử lý click lên bản đồ:
  // 1. Nếu Chủ quán đang cắm ghim -> Di chuyển tâm ngắm ghim tới đúng vị trí vừa chạm (kèm phản hồi âm thanh)
  // 2. Nếu Admin đang chấm chọn tọa độ -> Lưu tọa độ Admin
  // 3. Nếu người dùng bấm vào bất kỳ khu phố / Khu Đô Thị nào trên bản đồ -> Chuyển Tiêu điểm 3D (Spotlight 3D)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const pickedLat = Number(e.lngLat.lat.toFixed(6));
      const pickedLng = Number(e.lngLat.lng.toFixed(6));

      if (merchantPickingForPlace) {
        triggerFeedback('pin');
        setLivePickCoords({ lat: pickedLat, lng: pickedLng });
        map.easeTo({
          center: [pickedLng, pickedLat],
          zoom: Math.max(map.getZoom(), 16.8),
          duration: 320,
        });
        return;
      }

      if (homeModalMode === 'picking') {
        triggerFeedback('pin');
        setHomeLatInput(String(pickedLat));
        setHomeLngInput(String(pickedLng));
        if (!homeAddressInput.trim()) {
          setHomeAddressInput('Phường Xuân Hòa');
        }
        setHomeModalMode('edit');
        setHomeFeedback(
          `Đã lấy tọa độ chỗ bạn sống trên bản đồ (${pickedLat}, ${pickedLng}). Bấm "Lưu chỗ bạn sống" để hoàn tất!`
        );
        return;
      }

      if (isPickingOnMap && isAdminUser) {
        triggerFeedback('pin');
        setAdminLatInput(String(pickedLat));
        setAdminLngInput(String(pickedLng));
        setAdminCoordSource('admin_verified');
        setIsPickingOnMap(false);
        setIsAdminCoordModalOpen(true);
        setAdminFeedback(
          `Đã lấy tọa độ trên bản đồ: ${pickedLat}, ${pickedLng}. Hãy nhấn "Xác nhận & Lưu" để hoàn tất.`
        );
        return;
      }

      // Chuyển Tiêu điểm 3D (Spotlight 3D Focus) sang đúng khu vực người dùng vừa ấn vào
      focusTargetRef.current = {
        lat: pickedLat,
        lng: pickedLng,
        radiusDeg: 0.0044,
        label: 'Khu vực đang chọn trên bản đồ',
      };
      setFocusZoneLabel('📍 Khu phố vừa chạm chọn (Nổi 3D)');
      scheduleCanvasRender();
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [
    homeModalMode,
    homeAddressInput,
    isPickingOnMap,
    isAdminUser,
    merchantPickingForPlace,
    scheduleCanvasRender,
  ]);

  useEffect(() => {
    userHomeRef.current = userHome;
    scheduleCanvasRender();
  }, [userHome, scheduleCanvasRender]);

  // Điều hướng Camera + Cập nhật Tiêu điểm 3D (Spotlight 3D) tới đúng vùng đang xem
  const flyToCoordinates = useCallback(
    (lat: number, lng: number, zoom = 16.4, focusLabel?: string, radiusDeg = 0.0044) => {
      const map = mapInstanceRef.current;
      focusTargetRef.current = {
        lat,
        lng,
        radiusDeg,
        label: focusLabel || focusTargetRef.current.label,
      };
      if (focusLabel) setFocusZoneLabel(focusLabel);

      if (!map) return;
      // Mở rộng maxBounds tự động nếu tọa độ định vị của người dùng nằm ngoài khung mặc định
      if (
        lng < XUANHOA_MAX_BOUNDS[0][0] ||
        lng > XUANHOA_MAX_BOUNDS[1][0] ||
        lat < XUANHOA_MAX_BOUNDS[0][1] ||
        lat > XUANHOA_MAX_BOUNDS[1][1]
      ) {
        map.setMaxBounds([
          [
            Math.min(XUANHOA_MAX_BOUNDS[0][0], lng - 0.05),
            Math.min(XUANHOA_MAX_BOUNDS[0][1], lat - 0.05),
          ],
          [
            Math.max(XUANHOA_MAX_BOUNDS[1][0], lng + 0.05),
            Math.max(XUANHOA_MAX_BOUNDS[1][1], lat + 0.05),
          ],
        ]);
      }

      map.flyTo({
        center: [lng, lat],
        zoom,
        speed: 1.35,
        curve: 1.2,
        essential: true,
      });
      scheduleCanvasRender();
    },
    [scheduleCanvasRender]
  );

  const handleSelectVerifiedPlace = useCallback(
    (place: PlaceLocation) => {
      highlightedRoadNameRef.current = '';
      setSelectedGameAsset(null);
      setClusterSelectionList(null);
      setSelectedPlace(place);
      if (place.lat !== null && place.lng !== null) {
        flyToCoordinates(
          place.lat,
          place.lng,
          Math.max(currentZoom, 16.3),
          place.name,
          0.0042
        );
      }
    },
    [flyToCoordinates, currentZoom]
  );

  // Vẽ đường đi Google Maps-style từ vị trí thực tế của khách hàng (GPS thật, VD: Phúc Yên) đến đúng địa chỉ tại Xuân Hòa
  const handleDrawRouteToPlace = useCallback(
    (place: PlaceLocation, mode: TravelMode = 'motorbike') => {
      if (place.lat === null || place.lng === null) return;

      const origin = userCoords || {
        lat: XUANHOA_DEFAULT_CENTER.lat,
        lng: XUANHOA_DEFAULT_CENTER.lng,
      };
      setLayerVisibility((prev) => ({ ...prev, userLocation: true }));

      const originLabel = userCoords ? 'Vị trí GPS của bạn' : 'Trung tâm Xuân Hòa';
      const roadFeatures = geoLayersRef.current?.roads || [];
      const computed = computeLocalRoadRoute(
        origin.lat,
        origin.lng,
        place.lat,
        place.lng,
        roadFeatures,
        mode
      );
      const eta = calculateDistanceAndEta(
        origin.lat,
        origin.lng,
        place.lat,
        place.lng,
        computed.distanceMeters
      );

      const newRoute = {
        targetPlace: place,
        travelMode: mode,
        originCoords: origin,
        pathLngLat: computed.coordinates,
        totalDistanceMeters: computed.distanceMeters,
        remainingDistanceMeters: computed.distanceMeters,
        eta,
        roadNames: computed.roadNames,
        originLabel,
        progressIndex: 0,
        currentPos: computed.coordinates[0] || ([origin.lng, origin.lat] as [number, number]),
        hasArrived: false,
        isInfoExpanded: false,
      };
      setActiveRoute(newRoute);
      activeRouteRef.current = newRoute;
      // Tự động đóng bảng popup lớn ở đáy và thông báo phụ để màn hình gọn gàng chuẩn Google Maps
      setSelectedPlace(null);
      setLocationNotice(null);

      // Nếu khách đang ở xa (VD: Phúc Yên > 2.5km), giữ góc nhìn ưu tiên vào lộ trình tiến vào địa điểm tại Xuân Hòa để nhìn rõ đường phố, còn nếu ở gần thì căn giữa toàn tuyến
      const distMeters = haversineDistanceMeters(origin.lat, origin.lng, place.lat, place.lng);
      if (distMeters > 2500) {
        flyToCoordinates(place.lat, place.lng, 15.6, `Đường tới ${place.name}`, 0.0055);
      } else {
        const midLat = (origin.lat + place.lat) * 0.5;
        const midLng = (origin.lng + place.lng) * 0.5;
        const distDeg = Math.hypot(origin.lat - place.lat, origin.lng - place.lng);
        const targetZoom = distDeg > 0.015 ? 14.8 : distDeg > 0.007 ? 15.5 : 16.0;
        flyToCoordinates(midLat, midLng, targetZoom, `Đường tới ${place.name}`, 0.0055);
      }
      scheduleCanvasRender();
    },
    [userCoords, flyToCoordinates, scheduleCanvasRender]
  );

  // Chuyển đổi phương tiện (Ô tô | Xe máy | Xe đạp | Đi bộ) ngay trên thanh dẫn đường
  const handleSwitchRouteMode = useCallback(
    (newMode: TravelMode) => {
      const current = activeRouteRef.current;
      if (!current || current.targetPlace.lat === null || current.targetPlace.lng === null) return;
      const origin = current.originCoords;
      const place = current.targetPlace;
      const roadFeatures = geoLayersRef.current?.roads || [];
      const computed = computeLocalRoadRoute(
        origin.lat,
        origin.lng,
        place.lat!,
        place.lng!,
        roadFeatures,
        newMode
      );
      const eta = calculateDistanceAndEta(
        origin.lat,
        origin.lng,
        place.lat!,
        place.lng!,
        computed.distanceMeters
      );
      const updated = {
        ...current,
        travelMode: newMode,
        pathLngLat: computed.coordinates,
        totalDistanceMeters: computed.distanceMeters,
        remainingDistanceMeters: computed.distanceMeters,
        eta,
        roadNames: computed.roadNames,
        progressIndex: 0,
        currentPos: computed.coordinates[0] || ([origin.lng, origin.lat] as [number, number]),
        hasArrived: false,
      };
      setActiveRoute(updated);
      activeRouteRef.current = updated;
      scheduleCanvasRender();
    },
    [scheduleCanvasRender]
  );

  // Mô phỏng & đồng bộ hành trình di chuyển dọc theo tuyến đường tới đích + tự động báo khi đến nơi
  useEffect(() => {
    if (!activeRoute || activeRoute.hasArrived) return;
    const coords = activeRoute.pathLngLat;
    if (!coords || coords.length < 2) return;

    const stepIntervalMs =
      activeRoute.travelMode === 'car'
        ? 650
        : activeRoute.travelMode === 'motorbike'
        ? 750
        : activeRoute.travelMode === 'bicycle'
        ? 950
        : 1150;

    const timer = setInterval(() => {
      setActiveRoute((prev) => {
        if (!prev || prev.hasArrived) return prev;
        const totalPts = prev.pathLngLat.length;
        const step = Math.max(1, Math.ceil(totalPts / 18));
        const nextIdx = Math.min(totalPts - 1, prev.progressIndex + step);
        const nextPos = prev.pathLngLat[nextIdx];
        const arrived = nextIdx >= totalPts - 1;
        const ratioRemaining = Math.max(0, 1 - nextIdx / Math.max(1, totalPts - 1));
        const remMeters = arrived ? 0 : Math.round(prev.totalDistanceMeters * ratioRemaining);

        const nextState = {
          ...prev,
          progressIndex: nextIdx,
          currentPos: nextPos,
          remainingDistanceMeters: remMeters,
          hasArrived: arrived,
        };
        activeRouteRef.current = nextState;
        scheduleCanvasRender();
        return nextState;
      });
    }, stepIntervalMs);

    return () => clearInterval(timer);
  }, [
    activeRoute?.targetPlace.id,
    activeRoute?.travelMode,
    activeRoute?.hasArrived,
    scheduleCanvasRender,
  ]);

  const handleOpenMerchantPortal = useCallback(
    (tab?: 'merchant' | 'create_new' | 'admin_approvals' | 'admin_codes') => {
      if (tab) {
        setMerchantPortalTab(tab);
      } else if (isAdminUser && pendingApprovalCount > 0) {
        setMerchantPortalTab('admin_approvals');
      } else if (isMapManagerUser && !isAdminUser) {
        setMerchantPortalTab('create_new');
      } else {
        setMerchantPortalTab('merchant');
      }
      setIsMerchantPortalOpen(true);
    },
    [isAdminUser, isMapManagerUser, pendingApprovalCount]
  );

  const handleSelectUnverifiedPlace = useCallback((place: PlaceLocation) => {
    if (place.originalPlace) {
      setModalPlace(place.originalPlace);
    }
  }, []);

  const handleSelectRoad = useCallback(
    (road: RoadSearchResult) => {
      highlightedRoadNameRef.current = road.name;
      setSelectedPlace(null);
      setSelectedGameAsset(null);
      flyToCoordinates(road.lat, road.lng, 16.4, `🛣️ ${road.name}`, 0.0042);
      setLocationNotice(`🛣️ Đang làm nổi bật tuyến đường: ${road.name}`);
      setTimeout(() => setLocationNotice(null), 4000);
    },
    [flyToCoordinates]
  );

  const handleSelectPresetArea = useCallback(
    (preset: MapAreaPreset) => {
      highlightedRoadNameRef.current = '';
      setActivePresetId(preset.id);
      const rDeg = preset.id === 'overview' ? 0.012 : 0.0046;
      flyToCoordinates(preset.lat, preset.lng, preset.zoom, preset.label, rDeg);
    },
    [flyToCoordinates]
  );

  const handleSelectGameAsset = useCallback(
    (asset: GameAsset) => {
      highlightedRoadNameRef.current = '';
      setLayerVisibility((prev) => ({ ...prev, gameAssets: true }));
      setSelectedPlace(null);
      setSelectedGameAsset(asset);
      flyToCoordinates(asset.lat, asset.lng, 16.4, asset.name, 0.0042);
    },
    [flyToCoordinates]
  );

  const handleToggleCategory = useCallback((catId: MapCategoryKey) => {
    if (catId === 'game_asset') {
      setLayerVisibility((prev) => ({ ...prev, gameAssets: !prev.gameAssets }));
      return;
    }
    if (catId === 'all') {
      setSelectedCategories(['all']);
      return;
    }
    setSelectedCategories((prev) => {
      const withoutAll = prev.filter((c) => c !== 'all');
      if (withoutAll.includes(catId)) {
        const next = withoutAll.filter((c) => c !== catId);
        return next.length === 0 ? ['all'] : next;
      }
      return [...withoutAll, catId];
    });
  }, []);

  // Kết nối GPS thông minh:
  // - Khi mở bản đồ (isAutoStartup = true): cắm ghim "Bạn đang ở đây" vào đúng vị trí thực tế bạn đang đứng (VD: Phúc Yên), nhưng giữ camera bản đồ ở Khu trung tâm Xuân Hòa để dễ xem.
  // - Khi bạn chủ động bấm nút Định vị GPS bên phải (isAutoStartup = false): camera mới bay ra đúng vị trí bạn đang đứng.
  const handleLocateUser = useCallback(
    (isAutoStartup = false) => {
      setLocationNotice(null);
      setLayerVisibility((prev) => ({ ...prev, userLocation: true }));

      if (!isAutoStartup && userCoordsRef.current) {
        flyToCoordinates(
          userCoordsRef.current.lat,
          userCoordsRef.current.lng,
          15.8,
          'Vị trí hiện tại của bạn',
          0.0045
        );
        scheduleCanvasRender();
      }

      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        return;
      }

      if (!isAutoStartup) {
        setIsLocatingUser(true);
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocatingUser(false);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          // Luôn cắm ghim đúng 100% vị trí thực tế bạn đang đứng (VD: Phúc Yên)
          setUserCoords({ lat, lng });
          setLayerVisibility((prev) => ({ ...prev, userLocation: true }));

          // Chỉ bay camera ra chỗ bạn đứng khi bạn chủ động bấm nút Định vị GPS
          if (!isAutoStartup) {
            flyToCoordinates(lat, lng, 15.8, 'Vị trí hiện tại của bạn', 0.0045);
          }
          scheduleCanvasRender();
        },
        () => {
          setIsLocatingUser(false);
          scheduleCanvasRender();
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
      );
    },
    [flyToCoordinates, scheduleCanvasRender]
  );

  // Tự động lấy tọa độ GPS thực tế ngầm khi mở trang (cắm ghim đúng chỗ bạn đứng nhưng giữ camera ở Trung tâm Xuân Hòa)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLayerVisibility((prev) => ({ ...prev, userLocation: true }));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLayerVisibility((prev) => ({ ...prev, userLocation: true }));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const populateAdminFormFromPlace = useCallback((target: PlaceLocation | null) => {
    setAdminTargetPlace(target);
    if (!target) {
      setAdminEditName('');
      setAdminEditCategory('public');
      setAdminEditAddress('Phường Xuân Hòa');
      setAdminEditTagline('');
      setAdminEditPhone('');
      setAdminEditHours('07:30 - 17:30');
      setAdminMapsUrlInput('');
      setAdminLatInput('');
      setAdminLngInput('');
      return;
    }
    setAdminEditName(target.name || '');
    setAdminEditCategory(target.category || 'public');
    setAdminEditAddress(target.address || 'Phường Xuân Hòa');
    setAdminEditTagline(target.metadata?.subType || '');
    setAdminEditPhone(target.phone || '');
    setAdminEditHours(target.openHours || '07:30 - 17:30');
    setAdminMapsUrlInput(target.metadata?.mapsUrl || '');
    setAdminLatInput(target.lat !== null ? String(target.lat) : '');
    setAdminLngInput(target.lng !== null ? String(target.lng) : '');
  }, []);

  const openAdminCoordinateModal = useCallback(
    (place?: PlaceLocation) => {
      if (!isAdminUser) {
        setLocationNotice('Chỉ Quản trị viên đã xác thực mới có quyền chỉnh sửa địa điểm.');
        return;
      }
      const target = place || selectedPlace || verifiedMapMarkers[0] || unverifiedCatalogPlaces[0] || null;
      setIsAdminCreatingNew(false);
      populateAdminFormFromPlace(target);
      setAdminCoordSource('admin_verified');
      setNominatimSuggestions([]);
      setAdminFeedback(null);
      setIsAdminCoordModalOpen(true);
    },
    [isAdminUser, selectedPlace, verifiedMapMarkers, unverifiedCatalogPlaces, populateAdminFormFromPlace]
  );

  const openAdminCreatePlaceModal = useCallback(() => {
    if (!isAdminUser) {
      setLocationNotice('Chỉ Quản trị viên đã xác thực mới có quyền thêm địa điểm mới.');
      return;
    }
    const center = mapInstanceRef.current?.getCenter();
    const lat = center ? Number(center.lat.toFixed(6)) : XUANHOA_DEFAULT_CENTER.lat;
    const lng = center ? Number(center.lng.toFixed(6)) : XUANHOA_DEFAULT_CENTER.lng;
    setIsAdminCreatingNew(true);
    setAdminTargetPlace(null);
    setAdminEditName('');
    setAdminEditCategory('public');
    setAdminEditAddress('Phường Xuân Hòa');
    setAdminEditTagline('');
    setAdminEditPhone('');
    setAdminEditHours('07:30 - 17:30');
    setAdminMapsUrlInput('');
    setAdminLatInput(String(lat));
    setAdminLngInput(String(lng));
    setAdminCoordSource('admin_verified');
    setNominatimSuggestions([]);
    setAdminFeedback('💡 Nhập tên địa danh / trụ sở / quán mới, hoặc bấm "Chấm trực tiếp trên Bản đồ" để lấy tọa độ.');
    setIsAdminCoordModalOpen(true);
  }, [isAdminUser]);

  const handleSuggestFromOsm = async () => {
    const query = `${adminMapsUrlInput.trim() || adminEditAddress.trim() || adminEditName.trim()}`;
    if (!query) return;

    const parsed = parseCoordinatesFromInputOrUrl(query);
    if (parsed) {
      setAdminLatInput(String(parsed.lat));
      setAdminLngInput(String(parsed.lng));
      flyToCoordinates(parsed.lat, parsed.lng, 16.8);
      setAdminFeedback(`✅ Đã trích xuất tọa độ (${parsed.lat}, ${parsed.lng}) từ link / Plus Code!`);
      return;
    }

    setIsGeocoding(true);
    setAdminFeedback(null);
    try {
      const list = await geocodeAddressWithNominatim(query);
      setNominatimSuggestions(list);

      const matchedRoad = findSuggestedRoadForAddress(query, osmRoads);
      if (list.length === 0 && matchedRoad) {
        setNominatimSuggestions([
          {
            displayName: `Tâm tuyến đường khớp địa chỉ: ${matchedRoad.name}`,
            lat: matchedRoad.lat,
            lng: matchedRoad.lng,
          },
        ]);
      } else if (list.length === 0) {
        setAdminFeedback(
          'Chưa tìm thấy tự động. Bạn có thể bấm "🎯 Chấm trực tiếp trên Bản đồ" để click đúng vị trí!'
        );
      }
    } catch {
      const matchedRoad = findSuggestedRoadForAddress(query, osmRoads);
      if (matchedRoad) {
        setNominatimSuggestions([
          {
            displayName: `Tâm tuyến đường khớp địa chỉ: ${matchedRoad.name}`,
            lat: matchedRoad.lat,
            lng: matchedRoad.lng,
          },
        ]);
      } else {
        setAdminFeedback('Không thể kết nối dịch vụ gợi ý tọa độ. Hãy chấm trực tiếp trên bản đồ.');
      }
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSaveAdminCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminUser) return;
    try {
      const lat = parseFloat(adminLatInput);
      const lng = parseFloat(adminLngInput);
      const saved = saveLandmarkOrPlaceFromMap({
        id: isAdminCreatingNew ? undefined : adminTargetPlace?.id,
        name: adminEditName,
        category: adminEditCategory,
        address: adminEditAddress,
        tagline: adminEditTagline,
        phone: adminEditPhone,
        openHours: adminEditHours,
        lat,
        lng,
        mapsUrl: adminMapsUrlInput,
      });
      setShowCommercialShops(true);
      setSelectedCategories((prev) =>
        prev.includes(adminEditCategory) ? prev : [...prev, adminEditCategory]
      );
      setSyncTick((t) => t + 1);
      setAdminFeedback(`✅ Đã lưu cập nhật "${adminEditName.trim()}" (${saved.lat}, ${saved.lng}) thành công!`);
      setLocationNotice(`✅ Đã lưu địa điểm: "${adminEditName.trim()}"`);
      flyToCoordinates(saved.lat, saved.lng, 16.6, adminEditName.trim(), 0.0042);
      setTimeout(() => {
        setIsAdminCoordModalOpen(false);
      }, 650);
    } catch (err: any) {
      setAdminFeedback(err?.message || 'Lỗi lưu thông tin địa điểm.');
    }
  };

  const handleDeleteAdminPlace = () => {
    if (!isAdminUser || !adminTargetPlace) return;
    hideLandmarkOrPlaceFromMap(adminTargetPlace.id, adminEditName || adminTargetPlace.name);
    if (selectedPlace?.id === adminTargetPlace.id) {
      setSelectedPlace(null);
    }
    setSyncTick((t) => t + 1);
    setIsAdminCoordModalOpen(false);
    setLocationNotice(`🗑️ Đã ẩn "${adminEditName || adminTargetPlace.name}" khỏi Bản đồ 2D & 3D.`);
  };

  const handleRestoreAdminPlaceDefault = () => {
    if (!isAdminUser || !adminTargetPlace) return;
    restoreLandmarkOrPlaceDefault(adminTargetPlace.id);
    setSyncTick((t) => t + 1);
    setIsAdminCoordModalOpen(false);
    setLocationNotice(`↺ Đã khôi phục "${adminTargetPlace.name}" về dữ liệu gốc mặc định.`);
  };

  // Mở khung cài đặt / thay đổi "Chỗ bạn sinh sống (Nhà của bạn)"
  const handleOpenHomeEditor = useCallback(
    (sourceHome?: UserHomeLocation | null) => {
      const target = sourceHome !== undefined ? sourceHome : userHome;
      const center = mapInstanceRef.current?.getCenter();
      const defaultLat =
        target?.lat ??
        userCoords?.lat ??
        (center ? Number(center.lat.toFixed(6)) : XUANHOA_DEFAULT_CENTER.lat);
      const defaultLng =
        target?.lng ??
        userCoords?.lng ??
        (center ? Number(center.lng.toFixed(6)) : XUANHOA_DEFAULT_CENTER.lng);
      setHomeLabelInput(target?.label || 'Nhà của bạn');
      setHomeAddressInput(target?.address || 'Phường Xuân Hòa');
      setHomeMapsInput('');
      setHomeLatInput(String(defaultLat));
      setHomeLngInput(String(defaultLng));
      setHomeFeedback(null);
      setHomeModalMode('edit');
    },
    [userHome, userCoords]
  );

  // Khi ấn vào biểu tượng ngôi nhà (🏠) trên thanh công cụ dọc
  const handleClickHomeButton = useCallback(() => {
    triggerFeedback('tap');
    if (userHome) {
      flyToCoordinates(
        userHome.lat,
        userHome.lng,
        16.8,
        userHome.label || 'Nhà của bạn',
        0.0038
      );
      setHomeModalMode('view');
    } else {
      handleOpenHomeEditor(null);
    }
  }, [userHome, flyToCoordinates, handleOpenHomeEditor]);

  // Tìm tọa độ từ link Google Maps / Plus Code / Địa chỉ cho Nhà của bạn
  const handleSuggestHomeCoords = async () => {
    const query = homeMapsInput.trim() || homeAddressInput.trim();
    if (!query) return;

    const parsed = parseCoordinatesFromInputOrUrl(query);
    if (parsed) {
      setHomeLatInput(String(parsed.lat));
      setHomeLngInput(String(parsed.lng));
      flyToCoordinates(parsed.lat, parsed.lng, 16.8, homeLabelInput || 'Nhà của bạn');
      setHomeFeedback(`Đã trích xuất tọa độ (${parsed.lat}, ${parsed.lng}) từ định vị Maps!`);
      return;
    }

    setIsGeocoding(true);
    setHomeFeedback(null);
    try {
      const list = await geocodeAddressWithNominatim(query);
      if (list.length > 0) {
        const best = list[0];
        setHomeLatInput(String(best.lat));
        setHomeLngInput(String(best.lng));
        if (!homeAddressInput.trim() || homeAddressInput === 'Phường Xuân Hòa') {
          setHomeAddressInput(best.displayName.split(',').slice(0, 2).join(','));
        }
        flyToCoordinates(best.lat, best.lng, 16.8, homeLabelInput || 'Nhà của bạn');
        setHomeFeedback(`Đã định vị: ${best.displayName}`);
        return;
      }
      const matchedRoad = findSuggestedRoadForAddress(query, osmRoads);
      if (matchedRoad) {
        setHomeLatInput(String(matchedRoad.lat));
        setHomeLngInput(String(matchedRoad.lng));
        flyToCoordinates(matchedRoad.lat, matchedRoad.lng, 16.8, matchedRoad.name);
        setHomeFeedback(`Đã khớp tuyến đường: ${matchedRoad.name}. Hãy bấm lưu hoặc chấm chính xác ngôi nhà.`);
      } else {
        setHomeFeedback('Chưa tìm thấy tự động. Hãy bấm "Chấm vị trí nhà trên bản đồ" để chạm đúng ngôi nhà của bạn.');
      }
    } catch {
      const matchedRoad = findSuggestedRoadForAddress(query, osmRoads);
      if (matchedRoad) {
        setHomeLatInput(String(matchedRoad.lat));
        setHomeLngInput(String(matchedRoad.lng));
        flyToCoordinates(matchedRoad.lat, matchedRoad.lng, 16.8, matchedRoad.name);
        setHomeFeedback(`Đã khớp tuyến đường: ${matchedRoad.name}.`);
      } else {
        setHomeFeedback('Hãy bấm "Chấm vị trí nhà trên bản đồ" để chạm đúng vị trí nhà bạn.');
      }
    } finally {
      setIsGeocoding(false);
    }
  };

  // Lưu Chỗ bạn sinh sống (Nhà của bạn) cho tài khoản hiện tại
  const handleSaveUserHome = useCallback(
    (payload: { label: string; address: string; lat: number; lng: number }) => {
      const saved = saveUserHomeForUser(userAccountKey, payload);
      if (saved) {
        setUserHome(saved);
        userHomeRef.current = saved;
        flyToCoordinates(saved.lat, saved.lng, 16.8, saved.label, 0.0038);
        setHomeModalMode('view');
        setLocationNotice(`🏠 Đã lưu "${saved.label}" tại ${saved.address}`);
        window.setTimeout(() => setLocationNotice(null), 3000);
      }
    },
    [userAccountKey, flyToCoordinates]
  );

  // Xóa Chỗ bạn sinh sống đã lưu
  const handleClearUserHome = useCallback(() => {
    clearUserHomeForUser(userAccountKey);
    setUserHome(null);
    userHomeRef.current = null;
    setHomeModalMode('closed');
    scheduleCanvasRender();
    setLocationNotice('Đã xóa vị trí nhà đã lưu. Bấm biểu tượng 🏠 để định vị lại bất cứ lúc nào.');
    window.setTimeout(() => setLocationNotice(null), 3000);
  }, [userAccountKey, scheduleCanvasRender]);

  // Chỉ đường về Nhà của bạn
  const handleRouteToUserHome = useCallback(
    (homeTarget: UserHomeLocation) => {
      const syntheticHomePlace: PlaceLocation = {
        id: 'user_saved_home',
        name: homeTarget.label || 'Nhà của bạn',
        category: 'public',
        address: homeTarget.address || 'Chỗ bạn sinh sống tại Xuân Hòa',
        lat: homeTarget.lat,
        lng: homeTarget.lng,
        coordinateSource: 'admin_verified',
        coordinateVerified: true,
        dataSource: 'admin_custom',
        lastVerifiedAt: null,
        insideWard: true,
        openHours: '24/7',
        metadata: {
          subType: 'Địa chỉ nhà / chỗ sinh sống đã lưu của bạn',
        },
      };
      setHomeModalMode('closed');
      handleDrawRouteToPlace(syntheticHomePlace, 'motorbike');
    },
    [handleDrawRouteToPlace]
  );

  return (
    <div
      className="xuho-light-map-root relative w-full h-[calc(100dvh-60px)] md:h-dvh overflow-hidden select-none"
      style={{
        backgroundColor: '#F8F5EE',
        colorScheme: 'light',
        fontFamily:
          "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <style>{`
        .xuho-light-map-root select,
        .xuho-light-map-root select option,
        .xuho-light-map-root input,
        .xuho-light-map-root textarea {
          color-scheme: light !important;
          background-color: #FFFDF9 !important;
          color: #1E293B !important;
        }
      `}</style>
      {/* 1A. LỚP BẢN ĐỒ ĐỊA LÝ VECTOR ĐỒNG BỘ 1:1 VỚI MAPLIBRE */}
      <canvas
        ref={vectorCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
      />

      {/* 1B. BỘ ĐIỀU KHIỂN CAMERA & PROJECTION MAPLIBRE GL JS */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full z-[2]"
        style={{
          cursor:
            isPickingOnMap || merchantPickingForPlace || homeModalMode === 'picking'
              ? 'crosshair'
              : 'grab',
          background: 'transparent',
        }}
      />

      {/* 2. LỚP MARKER ĐỊA ĐIỂM ĐÃ XÁC MINH — KHÓA CỨNG 1:1 VÀO TỌA ĐỘ ĐỊA LÝ THẬT TRÊN TỪNG KHUNG HÌNH (60FPS ZERO-JITTER) */}
      <div
        ref={markerOverlayRef}
        className="absolute inset-0 pointer-events-none overflow-hidden z-10"
      >
        {/* Marker Vị trí người dùng (User Location Layer) */}
        {userCoords && layerVisibility.userLocation && (
          <div
            ref={(el) => {
              userMarkerElRef.current = el;
            }}
            style={{
              transform: 'translate3d(-9999px, -9999px, 0)',
              zIndex: 50,
              willChange: 'transform',
            }}
            className="absolute top-0 left-0 pointer-events-auto"
            title="Vị trí hiện tại của bạn (GPS)"
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-0.5 rounded-full bg-[#39B980] text-white border-2 border-[#403064] text-[10.5px] leading-snug font-extrabold whitespace-nowrap shadow-md">
                Bạn đang ở đây
              </div>
              <span className="absolute w-11 h-11 rounded-full bg-[#39B980]/35 animate-ping" />
              <span className="w-4 h-4 rounded-full bg-[#39B980] border-2 border-[#FFFFFF] ring-2 ring-[#403064] shadow-md" />
            </div>
          </div>
        )}

        {/* Marker Chỗ bạn sinh sống / Nhà của bạn (User Home Location) */}
        {userHome && (
          <div
            ref={(el) => {
              userHomeMarkerElRef.current = el;
            }}
            style={{
              transform: 'translate3d(-9999px, -9999px, 0)',
              zIndex: 48,
              willChange: 'transform',
            }}
            className="absolute top-0 left-0 pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => {
                flyToCoordinates(userHome.lat, userHome.lng, 16.8, userHome.label, 0.0038);
                setHomeModalMode('view');
              }}
              title={`${userHome.label}: ${userHome.address}`}
              className="group relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer focus:outline-none"
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-0.5 rounded-xl bg-[#FEF3C7] text-[#92400E] border-2 border-[#D97706] text-[10.5px] leading-snug font-extrabold whitespace-nowrap shadow-md">
                🏠 {userHome.label}
              </div>
              <div className="w-8 h-8 rounded-2xl bg-[#D97706] text-white border-2 border-white ring-2 ring-[#92400E] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform text-xs font-extrabold">
                🏠
              </div>
            </button>
          </div>
        )}

        {/* Marker Tài sản Game Demo (Game Assets Layer) */}
        {layerVisibility.gameAssets &&
          DEMO_GAME_ASSETS.map((asset) => {
            const isSelected = selectedGameAsset?.id === asset.id;
            return (
              <button
                key={asset.id}
                ref={(el) => {
                  if (el) {
                    gameAssetElsRef.current.set(asset.id, el);
                  } else {
                    gameAssetElsRef.current.delete(asset.id);
                  }
                }}
                type="button"
                onClick={() => handleSelectGameAsset(asset)}
                style={{
                  transform: 'translate3d(-9999px, -9999px, 0)',
                  willChange: 'transform',
                }}
                className="absolute top-0 left-0 pointer-events-auto group cursor-pointer focus:outline-none"
                aria-label={`Tài sản game demo ${asset.name}`}
              >
                <div
                  className="-translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border-2 transition-transform shadow-[0_6px_16px_rgba(64,48,100,0.22)]"
                  style={{
                    backgroundColor: isSelected ? '#39B980' : '#403064',
                    borderColor: '#FFFDF9',
                    color: '#FFFFFF',
                    transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                  }}
                >
                  <span className="text-xs">{asset.ownerAvatar || '🏰'}</span>
                  <span className="text-[10px] font-extrabold tracking-wide leading-snug">
                    DEMO LOT
                  </span>
                </div>
              </button>
            );
          })}

        {/* Marker Địa điểm thực tế đã xác minh tọa độ (Khóa cứng từng tọa độ 1:1, nhãn text tách biệt tuyệt đối không gây dịch chuyển tâm icon) */}
        {filteredVerifiedMarkers.map((loc) => {
          const cat = MAP_CATEGORY_BY_ID[loc.category];
          const isSelected = selectedPlace?.id === loc.id;
          const isHovered = hoveredPlaceId === loc.id;
          const isSavedMarker = savedPlaceIds.includes(loc.id);

          return (
            <div
              key={loc.id}
              ref={(el) => {
                if (el) {
                  markerElsRef.current.set(loc.id, el);
                } else {
                  markerElsRef.current.delete(loc.id);
                }
              }}
              style={{
                transform: 'translate3d(-9999px, -9999px, 0)',
                zIndex: isSelected ? 45 : isHovered ? 35 : isSavedMarker ? 28 : 20,
                willChange: 'transform',
              }}
              className="absolute top-0 left-0 pointer-events-auto"
            >
              <button
                type="button"
                onMouseEnter={() => setHoveredPlaceId(loc.id)}
                onMouseLeave={() => setHoveredPlaceId(null)}
                onFocus={() => setHoveredPlaceId(loc.id)}
                onBlur={() => setHoveredPlaceId(null)}
                onClick={() => handleSelectVerifiedPlace(loc)}
                aria-label={`Địa điểm ${loc.name}`}
                className="group relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none cursor-pointer"
              >
                {/* Nhãn tên địa điểm đặt absolute phía trên icon để khi ẩn/hiện không bao giờ làm xê dịch tâm tọa độ của icon */}
                <div
                  ref={(el) => {
                    if (el) {
                      markerLabelElsRef.current.set(loc.id, el);
                    } else {
                      markerLabelElsRef.current.delete(loc.id);
                    }
                  }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-xl border-2 text-[10.5px] sm:text-[11px] leading-snug font-extrabold whitespace-nowrap max-w-[175px] sm:max-w-[200px] truncate shadow-sm pointer-events-none"
                  style={{
                    backgroundColor: isSelected ? '#403064' : isSavedMarker ? '#FEF3C7' : '#FFFDF9',
                    borderColor: isSavedMarker ? '#D97706' : '#403064',
                    color: isSelected ? '#FFFFFF' : '#2D2246',
                  }}
                >
                  {isSavedMarker ? `★ ${loc.name}` : loc.name}
                </div>

                {/* Huy hiệu Icon neo chính xác 100% vào tọa độ [lng, lat] */}
                <div
                  className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-2xl border-2 flex items-center justify-center text-white transition-transform shadow-[0_5px_12px_rgba(64,48,100,0.22)]"
                  style={{
                    backgroundColor: isSelected
                      ? '#403064'
                      : cat?.markerBg || '#39B980',
                    borderColor: isSelected ? '#39B980' : isSavedMarker ? '#F59E0B' : '#403064',
                    transform: isSelected
                      ? 'scale(1.16)'
                      : isHovered
                      ? 'scale(1.08)'
                      : 'scale(1)',
                  }}
                >
                  {cat ? renderCategoryIcon(cat.iconName, 14) : <MapPin size={14} />}
                  {isSavedMarker && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#F59E0B] text-white border border-white text-[8px] font-black flex items-center justify-center shadow-xs">
                      ★
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. LỚP GIAO DIỆN ĐIỀU KHIỂN TRÊN CÙNG — GỌN GÀNG CHUẨN GOOGLE MAPS (MOBILE & WEB) */}
      <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 z-30 flex flex-col gap-1.5 pointer-events-none">
        <div className="relative flex items-center gap-1.5 sm:gap-2 pointer-events-auto max-w-xl">
          <button
            type="button"
            onClick={onBackToHome}
            aria-label="Quay lại trang chủ Xuân Hòa Có Gì"
            title="Quay lại trang chủ Xuân Hòa Có Gì"
            className="hidden md:flex px-3.5 h-9 sm:h-10 rounded-full bg-white/96 border border-slate-200/90 text-slate-800 hover:bg-slate-100 font-extrabold text-xs leading-snug items-center justify-center shadow-[0_6px_20px_rgba(15,23,42,0.10)] backdrop-blur-md shrink-0 cursor-pointer transition"
          >
            <span>Trang chủ</span>
          </button>

          <MapSearchBar
            verifiedPlaces={verifiedMapMarkers}
            unverifiedPlaces={unverifiedCatalogPlaces}
            roads={osmRoads}
            gameAssets={DEMO_GAME_ASSETS}
            selectedCategories={selectedCategories}
            isCategoryDrawerOpen={isCategoryDropdown2DOpen}
            onToggleCategoryDrawer={() => {
              setIsCategoryDropdown2DOpen((v) => !v);
              setIsSavedDropdown2DOpen(false);
            }}
            savedPlaceIds={savedPlaceIds}
            isSavedDrawerOpen={isSavedDropdown2DOpen}
            onToggleSavedDrawer={() => {
              setIsSavedDropdown2DOpen((v) => !v);
              setIsCategoryDropdown2DOpen(false);
            }}
            activeCategoryLabel="Danh mục"
            onSelectVerifiedPlace={handleSelectVerifiedPlace}
            onSelectUnverifiedPlace={handleSelectUnverifiedPlace}
            onSelectRoad={handleSelectRoad}
            onSelectGameAsset={handleSelectGameAsset}
            onSelectPreset={handleSelectPresetArea}
            isGameLayerEnabled={layerVisibility.gameAssets}
            onToggleGameLayer={() =>
              setLayerVisibility((prev) => ({ ...prev, gameAssets: !prev.gameAssets }))
            }
            isAdminUser={isAdminUser}
            onOpenAdminCoordTool={openAdminCoordinateModal}
            userCoords={userCoords}
            onDrawRouteToPlace={handleDrawRouteToPlace}
            onOpenMerchantPortal={(tab) => handleOpenMerchantPortal(tab)}
            pendingApprovalCount={pendingApprovalCount}
            activePresetId={activePresetId}
            hasClaimedPlaces={hasClaimedPlaces}
            claimedPlaceName={claimedPlaceName}
          />

          {/* Bảng Bật / Tắt từng Danh mục xổ xuống gọn gàng (Auto: Hành chính + Trường học) */}
          {isCategoryDropdown2DOpen && (
            <div className="absolute top-11 left-0 md:left-24 z-50 w-[250px] sm:w-[270px] rounded-2xl bg-white/98 backdrop-blur-md border border-slate-200/90 shadow-[0_14px_34px_rgba(15,23,42,0.18)] p-2 flex flex-col gap-1">
              <div className="px-2 py-1 flex items-center justify-between border-b border-slate-100">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  Bật / Tắt danh mục
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCommercialShops(false);
                      setSelectedCategories(['public', 'school']);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#E6F7EF] hover:bg-[#D1FAE5] text-[#047857] text-[10px] font-extrabold cursor-pointer"
                    title="Khôi phục mặc định: chỉ bật Hành chính + Trường học"
                  >
                    Mặc định
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdown2DOpen(false)}
                    className="px-1.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>

              {(
                [
                  {
                    key: 'public',
                    cats: ['public', 'medical'] as MapCategoryKey[],
                    label: 'Hành chính & Công cộng',
                    activeBg: 'bg-[#059669] text-white',
                    isDefault: true,
                  },
                  {
                    key: 'school',
                    cats: ['school'] as MapCategoryKey[],
                    label: 'Trường học & Giảng đường',
                    activeBg: 'bg-[#10B981] text-white',
                    isDefault: true,
                  },
                  {
                    key: 'food',
                    cats: ['food'] as MapCategoryKey[],
                    label: 'Quán ăn',
                    activeBg: 'bg-[#E11D48] text-white',
                    isDefault: false,
                  },
                  {
                    key: 'pub',
                    cats: ['pub'] as MapCategoryKey[],
                    label: 'Quán nhậu & Lẩu',
                    activeBg: 'bg-[#D97706] text-white',
                    isDefault: false,
                  },
                  {
                    key: 'cafe',
                    cats: ['cafe'] as MapCategoryKey[],
                    label: 'Cafe & Trà',
                    activeBg: 'bg-[#0284C7] text-white',
                    isDefault: false,
                  },
                  {
                    key: 'snack',
                    cats: ['snack'] as MapCategoryKey[],
                    label: 'Ăn vặt',
                    activeBg: 'bg-[#9333EA] text-white',
                    isDefault: false,
                  },
                  {
                    key: 'service',
                    cats: [
                      'service',
                      'grocery',
                      'supermarket',
                      'phone',
                      'billiards',
                      'game',
                      'entertainment',
                    ] as MapCategoryKey[],
                    label: 'Dịch vụ & Tiện ích',
                    activeBg: 'bg-[#475569] text-white',
                    isDefault: false,
                  },
                ] as const
              ).map((tab) => {
                const isActive = tab.cats.some((c) => selectedCategories.includes(c));
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSelectedCategories((prev) => {
                        const base: MapCategoryKey[] = prev.filter((c) => c !== 'all');
                        const hasAny = tab.cats.some((c) => base.includes(c));
                        if (hasAny) {
                          return base.filter((c) => !tab.cats.includes(c));
                        }
                        return [...base, ...tab.cats];
                      });
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      isActive ? tab.activeBg : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isActive ? 'bg-black/20 text-white' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {isActive ? 'Đang bật' : 'Tắt'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Bảng Địa điểm đã lưu (★) theo đúng tài khoản (nick) của khách */}
          {isSavedDropdown2DOpen && (
            <div className="absolute top-11 left-0 md:left-24 z-50 w-[275px] sm:w-[310px] rounded-2xl bg-white/98 backdrop-blur-md border border-[#F59E0B]/70 shadow-[0_14px_34px_rgba(15,23,42,0.18)] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-[#B45309]">
                    ★ Địa điểm đã lưu ({savedPlaceObjects.length})
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 truncate">
                    Nick: {userAccountLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavedDropdown2DOpen(false)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10.5px] font-bold cursor-pointer shrink-0"
                >
                  Đóng
                </button>
              </div>

              {savedPlaceObjects.length === 0 ? (
                <div className="py-4 px-2 text-center text-[11px] text-slate-500 space-y-1">
                  <div className="font-bold text-slate-700">Chưa có địa điểm nào được lưu</div>
                  <div>
                    Hãy bấm nút <strong className="text-[#B45309]">☆ Lưu</strong> trên thông tin địa điểm bất kỳ để lưu lại cho lần mở sau.
                  </div>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-0.5">
                  {savedPlaceObjects.map((item) => (
                    <div
                      key={item.id}
                      className="py-1.5 px-1.5 flex items-center justify-between gap-1.5 hover:bg-amber-50/60 rounded-xl transition"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsSavedDropdown2DOpen(false);
                          handleSelectVerifiedPlace(item);
                        }}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="text-[11.5px] font-extrabold text-slate-800 truncate">
                          ★ {item.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {item.address}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSavedDropdown2DOpen(false);
                            handleDrawRouteToPlace(item, 'motorbike');
                          }}
                          className="px-2 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-[10px] font-extrabold cursor-pointer"
                        >
                          Đi tới
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSavePlace(item)}
                          title="Bỏ lưu địa điểm này"
                          className="px-1.5 py-1 rounded-lg bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] text-[10px] font-extrabold cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cụm nút điều khiển nổi góc phải (3D, GPS, Lớp bản đồ, Về trung tâm) */}
        <MapControls
          onZoomIn={() => mapInstanceRef.current?.zoomIn()}
          onZoomOut={() => mapInstanceRef.current?.zoomOut()}
          onResetCenter={() => {
            highlightedRoadNameRef.current = '';
            setActivePresetId('dhsp2');
            flyToCoordinates(
              XUANHOA_DEFAULT_CENTER.lat,
              XUANHOA_DEFAULT_CENTER.lng,
              XUANHOA_DEFAULT_CENTER.zoom,
              'Khu ĐH Sư Phạm 2',
              0.0044
            );
          }}
          onLocateUser={() => handleLocateUser(false)}
          isLocatingUser={isLocatingUser}
          layerVisibility={layerVisibility}
          onToggleLayer={(key) =>
            setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
          }
          onSelectPreset={handleSelectPresetArea}
          activePresetId={activePresetId}
          onOpenDataQualityModal={() => setIsDataQualityOpen(true)}
          is3DMode={is3DMode}
          onToggle3DMode={handleToggle3DMode}
          onOpenCity3D={() => setIsCity3DOpen(true)}
          onClickHomeButton={handleClickHomeButton}
          hasSavedHome={Boolean(userHome)}
        />

        {/* Banner hướng dẫn khi khách hàng đang chạm chọn vị trí Nhà của bạn trên bản đồ */}
        {homeModalMode === 'picking' && (
          <div className="pointer-events-auto self-start px-3.5 py-2 rounded-2xl bg-[#FFFDF9] text-[#1E293B] border-2 border-[#D97706] shadow-lg text-xs leading-snug font-extrabold flex items-center gap-2">
            <span>
              Chạm vào đúng vị trí ngôi nhà / ngõ bạn đang sinh sống trên bản đồ để ghim Nhà của bạn
            </span>
            <button
              type="button"
              onClick={() => setHomeModalMode('edit')}
              className="px-2 py-0.5 rounded-lg bg-[#FEF3C7] text-[#92400E] border border-[#D97706] text-[10.5px] font-extrabold cursor-pointer shrink-0"
            >
              Quay lại
            </button>
          </div>
        )}

        {/* Banner hướng dẫn ở trên khi Chủ quán đang ngắm tâm ghim mặt tiền quán */}
        {merchantPickingForPlace && (
          <div className="pointer-events-auto self-start px-3.5 py-2 rounded-2xl bg-[#FFFDF9] text-[#1E293B] border-2 border-[#39B980] shadow-lg text-xs leading-snug font-bold flex items-center gap-2">
            <span>
              Kéo bản đồ hoặc chạm điểm bất kỳ để đặt tâm ghim vào mặt tiền{' '}
              <strong className="text-[#1D7A52]">"{merchantPickingForPlace.placeName}"</strong>
            </span>
          </div>
        )}

        {/* Thanh Dẫn đường Gọn Gàng Chuẩn Google Maps ở trên cùng bản đồ */}
        {activeRoute && (() => {
          const modeLabelMap: Record<TravelMode, string> = {
            car: 'Ô tô',
            motorbike: 'Xe máy',
            bicycle: 'Xe đạp',
            walk: 'Đi bộ',
          };
          const activeTimeText =
            activeRoute.travelMode === 'car'
              ? activeRoute.eta.carText
              : activeRoute.travelMode === 'motorbike'
              ? activeRoute.eta.bikeText
              : activeRoute.travelMode === 'bicycle'
              ? activeRoute.eta.bicycleText
              : activeRoute.eta.walkText;
          const contactPhone = activeRoute.targetPlace.phone || '0211 3863 203';
          const openStatus = evaluatePlaceOpenStatus(
            activeRoute.targetPlace.openHours,
            activeRoute.targetPlace.metadata?.liveStatus,
            activeRoute.targetPlace.metadata?.liveStatusNote
          );
          const remText =
            activeRoute.remainingDistanceMeters < 1000
              ? `${activeRoute.remainingDistanceMeters} m`
              : `${(activeRoute.remainingDistanceMeters / 1000).toFixed(1)} km`;

          return (
            <div className="pointer-events-auto self-start w-full max-w-md rounded-2xl bg-[#FFFDF9]/98 border-2 border-[#2563EB] text-[#1E293B] shadow-[0_10px_28px_rgba(15,23,42,0.18)] p-2.5 text-[11px] leading-snug space-y-1.5">
              {/* Hàng 1: Trạng thái + Tên điểm đến + Quãng đường/Thời gian + Nút SĐT/Thông tin + Nút Tắt */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded-lg font-extrabold text-[10px] shrink-0 ${
                      activeRoute.hasArrived
                        ? 'bg-[#059669] text-white'
                        : 'bg-[#2563EB] text-white'
                    }`}
                  >
                    {activeRoute.hasArrived ? 'Đã đến nơi' : modeLabelMap[activeRoute.travelMode]}
                  </span>
                  <strong className="text-[12px] font-extrabold text-[#0F172A] truncate">
                    {activeRoute.targetPlace.name}
                  </strong>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="px-2 py-0.5 rounded-lg bg-[#E6F7EF] text-[#047857] font-extrabold text-[10.5px]">
                    {activeRoute.eta.distanceText} · {activeTimeText}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveRoute((prev) =>
                        prev ? { ...prev, isInfoExpanded: !prev.isInfoExpanded } : null
                      )
                    }
                    className={`px-2 py-0.5 rounded-lg font-extrabold text-[10.5px] border cursor-pointer transition ${
                      activeRoute.isInfoExpanded
                        ? 'bg-[#403064] text-white border-[#403064]'
                        : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#3B82F6]/40 hover:bg-[#DBEAFE]'
                    }`}
                  >
                    {activeRoute.isInfoExpanded ? 'Ẩn TT' : 'TT & SĐT'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoute(null);
                      activeRouteRef.current = null;
                      scheduleCanvasRender();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] font-extrabold text-[10.5px] cursor-pointer"
                  >
                    {activeRoute.hasArrived ? 'Đã đến • Tắt' : 'Tắt'}
                  </button>
                </div>
              </div>

              {/* Hàng 2: Chuyển đổi nhanh 4 loại phương tiện (Ô tô | Xe máy | Xe đạp | Đi bộ) */}
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'car', label: 'Ô tô', time: activeRoute.eta.carText },
                    { id: 'motorbike', label: 'Xe máy', time: activeRoute.eta.bikeText },
                    { id: 'bicycle', label: 'Xe đạp', time: activeRoute.eta.bicycleText },
                    { id: 'walk', label: 'Đi bộ', time: activeRoute.eta.walkText },
                  ] as Array<{ id: TravelMode; label: string; time: string }>
                ).map((m) => {
                  const isCurrent = activeRoute.travelMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSwitchRouteMode(m.id)}
                      className={`py-1 px-1.5 rounded-xl border text-center transition cursor-pointer ${
                        isCurrent
                          ? 'bg-[#1E293B] text-white border-[#1E293B] font-extrabold'
                          : 'bg-[#F8FAFC] text-[#334155] border-[#CBD5E1] hover:bg-[#EFF6FF] font-bold'
                      }`}
                    >
                      <span className="block text-[10.5px] leading-tight">{m.label}</span>
                      <span
                        className={`block text-[9.5px] leading-tight ${
                          isCurrent ? 'text-[#6EE7B7]' : 'text-[#047857]'
                        }`}
                      >
                        {m.time}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Hàng 3: Tiến trình đường đi thực tế hoặc Thông báo Đã đến nơi */}
              {activeRoute.hasArrived ? (
                <div className="px-2.5 py-1.5 rounded-xl bg-[#ECFDF5] border border-[#10B981] text-[#065F46] flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[11px]">
                    Bạn đã đến {activeRoute.targetPlace.name}. Bấm nút bên phải để tắt dẫn đường.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoute(null);
                      activeRouteRef.current = null;
                      scheduleCanvasRender();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-[10.5px] shrink-0 cursor-pointer"
                  >
                    Tắt khi đã đến
                  </button>
                </div>
              ) : (
                <div className="px-2.5 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2 text-[10.5px]">
                  <span className="text-[#334155] font-semibold truncate">
                    Lộ trình:{' '}
                    <strong className="text-[#0F172A]">
                      {activeRoute.roadNames.length > 0
                        ? activeRoute.roadNames.slice(0, 2).join(' → ')
                        : 'Trục đường nội khu Xuân Hòa'}
                    </strong>{' '}
                    · Còn <strong className="text-[#2563EB]">{remText}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveRoute((prev) => {
                        if (!prev) return null;
                        const lastIdx = Math.max(0, prev.pathLngLat.length - 1);
                        const next = {
                          ...prev,
                          progressIndex: lastIdx,
                          currentPos: prev.pathLngLat[lastIdx],
                          remainingDistanceMeters: 0,
                          hasArrived: true,
                        };
                        activeRouteRef.current = next;
                        scheduleCanvasRender();
                        return next;
                      })
                    }
                    className="px-2 py-0.5 rounded-md bg-[#E6F7EF] hover:bg-[#D1FAE5] text-[#047857] font-extrabold text-[10px] shrink-0 cursor-pointer"
                  >
                    Đã tới nơi
                  </button>
                </div>
              )}

              {/* Hàng 4 (Mở rộng khi bấm TT & SĐT): Địa chỉ, giờ mở cửa, mô tả & Nút gọi điện trực tiếp */}
              {activeRoute.isInfoExpanded && (
                <div className="pt-1.5 border-t border-[#E2E8F0] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#475569] font-medium truncate">
                      Đ/c: <strong className="text-[#0F172A]">{activeRoute.targetPlace.address}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#0F172A] font-bold text-[10px] shrink-0">
                      {openStatus.badgeText}
                    </span>
                  </div>
                  {activeRoute.targetPlace.metadata?.subType && (
                    <div className="text-[10.5px] text-[#475569]">
                      {activeRoute.targetPlace.metadata.subType}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <a
                      href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-[11px] text-center shadow-xs"
                    >
                      Gọi SĐT: {contactPhone}
                    </a>
                    <button
                      type="button"
                      onClick={() => setSelectedPlace(activeRoute.targetPlace)}
                      className="py-1.5 px-2.5 rounded-xl bg-[#F1ECE1] hover:bg-[#E5DEC9] text-[#403064] font-bold text-[10.5px] cursor-pointer"
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {isPickingOnMap && (
          <div className="pointer-events-auto self-start px-3.5 py-2 rounded-2xl bg-[#FFFDF9] text-[#1E293B] border-2 border-[#39B980] shadow-lg text-xs leading-snug font-bold flex items-center gap-2">
            <span>
              Chạm vào đúng vị trí của "{adminEditName || adminTargetPlace?.name || 'Địa điểm mới'}" trên bản đồ...
            </span>
            <button
              type="button"
              onClick={() => {
                setIsPickingOnMap(false);
                setIsAdminCoordModalOpen(true);
              }}
              className="ml-1 px-2 py-0.5 rounded bg-[#F1ECE1] text-[#403064] text-[11px] cursor-pointer shrink-0"
            >
              Hủy
            </button>
          </div>
        )}

        {isOffline && (
          <div className="pointer-events-auto self-start px-3 py-1.5 rounded-2xl bg-[#FEF2F2] border-2 border-[#EF4444] text-[#991B1B] text-xs leading-snug font-bold flex items-center gap-2 shadow-sm">
            <span>Đang ngoại tuyến — Bản đồ vẫn hiển thị dữ liệu Xuân Hòa đã lưu.</span>
          </div>
        )}

        {locationNotice && (
          <div className="pointer-events-auto self-start px-3 py-1.5 rounded-2xl bg-[#FFFDF9]/95 border-2 border-[#39B980] text-[#1E293B] text-xs leading-snug font-bold flex items-center gap-2 shadow-md">
            <span>{locationNotice}</span>
            <button
              type="button"
              onClick={() => setLocationNotice(null)}
              className="text-[#65587F] hover:text-[#2D2246] cursor-pointer shrink-0"
            >
              ×
            </button>
          </div>
        )}

        <GameAssetLayer
          isEnabled={layerVisibility.gameAssets}
          assets={DEMO_GAME_ASSETS}
          selectedAsset={selectedGameAsset}
          onSelectAsset={setSelectedGameAsset}
          onToggleEnable={() =>
            setLayerVisibility((prev) => ({ ...prev, gameAssets: !prev.gameAssets }))
          }
        />
      </div>

      {/* 3-BOTTOM. THANH ĐIỀU KHIỂN ADMIN / CHỦ QUÁN GỌN GÀNG Ở ĐÁY BẢN ĐỒ */}
      {!merchantPickingForPlace && (hasClaimedPlaces || isMapManagerUser || isAdminUser) && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-1.5 pointer-events-auto max-w-[calc(100vw-20px)]">
          {hasClaimedPlaces && primaryMerchantPlace && !isMapManagerUser && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 border border-[#39B980] shadow-md text-[11px] whitespace-nowrap">
              <span className="font-extrabold text-[#1D7A52] truncate max-w-[110px] sm:max-w-[180px]">
                {primaryMerchantPlace.place.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('pin');
                  setMerchantPickingForPlace({
                    placeId: primaryMerchantPlace.place.id,
                    placeName: primaryMerchantPlace.place.name,
                  });
                }}
                className="px-2 py-0.5 rounded-full bg-[#39B980] hover:bg-[#2FA36E] text-white font-extrabold text-[10.5px] cursor-pointer"
              >
                Vị trí
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  setMerchantPortalTab('merchant');
                  setIsMerchantPortalOpen(true);
                }}
                className="px-2 py-0.5 rounded-full bg-[#403064] hover:bg-[#2D2246] text-white font-extrabold text-[10.5px] cursor-pointer"
              >
                Thực đơn
              </button>
            </div>
          )}

          {isMapManagerUser && !isAdminUser && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 border border-[#39B980] shadow-md text-[11px] whitespace-nowrap">
              <span className="font-extrabold text-[#047857]">Quản lý Maps</span>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  setMerchantPortalTab('create_new');
                  setIsMerchantPortalOpen(true);
                }}
                className="px-2 py-0.5 rounded-full bg-[#10B981] hover:bg-[#059669] text-white font-extrabold text-[10.5px] cursor-pointer"
              >
                Thêm mới
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  setMerchantPortalTab('merchant');
                  setIsMerchantPortalOpen(true);
                }}
                className="px-2 py-0.5 rounded-full bg-[#403064] hover:bg-[#2D2246] text-white font-extrabold text-[10.5px] cursor-pointer"
              >
                Định vị quán
              </button>
            </div>
          )}

          {isAdminUser && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/96 border border-amber-300 text-[#78350F] shadow-[0_6px_20px_rgba(15,23,42,0.14)] backdrop-blur-md text-[11px] whitespace-nowrap">
              <span className="font-extrabold text-[#B45309] pl-1">Admin</span>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  openAdminCreatePlaceModal();
                }}
                className="px-2.5 py-1 rounded-full bg-[#059669] hover:bg-[#047857] text-white font-extrabold cursor-pointer transition"
                title="Thêm mới trụ sở, địa danh hoặc hàng quán trực tiếp lên bản đồ"
              >
                Thêm mới
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  openAdminCoordinateModal(selectedPlace || undefined);
                }}
                className="px-2.5 py-1 rounded-full bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F59E0B] font-extrabold cursor-pointer transition"
                title="Chỉnh sửa tên, chức năng, địa chỉ, tọa độ hoặc ẩn địa danh / quán"
              >
                Sửa địa điểm
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  setMerchantPortalTab('admin_approvals');
                  setIsMerchantPortalOpen(true);
                }}
                className="px-2.5 py-1 rounded-full bg-[#F3EFE6] hover:bg-[#E5DEC9] text-[#403064] border border-[#D8CFC0] font-extrabold flex items-center gap-1 cursor-pointer transition"
                title="Mở bảng quản trị duyệt quán & tạo mã chủ quán"
              >
                <span>Quản trị</span>
                {pendingApprovalCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#E11D48] text-white text-[10px] font-black">
                    {pendingApprovalCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('approve');
                  const nextMode =
                    mapAccessStatus.mode === 'public_open'
                      ? 'merchants_and_admin_only'
                      : 'public_open';
                  setMapAccessMode(nextMode);
                  setSyncTick((t) => t + 1);
                  setLocationNotice(
                    nextMode === 'public_open'
                      ? 'Đã chuyển Bản đồ số sang chế độ: Mở công khai.'
                      : 'Đã chuyển Bản đồ số sang chế độ: Đang phát triển (Dành cho Chủ quán).'
                  );
                }}
                className={`px-2 py-1 rounded-full font-extrabold cursor-pointer border transition ${
                  mapAccessStatus.mode === 'public_open'
                    ? 'bg-[#E6F7EF] text-[#047857] border-[#39B980]'
                    : 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
                }`}
                title="Chuyển đổi quyền truy cập Bản đồ số"
              >
                {mapAccessStatus.mode === 'public_open' ? 'Công khai' : 'Nội bộ'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3A-PIN. TÂM NGẮM GHIM QUÁN 3D GIỮA MÀN HÌNH + THANH CHỐT VỊ TRÍ CHUẨN GRAB / GOOGLE MAPS */}
      {merchantPickingForPlace && (
        <>
          {/* Tâm ngắm ghim mặt tiền quán ngay chính giữa bản đồ */}
          <div className="absolute inset-0 pointer-events-none z-25 flex items-center justify-center">
            <div className="relative flex flex-col items-center -translate-y-5">
              {/* Nhãn tọa độ chạy trực tiếp theo thời gian thực */}
              <div className="mb-1.5 px-3 py-1 rounded-2xl bg-[#FFFDF9] text-[#1E293B] border-2 border-[#39B980] shadow-xl text-[11px] font-extrabold whitespace-nowrap flex items-center gap-1.5">
                <span>🏪 {merchantPickingForPlace.placeName}</span>
                <span
                  ref={liveCoordTopBadgeRef}
                  className="px-1.5 py-0.5 rounded-md bg-[#39B980] text-white font-mono text-[10px]"
                >
                  {livePickCoords.lat.toFixed(5)}, {livePickCoords.lng.toFixed(5)}
                </span>
              </div>

              {/* Cột ghim nhún lên khi kéo bản đồ và hạ xuống khi dừng */}
              <div
                ref={pinColumnRef}
                className="transition-transform duration-150 flex flex-col items-center"
                style={{
                  transform: isPinLifted ? 'translateY(-10px) scale(1.12)' : 'translateY(0px) scale(1)',
                }}
              >
                <div className="w-11 h-11 rounded-2xl bg-[#39B980] border-3 border-[#403064] shadow-[0_8px_20px_rgba(64,48,100,0.35)] flex items-center justify-center text-xl">
                  🏪
                </div>
                <div className="w-1 h-3.5 bg-[#403064] rounded-b-full" />
              </div>

              {/* Vòng tâm ngắm dưới mặt đất */}
              <div className="relative flex items-center justify-center -mt-0.5">
                <span className="absolute w-7 h-7 rounded-full bg-[#39B980]/35 animate-ping" />
                <span className="w-3 h-3 rounded-full bg-[#403064] border-2 border-[#39B980] shadow-sm" />
              </div>
            </div>
          </div>

          {/* Thanh Chốt Vị Trí Mặt Tiền nổi bật ở đáy màn hình */}
          <div className="absolute left-3 right-3 bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-40 pointer-events-auto">
            <div className="p-3 sm:p-3.5 rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-[0_14px_34px_rgba(45,34,70,0.28)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-[#1D7A52] flex items-center gap-1">
                    <Crosshair size={13} />
                    <span>TÂM GHIM MẶT TIỀN QUÁN</span>
                  </div>
                  <div className="text-xs font-extrabold text-[#2D2246] truncate">
                    {merchantPickingForPlace.placeName}
                  </div>
                </div>
                <div
                  ref={liveCoordBottomBadgeRef}
                  className="px-2.5 py-1 rounded-xl bg-[#F3EFE6] border border-[#D8CFC0] font-mono text-[11px] font-black text-[#403064] shrink-0"
                >
                  {livePickCoords.lat.toFixed(5)}, {livePickCoords.lng.toFixed(5)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('tap');
                    setMerchantPickingForPlace(null);
                    setIsMerchantPortalOpen(true);
                  }}
                  className="px-3.5 py-2.5 rounded-2xl bg-[#F1ECE1] hover:bg-[#E5DEC9] active:scale-95 transition-transform text-[#403064] font-extrabold text-xs whitespace-nowrap cursor-pointer"
                >
                  Quay lại
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('approve');
                    const center = mapInstanceRef.current?.getCenter();
                    const finalLat = center ? Number(center.lat.toFixed(6)) : livePickCoords.lat;
                    const finalLng = center ? Number(center.lng.toFixed(6)) : livePickCoords.lng;
                    const isCreatingNew = merchantPickingForPlace.placeId === '__new_place__';

                    if (!isCreatingNew) {
                      try {
                        updatePlaceCoordinates(merchantPickingForPlace.placeId, {
                          lat: finalLat,
                          lng: finalLng,
                          coordinateVerified: true,
                          coordinateSource: 'admin_verified',
                          placeName: merchantPickingForPlace.placeName,
                        });
                      } catch {
                        // Ignore if outside bounds
                      }
                    }

                    setSyncTick((t) => t + 1);
                    setMerchantPickedCoords({
                      placeId: merchantPickingForPlace.placeId,
                      lat: finalLat,
                      lng: finalLng,
                    });
                    setMerchantPickingForPlace(null);
                    setMerchantPortalTab(isCreatingNew ? 'create_new' : 'merchant');
                    setIsMerchantPortalOpen(true);
                    setLocationNotice(
                      isCreatingNew
                        ? `🎯 Đã lấy tọa độ (${finalLat}, ${finalLng}) cho "${merchantPickingForPlace.placeName}". Hãy bấm Lưu để ghim lên bản đồ!`
                        : `✅ ĐÃ LƯU VỊ TRÍ THÀNH CÔNG: "${merchantPickingForPlace.placeName}" (${finalLat}, ${finalLng}) đã hiển thị trên Bản đồ!`
                    );
                  }}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-[#39B980] hover:bg-[#2FA36E] active:scale-95 transition-transform text-white border-2 border-[#403064] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md whitespace-nowrap cursor-pointer"
                >
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>
                    {merchantPickingForPlace.placeId === '__new_place__'
                      ? 'Chốt Tọa Độ Cho Địa Điểm Mới'
                      : 'Chốt & Lưu Vị Trí Này'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 4. POPUP THÔNG TIN ĐỊA ĐIỂM HOẶC DANH SÁCH CỤM GẦN NHAU Ở ĐÁY BẢN ĐỒ */}
      <div className="absolute left-2.5 right-12 sm:left-3 sm:right-14 bottom-12 md:bottom-12 z-30 pointer-events-none flex flex-col items-start gap-2">
        {clusterSelectionList && clusterSelectionList.length > 1 && (
          <div className="pointer-events-auto w-full max-w-sm rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-xl p-3.5 text-xs text-[#2D2246]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E5DEC9]">
              <span className="font-extrabold text-[#403064]">
                Có {clusterSelectionList.length} địa điểm tại vị trí này
              </span>
              <button
                type="button"
                onClick={() => setClusterSelectionList(null)}
                className="p-1 rounded-lg bg-[#F1ECE1] text-[#403064] cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {clusterSelectionList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setClusterSelectionList(null);
                    setSelectedPlace(item);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#E6F7EF] border border-[#E5DEC9] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="font-bold truncate">{item.name}</span>
                  <span className="text-[10px] font-bold text-[#1D7A52] shrink-0">
                    Chi tiết →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPlace && (
          <div className="pointer-events-auto w-full">
            <MapPlacePopup
              place={selectedPlace}
              onClose={() => setSelectedPlace(null)}
              onOpenFullPlaceModal={(loc) => {
                if (loc.originalPlace) {
                  setModalPlace(loc.originalPlace);
                }
              }}
              isAdminUser={isAdminUser}
              onEditCoordinates={(loc) => openAdminCoordinateModal(loc)}
              userCoords={userCoords}
              activeRouteDistanceMeters={activeRoute?.totalDistanceMeters ?? null}
              onDrawRouteToPlace={handleDrawRouteToPlace}
              onClearRoute={() => {
                setActiveRoute(null);
                activeRouteRef.current = null;
                scheduleCanvasRender();
              }}
              isRouteActiveForThisPlace={activeRoute?.targetPlace.id === selectedPlace.id}
              onOpenMerchantPortal={() => handleOpenMerchantPortal('merchant')}
              isSaved={savedPlaceIds.includes(selectedPlace.id)}
              onToggleSave={handleToggleSavePlace}
            />
          </div>
        )}
      </div>

      {/* 5. THÔNG BÁO GỌN GÀNG KHI ĐANG VÀO BẢN ĐỒ SỐ PHƯỜNG XUÂN HÒA */}
      {(isMapLoading || showWelcomeBanner) && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1E1633]/94 text-white border border-[#39B980]/60 shadow-[0_10px_28px_rgba(15,23,42,0.22)] backdrop-blur-md text-[11.5px] font-extrabold whitespace-nowrap">
            {isMapLoading ? (
              <Loader2 size={14} className="animate-spin text-[#39B980] shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-[#39B980] shrink-0" />
            )}
            <span>Đang vào Bản đồ số Phường Xuân Hòa</span>
            <button
              type="button"
              onClick={() => setShowWelcomeBanner(false)}
              className="ml-1 text-white/70 hover:text-white text-xs font-bold cursor-pointer"
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {mapLoadError && (
        <div className="absolute inset-0 z-40 bg-[#F8F5EE]/95 flex flex-col items-center justify-center p-4 text-center">
          <div className="p-6 rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-xl max-w-md">
            <AlertTriangle size={32} className="mx-auto text-[#F59E0B]" />
            <h2 className="mt-3 text-base font-extrabold text-[#2D2246]">
              Không thể tải đầy đủ lớp bản đồ
            </h2>
            <p className="mt-1.5 text-xs text-[#65587F] leading-relaxed">
              {mapLoadError}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={initMap}
                className="px-4 py-2 rounded-2xl bg-[#39B980] text-white border-2 border-[#403064] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Thử tải lại</span>
              </button>
              <button
                type="button"
                onClick={onBackToHome}
                className="px-4 py-2 rounded-2xl bg-[#F1ECE1] text-[#403064] text-xs font-bold cursor-pointer"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5B. GIAO DIỆN ĐANG PHÁT TRIỂN & CỔNG XÁC THỰC MÃ CHỦ QUÁN — GỌN GÀNG, CHUYÊN NGHIỆP */}
      {(!mapAccessStatus.canAccess || previewGuestLock) && (
        <div className="absolute inset-0 z-40 bg-[#F8F5EE]/70 backdrop-blur-[3px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-[380px] rounded-3xl bg-[#FFFDF9] border border-[#CBD5E1] shadow-[0_20px_50px_rgba(15,23,42,0.12)] p-5 sm:p-6 text-[#1E293B] my-auto space-y-4">
            {/* Header gọn gàng */}
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F7EF] border border-[#39B980]/40 text-[#047857] text-[11px] font-extrabold tracking-wide">
                <Sparkles size={12} />
                <span>BẢN ĐỒ SỐ • ĐANG PHÁT TRIỂN</span>
              </div>

              <h2 className="text-lg font-extrabold text-[#0F172A] tracking-tight">
                Đang đồng bộ vị trí các quán
              </h2>
              <p className="text-xs text-[#475569] leading-relaxed">
                Tính năng Bản đồ số đang trong giai đoạn cập nhật dữ liệu thực tế. Nếu bạn là{' '}
                <strong className="text-[#0F172A]">Chủ quán</strong>, vui lòng nhập mã định danh được cấp để kết nối vị trí và thông tin quán.
              </p>
            </div>

            {/* Khung nhập mã Chủ quán */}
            <form onSubmit={handleActivateCodeAtGate} className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-[#334155]">
                    Mã định danh quán
                  </label>
                  {authUser?.isLoggedIn && authUser?.email ? (
                    <span className="text-[11px] text-[#047857] font-semibold truncate max-w-[160px]">
                      {authUser.email}
                    </span>
                  ) : (
                    onOpenLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerFeedback('tap');
                          onOpenLogin();
                        }}
                        className="text-[11px] font-bold text-[#047857] hover:underline cursor-pointer"
                      >
                        Liên kết tài khoản
                      </button>
                    )
                  )}
                </div>

                <div className="relative">
                  <KeyRound
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Nhập mã quán (VD: XH-BUNB-8899)"
                    value={gateCodeInput}
                    onChange={(e) => {
                      setGateCodeInput(e.target.value.toUpperCase());
                      if (gateError) setGateError(null);
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] font-mono text-xs sm:text-sm font-bold tracking-wider uppercase text-[#0F172A] focus:outline-none focus:border-[#39B980] focus:ring-2 focus:ring-[#39B980]/20 transition-all"
                  />
                </div>
              </div>

              {gateError && (
                <div className="p-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-medium">
                  {gateError}
                </div>
              )}

              {gateSuccess && (
                <div className="p-2.5 rounded-xl bg-[#E6F7EF] border border-[#A7F3D0] text-[#047857] text-xs font-medium">
                  {gateSuccess}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] active:scale-[0.99] transition-all text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Store size={15} />
                <span>Xác nhận & Kết nối vị trí</span>
              </button>
            </form>

            {/* Khám phá nhanh Sa Bàn 3D (mở tự do cho mọi người trải nghiệm) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('tap');
                  setIsCity3DOpen(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#E6F7EF] to-[#D1FAE5] hover:from-[#D1FAE5] hover:to-[#A7F3D0] text-[#047857] border border-[#39B980]/50 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs hover:scale-[1.01]"
              >
                <span className="text-base">🏢</span>
                <span>Khám phá Sa Bàn 3D Toàn Phường</span>
              </button>
            </div>

            {/* Nút điều hướng phụ */}
            <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-center gap-2">
              {isAdminUser && previewGuestLock ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('tap');
                    setPreviewGuestLock(false);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>Đóng chế độ xem trước</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('tap');
                    onBackToHome();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Quay lại Trang chủ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. DRAWER / BOTTOM SHEET DANH MỤC ẨN */}
      <MapCategoryPanel
        isOpen={isCategoryDrawerOpen}
        onClose={() => setIsCategoryDrawerOpen(false)}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
        onResetCategories={() => setSelectedCategories(['all'])}
        verifiedPlaces={verifiedMapMarkers}
        unverifiedPlaces={unverifiedCatalogPlaces}
        gameAssets={DEMO_GAME_ASSETS}
        onSelectVerifiedPlace={handleSelectVerifiedPlace}
        onSelectUnverifiedPlace={handleSelectUnverifiedPlace}
        isAdminUser={isAdminUser}
        onOpenAdminCoordTool={openAdminCoordinateModal}
      />

      {/* 7. MODAL BÁO CÁO CHẤT LƯỢNG DỮ LIỆU ĐỊA LÝ TRUNG THỰC */}
      {isDataQualityOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#2D2246]/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsDataQualityOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-2xl p-5 text-[#2D2246]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E5DEC9]">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#E6F7EF] text-[#1D7A52] text-[10px] font-extrabold">
                  <ShieldCheck size={12} /> BÁO CÁO MINH BẠCH DỮ LIỆU ĐỊA LÝ
                </span>
                <h2 className="text-base font-extrabold text-[#2D2246] mt-1">
                  {dataQualityReport.scopeName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDataQualityOpen(false)}
                className="p-1.5 rounded-xl bg-[#F1ECE1] text-[#403064] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9]">
                <p className="font-extrabold text-[#403064] mb-1">
                  Phạm vi hành chính hợp nhất (OSM Relation #{dataQualityReport.osmRelationId}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dataQualityReport.mergedUnits.map((u) => (
                    <span
                      key={u}
                      className="px-2.5 py-1 rounded-xl bg-[#FFFDF9] border border-[#D8CFC0] font-semibold"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-2xl bg-[#E6F7EF]/60 border border-[#39B980]/30">
                  <div className="text-[10px] text-[#1D7A52] font-bold">Đường & Ngõ OSM</div>
                  <div className="text-sm font-extrabold text-[#2D2246]">
                    {dataQualityReport.stats.osmRoadsCount.toLocaleString('vi-VN')} đoạn
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#E6F7EF]/60 border border-[#39B980]/30">
                  <div className="text-[10px] text-[#1D7A52] font-bold">Khối nhà thực tế</div>
                  <div className="text-sm font-extrabold text-[#2D2246]">
                    {dataQualityReport.stats.osmBuildingsCount.toLocaleString('vi-VN')} khối
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#E6F7EF]/60 border border-[#39B980]/30">
                  <div className="text-[10px] text-[#1D7A52] font-bold">Mặt hồ & Sông suối</div>
                  <div className="text-sm font-extrabold text-[#2D2246]">
                    {dataQualityReport.stats.osmWaterPolygonsCount} hồ / {dataQualityReport.stats.osmWaterwaysCount} suối
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9]">
                  <div className="text-[10px] text-[#65587F] font-bold">Ghim trên bản đồ</div>
                  <div className="text-sm font-extrabold text-[#1D7A52]">
                    {dataQualityReport.stats.osmVerifiedPoisCount} địa điểm
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-[#FEF3C7]/60 border border-[#F59E0B]/30 col-span-2">
                  <div className="text-[10px] text-[#92400E] font-bold">
                    Quán trong danh mục chờ xác minh tọa độ
                  </div>
                  <div className="text-sm font-extrabold text-[#92400E]">
                    {dataQualityReport.stats.catalogPendingVerificationCount} / {dataQualityReport.stats.catalogTotalPlaces} quán
                  </div>
                </div>
              </div>

              <div>
                <p className="font-extrabold text-[#403064] mb-1.5">
                  Nguồn dữ liệu & Điều khoản cấp phép:
                </p>
                <div className="space-y-1.5">
                  {dataQualityReport.sources.map((src, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-[#F8F5EE] border border-[#E5DEC9]"
                    >
                      <div className="font-bold text-[#2D2246]">
                        {src.name} · <span className="text-[#1D7A52]">{src.license}</span>
                      </div>
                      <p className="text-[11px] text-[#65587F] mt-0.5">{src.usageNote}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL QUẢN TRỊ ĐỊA DANH, TRỤ SỞ, HÀNG QUÁN & TỌA ĐỘ DÀNH RIÊNG CHO ADMIN */}
      {isAdminCoordModalOpen && isAdminUser && (
        <div
          className="fixed inset-0 z-50 bg-[#2D2246]/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsAdminCoordModalOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-2xl p-4 sm:p-5 text-[#2D2246]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E5DEC9]">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] text-[10px] font-extrabold">
                  QUẢN TRỊ BẢN ĐỒ SỐ PHƯỜNG XUÂN HÒA
                </span>
                <h2 className="text-base font-extrabold text-[#2D2246] mt-1">
                  {isAdminCreatingNew
                    ? 'Thêm địa danh, trụ sở hoặc hàng quán mới'
                    : 'Chỉnh sửa địa danh, trụ sở & tọa độ'}
                </h2>
                <p className="text-[11px] text-[#65587F] mt-0.5">
                  Đổi tên địa danh theo đơn vị hành chính mới, cập nhật chức năng, địa chỉ, tọa độ hoặc ẩn khỏi Bản đồ 2D & 3D.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminCoordModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#F1ECE1] text-[#403064] cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Chuyển nhanh giữa Sửa địa điểm có sẵn & Thêm mới */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdminCreatingNew(false);
                  const fallback = selectedPlace || verifiedMapMarkers[0] || unverifiedCatalogPlaces[0] || null;
                  populateAdminFormFromPlace(fallback);
                  setAdminFeedback(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs border transition cursor-pointer ${
                  !isAdminCreatingNew
                    ? 'bg-[#403064] text-white border-[#403064]'
                    : 'bg-[#F8F5EE] text-[#403064] border-[#D8CFC0] hover:bg-[#F1ECE1]'
                }`}
              >
                Sửa địa danh / quán hiện có
              </button>
              <button
                type="button"
                onClick={() => openAdminCreatePlaceModal()}
                className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs border transition cursor-pointer ${
                  isAdminCreatingNew
                    ? 'bg-[#059669] text-white border-[#047857]'
                    : 'bg-[#E6F7EF] text-[#047857] border-[#39B980] hover:bg-[#D1FAE5]'
                }`}
              >
                Thêm địa điểm mới
              </button>
            </div>

            <form onSubmit={handleSaveAdminCoordinates} className="mt-3 space-y-3 text-xs">
              {!isAdminCreatingNew && (
                <div>
                  <label className="block font-bold text-[#403064] mb-1">
                    Chọn địa danh / trụ sở / hàng quán cần chỉnh sửa:
                  </label>
                  <select
                    value={adminTargetPlace?.id || ''}
                    onChange={(e) => {
                      const allCatalog = [...verifiedMapMarkers, ...unverifiedCatalogPlaces];
                      const found = allCatalog.find((p) => p.id === e.target.value) || null;
                      populateAdminFormFromPlace(found);
                      setNominatimSuggestions([]);
                      setAdminFeedback(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] font-bold text-[#2D2246]"
                  >
                    <optgroup label={`Đang hiển thị trên Bản đồ (${verifiedMapMarkers.length})`}>
                      {verifiedMapMarkers.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.dataSource === 'openstreetmap' ? 'Địa danh / Cơ quan' : 'Hàng quán'}] {p.name} ({p.lat}, {p.lng})
                        </option>
                      ))}
                    </optgroup>
                    {unverifiedCatalogPlaces.length > 0 && (
                      <optgroup label={`Chờ xác minh tọa độ (${unverifiedCatalogPlaces.length})`}>
                        {unverifiedCatalogPlaces.map((p) => (
                          <option key={p.id} value={p.id}>
                            [Chờ xác minh] {p.name} — {p.address}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* Tên địa danh / trụ sở mới & Danh mục */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#403064] mb-1">
                    Tên địa danh / trụ sở / cơ quan / quán *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminEditName}
                    onChange={(e) => setAdminEditName(e.target.value)}
                    placeholder="VD: Trụ sở Công an Phường Xuân Hòa / Nhà văn hóa..."
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] font-extrabold text-[#2D2246] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#403064] mb-1">Phân loại danh mục</label>
                  <select
                    value={adminEditCategory}
                    onChange={(e) =>
                      setAdminEditCategory(
                        e.target.value as Exclude<MapCategoryKey, 'all' | 'game_asset'>
                      )
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] font-bold text-[#2D2246] text-xs"
                  >
                    <option value="public">Cơ quan / Trụ sở / Công cộng</option>
                    <option value="school">Trường học / Giáo dục</option>
                    <option value="food">Quán ăn / Nhà hàng</option>
                    <option value="cafe">Quán Cafe / Trà sữa</option>
                    <option value="snack">Ăn vặt</option>
                    <option value="pub">Nhậu / Bia</option>
                    <option value="billiards">Bi-a / Giải trí</option>
                    <option value="game">Game / Net</option>
                    <option value="phone">Điện thoại / Dịch vụ</option>
                  </select>
                </div>
              </div>

              {/* Địa chỉ & Mô tả chức năng mới */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#403064] mb-1">
                    Địa chỉ hiển thị (Số nhà, Ngõ, Đường, Khu vực)
                  </label>
                  <input
                    type="text"
                    value={adminEditAddress}
                    onChange={(e) => setAdminEditAddress(e.target.value)}
                    placeholder="VD: Đường Nguyễn Văn Linh, Phường Xuân Hòa"
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#403064] mb-1">
                    Mô tả chức năng / Ghi chú hiển thị trên thẻ
                  </label>
                  <input
                    type="text"
                    value={adminEditTagline}
                    onChange={(e) => setAdminEditTagline(e.target.value)}
                    placeholder="VD: Trụ sở làm việc mới / Điểm tiếp dân..."
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] text-xs"
                  />
                </div>
              </div>

              {/* Giờ mở cửa & SĐT */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-[#403064] mb-1">Giờ hoạt động</label>
                  <input
                    type="text"
                    value={adminEditHours}
                    onChange={(e) => setAdminEditHours(e.target.value)}
                    placeholder="VD: 07:30 - 17:00"
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#403064] mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={adminEditPhone}
                    onChange={(e) => setAdminEditPhone(e.target.value)}
                    placeholder="VD: 0987..."
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] text-xs"
                  />
                </div>
              </div>

              {/* Dán Link Google Maps / Plus Code + Chấm trực tiếp */}
              <div className="p-3 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-[#2D2246]">
                    Vị trí & Tọa độ trên Bản đồ 2D / 3D
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={handleSuggestFromOsm}
                      disabled={isGeocoding}
                      className="px-2.5 py-1.5 rounded-xl bg-[#E6F7EF] text-[#1D7A52] border border-[#39B980] font-bold flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      {isGeocoding && <Loader2 size={12} className="animate-spin" />}
                      <span>Trích xuất / Gợi ý tọa độ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminCoordModalOpen(false);
                        setIsPickingOnMap(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#403064] text-white font-bold cursor-pointer text-[11px]"
                    >
                      <span>Chấm trực tiếp trên Bản đồ</span>
                    </button>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={adminMapsUrlInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAdminMapsUrlInput(val);
                      const parsed = parseCoordinatesFromInputOrUrl(val);
                      if (parsed) {
                        setAdminLatInput(String(parsed.lat));
                        setAdminLngInput(String(parsed.lng));
                      }
                    }}
                    placeholder="Dán Link Google Maps, Plus Code (VD: 7PQ6+VFP) hoặc tọa độ 21.289, 105.711..."
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FFFDF9] border border-[#D8CFC0] text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-[#403064] mb-1">Vĩ độ (Latitude)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="VD: 21.281850"
                      value={adminLatInput}
                      onChange={(e) => setAdminLatInput(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FFFDF9] border border-[#403064] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#403064] mb-1">Kinh độ (Longitude)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="VD: 105.726210"
                      value={adminLngInput}
                      onChange={(e) => setAdminLngInput(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FFFDF9] border border-[#403064] font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {nominatimSuggestions.length > 0 && (
                <div className="p-2.5 rounded-2xl bg-[#E6F7EF]/60 border border-[#39B980]/40 space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[#1D7A52]">
                    Tọa độ đề xuất (Bấm chọn để điền):
                  </div>
                  {nominatimSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAdminLatInput(String(sug.lat));
                        setAdminLngInput(String(sug.lng));
                        setAdminCoordSource('nominatim_geocoded');
                        flyToCoordinates(sug.lat, sug.lng, 16.5);
                      }}
                      className="w-full text-left p-2 rounded-xl bg-[#FFFDF9] hover:bg-[#E6F7EF] border border-[#D8CFC0] text-[11px] cursor-pointer"
                    >
                      <div className="font-bold text-[#2D2246]">{sug.displayName}</div>
                      <div className="font-mono text-[10px] text-[#1D7A52]">
                        lat: {sug.lat}, lng: {sug.lng}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {adminFeedback && (
                <div className="p-2.5 rounded-xl bg-[#E6F7EF] text-[#1D7A52] font-bold text-[11px]">
                  {adminFeedback}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5DEC9]">
                {!isAdminCreatingNew && adminTargetPlace && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDeleteAdminPlace}
                      className="px-3 py-2 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] font-extrabold cursor-pointer text-[11px]"
                      title="Ẩn / xóa địa danh hoặc quán này khỏi Bản đồ 2D & 3D"
                    >
                      Ẩn / Xóa khỏi bản đồ
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreAdminPlaceDefault}
                      className="px-2.5 py-2 rounded-xl bg-[#F3EFE6] hover:bg-[#E5DEC9] text-[#403064] font-bold cursor-pointer text-[11px]"
                      title="Khôi phục tên và tọa độ gốc ban đầu"
                    >
                      Khôi phục gốc
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAdminCoordModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-[#F1ECE1] text-[#403064] font-bold cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white border-2 border-[#403064] font-extrabold cursor-pointer shadow-sm"
                  >
                    <span>{isAdminCreatingNew ? 'Tạo & Ghim lên Bản đồ' : 'Lưu cập nhật Địa điểm'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8B. CỔNG CHỦ QUÁN TỰ GHIM ĐỊNH VỊ BẢN ĐỒ & TRUNG TÂM ADMIN DUYỆT THAY ĐỔI */}
      <MerchantPortalModal
        isOpen={isMerchantPortalOpen}
        onClose={() => setIsMerchantPortalOpen(false)}
        authUser={authUser}
        onOpenLogin={onOpenLogin}
        isAdminUser={isAdminUser}
        initialTab={merchantPortalTab}
        initialClaimCode={urlClaimCode}
        pickedMapCoords={merchantPickedCoords}
        onStartPickOnMap={(placeId: string, placeName: string) => {
          setIsMerchantPortalOpen(false);
          setMerchantPickingForPlace({ placeId, placeName });
        }}
        onFlyToCoordinates={(lat: number, lng: number, zoom?: number, label?: string) => {
          flyToCoordinates(lat, lng, zoom || 16.6, label, 0.004);
        }}
        onDataChanged={() => setSyncTick((t) => t + 1)}
      />

      {/* 9. TÁI SỬ DỤNG PLACE MODAL HIỆN CÓ */}
      <PlaceModal
        place={modalPlace}
        isOpen={Boolean(modalPlace)}
        onClose={() => setModalPlace(null)}
        authUser={authUser}
        onOpenLogin={onOpenLogin}
      />

      {/* 9B. HỘP THOẠI ĐỊNH VỊ & QUẢN LÝ "CHỖ BẠN SINH SỐNG (NHÀ CỦA BẠN)" KHI BẤM BIỂU TƯỢNG NGÔI NHÀ */}
      {(homeModalMode === 'view' || homeModalMode === 'edit') && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setHomeModalMode('closed')}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#FFFDF9] border-2 border-[#403064] shadow-2xl overflow-hidden text-[#1E293B]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#FEF3C7]/85 border-b border-[#E5DEC9] flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-[#92400E] leading-snug">
                  {homeModalMode === 'view' && userHome
                    ? `🏠 ${userHome.label}`
                    : userHome
                    ? 'Thay đổi chỗ bạn sinh sống'
                    : 'Định vị chỗ bạn sinh sống'}
                </h3>
                <p className="text-[11px] font-semibold text-[#65587F] truncate">
                  Nick: {userAccountLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHomeModalMode('closed')}
                className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1ECE1] border border-[#E5DEC9] text-[#403064] text-xs font-extrabold cursor-pointer shrink-0"
              >
                Đóng
              </button>
            </div>

            {homeModalMode === 'view' && userHome ? (
              <div className="p-4 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F8F5EE] border border-[#E5DEC9] space-y-1">
                  <div className="text-[11px] font-bold text-[#65587F]">
                    Địa chỉ sinh sống hiện tại của bạn:
                  </div>
                  <div className="text-[13px] font-extrabold text-[#1E293B]">
                    {userHome.address}
                  </div>
                  <div className="text-[10.5px] font-semibold text-[#047857]">
                    Tọa độ ghim: {userHome.lat.toFixed(6)}, {userHome.lng.toFixed(6)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRouteToUserHome(userHome)}
                    className="col-span-3 py-2.5 px-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-xs shadow-xs cursor-pointer"
                  >
                    Chỉ đường về nhà bạn
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      flyToCoordinates(
                        userHome.lat,
                        userHome.lng,
                        17.1,
                        userHome.label,
                        0.0035
                      )
                    }
                    className="py-2 px-2.5 rounded-xl bg-[#F1ECE1] hover:bg-[#E5DEC9] text-[#403064] font-extrabold text-[11.5px] cursor-pointer"
                  >
                    Đứng tại nhà
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenHomeEditor(userHome)}
                    className="py-2 px-2.5 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F59E0B] font-extrabold text-[11.5px] cursor-pointer"
                  >
                    Thay đổi
                  </button>
                  <button
                    type="button"
                    onClick={handleClearUserHome}
                    className="py-2 px-2.5 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] font-extrabold text-[11.5px] cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const lat = parseFloat(homeLatInput);
                  const lng = parseFloat(homeLngInput);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    setHomeFeedback('Vui lòng chấm vị trí trên bản đồ hoặc nhập tọa độ hợp lệ.');
                    return;
                  }
                  handleSaveUserHome({
                    label: homeLabelInput.trim() || 'Nhà của bạn',
                    address: homeAddressInput.trim() || 'Phường Xuân Hòa',
                    lat,
                    lng,
                  });
                }}
                className="p-4 space-y-3 text-xs"
              >
                <div className="p-2.5 rounded-xl bg-[#FEF3C7]/60 border border-[#F59E0B]/60 text-[11px] font-semibold text-[#78350F] leading-snug">
                  Hãy định vị chỗ bạn đang sinh sống. Sau khi lưu, mỗi lần bấm biểu tượng ngôi nhà 🏠 bản đồ sẽ đứng đúng tại địa chỉ nhà bạn cho đến khi bạn thay đổi hoặc xóa.
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHomeModalMode('picking')}
                    className="py-2 px-2.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold text-[11px] shadow-xs cursor-pointer"
                  >
                    Chấm vị trí nhà trên bản đồ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (userCoords) {
                        setHomeLatInput(String(userCoords.lat));
                        setHomeLngInput(String(userCoords.lng));
                        flyToCoordinates(userCoords.lat, userCoords.lng, 16.8, 'Nhà của bạn');
                        setHomeFeedback(
                          `Đã lấy theo GPS hiện tại (${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)})!`
                        );
                      } else {
                        handleLocateUser(true);
                        setHomeFeedback('Đang lấy tín hiệu GPS hiện tại của bạn...');
                      }
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#E6F7EF] hover:bg-[#D1FAE5] text-[#047857] border border-[#10B981]/50 font-extrabold text-[11px] cursor-pointer"
                  >
                    Lấy theo GPS hiện tại
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">
                      Tên gọi chỗ ở
                    </label>
                    <input
                      type="text"
                      value={homeLabelInput}
                      onChange={(e) => setHomeLabelInput(e.target.value)}
                      placeholder="VD: Nhà của bạn, Phòng trọ..."
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">
                      Địa chỉ / Số nhà / Ngõ
                    </label>
                    <input
                      type="text"
                      value={homeAddressInput}
                      onChange={(e) => setHomeAddressInput(e.target.value)}
                      placeholder="VD: Ngõ 29 Nguyễn Văn Linh, Xuân Hòa"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#475569] mb-1">
                    Dán link Google Maps / Plus Code hoặc tìm đường
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={homeMapsInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHomeMapsInput(val);
                        const parsed = parseCoordinatesFromInputOrUrl(val);
                        if (parsed) {
                          setHomeLatInput(String(parsed.lat));
                          setHomeLngInput(String(parsed.lng));
                          flyToCoordinates(parsed.lat, parsed.lng, 16.8, homeLabelInput || 'Nhà của bạn');
                          setHomeFeedback(`Đã nhận tọa độ (${parsed.lat}, ${parsed.lng}) từ link Maps!`);
                        }
                      }}
                      placeholder="Dán link Google Maps hoặc nhập tên đường..."
                      className="flex-1 px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleSuggestHomeCoords}
                      disabled={isGeocoding}
                      className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-extrabold text-[11px] cursor-pointer shrink-0"
                    >
                      {isGeocoding ? 'Đang tìm...' : 'Tìm'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-bold text-[#64748B] mb-0.5">
                      Vĩ độ (Lat)
                    </label>
                    <input
                      type="text"
                      value={homeLatInput}
                      onChange={(e) => setHomeLatInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-[#64748B] mb-0.5">
                      Kinh độ (Lng)
                    </label>
                    <input
                      type="text"
                      value={homeLngInput}
                      onChange={(e) => setHomeLngInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                {homeFeedback && (
                  <div className="p-2 rounded-xl bg-[#E6F7EF] text-[#047857] text-[11px] font-bold">
                    {homeFeedback}
                  </div>
                )}

                <div className="pt-2 border-t border-[#E5DEC9] flex items-center justify-between gap-2">
                  {userHome ? (
                    <button
                      type="button"
                      onClick={handleClearUserHome}
                      className="px-3 py-2 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] font-extrabold text-[11px] cursor-pointer"
                    >
                      Xóa nhà đã lưu
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHomeModalMode(userHome ? 'view' : 'closed')}
                      className="px-3 py-2 rounded-xl bg-[#F1ECE1] text-[#403064] font-bold text-xs cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-xs shadow-xs cursor-pointer"
                    >
                      Lưu chỗ bạn sống
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 10. SA BÀN 3D TOÀN PHƯỜNG XUÂN HÒA (37.787 CÔNG TRÌNH, MÁI NGÓI, INSTANCED TREES, BÓNG NẮNG) */}
      {isCity3DOpen && (
        <City3DView
          initialCenter={
            mapInstanceRef.current
              ? {
                  lng: mapInstanceRef.current.getCenter().lng,
                  lat: mapInstanceRef.current.getCenter().lat,
                }
              : XUANHOA_DEFAULT_CENTER
          }
          places={verifiedMapMarkers}
          isAdminUser={isAdminUser}
          onDataChanged={() => setSyncTick((t) => t + 1)}
          onOpenWebAdmin={() => {
            window.location.hash = '#admin';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }}
          onClose={(centerFrom3D) => {
            setIsCity3DOpen(false);
            if (centerFrom3D && mapInstanceRef.current) {
              mapInstanceRef.current.jumpTo({
                center: [centerFrom3D.lng, centerFrom3D.lat],
              });
              scheduleCanvasRender();
            }
          }}
          onOpenPlace={(loc) => {
            if (loc.originalPlace) {
              setModalPlace(loc.originalPlace);
            }
          }}
          onShowPlaceIn2D={(loc) => {
            setIsCity3DOpen(false);
            handleSelectVerifiedPlace(loc);
          }}
          userCoords={userCoords}
          isLocatingUser={isLocatingUser}
          onLocateUser={() => handleLocateUser(false)}
          activeRoute={activeRoute}
          onDrawRouteToPlace={handleDrawRouteToPlace}
          onSwitchRouteMode={handleSwitchRouteMode}
          onClearRoute={() => {
            setActiveRoute(null);
            activeRouteRef.current = null;
            scheduleCanvasRender();
          }}
          onArriveRoute={() =>
            setActiveRoute((prev) => {
              if (!prev) return null;
              const lastIdx = Math.max(0, prev.pathLngLat.length - 1);
              const next = {
                ...prev,
                progressIndex: lastIdx,
                currentPos: prev.pathLngLat[lastIdx],
                remainingDistanceMeters: 0,
                hasArrived: true,
              };
              activeRouteRef.current = next;
              scheduleCanvasRender();
              return next;
            })
          }
          onToggleRouteInfo={() =>
            setActiveRoute((prev) =>
              prev ? { ...prev, isInfoExpanded: !prev.isInfoExpanded } : null
            )
          }
          savedPlaceIds={savedPlaceIds}
          userAccountLabel={userAccountLabel}
          onToggleSavePlace={handleToggleSavePlace}
          userHome={userHome}
          onSaveUserHome={handleSaveUserHome}
          onClearUserHome={handleClearUserHome}
          onRouteToHome={handleRouteToUserHome}
        />
      )}
    </div>
  );
};
