const fs = require('fs');

async function main() {
  const apiKey = process.env.RAPIDAPI_KEY;
  
  // 現在の日付を YYYY-MM-DD 形式で取得
  const today = new Date().toISOString().split('T');
  
  // 日付をURLのクエリパラメータとして動的に追加
  // ※お使いのAPI仕様に合わせてパラメータ名（dateなど）を調整してください
  const url = `https://free-api-live-football-data.p.rapidapi.com/football-get-all-matches-by-league?leagueid=42&date=${today}`;

  const headers = {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com'
  };

  console.log(`${today} のデータを取得中...`);
  const res = await fetch(url, { headers });
  
  if (!res.ok) {
    throw new Error(`APIエラー: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!fs.existsSync('data')) fs.mkdirSync('data');
  fs.writeFileSync('data/matches.json', JSON.stringify(data, null, 2));
  console.log("保存完了！");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
