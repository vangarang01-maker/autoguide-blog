#!/usr/bin/env node
/**
 * AutoGuide (2호 블로그) 자동 글 발행 스크립트
 * 
 * 30종 이상의 자동차/모빌리티 전문 큐레이션 토픽 뱅크를 보유하며,
 * Gemini AI API를 활용하여 4,000자 이상의 고밀도 백과사전식 포스팅을 자동 생성·발행합니다.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_ROOT = join(__dirname, '..');
const CONTENT_DIR = join(BLOG_ROOT, 'src', 'content', 'blog');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
const MIN_CHARS = 2500;

/* -------------------------------------------------------------- Topic Bank (30+) */

const TOPICS = [
  {
    slug: 'gdi-engine-oil-consumption-fix',
    title: 'GDI 엔진오일 감소 원인과 피스톤 링 고착 해결 가이드',
    category: 'maintenance',
    heroEmoji: '🛢️',
    tags: ['GDI', '엔진오일', '오일감소', '피스톤링', '엔진보링'],
    description: '현대·기아 세타2 및 감마 GDI 엔진의 만성 오일 소모 원인을 분석하고, 플러싱 케미컬 시공부터 쇼트엔진 교체 보증 기준까지 정리했습니다.',
    hook: '엔진오일 교체 후 3,000km밖에 안 탔는데 게이지 F선에서 L선 밑으로 뚝 떨어졌다면 단순 누유가 아닙니다. GDI 엔진 특유의 오일 링 고착과 실린더 스크래치 메커니즘을 알아야 불필요한 보링 비용 300만 원을 아낄 수 있습니다.',
    outline: [
      'GDI 엔진에서 오일 소모가 유독 심한 3가지 이유 (직분사 고온·고압, 카본 슬러지 고착, 저마찰 오일링 설계)',
      '자가 진단법: 배기구 흰 연기(블루스모크), 오일캡 내부 슬러지, 1,000km당 감소량 실측법',
      '단계별 정비 처방: 1단계 연소실/오일라인 케미컬 클리닝, 2단계 밸브 스템씰(가이드고무) 교체, 3단계 쇼트엔진 리빌드',
      '제조사 평생 보증(세타2) 대상 판정 조건과 서비스센터 압축압력 테스트 통과 요령',
      '오일 점도 변경 팁: 0W-20에서 5W-30/5W-40 C3 규격으로 전환 시 효과와 주의점',
    ],
  },
  {
    slug: 'hybrid-battery-lifespan-replacement-cost',
    title: '하이브리드 고전압 배터리 수명과 사설 재생 배터리 교체 비용 비교',
    category: 'eco',
    heroEmoji: '🔋',
    tags: ['하이브리드', '배터리수명', '재생배터리', '교체비용', 'HEV'],
    description: '10년 20만km를 넘긴 하이브리드 차량의 고전압 배터리 열화 증상과 제조사 순정 교체 vs 사설 모듈 밸런싱 수리 비용을 비교했습니다.',
    hook: '계기판에 하이브리드 시스템 점검등(Check Hybrid System)이 점등되고 모터 개입이 눈에 띄게 줄었다면 배터리 모듈의 전압 불균형이 시작된 것입니다. 순정 신품 교체와 사설 리빌드 셀 밸런싱의 실질 수명과 비용을 분석합니다.',
    outline: [
      '하이브리드 리튬이온/Ni-MH 배터리의 실질 수명 주기 (SoC 40~60% 제어 로직과 20만km 이후 전압 편차)',
      '배터리 이상 초기 증상: 주행 중 잦은 엔진 개입, 충방전 게이지 급상승·급하강, 연비 3~5km/L 급락',
      '제조사 공식 보증 기준 (10년/20만km) 및 블루핸즈/오토큐 순정 어셈블리 교체 견적 (250~350만 원)',
      '사설 전문점 셀 교체 및 밸런싱 재생 배터리 실태 (70~120만 원대)와 1년 무상 A/S 보증의 현실',
      '배터리 냉각팬 먼지 청소와 하부 배터리 송풍구 관리로 수명 5년 늘리는 자가 정비법',
    ],
  },
  {
    slug: 'flooded-car-distinction-methods',
    title: '장마철 이후 중고차 침수차 구별법 — 서류 조작도 잡아내는 7단계 실차 검수',
    category: 'buying',
    heroEmoji: '🌊',
    tags: ['중고차', '침수차', '카히스토리', '중고차사기', '실차검수'],
    description: '자차 미가입 분손 처리나 번호판 세탁으로 서류를 속인 침수차를 현장에서 드라이버 하나로 100% 가려내는 정비사의 7가지 점검 포인트입니다.',
    hook: '보험개발원 카히스토리에 "무사고"로 떠 있어도 침수차일 수 있습니다. 자차 보험 미가입 상태에서 침수되어 차주가 사설로 실내만 닦아내고 시장에 내놓은 매물은 서류로 잡히지 않습니다. 실차 틈새 7곳을 직접 눈으로 확인해야 합니다.',
    outline: [
      '침수 이력 서류 세탁 수법: 자차 미가입 사설 수리, 타 지역 번호판 변경, 소유자 잦은 변경',
      '1단계: 안전벨트 끝까지 당겨 흙탕물 자국 및 제조일자 라벨과 차량 연식 일치 여부 확인',
      '2단계: 운전석 퓨즈박스 커버 탈거 후 배선 커넥터 부식 및 금속 브래킷 녹 발생 확인',
      '3단계: 도어 웨더스트립(고무 몰딩) 뜯어내고 필러 철판 용접부 진흙 및 곰팡이 흔적 점검',
      '4단계: 트렁크 스페어타이어 룸 바닥 및 바닥 매트 하부 펠트 흡음재 곰팡이 냄새 검사',
      '5단계: 시트 하부 전동 모터 볼트 풀림 흔적 및 에어백 커넥터 내부 이물질 확인',
      '6단계: ECU 컴퓨터 커넥터 및 헤드램프 어셈블리 내부 습기 잔류 여부 확인',
      '침수차 구매 시 법적 환불 보장 특약 문구 작성법 ("침수 판정 시 100% 환불 및 취등록세 전액 배상")',
    ],
  },
  {
    slug: 'diesel-dpf-blockage-cleaning-guide',
    title: '디젤 DPF 막힘 증상과 강제 재생 vs 습식 클리닝 주기·비용 완전정복',
    category: 'maintenance',
    heroEmoji: '💨',
    tags: ['디젤', 'DPF', '매연저감장치', 'DPF클리닝', '차압센서'],
    description: '디젤차 소유자의 최대 골칫거리 DPF 경고등 점등 시 대처법, 차압센서 데이터 판독, 건식·습식 클리닝의 실질 효과를 비교 정리했습니다.',
    hook: '시내 주행만 반복하다가 계기판에 DPF 경고등이 깜빡이고 출력 제한(Limp mode)이 걸렸다면 이미 매연 포집량이 한계치를 넘은 것입니다. 방치하면 200만 원짜리 DPF 필터가 녹아내리는 대형 사고로 이어집니다.',
    outline: [
      'DPF 자동 재생 원리: 배기가스 온도 600도 도달 조건과 시내 주행 시 포집량 급증 이유',
      'DPF 사망 초기 징후: 연비 급감, 엔진오일 레벨 증가(경유 유입), 머플러 검은 그을음(크랙)',
      'OBD2 스캐너를 이용한 DPF 포집량(Soot) 및 차압 센서 전압값 진단 기준',
      'DPF 정비 3단계: 고속도로 2,500RPM 정속 주행 강제 재생 ➔ 약품 건식 클리닝 ➔ 탈거 습식 버블 클리닝',
      'DPF 클리닝 주기(10만km 권장) 및 재생 불가 판정(담채 크랙/백화) 시 신품 vs 재생품 견적 비교',
    ],
  },
  {
    slug: 'sonata-vs-k5-used-car-comparison',
    title: '쏘나타 DN8 vs K5 DL3 중고차 가성비 비교 — 동일 플랫폼 다른 결함과 감가율',
    category: 'buying',
    heroEmoji: '🚗',
    tags: ['쏘나타', 'DN8', 'K5', 'DL3', '중고차비교'],
    description: '3세대 N3 플랫폼과 스마트스트림 엔진을 공유하는 쏘나타 DN8과 K5 3세대를 감가율, 디자인 호불호, 정비소 입고 결함 빈도로 비교 분석합니다.',
    hook: '엔진과 변속기, 뼈대가 100% 같은 쌍둥이 차인데 중고차 시장에서는 쏘나타 DN8이 K5 DL3보다 150~250만 원가량 저렴합니다. 디자인 감가로 인한 가성비 선택이 맞는지, 고질병 차이가 있는지 현장 데이터로 비교합니다.',
    outline: [
      '플랫폼 및 파워트레인 공유 현황: 스마트스트림 G2.0, 1.6 터보, 2.0 하이브리드 엔진 스펙 비교',
      '중고차 감가율 격차 원인: DN8의 메기형 전면부 디자인 논란으로 인한 가성비 프리미엄 발생',
      '실내 패키징 및 편의사양 차이: 쏘나타의 버튼식 기어(SBW) vs K5의 다이얼식 기어 조작감 비교',
      '각 모델별 정비 현장 단골 고질병: DN8 센터 디스플레이 깜빡임/잡소리 vs K5 B필러 풍절음/무드램프 잡음',
      '예산 1,500만~2,000만 원대 추천 연식 및 트림: 가성비는 쏘나타 프리미엄 패밀리 vs 감가는 K5 노블레스',
    ],
  },
  {
    slug: 'car-ac-bad-smell-eva-cleaning',
    title: '자동차 에어컨 식초·발냄새 원인과 훈증캔 대신 에바클리닝 해야 하는 이유',
    category: 'maintenance',
    heroEmoji: '❄️',
    tags: ['에어컨냄새', '에바클리닝', '에어컨필터', '블로우모터', '내시경클리닝'],
    description: '에어컨을 켤 때마다 풍기는 쉰내와 곰팡이 냄새의 근원지인 에바포레이터(증발기) 오염 메커니즘과 내시경 세척 시공법을 설명합니다.',
    hook: '에어컨 필터를 새것으로 갈고 마트에서 산 훈증캔을 터뜨려도 일주일만 지나면 쉰내가 다시 올라옵니다. 냄새의 원인은 필터가 아니라 어둡고 습한 에바포레이터 코어에 번식한 곰팡이 군락이기 때문입니다.',
    outline: [
      '에어컨 악취 발생 원리: 에바포레이터 냉각핀 결로 현상 ➔ 주차 후 건조 실패 ➔ 곰팡이 번식',
      '시중 탈취제 및 훈증캔의 한계: 곰팡이 사체 위에 향료를 덮어 2주 뒤 악취가 더 심해지는 이유',
      '내시경 에바클리닝 전문 시공 과정: 블로우 모터 탈거 ➔ 세척제 도포 ➔ 고압 린스 ➔ 오염수 배출',
      '에어컨 필터 교체 주기 및 활성탄/헤파(HEPA) 필터 선택 요령',
      '애프터블로우(After-blow) 모듈 설치 효과 및 주행 종료 5분 전 송풍 모드 습관화 팁',
    ],
  },
  {
    slug: 'brake-pad-rotor-replacement-timing',
    title: '브레이크 패드와 디스크 로터 교체주기 — 쇠 긁는 소리와 핸들 떨림 진단법',
    category: 'maintenance',
    heroEmoji: '🛑',
    tags: ['브레이크패드', '디스크로터', '핸들떨림', '브레이크오일', '제동장치'],
    description: '브레이크 마모 한계선 측정법, 고속 제동 시 핸들 떨림(디스크 열변형) 원인, 패드 잔량 3mm 알림 신호를 정비사 기준으로 정리했습니다.',
    hook: '브레이크를 밟을 때 삐익거리는 쇠 긁는 소리가 나거나 고속도로에서 감속할 때 핸들이 좌우로 덜덜 떨린다면 생명과 직결된 브레이크 시스템의 교체 신호입니다. 과잉 정비 없이 정확한 교체 시점을 짚어드립니다.',
    outline: [
      '브레이크 패드 마모 인디케이터(웨어 인디케이터) 작동 원리와 3mm 한계선 판독법',
      '고속 제동 시 핸들 떨림 원인: 브레이크 디스크 로터의 열변형(런아웃) 발생 메커니즘',
      '디스크 로터 연마 vs 신품 교체 판단 기준 (최소 허용 두께 측정법)',
      '브레이크 오일(DOT4) 수분 함유량 3% 초과 시 베이퍼 록(Vapor Lock) 위험성과 교체 주기',
      '공임나라 및 사설 정비소 기준 패드/디스크 공임 비용과 순정 vs 상신 하드론 등 사제 패드 비교',
    ],
  },
  {
    slug: 'direct-auto-insurance-saving-tricks',
    title: '자동차 보험 다이렉트 30만 원 절약하는 7가지 특약 설정법',
    category: 'buying',
    heroEmoji: '💰',
    tags: ['자동차보험', '다이렉트보험', '보험료절약', '마일리지특약', '티맵특약'],
    description: '대물 배상 10억 설정, 티맵 안전운전 점수, 마일리지 환급, 대인배상 무한 등 보장은 높이고 보험료는 최대로 깎는 실전 특약 조합입니다.',
    hook: '다이렉트 자동차 보험을 갱신할 때 설계사가 추천하는 기본값으로 그냥 결제하면 최소 20~30만 원을 손해 봅니다. 대물 배상은 10억으로 올려도 몇천 원 차이 안 나지만, 티맵 점수와 블랙박스 특약만 챙겨도 수십만 원이 환급됩니다.',
    outline: [
      '필수 보장 세팅: 대물 배상 10억 원(외제차 사고 대비), 자동차상해(자손 대신 자상 2억/5천)',
      '무보험차상해 5억 원 설정 및 긴급출동 견인거리 50km 확대 특약의 중요성',
      '보험료 할인 1순위: 티맵(TMAP) / 카카오내비 안전운전 점수 80점 이상 10~15% 즉시 할인',
      '연간 주행거리 마일리지 환급 특약: 15,000km 이하 구간별 최대 30~40% 만기 환급',
      '추가 할인 꿀팁: 블랙박스 장착, 차선이탈/전방충돌방지 첨단 안전장치, 걸음수 특약 연동',
      '동일 조건에서 삼성화재, DB손해보험, 현대해상, KB손해보험 4사 다이렉트 견적 비교 노하우',
    ],
  },
  {
    slug: 'tire-wear-pattern-wheel-alignment',
    title: '타이어 마모 패턴으로 읽는 하체 이상 징후 — 편마모와 휠 얼라인먼트 주기',
    category: 'maintenance',
    heroEmoji: '🛞',
    tags: ['타이어', '편마모', '휠얼라인먼트', '토우각', '캠버각'],
    description: '타이어 바깥쪽/안쪽 편마모, 깃털 마모, 중앙 마모 패턴을 통해 로워암, 쇼바, 얼라인먼트 틀어짐을 역추적 진단하는 실전 가이드입니다.',
    hook: '새 타이어를 끼운 지 1년밖에 안 됐는데 타이어 안쪽 철심이 드러날 정도로 깎여나갔다면 공기압 문제가 아니라 하체 하체 링크와 휠 얼라인먼트가 완전히 틀어진 것입니다. 타이어 트레드 무늬만 봐도 차량 하체 상태를 알 수 있습니다.',
    outline: [
      '타이어 마모 패턴 4가지: 안쪽 편마모(토아웃/네거티브 캠버), 바깥쪽 편마모, 중앙 마모(과공기압), 양쪽 마모(저공기압)',
      '휠 밸런스(주행 중 특정 속도 핸들 떨림) vs 휠 얼라인먼트(직진 시 차량 쏠림) 구분법',
      '차량 하체 부싱(로워암, 컨트롤암, 타이로드 엔드) 노후화로 인한 유격 진단',
      '타이어 위치 교환 주기(10,000~15,000km)와 앞뒤 대각선 교환 규칙 (전륜/후륜/사륜 차이)',
      '타이어 생산연도(DOT 코드 4자리) 판독법과 트레드웨어(Treadwear) 수명 계산법',
    ],
  },
  {
    slug: 'spark-plug-ignition-coil-symptoms',
    title: '점화플러그·점화코일 수명과 실화(Misfire) 엔진 떨림 자가 진단법',
    category: 'maintenance',
    heroEmoji: '⚡',
    tags: ['점화플러그', '점화코일', '엔진부조', '실화', '가속불량'],
    description: 'D단 정차 시 차체 떨림(엔진 부조), 가속 시 버벅거림(실화)을 유발하는 점화 계통 점검 주기와 이리듐 플러그 교체 DIY 난이도를 정리했습니다.',
    hook: '신호 대기 중에 D단에 놓고 브레이크를 밟고 있을 때 엉덩이 밑으로 툭툭 치는 진동이 느껴지고 계기판 RPM 바늘이 춤을 춘다면 점화플러그나 점화코일의 실화(Misfire)가 시작된 것입니다.',
    outline: [
      '점화 계통 작동 원리: 12V 배터리 전압을 30,000V 고전압으로 승압하여 불꽃 방전',
      '점화플러그 재질별 수명: 일반 니켈(3~4만km) vs 백금(8만km) vs 이리듐/루테늄(10~16만km)',
      '점화코일 고장 징후: 가속 페달을 깊게 밟을 때 울컥거림, 언덕길 출력 부족, 엔진경고등 깜빡임',
      'OBD2 스캐너 고장코드 판독: P0300(다발성 실화), P0301~P0304(특정 실린더 실화) 분석법',
      '4기통 가솔린 기준 부품값(플러그 4개 3~4만 원, 코일 4개 8~10만 원)과 공임나라 교체 비용',
    ],
  },
  {
    slug: 'grandeur-ig-vs-gn7-used-car-comparison',
    title: '그랜저 IG vs 신형 GN7 중고차 실구매 비교 — 2.5 vs 3.3 엔진 안정성과 가격',
    category: 'buying',
    heroEmoji: '🚘',
    tags: ['그랜저', '그랜저IG', '그랜저GN7', '중고차비교', '대형세단'],
    description: '국민 대형 세단 그랜저 6세대(IG/더뉴IG)와 7세대(GN7)의 실내 거주성, 파워트레인 결함률, 1,000만 원 가격 격차의 실질 가치를 비교합니다.',
    hook: '2,000만 원 초반으로 완성도 높은 그랜저 IG 후기형을 살 것인가, 3,000만 원 중후반을 주고 최신 디자인과 옵션이 들어간 GN7으로 갈 것인가? 두 세대의 엔진 내구성과 감가 방어율을 정밀 비교합니다.',
    outline: [
      '그랜저 IG의 완성도: 람다 3.0/3.3 V6 엔진의 매끄러움과 6단/8단 변속기 내구성 검증',
      '신형 GN7의 변화: 플래그십 크기(전장 5m 초과), 프레임리스 도어, 일자형 심리스 호라이즌 램프',
      '파워트레인 이슈 비교: 2.5 스마트스트림 오일 감소 문제 vs 3.5 V6 / 1.6 터보 하이브리드 안정성',
      'GN7 초기형 소프트웨어(ccNC 무한 재부팅, 도어 캐치 오작동) 리콜 이력 체크리스트',
      '추천 구매 가이드: 가성비 패밀리 세단은 더뉴IG 익스클루시브 vs 최신 하이테크 하이브리드는 GN7 캘리그래피',
    ],
  },
  {
    slug: 'winter-car-battery-discharge-prevention',
    title: '겨울철 블랙박스 보조배터리와 시동 배터리 방전 예방 5대 수칙',
    category: 'driving',
    heroEmoji: '❄️',
    tags: ['배터리방전', '블랙박스', '보조배터리', '겨울철차량관리', '암전류'],
    description: '영하 10도 한파에 아침마다 시동이 걸리지 않는 원인인 배터리 화학 반응 저하와 블랙박스 주차 녹화 차단 전압 설정법을 알아봅니다.',
    hook: '어제까지 멀쩡하던 차가 영하 10도로 떨어진 아침에 시동 버튼을 누르니 따다닥 소리만 내고 묵묵부답입니다. 겨울철에는 배터리 용량이 30% 이상 저하되므로 주차 설정 하나만 바꿔도 방전을 막을 수 있습니다.',
    outline: [
      '겨울철 납산/AGM 배터리 성능 저하 원리: 저온에서 전해액 점도 상승 및 화학 반응 속도 저하',
      '방전의 주범 블랙박스 설정: 주차 녹화 차단 전압을 12.0V에서 12.3V(동절기 모드)로 상향 조정',
      '암전류(도둑 전기) 측정법: 시동 끈 후 0.05A 이하 정상치 확인 및 사제 튜닝 기기 점검',
      'AGM 배터리(스톱앤고 ISG 탑재차)와 일반 CMF 배터리의 차이 및 교체 시 주의사항',
      '배터리 인디케이터 녹색/검은색/투명 색상 판독법과 3~4년 주기 교체 가이드',
    ],
  },
  {
    slug: 'engine-flush-oil-additive-truth',
    title: '엔진 플러싱과 엔진오일 첨가제 효과의 진실 — 정비사가 권하는 차와 말리는 차',
    category: 'maintenance',
    heroEmoji: '🧪',
    tags: ['엔진플러싱', '오일첨가제', '몰리브덴', '슬러지제거', '엔진관리'],
    description: '엔진오일 교체 시 권유받는 플러싱과 옥탄가/세탄가 부스터, 몰리브덴 첨가제가 실제로 엔진에 미치는 영향과 위험성을 밝힙니다.',
    hook: '카센터에서 엔진오일을 갈러 갔더니 "엔진 내부에 슬러지가 꽉 찼으니 5만 원짜리 플러싱을 꼭 해야 한다"고 권유합니다. 과연 플러싱은 필수일까요, 아니면 과잉 정비일까요? 정비 현장의 진실을 공개합니다.',
    outline: [
      '엔진 플러싱 원리: 솔벤트 성분 케미컬로 굳은 슬러지를 녹여내는 메커니즘',
      '플러싱을 절대 하면 안 되는 차량: 15만km 이상 노후차 플러싱 시 오일팬 스트레이너 막힘 위험',
      '엔진오일 첨가제(유기 몰리브덴, 테프론, 에스테르)의 실질 소음 감소 및 마찰 저감 효과',
      '완성 엔진오일(기유+패키지 첨가제)의 밸런스를 깨뜨리는 사제 첨가제 오남용 주의점',
      '가장 경제적이고 안전한 슬러지 관리법: 광유 플러싱 대신 고급 합성유 5,000km 조기 교환법',
    ],
  },
  {
    slug: 'avante-cn7-used-car-buying-guide',
    title: '아반떼 CN7 중고차 실구매 가이드 — 스마트스트림 IVT 무단변속기 내구성과 추천 트림',
    category: 'buying',
    heroEmoji: '🚙',
    tags: ['아반떼', 'CN7', 'IVT변속기', '사회초년생', '중고차추천'],
    description: '사회초년생과 출퇴근용 최고의 가성비 준중형 아반떼 CN7의 1.6 가솔린 IVT 변속기 이질감 극복법과 중고차 매물 선별 노하우를 정리했습니다.',
    hook: '첫차로 중고 아반떼 CN7을 알아보고 계신가요? 3세대 플랫폼 덕분에 실내가 중형급으로 넓어지고 연비도 15km/L를 넘지만, IVT(CVT 체인 방식) 변속기의 변속 로직과 연식별 옵션 구성을 모르면 후회할 수 있습니다.',
    outline: [
      'CN7 아반떼의 강점: 3세대 N3 플랫폼 적용으로 낮아진 무게중심과 대폭 확장된 2열 무릎 공간',
      '현대차 스마트스트림 IVT(무단변속기)의 특징: 금속 체인 벨트 적용으로 내구성 향상 및 가상 변속 로직',
      '연식별 고질병 체크: 2020~2021년식 보닛 단차, 트렁크 스프링 튕김, 디지털 클러스터 잡음',
      '트림별 필수 옵션 분석: 스마트(깡통) 피하고 인스퍼레이션 또는 모던+컨비니언스+현대스마트센스 추천',
      '예산 1,300만~1,700만 원대 무사고 실매물 고르는 현장 체크포인트',
    ],
  },
  {
    slug: 'ev-battery-charging-habits-soh',
    title: '전기차 배터리 수명(SoH) 100% 유지하는 20-80 충전법과 급속 충전 주의점',
    category: 'eco',
    heroEmoji: '⚡',
    tags: ['전기차', '배터리수명', 'SoH', '완속충전', '급속충전'],
    description: '아이오닉5, EV6, 테슬라 모델Y 등 전기차 배터리 열화를 막는 20~80% 충전 루틴, 완속 충전 비중, BMS 셀 밸런싱 100% 충전 주기를 안내합니다.',
    hook: '전기차를 매일 100%까지 급속 충전으로 꽉 채우고 계신가요? 배터리 용량의 상한선(100%)과 하한선(0%)에 가까워질수록 리튬이온 배터리의 덴드라이트 현상과 열화 속도는 기하급수적으로 빨라집니다.',
    outline: [
      'NCM(삼원계) 배터리 vs LFP(인산철) 배터리의 화학적 특성과 권장 충전 상한선 차이',
      '20-80% 일상 충전 규칙: 배터리 내부 스트레스를 최소화하여 5년 후 SoH 95% 이상 유지하는 법',
      '급속(DC 350kW/100kW) 충전 시 발생하는 고열과 배터리 수명 상관관계',
      '한 달에 1회 완속(AC 7kW)으로 100% 충전하여 BMS 셀 밸런싱을 맞춰야 하는 이유',
      '겨울철 배터리 프리컨디셔닝(Pre-conditioning) 기능 활용으로 충전 속도 2배 높이기',
    ],
  },
  {
    slug: 'car-undercarriage-noise-lower-arm-bushings',
    title: '방지턱 넘을 때 찌걱·덜컹 하체 소음 — 활대링크와 로워암 부싱 교체 견적',
    category: 'maintenance',
    heroEmoji: '🔧',
    tags: ['하체소음', '방지턱소음', '활대링크', '스테빌라이저', '로워암'],
    description: '겨울철이나 비포장도로에서 발생하는 찌걱찌걱(고무 비비는 소리), 덜컹거리는 하체 유격 소음의 원인 부품별 증상과 공임 견적을 분석합니다.',
    hook: '아침 출근길에 아파트 단지 과속방지턱을 넘을 때마다 조수석 밑에서 "찌걱~ 찌걱~"하는 오리 울음소리가 나나요? 덜컹거리는 쇠 부딪히는 소리인가요? 소리 패턴만으로 고장 난 고무 부싱 부품을 90% 확진할 수 있습니다.',
    outline: [
      '하체 소음 1순위: 스테빌라이저 바 부싱(활대고무) 및 활대링크(스테빌라이저 링크) 유격',
      '찌걱거림 vs 덜컹거림 소리 구분: 찌걱은 고무 부싱 경화, 덜컹/딱딱은 볼조인트 및 쇼바 마운트 파손',
      '로워암(Lower Arm) 통째 교체 vs 고무 부싱만 압입 교체 시 비용 및 내구성 비교',
      '쇼크업소버(쇼바) 오일 누유 및 범프러버 파손 확인법',
      '국산 중형차 기준 활대링크/부싱 교체비(5~8만 원) vs 로워암 교체비(15~25만 원) 공임 비교',
    ],
  },
  {
    slug: 'car-scratches-diy-touch-up-paint',
    title: '문콕과 범퍼 스크래치 붓펜 도색 DIY — 샌딩부터 투명 클리어 마감까지',
    category: 'driving',
    heroEmoji: '🖌️',
    tags: ['붓펜도색', '문콕', '스크래치제거', '컴파운드', '자가도색'],
    description: '공업사 판금도색 30만 원을 아끼는 차량 색상코드 확인법, 붓펜 덧칠, 레벨링 크림 샌딩, 광택 복원까지의 단계별 셀프 도색 튜토리얼입니다.',
    hook: '주차장에서 긁힌 손바닥만 한 범퍼 흠집 때문에 공업사에 가니 한 판 도색비로 30만 원을 달라고 합니다. 철판이 찌그러지지 않은 도장면 스크래치라면 2만 원짜리 붓펜과 컴파운드로 80% 이상 완벽하게 복원할 수 있습니다.',
    outline: [
      '스크래치 깊이 진단: 물을 뿌렸을 때 사라지면 클리어층 흠집(컴파운드 해결), 철판 보이면 붓펜 필수',
      '내 차 정확한 색상코드(Paint Code) 찾는 위치 (운전석 B필러 도어스텝 스티커 확인)',
      '1단계: 탈지제(이소프로필 알코올)로 유분 제거 및 녹 방지 방청 프라이머 도포',
      '2단계: 붓펜 얇게 3회 덧칠(Layering) ➔ 도장면보다 살짝 볼록하게 채우기',
      '3단계: 3일 건조 후 2000방 사포/레벨링 크림으로 평탄화 샌딩 ➔ 마무리 초미립자 컴파운드 광택',
    ],
  },
  {
    slug: 'engine-coolant-antifreeze-replacement-guide',
    title: '부동액(냉각수) 혼유 금지 규칙과 장수명 냉각수 교체 주기·색상 구별법',
    category: 'maintenance',
    heroEmoji: '🌡️',
    tags: ['냉각수', '부동액', '워터펌프', '오버히트', '라디에이터'],
    description: '초록색, 핑크색, 파란색 냉각수의 화학 성분 차이와 잘못 혼합 시 발생하는 젤리화(슬러지 침전) 고장, 냉각수 비중계 측정법을 다룹니다.',
    hook: '부동액이 부족하다고 카센터에서 아무 색깔의 냉각수나 섞어 넣었다가는 화학 반응으로 라디에이터 코어가 젤리처럼 굳어 막히며 엔진이 과열(오버히트)되어 폐차 위기에 처할 수 있습니다.',
    outline: [
      '냉각수(부동액)의 역할: 엔진 과열 방지(비등점 상승), 겨울철 동파 방지(어는점 하강), 부식 방지',
      '색상별 계열 차이: 전통 규산염 녹색(2년/4만km) vs 인산염 장수명 핑크/청색(5~10년/10~20만km)',
      '절대 혼유 금지: 규산염과 인산염/유기산염 계열 혼합 시 침전물 발생으로 워터펌프 고장 유발',
      '수돗물(증류수) vs 지하수/생수: 미네랄 성분이 있는 생수를 냉각수로 넣으면 안 되는 이유',
      '비중계로 어는점(-25~-35도) 측정 및 순환식 교체 vs 드레인 방식 교체 비용 비교',
    ],
  },
  {
    slug: 'car-fuel-economy-driving-habits',
    title: '연비 20% 끌어올리는 실전 퓨얼컷(Fuel-cut)과 탄력 주행 운전법',
    category: 'driving',
    heroEmoji: '⛽',
    tags: ['연비운전', '퓨얼컷', '탄력주행', '연비향상', '에코드라이빙'],
    description: '급출발 자제보다 효과적인 내리막길 퓨얼컷 활용, 타력 주행(코스팅), 적정 타이어 공기압 세팅으로 기름값을 아끼는 6가지 운전 습관입니다.',
    hook: '기름값을 아끼겠다고 무조건 거북이처럼 천천히 달리는 것은 연비에 오히려 독이 됩니다. 엔진 컴퓨터가 연료 분사를 완전히 0으로 차단하는 "퓨얼컷(Fuel-cut)" 구간을 적극 활용하면 고속도로 연비 20km/L 돌파가 가능합니다.',
    outline: [
      '퓨얼컷(Fuel-cut)의 과학적 원리: 주행 중 가속페달 오프 시 관성으로 엔진 회전 유지 ➔ 연료 소비 0L',
      '신호 대기 N단 중립 vs D단 유지의 실질 연료 절감량 비교 (ISG 기능과의 차이)',
      '고속도로 크루즈 컨트롤 vs 운전자 탄력 주행: 오르막/내리막 지형별 연비 격차',
      '타이어 적정 공기압(+10% 세팅)과 트렁크 불필요한 짐 30kg 감량의 실질 연비 기여도',
      '급가속 3초 금지 및 락업 클러치(Lock-up) 조기 체결을 유도하는 페달링 기술',
    ],
  },
  {
    slug: 'hyundai-kia-8-speed-auto-transmission-tips',
    title: '현대·기아 전륜 8단 자동변속기 꿀렁임과 미션오일 무교환의 허실',
    category: 'maintenance',
    heroEmoji: '⚙️',
    tags: ['자동변속기', '미션오일', '8단변속기', '변속충격', '솔레노이드밸브'],
    description: '그랜저, K8, 쏘렌토, 싼타페 전륜 8단 자동변속기의 저속 변속 충격 원인과 매뉴얼상 무교환 미션오일을 8만km에 갈아야 하는 이유를 밝힙니다.',
    hook: '제조사 차량 매뉴얼에는 "미션오일은 무교환(무점검) 부품"이라고 적혀 있지만, 8만km를 넘긴 변속기 오일을 빼보면 새카만 간장색으로 산화되어 쇳가루가 가득합니다. 정비 현장에서 증명하는 미션오일 교체의 진실입니다.',
    outline: [
      '전륜 8단 자동변속기(A8LF/A8F)의 구조적 특징: 다단화로 연비는 개선되었으나 저속 2➔3단 꿀렁임 발생',
      '제조사의 "가혹 조건" 정의: 시내 주행, 잦은 정체, 오르막 주행 시 10만km 이내 교체 필수',
      '미션오일 열화 증상: D/R단 체결 지연(1초 이상 딜레이), 변속 시 쿵 충격, 가속 시 슬립',
      '레벨링 온도의 중요성: 순환식 vs 드레인 교체 시 유온 55~60도 정밀 레벨링이 변속감을 좌우하는 이유',
      '변속기 TCU 학습값 초기화 및 솔레노이드 밸브 자가 보정 주행법',
    ],
  },
];

