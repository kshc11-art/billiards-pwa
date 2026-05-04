import {
  engineToSvg,
  type EngineSystem,
  type EngineBall,
  type EngineTable,
} from './utils.ts';

export type SystemGuide =
  | 'fh'
  | 'plus'
  | 'half'
  | 'mirror'
  | 'ball'
  | 'noenglish'
  | 'sunrise'
  | 'minus15' // 1쿠션수 = 수구수 - 1적구수 - 15 (research.md 4.7.2)
  | 'minus20' // 1쿠션수 = 수구수 - 1적구수 - 20 (research.md 4.7.3)
  | 'plus15' // 3쿠션수 = 수구수 + 1쿠션수 + 15 (research.md 4.7.4)
  | 'reverse' // 1쿠션수 = 18 - (수구수 + 목적구수). 역회전 (research.md 4.8)
  | 'thirtytwo' // 32 시스템. 4쿠션 더블레일 회귀 (research.md 4.9)
  | 'none';

export interface GuideLine {
  /** SVG 좌표 폴리라인 (점 배열). 빈 배열이면 표시 안 함. */
  points: [number, number][];
  /** UI 노출 라벨 (시스템명 + 좌표값). */
  label: string;
}

/**
 * 시스템 가이드 라인 계산 (한국 중대 1.27×2.54 기준).
 *
 * 정확도:
 *   mirror : 1뱅크 거울 반사 (수학적으로 정확)
 *   fh     : 한국 중대 비선형 좌표 + 정확 공식 1쿠션수=수구수-도착수
 *   plus   : 한국 중대 좌표 + 정확 공식 3쿠션수=수구수+1쿠션수
 *   half   : 입사=반사 미러 룰 1쿠션수=수구수/2
 *
 * 좌표 체계 (research.md Part 4 기준):
 *   - 1포인트 = 0.3175m (한국 중대 단변/장변 통일 다이아 간격)
 *   - 단변(W=1.27) 4분할, 장변(L=2.54) 8분할
 *   - F&H: 단쿠션 비선형 (코너=50, 1p=60, 1.5p=70, 2p=80, 2.5p=90, 3p=100)
 *           장쿠션 비선형 (코너=0, 4p=40, 4p+: 0.5p당 +10)
 *   - Plus: 장쿠션 선형 (1p당 +10), 단쿠션 비선형 (코너=0, 1p=30, 0.5p당 +10)
 *
 * 첫 쿠션 자동 탐지:
 *   - 큐볼 위치 + cue.phi 방향에서 4 cushion 중 가장 먼저 만나는 쿠션 식별
 *   - F&H = 장쿠션이어야 적용, Plus·Half = 단쿠션이어야 적용
 *   - 부적합 케이스는 빈 가이드 + 라벨에 "(부적합)" 표기
 */

const POINT_M = 0.3175; // 한국 중대 1포인트 (m)

// ════════════════════════════════════════════════════════════════
// F&H 좌표 변환 (다이아 ↔ 라벨)
// ════════════════════════════════════════════════════════════════
// 3C-Master 표준:
//   단쿠션(짧은 변, 5다이아=4p) 출발값:
//     0p=50, 1p=60, 2p=70, (70 이상부터 0.5p마다 +10) 2.5p=80, 3p=90, 3.5p=100, 4p=110
//   장쿠션(긴 변, 9다이아=8p) 1쿠션값:
//     0p=0, 1p=10, 2p=20, 3p=30, 4p=40, 5p=50, (50부터 0.5p마다 +10) 5.5p=60, 6p=70, 7p=90, 8p=110
//   3쿠션값 (단쿠션 도착): 0p=0, 1p=10, 2p=20, 3p=30, 4p=40 — 1p당 +10, 40부터 0.5p마다 +10
// ════════════════════════════════════════════════════════════════

/** F&H 단쿠션 수구수 (출발값/도착값) — 5 다이아 idx 0~4. 3C-Master 표준. */
function fhSourceLabel(diamond: number): number {
  // idx 0=0p, 1=1p, 2=2p, 3=3p, 4=4p
  if (diamond <= 2) return 50 + diamond * 10; // 0=50, 1=60, 2=70
  // 70 이상부터 0.5p (=idx 0.5)마다 +10. 5다이아 1p 간격이라 1p마다 +20.
  return 70 + (diamond - 2) * 20; // 3=90, 4=110
}

