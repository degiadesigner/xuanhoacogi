/**
 * Vật liệu "chân thực" cho Bản đồ 3D Xuân Hòa — toàn bộ chi tiết sinh bằng shader (0 KB texture tải về):
 *  - Nhà: cửa sổ kính theo tầng (3,4 m) phản chiếu bầu trời, tầng trệt mặt tiền cửa hàng, gờ sàn, AO chân tường
 *  - Mặt đất / cỏ / đường: vân nhiễu tự nhiên; mặt nước: Fresnel + phản chiếu trời + lóa nắng
 *  - Tán cây: tối dần về phía dưới (AO giả), biến thiên màu
 *  - Vòm trời gradient + mù chân trời
 */
import * as THREE from 'three';

export const SKY = {
  zenith: '#3F7FC4',
  mid: '#8DB6DE',
  horizon: '#DCE4E6',
  ground: '#C9C8BD',
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
  const c = new THREE.Color(hex); // đã chuyển sang không gian tuyến tính (ColorManagement bật)
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

function commonPatch(shader: THREE.WebGLProgramParametersWithUniforms, linearize: boolean) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <project_vertex>', WPOS_VERT);
  if (linearize) shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', LINEARIZE_VCOLOR);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE);
}

/* ------------------------------------------------------------------ NHÀ */
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
  vec3 V = normalize(cameraPosition - vWPos);
  if (wall > 0.01) {
    vec2 tg = normalize(vec2(-wN.z, wN.x));
    float u = dot(vWPos.xz, tg);
    float y = vWPos.y;
    float FL = 3.4, BAY = 2.9;
    float fy = fract(y / FL), fi = floor(y / FL);
    float uu = u / BAY, fu = fract(uu), bi = floor(uu);
    vec2 fw = clamp(fwidth(vec2(uu, y / FL)), vec2(0.002), vec2(0.8));
    float aa = max(fw.x, fw.y);
    float detail = 1.0 - smoothstep(0.18, 0.55, aa);
    float rnd = h21(vec2(bi, fi) + round(wN.xz * 8.0));
    // kính cửa sổ: phản chiếu trời theo Fresnel, mỗi ô một sắc độ
    float fres = pow(1.0 - clamp(dot(V, wN), 0.0, 1.0), 3.0);
    vec3 skyR = mix(${hexVec3('#2B3A48')}, ${hexVec3('#9DB9D3')}, clamp(0.25 + fres * 0.9 + rnd * 0.25, 0.0, 1.0));
    vec3 glass = skyR * (0.75 + rnd * 0.35);
    float hasWin = step(0.12, rnd); // vài ô tường đặc
    float win = bandAA(fu, 0.2, 0.8, fw.x) * bandAA(fy, 0.3, 0.84, fw.y) * hasWin;
    // tầng trệt: mặt tiền cửa hàng (cửa cuốn / kính tối)
    float ground = 1.0 - step(1.0, fi);
    float shop = bandAA(fu, 0.06, 0.94, fw.x) * bandAA(fy, 0.04, 0.78, fw.y);
    vec3 shopC = mix(${hexVec3('#3A3530')}, ${hexVec3('#8E9298')}, step(0.55, rnd));
    // gờ sàn + bậu cửa
    float slab = 1.0 - bandAA(fy, 0.0, 0.06, fw.y) * 0.18;
    float sill = 1.0 - bandAA(fy, 0.26, 0.3, fw.y) * 0.12 * step(0.5, fi);
    vec3 c = base * slab * sill;
    c = mix(c, glass, win * (1.0 - ground) * 0.9);
    c = mix(c, shopC, shop * ground * 0.85);
    // xa: trung bình hoá (tránh nhiễu răng cưa)
    vec3 far = base * mix(0.86, 0.8, ground);
    c = mix(far, c, detail);
    // AO chân tường + mờ dần lên cao
    float ao = mix(0.58, 1.0, smoothstep(0.0, 5.0, y));
    // bụi bẩn / phong hoá nhẹ
    float grime = 0.95 + 0.06 * fbm(vec2(u * 0.28, y * 0.45));
    diffuseColor.rgb = mix(base, c * ao * grime, wall);
  } else {
    // mái: vân ngói/tôn + loang màu
    float n = fbm(vWPos.xz * 0.45);
    float rib = 0.97 + 0.03 * sin(dot(vWPos.xz, vec2(0.0, 1.0)) * 6.2832 / 0.9);
    diffuseColor.rgb = base * (0.9 + 0.16 * n) * mix(1.0, rib, smoothstep(0.92, 0.6, wN.y));
  }
}
`
      );
  };
  mat.customProgramCacheKey = () => 'xh-building-v3';
  mat.needsUpdate = true;
  void sd;
}

/* ------------------------------------------------------------------ LỚP PHẲNG */
export type FlatKind = 'ground' | 'landuse' | 'water' | 'roads' | 'markings';

export function patchFlatMaterial(mat: THREE.MeshLambertMaterial, kind: FlatKind, sunDir: THREE.Vector3) {
  const sd = sunDir.clone().normalize();
  const body: Record<FlatKind, string> = {
    ground: glsl`
      float n = fbm(vWPos.xz * 0.035), m = fbm(vWPos.xz * 0.6);
      vec3 dirt = ${hexVec3('#B7AD92')}, green = ${hexVec3('#9AA77A')};
      diffuseColor.rgb *= mix(green, dirt, smoothstep(0.35, 0.7, n)) / ${hexVec3('#B5B39A')};
      diffuseColor.rgb *= 0.9 + 0.16 * m;`,
    landuse: glsl`
      float n = fbm(vWPos.xz * 0.08), m = fbm(vWPos.xz * 1.3);
      diffuseColor.rgb *= (0.84 + 0.22 * n) * (0.92 + 0.12 * m);`,
    roads: glsl`
      float m = vnoise(vWPos.xz * 2.7), n = fbm(vWPos.xz * 0.12);
      diffuseColor.rgb *= (0.9 + 0.12 * m) * (0.93 + 0.1 * n);`,
    markings: glsl`diffuseColor.rgb *= 0.92 + 0.1 * vnoise(vWPos.xz * 3.0);`,
    water: glsl`
      vec3 V = normalize(cameraPosition - vWPos);
      vec2 rip = vec2(fbm(vWPos.xz * 0.09), fbm(vWPos.xz * 0.09 + 7.3)) - 0.5;
      vec3 N = normalize(vec3(rip.x * 0.18, 1.0, rip.y * 0.18));
      float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 5.0);
      vec3 deep = ${hexVec3('#1F4F63')}, shallow = ${hexVec3('#3F7F8C')};
      vec3 skyC = mix(${hexVec3(SKY.horizon)}, ${hexVec3(SKY.zenith)}, clamp(reflect(-V, N).y * 1.6, 0.0, 1.0));
      vec3 c = mix(mix(deep, shallow, 0.4 + 0.3 * fbm(vWPos.xz * 0.02)), skyC, clamp(fres, 0.0, 0.85));
      float spec = pow(max(dot(reflect(-V, N), vec3(${sd.x.toFixed(3)}, ${sd.y.toFixed(3)}, ${sd.z.toFixed(3)})), 0.0), 220.0);
      diffuseColor.rgb = c;
      totalEmissiveRadiance += vec3(1.0, 0.94, 0.82) * spec * 2.2;`,
  };
  mat.onBeforeCompile = (shader) => {
    commonPatch(shader, true);
    const hook = kind === 'water' ? '#include <emissivemap_fragment>' : '#include <color_fragment>';
    shader.fragmentShader = shader.fragmentShader.replace(hook, `${hook}\n{\n${body[kind]}\n}`);
  };
  mat.customProgramCacheKey = () => 'xh-flat-' + kind;
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------------ TÁN CÂY */
export function patchCrownMaterial(mat: THREE.MeshLambertMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vH;\nvarying float vSeed;')
      .replace(
        '#include <project_vertex>',
        glsl`#include <project_vertex>
        vH = clamp((position.y - 1.6) / 5.0, 0.0, 1.0);
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
        diffuseColor.rgb *= mix(0.52, 1.12, smoothstep(0.0, 1.0, vH)) * (0.88 + vSeed * 0.24);`
      );
  };
  mat.customProgramCacheKey = () => 'xh-crown-v2';
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------------ VÒM TRỜI */
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
        vec3 c = mix(cHor, cMid, smoothstep(0.0, 0.035, t));
        c = mix(c, cZen, smoothstep(0.025, 0.16, t));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.88, 0.65) * (pow(s, 6.0) * 0.22 + pow(s, 320.0) * 1.4);
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
