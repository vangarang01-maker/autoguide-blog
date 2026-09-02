/**
 * 자동차 매체 RSS 에서 주제 씨앗을 수확한다.
 *
 * 제목·링크·날짜만 가져오고 본문은 건드리지 않는다. 뉴스 본문을 긁어 글에 쓰면
 * 저작권 문제이고, 애초에 중복 콘텐츠라 우리가 지우고 있던 그 문제로 돌아간다.
 * 여기서 얻는 건 "지금 무엇이 이슈인가" 라는 신호뿐이고, 글은 새로 쓴다.
 *
 * 실측: 4개 매체 200건 중 정비·유지비 니치에 걸리는 건 10% 남짓이고,
 * 그중에도 대부분이 신제품 출시·수상 같은 홍보성이다. 그래서 필터가 두 겹이다.
 */

/** RSS 는 기계 소비를 전제로 공개된 창구다. robots.txt 는 /admin/ 만 차단한다. */
export const FEEDS = [
  { name: '모터그래프', url: 'https://www.motorgraph.com/rss/allArticle.xml' },
  { name: '오토헤럴드', url: 'https://www.autoherald.co.kr/rss/allArticle.xml' },
  { name: '지피코리아', url: 'https://www.gpkorea.com/rss/allArticle.xml' },
  { name: '모터매거진', url: 'https://www.motormag.co.kr/rss/allArticle.xml' },
];

/** 우리 블로그가 다루는 영역. 하나도 안 걸리면 볼 필요가 없다. */
const DOMAIN_TERMS = [
  '정비','수리','고장','결함','교체','점검','리콜','무상','보증','워런티',
  '비용','공임','유지비','수리비','부품','시세','감가','중고차',
  '연비','전비','충전','배터리','타이어','엔진','변속기','브레이크','오일',
  '소음','누유','진동','경고등','매연','배출가스','침수','사고',
  '보험','자동차세','취등록세','과태료','검사',
];

/**
 * 홍보성 기사 제외. 이런 제목은 독자가 검색할 문제를 담고 있지 않다.
 * (수상·출시·행사·인사·실적 발표 등)
 */
const PR_NOISE = [
  '어워드','수상','상 수상','금상','동상','대상','선정','1위 달성',
  '출시','공개','사전 계약','계약 돌파','판매 돌파','출고',
  '참가','참여','전시','모터쇼','부스','후원','협약','MOU','업무협약',
  '임명','선임','대표이사','사장','회장','인사',
  '실적','매출','영업이익','점유율','수출','생산 재개',
  '프로모션','이벤트','할인 행사','사은품','경품',
  '캠페인 전개','사회공헌','기부','봉사',
];

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

const pick = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : null;
};

/** 피드 하나를 읽어 { title, link, date, source } 목록으로 만든다 */
export async function fetchFeed(feed, { timeoutMs = 15_000 } = {}) {
  const res = await fetch(feed.url, {
    headers: { 'user-agent': 'AutoGuideTopicHarvester/1.0 (+https://autoguide-pro.com)' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => {
      const item = m[1];
      const title = pick(item, 'title');
      if (!title) return null;
      const raw = pick(item, 'pubDate');
      const d = raw ? new Date(raw) : null;
      return {
        title,
        link: pick(item, 'link'),
        date: d && !Number.isNaN(d.valueOf()) ? d.toISOString().slice(0, 10) : null,
        source: feed.name,
      };
    })
    .filter(Boolean);
}

/** 니치에 걸리고 홍보성이 아닌 제목만 남긴다 */
export function filterHeadlines(items) {
  return items
    .map((it) => {
      const matched = DOMAIN_TERMS.filter((t) => it.title.includes(t));
      const noise = PR_NOISE.filter((t) => it.title.includes(t));
      return { ...it, matched, noise };
    })
    .filter((it) => it.matched.length > 0 && it.noise.length === 0);
}

/**
 * 계절 씨앗. 뉴스는 주마다 수확량이 들쭉날쭉하지만 계절 수요는 확정적이다.
 * 발행 시점의 달을 기준으로 그 달과 다음 달 것을 함께 낸다.
 */
const SEASONAL = {
  1: ['한파 배터리 방전', '눈길 제동거리', '워셔액 결빙', '디젤 연료 왁싱'],
  2: ['해빙기 하체 부식', '염화칼슘 세차', '봄철 타이어 공기압'],
  3: ['황사 에어컨 필터', '겨울용 타이어 교체 시점', '냉각수 점검'],
  4: ['에어컨 가동 전 점검', '꽃가루 흡기 필터', '나들이 장거리 점검'],
  5: ['에어컨 냄새 에바 청소', '여름 전 배터리 수명', '타이어 마모 한계'],
  6: ['장마철 와이퍼·발수', '수막현상 대비', '침수 대비 주차'],
  7: ['폭염 냉각계통 과열', '에어컨 냉매 부족', '휴가 장거리 점검'],
  8: ['침수차 판별', '태풍 후 하체 점검', '냉각팬 고장'],
  9: ['추석 장거리 사전 점검', '겨울 대비 배터리 진단', '가을 우천 제동'],
  10: ['겨울용 타이어 준비', '히터·열선 점검', '단풍철 장거리'],
  11: ['한파 전 부동액 농도', '배터리 교체 적기', '결빙 대비 브레이크'],
  12: ['혹한기 시동 불량', '눈길 사고 보험 처리', '연말 자동차세 정산'],
};

export function seasonalSeeds(date = new Date()) {
  const m = date.getMonth() + 1;
  const next = (m % 12) + 1;
  return [
    ...(SEASONAL[m] ?? []).map((k) => ({ keyword: k, month: m, kind: 'season' })),
    ...(SEASONAL[next] ?? []).map((k) => ({ keyword: k, month: next, kind: 'season-next' })),
  ];
}
