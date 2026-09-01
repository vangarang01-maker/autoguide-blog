#!/usr/bin/env node
/**
 * 글마다 히어로 이미지를 붙이고 frontmatter 에 heroImage 를 기록한다.
 *
 * 우선순위:
 *   1) PEXELS_API_KEY 가 있으면 Pexels 에서 주제 관련 사진을 받아 쓴다 (상업 이용 허용, 출처 표기 의무 없음)
 *   2) 없거나 적절한 사진이 없으면 SVG 히어로 카드를 만든다
 *
 * SVG 카드는 항상 만들어 두므로, 사진을 못 구해도 og:image 가 비지 않는다.
 *
 * 사용법:
 *   node scripts/generate-heroes.mjs          기본 (키 있으면 사진 시도)
 *   node scripts/generate-heroes.mjs --cards  사진을 건너뛰고 SVG 카드만
 *   node scripts/generate-heroes.mjs --dry    변경 없이 계획만 출력
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHeroCard } from './lib/hero-card.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');
const HERO_DIR = join(ROOT, 'public', 'images', 'heroes');
const HERO_URL = '/images/heroes';

const DRY = process.argv.includes('--dry');
const CARDS_ONLY = process.argv.includes('--cards');
const PEXELS_KEY = process.env.PEXELS_API_KEY;

/** frontmatter 를 { data, body, raw } 로 가른다 */
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const raw = m[1];
  const data = {};
  for (const line of raw.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return { data, raw, body: text.slice(m[0].length), head: m[0] };
}

/** Pexels 검색 → 가로형 사진 1장의 다운로드 URL */
async function findStockPhoto(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1`;
  const res = await fetch(url, {
    headers: { Authorization: PEXELS_KEY },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
  const json = await res.json();
  const photo = json?.photos?.[0];
  if (!photo) return null;
  return {
    src: photo.src?.large2x ?? photo.src?.large,
    credit: `${photo.photographer} / Pexels`,
    page: photo.url,
  };
}

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

if (!DRY && !existsSync(HERO_DIR)) mkdirSync(HERO_DIR, { recursive: true });

if (!PEXELS_KEY && !CARDS_ONLY) {
  console.log('[hero] PEXELS_API_KEY 가 없습니다. SVG 카드만 생성합니다.');
  console.log('[hero] 사진을 쓰려면 https://www.pexels.com/api/ 에서 무료 키를 발급해 환경변수로 넣으세요.\n');
}

let cards = 0;
let photos = 0;
let skipped = 0;

for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'))) {
  const path = join(CONTENT_DIR, file);
  const text = readFileSync(path, 'utf8');
  const fm = splitFrontmatter(text);
  if (!fm) continue;
  if (fm.data.heroImage) {
    skipped++;
    continue;
  }

  const slug = file.replace(/\.md$/, '');
  const { title, category = 'maintenance', heroEmoji = '🚗', tags = '' } = fm.data;

  let heroPath = null;
  let credit = null;

  // 1) 스톡 사진 시도
  if (PEXELS_KEY && !CARDS_ONLY) {
    // 한글 태그는 Pexels 검색이 안 되므로 카테고리 기반 영어 질의를 쓴다
    const query = {
      maintenance: 'car engine repair garage',
      buying: 'used car dealership',
      eco: 'electric car charging',
      driving: 'car driving highway',
    }[category] ?? 'car maintenance';

    try {
      const found = await findStockPhoto(query);
      if (found) {
        const name = `${slug}.jpg`;
        if (!DRY) await download(found.src, join(HERO_DIR, name));
        heroPath = `${HERO_URL}/${name}`;
        credit = found.credit;
        photos++;
      }
    } catch (err) {
      console.warn(`[hero] ${slug}: 사진 실패 (${err.message}) — 카드로 대체`);
    }
  }

  // 2) SVG 카드 (사진이 없을 때)
  if (!heroPath) {
    const name = `${slug}.svg`;
    const svg = renderHeroCard({ title, category, emoji: heroEmoji });
    if (!DRY) writeFileSync(join(HERO_DIR, name), svg, 'utf8');
    heroPath = `${HERO_URL}/${name}`;
    cards++;
  }

  if (DRY) {
    console.log(`  ${slug} → ${heroPath}${credit ? `  (${credit})` : ''}`);
    continue;
  }

  // frontmatter 에 heroImage 기록 (닫는 --- 바로 앞에 삽입)
  const insert = credit
    ? `heroImage: '${heroPath}'\nheroImageCredit: '${credit.replace(/'/g, '')}'\n`
    : `heroImage: '${heroPath}'\n`;
  writeFileSync(path, `---\n${fm.raw}\n${insert}---\n${fm.body}`, 'utf8');
}

console.log(
  DRY
    ? '\nDRY RUN — 파일 미변경'
    : `\n히어로 완료: 사진 ${photos}개 / SVG 카드 ${cards}개 / 이미 보유 ${skipped}개`,
);
