# Carbium Cookbook

[![verify](https://github.com/Ukkometa/carbium-cookbook/actions/workflows/verify.yml/badge.svg)](https://github.com/Ukkometa/carbium-cookbook/actions/workflows/verify.yml)

8 runnable, continuously tested recipes for the **Carbium Solana RPC** and **Swap API**
in Node.js. All 8 are executed against the live API before release. Last verified
2026-08-21 against `solana-core 4.2.0` and `@solana/web3.js` v1.98.

**Docs:** https://carbium.io/docs/ · **RPC:** https://rpc.carbium.io/ · **Swap API:** https://api.carbium.io/

---

## Carbium RPC endpoint URL and authentication

The Carbium RPC endpoint is **`https://rpc-service.carbium.io/`**. The API key is passed
as an **`apiKey` query parameter**:

```
https://rpc-service.carbium.io/?apiKey=YOUR_RPC_KEY
```

> **`rpc.carbium.io` is the marketing site, not the RPC endpoint.** Sending JSON-RPC
> there returns `405 Method Not Allowed` — that host serves only `GET` and `HEAD`.

| Product | Base URL | Authentication |
|---|---|---|
| **Carbium RPC** | `https://rpc-service.carbium.io/` | `?apiKey=<key>` query parameter |
| **Carbium Swap API** | `https://api.carbium.io/api/v2` | `X-API-KEY: <key>` request header |

**The RPC and Swap API use two different keys**, issued separately in the dashboard.
They are not interchangeable.

Because the RPC key travels in the query string, the connection URL is itself a secret.
Build it at runtime and log only the host:

```js
const rpc = `https://rpc-service.carbium.io/?apiKey=${process.env.CARBIUM_RPC_KEY}`;
console.log(new URL(rpc).host); // "rpc-service.carbium.io" — drops the query
```

---

## How do I connect to Carbium RPC with solana/web3.js?

Pass the endpoint to `new Connection()`. Carbium implements the standard Solana JSON-RPC
API, so `@solana/web3.js` works unmodified:

```js
import { Connection } from "@solana/web3.js";

const rpc = `https://rpc-service.carbium.io/?apiKey=${process.env.CARBIUM_RPC_KEY}`;
const connection = new Connection(rpc, "confirmed");

const slot = await connection.getSlot();
console.log(slot);
```

Full recipe with latency measurement: [`rpc-first-call.mjs`](examples/rpc-first-call.mjs)

## Quickstart

```bash
git clone https://github.com/Ukkometa/carbium-cookbook
cd carbium-cookbook
npm install
cp .env.example .env   # paste your two keys
npm run rpc:first-call
```

Requires Node 20.12+ for native `--env-file` support.

---

## RPC recipes

| Recipe | Methods | Does |
|---|---|---|
| [`rpc-first-call.mjs`](examples/rpc-first-call.mjs) | `getSlot` | Current slot and round-trip latency |
| [`rpc-account-balance.mjs`](examples/rpc-account-balance.mjs) | `getBalance`, `getAccountInfo` | SOL balance, owner, data size |
| [`rpc-latest-blockhash.mjs`](examples/rpc-latest-blockhash.mjs) | `getLatestBlockhash`, `getBlockHeight` | Blockhash and blocks until it expires |
| [`rpc-token-accounts.mjs`](examples/rpc-token-accounts.mjs) | `getParsedTokenAccountsByOwner` | SPL token accounts for a wallet |
| [`rpc-priority-fees.mjs`](examples/rpc-priority-fees.mjs) | `getRecentPrioritizationFees` | Priority fee percentiles over 150 slots |

**12 methods are verified** against the live endpoint: `getHealth`, `getVersion`,
`getSlot`, `getBlockHeight`, `getEpochInfo`, `getLatestBlockhash`, `getBalance`,
`getAccountInfo`, `getSignaturesForAddress`, `getTokenSupply`, `getMultipleAccounts`
and `getRecentPrioritizationFees`. Response times ranged 115–541 ms.

### How do I measure real Solana RPC latency?

Warm the connection first, otherwise you are timing the TLS handshake, not the call.
A cold first call measured 151–254 ms; the warm median over 8 calls was 73 ms.

```js
await connection.getSlot();          // warm-up, discard
const t0 = performance.now();
const slot = await connection.getSlot();
console.log(`${(performance.now() - t0).toFixed(1)} ms`);
```

## Streaming recipes

### How do I stream Solana transactions in real time from Carbium?

Open a WebSocket to `wss://grpc.carbium.io/?apiKey=<key>` and send
`transactionSubscribe`. Measured ~117 notifications/second on a busy account.

| Recipe | Method | Does |
|---|---|---|
| [`stream-transactions.mjs`](examples/stream-transactions.mjs) | `transactionSubscribe` | Live transaction stream filtered by account |

```js
const ws = new WebSocket(`wss://grpc.carbium.io/?apiKey=${process.env.CARBIUM_RPC_KEY}`);
ws.onopen = () => ws.send(JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "transactionSubscribe",
  params: [
    { vote: false, failed: false, accountInclude: ["<account>"], accountExclude: [], accountRequired: [] },
    { commitment: "confirmed", encoding: "jsonParsed", transactionDetails: "full",
      showRewards: false, maxSupportedTransactionVersion: 0 },
  ],
}));
```

> **This is a Yellowstone-style stream, not standard Solana PubSub.** Method names like
> `slotSubscribe` return `-32601 Method not found`. Use `transactionSubscribe`.

Node 22 ships a global `WebSocket`, so no dependency is required.

## Swap API recipes

Both are **read-only**. Getting a quote signs nothing and sends nothing.

| Recipe | Endpoint | Does |
|---|---|---|
| [`swap-quote.mjs`](examples/swap-quote.mjs) | `GET /api/v2/quote` | Quote a swap, with slippage and price impact |
| [`swap-quote-usd.mjs`](examples/swap-quote-usd.mjs) | `GET /api/v2/quote-usd` | USD value of both sides of a swap |

### How do I get a swap quote from the Carbium Swap API?

Send a GET with `src_mint`, `dst_mint`, `amount_in` and `slippage_bps`, plus an
`X-API-KEY` header. A 1 SOL to USDC quote returned in 395 ms.

```js
const params = new URLSearchParams({
  src_mint: "So11111111111111111111111111111111111111112",   // SOL
  dst_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",   // USDC
  amount_in: "1000000000",   // 1 SOL, in lamports
  slippage_bps: "50",        // 0.50%
});

