#!/usr/bin/env node
/**
 * 글 안의 비용 표에서 SVG 차트를 만들어 본문에 삽입한다.
 *
 * 스톡 사진 대신 이 방식을 쓰는 이유:
 *  - 차트 수치가 본문 표에서 그대로 나오므로 내용과 어긋날 수 없다
 *  - 사이트 고유 이미지라 다른 사이트와 중복되지 않는다
 *  - 라이선스·API 키가 필요 없고 용량이 작다
 *
 * 사용법:
 *   node scripts/generate-diagrams.mjs           실제 생성
 *   node scripts/generate-diagrams.mjs --dry     생성될 목록만 출력
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTables, extractSeries, renderCostChart } from './lib/cost-chart.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');
const CHART_DIR = join(ROOT, 'public', 'images', 'charts');
const CHART_URL = '/images/charts';
const DRY = process.argv.includes('--dry');

/** 표 바로 앞의 소제목을 캡션으로 쓴다 */
function nearestHeading(lines, tableStart) {
  for (let i = tableStart - 1; i >= 0 && i > tableStart - 25; i--) {
    const m = lines[i].match(/^#{2,3}\s+(.+)$/);
    if (m) {
      return m[1]
        .replace(/^\[표\]\s*/, '')
        .replace(/^[\d.\s]+/, '')
        .replace(/[📊🔍💡👨‍🔧⚡🚗🔧]/gu, '')
        .trim();
    }
  }
  return null;
}

function buildCaption(series, heading) {
  if (series.rowTitle) return `${series.rowTitle} 비교`;
  if (!heading) return '정비 비용 비교';
  // 소제목이 이미 비교·비용을 말하고 있으면 접미사를 붙이지 않는다
  return /비교|비용|견적|요금/.test(heading) ? heading : `${heading} — 비용 비교`;
}

if (!DRY && !existsSync(CHART_DIR)) mkdirSync(CHART_DIR, { recursive: true });

let written = 0;
let touched = 0;

for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'))) {
  const path = join(CONTENT_DIR, file);
  const original = readFileSync(path, 'utf8');
  const slug = file.replace(/\.md$/, '');

  // 이미 차트가 삽입된 글은 건너뛴다 (재실행해도 중복 삽입되지 않는다)
  if (original.includes(`${CHART_URL}/${slug}-`)) continue;

  const lines = original.split('\n');
  const candidates = [];

  for (const table of parseTables(original)) {
    const series = extractSeries(table);
    if (!series) continue;
    // 값이 전부 0인 항목은 막대로 그려도 정보가 없다
    series.data = series.data.filter((d) => d.max > 0);
    if (series.data.length < 2) continue;
    candidates.push({ series, table });
  }

  if (candidates.length === 0) continue;

  // 뒤에서부터 삽입해야 앞쪽 행 번호가 밀리지 않는다
  const out = [...lines];
  candidates
    .slice()
    .reverse()
    .forEach((c, revIdx) => {
      const idx = candidates.length - 1 - revIdx;
      const name = `${slug}-${idx + 1}.svg`;
      const caption = buildCaption(c.series, nearestHeading(lines, c.table.start));
      const svg = renderCostChart({ data: c.series.data, caption });

      if (!DRY) {
        writeFileSync(join(CHART_DIR, name), svg, 'utf8');
        written++;
      } else {
        console.log(`  ${name}  ← ${caption} (${c.series.data.length}항목)`);
      }

      out.splice(c.table.end + 1, 0, '', `![${caption}](${CHART_URL}/${name})`);
    });

  if (!DRY) {
    writeFileSync(path, out.join('\n'), 'utf8');
  }
  touched++;
  if (DRY) console.log(`■ ${file}`);
}

console.log(
  DRY
    ? `\nDRY RUN — ${touched}개 글에 차트 삽입 예정`
    : `\n차트 ${written}개 생성, ${touched}개 글에 삽입 완료`,
);
