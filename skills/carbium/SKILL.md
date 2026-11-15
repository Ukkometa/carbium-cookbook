---
name: carbium
description: Use Carbium's Solana API at services.carbium.sh, one key for JSON-RPC, WebSocket subscriptions, Carbon Stream (Yellowstone gRPC) and the quote API. Use it when a task needs a Solana mainnet RPC endpoint, real-time Solana data over WebSocket or gRPC, or swap route quotes with unsigned transactions for the caller's own wallet to sign.
---

# Carbium: Solana RPC, WebSocket, Carbon Stream (gRPC) and quotes

Carbium serves Solana mainnet from one host, `services.carbium.sh`, behind one API key
from [carbium.sh](https://carbium.sh). The full and current reference (every limit,
error and price) is **https://carbium.sh/skill.md**. Read it before relying on a number:
limits change, and this file keeps none.

## Endpoints and auth

| Plane | Endpoint | Key |
|---|---|---|
| JSON-RPC | `https://services.carbium.sh` | header `x-api-key: <key>`, or `?api-key=<key>` |
| WebSocket | `wss://services.carbium.sh` | header `x-api-key: <key>`, or `?api-key=<key>` |
| Carbon Stream (Yellowstone gRPC) | `https://services.carbium.sh:9443` | metadata `x-token: <key>` |
| Quotes | `https://services.carbium.sh`, JSON-RPC methods `quote`, `swap`, `prices` | header `x-api-key: <key>` |

- Send the **full** key (`c_serv_...`). The short prefix the dashboard lists is a label and
  is refused as `unknown api key`.
- A key in a URL makes the whole URL a secret: build it at runtime, never log it.
- Mainnet only. There is no devnet endpoint and no faucet.

## Rules that save a failed call

**Carbon Stream (gRPC)**
- Needs a Dev plan or above and the gRPC scope on the key (carbium.sh, Keys, SCOPE).
  A free key is refused `PERMISSION_DENIED`.
- Put every filter in the first Subscribe request. Filters cannot change on an open
  stream: open a new one, then close the old.
- Set the client's max receive size to 64 MiB, and ping every 10 s.
- There is no startup snapshot: read current state over RPC first, then apply updates.
- To follow a wallet, subscribe `transactions` with `accountInclude: [wallet]`. Plain SOL
  wallets do not arrive as account updates.
- Resume after a drop with `fromSlot` (processed commitment only); call
  `subscribeReplayInfo` first and never ask below `firstAvailable`.
- Narrow filters (one account list, slots, transaction status) are light and open on
  every paid plan. Firehose shapes are heavy and need a higher plan.

**WebSocket**
- Standard Solana PubSub: `slotSubscribe`, `accountSubscribe`, `logsSubscribe`,
  `signatureSubscribe`, `blockSubscribe`. `transactionSubscribe` is not served.
- Reuse one socket for many subscriptions and close it cleanly (`close(1000)`).

**JSON-RPC**
- Send `"maxSupportedTransactionVersion": 1` on `getTransaction` and `getBlock`.
- On 429, wait `retry-after-ms`; never loop on a 4xx.
- After a 502/503/504 on `sendTransaction`, check the signature's status before
  re-signing: the first send may have landed.

**Quotes**
- `quote` returns a route; `swap` returns an unsigned transaction for your own wallet to
  sign. Nothing is signed or sent by Carbium. The account needs the Quote module
  (carbium.sh, MODULES).
- A refusal can arrive with HTTP 200: check `error`, not only the status.

## Runnable examples

Every recipe in this repository runs against the live service in CI.

| Task | Recipe |
|---|---|
| First RPC call and latency | [`examples/rpc-first-call.mjs`](../../examples/rpc-first-call.mjs) |
| Balances, blockhash, token accounts, priority fees | [`examples/`](../../examples/) |
| First Carbon Stream (gRPC) stream | [`examples/grpc-slots.mjs`](../../examples/grpc-slots.mjs) |
| Every transaction touching an account (gRPC) | [`examples/grpc-account-transactions.mjs`](../../examples/grpc-account-transactions.mjs) |
| Resume a gRPC stream from a past slot | [`examples/grpc-resume-from-slot.mjs`](../../examples/grpc-resume-from-slot.mjs) |
| Transactions over WebSocket | [`examples/stream-transactions.mjs`](../../examples/stream-transactions.mjs) |
| Swap quote, with USD values | [`examples/swap-quote.mjs`](../../examples/swap-quote.mjs), [`examples/swap-quote-usd.mjs`](../../examples/swap-quote-usd.mjs) |

## Links

- Keys, plans and limits: https://carbium.sh
- Full agent reference: https://carbium.sh/skill.md
- Guides: https://carbium.io/docs/
- Carbon Stream guide: https://carbium.io/docs/solana-grpc
