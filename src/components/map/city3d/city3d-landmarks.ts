import * as THREE from 'three';
import {
  LIZARD_HILL_ANCHOR,
  getElevationAtLngLat,
  getLizardHillLocalHeight,
  lngLatToLocal,
  type City3DOrigin,
} from './city3d-shared';
import type { PlaceLocation } from '../../../lib/map/map-types';
import type { XuanHoaMasterDataset as MasterGeographyDataset } from '../../../lib/map/xuanhoa-master-data';
import {
  type LandmarkBindingRecord,
  getLandmarkEditAnchors,
  localModelPointToWorld,
  resolveLandmarkWorldTransform,
} from '../../../lib/map/landmark-bindings';
import { createHPU2Landmark } from './landmarks/hpu2-a1';
import { createWhiteHouseModel } from './landmarks/nha-trang-xuan-hoa';
import { createChimXanh } from './landmarks/chim-xanh';
import { createVongTron1 } from './landmarks/vong-tron-1';
import { createVongTron2 } from './landmarks/vong-tron-2';

export interface IconicLandmarkFootprint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  clearRadiusMeters: number;
}

/**
 * Tọa độ chuẩn thực tế của các công trình biểu tượng đặc trưng tại Phường Xuân Hòa:
 * 1. Khu Hiệu bộ A1–A3 ĐHSP Hà Nội 2 (`hpu2_a1` -> `osm_building_a1_dhsp2`)
 * 2. Quảng trường Con Chim Xanh (`quang_truong_chim_xanh` -> `osm_landmark_quang_truong_chim_xanh`)
 * 3. Trường Đại học Kiến trúc Hà Nội — Cơ sở Xuân Hòa (`dh_kien_truc` -> `osm_way_1079368029`)
 * 4. Nhà Trắng Xuân Hòa (`nha_trang_xuan_hoa` -> `osm_landmark_nha_trang_xuan_hoa`)
 * 5. Vòng tròn 1 (`vong_tron_1` -> `osm_landmark_vong_tron_1`)
 * 6. Vòng tròn 2 (`vong_tron_2` -> `osm_landmark_vong_tron_2`)
 */
export const ICONIC_LANDMARK_FOOTPRINTS: IconicLandmarkFootprint[] = [
  {
    id: 'osm_building_a1_dhsp2',
    name: 'Khu Hiệu bộ A1–A3 (ĐHSP Hà Nội 2)',
    lat: 21.281344,
    lng: 105.726226,
    clearRadiusMeters: 28,
  },
  {
    id: 'osm_landmark_quang_truong_chim_xanh',
    name: 'Quảng trường Con Chim Xanh',
    lat: 21.28078,
    lng: 105.7257,
    clearRadiusMeters: 22,
  },
  {
    id: 'osm_way_1079368029',
    name: 'ĐH Kiến trúc Hà Nội (CS Xuân Hòa)',
    lat: 21.27876,
    lng: 105.72852,
    clearRadiusMeters: 20,
  },
  {
    id: 'osm_landmark_nha_trang_xuan_hoa',
    name: 'Nhà Trắng Xuân Hòa (Tổ hợp Vòng tròn 1)',
    lat: 21.278175,
    lng: 105.729275,
    clearRadiusMeters: 24,
  },
  {
    id: 'osm_landmark_vong_tron_1',
    name: 'Vòng tròn 1',
    lat: 21.277632,
    lng: 105.729416,
    clearRadiusMeters: 14,
  },
  {
    id: 'osm_landmark_vong_tron_2',
    name: 'Vòng tròn 2',
    lat: 21.281565,
    lng: 105.725,
    clearRadiusMeters: 20,
  },
];

/**
 * Tạo biển hiệu chữ nét cao bằng Canvas 2D chuyển thành THREE.CanvasTexture
 */
