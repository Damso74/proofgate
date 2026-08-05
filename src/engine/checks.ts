import { sameAddress } from "./normalize";
import type {
  CheckAuthority,
  CheckId,
  CheckOutcome,
  CheckStatus,
  EvidenceFixture,
  NormalizedEvidence,
  ReasonCode,
} from "./types";

/** Statut de Zodiac Roles signifiant qu'une allocation a été dépassée. */
const ALLOWANCE_STATUS_NAMES = new Set(["AllowanceExceeded", "EtherAllowanceExceeded"]);

type Draft = {
  id: CheckId;
  authority: CheckAuthority;
  label: string;
  expected: string | null;
  observed: string | null;
  status: CheckStatus;
  reasonCode?: ReasonCode | null;
};

function make(draft: Draft): CheckOutcome {
  return {
    id: draft.id,
    authority: draft.authority,
    status: draft.status,
    label: draft.label,
    expected: draft.expected,
    observed: draft.observed,
    reasonCode: draft.reasonCode ?? null,
  };
}

/** Une valeur absente donne EVIDENCE_MISSING, jamais PASS. */
function decide(observed: unknown, predicate: () => boolean): CheckStatus {
  if (observed === null || observed === undefined) return "EVIDENCE_MISSING";
  return predicate() ? "PASS" : "FAIL";
}

function boolStatus(value: boolean | null | undefined, expected: boolean): CheckStatus {
  if (value === null || value === undefined) return "EVIDENCE_MISSING";
  return value === expected ? "PASS" : "FAIL";
}

