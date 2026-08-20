/**
 * Carbium RPC — fetch a blockhash for building a transaction
 *
 * Endpoint:  https://rpc-service.carbium.io/?apiKey=<CARBIUM_RPC_KEY>
 * Methods:   getLatestBlockhash, getBlockHeight
 * Docs:      https://carbium.io/docs/
 *
 * A blockhash is only valid for ~150 blocks. `lastValidBlockHeight` tells you
 * the height it expires at, which is what you compare against to decide whether
 * a transaction still has a chance of landing.
 *
 *   npm install @solana/web3.js
 *   CARBIUM_RPC_KEY=... node examples/rpc-latest-blockhash.mjs
 */
import { Connection } from "@solana/web3.js";

const rpc = `https://rpc-service.carbium.io/?apiKey=${process.env.CARBIUM_RPC_KEY}`;
const connection = new Connection(rpc, "confirmed");

const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
const height = await connection.getBlockHeight();

console.log(`blockhash              ${blockhash}`);
console.log(`current block height   ${height}`);
console.log(`valid until height     ${lastValidBlockHeight}`);
console.log(`blocks remaining       ${lastValidBlockHeight - height}`);
