import {
  engineToSvg,
  type EngineEvent,
  type EngineSystem,
  type EngineBall,
  type EngineFrame,
  type EngineTable,
} from './utils.ts';

/**
 * 분석 레이어 6종 데이터 계산 (research.md 1.4 + 3.2 + 3.8 기준).
 *   - impact     : events 모든 충돌점 (cushion + ball-ball)
 *   - kiss       : 키스 (큐볼 같은 적구 재충돌 + 두 적구 간 충돌)
 *   - separation : 첫 ball-ball 충돌 직후 큐볼·1구 분리각 화살표
 *   - distance   : 큐볼 진로 위 1포인트(317.5mm) 간격 거리 마커
 *   - angle30    : 90° (stun) / 30° (rolling) 분리각 정적 가이드
 *   - noenglish  : 무회전 비교 진로 (별도 시뮬, store에서 계산)
 */

// ════════════════════════════════════════════════════════════════
// 충돌점 (impact)
// ════════════════════════════════════════════════════════════════

export interface ImpactPoint {
  svgX: number;
  svgY: number;
  /** 'cushion' = 쿠션 충돌 / 'ball' = 공-공 충돌 */
  kind: 'cushion' | 'ball';
}

export function computeImpactPoints(
  events: EngineEvent[],
  table: EngineTable
): ImpactPoint[] {
  const points: ImpactPoint[] = [];
  for (const e of events) {
    if (e.type === 'ball_cushion') {
      const post = e.post as Float64Array | undefined;
      if (post && post.length >= 2) {
        const [sx, sy] = engineToSvg(post[0], post[1], table);
        points.push({ svgX: sx, svgY: sy, kind: 'cushion' });
      }
    } else if (e.type === 'ball_ball') {
      const post = e.post as Float64Array[] | undefined;
      if (post && post.length === 2) {
        const [x1, y1] = engineToSvg(post[0][0], post[0][1], table);
        const [x2, y2] = engineToSvg(post[1][0], post[1][1], table);
        points.push({ svgX: (x1 + x2) / 2, svgY: (y1 + y2) / 2, kind: 'ball' });
      }
    }
  }
  return points;
}

// ════════════════════════════════════════════════════════════════
// 키스 (kiss) — 자기 키스 + 상대 키스
// ════════════════════════════════════════════════════════════════

export interface KissPoint {
  svgX: number;
  svgY: number;
  /** 'self' = 큐볼이 같은 적구 재충돌 / 'cross' = 두 적구 간 충돌 */
  kind: 'self' | 'cross';
}

export function computeKissPoints(
  events: EngineEvent[],
  cueBallId: string,
  table: EngineTable
): KissPoint[] {
  const points: KissPoint[] = [];
  const seenWithCue = new Set<string>();
  for (const e of events) {
    if (e.type !== 'ball_ball') continue;
    const ids = e.ids;
    if (!Array.isArray(ids)) continue;
    const post = e.post as Float64Array[] | undefined;
    if (!post || post.length !== 2) continue;
    const [x1, y1] = engineToSvg(post[0][0], post[0][1], table);
    const [x2, y2] = engineToSvg(post[1][0], post[1][1], table);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    if (ids.includes(cueBallId)) {
      const other = ids[0] === cueBallId ? ids[1] : ids[0];
      if (seenWithCue.has(other)) {
        // 자기 키스: 큐볼이 같은 적구 재충돌
        points.push({ svgX: cx, svgY: cy, kind: 'self' });
      }
      seenWithCue.add(other);
    } else {
      // 두 적구 사이 충돌 = 상대 키스 (보통 실패)
      points.push({ svgX: cx, svgY: cy, kind: 'cross' });
    }
  }
  return points;
}

// ════════════════════════════════════════════════════════════════
// 분리각 (separation) — 첫 ball-ball 충돌 직후
// ════════════════════════════════════════════════════════════════

export interface SeparationData {
  /** 충돌점 SVG 좌표 (큐볼·1구 중간). */
  contact: [number, number];
  /** 큐볼 분리 방향 SVG 끝점 (충돌점 + 화살표 길이). */
  cueArrowEnd: [number, number];
  /** 1구 진행 방향 SVG 끝점. */
  targetArrowEnd: [number, number];
  /** 분리각 (도). */
  angleDeg: number;
}

const SEP_ARROW_LEN_SVG = 50; // SVG 픽셀

