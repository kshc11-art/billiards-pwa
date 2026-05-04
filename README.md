# 당구 트레이너 PWA (v0.7.10)

한국식 4구·3쿠션 학습 도구. 모바일(iPhone 13 mini 기준) PWA. 시스템 가이드·기술 학습·드릴·통계·핸디캡 + 물리 엔진 시뮬레이션. 한국 중대(1.27×2.54m) 기준.

## 목표

영상 강좌·교본의 권장값(공 위치·당점·두께·V0)을 적용한 후 사용자가 STRIKE를 눌러 진로를 직접 검증하는 학습 도구.

## 기술 스택

- **Vite 6** + **React 19** + **TypeScript strict**
- **Tailwind v4** (CSS 토큰)
- **Zustand 5** (상태 관리, persist)
- **vite-plugin-pwa** (Service Worker + manifest)
- **engine.js v1.4** (Pooltool 0.6.0 JS 포팅, 한국 보정, 70/70 검증, **수정 금지**)
- **Pretendard Variable**

## 시작

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
npm run preview      # 빌드 결과 미리보기
```

## 프로젝트 구조

```
billiards-pwa/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ public/
│  └─ icons/                   # PWA 아이콘
└─ src/
   ├─ main.tsx                 # 진입점
   ├─ styles.css               # Tailwind v4 + 토큰
   ├─ engine.js                # 물리 엔진 (수정 금지, 2208줄)
   ├─ App.tsx                  # 루트 (Table + InfoBox + Menu + LearningPanel)
   ├─ Table.tsx                # 펠트·쿠션·다이아·공·큐대·진로
   ├─ CueStick.tsx             # 큐대 컴포넌트
   ├─ DiamondLabels.tsx        # 다이아 라벨
   ├─ AnalysisLayers.tsx       # 분석 레이어
   ├─ SystemGuideLines.tsx     # 시스템 가이드 라인 (응용 적용 시)
   ├─ InfoBox.tsx              # 다이얼·STROKE/STRIKE·chip (943줄)
   ├─ Menu.tsx                 # 햄버거 메뉴
   ├─ LearningPanel.tsx        # 📖 학습 패널 (응용 예시·영상 강좌 ▶ 적용)
   ├─ utils.ts                 # 좌표 변환·orientation·엔진 wrapper
   ├─ store.ts                 # Zustand store + persist (1041줄)
   ├─ analysis.ts              # 분석 레이어 계산
   ├─ scoring.ts               # 자동 점수 판정
   ├─ drills.ts                # 드릴 데이터 (27종)
   ├─ examples.ts              # 영상 강좌 예제 적용
   ├─ systems.ts               # 시스템 가이드 라인
   ├─ systemContent.ts         # 시스템 학습 콘텐츠 (2218줄)
   └─ techniqueContent.ts      # 기술 학습 콘텐츠 (1799줄)
```

## 핵심 기능

### 1. **InfoBox** (BOX_W=215, 조작 위주)
- **다이얼**: 큐볼·적구 r=32 동일 크기, mirror 모델 (좌우 평행이동)
  - 두께 1/8(스침) ~ 8/8(정타)
  - 당점 빨간 점 (1팁=R/3, 2팁=2R/3, 3팁=R×0.85 안전 영역)
  - 시계 라벨 12·3·6·9 큐볼 안쪽
  - 1.5팁 점선 가이드 원
- **chip 행**: 두께·당점·회전 (chip 가운데 = 두 공 가운데, 절대 cx=92)
- **STROKE 게이지** + **STRIKE 박스** (우측 정렬, 가운데 cx=185)
- **시스템·기술 정보 1줄**

### 2. **LearningPanel(📖)** (학습 자료 + 권장값 적용)
- 시스템·기술별 정의·detail·핵심포인트·흔한실수·보정룰·응용가능샷
- **🎯 응용 예시**: ▶ 클릭 시 공 자동 배치 + 권장값 적용
- **🎬 영상 강좌 예제**: 출처별 ▶ 클릭 적용
- 예제 변형: ↔ 좌우 미러 / ↕ 상하 미러 / 회전 0°/90°/180°/270°

### 3. **Table** (메인 SVG)
- 진로 polyline (큐볼 흰 굵은 실선·적구 색별 점선)
  - **STRIKE 누르기 전 자동 표시** (학습용 preview 시뮬)
- 분석 레이어 6종 + 시스템 가이드 라인

### 4. **시뮬 흐름**
1. Menu → 시스템 또는 기술 선택
2. 📖 LearningPanel → 응용 예시 / 영상 강좌 ▶ 클릭
3. **preview 자동 시뮬** → 진로 표시 (공은 안 움직임)
4. 사용자 당점/큐대 조정 (preview 실시간 갱신)
5. **STRIKE 클릭** → 실제 시뮬 + 애니메이션
6. 큐볼 정지 + 6초 cap → 큐대 복귀

## 시스템 (10종)

| 시스템 | 공식 |
|---|---|
| 파이브앤하프 (F&H) | 1쿠션수 = 수구수 - 도착수 |
| 플러스 | 3쿠션수 = 수구수 + 1쿠션수 |
| 하프 | 1쿠션수 = 수구수/2 |
| 볼 | 두께+팁 = B2+B3+기울기 |
| 무회전 (No English 17) | 17→0→17 회귀 |
| 일출일몰 | 팁수 = 수구+1쿠션+3쿠션 포인트 |
| -15 | 1쿠션수 = 수구수 - 1적구수 - 15 |
| -20 | 동일 패턴, 더 강한 보정 |
| 리버스 | 1쿠션수 = 18 - (수구수 + 목적구수) |
| 32 | 정면+max스핀+V₀ 4.0~4.5 |

## 기술 (17종)

**샷**: 뒤돌리기·옆돌리기·앞돌리기·비껴치기·세워치기·빈쿠션·더블레일·더블쿠션·횡단샷·대회전·고바야시 더블

**스트로크**: 밀어치기·끌어치기·끊어치기·잡아치기·곡구·마세

## InfoBox 핵심 매개변수

| 항목 | 값 |
|---|---|
| BOX_W | 215 |
| BOX_H | 135 |
| DIAL_X | 72 |
| CUE_BALL_DIAL_R | 32 |
| CUE_DOT_RANGE | R × 0.85 |
| TARGET_CX_DIFF_MAX | 2R = 64 |
| STRIKE 박스 | x=151, width=52, 가운데 cx=185 |
| STROKE 게이지 | translate(175, 18), 가운데 cx=185 |

## 좌표계 매핑

```
엔진 좌표 (m)              SVG 좌표 (px, viewBox 0 0 812 375)
x: 0 ~ W (폭)           ↔  y: 26 ~ 349
y: 0 ~ L (길이)         ↔  x: 729 ~ 83 (역방향)

scale = 646 / L
SVG.x = 729 - engine.y × scale
SVG.y = 26  + engine.x × scale
```

3쿠션: W=1.27, L=2.54, R=0.0307 (한국 중대)

## 알려진 한계

- **응용 예시 좌표 데이터**: 영상 강좌·교본과 1:1 검증 미완
- 시뮬 진로가 영상 의도와 일치하는지 사용자 직접 확인 필요
- 당구박사 1번 앞돌리기는 텍스트 검증 일치 (무회전 12시 + 1/2 두께)

## 엔진 수정 금지

`src/engine.js`는 70/70 검증 통과. 수정 시 검증 깨짐.

## 라이선스

Pooltool (Apache-2.0) derivative work.
