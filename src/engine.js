/**
 * engine.js v1.4 (단일 파일 통합 빌드)
 * 한국식 4구·3쿠션 물리 엔진.
 *
 * 통합된 모듈 (의존성 순서):
 *   1. constants     - 운동 상태, 기본 파라미터
 *   2. math/vec3     - 3D 벡터 연산, surface velocity, tip geometry
 *   3. math/roots    - 4차/2차 방정식 (Algorithm 1010)
 *   4. physics/evolve         - 궤적 진화
 *   5. physics/ball-cushion   - Han 2005
 *   6. physics/ball-ball      - Mathavan + Alciatore
 *   7. physics/stick-ball     - 큐 타격 + Squirt + Tip Geometry
 *   8. objects       - Ball, Table, System
 *   9. simulation/event-detect
 *  10. simulation/event-loop
 *
 * 검증: verify.js (engine.js의 export 사용)
 *
 * v1.4 변경:
 *   - 단일 파일로 통합
 *   - 즉시 cushion contact 처리 (옵션 — useImmediateCushion: true 시 활성화)
 *   - Alciatore 마찰 + Squirt + Tip Geometry (Pooltool 0.6.0 기준)
 */

// Math 함수 통합 디스트럭처링 (각 모듈 중복 제거)
const { abs, sqrt, pow, cos, sin, acos, asin, atan, atan2, PI, sign, min, max, hypot, exp } = Math;

// ════════════════════════════════════════════════════════════════
// constants.js
// ════════════════════════════════════════════════════════════════

/**
 * constants.js v1.1
 * 운동 상태, 물리 상수, 기본 파라미터.
 * 출처: pooltool/constants.py + pooltool/objects/ball/params.py + pooltool/objects/cue/datatypes.py (Pooltool 0.6.0)
 *
 * v1.1 변경:
 *   - DEFAULT_CUE_SPECS 추가 (PR #182 Tip Geometry + Squirt 지원)
 */

// 운동 상태
export const STATIONARY = 0;
export const SPINNING   = 1;
export const SLIDING    = 2;
export const ROLLING    = 3;
export const POCKETED   = 4;

export const EPS = Number.EPSILON * 100;
export const MIN_DIST = 1e-6;

// 기본 공 파라미터 (SI 단위)
// 출처: BallParams defaults in pooltool/objects/ball/params.py
// 변경 내역:
//   u_r 0.01 → 0.012  (한국 평균 펠트 — 한국 당구장 환경)
//   e_b 0.95 → 0.93   (한국 페놀릭 공 — 한국 당구공 표준)
//   f_c 0.20 → 0.14   (쿠션 english 효과 + 반사 후 커브 최적화)
// 별도 stick-ball.js의 a 부호 뒤집기는 한·외 공통 표준 클럭 직관 매핑.
export const DEFAULT_BALL_PARAMS = Object.freeze({
  m:   0.170097,                  // 질량 (kg)
  R:   0.028575,                  // 반지름 (m)
  u_s: 0.21,                     // 슬라이딩 마찰계수 (한국 평균)
  u_r: 0.012,                    // 롤링 마찰계수 (한국 평균 펠트)
  u_sp_proportionality: 10*2/5/9, // 스피닝 마찰 비례상수
  u_b: 0.05,                     // 공-공 마찰계수 (legacy 'average' 모드용; Alciatore 사용 시 무관)
  e_b: 0.93,                     // 공-공 반발계수 (한국 페놀릭 공)
  e_c: 0.85,                     // 공-쿠션 반발계수 (Pooltool 기본 유지)
  f_c: 0.14,                     // 공-쿠션 마찰계수 (0.10→0.14: 반사 후 커브 268°→2°, english Δ 유지)
  g:   9.81,                     // 중력가속도 (m/s²)
});

/**
 * u_sp = u_sp_proportionality * R
 */
export function getSpinFriction(params) {
  return params.u_sp_proportionality * params.R;
}

// 기본 큐 파라미터 (SI 단위)
// 출처: pooltool/objects/cue/datatypes.py CueSpecs (Pooltool 0.6.0)
export const DEFAULT_CUE_SPECS = Object.freeze({
  M:          0.567,                  // 큐 질량 (kg)
  length:     1.4732,                 // 큐 길이 (m)
  tip_radius: 0.0106045,              // 큐 팁 반지름 (m, 니켈 동전 기준)
  end_mass:   0.170097 / 30,          // 큐 말단 효과 질량 (≈ 0.00567 kg)
                                      //   - squirt deflection 계산용
                                      //   - 낮을수록 deflection 적음 (low-deflection 큐)
                                      //   - Predator 등 LD 큐: ≈ 0.003 ~ 0.005
});

// Alciatore ball-ball 마찰 fit 계수 (Pooltool 0.6.0 기본)
// u_b(v_rel) = a + b · exp(-c · v_rel)
export const ALCIATORE_FRICTION_COEFFS = Object.freeze({
  a: 0.009951,
  b: 0.108,
  c: 1.088,
});

// 3쿠션 표준 (UMB, 대대 2840×1420, 공 직경 61.4mm)
export const SPEC_THREE_CUSHION = Object.freeze({
  name: "3쿠션 (대대)",
  table_length: 2.84,
  table_width:  1.42,
  ball_R: 0.0307,
  ball_m: 0.210,
});

// 한국식 4구 (KBF, 중대 2540×1270, 공 직경 65.5mm)
export const SPEC_FOUR_BALL = Object.freeze({
  name: "한국식 4구 (중대)",
  table_length: 2.54,
  table_width:  1.27,
  ball_R: 0.03275,
  ball_m: 0.210,
});

// ════════════════════════════════════════════════════════════════
// math/vec3.js
// ════════════════════════════════════════════════════════════════

/**
 * vec3.js v1.1
 * 3D 벡터 연산 (Float64Array 기반, 순수 함수).
 * 출처: pooltool/ptmath/utils.py (Pooltool 0.6.0)
 *
 * v1.1 변경:
 *   - tangentSurfaceVelocity 추가 (Alciatore 마찰 모델용)
 *   - tipContactOffset / tipCenterOffset 추가 (PR #182 Cue Tip Geometry)
 *
 * rvw 표기법: Float64Array(9) = [r0,r1,r2, v0,v1,v2, w0,w1,w2]
 * 또는 개념적으로 3×3 행렬: row0=position, row1=velocity, row2=angular velocity
 * 인덱싱: rvw[row*3 + col]
 */


// ── 기본 벡터 연산 ──

export function norm3d(v, offset = 0) {
  const x = v[offset], y = v[offset+1], z = v[offset+2];
  return sqrt(x*x + y*y + z*z);
}

export function norm2d(v, offset = 0) {
  const x = v[offset], y = v[offset+1];
  return sqrt(x*x + y*y);
}

export function dot3d(a, ao, b, bo) {
  return a[ao]*b[bo] + a[ao+1]*b[bo+1] + a[ao+2]*b[bo+2];
}

export function cross3d(out, oo, u, uo, v, vo) {
  out[oo]   = u[uo+1]*v[vo+2] - u[uo+2]*v[vo+1];
  out[oo+1] = u[uo+2]*v[vo]   - u[uo]*v[vo+2];
  out[oo+2] = u[uo]*v[vo+1]   - u[uo+1]*v[vo];
}

/**
 * 단위 벡터. n=0이면 원본 반환 (handleZero=true 시).
 */
export function unitVector(out, oo, v, vo, handleZero = false) {
  const n = norm3d(v, vo);
  const d = (n === 0 && handleZero) ? 1.0 : n;
  out[oo]   = v[vo]   / d;
  out[oo+1] = v[vo+1] / d;
  out[oo+2] = v[vo+2] / d;
}

/**
 * xy 평면 위 방향각 (rad). atan2(y,x), 결과 [0, 2π).
 * 출처: ptmath.angle()
 */
export function angle2d(v, offset = 0) {
  const a = atan2(v[offset+1], v[offset]);
  return a < 0 ? 2*PI + a : a;
}

// ── 좌표 회전 (z축) ──

/**
 * 3D 벡터를 z축 기준 phi(rad)만큼 회전.
 * 출처: ptmath.coordinate_rotation()
 *
 * | cos -sin 0 |
 * | sin  cos 0 | × v
 * |  0    0  1 |
 */
export function coordRotate(out, oo, v, vo, phi) {
  const c = cos(phi), s = sin(phi);
  const x = v[vo], y = v[vo+1], z = v[vo+2];
  out[oo]   = c*x - s*y;
  out[oo+1] = s*x + c*y;
  out[oo+2] = z;
}

/**
 * 3×3 행렬(row-major, 9 floats)을 z축 기준 회전.
 * 각 row(r, v, w)에 대해 coordRotate 적용.
 */
export function coordRotateRvw(out, v, phi) {
  coordRotate(out, 0, v, 0, phi);
  coordRotate(out, 3, v, 3, phi);
  coordRotate(out, 6, v, 6, phi);
}

// ── 공-천 상대 속도 ──

/**
 * 공 표면 접촉점(d 방향)에서의 속도.
 * surface_velocity = v + ω × (R·d)
 */
export function surfaceVelocity(out, oo, rvw, R, d, dOffset) {
  // ω × (R·d)
  const wx = rvw[6], wy = rvw[7], wz = rvw[8];
  const rdx = R*d[dOffset], rdy = R*d[dOffset+1], rdz = R*d[dOffset+2];
  out[oo]   = rvw[3] + (wy*rdz - wz*rdy);
  out[oo+1] = rvw[4] + (wz*rdx - wx*rdz);
  out[oo+2] = rvw[5] + (wx*rdy - wy*rdx);
}

/**
 * 공 표면 접점에서 d 방향 성분 제외한 접선 속도.
 * 출처: ptmath.tangent_surface_velocity (Pooltool 0.6.0)
 *   v_t = v - (v·d)·d
 *   return v_t + ω × (R·d)
 *
 * Alciatore 마찰 모델에서 ball-ball 접촉면 상대속도 계산에 사용.
 *
 * @param {Float64Array} out 출력 3-vector
 * @param {number} oo out 오프셋
 * @param {Float64Array} rvw 9-element 공 상태
 * @param {Float64Array|number[]} d 단위 법선 (3-vector)
 * @param {number} dOffset d 오프셋
 * @param {number} R 공 반지름
 */
export function tangentSurfaceVelocity(out, oo, rvw, d, dOffset, R) {
  const vx = rvw[3], vy = rvw[4], vz = rvw[5];
  const dx = d[dOffset], dy = d[dOffset+1], dz = d[dOffset+2];
  const vDotD = vx*dx + vy*dy + vz*dz;
  // v_t = v - (v·d)·d
  const vtx = vx - vDotD*dx;
  const vty = vy - vDotD*dy;
  const vtz = vz - vDotD*dz;
  // ω × (R·d)
  const wx = rvw[6], wy = rvw[7], wz = rvw[8];
  const rdx = R*dx, rdy = R*dy, rdz = R*dz;
  out[oo]   = vtx + (wy*rdz - wz*rdy);
  out[oo+1] = vty + (wz*rdx - wx*rdz);
  out[oo+2] = vtz + (wx*rdy - wy*rdx);
}

/**
 * 공 하단(접촉점) 상대속도: d = [0, 0, -1].
 * relVelocity = v + ω × (R·[0,0,-1])
 *             = v + [-R·ωy, R·ωx, 0]  (← cross([wx,wy,wz], [0,0,-R]))
 *
 * 이 벡터가 0이 아니면 공이 미끄러지는 중(sliding).
 * 출처: ptmath.rel_velocity()
 */
export function relVelocity(out, oo, rvw, R) {
  out[oo]   = rvw[3] - R*rvw[7];  // vx + (-R·ωy)  ← ω×[0,0,-R] = [-ωy·(-R), ωx·(-R)-0, 0] → wait
  // cross(ω, R·d) where d=[0,0,-1]:
  // [wy·(-R) - wz·0, wz·0 - wx·(-R), wx·0 - wy·0]
  // = [-R·wy, R·wx, 0]
  out[oo]   = rvw[3] + (-R*rvw[7]);
  out[oo+1] = rvw[4] + ( R*rvw[6]);
  out[oo+2] = rvw[5] + 0;
}

// ── Cue tip 기하학 보정 (PR #182) ──

/**
 * 큐 팁 *중심* 오프셋 → 공 표면 *접촉점* 오프셋.
 * 출처: ptmath.tip_contact_offset (Pooltool 0.6.0, PR #182)
 *
 * 두 원이 외접할 때 중심간 거리는 (R + r_tip)인데,
 * 공 표면은 R 거리에 있으므로 같은 직선 위에서 R/(R+r_tip) 비율로 스케일 다운.
 *
 *   contact_point = center_offset / (1 + tip_radius / R)
 *
 * 사용처: GUI 사용자가 큐 팁의 *중심* 위치로 a, b를 입력할 때, 물리 엔진에 전달할
 *         실제 ball 표면 접촉점으로 변환.
 *
 * @param {number} a_center cue tip 중심 오프셋 (정규화)
 * @param {number} b_center cue tip 중심 오프셋 (정규화)
 * @param {number} tip_radius 큐 팁 반지름 (m)
 * @param {number} ball_radius 공 반지름 (m)
 * @returns {[number, number]} [a_contact, b_contact]
 */
