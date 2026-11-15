/**
 * Carbon Stream: resume a Solana gRPC stream from a past slot (fromSlot replay)
 *
 * Endpoint:  https://services.carbium.sh:9443 (Yellowstone gRPC)
 * Auth:      your carbium.sh key as `x-token` metadata
 * Plan:      Dev or above, gRPC scope on the key
 * Methods:   getSlot, subscribeReplayInfo, then a Subscribe with fromSlot
 * Docs:      https://carbium.io/docs/solana-grpc
 *
 * After a dropped connection, a client can ask the server to replay from the last
 * slot it saw instead of starting cold. The server keeps a window of recent
 * updates: subscribeReplayInfo says where it starts. This recipe starts a few
 * slots in the past, receives the replayed slots, and stops once it has caught up
 * with the slot the chain was at when it began.
 *
 * Replay works at processed commitment only, and fromSlot goes in the first
 * request. Replay can start one slot early and overlap what you already have, so
 * dedupe on (slot, signature) for transactions.
 *
 *   CARBIUM_SH_KEY=... node examples/grpc-resume-from-slot.mjs [slotsBack]
 */
import { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { EMPTY, connect, explain } from "./lib/carbon-stream.mjs";

const slotsBack = BigInt(process.argv[2] ?? 20);
const TIMEOUT_MS = 30_000;

let stream;
const fail = (message) => {
  console.error(`\n✗ ${message}`);
  stream?.destroy();
  process.exit(1);
};
const timer = setTimeout(() => fail(`did not catch up within ${TIMEOUT_MS / 1000}s`), TIMEOUT_MS);

let head;
let fromSlot;
try {
  const client = await connect();
  head = BigInt((await client.getSlot(CommitmentLevel.PROCESSED)).slot);
  const { firstAvailable } = await client.subscribeReplayInfo();

  // Never ask for a slot older than the window: the stream would end OUT_OF_RANGE.
  const floor = BigInt(firstAvailable ?? head);
  fromSlot = head - slotsBack > floor ? head - slotsBack : floor;
  console.log(`chain at slot ${head}, replay window starts at ${floor}`);
  console.log(`resuming from slot ${fromSlot} (${head - fromSlot} slots back)\n`);

  stream = await client.subscribe({
    ...EMPTY,
    commitment: CommitmentLevel.PROCESSED, // replay is served at processed only
    fromSlot: String(fromSlot), // uint64 values are decimal strings in the JS client
    slots: { replay: {} },
  });
} catch (error) {
  fail(explain(error));
}

const started = performance.now();
const replayed = new Set();
stream.on("data", (update) => {
  if (!update.slot) return;
  const slot = BigInt(update.slot.slot);
  replayed.add(slot); // each slot arrives once per status change; count it once

  if (slot >= head) {
    clearTimeout(timer);
    const below = [...replayed].filter((s) => s < head).length;
    const ms = (performance.now() - started).toFixed(0);
    console.log(`  first slot received  ${[...replayed].reduce((a, b) => (a < b ? a : b))}`);
    console.log(`  caught up at         ${slot}`);
    console.log(`\n✓ replayed ${below} past slots and reached the live edge in ${ms} ms`);
    stream.destroy();
    process.exit(0);
  }
});
stream.on("error", (error) => fail(explain(error)));
stream.on("end", () => fail("the server ended the stream"));
