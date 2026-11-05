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
  Bookmark,
  Home,
} from 'lucide-react';
import type { Place } from '@/lib/places-xuanhoa';
import type { UserAuthProfile } from '@/lib/auth';
import {
  isAdminAuthenticated,
  isMapManagerAuthenticated,
  isPlaceHiddenOrDeletedInAdmin,
  logMapDebug,
  updatePlaceCoordinates,
  clearPlaceCoordinates,
  getAllManagedPlaces,
  getDigitalMapAccessStatus,
  setMapAccessMode,
  getAdminState,
  getAllPlaceChangeProposals,
  approvePlaceProposal,
  rejectPlaceProposal,
  type PlaceChangeProposal,
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
  migrateExistingPlacesCoordinates,
  saveLandmarkOrPlaceFromMap,
  blockLandmarkOrPlaceFromMap,
  unblockLandmarkOrPlaceFromMap,
  unpinLandmarkOrPlaceFromMap,
  hideLandmarkOrPlaceFromMap,
  restoreLandmarkOrPlaceDefault,
  type DistanceAndEtaResult,
  type TravelMode,
  type UserHomeLocation,
} from '@/lib/map/map-data';
import { FastOpeningHoursInput } from '@/components/map/FastOpeningHoursInput';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { MapCategoryPanel, renderCategoryIcon } from '@/components/map/MapCategoryPanel';
import { MapPlacePopup } from '@/components/map/MapPlacePopup';
import { MapControls } from '@/components/map/MapControls';
import { MapQuickCategoryBar } from '@/components/map/MapQuickCategoryBar';
import { City3DView } from '@/components/map/city3d/City3DView';
import { GameAssetLayer } from '@/components/map/GameAssetLayer';
import { LandmarkAdminControls } from '@/components/map/LandmarkAdminControls';
import type { LandmarkBindingRecord } from '@/lib/map/landmark-bindings';
import {
  MAP_PARENT_CATEGORIES,
  MAP_PARENT_CATEGORY_BY_ID,
  MAP_SUBCATEGORIES_BY_PARENT,
  MAP_CATEGORY_REGISTRY,
  getPlaceTaxonomyMeta,
  isDefaultVisibleMapLandmark,
  renderRegistryIcon,
  resolvePlaceTaxonomy,
  searchSubcategoriesByQuery,
  type MapParentCategoryId,
  type MapSubcategoryId,
} from '@/lib/map/map-category-registry';
import {
  POI_LOD_CONFIG,
  getPoiRenderState,
  computeSpatialPoiClusters,
  type PoiClusterItem,
} from '@/lib/map/poi-lod';
import {
  CONTEXTUAL_ZONE_LABELS,
  HEIGHT_SOURCE_LABELS,
  findMasterBuildingAtLngLat,
  getLoadedMasterDataset,
  loadXuanHoaMasterDataset,
  queryMasterBuildingsInViewport,
  type MasterBuildingRecord,
  type XuanHoaMasterDataset,
} from '@/lib/map/xuanhoa-master-data';
import { getElevationAtLngLat, loadXuanHoaDem } from '@/lib/map/xuanhoa-elevation';
import {
  ROAD_OVERRIDES_UPDATED_EVENT,
  applyRoadOverridesToGeoJSONFeatures,
  auditAllRoadRecords,
  buildUnifiedSearchableRoads,
  computePolylineCenter,
  findNearestRoadAtLngLat,
  formatRoadLabelForZoom,
  insertRoadVertexAtSegmentMidpoint,
  mergeAdminRoadSegments,
  moveRoadVertex,
  normalizeRoadHierarchyClass,
  type RoadAuditIssue,
  type RoadHierarchyClass,
  type RoadNameSource,
  type RoadRecord,
  type RoadType,
  type RoadVerificationStatus,
} from '@/lib/map/xuanhoa-road-overrides';
import { AdminRoadEditorPanel } from '@/components/map/AdminRoadEditorPanel';

interface DigitalMapViewProps {
  onBackToHome: () => void;
  authUser?: UserAuthProfile | null;
  onOpenLogin?: () => void;
  embeddedInAdmin?: boolean;
  adminSelectedPlaceId?: string | null;
  adminPreviewLat?: number | null;
  adminPreviewLng?: number | null;
  adminPreviewName?: string;
  adminFlyTrigger?: number;
  adminSyncVersion?: number;
  onAdminPickCoordinates?: (lat: number, lng: number) => void;
  onAdminSelectPlace?: (placeId: string) => void;
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
  roadId: string;
  name: string;
  shortName?: string;
  roadClass?: RoadHierarchyClass;
  roadType?: RoadType;
  parentRoad?: string;
  source?: string;
  nameSource?: RoadNameSource;
  verificationStatus?: RoadVerificationStatus;
  confidence?: number;
  segmentLengthM?: number;
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
  rawSourceRoads?: any[];
  roadRecordsById?: Map<string, RoadRecord>;
  roads: any[];
  roadsMajor: any[];
  roadsSecondary: any[];
  roadsMinor: any[];
  roadsAlley: any[];
  roadsAccess: any[];
  buildings: any[];
  landmarkBuildings: any[];
  regularBuildings: any[];
  placeLabels: any[];
  roadLabelAnchors?: RoadLabelAnchor[];
  masterDataset?: XuanHoaMasterDataset;
}

interface CachedGeoBundle {
  geoLayers: LoadedGeoLayers;
  osmRoads: RoadSearchResult[];
  osmRoadMatchedCatalog: Record<
    string,
    { lat: number; lng: number; roadName: string; osmId: string }
  >;
}

let cachedProcessedGeoBundle: CachedGeoBundle | null = null;
let inflightGeoBundlePromise: Promise<CachedGeoBundle> | null = null;

function buildProcessedRoadDataFromRaw(rawSourceRoads: any[]) {
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

  const { features: rawRoads, recordsById } =
    applyRoadOverridesToGeoJSONFeatures(rawSourceRoads);

  const roadsMajor: any[] = [];
  const roadsSecondary: any[] = [];
  const roadsMinor: any[] = [];
  const roadsAlley: any[] = [];
  const roadsAccess: any[] = [];

  for (const f of rawRoads) {
    indexRingFeature(f, f.geometry?.coordinates);
    f._cleanName = cleanGeoText(f.properties?.name || '');
    const p = f.properties || {};
    const roadClass = normalizeRoadHierarchyClass({
      explicitRoadClass: p.roadClass,
      tier: p.tier,
      highway: p.highway,
      roadType: p.roadType,
      name: f._cleanName,
    });
    f._roadClass = roadClass;
    if (roadClass === 'major') roadsMajor.push(f);
    else if (roadClass === 'arterial') roadsSecondary.push(f);
    else if (roadClass === 'local') roadsMinor.push(f);
    else if (roadClass === 'alley') roadsAlley.push(f);
    else roadsAccess.push(f);
  }

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
      if (cosAngle < 0.92) return null;
    }
    return {
      lng: ptMid.lng,
      lat: ptMid.lat,
      dirLng: ptAfter.lng - ptBefore.lng,
      dirLat: ptAfter.lat - ptBefore.lat,
    };
  };

  const totalRoadSpanByKey = new Map<string, number>();
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
    const p = f.properties || {};
    const roadId = String(p.roadId || p.id || p.osmId || '');
    const roadClass: RoadHierarchyClass = f._roadClass || 'local';
    const isAlley =
      roadClass === 'alley' ||
      roadClass === 'access' ||
      p.roadType === 'alley' ||
      p.roadType === 'lane' ||
      p.tier === 'alley' ||
      /^(Ngõ|Ngách|Hẻm)\s+/i.test(rName);
    // Ngõ gắn chặt theo roadId riêng, không gộp độ dài qua các đoạn khác nhau
    const spanKey = isAlley ? `${rName}__${roadId}` : rName;
    totalRoadSpanByKey.set(spanKey, (totalRoadSpanByKey.get(spanKey) || 0) + totalLen);
  }

  const rawAnchorsByGroup = new Map<string, RoadLabelAnchor[]>();
  const stepDeg = 0.00105;

  for (const f of rawRoads) {
    const rName = f._cleanName || '';
    const coords = f.geometry?.coordinates;
    const totalLen: number = f._roadGeomLen || 0;
    const segLens: number[] = f._segLens || [];
    const p = f.properties || {};
    const roadId = String(p.roadId || p.id || p.osmId || '');
    const roadClass: RoadHierarchyClass =
      f._roadClass ||
      normalizeRoadHierarchyClass({
        explicitRoadClass: p.roadClass,
        tier: p.tier,
        highway: p.highway,
        roadType: p.roadType,
        name: rName,
      });
    const tier =
      roadClass === 'major'
        ? 'major'
        : roadClass === 'arterial'
        ? 'secondary'
        : roadClass === 'local'
        ? 'minor'
        : 'alley';
    const roadType: RoadType = p.roadType || (tier === 'alley' ? 'alley' : 'street');
    const isAlley =
      roadClass === 'alley' ||
      roadClass === 'access' ||
      roadType === 'alley' ||
      roadType === 'lane' ||
      tier === 'alley' ||
      /^(Ngõ|Ngách|Hẻm)\s+/i.test(rName);
    if (!rName || !coords || coords.length < 2 || totalLen < (isAlley ? 0.00016 : 0.00048)) {
      continue;
    }

    const shortName = String(p.shortName || rName);
    const halfW = rName.length * (isAlley ? 2.55 : 3.05) + (isAlley ? 5 : 8);
    const spanKey = isAlley ? `${rName}__${roadId}` : rName;
    const roadSpanDeg = Math.max(totalLen, totalRoadSpanByKey.get(spanKey) || totalLen);
    const list = rawAnchorsByGroup.get(spanKey) || [];
    const segLenM = Number(p.lengthM || totalLen * 108000);

    const pushAnchorPt = (pt: { lng: number; lat: number; dirLng: number; dirLat: number }) => {
      list.push({
        roadId,
        name: rName,
        shortName,
        roadClass,
        roadType,
        parentRoad: p.parentRoad || undefined,
        source: p.source || p.nameSource || undefined,
        nameSource: p.nameSource || 'osm',
        verificationStatus: p.verificationStatus || 'verified',
        confidence: typeof p.confidence === 'number' ? p.confidence : undefined,
        segmentLengthM: segLenM,
        tier,
        isAlley,
        halfW,
        roadSpanDeg,
        lng: pt.lng,
        lat: pt.lat,
        dirLng: pt.dirLng,
        dirLat: pt.dirLat,
      });
    };

    if (totalLen < stepDeg * 1.35) {
      const pt = sampleStraightAnchor(coords, segLens, totalLen, totalLen * 0.5);
      if (pt) pushAnchorPt(pt);
    } else {
      for (let d = stepDeg * 0.55; d <= totalLen - stepDeg * 0.35; d += stepDeg) {
        const pt = sampleStraightAnchor(coords, segLens, totalLen, d);
        if (pt) pushAnchorPt(pt);
      }
    }

    rawAnchorsByGroup.set(spanKey, list);
  }

  const roadLabelAnchors: RoadLabelAnchor[] = [];
  for (const [, candidates] of rawAnchorsByGroup.entries()) {
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

  const classPriority: Record<string, number> = {
    major: 1,
    arterial: 2,
    secondary: 2,
    local: 3,
    minor: 3,
    alley: 4,
    access: 5,
  };
  roadLabelAnchors.sort(
    (a, b) =>
      (classPriority[a.roadClass || a.tier] || 3) -
      (classPriority[b.roadClass || b.tier] || 3)
  );

  return {
    roads: rawRoads,
    roadRecordsById: recordsById,
    roadsMajor,
    roadsSecondary,
    roadsMinor,
    roadsAlley,
    roadsAccess,
    roadLabelAnchors,
  };
}