export function tipContactOffset(a_center, b_center, tip_radius, ball_radius) {
  const factor = 1 / (1 + tip_radius / ball_radius);
  return [a_center * factor, b_center * factor];
}

/**
 * 공 표면 *접촉점* 오프셋 → 큐 팁 *중심* 오프셋. (역변환)
 * 출처: ptmath.tip_center_offset (Pooltool 0.6.0)
 *
 *   center_offset = contact_point · (1 + tip_radius / R)
 *
 * 사용처: GUI 렌더링 시 ball-frame 접촉점을 cue-tip 중심 위치로 표시할 때.
 */
export function tipCenterOffset(a_contact, b_contact, tip_radius, ball_radius) {
  const factor = 1 + tip_radius / ball_radius;
  return [a_contact * factor, b_contact * factor];
}


// ── 시간 계산 ──

/**
 * sliding → rolling 전이 시간.
 * t_slide = 2|u_rel| / (7·μs·g)
 * 출처: ptmath.get_slide_time()
 */
export function getSlideTime(rvw, R, u_s, g) {
  if (u_s === 0) return Infinity;
  const tmp = new Float64Array(3);
  relVelocity(tmp, 0, rvw, R);
  return 2 * norm3d(tmp, 0) / (7 * u_s * g);
}

/**
 * rolling → spinning 전이 시간.
 * t_roll = |v| / (μr·g)
 * 출처: ptmath.get_roll_time()
 */
export function getRollTime(rvw, u_r, g) {
  if (u_r === 0) return Infinity;
  return norm3d(rvw, 3) / (u_r * g);
}

/**
 * spinning → stationary 전이 시간.
 * t_spin = |ωz|·2R / (5·μsp·g)
 * 출처: ptmath.get_spin_time()
 */
export function getSpinTime(rvw, R, u_sp, g) {
  if (u_sp === 0) return Infinity;
  return abs(rvw[8]) * 2/5 * R / u_sp / g;
}

// ════════════════════════════════════════════════════════════════
// math/roots.js
// ════════════════════════════════════════════════════════════════

/**
 * roots.js v1.0
 * 2차/4차 방정식 근 해법.
 *
 * 4차: Algorithm 1010 (Orellana & De Michele, 2020, ACM TOMS)
 *      pooltool/ptmath/roots/_quartic_numba.py 에서 직접 포팅.
 * 2차: pooltool/ptmath/roots/quadratic.py 에서 포팅.
 *
 * JS에 complex number가 없으므로 [re, im] 쌍으로 처리.
 */


const macheps = 2.2204460492503131e-16;
const d2_safety_factor = 100;
const cubic_rescal_fact = 3.488062113727083e102;
const quart_rescal_fact = 7.156344627944542e76;

// ── 2차 방정식 ──

/**
 * at² + bt + c = 0 → [root1, root2] (실수, NaN if 해 없음)
 */
export function solveQuadratic(a, b, c) {
  const EPS = Number.EPSILON * 100;
  if (abs(a) < EPS) {
    if (abs(b) < EPS) return [NaN, NaN];
    const u = -c / b;
    return [u, u];
  }
  const bp = b / 2;
  const delta = bp * bp - a * c;
  const u1 = (-bp - Math.sign(bp) * sqrt(abs(delta))) / a;
  const u2 = -u1 - b / a;
  if (delta < 0) return [NaN, NaN]; // 복소수 근
  return [u1, u2];
}

// ── 최소 양의 실수 근 선택 ──

/**
 * complex roots 배열에서 "실수이고 양수인" 최소 근 반환.
 * roots: Array of [re, im] pairs.
 */
export function getSmallestPositiveReal(roots, cutoff = 1e-3, rtol = 1e-3, atol = 1e-9) {
  let min = Infinity;
  for (let i = 0; i < roots.length; i++) {
    const re = roots[i][0], im = roots[i][1];
    if (re < 0) continue;
    const aim = abs(im), are = abs(re);
    let isReal;
    if (are > cutoff)     isReal = aim < atol;
    else if (are > 0)     isReal = (aim / are) < rtol;
    else                  isReal = aim === 0;
    if (isReal && re < min) min = re;
  }
  return min;
}

// ── 4차 방정식 (Algorithm 1010) ──

function cubicDepressed(b, c) {
  const PI2 = PI / 2, TWOPI = 2 * PI;
  const Q = -b / 3, R = 0.5 * c;
  if (R === 0) return b <= 0 ? sqrt(-b) : 0;
  let KK;
  if (abs(Q) < abs(R)) {
    const QR = Q / R;
    KK = 1 - Q * QR * QR;
  } else {
    const RQ = R / Q;
    KK = sign(Q) * (RQ * RQ / Q - 1);
  }
  if (KK < 0) {
    const sqQ = sqrt(Q);
    const theta = acos((R / abs(Q)) / sqQ);
    return theta < PI2
      ? -2 * sqQ * cos(theta / 3)
      : -2 * sqQ * cos((theta + TWOPI) / 3);
  }
  let A;
  if (abs(Q) < abs(R)) {
    A = -sign(R) * pow(abs(R) * (1 + sqrt(KK)), 1 / 3);
  } else {
    A = -sign(R) * pow(abs(R) + sqrt(abs(Q)) * abs(Q) * sqrt(KK), 1 / 3);
  }
  const B = A === 0 ? 0 : Q / A;
  return A + B;
}

function cubicDepressedSafe(b, c) {
  if (abs(b) > 1e102 || abs(c) > 1e154) return cubicDepressedInf(b, c);
  const Q = -b / 3, R = 0.5 * c;
  const Q3 = Q * Q * Q, R2 = R * R;
  if (R2 < Q3) {
    const theta = acos(R / sqrt(Q3));
    const sqQ = -2 * sqrt(Q);
    return theta < PI / 2
      ? sqQ * cos(theta / 3)
      : sqQ * cos((theta + 2 * PI) / 3);
  }
  const A = -sign(R) * pow(abs(R) + sqrt(R2 - Q3), 1 / 3);
  const B = A === 0 ? 0 : Q / A;
  return A + B;
}

function cubicDepressedInf(b, c) {
  return cubicDepressed(b, c); // same logic handles inf
}

function calcPhi0(a, b, c, d, scaled) {
  const diskr = 9 * a * a - 24 * b;
  let s;
  if (diskr > 0) {
    const sd = sqrt(diskr);
    s = a > 0 ? -2 * b / (3 * a + sd) : -2 * b / (3 * a - sd);
  } else {
    s = -a / 4;
  }
  const aq = a + 4 * s;
  const bq = b + 3 * s * (a + 2 * s);
  const cq = c + s * (2 * b + s * (3 * a + 4 * s));
  const dq = d + s * (c + s * (b + s * (a + s)));
  const gg = bq * bq / 9;
  const hh = aq * cq;
  const g = hh - 4 * dq - 3 * gg;
  const h = (8 * dq + hh - 2 * gg) * bq / 3 - cq * cq - dq * aq * aq;

  let rmax = cubicDepressedSafe(g, h);
  if (!isFinite(rmax)) {
    rmax = cubicDepressed(g, h);
    if (!isFinite(rmax) && scaled) {
      const rf = cubic_rescal_fact, rf2 = rf * rf;
      const gs = (aq / rf) * (cq / rf) - 4 * (dq / rf2) - 3 * (bq / rf) * (bq / rf) / 9;
      const hs = (8 * (dq / rf2) + (aq / rf) * (cq / rf) - 2 * (bq / rf) * (bq / rf) / 9) * (bq / rf) / 3
        - (cq / rf) * (cq / rf2) - (dq / rf) * (aq / rf) * (aq / rf);
      rmax = cubicDepressedSafe(gs, hs);
      if (!isFinite(rmax)) rmax = cubicDepressed(gs, hs);
      rmax *= rf;
    }
  }

  // Newton-Raphson refinement
  let x = rmax;
  let f = x * (x * x + g) + h;
  const maxtt = Math.max(abs(x * x * x), abs(g * x), abs(h));
  if (abs(f) > macheps * maxtt) {
    for (let i = 0; i < 8; i++) {
      const df = 3 * x * x + g;
      if (df === 0) break;
      const xold = x;
      x -= f / df;
      const fold = f;
      f = x * (x * x + g) + h;
      if (f === 0) break;
      if (abs(f) >= abs(fold)) { x = xold; break; }
    }
  }
  return x;
}

function errLDLT(b, c, d, d2, l1, l2, l3) {
  let s = b === 0 ? abs(d2 + l1 * l1 + 2 * l3) : abs(((d2 + l1 * l1 + 2 * l3) - b) / b);
  s += c === 0 ? abs(2 * d2 * l2 + 2 * l1 * l3) : abs(((2 * d2 * l2 + 2 * l1 * l3) - c) / c);
  s += d === 0 ? abs(d2 * l2 * l2 + l3 * l3) : abs(((d2 * l2 * l2 + l3 * l3) - d) / d);
  return s;
}

function errABCD(a, b, c, d, aq, bq, cq, dq) {
  let s = d === 0 ? abs(bq * dq) : abs((bq * dq - d) / d);
  s += c === 0 ? abs(bq * cq + aq * dq) : abs(((bq * cq + aq * dq) - c) / c);
  s += b === 0 ? abs(bq + aq * cq + dq) : abs(((bq + aq * cq + dq) - b) / b);
  s += a === 0 ? abs(aq + cq) : abs(((aq + cq) - a) / a);
  return s;
}

function errABC(a, b, c, aq, bq, cq, dq) {
  let s = c === 0 ? abs(bq * cq + aq * dq) : abs(((bq * cq + aq * dq) - c) / c);
  s += b === 0 ? abs(bq + aq * cq + dq) : abs(((bq + aq * cq + dq) - b) / b);
  s += a === 0 ? abs(aq + cq) : abs(((aq + cq) - a) / a);
  return s;
}

// Complex math helpers: [re, im]
function cMul(a, b) { return [a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]]; }
function cAdd(a, b) { return [a[0]+b[0], a[1]+b[1]]; }
function cSub(a, b) { return [a[0]-b[0], a[1]-b[1]]; }
function cConj(a) { return [a[0], -a[1]]; }
function cAbs(a) { return sqrt(a[0]*a[0]+a[1]*a[1]); }
function cSqrt(a) {
  const r = cAbs(a);
  if (r === 0) return [0, 0];
  const re = sqrt((r + a[0]) / 2);
  const im = sign(a[1]) * sqrt((r - a[0]) / 2);
  return [re, im];
}
function cDiv(a, b) {
  const d = b[0]*b[0]+b[1]*b[1];
  return [(a[0]*b[0]+a[1]*b[1])/d, (a[1]*b[0]-a[0]*b[1])/d];
}
function cScale(a, s) { return [a[0]*s, a[1]*s]; }

function NRabcd(a, b, c, d, x0, x1, x2, x3) {
  let f0 = x1*x3-d, f1 = x1*x2+x0*x3-c, f2 = x1+x0*x2+x3-b, f3 = x0+x2-a;
  let errf = (d===0?abs(f0):abs(f0/d))+(c===0?abs(f1):abs(f1/c))
    +(b===0?abs(f2):abs(f2/b))+(a===0?abs(f3):abs(f3/a));
  for (let it = 0; it < 8; it++) {
    const x02 = x0-x2;
    const det = x1*x1+x1*(-x2*x02-2*x3)+x3*(x0*x02+x3);
    if (det === 0) break;
    const J00=x02,J01=x3-x1,J02=x1*x2-x0*x3;
    const J03=-x1*J01-x0*J02;
    const J10=x0*J00+J01,J11=-x1*J00,J12=-x1*J01,J13=-x1*J02;
    const J20=-J00,J21=-J01,J22=-J02,J23=J02*x2+J01*x3;
    const J30=-x2*J00-J01,J31=J00*x3,J32=x3*J01,J33=x3*J02;
    const dx0=J00*f0+J01*f1+J02*f2+J03*f3;
    const dx1=J10*f0+J11*f1+J12*f2+J13*f3;
    const dx2=J20*f0+J21*f1+J22*f2+J23*f3;
    const dx3=J30*f0+J31*f1+J32*f2+J33*f3;
    const ox0=x0,ox1=x1,ox2=x2,ox3=x3;
    x0-=dx0/det; x1-=dx1/det; x2-=dx2/det; x3-=dx3/det;
    f0=x1*x3-d; f1=x1*x2+x0*x3-c; f2=x1+x0*x2+x3-b; f3=x0+x2-a;
    const ef=(d===0?abs(f0):abs(f0/d))+(c===0?abs(f1):abs(f1/c))
      +(b===0?abs(f2):abs(f2/b))+(a===0?abs(f3):abs(f3/a));
    if (ef===0) break;
    if (ef>=errf) { x0=ox0;x1=ox1;x2=ox2;x3=ox3; break; }
    errf=ef;
  }
  return [x0,x1,x2,x3];
}

