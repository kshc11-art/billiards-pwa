import { useAppStore } from './store.ts';
import { TECHNIQUE_CONTENT, type TechniqueId } from './techniqueContent.ts';
import { getSystemContentByGuide, getSystemApplications, type SystemApplicationExample } from './systemContent.ts';

/**
 * LearningPanel (v0.7.5) — 학습 자료 별도 패널.
 *
 * InfoBox는 조작 위주 (게이지·STRIKE·예제 ▶ 적용).
 * 학습 텍스트(정의·detail·핵심포인트·흔한실수·sources 등)는 이 패널에서 표시.
 *
 * 위치: 우측 슬라이드 (햄버거 메뉴는 좌측).
 * 토글: App.tsx의 📖 책 아이콘.
 */
export default function LearningPanel() {
  const learnOpen = useAppStore((s) => s.menu.learnOpen);
  const setLearnOpen = useAppStore((s) => s.setLearnOpen);
  const system = useAppStore((s) => s.menu.system);
  const techniqueId = useAppStore((s) => s.menu.techniqueId);
  const exampleMirrorH = useAppStore((s) => s.infobox.exampleMirrorH);
  const exampleMirrorV = useAppStore((s) => s.infobox.exampleMirrorV);
  const toggleExampleMirrorH = useAppStore((s) => s.toggleExampleMirrorH);
  const toggleExampleMirrorV = useAppStore((s) => s.toggleExampleMirrorV);
  const rotation = useAppStore((s) => s.menu.rotation);
  const applySystemExample = useAppStore((s) => s.applySystemExample);
  const applyExample = useAppStore((s) => s.applyExample);
  const activeApplicationExampleId = useAppStore((s) => s.activeApplicationExampleId);

  const sysContent = getSystemContentByGuide(system);
  const techContent =
    techniqueId && techniqueId in TECHNIQUE_CONTENT
      ? TECHNIQUE_CONTENT[techniqueId as TechniqueId]
      : null;

  // 시스템 응용 예시 (공 위치 + 권장 당점 적용 — InfoBox에서 옮겨옴)
  const applications: SystemApplicationExample[] = sysContent
    ? getSystemApplications(sysContent.id)
    : [];

  if (!learnOpen) return null;

  const hasContent = sysContent !== null || techContent !== null;

  // 활성 예제 출처/특징/수치/당점/두께/스트로크/메모 — 영상별 구체 정보
  const sysExamples = sysContent?.examples ?? [];
  const techExamples = techContent?.examples ?? [];

  return (
    <>
      {/* 백드롭 */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={() => setLearnOpen(false)}
      />

      {/* 우측 패널 */}
      <aside
        className="fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-white shadow-2xl z-50 overflow-y-auto"
        role="dialog"
        aria-label="학습 자료"
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow z-10">
          <h2 className="text-base font-bold">📖 학습 자료</h2>
          <button
            onClick={() => setLearnOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-xl"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 예제 변형 컨트롤 — 미러·회전 (컨트롤 위주, 항상 표시) */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 sticky top-12 z-10">
          <p className="text-xs font-bold text-gray-700 mb-2">🔄 예제 변형 (▶ 클릭 적용 시 반영)</p>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={toggleExampleMirrorH}
              className={`px-3 py-1.5 rounded font-bold border transition ${
                exampleMirrorH
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
              title="좌우 미러 — 수구가 반대편 단축에서 출발"
            >
              ↔ 좌우
            </button>
            <button
              onClick={toggleExampleMirrorV}
              className={`px-3 py-1.5 rounded font-bold border transition ${
                exampleMirrorV
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
              title="상하 미러 — 수구가 반대편 장축에서 출발"
            >
              ↕ 상하
            </button>
            <span className="text-gray-500 ml-2">
              회전: <strong>{rotation}°</strong>
              {rotation === 180 && ' (점대칭)'}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4 text-sm text-gray-800">
          {!hasContent && (
            <p className="text-gray-500 text-center py-12">
              메뉴에서 시스템 또는 기술을 선택하면<br />
              학습 자료가 표시됩니다.
            </p>
          )}

          {/* ───────── 시스템 학습 ───────── */}
          {sysContent && (
            <section>
              <h3 className="text-base font-bold text-blue-800 border-b-2 border-blue-200 pb-1 mb-2">
                {sysContent.name.ko}
                {' '}
                <span className="text-yellow-500">{'★'.repeat(sysContent.difficulty)}</span>
                <span className="text-xs text-gray-500 ml-1">({sysContent.name.en})</span>
              </h3>
              {sysContent.alternateNames && sysContent.alternateNames.length > 0 && (
                <p className="text-xs text-gray-500 italic mb-1">
                  별명: {sysContent.alternateNames.join(' · ')}
                </p>
              )}
              <p className="text-xs text-gray-600 mb-2">
                <strong>분류</strong>: {sysContent.category} ·{' '}
                <strong>응용</strong>: {sysContent.applicableShots.join(', ')}
              </p>

              {/* 공식 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                <p className="font-bold text-yellow-900 mb-1 text-sm">📐 공식</p>
                <p className="font-mono text-sm">{sysContent.formula}</p>
                {sysContent.formulaDetail && (
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{sysContent.formulaDetail}</p>
                )}
              </div>

              {/* 표준값 */}
              <div className="bg-gray-50 rounded p-2 mb-2 text-xs">
                <p className="font-bold mb-1">⚙ 표준값</p>
                <p>● 당점: {sysContent.standard.impact}</p>
                <p>⊙ 두께: {sysContent.standard.thickness}</p>
                <p>↦ 속도: {sysContent.standard.speed}</p>
                <p>↳ 스트로크: {sysContent.standard.stroke}</p>
              </div>

              {/* 좌표 */}
              <details className="text-xs mb-2">
                <summary className="font-bold cursor-pointer">📍 좌표 체계</summary>
                <div className="bg-gray-50 rounded p-2 mt-1 space-y-1">
                  <p>출발: {sysContent.coordinates.source}</p>
                  <p>1쿠션: {sysContent.coordinates.cushion}</p>
                  <p>도착: {sysContent.coordinates.target}</p>
                  {sysContent.coordinates.rotation && (
                    <p>회전: {sysContent.coordinates.rotation}</p>
                  )}
                </div>
              </details>

              {/* 핵심 포인트 */}
              <div className="mb-2">
                <p className="font-bold text-sm mb-1">✓ 핵심 포인트</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  {sysContent.keyPoints.map((kp, i) => (
                    <li key={i}>{kp}</li>
                  ))}
                </ul>
              </div>

              {/* 흔한 실수 */}
              <div className="mb-2">
                <p className="font-bold text-sm mb-1 text-red-700">⚠ 흔한 실수</p>
                <ul className="text-xs space-y-1 list-disc list-inside text-red-700">
                  {sysContent.commonMistakes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>

              {/* 보정 룰 */}
              {sysContent.corrections.length > 0 && (
                <div className="mb-2">
                  <p className="font-bold text-sm mb-1">🔧 보정 룰</p>
                  <ul className="text-xs space-y-1">
                    {sysContent.corrections.map((c, i) => (
                      <li key={i}>
                        <strong>{c.condition}</strong> → {c.adjustment}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 응용 */}
              <div className="mb-2">
                <p className="font-bold text-sm mb-1">🎯 응용 가능 샷</p>
                <ul className="text-xs space-y-1">
                  {sysContent.applications.map((a, i) => (
                    <li key={i}>
                      <strong>{a.shotType}</strong>: {a.description}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 응용 예시 (공 자동 배치 + 권장 당점 적용) — InfoBox에서 옮겨옴 */}
              {applications.length > 0 && (
                <div className="mb-2">
                  <p className="font-bold text-sm mb-1">🎯 응용 예시 ({applications.length})</p>
                  <p className="text-xs text-gray-500 mb-1">클릭 시 공 자동 배치 + 권장 당점·두께·V0 적용</p>
                  <div className="flex flex-wrap gap-1">
                    {applications.map((ex) => {
                      const isActive = activeApplicationExampleId === ex.id;
                      return (
                        <button
                          key={ex.id}
                          onClick={() => applySystemExample(ex)}
                          className={`text-xs px-2 py-1 rounded font-bold ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                          }`}
                        >
                          ▶ {ex.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 영상 강좌 예제 (구체 수치·당점·두께·스트로크 + ▶ 적용) */}
              {sysExamples.length > 0 && (
                <div className="mb-2">
                  <p className="font-bold text-sm mb-1">🎬 영상 강좌 예제 ({sysExamples.length})</p>
                  <p className="text-xs text-gray-500 mb-1">▶ 클릭 시 권장 당점·두께·V0 적용</p>
                  <ul className="space-y-2 text-xs">
                    {sysExamples.map((ex, i) => (
                      <li key={i} className="border border-blue-200 bg-blue-50 rounded p-2">
                        <button
                          onClick={() =>
                            applyExample({
                              layout: ex.layout,
                              impact: ex.impact,
                              thickness: ex.thickness,
                              stroke: ex.stroke,
                            })
                          }
                          className="font-bold text-blue-900 mb-1 underline cursor-pointer hover:text-blue-700"
                        >
                          ▶ {ex.source}
                        </button>
                        {ex.feature && <span className="text-gray-600 font-normal"> · {ex.feature}</span>}
                        {ex.layout && (
                          <p className="font-mono text-xs text-gray-500 mb-1">[{ex.layout}]</p>
                        )}
                        {ex.numbers && (
                          <p className="font-mono text-xs text-gray-700 mb-1"># {ex.numbers}</p>
                        )}
                        <p>● 당점: <strong>{ex.impact}</strong></p>
                        <p>⊙ 두께: <strong>{ex.thickness}</strong></p>
                        <p>↦ 스트로크: <strong>{ex.stroke}</strong></p>
                        {ex.note && <p className="italic text-gray-600 mt-1">{ex.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 출처 */}
              <details className="text-xs">
                <summary className="font-bold cursor-pointer">📚 출처</summary>
                <ul className="mt-1 space-y-0.5 text-gray-600">
                  {sysContent.sources.map((s, i) => (
                    <li key={i}>· {s}</li>
                  ))}
                </ul>
              </details>
            </section>
          )}

          {/* ───────── 기술 학습 ───────── */}
          {techContent && (
            <section>
              <h3 className="text-base font-bold text-green-800 border-b-2 border-green-200 pb-1 mb-2">
                {techContent.category === 'shot' ? '샷' : '스트로크'} · {techContent.name.ko}
                {' '}
                <span className="text-yellow-500">{'★'.repeat(techContent.difficulty)}</span>
                <span className="text-xs text-gray-500 ml-1">({techContent.name.en})</span>
              </h3>
              {techContent.alternateNames && techContent.alternateNames.length > 0 && (
                <p className="text-xs text-gray-500 italic mb-1">
                  별명: {techContent.alternateNames.join(' · ')}
                </p>
              )}

              {/* 정의 */}
              <p className="text-sm font-medium text-gray-700 mb-2">{techContent.definition}</p>

              {/* 부연 설명 */}
              {techContent.detail && (
                <p className="text-xs text-gray-600 leading-relaxed mb-2 bg-gray-50 p-2 rounded">
                  {techContent.detail}
                </p>
              )}

              {/* 자세 */}
              {techContent.posture && (
                <p className="text-xs text-gray-700 mb-2">
                  <strong>🤸 자세</strong>: {techContent.posture}
                </p>
              )}

              {/* 표준값 */}
              <div className="bg-gray-50 rounded p-2 mb-2 text-xs">
                <p className="font-bold mb-1">⚙ 표준값</p>
                <p>● 당점: {techContent.standard.impact}</p>
                <p>⊙ 두께: {techContent.standard.thickness}</p>
                <p>↦ 속도: {techContent.standard.speed}</p>
                <p>↳ 스트로크: {techContent.standard.stroke}</p>
              </div>

              {/* 핵심 포인트 */}
              <div className="mb-2">
                <p className="font-bold text-sm mb-1">✓ 핵심 포인트</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  {techContent.keyPoints.map((kp, i) => (
                    <li key={i}>{kp}</li>
                  ))}
                </ul>
              </div>

              {/* 흔한 실수 */}
              <div className="mb-2">
                <p className="font-bold text-sm mb-1 text-red-700">⚠ 흔한 실수</p>
                <ul className="text-xs space-y-1 list-disc list-inside text-red-700">
                  {techContent.commonMistakes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>

              {/* 응용 */}
              {techContent.applications && techContent.applications.length > 0 && (
                <div className="mb-2">
                  <p className="font-bold text-sm mb-1">🎯 응용 케이스</p>
                  <ul className="text-xs space-y-1">
                    {techContent.applications.map((a, i) => (
                      <li key={i}>
                        <strong>{a.situation}</strong>: {a.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 영상 강좌 예제 — ▶ 클릭 시 권장 당점·두께·V0 적용 */}
              {techExamples.length > 0 && (
                <div className="mb-2">
                  <p className="font-bold text-sm mb-1">🎬 영상 강좌 예제 ({techExamples.length})</p>
                  <p className="text-xs text-gray-500 mb-1">▶ 클릭 시 권장 당점·두께·V0 적용</p>
                  <ul className="space-y-2 text-xs">
                    {techExamples.map((ex, i) => (
                      <li key={i} className="border border-green-200 bg-green-50 rounded p-2">
                        <button
                          onClick={() =>
                            applyExample({
                              layout: ex.layout,
                              impact: ex.impact,
                              thickness: ex.thickness,
                              stroke: ex.stroke,
                            })
                          }
                          className="font-bold text-green-900 mb-1 underline cursor-pointer hover:text-green-700"
                        >
                          ▶ {ex.source}
                        </button>
                        {ex.feature && <span className="text-gray-600 font-normal"> · {ex.feature}</span>}
                        {ex.layout && (
                          <p className="font-mono text-xs text-gray-500 mb-1">[{ex.layout}]</p>
                        )}
                        <p>● 당점: <strong>{ex.impact}</strong></p>
                        <p>⊙ 두께: <strong>{ex.thickness}</strong></p>
                        <p>↦ 스트로크: <strong>{ex.stroke}</strong></p>
                        {ex.note && <p className="italic text-gray-600 mt-1">{ex.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 출처 */}
              <details className="text-xs">
                <summary className="font-bold cursor-pointer">📚 출처</summary>
                <ul className="mt-1 space-y-0.5 text-gray-600">
                  {techContent.sources.map((s, i) => (
                    <li key={i}>· {s}</li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
