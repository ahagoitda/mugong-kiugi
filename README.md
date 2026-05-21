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

## Android APK 빌드 (Kotlin 셸 + Capacitor)

네이티브 안드로이드 프로젝트(`android/`, MainActivity는 Kotlin)는 이미 저장소에 포함돼 있습니다.
에셋은 앱에 **로컬 번들**되므로 네트워크 로딩이 없어 모바일 웹에서 발생하던 로딩 멈춤이 사라집니다.

**사전 요구**: JDK 21, Android Studio(또는 Android SDK).

```bash
# 1) 의존성 설치
npm install

# 2) 웹 빌드 + 안드로이드 동기화 (dist → android/app/src/main/assets/public)
npm run android:sync          # = npm run build && npx cap sync android

# 3) Android Studio 열기
npm run android:open          # = npx cap open android
```

Android Studio에서 기기/에뮬레이터로 Run 하거나, APK 빌드:

```bash
cd android
./gradlew assembleDebug       # 산출물: android/app/build/outputs/apk/debug/app-debug.apk
```

> 참고: `android/app/src/main/assets/public/`(번들된 웹 자산)와
> `capacitor-cordova-android-plugins/`(생성 모듈)는 `.gitignore` 대상이라,
> 클론 직후 반드시 `npm run android:sync`로 재생성해야 합니다.
> 게임 코드를 수정한 뒤에도 `npm run android:sync`로 자산을 갱신하세요.

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
