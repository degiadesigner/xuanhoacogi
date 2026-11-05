import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const REFERENCE_LOCATION = {
  lat: 21.285862,
  lng: 105.717861,
  verified: false,
} as const;

export interface MinhHuongHouseOptions {
  lod?: 0 | 1 | number;
  site?: boolean;
}

export interface MinhHuongHouseGroup extends T.Group {
  dispose: () => void;
}

/**
 * Mô hình 3D Nhà Minh Hường / Minh Hương (Bản FINAL — nha-minh-huong-final/house.js)
 * Port 1:1 nguyên bản từ outputs/nha-minh-huong-final/house.js (không thay đổi geometry, material, màu sắc hay cấu trúc LOD).
 */
export function createMinhHuongHouse({
  lod = 0,
  site = true,
}: MinhHuongHouseOptions = {}): MinhHuongHouseGroup {
  const root = new T.Group() as unknown as MinhHuongHouseGroup;
  const batches = new Map<string, T.BufferGeometry[]>();
  const owned: T.BufferGeometry[] = [];
  const mats: Record<string, T.MeshLambertMaterial> = Object.fromEntries(
    Object.entries({
      wall: 0xe9e9e2,
      roof: 0x39434e,
      frame: 0x243238,
      glass: 0x49616a,
      wood: 0x694631,
      stone: 0x464e4c,
      paving: 0xb9b9af,
      leaf: 0x66816a,
      white: 0xf8f7ef,
      grass: 0x8b9b73,
      flower: 0xb64d79,
      flowerLight: 0xe4a3bf,
      fur: 0xc99c57,
      furLight: 0xe0bb7b,
      nose: 0x282724,
      youngLeaf: 0x8ba957,
    }).map(([k, color]) => [k, new T.MeshLambertMaterial({ color, flatShading: k === 'leaf' })])
  );

  function add(k: string, g: T.BufferGeometry) {
    if (g.index) {
      const old = g;
      g = g.toNonIndexed();
      old.dispose();
    }
    const color = mats[k].color;
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    const batchKey =
      k === 'glass'
        ? 'glass'
        : k === 'roof'
          ? 'roof'
          : ['leaf', 'youngLeaf', 'flower', 'flowerLight', 'grass'].includes(k)
            ? 'landscape'
            : k === 'frame' || k === 'nose'
              ? 'metal'
              : 'solid';
    if (!batches.has(batchKey)) batches.set(batchKey, []);
    batches.get(batchKey)!.push(g);
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

  function line(k: string, points: [number, number, number][], r = 0.055) {
    add(
      k,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        lod ? 6 : 10,
        r,
        4,
        false
      )
    );
  }

  function beam(
    k: string,
    a: [number, number, number],
    b: [number, number, number],
    w = 0.1,
    d = 0.1
  ) {
    const v = new T.Vector3(...b).sub(new T.Vector3(...a));
    const g = new T.BoxGeometry(w, v.length(), d);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()));
    const mid = new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(0.5);
    g.translate(mid.x, mid.y, mid.z);
    add(k, g);
  }

  function gable(x: number, z: number, w: number, d: number, eave: number, rise: number, turn = 0) {
    const tr = (xx: number, yy: number, zz: number): [number, number, number] => [
      x + xx * Math.cos(turn) + zz * Math.sin(turn),
      yy,
      z - xx * Math.sin(turn) + zz * Math.cos(turn),
    ];
    const sh = new T.Shape();
    sh.moveTo(-w / 2, eave);
    sh.lineTo(w / 2, eave);
    sh.lineTo(0, eave + rise);
    sh.closePath();
    const g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    g.rotateY(turn);
    g.translate(x, 0, z);
    add('wall', g);
    const over = 0.5,
      half = w / 2 + over,
      r = rise * (half / (w / 2)),
      low = eave - (rise * over) / (w / 2),
      top = eave + rise;
    for (const side of [-1, 1]) {
      const len = Math.hypot(half, r);
      const panel = new T.BoxGeometry(len, 0.16, d + 1);
      panel.rotateZ(-side * Math.atan2(r, half));
      panel.translate((side * half) / 2, (low + top) / 2, 0);
      panel.rotateY(turn);
      panel.translate(x, 0, z);
      add('roof', panel);
    }
    for (const zz of [-d / 2 - 0.55, d / 2 + 0.55]) {
      for (const side of [-1, 1])
        beam('white', tr(side * half, low, zz), tr(0, top + 0.08, zz), 0.22, 0.22);
    }
    beam('roof', tr(0, top + 0.1, -d / 2 - 0.5), tr(0, top + 0.1, d / 2 + 0.5), 0.14, 0.14);
    for (const zz of [-d / 2, d / 2]) {
      if ((x === -4.2 || turn !== 0) && zz < 0) continue;
      const p = tr(0, top, zz);
      for (let i = 0; i < 3; i++) {
        const ball = new T.SphereGeometry(0.14 - i * 0.025, 6, 4);
        ball.translate(p[0], p[1] + 0.17 + i * 0.18, p[2]);
        add('roof', ball);
      }
      const tip = new T.ConeGeometry(0.07, 0.7, 8);
      tip.translate(p[0], p[1] + 0.95, p[2]);
      add('roof', tip);
    }
  }

  if (site) {
    box('grass', 1, -0.17, -5, 23, 0.3, 41);
    box('stone', -1, -0.03, 11, 15, 0.14, 9);
    box('paving', 8.2, -0.02, -4, 2, 0.12, 22);
  }
  // Actual drone footprint: long main volume, smaller forward left gable and rear cross-gable.
  box('stone', 0, 0.25, -5, 11, 0.5, 20);
  box('wall', 0.8, 2.3, -5, 8.4, 4, 20);
  gable(0.8, -5, 8.4, 20, 4.3, 2.7);
  box('wall', -4.2, 2.05, 3.1, 4.4, 3.5, 7.8);
  box('stone', -4.2, 0.25, 3.1, 4.4, 0.5, 7.8);
  gable(-4.2, 3.1, 4.4, 7.8, 3.8, 2.1);
  box('stone', 4, 0.25, -12.3, 8.4, 0.5, 5.5);
  box('wall', 4, 2.15, -12.3, 8.4, 3.8, 5.5);
  gable(4, -12.3, 5.5, 8.4, 4.05, 2.1, Math.PI / 2);
  // Front porch and dark plinth, with real timber doors instead of the design's glass doors.
  box('stone', 2, 0.34, 6.15, 7.5, 0.3, 2.3);
  box('white', 2.8, 3.65, 6.25, 9.6, 0.23, 3.4);
  box('wall', 2.8, 3.5, 6.25, 9.4, 0.12, 3.2);
  for (const x of [-1.8, 7.55]) box('white', x, 1.96, 7.65, 0.24, 3.4, 0.25);
  for (let i = 0; i < 3; i++)
    box('stone', 2, 0.08 + i * 0.09, 8.5 - i * 0.38, 7.6, 0.16 + i * 0.18, 0.65);
  box('frame', 2, 1.95, 5.025, 4.7, 3, 0.12);
  box('wood', 2, 1.95, 5.11, 4.48, 2.83, 0.1);
  for (const x of [0.35, 1.45, 2.55, 3.65]) {
    box('wood', x, 1.95, 5.18, 0.94, 2.62, 0.08);
    for (const y of [1.12, 2.35]) {
      box('frame', x, y, 5.225, 0.69, 0.91, 0.025);
      box('wood', x, y, 5.25, 0.61, 0.82, 0.025);
    }
  }
  function windowFront(x: number, y: number, z: number, w: number, h: number) {
    box('white', x, y, z, w + 0.22, h + 0.22, 0.12);
    box('frame', x, y, z + 0.075, w, h, 0.1);
    box('glass', x, y, z + 0.135, w - 0.16, h - 0.16, 0.04);
  }
  windowFront(-5.05, 1.95, 7.03, 1.15, 2.05);
  const disc = new T.CircleGeometry(0.78, 24);
  disc.translate(-2.95, 2.1, 7.08);
  add('glass', disc);
  for (const [r, k, t] of [
    [0.85, 'white', 0.09],
    [0.78, 'frame', 0.045],
  ] as const) {
    const ring = new T.TorusGeometry(r, t, 4, 24);
    ring.translate(-2.95, 2.1, 7.11);
    add(k, ring);
  }
  // Vertical white ribs stay batched with the facade.
  for (let x = -5.75; x < -4.4; x += 0.11) box('white', x, 3.5, 7.06, 0.035, 1.0, 0.065);
  for (let x = -0.7; x < 3.8; x += 0.13) {
    const h = Math.max(0.1, 2.3 - Math.abs(x - 0.8) * 0.64);
    box('white', x, 4.35 + h / 2, 5.035, 0.035, h, 0.055);
  }

  // Continuous L-shaped veranda, observed in both side photographs.
  box('stone', 6.35, 0.34, -1.7, 2.7, 0.3, 15.7);
  box('white', 6.35, 3.65, -1.65, 2.7, 0.23, 15.8);
  box('wall', 6.35, 3.5, -1.65, 2.5, 0.12, 15.6);
  function sideWindow(z: number, y = 2, w = 0.9, h = 2.1) {
    box('white', 5.055, y, z, 0.12, h + 0.2, w + 0.2);
    box('frame', 5.13, y, z, 0.08, h, w);
    box('glass', 5.18, y, z, 0.025, h - 0.16, w - 0.16);
  }
  sideWindow(2.8);
  sideWindow(-3.8);
  box('frame', 5.08, 1.9, -6.5, 0.12, 2.85, 1.15);
  box('wood', 5.16, 1.9, -6.5, 0.07, 2.7, 1.02);
  // Open arched screen at the far end of the veranda, facing the garden.
  const archShape = new T.Shape();
  archShape.moveTo(-1.05, 0);
  archShape.lineTo(-1.05, 3.5);
  archShape.lineTo(1.05, 3.5);
  archShape.lineTo(1.05, 0);
  archShape.lineTo(0.82, 0);
  archShape.lineTo(0.82, 2.05);
  archShape.absarc(0, 2.05, 0.82, 0, Math.PI, false);
  archShape.lineTo(-0.82, 0);
  archShape.closePath();
  const ag = new T.ExtrudeGeometry(archShape, {
    depth: 0.22,
    bevelEnabled: false,
    curveSegments: 12,
  });
  ag.rotateY(Math.PI / 2);
  ag.translate(7.45, 0.45, -8.2);
  add('white', ag);
  for (let i = 0; i < 3; i++)
    box('stone', 7.85 + i * 0.3, 0.1 + (2 - i) * 0.09, -5.5, 0.5, 0.2 + (2 - i) * 0.18, 3.2);
  // Rear right gable: circular opening plus narrow rectangular window, facing +X.
  const circle = new T.CircleGeometry(0.67, 24);
  circle.rotateY(Math.PI / 2);
  circle.translate(8.255, 2, -11.1);
  add('glass', circle);
  for (const [r, k, t] of [
    [0.73, 'white', 0.075],
    [0.67, 'frame', 0.035],
  ] as const) {
    const g = new T.TorusGeometry(r, t, 4, 24);
    g.rotateY(Math.PI / 2);
    g.translate(8.28, 2, -11.1);
    add(k, g);
  }
  box('white', 8.25, 2, -13.2, 0.12, 1.95, 1.2);
  box('frame', 8.33, 2, -13.2, 0.08, 1.75, 1);
  box('glass', 8.38, 2, -13.2, 0.03, 1.6, 0.84);
  if (!lod) {
    // Small square reveal stack at the entrance edge, visible in the as-built side photo.
    for (const y of [0.95, 1.85, 2.75]) {
      box('paving', -1.92, y, 6.65, 0.06, 0.6, 0.55);
      box('white', -1.88, y, 6.65, 0.07, 0.46, 0.41);
    }
    // Restrained veranda table and chairs, without occupants.
    box('white', 6.65, 1.17, -1.0, 0.65, 0.12, 2.5);
    for (const z of [-2, 0.0]) box('white', 6.65, 0.8, z, 0.5, 0.7, 0.16);
    for (const z of [-1.75, -0.7]) {
      box('wood', 5.8, 0.87, z, 0.48, 0.1, 0.48);
      box('wood', 5.62, 1.2, z, 0.08, 0.6, 0.48);
      for (const x of [5.65, 6])
        for (const dz of [-0.16, 0.16]) box('wood', x, 0.62, z + dz, 0.055, 0.5, 0.055);
    }
  }
  if (site) {
    function ell(
      k: string,
      x: number,
      y: number,
      z: number,
      a: number,
      b: number,
      c: number,
      detail = 0
    ) {
      const g = new T.IcosahedronGeometry(1, detail);
      g.scale(a, b, c);
      g.translate(x, y, z);
      add(k, g);
    }
    // Only trees supported by the supplied photos: starfruit left and large side tree.
    for (const [x, z] of [[9, -1.5]] as const) {
      line(
        'wood',
        [
          [x, 0, z],
          [x - 0.2, 2, z],
          [x + 0.2, 4, z],
        ],
        0.19
      );
      for (let i = 0; i < 5; i++) {
        const t = i * 2.4;
        ell('leaf', x + Math.cos(t) * 1.1, 4.4 + i * 0.15, z + Math.sin(t), 1.15, 0.7, 1.1);
      }
    }
    for (const x of [-8, 10]) box('stone', x, 0.23, -5, 0.22, 0.46, 36);
    if (!lod)
      for (const [x, z] of [
        [-5, 8.6],
        [-2, 8.6],
        [7, 8],
      ] as const) {
        cyl('wood', x, 0.27, z, 0.28, 0.5);
        const g = new T.IcosahedronGeometry(0.42, 0);
        g.translate(x, 0.75, z);
        add('leaf', g);
      }
    // Front boundary: four framed iron panels between masonry posts.
    const gateZ = 15.1;
    for (const x of [-4.2, 2.2]) {
      box('stone', x, 1.35, gateZ, 0.48, 2.7, 0.55);
      box('paving', x, 2.73, gateZ, 0.65, 0.14, 0.72);
      for (let y = 0.25; y < 2.6; y += 0.24)
        box('paving', x, y, gateZ + 0.283, 0.46, 0.025, 0.025);
    }
    for (let i = 0; i < 4; i++) {
      const x = -3.95 + i * 1.475 + 0.7375;
      for (const dx of [-0.7375, 0.7375]) box('frame', x + dx, 1.35, gateZ, 0.075, 2.55, 0.1);
      for (const y of [0.08, 2.61]) box('frame', x, y, gateZ, 1.475, 0.08, 0.1);
      for (let dx = -0.6; dx < 0.7; dx += lod ? 0.48 : 0.24)
        box('frame', x + dx, 1.35, gateZ, 0.014, 2.43, 0.025);
      for (let y = 0.2; y < 2.6; y += lod ? 0.48 : 0.24)
        box('frame', x, y, gateZ, 1.4, 0.014, 0.025);
    }
    for (const x of [-1.12, -0.88]) box('frame', x, 1.25, gateZ + 0.08, 0.045, 0.27, 0.06);
    for (const [x, w] of [
      [-6.3, 3.7],
      [6.1, 7.3],
    ] as const) {
      box('stone', x, 0.55, gateZ, w, 1.1, 0.3);
      for (let y = 0.2; y < 1.1; y += 0.25) box('paving', x, y, gateZ + 0.16, w, 0.025, 0.02);
    }
    // Arched pergola and uneven bougainvillea foliage, layered pink/white blossoms.
    const arch: [number, number, number][] = Array.from({ length: 25 }, (_, i) => {
      const t = Math.PI - (i * Math.PI) / 24;
      return [-1 + 3.35 * Math.cos(t), 2.7 + 1.45 * Math.sin(t), gateZ];
    });
    for (const dz of [-0.35, 0.35]) {
      line(
        'frame',
        arch.map(([x, y, z]) => [x, y, z + dz] as [number, number, number]),
        0.045
      );
      for (const side of [-1, 1]) cyl('frame', -1 + side * 3.35, 1.35, gateZ + dz, 0.045, 2.7, 6);
    }
    arch
      .filter((_, i) => i % 3 === 0)
      .forEach(([x, y, z]) => beam('frame', [x, y, z - 0.35], [x, y, z + 0.35], 0.045, 0.045));
    for (let i = 0; i < 25; i += lod ? 3 : 1) {
      const [x, y, z] = arch[i];
      ell('leaf', x, y + 0.05, z, 0.47, 0.26 + 0.08 * Math.sin(i), 0.55);
      if (i % 2 === 0) {
        ell('flower', x + 0.13, y + 0.18, z + 0.34, 0.25, 0.16, 0.2, 0);
        ell(i % 4 === 0 ? 'flowerLight' : 'flower', x - 0.21, y + 0.11, z - 0.23, 0.2, 0.14, 0.19, 0);
      }
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 8; i++) {
        const x = -1 + side * 3.4,
          y = 0.35 + i * 0.33;
        ell('leaf', x, y, gateZ, 0.4, 0.33, 0.4);
        if (i % 2 === 0) ell('flower', x + side * 0.2, y + 0.1, gateZ + 0.25, 0.22, 0.22, 0.19, 0);
      }
    // Starfruit tree at the left front corner: forked trunk and spreading tiers.
    const tx = -7.15,
      tz = 7.6;
    box('paving', tx, 0.12, tz, 1.35, 0.24, 1.35);
    line(
      'wood',
      [
        [tx, 0.1, tz],
        [tx + 0.12, 1.15, tz],
        [tx + 0.5, 2.2, tz - 0.15],
        [tx + 0.45, 3.9, tz - 0.3],
      ],
      0.15
    );
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4,
        yy = 2.1 + i * 0.24,
        xx = tx + Math.cos(angle) * (1.15 + i * 0.12),
        zz = tz + Math.sin(angle) * (1.1 + i * 0.08);
      line(
        'wood',
        [
          [tx + 0.2, 1.3, tz],
          [tx + 0.25, yy - 0.6, tz],
          [xx, yy + 0.3, zz],
        ],
        0.065
      );
      ell('leaf', xx, yy + 0.6, zz, 1.0, 0.42, 0.85);
      ell('youngLeaf', xx + 0.3, yy + 0.9, zz - 0.2, 0.72, 0.22, 0.6);
    }
    ell('leaf', tx + 0.3, 4.25, tz, 1.25, 0.55, 1);
    ell('youngLeaf', tx + 0.1, 4.65, tz, 0.7, 0.28, 0.65);
    // Resting Golden retriever beside steps: elongated body, folded hind legs, front paws and feathered tail.
    const dx = 3.6,
      dz = 9.5;
    ell('fur', dx, 0.38, dz, 0.78, 0.34, 0.37);
    ell('furLight', dx + 0.5, 0.48, dz, 0.37, 0.36, 0.34);
    ell('fur', dx - 0.58, 0.25, dz + 0.18, 0.32, 0.24, 0.31);
    ell('furLight', dx - 0.7, 0.13, dz + 0.38, 0.3, 0.11, 0.13);
    for (const z of [dz - 0.19, dz + 0.24]) {
      ell('fur', dx + 0.78, 0.16, z, 0.48, 0.12, 0.13);
      ell('furLight', dx + 1.12, 0.12, z, 0.2, 0.1, 0.14);
    }
    ell('fur', dx + 0.78, 0.76, dz, 0.3, 0.3, 0.27);
    ell('furLight', dx + 0.99, 0.65, dz + 0.1, 0.23, 0.15, 0.2);
    ell('nose', dx + 1.16, 0.68, dz + 0.14, 0.07, 0.055, 0.085);
    for (const z of [dz - 0.25, dz + 0.25]) ell('fur', dx + 0.64, 0.62, z, 0.15, 0.28, 0.1);
    ell('nose', dx + 0.94, 0.84, dz + 0.21, 0.028, 0.03, 0.025);
    ell('nose', dx + 1, 0.84, dz - 0.12, 0.028, 0.03, 0.025);
    line(
      'furLight',
      [
        [dx - 0.65, 0.22, dz],
        [dx - 1, 0.13, dz + 0.12],
        [dx - 1.2, 0.12, dz + 0.4],
        [dx - 1.4, 0.1, dz + 0.45],
      ],
      0.14
    );
    for (let i = 0; i < 5; i++)
      ell('furLight', dx - 1.05 - i * 0.07, 0.12, dz + 0.28 + i * 0.05, 0.22, 0.07, 0.13, 0);
  }
  const renderMaterials: Record<string, T.MeshStandardMaterial> = {
    solid: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    roof: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    metal: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
    glass: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }),
    landscape: new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }),
  };
  for (const [k, gs] of batches) {
    const g = mergeGeometries(gs, false);
    gs.forEach((v) => v.dispose());
    owned.push(g);
    const m = new T.Mesh(g, renderMaterials[k]);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  Object.values(mats).forEach((v) => v.dispose());
  root.userData = {
    referenceLocation: REFERENCE_LOCATION,
    lod,
    frontAxis: '+Z',
    units: 'estimated metres',
    stats: {
      meshes: root.children.length,
      triangles: root.children.reduce(
        (n, m) => n + (m as T.Mesh).geometry.attributes.position.count / 3,
        0
      ),
    },
  };
  root.dispose = () => {
    owned.forEach((v) => v.dispose());
    Object.values(renderMaterials).forEach((v) => v.dispose());
    root.removeFromParent();
  };
  return root;
}

