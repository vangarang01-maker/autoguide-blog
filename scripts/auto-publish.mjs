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
const MIN_CHARS = 5000;

/* -------------------------------------------------------------- Topic Bank (30+) */

const TOPICS = [
  {
    slug: 'car-warranty-expiration-inspection-checklist',
    title: '자동차 보증기간 만료 직전 필수 점검 7가지 — 보증 연장 혜택과 무상 수리 항목 챙기는 법',
    category: 'maintenance',
    heroEmoji: '📝',
    tags: ['보증기간', '무상수리', '자동차점검', '유지비절감'],
    description: '제조사 보증기간이 끝나기 전 반드시 점검해야 할 핵심 부품과 무상 수리 조치 방법을 알아봅니다.',
    hook: '보증 만료 하루 차이로 몇백만 원 수리비를 내지 않으려면 만료 1개월 전 이 점검표를 확인하세요.',
    outline: [
      '차종별 차체·엔진·배출가스 보증기간 상이한 기준 정리',
      '보증 만료 전 카센터 및 정비소에서 무상 수리받을 부품 7가지',
      '제조사 무상 보증 연장 프로모션 조건과 가입 실익 비교',
      '미세 누유 및 잡소리 증상 보증 수리 신청 시 판정 받는 팁',
      '보증 만료 직전 정비 이력 남기기가 중요한 이유',
    ],
  },
  {
    slug: 'low-mileage-used-car-buying-pitfalls',
    title: '주행거리 4만km 이하 중고차만 고르면 위험한 이유 — 가다 서다 가혹 조건 차량 구분법',
    category: 'buying',
    heroEmoji: '🔍',
    tags: ['중고차구매', '짧은주행거리', '가혹조건', '중고차점검'],
    description: '연식 대비 주행거리가 짧아 인기 높은 중고차의 숨겨진 가혹 주행 흔적과 속기 쉬운 맹점을 분석합니다.',
    hook: '주행거리 3만km 중고차가 8만km 차보다 엔진 상태가 안 좋을 수 있습니다. 단거리 주행의 함정을 확인하세요.',
    outline: [
      '최근 연식·짧은 주행거리 중고차에 수요가 몰리는 이유와 가격 거품',
      '단거리 도심 주행(가다 서다) 위주 차량의 엔진 카본 누적 및 하부 문제',
      '방치된 차량에서 나타나는 고무 부품 가스켓·타이어 평평화(Flat Spot) 증상',
      '주행거리 대비 페달·핸들·시트 마모도로 알아채는 시내 주행 가혹도',
      '짧은 주행거리 중고차 구매 후 즉시 교체해야 할 케미컬류 점검 리스트',
    ],
  },
  {
    slug: 'imported-ev-repair-cost-and-parts-supply-guide',
    title: '수입 전기차 사고 수리비 공임 폭탄 피하는 법 — 부품 수급 대기 최소화와 보험 특약 활용 가이드',
    category: 'maintenance',
    heroEmoji: '💸',
    tags: ['전기차수리비', '수입차정비', '자동차보험', '부품수급'],
    description: '신생 및 수입 전기차 브랜드 보유 시 직면하는 과도한 수리비 공임 산정 기준과 부품 대기 대처법을 안내합니다.',
    hook: '범퍼 살짝 긁혔는데 수리비 1,000만 원? 수입 전기차 사고 시 정비 공임표 확인과 보험 처리 팁!',
    outline: [
      '수입 전기차 브랜드의 공임 산정 방식(국제 표준 시간 공임 기준) 이해',
      '전기차 하부 배터리 케이스 손상 시 교체 vs 수리 판정 기준',
      '부품 수급 지연 시 렌터카 비용 부담 줄이는 자차 보험 특약 구성법',
      '사설 전기차 전문 정비소 이용 시 보증 파기 문제와 활용 범위',
      '사고 후 수리견적서 검증 및 과잉 정비 청구 피하는 3단계 검토법',
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
    title: '점화플러그·점화코일 실화 진단부터 자가 교체까지 — 수명, 규정 토크, 비용 총정리',
    category: 'maintenance',
    heroEmoji: '⚡',
    tags: ['점화플러그', '점화코일', '실화', '엔진부조', '규정토크', '자가정비'],
    description: 'D단 정차 시 차체 떨림과 가속 버벅거림을 일으키는 점화 계통 실화를 진단하고, 직접 교체할 때 실린더 헤드 나사산을 살리는 규정 토크 체결법까지 한 번에 정리했습니다.',
    hook: '신호 대기 중 D단에서 엉덩이 밑으로 툭툭 치는 진동이 오고 RPM 바늘이 춤을 춘다면 점화 계통 실화(Misfire)가 시작된 것입니다. 다만 공임 5만 원을 아끼려다 헤드 나사산을 뭉개면 100만 원짜리 수리로 번지므로, 진단과 교체를 함께 알아야 합니다.',
    outline: [
      '점화 계통 작동 원리: 12V 배터리 전압을 30,000V 고전압으로 승압하여 불꽃 방전',
      '점화플러그 재질별 수명: 일반 니켈(3~4만km) vs 백금(8만km) vs 이리듐/루테늄(10~16만km)',
      '점화코일 고장 징후: 가속 페달을 깊게 밟을 때 울컥거림, 언덕길 출력 부족, 엔진경고등 깜빡임',
      'OBD2 스캐너 고장코드 판독: P0300(다발성 실화), P0301~P0304(특정 실린더 실화) 분석법',
      '자가 교체 시 규정 토크: 14mm/16mm 가솔린 기준 20~25Nm, 과토크 시 헤드 나사산 파손과 헬리코일 인서트 비용',
      '저토크 체결의 위험: 압축가스 누출, 플러그 풀림, 방열 불량으로 인한 조기 점화(노킹)',
      '4기통 가솔린 기준 부품값(플러그 4개 3~4만 원, 코일 4개 8~10만 원)과 정비소 교체 공임 비교',
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
    title: '자동차 스크래치 깊이별 셀프 복원 — 스월마크 컴파운드 광택부터 붓펜 도색까지',
    category: 'driving',
    heroEmoji: '🖌️',
    tags: ['스크래치제거', '붓펜도색', '컴파운드', '스월마크', '문콕', '셀프디테일링'],
    description: '클리어층에만 난 잔기스는 컴파운드 광택으로, 철판이 드러난 흠집은 붓펜 도색으로 나뉩니다. 깊이 진단부터 마감 광택까지 공업사 30만 원을 아끼는 단계별 순서를 정리했습니다.',
    hook: '주차장에서 긁힌 손바닥만 한 흠집에 공업사가 한 판 도색비 30만 원을 부릅니다. 물을 뿌려 사라지면 컴파운드로, 철판이 보이면 붓펜으로 갈리는데 순서를 틀리면 도장면이 뿌옇게 탈색됩니다.',
    outline: [
      '스크래치 깊이 진단: 물을 뿌렸을 때 사라지면 클리어층 흠집(광택 해결), 철판이 보이면 붓펜 도색 필수',
      '도장면 단면 구조: 강판 ➔ 전착도장 ➔ 베이스코트(색상) ➔ 클리어코트(투명 보호층)',
      '[얕은 흠집] 컴파운드 입자 구분(굵은 1000~1500방 vs 마무리 3000~5000방)과 핸드 폴리싱 가압 요령',
      '[얕은 흠집] 클레잉으로 철분·타르 제거 후 카나우바 왁스로 클리어층 보호 마감',
      '[깊은 흠집] 내 차 색상코드(Paint Code) 위치 확인과 탈지·방청 프라이머 도포',
      '[깊은 흠집] 붓펜 얇게 3회 덧칠해 도장면보다 살짝 볼록하게 채우기',
      '[깊은 흠집] 3일 건조 후 2000방 사포·레벨링 크림 평탄화 ➔ 초미립자 컴파운드 마무리',
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
  {
    slug: 'car-battery-agm-vs-din-replacement',
    title: 'ISG 스톱앤고 차량 AGM 배터리 교체 주기와 일반 DIN 배터리 혼용 시 위험성',
    category: 'maintenance',
    heroEmoji: '🔋',
    tags: ['AGM배터리', 'ISG', '스톱앤고', '배터리교체', 'IBS센서'],
    description: '오토스탑(ISG) 장착 차량에 비싼 AGM 배터리가 들어가는 이유와 일반 납산 배터리로 다운그레이드 시 발생하는 IBS 센서 오류를 분석합니다.',
    hook: '카센터에서 AGM 배터리 교체비로 25만 원을 부르자 일반 배터리로 10만 원 싸게 갈아 끼웠다가, 6개월 만에 방전되고 ISG가 영구 정지되는 사례가 빈번합니다. AGM 배터리의 급속 충전 수용 메커니즘을 짚어드립니다.',
    outline: [
      'AGM(Absorbent Glass Mat) 배터리의 구조: 유리섬유 격리판 적용으로 충방전 사이클 수명 3배 향상',
      'ISG(Idle Stop & Go) 시스템의 가혹한 전력 소모: 신호 대기 시 에어컨/전장 부하를 배터리만으로 감당하는 원리',
      '일반 DIN 배터리 장착 시 문제점: 급속 회생제동 충전 불량, 배터리 조기 황산화, 1년 이내 사망',
      '배터리 교체 후 필수 작업: IBS(지능형 배터리 센서) 리셋 및 코딩 절차 4단계',
      '브랜드별 실구매가 비교: 델코 AGM vs 바르타(VARTA) vs 로케트 AGM 최저가 교체 노하우',
    ],
  },
  {
    slug: 'car-underbody-rust-undercoating-truth',
    title: '신차 언더코팅 필수일까? 하부 방청 보증과 수성·유성·투명 코팅 장단점',
    category: 'maintenance',
    heroEmoji: '🛡️',
    tags: ['언더코팅', '하부부식', '염화칼슘', '방청작업', '방음'],
    description: '겨울철 염화칼슘 부식을 막기 위한 언더코팅의 실질 효과와 시공 불량으로 인한 배수구 막힘, 제조사 하부 보증 거부 위험을 정리했습니다.',
    hook: '신차 출고 패키지로 60만 원짜리 언더코팅을 권유받으셨나요? 현대·기아 신차는 이미 아연도금 강판과 언더커버가 70% 이상 적용되어 있지만, 바닷가 거주자나 강원도 제설 구간 운전자라면 선별적 시공이 필요합니다.',
    outline: [
      '신차 출고 시 기본 방청 상태: 아연도금 강판 비율 70% 이상 및 언더바디 플라스틱 커버링 수준',
      '언더코팅이 꼭 필요한 환경: 염화칼슘 대량 살포 지역(강원/경기 북부), 바닷가 인접 해안 지역 운행',
      '코팅제 종류별 특성: 유성(냄새 심함/갈라짐) vs 수성(친환경/비쌈) vs 투명 우레탄(하부 시인성 유지)',
      '시공 시 치명적 주의점: 고무 부싱, 배기 머플러, 드라이브샤프트, 서스펜션 볼트에 오코팅 시 잡소리 유발',
      '가장 효과적인 하부 관리법: 비싼 코팅 대신 겨울철 주기적인 고압 하부 세차 요령',
    ],
  },
  {
    slug: 'suv-diesel-vs-gasoline-vs-hybrid',
    title: '투싼·스포티지 1.6 터보 vs 2.0 디젤 vs 하이브리드 — 5년 실유지비 손익분기점',
    category: 'buying',
    heroEmoji: '📊',
    tags: ['투싼', '스포티지', '하이브리드비교', '디젤단종', '유지비계산'],
    description: '준중형 SUV 3대 파워트레인의 차량 가액, 취등록세, 5년 주행거리별 유류비 및 자동차세, 중고차 잔존가치를 엑셀 시뮬레이션으로 비교합니다.',
    hook: '하이브리드가 아무리 연비가 좋다 해도 차량 가격이 400만 원 더 비쌉니다. 연간 1.5만km를 탈 때 몇 년을 타야 비싼 신차가격을 기름값으로 뽑을 수 있는지 정밀 계산해 드립니다.',
    outline: [
      '신차 구매 초기 비용 비교: 1.6T 가솔린(2,700만) vs 2.0D 디젤(2,950만) vs 1.6T HEV(3,200만 원)',
      '연간 1.5만km 주행 기준 유류비 실측: 가솔린 210만 원 vs 디젤 165만 원 vs 하이브리드 130만 원',
      '자동차세 및 소모품 유지비: 가솔린/HEV(1,598cc 약 29만 원) vs 디젤(1,995cc 약 52만 원 + 요소수)',
      '손익분기점 계산: 가솔린 대비 하이브리드 추가금 회수 기간은 주행거리 1.5만km 기준 약 4.2년',
      '5년 후 중고차 잔존가치 방어율: 하이브리드(68%) > 가솔린(58%) > 디젤(45% 급락)',
    ],
  },
  {
    slug: 'electric-car-winter-range-loss-heatpump',
    title: '전기차 겨울철 주행거리 30% 급감 원인 — 히트펌프 작동 원리와 전비 방어 팁',
    category: 'eco',
    heroEmoji: '❄️',
    tags: ['전기차겨울', '히트펌프', '전비저하', '배터리히팅', '겨울철전기차'],
    description: '영하 10도 한파에 450km 가던 전기차가 300km로 줄어드는 화학적 원인과 PTC 히터 vs 히트펌프의 전력 소비 차이, 충전 팁을 다룹니다.',
    hook: '겨울만 되면 전기차 계기판의 주행 가능 거리가 100km 이상 뚝 떨어져 히터 켜기도 겁난다는 차주들이 많습니다. 전기차 전비가 급락하는 이유와 배터리 소모를 30% 줄이는 난방 공조 설정법을 공개합니다.',
    outline: [
      '저온에서 리튬이온 전해액 점도 증가와 저항 상승으로 인한 방전 용량 감소 메커니즘',
      'PTC 히터(전기 열선 저항 난방)의 무자비한 5~6kW 전력 소모 vs 히트펌프(폐열 회수) 시스템의 효율',
      '겨울철 전비 방어 1순위: 실내 히터(24도) 대신 시트 열선 + 스티어링 휠 열선 중심 난방 전략',
      '출발 전 예약 공조(Pre-conditioning) 설정: 충전 플러그가 꽂힌 상태에서 배터리와 실내를 미리 예열',
      '겨울철 회생제동 단계 조절 요령과 빙판길 슬립 방지 드라이브 모드 설정',
    ],
  },
  {
    slug: 'used-car-performance-inspection-reading',
    title: '중고차 성능점검기록부 보는 법 — W(판금), X(교환)와 미세누유 속지 않는 법',
    category: 'buying',
    heroEmoji: '🔍',
    tags: ['성능점검기록부', '중고차검수', '무사고기준', '판금도색', '미세누유'],
    description: '딜러들이 말하는 "단순교환 무사고"의 법적 함정, 프레임 손상(유사고) 판정 기준, 성능점검 책임보험 1개월 2,000km 보상 청구 요령입니다.',
    hook: '성능점검기록부에 "무사고"라고 도장이 찍혀 있는데 휀더와 보닛에 X(교환) 표시가 수두룩합니다. 외판 단순교환과 골격 프레임 사고의 경계선을 모르면 200만 원 이상 감가된 사고차를 제값 주고 사게 됩니다.',
    outline: [
      '성능점검기록부 기호 해독: X(교환), W(판금/용접), C(부식), A(흠집), U(요철)의 정확한 의미',
      '법적 무사고 vs 완전 무사고 차이: 휀더/도어/범퍼 외판 100번 갈아도 법적으로는 "무사고" 판정',
      '절대 피해야 할 골격(프레임) 사고 부위: 사이드실 패널, A/B/C 필러, 휠하우스, 크로스멤버',
      '미세누유(1방울 미만 비침) vs 누유(오일 바닥 떨어짐)의 정비 시급성 판별법',
      '성능점검 책임보험(메리츠/DB/KB) 30일/2,000km 이내 누유/고장 발견 시 무상 수리 보상 절차',
    ],
  },
  {
    slug: 'plug-in-hybrid-phev-real-efficiency',
    title: '플러그인 하이브리드(PHEV) 중고차의 함정 — 집밥 충전기 없을 때의 실연비',
    category: 'eco',
    heroEmoji: '🔌',
    tags: ['PHEV', '플러그인하이브리드', '배터리방전', '충전기', '실연비'],
    description: 'PHEV(니로, 프리우스 프라임, BMW 530e 등)의 장단점, 무거운 배터리를 싣고 충전 없이 달릴 때의 연비 저하와 중고차 감가율을 분석합니다.',
    hook: '전기 모드로 40~50km를 갈 수 있다는 말에 혹해 아파트나 집에 충전 시설도 없이 PHEV를 샀다가는 일반 하이브리드보다 기름을 더 먹는 애물단지가 될 수 있습니다. PHEV 구매 전 반드시 짚어야 할 5가지를 정리합니다.',
    outline: [
      'PHEV의 구동 메커니즘: 10~15kWh 대용량 배터리 탑재로 전기차 + 하이브리드 듀얼 시스템 구현',
      '집밥(완속 충전기)이 없을 때의 비극: 충전 없이 가솔린 엔진만 돌리면 배터리 무게 200kg로 연비 10~15% 악화',
      '완속 충전 시간(2~4시간)과 아파트 완속 충전기 자리 경쟁의 현실적 스트레스',
      'PHEV 중고차의 높은 감가율 이유와 중고 매물 구매 시 고전압 배터리 보증 기간 확인법',
      'PHEV가 가장 완벽한 궁합을 발휘하는 오너 프로필: 왕복 출퇴근 40km 이내 + 단독주택/개인 충전기 보유자',
    ],
  },
  {
    slug: 'car-lease-vs-rent-vs-cash-purchase',
    title: '신차 구매 방법 3가지 비교 — 현금 일시불 vs 장기렌트 vs 리스 세무·비용 총정리',
    category: 'buying',
    heroEmoji: '📑',
    tags: ['신차구매', '장기렌트', '자동차리스', '일시불할부', '비용처리'],
    description: '개인 및 개인사업자, 법인 기준 종합소득세 감면 한도(연간 1,500만 원), 보험료 할증 여부, 신용점수 및 대출 한도 영향을 숫자로 비교합니다.',
    hook: '월 납입금만 보면 장기렌트나 리스가 훨씬 저렴해 보이지만, 4~5년 만기 시 총 납부 금액과 잔존 가치 인수금을 합치면 일시불보다 수백만 원 이상 비쌉니다. 내 상황에 가장 유리한 구매 방식을 선택하는 기준표를 제시합니다.',
    outline: [
      '구매 방식 3종 비교 요약: 현금 일시불(최저 총비용), 자동차 리스(일반 번호판), 장기렌트(하/허/호 번호판+보험 포함)',
      '사업자 절세 혜택 분석: 연간 1,500만 원(렌트/리스료 800만 + 유류/수리비 700만 원) 경비 처리 기준',
      '신용등급 및 대출 한도 영향: 금융 리스는 부채로 잡혀 DSR에 반영 vs 장기렌트는 임대 상품이라 대출 미포함',
      '사고 시 보험료 할증: 리스/일시불은 개인 보험 이력 할증 vs 장기렌트는 렌터카 공제회 처리로 할증 0원',
      '결론: 주행거리 많고 사고 잦은 초보·사업자는 장기렌트, 번호판 자존심은 리스, 총비용 절약은 일시불',
    ],
  },
  {
    slug: 'highway-hydroplaning-rainy-driving',
    title: '빗길 고속도로 수막현상(Hydroplaning) 위험 속도와 스핀 탈출 조향법',
    category: 'driving',
    heroEmoji: '🌧️',
    tags: ['빗길운전', '수막현상', '타이어배수홈', '안전운전', '트레드깊이'],
    description: '타이어 마모 한계선(1.6mm)에서 시속 70km만 넘어도 바퀴가 물 위에 뜨는 수막현상의 발생 메커니즘과 미끄러질 때 브레이크 금지 수칙을 다룹니다.',
    hook: '비 내리는 고속도로를 시속 100km로 달리다가 웅덩이를 밟는 순간 핸들이 헛돌며 차체가 물 위에 붕 뜨는 공포를 경험해 보셨나요? 이때 브레이크를 밟거나 핸들을 급하게 꺾으면 100% 가드레일로 스핀합니다.',
    outline: [
      '수막현상(Hydroplaning)의 물리적 원리: 타이어 그루브의 배수 용량을 초과하여 노면과 타이어 사이에 수막 형성',
      '위험 임계 속도와 타이어 트레드 깊이 상관관계: 신품(8mm, 100km/h 안전) vs 마모 타이어(2mm, 70km/h에서도 수막 발생)',
      '빗길 주행 시 감속 규정: 일반 강우 시 20% 감속(80km/h), 폭우 및 시정 100m 이하 시 50% 감속(50km/h)',
      '수막현상 발생 순간 대처 요령: 가속페달 오프 ➔ 브레이크 절대 조작 금지 ➔ 핸들 직진 방향 꽉 잡고 타력 주행',
      '차체자세제어장치(ESC/VDC)의 작동 한계와 빗길 타이어 공기압 +10% 상향 세팅의 과학적 이유',
    ],
  },
  {
    slug: 'electric-car-regenerative-braking-habits',
    title: '전기차 원페달 드라이빙 멀미 줄이고 브레이크 패드 녹 방지하는 세팅법',
    category: 'eco',
    heroEmoji: '🚗',
    tags: ['회생제동', '원페달드라이빙', '전기차멀미', '브레이크녹', 'i-Pedal'],
    description: '동승자 멀미를 유발하는 급격한 회생제동 감속 피칭(Pitching)을 줄이는 페달링 팁과 브레이크 패드 미사용으로 인한 고착·녹 방지 패드 클리닝 모드 활용법입니다.',
    hook: '전기차만 타면 아이들이 멀미를 하거나 뒷좌석 승객이 어지럼증을 호소하나요? 회생제동 단계를 무조건 최고(원페달)로 올려놓고 가속페달을 거칠게 뗐다 밟았다 하기 때문입니다. 부드러운 승차감과 전비를 동시에 잡는 법을 정리합니다.',
    outline: [
      '전기차 멀미의 주원인: 회생제동 시 발생하는 순간적인 전후 하중 이동(피칭 모션)과 승객 전정기관 자극',
      '스마트 회생제동(Auto 모드) 활용법: 전방 레이더와 내비게이션 지형 정보를 연동해 자동으로 감속 강도 조절',
      '패들 시프트 단수 조절 전략: 고속도로는 0~1단계 코스팅 주행, 시내 및 내리막은 2~3단계 적응형 감속',
      '브레이크 패드 녹 발생과 고착 이슈: 회생제동만 쓰다 보면 마찰 브레이크를 안 써서 디스크에 녹 누적',
      '브레이크 디스크 클리닝 모드 활성화법 및 주기적인 기계식 급제동으로 패드 길들이기 팁',
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

function getPublishedTitles() {
  if (!existsSync(CONTENT_DIR)) return [];
  return readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const text = readFileSync(join(CONTENT_DIR, file), 'utf8');
      const titleMatch = text.match(/title:\s*['"]?(.*?)['"]?\n/);
      return titleMatch ? titleMatch[1].trim() : file;
    });
}

async function selectNextTopic() {
  const published = getPublishedSlugs();
  const unposted = TOPICS.filter((t) => !published.has(t.slug));

  if (unposted.length > 0) {
    return { ...unposted[0], isFresh: true };
  }

  // All curated topics are posted -> Dynamically invent a 100% brand new unique topic via Gemini
  const dynamicTopic = await inventFreshTopicWithGemini();
  if (dynamicTopic) {
    return { ...dynamicTopic, isFresh: true };
  }

  // 예전에는 여기서 기존 슬러그에 타임스탬프를 붙이고 제목에 "— 실전 심층 분석"을
  // 덧붙여 발행했다. 그 결과로 같은 주제·같은 설명의 중복 글이 실제로 하나 올라갔다.
  // 중복을 만드느니 발행하지 않는 편이 낫다.
  throw new Error(
    '큐레이션 토픽을 모두 소진했고 새 주제 생성에도 실패했습니다. ' +
      'scripts/auto-publish.mjs 의 TOPICS 에 주제를 추가한 뒤 다시 실행하세요.',
  );
}

async function inventFreshTopicWithGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const existingTitles = getPublishedTitles().slice(0, 30);
  const prompt = `당신은 자동차 전문 블로그 '오토가이드'의 수석 에디터입니다.
현재 블로그에 이미 발행된 기존 글 제목 목록은 다음과 같습니다:
${existingTitles.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}

위 기존 글 목록과 절대 겹치지 않는, 독자들의 검색 수요가 매우 높은 **100% 새로운 자동차 정비/구매/전기차/운전 전문 주제 1개**를 기획하세요.
제목에 절대 '(2차 업데이트)'나 '(업데이트)' 같은 접미사를 붙이지 마세요.

반드시 다음 JSON 형식으로만 순수 JSON 객체(마크다운 코드블록 없이)를 출력하세요:
{
  "slug": "영문-케밥-케이스-슬러그",
  "title": "구체적인 문제와 해결책이 담긴 전문적인 글 제목",
  "category": "maintenance 또는 buying 또는 eco 또는 driving 중 택1",
  "heroEmoji": "주제에 맞는 이모지 1개",
  "tags": ["태그1", "태그2", "태그3", "태그4"],
  "description": "글 전체 핵심 내용을 2줄로 요약한 설명",
  "hook": "독자의 호기심을 자극하고 실전 문제 상황을 제시하는 강렬한 도입부 훅 문장 2줄",
  "outline": [
    "1번 소주제 및 상세 설명",
    "2번 소주제 및 상세 설명",
    "3번 소주제 및 상세 설명",
    "4번 소주제 및 상세 설명",
    "5번 소주제 및 상세 설명"
  ]
}`;

  const candidateModels = Array.from(
    new Set([GEMINI_MODEL, 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'])
  );

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawText.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/gi, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (!parsed?.title || !parsed?.slug || !parsed?.outline?.length) continue;

      // 지어낸 슬러그가 기존 글과 겹치면 그 글을 덮어써 버린다.
      // 제목이 거의 같은 경우도 사실상 중복 콘텐츠라 거른다.
      const published = getPublishedSlugs();
      if (published.has(parsed.slug)) {
        console.warn(`[gemini] 지어낸 슬러그가 기존 글과 충돌: ${parsed.slug} — 재시도`);
        continue;
      }
      const norm = (t) => t.replace(/[\s\-—·,.()]/g, '');
      const clash = getPublishedTitles().find((t) => norm(t) === norm(parsed.title));
      if (clash) {
        console.warn(`[gemini] 지어낸 제목이 기존 글과 동일: "${parsed.title}" — 재시도`);
        continue;
      }

      console.log(`[gemini] Dynamically invented fresh topic: "${parsed.title}"`);
      return parsed;
    } catch {
      continue;
    }
  }

  return null;
}

/* -------------------------------------------------------------- Gemini Generator */

/* -------------------------------------------------------------- Writing Patterns (10 Archetypes) */

const WRITING_PATTERNS = [
  {
    id: 'pattern_01_symptom_triage',
    name: '증상 → 원인 분기 진단형',
    categoryMatch: ['maintenance', 'driving'],
    instruction: `[구성: 증상 → 원인 분기 진단형]
- 운전자가 실제로 겪는 증상(소음, 경고등, 진동 등)을 구체적으로 묘사하며 시작하세요.
- 그 증상에서 갈라지는 원인 후보를 확률 순으로 나열하고, 각 후보를 배제하는 순서를 진단 트리처럼 제시하세요.
- 절대 필자 개인의 정비 경험담이나 일화를 지어내지 마세요.`,
  },
  {
    id: 'pattern_02_spec_reading',
    name: '규격·지침서 수치 판독형',
    categoryMatch: ['maintenance', 'eco'],
    instruction: `[구성: 규격·지침서 수치 판독형]
- 제조사 정비 지침서와 공개 규격에 명시된 수치(토크 Nm, 전압 V, 압력, 교환 주기)를 기준으로 시작하세요.
- 그 수치가 왜 그렇게 정해졌는지 공학적 근거를 설명하고, 규격을 벗어났을 때 나타나는 결과를 연결하세요.
- 개인 경험 서술 대신 "지침서 기준", "공개된 규격상" 같은 근거 표현을 쓰세요.`,
  },
  {
    id: 'pattern_03_cost_breakdown',
    name: '비용 구조 분해형',
    categoryMatch: ['buying', 'eco'],
    instruction: `[구성: 비용 구조 분해형]
- 총액이 아니라 부품비/공임/부대비용으로 쪼개서 어디서 금액 차이가 생기는지 보여주세요.
- 직영 서비스센터·협력점·사설 정비소의 가격 구조 차이와 그 이유를 설명하세요.
- 모든 금액은 "지역과 차종에 따라 달라지는 참고 범위"임을 명시하세요. 단정적 확정가로 쓰지 마세요.`,
  },
  {
    id: 'pattern_04_checklist_procedure',
    name: '순서형 실행 체크리스트',
    categoryMatch: ['buying', 'driving'],
    instruction: `[구성: 순서형 실행 체크리스트]
- 독자가 그대로 따라 할 수 있는 실행 순서를 1단계부터 번호로 제시하세요.
- 각 단계마다 "무엇을 보는가 / 정상 기준은 무엇인가 / 벗어나면 어떻게 하는가"를 붙이세요.
- 공식 조회 사이트에서 확인 가능한 항목은 어디서 확인하는지 명시하세요.`,
  },
  {
    id: 'pattern_05_myth_check',
    name: '통념 검증형',
    categoryMatch: ['driving', 'maintenance', 'eco'],
    instruction: `[구성: 통념 검증형]
- 널리 퍼진 속설을 먼저 제시하고, 어디까지가 사실이고 어디부터가 과장인지 나누세요.
- 공학적 원리와 공개된 시험·규격 자료를 근거로 판정하세요.
- "제가 측정해 보니" 같은 검증 불가능한 1인칭 근거를 쓰지 마세요.`,
  },
  {
    id: 'pattern_06_comparison_matrix',
    name: '선택지 비교 판단형',
    categoryMatch: ['buying', 'eco'],
    instruction: `[구성: 선택지 비교 판단형]
- 두세 개 선택지를 조건별로 비교하고, "어떤 조건의 사람에게 어느 쪽이 맞는지"로 결론을 내리세요.
- 손익분기점이 되는 주행거리·보유기간·연식을 숫자로 제시하세요.
- 한쪽을 일방적으로 추천하지 말고 전제 조건을 밝히세요.`,
  },
  {
    id: 'pattern_07_warranty_rights',
    name: '보증·제도 활용형',
    categoryMatch: ['maintenance', 'buying'],
    instruction: `[구성: 보증·제도 활용형]
- 제조사 보증, 리콜, 무상수리 캠페인, 성능점검 보증 등 독자가 쓸 수 있는 제도를 정리하세요.
- 각 제도의 대상 조건, 신청 창구, 기한을 명확히 구분하세요.
- 반드시 공식 조회처(자동차리콜센터 등)를 함께 안내하세요.`,
  },
  {
    id: 'pattern_08_seasonal_prep',
    name: '계절·상황별 대비형',
    categoryMatch: ['driving', 'maintenance'],
    instruction: `[구성: 계절·상황별 대비형]
- 특정 계절이나 상황(장거리, 폭염, 한파, 장마)에서 부하가 걸리는 계통을 짚으세요.
- 출발 전 점검 항목과 이상 시 판단 기준을 함께 제시하세요.
- 위험 상황에서의 대처 순서를 안전 우선으로 정리하세요.`,
  },
];

function selectWritingPattern(topic) {
  const matched = WRITING_PATTERNS.filter((p) => p.categoryMatch.includes(topic.category));
  const pool = matched.length > 0 ? matched : WRITING_PATTERNS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* -------------------------------------------------------------- Gemini Generator */

const GEMINI_SYSTEM_PROMPT = `당신은 자동차 정비·구매 정보를 다루는 매체 '오토가이드(AutoGuide)'의 리서치 에디터입니다.
제조사 정비 지침서, 공개 규격, 정부·공공기관 자료를 대조해 독자가 과잉 정비와 사기를 피하도록 돕는 것이 목적입니다.

[반드시 지킬 것]
1. 필자의 개인 정비 경력, 보유 자격증, 실명, 현장 일화를 절대 만들어내지 마세요.
   "제가 리프트에서 확인한", "15년 경력의", "지인이 찾아왔는데" 같은 검증 불가능한 1인칭 경험 서술을 쓰지 마세요.
   근거는 "제조사 정비 지침서 기준", "공개된 규격상", "공공기관 자료에 따르면" 형태로 제시하세요.
2. 금액은 확정가가 아니라 범위로 쓰고, 지역·정비소 유형·차종에 따라 달라진다는 점을 본문에서 밝히세요.
3. 확실하지 않은 수치·품번·TSB 번호는 지어내지 말고 생략하거나 "서비스센터에 차대번호로 확인" 으로 안내하세요.
4. 모든 글은 서로 다른 구성을 가져야 합니다. 아래 두 제목은 절대 쓰지 마세요.
   금지: "정비기능장의 한마디", "공임 및 부품 비용 비교 견적표", "정비 현장 핵심 점검 포인트"
5. 같은 문단이나 같은 불릿을 글 안에서 반복하지 마세요. 모든 섹션은 서로 다른 내용을 담아야 합니다.
6. 소제목 개수는 주제에 맞게 4~9개 사이에서 자유롭게 정하세요. 정해진 골격을 따르지 마세요.
7. 분량은 공백 포함 6,000~9,000자. 상위 노출 중인 경쟁 글이 2만 자 수준이므로 얕게 쓰면 묻힙니다.
   비용은 차급(경차/준중형/중형/대형)과 국산·수입으로 나눠 표로 제시하세요.
8. 프론트매터(--- 영역)는 출력하지 말고 본문부터 출력하세요. 마크다운 H2/H3, 표, 체크리스트를 활용하세요.
9. 문장은 존댓말(~합니다, ~하세요, ~됩니다)로 씁니다.`;

/**
 * 과부하(503)·쿼터(429) 응답은 잠깐 뒤 풀리는 경우가 많다.
 * 곧바로 다음 모델로 넘기면 멀쩡한 상위 모델을 놓친다.
 */
async function fetchWithRetry(url, init, retries = 1) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || attempt >= retries) return res;
    if (res.status !== 503 && res.status !== 429) return res;
    console.warn(`[gemini] HTTP ${res.status} — 20초 후 재시도 (${attempt + 1}/${retries})`);
    await new Promise((r) => setTimeout(r, 20_000));
  }
}

async function generateWithGemini(topic) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[gemini] GEMINI_API_KEY가 설정되지 않았습니다. 발행을 중단합니다.');
    return null;
  }

  const selectedPattern = selectWritingPattern(topic);
  console.log(`[pattern] 🎨 Selected writing pattern: "${selectedPattern.name}" (${selectedPattern.id})`);

  const prompt = `주제: ${topic.title}
카테고리: ${topic.category}
핵심 태그: ${topic.tags.join(', ')}
도입부 훅: ${topic.hook}

${selectedPattern.instruction}

개요 및 필수 포함 내용:
${topic.outline.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}

위 개요를 바탕으로 각 소주제마다 실무적인 진단 단계, 자가 점검법, 차급별 부품 견적 비교, 주의사항을 6,000자 ~ 9,000자로 작성해 주세요.`;

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
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${GEMINI_SYSTEM_PROMPT}\n\n${prompt}` }] }],
          // 한국어는 토큰 효율이 낮다. 9,000자 목표에 8192 토큰이면 MAX_TOKENS 로 잘린다.
          generationConfig: { temperature: 0.7, maxOutputTokens: 32768 },
        }),
        signal: AbortSignal.timeout(180_000),
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

      const cleaned = normalizeMarkdown(
        text
          .replace(/^```(?:markdown|md)?\s*\n?/i, '')
          .replace(/\n?```\s*$/i, '')
          .replace(/^---[\s\S]*?---\s*/, '')
          .trim()
      );

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

  console.warn('[gemini] 모든 모델 실패 — 발행하지 않습니다');
  return null;
}

function normalizeMarkdown(text) {
  return text
    // Fix **"text"** or **“text”** to “**text**” (so quotes don't break CommonMark bold parsing)
    .replace(/\*\*["“](.*?)[”"]\*\*/g, '“**$1**”')
    .replace(/\*\*['‘](.*?)[’']\*\*/g, '‘**$1**’')
    .replace(/\*\*\s*\*\*/g, '')
    // Fix accidental strikethrough caused by ~ used for ranges (e.g. 2~3칸, 10~20%)
    .replace(/(\d+)\s*~\s*(\d+)/g, '$1～$2')
    .replace(/~\s*(\d+)/g, '～$1');
}

/* --------------------------------------------------------------------------
 * 템플릿 폴백은 제거되었습니다 (2026-09-01).
 * 기존 renderTemplateBody()는 개요 한 줄과 동일 문단을 5회 반복하는 껍데기 글을
 * 생성해 사이트 전체 콘텐츠 품질을 떨어뜨렸습니다. Gemini 생성에 실패하면
 * 빈 글을 발행하는 대신 그냥 실패시킵니다.
 * -------------------------------------------------------------------------- */

function yamlString(str) {
  return `'${String(str ?? '').replace(/'/g, "''")}'`;
}

