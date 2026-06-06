# 무공키우기 (Mugong Kiugi)

**무공키우기**는 540x960 세로형 종횡비를 지원하는 Phaser 3 + Capacitor 기반의 **무협 방치형 RPG** 게임입니다.  
이름 없는 무인이 되어 정파 사대문파의 잃어버린 비급을 습득하고, 중원을 위협하는 혈교(血敎)의 여덟 층위 보스를 토벌하는 강호 여정을 담고 있습니다.

---

## 1. 게임 구조 및 기술 스택

### 1.1 게임 인터페이스 레이아웃
```
┌─────────────────────────────┐
│  [상단 60%] 횡스크롤 전투     │  ← 3단 패럴랙스 배경 스크롤링
│  캐릭터 자동 진행 + 적 처치   │  ← 자동/수동 무공 시전 및 대시
├─────────────────────────────┤
│  [하단 40%] 관리 UI 패널      │  ← 무공 관리 (장착/합성/강화)
│  비급 슬롯, 합성, 스탯, 임무  │  ← 수련, 장비 세트 장착, 문파/도감
└─────────────────────────────┘
```

### 1.2 핵심 기술 스택
- **Game Engine**: Phaser v3.90.0 (WebGL / Canvas 2D 60fps)
- **Language**: TypeScript v6.0.3 (정적 타입 안정성)
- **Build Tool**: Vite v8.0.11
- **Wrapper**: Capacitor v8.3.3 (네이티브 Android APK 패키징 및 하드웨어 동기화)
- **Image Processor**: Sharp v0.34.5 (Chroma keying 및 포맷 변환 자동화)

---

## 2. 세계관 및 8장 스토리

### 2.1 시놉시스
> 혈교가 중원을 침략하자 정파 사대문파(청운검문, 호풍도문, 비룡권문, 운령창문)는 궤멸 직전에 이르렀습니다.  
> 강호에 홀연히 나선 이름 없는 무인은 실종된 장문인들의 비급을 이어받아 혈교의 여덟 층위 보스(대주부터 최종 무령 혈마까지)를 차례로 파해하고, 강호의 화평을 실현해 나갑니다.

### 2.2 8개 장(지역) 테마 및 스토리라인
게임은 총 8개 장으로 구성되며, 해금 웨이브에 따라 3단 패럴랙스 배경과 보스 몬스터가 교체됩니다.

| 장 | 지역 id | 지역명 | 해금 웨이브 | 주요 보스 | 보스 기술 |
|----|--------|--------|------------|-----------|-----------|
| 1장 | `forest` | 녹림 | 1 | 혈예 대주 (DAEJU) | 혈예 진각 (지면 파동) |
| 2장 | `bamboo` | 죽림 | 10 | 적월 단주 (DANJU) | 적월 혈창 (투사체 참격) |
| 3장 | `snow` | 설산 | 20 | 유영 각주 (GAKJU) | 유영환검 (다각 환영격) |
| 4장 | `desert` | 사막 | 30 | 비천 마군 (MAGUN) | 비천강림 (공중 낙하검) |
| 5장 | `volcano` | 화산 | 40 | 금강 호법 (HOBUP) | 금강지진 (연속 진각) |
| 6장 | `coast` | 해안 | 50 | 묵운 사자 (SAJA) | 묵운산탄 (암흑 탄환) |
| 7장 | `blood_valley` | 혈곡 | 60 | 혈마 부교주 (BUGYOJU) | 혈우 (광역 뇌우) |
| 8장 | `demon_palace` | 마천궁 | 70 | 무령 혈마 (HYEOLMA) | 혈마강세 (심연 대폭발) |

---

## 3. 무공 및 장비 세트 확장 사양