/** F&H 장쿠션 1쿠션값 — 9 다이아 idx 0~8. 3C-Master 표준. */
export function fhCushionLabel(diamond: number): number {
  // 0p=0, 1p=10, ..., 5p=50 (1p당 +10)
  if (diamond <= 5) return diamond * 10;
  // 5p 이후 0.5p마다 +10 = 1p마다 +20
  return 50 + (diamond - 5) * 20; // 6=70, 7=90, 8=110
}

/** 역함수: 1쿠션수 라벨 → 장쿠션 다이아 위치. */
function fhCushionLabelToDiamond(label: number): number {
  if (label <= 50) return label / 10;
  return 5 + (label - 50) / 20;
}

/** F&H 단쿠션 도착수 (3쿠션수) — 5 다이아. 출발값과 동일 룰. */
function fhTargetLabel(diamond: number): number {
  return fhSourceLabel(diamond);
}

// ════════════════════════════════════════════════════════════════
// Plus 좌표 변환
// ════════════════════════════════════════════════════════════════

/** Plus 장쿠션 수구수/도착수: 선형 1p당 +10. */
function plusLongLabel(diamond: number): number {
  return diamond * 10;
}

/** Plus 단쿠션 1쿠션수: 코너=0, 1p=30, 1.5p=40, 2p=50 (코너 부근 비선형). */
function plusShortLabelToDiamond(label: number): number {
  if (label <= 30) return label / 30;
  return 1 + (label - 30) / 20;
}

// ════════════════════════════════════════════════════════════════
// 첫 쿠션 탐지 (큐볼 위치 + phi → 첫 만나는 쿠션)
// ════════════════════════════════════════════════════════════════

type CushionId = 'left' | 'right' | 'top' | 'bottom';

interface FirstCushion {
  id: CushionId;
  point: [number, number];
}

function detectFirstCushion(
  cueBall: EngineBall,
  phiDeg: number,
  table: EngineTable,
  R: number
): FirstCushion | null {
  const cx = cueBall.rvw[0];
  const cy = cueBall.rvw[1];
  const dx = Math.cos((phiDeg * Math.PI) / 180);
  const dy = Math.sin((phiDeg * Math.PI) / 180);

  // 공 중심이 cushion에 닿을 때 = cushion에서 R만큼 안쪽
  const candidates: { id: CushionId; t: number; px: number; py: number }[] = [];
  if (dx < -1e-9) {
    const t = (R - cx) / dx;
    if (t > 1e-6) candidates.push({ id: 'left', t, px: R, py: cy + t * dy });
  }
  if (dx > 1e-9) {
    const t = (table.w - R - cx) / dx;
    if (t > 1e-6) candidates.push({ id: 'right', t, px: table.w - R, py: cy + t * dy });
  }
  if (dy < -1e-9) {
    const t = (R - cy) / dy;
    if (t > 1e-6) candidates.push({ id: 'top', t, px: cx + t * dx, py: R });
  }
  if (dy > 1e-9) {
    const t = (table.l - R - cy) / dy;
    if (t > 1e-6) candidates.push({ id: 'bottom', t, px: cx + t * dx, py: table.l - R });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.t - b.t);
  const c = candidates[0];
  return { id: c.id, point: [c.px, c.py] };
}

// ════════════════════════════════════════════════════════════════
// public API
// ════════════════════════════════════════════════════════════════

