const fs = require('fs');

const apiKey = process.env.DAIHYO;
const BASE = 'https://api.football-data.org/v4';

// ── Football-Data.org の competition code → サイト内キー・スタイル ──
const COMPETITION_MAP = {
  // 欧州クラブ
  'PL':  { key: 'EPL',              lClass: 'l-epl',    national: false },
  'PD':  { key: 'LaLiga',           lClass: 'l-laliga', national: false },
  'BL1': { key: 'Bundesliga',       lClass: 'l-bund',   national: false },
  'SA':  { key: 'Serie A',          lClass: 'l-serie',  national: false },
  'FL1': { key: 'Ligue 1',          lClass: 'l-ligue',  national: false },
  'PPL': { key: 'Liga Portugal',    lClass: 'l-ligap',  national: false },
  'DED': { key: 'Eredivisie',       lClass: 'l-erediv', national: false },
  'SPL': { key: 'Scottish Prem',    lClass: 'l-spl',    national: false },
  'CL':  { key: 'Champions League', lClass: 'l-champ',  national: false },
  'EL':  { key: 'Europa League',    lClass: 'l-uel',    national: false },
  // 代表戦
  'WC':  { key: 'World Cup',        lClass: 'l-champ',  national: true  },
  'EC':  { key: 'Euro',             lClass: 'l-champ',  national: true  },
};

// 代表戦として扱う competition code
const NATIONAL_CODES = new Set(['WC', 'EC', 'WCQ', 'ECQ', 'AFCQ', 'AFC', 'INT']);

// ── ユーティリティ ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// レート制限を意識したfetch（429時にリトライ）
async function apiFetch(path, retries = 3) {
  const url = `${BASE}${path}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey }
    });
    if (res.status === 429) {
      const wait = attempt * 12000; // 12秒 × 試行回数
      console.warn(`  429 Too Many Requests. ${wait / 1000}秒待機 (${attempt}/${retries})...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      console.warn(`  HTTP ${res.status}: ${url}`);
      return null;
    }
    return res.json();
  }
  console.warn(`  リトライ上限に達しました: ${url}`);
  return null;
}

// ── 1. 対象リーグのチーム一覧を取得 ──
async function fetchTeamsForCompetition(code) {
  console.log(`  チーム一覧取得中: ${code}`);
  const data = await apiFetch(`/competitions/${code}/teams`);
  await sleep(6000); // APIのレート制限対策（Tier1: 10req/min）
  if (!data) return [];
  return data.teams || [];
}

// ── 2. チームのスカッドから日本人選手を取得 ──
async function fetchJapanesePlayers(teamId, teamName) {
  const data = await apiFetch(`/teams/${teamId}`);
  await sleep(6000);
  if (!data) return [];

  const squad = data.squad || [];
  const japanese = squad
    .filter(p => p.nationality === 'Japan')
    .map(p => p.name);

  if (japanese.length > 0) {
    console.log(`    ✅ ${teamName}: ${japanese.join(', ')}`);
  }
  return japanese;
}

// ── 3. 全リーグの日本人選手マップを構築 ──
// { "Brighton Hove": ["三笘薫"], ... } の形式
async function buildJapanesePlayerMap() {
  // クラブリーグのみ対象
  const clubCodes = Object.entries(COMPETITION_MAP)
    .filter(([, v]) => !v.national)
    .map(([code]) => code);

  const playerMap = {}; // teamShortName → [playerName, ...]
  const processedTeamIds = new Set();

  for (const code of clubCodes) {
    const teams = await fetchTeamsForCompetition(code);
    if (teams.length === 0) continue;

    console.log(`  ${code}: ${teams.length}チームのスカッドを確認中...`);

    for (const team of teams) {
      if (processedTeamIds.has(team.id)) continue; // CL/ELで重複するチームをスキップ
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

// ── 4. 試合データ取得 ──
async function fetchMatches(dateFrom, dateTo) {
  const data = await apiFetch(`/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  if (!data) return [];
  return data.matches || [];
}

// ── メイン ──
async function main() {
  const testRes = await apiFetch('/competitions');
  console.log(JSON.stringify(testRes?.competitions?.map(c => ({ id: c.id, code: c.code, name: c.name })), null, 2));
  if (!apiKey) {
    console.error('❌ 環境変数 DAIHYO が設定されていません');
    process.exit(1);
  }

  if (!fs.existsSync('data')) fs.mkdirSync('data');

  // ── Step 1: 日本人選手マップを構築 ──
  console.log('\n📋 日本人選手データ取得開始...');
  const japanesePlayerMap = await buildJapanesePlayerMap();

  const playerCount = Object.values(japanesePlayerMap).flat().length;
  console.log(`\n✅ 日本人選手マップ完成: ${Object.keys(japanesePlayerMap).length}チーム, 計${playerCount}人`);
  console.log(JSON.stringify(japanesePlayerMap, null, 2));

  // players.json にキャッシュ保存（デバッグ・差分確認用）
  fs.writeFileSync(
    'data/players.json',
    JSON.stringify({ updatedAt: new Date().toISOString(), players: japanesePlayerMap }, null, 2)
  );

  // ── Step 2: 試合データ取得 ──
  console.log('\n📅 試合データ取得開始...');
  const now = new Date();
  let raw = [];

for (let i = 0; i < 6; i++) {
  const from = toDateStr(new Date(now.getTime() + i * 10 * 24 * 60 * 60 * 1000));
  const to   = toDateStr(new Date(now.getTime() + (i * 10 + 9) * 24 * 60 * 60 * 1000));
    console.log(`取得期間: ${from} 〜 ${to}`);
    const chunk = await fetchMatches(from, to);
    console.log(`  → ${chunk.length}件取得`);
    raw = raw.concat(chunk);
    await sleep(6000);
  }

  // ── Step 3: 試合データ整形 ──
  const allMatches = [];

  for (const m of raw) {
    if (['FINISHED', 'CANCELLED', 'POSTPONED'].includes(m.status)) continue;

    const code = m.competition?.code || '';
    const comp = COMPETITION_MAP[code];
    if (!comp) continue;

    const kickoffUTC = m.utcDate;
    const home = m.homeTeam?.shortName || m.homeTeam?.name || '';
    const away = m.awayTeam?.shortName || m.awayTeam?.name || '';
    if (!home || !away) continue;

    const isNational = comp.national || NATIONAL_CODES.has(code);

    // 動的に取得した選手マップを参照
    const japanese = isNational ? [] : [
      ...(japanesePlayerMap[home] || []),
      ...(japanesePlayerMap[away] || []),
    ];

    allMatches.push({
      kickoffUTC,
      home,
      away,
      league: comp.key,
      lClass: comp.lClass,
      japanese,
      national: isNational,
    });
  }

  // 重複除去 & ソート
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

  console.log(`\n✅ 保存完了: ${unique.length}試合`);
}

main().catch(err => { console.error(err); process.exit(1); });
 
