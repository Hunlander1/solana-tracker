// ============================================================
//  SOLANA MULTI-WALLET TRACKER — WEBSOCKET EDITION
//  Zero credits. No webhook provider. Runs forever for free.
//
//  How it works:
//  - Opens a persistent WebSocket to a free Solana RPC
//  - Subscribes to logsSubscribe for each of the 84 wallets
//  - When a wallet transacts, Solana pushes the signature
//  - We fetch the full transaction to extract the token mint
//  - Coordination logic + GMGN enrichment + Telegram signal
//
//  Render setup:
//  - Change service type from "Web Service" to "Background Worker"
//    (or keep as Web Service — the /health route keeps it alive)
//  - Environment vars: TELEGRAM_TOKEN, CHAT_ID, GMGN_API_KEY,
//                      SHYFT_API_KEY (your free Shyft key for WSS)
// ============================================================

const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const WebSocket = require('ws');

// ── CONFIG ────────────────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID        = process.env.CHAT_ID;
const GMGN_API_KEY   = process.env.GMGN_API_KEY;
const SHYFT_API_KEY  = process.env.SHYFT_API_KEY;  // free Shyft key for WSS

const SOL_MINT     = 'So11111111111111111111111111111111111111112';
const WINDOW_SECS  = 120;
const MAX_TOKEN_AGE = 3600;

// WSS endpoints — primary is Shyft (free, unlimited RPC), fallback is public Solana
// HTTP RPC for getTransaction calls
const WSS_PRIMARY   = SHYFT_API_KEY
  ? `wss://rpc.shyft.to?api_key=${SHYFT_API_KEY}`
  : 'wss://api.mainnet-beta.solana.com';
const WSS_FALLBACK  = 'wss://api.mainnet-beta.solana.com';
const HTTP_RPC      = SHYFT_API_KEY
  ? `https://rpc.shyft.to?api_key=${SHYFT_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

// ── FIRED ALERTS (file-backed, survives restarts) ─────────────
const FIRED_FILE = '/tmp/fired_alerts.json';

function loadFiredAlerts() {
  try {
    if (fs.existsSync(FIRED_FILE)) {
      const raw = fs.readFileSync(FIRED_FILE, 'utf8');
      return new Set(JSON.parse(raw));
    }
  } catch(e) { log(`[INIT] Could not load fired alerts: ${e.message}`); }
  return new Set();
}

function saveFiredAlert(mint) {
  firedAlerts.add(mint);
  try { fs.writeFileSync(FIRED_FILE, JSON.stringify([...firedAlerts]), 'utf8'); }
  catch(e) { log(`[WARN] Could not save fired alert: ${e.message}`); }
}

// ── WALLETS ───────────────────────────────────────────────────
const WALLETS = [
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
];
const WALLET_SET = new Set(WALLETS);

// ── STATE ─────────────────────────────────────────────────────
let firedAlerts   = loadFiredAlerts();
let activeAlerts  = {};   // tokenMint => { wallets: Set, firstSeenAt }
let creationCache = {};
let skipCache     = {};
let subIdToWallet = {};   // subscription id => wallet address
let ws            = null;
let wsReady       = false;
let reconnectDelay = 5000;
let usingFallback  = false;
let pendingSigs    = new Set(); // debounce: avoid fetching same sig twice

log(`[INIT] Loaded ${firedAlerts.size} previously fired contracts`);

// Cleanup stale windows every 60s
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const mint of Object.keys(activeAlerts)) {
    if (now - activeAlerts[mint].firstSeenAt > WINDOW_SECS) delete activeAlerts[mint];
  }
}, 60000);

// ── HELPERS ───────────────────────────────────────────────────
function log(msg) {
  const t = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Toronto', hour12: true,
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  console.log(`[${t}] ${msg}`);
}

function isActiveHours() {
  const now     = new Date();
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const val     = eastern.getHours() * 60 + eastern.getMinutes();
  return val >= 660 && val < 1080; // 11am–6pm ET
}

// ── HTTP HELPERS ──────────────────────────────────────────────
function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve) => {
    const options = { hostname, path, method: 'GET', headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function httpsPost(url, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

// ── SOLANA RPC: getTransaction ────────────────────────────────
// Called when a log notification arrives — fetches full tx to extract mint
async function getTransaction(signature) {
  const result = await httpsPost(HTTP_RPC, {
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [
      signature,
      { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }
    ]
  });
  return result?.result ?? null;
}

// ── MINT EXTRACTION ───────────────────────────────────────────
function extractMint(tx) {
  const meta     = tx?.meta;
  const msg      = tx?.transaction?.message;
  if (!meta || !msg) return null;

  const postBals = meta.postTokenBalances ?? [];
  const preBals  = meta.preTokenBalances  ?? [];
  const preOwned = new Set(preBals.map(b => b.mint));

  // Prefer a mint that appeared in post but NOT in pre (newly received)
  let mint = postBals.find(b => b.mint && b.mint !== SOL_MINT && !preOwned.has(b.mint))?.mint;
  if (!mint) mint = postBals.find(b => b.mint && b.mint !== SOL_MINT)?.mint;
  return mint ?? null;
}

// ── GMGN ──────────────────────────────────────────────────────
async function gmgnGet(path, params = {}) {
  params.timestamp = Math.floor(Date.now() / 1000).toString();
  params.client_id = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const query   = new URLSearchParams(params).toString();
  const headers = {
    'X-APIKEY':   GMGN_API_KEY,
    'Accept':     'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };
  const parsed = await httpsGet('openapi.gmgn.ai', `${path}?${query}`, headers);
  if (parsed?.code === 0 && parsed?.data) return parsed.data;
  log(`[GMGN] Error ${path}: ${JSON.stringify(parsed)?.substring(0, 100)}`);
  return null;
}

async function fetchTokenInfo(mint) {
  return await gmgnGet('/v1/token/info', { chain: 'sol', address: mint });
}

async function fetchFreshWallets(mint) {
  const data = await gmgnGet('/v1/token/security', { chain: 'sol', address: mint });
  if (!data) return null;
  log(`[GMGN] Security keys: ${Object.keys(data).join(', ')}`);
  return data.fresh_holder_count ?? data.fresh_wallet_count ?? data.fresh_holders ?? data.freshHolder ?? null;
}

async function fetchSameNameCount(symbol) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const parsed = await httpsGet(
      'api.dexscreener.com',
      `/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    );
    if (parsed) {
      const nowMs  = Date.now();
      const cutoff = 5 * 3600 * 1000;
      return (parsed.pairs ?? []).filter(p =>
        p.chainId === 'solana' && p.pairCreatedAt && nowMs - p.pairCreatedAt <= cutoff
      ).length;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return null;
}

