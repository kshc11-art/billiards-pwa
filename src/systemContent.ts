/**
 * systemContent.ts (v1.0)
 *
 * 시스템 12종 학습 콘텐츠 데이터.
 *
 * 각 시스템 객체는 한국 당구 강좌 텍스트(당구박사·재퐁·3C-master·INPROD·MANUAL FACTORY·표은호 등)와
 * 외국 물리 자료(Han 2005·Mathavan 2010·Alciatore Dr.Dave·Marlow)를 종합하여 작성됨.
 * 영상 강좌의 핵심 내용을 텍스트로 추출·정리하여 PWA 학습 자료로 통합.
 *
 * 데이터 구조: 공식 / 좌표체계 / 표준값(당점·두께·속도·스트로크) / 보정 룰 / 핵심포인트 / 흔한실수 / 응용
 *
 * difficulty (★ 우선순위, 1-5):
 *   5 = 필수 시스템 (F&H, Plus, Half)
 *   4 = 자주 쓰는 시스템 (Ball, No English, 일출일몰)
 *   3 = 특정 상황 시스템 (-15, -20)
 *   2 = 보조 시스템 (Reverse, 32, 35과1/2)
 *   1 = 자료 빈약 (17/25)
 */

import type { SystemGuide } from './systems.ts';

// 학습 콘텐츠 ID — systems.ts의 SystemGuide 일부 + 35과1/2 (별도 ID)
export type SystemContentId =
  | 'fh'
  | 'plus'
  | 'half'
  | 'ball'
  | 'noenglish'
  | 'sunrise'
  | 'minus15'
  | 'minus20'
  | 'reverse'
  | 'thirtytwo'
  | 'thirtyfivehalf'
  | 'seventeen';

export interface SystemContent {
  id: SystemContentId;
  /** systems.ts의 computeSystemGuide와 매핑되는 ID (없으면 undefined). */
  guideId?: SystemGuide;
  name: { ko: string; en: string };
  alternateNames?: string[];
  /** 1-5 ★ 우선순위. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** 시스템 분류. */
  category: 'tracking' | 'aiming' | 'angle';
  /** 응용 가능한 샷 형태 (한국어 명칭). */
  applicableShots: string[];

  /** 공식 — 한 줄 표현. */
  formula: string;
  /** 변수 설명 또는 공식 부연. */
  formulaDetail?: string;

  /** 좌표 체계 (다이아 라벨링 룰). */
  coordinates: {
    source: string;
    cushion: string;
    target: string;
    rotation?: string;
  };

  /** 표준값 (강좌에서 추출). */
  standard: {
    impact: string;
    thickness: string;
    speed: string;
    stroke: string;
  };

  /** 보정 룰. */
  corrections: { condition: string; adjustment: string }[];
  /** 강좌 핵심 포인트. */
  keyPoints: string[];
  /** 흔한 실수. */
  commonMistakes: string[];
  /** 응용 가능 샷 형태와 적용법. */
  applications: { shotType: string; description: string }[];

  /**
   * 영상·강좌 표준 예제 (japong·당구박사·필승당구 형식).
   * InfoBox에 표시되는 핵심 학습 데이터.
   * 시스템은 출발-1쿠션-3쿠션 수치 + 당점·두께·스트로크 표시.
   */
  examples?: {
    /** 배치 코드 (japong 형식): 수구위치_1적구위치_2적구위치 (선택). */
    layout?: string;
    /** 강좌·영상 출처. */
    source: string;
    /** 배치 특징 (예: '50→30→20', '코너→코너', '대회전'). */
    feature?: string;
    /** 시스템 수치 (예: '수구 50, 1쿠션 30, 3쿠션 20'). */
    numbers?: string;
    /** 당점 — 시계 방향 + 팁수. */
    impact: string;
    /** 두께 — japong 표준 (시스템에 따라 빈쿠션은 '—'). */
    thickness: string;
    /** 스트로크. */
    stroke: string;
    /** 추가 메모 (키스 회피·보정 등). */
    note?: string;
  }[];

  /** 출처 (사이트명/저자 — URL 없이). */
  sources: string[];
}

// ════════════════════════════════════════════════════════════════
// 시스템 콘텐츠 데이터
// ════════════════════════════════════════════════════════════════

