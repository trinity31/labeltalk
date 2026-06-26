#!/usr/bin/env node
// 이거먹어도돼? — GA4 일일 이벤트 통계 대시보드 생성 스크립트
//
// 하는 일:
//   1) Google Analytics Data API(GA4)로 지정한 날짜의 이벤트를 집계
//   2) 퍼널/이벤트/프로필 항목 분포를 계산
//   3) HTML 대시보드(analytics/dashboard.html)를 생성
//   4) analytics/history.json에 하루치 스냅샷을 누적(추세 그래프용)
//
// 필요한 환경변수 (labelmaster-app/.env 또는 셸 환경):
//   GA4_PROPERTY_ID               GA4 속성 ID(숫자). GA4 관리 > 속성 설정 > 속성 ID
//   GOOGLE_APPLICATION_CREDENTIALS 서비스 계정 키(JSON) 경로.
//                                 해당 서비스 계정 이메일을 GA4 속성 '액세스 관리'에 뷰어로 추가해야 함
//
// 사용:
//   node scripts/ga4-report.mjs              # 어제 하루
//   node scripts/ga4-report.mjs 2026-06-25   # 특정 날짜
//   node scripts/ga4-report.mjs 7daysAgo today  # 범위 직접 지정(GA4 상대표현 가능)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const OUT_DIR = join(APP_ROOT, 'analytics');

// --- .env 간단 로더 (dotenv 의존성 없이 KEY=VALUE만 읽어요) ---
function loadDotEnv() {
  const envPath = join(APP_ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
if (!PROPERTY_ID) {
  console.error('✗ GA4_PROPERTY_ID가 설정되지 않았습니다. .env에 GA4_PROPERTY_ID와 GOOGLE_APPLICATION_CREDENTIALS를 넣어주세요.');
  process.exit(1);
}

// --- 날짜 인자 파싱 (기본: 어제 하루) ---
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
const args = process.argv.slice(2);
const startDate = args[0] || yesterday();
const endDate = args[1] || startDate;

// 퍼널 정의 (이벤트 순서) — 단계별 전환을 한눈에 보기 위함
const FUNNEL = [
  { event: 'app_open', label: '앱 진입' },
  { event: 'intro_start', label: '시작하기' },
  { event: 'profile_saved', label: '프로필 저장' },
  { event: 'photo_pick', label: '사진 선택' },
  { event: 'analyze_done', label: '추출 성공' },
  { event: 'result_view', label: '결과 조회' },
  { event: 'share_clicked', label: '공유' },
];

const client = new BetaAnalyticsDataClient();
const property = `properties/${PROPERTY_ID}`;

// 1) 이벤트별 집계 (eventCount, totalUsers)
async function fetchEventTotals() {
  const [res] = await client.runReport({
    property,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 100,
  });
  const map = {};
  for (const row of res.rows ?? []) {
    map[row.dimensionValues[0].value] = {
      count: Number(row.metricValues[0].value),
      users: Number(row.metricValues[1].value),
    };
  }
  return map;
}

// 2) profile_item을 label 기준으로 분해 (커스텀 측정기준 customEvent:label/type 필요)
//    아직 등록 전이면 graceful하게 빈 배열로 처리해요.
async function fetchProfileItems() {
  try {
    const [res] = await client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'customEvent:type' }, { name: 'customEvent:label' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { value: 'profile_item' } },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 200,
    });
    return (res.rows ?? []).map((r) => ({
      type: r.dimensionValues[0].value,
      label: r.dimensionValues[1].value,
      count: Number(r.metricValues[0].value),
      users: Number(r.metricValues[1].value),
    }));
  } catch (err) {
    console.warn('⚠ profile_item 분해 실패(커스텀 측정기준 미등록일 수 있음):', err.message);
    return [];
  }
}

// --- HTML 렌더링 helpers ---
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function bar(value, max, color) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<div class="bar"><div class="fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function renderProfileTable(items, type, title, color) {
  const rows = items.filter((i) => i.type === type);
  if (rows.length === 0) return `<h3>${title}</h3><p class="muted">데이터 없음</p>`;
  const max = Math.max(...rows.map((r) => r.users));
  return `<h3>${title}</h3><table>${rows
    .map(
      (r) => `<tr><td class="name">${esc(r.label)}</td><td class="num">${r.users}</td>
      <td class="barcell">${bar(r.users, max, color)}</td></tr>`
    )
    .join('')}</table>`;
}

