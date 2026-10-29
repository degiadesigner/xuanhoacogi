import * as THREE from 'three';
import { lngLatToLocal, type City3DOrigin } from './city3d-shared';

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
 * Khởi tạo toàn bộ cụm 3 công trình biểu tượng 3D đặt đúng tọa độ và đúng hướng mặt tiền
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

  return root;
}
