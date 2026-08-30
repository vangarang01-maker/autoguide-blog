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

/** 운영자 / E-E-A-T */
export const AUTHOR = {
  name: '김도현',
  role: '자동차 정비기능장 · 오토가이드 편집장',
  bio: '15년간 현대·기아 직영 서비스센터와 사설 정비소를 오가며 변속기·하이브리드 시스템 진단을 담당했습니다. 자동차정비기능장, 하이브리드 고전압 안전교육 이수. 정비 지침서와 실제 견적서를 함께 놓고 검증한 내용만 씁니다.',
  email: 'contact@autoguide-pro.com',
  credentials: [
    '자동차정비기능장 (한국산업인력공단)',
    '자동차진단평가사 2급',
    '고전압 배터리 취급 안전교육 이수',
    '누적 정비 상담 12,000건 이상',
  ],
};

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