export const SYSTEM_CONTENT: Record<SystemContentId, SystemContent> = {
  // ─────────── F&H (파이브앤하프) ★★★★★ ───────────
  fh: {
    id: 'fh',
    guideId: 'fh',
    name: { ko: '파이브앤하프', en: 'Five and a Half System' },
    alternateNames: ['다이아몬드 시스템', 'Diamond System', 'F&H'],
    difficulty: 5,
    category: 'tracking',
    applicableShots: ['빈쿠션', '뒤돌리기', '옆돌리기', '앞돌리기', '비껴치기', '대회전'],
    formula: '3쿠션값 = 출발값 − 1쿠션값',
    formulaDetail:
      '내 공의 출발 위치(단쿠션 수구측), 1쿠션 도달 지점(장쿠션), 그리고 3쿠션 도착 지점에 부여된 ' +
      '숫자 사이의 관계. 도착 지점이 정해지면 출발에서 그 값을 빼서 1쿠션 조준점을 결정한다.',
    coordinates: {
      source:
        '단쿠션 수구측 — 짧은 테이블에서 1포인트마다 +10. 70 이상부터 ½포인트마다 +10. ' +
        '(긴 테이블 환경은 2포인트마다 +10). 코너 = 50.',
      cushion: '장쿠션 — 1포인트마다 +10. 50부터 ½포인트마다 +10. 코너 = 0.',
      target: '단쿠션 도착측 (쿠션 천 닿는 부위 기준) — 1포인트마다 +10. 40부터 ½포인트마다 +10.',
    },
    standard: {
      impact:
        '가변회전 — 출발 ≤30: 10:30 3팁 (도착≤10이면 10시 3팁, 0 가까우면 9시 3팁) / ' +
        '출발 30~70: 9:30 3팁 (도착≤20이면 10:30 3팁) / 출발 ≥70: 9시 3팁 (도착≤20이면 10:30 3팁)',
      thickness: '자유 (1/2 두께 이상이면 밀림 보정 필요)',
      speed: '3레일 (기본). 4-5쿠션 도달 시 더 강하게.',
      stroke: '평범한 3레일 스트로크. 1쿠션 가까울 때만 부드럽게.',
    },
    corrections: [
      {
        condition: '1쿠션과 가까운 경우',
        adjustment:
          '쿠션 반발력에 의해 짧아질 수 있음. 부드러운 스트로크로 조정 또는 3쿠션 지점을 길게 설계.',
      },
      {
        condition: '1/2 두께 이상',
        adjustment: '내 공이 밀리면서 길어지거나 짧아짐. 당점 조정 또는 시스템 수치 조정.',
      },
      {
        condition: '4쿠션 보정',
        adjustment:
          '출발값 50 미만 → 짧게 도착, 50 초과 → 길게 도착. 출발값 옆 보정값만큼 3쿠션 지점에 가감.',
      },
      {
        condition: 'INPROD 보정값 (출발 50 미만 — 코너 도달용)',
        adjustment:
          '45→+2 / 40→+5 / 35→+7 / 30→+10 짧아짐. 누적 2-3-2-3 패턴. ' +
          '1쿠션값에 더해서 더 깊게 구사 (출처: inprod.co.kr 4부).',
      },
      {
        condition: '3C 69 클럽 16진법 룰',
        adjustment:
          '출발 ≤30 → 10:30 3팁 / 60+ → 9시 3팁 / 30~60 입사각 따라 (45도 근처 10:30, 그 외 9시) / ' +
          '단순화: 무조건 9시 사용 + 1쿠션수에 +5 가산.',
      },
    ],
    keyPoints: [
      '가변회전 시스템 — 출발 위치마다 기본 당점이 달라짐 (Plus 시스템과의 핵심 차이).',
      '출발값 50 = 기준 (보정 없는 기본 라인).',
      '5쿠션 ≈ 4쿠션의 반대편 위치.',
      '6쿠션값은 4쿠션 35라인의 연장선 — 대회전에 매우 유용.',
      '3쿠션값은 쿠션 천 닿는 부위 기준 (당점 위가 아님).',
    ],
    commonMistakes: [
      '출발 위치 무관하게 단일 당점(예: 9:30 3팁) 고정 사용 → 코너 가까울 때 짧아짐.',
      '3쿠션값을 당점 위치 기준으로 잘못 측정 → 실제 진로와 어긋남.',
      '1쿠션 가까운데 강한 스트로크 → 쿠션 반발 짧아짐.',
      '1/2 두께 초과 시 밀림 보정 안 함 → 길어지거나 짧아짐.',
    ],
    applications: [
      {
        shotType: '빈쿠션 (3뱅크샷)',
        description:
          '3쿠션 목표 지점을 정한 뒤, 가까운 두 기준라인을 이용한 보간법. ' +
          '예: 25 도착이면 35-10 라인과 40-15 라인 사이.',
      },
      {
        shotType: '뒤돌리기',
        description:
          '1적구 옆을 가상 출발점으로 설계 + 3쿠션 50 도착 라인 사용. ' +
          '50-0 또는 60-10 라인을 1쿠션 조준점으로.',
      },
      {
        shotType: '옆돌리기',
        description:
          '1적구 옆 가상 출발 + 3쿠션 20 도착. 50-30 또는 60-40 라인 활용.',
      },
      {
        shotType: '앞돌리기',
        description:
          '1·2쿠션 라인이 20을 형성하는 형태 (70-50 또는 80-60). ' +
          '1적구 맞고 2쿠션으로 진행하는 라인을 시스템에서 찾음.',
      },
      {
        shotType: '비껴치기',
        description: '앞돌리기와 유사 — 1·2쿠션 라인이 20 형성 (60-40 또는 70-50).',
      },
      {
        shotType: '대회전',
        description: '6쿠션값 확인 (4쿠션 35라인 연장) → 4쿠션 도달 출발값 + 출발 위치 보정.',
      },
    ],
    examples: [
      {
        source: '3C-Master 빈쿠션 표준 (35-10)',
        feature: '3쿠션 25 도달 — 가장 가까운 두 라인 활용',
        numbers: '수구 35~40, 1쿠션 10~15, 3쿠션 25',
        impact: '9시 30분 방향 3팁',
        thickness: '— (빈쿠션)',
        stroke: '15-20cm 부드럽고 절도 있는 팔로우샷',
        note: '수구-1쿠션 라인에서 가장 가까운 2개 기준라인 활용 (3~5초 계산).',
      },
      {
        source: '3C-Master 옆돌리기 (50-0)',
        feature: '3쿠션 50 도달',
        numbers: '수구 50, 1쿠션 0, 3쿠션 50',
        impact: '9시 방향 3팁',
        thickness: '제1적구의 1/2',
        stroke: '평범한 팔로우샷',
        note: '1적구 오른쪽 옆을 출발로 계산.',
      },
      {
        source: '3C-Master 뒤돌리기 (50-30)',
        feature: '3쿠션 20 도달 — 표준 트랙',
        numbers: '수구 50, 1쿠션 30, 3쿠션 20',
        impact: '9시 30분 방향 3팁',
        thickness: '제1적구의 1/2',
        stroke: '15-20cm 부드러운 팔로우샷',
        note: '코너→코너 향해 치면 코너로 들어감 (똥창에서 똥창).',
      },
      {
        source: 'Manual Factory 짧은 각 보정',
        feature: '출발 30 — 보정 +5',
        numbers: '수구 30, 1쿠션 5, 4쿠션 20 (보정 5)',
        impact: '9시 방향 3팁',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '보정 = (50-출발)/4. 짧은 각일수록 짧아짐 → 더 길게 보정.',
      },
      {
        source: 'INPROD 누적 보정',
        feature: '출발별 보정값 누적',
        numbers: '45=2, 40=5, 35=7, 30=10',
        impact: '9시 방향 3팁',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '누적 2,3,2,3 패턴. 60+는 미세 — 감각 보정.',
      },
      {
        source: 'windcjg 출발별 당점 룰',
        feature: '구역별 당점 변경 (가변 잉글리쉬)',
        numbers: '13~30 = 10:30 / 35~45도 = 9:45 / 60+ = 9시',
        impact: '구역 따라 (10:30·9:45·9시) 가변',
        thickness: '— (빈쿠션)',
        stroke: '부드러운 팔로우샷',
        note: '획일화하려면 무조건 9시 + 1쿠션 +5 가산.',
      },
    ],
    sources: [
      '3C-Master (CCUSEAN)', '재퐁 (japong.com)', '당구박사 — 3구기본기술 18번',
      '3cman.co.kr (1/2두께·평행이동법)', 'INPROD 4부 (보정값 누적)',
      '3C 69 클럽 (16진법)', 'windcjg.blogspot (큐볼수·수구수)',
      'mycodings (2~3팁)', 'billiusclub (트랙선)',
    ],
  },

  // ─────────── Plus (플러스) ★★★★★ ───────────
  plus: {
    id: 'plus',
    guideId: 'plus',
    name: { ko: '플러스', en: 'Plus System' },
    difficulty: 5,
    category: 'tracking',
    applicableShots: ['앞돌리기 (짧게)', '빈쿠션 (짧은 형태)'],
    formula: '3쿠션값 = 출발값 + 1쿠션값',
    formulaDetail:
      '출발값과 1쿠션값을 더한 합이 3쿠션 도착값과 같아지는 라인을 찾는 시스템. ' +
      '앞돌리기 짧게치기의 대표 시스템.',
    coordinates: {
      source:
        '장쿠션 수구측 — 1포인트마다 +10 (0~80 일직선). ' +
        '큐볼이 단쿠션 가까이일 때는 90 시작 + ½포인트마다 +10.',
      cushion:
        '단쿠션 — X, 30, 50 세 핵심 포인트만 사용. X값은 출발값에 따라 변동: ' +
        '출발 60 일 때 X = 0. 출발 작아질수록 +5씩 증가, 커질수록 -5씩 감소.',
      target:
        '장쿠션 도착측 — 출발값과 동일 룰 (1포인트마다 +10).',
    },
    standard: {
      impact: '1:30 3팁 (고정회전 — F&H와 핵심 차이).',
      thickness: '1/2 (볼퍼스트 시), 빈쿠션 시 두께 무관',
      speed: '2.5~3 레일',
      stroke: '평범한 스트로크.',
    },
    corrections: [
      {
        condition: '출발값 0~30 구간',
        adjustment: '플러스 시스템은 이 구간에서 정확하지 않음 (계산식대로 진행 안 함).',
      },
      {
        condition: '1쿠션이 코너에 가까운 10 부근',
        adjustment: '회전이 배가되면서 짧아짐 → 회전을 빼거나 시스템 수치 보정.',
      },
      {
        condition: '내 공과 쿠션 거리가 너무 가까움',
        adjustment: '쿠션 반발에 의해 짧아지거나 길어짐 → 주의해서 스트로크.',
      },
    ],
    keyPoints: [
      '고정회전 시스템 (1:30 3팁 고정) — F&H의 가변회전과 가장 큰 차이.',
      '4쿠션은 3쿠션값의 2배 위치에 도착 (3쿠션 40 → 4쿠션 80).',
      '5쿠션 도달은 4레일 이상 속도 필요. 빠를수록 3쿠션이 기대값보다 짧아질 수 있음.',
    ],
    commonMistakes: [
      '출발 0~30에서 적용 시도 → 시스템 안 맞음.',
      '1쿠션 코너 10으로 보낼 때 보정 안 해서 짧아짐 (회전 배가 효과).',
      '4-5쿠션 응용 시 속도 부족 → 기대 위치 도달 못함.',
    ],
    applications: [
      {
        shotType: '앞돌리기 짧게',
        description:
          '플러스 시스템의 기본 응용. 1적구 맞고 짧은 각으로 단단장 진행.',
      },
      {
        shotType: '빈쿠션 (단단장 짧은 형태)',
        description: '직접 빈쿠션 후 3쿠션 도달.',
      },
    ],
    examples: [
      {
        source: '재퐁 Plus 표준 1',
        feature: '장축 트랙 — 10·35·70',
        numbers: '출발 10, 1쿠션 35, 3쿠션 70',
        impact: '1시 30분 방향 3팁',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '출발 + 1쿠션 = 3쿠션. 회전 max 사용.',
      },
      {
        source: '재퐁 Plus 코너 트랙',
        feature: '20·40·80 (코너)',
        numbers: '출발 20, 1쿠션 40, 3쿠션 80 (코너)',
        impact: '1시 30분 방향 3팁',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '코너로 들어감 — 단축·장축 모두 맞음.',
      },
      {
        source: '재퐁 Plus + F&H 결합',
        feature: '장축 + 단축 (단축 27)',
        numbers: '출발 30, 1쿠션 45, 3쿠션 27 (F&H 단축값)',
        impact: '1시 30분 방향 3팁',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: 'F&H 시스템 값과 일치 — 하이브리드 응용.',
      },
      {
        source: '재퐁 Plus 짧은 각 보정',
        feature: '코너 가까운 10 — 회전 배가',
        numbers: '1쿠션 코너 가까운 10',
        impact: '1시 30분 방향 2팁 (회전 빼기)',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '회전 배가되며 짧아짐 → 회전 빼기 또는 시스템 보정.',
      },
      {
        source: '재퐁 Plus 출발별 보정',
        feature: '수구수 40 기준 — 길어지거나 짧아짐',
        numbers: '수구 10~30 길어짐 / 50~80 짧아짐',
        impact: '1시 30분 방향 3팁',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '1쿠션째 코너 10 도는 경우 보정 필요.',
      },
    ],
    sources: ['3C-Master (CCUSEAN)', '재퐁 (japong.com)', 'Manual Factory'],
  },

  // ─────────── Half (하프) ★★★★★ ───────────
  half: {
    id: 'half',
    guideId: 'half',
    name: { ko: '하프 시스템', en: 'Half System' },
    alternateNames: ['1/2 시스템', '무회전 1/2 룰'],
    difficulty: 5,
    category: 'angle',
    applicableShots: ['빈쿠션', '옆돌리기 (단쿠션 가까이)', '빗겨치기', '4구 1·2쿠션'],
    formula: '1쿠션값 = 출발값 / 2',
    formulaDetail:
      '입사각=반사각의 무회전 룰을 단쿠션 8분할 포인트 체계에 적용. ' +
      '예: 60 출발이면 30(절반) 향해 치면 코너 통과.',
    coordinates: {
      source: '장쿠션 수구측 — 9 포인트 (1포인트당 +1).',
      cushion: '반대편 장쿠션 — 출발값의 절반(/2) 위치가 1쿠션 조준점.',
      target: '입사각=반사각 무회전 룰로 자동 결정 (대부분 코너 도달).',
    },
    standard: {
      impact: '12시 무회전 또는 12시 위 상단 (밀어치기). 좌우 회전 X.',
      thickness: '1/2 (볼퍼스트 시)',
      speed: '부드럽게 (가볍게 보내 놓기).',
      stroke: '강하게 밀거나 끌지 말고 가볍게.',
    },
    corrections: [
      {
        condition: '정회전 1팁 추가',
        adjustment: '도착 +5포인트 (길어짐).',
      },
      {
        condition: '정회전 2팁 추가',
        adjustment: '도착 +10포인트.',
      },
      {
        condition: '정회전 3팁 추가',
        adjustment: '도착 +15포인트.',
      },
      {
        condition: '역회전',
        adjustment: '도착 짧아짐 (+ 부호 반대).',
      },
    ],
    keyPoints: [
      '가장 단순한 무회전 시스템 — 입사각=반사각의 직접 응용.',
      '큐로 이동 라인 그어 시작점 읽기 ("3에서 1.5", "2에서 1").',
      '수구가 1적구보다 바깥쪽이어도 적용 가능 — 1적구 맞고 진행하는 라인을 보고 시작점 결정.',
      '단쿠션에서도 적용 가능 (장쿠션이 더 일반적).',
    ],
    commonMistakes: [
      '좌우 회전 (밀거나 끌거나) → 무회전 룰 깨짐 → 결과 어긋남.',
      '1적구 위치를 시작점으로 잘못 파악 → 수구 진로 라인이 아님.',
      '강한 스트로크 → 가벼운 라인이 의도와 달라짐.',
    ],
    applications: [
      {
        shotType: '1뱅크 (직접 빈쿠션)',
        description: '가장 단순한 형태. 단쿠션 가까이에서 절반 라인 향해 부드럽게.',
      },
      {
        shotType: '볼퍼스트 (1적구 맞고 가는 형태)',
        description:
          '1적구 맞고 진행하는 라인이 시작점이 됨. 큐로 가상 라인을 그어 측정.',
      },
      {
        shotType: '단쿠션 응용',
        description: '장쿠션이 일반적이지만 단쿠션 가까이에서도 동일 룰 적용.',
      },
    ],
    examples: [
      {
        source: 'Manual Factory 표준',
        feature: '60→30 → 코너 통과',
        numbers: '출발 60, 1쿠션 30, 도착 = 60/2 = 30 (절반)',
        impact: '12시 무회전',
        thickness: '— (빈쿠션) 또는 1/2 (4구)',
        stroke: '평범한 팔로우샷',
        note: '40→20→10. 입사각=반사각 직접 응용.',
      },
      {
        source: 'INPROD 4구 1·2쿠션',
        feature: '4구 표준 무회전 1/2',
        numbers: '40→5→20',
        impact: '12시 무회전',
        thickness: '제1적구의 1/2',
        stroke: '15cm 부드럽게',
        note: '4구 기본 — 무회전 1/2 두께. 5 포인트 향해 치면 출발 1/2 도달.',
      },
      {
        source: 'INPROD 정회전 1팁 추가',
        feature: '회전 추가 — 도착 길어짐',
        numbers: '40→5→20+5=25 (1팁 추가 시)',
        impact: '9시 또는 3시 1팁',
        thickness: '제1적구의 1/2',
        stroke: '평범한 팔로우샷',
        note: '1팁=+5, 2팁=+10, 3팁=+15.',
      },
    ],
    sources: ['INPROD', 'Manual Factory', '한국 동호인 자료', '쫑프로 (야매당구)'],
  },

  // ─────────── Ball (볼 시스템) ★★★★ ───────────
  ball: {
    id: 'ball',
    guideId: 'ball',
    name: { ko: '볼 시스템', en: 'Ball System' },
    difficulty: 4,
    category: 'aiming',
    applicableShots: ['옆돌리기 (예민·애매한 각)', '앞돌리기', '제각돌리기'],
    formula: '1적구수 + 도착수 + 기울기 = 두께 + 팁수',
    formulaDetail:
      '한국 동호인 표준 볼 시스템 (Ball Value System). 1적구수(첫 쿠션 위치 기준)와 ' +
      '도착수(3쿠션 도착 위치)에 기울기(자세에 따른 보정)를 더한 합 = 볼값. ' +
      '이 볼값을 두께(1/8 단위)와 팁수(½팁 단위)로 나누어 친다. ' +
      '예: 볼값 = 6 → 8분의 5 두께 + 1팁 (또는 8분의 4 두께 + 2팁). ' +
      '두께가 클수록 정확도 우선. 출처: mycodings, Chowan21, 표은호, INPROD.',
    coordinates: {
      source: '1적구수 — 1적구 위치 기준 1~8 라벨 (첫 쿠션 어디에 도달하느냐).',
      cushion: '— (1쿠션 직접 라벨 없음, 두께+팁 조합으로 결정)',
      target: '도착수 — 3쿠션 도착 위치. 코너=0, 1포인트당 +1.',
      rotation: '팁수 — ½팁 단위 (1팁=2). 0팁~4팁 사용.',
    },
    standard: {
      impact:
        '두께에 따라 다름. 4/8 두께 이하 또는 내 공-1적구 가까울 때 → 상단 당점 ' +
        '(분리각 커지는 것 방지). 4/8 두께 이상 → 중단 당점 (밀림 분리각 작아짐 방지).',
      thickness: '8등분. 1/8 = 1, 2/8 = 2, ..., 8/8 = 8 (분자 값이 두께값).',
      speed: '보통 (부드럽게).',
      stroke: '평범한 스트로크. 두꺼운 두께일수록 부드럽게.',
    },
    corrections: [
      {
        condition: '기울기 보정 — 엇각 (1적구가 진행 방향 안쪽으로 기울어짐)',
        adjustment:
          '큐볼 진행 방향에 1적구 끝과 큐볼 중심 잇는 선의 기울기. ' +
          '반 포인트당 +1 (두꺼운 두께 요구).',
      },
      {
        condition: '기울기 보정 — 빗각 (1적구가 진행 방향 바깥쪽으로 기울어짐)',
        adjustment: '같은 측정. 반 포인트당 -1 (얇은 두께 요구).',
      },
      {
        condition: '1적구 단쿠션 가까이',
        adjustment: '기울기 ½로 축소 보정 (Chowan21 출처).',
      },
      {
        condition: '1적구 = 2적구 같은 위치',
        adjustment: '기울기 0 — 반 두께 (4/8) + 무회전 당점으로 단순화.',
      },
      {
        condition: '앞돌리기 응용',
        adjustment:
          '1적구수 4 이상이면 도착수 -1 (3쿠션 후 늘어짐 보정). ' +
          '1적구가 쿠션에 붙어 있으면 -1 추가 보정.',
      },
    ],
    keyPoints: [
      '옆돌리기·앞돌리기 시스템 중 가장 정확하지만 머리를 많이 씀 (4가지 변수: 1적구수·도착수·기울기·기울기보정).',
      '두께·팁 조합이 자유 — 볼값 6일 때: 5두께+1팁 / 4두께+2팁 / 3두께+3팁.',
      '우선순위: 두께 큰 것이 정확. 5두께+1팁 > 4두께+2팁 > 3두께+3팁.',
      '두께 측정: 1/8 단위 시각 분할 학습 필수 (1=1/8, 2=2/8, ..., 8=8/8 정타).',
      '기울기 측정: 큐볼 진행 방향에 1적구 끝과 큐볼 중심 잇는 선 → 양쪽 테이블 포인트까지 연장하여 차이.',
      '8분의 4 = 반 두께 = 정타.',
    ],
    commonMistakes: [
      '기울기 측정 안 함 → 같은 두께·회전인데 결과 다름.',
      '단쿠션 가까운 케이스 ½ 보정 안 함.',
      '두께 8등분 시각화 부정확 → 1/8과 2/8 헷갈림.',
      '4/8 이상 두께인데 상단 당점 사용 → 밀림 분리각 작아짐.',
      '얇은 두께 + 많은 팁 사용 → 컨트롤 어려움 (가능하면 두께 큰 조합 선택).',
    ],
    applications: [
      {
        shotType: '옆돌리기 (제각돌리기)',
        description:
          '볼 시스템의 주 응용 형태. 예민하거나 애매한 각도에서 F&H보다 정확.',
      },
      {
        shotType: '앞돌리기 (장-단-장)',
        description:
          '같은 룰 (1적구수+도착수+기울기 = 두께+팁). ' +
          '도착수 4 이상이면 -1 보정 필요.',
      },
    ],
    examples: [
      {
        source: 'mycodings 볼 시스템 표준',
        feature: '볼값 6 — 우선순위 5두께+1팁',
        numbers: '1적구수+도착수+기울기 = 6',
        impact: '9시 1팁',
        thickness: '제1적구 8분의 5 (5/8)',
        stroke: '평범한 팔로우샷',
        note: '두께 큰 조합 우선 — 5두께+1팁 > 4두께+2팁 > 3두께+3팁.',
      },
      {
        source: 'mycodings 1적구수 4+ 보정',
        feature: '1적구 늘어짐 보정',
        numbers: '1적구수 4 이상 → 도착수 -1',
        impact: '9시 2팁',
        thickness: '제1적구 4/8',
        stroke: '평범한 팔로우샷',
        note: '3쿠션 후 스핀 늘어짐 보정. 1적구 쿠션 붙음 시 -1 추가.',
      },
      {
        source: '표은호 (서울당구연맹) 기울기',
        feature: '기울기 측정 — 양쪽 테이블 포인트',
        numbers: '큐볼 진행 방향 + 1적구 끝 → 차이 = 기울기',
        impact: '8분의 4 (정타) + 0팁',
        thickness: '제1적구 4/8 (반두께)',
        stroke: '평범한 팔로우샷',
        note: '8분의 4 = 정타 = 반두께. 시각 분할 1/8 단위.',
      },
    ],
    sources: [
      'mycodings (3쿠션 시스템 종합)', '3C-Master (CCUSEAN)',
      'Chowan21 블로그 (다음)', 'INPROD', '표은호 (서울당구연맹)',
      '당구박사 — 옆돌리기 패턴 4종',
    ],
  },

  // ─────────── No English (무회전) ★★★★ ───────────
  noenglish: {
    id: 'noenglish',
    guideId: 'noenglish',
    name: { ko: '무회전 시스템', en: 'No English System' },
    alternateNames: ['50 시스템', '30 시스템', '15 시스템'],
    difficulty: 4,
    category: 'angle',
    applicableShots: ['빈쿠션', '단쿠션 가까운 옆돌리기', '빗겨치기', '게임 전 테이블 진단'],
    formula: '입사각 = 반사각 (무회전 룰)',
    formulaDetail:
      '무회전으로 친 공은 입사각과 반사각이 같다는 물리 원리를 시스템화. ' +
      '50/30/15/17 등 여러 변형이 있으며 변형마다 정확한 도착 지점이 정해져 있다.',
    coordinates: {
      source: '단쿠션 또는 장쿠션 포인트 — 변형마다 다름.',
      cushion: '변형별 핵심 포인트 (15, 30, 50 등) 단일 또는 소수.',
      target: '무회전 입사·반사로 자동 결정.',
    },
    standard: {
      impact: '12시 무회전 (기본). 30 시스템 코너 도달용 정회전 추가 가능.',
      thickness: '1/2 (볼퍼스트 시).',
      speed: '보통.',
      stroke: '평범한 스트로크.',
    },
    corrections: [
      {
        condition: '30 시스템 무회전으로 코너 못 돌 때',
        adjustment: '+3팁 정회전 추가 (1팁당 +10p 효과).',
      },
      {
        condition: '15 시스템',
        adjustment: '15→10 향함 = 합 25보다 +15 향함 (40 도달).',
      },
    ],
    keyPoints: [
      '50 시스템: 50포인트 향함 → 반대편 같은 위치 도착 (정회전 정도 조절).',
      '30 시스템 1: 30포인트 향함 → 반대편 절반 위치 (정회전).',
      '30 시스템 2: 장쿠션 30 → 반대편 장쿠션 같은 위치.',
      '15 시스템: 15→10 향하면 40 도달. 합 + 15.',
      '17 대칭: 17→0(코너)→17 회귀 (완전 무회전).',
      '게임 시작 전 테이블 상태 진단에 최적 — 어떤 시스템도 천 따라 결과 다름.',
    ],
    commonMistakes: [
      '테이블 상태 무시 → 동일 시스템도 천에 따라 결과 다름.',
      '30 시스템에서 무회전 사용 → 코너 못 도는데 회전 추가 안 함.',
      '입사각·반사각 시각 측정 부정확.',
    ],
    applications: [
      {
        shotType: '게임 전 테이블 진단',
        description: '17 대칭 또는 50 시스템으로 천 상태 빠르게 파악.',
      },
      {
        shotType: '2뱅크 넣어치기',
        description: '단쿠션 가까이에서 무회전 룰로 정확한 라인 계산.',
      },
      {
        shotType: '빗겨치기 단순화',
        description: '복잡한 일출일몰 대신 단쿠션 가까이에서 무회전으로.',
      },
    ],
    examples: [
      {
        source: '재퐁 무회전 50 시스템',
        feature: '50→0 = 코너',
        numbers: '출발 50, 도착 0 (코너)',
        impact: '12시 무회전',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷 (균일 속도)',
        note: '입사각 = 반사각 직접 응용.',
      },
      {
        source: 'Manual Factory 30 시스템',
        feature: '단쿠션 가까운 옆돌리기',
        numbers: '30 시스템 — 1쿠션 30 도달',
        impact: '12시 무회전',
        thickness: '제1적구의 1/2',
        stroke: '15cm 부드럽게',
        note: '1적구 단쿠션 가까울 때 옆돌리기·빗겨치기 응용.',
      },
      {
        source: '재퐁 무회전 넣어치기',
        feature: '2뱅크 넣어치기 — 공 크기 보정',
        numbers: '수구 오른쪽 끝 → 1쿠션 레일포인트',
        impact: '12시 무회전 (회전 영향 무시)',
        thickness: '— (3cm 정도 앞에 맞음)',
        stroke: '평범한 팔로우샷',
        note: '공의 크기 때문에 3cm 앞에 맞음. 회전 영향 무시 가능.',
      },
      {
        source: '게임 전 17 시스템 진단',
        feature: '천 상태 빠르게 진단',
        numbers: '17·34·51 코너 대칭 라인',
        impact: '12시 무회전',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '코너→코너 17 라인. 천 컨디션·습도 진단용.',
      },
    ],
    sources: [
      '재퐁 (japong.com)', 'Manual Factory (50/30/15 시스템)',
      '빌리노트', '송파구당구연맹',
    ],
  },

  // ─────────── 일출일몰 ★★★★ ───────────
  sunrise: {
    id: 'sunrise',
    guideId: 'sunrise',
    name: { ko: '일출일몰 시스템', en: 'Sunrise-Sunset System' },
    difficulty: 4,
    category: 'tracking',
    applicableShots: ['장단장 비껴치기', '횡단샷'],
    formula: '회전수 = 출발값 + 1쿠션값 + 3쿠션값 + 기울기 보정',
    formulaDetail:
      '비껴치기 시 당점(회전수)을 결정하는 시스템. 당점 조절이 ' +
      '해뜨고 지는 모습과 비슷하다 하여 일출일몰. 4가지 값을 합산해서 정확한 회전을 정한다.',
    coordinates: {
      source:
        '출발값 — 코너 = 0. 짧은 테이블 1포인트마다 -1. 가운데 이후 ½p마다 -1. ' +
        '긴 테이블 1p마다 +1.',
      cushion:
        '1쿠션값 — 2번째 포인트가 0. 멀어질수록 ½p마다 -1, 가까워질수록 ½p마다 +1.',
      target:
        '3쿠션값 — 긴 쿠션 ½p마다 +1, 짧은 쿠션 1p마다 -1.',
      rotation:
        '회전수 — 시계 4등분. 12시 3팁 = 0. 정방향 ½팁마다 +1. 역방향 ½팁마다 -1.',
    },
    standard: {
      impact: '시스템 계산 결과에 따라 회전수 결정 (12시 3팁 = 0 기준).',
      thickness:
        '1적구가 단쿠션을 향하는 두께 (= 장쿠션과 평행하게 진행). manualfactory·3C-Master 일치 표현.',
      speed: '2~2.5 레일.',
      stroke: '부드러운 스트로크 — 강하게 치면 라인 짧아짐.',
    },
    corrections: [
      {
        condition: '1적구가 1쿠션과 떨어진 거리당',
        adjustment: '거리 1포인트당 -1 (회전수 합에서 차감).',
      },
    ],
    keyPoints: [
      '두께가 회전과 별개로 결정됨 — 1적구 진행 방향(장쿠션 평행)으로 두께 정함.',
      '정회전·역회전 모두 가능 — 합에 따라 자동 결정.',
      '가변회전이지만 F&H와 달리 시각이 아닌 산술로 정확한 회전 산출.',
    ],
    commonMistakes: [
      '두께 잘못 (1적구가 다른 방향으로 가면 회전수 계산 무용).',
      '1적구-1쿠션 거리 보정 안 함 → 회전 부족/과다.',
      '강한 스트로크로 라인 짧아짐.',
      '회전수 음수 케이스에서 역회전 안 줌.',
    ],
    applications: [
      {
        shotType: '장단장 비껴치기',
        description: '시스템의 주 응용. 빗겨치기 시 정확한 회전 결정.',
      },
      {
        shotType: '더블 횡단',
        description: '횡단샷 변형에도 응용 가능 (3C-Master 분류).',
      },
    ],
    examples: [
      {
        layout: '4805_1505_2226',
        source: '재퐁 (허정한 빗겨치기 강좌)',
        feature: '비껴치기 안정',
        numbers: '출발+1쿠션+3쿠션 = 0~2팁',
        impact: '12시 방향 2팁',
        thickness: '제1적구의 왼쪽 1/3',
        stroke: '부드럽게 밀어치기',
        note: '두께는 회전과 별개 — 1적구 장쿠션 평행 진행하는 두께.',
      },
      {
        source: 'Manual Factory 일출일몰 표준',
        feature: '수구+1쿠션+3쿠션 = 팁수',
        numbers: '예: 1+1+0 = 2팁',
        impact: '12시 2팁 (시스템 산출)',
        thickness: '얇게 (1적구 평행 진행)',
        stroke: '부드러운 팔로우샷',
        note: '합이 음수면 역회전. 합이 0이면 무회전.',
      },
      {
        source: '3C-Master 1적구-1쿠션 거리 보정',
        feature: '거리 1포인트당 -1',
        numbers: '회전수 합에서 거리만큼 차감',
        impact: '시스템 산출에서 거리 보정',
        thickness: '얇게',
        stroke: '부드러운 팔로우샷',
        note: '1적구 1쿠션 떨어진 거리 보정 — 회전 부족 방지.',
      },
    ],
    sources: [
      '3C-Master (CCUSEAN)', 'Manual Factory (일출일몰 시스템)',
      'mycodings (튜즐 시스템)',
    ],
  },

  // ─────────── -15 시스템 ★★★ ───────────
  minus15: {
    id: 'minus15',
    guideId: 'minus15',
    name: { ko: '-15 시스템', en: 'Minus 15 System' },
    difficulty: 3,
    category: 'tracking',
    applicableShots: ['뒤돌리기 (짧게)'],
    formula: '1쿠션값 = 수구수 - 1적구수 - 15',
    formulaDetail:
      '뒤돌리기 짧게치기 시스템. 2적구가 코너 가까이 + 수구·1적구가 애매하게 밀리는 배치에 특화. ' +
      '-20 시스템과 형제 (둘 다 동일 원리, 보정 상수만 다름).',
    coordinates: {
      source: '수구수 — 8개 포인트 (15, 20, 25, 30, 35, 40, 45, 50). 5단위.',
      cushion: '1쿠션 도달 지점 — 동일 8개 포인트.',
      target: '1적구수 — 동일 8개 포인트.',
    },
    standard: {
      impact: '12:00 1팁 (기본).',
      thickness: '1/2.',
      speed: '2.0~2.5 레일.',
      stroke: '평범한 스트로크.',
    },
    corrections: [
      {
        condition: '2적구가 기준점보다 짧은 위치',
        adjustment: '느낌 팁 (12시보다 약간 위) → 수구 더 길게.',
      },
      {
        condition: '2적구가 기준점보다 긴 위치',
        adjustment: '마이너스 팁 (하단) → 수구 짧게.',
      },
      {
        condition: '계산 결과가 코너(0)인데 2적구가 5포인트',
        adjustment: '느낌 팁 (12시 약간 위) → 수구 더 길게 돌아감.',
      },
    ],
    keyPoints: [
      '5단위 8개 포인트만 외우면 됨 — 99단 5단처럼 반복.',
      '뒤돌리기 짧게치기 특화 (대회전이나 비껴치기 어려운 배치).',
      '-20과 차이: -15는 더 짧은 형태, -20은 더 일반적.',
      '만능 아님 — 천 상태·마찰력·스트로크 속도에 따라 결과 다름.',
    ],
    commonMistakes: [
      '2적구 위치 보정 안 함 → 항상 같은 당점 사용.',
      '12:00 정확하지 않으면 짧아짐 (느낌팁/마이너스팁 잘못).',
      '천 상태 무시.',
    ],
    applications: [
      {
        shotType: '뒤돌리기 짧게',
        description: '2적구 코너 가까이 + 수구·1적구 애매한 배치 전용.',
      },
    ],
    examples: [
      {
        source: 'feel4u1004 -15 표준',
        feature: '뒤돌리기 짧게 — 수구 50 1적구 5',
        numbers: '수구 50, 1적구 5, 1쿠션 = 50-5-15 = 30',
        impact: '9시 30분 방향 3팁',
        thickness: '제1적구의 1/2',
        stroke: '평범한 팔로우샷',
        note: '2적구 코너 가까운 짧은 각 전용.',
      },
      {
        source: 'feel4u1004 -15 응용',
        feature: '수구 40 1적구 10',
        numbers: '수구 40, 1적구 10, 1쿠션 = 40-10-15 = 15',
        impact: '9시 30분 3팁',
        thickness: '제1적구의 1/2',
        stroke: '평범한 팔로우샷',
        note: '-20과 형제 시스템 — 보정 상수만 다름.',
      },
    ],
    sources: ['feel4u1004', '한국 동호인 자료'],
  },

  // ─────────── -20 시스템 ★★★ ───────────
  minus20: {
    id: 'minus20',
    guideId: 'minus20',
    name: { ko: '-20 시스템', en: 'Minus 20 System' },
    difficulty: 3,
    category: 'tracking',
    applicableShots: ['뒤돌리기 (짧게)'],
    formula: '1쿠션값 = 수구수 - 1적구수 - 20',
    formulaDetail:
      '뒤돌리기에서 가장 많이 쓰이는 마이너스 시스템. ' +
      '-15와 동일 원리, 더 일반적인 배치에 적용. 5단위 8개 포인트로 단순화.',
    coordinates: {
      source: '수구수 — 8개 포인트 (15, 20, 25, 30, 35, 40, 45, 50).',
      cushion: '1쿠션 도달 지점 — 동일 8개 포인트.',
      target: '1적구수 — 동일.',
    },
    standard: {
      impact: '12:00 1팁.',
      thickness: '1/2.',
      speed: '2.0~2.5 레일.',
      stroke: '평범한 스트로크.',
    },
    corrections: [
      {
        condition: '2적구가 기준점보다 짧음',
        adjustment: '느낌 팁 → 더 길게.',
      },
      {
        condition: '2적구가 기준점보다 긺',
        adjustment: '마이너스 팁 → 짧게.',
      },
      {
        condition: '1적구가 더 안쪽',
        adjustment: '대회전을 선택하는 게 나음 (-20 적용 X).',
      },
      {
        condition: '1적구가 더 나와있음',
        adjustment: '-20 적용 + 팁만 조절.',
      },
    ],
    keyPoints: [
      '동호인 사이에서 가장 많이 쓰이는 짧은 뒤돌리기 시스템.',
      '8개 포인트 외움 (-15와 동일).',
      '실전에서 수구 위치 애매해도 가까운 포인트 기준 빠르게 계산 가능.',
      '본인 스트로크 습관에 맞춰 미세 조정 필요.',
    ],
    commonMistakes: [
      '2적구 위치 보정 안 함.',
      '1적구가 안쪽인데 -20 적용 시도 → 대회전이 나음.',
      '천 상태 무시.',
    ],
    applications: [
      {
        shotType: '뒤돌리기 짧게',
        description: '-15보다 더 일반적 배치. 2적구가 코너 부근.',
      },
    ],
    examples: [
      {
        source: 'feel4u1004 -20 표준',
        feature: '뒤돌리기 짧게 — 가장 많이 쓰이는 시스템',
        numbers: '수구 50, 1적구 0, 1쿠션 = 50-0-20 = 30',
        impact: '9시 30분 방향 3팁',
        thickness: '제1적구의 1/2',
        stroke: '평범한 팔로우샷',
        note: '동호인 사이 가장 많이 쓰이는 짧은 뒤돌리기 시스템.',
      },
      {
        source: 'feel4u1004 -20 응용',
        feature: '8개 포인트 외움',
        numbers: '수구 40, 1적구 5, 1쿠션 = 40-5-20 = 15',
        impact: '9시 30분 3팁',
        thickness: '제1적구의 1/2',
        stroke: '평범한 팔로우샷',
        note: '본인 스트로크 습관에 맞춰 미세 조정.',
      },
    ],
    sources: ['feel4u1004', '한국 동호인 자료'],
  },

  // ─────────── Reverse (리버스) ★★ ───────────
  reverse: {
    id: 'reverse',
    guideId: 'reverse',
    name: { ko: '리버스 시스템', en: 'Reverse System' },
    difficulty: 2,
    category: 'tracking',
    applicableShots: [
      '더블레일 (접시)',
      '3뱅크',
      '옆돌리기',
      '대회전',
      '더블쿠션',
      '끌어치기',
    ],
    formula: '기준선 매기기 (역회전 3팁 0포인트 향함)',
    formulaDetail:
      '내 공이 역회전으로 1쿠션을 맞고 두 번째 쿠션부터는 정회전으로 진행하는 샷. ' +
      '계산식보다는 기준선 외우는 방식 — 출발값 20, 35, 50선 알면 나머지 추정.' +
      ' 전통식 공식: 1쿠션 = 18 - (수구 + 적구), 한계 18 (미끄러우면 15-16).',
    coordinates: {
      source: '단쿠션 또는 장쿠션 — 파이브앤하프 포인트 체계 사용 가능.',
      cushion: '장쿠션 — 0포인트(긴 테이블 코너) 향함이 기본.',
      target: '연장선은 1쿠션을 F&H 출발점으로 간주하면 추정 가능.',
    },
    standard: {
      impact: '3팁 역회전 (10:30 또는 1:30, 진행 방향 반대).',
      thickness: '1/2.',
      speed: '2.5 레일 — 속도에 매우 민감.',
      stroke: '평범하지만 정확한 속도 유지.',
    },
    corrections: [
      {
        condition: '2쿠션 위치 보정',
        adjustment: '2쿠션 보정 거리의 1/2지점만큼 1쿠션 조준점 이동.',
      },
      {
        condition: '같은 1쿠션 노릴 때',
        adjustment: '스트로크 속도로 도달 거리 조절.',
      },
      {
        condition: '천이 미끄러움',
        adjustment: '한계 18 적용. 미끄럽지 않으면 15-16.',
      },
      {
        condition: '단순 코너 도달 룰 (당구형 채널)',
        adjustment:
          '50→40 향함 = 반대편 코너 도달 / 35→30 = 코너 / 20→15 = 코너. ' +
          '("50-40=코너" 영상). 0/10 코너 혼돈 주의.',
      },
    ],
    keyPoints: [
      '역회전 → 정회전 전환 — 1쿠션은 역회전, 2+쿠션부터 정회전.',
      '미끄러운 천에서 효과적 (역회전 효과 더 큼).',
      '속도에 매우 민감 — 빠르면 짧아지고 느리면 길어짐.',
      '출발값 20, 35, 50선 외우면 나머지 라인 추정 가능.',
      '연장선 = 1쿠션을 F&H 출발점으로 보면 계산 가능.',
    ],
    commonMistakes: [
      '천 상태 무시 — 끈끈한 천에서 18 적용 시 너무 길어짐.',
      '속도 빠르게 → 결과 짧아짐.',
      '정회전과 혼동 → 1쿠션부터 역회전 줘야 함.',
      '브릿지 못 만들고 빈쿠션 시도 (떡 + 미세 틈새 케이스).',
    ],
    applications: [
      { shotType: '더블레일 (접시)', description: '장쿠션 가까이에서 역회전 더블레일.' },
      { shotType: '3뱅크', description: '먼 거리 빈쿠션 + 역회전.' },
      { shotType: '옆돌리기', description: '역회전 응용 옆돌리기 (japong 패턴).' },
      { shotType: '대회전', description: '리버스 대회전 — 깊은 팔로우샷.' },
      { shotType: '더블쿠션', description: '역회전 더블쿠션.' },
      { shotType: '끌어치기', description: '역회전 끌어치기.' },
      { shotType: '리버스 엔드', description: '대각선 리버스 (1510_6538_1500 패턴).' },
    ],
    examples: [
      {
        layout: '2225_6015_0510',
        source: '재퐁 (애디먹스 리버스)',
        feature: '브루사 월드컵 — 17점째 명샷',
        numbers: '리버스 — 1쿠션→2쿠션 막바지 급격히 휨',
        impact: '1시 30분 방향 1.5~2팁',
        thickness: '얇게 (1/4)',
        stroke: '간결하고 짧게 밀어치기 (큐 재빨리 뒤로)',
        note: '강하지 않은 힘으로도 급격한 커브. 왁스 영향으로 미끌림 활용.',
      },
      {
        source: '재퐁 50-40 코너 표준',
        feature: '코너 도달',
        numbers: '출발 50, 1쿠션 40, 코너 도달',
        impact: '1시 30분 방향 3팁 (역회전)',
        thickness: '— (빈쿠션 또는 1적구 1/2)',
        stroke: '평범한 팔로우샷 (속도 민감)',
        note: '미끄러운 천에서 효과적. 빠르면 짧아짐.',
      },
      {
        source: '재퐁 출발선 표준',
        feature: '20·35·50선 외움',
        numbers: '출발 20·35·50 외우면 나머지 추정',
        impact: '1시 30분 방향 3팁',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '연장선 = 1쿠션을 F&H 출발점으로 보면 계산 가능.',
      },
      {
        source: '당구박사 12번 리버스 기초',
        feature: '리버스 기초 영상',
        numbers: '역회전 → 1쿠션 후 정회전',
        impact: '1시 30분 3팁 (역회전)',
        thickness: '제1적구의 1/2',
        stroke: '20-25cm 빠른 가속도 팔로우샷',
        note: '천 상태 영향 큼 — 끈끈한 천에서 너무 길어질 수 있음.',
      },
    ],
    sources: [
      '3C-Master (CCUSEAN)', '재퐁 (japong.com)',
      '당구박사 — 3구기본기술 12번', '당구형 (50-40=코너 영상)',
      '3cman.co.kr (대칭 이해)', '표은호 (서울당구연맹)',
    ],
  },

  // ─────────── 32 시스템 ★★ ───────────
  thirtytwo: {
    id: 'thirtytwo',
    guideId: 'thirtytwo',
    name: { ko: '32 시스템', en: '32 System' },
    alternateNames: ['장축 더블레일', '되오기 시스템'],
    difficulty: 2,
    category: 'tracking',
    applicableShots: ['장축 더블레일 (4쿠션)'],
    formula: '1쿠션값 = 32 - (수구수 + 목적지수)',
    formulaDetail:
      '장축 4쿠션 더블레일 (장단장단 되돌리기) 시스템. ' +
      '하단 장축에서 맥시멈 회전으로 0포인트 향해 친 공이 위로 진행. ' +
      '상수 32는 표준 — 미끄러운 테이블에서는 30, 끈끈하면 36 사용.',
    coordinates: {
      source: '수구수 — 상단 코너에서 수구 잇는 직선이 단축에 만나는 수.',
      cushion: '1쿠션 — 하단 장축. 한 포인트당 5단위.',
      target: '목적지수 — 상단 코너에서 목적구 잇는 직선이 단축에 만나는 수.',
    },
    standard: {
      impact: '4:30 max스핀 (또는 7:30 — 진행 방향에 따라). 정면 적구 향.',
      thickness: '정면 (1적구가 1쿠션과 평행 진행).',
      speed: '2.5~3 레일 (적당). bigballangel: "절대 강하게 치지마세요".',
      stroke: '팔로우 스트로크 — 회전이 살아 진행되도록. 강한 스트로크 X.',
    },
    corrections: [
      {
        condition: '미끄러운 테이블',
        adjustment: '30 사용.',
      },
      {
        condition: '끈끈한 테이블 (천 무거움)',
        adjustment: '36 사용.',
      },
      {
        condition: '목적구가 0 위치이나 장축 따라 위로 올라옴',
        adjustment: '약간의 보정 (3쿠션 먼저 형성 후 목적구 맞도록).',
      },
    ],
    keyPoints: [
      '4쿠션 더블레일 (장단장단) — 일반 더블레일과 다른 형태.',
      '한 포인트 = 5단위 (다른 시스템과 차이 — 보통 10단위).',
      '팔로우 스트로크 + max 회전 — 강하게 치면 회전 잃음.',
      '32, 30, 36 — 테이블 상태로 선택.',
    ],
    commonMistakes: [
      '한 포인트당 10단위로 잘못 계산.',
      '회전 부족 → 4쿠션 도달 못함.',
      '테이블 상태 무시 → 32, 30, 36 선택 잘못.',
      '두께 정면 안 맞고 1적구가 비스듬 진행.',
    ],
    applications: [
      {
        shotType: '장축 더블레일 (4쿠션 되돌아오기)',
        description: '시스템 본 응용 — 다른 형태에는 적용 어려움.',
      },
    ],
    examples: [
      {
        source: 'bigballangel 32 표준',
        feature: '4쿠션 장축 더블레일 — 수구 6 + 도착 6',
        numbers: '수구 6, 도착 6, 1쿠션 = 32 - (6+6) = 20',
        impact: '10시 30분 방향 max팁 (역회전)',
        thickness: '— (빈쿠션) 또는 1/2 (1적구 있을 시)',
        stroke: '20-25cm 빠른 가속도 팔로우샷',
        note: '한 포인트=5단위. 강하게 치면 회전 잃음.',
      },
      {
        source: 'bigballangel 32 응용',
        feature: '미끄러운 테이블 — 30 사용',
        numbers: '수구 4, 도착 4, 1쿠션 = 30 - (4+4) = 22',
        impact: '10시 30분 max팁',
        thickness: '— (빈쿠션)',
        stroke: '20-25cm 빠른 가속',
        note: '미끄러운 천 — 30 / 끈끈한 천 — 36 사용.',
      },
    ],
    sources: ['bigballangel (다음 카페)', '한국 동호인 자료'],
  },

  // ─────────── 35과 1/2 시스템 ★★ ───────────
  thirtyfivehalf: {
    id: 'thirtyfivehalf',
    name: { ko: '35과 1/2 시스템', en: '35 and a Half System' },
    alternateNames: ['35½ 시스템'],
    difficulty: 2,
    category: 'tracking',
    applicableShots: ['빈쿠션 (단순 산술)'],
    formula: '도착값 = (출발값 + 35) / 2',
    formulaDetail:
      '단순 산술 회귀 시스템. 60 출발 시 (60+35)/2 = 47.5 도착, 47.5 출발 시 (47.5+35)/2 = 41.25 도착... ' +
      '60 부근에서 회귀 (60 = 60). 60 초과부터 부호 변화.',
    coordinates: {
      source: '단쿠션 또는 장쿠션 — 파이브앤하프 포인트 체계 사용.',
      cushion: '— (직접 계산 결과로 도출).',
      target: '계산 결과 도착값 = 3쿠션 또는 도착 지점.',
    },
    standard: {
      impact: '12:00 무회전 ~ 1팁.',
      thickness: '1/2.',
      speed: '2.8~3.2 레일.',
      stroke: '부드럽게.',
    },
    corrections: [
      {
        condition: '60 초과 출발',
        adjustment: '부호 (-) 적용.',
      },
    ],
    keyPoints: [
      '단순 산술 — 다른 시스템보다 외우기 쉬움.',
      '60 = 회귀점 (가장 정확).',
      '자료 빈약 — 널리 쓰이지 않음.',
    ],
    commonMistakes: ['60 부근에서만 정확 — 멀어질수록 부정확.'],
    applications: [{ shotType: '빈쿠션 (단순)', description: '간단한 빈쿠션 계산.' }],
    examples: [
      {
        source: 'Manual Factory 35½ 표준',
        feature: '60 회귀점 — 가장 정확',
        numbers: '60 → (60+35)/2 = 47.5 (도착)',
        impact: '12시 무회전',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '60 = 회귀점. 단순 산술로 외우기 쉬움.',
      },
      {
        source: 'Billinote 35½ 응용',
        feature: '47.5 출발 — 다음 도착 41.25',
        numbers: '47.5 → (47.5+35)/2 = 41.25',
        impact: '12시 무회전',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '60 부근 정확. 멀어질수록 부정확.',
      },
    ],
    sources: ['Manual Factory', 'Billinote', 'mycodings'],
  },

  // ─────────── 17/25 시스템 ★ ───────────
  seventeen: {
    id: 'seventeen',
    name: { ko: '17 대칭 시스템', en: '17 Symmetric System' },
    alternateNames: ['25 시스템', '17 대칭점 시스템'],
    difficulty: 1,
    category: 'angle',
    applicableShots: ['빈쿠션 (단순 무회전)'],
    formula: '17 → 0 (코너) → 17 회귀',
    formulaDetail:
      '17포인트에서 코너(0)를 향해 무회전으로 친 공이 다시 17포인트로 돌아오는 대칭 시스템. ' +
      '무회전 시스템 가족의 회귀 변형.',
    coordinates: {
      source: '단쿠션 17포인트 (또는 25, 변형).',
      cushion: '코너 (0).',
      target: '대칭으로 자동 결정 (시작점 = 도착점).',
    },
    standard: {
      impact: '12:00 무회전.',
      thickness: '1/2 (볼퍼스트 시).',
      speed: '보통.',
      stroke: '평범한 스트로크.',
    },
    corrections: [],
    keyPoints: [
      '무회전 시스템의 회귀 변형.',
      '코너에서 다시 같은 포인트로 돌아옴 (대칭).',
      '자료 빈약 — 30/50 시스템에 비해 덜 알려짐.',
    ],
    commonMistakes: ['좌우 회전 → 무회전 룰 깨짐.'],
    applications: [
      {
        shotType: '빈쿠션 (단순 회귀)',
        description: '17→코너→17 패턴 단순 응용.',
      },
    ],
    examples: [
      {
        source: '3분 당구 (YouTube) 17 표준',
        feature: '17→0(코너)→17 회귀 패턴',
        numbers: '17 → 0 → 17',
        impact: '12시 무회전',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '코너 통과 후 대칭 회귀. 게임 전 천 진단용.',
      },
      {
        source: '한국 동호인 25 변형',
        feature: '25→0→25 변형',
        numbers: '25 → 0 → 25',
        impact: '12시 무회전',
        thickness: '— (빈쿠션)',
        stroke: '평범한 팔로우샷',
        note: '17 시스템 가족의 변형 — 출발선 다름.',
      },
    ],
    sources: ['YouTube (3분 당구)', '한국 동호인 자료 (자료 빈약)'],
  },
};