export function computeSystemGuide(
  system: SystemGuide,
  sys: EngineSystem,
  cuePhi: number
): GuideLine | null {
  if (system === 'none') return null;
  const cueBall = sys.balls[sys.cueBallId];
  if (!cueBall) return null;
  const targets = Object.entries(sys.balls)
    .filter(([id]) => id !== sys.cueBallId)
    .map(([, b]) => b);
  if (targets.length === 0) return null;
  const firstTarget = targets[0];

  switch (system) {
    case 'mirror':
      return computeMirror(sys, cueBall, firstTarget);
    case 'fh':
      return computeFh(sys, cueBall, firstTarget, cuePhi);
    case 'plus':
      return computePlus(sys, cueBall, firstTarget, cuePhi);
    case 'half':
      return computeHalf(sys, cueBall, firstTarget, cuePhi);
    case 'ball':
      return computeBall(sys, cueBall, firstTarget, cuePhi);
    case 'noenglish':
      return computeNoEnglish(sys, cueBall, firstTarget, cuePhi);
    case 'sunrise':
      return computeSunrise(sys, cueBall, firstTarget, cuePhi);
    case 'minus15':
      return computeMinusN(sys, cueBall, firstTarget, cuePhi, 15);
    case 'minus20':
      return computeMinusN(sys, cueBall, firstTarget, cuePhi, 20);
    case 'plus15':
      return computePlus15(sys, cueBall, firstTarget, cuePhi);
    case 'reverse':
      return computeReverse(sys, cueBall, firstTarget, cuePhi);
    case 'thirtytwo':
      return computeThirtyTwo(sys, cueBall, firstTarget, cuePhi);
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
// Mirror (1뱅크 거울 반사, 머리 단쿠션 y=0 미러)
// ════════════════════════════════════════════════════════════════

function computeMirror(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall
): GuideLine {
  const cueX = cueBall.rvw[0];
  const cueY = cueBall.rvw[1];
  const tgtX = target.rvw[0];
  const tgtY = target.rvw[1];
  const virtY = -tgtY;
  const dy = virtY - cueY;
  if (Math.abs(dy) < 1e-9) return { points: [], label: '미러 (동일선)' };
  const t = cueY / (cueY - virtY);
  if (t < 0 || t > 1) return { points: [], label: '미러 (해 없음)' };
  const cushX = cueX + t * (tgtX - cueX);
  const a = engineToSvg(cueX, cueY, sys.table);
  const b = engineToSvg(cushX, 0, sys.table);
  const c = engineToSvg(tgtX, tgtY, sys.table);
  return { points: [a, b, c], label: 'Mirror 1뱅크' };
}

// ════════════════════════════════════════════════════════════════
// F&H (단·장·단·장 패턴, 비선형 좌표)
// ════════════════════════════════════════════════════════════════

function computeFh(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: 'F&H (큐 방향 부적합)' };
  if (fc.id !== 'left' && fc.id !== 'right') {
    return { points: [], label: 'F&H (장쿠션 1뱅크 아님)' };
  }

  // 큐볼이 가까운 단쿠션 (머리 y=0 또는 꼬리 y=L)
  const isHead = cueBall.rvw[1] < table.l / 2;

  // 수구수: 큐볼의 단쿠션 위 위치, 1쿠션 측 코너 기준 거리.
  // F&H 좌표 체계 (research.md 4.1.2): 코너=50, 1p=60... → 코너=1쿠션 측 코너.
  // 1쿠션이 left(x=0)면 1쿠션 측 코너 = (0, 머리/꼬리). 거리 = cueBall.x.
  // 1쿠션이 right(x=W)면 코너 = (W, 머리/꼬리). 거리 = W - cueBall.x.
  const sourceFromCornerX =
    fc.id === 'left' ? cueBall.rvw[0] : table.w - cueBall.rvw[0];
  const sourceDiamond = sourceFromCornerX / POINT_M;
  const sourceLabel = fhSourceLabel(sourceDiamond);

  // 도착수: 적구의 도착측 단쿠션 위 위치, 1쿠션 측 코너 기준 거리 (수구수와 같은 코너 정의).
  // 1쿠션 left → 도착측 1쿠션 측 코너 = (0, L-머리y). 적구 거리 = target.x.
  // 1쿠션 right → 코너 = (W, L-머리y). 거리 = W - target.x.
  const targetFromCornerX = fc.id === 'left' ? target.rvw[0] : table.w - target.rvw[0];
  const targetDiamond = targetFromCornerX / POINT_M;
  const targetLabel = fhTargetLabel(targetDiamond);

  // 1쿠션수 = 수구수 - 도착수
  const firstCushionLabel = sourceLabel - targetLabel;
  if (firstCushionLabel < 0) {
    return { points: [], label: `F&H (수구수<도착수, 부적합)` };
  }
  const firstCushionDiamond = fhCushionLabelToDiamond(firstCushionLabel);

  // 1쿠션 점: 장쿠션 (left x=R 또는 right x=W-R) 위에서 수구측 코너 기준 거리
  const firstCushionY_FromCorner = firstCushionDiamond * POINT_M;
  const firstCushionY = isHead
    ? firstCushionY_FromCorner
    : table.l - firstCushionY_FromCorner;
  // 장쿠션 끝 너머는 클램프
  const clampedY = Math.max(R, Math.min(table.l - R, firstCushionY));
  const firstCushionX = fc.id === 'left' ? R : table.w - R;

  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(firstCushionX, clampedY, table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: `F&H ${Math.round(sourceLabel)}-${Math.round(firstCushionLabel)}=${Math.round(targetLabel)}`,
  };
}

// ════════════════════════════════════════════════════════════════
// Plus (장·단·장·장 패턴)
// ════════════════════════════════════════════════════════════════

function computePlus(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: 'Plus (큐 방향 부적합)' };
  if (fc.id !== 'top' && fc.id !== 'bottom') {
    return { points: [], label: 'Plus (단쿠션 1뱅크 아님)' };
  }

  // 큐볼 장쿠션 측 (좌 x≈0 또는 우 x≈W)
  const isLeft = cueBall.rvw[0] < table.w / 2;

  // 수구수: 큐볼의 장쿠션 위 위치 (1쿠션 측 코너 기준 거리)
  // 1쿠션이 top(y=0)이면 코너 = (sourceX, 0). 거리 = cueBall.y
  const sourceFromCornerY =
    fc.id === 'top' ? cueBall.rvw[1] : table.l - cueBall.rvw[1];
  const sourceDiamond = sourceFromCornerY / POINT_M;
  const sourceLabel = plusLongLabel(sourceDiamond);

  // 도착수: 적구의 같은 장쿠션 위 위치 (Plus는 3쿠션이 같은 장쿠션)
  const targetFromCornerY =
    fc.id === 'top' ? target.rvw[1] : table.l - target.rvw[1];
  const targetDiamond = targetFromCornerY / POINT_M;
  const targetLabel = plusLongLabel(targetDiamond);

  // 1쿠션수 = 도착수 - 수구수
  const firstCushionLabel = targetLabel - sourceLabel;
  if (firstCushionLabel < 0) {
    return { points: [], label: 'Plus (수구수>도착수, 부적합)' };
  }
  const firstCushionDiamond = plusShortLabelToDiamond(firstCushionLabel);

  // 1쿠션 점: 단쿠션 (top y=R 또는 bottom y=L-R) 위에서 수구측 코너 기준 거리
  const firstCushionX_FromCorner = firstCushionDiamond * POINT_M;
  const firstCushionX = isLeft
    ? firstCushionX_FromCorner
    : table.w - firstCushionX_FromCorner;
  const clampedX = Math.max(R, Math.min(table.w - R, firstCushionX));
  const firstCushionY = fc.id === 'top' ? R : table.l - R;

  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(clampedX, firstCushionY, table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: `Plus ${Math.round(sourceLabel)}+${Math.round(firstCushionLabel)}=${Math.round(targetLabel)}`,
  };
}

