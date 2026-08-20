/**
 * Carbium RPC — sample recent priority fees before sending a transaction
 *
 * Endpoint:  https://rpc-service.carbium.io/?apiKey=<CARBIUM_RPC_KEY>
 * Method:    getRecentPrioritizationFees
 * Docs:      https://carbium.io/docs/
 *
 * Returns what recent blocks actually paid, per compute unit, for transactions
 * touching the given accounts. Use a percentile of this rather than the max,
 * which is usually one outlier bidding against itself.
 *
 *   npm install @solana/web3.js
 *   CARBIUM_RPC_KEY=... node examples/rpc-priority-fees.mjs
 */
import { Connection, PublicKey } from "@solana/web3.js";

const rpc = `https://rpc-service.carbium.io/?apiKey=${process.env.CARBIUM_RPC_KEY}`;
const connection = new Connection(rpc, "confirmed");

const accounts = [new PublicKey("So11111111111111111111111111111111111111112")];
const samples = await connection.getRecentPrioritizationFees({ lockedWritableAccounts: accounts });

const fees = samples.map((s) => s.prioritizationFee).sort((a, b) => a - b);
const pct = (p) => fees[Math.min(fees.length - 1, Math.floor((fees.length - 1) * p))];

console.log(`samples   ${fees.length} recent slots`);
console.log(`min       ${fees[0]} microlamports / CU`);
console.log(`p50       ${pct(0.5)}`);
console.log(`p75       ${pct(0.75)}`);
console.log(`p95       ${pct(0.95)}`);
console.log(`max       ${fees[fees.length - 1]}`);
