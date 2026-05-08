import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from './store.ts';
import { v0ToCushion } from './utils.ts';
import {
  getRecommendedImpact,
  getSystemContentByGuide,
  getSystemApplications,
  type SystemContent,
  type SystemApplicationExample,
} from './systemContent.ts';
import { TECHNIQUE_CONTENT, type TechniqueId } from './techniqueContent.ts';

interface InfoBoxProps {
  isPortrait: boolean;
}

/**
 * InfoBox — 다이얼·게이지·라벨·부제·드래그 핸들 + 인터랙션 (5단계).
 *
 * 인터랙션:
 *   - 박스 어디든 잡고 드래그 → 박스 이동 (가로/세로 모드별 위치 분리)
 *   - 다이얼 큐볼 안 영역 클릭/드래그 → 당점 a/b 변경
 *   - STRIKE 버튼 → phi 자동 갱신 + runSimulation
 *
 * 동적 라벨:
 *   - 두께  : 큐볼 → 적구 방향과 큐 방향(phi)의 차이로 ½, ¼ 등 추정
 *   - 당점  : (a, b) → 시계 표기 (12:00, 3:00 등)
 *   - 회전  : a → 팁 수 (0T, 1T→, 2T← 등)
 *
 * 5단계 정밀화 보류:
 *   - 두께 라벨은 정확한 cut angle 매핑 (sin·cos) 대신 단순 분류만 적용
 *   - 다이얼 두께 시각 갱신 (현재는 적구·큐볼 원이 정적)
 *   - 큐대 회전 드래그 (큐대 끝 잡고 phi 변경) — research.md 참조 후 정밀화
 */

const BOX_W = 215;
const BOX_H = 135;
const ACTIVE_OPACITY = 0.95;
const AUTO_INACTIVE_DELAY_MS = 2500;

// V0 게이지: 0 ~ MAX_V0 (m/s) → 0 ~ 80 (px)
// 3쿠션 표준: 부드러운 샷 1.5~3 m/s, 일반 3~5 m/s, 강한 샷 5~7 m/s.
// MAX_V0 = 8 (충분한 헤드룸), default V0 = 3.5 (일반 3쿠션).
const MAX_V0 = 8.0;

// 다이얼 그룹 좌표 (박스 안 기준).
// 두 공 가운데 = 당점 chip 가운데 절대 cx=92 (chip group offset 8 + chip 안 가운데 84).
// → DIAL_X = 92 - CUE_BALL_DIAL_CX(20) = 72.
// 1/8 max 두께 시 적구 우단 = 92 + 28 + 32 = 152, STRIKE 좌단 164 → 12px 여유.
const DIAL_X = 72;
const DIAL_Y = 56;
// 큐볼·적구 시각화 — 동일 크기 r=28 (사용자 명시 좀 더 큼).
const CUE_BALL_DIAL_CX = 20;
const CUE_BALL_DIAL_CY = 0;
const CUE_BALL_DIAL_R = 32;
const BALL_DIAL_R = CUE_BALL_DIAL_R;
// 당점 max 위치 — 큐볼 반지름의 0.85 (실제 당구에서 3팁은 큐볼 끝까지 가지 않음).
// 끝까지 치면 큐대 미스·찍힘 위험. 3팁 = 큐볼 안전 영역 끝 (≈ R×0.85).
//   1팁 = R × 0.85 / 3 = R × 0.283 (큐볼 안)
//   2팁 = R × 0.85 × 2/3 = R × 0.567
//   3팁 = R × 0.85 = 큐볼 안전 max
const CUE_DOT_RANGE = CUE_BALL_DIAL_R * 0.85;
// 적구 옵셋 max — 두께 시각화 (8/8=0, 4/8=R, 0/8=2R).
// max = 2R = 56 (박스 220 안 STROKE 영역 cx=152와 분리).
const TARGET_CX_DIFF_MAX = 2 * CUE_BALL_DIAL_R;

// ── 동적 라벨 헬퍼 ─────────────────────────────
function clockLabel(a: number, b: number): string {
  const r = Math.hypot(a, b);
  if (r < 0.05) return '중앙';
  let angle = Math.atan2(a, b); // (b=+1)=12시:0, (a=+1)=3시:π/2, (b=-1)=6시:±π
  if (angle < 0) angle += 2 * Math.PI;
  // 30분 단위 round (각도 π/12 = 30분)
  const halfHours = Math.round(angle / (Math.PI / 12));
  const hour24 = Math.floor(halfHours / 2) % 12;
  const minute = (halfHours % 2) * 30;
  const hourLabel = hour24 === 0 ? 12 : hour24;
  return minute === 0 ? `${hourLabel}:00` : `${hourLabel}:30`;
}

/**
 * 회전 팁 라벨 — 공 반지름의 1/3씩 (1팁=R/3, 2팁=2R/3, 3팁=R).
 * 정규화 r 매핑: 1T=0.333, 2T=0.667, 3T=1.0.
 * 임계값 = 옆 팁의 중간:
 *   r<1/6 (0.167): 0T (무회전)
 *   r<1/2 (0.500): 1T
 *   r<5/6 (0.833): 2T
 *   r≥5/6: 3T
 *   사이드 화살표: a 부호 (정회전 → / 역회전 ←).
 */
