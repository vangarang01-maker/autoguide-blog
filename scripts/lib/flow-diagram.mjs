/**
 * 코드블록 안에 ASCII 로 그려진 흐름도를 SVG 다이어그램으로 승격한다.
 *
 * 원문은 "[엔진 회전력] ➔ [겉벨트 구동] ➔ [로터 회전]" 같은 한 줄짜리 체인이다.
 * 코드블록 안 텍스트는 검색엔진이 본문만큼 취급하지 않고, 모바일에서 가로로
 * 넘쳐 읽기 어렵다. 같은 정보를 도해로 바꾸면 둘 다 해결된다.
 */

/** 화살표 토큰. 사이에 (설명) 이 끼어드는 형태까지 받는다. */
const ARROW = /\s*(?:[─-]{0,6}(?:\([^)]*\))?[─-]{0,6})?(?:➔|▶|—>|-->|─>|>)\s*/;
const ARROW_TEST = /(?:➔|▶|──>|───▶|──▶|-->)/;

/** 좌향 화살표 토큰. 스네이크형 흐름도(우->좌) 파싱에 사용 */
const LEFT_ARROW = /\s*(?:[─-]{0,6}(?:\([^)]*\))?[─-]{0,6})?(?:◀|◁|◀──|◀─|<--|<-)\s*/;
const LEFT_ARROW_TEST = /(?:◀|◁|◀──|◀─|<--)/;