// ════════════════════════════════════════════════════════════════
// Helper 함수
// ════════════════════════════════════════════════════════════════

/** 시스템 콘텐츠 조회 (없으면 null). */
export function getSystemContent(id: SystemContentId): SystemContent | null {
  return SYSTEM_CONTENT[id] ?? null;
}

/** SystemGuide ID로부터 SystemContent 조회 (mirror, none, plus15는 없음). */
export function getSystemContentByGuide(guide: SystemGuide): SystemContent | null {
  const map: Partial<Record<SystemGuide, SystemContentId>> = {
    fh: 'fh',
    plus: 'plus',
    half: 'half',
    ball: 'ball',
    noenglish: 'noenglish',
    sunrise: 'sunrise',
    minus15: 'minus15',
    minus20: 'minus20',
    reverse: 'reverse',
    thirtytwo: 'thirtytwo',
  };
  const id = map[guide];
  return id ? SYSTEM_CONTENT[id] : null;
}

/** 우선순위 순으로 정렬된 시스템 ID 배열. */
export function getSystemsByDifficulty(): SystemContentId[] {
  return Object.values(SYSTEM_CONTENT)
    .sort((a, b) => b.difficulty - a.difficulty)
    .map((s) => s.id);
}

/** 카테고리별 시스템 ID 배열. */
export function getSystemsByCategory(
  category: SystemContent['category'],
): SystemContentId[] {
  return Object.values(SYSTEM_CONTENT)
    .filter((s) => s.category === category)
    .map((s) => s.id);
}

