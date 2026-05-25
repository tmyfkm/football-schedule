// scripts/fetch_players.js
// RapidAPI から日本人選手マップを取得し data/players.json に保存（月1実行想定）
// 実行: RAPIDAPI_KEY=xxx node scripts/fetch_players.js

'use strict';
const fs = require('fs');

const RAPID_KEY  = process.env.RAPIDAPI_KEY;
const RAPID_HOST = 'free-api-live-football-data.p.rapidapi.com';
const BASE_URL   = `https://${RAPID_HOST}`;

if (!RAPID_KEY) {
  console.error('❌ 環境変数 RAPIDAPI_KEY が未設定');
  process.exit(1);
}

// ────────────────────────────────────────────────
// 対象リーグ（fetch_matches.js の RAPID_LEAGUES と同じ id を使用）
// ────────────────────────────────────────────────
const TARGET_LEAGUES = [
  { id: 1,   name: 'EPL'               },
  { id: 2,   name: 'LaLiga'            },
  { id: 3,   name: 'Bundesliga'        },
  { id: 4,   name: 'Serie A'           },
  { id: 5,   name: 'Ligue 1'           },
  { id: 7,   name: 'Eredivisie'        },
  { id: 8,   name: 'Liga Portugal'     },
  { id: 9,   name: 'Scottish Prem'     },
  { id: 10,  name: 'Championship'      },
  { id: 40,  name: 'Belgian Pro League'},
  { id: 6,   name: 'Super Lig'         },
  { id: 42,  name: 'Champions League'  },
  { id: 73,  name: 'Europa League'     },
  { id: 307, name: 'Saudi Pro League'  },
  { id: 435, name: 'UAE Pro League'    },
  { id: 420, name: 'Qatar Stars'       },
  { id: 12,  name: 'MLS'              },
  { id: 13,  name: 'Liga MX'          },
];

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
        const wait = attempt * 20000;
        console.warn(`  ⏳ 429 Too Many Requests. ${wait/1000}秒待機 (${attempt}/${retries})...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        console.warn(`  ⚠️ HTTP ${res.status}: ${url}`);
        return null;
      }
      return res.json();
    } catch (e) {
      console.warn(`  ⚠️ fetch error (${attempt}/${retries}): ${e.message}`);
      if (attempt < retries) await sleep(5000);
    }
  }
  return null;
}

// ────────────────────────────────────────────────
// Step1: リーグのチーム一覧を取得
// ────────────────────────────────────────────────
async function fetchTeamsByLeague(leagueId) {
  const data = await rapidFetch(`/football-get-list-all-team?leagueid=${leagueId}`);
  if (!data?.response?.teams) return [];
  return data.response.teams.map(t => ({
    id:   t.id   || t.teamid,
    name: t.name || t.teamName || '',
  })).filter(t => t.id && t.name);
}

// ────────────────────────────────────────────────
// Step2: チームの選手一覧から日本人を抽出
// ────────────────────────────────────────────────
async function fetchJapanesePlayers(teamId) {
  const data = await rapidFetch(`/football-get-list-player?teamid=${teamId}`);
  if (!data) return [];

  const players =
    data?.response?.players ??
    data?.response?.squad   ??
    data?.players           ??
    [];

  return players
    .filter(p => {
      const nat = p.nationality || p.nation || p.country || '';
      return nat === 'Japan' || nat === 'Japanese' || nat === 'JP';
    })
    .map(p => p.name || p.fullName || p.shortName || '')
    .filter(Boolean);
}

// ────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync('data')) fs.mkdirSync('data');

  // Step1: 全リーグのチームを収集（チームIDの重複を除去）
  console.log(`\n📋 チーム一覧取得 (${TARGET_LEAGUES.length}リーグ)...\n`);
  const teamMap = {}; // id → name

  for (let i = 0; i < TARGET_LEAGUES.length; i++) {
    const league = TARGET_LEAGUES[i];
    process.stdout.write(`[${String(i+1).padStart(2)}/${TARGET_LEAGUES.length}] ${league.name.padEnd(22)} `);

    const teams = await fetchTeamsByLeague(league.id);
    teams.forEach(t => { teamMap[t.id] = t.name; });
    console.log(`✅ ${teams.length}チーム`);

    if (i < TARGET_LEAGUES.length - 1) await sleep(1200);
  }

  const allTeams = Object.entries(teamMap).map(([id, name]) => ({ id: Number(id), name }));
  console.log(`\n📦 チーム合計: ${allTeams.length}チーム（重複除去済み）\n`);

  // Step2: 各チームの日本人選手を取得
  console.log(`👥 日本人選手データ取得開始 (${allTeams.length}チーム)...\n`);
  const playerMap = {};
  let foundCount = 0;

  for (let i = 0; i < allTeams.length; i++) {
    const team = allTeams[i];
    process.stdout.write(`[${String(i+1).padStart(3)}/${allTeams.length}] ${team.name.padEnd(28)} `);

    const japanese = await fetchJapanesePlayers(team.id);

    if (japanese.length > 0) {
      playerMap[team.name] = japanese;
      foundCount += japanese.length;
      console.log(`✅ ${japanese.join(', ')}`);
    } else {
      console.log('－');
    }

    if (i < allTeams.length - 1) await sleep(1200);
  }

  // 保存
  const jstStr = new Date(Date.now() + 9*60*60*1000)
    .toISOString().replace('T', ' ').slice(0, 16);
  fs.writeFileSync('data/players.json', JSON.stringify({
    updatedAt: jstStr,
    players: playerMap,
  }, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 保存完了: ${Object.keys(playerMap).length}チームに日本人選手`);
  console.log(`   合計: ${foundCount}人`);
  Object.entries(playerMap).forEach(([team, players]) => {
    console.log(`   ${team}: ${players.join(', ')}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => { console.error(err); process.exit(1); });
