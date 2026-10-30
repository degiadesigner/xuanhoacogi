import * as THREE from 'three';
import {
  LIZARD_HILL_ANCHOR,
  getLizardHillLocalHeight,
  lngLatToLocal,
  type City3DOrigin,
} from './city3d-shared';

export interface IconicLandmarkFootprint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  clearRadiusMeters: number;
}

/**
 * Tọa độ chuẩn thực tế của 3 công trình biểu tượng đặc trưng tại Phường Xuân Hòa:
 * 1. Quảng trường Con Chim Xanh: Đối diện Khu Hiệu bộ A1–A3 ĐHSP Hà Nội 2 (bên phía Tây Nam đường Nguyễn Văn Linh).
 * 2. Trường Đại học Kiến trúc Hà Nội — Cơ sở Xuân Hòa: Số 34 Đường Nguyễn Văn Linh (bên phía Đông Bắc đường Nguyễn Văn Linh).
 * 3. Nhà Trắng Xuân Hòa: Góc ngã giao Vòng tròn 1 (Đường Nguyễn Văn Linh — Phố Lê Xoay).
 */
export const ICONIC_LANDMARK_FOOTPRINTS: IconicLandmarkFootprint[] = [
  {
    id: 'osm_landmark_quang_truong_chim_xanh',
    name: 'Quảng trường Con Chim Xanh',
    lat: 21.28075,
    lng: 105.72567,
    clearRadiusMeters: 18,
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
 * 1. MÔ HÌNH 3D: QUẢNG TRƯỜNG CON CHIM XANH (Đối diện Khu Hiệu bộ ĐHSP Hà Nội 2)
 * Dựng nhẹ nhàng, gọn gàng và đúng tỷ lệ thực tế theo ảnh flycam:
 * - Sân quảng trường lát đá xám chữ nhật (rộng 16m × sâu 26m) lùi gọn vào trong ô đất, mở lối vào ở phía mặt đường Nguyễn Văn Linh (+Z).
 * - Ở cuối sân (z = -10.5m) quay mặt trực diện ra đường Nguyễn Văn Linh (+Z):
 *   Khán đài trắng gọn gàng với 3 bậc tam cấp xám, phía trên là biểu tượng Chim Bồ Câu Xanh (#38BDF8) đầu quay sang phải (+X) và cánh phụ màu đỏ (#DC2626) bên trái (-X).
 * - Dọc rìa phải (+X): Nhà mái ngói nâu "Mộc Café" + Nhà chòi tròn mái lá nâu đặc trưng + cụm chòi nhỏ phía sau.
 * - Dọc rìa trái (-X): 3 dãy nhà ki-ốt thấp mái tôn xám đậm xếp gọn gàng dọc biên sân.
 * - Phía đầu sân gần đường Nguyễn Văn Linh (+Z): 2 dải vườn cỏ xanh nhẹ nhàng cùng hàng cây bóng mát ở hai góc cổng vào.
 */
function buildBlueBirdSquareModel(
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // 1. Nền sân quảng trường lát đá xám nhạt (16m × 26m, không tràn ra đường/ngõ)
  const plazaGeo = track(new THREE.BoxGeometry(16.4, 0.14, 26.0));
  const plazaMat = track(
    new THREE.MeshLambertMaterial({ color: 0xc8c6be })
  );
  const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
  plazaMesh.position.set(0, 0.07, 0);
  plazaMesh.receiveShadow = true;
  group.add(plazaMesh);

  // Lòng sân đá trung tâm sáng nhẹ + mạch đá lát ngang dọc
  const centerCourtGeo = track(new THREE.BoxGeometry(9.6, 0.04, 23.6));
  const centerCourtMat = track(
    new THREE.MeshLambertMaterial({ color: 0xd6d4cc })
  );
  const centerCourt = new THREE.Mesh(centerCourtGeo, centerCourtMat);
  centerCourt.position.set(-0.2, 0.15, 0.5);
  centerCourt.receiveShadow = true;
  group.add(centerCourt);

  const seamMat = track(new THREE.MeshLambertMaterial({ color: 0xb4b2aa }));
  const seamHGeo = track(new THREE.BoxGeometry(9.4, 0.02, 0.08));
  for (let z = -8; z <= 10; z += 3) {
    const seam = new THREE.Mesh(seamHGeo, seamMat);
    seam.position.set(-0.2, 0.175, z);
    group.add(seam);
  }
  const seamVGeo = track(new THREE.BoxGeometry(0.08, 0.02, 22.0));
  for (const x of [-3.2, -0.2, 2.8]) {
    const seam = new THREE.Mesh(seamVGeo, seamMat);
    seam.position.set(x, 0.175, 0.5);
    group.add(seam);
  }

  // 2. Hai dải bồn cỏ xanh nhẹ ở lối vào phía mặt đường Nguyễn Văn Linh (z = +6.5m .. +11.2m)
  const grassMat = track(new THREE.MeshLambertMaterial({ color: 0x6a9955 }));
  const curbMat = track(new THREE.MeshLambertMaterial({ color: 0xe2e0d8 }));
  for (const side of [-1, 1]) {
    const lawnGeo = track(new THREE.BoxGeometry(2.6, 0.12, 5.2));
    const lawn = new THREE.Mesh(lawnGeo, grassMat);
    lawn.position.set(side * 4.4, 0.18, 8.2);
    group.add(lawn);

    const curbGeo = track(new THREE.BoxGeometry(2.8, 0.16, 5.4));
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(side * 4.4, 0.14, 8.2);
    group.add(curb);
  }

  // 3. Khán đài & Biểu tượng Con Chim Xanh ở cuối sân (z = -10.2m), hướng mặt về +Z (đường Nguyễn Văn Linh)
  const stageStepMat = track(new THREE.MeshLambertMaterial({ color: 0xd8dad9 }));
  for (let i = 0; i < 3; i++) {
    const stepGeo = track(
      new THREE.BoxGeometry(5.8 - i * 0.25, 0.18, 1.8 - i * 0.35)
    );
    const step = new THREE.Mesh(stepGeo, stageStepMat);
    step.position.set(-0.2, 0.22 + i * 0.18, -9.2 - i * 0.22);
    step.receiveShadow = true;
    group.add(step);
  }

  // Khung vòm khán đài trắng phía dưới cánh chim
  const stageWallMat = track(
    new THREE.MeshStandardMaterial({ color: 0xf4f5f6, roughness: 0.55 })
  );
  const stageBackGeo = track(new THREE.BoxGeometry(5.2, 2.6, 1.1));
  const stageBack = new THREE.Mesh(stageBackGeo, stageWallMat);
  stageBack.position.set(-0.2, 1.9, -10.35);
  stageBack.castShadow = true;
  stageBack.receiveShadow = true;
  group.add(stageBack);

  // Hốc sân khấu sâu bên trong
  const alcoveMat = track(new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
  const alcoveGeo = track(new THREE.BoxGeometry(3.8, 1.9, 0.25));
  const alcove = new THREE.Mesh(alcoveGeo, alcoveMat);
  alcove.position.set(-0.2, 1.75, -9.78);
  group.add(alcove);

  // Hai trụ xanh lam hai bên mặt khán đài
  const blueBirdMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x2ea3f2,
      roughness: 0.35,
      metalness: 0.05,
    })
  );
  const pillarGeo = track(new THREE.BoxGeometry(0.75, 2.7, 1.25));
  for (const sx of [-2.25, 1.85]) {
    const p = new THREE.Mesh(pillarGeo, blueBirdMat);
    p.position.set(sx, 1.95, -10.25);
    p.castShadow = true;
    group.add(p);
  }

  // Cánh phụ màu đỏ (#DC2626) bên trái khán đài (như trong ảnh flycam)
  const redWingShape = new THREE.Shape();
  redWingShape.moveTo(-1.8, 2.7);
  redWingShape.quadraticCurveTo(-3.2, 3.6, -3.7, 4.9);
  redWingShape.quadraticCurveTo(-2.6, 4.7, -1.6, 3.8);
  redWingShape.closePath();

  const redWingGeo = track(
    new THREE.ExtrudeGeometry(redWingShape, {
      depth: 0.55,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    })
  );
  const redWingMat = track(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 })
  );
  const redWingMesh = new THREE.Mesh(redWingGeo, redWingMat);
  redWingMesh.position.set(-0.2, 0, -10.65);
  redWingMesh.castShadow = true;
  group.add(redWingMesh);

  // Thân & Cánh Chim Bồ Câu Xanh (#2EA3F2) đúng dáng trong ảnh thực tế:
  // Cánh xanh vươn cao bên trái (-X), lưng võng ở giữa, đầu chim tròn quay sang bên phải (+X)
  const doveShape = new THREE.Shape();
  doveShape.moveTo(-2.65, 2.9);
  doveShape.quadraticCurveTo(-2.55, 4.6, -1.75, 5.75); // Đỉnh cánh trái
  doveShape.quadraticCurveTo(-0.85, 4.65, 0.25, 4.25); // Sống lưng võng xuống
  doveShape.quadraticCurveTo(0.95, 5.35, 1.75, 5.65); // Cổ & đỉnh đầu bên phải
  doveShape.quadraticCurveTo(2.45, 5.65, 2.65, 5.05); // Trán chim
  doveShape.lineTo(3.15, 4.88); // Mỏ chim nhọn hướng sang phải
  doveShape.lineTo(2.62, 4.65); // Dưới mỏ
  doveShape.quadraticCurveTo(2.95, 4.45, 3.25, 4.25); // Cánh nhỏ/ức vươn ra bên phải
  doveShape.quadraticCurveTo(2.65, 3.75, 2.15, 2.9); // Hạ xuống trụ phải
  doveShape.lineTo(-2.65, 2.9);
  doveShape.closePath();

  const doveGeo = track(
    new THREE.ExtrudeGeometry(doveShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    })
  );
  const doveMesh = new THREE.Mesh(doveGeo, blueBirdMat);
  doveMesh.position.set(-0.2, 0, -10.55);
  doveMesh.castShadow = true;
  doveMesh.receiveShadow = true;
  group.add(doveMesh);

  // Mắt chim trắng nhỏ trên đầu chim (bên phải)
  const eyeGeo = track(new THREE.CylinderGeometry(0.14, 0.14, 0.86, 12));
  eyeGeo.rotateX(Math.PI / 2);
  const whiteMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const eyeMesh = new THREE.Mesh(eyeGeo, whiteMat);
  eyeMesh.position.set(1.95, 5.15, -10.18);
  group.add(eyeMesh);

  // 4. Bên phải sân (x = +5.6m): Tổ hợp nhà mái ngói nâu "Mộc Café" & Nhà chòi tròn mái lá nâu (y hệt ảnh flycam)
  const thatchRoofMat = track(
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 })
  );
  const darkTileRoofMat = track(
    new THREE.MeshStandardMaterial({ color: 0x4a3528, roughness: 0.8 })
  );
  const warmWallMat = track(
    new THREE.MeshLambertMaterial({ color: 0xeaddc5 })
  );

  // 4a. Nhà chữ nhật mái dốc nâu (giữa biên phải, z = +1.8m)
  const cafeBodyGeo = track(new THREE.BoxGeometry(4.2, 2.6, 6.2));
  const cafeBody = new THREE.Mesh(cafeBodyGeo, warmWallMat);
  cafeBody.position.set(5.6, 1.35, 1.8);
  cafeBody.castShadow = true;
  cafeBody.receiveShadow = true;
  group.add(cafeBody);

  const cafeRoofGeo = track(new THREE.ConeGeometry(4.1, 2.1, 4));
  cafeRoofGeo.rotateY(Math.PI / 4);
  const cafeRoof = new THREE.Mesh(cafeRoofGeo, darkTileRoofMat);
  cafeRoof.scale.set(0.82, 1, 1.18);
  cafeRoof.position.set(5.6, 3.65, 1.8);
  cafeRoof.castShadow = true;
  group.add(cafeRoof);

  // 4b. Nhà chòi tròn mái lá nâu lớn (ngay phía sau nhà chữ nhật, z = -3.8m, cực kỳ nổi bật trong ảnh flycam)
  const rotundaWallGeo = track(new THREE.CylinderGeometry(2.55, 2.55, 2.3, 18));
  const rotundaWall = new THREE.Mesh(rotundaWallGeo, warmWallMat);
  rotundaWall.position.set(5.4, 1.2, -3.8);
  rotundaWall.castShadow = true;
  rotundaWall.receiveShadow = true;
  group.add(rotundaWall);

  const rotundaRoofGeo = track(new THREE.ConeGeometry(3.25, 2.4, 20));
  const rotundaRoof = new THREE.Mesh(rotundaRoofGeo, thatchRoofMat);
  rotundaRoof.position.set(5.4, 3.5, -3.8);
  rotundaRoof.castShadow = true;
  group.add(rotundaRoof);

  // 4c. Cụm chòi nhỏ mái nâu phía sau nhà chòi tròn (z = -7.8m .. -9.5m)
  for (const [hx, hz] of [
    [4.2, -7.4],
    [6.1, -7.8],
    [4.8, -9.3],
  ]) {
    const hutBase = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.5, 1.6, 1.5)),
      warmWallMat
    );
    hutBase.position.set(hx, 0.85, hz);
    group.add(hutBase);

    const hutRoof = new THREE.Mesh(
      track(new THREE.ConeGeometry(1.3, 1.0, 4)),
      thatchRoofMat
    );
    hutRoof.rotation.y = Math.PI / 4;
    hutRoof.position.set(hx, 2.15, hz);
    hutRoof.castShadow = true;
    group.add(hutRoof);
  }

  // 5. Bên trái sân (x = -6.2m): 3 dãy ki-ốt thấp mái tôn xám xanh xếp thẳng hàng dọc rìa trái (như ảnh flycam)
  const kioskWallMat = track(
    new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
  );
  const kioskRoofMat = track(
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65 })
  );
  for (const kz of [-4.8, 0.2, 5.2]) {
    const kBody = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.4, 2.1, 3.8)),
      kioskWallMat
    );
    kBody.position.set(-6.1, 1.1, kz);
    kBody.castShadow = true;
    kBody.receiveShadow = true;
    group.add(kBody);

    const kRoof = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.7, 0.22, 4.1)),
      kioskRoofMat
    );
    kRoof.position.set(-6.1, 2.25, kz);
    kRoof.castShadow = true;
    group.add(kRoof);
  }

  // 6. Cây xanh bóng mát ở hai góc lối vào mặt đường Nguyễn Văn Linh (+Z) và dọc rìa
  const trunkMat = track(new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
  const foliageDarkMat = track(
    new THREE.MeshLambertMaterial({ color: 0x3b6e28 })
  );
  const foliageLightMat = track(
    new THREE.MeshLambertMaterial({ color: 0x4d8a35 })
  );
  const treeCoords: Array<[number, number, number]> = [
    [-5.2, 10.2, 1.25],
    [-3.6, 9.2, 1.0],
    [5.2, 10.2, 1.25],
    [3.8, 9.0, 0.95],
    [-4.8, -9.8, 1.05],
  ];
  for (const [tx, tz, sc] of treeCoords) {
    const trunk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.18 * sc, 0.24 * sc, 1.8 * sc, 7)),
      trunkMat
    );
    trunk.position.set(tx, 0.9 * sc, tz);
    group.add(trunk);

    const crown = new THREE.Mesh(
      track(new THREE.DodecahedronGeometry(1.45 * sc, 1)),
      sc > 1.1 ? foliageDarkMat : foliageLightMat
    );
    crown.position.set(tx, 2.5 * sc, tz);
    crown.castShadow = true;
    group.add(crown);
  }

  return group;
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
 * 3. MÔ HÌNH 3D: NHÀ TRẮNG XUÂN HÒA (Góc ngã giao Vòng tròn 1: Nguyễn Văn Linh — Lê Xoay)
 * Dựng chuẩn theo ảnh chụp thực tế tại ngã giao Vòng tròn 1:
 * - Tòa lâu đài tân cổ điển màu trắng kem (#F7F5EE) thiết kế góc chữ V ôm hai mặt phố:
 *   + Khối trụ tròn ở chính giữa góc ngã tư, phía trên là Mái Vòm Vàng (#EAB308) và cờ đỏ trên đỉnh
 *   + Màn hình LED đen lớn viền bạc trắng gắn nổi ở tầng 2 mặt chính diện khối trụ tròn
 *   + Tầng 1 khối trụ tròn có bậc tam cấp bán nguyệt xám đậm và 2 cửa kính xanh ngân hàng
 *   + Hai cánh tòa nhà 4 tầng mở chếch về 2 bên ôm theo Đường Nguyễn Văn Linh (cánh trái) và Phố Lê Xoay (cánh phải), có hệ cột tân cổ điển, cửa sổ vòm kính tối màu và cầu thang bộ trắng ở cánh trái.
 */
function buildWhiteHouseModel(
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const creamWhiteMat = track(
    new THREE.MeshStandardMaterial({ color: 0xf7f5ee, roughness: 0.42 })
  );
  const corniceMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe5e2d9, roughness: 0.5 })
  );
  const darkPlinthMat = track(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
  );
  const darkWindowMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.25,
      metalness: 0.25,
    })
  );
  const goldDomeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.32,
      metalness: 0.35,
    })
  );

  // 1. Nền vỉa hè lát gạch gọn quanh chân tòa nhà
  const basePaveGeo = track(new THREE.CylinderGeometry(10.2, 10.2, 0.14, 24));
  const basePaveMat = track(new THREE.MeshLambertMaterial({ color: 0xc8beb4 }));
  const basePave = new THREE.Mesh(basePaveGeo, basePaveMat);
  basePave.position.set(0, 0.07, -0.8);
  basePave.receiveShadow = true;
  group.add(basePave);

  // 2. KHỐI TRỤ TRÒN TRUNG TÂM GÓC NGÃ TƯ (tại x = 0, z = +2.2m, hướng thẳng ra Vòng tròn 1 +Z)
  const rotZ = 2.2;

  // Bậc tam cấp bán nguyệt màu xám đậm dưới chân khối trụ tròn
  for (let s = 0; s < 3; s++) {
    const stepGeo = track(
      new THREE.CylinderGeometry(3.85 - s * 0.22, 3.95 - s * 0.22, 0.16, 24)
    );
    const step = new THREE.Mesh(stepGeo, darkPlinthMat);
    step.position.set(0, 0.18 + s * 0.14, rotZ + 0.25);
    group.add(step);
  }

  // Thân trụ tròn chính (cao 11.5m)
  const rotundaGeo = track(new THREE.CylinderGeometry(3.35, 3.45, 11.5, 28));
  const rotunda = new THREE.Mesh(rotundaGeo, creamWhiteMat);
  rotunda.position.set(0, 5.9, rotZ);
  rotunda.castShadow = true;
  rotunda.receiveShadow = true;
  group.add(rotunda);

  // Chân đế đá đen quanh tầng 1 trụ tròn
  const plinthGeo = track(new THREE.CylinderGeometry(3.5, 3.52, 0.9, 28));
  const plinth = new THREE.Mesh(plinthGeo, darkPlinthMat);
  plinth.position.set(0, 0.6, rotZ);
  group.add(plinth);

  // Phào chỉ tròn phân tầng của khối trụ
  for (const ry of [4.2, 8.2, 11.6]) {
    const ringGeo = track(new THREE.CylinderGeometry(3.62, 3.62, 0.34, 28));
    const ring = new THREE.Mesh(ringGeo, corniceMat);
    ring.position.set(0, ry, rotZ);
    group.add(ring);
  }

  // 2 cửa ngân hàng màu xanh lục đậm ở tầng 1 khối trụ tròn (y hệt ảnh chụp thực tế)
  const bankDoorMat = track(
    new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.35 })
  );
  const doorGeo = track(new THREE.BoxGeometry(0.95, 2.3, 0.35));
  for (const angle of [-0.42, 0.42]) {
    const door = new THREE.Mesh(doorGeo, bankDoorMat);
    door.position.set(
      Math.sin(angle) * 3.35,
      1.65,
      rotZ + Math.cos(angle) * 3.35
    );
    door.rotation.y = angle;
    group.add(door);
  }

  // 3 ô cửa sổ vòm kính tối màu ở tầng 3 khối trụ tròn (phía trên màn hình LED)
  for (const angle of [-0.52, 0, 0.52]) {
    const win = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.05, 2.1, 0.25)),
      darkWindowMat
    );
    win.position.set(
      Math.sin(angle) * 3.36,
      9.8,
      rotZ + Math.cos(angle) * 3.36
    );
    win.rotation.y = angle;
    group.add(win);
  }

  // MÀN HÌNH LED ĐEN LỚN VIỀN BẠC TRẮNG ở tầng 2 mặt trước khối trụ tròn (điểm nhận diện nổi bật nhất trong ảnh chụp)
  const ledFrameGeo = track(new THREE.BoxGeometry(5.4, 3.6, 0.45));
  const ledFrameMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 })
  );
  const ledFrame = new THREE.Mesh(ledFrameGeo, ledFrameMat);
  ledFrame.position.set(0, 6.0, rotZ + 3.45);
  ledFrame.castShadow = true;
  group.add(ledFrame);

  const ledScreenGeo = track(new THREE.BoxGeometry(4.65, 3.05, 0.5));
  const ledScreenMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.2,
      metalness: 0.15,
    })
  );
  const ledScreen = new THREE.Mesh(ledScreenGeo, ledScreenMat);
  ledScreen.position.set(0, 6.0, rotZ + 3.46);
  group.add(ledScreen);

  // Cổ vòm (drum) trắng có ô cửa nhỏ + MÁI VÒM VÀNG (#EAB308) trên đỉnh khối trụ
  const drumGeo = track(new THREE.CylinderGeometry(2.45, 2.65, 2.0, 20));
  const drum = new THREE.Mesh(drumGeo, creamWhiteMat);
  drum.position.set(0, 12.6, rotZ);
  drum.castShadow = true;
  group.add(drum);

  for (const a of [-0.7, 0, 0.7]) {
    const dWin = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.55, 0.75, 0.2)),
      darkWindowMat
    );
    dWin.position.set(
      Math.sin(a) * 2.52,
      12.55,
      rotZ + Math.cos(a) * 2.52
    );
    dWin.rotation.y = a;
    group.add(dWin);
  }

  const domeRing = new THREE.Mesh(
    track(new THREE.CylinderGeometry(2.65, 2.65, 0.25, 24)),
    goldDomeMat
  );
  domeRing.position.set(0, 13.65, rotZ);
  group.add(domeRing);

  const domeGeo = track(
    new THREE.SphereGeometry(2.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  );
  const dome = new THREE.Mesh(domeGeo, goldDomeMat);
  dome.scale.set(1, 0.88, 1);
  dome.position.set(0, 13.7, rotZ);
  dome.castShadow = true;
  group.add(dome);

  // Chóp nhọn & ngôi sao/cờ đỏ nhỏ trên đỉnh vòm vàng
  const spire = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.06, 0.18, 1.1, 10)),
    goldDomeMat
  );
  spire.position.set(0, 16.2, rotZ);
  group.add(spire);

  const redStarMat = track(new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
  const topFlag = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.55, 0.38, 0.06)),
    redStarMat
  );
  topFlag.position.set(0.22, 16.65, rotZ);
  group.add(topFlag);

  // 3. HAI CÁNH TÒA NHÀ 4 TẦNG MỞ CHẾCH HÌNH CHỮ V ÔM HAI MẶT PHỐ (Nguyễn Văn Linh & Lê Xoay)
  for (const side of [-1, 1]) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(side * 5.8, 0, -0.8);
    wingGroup.rotation.y = side * -0.46; // Mở góc chữ V ôm theo hai mặt đường

    // Khối thân 3 tầng chính của mỗi cánh (rộng 9.6m, cao 11.2m, sâu 6.8m)
    const wingBody = new THREE.Mesh(
      track(new THREE.BoxGeometry(9.6, 11.2, 6.8)),
      creamWhiteMat
    );
    wingBody.position.set(0, 5.7, 0);
    wingBody.castShadow = true;
    wingBody.receiveShadow = true;
    wingGroup.add(wingBody);

    // Tầng 4 (tầng áp mái giật cấp tân cổ điển phía trên, cao thêm 3.2m)
    const upperTier = new THREE.Mesh(
      track(new THREE.BoxGeometry(8.2, 3.2, 5.8)),
      creamWhiteMat
    );
    upperTier.position.set(-side * 0.4, 12.8, -0.2);
    upperTier.castShadow = true;
    wingGroup.add(upperTier);

    // Phào chỉ ngang các tầng
    for (const wy of [4.1, 8.1, 11.3, 14.4]) {
      const wCornice = new THREE.Mesh(
        track(new THREE.BoxGeometry(9.9, 0.32, 7.1)),
        corniceMat
      );
      wCornice.position.set(0, wy, 0);
      wingGroup.add(wCornice);
    }

    // Hệ cột pilaster trắng đứng & 3 nhịp cửa sổ kính tối màu trên mặt tiền mỗi cánh
    for (let col = -3.8; col <= 3.8; col += 2.53) {
      const pilaster = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.48, 11.0, 7.05)),
        corniceMat
      );
      pilaster.position.set(col, 5.7, 0);
      wingGroup.add(pilaster);
    }

    for (const wx of [-2.53, 0, 2.53]) {
      // Cửa kính tầng 1, tầng 2, tầng 3
      for (const wy of [2.1, 6.1, 9.7]) {
        const win = new THREE.Mesh(
          track(new THREE.BoxGeometry(1.55, 2.2, 0.25)),
          darkWindowMat
        );
        win.position.set(wx, wy, 3.35);
        wingGroup.add(win);
      }
      // Cửa sổ vòm tầng 4
      const topWin = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.15, 1.8, 0.25)),
        darkWindowMat
      );
      topWin.position.set(wx - side * 0.3, 12.7, 2.75);
      wingGroup.add(topWin);
    }

    group.add(wingGroup);
  }

  // Khối hậu trung tâm nối liền hai cánh phía sau trụ tròn (tạo khối Gable cao ở đỉnh sau vòm vàng như ảnh chụp)
  const rearCore = new THREE.Mesh(
    track(new THREE.BoxGeometry(7.2, 15.4, 6.4)),
    creamWhiteMat
  );
  rearCore.position.set(0, 7.8, -1.6);
  rearCore.castShadow = true;
  group.add(rearCore);

  const topPediment = new THREE.Mesh(
    track(new THREE.BoxGeometry(4.2, 1.6, 5.2)),
    creamWhiteMat
  );
  topPediment.position.set(0, 16.1, -1.5);
  group.add(topPediment);

  // Cây xanh vỉa hè hai bên mặt phố (nhẹ nhàng, đúng vị trí hai hàng cây trong ảnh Street View)
  const trunkMat = track(new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
  const leafMat = track(new THREE.MeshLambertMaterial({ color: 0x3f7a2c }));
  for (const [tx, tz, sc] of [
    [-8.2, 3.8, 1.15],
    [7.8, 3.6, 1.2],
  ]) {
    const trunk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.16 * sc, 0.22 * sc, 2.0 * sc, 7)),
      trunkMat
    );
    trunk.position.set(tx, 1.0 * sc, tz);
    group.add(trunk);

    const crown = new THREE.Mesh(
      track(new THREE.DodecahedronGeometry(1.35 * sc, 1)),
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
 * Khởi tạo toàn bộ cụm công trình biểu tượng & danh thắng 3D đặt đúng tọa độ thực tế
 */
export function createIconicLandmarksGroup(
  origin: City3DOrigin,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'IconicLandmarks3D';

  // 1. Quảng trường Con Chim Xanh (Đối diện Khu Hiệu bộ A1–A3 ĐHSP2, bên Tây Nam đường Nguyễn Văn Linh)
  // Hướng mặt tiền (+Z) quay sang Đông Bắc (+136.8° = 2.39 rad) nhìn thẳng ra đường Nguyễn Văn Linh và Hiệu bộ A1–A3
  {
    const [x, y] = lngLatToLocal(origin, 105.72567, 21.28075);
    const model = buildBlueBirdSquareModel(disposables);
    model.position.set(x, 0, -y);
    model.rotation.y = 2.39;
    root.add(model);
  }

  // 2. Trường Đại học Kiến trúc Hà Nội — Cơ sở Xuân Hòa (Số 34 Đường Nguyễn Văn Linh)
  // Nằm bên Đông Bắc đường Nguyễn Văn Linh, hướng cổng & mặt tiền (+Z) quay sang Tây Nam (-43.5° = -0.76 rad) ra đường Nguyễn Văn Linh
  {
    const [x, y] = lngLatToLocal(origin, 105.72852, 21.27876);
    const model = buildArchitectureUniversityModel(disposables);
    model.position.set(x, 0, -y);
    model.rotation.y = -0.76;
    root.add(model);
  }

  // 3. Nhà Trắng Xuân Hòa (Góc Bắc ngã giao Vòng tròn 1: Đường Nguyễn Văn Linh — Phố Lê Xoay)
  // Hướng khối trụ tròn & màn hình LED (+Z) quay thẳng ra tâm ngã giao Vòng tròn 1 (-0.18 rad)
  {
    const [x, y] = lngLatToLocal(origin, 105.729275, 21.278175);
    const model = buildWhiteHouseModel(disposables);
    model.position.set(x, 0, -y);
    model.rotation.y = -0.18;
    root.add(model);
  }

  // 4. Núi Thằn Lằn (Đồi Thằn Lằn) & Cụm Di tích Lịch sử Bốt Pháp (1950)
  {
    const [x, y] = lngLatToLocal(origin, LIZARD_HILL_ANCHOR.lng, LIZARD_HILL_ANCHOR.lat);
    const hillModel = buildLizardHillAndFrenchFortModel(disposables);
    hillModel.position.set(x, 0, -y);
    root.add(hillModel);
  }

  return root;
}
