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
};

// football-data.org の代表戦コードは除外（api-football で取得するため）
const NATIONAL_CODES = new Set(['WC', 'EC', 'WCQ', 'ECQ', 'AFCQ', 'AFC', 'INT']);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toDateStr(d) { return d.toISOString().split('T')[0]; }

// ── football-data.org fetch ──
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

// ── api-football fetch ──
async function apiFetchFootball(path) {
  const url = `${AF_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiFootballKey }
  });
  if (!res.ok) { console.warn(`  HTTP ${res.status}: ${url}`); return null; }
  return res.json();
}

// ── W杯取得（api-football） league=1, season=2026 ──
async function fetchWorldCupMatches() {
  console.log('\n🌍 W杯データ取得開始 (api-football)...');
  const data = await apiFetchFootball(`/fixtures?league=1&season=2026`);
  if (!data) return [];

  const fixtures = data.response || [];
  console.log(`  W杯: ${fixtures.length}件取得`);

  const SKIP_STATUS = new Set([
    'Match Finished', 'Cancelled', 'Postponed', 'Abandoned',
    'After Penalties', 'After Extra Time'
  ]);

  return fixtures
    .filter(f => !SKIP_STATUS.has(f.fixture?.status?.long))
    .map(f => ({
      kickoffUTC: f.fixture.date,
      home:       f.teams.home.name,
      away:       f.teams.away.name,
      homeCrest:  f.teams.home.logo || null,
      awayCrest:  f.teams.away.logo || null,
      league:     'World Cup',
      lClass:     'l-champ',
      japanese:   [],
      national:   true,
    }));
}

// ── 日本人選手マップ構築 ──
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

// ── メイン ──
async function main() {
  if (!apiKey) {
    console.error('❌ 環境変数 DAIHYO が設定されていません');
    process.exit(1);
  }
  if (!apiFootballKey) {
    console.warn('⚠️ 環境変数 API_FOOTBALL_KEY が設定されていません（W杯はスキップ）');
  }

  if (!fs.existsSync('data')) fs.mkdirSync('data');

  // ── 日本人選手マップ ──
  console.log('\n📋 日本人選手データ取得開始...');
  const japanesePlayerMap = await buildJapanesePlayerMap();
  const playerCount = Object.values(japanesePlayerMap).flat().length;
  console.log(`\n✅ 日本人選手マップ完成: ${Object.keys(japanesePlayerMap).length}チーム, 計${playerCount}人`);

  fs.writeFileSync(
    'data/players.json',
    JSON.stringify({ updatedAt: new Date().toISOString(), players: japanesePlayerMap }, null, 2)
  );

  const now = new Date();

  // ── football-data.org 試合取得（クラブのみ） ──
  console.log('\n📅 クラブ試合データ取得開始 (football-data.org)...');
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

  // ── W杯取得（api-football） ──
  let worldCupMatches = [];
  if (apiFootballKey) {
    worldCupMatches = await fetchWorldCupMatches();
    console.log(`✅ W杯合計: ${worldCupMatches.length}試合`);
  }

  // ── football-data.org データ整形（代表戦・W杯は除外） ──
  const allMatches = [];
  for (const m of raw) {
    if (['FINISHED', 'CANCELLED', 'POSTPONED'].includes(m.status)) continue;

    const code = m.competition?.code || '';
    const comp = COMPETITION_MAP[code];

    // 代表戦・W杯は football-data.org からは取らない
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
      national:  false,
    });
  }

  // ── W杯をマージ ──
  allMatches.push(...worldCupMatches);

  // ── 重複排除・ソート ──
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

  console.log(`\n✅ 保存完了: ${unique.length}試合 (うちW杯: ${worldCupMatches.length}試合)`);
}

async function testSportDB() {
  const key = process.env.SPORTDB_KEY;
  if (!key) { console.log('SPORTDB_KEY なし'); return; }
  console.log('\n🧪 SportDB テスト開始...');

  // 国一覧を確認
  const r0 = await fetch('https://api.sportdb.dev/api/football/countries', {
    headers: { 'X-API-Key': key }
  });
  const d0 = await r0.json();
  console.log('国一覧:', JSON.stringify(d0).slice(0, 500));

  // ベルギーのリーグ一覧
  const r1 = await fetch('https://api.sportdb.dev/api/football/belgium', {
    headers: { 'X-API-Key': key }
  });
  const d1 = await r1.json();
  console.log('ベルギー:', JSON.stringify(d1).slice(0, 500));
}

main()
  .then(() => testSportDB())
  .catch(err => { console.error(err); process.exit(1); });
