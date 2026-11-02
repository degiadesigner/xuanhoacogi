import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import {
  ArrowLeft,
  Bookmark,
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
  Navigation,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  ShieldCheck,
  Star,
  Sun,
  SunDim,
  Trash2,
  X,
} from 'lucide-react';
import type { MapCategoryKey, PlaceLocation } from '@/lib/map/map-types';
import { MAP_CATEGORIES, MAP_CATEGORY_BY_ID } from '@/lib/map/map-categories';
import {
  doesPlaceMatchQuickFilter,
  getPlaceTaxonomyMeta,
  isDefaultVisibleMapLandmark,
  renderRegistryIcon,
} from '@/lib/map/map-category-registry';
import { MapQuickCategoryBar } from '@/components/map/MapQuickCategoryBar';
import { XUANHOA_DEFAULT_CENTER } from '@/lib/map/map-config';
import {
  calculateDistanceAndEta,
  evaluatePlaceOpenStatus,
  findSuggestedRoadForAddress,
  geocodeAddressWithNominatim,
  getAllMapPlaceLocations,
  blockLandmarkOrPlaceFromMap,
  unpinLandmarkOrPlaceFromMap,
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
import { FastOpeningHoursInput } from '@/components/map/FastOpeningHoursInput';
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
import { createIconicLandmarksGroup, syncIconicLandmarksGroup } from './city3d-landmarks';
import {
  SKY,
  createSkyDome,
  patchBuildingMaterial,
  patchCrownMaterial,
  patchFlatMaterial,
  type FlatKind,
} from './city3d-materials';
import { evaluatePoiPriority, POI_PRIORITY } from '@/lib/map/poi-priority';
import {
  POI_LOD_CONFIG,
  computeSpatialPoiClusters,
  type PoiClusterItem,
} from '@/lib/map/poi-lod';
import {
  LANDMARK_BINDINGS_SYNC_EVENT,
  computeCornerSnapAlignment,
  computeThreePointAlignment,
  getLandmarkEditAnchors,
  getOrCreateLandmarkBindingForPlace,
  type LandmarkBindingRecord,
} from '@/lib/map/landmark-bindings';
import {
  LandmarkAdminControls,
  type DirectEditSubTool,
} from '@/components/map/LandmarkAdminControls';
import {
  ROAD_OVERRIDES_UPDATED_EVENT,
  applyRoadOverridesToGeoJSONFeatures,
  auditAllRoadRecords,
  build3DRoadLabelsFromRecords,
  buildUnifiedSearchableRoads,
  findNearestRoadAtLngLat,
  formatRoadLabelForZoom,
  mergeAdminRoadSegments,
  type RoadAuditIssue,
  type RoadRecord,
} from '@/lib/map/xuanhoa-road-overrides';
import { AdminRoadEditorPanel } from '@/components/map/AdminRoadEditorPanel';
import type { RoadSearchResult } from '@/lib/map/map-types';

let cachedRawRoads3D: any[] | null = null;
let rawRoads3DPromise: Promise<any[]> | null = null;

async function ensureRawRoads3DLoaded(): Promise<any[]> {
  if (cachedRawRoads3D) return cachedRawRoads3D;
  if (rawRoads3DPromise) return rawRoads3DPromise;
  const p = fetch('/geo/xuanhoa-roads.geojson')
    .then((r) => (r.ok ? r.json() : { features: [] }))
    .then((gj) => {
      const arr: any[] = Array.isArray(gj?.features) ? gj.features : [];
      cachedRawRoads3D = arr;
      return arr;
    })
    .catch(() => [] as any[])
    .finally(() => {
      rawRoads3DPromise = null;
    });
  rawRoads3DPromise = p;
  return p;
}

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
  activeQuickFilter?: string | null;
  onChangeQuickFilter?: (filterId: string | null) => void;
  /** Mở thẳng chế độ Direct Edit 3D từ bản đồ 2D */
  initialAdminLandmarkMode?: 'mode_a_place' | 'mode_b_model' | null;
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
  priority: number;
  maxIconDist: number;
  maxLabelDist: number;
  isLandmark: boolean;
}

interface PrecomputedCluster3D {
  cluster: PoiClusterItem;
  lx: number;
  ly: number;
  lz: number;
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
  activeQuickFilter = null,
  onChangeQuickFilter,
  initialAdminLandmarkMode = null,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const compassIconRef = useRef<SVGSVGElement | null>(null);
  const pinElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const clusterElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const labelElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const roadLabelElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const draftMarkerElRef = useRef<HTMLDivElement | null>(null);
  const userMarker3DElRef = useRef<HTMLDivElement | null>(null);
  const homeMarker3DElRef = useRef<HTMLDivElement | null>(null);
  const routeGroupRef = useRef<THREE.Group | null>(null);
  const selectedBuildingGroupRef = useRef<THREE.Group | null>(null);
  const iconicLandmarksGroupRef = useRef<THREE.Group | null>(null);
  const [adminLandmarkMode3D, setAdminLandmarkMode3D] = useState<'mode_a_place' | 'mode_b_model' | null>(
    initialAdminLandmarkMode
  );
  useEffect(() => {
    if (initialAdminLandmarkMode) setAdminLandmarkMode3D(initialAdminLandmarkMode);
  }, [initialAdminLandmarkMode]);
  const [directEditSubTool, setDirectEditSubTool] = useState<DirectEditSubTool>('translate');
  const [rotateSnapDeg, setRotateSnapDeg] = useState<number>(0);
  const [threePointState, setThreePointState] = useState<{
    pointA: [number, number] | null;
    pointB: [number, number] | null;
    pointC: [number, number] | null;
  }>({ pointA: null, pointB: null, pointC: null });
  const [showAdvancedCoords3D, setShowAdvancedCoords3D] = useState(false);
  const pickSnapshotCoordsRef = useRef<{ lat: string; lng: string } | null>(null);
  const [pendingMoveCoords3D, setPendingMoveCoords3D] = useState<{ lat: number; lng: number } | null>(null);
  const [previewBindingPatch3D, setPreviewBindingPatch3D] = useState<Partial<LandmarkBindingRecord> | null>(null);
  const [landmarkBindingsTick, setLandmarkBindingsTick] = useState(0);
  const [hoveredPinId3D, setHoveredPinId3D] = useState<string | null>(null);
  const hoveredPinId3DRef = useRef<string | null>(null);
  hoveredPinId3DRef.current = hoveredPinId3D;
  const adminLandmarkMode3DRef = useRef<'mode_a_place' | 'mode_b_model' | null>(null);
  adminLandmarkMode3DRef.current = adminLandmarkMode3D;
  const directEditSubToolRef = useRef<DirectEditSubTool>('translate');
  directEditSubToolRef.current = directEditSubTool;
  const rotateSnapDegRef = useRef<number>(0);
  rotateSnapDegRef.current = rotateSnapDeg;
  const threePointStateRef = useRef(threePointState);
  threePointStateRef.current = threePointState;
  const pendingMoveCoords3DRef = useRef<{ lat: number; lng: number } | null>(null);
  pendingMoveCoords3DRef.current = pendingMoveCoords3D;
  const previewBindingPatch3DRef = useRef<Partial<LandmarkBindingRecord> | null>(null);
  previewBindingPatch3DRef.current = previewBindingPatch3D;
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
  const [editHoursError, setEditHoursError] = useState<string | null>(null);
  const [isSavingPlace3D, setIsSavingPlace3D] = useState(false);
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