function executedChecks(fixture: EvidenceFixture, ev: NormalizedEvidence): CheckOutcome[] {
  const addr = fixture.addresses;
  const intent = fixture.intent;

  return [
    make({
      id: "C_RECEIPT_SUCCESS",
      authority: "authoritative",
      label: "Le receipt on-chain est en succès",
      expected: "status = 0x1",
      observed: ev.receiptStatusOk === null ? null : ev.receiptStatusOk ? "0x1" : "0x0",
      status: boolStatus(ev.receiptStatusOk, true),
      reasonCode: "RECEIPT_VERIFIED",
    }),
    make({
      id: "C_CHAIN_MATCH",
      authority: "authoritative",
      label: "La chaîne d'exécution correspond à l'intention",
      expected: String(fixture.chainId),
      observed: ev.chainId === null ? null : String(ev.chainId),
      status: decide(ev.chainId, () => ev.chainId === fixture.chainId),
    }),
    make({
      id: "C_ENTRYPOINT_IS_ROLES_MODIFIER",
      authority: "authoritative",
      label: "Le point d'entrée de la transaction est le Roles Modifier",
      expected: addr.rolesModifier,
      observed: ev.entrypoint,
      status: decide(ev.entrypoint, () => sameAddress(ev.entrypoint, addr.rolesModifier)),
    }),
    make({
      id: "C_SAFE_MODULE_TRANSACTION",
      authority: "authoritative",
      label: "Le Safe a journalisé une transaction de module vers le token",
      expected: `${addr.safe} → ${addr.token}`,
      observed:
        ev.safeModuleEmitter && ev.safeModuleTarget
          ? `${ev.safeModuleEmitter} → ${ev.safeModuleTarget}`
          : null,
      status: decide(
        ev.safeModuleEmitter,
        () =>
          sameAddress(ev.safeModuleEmitter, addr.safe) &&
          sameAddress(ev.safeModuleTarget, addr.token),
      ),
    }),
    make({
      id: "C_MODULE_EXECUTION_SUCCESS",
      authority: "authoritative",
      label: "Le Safe confirme le succès de l'exécution par le module",
      expected: addr.rolesModifier,
      observed: ev.moduleExecutionModule,
      status: decide(ev.moduleExecutionModule, () =>
        sameAddress(ev.moduleExecutionModule, addr.rolesModifier),
      ),
      reasonCode: "SAFE_EXECUTION_CONFIRMED",
    }),
    make({
      id: "C_TOKEN_TRANSFER_FROM_SAFE",
      authority: "authoritative",
      label: "Le transfert ERC20 a bien pour émetteur le Safe",
      expected: `${addr.token} :: from ${addr.safe}`,
      observed:
        ev.transferEmitter && ev.transferFrom
          ? `${ev.transferEmitter} :: from ${ev.transferFrom}`
          : null,
      status: decide(
        ev.transferFrom,
        () =>
          sameAddress(ev.transferEmitter, addr.token) && sameAddress(ev.transferFrom, addr.safe),
      ),
    }),
    make({
      id: "C_RECIPIENT_MATCH",
      authority: "authoritative",
      label: "Le destinataire on-chain correspond à l'intention",
      expected: intent.recipient,
      observed: ev.transferTo,
      status: decide(ev.transferTo, () => sameAddress(ev.transferTo, intent.recipient)),
      reasonCode: "INTENT_MATCHED",
    }),
    make({
      id: "C_AMOUNT_MATCH",
      authority: "authoritative",
      label: "Le montant transféré correspond à l'intention",
      expected: intent.amountRaw,
      observed: ev.transferValueRaw,
      status: decide(ev.transferValueRaw, () => ev.transferValueRaw === intent.amountRaw),
    }),
    make({
      id: "C_GAS_MATCH",
      authority: "authoritative",
      label: "Le gas déclaré par le fournisseur correspond au receipt",
      expected: ev.provider?.declaredGasUsed ?? null,
      observed: ev.gasUsed,
      status:
        ev.provider?.declaredGasUsed == null || ev.gasUsed == null
          ? "EVIDENCE_MISSING"
          : ev.provider.declaredGasUsed === ev.gasUsed
            ? "PASS"
            : "FAIL",
    }),
    make({
      id: "C_POLICY_ALLOWANCE_CONSUMED",
      authority: "authoritative",
      label: "L'allocation de policy a été consommée on-chain",
      expected: `consommé = ${intent.amountRaw}`,
      observed:
        ev.allowanceConsumedRaw === null
          ? null
          : `consommé = ${ev.allowanceConsumedRaw}, restant = ${ev.allowanceRemainingRaw ?? "?"}`,
      status: decide(
        ev.allowanceConsumedRaw,
        () => ev.allowanceConsumedRaw === intent.amountRaw && ev.allowanceRemainingRaw !== null,
      ),
      reasonCode: "POLICY_ALLOWANCE_CONSUMED",
    }),
    make({
      id: "C_ENVELOPE_REENCODE_MATCHES",
      authority: "authoritative",
      label: "L'enveloppe Roles ré-encodée est identique au calldata on-chain",
      expected: "true",
      observed: ev.envelopeReencodeMatches === null ? null : String(ev.envelopeReencodeMatches),
      status: boolStatus(ev.envelopeReencodeMatches, true),
    }),
    make({
      id: "C_CONTRACT_TOPOLOGY",
      authority: "authoritative",
      label: "Safe et Roles Modifier sont des contrats, le délégué est un EOA",
      expected: "safe=code, roles=code, delegate=aucun code",
      observed: ev.hasContractCode
        ? `safe=${ev.hasContractCode.safe}, roles=${ev.hasContractCode.rolesModifier}, delegate=${ev.hasContractCode.delegateEoa}`
        : null,
      status: decide(
        ev.hasContractCode,
        () =>
          ev.hasContractCode!.safe &&
          ev.hasContractCode!.rolesModifier &&
          !ev.hasContractCode!.delegateEoa,
      ),
    }),
  ];
}

