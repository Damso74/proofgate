import { canonicalJson, sha256HexAsync } from "./canonical";
import { evaluateChecks } from "./checks";
import { normalizeEvidence } from "./normalize";
import {
  ONCHAIN_ATTESTATION_SCHEMA,
  type EvidenceFixture,
  type OnchainAttestation,
  VERDICT_TO_POLICY_DECISION,
  VERDICT_TO_RELEASE_DECISION,
} from "./types";
import { computeVerdict } from "./verdict";

/**
 * Variante navigateur de l'attestation ArcadeOps.
 *
 * Identique en sémantique à `src/lib/onchain/attestation.ts`, mais le hash passe
 * par Web Crypto au lieu de `node:crypto` : l'application est donc entièrement
 * exécutable côté client, sans backend. La parité des digests avec le moteur de
 * référence est verrouillée par `tests/parity.test.ts`.
 */
export async function computeEvidenceDigest(fixture: EvidenceFixture): Promise<string> {
  const evidence: Record<string, unknown> = { ...fixture };
  delete evidence.evidenceDigest;
  return sha256HexAsync(canonicalJson(evidence));
}

export async function buildAttestation(fixture: EvidenceFixture): Promise<OnchainAttestation> {
  const normalized = normalizeEvidence(fixture);
  const checks = evaluateChecks(fixture, normalized);
  const result = computeVerdict(fixture, checks);

  const unsigned = {
    schema: ONCHAIN_ATTESTATION_SCHEMA,
    scenarioId: fixture.scenarioId,
    chainId: fixture.chainId,
    referenceBlock: fixture.referenceBlock,
    evidenceDigest: await computeEvidenceDigest(fixture),
    verdict: result.verdict,
    releaseDecision: VERDICT_TO_RELEASE_DECISION[result.verdict],
    policyDecision: VERDICT_TO_POLICY_DECISION[result.verdict],
    reasonCodes: result.reasonCodes,
    checks,
  } satisfies Omit<OnchainAttestation, "attestationHash">;

  return { ...unsigned, attestationHash: await sha256HexAsync(canonicalJson(unsigned)) };
}

export function attestationCanonicalPayload(
  attestation: OnchainAttestation,
): Omit<OnchainAttestation, "attestationHash"> {
  const unsigned: Record<string, unknown> = { ...attestation };
  delete unsigned.attestationHash;
  return unsigned as Omit<OnchainAttestation, "attestationHash">;
}

export type VerifyOutcome = { ok: boolean; reasons: string[]; recomputedHash: string };

/**
 * Recalcule verdict et hash depuis les preuves, puis compare. Toute altération
 * d'un octet de preuve, du block tag ou du revert fait échouer la vérification.
 */
export async function verifyAttestation(
  fixture: EvidenceFixture,
  attestation: OnchainAttestation,
): Promise<VerifyOutcome> {
  const reasons: string[] = [];
  const recomputed = await buildAttestation(fixture);

  if (recomputed.evidenceDigest !== attestation.evidenceDigest) {
    reasons.push("evidence_digest_mismatch");
  }
  if (fixture.evidenceDigest && fixture.evidenceDigest !== recomputed.evidenceDigest) {
    reasons.push("fixture_digest_mismatch");
  }
  if (recomputed.verdict !== attestation.verdict) reasons.push("verdict_mismatch");
  if (recomputed.attestationHash !== attestation.attestationHash) {
    reasons.push("attestation_hash_mismatch");
  }

  return { ok: reasons.length === 0, reasons, recomputedHash: recomputed.attestationHash };
}
