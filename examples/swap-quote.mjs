/**
 * Carbium Swap API — get a swap quote
 *
 * Endpoint:  https://services.carbium.sh   (JSON-RPC method `quote`)
 * Auth:      your carbium.sh key in the `x-api-key` header
 * Docs:      https://carbium.io/docs/quick-start-dex-api
 *
 * Quotes use the same key as the RPC recipes. The account needs the Quote
 * module: add it on https://carbium.sh under MODULES. Without it the call
 * answers 403 with -32050.
 *
 * This is read-only. Getting a quote signs nothing and sends nothing.
 *
 *   CARBIUM_SH_KEY=... node examples/swap-quote.mjs
 */
const ENDPOINT = "https://services.carbium.sh";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": process.env.CARBIUM_SH_KEY },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "quote",
    params: [
      {
        src_mint: SOL,
        dst_mint: USDC,
        amount_in: String(1_000_000_000), // 1 SOL, in lamports (9 decimals)
        slippage_bps: 50, // 0.50%
      },
    ],
  }),
});

const { result: q, error } = await res
  .json()
  .catch(() => ({ error: { code: res.status, message: "the response was not JSON" } }));

if (error) {
  // Refusals are JSON-RPC errors, e.g. 401 -32001 "unknown api key" or
  // 403 -32050 "module not enabled for this account". Some arrive with HTTP 200,
  // so check for `error`, not only the HTTP status.
  console.error(`✗ HTTP ${res.status}, ${error.code}: ${error.message}`);
  process.exit(1);
}

const route = [...new Set(q.routePlan.map((leg) => leg.swapInfo.label))].join(", ");

console.log(`in            1 SOL`);
console.log(`out           ${(Number(q.destAmountOut) / 1e6).toFixed(6)} USDC`);
console.log(`min received  ${(Number(q.minAmountOut) / 1e6).toFixed(6)} USDC`);
console.log(`slippage      ${q.slippageBps / 100}%`);
console.log(`route         ${q.routePlan.length} leg(s) via ${route}`);
console.log(`quote id      ${q.quoteId} (valid for 30 s)`);
