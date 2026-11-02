/**
 * Vật liệu Giai đoạn 2 ("REAL XUÂN HÒA + CUTE PREMIUM PASTEL + DIGITAL CITY")
 * Toàn bộ chi tiết sinh bằng shader nhẹ (0 KB texture tải về):
 *  - Nhà (3 tầng LOD theo khoảng cách camera):
 *      + LOD FAR (> 1350m): khối sạch + màu mái + màu tường pastel, không nhiễu cửa sổ
 *      + LOD MID (450m - 1350m): gờ tầng ngang + chân đế tầng 1 + nhịp cửa sổ đơn giản
 *      + LOD NEAR (< 450m): cửa sổ kính phản chiếu bầu trời dịu, rèm sáng, mặt tiền tầng 1, gờ cornice, AO mềm
 *  - Mặt đất / landuse: giữ chuẩn bảng màu pastel Xuân Hòa + chuyển sắc nhẹ theo độ cao địa hình
 *  - Mặt nước: chuyển sắc #7CC8E6 -> #4FA3C7 + Fresnel dịu nhẹ, nhìn rõ từ xa
 *  - Tán cây: đổ bóng mềm mịn kiểu Cute Premium Pastel
 */
import * as THREE from 'three';

export const SKY = {
  zenith: '#78B4E2',
  mid: '#BCE0F5',
  horizon: '#F6F2EA',
  ground: '#F3EFE6',
};

const glsl = String.raw;

/** sRGB (byte) -> linear cho màu đỉnh: renderer làm việc tuyến tính + tone mapping */
const LINEARIZE_VCOLOR = glsl`
#include <color_vertex>
#ifdef USE_COLOR
  vColor.rgb = pow(max(vColor.rgb, vec3(0.0)), vec3(2.2));
#endif
`;

const WPOS_VERT = glsl`
#include <project_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const NOISE = glsl`
varying vec3 vWPos;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
float bandAA(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x); }
`;

function hexVec3(hex: string) {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

function commonPatch(shader: THREE.WebGLProgramParametersWithUniforms, linearize: boolean) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <project_vertex>', WPOS_VERT);
  if (linearize) shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', LINEARIZE_VCOLOR);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE);
}

/* ------------------------------------------------------------------ NHÀ (3-TIER LOD + PASTEL FAÇADE) */
export function patchBuildingMaterial(mat: THREE.MeshLambertMaterial, sunDir: THREE.Vector3) {
  const sd = sunDir.clone().normalize();
  mat.onBeforeCompile = (shader) => {
    commonPatch(shader, true);
    shader.vertexShader = shader.vertexShader
      .replace('varying vec3 vWPos;', 'varying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace(
        'vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        'vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * normal);'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('varying vec3 vWPos;', 'varying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace(
        '#include <color_fragment>',
        glsl`
