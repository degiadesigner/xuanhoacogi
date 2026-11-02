import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const NHA_TRANG_ID = 'osm_landmark_nha_trang_xuan_hoa';
export const NHA_TRANG_LANDMARK_ID = 'nha_trang_xuan_hoa';
export const REFERENCE_LOCATION = { lat: 21.27805, lng: 105.729321 } as const;

export interface LandmarkAlignment {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotationY: number;
  scale: number;
}

export interface LandmarkPlace {
  id: string;
  lat: number | null;
  lng: number | null;
  visibilityStatus?: string;
  metadata?: { landmarkTransform?: Partial<LandmarkAlignment> };
}

export type ProjectPlace = (lng: number, lat: number) => { x: number; y: number; z: number };

export const DEFAULT_ALIGNMENT: LandmarkAlignment = {
  offsetX: 6.5,
  offsetY: 0,
  offsetZ: -10.5,
  rotationY: 1.0,
  scale: 0.92,
};

export const NHA_TRANG_EDIT_ANCHORS = {
  primaryCorner: { x: -10, z: 5, label: 'Góc bo tròn mái vòm vàng' },
  frontageA: { x: 22.2, z: 6.2, label: 'Cánh mặt tiền chính (Phố Lê Xoay)' },
  frontageB: { x: -12.2, z: -16, label: 'Cánh mặt tiền phụ (Nguyễn Văn Linh)' },
} as const;

type PaletteKey = 'wall' | 'trim' | 'glass' | 'base' | 'gold' | 'goldSeam' | 'roof';

const palette: Record<PaletteKey, number> = {
  wall: 0xe5e1d3,
  trim: 0xf2ecdc,
  glass: 0x43545a,
  base: 0x303c3e,
  gold: 0xc5a76b,
  goldSeam: 0x9a8255,
  roof: 0xb4b3a6,
};

export interface WhiteHouseModel extends THREE.Group {
  dispose: () => void;
}

/**
 * Local geometry only: no geographic coordinates, scene lights or animation.
 * Main front +Z; rounded corner at left (-X,+Z). Width ~39m, height ~26m.
 * Three primary commercial floors + taller setback upper mass from the photos.
 */
