// ============================================================
//  SOLANA MULTI-WALLET TRACKER - FIXED VERSION
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
  "AmNMqM5VbPwtG14gLBdtrqZpQrhSzavLkQPufS8CQ7LB", "AMRsSeU5JpqwQWJGNLMpZzRCZSFEwYQYbMnms3dD4311",
  "2bBRwhGoL4fRZk6g8NnhBZywsF8PdLJnBRfWDCEMogD2", "6EDaVsS6enYgJ81tmhEkiKFcb4HuzPUVFZeom6PHUqN3",
  "Aqje5DsN4u2PHmQxGF9PKfpsDGwQRCBhWeLKHCFhSMXk", "HiSo5kykqDPs3EG14Fk9QY4B5RvkuEs8oJTiqPX3EDAn",
  "FxN3VZ4BosL5urG2yoeQ156JSdmavm9K5fdLxjkPmaMR", "JDQKDrc1TQgBRvdFh56tkta5sYcDj1SoP52Eiu64rSrT",
  "HyYNVYmnFmi87NsQqWzLJhUTPBKQUfgfhdbBa554nMFF", "GeUnv1jmtviRbR7Gu1JnXSGkUMUgFVBHuEVQVpTaUX1W",
  "78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2", "8ZN71XTdVo8yRovnGLmNgW3Tgniw6A4J3JGLvPD686FP",
  "DPNPVvoGdwNBY849ryx2JZzakWuWbDTfSUYr8aNfKLwA", "Hp34goKgAhAYW6sw9iFAZofvDTr3DAhtkSKF1R9bAk2P",
  "95ZCf3jKMHeFYvPXVZW3Ek6AEPDyjebosqnc7eNioVMo", "G7NvZKjoVqBDWciSYtWWgUPB7DA1iJavdvH5jty2FAmM",
  "BCagckXeMChUKrHEd6fKFA1uiWDtcmCXMsqaheLiUPJd", "4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9",
  "CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o", "8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6",
  "2T5NgDDidkvhJQg8AHDi74uCFwgp25pYFMRZXBaCUNBH", "515vh1DrPuwMATt9Zoq9kP4sJL9fyojA1dHJu4DQpNRp",
  "GpTXmkdvrTajqkzX1fBmC4BUjSboF9dHgfnqPqj8WAc4", "2ezv4U5HmPpkt2xLsKnw1FyyGmjFBeW7c166p99Hw2xB",
  "EaVboaPxFCYanjoNWdkxTbPvt57nhXGu5i6m9m6ZS2kK", "FAicXNV5FVqtfbpn4Zccs71XcfGeyxBSGbqLDyDJZjke",
  "BAr5csYtpWoNpwhUjixX7ZPHXkUciFZzjBp9uNxZXJPh", "B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC",
  "8HcYptCBAaPFWkmupiSAmysZ6Z8jB7N1c4YhVjhX7zbg", "FFEjC9MHhpQViBPrD2iU6LmV2hEigyhLJaL7MZUZzyD4",
  "FTaSBuVj6w2S7XUa8fw19xrLy57DDr6kZDL6sxDXtvTP", "FSAmbD6jm6SZZQadSJeC1paX3oTtAiY9hTx1UYzVoXqj",
  "G6fUXjMKPJzCY1rveAE6Qm7wy5U3vZgKDJmN1VPAdiZC", "Ar2Y6o1QmrRAskjii1cRfijeKugHH13ycxW5cd7rro1x",
  "5aLY85pyxiuX3fd4RgM3Yc1e3MAL6b7UgaZz6MS3JUfG", "DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt",
  "7BNaxx6KdUYrjACNQZ9He26NBFoFxujQMAfNLnArLGH5", "2NuAgVk3hcb7s4YvP4GjV5fD8eDvZQv5wuN6ZC8igRfV",
  "BCnqsPEtA1TkgednYEebRpkmwFRJDCjMQcKZMMtEdArc", "4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk",
  "5ZuV8eqkvzYFVEKbLvGBdexL2tFv7E5BCd2HZpjqbdg", "FM1YCKED2KaqB8Uat8aB1nsffR1vezr7s6FAEieXJgke",
  "AV7PjXHL5JXZ1YoYRoN9Dsstg1x2UciBupMCXcJP8gUz", "Dzp1SrZ474xwGp6ZEP6cNKo39u9zeXe1YAuTkyZyv3t4",
  "whamNNP9tHoxLg92yHvJPdYhghEoCg1qYTsh5a2oLbx", "HdKJM6Lvfp9aV9tvEMC8AD4GnsbFgMUkHLoK923Sn1ET",
  "5FqUo9aBjsp7QeeyN6Vi2ZmF2fjS4H5EU7wnAQwPy17z", "7hHmfYYR7L8LsCKk5akjtvVu1BbJRgHGJ2n6s7gbeKG4",
  "CjtqWn4toBbJ1feRZBDhz3TwBjbZm5RpES8rvKWTuNtk", "FAX4qRQdiSj2iWDYvkJ21VieVCXGREtwMhEyAHSJ1aqp",
  "9VXuNqqqzniYYW3fRDeaCtUUtqWsEeWWn5umh3aF9h17", "DAEdBmTPEKM6xkwfzC3d411QUe6coKpkND6UURa4CvHC",
  "iPUp3qkm39ycMGbywWFMUyvaDhiiPGXeWXaDtmHNe6C", "CfkaAru9ArJ2tAStYHvbAyRBJL3EhDzsWYV2KYg9shxB",
  "EeLjBXRELqrcWAXbnj8T4jQPS9Qh7UGWiKxovsJ36pZY", "H5Wh4EDvWQT4mShH746V5VDqxHQkaQZyPWfuhy1PRVBg",
  "GH9yk8vgFvHnAD8JZqXxr3hBN1Lr1mJ9NPzrP5mVqiJe", "7hkd2kdx4bMyuUDgktZvykDh69r8YkkrX4kf1sW2C8T6",
  "8ghYW6ftL5kUemfsoA9X37rz3ZnvyMSZRAx1kt1CxpoS", "GKaJNFDp2W5uCYfNKnTPN63tFXKgXgaDSfnTVfksBeq1",
  "DaKpjVJFxq3y4iZcEu12wzpXGCNBkQE587VNACUj15rT", "C4ARzqpvZ4gR3ta89H5Yz7UyPTpRm22BL5U91e5dHTSf",
  "BSFxyBwsHQsDXULygBpsTu6iUmfHUbCr6j4geZSN6YJG", "9Zu8AigeXgFAajBTni2VWw6Wmz7XxDqHmY5nQwdCWAyY",
  "9dkeTBYaHJzxVgVZqympcHmPeQvHtQv1sArZiZuwmhgp", "AQdBYZNy3BZ1vouGUjA1w9Ay7aq7kH5UQSuh4LQWKotY",
  "HTM87R4mgjDdiF6Yfn8duK9vbDmZxiPCTRbGvm7eCAJY", "8i5U2uNBEuTc4zskYP14zbebDg2RSwrrG8REhEnJb97K",
  "7E9jfxCczubz4FXkkVKzUMHXGwzJxyppC4m7y3ew8ATg", "8v6ztxZwhPBNmA6aGrBzzrt6UBf2fZZfsWqZ9Lt47Kpv",
  "6nU2L7MQVUWjtdKHVpuZA9aind73nd3rXC4YFo8KQCy4", "5zCkbcD74hFPeBHwYdwJLJAoLVgHX45AFeR7RzC8vFiD",
  "8HeDT75s5g4CtCimH5B5nySqCiQhtWii8UnZhxBtFo38", "A8Z1ejQGk45EJibBPJviWnM3UvwKSuYun53nSCkWKM52",
  "D9gQ6RhKEpnobPBUdWY5bPQt2p3zGk3iVz6ChpUi2ArA", "BZC7VEj5Y9Ege3cTRGBZW2zW7pjw3hpiSkcAoYKysvue",
  "FgifQEkRkSSXZjf2cJ4c55BhVts2yrNKzmzBLLyicg8b", "EFaQQTGywnD4CjQQvTugUiyVT4LV9G6MsWqiub8X6unN",
  "HUgpmqL6r4Z4iEZiVuNZ6J6QnAsSZpsL8giVyVtz3QhT", "FaBGrHWjcJ8vKnbgUtsdpZjvF7YAAajtQTWmmEHiKtQr",
  "HYWo71Wk9PNDe5sBaRKazPnVyGnQDiwgXCFKvgAQ1ENp", "bwamJzztZsepfkteWRChggmXuiiCQvpLqPietdNfSXa"
]);