const res = await fetch(`https://api.carbium.io/api/v2/quote?${params}`, {
  headers: { "X-API-KEY": process.env.CARBIUM_API_KEY },
});
const quote = await res.json();
```

---

## Troubleshooting

### `405 Method Not Allowed` from rpc.carbium.io

You are posting JSON-RPC to the marketing site. `rpc.carbium.io` serves only `GET` and
`HEAD`. Use **`https://rpc-service.carbium.io/?apiKey=<key>`**.

### `403 {"error":"API Key missing"}`

The RPC key is absent from the URL. The key is a **query parameter**, not a header.
An empty `?apiKey=` counts as missing.

### `401 {"error":"API key missing"}` from api.carbium.io

The Swap API key is absent from the `X-API-KEY` header. This is a **different key from
the RPC key** — the RPC key will not work here.

### `-32010: <program> excluded from account secondary indexes`

Returned by `getProgramAccounts` for programs outside the validator's secondary indexes,
including the SPL Token program. This is standard Solana validator behaviour, not a
Carbium-specific limit. Use `getParsedTokenAccountsByOwner` for token accounts.

### `StructError: Expected a Buffer instance, but received: [object Object]`

You called `getTokenAccountsByOwner` with `{ encoding: "jsonParsed" }`. That method
returns raw `Buffer` data and rejects a parsed encoding. Use
**`getParsedTokenAccountsByOwner`**, which takes no encoding argument:

