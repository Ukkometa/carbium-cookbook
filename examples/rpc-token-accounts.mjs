/**
 * Carbium RPC — list the SPL token accounts owned by a wallet
 *
 * Endpoint:  https://rpc-service.carbium.io/?apiKey=<CARBIUM_RPC_KEY>
 * Method:    getParsedTokenAccountsByOwner
 * Docs:      https://carbium.io/docs/
 *
 * KNOWN LIMIT — read this before shipping it.
 * This method has a 30-second edge timeout. Wallets with very large numbers of
 * token accounts exceed it, and the gateway responds with an HTML error page,
 * NOT a JSON-RPC error. A bare `JSON.parse` throws an unhelpful SyntaxError.
 * Prefer a `mint` filter when you know it, and handle the timeout explicitly.
 *
 *   npm install @solana/web3.js
 *   CARBIUM_RPC_KEY=... node examples/rpc-token-accounts.mjs <owner>
 */
import { Connection, PublicKey } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const rpc = `https://rpc-service.carbium.io/?apiKey=${process.env.CARBIUM_RPC_KEY}`;
const connection = new Connection(rpc, "confirmed");

const owner = new PublicKey(
  process.argv[2] ?? "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
);

try {
  // getParsedTokenAccountsByOwner, not getTokenAccountsByOwner: the plain
  // variant returns raw Buffer data and rejects a jsonParsed encoding.
  const { value } = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  console.log(`owner          ${owner.toBase58()}`);
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
  // The 30s gateway timeout surfaces as unparseable HTML, so say something useful.
  if (err instanceof SyntaxError || /Unexpected token|JSON/i.test(err.message)) {
    console.error(
      "✗ The response was not JSON. This wallet most likely holds too many token\n" +
        "  accounts to enumerate within the 30-second gateway timeout.\n" +
        "  Retry with a mint filter: { mint: new PublicKey('<mint>') }",
    );
    process.exit(1);
  }
  throw err;
}