// ════════════════════════════════════════════════════════════════
// Half (입사=반사, 1쿠션수 = 수구수/2)
// ════════════════════════════════════════════════════════════════

function computeHalf(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: 'Half (큐 방향 부적합)' };
  if (fc.id !== 'top' && fc.id !== 'bottom') {
    return { points: [], label: 'Half (단쿠션 1뱅크 아님)' };
  }

  const isLeft = cueBall.rvw[0] < table.w / 2;

  // 수구수: 큐볼의 장쿠션 위 위치 (선형 1p당 +10)
  const sourceFromCornerY =
    fc.id === 'top' ? cueBall.rvw[1] : table.l - cueBall.rvw[1];
  const sourceDiamond = sourceFromCornerY / POINT_M;
  const sourceLabel = sourceDiamond * 10;

  // 1쿠션수 = 수구수 / 2 → 단쿠션 다이아 (선형, 1p당 +10)
  const firstCushionLabel = sourceLabel / 2;
  const firstCushionDiamond = firstCushionLabel / 10;

  // 1쿠션 점
  const firstCushionX_FromCorner = firstCushionDiamond * POINT_M;
  const firstCushionX = isLeft
    ? firstCushionX_FromCorner
    : table.w - firstCushionX_FromCorner;
  const clampedX = Math.max(R, Math.min(table.w - R, firstCushionX));
  const firstCushionY = fc.id === 'top' ? R : table.l - R;

  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(clampedX, firstCushionY, table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: `Half ${Math.round(sourceLabel)}→${Math.round(firstCushionLabel)}`,
  };
}

