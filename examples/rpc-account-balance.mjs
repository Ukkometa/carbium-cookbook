/**
 * Carbium RPC — read a SOL balance and account metadata
 *
 * Endpoint:  https://rpc-service.carbium.io/?apiKey=<CARBIUM_RPC_KEY>
 * Methods:   getBalance, getAccountInfo
 * Docs:      https://carbium.io/docs/
 *
 *   npm install @solana/web3.js
 *   CARBIUM_RPC_KEY=... node examples/rpc-account-balance.mjs <address>
 */
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const rpc = `https://rpc-service.carbium.io/?apiKey=${process.env.CARBIUM_RPC_KEY}`;
const connection = new Connection(rpc, "confirmed");

// Defaults to the wrapped SOL mint so the example runs with no arguments.
const address = new PublicKey(
  process.argv[2] ?? "So11111111111111111111111111111111111111112",
);

const lamports = await connection.getBalance(address);
const info = await connection.getAccountInfo(address);

console.log(`address    ${address.toBase58()}`);
console.log(`balance    ${(lamports / LAMPORTS_PER_SOL).toFixed(9)} SOL (${lamports} lamports)`);
console.log(`owner      ${info?.owner.toBase58() ?? "(account not found)"}`);
console.log(`executable ${info?.executable ?? "-"}`);
console.log(`data       ${info?.data.length ?? 0} bytes`);
