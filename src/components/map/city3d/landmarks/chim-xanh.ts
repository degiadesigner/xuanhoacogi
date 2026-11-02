import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CHIM_XANH_PLACE_ID = 'osm_landmark_quang_truong_chim_xanh';
export const CHIM_XANH_LANDMARK_ID = 'quang_truong_chim_xanh';
export const LOCATION = Object.freeze({ lat: 21.2804945, lng: 105.725279 });

export type ChimXanhPaletteKey =
  | 'blue'
  | 'pink'
  | 'red'
  | 'white'
  | 'paving'
  | 'joint'
  | 'stone'
  | 'wood'
  | 'roof'
  | 'metal'
  | 'leaf'
  | 'leafLight'
  | 'grass';

export const PALETTE: Readonly<Record<ChimXanhPaletteKey, number>> = Object.freeze({
  blue: 0x58a6c9,
  pink: 0xc39aa0,
  red: 0xb75b52,
  white: 0xe8e5d8,
  paving: 0xc9c5b6,
  joint: 0xb2b3a8,
  stone: 0x969f98,
  wood: 0x806344,
  roof: 0x78614e,
  metal: 0x596b68,
  leaf: 0x65815b,
  leafLight: 0x8d9b70,
  grass: 0x839264,
});

export type ChimXanhDetailMode = 'auto' | 'near' | 'far';

export interface ChimXanhOptions {
  bearing?: number;
  scale?: number;
  lodDistance?: number;
  trees?: boolean;
  context?: boolean;
  palette?: Partial<Record<ChimXanhPaletteKey, number>>;
}

export interface ChimXanhGroup extends THREE.Group {
  setDetail: (mode: ChimXanhDetailMode) => void;
  dispose: () => void;
}

/**
 * Y-up, metres. +Z is the stage-facing-out direction before rotation.
 * Host world: +X east, +Z south. Bearing clockwise from north.
 * 45 degrees is an approximate direction towards HPU2.
 */