### 3.1 4대 정파 계열 및 보법
무공은 고무(古武)의 철학을 기반으로 4대 계열로 세분화되며, 기동을 위한 보법이 존재합니다.
- **검법 (SWORD)**: 변화(變化)의 미학. 다양한 디버프와 유려한 밸런스 전투 스타일.
- **도법 (BLADE)**: 파괴(破壞)의 물리. 묵직하고 강맹한 한 방 och 넉백/기절 중심 스타일.
- **권법 (FIST)**: 연타(連打)의 폭발. 초근접 빠른 공격 속도와 지속 출혈/둔화 스타일.
- **창법 (SPEAR)**: 제압(制壓)의 사거리. 넓은 판정의 범위 공격과 적 군중 제어 스타일.
- **보법 (MOVEMENT)**: 기동(機動)의 핵심. 무적 대시(초상비)를 통한 수동 회피 기능.

### 3.2 등급별 이름/설명 자동 매핑
무공 비급은 **LOW(하급), MID(중급), HIGH(상급), ULTIMATE(절기)** 등급을 가지며, 기획서의 Wuxia 마스터 데이터 테이블([contents_plan.md](file:///C:/Users/ahago/.gemini/antigravity/scratch/mugong-kiugi/docs/contents_plan.md))에 근거하여 인게임 자동 무공 생성기에서 한자식 한국어 무명(예: 비연검, 파천도결, 벽력장, 용호창결)과 컨셉에 어울리는 풍부한 묘사 문구로 자동 맵핑되도록 구현되어 있습니다.

### 3.3 장비 세트 8종
여덟 보스를 격파하고 획득하는 전리품 세트로, 틴팅 오라를 동반한 세트 효과(2/4/6세트 분기별 데미지 및 골드 버프 제공)가 구현되어 있습니다.
- **세트 종류**: 혈예 세트(1장), 적월 세트(2장), 유영 세트(3장), 비천 세트(4장), 금강 세트(5장), 묵운 세트(6장), 혈마 세트(7장), 무령 세트(8장)

---

## 4. 그래픽 자산 및 이미지 프로세싱 파이프라인

게임의 시각적 완성도 향상을 위해 3단 패럴랙스 배경 및 투명화 이미지 처리 스크립트가 구축되어 있습니다.

### 4.1 3단 패럴랙스 스크롤링 (Parallax Scrolling)
상단 전투 화면의 단조로움을 극복하기 위해 배경을 3단으로 쪼개어 깊이감(Depth)과 운동감을 다르게 적용했습니다.
1.  **bg (원경/하늘)**: `scrollX * 0.1` 속도 (아주 느린 흐름)
2.  **mg (중경/오브젝트)**: `scrollX * 0.45` 속도 (대나무 줄기, 사막 유적 등)
3.  **fg (근경/지면)**: `scrollX * 1.0` 속도 (캐릭터가 딛는 지면 및 풀밭, 이동 속도와 일대일 매칭)

### 4.2 크로마키(Chroma Keying) 자동 처리 파이프라인
단색 크로마키 배경(그린스크린 또는 블랙스크린)에서 생성된 그래픽 소스를 웹에 최적화된 투명 알파 PNG/WebP로 변환해 주는 이미지 자동 가공 프로세서가 내장되어 있습니다.

- **그린스크린 제거**: $G$ 채널이 $R$ 및 $B$보다 현저히 높은 픽셀 영역 검출 및 경계면 안티앨리어싱 desaturation(녹색 후광 제거).
- **블랙스크린 제거**: $\max(R,G,B)$가 문턱값보다 낮은 암흑 영역을 투명 알파 처리(주로 UI 카드 테두리에 사용).
- **포맷 최적화**: 배경 이미지 파일은 압축률이 높은 `.webp`로 변환, 캐릭터 스킨 및 UI는 투명 채널 보존을 위해 `.png`로 변환 배포.

### 4.3 AI 프롬프트 기반 영웅 스프라이트 생성 (Grok Builder)
8명의 영웅(검/도/권/창 × 남녀)의 일관된 **cell-shaded chibi** 전투 애니메이션을 대량 생산하기 위해 전용 프롬프트 시스템을 운영합니다.

- **스타일 고정**: 모든 프롬프트 앞에 동일한 `[STYLE]` 블록 주입 (chibi cell-shade, thick outline, chroma-key green `#00FF00`, left-facing side view).
- **캐릭터 정의**: 8영웅별 상세 외형(상투/쪽진머리, 로브 색상, 무기 형태 등) 엄격히 고정.
- **포즈 시스템**: Idle/Run + Standard(12프레임)/Heavy(12프레임)/Thrust(12프레임) 상세 모션 정의. 각 프레임(F0~F11)별 정확한 자세·무기 궤적·이펙트(blue crescent, golden dust, cyan shockwave) 명시.
- **생성 도구**: `python scripts/generate-hero-prompts.py` 로 정확한 프롬프트 + 추천 파일명 자동 출력.
- **워크플로**:
  1. `python scripts/generate-hero-prompts.py --hero sword_male --action standard --frame 5` 등으로 프롬프트 확보
  2. Grok (또는 호환 이미지 생성기)에서 1프레임씩 생성 → `public/sprites/originals/` 에 저장 (예: `sword_male_standard_attack_f05.png`)
  3. `node scripts/process-assets.js` (green 키잉) + 프레임 추출/리패킹 스크립트로 투명 스프라이트화
- 새로 도입된 12프레임 상세 공격 사이클은 기존 4프레임 공격보다 풍부한 히트 판정과 모션 피드백을 제공합니다. (관련 데이터: `src/data/skills.ts`, `src/entities/Player.ts`, BattleScene)

### 4.4 고화질 히어로 모션 일러스트 생성 (Heroic Illustrations)
픽셀 스프라이트와 별도로 **고화질 무협 디지털 페인팅 스타일**의 모션 프레임을 제작합니다 (갤러리, 스킬 카드, 이벤트 CG, 컨셉 아트용).
- 기존 heroic_illustrations/ base 이미지 (sword_male.jpg 등)를 reference로 일관성 유지.
- 각 영웅 × 각 무공(초식)별 **12프레임 시퀀스** (natural fluid motion with weight shift, anticipation, follow-through; skill name에 맞춘 초식: e.g. 매화=petal scattering 연속 베기, 창궁무애=하늘 가르는 일검).
- **크로마키 그린 배경 (#00FF00)**: 완전 격리된 캐릭터 (pure green screen). 키아웃으로 투명 자산 쉽게 제작 → 시퀀싱/컴포지팅 용이.
- 생성: reference-based image_edit (Grok), natural cinematic wuxia poses.
- 구조: `public/sprites/illustrations/heroic_illustrations/motions/<hero>_<skill>/f00.jpg ~ f11.jpg`
- **사용**: `docs/grok-builder-prompt-guide.md` 및 heroic_illustrations/README.md 참고. 앞으로의 고화질 모션 필요 시 이 구조화된 프레임들을 우선 사용.
- 현재: sword_male 주요 무공 (samjae, maehwa, changung) 12프레임 완료. 다른 영웅/무공 배치 생성 중 (모든 폴더 미리 준비).

자산 정리/문서 업데이트는 heroic_illustrations/README.md 와 motions/ 하위 폴더 참조.

---

## 5. 프로젝트 디렉터리 구조

```
mugong-kiugi/
├── docs/
│   ├── contents_plan.md             # 마스터 기획서 (세계관/스토리/무공명칭)
│   └── grok-builder-prompt-guide.md # Grok Builder용 영웅 스프라이트 프롬프트 가이드 (8영웅 × 12프레임 상세 애니메이션)
├── scripts/
│   ├── generate-hero-prompts.py     # Grok Builder 공식 프롬프트 생성기 (정확한 STYLE+CHARACTER+POSE 템플릿)
│   ├── process-assets.js            # Sharp 크로마키(그린/블랙) 제거 + WebP/PNG 최적화
│   ├── extract-frames.py            # 스프라이트 시트 → 개별 프레임 추출 (128x128)
│   ├── repack-sprites.py            # 프레임 재조합 및 시트 생성 헬퍼
│   └── ... (기타 asset / fallback 스크립트)
├── public/
│   └── sprites/
│       ├── originals/               # AI 생성물(크로마키 green) 또는 원본 시트 보관
│       ├── frames/                  # 추출된 개별 프레임 (sword_male_standard_attack_f05.png 등)
│       └── generated/runtime/       # 인게임 최종 투명 자산 (런타임 로드 경로)
├── src/
│   ├── main.ts               # Phaser 3 구성 및 게임 기동 엔트리
│   ├── data/
│   │   ├── assets.ts         # 인게임 자산 로딩 테이블 정의
│   │   ├── characters.ts     # 영웅 캐릭터 목록 및 배경 테마 정의
│   │   ├── enemies.ts        # 적과 8층위 보스 정보
│   │   └── skills.ts         # 무공 및 합성 레시피 데이터 ( nameKo 맵 탑재)
│   ├── scenes/
│   │   ├── BootScene.ts      # 그래픽 자산 일괄 로딩 및 무구 스킨 오버라이드
│   │   ├── BattleScene.ts    # 3단 패럴랙스 횡스크롤 전투 (자동 AI 포함)
│   │   └── UIScene.ts        # 하단 무공/수련/장비/문파/도감 탭 구성
│   └── systems/
│       └── SaveSystem.ts     # localStorage 세이브/로드 및 오프라인 보상
```

---

## 6. 개발 및 빌드 실행 가이드

### 6.1 개발 서버 구동
```bash
# 의존성 패키지 설치 (Windows 환경에서는 npm.cmd 사용 권장)
npm install

# 로컬 개발용 Vite 서버 기동 (http://localhost:3000)
npm run dev
```

### 6.2 자산 처리 (Chroma keying 가동)
실제 원본 자산 또는 Fallback 템플릿 이미지를 가공하여 런타임 디렉터리에 배포하려면 아래 순서로 스크립트를 작동하십시오.

**새 영웅 애니메이션 제작 시 (권장)**:
```bash
# 1) Grok Builder 프롬프트 생성 (정확한 12프레임 규칙 적용)
python scripts/generate-hero-prompts.py --hero all --action standard,heavy,thrust --output-dir prompts/new_heroes

# 2) 생성된 프롬프트로 AI 이미지 생성 → public/sprites/originals/ 에 저장
#    (파일명은 스크립트가 제안하는 sword_male_standard_attack_f05.png 등 사용)

# 3) 크로마키 투명화 & WebP 변환 실행
node scripts/process-assets.js

# 4) (필요 시) 개별 프레임 추출 또는 시트 리패킹
python scripts/extract-frames.py
```

**기존/일반 자산 처리**:
```bash
# 1) 원본/fallback 이미지 빌드 준비 (originals 디렉터리 자동 채우기)
node scripts/fallback-assets.js

# 2) 크로마키 투명화 & WebP 변환 실행 (generated/runtime 디렉터리 배포)
node scripts/process-assets.js
```

### 6.3 프로덕션 빌드 및 Capacitor Android 동기화
안드로이드 기기 또는 에뮬레이터에서 앱 형태로 테스트하려면, 번들된 자산을 동기화해 주어야 합니다.
```bash
# 웹 프로덕션 빌드 컴파일 및 번들링
npm run build

# 웹 빌드 결과물(dist/)을 안드로이드 네이티브 에셋 폴더로 동기화
npm run android:sync          # = npm run build && npx cap sync android

# Android Studio로 프로젝트 기동
npm run android:open          # = npx cap open android
```

안드로이드 네이티브 APK 디버그 파일 빌드 실행:
```bash
cd android
./gradlew assembleDebug       # 출력: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 7. 라이선스
Private - All rights reserved.
본 리포지토리의 코드 및 자산은 허가 없이 외부 배포 및 상업적 목적으로 활용할 수 없습니다.
