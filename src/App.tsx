import { useEffect } from 'react';
import { useOrientation } from './utils.ts';
import { useAppStore } from './store.ts';
import Table from './Table.tsx';
import InfoBox from './InfoBox.tsx';
import CueStick from './CueStick.tsx';
import Menu from './Menu.tsx';
import LearningPanel from './LearningPanel.tsx';

/**
 * App 루트.
 *
 * SVG 렌더 순서 (z-order):
 *   1. Table (펠트·다이아·시스템가이드·진로·분석레이어·공) — 회전 그룹 안
 *   2. InfoBox (다이얼·게이지·라벨) — 회전 외부, 화면 고정
 *   3. CueStick (큐대) — 회전 그룹 안. InfoBox 위에 표시되어 가려지지 않음.
 *
 * orientation 처리:
 *   - phone 가로:  SVG viewBox 0 0 812 375 + 사용자 회전 (0/90/180/270)
 *   - phone 세로:  SVG viewBox 0 0 375 812 + translate(0,812) rotate(-90)
 *
 * Menu (좌측 햄버거)와 LearningPanel (우측 📖 책) HTML 오버레이.
 */
export default function App() {
  const orientation = useOrientation();
  const isPortrait = orientation === 'portrait';
  const rotation = useAppStore((s) => s.menu.rotation);
  const runSimulation = useAppStore((s) => s.runSimulation);
  const result = useAppStore((s) => s.result);
  const toggleLearn = useAppStore((s) => s.toggleLearn);
  const system = useAppStore((s) => s.menu.system);
  const techniqueId = useAppStore((s) => s.menu.techniqueId);
  const hasLearningContent = system !== 'none' || techniqueId !== null;

  // 첫 마운트 시 자동 미리보기 시뮬 (분석 레이어 첫 화면부터 표시).
  useEffect(() => {
    if (!result) {
      try {
        runSimulation({ preview: true });
      } catch {
        /* 시뮬 실패 시 무시 */
      }
    }
    // 의도적으로 마운트 1회만 실행 — 이후 자동 시뮬은 store의 scheduleAutoSim이 담당
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 가로 모드: 0/180은 단순 회전, 90/270은 scale로 viewport에 맞춤
  const cx = 406;
  const cy = 187.5;
  let gameTransform: string | undefined;
  if (isPortrait) {
    gameTransform = 'translate(0, 812) rotate(-90)';
  } else if (rotation === 180) {
    gameTransform = `rotate(180, ${cx}, ${cy})`;
  } else if (rotation === 90 || rotation === 270) {
    const sf = 375 / 812;
    gameTransform = `translate(${cx}, ${cy}) rotate(${rotation}) scale(${sf}) translate(${-cx}, ${-cy})`;
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <svg
        viewBox={isPortrait ? '0 0 375 812' : '0 0 812 375'}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full block"
        xmlns="http://www.w3.org/2000/svg"
        role="application"
        aria-label="당구 트레이너"
      >
        {/* 1. 가로 콘텐츠 (Table) — 회전 그룹 */}
        <g transform={gameTransform} data-layer="game">
          <Table />
        </g>

        {/* 2. InfoBox — 회전 외부 */}
        <InfoBox isPortrait={isPortrait} />

        {/* 3. 큐대 — 회전 그룹, InfoBox 위에 보이도록 마지막 렌더 */}
        <g transform={gameTransform} data-layer="cue-overlay">
          <CueStick />
        </g>
      </svg>

      <Menu />

      {/* 학습 패널 토글 버튼 — 우측 상단 (햄버거 좌측과 짝) */}
      {hasLearningContent && (
        <button
          onClick={toggleLearn}
          className="fixed top-2 right-2 z-30 w-12 h-12 rounded-full bg-blue-600 text-white text-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition flex items-center justify-center"
          aria-label="학습 자료 열기"
          title="학습 자료"
        >
          📖
        </button>
      )}

      <LearningPanel />
    </div>
  );
}
