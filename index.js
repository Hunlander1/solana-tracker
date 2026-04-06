const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json({ limit: '10mb' }));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

let activeAlerts = {};
let mintTimeCache = {};

async function sendTelegram(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: message, parse_mode: 'HTML' }
    );
    console.log('[TG] Message sent');
  } catch (e) {
    console.log('[TG] Error:', e.message);
  }
}

async function getMintTime(mint) {
  if (mintTimeCache[mint]) return mintTimeCache[mint];
  try {
    const r = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { timeout: 5000 }
    );
    const pairs = r.data?.pairs;
    if (pairs && pairs.length > 0) {
      const t = Math.floor(pairs[0].pairCreatedAt / 1000);
      mintTimeCache[mint] = t;
      return t;
    }
  } catch (e) {
    console.log(`[DEX] No data for ${mint.substring(0,8)}: ${e.message}`);
  }
  return null;
}

// ── DEBUG: log every raw hit ──────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // always ack fast

  const body = req.body;
  console.log('──────────────────────────────');
  console.log('[HIT] QuickNode payload keys:', Object.keys(body));
  console.log('[HIT] Raw (first 500 chars):', JSON.stringify(body).substring(0, 500));

  // QuickNode can wrap in { data: [...] } OR send array directly
  let transactions = [];
  if (Array.isArray(body)) {
    transactions = body;
  } else if (Array.isArray(body.data)) {
    transactions = body.data;
  } else if (body.transaction) {
    transactions = [body]; // single tx
  } else {
    console.log('[WARN] Unknown payload shape — dumping full body:');
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  console.log(`[INFO] Processing ${transactions.length} transaction(s)`);

  for (const tx of transactions) {
    try {
      const buyer = tx.feePayer
        || tx.transaction?.message?.accountKeys?.[0]
        || 'unknown';

      // Token = first non-SOL mint in postTokenBalances
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const tokenAddress = tx.postTokenBalances?.find(
        b => b.mint && b.mint !== SOL_MINT
      )?.mint;

      if (!tokenAddress) {
        console.log(`[SKIP] No token mint found (feePayer: ${buyer.substring(0,8)})`);
        continue;
      }

      console.log(`[TX] ${buyer.substring(0,8)} → token ${tokenAddress.substring(0,8)}`);

      const txTime = tx.blockTime || Math.floor(Date.now() / 1000);
      const mintTime = await getMintTime(tokenAddress);

      if (!mintTime) {
        console.log(`[SKIP] DexScreener has no pair for ${tokenAddress.substring(0,8)}`);
        continue;
      }

      const age = txTime - mintTime;
      console.log(`[AGE] Token is ${age}s old`);

      if (age >= 0 && age <= 60) {
        if (!activeAlerts[tokenAddress]) activeAlerts[tokenAddress] = new Set();
        activeAlerts[tokenAddress].add(buyer);

        const count = activeAlerts[tokenAddress].size;
        console.log(`[ALERT] ${count}/3 wallets hit ${tokenAddress.substring(0,8)}`);

        if (count >= 3) {
          const msg = `🚨 3-WALLET SIGNAL\n`
            + `Token: ${tokenAddress}\n`
            + `Age: ${age}s\n`
            + `DexScreener`;
          await sendTelegram(msg);
          delete activeAlerts[tokenAddress];
        }
      } else {
        console.log(`[OLD] Skipped — age ${age}s exceeds limit`);
      }
    } catch (err) {
      console.log('[ERR] tx processing failed:', err.message);
    }
  }
});

app.get('/', (req, res) => res.send('Bot alive'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[START] Bot live on port ${PORT}`));
