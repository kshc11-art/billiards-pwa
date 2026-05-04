import { useMemo } from 'react';
import { useAppStore, useSuccessRate, useSuggestedHandicap } from './store.ts';
import type { AnalysisLayer, ScreenRotation } from './store.ts';
import {
  getDrillsGrouped,
  getDrillById,
  CATEGORY_LABEL,
  TECHNIQUE_LABEL,
} from './drills.ts';
import { fullnessToFraction, v0ToCushion } from './utils.ts';
import type { SystemGuide } from './systems.ts';
import type { FourBallMode } from './scoring.ts';
import {
  TECHNIQUE_CONTENT,
  getTechniquesByCategory,
} from './techniqueContent.ts';

const SYSTEM_LABEL: Record<SystemGuide, string> = {
  none: '없음',
  fh: '파이브앤하프',
  plus: '플러스',
  half: '하프',
  mirror: '미러',
  ball: '볼',
  noenglish: '무회전',
  sunrise: '일출일몰',
  minus15: '-15',
  minus20: '-20',
  plus15: '+15',
  reverse: '리버스',
  thirtytwo: '32',
};

const LAYER_LABEL: Record<AnalysisLayer, string> = {
  impact: '충돌점',
  kiss: '키스',
  separation: '분리각',
  distance: '거리',
  angle30: '두께각',
  noenglish: '무회전',
  multipath: '당점비교',
};

const FOUR_BALL_MODE_LABEL: Record<FourBallMode, string> = {
  kbf: 'KBF',
  amateur: '동네',
};

/**
 * Chip 컴포넌트의 카테고리 톤.
 *   tier1 (★★★★★): 빨강·오렌지 — F&H, Plus, Half (입문 핵심)
 *   tier2 (★★★★):  황금·노랑 — Mirror, Ball, 17/25, 일출일몰
 *   tier3 (★★★):    녹색      — -15, -20, +15
 *   tier4 (★★):     청록·파랑 — Reverse, 32
 *   layer-* :       분석 레이어별 의미 색
 *   game-3c·game-4b: 게임 토글
 *   neutral:        기본 (회전·자동/수동)
 */
type ChipTone =
  | 'tier1'
  | 'tier2'
  | 'tier3'
  | 'tier4'
  | 'layer-impact'
  | 'layer-kiss'
  | 'layer-separation'
  | 'layer-distance'
  | 'layer-angle30'
  | 'layer-noenglish'
  | 'layer-multipath'
  | 'game-3c'
  | 'game-4b'
  | 'neutral';

/** 시스템 가이드 13개 → ★ 등급별 톤 (research.md 4.14 우선순위). */
const SYSTEM_TONE: Record<SystemGuide, ChipTone> = {
  none: 'neutral',
  fh: 'tier1',
  plus: 'tier1',
  half: 'tier1',
  mirror: 'tier2',
  ball: 'tier2',
  noenglish: 'tier2',
  sunrise: 'tier2',
  minus15: 'tier3',
  minus20: 'tier3',
  plus15: 'tier3',
  reverse: 'tier4',
  thirtytwo: 'tier4',
};

/** 분석 레이어 7종 → 의미 색 매칭 (실제 SVG 렌더 색과 동기). */
const LAYER_TONE: Record<AnalysisLayer, ChipTone> = {
  impact: 'layer-impact',
  kiss: 'layer-kiss',
  separation: 'layer-separation',
  distance: 'layer-distance',
  angle30: 'layer-angle30',
  noenglish: 'layer-noenglish',
  multipath: 'layer-multipath',
};

/**
 * Menu — 햄버거 버튼 + 사이드 패널.
 *
 * HTML 오버레이 (SVG 밖). orientation 회전과 무관하게 화면 좌상단 고정.
 *
 * 항목:
 *   - 게임: 3쿠션 / 4구
 *   - 4구 룰 (4구 게임일 때): KBF / 동네
 *   - 드릴: 게임별 27개 (카테고리·기술별 OptGroup) + 난이도·표준값
 *   - 시스템 가이드: 없음 / F&H / Plus / Half / Mirror
 *   - 분석 레이어: 충돌점 · 키스 · 분리각 · 거리 · 30°/90° · 무회전
 *   - 결과: 자동 점수 판정 (3쿠션 UMB · 4구 KBF/동네)
 *   - 통계: 성공/시도/율 + 성공·실패·리셋 버튼
 *   - 설정: 자동 활성, 비활성 투명도, 공 위치 초기화, 진로 지우기
 */
