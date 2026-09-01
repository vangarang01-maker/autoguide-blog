/**
 * 글 안의 비용 표를 읽어 범위 막대 차트 SVG로 렌더한다.
 * 스톡 사진과 달리 글 자체 데이터에서 나오므로 본문 내용과 어긋날 수 없다.
 */

/** "15,000원 ～25,000원" → [15000, 25000] / "300만 원" → [3000000, 3000000] */
function parseAmounts(cell) {
  if (/\/\s*(L|kWh|km|월|년)/.test(cell)) return null; // 단가는 정비 비용이 아니다
  const found = [];
  const re = /([\d,]+(?:\.\d+)?)\s*(만\s*)?원/g;
  let m;
  while ((m = re.exec(cell)) !== null) {
    const n = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    found.push(m[2] ? n * 10000 : n);
  }
  if (found.length === 0) return null;
  return [Math.min(...found), Math.max(...found)];
}

/** 마크다운 표를 { header, rows, start, end } 로 파싱 */
export function parseTables(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  let cur = null;

  lines.forEach((line, i) => {
    if (/^\s*\|/.test(line)) {
      const cells = line
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split('|')
        .map((c) => c.trim());
      if (!cur) cur = { start: i, lines: [] };
      cur.lines.push(cells);
      cur.end = i;
    } else if (cur) {
      blocks.push(cur);
      cur = null;
    }
  });
  if (cur) blocks.push(cur);

  return blocks
    .filter((t) => t.lines.length >= 3)
    .map((t) => {
      const [header, sep, ...rows] = t.lines;
      if (!/^:?-{2,}:?$/.test((sep[0] ?? '').replace(/\s/g, ''))) return null;
      return { header, rows, start: t.start, end: t.end };
    })
    .filter(Boolean);
}

const stripMd = (s) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();

/**
 * 표에서 차트로 만들 계열을 뽑는다.
 * 행 방향(항목별 비용)과 열 방향(선택지별 총비용) 중 데이터가 많은 쪽을 택한다.
 */
export function extractSeries(table) {
  const { header, rows } = table;

  const isTotal = (label) => /총|합계|최종|소계|실구매|총액/.test(label);

  // 행 방향: 각 행의 첫 칸을 라벨로 두고, 그 행에서 가장 큰 금액 셀을 고른다.
  // 합계 행은 구성요소와 같은 축에 그리면 스케일을 왜곡하므로 제외한다.
  const byRow = [];
  for (const row of rows) {
    const label = stripMd(row[0] ?? '');
    if (!label || isTotal(label)) continue;
    let best = null;
    for (let c = 1; c < row.length; c++) {
      const amt = parseAmounts(row[c] ?? '');
      if (amt && (!best || amt[1] > best[1])) best = amt;
    }
    if (best) byRow.push({ label, min: best[0], max: best[1] });
  }

  // 열 방향: 합계 행을 찾아 열 헤더와 짝짓는다. 선택지끼리의 총액 비교가 된다.
  const byCol = [];
  const totalRow = rows.find((r) => isTotal(stripMd(r[0] ?? '')));
  if (totalRow) {
    for (let c = 1; c < totalRow.length; c++) {
      const amt = parseAmounts(totalRow[c] ?? '');
      const label = stripMd(header[c] ?? '');
      if (amt && label) byCol.push({ label, min: amt[0], max: amt[1] });
    }
  }

  // 총액 비교표가 있으면 그쪽이 독자에게 더 유용하다
  const useCol = byCol.length >= 2;
  const data = useCol ? byCol : byRow;

  // 노이즈 제거: 항목이 2개 미만이거나 금액이 너무 작으면 차트로 만들 가치가 없다
  if (data.length < 2) return null;
  if (Math.max(...data.map((d) => d.max)) < 10000) return null;

  return { data: data.slice(0, 8), rowTitle: useCol ? stripMd(totalRow[0]) : null };
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (n) =>
  n >= 10000
    ? `${(n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`
    : `${n.toLocaleString('ko-KR')}원`;

/** 범위 막대 차트 SVG. 뷰어 테마를 따라가도록 prefers-color-scheme 을 내장한다. */
export function renderCostChart({ data, caption }) {
  const W = 720;
  const padL = 190;
  const padR = 140;
  const padT = 54;
  const rowH = 42;
  const barH = 18;
  const H = padT + data.length * rowH + 26;
  const plotW = W - padL - padR;
  const maxV = Math.max(...data.map((d) => d.max));
  const x = (v) => padL + (v / maxV) * plotW;

  // 하한까지는 진한 막대, 하한~상한 구간은 옅은 막대로 그린다.
  // 범위로 표기된 비용을 확정가처럼 보이게 하지 않기 위함이다.
  const bars = data
    .map((d, i) => {
      const y = padT + i * rowH;
      const xMin = x(d.min);
      const xMax = x(d.max);
      const solidW = Math.max(xMin - padL, 2);
      const rangeW = Math.max(xMax - xMin, 0);
      // 괄호 보충 설명은 축 라벨에서 떼어낸다. 잘려서 "(재…" 로 끝나는 것보다 낫다.
      const base = d.label.replace(/\s*[(（].*$/, '').trim() || d.label;
      const label = base.length > 16 ? `${base.slice(0, 15)}…` : base;
      const value = d.min === d.max ? fmt(d.max) : `${fmt(d.min)}~${fmt(d.max)}`;
      const rangeRect =
        rangeW > 0
          ? `\n  <rect class="range" x="${xMin.toFixed(1)}" y="${y + 3}" width="${rangeW.toFixed(1)}" height="${barH}" rx="4"/>`
          : '';
      return `  <text class="lbl" x="${padL - 12}" y="${y + barH / 2 + 5}" text-anchor="end">${esc(label)}</text>
  <rect class="track" x="${padL}" y="${y + 3}" width="${plotW}" height="${barH}" rx="4"/>${rangeRect}
  <rect class="bar" x="${padL}" y="${y + 3}" width="${solidW.toFixed(1)}" height="${barH}" rx="4"/>
  <text class="val" x="${W - padR + 10}" y="${y + barH / 2 + 5}">${esc(value)}</text>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(caption)}">
  <style>
    .bg    { fill: #f8fafc; }
    .ttl   { fill: #0f172a; font: 600 15px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
    .lbl   { fill: #475569; font: 500 13px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
    .val   { fill: #0f172a; font: 600 12px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
    .track { fill: #e2e8f0; }
    .bar   { fill: #2563eb; }
    .range { fill: #2563eb; opacity: .32; }
    .note  { fill: #94a3b8; font: 400 11px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
    @media (prefers-color-scheme: dark) {
      .bg    { fill: #0f172a; }
      .ttl   { fill: #f1f5f9; }
      .lbl   { fill: #94a3b8; }
      .val   { fill: #f1f5f9; }
      .track { fill: #1e293b; }
      .bar   { fill: #60a5fa; }
      .range { fill: #60a5fa; opacity: .32; }
      .note  { fill: #64748b; }
    }
  </style>
  <rect class="bg" width="${W}" height="${H}" rx="10"/>
  <text class="ttl" x="24" y="30">${esc(caption)}</text>
${bars}
  <text class="note" x="24" y="${H - 10}">지역·정비소 유형·차종에 따라 달라지는 참고 범위입니다.</text>
</svg>
`;
}
