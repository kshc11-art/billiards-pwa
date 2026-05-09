import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  createKoreanThreeCushionSystem,
  createFourBallSystem,
  resolveStickBall,
  simulate,
  continuize,
  STATIONARY,
  type EngineSystem,
  type EngineEvent,
  type Game,
  computePathSvg,
  engineToSvg,
  svgToEngine,
  svgAngleToEnginePhi,
} from './utils.ts';
import { drills, drillToPositions, getDrillById } from './drills.ts';
import type { SystemGuide } from './systems.ts';
import type { SystemApplicationExample } from './systemContent.ts';
import {
  applyExampleToCue,
  parseImpact,
  parseThickness,
  parseThicknessSide,
  impactToCueAB,
  thicknessSign,
  type ExampleInput,
  type ExampleVariant,
} from './examples.ts';
import { judgeThreeCushion, judgeFourBall, type ScoreVerdict, type FourBallMode } from './scoring.ts';

// ════════════════════════════════════════════════════════════════
// 타입
// ════════════════════════════════════════════════════════════════

export type { SystemGuide };
export type AnalysisLayer =
  | 'separation' // 첫 충돌 후 두 공의 분리각 화살표
  | 'angle30' // 30°/90° 룰 가이드 부채꼴
  | 'distance' // 진로 위 1포인트(317.5mm) 간격 거리 마커
  | 'kiss' // 키스 (재충돌) 위치 X 마커
  | 'noenglish' // 무회전 비교 시뮬 (점선 진로)
  | 'impact' // 모든 충돌점 (cushion + ball) 위치 원 마커
  | 'multipath'; // 다중 당점 비교 (12·1·2·9시 동시 시뮬, 4개 진로)

export interface CueInput {
  /** 큐 속도 (m/s). InfoBox STROKE 게이지에 매핑. */
  V0: number;
  /** 진행 방향 (deg, +x축 기준 반시계). 큐볼 → 적구 방향. */
  phi: number;
  /**
   * phi 자동 정렬 여부.
   *   true  : 공 위치 변경 시 phi가 큐볼 → 첫 적구 방향으로 자동 재계산 (default)
   *   false : 사용자가 큐대 회전 드래그로 phi 직접 설정. 공 위치 변경해도 phi 유지
   * setGame · loadDrill · resetSystem 시 true로 복귀.
   */
  phiAuto: boolean;
  /** 마세각 (deg). 보통 0. */
  theta: number;
  /** 사이드 타점 (-1 ~ +1, +가 3시 = UI 직관). */
  a: number;
  /** 상하 타점 (-1 ~ +1, +가 위). */
  b: number;
}

export interface InfoBoxState {
  /** 가로 모드 SVG 좌표 (0~812, 0~375). 박스 좌상단. */
  posLandscape: { x: number; y: number };
  /** 세로 모드 SVG 좌표 (0~375, 0~812). 박스 좌상단. phone 세로 시점에서 정상. */
  posPortrait: { x: number; y: number };
  /** 비활성 시 opacity (0.10 ~ 0.70). */
  opacityIdle: number;
  /** 현재 활성 상태 (탭/드래그/큐대 조작 중). */
  isActive: boolean;
  /** 자동 활성 전환 ON/OFF. */
  autoActive: boolean;
  /** 예제 변형 — 좌우 미러 (수구 반대편 단축). */
  exampleMirrorH: boolean;
  /** 예제 변형 — 상하 미러 (수구 반대편 장축). */
  exampleMirrorV: boolean;
}

export type ScreenRotation = 0 | 90 | 180 | 270;

export interface MenuState {
  system: SystemGuide;
  /** 선택된 기술 ID (학습 자료 보기용 — null이면 미선택). */
  techniqueId: string | null;
  drillId: string | null;
  /** 분석 레이어 (직렬화 위해 array, Set 미사용). */
  layers: AnalysisLayer[];
  /** 화면 회전 (가로 모드에서 머리 단쿠션 좌·우 토글). 0° default. */
  rotation: ScreenRotation;
  /** 메뉴 패널 열림 여부. */
  open: boolean;
  /** 학습 패널 열림 여부 (LearningPanel — 시스템·기술 학습 자료). */
  learnOpen: boolean;
}

export interface Stats {
  attempts: number;
  success: number;
  /** 최근 N (HISTORY_LIMIT). */
  history: ('success' | 'fail')[];
  /** 시뮬 후 verdict 따라 자동 통계 갱신 (성공 = scored). */
  autoRecord: boolean;
  /**
   * 목표 점수 (3쿠션·4구 공통). 사용자가 Menu에서 설정.
   * 4구 AMATEUR + success >= handicap-1 → 매치포인트 → 마무리 3쿠션 의무.
   */
  handicap: number;
}

export interface MultiPath {
  /** 라벨 (시계 표기). */
  label: string;
  /** SVG polyline points. */
  pathSvg: string;
  /** 색상 (UI 구분용). */
  color: string;
}

export interface SimResult {
  /** 큐볼 SVG polyline points 문자열. */
  pathSvg: string;
  /** 무회전(a=b=0) 비교용 별도 시뮬 진로 (분석 레이어 'noenglish'에서 사용). */
  noenglishPathSvg: string;
  /** 다중 당점 비교 진로 (분석 레이어 'multipath' 활성 시 채움). */
  multipath: MultiPath[];
  /** 모든 공의 frame 배열 (60fps). 애니메이션 재생용. */
  frames: Record<string, { rvw: Float64Array; state: number; t: number }[]>;
  events: EngineEvent[];
  /** 자동 점수 판정 결과 (3쿠션 UMB · 4구 KBF/AMATEUR). */
  verdict: ScoreVerdict;
  /**
   * 미리보기 시뮬 여부 — true면 사용자가 STRIKE 안 누르고 자동 계산된 결과.
   * Table.tsx에서 진로 polyline을 흐린 점선으로 표시 (정답 노출 방지).
   * 분석 레이어 (분리각, 충돌점, 키스 등)은 preview에서도 정상 표시 — 학습 보조용.
   */
  preview: boolean;
}

