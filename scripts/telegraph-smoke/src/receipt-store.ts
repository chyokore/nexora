import { canonicalSerialize, sanitizeReplayValue } from "./decision-replay.js";
import type { DecisionPacket } from "./decision-packet.js";

export interface PersistedReceipt {
  version: 1;
  receiptId: string;
  createdAt: string;
  decisionFingerprint: string;
  packet: DecisionPacket;
}

const MAX_RECEIPT_BYTES = 65_536;
const RECEIPT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

const inMemoryStore = new Map<string, string>();

export function isReceiptStorageConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function validateReceiptId(receiptId: string): boolean {
  return RECEIPT_ID_PATTERN.test(receiptId);
}

export async function saveReceipt(
  packet: DecisionPacket,
  env: Record<string, string | undefined> = process.env
): Promise<{ receiptId: string; created: boolean; persisted: boolean } | null> {
  try {
    const sanitizedPacket = sanitizeReplayValue(packet) as DecisionPacket;
    const fingerprint = packet.decisionId.replace(/^decision:/, "");
    const receiptId = fingerprint.slice(0, 64);

    if (!validateReceiptId(receiptId)) return null;

    const envelope: PersistedReceipt = {
      version: 1,
      receiptId,
      createdAt: new Date().toISOString(),
      decisionFingerprint: fingerprint,
      packet: sanitizedPacket,
    };

    const json = JSON.stringify(envelope);
    if (Buffer.byteLength(json, "utf8") > MAX_RECEIPT_BYTES) {
      return null;
    }

    const key = `receipt:${receiptId}`;

    if (isReceiptStorageConfigured(env)) {
      const url = env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
      const token = env.UPSTASH_REDIS_REST_TOKEN!;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["SET", key, json, "NX"]),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return { receiptId, created: false, persisted: false };
      const data = (await res.json()) as { result?: string | null };
      const created = data.result === "OK";
      return { receiptId, created, persisted: true };
    }

    // In-memory fallback for testing / unconfigured local environment
    if (inMemoryStore.has(key)) {
      return { receiptId, created: false, persisted: true };
    }
    inMemoryStore.set(key, json);
    return { receiptId, created: true, persisted: true };
  } catch {
    return null;
  }
}

export async function getReceipt(
  receiptId: string,
  env: Record<string, string | undefined> = process.env
): Promise<PersistedReceipt | null> {
  try {
    if (!validateReceiptId(receiptId)) return null;
    const key = `receipt:${receiptId}`;

    let json: string | null = null;

    if (isReceiptStorageConfigured(env)) {
      const url = env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
      const token = env.UPSTASH_REDIS_REST_TOKEN!;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["GET", key]),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return null;
      const data = (await res.json()) as { result?: string | null };
      json = data.result ?? null;
    } else {
      json = inMemoryStore.get(key) ?? null;
    }

    if (!json) return null;
    if (Buffer.byteLength(json, "utf8") > MAX_RECEIPT_BYTES) return null;

    const parsed = JSON.parse(json) as PersistedReceipt;
    if (parsed.version !== 1 || typeof parsed.receiptId !== "string" || !parsed.packet) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearInMemoryReceipts(): void {
  inMemoryStore.clear();
}