export function createChimXanh({
  bearing = 45,
  scale = 1,
  lodDistance = 200,
  trees = true,
  context = true,
  palette = {},
}: ChimXanhOptions = {}): ChimXanhGroup {
  if (
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !Number.isFinite(bearing) ||
    !Number.isFinite(lodDistance) ||
    lodDistance <= 0
  ) {
    throw new Error('Invalid transform / LOD');
  }

  const materials = Object.fromEntries(
    Object.entries({ ...PALETTE, ...palette }).map(([k, color]) => [
      k,
      new THREE.MeshLambertMaterial({
        color,
        flatShading: k === 'leaf' || k === 'leafLight',
      }),
    ])
  ) as Record<ChimXanhPaletteKey, THREE.MeshLambertMaterial>;

  const owned = new Set<THREE.BufferGeometry>();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);

  function build(far: boolean): THREE.Group {
    const batches = new Map<ChimXanhPaletteKey, THREE.BufferGeometry[]>();
    const group = new THREE.Group();
    group.name = far ? 'Chim xanh / far' : 'Chim xanh / near';

    function add(k: ChimXanhPaletteKey, g: THREE.BufferGeometry): void {
      if (!batches.has(k)) batches.set(k, []);
      if (g.index) {
        const old = g;
        g = g.toNonIndexed();
        old.dispose();
      }
      batches.get(k)!.push(g);
    }

    function primitive(
      k: ChimXanhPaletteKey,
      g: THREE.BufferGeometry,
      p: [number, number, number],
      s: [number, number, number],
      r: [number, number, number] = [0, 0, 0]
    ): void {
      const v = g.clone();
      v.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(...p),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
          new THREE.Vector3(...s)
        )
      );
      add(k, v);
    }

    const box = (k: ChimXanhPaletteKey, x: number, y: number, z: number, w: number, h: number, d: number) =>
      primitive(k, boxGeo, [x, y, z], [w, h, d]);
    const cyl = (k: ChimXanhPaletteKey, x: number, y: number, z: number, r: number, h: number) =>
      primitive(k, cylGeo, [x, y, z], [r, h, r]);

    function shape(k: ChimXanhPaletteKey, points: Array<[number, number]>, depth: number, z: number): void {
      const s = new THREE.Shape();
      s.moveTo(...points[0]);
      for (const p of points.slice(1)) s.lineTo(...p);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: far ? 5 : 10 });
      g.translate(0, 0, z);
      add(k, g);
    }

    function roof(
      x: number,
      z: number,
      w: number,
      d: number,
      y: number,
      rise: number,
      k: ChimXanhPaletteKey = 'roof'
    ): void {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(0, rise);
      s.lineTo(w / 2, 0);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
      g.translate(x, y, z - d / 2);
      add(k, g);
    }

    // A long open paved square, narrowed by gardens near the road.
    box('stone', 0, -0.16, 0, 54, 0.32, 104);
    box('paving', 0, 0.035, 0, 53.4, 0.07, 103.4);
    if (!far) {
      for (let x = -13; x <= 13; x += 2) box('joint', x, 0.077, 1, 0.035, 0.012, 83);
      for (let z = -30; z <= 49; z += 2) box('joint', 0, 0.077, z, 27, 0.012, 0.035);
      for (const z of [-20, 10, 36]) box('white', 0, 0.086, z, 28, 0.018, 0.11);
    }

    // Layered architectural lotus petals: separate slabs behind the bird.
    // The lower tips are partly hidden by vegetation in the reference, not freestanding flowers.
    function lotusPetal(
      color: ChimXanhPaletteKey,
      base: [number, number],
      tip: [number, number],
      shoulder: [number, number],
      z: number,
      depth: number
    ): void {
      const s = new THREE.Shape();
      s.moveTo(...base);
      s.bezierCurveTo(
        base[0] + (tip[0] - base[0]) * 0.18,
        base[1] + 3,
        tip[0] + (base[0] - tip[0]) * 0.25,
        tip[1] - 2,
        ...tip
      );
      s.quadraticCurveTo((tip[0] + shoulder[0]) / 2, tip[1] + 0.12, ...shoulder);
      s.bezierCurveTo(shoulder[0], shoulder[1] - 4, base[0] + 0.3, base[1] + 2, ...base);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: far ? 5 : 10 });
      g.translate(0, 0, z);
      add(color, g);

      // Warm-white cap follows the upper rim and spans the thickness of the slab.
      const c = new THREE.QuadraticBezierCurve(
        new THREE.Vector2(...tip),
        new THREE.Vector2((tip[0] + shoulder[0]) / 2, tip[1] + 0.12),
        new THREE.Vector2(...shoulder)
      );
      const pts = c.getPoints(far ? 5 : 10);
      const rim = new THREE.Shape();
      rim.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach((p) => rim.lineTo(p.x, p.y));
      [...pts].reverse().forEach((p) => rim.lineTo(p.x, p.y - 0.24));
      rim.closePath();
      const cap = new THREE.ExtrudeGeometry(rim, { depth: depth + 0.08, bevelEnabled: false });
      cap.translate(0, 0.035, z - 0.04);
      add('white', cap);
    }

    lotusPetal('pink', [-13.2, 1], [-19.7, 13], [-13, 14.1], -41.3, 0.65);
    lotusPetal('pink', [-13.4, 1], [-20.1, 9.6], [-16.3, 8.7], -41.7, 0.48);
    lotusPetal('blue', [12.9, 1.3], [21, 14.7], [16.8, 15.1], -40.8, 0.65);
    lotusPetal('blue', [13.1, 1.3], [20, 10.7], [17.4, 10.4], -39.1, 0.48);

    // Red panel and shallow stage shell behind the blue silhouette.
    shape(
      'red',
      [
        [-13, 0.8],
        [-13, 17.7],
        [1.9, 17.7],
        [3.4, 17.2],
        [4.6, 15.8],
        [5.3, 13.5],
        [5.3, 0.8],
      ],
      1.2,
      -40.4
    );
    box('white', -0.1, 6.5, -38.8, 19.4, 11.4, 0.65);
    box('white', -10, 6.5, -40.7, 0.6, 11.4, 5.4);
    box('white', 9.8, 6.5, -40.7, 0.6, 11.4, 5.4);
    box('white', -0.1, 12.1, -38.5, 20.4, 0.45, 2);
    box('stone', -0.1, 0.64, -36.25, 22, 1.28, 13.5);
    box('white', -0.1, 1.32, -36.25, 21.8, 0.12, 13.5);

    // Stair flights remain at both sides, as in the street photographs.
    for (const x of [-10, 9.9]) {
      for (let i = 0; i < 5; i++) {
        box('stone', x, 0.14 + i * 0.25, -27.75 - i * 0.42, 2.5, 0.28 + i * 0.5, 0.6);
      }
    }

    // Bird is one sculpted planar architectural shape with an open-bottom stage recess.
    const bird = new THREE.Shape();
    bird.moveTo(-10.5, 1.3);
    bird.lineTo(-10.5, 11.9);
    bird.lineTo(-13.3, 13.5);
    bird.lineTo(-8.8, 20.5);
    bird.bezierCurveTo(-5.2, 16.5, 0.3, 12.4, 4.3, 13.6);
    bird.bezierCurveTo(7, 14.2, 7.3, 17.5, 8.4, 19.6);
    bird.bezierCurveTo(9.7, 22.4, 12.3, 22.7, 14.1, 21.1);
    bird.bezierCurveTo(14.8, 20.6, 14.9, 19.8, 15.8, 19.2);
    bird.lineTo(17.2, 18.5);
    bird.lineTo(15.6, 18.2);
    bird.bezierCurveTo(14.7, 17.4, 14.4, 16.1, 14.2, 14.9);
    bird.bezierCurveTo(14.05, 12.5, 13.6, 5.5, 13, 1.3);
    bird.lineTo(9.9, 1.3);
    bird.lineTo(9.9, 11.9);
    bird.lineTo(-9.9, 11.9);
    bird.lineTo(-9.9, 1.3);
    bird.closePath();

    const bg = new THREE.ExtrudeGeometry(bird, { depth: 0.48, bevelEnabled: false, curveSegments: far ? 5 : 12 });
    bg.translate(0, 0, -37.5);
    add('blue', bg);

    const eye = new THREE.CircleGeometry(0.28, far ? 8 : 16);
    eye.translate(12.2, 20.15, -37.01);
    add('white', eye);

    // Small geometric red emblem visible above the opening in the aerial reference.
    shape(
      'red',
      [
        [-0.7, 12.7],
        [-0.8, 13.4],
        [-0.2, 13.4],
        [0.05, 13.7],
        [0.8, 13.5],
        [0.65, 12.8],
        [0, 12.6],
      ],
      0.06,
      -36.99
    );

    if (context) {
      // Left edge: three separate slim open kiosks with grey roofs.
      for (const [z, d] of [
        [-20, 14],
        [-1, 16],
        [29, 17],
      ]) {
        box('wood', -21, 1.4, z, 7.2, 2.8, d);
        box('metal', -21, 3.3, z, 8.4, 0.3, d + 1);
        box('wood', -16.9, 1.1, z, 1.2, 2.2, d - 1);
        if (!far) {
          for (let zz = z - d / 2 + 0.5; zz < z + d / 2; zz += 3.2) {
            box('metal', -16.85, 2, zz, 0.16, 3.8, 0.16);
          }
        }
      }

      // Right edge: circular pavilion and adjacent long brown pitched roof.
      cyl('wood', 20, 2.05, -20, 6.8, 4.1);
      const dome = new THREE.ConeGeometry(7.8, 4.3, far ? 12 : 24, 1);
      dome.translate(20, 6.2, -20);
      add('roof', dome);
      box('wood', 20, 2, 0, 12, 4, 18);
      roof(20, 0, 14, 20, 4, 5.2);
      if (!far) {
        for (const z of [-8, -3, 2, 7]) box('white', 13.92, 2, z, 0.09, 2.8, 1.5);
        for (let z = -8; z <= 8; z += 2) box('wood', 12.8, 2.1, z, 0.18, 4.2, 0.18);
        for (const x of [12, 14.2, 25.8, 28]) box('wood', x, 1.9, -20, 0.15, 3.8, 0.15);
      }

      // Low irregular terrace behind the pavilions plus square parasol cluster.
      box('white', 21, 2.1, -37, 10, 4.2, 10);
      box('red', 21, 4.25, -37, 10.5, 0.2, 10.5);
      if (!far) {
        for (const x of [12.6, 16]) {
          for (const z of [-33, -29]) {
            cyl('wood', x, 1.5, z, 0.06, 3);
            const cap = new THREE.ConeGeometry(2.1, 0.65, 4);
            cap.rotateY(Math.PI / 4);
            cap.translate(x, 3.15, z);
            add('roof', cap);
          }
        }
      }
    }

    // Garden islands frame the front entry; leave the centre unobstructed.
    for (const [x, z, r] of [
      [-18, 41, 5.8],
      [18, 32, 6.8],
      [20, 44, 4.2],
      [-20, -34, 4.2],
    ]) {
      cyl('stone', x, 0.12, z, r, 0.22);
      cyl('grass', x, 0.25, z, r - 0.2, 0.12);
    }

    if (!far) {
      // Sparse benches and representative outdoor exercise equipment.
      for (const [x, z] of [
        [-14, 37],
        [15, 25],
        [14, 41],
        [-16, 12],
      ]) {
        box('wood', x, 0.65, z, 2.4, 0.18, 0.65);
        box('wood', x, 1.08, z - 0.3, 2.4, 0.6, 0.12);
        for (const dx of [-0.8, 0.8]) box('metal', x + dx, 0.3, z, 0.12, 0.6, 0.5);
      }
      for (const [x, z] of [
        [18, 28],
        [22, 32],
        [16, 36],
      ]) {
        for (const dx of [-0.65, 0.65]) cyl('metal', x + dx, 1.25, z, 0.055, 2.5);
        box('metal', x, 2.5, z, 1.4, 0.1, 0.1);
        box('red', x, 0.45, z, 1.2, 0.13, 0.45);
      }
      for (const [x, z] of [
        [-14, -25],
        [14, -28],
        [-14, 15],
        [15, 13],
      ]) {
        cyl('metal', x, 4.1, z, 0.065, 8.2);
        box('metal', x, 8.1, z, 1.3, 0.14, 0.2);
        for (const dx of [-0.4, 0.4]) box('white', x + dx, 8.2, z, 0.34, 0.22, 0.35);
      }
    }

    if (trees) {
      for (const [x, z, s] of [
        [-23, -40, 0.8],
        [-25, -10, 1],
        [-25, 12, 0.85],
        [-22, 43, 1],
        [-14, 47, 0.8],
        [24, 44, 1],
        [25, 26, 0.95],
        [27, 13, 0.8],
        [28, -13, 0.85],
        [27, -34, 0.75],
        [-16, -35, 0.65],
        [17, -39, 0.65],
      ]) {
        cyl('wood', x, 2.5 * s, z, 0.26 * s, 5 * s);
        cyl('white', x, 0.55, z, 0.28 * s, 1.1);
        primitive('leaf', leafGeo, [x, 6 * s, z], [2.8 * s, 3.1 * s, 2.6 * s]);
        if (!far) {
          primitive('leafLight', leafGeo, [x - 1.3 * s, 5.7 * s, z + 0.8 * s], [2.1 * s, 2.2 * s, 1.9 * s]);
        }
      }
    }

    for (const [key, geos] of batches) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) throw new Error('Merge failed ' + key);
      merged.computeBoundingSphere();
      owned.add(merged);
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.name = key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  const root = new THREE.Group() as ChimXanhGroup;
  root.name = 'Quảng trường Con Chim Xanh · Xuân Hòa';
  root.rotation.y = THREE.MathUtils.degToRad(180 - bearing);
  root.scale.setScalar(scale);

  const lod = new THREE.LOD();
  const near = build(false);
  const far = build(true);
  lod.addLevel(near, 0);
  lod.addLevel(far, lodDistance * scale, 0.12);
  root.add(lod);

  boxGeo.dispose();
  leafGeo.dispose();
  cylGeo.dispose();

  const stats = (g: THREE.Group) => ({
    drawCalls: g.children.length,
    triangles: g.children.reduce((s, m) => s + ((m as THREE.Mesh).geometry?.attributes.position.count ?? 0) / 3, 0),
  });

  root.userData = {
    landmarkId: CHIM_XANH_LANDMARK_ID,
    placeId: CHIM_XANH_PLACE_ID,
    location: LOCATION,
    bearing,
    dimensionsEstimated: { width: 54, length: 104 },
    stats: {
      near: stats(near),
      far: stats(far),
      materials: Object.keys(materials).length,
    },
    lod,
  };

  root.setDetail = (mode: ChimXanhDetailMode) => {
    if (!['auto', 'near', 'far'].includes(mode)) {
      throw new Error('Invalid detail');
    }
    lod.autoUpdate = mode === 'auto';
    if (mode !== 'auto') {
      near.visible = mode === 'near';
      far.visible = mode === 'far';
    }
  };

  root.dispose = () => {
    owned.forEach((g) => g.dispose());
    Object.values(materials).forEach((m) => m.dispose());
    root.removeFromParent();
  };

  return root;
}
