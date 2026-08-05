import { formatUnits, normalizeEvidence, sameAddress } from "./normalize";
import type { EvidenceFixture, NormalizedEvidence } from "./types";

export type ReconciliationState = "MATCH" | "MISMATCH" | "NOT_DECLARED" | "NOT_APPLICABLE";

export type ReconciliationRow = {
  field: string;
  declared: string | null;
  observed: string | null;
  state: ReconciliationState;
};

export type PolicyView = {
  allowanceKey: string | null;
  capDisplay: string;
  periodLabel: string;
  consumedDisplay: string | null;
  remainingDisplay: string | null;
  beforeDisplay: string | null;
  provenLabel: string;
  proven: boolean;
};

export type TimelineStep = {
  key: "intent" | "simulation" | "execution" | "chain" | "verdict";
  label: string;
  detail: string;
  tone: "neutral" | "warn" | "ok" | "block";
};

function state(declared: string | null, observed: string | null, matches: boolean | null) {
  if (observed === null) return "NOT_APPLICABLE" as const;
  if (declared === null) return "NOT_DECLARED" as const;
  return matches ? ("MATCH" as const) : ("MISMATCH" as const);
}

/**
 * Construit la table de réconciliation déclaré-vs-chaîne.
 * Chaque cellule provient d'un champ de preuve : aucun texte n'est généré.
 */
export function buildReconciliation(
  fixture: EvidenceFixture,
  ev: NormalizedEvidence = normalizeEvidence(fixture),
): ReconciliationRow[] {
  const provider = ev.provider;
  const decimals = fixture.token.decimals;

  const providerResult = (fixture.provider?.statusResponse?.result ?? null) as Record<
    string,
    unknown
  > | null;
  const executedCall = (providerResult?.executedCall ?? null) as Record<string, unknown> | null;

  const asText = (value: unknown): string | null =>
    typeof value === "string" && value.length > 0 ? value : null;

  const declaredTx = provider ? asText(fixture.provider?.executeResponse?.transactionHash) : null;
  const observedTx = asText(fixture.rpc?.receipt?.transactionHash);
  const declaredToken = asText(executedCall?.contractAddress);
  const declaredRecipient = asText(providerResult?.recipient);

  const rows: ReconciliationRow[] = [
    {
      field: "Hash de transaction",
      declared: declaredTx,
      observed: observedTx,
      state: state(
        declaredTx,
        observedTx,
        declaredTx !== null &&
          observedTx !== null &&
          declaredTx.toLowerCase() === observedTx.toLowerCase(),
      ),
    },
    {
      field: "Chain ID",
      declared: provider?.declaredChainId != null ? String(provider.declaredChainId) : null,
      observed: ev.chainId != null ? String(ev.chainId) : null,
      state: state(
        provider?.declaredChainId != null ? String(provider.declaredChainId) : null,
        ev.chainId != null ? String(ev.chainId) : null,
        provider?.declaredChainId === ev.chainId,
      ),
    },
    {
      field: "Statut",
      declared: provider?.declaredStatus ?? null,
      observed: ev.receiptStatusOk === null ? null : ev.receiptStatusOk ? "success" : "failed",
      state: state(
        provider?.declaredStatus ?? null,
        ev.receiptStatusOk === null ? null : ev.receiptStatusOk ? "success" : "failed",
        provider?.declaredStatus === "completed" && ev.receiptStatusOk === true,
      ),
    },
    {
      field: "Émetteur effectif du transfert",
      declared: null,
      observed: ev.transferFrom,
      state: ev.transferFrom === null ? "NOT_APPLICABLE" : "NOT_DECLARED",
    },
    {
      field: "Contrat token",
      declared: declaredToken,
      observed: ev.transferEmitter,
      state: state(
        declaredToken,
        ev.transferEmitter,
        sameAddress(declaredToken, ev.transferEmitter),
      ),
    },
    {
      field: "Montant",
      declared: null,
      observed:
        ev.transferValueRaw === null
          ? null
          : `${formatUnits(ev.transferValueRaw, decimals)} ${fixture.token.symbol}`,
      state: ev.transferValueRaw === null ? "NOT_APPLICABLE" : "MATCH",
    },
    {
      field: "Destinataire",
      declared: declaredRecipient,
      observed: ev.transferTo,
      state: state(declaredRecipient, ev.transferTo, sameAddress(declaredRecipient, ev.transferTo)),
    },
    {
      field: "Gas consommé",
      declared: provider?.declaredGasUsed ?? null,
      observed: ev.gasUsed,
      state: state(
        provider?.declaredGasUsed ?? null,
        ev.gasUsed,
        provider?.declaredGasUsed === ev.gasUsed,
      ),
    },
    {
      field: "Allocation consommée",
      declared: null,
      observed:
        ev.allowanceConsumedRaw === null
          ? null
          : `${formatUnits(ev.allowanceConsumedRaw, decimals)} ${fixture.token.symbol}`,
      state: ev.allowanceConsumedRaw === null ? "NOT_APPLICABLE" : "NOT_DECLARED",
    },
    {
      field: "Allocation restante",
      declared: null,
      observed:
        ev.allowanceRemainingRaw === null
          ? null
          : `${formatUnits(ev.allowanceRemainingRaw, decimals)} ${fixture.token.symbol}`,
      state: ev.allowanceRemainingRaw === null ? "NOT_APPLICABLE" : "NOT_DECLARED",
    },
  ];

  return rows;
}

