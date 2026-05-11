# 무공키우기

2D 횡스크롤 도트 액션 게임 - 무공 비급을 수집하고 합성하여 강해지자!

## 게임 구조

```
┌─────────────────────────────┐
│  [상단 60%] 횡스크롤 전투     │  ← 자동/수동 전투
│  캐릭터 자동 진행 + 적 처치   │
├─────────────────────────────┤
│  [하단 40%] 무공 관리         │  ← 장착/합성/도감
│  비급 슬롯, 합성, 스탯       │
└─────────────────────────────┘
```

## 기술 스택

| 기술 | 용도 |
|---|---|
| Phaser 3 (WebGL) | 2D 게임 엔진, 60fps 렌더링 |
| TypeScript | 종단간 타입 안전성 |
| Vite | 빌드 도구 |
| Capacitor | 네이티브 Android APK 래핑 |

## 개발 환경 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 프로덕션 빌드

```bash
npm run build
```

## Android APK 빌드

```bash
npm run build
npx cap add android
npx cap sync
npx cap open android
```

Android Studio에서 빌드 → APK 생성

## 프로젝트 구조

```
src/
├── main.ts              # 엔트리 포인트 (Phaser 설정)
├── data/
│   ├── types.ts         # 타입 정의
│   ├── skills.ts        # 무공 데이터
│   └── enemies.ts       # 적 데이터
├── entities/
│   ├── Player.ts        # 플레이어 (상태머신)
│   └── Enemy.ts         # 적 (추적 AI)
├── scenes/
│   ├── BootScene.ts     # 에셋 로딩
│   ├── BattleScene.ts   # 횡스크롤 전투
│   └── UIScene.ts       # 하단 관리 UI
├── systems/
│   └── SaveSystem.ts    # localStorage 세이브/로드
└── utils/
    ├── ObjectPool.ts    # 오브젝트 풀링 (GC 방지)
    └── spriteGenerator.ts  # 플레이스홀더 스프라이트
```

## 무공 체계 (MVP)

| 등급 | 무공 | 획득 방법 |
|---|---|---|
| 하급 | 삼재검법, 육합검 | 적 드랍 |
| 중급 | 매화검법, 청풍검법 | 합성 |
| 상급 | 태극검법 | 합성 |
| 최상급 | 창궁무애검법 | 합성 |

## 라이선스

Private - All rights reserved
