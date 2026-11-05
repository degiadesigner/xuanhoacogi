import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface MamNonXuanHoaModel extends T.Group {
  dispose: () => void;
}

export const MAM_NON_XUAN_HOA_LOCATION = {
  lat: 21.2863997,
  lng: 105.7218583,
} as const;

export const LOCATION = MAM_NON_XUAN_HOA_LOCATION;

/**
 * Exact 100% port of Codex model `outputs/mam-non-xuan-hoa/kindergarten.js` (`createKindergarten()`).
 * Preserves all geometry, white arched gateway with blue/lavender posts, curved lettering
 * `TRƯỜNG MẦM NON XUÂN HÒA`, 3 playground towers & slide, barrel-vault canopy, and 3 U-shaped classroom wings.
 */
export function createMamNonXuanHoa(): MamNonXuanHoaModel {
  const root = new T.Group() as unknown as MamNonXuanHoaModel;
  root.name = 'MamNonXuanHoa';
  const batches = new Map<string, T.BufferGeometry[]>();
  const owned: Array<{ dispose: () => void }> = [];

  const mats: Record<string, T.Material> = Object.fromEntries(
    Object.entries({
      wall: 0xe8dfb9,
      roof: 0xa65f58,
      blue: 0x4296bf,
      wood: 0x3b5356,
      red: 0xc54b57,
      gold: 0xe4bb45,
      stone: 0x929b9c,
      paving: 0xc5c0ad,
      leaf: 0x66886b,
      white: 0xf1eee3,
      purple: 0x9a85b5,
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

  function hip(x: number, z: number, w: number, d: number, y: number, h: number) {
    const swap = d > w;
    if (swap) {
      const t = w;
      w = d;
      d = t;
    }
    const p = [
      [-w / 2, 0, -d / 2],
      [w / 2, 0, -d / 2],
      [w / 2, 0, d / 2],
      [-w / 2, 0, d / 2],
      [-Math.max(0, w / 2 - d / 2), h, 0],
      [Math.max(0, w / 2 - d / 2), h, 0],
    ];
    const ids = [0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3];
    const g = new T.BufferGeometry();
    g.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        ids.flatMap((i) => [
          (swap ? p[i][2] : p[i][0]) + x,
          p[i][1] + y,
          (swap ? p[i][0] : p[i][2]) + z,
        ]),
        3
      )
    );
    g.computeVertexNormals();
    g.setAttribute('uv', new T.Float32BufferAttribute(new Array(ids.length * 2).fill(0), 2));
    add('roof', g);
  }

  function block(x: number, z: number, w: number, d: number) {
    box('wall', x, 3.5, z, w, 7, d);
    hip(x, z, w + 1, d + 1, 7.1, 2);
    for (const y of [1.9, 5.2]) {
      for (let xx = x - w / 2 + 1.7; xx < x + w / 2 - 1; xx += 3) {
        box('wood', xx, y, z + d / 2 + 0.02, 1.3, 1.8, 0.08);
      }
      box('white', x, y - 1.2, z + d / 2 + 0.35, w, 0.16, 0.9);
    }
  }

  box('paving', 0, -0.16, -5, 48, 0.3, 57);
  // Three classroom wings around the covered courtyard, based on the aerial image.
  block(0, -25, 44, 8);
  block(-18, -8, 8, 27);
  block(18, -4, 8, 35);
  for (const side of [-1, 1])
    for (const z of [-18, -14, -10, -6, -2, 2, 6])
      for (const y of [1.9, 5.2]) {
        box('wood', side * 13.96, y, z, 0.08, 1.8, 1.4);
        box('white', side * 13.5, y - 1.2, z, 1, 0.18, 3.8);
      }
  for (const side of [-1, 1])
    for (let z = -19; z < 10; z += 4) {
      box('wall', side * 13.2, 3.4, z, 0.22, 6.8, 0.22);
    }
  // Barrel-vault steel canopy leaves the forecourt and playground visible.
  const positions: number[] = [],
    indices: number[] = [];
  for (let j = 0; j < 2; j++)
    for (let i = 0; i <= 16; i++) {
      const x = -10 + (20 * i) / 16;
      positions.push(x, 5.8 + 1.4 * Math.sqrt(Math.max(0, 1 - (x * x) / 100)), -19 + j * 28);
    }
  for (let i = 0; i < 16; i++) indices.push(i, i + 17, i + 1, i + 1, i + 17, i + 18);
  const canopy = new T.BufferGeometry();
  canopy.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  canopy.setIndex(indices);
  canopy.computeVertexNormals();
  canopy.setAttribute(
    'uv',
    new T.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2)
  );
  add('stone', canopy);
  mats.stone.side = T.DoubleSide;
  for (const x of [-10, 10])
    for (const z of [-19, -12, -5, 2, 9]) cyl('wood', x, 2.9, z, 0.08, 5.8, 6);
  for (const z of [-19, 9])
    line(
      'white',
      Array.from({ length: 17 }, (_, i) => {
        const x = -10 + (20 * i) / 16;
        return [x, 5.8 + 1.4 * Math.sqrt(Math.max(0, 1 - (x * x) / 100)), z] as [
          number,
          number,
          number,
        ];
      }),
      0.07
    );
  box('blue', 0, 5.45, 9.05, 20, 0.7, 0.12);
  // Recognizable white arched gateway with blue and lavender posts.
  for (const x of [-5.6, 5.6]) {
    box('blue', x, 1.8, 20, 1.15, 3.6, 1.1);
    box('purple', x, 4.2, 20, 1.15, 1.2, 1.1);
    for (const y of [0.15, 3.55, 4.8]) box('blue', x, y, 20, 1.4, 0.2, 1.35);
  }
  const a = new T.Shape();
  a.moveTo(-6.2, 4.9);
  a.quadraticCurveTo(0, 8.6, 6.2, 4.9);
  a.lineTo(6.2, 6.8);
  a.quadraticCurveTo(0, 10.5, -6.2, 6.8);
  a.closePath();
  const ag = new T.ExtrudeGeometry(a, { depth: 0.65, bevelEnabled: false, curveSegments: 24 });
  ag.translate(0, 0, 19.7);
  add('white', ag);
  for (const side of [-1, 1]) {
    box('wall', side * 15, 1, 20, 17, 2, 0.3);
    for (let x = 7; x < 23; x += 0.5) cyl('wood', side * x, 2.5, 20, 0.025, 1, 6);
    for (let z = 17; z <= 20; z += 0.35) cyl('wood', side * 5.1, 1.7, z, 0.026, 3.4, 6);
    box('wood', side * 5.1, 0.5, 18.5, 0.08, 1, 3);
  }
  // Low-poly playground: connected towers, pitched caps and slides. No figures.
  for (const [i, x] of [-7, -3, 1].entries()) {
    const z = 13.1;
    box('blue', x, 1.1, z, 2.5, 0.18, 2.5);
    for (const dx of [-1.1, 1.1])
      for (const dz of [-1.1, 1.1]) cyl('blue', x + dx, 1.5, z + dz, 0.06, 3, 6);
    const g = new T.ConeGeometry(2, 1.05, 4);
    g.rotateY(Math.PI / 4);
    g.translate(x, 3.25, z);
    add(i === 1 ? 'gold' : 'red', g);
    box('gold', x, 1.8, z + 1.2, 2.2, 1.15, 0.1);
    if (i < 2) box('blue', x + 2, 1.1, z, 1.5, 0.15, 1.4);
  }
  line(
    'gold',
    [
      [-7, 1.3, 14.3],
      [-7, 0.9, 15.4],
      [-7, 0.15, 16.5],
      [-7, 0.12, 17],
    ],
    0.35
  );
  for (const [x, z] of [
    [-21, 16],
    [20, 17],
    [-22, -25],
    [22, -27],
  ]) {
    cyl('wood', x, 1.5, z, 0.18, 3);
    const g = new T.IcosahedronGeometry(2.2, 1);
    g.translate(x, 3.8, z);
    add('leaf', g);
  }
  // Transparent lettering follows the gateway arch, using a single small texture.
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 43px Arial';
      ctx.fillStyle = '#be3947';
      const label = 'TRƯỜNG MẦM NON XUÂN HÒA';
      Array.from(label).forEach((c, i) => {
        const u = (i / (label.length - 1) - 0.5) * 2;
        ctx.save();
        ctx.translate(70 + (i * 884) / (label.length - 1), 155 + 92 * u * u);
        ctx.rotate(Math.atan(0.4 * u));
        ctx.fillText(c, 0, 0);
        ctx.restore();
      });
    }
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    owned.push(tex);
    mats.sign = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const sg = new T.PlaneGeometry(12.4, 4.65);
    sg.translate(0, 7, 20.37);
    add('sign', sg);
  }
  for (const [k, gs] of batches) {
    const g = mergeGeometries(gs, false);
    gs.forEach((v) => v.dispose());
    owned.push(g);
    const m = new T.Mesh(g, mats[k]);
    m.name = `MamNonXuanHoa_${k}`;
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

export const createKindergarten = createMamNonXuanHoa;