/* -------------------------------------------------------------- Topic Selector */

function getPublishedSlugs() {
  if (!existsSync(CONTENT_DIR)) return new Set();
  return new Set(
    readdirSync(CONTENT_DIR)
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
  );
}

function selectNextTopic() {
  const published = getPublishedSlugs();
  const unposted = TOPICS.filter((t) => !published.has(t.slug));

  if (unposted.length > 0) {
    return { ...unposted[0], isFresh: true };
  }

  // Fallback: suffix version
  const base = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  let v = 2;
  while (published.has(`${base.slug}-v${v}`)) v++;
  return {
    ...base,
    slug: `${base.slug}-v${v}`,
    title: `${base.title} (${v}차 업데이트)`,
    isFresh: false,
  };
}

/* -------------------------------------------------------------- Gemini Generator */

const GEMINI_SYSTEM_PROMPT = `당신은 대한민국 최고 권위의 15년 경력 공인 '자동차정비기능장'이자 오토가이드(AutoGuide) 편집장 김도현입니다.
독자들은 자동차 정비, 중고차 구매, 하이브리드/전기차 관리 등에서 과잉 정비나 사기를 피하고 정확한 실측 데이터를 알고 싶어 합니다.

[작성 원칙]
1. 글자 수 규격: 본문 전체 분량은 공백 포함 2,500자 ~ 4,500자 내외(반드시 2,000자 이상 6,000자 미만)로 가독성 높고 핵심적인 정보 밀도를 갖추어 작성하세요.
2. 부품 명칭, 결함 증상, 압력/온도/치수(mm, Nm, V, Ah), 정비 공임 견적(원 단위)을 구체적인 숫자로 명시하세요.
3. 정비 지침서(Shop Manual)와 현장 작업 노하우, 리프트에서 직접 확인한 생생한 실전 경험담 톤을 유지하세요.
4. 마크다운 형식으로 작성하되, 맨 앞의 프론트매터(--- 영역)는 출력하지 말고 바로 본문부터 출력하세요.
5. Markdown H2 (##), H3 (###) 소제목, 상세 비교 표(Table), 인용구 (> 💡 팁), 체크리스트를 풍부하게 활용하세요.
6. 문장 끝은 친절하고 전문적인 존댓말(~합니다, ~하세요, ~됩니다)을 사용하세요.`;

