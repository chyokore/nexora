import { useEffect, useState } from "react";
import { fetchDiscovery, runInvestigation, runLiveDecision } from "./api";
import type { DecisionMode, DiscoveryResponse, InvestigationRunResult, LiveDecisionRunResult, ProposedAction } from "./contracts";

const readable = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/(^|:)([a-z])/g, (_: string, edge: string, letter: string) => `${edge}${letter.toUpperCase()}`);

const formatDecisionExplanation = (
  decision: string,
  reasons: readonly string[],
  unresolvedConditions?: Array<{ description: string }>
): string => {
  if (unresolvedConditions && unresolvedConditions.length > 0) {
    const details = unresolvedConditions.map((c) => c.description).join("; ");
    return `${readable(decision)} required: ${details}.`;
  }
  if (decision === "ALLOW") {
    return "Authorization approved: all mandatory evidence requirements satisfied.";
  }
  if (decision === "REVIEW") {
    return "Review required: one or more required evidence items are missing or below required quality.";
  }
  if (decision === "BLOCK") {
    return "Authorization blocked: verified adverse evidence or explicit policy violation detected.";
  }
  return reasons.map(readable).join(" · ");
};

export default function App() {
  const [fields, setFields] = useState({
    id: "supplier-payment-001",
    description: "Authorize payment to updated supplier destination",
    reference: "supplier-northstar-042",
    supplierUrl: "https://example.com/",
    transactionHash: "",
  });

  // Live Discovery State
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");

  // Live Decision State (Authorize Action Mode)
  const [liveResult, setLiveResult] = useState<LiveDecisionRunResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [showLiveReplay, setShowLiveReplay] = useState(false);

  // Investigation State (Investigate Mode)
  const [activeMode, setActiveMode] = useState<DecisionMode>("INVESTIGATE");
  const [invQuestion, setInvQuestion] = useState("");
  const [invClaim, setInvClaim] = useState("");
  const [invUrl, setInvUrl] = useState("");
  const [invTxHash, setInvTxHash] = useState("");
  const [invResult, setInvResult] = useState<InvestigationRunResult | null>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [showInvReplay, setShowInvReplay] = useState(false);

  async function loadDiscovery() {
    setDiscoveryLoading(true);
    setDiscoveryError("");
    try {
      const data = await fetchDiscovery();
      setDiscovery(data);
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : "Live discovery temporarily unavailable");
    } finally {
      setDiscoveryLoading(false);
    }
  }

  async function submitLiveDecision() {
    setLiveLoading(true);
    setLiveError("");
    setLiveResult(null);
    setShowLiveReplay(false);
    const action: ProposedAction = {
      id: fields.id,
      type: "SUPPLIER_PAYMENT_AUTHORIZATION",
      description: fields.description,
      subject: {
        kind: "SUPPLIER_PAYMENT",
        reference: fields.reference,
        ...(fields.supplierUrl ? { supplierUrl: fields.supplierUrl } : {}),
        ...(fields.transactionHash ? { transactionHash: fields.transactionHash } : {}),
      },
      riskClass: "HIGH",
    };
    try {
      const data = await runLiveDecision(action);
      setLiveResult(data);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Live decision temporarily unavailable");
    } finally {
      setLiveLoading(false);
    }
  }

  async function submitInvestigation() {
    if (!invQuestion.trim()) return;
    setInvLoading(true);
    setInvError("");
    setInvResult(null);
    setShowInvReplay(false);
    try {
      const sources: Array<{ type: "TEXT" | "URL" | "ONCHAIN_REFERENCE"; value: string }> = [];
      if (invClaim.trim()) sources.push({ type: "TEXT", value: invClaim.trim() });
      if (invUrl.trim()) sources.push({ type: "URL", value: invUrl.trim() });
      if (invTxHash.trim()) sources.push({ type: "ONCHAIN_REFERENCE", value: invTxHash.trim() });
      const data = await runInvestigation({
        mode: "INVESTIGATE",
        question: invQuestion.trim(),
        ...(sources.length > 0 ? { sources } : {}),
      });
      setInvResult(data);
    } catch (err) {
      setInvError(err instanceof Error ? err.message : "Investigation temporarily unavailable");
    } finally {
      setInvLoading(false);
    }
  }

  function loadExample(ex: "url-safety" | "onchain" | "fraud") {
    setInvResult(null);
    setInvError("");
    setShowInvReplay(false);
    if (ex === "url-safety") {
      setInvQuestion("Is this supplier URL safe to proceed with?");
      setInvClaim("");
      setInvUrl("https://example.com/");
      setInvTxHash("");
    } else if (ex === "onchain") {
      setInvQuestion("Does this transaction exist on Base Sepolia?");
      setInvClaim("");
      setInvUrl("");
      setInvTxHash("0xcd9a...");
    } else {
      setInvQuestion("Are there fraud or risk indicators associated with this payment request?");
      setInvClaim("Supplier requested urgent bank details change over email");
      setInvUrl("");
      setInvTxHash("");
    }
  }

  function loadAuthorizeExample() {
    setActiveMode("AUTHORIZE_ACTION");
    setLiveResult(null);
    setLiveError("");
    setFields({
      id: "supplier-payment-001",
      description: "Authorize payment to updated supplier destination",
      reference: "supplier-northstar-042",
      supplierUrl: "https://example.com/",
      transactionHash: "",
    });
  }

  function loadContradictionScenario() {
    setActiveMode("AUTHORIZE_ACTION");
    setLiveResult(null);
    setLiveError("");
    setFields({
      id: "supplier-payment-001",
      description: "Authorize payment to updated supplier destination",
      reference: "supplier-northstar-042",
      supplierUrl: "https://example.com/",
      transactionHash: "0xcd9a...",
    });
    const el = document.getElementById("workspace");
    el?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    loadDiscovery();
  }, []);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Nexora home">
          <span className="brand-mark">N</span>
          <span>NEXORA</span>
        </a>
        <nav className="top-nav" aria-label="Quick links">
          <a href="#architecture">Architecture</a>
          <a href="#workspace">Decision Workspace</a>
          <a href="#sample-decisions">What We Decide</a>
          <a href="#why-nexora">Why Nexora</a>
          <a href="#faq">FAQ</a>
        </nav>
        <span className="system-state">
          <i /> DETERMINISTIC · LIVE TELEGRAPH
        </span>
      </header>

      {/* Hero Section */}
      <section className="hero" id="top">
        <div className="hero-main">
          <p className="eyebrow">DECISION CONTROL LAYER FOR AUTONOMOUS AGENTS</p>
          <h1>
            Verify Intelligence.<br /><em>Bound Action.</em>
          </h1>
          <p className="lede">
            <strong>Bring Nexora a question, claim, link, or onchain reference.</strong>
            <br />
            <strong>Nexora determines what must be verified, obtains relevant intelligence through Telegraph, evaluates evidence quality and disagreement, then returns a bounded conclusion with a complete decision trace.</strong>
          </p>
          <div className="value-pillars">
            <div className="pillar">
              <span className="pillar-num">01</span>
              <strong>Real Intelligence</strong>
              <p>Telegraph miners supply specialized evidence without platform favoritism.</p>
            </div>
            <div className="pillar">
              <span className="pillar-num">02</span>
              <strong>Zero Blind Trust</strong>
              <p>High confidence is not truth; missing evidence is never assumed safe.</p>
            </div>
            <div className="pillar">
              <span className="pillar-num">03</span>
              <strong>Deterministic Trace</strong>
              <p>Emits ALLOW, REVIEW, or BLOCK with verifiable SHA-256 decision audit.</p>
            </div>
          </div>
          <div className="hero-actions">
            <a href="#workspace" className="btn-primary">Try Decision Workspace</a>
            <a href="#contradiction" className="btn-secondary">The Contradiction Case</a>
          </div>
        </div>
        <div className="hero-side">
          <div className="quick-verdict-box">
            <span className="box-tag">CORE PRINCIPLE</span>
            <h3>Separation of Intelligence from Policy</h3>
            <p>
              Autonomous agents taking irreversible on-chain actions cannot rely on LLM hallucinations or unverified confidence scores. Nexora bounds actions through strict, deterministic policy.
            </p>
            <div className="verdict-badges">
              <span className="badge allow">ALLOW</span>
              <span className="badge review">REVIEW</span>
              <span className="badge block">BLOCK</span>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Interactive Product Workspace */}
      <section className="live-decision-section" id="workspace">
        <div className="section-head">
          <div>
            <p className="eyebrow">DECISION WORKSPACE</p>
            <h2>INVESTIGATE WITH NEXORA</h2>
          </div>
          <p>
            Ask a question and provide the evidence or context you want Nexora to verify.
          </p>
        </div>
        <p className="workspace-sub-explanation">
          Use Investigate to examine a claim or reference. Use Authorize Action when an autonomous agent needs evidence before proceeding.
        </p>

        {/* Mode Selector Tabs */}
        <div className="workspace-mode-tabs" role="tablist" aria-label="Decision mode">
          <button
            role="tab"
            aria-selected={activeMode === "INVESTIGATE"}
            className={`mode-tab${activeMode === "INVESTIGATE" ? " active" : ""}`}
            type="button"
            onClick={() => { setActiveMode("INVESTIGATE"); setInvResult(null); setInvError(""); }}
          >
            <span className="mode-tab-label">INVESTIGATE</span>
            <small>Claims · URLs · Onchain references</small>
          </button>
          <button
            role="tab"
            aria-selected={activeMode === "AUTHORIZE_ACTION"}
            className={`mode-tab${activeMode === "AUTHORIZE_ACTION" ? " active" : ""}`}
            type="button"
            onClick={() => { setActiveMode("AUTHORIZE_ACTION"); setLiveResult(null); setLiveError(""); }}
          >
            <span className="mode-tab-label">AUTHORIZE ACTION</span>
            <small>Autonomous agent payment decisions</small>
          </button>
        </div>

        {/* INVESTIGATE MODE */}
        {activeMode === "INVESTIGATE" && (
          <div className="investigate-panel">
            <div className="investigate-inputs">
              <div className="inv-input-group">
                <label className="inv-label" htmlFor="inv-question">
                  Your Question <small>(required)</small>
                </label>
                <textarea
                  id="inv-question"
                  className="inv-textarea"
                  rows={3}
                  placeholder="What do you want Nexora to verify? e.g. Is this URL safe? Does this transaction exist on Base Sepolia?"
                  value={invQuestion}
                  onChange={(e) => setInvQuestion(e.target.value)}
                />
              </div>

              <div className="inv-context-section">
                <p className="inv-section-title">ADD CONTEXT OR EVIDENCE</p>

                <div className="inv-input-group">
                  <label className="inv-label" htmlFor="inv-claim">
                    Text / Claim <small>(optional)</small>
                  </label>
                  <textarea
                    id="inv-claim"
                    className="inv-textarea"
                    rows={2}
                    placeholder="Enter supporting text, email body, or claim context..."
                    value={invClaim}
                    onChange={(e) => setInvClaim(e.target.value)}
                  />
                </div>

                <div className="inv-source-grid">
                  <div className="inv-input-group">
                    <label className="inv-label" htmlFor="inv-url">
                      URL <small>(optional — triggers URL_SCAN)</small>
                    </label>
                    <input
                      id="inv-url"
                      type="url"
                      className="inv-input"
                      placeholder="https://example.com/supplier"
                      value={invUrl}
                      onChange={(e) => setInvUrl(e.target.value)}
                    />
                  </div>
                  <div className="inv-input-group">
                    <label className="inv-label" htmlFor="inv-tx">
                      Onchain Reference <small>(optional — triggers ONCHAIN_TX_LOOKUP)</small>
                    </label>
                    <input
                      id="inv-tx"
                      className="inv-input"
                      placeholder="0x transaction hash on Base Sepolia"
                      value={invTxHash}
                      onChange={(e) => setInvTxHash(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="example-buttons-row">
                <span className="example-label">TRY AN EXAMPLE</span>
                <button type="button" className="btn-example" onClick={() => loadExample("url-safety")}>Check a URL</button>
                <button type="button" className="btn-example" onClick={() => loadExample("onchain")}>Verify an onchain transaction</button>
                <button type="button" className="btn-example" onClick={() => loadExample("fraud")}>Investigate a suspicious claim</button>
              </div>

              <button
                type="button"
                className="btn-live-decision"
                disabled={invLoading || !invQuestion.trim()}
                onClick={submitInvestigation}
              >
                {invLoading ? (
                  <><span className="spinner" aria-hidden="true" /> Acquiring intelligence…</>
                ) : (
                  <>Analyze with Nexora &rarr;</>
                )}
              </button>
              <p className="live-caution">
                This run makes real Telegraph calls and settles on Base Sepolia.
                Rate limited to one run per minute. Maximum 0.03 USDC per run.
              </p>
            </div>

            {invError && (
              <div className="live-error" role="alert">
                <strong>Investigation unavailable</strong>
                <span>{invError}</span>
              </div>
            )}

            {invResult && (
              <div className="live-result">

                {/* Step 1: YOUR QUESTION */}
                <div className="live-step">
                  <p className="eyebrow">01 · YOUR QUESTION</p>
                  <h3>WHAT NEXORA WAS ASKED</h3>
                  <div className="question-display-box">
                    <p className="main-user-question">&ldquo;{invResult.question}&rdquo;</p>
                    {invResult.investigationPlan.urlTarget && (
                      <div className="question-meta-row">
                        <span>URL: <code>{invResult.investigationPlan.urlTarget}</code></span>
                      </div>
                    )}
                    {invResult.investigationPlan.txHashTarget && (
                      <div className="question-meta-row">
                        <span>Transaction: <code>{invResult.investigationPlan.txHashTarget}</code></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: WHAT NEXORA NEEDS TO VERIFY */}
                {invResult.investigationPlan.requirements.length > 0 && (
                  <div className="live-step">
                    <p className="eyebrow">02 · EVIDENCE QUESTIONS GENERATED</p>
                    <h3>WHAT NEXORA NEEDS TO VERIFY</h3>
                    <div className="requirements-grid">
                      {(invResult.evidenceQuestions.length > 0 ? invResult.evidenceQuestions : invResult.investigationPlan.requirements).map((req: any) => (
                        <div className="requirement-card" key={req.intent}>
                          <div className="req-card-head">
                            <span className="req-intent">{readable(req.intent)}</span>
                            <span className={`req-mandatory ${req.mandatory ? "mandatory" : "optional"}`}>
                              {req.mandatory ? "Mandatory" : "Optional"}
                            </span>
                          </div>
                          {req.question && <h4 className="req-question-text">&ldquo;{req.question}&rdquo;</h4>}
                          {req.whyItMatters && (
                            <p className="req-why-text">
                              <strong>Why this matters:</strong> {req.whyItMatters}
                            </p>
                          )}
                          <div className="req-footer-row">
                            <code className="req-quality">Min quality: {req.minimumQuality}</code>
                            {req.requirementStatus && (
                              <span className={`req-status-tag ${req.requirementStatus.toLowerCase()}`}>
                                {req.requirementStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: TELEGRAPH ROUTING & MINER SELECTION */}
                {invResult.acquiredIntelligence.length > 0 && (
                  <div className="live-step">
                    <p className="eyebrow">03 · TELEGRAPH ROUTING &amp; MINER SELECTION</p>
                    <h3>SELECTIVE MINER ROUTING &amp; ACQUISITION</h3>
                    <div className="intel-grid">
                      {invResult.acquiredIntelligence.map((item) => (
                        <div className="intel-card" key={item.intent}>
                          <div className="intel-card-head">
                            <span className="intel-intent">{readable(item.intent)}</span>
                            <span className={`intel-status ${item.outcome.status}`}>{item.outcome.status.replace(/_/g, " ")}</span>
                          </div>
                          {item.minerId !== "NONE" && item.minerId !== "UNKNOWN" && (
                            <dl className="intel-dl">
                              <div><dt>Provider</dt><dd>{item.minerName}</dd></div>
                              <div><dt>Telegraph Rank</dt><dd>#{item.rank}</dd></div>
                              <div><dt>Endpoint</dt><dd><code>{item.method} {item.endpoint}</code></dd></div>
                              <div><dt>Advertised Price</dt><dd>{(item.advertisedPriceMicroUsdc / 1_000_000).toFixed(4)} USDC</dd></div>
                              <div><dt>Call ID</dt><dd><code className="call-id">{item.logicalCallId}</code></dd></div>
                            </dl>
                          )}
                          {item.outcome.status !== "acquired" && (
                            <p className="intel-reason">{("reason" in item.outcome ? item.outcome.reason : null) ?? "No compatible provider found"}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 4: EVIDENCE QUALITY & CONFLICT ASSESSMENT */}
                {invResult.evidenceAssessments.length > 0 && (
                  <div className="live-step">
                    <p className="eyebrow">04 · EVIDENCE QUALITY &amp; CONFLICT ASSESSMENT</p>
                    <h3>What Nexora trusts, questions, or cannot verify</h3>
                    <div className="live-evidence-grid">
                      {invResult.evidenceAssessments.map((item) => (
                        <div className={`live-evidence-card q-${item.quality.toLowerCase()}`} key={item.intent}>
                          <div className="lev-head">
                            <span>{readable(item.intent)}</span>
                            <span className={`quality-badge q-${item.quality.toLowerCase()}`}>{item.quality}</span>
                          </div>
                          <dl className="lev-dl">
                            <div><dt>Coverage</dt><dd>{readable(item.coverage)}</dd></div>
                            <div><dt>Verification</dt><dd>{readable(item.verification)}</dd></div>
                          </dl>
                          {item.missingEvidence.length > 0 && (
                            <ul className="lev-missing">
                              {item.missingEvidence.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                          )}
                          {item.contradictions.length > 0 && (
                            <ul className="lev-contradictions">
                              {item.contradictions.map((c, i) => <li key={i}>{String(c)}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 5: NEXORA CONCLUSION */}
                <div className={`live-decision-banner ${invResult.verdict.toLowerCase()}`}>
                  <div className="live-step">
                    <p className="eyebrow">05 · NEXORA CONCLUSION</p>
                    <h3 className="decision-value">{invResult.verdict}</h3>
                    <p className="decision-explanation">{invResult.verdictLabel}</p>
                    <p className="decision-explanation">{invResult.verdictSupport}</p>
                  </div>
                </div>

                {invResult.unsupportedAspects.length > 0 && (
                  <div className="live-step">
                    <div className="live-error">
                      <strong>Aspects Nexora could not route</strong>
                      {invResult.unsupportedAspects.map((a, i) => <span key={i}>{a}</span>)}
                    </div>
                  </div>
                )}

                {/* Step 6: PLAIN LANGUAGE EXPLANATION & SETTLEMENT PROVENANCE */}
                {invResult.settlementProvenance.length > 0 && (
                  <div className="live-step">
                    <p className="eyebrow">06 · SETTLEMENT PROVENANCE</p>
                    <h3>Actual payments for this run</h3>
                    <div className="provenance-grid">
                      {invResult.settlementProvenance.map((p) => (
                        <div className="provenance-card" key={p.logicalCallId}>
                          <div><span>Intent</span><strong>{readable(p.intent)}</strong></div>
                          <div><span>Provider</span><strong>{p.minerName}</strong></div>
                          <div><span>Settled</span><strong>{(p.settledMicroUsdc / 1_000_000).toFixed(4)} USDC</strong></div>
                          <div><span>Call ID</span><code className="call-id">{p.logicalCallId}</code></div>
                        </div>
                      ))}
                    </div>
                    <p className="provenance-total">
                      Total settled: <strong>{(invResult.totalSettledMicroUsdc / 1_000_000).toFixed(4)} USDC</strong> across {invResult.paidCallCount} paid {invResult.paidCallCount === 1 ? "call" : "calls"}
                    </p>
                  </div>
                )}

                {/* Step 7: DECISION REPLAY */}
                <div className="live-step">
                  <div className="replay-trail-callout">
                    <strong>EVERY DECISION LEAVES A TRAIL</strong>
                    <p>Decision Replay reconstructs what was asked, what was verified, how each piece of evidence was judged, and how the verdict was reached.</p>
                  </div>
                  <button
                    className="replay-trigger"
                    type="button"
                    aria-expanded={showInvReplay}
                    onClick={() => setShowInvReplay(!showInvReplay)}
                  >
                    <span>{showInvReplay ? "Hide Decision Replay" : "View Decision Replay & Audit Proof"}</span>
                    <b>{invResult.decisionReplay.validation.status} &#x2197;</b>
                  </button>
                  {showInvReplay && (
                    <div className="replay">
                      <div className="replay-head">
                        <div>
                          <p className="eyebrow">07 · DECISION REPLAY &middot; INTEGRITY PROOF</p>
                          <h3>
                            {invResult.decisionReplay.validation.matches
                              ? "Deterministic Integrity Verified: identical inputs → identical decision."
                              : "Integrity Mismatch: recorded decision differs from recalculation."}
                          </h3>
                        </div>
                        <span className={invResult.decisionReplay.validation.matches ? "match" : "mismatch"}>
                          {invResult.decisionReplay.validation.matches ? "✓ VERIFIED MATCH" : "× MISMATCH"}
                        </span>
                      </div>
                      <div className="replay-meta">
                        <div><small>Run ID</small><code>{invResult.runId}</code></div>
                        <div><small>SHA-256 Fingerprint</small><code>{invResult.decisionReplay.fingerprint}</code></div>
                      </div>
                      <div className="timeline-wrap">
                        <h4>Replay Timeline</h4>
                        <ol className="timeline">
                          {invResult.decisionReplay.timeline.map((item) => (
                            <li key={item.order}>
                              <span>{String(item.order).padStart(2, "0")}</span>
                              <div>
                                <strong>{item.title}</strong>
                                <p>{item.summary}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* AUTHORIZE ACTION MODE */}
        {activeMode === "AUTHORIZE_ACTION" && (
          <div className="authorize-panel">
            <div className="live-decision-proposal">
              <p className="eyebrow">PROPOSED AGENT ACTION</p>
              <div className="action-grid">
                <label htmlFor="auth-id">
                  Action ID
                  <input
                    id="auth-id"
                    required
                    value={fields.id}
                    onChange={(e) => setFields({ ...fields, id: e.target.value })}
                  />
                </label>
                <label className="wide" htmlFor="auth-desc">
                  Description
                  <input
                    id="auth-desc"
                    required
                    value={fields.description}
                    onChange={(e) => setFields({ ...fields, description: e.target.value })}
                  />
                </label>
                <label htmlFor="auth-ref">
                  Supplier Reference
                  <input
                    id="auth-ref"
                    required
                    value={fields.reference}
                    onChange={(e) => setFields({ ...fields, reference: e.target.value })}
                  />
                </label>
                <label htmlFor="auth-url">
                  Supplier URL
                  <input
                    id="auth-url"
                    type="url"
                    value={fields.supplierUrl}
                    onChange={(e) => setFields({ ...fields, supplierUrl: e.target.value })}
                  />
                </label>
                <label htmlFor="auth-tx">
                  Transaction Reference <small>(optional)</small>
                  <input
                    id="auth-tx"
                    value={fields.transactionHash}
                    onChange={(e) => setFields({ ...fields, transactionHash: e.target.value })}
                    placeholder="No transaction exists yet"
                  />
                </label>
                <label htmlFor="auth-risk">
                  Risk Class
                  <input id="auth-risk" value="HIGH" readOnly />
                </label>
              </div>
            </div>

            <div className="example-buttons-row" style={{ marginTop: "1rem" }}>
              <span className="example-label">TRY AN EXAMPLE</span>
              <button type="button" className="btn-example" onClick={loadAuthorizeExample}>
                Supplier payment authorization
              </button>
            </div>

            <div className="live-decision-trigger">
              <button
                className="btn-live-decision"
                type="button"
                disabled={liveLoading}
                onClick={submitLiveDecision}
              >
                {liveLoading ? (
                  <><span className="spinner" aria-hidden="true" /> Acquiring intelligence…</>
                ) : (
                  <>Run Authorization Check &rarr;</>
                )}
              </button>
              <p className="live-caution">
                This run makes real Telegraph calls and settles on Base Sepolia.
                Rate limited to one run per minute. Maximum 0.03 USDC per run.
              </p>
            </div>

            {liveError && (
              <div className="live-error" role="alert">
                <strong>Live decision unavailable</strong>
                <span>{liveError}</span>
              </div>
            )}

            {liveResult && (
              <div className="live-result">

                {/* Step 1: YOUR QUESTION */}
                <div className="live-step">
                  <p className="eyebrow">01 · DECISION QUESTION</p>
                  <h3>YOUR QUESTION</h3>
                  <div className="question-display-box">
                    <p className="main-user-question">
                      "{liveResult.userQuestion ?? liveResult.requirementPlan.userQuestion ?? "Is there enough reliable evidence for my agent to authorize this supplier payment?"}"
                    </p>
                    <div className="question-meta-row">
                      <span>Action: <strong>{liveResult.proposedAction.type}</strong></span>
                      <span>Reference: <code>{liveResult.proposedAction.subject.reference}</code></span>
                      <span>Risk Class: <strong>{liveResult.proposedAction.riskClass}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Step 2: WHAT NEXORA NEEDS TO VERIFY */}
                <div className="live-step">
                  <p className="eyebrow">02 · EVIDENCE QUESTIONS GENERATED</p>
                  <h3>WHAT NEXORA NEEDS TO VERIFY</h3>
                  <div className="requirements-grid">
                    {(liveResult.evidenceQuestions ?? liveResult.requirementPlan.requirements).map((req: any) => (
                      <div className="requirement-card" key={req.intent}>
                        <div className="req-card-head">
                          <span className="req-intent">{readable(req.intent)}</span>
                          <span className={`req-mandatory ${req.mandatory ? "mandatory" : "optional"}`}>
                            {req.mandatory ? "Mandatory" : "Optional"}
                          </span>
                        </div>
                        {req.question && <h4 className="req-question-text">"{req.question}"</h4>}
                        {req.whyItMatters && (
                          <p className="req-why-text">
                            <strong>Why this matters:</strong> {req.whyItMatters}
                          </p>
                        )}
                        <div className="req-footer-row">
                          <code className="req-quality">Min quality: {req.minimumQuality}</code>
                          {req.requirementStatus && (
                            <span className={`req-status-tag ${req.requirementStatus.toLowerCase()}`}>
                              {req.requirementStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 3: TELEGRAPH ROUTING */}
                <div className="live-step">
                  <p className="eyebrow">03 · TELEGRAPH ROUTING &amp; MINER SELECTION</p>
                  <h3>SELECTIVE MINER ROUTING &amp; ACQUISITION</h3>
                  <div className="intel-grid">
                    {liveResult.acquiredIntelligence.map((item) => {
                      const matchingEq = liveResult.evidenceQuestions?.find((eq) => eq.intent === item.intent);
                      return (
                        <div className="intel-card" key={item.intent}>
                          <div className="intel-card-head">
                            <span className="intel-intent">{readable(item.intent)}</span>
                            <span className={`intel-status ${item.outcome.status}`}>{item.outcome.status.replace(/_/g, " ")}</span>
                          </div>
                          {item.minerId !== "NONE" && item.minerId !== "UNKNOWN" && (
                            <dl className="intel-dl">
                              <div><dt>Provider</dt><dd>{item.minerName}</dd></div>
                              <div><dt>Telegraph Rank</dt><dd>#{item.rank}</dd></div>
                              <div><dt>Endpoint</dt><dd><code>{item.method} {item.endpoint}</code></dd></div>
                              <div><dt>Advertised Price</dt><dd>{(item.advertisedPriceMicroUsdc / 1_000_000).toFixed(4)} USDC</dd></div>
                              <div><dt>Call ID</dt><dd><code className="call-id">{item.logicalCallId}</code></dd></div>
                            </dl>
                          )}
                          {item.selectionExplanation && (
                            <div className="selection-expl-box">
                              <small>WHY THIS MINER</small>
                              <p>{item.selectionExplanation}</p>
                            </div>
                          )}
                          {item.requestSummary && item.requestSummary.parameters && (
                            <div className="request-summary-box">
                              <small>WHAT NEXORA ASKED (SANITIZED)</small>
                              <code>{JSON.stringify(item.requestSummary.parameters)}</code>
                            </div>
                          )}
                          {matchingEq?.decisionContribution && (
                            <div className="contribution-box">
                              <small>EVIDENCE CONTRIBUTION</small>
                              <p>{matchingEq.decisionContribution}</p>
                            </div>
                          )}
                          {item.outcome.status !== "acquired" && (
                            <p className="intel-reason">{item.outcome.reason ?? "No compatible provider found"}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step 4: EVIDENCE QUALITY & CONFLICT ASSESSMENT */}
                <div className="live-step">
                  <p className="eyebrow">04 · EVIDENCE QUALITY &amp; CONFLICT ASSESSMENT</p>
                  <h3>What Nexora trusts, questions, or cannot verify</h3>
                  <div className="live-evidence-grid">
                    {liveResult.evidenceAssessments.map((item) => (
                      <div className={`live-evidence-card q-${item.quality.toLowerCase()}`} key={item.intent}>
                        <div className="lev-head">
                          <span>{readable(item.intent)}</span>
                          <span className={`quality-badge q-${item.quality.toLowerCase()}`}>{item.quality}</span>
                        </div>
                        <dl className="lev-dl">
                          <div><dt>Coverage</dt><dd>{readable(item.coverage)}</dd></div>
                          <div><dt>Verification</dt><dd>{readable(item.verification)}</dd></div>
                        </dl>
                        {item.missingEvidence.length > 0 && (
                          <ul className="lev-missing">
                            {item.missingEvidence.map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        )}
                        {item.contradictions.length > 0 && (
                          <ul className="lev-contradictions">
                            {item.contradictions.map((c, i) => <li key={i}>{String(c)}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 5: NEXORA DECISION */}
                <div className={`live-decision-banner ${liveResult.actionDecision.decision.toLowerCase()}`}>
                  <div className="live-step">
                    <p className="eyebrow">05 · NEXORA DECISION</p>
                    <h3 className="decision-value">{liveResult.actionDecision.decision}</h3>
                    <p className="decision-explanation">
                      {formatDecisionExplanation(
                        liveResult.actionDecision.decision,
                        liveResult.actionDecision.reasons,
                        liveResult.resolution.unresolvedConditions
                      )}
                    </p>
                    <details className="raw-reasons-toggle">
                      <summary>View audit reason codes</summary>
                      <code>{liveResult.actionDecision.reasons.join(" · ")}</code>
                    </details>
                    <div className="decision-stat-row">
                      <span><b>{liveResult.actionDecision.satisfiedRequirements.length}</b> satisfied</span>
                      <span><b>{liveResult.actionDecision.unsatisfiedRequirements.length}</b> unresolved</span>
                      <span><b>{liveResult.actionDecision.blockingEvidence.length}</b> blocking</span>
                    </div>
                  </div>
                </div>

                {/* Step 6: AGENT RESPONSE */}
                <div className="live-step">
                  <p className="eyebrow">06 · AGENT RESPONSE</p>
                  <div className={`agent-state-card ${liveResult.agentState.toLowerCase()}`}>
                    <h3>{liveResult.agentState}</h3>
                    <p className="agent-label">{liveResult.agentStateLabel}</p>
                    <p className="agent-support">{liveResult.agentStateSupport}</p>
                  </div>
                </div>

                {/* Step 7: RESOLUTION GUIDANCE */}
                <div className="live-step">
                  <p className="eyebrow">07 · RESOLUTION GUIDANCE</p>
                  <h3>Plain language explanation</h3>
                  {liveResult.resolution.resolved ? (
                    <p className="resolution-resolved">
                      All required evidence was satisfied. The agent can proceed.
                    </p>
                  ) : (
                    <ul className="unresolved-list">
                      {liveResult.resolution.unresolvedConditions.map((cond, i) => (
                        <li key={i}>
                          <strong>{cond.requiredCondition}</strong>
                          <span>{cond.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Step 8: SETTLEMENT PROVENANCE & DECISION REPLAY */}
                {liveResult.settlementProvenance.length > 0 && (
                  <div className="live-step">
                    <p className="eyebrow">SETTLEMENT PROVENANCE</p>
                    <h3>Actual payments for this run</h3>
                    <div className="provenance-grid">
                      {liveResult.settlementProvenance.map((p) => (
                        <div className="provenance-card" key={p.logicalCallId}>
                          <div><span>Intent</span><strong>{readable(p.intent)}</strong></div>
                          <div><span>Provider</span><strong>{p.minerName}</strong></div>
                          <div><span>Settled</span><strong>{(p.settledMicroUsdc / 1_000_000).toFixed(4)} USDC</strong></div>
                          <div><span>Call ID</span><code className="call-id">{p.logicalCallId}</code></div>
                        </div>
                      ))}
                    </div>
                    <p className="provenance-total">
                      Total settled: <strong>{(liveResult.totalSettledMicroUsdc / 1_000_000).toFixed(4)} USDC</strong> across {liveResult.paidCallCount} paid {liveResult.paidCallCount === 1 ? "call" : "calls"}
                    </p>
                  </div>
                )}

                <div className="live-step">
                  <div className="replay-trail-callout">
                    <strong>EVERY DECISION LEAVES A TRAIL</strong>
                    <p>Decision Replay reconstructs what the agent proposed, what intelligence Nexora requested, what evidence returned, how that evidence was judged, and why the agent ultimately proceeded or stopped.</p>
                  </div>
                  <button
                    className="replay-trigger"
                    type="button"
                    aria-expanded={showLiveReplay}
                    onClick={() => setShowLiveReplay(!showLiveReplay)}
                  >
                    <span>{showLiveReplay ? "Hide Decision Replay" : "View Decision Replay & Audit Proof"}</span>
                    <b>{liveResult.decisionReplay.validation.status} ↗</b>
                  </button>
                  {showLiveReplay && (
                    <div className="replay">
                      <div className="replay-head">
                        <div>
                          <p className="eyebrow">08 · DECISION REPLAY &middot; INTEGRITY PROOF</p>
                          <h3>
                            {liveResult.decisionReplay.validation.matches
                              ? "Deterministic Integrity Verified: identical inputs → identical decision."
                              : "Integrity Mismatch: recorded decision differs from recalculation."}
                          </h3>
                        </div>
                        <span className={liveResult.decisionReplay.validation.matches ? "match" : "mismatch"}>
                          {liveResult.decisionReplay.validation.matches ? "✓ VERIFIED MATCH" : "× MISMATCH"}
                        </span>
                      </div>
                      <div className="replay-meta">
                        <div><small>Run ID</small><code>{liveResult.runId}</code></div>
                        <div><small>Decision ID</small><code>{liveResult.decisionReplay.decisionId}</code></div>
                        <div><small>SHA-256 Fingerprint</small><code>{liveResult.decisionReplay.fingerprint}</code></div>
                        <div><small>Recorded / Recomputed</small>
                          <code>{liveResult.decisionReplay.validation.recordedDecision} / {liveResult.decisionReplay.validation.recomputedDecision}</code>
                        </div>
                      </div>
                      <div className="timeline-wrap">
                        <h4>Replay Timeline</h4>
                        <ol className="timeline">
                          {liveResult.decisionReplay.timeline.map((item) => (
                            <li key={item.order}>
                              <span>{String(item.order).padStart(2, "0")}</span>
                              <div>
                                <strong>{item.title}</strong>
                                <p>{item.summary}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </section>

      {/* Architecture Snapshot */}
      <section className="architecture-section" id="architecture">
        <div className="section-head">
          <div>
            <p className="eyebrow">QUESTION-TO-EVIDENCE ORCHESTRATION ARCHITECTURE</p>
            <h2>How Nexora Turns Questions into Bounded Decisions</h2>
          </div>
          <p>Transparent intelligence-to-decision pipeline from user question to tamper-evident decision replay.</p>
        </div>
        <div className="pipeline-grid">
          <div className="pipeline-step">
            <span className="step-badge">01 QUESTION</span>
            <h4>User Question / Action</h4>
            <p>User or agent submits a question, claim, link, or proposed action.</p>
          </div>
          <div className="pipeline-step">
            <span className="step-badge">02 EVIDENCE</span>
            <h4>Evidence Requirements</h4>
            <p>Planner generates explicit evidence questions & explains why each matters.</p>
          </div>
          <div className="pipeline-step">
            <span className="step-badge">03 TELEGRAPH</span>
            <h4>Intelligence Routing</h4>
            <p>Discovers registry, selects compatible Telegraph miners, & prepares requests.</p>
          </div>
          <div className="pipeline-step">
            <span className="step-badge">04 VERIFICATION</span>
            <h4>Quality & Conflict</h4>
            <p>Measures structural validity, missing items, & cross-source contradictions.</p>
          </div>
          <div className="pipeline-step">
            <span className="step-badge">05 POLICY</span>
            <h4>Deterministic Policy</h4>
            <p>Evaluates mandatory rules without averaging provider confidence.</p>
          </div>
          <div className="pipeline-step highlight">
            <span className="step-badge">06 OUTCOME</span>
            <h4>Bounded Conclusion</h4>
            <div className="dual-outcome-box">
              <div className="outcome-group">
                <small>INVESTIGATE</small>
                <span>SUPPORTED · DISPUTED · INCONCLUSIVE</span>
              </div>
              <div className="outcome-group">
                <small>AUTHORIZE ACTION</small>
                <span>ALLOW · REVIEW · BLOCK</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Contradiction Case Spotlight */}
      <section className="contradiction-section" id="contradiction">
        <div className="contradiction-card">
          <div className="contradiction-header">
            <span className="tag-warning">KEY HACKATHON FINDING</span>
            <h2>The Contradiction Case: High Confidence ≠ Correct Evidence</h2>
            <p className="tagline">Why evidence-aware decision control matters for autonomous agents.</p>
          </div>
          <div className="contradiction-story">
            <p>
              During Phase 5D live Telegraph smoke, TxLens miner <code>9002</code> was queried for an on-chain transaction. The miner returned <strong>status: not_found</strong> with <strong>100% confidence (1.0)</strong>.
            </p>
            <p>
              Independent verification against Base Sepolia proved the transaction (<code>0xcd9a...</code>) independently existed and succeeded in block <code>46,306,603</code>.
            </p>
            <p>
              <strong>Nexora’s Action:</strong> Rather than blindly trusting the 100% confidence score, Nexora preserved the miner’s raw report verbatim and classified evidence quality as <strong>CONTRADICTED</strong>, routing the action to safe <strong>REVIEW</strong>.
            </p>
          </div>
          <div className="contradiction-comparison-grid">
            <div className="comp-card">
              <span className="comp-label">Telegraph Miner Result</span>
              <div className="comp-value error">not_found</div>
              <small>TxLens (Miner 9002)</small>
            </div>
            <div className="comp-card">
              <span className="comp-label">Provider Confidence</span>
              <div className="comp-value error">100% (1.0)</div>
              <small>Reported by Miner</small>
            </div>
            <div className="comp-card">
              <span className="comp-label">On-Chain Reality</span>
              <div className="comp-value success">Block 46,306,603</div>
              <small>Verified on Base Sepolia</small>
            </div>
            <div className="comp-card highlight">
              <span className="comp-label">Nexora Evidence Quality</span>
              <div className="comp-value review">CONTRADICTED</div>
              <small>Decision: REVIEW</small>
            </div>
          </div>
          <div className="contradiction-action">
            <button type="button" onClick={loadContradictionScenario} className="btn-load-scenario">
              Load Contradiction Scenario in Decision Workspace <b>↓</b>
            </button>
          </div>
        </div>
      </section>

      {/* Live Discovery Inspector */}
      {discovery && discovery.status === "ok" && (
        <section className="discovery-section" id="discovery">
          <div className="section-head">
            <div>
              <p className="eyebrow">FREE REGISTRY INSPECTION</p>
              <h2>Live Telegraph Discovery Inspector</h2>
            </div>
            <p>Nexora reads the live Telegraph miner registry without spending USDC.</p>
          </div>
          <div className="discovery-meta-bar">
            <span><b>{discovery.totalRegistrations}</b> Miners Registered</span>
            <span><b>{Object.keys(discovery.discovery).length}</b> Supported Intents</span>
            <span>Network: <b>Base Sepolia</b></span>
          </div>
          <div className="discovery-grid">
            {Object.entries(discovery.discovery).map(([intent, data]) => (
              <div className="discovery-card" key={intent}>
                <div className="disc-card-head">
                  <span className="disc-intent">{readable(intent)}</span>
                  <span className="disc-count">{data.eligibleCount} eligible</span>
                </div>
                {data.winner ? (
                  <div className="disc-winner">
                    <small>TOP RANKED MINER</small>
                    <h4>{data.winner.name}</h4>
                    <dl className="disc-dl">
                      <div><dt>Telegraph Rank</dt><dd>#{data.winner.rank}</dd></div>
                      <div><dt>Score</dt><dd>{(data.winner.score * 100).toFixed(1)}%</dd></div>
                      <div><dt>Endpoint</dt><dd><code>{data.winner.endpoint}</code></dd></div>
                      <div><dt>Advertised Price</dt><dd>{(data.winner.advertisedPriceMicroUsdc / 1_000_000).toFixed(4)} USDC</dd></div>
                    </dl>
                  </div>
                ) : (
                  <p className="no-miner">No active compatible miner found in current registry.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* What Can Nexora Help Decide? Section */}
      <section className="sample-decisions-section" id="sample-decisions">
        <div className="section-head">
          <div>
            <p className="eyebrow">QUESTIONS NEXORA HELPS ANSWER</p>
            <h2>WHAT CAN NEXORA HELP DECIDE?</h2>
          </div>
          <p>
            Nexora sits between an agent's proposed action or user question and execution. It gathers the intelligence required, checks whether that evidence is reliable enough, then returns a bounded conclusion with a complete decision trace.
          </p>
        </div>
        <div className="sample-questions-grid">
          <div className="sample-question-card">
            <span className="sample-tag">EXAMPLE DECISION 01</span>
            <p className="sample-question">"Is this URL safe enough to trust?"</p>
            <span className="sample-context">Validates point-in-time URL scan evidence, domain security indicators, and infrastructure signals before trusting a link.</span>
          </div>
          <div className="sample-question-card">
            <span className="sample-tag">EXAMPLE DECISION 02</span>
            <p className="sample-question">"Does this transaction exist on the claimed network?"</p>
            <span className="sample-context">Verifies independent on-chain transaction inclusion on Base Sepolia without relying on third-party assertions.</span>
          </div>
          <div className="sample-question-card">
            <span className="sample-tag">EXAMPLE DECISION 03</span>
            <p className="sample-question">"Is there enough reliable evidence to support this claim?"</p>
            <span className="sample-context">Screens fraud indicators, cross-source contradictions, and evidence quality gaps before accepting a statement.</span>
          </div>
          <div className="sample-question-card">
            <span className="sample-tag">EXAMPLE DECISION 04</span>
            <p className="sample-question">"Does my agent have enough evidence to authorize this action?"</p>
            <span className="sample-context">Evaluates mandatory evidence policy rules deterministically before authorizing irreversible agent payments or state changes.</span>
          </div>
        </div>
      </section>

      {/* Why Nexora Is Different Section */}
      <section className="why-different-section" id="why-nexora">
        <div className="section-head">
          <div>
            <p className="eyebrow">THREE CORE PRINCIPLES</p>
            <h2>WHY NEXORA IS DIFFERENT</h2>
          </div>
          <p>Nexora separates raw intelligence acquisition from bounded policy evaluation.</p>
        </div>
        <div className="why-grid">
          <div className="why-card">
            <span className="why-num">01</span>
            <h3>INTELLIGENCE IS NOT A DECISION</h3>
            <p>
              A miner can return an answer with high confidence and the evidence can still be incomplete, contradicted, or unsuitable for the action.
            </p>
          </div>
          <div className="why-card">
            <span className="why-num">02</span>
            <h3>EVIDENCE KEEPS ITS OWN QUALITY</h3>
            <p>
              Nexora does not average unrelated confidence scores into one artificial trust number. Each required piece of evidence is evaluated on its own.
            </p>
          </div>
          <div className="why-card">
            <span className="why-num">03</span>
            <h3>THE AGENT MUST OBEY THE RESULT</h3>
            <p>
              ALLOW lets the reference agent proceed. REVIEW holds the action. BLOCK rejects it. Every decision can be inspected through Decision Replay.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section" id="faq">
        <div className="section-head">
          <div>
            <p className="eyebrow">CLEAR ANSWERS</p>
            <h2>Frequently Asked Questions</h2>
          </div>
          <p>Everything you need to know about Nexora's decision control layer.</p>
        </div>

        <div className="faq-safety-banner">
          <span className="faq-safety-tag">REVIEW IS A SAFETY DECISION</span>
          <p>
            Nexora does not force a yes or no when the evidence cannot support one. REVIEW means the agent was stopped before uncertainty became action.
          </p>
        </div>

        <div className="faq-accordion">
          <details className="faq-item">
            <summary className="faq-question">What is Nexora?</summary>
            <div className="faq-answer">
              Nexora is an intelligence-to-decision layer for autonomous agents and users. A user or agent provides a question or proposed action. Nexora determines what evidence is needed, routes those evidence questions through relevant Telegraph miners, checks the quality and consistency of the responses, then returns a bounded conclusion with a complete Decision Replay audit trace.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Is Nexora a chatbot or search engine?</summary>
            <div className="faq-answer">
              No. Nexora does not simply generate an answer from a prompt. It turns the question into explicit evidence requirements and shows what was verified before reaching a decision.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Why does Nexora ask several evidence questions?</summary>
            <div className="faq-answer">
              Important decisions often depend on more than one kind of evidence. Nexora breaks a decision into smaller verifiable questions so each claim can be checked through an appropriate Telegraph intelligence source.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">How does Nexora choose Telegraph miners?</summary>
            <div className="faq-answer">
              Nexora discovers available Telegraph miners and matches the required evidence intent to compatible miners. It routes selectively rather than sending every question to every miner.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Does Nexora search the entire Telegraph network?</summary>
            <div className="faq-answer">
              Nexora can discover miners across the Telegraph registry to understand which intelligence sources are available. It then selects compatible miners for the evidence actually required instead of paying every miner unnecessarily.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Can one question use multiple miners?</summary>
            <div className="faq-answer">
              Nexora’s architecture supports multiple miner responses for the same evidence question so independent intelligence can be compared. Paid requests remain deliberately bounded to avoid unnecessary network traffic or spending.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Why can’t Nexora simply trust a miner’s confidence score?</summary>
            <div className="faq-answer">
              A confidence score tells Nexora how confident the provider is in its own response. It does not prove the evidence is complete or correct. Nexora also checks coverage, required fields, structural validity, contradictions, and policy requirements.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Can a highly confident miner still be wrong?</summary>
            <div className="faq-answer">
              Yes. Nexora treats provider confidence as one piece of evidence, not proof. A response can report high confidence and still be incomplete or contradicted by independently verifiable information.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">What are ALLOW, REVIEW, and BLOCK?</summary>
            <div className="faq-answer">
              ALLOW means the required evidence satisfies the policy.<br />
              REVIEW means important evidence is missing, weak, unresolved, or contradictory.<br />
              BLOCK means reliable adverse evidence meets a configured blocking condition.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">What is Decision Replay?</summary>
            <div className="faq-answer">
              Decision Replay is the audit trail behind a Nexora decision. It shows the original question, the evidence Nexora required, why each question was asked, Telegraph routing, miner responses, evidence quality, conflicts, policy evaluation, the final decision, and the resulting agent response.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Does Nexora move money or execute a user’s transaction?</summary>
            <div className="faq-answer">
              No. Nexora controls authorization decisions. The reference agent records whether an action is authorized, held for review, or rejected. Nexora’s only payments are bounded x402 payments used to obtain Telegraph intelligence.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Why does Nexora use Telegraph?</summary>
            <div className="faq-answer">
              Telegraph gives Nexora access to specialized intelligence miners. Nexora adds the decision layer that determines which intelligence is relevant, whether the returned evidence is reliable enough, and what an autonomous agent should do with it.
            </div>
          </details>
          <details className="faq-item">
            <summary className="faq-question">Can Nexora work with links, images, documents, or videos?</summary>
            <div className="faq-answer">
              Nexora’s architecture is being designed so decision questions can originate from richer evidence such as URLs, documents, images, and video-derived claims. Nexora can then turn the relevant information into verifiable evidence questions and route them through compatible intelligence sources.
            </div>
          </details>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-content">
          <div>
            <strong>NEXORA</strong> — The Decision Layer for Autonomous Agents.
            <p>Telegraph Protocol Hackathon Season I · Track 3: Applications</p>
          </div>
          <div className="footer-links">
            <a href="https://github.com/chyokore/nexora" target="_blank" rel="noreferrer">
              GitHub Repository
            </a>
            <a href="https://nexora-api-3efi.onrender.com/health" target="_blank" rel="noreferrer">
              API Health Endpoint
            </a>
            <a href="https://nexora-seven-lemon.vercel.app" target="_blank" rel="noreferrer">
              Public Vercel App
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
