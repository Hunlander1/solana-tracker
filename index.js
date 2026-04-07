// ============================================================
//  SOLANA MULTI-WALLET TRACKER
//  Render + QuickNode Webhooks (Solana Wallet Activity Monitor)
// ============================================================

const express = require('express');
const https   = require('https');
const app     = express();
app.use(express.json({ limit: '50mb' }));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID        = process.env.CHAT_ID;
const SOL_MINT       = 'So11111111111111111111111111111111111111112';

const WALLETS = new Set([
  "CzbN6T1gKkKutvuPXcxNmV8FLqzjsDWebWmg9o8e2ZbU", "H8s4GoDcABkvykQSS7mUSHTSKUcxivoULUXgZDkjuoUf",
  "AmNMqM5VbPwtG14gLBdtrqZpQrhSzavLkQPufS8CQ7LB",  "AMRsSeU5JpqwQWJGNLMpZzRCZSFEwYQYbMnms3dD4311",
  "2bBRwhGoL4fRZk6g8NnhBZywsF8PdLJnBRfWDCEMogD2",  "6EDaVsS6enYgJ81tmhEkiKFcb4HuzPUVFZeom6PHUqN3",
  "Aqje5DsN4u2PHmQxGF9PKfpsDGwQRCBhWeLKHCFhSMXk",  "HiSo5kykqDPs3EG14Fk9QY4B5RvkuEs8oJTiqPX3EDAn",
  "FxN3VZ4BosL5urG2yoeQ156JSdmavm9K5fdLxjkPmaMR",  "JDQKDrc1TQgBRvdFh56tkta5sYcDj1SoP52Eiu64rSrT",
  "HyYNVYmnFmi87NsQqWzLJhUTPBKQUfgfhdbBa554nMFF",  "GeUnv1jmtviRbR7Gu1JnXSGkUMUgFVBHuEVQVpTaUX1W",
  "78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2",  "8ZN71XTdVo8yRovnGLmNgW3Tgniw6A4J3JGLvPD686FP",
  "DPNPVvoGdwNBY849ryx2JZzakWuWbDTfSUYr8aNfKLwA",  "Hp34goKgAhAYW6sw9iFAZofvDTr3DAhtkSKF1R9bAk2P",
  "95ZCf3jKMHeFYvPXVZW3Ek6AEPDyjebosqnc7eNioVMo",  "G7NvZKjoVqBDWciSYtWWgUPB7DA1iJavdvH5jty2FAmM",
  "BCagckXeMChUKrHEd6fKFA1uiWDtcmCXMsqaheLiUPJd",  "4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9",
  "CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o",  "8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6",
  "2T5NgDDidkvhJQg8AHDi74uCFwgp25pYFMRZXBaCUNBH",  "515vh1DrPuwMATt9Zoq9kP4sJL9fyojA1dHJu4DQpNRp",
  "GpTXmkdvrTajqkzX1fBmC4BUjSboF9dHgfnqPqj8WAc4",  "2ezv4U5HmPpkt2xLsKnw1FyyGmjFBeW7c166p99Hw2xB",
  "EaVboaPxFCYanjoNWdkxTbPvt57nhXGu5i6m9m6ZS2kK",  "FAicXNV5FVqtfbpn4Zccs71XcfGeyxBSGbqLDyDJZjke",
  "BAr5csYtpWoNpwhUjixX7ZPHXkUciFZzjBp9uNxZXJPh",  "B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC",
  "8HcYptCBAaPFWkmupiSAmysZ6Z8jB7N1c4YhVjhX7zbg",  "FFEjC9MHhpQViBPrD2iU6LmV2hEigyhLJaL7MZUZzyD4",
  "FTaSBuVj6w2S7XUa8fw19xrLy57DDr6kZDL6sxDXtvTP",  "FSAmbD6jm6SZZQadSJeC1paX3oTtAiY9hTx1UYzVoXqj",
  "G6fUXjMKPJzCY1rveAE6Qm7wy5U3vZgKDJmN1VPAdiZC",  "Ar2Y6o1QmrRAskjii1cRfijeKugHH13ycxW5cd7rro1x",
  "5aLY85pyxiuX3fd4RgM3Yc1e3MAL6b7UgaZz6MS3JUfG",  "DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt",
  "7BNaxx6KdUYrjACNQZ9He26NBFoFxujQMAfNLnArLGH5",  "2NuAgVk3hcb7s4YvP4GjV5fD8eDvZQv5wuN6ZC8igRfV",
  "BCnqsPEtA1TkgednYEebRpkmwFRJDCjMQcKZMMtEdArc",  "4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk",
  "5ZuV8eqkvzYFVEKbLvGBdexL2tFv7E5BCd2HZpjqbdg",  "FM1YCKED2KaqB8Uat8aB1nsffR1vezr7s6FAEieXJgke",
  "AV7PjXHL5JXZ1YoYRoN9Dsstg1x2UciBupMCXcJP8gUz",  "Dzp1SrZ474xwGp6ZEP6cNKo39u9zeXe1YAuTkyZyv3t4",
  "whamNNP9tHoxLg92yHvJPdYhghEoCg1qYTsh5a2oLbx",   "HdKJM6Lvfp9aV9tvEMC8AD4GnsbFgMUkHLoK923Sn1ET",
  "5FqUo9aBjsp7QeeyN6Vi2ZmF2fjS4H5EU7wnAQwPy17z",  "7hHmfYYR7L8LsCKk5akjtvVu1BbJRgHGJ2n6s7gbeKG4",
  "CjtqWn4toBbJ1feRZBDhz3TwBjbZm5RpES8rvKWTuNtk",  "FAX4qRQdiSj2iWDYvkJ21VieVCXGREtwMhEyAHSJ1aqp",
  "9VXuNqqqzniYYW3fRDeaCtUUtqWsEeWWn5umh3aF9h17",  "DAEdBmTPEKM6xkwfzC3d411QUe6coKpkND6UURa4CvHC",
  "iPUp3qkm39ycMGbywWFMUyvaDhiiPGXeWXaDtmHNe6C",   "CfkaAru9ArJ2tAStYHvbAyRBJL3EhDzsWYV2KYg9shxB",
  "EeLjBXRELqrcWAXbnj8T4jQPS9Qh7UGWiKxovsJ36pZY",  "H5Wh4EDvWQT4mShH746V5VDqxHQkaQZyPWfuhy1PRVBg",
  "GH9yk8vgFvHnAD8JZqXxr3hBN1Lr1mJ9NPzrP5mVqiJe",  "7hkd2kdx4bMyuUDgktZvykDh69r8YkkrX4kf1sW2C8T6",
  "8ghYW6ftL5kUemfsoA9X37rz3ZnvyMSZRAx1kt1CxpoS",  "GKaJNFDp2W5uCYfNKnTPN63tFXKgXgaDSfnTVfksBeq1",
  "DaKpjVJFxq3y4iZcEu12wzpXGCNBkQE587VNACUj15rT",  "C4ARzqpvZ4gR3ta89H5Yz7UyPTpRm22BL5U91e5dHTSf",
  "BSFxyBwsHQsDXULygBpsTu6iUmfHUbCr6j4geZSN6YJG",  "9Zu8AigeXgFAajBTni2VWw6Wmz7XxDqHmY5nQwdCWAyY",
  "9dkeTBYaHJzxVgVZqympcHmPeQvHtQv1sArZiZuwmhgp",  "AQdBYZNy3BZ1vouGUjA1w9Ay7aq7kH5UQSuh4LQWKotY",
  "HTM87R4mgjDdiF6Yfn8duK9vbDmZxiPCTRbGvm7eCAJY",  "8i5U2uNBEuTc4zskYP14zbebDg2RSwrrG8REhEnJb97K",
  "7E9jfxCczubz4FXkkVKzUMHXGwzJxyppC4m7y3ew8ATg",  "8v6ztxZwhPBNmA6aGrBzzrt6UBf2fZZfsWqZ9Lt47Kpv",
  "6nU2L7MQVUWjtdKHVpuZA9aind73nd3rXC4YFo8KQCy4",  "5zCkbcD74hFPeBHwYdwJLJAoLVgHX45AFeR7RzC8vFiD",
  "8HeDT75s5g4CtCimH5B5nySqCiQhtWii8UnZhxBtFo38",  "A8Z1ejQGk45EJibBPJviWnM3UvwKSuYun53nSCkWKM52",
  "D9gQ6RhKEpnobPBUdWY5bPQt2p3zGk3iVz6ChpUi2ArA",  "BZC7VEj5Y9Ege3cTRGBZW2zW7pjw3hpiSkcAoYKysvue",
  "FgifQEkRkSSXZjf2cJ4c55BhVts2yrNKzmzBLLyicg8b",  "EFaQQTGywnD4CjQQvTugUiyVT4LV9G6MsWqiub8X6unN",
  "HUgpmqL6r4Z4iEZiVuNZ6J6QnAsSZpsL8giVyVtz3QhT",  "FaBGrHWjcJ8vKnbgUtsdpZjvF7YAAajtQTWmmEHiKtQr",
  "HYWo71Wk9PNDe5sBaRKazPnVyGnQDiwgXCFKvgAQ1ENp",  "bwamJzztZsepfkteWRChggmXuiiCQvpLqPietdNfSXa"
]);