// ════════════════════════════════════════════════════════════════
// 상수
// ════════════════════════════════════════════════════════════════

const HISTORY_LIMIT = 20;

const DEFAULT_CUE: CueInput = {
  V0: 3.5,
  phi: 90,
  phiAuto: true,
  theta: 0,
  a: 0,
  b: 0,
};

const DEFAULT_INFOBOX: InfoBoxState = {
  // v0.15에서 확정: 가로 모드 (525, 28), 세로 모드 (87.5, 600)
  posLandscape: { x: 509, y: 28 },
  posPortrait: { x: 87.5, y: 600 },
  opacityIdle: 0.45,
  isActive: false,
  autoActive: true,
  exampleMirrorH: false,
  exampleMirrorV: false,
};

const DEFAULT_MENU: MenuState = {
  system: 'none',
  techniqueId: null,
  drillId: null,
  layers: [],
  rotation: 0,
  open: false,
  learnOpen: false,
};

const DEFAULT_STATS: Stats = {
  attempts: 0,
  success: 0,
  history: [],
  autoRecord: false,
  handicap: 30, // 입문 4구 표준 (research.md 8.6)
};

function createInitialSystem(game: Game): EngineSystem {
  return game === 'three_cushion' ? createKoreanThreeCushionSystem() : createFourBallSystem();
}

/**
 * 큐볼 → 첫 적구 방향에서 phi(엔진 deg) 계산.
 * 적구가 없거나 큐볼과 같은 위치면 fallbackPhi 그대로 반환.
 */
function recalculatePhi(sys: EngineSystem, fallbackPhi: number): number {
  const cueBall = sys.balls[sys.cueBallId];
  if (!cueBall) return fallbackPhi;
  // 가장 가까운 적구 찾기 (yellow 강제 X — 사용자 의도된 1적구)
  let nearestId: string | null = null;
  let nearestDistSq = Infinity;
  const cx = cueBall.rvw[0];
  const cy = cueBall.rvw[1];
  for (const [id, ball] of Object.entries(sys.balls)) {
    if (id === sys.cueBallId) continue;
    const dx = ball.rvw[0] - cx;
    const dy = ball.rvw[1] - cy;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestId = id;
    }
  }
  if (!nearestId) return fallbackPhi;
  const target = sys.balls[nearestId];
  const cueSvg = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], sys.table);
  const tgtSvg = engineToSvg(target.rvw[0], target.rvw[1], sys.table);
  return svgAngleToEnginePhi(cueSvg, tgtSvg);
}

// ════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════

export interface AppState {
  // 게임
  game: Game;
  /** 4구 룰 모드 (KBF 공식 / AMATEUR 동네). 3쿠션은 항상 UMB. */
  fourBallMode: FourBallMode;
  sys: EngineSystem;
  /** sys 내용이 mutable하게 변경될 때마다 +1 → 컴포넌트 리렌더 트리거. */
  simRev: number;

  // 입력
  cue: CueInput;

  // 결과
  result: SimResult | null;
  /** 애니메이션 frame index (-1 = 정지/시작 위치, 0~N = 시뮬 frame). 큐대 숨김 트리거. */
  animFrame: number;

  /** 마지막 적용된 시스템 응용 예시 ID — 다이아 라벨 강조용. */
  activeApplicationExampleId: string | null;

  /**
   * 마지막 적용된 영상 강좌 예제 — 추천값 시각 마커용.
   * applyExample 시 저장. resetSystem/setSystem/setTechnique 시 null.
   * 사용자가 게이지 변경해도 추천 마커는 그대로 → 차이 한눈에 비교.
   */
  activeExample: {
    cueA: number;
    cueB: number;
    cueV0: number;
    phiOffsetDeg: number | null;
    /** 추천 두께 — 8분의 N (null이면 빈쿠션). */
    thicknessEighths: number | null;
    /** 시계 시각 (1~12, 0.5 단위). */
    clockHour: number | null;
    /** 팁수 (0~3). */
    tipsCount: 0 | 1 | 2 | 3 | null;
  } | null;

  // UI
  infobox: InfoBoxState;
  menu: MenuState;
  stats: Stats;

  // ── Actions ───────────────────────────────────────
  setGame: (game: Game) => void;
  setFourBallMode: (mode: FourBallMode) => void;
  loadDrill: (drillId: string) => void;
  resetSystem: () => void;

  setBallPos: (id: string, ex: number, ey: number) => void;
  setCue: (partial: Partial<CueInput>) => void;

  /** 시스템 응용 예시 자동 적용 — 공 3개 셋팅 + 큐 a/b/V0 + phi 자동 + 시뮬 자동 실행. */
  applySystemExample: (example: SystemApplicationExample) => void;

  /** 영상 강좌 예제 (japong 형식) 자동 적용 — 공 위치 + 당점 + 두께 + 스트로크. */
  applyExample: (example: { layout?: string; impact: string; thickness: string; stroke: string }) => void;

  runSimulation: (opts?: { preview?: boolean }) => void;
  /** 시뮬 최종 프레임의 공 위치를 sys에 반영 (연속 플레이). */
  /** 시뮬 최종 프레임의 공 위치를 sys에 반영 (연속 플레이). 캡처된 데이터 사용. */
  applyFinalPositions: (capturedFrames?: Record<string, {rvw: Float64Array}[]>, capturedVerdict?: ScoreVerdict) => void;
  /** 공 위치를 펠트 내 랜덤으로 재배치 (겹침 방지). */
  randomizeBalls: () => void;
  clearResult: () => void;
  setAnimFrame: (frame: number) => void;

  recordAttempt: (success: boolean) => void;
  resetStats: () => void;
  setAutoRecord: (auto: boolean) => void;
  setHandicap: (handicap: number) => void;

