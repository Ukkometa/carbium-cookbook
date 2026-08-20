/**
 * Carbium Swap API — price both sides of a swap in USD
 *
 * Endpoint:  https://api.carbium.io/api/v2/quote-usd
 * Auth:      X-API-KEY header (separate from the RPC key)
 * Docs:      https://carbium.io/docs/
 *
 * Same parameters as /quote, but returns the USD value of the input and output
 * instead of token amounts. Useful for showing a fiat figure in a UI, and for
 * spotting a bad route: a large gap between the two sides is value lost.
 *
 *   CARBIUM_API_KEY=... node examples/swap-quote-usd.mjs
 */
const BASE = "https://api.carbium.io/api/v2";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const params = new URLSearchParams({
  src_mint: SOL,
  dst_mint: USDC,
  amount_in: String(1_000_000_000), // 1 SOL
  slippage_bps: "50",
});

const res = await fetch(`${BASE}/quote-usd?${params}`, {
  headers: { "X-API-KEY": process.env.CARBIUM_API_KEY },
});

if (!res.ok) {
  console.error(`✗ HTTP ${res.status} — ${await res.text()}`);
  process.exit(1);
}

const { srcAmountUsd, dstAmountUsd } = await res.json();
const spread = srcAmountUsd - dstAmountUsd;

console.log(`in    $${srcAmountUsd.toFixed(4)}`);
console.log(`out   $${dstAmountUsd.toFixed(4)}`);
console.log(`diff  $${spread.toFixed(4)} (${((spread / srcAmountUsd) * 100).toFixed(3)}%)`);