// ════════════════════════════════════════════════════════════════
// 다이아 라벨링 — 시스템별 좌표 라벨
// ════════════════════════════════════════════════════════════════

/**
 * 다이아 라벨 정보.
 *   - idx: 다이아 인덱스 (단쿠션 0~8, 장쿠션 0~4 — 양 끝 코너 포함).
 *   - text: 표시 텍스트.
 *   - bold: 강조 여부 (핵심 포인트).
 *   - role: 라벨 역할 (출발값·1쿠션값·3쿠션값·회전수 등 — 색상 구분용).
 */
export interface DiamondLabel {
  idx: number;
  text: string;
  bold?: boolean;
  role?: 'source' | 'cushion' | 'target' | 'rotation' | 'key';
}

export interface DiamondLabelMap {
  /** 단쿠션 위쪽 (cy=DIAMOND_TOP_Y). 9개 다이아 (인덱스 0~8). */
  shortTop: DiamondLabel[];
  /** 단쿠션 아래쪽 (cy=DIAMOND_BOT_Y). */
  shortBot: DiamondLabel[];
  /** 장쿠션 왼쪽 (cx=DIAMOND_LEFT_X). 5개 다이아 (인덱스 0~4). */
  longLeft: DiamondLabel[];
  /** 장쿠션 오른쪽 (cx=DIAMOND_RIGHT_X). */
  longRight: DiamondLabel[];
}

