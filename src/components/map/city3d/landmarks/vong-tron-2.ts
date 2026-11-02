import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const VONG_TRON_2_PLACE_ID = 'osm_landmark_vong_tron_2';
export const VONG_TRON_2_LANDMARK_ID = 'vong_tron_2';
export const LOCATION = Object.freeze({ lat: 21.281682, lng: 105.724983 });

export type VongTron2PaletteKey =
  | 'stone'
  | 'paving'
  | 'soil'
  | 'hedge'
  | 'leaf'
  | 'red'
  | 'gold'
  | 'white'
  | 'metal'
  | 'flower';

export const PALETTE: Readonly<Record<VongTron2PaletteKey, number>> = Object.freeze({
  stone: 0xb8b8a9,
  paving: 0xd9d0b9,
  soil: 0x776d50,
  hedge: 0x617d44,
  leaf: 0x879b48,
  red: 0xa94e50,
  gold: 0xd7bb71,
  white: 0xeee8d7,
  metal: 0x7e8170,
  flower: 0xb76459,
});

export type VongTron2DetailMode = 'auto' | 'near' | 'far';

export interface VongTron2Options {
  bearing?: number;
  scale?: number;
  lodDistance?: number;
  flags?: boolean;
  monument?: boolean;
  palette?: Partial<Record<VongTron2PaletteKey, number>>;
}

export interface VongTron2Group extends THREE.Group {
  setDetail: (mode: VongTron2DetailMode) => void;
  dispose: () => void;
}

/**
 * Local long axis +X, Y up; metres. Bearing describes long axis clockwise
 * from north in a host world with +X east and +Z south.
 */
