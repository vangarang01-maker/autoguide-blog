#!/usr/bin/env node
/**
 * 글마다 히어로 이미지와 오픈그래프 카드를 붙인다.
 *
 * 역할을 나눈 이유:
 *   heroImage — 글 상단과 목록 썸네일에 보이는 이미지. 사진이 있으면 사진을 쓴다.
 *   ogImage   — 카톡·X 공유 시 쓰이는 1200x630 카드. 제목이 박혀 있어 사진보다
 *               정보 전달이 되고, 다른 사이트와 겹치지 않는다.
 *
 * 카드는 SVG 로 그린 뒤 PNG 로 구워 내보낸다. 카카오톡·페이스북·X 크롤러는
 * SVG og:image 를 렌더링하지 않아 공유 카드가 빈칸으로 나온다.
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
import sharp from 'sharp';
import { renderHeroCard } from './lib/hero-card.mjs';
import { photoQueryFor } from './lib/photo-query.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');
const HERO_DIR = join(ROOT, 'public', 'images', 'heroes');
const HERO_URL = '/images/heroes';

/** 오픈그래프 권장 규격. density 를 올려 텍스트 가장자리를 또렷하게 굽는다. */
const CARD_W = 1200;
const CARD_H = 630;
const CARD_DENSITY = 144;

/** 카드로 구워진 파일인지. 사진과 카드를 파일명으로 구분한다. */
const isCard = (url) => /-card\.(png|svg)$/i.test(url ?? '');

const DRY = process.argv.includes('--dry');
const CARDS_ONLY = process.argv.includes('--cards');
const FORCE = process.argv.includes('--force');
const PEXELS_KEY = process.env.PEXELS_API_KEY;

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

/** 질의 하나에 대한 사진 후보. 같은 질의는 한 번만 받아 재사용한다. */
const poolCache = new Map();

async function fetchPool(query) {
  if (poolCache.has(query)) return poolCache.get(query);
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=30`;
  const res = await fetch(url, {
    headers: { Authorization: PEXELS_KEY },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status} (${query})`);
  const json = await res.json();
  const pool = (json?.photos ?? [])
    // landscape 변형은 1200x627 이라 오픈그래프 규격에 맞고 용량도 작다
    .map((p) => ({ id: String(p.id), src: p.src?.landscape ?? p.src?.large, credit: `${p.photographer} / Pexels`, page: p.url }))
    .filter((p) => p.src);
  poolCache.set(query, pool);
  return pool;
}

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const yaml = (v) => `'${String(v).replace(/'/g, '')}'`;

if (!DRY && !existsSync(HERO_DIR)) mkdirSync(HERO_DIR, { recursive: true });

const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));

function parseTags(raw = '') {
  const m = raw.match(/\[(.*)\]/);
  return m ? m[1].split(',').map((t) => t.replace(/['"]/g, '').trim()).filter(Boolean) : [];
}

const posts = [];
for (const file of files) {
  const text = readFileSync(join(CONTENT_DIR, file), 'utf8');
  const fm = splitFrontmatter(text);
  if (!fm) continue;
  const category = fm.data.category ?? 'maintenance';
  const { query, matched } = photoQueryFor({
    tags: parseTags(fm.data.tags),
    title: fm.data.title ?? '',
    category,
  });
  posts.push({ file, text, fm, slug: file.replace(/\.md$/, ''), category, query, matched });
}

const wantsPhoto = PEXELS_KEY && !CARDS_ONLY;
if (!wantsPhoto) {
  console.log('[hero] 사진을 건너뜁니다 (PEXELS_API_KEY 없음 또는 --cards). 공유 카드만 만듭니다.\n');
}

let photos = 0;
let cards = 0;
let skipped = 0;

/** 이미 배정된 Pexels 사진 ID. 실행을 나눠 돌려도 같은 사진이 두 번 쓰이지 않는다. */
const takenIds = new Set();
if (!FORCE) {
  for (const p of posts) {
    if (p.fm.data.heroImageId) takenIds.add(p.fm.data.heroImageId);
  }
}

for (const p of posts) {
  const { slug, fm } = p;
  const { title, category = 'maintenance' } = fm.data;

  // 카드는 사진 유무와 무관하게 매번 다시 굽는다. 제목이 바뀌면 카드도 따라가야 하고,
  // 사진을 이미 가진 글에도 제목이 박힌 공유 카드는 필요하다.
  const cardName = `${slug}-card.png`;
  const ogImage = `${HERO_URL}/${cardName}`;
  if (!DRY) {
    await sharp(Buffer.from(renderHeroCard({ title, category })), { density: CARD_DENSITY })
      .resize(CARD_W, CARD_H, { fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toFile(join(HERO_DIR, cardName));
  }
  cards++;

  let heroImage = ogImage;
  let credit = null;
  let photoId = null;

  // 이미 사진이 붙은 글은 사진을 건드리지 않는다. 카드와 frontmatter 만 갱신한다.
  const hasPhoto = fm.data.heroImage && !isCard(fm.data.heroImage);
  if (hasPhoto && !FORCE) {
    heroImage = fm.data.heroImage;
    credit = fm.data.heroImageCredit ?? null;
    photoId = fm.data.heroImageId ?? null;
    skipped++;
  }

  let pool = [];
  if (wantsPhoto && !(hasPhoto && !FORCE)) {
    try {
      pool = await fetchPool(p.query);
    } catch (err) {
      console.warn(`[hero] ${slug}: 사진 검색 실패 (${err.message}) — 카드 사용`);
    }
  }
  const pick = pool.find((ph) => !takenIds.has(ph.id));
  if (pick) {
    takenIds.add(pick.id);
    const name = `${slug}.jpg`;
    try {
      if (!DRY) await download(pick.src, join(HERO_DIR, name));
      heroImage = `${HERO_URL}/${name}`;
      credit = pick.credit;
      photoId = pick.id;
      photos++;
      console.log(`[hero] ${slug}  ← "${p.query}"${p.matched ? ` (${p.matched})` : ' (카테고리 기본)'}`);
    } catch (err) {
      console.warn(`[hero] ${slug}: 내려받기 실패 (${err.message}) — 카드 사용`);
    }
  } else if (pool.length > 0) {
    console.warn(`[hero] ${slug}: "${p.query}" 결과 ${pool.length}장이 모두 이미 쓰임 — 카드 사용`);
  }

  if (DRY) {
    console.log(`  ${slug}\n    hero: ${heroImage}${credit ? `  (${credit})` : ''}\n    og  : ${ogImage}`);
    continue;
  }

  // frontmatter 갱신 (기존 이미지 필드는 걷어내고 다시 쓴다)
  const kept = fm.raw
    .split('\n')
    .filter((l) => !/^(heroImage|heroImageCredit|heroImageId|ogImage):/.test(l))
    .join('\n');
  const added = [
    `heroImage: ${yaml(heroImage)}`,
    credit ? `heroImageCredit: ${yaml(credit)}` : null,
    photoId ? `heroImageId: ${yaml(photoId)}` : null,
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