/** F&H 단쿠션 출발/도착값 (5다이아). 3C-Master 표준: 0p=50, 1p=60, 2p=70, 3p=90, 4p=110. */
function fhSourceLabelText(diamond: number): string {
  if (diamond <= 2) return String(50 + diamond * 10);
  // 70 이상부터 1p마다 +20
  return String(70 + (diamond - 2) * 20);
}

/** F&H 장쿠션 1쿠션값 (9다이아). 3C-Master 표준: 0~5p 1p당 +10, 5p 이후 1p당 +20. */
function fhCushionLabelText(diamond: number): string {
  if (diamond <= 5) return String(diamond * 10);
  return String(50 + (diamond - 5) * 20);
}

/**
 * 시스템별 다이아 라벨 매핑 반환 (없으면 null — 라벨 표시 안 함).
 *
 * 각 시스템의 좌표 체계 차이:
 *   F&H        — 양쪽 단쿠션 비선형 (50/60/80/100), 양쪽 장쿠션 (0/10/20/30/40)
 *   Plus       — 양쪽 단쿠션 1p당+10 (0/10/20/30/40), 장쿠션 X/30/50 단 3개
 *   Half       — 단쿠션 8등분 (0~8), 장쿠션 4등분 (0~4) — 단순 인덱스
 *   No English — F&H와 유사 라벨 + 핵심 포인트 (15, 30, 50) 강조
 *   -15/-20    — 단쿠션 5단위 8개 포인트 (15·20·25·30·35·40·45·50)
 *   32         — 단쿠션 5단위 (한 포인트 = 5)
 *   Reverse    — F&H와 동일 라벨 (역회전)
 *   35과1/2    — F&H와 동일 라벨
 *   17 대칭    — 17p만 강조
 *   Ball       — null (라인만 사용, 다이아 라벨 X)
 *   일출일몰    — null (4값 동시 표시 복잡 — 별도 시각화 필요)
 */
