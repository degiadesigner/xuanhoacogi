import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LOCATION = Object.freeze({ lat: 21.2777621, lng: 105.7292981 });
export const PLACE_ID = 'osm_landmark_vong_tron_1';
export const VONG_TRON_1_LANDMARK_ID = 'vong_tron_1';

export type VongTron1PaletteKey =
  | 'stone'
  | 'paving'
  | 'white'
  | 'basin'
  | 'metal'
  | 'greenMetal'
  | 'hedge'
  | 'leaf'
  | 'flower'
  | 'red'
  | 'gold';

export const PALETTE: Readonly<Record<VongTron1PaletteKey, number>> = Object.freeze({
  stone: 0xaaa99c,
  paving: 0xd3cebd,
  white: 0xe7e2d1,
  basin: 0x8a9389,
  metal: 0x89938b,
  greenMetal: 0x365b49,
  hedge: 0x627d42,
  leaf: 0x859445,
  flower: 0xc77d4c,
  red: 0xb84b48,
  gold: 0xd2b46b,
});

export type VongTron1DetailMode = 'auto' | 'near' | 'far';

export interface VongTron1Options {
  scale?: number;
  rotationY?: number;
  lodDistance?: number;
  flags?: boolean;
  boards?: boolean;
  palette?: Partial<Record<VongTron1PaletteKey, number>>;
}

export interface VongTron1Group extends THREE.Group {
  setDetail: (mode: VongTron1DetailMode) => void;
  dispose: () => void;
}

/**
 * Local origin at island centre, ground Y=0. No geographic placement or lights.
 * Radius and heights are visual estimates from the provided photos.
 */
