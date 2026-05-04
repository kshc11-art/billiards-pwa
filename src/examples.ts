/**
 * examples.ts (v0.7.4)
 *
 * 영상 강좌 예제 (japong/당구박사 표준 형식)를 실제 시뮬레이션 가능한 형태로 변환.
 * 체스 예제처럼 클릭 시 공 위치 + 당점 + 두께가 시뮬에 로드됨.
 *
 * japong 좌표 체계:
 * - 8자리 = XXYY 형식
 * - XX (0~80): 장축 위치 (8개 다이아 × 10단위) — 단축 위 0포인트 기준
 * - YY (0~40): 단축 위치 (4개 다이아 × 10단위) — 장축 위 0포인트 기준
 * - 좌표 원점: 좌상단 코너 (japong 도면 기준)
 *
 * 엔진 좌표 체계:
 * - W = 1.27m (단축 폭)
 * - L = 2.54m (장축 길이)
 * - engineToSvg: ey(0~L 장축) → SVG x(가로), ex(0~W 단축) → SVG y(세로)
 */

// ════════════════════════════════════════════════════════════════
// japong layout 파싱
// ════════════════════════════════════════════════════════════════

export interface BallPosition {
  /** 엔진 ex (0~W=1.27m, 단축 좌표) */
  ex: number;
  /** 엔진 ey (0~L=2.54m, 장축 좌표) */
  ey: number;
}

export interface ParsedLayout {
  cueball: BallPosition;
  object1: BallPosition;
  object2: BallPosition;
}

const ENGINE_W = 1.27;
const ENGINE_L = 2.54;
const PUBLIC_LENGTH = 80; // japong 장축 0~80
const PUBLIC_WIDTH = 40; // japong 단축 0~40

/**
 * japong 한 공의 4자리 좌표 → 엔진 (ex, ey).
 * 4자리 XXYY 형식: XX = 장축 위치 (0~80), YY = 단축 위치 (0~40).
 */
function parseBallCode(code: string): BallPosition | null {
  if (code.length !== 4) return null;
  const xx = parseInt(code.slice(0, 2), 10);
  const yy = parseInt(code.slice(2, 4), 10);
  if (Number.isNaN(xx) || Number.isNaN(yy)) return null;
  if (xx < 0 || xx > PUBLIC_LENGTH || yy < 0 || yy > PUBLIC_WIDTH) return null;

  // japong 장축 0~80 (코너→코너) → 엔진 ey (0~L)
  // japong 단축 0~40 (양쪽 단축 끝 → 끝) → 엔진 ex (0~W)
  // 단, japong은 0이 코너이므로 큐볼 영역 마진을 위해 최소 0.05m 확보
  const ex = Math.max(0.05, Math.min(ENGINE_W - 0.05, (yy / PUBLIC_WIDTH) * ENGINE_W));
  const ey = Math.max(0.05, Math.min(ENGINE_L - 0.05, (xx / PUBLIC_LENGTH) * ENGINE_L));
  return { ex, ey };
}

/**
 * japong layout 코드 (예: '5830_6808_4733') → 3개 공 위치.
 * '_' 구분자로 3 그룹: 수구_1적구_2적구.
 */
export function parseJapongLayout(layout: string): ParsedLayout | null {
  const parts = layout.split('_');
  if (parts.length !== 3) return null;
  const cueball = parseBallCode(parts[0]);
  const object1 = parseBallCode(parts[1]);
  const object2 = parseBallCode(parts[2]);
  if (!cueball || !object1 || !object2) return null;
  return { cueball, object1, object2 };
}

// ════════════════════════════════════════════════════════════════
// 당점 (impact) 파싱
// ════════════════════════════════════════════════════════════════

export interface ParsedImpact {
  /** 시계 시각 (1~12, 0.5 단위 가능). 12 = 정상단, 6 = 정하단, 9 = 좌, 3 = 우. */
  clockHour: number;
  /** 팁수 (0~3). 0 = 무회전. */
  tipsCount: 0 | 1 | 2 | 3;
}

/**
 * 당점 문자열 → 시계 시각 + 팁수.
 * 예: '9시 30분 방향 3팁' → { clockHour: 9.5, tipsCount: 3 }
 *     '12시 무회전' → { clockHour: 12, tipsCount: 0 }
 *     '10시 2팁' → { clockHour: 10, tipsCount: 2 }
 *     '1시 30분 max팁' → { clockHour: 1.5, tipsCount: 3 }
 *     '3시 Max팁' → { clockHour: 3, tipsCount: 3 }
 */