export function getDiamondLabels(id: SystemContentId): DiamondLabelMap | null {
  // 좌표 매핑 명시:
  //   shortTop·shortBot = SVG 가로 변(위·아래) = 장쿠션 (9 다이아 = 8p)
  //   longLeft·longRight = SVG 세로 변(좌·우) = 단쿠션 (5 다이아 = 4p)
  // (변수명은 history 호환을 위해 유지; 실제 위치는 위 매핑 따름)
  switch (id) {
    case 'fh': {
      // 장쿠션 9다이아 (가로 변) — 1쿠션값. 3C-Master 표준:
      //   0p=0, 1p=10, ..., 5p=50, (5p부터 0.5p마다 +10) 6p=70, 7p=90, 8p=110
      const cushionLabels: DiamondLabel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({
        idx: d,
        text: fhCushionLabelText(d),
        role: 'cushion',
      }));
      // 단쿠션 5다이아 (세로 변) — 출발값/도착값:
      //   0p=50, 1p=60, 2p=70, (2p부터 0.5p마다 +10) 3p=90, 4p=110
      const sourceLabels: DiamondLabel[] = [0, 1, 2, 3, 4].map((d) => ({
        idx: d,
        text: fhSourceLabelText(d),
        role: 'source',
      }));
      return {
        shortTop: cushionLabels,    // 장쿠션 위 = 1쿠션값
        shortBot: cushionLabels,    // 장쿠션 아래 = 1쿠션값 (대칭)
        longLeft: sourceLabels,     // 단쿠션 좌 = 출발값/도착값
        longRight: sourceLabels,    // 단쿠션 우 = 출발값/도착값
      };
    }

    case 'plus': {
      // 장쿠션 9다이아 (가로 변) — 출발값/3쿠션값. 1p당 +10 일직선:
      //   0p=0, 1p=10, 2p=20, ..., 8p=80
      const sourceLabels: DiamondLabel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({
        idx: d,
        text: String(d * 10),
        role: 'source',
      }));
      // 단쿠션 5다이아 (세로 변) — 1쿠션값. 핵심만:
      //   X(코너 부근), 30, 50
      const cushionLabels: DiamondLabel[] = [
        { idx: 1, text: 'X', role: 'cushion', bold: true },
        { idx: 2, text: '30', role: 'cushion', bold: true },
        { idx: 3, text: '40', role: 'cushion' },
        { idx: 4, text: '50', role: 'cushion', bold: true },
      ];
      return {
        shortTop: sourceLabels,    // 장쿠션 = 출발값
        shortBot: sourceLabels,    // (대칭)
        longLeft: cushionLabels,   // 단쿠션 = 1쿠션값
        longRight: cushionLabels,
      };
    }

    case 'half': {
      // 단순 다이아 번호 (위치 기반 학습용)
      const longCushionLabels: DiamondLabel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
        idx: n,
        text: String(n),
        role: 'cushion',
      }));
      const shortCushionLabels: DiamondLabel[] = [0, 1, 2, 3, 4].map((n) => ({
        idx: n,
        text: String(n),
        role: 'source',
      }));
      return {
        shortTop: longCushionLabels,    // 장쿠션 9다이아 인덱스
        shortBot: longCushionLabels,
        longLeft: shortCushionLabels,   // 단쿠션 5다이아 인덱스
        longRight: shortCushionLabels,
      };
    }

    case 'noenglish': {
      // 50 시스템 + 30 시스템 + 15 시스템 종합. 핵심 포인트 강조.
      // 장쿠션 9다이아 (가로 변): 0~80 일직선 (1p당 +10)
      const longCushionLabels: DiamondLabel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(
        (d) => {
          const val = d * 10;
          return {
            idx: d,
            text: String(val),
            role: 'cushion',
            bold: val === 30 || val === 50,
          };
        },
      );
      // 단쿠션 5다이아 (세로 변): 0~40 (1p당 +10) — 무회전 룰 단순
      const shortCushionLabels: DiamondLabel[] = [0, 1, 2, 3, 4].map((d) => {
        const val = d * 10;
        return {
          idx: d,
          text: String(val),
          role: 'source',
          bold: val === 30,
        };
      });
      return {
        shortTop: longCushionLabels,
        shortBot: longCushionLabels,
        longLeft: shortCushionLabels,
        longRight: shortCushionLabels,
      };
    }

    case 'minus15':
    case 'minus20': {
      // -15/-20 시스템 — 단쿠션 5다이아 5단위 — 한국 동호인 자료 기반
      // 단쿠션 (세로 변) 5다이아: 50, 40, 30, 20, 10 (코너에서 멀어질수록 감소)
      const shortCushionLabels: DiamondLabel[] = [0, 1, 2, 3, 4].map((d) => ({
        idx: d,
        text: String(50 - d * 10),
        role: 'key',
      }));
      return {
        shortTop: [],
        shortBot: [],
        longLeft: shortCushionLabels,
        longRight: shortCushionLabels,
      };
    }

    case 'reverse':
    case 'thirtyfivehalf': {
      // F&H 룰과 동일 라벨 사용 (역회전 트랙선)
      const cushionLabels: DiamondLabel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({
        idx: d,
        text: fhCushionLabelText(d),
        role: 'cushion',
      }));
      const sourceLabels: DiamondLabel[] = [0, 1, 2, 3, 4].map((d) => ({
        idx: d,
        text: fhSourceLabelText(d),
        role: 'source',
      }));
      return {
        shortTop: cushionLabels,    // 장쿠션 = 1쿠션값
        shortBot: cushionLabels,
        longLeft: sourceLabels,     // 단쿠션 = 출발값
        longRight: sourceLabels,
      };
    }

    case 'thirtytwo': {
      // 32 시스템 — 장쿠션 9다이아 (가로 변): 5단위 0~40 (1p당 +5)
      const longCushionLabels: DiamondLabel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({
        idx: d,
        text: String(d * 5),
        role: 'cushion',
      }));
      return {
        shortTop: longCushionLabels,
        shortBot: longCushionLabels,
        longLeft: [],
        longRight: [],
      };
    }

    case 'seventeen': {
      // 17 대칭 — 단쿠션 좌·우 (5다이아) 17 강조
      const sourceLabels: DiamondLabel[] = [
        { idx: 0, text: '0', role: 'key' },
        { idx: 1, text: '17', bold: true, role: 'key' },
        { idx: 3, text: '17', bold: true, role: 'key' },
        { idx: 4, text: '0', role: 'key' },
      ];
      return {
        shortTop: [],
        shortBot: [],
        longLeft: sourceLabels,
        longRight: sourceLabels,
      };
    }

    case 'ball':
    case 'sunrise':
      // 라벨 X — Ball은 라인만, 일출일몰은 4값 동시 표시 복잡 (TODO 별도 시각화)
      return null;

    default:
      return null;
  }
}

// ════════════════════════════════════════════════════════════════
// 권장 당점 (시계 다이얼 시각화용)
// ════════════════════════════════════════════════════════════════

/**
 * 권장 당점 정보.
 *   - a: 좌우 (-1 = 9시, +1 = 3시)
 *   - b: 상하 (-1 = 6시, +1 = 12시)
 *   - r: 외곽 거리 (0 = 중앙, 1 = max 3T)
 *   - label: 시계 + 팁 라벨 (예: "9:30 3T")
 *
 * 참고: 일부 시스템은 가변 (조건부) — 가장 일반적인 케이스만 표시.
 *   F&H — 출발 30~70 구간 9:30 3T 기본 (다른 케이스는 keyPoints 참조)
 *   Ball — 두께에 따라 가변 (4/8 이하 상단, 이상 중단) — 단순화
 *   일출일몰 — 회전수 따라 가변 (계산식)
 */
export interface RecommendedImpact {
  a: number;
  b: number;
  label: string;
}

export function getRecommendedImpact(id: SystemContentId): RecommendedImpact | null {
  // 좌표는 examples.ts impactToCueAB와 일관되게 계산:
  // a = cos(π/2 - clockHour/12·2π) * radius
  // b = sin(π/2 - clockHour/12·2π) * radius
  // radius (사용자 명시 "공 반지름의 1/3씩"): 1팁=1/3, 2팁=2/3, 3팁=1.0 (가장자리)
  switch (id) {
    case 'fh':
      // 9:30 3T → cos(2.88)=−0.966, sin=+0.259, r=1 → (−0.966, +0.259) 좌상 가장자리
      return { a: -0.966, b: 0.259, label: '9:30 3T' };
    case 'plus':
      // 1:30 3T → cos(π/4)=0.707, sin=0.707, r=1 → (+0.707, +0.707) 우상 가장자리
      return { a: 0.707, b: 0.707, label: '1:30 3T' };
    case 'half':
      // 12시 무회전 (0, 0)
      return { a: 0, b: 0, label: '12시 무회전' };
    case 'ball':
      // 가변 — 단순화: 12시 1T (b=+1/3)
      return { a: 0, b: 1 / 3, label: '12시 1T (가변)' };
    case 'noenglish':
      return { a: 0, b: 0, label: '12시 무회전' };
    case 'sunrise':
      // 12시 3T → (0, +1.0) 가장자리
      return { a: 0, b: 1.0, label: '12시 3T' };
    case 'minus15':
    case 'minus20':
      // 12시 1T (느낌팁/마이너스팁 보정)
      return { a: 0, b: 1 / 3, label: '12시 1T' };
    case 'reverse':
      // 1:30 3T 역회전 → (+0.707, +0.707) 가장자리
      return { a: 0.707, b: 0.707, label: '1:30 3T (역회전)' };
    case 'thirtytwo':
      // 4:30 max → (+0.707, −0.707) 우하 가장자리
      return { a: 0.707, b: -0.707, label: '4:30 max스핀' };
    case 'thirtyfivehalf':
      return { a: 0, b: 1 / 3, label: '12시 1T' };
    case 'seventeen':
      return { a: 0, b: 0, label: '12시 무회전' };
    default:
      return null;
  }
}

