import { FormEvent, useEffect, useMemo, useState } from "react";
import { evaluateDecision, fetchDiscovery } from "./api";
import type { DiscoveryResponse, EvaluationResponse, ProposedAction } from "./contracts";
import { scenarioById, scenarios, type ScenarioId } from "./scenarios";

const readable = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/(^|:)([a-z])/g, (_: string, edge: string, letter: string) => `${edge}${letter.toUpperCase()}`);

const percent = (value?: number) => (value === undefined ? "Not supplied" : `${Math.round(value * 100)}%`);

export default function App() {
  const [condition, setCondition] = useState<ScenarioId>("supported");
  const scenario = useMemo(() => scenarioById(condition), [condition]);
  const [fields, setFields] = useState({
    id: "supplier-payment-001",
    description: "Authorize payment to updated supplier destination",
    reference: "supplier-northstar-042",
    supplierUrl: "https://example.com/",
    transactionHash: "",
  });
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showReplay, setShowReplay] = useState(false);
  const [showRawPacket, setShowRawPacket] = useState(false);
  const [copied, setCopied] = useState(false);

  // Live Discovery State
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");

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

  useEffect(() => {
    loadDiscovery();
  }, []);

  function chooseScenario(id: ScenarioId) {
    setCondition(id);
    setResult(null);
    setShowReplay(false);
    setShowRawPacket(false);
    setError("");
    const selected = scenarioById(id);
    setFields((current) => ({
      ...current,
      transactionHash: selected.transactionHash ?? "",
    }));
  }

  function loadContradictionScenario() {
    chooseScenario("contradicted");
    const el = document.getElementById("evaluate");
    el?.scrollIntoView({ behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setShowReplay(false);
    setShowRawPacket(false);
    const proposedAction: ProposedAction = {
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
      setResult(await evaluateDecision(proposedAction, scenario.evidence));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Product API could not be reached");
    } finally {
      setLoading(false);
    }
  }

  function copyFingerprint(text: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const decision = result?.decisionPacket.actionDecision;
  const replay = result?.decisionReplay;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Nexora home">
          <span className="brand-mark">N</span>
          <span>NEXORA</span>
        </a>
        <nav className="top-nav" aria-label="Quick links">
          <a href="#architecture">Architecture</a>
          <a href="#contradiction">Contradiction Case</a>
          <a href="#live-evidence">Live Evidence</a>
          <a href="#discovery">Live Discovery</a>
          <a href="#evaluate" className="nav-cta">Evaluate Action</a>
        </nav>
        <span className="system-state">
          <i /> DETERMINISTIC CORE · FREE TELEGRAPH DISCOVERY
        </span>
      </header>

      {/* Hero Section */}
      <section className="hero" id="top">
        <div className="hero-main">
          <p className="eyebrow">DECISION CONTROL LAYER FOR AUTONOMOUS AGENTS</p>
          <h1>
            The Decision Layer<br />for <em>Autonomous Agents.</em>
          </h1>
          <p className="lede">
            <strong>Intelligence tells an agent what is happening.</strong>
            <br />
            <strong>Nexora decides what the agent should do next.</strong>
          </p>
          <div className="value-pillars">
            <div className="pillar">
              <span className="pillar-num">01</span>
              <strong>Real Intelligence</strong>
              <p>Telegraph miners supply specialized intelligence without platform favoritism.</p>
            </div>
            <div className="pillar">
              <span className="pillar-num">02</span>
              <strong>Zero Blind Trust</strong>
              <p>High confidence is not truth; missing evidence is never assumed safe.</p>
            </div>
            <div className="pillar">
              <span className="pillar-num">03</span>
              <strong>Deterministic Replay</strong>
              <p>Emits ALLOW, REVIEW, or BLOCK with verifiable SHA-256 decision audit.</p>
            </div>
          </div>
          <div className="hero-actions">
            <a href="#evaluate" className="btn-primary">Evaluate an Action</a>
            <a href="#contradiction" className="btn-secondary">The Contradiction Case</a>
            <a href="#discovery" className="btn-secondary">Live Discovery Inspector</a>
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

      {/* Architecture Snapshot */}
      <section className="architecture-section" id="architecture">
        <div className="section-head">
          <div>
            <p className="eyebrow">ARCHITECTURE SNAPSHOT</p>
            <h2>How Nexora Evaluates Agent Actions</h2>
          </div>
          <p>Strict pipeline separation from proposed action to tamper-evident decision replay.</p>
        </div>
        <div className="pipeline-grid">
          <div className="pipeline-step">
            <span className="step-badge">STEP 1</span>
            <h4>Agent Proposed Action</h4>
            <p>Agent proposes an action with subject, destination, and risk classification.</p>
          </div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-step">
            <span className="step-badge">STEP 2</span>
            <h4>Telegraph Intelligence</h4>
            <p>Neutral miners discover signals across Fraud, URL, and On-chain domains.</p>
          </div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-step">
            <span className="step-badge">STEP 3</span>
            <h4>Evidence Quality</h4>
            <p>Assesses structural validity, coverage, missing fields, and factual contradictions.</p>
          </div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-step">
            <span className="step-badge">STEP 4</span>
            <h4>Deterministic Policy</h4>
            <p>Evaluates mandatory requirements without averaging confidence scores.</p>
          </div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-step highlight">
            <span className="step-badge">OUTPUT</span>
            <h4>ALLOW / REVIEW / BLOCK</h4>
            <p>Explicit bounded verdict with SHA-256 Decision Replay integrity proof.</p>
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
              <span className="comp-label">Miner Confidence</span>
              <div className="comp-value warning">1.0 (100%)</div>
              <small>Reported by provider</small>
            </div>
            <div className="comp-card">
              <span className="comp-label">Base Sepolia Reality</span>
              <div className="comp-value success">Transaction Exists</div>
              <small>Block 46,306,603</small>
            </div>
            <div className="comp-card">
              <span className="comp-label">Nexora Evidence Quality</span>
              <div className="comp-value review-text">CONTRADICTED</div>
              <small>Preserves ground truth</small>
            </div>
            <div className="comp-card highlight-decision">
              <span className="comp-label">Policy Decision</span>
              <div className="comp-value review-pill">REVIEW</div>
              <small>Prevents blind execution</small>
            </div>
          </div>
          <div className="contradiction-action">
            <button type="button" onClick={loadContradictionScenario} className="btn-load-scenario">
              Load Contradiction Scenario in Decision Evaluator <b>↓</b>
            </button>
          </div>
        </div>
      </section>

      {/* Verified Live Telegraph Evidence Gallery */}
      <section className="live-evidence-section" id="live-evidence">
        <div className="section-head">
          <div>
            <p className="eyebrow">PROVEN SETTLEMENTS · BASE SEPOLIA</p>
            <h2>Verified Live Telegraph Evidence</h2>
          </div>
          <p>
            3 live purchases executed and settled on Base Sepolia. Zero mocks in the live execution path.
          </p>
        </div>
        <div className="proven-grid">
          {/* Card 1: Fraud */}
          <div className="proven-card">
            <div className="proven-card-head">
              <span className="proven-intent">FRAUD DETECTION</span>
              <span className="proven-cost">0.01 USDC</span>
            </div>
            <dl className="proven-dl">
              <div><dt>Selected Miner</dt><dd>DegenLens (10002)</dd></div>
              <div><dt>Endpoint</dt><dd><code>GET /anomaly/check</code></dd></div>
              <div><dt>Base Sepolia Block</dt><dd>46,306,281</dd></div>
              <div><dt>Settlement Tx</dt><dd><code>0x1a26...c2ff</code></dd></div>
              <div><dt>Miner Verdict</dt><dd>out_of_coverage</dd></div>
              <div><dt>Confidence</dt><dd>0 (0%)</dd></div>
            </dl>
            <div className="proven-badge-row">
              <span className="quality-pill q-insufficient">QUALITY: INSUFFICIENT</span>
              <span className="provenance-tag">VERIFIED LIVE</span>
            </div>
            <p className="proven-summary">
              Miner honestly returned out-of-coverage for off-chain synthetic scenario. Nexora preserved uncertainty rather than assuming approval.
            </p>
          </div>

          {/* Card 2: URL */}
          <div className="proven-card">
            <div className="proven-card-head">
              <span className="proven-intent">URL SCAN</span>
              <span className="proven-cost">0.01 USDC</span>
            </div>
            <dl className="proven-dl">
              <div><dt>Selected Miner</dt><dd>NetWire URL Scan (7334)</dd></div>
              <div><dt>Endpoint</dt><dd><code>GET /url-scan</code></dd></div>
              <div><dt>Base Sepolia Block</dt><dd>46,306,603</dd></div>
              <div><dt>Settlement Tx</dt><dd><code>0xcd9a...1882</code></dd></div>
              <div><dt>Miner Verdict</dt><dd>safe: true, risk: low</dd></div>
              <div><dt>Confidence</dt><dd>0.93 (93%)</dd></div>
            </dl>
            <div className="proven-badge-row">
              <span className="quality-pill q-usable">QUALITY: USABLE</span>
              <span className="provenance-tag">VERIFIED LIVE</span>
            </div>
            <p className="proven-summary">
              Verified domain reachability and checked threat feeds. Nexora bound evidence to point-in-time without future guarantees.
            </p>
          </div>

          {/* Card 3: Onchain */}
          <div className="proven-card">
            <div className="proven-card-head">
              <span className="proven-intent">ONCHAIN TX LOOKUP</span>
              <span className="proven-cost">0.01 USDC</span>
            </div>
            <dl className="proven-dl">
              <div><dt>Selected Miner</dt><dd>TxLens (9002)</dd></div>
              <div><dt>Endpoint</dt><dd><code>GET /check-tx</code></dd></div>
              <div><dt>Base Sepolia Block</dt><dd>46,307,152</dd></div>
              <div><dt>Settlement Tx</dt><dd><code>0x173c...5e9</code></dd></div>
              <div><dt>Miner Verdict</dt><dd>status: not_found</dd></div>
              <div><dt>Confidence</dt><dd>1.0 (100%)</dd></div>
            </dl>
            <div className="proven-badge-row">
              <span className="quality-pill q-contradicted">QUALITY: CONTRADICTED</span>
              <span className="provenance-tag">VERIFIED LIVE</span>
            </div>
            <p className="proven-summary">
              Tx existed on Base Sepolia. Miner reported not_found. Nexora detected factual conflict and forced action to REVIEW.
            </p>
          </div>
        </div>
      </section>

      {/* Live Telegraph Discovery Inspector */}
      <section className="discovery-section" id="discovery">
        <div className="section-head">
          <div>
            <p className="eyebrow">READ-ONLY FREE DISCOVERY</p>
            <h2>Live Telegraph Discovery Inspector</h2>
          </div>
          <div className="discovery-head-actions">
            <span className="discovery-disclaimer">
              Free registry discovery only · No paid inference or payment signatures
            </span>
            <button type="button" onClick={loadDiscovery} disabled={discoveryLoading} className="btn-refresh">
              {discoveryLoading ? "Querying Registry…" : "Refresh Discovery ↻"}
            </button>
          </div>
        </div>

        {discoveryError && (
          <div className="discovery-error">
            <strong>Live discovery temporarily unavailable</strong>
            <span>{discoveryError}</span>
            <small>No mock fallback was substituted. Live discovery status is reported honestly.</small>
          </div>
        )}

        {discovery && (
          <div className="discovery-content">
            <div className="discovery-meta-bar">
              <div>
                <small>REGISTRY STATUS</small>
                <strong>CONNECTED (LIVE)</strong>
              </div>
              <div>
                <small>TOTAL MINERS IN REGISTRY</small>
                <strong>{discovery.totalRegistrations} Miners</strong>
              </div>
              <div>
                <small>DISCOVERY TIMESTAMP</small>
                <span>{new Date(discovery.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="discovery-cards-grid">
              {Object.entries(discovery.discovery).map(([intent, data]) => (
                <div className="discovery-miner-card" key={intent}>
                  <div className="discovery-card-top">
                    <span className="intent-title">{readable(intent)}</span>
                    <span className="eligible-pill">{data.eligibleCount} eligible</span>
                  </div>
                  {data.winner ? (
                    <div className="miner-details">
                      <div className="miner-name-row">
                        <strong>{data.winner.name}</strong>
                        <span className="miner-id">ID: {data.winner.id}</span>
                      </div>
                      <dl className="miner-dl">
                        <div>
                          <dt>Telegraph Rank</dt>
                          <dd>#{data.winner.rank}</dd>
                        </div>
                        <div>
                          <dt>Telegraph Score</dt>
                          <dd>{typeof data.winner.score === "number" ? data.winner.score.toFixed(4) : data.winner.score}</dd>
                        </div>
                        <div>
                          <dt>Endpoint</dt>
                          <dd>
                            <code>{data.winner.method} {data.winner.endpoint}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Schema Family</dt>
                          <dd>{data.winner.schemaFamily}</dd>
                        </div>
                        <div>
                          <dt>Advertised Price</dt>
                          <dd>{(data.winner.advertisedPriceMicroUsdc / 1_000_000).toFixed(4)} USDC</dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <p className="no-miner">No active compatible miner found in current registry.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Decision Evaluator Workspace */}
      <section className="workspace" id="evaluate">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 · PROPOSED ACTION</p>
            <h2>Evaluate a Supplier Payment Action</h2>
          </div>
          <p>Nexora evaluates the proposal deterministically against evidence assessments.</p>
        </div>
        <form onSubmit={submit}>
          <div className="action-grid">
            <label>
              Action ID
              <input required value={fields.id} onChange={(e) => setFields({ ...fields, id: e.target.value })} />
            </label>
            <label className="wide">
              Description
              <input required value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} />
            </label>
            <label>
              Supplier Reference
              <input required value={fields.reference} onChange={(e) => setFields({ ...fields, reference: e.target.value })} />
            </label>
            <label>
              Supplier URL
              <input type="url" value={fields.supplierUrl} onChange={(e) => setFields({ ...fields, supplierUrl: e.target.value })} />
            </label>
            <label>
              Transaction Hash <small>Optional</small>
              <input
                value={fields.transactionHash}
                onChange={(e) => setFields({ ...fields, transactionHash: e.target.value })}
                placeholder="No transaction exists yet"
              />
            </label>
            <label>
              Risk Class
              <input value="HIGH" readOnly />
            </label>
          </div>

          <div className="conditions-head">
            <div>
              <p className="eyebrow">02 · EVIDENCE CONTEXT SCENARIOS</p>
              <h2>Choose an Evidence Scenario</h2>
            </div>
            <p>Proven live-derived and synthetic test conditions for deterministic judge evaluation.</p>
          </div>

          <div className="condition-grid" role="radiogroup" aria-label="Evidence conditions">
            {scenarios.map(({ id, name, description, provenance }, index) => (
              <button
                type="button"
                role="radio"
                aria-checked={condition === id}
                className={condition === id ? "condition active" : "condition"}
                onClick={() => chooseScenario(id)}
                key={id}
              >
                <span className="condition-index">0{index + 1}</span>
                <strong>{name}</strong>
                <span>{description}</span>
                <span className={`provenance-badge ${provenance.includes("SYNTHETIC") ? "synthetic" : "live"}`}>
                  {provenance}
                </span>
              </button>
            ))}
          </div>

          <button className="evaluate" type="submit" disabled={loading}>
            <span>{loading ? "Evaluating with Deterministic Product API…" : "Evaluate Action Decision"}</span>
            <b>→</b>
          </button>
        </form>

        <div className="status-region" aria-live="polite">
          {error && (
            <div className="api-error">
              <strong>Product API unavailable</strong>
              <span>{error}</span>
              <small>No browser-side fallback was used.</small>
            </div>
          )}
        </div>

        {decision && replay && (
          <section className={`decision-result ${decision.decision.toLowerCase()}`} aria-labelledby="decision-title">
            <div className="decision-banner">
              <div>
                <p className="eyebrow">03 · DETERMINISTIC DECISION · {scenario.provenance}</p>
                <h2 id="decision-title">{decision.decision}</h2>
                <p>{decision.reasons.map(readable).join(" · ")}</p>
              </div>
              <div className="decision-stats">
                <span>
                  <b>{decision.satisfiedRequirements.length}</b> satisfied
                </span>
                <span>
                  <b>{decision.unsatisfiedRequirements.length}</b> unresolved
                </span>
                <span>
                  <b>{decision.blockingEvidence.length}</b> blocking
                </span>
              </div>
            </div>

            <div className="evidence-list">
              {result.decisionPacket.evidenceAssessments.map((item) => (
                <article className="evidence-card" key={item.intent}>
                  <div className="evidence-title">
                    <span>{readable(item.intent)}</span>
                    <b className={`quality q-${item.quality.toLowerCase()}`}>{item.quality}</b>
                  </div>
                  <dl>
                    <div>
                      <dt>Provider Confidence</dt>
                      <dd>{percent(item.providerConfidence)}</dd>
                    </div>
                    <div>
                      <dt>Nexora Quality</dt>
                      <dd>{item.quality}</dd>
                    </div>
                    <div>
                      <dt>Coverage</dt>
                      <dd>{readable(item.coverage)}</dd>
                    </div>
                    <div>
                      <dt>Independent Verification</dt>
                      <dd>{readable(item.verification)}</dd>
                    </div>
                    <div>
                      <dt>Uncertainties</dt>
                      <dd>{item.uncertainties.length}</dd>
                    </div>
                    <div>
                      <dt>Contradictions / Missing</dt>
                      <dd>
                        {item.contradictions.length} / {item.missingEvidence.length}
                      </dd>
                    </div>
                    {item.providerFacts?.transactionStatus && (
                      <div>
                        <dt>Provider Result</dt>
                        <dd>{String(item.providerFacts.transactionStatus)}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="evidence-reason">{item.reasons[0]}</p>
                  {item.coverage === "OUT_OF_COVERAGE" && (
                    <p className="explanation">
                      Confidence 0 does not mean the supplier is safe. The provider could not establish sufficient evidence, so Nexora preserves uncertainty instead of treating absence as approval.
                    </p>
                  )}
                  {(item.quality === "CONTRADICTED" || item.verification === "CONTRADICTED") && (
                    <p className="explanation">
                      High provider confidence does not override independently conflicting evidence. Nexora preserves the conflict and routes the action to review.
                    </p>
                  )}
                  <small>
                    {item.findings.length
                      ? item.findings.map(readable).join(" · ")
                      : "No qualifying policy finding"}
                  </small>
                </article>
              ))}
            </div>

            {/* Decision Replay Section */}
            <button
              className="replay-trigger"
              type="button"
              aria-expanded={showReplay}
              onClick={() => setShowReplay(!showReplay)}
            >
              <span>{showReplay ? "Hide Decision Replay" : "View Decision Replay & Audit Proof"}</span>
              <b>{replay.validation.status} ↗</b>
            </button>

            {showReplay && (
              <div className="replay" id="decision-replay">
                <div className="replay-head">
                  <div>
                    <p className="eyebrow">04 · DECISION REPLAY & INTEGRITY PROOF</p>
                    <h3>
                      {replay.validation.matches
                        ? "Deterministic Integrity Verified: Identical Inputs → Identical Policy → Identical Decision."
                        : "Integrity Mismatch: Recorded decision differs from deterministic recalculation."}
                    </h3>
                  </div>
                  <span className={replay.validation.matches ? "match" : "mismatch"}>
                    {replay.validation.matches ? "✓ VERIFIED MATCH" : "× MISMATCH"}
                  </span>
                </div>

                <div className="replay-meta">
                  <div>
                    <small>Decision ID</small>
                    <code>{replay.decisionId}</code>
                  </div>
                  <div>
                    <small>SHA-256 Decision Fingerprint</small>
                    <code>{replay.fingerprint}</code>
                    <button
                      type="button"
                      className="btn-copy"
                      onClick={() => copyFingerprint(replay.fingerprint)}
                    >
                      {copied ? "Copied! ✓" : "Copy Fingerprint"}
                    </button>
                  </div>
                  <div>
                    <small>Recorded vs Recomputed Decision</small>
                    <code>
                      {replay.validation.recordedDecision} / {replay.validation.recomputedDecision}
                    </code>
                  </div>
                  <div>
                    <small>Post-Decision Execution State</small>
                    <code>{replay.postDecisionOutcome}</code>
                  </div>
                </div>

                <div className="timeline-wrap">
                  <h4>Ordered Replay Reconstruction Timeline</h4>
                  <ol className="timeline">
                    {replay.timeline.map((item) => (
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

                <div className="raw-packet-section">
                  <button
                    type="button"
                    className="btn-raw-toggle"
                    onClick={() => setShowRawPacket(!showRawPacket)}
                  >
                    {showRawPacket ? "Hide Raw Decision Packet JSON" : "Inspect Raw Decision Packet JSON ▾"}
                  </button>
                  {showRawPacket && (
                    <pre className="raw-json-block">
                      {JSON.stringify(result.decisionPacket, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
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