  // InfoBox
  setInfoBoxPos: (pos: { x: number; y: number }, isPortrait: boolean) => void;
  setInfoBoxOpacity: (opacity: number) => void;
  setInfoBoxActive: (active: boolean) => void;
  setAutoActive: (auto: boolean) => void;
  /** 예제 좌우 미러 토글. */
  toggleExampleMirrorH: () => void;
  /** 예제 상하 미러 토글. */
  toggleExampleMirrorV: () => void;

  // Menu
  setSystem: (system: SystemGuide) => void;
  setTechnique: (techniqueId: string | null) => void;
  toggleLayer: (layer: AnalysisLayer) => void;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  /** 학습 패널 열림 토글. */
  setLearnOpen: (open: boolean) => void;
  toggleLearn: () => void;
  setDrill: (drillId: string | null) => void;
  setRotation: (rotation: ScreenRotation) => void;
}

// ════════════════════════════════════════════════════════════════
// Store
// ════════════════════════════════════════════════════════════════

/**
 * 자동 시뮬 디바운스 — 사용자가 공 드래그·큐대 회전 시 멈춘 후 시뮬.
 * 분석 레이어가 치기 전에도 보이도록.
 * 60ms 디바운스 (드래그 중 매번 시뮬 X, 멈추면 즉시 시뮬).
 */
let autoSimTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoSim(get: () => AppState) {
  if (autoSimTimer) clearTimeout(autoSimTimer);
  autoSimTimer = setTimeout(() => {
    autoSimTimer = null;
    try {
      get().runSimulation({ preview: true });
    } catch {
      /* 시뮬 실패 시 무시 */
    }
  }, 60);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 초기값
      game: 'three_cushion',
      fourBallMode: 'amateur',
      sys: createInitialSystem('three_cushion'),
      simRev: 0,
      cue: DEFAULT_CUE,
      result: null,
      animFrame: -1,
      activeApplicationExampleId: null,
      activeExample: null,
      infobox: DEFAULT_INFOBOX,
      menu: DEFAULT_MENU,
      stats: DEFAULT_STATS,

      // ── 게임/시스템 ─────────────────────────────────
      setFourBallMode: (mode) => set({ fourBallMode: mode }),

      setGame: (game) => {
        const sys = createInitialSystem(game);
        const phi = recalculatePhi(sys, get().cue.phi);
        set({
          game,
          sys,
          simRev: get().simRev + 1,
          result: null,
          cue: { ...get().cue, phi, phiAuto: true },
        });
      },

      loadDrill: (drillId) => {
        const drill = getDrillById(drillId);
        if (!drill) {
          console.warn('[store] drill not found:', drillId);
          return;
        }
        const sys: EngineSystem =
          drill.game === 'three_cushion'
            ? createKoreanThreeCushionSystem(drillToPositions(drill))
            : createFourBallSystem(drillToPositions(drill));
        const phi = recalculatePhi(sys, get().cue.phi);
        set({
          game: drill.game,
          sys,
          simRev: get().simRev + 1,
          result: null,
          cue: { ...get().cue, phi, phiAuto: true },
          menu: {
            ...get().menu,
            drillId,
            system: drill.recommendedSystem ?? get().menu.system,
          },
        });
      },

      resetSystem: () => {
        const sys = createInitialSystem(get().game);
        const phi = recalculatePhi(sys, get().cue.phi);
        set({
          sys,
          simRev: get().simRev + 1,
          result: null,
          cue: { ...get().cue, phi, phiAuto: true },
          activeExample: null,
        });
      },

      // ── 공·큐 입력 ──────────────────────────────────
      setBallPos: (id, ex, ey) => {
        const { sys, cue } = get();
        const ball = sys.balls[id];
        if (!ball) return;
        // 경계 클램프: 공이 쿠션 안쪽에만 위치하도록 (R + 1mm 여유)
        const R = ball.params.R;
        const margin = R + 0.001;
        const clampedEx = Math.max(margin, Math.min(sys.table.w - margin, ex));
        const clampedEy = Math.max(margin, Math.min(sys.table.l - margin, ey));
        // mutable update: rvw 직접 갱신 + 운동 상태 정지로 초기화
        ball.rvw[0] = clampedEx;
        ball.rvw[1] = clampedEy;
        ball.rvw[3] = ball.rvw[4] = ball.rvw[5] = 0; // v=0
        ball.rvw[6] = ball.rvw[7] = ball.rvw[8] = 0; // ω=0
        ball.state = STATIONARY;
        // phi: phiAuto일 때만 자동 재계산. 사용자가 큐대 회전했으면 phi 유지.
        const phi = cue.phiAuto ? recalculatePhi(sys, cue.phi) : cue.phi;
        set({
          simRev: get().simRev + 1,
          result: null,
          activeApplicationExampleId: null, // 사용자가 공 옮기면 강조 해제
          // 사용자가 공 직접 옮겨도 추천 마커는 유지 — 학습 비교용
          cue: { ...cue, phi },
        });
        scheduleAutoSim(get);
      },

      setCue: (partial) => {
        set({ cue: { ...get().cue, ...partial } });
        scheduleAutoSim(get);
      },

      // ── 시스템 응용 예시 자동 배치 ────────────────────
      applySystemExample: (example) => {
        const { sys } = get();
        // SVG → Engine 변환
        const [cueEx, cueEy] = svgToEngine(
          example.positions.cue[0],
          example.positions.cue[1],
          sys.table,
        );
        const [yEx, yEy] = svgToEngine(
          example.positions.yellow[0],
          example.positions.yellow[1],
          sys.table,
        );
        const [rEx, rEy] = svgToEngine(
          example.positions.red[0],
          example.positions.red[1],
          sys.table,
        );

        // 공 위치 직접 mutation (rvw + state 초기화)
        const setPos = (id: string, ex: number, ey: number) => {
          const ball = sys.balls[id];
          if (!ball) return;
          ball.rvw[0] = ex;
          ball.rvw[1] = ey;
          ball.rvw[3] = ball.rvw[4] = ball.rvw[5] = 0;
          ball.rvw[6] = ball.rvw[7] = ball.rvw[8] = 0;
          ball.state = STATIONARY;
        };
        setPos('white', cueEx, cueEy);
        setPos('yellow', yEx, yEy);
        setPos('red', rEx, rEy);

        // 큐 a/b 결정: impact 라벨 우선, 없으면 cueA/B 직접 사용 (deprecated)
        let cueA: number;
        let cueB: number;
        if (example.impact) {
          const parsed = parseImpact(example.impact);
          if (parsed) {
            const ab = impactToCueAB(parsed);
            cueA = ab.a;
            cueB = ab.b;
          } else {
            cueA = example.cueA ?? 0;
            cueB = example.cueB ?? 0;
          }
        } else {
          cueA = example.cueA ?? 0;
          cueB = example.cueB ?? 0;
        }

        // phi 재계산 (큐볼 → 가장 가까운 적구 라인 + 두께 옵셋)
        // yellow 강제 X — 응용 예시 데이터의 cue·yellow·red 위치 따라 가장 가까운 적구가 1적구
        const cueBall = sys.balls['white'];
        let nearestTarget: typeof cueBall = null as unknown as typeof cueBall;
        if (cueBall) {
          let nearestDistSq = Infinity;
          for (const [id, ball] of Object.entries(sys.balls)) {
            if (id === 'white') continue;
            const dx = ball.rvw[0] - cueBall.rvw[0];
            const dy = ball.rvw[1] - cueBall.rvw[1];
            const dSq = dx * dx + dy * dy;
            if (dSq < nearestDistSq) {
              nearestDistSq = dSq;
              nearestTarget = ball;
            }
          }
        }
        let phi = get().cue.phi;
        if (cueBall && nearestTarget) {
          const cueSvg = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], sys.table);
          const tgtSvg = engineToSvg(nearestTarget.rvw[0], nearestTarget.rvw[1], sys.table);
          phi = svgAngleToEnginePhi(cueSvg, tgtSvg);

          // 두께 옵셋 결정 — thickness 라벨 우선, 없으면 cuePhiOffsetDeg (deprecated)
          if (example.thickness !== undefined) {
            const t = parseThickness(example.thickness);
            const isBank = example.thickness.includes('빈쿠션') || example.thickness.includes('—');
            if (t.eighths !== null && t.eighths < 8) {
              // 거리 기반 정확 계산 — 큐대가 적구 중심에서 (8-e)/8 * 2R 옆 향함
              const dx = nearestTarget.rvw[0] - cueBall.rvw[0];
              const dy = nearestTarget.rvw[1] - cueBall.rvw[1];
              const distance = Math.sqrt(dx * dx + dy * dy);
              const R = 0.02865;
              const offsetDist = ((8 - t.eighths) / 8) * 2 * R;
              const offsetRad = Math.atan2(offsetDist, Math.max(distance, 0.05));
              const offsetDeg = (offsetRad * 180) / Math.PI;
              const sideHint = parseThicknessSide(example.thickness);
              const sign = thicknessSign(sideHint, cueA);
              phi += offsetDeg * sign;
              phi = ((((phi + 180) % 360) + 360) % 360) - 180;
            } else if (isBank) {
              // 빈쿠션 — 옵셋 X. 1적구 향한 phi 그대로 직진 (1적구는 라인 옆에 있을 뿐).
              // 두께 옵셋 추가하면 의도된 진로 망가짐 (예: 4→2 빈쿠션은 4포인트 직진).
            }
          } else if (example.cuePhiOffsetDeg !== undefined) {
            // deprecated 경로
            phi += example.cuePhiOffsetDeg;
            phi = ((((phi + 180) % 360) + 360) % 360) - 180;
          }
        }

        // 응용 예시의 두께 인덱스 추출 (activeExample 표시용)
        let exampleThicknessEighths: number | null = null;
        let exampleClockHour: number | null = null;
        let exampleTipsCount: 0 | 1 | 2 | 3 | null = null;
        if (example.thickness !== undefined) {
          const t = parseThickness(example.thickness);
          exampleThicknessEighths = t.eighths;
        }
        if (example.impact !== undefined) {
          const parsed = parseImpact(example.impact);
          if (parsed) {
            exampleClockHour = parsed.clockHour;
            exampleTipsCount = parsed.tipsCount;
          }
        }

        set({
          simRev: get().simRev + 1,
          result: null,
          activeApplicationExampleId: example.id,
          cue: {
            ...get().cue,
            a: cueA,
            b: cueB,
            V0: example.cueV0,
            phi,
            phiAuto: true,
          },
          // 응용 예시 적용 시 활성 마커도 갱신 → 권장 ring이 응용 예시 위치로
          activeExample: {
            cueA,
            cueB,
            cueV0: example.cueV0,
            phiOffsetDeg: null,
            thicknessEighths: exampleThicknessEighths,
            clockHour: exampleClockHour,
            tipsCount: exampleTipsCount,
          },
        });

        // 자동 시뮬은 preview 모드 — 진로 즉시 표시 (학습용), 공은 안 움직임.
        // 사용자가 STRIKE 버튼 눌러야 실제 발사 + 애니메이션.
        scheduleAutoSim(get);
      },

      // ── 영상 강좌 예제 자동 적용 ────────────────────
      applyExample: (exampleInput: ExampleInput) => {
        const { sys, menu, infobox } = get();
        // 변형 옵션 — 현재 화면 회전 + 사용자 미러 토글 적용
        const variant: ExampleVariant = {
          rotation: menu.rotation,
          mirrorH: infobox.exampleMirrorH,
          mirrorV: infobox.exampleMirrorV,
        };
        const applied = applyExampleToCue(exampleInput, variant);

        // 공 위치 적용 (layout 있을 때만)
        const setPos = (id: string, ex: number, ey: number) => {
          const ball = sys.balls[id];
          if (!ball) return;
          ball.rvw[0] = ex;
          ball.rvw[1] = ey;
          ball.rvw[3] = ball.rvw[4] = ball.rvw[5] = 0;
          ball.rvw[6] = ball.rvw[7] = ball.rvw[8] = 0;
          ball.state = STATIONARY;
        };
        if (applied.layout) {
          // 3쿠션은 white(수구) / yellow(1적구) / red(2적구) 매핑
          // 4구는 white / red / red2 — 게임 모드에 따라 다름
          const ids = Object.keys(sys.balls);
          const cueId = sys.cueBallId;
          const otherIds = ids.filter((id) => id !== cueId);
          // 첫 번째 다른 공 = 1적구, 두 번째 = 2적구
          setPos(cueId, applied.layout.cueball.ex, applied.layout.cueball.ey);
          if (otherIds[0]) setPos(otherIds[0], applied.layout.object1.ex, applied.layout.object1.ey);
          if (otherIds[1]) setPos(otherIds[1], applied.layout.object2.ex, applied.layout.object2.ey);
        }

        // 큐 a/b/V0 적용 + phi 자동 (가장 가까운 적구 방향)
        const cueBall = sys.balls[sys.cueBallId];
        let nearestObj1: typeof cueBall = null as unknown as typeof cueBall;
        if (cueBall) {
          let nearestDistSq = Infinity;
          for (const [id, ball] of Object.entries(sys.balls)) {
            if (id === sys.cueBallId) continue;
            const dx = ball.rvw[0] - cueBall.rvw[0];
            const dy = ball.rvw[1] - cueBall.rvw[1];
            const dSq = dx * dx + dy * dy;
            if (dSq < nearestDistSq) {
              nearestDistSq = dSq;
              nearestObj1 = ball;
            }
          }
        }
        let phi = get().cue.phi;
        if (cueBall && nearestObj1) {
          const cueSvg = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], sys.table);
          const obj1Svg = engineToSvg(nearestObj1.rvw[0], nearestObj1.rvw[1], sys.table);
          phi = svgAngleToEnginePhi(cueSvg, obj1Svg);
          // 두께 옵셋 — 거리 기반 정확 계산
          const thicknessStr = exampleInput.thickness;
          const isBank = thicknessStr.includes('빈쿠션') || thicknessStr.includes('—');
          if (applied.thicknessEighths !== null && applied.thicknessEighths < 8) {
            const dx = nearestObj1.rvw[0] - cueBall.rvw[0];
            const dy = nearestObj1.rvw[1] - cueBall.rvw[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            const R = 0.02865;
            const e = applied.thicknessEighths;
            const offsetDist = ((8 - e) / 8) * 2 * R;
            const offsetRad = Math.atan2(offsetDist, Math.max(distance, 0.05));
            const offsetDeg = (offsetRad * 180) / Math.PI;
            phi += offsetDeg * applied.thicknessSign;
            phi = ((((phi + 180) % 360) + 360) % 360) - 180;
          } else if (isBank) {
            // 빈쿠션 — 옵셋 X. 1적구 향한 phi 그대로 직진.
            // (사용자 의도된 진로는 1적구 라인이 아닌 1쿠션 → 2쿠션 → 3쿠션 진로)
          }
        }

        set({
          simRev: get().simRev + 1,
          result: null,
          cue: {
            ...get().cue,
            a: applied.cueA,
            b: applied.cueB,
            V0: applied.cueV0,
            phi,
            phiAuto: true,
          },
          activeExample: {
            cueA: applied.cueA,
            cueB: applied.cueB,
            cueV0: applied.cueV0,
            phiOffsetDeg: applied.phiOffsetDeg,
            thicknessEighths: applied.thicknessEighths,
            clockHour: applied.clockHour,
            tipsCount: applied.tipsCount,
          },
        });

        // 자동 시뮬 preview — 진로 즉시 표시 (학습용), 발사는 STRIKE.
        scheduleAutoSim(get);
      },

      // ── 시뮬 ────────────────────────────────────────
      runSimulation: (opts?: { preview?: boolean }) => {
        const isPreview = opts?.preview === true;
        const { sys, cue } = get();
        // sys.copy()로 시뮬 전용 복사본 (원본 위치는 보존)
        const simSys = sys.copy();
        const cueBall = simSys.balls[simSys.cueBallId];
        if (!cueBall) {
          console.warn('[store] cue ball missing');
          return;
        }
        try {
          const [rvw, state] = resolveStickBall(
            cueBall.rvw,
            { ...cue, table: simSys.table },
            cueBall.params.m,
            cueBall.params.R
          );
          cueBall.rvw = rvw;
          cueBall.state = state;

          simulate(simSys);
          const frames = continuize(simSys, 1 / 60);

          const cueBallFrames = frames[simSys.cueBallId];
          const pathSvg = computePathSvg(cueBallFrames, simSys.table);

          // 무회전 비교 시뮬 (분석 레이어 'noenglish'용)
          let noenglishPathSvg = '';
          try {
            const neSys = sys.copy();
            const neCue = neSys.balls[neSys.cueBallId];
            if (neCue) {
              const [neRvw, neState] = resolveStickBall(
                neCue.rvw,
                { ...cue, a: 0, b: 0, table: neSys.table },
                neCue.params.m,
                neCue.params.R
              );
              neCue.rvw = neRvw;
              neCue.state = neState;
              simulate(neSys);
              const neFrames = continuize(neSys, 1 / 60);
              noenglishPathSvg = computePathSvg(
                neFrames[neSys.cueBallId],
                neSys.table
              );
            }
          } catch {
            /* 무회전 시뮬 실패 시 빈 path */
          }

          // 다중 당점 비교 시뮬 (12·1·2·9시 4개) — 분석 레이어 'multipath' 활성 시만
          const multipath: MultiPath[] = [];
          if (get().menu.layers.includes('multipath')) {
            // (a, b) = (sin(angle), cos(angle)) × tipRatio (research.md 6.1)
            // 12시 = (0, 1.0), 1시 = (0.5, 0.87), 2시 = (0.87, 0.5), 9시 = (-1.0, 0)
            // 모두 3T (max). cue.V0는 그대로 유지.
            const variants: { label: string; a: number; b: number; color: string }[] = [
              { label: '12시', a: 0, b: 0.92, color: '#FACA15' },
              { label: '1시', a: 0.5, b: 0.77, color: '#5DD0F2' },
              { label: '2시', a: 0.77, b: 0.5, color: '#FF6F8C' },
              { label: '9시', a: -0.92, b: 0, color: '#A8E060' },
            ];
            for (const v of variants) {
              try {
                const mpSys = sys.copy();
                const mpCue = mpSys.balls[mpSys.cueBallId];
                if (!mpCue) continue;
                const [mpRvw, mpState] = resolveStickBall(
                  mpCue.rvw,
                  { ...cue, a: v.a, b: v.b, table: mpSys.table },
                  mpCue.params.m,
                  mpCue.params.R
                );
                mpCue.rvw = mpRvw;
                mpCue.state = mpState;
                simulate(mpSys);
                const mpFrames = continuize(mpSys, 1 / 60);
                multipath.push({
                  label: v.label,
                  pathSvg: computePathSvg(mpFrames[mpSys.cueBallId], mpSys.table),
                  color: v.color,
                });
              } catch {
                /* 개별 variant 실패 시 무시 */
              }
            }
          }

          // 자동 점수 판정 (3쿠션 UMB · 4구 KBF/AMATEUR + 매치포인트 마무리 3쿠션)
          const game = get().game;
          const stats = get().stats;
          const fourBallMode = get().fourBallMode;
          // 매치포인트 = AMATEUR 4구 + 핸디캡 - 1점 도달 (마지막 1점 남음)
          const isMatchPoint =
            game === 'four_ball' &&
            fourBallMode === 'amateur' &&
            stats.handicap > 0 &&
            stats.success >= stats.handicap - 1;
          const verdict =
            game === 'three_cushion'
              ? judgeThreeCushion(simSys.events, simSys.cueBallId)
              : judgeFourBall(simSys.events, simSys.cueBallId, fourBallMode, isMatchPoint);

          set({
            result: {
              pathSvg,
              noenglishPathSvg,
              multipath,
              frames,
              events: simSys.events,
              verdict,
              preview: isPreview,
            },
          });

          // 자동 통계 갱신 (preview 모드에서는 X) — Menu에서 토글
          if (!isPreview && stats.autoRecord) {
            const newHistory = [
              ...stats.history,
              (verdict.scored ? 'success' : 'fail') as 'success' | 'fail',
            ].slice(-HISTORY_LIMIT);
            set({
              stats: {
                ...stats,
                attempts: stats.attempts + 1,
                success: stats.success + (verdict.scored ? 1 : 0),
                history: newHistory,
              },
            });
          }
        } catch (err) {
          console.error('[store] simulation error:', err);
        }
      },

      clearResult: () => set({ result: null, animFrame: -1 }),
      setAnimFrame: (frame) => set({ animFrame: frame }),

      // ── 연속 플레이: 시뮬 최종 위치 반영 ──────────────
      applyFinalPositions: (capturedFrames, capturedVerdict) => {
        const { sys, result, cue } = get();
        // 캡처된 데이터 우선, 없으면 현재 result 사용
        const frames = capturedFrames ?? result?.frames;
        const verdict = capturedVerdict ?? result?.verdict;
        if (!frames) return;
        // preview result만 있고 캡처 데이터 없으면 무시
        if (!capturedFrames && result?.preview) return;
        // 각 공의 마지막 프레임 위치를 sys에 반영
        for (const [id, fArr] of Object.entries(frames)) {
          const ball = sys.balls[id];
          if (!ball || fArr.length === 0) continue;
          const last = fArr[fArr.length - 1];
          ball.rvw[0] = last.rvw[0];
          ball.rvw[1] = last.rvw[1];
          ball.rvw[3] = ball.rvw[4] = ball.rvw[5] = 0;
          ball.rvw[6] = ball.rvw[7] = ball.rvw[8] = 0;
          ball.state = STATIONARY;
        }
        // 수구 교대: 실패 시에만 교대 (실제 당구 규칙)
        const scored = verdict?.scored ?? false;
        if (!scored) {
          sys.cueBallId = sys.cueBallId === 'white' ? 'yellow' : 'white';
        }
        // phi 재계산 (새 수구 기준)
        const phi = recalculatePhi(sys, cue.phi);
        set({
          simRev: get().simRev + 1,
          result: null,
          animFrame: -1,
          cue: { ...cue, phi, phiAuto: true },
        });
        scheduleAutoSim(get);
      },

      // ── 랜덤 배치 ─────────────────────────────────────
      randomizeBalls: () => {
        const { sys, cue } = get();
        // 수구를 white로 초기화 (예시/드릴과 일관성)
        sys.cueBallId = 'white';
        const W = sys.table.w;
        const L = sys.table.l;
        const R = sys.balls[sys.cueBallId]?.params.R ?? 0.0307;
        const margin = R * 2; // 벽에서 최소 2R 거리
        const minSep = R * 3; // 공 간 최소 3R 간격

        const placed: [number, number][] = [];
        for (const id of Object.keys(sys.balls)) {
          let attempts = 0;
          let ex: number, ey: number;
          do {
            ex = margin + Math.random() * (W - 2 * margin);
            ey = margin + Math.random() * (L - 2 * margin);
            attempts++;
          } while (
            attempts < 200 &&
            placed.some(([px, py]) => Math.hypot(ex - px, ey - py) < minSep)
          );
          placed.push([ex, ey]);

          const ball = sys.balls[id];
          if (!ball) continue;
          ball.rvw[0] = ex;
          ball.rvw[1] = ey;
          ball.rvw[3] = ball.rvw[4] = ball.rvw[5] = 0;
          ball.rvw[6] = ball.rvw[7] = ball.rvw[8] = 0;
          ball.state = STATIONARY;
        }
        const phi = cue.phiAuto ? recalculatePhi(sys, cue.phi) : cue.phi;
        set({
          simRev: get().simRev + 1,
          result: null,
          animFrame: -1,
          cue: { ...cue, phi, phiAuto: true },
          menu: { ...get().menu, drillId: null },
          activeExample: null,
          activeApplicationExampleId: null,
        });
        scheduleAutoSim(get);
      },

      // ── 통계 ────────────────────────────────────────
      recordAttempt: (success) => {
        const stats = get().stats;
        const newHistory = [
          ...stats.history,
          (success ? 'success' : 'fail') as 'success' | 'fail',
        ].slice(-HISTORY_LIMIT);
        set({
          stats: {
            ...stats,
            attempts: stats.attempts + 1,
            success: stats.success + (success ? 1 : 0),
            history: newHistory,
          },
        });
      },

      resetStats: () => set({ stats: DEFAULT_STATS }),
      setAutoRecord: (auto) => set({ stats: { ...get().stats, autoRecord: auto } }),
      setHandicap: (handicap) => set({ stats: { ...get().stats, handicap: Math.max(1, Math.floor(handicap)) } }),

      // ── InfoBox ─────────────────────────────────────
      setInfoBoxPos: (pos, isPortrait) => {
        const ib = get().infobox;
        set({
          infobox: isPortrait
            ? { ...ib, posPortrait: pos }
            : { ...ib, posLandscape: pos },
        });
      },
      setInfoBoxOpacity: (opacity) =>
        set({
          infobox: {
            ...get().infobox,
            opacityIdle: Math.max(0.1, Math.min(1.0, opacity)),
          },
        }),
      setInfoBoxActive: (active) => set({ infobox: { ...get().infobox, isActive: active } }),
      setAutoActive: (auto) => set({ infobox: { ...get().infobox, autoActive: auto } }),
      toggleExampleMirrorH: () =>
        set({ infobox: { ...get().infobox, exampleMirrorH: !get().infobox.exampleMirrorH } }),
      toggleExampleMirrorV: () =>
        set({ infobox: { ...get().infobox, exampleMirrorV: !get().infobox.exampleMirrorV } }),

      // ── Menu ────────────────────────────────────────
      setSystem: (system) =>
        set({
          menu: { ...get().menu, system },
          activeApplicationExampleId: null, // 시스템 바꾸면 강조 해제
          activeExample: null, // 시스템 바꾸면 추천 마커 리셋
        }),
      toggleLayer: (layer) => {
        const layers = get().menu.layers;
        const next = layers.includes(layer)
          ? layers.filter((l) => l !== layer)
          : [...layers, layer];
        set({ menu: { ...get().menu, layers: next } });
      },
      setMenuOpen: (open) => set({ menu: { ...get().menu, open } }),
      toggleMenu: () => set({ menu: { ...get().menu, open: !get().menu.open } }),
      setLearnOpen: (learnOpen) => set({ menu: { ...get().menu, learnOpen } }),
      toggleLearn: () => set({ menu: { ...get().menu, learnOpen: !get().menu.learnOpen } }),
      setDrill: (drillId) => set({ menu: { ...get().menu, drillId } }),
      setTechnique: (techniqueId) =>
        set({
          menu: { ...get().menu, techniqueId },
          activeExample: null, // 기술 바꾸면 추천 마커 리셋
        }),
      setRotation: (rotation) => {
        const oldRotation = get().menu.rotation;
        const infobox = get().infobox;
        // 0 ↔ 180 변환 시 InfoBox 위치 자동 보정 (viewBox 중심 기준 점대칭)
        // BOX_W=200, BOX_H=135 (InfoBox 크기). viewBox 가로=812, 세로=375.
        let newPosLandscape = infobox.posLandscape;
        const flipFromTo = (oldRotation === 0 && rotation === 180) ||
                           (oldRotation === 180 && rotation === 0);
        if (flipFromTo) {
          newPosLandscape = {
            x: 812 - infobox.posLandscape.x - 200,
            y: 375 - infobox.posLandscape.y - 135,
          };
        }
        set({
          menu: { ...get().menu, rotation },
          infobox: { ...infobox, posLandscape: newPosLandscape },
        });
      },
    }),
    {
      name: 'billiards-pwa-v1',
      storage: createJSONStorage(() => localStorage),
      version: 8, // v8: infobox.exampleMirrorH/V 추가
      // localStorage에 저장할 항목만 (sys, result, simRev는 매 세션 새로 생성)
      partialize: (state) => ({
        game: state.game,
        fourBallMode: state.fourBallMode,
        cue: state.cue,
        infobox: state.infobox,
        activeExample: state.activeExample, // 추천 마커 reload 후 유지
        menu: {
          system: state.menu.system,
          techniqueId: state.menu.techniqueId,
          drillId: state.menu.drillId,
          layers: state.menu.layers,
          rotation: state.menu.rotation,
          open: false, // 메뉴 열림 상태는 복원 안 함
          learnOpen: false, // 학습 패널 열림 상태도 복원 안 함
        },
        stats: state.stats,
      }),
      // 복원 시: sys는 game·drillId를 기준으로 재생성 + phi 동기화
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // v2 → v3 마이그레이션: 누락 필드 default
        if (state.cue && state.cue.phiAuto === undefined) {
          state.cue = { ...state.cue, phiAuto: true };
        }
        if (state.menu && state.menu.rotation === undefined) {
          state.menu = { ...state.menu, rotation: 0 };
        }
        if (state.fourBallMode === undefined) {
          state.fourBallMode = 'amateur';
        }
        if (state.stats) {
          if (state.stats.autoRecord === undefined) {
            state.stats = { ...state.stats, autoRecord: false };
          }
          if (state.stats.handicap === undefined) {
            state.stats = { ...state.stats, handicap: 30 };
          }
        }
        // v4 → v5: V0가 이전 default(2.0)거나 MAX(4.0) 초과면 새 default(3.5)로 보정
        if (state.cue && state.cue.V0 !== undefined) {
          if (state.cue.V0 === 2.0 || state.cue.V0 < 0.5) {
            state.cue = { ...state.cue, V0: 3.5 };
          }
        }

        // v5 → v6: techniqueId 누락 필드 default
        if (state.menu && state.menu.techniqueId === undefined) {
          state.menu = { ...state.menu, techniqueId: null };
        }
        // v6 → v7: learnOpen 누락 필드 default
        if (state.menu && state.menu.learnOpen === undefined) {
          state.menu = { ...state.menu, learnOpen: false };
        }
        // v7 → v8: 예제 미러 누락 필드 default
        if (state.infobox && state.infobox.exampleMirrorH === undefined) {
          state.infobox = { ...state.infobox, exampleMirrorH: false };
        }
        if (state.infobox && state.infobox.exampleMirrorV === undefined) {
          state.infobox = { ...state.infobox, exampleMirrorV: false };
        }

        const drillId = state.menu?.drillId ?? null;
        const drill = drillId ? getDrillById(drillId) : null;
        if (drill) {
          state.sys =
            drill.game === 'three_cushion'
              ? createKoreanThreeCushionSystem(drillToPositions(drill))
              : createFourBallSystem(drillToPositions(drill));
          state.game = drill.game;
        } else {
          state.sys = createInitialSystem(state.game);
        }
        state.simRev = 0;
        state.result = null;
        // 복원 시점에는 phiAuto일 때만 phi 재계산. 사용자가 수동으로 둔 phi는 그대로.
        if (state.cue.phiAuto) {
          state.cue = { ...state.cue, phi: recalculatePhi(state.sys, state.cue.phi) };
        }
      },
    }
  )
);

