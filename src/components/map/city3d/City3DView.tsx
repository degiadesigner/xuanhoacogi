import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import {
  ArrowLeft,
  Building2,
  Check,
  Clock,
  Compass,
  Crosshair,
  ExternalLink,
  Home,
  KeyRound,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  ShieldCheck,
  Sun,
  SunDim,
  Trash2,
  X,
} from 'lucide-react';
import type { MapCategoryKey, PlaceLocation } from '@/lib/map/map-types';
import { MAP_CATEGORIES, MAP_CATEGORY_BY_ID } from '@/lib/map/map-categories';
import { XUANHOA_DEFAULT_CENTER } from '@/lib/map/map-config';
import {
  calculateDistanceAndEta,
  evaluatePlaceOpenStatus,
  findSuggestedRoadForAddress,
  geocodeAddressWithNominatim,
  blockLandmarkOrPlaceFromMap,
  hideLandmarkOrPlaceFromMap,
  parseCoordinatesFromInputOrUrl,
  restoreLandmarkOrPlaceDefault,
  saveLandmarkOrPlaceFromMap,
  VERIFIED_OSM_POIS,
  VERIFIED_OSM_ROADS_SEED,
  type DistanceAndEtaResult,
  type TravelMode,
  type UserHomeLocation,
} from '@/lib/map/map-data';
import {
  isAdminAuthenticated,
  isMapManagerAuthenticated,
  isPlaceHiddenOrDeletedInAdmin,
  logMapDebug,
  loginAdminWithCredentials,
  verifyAndClaimPlaceWithCode,
} from '@/lib/admin-store';
import { renderCategoryIcon } from '@/components/map/MapCategoryPanel';
import {
  CITY3D_COLORS,
  TREE_PALETTE,
  distance3DToZoom2D,
  getElevationAtLngLat,
  getElevationAtLocal,
  getLizardHillElevationAtLngLat,
  lngLatToLocal,
  loadXuanHoaDem,
  localToLngLat,
  zoom2DToDistance3D,
  type BuildingChunk,
  type BuildingLabel,
  type City3DOrigin,
  type MeshBuffers,
  type RoadLabel3D,
  type TreeChunk,
  type WorkerOutMessage,
} from './city3d-shared';
import {
  CONTEXTUAL_ZONE_LABELS,
  HEIGHT_SOURCE_LABELS,
  findMasterBuildingAtLngLat,
  getLoadedMasterDataset,
  loadXuanHoaMasterDataset,
  type MasterBuildingRecord,
} from '@/lib/map/xuanhoa-master-data';
import { reverseAreaName } from './city3d-live';
import { createIconicLandmarksGroup } from './city3d-landmarks';
import {
  SKY,
  createSkyDome,
  patchBuildingMaterial,
  patchCrownMaterial,
  patchFlatMaterial,
  type FlatKind,
} from './city3d-materials';

export interface ActiveRouteState3D {
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
}

export interface City3DViewProps {
  initialCenter: { lat: number; lng: number };
  initialZoom?: number;
  places: PlaceLocation[];
  onClose: (currentCenter?: { lat: number; lng: number }, currentZoom?: number) => void;
  /** Địa điểm đang được chọn đồng bộ từ 2D */
  initialSelectedPlace?: PlaceLocation | null;
  /** Công trình Master Building đang được chọn đồng bộ giữa 2D và 3D */
  selectedBuilding?: MasterBuildingRecord | null;
  onSelectBuilding?: (building: MasterBuildingRecord | null) => void;
  /** Mở trang chi tiết quán (PlaceModal) */
  onOpenPlace?: (place: PlaceLocation) => void;
  /** Quay về bản đồ 2D và chọn quán */
  onShowPlaceIn2D?: (place: PlaceLocation) => void;
  /** Trạng thái quyền Admin từ ngoài truyền vào */
  isAdminUser?: boolean;
  /** Trạng thái quyền Quản lý Maps từ ngoài truyền vào */
  isMapManagerUser?: boolean;
  /** Báo hiệu dữ liệu địa danh/quán đã thay đổi để 2D & Admin đồng bộ tức thì */
  onDataChanged?: () => void;
  /** Mở thẳng trang Web Admin (#admin) */
  onOpenWebAdmin?: (placeId?: string) => void;
  /** Đồng bộ định vị GPS & Dẫn đường giữa 2D và 3D */
  userCoords?: { lat: number; lng: number } | null;
  isLocatingUser?: boolean;
  onLocateUser?: () => void;
  activeRoute?: ActiveRouteState3D | null;
  onDrawRouteToPlace?: (place: PlaceLocation, mode?: TravelMode) => void;
  onSwitchRouteMode?: (mode: TravelMode) => void;
  onClearRoute?: () => void;
  onArriveRoute?: () => void;
  onToggleRouteInfo?: () => void;
  savedPlaceIds?: string[];
  userAccountLabel?: string;
  onToggleSavePlace?: (place: PlaceLocation) => void;
  userHome?: UserHomeLocation | null;
  onSaveUserHome?: (payload: {
    label: string;
    address: string;
    lat: number;
    lng: number;
  }) => void;
  onClearUserHome?: () => void;
  onRouteToHome?: (home: UserHomeLocation) => void;
}

interface Stats {
  buildings: number;
  trees: number;
  osmBuildings: number;
  openBuildings: number;
}

interface PrecomputedPin {
  place: PlaceLocation;
  lx: number;
  ly: number;
  lz: number;
  halfW: number;
}

interface PrecomputedBuildingLabel {
  label: BuildingLabel;
  index: number;
  halfW: number;
}

interface PrecomputedRoadLabel {
  road: RoadLabel3D;
  index: number;
  halfW: number;
  maxDist: number;
}

const FONT =
  "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const SUN_DIR = new THREE.Vector3(-0.68, 0.85, -0.32).normalize();
const MIN_DIST = 45;
const MAX_DIST = 9000;
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const EDITABLE_CATEGORIES = MAP_CATEGORIES.filter(
  (c) => c.id !== 'all' && c.id !== 'game_asset'
) as Array<{
  id: Exclude<MapCategoryKey, 'all' | 'game_asset'>;
  label: string;
  shortLabel: string;
  markerBg: string;
  iconName: string;
}>;

const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function geometryFrom(m: MeshBuffers, computeNormals = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3, true));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  if (computeNormals) {
    g.computeVertexNormals();
  } else {
    // Với các lớp phẳng nằm ngang (mặt đất, đường sá, mặt nước), pháp tuyến là (0, 1, 0)
    const n = new Int8Array(m.positions.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 127;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3, true));
  }
  g.computeBoundingSphere();
  return g;
}

