/**
 * Carbium Swap API — same-mint cycle scanner (arbitrage candidate detection)
 *
 * Endpoint:  https://api.carbium.io/api/v2/quote  and  /quote-usd
 * Auth:      X-API-KEY header (the Swap key, not the RPC key)
 * Docs:      https://carbium.io/docs/solana-arbitrage-quote-engine
 *
 * Carbium's router accepts the SAME mint as src and dst. It then searches for a
 * cycle — USDC → … → USDC — and returns what one round trip would yield. That
 * is a cyclic arbitrage query in a single call, rather than chaining two quotes
 * and hoping the legs still agree.
 *
 * READ THIS BEFORE TRUSTING A POSITIVE NUMBER
 * -------------------------------------------
 * A positive quote is not profit. Two things decide whether it is real:
 *
 *  1. SIZE. Quotes are sized in TOKEN units, so a "profitable" cycle can just be
 *     a rounding artifact on a dust trade. BONK measured +17 bps on ~$0.02 and
 *     -1070 bps on $1,000 — the same cycle, inverted, because size was the only
 *     thing that changed. This scanner therefore sizes every cycle to a fixed
 *     USD notional via /quote-usd, which is the only way the comparison means
 *     anything.
 *
 *  2. COST. A round trip must clear the transaction fee before it is worth
 *     anything, and then survive slippage, competition, and the possibility of
 *     the route failing mid-execution.
 *
 * This scanner stays on the quote side and signs nothing. Clearing the bar here
 * makes a cycle a CANDIDATE worth investigating, not a trade worth taking.
 *
 *   CARBIUM_API_KEY=... node examples/swap-cycle-scanner.mjs [usdNotional]
 */
const KEY = process.env.CARBIUM_API_KEY;
const BASE = "https://api.carbium.io/api/v2";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL = "So11111111111111111111111111111111111111112";

const MINTS = {
  SOL:  [WSOL, 9],
  USDT: ["Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", 6],
  JUP:  ["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", 6],
  BONK: ["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", 5],
};

const NOTIONAL_USD = Number(process.argv[2] ?? 1000);

// Cost of landing one transaction: 5000 lamports base + priority fee.
// 1.2M lamports ≈ 200k compute units at 6 microlamports/CU, the p75 measured by
// examples/rpc-priority-fees.mjs. Override for your own execution profile.
const LAMPORTS_PER_TX = 5_000 + 1_200_000;

const get = async (path) => {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "X-API-KEY": KEY },
    signal: AbortSignal.timeout(25_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 80)}`);
  return r.json();
};

/** USD value of one whole token, via the router rather than a price oracle. */
const usdPerToken = async (mint, decimals) => {
  const one = BigInt(10 ** decimals).toString();
  const q = await get(`/quote-usd?src_mint=${mint}&dst_mint=${USDC}&amount_in=${one}&slippage_bps=50`);
  return q.srcAmountUsd;
};

const solUsd = await usdPerToken(WSOL, 9);
const txCostUsd = (LAMPORTS_PER_TX / 1e9) * solUsd;

console.log(`notional   $${NOTIONAL_USD.toLocaleString()} per cycle`);
console.log(`tx cost    $${txCostUsd.toFixed(4)}  (${LAMPORTS_PER_TX.toLocaleString()} lamports at $${solUsd.toFixed(2)}/SOL)\n`);
console.log("  mint    cycle Δ        gross      net after fee");

let candidates = 0;

for (const [sym, [mint, decimals]] of Object.entries(MINTS)) {
  try {
    const price = await usdPerToken(mint, decimals);
    if (!price) { console.log(`  ${sym.padEnd(6)}  no price`); continue; }

    const amount = BigInt(Math.round((NOTIONAL_USD / price) * 10 ** decimals)).toString();
    const q = await get(`/quote?src_mint=${mint}&dst_mint=${mint}&amount_in=${amount}&slippage_bps=50`);

    const inAmt = BigInt(q.srcAmountIn);
    const outAmt = BigInt(q.destAmountOut);
    // integer-safe: scale before dividing so no precision is lost on big ints
    const bps = Number(((outAmt - inAmt) * 10_000_000n) / inAmt) / 1000;

    const gross = (NOTIONAL_USD * bps) / 10_000;
    const net = gross - txCostUsd;
    const clears = net > 0;
    if (clears) candidates++;

    console.log(
      `  ${sym.padEnd(6)}  ${((bps >= 0 ? "+" : "") + bps.toFixed(2) + " bps").padEnd(13)}` +
      `${("$" + gross.toFixed(4)).padStart(10)}  ${("$" + net.toFixed(4)).padStart(12)}` +
      `${clears ? "   ← CANDIDATE" : ""}`,
    );
  } catch (err) {
    console.log(`  ${sym.padEnd(6)}  ${String(err.message).slice(0, 60)}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.log(
  candidates === 0
    ? `\n0 candidates. Expected — cycles that clear costs are rare and short-lived.`
    : `\n${candidates} candidate(s). Re-quote before acting: these decay within seconds.`,
);