export function createVongTron2({
  bearing = 90,
  scale = 1,
  lodDistance = 100,
  flags = true,
  monument = true,
  palette = {},
}: VongTron2Options = {}): VongTron2Group {
  if (
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !Number.isFinite(bearing) ||
    !Number.isFinite(lodDistance) ||
    lodDistance <= 0
  ) {
    throw new Error('Invalid transform or LOD distance');
  }

  const mats = Object.fromEntries(
    Object.entries({ ...PALETTE, ...palette }).map(([k, color]) => [
      k,
      new THREE.MeshLambertMaterial({
        color,
        flatShading: k === 'leaf' || k === 'hedge',
      }),
    ])
  ) as Record<VongTron2PaletteKey, THREE.MeshLambertMaterial>;

  const geometries = new Set<THREE.BufferGeometry>();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);

  function capsule(length: number, width: number, height: number, y: number): THREE.BufferGeometry {
    const r = width / 2;
    const c = (length - width) / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-c, -r);
    shape.lineTo(c, -r);
    shape.absarc(c, 0, r, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(-c, r);
    shape.absarc(-c, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 12 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    return g;
  }

  function build(far: boolean): THREE.Group {
    const batches = new Map<VongTron2PaletteKey, THREE.BufferGeometry[]>();
    const group = new THREE.Group();
    group.name = far ? 'Vòng tròn 2 / far' : 'Vòng tròn 2 / near';

    const add = (key: VongTron2PaletteKey, g: THREE.BufferGeometry) => {
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key)!.push(g.index ? g.toNonIndexed() : g);
      if (g.index) g.dispose();
    };

    function primitive(
      key: VongTron2PaletteKey,
      geo: THREE.BufferGeometry,
      pos: [number, number, number],
      size: [number, number, number],
      rot: [number, number, number] = [0, 0, 0]
    ): void {
      const g = geo.clone();
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(...pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
        new THREE.Vector3(...size)
      );
      g.applyMatrix4(m);
      add(key, g);
    }

    const box = (k: VongTron2PaletteKey, x: number, y: number, z: number, w: number, h: number, d: number) =>
      primitive(k, unitBox, [x, y, z], [w, h, d]);
    const plant = (k: VongTron2PaletteKey, x: number, y: number, z: number, w: number, h: number, d: number) =>
      primitive(k, leaf, [x, y, z], [w, h, d]);

    function rod(k: VongTron2PaletteKey, a: [number, number, number], b: [number, number, number], r: number): void {
      const dir = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const g = cylinder.clone();
      g.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5),
          q,
          new THREE.Vector3(r, dir.length(), r)
        )
      );
      add(k, g);
    }

    add('stone', capsule(36, 8, 0.32, 0));
    add('paving', capsule(35.7, 7.7, 0.09, 0.32));
    add('stone', capsule(32.2, 5.6, 0.3, 0.41));
    add('soil', capsule(31.85, 5.25, 0.05, 0.71));
    add('hedge', capsule(31.6, 5, 0.24, 0.76));

    // Low clipped planting with deterministic variation; no random palette.
    if (!far) {
      for (let x = -14.5; x <= 14.5; x += 1.05) {
        for (let z = -1.9; z <= 1.9; z += 0.95) {
          const end = Math.max(0, Math.abs(x) - 13.3);
          if (end * end + z * z > 5.7) continue;
          const h = 0.23 + 0.09 * Math.sin(x * 3 + z * 2);
          plant(Math.round(x * 2 + z * 3) % 3 === 0 ? 'leaf' : 'hedge', x, 1.02, z, 0.68, h, 0.57);
        }
      }
      // Paving joints follow the straight walks and curved ends.
      for (let x = -13; x <= 13; x += 1.6) {
        for (const z of [-3.25, 3.25]) box('stone', x, 0.414, z, 0.025, 0.008, 1.05);
      }
      for (const end of [-1, 1]) {
        for (let i = -5; i <= 5; i++) {
          const a = (i * Math.PI) / 10;
          const cx = end * 14;
          const r = 3.22;
          primitive(
            'stone',
            unitBox,
            [cx + end * Math.cos(a) * r, 0.415, Math.sin(a) * r],
            [1.2, 0.008, 0.025],
            [0, -end * a, 0]
          );
        }
      }
    }

    // White pedestal bowls visible in both references.
    for (const [x, z] of [
      [-14.3, -2.5],
      [-14.3, 2.5],
      [-4, -3.05],
      [3.9, 3.05],
      [13.7, -2.5],
      [13.7, 2.5],
    ]) {
      const profile = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.4, 0),
        new THREE.Vector2(0.43, 0.12),
        new THREE.Vector2(0.25, 0.2),
        new THREE.Vector2(0.24, 0.85),
        new THREE.Vector2(0.48, 1.02),
        new THREE.Vector2(0.84, 1.15),
        new THREE.Vector2(0.93, 1.37),
        new THREE.Vector2(0.86, 1.44),
        new THREE.Vector2(0.75, 1.24),
        new THREE.Vector2(0, 1.2),
      ];
      const g = new THREE.LatheGeometry(profile, far ? 10 : 16);
      g.translate(x, 0.41, z);
      add('white', g);
      primitive('soil', cylinder, [x, 1.69, z], [0.75, 0.07, 0.75]);
      plant('leaf', x, 1.82, z, 0.68, 0.23, 0.68);
      if (!far) {
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4;
          const r = i === 0 ? 0 : 0.44;
          plant('flower', x + Math.cos(a) * r, 2.02 + 0.08 * (i % 2), z + Math.sin(a) * r, 0.11, 0.24, 0.11);
        }
      }
    }

    if (monument) {
      // Ring and stylised golden botanical motif, inferred from the oblique image.
      box('stone', 11.4, 0.92, 0, 2.5, 0.35, 1.2);
      const ring = new THREE.TorusGeometry(1.95, 0.17, far ? 4 : 6, far ? 24 : 40);
      ring.scale(1, 1.16, 1);
      ring.translate(11.4, 3.21, 0);
      add('red', ring);
      rod('red', [11.4, 1.05, 0], [11.4, 1.5, 0], 0.14);
      rod('gold', [11.4, 1.48, 0], [11.2, 4.73, 0], 0.065);
      for (let i = 0; i < 5; i++) {
        const y = 1.9 + i * 0.5;
        const s = i % 2 ? -1 : 1;
        const tx = 11.3 + s * (0.8 - 0.055 * i);
        rod('gold', [11.35, y - 0.22, 0], [tx, y + 0.28, 0], 0.045);
        primitive('gold', leaf, [tx, y + 0.3, 0], [0.33, 0.17, 0.12], [0, 0, s * 0.55]);
        if (!far) {
          primitive('gold', leaf, [11.3 - s * 0.38, y + 0.1, 0], [0.26, 0.14, 0.11], [0, 0, -s * 0.65]);
        }
      }
      const petals = far ? 5 : 7;
      for (let i = 0; i < petals; i++) {
        const a = (i * Math.PI * 2) / petals;
        primitive(
          'gold',
          leaf,
          [11.22 + Math.cos(a) * 0.35, 4.75 + Math.sin(a) * 0.3, 0],
          [0.26, 0.13, 0.12],
          [0, 0, a]
        );
      }
      plant('gold', 11.22, 4.75, 0.07, 0.19, 0.19, 0.13);
    }

    if (flags && !far) {
      for (const [x, z] of [
        [-10, -2.1],
        [-5, 2.1],
        [0, -2.1],
        [5, 2.1],
        [10, -2.1],
      ]) {
        rod('metal', [x, 0.8, z], [x, 4.3, z], 0.025);
        // Static folded fabric silhouette; no animation or separate lights.
        const g = new THREE.BufferGeometry();
        g.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(
            [
              x,
              4.25,
              z,
              x + 0.64,
              3.95,
              z + 0.1,
              x + 0.77,
              2.1,
              z + 0.03,
              x,
              4.25,
              z,
              x + 0.77,
              2.1,
              z + 0.03,
              x + 0.12,
              2.3,
              z - 0.04,
            ],
            3
          )
        );
        g.computeVertexNormals();
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
        add('red', g);
      }
    }

    for (const [key, list] of batches) {
      const g = mergeGeometries(list, false);
      list.forEach((v) => v.dispose());
      if (!g) throw new Error('Merge failed ' + key);
      g.computeBoundingSphere();
      geometries.add(g);
      const mesh = new THREE.Mesh(g, mats[key]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = key;
      group.add(mesh);
    }
    return group;
  }

  mats.red.side = THREE.DoubleSide;
  const root = new THREE.Group() as VongTron2Group;
  root.name = 'Vòng tròn 2 · Xuân Hòa';
  root.rotation.y = THREE.MathUtils.degToRad(90 - bearing);
  root.scale.setScalar(scale);

  const lod = new THREE.LOD();
  const near = build(false);
  const far = build(true);
  lod.addLevel(near, 0);
  lod.addLevel(far, lodDistance * scale, 0.12);
  root.add(lod);

  unitBox.dispose();
  leaf.dispose();
  cylinder.dispose();

  const stats = (g: THREE.Group) => ({
    drawCalls: g.children.length,
    triangles: g.children.reduce((s, m) => s + ((m as THREE.Mesh).geometry?.attributes.position.count ?? 0) / 3, 0),
  });

  root.userData = {
    landmarkId: VONG_TRON_2_LANDMARK_ID,
    placeId: VONG_TRON_2_PLACE_ID,
    location: LOCATION,
    bearing,
    estimatedDimensions: { length: 36, width: 8 },
    stats: {
      near: stats(near),
      far: stats(far),
      materials: Object.keys(mats).length,
    },
    lod,
  };

  root.setDetail = (mode: VongTron2DetailMode) => {
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
    geometries.forEach((g) => g.dispose());
    Object.values(mats).forEach((m) => m.dispose());
    root.removeFromParent();
  };

  return root;
}