function tipsLabel(a: number, b: number): string {
  const r = Math.hypot(a, b);
  let tips: number;
  if (r < 1 / 6) tips = 0;
  else if (r < 1 / 2) tips = 1;
  else if (r < 5 / 6) tips = 2;
  else tips = 3;
  if (tips === 0) return '0T';
  if (Math.abs(a) < 0.05) return `${tips}T`;
  return `${tips}T${a < 0 ? '←' : '→'}`;
}

/**
 * 두께 라벨 — 사용자 직관 정확 매핑:
 *   - ratio 0 (perp=0) → 8/8 (완전 겹침, 정중앙)
 *   - ratio 0.875 (perp=1.75R) → 1/8 (살짝 겹침, 스침)
 *   - ratio 1 (perp=2R) → 0/8 (가장자리 정확 닿음 = 안 침)
 *   - ratio > 1 → 0/8 (빗나감)
 */
function thicknessLabelByPerp(perp: number, R: number): string {
  const ratio = perp / (2 * R);
  if (ratio > 1) return '0/8';
  const eighths = Math.max(0, Math.min(8, 8 - Math.round(ratio * 8)));
  return `${eighths}/8`;
}

export default function InfoBox({ isPortrait }: InfoBoxProps) {
  const infobox = useAppStore((s) => s.infobox);
  const cue = useAppStore((s) => s.cue);
  const sys = useAppStore((s) => s.sys);
  const simRev = useAppStore((s) => s.simRev);
  const setCue = useAppStore((s) => s.setCue);
  const setBallPos = useAppStore((s) => s.setBallPos);
  const setInfoBoxPos = useAppStore((s) => s.setInfoBoxPos);
  const setInfoBoxActive = useAppStore((s) => s.setInfoBoxActive);
  const runSimulation = useAppStore((s) => s.runSimulation);
  const activeExample = useAppStore((s) => s.activeExample);
  const activeApplicationExampleId = useAppStore((s) => s.activeApplicationExampleId);
  const systemGuide = useAppStore((s) => s.menu.system);
  const techniqueId = useAppStore((s) => s.menu.techniqueId);

  // 시스템 가이드 켰을 때만 시스템 콘텐츠·권장 당점 활성. 응용 예시·영상 강좌는 📖 패널.
  const systemContent: SystemContent | null = useMemo(
    () => getSystemContentByGuide(systemGuide),
    [systemGuide],
  );
  const recommendedImpact = useMemo(
    () => (systemContent ? getRecommendedImpact(systemContent.id) : null),
    [systemContent],
  );
  // 활성 응용 예시 라벨 (시스템 정보 줄에 표시 — InfoBox는 조작 위주)
  const activeApplicationExample: SystemApplicationExample | null = useMemo(() => {
    if (!systemContent || !activeApplicationExampleId) return null;
    const apps = getSystemApplications(systemContent.id);
    return apps.find((a) => a.id === activeApplicationExampleId) ?? null;
  }, [systemContent, activeApplicationExampleId]);

  // 기술 학습 — Menu에서 선택된 기술 ID로 콘텐츠 조회
  const techniqueContent = useMemo(
    () =>
      techniqueId && techniqueId in TECHNIQUE_CONTENT
        ? TECHNIQUE_CONTENT[techniqueId as TechniqueId]
        : null,
    [techniqueId],
  );

  // 박스 동적 높이 — 시스템 정보 1줄 + 기술 정보 1줄 (응용 예시·영상 강좌·학습은 📖 패널로 이동).
  const SYSTEM_INFO_H = 18;
  const TECHNIQUE_INFO_H = 18;
  const boxHeight =
    BOX_H +
    (systemContent ? SYSTEM_INFO_H : 0) +
    (techniqueContent ? TECHNIQUE_INFO_H : 0);

  const inactiveTimerRef = useRef<number | null>(null);

  // 모드별 위치
  const pos = isPortrait ? infobox.posPortrait : infobox.posLandscape;
  const opacity = infobox.isActive ? ACTIVE_OPACITY : infobox.opacityIdle;

  // 자동 활성 트리거
  const triggerActive = useCallback(() => {
    if (!infobox.autoActive) return;
    setInfoBoxActive(true);
    if (inactiveTimerRef.current !== null) {
      window.clearTimeout(inactiveTimerRef.current);
    }
    inactiveTimerRef.current = window.setTimeout(() => {
      setInfoBoxActive(false);
      inactiveTimerRef.current = null;
    }, AUTO_INACTIVE_DELAY_MS);
  }, [infobox.autoActive, setInfoBoxActive]);

  useEffect(() => {
    return () => {
      if (inactiveTimerRef.current !== null) {
        window.clearTimeout(inactiveTimerRef.current);
      }
    };
  }, []);

  // ── 박스 드래그 ───────────────────────────────
  const handleBoxPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      e.preventDefault();
      e.stopPropagation();
      triggerActive();

      const target = e.currentTarget;
      const svg = target.ownerSVGElement;
      if (!svg) return;
      target.setPointerCapture(e.pointerId);

      const svgPointFromEv = (
        clientX: number,
        clientY: number
      ): [number, number] => {
        const ctm = svg.getScreenCTM();
        if (!ctm) return [0, 0];
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const local = pt.matrixTransform(ctm.inverse());
        return [local.x, local.y];
      };

      const [startSx, startSy] = svgPointFromEv(e.clientX, e.clientY);
      const offsetX = startSx - pos.x;
      const offsetY = startSy - pos.y;
      const limX = isPortrait ? 375 : 812;
      const limY = isPortrait ? 812 : 375;

      const onMove = (ev: PointerEvent) => {
        const [sx, sy] = svgPointFromEv(ev.clientX, ev.clientY);
        const newX = Math.max(0, Math.min(limX - BOX_W, sx - offsetX));
        const newY = Math.max(0, Math.min(limY - boxHeight, sy - offsetY));
        setInfoBoxPos({ x: newX, y: newY }, isPortrait);
        triggerActive();
      };

      const onUp = (ev: PointerEvent) => {
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* 이미 해제 */
        }
        target.removeEventListener('pointermove', onMove as EventListener);
        target.removeEventListener('pointerup', onUp as EventListener);
        target.removeEventListener('pointercancel', onUp as EventListener);
      };

      target.addEventListener('pointermove', onMove as EventListener);
      target.addEventListener('pointerup', onUp as EventListener);
      target.addEventListener('pointercancel', onUp as EventListener);
    },
    [pos.x, pos.y, isPortrait, setInfoBoxPos, triggerActive, boxHeight]
  );

  // ── 다이얼(큐볼 안) 클릭/드래그 → 당점 a/b ─────────────
  // handleDialPointerDown은 dialGroup·cueCxDynamic 정의 다음으로 이동 (의존성 반영)



  // ── STRIKE → runSimulation ────────────────────────────
  const handleStrike = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      e.stopPropagation();
      triggerActive();
      runSimulation();
    },
    [runSimulation, triggerActive]
  );

  // ── STROKE 게이지 위아래 드래그 → V0 조정 ──────────────
  // 게이지 group transform="translate(152, 18)" + height 80.
  // 상단(local y=0) = MAX_V0, 하단(local y=80) = 0.
  const handleGaugePointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      e.preventDefault();
      e.stopPropagation();
      triggerActive();
      const target = e.currentTarget;
      const svg = target.ownerSVGElement;
      if (!svg) return;
      target.setPointerCapture(e.pointerId);

      const apply = (clientX: number, clientY: number) => {
        const ctm = target.getScreenCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const local = pt.matrixTransform(ctm.inverse());
        // local.y는 게이지 hit area 안 좌표 (0~80)
        const y = Math.max(0, Math.min(80, local.y));
        const v0 = MAX_V0 * (1 - y / 80);
        setCue({ V0: v0 });
      };

      apply(e.clientX, e.clientY);

      const onMove = (ev: PointerEvent) => {
        apply(ev.clientX, ev.clientY);
        triggerActive();
      };
      const onUp = (ev: PointerEvent) => {
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* already released */
        }
        target.removeEventListener('pointermove', onMove as EventListener);
        target.removeEventListener('pointerup', onUp as EventListener);
        target.removeEventListener('pointercancel', onUp as EventListener);
      };

      target.addEventListener('pointermove', onMove as EventListener);
      target.addEventListener('pointerup', onUp as EventListener);
      target.addEventListener('pointercancel', onUp as EventListener);
    },
    [setCue, triggerActive]
  );

  // ── 동적 표시값 ─────────────────────────────
  const gaugeFill = Math.max(0, Math.min(80, (cue.V0 / MAX_V0) * 80));
  // 큐볼 dial cx (group 평행이동 반영) — dialGroup useMemo 결과 의존
  // (handleDialPointerDown은 dialGroup이 아닌 cueCx 값 사용 위해 별도 변수)

  /**
   * cue.phi 방향으로 ray cast → 가장 먼저 만나는 적구 ID.
   * ray가 어느 적구에도 안 닿으면 → 큐대 정면(반사각 cos>0) 적구 중 ray로부터 가장 가까운 적구.
   * 그것도 없으면 → 위치상 가장 가까운 적구.
   */
  const aimedTargetId = useMemo(() => {
    const cb = sys.balls[sys.cueBallId];
    if (!cb) return null;
    const R = cb.params.R;
    const cx = cb.rvw[0],
      cy = cb.rvw[1];
    const phiRad = (cue.phi * Math.PI) / 180;
    const dx = Math.cos(phiRad);
    const dy = Math.sin(phiRad);
    // 1순위: ray가 적구 직경 이내로 닿는 첫 번째 적구
    let bestT = Infinity;
    let bestId: string | null = null;
    // 2순위: ray 정면 (proj > 0) 중 perpendicular 거리 최소 적구
    let frontT = Infinity;
    let frontPerp = Infinity;
    let frontId: string | null = null;
    // 3순위: 위치상 가장 가까운 적구
    let nearestDist = Infinity;
    let nearestId: string | null = null;
    for (const [id, ball] of Object.entries(sys.balls)) {
      if (id === sys.cueBallId) continue;
      const ex = ball.rvw[0] - cx;
      const ey = ball.rvw[1] - cy;
      const distSq = ex * ex + ey * ey;
      // 3순위 누적
      if (distSq < nearestDist) {
        nearestDist = distSq;
        nearestId = id;
      }
      const proj = ex * dx + ey * dy;
      if (proj <= 0) continue; // 뒤쪽
      const perp2 = distSq - proj * proj;
      // 1순위 누적
      if (perp2 <= (2 * R) * (2 * R) && proj < bestT) {
        bestT = proj;
        bestId = id;
      }
      // 2순위 누적 (ray 정면 — perpendicular 거리 최소)
      if (perp2 < frontPerp || (perp2 === frontPerp && proj < frontT)) {
        frontPerp = perp2;
        frontT = proj;
        frontId = id;
      }
    }
    return bestId ?? frontId ?? nearestId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sys, simRev, cue.phi]);

  /**
   * 다이얼 — mirror 모델 (사용자 명시 "양쪽 다 보이게 효과"):
   *   - 두 공이 dial 가운데(cx=20) 기준 대칭 평행이동
   *   - 8/8 (cxDiff=0): 두 공 같은 위치 (cx=20). 큐볼만 보임 (적구 가려짐)
   *   - 1/8 (cxDiff=80, 스침): 두 공이 정확 2R 떨어짐. 큐볼·적구 박스 끝.
   *     - sign + → 큐볼 dial 우측(cx=60), 적구 dial 좌측(cx=-20)
   *     - sign - → 큐볼 dial 좌측(cx=-20), 적구 dial 우측(cx=60)
   *   - 0/8 (ratio>1, 빗나감): cxDiff clamp 80 + 적구 fillOpacity 낮음
   *
   *   사용자 큐볼 ring drag → cue.phi 변경 → cxDiff 변경 → 두 공 mirror 평행이동
   */
  const dialGroup = useMemo(() => {
    const cb = sys.balls[sys.cueBallId];
    if (!cb || !aimedTargetId) return null;
    const target = sys.balls[aimedTargetId];
    if (!target) return null;
    const targetId = aimedTargetId;
    const ex = target.rvw[0] - cb.rvw[0];
    const ey = target.rvw[1] - cb.rvw[1];
    const distance = Math.sqrt(ex * ex + ey * ey);
    const phiTargetRad = Math.atan2(ey, ex);
    const phiTargetDeg = (phiTargetRad * 180) / Math.PI;
    const deltaDeg = ((cue.phi - phiTargetDeg + 540) % 360) - 180;
    const R = cb.params.R;
    const cutAbsRad = (Math.min(90, Math.abs(deltaDeg)) * Math.PI) / 180;
    const perp = Math.sin(cutAbsRad) * distance;
    const ratioPerp = perp / (2 * R);
    const clampedRatio = Math.min(1, ratioPerp);
    const sign = deltaDeg >= 0 ? 1 : -1;
    // mirror: 큐볼·적구 dial 가운데 기준 대칭
    const cxDiff = clampedRatio * TARGET_CX_DIFF_MAX;
    const cueCx = CUE_BALL_DIAL_CX + (cxDiff / 2) * sign;
    const targetCx = CUE_BALL_DIAL_CX - (cxDiff / 2) * sign;
    const isHit = ratioPerp <= 1 && Math.abs(deltaDeg) < 90;
    return {
      cueCx,
      cueCy: 0,
      targetCx,
      targetCy: 0,
      ratioPerp,
      targetId,
      isHit,
      distance,
      phiTargetDeg,
    };
  }, [aimedTargetId, sys, simRev, cue.phi]);

  // 다이얼 큐볼 위치는 항상 중심(CUE_BALL_DIAL_CX) 고정 — 당점 회전 표시 전용.
  // (이전 버전: cueCx 평행이동에 따라 마커도 이동 → 박스 밖으로 나가는 시각 버그)

  // 큐볼 안 흰 영역 — 탭(짧은 터치)→ 당점 a/b, 드래그(긴 이동)→ 테이블 위 수구 위치 이동.
  // 기준: 누적 이동 거리 DRAG_THRESHOLD(client px) 미만이면 당점, 이상이면 위치 이동.
  const DRAG_THRESHOLD = 8; // client pixel
  const CUE_POS_SENSITIVITY = 0.004; // 다이얼 드래그 1 SVG px ≈ 4mm 엔진 이동
  const handleDialPointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      e.preventDefault();
      e.stopPropagation();
      triggerActive();

      const target = e.currentTarget;
      const svg = target.ownerSVGElement;
      if (!svg) return;
      target.setPointerCapture(e.pointerId);

      // 큐볼 dial cx (mirror 평행이동 반영) — 당점 모드에서 사용
      const ratio = dialGroup ? dialGroup.ratioPerp : 0;
      const clamped = Math.min(1, ratio);
      const sign = dialGroup ? (dialGroup.cueCx >= CUE_BALL_DIAL_CX ? 1 : -1) : 1;
      const cxDiff = clamped * TARGET_CX_DIFF_MAX;
      const cueDialCxAtStart = CUE_BALL_DIAL_CX - (cxDiff / 2) * sign;

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let mode: 'undecided' | 'position' = 'undecided';

      // 위치 이동 모드용 — 시작 시점 수구 엔진 좌표
      const cueBall = sys.balls[sys.cueBallId];
      const startEx = cueBall ? cueBall.rvw[0] : 0;
      const startEy = cueBall ? cueBall.rvw[1] : 0;
      const ctm = svg.getScreenCTM();
      const scaleX = ctm ? 1 / Math.abs(ctm.a) : 1;
      const scaleY = ctm ? 1 / Math.abs(ctm.d) : 1;

      // 당점 a/b 적용 함수
      const applyTip = (clientX: number, clientY: number) => {
        const ctm2 = svg.getScreenCTM();
        if (!ctm2) return;
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const local = pt.matrixTransform(ctm2.inverse());
        const dx = local.x - pos.x - DIAL_X - cueDialCxAtStart;
        const dy = local.y - pos.y - DIAL_Y - CUE_BALL_DIAL_CY;
        let a = dx / CUE_DOT_RANGE;
        let b = -dy / CUE_DOT_RANGE;
        const r = Math.hypot(a, b);
        if (r > 1) {
          a /= r;
          b /= r;
        }
        setCue({ a, b });
      };

      // pointer down 시점에는 당점 적용하지 않음 — 드래그 여부 확인 후 결정.
      // (즉시 적용 시 드래그 의도인데 당점이 바뀌는 부작용)

      const onMove = (ev: PointerEvent) => {
        const dxClient = ev.clientX - startClientX;
        const dyClient = ev.clientY - startClientY;
        const dist = Math.hypot(dxClient, dyClient);

        if (mode === 'undecided') {
          if (dist >= DRAG_THRESHOLD) {
            mode = 'position';
          } else {
            // threshold 미만: 아직 판정 미정, 움직임 무시
            triggerActive();
            return;
          }
        }

        if (mode === 'position') {
          // 수구 위치 이동 (클라이언트 pixel delta → 엔진 좌표 delta)
          const dxSvg = dxClient * scaleX;
          const dySvg = dyClient * scaleY;
          const newEx = startEx + dxSvg * CUE_POS_SENSITIVITY;
          const newEy = startEy - dySvg * CUE_POS_SENSITIVITY;
          setBallPos(sys.cueBallId, newEx, newEy);
        }
        triggerActive();
      };

      const onUp = (ev: PointerEvent) => {
        // 탭 판정: 드래그 threshold 미달 상태에서 pointer up → 당점 적용
        if (mode === 'undecided') {
          applyTip(ev.clientX, ev.clientY);
        }
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* 이미 해제 */
        }
        target.removeEventListener('pointermove', onMove as EventListener);
        target.removeEventListener('pointerup', onUp as EventListener);
        target.removeEventListener('pointercancel', onUp as EventListener);
      };

      target.addEventListener('pointermove', onMove as EventListener);
      target.addEventListener('pointerup', onUp as EventListener);
      target.addEventListener('pointercancel', onUp as EventListener);
    },
    [pos.x, pos.y, setCue, setBallPos, sys, triggerActive, dialGroup]
  );

  /** 다이얼 적구 색 (ray cast 결과 적구 색, 없으면 회색·반투명). */
  const aimedFill = aimedTargetId
    ? aimedTargetId === 'yellow'
      ? '#F5D547'
      : aimedTargetId === 'red' || aimedTargetId === 'red2'
        ? '#D63030'
        : '#FFFFFF'
    : 'transparent';
  const aimedStroke = aimedTargetId
    ? aimedTargetId === 'yellow'
      ? '#806810'
      : aimedTargetId === 'red' || aimedTargetId === 'red2'
        ? '#5a0e0e'
        : '#777'
    : '#3D4980';

  // ── 큐볼 ring drag (큐볼 r=25~40 분홍 영역) → phi 조절 (mirror 평행이동) ──
  // 사용자 명시: "내가 큐볼을 움직이면 큐볼과 적구 같이 움직여서 박스 내에서만 에니메이팅"
  //   mirror 모델: 큐볼 dial cx = 20 + cxDiff/2 * sign (적구는 반대)
  //   사용자 drag 시 큐볼 위치 변경 → cxDiff = abs(offset)*2 → ratio → cue.phi
  //   pointer offset clamp ±(TARGET_CX_DIFF_MAX/2) = ±40

  // ── 적구 드래그 핸들러 — 사용자 명시 "적구는 드래그 안해" → 제거 (인터랙션 X) ──

  // 라벨: 두께(aimedTargetId perp 기반)·시계·팁·V₀
  // 다이얼이 가리키는 적구를 기준으로 두께 계산 (yellow 고정 X — 다이얼과 일관).
  const labels = useMemo(() => {
    let thickness = '0/8';
    const cueBall = sys.balls[sys.cueBallId];
    const target = aimedTargetId ? sys.balls[aimedTargetId] : null;
    if (cueBall && target) {
      const ex = target.rvw[0] - cueBall.rvw[0];
      const ey = target.rvw[1] - cueBall.rvw[1];
      const phiRad = (cue.phi * Math.PI) / 180;
      const dx = Math.cos(phiRad);
      const dy = Math.sin(phiRad);
      const proj = ex * dx + ey * dy;
      const perp = Math.sqrt(Math.max(0, ex * ex + ey * ey - proj * proj));
      if (proj > 0) {
        thickness = thicknessLabelByPerp(perp, cueBall.params.R);
      }
    }
    return {
      thickness,
      clock: clockLabel(cue.a, cue.b),
      tips: tipsLabel(cue.a, cue.b),
      v0: v0ToCushion(cue.V0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sys, simRev, cue.phi, cue.a, cue.b, cue.V0]);

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      data-component="infobox"
      style={{ opacity, transition: 'opacity 0.2s' }}
    >
      <defs>
        <linearGradient id="strokeBar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FACA15" />
          <stop offset="0.5" stopColor="#F58A0F" />
          <stop offset="1" stopColor="#E63946" />
        </linearGradient>
      </defs>

      {/* 박스 배경 (pointer-events none — 박스 이동은 6점 그리드만 가능) */}
      <rect
        width={BOX_W}
        height={boxHeight}
        rx={10}
        fill="#DCE9F5"
        fillOpacity={0.72}
        pointerEvents="none"
      />

      {/* 드래그 핸들 — 6점 그리드만 hit area (박스 이동) */}
      <g>
        <g fill="#1F1F2E" opacity={0.55} pointerEvents="none">
          <circle cx={8} cy={8} r={1.2} />
          <circle cx={14} cy={8} r={1.2} />
          <circle cx={8} cy={14} r={1.2} />
          <circle cx={14} cy={14} r={1.2} />
          <circle cx={8} cy={20} r={1.2} />
          <circle cx={14} cy={20} r={1.2} />
        </g>
        {/* invisible hit area — 좌상 6점 그리드 영역만 */}
        <rect
          x={2}
          y={2}
          width={20}
          height={26}
          fill="transparent"
          style={{ cursor: 'grab', touchAction: 'none' }}
          onPointerDown={handleBoxPointerDown}
        />
      </g>

      {/* 미러 토글은 LearningPanel(📖)로 이동 — InfoBox는 조작 위주 */}

      {/* 다이얼 (적구+큐볼 시계) — 큐볼·적구 같이 평행이동 (cy=0). cue.phi 따라 group offset. */}
      <g transform={`translate(${DIAL_X}, ${DIAL_Y})`}>
        {/* mirror 모델: 두 공 가운데 = 당점 chip 가운데 (절대 cx=56, group 안 cx=20).
            8/8 (ratio=0): 큐볼·적구 모두 cx=20 (동심, 정타)
            4/8 (ratio=0.5): 큐볼 cx=20-14, 적구 cx=20+14 (좌우 대칭, 50% 겹침)
            0/8 (ratio=1.0): 큐볼 cx=20-28, 적구 cx=20+28 (가장자리만 닿음, 스침)
            cue.phi 부호 (deltaDeg sign)에 따라 좌우 swap. */}
        {(() => {
          const ratio = dialGroup ? dialGroup.ratioPerp : 0;
          const clamped = Math.min(1, ratio);
          const sign = dialGroup ? (dialGroup.cueCx >= CUE_BALL_DIAL_CX ? 1 : -1) : 1;
          const cxDiff = clamped * TARGET_CX_DIFF_MAX;
          const cueDialCx = CUE_BALL_DIAL_CX - (cxDiff / 2) * sign;
          const targetDialCx = CUE_BALL_DIAL_CX + (cxDiff / 2) * sign;

          return (
            <>
              {/* 1. 적구 (drag X — 사용자 명시 "적구는 드래그 안해") */}
              {aimedTargetId && (
                <circle
                  cx={targetDialCx}
                  cy={0}
                  r={BALL_DIAL_R}
                  fill={aimedFill}
                  stroke={aimedStroke}
                  strokeWidth={0.6}
                  fillOpacity={0.55}
                  pointerEvents="none"
                />
              )}
              {/* 2. 큐볼 (탭 = 당점 a/b, 드래그 = 테이블 위 수구 위치 미세 이동) */}
              <circle
                cx={cueDialCx}
                cy={0}
                r={CUE_BALL_DIAL_R}
                fill="#FFFFFF"
                stroke="#888"
                strokeWidth={0.8}
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={handleDialPointerDown}
              />

              {/* 큐볼 따라가는 점선 십자 (당점 reference, 매우 연하게) */}
              <g
                stroke="#1F1F2E"
                strokeWidth={0.4}
                strokeDasharray="1.5 2"
                opacity={0.25}
                pointerEvents="none"
                transform={`translate(${cueDialCx - CUE_BALL_DIAL_CX}, 0)`}
              >
                <line x1={20 - CUE_DOT_RANGE} y1={0} x2={20 + CUE_DOT_RANGE} y2={0} />
                <line x1={20} y1={-CUE_DOT_RANGE} x2={20} y2={CUE_DOT_RANGE} />
              </g>

              {/* 1.5팁 점선 가이드 원 (당점 보조) — 큐볼 따라가기, 연하게 */}
              <circle
                cx={cueDialCx}
                cy={0}
                r={CUE_DOT_RANGE * 0.5}
                fill="none"
                stroke="#1F1F2E"
                strokeWidth={0.4}
                strokeDasharray="1.5 2"
                opacity={0.3}
                pointerEvents="none"
              />

              {/* 시계 라벨 — 큐볼 안 (3팁 max 영역 안쪽 가장자리) */}
              <g
                fill="#1F1F2E"
                fontSize={5.5}
                textAnchor="middle"
                pointerEvents="none"
                opacity={0.6}
                transform={`translate(${cueDialCx - CUE_BALL_DIAL_CX}, 0)`}
              >
                <text x={20} y={-CUE_DOT_RANGE + 1}>12</text>
                <text x={20 + CUE_DOT_RANGE - 2} y={2}>3</text>
                <text x={20} y={CUE_DOT_RANGE + 1}>6</text>
                <text x={20 - CUE_DOT_RANGE + 2} y={2}>9</text>
              </g>

              {/* 당점 빨간 점 (큐볼 따라가기) */}
              <circle
                cx={cueDialCx + cue.a * CUE_DOT_RANGE}
                cy={-cue.b * CUE_DOT_RANGE}
                r={3.5}
                fill="#D63030"
                pointerEvents="none"
              />

              {/* 권장 당점 — 시스템 표준 (activeExample 없을 때) */}
              {recommendedImpact && !activeExample && (
                <circle
                  cx={cueDialCx + recommendedImpact.a * CUE_DOT_RANGE}
                  cy={-recommendedImpact.b * CUE_DOT_RANGE}
                  r={3.5}
                  fill="none"
                  stroke="#FACA15"
                  strokeWidth={1.4}
                  opacity={0.9}
                  pointerEvents="none"
                >
                  <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              {/* 활성 예제 추천 당점 — 파란 점선 ring */}
              {activeExample && (
                <g pointerEvents="none">
                  <circle
                    cx={cueDialCx + activeExample.cueA * CUE_DOT_RANGE}
                    cy={-activeExample.cueB * CUE_DOT_RANGE}
                    r={4}
                    fill="none"
                    stroke="#0066CA"
                    strokeWidth={1.2}
                    strokeDasharray="2 1.5"
                    opacity={0.85}
                  />
                  <line
                    x1={cueDialCx + activeExample.cueA * CUE_DOT_RANGE - 2}
                    y1={-activeExample.cueB * CUE_DOT_RANGE}
                    x2={cueDialCx + activeExample.cueA * CUE_DOT_RANGE + 2}
                    y2={-activeExample.cueB * CUE_DOT_RANGE}
                    stroke="#0066CA"
                    strokeWidth={0.8}
                    opacity={0.85}
                  />
                  <line
                    x1={cueDialCx + activeExample.cueA * CUE_DOT_RANGE}
                    y1={-activeExample.cueB * CUE_DOT_RANGE - 2}
                    x2={cueDialCx + activeExample.cueA * CUE_DOT_RANGE}
                    y2={-activeExample.cueB * CUE_DOT_RANGE + 2}
                    stroke="#0066CA"
                    strokeWidth={0.8}
                    opacity={0.85}
                  />
                </g>
              )}
            </>
          );
        })()}
      </g>

      {/* STROKE 라벨 — STRIKE 박스 가운데(절대 cx=185) 정렬 */}
      <text
        x={185}
        y={13}
        fill="#1F1F2E"
        fontSize={8}
        textAnchor="middle"
        fontWeight={600}
        pointerEvents="none"
      >
        STROKE · {labels.v0}
      </text>

      {/* STROKE 게이지 — 가운데 절대 cx=185.
          STRIKE 박스 (chip group offset 8 + x=151, width=52, 가운데 26) → 절대 8+151+26=185. */}
      <g transform="translate(175, 18)">
        <rect width={20} height={80} rx={4} fill="#FFFFFF" fillOpacity={0.5} pointerEvents="none" />
        <rect
          y={80 - gaugeFill}
          width={20}
          height={gaugeFill}
          rx={4}
          fill="url(#strokeBar)"
          pointerEvents="none"
        />
        {/* 드래그 hit area (게이지 영역) */}
        <rect
          x={-4}
          y={-4}
          width={28}
          height={88}
          fill="transparent"
          style={{ cursor: 'ns-resize', touchAction: 'none' }}
          onPointerDown={handleGaugePointerDown}
        />

        {/* 활성 예제 추천 V0 마커 */}
        {activeExample && (
          <g pointerEvents="none">
            {(() => {
              const recY = 80 - Math.max(0, Math.min(80, (activeExample.cueV0 / MAX_V0) * 80));
              return (
                <>
                  <line
                    x1={-2}
                    x2={22}
                    y1={recY}
                    y2={recY}
                    stroke="#0066CA"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                    opacity={0.85}
                  />
                  <polygon
                    points={`-5,${recY - 3} -1,${recY} -5,${recY + 3}`}
                    fill="#0066CA"
                    opacity={0.85}
                  />
                </>
              );
            })()}
          </g>
        )}
      </g>

      {/* 라벨 줄 (동적 텍스트) — 두 공 가운데(절대 cx=92)와 정렬, chip 우측 이동.
          두께 chip x=28 (가운데 44), 당점 x=64 width=40 (가운데 84), 회전 x=108 width=28 (가운데 122). */}
      <g transform="translate(8, 104)">
        {/* 두께 */}
        <rect x={28} width={32} height={18} rx={4} fill="#FACA15" pointerEvents="none" />
        <text
          x={44}
          y={13}
          fill="#1F1F2E"
          fontSize={9}
          textAnchor="middle"
          fontWeight={700}
          pointerEvents="none"
        >
          {labels.thickness}
        </text>

        {/* 당점 (시계) — chip 가운데 절대 cx=92 = 두 공 가운데 정렬 */}
        <rect x={64} width={40} height={18} rx={4} fill="#1F1F2E" pointerEvents="none" />
        <text
          x={84}
          y={13}
          fill="#FAFAFA"
          fontSize={9}
          textAnchor="middle"
          fontWeight={700}
          pointerEvents="none"
        >
          {labels.clock}
        </text>

        {/* 회전 */}
        <rect x={108} width={28} height={18} rx={4} fill="#0066ca" pointerEvents="none" />
        <text
          x={122}
          y={13}
          fill="#FAFAFA"
          fontSize={9}
          textAnchor="middle"
          fontWeight={700}
          pointerEvents="none"
        >
          {labels.tips}
        </text>

        {/* STRIKE 박스 — chip 행 안, 가운데 절대 cx=185 = STROKE 게이지 정렬.
            chip group translate(8, 104) 안에서 x=151, width=52 → 절대 (159~211), 가운데 8+151+26=185.
            적구 우단 max (1/8 두께) = 152, STRIKE 좌단 159 → 7px 여유. */}
        <rect
          x={151}
          width={52}
          height={18}
          rx={4}
          fill="#E63946"
          style={{ cursor: 'pointer', touchAction: 'none' }}
          onPointerDown={handleStrike}
        />
        <text
          x={177}
          y={13}
          fill="#FFFFFF"
          fontSize={9}
          textAnchor="middle"
          fontWeight={700}
          pointerEvents="none"
        >
          STRIKE
        </text>
      </g>

      {/* 부제 */}
      <g transform="translate(8, 130)" fill="#1F1F2E" fontSize={6} pointerEvents="none">
        <text x={44} textAnchor="middle">두께</text>
        <text x={84} textAnchor="middle">당점</text>
        <text x={122} textAnchor="middle">회전</text>
      </g>

      {/* 시스템 정보 영역 — 시스템명 + 권장 당점 또는 활성 응용 예시 라벨 1줄.
          학습·응용예시 적용·영상강좌는 📖 학습 패널로 이동. */}
      {systemContent && (
        <g
          transform={`translate(0, ${BOX_H})`}
          pointerEvents="none"
        >
          {/* 구분선 */}
          <line
            x1={8}
            x2={BOX_W - 8}
            y1={2}
            y2={2}
            stroke="#1F1F2E"
            strokeWidth={0.5}
            opacity={0.25}
          />
          {/* 시스템명 + (활성 응용 라벨 또는 권장 당점) */}
          <text
            x={8}
            y={13}
            fill="#1F1F2E"
            fontSize={8.5}
            fontWeight={700}
          >
            {systemContent.name.ko}
            {activeApplicationExample
              ? ` · ${activeApplicationExample.label}`
              : recommendedImpact && ` · ${recommendedImpact.label}`}
          </text>
        </g>
      )}

      {/* 기술 정보 영역 — 기술명 1줄. 시스템 영역 아래. */}
      {techniqueContent && (
        <g
          transform={`translate(0, ${BOX_H + (systemContent ? SYSTEM_INFO_H : 0)})`}
          pointerEvents="none"
        >
          {/* 구분선 */}
          <line
            x1={8}
            x2={BOX_W - 8}
            y1={2}
            y2={2}
            stroke="#1F1F2E"
            strokeWidth={0.5}
            opacity={0.25}
          />
          {/* 기술 카테고리·이름·★ */}
          <text
            x={8}
            y={13}
            fill="#1F1F2E"
            fontSize={8.5}
            fontWeight={700}
          >
            {techniqueContent.category === 'shot' ? '샷' : '스트로크'} ·{' '}
            {techniqueContent.name.ko}
            {' '}
            {'★'.repeat(techniqueContent.difficulty)}
          </text>
        </g>
      )}

    </g>
  );
}