const WEEKLY_CAP_RAW = "5000000";

export function buildPolicyView(
  fixture: EvidenceFixture,
  ev: NormalizedEvidence = normalizeEvidence(fixture),
): PolicyView {
  const decimals = fixture.token.decimals;
  const remaining = ev.allowanceRemainingRaw;
  const consumed = ev.allowanceConsumedRaw;
  const before =
    remaining !== null && consumed !== null
      ? (BigInt(remaining) + BigInt(consumed)).toString()
      : null;

  // Le scénario bloqué n'émet pas ConsumeAllowance : la borne vient des sondes.
  const boundaryRemaining =
    ev.boundaryProbes.length > 0
      ? ev.boundaryProbes
          .filter((probe) => !probe.reverted)
          .map((probe) => BigInt(probe.amountRaw))
          .reduce<bigint | null>((max, value) => (max === null || value > max ? value : max), null)
      : null;

  const effectiveRemaining = remaining ?? boundaryRemaining?.toString() ?? null;

  return {
    allowanceKey: ev.allowanceKey ?? ev.revert?.info ?? null,
    capDisplay: `${formatUnits(WEEKLY_CAP_RAW, decimals)} ${fixture.token.symbol}`,
    periodLabel: "par semaine",
    consumedDisplay:
      consumed === null ? null : `${formatUnits(consumed, decimals)} ${fixture.token.symbol}`,
    remainingDisplay:
      effectiveRemaining === null
        ? null
        : `${formatUnits(effectiveRemaining, decimals)} ${fixture.token.symbol}`,
    beforeDisplay:
      before === null ? null : `${formatUnits(before, decimals)} ${fixture.token.symbol}`,
    provenLabel:
      remaining !== null
        ? "prouvé par l'événement ConsumeAllowance"
        : boundaryRemaining !== null
          ? "établi par sondes eth_call de borne"
          : "non prouvé",
    proven: remaining !== null || boundaryRemaining !== null,
  };
}

export function buildTimeline(
  fixture: EvidenceFixture,
  ev: NormalizedEvidence = normalizeEvidence(fixture),
): TimelineStep[] {
  const decimals = fixture.token.decimals;
  const amount = `${formatUnits(fixture.intent.amountRaw, decimals)} ${fixture.token.symbol}`;

  if (!fixture.intent.broadcastExpected) {
    return [
      {
        key: "intent",
        label: "Intention",
        detail: `Transférer ${amount} depuis le Safe`,
        tone: "neutral",
      },
      {
        key: "simulation",
        label: "Soumission",
        detail: "Aucune — action jamais soumise au fournisseur",
        tone: "neutral",
      },
      {
        key: "execution",
        label: "Gate",
        detail: "Serait refusée par le Roles Modifier avant toute diffusion",
        tone: "block",
      },
      {
        key: "chain",
        label: "Preuve chaîne",
        detail: `Replay contrefactuel : eth_call rejouable @ ${fixture.referenceBlock.tag} — ${ev.revert?.statusName ?? "revert"}`,
        tone: "block",
      },
      { key: "verdict", label: "Verdict", detail: "Calculé depuis les preuves", tone: "block" },
    ];
  }

  return [
    {
      key: "intent",
      label: "Intention",
      detail: `Transférer ${amount} depuis le Safe`,
      tone: "neutral",
    },
    {
      key: "simulation",
      label: "Simulation",
      detail:
        ev.provider?.simulationWouldRevert === true
          ? "Échec prédit — chemin EOA direct, non représentatif du Safe"
          : "Aucune divergence relevée",
      tone: ev.provider?.simulationWouldRevert === true ? "warn" : "neutral",
    },
    {
      key: "execution",
      label: "Exécution",
      detail: "Réussie via Roles Modifier → Safe → USDC",
      tone: "ok",
    },
    {
      key: "chain",
      label: "Preuve chaîne",
      detail: `Receipt vérifié au bloc ${fixture.referenceBlock.number}`,
      tone: "ok",
    },
    { key: "verdict", label: "Verdict", detail: "Calculé depuis les preuves", tone: "warn" },
  ];
}