async function getTokenAge(mint) {
  const now = Math.floor(Date.now() / 1000);
  if (skipCache[mint]) return -1;
  if (creationCache[mint]) return now - creationCache[mint];
  const info = await fetchTokenInfo(mint);
  if (!info) return null;
  const createdAt = info.creation_timestamp;
  if (!createdAt) return null;
  creationCache[mint] = createdAt;
  const age = now - createdAt;
  if (age > MAX_TOKEN_AGE) { skipCache[mint] = true; return -1; }
  return age;
}

// ── TELEGRAM ──────────────────────────────────────────────────
function sendTelegram(message) {
  const body = JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' });
  const req  = https.request({
    hostname: 'api.telegram.org',
    path:     `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const p = JSON.parse(d);
        if (!p.ok) log(`[TG Error] ${p.description}`);
        else log(`[TG] Signal delivered`);
      } catch { log(`[TG Error] Parse failed`); }
    });
  });
  req.on('error', e => log(`[TG ERR] ${e.message}`));
  req.write(body);
  req.end();
}

// ── SIGNAL ────────────────────────────────────────────────────
async function buildAndSendSignal(tokenMint, walletCount, elapsed, tokenInfo) {
  try {
    const now = Math.floor(Date.now() / 1000);
    let symbol = 'UNKNOWN', mintTimeStr = 'N/A', ageStr = 'N/A';
    let liquidityStr = 'N/A', marketCapStr = 'N/A';

    if (tokenInfo) {
      symbol = tokenInfo.symbol ?? 'UNKNOWN';
      const createdAt = tokenInfo.creation_timestamp;
      if (createdAt) {
        mintTimeStr = new Date(createdAt * 1000).toLocaleTimeString('en-US', {
          timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
        const s = now - createdAt;
        ageStr = s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;
      }
      const liq = parseFloat(tokenInfo.liquidity);
      if (!isNaN(liq)) liquidityStr = `$${liq.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      const mc = parseFloat(tokenInfo.market_cap ?? tokenInfo.usd_market_cap);
      if (!isNaN(mc)) marketCapStr = `$${mc.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }

    const [sameNameCount, freshWallets] = await Promise.all([
      symbol !== 'UNKNOWN' ? fetchSameNameCount(symbol) : Promise.resolve(null),
      fetchFreshWallets(tokenMint)
    ]);

    const signalTime = new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    sendTelegram(
      `🚨 <b>3-Wallet Signal</b>\n\n` +
      `Token: #${symbol}\n` +
      `Contract: <code>${tokenMint}</code>\n` +
      `Mint Time: ${mintTimeStr}\n` +
      `Token Age: ${ageStr}\n` +
      `Liquidity: ${liquidityStr}\n` +
      `Market Cap: ${marketCapStr}\n` +
      `Same-Name Count (5h): ${sameNameCount !== null ? sameNameCount : '?'}\n` +
      `Fresh Wallets: ${freshWallets !== null ? freshWallets : 'N/A'}\n` +
      `Wallets Coordinated: ${walletCount} within ${elapsed}s\n\n` +
      `Signal Time: ${signalTime}\n\n` +
      `<a href="https://gmgn.ai/sol/token/${tokenMint}">GMGN</a>`
    );
    log(`[ALERT] Signal sent for #${symbol} (${tokenMint.substring(0, 8)})`);
  } catch(e) { log(`[ERR] buildAndSendSignal: ${e.message}`); }
}

// ── COORDINATION LOGIC ────────────────────────────────────────
async function handleWalletBuy(trackedWallet, tokenMint) {
  if (firedAlerts.has(tokenMint)) {
    log(`[SKIP] ${tokenMint.substring(0, 8)} already signalled`);
    return;
  }

  const age = await getTokenAge(tokenMint);
  if (age === -1) { log(`[SKIP] ${tokenMint.substring(0, 8)} > 1hr old`); return; }
  if (age === null) log(`[WARN] Age unknown for ${tokenMint.substring(0, 8)} — allowing`);
  else log(`[AGE] ${tokenMint.substring(0, 8)} is ${age < 60 ? age+'s' : Math.floor(age/60)+'m '+age%60+'s'} old`);

  const now = Math.floor(Date.now() / 1000);

  if (!activeAlerts[tokenMint]) {
    activeAlerts[tokenMint] = { wallets: new Set(), firstSeenAt: now };
  }

  const entry = activeAlerts[tokenMint];

  if (now - entry.firstSeenAt > WINDOW_SECS) {
    log(`[RESET] ${tokenMint.substring(0, 8)} window expired — resetting`);
    activeAlerts[tokenMint] = { wallets: new Set(), firstSeenAt: now };
  }

  entry.wallets.add(trackedWallet);
  const count = entry.wallets.size;
  log(`[COUNT] ${count}/3 for ${tokenMint.substring(0, 8)} within ${now - entry.firstSeenAt}s`);

  if (count >= 3) {
    const elapsed = now - entry.firstSeenAt;
    saveFiredAlert(tokenMint);
    delete activeAlerts[tokenMint];
    const tokenInfo = await fetchTokenInfo(tokenMint);
    await buildAndSendSignal(tokenMint, count, elapsed, tokenInfo);
  }
}

// ── PROCESS LOG NOTIFICATION ──────────────────────────────────
async function processLogNotification(params) {
  if (!isActiveHours()) return; // 11am-6pm ET only

  // Solana logsNotification structure:
  // params = { subscription: <subId>, result: { context: { slot }, value: { signature, err, logs } } }
  const value = params?.result?.value;
  const subId = params?.subscription;

  if (!value) {
    log(`[DEBUG] No value in notification — raw: ${JSON.stringify(params)?.substring(0, 120)}`);
    return;
  }

  // Skip failed transactions
  if (value.err !== null && value.err !== undefined) return;

  const signature = value.signature;
  const trackedWallet = subIdToWallet[subId];

  if (!trackedWallet) return;
  log(`[LOG HIT] wallet ${trackedWallet.substring(0, 8)} | sig ${signature.substring(0, 12)}...`);

  // Debounce: same sig can fire for multiple wallet subs if two tracked wallets are in same tx
  if (pendingSigs.has(signature)) {
    log(`[DEBOUNCE] ${signature.substring(0, 12)} already being processed`);
    return;
  }
  pendingSigs.add(signature);
  setTimeout(() => pendingSigs.delete(signature), 30000);

  // Fetch full transaction to extract the token mint
  let tx = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    tx = await getTransaction(signature);
    if (tx) break;
    log(`[RPC] getTransaction attempt ${attempt + 1} failed, retrying...`);
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!tx) {
    log(`[SKIP] Could not fetch tx ${signature.substring(0, 12)}`);
    return;
  }

  const mint = extractMint(tx);
  if (!mint) {
    log(`[SKIP] No token mint in tx for ${trackedWallet.substring(0, 8)}`);
    return;
  }

  log(`[MINT] ${trackedWallet.substring(0, 8)} bought ${mint.substring(0, 8)}`);
  await handleWalletBuy(trackedWallet, mint);
}