function solveQuad2(a, b) {
  const diskr = a*a - 4*b;
  if (diskr >= 0) {
    const div = a >= 0 ? -a - sqrt(diskr) : -a + sqrt(diskr);
    const zmax = div / 2;
    const zmin = zmax === 0 ? 0 : b / zmax;
    return [[zmax, 0], [zmin, 0]];
  }
  const sq = sqrt(-diskr);
  return [[-a/2, sq/2], [-a/2, -sq/2]];
}

/**
 * 4차 방정식 at⁴ + bt³ + ct² + dt + e = 0 의 4개 근 반환.
 * 반환: Array of 4 [re, im] pairs.
 */
export function solveQuartic(a, b, c, d, e) {
  const zero = [[0,0],[0,0],[0,0],[0,0]];
  if (a === 0) return zero;

  let ap = b/a, bp = c/a, cp = d/a, dp = e/a;
  let phi0 = calcPhi0(ap, bp, cp, dp, 0);
  let rfact = 1;

  if (!isFinite(phi0)) {
    rfact = quart_rescal_fact;
    ap /= rfact;
    const rf2 = rfact * rfact;
    bp /= rf2; cp /= rf2 * rfact; dp /= rf2 * rf2;
    phi0 = calcPhi0(ap, bp, cp, dp, 1);
  }

  const l1 = ap / 2;
  const l3 = bp / 6 + phi0 / 2;
  const del2 = cp - ap * l3;
  const bl311 = 2 * bp / 3 - phi0 - l1 * l1;
  const dml3l3 = dp - l3 * l3;

  // LDLT factorization candidates
  let nsol = 0;
  const d2m = [0,0,0], l2m = [0,0,0], res = [0,0,0];

  if (bl311 !== 0) {
    d2m[0] = bl311; l2m[0] = del2 / (2 * d2m[0]);
    res[0] = errLDLT(bp, cp, dp, d2m[0], l1, l2m[0], l3);
    nsol = 1;
  }
  if (del2 !== 0) {
    if (nsol === 0) {
      l2m[0] = 2 * dml3l3 / del2;
      if (l2m[0] !== 0) { d2m[0] = del2 / (2*l2m[0]); res[0] = errLDLT(bp,cp,dp,d2m[0],l1,l2m[0],l3); nsol=1; }
    } else if (nsol === 1) {
      l2m[1] = 2 * dml3l3 / del2;
      if (l2m[1] !== 0) { d2m[1] = del2 / (2*l2m[1]); res[1] = errLDLT(bp,cp,dp,d2m[1],l1,l2m[1],l3); nsol=2; }
    }
    if (nsol === 1) {
      d2m[1] = bl311; l2m[1] = 2*dml3l3/del2; res[1] = errLDLT(bp,cp,dp,d2m[1],l1,l2m[1],l3); nsol=2;
    } else if (nsol === 2) {
      d2m[2] = bl311; l2m[2] = 2*dml3l3/del2; res[2] = errLDLT(bp,cp,dp,d2m[2],l1,l2m[2],l3); nsol=3;
    }
  }

  let d2, l2;
  if (nsol === 0)      { d2=0; l2=0; }
  else if (nsol === 1) { d2=d2m[0]; l2=l2m[0]; }
  else if (nsol === 2) { d2 = res[0]<=res[1]?d2m[0]:d2m[1]; l2 = res[0]<=res[1]?l2m[0]:l2m[1]; }
  else {
    if (res[0]<=res[1]&&res[0]<=res[2]) { d2=d2m[0]; l2=l2m[0]; }
    else if (res[1]<=res[2])            { d2=d2m[1]; l2=l2m[1]; }
    else                                { d2=d2m[2]; l2=l2m[2]; }
  }

  let whichcase = 0, rc0 = -1, rc1 = -1;
  let aq=0,bq=0,cq=0,dq=0, aq1=0,bq1=0,cq1=0,dq1=0;
  let acx=[0,0],bcx=[0,0],ccx=[0,0],dcx=[0,0];
  let acx1=[0,0],bcx1=[0,0],ccx1=[0,0],dcx1=[0,0];
  let err0=0, err1=0;

  if (d2 < 0) {
    const gamma = sqrt(-d2);
    aq = l1+gamma; bq = l3+gamma*l2; cq = l1-gamma; dq = l3-gamma*l2;
    if (abs(dq) < abs(bq)) dq = dp/bq; else if (abs(dq) > abs(bq)) bq = dp/dq;
    // Refine aq or cq via error minimization
    if (abs(aq) < abs(cq)) {
      const vs=[0,0,0], es=[Infinity,Infinity,Infinity]; let ns=0;
      if (dq!==0) { vs[0]=(cp-bq*cq)/dq; es[0]=errABC(ap,bp,cp,vs[0],bq,cq,dq); ns=1; }
      if (cq!==0) { if(ns===0){vs[0]=(bp-dq-bq)/cq;es[0]=errABC(ap,bp,cp,vs[0],bq,cq,dq);ns=1;}
        else{vs[1]=(bp-dq-bq)/cq;es[1]=errABC(ap,bp,cp,vs[1],bq,cq,dq);ns=2;}}
      if(ns===0){vs[0]=ap-cq;es[0]=errABC(ap,bp,cp,vs[0],bq,cq,dq);aq=vs[0];}
      else if(ns===1){vs[ns]=ap-cq;es[ns]=errABC(ap,bp,cp,vs[ns],bq,cq,dq);aq=es[0]<=es[1]?vs[0]:vs[1];}
      else{vs[2]=ap-cq;es[2]=errABC(ap,bp,cp,vs[2],bq,cq,dq);aq=es[0]<=es[1]&&es[0]<=es[2]?vs[0]:es[1]<=es[2]?vs[1]:vs[2];}
    } else {
      const vs=[0,0,0], es=[Infinity,Infinity,Infinity]; let ns=0;
      if(bq!==0){vs[0]=(cp-aq*dq)/bq;es[0]=errABC(ap,bp,cp,aq,bq,vs[0],dq);ns=1;}
      if(aq!==0){if(ns===0){vs[0]=(bp-bq-dq)/aq;es[0]=errABC(ap,bp,cp,aq,bq,vs[0],dq);ns=1;}
        else{vs[1]=(bp-bq-dq)/aq;es[1]=errABC(ap,bp,cp,aq,bq,vs[1],dq);ns=2;}}
      if(ns===0){vs[0]=ap-aq;es[0]=errABC(ap,bp,cp,aq,bq,vs[0],dq);cq=vs[0];}
      else if(ns===1){vs[ns]=ap-aq;es[ns]=errABC(ap,bp,cp,aq,bq,vs[ns],dq);cq=es[0]<=es[1]?vs[0]:vs[1];}
      else{vs[2]=ap-aq;es[2]=errABC(ap,bp,cp,aq,bq,vs[2],dq);cq=es[0]<=es[1]&&es[0]<=es[2]?vs[0]:es[1]<=es[2]?vs[1]:vs[2];}
    }
    rc0 = 1;
  } else if (d2 > 0) {
    const gamma = sqrt(d2);
    acx=[l1,gamma]; bcx=[l3,gamma*l2]; ccx=cConj(acx); dcx=cConj(bcx);
    rc0 = 0;
  }

  // Fallback check
  if (rc0===-1 || abs(d2) <= d2_safety_factor*macheps*Math.max(abs(2*bp/3),abs(phi0),l1*l1)) {
    const d3 = dp - l3*l3;
    if (rc0===1) err0=errABCD(ap,bp,cp,dp,aq,bq,cq,dq);
    else if(rc0===0) {
      // complex error
      const bd=cMul(bcx,dcx), bcc=cAdd(cMul(bcx,ccx),cMul(acx,dcx));
      err0=(dp===0?cAbs(bd):abs((bd[0]-dp)/dp))+(cp===0?cAbs(bcc):abs((bcc[0]-cp)/cp));
    }
    if (d3 <= 0) {
      rc1=1; aq1=l1; bq1=l3+sqrt(-d3); cq1=l1; dq1=l3-sqrt(-d3);
      if(abs(dq1)<abs(bq1))dq1=dp/bq1; else if(abs(dq1)>abs(bq1))bq1=dp/dq1;
      err1=errABCD(ap,bp,cp,dp,aq1,bq1,cq1,dq1);
    } else {
      rc1=0; acx1=[l1,0]; bcx1=[l3,sqrt(d3)]; ccx1=[l1,0]; dcx1=cConj(bcx1);
      const bd=cMul(bcx1,dcx1),bcc=cAdd(cMul(bcx1,ccx1),cMul(acx1,dcx1));
      err1=(dp===0?cAbs(bd):abs((bd[0]-dp)/dp))+(cp===0?cAbs(bcc):abs((bcc[0]-cp)/cp));
    }
    if (rc0===-1 || err1 < err0) {
      whichcase=1;
      if(rc1===1){aq=aq1;bq=bq1;cq=cq1;dq=dq1;}
      else{acx=acx1;bcx=bcx1;ccx=ccx1;dcx=dcx1;}
    }
  }

  const roots = [[0,0],[0,0],[0,0],[0,0]];

  if ((whichcase===0&&rc0===1)||(whichcase===1&&rc1===1)) {
    [aq,bq,cq,dq] = NRabcd(ap,bp,cp,dp,aq,bq,cq,dq);
    const r1 = solveQuad2(aq,bq), r2 = solveQuad2(cq,dq);
    roots[0]=r1[0]; roots[1]=r1[1]; roots[2]=r2[0]; roots[3]=r2[1];
  } else {
    if (whichcase===0) {
      const disc = cSub(cScale(cMul(acx,acx),0.25), bcx);
      const sd = cSqrt(disc);
      const ha = cScale(acx,-0.5);
      const z1=cAdd(ha,sd), z2=cSub(ha,sd);
      const zmax = cAbs(z1)>cAbs(z2)?z1:z2;
      const zmin = cDiv(bcx,zmax);
      roots[0]=zmin; roots[1]=cConj(zmin); roots[2]=zmax; roots[3]=cConj(zmax);
    } else {
      let disc=cSqrt(cSub(cMul(acx,acx),cScale(bcx,4)));
      let z1=cScale(cAdd(acx,disc),-0.5), z2=cScale(cSub(acx,disc),-0.5);
      let zmax=cAbs(z1)>cAbs(z2)?z1:z2;
      roots[0]=zmax; roots[1]=cDiv(bcx,zmax);
      disc=cSqrt(cSub(cMul(ccx,ccx),cScale(dcx,4)));
      z1=cScale(cAdd(ccx,disc),-0.5); z2=cScale(cSub(ccx,disc),-0.5);
      zmax=cAbs(z1)>cAbs(z2)?z1:z2;
      roots[2]=zmax; roots[3]=cDiv(dcx,zmax);
    }
  }

  if (rfact !== 1) for (let k=0;k<4;k++) { roots[k][0]*=rfact; roots[k][1]*=rfact; }
  return roots;
}

// ════════════════════════════════════════════════════════════════
// physics/evolve.js
// ════════════════════════════════════════════════════════════════

/**
 * evolve.js v1.0
 * 공 궤적 진화 (4개 상태: sliding, rolling, spinning, stationary).
 * 출처: pooltool/physics/evolve/__init__.py
 *
 * rvw 레이아웃: Float64Array(9)
 *   [0..2] = r (position xyz)
 *   [3..5] = v (velocity xyz)
 *   [6..8] = w (angular velocity xyz)
 */



// ── 스핀 감쇠 (z축) ──

/**
 * ωz 선형 감쇠. 0을 넘어서 감쇠되지 않음.
 */
function evolveSpinComponent(wz, R, u_sp, g, t) {
  if (t === 0 || abs(wz) < EPS) return wz;
  const alpha = 5 * u_sp * g / (2 * R);
  const tmax = abs(wz) / alpha;
  if (t > tmax) t = tmax;
  const sgn = wz > 0 ? 1 : -1;
  return wz - sgn * alpha * t;
}

// ── Sliding 상태 진화 ──

