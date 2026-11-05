import * as THREE from 'three';

export type XuanHoaSchoolVariant = 'primary' | 'secondary';

export interface XuanHoaSchoolModel extends THREE.Group {
  dispose: () => void;
}

export type SchoolLandmarkGroup = XuanHoaSchoolModel;

export interface SchoolGateOptions {
  variant?: XuanHoaSchoolVariant;
  kind?: XuanHoaSchoolVariant;
  includeFence?: boolean;
  includeEnvironment?: boolean;
  title?: string;
}

export interface SchoolCampusOptions {
  variant?: XuanHoaSchoolVariant;
}

export const CAMPUS_LOCATIONS = {
  primary: {
    name: 'Trường Tiểu học Xuân Hòa',
    lat: 21.2819871,
    lng: 105.7275988,
  },
  secondary: {
    name: 'Trường THCS Xuân Hòa',
    lat: 21.2820837,
    lng: 105.7265017,
  },
} as const;

export const SCHOOL_GATE_METADATA = CAMPUS_LOCATIONS;

export const XUAN_HOA_PRIMARY_SCHOOL_ANCHOR = {
  placeId: 'osm_way_1079368030',
  buildingId: 'bldg_osm_way_1289786132',
  verifiedPlaceLat: 21.282057,
  verifiedPlaceLng: 105.727521,
  sourceReferenceLat: CAMPUS_LOCATIONS.primary.lat,
  sourceReferenceLng: CAMPUS_LOCATIONS.primary.lng,
} as const;

export const XUAN_HOA_SECONDARY_SCHOOL_ANCHOR = {
  placeId: 'osm_way_662917176',
  buildingId: 'bldg_osm_way_1289786126',
  verifiedPlaceLat: 21.282025,
  verifiedPlaceLng: 105.72646,
  sourceReferenceLat: CAMPUS_LOCATIONS.secondary.lat,
  sourceReferenceLng: CAMPUS_LOCATIONS.secondary.lng,
} as const;

const SharedGeo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 4),
  sphere: new THREE.IcosahedronGeometry(1, 1),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 24),
};

SharedGeo.cone.rotateY(Math.PI / 4);