// ════════════════════════════════════════════════════════════════
// Ball System (가변 가산형 — 두께수 + 팁수 = B2 + B3 + 기울기)
//   research.md 4.4
//   v0.3 단순 구현: 1구 → 1쿠션 (B2 다이아) → 도착 (B3 다이아). 기울기는 무시 (큐볼·1구 같은 장쿠션 가정).
// ════════════════════════════════════════════════════════════════

function computeBall(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  // 큐 방향이 어느 쿠션과 만나는지 (큐 방향 부적합 체크용)
  if (!detectFirstCushion(cueBall, cuePhi, table, R)) {
    return { points: [], label: 'Ball (큐 방향 부적합)' };
  }

  // B2 (1구 1쿠션 위치): 1구가 큐볼·1구 vector 방향으로 직진한다고 가정.
  // 그 방향에서 만나는 첫 쿠션의 코너 거리 → 다이아 환산.
  const phiTarget =
    (Math.atan2(target.rvw[1] - cueBall.rvw[1], target.rvw[0] - cueBall.rvw[0]) * 180) /
    Math.PI;
  const tgtFc = detectFirstCushion(target, phiTarget, table, R);
  let b2 = 0;
  let b2Pt: [number, number] | null = null;
  if (tgtFc) {
    const cornerDistEng =
      tgtFc.id === 'left' || tgtFc.id === 'right'
        ? Math.min(tgtFc.point[1], table.l - tgtFc.point[1])
        : Math.min(tgtFc.point[0], table.w - tgtFc.point[0]);
    b2 = Math.round(cornerDistEng / POINT_M);
    b2Pt = engineToSvg(tgtFc.point[0], tgtFc.point[1], table);
  }

  // B3 (3쿠션 도착 위치 = 적구 위치): 적구의 가장 가까운 쿠션 코너 거리 → 다이아 환산.
  const tgtCornerDist =
    target.rvw[0] < table.w / 2
      ? Math.min(target.rvw[0], table.l - target.rvw[1], target.rvw[1])
      : Math.min(table.w - target.rvw[0], target.rvw[1], table.l - target.rvw[1]);
  const b3 = Math.round(tgtCornerDist / POINT_M);

  // 기울기: 큐볼·1구의 장쿠션 위치차 (engine x 차이) / POINT
  const gradient = Math.max(
    -2,
    Math.min(2, Math.round((cueBall.rvw[0] - target.rvw[0]) / POINT_M))
  );

  const required = b2 + b3 + gradient;

  // 폴리라인: 큐볼 → 1구 → 1쿠션 (1구가 친 후 1쿠션 위치).
  // 큐볼이 1구를 친 후, 1구는 1쿠션 (B2 위치)로 진행. 큐볼 자체 진로는 시뮬에서 표시.
  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const tgt = engineToSvg(target.rvw[0], target.rvw[1], table);
  const points: [number, number][] = b2Pt ? [a, tgt, b2Pt] : [a, tgt];

  return {
    points,
    label: `Ball B2=${b2}+B3=${b3}+기울기=${gradient} → 두께+팁 ${required} 필요`,
  };
}

// ════════════════════════════════════════════════════════════════
// No English (17/25 — 무회전 회귀)
//   research.md 4.10
//   17 시스템: 17 → 0 → 17 대칭 회귀. Half System의 회귀 변형.
//   단쿠션 1쿠션, 입사=반사 미러 룰.
// ════════════════════════════════════════════════════════════════

