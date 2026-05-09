import { useState, useEffect } from 'react';

// ════════════════════════════════════════════════════════════════
// 엔진 타입 (engine.js는 JS이므로 TS 쪽에서 명시적 선언)
// ════════════════════════════════════════════════════════════════

export interface EngineBall {
  id: string;
  rvw: Float64Array;
  state: number;
  params: { m: number; R: number; [key: string]: number };
  copy(): EngineBall;
}

export interface EngineCushion {
  id: string;
  p1: number[]; // engine.js의 LinearCushionSegment는 number[] 사용
  p2: number[];
  height: number;
  [key: string]: unknown;
}

export interface EngineTable {
  w: number;
  l: number;
  cushion_height: number;
  cushions: EngineCushion[];
  pockets: unknown[];
}

export interface EngineSystem {
  table: EngineTable;
  balls: Record<string, EngineBall>;
  cueBallId: string;
  events: EngineEvent[];
  t: number;
  copy(): EngineSystem;
}

export interface EngineEvent {
  type: string;
  time: number;
  ballId?: string;
  /** ball_ball event용. [id1, id2] 형식. */
  ids?: [string, string];
  cushionId?: string;
  pre?: Float64Array | Float64Array[];
  post?: Float64Array | Float64Array[];
  from?: number;
  to?: number;
}

export interface EngineFrame {
  rvw: Float64Array;
  state: number;
  t: number;
}

// 게임 종류 (다른 모듈에서 import)
export type Game = 'three_cushion' | 'four_ball';

// ════════════════════════════════════════════════════════════════
// engine.js 함수의 타입 wrapper
//   engine.js는 JS이고 default param이 `null`이라 TS가 좁게 추론.
//   여기서 정확한 시그니처로 re-export하여 store/컴포넌트에서 그대로 사용.
// ════════════════════════════════════════════════════════════════

import {
  createThreeCushionSystem as _createThreeCushionSystem,
  createFourBallSystem as _createFourBallSystem,
  resolveStickBall as _resolveStickBall,
  simulate as _simulate,
  continuize as _continuize,
  STATIONARY as _STATIONARY,
  SPINNING as _SPINNING,
  SLIDING as _SLIDING,
  ROLLING as _ROLLING,
  Table as _Table,
  Ball as _Ball,
  System as _System,
} from './engine.js';

export type CreateSystemFn = (
  positions?: Record<string, [number, number]> | null,
  cueBall?: string
) => EngineSystem;

export interface StickBallParams {
  V0: number;
  phi: number;
  theta: number;
  a: number;
  b: number;
  table?: EngineTable;
  useBackswingLimit?: boolean;
  cue_M?: number;
  cue_length?: number;
  cue_acceleration?: number;
  english_throttle?: number;
  squirt_throttle?: number;
  tip_radius?: number;
  e_c?: number;
}

export type ResolveStickBallFn = (
  rvw: Float64Array,
  params: StickBallParams,
  ball_m: number,
  ball_R: number
) => [Float64Array, number];

export type SimulateFn = (system: EngineSystem, opts?: Record<string, unknown>) => void;

export type ContinuizeFn = (
  system: EngineSystem,
  dt?: number
) => Record<string, EngineFrame[]>;

export const createThreeCushionSystem = _createThreeCushionSystem as unknown as CreateSystemFn;
export const createFourBallSystem = _createFourBallSystem as unknown as CreateSystemFn;
export const resolveStickBall = _resolveStickBall as unknown as ResolveStickBallFn;
export const simulate = _simulate as unknown as SimulateFn;
export const continuize = _continuize as unknown as ContinuizeFn;

// 운동 상태 상수
export const STATIONARY = _STATIONARY as number;
export const SPINNING = _SPINNING as number;
export const SLIDING = _SLIDING as number;
export const ROLLING = _ROLLING as number;

