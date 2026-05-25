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
  { id: 1,     key: 'EPL',                lClass: 'l-epl',      tab: 'europe', gender: 'male'   },
  { id: 2,     key: 'LaLiga',             lClass: 'l-laliga',   tab: 'europe', gender: 'male'   },
  { id: 3,     key: 'Bundesliga',         lClass: 'l-bund',     tab: 'europe', gender: 'male'   },
  { id: 4,     key: 'Serie A',            lClass: 'l-serie',    tab: 'europe', gender: 'male'   },
  { id: 5,     key: 'Ligue 1',            lClass: 'l-ligue',    tab: 'europe', gender: 'male'   },
  { id: 7,     key: 'Eredivisie',         lClass: 'l-erediv',   tab: 'europe', gender: 'male'   },
  { id: 8,     key: 'Liga Portugal',      lClass: 'l-ligap',    tab: 'europe', gender: 'male'   },
  { id: 9,     key: 'Scottish Prem',      lClass: 'l-spl',      tab: 'europe', gender: 'male'   },
  { id: 10,    key: 'Championship',       lClass: 'l-champ2',   tab: 'europe', gender: 'male'   },
  { id: 40,    key: 'Belgian Pro League',lClass: 'l-belgique', tab: 'europe', gender: 'male'   },
  { id: 6,     key: 'Super Lig',          lClass: 'l-champ2',   tab: 'europe', gender: 'male'   },
  { id: 42,    key: 'Champions League',   lClass: 'l-champ',    tab: 'europe', gender: 'male'   },
  { id: 73,    key: 'Europa League',      lClass: 'l-uel',      tab: 'europe', gender: 'male'   },
  { id: 10216, key: 'Conference League', lClass: 'l-uel',      tab: 'europe', gender: 'male'   },
  { id: 9375,  key: 'Women Champions League', lClass: 'l-womens', tab: 'europe', gender: 'female' },
  { id: 307,   key: 'Saudi Pro League',   lClass: 'l-middle',   tab: 'middle', gender: 'male'   },
  { id: 435,   key: 'UAE Pro League',     lClass: 'l-middle',   tab: 'middle', gender: 'male'   },
  { id: 420,   key: 'Qatar Stars',        lClass: 'l-middle',   tab: 'middle', gender: 'male'   },
  { id: 525,   key: 'AFC Champions',      lClass: 'l-middle',   tab: 'middle', gender: 'male'   },
  { id: 12,    key: 'MLS',                lClass: 'l-north',    tab: 'north',  gender: 'male'   },
  { id: 13,    key: 'Liga MX',            lClass: 'l-north',    tab: 'north',  gender: 'male'   },
  { id: 474,   key: 'NWSL',               lClass: 'l-womens',   tab: 'north',  gender: 'female' },
  { id: 10369, key: 'U-20 World Cup',     lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
  { id: 306,   key: 'U-17 World Cup',     lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
  { id: 9571,  key: 'U-23 Asian Cup',     lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
  { id: 9841,  key: 'U-20 Asian Cup',     lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
  { id: 288,   key: 'UEFA U21',           lClass: 'l-youth',    tab: 'youth',  gender: 'male',  national: true, youth: true },
];

// ────────────────────────────────────────────────
// football-data.org フォールバック設定
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
  { id: 2000, key: 'World Cup',      lClass: 'l-wc',    tab: 'national', gender: 'male',   national: true },
  { id: 2186, key: 'Nations League',  lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2018, key: 'Euro',            lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2119, key: 'AFC Asian Cup',   lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2165, key: 'AFCON',           lClass: 'l-champ', tab: 'national', gender: 'male',   national: true },
  { id: 2077, key: 'Women World Cup', lClass: 'l-wc',    tab: 'national', gender: 'female', national: true },
];

// football-data.org エンブレム補完用リーグ
const FD_CREST_COMPETITIONS = [];

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
        await sleep(wait);
        continue;
      }
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
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
        await sleep(wait);
        continue;
      }
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      if (attempt < retries) await sleep(5000);
    }
  }
  return null;
}

async function buildCrestMap() {
  if (!FOOTBALLDATA_KEY) return {};
  const crestMap = {};
  for (const compId of FD_CREST_COMPETITIONS) {
    const data = await fdFetch(`/competitions/${compId}/teams`);
    if (data?.teams) {
      data.teams.forEach(t => {
        if (t.crest) {
          if (t.name) crestMap[t.name] = t.crest;
          if (t.shortName) crestMap[t.shortName] = t.crest;
          if (t.tla) crestMap[t.tla] = t.crest;
        }
      });
    }
    await sleep(7000);
  }
  return crestMap;
}