export function parseImpact(impact: string): ParsedImpact | null {
  const lower = impact.toLowerCase();

  // 시계 시각 추출 — '9시 30분' 형태 우선, 없으면 'X시'
  let clockHour: number | null = null;
  const matchHourMin = impact.match(/(\d{1,2})\s*시\s*(\d{1,2})\s*분/);
  if (matchHourMin) {
    const h = parseInt(matchHourMin[1], 10);
    const m = parseInt(matchHourMin[2], 10);
    clockHour = h + m / 60;
  } else {
    const matchHour = impact.match(/(\d{1,2})\s*시/);
    if (matchHour) clockHour = parseInt(matchHour[1], 10);
  }
  if (clockHour === null) {
    // 단어로 표현된 경우
    if (lower.includes('상단') || lower.includes('탑')) clockHour = 12;
    else if (lower.includes('하단') || lower.includes('바텀')) clockHour = 6;
    else if (lower.includes('중앙') || lower.includes('무회전')) clockHour = 12; // 무회전이면 시각 무관
    else return null;
  }
  // 정규화 (0 → 12)
  if (clockHour === 0) clockHour = 12;
  if (clockHour > 12) clockHour = clockHour - 12;

  // 팁수 추출
  let tipsCount: 0 | 1 | 2 | 3 = 0;
  if (lower.includes('무회전') || lower.includes('0팁')) {
    tipsCount = 0;
  } else if (lower.includes('max') || lower.includes('맥스') || lower.includes('극대')) {
    tipsCount = 3;
  } else {
    const matchTips = impact.match(/(\d)\s*(?:\.\d+)?\s*팁/);
    if (matchTips) {
      const n = parseInt(matchTips[1], 10);
      tipsCount = (Math.min(3, Math.max(0, n)) as 0 | 1 | 2 | 3);
    }
  }

  return { clockHour, tipsCount };
}

/**
 * (clockHour, tipsCount) → 큐 a/b (-1~+1) 변환.
 * a = 횡 방향 (3시 = +1, 9시 = -1).
 * b = 종 방향 (12시 = +1, 6시 = -1).
 * 팁수 3 = 최대 (±0.6 정도가 안정적).
 */
export function impactToCueAB(impact: ParsedImpact): { a: number; b: number } {
  const { clockHour, tipsCount } = impact;
  if (tipsCount === 0) return { a: 0, b: 0 };
  // 시계 시각 → 라디안 (12시 = π/2 방향, 시계방향)
  const theta = (Math.PI / 2) - (clockHour / 12) * (2 * Math.PI);
  // 팁수 정규화: 공 반지름의 1/3씩 (1팁=R/3, 2팁=2R/3, 3팁=R 가장자리).
  // 정규화 -1~+1 범위, 1팁=0.333, 2팁=0.667, 3팁=1.0.
  const radius = tipsCount === 1 ? 1 / 3 : tipsCount === 2 ? 2 / 3 : 1.0;
  const a = Math.cos(theta) * radius;
  const b = Math.sin(theta) * radius;
  return { a, b };
}

// ════════════════════════════════════════════════════════════════
// 두께 (thickness) 파싱
// ════════════════════════════════════════════════════════════════

export interface ParsedThickness {
  /** 8분의 N 형식 (0~8, 4=정타). null이면 빈쿠션. */
  eighths: number | null;
}

/**
 * 두께 문자열 → 8분의 N.
 * 예: '제1적구의 1/2' → 4
 *     '제1적구의 오른쪽 1/4' → 2
 *     '제1적구의 4/5' → 6 (4/5 ≈ 6/8 근사)
 *     '— (빈쿠션)' → null
 *     '두께 자유' → null
 *     '제1적구 매우 얇게 (1/8)' → 1
 *     '제1적구의 6/8 ~ 7/8' → 6 (첫 값 우선)
 */