export default function Menu() {
  // selectors
  const game = useAppStore((s) => s.game);
  const setGame = useAppStore((s) => s.setGame);
  const fourBallMode = useAppStore((s) => s.fourBallMode);
  const setFourBallMode = useAppStore((s) => s.setFourBallMode);
  const menu = useAppStore((s) => s.menu);
  const setSystem = useAppStore((s) => s.setSystem);
  const setTechnique = useAppStore((s) => s.setTechnique);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const setRotation = useAppStore((s) => s.setRotation);
  const loadDrill = useAppStore((s) => s.loadDrill);
  const setDrill = useAppStore((s) => s.setDrill);
  const setMenuOpen = useAppStore((s) => s.setMenuOpen);
  const toggleMenu = useAppStore((s) => s.toggleMenu);
  const stats = useAppStore((s) => s.stats);
  const successRate = useSuccessRate();
  const suggestedHandicap = useSuggestedHandicap();
  const result = useAppStore((s) => s.result);
  const phiAuto = useAppStore((s) => s.cue.phiAuto);
  const setCue = useAppStore((s) => s.setCue);
  const infobox = useAppStore((s) => s.infobox);
  const setInfoBoxOpacity = useAppStore((s) => s.setInfoBoxOpacity);
  const setAutoActive = useAppStore((s) => s.setAutoActive);
  const recordAttempt = useAppStore((s) => s.recordAttempt);
  const resetStats = useAppStore((s) => s.resetStats);
  const setAutoRecord = useAppStore((s) => s.setAutoRecord);
  const setHandicap = useAppStore((s) => s.setHandicap);
  const resetSystem = useAppStore((s) => s.resetSystem);
  const clearResult = useAppStore((s) => s.clearResult);

  // derived
  const drillsGrouped = useMemo(() => getDrillsGrouped(game), [game]);
  const currentDrill = useMemo(
    () => (menu.drillId ? getDrillById(menu.drillId) : undefined),
    [menu.drillId]
  );
  const activeLayers = useMemo(() => new Set(menu.layers), [menu.layers]);

  return (
    <>
      {/* 햄버거 버튼 (좌상단) */}
      <button
        type="button"
        onClick={toggleMenu}
        aria-label="메뉴"
        className="absolute top-2 left-2 z-30 w-10 h-10 rounded-lg bg-[#0066ca]/80 text-white flex items-center justify-center text-lg shadow-md active:bg-[#0066ca] focus:outline-none"
        style={{ touchAction: 'manipulation' }}
      >
        {menu.open ? '✕' : '☰'}
      </button>

      {/* 오버레이 (패널 닫기용) */}
      {menu.open && (
        <div
          className="absolute inset-0 z-20 bg-black/50"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* 사이드 패널 */}
      {menu.open && (
        <div
          className="absolute top-0 left-0 bottom-0 z-20 w-72 max-w-[80vw] bg-[#11173a] text-[#FAFAFA] shadow-2xl overflow-y-auto"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pb-4 space-y-5 text-[13px]">
            {/* 게임 */}
            <Section title="게임">
              <ChipRow>
                <Chip
                  active={game === 'three_cushion'}
                  onClick={() => setGame('three_cushion')}
                  tone="game-3c"
                >
                  3쿠션
                </Chip>
                <Chip
                  active={game === 'four_ball'}
                  onClick={() => setGame('four_ball')}
                  tone="game-4b"
                >
                  4구
                </Chip>
              </ChipRow>
            </Section>

            {/* 4구 룰 (4구 게임일 때만) */}
            {game === 'four_ball' && (
              <Section title="4구 룰">
                <ChipRow>
                  {(['kbf', 'amateur'] as FourBallMode[]).map((m) => (
                    <Chip
                      key={m}
                      active={fourBallMode === m}
                      onClick={() => setFourBallMode(m)}
                      tone="game-4b"
                    >
                      {FOUR_BALL_MODE_LABEL[m]}
                    </Chip>
                  ))}
                </ChipRow>
                <p className="mt-1.5 text-[10px] text-[#9FBEDF] leading-snug">
                  KBF: 빨강 둘 +1. 동네: 흰공 −1, 빈쿠션 +2 추가.
                </p>
              </Section>
            )}

            {/* 드릴 (카테고리·기술별 그룹) */}
            <Section title="드릴">
              <select
                value={menu.drillId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) loadDrill(v);
                  else setDrill(null);
                }}
                className="w-full bg-[#1f2752] text-[#FAFAFA] border border-[#3d4980] rounded px-2 py-2 text-[13px]"
              >
                <option value="">— 드릴 선택 —</option>
                {Array.from(drillsGrouped.entries()).map(([technique, list]) => (
                  <optgroup
                    key={technique}
                    label={`${CATEGORY_LABEL[list[0].category]} — ${TECHNIQUE_LABEL[technique]}`}
                  >
                    {list.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.id} · {d.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {currentDrill && (
                <div className="mt-2 text-[11px] text-[#9FBEDF] leading-relaxed">
                  난이도 {'★'.repeat(currentDrill.difficulty)}
                  {currentDrill.shot && (
                    <>
                      {' · '}두께 {fullnessToFraction(currentDrill.shot.fullness)} · {currentDrill.shot.clock} · {currentDrill.shot.tips}T · {v0ToCushion(currentDrill.shot.v0)}
                    </>
                  )}
                </div>
              )}
            </Section>

            {/* 시스템 가이드 */}
            <Section title="시스템 가이드">
              <ChipRow>
                {([
                  'none',
                  'fh',
                  'plus',
                  'half',
                  'mirror',
                  'ball',
                  'noenglish',
                  'sunrise',
                  'minus15',
                  'minus20',
                  'plus15',
                  'reverse',
                  'thirtytwo',
                ] as SystemGuide[]).map((s) => (
                  <Chip
                    key={s}
                    active={menu.system === s}
                    onClick={() => setSystem(s)}
                    tone={SYSTEM_TONE[s]}
                  >
                    {SYSTEM_LABEL[s]}
                  </Chip>
                ))}
              </ChipRow>
            </Section>

            {/* 기술 학습 (샷 종류 + 스트로크) */}
            <Section title="기술 학습">
              <div className="text-[10px] text-[#9FBEDF] mb-1">샷 종류</div>
              <ChipRow>
                {getTechniquesByCategory('shot').map((id) => {
                  const t = TECHNIQUE_CONTENT[id];
                  return (
                    <Chip
                      key={id}
                      active={menu.techniqueId === id}
                      onClick={() =>
                        setTechnique(menu.techniqueId === id ? null : id)
                      }
                      tone="tier2"
                    >
                      {t.name.ko}
                    </Chip>
                  );
                })}
              </ChipRow>
              <div className="text-[10px] text-[#9FBEDF] mt-2 mb-1">스트로크</div>
              <ChipRow>
                {getTechniquesByCategory('stroke').map((id) => {
                  const t = TECHNIQUE_CONTENT[id];
                  return (
                    <Chip
                      key={id}
                      active={menu.techniqueId === id}
                      onClick={() =>
                        setTechnique(menu.techniqueId === id ? null : id)
                      }
                      tone="tier3"
                    >
                      {t.name.ko}
                    </Chip>
                  );
                })}
              </ChipRow>
            </Section>

            {/* 분석 레이어 (다중 선택) */}
            <Section title="분석 레이어">
              <ChipRow>
                {(['impact', 'kiss', 'separation', 'distance', 'angle30', 'noenglish', 'multipath'] as AnalysisLayer[]).map((l) => (
                  <Chip
                    key={l}
                    active={activeLayers.has(l)}
                    onClick={() => toggleLayer(l)}
                    tone={LAYER_TONE[l]}
                  >
                    {LAYER_LABEL[l]}
                  </Chip>
                ))}
              </ChipRow>
            </Section>

            {/* 시점 / 큐대 */}
            <Section title="시점·큐대">
              <div className="mb-2">
                <span className="text-[11px] text-[#9FBEDF] block mb-1.5">화면 회전</span>
                <ChipRow>
                  {([0, 90, 180, 270] as ScreenRotation[]).map((r) => (
                    <Chip
                      key={r}
                      active={menu.rotation === r}
                      onClick={() => setRotation(r)}
                      tone="neutral"
                    >
                      {r}°
                    </Chip>
                  ))}
                </ChipRow>
              </div>
              <div>
                <span className="text-[11px] text-[#9FBEDF] block mb-1.5">큐대 자동 정렬</span>
                <ChipRow>
                  <Chip
                    active={phiAuto}
                    onClick={() => setCue({ phiAuto: true })}
                    tone="neutral"
                  >
                    자동
                  </Chip>
                  <Chip
                    active={!phiAuto}
                    onClick={() => setCue({ phiAuto: false })}
                    tone="neutral"
                  >
                    수동
                  </Chip>
                </ChipRow>
              </div>
              <p className="mt-1.5 text-[10px] text-[#9FBEDF] leading-snug">
                큐대를 드래그하면 자동→수동으로 전환. 새 드릴/공 초기화 시 자동 복귀.
              </p>
            </Section>

            {/* 시뮬 결과 (자동 점수 판정) */}
            {result?.verdict && (
              <Section title="시뮬 결과">
                <div
                  className={
                    'rounded px-3 py-2 text-[12px] font-semibold ' +
                    (result.verdict.scored
                      ? 'bg-[#1f6f4a] text-white'
                      : result.verdict.delta < 0
                        ? 'bg-[#7a2a2a] text-white'
                        : 'bg-[#3d4980] text-[#FAFAFA]')
                  }
                >
                  {result.verdict.delta > 0 ? `+${result.verdict.delta}점` : `${result.verdict.delta}점`}
                  <span className="ml-2 font-normal opacity-90">
                    {result.verdict.reason}
                  </span>
                </div>
                {result.verdict.sequence.length > 0 && (
                  <div className="mt-1 text-[10px] text-[#9FBEDF] font-mono">
                    {result.verdict.sequence.join(' → ')}
                  </div>
                )}
              </Section>
            )}

            {/* 통계 */}
            <Section title="통계">
              <div className="flex items-baseline gap-3 text-[#9FBEDF]">
                <span className="text-[28px] font-bold text-[#FAFAFA]">{successRate}%</span>
                <span>
                  성공 <span className="text-[#FAFAFA]">{stats.success}</span> / 시도{' '}
                  <span className="text-[#FAFAFA]">{stats.attempts}</span>
                </span>
              </div>
              {/* 핸디캡 (목표 점수) */}
              <div className="flex items-center gap-2 mt-2 text-[12px]">
                <span className="text-[#9FBEDF]">핸디캡</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={stats.handicap}
                  onChange={(e) => setHandicap(parseInt(e.target.value, 10) || 30)}
                  className="w-16 bg-[#1f2752] text-[#FAFAFA] border border-[#3d4980] rounded px-2 py-1 text-[12px]"
                />
                <span className="text-[#9FBEDF]">
                  진척 {stats.success}/{stats.handicap}
                </span>
              </div>
              {/* 추천 핸디캡 (G.A 자동 산출, research.md 8.6 / 9.2.4) */}
              {suggestedHandicap && (
                <div className="mt-1.5 px-2 py-1 rounded bg-[#1f6f4a]/40 text-[10px] text-[#A8E060]">
                  G.A {suggestedHandicap.ga.toFixed(2)} → 추천 핸디캡{' '}
                  <span className="font-bold text-[#FAFAFA]">{suggestedHandicap.handicap}</span>
                  {suggestedHandicap.grade && ` (${suggestedHandicap.grade})`}{' '}
                  <button
                    type="button"
                    onClick={() => setHandicap(suggestedHandicap.handicap)}
                    className="ml-1 px-1.5 py-0.5 rounded bg-[#28895a] text-[10px] text-[#FAFAFA]"
                  >
                    적용
                  </button>
                </div>
              )}
              {/* 매치포인트 알림 (4구 AMATEUR) */}
              {game === 'four_ball' &&
                fourBallMode === 'amateur' &&
                stats.success >= stats.handicap - 1 &&
                stats.success < stats.handicap && (
                  <div className="mt-2 px-2 py-1.5 rounded bg-[#7a4a1f] text-[11px] font-semibold">
                    매치포인트 — 마무리 3쿠션 의무
                  </div>
                )}
              {/* 자동 통계 토글 */}
              <label className="flex items-center justify-between gap-2 mt-2 py-1 text-[12px]">
                <span>자동 통계 (시뮬 결과 따라)</span>
                <input
                  type="checkbox"
                  checked={stats.autoRecord}
                  onChange={(e) => setAutoRecord(e.target.checked)}
                  className="w-5 h-5"
                />
              </label>
              {!stats.autoRecord && (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => recordAttempt(true)}
                    className="flex-1 py-2 rounded bg-[#1f6f4a] hover:bg-[#28895a] active:bg-[#28895a]"
                  >
                    성공
                  </button>
                  <button
                    type="button"
                    onClick={() => recordAttempt(false)}
                    className="flex-1 py-2 rounded bg-[#7a2a2a] hover:bg-[#9a3434] active:bg-[#9a3434]"
                  >
                    실패
                  </button>
                </div>
              )}
              <div className="flex mt-2">
                <button
                  type="button"
                  onClick={resetStats}
                  className="flex-1 px-3 py-2 rounded bg-[#3d4980] hover:bg-[#4d5a99] active:bg-[#4d5a99] text-[12px]"
                >
                  통계 리셋
                </button>
              </div>
            </Section>

            {/* 설정 */}
            <Section title="설정">
              <label className="flex items-center justify-between gap-2 py-1">
                <span>InfoBox 자동 투명도</span>
                <input
                  type="checkbox"
                  checked={infobox.autoActive}
                  onChange={(e) => setAutoActive(e.target.checked)}
                  className="w-5 h-5"
                />
              </label>
              <div className="py-1">
                <div className="flex justify-between text-[#9FBEDF] mb-1">
                  <span>비활성 투명도 {!infobox.autoActive && '(계속 적용)'}</span>
                  <span className="text-[#FAFAFA]">{infobox.opacityIdle.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={infobox.opacityIdle}
                  onChange={(e) => setInfoBoxOpacity(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetSystem();
                    clearResult();
                  }}
                  className="flex-1 py-2 rounded bg-[#3d4980] hover:bg-[#4d5a99] active:bg-[#4d5a99]"
                >
                  공 위치 초기화
                </button>
                <button
                  type="button"
                  onClick={clearResult}
                  className="flex-1 py-2 rounded bg-[#3d4980] hover:bg-[#4d5a99] active:bg-[#4d5a99]"
                >
                  진로 지우기
                </button>
              </div>
            </Section>
          </div>
        </div>
      )}
    </>
  );
}

// ── 보조 컴포넌트 ──────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[#9FBEDF] text-[11px] font-semibold uppercase tracking-wider mb-2">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

const TONE_COLORS: Record<
  ChipTone,
  { active: string; inactiveText: string; inactiveBorder: string }
> = {
  tier1: { active: 'bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.4)]', inactiveText: 'text-[#FF8A95]', inactiveBorder: 'border-[#E63946]/40' },
  tier2: { active: 'bg-[#F4A300] text-[#1F1F2E] shadow-[0_0_8px_rgba(244,163,0,0.4)]', inactiveText: 'text-[#FACA15]', inactiveBorder: 'border-[#F4A300]/40' },
  tier3: { active: 'bg-[#06D6A0] text-[#1F1F2E] shadow-[0_0_8px_rgba(6,214,160,0.4)]', inactiveText: 'text-[#5DE8C2]', inactiveBorder: 'border-[#06D6A0]/40' },
  tier4: { active: 'bg-[#118AB2] text-white shadow-[0_0_8px_rgba(17,138,178,0.4)]', inactiveText: 'text-[#5DD0F2]', inactiveBorder: 'border-[#118AB2]/40' },
  'layer-impact': { active: 'bg-[#FAFAFA] text-[#1F1F2E]', inactiveText: 'text-[#FAFAFA]', inactiveBorder: 'border-[#FAFAFA]/40' },
  'layer-kiss': { active: 'bg-[#E63946] text-white', inactiveText: 'text-[#FF8A95]', inactiveBorder: 'border-[#E63946]/40' },
  'layer-separation': { active: 'bg-[#FACA15] text-[#1F1F2E]', inactiveText: 'text-[#FACA15]', inactiveBorder: 'border-[#FACA15]/40' },
  'layer-distance': { active: 'bg-[#5DD0F2] text-[#1F1F2E]', inactiveText: 'text-[#5DD0F2]', inactiveBorder: 'border-[#5DD0F2]/40' },
  'layer-angle30': { active: 'bg-[#1B998B] text-white', inactiveText: 'text-[#5DE8C2]', inactiveBorder: 'border-[#1B998B]/40' },
  'layer-noenglish': { active: 'bg-[#9FBEDF] text-[#1F1F2E]', inactiveText: 'text-[#9FBEDF]', inactiveBorder: 'border-[#9FBEDF]/40' },
  'layer-multipath': { active: 'bg-[#9D4EDD] text-white shadow-[0_0_8px_rgba(157,78,221,0.4)]', inactiveText: 'text-[#C77DFF]', inactiveBorder: 'border-[#9D4EDD]/40' },
  'game-3c': { active: 'bg-[#118AB2] text-white shadow-[0_0_10px_rgba(17,138,178,0.5)]', inactiveText: 'text-[#5DD0F2]', inactiveBorder: 'border-[#118AB2]/40' },
  'game-4b': { active: 'bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.5)]', inactiveText: 'text-[#FF8A95]', inactiveBorder: 'border-[#E63946]/40' },
  neutral: { active: 'bg-[#0066ca] text-white', inactiveText: 'text-[#9FBEDF]', inactiveBorder: 'border-[#3D4980]' },
};

function Chip({
  active,
  onClick,
  tone = 'neutral',
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: ChipTone;
  children: React.ReactNode;
}) {
  const t = TONE_COLORS[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border ' +
        (active
          ? `${t.active} border-transparent`
          : `bg-transparent ${t.inactiveText} ${t.inactiveBorder} hover:bg-white/5 active:bg-white/10`)
      }
    >
      {children}
    </button>
  );
}