export function createWhiteHouseModel(): WhiteHouseModel {
  const root = new THREE.Group() as WhiteHouseModel;
  root.name = 'NhaTrangXuanHoaModel';
  const mats = Object.fromEntries(
    Object.entries(palette).map(([k, color]) => [k, new THREE.MeshLambertMaterial({ color })])
  ) as Record<PaletteKey, THREE.MeshLambertMaterial>;
  const batches = new Map<PaletteKey, THREE.BufferGeometry[]>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const geometries: THREE.BufferGeometry[] = [];
  const counts: Record<string, number> = {};
  let part = 'main mass';

  const add = (k: PaletteKey, g: THREE.BufferGeometry) => {
    if (g.index) {
      const old = g;
      g = old.toNonIndexed();
      old.dispose();
    }
    if (!batches.has(k)) batches.set(k, []);
    batches.get(k)!.push(g);
    counts[part] = (counts[part] ?? 0) + 1;
  };

  function box(k: PaletteKey, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) {
    const g = cube.clone();
    g.scale(w, h, d);
    g.rotateY(ry);
    g.translate(x, y, z);
    add(k, g);
  }

  function cyl(k: PaletteKey, x: number, y: number, z: number, r: number, h: number, segments = 24) {
    const g = new THREE.CylinderGeometry(r, r, h, segments);
    g.translate(x, y, z);
    add(k, g);
  }

  function extrude(k: PaletteKey, s: THREE.Shape, depth: number, x: number, y: number, z: number, ry = 0) {
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
    g.rotateY(ry);
    g.translate(x, y, z);
    add(k, g);
  }

  function archShape(w: number, h: number) {
    const r = w / 2;
    const s = new THREE.Shape();
    s.moveTo(-r, 0);
    s.lineTo(r, 0);
    s.lineTo(r, h - r);
    s.absarc(0, h - r, r, 0, Math.PI, false);
    s.lineTo(-r, 0);
    return s;
  }

  // Geometry is generated in named architectural parts, then merged by material.
  box('wall', 5, 7.5, -5, 34, 15, 22);
  box('base', 5, 0.65, -5, 34.2, 1.3, 22.2);

  part = 'left rounded corner tower';
  cyl('wall', -10, 8, 5, 4.6, 16);
  cyl('base', -10, 0.55, 5, 4.7, 1.1);
  for (const [y, r, h] of [
    [0.15, 4.95, 0.3],
    [0.4, 4.8, 0.2],
    [5.05, 4.75, 0.35],
    [10.1, 4.8, 0.36],
    [15.2, 5.0, 0.35],
    [15.65, 5.15, 0.35],
    [16, 4.95, 0.25],
  ]) {
    cyl('trim', -10, y, 5, r, h);
  }
  cyl('wall', -10, 17, 5, 4.05, 2);

  part = 'gold dome';
  const dome = new THREE.SphereGeometry(4.2, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.62, 1);
  dome.translate(-10, 18, 5);
  add('gold', dome);
  cyl('goldSeam', -10, 18, 5, 4.25, 0.16);
  cyl('gold', -10, 20.7, 5, 0.22, 0.35, 10);
  const finial = new THREE.ConeGeometry(0.18, 0.7, 8);
  finial.translate(-10, 21.2, 5);
  add('gold', finial);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const pts: THREE.Vector3[] = [];
    for (let j = 1; j <= 10; j++) {
      const t = (j * Math.PI) / 20;
      pts.push(
        new THREE.Vector3(
          -10 + 4.22 * Math.sin(t) * Math.cos(a),
          18 + 2.62 * Math.cos(t),
          5 + 4.22 * Math.sin(t) * Math.sin(a)
        )
      );
    }
    add('goldSeam', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.025, 3, false));
  }

  part = 'roof and setback mass';
  box('roof', 5, 15.1, -5, 33, 0.2, 21);
  box('wall', 5, 19.45, -7, 28, 8.7, 15);
  for (const [y, w, d] of [
    [15.5, 29, 16],
    [23.7, 29, 16],
    [24.1, 29.5, 16.5],
  ]) {
    box('trim', 5, y, -7, w, 0.3, d);
  }
  box('roof', 5, 24.3, -7, 28, 0.1, 15);

  // Curved pediments on the upper front, plus one on the return façade.
  for (const [x, z, ry] of [
    [-6, 0.99, 0],
    [8, 0.99, 0],
    [17, 0.99, 0],
    [-9.1, -10, -Math.PI / 2],
  ]) {
    extrude('trim', archShape(4.8, 3.0), 0.28, x, 22.2, z, ry);
    extrude('wall', archShape(4.05, 2.55), 0.1, x, 22.35, z + 0.3, ry);
  }

  part = 'facade bands';
  for (const y of [4.85, 5.25, 9.9, 10.2, 14.8, 15.2, 15.55]) {
    box('trim', 5, y, 6.2, 34.8, 0.22, 0.5);
    box('trim', -12.2, y, -5, 0.5, 0.22, 22.4);
    box('trim', 22.2, y, -5, 0.5, 0.22, 22.4);
  }

  function windowAt(x: number, y: number, z: number, w: number, h: number, ry = 0) {
    extrude('trim', archShape(w + 0.48, h + 0.25), 0.12, x, y - 0.12, z, ry);
    const nx = Math.sin(ry) * 0.14;
    const nz = Math.cos(ry) * 0.14;
    extrude('glass', archShape(w, h), 0.04, x + nx, y, z + nz, ry);
    box('trim', x + Math.sin(ry) * 0.21, y + h * 0.4, z + Math.cos(ry) * 0.21, 0.065, h * 0.8, 0.055, ry);
  }

  part = 'arched windows';
  for (const x of [-3.8, 0.9, 5.6, 10.3, 15, 19.7]) {
    for (const y of [5.8, 10.7]) windowAt(x, y, 6.27, 2.5, 3.5);
  }
  for (const z of [-12.8, -8.1, -3.4, 1.3]) {
    for (const y of [5.8, 10.7]) windowAt(-12.27, y, z, 2.5, 3.5, -Math.PI / 2);
  }
  for (const z of [-12.8, -8.1, -3.4, 1.3]) {
    for (const y of [5.8, 10.7]) windowAt(22.27, y, z, 2.5, 3.5, Math.PI / 2);
  }

  // Radial windows around the rounded corner, tangent to its cylindrical surface.
  for (const a of [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4]) {
    windowAt(-10 + Math.sin(a) * 4.62, 10.65, 5 + Math.cos(a) * 4.62, 2.1, 3.5, a);
    box('glass', -10 + Math.sin(a) * 4.07, 17.05, 5 + Math.cos(a) * 4.07, 1.35, 1.25, 0.1, a);
  }
  for (const x of [-5.5, -0.5, 4.5, 9.5, 14.5, 17.5]) {
    windowAt(x, 20.15, 0.56, 1.65, 2.6);
    box('glass', x, 18.15, 0.62, 1.65, 2.5, 0.1);
  }
  for (const z of [-11.5, -6.5, -1.8]) {
    windowAt(-9.06, 20.15, z, 1.65, 2.6, -Math.PI / 2);
    box('glass', -9.1, 18.15, z, 0.1, 2.5, 1.65);
  }

  part = 'pilasters';
  for (const x of [-6.3, -1.5, 3.25, 7.95, 12.65, 17.35, 22]) {
    box('trim', x, 10, 6.45, 0.38, 9, 0.45);
    for (const y of [5.5, 9.5, 10.5, 14.5]) box('trim', x, y, 6.52, 0.65, 0.25, 0.6);
  }
  for (const x of [-8.6, -3, 2, 7, 12, 18.7]) {
    box('trim', x, 19.6, 0.78, 0.42, 7.5, 0.42);
    box('trim', x, 23.3, 0.84, 0.8, 0.3, 0.55);
  }

  part = 'ground-floor retail frontage';
  for (const x of [-3.8, 0.9, 5.6, 10.3, 15, 19.7]) {
    box('glass', x, 2.35, 6.12, 3.8, 3.3, 0.16);
    box('base', x, 4.2, 6.25, 4, 0.5, 0.22);
    box('trim', x - 2.12, 2.5, 6.35, 0.35, 4.7, 0.4);
  }
  for (const z of [-12, -7, -2]) {
    box('glass', -12.12, 2.3, z, 0.16, 3.2, 3.8);
    box('base', -12.25, 4.2, z, 0.22, 0.5, 4);
  }

  // Large dark screen is a dominant permanent feature in all supplied views.
  const angle = -Math.PI / 4;
  box('trim', -13.15, 7.2, 8.15, 8, 5.9, 0.5, angle);
  box('base', -13.4, 7.2, 8.4, 7.35, 5.2, 0.14, angle);
  box('glass', -10, 2.35, 9.63, 1.5, 3, 0.08);

  cube.dispose();
  for (const [key, list] of batches) {
    const g = mergeGeometries(list, false);
    list.forEach((v) => v.dispose());
    if (!g) throw new Error('Merge failed ' + key);
    g.computeBoundingSphere();
    geometries.push(g);
    const mesh = new THREE.Mesh(g, mats[key]);
    mesh.name = key;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  root.userData = {
    landmarkId: NHA_TRANG_LANDMARK_ID,
    placeId: NHA_TRANG_ID,
    editAnchors: NHA_TRANG_EDIT_ANCHORS,
    parts: counts,
    stats: {
      meshes: root.children.length,
      materials: Object.keys(mats).length,
      triangles: geometries.reduce((n, g) => n + g.attributes.position.count / 3, 0),
    },
    estimatedDimensions: true,
  };

  root.dispose = () => {
    geometries.forEach((g) => g.dispose());
    Object.values(mats).forEach((m) => m.dispose());
    root.removeFromParent();
  };
  return root;
}

