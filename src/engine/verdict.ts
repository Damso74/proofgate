import type {
  CheckOutcome,
  EvidenceFixture,
  OnchainVerdict,
  ReasonCode,
} from "./types";

export type VerdictResult = {
  verdict: OnchainVerdict;
  reasonCodes: ReasonCode[];
  warnings: CheckOutcome[];
  failures: CheckOutcome[];
  missing: CheckOutcome[];
};

/**
 * Un check autoritaire qui passe atteste d'un fait ; un check déclaratif qui
 * échoue signale une incohérence du rapport fournisseur. Les deux produisent des
 * reason codes, jamais les mêmes.
 */
function collectReasonCodes(checks: CheckOutcome[]): ReasonCode[] {
  const codes = new Set<ReasonCode>();
  for (const check of checks) {
    if (!check.reasonCode) continue;
    if (check.authority === "authoritative" && check.status === "PASS") {
      codes.add(check.reasonCode);
    }
    if (check.authority === "declarative" && check.status === "FAIL") {
      codes.add(check.reasonCode);
    }
  }
  return [...codes].sort();
}

/**
 * Calcule le verdict à partir des seuls checks.
 *
 * Fonction pure et totale : mêmes checks → même verdict, sans réseau, sans
 * horloge, sans aléa. Aucun verdict n'est écrit en dur pour un scénario donné.
 */
export function computeVerdict(fixture: EvidenceFixture, checks: CheckOutcome[]): VerdictResult {
  const authoritative = checks.filter((check) => check.authority === "authoritative");
  const declarative = checks.filter((check) => check.authority === "declarative");

  const failures = authoritative.filter((check) => check.status === "FAIL");
  const missing = authoritative.filter((check) => check.status === "EVIDENCE_MISSING");
  const warnings = declarative.filter((check) => check.status === "FAIL");

  const reasonCodes = collectReasonCodes(checks);

  // 1. Une preuve autoritaire qui contredit l'intention prime sur tout le reste.
  if (failures.length > 0) {
    return {
      verdict: "EXECUTION_MISMATCH",
      reasonCodes: [...new Set([...reasonCodes, "EXECUTION_MISMATCH" as ReasonCode])].sort(),
      warnings,
      failures,
      missing,
    };
  }

  // 2. Une preuve autoritaire absente ne peut jamais être traitée comme un succès.
  if (missing.length > 0) {
    return {
      verdict: "EVIDENCE_INCOMPLETE",
      reasonCodes: [...new Set([...reasonCodes, "EVIDENCE_INCOMPLETE" as ReasonCode])].sort(),
      warnings,
      failures,
      missing,
    };
  }

  // 3. Action empêchée avant diffusion : le revert historique EST la preuve.
  if (!fixture.intent.broadcastExpected) {
    return { verdict: "BLOCKED_BY_POLICY", reasonCodes, warnings, failures, missing };
  }

  // 4. Exécution prouvée, rapport fournisseur incohérent.
  if (warnings.length > 0) {
    return { verdict: "VERIFIED_WITH_WARNINGS", reasonCodes, warnings, failures, missing };
  }

  // 5. Exécution prouvée, rapport cohérent.
  return { verdict: "VERIFIED", reasonCodes, warnings, failures, missing };
}