export function parseThickness(thickness: string): ParsedThickness {
  const lower = thickness.toLowerCase();
  if (
    lower.includes('빈쿠션') ||
    lower.startsWith('—') ||
    lower.startsWith('-') ||
    lower.includes('자유') ||
    lower.includes('근접') ||
    lower.includes('1적구 없음') ||
    lower.includes('1적구 안 맞')
  ) {
    return { eighths: null };
  }

  // 분수 추출 (최초 N/M 매칭)
  const matchFrac = thickness.match(/(\d+)\s*\/\s*(\d+)/);
  if (matchFrac) {
    const n = parseInt(matchFrac[1], 10);
    const m = parseInt(matchFrac[2], 10);
    if (m > 0) {
      // M=8이면 그대로, 아니면 8분의 N으로 환산
      let eighths: number;
      if (m === 8) eighths = n;
      else eighths = Math.round((n / m) * 8);
      return { eighths: Math.max(0, Math.min(8, eighths)) };
    }
  }

  // '8분의 N' 형식
  const matchKor = thickness.match(/8\s*분\s*의\s*(\d+)/);
  if (matchKor) {
    const n = parseInt(matchKor[1], 10);
    return { eighths: Math.max(0, Math.min(8, n)) };
  }

  // 단어 추정
  if (lower.includes('정타') || lower.includes('정면')) return { eighths: 8 };
  if (lower.includes('두껍게') || lower.includes('두꺼운')) return { eighths: 6 };
  if (lower.includes('얇게') || lower.includes('얇은')) return { eighths: 2 };

  return { eighths: null };
}

// ════════════════════════════════════════════════════════════════
// 두께 → cuePhi 옵셋 변환
// ════════════════════════════════════════════════════════════════

/**
 * 두께 (8분의 N) → cuePhi 옵셋 각도 (deg).
 * eighths=4 (정타·반두께)는 옵셋 0. eighths=8 (정타)도 0 (1적구 정중앙).
 * 반두께 8/8 → 정타. 4/8 → 1적구 한쪽 끝 (+/-30°).
 *
 * 두께 N/8에서 큐볼 진행 방향이 1적구 중심 대비 얼마나 빗각인지:
 * - 두께 8/8 (정타) = 1적구 중심 직진 (각도 0°)
 * - 두께 4/8 (반두께) = 1적구 한쪽 끝 (각도 ~30° 빗각)
 * - 두께 1/8 (매우 얇게) = 거의 스침 (각도 ~50° 빗각)
 *
 * side: 'left' = 왼쪽 두께 (큐볼 입장에서) — 음의 옵셋
 *       'right' = 오른쪽 — 양의 옵셋
 *
 * 단순 근사: thickness ratio = eighths / 8.
 * cos(angle) = thickness ratio + (1 - thickness ratio) * (R/D) 효과 무시 → 단순화
 * angle ≈ acos(eighths / 8) - acos(1) = acos(eighths/8)
 * 단, 1적구 정타 두께 보정: 8/8 정타이면 0, 4/8(반두께)이면 acos(0.5)=60° (실제 30°에 가깝지만)
 *
 * 실제 당구 룰: 두께 N/8 일때 큐볼 충돌 후 분리 각이 결정됨. 큐 phi는 두께 결정시 고정.
 * 분리각이 아니라 큐 진행 방향 옵셋으로 보정.
 *
 * 단순 룰: phiOffsetDeg ≈ (1 - eighths/8) * 30°
 * - 8/8 → 0° (정타)
 * - 4/8 → 15° (반두께)
 * - 0/8 → 30° (스침)
 * 부호: side에 따라 ±.
 */
/**
 * 두께 부호 결정 — phi 옵셋의 부호 (좌/우 빗각).
 * 실제 옵셋 크기는 store.applyExample에서 큐볼-1적구 거리 기반으로 계산.
 *
 * - sideHint 명시 → 그대로
 * - cueA < 0 (좌회전) → -1
 * - cueA > 0 또는 0 → +1
 */
export function thicknessSign(
  sideHint: 'left' | 'right' | null,
  cueA: number = 0,
): number {
  if (sideHint === 'left') return -1;
  if (sideHint === 'right') return 1;
  if (cueA < 0) return -1;
  return 1;
}

/**
 * 두께 → phi 옵셋 (deg) — 거리 무시 단순 매핑 (deprecated, 거리 의존 정확하지 않음).
 * 호환성을 위해 남겨두지만 store.applyExample은 거리 기반 계산 사용.
 */
export function thicknessToPhiOffset(
  thickness: ParsedThickness,
  sideHint: 'left' | 'right' | null,
  cueA: number = 0,
): number {
  if (thickness.eighths === null) return 0;
  // 단순 매핑 — 거리 1m 가정
  const e = thickness.eighths;
  const offsetMag = ((8 - e) / 8) * 3.5;
  return offsetMag * thicknessSign(sideHint, cueA);
}

/** 두께 문자열에서 좌·우 힌트 추출. */
export function parseThicknessSide(thickness: string): 'left' | 'right' | null {
  if (thickness.includes('왼쪽') || thickness.includes('left')) return 'left';
  if (thickness.includes('오른쪽') || thickness.includes('right')) return 'right';
  return null;
}