async function fdFetchMatches(compId, playerMap, meta) {
  const now = Date.now();
  const dateFrom = new Date().toISOString().split('T');
  const dateTo   = new Date(now + 180 * 24 * 60 * 60 * 1000).toISOString().split('T');
  const data = await fdFetch(`/competitions/${compId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED`);
  if (!data?.matches) return [];
  return data.matches
    .filter(m => m.utcDate && new Date(m.utcDate).getTime() > now)
    .map(m => {
      const home = m.homeTeam?.name || '';
      const away = m.awayTeam?.name || '';
      if (!home || !away) return null;
      const japanese = meta.national
        ? (home.includes('Japan') || away.includes('Japan') ? [...new Set([...(playerMap[home] || []), ...(playerMap[away] || [])])] : [])
        : [...new Set([...(playerMap[home] || []), ...(playerMap[away] || [])])];
      return {
        kickoffUTC: m.utcDate,
        home,
        away,
        homeCrest: m.homeTeam?.crest || null,
        awayCrest: m.awayTeam?.crest || null,
        league:   meta.key,
        lClass:   meta.lClass,
        tab:      meta.tab,
        gender:   meta.gender,
        national: meta.national || false,
        youth:    meta.youth    || false,
        japanese,
      };
    })
    .filter(Boolean);
}

async function fetchNationalMatches(playerMap) {
  if (!FOOTBALLDATA_KEY) return [];
  const allMatches = [];
  for (const comp of FD_NATIONAL) {
    const matches = await fdFetchMatches(comp.id, playerMap, comp);
    allMatches.push(...matches);
    await sleep(7000);
  }
  return allMatches;
}

async function fetchFallbackMatches(failedLeagueKeys, playerMap) {
  if (!FOOTBALLDATA_KEY || failedLeagueKeys.length === 0) return [];
  const targets = failedLeagueKeys.filter(key => FD_FALLBACK_MAP[key]);
  const allMatches = [];
  for (const key of targets) {
    const comp = FD_FALLBACK_MAP[key];
    const matches = await fdFetchMatches(comp.id, playerMap, { key, ...comp });
    allMatches.push(...matches);
    await sleep(7000);
  }
  return allMatches;
}

function loadPlayerMap() {
  const path = 'data/players.json';
  if (!fs.existsSync(path)) return {};
  const saved = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return saved.players || {};
}

async function fetchLeagueMatches(league, playerMap, crestMap) {
  const data = await rapidFetch(`/football-get-all-matches-by-league?leagueid=${league.id}`);
  if (!data?.response?.matches) return [];
  const now = Date.now();
  return data.response.matches
    .filter(m => m.status?.utcTime && !m.status.finished && !m.status.cancelled && new Date(m.status.utcTime).getTime() > now)
    .map(m => {
      const home = m.home?.name || m.home?.longName || '';
      const away = m.away?.name || m.away?.longName || '';
      if (!home || !away) return null;
      return {
        kickoffUTC: m.status.utcTime,
        home,
        away,
        homeCrest: m.home?.imageUrl || crestMap[home] || crestMap[m.home?.shortName] || null,
        awayCrest: m.away?.imageUrl || crestMap[away] || crestMap[m.away?.shortName] || null,
        league:   league.key,
        lClass:   league.lClass,
        tab:      league.tab,
        gender:   league.gender || 'male',
        national: league.national || false,
        youth:    league.youth    || false,
        japanese: [...new Set([...(playerMap[home] || []), ...(playerMap[away] || []), ...(playerMap[m.home?.shortName] || []), ...(playerMap[m.away?.shortName] || [])])],
      };
    })
    .filter(Boolean);
}

async function main() {
  if (!fs.existsSync('data')) fs.mkdirSync('data');
  const crestMap = await buildCrestMap();
  const playerMap = loadPlayerMap();
  let allMatches = [];
  const failedLeagueKeys = [];

  for (const league of RAPID_LEAGUES) {
    const matches = await fetchLeagueMatches(league, playerMap, crestMap);
    allMatches.push(...matches);
    if (matches.length === 0) failedLeagueKeys.push(league.key);
    await sleep(1000);
  }

  allMatches.push(...(await fetchFallbackMatches(failedLeagueKeys, playerMap)));
  allMatches.push(...(await fetchNationalMatches(playerMap)));

  const filteredMatches = allMatches.filter(m => m.league !== 'Copa America');

  const seen = new Set();
  const unique = filteredMatches.filter(m => {
    const key = `${m.kickoffUTC}|${m.home}|${m.away}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));

  const jstStr = new Date(Date.now() + 9*60*60*1000).toISOString().replace('T', ' ').slice(0, 16);
  fs.writeFileSync('data/matches.json', JSON.stringify({ updatedAt: jstStr, matches: unique }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
