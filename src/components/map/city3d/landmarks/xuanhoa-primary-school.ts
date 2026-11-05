import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface XuanHoaPrimarySchoolModel extends T.Group {
  dispose: () => void;
}

export const XUANHOA_PRIMARY_SCHOOL_LOCATION = {
  lat: 21.2819871,
  lng: 105.7275988,
} as const;

export const LOCATIONS = {
  primary: { lat: 21.2819871, lng: 105.7275988 },
  secondary: { lat: 21.2820837, lng: 105.7265017 },
} as const;

export function createSchoolGate(kind: 'primary' | 'secondary' = 'primary'): XuanHoaPrimarySchoolModel {
  if (!LOCATIONS[kind]) throw Error('Unknown school');
  const primary = kind === 'primary';
  const root = new T.Group() as unknown as XuanHoaPrimarySchoolModel;
  const batches = new Map<string, T.BufferGeometry[]>();
  const owned: Array<{ dispose: () => void }> = [];
  const mats: Record<string, T.Material> = Object.fromEntries(
    Object.entries({
      wall: 0xe2dfce,
      red: primary ? 0x98584b : 0xb07765,
      cap: 0xf0eee1,
      glass: 0x375c62,
      metal: primary ? 0xe7e7dc : 0x929c96,
      stone: 0x8d9186,
      sign: primary ? 0x252e2e : 0x353b88,
    }).map(([k, color]) => [k, new T.MeshLambertMaterial({ color })])
  );
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
    const g = new T.BoxGeometry(w, h, d);
    g.rotateY(ry);
    g.translate(x, y, z);
    add(k, g);
  }
  function beam(k: string, a: [number, number, number], b: [number, number, number], r: number) {
    const v = new T.Vector3(...b).sub(new T.Vector3(...a));
    const g = new T.CylinderGeometry(r, r, v.length(), 6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()));
    g.translate(
      ...new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(0.5).toArray()
    );
    add(k, g);
  }
  const span = primary ? 6 : 6.6,
    height = primary ? 5.8 : 3.4;
  for (const x of [-span / 2, span / 2]) {
    box('wall', x, height / 2, 0, 0.72, height, 0.85);
    box('red', x, height / 2, 0.44, 0.52, height - 0.15, 0.08);
    if (primary) {
      for (const dx of [-0.25, 0.25]) box('cap', x + dx, height / 2, 0.5, 0.045, height, 0.05);
    } else {
      box('cap', x, height + 0.05, 0, 0.95, 0.2, 1.05);
      const g = new T.ConeGeometry(0.6, 0.32, 4);
      g.rotateY(Math.PI / 4);
      g.translate(x, height + 0.3, 0);
      add('stone', g);
    }
  }
  if (primary) {
    box('cap', 0, 5.85, 0, 8.5, 0.28, 2);
    box('stone', 0, 6.02, 0, 8.65, 0.1, 2.1);
    box('cap', 0, 4.65, 0, 6, 0.25, 0.8);
    box('sign', 0, 5.22, 0.38, 5.3, 0.72, 0.15);
    box('wall', -5.7, 1.95, -0.8, 3.5, 3.9, 3.1);
    box('red', -5.7, 3.35, 0.8, 3.5, 0.9, 0.15);
    box('cap', -5.7, 4, -0.8, 4, 0.23, 3.5);
    box('glass', -5.7, 2.4, 0.81, 2.45, 1.25, 0.1);
    for (let x = -6.8; x < -4.5; x += 0.4) box('metal', x, 2.4, 0.89, 0.05, 1.25, 0.06);
    for (const x of [-4.05, 4.5]) {
      box('red', x, 1.9, 0, 0.32, 3.8, 0.6);
      box('cap', x, 3.9, 0, 2.1, 0.2, 1);
    }
    const s = new T.Shape();
    s.moveTo(-0.6, 0);
    s.lineTo(0.6, 0);
    s.lineTo(0.6, 0.9);
    s.lineTo(0.2, 1.25);
    s.lineTo(-0.25, 1.25);
    s.lineTo(-0.6, 0.5);
    s.closePath();
    const hole = new T.Path();
    hole.absellipse(0.2, 0.55, 0.14, 0.23, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new T.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false });
    g.translate(-2.7, 6.1, -0.1);
    add('red', g);
  } else {
    for (const x of [-3.3, 3.3]) box('metal', x, 4.2, 0, 0.1, 1.5, 0.1);
    box('sign', 0, 4.6, 0, 8.5, 1.18, 0.18);
  }
  for (const side of [-1, 1]) {
    const x = side * 6.6;
    box('wall', x, 0.55, 0, 5.5, 1.1, 0.35);
    box('cap', x, 1.15, 0, 5.6, 0.15, 0.5);
    for (let xx = x - 2.6; xx < x + 2.7; xx += 0.28) box('metal', xx, 1.95, 0, 0.055, 1.6, 0.06);
    for (const y of [1.35, 2.6]) box('metal', x, y, 0, 5.5, 0.06, 0.07);
  }
  // Open leaves, rotated inward; all bars merge into one shared material batch.
  for (const side of [-1, 1]) {
    const hinge = side * (span / 2 - 0.4),
      angle = side * 1.05,
      w = primary ? 2.25 : 2.55;
    const point = (u: number, y: number): [number, number, number] => [
      hinge - side * u * Math.cos(angle),
      y,
      -u * Math.abs(Math.sin(angle)),
    ];
    for (let u = 0; u <= w; u += 0.19) beam('metal', point(u, 0.15), point(u, 2.65), 0.025);
    for (const y of [0.15, 0.32, 0.5, 2.65]) beam('metal', point(0, y), point(w, y), 0.04);
    if (primary)
      for (const dy of [0, 0.18, 0.36]) beam('metal', point(0, 1.1 + dy), point(w, 1.9 + dy), 0.03);
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = primary ? '#252e2e' : '#353b88';
      ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = primary ? '#ed7767' : '#f5efd9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 48px Arial';
      ctx.fillText(
        primary ? 'TRƯỜNG TIỂU HỌC XUÂN HÒA' : 'TRƯỜNG TRUNG HỌC CƠ SỞ XUÂN HÒA',
        512,
        64,
        980
      );
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    owned.push(tex);
    mats.text = new T.MeshBasicMaterial({ map: tex });
    const g = new T.PlaneGeometry(primary ? 5.2 : 8.3, primary ? 0.66 : 1.08);
    g.translate(0, primary ? 5.22 : 4.6, primary ? 0.47 : 0.105);
    add('text', g);
  }
  for (const [k, gs] of batches) {
    const g = mergeGeometries(gs, false);
    gs.forEach((v) => v.dispose());
    owned.push(g);
    const m = new T.Mesh(g, mats[k]);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  root.userData = {
    kind,
    location: LOCATIONS[kind],
    stats: {
      meshes: root.children.length,
      triangles: root.children.reduce(
        (n, m) =>
          n +
          (((m as T.Mesh).geometry?.index?.count ??
            (m as T.Mesh).geometry?.attributes?.position?.count ??
            0) /
            3),
        0
      ),
    },
  };
  root.dispose = () => {
    owned.forEach((v) => v.dispose());
    Object.values(mats).forEach((m) => m.dispose());
    root.removeFromParent();
  };
  return root;
}

