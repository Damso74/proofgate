import approvedFixture from "./fixtures/approved-with-warnings.json";
import blockedFixture from "./fixtures/blocked-by-policy.json";
import { buildAttestation } from "./attestation";
import { normalizeEvidence } from "./normalize";
import {
  buildPolicyView,
  buildReconciliation,
  type PolicyView,
  type ReconciliationRow,
} from "./presentation";
import type { EvidenceFixture, OnchainAttestation, ScenarioId } from "./types";

export const FIXTURES: Record<ScenarioId, EvidenceFixture> = {
  "approved-with-warnings": approvedFixture as unknown as EvidenceFixture,
  "blocked-by-policy": blockedFixture as unknown as EvidenceFixture,
};

export const SCENARIO_IDS: ScenarioId[] = ["approved-with-warnings", "blocked-by-policy"];

/** Étapes du graphe de preuve. `reached` est calculé, jamais écrit en dur. */
export type PathNode = {
  key: "intent" | "keeperhub" | "policy" | "safe" | "token" | "verdict";
  label: string;
  sublabel: string;
  reached: boolean;
  halted: boolean;
  /** Tonalité visuelle dérivée du verdict, jamais choisie par l'UI. */
  tone: "ok" | "stop" | "idle";
};

export type ClaimRow = { claim: string; reality: string };

export type ScenarioView = {
  id: ScenarioId;
  fixture: EvidenceFixture;
  attestation: OnchainAttestation;
  reconciliation: ReconciliationRow[];
  policy: PolicyView;
  path: PathNode[];
  claims: { leftTitle: string; rightTitle: string; rows: ClaimRow[] };
  headline: string;
  subline: string;
  executed: boolean;
  txHash: string | null;
  explorerTxUrl: string | null;
};

function shortHex(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 2 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

function buildPath(fixture: EvidenceFixture, executed: boolean): PathNode[] {
  const token = fixture.token.symbol;
  return [
    {
      key: "intent",
      label: "Agent intent",
      sublabel: `Transfer ${fixture.intent.amountDisplay} ${token}`,
      reached: true,
      halted: false,
      tone: "ok",
    },
    {
      key: "keeperhub",
      label: "KeeperHub",
      sublabel: "execTransactionWithRole",
      reached: true,
      halted: false,
      tone: "ok",
    },
    {
      key: "policy",
      label: "Roles policy",
      sublabel: executed ? "Allowance consumed" : "Allowance exceeded",
      reached: true,
      halted: !executed,
      tone: executed ? "ok" : "stop",
    },
    {
      key: "safe",
      label: "Safe",
      sublabel: executed ? "Transfer emitted" : "Not executed",
      reached: executed,
      halted: false,
      tone: executed ? "ok" : "idle",
    },
    {
      key: "token",
      label: token,
      sublabel: executed ? "Receipt confirmed" : "Not executed",
      reached: executed,
      halted: false,
      tone: executed ? "ok" : "idle",
    },
    {
      key: "verdict",
      label: "ProofGate",
      sublabel: executed ? "Warnings raised" : "Verdict: blocked",
      reached: true,
      halted: false,
      tone: executed ? "ok" : "stop",
    },
  ];
}

/**
 * Les lignes claim-vs-reality sont dérivées du résultat calculé (checks,
 * événements décodés, sondes), jamais redéfinies dans les composants.
 */
function buildClaims(
  fixture: EvidenceFixture,
  policy: PolicyView,
  executed: boolean,
): ScenarioView["claims"] {
  const normalized = normalizeEvidence(fixture);
  const token = fixture.token.symbol;

  if (executed) {
    const simulationFailed = normalized.provider?.simulationWouldRevert === true;
    const sponsoredRoot = normalized.provider?.sponsoredRoot;
    const sponsoredNested = normalized.provider?.sponsoredNested;
    const disclosed = normalized.provider?.disclosesPolicy === true;
    return {
      leftTitle: "Provider claim",
      rightTitle: "On-chain reality",
      rows: [
        {
          claim: simulationFailed ? "Predicted failure" : "Predicted success",
          reality: normalized.receiptStatusOk ? "Transaction succeeded" : "Transaction failed",
        },
        {
          claim: `sponsored: ${String(sponsoredRoot)} at root`,
          reality: `sponsored: ${String(sponsoredNested)} inside executedCall`,
        },
        {
          claim: disclosed ? "Policy disclosed" : "Policy undisclosed",
          reality: `Allowance consumption emitted on-chain — ${policy.consumedDisplay ?? "—"}`,
        },
      ],
    };
  }

  // `policy.remainingDisplay` retient déjà la plus haute sonde acceptée.
  const remaining = policy.remainingDisplay ?? "—";
  return {
    leftTitle: "Requested action",
    rightTitle: "Policy reality",
    rows: [
      {
        claim: `Transfer ${fixture.intent.amountDisplay} ${token}`,
        reality: `Only ${remaining} remaining`,
      },
      {
        claim: "Broadcast not attempted",
        reality: `Historical replay reverted at block ${fixture.referenceBlock.number}`,
      },
      {
        claim: "Generic execution intent",
        reality: `${normalized.revert?.statusName ?? "revert"} tied to allowance key ${shortHex(
          normalized.revert?.info ?? "",
          10,
          6,
        )}`,
      },
    ],
  };
}

export async function loadScenario(id: ScenarioId): Promise<ScenarioView> {
  const fixture = FIXTURES[id];
  const attestation = await buildAttestation(fixture);
  const normalized = normalizeEvidence(fixture);
  const executed = fixture.intent.broadcastExpected;
  const policy = buildPolicyView(fixture, normalized);
  const txHash = (fixture.rpc?.receipt?.transactionHash as string | undefined) ?? null;

  return {
    id,
    fixture,
    attestation,
    reconciliation: buildReconciliation(fixture, normalized),
    policy,
    path: buildPath(fixture, executed),
    claims: buildClaims(fixture, policy, executed),
    headline: executed ? "Executed on-chain" : "Blocked by policy",
    subline: executed ? "Verified with warnings" : "Would be rejected before broadcast",
    executed,
    txHash,
    explorerTxUrl: txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : null,
  };
}

export async function loadAllScenarios(): Promise<ScenarioView[]> {
  return Promise.all(SCENARIO_IDS.map(loadScenario));
}

export { shortHex };
export * from "./attestation";
export * from "./canonical";
export * from "./presentation";
export * from "./types";
export { evaluateChecks } from "./checks";
export { formatUnits, normalizeEvidence } from "./normalize";
export { computeVerdict } from "./verdict";
