import { useState } from "react";

import type { ScenarioView } from "../engine";

type Tab = "evidence" | "checks" | "raw";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <span style={{ color: "var(--dim)", fontSize: 12, minWidth: 150 }}>{k}</span>
      <code style={{ overflowWrap: "anywhere" }}>{v}</code>
    </div>
  );
}

export function EvidenceDrawer({ view, onClose }: { view: ScenarioView; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("evidence");
  const { fixture, attestation } = view;
  const revert = fixture.decoded.revert;

  return (
    <aside className="drawer" role="dialog" aria-label="Raw evidence" data-testid="drawer">
      <div className="drawer-hd">
        {(
          [
            ["evidence", "Evidence"],
            ["checks", "Checks"],
            ["raw", "Raw data"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="tab"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="drawer-bd">
        {tab === "evidence" ? (
          <div>
            <Row k="Network" v={`Ethereum Sepolia · chainId ${fixture.chainId}`} />
            <Row k="Reference block" v={`${fixture.referenceBlock.number} (${fixture.referenceBlock.tag})`} />
            <Row k="Safe" v={fixture.addresses.safe} />
            <Row k="Roles Modifier" v={fixture.addresses.rolesModifier} />
            <Row k="Delegate EOA" v={fixture.addresses.delegateEoa} />
            <Row k="Token" v={`${fixture.token.symbol} ${fixture.token.address}`} />
            <Row k="Envelope" v={fixture.decoded.envelope.functionSignature} />
            <Row k="Selector" v={fixture.decoded.envelope.selector} />

            {view.executed ? (
              <>
                <Row k="Transaction" v={view.txHash ?? "—"} />
                <h4 style={{ margin: "16px 0 6px", fontSize: 12, color: "var(--dim)" }}>
                  DECODED EVENTS
                </h4>
                {fixture.decoded.events.map((event) => (
                  <Row
                    key={event.logIndex}
                    k={event.decoded?.eventName ?? `log ${event.logIndex}`}
                    v={`${event.emitter} · ${JSON.stringify(event.decoded?.args ?? {})}`}
                  />
                ))}
              </>
            ) : (
              <>
                <Row k="Transaction" v="None — no broadcast attempted" />
                <h4 style={{ margin: "16px 0 6px", fontSize: 12, color: "var(--dim)" }}>
                  HISTORICAL eth_call
                </h4>
                <Row k="from" v={String(fixture.rpc.ethCall?.request.from ?? "—")} />
                <Row k="to" v={String(fixture.rpc.ethCall?.request.to ?? "—")} />
                <Row k="block tag" v={fixture.rpc.ethCall?.blockTag ?? "—"} />
                <Row k="revert" v={revert ? `${revert.errorSignature} · status ${revert.statusIndex} = ${revert.statusName}` : "—"} />
                <Row k="allowance key" v={revert?.info ?? "—"} />
                <Row k="enum provenance" v={revert?.statusEnumProvenance ?? "—"} />
                <h4 style={{ margin: "16px 0 6px", fontSize: 12, color: "var(--dim)" }}>
                  BOUNDARY PROBES
                </h4>
                {(fixture.decoded.boundaryProbes ?? []).map((probe) => (
                  <Row
                    key={probe.amountRaw}
                    k={`${probe.amountDisplay} ${fixture.token.symbol}`}
                    v={probe.reverted ? "reverted" : "accepted"}
                  />
                ))}
              </>
            )}

            <h4 style={{ margin: "16px 0 6px", fontSize: 12, color: "var(--dim)" }}>PROVENANCE</h4>
            {fixture.provenance.map((entry, index) => (
              <Row key={index} k={String(entry.field)} v={`${entry.source} · ${entry.method}`} />
            ))}

            {view.explorerTxUrl ? (
              <p style={{ marginTop: 14 }}>
                <a href={view.explorerTxUrl} target="_blank" rel="noreferrer">
                  Open transaction on Etherscan
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "checks" ? (
          <div data-testid="checks-list">
            {attestation.checks.map((check) => (
              <div className="check" key={check.id}>
                <span className="badge" data-s={check.status}>
                  {check.status}
                </span>
                <div className="body">
                  <div className="id">
                    {check.id}
                    {check.reasonCode ? ` · ${check.reasonCode}` : ""}
                  </div>
                  <div className="lbl">{check.label}</div>
                  {check.observed ? <div className="obs">observed: {check.observed}</div> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "raw" ? (
          <pre className="raw">
            {JSON.stringify(
              {
                intent: fixture.intent,
                addresses: fixture.addresses,
                referenceBlock: fixture.referenceBlock,
                decoded: fixture.decoded,
                rpcReceipt: fixture.rpc.receipt,
                rpcEthCall: fixture.rpc.ethCall,
                provider: fixture.provider,
                evidenceDigest: fixture.evidenceDigest,
              },
              null,
              2,
            )}
          </pre>
        ) : null}
      </div>
    </aside>
  );
}