// ════════════════════════════════════════════════════════════════
// 응용 예시 자동 배치 — 시스템별 표준 배치
// ════════════════════════════════════════════════════════════════

/**
 * 응용 예시 데이터.
 *
 * 좌표 체계:
 *   - SVG 좌표 (Table.tsx의 DIAMOND_X·Y 체계) — 펠트 영역 83~729 × 26~349
 *   - 적용 시 svgToEngine 변환 후 setBallPos 호출
 *   - 큐 phi는 자동 — 큐볼·1적구(yellow) 라인 따라 자동 계산
 *
 * 구성:
 *   - cue (white): 큐볼
 *   - yellow: 1적구 (큐볼이 가장 먼저 맞는 적구)
 *   - red: 2적구 (3쿠션 도달 목표)
 */
export interface SystemApplicationExample {
  id: string;
  /** 한국어 라벨 (UI 표시). */
  label: string;
  /** 응용 형태 (한국어 — 뒤돌리기·옆돌리기·앞돌리기·빈쿠션·비껴치기·대회전). */
  shotType: string;
  /** SVG 좌표 (Table.tsx와 일치). */
  positions: {
    cue: [number, number];
    yellow: [number, number];
    red: [number, number];
  };
  /**
   * 당점 라벨 (예: '9시 30분 방향 3팁', '12시 무회전', '1시 방향 2팁').
   * impact 라벨에서 a/b 자동 산출 (examples.parseImpact + impactToCueAB).
   * 명시 시 cueA/B는 무시됨. 권장: 항상 impact 라벨 사용.
   */
  impact?: string;
  /**
   * 두께 라벨 (예: '8/8 (정타)', '제1적구 1/2', '— (빈쿠션)', '얇게 1/8').
   * 빈쿠션 (1적구 안 맞음)일 때 '빈쿠션' 키워드 포함하면 phi 옵셋 자동 큰 각도.
   * 명시 시 cuePhiOffsetDeg는 무시됨.
   */
  thickness?: string;
  /**
   * @deprecated impact 라벨 사용 권장. 큐 a 직접 입력 (단위원 안에 있어야 함).
   */
  cueA?: number;
  /**
   * @deprecated impact 라벨 사용 권장. 큐 b 직접 입력.
   */
  cueB?: number;
  /** V0 (m/s). */
  cueV0: number;
  /**
   * @deprecated thickness 라벨 사용 권장.
   * 큐 phi 옵셋 (도). 큐볼 → 1적구 자동 phi 위에 적용.
   */
  cuePhiOffsetDeg?: number;
  /**
   * 큐볼이 위치한 쿠션 (수구쿠션). 라벨 강조용.
   *   - 'top'/'bottom': 단쿠션 위/아래
   *   - 'left'/'right': 장쿠션 좌/우
   */
  sourceCushion?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * 큐볼이 도달할 쿠션 (도착쿠션). 라벨 강조용 (3쿠션 도착 위치).
   */
  targetCushion?: 'top' | 'bottom' | 'left' | 'right';
  /** 짧은 설명 (옵션). */
  description?: string;
}

/** 시스템별 응용 예시 매핑. */
const SYSTEM_APPLICATIONS: Partial<Record<SystemContentId, SystemApplicationExample[]>> = {
  fh: [
    {
      id: 'fh-back-50-0',
      label: '뒤돌리기 50-0',
      shotType: '뒤돌리기',
      positions: {
        // 우상단 단쿠션 50 코너 가까이 이동 — 50 라인 매칭용
        cue: [690, 70],
        yellow: [560, 130],
        red: [180, 310],
      },
      impact: '9시 30분 방향 3팁',
      thickness: '제1적구 1/2',
      cueV0: 4.5,
      sourceCushion: 'top',
      targetCushion: 'bottom',
      description: '1적구 옆 가상 출발 50, 1쿠션 0(코너) → 3쿠션 50 도착',
    },
    {
      id: 'fh-side-50-30',
      label: '옆돌리기 50-30',
      shotType: '옆돌리기',
      positions: {
        cue: [650, 220],
        yellow: [520, 175],
        red: [240, 320],
      },
      impact: '9시 30분 방향 3팁',
      thickness: '제1적구 1/2',
      cueV0: 4.3,
      sourceCushion: 'right',
      targetCushion: 'bottom',
      description: '1적구 옆 가상 출발 50 + 1쿠션 30 → 3쿠션 20',
    },
  ],
  plus: [
    {
      id: 'plus-front-30-30',
      label: '앞돌리기 30-30',
      shotType: '앞돌리기',
      positions: {
        cue: [325, 70],
        yellow: [400, 145],
        red: [567, 290],
      },
      impact: '1시 30분 방향 3팁',
      thickness: '제1적구 1/2',
      cueV0: 4.8,
      sourceCushion: 'top',
      targetCushion: 'bottom',
      description: '출발 30 + 1쿠션 30 → 3쿠션 60 도달',
    },
  ],
  half: [
    {
      id: 'half-bank-4-2',
      label: '빈쿠션 4→2',
      shotType: '빈쿠션',
      positions: {
        cue: [406, 320],
        yellow: [200, 80],
        red: [150, 130],
      },
      impact: '12시 무회전',
      thickness: '— (빈쿠션)',
      cueV0: 4.0,
      sourceCushion: 'bottom',
      targetCushion: 'top',
      description: '4포인트에서 2포인트 향함 → 0(코너) 도달 (입사=반사)',
    },
  ],
  minus20: [
    {
      id: 'm20-back-50-30',
      label: '뒤돌리기 50-30',
      shotType: '뒤돌리기 (짧게)',
      positions: {
        cue: [690, 90],
        yellow: [500, 150],
        red: [200, 310],
      },
      impact: '12시 1팁',
      thickness: '제1적구 1/2',
      cueV0: 3.8,
      sourceCushion: 'top',
      targetCushion: 'bottom',
      description: '수구 50 - 1적구 30 - 20 = 1쿠션 0 (코너 가까이)',
    },
  ],
  noenglish: [
    {
      id: 'noenglish-50',
      label: '50 시스템',
      shotType: '빈쿠션 무회전',
      positions: {
        cue: [690, 90],
        yellow: [400, 200],
        red: [180, 290],
      },
      impact: '12시 무회전',
      thickness: '— (빈쿠션)',
      cueV0: 3.5,
      cuePhiOffsetDeg: -30,
      sourceCushion: 'top',
      targetCushion: 'bottom',
      description: '50포인트 → 반대편 같은 위치 50 도달 (정회전 정도 조절)',
    },
  ],
  reverse: [
    {
      id: 'reverse-double-rail',
      label: '더블레일 (접시)',
      shotType: '더블레일',
      positions: {
        cue: [700, 200],
        yellow: [580, 165],
        red: [200, 220],
      },
      impact: '1시 30분 방향 3팁',
      thickness: '제1적구 1/2',
      cueV0: 4.3,
      sourceCushion: 'right',
      targetCushion: 'left',
      description: '역회전 3팁 1쿠션 후 정회전 → 더블레일',
    },
    {
      id: 'reverse-3bank',
      label: '3뱅크 빈쿠션',
      shotType: '빈쿠션',
      positions: {
        cue: [567, 70],
        yellow: [300, 200],
        red: [150, 320],
      },
      impact: '1시 30분 방향 3팁',
      thickness: '— (빈쿠션)',
      cueV0: 4.3,
      sourceCushion: 'top',
      targetCushion: 'bottom',
      description: '역회전 3팁 빈쿠션 → 정회전 진행',
    },
  ],
  thirtytwo: [
    {
      id: '32-double-rail',
      label: '장축 더블레일',
      shotType: '4쿠션 더블레일',
      positions: {
        cue: [244, 320],
        yellow: [488, 200],
        red: [567, 320],
      },
      impact: '4시 30분 방향 3팁',
      thickness: '제1적구 1/2',
      cueV0: 4.8,
      sourceCushion: 'bottom',
      targetCushion: 'bottom',
      description: '32 - (수구 10 + 목적지 10) = 1쿠션 12 → 4쿠션 되돌리기 (팔로우 스트로크)',
    },
  ],
  ball: [
    {
      id: 'ball-side',
      label: '옆돌리기 (4두께+2팁)',
      shotType: '옆돌리기',
      positions: {
        cue: [650, 250],
        yellow: [520, 180],
        red: [180, 320],
      },
      impact: '9시 방향 2팁',
      thickness: '제1적구 1/2',
      cueV0: 4.3,
      sourceCushion: 'right',
      targetCushion: 'bottom',
      description: '두께 4/8 + 회전 2팁 = 합 6 (옆돌리기)',
    },
  ],
  sunrise: [
    {
      id: 'sunrise-bias',
      label: '비껴치기 0+0+0',
      shotType: '비껴치기',
      positions: {
        cue: [700, 90],
        yellow: [560, 160],
        red: [200, 200],
      },
      impact: '12시 3팁',
      thickness: '제1적구 1/4',
      cueV0: 4.5,
      sourceCushion: 'top',
      targetCushion: 'left',
      description: '출발 0 + 1쿠션 0 + 3쿠션 0 → 회전 0 (12시 3T)',
    },
  ],
};

/** 시스템별 응용 예시 조회. */
export function getSystemApplications(id: SystemContentId): SystemApplicationExample[] {
  return SYSTEM_APPLICATIONS[id] ?? [];
}

/** 시스템 + 응용 예시 ID로 찾기 (다이아 라벨 강조용). */
export function findApplicationExampleById(
  id: SystemContentId,
  exampleId: string,
): SystemApplicationExample | null {
  const examples = SYSTEM_APPLICATIONS[id];
  if (!examples) return null;
  return examples.find((e) => e.id === exampleId) ?? null;
}

// ════════════════════════════════════════════════════════════════
// 시스템 가이드 라인 (다이아 잇는 SVG 폴리라인)
// ════════════════════════════════════════════════════════════════
// CushionDir 매핑 (엔진 기준):
//   'top'    = 엔진 ey=0 변 = SVG 우측 세로 변 = 단쿠션 (5다이아)
//   'bottom' = 엔진 ey=L 변 = SVG 좌측 세로 변 = 단쿠션 (5다이아)
//   'left'   = 엔진 ex=0 변 = SVG 위쪽 가로 변 = 장쿠션 (9다이아)
//   'right'  = 엔진 ex=W 변 = SVG 아래쪽 가로 변 = 장쿠션 (9다이아)
// ════════════════════════════════════════════════════════════════

/** 다이아 SVG 좌표 (DiamondLabels.tsx와 동기화). */
const DIAMOND_X = [83, 163.75, 244.5, 325.25, 406, 486.75, 567.5, 648.25, 729];
const DIAMOND_Y = [26, 106.75, 187.5, 268.25, 349];
const FELT_TOP_Y = 26;
const FELT_BOT_Y = 349;
const FELT_LEFT_X = 83;
const FELT_RIGHT_X = 729;

export type CushionDir = 'top' | 'bottom' | 'left' | 'right';