/** Transform-only update: moving the Place never rebuilds or duplicates geometry. */
export function updateWhiteHousePlacement(
  model: THREE.Group,
  place: LandmarkPlace | undefined,
  project: ProjectPlace,
  alignment: Partial<LandmarkAlignment> = {}
): void {
  const valid =
    place?.id === NHA_TRANG_ID &&
    typeof place.lat === 'number' &&
    typeof place.lng === 'number' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    Math.abs(place.lat) <= 90 &&
    Math.abs(place.lng) <= 180;
  if (!valid || ['hidden', 'deleted', 'blocked'].includes(place!.visibilityStatus ?? '')) {
    model.visible = false;
    return;
  }
  const t = { ...DEFAULT_ALIGNMENT, ...place!.metadata?.landmarkTransform, ...alignment };
  if (!Object.values(t).every(Number.isFinite) || t.scale <= 0) {
    throw new Error('Invalid landmark alignment');
  }
  const p = project(place!.lng!, place!.lat!);
  if (![p.x, p.y, p.z].every(Number.isFinite)) {
    model.visible = false;
    return;
  }
  model.position.set(p.x + t.offsetX, p.y + t.offsetY, p.z + t.offsetZ);
  model.rotation.y = t.rotationY;
  model.scale.setScalar(t.scale);
  model.visible = true;
  model.userData.placeId = place!.id;
}