function evolveSlide(rvw, R, m, u_s, u_sp, g, t) {
  if (t === 0) return rvw.slice();

  const out = new Float64Array(9);
  const phi = angle2d(rvw, 3); // 속도 방향각

  // 테이블 → 공 프레임 회전 (-phi)
  const rvwB0 = new Float64Array(9);
  coordRotateRvw(rvwB0, rvw, -phi);

  // 상대속도 단위벡터 (공 프레임)
  const relV = new Float64Array(3);
  relVelocity(relV, 0, rvw, R);
  const u0 = new Float64Array(3);
  unitVector(u0, 0, relV, 0);
  const u0B = new Float64Array(3);
  coordRotate(u0B, 0, u0, 0, -phi);

  // 공 프레임에서 위치·속도·각속도 계산
  const rvwB = new Float64Array(9);

  // r_B
  rvwB[0] = rvwB0[3] * t - 0.5 * u_s * g * t*t * u0B[0];
  rvwB[1] = -0.5 * u_s * g * t*t * u0B[1];
  rvwB[2] = 0;

  // v_B = v_B0 - u_s·g·t·u0_B
  rvwB[3] = rvwB0[3] - u_s * g * t * u0B[0];
  rvwB[4] = rvwB0[4] - u_s * g * t * u0B[1];
  rvwB[5] = rvwB0[5] - u_s * g * t * u0B[2];

  // w_B (x,y) = w_B0 - (5/2R)·u_s·g·t·(u0_B × ẑ)
  // cross(u0_B, [0,0,1]) = [u0B[1], -u0B[0], 0]
  const factor = 5 / (2 * R) * u_s * g * t;
  rvwB[6] = rvwB0[6] - factor * u0B[1];      // u0B × ẑ → [u0B[1], -u0B[0], 0]
  rvwB[7] = rvwB0[7] - factor * (-u0B[0]);
  rvwB[8] = rvwB0[8]; // z 회전은 아래에서 별도 감쇠

  // z축 스핀 독립 감쇠
  rvwB[8] = evolveSpinComponent(rvwB[8], R, u_sp, g, t);

  // 공 프레임 → 테이블 프레임 역회전 (+phi)
  coordRotateRvw(out, rvwB, phi);

  // 초기 위치 더하기
  out[0] += rvw[0];
  out[1] += rvw[1];
  out[2] += rvw[2];

  return out;
}

// ── Rolling 상태 진화 ──

function evolveRoll(rvw, R, u_r, u_sp, g, t) {
  if (t === 0) return rvw.slice();

  const out = new Float64Array(9);
  const vNorm = norm3d(rvw, 3);
  if (vNorm < EPS) {
    out.set(rvw);
    return out;
  }

  // v̂₀ (단위 속도)
  const vhat = [rvw[3]/vNorm, rvw[4]/vNorm, rvw[5]/vNorm];

  // r = r₀ + v₀·t - ½·μr·g·t²·v̂₀
  const decel = 0.5 * u_r * g * t * t;
  out[0] = rvw[0] + rvw[3]*t - decel*vhat[0];
  out[1] = rvw[1] + rvw[4]*t - decel*vhat[1];
  out[2] = rvw[2] + rvw[5]*t - decel*vhat[2];

  // v = v₀ - μr·g·t·v̂₀
  const vdecel = u_r * g * t;
  out[3] = rvw[3] - vdecel*vhat[0];
  out[4] = rvw[4] - vdecel*vhat[1];
  out[5] = rvw[5] - vdecel*vhat[2];

  // ω = rotate(v/R, π/2)  (롤링 조건: 접촉점 상대속도 = 0)
  const tmp = new Float64Array(3);
  tmp[0] = out[3]/R; tmp[1] = out[4]/R; tmp[2] = out[5]/R;
  coordRotate(out, 6, tmp, 0, PI/2);

  // z축 스핀 독립 감쇠
  out[8] = evolveSpinComponent(rvw[8], R, u_sp, g, t);

  return out;
}

// ── Spinning 상태 진화 ──

function evolveSpin(rvw, R, u_sp, g, t) {
  const out = rvw.slice();
  out[8] = evolveSpinComponent(out[8], R, u_sp, g, t);
  return out;
}

// ── 메인 진화 함수 ──

/**
 * 공의 운동 상태를 시간 t만큼 전진.
 *
 * @param {number} state - 현재 운동 상태 (STATIONARY, SLIDING, ...)
 * @param {Float64Array} rvw - 위치·속도·각속도 (9 floats)
 * @param {object} params - {R, m, u_s, u_sp, u_r, g}
 * @param {number} t - 전진 시간 (초)
 * @returns {[Float64Array, number]} - [새 rvw, 새 state]
 */
export function evolveBallMotion(state, rvw, params, t) {
  const { R, m, u_s, u_r, g } = params;
  const u_sp = params.u_sp !== undefined ? params.u_sp : params.u_sp_proportionality * R;

  if (state === STATIONARY || state === POCKETED) {
    return [rvw.slice(), state];
  }

  let curRvw = rvw;
  let curState = state;
  let rem = t;

  if (curState === SLIDING) {
    const dt = getSlideTime(curRvw, R, u_s, g);
    if (rem >= dt) {
      curRvw = evolveSlide(curRvw, R, m, u_s, u_sp, g, dt);
      curState = ROLLING;
      rem -= dt;
    } else {
      return [evolveSlide(curRvw, R, m, u_s, u_sp, g, rem), SLIDING];
    }
  }

  if (curState === ROLLING) {
    const dt = getRollTime(curRvw, u_r, g);
    if (rem >= dt) {
      curRvw = evolveRoll(curRvw, R, u_r, u_sp, g, dt);
      curState = SPINNING;
      rem -= dt;
    } else {
      return [evolveRoll(curRvw, R, u_r, u_sp, g, rem), ROLLING];
    }
  }

  if (curState === SPINNING) {
    const dt = getSpinTime(curRvw, R, u_sp, g);
    if (rem >= dt) {
      return [evolveSpin(curRvw, R, u_sp, g, dt), STATIONARY];
    } else {
      return [evolveSpin(curRvw, R, u_sp, g, rem), SPINNING];
    }
  }

  // shouldn't reach here
  return [curRvw.slice(), curState];
}

// ════════════════════════════════════════════════════════════════
// physics/resolve/ball-cushion.js
// ════════════════════════════════════════════════════════════════

/**
 * ball-cushion.js v1.0
 * 공-쿠션 충돌 (Han 2005 모델).
 * 출처: pooltool/physics/resolve/ball_cushion/han_2005/model.py
 *
 * 참조: Inhwan Han (2005) "Dynamics in Carom and Three Cushion Billiards"
 */



/**
 * 반발계수 보정 (속도 의존).
 * 출처: pooltool/physics/resolve/ball_cushion/han_2005/properties.py
 */
function getBallCushionRestitution(rvwR, e_c) {
  // 간략 모델: 속도에 따른 반발계수 감소 없이 상수 사용.
  // 원본도 기본 e_c를 그대로 반환하므로 동일.
  return e_c;
}

function getBallCushionFriction(rvwR, f_c) {
  return f_c;
}

/**
 * Han 2005 쿠션 충돌 핵심 계산.
 *
 * @param {Float64Array} rvw - 공 상태 (9 floats, in: 테이블 프레임)
 * @param {Float64Array} xy_normal - 쿠션 법선 벡터 (2D, 공을 향하는 방향)
 * @param {number} R - 공 반지름
 * @param {number} m - 공 질량
 * @param {number} h - 쿠션 높이 (m)
 * @param {number} e_c - 반발계수
 * @param {number} f_c - 마찰계수
 * @returns {Float64Array} 새 rvw
 */
export function han2005(rvw, xy_normal, R, m, h, e_c, f_c) {
  // 쿠션 프레임으로 회전: 법선이 [1,0,0]과 평행하도록
  const psi = angle2d(xy_normal, 0);
  const rvwR = new Float64Array(9);
  coordRotateRvw(rvwR, rvw, -psi);

  const e = getBallCushionRestitution(rvwR, e_c);
  const mu = getBallCushionFriction(rvwR, f_c);

  // 쿠션 높이 기반 각도
  const theta_a = asin(h / R - 1);

  const sinA = sin(theta_a), cosA = cos(theta_a);

  // Eqs 14: 접촉점 미끄러짐 속도
  const sx = rvwR[3]*sinA - rvwR[5]*cosA + R*rvwR[7];
  const sy = -rvwR[4] - R*rvwR[8]*cosA + R*rvwR[6]*sinA;
  const c = -rvwR[3]*cosA;  // 2D 가정

  // Eqs 16
  const II = 2/5 * m * R*R;
  const A = 7/2/m;
  const B = 1/m;

  // Eqs 17 & 20
  const PzE = -(1 + e) * c / B;
  const abs_s_0 = sqrt(sx*sx + sy*sy);
  const PzS = abs_s_0 / A;

  let PxE, PyE;
  if (PzS <= mu * PzE) {
    // Eqs 18: Sliding and sticking
    PxE = sx / A;
    PyE = sy / A;
  } else {
    // Eqs 19: Forward sliding
    PxE = mu * PzE * sx / abs_s_0;
    PyE = mu * PzE * sy / abs_s_0;
  }

  // Eqs 21 & 22: 접촉 → 레일 좌표 변환
  const PX = -PxE * sinA - PzE * cosA;
  const PY = PyE;
  const PZ = PxE * cosA - PzE * sinA;

  // Eqs 23: 속도·각속도 갱신
  rvwR[3] += PX / m;
  rvwR[4] += PY / m;
  // rvwR[5] += PZ / m;  // z축 속도 변화 무시 (2D)

  // 쿠션 높이(접촉점이 중심 위)에 의한 토크 → ω 변화.
  // 원본 Han 2005 모델은 ωz 생성량이 입사 속도에 비례하여 과대.
  //   무회전 V0=5.0 → ωz=-97 rad/s → 반사 후 경로 폭주 (커브 270°+).
  //   실제 당구: 무회전 쿠션 반사 후 사이드 스핀 거의 없음.
  // CUSHION_SPIN_DAMPING: ωz '변화량'만 감쇠. 기존 english 스핀은 보존.
  //   0.40 적용: V0=5.0 무회전 → ωz=-39 (커브 6° 수준).
  const CUSHION_SPIN_DAMPING = 0.40;
  rvwR[6] += -R / II * PY * sinA;
  rvwR[7] += R / II * (PX * sinA - PZ * cosA);
  rvwR[8] += CUSHION_SPIN_DAMPING * R / II * PY * cosA;

  // 테이블 프레임으로 역회전
  const out = new Float64Array(9);
  coordRotateRvw(out, rvwR, psi);

  return out;
}

/**
 * 선형 쿠션 충돌 해결.
 *
 * @param {Float64Array} rvw - 공 상태
 * @param {object} cushion - {p1:[x,y,z], p2:[x,y,z], normal_xy:[nx,ny]}
 * @param {object} params - {R, m, e_c, f_c}
 * @param {number} cushion_height - 쿠션 높이 (m)
 * @returns {[Float64Array, number]} [새 rvw, SLIDING]
 */
export function resolveBallLinearCushion(rvw, cushion, params, cushion_height) {
  // 법선 방향: 공의 속도와 같은 방향이어야 함 (공이 쿠션에 다가가는 중)
  let nx = cushion.normal_xy[0], ny = cushion.normal_xy[1];
  const vdot = rvw[3]*nx + rvw[4]*ny;
  if (vdot < 0) { nx = -nx; ny = -ny; }

  const normal = new Float64Array([nx, ny, 0]);
  const out = han2005(rvw, normal, params.R, params.m, cushion_height, params.e_c, params.f_c);

  return [out, SLIDING];
}

// ════════════════════════════════════════════════════════════════
// physics/resolve/ball-ball.js
// ════════════════════════════════════════════════════════════════

/**
 * ball-ball.js v1.1
 * 공-공 마찰 충돌 (Mathavan et al. 2014).
 * 출처: pooltool/physics/resolve/ball_ball/frictional_mathavan/__init__.py (Pooltool 0.6.0)
 *
 * v1.1 변경:
 *   - Alciatore 속도 의존 ball-ball 마찰 모델 추가 (PR #153 누락분 보강)
 *     u_b = a + b · exp(-c · v_rel)
 *     출처: pooltool/physics/resolve/ball_ball/friction.py (Pooltool 0.6.0)
 *
 * 참조: Mathavan, S., Jackson, M.R. & Parkin, R.M.
 *       "Numerical simulations of the frictional collisions of solid balls
 *        on a rough surface." Sports Eng 17, 227–237 (2014).
 */



// ── Alciatore 속도 의존 ball-ball 마찰 (PR #153) ──

/**
 * Alciatore Technical Proof TP A-14의 마찰 fit curve:
 *   u_b = a + b · exp(-c · v_rel)
 *
 * 기본 파라미터 (Pooltool 0.6.0 기본):
 *   a = 0.009951
 *   b = 0.108
 *   c = 1.088
 *
 * v_rel = ball-ball 접촉면에서 두 공 표면의 상대 속도 크기.
 *   - 느린 충돌 (v_rel ≈ 0): u_b → a + b ≈ 0.118 (높은 마찰)
 *   - 빠른 충돌 (v_rel → ∞): u_b → a ≈ 0.01 (낮은 마찰)
 *
 * @param {object} ball1 - {rvw, params: {R}}
 * @param {object} ball2 - 동일
 * @param {object} [coeffs] - {a, b, c} (생략 시 기본값)
 * @returns {number} u_b
 */