export interface GuideLineCoord {
  /** SVG 좌표 폴리라인 (출발 → 1쿠션 → 도착). */
  points: [number, number][];
  sourceCushion: CushionDir;
  targetCushion: CushionDir;
  /** 라인 라벨 (예: "50-0", "30+30=60"). */
  label: string;
}

/**
 * 단쿠션 다이아 인덱스 → SVG 좌표.
 * 엔진 기준: 'top' = 단쿠션 우 (ey=0), 'bottom' = 단쿠션 좌 (ey=L)
 */
function shortCushionCoord(
  idx: number,
  side: 'top' | 'bottom',
): [number, number] {
  const x = side === 'top' ? FELT_RIGHT_X : FELT_LEFT_X;
  return [x, DIAMOND_Y[idx]];
}

/**
 * 장쿠션 다이아 인덱스 → SVG 좌표.
 * 엔진 기준: 'left' = 장쿠션 위 (ex=0), 'right' = 장쿠션 아래 (ex=W)
 */
function longCushionCoord(
  idx: number,
  side: 'left' | 'right',
): [number, number] {
  const y = side === 'left' ? FELT_TOP_Y : FELT_BOT_Y;
  return [DIAMOND_X[idx], y];
}

/** SVG 점 좌우 미러 (단쿠션 'top'↔'bottom' = SVG 우↔좌). */
function mirrorSvgX(p: [number, number]): [number, number] {
  return [DIAMOND_X[8] + DIAMOND_X[0] - p[0], p[1]];
}

/** SVG 점 상하 미러 (장쿠션 'left'↔'right' = SVG 위↔아래). */
function mirrorSvgY(p: [number, number]): [number, number] {
  return [p[0], FELT_TOP_Y + FELT_BOT_Y - p[1]];
}

/** CushionDir 좌우 미러 ('top'↔'bottom'). */
function mirrorCushionTopBottom(d: CushionDir): CushionDir {
  if (d === 'top') return 'bottom';
  if (d === 'bottom') return 'top';
  return d;
}

/** CushionDir 상하 미러 ('left'↔'right'). */
function mirrorCushionLeftRight(d: CushionDir): CushionDir {
  if (d === 'left') return 'right';
  if (d === 'right') return 'left';
  return d;
}

/**
 * 한 방향(예: 단쿠션 우 → 장쿠션 위 → 단쿠션 좌)에 대해 정의된 라인을
 * 4방향 모두로 미러링.
 */
function expandToFourDirections(base: GuideLineCoord[]): GuideLineCoord[] {
  const all: GuideLineCoord[] = [];
  for (const ln of base) {
    // 원본
    all.push(ln);
    // SVG x 미러 (단쿠션 top↔bottom)
    all.push({
      points: ln.points.map(mirrorSvgX) as [number, number][],
      sourceCushion: mirrorCushionTopBottom(ln.sourceCushion),
      targetCushion: mirrorCushionTopBottom(ln.targetCushion),
      label: ln.label,
    });
    // SVG y 미러 (장쿠션 left↔right)
    all.push({
      points: ln.points.map(mirrorSvgY) as [number, number][],
      sourceCushion: mirrorCushionLeftRight(ln.sourceCushion),
      targetCushion: mirrorCushionLeftRight(ln.targetCushion),
      label: ln.label,
    });
    // 둘 다 미러
    all.push({
      points: ln.points.map((p) => mirrorSvgY(mirrorSvgX(p))) as [number, number][],
      sourceCushion: mirrorCushionLeftRight(
        mirrorCushionTopBottom(ln.sourceCushion),
      ),
      targetCushion: mirrorCushionLeftRight(
        mirrorCushionTopBottom(ln.targetCushion),
      ),
      label: ln.label,
    });
  }
  return all;
}

/** 파이브앤하프 가이드 라인 (한 방향: 단쿠션 우 → 장쿠션 위 → 단쿠션 좌). */
function fhBaseLines(): GuideLineCoord[] {
  // 3C-Master 표준:
  //   단쿠션 5다이아 (출발/도착): 0p=50, 1p=60, 2p=70, 3p=90, 4p=110
  //   장쿠션 9다이아 (1쿠션):    0p=0,  1p=10, ..., 5p=50, 6p=70, 7p=90, 8p=110
  const fhSrcLabelToIdx: Record<number, number> = {
    50: 0, 60: 1, 70: 2, 90: 3, 110: 4,
  };
  const fhCushLabelToIdx: Record<number, number> = {
    0: 0, 10: 1, 20: 2, 30: 3, 40: 4, 50: 5, 70: 6, 90: 7, 110: 8,
  };
  const lines: GuideLineCoord[] = [];
  // 주요 출발값 (대표 라인): 50, 60, 70
  const sources = [50, 60, 70];
  const cushions = [0, 10, 20, 30, 40, 50];
  // base 방향: 'top'(단쿠션 우) 출발 → 'left'(장쿠션 위) 1쿠션 → 'bottom'(단쿠션 좌) 도착
  // 룰: 출발 - 1쿠션 = 도착
  for (const src of sources) {
    for (const cush of cushions) {
      const target = src - cush;
      if (!(target in fhSrcLabelToIdx)) continue;
      lines.push({
        points: [
          shortCushionCoord(fhSrcLabelToIdx[src], 'top'),       // 단쿠션 우 출발
          longCushionCoord(fhCushLabelToIdx[cush], 'left'),     // 장쿠션 위 1쿠션
          shortCushionCoord(fhSrcLabelToIdx[target], 'bottom'), // 단쿠션 좌 도착
        ],
        sourceCushion: 'top',
        targetCushion: 'bottom',
        label: `${src}-${cush}`,
      });
    }
  }
  return lines;
}

/** 플러스 가이드 라인 (한 방향: 장쿠션 위 → 단쿠션 좌 → 장쿠션 아래). */
function plusBaseLines(): GuideLineCoord[] {
  // Plus 표준:
  //   장쿠션 9다이아 (출발/3쿠션): 0p=0, 1p=10, ..., 8p=80 (1p당 +10 일직선)
  //   단쿠션 5다이아 (1쿠션): X·30·40·50 핵심 포인트
  //   룰: 출발 + 1쿠션 = 3쿠션
  const lines: GuideLineCoord[] = [];
  const sources = [10, 20, 30, 40, 50, 60];
  const cushions = [10, 20, 30, 40];
  // base 방향: 'left'(장쿠션 위) 출발 → 'bottom'(단쿠션 좌) 1쿠션 → 'right'(장쿠션 아래) 도착
  for (const src of sources) {
    for (const cush of cushions) {
      const target = src + cush;
      if (target > 80) continue;
      const srcIdx = src / 10;
      const cushIdx = cush / 10; // 단쿠션 5다이아 (1p당 +10)
      const targetIdx = target / 10;
      lines.push({
        points: [
          longCushionCoord(srcIdx, 'left'),         // 장쿠션 위 출발
          shortCushionCoord(cushIdx, 'bottom'),     // 단쿠션 좌 1쿠션
          longCushionCoord(targetIdx, 'right'),     // 장쿠션 아래 도착
        ],
        sourceCushion: 'left',
        targetCushion: 'right',
        label: `${src}+${cush}=${target}`,
      });
    }
  }
  return lines;
}

/** 하프 가이드 라인 — 장쿠션 X → 반대편 장쿠션 X/2 → 코너 (INPROD 표준). */
function halfBaseLines(): GuideLineCoord[] {
  // INPROD 명시: "장쿠션에는 9개의 포인트... 수구 8포인트 → 맞은편 4포인트 → 코너 도달"
  // 룰: 장쿠션 위(=수구쿠션) idx X → 장쿠션 아래(=반대편) idx X/2 → 좌상단 코너
  const lines: GuideLineCoord[] = [];
  for (let src = 2; src <= 8; src += 2) {
    const cush = src / 2;
    lines.push({
      points: [
        longCushionCoord(src, 'left'),       // 장쿠션 위 출발
        longCushionCoord(cush, 'right'),     // 반대편 장쿠션 1쿠션 (절반)
        // 좌상단 코너 도달 (입사=반사로 자동 결정)
        [FELT_LEFT_X, FELT_TOP_Y],
      ],
      sourceCushion: 'left',
      targetCushion: 'right',
      label: `${src}→${cush}`,
    });
  }
  return lines;
}

/** 무회전 시스템 — 50→50 (대칭) + 30→15 (절반). 1쿠션 통과점 명시. */
function noEnglishBaseLines(): GuideLineCoord[] {
  // Manual Factory 표준:
  //   50 시스템: 50 포인트를 향해 치면 반대편 같은 위치로 향한다.
  //   30 시스템 1: 30 포인트를 향해 치면 반대편 절반 위치로 향한다.
  return [
    // 50 시스템: 단쿠션 우 가운데 → 장쿠션 위 50 (idx 5) → 단쿠션 좌 가운데 (대칭)
    {
      points: [
        shortCushionCoord(2, 'top'),       // 단쿠션 우 idx 2 출발
        longCushionCoord(5, 'left'),       // 장쿠션 위 idx 5 (=50 1쿠션)
        shortCushionCoord(2, 'bottom'),    // 단쿠션 좌 idx 2 도착 (대칭)
      ],
      sourceCushion: 'top',
      targetCushion: 'bottom',
      label: '50→50 (대칭)',
    },
    // 30 시스템: 단쿠션 우 idx 3 → 장쿠션 위 30 (idx 3) → 단쿠션 좌 idx 1 (절반)
    {
      points: [
        shortCushionCoord(3, 'top'),       // 단쿠션 우 idx 3 출발
        longCushionCoord(3, 'left'),       // 장쿠션 위 idx 3 (=30 1쿠션)
        shortCushionCoord(1, 'bottom'),    // 단쿠션 좌 idx 1 도착 (절반)
      ],
      sourceCushion: 'top',
      targetCushion: 'bottom',
      label: '30→15',
    },
  ];
}

/** -20 시스템 — 1쿠션 0(코너) 향함. */
function minus20BaseLines(): GuideLineCoord[] {
  // 룰: 수구수 - 1적구수 - 20 = 1쿠션 0 (코너)
  // 단쿠션 우 출발 50 → 1쿠션 0 (좌상단 코너) → 단쿠션 좌 도착
  return [
    {
      points: [
        shortCushionCoord(0, 'top'),         // 단쿠션 우 코너 (idx 0)
        longCushionCoord(0, 'left'),         // 장쿠션 위 코너 (1쿠션 0)
        shortCushionCoord(2, 'bottom'),      // 단쿠션 좌 idx 2 (도착)
      ],
      sourceCushion: 'top',
      targetCushion: 'bottom',
      label: '50-30-20=0',
    },
  ];
}

/** 32 시스템 — 4쿠션 더블레일 (장단장단). */
function thirtytwoBaseLines(): GuideLineCoord[] {
  // 한 라인: 장쿠션 아래(=출발) → 단쿠션 우 → 장쿠션 위 → 단쿠션 좌 → 장쿠션 아래(도착)
  return [
    {
      points: [
        longCushionCoord(2, 'right'),          // 장쿠션 아래 출발
        shortCushionCoord(3, 'top'),           // 단쿠션 우
        longCushionCoord(6, 'left'),           // 장쿠션 위
        shortCushionCoord(3, 'bottom'),        // 단쿠션 좌
        longCushionCoord(2, 'right'),          // 장쿠션 아래 (되돌아옴)
      ],
      sourceCushion: 'right',
      targetCushion: 'right',
      label: '32 더블레일',
    },
  ];
}

/** 시스템별 가이드 라인 조회 (4방향 미러링 적용). */
export function getSystemGuideLines(id: SystemContentId): GuideLineCoord[] {
  let base: GuideLineCoord[];
  switch (id) {
    case 'fh':
      base = fhBaseLines();
      break;
    case 'plus':
      base = plusBaseLines();
      break;
    case 'half':
      base = halfBaseLines();
      break;
    case 'noenglish':
      base = noEnglishBaseLines();
      break;
    case 'minus20':
      base = minus20BaseLines();
      break;
    case 'thirtytwo':
      base = thirtytwoBaseLines();
      break;
    default:
      return [];
  }
  return expandToFourDirections(base);
}
