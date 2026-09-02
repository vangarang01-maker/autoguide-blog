#!/usr/bin/env node
/**
 * 이미 발행된 글의 본문을 지금 기준으로 다시 쓴다.
 *
 * 초기 글들은 분량 목표가 2,500~4,500자이던 시절에 쓰여 지금 기준(6,000~9,000자)에
 * 한참 못 미친다. 일부는 품질 게이트의 최소 5,000자도 통과하지 못한다.
 *
 * 슬러그를 TOPICS 에 되돌려 넣고 파일을 지워 재발행하는 방법도 있지만,
 * 그러면 실제 발행일과 배정된 사진까지 새로 잡힌다. 여기서는 frontmatter 를
 * 그대로 두고 본문만 교체한다. pubDate 는 처음 공개한 날이 맞고,
 * 사진은 이미 주제에 맞게 배정돼 있다.
 *
 * 사용법:
 *   node scripts/rewrite-article.mjs <slug> [slug...]
 *   node scripts/rewrite-article.mjs --under 6000     그 자수 미만 전부
 *   node scripts/rewrite-article.mjs --under 6000 --dry
 *   node scripts/rewrite-article.mjs --under 6000 --limit 3
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateWithGemini,
  validateBody,
  normalizeBody,
  buildSourceSection,
} from './auto-publish.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? Number(argv[i + 1]) : fallback;
};
const UNDER = argv.includes('--under') ? flag('--under', 6000) : null;
const LIMIT = flag('--limit', Infinity);
const slugArgs = argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, raw: m[1], body: text.slice(m[0].length) };
}

const unquote = (v = '') => v.replace(/^['"]|['"]$/g, '');
const parseTags = (raw = '') => {
  const m = raw.match(/\[(.*)\]/);
  return m ? m[1].split(',').map((t) => unquote(t.trim())).filter(Boolean) : [];
};

/**
 * 기존 글에서 생성기가 받는 topic 모양을 복원한다.
 * outline 은 본문의 H2 소제목에서 뽑는다 — 그 글이 실제로 다룬 범위라서,
 * 새로 써도 주제가 엉뚱한 데로 흐르지 않는다.
 */
function topicFromArticle(slug, fm) {
  const headings = [...fm.body.matchAll(/^##\s+(.+)$/gm)]
    .map((m) =>
      m[1]
        .replace(/^[\d.\s]+/, '')
        .replace(/[📊🔍💡👨‍🔧⚡🚗🔧]/gu, '')
        .trim(),
    )
    .filter((h) => h && !h.startsWith('참고 ·'));

  return {
    slug,
    title: unquote(fm.data.title ?? ''),
    category: unquote(fm.data.category ?? 'maintenance'),
    heroEmoji: unquote(fm.data.heroEmoji ?? '🚗'),
    tags: parseTags(fm.data.tags),
    description: unquote(fm.data.description ?? ''),
    hook: unquote(fm.data.description ?? ''),
    outline: headings.length >= 3 ? headings : ['원인', '증상 진단', '해결 방법', '비용 비교', '예방 관리'],
  };
}

/* ------------------------------------------------------------------ 대상 선정 */

const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
let targets = [];

for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  const text = readFileSync(join(CONTENT_DIR, file), 'utf8');
  const fm = splitFrontmatter(text);
  if (!fm) continue;
  if (slugArgs.length > 0 && !slugArgs.includes(slug)) continue;
  if (UNDER !== null && fm.body.length >= UNDER) continue;
  targets.push({ slug, file, fm, len: fm.body.length });
}

if (slugArgs.length > 0) {
  const missing = slugArgs.filter((s) => !targets.some((t) => t.slug === s));
  if (missing.length) console.warn(`[rewrite] 찾을 수 없는 슬러그: ${missing.join(', ')}`);
}

targets.sort((a, b) => a.len - b.len);         // 짧은 것부터
targets = targets.slice(0, LIMIT);

if (targets.length === 0) {
  console.log('[rewrite] 대상 없음');
  process.exit(0);
}

console.log(`[rewrite] 대상 ${targets.length}편`);
for (const t of targets) console.log(`  ${String(t.len).padStart(6)}자  ${t.slug}`);
console.log('');

if (DRY) {
  console.log('DRY RUN — 파일 미변경');
  process.exit(0);
}

/* ------------------------------------------------------------------ 재작성 */

let ok = 0;
const failed = [];

for (const t of targets) {
  const topic = topicFromArticle(t.slug, t.fm);
  console.log(`\n[rewrite] ${t.slug} (${t.len}자)`);

  let body;
  try {
    body = await generateWithGemini(topic);
  } catch (err) {
    failed.push(`${t.slug}: 생성 오류 ${err.message}`);
    continue;
  }
  if (!body) {
    failed.push(`${t.slug}: 생성 실패`);
    continue;
  }

  const clean = normalizeBody(body);
  const problems = validateBody(clean);
  if (problems.length > 0) {
    // 게이트를 통과 못 하면 기존 글을 그대로 둔다. 나쁜 글로 바꾸느니 짧은 채로 두는 게 낫다.
    console.warn(`[rewrite] 품질 게이트 미통과 — 원문 유지`);
    for (const p of problems) console.warn(`    - ${p}`);
    failed.push(`${t.slug}: 게이트 ${problems.length}건`);
    continue;
  }

  const next = `---\n${t.fm.raw}\n---\n\n${clean}\n\n${buildSourceSection(topic.category)}`;
  writeFileSync(join(CONTENT_DIR, t.file), next, 'utf8');
  ok++;
  console.log(`[rewrite] ✅ ${t.len}자 → ${clean.length}자`);
}

console.log(`\n재작성 ${ok}편 성공 / ${failed.length}편 실패`);
for (const f of failed) console.log(`  - ${f}`);
if (ok === 0) process.exitCode = 1;