function yamlList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '[]';
  return `[${arr.map(yamlString).join(', ')}]`;
}

function getKstDateString() {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/** 비용 기준 시점. 독자가 언제 기준 금액인지 알아야 오래된 값을 그대로 믿지 않는다. */
const PRICE_BASIS = (() => {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
})();

/* -------------------------------------------------------------- 품질 게이트 */

/** 금지된 보일러플레이트 제목 — 과거 전 사이트에 복제되어 품질 문제를 일으킨 것들 */
const BANNED_HEADINGS = [
  '정비기능장의 한마디',
  '공임 및 부품 비용 비교 견적표',
  '정비 현장 핵심 점검 포인트',
];

/** 지어낸 1인칭 경력·자격 주장 */
const BANNED_CLAIMS = [
  '정비기능장',
  '김도현',
  '15년 경력',
  '15년 차',
  '제가 직접 확인',
  '리프트에 올리고',
];

/**
 * 발행 전 본문 검증. 문제가 있으면 사유 배열을 반환한다.
 * 과거 폴백 템플릿이 같은 문단을 5회 반복한 껍데기 글을 대량 발행했기 때문에
 * 중복 문단 검사를 가장 중요한 항목으로 둔다.
 */
function validateBody(body) {
  const problems = [];

  if (body.length < MIN_CHARS) {
    problems.push(`본문 길이 ${body.length}자로 최소 기준 ${MIN_CHARS}자 미달`);
  }

  for (const h of BANNED_HEADINGS) {
    if (body.includes(h)) problems.push(`금지된 보일러플레이트 제목 포함: "${h}"`);
  }

  for (const c of BANNED_CLAIMS) {
    if (body.includes(c)) problems.push(`검증 불가능한 경력·자격 주장 포함: "${c}"`);
  }

  // 같은 문단(40자 이상)이 2회 이상 반복되면 껍데기 글로 판정
  const paragraphs = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 40 && !l.startsWith('|') && !l.startsWith('#'));
  const counts = new Map();
  for (const p of paragraphs) counts.set(p, (counts.get(p) ?? 0) + 1);
  for (const [p, n] of counts) {
    if (n > 1) problems.push(`동일 문단 ${n}회 반복: "${p.slice(0, 40)}…"`);
  }

  // 고유 콘텐츠 비율 — 껍데기 글은 40%대로 떨어진다
  const uniqueRatio = new Set(paragraphs).size / Math.max(paragraphs.length, 1);
  if (paragraphs.length >= 5 && uniqueRatio < 0.9) {
    problems.push(`고유 문단 비율 ${Math.round(uniqueRatio * 100)}% — 반복 콘텐츠 과다`);
  }

  const headingCount = (body.match(/^## /gm) ?? []).length;
  if (headingCount < 3) problems.push(`H2 소제목 ${headingCount}개 — 구조 부실`);

  return problems;
}

/** 카테고리별 공식 확인처 — 독자가 직접 검증할 수 있는 창구만 넣는다 */
const OFFICIAL_SOURCES = {
  maintenance: [
    ['자동차리콜센터 — 차대번호로 미조치 리콜 조회', 'https://www.car.go.kr'],
    ['한국교통안전공단 — 자동차검사 및 정비 기준', 'https://www.kotsa.or.kr'],
    ['국가법령정보센터 — 자동차관리법 및 시행규칙', 'https://www.law.go.kr'],
  ],
  buying: [
    ['카히스토리(보험개발원) — 사고·침수 이력 조회', 'https://www.carhistory.or.kr'],
    ['자동차365 — 중고차 성능점검 및 매매 정보', 'https://www.car365.go.kr'],
    ['자동차민원 대국민포털 — 등록·이전 민원', 'https://www.ecar.go.kr'],
    ['위택스 — 자동차세·취득세 조회', 'https://www.wetax.go.kr'],
  ],
  eco: [
    ['무공해차 통합누리집 — 보조금·충전 인프라 정보', 'https://ev.or.kr'],
    ['자동차리콜센터 — 고전압 배터리 관련 리콜 조회', 'https://www.car.go.kr'],
    ['한국교통안전공단 — 친환경차 검사 기준', 'https://www.kotsa.or.kr'],
  ],
  driving: [
    ['한국교통안전공단 — 교통안전 및 운전 관련 기준', 'https://www.kotsa.or.kr'],
    ['국토교통부 — 도로·자동차 정책 자료', 'https://www.molit.go.kr'],
    ['자동차리콜센터 — 차량 결함 신고 및 조회', 'https://www.car.go.kr'],
  ],
};

function buildSourceSection(category) {
  const items = (OFFICIAL_SOURCES[category] ?? OFFICIAL_SOURCES.maintenance)
    .map(([label, url]) => `- [${label}](${url})`)
    .join('\n');
  return [
    '## 참고 · 직접 확인할 수 있는 공식 창구',
    '',
    `본문에 표기된 공임과 부품 비용은 ${PRICE_BASIS} 참고 범위이며, 지역과 정비소 유형(직영 서비스센터·협력점·사설), 차종·연식에 따라 크게 달라집니다. 실제 견적은 2곳 이상에서 받아 비교하시고, 수리 전에 아래 창구에서 리콜·무상수리 대상 여부를 먼저 조회해 보시기 바랍니다.`,
    '',
    items,
    '',
  ].join('\n');
}

/* -------------------------------------------------------------- Main Publisher */

async function main() {
  const topic = await selectNextTopic();
  console.log(`\n[auto-publish] Selected topic: ${topic.title} (${topic.slug})`);

  const body = await generateWithGemini(topic);

  if (!body) {
    throw new Error(
      'Gemini 생성에 실패했습니다. 템플릿 폴백은 껍데기 글을 만들어내므로 제거되었습니다. ' +
        'GEMINI_API_KEY 설정과 모델 응답을 확인한 뒤 다시 실행하세요.',
    );
  }

  const problems = validateBody(body);
  if (problems.length > 0) {
    console.error('[auto-publish] 품질 게이트 미통과 — 발행하지 않습니다:');
    for (const p of problems) console.error(`  - ${p}`);
    throw new Error(`품질 게이트 ${problems.length}건 위반`);
  }

  const today = getKstDateString();
  const frontmatter = `---
title: ${yamlString(topic.title)}
description: ${yamlString(topic.description)}
pubDate: ${today}
category: ${yamlString(topic.category)}
tags: ${yamlList(topic.tags)}
heroEmoji: ${yamlString(topic.heroEmoji)}
featured: false
---

`;

  const fullContent = frontmatter + body + '\n\n' + buildSourceSection(topic.category);
  const targetFile = join(CONTENT_DIR, `${topic.slug}.md`);

  writeFileSync(targetFile, fullContent, 'utf8');

  console.log(`[auto-publish] ✅ Successfully created: ${targetFile}`);
  console.log(`  Total chars: ${fullContent.length}`);
}

main().catch((err) => {
  console.error('[auto-publish] ❌ Error:', err);
  process.exitCode = 1;
});