function cleanNode(s) {
  return s
    .replace(/[[\]]/g, ' ')
    .replace(/^[\s└├─│*+-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 한 줄에서 노드 목록을 뽑는다. */
export function parseChain(line) {
  // 뒤에 붙은 부연(※ ...)은 도해에 넣지 않는다
  const body = line.replace(/\s*※.*$/, '').trim();
  if (!ARROW_TEST.test(body)) return null;

  const nodes = body
    .split(ARROW)
    .map(cleanNode)
    .filter((s) => s.length > 0 && s.length < 40);

  if (nodes.length < 2) return null;
  return nodes;
}

/** 좌향 화살표(A ◀── B ◀── C)를 올바른 순서(C -> B -> A)로 뒤집어 노드 목록을 뽑는다. */
export function parseReverseChain(line) {
  const body = line.replace(/\s*※.*$/, '').trim();
  if (!LEFT_ARROW_TEST.test(body)) return null;

  const nodes = body
    .split(LEFT_ARROW)
    .map(cleanNode)
    .filter((s) => s.length > 0 && s.length < 40);

  if (nodes.length < 2) return null;
  return nodes.reverse();
}

/**
 * 코드블록 본문에서 흐름 체인을 찾는다.
 * 단일 줄 체인, 줄바꿈 연속 체인, 그리고 2행 스네이크 체인(우향 -> 아래 -> 좌향)까지 결합하여 감지한다.
 */
export function findChains(blockLines) {
  // 1) 화살표로 시작하는 줄은 앞줄의 연속이므로 먼저 이어 붙인다
  const joined = [];
  blockLines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const prev = joined[joined.length - 1];
    if (/^\s*(?:➔|▶|──>|───▶|──▶)/.test(line) && prev) {
      prev.text += ` ${line.trim()}`;
      prev.lineIdxs.push(i);
    } else {
      joined.push({ text: line, lineIdxs: [i] });
    }
  });

  const out = [];
  let i = 0;
  while (i < joined.length) {
    const jItem = joined[i];
    const forwardNodes = parseChain(jItem.text);
    if (forwardNodes) {
      let combined = [...forwardNodes];
      let lineIdxs = [...jItem.lineIdxs];

      // 스네이크 체인 확인: 뒤따라오는 연결선(│ 등) 및 좌향 화살표(◀──) 줄 탐색
      let k = i + 1;
      const connectorIdxs = [];
      while (k < joined.length && (joined[k].text.trim() === '' || /^[\s│|↓]+$/.test(joined[k].text))) {
        if (/^[\s│|↓]+$/.test(joined[k].text)) connectorIdxs.push(...joined[k].lineIdxs);
        k++;
      }
      if (k < joined.length) {
        const revNodes = parseReverseChain(joined[k].text);
        if (revNodes) {
          combined.push(...revNodes);
          lineIdxs.push(...connectorIdxs, ...joined[k].lineIdxs);
          out.push({ nodes: combined, source: `${jItem.text} ${joined[k].text}`, lineIdxs });
          i = k + 1;
          continue;
        }
      }
      out.push({ nodes: combined, source: jItem.text, lineIdxs });
    }
    i++;
  }
  return out.filter((c) => c.nodes.length >= 3);
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 한글은 전각, 라틴/숫자는 좁다. 상자 폭을 정하는 데 쓴다. */
function textEm(s) {
  return [...s].reduce((w, ch) => {
    if (/[ㄱ-힝一-鿿]/.test(ch)) return w + 1;
    if (ch === ' ') return w + 0.3;
    if (/[A-Z]/.test(ch)) return w + 0.62;
    return w + 0.52;
  }, 0);
}

/** 상자 안에서 두 줄까지 줄바꿈 */
function wrapNode(text, budgetEm) {
  if (textEm(text) <= budgetEm) return [text];
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (textEm(next) > budgetEm && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= 2) return lines;
  // 세 줄 이상이면 두 줄로 줄이고 말줄임
  const merged = [lines[0], lines.slice(1).join(' ')];
  let tail = merged[1];
  while (textEm(`${tail}…`) > budgetEm && tail.length > 1) tail = tail.slice(0, -1);
  return [merged[0], `${tail}…`];
}

/**
 * 흐름도 SVG. 노드를 행마다 최대 3개씩 배치하고 행 끝에서 아래로 꺾는다.
 * 가로로 길게 늘어놓으면 모바일에서 글씨가 읽을 수 없게 작아진다.
 */
export function renderFlowDiagram({ nodes, caption }) {
  const W = 720;
  const perRow = nodes.length <= 4 ? Math.min(nodes.length, 2) : 3;
  const gapX = 26;
  const gapY = 30;
  const padX = 24;
  const boxW = Math.floor((W - padX * 2 - gapX * (perRow - 1)) / perRow);
  const fontPx = 13;
  const budgetEm = (boxW - 22) / fontPx;

  const wrapped = nodes.map((n) => wrapNode(n, budgetEm));
  const boxH = Math.max(...wrapped.map((l) => l.length)) * 19 + 22;

  const rows = Math.ceil(nodes.length / perRow);
  const padT = caption ? 50 : 20;
  const H = padT + rows * boxH + (rows - 1) * gapY + 18;

  const pos = nodes.map((_, i) => {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    // 홀수 행은 오른쪽에서 왼쪽으로 흘러야 화살표가 자연스럽게 이어진다
    const col = r % 2 === 0 ? c : perRow - 1 - c;
    return { x: padX + col * (boxW + gapX), y: padT + r * (boxH + gapY), r, c };
  });

  const boxes = nodes
    .map((_, i) => {
      const { x, y } = pos[i];
      const lines = wrapped[i];
      const firstY = y + boxH / 2 - ((lines.length - 1) * 19) / 2 + 5;
      const text = lines
        .map((l, k) => `    <tspan x="${x + boxW / 2}" y="${firstY + k * 19}">${esc(l)}</tspan>`)
        .join('\n');
      return `  <rect class="box" x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="8"/>
  <text class="nd" text-anchor="middle">
${text}
  </text>`;
    })
    .join('\n');

  const arrows = nodes
    .slice(0, -1)
    .map((_, i) => {
      const a = pos[i];
      const b = pos[i + 1];
      if (a.r === b.r) {
        // 같은 행: 진행 방향에 맞춰 가로 화살표
        const ltr = b.x > a.x;
        const x1 = ltr ? a.x + boxW + 5 : a.x - 5;
        const x2 = ltr ? b.x - 5 : b.x + boxW + 5;
        const y = a.y + boxH / 2;
        return `  <line class="arw" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-end="url(#ah)"/>`;
      }
      // 행이 바뀌면 같은 열에서 아래로 내려간다
      const x = a.x + boxW / 2;
      return `  <line class="arw" x1="${x}" y1="${a.y + boxH + 4}" x2="${x}" y2="${b.y - 5}" marker-end="url(#ah)"/>`;
    })
    .join('\n');

  const title = caption ? `  <text class="ttl" x="${padX}" y="30">${esc(caption)}</text>\n` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(caption || nodes.join(' 다음 '))}">
  <defs>
    <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path class="ahp" d="M 0 0 L 10 5 L 0 10 z"/>
    </marker>
  </defs>
  <style>
    .bg  { fill: #f8fafc; }
    .box { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.5; }
    .nd  { fill: #0f172a; font: 600 ${fontPx}px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
    .ttl { fill: #0f172a; font: 600 15px system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
    .arw { stroke: #2563eb; stroke-width: 2; }
    .ahp { fill: #2563eb; }
    @media (prefers-color-scheme: dark) {
      .bg  { fill: #0f172a; }
      .box { fill: #1e293b; stroke: #334155; }
      .nd  { fill: #f1f5f9; }
      .ttl { fill: #f1f5f9; }
      .arw { stroke: #60a5fa; }
      .ahp { fill: #60a5fa; }
    }
  </style>
  <rect class="bg" width="${W}" height="${H}" rx="10"/>
${title}${arrows}
${boxes}
</svg>
`;
}
