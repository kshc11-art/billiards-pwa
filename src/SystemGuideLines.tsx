/**
 * SystemGuideLines.tsx (v2.0)
 *
 * 시스템 가이드 라인 표시 정책 (사용자 의도에 맞게 단순화):
 *   - 시스템만 선택: 라인 표시 안 함 (응용 예시 누르기 전엔 어떤 라인이 적용되는지 모르므로 노이즈만 됨).
 *   - 응용 예시 적용: 해당 응용 예시의 큐볼 코너에 맞는 base 라인 1개만 진하게 표시.
 *     4방향 미러링은 큐볼 코너에 맞춰 해당 방향 1개만 선택.
 */

import { useAppStore } from './store.ts';
import {
  getSystemGuideLines,
  findApplicationExampleById,
  type GuideLineCoord,
} from './systemContent.ts';
import type { SystemGuide } from './systems.ts';
import type { SystemContentId } from './systemContent.ts';

function guideToContentId(guide: SystemGuide): SystemContentId | null {
  const map: Partial<Record<SystemGuide, SystemContentId>> = {
    fh: 'fh',
    plus: 'plus',
    half: 'half',
    noenglish: 'noenglish',
    minus20: 'minus20',
    thirtytwo: 'thirtytwo',
  };
  return map[guide] ?? null;
}

/** 라인 시작점에서 큐볼까지 거리. */
function distToCue(line: GuideLineCoord, cue: [number, number]): number {
  const [sx, sy] = line.points[0];
  const dx = sx - cue[0];
  const dy = sy - cue[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export default function SystemGuideLines() {
  const systemGuide = useAppStore((s) => s.menu.system);
  const activeId = useAppStore((s) => s.activeApplicationExampleId);
  if (systemGuide === 'none') return null;

  // 응용 예시 미적용 시 라인 표시 안 함 — 노이즈 방지
  if (!activeId) return null;

  const contentId = guideToContentId(systemGuide);
  if (!contentId) return null;

  const example = findApplicationExampleById(contentId, activeId);
  if (!example) return null;

  const activeCue = example.positions.cue as [number, number];
  const activeSource = example.sourceCushion ?? null;
  const activeTarget = example.targetCushion ?? null;
  if (!activeSource || !activeTarget) return null;

  const lines = getSystemGuideLines(contentId);
  if (lines.length === 0) return null;

  // 큐볼 코너에 맞는 1개 라인만 선택 (sourceCushion·targetCushion 일치 + 큐볼과 가장 가까운 시작점).
  const matched = lines
    .filter(
      (ln) =>
        ln.sourceCushion === activeSource &&
        ln.targetCushion === activeTarget,
    )
    .sort((a, b) => distToCue(a, activeCue) - distToCue(b, activeCue));

  if (matched.length === 0) return null;
  const targetLine = matched[0];

  const pathD =
    'M ' + targetLine.points.map((p) => `${p[0]},${p[1]}`).join(' L ');

  return (
    <g data-layer="system-guide-lines" pointerEvents="none">
      <path
        d={pathD}
        fill="none"
        stroke="#FFB347"
        strokeWidth={2.0}
        strokeOpacity={0.85}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  );
}