export function alciatoreBallBallFriction(ball1, ball2, coeffs = null) {
  const a = coeffs?.a ?? 0.009951;
  const b = coeffs?.b ?? 0.108;
  const c = coeffs?.c ?? 1.088;

  // 단위 법선 (ball1 → ball2)
  const dx = ball2.rvw[0] - ball1.rvw[0];
  const dy = ball2.rvw[1] - ball1.rvw[1];
  const dz = ball2.rvw[2] - ball1.rvw[2];
  const dn = sqrt(dx*dx + dy*dy + dz*dz);
  if (dn === 0) return a + b;  // 겹침 (예외 케이스): 최대 마찰
  const nx = dx/dn, ny = dy/dn, nz = dz/dn;

  // 각 공의 접촉면 표면 속도 (접선 성분)
  const v1c = new Float64Array(3);
  const v2c = new Float64Array(3);
  const normal12 = new Float64Array([nx, ny, nz]);
  const normal21 = new Float64Array([-nx, -ny, -nz]);

  tangentSurfaceVelocity(v1c, 0, ball1.rvw, normal12, 0, ball1.params.R);
  tangentSurfaceVelocity(v2c, 0, ball2.rvw, normal21, 0, ball2.params.R);

  // 상대 속도 크기
  const dvx = v1c[0] - v2c[0];
  const dvy = v1c[1] - v2c[1];
  const dvz = v1c[2] - v2c[2];
  const v_rel = sqrt(dvx*dvx + dvy*dvy + dvz*dvz);

  return a + b * exp(-c * v_rel);
}

/**
 * 두 공의 마찰 충돌을 해결.
 *
 * @param {Float64Array} rvw1 - 공1 상태 (9 floats)
 * @param {Float64Array} rvw2 - 공2 상태 (9 floats)
 * @param {number} R - 공 반지름
 * @param {number} M - 공 질량
 * @param {number} u_s1 - 공1 슬라이딩 마찰
 * @param {number} u_s2 - 공2 슬라이딩 마찰
 * @param {number} u_b - 공-공 마찰계수
 * @param {number} e_b - 공-공 반발계수
 * @param {number} N - 반복 횟수 (기본 1000)
 * @returns {[Float64Array, Float64Array]} [새 rvw1, 새 rvw2]
 */
export function collideBalls(rvw1, rvw2, R, M, u_s1 = 0.21, u_s2 = 0.21,
                              u_b = 0.05, e_b = 0.89, N = 1000) {
  // 위치, 속도, 각속도 분리
  const r_i = [rvw1[0], rvw1[1], rvw1[2]];
  const v_i = [rvw1[3], rvw1[4], rvw1[5]];
  const w_i = [rvw1[6], rvw1[7], rvw1[8]];
  const r_j = [rvw2[0], rvw2[1], rvw2[2]];
  const v_j = [rvw2[3], rvw2[4], rvw2[5]];
  const w_j = [rvw2[6], rvw2[7], rvw2[8]];

  // 로컬 좌표계: y = 공1→공2 방향, z = [0,0,1], x = y×z
  const rij = [r_j[0]-r_i[0], r_j[1]-r_i[1], r_j[2]-r_i[2]];
  const rij_mag = sqrt(rij[0]*rij[0] + rij[1]*rij[1] + rij[2]*rij[2]);
  const y_loc = [rij[0]/rij_mag, rij[1]/rij_mag, rij[2]/rij_mag];
  // x_loc = y_loc × Z_LOC  (Z_LOC = [0,0,1])
  const x_loc = [y_loc[1]*1 - y_loc[2]*0, y_loc[2]*0 - y_loc[0]*1, y_loc[0]*0 - y_loc[1]*0];
  // 실제로: x_loc = [y_loc[1], -y_loc[0], 0]
  const Z_LOC = [0, 0, 1];

  // G 행렬 (3×3, row-major: x_loc, y_loc, Z_LOC)
  // dot(v, x_loc), dot(v, y_loc) 등으로 로컬 변환

  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

  // 로컬 속도
  let v_ix = dot(v_i, x_loc), v_iy = dot(v_i, y_loc);
  let v_jx = dot(v_j, x_loc), v_jy = dot(v_j, y_loc);

  // 로컬 각속도 (G·ω: dot(G_row, ω))
  let w_ix = dot([x_loc[0],y_loc[0],Z_LOC[0]], w_i);  // G의 전치 곱? 아니, G = [x_loc; y_loc; Z_LOC]
  // G·w_i = [dot(x_loc, w_i), dot(y_loc, w_i), dot(Z_LOC, w_i)]
  w_ix = dot(x_loc, w_i);
  let w_iy = dot(y_loc, w_i);
  let w_iz = dot(Z_LOC, w_i);
  let w_jx = dot(x_loc, w_j);
  let w_jy = dot(y_loc, w_j);
  let w_jz = dot(Z_LOC, w_j);

  // 테이블 미끄러짐 속도
  let u_iR_x = v_ix + R * w_iy,  u_iR_y = v_iy - R * w_ix;
  let u_jR_x = v_jx + R * w_jy,  u_jR_y = v_jy - R * w_jx;
  let u_iR_xy = sqrt(u_iR_x*u_iR_x + u_iR_y*u_iR_y);
  let u_jR_xy = sqrt(u_jR_x*u_jR_x + u_jR_y*u_jR_y);

  // 공-공 접촉점 미끄러짐
  let u_ijC_x = v_ix - v_jx - R * (w_iz + w_jz);
  let u_ijC_z = R * (w_ix + w_jx);
  let u_ijC_xz = sqrt(u_ijC_x*u_ijC_x + u_ijC_z*u_ijC_z);

  // 법선 방향 상대속도
  let v_ijy = v_jy - v_iy;

  // 임펄스 스텝
  const deltaP = 0.5 * (1 + e_b) * M * abs(v_ijy) / N;
  const C = 5 / (2 * M * R);

  let W_f = Infinity, W_c = null, W = 0;

  // 압축 + 반발 루프
  while (v_ijy < 0 || W < W_f) {
    let dP1, dP2, dP_ix, dP_iy, dP_jx, dP_jy;

    if (u_ijC_xz < 1e-16) {
      dP1 = 0; dP2 = 0;
      dP_ix = 0; dP_iy = 0; dP_jx = 0; dP_jy = 0;
    } else {
      dP1 = -u_b * deltaP * u_ijC_x / u_ijC_xz;
      if (abs(u_ijC_z) < 1e-16) {
        dP2 = 0; dP_ix = 0; dP_iy = 0; dP_jx = 0; dP_jy = 0;
      } else {
        dP2 = -u_b * deltaP * u_ijC_z / u_ijC_xz;
        if (dP2 > 0) {
          dP_ix = 0; dP_iy = 0;
          if (u_jR_xy === 0) { dP_jx = 0; dP_jy = 0; }
          else { dP_jx = -u_s2 * (u_jR_x / u_jR_xy) * dP2; dP_jy = -u_s2 * (u_jR_y / u_jR_xy) * dP2; }
        } else {
          dP_jx = 0; dP_jy = 0;
          if (u_iR_xy === 0) { dP_ix = 0; dP_iy = 0; }
          else { dP_ix = u_s1 * (u_iR_x / u_iR_xy) * dP2; dP_iy = u_s1 * (u_iR_y / u_iR_xy) * dP2; }
        }
      }
    }

    // 속도 갱신
    v_ix += (dP1 + dP_ix) / M;
    v_iy += (-deltaP + dP_iy) / M;
    v_jx += (-dP1 + dP_jx) / M;
    v_jy += (deltaP + dP_jy) / M;

    // 각속도 갱신
    w_ix += C * (dP2 + dP_iy);
    w_iy += C * (-dP_ix);
    w_iz += C * (-dP1);
    w_jx += C * (dP2 + dP_jy);
    w_jy += C * (-dP_jx);
    w_jz += C * (-dP1);

    // 테이블 미끄러짐 갱신
    u_iR_x = v_ix + R * w_iy;  u_iR_y = v_iy - R * w_ix;
    u_jR_x = v_jx + R * w_jy;  u_jR_y = v_jy - R * w_jx;
    u_iR_xy = sqrt(u_iR_x*u_iR_x + u_iR_y*u_iR_y);
    u_jR_xy = sqrt(u_jR_x*u_jR_x + u_jR_y*u_jR_y);

    // 공-공 미끄러짐 갱신
    u_ijC_x = v_ix - v_jx - R * (w_iz + w_jz);
    u_ijC_z = R * (w_ix + w_jx);
    u_ijC_xz = sqrt(u_ijC_x*u_ijC_x + u_ijC_z*u_ijC_z);

    // 일(work) 누적
    const v_ijy0 = v_ijy;
    v_ijy = v_jy - v_iy;
    W += 0.5 * deltaP * abs(v_ijy0 + v_ijy);

    if (W_c === null && v_ijy > 0) {
      W_c = W;
      W_f = (1 + e_b * e_b) * W_c;
    }
  }

  // 로컬 → 글로벌 변환 (G^T · v_local)
  // G^T = [x_loc | y_loc | Z_LOC] (열 벡터)
  const toGlobal = (vx, vy, vz) => [
    x_loc[0]*vx + y_loc[0]*vy + Z_LOC[0]*vz,
    x_loc[1]*vx + y_loc[1]*vy + Z_LOC[1]*vz,
    x_loc[2]*vx + y_loc[2]*vy + Z_LOC[2]*vz,
  ];

  const v1g = toGlobal(v_ix, v_iy, 0);
  const w1g = toGlobal(w_ix, w_iy, w_iz);
  const v2g = toGlobal(v_jx, v_jy, 0);
  const w2g = toGlobal(w_jx, w_jy, w_jz);

  const out1 = new Float64Array(9);
  out1[0]=rvw1[0]; out1[1]=rvw1[1]; out1[2]=rvw1[2];
  out1[3]=v1g[0]; out1[4]=v1g[1]; out1[5]=0;  // z속도 = 0 (2D)
  out1[6]=w1g[0]; out1[7]=w1g[1]; out1[8]=w1g[2];

  const out2 = new Float64Array(9);
  out2[0]=rvw2[0]; out2[1]=rvw2[1]; out2[2]=rvw2[2];
  out2[3]=v2g[0]; out2[4]=v2g[1]; out2[5]=0;
  out2[6]=w2g[0]; out2[7]=w2g[1]; out2[8]=w2g[2];

  return [out1, out2];
}

/**
 * 공-공 충돌 해결 (고수준 래퍼).
 *
 * @param {object} ball1 - {rvw, params: {R, m, u_s, u_b, e_b}, state}
 * @param {object} ball2 - 동일 구조
 * @param {object} [opts] - {N, frictionModel: 'alciatore'|'average', frictionCoeffs}
 *   - N: 반복 횟수 (기본 1000)
 *   - frictionModel: 'alciatore' (속도 의존, Pooltool 0.6.0 기본) | 'average' (params.u_b 평균)
 *   - frictionCoeffs: Alciatore {a, b, c} 오버라이드
 * @returns {[Float64Array, Float64Array, number, number]} [rvw1, rvw2, state1, state2]
 */