async function generateWithGemini(topic) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[gemini] GEMINI_API_KEY is not set. Falling back to template.');
    return null;
  }

  const prompt = `주제: ${topic.title}
카테고리: ${topic.category}
핵심 태그: ${topic.tags.join(', ')}
도입부 훅: ${topic.hook}

개요 및 필수 포함 내용:
${topic.outline.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}

위 개요를 바탕으로 각 소주제마다 실무적인 진단 단계, 자가 점검법, 부품 견적 비교, 주의사항을 2,500자 ~ 4,500자 내외(최대 6,000자 미만)로 알차고 가독성 높게 작성해 주세요.`;

  const candidateModels = Array.from(
    new Set([
      GEMINI_MODEL,
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
    ]),
  );

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${GEMINI_SYSTEM_PROMPT}\n\n${prompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(90_000),
      });

      if (!res.ok) {
        console.warn(`[gemini] ${model} HTTP ${res.status} — trying next model`);
        continue;
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason && finishReason !== 'STOP') {
        console.warn(`[gemini] ${model} incomplete finishReason (${finishReason}) — trying next model`);
        continue;
      }

      const text = (candidate?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('')
        .trim();

      const cleaned = text
        .replace(/^```(?:markdown|md)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .replace(/^---[\s\S]*?---\s*/, '')
        .trim();

      if (cleaned.length < MIN_CHARS) {
        console.warn(`[gemini] ${model} draft too short (${cleaned.length} chars) — trying next model`);
        continue;
      }

      console.log(`[gemini] successfully generated via ${model} (${cleaned.length} chars)!`);
      return cleaned;
    } catch (err) {
      console.warn(`[gemini] ${model} error: ${err.message} — trying next model`);
    }
  }

  console.warn('[gemini] all models failed — falling back to template');
  return null;
}

/* -------------------------------------------------------------- Deterministic Template Fallback */

function renderTemplateBody(topic) {
  const out = [];

  out.push(topic.hook, '');

  out.push('## 핵심 요약 및 점검 항목', '');
  topic.outline.forEach((item, i) => out.push(`${i + 1}. **${item.split(':')[0]}**: ${item.split(':')[1] || item}`));
  out.push('');

  out.push('## 1. 문제의 근본 원인과 정비 지침 분석', '');
  out.push(
    '현대적인 차량 시스템은 센서와 ECU의 피드백 제어로 작동하기 때문에, 단일 부품의 이상이 연쇄적인 출력 저하나 연비 하락으로 이어집니다. 공인 정비지침서의 진단 트리(Diagnostic Tree)를 따라 원인을 단계적으로 좁혀나가는 것이 과잉 정비를 막는 유일한 방법입니다.'
  );
  out.push('');

  out.push('## 2. 실전 단계별 자가 점검 및 정비 가이드', '');
  topic.outline.forEach((item, i) => {
    out.push(`### 2.${i + 1} ${item.split(':')[0]}`, '');
    out.push(
      `${item}에 대한 세부 조치 사항입니다. 정비소 방문 전 운전자가 직접 상태를 확인하고 진단 스캐너 데이터나 게이지 수치를 기록해 두면 정비 상담 시 정확한 원인 파악과 합리적인 견적 산출이 가능합니다.`
    );
    out.push('');
    out.push('> 💡 **정비기능장의 실전 팁**: 부품 교체 전 반드시 커넥터 접점 부식 여부와 접지 상태를 먼저 확인하세요. 단순 접촉 불량으로 멀쩡한 부품을 교체하는 사례가 현장에서 매우 흔합니다.');
    out.push('');
  });

  out.push('## 3. 부품 견적 및 공임 비교 가이드', '');
  out.push('| 정비 항목 | 순정 부품 가격 | 사설/OEM 부품 가격 | 표준 정비 공임 |');
  out.push('| :--- | :--- | :--- | :--- |');
  out.push('| 1단계 기본 점검 및 케미컬 시공 | 30,000 ~ 60,000원 | 15,000 ~ 30,000원 | 20,000 ~ 40,000원 |');
  out.push('| 2단계 주요 소모품 어셈블리 교체 | 120,000 ~ 250,000원 | 80,000 ~ 150,000원 | 50,000 ~ 90,000원 |');
  out.push('| 3단계 핵심 모듈 리빌드 및 어셈블리 | 500,000원 이상 | 300,000 ~ 450,000원 | 150,000 ~ 300,000원 |');
  out.push('');

  out.push('## 4. 정비 후 필수 사후 관리 수칙', '');
  out.push(
    '정비를 마친 후에는 즉시 고속 주행을 하기보다 50~100km 구간 동안 시내 주행을 통해 학습값(Adaptation Value)이 정상적으로 안착하는지 관찰해야 합니다. 이상 진동이나 경고등 재점등 여부를 꼼꼼히 모니터링하세요.'
  );

  return out.join('\n');
}

/* -------------------------------------------------------------- Main Publisher */

async function main() {
  const topic = selectNextTopic();
  console.log(`\n[auto-publish] Selected topic: ${topic.title} (${topic.slug})`);

  let body = await generateWithGemini(topic);
  let source = 'gemini';

  if (!body) {
    body = renderTemplateBody(topic);
    source = 'template';
  }

  const today = new Date().toISOString().slice(0, 10);
  const frontmatter = `---
title: '${topic.title.replace(/'/g, "''")}'
description: '${topic.description.replace(/'/g, "''")}'
pubDate: ${today}
category: '${topic.category}'
tags: [${topic.tags.map((t) => `'${t}'`).join(', ')}]
heroEmoji: '${topic.heroEmoji}'
featured: false
---

`;

  const fullContent = frontmatter + body + '\n';
  const targetFile = join(CONTENT_DIR, `${topic.slug}.md`);

  writeFileSync(targetFile, fullContent, 'utf8');

  console.log(`[auto-publish] ✅ Successfully created: ${targetFile}`);
  console.log(`  Source     : ${source}`);
  console.log(`  Total chars: ${fullContent.length}`);
}

main().catch((err) => {
  console.error('[auto-publish] ❌ Error:', err);
  process.exit(1);
});
