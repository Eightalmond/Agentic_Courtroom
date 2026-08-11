import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { readDemoConfiguration } from "@/lib/demo/environment";
import type { DemoEnvironment } from "@/lib/demo/config";

export type RateLimitBucket = "simulation" | "courtroom";

type WindowRecord = { count: number; resetAt: number };
type RateLimitStore = Map<string, WindowRecord>;

const MAX_STORED_WINDOWS = 5_000;
const globalStore = globalThis as typeof globalThis & {
  __trialByUserRateLimits?: RateLimitStore;
  __trialByUserInFlight?: Set<string>;
};

function rateLimitStore() {
  return (globalStore.__trialByUserRateLimits ??= new Map());
}

function inFlightStore() {
  return (globalStore.__trialByUserInFlight ??= new Set());
}

function coarsenAddress(value: string) {
  const address = value.trim();
  if (isIP(address) === 4) {
    const parts = address.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (isIP(address) === 6) {
    return `${address.split(":").slice(0, 4).join(":")}::/64`;
  }
  return "unknown";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function getPrivacySafeClientKey(
  request: Request,
  environment: DemoEnvironment = process.env,
) {
  if (environment.VERCEL === "1") {
    const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
    const address = forwarded?.split(",")[0]?.trim();
    if (address) return `network:${digest(coarsenAddress(address))}`;
  }

  const fallback = [
    new URL(request.url).host,
    request.headers.get("user-agent")?.slice(0, 200) ?? "unknown-agent",
  ].join("|");
  return `anonymous:${digest(fallback)}`;
}

export type RateLimitResult = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}>;

export function consumeRateLimit(
  request: Request,
  bucket: RateLimitBucket,
  options: {
    now?: number;
    store?: RateLimitStore;
    environment?: DemoEnvironment;
  } = {},
): RateLimitResult {
  const now = options.now ?? Date.now();
  const store = options.store ?? rateLimitStore();
  const environment = options.environment ?? process.env;
  const configuration = readDemoConfiguration(environment);
  const limit = bucket === "simulation" ? configuration.simulationRateLimit : configuration.courtroomRateLimit;
  const windowMilliseconds = configuration.windowSeconds * 1_000;
  const clientKey = getPrivacySafeClientKey(request, environment);
  const key = `${bucket}:${clientKey}`;

  for (const [storedKey, record] of store) {
    if (record.resetAt <= now) store.delete(storedKey);
  }
  if (store.size >= MAX_STORED_WINDOWS && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  const existing = store.get(key);
  if (!existing) {
    const resetAt = now + windowMilliseconds;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0, resetAt };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return { allowed: true, limit, remaining: limit - existing.count, retryAfterSeconds: 0, resetAt: existing.resetAt };
}

export async function executeRateLimited<T>(
  request: Request,
  bucket: RateLimitBucket,
  operation: () => Promise<T>,
  options: Parameters<typeof consumeRateLimit>[2] = {},
): Promise<
  | { allowed: false; rateLimit: RateLimitResult }
  | { allowed: true; rateLimit: RateLimitResult; value: T }
> {
  const rateLimit = consumeRateLimit(request, bucket, options);
  if (!rateLimit.allowed) return { allowed: false, rateLimit };
  return { allowed: true, rateLimit, value: await operation() };
}

export function acquireProviderRequest(
  request: Request,
  bucket: RateLimitBucket,
  runId: string,
  environment: DemoEnvironment = process.env,
) {
  const store = inFlightStore();
  const key = `${bucket}:${getPrivacySafeClientKey(request, environment)}:${runId}`;
  if (store.has(key)) return null;
  store.add(key);
  return () => store.delete(key);
}

export function createRateLimitStore(): RateLimitStore {
  return new Map();
}
