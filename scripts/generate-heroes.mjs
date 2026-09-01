#!/usr/bin/env node
/**
 * 글마다 히어로 이미지와 오픈그래프 카드를 붙인다.
 *
 * 역할을 나눈 이유:
 *   heroImage — 글 상단과 목록 썸네일에 보이는 이미지. 사진이 있으면 사진을 쓴다.
 *   ogImage   — 카톡·X 공유 시 쓰이는 1200x630 카드. 제목이 박혀 있어 사진보다
 *               정보 전달이 되고, 다른 사이트와 겹치지 않는다.
 *
 * 사진은 Pexels 에서 받는다 (상업 이용 허용, 출처 표기 의무 없음).
 * 카테고리마다 사진 풀을 한 번에 받아 글마다 서로 다른 장을 배정한다.
 * 질의를 글마다 날리면 같은 카테고리 글이 전부 같은 사진을 받게 된다.
 *
 * 사용법:
 *   node scripts/generate-heroes.mjs           카드 생성 + (키 있으면) 사진 배정
 *   node scripts/generate-heroes.mjs --force   이미 카드만 있는 글에 사진을 다시 시도
 *   node scripts/generate-heroes.mjs --cards   사진을 건너뛰고 카드만
 *   node scripts/generate-heroes.mjs --dry     변경 없이 계획만 출력
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHeroCard } from './lib/hero-card.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');
const HERO_DIR = join(ROOT, 'public', 'images', 'heroes');
const HERO_URL = '/images/heroes';

const DRY = process.argv.includes('--dry');
const CARDS_ONLY = process.argv.includes('--cards');
const FORCE = process.argv.includes('--force');
const PEXELS_KEY = process.env.PEXELS_API_KEY;

/** 카테고리별 검색어. 여러 개를 합쳐 풀을 넓혀야 글마다 다른 사진이 배정된다. */
const QUERIES = {
  maintenance: [
    'car engine repair',
    'auto mechanic garage',
    'car maintenance tools',
    'car engine bay',
    'automotive workshop',
  ],
  buying: ['used car dealership', 'car showroom', 'buying a car keys'],
  eco: ['electric car charging', 'ev charging station', 'hybrid car'],
  driving: ['car driving highway', 'highway road car', 'driving steering wheel'],
};

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return { data, raw: m[1], body: text.slice(m[0].length) };
}

/** 카테고리 사진 풀. 여러 질의 결과를 합치고 photo.id 로 중복을 제거한다. */
async function fetchPool(category) {
  const seen = new Map();
  for (const q of QUERIES[category] ?? QUERIES.maintenance) {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&per_page=20`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_KEY },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Pexels HTTP ${res.status} (${q})`);
    const json = await res.json();
    for (const p of json?.photos ?? []) {
      // landscape 변형은 1200x627 이라 오픈그래프 규격에 맞고 용량도 작다
      const src = p.src?.landscape ?? p.src?.large;
      if (src && !seen.has(p.id)) {
        seen.set(p.id, { src, credit: `${p.photographer} / Pexels`, page: p.url });
      }
    }
  }
  return [...seen.values()];
}

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const yaml = (v) => `'${String(v).replace(/'/g, '')}'`;

if (!DRY && !existsSync(HERO_DIR)) mkdirSync(HERO_DIR, { recursive: true });

const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));

// 카테고리별로 글을 모아 사진을 겹치지 않게 나눠 준다
const posts = [];
for (const file of files) {
  const text = readFileSync(join(CONTENT_DIR, file), 'utf8');
  const fm = splitFrontmatter(text);
  if (!fm) continue;
  posts.push({ file, text, fm, slug: file.replace(/\.md$/, ''), category: fm.data.category ?? 'maintenance' });
}

const wantsPhoto = PEXELS_KEY && !CARDS_ONLY;
if (!wantsPhoto) {
  console.log('[hero] 사진을 건너뜁니다 (PEXELS_API_KEY 없음 또는 --cards). SVG 카드만 만듭니다.\n');
}

