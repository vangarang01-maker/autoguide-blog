/** 사이트 전역 상수 — 브랜드, SEO, AdSense 설정 */

export const SITE_TITLE = 'AutoGuide';
export const SITE_TITLE_KO = '오토가이드';
export const SITE_TAGLINE = '스마트 모빌리티 & 실전 차량 관리 가이드';
export const SITE_DESCRIPTION =
  '오토가이드(AutoGuide)는 정비소 견적서와 제조사 정비지침서를 함께 읽어주는 실전 차량 정보 매체입니다. 신차·중고차 비교, DCT·하이브리드·GDI 정비, 취등록세 절약까지 현장에서 검증된 데이터로 정리합니다.';
export const SITE_URL = 'https://autoguide-pro.com';
export const SITE_LOCALE = 'ko_KR';
export const SITE_LANG = 'ko';

/** Google AdSense */
export const ADSENSE_PUB_ID = 'ca-pub-7683326491314783';
export const ADSENSE_CLIENT_NUMERIC = '7683326491314783';
export const ADSENSE_SCRIPT_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}`;

/** 운영자 / E-E-A-T
 *  검증할 수 없는 개인 자격·경력을 내세우지 않습니다.
 *  신뢰의 근거는 "누가 썼는가"가 아니라 "무엇을 근거로 썼고 어디서 확인할 수 있는가"에 둡니다. */
export const AUTHOR = {
  name: "오토가이드 편집팀",
  role: "자동차 정비·구매 정보 리서치",
  bio: "오토가이드는 제조사 정비 지침서, 공개 규격 자료, 국토교통부·한국교통안전공단·보험개발원 등 공공기관 자료를 대조해 정리하는 자동차 정보 매체입니다. 개별 차량을 직접 정비하거나 진단하지 않으며, 모든 글은 독자가 같은 자료를 직접 확인할 수 있도록 공식 조회 창구를 함께 안내합니다.",
  email: "contact@autoguide-pro.com",
  /** 자격증이 아니라 편집 원칙입니다. 독자가 검증할 수 있는 약속만 적습니다. */
  principles: [
    "모든 글에 공식 확인 창구를 함께 표기합니다",
    "공임·부품 비용은 확정가가 아닌 참고 범위로 표기합니다",
    "직접 검증하지 않은 정비 경험담은 쓰지 않습니다",
    "수리 전 리콜·무상수리 대상 여부 확인을 우선 안내합니다",
  ],
} as const;

/** 본 매체는 정비 자격 보유자가 운영하지 않습니다. 실제 정비 판단은 정비소 진단을 따르십시오. */
export const EDITORIAL_DISCLAIMER =
  "오토가이드의 콘텐츠는 공개된 정비 지침과 공공기관 자료를 정리한 참고 정보입니다. 개별 차량의 상태를 진단하거나 정비를 대신하지 않으며, 실제 수리 여부와 방법은 반드시 정비소의 직접 진단을 따르시기 바랍니다.";

export const CONTACT_EMAIL = 'contact@autoguide-pro.com';
export const FOUNDED_YEAR = 2024;

/** 카테고리 */
export const CATEGORIES = [
  {
    slug: 'maintenance',
    name: '정비 & 관리',
    description: '엔진오일, 변속기, 카본 클리닝까지 주기와 비용을 숫자로 정리합니다.',
    icon: '🔧',
    accent: 'from-cobalt-600 to-cobalt-500',
  },
  {
    slug: 'buying',
    name: '구매 & 시세',
    description: '중고차 점검표, 취등록세 계산, 부대비용 절약 전략을 다룹니다.',
    icon: '📋',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    slug: 'eco',
    name: '하이브리드 & EV',
    description: '배터리 수명, 실질 유지비, 전비/연비 관리 노하우를 비교합니다.',
    icon: '⚡',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    slug: 'driving',
    name: '실전 드라이빙',
    description: 'DCT 조작, 계절별 주행, 연비 주행법 등 운전 습관을 교정합니다.',
    icon: '🛣️',
    accent: 'from-violet-500 to-fuchsia-500',
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export const NAV_LINKS = [
  { href: '/', label: '홈' },
  { href: '/calculator', label: '🧮 자동차 계산기' },
  { href: '/blog', label: '전체 글' },
  { href: '/about', label: '소개' },
  { href: '/contact', label: '문의' },
  { href: '/privacy-policy', label: '개인정보처리방침' },
];

export function categoryOf(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug) ?? CATEGORIES[0];
}