export function resolveBallBall(ball1, ball2, opts = {}) {
  const N = opts.N ?? 1000;
  const frictionModel = opts.frictionModel ?? 'alciatore';

  const p1 = ball1.params, p2 = ball2.params;

  // ── 마찰계수 결정 ──
  // 'alciatore': 속도 의존 마찰 (Pooltool 0.6.0 기본, PR #153)
  // 'average': 단순 평균 (legacy 동작)
  const u_b = frictionModel === 'alciatore'
    ? alciatoreBallBallFriction(ball1, ball2, opts.frictionCoeffs)
    : (p1.u_b + p2.u_b) / 2;

  const e_b_avg = (p1.e_b + p2.e_b) / 2;

  // 충돌 전 ROLLING 상태 기억 (수정 A를 위해)
  const ball1WasRolling = ball1.state === ROLLING;
  const ball2WasRolling = ball2.state === ROLLING;
  const R1 = p1.R, R2 = p2.R;

  // SLIDING 공의 충돌 전 스핀 초과량 보존 (밀어/끌어치기 효과 보존)
  // rolling 조건: ωx = -vy/R, ωy = vx/R
  // excess = 실제 ω - rolling ω  (>0 이면 탑스핀, <0이면 백스핀)
  let excess1Wx = 0, excess1Wy = 0;
  let excess2Wx = 0, excess2Wy = 0;
  if (!ball1WasRolling && ball1.state === SLIDING) {
    excess1Wx = ball1.rvw[6] - (-ball1.rvw[4] / R1);
    excess1Wy = ball1.rvw[7] - ( ball1.rvw[3] / R1);
  }
  if (!ball2WasRolling && ball2.state === SLIDING) {
    excess2Wx = ball2.rvw[6] - (-ball2.rvw[4] / R2);
    excess2Wy = ball2.rvw[7] - ( ball2.rvw[3] / R2);
  }

  const [out1, out2] = collideBalls(
    ball1.rvw, ball2.rvw,
    p1.R, p1.m,
    p1.u_s, p2.u_s,
    u_b, e_b_avg,
    N,
  );

  // ── 수정 A: 충돌 전 ROLLING 이었던 공의 ωx, ωy를 새 v에 맞춤 ──
  // 이유: Mathavan 모델은 rolling ω를 거의 보존하여, 충돌 후 v가 작아져도
  //       ωx,ωy는 큰 채로 남아 sliding 마찰로 큐볼을 비정상 가속(+y로 따라감).
  // 조건: SLIDING 상태(끌어치기·밀어치기)에서는 rolling 조건이 의도적으로 어긋나 있으므로
  //       spin excess(탑/백 스핀 잔량)를 보존하여 새 v 기준 rolling에 더함.
  // rolling 조건: ωy = -vx/R, ωx = -vy/R (z축 회전 ωz는 보존)
  if (ball1WasRolling) {
    out1[6] = -out1[4] / R1;  // ωx = -vy/R
    out1[7] =  out1[3] / R1;  // ωy = +vx/R
    // ωz (out1[8])는 그대로 — 사이드 회전 보존
  } else if (ball1.state === SLIDING) {
    // 충돌 전 스핀 excess(밀어/끌어치기)를 새 v 기준 rolling에 더함
    out1[6] = -out1[4] / R1 + excess1Wx;
    out1[7] =  out1[3] / R1 + excess1Wy;
  }
  if (ball2WasRolling) {
    out2[6] = -out2[4] / R2;
    out2[7] =  out2[3] / R2;
  } else if (ball2.state === SLIDING) {
    out2[6] = -out2[4] / R2 + excess2Wx;
    out2[7] =  out2[3] / R2 + excess2Wy;
  }

  return [out1, out2, SLIDING, SLIDING];
}

// ════════════════════════════════════════════════════════════════
// physics/resolve/stick-ball.js
// ════════════════════════════════════════════════════════════════

/**
 * stick-ball.js v1.4
 * 큐-공 충돌 (InstantaneousPoint 모델).
 * 출처: pooltool/physics/resolve/stick_ball/instantaneous_point/__init__.py (Pooltool 0.6.0)
 *
 * v1.4 변경 — 현실 물리 정확화:
 *   1. ad-hoc frozen 흡수 처리 제거 → 정확한 sequential collision으로 교체
 *      - 큐 임팩트 후 ball이 cushion 표면 ≤ 1mm + 그 방향 진행이면
 *        즉시 정상 cushion 반사 (e_c=0.85) 적용 + ball position을 cushion 표면 밖으로 push out
 *      - 옵션 (useImmediateCushion: true) — frozen ball 수치 진동 버그용. default OFF.
 *
 * 파라미터:
 *   V0    : 큐 속도 (m/s, 사용자 입력 그대로 사용)
 *   phi   : 방향각 (deg, +x축 기준 반시계)
 *   theta : 마세각 (deg, 수평 기준 상향)
 *   a     : 사이드 타점 (UI 직관: -1=좌, +1=우)
 *   b     : 상하 타점 (-1=하, +1=상)
 */



// ── 큐 임팩트 직후 즉시 cushion contact 처리 ──

/**
 * 큐 임팩트 직후 ball이 cushion 표면에 매우 가깝거나 닿아 있으면
 * 즉시 정상 sequential cushion collision (e_c 반사) 적용 + ball을 cushion 밖으로 push out.
 *
 * 이건 ad-hoc 아닌 정확한 sequential collision의 t=0 케이스 처리.
 * (event-detect의 EPS 조건으로 누락되던 케이스 보강)
 *
 * @param {Float64Array} rvw ball 상태 (in-place 수정)
 * @param {object} table {cushions}
 * @param {number} ball_R
 * @param {number} e_c 쿠션 반발계수 (한국 표준 0.85)
 */
export function applyImmediateCushionCollision(rvw, table, ball_R, e_c) {
  const threshold = 1e-3;  // 1mm 이내면 즉시 충돌 처리
  const safety_push = 1e-4; // 0.1mm 안전 여유

  for (const cushion of table.cushions) {
    const lx = cushion.lx, ly = cushion.ly, l0 = cushion.l0;
    const lnorm = sqrt(lx*lx + ly*ly);
    const signedDist = (lx*rvw[0] + ly*rvw[1] + l0) / lnorm;
    const surfaceDist = abs(signedDist) - ball_R;

    if (surfaceDist > threshold) continue;

    // unit normal (line gradient direction)
    const nx = lx / lnorm, ny = ly / lnorm;
    const v_along_n = rvw[3]*nx + rvw[4]*ny;

    // ball이 cushion으로 들어가는가? (signedDist 부호와 v_along_n 부호 반대)
    const movingIntoCushion = (signedDist > 0 && v_along_n < 0)
                           || (signedDist < 0 && v_along_n > 0);
    if (!movingIntoCushion) continue;

    // 정상 e_c 반사 (normal 성분만)
    const v_n_after = -e_c * v_along_n;
    const dvn = v_n_after - v_along_n;
    rvw[3] += dvn * nx;
    rvw[4] += dvn * ny;
    // tangential 성분 보존

    // ball position을 cushion 표면 밖으로 push out (다시 충돌 검출 안 되도록)
    const target_signedDist = (signedDist >= 0 ? 1 : -1) * (ball_R + safety_push);
    const adjustment = target_signedDist - signedDist;
    rvw[0] += adjustment * nx;
    rvw[1] += adjustment * ny;
  }
}

/**
 * 큐 타격 시 발생하는 squirt(편향) 각도 계산.
 * 출처: pooltool/physics/resolve/stick_ball/squirt.py (Pooltool 0.6.0)
 *
 *   m_r = m_b / m_e  (공/큐말단 질량비)
 *   A = 1 - a²
 *   alpha = -throttle · arctan2(5/2 · a · √A, 1 + m_r + 5/2 · A)
 *
 * 기준: David Alciatore Technical Proof TP A-31
 *   https://billiards.colostate.edu/technical_proofs/new/TP_A-31.pdf
 *
 * Pooltool 0.6.0 squirt.py 주석: "negative is right-spin, positive is left spin"
 *   → 우리 -a 뒤집기 적용 후 a 기준으로 동일하게 처리.
 *
 * @param {number} m_b 공 질량
 * @param {number} m_e 큐 말단 효과 질량 (CueSpecs.end_mass, Pooltool 기본 ≈ 0.00567 kg)
 * @param {number} a 정규화된 사이드 타점 (Pooltool 좌표계, -1~+1)
 * @param {number} throttle squirt 강도 스케일 (0=무효화, 1=기본)
 * @returns {number} 편향각 (rad). 음수 = 오른쪽으로 편향, 양수 = 왼쪽.
 */
export function getSquirtAngle(m_b, m_e, a, throttle = 1.0) {
  const m_r = m_b / m_e;
  const A = 1 - a*a;
  const numerator = (5/2) * a * sqrt(Math.max(0, A));
  const denominator = 1 + m_r + (5/2) * A;
  return -throttle * atan2(numerator, denominator);
}

/**
 * 큐 타격 결과 (v, w) 계산.
 * @returns {[Float64Array, Float64Array]} [velocity(3), angularVelocity(3)]
 */
export function cueStrike(m, M, R, V0, phi_deg, theta_deg, a, b) {
  const phi = phi_deg * PI / 180;
  const theta = theta_deg * PI / 180;
  const I_m = 2/5 * R * R; // 관성 모멘트 / 질량

  // 큐 팁 접촉점 오프셋 (공 반경 정규화 → 실제 좌표)
  const c = sqrt(Math.max(0, 1 - a*a - b*b));
  const Qa = a * R;
  const Qc = (cos(theta)*c - sin(theta)*b) * R;
  const Qb = (sin(theta)*c + cos(theta)*b) * R;

  // 충격 후 속도 크기
  // 원본: v = 2*V0 / (1 + m/M + temp/I_m) — off-center 감쇠가 실측 대비 3~6배 과대.
  // 보정: CUE_SPEED_PRESERVATION 팩터로 감쇠 제한.
  //   실측 (Alciatore TP A-14): 1T≈3%, 2T≈10%, 3T≈20% 감속.
  //   팩터=0.20 적용 시: 1T≈4%, 1.5T≈8%, 2T≈14%, 3T≈21% (실측 근사).
  const temp = Qa*Qa + (Qb*cos(theta))**2 + (Qc*sin(theta))**2
             - 2*Qb*Qc*cos(theta)*sin(theta);
  const CUE_SPEED_PRESERVATION = 0.20;
  const v = 2 * V0 / (1 + m/M + CUE_SPEED_PRESERVATION * temp/I_m);

  // 공 프레임 속도 (Pooltool: z축 무시)
  const vB = new Float64Array(3);
  vB[0] = 0;
  vB[1] = -v * cos(theta);
  vB[2] = 0;

  // 공 프레임 각속도
  const wB = new Float64Array(3);
  wB[0] = (v / I_m) * (-Qc * sin(theta) + Qb * cos(theta));
  wB[1] = (v / I_m) * (Qa * sin(theta));
  wB[2] = (v / I_m) * (-Qa * cos(theta));

  // 테이블 프레임으로 회전 (phi + π/2)
  const rotAngle = phi + PI / 2;
  const vT = new Float64Array(3);
  const wT = new Float64Array(3);
  coordRotate(vT, 0, vB, 0, rotAngle);
  coordRotate(wT, 0, wB, 0, rotAngle);

  return [vT, wT];
}

/**
 * 큐 타격을 공 rvw에 적용.
 *
 * @param {Float64Array} rvw - 공의 현재 상태 (in-place 수정하지 않음)
 * @param {object} params - {V0, phi, theta, a, b, ...}
 *   - V0, phi, theta, a, b: 표준 큐 타격 파라미터
 *   - english_throttle: ω 스케일 (기본 1.0)
 *   - squirt_throttle: squirt 편향 스케일 (기본 1.0, 0=무효)
 *   - tip_radius: 큐 팁 반지름 (기본 0 = 보정 X. Pooltool 기본 ≈ 0.0106 m)
 *   - cue_M: 큐 질량 (기본 0.567 kg)
 *   - cue_end_mass: 큐 말단 효과 질량 (기본 ≈ 0.00567 kg, squirt 계산용)
 * @param {number} ball_m - 공 질량
 * @param {number} ball_R - 공 반지름
 * @returns {[Float64Array, number]} [새 rvw, SLIDING]
 */
