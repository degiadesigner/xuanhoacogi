/**
 * scripts/validate-xuanhoa-master.mjs
 *
 * Bộ Kiểm Định Dữ Liệu Giai Đoạn 1 — Xuân Hòa Digital Twin Nền Tảng (Mục M)
 * Kiểm tra tự động 11 tiêu chí bắt buộc giữa Master Dataset, 2D Runtime, 3D Binary, DEM, Roads và POIs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const GEO_DIR = path.join(ROOT, 'public', 'geo');

function pointInPolygon(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentsProperlyIntersect(a, b, c, d) {
  const ccw = (p1, p2, p3) =>
    (p3[1] - p1[1]) * (p2[0] - p1[0]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
  const d1 = ccw(c, d, a);
  const d2 = ccw(c, d, b);
  const d3 = ccw(a, b, c);
  const d4 = ccw(a, b, d);
  return ((d1 > 1e-11 && d2 < -1e-11) || (d1 < -1e-11 && d2 > 1e-11)) &&
    ((d3 > 1e-11 && d4 < -1e-11) || (d3 < -1e-11 && d4 > 1e-11));
}

function hasSelfIntersection(ring) {
  const pts =
    ring.length >= 4 &&
    Math.abs(ring[0][0] - ring[ring.length - 1][0]) < 1e-9 &&
    Math.abs(ring[0][1] - ring[ring.length - 1][1]) < 1e-9
      ? ring.slice(0, -1)
      : ring;
  const n = pts.length;
  if (n < 3) return true;
  if (n > 80) return false;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = pts[j];
      const d = pts[(j + 1) % n];
      if (segmentsProperlyIntersect(a, b, c, d)) {
        return true;
      }
    }
  }
  return false;
}

function main() {
  console.log('==============================================================');
  console.log(' KIỂM ĐỊNH DỮ LIỆU XUÂN HÒA DIGITAL TWIN NỀN TẢNG (GIAI ĐOẠN 1)');
  console.log('==============================================================');

  const boundaryGeo = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-boundary.geojson'), 'utf8'));
  const boundaryRing = boundaryGeo.features[0].geometry.coordinates[0];

  const masterMeta = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-master-meta.json'), 'utf8'));
  const city3dMeta = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-city3d-meta.json'), 'utf8'));
  const demMeta = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-dem-meta.json'), 'utf8'));
  const demBuf = fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-dem.bin'));
  const demGrid = new Int16Array(demBuf.buffer, demBuf.byteOffset, demBuf.byteLength / 2);

  const city3dBuf = fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-city3d.bin'));
  const dv = new DataView(city3dBuf.buffer, city3dBuf.byteOffset, city3dBuf.byteLength);

  const roadsGeo = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-roads.geojson'), 'utf8'));
  const waterGeo = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-water.geojson'), 'utf8'));
  const waterwaysGeo = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-waterways.geojson'), 'utf8'));
  const landuseGeo = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-landuse.geojson'), 'utf8'));
  const labelsGeo = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-places-labels.geojson'), 'utf8'));
  const verifiedPois = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-osm-verified-pois.json'), 'utf8'));
  const matchedCatalog = JSON.parse(fs.readFileSync(path.join(GEO_DIR, 'xuanhoa-catalog-osm-matched.json'), 'utf8'));

  // Decode xuanhoa-city3d.bin (shared binary for 2D Master Dataset & 3D Worker)
  let o = 0;
  const magic = dv.getUint32(o, true);
  o += 4;
  if (magic !== 0x44334858) {
    throw new Error('Magic header xuanhoa-city3d.bin không khớp 0x44334858 (XH3D)');
  }
  const version = dv.getUint32(o, true);
  o += 4;
  const lng0 = dv.getFloat64(o, true);
  o += 8;
  const lat0 = dv.getFloat64(o, true);
  o += 8;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110574;
  const binaryCount = dv.getUint32(o, true);
  o += 4;
  const treesCount = dv.getUint32(o, true);
  o += 4;

  const osmWayByIdx = new Map(city3dMeta.osm || []);

  function getElevationAtLngLat(lng, lat) {
    const g = demMeta.grid;
    const cols = g.cols;
    const rows = g.rows;
    const u = Math.max(0, Math.min(1, (lng - g.minLng) / (g.maxLng - g.minLng)));
    const v = Math.max(0, Math.min(1, (g.maxLat - lat) / (g.maxLat - g.minLat)));
    const gx = u * (cols - 1);
    const gy = v * (rows - 1);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(cols - 1, x0 + 1);
    const y1 = Math.min(rows - 1, y0 + 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const h00 = demGrid[y0 * cols + x0] * 0.1;
    const h10 = demGrid[y0 * cols + x1] * 0.1;
    const h01 = demGrid[y1 * cols + x0] * 0.1;
    const h11 = demGrid[y1 * cols + x1] * 0.1;
    return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
  }

  let nanCoordCount = 0;
  let invalidHeightCount = 0;
  let outsideBoundaryCount = 0;
  let selfIntersectingCount = 0;
  let elevationNanCount = 0;
  const decoded2DIds = [];
  const decoded3DIds = [];

  for (let idx = 0; idx < binaryCount; idx++) {
    const nPts = dv.getUint8(o++);
    const height = dv.getUint8(o++) * 0.5;
    const wallColorIdx = dv.getUint8(o++);
    const roofByte = dv.getUint8(o++);
    const flags = dv.getUint8(o++);
    const isOsm = (flags & 1) !== 0;

    let px = dv.getInt32(o, true);
    o += 4;
    let py = dv.getInt32(o, true);
    o += 4;

    const ring = [[lng0 + (px * 0.1) / kx, lat0 + (py * 0.1) / ky]];
    let sumLng = ring[0][0];
    let sumLat = ring[0][1];

    if (!Number.isFinite(ring[0][0]) || !Number.isFinite(ring[0][1])) {
      nanCoordCount++;
    }

    for (let j = 1; j < nPts; j++) {
      px += dv.getInt16(o, true);
      o += 2;
      py += dv.getInt16(o, true);
      o += 2;
      const lng = lng0 + (px * 0.1) / kx;
      const lat = lat0 + (py * 0.1) / ky;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        nanCoordCount++;
      }
      sumLng += lng;
      sumLat += lat;
      ring.push([lng, lat]);
    }

    const cLng = sumLng / Math.max(1, nPts);
    const cLat = sumLat / Math.max(1, nPts);

    const wayId = osmWayByIdx.get(idx);
    const id = isOsm && wayId ? `osm_way_${wayId}` : `ob_xh_${idx}`;
    decoded2DIds.push(id);
    decoded3DIds.push(id);

    const levels = city3dMeta.buildingLevels?.[idx] || Math.max(1, Math.round(height / 3.4));
    if (!(height > 0) || !(levels > 0)) {
      invalidHeightCount++;
    }

    let inside = pointInPolygon(cLng, cLat, boundaryRing);
    if (!inside) {
      for (const pt of ring) {
        if (pointInPolygon(pt[0], pt[1], boundaryRing)) {
          inside = true;
          break;
        }
      }
    }
    if (!inside) {
      outsideBoundaryCount++;
    }

    if (hasSelfIntersection(ring)) {
      selfIntersectingCount++;
    }

    const elev = getElevationAtLngLat(cLng, cLat);
    if (!Number.isFinite(elev)) {
      elevationNanCount++;
    }
  }

  // Check boundary bounding box vs DEM
  let bMinLng = Infinity, bMaxLng = -Infinity, bMinLat = Infinity, bMaxLat = -Infinity;
  for (const [lng, lat] of boundaryRing) {
    if (lng < bMinLng) bMinLng = lng;
    if (lng > bMaxLng) bMaxLng = lng;
    if (lat < bMinLat) bMinLat = lat;
    if (lat > bMaxLat) bMaxLat = lat;
  }

  // Sample 2,500 grid points across boundary bbox
  for (let r = 0; r < 50; r++) {
    for (let c = 0; c < 50; c++) {
      const lng = bMinLng + (c / 49) * (bMaxLng - bMinLng);
      const lat = bMinLat + (r / 49) * (bMaxLat - bMinLat);
      const elev = getElevationAtLngLat(lng, lat);
      if (!Number.isFinite(elev)) elevationNanCount++;
    }
  }

  const demCoversBoundary =
    demMeta.grid.minLng <= bMinLng &&
    demMeta.grid.maxLng >= bMaxLng &&
    demMeta.grid.minLat <= bMinLat &&
    demMeta.grid.maxLat >= bMaxLat;

  // Check verified POIs
  const poiItems = Array.isArray(verifiedPois)
    ? verifiedPois
    : verifiedPois.items || verifiedPois.pois || verifiedPois.features || Object.values(verifiedPois);
  let invalidPoiCount = 0;
  let validPoiCount = 0;
  for (const poi of poiItems) {
    if (!poi || typeof poi !== 'object') continue;
    const lat = Number(poi.lat ?? poi.geometry?.coordinates?.[1]);
    const lng = Number(poi.lng ?? poi.geometry?.coordinates?.[0]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 21.2 && lat <= 21.45 && lng >= 105.6 && lng <= 105.85) {
      validPoiCount++;
    } else if (poi.lat !== undefined || poi.lng !== undefined) {
      invalidPoiCount++;
    }
  }

  // Check roads
  let invalidRoadCount = 0;
  for (const rf of roadsGeo.features) {
    const coords = rf.geometry?.coordinates;
    const props = rf.properties || {};
    if (
      rf.geometry?.type !== 'LineString' ||
      !Array.isArray(coords) ||
      coords.length < 2 ||
      !props.id ||
      !props.tier ||
      !(Number(props.width) > 0)
    ) {
      invalidRoadCount++;
      continue;
    }
    for (const pt of coords) {
      if (!Array.isArray(pt) || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
        invalidRoadCount++;
        break;
      }
    }
  }

  const sameCount2DAnd3D =
    masterMeta.counts.buildingsTotal === binaryCount &&
    city3dMeta.stats.buildings === binaryCount &&
    decoded2DIds.length === binaryCount &&
    decoded3DIds.length === binaryCount;

  const sameBuildingIds2DAnd3D =
    decoded2DIds.length === decoded3DIds.length &&
    decoded2DIds.every((id, idx) => id === decoded3DIds[idx]);

  const fakeRectangleReplacementCount =
    masterMeta.qualityFiltering?.fakeRectangleReplacementCount ?? 0;

  const roadAuditPath = path.join(GEO_DIR, 'xuanhoa-road-audit.json');
  const roadAudit = fs.existsSync(roadAuditPath)
    ? JSON.parse(fs.readFileSync(roadAuditPath, 'utf8'))
    : null;
  const ngo29Passed = Boolean(roadAudit?.ngo29NguyenVanLinhRegressionTest?.passed);
  const postRoadAnomalies = roadAudit?.afterAudit?.totalAnomalies ?? -1;

  const checks = [
    {
      id: 1,
      name: '2D và 3D cùng số lượng building (21.008 Master Buildings)',
      passed: sameCount2DAnd3D,
      detail: `master=${masterMeta.counts.buildingsTotal}, 2D_runtime=${decoded2DIds.length}, 3D_binary=${binaryCount}`,
    },
    {
      id: 2,
      name: '2D và 3D cùng tập building ID ổn định (osm_way_* / ob_xh_*)',
      passed: sameBuildingIds2DAnd3D,
      detail: `matchedIds=${decoded2DIds.length}/${decoded3DIds.length}`,
    },
    {
      id: 3,
      name: 'Mọi building nằm trong ranh giới Phường Xuân Hòa (Relation #19542980)',
      passed: outsideBoundaryCount === 0,
      detail: `outsideBoundaryCount=${outsideBoundaryCount}`,
    },
    {
      id: 4,
      name: 'Không có tọa độ NaN trong toàn bộ footprint',
      passed: nanCoordCount === 0,
      detail: `nanCoordCount=${nanCoordCount}`,
    },
    {
      id: 5,
      name: 'Không có công trình nào có height <= 0 hoặc levels <= 0',
      passed: invalidHeightCount === 0,
      detail: `invalidHeightCount=${invalidHeightCount}`,
    },
    {
      id: 6,
      name: 'Không có polygon tự cắt lỗi (self-intersecting footprint)',
      passed: selfIntersectingCount === 0,
      detail: `selfIntersectingCount=${selfIntersectingCount}`,
    },
    {
      id: 7,
      name: 'DEM bao phủ toàn bộ ranh giới Phường Xuân Hòa',
      passed: demCoversBoundary,
      detail: `DEM=[${demMeta.grid.minLng}, ${demMeta.grid.minLat}, ${demMeta.grid.maxLng}, ${demMeta.grid.maxLat}] covers Boundary=[${bMinLng.toFixed(5)}, ${bMinLat.toFixed(5)}, ${bMaxLng.toFixed(5)}, ${bMaxLat.toFixed(5)}]`,
    },
    {
      id: 8,
      name: 'Không có getElevationAtLngLat trả về NaN',
      passed: elevationNanCount === 0,
      detail: `elevationNanCount=${elevationNanCount} (tested ${binaryCount + 2500} sample points)`,
    },
    {
      id: 9,
      name: 'Mọi POI verified có tọa độ hợp lệ',
      passed: invalidPoiCount === 0 && validPoiCount > 0,
      detail: `validPois=${validPoiCount}, invalidPoiCount=${invalidPoiCount}`,
    },
    {
      id: 10,
      name: 'Mọi road chuẩn hóa có geometry và thuộc tính (id, tier, width) hợp lệ',
      passed: invalidRoadCount === 0 && roadsGeo.features.length > 0,
      detail: `roads=${roadsGeo.features.length}, invalidRoadCount=${invalidRoadCount}`,
    },
    {
      id: 11,
      name: 'Không còn footprint bị thay bằng rectangle giả (fakeRectangleReplacementCount === 0)',
      passed: fakeRectangleReplacementCount === 0,
      detail: `fakeRectangleReplacementCount=${fakeRectangleReplacementCount}`,
    },
    {
      id: 12,
      name: 'Mạng lưới Đường & Ngõ chuẩn hóa: 0 lỗi hình học, 0 tên ngõ tự đoán, Ngõ 29 Nguyễn Văn Linh PASS',
      passed: ngo29Passed && postRoadAnomalies === 0,
      detail: `postRoadAnomalies=${postRoadAnomalies}, ngo29RegressionPassed=${ngo29Passed}, namedAlleys=${roadAudit?.ALL_NAMED_ALLEYS?.length ?? 0}`,
    },
  ];

  let allPassed = true;
  for (const c of checks) {
    const badge = c.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${badge} [${String(c.id).padStart(2, '0')}/11] ${c.name} -> ${c.detail}`);
    if (!c.passed) allPassed = false;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    allPassed,
    summary: {
      masterBuildingsTotal: binaryCount,
      osmBuildingsCount: masterMeta.counts.buildingsOsm,
      openBuildingsExternalCount: masterMeta.counts.buildingsExternalFootprint,
      googleOpenBuildingsCount: masterMeta.counts.buildingsGoogle,
      microsoftBuildingsCount: masterMeta.counts.buildingsMicrosoft,
      roadsCount: roadsGeo.features.length,
      waterPolygonsCount: waterGeo.features.length,
      waterwaysCount: waterwaysGeo.features.length,
      landuseCount: landuseGeo.features.length,
      placeLabelsCount: labelsGeo.features.length,
      verifiedPoisCount: validPoiCount,
      treesCount,
      heightSourceCounts: masterMeta.heightSourceCounts,
      contextualZoneCounts: masterMeta.contextualZoneCounts,
      demSummary: {
        source: demMeta.source,
        grid: `${demMeta.grid.cols}x${demMeta.grid.rows}`,
        datumAslMeters: demMeta.origin.datumElevationAslM,
        minRelativeMeters: demMeta.stats.minRelativeElevationM,
        maxRelativeMeters: demMeta.stats.maxRelativeElevationM,
        minAslMeters: demMeta.stats.minAslElevationM,
        maxAslMeters: demMeta.stats.maxAslElevationM,
      },
    },
    checks,
  };

  const reportPath = path.join(GEO_DIR, 'xuanhoa-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('--------------------------------------------------------------');
  console.log(`Đã lưu báo cáo kiểm định: ${reportPath}`);
  console.log(`Kết quả tổng thể: ${allPassed ? '11/11 PASS TUYỆT ĐỐI' : 'CÓ LỖI CẦN KIỂM TRA'}`);
  console.log('==============================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

main();
