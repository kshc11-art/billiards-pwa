import { useMemo } from 'react';
import { useAppStore } from './store.ts';
import {
  computeImpactPoints,
  computeKissPoints,
  computeSeparation,
  computeDistanceMarkers,
  computeAngleGuide,
} from './analysis.ts';

/**
 * AnalysisLayers — Table.tsx의 SVG 안에 추가되는 분석 레이어 그룹.
 * 메뉴에서 토글된 layer만 렌더.
 *
 * 렌더링 색상:
 *   impact     — 작은 흰 원 (테두리 #1F1F2E)
 *   kiss       — 빨간 X (#E63946) self / 분홍 X (#FF6F8C) cross
 *   separation — 파란 화살표 (큐볼) + 노란 화살표 (1구)
 *   distance   — 작은 시안 점 + 라벨 (1p, 2p, ...)
 *   angle30    — 청록 직선 가이드 (90° 수직 + 30° 사선)
 *   noenglish  — 회색 점선 진로
 */
export default function AnalysisLayers() {
  const sys = useAppStore((s) => s.sys);
  const result = useAppStore((s) => s.result);
  const layers = useAppStore((s) => s.menu.layers);
  const simRev = useAppStore((s) => s.simRev);

  const enabled = useMemo(() => new Set(layers), [layers]);

  // ── 데이터 계산 (이벤트 기반) ─────────────────
  const impactPoints = useMemo(
    () =>
      result && enabled.has('impact')
        ? computeImpactPoints(result.events, sys.table)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, enabled, sys.table, simRev]
  );

  const kissPoints = useMemo(
    () =>
      result && enabled.has('kiss')
        ? computeKissPoints(result.events, sys.cueBallId, sys.table)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, enabled, sys.cueBallId, sys.table, simRev]
  );

  const separation = useMemo(
    () =>
      result && enabled.has('separation')
        ? computeSeparation(result.events, sys.cueBallId, sys.table)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, enabled, sys.cueBallId, sys.table, simRev]
  );

  const distanceMarkers = useMemo(
    () =>
      result && enabled.has('distance')
        ? computeDistanceMarkers(result.frames, sys.cueBallId, sys.table)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, enabled, sys.cueBallId, sys.table, simRev]
  );

  // ── 데이터 계산 (정적, 시뮬 결과 무관) ─────────
  const cuePhi = useAppStore((s) => s.cue.phi);
  const cueA = useAppStore((s) => s.cue.a);
  const cueB = useAppStore((s) => s.cue.b);
  const angleGuide = useMemo(
    () =>
      enabled.has('angle30')
        ? computeAngleGuide(sys, sys.table, cuePhi, cueA, cueB)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, sys, cuePhi, cueA, cueB, simRev]
  );

  const noenglishPath = result?.noenglishPathSvg ?? '';

  if (layers.length === 0) return null;

  return (
    <g data-component="analysis-layers" pointerEvents="none">
      {/* 무회전 비교 진로 (회색 점선) */}
      {enabled.has('noenglish') && noenglishPath && (
        <polyline
          points={noenglishPath}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.5}
          strokeWidth={1.6}
          strokeDasharray="6 4"
        />
      )}

      {/* 다중 당점 비교 (12시·1시·2시·9시 4개 진로) */}
      {enabled.has('multipath') &&
        result?.multipath?.map((mp, i) => {
          // 도착점 좌표 추출 (pathSvg의 마지막 point)
          const pts = mp.pathSvg.split(' ').filter(Boolean);
          const last = pts[pts.length - 1]?.split(',');
          const ex = last?.[0] ? parseFloat(last[0]) : null;
          const ey = last?.[1] ? parseFloat(last[1]) : null;
          return (
            <g key={`mp-${i}`}>
              <polyline
                points={mp.pathSvg}
                fill="none"
                stroke={mp.color}
                strokeOpacity={0.7}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="3 2"
              />
              {ex !== null && ey !== null && (
                <>
                  <circle cx={ex} cy={ey} r={3.5} fill={mp.color} stroke="#1F1F2E" strokeWidth={0.6} />
                  <text
                    x={ex + 5}
                    y={ey - 5}
                    fill={mp.color}
                    fontSize={9}
                    fontWeight={700}
                    stroke="#1F1F2E"
                    strokeWidth={0.4}
                  >
                    {mp.label}
                  </text>
                </>
              )}
            </g>
          );
        })}

      {/* 거리 마커 (1포인트=317.5mm 간격) */}
      {distanceMarkers.map((m, i) => (
        <g key={`dist-${i}`}>
          <circle cx={m.svgX} cy={m.svgY} r={2.4} fill="#5DD0F2" />
          <text
            x={m.svgX + 5}
            y={m.svgY - 5}
            fill="#5DD0F2"
            fontSize={8}
            fontWeight={600}
          >
            {m.label}
          </text>
        </g>
      ))}

      {/* 분리각 화살표 (충돌점 + 두 공 진행 vector) */}
      {separation && (
        <g>
          <line
            x1={separation.contact[0]}
            y1={separation.contact[1]}
            x2={separation.cueArrowEnd[0]}
            y2={separation.cueArrowEnd[1]}
            stroke="#5DD0F2"
            strokeWidth={2}
            markerEnd="url(#arrowhead-cue)"
          />
          <line
            x1={separation.contact[0]}
            y1={separation.contact[1]}
            x2={separation.targetArrowEnd[0]}
            y2={separation.targetArrowEnd[1]}
            stroke="#FACA15"
            strokeWidth={2}
            markerEnd="url(#arrowhead-tgt)"
          />
          <circle
            cx={separation.contact[0]}
            cy={separation.contact[1]}
            r={3}
            fill="#FFFFFF"
            stroke="#1F1F2E"
            strokeWidth={1}
          />
          <text
            x={separation.contact[0] + 8}
            y={separation.contact[1] - 10}
            fill="#FFFFFF"
            fontSize={9}
            fontWeight={700}
            stroke="#1F1F2E"
            strokeWidth={0.4}
          >
            {Math.round(separation.angleDeg)}°
          </text>
        </g>
      )}

      {/* 동적 분리각 가이드 (두께·b 기반) */}
      {angleGuide && (
        <g fill="none">
          {/* 1구 진행 (충돌선 연장) */}
          <line
            x1={angleGuide.origin[0]}
            y1={angleGuide.origin[1]}
            x2={angleGuide.targetForward[0]}
            y2={angleGuide.targetForward[1]}
            stroke="#FACA15"
            strokeOpacity={0.85}
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          {/* 큐볼 분리 (두께·b 보정 적용) */}
          <line
            x1={angleGuide.origin[0]}
            y1={angleGuide.origin[1]}
            x2={angleGuide.cueDirection[0]}
            y2={angleGuide.cueDirection[1]}
            stroke="#5DD0F2"
            strokeOpacity={0.85}
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          {/* 라벨 */}
          <text
            x={angleGuide.origin[0] + 8}
            y={angleGuide.origin[1] - 14}
            fill="#5DD0F2"
            fontSize={9}
            fontWeight={700}
            stroke="#1F1F2E"
            strokeWidth={0.4}
          >
            {angleGuide.label}
          </text>
        </g>
      )}

      {/* 충돌점 마커 */}
      {impactPoints.map((p, i) => (
        <circle
          key={`impact-${i}`}
          cx={p.svgX}
          cy={p.svgY}
          r={p.kind === 'cushion' ? 3 : 4}
          fill={p.kind === 'cushion' ? '#FFFFFF' : '#FACA15'}
          stroke="#1F1F2E"
          strokeWidth={1}
        />
      ))}

      {/* 키스 마커 (X자) */}
      {kissPoints.map((p, i) => {
        const color = p.kind === 'self' ? '#E63946' : '#FF6F8C';
        const sz = 5;
        return (
          <g key={`kiss-${i}`}>
            <line
              x1={p.svgX - sz}
              y1={p.svgY - sz}
              x2={p.svgX + sz}
              y2={p.svgY + sz}
              stroke={color}
              strokeWidth={2.2}
            />
            <line
              x1={p.svgX - sz}
              y1={p.svgY + sz}
              x2={p.svgX + sz}
              y2={p.svgY - sz}
              stroke={color}
              strokeWidth={2.2}
            />
          </g>
        );
      })}

      {/* 화살표 마커 정의 */}
      <defs>
        <marker
          id="arrowhead-cue"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#5DD0F2" />
        </marker>
        <marker
          id="arrowhead-tgt"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#FACA15" />
        </marker>
      </defs>
    </g>
  );
}