// ════════════════════════════════════════════════════════════════
// 편의 selector (컴포넌트에서 자주 쓰는 조합)
// ════════════════════════════════════════════════════════════════

/** 현재 게임의 모든 드릴. */
export function useAvailableDrills() {
  const game = useAppStore((s) => s.game);
  return drills.filter((d) => d.game === game);
}

/** 통계의 성공률 (%, 정수). */
export function useSuccessRate(): number {
  return useAppStore((s) => {
    const { attempts, success } = s.stats;
    return attempts === 0 ? 0 : Math.round((success / attempts) * 100);
  });
}

// ════════════════════════════════════════════════════════════════
// 핸디캡 G.A 자동 산출 (research.md 8.6 4구 + 9.2.4 3쿠션)
// ════════════════════════════════════════════════════════════════

/**
 * 4구 핸디캡 표 (research.md 8.6).
 * G.A = success / attempts (성공률을 G.A로 근사 — 실제는 점수/이닝).
 */
const HANDICAP_FOURBALL: { gaMin: number; gaMax: number; handicap: number; grade: string }[] = [
  { gaMin: 0, gaMax: 0.5, handicap: 30, grade: '입문' },
  { gaMin: 0.5, gaMax: 1.0, handicap: 60, grade: '초급' },
  { gaMin: 1.0, gaMax: 2.0, handicap: 100, grade: '중급' },
  { gaMin: 2.0, gaMax: 4.0, handicap: 200, grade: '상급' },
  { gaMin: 4.0, gaMax: Infinity, handicap: 300, grade: '고수' },
];

