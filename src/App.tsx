import { useCallback, useEffect, useRef, useState } from "react";

import { BrandMark } from "./components/Brand";
import { EvidenceDrawer } from "./components/EvidenceDrawer";
import { ProofPath } from "./components/ProofPath";
import {
  FIXTURES,
  loadAllScenarios,
  type ScenarioId,
  type ScenarioView,
  shortHex,
  verifyAttestation,
} from "./engine";

const VERIFY_STEPS = [
  "Canonicalizing evidence",
  "Recomputing SHA-256",
  "Comparing fixture digest",
  "Proof verified",
];

type VerifyState = { step: number; done: boolean; ok: boolean | null; at: string | null };

const IDLE: VerifyState = { step: 0, done: false, ok: null, at: null };

const PRIMARY_TX_URL =
  "https://sepolia.etherscan.io/tx/0xe7e67b3ab83e1af1f5d130d3c33dbe945cf015da8fb082020b24c253a8eb5062";
const AGENT_CODE_URL = "https://github.com/Damso74/keeper-agent";
const EVIDENCE_URL = "https://github.com/Damso74/keeper-agent/blob/main/EVIDENCE.md";

export function App() {
  const [scenarios, setScenarios] = useState<ScenarioView[] | null>(null);
  const [activeId, setActiveId] = useState<ScenarioId>("approved-with-warnings");
  const [revealed, setRevealed] = useState(0);
  const [verify, setVerify] = useState<VerifyState>(IDLE);
  const [drawer, setDrawer] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    void loadAllScenarios().then(setScenarios);
  }, []);

  const view = scenarios?.find((entry) => entry.id === activeId) ?? null;

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  /** Révèle les nœuds un à un. N'invente aucun état : il déroule `view.path`. */
  const replay = useCallback(
    (nodeCount: number) => {
      clearTimers();
      setRevealed(0);
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setRevealed(nodeCount);
        return;
      }
      for (let index = 1; index <= nodeCount; index += 1) {
        timers.current.push(
          window.setTimeout(() => setRevealed(index), index * 210),
        );
      }
    },
    [clearTimers],
  );

  useEffect(() => {
    if (!view) return;
    replay(view.path.length);
    setVerify(IDLE);
    return clearTimers;
  }, [view, replay, clearTimers]);

  async function runVerify() {
    if (!view) return;
    setVerify({ step: 1, done: false, ok: null, at: null });
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    setVerify((state) => ({ ...state, step: 2 }));

    const outcome = await verifyAttestation(FIXTURES[view.id], view.attestation);
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    setVerify((state) => ({ ...state, step: 3 }));
    await new Promise((resolve) => window.setTimeout(resolve, 180));

    setVerify({
      step: 4,
      done: true,
      ok: outcome.ok,
      at: new Date().toLocaleTimeString(),
    });
  }

  if (!view) {
    return (
      <div className="shell">
        <p className="mono" style={{ color: "var(--dim)" }}>
          Loading captured evidence…
        </p>
      </div>
    );
  }

  const tone = view.executed ? "ok" : "stop";
  const { fixture, attestation, policy } = view;

  return (
    <div className="shell">
      <header className="hdr">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">ProofGate</div>
            <div className="brand-sub">Evidence console for Treasury Drip Agent</div>
          </div>
        </div>
        <span className="chip">
          <span className="dot" />
          Sepolia
        </span>
        <span className="spacer" />
        <span className="header-context">KeeperHub · Safe · USDC</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-mark" />
              Treasury Drip Agent · primary hackathon run
            </div>
            <h1 id="hero-title">
              An onchain agent that can <span>prove what it did.</span>
            </h1>
            <p className="hero-lede">
              The operator initiated the run. The agent independently observed chain state,
              decided, executed exactly once through KeeperHub, and verified the outcome through
              independent RPC evidence.
            </p>
            <div className="hero-actions">
              <a
                className="btn btn-primary btn-large"
                href={PRIMARY_TX_URL}
                target="_blank"
                rel="noreferrer"
              >
                View 0.1 USDC onchain <span aria-hidden="true">↗</span>
              </a>
              <a
                className="btn btn-large"
                href={AGENT_CODE_URL}
                target="_blank"
                rel="noreferrer"
              >
                Explore agent code <span aria-hidden="true">↗</span>
              </a>
              <a
                className="btn btn-ghost btn-large"
                href={EVIDENCE_URL}
                target="_blank"
                rel="noreferrer"
              >
                Read evidence
              </a>
            </div>
          </div>

          <aside className="run-card" data-testid="primary-run" aria-label="Primary run proof">
            <div className="run-card-head">
              <span className="run-label">Primary execution</span>
              <span className="run-status"><span /> Onchain success</span>
            </div>
            <div className="run-amount">
              <strong>0.1</strong>
              <span>USDC</span>
            </div>
            <div className="run-metrics">
              <div>
                <strong>1</strong>
                <span>KeeperHub execute</span>
              </div>
              <div>
                <strong>0</strong>
                <span>Retries</span>
              </div>
              <div>
                <strong>RPC</strong>
                <span>Independent verification</span>
              </div>
            </div>
            <div className="run-route" aria-label="Execution route">
              <span>KeeperHub</span><i>→</i><span>Roles</span><i>→</i><span>Safe</span><i>→</i><span>USDC</span>
            </div>
            <div className="run-id">
              <span>execution</span>
              <code>no623hdfsrun2vzv3b25r</code>
            </div>
          </aside>
        </section>

        <section className="console-intro" aria-labelledby="console-title">
          <div>
            <p className="console-kicker">Evidence console · separate reliability incident</p>
            <h2 id="console-title">ProofGate captured replay</h2>
            <p className="console-note" data-testid="console-note">
              The console below replays a separate 1 USDC run captured on 2026-08-04. It makes no
              live RPC call; <strong>Verify proof</strong> recomputes the captured evidence digest
              locally in your browser.
            </p>
          </div>
          <div className="console-actions">
            <button type="button" className="btn btn-primary" onClick={() => void runVerify()}>
              Verify proof
            </button>
            <button type="button" className="btn" onClick={() => replay(view.path.length)}>
              Replay
            </button>
            {view.explorerTxUrl ? (
              <a
                className="btn"
                data-testid="replay-tx-link"
                href={view.explorerTxUrl}
                target="_blank"
                rel="noreferrer"
              >
                View replay on Etherscan <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => setDrawer(true)}>
              Raw evidence
            </button>
          </div>
        </section>

        <div className="scen" role="tablist" aria-label="Scenario">
        {scenarios!.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className="scen-btn"
            data-tone={entry.executed ? "ok" : "stop"}
            aria-selected={entry.id === activeId}
            onClick={() => setActiveId(entry.id)}
          >
            <span className="k">{entry.executed ? "Authorized" : "Blocked"}</span>
            <span className="v">
              {entry.fixture.intent.amountDisplay} {entry.fixture.token.symbol} ·{" "}
              {entry.executed ? "executed" : "counterfactual replay"}
            </span>
          </button>
        ))}
        </div>

        <div className="grid">
        <div className="col">
          <section className="panel g-mission">
            <p className="panel-title">Mission</p>
            <div className="mission">
              <div>
                <div className="k">Agent intent</div>
                <div className="v">Transfer</div>
              </div>
              <div>
                <div className="k">Amount</div>
                <div className="v">
                  {fixture.intent.amountDisplay} {fixture.token.symbol}
                </div>
              </div>
              <div>
                <div className="k">Recipient</div>
                <div className="v">{shortHex(fixture.intent.recipient, 8, 6)}</div>
              </div>
              <div>
                <div className="k">Network</div>
                <div className="v">Sepolia</div>
              </div>
              <div>
                <div className="k">Block</div>
                <div className="v">{fixture.referenceBlock.number}</div>
              </div>
              <div>
                <div className="k">Status</div>
                <div className="v">{view.executed ? "Captured" : "Replayed"}</div>
              </div>
            </div>
          </section>

          <section className="panel g-path">
            <p className="panel-title">Execution path</p>
            <ProofPath nodes={view.path} revealed={revealed} />
            <p className="path-note" data-testid="path-note">
              {view.executed ? (
                <>
                  <strong>Executed on-chain</strong> — provider simulation was wrong.
                </>
              ) : (
                <>
                  <strong>Blocked before broadcast</strong> — allowance exceeded. Proven through a
                  historical <code>eth_call</code> replay. No transaction was broadcast.
                </>
              )}
            </p>
          </section>

          <section className="panel g-claims">
            <p className="panel-title">
              {view.claims.leftTitle} vs {view.claims.rightTitle}
            </p>
            <table className="cmp">
              <thead>
                <tr>
                  <th style={{ width: "44%" }}>{view.claims.leftTitle}</th>
                  <th>{view.claims.rightTitle}</th>
                </tr>
              </thead>
              <tbody>
                {view.claims.rows.map((row) => (
                  <tr key={row.claim}>
                    <td className="claim">{row.claim}</td>
                    <td className="reality">{row.reality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="col">
          <section className="verdict g-verdict" data-tone={tone} data-testid="verdict">
            <h2 data-testid="verdict-headline">{view.headline.toUpperCase()}</h2>
            <div className="sub" data-testid="verdict-subline">
              {view.subline}
            </div>
            <div className="enum">
              {attestation.verdict} · release {attestation.releaseDecision} · policy{" "}
              {attestation.policyDecision}
            </div>

            <dl className="kv">
              {view.executed ? (
                <>
                  <dt>Provider prediction</dt>
                  <dd className="warn">Predicted failure</dd>
                  <dt>On-chain reality</dt>
                  <dd className="ok">Transaction succeeded</dd>
                  <dt>Policy</dt>
                  <dd>{policy.consumedDisplay ?? "—"} of {policy.capDisplay} consumed</dd>
                  <dt>Remaining</dt>
                  <dd>{policy.remainingDisplay ?? "—"}</dd>
                  <dt>Main warning</dt>
                  <dd className="warn">Simulation false negative</dd>
                </>
              ) : (
                <>
                  <dt>Requested</dt>
                  <dd className="stop">
                    {fixture.intent.amountDisplay} {fixture.token.symbol}
                  </dd>
                  <dt>Available</dt>
                  <dd>{policy.remainingDisplay ?? "—"}</dd>
                  <dt>Transaction hash</dt>
                  <dd>None — expected</dd>
                  <dt>Proof</dt>
                  <dd>Historical eth_call</dd>
                  <dt>Revert</dt>
                  <dd className="stop">{fixture.decoded.revert?.statusName ?? "—"}</dd>
                  <dt>Block</dt>
                  <dd>{fixture.referenceBlock.number}</dd>
                </>
              )}
              <dt>Digest</dt>
              <dd data-testid="digest-short">{shortHex(attestation.attestationHash, 10, 8)}</dd>
            </dl>
          </section>

          <section className="panel g-verify">
            <p className="panel-title">Proof verification</p>
            <ol className="verify-steps" data-testid="verify-steps">
              {VERIFY_STEPS.map((label, index) => {
                const isLast = index === VERIFY_STEPS.length - 1;
                const failed = isLast && verify.done && verify.ok === false;
                return (
                  <li
                    key={label}
                    data-done={verify.step > index && !failed ? "1" : "0"}
                    data-fail={failed ? "1" : "0"}
                  >
                    {failed ? "Proof verification FAILED" : label}
                  </li>
                );
              })}
            </ol>

            {verify.done ? (
              <>
                <div className="digest" data-testid="digest-full">
                  {attestation.attestationHash}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void navigator.clipboard?.writeText(attestation.attestationHash)}
                  >
                    Copy digest
                  </button>
                  <span
                    className="chip"
                    data-testid="verify-status"
                    style={{ color: verify.ok ? "var(--ok)" : "var(--stop)" }}
                  >
                    {verify.ok ? "Verified locally in your browser" : "Verification failed"}
                  </span>
                </div>
                <div className="digest" data-testid="verify-scope">
                  Integrity of the captured evidence verified locally. No live RPC call.
                </div>
                <div className="digest">Local verification time {verify.at} (not on-chain data)</div>
              </>
            ) : (
              <p style={{ color: "var(--dim)", fontSize: 12, margin: "8px 0 0" }}>
                Recomputes the captured evidence digest with Web Crypto, in this browser. No live
                RPC call.
              </p>
            )}
          </section>

          <section className="panel g-reasons">
            <p className="panel-title">Reason codes</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {attestation.reasonCodes.map((code) => (
                <span className="badge" key={code}>
                  {code}
                </span>
              ))}
            </div>
          </section>
        </div>
        </div>
      </main>

      <footer className="foot">
        <span>Built for KeeperHub · Verification engine by ArcadeOps</span>
        <span>Evidence captured at block {fixture.referenceBlock.number}</span>
        <span>Replay works fully offline</span>
      </footer>

      {drawer ? <EvidenceDrawer view={view} onClose={() => setDrawer(false)} /> : null}
    </div>
  );
}