export const City3DView: React.FC<City3DViewProps> = ({
  initialCenter,
  initialZoom,
  places,
  onClose,
  initialSelectedPlace = null,
  selectedBuilding: propSelectedBuilding = null,
  onSelectBuilding,
  onOpenPlace,
  onShowPlaceIn2D,
  isAdminUser: propIsAdmin,
  isMapManagerUser: propIsMapManager,
  onDataChanged,
  onOpenWebAdmin,
  userCoords = null,
  isLocatingUser = false,
  onLocateUser,
  activeRoute = null,
  onDrawRouteToPlace,
  onSwitchRouteMode,
  onClearRoute,
  onArriveRoute,
  onToggleRouteInfo,
  savedPlaceIds = [],
  userAccountLabel = 'Tài khoản của bạn',
  onToggleSavePlace,
  userHome = null,
  onSaveUserHome,
  onClearUserHome,
  onRouteToHome,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const compassIconRef = useRef<SVGSVGElement | null>(null);
  const pinElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const labelElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const roadLabelElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const draftMarkerElRef = useRef<HTMLDivElement | null>(null);
  const userMarker3DElRef = useRef<HTMLDivElement | null>(null);
  const homeMarker3DElRef = useRef<HTMLDivElement | null>(null);
  const routeGroupRef = useRef<THREE.Group | null>(null);
  const selectedBuildingGroupRef = useRef<THREE.Group | null>(null);
  const userCoords3DRef = useRef<{ lat: number; lng: number } | null>(userCoords);
  userCoords3DRef.current = userCoords;
  const userHome3DRef = useRef<UserHomeLocation | null>(userHome);
  userHome3DRef.current = userHome;
  const activeRoute3DRef = useRef<ActiveRouteState3D | null>(activeRoute);
  activeRoute3DRef.current = activeRoute;
  const [is3DLayerMenuOpen, setIs3DLayerMenuOpen] = useState(false);
  const [demReadyTick, setDemReadyTick] = useState(0);
  const [localSelectedBuilding, setLocalSelectedBuilding] = useState<MasterBuildingRecord | null>(
    propSelectedBuilding
  );
  useEffect(() => {
    setLocalSelectedBuilding(propSelectedBuilding);
  }, [propSelectedBuilding]);
  const handleSelectBuilding3D = useCallback(
    (b: MasterBuildingRecord | null) => {
      if (b && b.name && isPlaceHiddenOrDeletedInAdmin(b.id, b.name)) {
        const sanitized = { ...b, name: undefined };
        setLocalSelectedBuilding(sanitized);
        onSelectBuilding?.(sanitized);
        return;
      }
      setLocalSelectedBuilding(b);
      onSelectBuilding?.(b);
    },
    [onSelectBuilding]
  );

  // Nạp DEM thực & Master Dataset ở luồng chính để đồng bộ độ cao ghim, camera, dẫn đường và click chọn công trình
  useEffect(() => {
    let active = true;
    Promise.all([loadXuanHoaDem(), loadXuanHoaMasterDataset()]).then(() => {
      if (!active) return;
      setDemReadyTick((t) => t + 1);
      engineRef.current?.requestRender();
    });
    return () => {
      active = false;
    };
  }, []);

  // Trạng thái Hộp thoại "Chỗ bạn sinh sống (Nhà của bạn)" ngay trên Sa bàn 3D
  const [home3DModalMode, setHome3DModalMode] = useState<'closed' | 'view' | 'edit' | 'picking'>(
    'closed'
  );
  const [home3DLabelInput, setHome3DLabelInput] = useState('Nhà của bạn');
  const [home3DAddressInput, setHome3DAddressInput] = useState('');
  const [home3DMapsInput, setHome3DMapsInput] = useState('');
  const [home3DLatInput, setHome3DLatInput] = useState('');
  const [home3DLngInput, setHome3DLngInput] = useState('');
  const [home3DFeedback, setHome3DFeedback] = useState<string | null>(null);

  const [progress, setProgress] = useState<{ label: string; pct: number }>({
    label: 'Đang khởi động bộ dựng 3D…',
    pct: 2,
  });
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [originState, setOriginState] = useState<City3DOrigin | null>(null);
  const [labels, setLabels] = useState<BuildingLabel[]>([]);
  const [roadLabels, setRoadLabels] = useState<RoadLabel3D[]>([]);
  const [areaName, setAreaName] = useState<string>('Phường Xuân Hòa');
  const [shadowsOn, setShadowsOn] = useState<boolean>(false);
  // Tùy chỉnh hiện ghim định vị (tắt đi thì không hiện gì cả ngoài địa điểm đang chọn)
  const [showLocationPins, setShowLocationPins] = useState<boolean>(true);
  const [showCivic, setShowCivic] = useState<boolean>(true);
  // Mặc định auto bật tất cả các danh mục cho các địa điểm đã được Admin ghim chuẩn; cho phép bật/tắt độc lập từng danh mục
  const [selectedCategories3D, setSelectedCategories3D] = useState<MapCategoryKey[]>([
    'public',
    'school',
    'food',
    'pub',
    'cafe',
    'snack',
    'billiards',
    'game',
    'entertainment',
    'service',
    'grocery',
    'supermarket',
    'phone',
  ]);
  const [activeShopGroup, setActiveShopGroup] = useState<
    'none' | 'food' | 'pub' | 'cafe' | 'snack' | 'service'
  >('none');
  const [isSavedMenu3DOpen, setIsSavedMenu3DOpen] = useState(false);
  const [showRoadNames, setShowRoadNames] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveState, setLiveState] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  });
  const [selected, setSelected] = useState<PlaceLocation | null>(initialSelectedPlace);
  useEffect(() => {
    if (initialSelectedPlace) setSelected(initialSelectedPlace);
  }, [initialSelectedPlace]);

  // Quyền Admin & Quản lý Maps chỉnh sửa trực tiếp trên Sa Bàn 3D
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean>(() =>
    Boolean(propIsAdmin || propIsMapManager || isAdminAuthenticated() || isMapManagerAuthenticated())
  );
  const isStrictSuperAdmin = useMemo(
    () => Boolean(propIsAdmin || isAdminAuthenticated()),
    [propIsAdmin]
  );
  useEffect(() => {
    if (propIsAdmin || propIsMapManager) setHasAdminAccess(true);
  }, [propIsAdmin, propIsMapManager]);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);

  // Trạng thái khung Sửa / Thêm Địa danh ngay trên 3D
  const [isEditingPlace, setIsEditingPlace] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isPicking3DGround, setIsPicking3DGround] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] =
    useState<Exclude<MapCategoryKey, 'all' | 'game_asset'>>('public');
  const [editAddress, setEditAddress] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editMapsInput, setEditMapsInput] = useState('');
  const [editLat, setEditLat] = useState<string>('');
  const [editLng, setEditLng] = useState<string>('');
  const [editNotice, setEditNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoSuggestions, setGeoSuggestions] = useState<
    Array<{ displayName: string; lat: number; lng: number }>
  >([]);
  const [search3DQuery, setSearch3DQuery] = useState('');
  const [isSearch3DFocused, setIsSearch3DFocused] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Toàn bộ đối tượng three.js giữ trong ref (không gây render lại React)
  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: MapControls;
    sun: THREE.DirectionalLight;
    worker: Worker;
    origin: City3DOrigin | null;
    wardBox: [number, number, number, number] | null;
    requestRender: () => void;
    invalidateShadow: () => void;
    animateTo: (target: THREE.Vector3, offset: THREE.Vector3, ms?: number) => void;
    liveRequestId: number;
  } | null>(null);

  const isCivicLandmark = useCallback((p: PlaceLocation) => {
    return p.category === 'school' || p.category === 'public';
  }, []);

  const getShopGroupOfPlace = useCallback(
    (p: PlaceLocation): 'food' | 'pub' | 'cafe' | 'snack' | 'service' => {
      if (p.category === 'food') return 'food';
      if (p.category === 'pub') return 'pub';
      if (p.category === 'cafe') return 'cafe';
      if (p.category === 'snack') return 'snack';
      return 'service';
    },
    []
  );

  const shopGroupCounts = useMemo(() => {
    const counts = { food: 0, pub: 0, cafe: 0, snack: 0, service: 0 };
    for (const p of places) {
      if (p.lat === null || p.lng === null || isCivicLandmark(p)) continue;
      counts[getShopGroupOfPlace(p)] += 1;
    }
    return counts;
  }, [places, isCivicLandmark, getShopGroupOfPlace]);

  const savedPlaces3D = useMemo(
    () => places.filter((p) => p.lat !== null && p.lng !== null && savedPlaceIds.includes(p.id)),
    [places, savedPlaceIds]
  );

  const placesWithCoords = useMemo(() => {
    const filtered = places.filter((p) => {
      if (p.lat === null || p.lng === null) return false;
      if (p.visibilityStatus && p.visibilityStatus !== 'visible') return false;
      if (isPlaceHiddenOrDeletedInAdmin(p.id, p.name)) return false;
      if (selected?.id === p.id) return true;
      if (!showLocationPins) return false;
      if (savedPlaceIds.includes(p.id)) return true;
      if (selectedCategories3D.includes(p.category)) return true;
      if (activeShopGroup !== 'none' && getShopGroupOfPlace(p) === activeShopGroup) return true;
      return false;
    });
    logMapDebug('3D MARKER UPDATE', {
      inputPlaces: places.length,
      visiblePins3D: filtered.length,
    });
    return filtered;
  }, [
    places,
    showLocationPins,
    selectedCategories3D,
    savedPlaceIds,
    activeShopGroup,
    getShopGroupOfPlace,
    selected?.id,
  ]);

  // Tiền tính toán tọa độ local (lx, lz) và kích thước hộp chữ cho mọi ghim (tránh tính lại mỗi frame)
  const precomputedPins = useMemo<PrecomputedPin[]>(() => {
    if (!originState) return [];
    const list: PrecomputedPin[] = [];
    for (const p of placesWithCoords) {
      if (p.lat === null || p.lng === null) continue;
      const [x, y] = lngLatToLocal(originState, p.lng, p.lat);
      const terrainY = getElevationAtLngLat(p.lng, p.lat);
      const lizardHillY = getLizardHillElevationAtLngLat(p.lng, p.lat);
      const monumentBoost =
        p.id === 'osm_historic_bot_than_lan'
          ? 12.5
          : p.id === 'osm_landmark_nui_than_lan'
            ? 10.0
            : lizardHillY > 0.5
              ? 6.0
              : 0;
      list.push({
        place: p,
        lx: x,
        ly: 6 + terrainY + monumentBoost,
        lz: -y,
        halfW: Math.min(82, p.name.length * 3.1 + 16),
      });
    }
    // Ưu tiên ghim đang chọn lên đầu mảng để không bao giờ bị ẩn do va chạm nhãn
    if (selected) {
      list.sort((a, b) => (a.place.id === selected.id ? -1 : b.place.id === selected.id ? 1 : 0));
    }
    return list;
  }, [placesWithCoords, originState, selected, demReadyTick]);

  const precomputedBuildingLabels = useMemo<PrecomputedBuildingLabel[]>(
    () =>
      labels
        .filter((lb) => {
          // Ẩn nhãn tĩnh nếu địa điểm đã bị Admin xóa / ẩn / khóa (giữ nguyên khối nhà vật lý 3D)
          if (isPlaceHiddenOrDeletedInAdmin(undefined, lb.name)) return false;
          // Ẩn nhãn tĩnh nếu đã có ghim địa danh động (precomputedPins) ở gần hoặc trùng tên để khi Admin đổi tên / ẩn sẽ cập nhật 100% tức thì
          for (const pin of precomputedPins) {
            if (Math.hypot(pin.lx - lb.x, pin.lz - lb.z) < 75) return false;
            if (pin.place.name.toLowerCase() === lb.name.toLowerCase()) return false;
          }
          return true;
        })
        .map((lb, index) => ({
          label: lb,
          index,
          halfW: lb.name.length * 3.0 + 10,
        })),
    [labels, precomputedPins]
  );

  const precomputedRoadLabels = useMemo<PrecomputedRoadLabel[]>(
    () =>
      roadLabels.map((rl, index) => ({
        road: rl,
        index,
        halfW: rl.name.length * 3.2 + 12,
        maxDist:
          rl.tier === 'major'
            ? 2600
            : rl.tier === 'secondary'
            ? 1750
            : rl.tier === 'minor'
            ? 980
            : 780,
      })),
    [roadLabels]
  );

  const pinsRef = useRef<PrecomputedPin[]>(precomputedPins);
  pinsRef.current = precomputedPins;
  const bLabelsRef = useRef<PrecomputedBuildingLabel[]>(precomputedBuildingLabels);
  bLabelsRef.current = precomputedBuildingLabels;
  const rLabelsRef = useRef<PrecomputedRoadLabel[]>(precomputedRoadLabels);
  rLabelsRef.current = precomputedRoadLabels;

  const draftCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    if ((isEditingPlace || isCreatingNew) && Number.isFinite(lat) && Number.isFinite(lng)) {
      draftCoordRef.current = { lat, lng };
    } else {
      draftCoordRef.current = null;
    }
    engineRef.current?.requestRender();
  }, [isEditingPlace, isCreatingNew, editLat, editLng]);

  const showRoadNamesRef = useRef(showRoadNames);
  showRoadNamesRef.current = showRoadNames;
  const showLocationPinsRef = useRef(showLocationPins);
  showLocationPinsRef.current = showLocationPins;
  const showCivicRef = useRef(showCivic);
  showCivicRef.current = showCivic;
  const shadowsRef = useRef(shadowsOn);
  shadowsRef.current = shadowsOn;
  const isReadyRef = useRef(false);
  isReadyRef.current = isReady;
  const isPicking3DRef = useRef(isPicking3DGround);
  isPicking3DRef.current = isPicking3DGround;
  const isPickingHome3DRef = useRef(home3DModalMode === 'picking');
  isPickingHome3DRef.current = home3DModalMode === 'picking';

  useEffect(() => {
    engineRef.current?.requestRender();
  }, [showLocationPins, showCivic, showRoadNames, shadowsOn, userHome, precomputedPins]);

  // Khi danh sách places từ cha cập nhật, đồng bộ lại selected nếu đang mở
  useEffect(() => {
    if (!selected) return;
    const updated = places.find((p) => p.id === selected.id);
    if (updated) setSelected(updated);
  }, [places, selected?.id]);

  /* ================================================================ khởi tạo */
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const coarse = isCoarsePointer();

    THREE.ColorManagement.enabled = true;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !coarse || window.devicePixelRatio < 2,
        powerPreference: 'high-performance',
        stencil: false,
      });
    } catch {
      setError('Thiết bị không hỗ trợ WebGL — không thể mở Bản đồ 3D.');
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.45));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // Tối ưu GPU cực lớn: chỉ vẽ lại Shadow Map khi tâm nhìn thực sự dịch chuyển hoặc dữ liệu thay đổi
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const haze = new THREE.Color(SKY.horizon);
    scene.background = haze;
    scene.fog = new THREE.Fog(haze, 2000, 9000);
    const skyDome = createSkyDome(SUN_DIR);
    scene.add(skyDome);

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 2, 20000);
    camera.position.set(0, 600, 600);

    const controls = new MapControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = false;
    controls.minDistance = MIN_DIST;
    controls.maxDistance = MAX_DIST;
    controls.maxPolarAngle = 1.38;
    controls.minPolarAngle = 0.08;
    controls.zoomSpeed = 1.18;
    controls.rotateSpeed = 0.58;
    (controls as any).zoomToCursor = true;

    // Ánh sáng: trời xanh tán xạ + nắng ấm chiếu xiên + phản xạ đất
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x7d725c, 1.15));
    const sun = new THREE.DirectionalLight(0xffeccc, 3.6);
    sun.castShadow = false;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.4;
    sun.shadow.radius = 2.5;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 6000;
    scene.add(sun);
    scene.add(sun.target);

    const FLAT_KIND: Record<number, FlatKind> = {
      [-6]: 'ground',
      [-5]: 'landuse',
      [-4]: 'water',
      [-3]: 'roads',
      [-2]: 'markings',
    };
    const flatLayerMat = (order: number) => {
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      m.depthTest = false;
      m.depthWrite = false;
      patchFlatMaterial(m, FLAT_KIND[order] || 'ground', SUN_DIR);
      return { m, order };
    };
    const buildingMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false });
    patchBuildingMaterial(buildingMat, SUN_DIR);
    const skirtMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    patchFlatMaterial(skirtMat, 'markings', SUN_DIR);
    const crownMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    patchCrownMaterial(crownMat);
    const trunkMat = new THREE.MeshLambertMaterial({
      color: CITY3D_COLORS.trunk,
      flatShading: true,
    });

    const crownGeo = new THREE.IcosahedronGeometry(1, 0);
    {
      const p = crownGeo.attributes.position as THREE.BufferAttribute;
      const seen = new Map<string, number>();
      for (let i = 0; i < p.count; i++) {
        const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        let f = seen.get(k);
        if (f === undefined) {
          f = 0.86 + (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1 * 0.26;
          seen.set(k, f);
        }
        p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * (p.getY(i) < 0 ? 0.7 : 1), p.getZ(i) * f);
      }
    }
    crownGeo.scale(3.0, 2.6, 3.0);
    crownGeo.translate(0, 4.6, 0);
    const coniferGeo = new THREE.ConeGeometry(2.1, 6.6, 6);
    coniferGeo.translate(0, 5.2, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.8, 5);
    trunkGeo.translate(0, 1.4, 0);

    const buildingMeshes = new Map<string, THREE.Mesh>();
    const treeGroups = new Map<string, THREE.Group>();
    const disposables: { dispose: () => void }[] = [
      buildingMat,
      skirtMat,
      crownMat,
      trunkMat,
      crownGeo,
      coniferGeo,
      trunkGeo,
    ];
    const treeColors = TREE_PALETTE.map((c) => new THREE.Color(c));

    /* ------------------------------------------------------------ vòng lặp render siêu mượt (Zero-GC) */
    let rafPending = false;
    let disposed = false;
    let anim: {
      t0: number;
      ms: number;
      fromT: THREE.Vector3;
      toT: THREE.Vector3;
      fromO: THREE.Vector3;
      toO: THREE.Vector3;
    } | null = null;
    const tmpV = new THREE.Vector3();
    const tmpV2 = new THREE.Vector3();
    const tmpO = new THREE.Vector3();

    // Bộ đệm phẳng cố định cho va chạm nhãn (0 cấp phát bộ nhớ mỗi frame!)
    const MAX_PLACED_BOXES = 600;
    const placedBoxes = new Float32Array(MAX_PLACED_BOXES * 4);
    let placedCount = 0;

    // Lưu trạng thái Shadow Frustum lần cuối để không phải vẽ lại Shadow Map khi chỉ xoay nhẹ
    const lastShadowTarget = new THREE.Vector3(Infinity, Infinity, Infinity);
    let lastShadowHalf = -1;
    let lastShadowState = shadowsRef.current;

    const clampTarget = () => {
      const box = engineRef.current?.wardBox;
      if (!box) return;
      const t = controls.target;
      const minX = box[0] - 200,
        maxX = box[2] + 200;
      const minZ = -box[3] - 200,
        maxZ = -box[1] + 200;
      const cx = Math.min(maxX, Math.max(minX, t.x));
      const cz = Math.min(maxZ, Math.max(minZ, t.z));
      const targetY = anim ? t.y : getElevationAtLocal(cx, -cz);
      if (cx !== t.x || cz !== t.z || (!anim && Math.abs(t.y - targetY) > 0.08)) {
        const dx = cx - t.x,
          dy = targetY - t.y,
          dz = cz - t.z;
        t.set(cx, targetY, cz);
        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z += dz;
      }
    };

    const canPlaceBox = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      w: number,
      h: number,
      forcePlace = false
    ) => {
      if (!forcePlace && (x0 < 6 || y0 < 46 || x1 > w - 50 || y1 > h - 42)) return false;
      if (!forcePlace) {
        for (let i = 0; i < placedCount; i++) {
          const base = i * 4;
          if (
            x0 < placedBoxes[base + 2] &&
            x1 > placedBoxes[base] &&
            y0 < placedBoxes[base + 3] &&
            y1 > placedBoxes[base + 1]
          ) {
            return false;
          }
        }
      }
      if (placedCount < MAX_PLACED_BOXES) {
        const base = placedCount * 4;
        placedBoxes[base] = x0;
        placedBoxes[base + 1] = y0;
        placedBoxes[base + 2] = x1;
        placedBoxes[base + 3] = y1;
        placedCount++;
      }
      return true;
    };

    const setElVis = (el: HTMLElement, visible: boolean) => {
      const flag = visible ? '1' : '0';
      if (el.dataset.v !== flag) {
        el.dataset.v = flag;
        el.style.visibility = visible ? 'visible' : 'hidden';
      }
    };

    const updateOverlays = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      const dist = camera.position.distanceTo(controls.target);
      const showNames = dist < 1050;
      const nameFlag = showNames ? '1' : '0';
      placedCount = 0;

      // 0. Ghim nháp khi Admin đang chấm vị trí mới trên 3D
      const draftEl = draftMarkerElRef.current;
      const draftCoord = draftCoordRef.current;
      const o = engineRef.current?.origin;
      if (draftEl) {
        if (draftCoord && o) {
          const [dx, dy] = lngLatToLocal(o, draftCoord.lng, draftCoord.lat);
          const draftTerrainY = getElevationAtLngLat(draftCoord.lng, draftCoord.lat);
          tmpV.set(dx, 6 + draftTerrainY, -dy).project(camera);
          if (tmpV.z <= 1 && Math.abs(tmpV.x) <= 1.15 && Math.abs(tmpV.y) <= 1.15) {
            const sx = (tmpV.x * 0.5 + 0.5) * w;
            const sy = (-tmpV.y * 0.5 + 0.5) * h;
            setElVis(draftEl, true);
            draftEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
          } else {
            setElVis(draftEl, false);
          }
        } else {
          setElVis(draftEl, false);
        }
      }

      // 0b. Ghim Vị trí GPS của bạn ("Bạn đang ở đây") trên mặt đất 3D
      const userEl = userMarker3DElRef.current;
      const curRoute = activeRoute3DRef.current;
      const curUser = curRoute?.currentPos
        ? { lng: curRoute.currentPos[0], lat: curRoute.currentPos[1] }
        : userCoords3DRef.current;
      if (userEl) {
        if (curUser && o) {
          const [ux, uy] = lngLatToLocal(o, curUser.lng, curUser.lat);
          const userTerrainY = getElevationAtLngLat(curUser.lng, curUser.lat);
          tmpV.set(ux, 2.5 + userTerrainY, -uy).project(camera);
          if (tmpV.z <= 1 && Math.abs(tmpV.x) <= 1.15 && Math.abs(tmpV.y) <= 1.15) {
            const sx = (tmpV.x * 0.5 + 0.5) * w;
            const sy = (-tmpV.y * 0.5 + 0.5) * h;
            setElVis(userEl, true);
            userEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
          } else {
            setElVis(userEl, false);
          }
        } else {
          setElVis(userEl, false);
        }
      }

      // 0c. Ghim Chỗ bạn sinh sống ("🏠 Nhà của bạn") trên mặt đất 3D
      const homeEl = homeMarker3DElRef.current;
      const curHome = userHome3DRef.current;
      if (homeEl) {
        if (curHome && o) {
          const [hx, hy] = lngLatToLocal(o, curHome.lng, curHome.lat);
          const homeTerrainY = getElevationAtLngLat(curHome.lng, curHome.lat);
          tmpV.set(hx, 6 + homeTerrainY, -hy).project(camera);
          if (tmpV.z <= 1 && Math.abs(tmpV.x) <= 1.15 && Math.abs(tmpV.y) <= 1.15) {
            const sx = (tmpV.x * 0.5 + 0.5) * w;
            const sy = (-tmpV.y * 0.5 + 0.5) * h;
            setElVis(homeEl, true);
            homeEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
          } else {
            setElVis(homeEl, false);
          }
        } else {
          setElVis(homeEl, false);
        }
      }

      // 1. Ghim địa danh & quán ăn
      const pins = pinsRef.current;
      for (let i = 0; i < pins.length; i++) {
        const item = pins[i];
        const el = pinElsRef.current.get(item.place.id);
        if (!el) continue;
        tmpV.set(item.lx, item.ly, item.lz).project(camera);
        if (tmpV.z > 1 || tmpV.x < -1.12 || tmpV.x > 1.12 || tmpV.y < -1.12 || tmpV.y > 1.12) {
          setElVis(el, false);
          continue;
        }
        const sx = (tmpV.x * 0.5 + 0.5) * w;
        const sy = (-tmpV.y * 0.5 + 0.5) * h;
        const hw = showNames ? item.halfW : 17;
        const isFirstSelected = i === 0 && el.dataset.selected === '1';
        if (!canPlaceBox(sx - hw, sy - 48, sx + hw, sy + 4, w, h, isFirstSelected)) {
          setElVis(el, false);
          continue;
        }
        setElVis(el, true);
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        if (el.dataset.names !== nameFlag) {
          el.dataset.names = nameFlag;
        }
      }

      // 2. Nhãn tên tòa nhà
      const showLabels = showCivicRef.current && dist < 1100;
      const bLabels = bLabelsRef.current;
      for (let i = 0; i < bLabels.length; i++) {
        const item = bLabels[i];
        const el = labelElsRef.current.get(item.index);
        if (!el) continue;
        if (!showLabels) {
          setElVis(el, false);
          continue;
        }
        const lb = item.label;
        tmpV.set(lb.x, lb.y, lb.z);
        const camDist = tmpV.distanceTo(camera.position);
        if (camDist > 1250) {
          setElVis(el, false);
          continue;
        }
        tmpV.project(camera);
        if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.06 || Math.abs(tmpV.y) > 1.06) {
          setElVis(el, false);
          continue;
        }
        const sx = (tmpV.x * 0.5 + 0.5) * w;
        const sy = (-tmpV.y * 0.5 + 0.5) * h;
        const hw = item.halfW;
        if (!canPlaceBox(sx - hw, sy - 20, sx + hw, sy + 2, w, h)) {
          setElVis(el, false);
          continue;
        }
        setElVis(el, true);
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }

      // 3. Nhãn tên đường
      const showRoads = showRoadNamesRef.current && dist < 2600;
      const rLabels = rLabelsRef.current;
      for (let i = 0; i < rLabels.length; i++) {
        const item = rLabels[i];
        const el = roadLabelElsRef.current.get(item.index);
        if (!el) continue;
        if (!showRoads) {
          setElVis(el, false);
          continue;
        }
        const rl = item.road;
        const ry = rl.y ?? 0.35;
        tmpV.set(rl.x, ry, rl.z);
        if (tmpV.distanceTo(camera.position) > item.maxDist) {
          setElVis(el, false);
          continue;
        }
        tmpV.set(rl.x - rl.dx * 16, ry, rl.z - rl.dz * 16).project(camera);
        tmpV2.set(rl.x + rl.dx * 16, ry, rl.z + rl.dz * 16).project(camera);
        if (tmpV.z > 1 || tmpV2.z > 1 || Math.abs(tmpV.x) > 1.05 || Math.abs(tmpV.y) > 1.05) {
          setElVis(el, false);
          continue;
        }
        const x1 = (tmpV.x * 0.5 + 0.5) * w,
          y1 = (-tmpV.y * 0.5 + 0.5) * h;
        const x2 = (tmpV2.x * 0.5 + 0.5) * w,
          y2 = (-tmpV2.y * 0.5 + 0.5) * h;
        const sx = (x1 + x2) * 0.5,
          sy = (y1 + y2) * 0.5;
        const hw = item.halfW;
        if (!canPlaceBox(sx - hw, sy - 12, sx + hw, sy + 12, w, h)) {
          setElVis(el, false);
          continue;
        }
        let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        if (ang > 90) ang -= 180;
        if (ang < -90) ang += 180;
        setElVis(el, true);
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${ang.toFixed(1)}deg)`;
      }
    };

    const frame = (now: number) => {
      rafPending = false;
      if (disposed) return;
      let moving = false;
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / anim.ms);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        controls.target.lerpVectors(anim.fromT, anim.toT, e);
        tmpO.lerpVectors(anim.fromO, anim.toO, e);
        camera.position.copy(controls.target).add(tmpO);
        if (k >= 1) anim = null;
        moving = true;
      }
      const changed = controls.update();
      clampTarget();

      const dist = camera.position.distanceTo(controls.target);
      const fog = scene.fog as THREE.Fog;
      fog.near = dist * 1.6 + 400;
      fog.far = dist * 5 + 2600;
      const nextNear = Math.max(1.5, dist * 0.015);
      const nextFar = fog.far * 1.05;
      if (
        Math.abs(camera.near - nextNear) > 0.25 ||
        Math.abs(camera.far - nextFar) > 25
      ) {
        camera.near = nextNear;
        camera.far = nextFar;
        camera.updateProjectionMatrix();
      }
      skyDome.position.copy(camera.position);
      skyDome.scale.setScalar(camera.far * 0.9);

      // Chỉ tính lại Shadow Map khi thực sự cần thiết -> mượt gấp 3 lần khi xoay camera
      sun.castShadow = shadowsRef.current;
      if (shadowsRef.current) {
        const half = Math.min(1600, Math.max(140, dist * 0.95));
        const targetMoved = controls.target.distanceToSquared(lastShadowTarget) > 100; // > 10m
        const halfChanged = Math.abs(lastShadowHalf - half) > half * 0.12;
        if (targetMoved || halfChanged || !lastShadowState) {
          const sc = sun.shadow.camera;
          sc.left = -half;
          sc.right = half;
          sc.top = half;
          sc.bottom = -half;
          sc.updateProjectionMatrix();
          sun.target.position.copy(controls.target);
          sun.position.copy(controls.target).addScaledVector(SUN_DIR, 2500);
          sun.target.updateMatrixWorld();
          lastShadowTarget.copy(controls.target);
          lastShadowHalf = half;
          renderer.shadowMap.needsUpdate = true;
        }
      }
      lastShadowState = shadowsRef.current;

      renderer.render(scene, camera);
      updateOverlays();

      // Xoay kim la bàn trực tiếp qua DOM ref (0 React re-render!)
      if (compassIconRef.current) {
        const az = controls.getAzimuthalAngle();
        const deg = Math.round((-az * 180) / Math.PI) - 45;
        compassIconRef.current.style.transform = `rotate(${deg}deg)`;
      }

      if (changed || moving) requestRender();
    };

    const requestRender = () => {
      if (rafPending || disposed) return;
      rafPending = true;
      requestAnimationFrame(frame);
    };

    const invalidateShadow = () => {
      lastShadowHalf = -1;
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    };

    const animateTo = (target: THREE.Vector3, offset: THREE.Vector3, ms = 620) => {
      anim = {
        t0: performance.now(),
        ms,
        fromT: controls.target.clone(),
        toT: target.clone(),
        fromO: camera.position.clone().sub(controls.target),
        toO: offset.clone(),
      };
      requestRender();
    };

    controls.addEventListener('change', requestRender);
    controls.addEventListener('start', () => {
      anim = null;
    });

    // Hỗ trợ Admin click trực tiếp lên mặt đất 3D để lấy tọa độ cắm ghim / dời ghim hoặc click chọn công trình Master Building
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const hitPoint = new THREE.Vector3();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
      const o = engineRef.current?.origin;
      if (!o) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      // Cắt mặt phẳng ngang theo độ cao DEM của tâm nhìn và lặp 3 bước hội tụ theo DEM thực
      let planeY = controls.target.y;
      GROUND_PLANE.constant = -planeY;
      if (raycaster.ray.intersectPlane(GROUND_PLANE, hitPoint)) {
        for (let iter = 0; iter < 3; iter++) {
          planeY = getElevationAtLocal(hitPoint.x, -hitPoint.z);
          GROUND_PLANE.constant = -planeY;
          raycaster.ray.intersectPlane(GROUND_PLANE, hitPoint);
        }
        GROUND_PLANE.constant = 0;
        const [lng, lat] = localToLngLat(o, hitPoint.x, -hitPoint.z);
        const fixedLat = Number(lat.toFixed(6));
        const fixedLng = Number(lng.toFixed(6));
        if (isPickingHome3DRef.current) {
          setHome3DLatInput(String(fixedLat));
          setHome3DLngInput(String(fixedLng));
          setHome3DModalMode('edit');
          setHome3DFeedback(
            `Đã chấm vị trí nhà trên Sa bàn 3D (${fixedLat}, ${fixedLng}). Bấm "Lưu chỗ bạn sống" để hoàn tất!`
          );
          requestRender();
          return;
        }
        if (isPicking3DRef.current) {
          setEditLat(String(fixedLat));
          setEditLng(String(fixedLng));
          setIsPicking3DGround(false);
          setEditNotice({
            text: `📍 Đã chấm vị trí trên mặt đất 3D (${fixedLat}, ${fixedLng}). Hãy bấm "Lưu cập nhật"!`,
          });
          requestRender();
          return;
        }
        // Khi người dùng click trực tiếp vào một công trình trên Sa bàn 3D -> tra cứu Master Building đồng bộ với 2D
        const hitBuilding = findMasterBuildingAtLngLat(getLoadedMasterDataset(), lng, lat, 10);
        if (hitBuilding) {
          handleSelectBuilding3D(hitBuilding);
        } else {
          handleSelectBuilding3D(null);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    /* ------------------------------------------------------------ Worker dựng hình */
    const worker = new Worker(new URL('./city3d.worker.ts', import.meta.url), { type: 'module' });
    engineRef.current = {
      renderer,
      scene,
      camera,
      controls,
      sun,
      worker,
      origin: null,
      wardBox: null,
      requestRender,
      invalidateShadow,
      animateTo,
      liveRequestId: 0,
    };

    const addFlatLayer = (m: MeshBuffers, order: number, receiveShadow = true) => {
      if (!m.indices.length) return;
      const { m: mat } = flatLayerMat(order);
      disposables.push(mat);
      const mesh = new THREE.Mesh(geometryFrom(m, order === -6), mat);
      mesh.renderOrder = order;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    };

    const upsertBuildingChunk = (c: BuildingChunk) => {
      const old = buildingMeshes.get(c.key);
      if (old) {
        old.geometry.dispose();
        scene.remove(old);
      }
      if (!c.indices.length) {
        buildingMeshes.delete(c.key);
        return;
      }
      const mesh = new THREE.Mesh(geometryFrom(c, true), buildingMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      buildingMeshes.set(c.key, mesh);
    };

    const dummy = new THREE.Object3D();
    const upsertTreeChunk = (c: TreeChunk) => {
      const old = treeGroups.get(c.key);
      if (old) {
        old.children.forEach((ch) => (ch as THREE.InstancedMesh).dispose());
        scene.remove(old);
      }
      const nB = c.broadleaf.length / 6,
        nC = c.conifer.length / 6;
      if (!nB && !nC) return;
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      const crowns = nB ? new THREE.InstancedMesh(crownGeo, crownMat, nB) : null;
      const cones = nC ? new THREE.InstancedMesh(coniferGeo, crownMat, nC) : null;
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, nB + nC);
      let ti = 0;
      const fill = (arr: Float32Array, mesh: THREE.InstancedMesh | null) => {
        if (!mesh) return;
        for (let i = 0; i < arr.length / 6; i++) {
          const x = arr[i * 6],
            y = arr[i * 6 + 1],
            z = arr[i * 6 + 2],
            s = arr[i * 6 + 3],
            rot = arr[i * 6 + 4];
          dummy.position.set(x, y, z);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(s, s * (0.9 + (rot % 0.3)), s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, treeColors[arr[i * 6 + 5] | 0]);
          trunks.setMatrixAt(ti++, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      };
      fill(c.broadleaf, crowns);
      fill(c.conifer, cones);
      trunks.instanceMatrix.needsUpdate = true;
      trunks.computeBoundingSphere();
      group.add(trunks);
      scene.add(group);
      treeGroups.set(c.key, group);
    };

    const placeInitialCamera = (o: City3DOrigin) => {
      const [x, y] = lngLatToLocal(o, initialCenter.lng, initialCenter.lat);
      const ty = getElevationAtLocal(x, y);
      controls.target.set(x, ty, -y);
      const d = initialZoom ? zoom2DToDistance3D(initialZoom) : 620;
      const polar = 0.92;
      const az = -0.35;
      camera.position.set(
        x + d * Math.sin(polar) * Math.sin(az),
        ty + d * Math.cos(polar),
        -y + d * Math.sin(polar) * Math.cos(az)
      );
      controls.update();
      invalidateShadow();
    };

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      const eng = engineRef.current;
      if (!eng || disposed) return;
      switch (msg.type) {
        case 'progress':
          setProgress({ label: msg.label, pct: msg.pct });
          break;
        case 'origin':
          eng.origin = msg.origin;
          eng.wardBox = msg.wardBox;
          setOriginState(msg.origin);
          // Dựng 3 công trình biểu tượng 3D chuẩn tạo hình (Quảng trường Con Chim Xanh, Nhà Trắng, ĐH Kiến Trúc)
          {
            const prevIconic = scene.getObjectByName('XuanHoaIconicLandmarks');
            if (prevIconic) scene.remove(prevIconic);
            const iconicGroup = createIconicLandmarksGroup(msg.origin, disposables);
            scene.add(iconicGroup);
          }
          placeInitialCamera(msg.origin);
          break;
        case 'base':
          {
            const skirt = new THREE.Mesh(geometryFrom(msg.skirt, true), skirtMat);
            skirt.renderOrder = -10;
            skirt.matrixAutoUpdate = false;
            scene.add(skirt);
            addFlatLayer(msg.ground, -6);
            addFlatLayer(msg.landuse, -5);
            addFlatLayer(msg.water, -4);
            addFlatLayer(msg.roads, -3);
            addFlatLayer(msg.markings, -2, false);
            invalidateShadow();
          }
          break;
        case 'buildings':
          msg.chunks.forEach(upsertBuildingChunk);
          invalidateShadow();
          break;
        case 'trees':
          msg.chunks.forEach(upsertTreeChunk);
          invalidateShadow();
          break;
        case 'labels':
          setLabels(msg.labels);
          if (msg.roadLabels) setRoadLabels(msg.roadLabels);
          break;
        case 'ready':
          setStats(msg.stats);
          setIsReady(true);
          setProgress({ label: 'Hoàn tất', pct: 100 });
          invalidateShadow();
          break;
        case 'liveDone':
          setLiveState({
            busy: false,
            message:
              msg.updated + msg.added + msg.trees === 0
                ? 'Khu này đã khớp 100% dữ liệu OpenStreetMap mới nhất.'
                : `Đã cập nhật ${msg.updated} nhà, thêm ${msg.added} nhà mới, ${msg.trees} cây` +
                  (msg.withRealHeight ? ` · ${msg.withRealHeight} nhà có số tầng thật` : ''),
          });
          invalidateShadow();
          break;
        case 'error':
          if (!isReadyRef.current) setError(msg.message);
          else setLiveState({ busy: false, message: `Lỗi: ${msg.message}` });
          break;
      }
    };
    worker.onerror = (ev) => setError(ev.message || 'Bộ dựng 3D gặp lỗi.');

    const baseUrl = new URL(import.meta.env.BASE_URL || '/', window.location.href).href.replace(
      /\/$/,
      ''
    );
    worker.postMessage({ type: 'init', baseUrl });

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      requestRender();
    });
    ro.observe(host);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      setError('Trình duyệt đã tạm dừng đồ hoạ 3D (thiếu bộ nhớ GPU). Vui lòng mở lại Bản đồ 3D.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    return () => {
      disposed = true;
      ro.disconnect();
      worker.terminate();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      buildingMeshes.forEach((m) => m.geometry.dispose());
      treeGroups.forEach((g) => g.children.forEach((c) => (c as THREE.InstancedMesh).dispose()));
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && !(mesh as any).isInstancedMesh) mesh.geometry?.dispose();
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      engineRef.current = null;
      THREE.ColorManagement.enabled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bật/tắt bóng đổ
  useEffect(() => {
    engineRef.current?.invalidateShadow();
  }, [shadowsOn]);

  // Vẽ lại khi danh sách quán / nhãn / tên đường thay đổi
  useEffect(() => {
    engineRef.current?.requestRender();
  }, [
    precomputedPins,
    precomputedBuildingLabels,
    precomputedRoadLabels,
    showCivic,
    selectedCategories3D,
    savedPlaceIds,
    activeShopGroup,
    showRoadNames,
  ]);

  // Tên khu vực từ Nominatim (lần đầu)
  useEffect(() => {
    const c = new AbortController();
    reverseAreaName(initialCenter.lat, initialCenter.lng, c.signal)
      .then((n) => n && setAreaName(n))
      .catch(() => {});
    return () => c.abort();
  }, [initialCenter.lat, initialCenter.lng]);

  // Phím tắt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPicking3DGround) setIsPicking3DGround(false);
        else if (isEditingPlace || isCreatingNew) {
          setIsEditingPlace(false);
          setIsCreatingNew(false);
        } else if (selected) setSelected(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, selected, isPicking3DGround, isEditingPlace, isCreatingNew]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  /* ================================================================ điều khiển camera */
  const zoomBy = useCallback((factor: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    const off = eng.camera.position.clone().sub(eng.controls.target);
    const len = Math.min(MAX_DIST, Math.max(MIN_DIST, off.length() * factor));
    eng.animateTo(eng.controls.target, off.setLength(len), 360);
  }, []);

  const rotateBy = useCallback((deg: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    const off = eng.camera.position.clone().sub(eng.controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (deg * Math.PI) / 180);
    eng.animateTo(eng.controls.target, off, 420);
  }, []);

  const resetNorth = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const off = eng.camera.position.clone().sub(eng.controls.target);
    const len = off.length();
    const polar = 0.92;
    eng.animateTo(
      eng.controls.target,
      new THREE.Vector3(0, len * Math.cos(polar), len * Math.sin(polar)),
      520
    );
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const flyToCoordinates3D = useCallback((lat: number, lng: number, targetDist = 300) => {
    const eng = engineRef.current;
    if (!eng?.origin) return;
    const [x, y] = lngLatToLocal(eng.origin, lng, lat);
    const terrainY = getElevationAtLngLat(lng, lat);
    const off = eng.camera.position.clone().sub(eng.controls.target);
    off.setLength(Math.min(off.length(), targetDist));
    eng.animateTo(new THREE.Vector3(x, terrainY, -y), off, 700);
  }, []);

  // Vẽ khung highlight 3D cho công trình Master Building đang được chọn (đồng bộ 2D <-> 3D)
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !originState) return;
    if (selectedBuildingGroupRef.current) {
      eng.scene.remove(selectedBuildingGroupRef.current);
      selectedBuildingGroupRef.current.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      selectedBuildingGroupRef.current = null;
    }
    if (!localSelectedBuilding || localSelectedBuilding.ringLocal.length < 3) {
      eng.requestRender();
      return;
    }
    const group = new THREE.Group();
    const ring = localSelectedBuilding.ringLocal;
    const baseY = getElevationAtLngLat(
      localSelectedBuilding.centroidLngLat[0],
      localSelectedBuilding.centroidLngLat[1]
    );
    const topY = baseY + localSelectedBuilding.height + 0.35;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < ring.length; i++) {
      pts.push(new THREE.Vector3(ring[i][0], topY, -ring[i][1]));
    }
    if (pts.length >= 3) {
      pts.push(pts[0].clone());
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.01);
      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(16, pts.length * 4), 0.55, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.renderOrder = 30;
      group.add(tubeMesh);
    }
    eng.scene.add(group);
    selectedBuildingGroupRef.current = group;
    eng.requestRender();
  }, [localSelectedBuilding, originState, demReadyTick]);

  // Vẽ tuyến đường dẫn đường 3D bám sát mặt đường khi activeRoute hoạt động (đồng bộ 100% giữa 2D và 3D)
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !originState) return;

    if (routeGroupRef.current) {
      eng.scene.remove(routeGroupRef.current);
      routeGroupRef.current.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      routeGroupRef.current = null;
    }

    if (!activeRoute || !activeRoute.pathLngLat || activeRoute.pathLngLat.length < 2) {
      eng.requestRender();
      return;
    }

    const group = new THREE.Group();
    const pIdx = Math.min(
      Math.max(0, activeRoute.progressIndex || 0),
      activeRoute.pathLngLat.length - 1
    );
    const activeCoords = activeRoute.pathLngLat.slice(pIdx);
    const coordsToDraw = activeCoords.length >= 2 ? activeCoords : activeRoute.pathLngLat;

    const pts3D: THREE.Vector3[] = [];
    for (let i = 0; i < coordsToDraw.length; i++) {
      const [lng, lat] = coordsToDraw[i];
      const [lx, ly] = lngLatToLocal(originState, lng, lat);
      const terrainY = getElevationAtLngLat(lng, lat);
      pts3D.push(new THREE.Vector3(lx, terrainY + 0.65, -ly));
    }

    if (pts3D.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(pts3D, false, 'catmullrom', 0.08);
      const tubeGeo = new THREE.TubeGeometry(
        curve,
        Math.min(240, pts3D.length * 4),
        2.3,
        6,
        false
      );
      const tubeMat = new THREE.MeshBasicMaterial({
        color: activeRoute.hasArrived ? 0x10b981 : 0x2563eb,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.renderOrder = 25;
      group.add(tubeMesh);

      // Điểm đích 3D
      const endPt = pts3D[pts3D.length - 1];
      const endGeo = new THREE.CylinderGeometry(3.8, 3.8, 1.4, 16);
      const endMat = new THREE.MeshBasicMaterial({
        color: activeRoute.hasArrived ? 0x059669 : 0xef4444,
      });
      const endMesh = new THREE.Mesh(endGeo, endMat);
      endMesh.position.set(endPt.x, endPt.y + 0.35, endPt.z);
      group.add(endMesh);
    }

    eng.scene.add(group);
    routeGroupRef.current = group;
    eng.requestRender();
  }, [activeRoute, originState, demReadyTick]);

  const flyToPlace = useCallback(
    (p: PlaceLocation) => {
      if (p.lat === null || p.lng === null) return;
      const eng = engineRef.current;
      if (eng?.origin) {
        const [x, y] = lngLatToLocal(eng.origin, p.lng, p.lat);
        const baseY = getElevationAtLngLat(p.lng, p.lat);
        // Tự động xoay góc nhìn chuẩn trực diện từ mặt đường chính cho các công trình biểu tượng & danh thắng 3D
        if (p.id === 'osm_landmark_quang_truong_chim_xanh') {
          // Nhìn từ Đường Nguyễn Văn Linh (Đông Bắc) vào thẳng Quảng trường Con Chim Xanh (Tây Nam)
          eng.animateTo(new THREE.Vector3(x, baseY, -y), new THREE.Vector3(44, 46, -46), 720);
          return;
        }
        if (p.id === 'osm_way_1079368029') {
          // Nhìn từ Đường Nguyễn Văn Linh (Tây Nam) vào thẳng cổng Số 34 & Tòa nhà 7 tầng ĐH Kiến trúc
          eng.animateTo(new THREE.Vector3(x, baseY, -y), new THREE.Vector3(-48, 42, 50), 720);
          return;
        }
        if (p.id === 'osm_landmark_nha_trang_xuan_hoa') {
          // Nhìn từ ngã giao Vòng tròn 1 vào thẳng mặt tiền Màn hình LED & Mái vòm vàng Nhà Trắng
          eng.animateTo(new THREE.Vector3(x, baseY, -y), new THREE.Vector3(-14, 42, 68), 720);
          return;
        }
        if (p.id === 'osm_historic_bot_than_lan') {
          // Nhìn trực diện vào Khu Di tích Lịch sử Bốt Pháp, Bốt tròn cổ, Nhà bia & Kỳ đài trên đỉnh Bắc Đồi Thằn Lằn
          eng.animateTo(new THREE.Vector3(x, baseY + 4, -y), new THREE.Vector3(56, 48, 68), 780);
          return;
        }
        if (p.id === 'osm_landmark_nui_than_lan') {
          // Nhìn bao quát Đài Vọng Cảnh Đỉnh Nam, đường leo đồi và toàn bộ sống lưng Đồi Thằn Lằn
          eng.animateTo(new THREE.Vector3(x, baseY + 3, -y), new THREE.Vector3(82, 68, 95), 780);
          return;
        }
      }
      flyToCoordinates3D(p.lat, p.lng, 175);
    },
    [flyToCoordinates3D]
  );

  /* ================================================================ Admin chỉnh sửa / thêm địa danh */
  const openEditForPlace = useCallback(
    (p: PlaceLocation) => {
      if (!hasAdminAccess) {
        setIsLoginModalOpen(true);
        return;
      }
      setEditId(p.id);
      setEditName(p.name);
      setEditCategory(p.category);
      setEditAddress(p.address || '');
      setEditTagline(p.metadata?.subType || p.originalPlace?.tagline || '');
      setEditPhone(p.phone || '');
      setEditHours(p.openHours || '');
      setEditMapsInput(p.metadata?.mapsUrl || '');
      setEditLat(p.lat !== null ? String(p.lat) : '');
      setEditLng(p.lng !== null ? String(p.lng) : '');
      setEditNotice(null);
      setGeoSuggestions([]);
      setIsCreatingNew(false);
      setIsEditingPlace(true);
    },
    [hasAdminAccess]
  );

  const openCreateNewModal = useCallback(() => {
    if (!hasAdminAccess) {
      setIsLoginModalOpen(true);
      return;
    }
    const eng = engineRef.current;
    let centerLat = initialCenter.lat;
    let centerLng = initialCenter.lng;
    if (eng?.origin) {
      const [lng, lat] = localToLngLat(eng.origin, eng.controls.target.x, -eng.controls.target.z);
      centerLat = Number(lat.toFixed(6));
      centerLng = Number(lng.toFixed(6));
    }
    setEditId(undefined);
    setEditName('');
    setEditCategory('public');
    setEditAddress('Phường Xuân Hòa');
    setEditTagline('');
    setEditPhone('');
    setEditHours('07:30 - 17:30');
    setEditMapsInput('');
    setEditLat(String(centerLat));
    setEditLng(String(centerLng));
    setEditNotice({
      text: '💡 Bạn có thể dán Link Google Maps / Plus Code, bấm "Tìm địa chỉ" hoặc bấm "Chấm trên mặt đất 3D".',
    });
    setGeoSuggestions([]);
    setIsEditingPlace(false);
    setIsCreatingNew(true);
  }, [hasAdminAccess, initialCenter.lat, initialCenter.lng]);

  const handleMapsInputChange = (val: string) => {
    setEditMapsInput(val);
    const parsed = parseCoordinatesFromInputOrUrl(val);
    if (parsed) {
      setEditLat(String(parsed.lat));
      setEditLng(String(parsed.lng));
      setEditNotice({
        text: `✓ Đã định vị chuẩn 100% tọa độ ghim Google Maps (${parsed.lat}, ${parsed.lng}) và bay tới vị trí!`,
      });
      flyToCoordinates3D(parsed.lat, parsed.lng, 260);
    } else if (/goo\.gl|maps\.app\.goo\.gl/i.test(val)) {
      setEditNotice({
        text: '💡 Link rút gọn (goo.gl) không chứa sẵn số tọa độ. Hãy mở link trên trình duyệt rồi copy đường link đầy đủ trên thanh địa chỉ (hoặc dán Plus Code / tọa độ) vào đây để chuẩn 100%!',
        isError: true,
      });
    }
  };

  const handleSearchAddressIn3D = async () => {
    const query = (editMapsInput.trim() || editAddress.trim() || editName.trim()).trim();
    if (!query) {
      setEditNotice({ text: 'Hãy nhập địa chỉ, tên đường hoặc Link Google Maps để tìm.', isError: true });
      return;
    }
    // 1. Thử giải mã trực tiếp nếu là Link Maps / Plus Code / Tọa độ
    const direct = parseCoordinatesFromInputOrUrl(query);
    if (direct) {
      setEditLat(String(direct.lat));
      setEditLng(String(direct.lng));
      flyToCoordinates3D(direct.lat, direct.lng, 260);
      setEditNotice({ text: `✓ Đã định vị tọa độ: ${direct.lat}, ${direct.lng}` });
      return;
    }

    setIsGeocoding(true);
    setEditNotice(null);
    setGeoSuggestions([]);
    try {
      const results = await geocodeAddressWithNominatim(query);
      const roadMatch = findSuggestedRoadForAddress(query, VERIFIED_OSM_ROADS_SEED);
      const combined = [...results];
      if (roadMatch) {
        combined.unshift({
          displayName: `Tuyến đường khớp tại Xuân Hòa: ${roadMatch.name}`,
          lat: roadMatch.lat,
          lng: roadMatch.lng,
        });
      }
      if (combined.length > 0) {
        setGeoSuggestions(combined.slice(0, 4));
        const best = combined[0];
        setEditLat(String(best.lat));
        setEditLng(String(best.lng));
        flyToCoordinates3D(best.lat, best.lng, 280);
        setEditNotice({
          text: `Đã tìm thấy ${combined.length} vị trí khớp. Bạn có thể bấm "Chấm trên mặt đất 3D" để căn chỉnh chính xác vào ngôi nhà.`,
        });
      } else {
        setEditNotice({
          text: 'Chưa tìm thấy tự động. Hãy bấm nút "🎯 Chấm trên mặt đất 3D" rồi click vào ngôi nhà!',
          isError: true,
        });
      }
    } catch {
      const roadMatch = findSuggestedRoadForAddress(query, VERIFIED_OSM_ROADS_SEED);
      if (roadMatch) {
        setEditLat(String(roadMatch.lat));
        setEditLng(String(roadMatch.lng));
        flyToCoordinates3D(roadMatch.lat, roadMatch.lng, 280);
        setEditNotice({ text: `Đã bay tới trục ${roadMatch.name}. Hãy bấm chấm mặt đất 3D để chọn đúng nhà.` });
      } else {
        setEditNotice({ text: 'Không kết nối được máy chủ tìm kiếm. Hãy chấm trực tiếp trên 3D.', isError: true });
      }
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSavePlaceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lat = parseFloat(editLat);
      const lng = parseFloat(editLng);
      const saved = saveLandmarkOrPlaceFromMap({
        id: editId,
        name: editName,
        category: editCategory,
        address: editAddress,
        tagline: editTagline,
        phone: editPhone,
        openHours: editHours,
        lat,
        lng,
        mapsUrl: editMapsInput,
      });

      // Tự động bật bộ lọc tương ứng để Admin thấy ngay ghim vừa lưu
      const isCivic = editCategory === 'public' || editCategory === 'school';
      if (isCivic && !showCivic) setShowCivic(true);
      if (!isCivic) {
        if (editCategory === 'food') setActiveShopGroup('food');
        else if (editCategory === 'pub') setActiveShopGroup('pub');
        else if (editCategory === 'cafe') setActiveShopGroup('cafe');
        else if (editCategory === 'snack') setActiveShopGroup('snack');
        else setActiveShopGroup('service');
      }

      onDataChanged?.();
      flyToCoordinates3D(saved.lat, saved.lng, 260);
      setIsEditingPlace(false);
      setIsCreatingNew(false);
      setIsPicking3DGround(false);
      setLiveState({
        busy: false,
        message: isStrictSuperAdmin
          ? `✅ Đã lưu địa danh "${editName.trim()}" (${saved.lat}, ${saved.lng})!`
          : `✅ Đã ghim "${editName.trim()}" lên 3D & gửi sang mục Duyệt Maps (Cột 1) cho Admin!`,
      });
    } catch (err: any) {
      setEditNotice({ text: err?.message || 'Lỗi khi lưu địa danh.', isError: true });
    }
  };

  const handleBlockPlace = () => {
    if (!editId) return;
    blockLandmarkOrPlaceFromMap(editId, editName);
    onDataChanged?.();
    setIsEditingPlace(false);
    setSelected(null);
    setLiveState({
      busy: false,
      message: `🔒 Đã Block (tạm khóa) "${editName}" trên Bản đồ 2D & 3D.`,
    });
  };

  const handleDeletePlace = () => {
    if (!editId || !isStrictSuperAdmin) return;
    hideLandmarkOrPlaceFromMap(editId, editName);
    onDataChanged?.();
    setIsEditingPlace(false);
    setSelected(null);
    setLiveState({
      busy: false,
      message: `🗑️ Đã xóa "${editName}" khỏi Bản đồ 2D & 3D.`,
    });
  };

  const handleRestoreDefault = () => {
    if (!editId) return;
    restoreLandmarkOrPlaceDefault(editId);
    onDataChanged?.();
    setIsEditingPlace(false);
    setLiveState({
      busy: false,
      message: `↺ Đã khôi phục "${editName}" về dữ liệu gốc mặc định.`,
    });
  };

  const handleAdminQuickLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    const cleanInput = loginUser.trim().toLowerCase();
    // 1. Hỗ trợ Quản lý Maps nhập trực tiếp Gmail đã được Admin cấp quyền
    if (cleanInput.includes('@')) {
      const roleCheck = isMapManagerAuthenticated({
        isLoggedIn: true,
        uid: 'check',
        email: cleanInput,
        displayName: cleanInput,
        nickname: cleanInput,
        gender: 'male',
        avatar: '🗺️',
        avatarId: 'm_ty',
        hasCompletedProfile: true,
        isFirstTimeSetupDone: true,
        createdAt: Date.now(),
      });
      if (roleCheck) {
        setHasAdminAccess(true);
        setIsLoginModalOpen(false);
        if (selected) openEditForPlace(selected);
        return;
      }
      setLoginErr('Gmail này chưa được Admin tích cấp quyền Quản lý Maps!');
      return;
    }
    // 2. Hỗ trợ đăng nhập bằng tài khoản Nick Admin (VD: admin / 123, minhtt / 123) hoặc mã Quản lý Maps
    const res = loginAdminWithCredentials(loginUser, loginPass, true);
    if (res.ok) {
      setHasAdminAccess(true);
      setIsLoginModalOpen(false);
      setLoginPass('');
      if (selected) openEditForPlace(selected);
      return;
    }
    const codeRes = verifyAndClaimPlaceWithCode(loginUser.trim(), null);
    if (codeRes.ok && codeRes.isMapManager) {
      setHasAdminAccess(true);
      setIsLoginModalOpen(false);
      return;
    }
    setLoginErr(res.message || 'Tài khoản Nick Admin hoặc Gmail Quản lý Maps chưa đúng!');
  };

  useEffect(() => {
    if (!liveState.message || liveState.busy) return;
    const id = window.setTimeout(() => setLiveState((s) => ({ ...s, message: null })), 5500);
    return () => window.clearTimeout(id);
  }, [liveState]);

  /* ================================================================ giao diện tối ưu không gian */
  const ctrlBtn =
    'w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition cursor-pointer';
  const isOsmSeedSelected = useMemo(
    () => Boolean(editId && VERIFIED_OSM_POIS.some((p) => p.id === editId)),
    [editId]
  );

  const activeCategoryLabel3D = useMemo(() => {
    if (activeShopGroup === 'food') return `Quán ăn (${shopGroupCounts.food})`;
    if (activeShopGroup === 'pub') return `Quán nhậu (${shopGroupCounts.pub})`;
    if (activeShopGroup === 'cafe') return `Cafe & Trà (${shopGroupCounts.cafe})`;
    if (activeShopGroup === 'snack') return `Ăn vặt (${shopGroupCounts.snack})`;
    if (activeShopGroup === 'service') return `Dịch vụ (${shopGroupCounts.service})`;
    return 'Danh mục';
  }, [activeShopGroup, shopGroupCounts]);

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 z-[45] overflow-hidden select-none ${
        isPicking3DGround || home3DModalMode === 'picking' ? 'cursor-crosshair' : ''
      }`}
      style={{ fontFamily: FONT, background: CITY3D_COLORS.sky }}
    >
      <div
        ref={canvasHostRef}
        className={`absolute inset-0 ${
          isPicking3DGround || home3DModalMode === 'picking' ? 'cursor-crosshair' : ''
        }`}
      />

      {/* Lớp phủ Ghim & Nhãn (Zero-GC GPU Transform) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Ghim nháp khi đang chỉnh sửa / thêm mới tọa độ */}
        <div
          ref={draftMarkerElRef}
          className="absolute left-0 top-0 z-[200000] flex flex-col items-center pointer-events-none"
          style={{ visibility: 'hidden', willChange: 'transform' }}
        >
          <span className="mb-1 rounded-lg bg-[#F59E0B] px-2 py-0.5 text-[10.5px] font-extrabold text-white shadow-md border border-white">
            {editName.trim() || 'Vị trí đang chọn'}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-white bg-[#F59E0B] text-white shadow-[0_0_16px_rgba(245,158,11,0.9)] animate-pulse">
            <Crosshair size={16} />
          </span>
          <span className="h-2.5 w-0.5 bg-[#F59E0B]" />
        </div>

        {/* Ghim Vị trí hiện tại của bạn ("Bạn đang ở đây") đồng bộ giữa 2D và 3D */}
        <div
          ref={userMarker3DElRef}
          className="absolute left-0 top-0 z-[150000] flex flex-col items-center pointer-events-none"
          style={{ visibility: 'hidden', willChange: 'transform' }}
        >
          <div className="mb-1.5 px-2.5 py-0.5 rounded-full bg-[#39B980] text-white border-2 border-[#403064] text-[10.5px] leading-snug font-extrabold whitespace-nowrap shadow-md">
            Bạn đang ở đây
          </div>
          <div className="relative flex items-center justify-center">
            <span className="absolute w-10 h-10 rounded-full bg-[#39B980]/35 animate-ping" />
            <span className="w-4 h-4 rounded-full bg-[#39B980] border-2 border-white ring-2 ring-[#403064] shadow-md" />
          </div>
        </div>

        {/* Ghim Chỗ bạn sinh sống ("🏠 Nhà của bạn") đồng bộ trên Sa bàn 3D */}
        <div
          ref={homeMarker3DElRef}
          className="absolute left-0 top-0 z-[160000] flex flex-col items-center pointer-events-auto"
          style={{ visibility: 'hidden', willChange: 'transform' }}
        >
          <button
            type="button"
            onClick={() => {
              if (userHome) {
                flyToCoordinates3D(userHome.lat, userHome.lng, 185);
                setHome3DModalMode('view');
              }
            }}
            className="flex flex-col items-center cursor-pointer focus:outline-none group"
            title={userHome ? `${userHome.label}: ${userHome.address}` : 'Nhà của bạn'}
          >
            <span className="mb-1 px-2.5 py-0.5 rounded-xl bg-[#FEF3C7] text-[#92400E] border-2 border-[#D97706] text-[10.5px] font-extrabold whitespace-nowrap shadow-md">
              🏠 {userHome?.label || 'Nhà của bạn'}
            </span>
            <span className="w-7 h-7 rounded-2xl bg-[#D97706] text-white border-2 border-white ring-2 ring-[#92400E] flex items-center justify-center shadow-lg text-xs font-extrabold group-hover:scale-110 transition-transform">
              🏠
            </span>
            <span className="h-1.5 w-0.5 bg-[#D97706]" />
          </button>
        </div>

        {precomputedPins.map(({ place: p }) => {
          const cat = MAP_CATEGORY_BY_ID[p.category];
          const isSel = selected?.id === p.id;
          const isBeingEdited = isEditingPlace && editId === p.id;
          const isSavedPin = savedPlaceIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              data-selected={isSel ? '1' : '0'}
              ref={(el) => {
                if (el) pinElsRef.current.set(p.id, el);
                else pinElsRef.current.delete(p.id);
              }}
              onClick={() => {
                setSelected(p);
                flyToPlace(p);
              }}
              className={`city3d-pin group absolute left-0 top-0 pointer-events-auto flex flex-col items-center cursor-pointer ${
                isBeingEdited ? 'opacity-0 pointer-events-none!' : ''
              }`}
              style={{
                visibility: 'hidden',
                willChange: 'transform',
                zIndex: isSel ? 99999 : isSavedPin ? 25 : 10,
              }}
              title={p.name}
            >
              <span
                className={`city3d-pin-name mb-0.5 max-w-[132px] sm:max-w-[148px] truncate rounded-md px-1.5 py-0.5 text-[10px] sm:text-[10.5px] font-bold shadow-sm border ${
                  isSel
                    ? 'bg-[#1E1633] text-[#FBBF24] border-[#FBBF24]'
                    : isSavedPin
                    ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
                    : 'bg-white/95 text-[#2D2246] border-[#403064]/20'
                }`}
              >
                {isSavedPin ? `★ ${p.name}` : p.name}
              </span>
              <span
                className={`relative flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 border-white text-white shadow-[0_3px_10px_rgba(0,0,0,0.32)] transition-transform group-hover:scale-110 ${
                  isSel ? 'ring-2 ring-[#FBBF24] scale-110' : ''
                }`}
                style={{ background: isSel ? '#403064' : cat?.markerBg || '#39B980' }}
              >
                {cat ? renderCategoryIcon(cat.iconName, 13) : <MapPin size={13} />}
                {isSavedPin && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#F59E0B] text-white border border-white text-[8px] font-black flex items-center justify-center shadow-xs">
                    ★
                  </span>
                )}
              </span>
              <span className="h-1.5 w-0.5 bg-white/90 shadow" />
            </button>
          );
        })}

        {precomputedBuildingLabels.map(({ label: lb, index }) => (
          <div
            key={`${lb.name}-${index}`}
            ref={(el) => {
              if (el) labelElsRef.current.set(index, el);
              else labelElsRef.current.delete(index);
            }}
            className="absolute left-0 top-0 whitespace-nowrap rounded bg-[#2D2246]/80 px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-semibold text-white shadow-xs"
            style={{ visibility: 'hidden', willChange: 'transform' }}
          >
            {lb.name}
          </div>
        ))}

        {precomputedRoadLabels.map(({ road: rl, index }) => (
          <div
            key={`road-${rl.name}-${index}`}
            ref={(el) => {
              if (el) roadLabelElsRef.current.set(index, el);
              else roadLabelElsRef.current.delete(index);
            }}
            className={`absolute left-0 top-0 whitespace-nowrap rounded px-1.5 py-0.5 font-extrabold tracking-wide shadow-xs ${
              rl.tier === 'major'
                ? 'bg-[#FEF3C7]/95 text-[#78350F] border border-[#F59E0B]/60 text-[9.5px] sm:text-[10.5px]'
                : rl.tier === 'secondary'
                ? 'bg-white/92 text-[#1E293B] border border-slate-400/50 text-[9px] sm:text-[10px]'
                : 'bg-white/85 text-[#334155] border border-slate-300/50 text-[8.5px] sm:text-[9.5px]'
            }`}
            style={{ visibility: 'hidden', willChange: 'transform' }}
          >
            {rl.name}
          </div>
        ))}
      </div>

      {/* THANH TÌM KIẾM & CHỌN DANH MỤC + ĐỊA ĐIỂM ĐÃ LƯU (★) GỌN GÀNG TRÊN CÙNG CHUẨN GOOGLE MAPS */}
      <div className="absolute left-2.5 right-2.5 sm:left-3 sm:right-auto top-2.5 z-20 pointer-events-none">
        <div className="pointer-events-auto relative flex items-center gap-1 w-full sm:w-[440px] rounded-full bg-white/96 border border-slate-200/90 pl-1.5 pr-3 py-1 shadow-[0_6px_22px_rgba(15,23,42,0.12)] backdrop-blur-md">
          {/* Nút chọn Danh mục dạng Dropdown */}
          <button
            type="button"
            onClick={() => {
              setIsFilterMenuOpen((v) => !v);
              setIsSavedMenu3DOpen(false);
              setIsSearch3DFocused(false);
            }}
            className="flex items-center gap-1 rounded-full bg-[#1E1633] hover:bg-[#2D2246] text-white px-2.5 sm:px-3 py-1 text-[11px] sm:text-[11.5px] font-extrabold transition cursor-pointer shrink-0 max-w-[128px] sm:max-w-[165px]"
            title="Bật/tắt các danh mục trên bản đồ"
          >
            <span className="truncate">Danh mục</span>
            <span className="text-[9px] opacity-80 ml-0.5">{isFilterMenuOpen ? '▲' : '▼'}</span>
          </button>

          {/* Nút Địa điểm đã lưu (★) nhỏ gọn ngay cạnh Danh mục */}
          <button
            type="button"
            onClick={() => {
              setIsSavedMenu3DOpen((v) => !v);
              setIsFilterMenuOpen(false);
              setIsSearch3DFocused(false);
            }}
            title="Địa điểm đã lưu của bạn (★)"
            className={`flex items-center justify-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-extrabold border transition shrink-0 cursor-pointer ${
              isSavedMenu3DOpen || savedPlaceIds.length > 0
                ? 'bg-[#FEF3C7] text-[#B45309] border-[#F59E0B] hover:bg-[#FDE68A]'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span>★</span>
            {savedPlaceIds.length > 0 && (
              <span className="text-[10px] font-extrabold">{savedPlaceIds.length}</span>
            )}
          </button>

          <div className="mx-1 h-4 w-[1px] bg-slate-200 shrink-0" />
          <input
            type="text"
            value={search3DQuery}
            onClick={() => {
              setIsSearch3DFocused(true);
              setIsFilterMenuOpen(false);
              setIsSavedMenu3DOpen(false);
            }}
            onFocus={() => {
              setIsSearch3DFocused(true);
              setIsFilterMenuOpen(false);
              setIsSavedMenu3DOpen(false);
            }}
            onBlur={() => window.setTimeout(() => setIsSearch3DFocused(false), 180)}
            onChange={(e) => {
              setSearch3DQuery(e.target.value);
              setIsSearch3DFocused(true);
              setIsFilterMenuOpen(false);
              setIsSavedMenu3DOpen(false);
            }}
            placeholder="Tìm địa chỉ, quán..."
            className="flex-1 min-w-0 bg-transparent text-[12px] font-semibold text-slate-800 placeholder-slate-400 outline-none"
          />
          {search3DQuery && (
            <button
              type="button"
              onClick={() => setSearch3DQuery('')}
              className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0 text-xs font-bold px-1"
            >
              ×
            </button>
          )}

          {/* BẢNG BẬT / TẮT TỪNG DANH MỤC GỌN GÀNG (CHUẨN OCD: 1 DÒNG THẲNG HÀNG, KHÔNG RƠI CHỮ) */}
          {isFilterMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-[288px] sm:w-[304px] rounded-2xl bg-white/98 border border-slate-200 shadow-[0_16px_40px_rgba(15,23,42,0.18)] p-2.5 z-50 flex flex-col gap-1 backdrop-blur-md">
              <div className="px-1.5 pb-1.5 mb-0.5 flex items-center justify-between gap-2 border-b border-slate-100">
                <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  Bật / Tắt danh mục
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategories3D([
                        'public',
                        'school',
                        'food',
                        'pub',
                        'cafe',
                        'snack',
                        'billiards',
                        'game',
                        'entertainment',
                        'service',
                        'grocery',
                        'supermarket',
                        'phone',
                      ]);
                      setActiveShopGroup('none');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#E6F7EF] hover:bg-[#D1FAE5] text-[#047857] text-[10.5px] font-extrabold whitespace-nowrap cursor-pointer transition"
                  >
                    Tất cả đã ghim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategories3D(['public', 'school']);
                      setActiveShopGroup('none');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10.5px] font-bold whitespace-nowrap cursor-pointer transition"
                  >
                    Chỉ Hành chính
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterMenuOpen(false)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10.5px] font-bold whitespace-nowrap cursor-pointer transition"
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
                    activeBg: 'bg-[#059669] text-white shadow-xs',
                  },
                  {
                    key: 'school',
                    cats: ['school'] as MapCategoryKey[],
                    label: 'Trường học & Giảng đường',
                    activeBg: 'bg-[#10B981] text-white shadow-xs',
                  },
                  {
                    key: 'food',
                    cats: ['food'] as MapCategoryKey[],
                    label: 'Quán ăn',
                    activeBg: 'bg-[#E11D48] text-white shadow-xs',
                  },
                  {
                    key: 'pub',
                    cats: ['pub'] as MapCategoryKey[],
                    label: 'Quán nhậu & Lẩu',
                    activeBg: 'bg-[#D97706] text-white shadow-xs',
                  },
                  {
                    key: 'cafe',
                    cats: ['cafe'] as MapCategoryKey[],
                    label: 'Cafe & Trà',
                    activeBg: 'bg-[#0284C7] text-white shadow-xs',
                  },
                  {
                    key: 'snack',
                    cats: ['snack'] as MapCategoryKey[],
                    label: 'Ăn vặt',
                    activeBg: 'bg-[#9333EA] text-white shadow-xs',
                  },
                  {
                    key: 'billiards',
                    cats: ['billiards', 'game', 'entertainment'] as MapCategoryKey[],
                    label: 'Bi-a, Game & Giải trí',
                    activeBg: 'bg-[#2563EB] text-white shadow-xs',
                  },
                  {
                    key: 'service',
                    cats: [
                      'service',
                      'grocery',
                      'supermarket',
                      'phone',
                    ] as MapCategoryKey[],
                    label: 'Dịch vụ & Tiện ích',
                    activeBg: 'bg-[#475569] text-white shadow-xs',
                  },
                ] as const
              ).map((tab) => {
                const isActive = tab.cats.some((c) => selectedCategories3D.includes(c));
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSelectedCategories3D((prev) => {
                        const hasAny = tab.cats.some((c) => prev.includes(c));
                        if (hasAny) {
                          return prev.filter((c) => !tab.cats.includes(c));
                        }
                        return [...prev, ...tab.cats];
                      });
                    }}
                    className={`w-full h-9 flex items-center justify-between gap-2 rounded-xl px-3 text-left text-[12px] font-bold transition cursor-pointer ${
                      isActive ? tab.activeBg : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="whitespace-nowrap truncate">{tab.label}</span>
                    <span
                      className={`min-w-[58px] text-center px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap shrink-0 ${
                        isActive ? 'bg-black/20 text-white' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {isActive ? 'Đang bật' : 'Tắt'}
                    </span>
                  </button>
                );
              })}

              <div className="my-0.5 border-t border-slate-100" />

              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowRoadNames((v) => !v)}
                  className={`rounded-xl px-2.5 py-1.5 text-center text-[11.5px] font-bold whitespace-nowrap transition cursor-pointer border ${
                    showRoadNames
                      ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/60'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Tên đường: {showRoadNames ? 'Bật' : 'Tắt'}
                </button>

                <button
                  type="button"
                  onClick={() => setShadowsOn((v) => !v)}
                  className={`rounded-xl px-2.5 py-1.5 text-center text-[11.5px] font-bold whitespace-nowrap transition cursor-pointer border ${
                    shadowsOn
                      ? 'bg-amber-100 text-amber-900 border-amber-300/70'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Ánh sáng: {shadowsOn ? 'Bật' : 'Tắt'}
                </button>
              </div>
            </div>
          )}

          {/* BẢNG ĐỊA ĐIỂM ĐÃ LƯU (★) THEO NICK TRÊN BẢN ĐỒ 3D */}
          {isSavedMenu3DOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white/98 border border-[#F59E0B]/70 shadow-[0_16px_40px_rgba(15,23,42,0.18)] p-2.5 z-50 space-y-1.5 backdrop-blur-md">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-[#B45309]">
                    ★ Địa điểm đã lưu ({savedPlaces3D.length})
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 truncate">
                    Nick: {userAccountLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavedMenu3DOpen(false)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10.5px] font-bold cursor-pointer shrink-0"
                >
                  Đóng
                </button>
              </div>

              {savedPlaces3D.length === 0 ? (
                <div className="py-4 px-2 text-center text-[11px] text-slate-500 space-y-1">
                  <div className="font-bold text-slate-700">Chưa có địa điểm nào được lưu</div>
                  <div>
                    Hãy bấm nút <strong className="text-[#B45309]">☆ Lưu</strong> trên địa điểm bất kỳ để lưu vào tài khoản của bạn.
                  </div>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-0.5">
                  {savedPlaces3D.map((item) => (
                    <div
                      key={item.id}
                      className="py-1.5 px-1.5 flex items-center justify-between gap-1.5 hover:bg-amber-50/60 rounded-xl transition"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsSavedMenu3DOpen(false);
                          setSelected(item);
                          flyToPlace(item);
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
                        {onDrawRouteToPlace && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSavedMenu3DOpen(false);
                              onDrawRouteToPlace(item, 'motorbike');
                            }}
                            className="px-2 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-[10px] font-extrabold cursor-pointer"
                          >
                            Đi tới
                          </button>
                        )}
                        {onToggleSavePlace && (
                          <button
                            type="button"
                            onClick={() => onToggleSavePlace(item)}
                            title="Bỏ lưu địa điểm này"
                            className="px-1.5 py-1 rounded-lg bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] text-[10px] font-extrabold cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BẢNG GỢI Ý TÌM KIẾM ĐỊA CHỈ & ĐƯỜNG PHỐ */}
          {isSearch3DFocused && (
            <div className="absolute left-0 right-0 sm:w-96 top-full mt-2 max-h-72 overflow-y-auto rounded-2xl bg-white/98 border border-slate-200 shadow-[0_16px_40px_rgba(15,23,42,0.18)] p-2 z-50 space-y-1 backdrop-blur-md">
              <div className="px-2.5 py-1 text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>
                  {search3DQuery.trim()
                    ? `Kết quả "${search3DQuery.trim()}"`
                    : 'Địa chỉ, Hàng quán & Đường phố'}
                </span>
                <span className="text-[10px] text-emerald-700">
                  {places.filter((p) => p.lat !== null && p.lng !== null).length} địa điểm
                </span>
              </div>

              {/* Gợi ý Đường & Ngõ */}
              {Array.from(new Map(roadLabels.map((r) => [r.name, r])).values())
                .filter((r) =>
                  search3DQuery.trim()
                    ? r.name.toLowerCase().includes(search3DQuery.trim().toLowerCase())
                    : r.tier === 'major' || r.tier === 'secondary'
                )
                .slice(0, search3DQuery.trim() ? 5 : 4)
                .map((r) => (
                  <button
                    key={`road-${r.name}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (!showRoadNames) setShowRoadNames(true);
                      if (originState) {
                        const [lng, lat] = localToLngLat(originState, r.x, -r.z);
                        flyToCoordinates3D(lat, lng, 290);
                      }
                      setSearch3DQuery('');
                      setIsSearch3DFocused(false);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-amber-50 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-extrabold text-slate-800 truncate">
                        {r.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Tuyến đường / ngõ Phường Xuân Hòa
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 shrink-0">
                      Bay tới
                    </span>
                  </button>
                ))}

              {/* Gợi ý Địa danh / Cơ quan / Hàng quán */}
              {places
                .filter(
                  (p) =>
                    p.lat !== null &&
                    p.lng !== null &&
                    (!search3DQuery.trim() ||
                      p.name.toLowerCase().includes(search3DQuery.trim().toLowerCase()) ||
                      (p.address || '')
                        .toLowerCase()
                        .includes(search3DQuery.trim().toLowerCase()) ||
                      (p.metadata?.subType || '')
                        .toLowerCase()
                        .includes(search3DQuery.trim().toLowerCase()))
                )
                .slice(0, search3DQuery.trim() ? 12 : 14)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const civic = isCivicLandmark(item);
                      if (civic && !showCivic) setShowCivic(true);
                      if (!civic) {
                        setActiveShopGroup(getShopGroupOfPlace(item));
                      }
                      setSelected(item);
                      flyToPlace(item);
                      setSearch3DQuery('');
                      setIsSearch3DFocused(false);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-emerald-50 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-extrabold text-slate-800 truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {item.metadata?.subType ? `${item.metadata.subType} · ` : ''}
                        {item.address}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                      Bay tới
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* THANH DẪN ĐƯỜNG GỌN GÀNG TRÊN BẢN ĐỒ 3D (ĐỒNG BỘ 100% VỚI 2D) */}
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
          <div className="absolute left-2.5 right-12 sm:left-3 sm:right-auto top-14 z-25 w-auto sm:w-[440px] rounded-2xl bg-[#FFFDF9]/98 border-2 border-[#2563EB] text-[#1E293B] shadow-[0_10px_28px_rgba(15,23,42,0.18)] p-2.5 text-[11px] leading-snug space-y-1.5 pointer-events-auto">
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
                {onToggleRouteInfo && (
                  <button
                    type="button"
                    onClick={onToggleRouteInfo}
                    className={`px-2 py-0.5 rounded-lg font-extrabold text-[10.5px] border cursor-pointer transition ${
                      activeRoute.isInfoExpanded
                        ? 'bg-[#403064] text-white border-[#403064]'
                        : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#3B82F6]/40 hover:bg-[#DBEAFE]'
                    }`}
                  >
                    {activeRoute.isInfoExpanded ? 'Ẩn TT' : 'TT & SĐT'}
                  </button>
                )}
                {onClearRoute && (
                  <button
                    type="button"
                    onClick={onClearRoute}
                    className="px-2 py-0.5 rounded-lg bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] font-extrabold text-[10.5px] cursor-pointer"
                  >
                    {activeRoute.hasArrived ? 'Đã đến • Tắt' : 'Tắt'}
                  </button>
                )}
              </div>
            </div>

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
                    onClick={() => onSwitchRouteMode?.(m.id)}
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

            {activeRoute.hasArrived ? (
              <div className="px-2.5 py-1.5 rounded-xl bg-[#ECFDF5] border border-[#10B981] text-[#065F46] flex items-center justify-between gap-2">
                <span className="font-extrabold text-[11px]">
                  Bạn đã đến {activeRoute.targetPlace.name}. Bấm nút bên phải để tắt dẫn đường.
                </span>
                {onClearRoute && (
                  <button
                    type="button"
                    onClick={onClearRoute}
                    className="px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-[10.5px] shrink-0 cursor-pointer"
                  >
                    Tắt khi đã đến
                  </button>
                )}
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
                {onArriveRoute && (
                  <button
                    type="button"
                    onClick={onArriveRoute}
                    className="px-2 py-0.5 rounded-md bg-[#E6F7EF] hover:bg-[#D1FAE5] text-[#047857] font-extrabold text-[10px] shrink-0 cursor-pointer"
                  >
                    Đã tới nơi
                  </button>
                )}
              </div>
            )}

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
                <div className="flex items-center gap-1.5 pt-0.5">
                  <a
                    href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-[11px] text-center shadow-xs"
                  >
                    Gọi SĐT: {contactPhone}
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelected(activeRoute.targetPlace)}
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

      {/* Thanh nhắc khi đang ở chế độ chấm vị trí trực tiếp trên mặt đất 3D */}
      {isPicking3DGround && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-2xl bg-[#F59E0B] px-4 py-2 text-xs font-extrabold text-white shadow-xl border-2 border-white">
          <span>Chạm vào đúng ngôi nhà hoặc vị trí trên mặt đất 3D để đặt ghim</span>
          <button
            type="button"
            onClick={() => setIsPicking3DGround(false)}
            className="ml-1 rounded-lg bg-black/20 px-2 py-0.5 text-[11px] hover:bg-black/30 cursor-pointer"
          >
            Hủy
          </button>
        </div>
      )}

      {/* Thanh nhắc khi khách hàng đang chấm chọn vị trí Nhà của bạn trên Sa bàn 3D */}
      {home3DModalMode === 'picking' && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-2xl bg-[#D97706] px-4 py-2 text-xs font-extrabold text-white shadow-xl border-2 border-white">
          <span>Chạm vào đúng ngôi nhà hoặc ngõ bạn đang sinh sống trên mặt đất 3D</span>
          <button
            type="button"
            onClick={() => setHome3DModalMode('edit')}
            className="ml-1 rounded-lg bg-black/20 px-2 py-0.5 text-[11px] hover:bg-black/30 cursor-pointer shrink-0"
          >
            Quay lại
          </button>
        </div>
      )}

      {/* CỘT ĐIỀU KHIỂN DỌC BÊN PHẢI — ĐỒNG NHẤT 100% VỊ TRÍ & KIỂU DÁNG VỚI BẢN ĐỒ 2D (KHÔNG NHẢY XUỐNG DƯỚI) */}
      <div className="fixed right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-2 pointer-events-auto">
        {is3DLayerMenuOpen && (
          <div className="mb-1 w-60 rounded-2xl bg-[#FFFDF9] border border-[#403064]/80 shadow-[0_12px_30px_rgba(64,48,100,0.22)] p-3 text-xs text-[#2D2246] space-y-2">
            <div className="font-extrabold text-[#403064] pb-1.5 border-b border-[#E5DEC9] flex items-center justify-between leading-snug">
              <span>Tùy chỉnh Sa bàn 3D</span>
              <button
                type="button"
                onClick={() => setIs3DLayerMenuOpen(false)}
                className="text-[11px] font-bold text-[#65587F] hover:text-[#2D2246] cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center justify-between gap-2 cursor-pointer select-none py-0.5">
                <span className="font-semibold text-[11.5px]">Hiện ghim định vị</span>
                <input
                  type="checkbox"
                  checked={showLocationPins}
                  onChange={() => setShowLocationPins((v) => !v)}
                  className="w-4 h-4 accent-[#39B980] rounded cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 cursor-pointer select-none py-0.5">
                <span className="font-semibold text-[11.5px]">Hiện tên công trình 3D</span>
                <input
                  type="checkbox"
                  checked={showCivic}
                  onChange={() => setShowCivic((v) => !v)}
                  className="w-4 h-4 accent-[#39B980] rounded cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 cursor-pointer select-none py-0.5">
                <span className="font-semibold text-[11.5px]">Hiện tên đường 3D</span>
                <input
                  type="checkbox"
                  checked={showRoadNames}
                  onChange={() => setShowRoadNames((v) => !v)}
                  className="w-4 h-4 accent-[#39B980] rounded cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 cursor-pointer select-none py-0.5">
                <span className="font-semibold text-[11.5px]">Bóng nắng 3D chân thực</span>
                <input
                  type="checkbox"
                  checked={shadowsOn}
                  onChange={() => setShadowsOn((v) => !v)}
                  className="w-4 h-4 accent-[#39B980] rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-[#E5DEC9]">
              <button
                type="button"
                onClick={() => zoomBy(0.62)}
                className="py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#E6F7EF] border border-[#403064]/30 font-extrabold text-[10.5px] text-[#2D2246] cursor-pointer"
              >
                Phóng +
              </button>
              <button
                type="button"
                onClick={() => zoomBy(1.6)}
                className="py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#E6F7EF] border border-[#403064]/30 font-extrabold text-[10.5px] text-[#2D2246] cursor-pointer"
              >
                Thu −
              </button>
              <button
                type="button"
                onClick={resetNorth}
                className="py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#E6F7EF] border border-[#403064]/30 font-extrabold text-[10.5px] text-[#2D2246] cursor-pointer"
              >
                Hướng Bắc
              </button>
              <button
                type="button"
                onClick={() =>
                  flyToCoordinates3D(XUANHOA_DEFAULT_CENTER.lat, XUANHOA_DEFAULT_CENTER.lng, 280)
                }
                className="py-1.5 rounded-xl bg-[#F8F5EE] hover:bg-[#E6F7EF] border border-[#403064]/30 font-extrabold text-[10.5px] text-[#2D2246] cursor-pointer"
              >
                Trung tâm
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col rounded-2xl bg-[#FFFDF9]/95 backdrop-blur-sm border border-[#403064]/85 shadow-[0_6px_20px_rgba(64,48,100,0.16)] overflow-hidden">
          <button
            type="button"
            onClick={() => {
              const eng = engineRef.current;
              if (eng?.origin) {
                const [lng, lat] = localToLngLat(
                  eng.origin,
                  eng.controls.target.x,
                  -eng.controls.target.z
                );
                const dist = eng.camera.position.distanceTo(eng.controls.target);
                const syncedZoom = distance3DToZoom2D(dist);
                onClose({ lat, lng }, syncedZoom);
              } else {
                onClose();
              }
            }}
            aria-label="Chuyển sang Bản đồ 2D"
            title="Chuyển sang Bản đồ 2D (đồng bộ tâm nhìn, zoom & công trình đang chọn)"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center font-black text-[11px] transition-all border-b border-[#E5DEC9] cursor-pointer bg-[#059669] hover:bg-[#047857] text-white"
          >
            2D
          </button>

          <button
            type="button"
            onClick={() => {
              onLocateUser?.();
              if (userCoords3DRef.current) {
                flyToCoordinates3D(userCoords3DRef.current.lat, userCoords3DRef.current.lng, 260);
              }
            }}
            aria-label="Định vị vị trí hiện tại của tôi"
            title="Định vị vị trí hiện tại của bạn (GPS)"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#1D7A52] hover:bg-[#E6F7EF] transition-colors border-b border-[#E5DEC9] cursor-pointer"
          >
            {isLocatingUser ? (
              <Loader2 size={15} className="animate-spin text-[#39B980]" />
            ) : (
              <LocateFixed size={15} className="text-[#39B980]" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              flyToCoordinates3D(XUANHOA_DEFAULT_CENTER.lat, XUANHOA_DEFAULT_CENTER.lng, 260)
            }
            aria-label="Trở về trung tâm Xuân Hòa (Trường ĐHSP Hà Nội 2)"
            title="Trở về trung tâm Xuân Hòa (Trường ĐH Sư Phạm Hà Nội 2)"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#0284C7] hover:bg-[#E0F2FE] transition-colors border-b border-[#E5DEC9] cursor-pointer"
          >
            <Compass size={15} />
          </button>

          <button
            type="button"
            onClick={() => setIs3DLayerMenuOpen((v) => !v)}
            aria-label="Tùy chỉnh lớp bản đồ 3D"
            title="Tùy chỉnh lớp bản đồ & Ánh sáng 3D"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-colors border-b border-[#E5DEC9] cursor-pointer"
            style={{
              backgroundColor: is3DLayerMenuOpen ? '#E6F7EF' : 'transparent',
              color: '#403064',
            }}
          >
            <Layers size={15} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (userHome) {
                flyToCoordinates3D(userHome.lat, userHome.lng, 185);
                setHome3DModalMode('view');
              } else {
                const eng = engineRef.current;
                let defaultLat = initialCenter.lat;
                let defaultLng = initialCenter.lng;
                if (eng?.origin) {
                  const [lng, lat] = localToLngLat(
                    eng.origin,
                    eng.controls.target.x,
                    -eng.controls.target.z
                  );
                  defaultLat = Number(lat.toFixed(6));
                  defaultLng = Number(lng.toFixed(6));
                }
                setHome3DLabelInput('Nhà của bạn');
                setHome3DAddressInput('Phường Xuân Hòa');
                setHome3DMapsInput('');
                setHome3DLatInput(String(userCoords?.lat ?? defaultLat));
                setHome3DLngInput(String(userCoords?.lng ?? defaultLng));
                setHome3DFeedback(null);
                setHome3DModalMode('edit');
              }
            }}
            aria-label="Chỗ bạn sinh sống (Nhà của bạn)"
            title={
              userHome
                ? `Đi tới ${userHome.label} (${userHome.address})`
                : 'Định vị chỗ bạn sinh sống (Nhà của bạn)'
            }
            className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-colors cursor-pointer ${
              userHome
                ? 'bg-[#FEF3C7] text-[#D97706] hover:bg-[#FDE68A]'
                : 'text-[#403064] hover:bg-[#E6F7EF]'
            }`}
          >
            <Home size={15} />
          </button>
        </div>
      </div>

      {/* HỘP THOẠI ĐỊNH VỊ & QUẢN LÝ "CHỖ BẠN SINH SỐNG (NHÀ CỦA BẠN)" TRÊN SA BÀN 3D */}
      {(home3DModalMode === 'view' || home3DModalMode === 'edit') && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#FFFDF9] border-2 border-[#403064] shadow-2xl overflow-hidden text-[#1E293B]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#FEF3C7]/85 border-b border-[#E5DEC9] flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-[#92400E] leading-snug">
                  {home3DModalMode === 'view' && userHome
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
                onClick={() => setHome3DModalMode('closed')}
                className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1ECE1] border border-[#E5DEC9] text-[#403064] text-xs font-extrabold cursor-pointer shrink-0"
              >
                Đóng
              </button>
            </div>

            {home3DModalMode === 'view' && userHome ? (
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
                  {onRouteToHome && (
                    <button
                      type="button"
                      onClick={() => {
                        setHome3DModalMode('closed');
                        onRouteToHome(userHome);
                      }}
                      className="col-span-3 py-2.5 px-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-xs shadow-xs cursor-pointer"
                    >
                      Chỉ đường về nhà bạn
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => flyToCoordinates3D(userHome.lat, userHome.lng, 165)}
                    className="py-2 px-2.5 rounded-xl bg-[#F1ECE1] hover:bg-[#E5DEC9] text-[#403064] font-extrabold text-[11.5px] cursor-pointer"
                  >
                    Đứng tại nhà
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHome3DLabelInput(userHome.label || 'Nhà của bạn');
                      setHome3DAddressInput(userHome.address || 'Phường Xuân Hòa');
                      setHome3DMapsInput('');
                      setHome3DLatInput(String(userHome.lat));
                      setHome3DLngInput(String(userHome.lng));
                      setHome3DFeedback(null);
                      setHome3DModalMode('edit');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F59E0B] font-extrabold text-[11.5px] cursor-pointer"
                  >
                    Thay đổi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearUserHome?.();
                      setHome3DModalMode('closed');
                    }}
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
                  const lat = parseFloat(home3DLatInput);
                  const lng = parseFloat(home3DLngInput);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    setHome3DFeedback('Vui lòng chấm vị trí trên bản đồ 3D hoặc nhập tọa độ hợp lệ.');
                    return;
                  }
                  onSaveUserHome?.({
                    label: home3DLabelInput.trim() || 'Nhà của bạn',
                    address: home3DAddressInput.trim() || 'Phường Xuân Hòa',
                    lat,
                    lng,
                  });
                  flyToCoordinates3D(lat, lng, 185);
                  setHome3DModalMode('view');
                }}
                className="p-4 space-y-3 text-xs"
              >
                <div className="p-2.5 rounded-xl bg-[#FEF3C7]/60 border border-[#F59E0B]/60 text-[11px] font-semibold text-[#78350F] leading-snug">
                  Hãy định vị chỗ bạn đang sinh sống. Sau khi lưu, mỗi lần bấm biểu tượng ngôi nhà 🏠 bản đồ sẽ đứng đúng tại địa chỉ nhà bạn cho đến khi bạn thay đổi hoặc xóa.
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHome3DModalMode('picking')}
                    className="py-2 px-2.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold text-[11px] shadow-xs cursor-pointer"
                  >
                    Chấm vị trí nhà trên 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (userCoords) {
                        setHome3DLatInput(String(userCoords.lat));
                        setHome3DLngInput(String(userCoords.lng));
                        flyToCoordinates3D(userCoords.lat, userCoords.lng, 185);
                        setHome3DFeedback(
                          `Đã lấy theo GPS hiện tại (${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)})!`
                        );
                      } else {
                        onLocateUser?.();
                        setHome3DFeedback('Đang lấy tín hiệu GPS hiện tại của bạn...');
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
                      value={home3DLabelInput}
                      onChange={(e) => setHome3DLabelInput(e.target.value)}
                      placeholder="VD: Nhà của bạn, Phòng trọ..."
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-bold bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">
                      Địa chỉ / Số nhà / Ngõ
                    </label>
                    <input
                      type="text"
                      value={home3DAddressInput}
                      onChange={(e) => setHome3DAddressInput(e.target.value)}
                      placeholder="VD: Ngõ 29 Nguyễn Văn Linh, Xuân Hòa"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-semibold bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#475569] mb-1">
                    Dán link Google Maps / Plus Code
                  </label>
                  <input
                    type="text"
                    value={home3DMapsInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHome3DMapsInput(val);
                      const parsed = parseCoordinatesFromInputOrUrl(val);
                      if (parsed) {
                        setHome3DLatInput(String(parsed.lat));
                        setHome3DLngInput(String(parsed.lng));
                        flyToCoordinates3D(parsed.lat, parsed.lng, 185);
                        setHome3DFeedback(`Đã nhận tọa độ (${parsed.lat}, ${parsed.lng}) từ link Maps!`);
                      }
                    }}
                    placeholder="Dán link Google Maps hoặc tọa độ..."
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-medium bg-white text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-bold text-[#64748B] mb-0.5">
                      Vĩ độ (Lat)
                    </label>
                    <input
                      type="text"
                      value={home3DLatInput}
                      onChange={(e) => setHome3DLatInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-bold bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-[#64748B] mb-0.5">
                      Kinh độ (Lng)
                    </label>
                    <input
                      type="text"
                      value={home3DLngInput}
                      onChange={(e) => setHome3DLngInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-bold bg-white text-slate-800"
                    />
                  </div>
                </div>

                {home3DFeedback && (
                  <div className="p-2 rounded-xl bg-[#E6F7EF] text-[#047857] text-[11px] font-bold">
                    {home3DFeedback}
                  </div>
                )}

                <div className="pt-2 border-t border-[#E5DEC9] flex items-center justify-between gap-2">
                  {userHome ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClearUserHome?.();
                        setHome3DModalMode('closed');
                      }}
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
                      onClick={() => setHome3DModalMode(userHome ? 'view' : 'closed')}
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

      {/* Thông báo trạng thái lưu / cập nhật nhanh */}
      {isReady && !isEditingPlace && !isCreatingNew && liveState.message && (
        <div className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 max-w-[90vw] pointer-events-none">
          <div className="pointer-events-auto rounded-full bg-[#1E1633]/92 px-4 py-1.5 text-center text-[11.5px] font-semibold text-white shadow-lg backdrop-blur-md">
            {liveState.message}
          </div>
        </div>
      )}

      {/* Thẻ thông tin Địa danh / Quán đang chọn (Gọn gàng ở góc dưới trái, tối ưu cho Mobile) */}
      {selected && !isEditingPlace && !isCreatingNew && (
        <div className="absolute left-2.5 right-12 sm:right-auto bottom-12 sm:bottom-14 z-20 sm:w-[330px] rounded-2xl border border-[#403064]/80 bg-[#FFFDF9]/98 p-2.5 sm:p-3 text-[#2D2246] shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-md bg-[#E6F7EF] px-2 py-0.5 text-[10px] font-extrabold text-[#047857]">
                {MAP_CATEGORY_BY_ID[selected.category]?.label || 'Địa điểm công cộng'}
              </div>
              <div className="mt-1 text-[13.5px] sm:text-[14px] font-extrabold leading-snug text-[#1E1633]">
                {selected.name}
              </div>
              {selected.address && (
                <div className="mt-0.5 text-[11px] font-medium text-[#65587F] line-clamp-2">
                  {selected.address}
                </div>
              )}
              {selected.metadata?.subType && (
                <div className="mt-1 rounded-lg bg-[#F8F5EE] border border-[#E5DEC9] px-2 py-1 text-[10.5px] font-semibold text-[#403064] line-clamp-2">
                  {selected.metadata.subType}
                </div>
              )}
              {(selected.phone || selected.openHours) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] font-semibold text-[#334155]">
                  {selected.phone && (
                    <a
                      href={`tel:${selected.phone}`}
                      className="text-[#047857] hover:underline"
                    >
                      SĐT: {selected.phone}
                    </a>
                  )}
                  {selected.openHours && (
                    <span className="text-[#64748B]">
                      Giờ mở cửa: {selected.openHours}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleSavePlace && (
                <button
                  type="button"
                  onClick={() => onToggleSavePlace(selected)}
                  className={`rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold border transition cursor-pointer ${
                    savedPlaceIds.includes(selected.id)
                      ? 'bg-[#FEF3C7] text-[#B45309] border-[#F59E0B]'
                      : 'bg-white text-[#403064] border-[#403064]/30 hover:bg-[#FEF3C7]/60'
                  }`}
                >
                  {savedPlaceIds.includes(selected.id) ? '★ Đã lưu' : '☆ Lưu'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg bg-[#F1ECE1] px-2 py-0.5 text-xs font-bold text-[#403064] hover:bg-[#E5DEC9] cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {onDrawRouteToPlace && selected.lat !== null && selected.lng !== null && (
              <button
                type="button"
                onClick={() => {
                  onDrawRouteToPlace(selected, 'motorbike');
                  setSelected(null);
                }}
                className="flex-1 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] border border-[#403064] px-2.5 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
              >
                Bắt đầu chỉ đường
              </button>
            )}
            {selected.phone && (
              <a
                href={`tel:${selected.phone.replace(/[^0-9+]/g, '')}`}
                className="rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#3B82F6]/40 px-2.5 py-1.5 text-[11px] font-extrabold text-[#1D4ED8]"
              >
                Gọi điện
              </a>
            )}
            {onOpenPlace && selected.originalPlace && !isCivicLandmark(selected) && (
              <button
                type="button"
                onClick={() => onOpenPlace(selected)}
                className="rounded-xl bg-[#403064] hover:bg-[#2D2246] px-2.5 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
              >
                Thực đơn
              </button>
            )}
            {hasAdminAccess && (
              <button
                type="button"
                onClick={() => openEditForPlace(selected)}
                className="rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#F59E0B] px-2.5 py-1.5 text-[11px] font-extrabold text-[#92400E] cursor-pointer"
              >
                Sửa địa điểm
              </button>
            )}
          </div>
        </div>
      )}

      {/* Thẻ thông tin Công trình Master Building (Đồng bộ 100% ID, Footprint, Zone, DEM giữa 2D và 3D) */}
      {!selected && localSelectedBuilding && !isEditingPlace && !isCreatingNew && (
        <div className="absolute left-2.5 right-12 sm:right-auto bottom-12 sm:bottom-14 z-20 sm:w-[335px] rounded-2xl border border-[#403064]/80 bg-[#FFFDF9]/98 p-2.5 sm:p-3 text-[#2D2246] shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-extrabold text-[#B45309]">
                  Master ID: {localSelectedBuilding.id}
                </span>
                <span className="inline-flex items-center rounded-md bg-[#E6F7EF] px-2 py-0.5 text-[10px] font-bold text-[#047857]">
                  {CONTEXTUAL_ZONE_LABELS[localSelectedBuilding.zone] || localSelectedBuilding.zone}
                </span>
              </div>
              <div className="mt-1 text-[13px] sm:text-[13.5px] font-extrabold leading-snug text-[#1E1633]">
                {localSelectedBuilding.name ||
                  `Công trình ${localSelectedBuilding.buildingType.toUpperCase()} (${Math.round(localSelectedBuilding.areaSqm)} m²)`}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-xl bg-[#F8F5EE] border border-[#E5DEC9] p-2 text-[10.5px]">
                <div>
                  <span className="text-[#64748B] font-semibold">Chiều cao / Tầng:</span>
                  <div className="font-extrabold text-[#1E1633]">
                    {localSelectedBuilding.height.toFixed(1)} m · {localSelectedBuilding.levels} tầng
                  </div>
                </div>
                <div>
                  <span className="text-[#64748B] font-semibold">Độ cao nền DEM:</span>
                  <div className="font-extrabold text-[#047857]">
                    {getElevationAtLngLat(
                      localSelectedBuilding.centroidLngLat[0],
                      localSelectedBuilding.centroidLngLat[1]
                    ).toFixed(1)}{' '}
                    m (ASL:{' '}
                    {(
                      22 +
                      getElevationAtLngLat(
                        localSelectedBuilding.centroidLngLat[0],
                        localSelectedBuilding.centroidLngLat[1]
                      )
                    ).toFixed(1)}{' '}
                    m)
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[#64748B] font-semibold">Nguồn chiều cao: </span>
                  <span className="font-bold text-[#403064]">
                    {HEIGHT_SOURCE_LABELS[localSelectedBuilding.heightSource]} (tin cậy{' '}
                    {Math.round(localSelectedBuilding.confidence * 100)}%)
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSelectBuilding3D(null)}
              className="rounded-lg bg-[#F1ECE1] px-2 py-0.5 text-xs font-bold text-[#403064] hover:bg-[#E5DEC9] cursor-pointer shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* THANH ĐIỀU KHIỂN ADMIN / QUẢN LÝ MAPS ĐẶT GỌN Ở DƯỚI ĐÁY BẢN ĐỒ (Dễ bấm bằng ngón cái trên Mobile, không icon thừa) */}
      {hasAdminAccess ? (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 max-w-[96vw] pointer-events-auto">
          <div className="flex items-center gap-1 rounded-full bg-white/95 border border-amber-300 px-2 py-1 shadow-[0_6px_20px_rgba(15,23,42,0.12)] backdrop-blur-md whitespace-nowrap">
            <span className="text-[10.5px] font-extrabold text-amber-800 px-1.5">
              {isStrictSuperAdmin ? 'Admin' : 'Quản lý Maps'}
            </span>
            <button
              type="button"
              onClick={() => {
                openCreateNewModal();
                setIsPicking3DGround(true);
              }}
              className="rounded-full bg-[#403064] hover:bg-[#2D2246] text-white px-2.5 py-1 text-[10.5px] font-bold transition cursor-pointer"
              title="Chạm lên mặt đất 3D để chấm ghim vị trí mới"
            >
              Chấm 3D +
            </button>
            <button
              type="button"
              onClick={openCreateNewModal}
              className="rounded-full bg-[#059669] hover:bg-[#047857] text-white px-2.5 py-1 text-[10.5px] font-bold transition cursor-pointer"
            >
              Thêm mới
            </button>
            <button
              type="button"
              onClick={() => {
                if (selected) {
                  openEditForPlace(selected);
                } else if (placesWithCoords.length > 0) {
                  setSelected(placesWithCoords[0]);
                  openEditForPlace(placesWithCoords[0]);
                }
              }}
              className="rounded-full bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F59E0B] px-2.5 py-1 text-[10.5px] font-bold transition cursor-pointer"
            >
              Sửa địa điểm
            </button>
            {onOpenWebAdmin && (
              <button
                type="button"
                onClick={() => onOpenWebAdmin(selected?.id)}
                className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 text-[10.5px] font-bold cursor-pointer transition"
              >
                {isStrictSuperAdmin ? 'Quản trị' : 'Web Quản lý'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsLoginModalOpen(true)}
          className="absolute right-2.5 bottom-2.5 z-10 rounded-full bg-white/85 hover:bg-white border border-slate-300/80 px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-sm backdrop-blur-md cursor-pointer transition"
          title="Đăng nhập Quản trị viên"
        >
          Admin
        </button>
      )}

      {/* Khung Chỉnh sửa / Thêm mới Địa danh & Định vị trực tiếp trên 3D (Gọn gàng góc trái) */}
      {(isEditingPlace || isCreatingNew) && (
        <div className="absolute left-2.5 bottom-2.5 top-14 z-30 flex items-end pointer-events-none">
          <form
            onSubmit={handleSavePlaceEdit}
            className="pointer-events-auto w-[min(94vw,370px)] max-h-full overflow-y-auto rounded-2xl border-2 border-[#403064] bg-[#FFFDF9]/98 p-3 text-xs text-[#2D2246] shadow-2xl space-y-2 backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-2">
              <div>
                <span className="inline-flex items-center rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-extrabold text-[#92400E]">
                  {isCreatingNew ? 'THÊM ĐỊA DANH MỚI' : 'CHỈNH SỬA ĐỊA DANH & VỊ TRÍ'}
                </span>
                <h3 className="text-[13px] font-extrabold text-[#1E1633] mt-0.5">
                  {isCreatingNew ? 'Cắm địa điểm mới lên Bản đồ' : editName || 'Cập nhật địa danh'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditingPlace(false);
                  setIsCreatingNew(false);
                  setIsPicking3DGround(false);
                }}
                className="rounded-lg bg-[#F1ECE1] px-2 py-0.5 text-xs font-bold text-[#403064] cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#403064] mb-0.5">
                Tên địa danh / Cơ quan / Quán *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="VD: Trụ sở Hành chính KV Cao Minh..."
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1E293B] focus:border-[#059669] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-extrabold text-[#403064] mb-0.5">
                  Loại & Biểu tượng
                </label>
                <select
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(e.target.value as Exclude<MapCategoryKey, 'all' | 'game_asset'>)
                  }
                  className="w-full rounded-xl border border-[#CBD5E1] bg-white px-2 py-1.5 text-[11.5px] font-bold text-[#1E293B]"
                >
                  {EDITABLE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-[#403064] mb-0.5">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="VD: 0988..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1E293B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-extrabold text-[#403064] mb-0.5">
                  Địa chỉ hiển thị
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Số nhà, đường, khu vực..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1E293B]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-[#403064] mb-0.5">
                  Giờ mở cửa
                </label>
                <input
                  type="text"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  placeholder="07:30 - 17:30"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-white px-2 py-1.5 text-[11px] font-medium text-[#1E293B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#403064] mb-0.5">
                Mô tả chức năng / Ghi chú hiển thị
              </label>
              <input
                type="text"
                value={editTagline}
                onChange={(e) => setEditTagline(e.target.value)}
                placeholder="VD: Trụ sở làm việc mới / Điểm tiếp dân / Món đặc sản..."
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1E293B]"
              />
            </div>

            {/* Khung Định vị bằng Link Maps / Plus Code / Địa chỉ / Chấm trên 3D */}
            <div className="rounded-xl bg-[#F8F5EE] border border-[#E5DEC9] p-2.5 space-y-2">
              <label className="block text-[11px] font-extrabold text-[#1D7A52]">
                Định vị (Dán Link Google Maps, Plus Code hoặc gõ địa chỉ):
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={editMapsInput}
                  onChange={(e) => handleMapsInputChange(e.target.value)}
                  placeholder="Dán link Maps, mã 7PQ6+VFP hoặc tên đường..."
                  className="flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1E293B]"
                />
                <button
                  type="button"
                  onClick={handleSearchAddressIn3D}
                  disabled={isGeocoding}
                  className="rounded-lg bg-[#059669] hover:bg-[#047857] px-2.5 py-1.5 text-[11px] font-extrabold text-white cursor-pointer shrink-0"
                >
                  {isGeocoding ? 'Đang tìm...' : 'Tìm'}
                </button>
              </div>

              {geoSuggestions.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {geoSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setEditLat(String(s.lat));
                        setEditLng(String(s.lng));
                        flyToCoordinates3D(s.lat, s.lng, 250);
                      }}
                      className="w-full text-left rounded-lg bg-white hover:bg-[#E6F7EF] border border-[#CBD5E1] px-2 py-1 text-[10.5px] cursor-pointer"
                    >
                      <div className="font-bold text-[#1E293B] truncate">{s.displayName}</div>
                      <div className="font-mono text-[9.5px] text-[#047857]">
                        {s.lat}, {s.lng}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPicking3DGround((v) => !v)}
                  className={`flex-1 rounded-lg py-1.5 px-2 text-[11px] font-extrabold cursor-pointer transition ${
                    isPicking3DGround
                      ? 'bg-[#F59E0B] text-white shadow-inner'
                      : 'bg-[#403064] hover:bg-[#2D2246] text-white'
                  }`}
                >
                  {isPicking3DGround
                    ? 'Đang chờ bạn chạm lên mặt đất 3D...'
                    : 'Chấm vị trí trên mặt đất 3D'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <div>
                  <span className="text-[10px] font-bold text-[#64748B]">Vĩ độ (Lat)</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 font-mono text-[11px] font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#64748B]">Kinh độ (Lng)</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 font-mono text-[11px] font-bold"
                  />
                </div>
              </div>
            </div>

            {editNotice && (
              <div
                className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold ${
                  editNotice.isError
                    ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                    : 'bg-[#E6F7EF] text-[#047857] border border-[#A7F3D0]'
                }`}
              >
                {editNotice.text}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
              {!isCreatingNew && editId && (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={handleBlockPlace}
                    className="rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#F59E0B] px-2.5 py-1.5 text-[11px] font-bold text-[#92400E] cursor-pointer"
                    title="Block (tạm khóa) địa điểm này trên bản đồ"
                  >
                    Block
                  </button>
                  {isStrictSuperAdmin ? (
                    <button
                      type="button"
                      onClick={handleDeletePlace}
                      className="rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] px-2.5 py-1.5 text-[11px] font-bold text-[#991B1B] cursor-pointer"
                      title="Chỉ Admin mới có quyền xóa địa điểm khỏi bản đồ"
                    >
                      Xóa
                    </button>
                  ) : (
                    <span className="rounded-xl bg-[#F1F5F9] px-2 py-1.5 text-[10px] font-bold text-[#64748B]">
                      🔒 Xóa: Chỉ Admin
                    </span>
                  )}
                  {isOsmSeedSelected && (
                    <button
                      type="button"
                      onClick={handleRestoreDefault}
                      className="rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] px-2 py-1.5 text-[11px] font-bold text-[#475569] cursor-pointer"
                      title="Khôi phục về dữ liệu gốc"
                    >
                      Khôi phục gốc
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                {onOpenWebAdmin && editId && (
                  <button
                    type="button"
                    onClick={() => onOpenWebAdmin(editId)}
                    className="rounded-xl bg-[#F1ECE1] hover:bg-[#E5DEC9] px-2.5 py-1.5 text-[11px] font-bold text-[#403064] cursor-pointer"
                    title="Mở trong Web Admin"
                  >
                    Quản trị
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-xl bg-[#059669] hover:bg-[#047857] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-md cursor-pointer"
                >
                  {isStrictSuperAdmin ? 'Lưu cập nhật' : 'Lưu & Gửi Admin duyệt'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Đăng nhập nhanh quyền Admin ngay trên Sa Bàn 3D */}
      {isLoginModalOpen && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={handleAdminQuickLogin}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(90vw,340px)] rounded-2xl border-2 border-[#403064] bg-[#FFFDF9] p-4 text-xs text-[#2D2246] shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-sm text-[#1E1633]">
                Mở khóa Quản trị Bản đồ
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="rounded-lg bg-[#F1ECE1] px-2 py-0.5 text-xs font-bold text-[#403064] cursor-pointer"
              >
                Đóng
              </button>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Đăng nhập tài khoản Admin Xuân Hòa Có Gì để chỉnh sửa địa danh, đổi vị trí và thêm địa điểm mới.
            </p>
            <div>
              <label className="block font-bold mb-1">Tài khoản Admin (hoặc Mã Maps)</label>
              <input
                type="text"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="VD: admin"
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Mật khẩu</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="Nhập mật khẩu Admin..."
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold"
              />
            </div>
            {loginErr && (
              <div className="rounded-xl bg-[#FEF2F2] p-2 text-[11px] font-bold text-[#991B1B]">
                {loginErr}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="rounded-xl bg-[#F1ECE1] px-3 py-1.5 font-bold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#059669] px-4 py-1.5 font-extrabold text-white cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Thông báo gọn gàng khi đang vào Bản đồ số Phường Xuân Hòa (3D) */}
      {(!isReady || error) && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          {error ? (
            <div className="pointer-events-auto w-[min(88vw,320px)] rounded-2xl border border-[#EF4444] bg-[#FFFDF9] p-3.5 text-center shadow-xl">
              <div className="text-xs font-extrabold text-[#B91C1C]">Không mở được Bản đồ 3D</div>
              <div className="mt-1 text-[11px] font-medium text-[#2D2246]">{error}</div>
              <button
                type="button"
                onClick={() => onClose()}
                className="mt-2.5 rounded-xl bg-[#403064] px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
              >
                Quay lại bản đồ 2D
              </button>
            </div>
          ) : (
            <div className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1E1633]/94 text-white border border-[#39B980]/60 shadow-[0_10px_28px_rgba(15,23,42,0.22)] backdrop-blur-md text-[11.5px] font-extrabold whitespace-nowrap">
              <Loader2 size={14} className="animate-spin text-[#39B980] shrink-0" />
              <span>Đang vào Bản đồ số Phường Xuân Hòa ({progress.pct}%)</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        .city3d-pin[data-names="0"] .city3d-pin-name { display: none; }
        .city3d-pin:hover .city3d-pin-name,
        .city3d-pin[data-selected="1"] .city3d-pin-name { display: block !important; }
      `}</style>
    </div>
  );
};

export default City3DView;