export function prefetchDigitalMapGeoLayers(): Promise<CachedGeoBundle> {
  if (cachedProcessedGeoBundle) {
    return Promise.resolve(cachedProcessedGeoBundle);
  }
  if (inflightGeoBundlePromise) {
    return inflightGeoBundlePromise;
  }

  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  inflightGeoBundlePromise = Promise.all([
    fetch(`${base}/geo/xuanhoa-boundary.geojson`).then((r) => r.json()),
    fetch(`${base}/geo/xuanhoa-landuse.geojson`).then((r) => r.json()),
    fetch(`${base}/geo/xuanhoa-water.geojson`).then((r) => r.json()),
    fetch(`${base}/geo/xuanhoa-waterways.geojson`).then((r) => r.json()),
    fetch(`${base}/geo/xuanhoa-roads.geojson`).then((r) => r.json()),
    fetch(`${base}/geo/xuanhoa-buildings.geojson`).then((r) => r.json()),
    fetch(`${base}/geo/xuanhoa-places-labels.geojson`).then((r) => r.json()),
    fetch(`${base}/geo/xuanhoa-osm-verified-pois.json`).then((r) => r.json()),
    fetch(`${base}/geo/xuanhoa-catalog-osm-matched.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
    loadXuanHoaMasterDataset(base).catch(() => undefined),
    loadXuanHoaDem(base).catch(() => undefined),
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
        masterDataset,
      ]) => {
        const boundaryFeatures: any[] = boundary?.features || [];
        const wardRing: number[][] = boundaryFeatures[0]?.geometry?.coordinates?.[0] || [];

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
        const rawSourceRoads: any[] = roads?.features || [];
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

        const processedRoads = buildProcessedRoadDataFromRaw(rawSourceRoads);

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

        const geoLayers: LoadedGeoLayers = {
          boundary: boundaryFeatures,
          landuse: rawLanduse,
          water: rawWater,
          waterways: rawWaterways,
          rawSourceRoads,
          roadRecordsById: processedRoads.roadRecordsById,
          roads: processedRoads.roads,
          roadsMajor: processedRoads.roadsMajor,
          roadsSecondary: processedRoads.roadsSecondary,
          roadsMinor: processedRoads.roadsMinor,
          roadsAlley: processedRoads.roadsAlley,
          roadsAccess: processedRoads.roadsAccess,
          buildings: rawBuildings,
          landmarkBuildings,
          regularBuildings,
          placeLabels: placeLabels?.features || [],
          roadLabelAnchors: processedRoads.roadLabelAnchors,
          masterDataset,
        };

        const seedRoads: RoadSearchResult[] =
          verifiedPoisData && Array.isArray(verifiedPoisData.namedRoads)
            ? verifiedPoisData.namedRoads.map((r: any, idx: number) => ({
                id: r.osmId || `road_${idx}`,
                roadId: r.osmId || `road_${idx}`,
                name: r.name,
                highway: r.highway || 'residential',
                tier: r.tier || 'minor',
                lat: Number(r.lat),
                lng: Number(r.lng),
                osmId: r.osmId || '',
                segmentsCount: r.segmentsCount || 1,
                insideWard: Boolean(r.insideWard),
              }))
            : VERIFIED_OSM_ROADS_SEED;

        const parsedRoads: RoadSearchResult[] = buildUnifiedSearchableRoads(
          processedRoads.roadRecordsById,
          seedRoads
        );

        const parsedMatchedCatalog =
          matchedCatalog && typeof matchedCatalog === 'object'
            ? (matchedCatalog as Record<
                string,
                { lat: number; lng: number; roadName: string; osmId: string }
              >)
            : {};

        cachedProcessedGeoBundle = {
          geoLayers,
          osmRoads: parsedRoads,
          osmRoadMatchedCatalog: parsedMatchedCatalog,
        };
        inflightGeoBundlePromise = null;
        return cachedProcessedGeoBundle;
      }
    )
    .catch((err) => {
      inflightGeoBundlePromise = null;
      throw err;
    });

  return inflightGeoBundlePromise;
}

const DigitalMapViewInner: React.FC<DigitalMapViewProps> = ({
  onBackToHome,
  authUser = null,
  onOpenLogin,
  embeddedInAdmin = false,
  adminSelectedPlaceId = null,
  adminPreviewLat = null,
  adminPreviewLng = null,
  adminPreviewName = '',
  adminFlyTrigger = 0,
  adminSyncVersion = 0,
  onAdminPickCoordinates,
  onAdminSelectPlace,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const vectorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const markerOverlayRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const geoLayersRef = useRef<LoadedGeoLayers | null>(cachedProcessedGeoBundle?.geoLayers || null);
  const canvasDimsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const isInteractingRef = useRef<boolean>(false);
  const hasUserInteractedRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const locationNoticeTimerRef = useRef<number | null>(null);
  const initialAdminCoordsRef = useRef<{ lat: number | null; lng: number | null }>({
    lat: adminPreviewLat,
    lng: adminPreviewLng,
  });
  initialAdminCoordsRef.current = { lat: adminPreviewLat, lng: adminPreviewLng };

  // Refs khóa cứng 100% tọa độ Marker DOM theo từng frame của MapLibre (0 độ trễ, 0 nhảy vị trí!)
  const markerElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const markerLabelElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const clusterElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const gameAssetElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const userMarkerElRef = useRef<HTMLDivElement | null>(null);
  const userHomeMarkerElRef = useRef<HTMLDivElement | null>(null);
  const proposedPinMarkerElRef = useRef<HTMLDivElement | null>(null);
  const activeProposedPinRef = useRef<{
    placeId: string;
    placeName: string;
    oldLat: number | null;
    oldLng: number | null;
    proposedLat: number;
    proposedLng: number;
    submittedByName: string;
  } | null>(null);
  const filteredVerifiedMarkersRef = useRef<PlaceLocation[]>([]);
  const poiClusters2DRef = useRef<PoiClusterItem[]>([]);
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
  const [isMapLoading, setIsMapLoading] = useState<boolean>(() => !cachedProcessedGeoBundle);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const showTemporaryMapNotice = useCallback((msg: string, durationMs = 2200) => {
    if (locationNoticeTimerRef.current !== null) {
      window.clearTimeout(locationNoticeTimerRef.current);
    }
    setLocationNotice(msg);
    locationNoticeTimerRef.current = window.setTimeout(() => {
      setLocationNotice(null);
      locationNoticeTimerRef.current = null;
    }, durationMs);
  }, []);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  userCoordsRef.current = userCoords;

  // Dữ liệu địa điểm & đường phố thực tế
  const [syncTick, setSyncTick] = useState<number>(0);
  const [osmRoads, setOsmRoads] = useState<RoadSearchResult[]>(
    () => cachedProcessedGeoBundle?.osmRoads || VERIFIED_OSM_ROADS_SEED
  );
  const [osmRoadMatchedCatalog, setOsmRoadMatchedCatalog] = useState<
    Record<string, { lat: number; lng: number; roadName: string; osmId: string }>
  >(() => cachedProcessedGeoBundle?.osmRoadMatchedCatalog || {});
  // Trạng thái bộ lọc nhanh danh mục (null = Mặc định chỉ hiện Core Landmarks, tắt toàn bộ quán xá)
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const activeQuickFilterRef = useRef<string | null>(null);
  activeQuickFilterRef.current = activeQuickFilter;

  const [selectedCategories, setSelectedCategories] = useState<MapCategoryKey[]>([
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
  useEffect(() => {
    try {
      const report = migrateExistingPlacesCoordinates();
      if (report.autoResolvedFromUrl > 0 || report.categoryFixedCount > 0) {
        setSyncTick((t) => t + 1);
      }
    } catch {
      // ignore
    }
  }, []);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState<boolean>(false);
  const [isCategoryDropdown2DOpen, setIsCategoryDropdown2DOpen] = useState<boolean>(false);
  const [isSavedDropdown2DOpen, setIsSavedDropdown2DOpen] = useState<boolean>(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState<boolean>(
    () => !embeddedInAdmin && !cachedProcessedGeoBundle
  );

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

  // Địa điểm / Công trình Master Building / Cụm / Tài sản Game đang chọn
  const [selectedPlace, setSelectedPlace] = useState<PlaceLocation | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<MasterBuildingRecord | null>(null);
  const selectedBuildingRef = useRef<MasterBuildingRecord | null>(null);
  selectedBuildingRef.current = selectedBuilding;
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  selectedPlaceIdRef.current =
    selectedPlace?.id || (embeddedInAdmin ? adminSelectedPlaceId || null : null);
  hoveredPlaceIdRef.current = hoveredPlaceId;
  const [clusterSelectionList, setClusterSelectionList] = useState<PlaceLocation[] | null>(null);
  const [selectedGameAsset, setSelectedGameAsset] = useState<GameAsset | null>(null);
  const [modalPlace, setModalPlace] = useState<Place | null>(null);

  // Chế độ Admin 2 chế độ: MODE A (Di chuyển địa danh) & MODE B (Căn mô hình 3D)
  const [adminLandmarkMode2D, setAdminLandmarkMode2D] = useState<
    'mode_a_place' | 'mode_b_model' | null
  >(null);
  const [pendingMoveCoords2D, setPendingMoveCoords2D] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [previewBindingPatch2D, setPreviewBindingPatch2D] =
    useState<Partial<LandmarkBindingRecord> | null>(null);

  useEffect(() => {
    setPendingMoveCoords2D(null);
    setPreviewBindingPatch2D(null);
  }, [selectedPlace?.id]);

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
  const [adminEditParentCategory, setAdminEditParentCategory] = useState<MapParentCategoryId>('public');
  const [adminEditSubcategory, setAdminEditSubcategory] = useState<MapSubcategoryId>('government');
  const [adminEditShowByDefault, setAdminEditShowByDefault] = useState<boolean>(true);
  const [adminCategorySearch, setAdminCategorySearch] = useState<string>('');
  const [adminEditAddress, setAdminEditAddress] = useState<string>('');
  const [adminEditTagline, setAdminEditTagline] = useState<string>('');
  const [adminEditPhone, setAdminEditPhone] = useState<string>('');
  const [adminEditHours, setAdminEditHours] = useState<string>('07:30 - 17:30');
  const [adminHoursError, setAdminHoursError] = useState<string | null>(null);
  const [isSavingPlace, setIsSavingPlace] = useState<boolean>(false);
  const [adminMapsUrlInput, setAdminMapsUrlInput] = useState<string>('');
  const [adminLatInput, setAdminLatInput] = useState<string>('');
  const [adminLngInput, setAdminLngInput] = useState<string>('');
  const [adminCoordSource, setAdminCoordSource] = useState<
    'admin_verified' | 'nominatim_geocoded' | 'openstreetmap'
  >('admin_verified');
  const [isPickingOnMap, setIsPickingOnMap] = useState<boolean>(false);
  const [showAdvancedCoords2D, setShowAdvancedCoords2D] = useState<boolean>(false);
  const [initial3DLandmarkMode, setInitial3DLandmarkMode] = useState<'mode_a_place' | 'mode_b_model' | null>(null);
  const pick2DSnapshotRef = useRef<{ lat: string; lng: string } | null>(null);
  const [nominatimSuggestions, setNominatimSuggestions] = useState<
    Array<{ displayName: string; lat: number; lng: number }>
  >([]);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  // Chế độ Admin Chỉnh Đường / Ngõ / Ngách (Tách tên & hình học, Vẽ lại tim ngõ, Cần rà soát)
  const [isRoadEditorOpen, setIsRoadEditorOpen] = useState<boolean>(false);
  const isRoadEditorOpenRef = useRef<boolean>(false);
  isRoadEditorOpenRef.current = isRoadEditorOpen;
  const [selectedRoadRecord, setSelectedRoadRecord] = useState<RoadRecord | null>(null);
  const selectedRoadRecordRef = useRef<RoadRecord | null>(null);
  selectedRoadRecordRef.current = selectedRoadRecord;
  const [isDrawingRoad, setIsDrawingRoad] = useState<boolean>(false);
  const isDrawingRoadRef = useRef<boolean>(false);
  isDrawingRoadRef.current = isDrawingRoad;
  const [roadDrawingPoints, setRoadDrawingPoints] = useState<[number, number][]>([]);
  const roadDrawingPointsRef = useRef<[number, number][]>([]);
  roadDrawingPointsRef.current = roadDrawingPoints;
  const [isRedrawingExistingRoad, setIsRedrawingExistingRoad] = useState<boolean>(false);
  const [isMergingSecondRoad, setIsMergingSecondRoad] = useState<boolean>(false);
  const isMergingSecondRoadRef = useRef<boolean>(false);
  isMergingSecondRoadRef.current = isMergingSecondRoad;
  const [roadDraftGeometry, setRoadDraftGeometry] = useState<[number, number][] | null>(null);
  const roadDraftGeometryRef = useRef<[number, number][] | null>(null);
  roadDraftGeometryRef.current = roadDraftGeometry;
  const [selectedRoadVertexIdx, setSelectedRoadVertexIdx] = useState<number | null>(null);
  const selectedRoadVertexIdxRef = useRef<number | null>(null);
  selectedRoadVertexIdxRef.current = selectedRoadVertexIdx;
  const [roadAuditIssues, setRoadAuditIssues] = useState<RoadAuditIssue[]>([]);

  // Tuyến đường chỉ dẫn trên Bản đồ
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
  const [isManageSheetOpen, setIsManageSheetOpen] = useState<boolean>(false);
  const [manageSheetView, setManageSheetView] = useState<'menu' | 'approvals' | 'my_proposals'>('menu');

  const pendingProposals = useMemo(
    () => getAllPlaceChangeProposals({ status: 'pending' }),
    [syncTick, adminSyncVersion]
  );
  const myProposals = useMemo(
    () =>
      authUser?.email
        ? getAllPlaceChangeProposals({ submittedByEmail: authUser.email })
        : getAllPlaceChangeProposals(),
    [authUser?.email, syncTick, adminSyncVersion]
  );
  const pendingApprovalCount = useMemo(
    () => pendingProposals.length,
    [pendingProposals.length]
  );
  const activeProposedPin = useMemo(() => {
    if (!isAdminUser && !isMapManagerUser) return null;
    const focusPlaceId = selectedPlace?.id || (embeddedInAdmin ? adminSelectedPlaceId : null);
    if (!focusPlaceId) return null;
    const st = getAdminState();
    const ov = st.places?.[focusPlaceId];
    const pMap = ov?.pendingMapApproval;
    if (
      pMap &&
      typeof pMap.proposedLat === 'number' &&
      typeof pMap.proposedLng === 'number' &&
      Number.isFinite(pMap.proposedLat) &&
      Number.isFinite(pMap.proposedLng)
    ) {
      return {
        placeId: focusPlaceId,
        placeName: pMap.proposedName || ov?.name || selectedPlace?.name || focusPlaceId,
        oldLat: typeof ov?.lat === 'number' ? ov.lat : selectedPlace?.lat ?? null,
        oldLng: typeof ov?.lng === 'number' ? ov.lng : selectedPlace?.lng ?? null,
        proposedLat: pMap.proposedLat,
        proposedLng: pMap.proposedLng,
        submittedByName: pMap.submittedByName || pMap.submittedByEmail || 'Quản lý',
      };
    }
    const prop = pendingProposals.find(
      (pr) =>
        pr.placeId === focusPlaceId &&
        typeof pr.afterData?.lat === 'number' &&
        typeof pr.afterData?.lng === 'number'
    );
    if (prop) {
      return {
        placeId: focusPlaceId,
        placeName: prop.placeName,
        oldLat: typeof prop.beforeData?.lat === 'number' ? prop.beforeData.lat : null,
        oldLng: typeof prop.beforeData?.lng === 'number' ? prop.beforeData.lng : null,
        proposedLat: Number(prop.afterData.lat),
        proposedLng: Number(prop.afterData.lng),
        submittedByName: prop.submittedByName || prop.submittedByEmail || 'Quản lý',
      };
    }
    return null;
  }, [isAdminUser, isMapManagerUser, selectedPlace, embeddedInAdmin, adminSelectedPlaceId, pendingProposals, syncTick, adminSyncVersion]);
  activeProposedPinRef.current = activeProposedPin;

  const [previewGuestLock, setPreviewGuestLock] = useState<boolean>(false);

  // Tự động bay tới vị trí nếu chuyển từ Trang Admin hoặc Link sang
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkHashParams = () => {
      const hash = window.location.hash || '';
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const params = new URLSearchParams(hash.slice(qIdx + 1));
        const flyLat = parseFloat(params.get('flyLat') || '');
        const flyLng = parseFloat(params.get('flyLng') || '');
        if (!Number.isNaN(flyLat) && !Number.isNaN(flyLng)) {
          const flyLabel = params.get('flyLabel') || '📍 Vị trí Quán trên Bản đồ';
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
    };
    checkHashParams();
    window.addEventListener('hashchange', checkHashParams);
    return () => window.removeEventListener('hashchange', checkHashParams);
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
      if (vis.decorativeZones) {
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
      }

      for (const f of geo.landuse) {
        if (!isFeatureInView(f)) continue;
        const ring = f.geometry?.coordinates?.[0];
        if (!ring) continue;
        traceCoords(ring, true);
        const kind = f.properties?.kind;
        const rawType = f.properties?.rawType || '';
        if (rawType === 'forest' || rawType === 'wood') {
          ctx.fillStyle = '#A6C99C';
          ctx.strokeStyle = '#8FB784';
        } else if (rawType === 'farmland' || rawType === 'orchard' || rawType === 'meadow') {
          ctx.fillStyle = '#E5E8B6';
          ctx.strokeStyle = '#CFD49E';
        } else if (rawType === 'industrial' || rawType === 'quarry') {
          ctx.fillStyle = '#DFDDD6';
          ctx.strokeStyle = '#CBC8BE';
        } else if (kind === 'green') {
          ctx.fillStyle = '#CFE3C4';
          ctx.strokeStyle = '#B5D1A7';
        } else if (kind === 'campus') {
          ctx.fillStyle = '#EFE8D8';
          ctx.strokeStyle = '#D8CEB8';
        } else if (kind === 'resort') {
          ctx.fillStyle = '#D4ECE0';
          ctx.strokeStyle = '#B0D8C5';
        } else {
          ctx.fillStyle = '#F3EFE6';
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

      // 3. Lớp Sông suối & Mặt hồ thực tế (Hồ Đại Lải, Sông Cà Lồ, Hồ Lập Đinh...) — Đồng bộ bảng màu #7CC8E6 -> #4FA3C7
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const f of geo.waterways) {
        if (!isFeatureInView(f)) continue;
        const coords = f.geometry?.coordinates;
        if (!coords) continue;
        traceCoords(coords, false);
        ctx.strokeStyle = '#7CC8E6';
        ctx.lineWidth = Math.max(1.8, (zoom - 10) * 1.1);
        ctx.stroke();
      }

      for (const f of geo.water) {
        if (!isFeatureInView(f)) continue;
        const ring = f.geometry?.coordinates?.[0];
        if (!ring) continue;
        traceCoords(ring, true);
        ctx.fillStyle = '#7CC8E6';
        ctx.fill();
        ctx.strokeStyle = '#B8E6F8';
        ctx.lineWidth = 3.0;
        ctx.stroke();
        ctx.strokeStyle = '#4FA3C7';
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

      if (vis.decorativeZones && isRingInView(nuiThanLanTiers[0].ring)) {
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

    // 4. Lớp Đường phố 5 cấp chuẩn Google Maps (Major / Arterial / Local / Alley / Access) + Zoom LOD + Độ rộng theo Zoom
    if (vis.baseGeography) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Tỉ lệ độ rộng 5 cấp theo Mục 8 & Zoom LOD theo Mục 10:
      // - Major: 100% (hiển thị ở mọi mức zoom, kể cả rất xa < 12.6)
      // - Arterial: 75% (hiển thị từ zoom xa >= 12.6)
      // - Local: 45% (hiển thị từ zoom trung bình >= 13.6)
      // - Alley: 25% (hiển thị từ zoom gần >= 14.8)
      // - Access / Path: 15% (hiển thị từ zoom rất gần >= 16.0)
      const wMajor = Math.max(4.6, Math.pow(1.48, zoom - 10.2));
      const wSecondary = zoom < 12.6 ? 0 : Math.max(3.45, wMajor * 0.75);
      const wMinor = zoom < 13.6 ? 0 : Math.max(2.1, wMajor * 0.45);
      const minAlleyZoom = isMoving ? 15.0 : 14.8;
      const wAlley = zoom < minAlleyZoom ? 0 : Math.max(1.25, wMajor * 0.25);
      const minAccessZoom = isMoving ? 16.2 : 16.0;
      const wAccess = zoom < minAccessZoom ? 0 : Math.max(0.85, wMajor * 0.15);

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
      const pathSecondary = wSecondary > 0 ? buildRoadPath(geo.roadsSecondary) : null;
      const pathMinor = wMinor > 0 ? buildRoadPath(geo.roadsMinor) : null;
      const pathAlley = wAlley > 0 ? buildRoadPath(geo.roadsAlley) : null;
      const pathAccess = wAccess > 0 ? buildRoadPath(geo.roadsAccess) : null;

      let pathHighlighted: Path2D | null = null;
      if (highlightedRoad) {
        const hlList = geo.roads.filter(
          (f: any) => f._cleanName && highlightedRoad.includes(f._cleanName)
        );
        pathHighlighted = buildRoadPath(hlList);
      }

      // Tâm Vòng tròn 2 trên trục Đường Nguyễn Văn Linh (Giao Võ Thị Sáu - ĐHSP2: khớp đúng đỉnh way/157991278 & way/176265733)
      const vt2Lng = 105.724783;
      const vt2Lat = 21.281668;
      const isVt2InView =
        vt2Lng >= minLng && vt2Lng <= maxLng && vt2Lat >= minLat && vt2Lat <= maxLat;
      const vt2Pt = isVt2InView ? projPt(vt2Lng, vt2Lat) : null;
      const vt2RadiusPx = zoom >= 13.2 ? Math.max(4.5, Math.pow(1.48, zoom - 11.4)) : 0;

      // 4a. Vẽ viền đường (Casing) gộp theo từng cấp đường (Mục 9: Casing mảnh để phân tách khỏi nền)
      if (pathAccess) {
        ctx.strokeStyle = '#D5CEC0';
        ctx.lineWidth = wAccess + 0.9;
        ctx.stroke(pathAccess);
      }
      if (pathAlley) {
        ctx.strokeStyle = '#C9C0B0';
        ctx.lineWidth = wAlley + 1.25;
        ctx.stroke(pathAlley);
      }
      if (pathMinor) {
        ctx.strokeStyle = '#C4BBA9';
        ctx.lineWidth = wMinor + 1.65;
        ctx.stroke(pathMinor);
      }
      if (pathSecondary) {
        ctx.strokeStyle = '#D8BA70';
        ctx.lineWidth = wSecondary + 2.1;
        ctx.stroke(pathSecondary);
      }
      if (vt2Pt && vt2RadiusPx > 0 && wSecondary > 0) {
        ctx.beginPath();
        ctx.arc(vt2Pt.x, vt2Pt.y, vt2RadiusPx, 0, Math.PI * 2);
        ctx.strokeStyle = '#D8BA70';
        ctx.lineWidth = wSecondary + 2.3;
        ctx.stroke();
      }
      if (pathMajor) {
        ctx.strokeStyle = '#D5AC52';
        ctx.lineWidth = wMajor + 2.5;
        ctx.stroke(pathMajor);
      }

      // 4b. Vẽ lòng đường (Road Fill) gộp theo từng cấp đường (Giao điểm sạch, không đứt đoạn)
      if (pathAccess) {
        ctx.strokeStyle = '#F9F6F0';
        ctx.lineWidth = wAccess;
        ctx.stroke(pathAccess);
      }
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
      if (vt2Pt && vt2RadiusPx > 0 && wSecondary > 0) {
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
        ctx.lineWidth = Math.max(2.6, wMinor || 2.6);
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

      // 4c-admin-road. Vẽ đoạn đường đang được chọn trong Admin Road Editor + Direct Geometry Node Edit + Vẽ tim ngõ A → B → C...
      const selRoad = selectedRoadRecordRef.current;
      const draftGeom = roadDraftGeometryRef.current;
      const activeGeomToRender =
        draftGeom && draftGeom.length >= 2
          ? draftGeom
          : selRoad && selRoad.geometry && selRoad.geometry.length >= 2
          ? selRoad.geometry
          : null;

      if (isRoadEditorOpenRef.current && activeGeomToRender && activeGeomToRender.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const isEditingNodes = Boolean(draftGeom && draftGeom.length >= 2);
        traceCoords(activeGeomToRender, false);
        ctx.strokeStyle = isEditingNodes ? '#D97706' : '#059669';
        ctx.lineWidth = Math.max(7.5, (wSecondary || 4) + 3.5);
        ctx.stroke();
        traceCoords(activeGeomToRender, false);
        ctx.strokeStyle = isEditingNodes ? '#FEF3C7' : '#A7F3D0';
        ctx.lineWidth = Math.max(3.2, (wMinor || 2.4) + 0.8);
        ctx.stroke();

        if (isEditingNodes && draftGeom) {
          // Vẽ các nút trung điểm (+) trên từng cạnh để bấm chèn thêm node
          ctx.font = `700 9px ${CANVAS_FONT_STACK}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (let i = 0; i < draftGeom.length - 1; i++) {
            const midLng = (draftGeom[i][0] + draftGeom[i + 1][0]) * 0.5;
            const midLat = (draftGeom[i][1] + draftGeom[i + 1][1]) * 0.5;
            const pm = projPt(midLng, midLat);
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(pm.x, pm.y, 5.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#D97706';
            ctx.fillText('+', pm.x, pm.y + 0.3);
          }

          // Vẽ các đỉnh node (1, 2, 3...) để Admin chọn hoặc dịch chuyển trực tiếp
          const selVIdx = selectedRoadVertexIdxRef.current;
          for (let idx = 0; idx < draftGeom.length; idx++) {
            const pv = projPt(draftGeom[idx][0], draftGeom[idx][1]);
            const isSelV = selVIdx === idx;
            ctx.fillStyle = isSelV ? '#DC2626' : '#D97706';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(pv.x, pv.y, isSelV ? 8.2 : 6.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(String(idx + 1), pv.x, pv.y + 0.4);
          }
        } else {
          // Vẽ 2 đầu mút của đoạn đường đang chọn
          const pStart = projPt(activeGeomToRender[0][0], activeGeomToRender[0][1]);
          const pEnd = projPt(
            activeGeomToRender[activeGeomToRender.length - 1][0],
            activeGeomToRender[activeGeomToRender.length - 1][1]
          );
          for (const pt of [pStart, pEnd]) {
            ctx.fillStyle = '#059669';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      const drawPts = roadDrawingPointsRef.current;
      if (isRoadEditorOpenRef.current && isDrawingRoadRef.current && drawPts.length >= 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (drawPts.length >= 2) {
          traceCoords(drawPts, false);
          ctx.strokeStyle = '#1D4ED8';
          ctx.lineWidth = 6.5;
          ctx.stroke();
          ctx.setLineDash([6, 5]);
          traceCoords(drawPts, false);
          ctx.strokeStyle = '#93C5FD';
          ctx.lineWidth = 2.6;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.font = `700 10px ${CANVAS_FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let idx = 0; idx < drawPts.length; idx++) {
          const p = projPt(drawPts[idx][0], drawPts[idx][1]);
          ctx.fillStyle = idx === 0 ? '#059669' : '#2563EB';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          const labelChar = idx < 26 ? String.fromCharCode(65 + idx) : String(idx + 1);
          ctx.fillText(labelChar, p.x, p.y + 0.5);
        }
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

      // 5. Lớp Công trình Thực tế (21.436 Master Buildings đồng nhất 100% ID & Footprint với 3D + 3 tầng Zoom LOD + Spatial Chunk Culling)
      const baseExtrude = mode3D
        ? Math.max(0, Math.min(28, Math.pow(1.55, zoom - 12.8) * 2.9))
        : 0;

      if (vis.buildings && zoom >= 12.8) {
        const useFastBatched2D = !mode3D || baseExtrude < 1.5 || isMoving;
        const masterDs = geo.masterDataset || getLoadedMasterDataset();
        const activeSelectedBld = selectedBuildingRef.current;

        if (masterDs && masterDs.buildings.length > 0) {
          const effectiveLodZoom = isMoving && zoom < 15.2 ? zoom - 0.35 : zoom;
          const visibleMasterBlds = queryMasterBuildingsInViewport(
            masterDs,
            { west: minLng, south: minLat, east: maxLng, north: maxLat },
            effectiveLodZoom
          );

          if (useFastBatched2D) {
            // Gom nhóm Path2D theo 6 nhóm màu ngữ cảnh Giai đoạn 2 (Section O & P):
            // civic | education | commercial | villa | industrial | residential
            const pathsByCat: Record<string, Path2D> = {
              residential: new Path2D(),
              commercial: new Path2D(),
              education: new Path2D(),
              civic: new Path2D(),
              villa: new Path2D(),
              industrial: new Path2D(),
            };
            const hasByCat: Record<string, boolean> = {
              residential: false,
              commercial: false,
              education: false,
              civic: false,
              villa: false,
              industrial: false,
            };

            const resolveCat = (b: (typeof visibleMasterBlds)[number]) => {
              const t = b.buildingType;
              if (t === 'civic' || t === 'education' || t === 'commercial' || t === 'villa' || t === 'industrial') {
                return t;
              }
              if (b.name || b.lodTier === 'far') return 'civic';
              return 'residential';
            };

            if (isFlat2D) {
              for (let idx = 0; idx < visibleMasterBlds.length; idx++) {
                const b = visibleMasterBlds[idx];
                const ring = b.ringLngLat;
                if (!ring || ring.length < 3) continue;
                const cat = resolveCat(b);
                const targetPath = pathsByCat[cat];
                hasByCat[cat] = true;

                targetPath.moveTo(
                  refX + (ring[0][0] - refLng) * scaleX,
                  refY + (ring[0][1] - refLat) * scaleY
                );
                for (let i = 1; i < ring.length; i++) {
                  targetPath.lineTo(
                    refX + (ring[i][0] - refLng) * scaleX,
                    refY + (ring[i][1] - refLat) * scaleY
                  );
                }
                targetPath.closePath();
              }
            } else {
              for (let idx = 0; idx < visibleMasterBlds.length; idx++) {
                const b = visibleMasterBlds[idx];
                const ring = b.ringLngLat;
                if (!ring || ring.length < 3) continue;
                const cat = resolveCat(b);
                const targetPath = pathsByCat[cat];
                hasByCat[cat] = true;

                const p0 = map.project([ring[0][0], ring[0][1]]);
                targetPath.moveTo(p0.x, p0.y);
                for (let i = 1; i < ring.length; i++) {
                  const pi = map.project([ring[i][0], ring[i][1]]);
                  targetPath.lineTo(pi.x, pi.y);
                }
                targetPath.closePath();
              }
            }

            // Zoom rất gần (>= 15.6): vẽ bóng đổ mềm rất nhẹ dưới chân công trình (Section P)
            if (!isMoving && zoom >= 15.6) {
              ctx.save();
              ctx.translate(1.8, 2.1);
              ctx.fillStyle = 'rgba(92, 82, 70, 0.13)';
              for (const k of ['residential', 'industrial', 'villa', 'commercial', 'education', 'civic']) {
                if (hasByCat[k]) ctx.fill(pathsByCat[k]);
              }
              ctx.restore();
            }

            const catStyles: Array<{ key: string; fill: string; stroke: string; lineW: number }> = [
              {
                key: 'residential',
                fill: 'rgba(235, 228, 214, 0.85)',
                stroke: 'rgba(191, 180, 162, 0.58)',
                lineW: 0.7,
              },
              {
                key: 'industrial',
                fill: 'rgba(222, 221, 226, 0.86)',
                stroke: 'rgba(168, 166, 176, 0.62)',
                lineW: 0.75,
              },
              {
                key: 'villa',
                fill: 'rgba(218, 234, 214, 0.88)',
                stroke: 'rgba(148, 180, 144, 0.65)',
                lineW: 0.8,
              },
              {
                key: 'commercial',
                fill: 'rgba(240, 214, 200, 0.88)',
                stroke: 'rgba(196, 148, 126, 0.66)',
                lineW: 0.82,
              },
              {
                key: 'education',
                fill: 'rgba(244, 225, 186, 0.90)',
                stroke: 'rgba(196, 156, 92, 0.72)',
                lineW: 0.9,
              },
              {
                key: 'civic',
                fill: 'rgba(246, 215, 168, 0.92)',
                stroke: 'rgba(198, 138, 72, 0.76)',
                lineW: 0.95,
              },
            ];

            for (const st of catStyles) {
              if (!hasByCat[st.key]) continue;
              const p = pathsByCat[st.key];
              ctx.fillStyle = st.fill;
              ctx.fill(p);
              if ((!isMoving && zoom >= 15.0) || st.key === 'civic' || st.key === 'education') {
                ctx.strokeStyle = st.stroke;
                ctx.lineWidth = zoom >= 15.6 ? st.lineW * 1.15 : st.lineW;
                ctx.stroke(p);
              }
            }
          } else {
            // Chế độ 3D nghiêng trên Canvas khi dừng kéo (!isMoving)
            const projectedBuildings: Array<{
              pts: Array<{ x: number; y: number }>;
              maxY: number;
              cx: number;
              cy: number;
              extrudePx: number;
              levels: number;
              isLandmark: boolean;
              isHighlightedZone: boolean;
              isSelected: boolean;
              name: string;
            }> = [];

            for (let idx = 0; idx < visibleMasterBlds.length; idx++) {
              const b = visibleMasterBlds[idx];
              const ring = b.ringLngLat;
              if (!ring || ring.length < 3) continue;

              const [bLng, bLat] = b.centroidLngLat;
              const distToFocus = Math.hypot(bLng - focus.lng, bLat - focus.lat);
              const isHighlightedZone = distToFocus <= focus.radiusDeg;
              const isSelected = Boolean(activeSelectedBld && activeSelectedBld.id === b.id);
              const isMajor = b.lodTier === 'far' || Boolean(b.name);

              // Chiều cao đồng nhất với Master Building (b.levels, b.height)
              const levels = Math.max(1, b.levels || Math.round((b.height || 7) / 3.3));
              const extrudePx = baseExtrude * (0.64 + Math.min(levels, 8) * 0.22);

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
                isLandmark: isMajor,
                isHighlightedZone,
                isSelected,
                name: b.name || '',
              });
            }

            projectedBuildings.sort((a, b) => a.maxY - b.maxY);

            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            for (let bIdx = 0; bIdx < projectedBuildings.length; bIdx++) {
              const b = projectedBuildings[bIdx];
              const { pts, extrudePx, levels, isLandmark, isHighlightedZone, isSelected, cx, cy } = b;
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

              ctx.fillStyle = isSelected ? '#FDE68A' : isLandmark ? '#D9B072' : '#C8BFA9';
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
                if (isSelected) {
                  wallFill = lightFactor > 0 ? '#FEF08A' : '#FCD34D';
                } else if (isLandmark) {
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

                const wallStroke = isSelected ? '#D97706' : isLandmark ? '#B88946' : '#ADA089';

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
              ctx.fillStyle = isSelected ? '#FEF9C3' : isLandmark ? '#FFEAC2' : '#F4F0E6';
              ctx.strokeStyle = isSelected ? '#B45309' : isLandmark ? '#9E6E28' : '#9E927B';
              ctx.lineWidth = isSelected ? 1.8 : zoom >= 15.0 ? 1.1 : 0.75;
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

          // Vẽ viền nổi bật cho Master Building đang được chọn (đồng bộ 2D <-> 3D)
          if (activeSelectedBld && activeSelectedBld.ringLngLat.length >= 3) {
            const ring = activeSelectedBld.ringLngLat;
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < ring.length; i++) {
              const p = projPt(ring[i][0], ring[i][1]);
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(250, 204, 21, 0.38)';
            ctx.fill();
            ctx.strokeStyle = '#D97706';
            ctx.lineWidth = 2.4;
            ctx.stroke();
            ctx.restore();
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
      const topSafeZoneY = isMobileScreen ? 132 : 124;
      const bottomSafeZoneY = height - (isMobileScreen ? 42 : 28);
      const placedPinLabelCenters: Array<{ x: number; y: number }> = [];
      const activeMarkers = filteredVerifiedMarkersRef.current;
      const activeClusters = poiClusters2DRef.current;
      const selId = selectedPlaceIdRef.current;
      const hovId = hoveredPlaceIdRef.current;
      const routeTargetId = activeRouteRef.current?.targetPlace.id || null;

      // Định vị các Cluster 2D khi ở zoom xa / zoom trung
      for (let i = 0; i < activeClusters.length; i++) {
        const cl = activeClusters[i];
        const el = clusterElsRef.current.get(cl.id);
        if (!el) continue;
        const pt = projPt(cl.lng, cl.lat);
        if (pt.x < -80 || pt.x > width + 80 || pt.y < -80 || pt.y > height + 80) {
          if (el.style.display !== 'none') el.style.display = 'none';
          continue;
        }
        if (el.style.display !== 'block') el.style.display = 'block';
        el.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
        reserveLabelBox(pt.x, pt.y, 28, 16, 30);
      }

      // activeMarkers đã được sort theo POI Priority DESC (selected=1000 -> routeTarget=950 -> landmark=850 -> civic=800 -> shop=400)
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

        // Khóa vùng icon tròn (28x28px) để chữ tên đường không vẽ xuyên qua nút ghim
        reserveLabelBox(px, py, 20, 20, 24);

        const labelEl = markerLabelElsRef.current.get(loc.id);
        if (labelEl) {
          let isPillVisible = labelEl.style.display === 'block';
          if (!isMoving) {
            const renderState = getPoiRenderState({
              place: loc,
              zoomOrCameraDistance: zoom,
              selectedPlaceId: selId,
              hoveredPlaceId: hovId,
              routeTargetId,
              mapMode: '2d',
              isCameraMoving: false,
              activeCategoryFilter: embeddedInAdmin ? 'all' : activeQuickFilterRef.current,
            });
            const isSelectedOrHoveredOrTarget =
              loc.id === selId || loc.id === hovId || loc.id === routeTargetId;
            const inSafeVerticalBand = py >= topSafeZoneY && py <= bottomSafeZoneY;
            const minLabelSpacing = isMobileScreen ? 108 : 96;

            let shouldShowLabel = false;
            if (isSelectedOrHoveredOrTarget) {
              shouldShowLabel = true;
              placedPinLabelCenters.push({ x: px, y: py - 24 });
            } else if (
              renderState.showLabel &&
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

      if (proposedPinMarkerElRef.current && activeProposedPinRef.current) {
        const propPin = activeProposedPinRef.current;
        const ptProp = projPt(propPin.proposedLng, propPin.proposedLat);
        if (proposedPinMarkerElRef.current.style.display !== 'block') {
          proposedPinMarkerElRef.current.style.display = 'block';
        }
        proposedPinMarkerElRef.current.style.transform = `translate3d(${ptProp.x.toFixed(1)}px, ${ptProp.y.toFixed(1)}px, 0)`;
        if (typeof propPin.oldLat === 'number' && typeof propPin.oldLng === 'number') {
          const ptOld = projPt(propPin.oldLng, propPin.oldLat);
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = '#D97706';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(ptOld.x, ptOld.y);
          ctx.lineTo(ptProp.x, ptProp.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else if (proposedPinMarkerElRef.current) {
        if (proposedPinMarkerElRef.current.style.display !== 'none') {
          proposedPinMarkerElRef.current.style.display = 'none';
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
          if (isPlaceHiddenOrDeletedInAdmin(f.properties?.id || f.id, cleanName)) continue;
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

      // 6c. Nhãn địa danh phân tầng Multi-LOD (Far / Mid / Near) từ xuanhoa-places-labels.geojson
      if (!isMoving && geo.placeLabels && geo.placeLabels.length > 0 && zoom >= 12.2) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < geo.placeLabels.length; i++) {
          const pf = geo.placeLabels[i];
          const coords = pf.geometry?.coordinates;
          if (!coords || coords.length < 2) continue;
          const [pLng, pLat] = coords;
          if (pLng < minLng || pLng > maxLng || pLat < minLat || pLat > maxLat) continue;
          const props = pf.properties || {};
          const lodTier = props.lodTier || 'mid';
          if (lodTier === 'mid' && zoom < 13.8) continue;
          if (lodTier === 'near' && zoom < 15.2) continue;

          const name = String(props.name || '').trim();
          if (!name) continue;
          if (isPlaceHiddenOrDeletedInAdmin(props.id || props.osm_id, name)) continue;
          const pt = projPt(pLng, pLat);
          if (pt.x < -80 || pt.x > width + 80 || pt.y < -40 || pt.y > height + 40) continue;

          const isFar = lodTier === 'far';
          const halfW = name.length * (isFar ? 3.5 : 3.1) + 12;
          if (!canPlaceLabel(pt.x, pt.y, halfW, 14, isFar ? 95 : 70)) continue;

          if (isFar) {
            ctx.font = `800 ${zoom >= 14.5 ? 10.6 : 9.8}px ${CANVAS_FONT_STACK}`;
            drawCanvasPillBadge(
              pt.x,
              pt.y,
              name,
              'rgba(255, 253, 249, 0.94)',
              '#39B980',
              '#14532D'
            );
          } else {
            ctx.font = `700 ${zoom >= 15.4 ? 10.0 : 9.2}px ${CANVAS_FONT_STACK}`;
            ctx.strokeStyle = 'rgba(255, 253, 249, 0.95)';
            ctx.lineWidth = 3.2;
            ctx.strokeText(name, pt.x, pt.y);
            ctx.fillStyle = '#334155';
            ctx.fillText(name, pt.x, pt.y);
          }
        }
      }

      // 6d. Nhãn 6 Khu Đô Thị Minh Họa trên nền Canvas (Chỉ vẽ khi bật lớp Khu minh họa decorativeZones)
      if (vis.decorativeZones && !vis.realPois && zoom >= 14.2) {
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

      // 7. HỆ THỐNG NHÃN TÊN ĐƯỜNG CHUẨN GOOGLE MAPS (Label LOD theo 5 cấp + Centerline Placement + Khoảng cách lặp thông minh)
      const roadAnchors = geo.roadLabelAnchors || [];
      if (zoom >= 12.4 && roadAnchors.length > 0) {
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

        // Lọc các điểm neo đang nằm trong khung nhìn và thỏa mãn cấp độ Label LOD của Google Maps (Mục 11)
        const visibleCandidates: Array<{
          anchor: RoadLabelAnchor;
          displayText: string;
          displayHalfW: number;
          x: number;
          y: number;
          isHighlighted: boolean;
          tierRank: number;
          distCenterSq: number;
        }> = [];

        const selectedRoadIdNow = selectedRoadRecordRef.current?.roadId || '';

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
          const roadClass = anchor.roadClass || (tier === 'major' ? 'major' : tier === 'secondary' ? 'arterial' : anchor.isAlley ? 'alley' : 'local');
          const isAlley = anchor.isAlley || roadClass === 'alley' || roadClass === 'access';
          const isHighlighted = Boolean(
            (selectedRoadIdNow && anchor.roadId === selectedRoadIdNow) ||
              (highlightedRoad && (highlightedRoad === name || highlightedRoad === anchor.roadId))
          );

          const displayText = formatRoadLabelForZoom({
            name,
            roadClass,
            roadType: anchor.roadType || (isAlley ? 'alley' : tier === 'major' ? 'road' : 'street'),
            verificationStatus: anchor.verificationStatus || 'verified',
            nameSource: anchor.nameSource || 'osm',
            segmentLengthM: anchor.segmentLengthM || 80,
            zoom,
            isSelectedOrHighlighted: isHighlighted,
          });
          if (!displayText) continue;

          const displayHalfW =
            displayText === name
              ? anchor.halfW
              : Math.max(20, Math.round(displayText.length * 3.35 + 10));

          if (!isHighlighted) {
            // Phân tầng Label LOD theo Mục 11:
            // - Zoom < 13.2: chỉ hiện trục Major (Nguyễn Văn Linh, Hùng Vương...)
            // - Zoom 13.2 -> 14.2: hiện Major + Arterial (Phạm Văn Đồng, Kim Ngọc, Lê Thái Tổ...)
            // - Zoom 14.2 -> 15.2: hiện thêm Local (Võ Thị Sáu, Kim Đồng, Lê Quang Đạo...)
            // - Zoom >= 15.2: hiện thêm Alley (Ngõ 29 Nguyễn Văn Linh...)
            if (zoom < 13.2 && roadClass !== 'major') continue;
            if (zoom < 14.2 && roadClass !== 'major' && roadClass !== 'arterial') continue;
            if (zoom < (isMoving ? 15.4 : 15.2) && isAlley) continue;

            // Kiểm tra chiều dài con đường trên màn hình phải đủ dài hơn chữ thì mới hiện tên
            const roadScreenLenPx = anchor.roadSpanDeg * pxPerDeg;
            const minScreenRatio = isAlley ? 0.95 : 2.0;
            if (roadScreenLenPx < displayHalfW * minScreenRatio) continue;
          }

          const ptCenter = projPt(anchor.lng, anchor.lat);
          // Chừa lề an toàn để chữ tên đường không bị cắt cụt ở mép màn hình
          if (
            ptCenter.x < displayHalfW + 16 ||
            ptCenter.x > width - displayHalfW - 16 ||
            ptCenter.y < 48 ||
            ptCenter.y > height - 32
          ) {
            continue;
          }

          const tierRank = isHighlighted
            ? 0
            : roadClass === 'major'
            ? 1
            : roadClass === 'arterial'
            ? 2
            : roadClass === 'local'
            ? 3
            : 4;
          const dx = ptCenter.x - viewCenterX;
          const dy = ptCenter.y - viewCenterY;

          visibleCandidates.push({
            anchor,
            displayText,
            displayHalfW,
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
          const { anchor, displayText, displayHalfW, x, y, isHighlighted } = visibleCandidates[i];
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

          if (!canPlaceLabel(x, y, displayHalfW, 13, minOtherLabelDistPx)) continue;

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
          ctx.strokeText(displayText, 0, 0);
          ctx.fillStyle = isHighlighted
            ? '#114B32'
            : isArterial
            ? '#4A3F35'
            : isAlley
            ? '#70757A'
            : '#5F6368';
          ctx.fillText(displayText, 0, 0);
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

  // Hàm cập nhật nóng (Live Reload 0ms) toàn bộ đường/ngõ/nhãn/search khi Admin lưu chỉnh sửa tên đường hoặc vẽ lại ngõ
  const rebuildRoadLayersLive = useCallback(() => {
    const curGeo = geoLayersRef.current;
    const rawRoads = curGeo?.rawSourceRoads;
    if (!curGeo || !rawRoads || rawRoads.length === 0) return;

    const rebuilt = buildProcessedRoadDataFromRaw(rawRoads);
    const nextGeo: LoadedGeoLayers = {
      ...curGeo,
      roads: rebuilt.roads,
      roadRecordsById: rebuilt.roadRecordsById,
      roadsMajor: rebuilt.roadsMajor,
      roadsSecondary: rebuilt.roadsSecondary,
      roadsMinor: rebuilt.roadsMinor,
      roadsAlley: rebuilt.roadsAlley,
      roadsAccess: rebuilt.roadsAccess,
      roadLabelAnchors: rebuilt.roadLabelAnchors,
    };
    geoLayersRef.current = nextGeo;
    const nextOsmRoads = buildUnifiedSearchableRoads(
      rebuilt.roadRecordsById,
      VERIFIED_OSM_ROADS_SEED
    );
    if (cachedProcessedGeoBundle) {
      cachedProcessedGeoBundle = {
        ...cachedProcessedGeoBundle,
        geoLayers: nextGeo,
        osmRoads: nextOsmRoads,
      };
    }
    setOsmRoads(nextOsmRoads);
    setRoadAuditIssues(auditAllRoadRecords(rebuilt.roadRecordsById));

    const curSelId = selectedRoadRecordRef.current?.roadId;
    if (curSelId) {
      const updatedSel = rebuilt.roadRecordsById.get(curSelId) || null;
      setSelectedRoadRecord(updatedSel);
      selectedRoadRecordRef.current = updatedSel;
    }

    scheduleCanvasRender();
  }, [scheduleCanvasRender]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRoadOverridesUpdate = () => {
      rebuildRoadLayersLive();
    };
    window.addEventListener(ROAD_OVERRIDES_UPDATED_EVENT, handleRoadOverridesUpdate);
    return () => {
      window.removeEventListener(ROAD_OVERRIDES_UPDATED_EVENT, handleRoadOverridesUpdate);
    };
  }, [rebuildRoadLayersLive]);

  // Tải & tái sử dụng tức thì bộ dữ liệu địa lý OpenStreetMap đã xác minh từ bộ nhớ đệm RAM (0ms trên các lần mở tiếp theo)
  useEffect(() => {
    if (cachedProcessedGeoBundle) {
      geoLayersRef.current = cachedProcessedGeoBundle.geoLayers;
      setRoadAuditIssues(
        auditAllRoadRecords(
          cachedProcessedGeoBundle.geoLayers.roadRecordsById || new Map<string, RoadRecord>()
        )
      );
      setIsMapLoading(false);
      scheduleCanvasRender();
      return;
    }

    let cancelled = false;
    prefetchDigitalMapGeoLayers()
      .then((bundle) => {
        if (cancelled) return;
        geoLayersRef.current = bundle.geoLayers;
        setOsmRoads(bundle.osmRoads);
        setOsmRoadMatchedCatalog(bundle.osmRoadMatchedCatalog);
        setRoadAuditIssues(
          auditAllRoadRecords(bundle.geoLayers.roadRecordsById || new Map<string, RoadRecord>())
        );
        setIsMapLoading(false);
        setCameraVersion((v) => v + 1);
        scheduleCanvasRender();
      })
      .catch((err) => {
        if (!cancelled && err?.name !== 'AbortError') {
          console.error('Failed loading geo layers:', err);
          setIsMapLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scheduleCanvasRender]);

  // Hiển thị toàn bộ các vị trí đã xác minh tọa độ (gồm mốc địa danh OSM thật + các quán đã được Chủ quán ghim & Admin duyệt)
  const { verifiedMapMarkers, unverifiedCatalogPlaces, blockedAdminPlaces } = useMemo(() => {
    const base = getAllMapPlaceLocations();
    return {
      verifiedMapMarkers: base.verifiedMapMarkers,
      unverifiedCatalogPlaces: base.unverifiedCatalogPlaces,
      blockedAdminPlaces: base.blockedAdminPlaces || [],
    };
  }, [syncTick, adminSyncVersion]);

  const initialQualityReport = useMemo(() => buildDataQualityReport(), []);
  const dataQualityReport = useMemo(() => {
    const baseReport = embeddedInAdmin ? initialQualityReport : buildDataQualityReport();
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
  }, [embeddedInAdmin, initialQualityReport, verifiedMapMarkers.length, unverifiedCatalogPlaces.length, syncTick, adminSyncVersion]);

  // Danh sách các địa điểm đã được lưu (★) của tài khoản hiện tại
  const savedPlaceObjects = useMemo(
    () => verifiedMapMarkers.filter((loc) => savedPlaceIds.includes(loc.id)),
    [verifiedMapMarkers, savedPlaceIds]
  );

  // Lọc danh sách marker đã xác minh theo bộ lọc danh mục nhanh + POI LOD & Clustering (Phần 5, 29–34, 54)
  const { filteredVerifiedMarkers, poiClusters2D } = useMemo(() => {
    if (!layerVisibility.realPois) {
      return { filteredVerifiedMarkers: [] as PlaceLocation[], poiClusters2D: [] as PoiClusterItem[] };
    }
    const baseList = verifiedMapMarkers.filter((loc) => {
      if (!loc.coordinateVerified || loc.lat === null || loc.lng === null) return false;
      if (loc.visibilityStatus && loc.visibilityStatus !== 'visible') return false;
      if (isPlaceHiddenOrDeletedInAdmin(loc.id, loc.name)) return false;
      return true;
    });

    const effectiveZoom = embeddedInAdmin ? Math.max(currentZoom, 15.8) : currentZoom;
    const effectiveFilter = embeddedInAdmin ? 'all' : activeQuickFilter;
    const lodRes = computeSpatialPoiClusters({
      places: baseList,
      mapMode: '2d',
      zoomOrCameraDistance: effectiveZoom,
      selectedPlaceId: selectedPlace?.id || (embeddedInAdmin ? adminSelectedPlaceId : null),
      hoveredPlaceId,
      routeTargetId: activeRoute?.targetPlace.id || null,
      activeCategoryFilter: effectiveFilter,
    });

    logMapDebug('2D MARKER UPDATE', {
      embeddedInAdmin,
      activeQuickFilter: effectiveFilter,
      totalVerified: verifiedMapMarkers.length,
      renderedMarkers2D: lodRes.visiblePlaces.length,
      clusters2D: lodRes.clusters.length,
    });
    return {
      filteredVerifiedMarkers: lodRes.visiblePlaces.map((v) => v.place),
      poiClusters2D: lodRes.clusters,
    };
  }, [
    verifiedMapMarkers,
    activeQuickFilter,
    layerVisibility.realPois,
    embeddedInAdmin,
    adminSelectedPlaceId,
    currentZoom,
    selectedPlace?.id,
    hoveredPlaceId,
    activeRoute?.targetPlace.id,
  ]);

  filteredVerifiedMarkersRef.current = filteredVerifiedMarkers;
  poiClusters2DRef.current = poiClusters2D;

  // Đồng bộ danh sách marker & cluster đã lọc vào ref để vòng lặp 60fps khóa tọa độ chính xác tuyệt đối
  useEffect(() => {
    filteredVerifiedMarkersRef.current = filteredVerifiedMarkers;
    poiClusters2DRef.current = poiClusters2D;
    scheduleCanvasRender();
  }, [filteredVerifiedMarkers, poiClusters2D, scheduleCanvasRender]);

  // Đồng bộ lại thẻ selectedPlace đang mở ngay khi Admin lưu chỉnh sửa tên / địa chỉ / tọa độ
  useEffect(() => {
    if (!selectedPlace) return;
    const updated = verifiedMapMarkers.find((p) => p.id === selectedPlace.id);
    if (updated) {
      setSelectedPlace(updated);
    }
  }, [verifiedMapMarkers, selectedPlace?.id]);

  useEffect(() => {
    selectedPlaceIdRef.current =
      selectedPlace?.id || (embeddedInAdmin ? adminSelectedPlaceId || null : null);
    hoveredPlaceIdRef.current = hoveredPlaceId;
    scheduleCanvasRender();
  }, [selectedPlace, embeddedInAdmin, adminSelectedPlaceId, hoveredPlaceId, scheduleCanvasRender]);

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
      const initLat = initialAdminCoordsRef.current.lat;
      const initLng = initialAdminCoordsRef.current.lng;
      const hasValidInitCoords =
        typeof initLat === 'number' &&
        typeof initLng === 'number' &&
        !Number.isNaN(initLat) &&
        !Number.isNaN(initLng) &&
        initLat >= 20 &&
        initLat <= 23 &&
        initLng >= 104 &&
        initLng <= 107;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: buildXuhoPastelMapStyle(base),
        center: hasValidInitCoords
          ? [initLng!, initLat!]
          : [XUANHOA_DEFAULT_CENTER.lng, XUANHOA_DEFAULT_CENTER.lat],
        zoom: hasValidInitCoords ? 16.4 : XUANHOA_DEFAULT_CENTER.zoom,
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
      if (import.meta.env.DEV) {
        console.debug('[MAP INIT] MapLibre instance initialized');
      }

      return () => {
        if (import.meta.env.DEV) {
          console.debug('[MAP DESTROY] MapLibre instance removed');
        }
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

      // Ưu tiên 0: Nếu Admin đang ở MODE A (Di chuyển địa danh) trên Bản đồ 2D -> Gán tọa độ mới chờ xác nhận (Phần 17 & 30)
      if (
        (isAdminUser || isMapManagerUser) &&
        selectedPlace &&
        adminLandmarkMode2D === 'mode_a_place' &&
        !isPickingOnMap &&
        !embeddedInAdmin
      ) {
        triggerFeedback('pin');
        setPendingMoveCoords2D({ lat: pickedLat, lng: pickedLng });
        showTemporaryMapNotice(
          `📍 Đã chấm tọa độ mới (${pickedLat}, ${pickedLng}) cho "${selectedPlace.name}" — Hãy bấm "Lưu vị trí mới" trong khung xác nhận!`,
          3200
        );
        scheduleCanvasRender();
        return;
      }

      // Ưu tiên 1: Nếu Admin / Quản lý Maps đang bấm "Chấm trực tiếp trên Bản đồ" từ bảng chỉnh sửa -> Đưa tọa độ về lại đúng bảng chỉnh sửa, tuyệt đối không bị văng ra ngoài
      if (isPickingOnMap && (isAdminUser || isMapManagerUser)) {
        triggerFeedback('pin');
        setAdminLatInput(String(pickedLat));
        setAdminLngInput(String(pickedLng));
        setAdminCoordSource('admin_verified');
        setIsPickingOnMap(false);
        setIsAdminCoordModalOpen(true);
        setAdminFeedback(
          `✅ Đã lấy tọa độ (${pickedLat}, ${pickedLng}) từ Bản đồ! Hãy bấm "Lưu cập nhật Địa điểm" để hoàn tất.`
        );
        map.easeTo({
          center: [pickedLng, pickedLat],
          zoom: Math.max(map.getZoom(), 16.6),
          duration: 280,
        });
        scheduleCanvasRender();
        return;
      }

      // Ưu tiên 1B: Nếu Admin đang mở Chế độ Chỉnh Đường / Ngõ (Admin Road Editor)
      if (isRoadEditorOpenRef.current && (isAdminUser || isMapManagerUser)) {
        // 1B-0: Chế độ Direct Geometry Node Edit (chọn node, chèn node vào trung điểm cạnh, hoặc dịch node đang chọn)
        const curDraft = roadDraftGeometryRef.current;
        if (curDraft && curDraft.length >= 2) {
          const clickPt = e.point;
          // 1. Kiểm tra nếu bấm trúng một đỉnh node hiện có (<= 16px)
          for (let idx = 0; idx < curDraft.length; idx++) {
            const pNode = map.project([curDraft[idx][0], curDraft[idx][1]]);
            if (Math.hypot(pNode.x - clickPt.x, pNode.y - clickPt.y) <= 16) {
              triggerFeedback('tap');
              setSelectedRoadVertexIdx(idx);
              selectedRoadVertexIdxRef.current = idx;
              showTemporaryMapNotice(
                `🎯 Đã chọn Node #${idx + 1} (${curDraft[idx][1].toFixed(5)}, ${curDraft[idx][0].toFixed(5)}) — Bấm vị trí mới trên bản đồ để dịch chuyển node này!`,
                2600
              );
              scheduleCanvasRender();
              return;
            }
          }
          // 2. Kiểm tra nếu bấm trúng nút trung điểm (+) trên cạnh (<= 15px) -> chèn thêm node mới
          for (let i = 0; i < curDraft.length - 1; i++) {
            const midLng = (curDraft[i][0] + curDraft[i + 1][0]) * 0.5;
            const midLat = (curDraft[i][1] + curDraft[i + 1][1]) * 0.5;
            const pMid = map.project([midLng, midLat]);
            if (Math.hypot(pMid.x - clickPt.x, pMid.y - clickPt.y) <= 15) {
              triggerFeedback('pin');
              const insertedGeom = insertRoadVertexAtSegmentMidpoint(curDraft, i);
              const newIdx = i + 1;
              setRoadDraftGeometry(insertedGeom);
              roadDraftGeometryRef.current = insertedGeom;
              setSelectedRoadVertexIdx(newIdx);
              selectedRoadVertexIdxRef.current = newIdx;
              showTemporaryMapNotice(
                `➕ Đã thêm Node #${newIdx + 1} vào giữa cạnh — Bấm lên bản đồ để chỉnh vị trí node!`,
                2600
              );
              scheduleCanvasRender();
              return;
            }
          }
          // 3. Nếu đang có 1 node được chọn -> di chuyển node đó tới vị trí vừa bấm trên bản đồ
          const selIdx = selectedRoadVertexIdxRef.current;
          if (selIdx !== null && selIdx >= 0 && selIdx < curDraft.length) {
            triggerFeedback('pin');
            const moved = moveRoadVertex(curDraft, selIdx, [pickedLng, pickedLat]);
            setRoadDraftGeometry(moved);
            roadDraftGeometryRef.current = moved;
            showTemporaryMapNotice(
              `📐 Đã dịch Node #${selIdx + 1} tới (${pickedLat.toFixed(5)}, ${pickedLng.toFixed(5)}) — Bấm "Lưu" để áp dụng!`,
              2600
            );
            scheduleCanvasRender();
            return;
          }
        }

        // 1B-1: Chế độ Vẽ ngõ trực tiếp A → B → C...
        if (isDrawingRoadRef.current) {
          triggerFeedback('pin');
          const nextPt: [number, number] = [pickedLng, pickedLat];
          setRoadDrawingPoints((prev) => {
            const next = [...prev, nextPt];
            roadDrawingPointsRef.current = next;
            return next;
          });
          showTemporaryMapNotice(
            `📍 Đã chấm điểm #${roadDrawingPointsRef.current.length + 1} (${pickedLat.toFixed(5)}, ${pickedLng.toFixed(5)}) — Bấm tiếp theo tim ngõ hoặc bấm "Hoàn tất"`,
            2600
          );
          scheduleCanvasRender();
          return;
        }

        // 1B-2: Chế độ Nối đoạn đường (chọn đoạn thứ 2)
        if (isMergingSecondRoadRef.current && selectedRoadRecordRef.current) {
          const hitSecond = findNearestRoadAtLngLat(
            geoLayersRef.current?.roadRecordsById || new Map<string, RoadRecord>(),
            pickedLng,
            pickedLat,
            32
          );
          if (hitSecond && hitSecond.record.roadId !== selectedRoadRecordRef.current.roadId) {
            triggerFeedback('pin');
            const merged = mergeAdminRoadSegments(
              selectedRoadRecordRef.current,
              hitSecond.record
            );
            setIsMergingSecondRoad(false);
            isMergingSecondRoadRef.current = false;
            if (merged) {
              const updatedRec =
                geoLayersRef.current?.roadRecordsById?.get(merged.roadId) ||
                selectedRoadRecordRef.current;
              setSelectedRoadRecord(updatedRec);
              selectedRoadRecordRef.current = updatedRec;
              highlightedRoadNameRef.current = updatedRec.name || updatedRec.roadId;
              showTemporaryMapNotice(
                `✅ Đã nối thành công 2 đoạn vào [${merged.roadId}] "${merged.name || '(Chưa đặt tên)'}"!`,
                3200
              );
            }
          } else {
            showTemporaryMapNotice(
              '⚠️ Hãy bấm vào một đoạn đường khác ở gần để nối vào đoạn đang chọn.',
              2600
            );
          }
          scheduleCanvasRender();
          return;
        }

        // 1B-3: Chạm vào một đoạn đường / ngõ trên bản đồ để chọn kiểm tra / đổi tên / vẽ lại
        const hitRoad = findNearestRoadAtLngLat(
          geoLayersRef.current?.roadRecordsById || new Map<string, RoadRecord>(),
          pickedLng,
          pickedLat,
          30
        );
        if (hitRoad) {
          triggerFeedback('tap');
          setSelectedRoadRecord(hitRoad.record);
          selectedRoadRecordRef.current = hitRoad.record;
          highlightedRoadNameRef.current = hitRoad.record.name || hitRoad.record.roadId;
          showTemporaryMapNotice(
            `🛣️ Đã chọn [${hitRoad.record.roadId}]: ${hitRoad.record.name || '(Đoạn đường chưa đặt tên)'} (${Math.round(hitRoad.distanceMeters)}m)`,
            2600
          );
          scheduleCanvasRender();
          return;
        }
      }

      if (embeddedInAdmin && onAdminPickCoordinates) {
        triggerFeedback('pin');
        onAdminPickCoordinates(pickedLat, pickedLng);
        map.easeTo({
          center: [pickedLng, pickedLat],
          zoom: Math.max(map.getZoom(), 16.5),
          duration: 280,
        });
        scheduleCanvasRender();
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

      // Kiểm tra nếu người dùng chạm vào một công trình trong Master Dataset (21.436 công trình đồng bộ 2D <-> 3D)
      const masterDsForPick = geoLayersRef.current?.masterDataset || getLoadedMasterDataset();
      const rawHitBld = findMasterBuildingAtLngLat(masterDsForPick, pickedLng, pickedLat, 10);
      const hitMasterBld =
        rawHitBld && rawHitBld.name && isPlaceHiddenOrDeletedInAdmin(rawHitBld.id, rawHitBld.name)
          ? { ...rawHitBld, name: undefined }
          : rawHitBld;
      if (hitMasterBld) {
        triggerFeedback('tap');
        setSelectedBuilding(hitMasterBld);
        selectedBuildingRef.current = hitMasterBld;
      } else if (selectedBuildingRef.current) {
        setSelectedBuilding(null);
        selectedBuildingRef.current = null;
      }

      // Chuyển Tiêu điểm 3D (Spotlight 3D Focus) sang đúng khu vực người dùng vừa ấn vào
      focusTargetRef.current = {
        lat: pickedLat,
        lng: pickedLng,
        radiusDeg: 0.0044,
        label: hitMasterBld?.name || 'Khu vực đang chọn trên bản đồ',
      };
      setFocusZoneLabel(
        hitMasterBld
          ? `🏢 Công trình #${hitMasterBld.id} (${CONTEXTUAL_ZONE_LABELS[hitMasterBld.zone] || hitMasterBld.zone})`
          : '📍 Khu phố vừa chạm chọn (Nổi 3D)'
      );
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
    isMapManagerUser,
    selectedPlace,
    adminLandmarkMode2D,
    showTemporaryMapNotice,
    embeddedInAdmin,
    onAdminPickCoordinates,
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

      map.stop();
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
      if (isPickingOnMap && (isAdminUser || isMapManagerUser) && place.lat !== null && place.lng !== null) {
        triggerFeedback('pin');
        setAdminLatInput(String(place.lat));
        setAdminLngInput(String(place.lng));
        setAdminCoordSource('admin_verified');
        setIsPickingOnMap(false);
        setIsAdminCoordModalOpen(true);
        setAdminFeedback(
          `✅ Đã lấy tọa độ (${place.lat}, ${place.lng}) trên Bản đồ! Bấm "Lưu cập nhật Địa điểm" để hoàn tất.`
        );
        return;
      }
      triggerFeedback('tap');
      highlightedRoadNameRef.current = '';
      setSelectedGameAsset(null);
      setClusterSelectionList(null);
      if (embeddedInAdmin) {
        if (onAdminSelectPlace) {
          onAdminSelectPlace(place.id);
        }
        return;
      }
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
    [
      isPickingOnMap,
      isAdminUser,
      isMapManagerUser,
      flyToCoordinates,
      currentZoom,
      embeddedInAdmin,
      onAdminSelectPlace,
    ]
  );

  // Tự động di chuyển Bản đồ số nhúng trong Cột 3 của Quản lý Maps tới tọa độ quán đang chọn (nhẹ tênh 160ms easeTo, hủy animation cũ, không recompute store)
  useEffect(() => {
    if (!embeddedInAdmin) return;
    const map = mapInstanceRef.current;
    if (
      typeof adminPreviewLat === 'number' &&
      typeof adminPreviewLng === 'number' &&
      !Number.isNaN(adminPreviewLat) &&
      !Number.isNaN(adminPreviewLng) &&
      adminPreviewLat >= 20 &&
      adminPreviewLat <= 23 &&
      adminPreviewLng >= 104 &&
      adminPreviewLng <= 107
    ) {
      focusTargetRef.current = {
        lat: adminPreviewLat,
        lng: adminPreviewLng,
        radiusDeg: 0.0042,
        label: focusTargetRef.current.label,
      };
      if (map) {
        map.stop();
        const cur = map.getCenter();
        const distDeg = Math.hypot(cur.lng - adminPreviewLng, cur.lat - adminPreviewLat);
        map.easeTo({
          center: [adminPreviewLng, adminPreviewLat],
          zoom: Math.max(map.getZoom(), 16.3),
          duration: distDeg < 0.0012 ? 120 : 180,
          essential: true,
        });
      }
      scheduleCanvasRender();
    } else {
      scheduleCanvasRender();
    }
  }, [
    embeddedInAdmin,
    adminSelectedPlaceId,
    adminPreviewLat,
    adminPreviewLng,
    adminFlyTrigger,
    scheduleCanvasRender,
  ]);

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

  const handleSelectUnverifiedPlace = useCallback(
    (place: PlaceLocation) => {
      triggerFeedback('tap');
      if (isAdminUser || isMapManagerUser) {
        if (embeddedInAdmin && onAdminSelectPlace) {
          onAdminSelectPlace(place.id);
          setLocationNotice(`🎯 Đã chọn "${place.name}" — Hãy bấm lên Bản đồ để ghim tọa độ ngay!`);
          return;
        }
        openAdminCoordinateModal(place);
        return;
      }
      if (place.originalPlace) {
        setModalPlace(place.originalPlace);
      }
    },
    [isAdminUser, isMapManagerUser, embeddedInAdmin, onAdminSelectPlace]
  );

  const handleReviewRoadFromSearch = useCallback(
    (road: RoadSearchResult) => {
      const targetId = road.candidateRoadId || road.osmId;
      const mapById = geoLayersRef.current?.roadRecordsById;
      const rec = mapById?.get(targetId) || mapById?.get(road.osmId) || null;
      setIsRoadEditorOpen(true);
      isRoadEditorOpenRef.current = true;
      if (rec) {
        setSelectedRoadRecord(rec);
        selectedRoadRecordRef.current = rec;
        highlightedRoadNameRef.current = rec.name || rec.roadId;
      }
      flyToCoordinates(road.lat, road.lng, 17.6, `🔍 Rà soát: ${road.name}`, 0.0028);
      showTemporaryMapNotice(
        `🔍 Đang rà soát địa chỉ "${road.name}" — Hãy kiểm tra đoạn ứng viên [${targetId}] hoặc bấm "Vẽ ngõ" để vẽ lại!`,
        3800
      );
    },
    [flyToCoordinates, showTemporaryMapNotice]
  );

  const handleSelectRoad = useCallback(
    (road: RoadSearchResult) => {
      if (
        road.verificationStatus === 'needs_review' ||
        road.verificationStatus === 'rejected' ||
        road.nameSource === 'inferred'
      ) {
        showTemporaryMapNotice(`⚠️ Địa chỉ "${road.name}" đang được rà soát.`, 3400);
        if (isAdminUser || isMapManagerUser) {
          handleReviewRoadFromSearch(road);
        }
        return;
      }

      highlightedRoadNameRef.current = road.name;
      setSelectedPlace(null);
      setSelectedGameAsset(null);
      const rec = geoLayersRef.current?.roadRecordsById?.get(road.osmId) || null;
      if (isRoadEditorOpenRef.current && rec) {
        setSelectedRoadRecord(rec);
        selectedRoadRecordRef.current = rec;
      }
      const targetZ = road.roadType === 'alley' || road.roadType === 'lane' ? 17.5 : 16.4;
      flyToCoordinates(road.lat, road.lng, targetZ, `🛣️ ${road.name}`, 0.0038);
      setLocationNotice(`🛣️ Đang làm nổi bật tuyến đường: ${road.name}`);
      setTimeout(() => setLocationNotice(null), 4000);
    },
    [flyToCoordinates, handleReviewRoadFromSearch, isAdminUser, isMapManagerUser, showTemporaryMapNotice]
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

  const newPlaceDraftRef = useRef<{
    hasDraft: boolean;
    name: string;
    category: Exclude<MapCategoryKey, 'all' | 'game_asset'>;
    parentCategory: MapParentCategoryId;
    subcategory: MapSubcategoryId;
    showByDefault: boolean;
    address: string;
    tagline: string;
    phone: string;
    hours: string;
    mapsUrl: string;
    lat: string;
    lng: string;
  }>({
    hasDraft: false,
    name: '',
    category: 'public',
    parentCategory: 'public',
    subcategory: 'government',
    showByDefault: true,
    address: 'Phường Xuân Hòa',
    tagline: '',
    phone: '',
    hours: '07:30 - 17:30',
    mapsUrl: '',
    lat: '',
    lng: '',
  });

  useEffect(() => {
    if (!isAdminCreatingNew) return;
    newPlaceDraftRef.current = {
      hasDraft: true,
      name: adminEditName,
      category: adminEditCategory,
      parentCategory: adminEditParentCategory,
      subcategory: adminEditSubcategory,
      showByDefault: adminEditShowByDefault,
      address: adminEditAddress,
      tagline: adminEditTagline,
      phone: adminEditPhone,
      hours: adminEditHours,
      mapsUrl: adminMapsUrlInput,
      lat: adminLatInput,
      lng: adminLngInput,
    };
  }, [
    isAdminCreatingNew,
    adminEditName,
    adminEditCategory,
    adminEditParentCategory,
    adminEditSubcategory,
    adminEditShowByDefault,
    adminEditAddress,
    adminEditTagline,
    adminEditPhone,
    adminEditHours,
    adminMapsUrlInput,
    adminLatInput,
    adminLngInput,
  ]);

  const resetNewPlaceDraft = useCallback(() => {
    const center = mapInstanceRef.current?.getCenter();
    const lat = center ? Number(center.lat.toFixed(6)) : XUANHOA_DEFAULT_CENTER.lat;
    const lng = center ? Number(center.lng.toFixed(6)) : XUANHOA_DEFAULT_CENTER.lng;
    newPlaceDraftRef.current = {
      hasDraft: false,
      name: '',
      category: 'public',
      parentCategory: 'public',
      subcategory: 'government',
      showByDefault: true,
      address: 'Phường Xuân Hòa',
      tagline: '',
      phone: '',
      hours: '07:30 - 17:30',
      mapsUrl: '',
      lat: String(lat),
      lng: String(lng),
    };
    setAdminEditName('');
    setAdminEditCategory('public');
    setAdminEditParentCategory('public');
    setAdminEditSubcategory('government');
    setAdminEditShowByDefault(true);
    setAdminEditAddress('Phường Xuân Hòa');
    setAdminEditTagline('');
    setAdminEditPhone('');
    setAdminEditHours('07:30 - 17:30');
    setAdminHoursError(null);
    setAdminMapsUrlInput('');
    setAdminLatInput(String(lat));
    setAdminLngInput(String(lng));
  }, []);

  const populateAdminFormFromPlace = useCallback((target: PlaceLocation | null) => {
    setAdminTargetPlace(target);
    setAdminCategorySearch('');
    setAdminHoursError(null);
    if (!target) {
      setAdminEditName('');
      setAdminEditCategory('public');
      setAdminEditParentCategory('public');
      setAdminEditSubcategory('government');
      setAdminEditShowByDefault(true);
      setAdminEditAddress('Phường Xuân Hòa');
      setAdminEditTagline('');
      setAdminEditPhone('');
      setAdminEditHours('07:30 - 17:30');
      setAdminMapsUrlInput('');
      setAdminLatInput('');
      setAdminLngInput('');
      return;
    }
    const tax = resolvePlaceTaxonomy({
      id: target.id,
      name: target.name,
      category: target.category,
      parentCategoryId: target.parentCategoryId,
      subcategoryId: target.subcategoryId,
      subType: target.metadata?.subType,
    });
    setAdminEditName(target.name || '');
    setAdminEditCategory(target.category || 'public');
    setAdminEditParentCategory(tax.parentCategoryId);
    setAdminEditSubcategory(tax.subcategoryId);
    setAdminEditShowByDefault(Boolean(target.showByDefault || isDefaultVisibleMapLandmark(target)));
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
      if (!isAdminUser && !isMapManagerUser) {
        setLocationNotice('Chỉ Quản trị viên hoặc Quản lý Maps mới có quyền chỉnh sửa địa điểm.');
        return;
      }
      triggerFeedback('tap');
      const target = place || selectedPlace || verifiedMapMarkers[0] || unverifiedCatalogPlaces[0] || null;
      setIsAdminCreatingNew(false);
      populateAdminFormFromPlace(target);
      if (embeddedInAdmin && onAdminSelectPlace && target) {
        onAdminSelectPlace(target.id);
      }
      setAdminCoordSource('admin_verified');
      setNominatimSuggestions([]);
      setAdminFeedback(null);
      setIsAdminCoordModalOpen(true);
    },
    [
      isAdminUser,
      isMapManagerUser,
      selectedPlace,
      verifiedMapMarkers,
      unverifiedCatalogPlaces,
      populateAdminFormFromPlace,
      embeddedInAdmin,
      onAdminSelectPlace,
    ]
  );

  const openAdminCreatePlaceModal = useCallback(() => {
    if (!isAdminUser && !isMapManagerUser) {
      setLocationNotice('Chỉ Quản trị viên hoặc Quản lý Maps mới có quyền thêm địa điểm mới.');
      return;
    }
    triggerFeedback('tap');
    const center = mapInstanceRef.current?.getCenter();
    const lat = center ? Number(center.lat.toFixed(6)) : XUANHOA_DEFAULT_CENTER.lat;
    const lng = center ? Number(center.lng.toFixed(6)) : XUANHOA_DEFAULT_CENTER.lng;
    const draft = newPlaceDraftRef.current;
    setIsAdminCreatingNew(true);
    setAdminTargetPlace(null);
    setAdminHoursError(null);
    if (draft.hasDraft) {
      setAdminEditName(draft.name);
      setAdminEditCategory(draft.category);
      setAdminEditParentCategory(draft.parentCategory || 'public');
      setAdminEditSubcategory(draft.subcategory || 'government');
      setAdminEditShowByDefault(draft.showByDefault ?? true);
      setAdminEditAddress(draft.address);
      setAdminEditTagline(draft.tagline);
      setAdminEditPhone(draft.phone);
      setAdminEditHours(draft.hours);
      setAdminMapsUrlInput(draft.mapsUrl);
      setAdminLatInput(draft.lat || String(lat));
      setAdminLngInput(draft.lng || String(lng));
    } else {
      setAdminEditName('');
      setAdminEditCategory('public');
      setAdminEditParentCategory('public');
      setAdminEditSubcategory('government');
      setAdminEditShowByDefault(true);
      setAdminEditAddress('Phường Xuân Hòa');
      setAdminEditTagline('');
      setAdminEditPhone('');
      setAdminEditHours('07:30 - 17:30');
      setAdminMapsUrlInput('');
      setAdminLatInput(String(lat));
      setAdminLngInput(String(lng));
    }
    setAdminCoordSource('admin_verified');
    setNominatimSuggestions([]);
    setAdminFeedback('Nhập tên địa điểm / hàng quán mới, hoặc bấm "Chấm trên Bản đồ" để lấy tọa độ.');
    setIsAdminCoordModalOpen(true);
  }, [isAdminUser, isMapManagerUser]);

  const handleSuggestFromOsm = async () => {
    const query = `${adminMapsUrlInput.trim() || adminEditAddress.trim() || adminEditName.trim()}`;
    if (!query) return;

    triggerFeedback('tap');
    const parsed = parseCoordinatesFromInputOrUrl(query);
    if (parsed) {
      setAdminLatInput(String(parsed.lat));
      setAdminLngInput(String(parsed.lng));
      flyToCoordinates(parsed.lat, parsed.lng, 16.8);
      setAdminFeedback(`Đã trích xuất tọa độ (${parsed.lat}, ${parsed.lng}) từ link / Plus Code!`);
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
          'Chưa tìm thấy tự động. Bạn có thể bấm "Chấm trên Bản đồ" để click đúng vị trí!'
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
    if (!isAdminUser && !isMapManagerUser) return;
    if (isSavingPlace) return;
    if (adminHoursError) {
      triggerFeedback('warn');
      setAdminFeedback(adminHoursError);
      return;
    }
    setIsSavingPlace(true);
    try {
      const lat = parseFloat(adminLatInput);
      const lng = parseFloat(adminLngInput);
      const subMeta = MAP_CATEGORY_REGISTRY[adminEditSubcategory];
      const resolvedLegacyCat = subMeta ? subMeta.legacyCategory : adminEditCategory;
      const isCoreCivic =
        adminEditParentCategory === 'landmark' ||
        adminEditParentCategory === 'public' ||
        adminEditParentCategory === 'education' ||
        adminEditParentCategory === 'health' ||
        Boolean(subMeta?.showByDefault);
      const effectiveShowByDefault = adminEditShowByDefault || isCoreCivic;

      const saved = saveLandmarkOrPlaceFromMap({
        id: isAdminCreatingNew ? undefined : adminTargetPlace?.id,
        name: adminEditName,
        category: resolvedLegacyCat,
        parentCategoryId: adminEditParentCategory,
        subcategoryId: adminEditSubcategory,
        showByDefault: effectiveShowByDefault,
        address: adminEditAddress,
        tagline: adminEditTagline || subMeta?.label || '',
        phone: adminEditPhone,
        openHours: adminEditHours,
        lat,
        lng,
        mapsUrl: adminMapsUrlInput,
      });
      triggerFeedback('approve');
      setShowCommercialShops(true);
      if (!effectiveShowByDefault) {
        setActiveQuickFilter(adminEditSubcategory);
      }
      setSelectedCategories((prev) =>
        prev.includes(resolvedLegacyCat) ? prev : [...prev, resolvedLegacyCat]
      );
      setSyncTick((t) => t + 1);
      // Optimistic + Immediate selection of the unified place.id across 2D, 3D, Search & Admin
      const freshSnapshot = getAllMapPlaceLocations();
      const freshPlace =
        freshSnapshot.verifiedMapMarkers.find((p) => p.id === saved.id) ||
        freshSnapshot.allLocations.find((p) => p.id === saved.id) ||
        null;
      if (freshPlace) {
        setSelectedPlace(freshPlace);
        setAdminTargetPlace(freshPlace);
      }
      if (embeddedInAdmin && onAdminSelectPlace) {
        onAdminSelectPlace(saved.id);
      }
      if (isAdminCreatingNew) {
        newPlaceDraftRef.current.hasDraft = false;
      }
      setIsAdminCreatingNew(false);
      setIsAdminCoordModalOpen(false);
      const nextNotice = !isAdminUser
        ? `⏳ Đã gửi đề xuất "${adminEditName.trim()}" chờ Admin phê duyệt! Bản đồ công khai giữ nguyên dữ liệu cũ cho tới khi được duyệt.`
        : isAdminCreatingNew
        ? `✅ Đã thêm mới "${adminEditName.trim()}" và đồng bộ máy chủ thành công!`
        : `✅ Đã cập nhật "${adminEditName.trim()}" và đồng bộ máy chủ thành công!`;
      setAdminFeedback(null);
      showTemporaryMapNotice(nextNotice, 2800);
      if (saved.lat !== null && saved.lng !== null) {
        flyToCoordinates(saved.lat, saved.lng, 16.6, adminEditName.trim(), 0.0042);
      }
    } catch (err: any) {
      triggerFeedback('warn');
      setAdminFeedback(err?.message || 'Lỗi lưu thông tin địa điểm.');
    } finally {
      setIsSavingPlace(false);
    }
  };

  const handleBlockAdminPlace = () => {
    if (!isAdminUser || !adminTargetPlace) return;
    triggerFeedback('warn');
    blockLandmarkOrPlaceFromMap(adminTargetPlace.id, adminEditName || adminTargetPlace.name);
    if (selectedPlace?.id === adminTargetPlace.id) {
      setSelectedPlace(null);
    }
    setSyncTick((t) => t + 1);
    setIsAdminCoordModalOpen(false);
    const msg = `Đã tạm khóa (Block) "${adminEditName || adminTargetPlace.name}" trên Bản đồ!`;
    showTemporaryMapNotice(msg, 2300);
  };

  const handleUnblockAdminPlace = () => {
    if (!isAdminUser || !adminTargetPlace) return;
    triggerFeedback('approve');
    unblockLandmarkOrPlaceFromMap(adminTargetPlace.id, adminEditName || adminTargetPlace.name);
    setSyncTick((t) => t + 1);
    const freshSnapshot = getAllMapPlaceLocations();
    const freshPlace =
      freshSnapshot.verifiedMapMarkers.find((p) => p.id === adminTargetPlace.id) ||
      freshSnapshot.allLocations.find((p) => p.id === adminTargetPlace.id) ||
      null;
    if (freshPlace) {
      setSelectedPlace(freshPlace);
      setAdminTargetPlace(freshPlace);
    }
    setIsAdminCoordModalOpen(false);
    const msg = `Đã mở khóa (Unblock) "${adminEditName || adminTargetPlace.name}" trên Bản đồ!`;
    showTemporaryMapNotice(msg, 2300);
  };

  const handleUnpinAdminPlace = () => {
    if (!isAdminUser || !adminTargetPlace) return;
    triggerFeedback('warn');
    unpinLandmarkOrPlaceFromMap(adminTargetPlace.id, adminEditName || adminTargetPlace.name);
    if (selectedPlace?.id === adminTargetPlace.id) {
      setSelectedPlace(null);
    }
    setSyncTick((t) => t + 1);
    setIsAdminCoordModalOpen(false);
    const msg = `Đã gỡ vị trí "${adminEditName || adminTargetPlace.name}" (chuyển về Chưa định vị)!`;
    showTemporaryMapNotice(msg, 2300);
  };

  const handleDeleteAdminPlace = () => {
    if (!isAdminUser || !adminTargetPlace) return;
    triggerFeedback('warn');
    const res = hideLandmarkOrPlaceFromMap(adminTargetPlace.id, adminEditName || adminTargetPlace.name);
    if (res.executedImmediately && selectedPlace?.id === adminTargetPlace.id) {
      setSelectedPlace(null);
    }
    setSyncTick((t) => t + 1);
    setIsAdminCoordModalOpen(false);
    showTemporaryMapNotice(
      res.executedImmediately
        ? `Đã xóa "${adminEditName || adminTargetPlace.name}" khỏi Bản đồ!`
        : `Đã gửi yêu cầu xóa "${adminEditName || adminTargetPlace.name}" chờ Admin duyệt!`,
      2300
    );
  };

  const handleRestoreAdminPlaceDefault = () => {
    if (!isAdminUser || !adminTargetPlace) return;
    triggerFeedback('tap');
    restoreLandmarkOrPlaceDefault(adminTargetPlace.id);
    setSyncTick((t) => t + 1);
    setIsAdminCoordModalOpen(false);
    const msg = `Đã khôi phục "${adminTargetPlace.name}" về mặc định!`;
    showTemporaryMapNotice(msg, 2300);
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
      className={
        embeddedInAdmin
          ? 'xuho-light-map-root relative w-full h-full overflow-hidden select-none rounded-xl'
          : 'xuho-light-map-root relative w-full h-[calc(100dvh-60px)] md:h-dvh overflow-hidden select-none'
      }
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
            embeddedInAdmin || isPickingOnMap || homeModalMode === 'picking'
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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 rounded-[8px] bg-[#059669] text-white border border-white text-[10.5px] leading-snug font-semibold whitespace-nowrap shadow-sm">
                Bạn đang ở đây
              </div>
              <span className="absolute w-10 h-10 rounded-full bg-[#059669]/25 animate-ping" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#059669] border-2 border-white shadow-md" />
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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-[8px] bg-white text-[#0F172A] border border-[#E2E8F0] text-[10.5px] leading-snug font-medium whitespace-nowrap shadow-sm">
                {userHome.label}
              </div>
              <div className="w-7 h-7 rounded-full bg-[#0F172A] text-white border-[1.5px] border-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Home size={14} strokeWidth={1.7} />
              </div>
            </button>
          </div>
        )}

        {/* Marker Ghim đề xuất đang chờ Admin phê duyệt (hiển thị song song với Ghim hiện tại) */}
        {activeProposedPin && (
          <div
            ref={(el) => {
              proposedPinMarkerElRef.current = el;
            }}
            data-testid="proposed-pin-marker"
            style={{
              transform: 'translate3d(-9999px, -9999px, 0)',
              zIndex: 55,
              willChange: 'transform',
            }}
            className="absolute top-0 left-0 pointer-events-auto"
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-0.5 rounded-[8px] bg-[#D97706] text-white border border-white text-[10.5px] leading-snug font-bold whitespace-nowrap shadow-md">
                Ghim đề xuất: {activeProposedPin.proposedLat.toFixed(5)}, {activeProposedPin.proposedLng.toFixed(5)}
              </div>
              <span className="absolute w-9 h-9 rounded-full bg-[#F59E0B]/35 animate-ping" />
              <div className="w-8 h-8 rounded-full bg-[#D97706] text-white border-2 border-dashed border-white flex items-center justify-center shadow-lg">
                <MapPin size={15} strokeWidth={2.2} />
              </div>
            </div>
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
                  className="-translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] border transition-transform shadow-sm"
                  style={{
                    backgroundColor: isSelected ? '#059669' : '#0F172A',
                    borderColor: '#FFFFFF',
                    color: '#FFFFFF',
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  <span className="text-[10px] font-semibold tracking-wide leading-snug">
                    DEMO LOT
                  </span>
                </div>
              </button>
            );
          })}

        {/* Marker Cụm POI (Monochrome / Brand-Accent Cluster — chỉ hiện số lượng, không emoji) */}
        {poiClusters2D.map((cl) => (
          <button
            key={cl.id}
            ref={(el) => {
              if (el) {
                clusterElsRef.current.set(cl.id, el);
              } else {
                clusterElsRef.current.delete(cl.id);
              }
            }}
            type="button"
            onClick={() => {
              triggerFeedback('tap');
              const targetZ = Math.max(currentZoom + 1.35, cl.targetZoom2D);
              flyToCoordinates(
                cl.lat,
                cl.lng,
                targetZ,
                `Cụm ${cl.count} địa điểm`,
                0.0036
              );
            }}
            style={{
              transform: 'translate3d(-9999px, -9999px, 0)',
              zIndex: 18,
              willChange: 'transform',
            }}
            title={`Cụm ${cl.count} địa điểm: ${cl.sampleNames.join(', ')} (Bấm để phóng to)`}
            aria-label={`Cụm ${cl.count} địa điểm`}
            className="absolute top-0 left-0 pointer-events-auto group cursor-pointer focus:outline-none"
          >
            <div className="-translate-x-1/2 -translate-y-1/2 min-w-[28px] h-7 px-2 rounded-full bg-white border-[1.5px] border-[#059669] text-[#0F172A] shadow-[0_3px_10px_rgba(15,23,42,0.12)] transition-transform group-hover:scale-105 text-[11.5px] font-semibold flex items-center justify-center whitespace-nowrap">
              <span>{cl.count}</span>
            </div>
          </button>
        ))}

        {/* Marker Địa điểm thực tế đã xác minh tọa độ (Professional Minimal Monochrome / Brand Accent) */}
        {filteredVerifiedMarkers.map((loc) => {
          const { subMeta } = getPlaceTaxonomyMeta(loc);
          const isCoreLandmark = isDefaultVisibleMapLandmark(loc);
          const isSelected =
            selectedPlace?.id === loc.id || (embeddedInAdmin && adminSelectedPlaceId === loc.id);
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
                zIndex: isSelected ? 45 : isHovered ? 35 : isCoreLandmark ? 26 : 20,
                willChange: 'transform',
              }}
              className="absolute top-0 left-0 pointer-events-auto"
            >
              <button
                type="button"
                data-place-id={loc.id}
                onMouseEnter={() => setHoveredPlaceId(loc.id)}
                onMouseLeave={() => setHoveredPlaceId(null)}
                onFocus={() => setHoveredPlaceId(loc.id)}
                onBlur={() => setHoveredPlaceId(null)}
                onClick={() => handleSelectVerifiedPlace(loc)}
                aria-label={`Địa điểm ${loc.name}`}
                className="group relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none cursor-pointer"
              >
                {/* Nhãn tên địa điểm đặt absolute phía trên icon */}
                <div
                  ref={(el) => {
                    if (el) {
                      markerLabelElsRef.current.set(loc.id, el);
                    } else {
                      markerLabelElsRef.current.delete(loc.id);
                    }
                  }}
                  style={{ display: isSelected || isHovered ? 'block' : 'none' }}
                  className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-[8px] border text-[11px] leading-snug font-medium whitespace-nowrap max-w-[168px] sm:max-w-[186px] truncate shadow-[0_2px_8px_rgba(15,23,42,0.08)] pointer-events-none ${
                    isSelected
                      ? 'bg-[#0F172A] border-[#0F172A] text-white font-semibold'
                      : 'bg-white/95 border-[#E2E8F0] text-[#0F172A]'
                  }`}
                >
                  {loc.name}
                </div>

                {/* Huy hiệu Icon Vector đồng bộ 100% Lucide Line */}
                <div
                  className={`relative rounded-full flex items-center justify-center transition-transform ${
                    isSelected
                      ? 'w-8 h-8 sm:w-[34px] sm:h-[34px] bg-[#059669] text-white border-2 border-white ring-3 ring-[#059669]/25 shadow-[0_6px_16px_rgba(5,150,105,0.28)] scale-105'
                      : isCoreLandmark
                      ? 'w-7 h-7 sm:w-[30px] sm:h-[30px] bg-[#059669] text-white border-[1.5px] border-white shadow-[0_3px_10px_rgba(15,23,42,0.16)] group-hover:scale-105'
                      : 'w-[27px] h-[27px] sm:w-[29px] sm:h-[29px] bg-white text-[#059669] border-[1.5px] border-[#059669] shadow-[0_2px_8px_rgba(15,23,42,0.12)] group-hover:scale-105'
                  }`}
                >
                  {renderRegistryIcon(
                    subMeta.iconName,
                    isSelected ? 17 : 15,
                    isSelected || isCoreLandmark ? 'text-white' : 'text-[#059669]'
                  )}
                  {isSavedMarker && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0F172A] border border-white" />
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. LỚP GIAO DIỆN ĐIỀU KHIỂN TRÊN CÙNG — MINIMAL CLEAN SEARCH BAR + QUICK CATEGORY BAR NGAY DƯỚI (TỐI ĐA ~88PX) */}
      <div className="absolute top-2 sm:top-2.5 left-2 sm:left-3 right-2 sm:right-3 z-30 flex flex-col gap-1.5 pointer-events-none">
        <div className="relative flex items-center gap-1.5 sm:gap-2 pointer-events-auto max-w-xl">
          {!embeddedInAdmin && (
            <button
              type="button"
              onClick={onBackToHome}
              aria-label="Quay lại trang chủ Xuân Hòa Có Gì"
              title="Quay lại trang chủ Xuân Hòa Có Gì"
              className="hidden md:flex px-3.5 h-10 sm:h-[42px] rounded-[14px] bg-white/95 border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] font-medium text-xs leading-snug items-center justify-center shadow-[0_4px_18px_rgba(15,23,42,0.06)] backdrop-blur-md shrink-0 cursor-pointer transition"
            >
              <span>Trang chủ</span>
            </button>
          )}

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
            onReviewRoad={handleReviewRoadFromSearch}
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
            pendingApprovalCount={pendingApprovalCount}
            activePresetId={activePresetId}
          />

          {/* Bảng Địa điểm đã lưu theo tài khoản */}
          {isSavedDropdown2DOpen && (
            <div className="absolute top-12 left-0 md:left-24 z-50 w-[280px] sm:w-[310px] rounded-[16px] bg-white border border-[#E2E8F0] shadow-[0_14px_34px_rgba(15,23,42,0.14)] p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#0F172A] flex items-center gap-1.5">
                    <Bookmark size={13} strokeWidth={1.75} className="text-[#059669]" />
                    <span>Địa điểm đã lưu ({savedPlaceObjects.length})</span>
                  </div>
                  <div className="text-[10.5px] font-medium text-[#64748B] truncate mt-0.5">
                    Tài khoản: {userAccountLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavedDropdown2DOpen(false)}
                  className="px-2 py-1 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] text-[11px] font-medium cursor-pointer shrink-0"
                >
                  Đóng
                </button>
              </div>

              {savedPlaceObjects.length === 0 ? (
                <div className="py-4 px-2 text-center text-[11.5px] text-[#64748B] space-y-1">
                  <div className="font-medium text-[#0F172A]">Chưa có địa điểm nào được lưu</div>
                  <div>
                    Bấm nút <strong className="text-[#059669]">Lưu</strong> trên thẻ thông tin địa điểm bất kỳ để lưu lại.
                  </div>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-[#F1F5F9] pr-0.5">
                  {savedPlaceObjects.map((item) => (
                    <div
                      key={item.id}
                      className="py-1.5 px-1.5 flex items-center justify-between gap-1.5 hover:bg-[#F8FAFC] rounded-[10px] transition"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsSavedDropdown2DOpen(false);
                          handleSelectVerifiedPlace(item);
                        }}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="text-[12px] font-medium text-[#0F172A] truncate">
                          {item.name}
                        </div>
                        <div className="text-[10.5px] text-[#64748B] truncate">
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
                          className="px-2 py-1 rounded-[8px] bg-[#059669] hover:bg-[#047857] text-white text-[10.5px] font-medium cursor-pointer"
                        >
                          Chỉ đường
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSavePlace(item)}
                          title="Bỏ lưu địa điểm này"
                          className="w-6 h-6 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] text-[12px] font-medium cursor-pointer flex items-center justify-center"
                        >
                          <X size={12} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thanh Danh Mục Nhanh (Quick Category Bar) — Đặt ngay dưới ô Search, 1 hàng cuộn ngang gọn gàng */}
        {!embeddedInAdmin && !isPickingOnMap && (
          <div className="w-full max-w-xl pointer-events-auto">
            <MapQuickCategoryBar
              activeFilterId={activeQuickFilter}
              onSelectFilter={(nextId) => {
                triggerFeedback('tap');
                setActiveQuickFilter(nextId);
              }}
              places={verifiedMapMarkers}
            />
          </div>
        )}

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

      {/* Cụm nút điều khiển nổi góc phải (3D/2D, GPS, La bàn, Lớp bản đồ, Về trung tâm) — trực thuộc container chính để luôn căn giữa chiều dọc */}
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

      {/* 3-BOTTOM. THANH DANH MỤC NHANH (QUICK CATEGORY BAR) + ĐIỀU KHIỂN ADMIN Ở ĐÁY BẢN ĐỒ */}
      {embeddedInAdmin && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-white/95 border border-[#E2E8F0] text-[#0F172A] shadow-sm text-[11px] font-medium whitespace-nowrap">
            Bấm trực tiếp lên điểm bất kỳ trên bản đồ để lấy tọa độ tự động
          </div>
        </div>
      )}

      {!embeddedInAdmin && !isPickingOnMap && (isMapManagerUser || isAdminUser) && (
        <div
          className="absolute left-3 right-3 z-30 flex items-center justify-center pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          {!selectedPlace && !selectedBuilding && (
            <div className="flex items-center justify-center gap-2 pointer-events-auto max-w-full">
              {(isAdminUser || isMapManagerUser) && (
                <button
                  type="button"
                  data-testid="mobile-manage-sheet-trigger"
                  onClick={() => {
                    triggerFeedback('tap');
                    setManageSheetView('menu');
                    setIsManageSheetOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0F172A]/95 hover:bg-[#1E293B] text-white border border-white/20 shadow-[0_6px_20px_rgba(15,23,42,0.22)] backdrop-blur-md text-[12px] font-semibold cursor-pointer transition active:scale-95 whitespace-nowrap"
                >
                  <Settings size={14} className="text-[#10B981] shrink-0" />
                  <span>Quản lý</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-[#059669] text-white text-[10px] font-bold">
                    {isAdminUser ? 'Admin' : 'QL Maps'}
                  </span>
                  {isAdminUser && pendingProposals.length > 0 && (
                    <span
                      data-testid="mobile-manage-pending-badge"
                      className="px-1.5 py-0.5 rounded-full bg-[#F59E0B] text-white text-[10px] font-extrabold"
                    >
                      {pendingProposals.length} chờ duyệt
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3-SHEET. BOTTOM SHEET QUẢN LÝ GỌN GÀNG CHO ADMIN & QUẢN LÝ TRÊN MOBILE/DESKTOP (PHẦN 7.2 & PHẦN 8) */}
      {isManageSheetOpen && (isAdminUser || isMapManagerUser) && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsManageSheetOpen(false)}
        >
          <div
            data-testid="mobile-manage-bottom-sheet"
            className="w-full sm:max-w-md max-h-[78dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white border border-[#CBD5E1] shadow-[0_20px_50px_rgba(15,23,42,0.22)] text-[#0F172A]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thanh kéo & Header Bottom Sheet */}
            <div className="pt-2.5 pb-2 px-4 border-b border-[#E2E8F0] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-md bg-[#ECFDF5] border border-[#10B981]/40 text-[#047857] text-[10.5px] font-bold">
                  {isAdminUser ? 'QUYỀN ADMIN' : 'QUYỀN QUẢN LÝ'}
                </span>
                <h3 className="text-[13.5px] font-bold text-[#0F172A] truncate">
                  {manageSheetView === 'approvals'
                    ? `Duyệt yêu cầu (${pendingProposals.length})`
                    : manageSheetView === 'my_proposals'
                    ? `Yêu cầu của tôi (${myProposals.length})`
                    : 'Công cụ Quản lý Bản đồ'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {manageSheetView !== 'menu' && (
                  <button
                    type="button"
                    onClick={() => setManageSheetView('menu')}
                    className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] text-[11px] font-semibold cursor-pointer"
                  >
                    ← Quay lại
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsManageSheetOpen(false)}
                  className="w-7 h-7 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] flex items-center justify-center cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Body của Bottom Sheet */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs">
              {manageSheetView === 'menu' && isAdminUser && (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    data-testid="map-bar-create-btn"
                    onClick={() => {
                      setIsManageSheetOpen(false);
                      openAdminCreatePlaceModal();
                    }}
                    className="w-full p-3 rounded-xl bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#10B981]/40 text-[#065F46] flex items-center justify-between gap-2 font-bold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <Plus size={16} className="text-[#059669]" />
                      <span>Thêm địa điểm</span>
                    </span>
                    <span className="text-[11px] font-medium text-[#047857]">Lưu trực tiếp →</span>
                  </button>

                  <button
                    type="button"
                    data-testid="map-bar-edit-btn"
                    onClick={() => {
                      setIsManageSheetOpen(false);
                      openAdminCoordinateModal(selectedPlace || undefined);
                    }}
                    className="w-full p-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] flex items-center justify-between gap-2 font-semibold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <Edit3 size={16} className="text-[#0F172A]" />
                      <span>Sửa địa điểm</span>
                    </span>
                    <span className="text-[11px] text-[#64748B] truncate max-w-[140px]">
                      {selectedPlace ? selectedPlace.name : 'Chọn quán / trụ sở'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="sheet-action-pin"
                    onClick={() => {
                      setIsManageSheetOpen(false);
                      openAdminCreatePlaceModal();
                      setIsAdminCoordModalOpen(false);
                      setIsPickingOnMap(true);
                    }}
                    className="w-full p-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] flex items-center justify-between gap-2 font-semibold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#059669]" />
                      <span>Ghim vị trí trực tiếp trên Bản đồ</span>
                    </span>
                    <span className="text-[11px] text-[#64748B]">Chạm bản đồ →</span>
                  </button>

                  <button
                    type="button"
                    data-testid="sheet-action-delete"
                    onClick={() => {
                      setIsManageSheetOpen(false);
                      openAdminCoordinateModal(selectedPlace || undefined);
                    }}
                    className="w-full p-3 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] flex items-center justify-between gap-2 font-semibold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 size={16} className="text-[#DC2626]" />
                      <span>Xóa / Gỡ vị trí địa điểm</span>
                    </span>
                    <span className="text-[11px] text-[#DC2626]">Chỉ Admin →</span>
                  </button>

                  <button
                    type="button"
                    data-testid="sheet-action-approvals"
                    onClick={() => setManageSheetView('approvals')}
                    className="w-full p-3 rounded-xl bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#F59E0B]/50 text-[#92400E] flex items-center justify-between gap-2 font-bold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[#D97706]" />
                      <span>Duyệt yêu cầu từ Quản lý</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#D97706] text-white text-[11px] font-extrabold">
                      {pendingProposals.length} chờ duyệt
                    </span>
                  </button>
                </div>
              )}

              {manageSheetView === 'menu' && isMapManagerUser && !isAdminUser && (
                <div className="grid grid-cols-1 gap-2">
                  <div className="p-2.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-[11px] font-medium">
                    Tài khoản <strong>Quản lý</strong> chỉ gửi đề xuất thêm/sửa/định vị. Mọi thay đổi sẽ có hiệu lực công khai sau khi <strong>Admin duyệt</strong>.
                  </div>

                  <button
                    type="button"
                    data-testid="map-bar-create-btn"
                    onClick={() => {
                      setIsManageSheetOpen(false);
                      openAdminCreatePlaceModal();
                    }}
                    className="w-full p-3 rounded-xl bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#10B981]/40 text-[#065F46] flex items-center justify-between gap-2 font-bold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <Plus size={16} className="text-[#059669]" />
                      <span>Đề xuất thêm địa điểm</span>
                    </span>
                    <span className="text-[11px] font-medium text-[#047857]">Chờ Admin duyệt →</span>
                  </button>

                  <button
                    type="button"
                    data-testid="map-bar-edit-btn"
                    onClick={() => {
                      setIsManageSheetOpen(false);
                      openAdminCoordinateModal(selectedPlace || undefined);
                    }}
                    className="w-full p-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] flex items-center justify-between gap-2 font-semibold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <Edit3 size={16} className="text-[#0F172A]" />
                      <span>Đề xuất sửa thông tin</span>
                    </span>
                    <span className="text-[11px] text-[#64748B] truncate max-w-[140px]">
                      {selectedPlace ? selectedPlace.name : 'Chọn địa điểm'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="sheet-action-propose-pin"
                    onClick={() => {
                      setIsManageSheetOpen(false);
                      openAdminCoordinateModal(selectedPlace || undefined);
                      setIsAdminCoordModalOpen(false);
                      setIsPickingOnMap(true);
                    }}
                    className="w-full p-3 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] flex items-center justify-between gap-2 font-semibold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#059669]" />
                      <span>Đề xuất định vị trên Bản đồ</span>
                    </span>
                    <span className="text-[11px] text-[#64748B]">Chạm bản đồ →</span>
                  </button>

                  <button
                    type="button"
                    data-testid="sheet-action-my-proposals"
                    onClick={() => setManageSheetView('my_proposals')}
                    className="w-full p-3 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#1E40AF] flex items-center justify-between gap-2 font-bold text-[12.5px] cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <Bell size={16} className="text-[#2563EB]" />
                      <span>Yêu cầu của tôi</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#2563EB] text-white text-[11px] font-bold">
                      {myProposals.length} yêu cầu
                    </span>
                  </button>
                </div>
              )}

              {manageSheetView === 'approvals' && isAdminUser && (
                <div className="space-y-2.5">
                  {pendingProposals.length === 0 ? (
                    <div className="py-6 text-center text-[#64748B]">
                      Hiện không có yêu cầu chờ duyệt nào từ Quản lý.
                    </div>
                  ) : (
                    pendingProposals.map((prop) => {
                      const hasCoordChange =
                        typeof prop.afterData?.lat === 'number' &&
                        typeof prop.afterData?.lng === 'number';
                      return (
                        <div
                          key={prop.id}
                          data-testid={`proposal-card-${prop.placeId}`}
                          className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] font-bold text-[10px] uppercase">
                                {prop.actionType === 'create'
                                  ? 'Đề xuất thêm mới'
                                  : prop.actionType === 'pin'
                                  ? 'Đề xuất định vị'
                                  : 'Đề xuất cập nhật'}
                              </span>
                              <div className="font-bold text-[13px] text-[#0F172A] mt-1">
                                {prop.placeName}
                              </div>
                              <div className="text-[10.5px] text-[#64748B]">
                                Gửi bởi: <strong>{prop.submittedByName}</strong> ({prop.submittedByEmail})
                              </div>
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-white border border-[#E2E8F0] text-[11px] space-y-1">
                            <div>
                              <span className="text-[#64748B]">Trước: </span>
                              <span className="font-mono text-[#475569]">
                                {typeof prop.beforeData?.lat === 'number' && typeof prop.beforeData?.lng === 'number'
                                  ? `${prop.beforeData.lat.toFixed(6)}, ${prop.beforeData.lng.toFixed(6)}`
                                  : 'Chưa có tọa độ'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#059669] font-bold">Đề xuất mới: </span>
                              <span className="font-mono font-bold text-[#0F172A]">
                                {hasCoordChange
                                  ? `${Number(prop.afterData.lat).toFixed(6)}, ${Number(prop.afterData.lng).toFixed(6)}`
                                  : prop.afterData?.name || prop.placeName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            {hasCoordChange && (
                              <button
                                type="button"
                                data-testid={`preview-proposal-map-${prop.placeId}`}
                                onClick={() => {
                                  const found =
                                    verifiedMapMarkers.find((m) => m.id === prop.placeId) ||
                                    unverifiedCatalogPlaces.find((m) => m.id === prop.placeId) ||
                                    null;
                                  if (found) setSelectedPlace(found);
                                  setIsManageSheetOpen(false);
                                  flyToCoordinates(
                                    Number(prop.afterData.lat),
                                    Number(prop.afterData.lng),
                                    17.0,
                                    `So sánh ghim: ${prop.placeName}`
                                  );
                                }}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] font-bold text-[11px] cursor-pointer"
                              >
                                Xem Ghim cũ & mới
                              </button>
                            )}
                            <button
                              type="button"
                              data-testid={`approve-proposal-btn-${prop.placeId}`}
                              onClick={() => {
                                const res = approvePlaceProposal(prop.id);
                                setSyncTick((t) => t + 1);
                                showTemporaryMapNotice(res.message || 'Đã duyệt đề xuất', 2800);
                              }}
                              className="py-1.5 px-3 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-[11px] cursor-pointer"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              data-testid={`reject-proposal-btn-${prop.placeId}`}
                              onClick={() => {
                                const res = rejectPlaceProposal(prop.id, 'Admin từ chối yêu cầu');
                                setSyncTick((t) => t + 1);
                                showTemporaryMapNotice(res.message || 'Đã từ chối đề xuất', 2800);
                              }}
                              className="py-1.5 px-3 rounded-lg bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] font-bold text-[11px] cursor-pointer"
                            >
                              Từ chối
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {manageSheetView === 'my_proposals' && (
                <div className="space-y-2">
                  {myProposals.length === 0 ? (
                    <div className="py-6 text-center text-[#64748B]">
                      Bạn chưa gửi đề xuất thay đổi nào.
                    </div>
                  ) : (
                    myProposals.map((prop) => (
                      <div
                        key={prop.id}
                        className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[12.5px] text-[#0F172A] truncate">
                            {prop.placeName}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {prop.actionType === 'create'
                              ? 'Đề xuất thêm mới'
                              : prop.actionType === 'pin'
                              ? 'Đề xuất định vị'
                              : 'Đề xuất sửa'}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 ${
                            prop.status === 'approved'
                              ? 'bg-[#ECFDF5] text-[#047857]'
                              : prop.status === 'rejected'
                              ? 'bg-[#FEF2F2] text-[#DC2626]'
                              : 'bg-[#FEF3C7] text-[#92400E]'
                          }`}
                        >
                          {prop.status === 'approved'
                            ? 'Đã duyệt'
                            : prop.status === 'rejected'
                            ? 'Từ chối'
                            : 'Chờ duyệt'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3B-PICK. THANH HƯỚNG DẪN + XÁC NHẬN KHI ADMIN ĐANG CHẤM TRỰC TIẾP TỌA ĐỘ TRÊN BẢN ĐỒ 2D (Phần 17) */}
      {isPickingOnMap && (isAdminUser || isMapManagerUser) && (
        <>
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-[#0F172A]/95 px-4 py-1.5 text-xs font-bold text-white shadow-xl border border-emerald-400/60 backdrop-blur-md whitespace-nowrap pointer-events-none">
            <Crosshair size={14} className="text-emerald-400 shrink-0" />
            <span>Chạm vị trí muốn đặt địa danh</span>
          </div>
          <div className="absolute left-3 right-3 bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-md z-40 pointer-events-auto">
            <div className="p-2.5 rounded-2xl bg-[#0F172A]/95 text-white border border-emerald-400/50 shadow-2xl flex items-center justify-between gap-2 backdrop-blur-md">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold text-emerald-300 truncate">
                  {adminEditName || 'Vị trí đang chấm trên 2D'}
                </div>
                <div className="font-mono text-xs font-bold text-white truncate">
                  {adminLatInput && adminLngInput
                    ? `${adminLatInput}, ${adminLngInput}`
                    : 'Chạm lên bản đồ để chọn'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="pick-2d-cancel-btn"
                  onClick={() => {
                    triggerFeedback('tap');
                    if (pick2DSnapshotRef.current) {
                      setAdminLatInput(pick2DSnapshotRef.current.lat);
                      setAdminLngInput(pick2DSnapshotRef.current.lng);
                    }
                    setIsPickingOnMap(false);
                    setIsAdminCoordModalOpen(true);
                  }}
                  className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs whitespace-nowrap cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  data-testid="pick-2d-confirm-btn"
                  onClick={() => {
                    triggerFeedback('approve');
                    setIsPickingOnMap(false);
                    setIsAdminCoordModalOpen(true);
                  }}
                  className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 size={13} />
                  <span>Dùng vị trí này</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 4. POPUP THÔNG TIN ĐỊA ĐIỂM HOẶC THANH DIRECT EDIT Ở ĐÁY BẢN ĐỒ */}
      <div
        className={`absolute left-2.5 ${
          adminLandmarkMode2D ? 'right-2.5' : 'right-12'
        } sm:left-3 sm:right-14 bottom-2.5 md:bottom-3.5 z-30 pointer-events-none flex flex-col items-start gap-2`}
      >
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

        {selectedPlace && !isPickingOnMap && !embeddedInAdmin && !isCity3DOpen && (
          adminLandmarkMode2D && isAdminUser ? (
            <div className="pointer-events-auto w-full max-w-xl">
              <LandmarkAdminControls
                variant="floating_toolbar"
                place={selectedPlace}
                mapMode="2d"
                activeMode={adminLandmarkMode2D}
                onChangeActiveMode={(m) => {
                  setAdminLandmarkMode2D(m);
                  if (m !== 'mode_a_place') setPendingMoveCoords2D(null);
                  if (m !== 'mode_b_model') setPreviewBindingPatch2D(null);
                }}
                pendingPlaceLatLng={pendingMoveCoords2D}
                onChangePendingPlaceLatLng={setPendingMoveCoords2D}
                previewBindingPatch={previewBindingPatch2D}
                onChangePreviewBindingPatch={setPreviewBindingPatch2D}
                masterDataset={geoLayersRef.current?.masterDataset || getLoadedMasterDataset()}
                adminIdentifier={authUser?.email || authUser?.nickname || 'admin'}
                onSaved={(msg, newCoords) => {
                  setSyncTick((t) => t + 1);
                  showTemporaryMapNotice(msg, 3200);
                  if (newCoords) {
                    flyToCoordinates(newCoords.lat, newCoords.lng, Math.max(currentZoom, 16.5), selectedPlace.name);
                  }
                }}
              />
            </div>
          ) : (
            <div className="pointer-events-auto w-full max-w-md space-y-2 max-h-[78dvh] overflow-y-auto pr-0.5">
              <MapPlacePopup
                place={selectedPlace}
                onClose={() => setSelectedPlace(null)}
                onOpenFullPlaceModal={(loc) => {
                  if (loc.originalPlace) {
                    setModalPlace(loc.originalPlace);
                  } else {
                    const taxMeta = getPlaceTaxonomyMeta(loc);
                    setModalPlace({
                      id: loc.id,
                      name: loc.name,
                      tagline: loc.metadata?.subType || taxMeta.subMeta.label,
                      category: 'restaurant',
                      zone: 'center',
                      distance: loc.metadata?.distance || 'Trung tâm Xuân Hòa',
                      address: loc.address || 'Phường Xuân Hòa, Tỉnh Phú Thọ',
                      priceRange: taxMeta.subMeta.label,
                      minPrice: 0,
                      maxPrice: 0,
                      rating: 5,
                      reviewCount: 0,
                      imageUrl: '',
                      signatureDish: {
                        id: `${loc.id}_sig`,
                        name: taxMeta.subMeta.label,
                        price: 0,
                      },
                      menu: [],
                      tags: [taxMeta.subMeta.label, ...(loc.extraTags || [])],
                      mapsQuery: `${loc.name} Xuân Hòa`,
                      lat: loc.lat,
                      lng: loc.lng,
                      subcategory: taxMeta.subMeta.label,
                      parentCategoryId: taxMeta.parentMeta.id,
                      subcategoryId: taxMeta.subMeta.id,
                      extraTags: loc.extraTags || [],
                      contentProfile: loc.contentProfile,
                      catalogMode: loc.catalogMode,
                      catalogEnabled: loc.catalogEnabled ?? false,
                      phone: loc.phone || '',
                      openHours: loc.openHours || '',
                      rarity: 3,
                      quip: `${taxMeta.subMeta.label} trên Bản đồ số Xuân Hòa.`,
                    });
                  }
                }}
                isAdminUser={isAdminUser || isMapManagerUser}
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
                isSaved={savedPlaceIds.includes(selectedPlace.id)}
                onToggleSave={handleToggleSavePlace}
              />

              {isAdminUser && (
                <LandmarkAdminControls
                  variant="card_buttons"
                  place={selectedPlace}
                  mapMode="2d"
                  activeMode={adminLandmarkMode2D}
                  onChangeActiveMode={(m) => {
                    setAdminLandmarkMode2D(m);
                    if (m !== 'mode_a_place') setPendingMoveCoords2D(null);
                    if (m !== 'mode_b_model') setPreviewBindingPatch2D(null);
                  }}
                  onRequestOpen3DDirectEdit={() => {
                    setAdminLandmarkMode2D('mode_b_model');
                    setIsCity3DOpen(true);
                  }}
                  pendingPlaceLatLng={pendingMoveCoords2D}
                  onChangePendingPlaceLatLng={setPendingMoveCoords2D}
                  previewBindingPatch={previewBindingPatch2D}
                  onChangePreviewBindingPatch={setPreviewBindingPatch2D}
                  masterDataset={geoLayersRef.current?.masterDataset || getLoadedMasterDataset()}
                  adminIdentifier={authUser?.email || authUser?.nickname || 'admin'}
                  onSaved={(msg, newCoords) => {
                    setSyncTick((t) => t + 1);
                    showTemporaryMapNotice(msg, 3200);
                    if (newCoords) {
                      flyToCoordinates(newCoords.lat, newCoords.lng, Math.max(currentZoom, 16.5), selectedPlace.name);
                    }
                  }}
                />
              )}
            </div>
          )
        )}

        {selectedBuilding && !selectedPlace && !isPickingOnMap && !embeddedInAdmin && (
          <div className="pointer-events-auto w-full bg-[#FFFDF9]/96 backdrop-blur-md rounded-2xl border border-[#D4C7A9] shadow-[0_14px_34px_rgba(30,22,51,0.16)] p-3.5 text-xs text-[#2B213F]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] text-[10px] font-extrabold mb-1">
                  <span>🏢 Master Building #{selectedBuilding.id}</span>
                  <span>•</span>
                  <span>{selectedBuilding.source}</span>
                </div>
                <div className="font-extrabold text-[13px] text-[#1E1633] truncate">
                  {selectedBuilding.name || `Công trình ${selectedBuilding.buildingType || 'dân dụng'}`}
                </div>
                <div className="text-[11px] text-[#5C4D7D] mt-0.5">
                  Vùng ngữ cảnh:{' '}
                  <strong className="text-[#1E1633]">
                    {CONTEXTUAL_ZONE_LABELS[selectedBuilding.zone] || selectedBuilding.zone}
                  </strong>{' '}
                  <span className="text-[10px] text-[#7D6E9B]">(derivedZone)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBuilding(null);
                  selectedBuildingRef.current = null;
                  scheduleCanvasRender();
                }}
                className="w-6 h-6 rounded-full bg-[#F3EFE6] hover:bg-[#E5DEC9] text-[#403064] font-bold flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Đóng thẻ công trình"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-[#ECE4D4] text-[10.5px]">
              <div className="bg-[#F8F5EE] rounded-lg px-2 py-1.5">
                <div className="text-[#7D6E9B]">Chiều cao / Tầng</div>
                <div className="font-extrabold text-[#1E1633]">
                  {selectedBuilding.height.toFixed(1)}m • {selectedBuilding.levels} tầng
                </div>
              </div>
              <div className="bg-[#F8F5EE] rounded-lg px-2 py-1.5">
                <div className="text-[#7D6E9B]">Nguồn chiều cao</div>
                <div className="font-extrabold text-[#1E1633]">
                  {selectedBuilding.heightSource} ({Math.round(selectedBuilding.confidence * 100)}%)
                </div>
              </div>
              <div className="bg-[#F8F5EE] rounded-lg px-2 py-1.5">
                <div className="text-[#7D6E9B]">Độ cao nền DEM</div>
                <div className="font-extrabold text-[#059669]">
                  +{getElevationAtLngLat(selectedBuilding.centroidLngLat[0], selectedBuilding.centroidLngLat[1]).toFixed(1)}m
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#6B5B8E] truncate">
                Diện tích đáy: {Math.round(selectedBuilding.areaSqm)} m² • Tọa độ: {selectedBuilding.centroidLngLat[1].toFixed(5)}, {selectedBuilding.centroidLngLat[0].toFixed(5)}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.jumpTo({
                      center: [selectedBuilding.centroidLngLat[0], selectedBuilding.centroidLngLat[1]],
                      zoom: Math.max(currentZoom, 17.2),
                    });
                  }
                  setIsCity3DOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-[11px] shrink-0 cursor-pointer shadow-xs"
              >
                Xem đồng bộ 3D →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. THÔNG BÁO GỌN GÀNG KHI ĐANG VÀO BẢN ĐỒ SỐ PHƯỜNG XUÂN HÒA */}
      {!embeddedInAdmin && (isMapLoading || showWelcomeBanner) && (
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

      {/* 5B. GIAO DIỆN CHẾ ĐỘ BẢO TRÌ / DÀNH CHO QUẢN LÝ & ADMIN */}
      {(!mapAccessStatus.canAccess || previewGuestLock) && (
        <div className="absolute inset-0 z-40 bg-[#F8F5EE]/70 backdrop-blur-[3px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-[380px] rounded-3xl bg-[#FFFDF9] border border-[#CBD5E1] shadow-[0_20px_50px_rgba(15,23,42,0.12)] p-5 sm:p-6 text-[#1E293B] my-auto space-y-4">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F7EF] border border-[#39B980]/40 text-[#047857] text-[11px] font-extrabold tracking-wide">
                <Sparkles size={12} />
                <span>BẢN ĐỒ SỐ • ĐANG ĐỒNG BỘ</span>
              </div>

              <h2 className="text-lg font-extrabold text-[#0F172A] tracking-tight">
                Đang đồng bộ dữ liệu Bản đồ số
              </h2>
              <p className="text-xs text-[#475569] leading-relaxed">
                Tính năng Bản đồ số đang trong chế độ rà soát dành cho <strong className="text-[#0F172A]">Quản lý</strong> và <strong className="text-[#0F172A]">Quản trị viên (Admin)</strong>. Vui lòng đăng nhập tài khoản được phân quyền hoặc quay lại sau.
              </p>
            </div>

            {onOpenLogin && !authUser?.isLoggedIn && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('tap');
                    onOpenLogin();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] active:scale-[0.99] transition-all text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <LogIn size={15} />
                  <span>Đăng nhập Quản lý / Admin</span>
                </button>
              </div>
            )}

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

      {/* 8. MODAL CHỈNH SỬA ĐỊA DANH & VỊ TRÍ — COMPACT, SCROLLABLE BODY, STICKY ACTION FOOTER */}
      {isAdminCoordModalOpen && (isAdminUser || isMapManagerUser) && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/35 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <form
            onSubmit={handleSaveAdminCoordinates}
            className="w-full sm:max-w-lg max-h-[65dvh] sm:max-h-[82dvh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white border border-[#CBD5E1] shadow-[0_20px_50px_rgba(15,23,42,0.18)] text-[#0F172A] text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header cố định */}
            <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold text-[#64748B] uppercase tracking-wider">
                  {isAdminCreatingNew ? 'Thêm địa danh mới' : 'Chỉnh sửa địa danh & vị trí'}
                </div>
                <h2 className="text-[14px] font-bold text-[#0F172A] truncate leading-snug">
                  {isAdminCreatingNew
                    ? 'Cắm địa điểm mới lên Bản đồ'
                    : adminEditName || 'Cập nhật địa danh & tọa độ'}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('tap');
                    setIsAdminCreatingNew(false);
                    const fallback =
                      adminTargetPlace ||
                      selectedPlace ||
                      verifiedMapMarkers[0] ||
                      unverifiedCatalogPlaces[0] ||
                      null;
                    populateAdminFormFromPlace(fallback);
                    setAdminFeedback(null);
                  }}
                  className={`h-7 px-2.5 rounded-[8px] font-semibold text-[11px] border transition cursor-pointer ${
                    !isAdminCreatingNew
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                >
                  Sửa hiện có
                </button>
                <button
                  type="button"
                  onClick={() => openAdminCreatePlaceModal()}
                  className={`h-7 px-2.5 rounded-[8px] font-semibold text-[11px] border transition cursor-pointer ${
                    isAdminCreatingNew
                      ? 'bg-[#059669] text-white border-[#059669]'
                      : 'bg-[#F8FAFC] text-[#059669] border-[#E2E8F0] hover:bg-[#ECFDF5]'
                  }`}
                >
                  + Thêm mới
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('tap');
                    setIsAdminCoordModalOpen(false);
                  }}
                  className="w-7 h-7 rounded-[8px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] flex items-center justify-center cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Nội dung form scroll độc lập */}
            <div className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2">
              {!isAdminCreatingNew && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1 truncate">
                    Chọn địa danh / trụ sở / quán
                  </label>
                  <select
                    data-testid="admin-place-select"
                    value={adminTargetPlace?.id || ''}
                    onChange={(e) => {
                      triggerFeedback('tap');
                      const allCatalog = [
                        ...verifiedMapMarkers,
                        ...unverifiedCatalogPlaces,
                        ...(isAdminUser ? blockedAdminPlaces : []),
                      ];
                      const found = allCatalog.find((p) => p.id === e.target.value) || null;
                      populateAdminFormFromPlace(found);
                      if (embeddedInAdmin && onAdminSelectPlace && found) {
                        onAdminSelectPlace(found.id);
                      }
                      if (found && found.lat !== null && found.lng !== null) {
                        flyToCoordinates(found.lat, found.lng, 16.5, found.name, 0.0042);
                      }
                      setNominatimSuggestions([]);
                      setAdminFeedback(
                        found ? `Đang chọn: "${found.name}"` : null
                      );
                    }}
                    className="w-full h-9 px-2.5 rounded-[9px] bg-[#F8FAFC] border border-[#CBD5E1] font-semibold text-[#0F172A] text-xs focus:outline-none focus:border-[#059669]"
                  >
                    <optgroup label={`Đang hiển thị trên Bản đồ (${verifiedMapMarkers.length})`}>
                      {verifiedMapMarkers.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.dataSource === 'openstreetmap' ? 'Địa danh' : 'Quán'}] {p.name} ({p.lat}, {p.lng})
                        </option>
                      ))}
                    </optgroup>
                    {unverifiedCatalogPlaces.length > 0 && (
                      <optgroup label={`Chưa định vị / Chờ xác minh (${unverifiedCatalogPlaces.length})`}>
                        {unverifiedCatalogPlaces.map((p) => (
                          <option key={p.id} value={p.id}>
                            [Chưa định vị] {p.name} — {p.address}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {isAdminUser && blockedAdminPlaces.length > 0 && (
                      <optgroup label={`Đang tạm khóa / Block (${blockedAdminPlaces.length})`}>
                        {blockedAdminPlaces.map((p) => (
                          <option key={p.id} value={p.id}>
                            [Đã Block] {p.name} — {p.address}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1 truncate">
                  Tên địa danh / Cơ quan / Quán *
                </label>
                <input
                  type="text"
                  required
                  value={adminEditName}
                  onChange={(e) => setAdminEditName(e.target.value)}
                  placeholder="VD: Trụ sở Công an Phường Xuân Hòa..."
                  className="w-full h-9 px-2.5 rounded-[9px] bg-white border border-[#CBD5E1] font-semibold text-[#0F172A] text-xs focus:outline-none focus:border-[#059669]"
                />
              </div>

              {/* 2 CỘT: Loại & Biểu tượng | Số điện thoại */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1 truncate">
                    Loại & Biểu tượng
                  </label>
                  <select
                    data-testid="admin-subcategory-select"
                    value={adminEditSubcategory}
                    onChange={(e) => {
                      const nextSub = e.target.value as MapSubcategoryId;
                      setAdminEditSubcategory(nextSub);
                      const meta = MAP_CATEGORY_REGISTRY[nextSub];
                      if (meta) {
                        setAdminEditParentCategory(meta.parentId);
                        setAdminEditCategory(meta.legacyCategory);
                        setAdminEditShowByDefault(meta.showByDefault);
                      }
                    }}
                    className="w-full h-9 px-2 rounded-[9px] bg-white border border-[#CBD5E1] font-semibold text-[#0F172A] text-xs focus:outline-none focus:border-[#059669]"
                  >
                    {MAP_PARENT_CATEGORIES.map((par) => (
                      <optgroup key={par.id} label={par.label}>
                        {(MAP_SUBCATEGORIES_BY_PARENT[par.id] || []).map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1 truncate">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={adminEditPhone}
                    onChange={(e) => setAdminEditPhone(e.target.value)}
                    placeholder="Để trống nếu chưa xác minh"
                    className="w-full h-9 px-2.5 rounded-[9px] bg-white border border-[#CBD5E1] font-medium text-[#0F172A] text-xs focus:outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              {/* Tìm nhanh danh mục + Hiện mặc định gọn trên 1 hàng */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={adminCategorySearch}
                    onChange={(e) => setAdminCategorySearch(e.target.value)}
                    placeholder="Tìm nhanh loại hình: xăng, bi-a, cafe, thuốc..."
                    className="w-full h-8 px-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#0F172A] focus:outline-none focus:border-[#059669]"
                  />
                  {adminCategorySearch.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-32 overflow-y-auto rounded-[8px] bg-white border border-[#CBD5E1] shadow-lg divide-y divide-[#F1F5F9]">
                      {searchSubcategoriesByQuery(adminCategorySearch).map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setAdminEditParentCategory(sub.parentId);
                            setAdminEditSubcategory(sub.id);
                            setAdminEditCategory(sub.legacyCategory);
                            setAdminEditShowByDefault(sub.showByDefault);
                            setAdminCategorySearch('');
                          }}
                          className="w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-[#ECFDF5] flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F172A]">
                            {renderRegistryIcon(sub.iconName, { size: 13, className: 'text-[#059669]' })}
                            <span>{sub.label}</span>
                          </span>
                          <span className="text-[10px] text-[#64748B]">
                            {MAP_PARENT_CATEGORY_BY_ID[sub.parentId]?.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none h-8 px-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] shrink-0">
                  <input
                    type="checkbox"
                    checked={adminEditShowByDefault}
                    onChange={(e) => setAdminEditShowByDefault(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#059669] rounded cursor-pointer"
                  />
                  <span className="text-[11px] font-medium text-[#334155]">Hiện mặc định</span>
                </label>
              </div>

              {/* Địa chỉ hiển thị */}
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1 truncate">
                  Địa chỉ hiển thị
                </label>
                <input
                  type="text"
                  value={adminEditAddress}
                  onChange={(e) => setAdminEditAddress(e.target.value)}
                  placeholder="Số nhà, đường, khu vực..."
                  className="w-full h-9 px-2.5 rounded-[9px] bg-white border border-[#CBD5E1] font-medium text-[#0F172A] text-xs focus:outline-none focus:border-[#059669]"
                />
              </div>

              {/* GIỜ MỞ CỬA NHẬP NHANH BẰNG BÀN PHÍM + LỊCH 7 NGÀY */}
              <FastOpeningHoursInput
                value={adminEditHours}
                onChange={setAdminEditHours}
                onValidationChange={(_, err) => setAdminHoursError(err)}
              />

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1 truncate">
                  Mô tả chức năng / Ghi chú hiển thị
                </label>
                <input
                  type="text"
                  value={adminEditTagline}
                  onChange={(e) => setAdminEditTagline(e.target.value)}
                  placeholder="VD: Trụ sở làm việc mới / Điểm tiếp dân..."
                  className="w-full h-9 px-2.5 rounded-[9px] bg-white border border-[#CBD5E1] font-medium text-[#0F172A] text-xs focus:outline-none focus:border-[#059669]"
                />
              </div>

              {/* KHUNG ĐỊNH VỊ GỌN (Phần 16–18: Ưu tiên Chấm trên 2D / Chấm trên 3D) */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="font-semibold text-[#334155] text-[11px] truncate">
                    Định vị ({adminLatInput && adminLngInput ? `${Number(adminLatInput).toFixed(4)}, ${Number(adminLngInput).toFixed(4)}` : 'Chưa chấm'})
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleSuggestFromOsm}
                      disabled={isGeocoding}
                      className="h-7 px-2 rounded-[8px] bg-white hover:bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1] font-semibold flex items-center gap-1 cursor-pointer text-[11px] whitespace-nowrap"
                    >
                      {isGeocoding && <Loader2 size={11} className="animate-spin" />}
                      <span>Tìm</span>
                    </button>
                    <button
                      type="button"
                      data-testid="btn-pick-on-2d"
                      onClick={() => {
                        triggerFeedback('pin');
                        pick2DSnapshotRef.current = { lat: adminLatInput, lng: adminLngInput };
                        setIsAdminCoordModalOpen(false);
                        setIsPickingOnMap(true);
                      }}
                      className="h-7 px-2.5 rounded-[8px] bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold flex items-center gap-1 cursor-pointer text-[11px] whitespace-nowrap"
                    >
                      <span>Chấm trên 2D</span>
                    </button>
                    <button
                      type="button"
                      data-testid="btn-pick-on-3d-from-2d"
                      onClick={() => {
                        triggerFeedback('tap');
                        setIsAdminCoordModalOpen(false);
                        setIsCity3DOpen(true);
                      }}
                      className="h-7 px-2 rounded-[8px] bg-white hover:bg-slate-100 text-[#0F172A] border border-[#CBD5E1] font-semibold flex items-center gap-1 cursor-pointer text-[11px] whitespace-nowrap"
                    >
                      <span>Chấm trên 3D</span>
                    </button>
                  </div>
                </div>

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
                      setAdminFeedback(
                        `Đã nhận diện tọa độ (${parsed.lat}, ${parsed.lng}) từ đường dẫn.`
                      );
                    }
                  }}
                  placeholder="Dán Link Google Maps, mã 7PQ6+VFP hoặc tọa độ 21.289, 105.711..."
                  className="w-full h-9 px-2.5 rounded-[9px] bg-white border border-[#CBD5E1] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#059669]"
                />

                {/* Nút mở rộng nhập tọa độ thủ công (Nâng cao — Phần 18) */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedCoords2D((v) => !v)}
                    className="text-[10.5px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    {showAdvancedCoords2D ? 'Ẩn tọa độ số (Lat/Lng)' : 'Nhập tọa độ số thủ công (Nâng cao)'}
                  </button>
                </div>

                {/* 2 CỘT: Vĩ độ | Kinh độ (mặc định thu gọn, vẫn giữ trong DOM) */}
                <div className={showAdvancedCoords2D ? 'grid grid-cols-2 gap-2' : 'sr-only'}>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1 truncate">
                      Vĩ độ (Lat)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="21.289713"
                      value={adminLatInput}
                      onChange={(e) => setAdminLatInput(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-[9px] bg-white border border-[#CBD5E1] font-mono font-semibold text-xs text-[#0F172A] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1 truncate">
                      Kinh độ (Lng)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="105.711203"
                      value={adminLngInput}
                      onChange={(e) => setAdminLngInput(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-[9px] bg-white border border-[#CBD5E1] font-mono font-semibold text-xs text-[#0F172A] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                </div>
              </div>

              {nominatimSuggestions.length > 0 && (
                <div className="p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 max-h-28 overflow-y-auto">
                  {nominatimSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        triggerFeedback('pin');
                        setAdminLatInput(String(sug.lat));
                        setAdminLngInput(String(sug.lng));
                        setAdminCoordSource('nominatim_geocoded');
                        flyToCoordinates(sug.lat, sug.lng, 16.5);
                        setAdminFeedback(`Đã điền tọa độ gợi ý: ${sug.lat}, ${sug.lng}`);
                      }}
                      className="w-full text-left px-2 py-1 rounded-[8px] bg-white hover:bg-[#ECFDF5] border border-[#E2E8F0] text-[11px] cursor-pointer"
                    >
                      <div className="font-semibold text-[#0F172A] truncate">{sug.displayName}</div>
                      <div className="font-mono text-[10px] text-[#059669]">
                        {sug.lat}, {sug.lng}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {adminFeedback && (
                <div className="px-3 py-1.5 rounded-[9px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] font-semibold text-[11.5px]">
                  {adminFeedback}
                </div>
              )}
            </div>

            {/* FOOTER ACTION CỐ ĐỊNH — TRÁI: [Gỡ vị trí] [Block/Mở khóa] [Xóa] [Khôi phục] (CHỈ ADMIN) | PHẢI: [Đóng] [Lưu cập nhật] */}
            <div className="shrink-0 h-[46px] px-3 sm:px-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {isAdminUser && (
                  !isAdminCreatingNew && adminTargetPlace ? (
                    <>
                      {adminTargetPlace.lat !== null && adminTargetPlace.lng !== null && (
                        <button
                          type="button"
                          data-testid="admin-unpin-btn"
                          onClick={handleUnpinAdminPlace}
                          className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] font-semibold text-[11px] sm:text-[11.5px] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                          title="Gỡ vị trí trên bản đồ (giữ lại địa điểm ở trạng thái Chưa định vị)"
                        >
                          Gỡ vị trí
                        </button>
                      )}
                      {adminTargetPlace.visibilityStatus === 'hidden' || adminTargetPlace.visibilityStatus === 'blocked' ? (
                        <button
                          type="button"
                          data-testid="admin-unblock-btn"
                          onClick={handleUnblockAdminPlace}
                          className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#ECFDF5] text-[#047857] border border-[#059669]/60 font-semibold text-[11px] sm:text-[11.5px] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                          title="Mở khóa (Unblock) địa điểm này"
                        >
                          Mở khóa
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid="admin-block-btn"
                          onClick={handleBlockAdminPlace}
                          className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B]/60 font-semibold text-[11px] sm:text-[11.5px] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                          title="Block (Tạm khóa) địa điểm này"
                        >
                          Block
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="admin-delete-btn"
                        onClick={handleDeleteAdminPlace}
                        className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] font-semibold text-[11px] sm:text-[11.5px] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                        title="Xóa địa điểm khỏi Bản đồ"
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        data-testid="admin-restore-btn"
                        onClick={handleRestoreAdminPlaceDefault}
                        className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] font-semibold text-[11px] sm:text-[11.5px] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                        title="Khôi phục dữ liệu gốc"
                      >
                        Khôi phục
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      data-testid="admin-restore-btn"
                      onClick={() => {
                        triggerFeedback('tap');
                        resetNewPlaceDraft();
                        setAdminFeedback('Đã làm mới các ô nhập thông tin.');
                      }}
                      className="h-[35px] px-2 sm:px-2.5 rounded-[9px] bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] font-semibold text-[11px] sm:text-[11.5px] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                    >
                      Khôi phục
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerFeedback('tap');
                    setIsAdminCoordModalOpen(false);
                  }}
                  className="h-[35px] px-2.5 sm:px-3 rounded-[9px] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] border border-[#CBD5E1] font-semibold text-[11px] sm:text-[11.5px] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  data-testid="admin-save-place-btn"
                  disabled={isSavingPlace}
                  className="h-[35px] px-2.5 sm:px-3.5 rounded-[9px] bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white font-semibold text-[11px] sm:text-[11.5px] whitespace-nowrap flex items-center justify-center cursor-pointer transition"
                >
                  {isSavingPlace
                    ? 'Đang lưu...'
                    : !isAdminUser
                    ? 'Gửi yêu cầu duyệt'
                    : isAdminCreatingNew
                    ? 'Tạo địa điểm'
                    : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </form>
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

      {/* 9B. HỘP THOẠI ĐỊNH VỊ & QUẢN LÝ "CHỖ BẠN SINH SỐNG (NHÀ CỦA BẠN)" KHI BẤM BIỂU TƯỢNG NGÔI NHÀ */}
      {(homeModalMode === 'view' || homeModalMode === 'edit') && (
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

      {/* 9B. CÔNG CỤ ADMIN CHỈNH SỬA ĐƯỜNG / NGÕ / NGÁCH (TÁCH TÊN & HÌNH HỌC, VẼ LẠI TIM NGÕ, CẦN RÀ SOÁT) */}
      {(isAdminUser || isMapManagerUser) && (
        <AdminRoadEditorPanel
          isOpen={isRoadEditorOpen}
          onClose={() => {
            setIsRoadEditorOpen(false);
            isRoadEditorOpenRef.current = false;
            setIsDrawingRoad(false);
            isDrawingRoadRef.current = false;
            setRoadDrawingPoints([]);
            roadDrawingPointsRef.current = [];
            setIsRedrawingExistingRoad(false);
            setIsMergingSecondRoad(false);
            isMergingSecondRoadRef.current = false;
            setRoadDraftGeometry(null);
            roadDraftGeometryRef.current = null;
            setSelectedRoadVertexIdx(null);
            selectedRoadVertexIdxRef.current = null;
            scheduleCanvasRender();
          }}
          selectedRoad={selectedRoadRecord}
          allRoadsMap={geoLayersRef.current?.roadRecordsById || new Map<string, RoadRecord>()}
          auditIssues={roadAuditIssues}
          isDrawingMode={isDrawingRoad}
          drawingPoints={roadDrawingPoints}
          isRedrawingExisting={isRedrawingExistingRoad}
          isMergingSecondRoad={isMergingSecondRoad}
          draftGeometry={roadDraftGeometry}
          selectedVertexIndex={selectedRoadVertexIdx ?? undefined}
          onChangeDraftGeometry={(geom, vIdx) => {
            setRoadDraftGeometry(geom);
            roadDraftGeometryRef.current = geom;
            setSelectedRoadVertexIdx(vIdx ?? null);
            selectedRoadVertexIdxRef.current = vIdx ?? null;
            scheduleCanvasRender();
          }}
          onStartDrawNewAlley={() => {
            setIsRedrawingExistingRoad(false);
            setIsDrawingRoad(true);
            isDrawingRoadRef.current = true;
            setRoadDrawingPoints([]);
            roadDrawingPointsRef.current = [];
            setIsMergingSecondRoad(false);
            isMergingSecondRoadRef.current = false;
            scheduleCanvasRender();
          }}
          onStartRedrawSelectedRoad={() => {
            setIsRedrawingExistingRoad(true);
            setIsDrawingRoad(true);
            isDrawingRoadRef.current = true;
            setRoadDrawingPoints([]);
            roadDrawingPointsRef.current = [];
            setIsMergingSecondRoad(false);
            isMergingSecondRoadRef.current = false;
            scheduleCanvasRender();
          }}
          onUndoLastDrawPoint={() => {
            setRoadDrawingPoints((prev) => {
              const next = prev.slice(0, -1);
              roadDrawingPointsRef.current = next;
              return next;
            });
            scheduleCanvasRender();
          }}
          onCancelDrawing={() => {
            setIsDrawingRoad(false);
            isDrawingRoadRef.current = false;
            setRoadDrawingPoints([]);
            roadDrawingPointsRef.current = [];
            setIsRedrawingExistingRoad(false);
            scheduleCanvasRender();
          }}
          onStartMergeMode={() => {
            setIsMergingSecondRoad(true);
            isMergingSecondRoadRef.current = true;
          }}
          onCancelMergeMode={() => {
            setIsMergingSecondRoad(false);
            isMergingSecondRoadRef.current = false;
          }}
          onSelectRoadById={(roadId, flyTo) => {
            const rec = geoLayersRef.current?.roadRecordsById?.get(roadId) || null;
            setSelectedRoadRecord(rec);
            selectedRoadRecordRef.current = rec;
            if (rec) {
              highlightedRoadNameRef.current = rec.name || rec.roadId;
              if (flyTo && rec.geometry.length > 0) {
                const mid = rec.geometry[Math.floor(rec.geometry.length / 2)];
                flyToCoordinates(mid[1], mid[0], 17.5, undefined, 0.0028);
              }
            }
            scheduleCanvasRender();
          }}
          onFlyToLngLat={(lng, lat, zoom = 17.4) => {
            flyToCoordinates(lat, lng, zoom, undefined, 0.0028);
          }}
          onNotifyToast={(msg) => {
            showTemporaryMapNotice(msg, 3200);
          }}
        />
      )}

      {/* 10. SA BÀN 3D TOÀN PHƯỜNG XUÂN HÒA (21.436 MASTER BUILDINGS ĐỒNG NHẤT 2D/3D, DEM THẬT, INSTANCED TREES, BÓNG NẮNG) */}
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
          initialZoom={currentZoom}
          initialSelectedPlace={selectedPlace}
          initialAdminLandmarkMode={adminLandmarkMode2D === 'mode_b_model' ? 'mode_b_model' : null}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={(bld) => {
            setSelectedBuilding(bld);
            selectedBuildingRef.current = bld;
          }}
          places={verifiedMapMarkers}
          isAdminUser={isAdminUser}
          isMapManagerUser={isMapManagerUser}
          onDataChanged={() => setSyncTick((t) => t + 1)}
          onOpenWebAdmin={() => {
            window.location.hash = '#/quanly';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }}
          onClose={(centerFrom3D, zoomFrom3D) => {
            setIsCity3DOpen(false);
            setAdminLandmarkMode2D(null);
            if (centerFrom3D && mapInstanceRef.current) {
              mapInstanceRef.current.jumpTo({
                center: [centerFrom3D.lng, centerFrom3D.lat],
                ...(typeof zoomFrom3D === 'number' && !Number.isNaN(zoomFrom3D)
                  ? { zoom: zoomFrom3D }
                  : {}),
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
          activeQuickFilter={activeQuickFilter}
          onChangeQuickFilter={setActiveQuickFilter}
        />
      )}
    </div>
  );
};

export const DigitalMapView = React.memo(DigitalMapViewInner);
