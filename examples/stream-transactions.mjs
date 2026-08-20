/**
 * Carbium RPC — stream Solana transactions in real time (WebSocket)
 *
 * Endpoint:  wss://grpc.carbium.io/?apiKey=<CARBIUM_RPC_KEY>
 * Auth:      API key as an `apiKey` query parameter (the RPC key, not the Swap key)
 * Method:    transactionSubscribe
 * Docs:      https://carbium.io/docs/solana-grpc
 *
 * IMPORTANT — this is a Yellowstone-style stream, NOT standard Solana PubSub.
 * Use `transactionSubscribe` with its two-element params array. Standard PubSub
 * names such as `slotSubscribe` return `-32601 Method not found` here.
 *
 * The host is called `grpc` because the payload is Yellowstone-style gRPC data.
 * The transport is WebSocket: connect with a WebSocket client over wss://, not
 * with a native gRPC client.
 *
 * No dependencies: Node 22 ships a global WebSocket. The published docs example
 * uses the `ws` package, which also works.
 *
 *   CARBIUM_RPC_KEY=... node examples/stream-transactions.mjs [account] [count]
 */
const key = process.env.CARBIUM_RPC_KEY;

// Defaults to a high-traffic account so the example returns in a second or two.
const account = process.argv[2] ?? "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const want = Number(process.argv[3] ?? 5);
const TIMEOUT_MS = 30_000;

const ws = new WebSocket(`wss://grpc.carbium.io/?apiKey=${key}`);

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
      method: "transactionSubscribe",
      params: [
        {
          vote: false,          // skip consensus vote transactions
          failed: false,        // skip transactions that errored
          accountInclude: [account],
          accountExclude: [],
          accountRequired: [],
        },
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
          transactionDetails: "full",
          showRewards: false,
          maxSupportedTransactionVersion: 0,
        },
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

  const { slot, signature, transaction } = msg.params.result;
  const fee = transaction?.meta?.fee;
  console.log(`  slot ${slot}  ${signature.slice(0, 24)}…  fee ${fee ?? "?"} lamports`);

  if (++seen >= want) {
    clearTimeout(timer);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n✓ ${seen} transactions in ${secs}s from grpc.carbium.io`);
    ws.close();
  }
};

ws.onerror = () => {
  clearTimeout(timer);
  console.error("✗ websocket error — check CARBIUM_RPC_KEY");
  process.exit(1);
};