// ════════════════════════════════════════════════════════════════
// 스트로크 (stroke) → V0 변환
// ════════════════════════════════════════════════════════════════

/**
 * 스트로크 문자열 → 큐 속도 V0 (m/s).
 * 영상 강좌 표준:
 * - 0.5~2cm 잽 (끊어치기) → V0 = 1.5
 * - 5cm 빠른 잽 (근접 끌어치기) → V0 = 2.0
 * - 15cm 부드럽게 천천히 → V0 = 2.5
 * - 15-20cm 빠른 가속 → V0 = 3.0
 * - 20-25cm 빠른 가속 → V0 = 3.5
 * - 20cm+ 길고 부드러운 → V0 = 3.5
 * - 30cm+ 길고 빠른 가속 → V0 = 4.5
 * - 강하게 밀어치기 → V0 = 4.0
 * - 부드럽게 밀어치기 → V0 = 2.5
 */
export function parseStrokeV0(stroke: string): number {
  const lower = stroke.toLowerCase();
  // cm 표기 우선
  if (stroke.includes('30cm') || stroke.includes('30 cm')) return 4.5;
  if (stroke.includes('25cm') || stroke.includes('20-25cm') || stroke.includes('20~25cm')) return 3.5;
  if (stroke.includes('20cm') || stroke.includes('15-20cm') || stroke.includes('15~20cm')) return 3.0;
  if (stroke.includes('15cm')) return 2.5;
  if (stroke.includes('5cm')) return 2.0;
  if (stroke.includes('1cm') || stroke.includes('2cm') || lower.includes('잽')) return 1.5;
  // 강도 표현
  if (lower.includes('강하게') || lower.includes('강한')) return 4.0;
  if (lower.includes('부드럽게') || lower.includes('부드러운')) return 2.5;
  if (lower.includes('짧고 빠르게') || lower.includes('짧게')) return 2.5;
  if (lower.includes('끊어') || lower.includes('잽')) return 2.0;
  return 3.0; // 기본
}

// ════════════════════════════════════════════════════════════════
// 통합 파싱 — Example → 시뮬 적용 데이터
// ════════════════════════════════════════════════════════════════

export interface AppliedExample {
  /** 공 위치 (engine 좌표). null이면 layout 없음 → 위치 변경 X. */
  layout: ParsedLayout | null;
  /** 큐 a/b (-1~+1). */
  cueA: number;
  cueB: number;
  /** 큐 속도 V0 (m/s). */
  cueV0: number;
  /** phi 옵셋 (deg) — 거리 무시 단순 매핑 (deprecated). store에서 거리 기반 재계산. */
  phiOffsetDeg: number | null;
  /** 두께 부호 (-1: 좌측 빗각, +1: 우측 빗각). store에서 거리·두께로 옵셋 계산용. */
  thicknessSign: number;
  /** 파싱된 두께 메타 (게이지 추천 마커용). */
  thicknessEighths: number | null;
  /** 파싱된 당점 시계 시각. */
  clockHour: number | null;
  /** 파싱된 팁수. */
  tipsCount: 0 | 1 | 2 | 3 | null;
}

export interface ExampleInput {
  layout?: string;
  impact: string;
  thickness: string;
  stroke: string;
}

/**
 * 변형 옵션 — 한 japong 도면을 4가지 방향으로 적용 가능.
 *
 * - rotation: 화면 회전 (0/180만 의미. 90/270은 가로/세로 비율 문제로 무시).
 *             당구대는 점대칭이라 180°가 자연스러움.
 * - mirrorH: 좌우 미러 (수구가 반대편 단축에서 출발). 큐 a 부호 반전.
 * - mirrorV: 상하 미러 (수구가 반대편 장축에서 출발). 큐 b 부호 반전.
 */
export interface ExampleVariant {
  /** 화면 회전 (0/90/180/270). 적용은 0/180만. */
  rotation?: 0 | 90 | 180 | 270;
  /** 좌우 미러 (단축 반전). */
  mirrorH?: boolean;
  /** 상하 미러 (장축 반전). */
  mirrorV?: boolean;
}

/**
 * 좌표·큐 변환 — rotation/mirror 적용.
 * 엔진 좌표 (ex 0~W=1.27, ey 0~L=2.54).
 * - rotation 180: 점대칭 (ex → W-ex, ey → L-ey)
 * - mirrorH: 단축 반전 (ex → W-ex), 큐 a 부호 반전
 * - mirrorV: 장축 반전 (ey → L-ey), 큐 b 부호 반전
 */
