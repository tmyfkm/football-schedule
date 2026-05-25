// scripts/fetch_matches.js
// RapidAPI → クラブ試合データ（メイン）
// football-data.org → ① エンブレム補完 ② 代表戦日程 ③ クラブリーグのフォールバック
// 実行: RAPIDAPI_KEY=xxx FOOTBALLDATA_KEY=xxx node scripts/fetch_matches.js

'use strict';
const fs = require('fs');

const RAPID_KEY        = process.env.RAPIDAPI_KEY;
const RAPID_HOST       = 'free-api-live-football-data.p.rapidapi.com';
const BASE_URL         = `https://${RAPID_HOST}`;
const FOOTBALLDATA_KEY = process.env.FOOTBALLDATA_KEY;

if (!RAPID_KEY) {
  console.error('❌ 環境変数 RAPIDAPI_KEY が未設定');
  process.exit(1);
}
if (!FOOTBALLDATA_KEY) {
  console.warn('⚠️  FOOTBALLDATA_KEY が未設定。エンブレム補完・代表戦・フォールバック取得はスキップします。');
}

// ────────────────────────────────────────────────
// RapidAPI クラブリーグ設定
// ────────────────────────────────────────────────
const RAPID_LEAGUES = [
  { id: 1,     key: 'EPL',               lClass: 'l-epl',      tab: 'europe', gender: 'male'   },
  { id: 2,     key: 'LaLiga',            lClass: 'l-laliga',   tab: 'europe', gender: 'male'   },
  { id: 3,     key: 'Bundesliga',        lClass: 'l-bund',     tab: 'europe', gender: 'male'   },
  { id: 4,     key: 'Serie A',           lClass: 'l-serie',    tab: 'europe', gender: 'male'   },
  { id: 5,     key: 'Ligue 1',           lClass: 'l-ligue',    tab: 'europe', gender: 'male'   },
  { id: 7,     key: 'Eredivisie',        lClass: 'l-erediv',   tab: 'europe', gender: 'male'   },
  { id: 8,     key: 'Liga Portugal',     lClass: 'l-ligap',    tab: 'europe', gender: 'male'   },
  { id: 9,     key: 'Scottish Prem',     lClass: 'l-spl',      tab: 'europe', gender: 'male'   },
  { id: 10,    key: 'Championship',      lClass: 'l-champ2',   tab: 'europe', gender: 'male'   },
  { id: 40,    key: 'Belgian Pro League',lClass: 'l-belgique', tab: 'europe', gender: 'male'   },
  { id: 6,     key: 'Super Lig',         lClass: 'l-champ2',   tab: 'europe', gender: 'male'   },
  { id: 42,    key: 'Champions League',  lClass: 'l-champ',    tab: 'europe', gender: 'male'   },
  { id: 73,    key: 'Europa League',     lClass: 'l-uel',      tab: 'europe', gender: 'male'   },
  { id: 10216, key: 'Conference League', lClass: 'l-uel',      tab: 'europe', gender: 'male'   },
  { id: 9375,  key: 'Women Champions League', lClass: 'l-womens', tab: 'europe', gender: 'female' },
  { id: 307,   key: 'Saudi Pro League',  lClass: 'l-middle',   tab: 'middle', gender: 'male'   },
  { id: 435,   key: 'UAE Pro League',    lClass: 'l-middle',   tab: 'middle', gender: 'male'   },
  { id: 420,   key: 'Qatar Stars',       lClass: 'l-middle',   tab: 'middle', gender: 'male'   },
  { id: 525,   key: 'AFC Champions',     lClass: 'l-middle',   tab: 'middle', gender: 'male'   },
  { id: 12,    key: 'MLS',              lClass: 'l-north',    tab: 'north',  gender: 'male'   },
  { id: 13,    key: 'Liga MX',          lClass: 'l-north',    tab: 'north',  gender: 'male'   },
  { id: 474,   key: 'NWSL',             lClass: 'l-womens',   tab: 'north',  gender: 'female' },
  { id: 10369, key: 'U-20 World Cup',   lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
  { id: 306,   key: 'U-17 World Cup',   lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
  { id: 9571,  key: 'U-23 Asian Cup',   lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
  { id: 9841,  key: 'U-20 Asian Cup',   lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
  { id: 288,   key: 'UEFA U21',         lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
];

// ────────────────────────────────────────────────
// football-data.org フォールバック設定
// RapidAPIの key と football-data.org の competition id を対応付け
// 無料tierでカバーされているリーグのみ
// ────────────────────────────────────────────────
const FD_FALLBACK_MAP = {
  'EPL':              { id: 2021, lClass: 'l-epl',    tab: 'europe', gender: 'male' },
  'LaLiga':           { id: 2014, lClass: 'l-laliga', tab: 'europe', gender: 'male' },
  'Bundesliga':       { id: 2002, lClass: 'l-bund',   tab: 'europe', gender: 'male' },
  'Serie A':          { id: 2019, lClass: 'l-serie',  tab: 'europe', gender: 'male' },
  'Ligue 1':          { id: 2015, lClass: 'l-ligue',  tab: 'europe', gender: 'male' },
  'Eredivisie':       { id: 2003, lClass: 'l-erediv', tab: 'europe', gender: 'male' },
  'Liga Portugal':    { id: 2017, lClass: 'l-ligap',  tab: 'europe', gender: 'male' },
  'Championship':     { id: 2016, lClass: 'l-champ2', tab: 'europe', gender: 'male' },
  'Champions League': { id: 2001, lClass: 'l-champ',  tab: 'europe', gender: 'male' },
};

// ────────────────────────────────────────────────
// football-data.org 代表戦設定
// ────────────────────────────────────────────────
const FD_NATIONAL = [
  { id: 2000, key: 'World Cup',       lClass: 'l-wc',    tab: 'national', gender: 'male',   national: true },
  { id: 2186, key: 'Nations League',  lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2018, key: 'Euro',            lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2152, key: 'Copa America',    lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2119, key: 'AFC Asian Cup',   lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2165, key: 'AFCON',           lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2077, key: 'Women World Cup', lClass: 'l-wc',    tab: 'national', gender: 'female', national: true },
];

// football-data.org エンブレム補完用リーグ
const FD_CREST_COMPETITIONS = [2021, 2014, 2002, 2019, 2015, 2003, 2017, 2001, 2018];

// ────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function rapidFetch(path, retries = 3) {
  const url = `${BASE_URL}${path}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'x-rapidapi-key':  RAPID_KEY,
          'x-rapidapi-host': RAPID_HOST,
        },
      });
      if (res.status === 429) {
        const wait = attempt * 15000;
        console.warn(`  ⏳ 429 Too Many Requests. ${wait/1000}秒待機 (${attempt}/${retries})...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) { console.warn(`  ⚠️ HTTP ${res.status}: ${url}`); return null; }
      return res.json();
    } catch (e) {
      console.warn(`  ⚠️ fetch error (${attempt}/${retries}): ${e.message}`);
      if (attempt < retries) await sleep(5000);
    }
  }
  return null;
}

async function fdFetch(path, retries = 3) {
  const url = `https://api.football-data.org/v4${path}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'X-Auth-Token': FOOTBALLDATA_KEY },
      });
      if (res.status === 429) {
        const wait = attempt * 20000;
        console.warn(`  ⏳ [FD] 429 Too Many Requests. ${wait/1000}秒待機...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) { console.warn(`  ⚠️ [FD] HTTP ${res.status}: ${url}`); return null; }
      return res.json();
    } catch (e) {
      console.warn(`  ⚠️ [FD] fetch error (${attempt}/${retries}): ${e.message}`);
      if (attempt < retries) await sleep(5000);
    }
  }
  return null;
}