  // Chế độ Admin Chỉnh Đường / Ngõ trên Sa bàn 3D (dùng chung Store với 2D)
  const [isRoadEditor3DOpen, setIsRoadEditor3DOpen] = useState<boolean>(false);
  const isRoadEditor3DOpenRef = useRef<boolean>(false);
  isRoadEditor3DOpenRef.current = isRoadEditor3DOpen;
  const [selectedRoad3D, setSelectedRoad3D] = useState<RoadRecord | null>(null);
  const selectedRoad3DRef = useRef<RoadRecord | null>(null);
  selectedRoad3DRef.current = selectedRoad3D;
  const [isDrawingRoad3D, setIsDrawingRoad3D] = useState<boolean>(false);
  const isDrawingRoad3DRef = useRef<boolean>(false);
  isDrawingRoad3DRef.current = isDrawingRoad3D;
  const [roadDrawingPoints3D, setRoadDrawingPoints3D] = useState<[number, number][]>([]);
  const roadDrawingPoints3DRef = useRef<[number, number][]>([]);
  roadDrawingPoints3DRef.current = roadDrawingPoints3D;
  const [isRedrawingExisting3D, setIsRedrawingExisting3D] = useState<boolean>(false);
  const [isMergingSecondRoad3D, setIsMergingSecondRoad3D] = useState<boolean>(false);
  const isMergingSecondRoad3DRef = useRef<boolean>(false);
  isMergingSecondRoad3DRef.current = isMergingSecondRoad3D;
  const [roadAuditIssues3D, setRoadAuditIssues3D] = useState<RoadAuditIssue[]>([]);
  const [searchableRoads3D, setSearchableRoads3D] = useState<RoadSearchResult[]>(
    VERIFIED_OSM_ROADS_SEED
  );
  const roadRecords3DRef = useRef<Map<string, RoadRecord>>(new Map());
  const customRoads3DGroupRef = useRef<THREE.Group | null>(null);
  const hasAdminAccessRef = useRef<boolean>(hasAdminAccess);
  hasAdminAccessRef.current = hasAdminAccess;

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
      if (activeRoute?.targetPlace.id === p.id) return true;
      if (!showLocationPins) return false;
      if (savedPlaceIds.includes(p.id)) return true;
      if (!activeQuickFilter) {
        return isDefaultVisibleMapLandmark(p);
      }
      return doesPlaceMatchQuickFilter(p, activeQuickFilter);
    });
    logMapDebug('3D MARKER UPDATE', {
      inputPlaces: places.length,
      visiblePins3D: filtered.length,
      activeQuickFilter,
    });
    return filtered;
  }, [
    places,
    showLocationPins,
    savedPlaceIds,
    selected?.id,
    activeRoute?.targetPlace.id,
    activeQuickFilter,
  ]);

  // Tiền tính toán tọa độ local (lx, lz), độ ưu tiên (POI Priority) và ngưỡng LOD 3D cho mọi ghim (Phần 3, 4, 7)
  const precomputedPins = useMemo<PrecomputedPin[]>(() => {
    if (!originState) return [];
    const list: PrecomputedPin[] = [];
    const routeTargetId = activeRoute?.targetPlace.id ?? null;

    for (const p of placesWithCoords) {
      // Nếu Admin đang kéo thử vị trí mới ở Mode A cho địa danh này, hiển thị ghim ngay tại vị trí mới
      const isPreviewingMove =
        adminLandmarkMode3D === 'mode_a_place' &&
        selected?.id === p.id &&
        pendingMoveCoords3D !== null;
      const effLat = isPreviewingMove ? pendingMoveCoords3D!.lat : p.lat;
      const effLng = isPreviewingMove ? pendingMoveCoords3D!.lng : p.lng;
      if (effLat === null || effLng === null) continue;

      const [x, y] = lngLatToLocal(originState, effLng, effLat);
      const terrainY = getElevationAtLngLat(effLng, effLat);
      const lizardHillY = getLizardHillElevationAtLngLat(effLng, effLat);
      const monumentBoost =
        p.id === 'osm_historic_bot_than_lan'
          ? 12.5
          : p.id === 'osm_landmark_nui_than_lan'
            ? 10.0
            : lizardHillY > 0.5
              ? 6.0
              : 0;

      const evalPrio = evaluatePoiPriority({
        place: p,
        selectedPlaceId: selected?.id ?? null,
        hoveredPlaceId: hoveredPinId3D,
        routeTargetId,
      });

      const catThresh =
        POI_LOD_CONFIG.categoryThresholds[p.category] ||
        POI_LOD_CONFIG.categoryThresholds.food;

      let maxIconDist = catThresh.maxDist3D;
      let maxLabelDist = catThresh.labelMaxDist3D;

      if (evalPrio.priority >= POI_PRIORITY.ROUTE_TARGET) {
        maxIconDist = 9000;
        maxLabelDist = 9000;
      } else if (evalPrio.isSpecialLandmark) {
        maxIconDist = 3400;
        maxLabelDist = 2200;
      } else if (evalPrio.isMajorCivic) {
        maxIconDist = 2100;
        maxLabelDist = 1250;
      } else if (evalPrio.isLandmark) {
        maxIconDist = 1350;
        maxLabelDist = 820;
      } else if (evalPrio.priority >= POI_PRIORITY.SHOP_FEATURED) {
        maxIconDist = 880;
        maxLabelDist = 420;
      }

      list.push({
        place: p,
        lx: x,
        ly: 6 + terrainY + monumentBoost,
        lz: -y,
        halfW: Math.min(82, p.name.length * 3.1 + 16),
        priority: evalPrio.priority,
        maxIconDist,
        maxLabelDist,
        isLandmark: evalPrio.isLandmark,
      });
    }

    // Sắp xếp theo `priority` giảm dần để đối tượng ưu tiên cao (Selected, Route, Landmark) luôn thắng khi xét chống đè nhãn (Phần 7)
    list.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.place.id.localeCompare(b.place.id);
    });
    return list;
  }, [
    placesWithCoords,
    originState,
    selected?.id,
    activeRoute?.targetPlace.id,
    hoveredPinId3D,
    adminLandmarkMode3D,
    pendingMoveCoords3D,
    demReadyTick,
  ]);

  // Tính toán các Cụm POI (Category Clusters / Neutral Clusters) cho tầm nhìn xa & trung cảnh trên 3D (Phần 5 & 6)
  const precomputedClusters3D = useMemo<PrecomputedCluster3D[]>(() => {
    if (!originState) return [];
    const { clusters } = computeSpatialPoiClusters({
      places: placesWithCoords,
      mapMode: '3d',
      zoomOrCameraDistance: 920,
      selectedPlaceId: selected?.id ?? null,
      routeTargetId: activeRoute?.targetPlace.id ?? null,
      activeCategoryFilter: activeQuickFilter,
    });
    return clusters.map((c) => {
      const [x, y] = lngLatToLocal(originState, c.lng, c.lat);
      const terrainY = getElevationAtLngLat(c.lng, c.lat);
      return {
        cluster: c,
        lx: x,
        ly: 8 + terrainY,
        lz: -y,
      };
    });
  }, [placesWithCoords, originState, selected?.id, activeRoute?.targetPlace.id, activeQuickFilter, demReadyTick]);

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
  const clusters3DRef = useRef<PrecomputedCluster3D[]>(precomputedClusters3D);
  clusters3DRef.current = precomputedClusters3D;
  const bLabelsRef = useRef<PrecomputedBuildingLabel[]>(precomputedBuildingLabels);
  bLabelsRef.current = precomputedBuildingLabels;
  const rLabelsRef = useRef<PrecomputedRoadLabel[]>(precomputedRoadLabels);
  rLabelsRef.current = precomputedRoadLabels;
  const selectedPlaceRef = useRef<PlaceLocation | null>(selected);
  selectedPlaceRef.current = selected;

  // Lắng nghe sự kiện đồng bộ Landmark Bindings từ Admin (Phần 48)
  useEffect(() => {
    const onBindingSync = () => setLandmarkBindingsTick((t) => t + 1);
    window.addEventListener(LANDMARK_BINDINGS_SYNC_EVENT, onBindingSync);
    window.addEventListener('xuanhoa_admin_sync', onBindingSync);
    return () => {
      window.removeEventListener(LANDMARK_BINDINGS_SYNC_EVENT, onBindingSync);
      window.removeEventListener('xuanhoa_admin_sync', onBindingSync);
    };
  }, []);

  // Đồng bộ tức thì dữ liệu Đường / Ngõ / Ngách & Nhãn 3D từ Store chung (không cần reload trang hay khởi động lại Worker 3D)
  const rebuild3DRoadsFromOverrides = useCallback(() => {
    if (!originState) return;
    ensureRawRoads3DLoaded().then((rawFeatures) => {
      const { recordsById } = applyRoadOverridesToGeoJSONFeatures(rawFeatures);
      roadRecords3DRef.current = recordsById;
      const nextLabels3D = build3DRoadLabelsFromRecords(
        recordsById,
        originState,
        getElevationAtLocal
      );
      setRoadLabels(nextLabels3D);
      setSearchableRoads3D(buildUnifiedSearchableRoads(recordsById, VERIFIED_OSM_ROADS_SEED));
      setRoadAuditIssues3D(auditAllRoadRecords(recordsById));
      const curSelId = selectedRoad3DRef.current?.roadId;
      if (curSelId) {
        const updatedSel = recordsById.get(curSelId) || null;
        setSelectedRoad3D(updatedSel);
        selectedRoad3DRef.current = updatedSel;
      }
      engineRef.current?.requestRender();
    });
  }, [originState]);

  useEffect(() => {
    if (!originState) return;
    rebuild3DRoadsFromOverrides();
  }, [originState, demReadyTick, rebuild3DRoadsFromOverrides]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRoadOverrideSync = () => rebuild3DRoadsFromOverrides();
    window.addEventListener(ROAD_OVERRIDES_UPDATED_EVENT, onRoadOverrideSync);
    return () => {
      window.removeEventListener(ROAD_OVERRIDES_UPDATED_EVENT, onRoadOverrideSync);
    };
  }, [rebuild3DRoadsFromOverrides]);

  // Vẽ đoạn đường đang chọn / polyline vẽ ngõ A → B → C trực tiếp trên mặt đất 3D
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !originState) return;
    const scene = eng.scene;
    if (customRoads3DGroupRef.current) {
      scene.remove(customRoads3DGroupRef.current);
      customRoads3DGroupRef.current = null;
    }
    if (!isRoadEditor3DOpen) {
      eng.requestRender();
      return;
    }
    const group = new THREE.Group();
    group.name = 'AdminRoadEditor3DOverlay';

    if (selectedRoad3D && selectedRoad3D.geometry && selectedRoad3D.geometry.length >= 2) {
      const pts: THREE.Vector3[] = [];
      for (const [lng, lat] of selectedRoad3D.geometry) {
        const [lx, ly] = lngLatToLocal(originState, lng, lat);
        const ty = getElevationAtLocal(lx, ly);
        pts.push(new THREE.Vector3(lx, ty + 0.65, -ly));
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 3 });
      group.add(new THREE.Line(lineGeo, lineMat));
    }

    if (isDrawingRoad3D && roadDrawingPoints3D.length >= 1) {
      const pts: THREE.Vector3[] = [];
      const dotGeo = new THREE.SphereGeometry(1.8, 12, 12);
      const dotMatStart = new THREE.MeshBasicMaterial({ color: 0x059669 });
      const dotMatNext = new THREE.MeshBasicMaterial({ color: 0x2563eb });
      roadDrawingPoints3D.forEach(([lng, lat], idx) => {
        const [lx, ly] = lngLatToLocal(originState, lng, lat);
        const ty = getElevationAtLocal(lx, ly);
        const v = new THREE.Vector3(lx, ty + 0.85, -ly);
        pts.push(v);
        const dot = new THREE.Mesh(dotGeo, idx === 0 ? dotMatStart : dotMatNext);
        dot.position.copy(v);
        group.add(dot);
      });
      if (pts.length >= 2) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 3 });
        group.add(new THREE.Line(lineGeo, lineMat));
      }
    }

    scene.add(group);
    customRoads3DGroupRef.current = group;
    eng.requestRender();
  }, [
    originState,
    isRoadEditor3DOpen,
    selectedRoad3D,
    isDrawingRoad3D,
    roadDrawingPoints3D,
  ]);

  // Khi chuyển qua địa điểm khác, đóng chế độ thử nghiệm chưa lưu của địa điểm cũ
  useEffect(() => {
    setPendingMoveCoords3D(null);
    setPreviewBindingPatch3D(null);
    setThreePointState({ pointA: null, pointB: null, pointC: null });
    setDirectEditSubTool('translate');
  }, [selected?.id]);

  // Đồng bộ tức thì vị trí / hướng xoay / tỷ lệ & Gizmo của toàn bộ mô hình Landmark 3D theo Place & Binding (Phần 13, 21, 24, 48)
  useEffect(() => {
    if (!iconicLandmarksGroupRef.current || !originState) return;
    syncIconicLandmarksGroup({
      rootGroup: iconicLandmarksGroupRef.current,
      origin: originState,
      places,
      masterDataset: getLoadedMasterDataset(),
      adminEditState:
        hasAdminAccess && selected && adminLandmarkMode3D
          ? {
              activePlaceId: selected.id,
              mode: adminLandmarkMode3D,
              subTool: directEditSubTool,
              previewPlaceLatLng: pendingMoveCoords3D,
              previewBindingPatch: previewBindingPatch3D,
              threePointWorld: [
                threePointState.pointA,
                threePointState.pointB,
                threePointState.pointC,
              ]
                .filter((pt): pt is [number, number] => Boolean(pt))
                .map(([px, pz]) => ({
                  x: px,
                  y: getElevationAtLocal(px, -pz),
                  z: pz,
                })),
            }
          : null,
    });
    engineRef.current?.invalidateShadow();
    engineRef.current?.requestRender();
  }, [
    originState,
    places,
    demReadyTick,
    landmarkBindingsTick,
    hasAdminAccess,
    selected?.id,
    adminLandmarkMode3D,
    pendingMoveCoords3D,
    previewBindingPatch3D,
    threePointState,
  ]);

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
    renderer.toneMappingExposure = 0.96;
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

    // Ánh sáng Giai đoạn 2 (Soft Daylight Pastel): trời xanh sáng dịu + nắng ấm chiếu xiên + phản xạ đất kem ấm
    scene.add(new THREE.AmbientLight(0xfffcf5, 0.26));
    scene.add(new THREE.HemisphereLight(0xd4ebff, 0xc7bea8, 1.18));
    const sun = new THREE.DirectionalLight(0xfff1d6, 3.25);
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

    const perturbIcosahedron = (geo: THREE.BufferGeometry, amp = 0.22) => {
      const p = geo.attributes.position as THREE.BufferAttribute;
      const seen = new Map<string, number>();
      for (let i = 0; i < p.count; i++) {
        const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        let f = seen.get(k);
        if (f === undefined) {
          f = (1 - amp * 0.5) + (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1 * amp;
          seen.set(k, f);
        }
        p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * (p.getY(i) < 0 ? 0.72 : 1), p.getZ(i) * f);
      }
      geo.computeVertexNormals();
    };

    // 7 hình học cây xanh InstancedMesh (Section K):
    // 0. broadleaf_street
    const crownGeo = new THREE.IcosahedronGeometry(1, 0);
    perturbIcosahedron(crownGeo, 0.24);
    crownGeo.scale(2.9, 2.5, 2.9);
    crownGeo.translate(0, 4.5, 0);

    // 1. conifer
    const coniferGeo = new THREE.ConeGeometry(2.05, 6.5, 6);
    coniferGeo.translate(0, 5.1, 0);

    // 2. broadleaf_large (cổ thụ tán rộng công viên / quảng trường)
    const broadleafLargeGeo = new THREE.IcosahedronGeometry(1, 1);
    perturbIcosahedron(broadleafLargeGeo, 0.18);
    broadleafLargeGeo.scale(3.6, 2.7, 3.6);
    broadleafLargeGeo.translate(0, 4.9, 0);

    // 3. campus_tree (cây hàng lối khuôn viên ĐHSP Hà Nội 2 / trường học)
    const campusTreeGeo = new THREE.DodecahedronGeometry(1, 0);
    campusTreeGeo.scale(2.5, 3.1, 2.5);
    campusTreeGeo.translate(0, 4.7, 0);

    // 4. forest_tree (cây rừng tự nhiên ven đồi)
    const forestTreeGeo = new THREE.ConeGeometry(2.5, 5.8, 7);
    forestTreeGeo.translate(0, 4.8, 0);

    // 5. resort_ornamental (cây cảnh quan ven hồ Đại Lải / resort)
    const resortOrnamentalGeo = new THREE.OctahedronGeometry(1, 1);
    resortOrnamentalGeo.scale(2.6, 2.2, 2.6);
    resortOrnamentalGeo.translate(0, 4.3, 0);

    // 6. shrub_low (bụi cây thấp / tiểu cảnh sân vườn)
    const shrubLowGeo = new THREE.IcosahedronGeometry(1, 0);
    perturbIcosahedron(shrubLowGeo, 0.16);
    shrubLowGeo.scale(1.8, 1.25, 1.8);
    shrubLowGeo.translate(0, 1.1, 0);

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
      broadleafLargeGeo,
      campusTreeGeo,
      forestTreeGeo,
      resortOrnamentalGeo,
      shrubLowGeo,
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

      // 1. Ghim địa danh & quán ăn (Hệ thống POI Priority + LOD 3D — Phần 1, 2, 3, 4, 7)
      const pins = pinsRef.current;
      const isClusteringDist = dist > POI_LOD_CONFIG.map3D.clusterMinDistance;
      const curHoveredId = hoveredPinId3DRef.current;
      const curRouteTargetId = activeRoute3DRef.current?.targetPlace.id;

      for (let i = 0; i < pins.length; i++) {
        const item = pins[i];
        const el = pinElsRef.current.get(item.place.id);
        if (!el) continue;

        const isSel = el.dataset.selected === '1';
        const isHovered = curHoveredId === item.place.id;
        const isRouteTarget = curRouteTargetId === item.place.id;
        const isHighPriority = isSel || isHovered || isRouteTarget;

        // Khi zoom xa (> 560m), các quán thường được gom vào Cluster 3D để bản đồ sạch & sang (Phần 1, 4, 5)
        if (!isHighPriority && isClusteringDist && !item.isLandmark && item.priority < POI_PRIORITY.SHOP_FEATURED) {
          setElVis(el, false);
          continue;
        }

        tmpV.set(item.lx, item.ly, item.lz);
        const pinCamDist = tmpV.distanceTo(camera.position);
        if (!isHighPriority && pinCamDist > item.maxIconDist) {
          setElVis(el, false);
          continue;
        }

        tmpV.project(camera);
        if (tmpV.z > 1 || tmpV.x < -1.12 || tmpV.x > 1.12 || tmpV.y < -1.12 || tmpV.y > 1.12) {
          setElVis(el, false);
          continue;
        }

        const sx = (tmpV.x * 0.5 + 0.5) * w;
        const sy = (-tmpV.y * 0.5 + 0.5) * h;

        // Phần 2: Quán bình thường ở zoom trung chỉ hiện icon tròn gọn, chỉ hiện tên khi zoom đủ gần / selected / hover
        const showPinLabel =
          isHighPriority ||
          (pinCamDist <= item.maxLabelDist && (dist < 1450 || item.priority >= POI_PRIORITY.LANDMARK_SPECIAL));
        const pinNameFlag = showPinLabel ? '1' : '0';
        const hw = showPinLabel ? item.halfW : 16;

        if (!canPlaceBox(sx - hw, sy - (showPinLabel ? 46 : 30), sx + hw, sy + 4, w, h, isSel)) {
          setElVis(el, false);
          continue;
        }
        setElVis(el, true);
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        if (el.dataset.names !== pinNameFlag) {
          el.dataset.names = pinNameFlag;
        }
      }

      // 1b. Cụm POI Cluster 3D khi nhìn xa / trung cảnh (Phần 5 & 6)
      const clusters3D = clusters3DRef.current;
      const showClustersNow = showLocationPinsRef.current && isClusteringDist;
      for (let i = 0; i < clusters3D.length; i++) {
        const cItem = clusters3D[i];
        const cEl = clusterElsRef.current.get(cItem.cluster.id);
        if (!cEl) continue;
        if (!showClustersNow) {
          setElVis(cEl, false);
          continue;
        }
        tmpV.set(cItem.lx, cItem.ly, cItem.lz);
        if (tmpV.distanceTo(camera.position) > 2900) {
          setElVis(cEl, false);
          continue;
        }
        tmpV.project(camera);
        if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.08 || Math.abs(tmpV.y) > 1.08) {
          setElVis(cEl, false);
          continue;
        }
        const sx = (tmpV.x * 0.5 + 0.5) * w;
        const sy = (-tmpV.y * 0.5 + 0.5) * h;
        if (!canPlaceBox(sx - 28, sy - 28, sx + 28, sy + 6, w, h)) {
          setElVis(cEl, false);
          continue;
        }
        setElVis(cEl, true);
        cEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
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

      // 3. Nhãn tên đường (ràng buộc theo roadId + hiển thị tên rút gọn/đầy đủ theo khoảng cách camera)
      const showRoads = showRoadNamesRef.current && dist < 2600;
      const rLabels = rLabelsRef.current;
      const selRoadId3D = selectedRoad3DRef.current?.roadId || '';
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
        const camDist = tmpV.distanceTo(camera.position);
        const isSelRoad = Boolean(selRoadId3D && rl.roadId === selRoadId3D);
        if (!isSelRoad && camDist > item.maxDist) {
          setElVis(el, false);
          continue;
        }
        const displayText = formatRoadLabelForZoom({
          name: rl.name,
          roadType:
            (rl.roadType as any) ||
            (rl.tier === 'alley' ? 'alley' : rl.tier === 'major' ? 'road' : 'street'),
          verificationStatus: (rl.verificationStatus as any) || 'verified',
          nameSource: (rl.nameSource as any) || 'osm',
          segmentLengthM: rl.segmentLengthM || 80,
          cameraDistM: camDist,
          isSelectedOrHighlighted: isSelRoad,
        });
        if (!displayText) {
          setElVis(el, false);
          continue;
        }
        if (el.textContent !== displayText) {
          el.textContent = displayText;
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
        const hw =
          displayText === rl.name ? item.halfW : Math.max(18, displayText.length * 3.1 + 10);
        if (!canPlaceBox(sx - hw, sy - 12, sx + hw, sy + 12, w, h, isSelRoad)) {
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

    // Hỗ trợ Admin kéo/xoay/scale trực tiếp mô hình 3D (Direct Edit Mode B), kéo địa danh (Mode A) hoặc chấm tọa độ trên mặt đất 3D
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const hitPoint = new THREE.Vector3();
    let downX = 0;
    let downY = 0;

    type DirectDragSession =
      | {
          kind: 'translate';
          grabDx: number;
          grabDz: number;
          anchorX: number;
          anchorZ: number;
          baseBind: LandmarkBindingRecord;
        }
      | {
          kind: 'rotate';
          startAngle: number;
          startRotationY: number;
          modelX: number;
          modelZ: number;
          baseBind: LandmarkBindingRecord;
        }
      | {
          kind: 'scale';
          startDist: number;
          startScale: number;
          modelX: number;
          modelZ: number;
          baseBind: LandmarkBindingRecord;
        }
      | {
          kind: 'move_place';
          grabDx: number;
          grabDz: number;
        };

    let activeDirectDrag: DirectDragSession | null = null;

    const intersectGroundAtEvent = (ev: PointerEvent, outPt: THREE.Vector3): boolean => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      let planeY = controls.target.y;
      GROUND_PLANE.constant = -planeY;
      if (!raycaster.ray.intersectPlane(GROUND_PLANE, outPt)) {
        GROUND_PLANE.constant = 0;
        return false;
      }
      for (let iter = 0; iter < 3; iter++) {
        planeY = getElevationAtLocal(outPt.x, -outPt.z);
        GROUND_PLANE.constant = -planeY;
        raycaster.ray.intersectPlane(GROUND_PLANE, outPt);
      }
      GROUND_PLANE.constant = 0;
      return true;
    };

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;

      const o = engineRef.current?.origin;
      const curAdminMode = adminLandmarkMode3DRef.current;
      const curSelPlace = selectedPlaceRef.current;
      if (!o || !curAdminMode || !curSelPlace || curSelPlace.lat === null || curSelPlace.lng === null) {
        return;
      }

      if (!intersectGroundAtEvent(ev, hitPoint)) return;

      if (curAdminMode === 'mode_b_model') {
        const subTool = directEditSubToolRef.current;
        if (subTool === 'pick_corner' || subTool === 'three_point') {
          // Chế độ chấm góc / 3 điểm A-B-C xử lý tại pointerup (tap)
          return;
        }
        const [anchorX, anchorY] = lngLatToLocal(o, curSelPlace.lng, curSelPlace.lat);
        const anchorZ = -anchorY;
        const baseBind = getOrCreateLandmarkBindingForPlace(curSelPlace);
        const workingBind: LandmarkBindingRecord = {
          ...baseBind,
          ...(previewBindingPatch3DRef.current || {}),
        };
        const modelX = anchorX + workingBind.offsetX;
        const modelZ = anchorZ + workingBind.offsetZ;
        const distToModel = Math.hypot(hitPoint.x - modelX, hitPoint.z - modelZ);

        // Kiểm tra raycast trực tiếp vào Gizmo vòng xoay hoặc thân mô hình 3D
        let hitRotateGizmo = false;
        let hitActiveLandmarkMesh = false;
        if (iconicLandmarksGroupRef.current) {
          const hits = raycaster.intersectObjects(iconicLandmarksGroupRef.current.children, true);
          for (const h of hits) {
            if (
              h.object.name === 'GizmoRotateRingMesh' ||
              h.object.name === 'GizmoRotateKnob'
            ) {
              hitRotateGizmo = true;
              break;
            }
            let pObj: THREE.Object3D | null = h.object;
            while (pObj) {
              if (pObj.name === `Landmark_${workingBind.landmarkId}`) {
                hitActiveLandmarkMesh = true;
                break;
              }
              pObj = pObj.parent;
            }
          }
        }

        const isNearRotateRing = distToModel >= 20 && distToModel <= 34;

        if (
          subTool === 'rotate'
            ? distToModel <= 75 || hitRotateGizmo || hitActiveLandmarkMesh
            : hitRotateGizmo || (isNearRotateRing && !hitActiveLandmarkMesh)
        ) {
          controls.enabled = false;
          activeDirectDrag = {
            kind: 'rotate',
            startAngle: Math.atan2(hitPoint.x - modelX, hitPoint.z - modelZ),
            startRotationY: workingBind.rotationY,
            modelX,
            modelZ,
            baseBind: workingBind,
          };
          try {
            renderer.domElement.setPointerCapture(ev.pointerId);
          } catch {}
          return;
        }

        if (subTool === 'scale' && (distToModel <= 75 || hitActiveLandmarkMesh)) {
          controls.enabled = false;
          activeDirectDrag = {
            kind: 'scale',
            startDist: Math.max(4, distToModel),
            startScale: workingBind.scale,
            modelX,
            modelZ,
            baseBind: workingBind,
          };
          try {
            renderer.domElement.setPointerCapture(ev.pointerId);
          } catch {}
          return;
        }

        if (subTool === 'translate' && (hitActiveLandmarkMesh || distToModel <= 42)) {
          controls.enabled = false;
          activeDirectDrag = {
            kind: 'translate',
            grabDx: hitPoint.x - modelX,
            grabDz: hitPoint.z - modelZ,
            anchorX,
            anchorZ,
            baseBind: workingBind,
          };
          try {
            renderer.domElement.setPointerCapture(ev.pointerId);
          } catch {}
          return;
        }
      } else if (curAdminMode === 'mode_a_place') {
        const effLat = pendingMoveCoords3DRef.current?.lat ?? curSelPlace.lat;
        const effLng = pendingMoveCoords3DRef.current?.lng ?? curSelPlace.lng;
        const [px, py] = lngLatToLocal(o, effLng, effLat);
        const pz = -py;
        const distToPin = Math.hypot(hitPoint.x - px, hitPoint.z - pz);
        if (distToPin <= 48) {
          controls.enabled = false;
          activeDirectDrag = {
            kind: 'move_place',
            grabDx: hitPoint.x - px,
            grabDz: hitPoint.z - pz,
          };
          try {
            renderer.domElement.setPointerCapture(ev.pointerId);
          } catch {}
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!activeDirectDrag) return;
      const o = engineRef.current?.origin;
      if (!o) return;
      if (!intersectGroundAtEvent(ev, hitPoint)) return;

      if (activeDirectDrag.kind === 'translate') {
        const nextModelX = hitPoint.x - activeDirectDrag.grabDx;
        const nextModelZ = hitPoint.z - activeDirectDrag.grabDz;
        const nextOffsetX = Number((nextModelX - activeDirectDrag.anchorX).toFixed(2));
        const nextOffsetZ = Number((nextModelZ - activeDirectDrag.anchorZ).toFixed(2));
        setPreviewBindingPatch3D({
          ...activeDirectDrag.baseBind,
          offsetX: nextOffsetX,
          offsetZ: nextOffsetZ,
        });
        requestRender();
      } else if (activeDirectDrag.kind === 'rotate') {
        const curAngle = Math.atan2(
          hitPoint.x - activeDirectDrag.modelX,
          hitPoint.z - activeDirectDrag.modelZ
        );
        const delta = curAngle - activeDirectDrag.startAngle;
        let nextRot = activeDirectDrag.startRotationY + delta;
        nextRot = Math.atan2(Math.sin(nextRot), Math.cos(nextRot));
        const snapDeg = rotateSnapDegRef.current;
        if (snapDeg > 0) {
          const stepRad = (snapDeg * Math.PI) / 180;
          nextRot = Math.round(nextRot / stepRad) * stepRad;
        }
        setPreviewBindingPatch3D({
          ...activeDirectDrag.baseBind,
          rotationY: Number(nextRot.toFixed(4)),
        });
        requestRender();
      } else if (activeDirectDrag.kind === 'scale') {
        const curDist = Math.max(
          2,
          Math.hypot(hitPoint.x - activeDirectDrag.modelX, hitPoint.z - activeDirectDrag.modelZ)
        );
        const ratio = curDist / activeDirectDrag.startDist;
        const nextScale = Math.min(
          3.5,
          Math.max(0.25, Number((activeDirectDrag.startScale * ratio).toFixed(2)))
        );
        setPreviewBindingPatch3D({
          ...activeDirectDrag.baseBind,
          scale: nextScale,
        });
        requestRender();
      } else if (activeDirectDrag.kind === 'move_place') {
        const nextX = hitPoint.x - activeDirectDrag.grabDx;
        const nextZ = hitPoint.z - activeDirectDrag.grabDz;
        const [lng, lat] = localToLngLat(o, nextX, -nextZ);
        setPendingMoveCoords3D({
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
        });
        requestRender();
      }
    };

    const endDirectDrag = (ev: PointerEvent) => {
      if (!activeDirectDrag) return false;
      const movedPx = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      activeDirectDrag = null;
      controls.enabled = true;
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {}
      return movedPx > 5;
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (endDirectDrag(ev)) {
        requestRender();
        return;
      }
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
      const o = engineRef.current?.origin;
      if (!o) return;
      if (intersectGroundAtEvent(ev, hitPoint)) {
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
          // Chế độ Chấm trên 3D: giữ trên bản đồ để Admin xem preview pin + bấm "Dùng vị trí này" (Phần 17)
          setEditLat(String(fixedLat));
          setEditLng(String(fixedLng));
          setEditNotice({
            text: `📍 Đã chọn vị trí (${fixedLat}, ${fixedLng}) trên mặt đất 3D.`,
          });
          requestRender();
          return;
        }
        // Hỗ trợ Admin click/tap trực tiếp lên mặt đất 3D khi đang ở Mode A hoặc Mode B
        const curAdminMode = adminLandmarkMode3DRef.current;
        const curSelPlace = selectedPlaceRef.current;
        if (curAdminMode === 'mode_a_place' && curSelPlace) {
          setPendingMoveCoords3D({ lat: fixedLat, lng: fixedLng });
          requestRender();
          return;
        }
        if (
          curAdminMode === 'mode_b_model' &&
          curSelPlace &&
          curSelPlace.lat !== null &&
          curSelPlace.lng !== null
        ) {
          const [anchorX, anchorY] = lngLatToLocal(o, curSelPlace.lng, curSelPlace.lat);
          const anchorZ = -anchorY;
          const curBind = getOrCreateLandmarkBindingForPlace(curSelPlace);
          const workingBind: LandmarkBindingRecord = {
            ...curBind,
            ...(previewBindingPatch3DRef.current || {}),
          };
          const subTool = directEditSubToolRef.current;

          // Chế độ 1: Đặt góc công trình tại điểm vừa chạm (Phần 24 — Snap Corner)
          const editAnchors = getLandmarkEditAnchors(workingBind.landmarkId);
          if (subTool === 'pick_corner') {
            const snapped = computeCornerSnapAlignment({
              anchorWorld: { x: anchorX, z: anchorZ },
              targetCornerWorld: { x: hitPoint.x, z: hitPoint.z },
              rotationY: workingBind.rotationY,
              scale: workingBind.scale,
              editAnchors,
            });
            setPreviewBindingPatch3D({
              ...workingBind,
              offsetX: snapped.offsetX,
              offsetZ: snapped.offsetZ,
            });
            setDirectEditSubTool('translate');
            requestRender();
            return;
          }

          // Chế độ 2: Căn theo 3 điểm A (góc chính) -> B (hướng mặt tiền 1) -> C (hướng mặt tiền 2) (Phần 2)
          if (subTool === 'three_point') {
            const curThree = threePointStateRef.current;
            const pt: [number, number] = [
              Number(hitPoint.x.toFixed(2)),
              Number(hitPoint.z.toFixed(2)),
            ];
            if (!curThree.pointA || (curThree.pointA && curThree.pointB && curThree.pointC)) {
              const nextThree = { pointA: pt, pointB: null, pointC: null };
              setThreePointState(nextThree);
              const snapped = computeCornerSnapAlignment({
                anchorWorld: { x: anchorX, z: anchorZ },
                targetCornerWorld: { x: pt[0], z: pt[1] },
                rotationY: workingBind.rotationY,
                scale: workingBind.scale,
                editAnchors,
              });
              setPreviewBindingPatch3D({
                ...workingBind,
                offsetX: snapped.offsetX,
                offsetZ: snapped.offsetZ,
              });
            } else if (!curThree.pointB) {
              const nextThree = { ...curThree, pointB: pt };
              setThreePointState(nextThree);
              const aligned = computeThreePointAlignment({
                anchorWorld: { x: anchorX, z: anchorZ },
                pointA: { x: curThree.pointA[0], z: curThree.pointA[1] },
                pointB: { x: pt[0], z: pt[1] },
                scale: workingBind.scale,
                editAnchors,
              });
              setPreviewBindingPatch3D({
                ...workingBind,
                offsetX: aligned.offsetX,
                offsetZ: aligned.offsetZ,
                rotationY: aligned.rotationY,
              });
            } else {
              const nextThree = { ...curThree, pointC: pt };
              setThreePointState(nextThree);
              const aligned = computeThreePointAlignment({
                anchorWorld: { x: anchorX, z: anchorZ },
                pointA: { x: curThree.pointA[0], z: curThree.pointA[1] },
                pointB: { x: curThree.pointB[0], z: curThree.pointB[1] },
                pointC: { x: pt[0], z: pt[1] },
                scale: workingBind.scale,
                editAnchors,
              });
              setPreviewBindingPatch3D({
                ...workingBind,
                offsetX: aligned.offsetX,
                offsetZ: aligned.offsetZ,
                rotationY: aligned.rotationY,
              });
            }
            requestRender();
            return;
          }

          // Chế độ 3: Đang ở công cụ Xoay -> chạm điểm bất kỳ để hướng công trình về phía đó
          if (subTool === 'rotate') {
            const modelX = anchorX + workingBind.offsetX;
            const modelZ = anchorZ + workingBind.offsetZ;
            let nextRot = Math.atan2(hitPoint.x - modelX, hitPoint.z - modelZ);
            if (rotateSnapDegRef.current > 0) {
              const stepRad = (rotateSnapDegRef.current * Math.PI) / 180;
              nextRot = Math.round(nextRot / stepRad) * stepRad;
            }
            setPreviewBindingPatch3D({
              ...workingBind,
              rotationY: Number(nextRot.toFixed(4)),
            });
            requestRender();
            return;
          }

          // Mặc định (translate): Chạm điểm trên mặt đất để đặt tâm mô hình tới đó
          const nextOffsetX = Number((hitPoint.x - anchorX).toFixed(2));
          const nextOffsetZ = Number((hitPoint.z - anchorZ).toFixed(2));
          setPreviewBindingPatch3D({
            ...workingBind,
            offsetX: nextOffsetX,
            offsetZ: nextOffsetZ,
          });
          requestRender();
          return;
        }

        // Khi Admin đang mở Chế độ Chỉnh Đường / Ngõ trên Sa bàn 3D
        if (isRoadEditor3DOpenRef.current && hasAdminAccessRef.current) {
          if (isDrawingRoad3DRef.current) {
            const nextPt: [number, number] = [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
            setRoadDrawingPoints3D((prev) => {
              const next = [...prev, nextPt];
              roadDrawingPoints3DRef.current = next;
              return next;
            });
            setLiveState({
              busy: false,
              message: `📍 Đã chấm điểm #${roadDrawingPoints3DRef.current.length + 1} (${nextPt[1]}, ${nextPt[0]}) trên mặt đất 3D`,
            });
            requestRender();
            return;
          }

          if (isMergingSecondRoad3DRef.current && selectedRoad3DRef.current) {
            const hitSecond = findNearestRoadAtLngLat(roadRecords3DRef.current, lng, lat, 32);
            if (hitSecond && hitSecond.record.roadId !== selectedRoad3DRef.current.roadId) {
              const merged = mergeAdminRoadSegments(
                selectedRoad3DRef.current,
                hitSecond.record
              );
              setIsMergingSecondRoad3D(false);
              isMergingSecondRoad3DRef.current = false;
              if (merged) {
                const updatedRec =
                  roadRecords3DRef.current.get(merged.roadId) || selectedRoad3DRef.current;
                setSelectedRoad3D(updatedRec);
                selectedRoad3DRef.current = updatedRec;
                setLiveState({
                  busy: false,
                  message: `✅ Đã nối thành công vào [${merged.roadId}] "${merged.name || '(Chưa đặt tên)'}"!`,
                });
              }
            } else {
              setLiveState({
                busy: false,
                message: '⚠️ Hãy chạm vào một đoạn đường khác ở gần để nối.',
              });
            }
            requestRender();
            return;
          }

          const hitRoad = findNearestRoadAtLngLat(roadRecords3DRef.current, lng, lat, 30);
          if (hitRoad) {
            setSelectedRoad3D(hitRoad.record);
            selectedRoad3DRef.current = hitRoad.record;
            setLiveState({
              busy: false,
              message: `🛣️ Đã chọn [${hitRoad.record.roadId}]: ${hitRoad.record.name || '(Chưa đặt tên)'}`,
            });
            requestRender();
            return;
          }
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
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', endDirectDrag);

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
      const nB = c.broadleaf.length / 6;
      const nC = c.conifer.length / 6;
      const nBL = (c.broadleafLarge?.length || 0) / 6;
      const nCT = (c.campusTree?.length || 0) / 6;
      const nFT = (c.forestTree?.length || 0) / 6;
      const nRO = (c.resortOrnamental?.length || 0) / 6;
      const nSL = (c.shrubLow?.length || 0) / 6;
      const totalWithTrunk = nB + nC + nBL + nCT + nFT + nRO;
      if (!totalWithTrunk && !nSL) return;

      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      const trunks = totalWithTrunk > 0 ? new THREE.InstancedMesh(trunkGeo, trunkMat, totalWithTrunk) : null;
      let ti = 0;

      const fillArchetype = (
        arr: Float32Array | undefined,
        geo: THREE.BufferGeometry,
        hasTrunk: boolean
      ) => {
        const count = (arr?.length || 0) / 6;
        if (!arr || count <= 0) return;
        const mesh = new THREE.InstancedMesh(geo, crownMat, count);
        for (let i = 0; i < count; i++) {
          const x = arr[i * 6],
            y = arr[i * 6 + 1],
            z = arr[i * 6 + 2],
            s = arr[i * 6 + 3],
            rot = arr[i * 6 + 4];
          dummy.position.set(x, y, z);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(s, s * (0.92 + (rot % 0.22)), s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, treeColors[(arr[i * 6 + 5] | 0) % treeColors.length]);
          if (hasTrunk && trunks) {
            trunks.setMatrixAt(ti++, dummy.matrix);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      };

      fillArchetype(c.broadleaf, crownGeo, true);
      fillArchetype(c.conifer, coniferGeo, true);
      fillArchetype(c.broadleafLarge, broadleafLargeGeo, true);
      fillArchetype(c.campusTree, campusTreeGeo, true);
      fillArchetype(c.forestTree, forestTreeGeo, true);
      fillArchetype(c.resortOrnamental, resortOrnamentalGeo, true);
      fillArchetype(c.shrubLow, shrubLowGeo, false);

      if (trunks) {
        trunks.instanceMatrix.needsUpdate = true;
        trunks.computeBoundingSphere();
        group.add(trunks);
      }
      scene.add(group);
      treeGroups.set(c.key, group);
    };

    const placeInitialCamera = (o: City3DOrigin) => {
      const [x, y] = lngLatToLocal(o, initialCenter.lng, initialCenter.lat);
      const ty = getElevationAtLocal(x, y);
      controls.target.set(x, ty, -y);
      const d = initialZoom ? zoom2DToDistance3D(initialZoom) : 620;
      const polar = 0.80; // ~45.8° — góc nghiêng lý tưởng chuẩn Cute Digital City Map (Section N)
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
          // Dựng công trình biểu tượng 3D chuẩn tạo hình liên kết với LandmarkBindingRecord (Phần 11–13)
          {
            const prevIconic = scene.getObjectByName('IconicLandmarks3D');
            if (prevIconic) scene.remove(prevIconic);
            const iconicGroup = createIconicLandmarksGroup(msg.origin, disposables);
            iconicLandmarksGroupRef.current = iconicGroup;
            syncIconicLandmarksGroup({
              rootGroup: iconicGroup,
              origin: msg.origin,
              places,
              masterDataset: getLoadedMasterDataset(),
              adminEditState: null,
            });
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
          if (msg.roadLabels && roadRecords3DRef.current.size === 0) {
            setRoadLabels(msg.roadLabels);
          }
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
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', endDirectDrag);
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
    if (isSavingPlace3D) return;
    if (editHoursError) {
      setEditNotice({ text: editHoursError, isError: true });
      return;
    }
    setIsSavingPlace3D(true);
    try {
      const lat = parseFloat(editLat);
      const lng = parseFloat(editLng);
      const isCivic = editCategory === 'public' || editCategory === 'school';
      const saved = saveLandmarkOrPlaceFromMap({
        id: editId,
        name: editName,
        category: editCategory,
        showByDefault: isCivic,
        address: editAddress,
        tagline: editTagline,
        phone: editPhone,
        openHours: editHours,
        lat,
        lng,
        mapsUrl: editMapsInput,
      });

      // Tự động bật bộ lọc tương ứng để Admin thấy ngay ghim vừa lưu
      if (isCivic && !showCivic) setShowCivic(true);
      if (!isCivic) {
        if (editCategory === 'food') setActiveShopGroup('food');
        else if (editCategory === 'pub') setActiveShopGroup('pub');
        else if (editCategory === 'cafe') setActiveShopGroup('cafe');
        else if (editCategory === 'snack') setActiveShopGroup('snack');
        else setActiveShopGroup('service');
      }

      onDataChanged?.();
      const freshSnapshot = getAllMapPlaceLocations();
      const freshPlace =
        freshSnapshot.verifiedMapMarkers.find((p) => p.id === saved.id) ||
        freshSnapshot.allLocations.find((p) => p.id === saved.id) ||
        null;
      if (freshPlace) {
        setSelected(freshPlace);
      }
      flyToCoordinates3D(saved.lat, saved.lng, 260);
      setIsEditingPlace(false);
      setIsCreatingNew(false);
      setIsPicking3DGround(false);
      setLiveState({
        busy: false,
        message: `Đã lưu địa danh "${editName.trim()}" (${saved.lat}, ${saved.lng})!`,
      });
    } catch (err: any) {
      setEditNotice({ text: err?.message || 'Lỗi khi lưu địa danh.', isError: true });
    } finally {
      setIsSavingPlace3D(false);
    }
  };

  const handleUnpinPlace3D = () => {
    if (!editId || !isStrictSuperAdmin) return;
    unpinLandmarkOrPlaceFromMap(editId, editName);
    onDataChanged?.();
    setIsEditingPlace(false);
    setSelected(null);
    setLiveState({
      busy: false,
      message: `Đã gỡ vị trí "${editName}" (chuyển về Chưa định vị).`,
    });
  };

  const handleBlockPlace = () => {
    if (!editId || !isStrictSuperAdmin) return;
    blockLandmarkOrPlaceFromMap(editId, editName);
    onDataChanged?.();
    setIsEditingPlace(false);
    setSelected(null);
    setLiveState({
      busy: false,
      message: `Đã Block (tạm khóa) "${editName}" trên Bản đồ 2D & 3D.`,
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
      message: `Đã xóa "${editName}" khỏi Bản đồ 2D & 3D.`,
    });
  };

  const handleRestoreDefault = () => {
    if (!editId || !isStrictSuperAdmin) return;
    restoreLandmarkOrPlaceDefault(editId);
    onDataChanged?.();
    setIsEditingPlace(false);
    setLiveState({
      busy: false,
      message: `Đã khôi phục "${editName}" về dữ liệu gốc mặc định.`,
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

      {/* Lớp phủ Ghim & Nhãn (Zero-GC GPU Transform — z-10 để luôn nằm dưới Modal & Floating Toolbar) */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        {/* Ghim nháp khi đang chỉnh sửa / thêm mới tọa độ */}
        <div
          ref={draftMarkerElRef}
          className="absolute left-0 top-0 z-30 flex flex-col items-center pointer-events-none"
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
          className="absolute left-0 top-0 z-20 flex flex-col items-center pointer-events-none"
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

        {/* Ghim Chỗ bạn sinh sống ("Nhà của bạn") đồng bộ trên Sa bàn 3D */}
        <div
          ref={homeMarker3DElRef}
          className="absolute left-0 top-0 z-25 flex flex-col items-center pointer-events-auto"
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
            <span className="mb-1 px-2 py-0.5 rounded-lg bg-[#0F172A] text-white border border-white/80 text-[10.5px] font-semibold whitespace-nowrap shadow-md">
              {userHome?.label || 'Nhà của bạn'}
            </span>
            <span className="w-7 h-7 rounded-full bg-[#0F172A] text-white border-[1.5px] border-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Home size={14} strokeWidth={1.75} />
            </span>
            <span className="h-1.5 w-0.5 bg-[#0F172A]" />
          </button>
        </div>

        {precomputedPins.map(({ place: p }) => {
          const taxMeta = getPlaceTaxonomyMeta(p);
          const isSel = selected?.id === p.id;
          const isBeingEdited = isEditingPlace && editId === p.id;
          const isSavedPin = savedPlaceIds.includes(p.id);
          const isCoreLandmark = isDefaultVisibleMapLandmark(p);
          const circleSizeCls = isSel
            ? 'h-8 w-8 sm:h-9 sm:w-9 ring-3 ring-[#059669]/25 scale-105'
            : 'h-[27px] w-[27px] sm:h-[29px] sm:w-[29px]';
          const circleColorCls = isSel
            ? 'bg-[#059669] text-white border-2 border-white'
            : isCoreLandmark
              ? 'bg-[#059669] text-white border-[1.5px] border-white'
              : 'bg-white text-[#059669] border-[1.5px] border-[#059669]';
          return (
            <button
              key={p.id}
              type="button"
              data-place-id={p.id}
              data-selected={isSel ? '1' : '0'}
              ref={(el) => {
                if (el) pinElsRef.current.set(p.id, el);
                else pinElsRef.current.delete(p.id);
              }}
              onClick={() => {
                setSelected(p);
                flyToPlace(p);
              }}
              onMouseEnter={() => {
                setHoveredPinId3D(p.id);
                engineRef.current?.requestRender();
              }}
              onMouseLeave={() => {
                setHoveredPinId3D((prev) => (prev === p.id ? null : prev));
                engineRef.current?.requestRender();
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
                className={`city3d-pin-name mb-0.5 max-w-[140px] sm:max-w-[160px] truncate rounded-md px-1.5 py-0.5 text-[10.5px] sm:text-[11px] font-semibold shadow-sm border ${
                  isSel
                    ? 'bg-[#0F172A] text-white border-[#059669]'
                    : 'bg-white/95 text-[#0F172A] border-slate-200/90'
                }`}
              >
                {p.name}
              </span>
              <span
                className={`relative flex items-center justify-center rounded-full shadow-[0_2px_8px_rgba(15,23,42,0.16)] transition-transform group-hover:scale-105 ${circleSizeCls} ${circleColorCls}`}
              >
                {renderRegistryIcon(taxMeta.iconName, {
                  size: isSel ? 17 : 15,
                  strokeWidth: 1.65,
                })}
                {isSavedPin && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#0F172A] text-white border border-white flex items-center justify-center shadow-xs">
                    <Bookmark size={8} strokeWidth={2} className="fill-current" />
                  </span>
                )}
              </span>
              <span className="h-1 w-0.5 bg-[#059669]/80" />
            </button>
          );
        })}

        {/* Cụm POI Cluster trên Bản đồ 3D khi nhìn từ xa / trung cảnh — Chỉ hiện số lượng gọn sạch */}
        {precomputedClusters3D.map(({ cluster: c }) => (
          <button
            key={c.id}
            type="button"
            data-testid={`poi-cluster-3d-${c.id}`}
            ref={(el) => {
              if (el) clusterElsRef.current.set(c.id, el);
              else clusterElsRef.current.delete(c.id);
            }}
            onClick={() => {
              flyToCoordinates3D(c.lat, c.lng, c.targetDistance3D);
            }}
            className="absolute left-0 top-0 pointer-events-auto flex h-8 min-w-8 items-center justify-center rounded-full bg-white text-[#0F172A] border-[1.5px] border-[#059669] px-2 text-[11.5px] font-bold shadow-[0_2px_10px_rgba(15,23,42,0.16)] transition-transform hover:scale-105 cursor-pointer"
            style={{
              visibility: 'hidden',
              willChange: 'transform',
              zIndex: 18,
            }}
            title={`Cụm ${c.count} địa điểm — bấm để phóng gần`}
          >
            <span>{c.badgeText}</span>
          </button>
        ))}

        {precomputedBuildingLabels.map(({ label: lb, index }) => (
          <div
            key={`${lb.name}-${index}`}
            ref={(el) => {
              if (el) labelElsRef.current.set(index, el);
              else labelElsRef.current.delete(index);
            }}
            className="absolute left-0 top-0 whitespace-nowrap rounded bg-[#0F172A]/85 px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-semibold text-white shadow-xs"
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
            className={`absolute left-0 top-0 whitespace-nowrap rounded px-1.5 py-0.5 font-bold tracking-wide shadow-xs ${
              rl.tier === 'major'
                ? 'bg-white/95 text-[#0F172A] border border-slate-300 text-[9.5px] sm:text-[10.5px]'
                : rl.tier === 'secondary'
                ? 'bg-white/90 text-[#1E293B] border border-slate-200 text-[9px] sm:text-[10px]'
                : 'bg-white/85 text-[#475569] border border-slate-200/80 text-[8.5px] sm:text-[9.5px]'
            }`}
            style={{ visibility: 'hidden', willChange: 'transform' }}
          >
            {rl.name}
          </div>
        ))}
      </div>

      {/* THANH TÌM KIẾM TỐI GIẢN TRÊN CÙNG + THANH DANH MỤC NHANH NGAY DƯỚI (TỐI ĐA ~88PX) */}
      <div className="absolute left-2 sm:left-3 right-2 sm:right-3 top-2 sm:top-2.5 z-20 flex flex-col gap-1.5 pointer-events-none">
        <div className="pointer-events-auto relative flex items-center gap-1.5 w-full sm:w-[420px] h-10 rounded-[14px] bg-white/96 border border-slate-200/90 px-3 shadow-[0_4px_20px_rgba(15,23,42,0.08)] backdrop-blur-md">
          <Search size={16} strokeWidth={1.75} className="text-slate-400 shrink-0" />
          <input
            type="text"
            data-testid="search-3d-input"
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
            placeholder="Tìm địa điểm, quán ăn, dịch vụ..."
            className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-[#0F172A] placeholder-slate-400 outline-none"
          />
          {search3DQuery && (
            <button
              type="button"
              onClick={() => setSearch3DQuery('')}
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          )}

          <div className="h-4 w-[1px] bg-slate-200 shrink-0" />

          {/* Nút Địa điểm đã lưu bằng icon Bookmark tinh gọn */}
          <button
            type="button"
            onClick={() => {
              setIsSavedMenu3DOpen((v) => !v);
              setIsFilterMenuOpen(false);
              setIsSearch3DFocused(false);
            }}
            title="Địa điểm đã lưu của bạn"
            className={`relative flex items-center justify-center gap-1 h-7 px-2 rounded-lg text-[11.5px] font-semibold border transition shrink-0 cursor-pointer ${
              isSavedMenu3DOpen || savedPlaceIds.length > 0
                ? 'bg-[#ECFDF5] text-[#059669] border-[#059669]/30 hover:bg-[#D1FAE5]'
                : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
            }`}
          >
            <Bookmark
              size={14}
              strokeWidth={1.75}
              className={savedPlaceIds.length > 0 ? 'fill-[#059669]/20' : ''}
            />
            {savedPlaceIds.length > 0 && (
              <span className="text-[11px] font-bold">{savedPlaceIds.length}</span>
            )}
          </button>

          {/* BẢNG ĐỊA ĐIỂM ĐÃ LƯU TRÊN BẢN ĐỒ 3D */}
          {isSavedMenu3DOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white/98 border border-slate-200 shadow-[0_12px_32px_rgba(15,23,42,0.14)] p-2.5 z-50 space-y-1.5 backdrop-blur-md">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="text-[11.5px] font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Bookmark size={13} strokeWidth={1.75} className="text-[#059669]" />
                    <span>Đã lưu ({savedPlaces3D.length})</span>
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 truncate">
                    Tài khoản: {userAccountLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavedMenu3DOpen(false)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10.5px] font-semibold cursor-pointer shrink-0"
                >
                  Đóng
                </button>
              </div>

              {savedPlaces3D.length === 0 ? (
                <div className="py-4 px-2 text-center text-[11px] text-slate-500 space-y-1">
                  <div className="font-semibold text-slate-700">Chưa có địa điểm đã lưu</div>
                  <div>
                    Bấm biểu tượng <strong className="text-[#059669]">Lưu</strong> trên thẻ địa điểm để lưu nhanh.
                  </div>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-0.5">
                  {savedPlaces3D.map((item) => (
                    <div
                      key={item.id}
                      className="py-1.5 px-1.5 flex items-center justify-between gap-1.5 hover:bg-slate-50 rounded-xl transition"
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
                        <div className="text-[12px] font-semibold text-[#0F172A] truncate">
                          {item.name}
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate">
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
                            className="px-2 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-[10px] font-semibold cursor-pointer"
                          >
                            Đi tới
                          </button>
                        )}
                        {onToggleSavePlace && (
                          <button
                            type="button"
                            onClick={() => onToggleSavePlace(item)}
                            title="Bỏ lưu địa điểm này"
                            className="px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BẢNG GỢI Ý TÌM KIẾM ĐỊA CHỈ & HÀNG QUÁN (LUÔN TÌM ĐƯỢC MỌI QUÁN KỂ CẢ KHI ĐANG TẮT CATEGORY) */}
          {isSearch3DFocused && (
            <div className="absolute left-0 right-0 sm:w-[410px] top-full mt-2 max-h-72 overflow-y-auto rounded-2xl bg-white/98 border border-slate-200 shadow-[0_12px_32px_rgba(15,23,42,0.14)] p-2 z-50 space-y-0.5 backdrop-blur-md">
              <div className="px-2.5 py-1 text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>
                  {search3DQuery.trim()
                    ? `Kết quả "${search3DQuery.trim()}"`
                    : 'Địa điểm, Quán xá & Đường phố'}
                </span>
                <span className="text-[10px] font-semibold text-[#059669]">
                  {places.filter((p) => p.lat !== null && p.lng !== null).length} địa điểm
                </span>
              </div>

              {/* Gợi ý Đường & Ngõ (ràng buộc theo roadId + kiểm tra verificationStatus) */}
              {searchableRoads3D
                .filter((r) => {
                  const q = search3DQuery.trim().toLowerCase();
                  if (!q) {
                    return (
                      (r.roadType === 'road' || r.roadType === 'street') &&
                      r.verificationStatus !== 'needs_review' &&
                      r.verificationStatus !== 'rejected'
                    );
                  }
                  return r.name.toLowerCase().includes(q);
                })
                .slice(0, search3DQuery.trim() ? 5 : 3)
                .map((r) => {
                  const isReviewing =
                    r.verificationStatus === 'needs_review' ||
                    r.verificationStatus === 'rejected' ||
                    r.nameSource === 'inferred';
                  if (isReviewing) {
                    return (
                      <div
                        key={`road-review-${r.osmId}-${r.name}`}
                        data-testid={`search-3d-road-review-${r.osmId}`}
                        className="w-full text-left px-2.5 py-2 rounded-xl bg-amber-50/90 border border-amber-200/80 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-amber-950 truncate">
                            {r.name}
                          </div>
                          <div className="text-[11px] font-medium text-amber-800">
                            Địa chỉ này đang được rà soát.
                          </div>
                        </div>
                        {hasAdminAccess && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const targetId = r.candidateRoadId || r.osmId;
                              const rec =
                                roadRecords3DRef.current.get(targetId) ||
                                roadRecords3DRef.current.get(r.osmId) ||
                                null;
                              setIsRoadEditor3DOpen(true);
                              isRoadEditor3DOpenRef.current = true;
                              if (rec) {
                                setSelectedRoad3D(rec);
                                selectedRoad3DRef.current = rec;
                              }
                              flyToCoordinates3D(r.lat, r.lng, 220);
                              setSearch3DQuery('');
                              setIsSearch3DFocused(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-semibold shrink-0 cursor-pointer"
                          >
                            Rà soát
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`road-${r.osmId}-${r.name}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!showRoadNames) setShowRoadNames(true);
                        const rec = roadRecords3DRef.current.get(r.osmId) || null;
                        if (isRoadEditor3DOpenRef.current && rec) {
                          setSelectedRoad3D(rec);
                          selectedRoad3DRef.current = rec;
                        }
                        flyToCoordinates3D(
                          r.lat,
                          r.lng,
                          r.roadType === 'alley' || r.roadType === 'lane' ? 210 : 290
                        );
                        setSearch3DQuery('');
                        setIsSearch3DFocused(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <Navigation size={13} strokeWidth={1.65} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-[#0F172A] truncate">
                            {r.name}
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            {r.parentRoad
                              ? `Nhánh thuộc ${r.parentRoad}`
                              : 'Tuyến đường / ngõ Phường Xuân Hòa'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10.5px] font-semibold text-[#059669] shrink-0">
                        Xem
                      </span>
                    </button>
                  );
                })}

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
                .slice(0, search3DQuery.trim() ? 12 : 12)
                .map((item) => {
                  const taxMeta = getPlaceTaxonomyMeta(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`search-3d-item-${item.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelected(item);
                        flyToPlace(item);
                        setSearch3DQuery('');
                        setIsSearch3DFocused(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#059669]/25 flex items-center justify-center shrink-0">
                          {renderRegistryIcon(taxMeta.iconName, { size: 14, strokeWidth: 1.65 })}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-[#0F172A] truncate">
                            {item.name}
                          </div>
                          <div className="text-[10.5px] text-slate-500 truncate">
                            {taxMeta.subcategory.label} · {item.address}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10.5px] font-semibold text-[#059669] shrink-0">
                        Bay tới
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Thanh Danh Mục Nhanh (Quick Category Bar) — Đặt ngay dưới ô Search, 1 hàng cuộn ngang */}
        {!isEditingPlace && !isCreatingNew && (
          <div className="w-full sm:max-w-xl pointer-events-auto">
            <MapQuickCategoryBar
              activeFilterId={activeQuickFilter}
              onSelectFilter={(filterId) => onChangeQuickFilter?.(filterId)}
              places={places}
            />
          </div>
        )}
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
        const contactPhone = (activeRoute.targetPlace.phone || '').trim();
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
                  {contactPhone && (
                    <a
                      href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-[11px] text-center shadow-xs"
                    >
                      Gọi SĐT: {contactPhone}
                    </a>
                  )}
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

      {/* Thanh nhắc + Xác nhận vị trí khi đang ở chế độ Chấm trên 3D (Phần 17) */}
      {isPicking3DGround && (
        <>
          <div
            data-testid="pick-3d-ground-banner"
            className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-[#0F172A]/95 px-4 py-1.5 text-xs font-bold text-white shadow-xl border border-amber-400/60 backdrop-blur-md whitespace-nowrap"
          >
            <Crosshair size={14} className="text-amber-400 shrink-0" />
            <span>Chạm vị trí muốn đặt địa danh</span>
          </div>
          <div className="absolute bottom-3 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[420px] z-40 rounded-2xl bg-[#0F172A]/95 border border-amber-400/50 p-2.5 text-white shadow-2xl backdrop-blur-md flex items-center justify-between gap-2 pointer-events-auto">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold text-amber-300 truncate">
                {editName.trim() || 'Vị trí đang chấm trên 3D'}
              </div>
              <div className="font-mono text-xs font-bold text-white">
                {editLat && editLng ? `${editLat}, ${editLng}` : 'Chưa chạm điểm'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="pick-3d-cancel-btn"
                onClick={() => {
                  if (pickSnapshotCoordsRef.current) {
                    setEditLat(pickSnapshotCoordsRef.current.lat);
                    setEditLng(pickSnapshotCoordsRef.current.lng);
                  }
                  setIsPicking3DGround(false);
                }}
                className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                data-testid="pick-3d-confirm-btn"
                onClick={() => setIsPicking3DGround(false)}
                className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Check size={13} />
                <span>Dùng vị trí này</span>
              </button>
            </div>
          </div>
        </>
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
                <h3 className="text-sm font-extrabold text-[#92400E] leading-snug flex items-center gap-1.5">
                  <Home size={14} strokeWidth={1.75} />
                  <span>
                    {home3DModalMode === 'view' && userHome
                      ? userHome.label
                      : userHome
                      ? 'Thay đổi chỗ bạn sinh sống'
                      : 'Định vị chỗ bạn sinh sống'}
                  </span>
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
                  Hãy định vị chỗ bạn đang sinh sống. Sau khi lưu, mỗi lần bấm biểu tượng ngôi nhà bản đồ sẽ đứng đúng tại địa chỉ nhà bạn cho đến khi bạn thay đổi hoặc xóa.
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

      {/* Thẻ thông tin Địa danh / Quán đang chọn (Tự thu gọn khi vào Direct Edit Mode A / Mode B — Phần 3 & 11) */}
      {selected && !isEditingPlace && !isCreatingNew && !adminLandmarkMode3D && (() => {
        const taxMeta = getPlaceTaxonomyMeta(selected);
        const ratingVal = selected.originalPlace?.rating;
        const isSaved = savedPlaceIds.includes(selected.id);
        return (
          <div className={`absolute left-2.5 right-12 sm:right-auto ${hasAdminAccess ? 'bottom-12' : 'bottom-2.5 sm:bottom-3.5'} z-25 sm:w-[360px] rounded-[18px] border border-slate-200/90 bg-white/98 p-3.5 text-[#0F172A] shadow-[0_12px_32px_rgba(15,23,42,0.16)] backdrop-blur-md`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[15px] font-bold leading-snug text-[#0F172A]">
                  {selected.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
                    {renderRegistryIcon(taxMeta.iconName, { size: 12, strokeWidth: 1.75 })}
                    <span>{taxMeta.subcategory.label}</span>
                  </span>
                  {typeof ratingVal === 'number' && ratingVal > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-[#0F172A]">
                      <Star size={12} strokeWidth={1.75} className="text-amber-500 fill-amber-400" />
                      <span>{ratingVal.toFixed(1)}</span>
                    </span>
                  )}
                  {selected.openHours && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock size={11} strokeWidth={1.65} />
                      <span>{selected.openHours}</span>
                    </span>
                  )}
                </div>
                {selected.address && (
                  <div className="mt-1.5 text-[11.5px] font-normal text-slate-600 line-clamp-2">
                    {selected.address}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onToggleSavePlace && (
                  <button
                    type="button"
                    onClick={() => onToggleSavePlace(selected)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold border transition cursor-pointer ${
                      isSaved
                        ? 'bg-[#ECFDF5] text-[#059669] border-[#059669]/30'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Bookmark size={12} strokeWidth={1.75} className={isSaved ? 'fill-[#059669]/20' : ''} />
                    <span>{isSaved ? 'Đã lưu' : 'Lưu'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer shrink-0"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {onDrawRouteToPlace && selected.lat !== null && selected.lng !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onDrawRouteToPlace(selected, 'motorbike');
                    setSelected(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] px-3 py-2 text-[12px] font-semibold text-white cursor-pointer transition"
                >
                  <Navigation size={13} strokeWidth={1.75} />
                  <span>Chỉ đường</span>
                </button>
              )}
              {selected.phone && (
                <a
                  href={`tel:${selected.phone.replace(/[^0-9+]/g, '')}`}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 px-2.5 py-2 text-[11.5px] font-semibold text-[#0F172A]"
                >
                  <Phone size={12} strokeWidth={1.75} className="text-[#059669]" />
                  <span>Gọi</span>
                </a>
              )}
              {onOpenPlace && selected.originalPlace && !isCivicLandmark(selected) && (
                <button
                  type="button"
                  onClick={() => onOpenPlace(selected)}
                  className="rounded-xl bg-[#0F172A] hover:bg-[#1E293B] px-3 py-2 text-[11.5px] font-semibold text-white cursor-pointer"
                >
                  Chi tiết
                </button>
              )}
              {selected.media?.some((m) => m.type === 'panorama360') && (
                <a
                  href={selected.media.find((m) => m.type === 'panorama360')?.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 px-2.5 py-2 text-[11.5px] font-semibold text-white"
                >
                  360°
                </a>
              )}
              {hasAdminAccess && (
                <button
                  type="button"
                  onClick={() => openEditForPlace(selected)}
                  className="rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-2 text-[11.5px] font-semibold text-amber-900 cursor-pointer"
                >
                  Sửa
                </button>
              )}
            </div>

            {hasAdminAccess && (
              <LandmarkAdminControls
                variant="card_buttons"
                place={selected}
                mapMode="3d"
                activeMode={adminLandmarkMode3D}
                onChangeActiveMode={(nextMode) => {
                  setAdminLandmarkMode3D(nextMode);
                  if (nextMode) {
                    flyToPlace(selected);
                  }
                }}
                pendingPlaceLatLng={pendingMoveCoords3D}
                onChangePendingPlaceLatLng={setPendingMoveCoords3D}
                previewBindingPatch={previewBindingPatch3D}
                onChangePreviewBindingPatch={setPreviewBindingPatch3D}
                masterDataset={getLoadedMasterDataset()}
                origin3D={originState}
                adminIdentifier={loginUser || 'admin'}
                onSaved={(msg, newCoords) => {
                  setLiveState({ busy: false, message: msg });
                  onDataChanged?.();
                  if (newCoords) {
                    setSelected((prev) =>
                      prev ? { ...prev, lat: newCoords.lat, lng: newCoords.lng } : null
                    );
                  }
                  setLandmarkBindingsTick((t) => t + 1);
                }}
              />
            )}
          </div>
        );
      })()}

      {/* Thẻ thông tin Công trình Master Building (Đồng bộ 100% ID, Footprint, Zone, DEM giữa 2D và 3D) */}
      {!selected && localSelectedBuilding && !isEditingPlace && !isCreatingNew && (
        <div className={`absolute left-2.5 right-12 sm:right-auto ${hasAdminAccess ? 'bottom-12' : 'bottom-2.5 sm:bottom-3.5'} z-20 sm:w-[335px] rounded-2xl border border-[#403064]/80 bg-[#FFFDF9]/98 p-2.5 sm:p-3 text-[#2D2246] shadow-2xl backdrop-blur-md`}>
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

      {/* THANH CÔNG CỤ DIRECT EDIT NỔI HOẶC THANH ADMIN DƯỚI ĐÁY (Phần 7 & 19) */}
      {hasAdminAccess && !isEditingPlace && !isCreatingNew && !isPicking3DGround && (
        selected && adminLandmarkMode3D ? (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[660px] z-35 pointer-events-auto">
            <LandmarkAdminControls
              variant="floating_toolbar"
              place={selected}
              mapMode="3d"
              activeMode={adminLandmarkMode3D}
              onChangeActiveMode={(nextMode) => {
                setAdminLandmarkMode3D(nextMode);
                if (!nextMode) {
                  setDirectEditSubTool('translate');
                  setThreePointState({ pointA: null, pointB: null, pointC: null });
                }
              }}
              subTool={directEditSubTool}
              onChangeSubTool={setDirectEditSubTool}
              rotateSnapDeg={rotateSnapDeg}
              onChangeRotateSnapDeg={setRotateSnapDeg}
              threePointState={threePointState}
              onClearThreePoint={() =>
                setThreePointState({ pointA: null, pointB: null, pointC: null })
              }
              pendingPlaceLatLng={pendingMoveCoords3D}
              onChangePendingPlaceLatLng={setPendingMoveCoords3D}
              previewBindingPatch={previewBindingPatch3D}
              onChangePreviewBindingPatch={setPreviewBindingPatch3D}
              masterDataset={getLoadedMasterDataset()}
              origin3D={originState}
              adminIdentifier={loginUser || 'admin'}
              onSaved={(msg, newCoords) => {
                setLiveState({ busy: false, message: msg });
                onDataChanged?.();
                if (newCoords) {
                  setSelected((prev) =>
                    prev ? { ...prev, lat: newCoords.lat, lng: newCoords.lng } : null
                  );
                }
                setLandmarkBindingsTick((t) => t + 1);
              }}
            />
          </div>
        ) : (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 max-w-[96vw] pointer-events-auto">
            <div className="flex items-center gap-1 rounded-full bg-white/95 border border-[#E2E8F0] px-2.5 py-1 shadow-[0_4px_16px_rgba(15,23,42,0.1)] backdrop-blur-md whitespace-nowrap">
              <span className="text-[11px] font-semibold text-[#059669] px-1">
                {isStrictSuperAdmin ? 'Admin' : 'Quản lý Maps'}
              </span>
              <button
                type="button"
                onClick={() => {
                  openCreateNewModal();
                  pickSnapshotCoordsRef.current = { lat: editLat, lng: editLng };
                  setIsPicking3DGround(true);
                }}
                className="rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-white px-2.5 py-1 text-[11px] font-medium transition cursor-pointer"
                title="Chạm lên mặt đất 3D để chấm ghim vị trí mới"
              >
                Chấm 3D +
              </button>
              <button
                type="button"
                onClick={openCreateNewModal}
                className="rounded-full bg-[#059669] hover:bg-[#047857] text-white px-2.5 py-1 text-[11px] font-medium transition cursor-pointer"
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
                className="rounded-full bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium transition cursor-pointer"
              >
                Sửa địa điểm
              </button>
              <button
                type="button"
                data-testid="3d-bar-road-editor-btn"
                onClick={() => {
                  setIsRoadEditor3DOpen((prev) => {
                    const next = !prev;
                    isRoadEditor3DOpenRef.current = next;
                    return next;
                  });
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  isRoadEditor3DOpen
                    ? 'bg-[#059669] text-white border-[#059669]'
                    : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border-[#E2E8F0]'
                }`}
              >
                Đường / Ngõ
              </button>
            </div>
          </div>
        )
      )}

      {/* BẢNG ADMIN CHỈNH SỬA ĐƯỜNG / NGÕ / NGÁCH TRÊN SA BÀN 3D */}
      {hasAdminAccess && (
        <AdminRoadEditorPanel
          isOpen={isRoadEditor3DOpen}
          onClose={() => {
            setIsRoadEditor3DOpen(false);
            isRoadEditor3DOpenRef.current = false;
            setIsDrawingRoad3D(false);
            isDrawingRoad3DRef.current = false;
            setRoadDrawingPoints3D([]);
            roadDrawingPoints3DRef.current = [];
            setIsRedrawingExisting3D(false);
            setIsMergingSecondRoad3D(false);
            isMergingSecondRoad3DRef.current = false;
          }}
          selectedRoad={selectedRoad3D}
          allRoadsMap={roadRecords3DRef.current}
          auditIssues={roadAuditIssues3D}
          isDrawingMode={isDrawingRoad3D}
          drawingPoints={roadDrawingPoints3D}
          isRedrawingExisting={isRedrawingExisting3D}
          isMergingSecondRoad={isMergingSecondRoad3D}
          onStartDrawNewAlley={() => {
            setIsRedrawingExisting3D(false);
            setIsDrawingRoad3D(true);
            isDrawingRoad3DRef.current = true;
            setRoadDrawingPoints3D([]);
            roadDrawingPoints3DRef.current = [];
            setIsMergingSecondRoad3D(false);
            isMergingSecondRoad3DRef.current = false;
          }}
          onStartRedrawSelectedRoad={() => {
            setIsRedrawingExisting3D(true);
            setIsDrawingRoad3D(true);
            isDrawingRoad3DRef.current = true;
            setRoadDrawingPoints3D([]);
            roadDrawingPoints3DRef.current = [];
            setIsMergingSecondRoad3D(false);
            isMergingSecondRoad3DRef.current = false;
          }}
          onUndoLastDrawPoint={() => {
            setRoadDrawingPoints3D((prev) => {
              const next = prev.slice(0, -1);
              roadDrawingPoints3DRef.current = next;
              return next;
            });
          }}
          onCancelDrawing={() => {
            setIsDrawingRoad3D(false);
            isDrawingRoad3DRef.current = false;
            setRoadDrawingPoints3D([]);
            roadDrawingPoints3DRef.current = [];
            setIsRedrawingExisting3D(false);
          }}
          onStartMergeMode={() => {
            setIsMergingSecondRoad3D(true);
            isMergingSecondRoad3DRef.current = true;
          }}
          onCancelMergeMode={() => {
            setIsMergingSecondRoad3D(false);
            isMergingSecondRoad3DRef.current = false;
          }}
          onSelectRoadById={(roadId, flyTo) => {
            const rec = roadRecords3DRef.current.get(roadId) || null;
            setSelectedRoad3D(rec);
            selectedRoad3DRef.current = rec;
            if (rec && flyTo && rec.geometry.length > 0) {
              const mid = rec.geometry[Math.floor(rec.geometry.length / 2)];
              flyToCoordinates3D(mid[1], mid[0], 210);
            }
          }}
          onFlyToLngLat={(lng, lat) => {
            flyToCoordinates3D(lat, lng, 210);
          }}
          onNotifyToast={(msg) => {
            setLiveState({ busy: false, message: msg });
          }}
        />
      )}

      {/* Khung Chỉnh sửa / Thêm mới Địa danh — Tự động ẩn gọn khi đang Chấm trên 3D (Phần 15–18) */}
      {(isEditingPlace || isCreatingNew) && !isPicking3DGround && (
        <div className="fixed inset-0 z-40 bg-[#0F172A]/35 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
          <form
            onSubmit={handleSavePlaceEdit}
            className="w-full sm:max-w-md max-h-[65dvh] sm:max-h-[82dvh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] shadow-[0_20px_50px_rgba(15,23,42,0.22)]"
          >
            {/* Header cố định */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-2 shrink-0">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                  {isCreatingNew ? 'Thêm địa danh mới' : 'Chỉnh sửa địa danh & vị trí'}
                </div>
                <h3 className="text-[13px] font-bold text-[#0F172A] truncate leading-snug">
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
                className="w-7 h-7 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] flex items-center justify-center cursor-pointer shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body form scroll độc lập */}
            <div className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  Tên địa danh / Cơ quan / Quán *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="VD: Trụ sở Hành chính KV Cao Minh..."
                  className="w-full h-9 rounded-[9px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#0F172A] focus:border-[#059669] focus:outline-none"
                />
              </div>

              {/* 2 CỘT: Loại & Biểu tượng | Số điện thoại */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                    Loại & Biểu tượng
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) =>
                      setEditCategory(e.target.value as Exclude<MapCategoryKey, 'all' | 'game_asset'>)
                    }
                    className="w-full h-9 rounded-[9px] border border-[#CBD5E1] bg-white px-2 text-xs font-semibold text-[#0F172A] focus:border-[#059669] focus:outline-none"
                  >
                    {EDITABLE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="VD: 0988..."
                    className="w-full h-9 rounded-[9px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#059669] focus:outline-none"
                  />
                </div>
              </div>

              {/* Địa chỉ hiển thị */}
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  Địa chỉ hiển thị
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Số nhà, đường, khu vực..."
                  className="w-full h-9 rounded-[9px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#059669] focus:outline-none"
                />
              </div>

              {/* Giờ mở cửa nhập nhanh bằng bàn phím + 7 ngày */}
              <FastOpeningHoursInput
                value={editHours}
                onChange={setEditHours}
                onValidationChange={(_, err) => setEditHoursError(err)}
              />

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  Mô tả chức năng / Ghi chú hiển thị
                </label>
                <input
                  type="text"
                  value={editTagline}
                  onChange={(e) => setEditTagline(e.target.value)}
                  placeholder="VD: Trụ sở làm việc mới / Điểm tiếp dân..."
                  className="w-full h-9 rounded-[9px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#059669] focus:outline-none"
                />
              </div>

              {/* Khung Định vị gọn (Phần 16–18: Ưu tiên Chấm trên 3D / Chấm trên 2D) */}
              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <label className="text-[11px] font-semibold text-[#334155]">
                    Định vị vị trí ({editLat && editLng ? `${Number(editLat).toFixed(4)}, ${Number(editLng).toFixed(4)}` : 'Chưa chấm'})
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid="btn-pick-on-3d"
                      onClick={() => {
                        pickSnapshotCoordsRef.current = { lat: editLat, lng: editLng };
                        setIsPicking3DGround(true);
                      }}
                      className="h-7 rounded-[8px] bg-[#0F172A] hover:bg-[#1E293B] text-white px-2.5 text-[11px] font-semibold cursor-pointer transition flex items-center gap-1"
                    >
                      <Crosshair size={12} />
                      <span>Chấm trên 3D</span>
                    </button>
                    <button
                      type="button"
                      data-testid="btn-pick-on-2d"
                      onClick={() => {
                        setIsEditingPlace(false);
                        setIsCreatingNew(false);
                        const latNum = parseFloat(editLat);
                        const lngNum = parseFloat(editLng);
                        onClose(
                          Number.isFinite(latNum) && Number.isFinite(lngNum)
                            ? { lat: latNum, lng: lngNum }
                            : undefined,
                          17
                        );
                      }}
                      className="h-7 rounded-[8px] bg-white hover:bg-slate-100 text-[#0F172A] border border-[#CBD5E1] px-2 text-[11px] font-semibold cursor-pointer transition"
                    >
                      Chấm trên 2D
                    </button>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={editMapsInput}
                    onChange={(e) => handleMapsInputChange(e.target.value)}
                    placeholder="Dán link Maps, mã 7PQ6+VFP hoặc tên đường..."
                    className="flex-1 h-9 rounded-[9px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#059669] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSearchAddressIn3D}
                    disabled={isGeocoding}
                    className="h-9 rounded-[9px] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] px-3 text-xs font-semibold text-[#334155] cursor-pointer shrink-0"
                  >
                    {isGeocoding ? '...' : 'Tìm'}
                  </button>
                </div>

                {geoSuggestions.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {geoSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setEditLat(String(s.lat));
                          setEditLng(String(s.lng));
                          flyToCoordinates3D(s.lat, s.lng, 250);
                        }}
                        className="w-full text-left rounded-[8px] bg-white hover:bg-[#ECFDF5] border border-[#E2E8F0] px-2 py-1 text-[10.5px] cursor-pointer"
                      >
                        <div className="font-semibold text-[#0F172A] truncate">{s.displayName}</div>
                        <div className="font-mono text-[9.5px] text-[#059669]">
                          {s.lat}, {s.lng}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Nút mở rộng nhập tọa độ thủ công (Nâng cao — Phần 18) */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedCoords3D((v) => !v)}
                    className="text-[10.5px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    {showAdvancedCoords3D ? 'Ẩn tọa độ số (Lat/Lng)' : 'Nhập tọa độ số thủ công (Nâng cao)'}
                  </button>
                </div>

                {/* 2 CỘT: Vĩ độ | Kinh độ (ẩn gọn mặc định, mở khi bấm Nâng cao) */}
                <div className={showAdvancedCoords3D ? 'grid grid-cols-2 gap-2' : 'sr-only'}>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Vĩ độ (Lat)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editLat}
                      onChange={(e) => setEditLat(e.target.value)}
                      className="w-full h-9 rounded-[9px] border border-[#CBD5E1] bg-white px-2.5 font-mono text-xs font-semibold text-[#0F172A] focus:border-[#059669] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Kinh độ (Lng)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editLng}
                      onChange={(e) => setEditLng(e.target.value)}
                      className="w-full h-9 rounded-[9px] border border-[#CBD5E1] bg-white px-2.5 font-mono text-xs font-semibold text-[#0F172A] focus:border-[#059669] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {editNotice && (
                <div
                  className={`rounded-[9px] px-2.5 py-1.5 text-[11px] font-semibold ${
                    editNotice.isError
                      ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                      : 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                  }`}
                >
                  {editNotice.text}
                </div>
              )}
            </div>

            {/* FOOTER ACTION CỐ ĐỊNH — TRÁI: [Gỡ vị trí] [Block] [Xóa] [Khôi phục] (CHỈ ADMIN) | PHẢI: [Đóng] [Lưu cập nhật] */}
            <div className="shrink-0 h-[46px] px-3 sm:px-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {!isCreatingNew && editId && isStrictSuperAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={handleUnpinPlace3D}
                      className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] sm:text-[11.5px] font-semibold text-[#475569] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                      title="Gỡ vị trí trên bản đồ (chuyển về Chưa định vị)"
                    >
                      Gỡ vị trí
                    </button>
                    <button
                      type="button"
                      onClick={handleBlockPlace}
                      className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#FFFBEB] border border-[#F59E0B]/60 text-[11px] sm:text-[11.5px] font-semibold text-[#B45309] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                      title="Block (tạm khóa) địa điểm này"
                    >
                      Block
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePlace}
                      className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#FEF2F2] border border-[#FECACA] text-[11px] sm:text-[11.5px] font-semibold text-[#DC2626] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                      title="Xóa địa điểm khỏi bản đồ"
                    >
                      Xóa
                    </button>
                    {isOsmSeedSelected && (
                      <button
                        type="button"
                        onClick={handleRestoreDefault}
                        className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] sm:text-[11.5px] font-semibold text-[#475569] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                        title="Khôi phục về dữ liệu gốc"
                      >
                        Khôi phục
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPlace(false);
                    setIsCreatingNew(false);
                    setIsPicking3DGround(false);
                  }}
                  className="h-[35px] px-2.5 sm:px-3 rounded-[9px] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[11px] sm:text-[11.5px] font-semibold text-[#334155] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlace3D}
                  className="h-[35px] px-2.5 sm:px-3.5 rounded-[9px] bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-[11px] sm:text-[11.5px] font-semibold text-white whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                >
                  {isSavingPlace3D ? 'Đang lưu...' : 'Lưu cập nhật'}
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
