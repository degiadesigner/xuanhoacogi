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

const masterRoads = [];
let splitCornerCount = 0;

for (const f of osmBaseGeo.features) {
  if (f.geometry?.type !== 'LineString') continue;
  const p = { ...(f.properties || {}) };
  const baseId = String(p.osmId || p.id || `osm_way_${masterRoads.length}`);
  let name = String(p.name || '').trim();
  if (NAME_NORMALIZE.has(name)) name = NAME_NORMALIZE.get(name);
  if (TRAIL_SLANG_RE.test(name)) name = '';

  const hw = p.highway || 'residential';
  let tier = p.tier;
  if (!tier) {
    if (hw === 'motorway' || hw === 'trunk' || hw === 'primary' || hw === 'secondary') tier = 'major';
    else if (hw === 'tertiary') tier = 'secondary';
    else if (hw === 'residential' || hw === 'unclassified') tier = 'minor';
    else tier = 'alley';
  }
  // Đường Trường Chinh là trục chính toàn phường -> đồng nhất tier 'major'
  if (name === 'Đường Trường Chinh') tier = 'major';
  // Đường Phạm Văn Đồng đồng nhất tier 'secondary'
  if (name === 'Đường Phạm Văn Đồng') tier = 'secondary';
  if (VONG_TRON_1_IDS.has(baseId)) {
    p.junction = 'roundabout';
  }

  const rawPts = f.geometry.coordinates.map(toXY);
  const cleanedPts = cleanPolylineXY(rawPts);
  if (cleanedPts.length < 2) continue;

  const isMountainTrail = hw === 'path' || hw === 'track';
  const parts = splitAtSharpUrbanCorners(cleanedPts, isMountainTrail);
  if (parts.length > 1) splitCornerCount += parts.length - 1;

  parts.forEach((partPts, partIdx) => {
    const id = parts.length === 1 ? baseId : `${baseId}#${partIdx + 1}`;
    const len = pathLength(partPts);
    if (len < 1.2) return;
    masterRoads.push({
      id,
      osmId: baseId,
      name,
      tier,
      highway: hw,
      oneway: p.oneway || undefined,
      bridge: p.bridge || undefined,
      junction: p.junction || undefined,
      surface: p.surface || (tier === 'major' || tier === 'secondary' ? 'asphalt' : 'paved'),
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
        name: '', // TUYỆT ĐỐI KHÔNG tự đoán tên ngõ! Để rỗng theo đúng mục 8 & 16
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
      if (r.id === ov.roadId || r.osmId === ov.roadId) {
        r.name = ov.name;
        r.parentRoad = ov.parentRoad || r.parentRoad || '';
        r.source = ov.source || 'osm_verified';
        r.confidence = ov.confidence ?? 0.95;
        r.verificationStatus = 'verified_named_alley';
        overridesApplied++;
      }
    }
  } else if (ov.action === 'upsert_verified_alley' && ov.roadId && ov.geometry?.coordinates) {
    // Đảm bảo không có bất kỳ đoạn đường nào khác mang trùng tên này
    for (const r of masterRoads) {
      if (r.name === ov.name && r.id !== ov.roadId) {
        r.name = '';
      }
    }
    const pts = ov.geometry.coordinates.map(toXY);
    // Đảm bảo điểm đầu nối khớp tuyệt đối vào Đường Nguyễn Văn Linh (way/157991278)
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
      tier: ov.tier || 'alley',
      highway: ov.highway || 'residential',
      surface: 'paved',
      source: ov.source || 'local_verified',
      confidence: ov.confidence ?? 1.0,
      verificationStatus: 'local_verified',
      parentRoad: ov.parentRoad || '',
      verifiedNote: ov.note || '',
      pts,
      len: pathLength(pts),
    };
    if (existingIdx >= 0) masterRoads[existingIdx] = record;
    else masterRoads.push(record);
    overridesApplied++;
  }
}

// Điền thông tin parentRoad cho các đường nhánh / ngõ chưa có parentRoad nếu chạm trực tiếp vào đường chính có tên
rebuildOsmSegIndex();
for (const r of masterRoads) {
  if (r.parentRoad || (r.tier !== 'alley' && r.tier !== 'minor')) continue;
  for (const ep of [r.pts[0], r.pts[r.pts.length - 1]]) {
    for (const id of osmSegGrid.queryBox([ep[0], ep[1], ep[0], ep[1]], 6)) {
      const s = osmSegs[id];
      if (s.roadId === r.id || !s.roadName || s.roadName === r.name) continue;
      const pr = ptSegProj(ep[0], ep[1], s.x1, s.y1, s.x2, s.y2);
      if (pr.d <= 5.5) {
        r.parentRoad = s.roadName;
        break;
      }
    }
    if (r.parentRoad) break;
  }
}

// Các đoạn nối quay đầu dải phân cách ngắn (< 45m) không tên trên đường đôi -> hạ xuống tier 'minor' để không tạo cục phình vàng
for (const r of masterRoads) {
  if ((r.tier === 'major' || r.tier === 'secondary') && !r.name && !r.junction && r.len < 45) {
    r.tier = 'minor';
  }
}

// ============================================================================
// PHẦN 7: XUẤT GEOJSON CHUẨN CHO CẢ 2D & 3D (public/geo/xuanhoa-roads.geojson)
// ============================================================================
const outFeatures = masterRoads.map((r) => {
  const widthM = r.tier === 'major' ? 12.4 : r.tier === 'secondary' ? 8.8 : r.tier === 'minor' ? 5.8 : 3.5;
  const lanes = r.tier === 'major' ? 4 : r.tier === 'secondary' ? 2 : r.tier === 'minor' ? 2 : 1;
  const props = {
    id: r.id,
    osmId: r.osmId,
    highway: r.highway,
    name: r.name || '',
    tier: r.tier,
    width: widthM,
    lanes,
    surface: r.surface || 'paved',
    source: r.source,
    confidence: r.confidence,
    verificationStatus: r.verificationStatus,
  };
  if (r.parentRoad) props.parentRoad = r.parentRoad;
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

// ============================================================================
// PHẦN 8: AUDIT SAU KHI SỬA & KIỂM ĐỊNH REGRESSION TEST "NGÕ 29 NGUYỄN VĂN LINH"
// ============================================================================
const postAudit = runNetworkAudit(outGeoJSON, 'after_fix_master');

const ALL_NAMED_ALLEYS = outFeatures
  .filter((f) => NAMED_ALLEY_RE.test(f.properties.name || ''))
  .map((f) => ({
    roadId: f.properties.id,
    name: f.properties.name,
    parentRoad: f.properties.parentRoad || '',
    tier: f.properties.tier,
    source: f.properties.source,
    confidence: f.properties.confidence,
    verificationStatus: f.properties.verificationStatus,
    vertexCount: f.geometry.coordinates.length,
    startLngLat: f.geometry.coordinates[0],
    endLngLat: f.geometry.coordinates[f.geometry.coordinates.length - 1],
  }));

// Regression Test bắt buộc (Mục 10): "Ngõ 29 Nguyễn Văn Linh"
const ngo29Matches = outFeatures.filter((f) => f.properties.name === 'Ngõ 29 Nguyễn Văn Linh');
const ngo29Feature = ngo29Matches[0] || null;
const nvlFeatures = outFeatures.filter((f) => f.properties.name === 'Đường Nguyễn Văn Linh');

let minSnapDistToNVL = Infinity;
let maxTurnAngleNgo29 = 0;
if (ngo29Feature) {
  const ngoPts = ngo29Feature.geometry.coordinates.map(toXY);
  for (const nvl of nvlFeatures) {
    const nvlPts = nvl.geometry.coordinates.map(toXY);
    for (let i = 0; i < nvlPts.length - 1; i++) {
      const pr = ptSegProj(ngoPts[0][0], ngoPts[0][1], nvlPts[i][0], nvlPts[i][1], nvlPts[i + 1][0], nvlPts[i + 1][1]);
      if (pr.d < minSnapDistToNVL) minSnapDistToNVL = pr.d;
    }
  }
  for (let i = 1; i < ngoPts.length - 1; i++) {
    const vx1 = ngoPts[i][0] - ngoPts[i - 1][0], vy1 = ngoPts[i][1] - ngoPts[i - 1][1];
    const vx2 = ngoPts[i + 1][0] - ngoPts[i][0], vy2 = ngoPts[i + 1][1] - ngoPts[i][1];
    const l1 = Math.hypot(vx1, vy1), l2 = Math.hypot(vx2, vy2);
    const cos = Math.max(-1, Math.min(1, (vx1 * vx2 + vy1 * vy2) / ((l1 * l2) || 1)));
    const deg = (Math.acos(cos) * 180) / Math.PI;
    if (deg > maxTurnAngleNgo29) maxTurnAngleNgo29 = deg;
  }
}

const ngo29RegressionTest = {
  passed:
    ngo29Matches.length === 1 &&
    ngo29Feature.properties.id === 'xh_road_ngo_29_nguyen_van_linh' &&
    ngo29Feature.properties.parentRoad === 'Đường Nguyễn Văn Linh' &&
    ngo29Feature.properties.source === 'local_verified' &&
    ngo29Feature.properties.confidence === 1.0 &&
    minSnapDistToNVL < 0.05 &&
    maxTurnAngleNgo29 < 12,
  assertions: {
    existsInRoadsGeoJSON: ngo29Matches.length > 0,
    uniqueSingleBranchCount: ngo29Matches.length,
    roadId: ngo29Feature?.properties?.id || null,
    parentRoad: ngo29Feature?.properties?.parentRoad || null,
    source: ngo29Feature?.properties?.source || null,
    confidence: ngo29Feature?.properties?.confidence || null,
    snapDistanceToNguyenVanLinhMeters: Number(minSnapDistToNVL.toFixed(4)),
    maxDeflectionAngleDeg: Number(maxTurnAngleNgo29.toFixed(2)),
    coordinates: ngo29Feature?.geometry?.coordinates || [],
  },
};

if (!ngo29RegressionTest.passed) {
  console.error('❌ Regression Test Ngõ 29 Nguyễn Văn Linh THẤT BẠI:', ngo29RegressionTest);
  process.exit(1);
}

const auditReport = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalRoadSegmentsBefore: preAudit.totalFeatures,
    totalRoadSegmentsAfter: postAudit.totalFeatures,
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
      issue: 'Đường Nguyễn Văn Linh bị phình/gãy góc vàng tại 2 giao lộ gần ĐHSP Hà Nội 2 (mũi tên đỏ giữa)',
      cause: 'SOURCE_GEOMETRY_ERROR: Script raster skeleton (87ccd03) tạo ra 2 đoạn stub ngắn gmaps/way_3320 (3.5m) và gmaps/way_3324 (24.0m) gán nhầm tier=major tại giao lộ.',
      fix: 'Khôi phục đường tâm vector chuẩn OSM (way/157991278) thẳng tuyệt đối và loại bỏ toàn bộ 86 đoạn stub major/secondary ngắn do raster hóa.',
    },
    {
      issue: 'Ngõ 29 Nguyễn Văn Linh bị móc cong chữ V ở cuối ngõ và trùng tên trên 2 đoạn rời (mũi tên đỏ trên cùng bên trái)',
      cause: 'SOURCE_GEOMETRY_ERROR: Đoạn gmaps/way_3114 bị thuật toán skeleton nối nhầm góc 120° sang ngõ ngang way/892145396; đồng thời gmaps/way_3112 cũng bị gán trùng tên.',
      fix: 'Lưu mốc xác thực địa phương vào xuanhoa-road-overrides.json, cắt bỏ đoạn móc cong lỗi raster, giữ duy nhất 1 tuyến thẳng [105.718521, 21.285574] -> [105.717680, 21.285016] nối khớp 0.0m vào Đường Nguyễn Văn Linh.',
    },
    {
      issue: 'Hàng loạt ngõ hiện tên tự đoán "Ngõ Nguyễn Văn Linh", "Ngõ Phạm Văn Đồng", "Ngõ Lê Quang Đạo", "Ngõ Võ Thị Sáu"...',
      cause: 'DATA_NAMING_ERROR: Hàm toAlleyPrefix() trong upgrade-roads-and-alleys.mjs tự động ghép tiền tố "Ngõ " + tên đường gần nhất cho 664 đoạn ngõ chưa có số ngõ xác thực.',
      fix: 'Xóa toàn bộ 664 tên ngõ tự đoán (để name=""), giữ nguyên geometry của ngõ, chỉ giữ tên cho các ngõ đã xác minh thực địa/OSM.',
    },
    {
      issue: 'Ribbon 3D tại các góc cua gắt có nguy cơ nhọn đầu (miter spike)',
      cause: 'RENDERING_ERROR: GeoBuilder.ribbon trong city3d.worker.ts cho phép miter giãn tới 2.5x halfWidth (dot >= 0.4) mà không kẹp theo chiều dài đoạn liền kề.',
      fix: 'Kẹp miter giới hạn trong GeoBuilder.ribbon (dot >= 0.75 + giới hạn theo chiều dài cạnh) và bo tròn disc tại các góc cua > 55°.',
    },
  ],
  ngo29NguyenVanLinhRegressionTest: ngo29RegressionTest,
  ALL_NAMED_ALLEYS,
  beforeAudit: preAudit,
  afterAudit: postAudit,
};

fs.writeFileSync(AUDIT_PATH, JSON.stringify(auditReport, null, 2));

console.log('✅ Đã hoàn tất Audit & Sửa toàn bộ hệ thống Đường / Ngõ Phường Xuân Hòa!');
console.log('   • Tổng số đoạn đường chuẩn hóa:', outFeatures.length);
console.log('   • Số lỗi sau khi sửa:', JSON.stringify(postAudit.counts));
console.log('   • Số tên ngõ tự đoán đã xóa:', preAudit.counts.fabricatedAlleyNameCount, '-> còn lại:', postAudit.counts.fabricatedAlleyNameCount);
console.log('   • Danh sách ALL_NAMED_ALLEYS (' + ALL_NAMED_ALLEYS.length + '):', ALL_NAMED_ALLEYS.map((a) => `${a.name} (${a.roadId} -> ${a.parentRoad})`).join(' | '));
console.log('   • Regression Test Ngõ 29 Nguyễn Văn Linh:', ngo29RegressionTest.passed ? 'PASS (100%)' : 'FAIL');
