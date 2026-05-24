const fs = require('fs');

async function main() {
  const apiKey = process.env.RAPIDAPI_KEY;
  
  // 右側のCode SnippetsにあったURLをそのまま持ってきたで！
  const url = 'https://free-api-live-football-data.p.rapidapi.com/football-get-all-matches-by-league?leagueid=42';

  const headers = {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com'
  };

  console.log("データ取得中...");
  const res = await fetch(url, { headers });
  const data = await res.json();

  if (!fs.existsSync('data')) fs.mkdirSync('data');
  fs.writeFileSync('data/matches.json', JSON.stringify(data, null, 2));
  console.log("保存完了！");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