function createSignboardTexture(
  text: string,
  bgColor: string,
  textColor: string,
  borderColor?: string,
  width = 256,
  height = 64
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    if (borderColor) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, width - 3, height - 3);
    }
    ctx.fillStyle = textColor;
    ctx.font = `700 ${Math.round(height * 0.42)}px "Be Vietnam Pro", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 + 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 2. MÔ HÌNH 3D: TRƯỜNG ĐẠI HỌC KIẾN TRÚC HÀ NỘI — CƠ SỞ XUÂN HÒA (Số 34 Đường Nguyễn Văn Linh)
 * Dựng chuẩn xác và nhẹ nhàng theo đúng ảnh chụp thực tế tại cổng Số 34 Nguyễn Văn Linh:
 * - Tòa nhà giảng đường 7 tầng hiện đại nằm ngay sau cổng trường:
 *   + Khung viền bê tông trắng giật cấp kiểu chữ L ôm mặt tiền (#F4F4F0)
 *   + Hệ vách kính xanh lam trầm (#2B5B75) chia đố kính trắng thanh thoát
 *   + Dàn lam chắn nắng ngang đua ra ở góc phải mỗi tầng & mảng tường lam xám đậm bên hông (#4A5568)
 * - Cổng trường ĐH Kiến trúc ở phía trước (mặt đường Nguyễn Văn Linh, +Z):
 *   + 2 trụ cổng xanh xám nhạt + mái cổng bê tông phẳng đua ra
 *   + Bảng LED đen trên nóc cổng + bảng tên "TRƯỜNG ĐẠI HỌC KIẾN TRÚC HÀ NỘI" dưới mái cổng
 *   + Cổng xếp inox bạc + bờ tường vàng nghệ bên trái cổng + hàng cây xanh mát bên phải
 */
function buildArchitectureUniversityModel(
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // 1. Nền sân khuôn viên gọn gàng (18m × 22m)
  const yardGeo = track(new THREE.BoxGeometry(18.0, 0.14, 21.0));
  const yardMat = track(new THREE.MeshLambertMaterial({ color: 0xcbc9c0 }));
  const yard = new THREE.Mesh(yardGeo, yardMat);
  yard.position.set(0, 0.07, 0);
  yard.receiveShadow = true;
  group.add(yard);

  // 2. Tòa nhà chính 7 tầng hiện đại (đặt tại z = -2.2m, mặt chính hướng về +Z ra đường Nguyễn Văn Linh)
  const whiteMat = track(
    new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.45 })
  );
  const slateWallMat = track(
    new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.65 })
  );
  const glassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x26546e,
      roughness: 0.25,
      metalness: 0.2,
    })
  );
  const louverMat = track(
    new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
  );

  // Khối lõi kính xanh trầm 7 tầng (rộng 13.2m, cao 18.8m, sâu 10.2m)
  const coreGeo = track(new THREE.BoxGeometry(13.2, 18.8, 10.2));
  const coreMesh = new THREE.Mesh(coreGeo, glassMat);
  coreMesh.position.set(0.4, 9.5, -2.2);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  group.add(coreMesh);

  // Khối tường lam xám đậm bên hông phải (+X) và góc trái (-X) như trong ảnh chụp
  const rightWingGeo = track(new THREE.BoxGeometry(2.6, 19.2, 9.6));
  const rightWing = new THREE.Mesh(rightWingGeo, slateWallMat);
  rightWing.position.set(6.1, 9.7, -2.3);
  rightWing.castShadow = true;
  group.add(rightWing);

  const leftWingGeo = track(new THREE.BoxGeometry(2.2, 18.6, 9.4));
  const leftWing = new THREE.Mesh(leftWingGeo, slateWallMat);
  leftWing.position.set(-5.7, 9.4, -2.4);
  leftWing.castShadow = true;
  group.add(leftWing);

  // Các dải băng bê tông trắng ngang (spandrel bands) + dàn lam chắn nắng góc phải ở từng tầng (tầng 2 -> tầng 7)
  for (let floor = 1; floor <= 6; floor++) {
    const y = 1.2 + floor * 2.75;
    // Băng trắng ngang mặt tiền
    const bandWidth = floor >= 4 ? 11.4 : 10.2;
    const bandX = floor >= 4 ? -0.1 : 0.4;
    const bandGeo = track(new THREE.BoxGeometry(bandWidth, 0.72, 10.6));
    const band = new THREE.Mesh(bandGeo, whiteMat);
    band.position.set(bandX, y, -2.1);
    band.castShadow = true;
    group.add(band);

    // Dàn lam chắn nắng ngang đua ra ở góc phải mỗi tầng (đặc trưng trong ảnh chụp)
    const sunshadeGeo = track(new THREE.BoxGeometry(3.4, 0.14, 1.45));
    const sunshade = new THREE.Mesh(sunshadeGeo, louverMat);
    sunshade.position.set(4.5, y + 0.95, 3.2);
    group.add(sunshade);
  }

  // Các cột khung trắng đứng mặt tiền tạo hình chữ L giật cấp đặc trưng của tòa nhà ĐH Kiến Trúc
  const vFrameLeftOuter = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.85, 16.8, 10.65)),
    whiteMat
  );
  vFrameLeftOuter.position.set(-4.6, 9.3, -2.1);
  group.add(vFrameLeftOuter);

  const vFrameLeftInner = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.8, 11.2, 10.7)),
    whiteMat
  );
  vFrameLeftInner.position.set(-3.1, 6.5, -2.08);
  group.add(vFrameLeftInner);

  const vFrameRight = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.9, 17.5, 10.65)),
    whiteMat
  );
  vFrameRight.position.set(4.9, 9.6, -2.1);
  group.add(vFrameRight);

  // Đố cửa sổ dọc màu trắng mảnh trên mặt kính
  const mullionGeo = track(new THREE.BoxGeometry(0.12, 16.2, 10.35));
  for (let mx = -2.0; mx <= 3.8; mx += 1.45) {
    const mullion = new THREE.Mesh(mullionGeo, whiteMat);
    mullion.position.set(mx, 9.6, -2.15);
    group.add(mullion);
  }

  // Tum thang máy trắng trên đỉnh mái
  const penthouseGeo = track(new THREE.BoxGeometry(5.6, 2.1, 4.8));
  const penthouse = new THREE.Mesh(penthouseGeo, whiteMat);
  penthouse.position.set(1.8, 19.8, -2.5);
  penthouse.castShadow = true;
  group.add(penthouse);

  // 3. CỔNG TRƯỜNG SỐ 34 ĐƯỜNG NGUYỄN VĂN LINH (ở phía trước z = +7.8m, lệch nhẹ sang trái đúng góc ảnh chụp)
  const gateX = -1.6;
  const gateZ = 7.8;

  const gatePillarMat = track(
    new THREE.MeshStandardMaterial({ color: 0xa3b8cc, roughness: 0.55 })
  );
  const gateCanopyMat = track(
    new THREE.MeshStandardMaterial({ color: 0xd6d3cd, roughness: 0.6 })
  );

  // 2 trụ cổng bê tông xanh xám nhạt
  const gatePillarGeo = track(new THREE.BoxGeometry(0.65, 3.6, 0.75));
  for (const gx of [gateX - 2.6, gateX + 2.6]) {
    const gp = new THREE.Mesh(gatePillarGeo, gatePillarMat);
    gp.position.set(gx, 1.8, gateZ);
    gp.castShadow = true;
    group.add(gp);
  }

  // Mái cổng bê tông phẳng đua ra phía trước
  const canopyGeo = track(new THREE.BoxGeometry(6.4, 0.32, 2.2));
  const canopy = new THREE.Mesh(canopyGeo, gateCanopyMat);
  canopy.position.set(gateX, 3.65, gateZ + 0.35);
  canopy.castShadow = true;
  group.add(canopy);

  // Bảng điện tử LED đen đặt trên mái cổng (y hệt ảnh chụp)
  const ledBoxGeo = track(new THREE.BoxGeometry(5.2, 0.95, 0.28));
  const ledBoxMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 })
  );
  const ledBox = new THREE.Mesh(ledBoxGeo, ledBoxMat);
  ledBox.position.set(gateX, 4.35, gateZ + 0.15);
  group.add(ledBox);

  // Biển tên "ĐẠI HỌC KIẾN TRÚC HÀ NỘI" gắn dưới mái cổng
  const hauSignTex = track(
    createSignboardTexture(
      'ĐẠI HỌC KIẾN TRÚC HÀ NỘI',
      '#F8FAFC',
      '#B91C1C',
      '#1D4ED8',
      512,
      80
    )
  );
  const hauSignMat = track(new THREE.MeshBasicMaterial({ map: hauSignTex }));
  const hauSignGeo = track(new THREE.BoxGeometry(4.6, 0.55, 0.14));
  const hauSign = new THREE.Mesh(hauSignGeo, hauSignMat);
  hauSign.position.set(gateX, 3.22, gateZ + 0.05);
  group.add(hauSign);

  // Cổng xếp inox bạc bên dưới cổng
  const foldingGateMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.5,
      roughness: 0.35,
    })
  );
  for (let fx = gateX - 2.1; fx <= gateX + 2.1; fx += 0.35) {
    const bar = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.08, 1.35, 0.12)),
      foldingGateMat
    );
    bar.position.set(fx, 0.72, gateZ);
    group.add(bar);
  }

  // Bờ tường vàng nghệ bên trái cổng (đúng bức tường vàng bên trái trong ảnh Street View)
  const yellowWallMat = track(
    new THREE.MeshLambertMaterial({ color: 0xeab308 })
  );
  const yellowWallGeo = track(new THREE.BoxGeometry(4.0, 2.3, 0.35));
  const yellowWall = new THREE.Mesh(yellowWallGeo, yellowWallMat);
  yellowWall.position.set(gateX - 5.1, 1.15, gateZ);
  yellowWall.castShadow = true;
  group.add(yellowWall);

  // Hàng rào thoáng & cây xanh mát bên phải cổng (như ảnh thực tế)
  const trunkMat = track(new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
  const leafMat = track(new THREE.MeshLambertMaterial({ color: 0x3b6e28 }));
  for (const [tx, tz, sc] of [
    [2.6, 5.2, 1.25],
    [5.4, 6.8, 1.15],
    [6.8, 4.2, 1.05],
    [-6.8, 4.8, 0.95],
  ]) {
    const trunk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.16 * sc, 0.22 * sc, 2.0 * sc, 7)),
      trunkMat
    );
    trunk.position.set(tx, 1.0 * sc, tz);
    group.add(trunk);

    const crown = new THREE.Mesh(
      track(new THREE.DodecahedronGeometry(1.4 * sc, 1)),
      leafMat
    );
    crown.position.set(tx, 2.7 * sc, tz);
    crown.castShadow = true;
    group.add(crown);
  }

  return group;
}

/**
 * 4. NÚI THẰN LẰN (ĐỒI THẰN LẰN) & CỤM DI TÍCH LỊCH SỬ BỐT PHÁP (1950)
 * Thiết kế chuẩn theo bản đồ thực tế:
 * - Địa hình 3D dáng Thằn Lằn trải dài Bắc Tây Bắc – Nam Đông Nam với rừng thông/bạch đàn và vân địa hình tự nhiên.
 * - Tuyến đường nhựa/bê tông leo đồi khớp 100% tọa độ bản đồ (gmaps/way_2528) từ khu dân cư lên yên ngựa giữa đồi,
 *   sau đó tách thành 2 lối đi lát đá & bậc tam cấp dọc sống đồi nối liền Đỉnh Bắc (Bốt Pháp) và Đỉnh Nam (Đài Vọng Cảnh).
 * - Đỉnh Bắc (21.296389, 105.723889 — cao 32m): Cụm Di tích Lịch sử Bốt Pháp (Tường lũy đá cổ, Bốt tròn & Lô cốt cổ có lỗ châu mai,
 *   Lô cốt phụ, Nhà bia Chiến thắng Bốt Thằn Lằn 28/12/1950 và Kỳ đài Cờ đỏ sao vàng).
 * - Đỉnh Nam (21.293889, 105.724444 — cao 28.5m): Đài Vọng Cảnh toàn cảnh Xuân Hòa & Lầu lục giác mái đao ngói đỏ.
 */
function buildLizardHillAndFrenchFortModel(
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LizardHillAndFrenchFort3D';

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // --- A. ĐỊA HÌNH 3D QUẢ ĐỒI THẰN LẰN (LƯỚI ĐỊA HÌNH ĐA SẮC ĐỘ THEO ĐỘ CAO) ---
  const minX = -195;
  const maxX = 165;
  const minZ = -390;
  const maxZ = 230;
  const nx = 90;
  const nz = 140;
  const stepX = (maxX - minX) / nx;
  const stepZ = (maxZ - minZ) / nz;

  const gridH = new Float32Array((nx + 1) * (nz + 1));
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const colors = new Float32Array((nx + 1) * (nz + 1) * 3);

  for (let iz = 0; iz <= nz; iz++) {
    const rz = minZ + iz * stepZ;
    for (let ix = 0; ix <= nx; ix++) {
      const rx = minX + ix * stepX;
      const idx = iz * (nx + 1) + ix;
      let h = getLizardHillLocalHeight(rx, rz);

      // Tạo gợn địa hình tự nhiên nhẹ trên sườn đồi (trừ mặt phẳng 2 đỉnh)
      const distN = Math.hypot(rx - -57.6, rz - -276.4);
      const distS = Math.hypot(rx, rz);
      if (h > 1.2 && distN > 18 && distS > 15.5) {
        const undulation =
          Math.sin(rx * 0.065 + rz * 0.045) * Math.cos(rx * 0.04 - rz * 0.055) * 0.65;
        h = Math.max(0, h + undulation * Math.min(1, h / 10));
      }
      gridH[idx] = h;

      const pIdx = idx * 3;
      positions[pIdx] = rx;
      positions[pIdx + 1] = h > 0.04 ? h - 0.12 : -0.25;
      positions[pIdx + 2] = rz;

      // Phối màu địa hình tự nhiên theo độ cao + đường đồng mức nhẹ kiểu sa bàn
      let r = 0.58,
        g = 0.69,
        b = 0.44;
      if (h < 3.5) {
        // Chân đồi cỏ non chuyển tiếp mượt với mặt đất sa bàn
        const t = h / 3.5;
        r = 0.64 * (1 - t) + 0.44 * t;
        g = 0.69 * (1 - t) + 0.59 * t;
        b = 0.51 * (1 - t) + 0.34 * t;
      } else if (h < 21.0) {
        // Sườn đồi rừng thông & bạch đàn xanh thẫm tự nhiên
        const t = (h - 3.5) / 17.5;
        r = 0.42 * (1 - t) + 0.34 * t;
        g = 0.58 * (1 - t) + 0.51 * t;
        b = 0.32 * (1 - t) + 0.26 * t;
      } else {
        // Đỉnh đồi & vai đá ong cổ kính
        const t = Math.min(1, (h - 21.0) / 11.0);
        r = 0.36 * (1 - t) + 0.48 * t;
        g = 0.51 * (1 - t) + 0.56 * t;
        b = 0.27 * (1 - t) + 0.33 * t;
      }

      // Vân đồng mức (contour rings) mỗi 4.5m độ cao giúp khối đồi 3D nổi rõ chiều sâu
      const contourBand = Math.abs(((h + 0.4) % 4.5) - 2.25);
      if (h > 2.0 && h < 30.8 && contourBand < 0.28) {
        r *= 0.91;
        g *= 0.92;
        b *= 0.89;
      }

      colors[pIdx] = r;
      colors[pIdx + 1] = g;
      colors[pIdx + 2] = b;
    }
  }

  const indices: number[] = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * (nx + 1) + ix;
      const b = a + 1;
      const c = (iz + 1) * (nx + 1) + ix;
      const d = c + 1;
      if (gridH[a] <= 0.05 && gridH[b] <= 0.05 && gridH[c] <= 0.05 && gridH[d] <= 0.05) {
        continue;
      }
      indices.push(a, c, b, b, c, d);
    }
  }

  const hillGeo = track(new THREE.BufferGeometry());
  hillGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  hillGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  hillGeo.setIndex(indices);
  hillGeo.computeVertexNormals();

  const hillMat = track(
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    })
  );
  const hillMesh = new THREE.Mesh(hillGeo, hillMat);
  hillMesh.receiveShadow = true;
  hillMesh.castShadow = true;
  group.add(hillMesh);

  // --- B. HỆ THỐNG LỐI ĐI & ĐƯỜNG LÊN ĐỒI CHUẨN THEO BẢN ĐỒ (gmaps/way_2528 + ĐƯỜNG ĐÁ SỐNG ĐỒI) ---
  // Hàm nội suy mịn chuỗi tọa độ và dựng dải đường 3D có nền đắp & viền đá vỉa hè bám sát mặt đồi
  const buildElevatedTrail = (
    waypoints: [number, number][],
    halfWidth: number,
    curbWidth: number,
    roadColorHex: number,
    curbColorHex: number,
    addBollards = false,
    addSteps = false
  ) => {
    // Chia nhỏ mỗi đoạn thành các bước ~2.2m để đường ôm sát mặt cong 3D của quả đồi
    const densePts: [number, number, number][] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [x1, z1] = waypoints[i];
      const [x2, z2] = waypoints[i + 1];
      const segLen = Math.hypot(x2 - x1, z2 - z1);
      const steps = Math.max(2, Math.ceil(segLen / 2.2));
      for (let s = 0; s < (i === waypoints.length - 2 ? steps + 1 : steps); s++) {
        const t = s / steps;
        const px = x1 + (x2 - x1) * t;
        const pz = z1 + (z2 - z1) * t;
        const py = getLizardHillLocalHeight(px, pz);
        densePts.push([px, py, pz]);
      }
    }
    if (densePts.length < 2) return;

    const buildRibbonMesh = (hw: number, yOffset: number, dropSkirt: number, colorHex: number) => {
      const vPos: number[] = [];
      const vIdx: number[] = [];
      for (let i = 0; i < densePts.length; i++) {
        const [px, py, pz] = densePts[i];
        let dx = 0,
          dz = 0;
        if (i < densePts.length - 1) {
          dx += densePts[i + 1][0] - px;
          dz += densePts[i + 1][2] - pz;
        }
        if (i > 0) {
          dx += px - densePts[i - 1][0];
          dz += pz - densePts[i - 1][2];
        }
        const len = Math.hypot(dx, dz) || 1;
        const nxDir = -dz / len;
        const nzDir = dx / len;

        const lx = px + nxDir * hw;
        const lz = pz + nzDir * hw;
        const rx = px - nxDir * hw;
        const rz = pz - nzDir * hw;
        const topY = Math.max(py, getLizardHillLocalHeight(lx, lz), getLizardHillLocalHeight(rx, rz)) + yOffset;
        const botY = topY - dropSkirt;

        // 4 đỉnh cho mỗi mặt cắt ngang: LeftTop (0), RightTop (1), LeftBot (2), RightBot (3)
        vPos.push(lx, topY, lz, rx, topY, rz, lx, botY, lz, rx, botY, rz);

        if (i < densePts.length - 1) {
          const base = i * 4;
          const next = (i + 1) * 4;
          // Mặt đường trên
          vIdx.push(base, next, base + 1, base + 1, next, next + 1);
          // Thành taluy bên trái
          vIdx.push(base + 2, next + 2, base, base, next + 2, next);
          // Thành taluy bên phải
          vIdx.push(base + 1, next + 1, base + 3, base + 3, next + 1, next + 3);
        }
      }
      const rGeo = track(new THREE.BufferGeometry());
      rGeo.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
      rGeo.setIndex(vIdx);
      rGeo.computeVertexNormals();
      const rMat = track(new THREE.MeshLambertMaterial({ color: colorHex }));
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.receiveShadow = true;
      rMesh.castShadow = true;
      group.add(rMesh);
    };

    // Nền kè đá vỉa hè (rộng hơn mặt đường)
    buildRibbonMesh(halfWidth + curbWidth, 0.34, 1.35, curbColorHex);
    // Mặt đường chính nổi bên trên nền kè
    buildRibbonMesh(halfWidth, 0.44, 0.22, roadColorHex);

    // Bậc đá tam cấp & Cọc tiêu đá ven đường đồi
    const bollardMat = track(new THREE.MeshLambertMaterial({ color: 0xd6d3c9 }));
    const bollardCapMat = track(new THREE.MeshBasicMaterial({ color: 0xd97706 }));
    const stepMat = track(new THREE.MeshLambertMaterial({ color: 0xb8b2a6 }));
    const bollardGeo = track(new THREE.CylinderGeometry(0.18, 0.22, 0.75, 6));
    const bollardCapGeo = track(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 6));

    for (let i = 2; i < densePts.length - 2; i += 3) {
      const [px, py, pz] = densePts[i];
      const [nxPt, nyPt, nzPt] = densePts[i + 1];
      const dx = nxPt - px;
      const dz = nzPt - pz;
      const len = Math.hypot(dx, dz) || 1;
      const nxDir = -dz / len;
      const nzDir = dx / len;
      const angle = Math.atan2(dx, dz);

      if (addSteps && Math.abs(nyPt - py) > 0.22) {
        const stepBar = new THREE.Mesh(
          track(new THREE.BoxGeometry(halfWidth * 1.9, 0.18, 0.42)),
          stepMat
        );
        stepBar.position.set(px, py + 0.48, pz);
        stepBar.rotation.y = angle;
        group.add(stepBar);
      }

      if (addBollards && i % 6 === 2) {
        for (const side of [-1, 1]) {
          const bx = px + nxDir * (halfWidth + curbWidth * 0.55) * side;
          const bz = pz + nzDir * (halfWidth + curbWidth * 0.55) * side;
          const by = Math.max(py, getLizardHillLocalHeight(bx, bz)) + 0.7;
          const post = new THREE.Mesh(bollardGeo, bollardMat);
          post.position.set(bx, by, bz);
          group.add(post);
          const cap = new THREE.Mesh(bollardCapGeo, bollardCapMat);
          cap.position.set(bx, by + 0.36, bz);
          group.add(cap);
        }
      }
    }
  };

  // 1. Tuyến đường nhựa/bê tông chính leo lên Đồi Thằn Lằn khớp 100% tọa độ bản đồ (gmaps/way_2528)
  const mapRoadWay2528: [number, number][] = [
    [79.7, -323.3],
    [72.6, -316.1],
    [77.5, -281.2],
    [66.3, -244.7],
    [79.7, -207.1],
    [78.9, -203.5],
    [67.4, -192.4],
    [-12.4, -153.9],
  ];
  buildElevatedTrail(mapRoadWay2528, 2.35, 0.55, 0x4b525d, 0xc7c1b4, true, false);

  // 2. Nhánh đường đá cổ từ Ngã ba sống đồi [-12.4, -153.9] dẫn lên cổng Di tích Bốt Pháp (Đỉnh Bắc)
  const northSummitTrail: [number, number][] = [
    [-12.4, -153.9],
    [-22.0, -176.0],
    [-31.5, -204.0],
    [-42.0, -231.0],
    [-51.0, -254.0],
    [-55.2, -263.5],
  ];
  buildElevatedTrail(northSummitTrail, 1.85, 0.45, 0x8c8273, 0xbab2a3, true, true);

  // 3. Nhánh đường dạo bộ sống đồi từ Ngã ba [-12.4, -153.9] sang Đỉnh Nam (Đài Vọng Cảnh) và thoải xuống chân đồi Nam
  const southRidgeTrail: [number, number][] = [
    [-12.4, -153.9],
    [-10.5, -118.0],
    [-6.5, -78.0],
    [-3.0, -40.0],
    [-0.8, -13.0],
  ];
  buildElevatedTrail(southRidgeTrail, 1.75, 0.42, 0x8c8273, 0xbab2a3, true, true);

  const southTailTrail: [number, number][] = [
    [0.8, 13.0],
    [5.5, 48.0],
    [10.2, 88.0],
    [14.0, 128.0],
    [17.5, 168.0],
    [19.5, 198.0],
  ];
  buildElevatedTrail(southTailTrail, 1.45, 0.35, 0x948979, 0xbdb5a6, false, true);

  // Cổng chào & Biển chỉ dẫn dưới chân đường lên Đồi Thằn Lằn ([76.5, -319.5])
  {
    const gateGroup = new THREE.Group();
    const gy = getLizardHillLocalHeight(76.5, -319.5);
    gateGroup.position.set(76.5, gy + 0.3, -319.5);
    gateGroup.rotation.y = 0.65;

    const stonePillarMat = track(new THREE.MeshLambertMaterial({ color: 0x8b7355 }));
    const roofTileMat = track(new THREE.MeshLambertMaterial({ color: 0x991b1b }));
    const boardMat = track(new THREE.MeshLambertMaterial({ color: 0x1e3a8a }));
    const goldBorderMat = track(new THREE.MeshBasicMaterial({ color: 0xfacc15 }));

    for (const sx of [-3.4, 3.4]) {
      const pBase = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 1.2, 1.1)), stonePillarMat);
      pBase.position.set(sx, 0.6, 0);
      gateGroup.add(pBase);

      const pillar = new THREE.Mesh(track(new THREE.BoxGeometry(0.75, 4.6, 0.75)), stonePillarMat);
      pillar.position.set(sx, 2.5, 0);
      pillar.castShadow = true;
      gateGroup.add(pillar);
    }

    const beam = new THREE.Mesh(track(new THREE.BoxGeometry(8.2, 0.95, 0.85)), boardMat);
    beam.position.set(0, 4.5, 0);
    gateGroup.add(beam);

    const beamStripe = new THREE.Mesh(track(new THREE.BoxGeometry(7.8, 0.55, 0.9)), goldBorderMat);
    beamStripe.position.set(0, 4.5, 0);
    gateGroup.add(beamStripe);

    const gateRoof = new THREE.Mesh(track(new THREE.ConeGeometry(5.6, 1.25, 4)), roofTileMat);
    gateRoof.rotation.y = Math.PI / 4;
    gateRoof.scale.set(1.18, 1, 0.36);
    gateRoof.position.set(0, 5.45, 0);
    gateGroup.add(gateRoof);

    group.add(gateGroup);
  }

  // --- C. CỤM DI TÍCH LỊCH SỬ BỐT PHÁP — ĐỈNH BẮC NÚI THẰN LẰN (-57.6, -276.4, cao 32.0m) ---
  {
    const fortGroup = new THREE.Group();
    const fortX = -57.6;
    const fortZ = -276.4;
    const fortY = getLizardHillLocalHeight(fortX, fortZ);
    fortGroup.position.set(fortX, fortY, fortZ);

    const oldStoneMat = track(
      new THREE.MeshStandardMaterial({ color: 0x857560, roughness: 0.92 })
    );
    const weatheredConcreteMat = track(
      new THREE.MeshStandardMaterial({ color: 0x9c9181, roughness: 0.88 })
    );
    const darkMossStoneMat = track(
      new THREE.MeshStandardMaterial({ color: 0x5c5346, roughness: 0.95 })
    );
    const courtyardMat = track(new THREE.MeshLambertMaterial({ color: 0xb6aca0 }));
    const embrasureMat = track(new THREE.MeshBasicMaterial({ color: 0x18181b }));
    const brickRedMat = track(
      new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.75 })
    );
    const goldMat = track(new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    const redFlagMat = track(new THREE.MeshBasicMaterial({ color: 0xdc2626 }));

    // 1. Nền sân đá cổ hình bát giác trên đỉnh Bốt Pháp (bán kính 15.8m)
    const plazaBase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(15.6, 16.8, 1.2, 16)),
      oldStoneMat
    );
    plazaBase.position.set(0, 0.25, 0);
    plazaBase.receiveShadow = true;
    fortGroup.add(plazaBase);

    const plazaFloor = new THREE.Mesh(
      track(new THREE.CylinderGeometry(14.8, 14.8, 0.24, 16)),
      courtyardMat
    );
    plazaFloor.position.set(0, 0.88, 0);
    plazaFloor.receiveShadow = true;
    fortGroup.add(plazaFloor);

    // 2. Tường thành lũy đá ong cổ bao quanh Bốt Pháp (mở cổng hướng Đông Nam đón đường lên đồi)
    const numWallSegs = 12;
    const wallRadius = 14.2;
    for (let i = 0; i < numWallSegs; i++) {
      // Chừa 2 khoang hướng Đông Nam (i === 2) làm cổng chính vào khu di tích
      if (i === 2) continue;
      const a1 = (i / numWallSegs) * Math.PI * 2;
      const a2 = ((i + 1) / numWallSegs) * Math.PI * 2;
      const midA = (a1 + a2) * 0.5;
      const segLen = 2 * wallRadius * Math.sin(Math.PI / numWallSegs);

      const wx = Math.cos(midA) * wallRadius;
      const wz = Math.sin(midA) * wallRadius;

      const wallSeg = new THREE.Mesh(
        track(new THREE.BoxGeometry(segLen + 0.4, 2.0, 1.15)),
        oldStoneMat
      );
      wallSeg.position.set(wx, 1.85, wz);
      wallSeg.rotation.y = -midA + Math.PI / 2;
      wallSeg.castShadow = true;
      wallSeg.receiveShadow = true;
      fortGroup.add(wallSeg);

      // Trụ đá góc tường thành & gờ đá chắn lũy (crenellations)
      const pillar = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.45, 2.55, 1.45)),
        darkMossStoneMat
      );
      pillar.position.set(Math.cos(a1) * wallRadius, 2.1, Math.sin(a1) * wallRadius);
      pillar.castShadow = true;
      fortGroup.add(pillar);
    }

    // 3. KHỐI BỐT TRÒN & LÔ CỐT CỔ CHÍNH CỦA PHÁP (Điểm nhấn lịch sử nổi bật nhất trên đỉnh đồi)
    const bunkerX = -2.2;
    const bunkerZ = -2.0;

    // Chân đế đá vát nghiêng kiên cố của Bốt tròn
    const bunkerPlinth = new THREE.Mesh(
      track(new THREE.CylinderGeometry(5.3, 6.2, 2.1, 20)),
      darkMossStoneMat
    );
    bunkerPlinth.position.set(bunkerX, 1.9, bunkerZ);
    bunkerPlinth.castShadow = true;
    bunkerPlinth.receiveShadow = true;
    fortGroup.add(bunkerPlinth);

    // Thân Bốt tròn bê tông cốt thép & đá cổ (cao 5.6m, bán kính 5.1m)
    const bunkerBody = new THREE.Mesh(
      track(new THREE.CylinderGeometry(4.95, 5.2, 5.6, 20)),
      weatheredConcreteMat
    );
    bunkerBody.position.set(bunkerX, 5.4, bunkerZ);
    bunkerBody.castShadow = true;
    bunkerBody.receiveShadow = true;
    fortGroup.add(bunkerBody);

    // Các đai gờ đá rêu phong ngang thân Bốt tròn
    for (const ringY of [3.2, 5.6, 8.05]) {
      const band = new THREE.Mesh(
        track(new THREE.CylinderGeometry(5.22, 5.22, 0.36, 20)),
        darkMossStoneMat
      );
      band.position.set(bunkerX, ringY, bunkerZ);
      fortGroup.add(band);
    }

    // 8 Lỗ châu mai (firing slits) quanh thân Bốt tròn (tầng dưới & tầng trên)
    const slitGeo = track(new THREE.BoxGeometry(1.25, 0.42, 0.35));
    const slitHoodGeo = track(new THREE.BoxGeometry(1.55, 0.22, 0.55));
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      const sx = bunkerX + Math.sin(ang) * 5.05;
      const sz = bunkerZ + Math.cos(ang) * 5.05;

      const slit = new THREE.Mesh(slitGeo, embrasureMat);
      slit.position.set(sx, 4.45, sz);
      slit.rotation.y = ang;
      fortGroup.add(slit);

      const hood = new THREE.Mesh(slitHoodGeo, darkMossStoneMat);
      hood.position.set(sx, 4.75, sz);
      hood.rotation.y = ang;
      fortGroup.add(hood);

      if (s % 2 === 0) {
        const upperSlit = new THREE.Mesh(slitGeo, embrasureMat);
        upperSlit.position.set(sx, 6.85, sz);
        upperSlit.rotation.y = ang;
        fortGroup.add(upperSlit);
      }
    }

    // Cửa vòm sắt cổ đi vào lòng Bốt tròn
    const bunkerDoor = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.5, 2.3, 0.45)),
      embrasureMat
    );
    bunkerDoor.position.set(bunkerX + 3.6, 2.1, bunkerZ + 3.6);
    bunkerDoor.rotation.y = Math.PI / 4;
    fortGroup.add(bunkerDoor);

    // Tháp canh quan sát trên nóc Bốt tròn (Cupola / Watchtower turret)
    const turretBody = new THREE.Mesh(
      track(new THREE.CylinderGeometry(3.0, 3.3, 2.5, 16)),
      oldStoneMat
    );
    turretBody.position.set(bunkerX, 9.3, bunkerZ);
    turretBody.castShadow = true;
    fortGroup.add(turretBody);

    for (let s = 0; s < 6; s++) {
      const ang = (s / 6) * Math.PI * 2 + 0.25;
      const tSlit = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.95, 0.38, 0.3)),
        embrasureMat
      );
      tSlit.position.set(
        bunkerX + Math.sin(ang) * 3.12,
        9.45,
        bunkerZ + Math.cos(ang) * 3.12
      );
      tSlit.rotation.y = ang;
      fortGroup.add(tSlit);
    }

    const turretCap = new THREE.Mesh(
      track(new THREE.ConeGeometry(3.55, 1.15, 16)),
      darkMossStoneMat
    );
    turretCap.position.set(bunkerX, 11.1, bunkerZ);
    turretCap.castShadow = true;
    fortGroup.add(turretCap);

    // 4. Lô cốt phụ hình lục giác (Pillbox) & Hào giao thông đá ở phía Đông Bắc sân Bốt
    const pillboxX = 6.2;
    const pillboxZ = -3.8;
    const pillbox = new THREE.Mesh(
      track(new THREE.CylinderGeometry(2.9, 3.2, 3.2, 6)),
      weatheredConcreteMat
    );
    pillbox.position.set(pillboxX, 2.4, pillboxZ);
    pillbox.castShadow = true;
    fortGroup.add(pillbox);

    const pillboxRoof = new THREE.Mesh(
      track(new THREE.CylinderGeometry(3.25, 3.25, 0.45, 6)),
      darkMossStoneMat
    );
    pillboxRoof.position.set(pillboxX, 4.15, pillboxZ);
    fortGroup.add(pillboxRoof);

    for (let s = 0; s < 6; s++) {
      const ang = (s / 6) * Math.PI * 2 + Math.PI / 6;
      const pSlit = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.9, 0.32, 0.3)),
        embrasureMat
      );
      pSlit.position.set(
        pillboxX + Math.sin(ang) * 2.75,
        2.7,
        pillboxZ + Math.cos(ang) * 2.75
      );
      pSlit.rotation.y = ang;
      fortGroup.add(pSlit);
    }

    // Tường hào giao thông nối Bốt tròn chính với Lô cốt phụ
    const trenchWall = new THREE.Mesh(
      track(new THREE.BoxGeometry(5.6, 1.65, 0.95)),
      oldStoneMat
    );
    trenchWall.position.set(2.2, 1.7, -3.0);
    trenchWall.rotation.y = -0.22;
    trenchWall.castShadow = true;
    fortGroup.add(trenchWall);

    // 5. NHÀ BIA DI TÍCH LỊCH SỬ CHIẾN THẮNG BỐT THẰN LẰN (28/12/1950 — Chiến dịch Trần Hưng Đạo)
    const steleX = -5.6;
    const steleZ = 5.8;
    const steleGroup = new THREE.Group();
    steleGroup.position.set(steleX, 0.95, steleZ);
    steleGroup.rotation.y = 0.52;

    // Bệ tam cấp đá nhà bia
    const steleBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(4.4, 0.65, 3.6)),
      darkMossStoneMat
    );
    steleBase.position.set(0, 0.32, 0);
    steleGroup.add(steleBase);

    // Tấm Bia đá hoa cương khắc chữ vàng ở trung tâm
    const tablet = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.75, 2.55, 0.36)),
      embrasureMat
    );
    tablet.position.set(0, 1.85, 0);
    tablet.castShadow = true;
    steleGroup.add(tablet);

    const tabletTop = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.88, 0.88, 0.36, 16)),
      embrasureMat
    );
    tabletTop.rotation.x = Math.PI / 2;
    tabletTop.position.set(0, 3.1, 0);
    steleGroup.add(tabletTop);

    const goldPlaque = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.35, 1.85, 0.4)),
      goldMat
    );
    goldPlaque.position.set(0, 1.9, 0);
    steleGroup.add(goldPlaque);

    // 4 cột gỗ đỏ & Mái đao ngói đỏ truyền thống che Nhà bia
    for (const [cx, cz] of [
      [-1.7, -1.3],
      [1.7, -1.3],
      [-1.7, 1.3],
      [1.7, 1.3],
    ]) {
      const col = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.18, 0.2, 3.4, 8)),
        brickRedMat
      );
      col.position.set(cx, 2.2, cz);
      col.castShadow = true;
      steleGroup.add(col);
    }

    const steleRoof = new THREE.Mesh(
      track(new THREE.ConeGeometry(3.4, 1.65, 4)),
      brickRedMat
    );
    steleRoof.rotation.y = Math.PI / 4;
    steleRoof.scale.set(1.15, 1, 0.95);
    steleRoof.position.set(0, 4.55, 0);
    steleRoof.castShadow = true;
    steleGroup.add(steleRoof);

    fortGroup.add(steleGroup);

    // 6. KỲ ĐÀI & CỜ ĐỎ SAO VÀNG TUNG BAY TRÊN ĐỈNH BỐT PHÁP
    const flagX = 4.2;
    const flagZ = 5.2;
    for (let s = 0; s < 3; s++) {
      const fStep = new THREE.Mesh(
        track(new THREE.BoxGeometry(3.4 - s * 0.7, 0.42, 3.4 - s * 0.7)),
        oldStoneMat
      );
      fStep.position.set(flagX, 1.15 + s * 0.42, flagZ);
      fortGroup.add(fStep);
    }

    const poleMat = track(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.3 })
    );
    const pole = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.09, 0.16, 11.5, 10)),
      poleMat
    );
    pole.position.set(flagX, 7.8, flagZ);
    pole.castShadow = true;
    fortGroup.add(pole);

    const flagCloth = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.1, 2.05, 0.08)),
      redFlagMat
    );
    flagCloth.position.set(flagX + 1.55, 12.45, flagZ);
    fortGroup.add(flagCloth);

    const flagStar = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 5)),
      goldMat
    );
    flagStar.rotation.x = Math.PI / 2;
    flagStar.position.set(flagX + 1.55, 12.45, flagZ);
    fortGroup.add(flagStar);

    group.add(fortGroup);
  }

  // --- D. ĐÀI VỌNG CẢNH & LẦU LỤC GIÁC — ĐỈNH NAM NÚI THẰN LẰN (0, 0, cao 28.5m) ---
  {
    const southGroup = new THREE.Group();
    const southY = getLizardHillLocalHeight(0, 0);
    southGroup.position.set(0, southY, 0);

    const stoneDeckMat = track(new THREE.MeshLambertMaterial({ color: 0xc2b9ab }));
    const stoneTrimMat = track(new THREE.MeshLambertMaterial({ color: 0x8c8273 }));
    const pillarRedMat = track(
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.6 })
    );
    const tileRoofMat = track(
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.65 })
    );
    const goldFinialMat = track(new THREE.MeshBasicMaterial({ color: 0xf59e0b }));

    // 1. Sân tròn Đài Vọng Cảnh lát đá tự nhiên có lan can đá nhìn toàn cảnh Xuân Hòa
    const deckBase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(13.2, 14.4, 1.0, 20)),
      stoneTrimMat
    );
    deckBase.position.set(0, 0.2, 0);
    deckBase.receiveShadow = true;
    southGroup.add(deckBase);

    const deckTop = new THREE.Mesh(
      track(new THREE.CylinderGeometry(12.6, 12.6, 0.22, 20)),
      stoneDeckMat
    );
    deckTop.position.set(0, 0.78, 0);
    deckTop.receiveShadow = true;
    southGroup.add(deckTop);

    // Lan can đá quanh Đài Vọng Cảnh (chừa lối vào phía Bắc và phía Nam)
    const numRails = 16;
    const railR = 12.1;
    for (let i = 0; i < numRails; i++) {
      const ang = (i / numRails) * Math.PI * 2;
      // Chừa lối thông với đường sống đồi (phía Bắc -Z và phía Nam +Z)
      if (Math.abs(Math.cos(ang)) < 0.25) continue;
      const rx = Math.sin(ang) * railR;
      const rz = Math.cos(ang) * railR;
      const post = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.55, 1.15, 0.55)),
        stoneTrimMat
      );
      post.position.set(rx, 1.35, rz);
      post.rotation.y = ang;
      southGroup.add(post);

      const bar = new THREE.Mesh(
        track(new THREE.BoxGeometry(4.4, 0.28, 0.32)),
        stoneDeckMat
      );
      bar.position.set(rx, 1.65, rz);
      bar.rotation.y = ang;
      southGroup.add(bar);
    }

    // 2. Lầu Vọng Cảnh Lục Giác 2 tầng mái đao ở tâm Đỉnh Nam
    for (let s = 0; s < 2; s++) {
      const step = new THREE.Mesh(
        track(new THREE.CylinderGeometry(5.2 - s * 0.45, 5.5 - s * 0.45, 0.28, 6)),
        stoneTrimMat
      );
      step.position.set(0, 0.98 + s * 0.28, 0);
      southGroup.add(step);
    }

    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const px = Math.sin(ang) * 4.1;
      const pz = Math.cos(ang) * 4.1;
      const col = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.22, 0.25, 4.2, 8)),
        pillarRedMat
      );
      col.position.set(px, 3.4, pz);
      col.castShadow = true;
      southGroup.add(col);
    }

    // Mái tầng 1 & tầng 2 của Lầu Vọng Cảnh
    const lowerRoof = new THREE.Mesh(
      track(new THREE.ConeGeometry(6.2, 1.85, 6)),
      tileRoofMat
    );
    lowerRoof.position.set(0, 6.1, 0);
    lowerRoof.castShadow = true;
    southGroup.add(lowerRoof);

    const upperNeck = new THREE.Mesh(
      track(new THREE.CylinderGeometry(2.6, 2.8, 1.1, 6)),
      stoneDeckMat
    );
    upperNeck.position.set(0, 7.1, 0);
    southGroup.add(upperNeck);

    const upperRoof = new THREE.Mesh(
      track(new THREE.ConeGeometry(4.3, 1.75, 6)),
      tileRoofMat
    );
    upperRoof.position.set(0, 8.35, 0);
    upperRoof.castShadow = true;
    southGroup.add(upperRoof);

    const finial = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.38, 10, 10)),
      goldFinialMat
    );
    finial.position.set(0, 9.4, 0);
    southGroup.add(finial);

    // Cụm đá tảng tự nhiên (Bãi đá Đồi Thằn Lằn) quanh rìa đỉnh Nam
    const boulderMat = track(
      new THREE.MeshLambertMaterial({ color: 0x7d7568, flatShading: true })
    );
    const boulderCoords: [number, number, number, number][] = [
      [-9.2, -5.5, 2.4, 1.6],
      [-10.4, -2.2, 1.8, 1.3],
      [9.5, 4.2, 2.6, 1.7],
      [8.2, 7.4, 1.9, 1.4],
      [-7.8, 8.5, 2.1, 1.5],
    ];
    for (const [bx, bz, br, bh] of boulderCoords) {
      const rock = new THREE.Mesh(
        track(new THREE.DodecahedronGeometry(br, 0)),
        boulderMat
      );
      rock.scale.set(1.2, bh / br, 0.95);
      rock.position.set(bx, 0.9 + bh * 0.4, bz);
      rock.rotation.set(bx * 0.2, bz * 0.3, 0.15);
      rock.castShadow = true;
      southGroup.add(rock);
    }

    group.add(southGroup);
  }

  // --- E. RỪNG THÔNG, BẠCH ĐÀN & ĐÁ TẢNG TỰ NHIÊN TRÊN SƯỜN ĐỒI THẰN LẰN ---
  {
    const trunkMat = track(new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
    const pineDarkMat = track(
      new THREE.MeshLambertMaterial({ color: 0x2f5e2e, flatShading: true })
    );
    const pineMidMat = track(
      new THREE.MeshLambertMaterial({ color: 0x3f7438, flatShading: true })
    );
    const eucaMat = track(
      new THREE.MeshLambertMaterial({ color: 0x538642, flatShading: true })
    );
    const slopeRockMat = track(
      new THREE.MeshLambertMaterial({ color: 0x82786a, flatShading: true })
    );

    const trunkGeo = track(new THREE.CylinderGeometry(0.18, 0.28, 2.8, 6));
    const pineCone1 = track(new THREE.ConeGeometry(2.2, 4.8, 6));
    const pineCone2 = track(new THREE.ConeGeometry(1.65, 4.0, 6));
    const eucaCrownGeo = track(new THREE.DodecahedronGeometry(2.1, 1));
    const rockGeo = track(new THREE.DodecahedronGeometry(1.7, 0));

    // Kiểm tra khoảng cách an toàn tới đường lên đồi để cây không bao giờ mọc đè lên lối đi
    const allTrailPts: [number, number][] = [
      ...mapRoadWay2528,
      ...northSummitTrail,
      ...southRidgeTrail,
      ...southTailTrail,
    ];
    const isNearTrailOrPlaza = (x: number, z: number): boolean => {
      if (Math.hypot(x - -57.6, z - -276.4) < 21.5) return true;
      if (Math.hypot(x, z) < 18.5) return true;
      for (let i = 0; i < allTrailPts.length - 1; i++) {
        const [ax, az] = allTrailPts[i];
        const [bx, bz] = allTrailPts[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        const dist = Math.hypot(x - (ax + t * dx), z - (az + t * dz));
        if (dist < 8.5) return true;
      }
      return false;
    };

    // Phân bố cây thông & bạch đàn tự nhiên theo lưới bán ngẫu nhiên trên khắp sườn đồi
    for (let gz = -360; gz <= 200; gz += 22) {
      for (let gx = -165; gx <= 135; gx += 22) {
        const seed = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453;
        const frac1 = seed - Math.floor(seed);
        const frac2 = (seed * 1.618) - Math.floor(seed * 1.618);
        const tx = gx + (frac1 - 0.5) * 15;
        const tz = gz + (frac2 - 0.5) * 15;
        const ty = getLizardHillLocalHeight(tx, tz);
        if (ty < 2.2 || ty > 29.5) continue;
        if (isNearTrailOrPlaza(tx, tz)) continue;

        const sc = 0.82 + frac1 * 0.58;
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.scale.set(sc, sc, sc);
        trunk.position.set(tx, ty + 1.2 * sc, tz);
        group.add(trunk);

        if (frac2 < 0.68) {
          // Cây thông 2 tầng tán hình nón đặc trưng của Đồi Thằn Lằn
          const mat = frac1 > 0.5 ? pineDarkMat : pineMidMat;
          const c1 = new THREE.Mesh(pineCone1, mat);
          c1.scale.set(sc, sc, sc);
          c1.position.set(tx, ty + 3.6 * sc, tz);
          c1.castShadow = true;
          group.add(c1);

          const c2 = new THREE.Mesh(pineCone2, mat);
          c2.scale.set(sc, sc, sc);
          c2.position.set(tx, ty + 5.7 * sc, tz);
          c2.castShadow = true;
          group.add(c2);
        } else {
          // Cây bạch đàn / keo lá tràm tán tròn
          const crown = new THREE.Mesh(eucaCrownGeo, eucaMat);
          crown.scale.set(sc, sc * 1.15, sc);
          crown.position.set(tx, ty + 3.9 * sc, tz);
          crown.castShadow = true;
          group.add(crown);
        }

        // Điểm xuyết các cụm đá tảng tự nhiên trên sườn đồi
        if (frac1 > 0.78 && ty > 10) {
          const rock = new THREE.Mesh(rockGeo, slopeRockMat);
          const rSc = 0.7 + frac2 * 0.85;
          rock.scale.set(rSc * 1.3, rSc * 0.75, rSc);
          rock.position.set(tx + 2.8, ty + 0.35, tz - 1.9);
          rock.rotation.set(frac1 * 2, frac2 * 3, 0.2);
          group.add(rock);
        }
      }
    }
  }

  return group;
}

/**
 * LEVEL B LANDMARKS (Section G):
 * Hệ thống cổng chào, cột cờ nghi lễ & cảnh quan sảnh trước các công trình công cộng/trường học tiêu biểu của Xuân Hòa
 * (Đặt đúng tọa độ thực tế, giữ nguyên 100% footprint công trình chính từ dữ liệu OSM/Master)
 */
function buildLevelBCivicAndCampusAccents(
  origin: City3DOrigin,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LevelBLandmarks3D';

  const makeMat = (hex: string, emissiveHex?: string, emissiveIntensity = 0) => {
    const m = new THREE.MeshLambertMaterial({
      color: new THREE.Color(hex),
      ...(emissiveHex
        ? { emissive: new THREE.Color(emissiveHex), emissiveIntensity }
        : {}),
    });
    disposables.push(m);
    return m;
  };

  const creamMat = makeMat('#F7F1E3');
  const warmStoneMat = makeMat('#E5DACA');
  const terracottaMat = makeMat('#C8644E');
  const civicGoldMat = makeMat('#E8C36A');
  const navySignMat = makeMat('#2B4C7E', '#1E3A63', 0.15);
  const redSignMat = makeMat('#B83B32', '#7D221C', 0.15);
  const poleMat = makeMat('#D8DCE2');
  const flagRedMat = makeMat('#D93829', '#D93829', 0.22);
  const hedgeMat = makeMat('#6CA358');

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
  disposables.push(boxGeo, cylGeo);

  const addArchGateAndFlag = (opts: {
    landmarkId: string;
    lng: number;
    lat: number;
    rotY: number;
    span: number;
    height: number;
    signMat: THREE.Material;
    roofMat: THREE.Material;
    withFlagpole?: boolean;
    flagOffsetZ?: number;
  }) => {
    const [x, y] = lngLatToLocal(origin, opts.lng, opts.lat);
    const baseElev = getElevationAtLngLat(opts.lng, opts.lat);
    const node = new THREE.Group();
    node.name = `Landmark_${opts.landmarkId}`;
    node.userData.landmarkId = opts.landmarkId;
    node.userData.fallbackLngLat = [opts.lng, opts.lat];
    node.userData.isTerrainBaseZero = false;
    node.position.set(x, baseElev, -y);
    node.rotation.y = opts.rotY;

    const halfSpan = opts.span * 0.5;
    // Hai trụ cổng chính + trụ phụ
    for (const sx of [-1, 1]) {
      const mainPillar = new THREE.Mesh(boxGeo, creamMat);
      mainPillar.scale.set(1.15, opts.height, 1.15);
      mainPillar.position.set(sx * halfSpan, opts.height * 0.5, 0);
      mainPillar.castShadow = true;
      node.add(mainPillar);

      const basePlinth = new THREE.Mesh(boxGeo, warmStoneMat);
      basePlinth.scale.set(1.45, 0.9, 1.45);
      basePlinth.position.set(sx * halfSpan, 0.45, 0);
      node.add(basePlinth);

      // Bồn cây xanh hai bên cổng
      const hedge = new THREE.Mesh(boxGeo, hedgeMat);
      hedge.scale.set(2.4, 0.65, 0.9);
      hedge.position.set(sx * (halfSpan + 2.0), 0.35, 0);
      node.add(hedge);
    }

    // Dầm ngang bảng tên cổng
    const lintel = new THREE.Mesh(boxGeo, creamMat);
    lintel.scale.set(opts.span + 1.8, 1.15, 1.05);
    lintel.position.set(0, opts.height - 0.35, 0);
    lintel.castShadow = true;
    node.add(lintel);

    const signBoard = new THREE.Mesh(boxGeo, opts.signMat);
    signBoard.scale.set(opts.span - 0.4, 0.72, 1.14);
    signBoard.position.set(0, opts.height - 0.35, 0);
    node.add(signBoard);

    // Mái ngói / diềm mái pastel phía trên cổng
    const roofCap = new THREE.Mesh(boxGeo, opts.roofMat);
    roofCap.scale.set(opts.span + 2.5, 0.42, 1.55);
    roofCap.position.set(0, opts.height + 0.38, 0);
    node.add(roofCap);

    // Cột cờ nghi lễ phía trong sân
    if (opts.withFlagpole) {
      const fz = opts.flagOffsetZ ?? -8.5;
      const pedestal = new THREE.Mesh(cylGeo, warmStoneMat);
      pedestal.scale.set(1.35, 0.55, 1.35);
      pedestal.position.set(0, 0.28, fz);
      node.add(pedestal);

      const pole = new THREE.Mesh(cylGeo, poleMat);
      pole.scale.set(0.09, 10.5, 0.09);
      pole.position.set(0, 5.25, fz);
      node.add(pole);

      const flag = new THREE.Mesh(boxGeo, flagRedMat);
      flag.scale.set(1.8, 1.15, 0.06);
      flag.position.set(0.92, 9.8, fz);
      node.add(flag);
    }

    group.add(node);
  };

  // 1. Cổng & Sân nghi lễ UBND Phường Xuân Hòa (Neo vào osm_civic_ubnd_xuan_hoa)
  addArchGateAndFlag({
    landmarkId: 'gate_ubnd_xuan_hoa',
    lng: 105.724016,
    lat: 21.286863,
    rotY: -0.76,
    span: 8.2,
    height: 5.4,
    signMat: redSignMat,
    roofMat: terracottaMat,
    withFlagpole: true,
    flagOffsetZ: -8.0,
  });

  // 3. Cổng Chợ Xuân Hòa (Neo vào osm_market_cho_xuan_hoa)
  addArchGateAndFlag({
    landmarkId: 'gate_cho_xuan_hoa',
    lng: 105.730250,
    lat: 21.279750,
    rotY: 0.45,
    span: 9.0,
    height: 5.6,
    signMat: civicGoldMat,
    roofMat: terracottaMat,
    withFlagpole: false,
  });

  // 4. Cổng Trường THPT Xuân Hòa (Neo vào osm_way_662917178)
  addArchGateAndFlag({
    landmarkId: 'gate_thpt_xuan_hoa',
    lng: 105.721661,
    lat: 21.284455,
    rotY: 0.82,
    span: 8.4,
    height: 5.3,
    signMat: navySignMat,
    roofMat: terracottaMat,
    withFlagpole: true,
    flagOffsetZ: -7.5,
  });

  return group;
}

/**
 * Tạo Gizmo trực quan 3D chỉ hiển thị khi Admin đang chỉnh sửa Landmark (Phần 21):
 * - `● Anchor thật` (tại tọa độ địa lý Place / Building)
 * - `▣ Model center` (tại tâm mô hình 3D sau khi cộng offsetX/Y/Z)
 * - Đường nối `Anchor → Model`
 */
function createAdminLandmarkGizmoGroup(
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const gizmo = new THREE.Group();
  gizmo.name = 'AdminLandmarkBindingGizmo';
  gizmo.visible = false;

  const anchorMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const anchorRingMat = new THREE.MeshBasicMaterial({
    color: 0x059669,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.55,
  });
  const modelMat = new THREE.MeshBasicMaterial({
    color: 0x2563eb,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const modelRingMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.55,
  });
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xf59e0b,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });

  const sphereGeo = new THREE.SphereGeometry(1.35, 16, 16);
  const ringGeo = new THREE.RingGeometry(2.1, 3.1, 28);
  ringGeo.rotateX(-Math.PI / 2);
  const boxGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ]);

  disposables.push(
    anchorMat,
    anchorRingMat,
    modelMat,
    modelRingMat,
    lineMat,
    sphereGeo,
    ringGeo,
    boxGeo,
    lineGeo
  );

  const anchorMarker = new THREE.Group();
  anchorMarker.name = 'GizmoAnchorNode';
  const aSphere = new THREE.Mesh(sphereGeo, anchorMat);
  aSphere.position.y = 1.6;
  aSphere.renderOrder = 999;
  const aRing = new THREE.Mesh(ringGeo, anchorRingMat);
  aRing.position.y = 0.35;
  aRing.renderOrder = 998;
  anchorMarker.add(aSphere, aRing);

  const modelMarker = new THREE.Group();
  modelMarker.name = 'GizmoModelNode';
  const mBox = new THREE.Mesh(boxGeo, modelMat);
  mBox.position.y = 1.8;
  mBox.renderOrder = 999;
  const mRing = new THREE.Mesh(ringGeo, modelRingMat);
  mRing.position.y = 0.45;
  mRing.renderOrder = 998;
  modelMarker.add(mBox, mRing);

  const connectorLine = new THREE.Line(lineGeo, lineMat);
  connectorLine.name = 'GizmoConnectorLine';
  connectorLine.renderOrder = 997;
  connectorLine.frustumCulled = false;

  // Vòng xoay trực tiếp quanh Model (Direct Rotate Ring + Handle)
  const rotateRingGroup = new THREE.Group();
  rotateRingGroup.name = 'GizmoRotateRingGroup';
  const rotateRingGeo = new THREE.RingGeometry(19.5, 21.0, 64);
  rotateRingGeo.rotateX(-Math.PI / 2);
  const rotateRingMat = new THREE.MeshBasicMaterial({
    color: 0x2563eb,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.78,
  });
  const rotateRingMesh = new THREE.Mesh(rotateRingGeo, rotateRingMat);
  rotateRingMesh.name = 'GizmoRotateRingMesh';
  rotateRingMesh.position.y = 0.55;
  rotateRingMesh.renderOrder = 998;

  const rotateKnobGeo = new THREE.SphereGeometry(1.65, 16, 16);
  const rotateKnobMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    depthTest: false,
    transparent: true,
    opacity: 0.98,
  });
  const rotateKnobMesh = new THREE.Mesh(rotateKnobGeo, rotateKnobMat);
  rotateKnobMesh.name = 'GizmoRotateKnob';
  rotateKnobMesh.position.set(0, 0.9, 20.25);
  rotateKnobMesh.renderOrder = 999;
  rotateRingGroup.add(rotateRingMesh, rotateKnobMesh);

  // Viền Footprint công trình & Điểm Góc Chính (Primary Corner: Mái vòm vàng Nhà Trắng)
  const footprintPts: THREE.Vector3[] = [];
  for (let k = 0; k < 16; k++) footprintPts.push(new THREE.Vector3(0, 0, 0));
  const footprintGeo = new THREE.BufferGeometry().setFromPoints(footprintPts);
  const footprintMat = new THREE.LineBasicMaterial({
    color: 0xef4444,
    depthTest: false,
    transparent: true,
    opacity: 0.96,
  });
  const footprintLine = new THREE.LineLoop(footprintGeo, footprintMat);
  footprintLine.name = 'GizmoFootprintLine';
  footprintLine.renderOrder = 999;
  footprintLine.frustumCulled = false;

  // Marker Góc Bo Tròn / Primary Corner + 2 tia hướng mặt tiền A & B
  const cornerNode = new THREE.Group();
  cornerNode.name = 'GizmoPrimaryCornerNode';
  const cornerRingGeo = new THREE.RingGeometry(1.8, 3.0, 32);
  cornerRingGeo.rotateX(-Math.PI / 2);
  const cornerRingMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.92,
  });
  const cornerBeaconGeo = new THREE.CylinderGeometry(0.45, 0.45, 7.5, 12);
  const cornerBeaconMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
  const cRing = new THREE.Mesh(cornerRingGeo, cornerRingMat);
  cRing.position.y = 0.65;
  cRing.renderOrder = 999;
  const cBeacon = new THREE.Mesh(cornerBeaconGeo, cornerBeaconMat);
  cBeacon.position.y = 3.8;
  cBeacon.renderOrder = 999;
  cornerNode.add(cRing, cBeacon);

  const frontageLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ]);
  const frontageLineMat = new THREE.LineBasicMaterial({
    color: 0x10b981,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const frontageLine = new THREE.Line(frontageLineGeo, frontageLineMat);
  frontageLine.name = 'GizmoFrontageVectors';
  frontageLine.renderOrder = 999;
  frontageLine.frustumCulled = false;

  // Cụm 3 điểm căn A-B-C trên mặt đất
  const threePtGroup = new THREE.Group();
  threePtGroup.name = 'GizmoThreePointGroup';
  threePtGroup.visible = false;
  const ptColors = [0xef4444, 0x10b981, 0x3b82f6];
  for (let idx = 0; idx < 3; idx++) {
    const pMat = new THREE.MeshBasicMaterial({
      color: ptColors[idx],
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const pMesh = new THREE.Mesh(sphereGeo, pMat);
    pMesh.name = `Gizmo3Pt_${idx}`;
    pMesh.visible = false;
    pMesh.renderOrder = 1000;
    disposables.push(pMat);
    threePtGroup.add(pMesh);
  }

  disposables.push(
    rotateRingGeo,
    rotateRingMat,
    rotateKnobGeo,
    rotateKnobMat,
    footprintGeo,
    footprintMat,
    cornerRingGeo,
    cornerRingMat,
    cornerBeaconGeo,
    cornerBeaconMat,
    frontageLineGeo,
    frontageLineMat
  );

  gizmo.add(
    anchorMarker,
    modelMarker,
    connectorLine,
    rotateRingGroup,
    footprintLine,
    cornerNode,
    frontageLine,
    threePtGroup
  );
  return gizmo;
}

/**
 * Khởi tạo toàn bộ cụm công trình biểu tượng & danh thắng 3D liên kết với `LandmarkBindingRecord` (Phần 11–13, 25)
 */
export function createIconicLandmarksGroup(
  origin: City3DOrigin,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'IconicLandmarks3D';

  // 1. Khu Hiệu bộ A1–A3 ĐHSP Hà Nội 2 (Neo vào osm_building_a1_dhsp2)
  {
    const [x, y] = lngLatToLocal(origin, 105.726226, 21.281344);
    const baseElev = getElevationAtLngLat(105.726226, 21.281344);
    const model = createHPU2Landmark({ bearing: 225, scale: 1 });
    model.name = 'Landmark_hpu2_a1';
    model.userData.landmarkId = 'hpu2_a1';
    model.userData.placeId = 'osm_building_a1_dhsp2';
    model.userData.fallbackLngLat = [105.726226, 21.281344];
    model.userData.isTerrainBaseZero = false;
    model.position.set(x - 12.0, baseElev, -y + 6.5);
    model.rotation.y = -0.7854;
    disposables.push({ dispose: () => model.dispose() });
    root.add(model);
  }

  // 2. Quảng trường Con Chim Xanh (Neo vào osm_landmark_quang_truong_chim_xanh)
  {
    const [x, y] = lngLatToLocal(origin, 105.7257, 21.28078);
    const baseElev = getElevationAtLngLat(105.7257, 21.28078);
    const model = createChimXanh({ bearing: 45, scale: 0.48 });
    model.name = 'Landmark_quang_truong_chim_xanh';
    model.userData.landmarkId = 'quang_truong_chim_xanh';
    model.userData.placeId = 'osm_landmark_quang_truong_chim_xanh';
    model.userData.fallbackLngLat = [105.7257, 21.28078];
    model.userData.isTerrainBaseZero = false;
    model.position.set(x - 8.5, baseElev, -y + 8.5);
    model.rotation.y = 2.3562;
    model.scale.setScalar(0.48);
    disposables.push({ dispose: () => model.dispose() });
    root.add(model);
  }

  // 3. Trường Đại học Kiến trúc Hà Nội — Cơ sở Xuân Hòa (Neo vào osm_way_1079368029)
  {
    const [x, y] = lngLatToLocal(origin, 105.72852, 21.27876);
    const baseElev = getElevationAtLngLat(105.72852, 21.27876);
    const model = buildArchitectureUniversityModel(disposables);
    model.name = 'Landmark_dh_kien_truc';
    model.userData.landmarkId = 'dh_kien_truc';
    model.userData.placeId = 'osm_way_1079368029';
    model.userData.fallbackLngLat = [105.72852, 21.27876];
    model.userData.isTerrainBaseZero = false;
    model.position.set(x, baseElev, -y);
    model.rotation.y = -0.76;
    root.add(model);
  }

  // 4. Nhà Trắng Xuân Hòa (Neo vào osm_landmark_nha_trang_xuan_hoa)
  {
    const [x, y] = lngLatToLocal(origin, 105.729275, 21.278175);
    const baseElev = getElevationAtLngLat(105.729275, 21.278175);
    const model = createWhiteHouseModel();
    model.name = 'Landmark_nha_trang_xuan_hoa';
    model.userData.landmarkId = 'nha_trang_xuan_hoa';
    model.userData.placeId = 'osm_landmark_nha_trang_xuan_hoa';
    model.userData.fallbackLngLat = [105.729275, 21.278175];
    model.userData.isTerrainBaseZero = false;
    model.position.set(x + 6.5, baseElev, -y - 10.5);
    model.rotation.y = 1.0;
    model.scale.setScalar(0.92);
    disposables.push({ dispose: () => model.dispose() });
    root.add(model);
  }

  // 5. Vòng tròn 1 (Neo vào osm_landmark_vong_tron_1)
  {
    const [x, y] = lngLatToLocal(origin, 105.729416, 21.277632);
    const baseElev = getElevationAtLngLat(105.729416, 21.277632);
    const model = createVongTron1({ scale: 1, rotationY: 0 });
    model.name = 'Landmark_vong_tron_1';
    model.userData.landmarkId = 'vong_tron_1';
    model.userData.placeId = 'osm_landmark_vong_tron_1';
    model.userData.fallbackLngLat = [105.729416, 21.277632];
    model.userData.isTerrainBaseZero = false;
    model.position.set(x, baseElev, -y);
    model.rotation.y = 0;
    disposables.push({ dispose: () => model.dispose() });
    root.add(model);
  }

  // 6. Vòng tròn 2 (Neo vào osm_landmark_vong_tron_2)
  {
    const [x, y] = lngLatToLocal(origin, 105.725, 21.281565);
    const baseElev = getElevationAtLngLat(105.725, 21.281565);
    const model = createVongTron2({ bearing: 135, scale: 1 });
    model.name = 'Landmark_vong_tron_2';
    model.userData.landmarkId = 'vong_tron_2';
    model.userData.placeId = 'osm_landmark_vong_tron_2';
    model.userData.fallbackLngLat = [105.725, 21.281565];
    model.userData.isTerrainBaseZero = false;
    model.position.set(x, baseElev, -y);
    model.rotation.y = -0.7854;
    disposables.push({ dispose: () => model.dispose() });
    root.add(model);
  }

  // 7. Núi Thằn Lằn (Đồi Thằn Lằn) & Cụm Di tích Lịch sử Bốt Pháp (Neo vào osm_landmark_nui_than_lan)
  {
    const [x, y] = lngLatToLocal(origin, LIZARD_HILL_ANCHOR.lng, LIZARD_HILL_ANCHOR.lat);
    const hillModel = buildLizardHillAndFrenchFortModel(disposables);
    hillModel.name = 'Landmark_nui_than_lan';
    hillModel.userData.landmarkId = 'nui_than_lan';
    hillModel.userData.fallbackLngLat = [LIZARD_HILL_ANCHOR.lng, LIZARD_HILL_ANCHOR.lat];
    hillModel.userData.isTerrainBaseZero = true;
    hillModel.position.set(x, 0, -y);
    root.add(hillModel);
  }

  // 8. Cụm công trình điểm nhấn Level B (UBND Phường, Chợ Xuân Hòa, THPT Xuân Hòa)
  root.add(buildLevelBCivicAndCampusAccents(origin, disposables));

  // 9. Gizmo trực quan 3D cho Admin khi bật Mode A / Mode B (Phần 21)
  root.add(createAdminLandmarkGizmoGroup(disposables));

  return root;
}

export interface AdminLandmarkEditVisualState {
  activePlaceId?: string | null;
  mode?: 'mode_a_place' | 'mode_b_model' | null;
  subTool?: 'translate' | 'rotate' | 'scale' | 'pick_corner' | 'three_point' | null;
  previewPlaceLatLng?: { lat: number; lng: number } | null;
  previewBindingPatch?: Partial<LandmarkBindingRecord> | null;
  threePointWorld?: Array<{ x: number; y: number; z: number }>;
}

function setLandmarkNodeEditHighlight(node: THREE.Object3D, highlightTranslucent: boolean): void {
  node.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (highlightTranslucent) {
        if (!mat.userData.__isEditTranslucent) {
          mat.userData.__origTransparent = mat.transparent;
          mat.userData.__origOpacity = mat.opacity;
          mat.userData.__isEditTranslucent = true;
        }
        mat.transparent = true;
        mat.opacity = 0.76;
        mat.needsUpdate = true;
      } else if (mat.userData.__isEditTranslucent) {
        mat.transparent = Boolean(mat.userData.__origTransparent);
        mat.opacity = typeof mat.userData.__origOpacity === 'number' ? mat.userData.__origOpacity : 1;
        mat.userData.__isEditTranslucent = false;
        mat.needsUpdate = true;
      }
    }
  });
}

/**
 * ĐỒNG BỘ TỨC THÌ VỊ TRÍ / XOAY / TỶ LỆ CỦA TOÀN BỘ LANDMARK 3D THEO PLACE & BINDING (Phần 13, 21, 24, 27, 48).
 * Gọi hàm này mỗi khi:
 * - `places` thay đổi (Admin lưu vị trí mới hoặc kéo preview Mode A)
 * - `LandmarkBindingRecord` thay đổi (Admin chỉnh offsetX/Y/Z, xoay, scale ở Mode B)
 * Thời gian thực thi < 0.1ms, không cần reload trang hay dựng lại Worker!
 */
export function syncIconicLandmarksGroup(params: {
  rootGroup: THREE.Group | null;
  origin: City3DOrigin | null;
  places: PlaceLocation[];
  masterDataset?: MasterGeographyDataset | null;
  adminEditState?: AdminLandmarkEditVisualState | null;
}): void {
  const { rootGroup, origin, places, masterDataset, adminEditState } = params;
  if (!rootGroup || !origin) return;

  const placesById = new Map<string, PlaceLocation>();
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    placesById.set(p.id, p);
  }

  // Nếu Admin đang kéo thử vị trí mới ở Mode A (`previewPlaceLatLng`), áp dụng tạm thời lên Place đang chọn
  if (
    adminEditState?.activePlaceId &&
    adminEditState.previewPlaceLatLng &&
    placesById.has(adminEditState.activePlaceId)
  ) {
    const cur = placesById.get(adminEditState.activePlaceId)!;
    placesById.set(adminEditState.activePlaceId, {
      ...cur,
      lat: adminEditState.previewPlaceLatLng.lat,
      lng: adminEditState.previewPlaceLatLng.lng,
    });
  }

  let activeGizmoTransform: {
    landmarkId?: string;
    anchorX: number;
    anchorY: number;
    anchorZ: number;
    modelX: number;
    modelY: number;
    modelZ: number;
    rotationY: number;
    scale: number;
  } | null = null;

  const applyToLandmarkNode = (node: THREE.Object3D) => {
    const landmarkId = node.userData?.landmarkId as string | undefined;
    if (!landmarkId) return;

    const fallbackLngLat = (node.userData.fallbackLngLat as [number, number]) || [
      origin.lng,
      origin.lat,
    ];
    const isTerrainBaseZero = Boolean(node.userData.isTerrainBaseZero);

    // Kiểm tra xem node này có phải là Landmark đang được Admin chỉnh sửa trực tiếp không
    const baseResolved = resolveLandmarkWorldTransform({
      landmarkId,
      origin,
      placesById,
      fallbackLngLat,
      masterDataset,
      isTerrainBaseZero,
    });

    const isEditingThisPlace =
      Boolean(adminEditState?.activePlaceId) &&
      (baseResolved.placeId === adminEditState?.activePlaceId ||
        (adminEditState?.activePlaceId === 'osm_way_1080000083' && landmarkId === 'hpu2_a1'));

    const resolved =
      isEditingThisPlace && adminEditState?.previewBindingPatch
        ? resolveLandmarkWorldTransform({
            landmarkId,
            origin,
            placesById,
            fallbackLngLat,
            masterDataset,
            overrideBinding: adminEditState.previewBindingPatch,
            isTerrainBaseZero,
          })
        : baseResolved;

    node.position.set(resolved.modelWorldX, resolved.modelWorldY, resolved.modelWorldZ);
    node.rotation.y = resolved.rotationY;
    node.scale.setScalar(resolved.scale);
    node.visible = resolved.visible;

    setLandmarkNodeEditHighlight(
      node,
      Boolean(isEditingThisPlace && adminEditState?.mode === 'mode_b_model')
    );

    if (isEditingThisPlace && adminEditState?.mode) {
      activeGizmoTransform = {
        landmarkId,
        anchorX: resolved.anchorWorldX,
        anchorY: getElevationAtLngLat(resolved.anchorLng, resolved.anchorLat),
        anchorZ: resolved.anchorWorldZ,
        modelX: resolved.modelWorldX,
        modelY: getElevationAtLngLat(resolved.anchorLng, resolved.anchorLat) + resolved.binding.offsetY,
        modelZ: resolved.modelWorldZ,
        rotationY: resolved.rotationY,
        scale: resolved.scale,
      };
    }
  };

  for (let i = 0; i < rootGroup.children.length; i++) {
    const child = rootGroup.children[i];
    if (child.userData?.landmarkId) {
      applyToLandmarkNode(child);
    } else if (child.name === 'LevelBLandmarks3D') {
      for (let j = 0; j < child.children.length; j++) {
        applyToLandmarkNode(child.children[j]);
      }
    }
  }

  // Nếu địa điểm đang được Admin sửa không có trong 8 model custom (VD: một tòa nhà hoặc quán thường),
  // vẫn hiển thị Gizmo Anchor thật -> Model center nếu Admin bật Mode A hoặc Mode B!
  if (!activeGizmoTransform && adminEditState?.activePlaceId && adminEditState.mode) {
    const targetPlace = placesById.get(adminEditState.activePlaceId);
    if (targetPlace && targetPlace.lat !== null && targetPlace.lng !== null) {
      const [ax, ay] = lngLatToLocal(origin, targetPlace.lng, targetPlace.lat);
      const elev = getElevationAtLngLat(targetPlace.lng, targetPlace.lat);
      const offX = adminEditState.previewBindingPatch?.offsetX ?? 0;
      const offY = adminEditState.previewBindingPatch?.offsetY ?? 0;
      const offZ = adminEditState.previewBindingPatch?.offsetZ ?? 0;
      const rotY = adminEditState.previewBindingPatch?.rotationY ?? 0;
      const scl = adminEditState.previewBindingPatch?.scale ?? 1;
      activeGizmoTransform = {
        anchorX: ax,
        anchorY: elev,
        anchorZ: -ay,
        modelX: ax + offX,
        modelY: elev + offY,
        modelZ: -ay + offZ,
        rotationY: rotY,
        scale: scl,
      };
    }
  }

  // Cập nhật Gizmo 3D (Phần 20, 21, 24, 25)
  const gizmo = rootGroup.getObjectByName('AdminLandmarkBindingGizmo') as THREE.Group | undefined;
  if (gizmo) {
    if (activeGizmoTransform && adminEditState?.mode) {
      gizmo.visible = true;
      const anchorNode = gizmo.getObjectByName('GizmoAnchorNode');
      const modelNode = gizmo.getObjectByName('GizmoModelNode');
      const connectorLine = gizmo.getObjectByName('GizmoConnectorLine') as THREE.Line | undefined;
      const rotateRingGroup = gizmo.getObjectByName('GizmoRotateRingGroup') as THREE.Group | undefined;
      const footprintLine = gizmo.getObjectByName('GizmoFootprintLine') as THREE.LineLoop | undefined;
      const cornerNode = gizmo.getObjectByName('GizmoPrimaryCornerNode') as THREE.Group | undefined;
      const frontageLine = gizmo.getObjectByName('GizmoFrontageVectors') as THREE.Line | undefined;
      const threePtGroup = gizmo.getObjectByName('GizmoThreePointGroup') as THREE.Group | undefined;

      if (anchorNode) {
        anchorNode.position.set(
          activeGizmoTransform.anchorX,
          activeGizmoTransform.anchorY,
          activeGizmoTransform.anchorZ
        );
      }
      if (modelNode) {
        modelNode.position.set(
          activeGizmoTransform.modelX,
          activeGizmoTransform.modelY,
          activeGizmoTransform.modelZ
        );
      }
      if (connectorLine && connectorLine.geometry) {
        const posAttr = connectorLine.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (posAttr) {
          posAttr.setXYZ(
            0,
            activeGizmoTransform.anchorX,
            activeGizmoTransform.anchorY + 1.6,
            activeGizmoTransform.anchorZ
          );
          posAttr.setXYZ(
            1,
            activeGizmoTransform.modelX,
            activeGizmoTransform.modelY + 1.8,
            activeGizmoTransform.modelZ
          );
          posAttr.needsUpdate = true;
        }
      }

      const isModeB = adminEditState.mode === 'mode_b_model';
      const editAnchors = getLandmarkEditAnchors(activeGizmoTransform.landmarkId);

      if (rotateRingGroup) {
        rotateRingGroup.visible = isModeB;
        rotateRingGroup.position.set(
          activeGizmoTransform.modelX,
          activeGizmoTransform.modelY,
          activeGizmoTransform.modelZ
        );
        rotateRingGroup.rotation.y = activeGizmoTransform.rotationY;
      }

      if (footprintLine && footprintLine.geometry) {
        footprintLine.visible = isModeB;
        if (isModeB) {
          const poly = editAnchors.footprintPolygon;
          const posAttr = footprintLine.geometry.getAttribute('position') as THREE.BufferAttribute;
          if (posAttr && poly.length > 0) {
            for (let k = 0; k < 16; k++) {
              const pt = poly[k < poly.length ? k : poly.length - 1];
              const wPt = localModelPointToWorld(
                pt.x,
                pt.z,
                activeGizmoTransform.modelX,
                activeGizmoTransform.modelZ,
                activeGizmoTransform.rotationY,
                activeGizmoTransform.scale
              );
              posAttr.setXYZ(k, wPt.x, activeGizmoTransform.modelY + 0.65, wPt.z);
            }
            posAttr.needsUpdate = true;
            footprintLine.geometry.setDrawRange(0, poly.length);
          }
        }
      }

      if (cornerNode) {
        cornerNode.visible = isModeB;
        if (isModeB) {
          const wCorner = localModelPointToWorld(
            editAnchors.primaryCorner.x,
            editAnchors.primaryCorner.z,
            activeGizmoTransform.modelX,
            activeGizmoTransform.modelZ,
            activeGizmoTransform.rotationY,
            activeGizmoTransform.scale
          );
          cornerNode.position.set(wCorner.x, activeGizmoTransform.modelY, wCorner.z);
        }
      }

      if (frontageLine && frontageLine.geometry) {
        frontageLine.visible = isModeB;
        if (isModeB) {
          const wCorner = localModelPointToWorld(
            editAnchors.primaryCorner.x,
            editAnchors.primaryCorner.z,
            activeGizmoTransform.modelX,
            activeGizmoTransform.modelZ,
            activeGizmoTransform.rotationY,
            activeGizmoTransform.scale
          );
          const wFrontA = localModelPointToWorld(
            editAnchors.frontageA.x,
            editAnchors.frontageA.z,
            activeGizmoTransform.modelX,
            activeGizmoTransform.modelZ,
            activeGizmoTransform.rotationY,
            activeGizmoTransform.scale
          );
          const wFrontB = localModelPointToWorld(
            editAnchors.frontageB.x,
            editAnchors.frontageB.z,
            activeGizmoTransform.modelX,
            activeGizmoTransform.modelZ,
            activeGizmoTransform.rotationY,
            activeGizmoTransform.scale
          );
          const posAttr = frontageLine.geometry.getAttribute('position') as THREE.BufferAttribute;
          if (posAttr) {
            posAttr.setXYZ(0, wFrontA.x, activeGizmoTransform.modelY + 0.85, wFrontA.z);
            posAttr.setXYZ(1, wCorner.x, activeGizmoTransform.modelY + 0.85, wCorner.z);
            posAttr.setXYZ(2, wFrontB.x, activeGizmoTransform.modelY + 0.85, wFrontB.z);
            posAttr.needsUpdate = true;
          }
        }
      }

      if (threePtGroup) {
        const pts = adminEditState.threePointWorld || [];
        threePtGroup.visible = isModeB && pts.length > 0;
        for (let idx = 0; idx < 3; idx++) {
          const child = threePtGroup.getObjectByName(`Gizmo3Pt_${idx}`);
          if (child) {
            if (pts[idx]) {
              child.visible = true;
              child.position.set(pts[idx].x, pts[idx].y + 1.4, pts[idx].z);
            } else {
              child.visible = false;
            }
          }
        }
      }
    } else {
      gizmo.visible = false;
    }
  }
}
