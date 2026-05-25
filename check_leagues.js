// check_leagues.js
// 使い方: RAPIDAPI_KEY=xxx node check_leagues.js
// 全リーグのデータ有無を確認して結果をCSVで出力

const RAPID_KEY = process.env.RAPIDAPI_KEY;
if (!RAPID_KEY) { console.error('❌ RAPIDAPI_KEY が未設定'); process.exit(1); }

const LEAGUES = [
  {id:42,name:"Champions League"},{id:73,name:"Europa League"},{id:9470,name:"AFC Challenge League"},{id:525,name:"AFC Champions League Elite"},{id:10622,name:"AFC CL Elite Qualification"},{id:9469,name:"AFC Champions League Two"},{id:10511,name:"AFC Summer Olympics Qual (W)"},{id:9841,name:"AFC U20 Asian Cup"},{id:9571,name:"AFC U23 Asian Cup"},{id:289,name:"Africa Cup of Nations"},{id:10608,name:"Africa Cup of Nations Qual"},{id:10508,name:"African Football League"},{id:9428,name:"African Nations Championship"},{id:10474,name:"Arab Club Champions Cup"},{id:11156,name:"Arab Cup Qualification"},{id:9265,name:"ASEAN Championship"},{id:11012,name:"ASEAN Club Championship"},{id:290,name:"Asian Cup"},{id:10609,name:"Asian Cup Qual Playoff"},{id:9833,name:"Asian Games"},{id:10656,name:"Beta Squad vs Amp Charity"},{id:526,name:"CAF Champions League"},{id:10619,name:"CAF CL Qualification"},{id:9468,name:"CAF Confed Cup"},{id:9467,name:"CAF Super Cup"},{id:11011,name:"CAF Women Champions League"},{id:9875,name:"Campeones Cup"},{id:10611,name:"Champions League Qualification"},{id:11548,name:"Choose One adidas"},{id:489,name:"Club Friendlies"},{id:9682,name:"CONCACAF Central American Cup"},{id:297,name:"CONCACAF Champions Cup"},{id:9656,name:"CONCACAF Championship U20"},{id:10621,name:"CONCACAF Championship U20 Qual"},{id:298,name:"CONCACAF Gold Cup"},{id:10603,name:"CONCACAF Gold Cup Women"},{id:9821,name:"CONCACAF Nations League"},{id:11013,name:"CONCACAF W Champions Cup"},{id:11315,name:"Concacaf W Qualifiers"},{id:10216,name:"Conference League"},{id:10615,name:"Conference League Qualification"},{id:9848,name:"CONMEBOL U20 Championship"},{id:44,name:"Copa America"},{id:10368,name:"Copa America Femenina"},{id:45,name:"Copa Libertadores"},{id:11021,name:"Copa Libertadores Femenina"},{id:10618,name:"Copa Libertadores Qualification"},{id:11022,name:"Copa Libertadores U20"},{id:299,name:"Copa Sudamericana"},{id:10623,name:"Copa Sudamericana Qualification"},{id:9849,name:"COSAFA Cup"},{id:300,name:"East Asian Championship"},{id:50,name:"EURO"},{id:10607,name:"EURO Qualification"},{id:288,name:"EURO U21"},{id:10437,name:"EURO U-21 Qualification"},{id:10613,name:"Europa League Qualification"},{id:10242,name:"FIFA Arab Cup"},{id:78,name:"FIFA Club World Cup"},{id:10913,name:"FIFA Club World Cup Qualification"},{id:10703,name:"FIFA Intercontinental Cup"},{id:11032,name:"FIFA U20 Intercontinental Cup"},{id:10369,name:"FIFA U-20 World Cup"},{id:11542,name:"FIFA Women Champions Cup"},{id:10304,name:"Finalissima"},{id:114,name:"Friendlies"},{id:344,name:"Friendlies U-21"},{id:329,name:"Gulf Cup"},{id:11038,name:"King Cup"},{id:11746,name:"Korea Legends Match"},{id:10043,name:"Leagues Cup"},{id:305,name:"Maurice Revello Tournament"},{id:10649,name:"NWSL x Liga MX"},{id:11527,name:"OFC Pro League"},{id:491,name:"Recopa Sudamericana"},{id:9876,name:"SAFF Championship"},{id:9921,name:"SheBelieves Cup W"},{id:10312,name:"Sidemen Charity Match"},{id:11648,name:"Soccer Aid"},{id:9690,name:"Southeast Asian Games"},{id:66,name:"Summer Olympics"},{id:65,name:"Summer Olympics Women"},{id:10498,name:"Summer Olympics Qual CONCACAF W"},{id:9514,name:"The Atlantic Cup"},{id:9806,name:"UEFA Nations League A"},{id:10557,name:"UEFA Nations League A Qual"},{id:10717,name:"UEFA Nations League A Qual 2"},{id:9807,name:"UEFA Nations League B"},{id:10558,name:"UEFA Nations League B Qual"},{id:10718,name:"UEFA Nations League B Qual 2"},{id:9808,name:"UEFA Nations League C"},{id:10719,name:"UEFA Nations League C Qual"},{id:9809,name:"UEFA Nations League D"},{id:74,name:"UEFA Super Cup"},{id:301,name:"UEFA U17 Championship"},{id:287,name:"UEFA U19 Championship"},{id:11129,name:"UEFA Women Europa Cup"},{id:10457,name:"UEFA Women Nations League A"},{id:10458,name:"UEFA Women Nations League B"},{id:10459,name:"UEFA Women Nations League C"},{id:9741,name:"UEFA Youth League"},{id:10371,name:"Women Africa Cup of Nations"},{id:10269,name:"Womens Asian Cup"},{id:9375,name:"Women Champions League"},{id:10612,name:"Women CL Qualification"},{id:292,name:"Women EURO"},{id:10640,name:"Women EURO Qual League A"},{id:10641,name:"Women EURO Qual League B"},{id:10642,name:"Women EURO Qual League C"},{id:10659,name:"Women EURO U17"},{id:10658,name:"Women EURO U19"},{id:293,name:"Women Friendlies"},{id:76,name:"Women World Cup"},{id:77,name:"World Cup FIFA"},{id:10359,name:"WC Qual W Inter-Confederation"},{id:10357,name:"WC Qual W UEFA"},{id:10197,name:"WC Qualification AFC"},{id:10196,name:"WC Qualification CAF"},{id:10198,name:"WC Qualification CONCACAF"},{id:10199,name:"WC Qualification CONMEBOL"},{id:10201,name:"WC Qual Inter-confederation"},{id:10200,name:"WC Qualification OFC"},{id:10195,name:"WC Qualification UEFA"},{id:306,name:"World Cup U17"},{id:296,name:"World Cup U20"}
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkLeague(league) {
  const url = `https://free-api-live-football-data.p.rapidapi.com/football-get-all-matches-by-league?leagueid=${league.id}`;
  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key':  RAPID_KEY,
        'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com',
      },
    });
    if (!res.ok) return { ...league, status: 'error', count: 0, note: `HTTP ${res.status}` };
    const data = await res.json();
    const matches = data?.response?.matches ?? [];

    // 25/26シーズン判定: 2025-06-01 〜 2026-05-31 の試合があるか
    const season2526 = matches.filter(m => {
      const t = m.status?.utcTime || m.timeTS;
      if (!t) return false;
      const d = new Date(typeof t === 'number' ? t : t);
      return d >= new Date('2025-06-01') && d <= new Date('2026-05-31');
    });

    return {
      ...league,
      status: matches.length > 0 ? 'ok' : 'empty',
      count: matches.length,
      season2526: season2526.length,
    };
  } catch (e) {
    return { ...league, status: 'error', count: 0, note: e.message };
  }
}