// ════════════════════════════════════════════════════════════════
// 한국 당구장 표준 — 국제식 중대 (3쿠션 default)
//   engine.js의 createThreeCushionSystem은 대대(1.42×2.84) 사용.
//   한국 학습 도구이므로 중대(1.27×2.54)를 default로 사용한다.
//   research.md 4.1 좌표 체계가 한국 중대(1포인트=317.5mm) 기준.
// ════════════════════════════════════════════════════════════════

// engine.js 클래스의 명시적 인스턴스 타입 (생성자 사용 위해 cast)
const TableCtor = _Table as unknown as new (w: number, l: number) => EngineTable;
const BallCtor = _Ball as unknown as new (
  id: string,
  spec: { xy: [number, number]; R: number; m: number }
) => EngineBall;
const SystemCtor = _System as unknown as new (
  table: EngineTable,
  balls: Record<string, EngineBall>,
  cueBallId: string
) => EngineSystem;

/** 국제식 중대 3쿠션 시스템 (한국 당구장 표준). */
export function createKoreanThreeCushionSystem(
  positions?: Record<string, [number, number]> | null,
  cueBallId = 'white'
): EngineSystem {
  const W = 1.27;
  const L = 2.54;
  const R = 0.0307;
  const m = 0.21;
  const table = new TableCtor(W, L);
  const finalPositions: Record<string, [number, number]> = positions ?? {
    // 가로 모드 InfoBox(525~725, 28~163 SVG)와 겹치지 않도록 두 적구가 분리된 위치.
    // white = 머리 측 우측 (시작점), yellow = 펠트 중앙 좌측 (장변 중간), red = 꼬리 측 중앙.
    white: [W / 2 + 0.18, L / 4],
    yellow: [W / 2 - 0.18, L / 2],
    red: [W / 2, (3 * L) / 4],
  };
  const balls: Record<string, EngineBall> = {};
  for (const [id, xy] of Object.entries(finalPositions)) {
    balls[id] = new BallCtor(id, { xy, R, m });
  }
  return new SystemCtor(table, balls, cueBallId);
}

// ════════════════════════════════════════════════════════════════
// SVG 좌표 상수 (v0.15 확정)
// ════════════════════════════════════════════════════════════════

export const SVG_W = 812;
export const SVG_H = 375;
export const FELT_X = 83;
export const FELT_Y = 26;
export const FELT_W = 646;
export const FELT_H = 323;
export const FELT_X_END = FELT_X + FELT_W; // 729
export const FELT_Y_END = FELT_Y + FELT_H; // 349

// 화면 외곽까지 (쿠션 띠 + 외곽 띠 + 빈 영역)
export const CUSHION_INSET_X = 12; // 펠트 외측 쿠션 띠 두께
export const CUSHION_INSET_Y = 12;

/**
 * 공의 SVG 반지름 (펠트 가로의 1.27%).
 * 엔진 R(m)에서 직접 변환해도 되지만 시각적 일관성 위해 고정.
 */
export const BALL_R_SVG = 8.2;

/**
 * 큐대의 SVG 길이 (시각적 기본값, 실제 큐대 길이 1.4732m와 무관 — 화면 표시용).
 */
export const CUE_LEN_SVG = 100;

// ════════════════════════════════════════════════════════════════
// 좌표 변환 (가로 모드 SVG ↔ 엔진 m)
// ════════════════════════════════════════════════════════════════

/**
 * 엔진 (m, x=폭, y=길이) → 가로 모드 SVG (px).
 *
 * 매핑 규칙:
 *   엔진 y=0 (머리 단변)  → SVG x=729 (펠트 우단)
 *   엔진 y=L (꼬리 단변)  → SVG x=83  (펠트 좌단)
 *   엔진 x=0 (좌 장변)    → SVG y=26  (펠트 상단)
 *   엔진 x=W (우 장변)    → SVG y=349 (펠트 하단)
 *
 * 펠트 비율 2:1이고 엔진 L=2W이므로 scale은 X·Y 모두 동일 (FELT_W/L = FELT_H/W).
 */
export function engineToSvg(ex: number, ey: number, table: EngineTable): [number, number] {
  const scale = FELT_W / table.l;
  return [FELT_X_END - ey * scale, FELT_Y + ex * scale];
}

