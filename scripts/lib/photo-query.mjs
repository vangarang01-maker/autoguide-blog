/**
 * 글 주제에 맞는 Pexels 검색어를 고른다.
 *
 * Pexels 는 한글 검색이 사실상 안 되므로 영어 질의가 필요하다.
 * 카테고리 단위로만 질의하면 정비 글 13편이 전부 같은 "엔진 정비" 사진을 받는다.
 * 태그와 제목에서 주제어를 찾아 그 부품·상황에 맞는 질의로 바꾼다.
 *
 * 슬러그별 하드코딩 대신 낱말 사전을 쓰는 이유: 새 글이 추가돼도 손댈 필요가 없다.
 */

/**
 * 한국어 주제어 → [영어 검색어, 특이도].
 *
 * 특이도 1 = 포괄어(중고차·하이브리드·배터리), 2 = 보통, 3 = 그 글에서만 나오는 말.
 * 위치만 보면 "중고차 침수차 구별법" 이 중고차 글로 잡힌다. 특이도를 먼저 본다.
 * 스톡 사진이 실제로 존재하는 수준의 일반성으로 잡는다.
 * (EGR 밸브·산소센서 같은 부품은 스톡 사진이 없어 상위 계통으로 올린다)
 */
const TERM_QUERIES = [
  // 제동·하체
  ['브레이크', 'car brake disc rotor', 2],
  ['패드', 'car brake disc rotor', 1],
  ['등속조인트', 'car wheel axle repair', 3],
  ['CV조인트', 'car wheel axle repair', 2],
  ['하체', 'car suspension underbody', 1],
  ['서스펜션', 'car suspension underbody', 1],
  ['타이어', 'car tire close up', 2],
  ['얼라인먼트', 'car tire wheel alignment', 3],

  // 조향
  ['MDPS', 'car steering wheel interior', 2],
  ['스티어링', 'car steering wheel interior', 1],
  ['에어백', 'car steering wheel interior', 2],
  ['클럭스프링', 'car steering wheel interior', 3],

  // 엔진·오일
  ['엔진오일', 'engine oil pouring change', 2],
  ['오일감소', 'engine oil dipstick check', 3],
  ['GDI', 'car engine bay closeup', 2],
  ['카본', 'car engine cleaning service', 1],
  ['점화플러그', 'spark plug engine', 2],
  ['피스톤', 'car engine bay closeup', 1],

  // 전장
  ['알터네이터', 'car alternator engine belt', 2],
  ['발전기', 'car alternator engine belt', 1],
  ['배터리', 'car battery jump start', 1],
  ['경고등', 'car dashboard warning light', 1],
  ['엔진경고등', 'car dashboard warning light', 2],

  // 배기·흡기
  ['촉매', 'car exhaust pipe underneath', 2],
  ['DPF', 'diesel exhaust smoke pipe', 2],
  ['매연', 'diesel exhaust smoke pipe', 1],
  ['EGR', 'car engine intake manifold', 2],
  ['산소센서', 'car exhaust pipe underneath', 2],
  ['배기가스', 'car exhaust pipe underneath', 1],

  // 냉각·공조
  ['라디에이터', 'car radiator cooling system', 2],
  ['냉각수', 'car radiator cooling system', 1],
  ['부동액', 'car radiator cooling system', 2],
  ['서모스탯', 'car radiator cooling system', 3],
  ['에어컨', 'car air conditioning vent interior', 2],
  ['에바포레이터', 'car air conditioning vent interior', 3],

  // 연료
  ['연료펌프', 'car refueling fuel pump', 2],
  ['연료필터', 'car refueling fuel pump', 2],

  // 구동
  ['DCT', 'car gear shift transmission', 2],
  ['변속기', 'car gear shift transmission', 1],
  ['클러치', 'car gear shift transmission', 1],

  // 친환경
  ['전기차', 'electric car charging station', 1],
  ['충전', 'electric car charging station', 1],
  ['하이브리드', 'hybrid car front view', 1],
  ['고전압', 'electric vehicle battery pack', 3],

  // 구매·서류
  ['침수', 'flooded car in water', 3],
  ['중고차', 'used car dealership lot', 1],
  ['성능점검', 'mechanic inspecting car', 3],
  ['차대번호', 'mechanic inspecting car', 3],
  ['보험', 'insurance document signing pen', 2],
  ['취등록세', 'car keys documents contract', 3],
  ['자동차세', 'car keys documents contract', 3],
  ['감가', 'used car dealership lot', 1],
  ['쏘나타', 'sedan car parked street', 2],
  ['K5', 'sedan car parked street', 2],
  ['그랜저', 'sedan car parked street', 2],
  ['아반떼', 'sedan car parked street', 2],
  ['싼타페', 'suv car parked outdoor', 2],
  ['SUV', 'suv car parked outdoor', 2],

  // 주행
  ['수막현상', 'car driving rain wet road', 3],
  ['빗길', 'car driving rain wet road', 2],
  ['연비', 'car dashboard speedometer', 1],
  ['주행습관', 'car driving highway road', 2],
];

/** 카테고리별 최후 보루 */
const CATEGORY_FALLBACK = {
  maintenance: 'car engine repair garage',
  buying: 'used car dealership lot',
  eco: 'electric car charging station',
  driving: 'car driving highway road',
};

/**
 * 여러 낱말이 걸릴 때 무엇이 그 글의 주제인지 고른다.
 *
 * 목록 순서나 태그 순서로 먼저 걸리는 것을 쓰면 엉뚱한 사진이 나온다.
 * 예: "연료펌프 … 수분 경고등 대처법" 은 연료펌프 글인데 경고등이 먼저 걸렸다.
 * 제목에 먼저 나오는 낱말일수록 그 글의 중심 소재라고 본다.
 */
export function photoQueryFor({ tags = [], title = '', category = 'maintenance' }) {
  let best = null;

  for (const [term, query, specificity = 2] of TERM_QUERIES) {
    const inTitle = title.indexOf(term);
    const tagIdx = tags.findIndex((t) => t.includes(term));
    if (inTitle === -1 && tagIdx === -1) continue;

    // 특이도가 가장 세다. 그다음 제목 등장 여부, 마지막으로 등장 위치.
    let score = specificity * 10_000;
    score += inTitle !== -1 ? 5_000 - inTitle : 1_000 - tagIdx;

    if (!best || score > best.score) best = { query, matched: term, score };
  }

  if (best) return { query: best.query, matched: best.matched };
  return { query: CATEGORY_FALLBACK[category] ?? CATEGORY_FALLBACK.maintenance, matched: null };
}
