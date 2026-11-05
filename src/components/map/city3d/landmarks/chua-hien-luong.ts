import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface ChuaHienLuongModel extends T.Group {
  dispose: () => void;
}

export const CHUA_HIEN_LUONG_LOCATION = {
  lat: 21.2856174,
  lng: 105.7175459,
} as const;

export const LOCATION = CHUA_HIEN_LUONG_LOCATION;

/**
 * Exact 100% port of Codex model `outputs/chua-hien-luong/temple.js` (`createTemple()`).
 * Preserves all geometry, curved double-pitched roofs, blue veranda, red lanterns,
 * golden pagoda finial, forecourt incense vessel, and `CHÙA HIỀN LƯƠNG` sign.
 */
export function createChuaHienLuong(): ChuaHienLuongModel {
  const root = new T.Group() as unknown as ChuaHienLuongModel;
  root.name = 'ChuaHienLuong';
  const batches = new Map<string, T.BufferGeometry[]>();
  const owned: Array<{ dispose: () => void }> = [];

  const mats: Record<string, T.Material> = Object.fromEntries(
    Object.entries({
      wall: 0xe1c66e,
      roof: 0xb77355,
      blue: 0x6fadb6,
      wood: 0x563f31,
      red: 0xb74238,
      gold: 0xd6b34e,
      stone: 0x84958e,
      paving: 0xbba593,
      leaf: 0x718765,
    }).map(([k, color]) => [
      k,
      new T.MeshLambertMaterial({ color, flatShading: k === 'leaf' }),
    ])
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
  function box(k: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    const g = new T.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    add(k, g);
  }
  function cyl(k: string, x: number, y: number, z: number, r: number, h: number, n = 12) {
    const g = new T.CylinderGeometry(r, r, h, n);
    g.translate(x, y, z);
    add(k, g);
  }
  function line(k: string, points: Array<[number, number, number]>, r = 0.055) {
    add(
      k,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        16,
        r,
        5,
        false
      )
    );
  }

  // Curved double-pitched roof; corners rise strongly to preserve the temple silhouette.
  function roof(x: number, z: number, w: number, d: number, y: number, rise: number) {
    const nx = 12,
      nz = 8,
      positions: number[] = [],
      indices: number[] = [];
    function height(u: number, v: number) {
      return (
        y +
        rise * (1 - Math.abs(v)) +
        0.85 * Math.pow(Math.abs(u), 6) +
        0.35 * Math.pow(Math.abs(v), 5)
      );
    }
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const u = (i / nx) * 2 - 1,
          v = (j / nz) * 2 - 1;
        positions.push(x + (u * w) / 2, height(u, v), z + (v * d) / 2);
      }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i,
          b = a + 1,
          c = a + nx + 1;
        indices.push(a, c, b, b, c, c + 1);
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    g.setAttribute(
      'uv',
      new T.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2)
    );
    add('roof', g);
    for (const v of [-1, 1])
      line(
        'blue',
        Array.from({ length: 13 }, (_, i) => {
          const u = i / 6 - 1;
          return [x + (u * w) / 2, height(u, v) + 0.06, z + (v * d) / 2] as [number, number, number];
        }),
        0.1
      );
    line(
      'blue',
      [
        [x - w / 2, y + rise + 0.9, z],
        [x - w * 0.3, y + rise + 0.1, z],
        [x + w * 0.3, y + rise + 0.1, z],
        [x + w / 2, y + rise + 0.9, z],
      ],
      0.11
    );
    for (const side of [-1, 1])
      for (const v of [-1, 1]) {
        const xx = x + (side * w) / 2,
          zz = z + (v * d) / 2;
        line(
          'blue',
          [
            [xx, y + 1.2, zz],
            [xx + side * 0.45, y + 1.7, zz],
            [xx + side * 0.5, y + 2.05, zz],
            [xx + side * 0.23, y + 2.2, zz],
          ],
          0.11
        );
      }
  }

  box('paving', 0, -0.12, 0, 34, 0.24, 39);
  box('wall', 0, 4.6, -3, 20, 8.3, 13);
  box('wood', 0, 8.85, -3, 21, 0.35, 14);
  for (const x of [-6.3, 0, 6.3]) {
    box('wood', x, 2.5, 3.55, 3.3, 3.6, 0.15);
    box('wood', x, 7, 3.55, 3.3, 3.05, 0.15);
    for (const dx of [-1.3, -0.9, -0.5, -0.1, 0.3, 0.7, 1.1])
      box('gold', x + dx, 8.2, 3.65, 0.045, 0.4, 0.04);
  }
  // Front veranda and blue mural band, simplified without image textures.
  box('blue', 0, 4.4, 5, 23, 1.45, 1.6);
  for (const x of [-10.5, -3.6, 3.6, 10.5]) {
    box('blue', x, 2.05, 5, 0.45, 4.1, 0.5);
    box('stone', x, 0.25, 5, 0.75, 0.5, 0.75);
    box('stone', x, 3.65, 5, 0.7, 0.25, 0.65);
  }
  box('paving', 0, 0.35, 3.5, 23, 0.7, 7);
  for (let i = 0; i < 4; i++) box('roof', 0, 0.1 + i * 0.16, 8 - i * 0.45, 23, 0.2 + i * 0.32, 0.75);
  box('gold', 0, 4.4, 5.85, 6.1, 1.18, 0.13);
  box('red', 0, 4.4, 5.94, 5.8, 0.95, 0.1);
  roof(0, -3, 23, 16, 9, 2.2);
  box('wall', 0, 12.2, -3, 5.5, 2, 4);
  for (const x of [-1.8, 0, 1.8]) box('wood', x, 12.2, -0.95, 1.1, 1.1, 0.08);
  roof(0, -3, 7, 5.5, 13.1, 1);
  // Central golden pagoda finial and simplified roof ornaments.
  for (let i = 0; i < 5; i++) {
    cyl('gold', 0, 11.8 + i * 0.37, 1.1, 0.45 - i * 0.05, 0.28, 8);
    box('gold', 0, 12 + i * 0.37, 1.1, 1.1 - i * 0.1, 0.08, 1.1 - i * 0.1);
  }
  for (const x of [-9, -6, -3, 3, 6, 9]) {
    const g = new T.SphereGeometry(0.3, 10, 6);
    g.scale(1, 0.85, 1);
    g.translate(x, 8.1, 5.2);
    add('red', g);
    cyl('gold', x, 7.7, 5.2, 0.045, 0.35, 6);
  }
  // Incense vessel and paired stone stands in the forecourt.
  cyl('stone', 0, 0.6, 10, 0.6, 1);
  const bowl = new T.CylinderGeometry(1, 0.65, 0.6, 12);
  bowl.translate(0, 1.2, 10);
  add('stone', bowl);
  for (const side of [-1, 1]) {
    line(
      'stone',
      [
        [side * 0.7, 1.2, 10],
        [side * 1.2, 1.4, 10],
        [side * 1.2, 1.75, 10],
        [side * 0.9, 1.8, 10],
      ],
      0.09
    );
    cyl('stone', side * 2.5, 0.9, 10, 0.17, 1.8);
    for (const y of [0.15, 1.3, 1.7]) cyl('stone', side * 2.5, y, 10, 0.36, 0.13);
  }
  // Satellite-estimated rear/side annexes, kept subordinate to the main hall.
  box('wall', 0, 2.1, -15, 24, 4.2, 5);
  roof(0, -15, 25, 6, 4.2, 1.1);
  box('wall', 13, 1.8, -7, 4, 3.6, 12);
  roof(13, -7, 5, 13, 3.6, 0.8);
  for (const [x, z] of [
    [-14, 4],
    [14, 9],
    [-13, -13],
  ]) {
    cyl('wood', x, 2, z, 0.25, 4);
    const g = new T.IcosahedronGeometry(2.4, 1);
    g.translate(x, 4.6, z);
    add('leaf', g);
  }
  // Compact text plane; no heavy font extrusion.
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#b74238';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = '#f0d379';
      ctx.font = 'bold 46px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CHÙA HIỀN LƯƠNG', 256, 64, 490);
    }
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    owned.push(tex);
    mats.sign = new T.MeshBasicMaterial({ map: tex });
    const sign = new T.PlaneGeometry(5.5, 0.85);
    sign.translate(0, 4.4, 6.01);
    add('sign', sign);
  }
  mats.roof.side = T.DoubleSide;
  for (const [k, gs] of batches) {
    const g = mergeGeometries(gs, false);
    gs.forEach((v) => v.dispose());
    owned.push(g);
    const m = new T.Mesh(g, mats[k]);
    m.name = `ChuaHienLuong_${k}`;
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  root.userData = {
    location: LOCATION,
    stats: {
      meshes: root.children.length,
      triangles: root.children.reduce(
        (n, m) => n + ((m as T.Mesh).geometry?.attributes?.position?.count ?? 0) / 3,
        0
      ),
    },
  };
  root.dispose = () => {
    owned.forEach((v) => v.dispose());
    Object.values(mats).forEach((v) => v.dispose());
    root.removeFromParent();
  };
  return root;
}

export const createTemple = createChuaHienLuong;
