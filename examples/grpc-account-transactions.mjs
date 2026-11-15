/**
 * Carbon Stream: every transaction that touches an account (Solana gRPC)
 *
 * Endpoint:  https://services.carbium.sh:9443 (Yellowstone gRPC)
 * Auth:      your carbium.sh key as `x-token` metadata
 * Plan:      Dev or above, gRPC scope on the key
 * Filter:    transactions with accountInclude, filtered on the server
 * Docs:      https://carbium.io/docs/solana-grpc
 *
 * The server sends only the transactions that include the account, each one in
 * full: signature, status, fee and the balances before and after. This is how to
 * follow a wallet. A wallet's SOL balance does not arrive as an account update, so
 * read it from the transaction's balances, as below.
 *
 * A narrowed filter like this one is a light stream: it opens on every paid plan.
 *
 *   CARBIUM_SH_KEY=... node examples/grpc-account-transactions.mjs [account] [count]
 */
import { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { EMPTY, base58, connect, explain } from "./lib/carbon-stream.mjs";

// Defaults to the USDC mint, which appears in transactions every slot, so the recipe
// returns in a second or two. Pass a wallet address to follow a wallet instead.
const account = process.argv[2] ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const want = Number(process.argv[3] ?? 5);
const TIMEOUT_MS = 30_000;

let stream;
const fail = (message) => {
  console.error(`\n✗ ${message}`);
  stream?.destroy();
  process.exit(1);
};
const timer = setTimeout(() => fail(`no transaction within ${TIMEOUT_MS / 1000}s: is the account active?`), TIMEOUT_MS);

try {
  const client = await connect();
  stream = await client.subscribe({
    ...EMPTY,
    commitment: CommitmentLevel.CONFIRMED,
    transactions: {
      watched: {
        accountInclude: [account], // any of these accounts
        accountExclude: [],
        accountRequired: [],
        vote: false, // leave `failed` unset to receive failed transactions too
      },
    },
  });
} catch (error) {
  fail(explain(error));
}

console.log(`watching  ${account}`);
console.log(`waiting for ${want} transactions\n`);

const started = performance.now();
let seen = 0;
stream.on("data", (update) => {
  if (!update.transaction || seen >= want) return;
  const { slot, transaction: tx } = update.transaction;
  const meta = tx.meta;

  // The account's SOL balance change, if it is one of the transaction's static keys.
  const keys = tx.transaction.message.accountKeys.map((k) => base58(k));
  const i = keys.indexOf(account);
  const change = i >= 0 ? (Number(meta.postBalances[i]) - Number(meta.preBalances[i])) / 1e9 : 0;

  const status = meta.err ? "failed" : "ok";
  console.log(
    `  slot ${slot}  ${base58(tx.signature).slice(0, 20)}…  ${status.padEnd(6)}  fee ${meta.fee} lamports  SOL ${change >= 0 ? "+" : ""}${change}`,
  );

  if (++seen >= want) {
    clearTimeout(timer);
    const secs = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`\n✓ ${seen} transactions in ${secs}s from Carbon Stream`);
    stream.destroy();
    process.exit(0);
  }
});
stream.on("error", (error) => fail(explain(error)));
stream.on("end", () => fail("the server ended the stream"));
