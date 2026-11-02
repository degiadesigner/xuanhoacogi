import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const HPU2_PLACE_ID = 'osm_building_a1_dhsp2';
export const HPU2_LANDMARK_ID = 'hpu2_a1';
export const HPU2_LOCATION = Object.freeze({ lat: 21.2810638, lng: 105.7257766 });

export type HPU2PaletteKey =
  | 'concrete'
  | 'glass'
  | 'frame'
  | 'roof'
  | 'red'
  | 'paving'
  | 'leaf'
  | 'leafLight'
  | 'bark';

export const HPU2_PALETTE: Readonly<Record<HPU2PaletteKey, number>> = Object.freeze({
  concrete: 0xe5dfce,
  glass: 0x6e9bb4,
  frame: 0x465e67,
  roof: 0xb9a98e,
  red: 0x9b504b,
  paving: 0xcac7bc,
  leaf: 0x66866a,
  leafLight: 0x829b72,
  bark: 0x766a55,
});

export type LandmarkDetailMode = 'auto' | 'near' | 'far';

export interface HPU2LandmarkOptions {
  bearing?: number;
  scale?: number;
  lodDistance?: number;
  trees?: boolean;
  signs?: boolean;
  palette?: Partial<Record<HPU2PaletteKey, number>>;
  treeFactory?: ((params: { x: number; z: number; scale: number }) => THREE.Object3D | null) | null;
}

export interface HPU2LandmarkGroup extends THREE.Group {
  setDetail: (mode: LandmarkDetailMode) => void;
  dispose: () => void;
}

/**
 * Metres, Y up, local front = +Z. Anchor is the centre of the site.
 * Bearing is clockwise from north, for a world where +X=east, +Z=south.
 * Geographic coordinates are metadata; the host map projects them via Place/LandmarkBinding.
 * No lights, animation, fetches, or global renderer state are introduced.
 */
