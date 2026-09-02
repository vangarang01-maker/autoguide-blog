/**
 * 글마다 og:image 로 쓸 히어로 카드 SVG를 만든다.
 *
 * 스톡 사진을 못 구했거나 주제에 맞는 사진이 없을 때의 기본값이다.
 * 1200x630 은 오픈그래프 권장 규격이라 카카오톡·페이스북·X 공유 시 잘리지 않는다.
 */

const PALETTE = {
  maintenance: { from: '#1d4ed8', to: '#3b82f6', name: '정비 & 관리' },
  buying: { from: '#b45309', to: '#f59e0b', name: '구매 & 시세' },
  eco: { from: '#047857', to: '#10b981', name: '하이브리드 & EV' },
  driving: { from: '#6d28d9', to: '#a855f7', name: '실전 드라이빙' },
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 글자당 대략적인 폭(em). 한글은 전각이라 1.0, 라틴/숫자는 그보다 훨씬 좁다.
 * 글자 수로만 끊으면 한글·영문이 섞인 제목에서 카드 밖으로 넘친다.
 */
function charEm(ch) {
  if (/[ㄱ-힝一-鿿　-〿＀-｠]/.test(ch)) return 1.0;
  if (ch === ' ') return 0.28;
  if (/[A-Z]/.test(ch)) return 0.64;
  if (/[a-z0-9]/.test(ch)) return 0.56;
  return 0.4;
}

const widthEm = (s) => [...s].reduce((sum, ch) => sum + charEm(ch), 0);

/** 제목을 카드 폭에 맞춰 줄바꿈한다 (budgetEm = 한 줄에 들어가는 em 폭) */
function wrapTitle(title, budgetEm = 17.6, maxLines = 4) {
  const words = title.split(/\s+/);
  const lines = [];
  let cur = '';

  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (widthEm(next) > budgetEm && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);

  // 마지막 줄이 잘렸으면 말줄임을 붙인다
  const rendered = lines.join(' ');
  if (rendered.length < title.length - 1) {
    let last = lines[lines.length - 1];
    while (widthEm(`${last}…`) > budgetEm && last.length > 1) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

export function renderHeroCard({ title, category, siteName = 'AutoGuide 오토가이드' }) {
  const W = 1200;
  const H = 630;
  const pal = PALETTE[category] ?? PALETTE.maintenance;
  const lines = wrapTitle(title);
  const lineH = 74;
  // 카테고리 라벨(y=196)과 하단 사이트명 사이 영역에 제목 블록을 중앙 정렬한다.
  // 고정 시작점을 쓰면 3줄짜리 제목이 위쪽 라벨을 덮는다.
  const startY = 380 - ((lines.length - 1) * lineH) / 2;

  // 카테고리 배지. 이모지 글리프를 쓰지 않는 이유:
  // og 카드는 sharp(librsvg)로 PNG 래스터화되는데, 컬러 이모지가 흑백 글리프로
  // 떨어져 그라디언트 위에 정체불명의 덩어리가 찍힌다. 폰트에 의존하지 않는
  // 도형+텍스트 배지가 어느 환경에서도 같은 결과를 낸다.
  const PILL_PAD = 26;
  const pillW = Math.round(widthEm(pal.name) * 26 + PILL_PAD * 2);

  const titleSvg = lines
    .map((l, i) => `  <text class="ttl" x="80" y="${startY + i * lineH}">${esc(l)}</text>`)
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pal.from}"/>
      <stop offset="100%" stop-color="${pal.to}"/>
    </linearGradient>
  </defs>
  <style>
    .ttl  { fill: #ffffff; font: 800 56px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
    .cat  { fill: ${pal.from}; font: 700 26px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
    .site { fill: #ffffff; font: 600 26px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; opacity: .82; }
  </style>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="1060" cy="120" r="220" fill="#ffffff" opacity=".07"/>
  <circle cx="1150" cy="560" r="160" fill="#ffffff" opacity=".05"/>
  <rect x="80" y="104" width="${pillW}" height="56" rx="28" fill="#ffffff" opacity=".94"/>
  <text class="cat" x="${80 + PILL_PAD}" y="141">${esc(pal.name)}</text>
${titleSvg}
  <rect x="80" y="${H - 108}" width="72" height="5" rx="2.5" fill="#ffffff" opacity=".55"/>
  <text class="site" x="80" y="${H - 56}">${esc(siteName)}</text>
</svg>
`;
}
