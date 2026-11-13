/**
 * Carbium RPC — stream Solana transactions in real time (WebSocket)
 *
 * Endpoint:  wss://services.carbium.sh/?api-key=<CARBIUM_RPC_KEY>
 * Auth:      your carbium.sh key as the `api-key` query parameter
 * Method:    logsSubscribe
 * Docs:      https://carbium.io/docs/solana-grpc
 *
 * The WebSocket serves the standard Solana PubSub methods. `logsSubscribe` with
 * `mentions` sends one notification for every transaction that touches the
 * account: its signature, its error if it failed, and its program logs.
 *
 * `transactionSubscribe` is not served here. For full transactions with
 * server-side filters use Carbon Stream, the Yellowstone gRPC stream at
 * https://services.carbium.sh:9443. It needs a Dev plan or above and the gRPC
 * scope turned on for the key.
 *
 * No dependencies: Node 22 ships a global WebSocket. The key travels in the
 * URL here, so never log the URL.
 *
 *   CARBIUM_RPC_KEY=... node examples/stream-transactions.mjs [account] [count]
 */
const key = process.env.CARBIUM_RPC_KEY;

// Defaults to a high-traffic account so the example returns in a second or two.
const account = process.argv[2] ?? "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const want = Number(process.argv[3] ?? 5);
const TIMEOUT_MS = 30_000;

const ws = new WebSocket(`wss://services.carbium.sh/?api-key=${key}`);

let seen = 0;
const started = Date.now();

const timer = setTimeout(() => {
  console.error(`\n✗ no notifications within ${TIMEOUT_MS / 1000}s — is the account active?`);
  ws.close();
  process.exit(1);
}, TIMEOUT_MS);

ws.onopen = () => {
  console.log(`watching  ${account}`);
  console.log(`waiting for ${want} transactions...\n`);
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "logsSubscribe",
      params: [
        { mentions: [account] }, // one address per subscription
        { commitment: "confirmed" },
      ],
    }),
  );
};

ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data));

  // First reply is the subscription id, not a notification.
  if (msg.result !== undefined) {
    console.log(`subscription ${msg.result}\n`);
    return;
  }
  if (msg.error) {
    clearTimeout(timer);
    console.error(`✗ ${msg.error.code}: ${msg.error.message}`);
    ws.close();
    process.exit(1);
  }

  if (seen >= want) return; // notifications still in flight after the close

  // Failed transactions are included: `err` is null when the transaction succeeded.
  const { context, value } = msg.params.result;
  const status = value.err ? "failed" : "ok";
  console.log(
    `  slot ${context.slot}  ${value.signature.slice(0, 24)}…  ${status.padEnd(6)}  ${value.logs.length} log lines`,
  );

  if (++seen >= want) {
    clearTimeout(timer);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n✓ ${seen} transactions in ${secs}s from services.carbium.sh`);
    ws.close(1000); // a clean close frees the connection slot at once
  }
};

ws.onerror = () => {
  clearTimeout(timer);
  console.error("✗ websocket error — check CARBIUM_RPC_KEY");
  process.exit(1);
};