/**
 * 가로 모드 SVG (px) → 엔진 (m).
 * @param clamp 펠트 안으로 클램프 (공 반지름만큼 안쪽). 드래그 시 사용.
 * @param ballR 클램프 시 사용할 공 반지름 (m). 기본 0 (클램프 비활성과 동일).
 */
export function svgToEngine(
  sx: number,
  sy: number,
  table: EngineTable,
  clamp = false,
  ballR = 0
): [number, number] {
  const scale = FELT_W / table.l;
  let ex = (sy - FELT_Y) / scale;
  let ey = (FELT_X_END - sx) / scale;
  if (clamp) {
    ex = Math.max(ballR, Math.min(table.w - ballR, ex));
    ey = Math.max(ballR, Math.min(table.l - ballR, ey));
  }
  return [ex, ey];
}

/**
 * 큐볼/적구 → 적구 방향 = 엔진 phi (+x축 기준 반시계, deg).
 * SVG 화면에서 사용자가 큐대를 회전시키면 SVG 좌표 두 점을 받아 엔진 phi로 변환.
 */
export function svgAngleToEnginePhi(
  cueBallSvg: [number, number],
  targetSvg: [number, number]
): number {
  const [cx, cy] = cueBallSvg;
  const [ox, oy] = targetSvg;
  // SVG ↔ 엔진 축 매핑:
  //   svg_dx (우+) = engine_dy 감소
  //   svg_dy (하+) = engine_dx 증가
  const eng_dx = oy - cy; //  svg_dy
  const eng_dy = -(ox - cx); // -svg_dx
  return (Math.atan2(eng_dy, eng_dx) * 180) / Math.PI;
}

// ════════════════════════════════════════════════════════════════
// 진로 폴리라인 + 큐대 좌표
// ════════════════════════════════════════════════════════════════

/**
 * continuize 결과(한 공의 frame 배열) → SVG polyline points 문자열.
 * sampleEvery로 다운샘플 (60fps 결과 그대로 그리면 너무 빽빽).
 */
export function computePathSvg(
  frames: EngineFrame[] | undefined,
  table: EngineTable,
  sampleEvery = 2
): string {
  if (!frames || frames.length === 0) return '';
  const points: string[] = [];
  for (let i = 0; i < frames.length; i += sampleEvery) {
    const [sx, sy] = engineToSvg(frames[i].rvw[0], frames[i].rvw[1], table);
    points.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
  }
  // 마지막 frame 보장
  const last = frames[frames.length - 1];
  const [sx, sy] = engineToSvg(last.rvw[0], last.rvw[1], table);
  points.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
  return points.join(' ');
}

// ════════════════════════════════════════════════════════════════
// 스무스 경로 (SVG <path> d 속성)
//   1. 프레임 → SVG 좌표 샘플링
//   2. RDP 간소화 (물리 미세 떨림 제거)
//   3. 꺾임점(쿠션 반사) 감지 → 세그먼트 분할
//   4. 세그먼트별 Catmull-Rom → 큐빅 베지어 변환
//   결과: 직선 구간은 깨끗한 직선, 커브 구간은 매끄러운 곡선,
//         쿠션 반사는 날카로운 꺾임 유지.
// ════════════════════════════════════════════════════════════════

/** Ramer-Douglas-Peucker 경로 간소화. */
function rdpSimplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 2) return pts;
  const [x1, y1] = pts[0];
  const [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let d: number;
    if (lenSq < 1e-12) {
      d = Math.hypot(px - x1, py - y1);
    } else {
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
      d = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > eps) {
    const left = rdpSimplify(pts.slice(0, maxI + 1), eps);
    const right = rdpSimplify(pts.slice(maxI), eps);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

/** 꺾임점(쿠션 반사) 인덱스 감지 — 연속 세그먼트 사잇각 > threshold. */
function detectCorners(pts: [number, number][], threshold: number): Set<number> {
  const corners = new Set<number>();
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i][0] - pts[i - 1][0], ay = pts[i][1] - pts[i - 1][1];
    const bx = pts[i + 1][0] - pts[i][0], by = pts[i + 1][1] - pts[i][1];
    const dot = ax * bx + ay * by;
    const cross = ax * by - ay * bx;
    if (Math.abs(Math.atan2(cross, dot)) > threshold) corners.add(i);
  }
  return corners;
}

