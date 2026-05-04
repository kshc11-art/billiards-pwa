import type { Game } from './utils.ts';

/**
 * 드릴 카테고리 (학습 메뉴 4분류).
 *   기초 — 뒤돌리기·옆돌리기·앞돌리기·빗겨치기 (3쿠션 입문 핵심)
 *   응용 — 뱅크·더블쿠션·더블레일·횡단·리버스 (응용)
 *   4구  — 직접·1쿠션·끌어치기·밀어치기·공모으기·세리
 *   (시스템은 별도 토글 — drill 카테고리 아님)
 */
export type DrillCategory = 'basic' | 'advanced' | '4ball';

/**
 * 드릴 기술 분류 (UI 그룹화 라벨).
 */
export type DrillTechnique =
  // 기초 (3쿠션)
  | 'outside-angle' // 뒤돌리기
  | 'side-angle' // 옆돌리기
  | 'long-angle' // 앞돌리기
  | 'bias-angle' // 빗겨치기
  // 응용 (3쿠션)
  | 'bank' // 뱅크샷
  | 'double-cushion' // 더블쿠션
  | 'double-rail' // 더블레일
  | 'cross' // 횡단샷
  | 'reverse' // 리버스
  // 4구
  | 'direct' // 4구 직접 맞히기
  | 'one-cushion' // 4구 1쿠션
  | 'draw' // 4구 끌어치기
  | 'follow' // 4구 밀어치기
  | 'crossing' // 4구 1쿠션 공모으기
  | 'serie'; // 4구 세리

export type DrillDifficulty = 1 | 2 | 3 | 4 | 5;

/**
 * 권장 표준값 (research.md Part 6 + 5.x 기준).
 * 학습자가 드릴 로드 시 InfoBox에 자동 적용 (v0.3+ 예정).
 */
export interface RecommendedShot {
  /** 두께 (분수, 1.0=정통 ~ 0.0=빗나감). */
  fullness: number;
  /** 시계 표기 (12:00, 1:30 등). */
  clock: string;
  /** 팁 수 (0~3). */
  tips: number;
  /** V0 (m/s). */
  v0: number;
}

export interface Drill {
  /** "OA-1-1" 등 research.md 식별자. UI에 그대로 노출. */
  id: string;
  game: Game;
  category: DrillCategory;
  technique: DrillTechnique;
  /** 한국어 제목 (research.md 기준). */
  title: string;
  difficulty: DrillDifficulty;
  /** 한 줄 학습 목표. */
  description: string;
  /**
   * 시작 좌표 (엔진, m 단위, x=폭 0~W, y=길이 0~L).
   * 한국 중대 1.27×2.54 기준 (research.md 7.10 — 1포인트 = 317.5mm).
   * 3쿠션 드릴: white(큐볼) + yellow(1구) + red(2구)
   * 4구 드릴: white(큐볼) + red(1구) + red2(2구) + yellow(상대 수구, 자동 default)
   */
  balls: {
    white: [number, number];
    yellow: [number, number];
    red: [number, number];
    red2?: [number, number];
  };
  /** 권장 시스템 (드릴 로드 시 자동 선택). */
  recommendedSystem?: 'fh' | 'plus' | 'half' | 'mirror';
  /** 권장 표준값 (research.md Part 5 매트릭스 + 7.x 드릴별). */
  shot?: RecommendedShot;
}

// ════════════════════════════════════════════════════════════════
// research.md 27개 드릴 좌표 변환
//   원본: (장축mm, 단축mm) = (y, x), 1포인트 = 317.5mm
//   변환: engine.x = drill[1] / 1000, engine.y = drill[0] / 1000
//   3쿠션: 1구→yellow, 2구→red
//   4구  : 1구→red, 2구→red2, yellow는 default 위치 (W/2, 0.318)
// ════════════════════════════════════════════════════════════════

// 4구 yellow default (상대 수구, 머리 측 중앙). 4구 점수 판정 시 회피 대상.
const YELLOW_DEFAULT: [number, number] = [0.635, 0.318];

