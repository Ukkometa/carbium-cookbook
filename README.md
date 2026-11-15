# Carbium Cookbook

[![verify](https://github.com/Ukkometa/carbium-cookbook/actions/workflows/verify.yml/badge.svg)](https://github.com/Ukkometa/carbium-cookbook/actions/workflows/verify.yml)

11 runnable, continuously tested recipes for **Carbium RPC**, **Carbon Stream** (Solana
gRPC) and the **Carbium Swap API** in Node.js. All 11 are executed against the live
service before release. Last verified 2026-11-15 against `solana-core 4.4.1`,
`@solana/web3.js` v1.98 and `@triton-one/yellowstone-grpc` 8.0.0.

**Page:** https://www.carbium.io **Docs:** https://carbium.io/docs/ · **RPC:** https://rpc.carbium.io/ · **Swap API:** https://api.carbium.io/ · **Keys:** https://carbium.sh

---

## Carbium RPC endpoint URL and authentication

The Carbium RPC endpoint is **`https://services.carbium.sh`**. Get a key at
[carbium.sh](https://carbium.sh) and send it as the **`api-key` query parameter** or in
the **`x-api-key` header**:

```
https://services.carbium.sh/?api-key=YOUR_KEY
```

> **`rpc.carbium.io` is the marketing site, not the RPC endpoint.** Sending JSON-RPC
> there returns `405 Method Not Allowed`. That host serves only `GET` and `HEAD`.

| Product | Endpoint | Authentication |
|---|---|---|
| **Carbium RPC** | `https://services.carbium.sh` | `?api-key=<key>` query parameter, or `x-api-key: <key>` header |
| **Carbium RPC** over WebSocket | `wss://services.carbium.sh` | `?api-key=<key>` query parameter, or `x-api-key: <key>` header |
| **Carbium Swap API** | `https://services.carbium.sh`, JSON-RPC methods `quote`, `swap` and `prices` | the same key, once the Quote module is added on carbium.sh |
| **Carbon Stream** | `https://services.carbium.sh:9443`, Yellowstone gRPC | `x-token: <key>` metadata, on a Dev plan or above with the gRPC scope on |

**One key covers all of them.** Use the full key (`c_serv_...`), not the short prefix the
dashboard lists. Every key form is in the [carbium.sh reference](https://carbium.sh/docs#auth).

When the key travels in the query string, the connection URL is itself a secret.
Build it at runtime and log only the host:

```js
const rpc = `https://services.carbium.sh/?api-key=${process.env.CARBIUM_SH_KEY}`;
console.log(new URL(rpc).host); // "services.carbium.sh", without the query
```

To keep the key out of the URL, send it as a header instead:

```js
const connection = new Connection("https://services.carbium.sh", {
  commitment: "confirmed",
  httpHeaders: { "x-api-key": process.env.CARBIUM_SH_KEY },
});
```

---

## How do I connect to Carbium RPC with solana/web3.js?

Pass the endpoint to `new Connection()`. Carbium implements the standard Solana JSON-RPC
API, so `@solana/web3.js` works unmodified:

```js
import { Connection } from "@solana/web3.js";

const rpc = `https://services.carbium.sh/?api-key=${process.env.CARBIUM_SH_KEY}`;
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
cp .env.example .env   # paste your key
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
| [`rpc-token-accounts.mjs`](examples/rpc-token-accounts.mjs) | `getParsedTokenAccountsByOwner` | SPL token accounts for a wallet, filtered by mint |
| [`rpc-priority-fees.mjs`](examples/rpc-priority-fees.mjs) | `getRecentPrioritizationFees` | Priority fee percentiles over 150 slots |

**12 methods are verified** against the live endpoint: `getHealth`, `getVersion`,
`getSlot`, `getBlockHeight`, `getEpochInfo`, `getLatestBlockhash`, `getBalance`,
`getAccountInfo`, `getSignaturesForAddress`, `getTokenSupply`, `getMultipleAccounts`
and `getRecentPrioritizationFees`. Response times ranged 59–244 ms.

### How do I measure real Solana RPC latency?

Warm the connection first, otherwise you are timing the TLS handshake, not the call.
Over four runs a cold first call measured 220–371 ms, and the warm median over 8 calls
ranged 71–106 ms.

```js
await connection.getSlot();          // warm-up, discard
const t0 = performance.now();
const slot = await connection.getSlot();
console.log(`${(performance.now() - t0).toFixed(1)} ms`);
```

## Streaming recipes

### How do I stream Solana transactions in real time from Carbium?

Open a WebSocket to `wss://services.carbium.sh/?api-key=<key>` and send `logsSubscribe`
with `mentions`. Every transaction that touches the account arrives with its signature,
its error if it failed, and its program logs. Measured ~229 notifications/second on a
busy account.

| Recipe | Method | Does |
|---|---|---|
| [`stream-transactions.mjs`](examples/stream-transactions.mjs) | `logsSubscribe` | Live stream of the transactions that touch one account |

```js
const ws = new WebSocket(`wss://services.carbium.sh/?api-key=${process.env.CARBIUM_SH_KEY}`);
ws.onopen = () => ws.send(JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "logsSubscribe",
  params: [{ mentions: ["<account>"] }, { commitment: "confirmed" }],
}));
```

> **The WebSocket serves the standard Solana PubSub methods**, such as `slotSubscribe`,
> `accountSubscribe`, `logsSubscribe` and `blockSubscribe`. `transactionSubscribe` is not
> one of them and returns `-32601 method not found`.

Node 22 ships a global `WebSocket`, so no dependency is required.

## Carbon Stream recipes (Solana gRPC)

### What is Carbon Stream?

**Carbon Stream** is Carbium's Solana gRPC stream, Yellowstone-compatible, at
`https://services.carbium.sh:9443`. It carries full transactions, accounts, slots and
blocks with filters applied on the server. The same key works there as `x-token`
metadata, on a Dev plan or above with the gRPC scope turned on for the key (carbium.sh,
Keys, SCOPE). More in [Solana gRPC Streaming with Carbium](https://carbium.io/docs/solana-grpc).

| Recipe | Filter | Does |
|---|---|---|
| [`grpc-slots.mjs`](examples/grpc-slots.mjs) | `slots` | First stream: confirmed slots as they arrive. If it runs, key, plan and scope are in order |
| [`grpc-account-transactions.mjs`](examples/grpc-account-transactions.mjs) | `transactions` with `accountInclude` | Every transaction that touches an account, with status, fee and SOL balance change |
| [`grpc-resume-from-slot.mjs`](examples/grpc-resume-from-slot.mjs) | `slots` with `fromSlot` | Replays recent slots after a disconnect and catches up with the live edge |

### How do I stream Solana data over gRPC with Carbium?

Use any Yellowstone gRPC client with the endpoint and your key. These recipes use
`@triton-one/yellowstone-grpc` 8.0.0. Put every filter in the first request: filters
cannot change once the stream is open.

```js
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc";

const client = new Client("https://services.carbium.sh:9443", process.env.CARBIUM_SH_KEY, {
  grpcMaxDecodingMessageSize: 64 * 1024 * 1024, // frames can be several MiB
});
await client.connect();

const stream = await client.subscribe({
  accounts: {}, slots: {}, transactionsStatus: {}, blocks: {}, blocksMeta: {}, entry: {},
  accountsDataSlice: [], blockFooter: {},          // every map must be present
  commitment: CommitmentLevel.CONFIRMED,
  transactions: { watched: { accountInclude: ["<account>"], accountExclude: [], accountRequired: [], vote: false } },
});
stream.on("data", (update) => update.transaction && console.log(update.transaction.slot));
```

In one run on 2026-11-15, the first confirmed slot arrived 589 ms after the script
started (connection included), five transactions touching the USDC mint arrived within
0.1 s, and a resume from 20 slots back replayed 22 slots and reached the live edge in
116 ms.

### How do I follow a wallet's transactions over gRPC?

Subscribe `transactions` with `accountInclude: [wallet]`, as
[`grpc-account-transactions.mjs`](examples/grpc-account-transactions.mjs) does with a
wallet address as its first argument. Plain SOL wallets do not arrive as account
updates, so read the balance change from each transaction's `preBalances` and
`postBalances`. There is no startup snapshot: load current state over RPC first.

### How do I resume a Solana gRPC stream after a disconnect?

Call `subscribeReplayInfo()` to learn where the server's replay window starts, then open
a new stream with `fromSlot` set to the last slot you processed (never below
`firstAvailable`), at processed commitment. Replay can start a slot early and overlap
what you have, so dedupe transactions on `(slot, signature)`. See
[`grpc-resume-from-slot.mjs`](examples/grpc-resume-from-slot.mjs).

## Swap API recipes

Both are **read-only**. Getting a quote signs nothing and sends nothing. Quotes need the
Quote module on the account: add it on [carbium.sh](https://carbium.sh) under MODULES.

| Recipe | Methods | Does |
|---|---|---|
| [`swap-quote.mjs`](examples/swap-quote.mjs) | `quote` | Quote a swap, with slippage and the route |
| [`swap-quote-usd.mjs`](examples/swap-quote-usd.mjs) | `quote`, `prices` | USD value of both sides of a swap |

### How do I get a swap quote from the Carbium Swap API?

POST the JSON-RPC method `quote` to `https://services.carbium.sh` with `src_mint`,
`dst_mint`, `amount_in` and `slippage_bps`, plus the `x-api-key` header. Over six calls
a 1 SOL to USDC quote returned in 64–232 ms.

```js
const res = await fetch("https://services.carbium.sh", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": process.env.CARBIUM_SH_KEY },
  body: JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "quote",
    params: [{
      src_mint: "So11111111111111111111111111111111111111112",   // SOL
      dst_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",   // USDC
      amount_in: "1000000000",   // 1 SOL, in lamports
      slippage_bps: 50,          // 0.50%
    }],
  }),
});
const { result: quote, error } = await res.json();
```

A refusal can arrive with HTTP 200, so check for `error` and not only the status. To
turn a quote into a transaction for your own wallet to sign, continue with the
[Quote to Swap Integration Guide](https://carbium.io/docs/quote-to-swap-integration-guide).

---

## Use with AI agents

[`skills/carbium/SKILL.md`](skills/carbium/SKILL.md) is an agent skill: copy the
`skills/carbium` folder into your agent's skills directory. It holds the endpoints, the
auth forms and the rules that save a failed call, and points to
[carbium.sh/skill.md](https://carbium.sh/skill.md), the live reference with every limit,
error and price.

---

## Troubleshooting

### `PERMISSION_DENIED` from Carbon Stream

The key is on the free plan, or its gRPC scope is off. Carbon Stream needs a Dev plan or
above. On carbium.sh, open Keys, press SCOPE on the key, select GRPC and save. A key made
while the account was on the free plan has no gRPC scope until you add it.

### `405 Method Not Allowed` from rpc.carbium.io

You are posting JSON-RPC to the marketing site. `rpc.carbium.io` serves only `GET` and
`HEAD`. Use **`https://services.carbium.sh`** with your carbium.sh key.

### `401` with `-32001 unknown api key`

The key was not accepted. Send the full key (`c_serv_...`), not the short prefix the
dashboard lists, as `?api-key=` or in the `x-api-key` header. A missing key answers the
same way. A key made before carbium.sh is refused here: get a new one at
[carbium.sh](https://carbium.sh).

### `403` with `-32050 module not enabled for this account` from `quote`

The account does not have the Quote module yet. Add it on carbium.sh under MODULES. The
same key then answers `quote` and `prices`.

### `-32601 method not found` for `transactionSubscribe`

The WebSocket serves the standard Solana PubSub methods. Use `logsSubscribe` with
`mentions` as [`stream-transactions.mjs`](examples/stream-transactions.mjs) does, or
Carbon Stream for full transactions.

### `-32010: this method is not served from the validator on this host`

Returned by `getProgramAccounts` for a program outside the service's account index. The
indexed programs are listed in the [carbium.sh reference](https://carbium.sh/docs). For a
wallet's token accounts use `getParsedTokenAccountsByOwner`.

### `StructError: Expected a Buffer instance, but received: [object Object]`

You called `getTokenAccountsByOwner` with `{ encoding: "jsonParsed" }`. That method
returns raw `Buffer` data and rejects a parsed encoding. Use
**`getParsedTokenAccountsByOwner`**, which takes no encoding argument:

```js
const { value } = await connection.getParsedTokenAccountsByOwner(owner, {
  mint: new PublicKey("<mint>"),
});
```

### Listing token accounts costs more credits than expected

A token scan is billed by the rows it returns, and one answer holds at most 10,000
accounts. Filter by `mint` where possible, as
[`rpc-token-accounts.mjs`](examples/rpc-token-accounts.mjs) does by default. Limits and
credits are in the [carbium.sh reference](https://carbium.sh/docs).

---

## FAQ

**Do I need one API key or two?**
One. A key from carbium.sh covers Carbium RPC and the WebSocket, the Carbium Swap API once
the Quote module is added, and Carbon Stream once its gRPC scope is on (Dev plan or above).

**What is the Carbium RPC endpoint URL?**
`https://services.carbium.sh`, with the key as `?api-key=<your key>` or in the `x-api-key`
header. Not `rpc.carbium.io`, which is the marketing site and returns
`405 Method Not Allowed` for JSON-RPC.

**Does Carbium support standard Solana JSON-RPC methods?**
Yes. 12 methods are verified against the live endpoint, including `getSlot`,
`getBalance`, `getAccountInfo`, `getLatestBlockhash` and `getRecentPrioritizationFees`.

**Can I use @solana/web3.js with Carbium?**
Yes. Carbium is a standard Solana JSON-RPC endpoint. Pass the URL to `new Connection()`.
The 5 JSON-RPC recipes use `@solana/web3.js` v1.98, and the 3 Carbon Stream recipes use
`@triton-one/yellowstone-grpc` 8.0.0. The WebSocket and Swap API recipes use no
dependencies at all: Node 22 has a global `WebSocket` and `fetch`.

**Why should I never log the Carbium RPC URL?**
When the key travels in the query string, the URL is itself a secret. Log
`new URL(rpc).host` instead, which drops the query. Or send the key in the `x-api-key`
header and keep it out of the URL.

**Is getting a swap quote a transaction?**
No. `quote` and `prices` are read-only JSON-RPC calls. Nothing is signed or broadcast.

**Does the WebSocket serve `slotSubscribe`?**
Yes. `wss://services.carbium.sh` serves the standard Solana PubSub methods. It does not
serve `transactionSubscribe`. To follow the transactions that touch an account, use
`logsSubscribe` with `mentions`. See
[`stream-transactions.mjs`](examples/stream-transactions.mjs).

**Which plan does Carbon Stream need?**
Dev or above, with the gRPC scope on the key. A free key is refused `PERMISSION_DENIED`.
Narrow filters (an account list, slots, transaction status) open on every paid plan;
firehose filters are heavy and need a higher plan. Plans and limits are on
[carbium.sh](https://carbium.sh).

**Is the gRPC stream the same thing as the WebSocket?**
No. The WebSocket at `wss://services.carbium.sh` speaks JSON. Carbon Stream at
`https://services.carbium.sh:9443` is native Yellowstone gRPC over HTTP/2 and needs a gRPC
client. Both take the same key.

**What Node version does this require?**
Node 20.12 or later, for native `--env-file` support. The streaming recipe needs Node 22
for the global `WebSocket`.

---

## Verification

```bash
npm run verify
```

Runs all 11 recipes against the live API and exits non-zero on any failure. Nothing in
this repo is untested copy-paste. CI re-runs it every Monday at 06:00 UTC to catch
upstream drift. On 2026-11-15 all 11 passed, in 427–1226 ms each.

```
Verifying 11 examples against the live API

  PASS  grpc-account-transactions.mjs   920ms
  PASS  grpc-resume-from-slot.mjs      558ms
  PASS  grpc-slots.mjs                1226ms
  PASS  rpc-account-balance.mjs        856ms
  PASS  rpc-first-call.mjs             778ms
  PASS  rpc-latest-blockhash.mjs       780ms
  PASS  rpc-priority-fees.mjs          665ms
  PASS  rpc-token-accounts.mjs         427ms
  PASS  stream-transactions.mjs        802ms
  PASS  swap-quote-usd.mjs             801ms
  PASS  swap-quote.mjs                 447ms

✓ all 11 examples passing
```

## Security

`.env` is gitignored. Never commit keys. Never print a connection URL that carries the
key in its query string. Log `new URL(rpc).host` instead. In CI, store the key as a
repository secret scoped to this repo, never organisation-wide.

## License

MIT. See [LICENSE](LICENSE).