export function createVongTron1({
  scale = 1,
  rotationY = 0,
  lodDistance = 100,
  flags = true,
  boards = true,
  palette = {},
}: VongTron1Options = {}): VongTron1Group {
  if (![scale, rotationY, lodDistance].every(Number.isFinite) || scale <= 0 || lodDistance <= 0) {
    throw new Error('Invalid model transform');
  }

  const mats = Object.fromEntries(
    Object.entries({ ...PALETTE, ...palette }).map(([k, color]) => [
      k,
      new THREE.MeshLambertMaterial({
        color,
        flatShading: k === 'hedge' || k === 'leaf',
      }),
    ])
  ) as Record<VongTron1PaletteKey, THREE.MeshLambertMaterial>;
  mats.red.side = THREE.DoubleSide;

  const owned = new Set<THREE.BufferGeometry>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const foliage = new THREE.IcosahedronGeometry(1, 0);
  const pt = (r: number, a: number, y = 0) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));

  function build(far: boolean): THREE.Group {
    const batches = new Map<VongTron1PaletteKey, THREE.BufferGeometry[]>();
    const group = new THREE.Group();
    group.name = far ? 'Vòng tròn 1 / far' : 'Vòng tròn 1 / near';

    function add(k: VongTron1PaletteKey, g: THREE.BufferGeometry): void {
      if (g.index) {
        const old = g;
        g = g.toNonIndexed();
        old.dispose();
      }
      if (!batches.has(k)) batches.set(k, []);
      batches.get(k)!.push(g);
    }

    function primitive(
      k: VongTron1PaletteKey,
      g: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      ry = 0
    ): void {
      const v = g.clone();
      v.scale(w, h, d);
      v.rotateY(ry);
      v.translate(x, y, z);
      add(k, v);
    }

    const box = (k: VongTron1PaletteKey, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) =>
      primitive(k, cube, x, y, z, w, h, d, ry);

    function cylinder(
      k: VongTron1PaletteKey,
      r: number,
      h: number,
      y: number,
      x = 0,
      z = 0,
      segments = far ? 32 : 64
    ): void {
      const g = new THREE.CylinderGeometry(r, r, h, segments);
      g.translate(x, y, z);
      add(k, g);
    }

    function lathe(
      k: VongTron1PaletteKey,
      profile: Array<[number, number]>,
      x = 0,
      z = 0,
      segments = far ? 16 : 32
    ): void {
      const g = new THREE.LatheGeometry(
        profile.map((p) => new THREE.Vector2(...p)),
        segments
      );
      g.translate(x, 0, z);
      add(k, g);
    }

    function rod(k: VongTron1PaletteKey, a: THREE.Vector3, b: THREE.Vector3, r: number): void {
      const dir = b.clone().sub(a);
      const g = new THREE.CylinderGeometry(r, r, dir.length(), far ? 4 : 6);
      g.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
      );
      const mid = a.clone().add(b).multiplyScalar(0.5);
      g.translate(mid.x, mid.y, mid.z);
      add(k, g);
    }

    function ring(k: VongTron1PaletteKey, r: number, y: number, tube: number): void {
      const g = new THREE.TorusGeometry(r, tube, far ? 3 : 4, far ? 32 : 48);
      g.rotateX(Math.PI / 2);
      g.translate(0, y, 0);
      add(k, g);
    }

    function sector(
      k: VongTron1PaletteKey,
      r0: number,
      r1: number,
      start: number,
      end: number,
      y: number,
      depth: number
    ): void {
      const s = new THREE.Shape();
      s.moveTo(r0 * Math.cos(start), r0 * Math.sin(start));
      s.lineTo(r1 * Math.cos(start), r1 * Math.sin(start));
      s.absarc(0, 0, r1, start, end, false);
      s.lineTo(r0 * Math.cos(end), r0 * Math.sin(end));
      s.absarc(0, 0, r0, end, start, true);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: far ? 12 : 24 });
      g.rotateX(Math.PI / 2);
      g.translate(0, y + depth, 0);
      add(k, g);
    }

    // Circular pavement and raised outer kerb, not an elongated traffic island.
    cylinder('stone', 10, 0.3, 0.15);
    cylinder('paving', 9.86, 0.07, 0.335);
    if (!far) {
      for (let i = 0; i < 64; i++) {
        const a = (i * Math.PI) / 32;
        box('stone', Math.cos(a) * 9.05, 0.374, Math.sin(a) * 9.05, 1.5, 0.008, 0.018, -a);
      }
      ring('stone', 8.75, 0.374, 0.012);
      ring('stone', 9.35, 0.374, 0.012);
    }

    // Three curved planted beds, separated by access paths as visible overhead.
    for (let i = 0; i < 3; i++) {
      const start = (i * Math.PI * 2) / 3 + 0.19;
      const end = ((i + 1) * Math.PI * 2) / 3 - 0.19;
      sector('stone', 6.65, 8.48, start, end, 0.37, 0.15);
      sector('hedge', 6.8, 8.34, start + 0.01, end - 0.01, 0.52, 0.3);
      if (!far) {
        for (let j = 0; j < 19; j++) {
          const a = start + 0.09 + (j * (end - start - 0.18)) / 18;
          for (const r of [7.08, 7.8]) {
            const p = pt(r, a);
            primitive('leaf', foliage, p.x, 0.88, p.z, 0.43, 0.21, 0.4);
          }
          if (j > 5 && j < 13) {
            const p = pt(7.6, a);
            primitive('flower', foliage, p.x, 1.02, p.z, 0.14, 0.14, 0.14);
          }
        }
      }
      for (const a of [start + 0.3, end - 0.3]) {
        const p = pt(7.35, a);
        primitive('hedge', foliage, p.x, 1.05, p.z, 0.55, 0.55, 0.55);
      }
    }

    // Open dry basin: granite ring, visible floor, inner circular plinth.
    cylinder('basin', 5.85, 0.12, 0.5);
    lathe('stone', [
      [5.76, 0.39],
      [6.08, 0.39],
      [6.08, 1.4],
      [5.76, 1.4],
      [5.76, 0.39],
    ]);
    lathe('paving', [
      [5.69, 1.35],
      [6.16, 1.35],
      [6.16, 1.48],
      [5.69, 1.48],
      [5.69, 1.35],
    ]);
    cylinder('stone', 2.7, 0.52, 0.8);
    ring('paving', 2.73, 1.1, 0.09);

    // Central stack of three shallow flared bowls on a straight column.
    lathe(
      'white',
      (
        [
          [0, 1.05],
          [0.66, 1.05],
          [0.66, 1.85],
          [2.9, 1.85],
          [3.05, 1.98],
          [3.05, 2.09],
          [2.65, 2.13],
          [0.5, 2.13],
          [0.5, 2.77],
          [1.68, 2.77],
          [1.88, 2.9],
          [1.88, 3.03],
          [1.57, 3.07],
          [0.36, 3.07],
          [0.36, 3.7],
          [1.08, 3.7],
          [1.25, 3.83],
          [1.25, 3.94],
          [1.03, 4.01],
          [0.16, 4.01],
          [0.1, 4.12],
          [0, 4.12],
        ] as Array<[number, number]>
      ).map(([r, y]) => [r * 0.58, y])
    );

    // Stainless ring manifold and nozzle heads, without animated water.
    ring('metal', 5.42, 1.18, 0.035);
    if (!far) {
      ring('metal', 4.45, 0.67, 0.035);
      for (let i = 0; i < 28; i++) {
        const a = (i * Math.PI * 2) / 28;
        const p = pt(4.65, a, 0.64);
        const q = pt(4.54, a, 0.9);
        const r = pt(4.4, a, 0.99);
        rod('metal', p, q, 0.034);
        rod('metal', q, r, 0.04);
      }
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10;
        rod('metal', pt(5.42, a, 0.55), pt(5.42, a, 1.18), 0.027);
      }
    }

    // White pedestal planters around the outer walking ring.
    for (let i = 0; i < 4; i++) {
      const a = 0.48 + (i * Math.PI) / 2;
      const p = pt(9, a);
      lathe(
        'white',
        [
          [0, 0.37],
          [0.4, 0.37],
          [0.43, 0.49],
          [0.27, 0.57],
          [0.23, 1.1],
          [0.4, 1.32],
          [0.75, 1.45],
          [0.86, 1.67],
          [0.84, 1.74],
          [0.71, 1.56],
          [0, 1.5],
        ],
        p.x,
        p.z,
        far ? 12 : 20
      );
      primitive('leaf', foliage, p.x, 1.72, p.z, 0.66, 0.25, 0.66);
      if (!far) {
        for (let j = 0; j < 8; j++) {
          const t = j * 2.4;
          primitive(
            j % 2 ? 'flower' : 'red',
            foliage,
            p.x + Math.cos(t) * 0.45,
            1.97,
            p.z + Math.sin(t) * 0.45,
            0.1,
            0.24,
            0.1
          );
        }
      }
    }

    // Four green decorative lampposts with paired saucer heads. Geometry only.
    for (let i = 0; i < 4; i++) {
      const a = 0.05 + (i * Math.PI) / 2;
      const p = pt(7.65, a);
      cylinder('greenMetal', 0.16, 0.35, 0.55, p.x, p.z, 8);
      cylinder('greenMetal', 0.065, 4.7, 2.9, p.x, p.z, 8);
      rod('greenMetal', new THREE.Vector3(p.x - 0.5, 5.12, p.z), new THREE.Vector3(p.x + 0.5, 5.12, p.z), 0.045);
      for (const dx of [-0.5, 0.5]) {
        cylinder('white', 0.13, 0.3, 5.28, p.x + dx, p.z, 8);
        cylinder('greenMetal', 0.43, 0.07, 5.47, p.x + dx, p.z, 12);
      }
    }

    if (flags && !far) {
      for (let i = 0; i < 8; i++) {
        const a = 0.33 + (i * Math.PI) / 4;
        const p = pt(7.8, a);
        rod('metal', p.clone().setY(0.6), p.clone().setY(4.3), 0.022);
        const g = new THREE.BufferGeometry();
        g.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(
            [0, 4.2, 0, 0.56, 3.95, 0.08, 0.78, 2.1, 0.02, 0, 4.2, 0, 0.78, 2.1, 0.02, 0.1, 2.3, -0.04],
            3
          )
        );
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
        g.computeVertexNormals();
        g.rotateY(-a);
        g.translate(p.x, 0, p.z);
        add('red', g);
      }
    }

    // Simplified event boards: proportions and colors, no invented slogans.
    if (boards && !far) {
      for (let i = 0; i < 3; i++) {
        const a = 0.15 + (i * Math.PI * 2) / 3;
        const p = pt(8.8, a);
        const ry = Math.PI / 2 - a;
        box('gold', p.x, 1.76, p.z, 1.35, 2.75, 0.16, ry);
        const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
        box('red', p.x + n.x * 0.1, 1.76, p.z + n.z * 0.1, 1.2, 2.6, 0.06, ry);
        for (const y of [1.3, 1.6, 1.9, 2.65]) {
          box('gold', p.x + n.x * 0.14, y, p.z + n.z * 0.14, 0.8, 0.045, 0.025, ry);
        }
      }
    }

    for (const [k, list] of batches) {
      const g = mergeGeometries(list, false);
      list.forEach((v) => v.dispose());
      if (!g) throw new Error('Merge failed ' + k);
      g.computeBoundingSphere();
      owned.add(g);
      const mesh = new THREE.Mesh(g, mats[k]);
      mesh.name = k;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  const root = new THREE.Group() as VongTron1Group;
  root.name = 'Vòng tròn 1 · Nguyễn Văn Linh';
  root.rotation.y = rotationY;
  root.scale.setScalar(scale);

  const lod = new THREE.LOD();
  const near = build(false);
  const far = build(true);
  lod.addLevel(near, 0);
  lod.addLevel(far, lodDistance * scale, 0.12);
  root.add(lod);

  cube.dispose();
  foliage.dispose();

  const stats = (g: THREE.Group) => ({
    meshes: g.children.length,
    triangles: g.children.reduce((n, m) => n + ((m as THREE.Mesh).geometry?.attributes.position.count ?? 0) / 3, 0),
  });

  root.userData = {
    landmarkId: VONG_TRON_1_LANDMARK_ID,
    location: LOCATION,
    placeId: PLACE_ID,
    estimatedDiameter: 20,
    stats: {
      near: stats(near),
      far: stats(far),
      materials: Object.keys(mats).length,
    },
    lod,
  };

  root.setDetail = (mode: VongTron1DetailMode) => {
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
    Object.values(mats).forEach((m) => m.dispose());
    root.removeFromParent();
  };

  return root;
}

/** Call after Place or alignment changes; lat/lng remain the source of position. */
export function updateVongTron1Placement(
  model: THREE.Group,
  place: { id?: string; lat?: number | null; lng?: number | null; visibilityStatus?: string } | undefined,
  project: (lng: number, lat: number) => { x: number; y: number; z: number },
  alignment: { offsetX?: number; offsetY?: number; offsetZ?: number; rotationY?: number; scale?: number } = {}
): void {
  if (
    place?.id !== PLACE_ID ||
    typeof place.lat !== 'number' ||
    typeof place.lng !== 'number' ||
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lng) ||
    ['hidden', 'deleted', 'blocked'].includes(place.visibilityStatus ?? '')
  ) {
    model.visible = false;
    return;
  }
  const { offsetX = 0, offsetY = 0, offsetZ = 0, rotationY = 0, scale = 1 } = alignment;
  if (![offsetX, offsetY, offsetZ, rotationY, scale].every(Number.isFinite) || scale <= 0) {
    throw new Error('Invalid alignment');
  }
  const p = project(place.lng, place.lat);
  model.position.set(p.x + offsetX, p.y + offsetY, p.z + offsetZ);
  model.rotation.y = rotationY;
  model.scale.setScalar(scale);
  model.visible = true;
}
