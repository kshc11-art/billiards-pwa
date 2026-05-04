/**
 * DiamondLabels.tsx (v1.1)
 *
 * 시스템 가이드 켰을 때 각 다이아 위에 좌표 라벨을 자동 표시.
 * 시스템마다 다른 라벨링 룰을 systemContent.ts의 getDiamondLabels() 활용.
 *
 * v1.1 변경 (옵션 C — 응용 예시 적용 시 강조):
 *   - 활성 응용 예시 (activeApplicationExampleId)가 있으면
 *     sourceCushion = 출발 색상 (강조 오렌지+글로우),
 *     targetCushion = 도착 색상 (강조 연두+글로우)
 *   - 시스템만 선택했거나 사용자가 공 옮기면 강조 해제 (양쪽 대칭으로 복귀)
 */

import { useAppStore } from './store.ts';
import {
  getDiamondLabels,
  findApplicationExampleById,
  type DiamondLabel,
} from './systemContent.ts';
import type { SystemGuide } from './systems.ts';
import type { SystemContentId } from './systemContent.ts';

// Table.tsx 상수와 동기화
const DIAMOND_X = [83, 163.75, 244.5, 325.25, 406, 486.75, 567.5, 648.25, 729];
const DIAMOND_Y = [26, 106.75, 187.5, 268.25, 349];
const DIAMOND_TOP_Y = 7;
const DIAMOND_BOT_Y = 368;
const DIAMOND_LEFT_X = 64;
const DIAMOND_RIGHT_X = 748;

const LABEL_OFFSET_X = 13;
const LABEL_OFFSET_Y = 12;

const ROLE_COLORS: Record<NonNullable<DiamondLabel['role']>, string> = {
  source: '#FFE066',
  cushion: '#74D0F1',
  target: '#A0FFB6',
  rotation: '#FFC4D8',
  key: '#FFFFFF',
};

const HIGHLIGHT_SOURCE = '#FFB347';
const HIGHLIGHT_TARGET = '#7AFFAB';

type CushionDir = 'top' | 'bottom' | 'left' | 'right';

function guideToContentId(guide: SystemGuide): SystemContentId | null {
  const map: Partial<Record<SystemGuide, SystemContentId>> = {
    fh: 'fh',
    plus: 'plus',
    half: 'half',
    ball: 'ball',
    noenglish: 'noenglish',
    sunrise: 'sunrise',
    minus15: 'minus15',
    minus20: 'minus20',
    plus15: 'plus',
    reverse: 'reverse',
    thirtytwo: 'thirtytwo',
  };
  return map[guide] ?? null;
}

interface LabelStyle {
  fill: string;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  glow: boolean;
}

function getLabelStyle(
  l: DiamondLabel,
  cushion: CushionDir,
  sourceCushion: CushionDir | null,
  targetCushion: CushionDir | null,
): LabelStyle {
  if (sourceCushion === cushion) {
    return {
      fill: HIGHLIGHT_SOURCE,
      fontSize: 10.5,
      fontWeight: 700,
      opacity: 1.0,
      glow: true,
    };
  }
  if (targetCushion === cushion) {
    return {
      fill: HIGHLIGHT_TARGET,
      fontSize: 10.5,
      fontWeight: 700,
      opacity: 1.0,
      glow: true,
    };
  }
  const dim = sourceCushion !== null || targetCushion !== null;
  return {
    fill: ROLE_COLORS[l.role ?? 'source'],
    fontSize: l.bold ? 9 : 7.5,
    fontWeight: l.bold ? 700 : 600,
    opacity: dim ? 0.4 : l.bold ? 0.95 : 0.75,
    glow: false,
  };
}

export default function DiamondLabels() {
  const systemGuide = useAppStore((s) => s.menu.system);
  const activeId = useAppStore((s) => s.activeApplicationExampleId);
  if (systemGuide === 'none' || systemGuide === 'mirror') return null;

  const contentId = guideToContentId(systemGuide);
  if (!contentId) return null;

  const labels = getDiamondLabels(contentId);
  if (!labels) return null;

  let sourceCushion: CushionDir | null = null;
  let targetCushion: CushionDir | null = null;
  if (activeId) {
    const example = findApplicationExampleById(contentId, activeId);
    if (example) {
      sourceCushion = example.sourceCushion ?? null;
      targetCushion = example.targetCushion ?? null;
    }
  }

  const renderLabel = (
    l: DiamondLabel,
    cushion: CushionDir,
    x: number,
    y: number,
    keyPrefix: string,
  ) => {
    const style = getLabelStyle(l, cushion, sourceCushion, targetCushion);
    return (
      <text
        key={`${keyPrefix}-${l.idx}`}
        x={x}
        y={y}
        fill={style.fill}
        fontSize={style.fontSize}
        fontWeight={style.fontWeight}
        textAnchor="middle"
        opacity={style.opacity}
        style={{
          paintOrder: 'stroke',
          stroke: '#000',
          strokeWidth: style.glow ? 1.0 : 0.4,
          strokeOpacity: style.glow ? 0.85 : 0.5,
          filter: style.glow ? 'drop-shadow(0 0 3px currentColor)' : undefined,
        }}
      >
        {l.text}
      </text>
    );
  };

  return (
    <g data-layer="diamond-labels" pointerEvents="none">
      {labels.shortTop.map((l) =>
        renderLabel(
          l,
          'top',
          DIAMOND_X[l.idx],
          DIAMOND_TOP_Y + LABEL_OFFSET_Y + 4,
          'top',
        ),
      )}
      {labels.shortBot.map((l) =>
        renderLabel(
          l,
          'bottom',
          DIAMOND_X[l.idx],
          DIAMOND_BOT_Y - LABEL_OFFSET_Y + 2,
          'bot',
        ),
      )}
      {labels.longLeft.map((l) =>
        renderLabel(
          l,
          'left',
          DIAMOND_LEFT_X + LABEL_OFFSET_X + 6,
          DIAMOND_Y[l.idx] + 2.5,
          'left',
        ),
      )}
      {labels.longRight.map((l) =>
        renderLabel(
          l,
          'right',
          DIAMOND_RIGHT_X - LABEL_OFFSET_X - 4,
          DIAMOND_Y[l.idx] + 2.5,
          'right',
        ),
      )}
    </g>
  );
}