export function computeSeparation(
  events: EngineEvent[],
  cueBallId: string,
  table: EngineTable
): SeparationData | null {
  const first = events.find(
    (e) =>
      e.type === 'ball_ball' &&
      Array.isArray(e.ids) &&
      e.ids.includes(cueBallId)
  );
  if (!first) return null;
  const ids = first.ids as [string, string];
  const post = first.post as Float64Array[] | undefined;
  if (!post || post.length !== 2) return null;

  const cueIdx = ids[0] === cueBallId ? 0 : 1;
  const tgtIdx = 1 - cueIdx;
  const cuePost = post[cueIdx];
  const tgtPost = post[tgtIdx];

  // post = [r0,r1,r2, v0,v1,v2, w0,w1,w2]
  const cuePos: [number, number] = [cuePost[0], cuePost[1]];
  const tgtPos: [number, number] = [tgtPost[0], tgtPost[1]];
  const cueV: [number, number] = [cuePost[3], cuePost[4]];
  const tgtV: [number, number] = [tgtPost[3], tgtPost[4]];

  const cueVMag = Math.hypot(cueV[0], cueV[1]);
  const tgtVMag = Math.hypot(tgtV[0], tgtV[1]);
  if (cueVMag < 0.01 || tgtVMag < 0.01) return null;

  // 분리각 (engine 좌표계의 vector 사이 각도, 회전 무관)
  const dot = (cueV[0] * tgtV[0] + cueV[1] * tgtV[1]) / (cueVMag * tgtVMag);
  const angleDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;

  // 충돌점 = 두 공 중간을 SVG로 변환
  const contactEnginePos: [number, number] = [
    (cuePos[0] + tgtPos[0]) / 2,
    (cuePos[1] + tgtPos[1]) / 2,
  ];
  const contact = engineToSvg(
    contactEnginePos[0],
    contactEnginePos[1],
    table
  );

  // 단위 vector를 SVG 끝점으로. SVG_END = engineToSvg(POS + UNIT * SCALE_M).
  // SCALE_M을 SEP_ARROW_LEN_SVG / scale로 잡으면 SVG에서 SEP_ARROW_LEN_SVG 픽셀 길이.
  // engineToSvg의 scale = 646 / table.l (가로 모드 기준).
  const svgScale = 646 / table.l;
  const sclMeter = SEP_ARROW_LEN_SVG / svgScale;
  const cueEndEng: [number, number] = [
    contactEnginePos[0] + (cueV[0] / cueVMag) * sclMeter,
    contactEnginePos[1] + (cueV[1] / cueVMag) * sclMeter,
  ];
  const tgtEndEng: [number, number] = [
    contactEnginePos[0] + (tgtV[0] / tgtVMag) * sclMeter,
    contactEnginePos[1] + (tgtV[1] / tgtVMag) * sclMeter,
  ];
  const cueArrowEnd = engineToSvg(cueEndEng[0], cueEndEng[1], table);
  const tgtArrowEnd = engineToSvg(tgtEndEng[0], tgtEndEng[1], table);

  return { contact, cueArrowEnd, targetArrowEnd: tgtArrowEnd, angleDeg };
}

// ════════════════════════════════════════════════════════════════
// 거리 마커 (distance) — 큐볼 진로 위 1포인트 간격
// ════════════════════════════════════════════════════════════════

export interface DistanceMarker {
  svgX: number;
  svgY: number;
  /** 1포인트 = 317.5mm 누적. "1p", "2p", ... */
  label: string;
}

const POINT_M = 0.3175;

export function computeDistanceMarkers(
  frames: Record<string, EngineFrame[]> | undefined,
  cueBallId: string,
  table: EngineTable
): DistanceMarker[] {
  if (!frames) return [];
  const cueFrames = frames[cueBallId];
  if (!cueFrames || cueFrames.length < 2) return [];

  const markers: DistanceMarker[] = [];
  let cumDist = 0;
  let nextAt = POINT_M;
  let nextLabelP = 1;

  for (let i = 1; i < cueFrames.length; i++) {
    const p = cueFrames[i - 1].rvw;
    const c = cueFrames[i].rvw;
    cumDist += Math.hypot(c[0] - p[0], c[1] - p[1]);
    while (cumDist >= nextAt) {
      const [sx, sy] = engineToSvg(c[0], c[1], table);
      markers.push({ svgX: sx, svgY: sy, label: `${nextLabelP}p` });
      nextAt += POINT_M;
      nextLabelP += 1;
      if (nextLabelP > 30) return markers; // 안전 한계
    }
  }
  return markers;
}

// ════════════════════════════════════════════════════════════════
// 동적 분리각 가이드 (angle30) — 두께·b 기반 (research.md 3.2.4 표)
// ════════════════════════════════════════════════════════════════

export interface AngleGuide {
  /** 1구 SVG 좌표 (충돌 추정 위치). */
  origin: [number, number];
  /** 1구 진행 방향 SVG 끝점 (충돌선 연장). */
  targetForward: [number, number];
  /** 큐볼 분리 방향 SVG 끝점 (두께·b 동적 보정 적용). */
  cueDirection: [number, number];
  /** 표시 라벨 (현재 두께 + 분리각). */
  label: string;
}

const ANGLE_ARM_SVG = 70;

/** research.md 3.2.4 두께→분리각 표 (stun 기준). b 보정 별도. */
const SEPARATION_TABLE: { f: number; stun: number; rolling: number }[] = [
  { f: 1.0, stun: 0, rolling: 0 },
  { f: 0.875, stun: 76, rolling: 14 },
  { f: 0.75, stun: 70, rolling: 20 },
  { f: 0.625, stun: 66, rolling: 24 },
  { f: 0.5, stun: 60, rolling: 30 },
  { f: 0.375, stun: 52, rolling: 33 },
  { f: 0.25, stun: 30, rolling: 38 },
  { f: 0.125, stun: 20, rolling: 35 },
];

