/**
 * Carbium RPC — your first call (current slot + round-trip latency)
 *
 * Endpoint:  https://services.carbium.sh/?api-key=<CARBIUM_SH_KEY>
 * Auth:      your carbium.sh key as the `api-key` query parameter
 *            (the `x-api-key` header works too)
 * Docs:      https://carbium.io/docs/
 *
 * Get a key at https://carbium.sh. One key covers every recipe in this repo.
 *
 * Because the key travels in the query string, the connection URL is itself a
 * secret: build it from the key at runtime and only ever log `new URL(rpc).host`.
 *
 *   npm install @solana/web3.js
 *   CARBIUM_SH_KEY=... node examples/rpc-first-call.mjs
 */
import { Connection } from "@solana/web3.js";

const rpc = `https://services.carbium.sh/?api-key=${process.env.CARBIUM_SH_KEY}`;

const connection = new Connection(rpc, "confirmed");

// Warm the connection so we time the call, not the TLS handshake.
await connection.getSlot();

const t0 = performance.now();
const slot = await connection.getSlot();
const ms = (performance.now() - t0).toFixed(1);

console.log(`slot     ${slot}`);
console.log(`latency  ${ms} ms`);
console.log("");
console.log(`✓ connected to ${new URL(rpc).host}`);
