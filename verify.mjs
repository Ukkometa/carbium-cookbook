#!/usr/bin/env node
/**
 * Runs every example against the live API and reports pass/fail.
 *
 * The point of this repo is that nothing in it is untested copy-paste. Run this
 * before publishing, and on a schedule, so a broken example is caught by us
 * rather than by someone following the docs.
 *
 *   npm run verify
 */
import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const DIR = "examples";
const files = readdirSync(DIR).filter((f) => f.endsWith(".mjs")).sort();

const needs = (f) => (f.startsWith("swap-") ? "CARBIUM_API_KEY" : "CARBIUM_RPC_KEY");

const run = (file) =>
  new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [join(DIR, file)], { env: process.env });
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (out += c));
    child.on("close", (code) =>
      resolve({ file, ok: code === 0, ms: Date.now() - t0, out: out.trim() }),
    );
  });

let failed = 0;
let ran = 0;
console.log(`\nVerifying ${files.length} examples against the live API\n`);

for (const file of files) {
  if (!process.env[needs(file)]) {
    console.log(`  SKIP  ${file.padEnd(28)} ${needs(file)} not set`);
    continue;
  }
  ran++;
  const r = await run(file);
  if (r.ok) {
    console.log(`  PASS  ${r.file.padEnd(28)} ${String(r.ms).padStart(5)}ms`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.file.padEnd(28)} ${String(r.ms).padStart(5)}ms`);
    console.log(r.out.split("\n").slice(0, 4).map((l) => `        ${l}`).join("\n"));
  }
  await new Promise((res) => setTimeout(res, 400)); // stay under the free-tier rate limit
}

if (ran === 0) {
  // Never report green on a run that tested nothing — a skipped CI job with a
  // passing badge is worse than a failing one.
  console.log("\n✗ nothing ran: no API keys available. Set CARBIUM_RPC_KEY and CARBIUM_API_KEY.\n");
  process.exit(1);
}

console.log(failed ? `\n✗ ${failed} failing\n` : `\n✓ all ${ran} examples passing\n`);
process.exit(failed ? 1 : 0);