export function createHPU2Landmark({
  bearing = 225,
  scale = 1,
  lodDistance = 160,
  trees = true,
  signs = true,
  palette = {},
  treeFactory = null,
}: HPU2LandmarkOptions = {}): HPU2LandmarkGroup {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error('scale must be positive');
  }
  if (!Number.isFinite(bearing) || !Number.isFinite(lodDistance) || lodDistance <= 0) {
    throw new Error('Invalid bearing or LOD distance');
  }

  const colors: Record<HPU2PaletteKey, number> = { ...HPU2_PALETTE, ...palette };
  const materials: Record<string, THREE.Material> = Object.fromEntries(
    Object.entries(colors).map(([k, color]) => [
      k,
      new THREE.MeshLambertMaterial({
        color,
        flatShading: k === 'leaf' || k === 'leafLight',
      }),
    ])
  );

  const box = new THREE.BoxGeometry(1, 1, 1);
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const trunk = new THREE.CylinderGeometry(0.7, 1, 1, 6);
  const ownedGeometry = new Set<THREE.BufferGeometry>();
  const ownedTextures: THREE.Texture[] = [];
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  let atlas: THREE.CanvasTexture | null = null;

  if (signs && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 1024, 256);
      ctx.fillStyle = '#994943';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 94px Arial';
      ctx.fillText('A1', 128, 64);
      ctx.fillText('HPU2', 640, 64);
      ctx.font = 'bold 42px Arial';
      ctx.fillText('TRƯỜNG ĐẠI HỌC SƯ PHẠM HÀ NỘI 2', 512, 190);
      atlas = new THREE.CanvasTexture(c);
      atlas.colorSpace = THREE.SRGBColorSpace;
      ownedTextures.push(atlas);
      materials.sign = new THREE.MeshBasicMaterial({
        map: atlas,
        transparent: true,
        alphaTest: 0.15,
        depthWrite: true,
      });
    }
  }

  function build(far: boolean): THREE.Group {
    const batches = new Map<string, THREE.BufferGeometry[]>();
    const group = new THREE.Group();
    group.name = far ? 'HPU2 / far' : 'HPU2 / near';

    function add(
      key: string,
      primitive: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      ry = 0
    ): void {
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      matrix.compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(w, h, d));
      const g = primitive.clone().applyMatrix4(matrix);
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key)!.push(g);
    }

    const b = (key: string, x: number, y: number, z: number, w: number, h: number, d: number) =>
      add(key, box, x, y, z, w, h, d);

    function sign(x: number, y: number, z: number, w: number, h: number, uv: [number, number, number, number]): void {
      if (!atlas) return;
      const g = new THREE.PlaneGeometry(w, h);
      const a = g.attributes.uv;
      for (let i = 0; i < a.count; i++) {
        a.setXY(i, uv[0] + a.getX(i) * uv[2], uv[1] + a.getY(i) * uv[3]);
      }
      g.translate(x, y, z);
      if (!batches.has('sign')) batches.set('sign', []);
      batches.get('sign')!.push(g);
    }

    // Main A1 mass: eight legible storeys, asymmetric central curtain wall.
    b('concrete', -10, 16.2, -5, 32, 32, 19);
    b('glass', -10, 16.1, 4.58, 31.5, 30.6, 0.18);
    b('glass', -26.08, 16, -5, 0.16, 30, 18.4);
    b('glass', 6.08, 17, -6, 0.16, 28, 16.8);
    b('glass', -10, 16, -14.58, 31.4, 30, 0.16);
    // Recessed full-height central glass bay. Wings project in front of it.
    b('glass', -13, 15.6, 4.7, 7, 28.9, 0.2);
    for (let i = 0; i < 8; i++) {
      const y = 1 + i * 3.85;
      b('concrete', -21.5, y, 4.95, 9, 1.02, 0.72);
      b('concrete', -1.5, y, 4.95, 15, 1.02, 0.72);
      b('concrete', -26.2, y, -5, 0.58, 1.02, 19.6);
      b('concrete', 6.2, y, -5, 0.58, 1.02, 19.6);
      b('concrete', -10, y, -14.8, 32, 1.02, 0.6);
    }
    b('concrete', -10, 30.2, 4.97, 32.5, 1.1, 0.78);
    b('concrete', -10, 32.1, -5, 32.8, 0.75, 19.8);
    b('roof', -10, 32.51, -5, 31.8, 0.12, 18.8);
    // Shallow parapet and terraced rooftop plant volumes, estimated from satellite.
    for (const z of [-14.8, 4.8]) b('concrete', -10, 32.9, z, 32.8, 0.85, 0.32);
    for (const x of [-26.25, 6.25]) b('concrete', x, 32.9, -5, 0.32, 0.85, 19.8);
    b('concrete', -10, 33.5, -7, 13, 1.8, 8);
    b('roof', -10, 34.45, -7, 13.4, 0.15, 8.4);
    sign(-18, 32.95, 5.01, 2.3, 1.25, [0, 0.5, 0.25, 0.5]);
    sign(1.5, 32.95, 5.01, 4.8, 1.25, [0.375, 0.5, 0.5, 0.5]);

    // Lower right frontage with its large school-name frame.
    b('concrete', 18, 5.9, -0.3, 24, 11.6, 24);
    b('glass', 18, 6.6, 11.79, 22.4, 8.1, 0.16);
    b('glass', 30.09, 6.6, -0.3, 0.15, 8.1, 23);
    b('concrete', 18, 11.9, -0.3, 25, 0.55, 25);
    b('roof', 18, 12.21, -0.3, 23.8, 0.12, 23.8);
    b('concrete', 6.6, 6.9, 12.3, 1.6, 11.1, 1.4);
    b('concrete', 29.4, 6.9, 12.3, 1.6, 11.1, 1.4);
    b('concrete', 18, 12.1, 12.3, 24.4, 2.1, 1.4);
    b('concrete', 18, 2.4, 12.3, 23, 0.75, 1.4);
    sign(18, 12.15, 13.015, 21.6, 1.3, [0, 0.1, 1, 0.3]);

    // Rear connecting mass and separate service / vertical red element.
    b('concrete', 17, 10.6, -21.5, 18, 21, 15);
    b('glass', 26.1, 11, -21.5, 0.15, 18, 14);
    b('glass', 17, 11, -29.1, 17, 18, 0.15);
    b('glass', 18, 17, -13.91, 15, 7.3, 0.15);
    for (let i = 0; i < 6; i++) {
      b('concrete', 26.2, 2 + i * 3.45, -21.5, 0.4, 0.65, 15.3);
      b('concrete', 17, 2 + i * 3.45, -29.2, 18.4, 0.65, 0.4);
      if (i > 3) b('concrete', 18, 2 + i * 3.45, -13.8, 15.5, 0.65, 0.4);
    }
    b('concrete', 17, 21.3, -21.5, 18.8, 0.55, 15.8);
    b('roof', 17, 21.65, -21.5, 17.7, 0.15, 14.7);
    b('red', 8.4, 18.4, -13, 3.9, 36.5, 5);
    b('concrete', 8.4, 36.8, -13, 4.3, 0.5, 5.4);
    b('frame', 8.4, 29.3, -10.45, 0.9, 2.2, 0.12);

    // Entry recessed beneath A1; open pilotis, steps and porch.
    b('frame', -10, 1.8, 4.9, 21, 3.4, 0.3);
    b('concrete', -10, 4.3, 8.3, 25, 0.65, 7.7);
    for (const x of [-21, -10, 1]) b('concrete', x, 2, 10.8, 0.8, 4, 0.8);
    for (let i = 0; i < 3; i++) b('paving', -10, 0.14 + i * 0.16, 11.7 - i * 0.55, 25, 0.27, 1.5);

    if (!far) {
      // Mullions are batched geometry, never individual window objects.
      for (let x = -25; x < 6; x += 1.9) b('frame', x, 16, 4.83, 0.065, 29.8, 0.075);
      for (let y = 3; y < 31; y += 1.92) b('frame', -13, y, 4.85, 6.9, 0.07, 0.08);
      for (let z = -13; z < 5; z += 2.1) {
        b('frame', -26.19, 16, z, 0.07, 29.7, 0.065);
        b('frame', 6.19, 17, z, 0.07, 27, 0.065);
      }
      for (let x = 7.7; x < 30; x += 2.1) b('frame', x, 6.7, 11.91, 0.07, 8.1, 0.075);
      b('frame', 18, 7, 11.91, 22.3, 0.12, 0.08);

      // Main gate: two piers, distinct stacked horizontal canopy, small guardhouse.
      for (const x of [-17, -1]) {
        b('frame', x, 2.65, 24.1, 1.1, 5.3, 1.35);
        b('concrete', x - 0.12, 2.65, 24.82, 0.7, 5.3, 0.12);
      }
      for (let i = 0; i < 4; i++) {
        b(i % 2 ? 'concrete' : 'frame', -9, 5.25 + i * 0.38, 24.2, 23 - i * 0.75, 0.21, 2.7 - i * 0.3);
      }
      b('red', -9, 4.65, 24.83, 14.5, 0.8, 0.12);
      b('concrete', -23.3, 1.8, 23, 8, 3.6, 5);
      b('frame', -23.3, 3.72, 23, 8.5, 0.24, 5.5);
      b('glass', -23.3, 2.1, 25.54, 3.5, 1.35, 0.12);
      b('frame', -19.9, 1.25, 25.55, 1.1, 2.5, 0.12);
      b('frame', 3, 1.9, 24.3, 5, 3.8, 0.6);
      b('concrete', 3, 1.95, 24.65, 4.55, 3.35, 0.15);
      b('roof', 3, 1.95, 24.75, 4.05, 2.85, 0.05);
      b('red', 3, 2.6, 24.8, 0.65, 0.65, 0.04);
      for (const [a, c] of [
        [-33, -27.5],
        [5.8, 33],
      ]) {
        b('roof', (a + c) / 2, 0.55, 24.3, c - a, 1.1, 0.55);
        for (const y of [1.25, 2.75]) b('frame', (a + c) / 2, y, 24.3, c - a, 0.09, 0.1);
        for (let x = a; x <= c; x += 0.65) b('frame', x, 1.95, 24.3, 0.07, 1.75, 0.09);
        for (let x = a; x <= c; x += 4.5) b('concrete', x, 1.5, 24.3, 0.32, 3, 0.5);
      }
      // Retracted sliding gate is parked to the right, keeping entry unobstructed.
      for (let x = -0.2; x < 1.8; x += 0.24) b('frame', x, 1.25, 23.4, 0.07, 2.5, 0.7);
    }

    if (trees && !treeFactory) {
      for (const [x, z, s] of [
        [-28, 19, 1],
        [25, 21, 1.15],
        [32, 5, 0.8],
        [-31, -9, 0.72],
      ]) {
        add('bark', trunk, x, 4 * s, z, 0.48 * s, 8 * s, 0.48 * s);
        b('concrete', x, 0.65, z, 0.9 * s, 1.3, 0.9 * s);
        add('leaf', crown, x, 9.2 * s, z, 3.3 * s, 4.7 * s, 3.2 * s);
        if (!far) {
          add('leafLight', crown, x - 1.9 * s, 8.9 * s, z + 0.5, 2.6 * s, 2.7 * s, 2.4 * s);
          add('leaf', crown, x + 2 * s, 10.2 * s, z - 0.4, 2.6 * s, 3.5 * s, 2.6 * s);
        }
      }
    }

    for (const [key, geos] of batches) {
      // Plane and primitive geometries share position/normal/uv attributes.
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) throw new Error(`Cannot merge ${key}`);
      merged.computeBoundingSphere();
      ownedGeometry.add(merged);
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.name = key;
      mesh.castShadow = key !== 'sign';
      mesh.receiveShadow = key !== 'sign';
      group.add(mesh);
    }
    return group;
  }

  const root = new THREE.Group() as HPU2LandmarkGroup;
  root.name = 'Hiệu bộ ĐHSP Hà Nội 2 · A1 / HPU2';
  root.rotation.y = THREE.MathUtils.degToRad(180 - bearing);
  root.scale.setScalar(scale);

  const lod = new THREE.LOD();
  const near = build(false);
  const far = build(true);
  lod.addLevel(near, 0);
  lod.addLevel(far, lodDistance * scale, 0.12);
  root.add(lod);

  // Site pavement persists across LOD levels. No road: the host map owns roads.
  const ground = new THREE.Mesh(new THREE.BoxGeometry(70, 0.18, 61), materials.paving);
  ground.position.set(0, -0.1, -1);
  ground.receiveShadow = true;
  root.add(ground);
  ownedGeometry.add(ground.geometry);

  if (trees && treeFactory) {
    for (const [x, z, s] of [
      [-28, 19, 1],
      [25, 21, 1.15],
      [32, 5, 0.8],
      [-31, -9, 0.72],
    ]) {
      const t = treeFactory({ x, z, scale: s });
      if (t) {
        t.position.set(x, 0, z);
        root.add(t);
      }
    }
  }

  box.dispose();
  crown.dispose();
  trunk.dispose();

  function stats(group: THREE.Group): { drawCalls: number; triangles: number } {
    let drawCalls = 1;
    let triangles = 12;
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        drawCalls++;
        triangles +=
          (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      }
    });
    return { drawCalls, triangles };
  }

  root.userData = {
    landmarkId: HPU2_LANDMARK_ID,
    placeId: HPU2_PLACE_ID,
    location: HPU2_LOCATION,
    bearing,
    dimensionsEstimated: true,
    front: '+Z before rotation',
    stats: {
      near: stats(near),
      far: stats(far),
      materials: Object.keys(materials).length,
    },
    lod,
  };

  root.setDetail = (mode: LandmarkDetailMode) => {
    if (!['auto', 'near', 'far'].includes(mode)) {
      throw new Error('Unknown detail');
    }
    lod.autoUpdate = mode === 'auto';
    if (mode !== 'auto') {
      near.visible = mode === 'near';
      far.visible = mode === 'far';
    }
  };

  root.dispose = () => {
    ownedGeometry.forEach((g) => g.dispose());
    Object.values(materials).forEach((m) => m.dispose());
    ownedTextures.forEach((t) => t.dispose());
    root.removeFromParent();
  };

  return root;
}
