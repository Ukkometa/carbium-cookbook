/**
 * Carbium Swap API — get a swap quote
 *
 * Endpoint:  https://api.carbium.io/api/v2/quote
 * Auth:      X-API-KEY header
 * Docs:      https://carbium.io/docs/
 *
 * The Swap API key is SEPARATE from the RPC key. Issued independently in the
 * dashboard; they are not interchangeable.
 *
 * This is read-only. Getting a quote signs nothing and sends nothing.
 *
 *   CARBIUM_API_KEY=... node examples/swap-quote.mjs
 */
const BASE = "https://api.carbium.io/api/v2";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const params = new URLSearchParams({
  src_mint: SOL,
  dst_mint: USDC,
  amount_in: String(1_000_000_000), // 1 SOL, in lamports (9 decimals)
  slippage_bps: "50", // 0.50%
});

const res = await fetch(`${BASE}/quote?${params}`, {
  headers: { "X-API-KEY": process.env.CARBIUM_API_KEY },
});

if (!res.ok) {
  // Auth failures come back as clean JSON, e.g. 401 {"error":"API key missing"}
  console.error(`✗ HTTP ${res.status} — ${await res.text()}`);
  process.exit(1);
}

const q = await res.json();

console.log(`in            1 SOL`);
console.log(`out           ${(Number(q.destAmountOut) / 1e6).toFixed(6)} USDC`);
console.log(`min received  ${(Number(q.destAmountOutMin) / 1e6).toFixed(6)} USDC`);
console.log(`slippage      ${Number(q.slippage) / 100}%`);
console.log(`price impact  ${q.priceImpactPct}%`);
