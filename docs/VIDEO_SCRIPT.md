# Video script — 2:30

The submission's execution proof is the **autonomous agent run**. The 2026-08-04 reliability
incident is a secondary case, shown only after the execution has been established.

## Primary subject

| | |
| --- | --- |
| Run | **Autonomous Agent Run — 2026-08-05** |
| Amount | **0.1 USDC** |
| KeeperHub execution id | **`no623hdfsrun2vzv3b25r`** |
| Transaction | [`0xe7e67b3ab83e1af1f5d130d3c33dbe945cf015da8fb082020b24c253a8eb5062`](https://sepolia.etherscan.io/tx/0xe7e67b3ab83e1af1f5d130d3c33dbe945cf015da8fb082020b24c253a8eb5062) |
| Network | Ethereum Sepolia · block 11424015 · gas 119 267 |
| Agent | [keeper-agent](https://github.com/Damso74/keeper-agent) |

## Timeline

### 0:00–0:15 — The gap

Agent platforms report success, failure or safety from incomplete infrastructure signals.
Open on the problem, not on the product.

### 0:15–0:50 — The agent decides and executes

Run the agent. Show the decision log: it reads chain state itself, measures the remaining
Zodiac Roles allowance by binary search over `eth_call`, and applies a deterministic rule.

```bash
npm run agent -- --execute
```

Then the execution through KeeperHub, and the transaction on Etherscan.

> "No human chose the moment or the amount. The agent observed, decided, and executed
> through KeeperHub."

### 0:50–1:20 — KeeperHub execution status

Show the provider's own record for `no623hdfsrun2vzv3b25r`: status `completed`,
receipt `success`, `verified: true`, gas 119 267.

Independent cross-check outside the agent — the CLI is **not** a runtime dependency:

```bash
kh execute status no623hdfsrun2vzv3b25r --json
```

### 1:20–2:00 — Audit and independent reconciliation

```bash
npm --silent run audit -- no623hdfsrun2vzv3b25r | jq
```

Walk through the output: the KeeperHub audit record, the Analytics REST coverage, then the
RPC evidence read independently — `Transfer` emitted **by the Safe**,
`ExecutionFromModuleSuccess`, and `ConsumeAllowance` moving the allowance from 4 to
3.9 USDC.

Verdict: **`MATCH_WITH_PROVIDER_WARNINGS`**. Every authoritative check agrees with the chain.
Two provider-side warnings remain: `sponsored` contradicts itself between two levels of the
same response, and the audit record never discloses allowance consumption.

> "The chain agrees on every authoritative check. The provider's own record still contradicts
> itself. That distinction is the product."

### 2:00–2:20 — Secondary case: the 2026-08-04 incident

Switch to [ProofGate](https://proofgate.vercel.app). A **separate, earlier run**: 1 USDC,
execution `1w6mru2gemgtq7wsruvaj`, transaction `0x0801289e…`.

Two scenarios: the simulation false negative, and the counterfactual block proven by a
historical `eth_call` replay. Click **Verify proof** — the digest is recomputed in the
browser, with no network call.

### 2:20–2:30 — Close

> **KeeperHub executes autonomous actions. ProofGate independently reconciles agent claims,
> policy state, and captured on-chain evidence before the result is trusted.**

## Shooting notes

- Keep **one uncut take** of the execution sequence. If the edit raises any doubt, that take
  is the answer.
- Never conflate the two runs. The 2026-08-05 agent run is the execution proof; the
  2026-08-04 incident is supporting evidence for the reliability argument.
- Say "historical replay proves this action *would be* blocked before broadcast" — never
  "KeeperHub attempted and blocked this transaction".