#include <color_fragment>
{
  vec3 wN = normalize(vWNormal);
  float wall = 1.0 - smoothstep(0.22, 0.42, abs(wN.y));
  vec3 base = diffuseColor.rgb;
  vec3 toCam = cameraPosition - vWPos;
  float camDist = length(toCam);
  vec3 V = toCam / max(camDist, 0.001);

  // Hệ thống 3 mức LOD theo khoảng cách camera (Section M):
  // - LOD FAR (> 1350m): chỉ khối sạch + màu mái + màu tường pastel
  // - LOD MID (450m .. 1350m): thêm gờ tầng + chân đế + nhịp cửa sổ dịu
  // - LOD NEAR (< 450m): đầy đủ cửa sổ kính, mặt tiền tầng 1, gờ sàn & ban công
  float lodMid = 1.0 - smoothstep(950.0, 1420.0, camDist);
  float lodNear = 1.0 - smoothstep(320.0, 560.0, camDist);

  if (wall > 0.01) {
    float y = vWPos.y;
    float FL = 3.45;
    float fy = fract(y / FL), fi = floor(y / FL);
    float ground = 1.0 - step(1.0, fi);

    // Màu cơ sở ở LOD FAR: khối pastel sạch, tầng 1 hơi ấm/đậm nhẹ tạo chân đế vững
    vec3 farCol = base * mix(0.99, 0.94, ground);

    if (lodMid > 0.005) {
      vec2 tg = normalize(vec2(-wN.z, wN.x));
      float u = dot(vWPos.xz, tg);
      float BAY = 2.85;
      float uu = u / BAY, fu = fract(uu), bi = floor(uu);
      vec2 fw = clamp(fwidth(vec2(uu, y / FL)), vec2(0.002), vec2(0.65));
      float aa = max(fw.x, fw.y);
      float detailAA = (1.0 - smoothstep(0.16, 0.48, aa)) * lodMid;
      float rnd = h21(vec2(bi, fi) + round(wN.xz * 8.0));

      // Kính cửa sổ pastel dịu: phản chiếu bầu trời xanh sáng + một số ô có rèm kem ấm
      float fres = pow(1.0 - clamp(dot(V, wN), 0.0, 1.0), 2.6);
      vec3 skyGlass = mix(${hexVec3('#4E6E86')}, ${hexVec3('#B8D8EE')}, clamp(0.32 + fres * 0.78 + rnd * 0.22, 0.0, 1.0));
      vec3 warmCurtain = ${hexVec3('#F2E9D8')};
      vec3 glass = mix(skyGlass, warmCurtain, step(0.76, rnd) * 0.48 * lodNear);

      float hasWin = step(0.10, rnd);
      float win = bandAA(fu, 0.22, 0.78, fw.x) * bandAA(fy, 0.30, 0.80, fw.y) * hasWin;
      // Khuôn cửa sổ mảnh màu kem sáng ở LOD NEAR
      float winFrame = (bandAA(fu, 0.19, 0.81, fw.x) * bandAA(fy, 0.27, 0.83, fw.y) - win) * hasWin * lodNear;

      // Tầng trệt (ground floor): mặt tiền cửa hàng / sảnh kính hiện đại
      float shop = bandAA(fu, 0.08, 0.92, fw.x) * bandAA(fy, 0.05, 0.76, fw.y);
      vec3 shopC = mix(${hexVec3('#58626E')}, ${hexVec3('#9EB6C8')}, step(0.48, rnd));
      float awningBand = bandAA(fy, 0.76, 0.88, fw.y) * step(0.35, rnd) * lodNear;
      vec3 awningCol = mix(base * 0.86, ${hexVec3('#D97B66')}, step(0.62, rnd) * 0.55);

      // Gờ sàn ngang (cornice) & bậu cửa sổ nhẹ
      float slab = 1.0 - bandAA(fy, 0.0, 0.055, fw.y) * 0.11;
      float sill = 1.0 - bandAA(fy, 0.25, 0.29, fw.y) * 0.08 * step(0.5, fi) * lodNear;

      vec3 c = base * slab * sill;
      c = mix(c, base * 1.06, clamp(winFrame, 0.0, 1.0) * 0.65);
      c = mix(c, glass, win * (1.0 - ground) * (0.55 + 0.30 * lodNear));
      c = mix(c, shopC, shop * ground * (0.45 + 0.32 * lodNear));
      c = mix(c, awningCol, awningBand * ground * 0.72);

      farCol = mix(farCol, c, detailAA);
    }

    // AO chân tường mềm mại kiểu Pastel Digital City (không làm đen chân nhà)
    float ao = mix(0.82, 1.0, smoothstep(0.0, 4.2, y));
    diffuseColor.rgb = mix(base, farCol * ao, wall);
  } else {
    // Mái nhà: giữ sắc độ pastel ấm + gờ ngói nhẹ khi nhìn gần
    float camFade = 1.0 - smoothstep(400.0, 1200.0, camDist);
    float n = fbm(vWPos.xz * 0.35);
    float rib = 0.985 + 0.022 * sin(dot(vWPos.xz, vec2(0.7, 0.7)) * 6.2832 / 0.85) * camFade;
    diffuseColor.rgb = base * (0.95 + 0.08 * n) * mix(1.0, rib, smoothstep(0.95, 0.55, wN.y));
  }
}
`
      );
  };
  mat.customProgramCacheKey = () => 'xh-building-stage2-v1';
  mat.needsUpdate = true;
  void sd;
}

/* ------------------------------------------------------------------ LỚP PHẲNG (TERRAIN / LANDUSE / WATER / ROADS) */
export type FlatKind = 'ground' | 'landuse' | 'water' | 'roads' | 'markings';

export function patchFlatMaterial(mat: THREE.MeshLambertMaterial, kind: FlatKind, sunDir: THREE.Vector3) {
  const sd = sunDir.clone().normalize();
  const body: Record<FlatKind, string> = {
    ground: glsl`
      float n = fbm(vWPos.xz * 0.025), m = fbm(vWPos.xz * 0.45);
      // Chuyển sắc nhẹ theo độ cao địa hình: nền đô thị kem ấm (#F3EFE6) -> sườn đồi xanh sage dịu (#D7E5CA)
      float elevT = smoothstep(2.5, 24.0, vWPos.y);
      vec3 urbanCream = ${hexVec3('#F3EFE6')};
      vec3 hillSage = ${hexVec3('#D6E5C8')};
      vec3 targetBase = mix(urbanCream, hillSage, elevT * 0.65);
      diffuseColor.rgb = mix(diffuseColor.rgb, targetBase, 0.55);
      diffuseColor.rgb *= (0.96 + 0.06 * n) * (0.97 + 0.05 * m);`,
    landuse: glsl`
      float n = fbm(vWPos.xz * 0.06), m = fbm(vWPos.xz * 0.9);
      float elevShade = 0.97 + 0.05 * smoothstep(0.0, 30.0, vWPos.y);
      diffuseColor.rgb *= (0.94 + 0.10 * n) * (0.96 + 0.06 * m) * elevShade;`,
    roads: glsl`
      float m = vnoise(vWPos.xz * 2.2), n = fbm(vWPos.xz * 0.10);
      diffuseColor.rgb *= (0.95 + 0.06 * m) * (0.96 + 0.05 * n);`,
    markings: glsl`diffuseColor.rgb *= 0.96 + 0.05 * vnoise(vWPos.xz * 2.5);`,
    water: glsl`
      vec3 V = normalize(cameraPosition - vWPos);
      vec2 rip = vec2(fbm(vWPos.xz * 0.075), fbm(vWPos.xz * 0.075 + 7.3)) - 0.5;
      vec3 N = normalize(vec3(rip.x * 0.12, 1.0, rip.y * 0.12));
      float fres = 0.06 + 0.65 * pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 4.0);
      // Bảng màu nước Giai đoạn 2: #7CC8E6 (nông/ven bờ) -> #4FA3C7 (sâu)
      vec3 shallow = ${hexVec3('#7CC8E6')};
      vec3 deep = ${hexVec3('#4FA3C7')};
      vec3 skyC = mix(${hexVec3(SKY.horizon)}, ${hexVec3(SKY.mid)}, clamp(reflect(-V, N).y * 1.4, 0.0, 1.0));
      float waveMix = 0.38 + 0.36 * fbm(vWPos.xz * 0.018);
      vec3 waterBase = mix(deep, shallow, waveMix);
      vec3 c = mix(waterBase, skyC, clamp(fres * 0.55, 0.0, 0.52));
      float spec = pow(max(dot(reflect(-V, N), vec3(${sd.x.toFixed(3)}, ${sd.y.toFixed(3)}, ${sd.z.toFixed(3)})), 0.0), 180.0);
      diffuseColor.rgb = c;
      totalEmissiveRadiance += vec3(1.0, 0.97, 0.90) * spec * 1.25;`,
  };
  mat.onBeforeCompile = (shader) => {
    commonPatch(shader, true);
    const hook = kind === 'water' ? '#include <emissivemap_fragment>' : '#include <color_fragment>';
    shader.fragmentShader = shader.fragmentShader.replace(hook, `${hook}\n{\n${body[kind]}\n}`);
  };
  mat.customProgramCacheKey = () => 'xh-flat-stage2-' + kind;
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------------ TÁN CÂY (PASTEL CROWN AO) */
export function patchCrownMaterial(mat: THREE.MeshLambertMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vH;\nvarying float vSeed;')
      .replace(
        '#include <project_vertex>',
        glsl`#include <project_vertex>
        vH = clamp((position.y - 1.4) / 5.2, 0.0, 1.0);
        #ifdef USE_INSTANCING
          vSeed = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.291);
        #else
          vSeed = 0.5;
        #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;\nvarying float vSeed;')
      .replace(
        '#include <color_fragment>',
        glsl`#include <color_fragment>
        diffuseColor.rgb *= mix(0.68, 1.10, smoothstep(0.0, 1.0, vH)) * (0.92 + vSeed * 0.16);`
      );
  };
  mat.customProgramCacheKey = () => 'xh-crown-stage2-v1';
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------------ VÒM TRỜI (DAYLIGHT PASTEL SKY DOME) */
export function createSkyDome(sunDir = new THREE.Vector3(-0.68, 0.85, -0.32).normalize()) {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      cZen: { value: new THREE.Color(SKY.zenith) },
      cMid: { value: new THREE.Color(SKY.mid) },
      cHor: { value: new THREE.Color(SKY.horizon) },
      sunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: glsl`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: glsl`
      uniform vec3 cZen, cMid, cHor, sunDir;
      varying vec3 vDir;
      void main() {
        float y = clamp(vDir.y, -1.0, 1.0);
        float t = clamp(y, 0.0, 1.0);
        vec3 c = mix(cHor, cMid, smoothstep(0.0, 0.045, t));
        c = mix(c, cZen, smoothstep(0.035, 0.22, t));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.94, 0.80) * (pow(s, 7.0) * 0.16 + pow(s, 320.0) * 1.1);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = true;
  return mesh;
}
