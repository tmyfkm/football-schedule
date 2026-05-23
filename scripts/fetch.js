cat > /tmp/fetch.js << 'JSEOF'
const fs = require('fs');

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE = 'https://api.football-data.org/v4';

// 日本人選手とチームの対応表（正確に更新）
const JAPANESE_PLAYERS = {
  "Brighton & Hove Albion FC": ["三笘薫"],
  "Liverpool FC":               ["遠藤航"],
  "Arsenal FC":                 ["冨安健洋"],
  "Real Sociedad de Fútbol":    ["久保建英"],
  "SC Freiburg":                ["堂安律"],
  "Stade de Reims":             ["伊東純也"],
  "Feyenoord Rotterdam":        ["上田綺世"],
  "Celtic FC":                  ["前田大然","古橋亨梧"],
  "AS Monaco FC":               ["南野拓実"],
  "Preston North End FC":       ["田中碧"],
  "Crystal Palace FC":          ["鎌田大地"],
  "Parma Calcio 1913":          ["鈴木彩艶"],
};

// 取得するリーグ
const COMPETITIONS = [
  { code: 'PL',  league: 'EPL',          lClass: 'l-epl'    },
  { code: 'PD',  league: 'LaLiga',       lClass: 'l-laliga' },
  { code: 'BL1', league: 'Bundesliga',   lClass: 'l-bund'   },
  { code: 'SA',  league: 'Serie A',      lClass: 'l-serie'  },
  { code: 'FL1', league: 'Ligue 1',      lClass: 'l-ligue'  },
  { code: 'PPL', league: 'Liga Portugal',lClass: 'l-ligap'  },
  { code: 'DED', league: 'Eredivisie',   lClass: 'l-erediv' },
  { code: 'SPL', league: 'Scottish Prem',lClass: 'l-scot'   },
  { code: 'CL',  league: 'Champions League', lClass: 'l-champ' },
  { code: 'EL',  league: 'Europa League',    lClass: 'l-uel'   },
];

async function fetchMatches(code) {
  const today = new Date().toISOString().split('T')[0];
  // 30日先まで取得
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const url = `${BASE}/competitions/${code}/matches?dateFrom=${today}&dateTo=${future}&status=SCHEDULED`;

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (!res.ok) {
    console.warn(`Skip ${code}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.matches || [];
}

async function main() {
  const allMatches = [];

  for (const comp of COMPETITIONS) {
    const matches = await fetchMatches(comp.code);

    for (const m of matches) {
      const homeName = m.homeTeam.name;
      const awayName = m.awayTeam.name;
      const japanese = [
        ...(JAPANESE_PLAYERS[homeName] || []),
        ...(JAPANESE_PLAYERS[awayName] || []),
      ];

      allMatches.push({
        kickoffUTC: m.utcDate,
        home:       homeName,
        away:       awayName,
        league:     comp.league,
        lClass:     comp.lClass,
        japanese,
      });
    }

    // レート制限対策：1秒待つ
    await new Promise(r => setTimeout(r, 1000));
  }

  // 時刻順にソート
  allMatches.sort((a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC));

  const output = {
    updatedAt: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    matches: allMatches,
  };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/matches.json', JSON.stringify(output, null, 2));
  console.log(`保存完了: ${allMatches.length}試合`);
}

main().catch(console.error);
JSEOF
cat /tmp/fetch.js