// ── WEBSOCKET ─────────────────────────────────────────────────
let reqIdToWallet = {};  // request id => wallet (set when we send subscribe)

function connect(useUrl) {
  const url = useUrl ?? (usingFallback ? WSS_FALLBACK : WSS_PRIMARY);
  log(`[WS] Connecting to ${usingFallback ? 'FALLBACK' : 'PRIMARY'} endpoint...`);

  ws = new WebSocket(url, { handshakeTimeout: 30000 });
  subIdToWallet = {};
  reqIdToWallet = {};
  wsReady = false;

  ws.on('open', () => {
    log(`[WS] Connected — subscribing to ${WALLETS.length} wallets...`);
    wsReady = true;
    reconnectDelay = 5000;

    // Build reqId→wallet map BEFORE sending, so order doesn't matter
    WALLETS.forEach((wallet, i) => {
      const reqId = i + 1;
      reqIdToWallet[reqId] = wallet;
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: reqId,
        method: 'logsSubscribe',
        params: [
          { mentions: [wallet] },
          { commitment: 'confirmed' }
        ]
      }));
    });

    log(`[WS] All ${WALLETS.length} subscription requests sent`);

    // Ping every 30s to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); }
    catch { return; }

    // Subscription confirmation: Solana returns { id: <our req id>, result: <sub id> }
    // Use reqIdToWallet (reliable) not array index (order-dependent)
    if (msg.id !== undefined && msg.result !== undefined && typeof msg.result === 'number' && !msg.method) {
      const wallet = reqIdToWallet[msg.id];
      if (wallet) {
        subIdToWallet[msg.result] = wallet;
        const confirmed = Object.keys(subIdToWallet).length;
        if (confirmed % 10 === 0) log(`[WS] ${confirmed}/${WALLETS.length} subscriptions confirmed`);
        if (confirmed === WALLETS.length) log(`[WS] ✅ All ${WALLETS.length} subscriptions active`);
      }
      return;
    }

    // Log notification — log every single one so we know they're arriving
    if (msg.method === 'logsNotification') {
      const subId = msg.params?.subscription;
      const wallet = subIdToWallet[subId];
      log(`[WS] logsNotification subId=${subId} mapped=${wallet ? wallet.substring(0,8) : 'UNKNOWN'}`);
      processLogNotification(msg.params).catch(e => log(`[ERR] processLogNotification: ${e.message}`));
    }
  });

  ws.on('error', (e) => {
    log(`[WS] Error: ${e.message}`);
  });

  ws.on('close', (code, reason) => {
    wsReady = false;
    log(`[WS] Disconnected (code: ${code}). Reconnecting in ${reconnectDelay / 1000}s...`);

    // Try fallback endpoint if primary keeps failing
    if (reconnectDelay >= 30000 && !usingFallback && WSS_PRIMARY !== WSS_FALLBACK) {
      log(`[WS] Switching to fallback endpoint`);
      usingFallback = true;
      reconnectDelay = 5000;
    }

    setTimeout(() => connect(), reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 60000); // exponential backoff, max 60s
  });
}

