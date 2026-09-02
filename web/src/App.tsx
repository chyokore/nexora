import { FormEvent, useMemo, useState } from "react";
import { evaluateDecision } from "./api";
import type { EvaluationResponse, ProposedAction } from "./contracts";
import { scenarioById, scenarios, type ScenarioId } from "./scenarios";

const readable = (value: string) => value.toLowerCase().split("_").join(" ").replace(/(^|:)([a-z])/g, (_: string, edge: string, letter: string) => `${edge}${letter.toUpperCase()}`);
const percent = (value?: number) => value === undefined ? "Not supplied" : `${Math.round(value * 100)}%`;

export default function App() {
  const [condition, setCondition] = useState<ScenarioId>("supported");
  const scenario = useMemo(() => scenarioById(condition), [condition]);
  const [fields, setFields] = useState({ id: "supplier-payment-001", description: "Authorize payment to updated supplier destination", reference: "supplier-northstar-042", supplierUrl: "https://example.com/", transactionHash: "" });
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showReplay, setShowReplay] = useState(false);

  function chooseScenario(id: ScenarioId) {
    setCondition(id); setResult(null); setShowReplay(false); setError("");
    const selected = scenarioById(id);
    setFields((current) => ({ ...current, transactionHash: selected.transactionHash ?? "" }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null); setShowReplay(false);
    const proposedAction: ProposedAction = { id: fields.id, type: "SUPPLIER_PAYMENT_AUTHORIZATION", description: fields.description, subject: { kind: "SUPPLIER_PAYMENT", reference: fields.reference, ...(fields.supplierUrl ? { supplierUrl: fields.supplierUrl } : {}), ...(fields.transactionHash ? { transactionHash: fields.transactionHash } : {}) }, riskClass: "HIGH" };
    try { setResult(await evaluateDecision(proposedAction, scenario.evidence)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The Product API could not be reached"); }
    finally { setLoading(false); }
  }

  const decision = result?.decisionPacket.actionDecision;
  const replay = result?.decisionReplay;
  return <main>
    <header className="topbar"><a className="brand" href="#top" aria-label="Nexora home"><span className="brand-mark">N</span>NEXORA</a><span className="system-state"><i /> DETERMINISTIC CORE · OFFLINE DEMO</span></header>
    <section className="hero" id="top">
      <div><p className="eyebrow">DECISION INFRASTRUCTURE</p><h1>The Decision Layer<br />for <em>Autonomous Agents.</em></h1><p className="lede">Intelligence tells agents what is happening.<br />Nexora decides what they should do next.</p><div className="hero-actions"><a href="#evaluate">Evaluate an Action</a><a href="#evaluate">Explore Decision Replay</a></div></div>
      <div><div className="flow" aria-label="How Nexora works"><span>PROPOSE</span><b>→</b><span>REQUEST INTELLIGENCE</span><b>→</b><span>ASSESS EVIDENCE</span><b>→</b><span>APPLY POLICY</span><b>→</b><span>ALLOW / REVIEW / BLOCK</span><b>→</b><span>REPLAY</span></div><p className="fixture-note">This phase uses clearly labeled, sanitized fixture evidence.</p></div>
    </section>
    <section className="workspace" id="evaluate">
      <div className="section-heading"><div><p className="eyebrow">01 · PROPOSED ACTION</p><h2>Evaluate a supplier payment</h2></div><p>Nexora evaluates this proposal. It does not execute a payment.</p></div>
      <form onSubmit={submit}>
        <div className="action-grid">
          <label>Action ID<input required value={fields.id} onChange={(e) => setFields({ ...fields, id: e.target.value })} /></label>
          <label className="wide">Description<input required value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} /></label>
          <label>Supplier reference<input required value={fields.reference} onChange={(e) => setFields({ ...fields, reference: e.target.value })} /></label>
          <label>Supplier URL<input type="url" value={fields.supplierUrl} onChange={(e) => setFields({ ...fields, supplierUrl: e.target.value })} /></label>
          <label>Transaction reference <small>Optional</small><input value={fields.transactionHash} onChange={(e) => setFields({ ...fields, transactionHash: e.target.value })} placeholder="No transaction exists yet" /></label>
          <label>Risk class<input value="HIGH" readOnly /></label>
        </div>
        <div className="conditions-head"><div><p className="eyebrow">02 · EVIDENCE CONTEXT</p><h2>Choose an evidence condition</h2></div><p>Fixture-backed conditions for a deterministic judge demo.</p></div>
        <div className="condition-grid" role="radiogroup" aria-label="Evidence conditions">
          {scenarios.map(({ id, name, description, provenance }, index) => <button type="button" role="radio" aria-checked={condition === id} className={condition === id ? "condition active" : "condition"} onClick={() => chooseScenario(id)} key={id}><span className="condition-index">0{index + 1}</span><strong>{name}</strong><span>{description}</span><small>{provenance}</small></button>)}
        </div>
        <button className="evaluate" type="submit" disabled={loading}><span>{loading ? "Evaluating with Product API…" : "Evaluate decision"}</span><b>→</b></button>
      </form>
      <div className="status-region" aria-live="polite">{error && <div className="api-error"><strong>Product API unavailable</strong><span>{error}</span><small>No browser-side fallback was used.</small></div>}</div>
      {decision && replay && <section className={`decision-result ${decision.decision.toLowerCase()}`} aria-labelledby="decision-title">
        <div className="decision-banner"><div><p className="eyebrow">03 · DETERMINISTIC DECISION · {scenario.provenance}</p><h2 id="decision-title">{decision.decision}</h2><p>{decision.reasons.map(readable).join(" · ")}</p></div><div className="decision-stats"><span><b>{decision.satisfiedRequirements.length}</b> satisfied</span><span><b>{decision.unsatisfiedRequirements.length}</b> unresolved</span><span><b>{decision.blockingEvidence.length}</b> blocking</span></div></div>
        <div className="evidence-list">
          {result.decisionPacket.evidenceAssessments.map((item) => <article className="evidence-card" key={item.intent}>
            <div className="evidence-title"><span>{readable(item.intent)}</span><b className={`quality q-${item.quality.toLowerCase()}`}>{item.quality}</b></div>
            <dl><div><dt>Provider confidence</dt><dd>{percent(item.providerConfidence)}</dd></div><div><dt>Nexora quality</dt><dd>{item.quality}</dd></div><div><dt>Coverage</dt><dd>{readable(item.coverage)}</dd></div><div><dt>Independent verification</dt><dd>{readable(item.verification)}</dd></div><div><dt>Uncertainties</dt><dd>{item.uncertainties.length}</dd></div><div><dt>Contradictions / missing</dt><dd>{item.contradictions.length} / {item.missingEvidence.length}</dd></div>{item.providerFacts?.transactionStatus && <div><dt>Provider result</dt><dd>{String(item.providerFacts.transactionStatus)}</dd></div>}</dl>
            <p className="evidence-reason">{item.reasons[0]}</p>
            {item.coverage === "OUT_OF_COVERAGE" && <p className="explanation">Confidence 0 does not mean the supplier is safe. The provider could not establish sufficient evidence, so Nexora preserves the uncertainty instead of treating absence as approval.</p>}
            {(item.quality === "CONTRADICTED" || item.verification === "CONTRADICTED") && <p className="explanation">High provider confidence does not override independently conflicting evidence. Nexora preserves the conflict and routes the action to review.</p>}
            <small>{item.findings.length ? item.findings.map(readable).join(" · ") : "No qualifying policy finding"}</small>
          </article>)}
        </div>
        <button className="replay-trigger" type="button" aria-expanded={showReplay} onClick={() => setShowReplay(!showReplay)}><span>{showReplay ? "Hide Decision Replay" : "View Decision Replay"}</span><b>{replay.validation.status} ↗</b></button>
        {showReplay && <div className="replay" id="decision-replay">
          <div className="replay-head"><div><p className="eyebrow">04 · DECISION REPLAY</p><h3>{replay.validation.matches ? "Same inputs. Same policy. Same decision." : "Recorded decision does not match deterministic replay."}</h3></div><span className={replay.validation.matches ? "match" : "mismatch"}>{replay.validation.matches ? "✓ MATCH" : "× MISMATCH"}</span></div>
          <div className="replay-meta"><div><small>Decision ID</small><code>{replay.decisionId}</code></div><div><small>Packet fingerprint</small><code>{replay.fingerprint}</code><button type="button" onClick={() => navigator.clipboard?.writeText(replay.fingerprint)}>Copy</button></div><div><small>Recorded / recomputed</small><code>{replay.validation.recordedDecision} / {replay.validation.recomputedDecision}</code></div><div><small>Post-decision outcome</small><code>{replay.postDecisionOutcome}</code></div></div>
          <ol className="timeline">{replay.timeline.map((item) => <li key={item.order}><span>{String(item.order).padStart(2, "0")}</span><div><strong>{item.title}</strong><p>{item.summary}</p></div></li>)}</ol>
        </div>}
      </section>}
    </section>
    <footer><span>Built with Telegraph Protocol intelligence boundaries.</span><span>Nexora applies the independent decision layer.</span></footer>
  </main>;
}
