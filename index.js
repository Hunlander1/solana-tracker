const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

let activeAlerts = {};
let mintTimeCache = {}; 

async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID, text: message, parse_mode: 'HTML'
    });
  } catch (e) { console.log("Telegram Error"); }
}

async function getMintTime(mint) {
  if (mintTimeCache[mint]) return mintTimeCache[mint];
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const response = await axios.get(url);
    const pairs = response.data.pairs;
    if (pairs && pairs.length > 0) {
      const creationTime = Math.floor(pairs[0].pairCreatedAt / 1000);
      mintTimeCache[mint] = creationTime;
      return creationTime;
    }
  } catch (e) { console.log("Dex check failed"); }
  return null;
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const data = req.body;
  const transactions = Array.isArray(data) ? data : (data.data ? data.data : [data]);

  for (let tx of transactions) {
    try {
      const tokenAddress = tx.postTokenBalances?.find(b => b.mint !== "So11111111111111111111111111111111111111112")?.mint;
      if (!tokenAddress) continue;

      const buyer = tx.feePayer || (tx.signer && tx.signer[0]);
      const txTime = tx.blockTime || Math.floor(Date.now() / 1000);

      const creationTime = await getMintTime(tokenAddress);
      if (!creationTime) continue;

      const ageInSeconds = txTime - creationTime;

      if (ageInSeconds <= 60 && ageInSeconds >= 0) {
        if (!activeAlerts[tokenAddress]) activeAlerts[tokenAddress] = new Set();
        activeAlerts[tokenAddress].add(buyer);

        if (activeAlerts[tokenAddress].size === 3) {
          const msg = `🚨 <b>3-WALLET SIGNAL</b> 🚨\n\nToken: <code>${tokenAddress}</code>\nAge: ${ageInSeconds}s\n\n<a href="https://dexscreener.com/solana/${tokenAddress}">View on DexScreener</a>`;
          await sendTelegram(msg);
          delete activeAlerts[tokenAddress];
        }
      }
    } catch (err) { }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log("Bot Live on Render."); });
