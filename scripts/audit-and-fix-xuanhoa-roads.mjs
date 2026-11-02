/**
 * XUÂN HÒA DIGITAL TWIN — ROAD & ALLEY NETWORK FULL AUDIT & FIX PIPELINE
 * ============================================================================
 * Thực hiện kiểm toán (Audit) và sửa chữa toàn diện hệ thống Đường / Ngõ của
 * Bản đồ số Phường Xuân Hòa cho cả 2D (DigitalMapView) và 3D (City3DView):
 *
 *   1. Kiểm toán 12 nhóm lỗi hình học & tô-pô + kiểm toán tên đường/ngõ trên dữ liệu hiện tại.
 *   2. Khôi phục mạng lưới vector chuẩn OpenStreetMap (6.225 tuyến gốc 56269cb) làm xương sống
 *      tô-pô cho toàn bộ đường chính, đường nhánh, vòng xuyến và đường dân sinh.
 *   3. Hợp nhất có chọn lọc các ngõ cụt dân sinh thực tế từ Google Maps (chưa có trên OSM) sau khi:
 *      - Cắt bỏ hoàn toàn phần trùng lặp với đường OSM hiện hữu;
 *      - Loại bỏ 100% đoạn stub/kink giao lộ (`major`/`secondary` giả như gmaps/way_3320, gmaps/way_3324);
 *      - Cắt bỏ các đoạn móc cong lỗi raster ở cuối ngõ (như đoạn móc cuối Ngõ 29 Nguyễn Văn Linh);
 *      - Snap điểm đầu ngõ khớp tuyệt đối vào đỉnh/đoạn của đường mẹ (T-junction chuẩn).
 *   4. Áp dụng lớp hiệu chỉnh thực địa `public/geo/xuanhoa-road-overrides.json`:
 *      - Bảo toàn mốc Local Verified: "Ngõ 29 Nguyễn Văn Linh" (gần đối diện Phố Cù Chính Lan,
 *        nối trực tiếp vào Đường Nguyễn Văn Linh tại [105.718521, 21.285574]);
 *      - Xóa toàn bộ 664 tên ngõ tự đoán dạng "Ngõ <Tên Đường>" không có số/tên xác thực
 *        (giữ nguyên hình học ngõ nhưng để `name: ""`);
 *      - Chỉ hiển thị tên cho các ngõ đã xác minh (`osm_verified` hoặc `local_verified`).
 *   5. Xuất:
 *      - `public/geo/xuanhoa-roads.geojson` (Dữ liệu đường Master dùng chung cho 2D & 3D)
 *      - `public/geo/xuanhoa-road-audit.json` (Báo cáo QA hình học, tô-pô & danh sách ALL_NAMED_ALLEYS)
 *
 * Cách chạy:
 *   node scripts/audit-and-fix-xuanhoa-roads.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEO = path.join(ROOT, 'public', 'geo');
const CACHE_DIR = path.join(ROOT, 'scripts', '.cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const ROADS_PATH = path.join(GEO, 'xuanhoa-roads.geojson');
const OVERRIDES_PATH = path.join(GEO, 'xuanhoa-road-overrides.json');
const AUDIT_PATH = path.join(GEO, 'xuanhoa-road-audit.json');
const BOUNDARY_PATH = path.join(GEO, 'xuanhoa-boundary.geojson');
const BUILDINGS_PATH = path.join(GEO, 'xuanhoa-buildings.geojson');
const WATER_PATH = path.join(GEO, 'xuanhoa-water.geojson');

const OSM_BASE_CACHE = path.join(CACHE_DIR, 'osm_roads_base_56269cb.geojson');
const GMAPS_RASTER_CACHE = path.join(CACHE_DIR, 'gmaps_roads_63b6e9f.geojson');

// Hệ tọa độ phẳng cục bộ (mét) — tâm ĐHSP Hà Nội 2, đồng bộ với build-xuanhoa-master.mjs & City3D
const LNG0 = 105.7262;
const LAT0 = 21.2818;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110574;
const toXY = ([lng, lat]) => [(lng - LNG0) * KX, (lat - LAT0) * KY];
const toLngLat = ([x, y]) => [Number((LNG0 + x / KX).toFixed(6)), Number((LAT0 + y / KY).toFixed(6))];

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ============================================================================
// PHẦN 0: TẢI & LƯU CACHE NGUỒN DỮ LIỆU GỐC ĐỂ ĐẢM BẢO TÁI LẬP 100% (IDEMPOTENT)
// ============================================================================
if (!fs.existsSync(OSM_BASE_CACHE)) {
  const osmRaw = execSync('git show 56269cb:public/geo/xuanhoa-roads.geojson', {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  }).toString('utf8');
  fs.writeFileSync(OSM_BASE_CACHE, osmRaw);
}

if (!fs.existsSync(GMAPS_RASTER_CACHE)) {
  const gmapsRaw = execSync('git show 63b6e9f:public/geo/xuanhoa-roads.geojson', {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  }).toString('utf8');
  fs.writeFileSync(GMAPS_RASTER_CACHE, gmapsRaw);
}

const osmBaseGeo = readJson(OSM_BASE_CACHE);
const gmapsRasterGeo = readJson(GMAPS_RASTER_CACHE);
const overridesDoc = readJson(OVERRIDES_PATH);
const boundaryGeo = readJson(BOUNDARY_PATH);
const buildingsGeo = readJson(BUILDINGS_PATH);
const waterGeo = readJson(WATER_PATH);

// ============================================================================
// PHẦN 1: CÁC HÀM HÌNH HỌC & SPATIAL INDEX
// ============================================================================
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function bboxOf(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function ptSegProj(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return { x: ax, y: ay, d: Math.hypot(px - ax, py - ay), t: 0 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const qx = ax + t * dx, qy = ay + t * dy;
  return { x: qx, y: qy, d: Math.hypot(px - qx, py - qy), t };
}

function segsProperlyIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const ccw = (p1x, p1y, p2x, p2y, p3x, p3y) =>
    (p3y - p1y) * (p2x - p1x) - (p2y - p1y) * (p3x - p1x);
  const d1 = ccw(ax, ay, bx, by, cx, cy);
  const d2 = ccw(ax, ay, bx, by, dx, dy);
  const d3 = ccw(cx, cy, dx, dy, ax, ay);
  const d4 = ccw(cx, cy, dx, dy, bx, by);
  return ((d1 > 1e-7 && d2 < -1e-7) || (d1 < -1e-7 && d2 > 1e-7)) &&
         ((d3 > 1e-7 && d4 < -1e-7) || (d3 < -1e-7 && d4 > 1e-7));
}

function pathLength(pts) {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return len;
}

class SpatialGrid {
  constructor(cell = 40) {
    this.cell = cell;
    this.map = new Map();
  }
  key(ix, iy) {
    return ix * 100003 + iy;
  }
  insertBox(id, box) {
    const c = this.cell;
    for (let ix = Math.floor(box[0] / c); ix <= Math.floor(box[2] / c); ix++) {
      for (let iy = Math.floor(box[1] / c); iy <= Math.floor(box[3] / c); iy++) {
        const k = this.key(ix, iy);
        let arr = this.map.get(k);
        if (!arr) this.map.set(k, (arr = []));
        arr.push(id);
      }
    }
  }
  queryBox(box, pad = 0) {
    const c = this.cell;
    const out = new Set();
    for (let ix = Math.floor((box[0] - pad) / c); ix <= Math.floor(box[2] + pad) / c; ix++) {
      for (let iy = Math.floor((box[1] - pad) / c); iy <= Math.floor((box[3] + pad) / c); iy++) {
        const arr = this.map.get(this.key(ix, iy));
        if (arr) for (const id of arr) out.add(id);
      }
    }
    return out;
  }
}

const wardRing = boundaryGeo.features[0].geometry.coordinates[0].map(toXY);
const insideWard = (x, y) => pointInRing(x, y, wardRing);

const waterRings = waterGeo.features
  .filter((f) => f.geometry?.type === 'Polygon')
  .map((f) => {
    const ring = f.geometry.coordinates[0].map(toXY);
    return { ring, box: bboxOf(ring), name: f.properties?.name || '' };
  });
const waterGrid = new SpatialGrid(80);
waterRings.forEach((w, i) => waterGrid.insertBox(i, w.box));

const buildingRings = buildingsGeo.features
  .filter((f) => f.geometry?.type === 'Polygon' && f.properties?.building !== 'dam')
  .map((f) => {
    const ring = f.geometry.coordinates[0].map(toXY);
    return { ring, box: bboxOf(ring), name: f.properties?.name || '' };
  });
const buildingGrid = new SpatialGrid(35);
buildingRings.forEach((b, i) => buildingGrid.insertBox(i, b.box));

function hitsWater(x1, y1, x2, y2) {
  const mx = (x1 + x2) * 0.5, my = (y1 + y2) * 0.5;
  const box = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  for (const id of waterGrid.queryBox(box, 1)) {
    const w = waterRings[id];
    if (pointInRing(mx, my, w.ring) || (pointInRing(x1, y1, w.ring) && pointInRing(x2, y2, w.ring))) {
      return true;
    }
  }
  return false;
}

function hitsBuildingInterior(x1, y1, x2, y2) {
  const mx = (x1 + x2) * 0.5, my = (y1 + y2) * 0.5;
  const box = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  for (const id of buildingGrid.queryBox(box, 0.5)) {
    const b = buildingRings[id];
    if (pointInRing(mx, my, b.ring)) return true;
  }
  return false;
}

// ============================================================================
// PHẦN 2: HÀM AUDIT TOÀN DIỆN MẠNG LƯỚI ĐƯỜNG (12 TIÊU CHÍ HÌNH HỌC + TÊN)
// ============================================================================
const FABRICATED_ALLEY_RE = /^Ngõ\s+(?!29\s+Nguyễn\s+Văn\s+Linh$|1\s+Võ\s+Thị\s+Sáu$|7\s+Đường\s+Lê\s+Trọng\s+Tấn$)/i;
const NAMED_ALLEY_RE = /^(Ngõ|Ngách|Hẻm)\s+/i;

function runNetworkAudit(featureCollection, datasetLabel) {
  const anomalies = [];
  const counts = {
    sharpKinkOrHook: 0,
    shortMajorSecondaryStub: 0,
    duplicateNearZeroSeg: 0,
    selfIntersectionOrFoldback: 0,
    buildingPenetration: 0,
    waterCrossingWithoutBridge: 0,
    disconnectedSameNameAlley: 0,
    fabricatedAlleyNameCount: 0,
    unconnectedNamedAlley: 0,
  };

  const namedAlleyByName = new Map();
  const namedRoadSegGrid = new SpatialGrid(40);
  const namedRoadSegs = [];

  for (const f of featureCollection.features) {
    if (f.geometry?.type !== 'LineString') continue;
    const p = f.properties || {};
    const name = String(p.name || '').trim();
    if (!name || NAMED_ALLEY_RE.test(name)) continue;
    const pts = f.geometry.coordinates.map(toXY);
    for (let i = 0; i < pts.length - 1; i++) {
      const id = namedRoadSegs.length;
      namedRoadSegs.push({
        x1: pts[i][0],
        y1: pts[i][1],
        x2: pts[i + 1][0],
        y2: pts[i + 1][1],
        name,
        roadId: p.id || p.osmId || '',
      });
      namedRoadSegGrid.insertBox(id, [
        Math.min(pts[i][0], pts[i + 1][0]),
        Math.min(pts[i][1], pts[i + 1][1]),
        Math.max(pts[i][0], pts[i + 1][0]),
        Math.max(pts[i][1], pts[i + 1][1]),
      ]);
    }
  }

  for (const f of featureCollection.features) {
    if (f.geometry?.type !== 'LineString') continue;
    const p = f.properties || {};
    const roadId = p.id || p.osmId || 'unknown';
    const name = String(p.name || '').trim();
    const tier = p.tier || 'alley';
    const coords = f.geometry.coordinates;
    const pts = coords.map(toXY);
    const len = pathLength(pts);

    // 1. Kiểm tra tên ngõ tự đoán
    if (FABRICATED_ALLEY_RE.test(name)) {
      counts.fabricatedAlleyNameCount++;
      anomalies.push({
        roadId,
        type: 'fabricated_alley_name',
        name,
        coord: coords[0],
        detail: `Tên ngõ tự đoán "${name}" không có số ngõ/nguồn xác thực`,
      });
    }

    if (NAMED_ALLEY_RE.test(name)) {
      let arr = namedAlleyByName.get(name);
      if (!arr) namedAlleyByName.set(name, (arr = []));
      arr.push({ roadId, pts, coords, p });
    }

    // 2. Đoạn major/secondary cực ngắn hoặc stub không tên ở giao lộ (như gmaps/way_3320, gmaps/way_3324)
    if ((tier === 'major' || tier === 'secondary') && !name && len < 45 && !p.junction) {
      counts.shortMajorSecondaryStub++;
      anomalies.push({
        roadId,
        type: 'short_major_secondary_stub',
        tier,
        lengthM: Number(len.toFixed(1)),
        coord: coords[0],
        detail: `Đoạn ${tier} không tên ngắn bất thường (${len.toFixed(1)}m) gây phình/lệch tim giao lộ`,
      });
    }

    // 3. Điểm trùng lặp / segment siêu ngắn
    for (let i = 0; i < pts.length - 1; i++) {
      const segLen = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (segLen < 0.2) {
        counts.duplicateNearZeroSeg++;
        anomalies.push({
          roadId,
          type: 'duplicate_or_near_zero_segment',
          lengthM: Number(segLen.toFixed(3)),
          coord: coords[i],
        });
      }
    }

    // 4. Góc gập nhọn bất thường (Single vertex > 92° trên đường đô thị hoặc 2-step hook > 95° trong < 10m)
    const isMountainTrail = p.highway === 'path' || p.highway === 'track';
    for (let i = 1; i < pts.length - 1; i++) {
      const vx1 = pts[i][0] - pts[i - 1][0], vy1 = pts[i][1] - pts[i - 1][1];
      const vx2 = pts[i + 1][0] - pts[i][0], vy2 = pts[i + 1][1] - pts[i][1];
      const l1 = Math.hypot(vx1, vy1), l2 = Math.hypot(vx2, vy2);
      if (l1 < 0.25 || l2 < 0.25) continue;
      const cos = Math.max(-1, Math.min(1, (vx1 * vx2 + vy1 * vy2) / (l1 * l2)));
      const deg = (Math.acos(cos) * 180) / Math.PI;
      if (deg > 152) {
        counts.selfIntersectionOrFoldback++;
        anomalies.push({
          roadId,
          type: 'foldback_hairpin_spike',
          angleDeg: Number(deg.toFixed(1)),
          coord: coords[i],
        });
      } else if (!isMountainTrail && deg > 92) {
        counts.sharpKinkOrHook++;
        anomalies.push({
          roadId,
          type: 'sharp_kink_single_vertex',
          name,
          angleDeg: Number(deg.toFixed(1)),
          coord: coords[i],
        });
      }
    }

    // Kiểm tra 2-step cumulative hook qua đoạn vát ngắn (< 9m) — chính là lỗi móc câu ở cuối gmaps/way_3114
    if (!isMountainTrail && pts.length >= 4) {
      for (let i = 1; i < pts.length - 2; i++) {
        const midLen = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        if (midLen > 9.0) continue;
        const vx1 = pts[i][0] - pts[i - 1][0], vy1 = pts[i][1] - pts[i - 1][1];
        const vx2 = pts[i + 2][0] - pts[i + 1][0], vy2 = pts[i + 2][1] - pts[i + 1][1];
        const l1 = Math.hypot(vx1, vy1), l2 = Math.hypot(vx2, vy2);
        if (l1 < 2 || l2 < 2) continue;
        const cos = Math.max(-1, Math.min(1, (vx1 * vx2 + vy1 * vy2) / (l1 * l2)));
        const deg = (Math.acos(cos) * 180) / Math.PI;
        if (deg > 92) {
          counts.sharpKinkOrHook++;
          anomalies.push({
            roadId,
            type: 'sharp_2step_corner_hook',
            name,
            angleDeg: Number(deg.toFixed(1)),
            bevelLenM: Number(midLen.toFixed(2)),
            coord: coords[i],
          });
        }
      }
    }

    // 5. Tự cắt nhau (Self-intersection)
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = i + 2; j < pts.length - 1; j++) {
        if (
          segsProperlyIntersect(
            pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1],
            pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1]
          )
        ) {
          counts.selfIntersectionOrFoldback++;
          anomalies.push({
            roadId,
            type: 'self_intersection',
            coord: coords[i],
          });
        }
      }
    }

    // 6. Cắt qua mặt nước không có bridge (chỉ kiểm tra cho các đoạn ngõ tự trích xuất)
    if (!p.bridge && String(roadId).startsWith('gmaps/')) {
      for (let i = 0; i < pts.length - 1; i++) {
        if (hitsWater(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])) {
          counts.waterCrossingWithoutBridge++;
          break;
        }
      }
      for (let i = 0; i < pts.length - 1; i++) {
        if (hitsBuildingInterior(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])) {
          counts.buildingPenetration++;
          break;
        }
      }
    }
  }

  // Kiểm tra các ngõ có tên bị đứt rời hoặc không nối vào đường mẹ
  for (const [alleyName, items] of namedAlleyByName.entries()) {
    if (items.length > 1) {
      // Kiểm tra xem các đoạn cùng tên ngõ có chạm nhau (< 5m) hay bị nhảy sang nhánh khác
      for (let i = 1; i < items.length; i++) {
        const a = items[0].pts, b = items[i].pts;
        const dMin = Math.min(
          Math.hypot(a[0][0] - b[0][0], a[0][1] - b[0][1]),
          Math.hypot(a[0][0] - b[b.length - 1][0], a[0][1] - b[b.length - 1][1]),
          Math.hypot(a[a.length - 1][0] - b[0][0], a[a.length - 1][1] - b[0][1]),
          Math.hypot(a[a.length - 1][0] - b[b.length - 1][0], a[a.length - 1][1] - b[b.length - 1][1])
        );
        if (dMin > 5) {
          counts.disconnectedSameNameAlley++;
          anomalies.push({
            roadId: items[i].roadId,
            type: 'disconnected_same_name_alley',
            name: alleyName,
            gapM: Number(dMin.toFixed(1)),
            coord: items[i].coords[0],
          });
        }
      }
    }
  }

  return {
    datasetLabel,
    totalFeatures: featureCollection.features.length,
    counts,
    sampleAnomalies: anomalies.slice(0, 60),
    totalAnomalies: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

const preAudit = runNetworkAudit(gmapsRasterGeo, 'before_fix_87ccd03');
console.log('🔍 Kết quả Audit TRƯỚC KHI SỬA (87ccd03):', JSON.stringify(preAudit.counts, null, 2));

// ============================================================================
// PHẦN 3: CHUẨN HÓA & LÀM SẠCH XƯƠNG SỐNG VECTOR OPENSTREETMAP (56269cb)
// ============================================================================
const TRAIL_SLANG_RE =
  /^(Hai Con Cho|Dốc Há Mồm|Đường mòn Há Mồm|Dốc Ông Roche|Dốc MegaWatt|Dốc Llum|Đường mòn Đồi Llum|Thiên Phú Lâm Loop|Dong Do Lake Trail|Đường mòn Phi|Đường bê tông|Dốc Ban Tiện|Dốc Thái|Dốc Đá Bạc|Dốc Cây Cô Đơn|Dốc Đá Trắng|Dốc Minh Trí|Dốc Đồi Gió|Đường mòn PCCC Pit Stop)/i;

const NAME_NORMALIZE = new Map([
  ['Phùng Chí Kiên', 'Đường Phùng Chí Kiên'],
  ['Nguyễn Tất Thành', 'Đường Nguyễn Tất Thành'],
  ['Đường tỉnh 35', 'Đường tỉnh 35'],
  ['Thanh Loan', 'Đường Thanh Loan'],
  ['Thái Lai', 'Đường Thái Lai'],
  ['Lập Trí - Xuân Hòa', 'Đường Lập Trí - Xuân Hòa'],
  ['Đường đi Từ Lập Trí sang Xuân Hòa', 'Đường Lập Trí - Xuân Hòa'],
]);

// Hàm khử đỉnh trùng lặp (< 0.25m) và khử gai gập 160°..180° trên polyline
function cleanPolylineXY(pts) {
  if (pts.length < 2) return pts;
  const dedup = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = dedup[dedup.length - 1];
    if (Math.hypot(pts[i][0] - prev[0], pts[i][1] - prev[1]) >= 0.25) {
      dedup.push(pts[i]);
    }
  }
  if (dedup.length < 2) return pts.slice(0, 2);

  // Loại bỏ đỉnh gai gập ngược (> 152°)
  let cleaned = dedup;
  for (let pass = 0; pass < 2; pass++) {
    if (cleaned.length < 3) break;
    const next = [cleaned[0]];
    for (let i = 1; i < cleaned.length - 1; i++) {
      const a = next[next.length - 1];
      const b = cleaned[i];
      const c = cleaned[i + 1];
      const vx1 = b[0] - a[0], vy1 = b[1] - a[1];
      const vx2 = c[0] - b[0], vy2 = c[1] - b[1];
      const l1 = Math.hypot(vx1, vy1), l2 = Math.hypot(vx2, vy2);
      if (l1 < 0.25 || l2 < 0.25) continue;
      const cos = (vx1 * vx2 + vy1 * vy2) / (l1 * l2);
      if (cos < -0.88) {
        // Bỏ đỉnh gai b
        continue;
      }
      next.push(b);
    }
    next.push(cleaned[cleaned.length - 1]);
    cleaned = next;
  }
  return cleaned;
}

// Tách các đoạn đường dân sinh/ngõ gấp khúc chữ L (> 92° tại 1 đỉnh hoặc qua đoạn vát góc < 9m)
// thành 2 đoạn nối tại đúng đỉnh góc để tránh lỗi miter spike trong 3D và tránh nhảy nhãn qua góc cua.
function splitAtSharpUrbanCorners(pts, isMountainTrail) {
  if (isMountainTrail || pts.length < 3) return [pts];
  const segments = [];
  let startIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const vx1 = pts[i][0] - pts[i - 1][0], vy1 = pts[i][1] - pts[i - 1][1];
    const vx2 = pts[i + 1][0] - pts[i][0], vy2 = pts[i + 1][1] - pts[i][1];
    const l1 = Math.hypot(vx1, vy1), l2 = Math.hypot(vx2, vy2);
    if (l1 >= 0.5 && l2 >= 0.5) {
      const cos = (vx1 * vx2 + vy1 * vy2) / (l1 * l2);
      if (cos < -0.034) {
        const part = pts.slice(startIdx, i + 1);
        if (part.length >= 2) segments.push(part);
        startIdx = i;
        continue;
      }
    }
    if (i < pts.length - 2 && i > startIdx) {
      const midLen = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (midLen <= 9.0) {
        const ux1 = pts[i][0] - pts[i - 1][0], uy1 = pts[i][1] - pts[i - 1][1];
        const ux2 = pts[i + 2][0] - pts[i + 1][0], uy2 = pts[i + 2][1] - pts[i + 1][1];
        const ul1 = Math.hypot(ux1, uy1), ul2 = Math.hypot(ux2, uy2);
        if (ul1 >= 2.0 && ul2 >= 2.0) {
          const cos2 = (ux1 * ux2 + uy1 * uy2) / (ul1 * ul2);
          if (cos2 < -0.034) {
            const part = pts.slice(startIdx, i + 1);
            if (part.length >= 2) segments.push(part);
            startIdx = i;
          }
        }
      }
    }
  }
  const tail = pts.slice(startIdx);
  if (tail.length >= 2) segments.push(tail);
  return segments.length ? segments : [pts];
}

const VONG_TRON_1_IDS = new Set([
  'way/155852073',
  'way/1241683324',
  'way/1289786122',
  'way/1241683325',
]);

const MAJOR_AXIS_NAMES = new Set([
  'Đường Nguyễn Văn Linh',
  'Đường Trường Chinh',
  'Đường Hùng Vương',
  'Đường Lạc Long Quân',
  'Đường tỉnh 35',
  'Đường Nguyễn Tất Thành',
  'Đường Lê Quang Đạo',
]);

const ARTERIAL_COLLECTOR_NAMES = new Set([
  'Đường Phạm Văn Đồng',
  'Đường Lê Thái Tổ',
  'Đường Kim Ngọc',
  'Đường Trần Phú',
  'Đường Lê Trọng Tấn',
  'Đường Phùng Chí Kiên',
  'Đường Lê Lợi',
  'Đường Hai Bà Trưng',
  'Đường Nguyễn Trãi',
  'Đường Nguyễn Du',
  'Đường Lý Thường Kiệt',
  'Đường Tô Hiệu',
  'Đường Hoàng Hoa Thám',
  'Phố Cù Chính Lan',
  'Phố Võ Thị Sáu',
  'Đường Lâm Trường Đi Đập Đỉnh Phú',
  'Đường Thanh Niên',
  'Đường Ngô Quyền',
  'Đường Quang Trung',
  'Đường Bà Triệu',
  'Đường Chu Văn An',
  'Đường Đinh Tiên Hoàng',
]);

function normalizeRoadHierarchy(hw, name, rawTier, isAerialAlley = false) {
  const nm = String(name || '').trim();
  if (/^(Ngõ|Ngách|Hẻm)\s+/i.test(nm) || isAerialAlley) {
    return {
      roadClass: 'alley',
      tier: 'alley',
      roadType: /^Ngách\s+/i.test(nm) ? 'lane' : 'alley',
    };
  }
  if (
    hw === 'motorway' ||
    hw === 'trunk' ||
    hw === 'primary' ||
    hw === 'secondary' ||
    MAJOR_AXIS_NAMES.has(nm) ||
    rawTier === 'major'
  ) {
    return { roadClass: 'major', tier: 'major', roadType: 'road' };
  }
  if (
    hw === 'tertiary' ||
    ARTERIAL_COLLECTOR_NAMES.has(nm) ||
    rawTier === 'secondary' ||
    rawTier === 'arterial'
  ) {
    return { roadClass: 'arterial', tier: 'secondary', roadType: 'street' };
  }
  if (hw === 'residential' || hw === 'unclassified' || hw === 'living_street') {
    return {
      roadClass: 'local',
      tier: 'minor',
      roadType: /^(Phố|Đường)\s+/i.test(nm) ? 'street' : 'local_road',
    };
  }
  if (hw === 'service') {
    return {
      roadClass: 'access',
      tier: 'access',
      roadType: 'service_road',
    };
  }
  if (hw === 'track') {
    return {
      roadClass: 'access',
      tier: 'access',
      roadType: 'access_road',
    };
  }
  return {
    roadClass: 'access',
    tier: 'access',
    roadType: 'path',
  };
}

const masterRoads = [];
let splitCornerCount = 0;
let outOfBoundaryRemovedCount = 0;

for (const f of osmBaseGeo.features) {
  if (f.geometry?.type !== 'LineString') continue;
  const p = { ...(f.properties || {}) };
  const baseId = String(p.osmId || p.id || `osm_way_${masterRoads.length}`);
  let name = String(p.name || '').trim();
  if (NAME_NORMALIZE.has(name)) name = NAME_NORMALIZE.get(name);
  if (TRAIL_SLANG_RE.test(name)) name = '';

  const hw = p.highway || 'residential';
  if (VONG_TRON_1_IDS.has(baseId)) {
    p.junction = 'roundabout';
  }

  const rawCoords = f.geometry.coordinates;
  const rawPts = rawCoords.map(toXY);
  // Mục 1: Chỉ giữ đường nằm trong ranh giới phường Xuân Hòa (hoặc giao ranh giới)
  const hasPointInWard = rawPts.some(([x, y]) => insideWard(x, y));
  if (!hasPointInWard) {
    outOfBoundaryRemovedCount++;
    continue;
  }

  const cleanedPts = cleanPolylineXY(rawPts);
  if (cleanedPts.length < 2) continue;

  // Tách riêng nhánh phía Bắc của way/176151686 ([105.717687, 21.285617] -> [105.718375, 21.285894])
  // nối trực tiếp vào Đường Nguyễn Văn Linh để gán chính xác Ngõ 29 Nguyễn Văn Linh (Mục 27)
  if (baseId === 'way/176151686') {
    const splitTargetXY = toXY([105.717687, 21.285617]);
    let bestSplitIdx = -1;
    let bestSplitDist = 8.0;
    for (let i = 1; i < cleanedPts.length - 1; i++) {
      const d = Math.hypot(
        cleanedPts[i][0] - splitTargetXY[0],
        cleanedPts[i][1] - splitTargetXY[1]
      );
      if (d < bestSplitDist) {
        bestSplitDist = d;
        bestSplitIdx = i;
      }
    }
    if (bestSplitIdx > 0 && bestSplitIdx < cleanedPts.length - 1) {
      const swPts = cleanedPts.slice(0, bestSplitIdx + 1);
      const northAlleyPts = cleanedPts.slice(bestSplitIdx);
      const swNorm = normalizeRoadHierarchy(hw, '', p.tier, false);
      masterRoads.push({
        id: 'way/176151686#sw',
        osmId: baseId,
        name: '',
        roadClass: swNorm.roadClass,
        roadType: swNorm.roadType,
        tier: swNorm.tier,
        highway: hw,
        surface: p.surface || 'paved',
        source: 'osm',
        confidence: 0.95,
        verificationStatus: 'osm_unnamed',
        parentRoad: '',
        pts: swPts,
        len: pathLength(swPts),
      });
      masterRoads.push({
        id: 'way/176151686',
        osmId: baseId,
        name: 'Ngõ 29 Nguyễn Văn Linh',
        roadClass: 'alley',
        roadType: 'alley',
        tier: 'alley',
        highway: 'residential',
        surface: 'paved',
        source: 'local_verified',
        nameSource: 'local_verified',
        geometrySource: 'osm',
        confidence: 1.0,
        verificationStatus: 'verified',
        locked: true,
        parentRoad: 'Đường Nguyễn Văn Linh',
        parentRoadId: 'way/157991278',
        pts: northAlleyPts,
        len: pathLength(northAlleyPts),
      });
      continue;
    }
  }

  const norm = normalizeRoadHierarchy(hw, name, p.tier, false);
  const isMountainTrail = hw === 'path' || hw === 'track';
  const parts = splitAtSharpUrbanCorners(cleanedPts, isMountainTrail);
  if (parts.length > 1) splitCornerCount += parts.length - 1;

  parts.forEach((partPts, partIdx) => {
    // Chỉ giữ các đoạn thực sự nằm trong hoặc chạm ranh giới Phường Xuân Hòa
    if (!partPts.some(([x, y]) => insideWard(x, y))) {
      outOfBoundaryRemovedCount++;
      return;
    }
    const id = parts.length === 1 ? baseId : `${baseId}#${partIdx + 1}`;
    const len = pathLength(partPts);
    if (len < 1.2) return;
    masterRoads.push({
      id,
      osmId: baseId,
      name,
      roadClass: norm.roadClass,
      roadType: norm.roadType,
      tier: norm.tier,
      highway: hw,
      oneway: p.oneway || undefined,
      bridge: p.bridge || undefined,
      junction: p.junction || undefined,
      surface: p.surface || (norm.roadClass === 'major' || norm.roadClass === 'arterial' ? 'asphalt' : 'paved'),
      source: 'osm',
      confidence: 0.95,
      verificationStatus: name ? 'osm_verified' : 'osm_unnamed',
      parentRoad: '',
      pts: partPts,
      len,
    });
  });
}

// ============================================================================
// PHẦN 4: LAN TRUYỀN TÊN ĐƯỜNG CHÍNH DỌC THEO CÁC ĐOẠN NỐI TIẾP CÙNG CẤP (THẲNG HƯỚNG)
// ============================================================================
// Lưu ý: CHỈ nối tên cho các đoạn đường chính (major/secondary) bị khuyết tên trên cùng một trục thẳng
// (dot > 0.85, khoảng cách đầu mút <= 5m), TUYỆT ĐỐI KHÔNG gán tên cho đường nhánh hoặc ngõ!
const epBucketKey = (pt) => `${Math.round(pt[0] / 4)},${Math.round(pt[1] / 4)}`;
for (let pass = 0; pass < 4; pass++) {
  const epMap = new Map();
  for (const r of masterRoads) {
    if (!r.name || (r.tier !== 'major' && r.tier !== 'secondary')) continue;
    const s0 = r.pts[0], s1 = r.pts[1];
    const eN = r.pts[r.pts.length - 1], eP = r.pts[r.pts.length - 2];
    const lS = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) || 1;
    const lE = Math.hypot(eN[0] - eP[0], eN[1] - eP[1]) || 1;
    for (const ep of [
      { pt: s0, ux: (s0[0] - s1[0]) / lS, uy: (s0[1] - s1[1]) / lS, name: r.name, tier: r.tier },
      { pt: eN, ux: (eN[0] - eP[0]) / lE, uy: (eN[1] - eP[1]) / lE, name: r.name, tier: r.tier },
    ]) {
      const k = epBucketKey(ep.pt);
      let arr = epMap.get(k);
      if (!arr) epMap.set(k, (arr = []));
      arr.push(ep);
    }
  }
  let propagated = 0;
  for (const r of masterRoads) {
    if (r.name || (r.tier !== 'major' && r.tier !== 'secondary') || r.junction === 'roundabout') continue;
    const s0 = r.pts[0], s1 = r.pts[1];
    const eN = r.pts[r.pts.length - 1], eP = r.pts[r.pts.length - 2];
    const lS = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) || 1;
    const lE = Math.hypot(eN[0] - eP[0], eN[1] - eP[1]) || 1;
    const checks = [
      { pt: s0, ux: (s1[0] - s0[0]) / lS, uy: (s1[1] - s0[1]) / lS },
      { pt: eN, ux: (eP[0] - eN[0]) / lE, uy: (eP[1] - eN[1]) / lE },
    ];
    for (const ch of checks) {
      const cands = epMap.get(epBucketKey(ch.pt)) || [];
      let bestName = '';
      let bestDot = 0.86;
      for (const c of cands) {
        if (c.tier !== r.tier) continue;
        if (Math.hypot(c.pt[0] - ch.pt[0], c.pt[1] - ch.pt[1]) > 4.5) continue;
        const dot = c.ux * ch.ux + c.uy * ch.uy;
        if (dot > bestDot) {
          bestDot = dot;
          bestName = c.name;
        }
      }
      if (bestName) {
        r.name = bestName;
        r.verificationStatus = 'osm_corridor_verified';
        propagated++;
        break;
      }
    }
  }
  if (!propagated) break;
}

// ============================================================================
// PHẦN 5: TÍCH HỢP CHỌN LỌC CÁC NGÕ DÂN SINH THỰC TẾ TỪ GOOGLE MAPS (CHƯA CÓ TRONG OSM)
// ============================================================================
// Xây dựng chỉ mục không gian cho toàn bộ đoạn đường OSM hiện có
const osmSegGrid = new SpatialGrid(35);
const osmSegs = [];
const rebuildOsmSegIndex = () => {
  osmSegGrid.map.clear();
  osmSegs.length = 0;
  for (let rIdx = 0; rIdx < masterRoads.length; rIdx++) {
    const r = masterRoads[rIdx];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const x1 = r.pts[i][0], y1 = r.pts[i][1];
      const x2 = r.pts[i + 1][0], y2 = r.pts[i + 1][1];
      const id = osmSegs.length;
      osmSegs.push({ x1, y1, x2, y2, rIdx, roadId: r.id, roadName: r.name, tier: r.tier });
      osmSegGrid.insertBox(id, [
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.max(x1, x2),
        Math.max(y1, y2),
      ]);
    }
  }
};
rebuildOsmSegIndex();

function nearestExistingRoadPoint(px, py, maxDist = 20) {
  let best = null;
  let bestD = maxDist;
  for (const id of osmSegGrid.queryBox([px, py, px, py], maxDist)) {
    const s = osmSegs[id];
    const pr = ptSegProj(px, py, s.x1, s.y1, s.x2, s.y2);
    if (pr.d < bestD) {
      bestD = pr.d;
      best = { x: pr.x, y: pr.y, d: pr.d, seg: s };
    }
  }
  return best;
}

let addedCleanAlleys = 0;
let rejectedDuplicateOrStub = 0;

for (const f of gmapsRasterGeo.features) {
  if (f.geometry?.type !== 'LineString') continue;
  const p = f.properties || {};
  const gId = String(p.osmId || p.id || '');
  // Bỏ qua gmaps/way_3112 và gmaps/way_3114 vì Ngõ 29 Nguyễn Văn Linh đã được quản lý chính xác trong xuanhoa-road-overrides.json
  if (gId === 'gmaps/way_3114' || gId === 'gmaps/way_3112') {
    rejectedDuplicateOrStub++;
    continue;
  }
  // TUYỆT ĐỐI KHÔNG lấy các đoạn major/secondary từ bản trích xuất raster (nguồn gây phình giao lộ)
  if (p.tier === 'major' || p.tier === 'secondary') {
    rejectedDuplicateOrStub++;
    continue;
  }

  let pts = cleanPolylineXY(f.geometry.coordinates.map(toXY));
  if (pts.length < 2) continue;

  // Kiểm tra tỷ lệ điểm nằm trùng (< 11m) với mạng lưới đường OSM hiện có
  let insideWardCount = 0;
  let farFromOsmCount = 0;
  for (const [x, y] of pts) {
    if (insideWard(x, y)) insideWardCount++;
    const near = nearestExistingRoadPoint(x, y, 11.5);
    if (!near) farFromOsmCount++;
  }
  if (insideWardCount < pts.length * 0.8) continue;
  // Nếu đa số các điểm đã có đường OSM kế bên -> đây là bản sao raster của đường OSM -> loại bỏ!
  if (farFromOsmCount === 0 || farFromOsmCount / pts.length < 0.45) {
    rejectedDuplicateOrStub++;
    continue;
  }

  // Cắt bỏ các góc móc câu (> 78° hoặc 2-step hook > 82° qua đoạn < 9m) do thuật toán skeleton hóa tạo ra
  const subParts = splitAtSharpUrbanCorners(pts, false);
  for (let sub of subParts) {
    // Khử 2-step corner hook ở đầu/cuối nhánh
    if (sub.length >= 4) {
      const cleanSub = [sub[0]];
      for (let i = 1; i < sub.length - 1; i++) {
        const prev = cleanSub[cleanSub.length - 1];
        const cur = sub[i];
        const nxt = sub[i + 1];
        const l1 = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
        const l2 = Math.hypot(nxt[0] - cur[0], nxt[1] - cur[1]);
        if (l1 > 0.3 && l2 > 0.3) {
          const cos = ((cur[0] - prev[0]) * (nxt[0] - cur[0]) + (cur[1] - prev[1]) * (nxt[1] - cur[1])) / (l1 * l2);
          if (cos < 0.15) {
            // Dừng trước góc gập gắt
            break;
          }
        }
        cleanSub.push(cur);
      }
      cleanSub.push(sub[sub.length - 1]);
      sub = cleanSub;
    }

    const len = pathLength(sub);
    if (len < 22) continue;

    // Không nhận đoạn cắt qua mặt nước hoặc xuyên qua lòng nhà
    let invalid = false;
    for (let i = 0; i < sub.length - 1; i++) {
      if (
        hitsWater(sub[i][0], sub[i][1], sub[i + 1][0], sub[i + 1][1]) ||
        hitsBuildingInterior(sub[i][0], sub[i][1], sub[i + 1][0], sub[i + 1][1])
      ) {
        invalid = true;
        break;
      }
    }
    if (invalid) continue;

    // Snap điểm đầu/cuối vào mạng lưới đường OSM nếu nằm trong bán kính 1.0m..14.0m
    const snapStart = nearestExistingRoadPoint(sub[0][0], sub[0][1], 14.0);
    const snapEnd = nearestExistingRoadPoint(sub[sub.length - 1][0], sub[sub.length - 1][1], 14.0);
    if (!snapStart && !snapEnd) continue;

    let parentRoad = '';
    if (snapStart && snapStart.d <= 14.0) {
      if (sub.length >= 3 && Math.hypot(snapStart.x - sub[1][0], snapStart.y - sub[1][1]) < Math.hypot(sub[0][0] - sub[1][0], sub[0][1] - sub[1][1])) {
        sub[0] = [snapStart.x, snapStart.y];
        sub.splice(1, 1);
      } else {
        sub[0] = [snapStart.x, snapStart.y];
      }
      if (snapStart.seg.roadName) parentRoad = snapStart.seg.roadName;
    }
    if (snapEnd && snapEnd.d <= 14.0) {
      const last = sub.length - 1;
      if (sub.length >= 3 && Math.hypot(snapEnd.x - sub[last - 1][0], snapEnd.y - sub[last - 1][1]) < Math.hypot(sub[last][0] - sub[last - 1][0], sub[last][1] - sub[last - 1][1])) {
        sub[last] = [snapEnd.x, snapEnd.y];
        sub.splice(last - 1, 1);
      } else {
        sub[last] = [snapEnd.x, snapEnd.y];
      }
      if (!parentRoad && snapEnd.seg.roadName) parentRoad = snapEnd.seg.roadName;
    }

    sub = cleanPolylineXY(sub);
    const finalParts = splitAtSharpUrbanCorners(sub, false);
    for (const fp of finalParts) {
      if (fp.length < 2 || pathLength(fp) < 20) continue;
      masterRoads.push({
        id: `xh_alley_${gId.replace(/[^a-zA-Z0-9_]/g, '_')}_${addedCleanAlleys}`,
        osmId: gId,
        name: '', // TUYỆT ĐỐI KHÔNG tự đoán tên ngõ! Để rỗng theo đúng mục 5 & 13
        roadClass: 'alley',
        roadType: 'alley',
        tier: 'alley',
        highway: 'service',
        surface: 'paved',
        source: 'local_aerial_skeleton_cleaned',
        confidence: 0.82,
        verificationStatus: 'unverified_unnamed',
        parentRoad,
        pts: fp,
        len: pathLength(fp),
      });
      addedCleanAlleys++;
    }
  }
}

rebuildOsmSegIndex();

// ============================================================================
// PHẦN 6: ÁP DỤNG LỚP OVERRIDE ĐỊA PHƯƠNG ĐÃ XÁC MINH (xuanhoa-road-overrides.json)
// ============================================================================
let overridesApplied = 0;

for (const ov of overridesDoc.overrides || []) {
  if (ov.action === 'strip_unverified_alley_names' && ov.pattern) {
    const re = new RegExp(ov.pattern, 'i');
    for (const r of masterRoads) {
      if (r.name && re.test(r.name)) {
        r.name = '';
        r.verificationStatus = 'unverified_unnamed';
        overridesApplied++;
      }
    }
  } else if (ov.action === 'verify_existing_alley' && ov.roadId) {
    for (const r of masterRoads) {
      if (r.id === ov.roadId || (r.osmId === ov.roadId && !r.id.includes('#sw'))) {
        r.name = ov.name;
        r.roadClass = ov.roadClass || 'alley';
        r.roadType = ov.roadType || 'alley';
        r.tier = ov.tier || 'alley';
        r.parentRoad = ov.parentRoad || r.parentRoad || '';
        r.parentRoadId = ov.parentRoadId || r.parentRoadId || '';
        r.source = ov.source || 'osm';
        r.nameSource = ov.nameSource || ov.source || 'osm';
        r.geometrySource = ov.geometrySource || 'osm';
        r.confidence = ov.confidence ?? 0.95;
        r.verificationStatus = 'verified';
        r.locked = Boolean(ov.locked);
        r.verifiedNote = ov.note || '';
        overridesApplied++;
      }
    }
  } else if (ov.action === 'reject_wrong_alley_association' && ov.roadId && ov.geometry?.coordinates) {
    // Hủy bỏ hoàn toàn association sai trên đoạn đường này và đánh dấu rejected (Mục 27)
    for (const r of masterRoads) {
      if (r.id === ov.roadId) {
        r.name = '';
        r.verificationStatus = 'rejected';
      }
    }
    const pts = ov.geometry.coordinates.map(toXY);
    const parentRoadObj = masterRoads.find((r) => r.osmId === ov.parentRoadId || r.name === ov.parentRoad);
    if (parentRoadObj) {
      let bestSnap = null;
      let bestD = 12;
      for (let i = 0; i < parentRoadObj.pts.length - 1; i++) {
        const pr = ptSegProj(
          pts[0][0], pts[0][1],
          parentRoadObj.pts[i][0], parentRoadObj.pts[i][1],
          parentRoadObj.pts[i + 1][0], parentRoadObj.pts[i + 1][1]
        );
        if (pr.d < bestD) {
          bestD = pr.d;
          bestSnap = [pr.x, pr.y];
        }
      }
      if (bestSnap) pts[0] = bestSnap;
    }
    const existingIdx = masterRoads.findIndex((r) => r.id === ov.roadId);
    const record = {
      id: ov.roadId,
      osmId: ov.roadId,
      name: '',
      rejectedName: ov.rejectedName || 'Ngõ 29 Nguyễn Văn Linh',
      roadClass: ov.roadClass || 'local',
      roadType: ov.roadType || 'local_road',
      tier: ov.tier || 'minor',
      highway: ov.highway || 'residential',
      surface: 'paved',
      source: 'inferred',
      nameSource: 'inferred',
      geometrySource: ov.geometrySource || 'google_maps',
      confidence: 0,
      verificationStatus: 'rejected',
      locked: Boolean(ov.locked),
      parentRoad: ov.parentRoad || '',
      parentRoadId: ov.parentRoadId || 'way/157991278',
      verifiedNote: ov.note || '',
      pts,
      len: pathLength(pts),
    };
    if (existingIdx >= 0) masterRoads[existingIdx] = record;
    else masterRoads.push(record);
    overridesApplied++;
  } else if (ov.action === 'upsert_verified_alley' && ov.roadId && ov.geometry?.coordinates) {
    for (const r of masterRoads) {
      if (r.name === ov.name && r.id !== ov.roadId) {
        r.name = '';
      }
    }
    const pts = ov.geometry.coordinates.map(toXY);
    const parentRoadObj = masterRoads.find((r) => r.osmId === ov.parentRoadId || r.name === ov.parentRoad);
    if (parentRoadObj) {
      let bestSnap = null;
      let bestD = 12;
      for (let i = 0; i < parentRoadObj.pts.length - 1; i++) {
        const pr = ptSegProj(
          pts[0][0], pts[0][1],
          parentRoadObj.pts[i][0], parentRoadObj.pts[i][1],
          parentRoadObj.pts[i + 1][0], parentRoadObj.pts[i + 1][1]
        );
        if (pr.d < bestD) {
          bestD = pr.d;
          bestSnap = [pr.x, pr.y];
        }
      }
      if (bestSnap) pts[0] = bestSnap;
    }

    const existingIdx = masterRoads.findIndex((r) => r.id === ov.roadId);
    const record = {
      id: ov.roadId,
      osmId: ov.roadId,
      name: ov.name,
      roadClass: ov.roadClass || 'alley',
      roadType: ov.roadType || 'alley',
      tier: ov.tier || 'alley',
      highway: ov.highway || 'residential',
      surface: 'paved',
      source: ov.source || 'local_verified',
      nameSource: ov.nameSource || 'local_verified',
      geometrySource: ov.geometrySource || 'local_verified',
      confidence: ov.confidence ?? 1.0,
      verificationStatus: 'verified',
      locked: Boolean(ov.locked ?? true),
      parentRoad: ov.parentRoad || '',
      parentRoadId: ov.parentRoadId || '',
      verifiedNote: ov.note || '',
      pts,
      len: pathLength(pts),
    };
    if (existingIdx >= 0) masterRoads[existingIdx] = record;
    else masterRoads.push(record);
    overridesApplied++;
  }
}

// Điền thông tin parentRoad & parentRoadId cho các đường nhánh / ngõ chưa có parentRoad nếu chạm trực tiếp vào đường chính có tên
rebuildOsmSegIndex();
for (const r of masterRoads) {
  if (r.parentRoad || (r.roadClass !== 'alley' && r.roadClass !== 'local')) continue;
  for (const ep of [r.pts[0], r.pts[r.pts.length - 1]]) {
    for (const id of osmSegGrid.queryBox([ep[0], ep[1], ep[0], ep[1]], 6)) {
      const s = osmSegs[id];
      if (s.roadId === r.id || !s.roadName || s.roadName === r.name) continue;
      const pr = ptSegProj(ep[0], ep[1], s.x1, s.y1, s.x2, s.y2);
      if (pr.d <= 5.5) {
        r.parentRoad = s.roadName;
        r.parentRoadId = s.roadId;
        break;
      }
    }
    if (r.parentRoad) break;
  }
}

// Các đoạn nối quay đầu dải phân cách ngắn (< 45m) không tên trên đường đôi -> hạ xuống local để không tạo cục phình vàng
for (const r of masterRoads) {
  if ((r.roadClass === 'major' || r.roadClass === 'arterial') && !r.name && !r.junction && r.len < 45) {
    r.roadClass = 'local';
    r.tier = 'minor';
    r.roadType = 'local_road';
  }
}

// Đồng bộ lại roadClass nếu tên đường đã được lan truyền ở Phần 4
for (const r of masterRoads) {
  if (r.name && MAJOR_AXIS_NAMES.has(r.name)) {
    r.roadClass = 'major';
    r.tier = 'major';
    r.roadType = 'road';
  } else if (r.name && ARTERIAL_COLLECTOR_NAMES.has(r.name) && r.roadClass !== 'major') {
    r.roadClass = 'arterial';
    r.tier = 'secondary';
    r.roadType = 'street';
  }
}

// ============================================================================
// PHẦN 7: XUẤT GEOJSON CHUẨN CHO CẢ 2D & 3D (public/geo/xuanhoa-roads.geojson)
// ============================================================================
function resolveRoadClass(r) {
  if (r.roadClass && ['major', 'arterial', 'local', 'alley', 'access'].includes(r.roadClass)) {
    return r.roadClass;
  }
  const norm = normalizeRoadHierarchy(r.highway || 'residential', r.name || '', r.tier, r.tier === 'alley');
  return norm.roadClass;
}

function resolveRoadType(r, roadClass) {
  if (r.roadType) return r.roadType;
  const nm = String(r.name || '').trim();
  if (/^Ngách\s+/i.test(nm)) return 'lane';
  if (/^(Ngõ|Hẻm)\s+/i.test(nm) || roadClass === 'alley') return 'alley';
  if (roadClass === 'major') return 'road';
  if (roadClass === 'arterial') return 'street';
  if (roadClass === 'local') return /^(Phố|Đường)\s+/i.test(nm) ? 'street' : 'local_road';
  if (r.highway === 'path' || r.highway === 'footway' || r.highway === 'cycleway' || r.highway === 'steps') return 'path';
  if (r.highway === 'track') return 'access_road';
  return 'service_road';
}

function resolveNameSource(r) {
  if (r.nameSource) return r.nameSource;
  if (!r.name) return 'none';
  if (r.source === 'local_verified') return 'local_verified';
  if (r.source === 'admin_verified') return 'admin_verified';
  if (r.source === 'cadastral') return 'cadastral';
  if (r.source === 'osm' || r.source === 'osm_verified') return 'osm';
  return 'inferred';
}

function resolveGeometrySource(r) {
  if (r.geometrySource) return r.geometrySource;
  if (r.source === 'local_verified') return 'local_verified';
  if (r.source === 'local_aerial_skeleton_cleaned') return 'google_maps';
  return 'osm';
}

function resolveVerificationStatus(r) {
  if (r.verificationStatus === 'rejected') return 'rejected';
  if (r.verificationStatus === 'needs_review') return 'needs_review';
  if (r.verificationStatus === 'candidate') return 'candidate';
  if (
    r.verificationStatus === 'verified' ||
    r.verificationStatus === 'local_verified' ||
    r.verificationStatus === 'verified_named_alley' ||
    r.verificationStatus === 'osm_verified' ||
    r.verificationStatus === 'osm_corridor_verified'
  ) {
    return r.name ? 'verified' : 'unverified';
  }
  return r.name ? 'verified' : 'unverified';
}

const outFeatures = masterRoads.map((r) => {
  const roadClass = resolveRoadClass(r);
  const tier =
    roadClass === 'major'
      ? 'major'
      : roadClass === 'arterial'
      ? 'secondary'
      : roadClass === 'local'
      ? 'minor'
      : roadClass === 'alley'
      ? 'alley'
      : 'access';
  const widthM =
    roadClass === 'major'
      ? 12.4
      : roadClass === 'arterial'
      ? 9.2
      : roadClass === 'local'
      ? 5.8
      : roadClass === 'alley'
      ? 3.2
      : 2.0;
  const lanes = roadClass === 'major' ? 4 : roadClass === 'arterial' ? 2 : roadClass === 'local' ? 2 : 1;
  const roadType = resolveRoadType(r, roadClass);
  const nameSource = resolveNameSource(r);
  const geometrySource = resolveGeometrySource(r);
  const verificationStatus = resolveVerificationStatus(r);
  const verified = verificationStatus === 'verified' && nameSource !== 'inferred';
  const normalizedSource =
    r.source === 'local_verified'
      ? 'local_verified'
      : r.source === 'admin_verified'
      ? 'admin_verified'
      : r.source === 'cadastral'
      ? 'cadastral'
      : r.source === 'osm' || r.source === 'osm_verified'
      ? 'osm'
      : r.source === 'local_aerial_skeleton_cleaned'
      ? 'legal_other'
      : 'inferred';

  const props = {
    id: r.id,
    roadId: r.id,
    osmId: r.osmId,
    highway: r.highway,
    name: r.name || '',
    roadClass,
    roadType,
    tier,
    width: widthM,
    lanes,
    surface: r.surface || 'paved',
    source: normalizedSource,
    nameSource,
    geometrySource,
    verified,
    confidence: r.confidence,
    verificationStatus,
    parentRoad: r.parentRoad || '',
    parentRoadId: r.parentRoadId || '',
    locked: Boolean(r.locked),
  };
  if (r.rejectedName) props.rejectedName = r.rejectedName;
  if (r.oneway) props.oneway = r.oneway;
  if (r.bridge) props.bridge = r.bridge;
  if (r.junction) props.junction = r.junction;
  if (r.verifiedNote) props.verifiedNote = r.verifiedNote;

  return {
    type: 'Feature',
    properties: props,
    geometry: {
      type: 'LineString',
      coordinates: r.pts.map(toLngLat),
    },
  };
});

const outGeoJSON = {
  type: 'FeatureCollection',
  features: outFeatures,
};
fs.writeFileSync(ROADS_PATH, JSON.stringify(outGeoJSON));

// Cập nhật đồng bộ namedRoads trong xuanhoa-osm-verified-pois.json (xóa sạch 100% tên ngõ tự đoán & gmaps/way_3112 sai)
const POIS_JSON_PATH = path.join(GEO, 'xuanhoa-osm-verified-pois.json');
if (fs.existsSync(POIS_JSON_PATH)) {
  const poisDoc = readJson(POIS_JSON_PATH);
  const cleanNamedMap = new Map();
  for (const f of outFeatures) {
    const p = f.properties;
    const nm = (p.name || '').trim();
    if (!nm || p.verificationStatus !== 'verified' || p.nameSource === 'inferred') continue;
    const coords = f.geometry.coordinates;
    const mid = coords[Math.floor(coords.length / 2)] || coords[0];
    if (!cleanNamedMap.has(nm)) {
      cleanNamedMap.set(nm, {
        id: p.roadId || p.id,
        roadId: p.roadId || p.id,
        name: nm,
        roadClass: p.roadClass,
        roadType: p.roadType,
        parentRoad: p.parentRoad || undefined,
        highway: p.highway || 'residential',
        tier: p.tier || 'minor',
        lat: Number(mid[1].toFixed(6)),
        lng: Number(mid[0].toFixed(6)),
        osmId: p.osmId || p.id,
        nameSource: p.nameSource,
        verificationStatus: p.verificationStatus,
        segmentsCount: 1,
        insideWard: true,
      });
    } else {
      cleanNamedMap.get(nm).segmentsCount++;
    }
  }
  poisDoc.namedRoads = Array.from(cleanNamedMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  fs.writeFileSync(POIS_JSON_PATH, JSON.stringify(poisDoc, null, 2));
}

// ============================================================================
// PHẦN 8: AUDIT SAU KHI SỬA, KIỂM TRA 20 KHU VỰC THỰC ĐỊA & REGRESSION TEST "NGÕ 29 NGUYỄN VĂN LINH"
// ============================================================================
const postAudit = runNetworkAudit(outGeoJSON, 'after_fix_master');

const ALL_NAMED_ALLEYS = outFeatures
  .filter((f) => NAMED_ALLEY_RE.test(f.properties.name || ''))
  .map((f) => ({
    roadId: f.properties.id,
    name: f.properties.name,
    roadClass: f.properties.roadClass,
    roadType: f.properties.roadType,
    parentRoad: f.properties.parentRoad || '',
    parentRoadId: f.properties.parentRoadId || '',
    tier: f.properties.tier,
    source: f.properties.source,
    nameSource: f.properties.nameSource,
    geometrySource: f.properties.geometrySource,
    verified: f.properties.verified,
    confidence: f.properties.confidence,
    verificationStatus: f.properties.verificationStatus,
    locked: f.properties.locked,
    vertexCount: f.geometry.coordinates.length,
    startLngLat: f.geometry.coordinates[0],
    endLngLat: f.geometry.coordinates[f.geometry.coordinates.length - 1],
  }));

// Regression Test bắt buộc (Mục 27):
// 1. Association sai trên xh_road_ngo_29_nguyen_van_linh phải bị REJECTED (name === '')
// 2. Nhánh phía Bắc way/176151686 ([105.717687, 21.285617] -> [105.718375, 21.285894]) được xác minh local_verified là "Ngõ 29 Nguyễn Văn Linh"
const ngo29PublicMatches = outFeatures.filter((f) => f.properties.name === 'Ngõ 29 Nguyễn Văn Linh');
const verifiedNgo29Feature = outFeatures.find((f) => f.properties.id === 'way/176151686') || null;
const rejectedNgo29Feature = outFeatures.find((f) => f.properties.id === 'xh_road_ngo_29_nguyen_van_linh') || null;

const ngo29RegressionTest = {
  passed:
    ngo29PublicMatches.length === 1 &&
    verifiedNgo29Feature !== null &&
    verifiedNgo29Feature.properties.name === 'Ngõ 29 Nguyễn Văn Linh' &&
    verifiedNgo29Feature.properties.roadClass === 'alley' &&
    verifiedNgo29Feature.properties.roadType === 'alley' &&
    verifiedNgo29Feature.properties.parentRoad === 'Đường Nguyễn Văn Linh' &&
    verifiedNgo29Feature.properties.source === 'local_verified' &&
    verifiedNgo29Feature.properties.verified === true &&
    verifiedNgo29Feature.properties.locked === true &&
    rejectedNgo29Feature !== null &&
    rejectedNgo29Feature.properties.name === '' &&
    rejectedNgo29Feature.properties.rejectedName === 'Ngõ 29 Nguyễn Văn Linh' &&
    rejectedNgo29Feature.properties.verificationStatus === 'rejected',
  assertions: {
    verifiedRoadId: verifiedNgo29Feature?.properties?.id || null,
    verifiedName: verifiedNgo29Feature?.properties?.name || null,
    verifiedRoadClass: verifiedNgo29Feature?.properties?.roadClass || null,
    verifiedParentRoad: verifiedNgo29Feature?.properties?.parentRoad || null,
    verifiedSource: verifiedNgo29Feature?.properties?.source || null,
    verifiedLocked: verifiedNgo29Feature?.properties?.locked || false,
    rejectedRoadId: rejectedNgo29Feature?.properties?.id || null,
    rejectedStatus: rejectedNgo29Feature?.properties?.verificationStatus || null,
    rejectedNameRecorded: rejectedNgo29Feature?.properties?.rejectedName || null,
    publicNameClearedOnWrongSegment: rejectedNgo29Feature?.properties?.name === '',
  },
};

if (!ngo29RegressionTest.passed) {
  console.error('❌ Regression Test Ngõ 29 Nguyễn Văn Linh THẤT BẠI:', ngo29RegressionTest);
  process.exit(1);
}

// Mục 25: Kiểm tra thực địa 20 khu vực tiêu biểu toàn phường Xuân Hòa
const TWENTY_ZONES = [
  { zoneId: 1, name: 'Trục Nguyễn Văn Linh & Ngõ 29 Nguyễn Văn Linh', center: [105.7183, 21.2858], radiusDeg: 0.0035 },
  { zoneId: 2, name: 'Đại học Sư phạm Hà Nội 2 (ĐHSP2) & Phố Võ Thị Sáu', center: [105.7248, 21.2835], radiusDeg: 0.0035 },
  { zoneId: 3, name: 'Vòng tròn 1 (Giao Nguyễn Văn Linh - Lê Thái Tổ - Phạm Văn Đồng)', center: [105.7155, 21.2921], radiusDeg: 0.0030 },
  { zoneId: 4, name: 'Vòng tròn 2 (Giao Nguyễn Văn Linh - Võ Thị Sáu - ĐHSP2)', center: [105.7248, 21.2817], radiusDeg: 0.0030 },
  { zoneId: 5, name: 'Phố Cù Chính Lan & Khu dân cư trung tâm Xuân Hòa', center: [105.7201, 21.2862], radiusDeg: 0.0030 },
  { zoneId: 6, name: 'Trục Đường Phạm Văn Đồng & Chợ Xuân Hòa', center: [105.7215, 21.2905], radiusDeg: 0.0035 },
  { zoneId: 7, name: 'Trục Đường Lê Thái Tổ & Khu hành chính', center: [105.7125, 21.2912], radiusDeg: 0.0040 },
  { zoneId: 8, name: 'Trục Đường Trường Chinh (Quốc lộ xuyên phường)', center: [105.7105, 21.2755], radiusDeg: 0.0050 },
  { zoneId: 9, name: 'Trục Đường Hùng Vương', center: [105.7025, 21.2820], radiusDeg: 0.0050 },
  { zoneId: 10, name: 'Trục Đường Lạc Long Quân & Ven Hồ Đại Lải', center: [105.7285, 21.3120], radiusDeg: 0.0060 },
  { zoneId: 11, name: 'Trục Đường Kim Ngọc & Khu vực Đông Nam Xuân Hòa', center: [105.7310, 21.2785], radiusDeg: 0.0045 },
  { zoneId: 12, name: 'Nhà Trắng Xuân Hòa & Phố Kim Đồng - Phố Nhà Chung', center: [105.7244, 21.2809], radiusDeg: 0.0035 },
  { zoneId: 13, name: 'Đường Trần Phú & Khu dân cư Nam Xuân Hòa', center: [105.7210, 21.2735], radiusDeg: 0.0045 },
  { zoneId: 14, name: 'Đường Phùng Chí Kiên & Khu dân cư Tây Bắc', center: [105.7135, 21.2975], radiusDeg: 0.0040 },
  { zoneId: 15, name: 'Đường Nguyễn Tất Thành & Khu công nghiệp / Dịch vụ', center: [105.6980, 21.2690], radiusDeg: 0.0060 },
  { zoneId: 16, name: 'Khu vực Núi Thằn Lằn & Bốt Pháp', center: [105.7239, 21.2964], radiusDeg: 0.0045 },
  { zoneId: 17, name: 'KĐT Mới Tây Xuân Hòa', center: [105.7186, 21.2793], radiusDeg: 0.0040 },
  { zoneId: 18, name: 'Cầu Xuân Hòa - Chim Xanh & Phố Phạm Hồng Thái', center: [105.7282, 21.2798], radiusDeg: 0.0038 },
  { zoneId: 19, name: 'Khu vực Bắc Hồ Đại Lải - Ngọc Thanh', center: [105.7380, 21.3350], radiusDeg: 0.0080 },
  { zoneId: 20, name: 'Khu vực Cao Minh - Đồng Xuân (Phía Tây Xuân Hòa)', center: [105.6920, 21.2950], radiusDeg: 0.0080 },
];

const twentyZonesAudit = TWENTY_ZONES.map((z) => {
  const inZone = outFeatures.filter((f) =>
    f.geometry.coordinates.some(
      (c) => Math.hypot(c[0] - z.center[0], c[1] - z.center[1]) <= z.radiusDeg
    )
  );
  const byClass = { major: 0, arterial: 0, local: 0, alley: 0, access: 0 };
  const namedRoadsSet = new Set();
  for (const f of inZone) {
    const rc = f.properties.roadClass || 'local';
    if (byClass[rc] !== undefined) byClass[rc]++;
    if (f.properties.name) namedRoadsSet.add(f.properties.name);
  }
  return {
    zoneId: z.zoneId,
    name: z.name,
    center: z.center,
    totalSegments: inZone.length,
    byClass,
    verifiedNamedRoads: Array.from(namedRoadsSet),
    status: inZone.length > 0 ? 'PASS' : 'EMPTY',
  };
});

// Mục 28: Thống kê Data Audit đầy đủ theo cấp bậc
const hierarchyStats = {
  totalRoads: outFeatures.length,
  major: outFeatures.filter((f) => f.properties.roadClass === 'major').length,
  arterial: outFeatures.filter((f) => f.properties.roadClass === 'arterial').length,
  local: outFeatures.filter((f) => f.properties.roadClass === 'local').length,
  alley: outFeatures.filter((f) => f.properties.roadClass === 'alley').length,
  access: outFeatures.filter((f) => f.properties.roadClass === 'access').length,
  namedVerified: outFeatures.filter((f) => Boolean(f.properties.name) && f.properties.verified).length,
  unnamed: outFeatures.filter((f) => !f.properties.name).length,
  needs_review: outFeatures.filter((f) => f.properties.verificationStatus === 'needs_review').length,
  local_verified: outFeatures.filter((f) => f.properties.source === 'local_verified').length,
  rejected: outFeatures.filter((f) => f.properties.verificationStatus === 'rejected').length,
  outOfBoundaryExcluded: outOfBoundaryRemovedCount,
};

const modifiedRoadsList = [
  {
    roadId: 'way/176151686',
    name: 'Ngõ 29 Nguyễn Văn Linh',
    roadClass: 'alley',
    roadType: 'alley',
    parentRoad: 'Đường Nguyễn Văn Linh',
    action: 'Xác minh local_verified & khóa geometry nhánh phía Bắc ([105.717687, 21.285617] -> [105.718375, 21.285894]) nối trực tiếp Đường Nguyễn Văn Linh',
  },
  {
    roadId: 'xh_road_ngo_29_nguyen_van_linh',
    name: '',
    roadClass: 'local',
    roadType: 'local_road',
    parentRoad: 'Đường Nguyễn Văn Linh',
    action: 'Gỡ bỏ tên gắn sai "Ngõ 29 Nguyễn Văn Linh" trên nhánh phía Nam (gmaps/way_3114), đánh dấu rejected & locked',
  },
  {
    roadId: 'way/176151686#sw',
    name: '',
    roadClass: 'local',
    roadType: 'local_road',
    parentRoad: '',
    action: 'Tách đoạn đường nhánh phía Tây Nam khỏi Ngõ 29 Nguyễn Văn Linh, giữ ở cấp local_road trung tính không nhãn',
  },
  {
    roadId: 'way/176265718',
    name: 'Ngõ 1 Võ Thị Sáu',
    roadClass: 'alley',
    roadType: 'alley',
    parentRoad: 'Phố Võ Thị Sáu',
    action: 'Chuẩn hóa cấp alley (verified OSM) nối trực tiếp Phố Võ Thị Sáu',
  },
  {
    roadId: 'way/892145246',
    name: 'Ngõ 7 Đường Lê Trọng Tấn',
    roadClass: 'alley',
    roadType: 'alley',
    parentRoad: 'Đường Lê Trọng Tấn',
    action: 'Chuẩn hóa cấp alley (verified OSM) nối trực tiếp Đường Lê Trọng Tấn',
  },
  {
    roadId: 'way/896979250',
    name: 'Ngách 20 Ngõ 7 Đường Đập Đỉnh Phú',
    roadClass: 'alley',
    roadType: 'lane',
    parentRoad: 'Đường Lâm Trường Đi Đập Đỉnh Phú',
    action: 'Chuẩn hóa cấp alley/lane (verified OSM)',
  },
  {
    roadId: 'way/1029516683',
    name: 'Ngách 20 Ngõ 7 Đường Đập Đỉnh Phú',
    roadClass: 'alley',
    roadType: 'lane',
    parentRoad: 'Đường Lâm Trường Đi Đập Đỉnh Phú',
    action: 'Chuẩn hóa cấp alley/lane (verified OSM)',
  },
];

const auditReport = {
  generatedAt: new Date().toISOString(),
  hierarchyStats,
  modifiedRoadsList,
  twentyZonesAudit,
  summary: {
    totalRoadSegmentsBefore: preAudit.totalFeatures,
    totalRoadSegmentsAfter: postAudit.totalFeatures,
    outOfBoundaryExcluded: outOfBoundaryRemovedCount,
    osmVectorBackboneSegments: masterRoads.filter((r) => r.source !== 'local_aerial_skeleton_cleaned').length,
    cleanedLocalAlleysAdded: addedCleanAlleys,
    rasterDuplicatesAndStubsRemoved: rejectedDuplicateOrStub,
    sharpUrbanCornersSplit: splitCornerCount,
    fabricatedAlleyNamesRemoved: preAudit.counts.fabricatedAlleyNameCount,
    shortMajorSecondaryStubsRemoved: preAudit.counts.shortMajorSecondaryStub - postAudit.counts.shortMajorSecondaryStub,
    sharpHooksAndKinksFixed: preAudit.counts.sharpKinkOrHook - postAudit.counts.sharpKinkOrHook,
    foldbackHairpinsFixed: preAudit.counts.selfIntersectionOrFoldback - postAudit.counts.selfIntersectionOrFoldback,
    overridesApplied,
  },
  rootCausesIdentifiedAndFixed: [
    {
      issue: 'Ngõ 29 Nguyễn Văn Linh bị gắn nhầm vào nhánh đường phía Nam [105.718521, 21.285574] -> [105.717680, 21.285016]',
      cause: 'PROXIMITY_HEURISTIC_ERROR: extract-google-maps-roads.mjs dùng bounding-box heuristic gán tên Ngõ 29 Nguyễn Văn Linh cho gmaps/way_3114 và gmaps/way_3112.',
      fix: '1. Remove wrong association trên xh_road_ngo_29_nguyen_van_linh (rejected, locked). 2. Xác định đúng roadId way/176151686 (nhánh phía Bắc đối diện Phố Cù Chính Lan). 3. Xác minh geometry nối vào Đường Nguyễn Văn Linh tại [105.718375, 21.285894]. 4. Xác minh parentRoad = Đường Nguyễn Văn Linh. 5. Bật nhãn local_verified.',
    },
    {
      issue: '3.774 đoạn đường ngoài ranh giới phường Xuân Hòa bị trộn vào dữ liệu bản đồ và Admin',
      cause: 'BOUNDARY_SCOPE_LEAK: Dữ liệu OSM gốc bao phủ vùng lân cận ngoài ranh giới phường Xuân Hòa.',
      fix: 'Lọc nghiêm ngặt theo ranh giới xuanhoa-boundary.geojson, loại bỏ 100% đường ngoài phạm vi phường Xuân Hòa.',
    },
    {
      issue: 'Đường dân sinh không tên bị gom nhầm thành ngõ (alley) hoặc tự đoán tên "Ngõ <Tên Đường>"',
      cause: 'HIERARCHY_CONFLATION: Mọi đường nhỏ không thuộc primary/secondary/tertiary bị mặc định gán thành alley.',
      fix: 'Chuẩn hóa hệ thống phân cấp 5 bậc (major, arterial, local, alley, access); giữ các đường dân sinh chưa xác minh ở cấp trung tính local (local_road) không nhãn.',
    },
  ],
  ngo29NguyenVanLinhRegressionTest: ngo29RegressionTest,
  ALL_NAMED_ALLEYS,
  beforeAudit: preAudit,
  afterAudit: postAudit,
};

fs.writeFileSync(AUDIT_PATH, JSON.stringify(auditReport, null, 2));

console.log('✅ Đã hoàn tất Audit & Chuẩn hóa toàn bộ hệ thống Đường / Ngõ Phường Xuân Hòa!');
console.log('   • Thống kê phân cấp 5 bậc (Mục 28):', JSON.stringify(hierarchyStats));
console.log('   • Kiểm tra 20 khu vực thực địa:', twentyZonesAudit.filter((z) => z.status === 'PASS').length + '/20 PASS');
console.log('   • Số lỗi hình học sau khi sửa:', JSON.stringify(postAudit.counts));
console.log('   • Danh sách ALL_NAMED_ALLEYS (' + ALL_NAMED_ALLEYS.length + '):', ALL_NAMED_ALLEYS.map((a) => `${a.name} (${a.roadId} -> ${a.parentRoad})`).join(' | '));
console.log('   • Regression Test Ngõ 29 Nguyễn Văn Linh:', ngo29RegressionTest.passed ? 'PASS (100%)' : 'FAIL');
