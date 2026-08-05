import type {
  BoundaryProbe,
  DecodedEvent,
  EvidenceFixture,
  NormalizedEvidence,
} from "./types";

/** Adresse en minuscules, ou null. Aucune valeur par défaut : l'absence reste l'absence. */
export function lowerAddress(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? value.toLowerCase()
    : null;
}

export function sameAddress(a: unknown, b: unknown): boolean {
  const left = lowerAddress(a);
  const right = lowerAddress(b);
  return left !== null && right !== null && left === right;
}

/** Quantité décimale normalisée en chaîne — jamais de Number, jamais d'arrondi. */
export function rawAmount(value: unknown): string | null {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return String(value);
  return null;
}

export function hexToNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function hexToDecimalString(value: unknown): string | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  return BigInt(value).toString();
}

export function formatUnits(raw: string | null, decimals: number): string | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const padded = raw.padStart(decimals + 1, "0");
  const integer = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

function eventByName(events: DecodedEvent[], name: string): DecodedEvent | null {
  return events.find((entry) => entry.decoded?.eventName === name) ?? null;
}

function arg(event: DecodedEvent | null, key: string): unknown {
  return event?.decoded?.args?.[key];
}

function hasCode(value: unknown): boolean {
  return typeof value === "string" && value.length > 2 && value !== "0x";
}

function normalizeProvider(fixture: EvidenceFixture): NormalizedEvidence["provider"] {
  const provider = fixture.provider;
  // Absence totale de rapport fournisseur (action empêchée avant soumission) :
  // il n'y a rien à réconcilier, pas une preuve manquante.
  if (
    !provider ||
    (!provider.executeResponse && !provider.statusResponse && !provider.simulationResponse)
  ) {
    return null;
  }

  const status = provider.statusResponse as Record<string, unknown> | null;
  const result = (status?.result ?? null) as Record<string, unknown> | null;
  const executedCall = (result?.executedCall ?? null) as Record<string, unknown> | null;
  const receipts = Array.isArray(status?.receipts)
    ? (status.receipts as Array<Record<string, unknown>>)
    : [];
  const firstReceipt = receipts[0] ?? null;
  const simulation = provider.simulationResponse as Record<string, unknown> | null;

  // La divulgation de policy se juge sur la charge fournisseur entière, pas sur un champ deviné.
  const serialized = JSON.stringify(provider).toLowerCase();
  const disclosesPolicy =
    serialized.includes("allowance") ||
    serialized.includes("spendinglimit") ||
    serialized.includes("policy");

  return {
    declaredStatus: typeof status?.status === "string" ? status.status : null,
    declaredGasUsed: rawAmount(firstReceipt?.gasUsed),
    declaredChainId:
      typeof firstReceipt?.chainId === "number" ? (firstReceipt.chainId as number) : null,
    simulationWouldRevert:
      typeof simulation?.wouldRevert === "boolean" ? (simulation.wouldRevert as boolean) : null,
    simulationFrom: lowerAddress(simulation?.simulatedFrom ?? simulation?.from),
    simulationTo: lowerAddress(simulation?.simulatedTo ?? simulation?.to),
    sponsoredRoot: typeof status?.sponsored === "boolean" ? (status.sponsored as boolean) : null,
    sponsoredNested:
      typeof executedCall?.sponsored === "boolean" ? (executedCall.sponsored as boolean) : null,
    disclosesPolicy,
  };
}

export function normalizeEvidence(fixture: EvidenceFixture): NormalizedEvidence {
  const events = Array.isArray(fixture.decoded?.events) ? fixture.decoded.events : [];
  const receipt = fixture.rpc?.receipt ?? null;
  const transaction = fixture.rpc?.transaction ?? null;
  const code = fixture.rpc?.code ?? null;

  const transferEvent = eventByName(events, "Transfer");
  const moduleSuccess = eventByName(events, "ExecutionFromModuleSuccess");
  const safeModuleTx = eventByName(events, "SafeModuleTransaction");
  const consume = eventByName(events, "ConsumeAllowance");

  const ethCall = fixture.rpc?.ethCall ?? null;
  const ethCallResponse = (ethCall?.response ?? null) as Record<string, unknown> | null;
  const ethCallErrored = ethCallResponse ? Boolean(ethCallResponse.error) : null;

  const probes: BoundaryProbe[] = Array.isArray(fixture.decoded?.boundaryProbes)
    ? fixture.decoded.boundaryProbes
    : [];

  return {
    scenarioId: fixture.scenarioId,
    chainId:
      hexToNumber(receipt?.chainId) ??
      (typeof fixture.chainId === "number" ? fixture.chainId : null),
    blockNumber: hexToNumber(receipt?.blockNumber),
    receiptStatusOk: receipt ? receipt.status === "0x1" : null,
    gasUsed: hexToDecimalString(receipt?.gasUsed),
    entrypoint: lowerAddress(transaction?.to),
    transferFrom: lowerAddress(arg(transferEvent, "from")),
    transferTo: lowerAddress(arg(transferEvent, "to")),
    transferValueRaw: rawAmount(arg(transferEvent, "value")),
    transferEmitter: transferEvent ? lowerAddress(transferEvent.emitter) : null,
    moduleExecutionModule: lowerAddress(arg(moduleSuccess, "module")),
    safeModuleTarget: lowerAddress(arg(safeModuleTx, "to")),
    safeModuleEmitter: safeModuleTx ? lowerAddress(safeModuleTx.emitter) : null,
    allowanceKey:
      typeof arg(consume, "allowanceKey") === "string"
        ? (arg(consume, "allowanceKey") as string).toLowerCase()
        : null,
    allowanceConsumedRaw: rawAmount(arg(consume, "consumed")),
    allowanceRemainingRaw: rawAmount(arg(consume, "newBalance")),
    hasContractCode: code
      ? {
          safe: hasCode(code.safe),
          rolesModifier: hasCode(code.rolesModifier),
          delegateEoa: hasCode(code.delegateEoa),
        }
      : null,
    envelopeReencodeMatches: fixture.decoded?.envelope?.reencodedMatchesOnChainInput ?? null,
    broadcastPresent: Boolean(receipt) || Boolean(transaction),
    ethCallReverted: ethCallErrored,
    revert: fixture.decoded?.revert ?? null,
    boundaryProbes: probes,
    provider: normalizeProvider(fixture),
  };
}