export function resolveStickBall(rvw, params, ball_m, ball_R) {
  const { phi, theta = 0, a = 0, b = 0 } = params;
  const V0 = params.V0;
  const english_throttle = params.english_throttle ?? 1.0;
  const squirt_throttle = params.squirt_throttle ?? 1.0;
  const tip_radius = params.tip_radius ?? 0;
  const cue_M = params.cue_M ?? 0.567;
  const cue_end_mass = params.cue_end_mass ?? (0.170097 / 30); // Pooltool 기본
  const e_c = params.e_c ?? 0.85;

  // ── UI 입력 규약 ↔ Pooltool 내부 규약 매핑 ──
  // Pooltool 원본 정의 (Evan Kiefl docstring 명시):
  //   a = -1 → 공의 오른쪽(3시), a = +1 → 공의 왼쪽(9시)
  // 일반 사용자 직관 (한국·외국 공통 클럭 표기):
  //   3시 클릭 → 우회전(ωz<0), 9시 클릭 → 좌회전(ωz>0), 부호: 3시 = 양수
  // 우리 UI는 사용자 직관 규약(3시 = 양수 a)으로 입력 받으므로,
  // Pooltool 내부 함수 호출 시 -a로 뒤집어 부호 매핑을 일치시킴.
  //
  // 참고: Pooltool 본체도 PR #181(v0.4.3)에서 GUI ↔ 물리엔진 좌표계 불일치를
  //       수정한 적 있음 ("Fix cue contact point offset coordinate system mismatch
  //       between GUI and physics" by derek-mcblane).
  // 적용 대상: 모든 사용자 (한국·외국 무관)
  const aFlipped = -a;

  // ── PR #182 Cue Tip Geometry 보정 (옵션) ──
  // tip_radius > 0 일 때, 사용자 입력 a/b가 큐 팁 *중심* 오프셋이라고 가정하여
  // ball 표면 *접촉점*으로 변환. 기본값 0이면 보정 없음 (직접 접촉점 입력).
  let aContact = aFlipped, bContact = b;
  if (tip_radius > 0) {
    [aContact, bContact] = tipContactOffset(aFlipped, b, tip_radius, ball_R);
  }

  // ── 큐 타격 본체 ──
  const [vT, wT] = cueStrike(ball_m, cue_M, ball_R, V0, phi, theta, aContact, bContact);

  // ── PR #182 Squirt (deflection) ──
  // 사이드 타점에서 큐 끝의 효과 질량으로 인한 v 편향.
  // alpha < 0 = 오른쪽 편향, alpha > 0 = 왼쪽 편향 (Pooltool 좌표계 기준).
  if (squirt_throttle > 0) {
    const alpha = getSquirtAngle(ball_m, cue_end_mass, aContact, squirt_throttle);
    const vRotated = new Float64Array(3);
    coordRotate(vRotated, 0, vT, 0, alpha);
    vT[0] = vRotated[0];
    vT[1] = vRotated[1];
    vT[2] = vRotated[2];
  }

  const out = new Float64Array(9);
  out[0] = rvw[0]; out[1] = rvw[1]; out[2] = rvw[2]; // 위치 유지
  out[3] = vT[0]; out[4] = vT[1]; out[5] = vT[2];
  out[6] = wT[0] * english_throttle;
  out[7] = wT[1] * english_throttle;
  out[8] = wT[2] * english_throttle;

  // ── 즉시 cushion contact 처리 (옵션, default OFF) ──
  // 큐 임팩트 직후 ball이 cushion 표면에 매우 가깝거나 닿아 있으면 즉시 e_c 반사.
  // frozen ball + 그 방향 침 시 수치 진동 버그(11쿠션 진동) fix용.
  // 단, 일반 시뮬에서는 V0가 깎인 것처럼 보일 수 있으므로 default OFF.
  // 사용자가 명시적으로 useImmediateCushion: true 넘기면 적용.
  if (params.table && params.useImmediateCushion === true) {
    applyImmediateCushionCollision(out, params.table, ball_R, e_c);
  }

  return [out, SLIDING];
}

// ════════════════════════════════════════════════════════════════
// objects.js
// ════════════════════════════════════════════════════════════════

/**
 * objects.js v1.0
 * 핵심 오브젝트: Ball, Table (쿠션 세그먼트), System.
 * 출처: pooltool/objects/ball/datatypes.py, table/layout.py, system/datatypes.py
 */


// ── Ball ──

export class Ball {
  /**
   * @param {string} id
   * @param {object} opts - {xy:[x,y], R, m, u_s, u_r, u_b, e_b, e_c, f_c, g, ...}
   */
  constructor(id, opts = {}) {
    this.id = id;
    this.params = { ...DEFAULT_BALL_PARAMS, ...opts };
    this.params.u_sp = this.params.u_sp_proportionality * this.params.R;

    // rvw: Float64Array(9) = [rx,ry,rz, vx,vy,vz, wx,wy,wz]
    this.rvw = new Float64Array(9);
    if (opts.xy) {
      this.rvw[0] = opts.xy[0];
      this.rvw[1] = opts.xy[1];
      this.rvw[2] = this.params.R; // z = R (공이 테이블 위에 있으므로)
    }
    this.state = STATIONARY;

    // 시뮬레이션 이력 (궤적 시각화용)
    this.history = []; // [{rvw: Float64Array, state: number, t: number}]
  }

  copy() {
    const b = new Ball(this.id, { ...this.params });
    b.rvw = this.rvw.slice();
    b.state = this.state;
    return b;
  }

  snapshot(t) {
    this.history.push({ rvw: this.rvw.slice(), state: this.state, t });
  }
}

// ── LinearCushionSegment ──

export class LinearCushionSegment {
  /**
   * @param {string} id
   * @param {number[]} p1 - [x, y] 시작점
   * @param {number[]} p2 - [x, y] 끝점
   * @param {number} height - 쿠션 높이 (m)
   */
  constructor(id, p1, p2, height) {
    this.id = id;
    this.p1 = p1;
    this.p2 = p2;
    this.height = height;

    // 직선 방정식: lx·x + ly·y + l0 = 0
    // p1→p2 방향 벡터 d, 법선 n = [-dy, dx]
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    this.lx = -dy;
    this.ly = dx;
    this.l0 = -(this.lx * p1[0] + this.ly * p1[1]);

    // 법선 (쿠션 안쪽을 향하는 방향)
    const n = Math.sqrt(this.lx*this.lx + this.ly*this.ly);
    this.normal_xy = [this.lx / n, this.ly / n];
  }
}

// ── Table ──

export class Table {
  /**
   * @param {number} w - 폭 (x축, m)
   * @param {number} l - 길이 (y축, m)
   * @param {number} cushion_height - 쿠션 높이 (m)
   */
  constructor(w, l, cushion_height = 0.037) {
    this.w = w;
    this.l = l;
    this.cushion_height = cushion_height;

    // 캐롬(포켓 없는) 테이블: 4개 선형 쿠션 세그먼트
    // 출처: pooltool/objects/table/layout.py → create_billiard_table_cushion_segments
    const h = cushion_height;
    this.cushions = [
      new LinearCushionSegment("3",  [0, 0], [0, l], h),   // 좌측 장변 (x=0)
      new LinearCushionSegment("12", [w, l], [w, 0], h),   // 우측 장변 (x=W)
      new LinearCushionSegment("9",  [0, l], [w, l], h),   // 꼬리 단변 (y=L)
      new LinearCushionSegment("18", [0, 0], [w, 0], h),   // 머리 단변 (y=0)  ← 원본은 순서 [0,0]→[w,0]
    ];

    // 포켓 없음 (캐롬)
    this.pockets = [];
  }
}

// ── System ──

export class System {
  /**
   * @param {Table} table
   * @param {Object.<string, Ball>} balls - {id: Ball}
   * @param {string} cueBallId
   */
  constructor(table, balls, cueBallId = 'white') {
    this.table = table;
    this.balls = balls;
    this.cueBallId = cueBallId;
    this.events = []; // 시뮬레이션 이벤트 기록
    this.t = 0;       // 현재 시뮬레이션 시간
  }

  copy() {
    const newBalls = {};
    for (const [id, b] of Object.entries(this.balls)) {
      newBalls[id] = b.copy();
    }
    const sys = new System(this.table, newBalls, this.cueBallId);
    sys.t = this.t;
    return sys;
  }
}

// ── 팩토리 ──

export function createThreeCushionSystem(positions = null, cueBall = 'white') {
  const spec = SPEC_THREE_CUSHION;
  const table = new Table(spec.table_width, spec.table_length);

  if (!positions) {
    const L = spec.table_length, W = spec.table_width;
    positions = {
      white:  [W/2 + 0.1825, L/4],
      yellow: [W/2 - 0.1825, L/4],
      red:    [W/2,           3*L/4],
    };
  }

  const balls = {};
  for (const [id, xy] of Object.entries(positions)) {
    balls[id] = new Ball(id, { xy, R: spec.ball_R, m: spec.ball_m });
  }

  return new System(table, balls, cueBall);
}

export function createFourBallSystem(positions = null, cueBall = 'white') {
  const spec = SPEC_FOUR_BALL;
  const table = new Table(spec.table_width, spec.table_length);

  if (!positions) {
    const L = spec.table_length, W = spec.table_width;
    positions = {
      white:  [W/2 + 0.18, L/4],
      yellow: [W/2 - 0.18, L/4],
      red:    [W/2,         3*L/4],
      red2:   [W/2,         3*L/4 + 0.20],
    };
  }

  const balls = {};
  for (const [id, xy] of Object.entries(positions)) {
    balls[id] = new Ball(id, { xy, R: spec.ball_R, m: spec.ball_m });
  }

  return new System(table, balls, cueBall);
}

// ════════════════════════════════════════════════════════════════
// simulation/event-detect.js
// ════════════════════════════════════════════════════════════════

/**
 * event-detect.js v1.0
 * 충돌 시간 계산 (공-공, 공-쿠션, 공-포켓).
 * 출처: pooltool/evolution/event_based/solve.py
 *
 * 공의 위치가 시간의 2차 함수이므로:
 *   공-공 거리² = (2R)² → 4차 방정식
 *   공-선형쿠션 거리 = R → 2차 방정식
 *   공-원형쿠션/포켓 거리 = r+R → 4차 방정식
 */



// ── 헬퍼: 상대속도 방향 (solve.py의 get_u) ──

function getU(rvw, R, phi, s) {
  if (s === ROLLING) return [1, 0, 0];
  const rel = new Float64Array(3);
  relVelocity(rel, 0, rvw, R);
  if (rel[0] === 0 && rel[1] === 0 && rel[2] === 0) return [1, 0, 0];
  const unit = new Float64Array(3);
  unitVector(unit, 0, rel, 0);
  const out = new Float64Array(3);
  coordRotate(out, 0, unit, 0, -phi);
  return [out[0], out[1], out[2]];
}

// ── 공-공 충돌 시간 ──

function ballBallCoeffs(rvw1, rvw2, s1, s2, mu1, mu2, g1, g2, R) {
  const c1x = rvw1[0], c1y = rvw1[1];
  const c2x = rvw2[0], c2y = rvw2[1];

  let a1x=0,a1y=0,b1x=0,b1y=0;
  if (s1 !== SPINNING && s1 !== POCKETED && s1 !== STATIONARY) {
    const phi1 = angle2d(rvw1, 3);
    const v1 = norm3d(rvw1, 3);
    const u1 = getU(rvw1, R, phi1, s1);
    const K1 = -0.5 * mu1 * g1;
    const cp1 = cos(phi1), sp1 = sin(phi1);
    a1x = K1 * (u1[0]*cp1 - u1[1]*sp1);
    a1y = K1 * (u1[0]*sp1 + u1[1]*cp1);
    b1x = v1 * cp1;
    b1y = v1 * sp1;
  }

  let a2x=0,a2y=0,b2x=0,b2y=0;
  if (s2 !== SPINNING && s2 !== POCKETED && s2 !== STATIONARY) {
    const phi2 = angle2d(rvw2, 3);
    const v2 = norm3d(rvw2, 3);
    const u2 = getU(rvw2, R, phi2, s2);
    const K2 = -0.5 * mu2 * g2;
    const cp2 = cos(phi2), sp2 = sin(phi2);
    a2x = K2 * (u2[0]*cp2 - u2[1]*sp2);
    a2y = K2 * (u2[0]*sp2 + u2[1]*cp2);
    b2x = v2 * cp2;
    b2y = v2 * sp2;
  }

  const Ax = a2x-a1x, Ay = a2y-a1y;
  const Bx = b2x-b1x, By = b2y-b1y;
  const Cx = c2x-c1x, Cy = c2y-c1y;

  return [
    Ax*Ax + Ay*Ay,
    2*Ax*Bx + 2*Ay*By,
    Bx*Bx + 2*Ax*Cx + 2*Ay*Cy + By*By,
    2*Bx*Cx + 2*By*Cy,
    Cx*Cx + Cy*Cy - 4*R*R,
  ];
}

/**
 * 두 공 사이 충돌 시간.
 * @returns {number} 충돌까지 남은 시간 (Infinity if 충돌 없음)
 */
export function ballBallCollisionTime(rvw1, rvw2, s1, s2, params1, params2, R) {
  // 사전 필터링: 둘 다 정지/스피닝/포켓이면 충돌 없음
  const noMove1 = s1===SPINNING||s1===POCKETED||s1===STATIONARY;
  const noMove2 = s2===SPINNING||s2===POCKETED||s2===STATIONARY;
  if (noMove1 && noMove2) return Infinity;
  if (s1===POCKETED || s2===POCKETED) return Infinity;

  const [a,b,c,d,e] = ballBallCoeffs(
    rvw1, rvw2, s1, s2,
    s1===ROLLING ? params1.u_r : params1.u_s,
    s2===ROLLING ? params2.u_r : params2.u_s,
    params1.g, params2.g, R,
  );

  const roots = solveQuartic(a, b, c, d, e);
  return getSmallestPositiveReal(roots);
}

// ── 공-선형쿠션 충돌 시간 ──

/**
 * @param {Float64Array} rvw - 공 상태
 * @param {number} s - 운동 상태
 * @param {number} lx, ly, l0 - 직선 방정식 lx·x + ly·y + l0 = 0
 * @param {Float64Array} p1, p2 - 쿠션 세그먼트 양 끝점 [x,y]
 * @param {number} direction - 0: +R쪽, 1: -R쪽, 2: 양쪽
 * @param {object} params - {u_s, u_r, m, g, R}
 * @returns {number} 충돌 시간
 */
