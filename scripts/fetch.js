const fs = require('fs');

// ── APIキー ──
const apiKey         = process.env.DAIHYO;
const apiFootballKey = process.env.API_FOOTBALL_KEY;

const BASE    = 'https://api.football-data.org/v4';
const AF_BASE = 'https://v3.football.api-sports.io';

// ── football-data.org リーグ設定 ──
const COMPETITION_MAP = {
  'PL':  { key: 'EPL',              lClass: 'l-epl',    national: false },
  'PD':  { key: 'LaLiga',           lClass: 'l-laliga', national: false },
  'BL1': { key: 'Bundesliga',       lClass: 'l-bund',   national: false },
  'SA':  { key: 'Serie A',          lClass: 'l-serie',  national: false },
  'FL1': { key: 'Ligue 1',          lClass: 'l-ligue',  national: false },
  'PPL': { key: 'Liga Portugal',    lClass: 'l-ligap',  national: false },
  'DED': { key: 'Eredivisie',       lClass: 'l-erediv', national: false },
  'SPL': { key: 'Scottish Prem',    lClass: 'l-spl',    national: false },
  'ELC': { key: 'Championship',     lClass: 'l-champ2', national: false },
  'CL':  { key: 'Champions League', lClass: 'l-champ',  national: false },
  'EL':  { key: 'Europa League',    lClass: 'l-uel',    national: false },
  'WC':  { key: 'World Cup',        lClass: 'l-champ',  national: true  },
};

const NATIONAL_CODES = new Set(['EC', 'WCQ', 'ECQ', 'AFCQ', 'AFC', 'INT']);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toDateStr(d) { return d.toISOString().split('T')[0]; }

async function apiFetch(path, retries = 3) {
  const url = `${BASE}${path}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { 'X-Auth-Token': apiKey } });
    if (res.status === 429) {
      const wait = attempt * 12000;
      console.warn(`  429 Too Many Requests. ${wait / 1000}秒待機 (${attempt}/${retries})...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) { console.warn(`  HTTP ${res.status}: ${url}`); return null; }
    return res.json();
  }
  console.warn(`  リトライ上限に達しました: ${url}`);
  return null;
}

async function apiFetchFootball(path) {
  const url = `${AF_BASE}${path}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': apiFootballKey } });
  if (!res.ok) { console.warn(`  HTTP ${res.status}: ${url}`); return null; }
  return res.json();
}

// ── ベルギーリーグ取得（api-football） league=144 ──
async function fetchBelgiumMatches() {
  console.log('\n🇧🇪 ベルギーリーグデータ取得開始 (api-football)...');
  const data = await apiFetchFootball(`/fixtures?league=144&season=2024`);
  if (!data) return [];
  const fixtures = data.response || [];
  console.log(`  ベルギー: ${fixtures.length}件取得`);
  const upcoming = fixtures.filter(f => f.fixture?.status?.short === 'NS');
  console.log(`  ベルギー未来: ${upcoming.length}件`);
  return upcoming.map(f => ({
    kickoffUTC: f.fixture.date,
    home:       f.teams.home.name,
    away:       f.teams.away.name,
    homeCrest:  f.teams.home.logo || null,
    awayCrest:  f.teams.away.logo || null,
    league:     'Belgian Pro League',
    lClass:     'l-belgique',
    japanese:   [],
    national:   false,
  }));
}

async function fetchTeamsForCompetition(code) {
  console.log(`  チーム一覧取得中: ${code}`);
  const data = await apiFetch(`/competitions/${code}/teams`);
  await sleep(6000);
  if (!data) return [];
  return data.teams || [];
}

async function fetchJapanesePlayers(teamId, teamName) {
  const data = await apiFetch(`/teams/${teamId}`);
  await sleep(6000);
  if (!data) return [];
  const squad = data.squad || [];
  const japanese = squad.filter(p => p.nationality === 'Japan').map(p => p.name);
  if (japanese.length > 0) console.log(`    ✅ ${teamName}: ${japanese.join(', ')}`);
  return japanese;
}

async function buildJapanesePlayerMap() {
  const clubCodes = Object.keys(COMPETITION_MAP).filter(code => !COMPETITION_MAP[code].national);
  const playerMap = {};
  const processedTeamIds = new Set();
  for (const code of clubCodes) {
    const teams = await fetchTeamsForCompetition(code);
    if (teams.length === 0) continue;
    console.log(`  ${code}: ${teams.length}チームのスカッドを確認中...`);
    for (const team of teams) {
      if (processedTeamIds.has(team.id)) continue;
      processedTeamIds.add(team.id);
      const japanese = await fetchJapanesePlayers(team.id, team.shortName || team.name);
      if (japanese.length > 0) {
        const key = team.shortName || team.name;
        playerMap[key] = [...new Set([...(playerMap[key] || []), ...japanese])];
      }
    }
  }
  return playerMap;
}

async function fetchMatches(dateFrom, dateTo) {
  const data = await apiFetch(`/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  if (!data) return [];
  return data.matches || [];
}