/**
 * Exact 100% port of Codex model `outputs/khuon-vien-truong/campus.js` + `gates.js` (`createSchoolCampus(kind)`).
 */
export function createSchoolCampus(kind: 'primary' | 'secondary' = 'primary'): XuanHoaPrimarySchoolModel {
  if (!LOCATIONS[kind]) throw Error('Unknown campus');
  const primary = kind === 'primary';
  const root = new T.Group() as unknown as XuanHoaPrimarySchoolModel;
  root.name = primary ? 'XuanHoaPrimarySchool' : 'XuanHoaSecondarySchool';
  const gate = createSchoolGate(kind);
  gate.position.set(primary ? 5 : 7, 0, 34);
  root.add(gate);

  const mats: Record<string, T.Material> = Object.fromEntries(
    Object.entries({
      wall: primary ? 0xe9e4cf : 0xe5d8b4,
      trim: 0xf2edda,
      roof: 0x985957,
      grayRoof: 0x596c70,
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

  box('paving', 0, -0.16, 0, 58, 0.3, 72);
  if (primary) {
    block(-24, -1, 64, 7, 2, Math.PI / 2);
    block(-2, -28, 39, 8, 2);
    block(24, -1, 61, 8, 3, -Math.PI / 2, 'grayRoof');
  } else {
    block(-24, -9, 36, 7, 2, Math.PI / 2);
    block(-1, -29, 46, 8, 2);
    block(24, -1, 65, 8, 3, -Math.PI / 2);
  }
  // Perimeter with an open entrance at the existing gate.
  for (const x of [-29, 29]) box('wall', x, 0.8, 0, 0.3, 1.6, 72);
  box('wall', 0, 0.8, -36, 58, 1.6, 0.3);
  const gx = primary ? 5 : 7;
  for (const [a, b] of [
    [-29, gx - 9.5],
    [gx + 9.5, 29],
  ])
    box('wall', (a + b) / 2, 0.65, 34, b - a, 1.3, 0.3);
  for (let z = -20; z < 30; z += 3) box('metal', 0, 0.008, z, 35, 0.012, 0.025);
  // A few trees and round planters in the positions readable in the aerials.
  const trees: Array<[number, number, number]> = primary
    ? [
        [-13, 19, 1],
        [-6, 25, 1.1],
        [-18, 29, 0.9],
        [16, 27, 0.8],
        [-8, 8, 0.8],
      ]
    : [
        [-15, 21, 1],
        [-8, 25, 1.1],
        [-19, 28, 0.9],
        [0, -7, 0.8],
        [-10, -9, 0.9],
        [10, 8, 0.7],
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
  // Small roofed entrance shelter visible inside the THCS yard.
  if (!primary) block(-2, 27, 8, 4, 1, 0);
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
    location: LOCATIONS[kind],
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

export function createXuanHoaPrimarySchool(): XuanHoaPrimarySchoolModel {
  return createSchoolCampus('primary');
}