export function ballLinearCushionTime(rvw, s, lx, ly, l0, p1, p2, direction, params) {
  if (s===SPINNING||s===POCKETED||s===STATIONARY) return Infinity;

  const { R, m, g } = params;
  const mu = s===ROLLING ? params.u_r : params.u_s;

  const phi = angle2d(rvw, 3);
  const v = norm3d(rvw, 3);
  const u = getU(rvw, R, phi, s);
  const K = -0.5 * mu * g;
  const cp = cos(phi), sp = sin(phi);

  const ax = K*(u[0]*cp - u[1]*sp);
  const ay = K*(u[0]*sp + u[1]*cp);
  const bx = v*cp, by = v*sp;
  const cx = rvw[0], cy = rvw[1];

  const A = lx*ax + ly*ay;
  const B = lx*bx + ly*by;
  const lnorm = sqrt(lx*lx + ly*ly);

  const allRoots = [];

  const tryRoots = (C) => {
    const [r1, r2] = solveQuadratic(A, B, C);
    for (const root of [r1, r2]) {
      if (isNaN(root) || root <= EPS) continue;
      // 세그먼트 범위 체크: 충돌 시점에 공이 쿠션 세그먼트 범위 안에 있는지
      const [rvwT] = evolveBallMotion(s, rvw, params, root);
      const dx = p2[0]-p1[0], dy = p2[1]-p1[1];
      const dd = dx*dx + dy*dy;
      const score = -((p1[0]-rvwT[0])*dx + (p1[1]-rvwT[1])*dy) / dd;
      if (score >= 0 && score <= 1) allRoots.push(root);
    }
  };

  if (direction === 0 || direction === 2) {
    tryRoots(l0 + lx*cx + ly*cy + R*lnorm);
  }
  if (direction === 1 || direction === 2) {
    tryRoots(l0 + lx*cx + ly*cy - R*lnorm);
  }

  let min = Infinity;
  for (const r of allRoots) if (r < min) min = r;
  return min;
}

// ── 공-포켓 충돌 시간 (4차) ──

export function ballPocketCollisionTime(rvw, s, pocket_x, pocket_y, pocket_r, params) {
  if (s===SPINNING||s===POCKETED||s===STATIONARY) return Infinity;

  const { R, m, g } = params;
  const mu = s===ROLLING ? params.u_r : params.u_s;

  const phi = angle2d(rvw, 3);
  const v = norm3d(rvw, 3);
  const u = getU(rvw, R, phi, s);
  const K = -0.5 * mu * g;
  const cp = cos(phi), sp = sin(phi);

  const ax = K*(u[0]*cp - u[1]*sp);
  const ay = K*(u[0]*sp + u[1]*cp);
  const bx = v*cp, by = v*sp;
  const cx = rvw[0], cy = rvw[1];

  const A = 0.5*(ax*ax + ay*ay);
  const B = ax*bx + ay*by;
  const C = ax*(cx-pocket_x) + ay*(cy-pocket_y) + 0.5*(bx*bx+by*by);
  const D = bx*(cx-pocket_x) + by*(cy-pocket_y);
  const E = 0.5*(pocket_x**2+pocket_y**2+cx*cx+cy*cy - pocket_r**2)
          - (cx*pocket_x + cy*pocket_y);

  const roots = solveQuartic(A, B, C, D, E);
  return getSmallestPositiveReal(roots);
}

// ════════════════════════════════════════════════════════════════
// simulation/event-loop.js
// ════════════════════════════════════════════════════════════════

/**
 * event-loop.js v1.0
 * 이벤트 기반 시뮬레이션 메인 루프.
 * 출처: pooltool/evolution/event_based/simulate.py
 *
 * 알고리즘:
 *   1. 큐 타격 적용
 *   2. 모든 가능한 이벤트(충돌/전이)의 시간 계산
 *   3. 가장 빠른 이벤트 선택
 *   4. 모든 공을 해당 시간까지 진화
 *   5. 이벤트 해결
 *   6. 에너지가 남아 있으면 2로 복귀
 */


const MAX_EVENTS = 2000; // 무한 루프 방지

// ── 이벤트 타입 ──
export const EventType = {
  STICK_BALL: 'stick_ball',
  BALL_BALL: 'ball_ball',
  BALL_CUSHION: 'ball_cushion',
  BALL_POCKET: 'ball_pocket',
  TRANSITION: 'transition',
};

// ── 에너지 체크 ──

function ballEnergy(ball) {
  const v2 = ball.rvw[3]**2 + ball.rvw[4]**2 + ball.rvw[5]**2;
  const w2 = ball.rvw[6]**2 + ball.rvw[7]**2 + ball.rvw[8]**2;
  const { R, m } = ball.params;
  return 0.5*m*v2 + 0.5*(2/5*m*R*R)*w2;
}

function systemHasEnergy(system) {
  for (const ball of Object.values(system.balls)) {
    if (ball.state === POCKETED) continue;
    if (ballEnergy(ball) > 1e-15) return true;
  }
  return false;
}

// ── 전이 시간 계산 ──

function getTransitionTime(ball) {
  const { R, u_s, u_r, g } = ball.params;
  const u_sp = ball.params.u_sp;
  if (ball.state === SLIDING) return getSlideTime(ball.rvw, R, u_s, g);
  if (ball.state === ROLLING) return getRollTime(ball.rvw, u_r, g);
  if (ball.state === SPINNING) return getSpinTime(ball.rvw, R, u_sp, g);
  return Infinity;
}

function nextState(current) {
  if (current === SLIDING) return ROLLING;
  if (current === ROLLING) return SPINNING;
  if (current === SPINNING) return STATIONARY;
  return current;
}

// ── 메인 시뮬레이션 ──

/**
 * 시스템을 시뮬레이션한다.
 *
 * @param {System} system - 큐 타격이 이미 적용된 System
 * @param {object} opts - {maxEvents: number}
 * @returns {System} 시뮬 완료된 system (in-place 수정)
 */
export function simulate(system, opts = {}) {
  const maxEvents = opts.maxEvents || MAX_EVENTS;
  let eventCount = 0;

  // 최근 충돌 쌍 기록 — 동일 쌍의 즉시 재충돌 방지
  // key: "id1:id2" (정렬), value: 마지막 충돌 시간
  const recentBBCollisions = new Map();
  const BB_GUARD_TIME = 1e-6; // 이 시간 이내 동일 쌍 재충돌 무시

  // 초기 스냅샷
  for (const ball of Object.values(system.balls)) {
    ball.snapshot(system.t);
  }

  while (systemHasEnergy(system) && eventCount < maxEvents) {
    // ── 다음 이벤트 탐색 ──
    let minTime = Infinity;
    let minEvent = null;

    const ballIds = Object.keys(system.balls);
    const ballArr = Object.values(system.balls);

    // 1. 공-공 충돌
    for (let i = 0; i < ballArr.length; i++) {
      for (let j = i + 1; j < ballArr.length; j++) {
        const b1 = ballArr[i], b2 = ballArr[j];
        if (b1.state === POCKETED || b2.state === POCKETED) continue;

        // 최근 충돌 쌍 가드
        const pairKey = b1.id < b2.id ? `${b1.id}:${b2.id}` : `${b2.id}:${b1.id}`;
        const lastTime = recentBBCollisions.get(pairKey);
        if (lastTime !== undefined && (system.t - lastTime) < BB_GUARD_TIME) continue;

        const R = b1.params.R;
        const dt = ballBallCollisionTime(
          b1.rvw, b2.rvw, b1.state, b2.state,
          b1.params, b2.params, R,
        );
        if (dt < minTime) {
          minTime = dt;
          minEvent = { type: EventType.BALL_BALL, ids: [b1.id, b2.id] };
        }
      }
    }

    // 2. 공-쿠션 충돌
    for (const ball of ballArr) {
      if (ball.state === POCKETED) continue;
      for (const cushion of system.table.cushions) {
        const dt = ballLinearCushionTime(
          ball.rvw, ball.state,
          cushion.lx, cushion.ly, cushion.l0,
          cushion.p1, cushion.p2,
          2, // direction: 양쪽
          ball.params,
        );
        if (dt < minTime) {
          minTime = dt;
          minEvent = { type: EventType.BALL_CUSHION, ballId: ball.id, cushionId: cushion.id };
        }
      }
    }

    // 3. 상태 전이
    for (const ball of ballArr) {
      if (ball.state === STATIONARY || ball.state === POCKETED) continue;
      const dt = getTransitionTime(ball);
      if (dt < minTime) {
        minTime = dt;
        minEvent = { type: EventType.TRANSITION, ballId: ball.id };
      }
    }

    // 이벤트 없음 → 종료
    if (minEvent === null || minTime === Infinity) break;

    // 안전장치: 너무 작은 시간 전진 방지
    if (minTime < 1e-12) minTime = 1e-12;

    // ── 전이 이벤트의 경우 prev state를 미리 기록 ──
    let transitionPrevState = -1;
    if (minEvent.type === EventType.TRANSITION) {
      transitionPrevState = system.balls[minEvent.ballId].state;
    }

    // ── 모든 공을 minTime만큼 전진 ──
    for (const ball of ballArr) {
      if (ball.state === STATIONARY || ball.state === POCKETED) continue;
      const [newRvw, newState] = evolveBallMotion(
        ball.state, ball.rvw, ball.params, minTime,
      );
      ball.rvw = newRvw;
      ball.state = newState;
    }
    system.t += minTime;

    // ── 이벤트 해결 ──
    if (minEvent.type === EventType.BALL_BALL) {
      const b1 = system.balls[minEvent.ids[0]];
      const b2 = system.balls[minEvent.ids[1]];

      // 충돌 전 상태 기록
      const pre1 = b1.rvw.slice(), pre2 = b2.rvw.slice();

      const [rvw1, rvw2, s1, s2] = resolveBallBall(b1, b2);
      b1.rvw = rvw1; b1.state = s1;
      b2.rvw = rvw2; b2.state = s2;

      system.events.push({
        type: EventType.BALL_BALL,
        time: system.t,
        ids: minEvent.ids,
        pre: [pre1, pre2],
        post: [rvw1.slice(), rvw2.slice()],
      });

      // 충돌 쌍 가드 등록
      const pk = minEvent.ids[0] < minEvent.ids[1]
        ? `${minEvent.ids[0]}:${minEvent.ids[1]}`
        : `${minEvent.ids[1]}:${minEvent.ids[0]}`;
      recentBBCollisions.set(pk, system.t);
    }
    else if (minEvent.type === EventType.BALL_CUSHION) {
      const ball = system.balls[minEvent.ballId];
      const cushion = system.table.cushions.find(c => c.id === minEvent.cushionId);
      const pre = ball.rvw.slice();

      const [newRvw, newState] = resolveBallLinearCushion(
        ball.rvw, cushion, ball.params, cushion.height,
      );
      ball.rvw = newRvw;
      ball.state = newState;

      system.events.push({
        type: EventType.BALL_CUSHION,
        time: system.t,
        ballId: minEvent.ballId,
        cushionId: minEvent.cushionId,
        pre, post: newRvw.slice(),
      });
    }
    else if (minEvent.type === EventType.TRANSITION) {
      const ball = system.balls[minEvent.ballId];
      // evolveBallMotion이 이미 상태 전이를 처리했으므로 nextState 호출 불필요.
      // transitionPrevState는 진화 전에 기록해둔 이전 상태.

      system.events.push({
        type: EventType.TRANSITION,
        time: system.t,
        ballId: minEvent.ballId,
        from: transitionPrevState, to: ball.state,
      });
    }

    // 스냅샷
    for (const ball of ballArr) {
      ball.snapshot(system.t);
    }

    eventCount++;
  }

  return system;
}

/**
 * 시뮬 결과에 중간 프레임 보간 (continuize).
 * 각 공의 history 사이를 dt 간격으로 evolveBallMotion으로 채움.
 *
 * @param {System} system - simulate() 완료된 시스템
 * @param {number} dt - 보간 간격 (초, 기본 0.01)
 * @returns {Object.<string, Array>} {ballId: [{rvw, state, t}]}
 */
export function continuize(system, dt = 0.01) {
  const result = {};

  for (const [id, ball] of Object.entries(system.balls)) {
    const hist = ball.history;
    if (hist.length < 2) {
      result[id] = hist.slice();
      continue;
    }

    const continuous = [];
    for (let i = 0; i < hist.length - 1; i++) {
      const h0 = hist[i], h1 = hist[i+1];
      const span = h1.t - h0.t;
      if (span <= 0) {
        continuous.push(h0);
        continue;
      }

      const steps = Math.max(1, Math.floor(span / dt));
      const actualDt = span / steps;

      for (let s = 0; s < steps; s++) {
        const t = s * actualDt;
        const [rvw, state] = evolveBallMotion(h0.state, h0.rvw, ball.params, t);
        continuous.push({ rvw, state, t: h0.t + t });
      }
    }
    // 마지막 스냅샷
    continuous.push(hist[hist.length - 1]);
    result[id] = continuous;
  }

  return result;
}
