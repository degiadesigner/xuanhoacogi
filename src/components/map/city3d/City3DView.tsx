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
  KeyRound,
  Loader2,
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
import {
  findSuggestedRoadForAddress,
  geocodeAddressWithNominatim,
  hideLandmarkOrPlaceFromMap,
  parseCoordinatesFromInputOrUrl,
  restoreLandmarkOrPlaceDefault,
  saveLandmarkOrPlaceFromMap,
  VERIFIED_OSM_POIS,
  VERIFIED_OSM_ROADS_SEED,
} from '@/lib/map/map-data';
import {
  isAdminAuthenticated,
  isMapManagerAuthenticated,
  loginAdminWithCredentials,
  verifyAndClaimPlaceWithCode,
} from '@/lib/admin-store';
import { renderCategoryIcon } from '@/components/map/MapCategoryPanel';
import {
  CITY3D_COLORS,
  TREE_PALETTE,
  lngLatToLocal,
  localToLngLat,
  type BuildingChunk,
  type BuildingLabel,
  type City3DOrigin,
  type MeshBuffers,
  type RoadLabel3D,
  type TreeChunk,
  type WorkerOutMessage,
} from './city3d-shared';
import { reverseAreaName } from './city3d-live';
import {
  SKY,
  createSkyDome,
  patchBuildingMaterial,
  patchCrownMaterial,
  patchFlatMaterial,
  type FlatKind,
} from './city3d-materials';

