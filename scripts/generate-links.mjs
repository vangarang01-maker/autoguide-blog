#!/usr/bin/env node
/**
 * 글 사이에 문맥 내부링크를 건다.
 *
 * 하단 "함께 읽으면 좋은 글" 은 모든 글에 똑같이 붙는 템플릿 영역이라
 * 검색엔진이 보일러플레이트로 취급한다. 본문 안에서 실제로 그 주제를
 * 언급하는 자리에 거는 링크라야 값이 있다.
 *
 * 방식: 각 글의 제목·태그에서 앵커 후보를 뽑아 색인을 만들고,
 *       다른 글 본문에 그 말이 실제로 나오는 첫 자리에만 링크를 건다.
 *       억지로 채우지 않으므로 관련 없는 글에는 링크가 붙지 않는다.
 *
 * 사용법:
 *   node scripts/generate-links.mjs         삽입
 *   node scripts/generate-links.mjs --dry   계획만 출력
 *   node scripts/generate-links.mjs --reset 기존 자동 링크 제거
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');
const DRY = process.argv.includes('--dry');
const RESET = process.argv.includes('--reset');

/** 글 하나에 링크가 너무 많으면 읽기 방해가 되고 링크 가치도 희석된다 */
const MAX_LINKS_PER_POST = 6;

/** 앵커로 쓰기엔 너무 흔해서 엉뚱한 글로 보내는 말들 */
const STOPWORDS = new Set([
  '자동차', '차량', '정비', '엔진', '점검', '교체', '비용', '수리', '관리',
  '중고차', '주행', '소음', '증상', '진단', '가격', '공임', '부품',
  // 외부 서비스·기관명은 우리 글의 주제가 아니다
  '공임나라', '카히스토리', '블루핸즈', '오토큐', '엔카',
]);

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, raw: m[1], head: m[0], body: text.slice(m[0].length) };
}

function parseTags(raw = '') {
  const m = raw.match(/\[(.*)\]/);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((t) => t.replace(/['"]/g, '').trim())
    .filter(Boolean);
}

const posts = [];
for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'))) {
  const text = readFileSync(join(CONTENT_DIR, file), 'utf8');
  const fm = splitFrontmatter(text);
  if (!fm) continue;
  posts.push({
    file,
    slug: file.replace(/\.md$/, ''),
    title: (fm.data.title ?? '').replace(/^['"]|['"]$/g, ''),
    tags: parseTags(fm.data.tags),
    category: (fm.data.category ?? '').replace(/['"]/g, ''),
    fm,
  });
}

/* ---------------------------------------------------------- 리셋 */
if (RESET) {
  let n = 0;
  for (const p of posts) {
    const body = p.fm.body.replace(/\[([^\]]+)\]\(\/blog\/[^)]+\/\)/g, '$1');
    if (body !== p.fm.body) {
      writeFileSync(join(CONTENT_DIR, p.file), p.fm.head + body, 'utf8');
      n++;
    }
  }
  console.log(`자동 내부링크 제거: ${n}개 글`);
  process.exit(0);
}

/**
 * 앵커 색인. 태그가 가장 정확한 앵커다 — 글쓴이가 직접 고른 주제어이고
 * 본문에 그대로 등장할 가능성이 높다.
 */
const anchors = [];
for (const p of posts) {
  for (const tag of p.tags) {
    if (tag.length < 3 || STOPWORDS.has(tag)) continue;
    // 태그가 그 글 제목에도 나오면 실제 주제일 확률이 높다.
    // 곁다리 태그로 엉뚱한 글에 링크가 걸리는 것을 막는다.
    const onTopic = p.title.includes(tag);
    anchors.push({ term: tag, slug: p.slug, title: p.title, onTopic });
  }
}
// 주제 적합도 우선, 그다음 긴 앵커 우선("하이브리드배터리"가 "배터리"로 잘리지 않게)
anchors.sort((a, b) => Number(b.onTopic) - Number(a.onTopic) || b.term.length - a.term.length);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let linked = 0;
let touched = 0;

for (const p of posts) {
  let body = p.fm.body;
  const usedSlug = new Set();
  const usedTerm = new Set();
  const report = [];

  for (const a of anchors) {
    if (usedSlug.size >= MAX_LINKS_PER_POST) break;
    if (a.slug === p.slug || usedSlug.has(a.slug)) continue;
    // 같은 낱말이 글 안에서 서로 다른 글로 향하면 독자도 검색엔진도 혼란스럽다
    if (usedTerm.has(a.term)) continue;

    // 이미 링크된 텍스트, 제목, 표, 코드블록, 이미지 안은 건드리지 않는다
    const re = new RegExp(
      `(^|[^\\[\\w가-힣])(${esc(a.term)})(?![\\w가-힣])(?![^\\[]*\\])`,
      'm',
    );

    let replaced = false;
    body = body
      .split('\n')
      .map((line) => {
        if (replaced) return line;
        if (/^\s*(#|\||```|!\[|>)/.test(line)) return line;
        if (line.includes('](/blog/')) return line;
        if (!re.test(line)) return line;
        replaced = true;
        return line.replace(re, `$1[$2](/blog/${a.slug}/)`);
      })
      .join('\n');

    if (replaced) {
      usedSlug.add(a.slug);
      usedTerm.add(a.term);
      linked++;
      report.push(`${a.term} → ${a.slug}${a.onTopic ? '' : '  (곁다리 태그)'}`);
    }
  }

  if (report.length === 0) continue;
  touched++;

  if (DRY) {
    console.log(`■ ${p.file} (${report.length})`);
    for (const r of report) console.log(`   ${r}`);
  } else {
    writeFileSync(join(CONTENT_DIR, p.file), p.fm.head + body, 'utf8');
  }
}

console.log(
  DRY
    ? `\nDRY RUN — ${touched}개 글에 링크 ${linked}개 삽입 예정`
    : `\n내부링크 ${linked}개 삽입, ${touched}개 글 수정`,
);