// ────────────────────────────────────────────────
// football-data.org エンブレムマップ構築
// ────────────────────────────────────────────────
async function buildCrestMap() {
  if (!FOOTBALLDATA_KEY) return {};

  console.log('\n🏅 football-data.org からエンブレムデータを取得中...');
  const crestMap = {};

  for (let i = 0; i < FD_CREST_COMPETITIONS.length; i++) {
    const compId = FD_CREST_COMPETITIONS[i];
    const data = await fdFetch(`/competitions/${compId}/teams`);
    if (data?.teams) {
      data.teams.forEach(t => {
        if (t.crest) {
          if (t.name)      crestMap[t.name]      = t.crest;
          if (t.shortName) crestMap[t.shortName] = t.crest;
          if (t.tla)       crestMap[t.tla]       = t.crest;
        }
      });
      console.log(`  ✅ competition ${compId}: ${data.teams.length}チーム`);
    } else {
      console.log(`  － competition ${compId}: データなし`);
    }
    if (i < FD_CREST_COMPETITIONS.length - 1) await sleep(7000);
  }

  console.log(`  📦 エンブレムマップ: ${Object.keys(crestMap).length}エントリ\n`);
  return crestMap;
}

// ────────────────────────────────────────────────
// football-data.org から試合を取得（フォールバック & 代表戦 共通）
// ────────────────────────────────────────────────
async function fdFetchMatches(compId, playerMap, meta) {
  const now = Date.now();
  const dateFrom = new Date().toISOString().split('T')[0];
  const dateTo   = new Date(now + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const data = await fdFetch(
    `/competitions/${compId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED`
  );
  if (!data?.matches) return [];

  return data.matches
    .filter(m => m.utcDate && new Date(m.utcDate).getTime() > now)
    .map(m => {
      const home = m.homeTeam?.name || '';
      const away = m.awayTeam?.name || '';
      if (!home || !away) return null;

      // 日本人選手 or 日本代表チェック
      const japanese = [];
      if (meta.national) {
        // 代表戦: 日本チームが含まれる試合に日本人フラグ
        const isJapanMatch = home === 'Japan' || away === 'Japan'
          || home.includes('Japan') || away.includes('Japan');
        if (isJapanMatch) {
          const jaPlayers = [...(playerMap[home] || []), ...(playerMap[away] || [])];
          japanese.push(...new Set(jaPlayers));
        }
      } else {
        // クラブ戦: playerMapから日本人選手を探す
        const jaPlayers = [
          ...(playerMap[home] || []),
          ...(playerMap[away] || []),
        ];
        japanese.push(...new Set(jaPlayers));
      }

      return {
        kickoffUTC: m.utcDate,
        home,
        away,
        homeCrest: m.homeTeam?.crest || null,
        awayCrest: m.awayTeam?.crest || null,
        league:    meta.key,
        lClass:    meta.lClass,
        tab:       meta.tab,
        gender:    meta.gender,
        national:  meta.national || false,
        youth:     meta.youth    || false,
        japanese,
        _source:   'football-data.org',
      };
    })
    .filter(Boolean);
}

// ────────────────────────────────────────────────
// football-data.org から代表戦を取得
// ────────────────────────────────────────────────
async function fetchNationalMatches(playerMap) {
  if (!FOOTBALLDATA_KEY) return [];

  console.log('\n🌍 football-data.org から代表戦データを取得中...');
  const allMatches = [];

  for (let i = 0; i < FD_NATIONAL.length; i++) {
    const comp = FD_NATIONAL[i];
    process.stdout.write(`  [${String(i+1).padStart(2)}/${FD_NATIONAL.length}] ${comp.key.padEnd(20)} `);

    const matches = await fdFetchMatches(comp.id, playerMap, comp);
    allMatches.push(...matches);
    console.log(`✅ ${matches.length}試合`);

    if (i < FD_NATIONAL.length - 1) await sleep(7000);
  }

  return allMatches;
}

// ────────────────────────────────────────────────
// football-data.org フォールバック取得
// RapidAPIで0件だったリーグを補完
// ────────────────────────────────────────────────
async function fetchFallbackMatches(failedLeagueKeys, playerMap) {
  if (!FOOTBALLDATA_KEY || failedLeagueKeys.length === 0) return [];

  // FD_FALLBACK_MAPに存在するキーだけ対象
  const targets = failedLeagueKeys.filter(key => FD_FALLBACK_MAP[key]);
  if (targets.length === 0) return [];

  console.log(`\n🔄 football-data.org フォールバック取得 (${targets.length}リーグ)...`);
  const allMatches = [];

  for (let i = 0; i < targets.length; i++) {
    const key  = targets[i];
    const comp = FD_FALLBACK_MAP[key];
    process.stdout.write(`  [${String(i+1).padStart(2)}/${targets.length}] ${key.padEnd(28)} `);

    const matches = await fdFetchMatches(comp.id, playerMap, { key, ...comp });
    allMatches.push(...matches);
    console.log(`✅ ${matches.length}試合`);

    // football-data.org レート制限対策（1分10リクエスト）
    if (i < targets.length - 1) await sleep(7000);
  }

  return allMatches;
}

// ────────────────────────────────────────────────
// 選手マップ読み込み
// ────────────────────────────────────────────────
function loadPlayerMap() {
  const path = 'data/players.json';
  if (!fs.existsSync(path)) {
    console.warn('⚠️ data/players.json が見つかりません。');
    return {};
  }
  const saved = JSON.parse(fs.readFileSync(path, 'utf-8'));
  const map = saved.players || {};
  const total = Object.values(map).flat().length;
  console.log(`📋 選手データ: ${Object.keys(map).length}チーム / ${total}人 (更新: ${saved.updatedAt})`);
  return map;
}

// ────────────────────────────────────────────────
// RapidAPI クラブ試合取得
// ────────────────────────────────────────────────
async function fetchLeagueMatches(league, playerMap, crestMap) {
  const data = await rapidFetch(`/football-get-all-matches-by-league?leagueid=${league.id}`);
  if (!data?.response?.matches) return [];

  const now = Date.now();
  const upcoming = data.response.matches.filter(m => {
    if (!m.status?.utcTime) return false;
    if (m.status.finished || m.status.cancelled) return false;
    return new Date(m.status.utcTime).getTime() > now;
  });

  return upcoming.map(m => {
    const home = m.home?.name || m.home?.longName || '';
    const away = m.away?.name || m.away?.longName || '';
    if (!home || !away) return null;

    const homeCrest = m.home?.imageUrl || crestMap[home] || crestMap[m.home?.shortName] || null;
    const awayCrest = m.away?.imageUrl || crestMap[away] || crestMap[m.away?.shortName] || null;

    const japanese = [
      ...(playerMap[home] || []),
      ...(playerMap[away] || []),
      ...(playerMap[m.home?.shortName] || []),
      ...(playerMap[m.away?.shortName] || []),
    ];

    return {
      kickoffUTC: m.status.utcTime,
      home,
      away,
      homeCrest,
      awayCrest,
      league:   league.key,
      lClass:   league.lClass,
      tab:      league.tab,
      gender:   league.gender || 'male',
      national: league.national || false,
      youth:    league.youth    || false,
      japanese: [...new Set(japanese)],
      _source:  'rapidapi',
    };
  }).filter(Boolean);
}

// ────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync('data')) fs.mkdirSync('data');

  // 1. エンブレムマップ構築（football-data.org）
  const crestMap = await buildCrestMap();

  // 2. 選手マップ読み込み
  const playerMap = loadPlayerMap();

  // 3. クラブ試合取得（RapidAPI）
  console.log(`\n📅 クラブ試合データ取得開始 (${RAPID_LEAGUES.length}リーグ)...\n`);
  const allMatches = [];
  const failedLeagueKeys = []; // RapidAPIで0件 or エラーだったリーグ

  for (let i = 0; i < RAPID_LEAGUES.length; i++) {
    const league = RAPID_LEAGUES[i];
    process.stdout.write(`[${String(i+1).padStart(2)}/${RAPID_LEAGUES.length}] ${league.key.padEnd(28)} `);

    const matches = await fetchLeagueMatches(league, playerMap, crestMap);
    allMatches.push(...matches);

    if (matches.length === 0) {
      // フォールバック候補として記録（FD_FALLBACK_MAPに存在するリーグのみ意味がある）
      failedLeagueKeys.push(league.key);
      const hasFallback = !!FD_FALLBACK_MAP[league.key];
      console.log(`0試合 ${hasFallback ? '→ FDフォールバック予定' : ''}`);
    } else {
      console.log(`✅ ${matches.length}試合`);
    }

    if (i < RAPID_LEAGUES.length - 1) await sleep(1000);
  }

  // 4. フォールバック取得（football-data.org）
  const fallbackMatches = await fetchFallbackMatches(failedLeagueKeys, playerMap);
  allMatches.push(...fallbackMatches);

  // 5. 代表戦取得（football-data.org）
  const nationalMatches = await fetchNationalMatches(playerMap);
  allMatches.push(...nationalMatches);

  // 6. 重複除去・ソート
  const seen   = new Set();
  const unique = allMatches.filter(m => {
    const key = `${m.kickoffUTC}|${m.home}|${m.away}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));

  // _source フィールドは出力から除去（フロントエンドに不要）
  unique.forEach(m => delete m._source);

  // 7. 保存
  const jstStr = new Date(Date.now() + 9*60*60*1000)
    .toISOString().replace('T', ' ').slice(0, 16);
  fs.writeFileSync('data/matches.json', JSON.stringify({ updatedAt: jstStr, matches: unique }, null, 2));

  // サマリー
  const byTab = {};
  unique.forEach(m => { byTab[m.tab] = (byTab[m.tab] || 0) + 1; });
  const jpMatches      = unique.filter(m => m.japanese.length > 0).length;
  const withCrestTotal = unique.filter(m => m.homeCrest || m.awayCrest).length;
  const fbLeagues      = failedLeagueKeys.filter(k => FD_FALLBACK_MAP[k]);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 保存完了: 合計 ${unique.length}試合`);
  Object.entries(byTab).forEach(([tab, cnt]) => console.log(`   ${tab.padEnd(12)}: ${cnt}試合`));
  console.log(`   日本人関連: ${jpMatches}試合`);
  console.log(`   エンブレムあり: ${withCrestTotal}/${unique.length}試合`);
  if (fbLeagues.length > 0) {
    console.log(`   FDフォールバック: ${fbLeagues.join(', ')}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => { console.error(err); process.exit(1); });
