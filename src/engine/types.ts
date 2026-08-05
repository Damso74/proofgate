/**
 * Types du release gate on-chain ArcadeOps.
 *
 * Le moteur réconcilie trois sources : l'intention déclarée, ce que le fournisseur
 * (simulateur + exécuteur) rapporte, et ce que la chaîne prouve. Seule la chaîne
 * fait autorité ; le déclaratif ne peut produire que des avertissements.
 */

export const ONCHAIN_EVIDENCE_SCHEMA = "arcadeops.onchain-evidence.v1" as const;
export const ONCHAIN_ATTESTATION_SCHEMA = "arcadeops.onchain-attestation.v1" as const;

export type ScenarioId = "approved-with-warnings" | "blocked-by-policy";

/** Une preuve manquante ne vaut jamais PASS. */
export type CheckStatus = "PASS" | "FAIL" | "EVIDENCE_MISSING" | "NOT_APPLICABLE";

/** Seuls les checks `authoritative` peuvent invalider un run. */
export type CheckAuthority = "authoritative" | "declarative";

export type ReasonCode =
  | "RECEIPT_VERIFIED"
  | "INTENT_MATCHED"
  | "SAFE_EXECUTION_CONFIRMED"
  | "POLICY_ALLOWANCE_CONSUMED"
  | "SIMULATION_PATH_DIVERGED"
  | "SIMULATION_FALSE_NEGATIVE"
  | "PROVIDER_METADATA_CONFLICT"
  | "POLICY_NOT_DISCLOSED"
  | "POLICY_LIMIT_EXCEEDED"
  | "HISTORICAL_REVERT_REPRODUCED"
  | "NO_BROADCAST_EXPECTED"
  | "EVIDENCE_INCOMPLETE"
  | "EXECUTION_MISMATCH";

export type CheckId =
  // Autoritaires — exécution diffusée
  | "C_RECEIPT_SUCCESS"
  | "C_CHAIN_MATCH"
  | "C_ENTRYPOINT_IS_ROLES_MODIFIER"
  | "C_SAFE_MODULE_TRANSACTION"
  | "C_MODULE_EXECUTION_SUCCESS"
  | "C_TOKEN_TRANSFER_FROM_SAFE"
  | "C_RECIPIENT_MATCH"
  | "C_AMOUNT_MATCH"
  | "C_GAS_MATCH"
  | "C_POLICY_ALLOWANCE_CONSUMED"
  | "C_ENVELOPE_REENCODE_MATCHES"
  | "C_CONTRACT_TOPOLOGY"
  // Autoritaires — action empêchée avant diffusion
  | "B_NO_BROADCAST"
  | "B_ENVELOPE_RECONSTRUCTED"
  | "B_HISTORICAL_REVERT"
  | "B_REVERT_IS_POLICY_LIMIT"
  | "B_BOUNDARY_CONFIRMS_REMAINING"
  // Déclaratifs — rapport fournisseur
  | "D_PROVIDER_STATUS_COHERENT"
  | "D_SIMULATION_PATH_DIVERGED"
  | "D_SIMULATION_FALSE_NEGATIVE"
  | "D_PROVIDER_METADATA_CONFLICT"
  | "D_POLICY_DISCLOSED";

export type CheckOutcome = {
  id: CheckId;
  authority: CheckAuthority;
  status: CheckStatus;
  /** Libellé court, écrit en dur — jamais généré. */
  label: string;
  expected: string | null;
  observed: string | null;
  reasonCode: ReasonCode | null;
};

export type OnchainVerdict =
  | "VERIFIED"
  | "VERIFIED_WITH_WARNINGS"
  | "BLOCKED_BY_POLICY"
  | "EXECUTION_MISMATCH"
  | "EVIDENCE_INCOMPLETE";

/** Correspondance avec les enums Prisma existants — aucun nouvel enum en base. */
export const VERDICT_TO_RELEASE_DECISION: Record<
  OnchainVerdict,
  "SAFE" | "NEEDS_REVIEW" | "BLOCKED" | "REJECTED"
> = {
  VERIFIED: "SAFE",
  VERIFIED_WITH_WARNINGS: "NEEDS_REVIEW",
  BLOCKED_BY_POLICY: "BLOCKED",
  EXECUTION_MISMATCH: "REJECTED",
  EVIDENCE_INCOMPLETE: "NEEDS_REVIEW",
};

