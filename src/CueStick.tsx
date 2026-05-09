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
      <defs>
        <linearGradient
          id="cueStickGradient"
          gradientUnits="userSpaceOnUse"
          x1={cueLine.butt[0]}
          y1={cueLine.butt[1]}
          x2={cueLine.tip[0]}
          y2={cueLine.tip[1]}
        >
          <stop offset="0" stopColor="#2A1808" />
          <stop offset="0.15" stopColor="#4A2A14" />
          <stop offset="0.50" stopColor="#8B5A2B" />
          <stop offset="0.85" stopColor="#C49A6C" />
          <stop offset="1" stopColor="#D8B48A" />
        </linearGradient>
        <filter id="cueShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0.5" dy="1.5" stdDeviation="1.5" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* 큐대 본체 (테이퍼: butt 7px → tip 4.5px) */}
      {(() => {
        const bx = cueLine.butt[0], by = cueLine.butt[1];
        const tx = cueLine.tip[0], ty = cueLine.tip[1];
        const len = Math.hypot(tx - bx, ty - by);
        if (len < 1) return null;
        const ux = (tx - bx) / len, uy = (ty - by) / len;
        const px = -uy, py = ux; // 수직 방향
        const bw = 3.5, tw = 2.2; // 반폭 (butt, tip)
        // 페럴 위치 (팁에서 8px)
        const ferruleLen = 8;
        const fx = tx - ux * ferruleLen, fy = ty - uy * ferruleLen;
        const fw = tw + (bw - tw) * (ferruleLen / len); // 페럴 폭
        // 그립 밴드 위치 (butt에서 20-30px)
        const g1x = bx + ux * 12, g1y = by + uy * 12;
        const g2x = bx + ux * 28, g2y = by + uy * 28;
        const gw1 = bw - (bw - tw) * (12 / len);
        const gw2 = bw - (bw - tw) * (28 / len);

        return (
          <>
            {/* 본체 (테이퍼 사다리꼴) */}
            <polygon
              points={`${bx + px*bw},${by + py*bw} ${fx + px*fw},${fy + py*fw} ${fx - px*fw},${fy - py*fw} ${bx - px*bw},${by - py*bw}`}
              fill="url(#cueStickGradient)"
              filter="url(#cueShadow)"
              pointerEvents="none"
            />
            {/* 페럴 (흰색 고리) */}
            <polygon
              points={`${fx + px*fw},${fy + py*fw} ${tx + px*tw},${ty + py*tw} ${tx - px*tw},${ty - py*tw} ${fx - px*fw},${fy - py*fw}`}
              fill="#E8E0D0"
              stroke="#B8B0A0"
              strokeWidth="0.3"
              pointerEvents="none"
            />
            {/* 팁 (가죽, 둥근) */}
            <circle
              cx={tx}
              cy={ty}
              r={tw}
              fill="#6DB4E8"
              stroke="#4A90C4"
              strokeWidth="0.4"
              pointerEvents="none"
            />
            {/* 그립 밴드 */}
            <line
              x1={g1x + px*gw1} y1={g1y + py*gw1}
              x2={g1x - px*gw1} y2={g1y - py*gw1}
              stroke="#1A0E06" strokeWidth="1.5" pointerEvents="none"
            />
            <line
              x1={g2x + px*gw2} y1={g2y + py*gw2}
              x2={g2x - px*gw2} y2={g2y - py*gw2}
              stroke="#1A0E06" strokeWidth="1.5" pointerEvents="none"
            />
          </>
        );
      })()}

      {/* 회전 드래그용 invisible hit area (넓게) */}
      <line
        x1={cueLine.butt[0]}
        y1={cueLine.butt[1]}
        x2={cueLine.tip[0]}
        y2={cueLine.tip[1]}
        stroke="transparent"
        strokeWidth="30"
        strokeLinecap="round"
        pointerEvents="stroke"
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={handleCueRotate}
      />
    </g>
  );
}
