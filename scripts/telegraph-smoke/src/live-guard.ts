/**
 * Live Decision gate — rate limiting, concurrency, and process-scoped spend guard.
 *
 * === Budget model ===
 *
 * This guard tracks spending only within the current process lifetime.
 * It resets on every server restart. It is NOT a durable daily budget.
 *
 * The actual blast radius is bounded by three independent hard limits:
 *
 *   1. Dedicated burner wallet balance — the wallet holds a fixed amount and
 *      cannot pay more than it contains regardless of what this guard says.
 *
 *   2. Per-decision cap — each run is bounded to 3 paid calls and 30,000
 *      micro-USDC (0.03 USDC) by the LiveRunLedger in policy.ts. Even if
 *      this guard malfunctions, a single run cannot exceed that amount.
 *
 *   3. Emergency disable — set ENABLE_LIVE_REFERENCE_AGENT=false to
 *      instantly reject all incoming live decision requests without
 *      changing any other configuration.
 *
 * The process-scoped counter adds a secondary layer of defense:
 * if the server stays up, it will stop accepting new runs once the
 * configured process budget is reached. This is useful for demos where
 * restarts are infrequent and a loose ceiling is acceptable.
 *
 * === Idempotency ===
 *
 * In-process: exact — the same run ID cannot be re-accepted.
 * After restart: not preserved — the concurrency and spend counters reset.
 * Hard protection after restart: wallet balance ceiling + per-run budget cap.
 *
 * Do NOT add Redis, Postgres, Supabase, or any other persistence layer
 * for this hackathon deployment.
 */

export interface LiveDecisionGuardConfig {
  /**
   * Maximum micro-USDC that may be spent across all runs within the current
   * process lifetime (NOT a durable daily budget).
   * Default: 1,500,000 (1.50 USDC).
   */
  processSpendCapMicroUsdc: number;
  /** Minimum milliseconds between runs from the same client key. Default: 60,000 (60s). */
  perClientCooldownMs: number;
  /** Maximum concurrent runs permitted at one time. Default: 2. */
  maxConcurrency: number;
}

function resolveConfig(): LiveDecisionGuardConfig {
  const budgetEnv = process.env.LIVE_AGENT_DAILY_BUDGET_MICRO_USDC;
  const processSpendCap = budgetEnv && /^\d+$/.test(budgetEnv) ? Number(budgetEnv) : 1_500_000;
  return {
    processSpendCapMicroUsdc: processSpendCap,
    perClientCooldownMs: 60_000,
    maxConcurrency: 2,
  };
}

export class LiveDecisionGuard {
  readonly config: LiveDecisionGuardConfig;
  /** Process-lifetime spend counter. Resets on server restart. */
  #processSpentMicroUsdc = 0;
  #activeRuns = 0;
  #completedRuns = 0;
  #allowCount = 0;
  #reviewCount = 0;
  #blockCount = 0;
  #totalPaidCalls = 0;
  #lastRunByClient = new Map<string, number>();
  /** Accepted run IDs within this process — prevents in-process double-accept. */
  #acceptedRunIds = new Set<string>();

  constructor(config?: Partial<LiveDecisionGuardConfig>) {
    this.config = { ...resolveConfig(), ...config };
  }

  isEnabled(): boolean {
    return process.env.ENABLE_LIVE_REFERENCE_AGENT !== "false";
  }

  /**
   * Check whether a new run is permitted.
   * Does NOT register the run — call beginRun() if allowed.
   */
  canRun(clientKey: string): { allowed: boolean; reason?: string } {
    if (!this.isEnabled()) return { allowed: false, reason: "LIVE_AGENT_DISABLED" };
    if (this.#activeRuns >= this.config.maxConcurrency) return { allowed: false, reason: "CONCURRENCY_LIMIT_REACHED" };
    if (this.#processSpentMicroUsdc >= this.config.processSpendCapMicroUsdc) {
      return { allowed: false, reason: "PROCESS_SPEND_CAP_REACHED" };
    }

    const lastRun = this.#lastRunByClient.get(clientKey);
    if (lastRun !== undefined && Date.now() - lastRun < this.config.perClientCooldownMs) {
      const remaining = Math.ceil((this.config.perClientCooldownMs - (Date.now() - lastRun)) / 1000);
      return { allowed: false, reason: `COOLDOWN_ACTIVE:${remaining}s` };
    }

    return { allowed: true };
  }

  /**
   * Register the beginning of a run.
   * @throws if runId was already accepted in this process.
   */
  beginRun(runId: string, clientKey: string): void {
    if (this.#acceptedRunIds.has(runId)) throw new Error(`Run ID already accepted in this process: ${runId}`);
    this.#acceptedRunIds.add(runId);
    this.#activeRuns++;
    this.#lastRunByClient.set(clientKey, Date.now());
  }

  endRun(decisionValue: string, totalSettledMicroUsdc: number, paidCallCount: number): void {
    this.#activeRuns = Math.max(0, this.#activeRuns - 1);
    this.#processSpentMicroUsdc += totalSettledMicroUsdc;
    this.#completedRuns++;
    this.#totalPaidCalls += paidCallCount;
    if (decisionValue === "ALLOW") this.#allowCount++;
    else if (decisionValue === "BLOCK") this.#blockCount++;
    else this.#reviewCount++;
  }

  processSpendRemaining(): number {
    return Math.max(0, this.config.processSpendCapMicroUsdc - this.#processSpentMicroUsdc);
  }

  /**
   * Returns statistics scoped to the current process lifetime.
   * Explicitly labeled process_scoped to avoid confusion with durable accounting.
   */
  stats() {
    return {
      scope: "process_scoped",
      completedRuns: this.#completedRuns,
      totalPaidCalls: this.#totalPaidCalls,
      processSpentMicroUsdc: this.#processSpentMicroUsdc,
      decisions: { ALLOW: this.#allowCount, REVIEW: this.#reviewCount, BLOCK: this.#blockCount },
      processSpendRemainingMicroUsdc: this.processSpendRemaining(),
    };
  }
}
