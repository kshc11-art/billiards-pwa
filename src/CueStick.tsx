import { useCallback, useMemo } from 'react';
import { useAppStore } from './store.ts';
import {
  engineToSvg,
  computeCueLineByPhi,
  svgAngleToEnginePhi,
} from './utils.ts';

/**
 * CueStick — 큐대 line + tip + 회전 드래그 hit area + 그라디언트.
 *
 * Table에서 분리한 이유:
 *   App.tsx에서 SVG 렌더 순서: Table → InfoBox → CueStick.
 *   InfoBox(우상단)와 큐대가 겹쳐도 큐대가 위에 보이도록.
 *
 * 회전 그룹 안에 렌더되어야 정상 좌표 (App.tsx에서 두 번째 <g transform=gameTransform> 안).
 */
export default function CueStick() {
  const sys = useAppStore((s) => s.sys);
  const cuePhi = useAppStore((s) => s.cue.phi);
  const setCue = useAppStore((s) => s.setCue);
  const simRev = useAppStore((s) => s.simRev);
  // 애니메이션 중에는 큐대 숨김 (animFrame >= 0 = 시뮬 진행 중)
  const animFrame = useAppStore((s) => s.animFrame);

  const cueLine = useMemo(() => {
    const cb = sys.balls[sys.cueBallId];
    if (!cb) return null;
    const cueBallSvg = engineToSvg(cb.rvw[0], cb.rvw[1], sys.table);
    return computeCueLineByPhi(cueBallSvg, cuePhi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sys, cuePhi, simRev]);

  const handleCueRotate = useCallback(
    (e: React.PointerEvent<SVGLineElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      const svg = target.ownerSVGElement;
      if (!svg) return;
      target.setPointerCapture(e.pointerId);

      const cueBall = sys.balls[sys.cueBallId];
      if (!cueBall) return;
      const cueBallSvg = engineToSvg(cueBall.rvw[0], cueBall.rvw[1], sys.table);

      const pointFromEvent = (ev: PointerEvent): [number, number] | null => {
        const ctm = target.getScreenCTM();
        if (!ctm) return null;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        const local = pt.matrixTransform(ctm.inverse());
        return [local.x, local.y];
      };

      const update = (ev: PointerEvent) => {
        const sp = pointFromEvent(ev);
        if (!sp) return;
        const phi = svgAngleToEnginePhi(sp, cueBallSvg);
        setCue({ phi, phiAuto: false });
      };

      const onMove = (ev: PointerEvent) => update(ev);
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
    [sys, setCue]
  );

  if (!cueLine) return null;
  // 시뮬 애니메이션 중에는 큐대 숨김 (실제 당구처럼 STRIKE 후 큐대가 사라짐)
  if (animFrame >= 0) return null;

  return (
    <g data-layer="cue">
      {/* userSpaceOnUse 그라디언트 — 수직 큐대도 정상 표시 */}
      <defs>
        <linearGradient
          id="cueStickGradient"
          gradientUnits="userSpaceOnUse"
          x1={cueLine.butt[0]}
          y1={cueLine.butt[1]}
          x2={cueLine.tip[0]}
          y2={cueLine.tip[1]}
        >
          <stop offset="0" stopColor="#3A2410" />
          <stop offset="0.55" stopColor="#8B5A2B" />
          <stop offset="1" stopColor="#D2A06D" />
        </linearGradient>
        {/* 큐대 그림자 */}
        <filter id="cueShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.4" />
        </filter>
      </defs>
      <line
        x1={cueLine.butt[0]}
        y1={cueLine.butt[1]}
        x2={cueLine.tip[0]}
        y2={cueLine.tip[1]}
        stroke="url(#cueStickGradient)"
        strokeWidth="6.5"
        strokeLinecap="round"
        filter="url(#cueShadow)"
        pointerEvents="none"
      />
      {/* 큐대 팁 */}
      <circle
        cx={cueLine.tip[0]}
        cy={cueLine.tip[1]}
        r="3.4"
        fill="#F0F0F0"
        pointerEvents="none"
      />
      {/* 회전 드래그용 invisible hit area */}
      <line
        x1={cueLine.butt[0]}
        y1={cueLine.butt[1]}
        x2={cueLine.tip[0]}
        y2={cueLine.tip[1]}
        stroke="transparent"
        strokeWidth="22"
        strokeLinecap="round"
        pointerEvents="stroke"
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={handleCueRotate}
      />
    </g>
  );
}