// ── HEALTH CHECK SERVER ───────────────────────────────────────
// Keeps Render from spinning down the service (free tier spins down on no HTTP traffic)
const server = http.createServer((req, res) => {
  const subCount = Object.keys(subIdToWallet).length;
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(
    `SOLANA WALLET TRACKER — LIVE\n` +
    `WS: ${wsReady ? 'connected' : 'reconnecting'}\n` +
    `Subscriptions: ${subCount}/${WALLETS.length}\n` +
    `Fired alerts: ${firedAlerts.size}\n` +
    `Active windows: ${Object.keys(activeAlerts).length}\n`
  );
});

server.listen(process.env.PORT || 3000, () => {
  log(`[HTTP] Health server on port ${process.env.PORT || 3000}`);
});

// ── START ─────────────────────────────────────────────────────
log(`[START] Launching WebSocket tracker | ${WALLETS.length} wallets | Active 11am-6pm ET`);
log(`[START] WSS primary: ${WSS_PRIMARY.replace(/api_key=[^&]+/, 'api_key=***')}`);
connect();

// ── SELF-PING (keeps Render free tier from sleeping) ──────────
// Render spins down free services after ~15min of no HTTP traffic.
// We ping our own health endpoint every 10 minutes to stay awake.
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || null;
setInterval(() => {
  if (!RENDER_URL) return;
  try {
    const mod = RENDER_URL.startsWith('https') ? https : http;
    const req = mod.get(RENDER_URL + '/', (res) => {
      log(`[PING] Self-ping OK (${res.statusCode})`);
    });
    req.on('error', (e) => log(`[PING] Self-ping failed: ${e.message}`));
    req.setTimeout(10000, () => req.destroy());
  } catch(e) {
    log(`[PING] Self-ping error: ${e.message}`);
  }
}, 10 * 60 * 1000); // every 10 minutes