async function main() {
  console.log(`🔍 全${LEAGUES.length}リーグのデータチェック開始...\n`);
  const results = [];

  for (let i = 0; i < LEAGUES.length; i++) {
    const l = LEAGUES[i];
    process.stdout.write(`[${String(i+1).padStart(3)}/${LEAGUES.length}] ${l.name.padEnd(40)} `);
    const r = await checkLeague(l);
    const icon = r.status === 'ok' ? '✅' : r.status === 'empty' ? '⬜' : '❌';
    console.log(`${icon} 全${r.count}件 / 25-26: ${r.season2526 ?? 0}件`);
    results.push(r);
    await sleep(500);
  }

  // サマリー
  const ok    = results.filter(r => r.status === 'ok');
  const empty = results.filter(r => r.status === 'empty');
  const err   = results.filter(r => r.status === 'error');
  const has2526 = results.filter(r => (r.season2526 ?? 0) > 0);

  console.log('\n========== 結果サマリー ==========');
  console.log(`✅ データあり: ${ok.length}件`);
  console.log(`⬜ データなし: ${empty.length}件`);
  console.log(`❌ エラー:     ${err.length}件`);
  console.log(`📅 25/26シーズンデータあり: ${has2526.length}件`);

  console.log('\n===== 25/26シーズンあり =====');
  has2526.forEach(r => console.log(`  ID:${r.id} ${r.name} (${r.season2526}試合)`));

  // CSV出力
  const csv = ['id,name,status,total,season2526']
    .concat(results.map(r => `${r.id},"${r.name}",${r.status},${r.count},${r.season2526 ?? 0}`))
    .join('\n');
  require('fs').writeFileSync('league_check_result.csv', csv);
  console.log('\n📄 league_check_result.csv に保存しました');
}

main().catch(e => { console.error(e); process.exit(1); });