/**
 * 3쿠션 핸디캡 표 (research.md 9.2.4 KBF/UMB 공식).
 */
const HANDICAP_THREECUSHION: { gaMin: number; gaMax: number; handicap: number }[] = [
  { gaMin: 0, gaMax: 0.3, handicap: 15 },
  { gaMin: 0.3, gaMax: 0.35, handicap: 16 },
  { gaMin: 0.35, gaMax: 0.4, handicap: 17 },
  { gaMin: 0.4, gaMax: 0.45, handicap: 18 },
  { gaMin: 0.45, gaMax: 0.52, handicap: 20 },
  { gaMin: 0.52, gaMax: 0.57, handicap: 22 },
  { gaMin: 0.57, gaMax: 0.62, handicap: 24 },
  { gaMin: 0.62, gaMax: 0.68, handicap: 25 },
  { gaMin: 0.68, gaMax: 0.75, handicap: 27 },
  { gaMin: 0.75, gaMax: 0.83, handicap: 30 },
  { gaMin: 0.83, gaMax: 0.93, handicap: 32 },
  { gaMin: 0.93, gaMax: 1.04, handicap: 35 },
  { gaMin: 1.04, gaMax: 1.2, handicap: 38 },
  { gaMin: 1.2, gaMax: 1.4, handicap: 42 },
  { gaMin: 1.4, gaMax: 1.7, handicap: 45 },
  { gaMin: 1.7, gaMax: Infinity, handicap: 50 },
];

export interface HandicapSuggestion {
  ga: number;
  handicap: number;
  grade?: string;
}

/**
 * 현재 통계 기반으로 추천 핸디캡 산출.
 * G.A는 성공률(success/attempts)로 근사. 정밀한 G.A는 게임/이닝 추적이 필요 (v0.5+).
 */
export function useSuggestedHandicap(): HandicapSuggestion | null {
  return useAppStore((s) => {
    const { attempts, success } = s.stats;
    if (attempts < 5) return null; // 5회 미만은 신뢰도 낮음
    const ga = success / attempts;
    if (s.game === 'four_ball') {
      const row = HANDICAP_FOURBALL.find((r) => ga >= r.gaMin && ga < r.gaMax);
      return row ? { ga, handicap: row.handicap, grade: row.grade } : null;
    }
    const row = HANDICAP_THREECUSHION.find((r) => ga >= r.gaMin && ga < r.gaMax);
    return row ? { ga, handicap: row.handicap } : null;
  });
}

// 디버그용 — window에 store 노출 (개발 중에만)
if (typeof window !== 'undefined') {
  (window as unknown as { __store: typeof useAppStore }).__store = useAppStore;
}
