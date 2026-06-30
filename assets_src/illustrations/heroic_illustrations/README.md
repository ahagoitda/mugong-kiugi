# 고화질 일러스트 (Mugong Kiugi) - 12+ Heroic 스타일

기존 픽셀 아트/고화질 히어로 포트레이트 (heroes-mockup-v2.png, bosses-mockup-v2.png, hero_*.png 등)를 참고하여 제작한 **일러스트** 컬렉션입니다.

**전체 12금 / Heroic 수준**으로 조정됨 (영웅적이고 멋진 무협 스타일, 과도한 노출 없이 정돈된 의상).

## 스타일
- 원본과 동일한 무협 판타지 디지털 페인팅 스타일 (wuxia/xianxia)
- 검은 바탕 + 드라마틱 라이팅 + 금색 자수 디테일 + 원소 오라
- 영웅적이고 멋진 무협 캐릭터 스타일 (정돈된 의상, 과도한 노출 배제)
- Blood Set 변형: 붉은 피/에너지, 전투 손상된 갑주풍 의상, 타락한 분위기 (노출은 억제)

## 포함 일러스트 (현재 18장)

### 여성 영웅 Heroic 12+ 버전 (4)
- `sword_female.jpg` - 여검객 (청운검문 스타일, 푸른 오라)
- `dao_female.jpg` - 여도객 (호풍도문, 붉은 기운)
- `fist_female.jpg` - 여권사 (비룡권문, 금빛)
- `spear_female.jpg` - 여창객 (운령창문, 녹색)

### 여성 Blood Set / 타락 12+ (6)
- `sword_female_blood.jpg`
- `dao_female_blood.jpg`
- `fist_female_blood.jpg`
- `spear_female_blood.jpg`
- `spear_female_blood_extra.jpg`
- `dao_female_blood_extra.jpg` (추가 변형)
- `fist_female_backish.jpg` (동적 각도)

### 점소이 (Jeomsoyi) NPC 12+
- `jeomsoyi.jpg` - 기본 tavern girl
- `jeomsoyi_blood.jpg` - Blood corrupted tavern girl

### 남성 영웅 버전 (12+ / Heroic 스타일)
- `sword_male.jpg` - 검객 (쿨하고 멋진 영웅 스타일, 로브 제대로 착용)
- `dao_male.jpg` - 도객
- `fist_male.jpg` - 권사
- `spear_male.jpg` - 창객
- `fist_male_bare.jpg` - 권사 상체 노출 버전 (수련 느낌, 12+ 수준)

## 무공 모션 고화질 일러스트 (motions/ 폴더)
픽셀 스프라이트가 아닌, 각 캐릭터의 무공(검법/도법/권법/창법) 모션을 고화질 일러스트로 제작.
- 스타일: 기존 heroic 12+ 캐릭터 포트레이트와 동일 (우아한 무협 스타일, 정돈된 의상, 클래스별 원소 오라)
- 목적: 스킬 카드, 도감, 이벤트 CG, 컨셉 아트 등으로 활용 가능
- 현재 포함 예시 (대표 무공):
  - sword_female_samjae.jpg (기본 검)
  - sword_female_maehwa.jpg (매화검법)
  - sword_female_changung.jpg (창궁무애검법 궁극)
  - dao_male_baldo.jpg (발도술)
  - dao_female_paewang.jpg (패왕도법)
  - fist_female_yeonhwante.jpg (연환퇴)
  - fist_male_taejo.jpg (태조장권)
  - fist_male_yeorae.jpg (여래신장 궁극)
  - spear_male_yongchang.jpg (용창구식)
  - spear_female_hoeseon.jpg (회선창)

추가 모션은 specs의 176개 무공명 (비연검, 혈란도법, 항룡십팔장, 용호창결 등) 기반으로 요청 시 더 제작 가능.

