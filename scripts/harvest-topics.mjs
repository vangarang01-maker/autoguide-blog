#!/usr/bin/env node
/**
 * 주제 후보를 수확해 data/topic-candidates.json 에 쌓는다.
 *
 * 이 스크립트는 글을 발행하지 않는다. 후보만 만든다.
 * 뉴스에서 나온 주제는 특정 사건에 묶여 있거나 검증이 필요한 경우가 있어,
 * TOPICS 에 자동으로 밀어 넣지 않고 사람이 보고 옮기게 둔다.
 *
 * 사용법:
 *   node scripts/harvest-topics.mjs          수확 후 파일 갱신
 *   node scripts/harvest-topics.mjs --dry    파일을 쓰지 않고 결과만 출력
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEDS, fetchFeed, filterHeadlines, seasonalSeeds } from './lib/topic-harvest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');
const DATA_DIR = join(ROOT, 'data');
const OUT = join(DATA_DIR, 'topic-candidates.json');
const DRY = process.argv.includes('--dry');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

/** 이미 다루는 주제는 후보로 올릴 필요가 없다 */
function existingContext() {
  const titles = [];
  const slugs = new Set();
  for (const f of readdirSync(CONTENT_DIR).filter((x) => x.endsWith('.md'))) {
    slugs.add(f.replace(/\.md$/, ''));
    const m = readFileSync(join(CONTENT_DIR, f), 'utf8').match(/^title:\s*['"]?(.*?)['"]?\s*$/m);
    if (m) titles.push(m[1]);
  }
  const bank = readFileSync(join(ROOT, 'scripts', 'auto-publish.mjs'), 'utf8');
  for (const m of bank.matchAll(/^    slug: '([^']+)'/gm)) slugs.add(m[1]);
  return { titles, slugs };
}

/**
 * 뉴스 제목과 계절 키워드를 에버그린 주제로 바꾼다.
 *
 * 뉴스를 그대로 주제로 쓰면 특정 브랜드 사건 기사가 되어 금방 낡는다.
 * "르노 보증 연장 발표" 가 아니라 "제조사 보증 연장 제도 활용법" 이 되어야
 * 1년 뒤에도 검색되고, 우리가 검증할 수 있는 범위 안에 남는다.
 */
async function proposeTopics({ headlines, seasons, titles, slugs }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[harvest] GEMINI_API_KEY 없음 — 원자료만 저장하고 주제 제안은 건너뜁니다.');
    return [];
  }

  const prompt = `당신은 자동차 정보 매체 '오토가이드'의 콘텐츠 기획자입니다.

[최근 업계 뉴스 제목]
${headlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}

[이번 시즌 수요 키워드]
${seasons.map((s) => `- ${s.keyword}`).join('\n')}

[이미 발행한 글 제목]
${titles.slice(0, 40).map((t) => `- ${t}`).join('\n')}

위 자료를 참고해 새 글 주제를 최대 8개 제안하세요.

[반드시 지킬 것]
1. 뉴스를 그대로 옮기지 마세요. 특정 회사의 발표·사건 기사가 아니라,
   운전자가 1년 뒤에도 검색할 '문제 해결형' 주제로 바꾸세요.
   예: "르노 보증 연장 발표" → "제조사 보증 연장·무상수리 대상 확인하고 0원에 수리받는 법"
2. 이미 발행한 글과 주제가 겹치면 안 됩니다.
3. 정비·유지비·중고차·전기차·운전 중 하나에 속해야 합니다.
4. 검증할 수 없는 내부 정보나 특정 차량의 결함 단정은 주제로 삼지 마세요.
5. slug 는 영문 케밥 케이스로, 아래 목록과 겹치면 안 됩니다:
${[...slugs].slice(0, 60).join(', ')}

순수 JSON 배열만 출력하세요(코드블록 없이):
[{"slug":"...","title":"...","category":"maintenance|buying|eco|driving","heroEmoji":"...","tags":["..","..","..",".."],"description":"..","hook":"..","outline":["..","..","..","..",".."],"origin":"이 주제를 떠올린 근거 한 줄"}]`;

  for (const model of [GEMINI_MODEL, 'gemini-3.6-flash', 'gemini-3.5-flash']) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) {
        console.warn(`[harvest] ${model} HTTP ${res.status}`);
        continue;
      }
      const raw = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = JSON.parse(raw.replace(/```(?:json)?/gi, '').trim());
      if (!Array.isArray(parsed)) continue;

      const fresh = parsed.filter((t) => t?.slug && t?.title && !slugs.has(t.slug));
      console.log(`[harvest] ${model}: 주제 ${parsed.length}개 제안, 중복 제외 ${fresh.length}개`);
      return fresh;
    } catch (err) {
      console.warn(`[harvest] ${model} 실패: ${err.message}`);
    }
  }
  return [];
}

/* ------------------------------------------------------------------ 실행 */

const raw = [];
for (const feed of FEEDS) {
  try {
    const items = await fetchFeed(feed);
    raw.push(...items);
    console.log(`[harvest] ${feed.name}: ${items.length}건`);
  } catch (err) {
    console.warn(`[harvest] ${feed.name} 실패: ${err.message}`);
  }
}

const headlines = filterHeadlines(raw);
const seasons = seasonalSeeds();
console.log(`[harvest] 전체 ${raw.length}건 → 니치 관련 ${headlines.length}건 / 계절 키워드 ${seasons.length}개\n`);

const { titles, slugs } = existingContext();
const proposals = await proposeTopics({ headlines, seasons, titles, slugs });

// 이전 후보는 남겨 두고 새 것만 덧붙인다. 사람이 아직 못 본 후보가 사라지면 안 된다.
let prev = { candidates: [] };
if (existsSync(OUT)) {
  try {
    prev = JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    console.warn('[harvest] 기존 후보 파일을 읽지 못해 새로 만듭니다.');
  }
}
const known = new Set((prev.candidates ?? []).map((c) => c.slug));
const added = proposals.filter((p) => !known.has(p.slug));

const today = new Date().toISOString().slice(0, 10);
const out = {
  updatedAt: today,
  note: '자동 수확한 주제 후보. 검토 후 scripts/auto-publish.mjs 의 TOPICS 로 옮기세요. 발행에 직접 쓰이지 않습니다.',
  sources: FEEDS.map((f) => f.name),
  seasonal: seasons,
  headlines: headlines.slice(0, 30).map(({ title, link, date, source, matched }) => ({
    title, link, date, source, matched,
  })),
  candidates: [...(prev.candidates ?? []), ...added.map((a) => ({ ...a, harvestedAt: today }))],
};

if (DRY) {
  console.log(JSON.stringify({ ...out, headlines: out.headlines.slice(0, 5) }, null, 2));
  console.log(`\nDRY RUN — 신규 후보 ${added.length}개 (총 ${out.candidates.length}개)`);
} else {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`신규 후보 ${added.length}개 추가 (누적 ${out.candidates.length}개) → ${OUT}`);
}