function makeMat(
  color: number,
  roughness = 0.8,
  metalness = 0.05,
  extra: THREE.MeshStandardMaterialParameters = {}
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const m = new THREE.Mesh(SharedGeo.box, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  parent.add(m);
  return m;
}

function addCyl(
  parent: THREE.Object3D,
  rt: number,
  rb: number,
  h: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  segs = 12
): THREE.Mesh {
  const geo = segs === 12 ? SharedGeo.cyl : new THREE.CylinderGeometry(1, 1, 1, segs);
  const m = new THREE.Mesh(geo, material);
  m.scale.set(rt, h, rb);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (geo !== SharedGeo.cyl) {
    m.userData.ownGeo = geo;
  }
  parent.add(m);
  return m;
}

function createTextTexture({
  title = 'TRƯỜNG TIỂU HỌC XUÂN HÒA',
  subtitle = '',
  bg = '#1e5aa8',
  border = '#e8c15a',
  color = '#ffffff',
  subColor = '#ffd86b',
  width = 1024,
  height = 256,
}: {
  title?: string;
  subtitle?: string;
  bg?: string;
  border?: string;
  color?: string;
  subColor?: string;
  width?: number;
  height?: number;
}): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = border;
    ctx.lineWidth = Math.max(6, height * 0.04);
    ctx.strokeRect(10, 10, width - 20, height - 20);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (subtitle) {
      ctx.fillStyle = subColor;
      ctx.font = `700 ${Math.floor(height * 0.2)}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(subtitle, width / 2, height * 0.3);

      ctx.fillStyle = color;
      ctx.font = `800 ${Math.floor(height * 0.32)}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(title, width / 2, height * 0.67);
    } else {
      ctx.fillStyle = color;
      ctx.font = `800 ${Math.floor(height * 0.36)}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(title, width / 2, height * 0.52);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function disposeGateHierarchy(root: THREE.Object3D, sharedGeoSet: Set<THREE.BufferGeometry>): void {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const geometries = new Set<THREE.BufferGeometry>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry && !sharedGeoSet.has(mesh.geometry)) {
      geometries.add(mesh.geometry);
    }
    if (mesh.userData?.ownGeo) {
      geometries.add(mesh.userData.ownGeo as THREE.BufferGeometry);
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (!m) return;
      materials.add(m);
      const stdMat = m as THREE.MeshStandardMaterial;
      if (stdMat.map) textures.add(stdMat.map);
    });
  });

  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  geometries.forEach((g) => g.dispose());
}

/**
 * Primary school entrance gate ("TRƯỜNG TIỂU HỌC XUÂN HÒA").
 * Local origin: ground center of the main carriageway opening, +Z facing outward (street).
 */
export function createPrimarySchoolGate(options: SchoolGateOptions = {}): THREE.Group {
  const { includeFence = true, title = 'TRƯỜNG TIỂU HỌC XUÂN HÒA' } = options;

  const group = new THREE.Group();
  group.name = 'PrimarySchoolGate';

  const mat = {
    pillar: makeMat(0xf4efe4, 0.78),
    pillarTrim: makeMat(0xd9cdb8, 0.8),
    baseStone: makeMat(0x5d646b, 0.88),
    roofTile: makeMat(0xb63d2c, 0.68),
    roofRidge: makeMat(0x7e261a, 0.72),
    gateRed: makeMat(0x9b2420, 0.5, 0.35),
    gold: makeMat(0xd9ad42, 0.38, 0.55),
    darkIron: makeMat(0x2d3238, 0.5, 0.5),
    wallCream: makeMat(0xede2c9, 0.85),
    guardWall: makeMat(0xf2ead9, 0.82),
    windowGlass: makeMat(0x527a9a, 0.25, 0.2, { transparent: true, opacity: 0.78 }),
  };

  const mainSpan = 6.2;
  const halfSpan = mainSpan / 2;
  const sideSpan = 2.1;

  function buildPillar(x: number, w = 0.78, h = 4.2): void {
    addBox(group, w + 0.14, 0.45, w + 0.14, x, 0.225, 0, mat.baseStone);
    addBox(group, w, h - 0.45, w, x, 0.45 + (h - 0.45) / 2, 0, mat.pillar);
    addBox(group, w + 0.08, 0.12, w + 0.08, x, 1.35, 0, mat.pillarTrim);
    addBox(group, w + 0.08, 0.12, w + 0.08, x, h - 0.35, 0, mat.pillarTrim);
    addBox(group, w + 0.24, 0.18, w + 0.24, x, h + 0.09, 0, mat.pillarTrim);
    const cap = new THREE.Mesh(SharedGeo.cone, mat.roofTile);
    cap.scale.set(w * 0.82, 0.42, w * 0.82);
    cap.position.set(x, h + 0.39, 0);
    cap.castShadow = true;
    group.add(cap);
  }

  buildPillar(-halfSpan, 0.82, 4.35);
  buildPillar(halfSpan, 0.82, 4.35);
  buildPillar(-halfSpan - sideSpan, 0.64, 3.35);
  buildPillar(halfSpan + sideSpan, 0.64, 3.35);

  const beamW = mainSpan + 1.05;
  addBox(group, beamW, 0.82, 0.62, 0, 3.95, 0, mat.pillar);
  addBox(group, beamW + 0.2, 0.12, 0.76, 0, 3.5, 0, mat.pillarTrim);
  addBox(group, beamW + 0.28, 0.14, 0.84, 0, 4.42, 0, mat.pillarTrim);

  const signTex = createTextTexture({
    title,
    subtitle: 'UBND PHƯỜNG XUÂN HÒA',
    bg: '#1c56a3',
    border: '#ecc458',
    color: '#ffffff',
    subColor: '#ffe07d',
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex ?? undefined,
    color: signTex ? 0xffffff : 0x1c56a3,
    roughness: 0.45,
    metalness: 0.08,
  });

  const signW = mainSpan - 0.35;
  addBox(group, signW + 0.12, 0.74, 0.1, 0, 3.96, 0.31, mat.gold);
  addBox(group, signW, 0.64, 0.04, 0, 3.96, 0.35, signMat);
  addBox(group, signW, 0.64, 0.04, 0, 3.96, -0.35, signMat);

  addBox(group, beamW + 0.75, 0.12, 1.35, 0, 4.55, 0, mat.roofTile);
  const roofPrism = new THREE.Mesh(SharedGeo.cone, mat.roofTile);
  roofPrism.scale.set((beamW + 0.55) * 0.72, 0.55, 1.05);
  roofPrism.position.set(0, 4.88, 0);
  roofPrism.castShadow = true;
  group.add(roofPrism);
  addBox(group, beamW * 0.78, 0.1, 0.18, 0, 5.1, 0, mat.roofRidge);

  function buildGateLeaf(pivotX: number, dir: number, leafW: number, leafH: number): THREE.Group {
    const leaf = new THREE.Group();
    leaf.position.set(pivotX, 0, 0);
    const cx = (dir * leafW) / 2;

    addBox(leaf, leafW, 0.08, 0.06, cx, 0.25, 0, mat.gateRed);
    addBox(leaf, leafW, 0.08, 0.06, cx, 1.15, 0, mat.gateRed);
    addBox(leaf, leafW, 0.09, 0.07, cx, leafH, 0, mat.gateRed);
    addBox(leaf, 0.08, leafH, 0.07, dir * 0.04, leafH / 2 + 0.12, 0, mat.gateRed);
    addBox(leaf, 0.08, leafH, 0.07, dir * (leafW - 0.04), leafH / 2 + 0.12, 0, mat.gateRed);

    const bars = 9;
    for (let i = 1; i < bars; i++) {
      const bx = dir * (i / bars) * leafW;
      addBox(leaf, 0.03, leafH - 0.1, 0.03, bx, leafH / 2 + 0.12, 0, mat.gateRed, false);
      addBox(leaf, 0.05, 0.12, 0.05, bx, leafH + 0.18, 0, mat.gold, false);
    }

    const ring = new THREE.Mesh(SharedGeo.torus, mat.gold);
    ring.scale.set(0.32, 0.32, 0.4);
    ring.position.set(cx, 1.55, 0);
    leaf.add(ring);

    addBox(leaf, leafW - 0.18, 0.52, 0.025, cx, 0.68, 0, mat.gateRed, false);
    addBox(leaf, leafW - 0.3, 0.36, 0.035, cx, 0.68, 0, mat.gold, false);

    return leaf;
  }

  const leafW = (mainSpan - 0.86) / 2;
  const leftLeaf = buildGateLeaf(-halfSpan + 0.41, 1, leafW, 2.35);
  const rightLeaf = buildGateLeaf(halfSpan - 0.41, -1, leafW, 2.35);
  leftLeaf.rotation.y = -Math.PI * 0.38;
  rightLeaf.rotation.y = Math.PI * 0.38;
  group.add(leftLeaf, rightLeaf);

  function buildSideWicket(xCenter: number, w: number): void {
    addBox(group, w, 0.07, 0.05, xCenter, 0.22, 0, mat.gateRed);
    addBox(group, w, 0.07, 0.05, xCenter, 2.1, 0, mat.gateRed);
    const count = 6;
    for (let i = 0; i <= count; i++) {
      const bx = xCenter - w / 2 + (i / count) * w;
      addBox(group, 0.03, 1.9, 0.03, bx, 1.16, 0, mat.gateRed, false);
      addBox(group, 0.045, 0.1, 0.045, bx, 2.18, 0, mat.gold, false);
    }
  }
  buildSideWicket(-halfSpan - sideSpan / 2, sideSpan - 0.72);
  buildSideWicket(halfSpan + sideSpan / 2, sideSpan - 0.72);

  const ghX = -halfSpan - sideSpan - 2.05;
  const ghZ = -1.55;
  addBox(group, 3.1, 2.65, 2.5, ghX, 1.325, ghZ, mat.guardWall);
  addBox(group, 3.45, 0.18, 2.85, ghX, 2.72, ghZ, mat.roofTile);
  addBox(group, 1.1, 0.95, 0.06, ghX + 0.55, 1.45, ghZ + 1.26, mat.windowGlass, false);
  addBox(group, 0.78, 1.95, 0.06, ghX - 0.75, 0.98, ghZ + 1.26, mat.gateRed, false);

  if (includeFence) {
    function buildFenceRun(startX: number, dir: number, segments = 4, segLen = 2.8): void {
      for (let i = 0; i < segments; i++) {
        const x0 = startX + dir * i * segLen;
        const xMid = x0 + (dir * segLen) / 2;
        const xPost = x0 + dir * segLen;

        addBox(group, segLen - 0.28, 0.72, 0.24, xMid, 0.36, 0, mat.wallCream);
        addBox(group, segLen - 0.22, 0.08, 0.28, xMid, 0.75, 0, mat.pillarTrim);
        addBox(group, segLen - 0.3, 0.05, 0.05, xMid, 1.88, 0, mat.darkIron, false);
        const pickets = 9;
        for (let p = 1; p < pickets; p++) {
          const px = x0 + dir * (p / pickets) * segLen;
          addBox(group, 0.025, 1.12, 0.025, px, 1.34, 0, mat.darkIron, false);
          addBox(group, 0.04, 0.08, 0.04, px, 1.94, 0, mat.gold, false);
        }

        addBox(group, 0.34, 2.15, 0.34, xPost, 1.075, 0, mat.pillar);
        addBox(group, 0.42, 0.1, 0.42, xPost, 2.2, 0, mat.pillarTrim);
      }
    }

    buildFenceRun(-halfSpan - sideSpan - 0.32, -1, 4, 2.75);
    buildFenceRun(halfSpan + sideSpan + 0.32, 1, 4, 2.75);
  }

  return group;
}

/**
 * Secondary school entrance gate ("TRƯỜNG THCS XUÂN HÒA").
 * Local origin: ground center of the main carriageway opening, +Z facing outward.
 */
export function createSecondarySchoolGate(options: SchoolGateOptions = {}): THREE.Group {
  const { includeFence = true, title = 'TRƯỜNG THCS XUÂN HÒA' } = options;

  const group = new THREE.Group();
  group.name = 'SecondarySchoolGate';

  const mat = {
    pillar: makeMat(0xeee8dc, 0.78),
    pillarCap: makeMat(0xd5cab6, 0.8),
    stoneBase: makeMat(0x525860, 0.88),
    archBlue: makeMat(0x1f4f82, 0.55),
    gold: makeMat(0xd8ae45, 0.38, 0.52),
    gateFrame: makeMat(0x4a3429, 0.52, 0.35),
    darkSteel: makeMat(0x2b3137, 0.5, 0.5),
    wallCream: makeMat(0xeae0c8, 0.84),
    guardWall: makeMat(0xf0e9da, 0.82),
    roofBlue: makeMat(0x2b5784, 0.65),
    glass: makeMat(0x5a84a6, 0.25, 0.2, { transparent: true, opacity: 0.76 }),
  };

  const mainSpan = 6.4;
  const halfSpan = mainSpan / 2;
  const sideSpan = 2.0;

  function buildSquarePillar(x: number, w = 0.82, h = 4.4): void {
    addBox(group, w + 0.14, 0.48, w + 0.14, x, 0.24, 0, mat.stoneBase);
    addBox(group, w, h - 0.48, w, x, 0.48 + (h - 0.48) / 2, 0, mat.pillar);
    addBox(group, w * 0.55, h - 1.2, 0.06, x, h / 2 + 0.1, w / 2 + 0.02, mat.pillarCap, false);
    addBox(group, w + 0.18, 0.16, w + 0.18, x, h + 0.08, 0, mat.pillarCap);
    addBox(group, w * 0.72, 0.14, w * 0.72, x, h + 0.23, 0, mat.archBlue);
  }

  buildSquarePillar(-halfSpan, 0.84, 4.45);
  buildSquarePillar(halfSpan, 0.84, 4.45);
  buildSquarePillar(-halfSpan - sideSpan, 0.64, 3.25);
  buildSquarePillar(halfSpan + sideSpan, 0.64, 3.25);

  const canopyW = mainSpan + 1.3;
  addBox(group, canopyW, 0.88, 0.72, 0, 4.02, 0, mat.pillar);
  addBox(group, canopyW + 0.35, 0.16, 1.15, 0, 4.54, 0, mat.archBlue);
  addBox(group, canopyW - 0.5, 0.22, 0.82, 0, 4.73, 0, mat.pillarCap);

  const signTex = createTextTexture({
    title,
    subtitle: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO PHÚC YÊN',
    bg: '#184785',
    border: '#e5be52',
    color: '#ffffff',
    subColor: '#ffd970',
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex ?? undefined,
    color: signTex ? 0xffffff : 0x184785,
    roughness: 0.42,
    metalness: 0.08,
  });

  const signW = mainSpan - 0.3;
  addBox(group, signW + 0.12, 0.76, 0.1, 0, 4.02, 0.36, mat.gold);
  addBox(group, signW, 0.66, 0.04, 0, 4.02, 0.4, signMat);
  addBox(group, signW, 0.66, 0.04, 0, 4.02, -0.4, signMat);

  function buildGateLeaf(pivotX: number, dir: number, leafW: number, leafH: number): THREE.Group {
    const leaf = new THREE.Group();
    leaf.position.set(pivotX, 0, 0);
    const cx = (dir * leafW) / 2;

    addBox(leaf, leafW, 0.08, 0.06, cx, 0.24, 0, mat.gateFrame);
    addBox(leaf, leafW, 0.08, 0.06, cx, 1.02, 0, mat.gateFrame);
    addBox(leaf, leafW, 0.09, 0.07, cx, leafH, 0, mat.gateFrame);
    addBox(leaf, 0.08, leafH, 0.07, dir * 0.04, leafH / 2 + 0.12, 0, mat.gateFrame);
    addBox(leaf, 0.08, leafH, 0.07, dir * (leafW - 0.04), leafH / 2 + 0.12, 0, mat.gateFrame);

    const bars = 10;
    for (let i = 1; i < bars; i++) {
      const bx = dir * (i / bars) * leafW;
      addBox(
        leaf,
        0.028,
        leafH - 0.1,
        0.028,
        bx,
        leafH / 2 + 0.12,
        0,
        i % 2 === 0 ? mat.gold : mat.gateFrame,
        false
      );
      addBox(leaf, 0.045, 0.11, 0.045, bx, leafH + 0.17, 0, mat.gold, false);
    }

    addBox(leaf, leafW - 0.16, 0.46, 0.025, cx, 0.62, 0, mat.gateFrame, false);
    addBox(leaf, 0.36, 0.36, 0.04, cx, 1.56, 0, mat.gold, false);

    return leaf;
  }

  const leafW = (mainSpan - 0.88) / 2;
  const leftLeaf = buildGateLeaf(-halfSpan + 0.42, 1, leafW, 2.38);
  const rightLeaf = buildGateLeaf(halfSpan - 0.42, -1, leafW, 2.38);
  leftLeaf.rotation.y = -Math.PI * 0.35;
  rightLeaf.rotation.y = Math.PI * 0.35;
  group.add(leftLeaf, rightLeaf);

  function buildSideWicket(xCenter: number, w: number): void {
    addBox(group, w, 0.07, 0.05, xCenter, 0.22, 0, mat.gateFrame);
    addBox(group, w, 0.07, 0.05, xCenter, 2.08, 0, mat.gateFrame);
    const count = 6;
    for (let i = 0; i <= count; i++) {
      const bx = xCenter - w / 2 + (i / count) * w;
      addBox(group, 0.028, 1.88, 0.028, bx, 1.15, 0, mat.gateFrame, false);
      addBox(group, 0.042, 0.09, 0.042, bx, 2.15, 0, mat.gold, false);
    }
  }
  buildSideWicket(-halfSpan - sideSpan / 2, sideSpan - 0.7);
  buildSideWicket(halfSpan + sideSpan / 2, sideSpan - 0.7);

  const ghX = halfSpan + sideSpan + 2.0;
  const ghZ = -1.55;
  addBox(group, 3.0, 2.6, 2.45, ghX, 1.3, ghZ, mat.guardWall);
  addBox(group, 3.35, 0.18, 2.8, ghX, 2.68, ghZ, mat.roofBlue);
  addBox(group, 1.08, 0.92, 0.06, ghX - 0.52, 1.42, ghZ + 1.24, mat.glass, false);
  addBox(group, 0.76, 1.92, 0.06, ghX + 0.72, 0.96, ghZ + 1.24, mat.gateFrame, false);

  if (includeFence) {
    function buildFenceRun(startX: number, dir: number, segments = 4, segLen = 2.8): void {
      for (let i = 0; i < segments; i++) {
        const x0 = startX + dir * i * segLen;
        const xMid = x0 + (dir * segLen) / 2;
        const xPost = x0 + dir * segLen;

        addBox(group, segLen - 0.28, 0.7, 0.24, xMid, 0.35, 0, mat.wallCream);
        addBox(group, segLen - 0.22, 0.08, 0.28, xMid, 0.73, 0, mat.pillarCap);
        addBox(group, segLen - 0.3, 0.05, 0.05, xMid, 1.86, 0, mat.darkSteel, false);

        const pickets = 9;
        for (let p = 1; p < pickets; p++) {
          const px = x0 + dir * (p / pickets) * segLen;
          addBox(group, 0.025, 1.12, 0.025, px, 1.32, 0, mat.darkSteel, false);
          addBox(group, 0.038, 0.08, 0.038, px, 1.92, 0, mat.gold, false);
        }

        addBox(group, 0.34, 2.12, 0.34, xPost, 1.06, 0, mat.pillar);
        addBox(group, 0.42, 0.1, 0.42, xPost, 2.17, 0, mat.pillarCap);
      }
    }

    buildFenceRun(-halfSpan - sideSpan - 0.32, -1, 4, 2.75);
    buildFenceRun(halfSpan + sideSpan + 0.32, 1, 4, 2.75);
  }

  return group;
}

export function createSchoolGate(options: SchoolGateOptions = {}): THREE.Group {
  const variant = options.variant || options.kind || 'primary';
  const includeFence = options.includeFence ?? options.includeEnvironment ?? true;
  const group =
    variant === 'secondary'
      ? createSecondarySchoolGate({ ...options, includeFence })
      : createPrimarySchoolGate({ ...options, includeFence });

  group.userData.dispose = () => {
    disposeGateHierarchy(group, new Set(Object.values(SharedGeo)));
  };

  return group;
}

function createHipRoofGeometry(
  width: number,
  depth: number,
  height: number,
  overhang = 0.75,
  ridgeShorten = 0.32
): THREE.BufferGeometry {
  const hw = width / 2 + overhang;
  const hd = depth / 2 + overhang;
  const rw = Math.max(0.6, hw - depth * ridgeShorten);

  const positions = new Float32Array([
    -hw, 0, hd,  hw, 0, hd,  rw, height, 0,
    -hw, 0, hd,  rw, height, 0, -rw, height, 0,
    hw, 0, -hd, -hw, 0, -hd, -rw, height, 0,
    hw, 0, -hd, -rw, height, 0,  rw, height, 0,
    -hw, 0, -hd, -hw, 0, hd, -rw, height, 0,
    hw, 0, hd,  hw, 0, -hd,  rw, height, 0,
    -hw, 0, -hd,  hw, 0, -hd,  hw, 0, hd,
    -hw, 0, -hd,  hw, 0, hd, -hw, 0, hd,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function createFacadeBanner(text: string, bg = '#b51f1f', fg = '#ffe875'): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.fillStyle = fg;
    ctx.font = '800 48px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Full 3D school campus for Trường Tiểu học Xuân Hòa / Trường THCS Xuân Hòa.
 */
export function createSchoolCampus(options: SchoolCampusOptions = {}): XuanHoaSchoolModel {
  const variant: XuanHoaSchoolVariant = options.variant === 'secondary' ? 'secondary' : 'primary';
  const isSecondary = variant === 'secondary';

  const group = new THREE.Group() as unknown as XuanHoaSchoolModel;
  group.name = isSecondary ? 'THCS_XuanHoa_Campus' : 'TieuHoc_XuanHoa_Campus';
  group.userData.location = CAMPUS_LOCATIONS[variant];

  const ownedGeometries: THREE.BufferGeometry[] = [];
  const ownedMaterials: THREE.Material[] = [];
  const ownedTextures: THREE.Texture[] = [];

  const trackMat = <T extends THREE.Material>(m: T): T => {
    ownedMaterials.push(m);
    return m;
  };
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ownedGeometries.push(g);
    return g;
  };

  const mat = {
    groundGrass: trackMat(makeMat(0x5f8d4e, 0.92)),
    yardConcrete: trackMat(makeMat(0xc8c5bc, 0.86)),
    yardTile: trackMat(makeMat(0xb7b3a8, 0.84)),
    courtLine: trackMat(makeMat(0xf4f1e6, 0.75)),
    curb: trackMat(makeMat(0xded9cc, 0.82)),
    wallYellow: trackMat(makeMat(isSecondary ? 0xf2df9b : 0xf4df8e, 0.78)),
    wallCream: trackMat(makeMat(0xf7f2e4, 0.76)),
    plinth: trackMat(makeMat(0x7c766d, 0.88)),
    columnWhite: trackMat(makeMat(0xf8f5ec, 0.74)),
    balustrade: trackMat(makeMat(0xead68b, 0.78)),
    roofRed: trackMat(makeMat(isSecondary ? 0xb43c2c : 0xc53e2b, 0.65)),
    roofTrim: trackMat(makeMat(0xf0ece1, 0.75)),
    doorWood: trackMat(makeMat(0x6e3f23, 0.68)),
    windowFrame: trackMat(makeMat(0x3a4a3f, 0.6)),
    windowGlass: trackMat(
      makeMat(0x4f7897, 0.22, 0.18, { transparent: true, opacity: 0.76 })
    ),
    shutterGreen: trackMat(makeMat(0x2f6846, 0.65)),
    trunk: trackMat(makeMat(0x5c422c, 0.9)),
    foliage1: trackMat(makeMat(0x3b7a38, 0.86)),
    foliage2: trackMat(makeMat(0x4c8c42, 0.84)),
    planter: trackMat(makeMat(0xd8d1c2, 0.82)),
    flagMetal: trackMat(makeMat(0xd8dde2, 0.3, 0.78)),
    flagRed: trackMat(makeMat(0xd62828, 0.6, 0.05, { side: THREE.DoubleSide })),
    gold: trackMat(makeMat(0xf2c94c, 0.4, 0.45)),
    fenceWall: trackMat(makeMat(0xeae0c8, 0.85)),
    sportFloor: trackMat(makeMat(0x3d7c5a, 0.8)),
  };

  const campusW = 68;
  const campusD = 62;

  addBox(group, campusW, 0.24, campusD, 0, -0.12, 0, mat.groundGrass, false, true);
  addBox(group, 46, 0.08, 30, 0, 0.04, 5, mat.yardConcrete, false, true);

  for (let gx = -20; gx <= 20; gx += 5) {
    addBox(group, 0.08, 0.09, 28, gx, 0.046, 5, mat.yardTile, false, false);
  }
  for (let gz = -8; gz <= 18; gz += 5) {
    addBox(group, 44, 0.09, 0.08, 0, 0.046, gz, mat.yardTile, false, false);
  }

  addBox(group, 7.6, 0.09, 12, 0, 0.045, 24, mat.yardTile, false, true);

  addBox(group, 14, 0.095, 8, -12, 0.048, 8, mat.sportFloor, false, true);
  addBox(group, 14.1, 0.1, 0.12, -12, 0.05, 4, mat.courtLine, false, false);
  addBox(group, 14.1, 0.1, 0.12, -12, 0.05, 12, mat.courtLine, false, false);
  addBox(group, 0.12, 0.1, 8.1, -19, 0.05, 8, mat.courtLine, false, false);
  addBox(group, 0.12, 0.1, 8.1, -5, 0.05, 8, mat.courtLine, false, false);
  addBox(group, 0.12, 0.1, 8.1, -12, 0.05, 8, mat.courtLine, false, false);

  const fpZ = 2;
  addBox(group, 2.8, 0.28, 2.8, 0, 0.14, fpZ, mat.curb);
  addBox(group, 1.9, 0.34, 1.9, 0, 0.45, fpZ, mat.columnWhite);
  addCyl(group, 0.06, 0.1, 9.2, 0, 5.2, fpZ, mat.flagMetal, 10);
  addCyl(group, 0.12, 0.12, 0.18, 0, 9.85, fpZ, mat.gold, 10);

  const flagMesh = addBox(group, 1.55, 1.02, 0.02, 0.8, 9.25, fpZ, mat.flagRed, true, false);
  const star = addBox(group, 0.32, 0.32, 0.03, 0.8, 9.25, fpZ, mat.gold, false, false);
  star.rotation.z = Math.PI / 4;
  void flagMesh;

  function buildTeachingBlock({
    name,
    bays = 9,
    bayW = 3.6,
    floors = 3,
    floorH = 3.35,
    bodyD = 7.4,
    corridorD = 2.1,
    bannerText = '',
  }: {
    name: string;
    bays?: number;
    bayW?: number;
    floors?: number;
    floorH?: number;
    bodyD?: number;
    corridorD?: number;
    bannerText?: string;
  }): THREE.Group {
    const bGroup = new THREE.Group();
    bGroup.name = name;

    const totalW = bays * bayW;
    const totalD = bodyD + corridorD;
    const totalH = floors * floorH;
    const bodyZ = -corridorD / 2;
    const corrZ = bodyD / 2;
    const frontZ = totalD / 2;

    addBox(bGroup, totalW + 0.6, 0.55, totalD + 0.6, 0, 0.275, 0, mat.plinth);

    for (let s = 0; s < 3; s++) {
      addBox(
        bGroup,
        bayW * 1.4,
        0.18,
        0.95 - s * 0.28,
        0,
        0.09 + s * 0.18,
        frontZ + 0.48 - s * 0.14,
        mat.curb
      );
    }

    addBox(bGroup, totalW, totalH, bodyD, 0, 0.55 + totalH / 2, bodyZ, mat.wallYellow);

    for (let f = 0; f < floors; f++) {
      const yBase = 0.55 + f * floorH;

      addBox(bGroup, totalW + 0.15, 0.22, totalD + 0.1, 0, yBase + 0.11, 0, mat.wallCream);

      if (f > 0 || true) {
        const parapetH = 0.92;
        addBox(
          bGroup,
          totalW,
          parapetH,
          0.18,
          0,
          yBase + 0.22 + parapetH / 2,
          frontZ - 0.09,
          mat.balustrade
        );
        addBox(
          bGroup,
          totalW + 0.08,
          0.1,
          0.26,
          0,
          yBase + 0.22 + parapetH + 0.05,
          frontZ - 0.09,
          mat.columnWhite
        );
      }

      for (let b = 0; b <= bays; b++) {
        const colX = -totalW / 2 + b * bayW;
        addBox(
          bGroup,
          0.34,
          floorH,
          0.34,
          colX,
          yBase + floorH / 2,
          frontZ - 0.17,
          mat.columnWhite
        );
        addBox(
          bGroup,
          0.26,
          floorH,
          0.12,
          colX,
          yBase + floorH / 2,
          -totalD / 2 - 0.04,
          mat.wallCream
        );
      }

      for (let b = 0; b < bays; b++) {
        const bx = -totalW / 2 + (b + 0.5) * bayW;
        const isCenterBay = b === Math.floor(bays / 2);
        const isStairBay = b === 1 || b === bays - 2;

        if (isStairBay) {
          addBox(
            bGroup,
            bayW * 0.55,
            floorH * 0.65,
            0.08,
            bx,
            yBase + floorH * 0.52,
            corrZ - corridorD + 0.04,
            mat.windowGlass,
            false
          );
        } else {
          addBox(
            bGroup,
            0.96,
            2.15,
            0.08,
            bx - bayW * 0.28,
            yBase + 1.18,
            corrZ - corridorD + 0.04,
            mat.doorWood,
            false
          );
          addBox(
            bGroup,
            1.35,
            1.28,
            0.08,
            bx + bayW * 0.16,
            yBase + 1.58,
            corrZ - corridorD + 0.04,
            mat.windowGlass,
            false
          );
          addBox(
            bGroup,
            1.45,
            1.36,
            0.05,
            bx + bayW * 0.16,
            yBase + 1.58,
            corrZ - corridorD + 0.02,
            mat.shutterGreen,
            false
          );
        }

        addBox(
          bGroup,
          1.5,
          1.25,
          0.08,
          bx,
          yBase + 1.6,
          -totalD / 2 - 0.04,
          mat.windowGlass,
          false
        );

        if (isCenterBay && f === 0) {
          addBox(bGroup, bayW + 0.2, 0.22, 0.7, bx, yBase + floorH - 0.1, frontZ + 0.25, mat.wallCream);
        }
      }
    }

    addBox(bGroup, totalW + 0.5, 0.26, totalD + 0.5, 0, 0.55 + totalH + 0.13, 0, mat.roofTrim);

    const roofH = Math.min(3.1, totalD * 0.29);
    const roofGeo = trackGeo(createHipRoofGeometry(totalW, totalD, roofH, 0.85, 0.28));
    const roofMesh = new THREE.Mesh(roofGeo, mat.roofRed);
    roofMesh.position.set(0, 0.55 + totalH + 0.26, 0);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    bGroup.add(roofMesh);

    const centralGableW = bayW * 2.1;
    addBox(
      bGroup,
      centralGableW,
      1.15,
      0.45,
      0,
      0.55 + totalH + 0.58,
      frontZ - 0.1,
      mat.wallCream
    );
    addCyl(bGroup, 0.42, 0.42, 0.12, 0, 0.55 + totalH + 0.65, frontZ + 0.14, mat.gold, 16);

    if (bannerText) {
      const bannerTex = createFacadeBanner(bannerText);
      if (bannerTex) ownedTextures.push(bannerTex);
      const bannerMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: bannerTex ?? undefined,
          color: bannerTex ? 0xffffff : 0xb51f1f,
          roughness: 0.5,
        })
      );
      addBox(
        bGroup,
        Math.min(totalW * 0.58, 16),
        0.72,
        0.06,
        0,
        0.55 + (floors - 1) * floorH + 0.62,
        frontZ + 0.04,
        bannerMat,
        false
      );
    }

    return bGroup;
  }

  const mainFloors = isSecondary ? 4 : 3;
  const mainBlock = buildTeachingBlock({
    name: 'MainClassroomBlock',
    bays: 9,
    bayW: 3.7,
    floors: mainFloors,
    floorH: 3.3,
    bodyD: 7.4,
    corridorD: 2.1,
    bannerText: isSecondary ? 'TIÊN HỌC LỄ - HẬU HỌC VĂN' : 'MỖI NGÀY ĐẾN TRƯỜNG LÀ MỘT NGÀY VUI',
  });
  mainBlock.position.set(0, 0, -17.5);
  group.add(mainBlock);

  const westBlock = buildTeachingBlock({
    name: 'WestWingBlock',
    bays: 6,
    bayW: 3.5,
    floors: isSecondary ? 3 : 2,
    floorH: 3.3,
    bodyD: 6.8,
    corridorD: 1.9,
  });
  westBlock.rotation.y = Math.PI / 2;
  westBlock.position.set(-24.5, 0, 1.5);
  group.add(westBlock);

  const eastBlock = buildTeachingBlock({
    name: 'EastAdminBlock',
    bays: 5,
    bayW: 3.5,
    floors: 2,
    floorH: 3.3,
    bodyD: 6.8,
    corridorD: 1.9,
  });
  eastBlock.rotation.y = -Math.PI / 2;
  eastBlock.position.set(24.5, 0, 2.5);
  group.add(eastBlock);

  function addBridge(x: number, z: number, w: number, d: number, h = 3.5): void {
    addBox(group, w, 0.25, d, x, h, z, mat.roofTrim);
    addBox(group, w + 0.4, 0.22, d + 0.4, x, h + 2.8, z, mat.roofRed);
    addBox(group, 0.28, h, 0.28, x - w / 3, h / 2, z - d / 3, mat.columnWhite);
    addBox(group, 0.28, h, 0.28, x + w / 3, h / 2, z + d / 3, mat.columnWhite);
  }
  addBridge(-19.5, -10.5, 5.5, 4.2, 3.6);
  addBridge(19.5, -9.8, 5.5, 4.2, 3.6);

  function addCampusTree(x: number, z: number, scale = 1, withPlanter = true): void {
    if (withPlanter) {
      addCyl(group, 1.25, 1.35, 0.42, x, 0.21, z, mat.planter, 10);
      addCyl(group, 1.05, 1.05, 0.45, x, 0.23, z, mat.groundGrass, 10);
    }
    const trunkH = 2.6 * scale;
    addCyl(group, 0.18 * scale, 0.26 * scale, trunkH, x, trunkH / 2 + 0.2, z, mat.trunk, 8);

    const c1 = new THREE.Mesh(SharedGeo.sphere, mat.foliage1);
    c1.scale.set(1.85 * scale, 1.45 * scale, 1.85 * scale);
    c1.position.set(x, trunkH + 1.05 * scale, z);
    c1.castShadow = true;
    c1.receiveShadow = true;
    group.add(c1);

    const c2 = new THREE.Mesh(SharedGeo.sphere, mat.foliage2);
    c2.scale.set(1.35 * scale, 1.15 * scale, 1.35 * scale);
    c2.position.set(x + 0.55 * scale, trunkH + 1.65 * scale, z - 0.35 * scale);
    c2.castShadow = true;
    group.add(c2);
  }

  const treeCoords: Array<[number, number, number]> = [
    [-14, -7.5, 1.08],
    [-7.5, -7.5, 1.0],
    [7.5, -7.5, 1.05],
    [14, -7.5, 1.1],
    [-16.5, 14, 0.95],
    [16.5, 14, 1.02],
    [-16.5, 0, 0.92],
    [16.5, 0, 0.98],
  ];
  treeCoords.forEach(([tx, tz, sc]) => addCampusTree(tx, tz, sc, true));

  const backTrees: Array<[number, number, number]> = [
    [-26, -24, 1.15],
    [-12, -26, 1.05],
    [12, -26, 1.1],
    [26, -24, 1.08],
    [-29, 18, 0.95],
    [29, 18, 0.95],
  ];
  backTrees.forEach(([tx, tz, sc]) => addCampusTree(tx, tz, sc, false));

  const gateZ = campusD / 2 - 1.2;
  const gate = createSchoolGate({
    variant,
    includeFence: true,
    title: CAMPUS_LOCATIONS[variant].name.toUpperCase(),
  });
  gate.position.set(0, 0, gateZ);
  group.add(gate);

  const halfW = campusW / 2 - 1.2;
  const halfD = campusD / 2 - 1.2;

  addBox(group, 0.28, 1.95, campusD - 2.4, -halfW, 0.975, 0, mat.fenceWall);
  addBox(group, 0.28, 1.95, campusD - 2.4, halfW, 0.975, 0, mat.fenceWall);
  addBox(group, campusW - 2.4, 1.95, 0.28, 0, 0.975, -halfD, mat.fenceWall);

  addBox(group, 11.5, 1.85, 0.26, -halfW + 5.75, 0.925, gateZ, mat.fenceWall);
  addBox(group, 11.5, 1.85, 0.26, halfW - 5.75, 0.925, gateZ, mat.fenceWall);

  group.dispose = () => {
    if (gate.userData.dispose) gate.userData.dispose();
    ownedTextures.forEach((t) => t.dispose());
    ownedMaterials.forEach((m) => m.dispose());
    ownedGeometries.forEach((g) => g.dispose());
  };
  group.userData.dispose = group.dispose;

  return group;
}

export function createXuanHoaSchoolCampus(variant: XuanHoaSchoolVariant): XuanHoaSchoolModel {
  return createSchoolCampus({ variant });
}

export function createSchoolCampusByKind(variant: XuanHoaSchoolVariant): XuanHoaSchoolModel {
  return createSchoolCampus({ variant });
}
