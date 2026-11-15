/**
 * Shared helpers for the Carbon Stream recipes (Carbium's Yellowstone gRPC stream).
 *
 * Endpoint:  https://services.carbium.sh:9443
 * Auth:      your carbium.sh key, sent as `x-token` metadata (the client does this)
 * Plan:      Dev or above, with the gRPC scope turned on for the key
 * Reference: https://carbium.sh/skill.md (section "Carbon stream")
 *
 * verify.mjs runs every .mjs file directly in examples/, so this folder holds
 * helpers only.
 */
import Client from "@triton-one/yellowstone-grpc";

export const ENDPOINT = "https://services.carbium.sh:9443";

// The TypeScript type requires every map and list; empty ones are not sent on the wire.
export const EMPTY = {
  accounts: {},
  slots: {},
  transactions: {},
  transactionsStatus: {},
  blocks: {},
  blocksMeta: {},
  entry: {},
  accountsDataSlice: [],
  blockFooter: {},
};

export async function connect(key = process.env.CARBIUM_SH_KEY) {
  if (!key) throw new Error("CARBIUM_SH_KEY is not set");
  // Block and transaction frames can be several MiB; the default 4 MiB limit fails on them.
  const client = new Client(ENDPOINT, key, { grpcMaxDecodingMessageSize: 64 * 1024 * 1024 });
  await client.connect();
  return client;
}

// Signatures and pubkeys arrive as bytes. A small base58 encoder keeps the recipes free
// of an extra dependency.
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes) {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}

// The N-API client puts the gRPC status in the error text. Map it to a code and a next step.
const STATUS = {
  "valid authentication credentials": "UNAUTHENTICATED",
  "does not have permission": "PERMISSION_DENIED",
  "resource has been exhausted": "RESOURCE_EXHAUSTED",
  "currently unavailable": "UNAVAILABLE",
  "past the valid range": "OUT_OF_RANGE",
  "invalid argument": "INVALID_ARGUMENT",
};
const HINT = {
  UNAUTHENTICATED: "check CARBIUM_SH_KEY: the full c_serv_ key, not the short prefix",
  PERMISSION_DENIED: "the key needs a Dev plan or above and the gRPC scope (carbium.sh, Keys, SCOPE)",
  RESOURCE_EXHAUSTED: "a stream or rate limit was reached: wait for retry-after and try again",
  UNAVAILABLE: "the stream is restarting or unreachable: retry with backoff",
  OUT_OF_RANGE: "that slot is older than the replay window: start from a newer slot",
  INVALID_ARGUMENT: "the request has a field the server refuses",
};

export function explain(error) {
  const text = String(error?.cause?.message ?? error?.message ?? error);
  const code = Object.entries(STATUS).find(([needle]) => text.includes(needle))?.[1] ?? "UNKNOWN";
  const message = (text.match(/message: "(.*)"$/) ?? [])[1] ?? text;
  return `${code}: ${message}${HINT[code] ? `\n  -> ${HINT[code]}` : ""}`;
}
