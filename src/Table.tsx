import { useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from './store.ts';
import {
  engineToSvg,
  svgToEngine,
  computeSmoothPathD,
  computeDotFrames,
  BALL_R_SVG,
} from './utils.ts';
import DiamondLabels from './DiamondLabels.tsx';
import SystemGuideLines from './SystemGuideLines.tsx';
import AnalysisLayers from './AnalysisLayers.tsx';

/**
 * Table — 가로 모드 좌표(812×375)로 그리는 당구대.
 *
 * App에서 SVG의 자식 g 그룹 안으로 렌더된다 (단일 SVG 구조).
 * orientation 회전은 App의 외곽 g에서 처리되므로 여기는 항상 가로 좌표.
 *
 * 레이아웃 (v0.15 확정):
 *   외곽           : 0,0 ~ 812,375                   (#000034)
 *   쿠션 띠        : 71,14 ~ 741,361 (670×347)        (#0066ca)
 *   펠트           : 83,26 ~ 729,349 (646×323, 2:1)   (#3399fe)
 *   격자 (8×4)     : 다이아 X/Y와 정확히 정렬, opacity 0.14
 *   다이아 28개     : 위·아래 9+9, 좌·우 5+5 (코너 포함), r=2.8
 *
 * 동작:
 *   - 공 드래그: pointer 이벤트 + setPointerCapture + getScreenCTM().inverse()
 *               → 부모 g의 orientation 회전을 자동 보정 (세로 모드도 정확)
 *   - 큐대: 큐볼 → 첫 번째 적구 방향 자동 (v0.15 검증된 방식)
 *   - 진로: result.pathSvg가 있을 때만 표시 (시뮬 트리거는 5단계)
 *   - 큐대 회전 드래그·시뮬 호출은 5단계에서 추가
 */

// ─ 다이아 좌표 (정사각 격자, 코너 포함) ──────────────
// 펠트 8등분: 가로선 9개 X, 4등분: 세로선 5개 Y
const DIAMOND_X = [83, 163.75, 244.5, 325.25, 406, 486.75, 567.5, 648.25, 729];
const DIAMOND_Y = [26, 106.75, 187.5, 268.25, 349];
const DIAMOND_R = 2.8;
const DIAMOND_TOP_Y = 7;
const DIAMOND_BOT_Y = 368;
const DIAMOND_LEFT_X = 64;
const DIAMOND_RIGHT_X = 748;

// 공 ID → 그라디언트 매핑
const BALL_FILL: Record<string, string> = {
  white: 'url(#ballWhite)',
  yellow: 'url(#ballYellow)',
  red: 'url(#ballRed)',
  red2: 'url(#ballRed)',
};

const BALL_STROKE: Record<string, string> = {
  white: '#777',
  yellow: '#806810',
  red: '#5a0e0e',
  red2: '#5a0e0e',
};

/** 진로 polyline 색 (큐볼은 #FFFFFF 실선 두껍게, 다른 공은 색별 점선 옅게). */
const PATH_COLOR: Record<string, string> = {
  white: '#FFFFFF',
  yellow: '#F5D547',
  red: '#D63030',
  red2: '#D63030',
};

export default function Table() {
  const sys = useAppStore((s) => s.sys);
  // simRev는 sys mutable 변경 추적용 (Zustand 리렌더 트리거)
  const simRev = useAppStore((s) => s.simRev);
  const result = useAppStore((s) => s.result);
  const setBallPos = useAppStore((s) => s.setBallPos);

  // 시스템 가이드 라인 흰 점선은 v0.7.8에서 제거됨 (실제 시뮬 진로와 혼동되어 노이즈).
  // 시스템 가이드는 SystemGuideLines (응용 예시 적용 시 1개 라인) + DiamondLabels로 충분.

  // ── 공 애니메이션 (실시간 frames 따라) ──────────────
  // result 변경 시 0초부터 시작 → frames 마지막까지 60fps로 위치 갱신.
  // 끝나면 최종 위치를 sys에 반영 (연속 플레이).
  // animFrame은 store에 (CueStick이 큐대 숨김 트리거로 사용).
  const animFrame = useAppStore((s) => s.animFrame);
  const setAnimFrame = useAppStore((s) => s.setAnimFrame);
  const applyFinalPositions = useAppStore((s) => s.applyFinalPositions);
  useEffect(() => {
    // preview 모드 (자동 시뮬 디바운스) 또는 result 없을 때 — 애니메이션 X.
    // 사용자가 STRIKE 누른 실제 시뮬만 애니메이션 진행.
    if (!result?.frames || result.preview) {
      setAnimFrame(-1);
      return;
    }
    // 큐볼 정지 시점까지만 애니메이션. continuize는 시뮬 끝까지 frames 만들지만
    // 큐볼이 멈춘 후에도 frames는 동일 위치로 채워짐 → 불필요한 시간 소비.
    // 큐볼 속도(rvw[3..5])가 거의 0인 첫 frame을 끝으로 사용 + 6초 cap.
    const cueBallId = sys.cueBallId;
    const cueBallFrames = result.frames[cueBallId];
    if (!cueBallFrames || cueBallFrames.length === 0) {
      setAnimFrame(-1);
      return;
    }
    const FPS = 60;
    const MAX_SECONDS = 6;
    const stopThreshold = 0.05; // m/s
    let stopFrame = cueBallFrames.length;
    for (let i = 1; i < cueBallFrames.length; i++) {
      const v = cueBallFrames[i].rvw;
      const speed = Math.sqrt(v[3] * v[3] + v[4] * v[4]);
      if (speed < stopThreshold) {
        stopFrame = i;
        break;
      }
    }
    const maxFrames = Math.min(stopFrame, MAX_SECONDS * FPS, cueBallFrames.length);
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const idx = Math.floor(elapsed * 60);
      if (idx >= maxFrames) {
        setAnimFrame(maxFrames - 1);
        // 시뮬 끝 → verdict+frames 캡처 후 600ms 대기.
        // preview가 result를 덮어쓸 수 있으므로 반드시 캡처.
        const cf = result.frames;
        const cv = result.verdict;
        setTimeout(() => {
          useAppStore.getState().applyFinalPositions(cf, cv);
        }, 600);
        return;
      }
      setAnimFrame(idx);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      // raf만 cancel — applyFinalPositions setTimeout은 그대로 진행.
      if (raf) cancelAnimationFrame(raf);
    };
  }, [result, setAnimFrame, applyFinalPositions]);

  // 모든 공의 SVG 좌표
  // animFrame >= 0이면 frames에서 해당 시점 위치, 아니면 sys.balls.rvw 시작 위치.
  const ballSvg = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [id, ball] of Object.entries(sys.balls)) {
      if (animFrame >= 0 && result?.frames?.[id]) {
        const fs = result.frames[id];
        const f = fs[Math.min(animFrame, fs.length - 1)];
        out[id] = engineToSvg(f.rvw[0], f.rvw[1], sys.table);
      } else {
        out[id] = engineToSvg(ball.rvw[0], ball.rvw[1], sys.table);
      }
    }
    return out;
    // simRev/animFrame 둘 다 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sys, simRev, animFrame, result]);

  // ── 공 표면 점(dot) — 흰공·노란공 각 3개 ────────
  // 프레임별 쿼터니언 적분으로 물리 기반 회전 추적.
  const ballDots = useMemo(() => {
    if (!result?.frames) return null;
    const out: Record<string, ReturnType<typeof computeDotFrames>> = {};
    for (const id of ['white', 'yellow']) {
      const ball = sys.balls[id];
      const frames = result.frames[id];
      if (!ball || !frames || frames.length < 2) continue;
      out[id] = computeDotFrames(frames, ball.params.R, BALL_R_SVG);
    }
    return Object.keys(out).length > 0 ? out : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, sys]);

  // 현재 프레임의 점 위치 (애니메이션 중에만)
  const dotsNow = useMemo(() => {
    if (!ballDots || animFrame < 0) return null;
    const out: Record<string, ReturnType<typeof computeDotFrames>[0]> = {};
    for (const [id, frames] of Object.entries(ballDots)) {
      const idx = Math.min(animFrame, frames.length - 1);
      out[id] = frames[idx];
    }
    return out;
  }, [ballDots, animFrame]);

  // 공 드래그
  const handleBallPointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>, ballId: string) => {
      const target = e.currentTarget;
      const svg = target.ownerSVGElement;
      if (!svg) return;
      target.setPointerCapture(e.pointerId);
      const ballR = sys.balls[ballId]?.params.R ?? 0.0307;

      const pointFromEvent = (ev: PointerEvent): [number, number] | null => {
        // ball의 누적 변환(부모 g rotate 포함) inverse로 가로 모드 좌표 복원
        const ctm = target.getScreenCTM();
        if (!ctm) return null;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        const local = pt.matrixTransform(ctm.inverse());
        return [local.x, local.y];
      };

      const onMove = (ev: PointerEvent) => {
        const local = pointFromEvent(ev);
        if (!local) return;
        const [ex, ey] = svgToEngine(local[0], local[1], sys.table, true, ballR);
        setBallPos(ballId, ex, ey);
      };

      const onUp = (ev: PointerEvent) => {
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* 이미 해제됨 */
        }
        target.removeEventListener('pointermove', onMove as EventListener);
        target.removeEventListener('pointerup', onUp as EventListener);
        target.removeEventListener('pointercancel', onUp as EventListener);
      };

      target.addEventListener('pointermove', onMove as EventListener);
      target.addEventListener('pointerup', onUp as EventListener);
      target.addEventListener('pointercancel', onUp as EventListener);
    },
    [sys, setBallPos]
  );

  return (
    <g data-component="table">
      <defs>
        {/* 공 그라디언트 (좌상에서 빛이 들어오는 듯한 하이라이트) */}
        <radialGradient id="ballWhite" cx="0.35" cy="0.30" r="0.65">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#F0F0F0" />
          <stop offset="0.85" stopColor="#C8C8C8" />
          <stop offset="1" stopColor="#888888" />
        </radialGradient>
        <radialGradient id="ballYellow" cx="0.35" cy="0.30" r="0.65">
          <stop offset="0" stopColor="#FFF4A8" />
          <stop offset="0.4" stopColor="#F5D547" />
          <stop offset="0.85" stopColor="#B89420" />
          <stop offset="1" stopColor="#7A6210" />
        </radialGradient>
        <radialGradient id="ballRed" cx="0.35" cy="0.30" r="0.65">
          <stop offset="0" stopColor="#FF8888" />
          <stop offset="0.4" stopColor="#D63030" />
          <stop offset="0.85" stopColor="#A01818" />
          <stop offset="1" stopColor="#601010" />
        </radialGradient>

        {/* 공 그림자 */}
        <filter id="ballShadow" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="1" dy="1.5" stdDeviation="1.8" floodColor="#000020" floodOpacity="0.35" />
        </filter>
        {/* 공 하이라이트 (작은 흰색 반사점) */}
        <radialGradient id="ballHighlight" cx="0.32" cy="0.28" r="0.25">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* 큐대 그라디언트는 CueStick.tsx 안에 정의 (큐대와 함께 분리). */}

        {/* 진로 글로우 */}
        <filter id="pathGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 외곽 배경 */}
      <rect width="812" height="375" fill="#000034" />

      {/* 쿠션 띠 (12px 균등) */}
      <rect x="71" y="14" width="670" height="347" fill="#0066ca" />

      {/* 펠트 */}
      <rect x="83" y="26" width="646" height="323" fill="#3399fe" />

      {/* 격자 (펠트 8×4 등분, 다이아와 정렬) */}
      <g stroke="#FFFFFF" strokeWidth="0.5" opacity="0.14" data-layer="grid">
        {DIAMOND_X.map((x) => (
          <line key={`vx-${x}`} x1={x} y1={26} x2={x} y2={349} />
        ))}
        {DIAMOND_Y.map((y) => (
          <line key={`hy-${y}`} x1={83} y1={y} x2={729} y2={y} />
        ))}
      </g>

      {/* 다이아 28개 */}
      <g fill="#FAFAFA" data-layer="diamonds">
        {DIAMOND_X.map((x) => (
          <circle key={`top-${x}`} cx={x} cy={DIAMOND_TOP_Y} r={DIAMOND_R} />
        ))}
        {DIAMOND_X.map((x) => (
          <circle key={`bot-${x}`} cx={x} cy={DIAMOND_BOT_Y} r={DIAMOND_R} />
        ))}
        {DIAMOND_Y.map((y) => (
          <circle key={`l-${y}`} cx={DIAMOND_LEFT_X} cy={y} r={DIAMOND_R} />
        ))}
        {DIAMOND_Y.map((y) => (
          <circle key={`r-${y}`} cx={DIAMOND_RIGHT_X} cy={y} r={DIAMOND_R} />
        ))}
      </g>

      {/* 시스템 가이드 라인 (다이아 잇는 폴리라인) */}
      <SystemGuideLines />

      {/* 다이아 좌표 라벨 (시스템 켰을 때만 — 시스템마다 다른 라벨 룰) */}
      <DiamondLabels />

      {/* 분석 레이어 (분리각·30°/90°·거리·키스·무회전·충돌점) */}
      <AnalysisLayers />

      {/* 큐대는 CueStick 컴포넌트로 분리 (App.tsx에서 InfoBox 위에 렌더). */}

      {/* 공 (드래그 가능) — 진로 path 아래 */}
      <g data-layer="balls">
        {Object.entries(ballSvg).map(([id, [x, y]]) => {
          const fill = BALL_FILL[id] ?? '#cccccc';
          const stroke = BALL_STROKE[id] ?? '#444';
          const hasDots = id === 'white' || id === 'yellow';
          const dotColor = id === 'white' ? '#C83030' : '#4A2210';
          const dots = hasDots ? dotsNow?.[id] : null;
          // 정지 시 기본 점 — 6개 중 앞면만 표시 (θ<90°인 3~4개)
          const defaultDots = [
            { dx: -1.06, dy: 3.96, opacity: 1.0 },   // 30°,15° (밝음)
            { dx: -6.61, dy: -1.17, opacity: 0.69 },  // 55°,100° (중간)
            { dx: 5.80, dy: 0, opacity: 0.85 },        // 45°,270° (중간)
          ];
          return (
            <g key={id}>
              <circle
                cx={x}
                cy={y}
                r={BALL_R_SVG}
                fill={fill}
                stroke={stroke}
                strokeWidth="0.6"
                filter="url(#ballShadow)"
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={(e) => handleBallPointerDown(e, id)}
              />
              {/* 광택 하이라이트 */}
              <circle
                cx={x}
                cy={y}
                r={BALL_R_SVG}
                fill="url(#ballHighlight)"
                pointerEvents="none"
              />
              {/* 수구 표시 링 — 현재 수구에 파란 점선 링 표시 */}
              {id === sys.cueBallId && (
                <circle
                  cx={x}
                  cy={y}
                  r={BALL_R_SVG + 3}
                  fill="none"
                  stroke="#0088FF"
                  strokeWidth={1.2}
                  strokeDasharray="2 2"
                  strokeOpacity={0.6}
                  pointerEvents="none"
                />
              )}
              {/* 표면 점 — 흰공·노란공 (회전 시 자연스럽게 나타남/사라짐) */}
              {hasDots &&
                (dots ?? defaultDots).map((d, i) => (
                  <circle
                    key={`dot-${id}-${i}`}
                    cx={x + d.dx}
                    cy={y + d.dy}
                    r={1.2}
                    fill={dotColor}
                    fillOpacity={d.opacity * 0.85}
                    pointerEvents="none"
                  />
                ))}
            </g>
          );
        })}
      </g>

      {/* 진로 스무스 패스 (모든 공 — 공 위에 그려서 충돌 직후 진로도 가시).
          큐볼: 흰 실선 두껍게 + 글로우. 다른 공: 색별 점선 옅게.
          RDP 간소화 + Catmull-Rom 스플라인 → 물리 떨림 없는 매끄러운 경로.
          쿠션 반사점은 날카로운 꺾임 유지. */}
      {result?.frames &&
        Object.entries(result.frames).map(([id, frames]) => {
          const d = computeSmoothPathD(frames, sys.table);
          if (!d) return null;
          const isCue = id === sys.cueBallId;
          const color = PATH_COLOR[id] ?? '#FFFFFF';
          return (
            <path
              key={`path-${id}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={isCue ? 2.2 : 1.4}
              strokeOpacity={isCue ? 0.88 : 0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={isCue ? undefined : '4 3'}
              filter={isCue ? 'url(#pathGlow)' : undefined}
              data-layer={`path-${id}`}
              pointerEvents="none"
            />
          );
        })}
    </g>
  );
}