/** cue.phi와 큐볼·1구 위치 차이 → cut angle (deg, 절댓값) + sign (좌·우). */
function estimateCut(
  cuePhiDeg: number,
  cueBall: EngineBall,
  target: EngineBall
): { cutAngle: number; cutSign: number } {
  const dx = target.rvw[0] - cueBall.rvw[0];
  const dy = target.rvw[1] - cueBall.rvw[1];
  const phiTarget = (Math.atan2(dy, dx) * 180) / Math.PI;
  // signed delta: cue.phi가 phiTarget보다 양수만큼 크면 큐볼이 1구 +측을 침
  const rawDelta = ((cuePhiDeg - phiTarget + 540) % 360) - 180;
  return {
    cutAngle: Math.abs(rawDelta),
    cutSign: rawDelta >= 0 ? -1 : 1, // 큐볼이 +측 치면 분리는 -측 (반대)
  };
}

/** cue.phi와 큐볼·1구 위치 차이로 두께(0~1) 추정. research.md 6.2 cut angle → fullness 매핑. */
function estimateFullness(
  cuePhiDeg: number,
  cueBall: EngineBall,
  target: EngineBall
): number {
  const { cutAngle } = estimateCut(cuePhiDeg, cueBall, target);
  if (cutAngle < 7) return 1.0;
  if (cutAngle < 17) return 0.875;
  if (cutAngle < 22) return 0.75;
  if (cutAngle < 27) return 0.625;
  if (cutAngle < 34) return 0.5;
  if (cutAngle < 49) return 0.375;
  if (cutAngle < 65) return 0.25;
  if (cutAngle < 75) return 0.125;
  return 0;
}

/** 두께 + b(상하 회전) → 큐볼 분리각 (deg, 1구 진행축으로부터). */
function thicknessToSeparation(fullness: number, b: number): number {
  // 가장 가까운 두께 행 선택
  let best = SEPARATION_TABLE[0];
  for (const row of SEPARATION_TABLE) {
    if (Math.abs(row.f - fullness) < Math.abs(best.f - fullness)) best = row;
  }
  // b 보정: top spin (b>0) → rolling, back spin (b<0) → stun에 가까워짐
  // 단순 선형 보간
  const rollFactor = Math.max(0, Math.min(1, (b + 1) / 2)); // b=-1 → 0 (stun), b=1 → 1 (rolling)
  const angle = best.stun * (1 - rollFactor) + best.rolling * rollFactor;
  // 추가 보정 (research.md 3.2.4): -25° × b로 대략. 위 보간이 이미 비슷한 효과지만 작은 값 추가.
  return Math.max(0, angle);
}

export function computeAngleGuide(
  sys: EngineSystem,
  table: EngineTable,
  cuePhi: number,
  _cueA: number,
  cueB: number
): AngleGuide | null {
  const cueBall = sys.balls[sys.cueBallId];
  if (!cueBall) return null;
  const targetEntry = Object.entries(sys.balls).find(
    ([id]) => id !== sys.cueBallId
  );
  if (!targetEntry) return null;
  const [, target] = targetEntry;

  const cueSvg = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const tgtSvg = engineToSvg(target.rvw[0], target.rvw[1], table);

  const dx = tgtSvg[0] - cueSvg[0];
  const dy = tgtSvg[1] - cueSvg[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;

  // 1구 진행 단위 vector (충돌선 연장 방향)
  const ux = dx / len;
  const uy = dy / len;
  // +90° 수직 vector (큐볼 분리 기준 최대값)
  const px = -uy;
  const py = ux;

  // 동적 분리각 계산 (두께 + b 보정)
  const { cutSign } = estimateCut(cuePhi, cueBall, target);
  const fullness = estimateFullness(cuePhi, cueBall, target);
  const sepAngle = thicknessToSeparation(fullness, cueB);

  // 분리 방향: cut direction 기반 (큐볼이 1구 +측 치면 분리는 -측 = 반대).
  // cueA(사이드 회전)는 분리 방향 결정 X — 분리 후 진로 휨에 영향만.
  const sign = cutSign;
  const rad = (sepAngle * Math.PI) / 180;
  // 1구 진행축에서 sepAngle만큼 회전. sign으로 좌·우 결정.
  const cueDirX = ux * Math.cos(rad) + sign * px * Math.sin(rad);
  const cueDirY = uy * Math.cos(rad) + sign * py * Math.sin(rad);

  return {
    origin: tgtSvg,
    targetForward: [tgtSvg[0] + ux * ANGLE_ARM_SVG, tgtSvg[1] + uy * ANGLE_ARM_SVG],
    cueDirection: [tgtSvg[0] + cueDirX * ANGLE_ARM_SVG, tgtSvg[1] + cueDirY * ANGLE_ARM_SVG],
    label: `${denominator8(fullness)} · ${Math.round(sepAngle)}°`,
  };
}

function denominator8(f: number): string {
  const e = Math.round(f * 8);
  if (e <= 0) return '0/8';
  if (e >= 8) return '8/8';
  return `${e}/8`;
}
