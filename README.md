# ProofGate

**On-chain verification for KeeperHub agents.**
_Built for KeeperHub · Verification engine by ArcadeOps_

> KeeperHub executes autonomous actions. ProofGate independently reconciles agent claims,
> policy state, and captured on-chain evidence before the result is trusted.

**Live: https://proofgate.vercel.app**

---

## 1. Why it exists

Agent platforms report success, failure, or safety from **incomplete infrastructure
signals**. On a real Sepolia incident, a provider simulator predicted a transfer would
revert; the execution then succeeded. Same arguments, opposite outcomes. The provider's own
response never disclosed how much policy allowance the action consumed, and reported
`sponsored: false` at one level and `sponsored: true` two levels down.

Nothing was stolen. That is the problem: the operator had no way to know.

## The two executions, kept distinct

ProofGate replays **one captured reliability incident**. A separate autonomous agent —
[keeper-agent](https://github.com/Damso74/keeper-agent) — later executed on its own. They
are different runs and must not be conflated:

| | Captured reliability incident (this app's fixture) | Autonomous agent run |
| --- | --- | --- |
| Date | 2026-08-04 | 2026-08-05 |
| Amount | 1 USDC | 0.1 USDC |
| KeeperHub execution id | `1w6mru2gemgtq7wsruvaj` | `no623hdfsrun2vzv3b25r` |
| Transaction | [`0x0801289e…`](https://sepolia.etherscan.io/tx/0x0801289edfdcfd919b64b1f7e267d935674d09fa09de7a9670b8aa169bcb605e) | [`0xe7e67b3a…`](https://sepolia.etherscan.io/tx/0xe7e67b3ab83e1af1f5d130d3c33dbe945cf015da8fb082020b24c253a8eb5062) |
| Triggered by | a human operator | the agent's own decision rule |

Scenarios A and B below both derive from the **2026-08-04** incident.

ProofGate replays the action against the chain and produces a hash-verifiable verdict.
Only on-chain evidence is authoritative. Provider reports can raise warnings, never
validate. Missing evidence is never a pass.

## 2. ProofGate vs KeeperHub vs ArcadeOps

| | Role |
| --- | --- |
| **KeeperHub** | Executes the agent action. Owns the Safe integration, the policy module wiring and the transaction. |
| **ArcadeOps** | Owns the deterministic verification engine: checks, verdict rules, canonical JSON, attestation hashing. |
| **ProofGate** | This app. A standalone proof console that runs the ArcadeOps engine over captured KeeperHub evidence, in the browser, with no backend. |

ProofGate is not a KeeperHub clone and ships no KeeperHub branding or assets.

## 3. Architecture

```
src/engine/          pure TypeScript, browser-safe, zero Node built-ins
  types.ts           check ids, reason codes, verdicts, enum mapping
  normalize.ts       addresses, amounts, receipts, decoded events
  checks.ts          12 authoritative (chain) + 5 declarative (provider)
  verdict.ts         checks → verdict, pure and total
  canonical.ts       canonical JSON + SHA-256 through Web Crypto
  attestation.ts     build + verify, async
  presentation.ts    policy view, reconciliation rows
  index.ts           scenario view model (path graph, claim rows)
  fixtures/*.json    immutable captured evidence

src/App.tsx          single screen
src/components/      proof path, evidence drawer, brand mark
tests/parity.test.ts digest + verdict parity with the ArcadeOps reference
tests/e2e/           Playwright against the built bundle, 4 viewports
```

Stack: **Vite + React 19 + TypeScript**, no UI library, no state library, no CSS
framework. The whole bundle is ~245 kB (75 kB gzipped).

**Engine duplication, on purpose.** The core is duplicated from
`src/lib/onchain` of the ArcadeOps repository rather than imported. Moving the shared
module would have coupled ProofGate to the Next.js monolith and to `node:crypto`, and it
would have blocked extraction into a separate repository. `tests/parity.test.ts` locks the
two implementations to identical verdicts and identical digests — any drift fails the
suite.

## 4. The two scenarios

### A — Authorized (`VERIFIED_WITH_WARNINGS`)

Real execution on Ethereum Sepolia, **2026-08-04**. 1 USDC moved out of the Safe through
`execTransactionWithRole`. Path: `KeeperHub → Roles Modifier → Safe → USDC`. Receipt
succeeded.

The provider simulator had predicted failure — a **simulation false negative**: it modelled
a direct transfer from the delegate EOA rather than the Safe execution path.

The provider simulator reported insufficient delegate-EOA balance for the 1 USDC
direct-transfer path. A 300,000-block Transfer-log scan found no earlier balance-affecting
activity within that window, but the opening balance of the window remains unknown. The
exact historical EOA balance is therefore not independently established.

The complete scan lives in
[`scripts/prove-historical-balance.mjs`](https://github.com/Damso74/keeper-agent/blob/main/scripts/prove-historical-balance.mjs)
and closes the gap when pointed at an archive node.

The EOA's balance has changed since, so the divergence is threshold-based rather than
absolute: the simulator and the chain disagree whenever the amount exceeds the EOA's own
balance but stays within the Safe's policy allowance.

### B — Blocked (`BLOCKED_BY_POLICY`)

A **counterfactual historical replay**, not a submitted KeeperHub transaction. The full
Roles envelope is re-encoded with 5 USDC and replayed with `eth_call` at block 11418272,
where only 4 USDC of allowance remained. It reverts with
`ConditionViolation(17, allowanceKey)` — status 17 is `AllowanceExceeded` — carrying the
same allowance key as the `ConsumeAllowance` log from scenario A.

> Say: “Historical replay proves this action **would be** blocked by the on-chain policy
> before broadcast.”
> Never say: “KeeperHub attempted this transaction and failed.”

## 5. Where the evidence comes from

Captured once from Ethereum Sepolia by
`scripts/onchain/capture-evidence.mjs` in the ArcadeOps repository — read-only RPC calls
only, no broadcast. Each fixture carries a `provenance` array naming the source, method and
block tag of every field, plus an `evidenceDigest` over its own content.

Fixtures are committed. The app performs **no network call at runtime**.

## 6. How the verdict is computed

Strict order, applied by `verdict.ts`:

1. an authoritative check `FAIL` → `EXECUTION_MISMATCH`
2. an authoritative check `EVIDENCE_MISSING` → `EVIDENCE_INCOMPLETE`
3. `intent.broadcastExpected === false` → `BLOCKED_BY_POLICY`
4. any declarative check `FAIL` → `VERIFIED_WITH_WARNINGS`
5. otherwise → `VERIFIED`

Nothing is hardcoded in the UI, and no verdict string appears in the fixtures — a test
asserts it.

## 7. Digest verification — what it does and does not prove

`Verify proof` recomputes the attestation in the browser: canonical JSON → SHA-256 via Web
Crypto → comparison with the stored digest.

It proves the **integrity of the captured evidence** and that the verdict is a pure
function of it. It is **not** a fresh independent read of Sepolia: the browser never
queries the chain. The UI states this explicitly next to the result —
*"Integrity of the captured evidence verified locally. No live RPC call."*
The displayed timestamp is the **local verification time**, not on-chain data.

Tampering is rejected: four unit tests alter an amount, the block tag, the revert status
and the fixture after digest, and each one makes `verifyAttestation()` fail with a named
reason.

## 8. Offline replay

The default and only mode. No RPC, no API, no environment variable, no database. Open the
built `index.html` from any static host.

## 9. Local development

```bash
cd apps/proofgate
npm install
npm run dev          # http://localhost:5173
```

## 10. Build

```bash
npm run build        # tsc --noEmit && vite build → dist/
npm run preview      # serves dist/ on http://127.0.0.1:4173
```

## 11. Tests

```bash
npm test             # 16 unit tests: parity, tampering, product integrity
npm run test:e2e     # 12 Playwright tests on the built bundle, 4 viewports
```

E2E runs at 1920, 1440, 768 and 375 px and asserts: scenario A first, verdict visible,
replay reaching every node, real switch to B, halt on the policy node, Safe and USDC marked
not executed, working browser verification, return to A, evidence drawer, no `pageerror`,
no console error, no failed asset, no horizontal overflow.

## 12. Deployment

Deployed at **https://proofgate.vercel.app** (static, zero serverless functions).

Any static host works. See `deploy/nginx.conf` for a self-hosted setup.

```bash
npm run build
rsync -av dist/ user@server:/var/www/proofgate/
sudo cp deploy/nginx.conf /etc/nginx/sites-available/proofgate
sudo ln -sf /etc/nginx/sites-available/proofgate /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

No API is exposed, no secret is bundled, and no request leaves the browser.

## 13. Factual limits

- Scenario B is a **counterfactual historical replay**. No broadcast happened for it.
- The 5 USDC weekly cap shown in the UI is presentation data: the total is not read from
  the contract. What **is** proven on-chain is the consumption, the remaining balance, the
  exact position of the limit (boundary probes at the same block), the revert and the
  allowance key.
- `AllowanceExceeded` is index 17 of the upstream `Status` enum
  (`gnosisguild/zodiac-modifier-roles`, `PermissionChecker.sol`). The raw index and the
  allowance key are on-chain facts; the label depends on the deployed module version.
- The proof path animation only reveals facts already computed by the engine. It never
  decides anything.

---

## Video script

The submission's execution proof is the **autonomous agent run of 2026-08-05** — 0.1 USDC,
execution `no623hdfsrun2vzv3b25r`, transaction
[`0xe7e67b3a…`](https://sepolia.etherscan.io/tx/0xe7e67b3ab83e1af1f5d130d3c33dbe945cf015da8fb082020b24c253a8eb5062),
reconciled through the KeeperHub execution status, the audit command and independent RPC
evidence. The 2026-08-04 incident replayed by this app appears only as a secondary case.

Full timeline and shooting notes: [docs/VIDEO_SCRIPT.md](./docs/VIDEO_SCRIPT.md).
