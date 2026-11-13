/**
 * Carbium Swap API — price both sides of a swap in USD
 *
 * Endpoint:  https://services.carbium.sh   (JSON-RPC methods `quote` and `prices`)
 * Auth:      your carbium.sh key in the `x-api-key` header (Quote module added)
 * Docs:      https://carbium.io/docs/quick-start-dex-api
 *
 * `quote` returns token amounts. `prices` returns the router's USD price table.
 * Together they give the USD value of the input and the output. Useful for
 * showing a fiat figure in a UI, and for spotting a bad route: a large gap
 * between the two sides is value lost.
 *
 * The price table is cached for 30 s. In a real app, poll it on a timer rather
 * than calling it once per quote.
 *
 *   CARBIUM_RPC_KEY=... node examples/swap-quote-usd.mjs
 */
const ENDPOINT = "https://services.carbium.sh";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DECIMALS = { [SOL]: 9, [USDC]: 6 };

let id = 0;
const call = async (method, params) => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.CARBIUM_RPC_KEY },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: [params] }),
  });
  const { result, error } = await res
    .json()
    .catch(() => ({ error: { code: res.status, message: "the response was not JSON" } }));
  if (error) {
    console.error(`✗ ${method}: HTTP ${res.status}, ${error.code}: ${error.message}`);
    process.exit(1);
  }
  return result;
};

const quote = await call("quote", {
  src_mint: SOL,
  dst_mint: USDC,
  amount_in: String(1_000_000_000), // 1 SOL
  slippage_bps: 50,
});

// Each row is [mint, priceUsd, tvlUsd, quoteMint]. A mint the table does not
// carry is simply absent.
const { rows } = await call("prices", { mints: [SOL, USDC] });
const priceUsd = Object.fromEntries(rows.map(([mint, price]) => [mint, price]));

const usdValue = (mint, atoms) => {
  if (priceUsd[mint] == null) {
    console.error(`✗ no USD price for ${mint}`);
    process.exit(1);
  }
  return (Number(atoms) / 10 ** DECIMALS[mint]) * priceUsd[mint];
};

const srcAmountUsd = usdValue(SOL, quote.srcAmountIn);
const dstAmountUsd = usdValue(USDC, quote.destAmountOut);
const spread = srcAmountUsd - dstAmountUsd;

console.log(`in    $${srcAmountUsd.toFixed(4)}`);
console.log(`out   $${dstAmountUsd.toFixed(4)}`);
console.log(`diff  $${spread.toFixed(4)} (${((spread / srcAmountUsd) * 100).toFixed(3)}%)`);