function renderHtml({ events, profileItems, trend }) {
  const get = (e) => events[e]?.count ?? 0;
  const getU = (e) => events[e]?.users ?? 0;
  const opens = getU('app_open') || 1;

  const funnelRows = FUNNEL.map((f) => {
    const u = getU(f.event);
    const pct = Math.round((u / opens) * 100);
    return `<tr><td class="name">${f.label}</td><td class="num">${u}</td>
      <td class="barcell">${bar(u, opens, '#1F8A5B')}</td><td class="num muted">${pct}%</td></tr>`;
  }).join('');

  // 전체 이벤트 표
  const allEvents = Object.entries(events).sort((a, b) => b[1].count - a[1].count);
  const maxEvt = allEvents.length ? allEvents[0][1].count : 1;
  const eventRows = allEvents
    .map(
      ([name, v]) =>
        `<tr><td class="name">${esc(name)}</td><td class="num">${v.count}</td><td class="num muted">${v.users}</td>
        <td class="barcell">${bar(v.count, maxEvt, '#3B82F6')}</td></tr>`
    )
    .join('');

  // 결과 verdict 분포 (result_view의 verdict는 별도 보고 필요 → 여기서는 핵심 KPI 카드만)
  const cards = [
    { k: '앱 진입(사용자)', v: getU('app_open') },
    { k: '프로필 저장', v: get('profile_saved') },
    { k: '추출 성공', v: get('analyze_done') },
    { k: '추출 실패', v: get('analyze_error') },
    { k: '자유 질문', v: get('custom_question') },
    { k: '공유', v: get('share_clicked') },
  ];

  // 추세 (최근 14일 app_open 사용자 + analyze_done)
  const last = trend.slice(-14);
  const trendMax = Math.max(1, ...last.map((d) => d.appOpenUsers));
  const trendRows = last
    .map(
      (d) =>
        `<tr><td class="name">${d.date}</td><td class="num">${d.appOpenUsers}</td><td class="num muted">${d.analyzeDone}</td>
        <td class="barcell">${bar(d.appOpenUsers, trendMax, '#1F8A5B')}</td></tr>`
    )
    .join('');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>이거먹어도돼? 통계 — ${startDate}${endDate !== startDate ? `~${endDate}` : ''}</title>
<style>
  :root{--ink:#1A1D1E;--muted:#8A9298;--line:#EAEEF0}
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;color:var(--ink);
    background:#F5F7F8;margin:0;padding:24px;line-height:1.5}
  .wrap{max-width:760px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:15px;margin:28px 0 10px;color:#1F8A5B}
  h3{font-size:13px;margin:16px 0 6px;color:#444}
  .date{color:var(--muted);font-size:13px;margin-bottom:20px}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}
  .card .k{font-size:12px;color:var(--muted)}
  .card .v{font-size:24px;font-weight:800;margin-top:4px}
  .panel{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:12px}
  table{width:100%;border-collapse:collapse}
  td{padding:6px 4px;font-size:13px;vertical-align:middle}
  td.name{white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
  td.num{text-align:right;font-variant-numeric:tabular-nums;width:56px;font-weight:600}
  td.muted,.muted{color:var(--muted);font-weight:400}
  td.barcell{width:45%;padding-left:12px}
  .bar{background:#EFF2F4;border-radius:6px;height:9px;overflow:hidden}
  .bar .fill{height:100%;border-radius:6px}
  .foot{color:var(--muted);font-size:12px;margin-top:24px;text-align:center}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:560px){.cards{grid-template-columns:repeat(2,1fr)}.cols{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
  <h1>📊 이거먹어도돼? 이벤트 통계</h1>
  <div class="date">${startDate}${endDate !== startDate ? ` ~ ${endDate}` : ''} 기준 · 생성 ${new Date().toLocaleString('ko-KR')}</div>

  <div class="cards">
    ${cards.map((c) => `<div class="card"><div class="k">${c.k}</div><div class="v">${c.v}</div></div>`).join('')}
  </div>

  <h2>퍼널 (앱 진입 사용자 대비 %)</h2>
  <div class="panel"><table>${funnelRows}</table></div>

  <h2>프로필 선택 항목 분포 (사용자 수)</h2>
  <div class="panel"><div class="cols">
    <div>${renderProfileTable(profileItems, 'allergy', '알레르기', '#E5793A')}</div>
    <div>${renderProfileTable(profileItems, 'restriction', '식이제한', '#1F8A5B')}
         ${renderProfileTable(profileItems, 'avoid', '직접 입력', '#8B5CF6')}</div>
  </div></div>

  <h2>전체 이벤트</h2>
  <div class="panel"><table>
    <tr><td class="name muted">이벤트</td><td class="num muted">횟수</td><td class="num muted">사용자</td><td></td></tr>
    ${eventRows}
  </table></div>

  <h2>추세 (최근 14일 · 앱 진입 사용자 / 추출 성공)</h2>
  <div class="panel"><table>${trendRows}</table></div>

  <div class="foot">GA4 property ${esc(PROPERTY_ID)} · Google Analytics Data API</div>
</div></body></html>`;
}

// --- 메인 ---
(async () => {
  console.log(`▶ GA4 통계 수집: ${startDate}${endDate !== startDate ? `~${endDate}` : ''} (property ${PROPERTY_ID})`);
  const [events, profileItems] = await Promise.all([fetchEventTotals(), fetchProfileItems()]);

  mkdirSync(OUT_DIR, { recursive: true });

  // 히스토리 누적 (날짜별 1건, 같은 날짜는 덮어써요)
  const histPath = join(OUT_DIR, 'history.json');
  let history = [];
  if (existsSync(histPath)) {
    try {
      history = JSON.parse(readFileSync(histPath, 'utf8'));
    } catch {
      history = [];
    }
  }
  const snapshot = {
    date: startDate,
    appOpenUsers: events.app_open?.users ?? 0,
    profileSaved: events.profile_saved?.count ?? 0,
    analyzeDone: events.analyze_done?.count ?? 0,
    analyzeError: events.analyze_error?.count ?? 0,
    shareClicked: events.share_clicked?.count ?? 0,
  };
  history = history.filter((h) => h.date !== startDate);
  history.push(snapshot);
  history.sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(histPath, JSON.stringify(history, null, 2));

  // HTML 대시보드
  const html = renderHtml({ events, profileItems, trend: history });
  const htmlPath = join(OUT_DIR, 'dashboard.html');
  writeFileSync(htmlPath, html);

  // 콘솔 요약
  console.log('  앱 진입 사용자:', snapshot.appOpenUsers);
  console.log('  프로필 저장   :', snapshot.profileSaved);
  console.log('  추출 성공/실패:', snapshot.analyzeDone, '/', snapshot.analyzeError);
  console.log('  공유          :', snapshot.shareClicked);
  console.log(`✓ 대시보드 생성: ${htmlPath}`);
})().catch((err) => {
  console.error('✗ 실패:', err.message);
  process.exit(1);
});
