/**
 * Carbium RPC — your first call (current slot + round-trip latency)
 *
 * Endpoint:  https://rpc-service.carbium.io/?apiKey=<CARBIUM_RPC_KEY>
 * Auth:      API key as a `apiKey` query parameter
 * Docs:      https://carbium.io/docs/
 *
 * Note rpc.carbium.io is the marketing site and does not accept JSON-RPC.
 * The RPC host is rpc-service.carbium.io.
 *
 * Because the key travels in the query string, the connection URL is itself a
 * secret: build it from the key at runtime and only ever log `new URL(rpc).host`.
 *
 *   npm install @solana/web3.js
 *   CARBIUM_RPC_KEY=... node examples/rpc-first-call.mjs
 */
import { Connection } from "@solana/web3.js";

const rpc = `https://rpc-service.carbium.io/?apiKey=${process.env.CARBIUM_RPC_KEY}`;

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