async function main() {
  if (!apiKey) {
    console.error('❌ 環境変数 DAIHYO が設定されていません');
    process.exit(1);
  }
  if (!apiFootballKey) {
    console.warn('⚠️ 環境変数 API_FOOTBALL_KEY が設定されていません（ベルギーはスキップ）');
  }

  if (!fs.existsSync('data')) fs.mkdirSync('data');

  const FETCH_MODE = process.env.FETCH_MODE || 'all';
  console.log(`\n🔧 FETCH_MODE: ${FETCH_MODE}`);

  let japanesePlayerMap = {};

  if (FETCH_MODE === 'all' || FETCH_MODE === 'players') {
    console.log('\n📋 日本人選手データ取得開始...');
    japanesePlayerMap = await buildJapanesePlayerMap();
    const playerCount = Object.values(japanesePlayerMap).flat().length;
    console.log(`\n✅ 日本人選手マップ完成: ${Object.keys(japanesePlayerMap).length}チーム, 計${playerCount}人`);
    fs.writeFileSync(
      'data/players.json',
      JSON.stringify({ updatedAt: new Date().toISOString(), players: japanesePlayerMap }, null, 2)
    );
    if (FETCH_MODE === 'players') {
      console.log('✅ 選手データのみ更新完了');
      return;
    }
  } else {
    const playersPath = 'data/players.json';
    if (fs.existsSync(playersPath)) {
      const saved = JSON.parse(fs.readFileSync(playersPath, 'utf-8'));
      japanesePlayerMap = saved.players || {};
      console.log(`📋 既存選手データ読み込み (更新: ${saved.updatedAt})`);
      console.log(`   ${Object.keys(japanesePlayerMap).length}チーム, 計${Object.values(japanesePlayerMap).flat().length}人`);
    } else {
      console.warn('⚠️ players.json が見つかりません。日本人選手情報なしで続行します。');
    }
  }

  const now = new Date();
  console.log('\n📅 試合データ取得開始 (football-data.org)...');
  let raw = [];
  for (let i = 0; i < 9; i++) {
    const from = toDateStr(new Date(now.getTime() + i * 10 * 24 * 60 * 60 * 1000));
    const to   = toDateStr(new Date(now.getTime() + (i * 10 + 9) * 24 * 60 * 60 * 1000));
    console.log(`取得期間: ${from} 〜 ${to}`);
    const chunk = await fetchMatches(from, to);
    console.log(`  → ${chunk.length}件取得`);
    raw = raw.concat(chunk);
    await sleep(6000);
  }

  // ── ベルギー取得 ──
  let belgiumMatches = [];
  if (apiFootballKey) {
    belgiumMatches = await fetchBelgiumMatches();
    console.log(`✅ ベルギー合計: ${belgiumMatches.length}試合`);
  }

  // ── 整形（WCはnational:trueで保存） ──
  const allMatches = [];
  for (const m of raw) {
    if (['FINISHED', 'CANCELLED', 'POSTPONED'].includes(m.status)) continue;
    const code = m.competition?.code || '';
    const comp = COMPETITION_MAP[code];
    if (!comp || NATIONAL_CODES.has(code)) continue;
    const kickoffUTC = m.utcDate;
    const home = m.homeTeam?.shortName || m.homeTeam?.name || '';
    const away = m.awayTeam?.shortName || m.awayTeam?.name || '';
    if (!home || !away) continue;
    const japanese = [
      ...(japanesePlayerMap[home] || []),
      ...(japanesePlayerMap[away] || []),
    ];
    allMatches.push({
      kickoffUTC,
      home,
      away,
      homeCrest: m.homeTeam?.crest || null,
      awayCrest: m.awayTeam?.crest || null,
      league:    comp.key,
      lClass:    comp.lClass,
      japanese,
      national:  comp.national || false,
    });
  }

  allMatches.push(...belgiumMatches);

  const seen = new Set();
  const unique = allMatches.filter(m => {
    const key = `${m.kickoffUTC}|${m.home}|${m.away}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));

  const jstStr = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 16);

  fs.writeFileSync(
    'data/matches.json',
    JSON.stringify({ updatedAt: jstStr, matches: unique }, null, 2)
  );

  const wcCount = unique.filter(m => m.national).length;
  console.log(`\n✅ 保存完了: ${unique.length}試合 (うちW杯: ${wcCount}, ベルギー: ${belgiumMatches.length}試合)`);
}

main()
  .catch(err => { console.error(err); process.exit(1); });