export const VERDICT_TO_POLICY_DECISION: Record<OnchainVerdict, "ALLOW" | "DENY"> = {
  VERIFIED: "ALLOW",
  VERIFIED_WITH_WARNINGS: "ALLOW",
  BLOCKED_BY_POLICY: "DENY",
  EXECUTION_MISMATCH: "DENY",
  EVIDENCE_INCOMPLETE: "DENY",
};

export type DecodedEvent = {
  logIndex: number;
  emitter: string;
  topic0: string;
  decoded: { eventName: string; args: Record<string, unknown> } | null;
};

export type DecodedRevert = {
  selector: string;
  errorSignature: string;
  statusIndex: number;
  statusName: string | null;
  info: string;
  statusEnumProvenance: string;
};

export type BoundaryProbe = {
  amountRaw: string;
  amountDisplay: string;
  reverted: boolean;
  result: string | null;
  revertData: string | null;
};

export type EvidenceFixture = {
  schemaVersion: typeof ONCHAIN_EVIDENCE_SCHEMA;
  scenarioId: ScenarioId;
  title: string;
  chainId: number;
  referenceBlock: { number: number; tag: string };
  addresses: {
    safe: string;
    rolesModifier: string;
    delegateEoa: string;
    token: string;
    recipient: string;
  };
  token: { address: string; symbol: string; decimals: number };
  intent: {
    action: string;
    sender: string;
    recipient: string;
    token: string;
    amountRaw: string;
    amountDisplay: string;
    broadcastExpected: boolean;
  };
  executionPath: string[];
  provider: ProviderCapture | null;
  rpc: {
    transaction: Record<string, unknown> | null;
    receipt: Record<string, unknown> | null;
    code: { safe: string; rolesModifier: string; delegateEoa: string } | null;
    ethCall: {
      request: Record<string, unknown>;
      blockTag: string;
      response: Record<string, unknown>;
    } | null;
  };
  decoded: {
    events: DecodedEvent[];
    envelope: {
      selector: string;
      functionSignature: string;
      roleKey: string;
      innerCalldata: string;
      outerCalldata: string;
      reencodedMatchesOnChainInput: boolean | null;
    };
    revert: DecodedRevert | null;
    boundaryProbes?: BoundaryProbe[];
  };
  provenance: Array<Record<string, unknown>>;
  capturedAt: string;
  evidenceDigest: string;
};

export type ProviderCapture = {
  tool: string | null;
  requestArguments: Record<string, unknown> | null;
  executeResponse: Record<string, unknown> | null;
  statusResponse: Record<string, unknown> | null;
  simulationResponse: Record<string, unknown> | null;
};

/** Vue normalisée : ce que la chaîne prouve, indépendamment du format fournisseur. */
export type NormalizedEvidence = {
  scenarioId: ScenarioId;
  chainId: number | null;
  blockNumber: number | null;
  receiptStatusOk: boolean | null;
  gasUsed: string | null;
  entrypoint: string | null;
  transferFrom: string | null;
  transferTo: string | null;
  transferValueRaw: string | null;
  transferEmitter: string | null;
  moduleExecutionModule: string | null;
  safeModuleTarget: string | null;
  safeModuleEmitter: string | null;
  allowanceKey: string | null;
  allowanceConsumedRaw: string | null;
  allowanceRemainingRaw: string | null;
  hasContractCode: { safe: boolean; rolesModifier: boolean; delegateEoa: boolean } | null;
  envelopeReencodeMatches: boolean | null;
  broadcastPresent: boolean;
  ethCallReverted: boolean | null;
  revert: DecodedRevert | null;
  boundaryProbes: BoundaryProbe[];
  provider: {
    declaredStatus: string | null;
    declaredGasUsed: string | null;
    declaredChainId: number | null;
    simulationWouldRevert: boolean | null;
    simulationFrom: string | null;
    simulationTo: string | null;
    sponsoredRoot: boolean | null;
    sponsoredNested: boolean | null;
    disclosesPolicy: boolean;
  } | null;
};

export type OnchainAttestation = {
  schema: typeof ONCHAIN_ATTESTATION_SCHEMA;
  scenarioId: ScenarioId;
  chainId: number;
  referenceBlock: { number: number; tag: string };
  evidenceDigest: string;
  verdict: OnchainVerdict;
  releaseDecision: "SAFE" | "NEEDS_REVIEW" | "BLOCKED" | "REJECTED";
  policyDecision: "ALLOW" | "DENY";
  reasonCodes: ReasonCode[];
  checks: CheckOutcome[];
  attestationHash: string;
};