/** Caller projects its current Place coordinates; no geographic fallback is used. */
export function mountMinhHuong({
  scene,
  placePosition,
  offset = { x: 0, y: 0, z: 0 },
  rotation = 0,
  scale = 1,
  lod = 0,
}: {
  scene: T.Object3D;
  placePosition: { x: number; y?: number; z: number };
  offset?: { x?: number; y?: number; z?: number };
  rotation?: number;
  scale?: number;
  lod?: 0 | 1 | number;
}) {
  const anchor = new T.Group();
  const model = createMinhHuongHouse({ lod });
  anchor.add(model);
  scene.add(anchor);
  function update({
    placePosition: p,
    offset: o = offset,
    rotation: r = rotation,
    scale: s = scale,
  }: {
    placePosition: { x: number; y?: number; z: number };
    offset?: { x?: number; y?: number; z?: number };
    rotation?: number;
    scale?: number;
  }) {
    if (!p || ![p.x, p.y ?? 0, p.z].every(Number.isFinite))
      throw Error('Projected Place position is required');
    anchor.position.set(p.x, p.y ?? 0, p.z);
    model.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    model.rotation.y = r;
    model.scale.setScalar(s);
  }
  update({ placePosition, offset, rotation, scale });
  return {
    anchor,
    model,
    update,
    dispose() {
      model.dispose();
      anchor.removeFromParent();
    },
  };
}