function blockedChecks(fixture: EvidenceFixture, ev: NormalizedEvidence): CheckOutcome[] {
  const probes = ev.boundaryProbes;
  const passing = probes.filter((probe) => !probe.reverted).map((probe) => BigInt(probe.amountRaw));
  const highestPassing = passing.length > 0 ? passing.reduce((a, b) => (a > b ? a : b)) : null;
  const attempted = BigInt(fixture.intent.amountRaw);

  return [
    make({
      id: "B_NO_BROADCAST",
      authority: "authoritative",
      label: "Aucune transaction n'a été diffusée",
      expected: "aucun tx, aucun receipt",
      observed: ev.broadcastPresent ? "transaction présente" : "aucun tx, aucun receipt",
      status: ev.broadcastPresent ? "FAIL" : "PASS",
      reasonCode: "NO_BROADCAST_EXPECTED",
    }),
    make({
      id: "B_ENVELOPE_RECONSTRUCTED",
      authority: "authoritative",
      label: "L'enveloppe Roles complète a été reconstruite (pas un simple transfer ERC20)",
      expected: "execTransactionWithRole(address,uint256,bytes,uint8,bytes32,bool)",
      observed: fixture.decoded?.envelope?.functionSignature ?? null,
      status: decide(
        fixture.decoded?.envelope?.functionSignature,
        () =>
          fixture.decoded.envelope.functionSignature ===
            "execTransactionWithRole(address,uint256,bytes,uint8,bytes32,bool)" &&
          fixture.decoded.envelope.selector === "0xc6fe8747",
      ),
    }),
    make({
      id: "B_HISTORICAL_REVERT",
      authority: "authoritative",
      label: "L'eth_call historique reverte au bloc de référence",
      expected: `revert @ ${fixture.referenceBlock.tag}`,
      observed:
        ev.ethCallReverted === null
          ? null
          : ev.ethCallReverted
            ? `revert @ ${fixture.referenceBlock.tag}`
            : "aucun revert",
      status: boolStatus(ev.ethCallReverted, true),
      reasonCode: "HISTORICAL_REVERT_REPRODUCED",
    }),
    make({
      id: "B_REVERT_IS_POLICY_LIMIT",
      authority: "authoritative",
      label: "La cause du revert est la limite d'allocation du module de policy",
      expected: "ConditionViolation :: AllowanceExceeded",
      observed: ev.revert ? `${ev.revert.errorSignature} :: ${ev.revert.statusName ?? "?"}` : null,
      status: decide(
        ev.revert,
        () =>
          ev.revert!.errorSignature === "ConditionViolation(uint8,bytes32)" &&
          ev.revert!.statusName !== null &&
          ALLOWANCE_STATUS_NAMES.has(ev.revert!.statusName),
      ),
      reasonCode: "POLICY_LIMIT_EXCEEDED",
    }),
    make({
      id: "B_BOUNDARY_CONFIRMS_REMAINING",
      authority: "authoritative",
      label: "Les sondes de borne situent la limite exactement à l'allocation restante",
      expected: `le montant tenté (${fixture.intent.amountRaw}) dépasse la plus haute sonde acceptée`,
      observed:
        highestPassing === null ? null : `plus haute sonde acceptée = ${highestPassing.toString()}`,
      status:
        probes.length === 0
          ? "EVIDENCE_MISSING"
          : highestPassing !== null && highestPassing < attempted
            ? "PASS"
            : "FAIL",
    }),
  ];
}

