/**
 * Carbon Stream: your first Solana gRPC stream (slots)
 *
 * Endpoint:  https://services.carbium.sh:9443 (Yellowstone gRPC)
 * Auth:      your carbium.sh key as `x-token` metadata
 * Plan:      Dev or above, gRPC scope on the key
 * Filter:    slots, the lightest stream there is
 * Docs:      https://carbium.io/docs/solana-grpc
 *
 * Opens one stream, prints the next few confirmed slots as they arrive and closes
 * it. If this runs, the key, the plan and the gRPC scope are all in order.
 *
 *   CARBIUM_SH_KEY=... node examples/grpc-slots.mjs [count]
 */
import { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { EMPTY, connect, explain } from "./lib/carbon-stream.mjs";

const want = Number(process.argv[2] ?? 5);
const TIMEOUT_MS = 30_000;

const started = performance.now();
let stream;

const fail = (message) => {
  console.error(`\n✗ ${message}`);
  stream?.destroy();
  process.exit(1);
};
const timer = setTimeout(() => fail(`no slot within ${TIMEOUT_MS / 1000}s`), TIMEOUT_MS);

try {
  const client = await connect();
  // Everything goes in the first request: filters cannot change once the stream is open.
  stream = await client.subscribe({
    ...EMPTY,
    commitment: CommitmentLevel.CONFIRMED,
    slots: { confirmed: { filterByCommitment: true } }, // the key "confirmed" is a name we choose
  });
} catch (error) {
  fail(explain(error));
}

console.log(`streaming from services.carbium.sh:9443, waiting for ${want} slots\n`);

let seen = 0;
let last;
stream.on("data", (update) => {
  if (!update.slot || seen >= want) return; // pings and pongs carry no slot
  const now = performance.now();
  const gap = last === undefined ? `first after ${(now - started).toFixed(0)} ms` : `+${(now - last).toFixed(0)} ms`;
  last = now;
  console.log(`  slot ${update.slot.slot}  ${gap}`);
  if (++seen >= want) {
    clearTimeout(timer);
    console.log(`\n✓ ${seen} confirmed slots from Carbon Stream`);
    stream.destroy(); // closing the stream frees its slot on the account at once
    process.exit(0);
  }
});
stream.on("error", (error) => fail(explain(error)));
stream.on("end", () => fail("the server ended the stream"));