function transformLayout(
  layout: ParsedLayout,
  variant: ExampleVariant,
): ParsedLayout {
  const tx = (p: BallPosition): BallPosition => {
    let { ex, ey } = p;
    // 회전 180° = 점대칭
    if (variant.rotation === 180) {
      ex = ENGINE_W - ex;
      ey = ENGINE_L - ey;
    }
    // 좌우 미러 (단축 반전)
    if (variant.mirrorH) ex = ENGINE_W - ex;
    // 상하 미러 (장축 반전)
    if (variant.mirrorV) ey = ENGINE_L - ey;
    return { ex, ey };
  };
  return {
    cueball: tx(layout.cueball),
    object1: tx(layout.object1),
    object2: tx(layout.object2),
  };
}

/** 큐 a/b/phi 옵셋을 회전·미러에 맞춰 변환. */
function transformCue(
  cueA: number,
  cueB: number,
  phiOffsetDeg: number | null,
  variant: ExampleVariant,
): { cueA: number; cueB: number; phiOffsetDeg: number | null } {
  let a = cueA;
  let b = cueB;
  let phiOff = phiOffsetDeg;

  // 회전 180° = 양 축 모두 반전
  if (variant.rotation === 180) {
    a = -a;
    b = -b;
    if (phiOff !== null) phiOff = -phiOff;
  }
  // 좌우 미러: a 반전 (회전 방향 반대), phiOffset 반전 (빗각 반대)
  if (variant.mirrorH) {
    a = -a;
    if (phiOff !== null) phiOff = -phiOff;
  }
  // 상하 미러: b 반전 (상하), phiOffset 그대로 (좌우 빗각이라)
  if (variant.mirrorV) {
    b = -b;
  }
  return { cueA: a, cueB: b, phiOffsetDeg: phiOff };
}

/**
 * 시계 시각을 회전·미러에 맞춰 변환 (추천 마커용).
 * 12시 = top, 3시 = right, 6시 = bottom, 9시 = left.
 */
function transformClock(clockHour: number | null, variant: ExampleVariant): number | null {
  if (clockHour === null) return null;
  let h = clockHour;
  // 회전 180° = 시계 +6 (점대칭)
  if (variant.rotation === 180) {
    h = h + 6;
  }
  // 좌우 미러: 시계 좌우 반전 — 12-h (12시 그대로, 3↔9, 6시 그대로)
  if (variant.mirrorH) {
    h = (12 - h + 12) % 12;
    if (h === 0) h = 12;
  }
  // 상하 미러: 시계 상하 반전 — 6 - (h - 12) = 6 - h + 12 = 18 - h, 단 모듈로 12
  if (variant.mirrorV) {
    h = (6 - h + 12) % 12;
    if (h === 0) h = 12;
  }
  // 정규화 1~12
  while (h > 12) h -= 12;
  while (h <= 0) h += 12;
  return h;
}

/**
 * Example 객체 → 시뮬 적용 데이터 (변형 옵션 포함).
 */
export function applyExampleToCue(
  ex: ExampleInput,
  variant: ExampleVariant = {},
): AppliedExample {
  const baseLayout = ex.layout ? parseJapongLayout(ex.layout) : null;
  const impact = parseImpact(ex.impact);
  const thickness = parseThickness(ex.thickness);
  const sideHint = parseThicknessSide(ex.thickness);

  const baseAB = impact ? impactToCueAB(impact) : { a: 0, b: 0 };
  const basePhi = thickness.eighths !== null
    ? thicknessToPhiOffset(thickness, sideHint, baseAB.a)
    : null;
  const baseSign = thicknessSign(sideHint, baseAB.a);

  // 변형 적용
  const layout = baseLayout ? transformLayout(baseLayout, variant) : null;
  const { cueA, cueB, phiOffsetDeg } = transformCue(baseAB.a, baseAB.b, basePhi, variant);
  const clockHour = transformClock(impact?.clockHour ?? null, variant);

  // 두께 부호도 좌우 미러·회전 시 반전
  let sign = baseSign;
  if (variant.rotation === 180) sign = -sign;
  if (variant.mirrorH) sign = -sign;
  // mirrorV는 두께 부호에 영향 X

  return {
    layout,
    cueA,
    cueB,
    cueV0: parseStrokeV0(ex.stroke),
    phiOffsetDeg,
    thicknessSign: sign,
    thicknessEighths: thickness.eighths,
    clockHour,
    tipsCount: impact?.tipsCount ?? null,
  };
}