/** 카테고리 → 사진 배열 */
const pools = new Map();
if (wantsPhoto) {
  for (const category of new Set(posts.map((p) => p.category))) {
    try {
      const pool = await fetchPool(category);
      pools.set(category, pool);
      console.log(`[hero] ${category}: 사진 ${pool.length}장 확보`);
    } catch (err) {
      console.warn(`[hero] ${category}: 풀 확보 실패 (${err.message}) — 카드로 대체`);
      pools.set(category, []);
    }
  }
  console.log('');
}

let photos = 0;
let cards = 0;
let skipped = 0;
const cursor = new Map();

for (const p of posts) {
  const { slug, fm } = p;
  const { title, category = 'maintenance', heroEmoji = '🚗' } = fm.data;

  const hasPhoto = fm.data.heroImage && !fm.data.heroImage.endsWith('.svg');
  if (hasPhoto && !FORCE) {
    skipped++;
    continue;
  }

  // 오픈그래프 카드는 항상 만든다. 사진 유무와 무관하게 공유 이미지가 비지 않는다.
  const cardName = `${slug}-card.svg`;
  if (!DRY) writeFileSync(join(HERO_DIR, cardName), renderHeroCard({ title, category, emoji: heroEmoji }), 'utf8');
  const ogImage = `${HERO_URL}/${cardName}`;
  cards++;

  let heroImage = ogImage;
  let credit = null;

  const pool = pools.get(category) ?? [];
  const i = cursor.get(category) ?? 0;
  if (pool.length > 0) {
    const pick = pool[i % pool.length];
    cursor.set(category, i + 1);
    const name = `${slug}.jpg`;
    try {
      if (!DRY) await download(pick.src, join(HERO_DIR, name));
      heroImage = `${HERO_URL}/${name}`;
      credit = pick.credit;
      photos++;
    } catch (err) {
      console.warn(`[hero] ${slug}: 내려받기 실패 (${err.message}) — 카드 사용`);
    }
  }

  if (DRY) {
    console.log(`  ${slug}\n    hero: ${heroImage}${credit ? `  (${credit})` : ''}\n    og  : ${ogImage}`);
    continue;
  }

  // frontmatter 갱신 (기존 이미지 필드는 걷어내고 다시 쓴다)
  const kept = fm.raw
    .split('\n')
    .filter((l) => !/^(heroImage|heroImageCredit|ogImage):/.test(l))
    .join('\n');
  const added = [
    `heroImage: ${yaml(heroImage)}`,
    credit ? `heroImageCredit: ${yaml(credit)}` : null,
    `ogImage: ${yaml(ogImage)}`,
  ]
    .filter(Boolean)
    .join('\n');

  writeFileSync(join(CONTENT_DIR, p.file), `---\n${kept}\n${added}\n---\n${fm.body}`, 'utf8');
}

// 어느 글도 참조하지 않는 히어로 파일을 지운다.
// 파일명 규칙이 바뀌었을 때 옛 이미지가 저장소에 남는 것을 막는다.
let removed = 0;
if (!DRY) {
  const referenced = new Set();
  for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'))) {
    const fm = splitFrontmatter(readFileSync(join(CONTENT_DIR, file), 'utf8'));
    for (const key of ['heroImage', 'ogImage']) {
      const v = fm?.data?.[key];
      if (v?.startsWith(HERO_URL)) referenced.add(v.slice(HERO_URL.length + 1));
    }
  }
  for (const f of readdirSync(HERO_DIR)) {
    if (!referenced.has(f)) {
      unlinkSync(join(HERO_DIR, f));
      removed++;
    }
  }
}

console.log(
  DRY
    ? '\nDRY RUN — 파일 미변경'
    : `\n완료: 사진 ${photos}개 / 카드 ${cards}개 / 사진 이미 보유 ${skipped}개 / 미참조 정리 ${removed}개`,
);
