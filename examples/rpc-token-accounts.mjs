/**
 * Carbium RPC — list the SPL token accounts owned by a wallet
 *
 * Endpoint:  https://services.carbium.sh/?api-key=<CARBIUM_RPC_KEY>
 * Method:    getParsedTokenAccountsByOwner
 * Docs:      https://carbium.io/docs/
 *
 * KNOWN LIMITS: read this before shipping it.
 * A token scan is billed by the rows it returns, and one answer holds at most
 * 10,000 accounts (a larger result answers -32012). A wallet with thousands of
 * token accounts costs far more credits than a wallet with a few, so filter by
 * `mint` when you know it. This example does that by default (USDC). Pass `all`
 * as the mint to list every SPL token account the wallet owns.
 * Limits and credits: https://carbium.sh/docs
 *
 *   npm install @solana/web3.js
 *   CARBIUM_RPC_KEY=... node examples/rpc-token-accounts.mjs [owner] [mint|all]
 */
import { Connection, PublicKey } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const rpc = `https://services.carbium.sh/?api-key=${process.env.CARBIUM_RPC_KEY}`;
const connection = new Connection(rpc, "confirmed");

const owner = new PublicKey(
  process.argv[2] ?? "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
);

// One mint keeps the scan to a row or two. `all` scans every SPL token account.
const mintArg = process.argv[3] ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
const filter =
  mintArg === "all" ? { programId: TOKEN_PROGRAM_ID } : { mint: new PublicKey(mintArg) };

try {
  // getParsedTokenAccountsByOwner, not getTokenAccountsByOwner: the plain
  // variant returns raw Buffer data and rejects a jsonParsed encoding.
  const { value } = await connection.getParsedTokenAccountsByOwner(owner, filter);

  console.log(`owner          ${owner.toBase58()}`);
  console.log(`filter         ${mintArg === "all" ? "every SPL token account" : `mint ${mintArg}`}`);
  console.log(`token accounts ${value.length}`);

  const held = value
    .map((a) => a.account.data.parsed.info)
    .filter((i) => Number(i.tokenAmount.uiAmount) > 0)
    .sort((a, b) => Number(b.tokenAmount.uiAmount) - Number(a.tokenAmount.uiAmount))
    .slice(0, 10);

  console.log(`non-empty      ${held.length} shown (top 10 by balance)\n`);
  for (const i of held) {
    console.log(`  ${i.mint}  ${i.tokenAmount.uiAmountString}`);
  }
} catch (err) {
  // More than 10,000 accounts in one answer is refused with -32012, so say something useful.
  if (/-32012|account cap/i.test(err.message)) {
    console.error(
      "✗ This wallet holds more token accounts than one answer can carry (10,000).\n" +
        "  Retry with a mint filter: node examples/rpc-token-accounts.mjs <owner> <mint>",
    );
    process.exit(1);
  }
  throw err;
}