function computeNoEnglish(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: 'No English (큐 방향 부적합)' };
  if (fc.id !== 'top' && fc.id !== 'bottom') {
    return { points: [], label: 'No English (단쿠션 1뱅크 아님)' };
  }

  const isLeft = cueBall.rvw[0] < table.w / 2;

  // 17 시스템: 수구 17p → 1쿠션 0 → 도착 17 (대칭)
  // 일반화: 1쿠션수 = 수구수 / 2 (Half과 동일하지만 도착도 같은 측 단쿠션)
  // 단순 미러 룰: 1쿠션 점 = 큐볼 단쿠션 위치 / 2 (대칭).
  const sourceFromCornerY =
    fc.id === 'top' ? cueBall.rvw[1] : table.l - cueBall.rvw[1];
  const sourceDiamond = sourceFromCornerY / POINT_M;
  const firstCushionDiamond = sourceDiamond / 2;

  const firstCushionX_FromCorner = firstCushionDiamond * POINT_M;
  const firstCushionX = isLeft
    ? firstCushionX_FromCorner
    : table.w - firstCushionX_FromCorner;
  const clampedX = Math.max(R, Math.min(table.w - R, firstCushionX));
  const firstCushionY = fc.id === 'top' ? R : table.l - R;

  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(clampedX, firstCushionY, table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: `No English ${Math.round(sourceDiamond * 10)}→${Math.round(firstCushionDiamond * 10)}`,
  };
}

// ════════════════════════════════════════════════════════════════
// 일출일몰 (Sunrise-Sunset) — 빗겨치기 전용
//   research.md 4.6
//   공식: 팁수 = 수구포인트 + 1쿠션포인트 + 3쿠션포인트
//   v0.3 단순 구현: 큐볼·적구 위치에서 필요 팁수 라벨만 표시. 진로는 큐볼 → 1쿠션 → 적구.
// ════════════════════════════════════════════════════════════════

function computeSunrise(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: '일출일몰 (큐 방향 부적합)' };
  // 일출일몰은 단쿠션 1뱅크 표준 (research.md 4.6.7 도해)
  if (fc.id !== 'top' && fc.id !== 'bottom') {
    return { points: [], label: '일출일몰 (단쿠션 1뱅크 아님)' };
  }

  const isLeft = cueBall.rvw[0] < table.w / 2;

  // 수구포인트: 큐볼이 출발 단쿠션의 1쿠션 측 코너에서 거리 (장쿠션 방향 측정)
  // 출발 단쿠션 = 큐볼 가까운 단쿠션 (반대 측). 1쿠션이 fc 단쿠션.
  // 측정 코너 = (큐볼 장쿠션, 출발 단쿠션) = (큐볼.x 측, 큐볼.y 측 단쿠션)
  // 단순화: 큐볼이 진로 출발 단쿠션 위 (y=0 또는 L 측)에 있다고 가정.
  // 큐볼 → 1쿠션 단쿠션까지의 장축 거리 = 1쿠션 측 코너에서 큐볼까지의 거리.
  const sourceFromCornerY =
    fc.id === 'top' ? table.l - cueBall.rvw[1] : cueBall.rvw[1];
  const sourcePoint = sourceFromCornerY / POINT_M;

  // 1쿠션포인트: 1쿠션 점이 단쿠션의 1쿠션 측 코너 (큐볼 장쿠션 측)에서 거리 (단축).
  const fcX_FromCueLine = isLeft ? fc.point[0] : table.w - fc.point[0];
  const firstPoint = fcX_FromCueLine / POINT_M;

  // 3쿠션포인트: 적구가 도착 측 단쿠션 (fc 반대측)의 같은 코너 기준 단축 거리.
  const tgtX_FromCueLine = isLeft ? target.rvw[0] : table.w - target.rvw[0];
  const targetPoint = tgtX_FromCueLine / POINT_M;

  const requiredTips = sourcePoint + firstPoint + targetPoint;

  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(fc.point[0], fc.point[1], table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: `일출일몰 ${requiredTips.toFixed(1)}T (수${sourcePoint.toFixed(1)}+1쿠${firstPoint.toFixed(1)}+3쿠${targetPoint.toFixed(1)})`,
  };
}