### 구조화된 12프레임 모션 시퀀스 (2026 업데이트)
**지금까지 제작된 / 앞으로 사용할 모션 프레임은 motions/<hero>_<skill>/ 하위 폴더에 정리됨.**
- 각 영웅(8명) × 각 무공별 **12프레임 시퀀스** (f00.jpg ~ f11.jpg).
- **크로마키 그린 배경 (#00FF00)**: 완전 격리된 캐릭터 (pure green screen, clean edges). 그린 키아웃으로 투명 PNG/알파 쉽게 추출 → 컴포지팅, 애니메이션 시퀀싱, 갤러리 업데이트에 최적.
- **자연스럽고 유동적인 모션**: realistic weight shift, anticipation, follow-through, hair/robo/energy physics, cinematic wuxia action (뻣뻣하지 않음).
- **무공 이름/초식 맞춤**: 
  - 삼재검법: 천·지·인 원칙 (high vertical, low sweep, balanced harmony).
  - 매화검법: 매화 흩날리듯 연속 베기 (petal scattering bursts, multi-arc flurry).
  - 창궁무애검법: 하늘을 가르는 무애의 일검 (celestial charge → one massive sky-rending cleave + rift propagation).
  - 기타 무공도 해당 초식/철학에 맞춰 제작 (예: 태극=음양 원형 조화, 발도=순간 뽑기 베기 등).
- **참고 이미지 기반 일관성**: 각 영웅의 base heroic illustration (sword_male.jpg 등)을 reference로 image_edit 사용하여 얼굴/의상/헤어/오라/스타일 100% 일치.
- **현재 상태 (sword_male 완료)**: samjae/, maehwa/, changung/ 각 12프레임 (크로마키 그린 + 자연 모션 + 초식 맞춤).
- 다른 영웅( sword_female, dao_*, fist_*, spear_* )과 추가 무공은 배치로 생성 중. 모든 폴더는 미리 준비됨.
- **사용 지침**: 이 구조화된 시퀀스들을 앞으로의 고화질 모션 필요 시 **우선 사용**하세요. Legacy singles (motions/ 루트의 *.jpg) 는 참고용으로 유지. 그린 배경 키아웃 후 투명 자산으로 활용 (갤러리, 스킬 프리뷰, 이벤트 CG 등).

## 사용 제안
- 캐릭터 선택 화면 대체 아트 또는 갤러리/도감 특수 일러스트로 사용 가능
- UI 팝업이나 이벤트 CG
- Android 앱 내 도감이나 캐릭터 아트로 사용
- **모션 시퀀스**: 애니메이션 참조, 스킬 카드 프리뷰, 컨셉 비디오 등에 12프레임 그대로 또는 키아웃 후 사용.

## 사용 제안
- 캐릭터 선택 화면 대체 아트 또는 갤러리/도감 특수 일러스트로 사용 가능
- UI 팝업이나 이벤트 CG
- Android 앱 내 도감이나 캐릭터 아트로 사용

## 제작 노트
- 원본 히어로 아트 (hero_sword_female.png 등) 및 컨셉 시트(heroes-mockup-v2.png, boss-concept-sheet.png, backgrounds-mockup-v2.png)의 얼굴/헤어/의상/포즈/오라를 최대한 일치시킴
- 전체 12금 / Heroic 스타일: 영웅적이고 멋진 무협 일러스트. 의상은 정돈되고 과도한 노출 없이 고품질 wuxia 캐릭터 아트 수준.
- 완전 frontal nudity / 성기 노출은 피함 (모더레이션 통과)
- 추가 제작 필요 시: 더 많은 변형, 보스 일러스트, 스킬 풀 일러스트, 배경 포함 합성 CG, 특정 포즈 등 요청

원본 에셋 위치:
- public/sprites/generated/heroes-mockup-v2.png
- public/sprites/generated/bosses-mockup-v2.png
- public/sprites/generated/runtime/hero_*_female.png
- public/sprites/originals/ (일부 소스)

이 일러스트들은 게임의 상업적/비상업적 자산으로 자유롭게 사용 가능 (프로젝트 라이선스 따름).

참고: 이전에 15금으로 시작했으나, 요청에 따라 전체를 12금 Heroic 스타일로 낮춰 조정했습니다.