function declarativeChecks(_fixture: EvidenceFixture, ev: NormalizedEvidence): CheckOutcome[] {
  const provider = ev.provider;
  if (!provider) {
    return [
      make({
        id: "D_PROVIDER_STATUS_COHERENT",
        authority: "declarative",
        label: "Rapport fournisseur disponible",
        expected: "rapport fournisseur",
        observed: null,
        status: "NOT_APPLICABLE",
      }),
    ];
  }

  const simulationIsDirectPath =
    provider.simulationFrom !== null &&
    provider.simulationTo !== null &&
    sameAddress(provider.simulationFrom, _fixture.addresses.delegateEoa) &&
    sameAddress(provider.simulationTo, _fixture.addresses.token);

  return [
    make({
      id: "D_PROVIDER_STATUS_COHERENT",
      authority: "authoritative",
      label: "Le statut déclaré par le fournisseur correspond au receipt",
      expected: "completed ↔ receipt success",
      observed:
        provider.declaredStatus === null
          ? null
          : `${provider.declaredStatus} ↔ ${ev.receiptStatusOk === null ? "?" : ev.receiptStatusOk}`,
      status:
        provider.declaredStatus === null || ev.receiptStatusOk === null
          ? "EVIDENCE_MISSING"
          : (provider.declaredStatus === "completed") === ev.receiptStatusOk
            ? "PASS"
            : "FAIL",
    }),
    make({
      id: "D_SIMULATION_PATH_DIVERGED",
      authority: "declarative",
      label: "Le chemin du simulateur diverge de celui de l'exécuteur",
      expected: "simulateur et exécuteur empruntent le même chemin",
      observed: simulationIsDirectPath
        ? "simulateur : EOA → token (direct) · exécuteur : EOA → Roles → Safe → token"
        : provider.simulationFrom === null
          ? null
          : "chemins alignés",
      status:
        provider.simulationFrom === null
          ? "NOT_APPLICABLE"
          : simulationIsDirectPath
            ? "FAIL"
            : "PASS",
      reasonCode: "SIMULATION_PATH_DIVERGED",
    }),
    make({
      id: "D_SIMULATION_FALSE_NEGATIVE",
      authority: "declarative",
      label: "La simulation a prédit un échec alors que l'exécution a réussi",
      expected: "prédiction de simulation = issue d'exécution",
      observed:
        provider.simulationWouldRevert === null
          ? null
          : `simulation wouldRevert=${provider.simulationWouldRevert}, exécution success=${ev.receiptStatusOk}`,
      status:
        provider.simulationWouldRevert === null || ev.receiptStatusOk === null
          ? "NOT_APPLICABLE"
          : provider.simulationWouldRevert && ev.receiptStatusOk
            ? "FAIL"
            : "PASS",
      reasonCode: "SIMULATION_FALSE_NEGATIVE",
    }),
    make({
      id: "D_PROVIDER_METADATA_CONFLICT",
      authority: "declarative",
      label: "Les métadonnées fournisseur sont cohérentes entre niveaux",
      expected: "sponsored identique à la racine et dans executedCall",
      observed:
        provider.sponsoredRoot === null || provider.sponsoredNested === null
          ? null
          : `racine=${provider.sponsoredRoot}, executedCall=${provider.sponsoredNested}`,
      status:
        provider.sponsoredRoot === null || provider.sponsoredNested === null
          ? "NOT_APPLICABLE"
          : provider.sponsoredRoot === provider.sponsoredNested
            ? "PASS"
            : "FAIL",
      reasonCode: "PROVIDER_METADATA_CONFLICT",
    }),
    make({
      id: "D_POLICY_DISCLOSED",
      authority: "declarative",
      label: "Le fournisseur expose la consommation de policy",
      expected: "champ allowance/policy présent dans la réponse",
      observed: provider.disclosesPolicy ? "présent" : "absent",
      status: provider.disclosesPolicy ? "PASS" : "FAIL",
      reasonCode: "POLICY_NOT_DISCLOSED",
    }),
  ];
}

/**
 * Évalue tous les checks applicables au scénario.
 * Fonction pure : aucune E/S, aucune horloge, aucun accès réseau.
 */
export function evaluateChecks(fixture: EvidenceFixture, ev: NormalizedEvidence): CheckOutcome[] {
  const core = fixture.intent.broadcastExpected
    ? executedChecks(fixture, ev)
    : blockedChecks(fixture, ev);
  return [...core, ...declarativeChecks(fixture, ev)];
}
