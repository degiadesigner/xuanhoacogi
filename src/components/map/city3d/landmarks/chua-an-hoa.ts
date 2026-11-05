import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface ChuaAnHoaModel extends T.Group {
  dispose: () => void;
}

export const CHUA_AN_HOA_LOCATION = {
  lat: 21.2891926,
  lng: 105.7133076,
} as const;

export const LOCATION = CHUA_AN_HOA_LOCATION;

/**
 * Exact 100% port of Codex model `outputs/chua-an-hoa/temple.js` (`createTemple()`).
 * Preserves all geometry, arched Tam Quan 3 portals with curved roofs, standing bodhisattva
 * beside the gate, interlocking central hall roofs, right annex, and `CHÙA AN HÒA` sign.
 */
export function createChuaAnHoa(): ChuaAnHoaModel {
  const root = new T.Group() as unknown as ChuaAnHoaModel;
  root.name = 'ChuaAnHoa';
  const batches = new Map<string, T.BufferGeometry[]>();
  const owned: Array<{ dispose: () => void }> = [];

  const mats: Record<string, T.Material> = Object.fromEntries(
    Object.entries({
      wall: 0xe2c68f,
      roof: 0xb77355,
      blue: 0xf0dba6,
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

  box('paving', 0, -0.12, -8, 48, 0.24, 64);
  // Tam quan: open vaulted portals, not flat painted door shapes.
  function portal(cx: number, width: number, height: number, top: number, depth: number) {
    const r = width / 2,
      s = new T.Shape();
    s.moveTo(cx - r - 0.55, 0);
    s.lineTo(cx - r - 0.55, top);
    s.lineTo(cx + r + 0.55, top);
    s.lineTo(cx + r + 0.55, 0);
    s.lineTo(cx + r, 0);
    s.lineTo(cx + r, height - r);
    s.absarc(cx, height - r, r, 0, Math.PI, false);
    s.lineTo(cx - r, 0);
    s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, 19);
    add('wall', g);
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i * Math.PI) / 16;
      pts.push([cx + r * Math.cos(t), height - r + r * Math.sin(t), 20.05]);
    }
    line('roof', pts, 0.11);
    for (const x of [cx - r - 0.3, cx + r + 0.3]) {
      box('roof', x, top / 2, 20.05, 0.12, top - 0.3, 0.12);
      box('blue', x, 0.15, 19.5, 0.75, 0.3, 1.2);
      box('blue', x, top - 0.15, 19.5, 0.85, 0.25, 1.3);
    }
  }
  portal(0, 4.8, 5.2, 6.3, 1);
  portal(-4.2, 1.8, 3.6, 4.4, 1);
  portal(4.2, 1.8, 3.6, 4.4, 1);
  roof(0, 19.5, 7.1, 3.2, 6.2, 0.7);
  box('wall', 0, 7.65, 19.5, 5.9, 1.6, 1.7);
  roof(0, 19.5, 7, 3.2, 8.4, 0.7);
  roof(-4.6, 19.5, 3.6, 2.9, 4.3, 0.6);
  roof(4.6, 19.5, 3.6, 2.9, 4.3, 0.6);
  for (const x of [-4.2, 4.2]) {
    box('wood', x, 0.7, 19.55, 1.65, 1.4, 0.12);
    for (let dx = -0.7; dx <= 0.7; dx += 0.2) cyl('wood', x + dx, 2, 19.55, 0.023, 2.5, 6);
  }
  for (const x of [-9, 9]) box('wall', x, 1.1, 19.5, 5, 2.2, 0.4);
  // Satellite-derived central interlocking hall roofs and long right-side annex.
  box('wall', -3, 2.3, -5, 23, 4.6, 12);
  roof(-3, -5, 25, 14, 4.6, 2.2);
  box('wall', -3, 3, -16, 12, 6, 12);
  roof(-3, -16, 14, 14, 6, 2.4);
  box('wall', -3, 2.4, -27, 23, 4.8, 9);
  roof(-3, -27, 25, 11, 4.8, 1.8);
  for (const x of [-11, -3, 5]) {
    box('wood', x, 2.3, 1.05, 2.8, 3.6, 0.12);
    cyl('roof', x - 1.8, 2, 2, 0.15, 4);
  }
  box('paving', -3, 0.3, 1, 25, 0.6, 5);
  for (let i = 0; i < 3; i++) box('roof', -3, 0.1 + i * 0.15, 4.8 - i * 0.45, 25, 0.2 + i * 0.3, 0.65);
  box('wall', 17, 2.1, -12, 7, 4.2, 37);
  roof(17, -12, 9, 39, 4.2, 1.3);
  box('wall', -1, 2.2, -36, 16, 4.4, 7);
  roof(-1, -36, 18, 9, 4.4, 1.7);
  // Forecourt burner, garden and low perimeter.
  cyl('stone', -3, 0.6, 8, 0.5, 1);
  const urn = new T.CylinderGeometry(0.85, 0.5, 0.65, 12);
  urn.translate(-3, 1.1, 8);
  add('stone', urn);
  for (const x of [-24, 24]) box('wall', x, 0.65, -8, 0.3, 1.3, 64);
  for (const [x, z] of [
    [-17, 12],
    [-18, -9],
    [-17, -31],
    [13, 11],
    [20, -34],
  ]) {
    cyl('wood', x, 2, z, 0.25, 4);
    const g = new T.IcosahedronGeometry(2.7, 1);
    g.translate(x, 4.5, z);
    add('leaf', g);
  }
  // Simplified fixed standing bodhisattva beside the gate, as in the reference.
  cyl('stone', -8.8, 0.5, 16, 1, 0.8);
  const robe = new T.ConeGeometry(0.62, 3.2, 10);
  robe.translate(-8.8, 2.4, 16);
  add('wall', robe);
  const head = new T.SphereGeometry(0.3, 10, 8);
  head.translate(-8.8, 4.15, 16);
  add('wall', head);
  line(
    'wall',
    [
      [-9.25, 3.5, 16],
      [-9.35, 2.7, 16.1],
      [-9, 2.6, 16.2],
    ],
    0.16
  );
  line(
    'wall',
    [
      [-8.4, 3.5, 16],
      [-8.25, 3.1, 16.1],
      [-8.5, 3.2, 16.25],
    ],
    0.16
  );
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
      ctx.fillText('CHÙA AN HÒA', 256, 64, 490);
    }
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    owned.push(tex);
    mats.sign = new T.MeshBasicMaterial({ map: tex });
    const sign = new T.PlaneGeometry(4.9, 0.8);
    sign.translate(0, 7.65, 20.37);
    add('sign', sign);
  }
  mats.roof.side = T.DoubleSide;
  for (const [k, gs] of batches) {
    const g = mergeGeometries(gs, false);
    gs.forEach((v) => v.dispose());
    owned.push(g);
    const m = new T.Mesh(g, mats[k]);
    m.name = `ChuaAnHoa_${k}`;
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

export const createTemple = createChuaAnHoa;