// ════════════════════════════════════════════════════════════════
// Minus N (-15, -20) — F&H 변형. 1쿠션수 = 수구수 - 1적구수 - N
//   research.md 4.7.2 / 4.7.3
//   짧은 뒤돌리기·뱅크 보조. 진로는 F&H와 같은 단→장→단→장.
// ════════════════════════════════════════════════════════════════

function computeMinusN(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number,
  N: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: `-${N} (큐 방향 부적합)` };
  if (fc.id !== 'left' && fc.id !== 'right') {
    return { points: [], label: `-${N} (장쿠션 1뱅크 아님)` };
  }

  const isHead = cueBall.rvw[1] < table.l / 2;

  // 수구수: F&H와 동일 (1쿠션 측 코너 기준)
  const sourceFromCornerX =
    fc.id === 'left' ? cueBall.rvw[0] : table.w - cueBall.rvw[0];
  const sourceLabel = fhSourceLabel(sourceFromCornerX / POINT_M);

  // 1적구수: research.md 4.7.2 명시 "수구수와 같은 단쿠션 좌표". 즉 fhSourceLabel 사용.
  // (도착수 좌표 fhTargetLabel와 다름 — minus N은 1적구 위치도 수구수 체계로 측정.)
  const targetFromCornerX = fc.id === 'left' ? target.rvw[0] : table.w - target.rvw[0];
  const targetLabel = fhSourceLabel(targetFromCornerX / POINT_M);

  // 1쿠션수 = 수구수 - 1적구수 - N
  const firstCushionLabel = sourceLabel - targetLabel - N;
  if (firstCushionLabel < 0) {
    return { points: [], label: `-${N} (1쿠션수 음수, 부적합)` };
  }
  const firstCushionDiamond = fhCushionLabelToDiamond(firstCushionLabel);

  // 1쿠션 점 (F&H와 같은 측정)
  const firstCushionY_FromCorner = firstCushionDiamond * POINT_M;
  const firstCushionY = isHead
    ? firstCushionY_FromCorner
    : table.l - firstCushionY_FromCorner;
  const clampedY = Math.max(R, Math.min(table.l - R, firstCushionY));
  const firstCushionX = fc.id === 'left' ? R : table.w - R;

  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(firstCushionX, clampedY, table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: `-${N} ${Math.round(sourceLabel)}-${Math.round(targetLabel)}-${N}=${Math.round(firstCushionLabel)}`,
  };
}

// ════════════════════════════════════════════════════════════════
// Plus15 — Plus 변형. 3쿠션수 = 수구수 + 1쿠션수 + 15
//   research.md 4.7.4
//   도착 위치가 더 길어지는 보정.
// ════════════════════════════════════════════════════════════════

function computePlus15(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: '+15 (큐 방향 부적합)' };
  if (fc.id !== 'top' && fc.id !== 'bottom') {
    return { points: [], label: '+15 (단쿠션 1뱅크 아님)' };
  }

  const isLeft = cueBall.rvw[0] < table.w / 2;

  // Plus와 같은 측정. 도착에 +15 보정.
  const sourceFromCornerY =
    fc.id === 'top' ? cueBall.rvw[1] : table.l - cueBall.rvw[1];
  const sourceDiamond = sourceFromCornerY / POINT_M;
  const sourceLabel = sourceDiamond * 10;

  const targetFromCornerY =
    fc.id === 'top' ? target.rvw[1] : table.l - target.rvw[1];
  const targetDiamond = targetFromCornerY / POINT_M;
  const targetLabel = targetDiamond * 10;

  // 도착 = 수구 + 1쿠션 + 15. 1쿠션수 = 도착 - 수구 - 15.
  const firstCushionLabel = targetLabel - sourceLabel - 15;
  if (firstCushionLabel < 0) {
    return { points: [], label: '+15 (1쿠션수 음수, 부적합)' };
  }
  const firstCushionDiamond = firstCushionLabel / 10;

  const firstCushionX_FromCorner = firstCushionDiamond * POINT_M;
  const firstCushionX = isLeft
    ? firstCushionX_FromCorner
    : table.w - firstCushionX_FromCorner;
  const clampedX = Math.max(R, Math.min(table.w - R, firstCushionX));
  const firstCushionY = fc.id === 'top' ? R : table.l - R;

  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(clampedX, firstCushionY, table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: `+15 ${Math.round(sourceLabel)}+${Math.round(firstCushionLabel)}+15=${Math.round(targetLabel)}`,
  };
}