// ── STATE ─────────────────────────────────────────────────────
let activeAlerts  = {};
let mintTimeCache = {};

// ── HELPERS ───────────────────────────────────────────────────
function log(msg) {
  const t = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${t}] ${msg}`);
}

async function getMintAge(mint, txTime) {
  if (mintTimeCache[mint]) return txTime - mintTimeCache[mint];
  return new Promise((resolve) => {
    https.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const created = Math.floor(parsed?.pairs?.[0]?.pairCreatedAt / 1000);
          if (created) {
            mintTimeCache[mint] = created;
            resolve(txTime - created);
          } else resolve(null);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function sendTelegram(message) {
  const body = JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.on('error', (e) => log(`[TG ERR] ${e.message}`));
  req.write(body);
  req.end();
}

async function handleTx(tx) {
  try {
    // QuickNode wraps each transaction under a .raw key — unwrap it
    const data = tx?.raw ?? tx;

    const meta        = data?.meta;
    const transaction = data?.transaction || {};
    const message     = transaction?.message || {};

    // Collect all account keys — supports legacy + V0 (loaded addresses)
    const accountKeys = [
      ...(message.accountKeys?.map(k => k?.pubkey ?? k) ?? []),
      ...(data?.accountKeys ?? []),
      ...(meta?.loadedAddresses?.writable ?? []),
      ...(meta?.loadedAddresses?.readonly ?? [])
    ].filter(Boolean);

    const trackedWallet = accountKeys.find(a => WALLETS.has(a));
    if (!trackedWallet) return;

    log(`[WALLET HIT] ${trackedWallet.substring(0, 8)}...`);

    const postBals  = meta?.postTokenBalances ?? [];
    const tokenMint = postBals.find(b => b.mint && b.mint !== SOL_MINT)?.mint;
    if (!tokenMint) {
      log(`[SKIP] No token mint for wallet ${trackedWallet.substring(0, 8)}`);
      return;
    }

    const txTime = data.blockTime ?? Math.floor(Date.now() / 1000);
    const age    = await getMintAge(tokenMint, txTime);

    if (age === null) {
      log(`[SKIP] Could not determine age for ${tokenMint.substring(0, 8)}`);
      return;
    }
    if (age < 0 || age > 60) {
      log(`[SKIP] Token ${tokenMint.substring(0, 8)} age ${age}s outside 0-60s window`);
      return;
    }

    log(`[TX] ${trackedWallet.substring(0, 8)} bought ${tokenMint.substring(0, 8)} | age: ${age}s`);

    if (!activeAlerts[tokenMint]) activeAlerts[tokenMint] = new Set();
    activeAlerts[tokenMint].add(trackedWallet);

    const count = activeAlerts[tokenMint].size;
    log(`[COUNT] ${count}/3 wallets hit ${tokenMint.substring(0, 8)}`);

    if (count >= 3) {
      const msg = `🚨 <b>3-WALLET SIGNAL</b> 🚨\nToken: <code>${tokenMint}</code>\nAge: ${age}s\n\n<a href="https://dexscreener.com/solana/${tokenMint}">DexScreener</a>`;
      sendTelegram(msg);
      log(`[ALERT SENT] ${tokenMint}`);
      delete activeAlerts[tokenMint];
    }
  } catch (e) {
    log(`[ERR] handleTx: ${e.message}`);
  }
}

// ── ROUTES ────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('Tracker Active.'));

app.post('/webhook', (req, res) => {
  res.sendStatus(200); // Always respond immediately — never keep QuickNode waiting

  const body = req.body;

  // QuickNode payload structure:
  // [ { block: { transactions: [ { raw: { meta, transaction } } ] } } ]
  let txs = [];
  try {
    const blocks = Array.isArray(body) ? body : [body];
    for (const item of blocks) {
      const transactions = item?.block?.transactions;
      if (Array.isArray(transactions)) {
        txs.push(...transactions);
      }
    }
  } catch(e) {
    log(`[ERR] Payload parsing: ${e.message}`);
  }

  log(`[PAYLOAD] ${txs.length} transaction(s) in block`);

  if (txs.length > 0) {
    (async () => {
      for (const tx of txs) await handleTx(tx);
    })();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`SOLANA WALLET TRACKER — LIVE | Watching ${WALLETS.size} wallets`));
