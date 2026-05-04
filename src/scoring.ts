import type { EngineEvent } from './utils.ts';

/**
 * 자동 점수 판정 (research.md Part 8·9 룰).
 *
 * 3쿠션 UMB/KBF (research.md 9.2):
 *   - 자기 수구가 두 적구 모두 적중
 *   - 두 번째 적구 적중 직전까지 cushion ≥ 3
 *   → +1점
 *
 * 4구 KBF (research.md 8.2):
 *   - 자기 수구로 두 빨강 모두 적중 → +1점 (흰공 적중 무관)
 *
 * 4구 AMATEUR / 동네 룰 (research.md 8.3):
 *   - KBF 룰 +
 *   - 흰공(상대 수구) 적중 → -1점
 *   - 빈쿠션 보너스: 첫 적구 적중 전 cushion ≥1 → +2점
 *   - (마무리 3쿠션 의무: 게임 상태 추적 필요. v0.2-B에서 미구현)
 */

export type FourBallMode = 'kbf' | 'amateur';

export interface ScoreVerdict {
  /** 양의 점수가 발생했는가. */
  scored: boolean;
  /** 점수 변화. 음수 가능 (AMATEUR 흰공 적중). */
  delta: number;
  /** UI 노출 라벨 (요약). */
  reason: string;
  /** 큐볼 충돌 시퀀스 (디버그·타임라인용). */
  sequence: string[];
}

// 큐볼 관련 events만 시간순 추출
function extractMyEvents(
  events: EngineEvent[],
  cueBallId: string
): EngineEvent[] {
  return events.filter((e) => {
    if (e.type === 'ball_cushion') return e.ballId === cueBallId;
    if (e.type === 'ball_ball') {
      const ids = e.ids;
      return Array.isArray(ids) && ids.includes(cueBallId);
    }
    return false;
  });
}

// ball_ball event에서 큐볼 외 다른 공의 id 반환
function otherBallId(e: EngineEvent, cueBallId: string): string | null {
  const ids = e.ids;
  if (!Array.isArray(ids)) return null;
  return ids[0] === cueBallId ? ids[1] : ids[0];
}

// ════════════════════════════════════════════════════════════════
// 3쿠션 UMB/KBF 판정
// ════════════════════════════════════════════════════════════════

export function judgeThreeCushion(
  events: EngineEvent[],
  cueBallId: string
): ScoreVerdict {
  const my = extractMyEvents(events, cueBallId);
  let cushion = 0;
  const hit = new Set<string>();
  const seq: string[] = [];

  for (const e of my) {
    if (e.type === 'ball_cushion') {
      cushion++;
      seq.push(`C${cushion}`);
    } else if (e.type === 'ball_ball') {
      const other = otherBallId(e, cueBallId);
      if (!other) continue;
      hit.add(other);
      seq.push(other);
      if (hit.size === 2) {
        if (cushion >= 3) {
          return {
            scored: true,
            delta: 1,
            reason: `득점 (3쿠션 ${cushion}회 후 두 적구)`,
            sequence: seq,
          };
        }
        return {
          scored: false,
          delta: 0,
          reason: `미달 (쿠션 ${cushion}회, 3회 필요)`,
          sequence: seq,
        };
      }
    }
  }

  return {
    scored: false,
    delta: 0,
    reason:
      hit.size === 0
        ? '적구 미적중'
        : hit.size === 1
          ? `1개 적구만 적중 (${[...hit].join(', ')})`
          : '판정 불가',
    sequence: seq,
  };
}

// ════════════════════════════════════════════════════════════════
// 4구 KBF + AMATEUR 판정
// ════════════════════════════════════════════════════════════════

export function judgeFourBall(
  events: EngineEvent[],
  cueBallId: string,
  mode: FourBallMode,
  isMatchPoint = false
): ScoreVerdict {
  const my = extractMyEvents(events, cueBallId);
  const reds = new Set<string>();
  let opponentHit = false;
  let cushBeforeFirst = 0;
  let firstBallHit = false;
  let totalCushion = 0;
  const seq: string[] = [];

  for (const e of my) {
    if (e.type === 'ball_cushion') {
      totalCushion++;
      if (!firstBallHit) cushBeforeFirst++;
      seq.push('C');
    } else if (e.type === 'ball_ball') {
      const other = otherBallId(e, cueBallId);
      if (!other) continue;
      firstBallHit = true;
      if (other === 'red' || other === 'red2') {
        reds.add(other);
      } else {
        // 'yellow' 또는 상대 흰공으로 간주
        opponentHit = true;
      }
      seq.push(other);
    }
  }

  let delta = 0;
  const reasons: string[] = [];

  if (reds.size === 2) {
    delta += 1;
    reasons.push('빨강 둘 +1');
  }
  if (mode === 'amateur') {
    if (opponentHit) {
      delta -= 1;
      reasons.push('흰공 −1');
    }
    if (reds.size === 2 && cushBeforeFirst >= 1) {
      delta += 2;
      reasons.push(`빈쿠션 +2 (${cushBeforeFirst}쿠션)`);
    }
  }

  // 마무리 3쿠션 의무 (AMATEUR + 매치포인트 + 양수 점수 + cushion < 3 → 0점)
  if (mode === 'amateur' && isMatchPoint && delta > 0 && totalCushion < 3) {
    return {
      scored: false,
      delta: 0,
      reason: `마무리 3쿠션 미달 (총 ${totalCushion}쿠션, 매치포인트는 3쿠션 필요)`,
      sequence: seq,
    };
  }

  let reason: string;
  if (reasons.length > 0) {
    reason = reasons.join(', ');
  } else if (reds.size < 2) {
    reason = reds.size === 0 ? '빨강 미적중' : '빨강 1개만';
  } else {
    reason = '득점 조건 미충족';
  }

  return { scored: delta > 0, delta, reason, sequence: seq };
}