/** Catmull-Rom 포인트 배열 → SVG 큐빅 베지어 d 문자열 (M/C). */
function catmullRomToD(pts: [number, number][], startWithM: boolean): string {
  if (pts.length < 2) return '';
  const f = (n: number) => n.toFixed(1);
  if (pts.length === 2) {
    const prefix = startWithM ? `M${f(pts[0][0])},${f(pts[0][1])} ` : '';
    return `${prefix}L${f(pts[1][0])},${f(pts[1][1])}`;
  }
  let d = startWithM ? `M${f(pts[0][0])},${f(pts[0][1])}` : '';
  const alpha = 1 / 6; // tension factor (1/6 = standard Catmull-Rom)
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) * alpha;
    const cp1y = p1[1] + (p2[1] - p0[1]) * alpha;
    const cp2x = p2[0] - (p3[0] - p1[0]) * alpha;
    const cp2y = p2[1] - (p3[1] - p1[1]) * alpha;
    d += ` C${f(cp1x)},${f(cp1y)} ${f(cp2x)},${f(cp2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

/**
 * continuize 프레임 → 스무스 SVG path d 속성.
 * polyline 대신 <path d="..."> 에 사용.
 */
export function computeSmoothPathD(
  frames: EngineFrame[] | undefined,
  table: EngineTable,
): string {
  if (!frames || frames.length < 2) return '';
  // 1. 모든 프레임 → SVG 좌표 (매 프레임, 다운샘플 X)
  const raw: [number, number][] = [];
  for (let i = 0; i < frames.length; i++) {
    raw.push(engineToSvg(frames[i].rvw[0], frames[i].rvw[1], table));
  }
  // 2. RDP 간소화 (미세 떨림 제거, 0.35 SVG px ≈ 서브픽셀)
  const simplified = rdpSimplify(raw, 0.35);
  if (simplified.length < 2) return '';
  // 3. 꺾임점 감지 (15° 이상 = 쿠션 반사)
  const corners = detectCorners(simplified, 15 * Math.PI / 180);
  // 4. 꺾임점에서 세그먼트 분할 → 세그먼트별 Catmull-Rom
  let d = '';
  let segStart = 0;
  for (let i = 0; i <= simplified.length; i++) {
    if (i === simplified.length || corners.has(i)) {
      const end = Math.min(i + 1, simplified.length);
      const seg = simplified.slice(segStart, end);
      if (seg.length >= 2) {
        d += catmullRomToD(seg, segStart === 0);
      }
      segStart = i;
    }
  }
  return d;
}

// ════════════════════════════════════════════════════════════════
// 쿼터니언 (공 표면 점 회전 추적)
//   당구공 점(dot) 시각화용. 쿼터니언 = [w, x, y, z].
//   프레임별 각속도(ω)를 적분하여 공의 누적 자세(orientation) 추적.
// ════════════════════════════════════════════════════════════════

export type Quat = [number, number, number, number]; // [w, x, y, z]

export function quatIdentity(): Quat { return [1, 0, 0, 0]; }

export function quatFromAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const half = angle / 2;
  const s = Math.sin(half);
  return [Math.cos(half), ax * s, ay * s, az * s];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  return [
    a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
    a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
    a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
    a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0],
  ];
}

/** 쿼터니언으로 3D 점 회전. */
export function quatRotatePoint(q: Quat, x: number, y: number, z: number): [number, number, number] {
  // p' = q * p * q⁻¹   (단위 쿼터니언이므로 q⁻¹ = conjugate)
  const qp: Quat = [
    -q[1]*x - q[2]*y - q[3]*z,
     q[0]*x + q[2]*z - q[3]*y,
     q[0]*y - q[1]*z + q[3]*x,
     q[0]*z + q[1]*y - q[2]*x,
  ];
  return [
    -qp[0]*q[1] + qp[1]*q[0] - qp[2]*q[3] + qp[3]*q[2],
    -qp[0]*q[2] + qp[1]*q[3] + qp[2]*q[0] - qp[3]*q[1],
    -qp[0]*q[3] - qp[1]*q[2] + qp[2]*q[1] + qp[3]*q[0],
  ];
}

/** 단일 점의 SVG 오프셋 + 가시성. */
export interface DotPos {
  dx: number;
  dy: number;
  opacity: number;
}

/**
 * 프레임 배열 → 공 표면 점 3개의 SVG 오프셋 + 가시성 배열.
 * 점 초기 위치: 정수리 30° 아래에 정삼각형 배치 (120° 간격).
 *   - 정수리(0,0,R)는 Z축 스핀 시 제자리이므로 오프셋 필수.
 *
 * @returns [frame0, frame1, ...] 각 frame에 3개 점 배열.
 */
export function computeDotFrames(
  frames: EngineFrame[],
  ballR: number,
  ballRSvg: number,
): DotPos[][] {
  const dt = 1 / 60;
  let q = quatIdentity();
  const result: DotPos[][] = [];

  // 표면 점 6개 — 구면 전체에 비대칭 분포
  //   θ(위도): 0°=꼭대기(앞), 90°=적도(가장자리), 180°=바닥(뒤)
  //   φ(경도): 0°~360°
  //   뒷면 점(θ>90°)은 보이지 않다가 회전 시 나타남 → 자연스러운 회전 시각화
  const pts: [number, number][] = [
    [30, 15],      // 앞면 상단 (보통 보임)
    [55, 100],     // 앞면 중단 (보통 보임)
    [85, 210],     // 적도 근처 (가장자리, 약하게 보임)
    [110, 330],    // 뒷면 상단 (보통 안 보임, 회전 시 등장)
    [140, 60],     // 뒷면 하단 (보통 안 보임)
    [45, 270],     // 앞면 우측 (보통 보임)
  ];
  const DOT_INITS: [number, number, number][] = pts.map(([thetaDeg, phiDeg]) => {
    const t = thetaDeg * Math.PI / 180;
    const p = phiDeg * Math.PI / 180;
    return [
      Math.sin(t) * Math.cos(p) * ballR,
      Math.sin(t) * Math.sin(p) * ballR,
      Math.cos(t) * ballR,
    ];
  });

  const scale = ballRSvg / ballR;

  for (let i = 0; i < frames.length; i++) {
    const rvw = frames[i].rvw;
    if (i > 0) {
      const wx = rvw[6], wy = rvw[7], wz = rvw[8];
      const wMag = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (wMag > 1e-9) {
        const angle = wMag * dt;
        const dq = quatFromAxisAngle(wx / wMag, wy / wMag, wz / wMag, angle);
        q = quatMultiply(q, dq);
        if (i % 50 === 0) {
          const n = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
          if (n > 1e-9) { q[0] /= n; q[1] /= n; q[2] /= n; q[3] /= n; }
        }
      }
    }

    const dots: DotPos[] = [];
    for (const [ix, iy, iz] of DOT_INITS) {
      const [px, py, pz] = quatRotatePoint(q, ix, iy, iz);
      const nz = pz / ballR; // -1 ~ +1 (뒷면~앞면)
      if (nz <= 0.05) continue; // 뒷면 + 가장자리 극단: 완전 숨김
      dots.push({
        dx: -py * scale,
        dy: px * scale,
        opacity: Math.min(1, nz * 1.2), // 부드러운 페이드
      });
    }
    result.push(dots);
  }
  return result;
}

/**
 * 큐대 SVG 좌표(tip = 큐볼 표면, butt = 큐대 후방).
 * 큐볼 → 적구 방향과 정확히 같은 직선 위에 큐대를 둔다.
 */
export function computeCueLine(
  cueBallSvg: [number, number],
  targetSvg: [number, number],
  ballR_svg = BALL_R_SVG,
  cueLen_svg = CUE_LEN_SVG
): { tip: [number, number]; butt: [number, number] } {
  const [cx, cy] = cueBallSvg;
  const [tx, ty] = targetSvg;
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    // 적구가 큐볼 위. fallback (수평 우측).
    return { tip: [cx + ballR_svg, cy], butt: [cx + ballR_svg + cueLen_svg, cy] };
  }
  // 큐대는 적구 반대 방향
  const ux = -dx / dist;
  const uy = -dy / dist;
  const tip: [number, number] = [cx + ux * ballR_svg, cy + uy * ballR_svg];
  const butt: [number, number] = [tip[0] + ux * cueLen_svg, tip[1] + uy * cueLen_svg];
  return { tip, butt };
}

/**
 * phi(엔진 deg) 기준 큐대 SVG 좌표.
 * 사용자가 큐대 회전 드래그로 phi를 직접 조정할 때 사용.
 *
 * 좌표 매핑 (engineToSvg와 동일 axis):
 *   engine_dx (+x) → SVG +y
 *   engine_dy (+y) → SVG -x
 * 따라서 큐볼이 진행하는 방향:
 *   SVG_dx = -sin(phi)
 *   SVG_dy = +cos(phi)
 * 큐대는 진행 반대측 (butt 방향).
 */
export function computeCueLineByPhi(
  cueBallSvg: [number, number],
  phiDeg: number,
  ballR_svg = BALL_R_SVG,
  cueLen_svg = CUE_LEN_SVG
): { tip: [number, number]; butt: [number, number] } {
  const phi = (phiDeg * Math.PI) / 180;
  const fwdX = -Math.sin(phi);
  const fwdY = Math.cos(phi);
  // 큐대 = 진행 반대 (-fwd)
  const ux = -fwdX;
  const uy = -fwdY;
  const tip: [number, number] = [
    cueBallSvg[0] + ux * ballR_svg,
    cueBallSvg[1] + uy * ballR_svg,
  ];
  const butt: [number, number] = [tip[0] + ux * cueLen_svg, tip[1] + uy * cueLen_svg];
  return { tip, butt };
}

// ════════════════════════════════════════════════════════════════
// orientation hook
// ════════════════════════════════════════════════════════════════

export type Orientation = 'landscape' | 'portrait';

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() => {
    if (typeof window === 'undefined') return 'landscape';
    return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(orientation: portrait)');
    const handler = (e: MediaQueryListEvent) =>
      setOrientation(e.matches ? 'portrait' : 'landscape');

    // 표준 (modern)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // 구버전 Safari fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return orientation;
}

// ════════════════════════════════════════════════════════════════
// 보조 헬퍼
// ════════════════════════════════════════════════════════════════

/** SVG 좌표가 펠트 영역 안인지. */
export function isInFelt(sx: number, sy: number, margin = 0): boolean {
  return (
    sx >= FELT_X + margin &&
    sx <= FELT_X_END - margin &&
    sy >= FELT_Y + margin &&
    sy <= FELT_Y_END - margin
  );
}

/** 두 SVG 점 사이 거리. */
export function svgDist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** 0~360 deg로 정규화. */
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** localStorage 사용 가능 여부 (Safari 프라이빗 등). */
export function isStorageAvailable(): boolean {
  try {
    const k = '__t_billiards__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// UI 표기 단순화 헬퍼 (research.md Part 6 단순화 표기)
//   사용자 지침: 분수는 N/8 분모 고정, V₀는 정수 쿠션 수.
// ════════════════════════════════════════════════════════════════

/** 두께 소수(0~1) → 가장 가까운 N/8 분수 문자열. */
export function fullnessToFraction(f: number): string {
  const eighths = Math.round(f * 8);
  if (eighths <= 0) return '0/8';
  if (eighths >= 8) return '8/8';
  return `${eighths}/8`;
}

/** V₀(m/s) → 정수 쿠션 수 라벨 (단순 round, V0=2.8 → 3쿠션). */
export function v0ToCushion(v0: number): string {
  return `${Math.max(1, Math.round(v0))}쿠션`;
}