export interface City3DViewProps {
  initialCenter: { lat: number; lng: number };
  places: PlaceLocation[];
  onClose: () => void;
  /** Mở trang chi tiết quán (PlaceModal) */
  onOpenPlace?: (place: PlaceLocation) => void;
  /** Quay về bản đồ 2D và chọn quán */
  onShowPlaceIn2D?: (place: PlaceLocation) => void;
  /** Trạng thái quyền Admin từ ngoài truyền vào */
  isAdminUser?: boolean;
  /** Báo hiệu dữ liệu địa danh/quán đã thay đổi để 2D & Admin đồng bộ tức thì */
  onDataChanged?: () => void;
  /** Mở thẳng trang Web Admin (#admin) */
  onOpenWebAdmin?: (placeId?: string) => void;
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
  places,
  onClose,
  onOpenPlace,
  onShowPlaceIn2D,
  isAdminUser: propIsAdmin,
  onDataChanged,
  onOpenWebAdmin,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const compassIconRef = useRef<SVGSVGElement | null>(null);
  const pinElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const labelElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const roadLabelElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const draftMarkerElRef = useRef<HTMLDivElement | null>(null);

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
  const [shadowsOn, setShadowsOn] = useState<boolean>(() => !isCoarsePointer());
  const [showCivic, setShowCivic] = useState<boolean>(true);
  const [showShops, setShowShops] = useState<boolean>(false);
  const [showRoadNames, setShowRoadNames] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveState, setLiveState] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  });
  const [selected, setSelected] = useState<PlaceLocation | null>(null);

  // Quyền Admin & Chỉnh sửa trực tiếp trên Sa Bàn 3D
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean>(() =>
    Boolean(propIsAdmin || isAdminAuthenticated() || isMapManagerAuthenticated())
  );
  useEffect(() => {
    if (propIsAdmin) setHasAdminAccess(true);
  }, [propIsAdmin]);

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
    if (p.category === 'school' || p.category === 'public') {
      return true;
    }
    return (
      p.dataSource === 'openstreetmap' &&
      p.category !== 'food' &&
      p.category !== 'cafe' &&
      p.category !== 'snack' &&
      p.category !== 'pub' &&
      p.category !== 'billiards' &&
      p.category !== 'game' &&
      p.category !== 'phone'
    );
  }, []);

  const totalShopsCount = useMemo(
    () => places.filter((p) => p.lat !== null && p.lng !== null && !isCivicLandmark(p)).length,
    [places, isCivicLandmark]
  );

  const placesWithCoords = useMemo(
    () =>
      places.filter((p) => {
        if (p.lat === null || p.lng === null) return false;
        if (selected?.id === p.id) return true;
        return isCivicLandmark(p) ? showCivic : showShops;
      }),
    [places, showCivic, showShops, isCivicLandmark, selected?.id]
  );

  // Tiền tính toán tọa độ local (lx, lz) và kích thước hộp chữ cho mọi ghim (tránh tính lại mỗi frame)
  const precomputedPins = useMemo<PrecomputedPin[]>(() => {
    if (!originState) return [];
    const list: PrecomputedPin[] = [];
    for (const p of placesWithCoords) {
      if (p.lat === null || p.lng === null) continue;
      const [x, y] = lngLatToLocal(originState, p.lng, p.lat);
      list.push({
        place: p,
        lx: x,
        lz: -y,
        halfW: Math.min(82, p.name.length * 3.1 + 16),
      });
    }
    // Ưu tiên ghim đang chọn lên đầu mảng để không bao giờ bị ẩn do va chạm nhãn
    if (selected) {
      list.sort((a, b) => (a.place.id === selected.id ? -1 : b.place.id === selected.id ? 1 : 0));
    }
    return list;
  }, [placesWithCoords, originState, selected]);

  const precomputedBuildingLabels = useMemo<PrecomputedBuildingLabel[]>(
    () =>
      labels.map((lb, index) => ({
        label: lb,
        index,
        halfW: lb.name.length * 3.0 + 10,
      })),
    [labels]
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
  const showCivicRef = useRef(showCivic);
  showCivicRef.current = showCivic;
  const shadowsRef = useRef(shadowsOn);
  shadowsRef.current = shadowsOn;
  const isReadyRef = useRef(false);
  isReadyRef.current = isReady;
  const isPicking3DRef = useRef(isPicking3DGround);
  isPicking3DRef.current = isPicking3DGround;

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.4 : 1.75));
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
    sun.castShadow = true;
    sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
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
      if (cx !== t.x || cz !== t.z || t.y !== 0) {
        const dx = cx - t.x,
          dz = cz - t.z;
        t.set(cx, 0, cz);
        camera.position.x += dx;
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
          tmpV.set(dx, 6, -dy).project(camera);
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

      // 1. Ghim địa danh & quán ăn
      const pins = pinsRef.current;
      for (let i = 0; i < pins.length; i++) {
        const item = pins[i];
        const el = pinElsRef.current.get(item.place.id);
        if (!el) continue;
        tmpV.set(item.lx, 6, item.lz).project(camera);
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
        tmpV.set(rl.x, 0.35, rl.z);
        if (tmpV.distanceTo(camera.position) > item.maxDist) {
          setElVis(el, false);
          continue;
        }
        tmpV.set(rl.x - rl.dx * 16, 0.35, rl.z - rl.dz * 16).project(camera);
        tmpV2.set(rl.x + rl.dx * 16, 0.35, rl.z + rl.dz * 16).project(camera);
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

    // Hỗ trợ Admin click trực tiếp lên mặt đất 3D để lấy tọa độ cắm ghim / dời ghim
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
      if (!isPicking3DRef.current || ev.button !== 0) return;
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
      const o = engineRef.current?.origin;
      if (!o) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.ray.intersectPlane(GROUND_PLANE, hitPoint)) {
        const [lng, lat] = localToLngLat(o, hitPoint.x, -hitPoint.z);
        const fixedLat = Number(lat.toFixed(6));
        const fixedLng = Number(lng.toFixed(6));
        setEditLat(String(fixedLat));
        setEditLng(String(fixedLng));
        setIsPicking3DGround(false);
        setEditNotice({
          text: `📍 Đã chấm vị trí trên mặt đất 3D (${fixedLat}, ${fixedLng}). Hãy bấm "Lưu cập nhật"!`,
        });
        requestRender();
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
      const mesh = new THREE.Mesh(geometryFrom(m), mat);
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
      const nB = c.broadleaf.length / 5,
        nC = c.conifer.length / 5;
      if (!nB && !nC) return;
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      const crowns = nB ? new THREE.InstancedMesh(crownGeo, crownMat, nB) : null;
      const cones = nC ? new THREE.InstancedMesh(coniferGeo, crownMat, nC) : null;
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, nB + nC);
      let ti = 0;
      const fill = (arr: Float32Array, mesh: THREE.InstancedMesh | null) => {
        if (!mesh) return;
        for (let i = 0; i < arr.length / 5; i++) {
          const x = arr[i * 5],
            z = arr[i * 5 + 1],
            s = arr[i * 5 + 2],
            rot = arr[i * 5 + 3];
          dummy.position.set(x, 0, z);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(s, s * (0.9 + (rot % 0.3)), s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, treeColors[arr[i * 5 + 4] | 0]);
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
      controls.target.set(x, 0, -y);
      const d = 620;
      const polar = 0.92;
      const az = -0.35;
      camera.position.set(
        x + d * Math.sin(polar) * Math.sin(az),
        d * Math.cos(polar),
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
  }, [precomputedPins, precomputedBuildingLabels, precomputedRoadLabels, showCivic, showShops, showRoadNames]);

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
    const off = eng.camera.position.clone().sub(eng.controls.target);
    off.setLength(Math.min(off.length(), targetDist));
    eng.animateTo(new THREE.Vector3(x, 0, -y), off, 700);
  }, []);

  const flyToPlace = useCallback(
    (p: PlaceLocation) => {
      if (p.lat === null || p.lng === null) return;
      flyToCoordinates3D(p.lat, p.lng, 300);
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
        text: `✓ Đã tự động bóc tách tọa độ (${parsed.lat}, ${parsed.lng}) và bay tới vị trí!`,
      });
      flyToCoordinates3D(parsed.lat, parsed.lng, 260);
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
        phone: editPhone,
        openHours: editHours,
        lat,
        lng,
        mapsUrl: editMapsInput,
      });

      // Tự động bật bộ lọc tương ứng để Admin thấy ngay ghim vừa lưu
      const isCivic = editCategory === 'public' || editCategory === 'school';
      if (isCivic && !showCivic) setShowCivic(true);
      if (!isCivic && !showShops) setShowShops(true);

      onDataChanged?.();
      flyToCoordinates3D(saved.lat, saved.lng, 260);
      setIsEditingPlace(false);
      setIsCreatingNew(false);
      setIsPicking3DGround(false);
      setLiveState({
        busy: false,
        message: `✅ Đã lưu địa danh "${editName.trim()}" (${saved.lat}, ${saved.lng})!`,
      });
    } catch (err: any) {
      setEditNotice({ text: err?.message || 'Lỗi khi lưu địa danh.', isError: true });
    }
  };

  const handleDeletePlace = () => {
    if (!editId) return;
    hideLandmarkOrPlaceFromMap(editId, editName);
    onDataChanged?.();
    setIsEditingPlace(false);
    setSelected(null);
    setLiveState({
      busy: false,
      message: `🗑️ Đã ẩn "${editName}" khỏi Bản đồ 2D & 3D.`,
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
    // Hỗ trợ đăng nhập bằng tài khoản Admin (VD: admin / 123) hoặc mã Quản lý Maps (XH-MAPS-8899)
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
    setLoginErr(res.message || 'Tài khoản hoặc mật khẩu Admin chưa đúng!');
  };

  useEffect(() => {
    if (!liveState.message || liveState.busy) return;
    const id = window.setTimeout(() => setLiveState((s) => ({ ...s, message: null })), 5500);
    return () => window.clearTimeout(id);
  }, [liveState]);

  /* ================================================================ giao diện tối ưu không gian */
  const ctrlBtn =
    'w-9 h-9 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition cursor-pointer';
  const isOsmSeedSelected = useMemo(
    () => Boolean(editId && VERIFIED_OSM_POIS.some((p) => p.id === editId)),
    [editId]
  );

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 z-[45] overflow-hidden select-none ${
        isPicking3DGround ? 'cursor-crosshair' : ''
      }`}
      style={{ fontFamily: FONT, background: CITY3D_COLORS.sky }}
    >
      <div
        ref={canvasHostRef}
        className={`absolute inset-0 ${isPicking3DGround ? 'cursor-crosshair' : ''}`}
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
            🎯 {editName.trim() || 'Vị trí đang chọn'}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-white bg-[#F59E0B] text-white shadow-[0_0_16px_rgba(245,158,11,0.9)] animate-pulse">
            <Crosshair size={16} />
          </span>
          <span className="h-2.5 w-0.5 bg-[#F59E0B]" />
        </div>

        {precomputedPins.map(({ place: p }) => {
          const cat = MAP_CATEGORY_BY_ID[p.category];
          const isSel = selected?.id === p.id;
          const isBeingEdited = isEditingPlace && editId === p.id;
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
                zIndex: isSel ? 99999 : 10,
              }}
              title={p.name}
            >
              <span
                className={`city3d-pin-name mb-0.5 max-w-[148px] truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-bold shadow-sm border ${
                  isSel
                    ? 'bg-[#1E1633] text-[#FBBF24] border-[#FBBF24]'
                    : 'bg-white/95 text-[#2D2246] border-[#403064]/20'
                }`}
              >
                {p.name}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white shadow-[0_3px_10px_rgba(0,0,0,0.32)] transition-transform group-hover:scale-110 ${
                  isSel ? 'ring-2 ring-[#FBBF24] scale-110' : ''
                }`}
                style={{ background: isSel ? '#403064' : cat?.markerBg || '#39B980' }}
              >
                {cat ? renderCategoryIcon(cat.iconName, 14) : <MapPin size={14} />}
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
            className="absolute left-0 top-0 whitespace-nowrap rounded bg-[#2D2246]/80 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-xs"
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
                ? 'bg-[#FEF3C7]/95 text-[#78350F] border border-[#F59E0B]/60 text-[10.5px]'
                : rl.tier === 'secondary'
                ? 'bg-white/92 text-[#1E293B] border border-slate-400/50 text-[10px]'
                : 'bg-white/85 text-[#334155] border border-slate-300/50 text-[9.5px]'
            }`}
            style={{ visibility: 'hidden', willChange: 'transform' }}
          >
            {rl.name}
          </div>
        ))}
      </div>

      {/* Thanh điều hướng & bộ lọc cân đối chuẩn Google Maps / Apple Maps (Sang, Xịn, Không Copyright) */}
      <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* CỤM TRÁI: Thanh Tìm kiếm & Nút 2D tích hợp nguyên khối sang trọng */}
        <div className="pointer-events-auto relative flex items-center rounded-full bg-white/95 border border-slate-200/90 pl-1.5 pr-3 py-1 shadow-[0_6px_24px_rgba(15,23,42,0.12)] backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-full bg-[#1E1633] hover:bg-[#2D2246] text-white px-3 py-1 text-[11.5px] font-extrabold transition cursor-pointer shrink-0"
            title="Chuyển về Bản đồ 2D"
          >
            <ArrowLeft size={13} />
            <span>Bản đồ 2D</span>
          </button>
          <div className="mx-2 h-4 w-[1px] bg-slate-200 shrink-0" />
          <Search size={14} className="text-slate-500 shrink-0 mr-1.5" />
          <input
            type="text"
            value={search3DQuery}
            onFocus={() => setIsSearch3DFocused(true)}
            onBlur={() => window.setTimeout(() => setIsSearch3DFocused(false), 180)}
            onChange={(e) => setSearch3DQuery(e.target.value)}
            placeholder="Tìm đường, ngõ, cơ quan, quán..."
            className="w-40 sm:w-56 bg-transparent text-[12px] font-semibold text-slate-800 placeholder-slate-400 outline-none"
          />
          {search3DQuery && (
            <button
              type="button"
              onClick={() => setSearch3DQuery('')}
              className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}

          {(isSearch3DFocused || search3DQuery.trim().length > 0) &&
            search3DQuery.trim().length > 0 && (
              <div className="absolute left-0 top-full mt-2 w-80 max-h-68 overflow-y-auto rounded-2xl bg-white/98 border border-slate-200 shadow-[0_16px_40px_rgba(15,23,42,0.18)] p-1.5 z-40 space-y-1 backdrop-blur-md">
                {/* Gợi ý Đường & Ngõ */}
                {Array.from(new Map(roadLabels.map((r) => [r.name, r])).values())
                  .filter((r) =>
                    r.name.toLowerCase().includes(search3DQuery.trim().toLowerCase())
                  )
                  .slice(0, 4)
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
                          🛣️ {r.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Tuyến đường / ngõ Phường Xuân Hòa
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 shrink-0">
                        Bay tới →
                      </span>
                    </button>
                  ))}

                {/* Gợi ý Địa danh / Cơ quan / Quán */}
                {places
                  .filter(
                    (p) =>
                      p.lat !== null &&
                      p.lng !== null &&
                      (p.name.toLowerCase().includes(search3DQuery.trim().toLowerCase()) ||
                        (p.address || '')
                          .toLowerCase()
                          .includes(search3DQuery.trim().toLowerCase()))
                  )
                  .slice(0, 7)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const civic = isCivicLandmark(item);
                        if (civic && !showCivic) setShowCivic(true);
                        if (!civic && !showShops) setShowShops(true);
                        setSelected(item);
                        flyToPlace(item);
                        setSearch3DQuery('');
                        setIsSearch3DFocused(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-emerald-50 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-extrabold text-slate-800 truncate">
                          📍 {item.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{item.address}</div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                        Bay tới →
                      </span>
                    </button>
                  ))}
              </div>
            )}
        </div>

        {/* CỤM GIỮA: Bộ lọc danh mục cân đối chuẩn Google Maps (Pill Chips sang trọng) */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-full bg-white/90 border border-slate-200/85 p-1 shadow-[0_6px_24px_rgba(15,23,42,0.10)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              const allOn = showCivic && showShops && showRoadNames;
              setShowCivic(true);
              setShowRoadNames(true);
              setShowShops(!allOn);
            }}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer ${
              showCivic && showShops
                ? 'bg-[#1E1633] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Hiển thị đầy đủ tất cả địa danh, cơ quan, trường học & quán ăn"
          >
            ✨ Tất cả
          </button>

          <button
            type="button"
            onClick={() => setShowCivic((v) => !v)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer ${
              showCivic
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Cơ quan hành chính, Trường học, Y tế, Địa danh"
          >
            🏛️ Cơ quan & Trường học
          </button>

          <button
            type="button"
            onClick={() => setShowShops((v) => !v)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer ${
              showShops
                ? 'bg-[#E11D48] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Nhà hàng, Quán ăn, Cafe & Dịch vụ"
          >
            🍜 Ẩm thực & Dịch vụ ({totalShopsCount})
          </button>

          <button
            type="button"
            onClick={() => setShowRoadNames((v) => !v)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer ${
              showRoadNames
                ? 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/60 shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Bật / tắt tên đường & ngõ nhỏ"
          >
            🛣️ Tên đường & Ngõ
          </button>
        </div>

        {/* CỤM PHẢI: Thêm địa điểm & Quản trị gọn gàng */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/92 border border-slate-200/85 p-1 shadow-[0_6px_24px_rgba(15,23,42,0.10)] backdrop-blur-md">
          <button
            type="button"
            onClick={openCreateNewModal}
            className="flex items-center gap-1 rounded-full bg-[#1E1633] hover:bg-[#2D2246] text-white px-3 py-1 text-[11.5px] font-bold transition cursor-pointer"
            title="Thêm địa danh / cơ quan / quán mới lên bản đồ"
          >
            <Plus size={13} />
            <span>Thêm địa điểm</span>
          </button>

          {hasAdminAccess ? (
            onOpenWebAdmin && (
              <button
                type="button"
                onClick={() => onOpenWebAdmin(selected?.id)}
                className="flex items-center gap-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 px-3 py-1 text-[11.5px] font-bold cursor-pointer transition"
                title="Mở trang Quản trị Web Admin đầy đủ"
              >
                <ShieldCheck size={13} className="text-amber-600" />
                <span>Quản trị</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-[11.5px] font-bold cursor-pointer transition"
              title="Đăng nhập Admin để chỉnh sửa địa danh & vị trí"
            >
              <KeyRound size={12} />
              <span>Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Thanh nhắc khi đang ở chế độ chấm vị trí trực tiếp trên mặt đất 3D */}
      {isPicking3DGround && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-2xl bg-[#F59E0B] px-4 py-2 text-xs font-extrabold text-white shadow-xl border-2 border-white animate-bounce">
          <Crosshair size={16} />
          <span>Hãy click chuột trái vào đúng ngôi nhà / vị trí trên mặt đất 3D để đặt ghim!</span>
          <button
            type="button"
            onClick={() => setIsPicking3DGround(false)}
            className="ml-1 rounded-lg bg-black/20 px-2 py-0.5 text-[11px] hover:bg-black/30 cursor-pointer"
          >
            Hủy
          </button>
        </div>
      )}

      {/* Cụm điều khiển bên phải gọn gàng */}
      <div className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 flex flex-col overflow-hidden rounded-2xl bg-[#1E1633]/85 shadow-xl backdrop-blur-md divide-y divide-white/10">
        <button type="button" className={ctrlBtn} onClick={() => zoomBy(0.62)} title="Phóng to">
          <Plus size={17} />
        </button>
        <button type="button" className={ctrlBtn} onClick={() => zoomBy(1.6)} title="Thu nhỏ">
          <Minus size={17} />
        </button>
        <button type="button" className={ctrlBtn} onClick={() => rotateBy(-35)} title="Xoay trái">
          <RotateCcw size={16} />
        </button>
        <button type="button" className={ctrlBtn} onClick={() => rotateBy(35)} title="Xoay phải">
          <RotateCw size={16} />
        </button>
        <button type="button" className={ctrlBtn} onClick={resetNorth} title="Về hướng Bắc">
          <Compass ref={compassIconRef} size={17} style={{ transform: 'rotate(-45deg)' }} />
        </button>
        <button
          type="button"
          className={ctrlBtn}
          onClick={() => setShadowsOn((v) => !v)}
          title={shadowsOn ? 'Tắt bóng đổ (nhẹ máy hơn)' : 'Bật bóng đổ'}
        >
          {shadowsOn ? <Sun size={17} className="text-[#FBBF24]" /> : <SunDim size={17} />}
        </button>
        <button type="button" className={ctrlBtn} onClick={toggleFullscreen} title="Toàn màn hình">
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Thông báo trạng thái lưu / cập nhật nhanh (Đã bỏ hoàn toàn nút búa công cụ vẽ thừa) */}
      {isReady && !isEditingPlace && !isCreatingNew && liveState.message && (
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 max-w-[90vw] pointer-events-none">
          <div className="pointer-events-auto rounded-full bg-[#1E1633]/92 px-4 py-1.5 text-center text-[11.5px] font-semibold text-white shadow-lg backdrop-blur-md">
            {liveState.message}
          </div>
        </div>
      )}

      {/* Thẻ thông tin Địa danh / Quán đang chọn (Góc dưới trái) */}
      {selected && !isEditingPlace && !isCreatingNew && (
        <div className="absolute left-2.5 bottom-16 sm:bottom-4 z-20 w-[min(92vw,340px)] rounded-2xl border-2 border-[#403064] bg-[#FFFDF9]/98 p-3 text-[#2D2246] shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1 rounded-md bg-[#E6F7EF] px-2 py-0.5 text-[10.5px] font-extrabold text-[#047857]">
                {MAP_CATEGORY_BY_ID[selected.category]?.label || 'Địa điểm công cộng'}
              </div>
              <div className="mt-1 text-[14.5px] font-extrabold leading-snug text-[#1E1633]">
                {selected.name}
              </div>
              {selected.address && (
                <div className="mt-0.5 text-[11.5px] font-medium text-[#65587F] line-clamp-2">
                  📍 {selected.address}
                </div>
              )}
              {(selected.phone || selected.openHours) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold text-[#334155]">
                  {selected.phone && (
                    <a
                      href={`tel:${selected.phone}`}
                      className="inline-flex items-center gap-1 text-[#047857] hover:underline"
                    >
                      <Phone size={11} /> {selected.phone}
                    </a>
                  )}
                  {selected.openHours && (
                    <span className="inline-flex items-center gap-1 text-[#64748B]">
                      <Clock size={11} /> {selected.openHours}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg bg-[#F1ECE1] p-1 text-[#403064] hover:bg-[#E5DEC9] cursor-pointer shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {onOpenPlace && selected.originalPlace && !isCivicLandmark(selected) && (
              <button
                type="button"
                onClick={() => onOpenPlace(selected)}
                className="flex-1 rounded-xl bg-[#059669] hover:bg-[#047857] px-2.5 py-1.5 text-[11.5px] font-extrabold text-white cursor-pointer"
              >
                Xem thực đơn
              </button>
            )}
            {onShowPlaceIn2D && (
              <button
                type="button"
                onClick={() => onShowPlaceIn2D(selected)}
                className="flex-1 rounded-xl border border-[#403064] bg-white hover:bg-[#F8F5EE] px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#403064] cursor-pointer"
              >
                Chỉ đường (2D)
              </button>
            )}
            <button
              type="button"
              onClick={() => openEditForPlace(selected)}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#F59E0B] px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#92400E] cursor-pointer"
              title="Sửa tên gọi, vị trí, số điện thoại, icon của địa danh này"
            >
              <Pencil size={12} /> Sửa / Định vị
            </button>
          </div>
        </div>
      )}

      {/* Khung Chỉnh sửa / Thêm mới Địa danh & Định vị trực tiếp trên 3D (Gọn gàng góc trái) */}
      {(isEditingPlace || isCreatingNew) && (
        <div className="absolute left-2.5 bottom-3 top-14 z-20 flex items-end pointer-events-none">
          <form
            onSubmit={handleSavePlaceEdit}
            className="pointer-events-auto w-[min(94vw,375px)] max-h-full overflow-y-auto rounded-2xl border-2 border-[#403064] bg-[#FFFDF9]/98 p-3.5 text-xs text-[#2D2246] shadow-2xl space-y-2.5 backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-2">
              <div>
                <span className="inline-flex items-center gap-1 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-extrabold text-[#92400E]">
                  {isCreatingNew ? '➕ THÊM ĐỊA DANH MỚI' : '✏️ CHỈNH SỬA ĐỊA DANH & VỊ TRÍ'}
                </span>
                <h3 className="text-[13.5px] font-extrabold text-[#1E1633] mt-0.5">
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
                className="rounded-lg bg-[#F1ECE1] p-1 text-[#403064] cursor-pointer"
              >
                <X size={15} />
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
                  Loại & Biểu tượng (Icon)
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

            {/* Khung Định vị bằng Link Maps / Plus Code / Địa chỉ / Chấm trên 3D */}
            <div className="rounded-xl bg-[#F8F5EE] border border-[#E5DEC9] p-2.5 space-y-2">
              <label className="block text-[11px] font-extrabold text-[#1D7A52]">
                📍 Định vị (Dán Link Google Maps, Plus Code hoặc gõ địa chỉ):
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
                  className="inline-flex items-center gap-1 rounded-lg bg-[#059669] hover:bg-[#047857] px-2.5 py-1.5 text-[11px] font-extrabold text-white cursor-pointer shrink-0"
                >
                  {isGeocoding ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  <span>Tìm</span>
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
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-[11px] font-extrabold cursor-pointer transition ${
                    isPicking3DGround
                      ? 'bg-[#F59E0B] text-white shadow-inner'
                      : 'bg-[#403064] hover:bg-[#2D2246] text-white'
                  }`}
                >
                  <Crosshair size={13} />
                  <span>
                    {isPicking3DGround
                      ? 'Đang chờ bạn click lên mặt đất 3D…'
                      : '🎯 Chấm vị trí trên mặt đất 3D'}
                  </span>
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
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDeletePlace}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] px-2.5 py-1.5 text-[11px] font-bold text-[#991B1B] cursor-pointer"
                    title="Ẩn địa danh này khỏi bản đồ"
                  >
                    <Trash2 size={12} /> Ẩn
                  </button>
                  {isOsmSeedSelected && (
                    <button
                      type="button"
                      onClick={handleRestoreDefault}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] px-2 py-1.5 text-[11px] font-bold text-[#475569] cursor-pointer"
                      title="Khôi phục về dữ liệu gốc"
                    >
                      ↺ Gốc
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                {onOpenWebAdmin && editId && (
                  <button
                    type="button"
                    onClick={() => onOpenWebAdmin(editId)}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#F1ECE1] hover:bg-[#E5DEC9] px-2.5 py-1.5 text-[11px] font-bold text-[#403064] cursor-pointer"
                    title="Mở trong Web Admin"
                  >
                    <ExternalLink size={12} /> Admin
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-[#059669] hover:bg-[#047857] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-md cursor-pointer"
                >
                  <Check size={14} /> Lưu cập nhật
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
          onClick={() => setIsLoginModalOpen(false)}
        >
          <form
            onSubmit={handleAdminQuickLogin}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(90vw,340px)] rounded-2xl border-2 border-[#403064] bg-[#FFFDF9] p-4 text-xs text-[#2D2246] shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-sm text-[#1E1633] flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-[#059669]" /> Mở khóa Quản trị Bản đồ
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="rounded-lg bg-[#F1ECE1] p-1 text-[#403064] cursor-pointer"
              >
                <X size={14} />
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

      {/* Màn hình đang dựng */}
      {(!isReady || error) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#DCE7EF]/70 backdrop-blur-[2px] pointer-events-none">
          <div className="pointer-events-auto w-[min(88vw,360px)] rounded-3xl border-2 border-[#403064] bg-[#FFFDF9] p-5 text-center shadow-2xl">
            {error ? (
              <>
                <div className="text-[15px] font-extrabold text-[#B91C1C]">Không mở được Bản đồ 3D</div>
                <div className="mt-1.5 text-[13px] font-medium text-[#2D2246]">{error}</div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 rounded-xl bg-[#403064] px-4 py-2 text-sm font-bold text-white cursor-pointer"
                >
                  Quay lại bản đồ 2D
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-[15px] font-extrabold text-[#2D2246]">
                  <Building2 size={18} className="text-[#059669]" /> Đang dựng thành phố 3D
                </div>
                <div className="mt-1 text-[12.5px] font-medium text-[#65587F]">{progress.label}</div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#E5DEC9]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] transition-all duration-300"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </>
            )}
          </div>
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