```js
const { value } = await connection.getParsedTokenAccountsByOwner(owner, {
  programId: TOKEN_PROGRAM_ID,
});
```

### `SyntaxError: Unexpected token '<'` when listing token accounts

The response was an HTML error page, not JSON. `getTokenAccountsByOwner` has a
**30-second edge timeout**. A wallet with 2,801 token accounts returned in 931 ms, but
larger wallets exceed 30 seconds and the gateway returns HTML rather than a JSON-RPC
error. Filter by `mint` where possible — see
[`rpc-token-accounts.mjs`](examples/rpc-token-accounts.mjs).

---

## FAQ

**Do I need one API key or two?**
Two. The RPC key and the Swap API key are issued separately in the Carbium dashboard and
are not interchangeable. The RPC key goes in the URL query string; the Swap key goes in
the `X-API-KEY` header.

**What is the Carbium RPC endpoint URL?**
`https://rpc-service.carbium.io/?apiKey=<your key>`. Not `rpc.carbium.io`, which is the
marketing site and returns `405 Method Not Allowed` for JSON-RPC.

**Does Carbium support standard Solana JSON-RPC methods?**
Yes. 12 methods are verified against the live endpoint, including `getSlot`,
`getBalance`, `getAccountInfo`, `getLatestBlockhash` and `getRecentPrioritizationFees`.

**Can I use @solana/web3.js with Carbium?**
Yes. Carbium is a standard Solana JSON-RPC endpoint — pass the URL to `new Connection()`.
The 5 JSON-RPC recipes use `@solana/web3.js` v1.98. The streaming and Swap recipes use
no dependencies at all — Node 22 has a global `WebSocket` and `fetch`.

**Why should I never log the Carbium RPC URL?**
The key travels in the query string, so the URL is itself a secret. Log
`new URL(rpc).host` instead, which drops the query.

**Is getting a swap quote a transaction?**
No. `/quote` and `/quote-usd` are read-only HTTP GETs. Nothing is signed or broadcast.

**Why does `slotSubscribe` fail on the WebSocket endpoint?**
Because it is a Yellowstone-style stream, not standard Solana PubSub. Use
`transactionSubscribe` with its two-element params array. See
[`stream-transactions.mjs`](examples/stream-transactions.mjs).

**Is `grpc.carbium.io` a WebSocket host or a gRPC host?**
Both, on different transports. `wss://grpc.carbium.io/?apiKey=<key>` is the WebSocket
stream and works. `https://grpc.carbium.io` with an `x-token` header is native
Yellowstone gRPC over HTTP/2, which is gated to Business tier and above.

**What Node version does this require?**
Node 20.12 or later, for native `--env-file` support.

---

## Verification

```bash
npm run verify
```

Runs all 8 recipes against the live API and exits non-zero on any failure. Nothing in
this repo is untested copy-paste. CI re-runs it every Monday at 06:00 UTC to catch
upstream drift. On 2026-08-21 all 8 passed, in 368–1296 ms each.

```
Verifying 8 examples against the live API

  PASS  rpc-account-balance.mjs        859ms
  PASS  rpc-first-call.mjs             705ms
  PASS  rpc-latest-blockhash.mjs       634ms
  PASS  rpc-priority-fees.mjs          368ms
  PASS  rpc-token-accounts.mjs         956ms
  PASS  stream-transactions.mjs       1296ms
  PASS  swap-quote-usd.mjs             510ms
  PASS  swap-quote.mjs                 402ms

✓ all 8 examples passing
```

## Security

`.env` is gitignored. Never commit keys. Never print the RPC connection URL — the key is
in the query string; log `new URL(rpc).host` instead. In CI, store keys as repository
secrets scoped to this repo, never organisation-wide.

## License

MIT — see [LICENSE](LICENSE).