// ── STATE ─────────────────────────────────────────────────────
let activeAlerts  = {};
let mintTimeCache = {};

// ── HELPERS ───────────────────────────────────────────────────
function log(msg) {
  const t = new Date().toLocaleTimeString('en-US', {
    hour12: true,
    timeZone: 'America/Toronto'
  });
  console.log(`[${t}] ${msg}`);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'wallet-tracker/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed')); }
      });
    }).on('error', reject);
  });
}

function sendTelegram(message) {
  const body = JSON.stringify({
    chat_id: CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) log('[TG] Alert sent!');
          else log(`[TG] Error: ${JSON.stringify(parsed)}`);
        } catch(e) {}
        resolve();
      });
    });
    req.on('error', (e) => { log(`[TG] Request failed: ${e.message}`); resolve(); });
    req.write(body);
    req.end();
  });
}

async function getMintAge(mint, txTime) {
  if (mintTimeCache[mint] !== undefined) {
    return txTime - mintTimeCache[mint];
  }
  try {
    const data = await httpsGet(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`
    );
    const pairs = data?.pairs;
    if (pairs && pairs.length > 0 && pairs[0].pairCreatedAt) {
      const created = Math.floor(pairs[0].pairCreatedAt / 1000);
      mintTimeCache[mint] = created;
      return txTime - created;
    }
  } catch (e) {
    log(`[DEX] Lookup failed for ${mint.substring(0,8)}: ${e.message}`);
  }
  return null;
}

// ── EXTRACT ALL ACCOUNT KEYS FROM A TRANSACTION ──────────────
function extractAccounts(tx) {
  const accounts = new Set();

  // Format 1: parsed webhook format — accountKeys as objects with pubkey
  const keys1 = tx?.transaction?.message?.accountKeys;
  if (Array.isArray(keys1)) {
    keys1.forEach(k => {
      const addr = k?.pubkey ?? k;
      if (typeof addr === 'string') accounts.add(addr);
    });
  }

  // Format 2: flat array of strings
  const keys2 = tx?.accountKeys;
  if (Array.isArray(keys2)) {
    keys2.forEach(k => {
      const addr = k?.pubkey ?? k;
      if (typeof addr === 'string') accounts.add(addr);
    });
  }

  // Format 3: feePayer string
  if (typeof tx?.feePayer === 'string') accounts.add(tx.feePayer);

  // Format 4: versioned transaction loaded addresses
  const loaded = tx?.meta?.loadedAddresses;
  if (loaded) {
    [...(loaded.writable ?? []), ...(loaded.readonly ?? [])].forEach(k => {
      if (typeof k === 'string') accounts.add(k);
    });
  }

  return accounts;
}

// ── EXTRACT TOKEN MINT FROM A TRANSACTION ────────────────────
function extractTokenMint(tx) {
  const postBals = tx?.meta?.postTokenBalances ?? tx?.postTokenBalances ?? [];
  for (const b of postBals) {
    if (b?.mint && b.mint !== SOL_MINT) return b.mint;
  }
  const preBals = tx?.meta?.preTokenBalances ?? tx?.preTokenBalances ?? [];
  for (const b of preBals) {
    if (b?.mint && b.mint !== SOL_MINT) return b.mint;
  }
  return null;
}

// ── PROCESS ONE TRANSACTION ───────────────────────────────────
async function handleTx(tx) {
  try {
    const accounts = extractAccounts(tx);
    if (accounts.size === 0) return;

    const trackedWallet = [...accounts].find(a => WALLETS.has(a));
    if (!trackedWallet) return;

    const tokenMint = extractTokenMint(tx);
    if (!tokenMint) {
      log(`[SKIP] ${trackedWallet.substring(0,8)} — no token mint found`);
      return;
    }

    const txTime = tx?.blockTime ?? Math.floor(Date.now() / 1000);
    const age    = await getMintAge(tokenMint, txTime);

    if (age === null) {
      log(`[SKIP] ${trackedWallet.substring(0,8)} -> ${tokenMint.substring(0,8)} — no DexScreener data`);
      return;
    }

    log(`[TX] ${trackedWallet.substring(0,8)} bought ${tokenMint.substring(0,8)} | age: ${age}s`);

    if (age < 0 || age > 60) {
      log(`[OLD] Token age ${age}s — skipped`);
      return;
    }

    if (!activeAlerts[tokenMint]) activeAlerts[tokenMint] = new Set();
    activeAlerts[tokenMint].add(trackedWallet);

    const count = activeAlerts[tokenMint].size;
    log(`[COUNT] ${count}/3 wallets hit ${tokenMint.substring(0,8)}`);

    if (count >= 3) {
      const msg =
        `🚨 <b>3-WALLET SIGNAL</b> 🚨\n` +
        `Token: <code>${tokenMint}</code>\n` +
        `Age at signal: ${age}s\n` +
        `<a href="https://dexscreener.com/solana/${tokenMint}">DexScreener</a> | ` +
        `<a href="https://solscan.io/token/${tokenMint}">Solscan</a>`;
      await sendTelegram(msg);
      delete activeAlerts[tokenMint];
    }

  } catch (err) {
    log(`[ERR] handleTx: ${err.message}`);
  }
}

// ── EXTRACT TRANSACTIONS FROM ANY QUICKNODE PAYLOAD ──────────
function extractTransactions(body) {
  // QuickNode Webhook block format:
  // [ { block: { transactions: [...], blockTime: ... } } ]
  if (Array.isArray(body)) {
    const txs = body.flatMap(item => {
      if (item?.block?.transactions) {
        const blockTime = item.block.blockTime;
        return item.block.transactions.map(tx => {
          if (!tx.blockTime && blockTime) tx.blockTime = blockTime;
          return tx;
        });
      }
      if (item?.transaction || item?.meta) return [item];
      return [];
    });
    if (txs.length > 0) return txs;
  }

  if (body?.block?.transactions) {
    const blockTime = body.block.blockTime;
    return body.block.transactions.map(tx => {
      if (!tx.blockTime && blockTime) tx.blockTime = blockTime;
      return tx;
    });
  }

  if (Array.isArray(body?.data)) return body.data;
  if (body?.transaction || body?.meta) return [body];

  return [];
}

// ── ROUTES ────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('Wallet tracker is running.'));

app.post('/webhook', (req, res) => {
  res.sendStatus(200); // always respond immediately

  const body = req.body;
  log(`[HIT] ${JSON.stringify(body).substring(0, 200)}`);

  const transactions = extractTransactions(body);
  log(`[INFO] Found ${transactions.length} transaction(s)`);

  if (transactions.length === 0) {
    log('[WARN] No transactions found in payload');
    return;
  }

  // Process in background — never block the response
  (async () => {
    for (const tx of transactions) {
      await handleTx(tx);
    }
  })();
});

// ── START ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log('==============================================');
  log('   SOLANA WALLET TRACKER — LIVE');
  log('==============================================');
  log(`Watching ${WALLETS.size} wallets`);
  log('Waiting for QuickNode webhook hits...');
  log('==============================================');
});
