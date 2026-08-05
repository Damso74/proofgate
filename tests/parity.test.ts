import { describe, expect, it } from "vitest";

import {
  buildAttestation,
  computeEvidenceDigest,
  FIXTURES,
  loadScenario,
  type EvidenceFixture,
  type ScenarioId,
  verifyAttestation,
} from "../src/engine";

/**
 * Références produites par le moteur ArcadeOps (`src/lib/onchain`), verrouillées
 * là-bas par `src/lib/onchain/canonical.test.ts`. Ce test prouve que le noyau
 * dupliqué dans ProofGate produit exactement les mêmes verdicts et les mêmes
 * digests : toute dérive entre les deux implémentations casse la suite.
 */
const REFERENCE = {
  "approved-with-warnings": {
    evidenceDigest: "87e843af5ab66f19dc40bc79fb764c78f2de57c3fe4c9ad54a217da31fe637d0",
    attestationHash: "2995dd7622db3358a51bb6e37a4ae6f00b50f476e7b52a09193352081fdae328",
    verdict: "VERIFIED_WITH_WARNINGS",
    releaseDecision: "NEEDS_REVIEW",
    policyDecision: "ALLOW",
  },
  "blocked-by-policy": {
    evidenceDigest: "cd9eff912b068469e5b562bba526d02a3ee7e27d1e61a9b16b962c6ddb2d3d59",
    attestationHash: "9d2ee1f2399259789b6594a4a2d56ca6026f2de020708dad2c619ca2b1490baa",
    verdict: "BLOCKED_BY_POLICY",
    releaseDecision: "BLOCKED",
    policyDecision: "DENY",
  },
} as const satisfies Record<ScenarioId, Record<string, string>>;

function clone(id: ScenarioId): EvidenceFixture {
  return structuredClone(FIXTURES[id]) as EvidenceFixture;
}

function transferArgs(fixture: EvidenceFixture): Record<string, unknown> {
  const event = fixture.decoded.events.find((entry) => entry.decoded?.eventName === "Transfer");
  if (!event?.decoded) throw new Error("Transfer log absent");
  return event.decoded.args;
}

describe("parité avec le moteur de référence ArcadeOps", () => {
  for (const id of Object.keys(REFERENCE) as ScenarioId[]) {
    it(`${id} — verdict et digests identiques aux références`, async () => {
      const attestation = await buildAttestation(FIXTURES[id]);
      expect(attestation.verdict).toBe(REFERENCE[id].verdict);
      expect(attestation.releaseDecision).toBe(REFERENCE[id].releaseDecision);
      expect(attestation.policyDecision).toBe(REFERENCE[id].policyDecision);
      expect(attestation.evidenceDigest).toBe(REFERENCE[id].evidenceDigest);
      expect(attestation.attestationHash).toBe(REFERENCE[id].attestationHash);
    });

    it(`${id} — le digest de la fixture correspond à son contenu`, async () => {
      expect(await computeEvidenceDigest(FIXTURES[id])).toBe(REFERENCE[id].evidenceDigest);
    });

    it(`${id} — verify() est positif sur la fixture intacte`, async () => {
      const attestation = await buildAttestation(FIXTURES[id]);
      const outcome = await verifyAttestation(FIXTURES[id], attestation);
      expect(outcome.ok).toBe(true);
      expect(outcome.reasons).toEqual([]);
    });

    it(`${id} — le hash est reproductible`, async () => {
      const first = await buildAttestation(clone(id));
      const second = await buildAttestation(clone(id));
      expect(first.attestationHash).toBe(second.attestationHash);
    });
  }
});

describe("détection d'altération", () => {
  it("un montant modifié fait échouer verify()", async () => {
    const fixture = clone("approved-with-warnings");
    const attestation = await buildAttestation(fixture);
    transferArgs(fixture).value = "999999";
    const outcome = await verifyAttestation(fixture, attestation);
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons).toContain("evidence_digest_mismatch");
  });

  it("un block tag modifié fait échouer verify()", async () => {
    const fixture = clone("blocked-by-policy");
    const attestation = await buildAttestation(fixture);
    fixture.referenceBlock.tag = "0xae3a9f";
    expect((await verifyAttestation(fixture, attestation)).ok).toBe(false);
  });

  it("un revert modifié fait basculer le verdict et échouer verify()", async () => {
    const fixture = clone("blocked-by-policy");
    const attestation = await buildAttestation(fixture);
    fixture.decoded.revert!.statusName = "Ok";
    const outcome = await verifyAttestation(fixture, attestation);
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons).toContain("verdict_mismatch");
  });

  it("une fixture modifiée après calcul du digest est rejetée", async () => {
    const fixture = clone("approved-with-warnings");
    const attestation = await buildAttestation(FIXTURES["approved-with-warnings"]);
    fixture.intent.amountRaw = "2000000";
    const outcome = await verifyAttestation(fixture, attestation);
    expect(outcome.ok).toBe(false);
  });
});

describe("intégrité du produit", () => {
  it("aucun verdict n'est écrit en dur dans les fixtures", () => {
    for (const fixture of Object.values(FIXTURES)) {
      const serialized = JSON.stringify(fixture);
      expect(serialized).not.toContain("VERIFIED_WITH_WARNINGS");
      expect(serialized).not.toContain("BLOCKED_BY_POLICY");
    }
  });

  it("le graphe de preuve reflète le verdict calculé", async () => {
    const approved = await loadScenario("approved-with-warnings");
    expect(approved.path.every((node) => node.reached)).toBe(true);
    expect(approved.path.some((node) => node.halted)).toBe(false);

    const blocked = await loadScenario("blocked-by-policy");
    expect(blocked.path.find((node) => node.key === "policy")?.halted).toBe(true);
    expect(blocked.path.find((node) => node.key === "safe")?.reached).toBe(false);
    expect(blocked.path.find((node) => node.key === "token")?.reached).toBe(false);
  });

  it("les lignes claim-vs-reality proviennent des preuves", async () => {
    const approved = await loadScenario("approved-with-warnings");
    expect(approved.claims.rows[0]?.claim).toBe("Predicted failure");
    expect(approved.claims.rows[0]?.reality).toBe("Transaction succeeded");

    const blocked = await loadScenario("blocked-by-policy");
    expect(blocked.claims.rows[0]?.reality).toContain("4 USDC");
    expect(blocked.claims.rows[2]?.reality).toContain("AllowanceExceeded");
  });

  it("la policy expose 1 consommé et 4 restants pour le scénario autorisé", async () => {
    const approved = await loadScenario("approved-with-warnings");
    expect(approved.policy.consumedDisplay).toBe("1 USDC");
    expect(approved.policy.remainingDisplay).toBe("4 USDC");
  });
});
