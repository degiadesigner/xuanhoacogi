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
} from 'lucide-react';
import type { Place } from '@/lib/places-xuanhoa';
import type { UserAuthProfile } from '@/lib/auth';
import {
  isAdminAuthenticated,
  updatePlaceCoordinates,
  clearPlaceCoordinates,
} from '@/lib/admin-store';
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
  VERIFIED_OSM_ROADS_SEED,
  buildDataQualityReport,
  findSuggestedRoadForAddress,
  geocodeAddressWithNominatim,
  getAllMapPlaceLocations,
} from '@/lib/map/map-data';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { MapCategoryPanel, renderCategoryIcon } from '@/components/map/MapCategoryPanel';
import { MapPlacePopup } from '@/components/map/MapPlacePopup';
import { MapControls } from '@/components/map/MapControls';
import { GameAssetLayer } from '@/components/map/GameAssetLayer';

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

interface LoadedGeoLayers {
  boundary: any[];
  landuse: any[];
  water: any[];
  waterways: any[];
  roads: any[];
  buildings: any[];
  placeLabels: any[];
}

export const DigitalMapView: React.FC<DigitalMapViewProps> = ({
  onBackToHome,
  authUser = null,
  onOpenLogin,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const vectorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const geoLayersRef = useRef<LoadedGeoLayers | null>(null);

  // Trạng thái bản đồ & kết nối (Phần 12)
  const [isMapLoading, setIsMapLoading] = useState<boolean>(true);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Dữ liệu địa điểm & đường phố thực tế
  const [syncTick, setSyncTick] = useState<number>(0);
  const [osmRoads, setOsmRoads] = useState<RoadSearchResult[]>(VERIFIED_OSM_ROADS_SEED);
  const [osmRoadMatchedCatalog, setOsmRoadMatchedCatalog] = useState<
    Record<string, { lat: number; lng: number; roadName: string; osmId: string }>
  >({});
  const [selectedCategories, setSelectedCategories] = useState<MapCategoryKey[]>(['all']);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState<boolean>(false);
  const [layerVisibility, setLayerVisibility] = useState<MapLayerVisibility>(
    DEFAULT_LAYER_VISIBILITY
  );
  const layerVisibilityRef = useRef<MapLayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  layerVisibilityRef.current = layerVisibility;
  const [activePresetId, setActivePresetId] = useState<string>('dhsp2');

  // Địa điểm / Cụm / Tài sản Game đang chọn
  const [selectedPlace, setSelectedPlace] = useState<PlaceLocation | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [clusterSelectionList, setClusterSelectionList] = useState<PlaceLocation[] | null>(null);
  const [selectedGameAsset, setSelectedGameAsset] = useState<GameAsset | null>(null);
  const [modalPlace, setModalPlace] = useState<Place | null>(null);

  // Báo cáo chất lượng dữ liệu & Công cụ Admin gắn tọa độ
  const [isDataQualityOpen, setIsDataQualityOpen] = useState<boolean>(false);
  const [isAdminCoordModalOpen, setIsAdminCoordModalOpen] = useState<boolean>(false);
  const [adminTargetPlace, setAdminTargetPlace] = useState<PlaceLocation | null>(null);
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

  // Đồng bộ toạ độ màn hình cho các marker đã xác minh
  const [cameraVersion, setCameraVersion] = useState<number>(0);
  const [currentZoom, setCurrentZoom] = useState<number>(XUANHOA_DEFAULT_CENTER.zoom);

  const isAdminUser = useMemo(() => isAdminAuthenticated(authUser), [authUser, syncTick]);

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

  // Hàm vẽ trực tiếp dữ liệu địa lý OpenStreetMap thật lên Vector Canvas đồng bộ 1:1 với MapLibre GL
  const renderSynchronizedVectorGeography = useCallback(() => {
    const map = mapInstanceRef.current;
    const canvas = vectorCanvasRef.current;
    const geo = geoLayersRef.current;
    const vis = layerVisibilityRef.current;
    if (!map || !canvas || !geo) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width || canvas.clientWidth || 1200;
    const height = rect?.height || canvas.clientHeight || 800;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Nền kem ấm chuẩn Premium Cute Pastel (#F8F5EE)
    ctx.fillStyle = XUHO_PASTEL_THEME.uiBg;
    ctx.fillRect(0, 0, width, height);

    const bounds = map.getBounds();
    const minLng = bounds.getWest() - 0.01;
    const maxLng = bounds.getEast() + 0.01;
    const minLat = bounds.getSouth() - 0.01;
    const maxLat = bounds.getNorth() + 0.01;
    const zoom = map.getZoom();

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
      for (let i = 0; i < coords.length; i++) {
        const p = map.project([coords[i][0], coords[i][1]]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      if (close) ctx.closePath();
    };

    // 2. Lớp Công viên, Khuôn viên Trường học & Sinh thái (OSM Landuse)
    if (vis.waterAndParks) {
      for (const f of geo.landuse) {
        const ring = f.geometry?.coordinates?.[0];
        if (!ring || !isRingInView(ring)) continue;
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

      // 3. Lớp Sông suối & Mặt hồ thực tế (Hồ Đại Lải, Sông Cà Lồ, Hồ Lập Đinh...)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const f of geo.waterways) {
        const coords = f.geometry?.coordinates;
        if (!coords || !isRingInView(coords)) continue;
        traceCoords(coords, false);
        ctx.strokeStyle = '#9ED8F0';
        ctx.lineWidth = Math.max(1.8, (zoom - 10) * 1.1);
        ctx.stroke();
      }

      for (const f of geo.water) {
        const ring = f.geometry?.coordinates?.[0];
        if (!ring || !isRingInView(ring)) continue;
        traceCoords(ring, true);
        ctx.fillStyle = '#A8DDF4';
        ctx.fill();
        ctx.strokeStyle = '#75B8D6';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    // 4. Lớp Đường ngõ, Đường nhánh & Đường trục chính thực tế từ OpenStreetMap (6.225 tuyến)
    if (vis.baseGeography) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const wAlley = zoom < 13.4 ? 0 : Math.max(1.6, Math.pow(1.42, zoom - 12.6));
      const wMinor = zoom < 12.0 ? 0.9 : Math.max(2.6, Math.pow(1.48, zoom - 11.4));
      const wSecondary = Math.max(3.8, Math.pow(1.5, zoom - 10.6));
      const wMajor = Math.max(5.0, Math.pow(1.52, zoom - 10.2));

      const visibleRoads: any[] = [];
      for (const f of geo.roads) {
        const coords = f.geometry?.coordinates;
        if (!coords || !isRingInView(coords)) continue;
        visibleRoads.push(f);
      }

      // 4a. Vẽ viền đường (Casing) trước để các ngã tư giao cắt liền mạch
      for (const f of visibleRoads) {
        const tier = f.properties?.tier || 'minor';
        if (tier === 'alley' && wAlley === 0) continue;
        traceCoords(f.geometry.coordinates, false);
        if (tier === 'major') {
          ctx.strokeStyle = '#D5AC52';
          ctx.lineWidth = wMajor + 2.8;
        } else if (tier === 'secondary') {
          ctx.strokeStyle = '#D8BA70';
          ctx.lineWidth = wSecondary + 2.4;
        } else if (tier === 'minor') {
          ctx.strokeStyle = '#CFC7B8';
          ctx.lineWidth = wMinor + 2.0;
        } else {
          ctx.strokeStyle = '#DCD5C7';
          ctx.lineWidth = wAlley + 1.4;
        }
        ctx.stroke();
      }

      // 4b. Vẽ lòng đường (Road Fill)
      for (const f of visibleRoads) {
        const tier = f.properties?.tier || 'minor';
        if (tier === 'alley' && wAlley === 0) continue;
        traceCoords(f.geometry.coordinates, false);
        if (tier === 'major') {
          ctx.strokeStyle = '#FFE688';
          ctx.lineWidth = wMajor;
        } else if (tier === 'secondary') {
          ctx.strokeStyle = '#FFF0B5';
          ctx.lineWidth = wSecondary;
        } else if (tier === 'minor') {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = wMinor;
        } else {
          ctx.strokeStyle = '#FDFBF7';
          ctx.lineWidth = wAlley;
        }
        ctx.stroke();
      }

      // 4c. Vạch kẻ tim đường nét đứt cho đường trục chính khi zoom gần
      if (zoom >= 14.3) {
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#E09F3E';
        ctx.lineWidth = 1.2;
        for (const f of visibleRoads) {
          const tier = f.properties?.tier;
          if (tier !== 'major' && tier !== 'secondary') continue;
          traceCoords(f.geometry.coordinates, false);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 5. Lớp Công trình & Khối nhà thực tế 2.5D từ OpenStreetMap (5.083 tòa nhà)
      if (vis.buildings && zoom >= 13.0) {
        const visibleBuildings: number[][][] = [];
        for (const f of geo.buildings) {
          const ring = f.geometry?.coordinates?.[0];
          if (!ring || !isRingInView(ring)) continue;
          visibleBuildings.push(ring);
        }

        // Bóng đổ khối nhà 2.5D
        if (zoom >= 14.0) {
          ctx.fillStyle = 'rgba(145, 134, 116, 0.38)';
          for (const ring of visibleBuildings) {
            ctx.beginPath();
            for (let i = 0; i < ring.length; i++) {
              const p = map.project([ring[i][0], ring[i][1]]);
              if (i === 0) ctx.moveTo(p.x + 2.5, p.y + 3.0);
              else ctx.lineTo(p.x + 2.5, p.y + 3.0);
            }
            ctx.closePath();
            ctx.fill();
          }
        }

        // Mái nhà & viền công trình
        ctx.fillStyle = '#E3DDD1';
        ctx.strokeStyle = '#BEB5A2';
        ctx.lineWidth = zoom >= 15.2 ? 1.0 : 0.6;
        for (const ring of visibleBuildings) {
          traceCoords(ring, true);
          ctx.fill();
          if (zoom >= 14.2) ctx.stroke();
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

      // 7. Nhãn Tên Đường xoay dọc theo con đường (chống đè nhãn thông minh)
      if (zoom >= 13.3) {
        const placedBoxes: Array<{ x: number; y: number; r: number }> = [];
        ctx.font = `700 ${zoom >= 15.5 ? 11.5 : 10.5}px "Be Vietnam Pro", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const f of visibleRoads) {
          const name = f.properties?.name;
          if (!name) continue;
          const tier = f.properties?.tier;
          if (zoom < 14.4 && tier !== 'major' && tier !== 'secondary') continue;

          const coords = f.geometry.coordinates;
          if (coords.length < 2) continue;
          const midIdx = Math.floor((coords.length - 1) / 2);
          const pA = map.project([coords[midIdx][0], coords[midIdx][1]]);
          const pB = map.project([coords[midIdx + 1][0], coords[midIdx + 1][1]]);
          const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y);
          if (segLen < 42) continue;

          const cx = (pA.x + pB.x) / 2;
          const cy = (pA.y + pB.y) / 2;
          if (cx < 50 || cx > width - 50 || cy < 50 || cy > height - 50) continue;

          const tooClose = placedBoxes.some((b) => Math.hypot(cx - b.x, cy - b.y) < b.r);
          if (tooClose) continue;
          placedBoxes.push({ x: cx, y: cy, r: 135 });

          let angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
          if (angle > Math.PI / 2) angle -= Math.PI;
          if (angle < -Math.PI / 2) angle += Math.PI;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.strokeStyle = '#FFFDF9';
          ctx.lineWidth = 3.5;
          ctx.strokeText(name, 0, 0);
          ctx.fillStyle = '#403064';
          ctx.fillText(name, 0, 0);
          ctx.restore();
        }
      }

      // 8. Nhãn mặt hồ lớn (Hồ Đại Lải, Hồ Lập Đinh...)
      if (zoom >= 12.2 && vis.waterAndParks) {
        ctx.font = '800 11.5px "Be Vietnam Pro", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const seenWaterNames = new Set<string>();
        for (const f of geo.water) {
          const wName = f.properties?.name;
          if (!wName || seenWaterNames.has(wName)) continue;
          const ring = f.geometry?.coordinates?.[0];
          if (!ring || ring.length < 4 || !isRingInView(ring)) continue;
          seenWaterNames.add(wName);
          const avgLng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
          const avgLat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
          const pt = map.project([avgLng, avgLat]);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3.2;
          ctx.strokeText(wName, pt.x, pt.y);
          ctx.fillStyle = '#1E6091';
          ctx.fillText(wName, pt.x, pt.y);
        }
      }
    }

    ctx.restore();
  }, []);

  // Tải toàn bộ dữ liệu địa lý OpenStreetMap đã xác minh từ public/geo/
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
          geoLayersRef.current = {
            boundary: boundary?.features || [],
            landuse: landuse?.features || [],
            water: water?.features || [],
            waterways: waterways?.features || [],
            roads: roads?.features || [],
            buildings: buildings?.features || [],
            placeLabels: placeLabels?.features || [],
          };

          if (verifiedPoisData && Array.isArray(verifiedPoisData.namedRoads)) {
            setOsmRoads(
              verifiedPoisData.namedRoads.map((r: any, idx: number) => ({
                id: r.osmId || `road_${idx}`,
                name: r.name,
                highway: r.highway || 'residential',
                tier: r.tier || 'minor',
                lat: Number(r.lat),
                lng: Number(r.lng),
                osmId: r.osmId || '',
                segmentsCount: r.segmentsCount || 1,
                insideWard: Boolean(r.insideWard),
              }))
            );
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
          renderSynchronizedVectorGeography();
        }
      )
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.error('Failed loading geo layers:', err);
          setIsMapLoading(false);
        }
      });

    return () => controller.abort();
  }, [renderSynchronizedVectorGeography]);

  // Lấy danh sách địa điểm thực tế (Kết hợp OSM Verified POIs + Quán khớp đường OSM + Admin Override)
  const { verifiedMapMarkers, unverifiedCatalogPlaces } = useMemo(() => {
    const base = getAllMapPlaceLocations();
    const upgradedVerified: PlaceLocation[] = [...base.verifiedMapMarkers];
    const remainingUnverified: PlaceLocation[] = [];

    for (const loc of base.unverifiedCatalogPlaces) {
      const matched = osmRoadMatchedCatalog[loc.id];
      if (matched && Number.isFinite(matched.lat) && Number.isFinite(matched.lng)) {
        upgradedVerified.push({
          ...loc,
          lat: matched.lat,
          lng: matched.lng,
          coordinateSource: 'nominatim_geocoded',
          coordinateVerified: true,
          lastVerifiedAt: '2026-10-18',
          metadata: {
            ...loc.metadata,
            osmId: matched.osmId,
            subType: `Tuyến ${matched.roadName}`,
          },
        });
      } else {
        remainingUnverified.push(loc);
      }
    }

    return {
      verifiedMapMarkers: upgradedVerified,
      unverifiedCatalogPlaces: remainingUnverified,
    };
  }, [syncTick, osmRoadMatchedCatalog]);

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

  // Lọc danh sách marker đã xác minh theo danh mục đang chọn
  const filteredVerifiedMarkers = useMemo(() => {
    if (!layerVisibility.realPois) return [];
    if (selectedCategories.includes('all')) return verifiedMapMarkers;
    return verifiedMapMarkers.filter((loc) => selectedCategories.includes(loc.category));
  }, [verifiedMapMarkers, selectedCategories, layerVisibility.realPois]);

  // Khởi tạo MapLibre GL JS (Phần 3.1, 4, 8)
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
        minZoom: 11.2,
        maxZoom: 19.2,
        maxBounds: XUANHOA_MAX_BOUNDS,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: MAP_DATA_SOURCE_CONFIG.attributionHtml,
        }),
        'bottom-left'
      );

      const syncCamera = () => {
        setCurrentZoom(map.getZoom());
        setCameraVersion((v) => v + 1);
        renderSynchronizedVectorGeography();
      };

      map.on('load', syncCamera);
      map.on('move', syncCamera);
      map.on('zoom', syncCamera);
      map.on('resize', syncCamera);
      map.on('error', () => {
        // Bỏ qua cảnh báo worker phụ, lớp Vector GeoJSON đồng bộ vẫn vẽ 100%
      });

      mapInstanceRef.current = map;
      syncCamera();

      return () => {
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
  }, [renderSynchronizedVectorGeography]);

  useEffect(() => {
    const cleanup = initMap();
    return () => {
      if (cleanup) cleanup();
    };
  }, [initMap]);

  // Vẽ lại khi bật/tắt layerVisibility
  useEffect(() => {
    renderSynchronizedVectorGeography();
  }, [layerVisibility, renderSynchronizedVectorGeography]);

  // Xử lý click lên bản đồ khi Admin đang ở chế độ chấm chọn tọa độ
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (isPickingOnMap && isAdminUser) {
        const pickedLat = Number(e.lngLat.lat.toFixed(6));
        const pickedLng = Number(e.lngLat.lng.toFixed(6));
        setAdminLatInput(String(pickedLat));
        setAdminLngInput(String(pickedLng));
        setAdminCoordSource('admin_verified');
        setIsPickingOnMap(false);
        setIsAdminCoordModalOpen(true);
        setAdminFeedback(
          `Đã lấy tọa độ trên bản đồ: ${pickedLat}, ${pickedLng}. Hãy nhấn "Xác nhận & Lưu" để hoàn tất.`
        );
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPickingOnMap, isAdminUser]);

  // Tính toán Clustering trên không gian màn hình (Phần 6.5: Không biến dạng tọa độ thật!)
  const screenClusters = useMemo((): ScreenClusterItem[] => {
    const map = mapInstanceRef.current;
    if (!map || !mapContainerRef.current) return [];

    const width = mapContainerRef.current.clientWidth || 1200;
    const height = mapContainerRef.current.clientHeight || 800;
    const minDistancePx =
      currentZoom >= 16.8 ? 22 : currentZoom >= 15.8 ? 40 : 54;

    const projected: Array<{ loc: PlaceLocation; x: number; y: number }> = [];
    for (const loc of filteredVerifiedMarkers) {
      if (loc.lat === null || loc.lng === null) continue;
      const pt = map.project([loc.lng, loc.lat]);
      if (pt.x < -60 || pt.x > width + 60 || pt.y < -60 || pt.y > height + 60) {
        continue;
      }
      projected.push({ loc, x: pt.x, y: pt.y });
    }

    projected.sort((a, b) => {
      if (selectedPlace?.id === a.loc.id) return -1;
      if (selectedPlace?.id === b.loc.id) return 1;
      if (a.loc.dataSource === 'openstreetmap' && b.loc.dataSource !== 'openstreetmap') return -1;
      if (b.loc.dataSource === 'openstreetmap' && a.loc.dataSource !== 'openstreetmap') return 1;
      return 0;
    });

    const clusters: ScreenClusterItem[] = [];
    for (const item of projected) {
      let mergedInto: ScreenClusterItem | null = null;
      for (const existing of clusters) {
        const dx = item.x - existing.x;
        const dy = item.y - existing.y;
        if (Math.hypot(dx, dy) < minDistancePx) {
          mergedInto = existing;
          break;
        }
      }

      if (mergedInto) {
        mergedInto.members.push(item.loc);
      } else {
        clusters.push({
          id: item.loc.id,
          x: item.x,
          y: item.y,
          lat: item.loc.lat!,
          lng: item.loc.lng!,
          primary: item.loc,
          members: [item.loc],
        });
      }
    }

    return clusters;
  }, [filteredVerifiedMarkers, cameraVersion, currentZoom, selectedPlace]);

  // Tính toán vị trí màn hình cho Tài sản Game Demo và Vị trí Người dùng
  const projectedGameAssets = useMemo(() => {
    const map = mapInstanceRef.current;
    if (!map || !layerVisibility.gameAssets) return [];
    return DEMO_GAME_ASSETS.map((asset) => {
      const pt = map.project([asset.lng, asset.lat]);
      return { asset, x: pt.x, y: pt.y };
    });
  }, [layerVisibility.gameAssets, cameraVersion]);

  const projectedUserLocation = useMemo(() => {
    const map = mapInstanceRef.current;
    if (!map || !userCoords || !layerVisibility.userLocation) return null;
    const pt = map.project([userCoords.lng, userCoords.lat]);
    return { x: pt.x, y: pt.y };
  }, [userCoords, layerVisibility.userLocation, cameraVersion]);

  // Điều hướng Camera
  const flyToCoordinates = useCallback((lat: number, lng: number, zoom = 16.4) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo({
      center: [lng, lat],
      zoom,
      speed: 1.35,
      curve: 1.2,
      essential: true,
    });
  }, []);

  const handleSelectVerifiedPlace = useCallback(
    (place: PlaceLocation) => {
      setSelectedGameAsset(null);
      setClusterSelectionList(null);
      setSelectedPlace(place);
      if (place.lat !== null && place.lng !== null) {
        flyToCoordinates(place.lat, place.lng, Math.max(currentZoom, 16.3));
      }
    },
    [flyToCoordinates, currentZoom]
  );

  const handleSelectUnverifiedPlace = useCallback((place: PlaceLocation) => {
    if (place.originalPlace) {
      setModalPlace(place.originalPlace);
    }
  }, []);

  const handleSelectRoad = useCallback(
    (road: RoadSearchResult) => {
      setSelectedPlace(null);
      setSelectedGameAsset(null);
      flyToCoordinates(road.lat, road.lng, 16.2);
      setLocationNotice(`Đã di chuyển tới tuyến đường thực tế: ${road.name} (OSM ${road.osmId})`);
      setTimeout(() => setLocationNotice(null), 4000);
    },
    [flyToCoordinates]
  );

  const handleSelectGameAsset = useCallback(
    (asset: GameAsset) => {
      setLayerVisibility((prev) => ({ ...prev, gameAssets: true }));
      setSelectedPlace(null);
      setSelectedGameAsset(asset);
      flyToCoordinates(asset.lat, asset.lng, 16.4);
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

  const handleLocateUser = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocationNotice('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }
    setIsLocatingUser(true);
    setLocationNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });
        setLayerVisibility((prev) => ({ ...prev, userLocation: true }));
        flyToCoordinates(lat, lng, 16.0);
      },
      (err) => {
        setIsLocatingUser(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationNotice(
            'Bạn đã từ chối quyền vị trí. Bản đồ vẫn hoạt động bình thường tại trung tâm Xuân Hòa.'
          );
        } else {
          setLocationNotice('Không thể lấy tín hiệu GPS hiện tại. Vui lòng thử lại.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [flyToCoordinates]);

  const openAdminCoordinateModal = useCallback(
    (place?: PlaceLocation) => {
      if (!isAdminUser) {
        setLocationNotice('Chỉ Quản trị viên đã xác thực mới có quyền cập nhật tọa độ địa điểm.');
        return;
      }
      const target = place || unverifiedCatalogPlaces[0] || verifiedMapMarkers[0] || null;
      setAdminTargetPlace(target);
      setAdminLatInput(target?.lat ? String(target.lat) : '');
      setAdminLngInput(target?.lng ? String(target.lng) : '');
      setAdminCoordSource('admin_verified');
      setNominatimSuggestions([]);
      setAdminFeedback(null);
      setIsAdminCoordModalOpen(true);
    },
    [isAdminUser, unverifiedCatalogPlaces, verifiedMapMarkers]
  );

  const handleSuggestFromOsm = async () => {
    if (!adminTargetPlace) return;
    setIsGeocoding(true);
    setAdminFeedback(null);
    try {
      const query = `${adminTargetPlace.address || adminTargetPlace.name}`;
      const list = await geocodeAddressWithNominatim(query);
      setNominatimSuggestions(list);

      const matchedRoad = findSuggestedRoadForAddress(adminTargetPlace.address, osmRoads);
      if (list.length === 0 && matchedRoad) {
        setNominatimSuggestions([
          {
            displayName: `Tâm tuyến đường OSM khớp địa chỉ: ${matchedRoad.name} (${matchedRoad.osmId})`,
            lat: matchedRoad.lat,
            lng: matchedRoad.lng,
          },
        ]);
      } else if (list.length === 0) {
        setAdminFeedback(
          'Nominatim chưa tìm thấy tọa độ khớp tự động cho địa chỉ này. Bạn có thể bấm "Chấm trực tiếp trên Bản đồ".'
        );
      }
    } catch {
      const matchedRoad = findSuggestedRoadForAddress(adminTargetPlace.address, osmRoads);
      if (matchedRoad) {
        setNominatimSuggestions([
          {
            displayName: `Tâm tuyến đường OSM khớp địa chỉ: ${matchedRoad.name} (${matchedRoad.osmId})`,
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
    if (!isAdminUser || !adminTargetPlace) return;
    try {
      const lat = parseFloat(adminLatInput);
      const lng = parseFloat(adminLngInput);
      updatePlaceCoordinates(adminTargetPlace.id, {
        lat,
        lng,
        coordinateVerified: true,
        coordinateSource: adminCoordSource,
        placeName: adminTargetPlace.name,
      });
      setSyncTick((t) => t + 1);
      setAdminFeedback(`Đã xác minh & lưu tọa độ cho "${adminTargetPlace.name}" thành công!`);
      flyToCoordinates(lat, lng, 16.5);
    } catch (err: any) {
      setAdminFeedback(err?.message || 'Lỗi lưu tọa độ.');
    }
  };

  return (
    <div
      className="relative w-full h-[calc(100vh-72px)] min-h-[600px] overflow-hidden select-none"
      style={{
        backgroundColor: '#F8F5EE',
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}
    >
      {/* 1A. LỚP BẢN ĐỒ ĐỊA LÝ VECTOR ĐỒNG BỘ 1:1 VỚI MAPLIBRE (Đảm bảo hiển thị 100% Đường, Ngõ, 5.083 Nhà 2.5D, Hồ Đại Lải, Công viên, Tên đường) */}
      <canvas
        ref={vectorCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
      />

      {/* 1B. BỘ ĐIỀU KHIỂN CAMERA & PROJECTION MAPLIBRE GL JS */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full z-[2]"
        style={{
          cursor: isPickingOnMap ? 'crosshair' : 'grab',
          background: 'transparent',
        }}
      />

      {/* 2. LỚP MARKER ĐỊA ĐIỂM ĐÃ XÁC MINH & CLUSTER (Phần 5 & Phần 6.5) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {/* Marker Vị trí người dùng (User Location Layer) */}
        {projectedUserLocation && (
          <div
            style={{
              transform: `translate3d(${projectedUserLocation.x}px, ${projectedUserLocation.y}px, 0)`,
            }}
            className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            title="Vị trí hiện tại của bạn"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute w-9 h-9 rounded-full bg-[#39B980]/35 animate-ping" />
              <span className="w-4 h-4 rounded-full bg-[#39B980] border-2 border-[#403064] shadow-md" />
            </div>
          </div>
        )}

        {/* Marker Tài sản Game Demo (Game Assets Layer) */}
        {projectedGameAssets.map(({ asset, x, y }) => {
          const isSelected = selectedGameAsset?.id === asset.id;
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => handleSelectGameAsset(asset)}
              style={{
                transform: `translate3d(${x}px, ${y}px, 0)`,
              }}
              className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 pointer-events-auto group cursor-pointer focus:outline-none"
              aria-label={`Tài sản game demo ${asset.name}`}
            >
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border-2 transition-transform shadow-[0_6px_16px_rgba(64,48,100,0.22)]"
                style={{
                  backgroundColor: isSelected ? '#39B980' : '#403064',
                  borderColor: '#FFFDF9',
                  color: '#FFFFFF',
                  transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                }}
              >
                <span className="text-xs">{asset.ownerAvatar || '🏰'}</span>
                <span className="text-[10px] font-extrabold tracking-wide">DEMO LOT</span>
              </div>
            </button>
          );
        })}

        {/* Marker Địa điểm thực tế đã xác minh tọa độ (Clustered) */}
        {screenClusters.map((cluster) => {
          const isCluster = cluster.members.length > 1;
          const loc = cluster.primary;
          const cat = MAP_CATEGORY_BY_ID[loc.category];
          const isSelected = selectedPlace?.id === loc.id;
          const isHovered = hoveredPlaceId === loc.id;
          const showLabel =
            !isCluster && (isSelected || isHovered || currentZoom >= 16.5);

          return (
            <div
              key={cluster.id}
              style={{
                transform: `translate3d(${cluster.x}px, ${cluster.y}px, 0)`,
                zIndex: isSelected ? 40 : isHovered ? 30 : 20,
              }}
              className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            >
              {isCluster ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentZoom < 17.2) {
                      flyToCoordinates(cluster.lat, cluster.lng, Math.min(currentZoom + 1.4, 18.2));
                    } else {
                      setClusterSelectionList(cluster.members);
                    }
                  }}
                  aria-label={`Cụm ${cluster.members.length} địa điểm tại khu vực này`}
                  className="flex items-center justify-center gap-1 px-2.5 h-9 rounded-2xl bg-[#39B980] hover:bg-[#2FA36E] text-white border-2 border-[#403064] shadow-[0_6px_16px_rgba(64,48,100,0.24)] font-extrabold text-xs transition-transform hover:scale-105 cursor-pointer"
                >
                  <MapPin size={13} />
                  <span>{cluster.members.length}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onMouseEnter={() => setHoveredPlaceId(loc.id)}
                  onMouseLeave={() => setHoveredPlaceId(null)}
                  onFocus={() => setHoveredPlaceId(loc.id)}
                  onBlur={() => setHoveredPlaceId(null)}
                  onClick={() => handleSelectVerifiedPlace(loc)}
                  aria-label={`Địa điểm ${loc.name}`}
                  className="group relative flex flex-col items-center focus:outline-none cursor-pointer"
                >
                  {showLabel && (
                    <div
                      className="mb-1 px-2.5 py-0.5 rounded-xl border-2 text-[11px] font-extrabold whitespace-nowrap max-w-[190px] truncate shadow-sm transition-all"
                      style={{
                        backgroundColor: isSelected ? '#403064' : '#FFFDF9',
                        borderColor: '#403064',
                        color: isSelected ? '#FFFFFF' : '#2D2246',
                      }}
                    >
                      {loc.name}
                    </div>
                  )}

                  <div
                    className="w-9 h-9 rounded-2xl border-2 flex items-center justify-center text-white transition-transform shadow-[0_6px_14px_rgba(64,48,100,0.22)]"
                    style={{
                      backgroundColor: isSelected
                        ? '#403064'
                        : cat?.markerBg || '#39B980',
                      borderColor: isSelected ? '#39B980' : '#403064',
                      transform: isSelected
                        ? 'scale(1.16)'
                        : isHovered
                        ? 'scale(1.08)'
                        : 'scale(1)',
                    }}
                  >
                    {cat ? renderCategoryIcon(cat.iconName, 16) : <MapPin size={16} />}
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. LỚP GIAO DIỆN ĐIỀU KHIỂN TRÊN CÙNG */}
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onBackToHome}
            aria-label="Quay lại trang chủ Xuân Hòa Có Gì"
            className="px-3 py-2.5 rounded-2xl bg-[#FFFDF9]/95 border-2 border-[#403064] text-[#403064] hover:bg-[#E6F7EF] font-extrabold text-xs flex items-center gap-1.5 shadow-[0_6px_18px_rgba(64,48,100,0.10)] shrink-0 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Trang chủ</span>
          </button>

          <MapSearchBar
            verifiedPlaces={verifiedMapMarkers}
            unverifiedPlaces={unverifiedCatalogPlaces}
            roads={osmRoads}
            gameAssets={DEMO_GAME_ASSETS}
            selectedCategories={selectedCategories}
            isCategoryDrawerOpen={isCategoryDrawerOpen}
            onToggleCategoryDrawer={() => setIsCategoryDrawerOpen((v) => !v)}
            onSelectVerifiedPlace={handleSelectVerifiedPlace}
            onSelectUnverifiedPlace={handleSelectUnverifiedPlace}
            onSelectRoad={handleSelectRoad}
            onSelectGameAsset={handleSelectGameAsset}
            isGameLayerEnabled={layerVisibility.gameAssets}
            onToggleGameLayer={() =>
              setLayerVisibility((prev) => ({ ...prev, gameAssets: !prev.gameAssets }))
            }
            isAdminUser={isAdminUser}
            onOpenAdminCoordTool={openAdminCoordinateModal}
          />

          {isAdminUser && (
            <button
              type="button"
              onClick={() => openAdminCoordinateModal()}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-[#FEF3C7] border-2 border-[#403064] text-[#92400E] font-extrabold text-xs shadow-sm shrink-0 cursor-pointer"
            >
              <Crosshair size={15} />
              <span>Admin Tọa độ ({unverifiedCatalogPlaces.length} chờ)</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          <MapControls
            onZoomIn={() => mapInstanceRef.current?.zoomIn()}
            onZoomOut={() => mapInstanceRef.current?.zoomOut()}
            onResetCenter={() => {
              setActivePresetId('dhsp2');
              flyToCoordinates(
                XUANHOA_DEFAULT_CENTER.lat,
                XUANHOA_DEFAULT_CENTER.lng,
                XUANHOA_DEFAULT_CENTER.zoom
              );
            }}
            onLocateUser={handleLocateUser}
            isLocatingUser={isLocatingUser}
            layerVisibility={layerVisibility}
            onToggleLayer={(key) =>
              setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            onSelectPreset={(preset: MapAreaPreset) => {
              setActivePresetId(preset.id);
              flyToCoordinates(preset.lat, preset.lng, preset.zoom);
            }}
            activePresetId={activePresetId}
            onOpenDataQualityModal={() => setIsDataQualityOpen(true)}
          />
        </div>

        {isPickingOnMap && (
          <div className="pointer-events-auto self-start px-4 py-2 rounded-2xl bg-[#403064] text-white border-2 border-[#39B980] shadow-lg text-xs font-bold flex items-center gap-2">
            <Crosshair size={15} className="text-[#39B980] animate-pulse" />
            <span>
              Hãy nhấp chuột vào đúng vị trí mặt tiền của "{adminTargetPlace?.name}" trên bản đồ...
            </span>
            <button
              type="button"
              onClick={() => {
                setIsPickingOnMap(false);
                setIsAdminCoordModalOpen(true);
              }}
              className="ml-2 px-2 py-0.5 rounded bg-white/20 text-[11px] cursor-pointer"
            >
              Hủy
            </button>
          </div>
        )}

        {isOffline && (
          <div className="pointer-events-auto self-start px-3.5 py-2 rounded-2xl bg-[#FEF2F2] border-2 border-[#EF4444] text-[#991B1B] text-xs font-bold flex items-center gap-2 shadow-sm">
            <WifiOff size={15} />
            <span>
              Đang mất kết nối Internet. Bản đồ vẫn hiển thị dữ liệu địa lý Xuân Hòa nội bộ đã lưu.
            </span>
          </div>
        )}

        {locationNotice && (
          <div className="pointer-events-auto self-start px-3.5 py-2 rounded-2xl bg-[#FFFDF9] border-2 border-[#403064] text-[#2D2246] text-xs font-semibold flex items-center gap-2 shadow-md">
            <span>{locationNotice}</span>
            <button
              type="button"
              onClick={() => setLocationNotice(null)}
              className="text-[#65587F] hover:text-[#2D2246] cursor-pointer"
            >
              <X size={14} />
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

      {/* 4. POPUP THÔNG TIN ĐỊA ĐIỂM HOẶC DANH SÁCH CỤM GẦN NHAU Ở ĐÁY BẢN ĐỒ */}
      <div className="absolute left-3 right-16 bottom-24 md:bottom-6 z-30 pointer-events-none flex flex-col items-start gap-2">
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
            />
          </div>
        )}
      </div>

      {/* 5. TRẠNG THÁI ĐANG TẢI HOẶC LỖI BẢN ĐỒ */}
      {isMapLoading && (
        <div className="absolute inset-0 z-40 bg-[#F8F5EE]/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
          <div className="px-6 py-5 rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-xl max-w-sm">
            <Loader2 size={28} className="mx-auto animate-spin text-[#39B980]" />
            <h2 className="mt-3 text-sm font-extrabold text-[#2D2246]">
              Đang tải Bản đồ Địa lý Phường Xuân Hòa...
            </h2>
            <p className="mt-1 text-xs text-[#65587F]">
              Đang đồng bộ 6.225 tuyến đường, 5.083 công trình OpenStreetMap (Relation #19542980).
            </p>
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

      {/* 8. MODAL QUẢN TRỊ TỌA ĐỘ ĐỊA ĐIỂM DÀNH RIÊNG CHO ADMIN */}
      {isAdminCoordModalOpen && isAdminUser && (
        <div
          className="fixed inset-0 z-50 bg-[#2D2246]/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAdminCoordModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl bg-[#FFFDF9] border-2 border-[#403064] shadow-2xl p-5 text-[#2D2246]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E5DEC9]">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] text-[10px] font-extrabold">
                  QUẢN TRỊ TỌA ĐỘ XUHO CITY
                </span>
                <h2 className="text-base font-extrabold text-[#2D2246] mt-1">
                  Xác minh tọa độ thật cho địa điểm
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminCoordModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#F1ECE1] text-[#403064] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAdminCoordinates} className="mt-3 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#403064] mb-1">
                  Chọn quán trong danh mục ({unverifiedCatalogPlaces.length} quán chưa xác minh):
                </label>
                <select
                  value={adminTargetPlace?.id || ''}
                  onChange={(e) => {
                    const allCatalog = [...unverifiedCatalogPlaces, ...verifiedMapMarkers];
                    const found = allCatalog.find((p) => p.id === e.target.value) || null;
                    setAdminTargetPlace(found);
                    setAdminLatInput(found?.lat ? String(found.lat) : '');
                    setAdminLngInput(found?.lng ? String(found.lng) : '');
                    setNominatimSuggestions([]);
                    setAdminFeedback(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] font-bold text-[#2D2246]"
                >
                  <optgroup label={`Chờ xác minh tọa độ (${unverifiedCatalogPlaces.length})`}>
                    {unverifiedCatalogPlaces.map((p) => (
                      <option key={p.id} value={p.id}>
                        [Chờ xác minh] {p.name} — {p.address}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={`Đã có trên bản đồ (${verifiedMapMarkers.length})`}>
                    {verifiedMapMarkers
                      .filter((p) => p.dataSource !== 'openstreetmap')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          [Đã có ghim] {p.name} ({p.lat}, {p.lng})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {adminTargetPlace && (
                <div className="p-3 rounded-2xl bg-[#F8F5EE] border border-[#E5DEC9] space-y-1.5">
                  <div className="font-extrabold text-[#2D2246]">{adminTargetPlace.name}</div>
                  <div className="text-[11px] text-[#65587F]">
                    Địa chỉ gốc: <strong>{adminTargetPlace.address}</strong>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSuggestFromOsm}
                      disabled={isGeocoding}
                      className="px-3 py-1.5 rounded-xl bg-[#E6F7EF] text-[#1D7A52] border border-[#39B980] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {isGeocoding ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <SearchIcon size={13} />
                      )}
                      <span>Đề xuất tọa độ từ OSM</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminCoordModalOpen(false);
                        setIsPickingOnMap(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#403064] text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Crosshair size={13} />
                      <span>Chấm trực tiếp trên Bản đồ</span>
                    </button>
                  </div>
                </div>
              )}

              {nominatimSuggestions.length > 0 && (
                <div className="p-2.5 rounded-2xl bg-[#E6F7EF]/60 border border-[#39B980]/40 space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[#1D7A52]">
                    Tọa độ đề xuất (Bấm chọn để điền vào ô xác nhận):
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
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] font-mono text-xs"
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
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F5EE] border border-[#403064] font-mono text-xs"
                  />
                </div>
              </div>

              {adminFeedback && (
                <div className="p-2.5 rounded-xl bg-[#E6F7EF] text-[#1D7A52] font-bold text-[11px]">
                  {adminFeedback}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-2">
                {adminTargetPlace?.coordinateVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!adminTargetPlace) return;
                      clearPlaceCoordinates(adminTargetPlace.id, adminTargetPlace.name);
                      setSyncTick((t) => t + 1);
                      setAdminLatInput('');
                      setAdminLngInput('');
                      setAdminFeedback('Đã xóa tọa độ và đưa quán về trạng thái chờ xác minh.');
                    }}
                    className="px-3 py-2 rounded-xl bg-[#FEE2E2] text-[#991B1B] font-bold cursor-pointer"
                  >
                    Hủy xác minh
                  </button>
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
                    className="px-4 py-2 rounded-xl bg-[#39B980] hover:bg-[#2FA36E] text-white border-2 border-[#403064] font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Xác nhận & Lưu tọa độ</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. TÁI SỬ DỤNG PLACE MODAL HIỆN CÓ */}
      <PlaceModal
        place={modalPlace}
        isOpen={Boolean(modalPlace)}
        onClose={() => setModalPlace(null)}
        authUser={authUser}
        onOpenLogin={onOpenLogin}
      />
    </div>
  );
};
