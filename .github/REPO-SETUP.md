# Repo settings to apply at push time

Not code, but these carry real discovery weight. Set them in the GitHub UI
(About → gear icon) once the repo exists.

## Description

> Runnable, continuously tested recipes for the Carbium Solana RPC and Swap API.

"Solana" belongs here rather than in the repo name — the description is indexed
and has far more search volume than "carbium" on its own.

## Topics

    solana  solana-rpc  rpc  web3js  swap-api  defi  carbium  javascript  nodejs

## Website

    https://carbium.io/docs/

## When moving to an org later

GitHub keeps a permanent redirect on transfer, so links and stars survive.
Update these three places afterwards:

- `README.md` — the CI badge URL and the `git clone` line
- `package.json` — `repository` field, if one has been added by then
- Repo secrets — `CARBIUM_RPC_KEY` and `CARBIUM_API_KEY` do NOT transfer,
  re-add them, scoped to this repo only, never org-wide.

---

## Where the schema signals actually pay off

This README scores 60/100 on the AEO scorer ("safe to publish"), which is close to the
practical ceiling for a GitHub README: GitHub strips JSON-LD, so the **schema coverage**
signal is structurally unreachable here no matter how the content is written.

The place to spend that effort is **carbium.io/docs**, where FAQPage / TechArticle
JSON-LD *can* be emitted. The same Q&A pairs used in this README's FAQ section are the
right source material — reuse them there wrapped in schema.

Two things the scoring run established, worth keeping:

1. An explicit `## FAQ` section with bolded question/answer pairs scores materially
   better than the same questions distributed as headings through the document.
   Distributing them dropped the score from 59 to 57; restoring the block reached 60.
2. Concrete measured numbers and dates ("73 ms warm median", "verified 2026-08-20")
   count as structured claims. Every figure in the README is a real measurement — do
   not replace them with rounded marketing numbers, and re-measure when re-verifying.