// ════════════════════════════════════════════════════════════════
// Reverse (역회전, 더블레일) — 1쿠션수 = 18 - (수구수 + 목적구수)
//   research.md 4.8
//   진로: 단→장→단 출발 측 회귀. 역회전이라 V0 강하게 (2.5~3.5).
// ════════════════════════════════════════════════════════════════

function computeReverse(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: 'Reverse (큐 방향 부적합)' };
  if (fc.id !== 'top' && fc.id !== 'bottom') {
    return { points: [], label: 'Reverse (단쿠션 1뱅크 아님)' };
  }

  const isLeft = cueBall.rvw[0] < table.w / 2;

  // 좌표 단위: 1포인트 = 10단위 (research.md 4.8.4 검증).
  // 예시: 수구 0(코너), 목적구 5(0.5p) → 1쿠션수 = 18-0-5 = 13 (장쿠션 1.3p).
  const sourceFromCornerY =
    fc.id === 'top' ? cueBall.rvw[1] : table.l - cueBall.rvw[1];
  const sourceLabel = (sourceFromCornerY / POINT_M) * 10;

  // 목적구수 = 적구가 출발 측 같은 장쿠션 (회귀형)에 있다고 가정. 1쿠션 측 코너에서 거리.
  const targetFromCornerY =
    fc.id === 'top' ? target.rvw[1] : table.l - target.rvw[1];
  const targetLabel = (targetFromCornerY / POINT_M) * 10;

  // 1쿠션수 = 18 - (수구수 + 목적구수). 한계 18.
  const firstCushionLabel = 18 - (sourceLabel + targetLabel);
  if (firstCushionLabel < 0 || firstCushionLabel > 50) {
    return { points: [], label: `Reverse (1쿠션수 ${firstCushionLabel.toFixed(1)} 범위 외)` };
  }
  // 1쿠션 다이아 = firstCushionLabel / 10 (1포인트 단위).
  const firstCushionDiamond = firstCushionLabel / 10;

  const firstCushionX_FromCorner = firstCushionDiamond * POINT_M;
  const firstCushionX = isLeft
    ? firstCushionX_FromCorner
    : table.w - firstCushionX_FromCorner;
  const clampedX = Math.max(R, Math.min(table.w - R, firstCushionX));
  const firstCushionY = fc.id === 'top' ? R : table.l - R;

  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(clampedX, firstCushionY, table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: `Reverse 18-(${sourceLabel.toFixed(1)}+${targetLabel.toFixed(1)})=${firstCushionLabel.toFixed(1)}`,
  };
}

// ════════════════════════════════════════════════════════════════
// 32 시스템 (장축 더블레일) — 코너 32 회귀
//   research.md 4.9
//   4쿠션 패턴. 두께 정면 + max스핀(4팁) + 강한 V0(4.0~4.5).
//   표준 좌표 표기 부족하므로 가이드 라인은 단순 폴리라인 + 표준값 라벨.
// ════════════════════════════════════════════════════════════════

function computeThirtyTwo(
  sys: EngineSystem,
  cueBall: EngineBall,
  target: EngineBall,
  cuePhi: number
): GuideLine {
  const table = sys.table;
  const R = cueBall.params.R;

  const fc = detectFirstCushion(cueBall, cuePhi, table, R);
  if (!fc) return { points: [], label: '32 (큐 방향 부적합)' };

  // 32 시스템은 4쿠션 패턴 + 강한 회전 + 빠른 속도. 정확한 가이드 좌표 표준 부족.
  // 폴리라인: 큐볼 → 1쿠션 → 적구 (단순 시각화). 라벨에 표준값 안내.
  const a = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], table);
  const b = engineToSvg(fc.point[0], fc.point[1], table);
  const c = engineToSvg(target.rvw[0], target.rvw[1], table);
  return {
    points: [a, b, c],
    label: '32 (정면+max스핀, V0 4.0~4.5, 4쿠션)',
  };
}