export const drills: Drill[] = [
  // ── 기초 — 뒤돌리기 (Outside Angle) 7종 ──────────────────────
  {
    id: 'OA-1-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'outside-angle',
    title: '뒤돌리기 1-1 (두툼하게)',
    difficulty: 1,
    description: '1구를 두툼하게 쳐서 키스 제거 + 다음 포지션 형성',
    balls: {
      white: [0.318, 0.635],
      yellow: [0.635, 1.27],
      red: [0.953, 2.222],
    },
    recommendedSystem: 'fh',
    shot: { fullness: 0.667, clock: '1:30', tips: 3, v0: 2.5 },
  },
  {
    id: 'OA-1-4',
    game: 'three_cushion',
    category: 'basic',
    technique: 'outside-angle',
    title: '뒤돌리기 1-4 (연속득점)',
    difficulty: 2,
    description: '연속득점용 1구 흐름 + 키스 제거',
    balls: {
      white: [0.4, 0.76],
      yellow: [0.6, 1.4],
      red: [0.85, 2.1],
    },
    recommendedSystem: 'fh',
    shot: { fullness: 0.5, clock: '1:30', tips: 2, v0: 2.5 },
  },
  {
    id: 'OA-2-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'outside-angle',
    title: '뒤돌리기 2-1 (앞 교차)',
    difficulty: 3,
    description: '수구가 1구 앞으로 교차하는 분리각',
    balls: {
      white: [1.1, 1.7],
      yellow: [0.6, 1.3],
      red: [0.2, 0.4],
    },
    recommendedSystem: 'fh',
    shot: { fullness: 0.333, clock: '2:00', tips: 3, v0: 2.5 },
  },
  {
    id: 'OA-3-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'outside-angle',
    title: '뒤돌리기 3-1 (뒤 교차)',
    difficulty: 3,
    description: '수구가 1구 뒤로 교차 (키스 위치 반대)',
    balls: {
      white: [1.0, 0.5],
      yellow: [0.7, 1.1],
      red: [0.9, 2.0],
    },
    recommendedSystem: 'fh',
    shot: { fullness: 0.5, clock: '1:30', tips: 3, v0: 2.5 },
  },
  {
    id: 'OA-4-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'outside-angle',
    title: '뒤돌리기 4 (1구 대회전)',
    difficulty: 4,
    description: '1구를 대회전 시키며 4쿠션 이상',
    balls: {
      white: [0.95, 1.9],
      yellow: [0.8, 1.3],
      red: [0.95, 0.35],
    },
    recommendedSystem: 'fh',
    shot: { fullness: 0.667, clock: '1:00', tips: 3, v0: 4.0 },
  },
  {
    id: 'OA-5-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'outside-angle',
    title: '뒤돌리기 5 (스핀, 맥스)',
    difficulty: 5,
    description: '맥스 회전 활용, 짧은 각 길게',
    balls: {
      white: [0.25, 1.9],
      yellow: [0.6, 1.5],
      red: [0.25, 0.25],
    },
    shot: { fullness: 0.25, clock: '3:00', tips: 3, v0: 3.0 },
  },
  {
    id: 'OA-7-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'outside-angle',
    title: '뒤돌리기 7 (얇게 키스 회피)',
    difficulty: 5,
    description: '얇은 두께로 키스 회피',
    balls: {
      white: [0.2, 2.2],
      yellow: [0.35, 1.7],
      red: [1.0, 0.3],
    },
    recommendedSystem: 'fh',
    shot: { fullness: 0.25, clock: '1:30', tips: 3, v0: 2.8 },
  },

  // ── 기초 — 옆돌리기 (Side Angle) 3종 ─────────────────────────
  {
    id: 'SA-1-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'side-angle',
    title: '옆돌리기 1-1 (자연각)',
    difficulty: 2,
    description: '자연각 옆돌리기. F&H 기본 적용.',
    balls: {
      white: [0.7, 1.9],
      yellow: [0.5, 1.7],
      red: [0.2, 0.45],
    },
    recommendedSystem: 'fh',
    shot: { fullness: 0.5, clock: '4:30', tips: 2, v0: 2.5 },
  },
  {
    id: 'SA-3-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'side-angle',
    title: '옆돌리기 3 (볼시스템)',
    difficulty: 3,
    description: '볼시스템 적용. 두께·팁 가산.',
    balls: {
      white: [0.8, 1.7],
      yellow: [1.23, 1.9],
      red: [0.25, 0.25],
    },
    shot: { fullness: 0.5, clock: '4:30', tips: 2, v0: 2.5 },
  },
  {
    id: 'SA-7-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'side-angle',
    title: '옆돌리기 7-1 (얇게)',
    difficulty: 4,
    description: '얇은 두께 옆돌리기.',
    balls: {
      white: [0.4, 1.8],
      yellow: [0.7, 1.5],
      red: [0.8, 0.25],
    },
    shot: { fullness: 0.25, clock: '4:30', tips: 3, v0: 2.5 },
  },

  // ── 기초 — 앞돌리기 (Long Angle) 2종 ──────────────────────────
  {
    id: 'LA-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'long-angle',
    title: '앞돌리기 기본 (무회전 1/2)',
    difficulty: 2,
    description: '무회전 1/2 두께 앞돌리기. Plus 시스템 적용.',
    balls: {
      white: [0.8, 1.5],
      yellow: [0.6, 1.3],
      red: [0.2, 0.7],
    },
    recommendedSystem: 'plus',
    shot: { fullness: 0.5, clock: '12:00', tips: 0, v0: 2.0 },
  },
  {
    id: 'LA-DC',
    game: 'three_cushion',
    category: 'basic',
    technique: 'long-angle',
    title: '앞돌리기 대회전 (60-30-30)',
    difficulty: 4,
    description: '대회전. 강타 + 끌림.',
    balls: {
      white: [0.6, 2.1],
      yellow: [0.8, 1.9],
      red: [0.2, 1.9],
    },
    shot: { fullness: 0.5, clock: '2:00', tips: 3, v0: 5.0 },
  },

  // ── 기초 — 빗겨치기 (Bias Angle) 2종 ─────────────────────────
  {
    id: 'BA-1',
    game: 'three_cushion',
    category: 'basic',
    technique: 'bias-angle',
    title: '빗겨치기 기본 (3팁 회전)',
    difficulty: 3,
    description: '3팁 빗겨치기. 일출일몰 시스템 기본.',
    balls: {
      white: [0.3, 0.7],
      yellow: [0.5, 1.2],
      red: [1.0, 2.0],
    },
    shot: { fullness: 0.333, clock: '12:00', tips: 3, v0: 1.6 },
  },
  {
    id: 'BA-3',
    game: 'three_cushion',
    category: 'basic',
    technique: 'bias-angle',
    title: '빗겨치기 3 (장쿠션 길게)',
    difficulty: 4,
    description: '장쿠션 길게. 회전 + 길이 조절.',
    balls: {
      white: [0.25, 1.6],
      yellow: [0.5, 1.8],
      red: [0.95, 2.3],
    },
    shot: { fullness: 0.333, clock: '12:30', tips: 3, v0: 1.8 },
  },

  // ── 응용 — 뱅크샷 (Bank Shot) 2종 ────────────────────────────
  {
    id: 'BANK-1',
    game: 'three_cushion',
    category: 'advanced',
    technique: 'bank',
    title: '1뱅크 넣어치기 (무회전)',
    difficulty: 3,
    description: '무회전 1뱅크. Mirror 또는 Half 시스템.',
    balls: {
      white: [0.6, 1.9],
      yellow: [0.95, 1.1],
      red: [1.1, 0.7],
    },
    recommendedSystem: 'mirror',
    shot: { fullness: 0.5, clock: '12:00', tips: 0, v0: 2.5 },
  },
  {
    id: 'BANK-3',
    game: 'three_cushion',
    category: 'advanced',
    technique: 'bank',
    title: '3뱅크 (F&H 기본)',
    difficulty: 4,
    description: '3뱅크 F&H 기본 적용 패턴.',
    balls: {
      white: [1.175, 2.349],
      yellow: [1.111, 2.444],
      red: [0.984, 1.334],
    },
    recommendedSystem: 'fh',
    shot: { fullness: 0.5, clock: '1:30', tips: 2, v0: 2.5 },
  },

  // ── 응용 — 더블쿠션 / 더블레일 / 횡단 / 리버스 4종 ──────────
  {
    id: 'DC-1',
    game: 'three_cushion',
    category: 'advanced',
    technique: 'double-cushion',
    title: '더블쿠션 기준',
    difficulty: 3,
    description: '더블쿠션 기본. 1구 충돌 후 두 쿠션.',
    balls: {
      white: [1.0, 1.27],
      yellow: [0.8, 1.1],
      red: [0.25, 1.1],
    },
    shot: { fullness: 0.333, clock: '2:30', tips: 3, v0: 2.0 },
  },
  {
    id: 'DR-1',
    game: 'three_cushion',
    category: 'advanced',
    technique: 'double-rail',
    title: '더블레일 기초 (접시)',
    difficulty: 3,
    description: '더블레일 접시 패턴.',
    balls: {
      white: [0.25, 1.9],
      yellow: [0.35, 2.2],
      red: [0.95, 2.4],
    },
    shot: { fullness: 0.5, clock: '2:00', tips: 3, v0: 3.0 },
  },
  {
    id: 'TR-1',
    game: 'three_cushion',
    category: 'advanced',
    technique: 'cross',
    title: '횡단샷 기본 (2 기울기)',
    difficulty: 3,
    description: '횡단샷. 2 기울기 무회전.',
    balls: {
      white: [0.95, 0.635],
      yellow: [0.635, 1.27],
      red: [0.25, 1.9],
    },
    shot: { fullness: 0.25, clock: '12:00', tips: 0, v0: 3.0 },
  },
  {
    id: 'RV-1',
    game: 'three_cushion',
    category: 'advanced',
    technique: 'reverse',
    title: '리버스 기초',
    difficulty: 5,
    description: '역회전 더블레일. 난구.',
    balls: {
      white: [0.794, 0.698],
      yellow: [0.191, 1.905],
      red: [0.318, 0.159],
    },
    shot: { fullness: 0.5, clock: '1:30', tips: 2, v0: 2.5 },
  },

  // ── 4구 (4 Ball) 6종 ────────────────────────────────────────
  {
    id: '4B-D-1',
    game: 'four_ball',
    category: '4ball',
    technique: 'direct',
    title: '4구 직접 맞히기 기본',
    difficulty: 1,
    description: '두 빨강을 직접 같은 샷에 맞히는 기본.',
    balls: {
      white: [0.635, 0.635],
      yellow: YELLOW_DEFAULT,
      red: [0.9, 0.9],
      red2: [0.9, 1.9],
    },
    shot: { fullness: 0.5, clock: '12:00', tips: 1, v0: 2.0 },
  },
  {
    id: '4B-1C-1',
    game: 'four_ball',
    category: '4ball',
    technique: 'one-cushion',
    title: '4구 1쿠션 빗겨치기',
    difficulty: 2,
    description: '1쿠션을 거쳐 두 빨강 모두 적중.',
    balls: {
      white: [0.318, 0.635],
      yellow: YELLOW_DEFAULT,
      red: [0.9, 1.1],
      red2: [0.95, 1.9],
    },
    shot: { fullness: 0.5, clock: '12:00', tips: 1, v0: 2.5 },
  },
  {
    id: '4B-DR-1',
    game: 'four_ball',
    category: '4ball',
    technique: 'draw',
    title: '4구 끌어치기 단쿠션 모으기',
    difficulty: 3,
    description: '끌어치기로 단쿠션에서 공 모으기.',
    balls: {
      white: [0.635, 1.9],
      yellow: YELLOW_DEFAULT,
      red: [0.95, 2.1],
      red2: [0.7, 2.3],
    },
    shot: { fullness: 0.5, clock: '6:00', tips: 2, v0: 2.7 },
  },
  {
    id: '4B-FW-1',
    game: 'four_ball',
    category: '4ball',
    technique: 'follow',
    title: '4구 밀어치기 기초',
    difficulty: 1,
    description: '밀어치기 60° 룰 학습.',
    balls: {
      white: [0.318, 0.635],
      yellow: YELLOW_DEFAULT,
      red: [0.318, 1.27],
      red2: [0.4, 2.2],
    },
    shot: { fullness: 0.5, clock: '12:00', tips: 2, v0: 2.5 },
  },
  {
    id: '4B-CR-1',
    game: 'four_ball',
    category: '4ball',
    technique: 'crossing',
    title: '4구 1쿠션 공모으기',
    difficulty: 3,
    description: '1쿠션 거치며 공 모으기.',
    balls: {
      white: [0.635, 1.5],
      yellow: YELLOW_DEFAULT,
      red: [0.8, 1.7],
      red2: [0.95, 2.0],
    },
    shot: { fullness: 0.5, clock: '12:00', tips: 1, v0: 2.5 },
  },
  {
    id: '4B-SR-1',
    game: 'four_ball',
    category: '4ball',
    technique: 'serie',
    title: '4구 세리 기초',
    difficulty: 4,
    description: '세리 (공 모으기) 기초. 부드러운 임팩트.',
    balls: {
      white: [0.95, 2.1],
      yellow: YELLOW_DEFAULT,
      red: [1.1, 2.25],
      red2: [0.95, 2.35],
    },
    shot: { fullness: 0.75, clock: '12:00', tips: 1, v0: 1.0 },
  },
];

