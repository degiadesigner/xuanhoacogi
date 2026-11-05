import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface XuanHoaHighSchoolModel extends T.Group {
  dispose: () => void;
}

export const XUANHOA_HIGH_SCHOOL_LOCATION = {
  lat: 21.284455,
  lng: 105.721661,
} as const;

/**
 * Exact 100% port of Codex model `outputs/thpt-xuan-hoa/high-school-gate.js` (`createHighSchoolGate()`).
 */
export function createHighSchoolGate(): XuanHoaHighSchoolModel {
  const root = new T.Group() as unknown as XuanHoaHighSchoolModel;
  const batches = new Map<string, T.BufferGeometry[]>();
  const owned: Array<{ dispose: () => void }> = [];
  const mats: Record<string, T.Material> = Object.fromEntries(
    Object.entries({
      yellow: 0xe4c783,
      red: 0x953e37,
      trim: 0xe8ddbb,
      metal: 0x6c7b6b,
    }).map(([k, color]) => [k, new T.MeshLambertMaterial({ color })])
  );
  function box(k: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    const g = new T.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    if (!batches.has(k)) batches.set(k, []);
    batches.get(k)!.push(g);
  }
  for (const x of [-4.1, 4.1]) {
    box('yellow', x, 2.65, 0, 1.05, 5.3, 1.1);
    box('red', x, 0.35, 0, 1.1, 0.7, 1.15);
    box('trim', x, 5.35, 0, 1.25, 0.22, 1.3);
    for (const y of [1.3, 2.3, 3.3, 4.3]) box('trim', x, y, 0.57, 1.08, 0.045, 0.04);
    for (const dx of [-0.4, 0.4]) box('trim', x + dx, 2.8, 0.57, 0.035, 4.7, 0.04);
  }
  box('red', 0, 5.9, 0, 10.5, 1.1, 0.25);
  for (const x of [-8, 8]) {
    box('yellow', x, 1.5, 0, 6, 3, 0.4);
    box('red', x, 0.3, 0, 6, 0.6, 0.45);
    box('trim', x, 3.05, 0, 6.2, 0.15, 0.6);
  }
  box('yellow', -6.4, 1.4, -1.3, 2.7, 2.8, 2.5);
  box('metal', -6.4, 1.7, 0.02, 1.15, 1.1, 0.06);
  for (const side of [-1, 1])
    for (let i = 0; i < 16; i++)
      box('metal', side * (3.5 - i * 0.045), 1.5, -i * 0.17, 0.035, 2.8, 0.06);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#953e37';
      ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = '#f9de75';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 45px Arial';
      ctx.fillText('TRƯỜNG TRUNG HỌC PHỔ THÔNG XUÂN HÒA', 512, 72, 990);
      ctx.font = '18px Arial';
      ctx.fillStyle = '#f2ead4';
      ctx.fillText('SỞ GIÁO DỤC VÀ ĐÀO TẠO VĨNH PHÚC', 512, 21);
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    owned.push(tex);
    mats.text = new T.MeshBasicMaterial({ map: tex });
    const g = new T.PlaneGeometry(10.35, 1.04);
    g.translate(0, 5.9, 0.135);
    batches.set('text', [g]);
  }
  for (const [k, gs] of batches) {
    const geo = mergeGeometries(gs, false);
    gs.forEach((v) => v.dispose());
    owned.push(geo);
    const mesh = new T.Mesh(geo, mats[k]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  root.dispose = () => {
    owned.forEach((v) => v.dispose());
    Object.values(mats).forEach((v) => v.dispose());
    root.removeFromParent();
  };
  return root;
}

/**
 * Exact 100% port of Codex model `outputs/thpt-xuan-hoa/campus.js` (`createSchoolCampus()`).
 */
export function createXuanHoaHighSchool(): XuanHoaHighSchoolModel {
  const kind = 'highschool',
    primary = false;
  const root = new T.Group() as unknown as XuanHoaHighSchoolModel;
  root.name = 'XuanHoaHighSchool';
  const gate = createHighSchoolGate();
  gate.position.set(3, 0, 64);
  root.add(gate);

  const mats: Record<string, T.Material> = Object.fromEntries(
    Object.entries({
      wall: primary ? 0xe9e4cf : 0xe5d8b4,
      trim: 0xf2edda,
      roof: 0x985957,
      grayRoof: 0xbfc6a0,
      glass: 0x517079,
      paving: 0xc5c4b6,
      metal: 0x818c83,
      leaf: 0x6c875c,
      bark: 0x7a6a50,
      grass: 0x89966e,
    }).map(([k, color]) => [
      k,
      new T.MeshLambertMaterial({ color, flatShading: k === 'leaf' }),
    ])
  );
  const batches = new Map<string, T.BufferGeometry[]>();
  const owned: Array<{ dispose: () => void }> = [];
  const cube = new T.BoxGeometry(1, 1, 1);

  function add(k: string, g: T.BufferGeometry) {
    if (g.index) {
      const old = g;
      g = g.toNonIndexed();
      old.dispose();
    }
    if (!batches.has(k)) batches.set(k, []);
    batches.get(k)!.push(g);
  }
  function box(k: string, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) {
    const g = cube.clone();
    g.scale(w, h, d);
    g.rotateY(ry);
    g.translate(x, y, z);
    add(k, g);
  }
  function block(
    x: number,
    z: number,
    length: number,
    depth: number,
    floors: number,
    ry = 0,
    roof = 'roof'
  ) {
    const h = floors * 3.4;
    const local = (u: number, v: number): [number, number] => [
      x + u * Math.cos(ry) + v * Math.sin(ry),
      z - u * Math.sin(ry) + v * Math.cos(ry),
    ];
    const b = (k: string, u: number, y: number, v: number, w: number, hh: number, d: number) => {
      const [xx, zz] = local(u, v);
      box(k, xx, y, zz, w, hh, d, ry);
    };
    b('wall', 0, h / 2, 0, length, h, depth);
    b('trim', 0, 0.15, 0, length + 0.5, 0.3, depth + 0.5);
    // Continuous recessed glazing, gallery slabs, regular columns facing the yard.
    for (let f = 0; f < floors; f++) {
      b('glass', 0, f * 3.4 + 1.8, depth / 2 + 0.02, length - 0.9, 2.1, 0.08);
      b('trim', 0, f * 3.4 + 0.2, depth / 2 + 0.75, length + 0.3, 0.23, 1.8);
      for (let u = -length / 2 + 0.4; u < length / 2; u += 3.4) {
        b('trim', u, f * 3.4 + 1.75, depth / 2 + 1.25, 0.28, 3.4, 0.28);
        b('wall', u, f * 3.4 + 1.7, depth / 2 + 0.1, 0.42, 3.4, 0.2);
      }
      if (f > 0) {
        b('trim', 0, f * 3.4 + 1, depth / 2 + 1.3, length, 0.12, 0.14);
        for (let u = -length / 2; u < length / 2; u += 0.8)
          b('metal', u, f * 3.4 + 0.65, depth / 2 + 1.3, 0.045, 0.65, 0.045);
      }
      b('trim', 0, f * 3.4 + 0.15, -depth / 2, length, 0.22, 0.2);
    }
    b('trim', 0, h + 0.1, 0, length + 0.6, 0.25, depth + 2.7);
    // Hipped roof with a longitudinal ridge, matching the overhead silhouette.
    const w = length / 2 + 0.55,
      d = depth / 2 + 1.45,
      r = Math.min(d, length / 5),
      rise = 2.1;
    const vertices = [
      [-w, 0, -d],
      [w, 0, -d],
      [w, 0, d],
      [-w, 0, d],
      [-w + r, rise, 0],
      [w - r, rise, 0],
    ];
    const indices = [0, 4, 5, 0, 5, 1, 3, 2, 5, 3, 5, 4, 0, 3, 4, 1, 5, 2];
    const g = new T.BufferGeometry();
    g.setAttribute(
      'position',
      new T.Float32BufferAttribute(indices.flatMap((i) => vertices[i]), 3)
    );
    g.computeVertexNormals();
    g.setAttribute(
      'uv',
      new T.Float32BufferAttribute(new Array(indices.length * 2).fill(0), 2)
    );
    g.rotateY(ry);
    g.translate(x, h + 0.25, z);
    add(roof, g);
  }

  // Approximate campus footprint from supplied aerial; front edge is cropped.
  box('grass', 0, -0.2, 0, 118, 0.3, 132);
  box('paving', 2, -0.025, 0, 6, 0.08, 128);
  box('paving', 29, 0, -10, 48, 0.08, 41);
  box('paving', -28, 0, -34, 57, 0.08, 5);
  box('paving', -26, 0, 34, 55, 0.08, 5);
  // North-west hall: broad pale roof, separate smaller red-roof annex.
  block(-29, -49, 28, 20, 1, 0, 'grayRoof');
  block(-50, -47, 10, 16, 1);
  // Northern classroom wing and eastern short wing around the right court.
  block(29, -33, 41, 8, 2);
  block(52, -5, 20, 8, 2, -Math.PI / 2);
  // Southern L-shaped classroom cluster.
  block(28, 22, 44, 8, 3, Math.PI);
  block(30, 43, 35, 8, 3, -Math.PI / 2);
  block(-21, 56, 29, 7, 1);
  // Large open sports field to the west; pale rectangular playing strip visible in reference.
  box('grass', -29, 0.02, 1, 42, 0.1, 57);
  box('paving', -39, 0.1, 0, 10, 0.06, 29);
  for (const x of [-59, 59]) box('wall', x, 0.7, 0, 0.3, 1.4, 132);
  box('wall', 0, 0.7, -66, 118, 1.4, 0.3);
  for (const [a, b] of [
    [-59, -8],
    [14, 59],
  ])
    box('wall', (a + b) / 2, 0.7, 64, b - a, 1.4, 0.3);
  const trees: Array<[number, number, number]> = [
    [-51, -25, 1.1],
    [-53, 0, 1],
    [-52, 23, 1.1],
    [-15, -23, 1],
    [-12, 10, 1.1],
    [-15, 31, 1],
    [10, -18, 0.9],
    [24, -11, 1],
    [40, -14, 1],
    [14, 9, 1],
    [45, 10, 1],
    [48, 43, 1.1],
    [-8, 53, 1.2],
    [15, 57, 1.1],
    [-42, 43, 1.1],
    [-34, -62, 1],
    [18, -55, 1.2],
    [39, -52, 1.1],
  ];
  for (const [x, z, s] of trees) {
    const planter = new T.CylinderGeometry(2.25 * s, 2.25 * s, 0.3, 16);
    planter.translate(x, 0.15, z);
    add('trim', planter);
    const lawn = new T.CylinderGeometry(2.08 * s, 2.08 * s, 0.12, 16);
    lawn.translate(x, 0.35, z);
    add('grass', lawn);
    const trunk = new T.CylinderGeometry(0.2 * s, 0.32 * s, 4 * s, 6);
    trunk.translate(x, 2 * s, z);
    add('bark', trunk);
    const crown = new T.IcosahedronGeometry(1, 1);
    crown.scale(2.9 * s, 3 * s, 2.6 * s);
    crown.translate(x, 5 * s, z);
    add('leaf', crown);
  }

  box('trim', 4, 0.15, 18, 2.2, 0.3, 2.2);
  const pole = new T.CylinderGeometry(0.045, 0.06, 8, 8);
  pole.translate(4, 4.3, 18);
  add('metal', pole);
  cube.dispose();
  for (const [k, gs] of batches) {
    const g = mergeGeometries(gs, false);
    gs.forEach((v) => v.dispose());
    owned.push(g);
    const mesh = new T.Mesh(g, mats[k]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  let meshes = 0,
    triangles = 0;
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    if (mesh.isMesh) {
      meshes++;
      triangles +=
        (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    }
  });
  root.userData = {
    location: XUANHOA_HIGH_SCHOOL_LOCATION,
    kind,
    stats: { meshes, triangles },
    dimensionsEstimated: true,
  };
  root.dispose = () => {
    gate.dispose();
    owned.forEach((v) => v.dispose());
    Object.values(mats).forEach((v) => v.dispose());
    root.removeFromParent();
  };
  return root;
}