// ════════════════════════════════════════════════════════════════
// 카테고리·기술 라벨 매핑 (한국어 UI)
// ════════════════════════════════════════════════════════════════

export const CATEGORY_LABEL: Record<DrillCategory, string> = {
  basic: '기초',
  advanced: '응용',
  '4ball': '4구',
};

export const TECHNIQUE_LABEL: Record<DrillTechnique, string> = {
  'outside-angle': '뒤돌리기',
  'side-angle': '옆돌리기',
  'long-angle': '앞돌리기',
  'bias-angle': '빗겨치기',
  bank: '뱅크샷',
  'double-cushion': '더블쿠션',
  'double-rail': '더블레일',
  cross: '횡단샷',
  reverse: '리버스',
  direct: '직접 맞히기',
  'one-cushion': '1쿠션',
  draw: '끌어치기',
  follow: '밀어치기',
  crossing: '1쿠션 공모으기',
  serie: '세리',
};

// ════════════════════════════════════════════════════════════════
// 조회 헬퍼
// ════════════════════════════════════════════════════════════════

export function getDrillById(id: string): Drill | undefined {
  return drills.find((d) => d.id === id);
}

export function getDrillsByGame(game: Game): Drill[] {
  return drills.filter((d) => d.game === game);
}

export function getDrillsByCategory(game: Game, category: DrillCategory): Drill[] {
  return drills.filter((d) => d.game === game && d.category === category);
}

/** 게임 안에서 기술별로 그룹핑된 드릴. UI OptGroup용. */
export function getDrillsGrouped(game: Game): Map<DrillTechnique, Drill[]> {
  const groups = new Map<DrillTechnique, Drill[]>();
  for (const d of drills) {
    if (d.game !== game) continue;
    const list = groups.get(d.technique) ?? [];
    list.push(d);
    groups.set(d.technique, list);
  }
  return groups;
}

/** 드릴의 시작 위치 → engine.createSystem 형태로 변환. */
export function drillToPositions(drill: Drill): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {
    white: drill.balls.white,
    yellow: drill.balls.yellow,
    red: drill.balls.red,
  };
  if (drill.balls.red2) out.red2 = drill.balls.red2;
  return out;
}
